// Progress, kept in the browser (localStorage). Everything is optional and defaults safely,
// so an empty or blocked storage just means a fresh start.

export interface ReviewItem {
  /** "courseId/lessonId/generatorIndex" */
  key: string;
  /** Leitner box 0..5: higher = longer until it comes back. */
  box: number;
  /** Day number (days since epoch) when it's due again. */
  due: number;
}

export interface State {
  xp: number;
  /** Completed lessons: "courseId/lessonId" -> day finished. */
  done: Record<string, number>;
  /** Furthest step reached in an unfinished lesson. */
  resume: Record<string, number>;
  streak: number;
  /** Day of the last day that counted toward the streak. */
  lastDay: number;
  /** Problems answered today (daily goal). */
  today: { day: number; solved: number };
  dailyGoal: number;
  review: ReviewItem[];
  /** Answers so far, for accuracy stats. */
  answered: number;
  correctFirst: number;
  theme: 'auto' | 'light' | 'dark';
}

const KEY = 'sharpen.v1';
const fresh = (): State => ({
  xp: 0, done: {}, resume: {}, streak: 0, lastDay: 0, today: { day: 0, solved: 0 }, dailyGoal: 10,
  review: [], answered: 0, correctFirst: 0, theme: 'auto',
});

export const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

export let state: State = load();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    /* blocked or corrupt storage: start fresh */
  }
  return fresh();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode etc.: progress lives for this visit only */
  }
}

export function resetAll() {
  state = fresh();
  save();
}

/** Count a solved problem toward today's goal and the streak. */
export function countSolved(firstTry: boolean, xp: number) {
  const d = today();
  if (state.today.day !== d) state.today = { day: d, solved: 0 };
  state.today.solved += 1;
  state.answered += 1;
  if (firstTry) state.correctFirst += 1;
  state.xp += xp;
  touchStreak();
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
  save();
}

export function dueReviews(): ReviewItem[] {
  const d = today();
  return state.review.filter((r) => r.due <= d).sort((a, b) => a.box - b.box || a.due - b.due);
}
