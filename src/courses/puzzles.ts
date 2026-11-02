// Puzzle Solving: general strategies through original puzzles. Understand the problem, try small cases,
// count information, search state spaces, deduce in grids, prove impossibility with invariants, work
// backwards, use symmetry, and get unstuck. Every puzzle here is checked by brute force (see the
// solvers in widgets/puzzles.ts): unique solutions, fewest moves, impossibility.
import type { Choice, Course, Generator, Rng } from '../types';
import { pick, randInt, shuffle } from '../ui';
import { dataTable } from '../viz/charts';
import { cellGrid } from '../viz/cs';
import { stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import { h } from '../ui';
import {
  type GridPuzzle, type RaftOpts, type RaftState,
  balancePic, balanceTask, bfs, bfsAll, candidates, chordRegions, circlePointsPic, coinGroups, cornerLosing, cornerPic, cornerTask,
  fencePic, flipMin, flipTask, gridPic, gridSolutions, gridTask, handshakeTask, jugNext, jugSolve, jugTask, latinSquares,
  layeredGraph, lightsPic, lightsPress, lightsSolve, lightsTask, lockersPic, magicPic, minWeighings, numberGrid, pizzaPic,
  raftKey, raftLabel, raftNext, raftSafe, raftSolve, raftTask, seatsPic, slideGoal, slideNext, slidePic, slideTask, threeOutcomes, tokenBars,
} from '../widgets/puzzles';

const COLOR = '#7b8f1a';

// ---------------------------------------------------------------- shared helpers

/** Distinct numeric distractors (different from the answer), first `k` of them. */
function distinct(answer: number, wrong: number[], k = 3): number[] {
  const out: number[] = [];
  for (const w of wrong) if (w !== answer && !out.includes(w) && Number.isFinite(w) && w >= 0) out.push(w);
  return out.slice(0, k);
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Sets of k different digits 1..9 adding to s (Kakuro runs). */
function digitSets(k: number, s: number): number[][] {
  const out: number[][] = [];
  const go = (start: number, left: number, sum: number, cur: number[]) => {
    if (left === 0) { if (sum === s) out.push(cur.slice()); return; }
    for (let d = start; d <= 9; d++) { if (sum + d > s) break; cur.push(d); go(d + 1, left - 1, sum + d, cur); cur.pop(); }
  };
  go(1, k, 0, []);
  return out;
}

// ---------------------------------------------------------------- 1. understand the problem

const genFence: Generator = (rng) => {
  const d = pick(rng, [2, 3, 4, 5, 6, 8, 10]), k = randInt(rng, 3, 14), L = d * k;
  const loop = rng() < 0.4;
  const ans = loop ? k : k + 1;
  return {
    kind: 'number', tol: 0,
    body: loop
      ? `A circular path round a pond is **${L} m** long. A lamp stands every **${d} m** along it. How many lamps are there?`
      : `A straight path is **${L} m** long, with a lamp every **${d} m**, including one at each end. How many lamps?`,
    answer: ans,
    hint: 'Draw a small version and count gaps and lamps separately.',
    explain: loop
      ? `${L} ÷ ${d} = ${k} gaps. On a loop the last gap ends at the first lamp, so lamps = gaps = ${k}.`
      : `${L} ÷ ${d} = ${k} gaps. A straight row of ${k} gaps has one more lamp than gaps: ${k + 1}.`,
  };
};

const genChime: Generator = (rng) => {
  const n = randInt(rng, 3, 6), g = randInt(rng, 1, 4), s = (n - 1) * g;
  let m = randInt(rng, 7, 12);
  if (m === n) m++;
  const ans = (m - 1) * g;
  const wrong = distinct(ans, [g * m, Math.round((s * m) / n), (m + 1) * g, ans + 2 * g]);
  const whys: Record<number, string> = {};
  whys[g * m] = `That’s ${g} s per chime × ${m}, but ${m} chimes have only ${m - 1} gaps.`;
  whys[Math.round((s * m) / n)] = whys[Math.round((s * m) / n)] ?? `That scales ${s} s by ${m}/${n}, as if the time were in the chimes. It’s in the ${n - 1} gaps.`;
  return {
    kind: 'choice',
    body: `A clock chimes ${n} times at ${n} o’clock. From the first chime to the last takes **${s} seconds** (evenly spaced). How long from first to last at **${m} o’clock**?`,
    options: [{ text: `${ans} s`, correct: true }, ...wrong.map((w): Choice => ({ text: `${w} s`, why: whys[w] ?? `Count the gaps: ${m} chimes have ${m - 1} gaps of ${g} s.` }))],
    hint: 'Count the gaps between chimes, not the chimes.',
    explain: `${n} chimes have ${n - 1} gaps, so each gap is ${s} ÷ ${n - 1} = ${g} s. ${m} chimes have ${m - 1} gaps: ${ans} s.`,
  };
};

function countDigit(N: number, d: number): number {
  let c = 0;
  for (let i = 1; i <= N; i++) for (const ch of String(i)) if (ch === String(d)) c++;
  return c;
}
const genDigits: Generator = (rng) => {
  const N = randInt(rng, 30, 199), d = randInt(rng, 1, 9);
  const ans = countDigit(N, d);
  return {
    kind: 'number', tol: 0,
    body: `You write out every whole number from **1 to ${N}**. How many times do you write the digit **${d}**?`,
    answer: ans,
    hint: 'Count units digits, tens digits and hundreds digits separately. A number like 77 counts twice.',
    explain: `Units: ${[...Array(N)].filter((_, i) => (i + 1) % 10 === d).length}, tens: ${[...Array(N)].filter((_, i) => Math.floor((i + 1) / 10) % 10 === d).length}, hundreds: ${[...Array(N)].filter((_, i) => Math.floor((i + 1) / 100) === d).length}. Total ${ans}.`,
  };
};

// The seating puzzle (checked: exactly one arrangement fits).
const SEAT_ORDER = ['Cy', 'Dee', 'Eli', 'Ana', 'Ben'];

// ---------------------------------------------------------------- 2. small cases

const genHandshake: Generator = (rng) => {
  const n = randInt(rng, 6, 40);
  const ctx = pick(rng, [
    [`**${n}** people at a meeting each shake hands with every other person once. How many handshakes?`, 'handshakes'],
    [`**${n}** players enter a chess league where every player plays every other player once. How many games?`, 'games'],
    [`**${n}** towns, and a straight road joins every pair of towns. How many roads?`, 'roads'],
  ] as const);
  return {
    kind: 'number', tol: 0,
    body: ctx[0], answer: (n * (n - 1)) / 2,
    hint: 'Small cases: 2 give 1, 3 give 3, 4 give 6. Each one pairs with n − 1 others, and each pair is counted twice.',
    explain: `Each of the ${n} pairs with ${n - 1} others: ${n} × ${n - 1} = ${n * (n - 1)}, counting every pair twice. ${n * (n - 1)} ÷ 2 = ${(n * (n - 1)) / 2} ${ctx[1]}.`,
  };
};

const genPizza: Generator = (rng) => {
  const n = randInt(rng, 3, 16);
  return {
    kind: 'number', tol: 0,
    body: `What is the **largest** number of pieces you can cut a round pizza into with **${n}** straight cuts?`,
    answer: 1 + (n * (n + 1)) / 2,
    hint: 'The k-th cut can cross all k − 1 earlier cuts, so it adds k pieces.',
    explain: `Start with 1 piece; cut k adds k. Total 1 + (1 + 2 + … + ${n}) = 1 + ${(n * (n + 1)) / 2} = ${1 + (n * (n + 1)) / 2}.`,
  };
};

const genSquares: Generator = (rng) => {
  const n = randInt(rng, 3, 10);
  const ans = (n * (n + 1) * (2 * n + 1)) / 6;
  const wrong = distinct(ans, [n * n, (n * (n + 1)) / 2, ans - n * n, n * n + (n - 1) * (n - 1), 2 * ans]);
  const why = (w: number) => w === n * n ? `That counts only the 1 × 1 squares.`
    : w === ans - n * n ? `That forgets the ${n * n} small 1 × 1 squares.`
    : w === (n * (n + 1)) / 2 ? 'That’s 1 + 2 + … + n, not 1² + 2² + … + n².'
    : w === n * n + (n - 1) * (n - 1) ? `That stops at the 2 × 2 squares; there are bigger ones too.`
    : 'Count each size: k × k squares fit in (n − k + 1)² positions.';
  return {
    kind: 'choice',
    body: `How many squares of **all sizes** can you find on a **${n} × ${n}** grid of squares?`,
    options: [{ text: String(ans), correct: true }, ...wrong.map((w) => ({ text: String(w), why: why(w) }))],
    hint: 'Small cases: a 1 × 1 grid has 1 square, a 2 × 2 has 4 + 1 = 5, a 3 × 3 has 9 + 4 + 1 = 14.',
    explain: `1 × 1: ${n}², 2 × 2: ${n - 1}², … , ${n} × ${n}: 1. Total ${Array.from({ length: n }, (_, i) => `${n - i}²`).join(' + ')} = ${ans}.`,
  };
};

// Pizza cuts in general position (every pair crosses inside, no three meet).
const CUTS: [number, number][][] = [[[100, 280]], [[100, 280], [20, 210]], [[100, 280], [20, 210], [150, 330]]];
// Points on a circle spaced unevenly so that no three chords meet at a point.
const CIRCLE_PTS = [[90], [90, 270], [90, 210, 330], [90, 170, 260, 330], [90, 150, 220, 290, 340], [90, 135, 200, 250, 305, 350]];
const circleRegions = (angles: number[]) => {
  const ch: [number, number][] = [];
  for (let i = 0; i < angles.length; i++) for (let j = i + 1; j < angles.length; j++) ch.push([angles[i], angles[j]]);
  return chordRegions(ch).regions;
};

// ---------------------------------------------------------------- 3. weighing

const genWeigh: Generator = (rng) => {
  const n = randInt(rng, 4, 250), light = rng() < 0.5;
  const k = minWeighings(n);
  return {
    kind: 'number', tol: 0,
    body: `**${n}** identical-looking coins, one fake that is a little **${light ? 'lighter' : 'heavier'}**. What is the fewest number of balance weighings that **guarantees** finding it?`,
    answer: k,
    hint: 'k weighings can settle up to 3ᵏ coins: 3, 9, 27, 81, 243, …',
    explain: `3^${k - 1} = ${3 ** (k - 1)} < ${n} ≤ ${3 ** k} = 3^${k}. Split the suspects into three near-equal groups each time; ${k - 1} weighing${k - 1 === 1 ? '' : 's'} can only tell ${3 ** (k - 1)} apart.`,
  };
};

const genBags: Generator = (rng) => {
  const k = randInt(rng, 5, 10), g = pick(rng, [5, 10, 20]), dlt = pick(rng, [1, 2]), b = randInt(rng, 1, k);
  const T = (k * (k + 1)) / 2, R = g * T + dlt * b;
  const others = shuffle(rng, Array.from({ length: k }, (_, i) => i + 1).filter((x) => x !== b)).slice(0, 3);
  return {
    kind: 'choice',
    body: `${k} bags of coins; one bag is all fakes. Real coins weigh **${g} g**, fakes **${g + dlt} g**. You take 1 coin from bag 1, 2 from bag 2, …, ${k} from bag ${k}, and weigh them together once: **${R} g**. Which bag holds the fakes?`,
    options: [{ text: `Bag ${b}`, correct: true }, ...others.map((o) => ({ text: `Bag ${o}`, why: `Bag ${o} would add ${o} × ${dlt} g, for a total of ${g * T + dlt * o} g.` }))],
    hint: `If every coin were real, the ${T} coins would weigh ${g * T} g.`,
    explain: `${T} real coins would weigh ${g * T} g. The extra ${R - g * T} g is ${dlt} g per fake, so there are ${(R - g * T) / dlt} fakes: they came from bag ${b}.`,
  };
};

const genQuestions: Generator = (rng) => {
  const N = randInt(rng, 10, 3000);
  const k = Math.ceil(Math.log2(N) - 1e-12);
  const ctx = pick(rng, [`I think of a whole number from 1 to **${N}**.`, `A card is hidden somewhere in a stack of **${N}** cards.`, `One of **${N}** lockers holds the prize.`]);
  return {
    kind: 'number', tol: 0,
    body: `${ctx} You may ask yes/no questions. How many questions **guarantee** you can pin it down?`,
    answer: k,
    hint: 'Each question has 2 outcomes, so k questions separate at most 2ᵏ possibilities.',
    explain: `2^${k - 1} = ${2 ** (k - 1)} < ${N} ≤ ${2 ** k} = 2^${k}. Halving the possibilities each time takes ${k} questions, and fewer can’t tell ${N} cases apart.`,
  };
};

// ---------------------------------------------------------------- 4. state spaces

const RAFT1: RaftOpts = {
  keeper: { name: 'Ranger', icon: '🧑' },
  items: [{ id: 'c', name: 'Cat', icon: '🐱' }, { id: 'p', name: 'Parrot', icon: '🦜' }, { id: 's', name: 'Seeds', icon: '🌾' }],
  conflicts: [{ a: 'c', b: 'p', text: 'The cat ate the parrot!' }, { a: 'p', b: 's', text: 'The parrot ate the seeds!' }],
  cap: 1,
};
const RAFT2: RaftOpts = {
  keeper: { name: 'Ranger', icon: '🧑' },
  items: [{ id: 's', name: 'Seeds', icon: '🌾' }, { id: 'p', name: 'Parrot', icon: '🦜' }, { id: 'c', name: 'Cat', icon: '🐱' }, { id: 'd', name: 'Dog', icon: '🐶' }, { id: 'h', name: 'Ham', icon: '🍖' }],
  conflicts: [{ a: 'p', b: 's', text: 'The parrot ate the seeds!' }, { a: 'c', b: 'p', text: 'The cat ate the parrot!' }, { a: 'd', b: 'c', text: 'The dog chased off the cat!' }, { a: 'd', b: 'h', text: 'The dog ate the ham!' }],
  cap: 2,
};
const R1_PATH = raftSolve(RAFT1)!;
const R2_PATH = raftSolve(RAFT2)!;
const R1_ALL = bfsAll<RaftState>({ far: 0, k: 0 }, raftKey, (s) => raftNext(RAFT1, s));
const R1_LAYERS = (() => {
  const L: { id: string; label: string }[][] = [];
  for (const [k, v] of R1_ALL) (L[v.d] ??= []).push({ id: k, label: raftLabel(RAFT1, v.s) });
  return L;
})();
const R1_EDGES = (() => {
  const E: [string, string][] = [], seen = new Set<string>();
  for (const [k, v] of R1_ALL) for (const t of raftNext(RAFT1, v.s)) {
    const k2 = raftKey(t), e = [k, k2].sort().join('|');
    if (!seen.has(e)) { seen.add(e); E.push([k, k2]); }
  }
  return E;
})();
const R1_SAFE_COUNT = Array.from({ length: 16 }, (_, m) => ({ far: m & 7, k: m >> 3 })).filter((s) => raftSafe(RAFT1, s)).length;

function raftWords(o: RaftOpts, s: RaftState): string {
  const side = (b: number) => [...(s.k === b ? [o.keeper.name] : []), ...o.items.filter((_, i) => ((s.far >> i) & 1) === b).map((it) => it.name)].join(', ') || 'nobody';
  return `${side(0)} | ${side(1)}`;
}
function raftRoute(o: RaftOpts, path: RaftState[]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1];
    const moved = o.items.filter((_, j) => ((a.far ^ b.far) >> j) & 1).map((it) => `the ${it.name.toLowerCase()}`);
    const over = a.k === 0;
    out.push(moved.length ? `${over ? 'take' : 'bring'} ${moved.join(' and ')} ${over ? 'over' : 'back'}` : over ? 'cross alone' : 'come back alone');
  }
  return out.join('; ');
}

