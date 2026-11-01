// Accounts and progress sync. Progress is one document per account on the server (SQLite, see
// tools/serve.py). Every device keeps working offline from localStorage; when signed in it pushes
// changes shortly after they happen and pulls when it regains focus.
//
// Merging is store.join(): commutative and idempotent, so a sync can be repeated, interrupted or
// run from an old snapshot without double counting. The server's version number makes writes
// compare-and-swap: a device that raced another gets 409, joins again, and retries.
import { erased, fresh, join, newDevice, normalize, replaceState, state, type State } from './store';

export interface Account { username: string }
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

const ACCOUNT_KEY = 'sharpen.account';

let account: Account | null = readAccount();
let status: SyncStatus = account ? 'synced' : 'off';
let lastSynced = 0;
let timer = 0;
let running: Promise<void> | null = null;
let again = false;
const listeners = new Set<() => void>();
/** Called when a pull changed what's on screen (the app re-renders non-lesson screens). */
let onRemote: () => void = () => {};

export const currentAccount = () => account;
export const syncStatus = () => status;
export const lastSyncTime = () => lastSynced;
export function onSyncChange(f: () => void) { listeners.add(f); return () => listeners.delete(f); }
export function onRemoteState(f: () => void) { onRemote = f; }
const emit = () => listeners.forEach((f) => f());
const setStatus = (s: SyncStatus) => { status = s; emit(); };

function readAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}
function writeAccount(a: Account | null) {
  try {
    if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* storage blocked: stays signed in for this visit */
  }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- API

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}

/**
 * One full round: pull, join, push if the account is missing anything. `adopt` (first sync after
 * signing in): take the account's erase epoch, so this device's progress so far joins the account
 * instead of being discarded as older than an earlier erase.
 */
async function round(adopt = false): Promise<void> {
  setStatus('syncing');
  for (let attempt = 0; attempt < 5; attempt++) {
    const got = await api('GET', 'progress');
    if (got.status === 401) return signedOutElsewhere();
    if (got.status !== 200) throw new Error(String(got.data.error ?? got.status));
    const version = Number(got.data.version ?? 0);
    const remote = got.data.state ? normalize(got.data.state as State) : null;
    let local = state;
    if (adopt && remote && local.epoch < remote.epoch) local = { ...local, epoch: remote.epoch };
    const merged = remote ? join(local, remote) : normalize(local);
    if (!same(merged, state)) { replaceState(merged); onRemote(); }
    if (remote && same(merged, remote)) break; // the account already has everything
    const put = await api('PUT', 'progress', { state: merged, base: version });
    if (put.status === 200) break;
    if (put.status === 401) return signedOutElsewhere();
    if (put.status !== 409) throw new Error(String(put.data.error ?? put.status));
    // 409: another device wrote in between; pull and join again.
  }
  lastSynced = Date.now();
  setStatus('synced');
}

function run(adopt: boolean): Promise<void> {
  if (!account) return Promise.resolve();
  if (running) { again = true; return running; }
  running = round(adopt)
    .catch((e) => {
      setStatus(e instanceof TypeError ? 'offline' : 'error');
      // Try again shortly (also on reconnect, focus, or the next change).
      clearTimeout(timer);
      timer = window.setTimeout(() => void syncNow(), 20000);
    })
    .finally(() => {
      running = null;
      if (again) { again = false; void syncNow(); }
    });
  return running;
}

/** Sync now (coalesces overlapping calls). */
export const syncNow = () => run(false);

/** Called by the store after every local save: push a little later, batching quick changes. */
export function queueSync() {
  if (!account) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), 1500);
}

function signedOutElsewhere() {
  // The session expired or was revoked: keep local progress, stop syncing.
  account = null;
  writeAccount(null);
  setStatus('off');
}

// ---------------------------------------------------------------- account actions

async function enter(path: 'login' | 'register', username: string, password: string): Promise<string | null> {
  let r;
  try {
    r = await api('POST', path, { username, password });
  } catch {
    return 'Can’t reach the server. Check your connection.';
  }
  if (r.status !== 200) return String(r.data.error ?? 'Something went wrong.');
  account = { username: String((r.data.user as Account).username) };
  writeAccount(account);
  await run(true); // this device's progress so far joins the account
  return null;
}

export const signIn = (u: string, p: string) => enter('login', u, p);
export const register = (u: string, p: string) => enter('register', u, p);

/** Sign out: progress stays in the account; this device starts fresh. */
export async function signOut() {
  await syncNow();
  try { await api('POST', 'logout', {}); } catch { /* offline: the session just expires */ }
  account = null;
  writeAccount(null);
  newDevice();
  replaceState(fresh());
  setStatus('off');
}

/** Erase all progress: on this device, and in the account (and so every device) when signed in. */
export async function eraseEverywhere() {
  // A newer epoch wins every merge, so this reaches other devices even if they were offline.
  replaceState(erased());
  if (account) await syncNow();
}

/** Start syncing: on load, when the tab comes back, and every few minutes while visible. */
export function startSync() {
  if (account) void syncNow();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow(); });
  window.addEventListener('online', () => void syncNow());
  setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 3 * 60 * 1000);
}
