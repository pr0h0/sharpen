// Progress, kept in the browser (localStorage) and, when signed in, synced to the account
// (src/sync.ts). Everything is optional and defaults safely, so an empty or blocked storage just
// means a fresh start.
//
// Designed so two copies can always be merged without double counting (see join()): counters are
// kept per device and merged by taking each device's larger value; review items and settings carry
// the time of their last change; finished lessons only ever grow. Merging the same data twice,
// or merging an old copy, never inflates anything. That matters because browsers can lose recent
// storage writes when killed, handing back an older snapshot.

export interface ReviewItem {
  /** "courseId/lessonId/generatorIndex" */
  key: string;
  /** Leitner box 0..5: higher = longer until it comes back. */
  box: number;
  /** Day number (days since epoch) when it's due again. */
  due: number;
  /** When it was last changed (ms), so the newer copy wins when merging. */
  t?: number;
}

/** One device's running totals. */
export interface DeviceCounts {
  xp: number;
  answered: number;
  correctFirst: number;
  /** Problems solved on `day`. */
  day: number;
  solved: number;
}

export interface State {
  /** Totals over all devices (derived from `dev`). */
  xp: number;
  /** Completed lessons: "courseId/lessonId" -> day finished. */
  done: Record<string, number>;
  /** Furthest step reached in an unfinished lesson. */
  resume: Record<string, number>;
  streak: number;
  /** Day of the last day that counted toward the streak. */
  lastDay: number;
  /** Problems answered today, all devices (derived from `dev`). */
  today: { day: number; solved: number };
  dailyGoal: number;
  review: ReviewItem[];
  /** Answers so far, for accuracy stats (derived from `dev`). */
  answered: number;
  correctFirst: number;
  theme: 'auto' | 'light' | 'dark';
  /** Per-device counters, by device id. */
  dev: Record<string, DeviceCounts>;
  /** When dailyGoal/theme last changed (ms). */
  settingsT: number;
  /** Bumped by "erase progress": a copy with a newer epoch replaces older ones entirely. */
  epoch: number;
  /** Daily game scores, "gameId@day" -> 0..100. Only the last GAME_DAYS days are kept. */
  games: Record<string, number>;
  /** Best daily score per game, ever. */
  gameBest: Record<string, number>;
}

const KEY = 'sharpen.v1';
const DEVICE_KEY = 'sharpen.device';

export const fresh = (): State => ({
  xp: 0, done: {}, resume: {}, streak: 0, lastDay: 0, today: { day: 0, solved: 0 }, dailyGoal: 10,
  review: [], answered: 0, correctFirst: 0, theme: 'auto', dev: {}, settingsT: 0, epoch: 0, games: {}, gameBest: {},
});

export const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

/** This browser's id for its counters. If storage loses it, a new id simply starts a new counter. */
export let deviceId: string = (() => {
  try {
    return localStorage.getItem(DEVICE_KEY) || newDevice();
  } catch {
    return 'tmp' + Math.random().toString(36).slice(2, 10);
  }
})();

/** Start a new counter for this browser (on sign-out, so an old account's counts can't mix in). */
export function newDevice(): string {
  deviceId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try { localStorage.setItem(DEVICE_KEY, deviceId); } catch { /* keep it for this visit */ }
  return deviceId;
}

export let state: State = load();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* blocked or corrupt storage: start fresh */
  }
  return fresh();
}

/** Fill defaults, move pre-sync progress into this device's counters, recompute totals. */
export function normalize(raw: Partial<State> | null | undefined): State {
  const s: State = { ...fresh(), ...(raw ?? {}) };
  s.dev = { ...(s.dev ?? {}) };
  if (!Object.keys(s.dev).length && (s.xp || s.answered || s.today?.solved)) {
    s.dev[deviceId] = { xp: s.xp, answered: s.answered, correctFirst: s.correctFirst, day: s.today.day, solved: s.today.solved };
  }
  return recount(s);
}

/** Totals from the per-device counters. */
function recount(s: State): State {
  const devs = Object.values(s.dev);
  s.xp = devs.reduce((a, d) => a + d.xp, 0);
  s.answered = devs.reduce((a, d) => a + d.answered, 0);
  s.correctFirst = devs.reduce((a, d) => a + d.correctFirst, 0);
  const day = devs.reduce((a, d) => Math.max(a, d.day), 0);
  s.today = { day, solved: devs.filter((d) => d.day === day).reduce((a, d) => a + d.solved, 0) };
  return s;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode etc.: progress lives for this visit only */
  }
}

let afterSave: () => void = () => {};
/** The sync module hooks in here to push changes to the account. */
export function setSaveHook(f: () => void) { afterSave = f; }

export function save() {
  persist();
  afterSave();
}

/** Swap in a whole state (sync merges, sign-out, erase). Doesn't trigger a push. */
export function replaceState(s: State) {
  state = normalize(s);
  persist();
}

// ---------------------------------------------------------------- changes

function mine(): DeviceCounts {
  return (state.dev[deviceId] ??= { xp: 0, answered: 0, correctFirst: 0, day: 0, solved: 0 });
}

/** Count a solved problem toward today's goal and the streak. */
export function countSolved(firstTry: boolean, xp: number) {
  const d = today();
  const me = mine();
  if (me.day !== d) { me.day = d; me.solved = 0; }
  me.solved += 1;
  me.answered += 1;
  if (firstTry) me.correctFirst += 1;
  me.xp += xp;
  recount(state);
  touchStreak();
  save();
}

/** Extra XP (e.g. finishing a lesson). */
export function addXp(n: number) {
  mine().xp += n;
  recount(state);
}