const JUG = { a: 4, b: 9, t: 6 };
const JUG_PATH = jugSolve(JUG.a, JUG.b, JUG.t)!;
const JUG_ALL = bfsAll<[number, number]>([0, 0], (s) => s.join(','), (s) => jugNext(JUG.a, JUG.b, s));
const JUG_MATCH = [1, 2, 3, 4].map((d) => [...JUG_ALL.values()].filter((v) => v.d === d).sort((p, q) => p.s[0] - q.s[0] || p.s[1] - q.s[1])[0].s);
function jugRoute(a: number, b: number, path: [number, number][]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const [x, y] = path[i], [x2, y2] = path[i + 1];
    const what = x2 === a && y2 === y && x !== a ? 'fill A' : y2 === b && x2 === x && y !== b ? 'fill B' : x2 === 0 && y2 === y ? 'empty A' : y2 === 0 && x2 === x ? 'empty B' : x2 < x ? 'pour A into B' : 'pour B into A';
    out.push(`${what} → (${x2}, ${y2})`);
  }
  return out.join(', ');
}

/** Knights and trolls: fewest crossings, or -1. State: knights and trolls on the start bank, boat side. */
function knightsMin(n: number, cap: number): number {
  type S = [number, number, number];
  const safe = (k: number, t: number) => (k === 0 || k >= t) && (n - k === 0 || n - k >= n - t);
  const p = bfs<S>([n, n, 0], (s) => s.join(','), ([k, t, b]) => {
    const out: S[] = [];
    for (let dk = 0; dk <= cap; dk++) for (let dt = 0; dk + dt <= cap; dt++) {
      if (dk + dt === 0) continue;
      const k2 = b === 0 ? k - dk : k + dk, t2 = b === 0 ? t - dt : t + dt;
      if (k2 < 0 || t2 < 0 || k2 > n || t2 > n || !safe(k2, t2)) continue;
      out.push([k2, t2, 1 - b]);
    }
    return out;
  }, ([k, t, b]) => k === 0 && t === 0 && b === 1);
  return p ? p.length - 1 : -1;
}

const genJug: Generator = (rng) => {
  for (;;) {
    const [a, b] = pick(rng, [[3, 5], [4, 7], [4, 9], [5, 7], [5, 8], [3, 7], [5, 9], [7, 11], [6, 11]]);
    const t = randInt(rng, 1, b - 1);
    const p = jugSolve(a, b, t);
    if (!p || p.length - 1 < 3 || t === a) continue;
    return {
      kind: 'number', tol: 0,
      body: `Jugs of **${a}** and **${b}** litres, a tap and a drain. A step is filling a jug, emptying one, or pouring one into the other until one is empty or the other full. Fewest steps to get exactly **${t}** litres in one jug?`,
      answer: p.length - 1,
      hint: 'Search the states (litres in A, litres in B) breadth-first from (0, 0).',
      explain: `A breadth-first search finds ${t} litres first at depth ${p.length - 1}. States are (A, B): ${jugRoute(a, b, p)}.`,
    };
  }
};

const KNIGHT_CASES = ([[2, 2], [3, 2], [4, 3], [5, 3], [3, 3], [2, 3]] as [number, number][]).map(([n, c]) => [n, c, knightsMin(n, c)]).filter((x) => x[2] > 0);
const genKnights: Generator = (rng) => {
  const [n, cap, ans] = pick(rng, KNIGHT_CASES);
  return {
    kind: 'number', tol: 0,
    body: `**${n}** knights and **${n}** trolls must cross a river. The boat holds up to **${cap}** and needs someone to row it. On either bank, trolls must never outnumber knights (unless no knights are there). Fewest crossings?`,
    answer: ans,
    hint: 'A state is (knights on the start bank, trolls on the start bank, which side the boat is on). Search outward from the start.',
    explain: `A breadth-first search over the (knights, trolls, boat) states reaches everyone across first after ${ans} crossings.`,
  };
};

const genStates: Generator = (rng) => {
  const n = randInt(rng, 2, 7);
  const ans = 2 ** (n + 1);
  const wrong = distinct(ans, [2 ** n, 2 * (n + 1), (n + 1) ** 2, n + 1, 2 ** (n + 2), n * n + 1]);
  return {
    kind: 'choice',
    body: `A ferryman and **${n}** pieces of cargo, each on one of two banks. How many different arrangements are there (ignoring whether they’re safe)?`,
    options: [{ text: String(ans), correct: true }, ...wrong.map((w) => ({ text: String(w), why: w === 2 ** n ? 'That forgets the ferryman, who is on a bank too.' : `Each of the ${n + 1} is independently on one of 2 banks: multiply, don’t add.` }))],
    hint: 'Each of them, independently, is on one bank or the other.',
    explain: `${n + 1} independent two-way choices: 2^${n + 1} = ${ans}. The safety rules then cut that down, and search only ever visits the safe ones.`,
  };
};

// ---------------------------------------------------------------- 5. grids

const empty4 = () => Array.from({ length: 4 }, () => Array(4).fill(0));
const SUDOKU_ALL = gridSolutions({ n: 4, box: [2, 2], givens: empty4() }, Infinity);
const SUDOKU1: GridPuzzle = { n: 4, box: [2, 2], givens: [[4, 0, 1, 0], [0, 0, 0, 4], [3, 4, 0, 0], [1, 0, 0, 0]] };
const SUDOKU1_SOL = gridSolutions(SUDOKU1, 2)[0];
const SUDOKU_READ: GridPuzzle = { n: 4, box: [2, 2], givens: [[0, 0, 0, 4], [2, 0, 0, 0], [0, 0, 0, 1], [0, 0, 3, 0]] };
const SUDOKU_Q: GridPuzzle = { n: 4, box: [2, 2], givens: [[3, 0, 0, 2], [0, 1, 0, 0], [0, 0, 0, 3], [0, 0, 0, 0]] };
const SUDOKU_Q_SOL = gridSolutions(SUDOKU_Q, 2)[0];
const SQ_RIGHT: [number, number] = [0, 1];
const SQ_WRONG: [number, number][] = [[0, 2], [2, 0], [3, 3]];
const KEN: GridPuzzle = {
  n: 4, givens: empty4(),
  cages: [
    { sum: 4, cells: [[0, 0], [1, 0]] }, { sum: 5, cells: [[0, 1], [1, 1]] }, { sum: 5, cells: [[0, 2], [0, 3]] },
    { sum: 6, cells: [[1, 2], [2, 2], [3, 2]] }, { sum: 9, cells: [[1, 3], [2, 3], [3, 3]] }, { sum: 6, cells: [[2, 0], [2, 1]] }, { sum: 5, cells: [[3, 0], [3, 1]] },
  ],
};
const KEN_SOL = gridSolutions(KEN, 2)[0];
const rowsText = (g: number[][]) => g.map((r) => r.join(' ')).join(' / ');
const cellName = ([r, c]: [number, number]) => `row ${r + 1}, column ${c + 1}`;
const notesFor = (p: GridPuzzle) => {
  const out: Record<string, string> = {}, single: string[] = [];
  for (let r = 0; r < p.n; r++) for (let c = 0; c < p.n; c++) if (!p.givens[r][c]) {
    const cs = candidates(p, r, c);
    out[`${r},${c}`] = cs.join('');
    if (cs.length === 1) single.push(`${r},${c}`);
  }
  return { notes: out, single };
};
const READ_NOTES = notesFor(SUDOKU_READ);

function makeSudoku(rng: Rng): { p: GridPuzzle; sol: number[][] } {
  const sol = SUDOKU_ALL[Math.floor(rng() * SUDOKU_ALL.length)];
  const g = sol.map((r) => r.slice());
  for (const k of shuffle(rng, Array.from({ length: 16 }, (_, i) => i))) {
    const r = Math.floor(k / 4), c = k % 4, v = g[r][c];
    g[r][c] = 0;
    if (gridSolutions({ n: 4, box: [2, 2], givens: g }, 2).length !== 1) g[r][c] = v;
    if (g.flat().filter((x) => x).length <= 6 && rng() < 0.5) break;
  }
  return { p: { n: 4, box: [2, 2], givens: g }, sol };
}

const genSudokuCell: Generator = (rng) => {
  const { p, sol } = makeSudoku(rng);
  const blanks: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!p.givens[r][c]) blanks.push([r, c]);
  const singles = blanks.filter(([r, c]) => candidates(p, r, c).length === 1);
  const [r, c] = pick(rng, singles.length ? singles : blanks);
  const cs = candidates(p, r, c);
  return {
    kind: 'number', tol: 0,
    body: `Mini Sudoku: each row, column and 2 × 2 box holds 1 to 4 once. Rows (0 = blank): ${rowsText(p.givens)}. What goes in the orange cell, **${cellName([r, c])}**?`,
    widget: () => gridPic(p, { mark: [`${r},${c}`], size: 48 }),
    answer: sol[r][c],
    hint: cs.length === 1 ? 'List what its row, column and box already use.' : `Its row, column and box leave ${cs.join(' or ')}. Where else could those numbers go?`,
    explain: cs.length === 1
      ? `Its row, column and box already use every number except ${sol[r][c]}, so it must be ${sol[r][c]}.`
      : `Its own row, column and box allow ${cs.join(' or ')}; filling the forced cells first settles it as ${sol[r][c]}. The full solution: ${rowsText(sol)}.`,
  };
};

