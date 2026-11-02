// Accounts + progress sync on Cloudflare Pages Functions and D1. Same API as tools/serve.py
// (which still serves local QA); see that file for the protocol. Schema: schema.sql.

interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number; last_row_id: number } }>;
}
interface Env { DB: { prepare(sql: string): D1Stmt } }
interface Ctx { request: Request; env: Env }

const SESSION_DAYS = 365;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
const MIN_PASSWORD = 8;
const MAX_BODY = 256 * 1024; // a maxed-out account (every lesson, every skill in review) is ~41 KB
const LOGIN_LIMIT = [10, 600], REGISTER_LIMIT = [5, 3600]; // [count, seconds] per client

const COOKIE = 'sharpen_sid';
const ITERATIONS = 100_000; // PBKDF2-SHA256; Workers cap PBKDF2 at 100k

class ApiError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

const now = () => Math.floor(Date.now() / 1000);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

/** IPv6 clients are grouped by /64 (one customer's block), so rotating addresses doesn't help. */
export function ipKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':') + '::/64';
}
const clientKey = (req: Request) => ipKey(req.headers.get('CF-Connecting-IP') ?? 'unknown');

/** Throttle hits in the last `limit[1]` seconds for `key` (wrong passwords as "<ip>", sign-ups as "reg:<ip>"). */
async function throttled(env: Env, key: string, [max, secs]: number[]): Promise<boolean> {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM fails WHERE ip = ? AND t > ?').bind(key, now() - secs).first<{ n: number }>();
  return (r?.n ?? 0) >= max;
}
async function note(env: Env, key: string) {
  // Retention: nothing older than the longest window survives, so the table stays tiny.
  await env.DB.prepare('DELETE FROM fails WHERE t < ?').bind(now() - REGISTER_LIMIT[1]).run();
  await env.DB.prepare('INSERT INTO fails (ip, t) VALUES (?, ?)').bind(key, now()).run();
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256));
}

