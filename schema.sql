-- D1 schema for the Cloudflare deployment (functions/api). Same tables as tools/serve.py, plus `fails`.
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
CREATE TABLE IF NOT EXISTS fails (    -- wrong-password throttle; Workers keep no memory between requests
  ip TEXT NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fails_ip ON fails(ip, t);