const KAKURO_CASES = (() => {
  const out: { k: number; s: number; must: number[]; sets: number[][] }[] = [];
  for (const k of [2, 3, 4]) for (let s = 3; s <= 30; s++) {
    const sets = digitSets(k, s);
    if (!sets.length) continue;
    const must = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => sets.every((x) => x.includes(d)));
    if (must.length && must.length < 9) out.push({ k, s, must, sets });
  }
  return out;
})();
const genKakuro: Generator = (rng) => {
  const { k, s, must, sets } = pick(rng, KAKURO_CASES);
  const used = new Set(sets.flat());
  return {
    kind: 'multi',
    body: `Kakuro: **${k}** cells must hold **different** digits from 1 to 9 adding up to **${s}**. Which digits **must** be among them? Select all.`,
    options: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => must.includes(d)
      ? { text: String(d), correct: true, why: `Every way to make ${s} uses ${d}.` }
      : { text: String(d), why: used.has(d) ? `${d} appears in some ways but not all: ${sets.find((x) => !x.includes(d))!.join(' + ')} = ${s} avoids it.` : `No way to make ${s} uses ${d}.` }),
    hint: 'List every set systematically, smallest digit first.',
    explain: `The ways: ${sets.map((x) => x.join(' + ')).join('; ')}. Common to all: ${must.join(', ')}.`,
  };
};

// ---------------------------------------------------------------- 6. invariants

const HT = (s: boolean[]) => s.map((b) => (b ? 'H' : 'T')).join(' ');
const FLIP_START = [true, false, false, true, false, true, true, false];
const FLIP_BAD = [true, false, true, true, false, true, false, true];
const SLIDE_START = [4, 1, 5, 3, 2, 0];
const SLIDE_SWAP = [2, 1, 3, 4, 5, 0];
const SLIDE_REACH = bfsAll(slideGoal(6), (s) => s.join(','), (s) => slideNext(2, 3, s));

/** Which single colours can all tokens become? (BFS over counts.) */
function chameleonEnds(a: number, b: number, c: number): number[] {
  const all = bfsAll<[number, number, number]>([a, b, c], (s) => s.join(','), (s) => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      if (!s[i] || !s[j]) continue;
      const t = s.slice() as [number, number, number];
      t[i]--; t[j]--; t[3 - i - j] += 2;
      out.push(t);
    }
    return out;
  });
  const n = a + b + c, ends: number[] = [];
  for (const { s } of all.values()) for (let i = 0; i < 3; i++) if (s[i] === n && !ends.includes(i)) ends.push(i);
  return ends;
}
const COLS = ['red', 'green', 'blue'];

const genFlip: Generator = (rng) => {
  const n = randInt(rng, 6, 10);
  let s: boolean[];
  do s = Array.from({ length: n }, () => rng() < 0.55); while (s.every((b) => b));
  const tails = s.filter((b) => !b).length, can = flipMin(s) >= 0;
  return {
    kind: 'choice',
    body: `A row of coins: **${HT(s)}**. A move flips two neighbouring coins. Can you make them all heads?`,
    options: [
      can ? { text: 'Yes', correct: true } : { text: 'Yes', why: `Each move changes the number of tails by −2, 0 or +2, so it stays odd. ${tails} tails can never become 0.` },
      can ? { text: 'No, never', why: `${tails} tails is even, and you can pair them off: flip a tail with its right-hand neighbour and walk it along until it meets the next tail.` } : { text: 'No, never', correct: true },
    ],
    hint: 'Count the tails. How does one move change that count?',
    explain: can ? `${tails} tails, an even number: it can be done (in ${flipMin(s)} moves at best). Walk each tail right, flipping it with its neighbour, until it cancels the next tail.`
      : `${tails} tails is odd, and every move keeps the parity of the tail count. All heads means 0 tails (even), so it’s impossible.`,
  };
};

const genChameleon: Generator = (rng) => {
  const c: [number, number, number] = [randInt(rng, 1, 10), randInt(rng, 1, 10), randInt(rng, 1, 10)];
  const ends = chameleonEnds(...c);
  const can = ends.length > 0;
  const d = [c[1] - c[0], c[2] - c[1], c[2] - c[0]];
  return {
    kind: 'choice',
    body: `Tokens: **${c[0]} red, ${c[1]} green, ${c[2]} blue**. A move turns two tokens of different colours into two of the third colour. Can all the tokens end up one colour?`,
    widget: () => tokenBars(c),
    options: [
      can ? { text: 'Yes', correct: true } : { text: 'Yes', why: 'Each move changes every difference between counts by 0 or ±3, so their remainders mod 3 never change. None is 0 here.' },
      can ? { text: 'No, never', why: `Two counts differ by a multiple of 3 (a difference of ${d.find((x) => x % 3 === 0)}), so the invariant doesn’t forbid it, and a search finds a way.` } : { text: 'No, never', correct: true },
    ],
    hint: 'Look at the differences between the counts, divided by 3.',
    explain: can ? `Yes: all ${ends.map((i) => COLS[i]).join(' or all ')}. The colours whose two counts differ by a multiple of 3 can both reach zero; a search over the counts confirms it.`
      : `Differences: ${d.map((x) => Math.abs(x)).join(', ')}. None is a multiple of 3, and the remainders mod 3 never change, but all one colour needs two counts equal (both 0). Impossible.`,
  };
};

const genSlide: Generator = (rng) => {
  const tiles = shuffle(rng, [1, 2, 3, 4, 5]);
  const s = [...tiles, 0];
  if (s.join(',') === slideGoal(6).join(',')) [s[0], s[1]] = [s[1], s[0]];
  const can = SLIDE_REACH.has(s.join(','));
  let inv = 0;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (tiles[i] > tiles[j]) inv++;
  return {
    kind: 'choice',
    body: `A 2 × 3 sliding puzzle reads **${s.slice(0, 3).join(' ')} / ${s.slice(3, 5).join(' ')} _** (gap bottom-right). Can sliding tiles make it **1 2 3 / 4 5 _**?`,
    widget: () => slidePic(3, s),
    options: [
      can ? { text: 'Yes', correct: true } : { text: 'Yes', why: `It has ${inv} out-of-order pairs, an odd number. With the gap back in its corner, only even arrangements are reachable.` },
      can ? { text: 'No, never', why: `It has ${inv} out-of-order pairs, an even number, and every even arrangement can be reached.` } : { text: 'No, never', correct: true },
    ],
    hint: 'Count pairs of tiles in the wrong order (reading left to right, top to bottom). Odd or even?',
    explain: `${inv} pairs are out of order (${inv % 2 ? 'odd' : 'even'}). The gap starts and ends in the same corner, so an even number of slides happen, and the arrangement’s parity can’t change. ${can ? 'Even: solvable.' : 'Odd: impossible.'}`,
  };
};

// ---------------------------------------------------------------- 7. backwards and symmetry

const CORNER_L = cornerLosing(9);
const genCorner: Generator = (rng) => {
  let x = 0, y = 0;
  while (x === y || Math.min(x, y) < 1) { x = randInt(rng, 1, 8); y = randInt(rng, 1, 8); }
  const m = Math.min(x, y);
  if (!CORNER_L[m][m]) throw new Error('corner theory broken');
  return {
    kind: 'point',
    body: `Corner race: the token (orange) is at column ${x}, row ${y}. Players alternate moving it any distance **left** or **down**; whoever reaches (0, 0) wins. It’s your move: place the square you should move to.`,
    plot: { x: [0, 8], y: [0, 8], grid: true, ticks: [1, 1], equal: true, size: [300, 300], xlabel: 'column', ylabel: 'row', layers: [{ type: 'line', pts: [[0, 0], [8, 8]], color: 'var(--line)', dash: true }, { type: 'dots', pts: [[x, y]], color: 'var(--c2)', r: 7 }, { type: 'text', x: 0.35, y: 0.35, text: '★' }] },
    answer: { x: m, y: m }, tol: 0.4, snap: 1,
    hint: 'Squares with column = row are losing for the player who must move from them.',
    explain: `Move to (${m}, ${m}), on the diagonal. Every move from the diagonal leaves it, and you can always step back onto it, so you make the last move.`,
  };
};

const genKnockout: Generator = (rng) => {
  const n = randInt(rng, 12, 600);
  const ctx = pick(rng, ['tennis', 'table-tennis', 'chess', 'arm-wrestling']);
  return {
    kind: 'number', tol: 0,
    body: `A ${ctx} knockout has **${n}** players. Each match has two players and the loser is out; some players get byes when the numbers are odd. How many matches are played to find the champion?`,
    answer: n - 1,
    hint: 'Forget the rounds. What does each match do to the number of players left?',
    explain: `Every match knocks out exactly one player, and all but the champion are knocked out: ${n} − 1 = ${n - 1} matches, whatever the byes.`,
  };
};

const NAMES3 = ['Ann', 'Ben', 'Cat'];
/** Loser of each round doubles the other two. Work back from equal end amounts. */
function doublingStart(end: number, losers: number[]): number[] {
  let s = [end, end, end];
  for (let r = losers.length - 1; r >= 0; r--) {
    const L = losers[r], t = s.slice();
    let paid = 0;
    for (let i = 0; i < 3; i++) if (i !== L) { t[i] = s[i] / 2; paid += s[i] / 2; }
    t[L] = s[L] + paid;
    s = t;
  }
  // Check forwards.
  let f = s.slice();
  for (const L of losers) { const t = f.slice(); for (let i = 0; i < 3; i++) if (i !== L) { t[L] -= f[i]; t[i] = 2 * f[i]; } f = t; }
  if (f.some((v) => v !== end)) throw new Error('doubling check failed');
  return s;
}
const genDoubling: Generator = (rng) => {
  const E = 8 * randInt(rng, 1, 8), losers = shuffle(rng, [0, 1, 2]), who = randInt(rng, 0, 2);
  const st = doublingStart(E, losers);
  return {
    kind: 'number', tol: 0,
    body: `Ann, Ben and Cat play three rounds. Each round the loser doubles the other two’s money from their own pocket. ${NAMES3[losers[0]]} loses round 1, ${NAMES3[losers[1]]} round 2, ${NAMES3[losers[2]]} round 3, and they finish with **$${E} each**. How much did **${NAMES3[who]}** start with?`,
    answer: st[who], unit: '$',
    hint: 'Undo round 3 first: the two who were doubled had half as much before it.',
    explain: `Backwards from $${E} each: halve the two who were doubled and give the loser what they paid, round 3, then 2, then 1. Start: Ann $${st[0]}, Ben $${st[1]}, Cat $${st[2]}. So ${NAMES3[who]} had $${st[who]}.`,
  };
};

// Ring of coins: take 1 or 2 touching coins; last coin wins. Exhaustive game search confirms the second player wins.
function ringFirstWins(n: number): boolean {
  const memo = new Map<number, boolean>();
  const win = (m: number): boolean => {
    if (m === 0) return false;
    if (memo.has(m)) return memo.get(m)!;
    let w = false;
    for (let i = 0; i < n && !w; i++) {
      if (!((m >> i) & 1)) continue;
      if (!win(m & ~(1 << i))) w = true;
      const j = (i + 1) % n;
      if (!w && (m >> j) & 1 && j !== i && !win(m & ~(1 << i) & ~(1 << j))) w = true;
    }
    memo.set(m, w);
    return w;
  };
  return win((1 << n) - 1);
}
const RING_N = 11;
const RING_FIRST = ringFirstWins(RING_N);

// ---------------------------------------------------------------- 8. getting unstuck

const MAGIC_TRIPLES = (() => { let c = 0; for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 9; b++) for (let d = b + 1; d <= 9; d++) if (a + b + d === 15) c++; return c; })();
const LIGHTS_START = [0, 2, 4, 7].reduce((s, i) => lightsPress(s, i), Array(9).fill(false) as boolean[]);
const LIGHTS_SOL = lightsSolve(LIGHTS_START);
const SPOT = ['top-left', 'top', 'top-right', 'left', 'centre', 'right', 'bottom-left', 'bottom', 'bottom-right'];

function lockersOpen(N: number): number {
  const st = Array(N + 1).fill(false);
  for (let p = 1; p <= N; p++) for (let k = p; k <= N; k += p) st[k] = !st[k];
  return st.filter(Boolean).length;
}