function json(status: number, data: unknown, cookie?: string): Response {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (cookie !== undefined) h['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(data), { status, headers: h });
}

const sessionCookie = (tok: string, maxAge: number) => `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

function token(req: Request): string | null {
  for (const part of (req.headers.get('Cookie') ?? '').split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === COOKIE && v) return v;
  }
  return null;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY) throw new ApiError(413, 'Too large.');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new ApiError(413, 'Too large.');
  let data: unknown;
  try { data = JSON.parse(text || '{}'); } catch { throw new ApiError(400, 'Bad JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(400, 'Expected an object.');
  return data as Record<string, unknown>;
}

async function user(req: Request, env: Env) {
  const tok = token(req);
  if (!tok) return null;
  return env.DB.prepare('SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?')
    .bind(await sha256(tok), now()).first<{ id: number; username: string }>();
}

async function needUser(req: Request, env: Env) {
  const u = await user(req, env);
  if (!u) throw new ApiError(401, 'Not signed in.');
  return u;
}

async function newSession(env: Env, userId: number): Promise<string> {
  const tok = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  // ponytail: expired-session sweep on every sign-in scans the table; add a cron trigger if it grows large
  await env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now()).run();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)')
    .bind(await sha256(tok), userId, now(), now() + SESSION_DAYS * 86400).run();
  return sessionCookie(tok, SESSION_DAYS * 86400);
}

async function credentials(req: Request): Promise<[string, string]> {
  const b = await body(req);
  if (typeof b.username !== 'string' || typeof b.password !== 'string') throw new ApiError(400, 'Username and password are required.');
  return [b.username.trim(), b.password];
}

const routes: Record<string, (req: Request, env: Env) => Promise<Response>> = {
  async 'POST register'(req, env) {
    const reg = 'reg:' + clientKey(req);
    if (await throttled(env, reg, REGISTER_LIMIT)) throw new ApiError(429, 'Too many new accounts from your network. Try again later.');
    const [username, password] = await credentials(req);
    if (!USERNAME_RE.test(username)) throw new ApiError(400, 'Usernames are 3 to 32 letters, digits, dots, dashes or underscores.');
    if (password.length < MIN_PASSWORD) throw new ApiError(400, `Use a password of at least ${MIN_PASSWORD} characters.`);
    if (password.length > 200) throw new ApiError(400, 'That password is too long.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const r = await env.DB.prepare('INSERT OR IGNORE INTO users (username, pw_hash, salt, created) VALUES (?, ?, ?, ?)')
      .bind(username, await hashPassword(password, salt), hex(salt.buffer), now()).run();
    if (r.meta.changes === 0) throw new ApiError(409, 'That username is taken.');
    await note(env, reg); // counts accounts created
    return json(200, { user: { username } }, await newSession(env, r.meta.last_row_id));
  },

  async 'POST login'(req, env) {
    const ip = clientKey(req);
    if (await throttled(env, ip, LOGIN_LIMIT)) throw new ApiError(429, 'Too many wrong attempts. Try again in a few minutes.');
    const [username, password] = await credentials(req);
    const row = await env.DB.prepare('SELECT id, username, pw_hash, salt FROM users WHERE username = ?')
      .bind(username).first<{ id: number; username: string; pw_hash: string; salt: string }>();
    // Hash even for unknown users so the response time doesn't reveal which names exist.
    const got = await hashPassword(password.slice(0, 200), row ? unhex(row.salt) : new Uint8Array(16));
    const ok = row !== null && got.length === row.pw_hash.length &&
      (crypto.subtle as unknown as { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }).timingSafeEqual(unhex(got), unhex(row.pw_hash));
    if (!ok) {
      await note(env, ip);
      throw new ApiError(401, 'Wrong username or password.');
    }
    return json(200, { user: { username: row.username } }, await newSession(env, row.id));
  },

  async 'POST logout'(req, env) {
    const tok = token(req);
    if (tok) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(tok)).run();
    return json(200, {}, sessionCookie('', 0));
  },

  async 'GET me'(req, env) {
    const u = await needUser(req, env);
    return json(200, { user: { username: u.username } });
  },

  async 'GET progress'(req, env) {
    const u = await needUser(req, env);
    const row = await env.DB.prepare('SELECT state, version FROM progress WHERE user_id = ?').bind(u.id).first<{ state: string; version: number }>();
    const rev = new URL(req.url).searchParams.get('rev');
    let revVersion: number | null = null;
    if (rev) {
      const r = await env.DB.prepare('SELECT version FROM pushes WHERE user_id = ? AND rev = ?').bind(u.id, rev.slice(0, 64)).first<{ version: number }>();
      revVersion = r?.version ?? null;
    }
    return json(200, { state: row ? JSON.parse(row.state) : null, version: row?.version ?? 0, revVersion });
  },

  async 'PUT progress'(req, env) {
    const u = await needUser(req, env);
    const b = await body(req);
    const { state, base, rev } = b;
    if (!state || typeof state !== 'object' || Array.isArray(state) || !Number.isInteger(base)) throw new ApiError(400, 'Expected {state, base}.');
    if (rev !== undefined && rev !== null && (typeof rev !== 'string' || rev.length < 8 || rev.length > 64)) throw new ApiError(400, 'Bad rev.');
    const v = (base as number) + 1;
    const doc = JSON.stringify(state);
    // D1 has no interactive transactions: the compare-and-swap is one conditional statement.
    const r = base === 0
      ? await env.DB.prepare('INSERT OR IGNORE INTO progress (user_id, state, version, updated) VALUES (?, ?, 1, ?)').bind(u.id, doc, now()).run()
      : await env.DB.prepare('UPDATE progress SET state = ?, version = ?, updated = ? WHERE user_id = ? AND version = ?').bind(doc, v, now(), u.id, base).run();
    if (r.meta.changes === 0) {
      const row = await env.DB.prepare('SELECT state, version FROM progress WHERE user_id = ?').bind(u.id).first<{ state: string; version: number }>();
      throw new ApiError(409, 'Progress changed on another device.', { state: row ? JSON.parse(row.state) : null, version: row?.version ?? 0 });
    }
    if (rev) {
      await env.DB.prepare('INSERT OR REPLACE INTO pushes (user_id, rev, version) VALUES (?, ?, ?)').bind(u.id, rev, v).run();
      await env.DB.prepare('DELETE FROM pushes WHERE user_id = ? AND version <= ?').bind(u.id, v - 100).run();
    }
    return json(200, { version: v });
  },
};

export async function onRequest({ request, env }: Ctx): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (request.method !== 'GET') {
      // Writes must come from this site's own pages (blocks cross-site form posts).
      const origin = request.headers.get('Origin');
      if (origin && new URL(origin).host !== url.host) throw new ApiError(403, 'Cross-site request refused.');
      if ((request.headers.get('Content-Type') ?? '').split(';')[0].trim() !== 'application/json') throw new ApiError(415, 'Send JSON.');
    }
    const route = routes[`${request.method} ${url.pathname.slice(5)}`];
    if (!route) throw new ApiError(404, 'No such endpoint.');
    return await route(request, env);
  } catch (e) {
    if (e instanceof ApiError) return json(e.status, { error: e.message, ...e.extra });
    console.error('API error:', e);
    return json(500, { error: 'Server error.' });
  }
}
