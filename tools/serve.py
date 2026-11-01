"""Sharpen server: the static web build plus a small accounts + progress-sync API on SQLite.

Usage: python3 tools/serve.py [port] [host] [dir]   (defaults: 4956 0.0.0.0 dist)
Database: $SHARPEN_DB or data/sharpen.db next to dist/ (created on first run).

API (JSON; the session is an HttpOnly cookie):
  POST /api/register {username, password}  -> {user}
  POST /api/login    {username, password}  -> {user}
  POST /api/logout                          -> {}
  GET  /api/me                              -> {user} | 401
  GET  /api/progress[?rev=R]                -> {state, version, revVersion}   (state null before the first save)
  PUT  /api/progress {state, base, rev?}    -> {version} | 409 {state, version} when base is stale

`rev` is a random id per write. If a device loses the reply to a write that did commit, it asks
with ?rev= on its next sync and learns the version its write became, so it never counts the same
progress twice.

Progress is one JSON document per user with a version number. A device writes with the version it
last saw; if another device wrote in between it gets 409 plus the newer document, merges, retries.
(The client's merge is idempotent, so it doesn't need `rev`; it's kept for clients that do.)
"""
import functools
import hashlib
import hmac
import http.server
import json
import os
import pathlib
import re
import secrets
import sqlite3
import sys
import threading
import time
import urllib.parse

APP_ROOT = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP_ROOT / "dist"
DB_PATH = pathlib.Path(os.environ.get("SHARPEN_DB", APP_ROOT / "data" / "sharpen.db"))

MAX_BODY = 2 * 1024 * 1024          # progress documents are a few KB; this is a safety cap
SESSION_DAYS = 365
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
MIN_PASSWORD = 8
COOKIE = "sharpen_sid"