const genHeads: Generator = (rng) => {
  const [a, b, la, lb, what] = pick(rng, [
    ['chickens', 'goats', 2, 4, ['heads', 'legs']], ['bicycles', 'tricycles', 2, 3, ['riders (one each)', 'wheels']],
    ['stools', 'chairs', 3, 4, ['seats', 'legs']], ['spiders', 'beetles', 8, 6, ['bugs', 'legs']],
  ] as const);
  const H = randInt(rng, 12, 60), nb = randInt(rng, 2, H - 2), na = H - nb;
  const T = la * na + lb * nb;
  const askB = rng() < 0.5;
  return {
    kind: 'number', tol: 0,
    body: `A room has ${a} and ${b}: **${H}** ${what[0]} and **${T}** ${what[1]} in all. (Each of the ${a} has ${la} ${what[1]}, each of the ${b} has ${lb}.) How many **${askB ? b : a}**?`,
    answer: askB ? nb : na,
    hint: `Guess systematically: if all ${H} were ${a}, there would be ${la * H} ${what[1]}. Each swap changes that by ${Math.abs(lb - la)}.`,
    explain: `All ${a}: ${la * H} ${what[1]}. The difference ${Math.abs(T - la * H)} ÷ ${Math.abs(lb - la)} = ${nb} ${b}, so ${na} ${a}. Check: ${la} × ${na} + ${lb} × ${nb} = ${T}.`,
  };
};

const genLockers: Generator = (rng) => {
  const N = randInt(rng, 20, 600), ans = lockersOpen(N);
  return {
    kind: 'number', tol: 0,
    body: `**${N}** lockers start closed. Person 1 toggles every locker, person 2 every 2nd locker, person 3 every 3rd, … up to person ${N}. How many lockers end **open**?`,
    answer: ans,
    hint: 'Locker n is toggled once per divisor of n. Which numbers have an odd number of divisors?',
    explain: `Only perfect squares have an odd number of divisors (the square root pairs with itself), so the open lockers are 1, 4, 9, …, ${ans * ans}: ${ans} of them.`,
  };
};

const genLights: Generator = (rng) => {
  const presses = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, randInt(rng, 2, 5));
  const start = presses.reduce((s, i) => lightsPress(s, i), Array(9).fill(false) as boolean[]);
  const sol = lightsSolve(start);
  const rows = [0, 1, 2].map((r) => start.slice(r * 3, r * 3 + 3).map((b) => (b ? '●' : '○')).join('')).join(' / ');
  return {
    kind: 'task',
    body: `Lights Out: switch every light off. A press toggles a light and its up, down, left and right neighbours. Lit pattern: **${rows}**.`,
    widget: lightsTask(start),
    hint: 'Order doesn’t matter, and pressing twice undoes itself. Try to clear the top row, then let the row below fix what’s left.',
    explain: `Press ${sol.map((i) => SPOT[i]).join(', ')} (${sol.length} presses, in any order). Every pattern has exactly one such set.`,
  };
};

// ---------------------------------------------------------------- course

