// bun test tools/test — the progress merge (store.join) used by account sync.
import { expect, test } from 'bun:test';

const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) };
const { join, fresh, normalize, erased } = await import('../../src/store');
type S = ReturnType<typeof fresh>;

const dev = (xp: number, answered = 0, correctFirst = 0, day = 0, solved = 0) => ({ xp, answered, correctFirst, day, solved });
const S = (o: Partial<S>): S => normalize({ ...fresh(), ...o });
const same = (a: unknown, b: unknown) => expect(JSON.stringify(a)).toBe(JSON.stringify(b));

test('two devices: totals add, lessons union', () => {
  const a = S({ dev: { A: dev(68, 6, 4) }, done: { 'p/a': 5 } });
  const b = S({ dev: { B: dev(62, 5, 4) }, done: { 'l/x': 6 } });
  const m = join(a, b);
  expect([m.xp, m.answered, m.correctFirst]).toEqual([130, 11, 8]);
  expect(Object.keys(m.done)).toEqual(['l/x', 'p/a']);
});

test('an old snapshot of a device never double counts (the bug this design fixes)', () => {
  const server = S({ dev: { A: dev(68), B: dev(134) } });
  const staleA = S({ dev: { A: dev(20) } }); // browser lost recent writes
  expect(join(staleA, server).xp).toBe(202);
  expect(join(server, staleA).xp).toBe(202);
});

test('idempotent and commutative', () => {
  const r = (key: string, box: number, due: number, t: number) => ({ key, box, due, t });
  const a = S({ dev: { A: dev(10, 2, 1, 7, 2) }, done: { x: 3 }, resume: { y: 2 }, review: [r('k', 1, 5, 100)], streak: 2, lastDay: 7, theme: 'dark', settingsT: 50 });
  const b = S({ dev: { A: dev(8, 1, 1, 7, 1), B: dev(5, 1, 0, 7, 1) }, done: { z: 4 }, resume: { y: 4, z: 1 }, review: [r('k', 2, 9, 200)], streak: 3, lastDay: 7, dailyGoal: 20, settingsT: 10 });
  const ab = join(a, b);
  same(ab, join(b, a));
  same(join(ab, a), ab);
  same(join(ab, b), ab);
  same(join(ab, ab), ab);
  expect(ab.xp).toBe(15);
  expect(ab.today).toEqual({ day: 7, solved: 3 });
  expect(ab.resume).toEqual({ y: 4 }); // z finished elsewhere
  expect(ab.review).toEqual([r('k', 2, 9, 200)]);
  expect([ab.theme, ab.dailyGoal]).toEqual(['dark', 10]); // newer settings change wins as a whole
  expect(ab.streak).toBe(3);
});

test('today counts only devices on the latest day', () => {
  const m = join(S({ dev: { A: dev(0, 0, 0, 10, 4) } }), S({ dev: { B: dev(0, 0, 0, 11, 3), C: dev(0, 0, 0, 11, 2) } }));
  expect(m.today).toEqual({ day: 11, solved: 5 });
  const n = join(S({ dev: { A: dev(0, 0, 0, 11, 2) } }), S({ dev: { A: dev(0, 0, 0, 10, 9) } }));
  expect(n.today).toEqual({ day: 11, solved: 2 });
});

test('streak follows the most recent study', () => {
  const m = join(S({ streak: 3, lastDay: 20 }), S({ streak: 9, lastDay: 18 }));
  expect([m.streak, m.lastDay]).toEqual([3, 20]);
});

test('erase wins over older progress, then progress after it merges normally', () => {
  const old = S({ dev: { A: dev(500) }, done: { x: 1 } });
  const wiped = erased();
  const m = join(old, wiped);
  expect([m.xp, Object.keys(m.done).length]).toEqual([0, 0]);
  const after = join({ ...wiped, dev: { B: dev(10) } } as S, old);
  expect(after.xp).toBe(10);
});

test('pre-sync progress migrates into this device\'s counter', () => {
  const s = normalize({ ...fresh(), xp: 300, answered: 40, correctFirst: 30, today: { day: 9, solved: 4 } });
  expect(Object.values(s.dev)).toEqual([dev(300, 40, 30, 9, 4)]);
  expect(s.xp).toBe(300);
});

test('game scores: max per day, best is max, old days pruned', () => {
  const a = S({ games: { 'x@100': 40, 'x@30': 9 }, gameBest: { x: 40 } });
  const b = S({ games: { 'x@100': 70, 'y@101': 5 }, gameBest: { x: 70, y: 5 } });
  const m = join(a, b);
  same(m.games, { 'x@100': 70, 'y@101': 5 });
  same(m.gameBest, { x: 70, y: 5 });
  same(join(b, a).games, m.games);
});