# ---------------------------------------------------------------- database

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash BLOB NOT NULL,
  salt BLOB NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,          -- sha256 of the cookie value; the raw token is never stored
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS pushes (     -- recent writes by id, so a device can learn its write landed
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rev TEXT NOT NULL,
  version INTEGER NOT NULL,
  PRIMARY KEY (user_id, rev)
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
"""

_local = threading.local()


def db() -> sqlite3.Connection:
    """One connection per server thread."""
    con = getattr(_local, "con", None)
    if con is None:
        con = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
        con.execute("PRAGMA foreign_keys = ON")
        con.execute("PRAGMA busy_timeout = 10000")
        _local.con = con
    return con


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode = WAL")
    con.executescript(SCHEMA)
    con.execute("DELETE FROM sessions WHERE expires < ?", (int(time.time()),))
    con.commit()
    con.close()


def hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, maxmem=64 * 1024 * 1024, dklen=32)


# Wrong-password throttle per client address: at most 10 failures per 10 minutes.
_fails: dict[str, list[float]] = {}
_fails_lock = threading.Lock()


def throttled(ip: str) -> bool:
    now = time.time()
    with _fails_lock:
        recent = [t for t in _fails.get(ip, []) if now - t < 600]
        _fails[ip] = recent
        return len(recent) >= 10


def note_fail(ip: str):
    with _fails_lock:
        _fails.setdefault(ip, []).append(time.time())


# ---------------------------------------------------------------- HTTP


class ApiError(Exception):
    def __init__(self, status: int, message: str, extra: dict | None = None):
        super().__init__(message)
        self.status, self.message, self.extra = status, message, extra or {}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass

    # -- plumbing

    def _json(self, status: int, data: dict, cookie: str | None = None):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        super().end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ApiError(413, "Too large.")
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            raise ApiError(400, "Bad JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "Expected an object.")
        return data

    def _token(self) -> str | None:
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == COOKIE and v:
                return v
        return None

    def _user(self) -> dict | None:
        tok = self._token()
        if not tok:
            return None
        th = hashlib.sha256(tok.encode()).hexdigest()
        row = db().execute(
            "SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?",
            (th, int(time.time()))).fetchone()
        return {"id": row[0], "username": row[1]} if row else None

    def _need_user(self) -> dict:
        u = self._user()
        if not u:
            raise ApiError(401, "Not signed in.")
        return u

    def _new_session(self, user_id: int) -> str:
        tok = secrets.token_urlsafe(32)
        now = int(time.time())
        db().execute("INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)",
                     (hashlib.sha256(tok.encode()).hexdigest(), user_id, now, now + SESSION_DAYS * 86400))
        return f"{COOKIE}={tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_DAYS * 86400}"

    def _same_origin(self):
        # Writes must come from this site's own pages (blocks cross-site form posts).
        origin = self.headers.get("Origin")
        host = self.headers.get("Host")
        if origin and host and origin.split("://", 1)[-1] != host:
            raise ApiError(403, "Cross-site request refused.")
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            raise ApiError(415, "Send JSON.")

    def _api(self, method: str):
        try:
            path = self.path.split("?", 1)[0]
            if method != "GET":
                self._same_origin()
            route = getattr(self, f"api_{method}_{path[5:].replace('/', '_')}", None)
            if route is None:
                raise ApiError(404, "No such endpoint.")
            route()
        except ApiError as e:
            self._json(e.status, {"error": e.message, **e.extra})
        except Exception as e:  # keep the server up; report a generic error
            print("API error:", repr(e), file=sys.stderr)
            self._json(500, {"error": "Server error."})

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._api("GET")
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._api("POST")
        self.send_error(405)

    def do_PUT(self):
        if self.path.startswith("/api/"):
            return self._api("PUT")
        self.send_error(405)

    # -- endpoints

    def _credentials(self) -> tuple[str, str]:
        b = self._body()
        username, password = b.get("username"), b.get("password")
        if not isinstance(username, str) or not isinstance(password, str):
            raise ApiError(400, "Username and password are required.")
        return username.strip(), password

    def api_POST_register(self):
        username, password = self._credentials()
        if not USERNAME_RE.match(username):
            raise ApiError(400, "Usernames are 3 to 32 letters, digits, dots, dashes or underscores.")
        if len(password) < MIN_PASSWORD:
            raise ApiError(400, f"Use a password of at least {MIN_PASSWORD} characters.")
        if len(password) > 200:
            raise ApiError(400, "That password is too long.")
        salt = secrets.token_bytes(16)
        try:
            cur = db().execute("INSERT INTO users (username, pw_hash, salt, created) VALUES (?, ?, ?, ?)",
                               (username, hash_password(password, salt), salt, int(time.time())))
        except sqlite3.IntegrityError:
            raise ApiError(409, "That username is taken.")
        self._json(200, {"user": {"username": username}}, self._new_session(cur.lastrowid))

    def api_POST_login(self):
        ip = self.client_address[0]
        if throttled(ip):
            raise ApiError(429, "Too many wrong attempts. Try again in a few minutes.")
        username, password = self._credentials()
        row = db().execute("SELECT id, username, pw_hash, salt FROM users WHERE username = ?", (username,)).fetchone()
        # Hash even for unknown users so the response time doesn't reveal which names exist.
        ok = row is not None and hmac.compare_digest(hash_password(password[:200], row[3]), row[2])
        if row is None:
            hash_password(password[:200], b"0" * 16)
        if not ok:
            note_fail(ip)
            raise ApiError(401, "Wrong username or password.")
        self._json(200, {"user": {"username": row[1]}}, self._new_session(row[0]))

    def api_POST_logout(self):
        tok = self._token()
        if tok:
            db().execute("DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(tok.encode()).hexdigest(),))
        self._json(200, {}, f"{COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")

    def api_GET_me(self):
        u = self._need_user()
        self._json(200, {"user": {"username": u["username"]}})

    def api_GET_progress(self):
        u = self._need_user()
        row = db().execute("SELECT state, version FROM progress WHERE user_id = ?", (u["id"],)).fetchone()
        rev_version = None
        q = urllib.parse.parse_qs(self.path.partition("?")[2])
        if q.get("rev"):
            r = db().execute("SELECT version FROM pushes WHERE user_id = ? AND rev = ?", (u["id"], q["rev"][0][:64])).fetchone()
            rev_version = r[0] if r else None
        self._json(200, {"state": json.loads(row[0]) if row else None, "version": row[1] if row else 0, "revVersion": rev_version})

    def api_PUT_progress(self):
        u = self._need_user()
        b = self._body()
        state, base, rev = b.get("state"), b.get("base"), b.get("rev")
        if not isinstance(state, dict) or not isinstance(base, int):
            raise ApiError(400, "Expected {state, base}.")
        if rev is not None and (not isinstance(rev, str) or not 8 <= len(rev) <= 64):
            raise ApiError(400, "Bad rev.")
        con = db()
        con.execute("BEGIN IMMEDIATE")  # serialise writers so version checks can't race
        try:
            row = con.execute("SELECT state, version FROM progress WHERE user_id = ?", (u["id"],)).fetchone()
            current = row[1] if row else 0
            if base != current:
                con.execute("ROLLBACK")
                raise ApiError(409, "Progress changed on another device.",
                               {"state": json.loads(row[0]) if row else None, "version": current})
            con.execute(
                "INSERT INTO progress (user_id, state, version, updated) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, version = excluded.version, updated = excluded.updated",
                (u["id"], json.dumps(state, separators=(",", ":")), current + 1, int(time.time())))
            if rev:
                con.execute("INSERT OR REPLACE INTO pushes (user_id, rev, version) VALUES (?, ?, ?)", (u["id"], rev, current + 1))
            con.execute("DELETE FROM pushes WHERE user_id = ? AND version <= ?", (u["id"], current + 1 - 100))
            con.execute("COMMIT")
        except ApiError:
            raise
        except Exception:
            con.execute("ROLLBACK")
            raise
        self._json(200, {"version": current + 1})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4956
    host = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"
    if len(sys.argv) > 3:
        ROOT = pathlib.Path(sys.argv[3]).resolve()
    init_db()
    http.server.ThreadingHTTPServer((host, port), functools.partial(Handler, directory=str(ROOT))).serve_forever()