export function setSetting<K extends 'dailyGoal' | 'theme'>(k: K, v: State[K]) {
  state[k] = v;
  state.settingsT = Date.now();
  save();
}

/** Any study today keeps the streak; a missed day resets it. */
export function touchStreak() {
  const d = today();
  if (state.lastDay === d) return;
  state.streak = state.lastDay === d - 1 ? state.streak + 1 : 1;
  state.lastDay = d;
}

/** The streak as it stands now (a day missed since the last study breaks it). */
export function liveStreak(): number {
  return state.lastDay >= today() - 1 ? state.streak : 0;
}

export function solvedToday(): number {
  return state.today.day === today() ? state.today.solved : 0;
}

/** A fresh start that wins over every older copy when merged (erase progress). */
export function erased(): State {
  return { ...fresh(), epoch: Date.now() };
}

// ---------------------------------------------------------------- merging

/**
 * Merge two copies of progress. Commutative and idempotent: join(a, b) = join(b, a), and joining
 * something already included changes nothing, so a device can't double count by syncing twice
 * or from an old snapshot.
 */
export function join(a0: State, b0: State): State {
  const a = normalize(a0), b = normalize(b0);
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? a : b;
  const out = fresh();
  out.epoch = a.epoch;

  for (const id of [...new Set([...Object.keys(a.dev), ...Object.keys(b.dev)])].sort()) {
    const x = a.dev[id], y = b.dev[id];
    if (!x || !y) { out.dev[id] = { ...(x ?? y)! }; continue; }
    const later = x.day > y.day ? x : y.day > x.day ? y : null;
    out.dev[id] = {
      xp: Math.max(x.xp, y.xp),
      answered: Math.max(x.answered, y.answered),
      correctFirst: Math.max(x.correctFirst, y.correctFirst),
      day: Math.max(x.day, y.day),
      solved: later ? later.solved : Math.max(x.solved, y.solved),
    };
  }

  for (const k of [...new Set([...Object.keys(a.done), ...Object.keys(b.done)])].sort()) {
    out.done[k] = Math.min(a.done[k] ?? Infinity, b.done[k] ?? Infinity);
  }
  for (const k of [...new Set([...Object.keys(a.resume), ...Object.keys(b.resume)])].sort()) {
    if (!(k in out.done)) out.resume[k] = Math.max(a.resume[k] ?? 0, b.resume[k] ?? 0);
  }

  if (a.lastDay !== b.lastDay) {
    const s = a.lastDay > b.lastDay ? a : b;
    out.lastDay = s.lastDay;
    out.streak = s.streak;
  } else {
    out.lastDay = a.lastDay;
    out.streak = Math.max(a.streak, b.streak);
  }

  const rev = new Map<string, ReviewItem>();
  for (const r of [...a.review, ...b.review]) {
    const o = rev.get(r.key);
    // Newer change wins; on a tie, the larger box then the later due date (deterministic).
    if (!o || (r.t ?? 0) > (o.t ?? 0) || ((r.t ?? 0) === (o.t ?? 0) && (r.box > o.box || (r.box === o.box && r.due > o.due)))) rev.set(r.key, { ...r });
  }
  out.review = [...rev.values()].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));

  for (const src of [a.games, b.games]) for (const [k, v] of Object.entries(src)) out.games[k] = Math.max(out.games[k] ?? 0, v);
  pruneGames(out.games);
  for (const src of [a.gameBest, b.gameBest]) for (const [k, v] of Object.entries(src)) out.gameBest[k] = Math.max(out.gameBest[k] ?? 0, v);

  const st = a.settingsT >= b.settingsT ? a : b;
  out.dailyGoal = st.dailyGoal;
  out.theme = st.theme;
  out.settingsT = st.settingsT;
  return recount(out);
}

// ---------------------------------------------------------------- spaced review (Leitner boxes)

const GAPS = [0, 1, 3, 7, 16, 35]; // days until due again, by box

/** Put a skill into review (on finishing a lesson, or after a miss). */
export function schedule(key: string, missed: boolean) {
  const d = today();
  let it = state.review.find((r) => r.key === key);
  if (!it) {
    it = { key, box: missed ? 0 : 1, due: d + (missed ? 0 : GAPS[1]) };
    state.review.push(it);
  } else if (missed) {
    it.box = 0;
    it.due = d;
  } else {
    it.box = Math.min(GAPS.length - 1, it.box + 1);
    it.due = d + GAPS[it.box];
  }
  it.t = Date.now();
  save();
}

export function dueReviews(): ReviewItem[] {
  const d = today();
  return state.review.filter((r) => r.due <= d).sort((a, b) => a.box - b.box || a.due - b.due);
}

// ---------------------------------------------------------------- daily games

const GAME_DAYS = 60;

/** Drop scores older than GAME_DAYS before the newest one (keeps the synced state small). */
function pruneGames(g: Record<string, number>) {
  const days = Object.keys(g).map((k) => Number(k.split('@')[1]));
  const cut = Math.max(0, ...days) - GAME_DAYS;
  for (const k of Object.keys(g)) if (Number(k.split('@')[1]) <= cut) delete g[k];
}

export const gameScore = (id: string, day = today()): number | undefined => state.games[`${id}@${day}`];

/** Record today's round of a game (first finish of the day counts); returns the XP earned. */
export function recordGame(id: string, score: number): number {
  const k = `${id}@${today()}`;
  if (k in state.games) return 0;
  state.games[k] = score;
  pruneGames(state.games);
  state.gameBest[id] = Math.max(state.gameBest[id] ?? 0, score);
  const xp = 5 + Math.round(score / 10);
  addXp(xp);
  touchStreak();
  save();
  return xp;
}