export const puzzles: Course = {
  id: 'puzzles',
  title: 'Puzzle Solving',
  blurb: 'Strategies that crack puzzles you’ve never seen: small cases, state spaces, invariants, working backwards.',
  color: COLOR,
  icon: '🪢',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'understand',
      title: 'Understand the problem',
      goal: 'Read a puzzle slowly: the unknown, the data, the noise, and a picture.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: 'A straight fence is **30 m** long. There is a post every **5 m**, including one at each end. How many posts?',
          widget: () => fencePic(1, '30 m', false),
          answer: 7,
          hint: 'Try a tiny version first: a 10 m fence with a post every 5 m. Draw it.',
          explain: '30 ÷ 5 = 6 gaps between posts. A row of 6 gaps has 7 posts: one at the start, plus one at the end of each gap.',
        },
        {
          kind: 'read',
          title: 'Draw it',
          body: 'Dividing 30 by 5 gives **6**, the number of *gaps*. Posts sit at both ends of every gap, so there is one more post than gaps: **7**.\n\nThis slip is common enough to have a name, the **fencepost error**. The cure: draw the problem, or shrink it until you can count on your fingers.',
          widget: () => fencePic(6, '5 m'),
        },
        {
          kind: 'choice',
          body: 'A clock chimes 4 times at 4 o’clock. The first chime is at 0 seconds and the last at 6 seconds, evenly spaced. How long from first to last chime at **8 o’clock**?',
          widget: () => plotEl({ x: [-0.5, 16], ticks: [2], layers: [{ type: 'dots', pts: [[0, 0], [2, 0], [4, 0], [6, 0]], color: 'var(--c2)', r: 6 }], xlabel: 'seconds' }),
          options: [
            { text: '14 s', correct: true },
            { text: '12 s', why: 'That doubles 6 s because 8 is twice 4, as if the time were in the chimes. It’s in the gaps: 3 gaps then, 7 gaps now.' },
            { text: '16 s', why: 'That’s 2 s per chime × 8 chimes, but 8 chimes have only 7 gaps between them.' },
          ],
          hint: 'Count the gaps between chimes.',
          explain: '4 chimes have 3 gaps, so each gap is 2 s. 8 chimes have 7 gaps: 7 × 2 = 14 seconds.',
        },
        {
          kind: 'read',
          title: 'What is the question?',
          body: 'Most wrong answers to puzzles are right answers to a *different* question. Before solving, sort what you read:\n\n- **The unknown**: what exactly must you find?\n- **The data**: what are you told?\n- **The conditions**: how are they linked?\n- **The noise**: what is there only to distract?\n\nThen say the problem back in your own words.',
        },
        {
          kind: 'sort',
          body: 'Pens cost $2 and notebooks cost $5. Maya, who is 12, goes to the shop on a Tuesday and buys **7 items** for **$26** in total. How many notebooks did she buy?\n\nSort each piece of the problem.',
          bins: ['Data you need', 'Noise', 'The unknown'],
          items: [
            { text: 'Pens cost $2', bin: 0 }, { text: 'Notebooks cost $5', bin: 0 }, { text: 'She buys 7 items', bin: 0 }, { text: 'She pays $26', bin: 0 },
            { text: 'Maya is 12', bin: 1 }, { text: 'It is a Tuesday', bin: 1 }, { text: 'How many notebooks?', bin: 2 },
          ],
          explain: 'Her age and the day change nothing. The two prices, the 7 items and the $26 are the data; the number of notebooks is the unknown.',
        },
        {
          kind: 'number', tol: 0,
          body: 'Now solve it: how many **notebooks** did Maya buy?',
          answer: 4,
          hint: 'If all 7 items were pens she’d pay $14. Each pen swapped for a notebook adds $3.',
          explain: 'All pens: 7 × $2 = $14. She paid $12 more, and each notebook in place of a pen adds $3: 4 notebooks and 3 pens. Check: 4 × $5 + 3 × $2 = $26.',
        },
        {
          kind: 'multi',
          body: 'Puzzle: “Two whole numbers add up to 20. Make their product as large as possible.” Which restatements say **the same thing**? Select all.',
          options: [
            { text: 'Split 20 into two whole-number parts with the biggest possible product', correct: true, why: 'Same data (sum 20), same goal (largest product).' },
            { text: 'Of all whole-number pairs that sum to 20, find the one that multiplies to the most', correct: true, why: 'Same data and goal in different words.' },
            { text: 'Find two whole numbers that multiply to 20', why: 'This swaps data and goal: 20 was the sum, and the product is what you make large.' },
            { text: 'Find two whole numbers with sum 20 and the largest possible sum', why: 'The sum is fixed at 20; it’s the product that varies.' },
            { text: 'Find the largest whole number below 20', why: 'This drops the pair and the product entirely.' },
          ],
          explain: 'A faithful restatement keeps the data (the sum is 20) and the goal (the largest product). The answer, by the way: 10 × 10 = 100.',
        },
        {
          kind: 'number', tol: 0,
          body: 'A sign painter paints the room numbers **1 to 60**. How many times does she paint the digit **5**?',
          widget: () => numberGrid(60),
          answer: 16,
          hint: 'Count 5s in the units place and in the tens place separately. Does 55 count once or twice?',
          explain: `Units place: 5, 15, 25, 35, 45, 55 (6). Tens place: 50 to 59 (10). Total ${countDigit(60, 5)}. The number 55 needs two 5s, which is what skimmers miss.`,
        },
        {
          kind: 'order',
          body: 'Five friends sit in seats 1 to 5, left to right.\n\n- Eli sits in the middle seat.\n- Ana is not in an end seat.\n- Ben sits immediately to the right of Ana.\n- Cy sits in an end seat.\n- Dee sits next to Cy.\n\nPut them in order from seat 1 to seat 5.',
          widget: () => seatsPic([null, null, null, null, null]),
          items: SEAT_ORDER,
          hint: 'Place Eli first. Then where can Ana and Ben sit side by side?',
          explain: 'Eli is in seat 3. Ana isn’t at an end, so she’s in seat 2 or 4, with Ben right after her; seat 3 is taken, so Ana 4, Ben 5. Cy takes the free end, seat 1, and Dee sits beside him in seat 2: Cy, Dee, Eli, Ana, Ben.',
        },
        {
          kind: 'fill',
          body: 'The mathematician George Pólya split problem solving into four phases. Fill them in.',
          template: '1. [[0]] the problem. 2. Devise a [[1]]. 3. Carry it out. 4. [[2]] back and check.',
          blanks: [
            { options: ['Understand', 'Solve', 'Skip'], answer: 0 },
            { options: ['plan', 'guess', 'formula'], answer: 0 },
            { options: ['Look', 'Hurry', 'Never look'], answer: 0 },
          ],
          explain: 'Understand, plan, carry out, look back. The rest of this course is about the plan: a toolbox of strategies for when nothing obvious works.',
        },
        {
          kind: 'read',
          title: 'Understand first',
          body: '- Name the unknown, the data and the conditions.\n- Strip out the noise.\n- Draw it, or try a tiny version.\n- Watch for off-by-one traps: posts vs gaps, chimes vs intervals, 55 vs one 5.',
          widget: () => fencePic(3, 'gap'),
        },
      ],
      practice: [genFence, genChime, genDigits],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'small-cases',
      title: 'Try small cases',
      goal: 'Solve n = 1, 2, 3 first, spot the pattern, and check why it holds.',
      steps: [
        {
          kind: 'task',
          title: 'Five friends',
          body: 'Five friends meet and every pair shakes hands once. Draw every handshake: tap one person, then another.',
          widget: handshakeTask(['A', 'B', 'C', 'D', 'E']),
          hint: 'You’re done when everyone shows 4 hands.',
          explain: '10 handshakes: AB, AC, AD, AE, BC, BD, BE, CD, CE, DE. Each of the 5 shakes 4 hands, and 5 × 4 = 20 counts every handshake twice.',
        },
        {
          kind: 'read',
          title: 'Line up the small cases',
          body: 'Each newcomer shakes hands with everyone already there, so person n adds **n − 1** handshakes. The totals grow 0, 1, 3, 6, 10, …',
          widget: () => dataTable(['People', 'Handshakes', 'Added by the newcomer'], [1, 2, 3, 4, 5].map((n) => [n, (n * (n - 1)) / 2, n === 1 ? '–' : n - 1]), { highlight: [4] }),
        },
        {
          kind: 'point',
          body: 'Plotted: handshakes among 2, 3, 4 and 5 people. Place the point for **6 people**.',
          plot: { x: [0, 8], y: [0, 30], xlabel: 'people', ylabel: 'handshakes', ticks: [1, 5], grid: true, layers: [{ type: 'dots', pts: [[2, 1], [3, 3], [4, 6], [5, 10]], color: 'var(--c1)' }] },
          answer: { x: 6, y: 15 }, tol: 0.5, snap: 1,
          hint: 'The 6th person shakes hands with the 5 already there.',
          explain: '10 + 5 = 15, so the point is (6, 15).',
        },
        {
          kind: 'number', tol: 0,
          body: '**12** people at a party each shake hands with every other person once. How many handshakes?',
          answer: 66,
          hint: 'Each of the 12 shakes 11 hands. How many times is each handshake counted that way?',
          explain: 'Each of the 12 shakes 11 hands: 12 × 11 = 132, but that counts every handshake twice (once from each side). 132 ÷ 2 = 66.',
        },
        {
          kind: 'fill',
          body: 'Turn the pattern into a rule for **n** people.',
          template: 'Each person shakes [[0]] hands. Adding those up counts each handshake [[1]], so the total is [[2]].',
          blanks: [
            { options: ['n − 1', 'n', 'n + 1'], answer: 0 },
            { options: ['twice', 'once', 'n times'], answer: 0 },
            { options: ['n(n − 1) ÷ 2', 'n(n − 1)', 'n²'], answer: 0 },
          ],
          explain: 'n people × (n − 1) hands each counts every handshake from both ends, so divide by 2: n(n − 1) ÷ 2.',
        },
        {
          kind: 'read',
          title: 'Cutting a pizza',
          body: 'New problem. Slice a round pizza with straight cuts (pieces needn’t be equal). What is the **largest** number of pieces n cuts can make? Small cases first:',
          widget: () => h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap' },
            CUTS.map((c) => pizzaPic(c, `${plural(c.length, 'cut')}: ${chordRegions(c).regions} pieces`, 110))),
        },
        {
          kind: 'number', tol: 0,
          body: 'What is the largest number of pieces from **4** straight cuts?',
          answer: 1 + (4 * 5) / 2,
          hint: 'The 4th cut can cross each of the 3 earlier cuts. How many pieces does it pass through?',
          explain: 'A cut that crosses k earlier cuts passes through k + 1 pieces and splits each one, adding k + 1. The 4th cut crosses 3, so it adds 4: 7 + 4 = 11.',
        },
        {
          kind: 'estimate',
          body: 'Roughly how many pieces can **10** cuts make at most?',
          min: 0, max: 120, step: 1, answer: 1 + (10 * 11) / 2, tol: 4,
          explain: '2, 4, 7, 11, 16, 22, 29, 37, 46, 56: the k-th cut adds k. Total = 1 + (1 + 2 + … + 10) = 1 + 55 = 56.',
        },
        {
          kind: 'read',
          title: 'A pattern that lies',
          body: `Put points on a circle and join every pair. Count the regions inside: 1, 2, 4, 8, 16 for 1 to 5 points. Doubling, surely? With **6** points there are **${circleRegions(CIRCLE_PTS[5])}**. (Points spaced so no three lines meet at one spot.)`,
          widget: () => h('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap' },
            CIRCLE_PTS.map((a) => circlePointsPic(a, `${a.length} pt${a.length > 1 ? 's' : ''}: ${circleRegions(a)}`, 96))),
        },
        {
          kind: 'choice',
          body: 'Six points give 31 regions, not the 32 the pattern promised. What’s the lesson?',
          options: [
            { text: 'A pattern from small cases is a guess until you see why it holds', correct: true },
            { text: 'Small cases are useless', why: 'They found the handshake and pizza rules. They suggest; an argument confirms.' },
            { text: 'Someone miscounted: it must be 32', why: 'A careful count (and the formula 1 + C(n, 2) + C(n, 4)) gives 31.' },
            { text: 'Patterns only fail for even n', why: 'Nothing special about even n: the formula just isn’t a power of 2.' },
          ],
          explain: 'Small cases suggest a rule; you still need a reason. For handshakes the reason was “each pair is counted twice”. The circle regions follow 1 + C(n, 2) + C(n, 4), which matches doubling only up to n = 5.',
        },
        {
          kind: 'match',
          body: 'Work out the first few cases of each puzzle, then match it to its sequence (n = 1, 2, 3, 4, 5).',
          heads: ['Puzzle', 'Small cases'],
          pairs: [
            ['Handshakes among n people', '0, 1, 3, 6, 10'],
            ['Most pizza pieces from n cuts', '2, 4, 7, 11, 16'],
            ['Ways up n stairs taking 1 or 2 at a time', '1, 2, 3, 5, 8'],
            ['Squares of all sizes on an n × n grid', '1, 5, 14, 30, 55'],
          ],
          hint: 'Pizza starts at 2 (one cut, two pieces). For the stairs, list the ways for 3 steps: 1+1+1, 1+2, 2+1.',
          explain: 'Handshakes add n − 1, pizza adds n, stairs add the two previous counts (your last move is a 1 or a 2), and grid squares add n² (1 + 4 + 9 + …).',
        },
        {
          kind: 'number', tol: 0,
          body: 'You climb a **10**-step staircase taking 1 or 2 steps at a time. How many different ways are there?',
          answer: 89,
          hint: 'Small cases: 1 step: 1 way, 2 steps: 2, 3 steps: 3, 4 steps: 5. Your last move is 1 step or 2.',
          explain: 'Ways(n) = Ways(n − 1) + Ways(n − 2), since the last move is a 1 or a 2: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89.',
        },
      ],
      practice: [genHandshake, genPizza, genSquares],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'weighing',
      title: 'Weighing & information',
      goal: 'Find the odd coin in few weighings, and count outcomes to know the limit.',
      steps: [
        {
          kind: 'choice',
          body: 'Three coins look the same, but one is a fake that is slightly **heavier**. You may use a balance scale **once**. Can you always find the fake?',
          widget: () => balancePic(['1'], ['2'], 0, { caption: 'coin 3 stays off' }),
          options: [
            { text: 'Yes: weigh coin 1 against coin 2', correct: true, why: 'If a pan drops, it holds the fake; if they balance, it’s coin 3.' },
            { text: 'No: it takes two weighings', why: 'The coin left off still gets tested: if the pans balance, it must be the fake.' },
            { text: 'Only with luck', why: 'Every outcome names the fake, so no luck is needed.' },
          ],
          explain: 'Weigh 1 against 2. Left down: coin 1. Right down: coin 2. Level: coin 3.',
        },
        {
          kind: 'read',
          title: 'Three outcomes',
          body: 'A balance answers with one of **three** outcomes: left down, right down, or level. A coin left *off* the scale is still tested, because “level” points at it.',
          widget: threeOutcomes,
        },
        {
          kind: 'task',
          title: 'Nine coins, two weighings',
          body: '**9** coins, one heavier fake, only **2** weighings. This fake is cunning: it hides wherever your weighings leave the most doubt, so luck won’t help. Weigh, then tap **Name the fake** and tap the coin you can prove is fake.',
          widget: balanceTask({ n: 9, weighings: 2 }),
          hint: 'Split the coins into three equal groups.',
          explain: 'Weigh 1, 2, 3 against 4, 5, 6. Whatever happens, three suspects remain: the group on the lower pan, or 7, 8, 9 if level. Then weigh two of the suspects against each other: the lower one is fake, or the third if they balance.',
        },
        {
          kind: 'read',
          title: 'Split in three',
          body: 'Each weighing splits the suspects into three groups: left pan, right pan, off the scale. Whatever the result, exactly one group stays suspect. So make the groups **as equal as possible**. One weighing settles 3 coins, two settle 9, and **k** weighings settle **3ᵏ**.',
          widget: () => coinGroups([
            { label: 'Left pan', coins: ['1', '2', '3'], color: 'var(--c1)', note: 'if left drops' },
            { label: 'Right pan', coins: ['4', '5', '6'], color: 'var(--c2)', note: 'if right drops' },
            { label: 'Off', coins: ['7', '8', '9'], color: 'var(--c3)', note: 'if level' },
          ]),
        },
        {
          kind: 'number', tol: 0,
          body: 'What is the largest number of coins (one heavier fake) that **3** weighings can always handle?',
          answer: 27,
          hint: 'Each weighing can cut the suspects to a third.',
          explain: '3 × 3 × 3 = 27: weigh 9 against 9 (leaving 9 suspects), then 3 against 3, then 1 against 1. With 28 coins some outcome leaves at least 10 suspects after the first weighing, too many for two more.',
        },
        {
          kind: 'choice',
          body: '**8** coins, one heavier fake, **2** weighings. What should the first weighing be?',
          options: [
            { text: '3 coins against 3', correct: true, why: 'Left down, right down: 3 suspects. Level: the 2 left off. One weighing settles 3 or fewer.' },
            { text: '4 coins against 4', why: 'One pan must drop, leaving 4 suspects, and one weighing can settle only 3.' },
            { text: '2 coins against 2', why: 'If they balance, 4 coins are left off and still suspect: too many for one weighing.' },
            { text: '1 coin against 1', why: 'If they balance, 6 suspects remain for a single weighing.' },
          ],
          hint: 'After the first weighing, no outcome may leave more than 3 suspects.',
          explain: '3 against 3 leaves at most 3 suspects whatever happens (3, 3, or the 2 left off), and one more weighing settles 3. Every other split leaves 4 or more in some outcome.',
        },
        {
          kind: 'task',
          title: 'Eight coins, one light',
          body: 'Now **8** coins with one **lighter** fake, and **2** weighings. Same cunning fake. Prove which coin it is.',
          widget: balanceTask({ n: 8, weighings: 2, light: true }),
          hint: 'Three against three, two off.',
          explain: 'Weigh 1, 2, 3 against 4, 5, 6. If a pan rises, the fake is among its three: weigh two of them, and the higher one is fake (or the third if level). If level, weigh 7 against 8: the higher one is fake.',
        },
        {
          kind: 'estimate',
          body: 'Roughly how many coins (one heavier fake) can **6** weighings handle?',
          min: 0, max: 1500, step: 1, answer: 729, tol: 40,
          explain: '3⁶ = 729. Each weighing triples the reach: 3, 9, 27, 81, 243, 729.',
        },
        {
          kind: 'read',
          title: 'Count the answers',
          body: 'Harder version: **12** coins, one fake that may be heavier *or* lighter, and you must say which. That’s 24 possible answers (coin 1 heavy, coin 1 light, …). Two weighings give only 3 × 3 = 9 outcome patterns. 9 < 24, so **no** two-weighing method can work, however clever. Three give 27 ≥ 24, so three might (and a famous method does).\n\nCounting answers against outcomes gives a **lower bound** before you have any method.',
        },
        {
          kind: 'number', tol: 0,
          body: '**6** coins; one is fake, but you don’t know if it’s heavier or lighter. You must find it **and** say which. By counting alone, at least how many weighings are needed?',
          answer: 3,
          hint: 'How many possible answers are there? How many outcome patterns do 2 weighings give?',
          explain: '6 coins × 2 (heavy or light) = 12 possible answers. Two weighings give only 3² = 9 patterns, too few to tell 12 answers apart, so at least 3 (giving 27 patterns).',
        },
        {
          kind: 'read',
          title: 'Yes/no questions',
          body: 'A yes/no question has 2 outcomes, so k questions tell apart at most **2ᵏ** possibilities. The best question splits what’s left in half; a balance can split in three.',
          widget: () => dataTable(['k', '2ᵏ (yes/no)', '3ᵏ (balance)'], [1, 2, 3, 4, 5, 6, 7].map((k) => [k, 2 ** k, 3 ** k])),
        },
        {
          kind: 'number', tol: 0,
          body: 'I pick a whole number from **1 to 100**. You ask yes/no questions. How many questions **guarantee** you can name it?',
          answer: 7,
          hint: 'Find the smallest k with 2ᵏ ≥ 100.',
          explain: '2⁶ = 64 < 100 ≤ 128 = 2⁷. Halving each time: 100 → 50 → 25 → 13 → 7 → 4 → 2 → 1, which is 7 questions. Six can’t tell 100 cases apart.',
        },
        {
          kind: 'match',
          body: 'Match each set of tests to the most possibilities it can tell apart.',
          heads: ['Tests', 'Possibilities'],
          pairs: [['3 balance weighings', '27'], ['5 yes/no questions', '32'], ['4 yes/no questions', '16'], ['2 balance weighings', '9']],
          explain: 'Multiply the outcomes per test: 3 × 3 × 3 = 27, 2⁵ = 32, 2⁴ = 16, 3² = 9.',
        },
        {
          kind: 'choice',
          body: 'Ten bags of coins; one bag holds only fakes weighing **11 g**, while real coins weigh **10 g**. You may use a digital scale **once**. Take 1 coin from bag 1, 2 from bag 2, …, 10 from bag 10, and weigh all 55 together: **557 g**. Which bag is fake?',
          options: [{ text: 'Bag 7', correct: true }, ...[3, 5, 10].map((b) => ({ text: `Bag ${b}`, why: `Bag ${b} would add ${b} g: a total of ${550 + b} g.` }))],
          hint: 'What would the 55 coins weigh if all were real?',
          explain: '55 real coins would weigh 550 g. Each fake adds 1 g, and the extra 7 g means 7 fakes: they came from bag 7. Taking a different number from each bag gives every bag its own signature.',
        },
      ],
      practice: [genWeigh, genBags, genQuestions],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'state-spaces',
      title: 'River crossings & state spaces',
      goal: 'Draw a puzzle’s states as a graph and search it breadth-first for the shortest solution.',
      steps: [
        {
          kind: 'task',
          title: 'Cross the river',
          body: 'A ranger must get a cat, a parrot and a bag of seeds across a river. The raft holds the ranger and **one** passenger. Left alone together, the cat eats the parrot, and the parrot eats the seeds. Get everyone across.',
          widget: raftTask(RAFT1),
          hint: 'The parrot clashes with both others. It may need a ride back.',
          explain: `${R1_PATH.length - 1} crossings: ${raftRoute(RAFT1, R1_PATH)}. (Taking the seeds before the cat works too.)`,
        },
        {
          kind: 'number', tol: 0,
          body: 'A **state** records which bank each of the ranger, cat, parrot and seeds is on. How many states are there in all, safe or not?',
          answer: 16,
          hint: 'Four independent choices of bank.',
          explain: 'Each of the four is on one of two banks: 2 × 2 × 2 × 2 = 16.',
        },
        {
          kind: 'read',
          title: 'Draw the states',
          body: `Write a state as near bank | far bank: **RCPS | ·** is the start (R = ranger). A crossing links two states. Only ${R1_SAFE_COUNT} of the 16 states are safe, and they form this graph, laid out by crossings from the start. The highlighted path is a shortest solution.`,
          widget: () => layeredGraph(R1_LAYERS, R1_EDGES, { hi: R1_PATH.map(raftKey), rowLabel: (d) => String(d) }),
        },
        {
          kind: 'read',
          title: 'Breadth-first search',
          body: 'You can find a shortest route by hand. List the start (distance 0). Then every state one crossing away (distance 1). Then every **new** state one crossing from those (distance 2), and so on. The first time the goal appears, its distance is the fewest crossings. Step through it:',
          widget: () => stepper(R1_LAYERS.length, (i) => layeredGraph(R1_LAYERS, R1_EDGES, { upTo: i, rowLabel: (d) => String(d) }),
            { caption: (i) => i === 0 ? 'Distance 0: the start.' : i === R1_LAYERS.length - 1 ? `Distance ${i}: the goal appears. Fewest crossings: ${i}.` : `Distance ${i}: ${plural(R1_LAYERS[i].length, 'new state')}.` }),
        },
        {
          kind: 'order',
          body: 'These five states lie on a shortest solution (near bank | far bank; R = ranger, C = cat, P = parrot, S = seeds). Put them in order from start to finish.',
          items: [0, 1, 3, 5, 7].map((i) => raftLabel(RAFT1, R1_PATH[i])),
          hint: 'Each state is one more crossing from the start than the one before it.',
          explain: `Along the route: ${R1_PATH.map((s) => raftLabel(RAFT1, s)).join(' → ')}. The five given are the states after 0, 1, 3, 5 and 7 crossings.`,
        },
        {
          kind: 'sort',
          body: 'Sort these states of the cat–parrot–seeds puzzle (near bank | far bank).',
          bins: ['Safe', 'Something gets eaten'],
          items: [
            { far: 0b000, k: 1 }, { far: 0b010, k: 1 }, { far: 0b101, k: 1 }, { far: 0b011, k: 0 }, { far: 0b100, k: 0 }, { far: 0b110, k: 1 },
          ].map((s) => ({ text: raftWords(RAFT1, s), bin: raftSafe(RAFT1, s) ? 0 : 1 })),
          hint: 'Look only at the bank without the ranger.',
          explain: 'A state is unsafe when the bank without the ranger holds the cat and parrot, or the parrot and seeds. The cat and seeds alone are fine.',
        },
        {
          kind: 'task',
          title: 'A bigger raft',
          body: 'Next trip: seeds, parrot, cat, dog and ham. The raft now takes the ranger and **two** passengers. Left alone, the parrot eats the seeds, the cat eats the parrot, the dog chases the cat, and the dog eats the ham.',
          widget: raftTask(RAFT2),
          hint: 'The clashes form a chain: seeds – parrot – cat – dog – ham. Which pair can safely ride first?',
          explain: `${R2_PATH.length - 1} crossings: ${raftRoute(RAFT2, R2_PATH)}.`,
        },
        {
          kind: 'choice',
          body: 'Same five, but suppose the raft took only **one** passenger. What then?',
          options: [
            { text: 'It can’t be done', correct: true },
            { text: 'It takes more crossings, but it works', why: 'More crossings don’t help if there is no safe first move.' },
            { text: 'The same number of crossings', why: 'With one seat there isn’t even a safe first move.' },
          ],
          hint: 'Try every first move. What is left behind?',
          explain: 'Remove any one from the chain seeds – parrot – cat – dog – ham and two neighbours stay behind together (and going alone leaves all five). There is no safe first move, so no solution; a search of the states agrees.',
        },
        {
          kind: 'read',
          title: 'Any puzzle with moves is a graph',
          body: 'A state needs only what matters for the future. Two jugs of 4 and 9 litres, a tap and a drain: the state is just **(litres in A, litres in B)**. Six moves link the states: fill A, fill B, empty A, empty B, pour A into B, pour B into A (pouring stops when one jug is empty or the other full).',
        },
        {
          kind: 'task',
          title: 'Measure 6 litres',
          body: `Get exactly **${JUG.t} litres** into one of the jugs.`,
          widget: jugTask(JUG),
          hint: 'Fill the 9-litre jug and pour it into the 4-litre jug, emptying the small one whenever it fills. Watch what’s left in the big one.',
          explain: `${JUG_PATH.length - 1} steps, with states written (A, B): ${jugRoute(JUG.a, JUG.b, JUG_PATH)}.`,
        },
        {
          kind: 'match',
          body: `Breadth-first from (0, 0) with the ${JUG.a} and ${JUG.b} litre jugs: match each state (A, B) to the fewest steps that reach it.`,
          heads: ['State', 'Fewest steps'],
          pairs: JUG_MATCH.map((s, i) => [`A = ${s[0]}, B = ${s[1]}`, plural(i + 1, 'step')] as [string, string]),
          hint: 'From (0, 0) you can only fill. From a full jug you can pour.',
          explain: `Distance 1: fill a jug, e.g. (${JUG_MATCH[0].join(', ')}). Each further state takes one more move from a state at the level before: (${JUG_MATCH[1].join(', ')}) at 2, (${JUG_MATCH[2].join(', ')}) at 3, (${JUG_MATCH[3].join(', ')}) at 4.`,
        },
        {
          kind: 'choice',
          body: 'Why does breadth-first search always find a **shortest** solution?',
          options: [
            { text: 'It reaches every state at distance 1 before any at distance 2, and so on', correct: true },
            { text: 'It always tries the most promising move first', why: 'That’s a greedy search, and it can be lured down long routes.' },
            { text: 'It follows one route as deep as it goes, then backs up', why: 'That’s depth-first search: it finds a route, not necessarily the shortest.' },
            { text: 'It tries random moves until it finds the goal', why: 'Random wandering may find the goal, with no guarantee of a short route.' },
          ],
          explain: 'Layer by layer, distance d is finished before distance d + 1 begins, so the first time the goal turns up, no shorter route exists.',
        },
        {
          kind: 'number', tol: 0,
          body: 'Three knights and three trolls must cross. The boat holds **two** and needs a rower. On either bank, trolls must never outnumber knights, unless no knights are there. Fewest crossings?',
          answer: knightsMin(3, 2),
          hint: 'A state is (knights, trolls) on the start bank plus the boat’s side. Search outward.',
          explain: `${knightsMin(3, 2)} crossings: 2 trolls over, 1 back; 2 trolls over, 1 back; 2 knights over, a knight and a troll back; 2 knights over, 1 troll back; 2 trolls over, 1 back; 2 trolls over. A breadth-first search shows nothing shorter exists.`,
        },
      ],
      practice: [genJug, genKnights, genStates],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'grids',
      title: 'Constraint grids',
      goal: 'Solve logic grids by finding forced cells, and know why a good puzzle has one answer.',
      steps: [
        {
          kind: 'task',
          title: 'Mini Sudoku',
          body: 'Fill the grid with 1 to 4 so that every row, every column and every 2 × 2 box holds each number once. Tap a cell, then a number.',
          widget: gridTask(SUDOKU1),
          hint: 'Look for a cell whose row, column and box already rule out three numbers.',
          explain: `Rows: ${rowsText(SUDOKU1_SOL)}.`,
        },
        {
          kind: 'read',
          title: 'Start where it’s tightest',
          body: 'Don’t guess. For each empty cell, list what its row, column and box still allow (small numbers below). A cell with **one** candidate is forced. Fill it, update its neighbours’ lists, repeat. Here the orange cells are forced already.',
          widget: () => gridPic(SUDOKU_READ, { notes: READ_NOTES.notes, mark: READ_NOTES.single, size: 52 }),
        },
        {
          kind: 'choice',
          body: 'In this grid, which empty cell can be filled **right now**, with no guessing?',
          widget: () => gridPic(SUDOKU_Q, { size: 52 }),
          options: [
            { text: cellName(SQ_RIGHT), correct: true, why: `Its row, column and box leave only ${candidates(SUDOKU_Q, ...SQ_RIGHT).join('')}.` },
            ...SQ_WRONG.map((c) => ({ text: cellName(c), why: `It could still be ${candidates(SUDOKU_Q, ...c).join(' or ')}.` })),
          ],
          hint: 'For each option, cross out what its row, column and 2 × 2 box already contain.',
          explain: `${cellName(SQ_RIGHT)}: its row has 3 and 2, its column has 1, its box has 3 and 1. Only ${candidates(SUDOKU_Q, ...SQ_RIGHT)[0]} is left.`,
        },
        {
          kind: 'number', tol: 0,
          body: `What number goes in ${cellName(SQ_RIGHT)}?`,
          widget: () => gridPic(SUDOKU_Q, { size: 52, mark: [`${SQ_RIGHT[0]},${SQ_RIGHT[1]}`] }),
          answer: SUDOKU_Q_SOL[SQ_RIGHT[0]][SQ_RIGHT[1]],
          explain: `It’s ${SUDOKU_Q_SOL[SQ_RIGHT[0]][SQ_RIGHT[1]]}: the only number its row, column and box don’t already use.`,
        },
        {
          kind: 'read',
          title: 'Or ask where a number can go',
          body: 'The other way round: pick a number and a row (or column, or box). If that number fits in only **one** cell there, it goes there, even if the cell itself has other candidates. Alternating “which number fits this cell?” and “which cell takes this number?” solves most small grids.',
        },
        {
          kind: 'fill',
          body: 'Row 2 of a 4 × 4 Sudoku reads **_ 3 _ 1**. Column 1 already has a 2 in it. Complete the row.',
          template: '[[0]] 3 [[1]] 1',
          blanks: [{ options: ['4', '2'], answer: 0 }, { options: ['2', '4'], answer: 0 }],
          hint: 'Which two numbers is the row missing?',
          explain: 'The row is missing 2 and 4. Column 1 already has a 2, so its cell is 4, and the other blank is 2.',
        },
        {
          kind: 'task',
          title: 'Sum cages',
          body: 'New rules: no boxes, but cages. Fill 1 to 4 so each row and each column holds each number once, and the numbers in each outlined cage add up to its small total.',
          widget: gridTask(KEN),
          hint: 'A 2-cell cage of 4 must be 1 + 3. A 3-cell cage of 9 in one column must be 2 + 3 + 4.',
          explain: `Rows: ${rowsText(KEN_SOL)}.`,
        },
        {
          kind: 'read',
          title: 'One solution, and only one',
          body: `A fair logic puzzle has exactly **one** solution, so every step can be deduced. Setters check by computer. These grids were tested against every possibility: there are ${latinSquares(4).length} ways to fill a 4 × 4 with each number once per row and column, and exactly one fits each puzzle. Remove a clue and a second solution often appears.`,
        },
        {
          kind: 'number', tol: 0,
          body: 'How many ways are there to fill a **3 × 3** grid with 1, 2 and 3 so that each row and each column holds each number once?',
          answer: latinSquares(3).length,
          hint: 'Choose the first row (how many ways?). Then how many ways for the second row?',
          explain: `${latinSquares(3).length}: the first row can be any of 6 orders, the second row then has 2 choices (a shift left or right), and the third is forced. 6 × 2 = 12.`,
        },
        {
          kind: 'multi',
          body: 'Kakuro: **3** cells must hold **different** digits from 1 to 9 adding up to **23**. Which digits **must** be among them? Select all.',
          options: [5, 6, 7, 8, 9].map((d) => digitSets(3, 23).every((x) => x.includes(d))
            ? { text: String(d), correct: true, why: `Every way to make 23 uses ${d}.` }
            : { text: String(d), why: `${d} isn’t in ${digitSets(3, 23).map((x) => x.join(' + ')).join(', ')}.` }),
          hint: 'The biggest three digits make 9 + 8 + 7 = 24. How far below that is 23?',
          explain: `The only way: ${digitSets(3, 23).map((x) => x.join(' + ')).join(', ')} = 23. Lower any digit by more and you’d need a repeat.`,
        },
        {
          kind: 'sort',
          body: 'Kakuro runs: sort each by how many sets of different digits 1–9 can fill it.',
          bins: ['Exactly one set', 'Several sets'],
          items: ([[2, 3], [2, 17], [2, 10], [3, 6], [3, 24], [3, 15], [4, 10], [4, 20]] as [number, number][])
            .map(([k, s]) => ({ text: `${k} cells, total ${s}`, bin: digitSets(k, s).length === 1 ? 0 : 1 })),
          hint: 'Totals near the smallest or largest possible are tight.',
          explain: 'One set: 3 = 1 + 2, 17 = 8 + 9, 6 = 1 + 2 + 3, 24 = 7 + 8 + 9, 10 = 1 + 2 + 3 + 4. Several: 10 in 2 cells (1 + 9, 2 + 8, …), 15 in 3 cells, 20 in 4 cells. Puzzle solvers memorise the tight ones.',
        },
        {
          kind: 'estimate',
          body: 'How many different **completed** 4 × 4 mini Sudoku grids (rows, columns and 2 × 2 boxes all correct) do you think exist?',
          min: 0, max: 600, step: 4, answer: SUDOKU_ALL.length, tol: 40,
          explain: `A computer count gives ${SUDOKU_ALL.length}, exactly half of the ${latinSquares(4).length} grids that get rows and columns right. The box rule cuts a lot.`,
        },
        {
          kind: 'choice',
          body: 'A setter removes one clue, and the puzzle now has **two** solutions. What does that mean for a solver?',
          options: [
            { text: 'At some point logic can’t decide, and they must guess', correct: true },
            { text: 'Nothing: either solution counts', why: 'A logic puzzle promises every step is forced. With two solutions some step isn’t, and one of them will be marked wrong.' },
            { text: 'The puzzle got easier', why: 'Fewer clues usually means harder, and here it means unfair.' },
          ],
          explain: 'Uniqueness is what makes deduction possible: if two grids fit every clue, no reasoning can choose between them.',
        },
      ],
      practice: [genSudokuCell, genKakuro],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'invariants',
      title: 'Invariants & impossibility',
      goal: 'Prove a puzzle can’t be solved by finding something no move can change.',
      steps: [
        {
          kind: 'task',
          title: 'Heads up',
          body: 'A move flips **two neighbouring** coins. Turn all eight coins heads up.',
          widget: flipTask(FLIP_START),
          hint: 'Flip a tail together with its right-hand neighbour and walk it along until it meets another tail.',
          explain: `Tails are at 2, 3, 5 and 8. Flip coins 2 and 3 together. Then walk the tail at 5 to the right: flip 5 and 6, then 6 and 7, then 7 and 8. ${flipMin(FLIP_START)} moves.`,
        },
        {
          kind: 'choice',
          body: `New row: **${HT(FLIP_BAD)}**. Same move. Can you reach all heads?`,
          options: [
            { text: 'No, never', correct: true },
            { text: 'Yes, with enough moves', why: 'Trying longer won’t help: count the tails, and see how one move changes that count.' },
            { text: 'Yes, but only by starting at the left', why: 'No order of moves works; something about the row never changes.' },
          ],
          hint: 'Count the tails. What does one move do to that count?',
          explain: 'There are 3 tails. A move changes the tail count by −2, 0 or +2, so it stays odd forever. All heads means 0 tails, which is even. Impossible.',
        },
        {
          kind: 'read',
          title: 'Something that never changes',
          body: 'A quantity that no move can change is an **invariant**. Here it’s whether the number of tails is odd or even. The start says “odd”, the goal says “even”, and that settles it: no sequence of moves, however long, can get there. You proved impossibility without trying a single sequence.',
        },
        {
          kind: 'sort',
          body: 'In a row of **8** coins, a move flips two neighbours. Which quantities can never change?',
          bins: ['Invariant', 'Can change'],
          items: [
            { text: 'Whether the number of tails is odd or even', bin: 0 }, { text: 'Whether the number of heads is odd or even', bin: 0 },
            { text: 'The total number of coins', bin: 0 }, { text: 'The number of tails', bin: 1 },
            { text: 'Which coin is the leftmost tail', bin: 1 }, { text: 'The number of heads', bin: 1 },
          ],
          explain: 'Tails change by −2, 0 or +2, so their parity is fixed; heads = 8 − tails, so the parity of heads is fixed too. The counts themselves and the position of the first tail do move.',
        },
        {
          kind: 'task',
          title: 'Sliding tiles',
          body: 'Slide the tiles into order: **1 2 3** on top, **4 5** below, gap bottom-right. Tap a tile next to the gap to slide it.',
          widget: slideTask(2, 3, SLIDE_START),
          hint: 'Get 1, 2 and 3 into the top row first; a tile can circle round the 2 × 3 loop.',
          explain: (() => {
            const p = bfs(SLIDE_START, (s) => s.join(','), (s) => slideNext(2, 3, s), (s) => s.join(',') === slideGoal(6).join(','))!;
            const tiles = p.slice(1).map((s, i) => p[i][s.indexOf(0)]);
            return `${p.length - 1} slides at best: move tiles ${tiles.join(', ')}, in that order.`;
          })(),
        },
        {
          kind: 'choice',
          body: 'Someone prises out tiles 1 and 2 of a solved puzzle and puts them back swapped. Can sliding fix it?',
          widget: () => h('div', { style: 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap' }, slidePic(3, SLIDE_SWAP, { hi: [1, 2] })),
          options: [
            { text: 'No, never', correct: true },
            { text: 'Yes, it just takes many moves', why: `A full search of the ${SLIDE_REACH.size} reachable arrangements never meets this one.` },
            { text: 'Yes, by moving 1 and 2 around the loop', why: 'Circling tiles round the loop shifts three or more of them at once; it can’t swap just two.' },
          ],
          hint: 'Every slide swaps the gap with a tile. Think about odd and even numbers of swaps.',
          explain: 'Impossible. Colour the cells like a chessboard: each slide moves the gap to the other colour, so returning the gap to its corner takes an even number of slides. Each slide is a swap, and an even number of swaps can never add up to a single swap of two tiles.',
        },
        {
          kind: 'number', tol: 0,
          body: 'Five tiles and a gap can be arranged in 6! = **720** ways. How many of them can be reached by sliding from the solved puzzle?',
          answer: SLIDE_REACH.size,
          hint: 'The parity argument splits the arrangements into two classes.',
          explain: `${SLIDE_REACH.size}: exactly half. A computer search from the solved state visits ${SLIDE_REACH.size} arrangements and no more; the other half (like the swapped one) are out of reach.`,
        },
        {
          kind: 'read',
          title: 'Colour-changing tokens',
          body: 'A bag of red, green and blue tokens. A move: take two tokens of **different** colours and turn both into the third colour. A red and a green become two blues.',
          widget: () => tokenBars([4, 5, 6]),
        },
        {
          kind: 'choice',
          body: 'Start with **4 red, 5 green, 6 blue**. Can all the tokens end up the same colour?',
          widget: () => tokenBars([4, 5, 6]),
          options: chameleonEnds(4, 5, 6).length
            ? [{ text: 'Yes', correct: true }, { text: 'No', why: 'A search finds a way.' }]
            : [
              { text: 'No, never', correct: true },
              { text: 'Yes, all blue', why: 'All blue needs red and green both at 0, but red − green starts at −1 and only ever changes by 0 or ±3.' },
              { text: 'Yes, all red', why: 'All red needs green and blue both at 0, but blue − green starts at 1 and only ever changes by 0 or ±3.' },
            ],
          hint: 'Watch the differences between the counts, divided by 3.',
          explain: 'Each move changes two counts by −1 and the third by +2, so every difference between two counts changes by 0 or ±3. Its remainder on division by 3 never changes. The differences start at 1, 1 and 2, none a multiple of 3, but one colour needs two counts both 0 (a difference of 0). Impossible.',
        },
        {
          kind: 'fill',
          body: 'Write the invariant down.',
          template: 'A move changes two counts by −1 and the third by +2. So each difference between two counts changes by 0 or [[0]]. Its remainder on division by [[1]] never changes. All one colour needs some difference of [[2]].',
          blanks: [{ options: ['±3', '±1', '±2'], answer: 0 }, { options: ['3', '2', '6'], answer: 0 }, { options: ['0', '1', '2'], answer: 0 }],
          explain: 'Two counts falling together keep their difference; one falling by 1 while another rises by 2 shifts it by 3. Remainders mod 3 are the invariant, and “both zero” means a difference of 0.',
        },
        {
          kind: 'read',
          title: 'One-way quantities',
          body: 'Some quantities aren’t fixed but only move **one way**: a monovariant. People stand in a line; a move swaps two neighbours who are in the wrong order of height. Each swap fixes exactly one out-of-order pair and spoils none, so the number of out-of-order pairs drops by 1 every time. It can’t drop forever, so the swapping must stop, and it stops only when the line is sorted.',
        },
        {
          kind: 'number', tol: 0,
          body: 'Heights in a line: **5, 4, 3, 2, 1** (tallest first). Swap out-of-order neighbours, one pair at a time, in any order you like, until the line runs shortest to tallest. How many swaps will it take?',
          answer: 10,
          hint: 'Count the out-of-order pairs at the start.',
          explain: 'Every pair is out of order at the start: 5 × 4 ÷ 2 = 10 pairs. Each swap fixes exactly one, so it always takes exactly 10, whatever order you choose.',
        },
        {
          kind: 'choice',
          body: 'A beetle sits on each square of a **5 × 5** board. At a whistle, every beetle crawls to a square next to it (up, down, left or right). Must some square end up empty?',
          widget: () => cellGrid(5, 5, (r, c) => ({ fill: (r + c) % 2 ? 'color-mix(in srgb, var(--c1) 35%, var(--panel))' : 'var(--panel2)', text: '🪲' }), { size: 40 }),
          options: [
            { text: 'Yes, always', correct: true },
            { text: 'No: they can pair up and swap places', why: 'Pairing up needs an even number of beetles, and there are 25. The colouring shows more.' },
            { text: 'Only if they choose badly', why: 'However they move, the colour count forces an empty square.' },
          ],
          hint: 'Colour it like a chessboard. What colour does a beetle land on?',
          explain: 'There are 13 squares of one colour and 12 of the other, and every beetle changes colour when it moves. So the 12 beetles from the smaller colour can fill at most 12 of the 13 squares of the larger colour: at least one is left empty.',
        },
      ],
      practice: [genFlip, genChameleon, genSlide],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'backwards',
      title: 'Work backwards & use symmetry',
      goal: 'Start from the end to find winning moves, and mirror your opponent.',
      steps: [
        {
          kind: 'task',
          title: 'Race to the corner',
          body: 'A token sits on a grid. Players take turns moving it any number of squares **left** or **down** (not both). Whoever moves it onto ★ wins. You move first; the computer plays perfectly.',
          widget: cornerTask({ size: 8, start: [6, 3] }),
          hint: 'Work backwards from ★. Which squares would you hate to have to move from?',
          explain: 'Move left to column 3, row 3, on the diagonal. Any computer move takes the token off the diagonal, and you move it straight back on (same distance, the other direction). Eventually you step onto ★.',
        },
        {
          kind: 'read',
          title: 'Work backwards',
          body: 'Start at the end. From any square in the bottom row or left column you reach ★ at once: those are **W**, wins for the player about to move. From (1, 1) every move lands on a W square for your opponent, so (1, 1) is **L**. Keep going: a square is **L** if every move from it reaches a W, and **W** if some move reaches an L. The L squares are exactly the diagonal.',
          widget: () => cornerPic(8, [-1, -1], (x, y) => (x === 0 && y === 0 ? '★' : cornerLosing(8)[x][y] ? 'L' : 'W'), true),
        },
        {
          kind: 'choice',
          body: 'The token is at column 5, row 2, and it’s your move. Where should it go?',
          widget: () => cornerPic(8, [5, 2]),
          options: [
            { text: 'Column 2, row 2', correct: true, why: 'Onto the diagonal: an L square for your opponent.' },
            { text: 'Column 0, row 2', why: 'Your opponent moves straight down to ★.' },
            { text: 'Column 5, row 0', why: 'Your opponent slides left to ★.' },
            { text: 'Column 4, row 2', why: 'Your opponent moves to column 2, row 2, onto the diagonal, and now you are stuck losing.' },
          ],
          explain: 'Move left to (2, 2). From the diagonal every move leaves it, and you can always step back on.',
        },
        {
          kind: 'point',
          body: 'The token (orange) is at column 7, row 4, and it’s your move. Place the square you should move it to.',
          plot: { x: [0, 8], y: [0, 8], grid: true, ticks: [1, 1], equal: true, size: [300, 300], xlabel: 'column', ylabel: 'row', layers: [{ type: 'dots', pts: [[7, 4]], color: 'var(--c2)', r: 7 }, { type: 'text', x: 0.35, y: 0.35, text: '★' }] },
          answer: { x: 4, y: 4 }, tol: 0.4, snap: 1,
          hint: 'Which move puts the token on an L square?',
          explain: 'Move left 3 squares to (4, 4), on the diagonal.',
        },
        {
          kind: 'read',
          title: 'Copy your opponent',
          body: 'The diagonal trick is really **symmetry**. Think of the column and row as two piles; on the diagonal the piles are equal. Whatever your opponent takes from one pile, you take the same from the other. Mirror strategies crack many games: restore the balance after every move, and the last move is yours.',
        },
        {
          kind: 'choice',
          body: `**${RING_N}** coins lie in a ring. Players take turns removing either 1 coin or 2 coins that touch. Whoever takes the last coin wins. Should you go first or second?`,
          options: RING_FIRST
            ? [{ text: 'First', correct: true }, { text: 'Second', why: 'A full search shows the first player wins.' }]
            : [
              { text: 'Second', correct: true, why: 'After the first move the ring is a line; split it into two equal lines and mirror.' },
              { text: 'First', why: 'Whatever the first player takes, the second can split the rest into two equal halves and copy every move.' },
              { text: 'It doesn’t matter', why: 'There is no luck here: the second player can force a win.' },
            ],
          hint: 'After the first move, the ring becomes a line. Can you make the line symmetric?',
          explain: 'Go second. The first player leaves a line of 10 or 9. From 10, take the middle 2; from 9, take the middle 1: either way two separate lines of 4 remain. Now copy every move on the other line. You always have a reply, so you take the last coin. (An exhaustive search of the game agrees.)',
        },
        {
          kind: 'number', tol: 0,
          body: 'A tennis knockout has **37** players. Each match has two players and the loser is out; byes fill the gaps when numbers are odd. How many matches until there is a champion?',
          answer: 36,
          hint: 'Forget the bracket. What does each match do?',
          explain: 'Each match knocks out exactly one player, and 36 players must be knocked out: 36 matches.',
        },
        {
          kind: 'read',
          title: 'Count what disappears',
          body: 'Rounds, byes and brackets are a distraction. Pair each match with the player it eliminates: every match has exactly one loser, and everyone but the champion loses once. Matches = players − 1, whatever the bracket. Looking at the end state (one player left) made the count instant.',
        },
        {
          kind: 'number', tol: 0,
          body: 'Ann, Ben and Cat play three rounds. Each round the loser **doubles** the other two’s money from their own pocket. Ann loses round 1, Ben round 2, Cat round 3, and then each has **$24**. How much did Ann start with?',
          answer: doublingStart(24, [0, 1, 2])[0], unit: '$',
          hint: 'Undo round 3 first: Cat had just doubled Ann and Ben, so before it they had half.',
          explain: `Backwards. Before round 3: Ann 12, Ben 12, Cat 24 + 12 + 12 = 48. Before round 2: Ann 6, Cat 24, Ben 12 + 6 + 24 = 42. Before round 1: Ben 21, Cat 12, Ann 6 + 21 + 12 = ${doublingStart(24, [0, 1, 2])[0]}.`,
        },
        {
          kind: 'fill',
          body: 'Look back and check, going **forwards** from Ann $39, Ben $21, Cat $12. Ann loses round 1 and doubles the other two:',
          template: 'After round 1: Ann $[[0]], Ben $[[1]], Cat $[[2]].',
          blanks: [{ options: ['6', '18', '39'], answer: 0 }, { options: ['42', '21', '40'], answer: 0 }, { options: ['24', '12', '36'], answer: 0 }],
          hint: 'Ben gains 21 and Cat gains 12, both paid by Ann.',
          explain: 'Ben 21 → 42, Cat 12 → 24, and Ann pays 21 + 12 = 33, leaving 6. That matches the backward chain, which goes on to $24 each.',
        },
        {
          kind: 'sort',
          body: 'Corner race on a big board: sort these squares (column, row) by who wins with best play.',
          bins: ['Player to move wins', 'Player to move loses'],
          items: ([[3, 3], [4, 1], [0, 5], [6, 6], [2, 7], [1, 1]] as [number, number][])
            .map(([x, y]) => ({ text: `(${x}, ${y})`, bin: cornerLosing(8)[x][y] ? 1 : 0 })),
          hint: 'Losing squares are where column = row.',
          explain: 'On the diagonal, (1, 1), (3, 3), (6, 6), every move leaves it: the mover loses. Off it, (4, 1), (0, 5), (2, 7), the mover steps onto the diagonal (or straight to ★) and wins.',
        },
        {
          kind: 'read',
          title: 'Two tools',
          body: '- **Work backwards** when the end is pinned down: a final position, a final amount, a last move.\n- **Look for symmetry** when two sides are alike: copy the other side and keep the balance.',
        },
      ],
      practice: [genCorner, genKnockout, genDoubling],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'unstuck',
      title: 'Getting unstuck',
      goal: 'Change the representation, shrink the problem, guess systematically, and check.',
      steps: [
        {
          kind: 'choice',
          body: '**Game of 15.** Two players take turns claiming numbers from 1 to 9 (each number once). The first to hold **three** numbers adding to exactly 15 wins. Your opponent holds 2 and 5; you hold 4 and 9. Your turn: which number must you take?',
          options: [
            { text: '8', correct: true, why: 'It blocks 2 + 5 + 8 = 15.' },
            { text: '6', why: 'Then your opponent takes 8: 2 + 5 + 8 = 15.' },
            { text: '1', why: 'Then your opponent takes 8: 2 + 5 + 8 = 15.' },
            { text: '3', why: 'Then your opponent takes 8: 2 + 5 + 8 = 15.' },
          ],
          hint: 'You can’t win this turn (you’d need the 2). What does your opponent need?',
          explain: 'Your opponent threatens 2 + 5 + 8. You can’t win now (4 + 9 needs the 2, which is gone), so you must block: take 8.',
        },
        {
          kind: 'read',
          title: 'Change the representation',
          body: 'Lay 1 to 9 out in this **magic square**: every row, column and diagonal adds to 15, and those 8 lines are the only triples that do. So the Game of 15 is noughts and crosses in disguise: 2, 5, 8 is a diagonal. A new picture turned a sum puzzle into a game you already know.',
          widget: () => magicPic({ 2: 'var(--c2)', 5: 'var(--c2)', 4: 'var(--c1)', 9: 'var(--c1)' }),
        },
        {
          kind: 'number', tol: 0,
          body: 'How many sets of three different numbers from 1 to 9 add up to 15?',
          answer: MAGIC_TRIPLES,
          hint: 'Count the lines of the magic square.',
          explain: `${MAGIC_TRIPLES}: the 3 rows, 3 columns and 2 diagonals of the magic square. (Listing them all, 1 + 5 + 9, 1 + 6 + 8, 2 + 4 + 9, …, confirms there are no others.)`,
        },
        {
          kind: 'number', tol: 0,
          body: '**100** lockers, all closed. Person 1 opens every locker. Person 2 toggles every 2nd locker (opens it if closed, closes it if open), person 3 every 3rd, and so on up to person 100. How many lockers end **open**?',
          answer: lockersOpen(100),
          hint: 'Too big to do by hand. Try 12 lockers and 12 people first.',
          explain: 'Locker n is toggled once for each divisor of n. Divisors pair up (2 × 6 = 12), except that a square’s root pairs with itself (3 × 3 = 9). So only squares are toggled an odd number of times: 1, 4, 9, …, 100, which is 10 lockers.',
        },
        {
          kind: 'read',
          title: 'Shrink it',
          body: 'The small version shows the pattern. Step through 12 lockers and 12 people: the open ones at the end are 1, 4 and 9, the perfect squares.',
          widget: () => stepper(12, (i) => lockersPic(12, i + 1), { caption: (i) => `After person ${i + 1}: open ${Array.from({ length: 12 }, (_, k) => k + 1).filter((n) => { let c = 0; for (let j = 1; j <= i + 1; j++) if (n % j === 0) c++; return c % 2 === 1; }).join(', ')}` }),
        },
        {
          kind: 'match',
          body: 'Match each strategy to the signal that says “try me”.',
          heads: ['Strategy', 'Reach for it when…'],
          pairs: [
            ['Change the representation', 'the puzzle feels like something familiar in disguise'],
            ['Solve a smaller version', 'the numbers are too big to work by hand'],
            ['Guess and check, systematically', 'answers are few and easy to test'],
            ['Work backwards', 'the final position is known exactly'],
            ['Look for an invariant', 'you suspect the goal is impossible'],
          ],
          explain: 'Each strategy has a trigger: a disguise (re-represent), big numbers (shrink), easy tests (systematic guessing), a fixed end (backwards), and a suspicion of impossibility (invariant).',
        },
        {
          kind: 'number', tol: 0,
          body: 'A farm has chickens and goats: **30** heads and **74** legs. How many **goats**?',
          answer: 7,
          hint: 'Guess: all 30 are chickens. How many legs is that? What does swapping one chicken for a goat do?',
          explain: 'All chickens: 60 legs. Each goat instead of a chicken adds 2 legs, and 14 legs are missing: 7 goats (and 23 chickens).',
        },
        {
          kind: 'read',
          title: 'Guess, but systematically',
          body: 'Start from an easy guess and change one thing at a time. A table keeps guessing from turning into flailing, and here it reveals the pattern: each goat adds 2 legs.',
          widget: () => dataTable(['Goats', 'Chickens', 'Legs'], Array.from({ length: 8 }, (_, g) => [g, 30 - g, 4 * g + 2 * (30 - g)]), { highlight: [7] }),
        },
        {
          kind: 'multi',
          body: 'You answered “7 goats, 23 chickens” for 30 heads and 74 legs. Which of these are real **checks**? Select all.',
          options: [
            { text: 'Count legs: 7 × 4 + 23 × 2 = 74', correct: true, why: 'Putting the answer back into the conditions is the best check.' },
            { text: 'Count heads: 7 + 23 = 30', correct: true, why: 'The other condition holds too.' },
            { text: 'Both numbers are whole and between 0 and 30', correct: true, why: 'A sanity check: a negative or fractional answer would reveal a slip at once.' },
            { text: 'It feels about right', why: 'A feeling isn’t a test of the conditions.' },
            { text: 'A friend got 7 too', why: 'Agreement isn’t a check: you could share the same slip.' },
          ],
          explain: 'Check against the conditions (heads and legs) and against common sense (whole, in range). Feelings and agreement don’t test anything.',
        },
        {
          kind: 'task',
          title: 'Final challenge: Lights Out',
          body: 'Switch every light off. A press toggles that light and its up, down, left and right neighbours.',
          widget: lightsTask(LIGHTS_START),
          hint: 'Order doesn’t matter, and pressing twice undoes itself. Use the strategies: try small cases, guess systematically, check.',
          explain: `Press ${LIGHTS_SOL.map((i) => SPOT[i]).join(', ')}, in any order: ${LIGHTS_SOL.length} presses.`,
        },
        {
          kind: 'read',
          title: 'Why there’s always an answer',
          body: 'Two facts shrink Lights Out. Pressing a button twice undoes itself, and the order of presses doesn’t matter. So a solution is just a **set** of buttons: 2⁹ = 512 possible sets. A computer tries them all and finds 512 different patterns, so every starting pattern has exactly one press set that clears it. Here it is (orange):',
          widget: () => lightsPic(LIGHTS_START, { press: LIGHTS_SOL }),
        },
        {
          kind: 'sort',
          body: 'Mixed bag: sort each puzzle by the strategy that cracks it.',
          bins: ['Try small cases', 'Find an invariant', 'Work backwards', 'Search the states'],
          items: [
            { text: 'Most pieces from 20 straight cuts', bin: 0 }, { text: 'Handshakes among 50 people', bin: 0 },
            { text: 'Can red, green and blue tokens all become one colour?', bin: 1 }, { text: 'Can a sliding puzzle with two tiles swapped be fixed?', bin: 1 },
            { text: 'Starting money, given what three players ended with', bin: 2 }, { text: 'Fewest pours to measure 6 litres', bin: 3 },
            { text: 'Fewest raft trips without anyone getting eaten', bin: 3 },
          ],
          explain: 'Growth patterns (cuts, handshakes) yield to small cases; “can it ever?” questions to invariants; known endings to working backwards; fewest-moves puzzles to a breadth-first search.',
        },
        {
          kind: 'estimate',
          body: 'The classic 3 × 3 sliding puzzle has 8 tiles and a gap: 9! = 362,880 arrangements. About how many can be reached from the solved one?',
          min: 0, max: 362880, step: 10, answer: 181440, tol: 20000, format: (v) => v.toLocaleString('en-US'),
          hint: 'Remember the 2 × 3 puzzle.',
          explain: 'Exactly half, 181,440. The same parity invariant splits the arrangements into two classes, and a search from the solved state reaches every arrangement in its own class.',
        },
      ],
      practice: [genHeads, genLockers, genLights],
    },
  ],
};
