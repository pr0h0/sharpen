// Algorithms: precise steps and counting them, searching, sorting, growth rates, graphs, shortest
// paths, greedy choices, recursion and dynamic programming. Every answer below comes from running
// the algorithm (src/widgets/algorithms.ts), never from a hand calculation.
import type { AskStep, Choice, Course, Generator } from '../types';
import { h, num, pick, randInt, seeded, shuffle } from '../ui';
import { columnChart, dataTable } from '../viz/charts';
import { codeBlock, network } from '../viz/cs';
import { plotExplorer } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  adjacency, bestSchedule, bfs, bsStepper, guessGame, sortStepper, coinMaker, degree, dijkstra, dijkstraStepper, fibCalls, fibTree,
  type Graph, greedyCoins, greedySchedule, greedyStepper, gridPaths, gridPathsQuiz, gridPathsStepper, insertionSort, inversions,
  knapsackBest, knapsackGreedy, maxScan, maxStepper, mazeBfsStepper, mazeDist, mazeView, mazeWalk, type Meeting, mergeCount,
  mergeSort, minCoins, nodePicker, parseMaze, pathEdges, pathPicker, pathTo, pathWeight, recordPicker, scheduleView, scheduler,
  selectionSort, stairs, swapSorter, worstProbes,
} from '../widgets/algorithms';

// ---------------------------------------------------------------- shared helpers

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k);
const list = (a: (number | string)[]) => `[${a.join(', ')}]`;
/** Count the comparisons of "compare every pair" by doing it. */
const pairCount = (n: number) => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c++; return c; };
/** Count the checks of a linear search that doesn't find what it looks for. */
const linearMiss = (a: number[], t: number) => { let c = 0; for (const v of a) { c++; if (v === t) break; } return c; };
/** best = 0 bug: the version that starts from 0 instead of the first item. */
const buggyMax = (a: number[]) => { let best = 0; for (const v of a) if (v > best) best = v; return best; };
const distinctInts = (rng: () => number, n: number, lo: number, hi: number) => {
  const s = new Set<number>();
  while (s.size < n) s.add(randInt(rng, lo, hi));
  return [...s];
};
/** Naive Fibonacci call counts for big n, by the same recurrence the recursion follows (checked against the real recursion below 20). */
const fibCallsBig = (n: number) => { const c = [1, 1]; for (let k = 2; k <= n; k++) c[k] = 1 + c[k - 1] + c[k - 2]; return c[n]; };
for (let k = 0; k < 20; k++) if (fibCallsBig(k) !== fibCalls(k)) console.error('fibCallsBig disagrees at', k);

// ---------------------------------------------------------------- lesson 1 data

const L1_MAX = [5, 3, 8, 6, 9, 7];
const L1_REC = [4, 9, 2, 12, 7, 15, 3, 18, 10];
const L1_BUGGY = ['[-3, -7, -1]', '[5, 2, 9]', '[0, -2, -5]', '[-4]', '[2, -6, 0]'];
const parseList = (s: string) => JSON.parse(s) as number[];
const L1_PAIRS_1000 = pairCount(1000);
const ten = range(1, 11);

// ---------------------------------------------------------------- lesson 2 data

const L2_ARR = [3, 8, 11, 15, 19, 24, 27, 31, 36, 44, 52, 63];
const L2_HALVES = (() => { const out = [100]; let n = 100; while (n > 1) { n = Math.floor(n / 2); out.push(n); } return out; })();
const L2_MID = (() => { const lo = 16, hi = 30; return { lo, hi, mid: (lo + hi) >> 1 }; })();

// ---------------------------------------------------------------- lesson 3 data

const L3_SWAP = [4, 1, 5, 2, 3];
const L3_DEMO = [6, 3, 8, 2, 7, 4, 5, 1];
const L3_ORDER = (() => { const out: string[] = []; for (const p of selectionSort([3, 1, 4, 2]).passes) { const s = p.join(' '); if (out[out.length - 1] !== s) out.push(s); } return out; })();
const L3_MERGE = mergeCount([1, 4, 7, 9], [2, 3, 8]).comparisons;
const sorted1000 = range(1, 1001);
const L3_SORTED = { ins: insertionSort(sorted1000).comparisons, sel: selectionSort(sorted1000).comparisons, mer: mergeSort(sorted1000).comparisons };
const L3_POINTS = (() => {
  const rng = seeded(7), pts: [number, number][] = [];
  for (let n = 4; n <= 64; n += 4) pts.push([n, mergeSort(shuffle(rng, range(0, n))).comparisons]);
  return pts;
})();

// ---------------------------------------------------------------- lesson 5 data

const SOCIAL: Graph = {
  nodes: [
    { id: 'Ana', x: 6, y: 30 }, { id: 'Ben', x: 22, y: 8 }, { id: 'Cal', x: 42, y: 52 }, { id: 'Dee', x: 60, y: 30 },
    { id: 'Eli', x: 80, y: 8 }, { id: 'Fay', x: 94, y: 50 }, { id: 'Gus', x: 74, y: 58 },
  ],
  edges: [['Ana', 'Ben'], ['Ana', 'Cal'], ['Ben', 'Cal'], ['Ben', 'Dee'], ['Cal', 'Dee'], ['Dee', 'Eli'], ['Dee', 'Fay'], ['Eli', 'Fay'], ['Dee', 'Gus']].map(([a, b]) => ({ a, b })),
};
const SOC_DEG = Object.fromEntries(SOCIAL.nodes.map((n) => [n.id, degree(SOCIAL, n.id)]));
const SOC_MAX = SOCIAL.nodes.map((n) => n.id).sort((a, b) => SOC_DEG[b] - SOC_DEG[a])[0];
const SOC_TWO = SOCIAL.nodes.map((n) => n.id).filter((v) => SOC_DEG[v] === 2);
const SOC_SUM = Object.values(SOC_DEG).reduce((s, d) => s + d, 0);

const SMALL: Graph = {
  nodes: [{ id: 'A', x: 15, y: 15 }, { id: 'B', x: 15, y: 50 }, { id: 'C', x: 55, y: 32 }, { id: 'D', x: 90, y: 32 }],
  edges: [['A', 'B'], ['A', 'C'], ['B', 'C'], ['C', 'D']].map(([a, b]) => ({ a, b })),
};
const SMALL_ADJ = adjacency(SMALL);

const BUILD: Graph = {
  nodes: [{ id: 'build', x: 10, y: 32 }, { id: 'ship', x: 90, y: 32 }, { id: 'fetch', x: 30, y: 6 }, { id: 'test', x: 50, y: 56 }, { id: 'pack', x: 70, y: 6 }],
  edges: [['fetch', 'build'], ['build', 'test'], ['test', 'pack'], ['pack', 'ship'], ['fetch', 'test'], ['build', 'pack']].map(([a, b]) => ({ a, b, directed: true })),
};
/** Kahn's algorithm; also reports whether the order was forced at every step (so the answer is unique). */
const BUILD_TOPO = (() => {
  const indeg: Record<string, number> = Object.fromEntries(BUILD.nodes.map((n) => [n.id, 0]));
  for (const e of BUILD.edges) indeg[e.b]++;
  const adj = adjacency(BUILD), out: string[] = [];
  let unique = true;
  for (;;) {
    const ready = Object.keys(indeg).filter((v) => indeg[v] === 0 && !out.includes(v));
    if (!ready.length) break;
    if (ready.length > 1) unique = false;
    out.push(ready[0]);
    for (const { to } of adj[ready[0]]) indeg[to]--;
  }
  if (!unique) console.error('BUILD order is not unique');
  return out;
})();

// ---------------------------------------------------------------- lesson 6 data

const MAZE_A = ['S..#....', '.#.#.##.', '.#...#..', '.####.#.', '......#E', '.##.#...', '....#.#.'];
const MAZE_B = ['S.#....', '.##.##.', '...#...', '#.##.#.', '#....#E', '##.#...'];
const MA = parseMaze(MAZE_A), MB = parseMaze(MAZE_B);
const MB_DIST = mazeDist(MB)[MB.e[0]][MB.e[1]];

const HOPS: Graph = {
  nodes: [{ id: 'S', x: 5, y: 30 }, { id: 'A', x: 30, y: 8 }, { id: 'D', x: 30, y: 52 }, { id: 'C', x: 52, y: 30 }, { id: 'F', x: 66, y: 6 }, { id: 'B', x: 60, y: 56 }, { id: 'E', x: 92, y: 30 }],
  edges: [['S', 'A'], ['S', 'D'], ['A', 'C'], ['A', 'F'], ['D', 'B'], ['D', 'C'], ['B', 'E'], ['C', 'E'], ['F', 'E']].map(([a, b]) => ({ a, b })),
};
const HOPS_BFS = bfs(HOPS, 'S');

const ROADS: Graph = {
  nodes: [{ id: 'A', x: 5, y: 30 }, { id: 'B', x: 28, y: 6 }, { id: 'C', x: 50, y: 54 }, { id: 'D', x: 60, y: 6 }, { id: 'E', x: 84, y: 54 }, { id: 'F', x: 96, y: 30 }],
  edges: [['A', 'B', 4], ['A', 'C', 2], ['B', 'C', 1], ['B', 'D', 5], ['C', 'E', 8], ['D', 'F', 3], ['E', 'F', 2], ['D', 'E', 2], ['B', 'E', 10]].map(([a, b, w]) => ({ a: a as string, b: b as string, w: w as number })),
};
const ROADS_BFS = pathTo(bfs(ROADS, 'A').prev, 'A', 'F');
const ROADS_DJ = dijkstra(ROADS, 'A');
const ROADS_BEST = pathTo(ROADS_DJ.prev, 'A', 'F');

const TOWN: Graph = {
  nodes: [{ id: 'S', x: 5, y: 30 }, { id: 'P', x: 28, y: 6 }, { id: 'Q', x: 28, y: 54 }, { id: 'R', x: 52, y: 30 }, { id: 'U', x: 74, y: 6 }, { id: 'V', x: 74, y: 54 }, { id: 'T', x: 95, y: 30 }],
  edges: [['S', 'P', 3], ['S', 'Q', 1], ['P', 'R', 2], ['Q', 'R', 6], ['Q', 'V', 9], ['P', 'U', 7], ['R', 'U', 3], ['R', 'V', 2], ['U', 'T', 2], ['V', 'T', 5]].map(([a, b, w]) => ({ a: a as string, b: b as string, w: w as number })),
};
const TOWN_DJ = dijkstra(TOWN, 'S');

// ---------------------------------------------------------------- lesson 7 data

const US = [1, 5, 10, 25];
const ODD = [1, 10, 25];
const ODD_FAILS = range(1, 100).filter((a) => greedyCoins(ODD, a).length > minCoins(ODD, a));
const C134 = [1, 3, 4];
const DAY: Meeting[] = [
  { name: 'A', s: 8, e: 12 }, { name: 'B', s: 9, e: 10 }, { name: 'C', s: 10, e: 12 }, { name: 'D', s: 11, e: 13 }, { name: 'E', s: 12, e: 15 },
  { name: 'F', s: 13, e: 14 }, { name: 'G', s: 14, e: 16 }, { name: 'H', s: 15, e: 17 }, { name: 'I', s: 16, e: 18 },
];
const DAY_GREEDY = greedySchedule(DAY);
const DAY_BEST = bestSchedule(DAY);
if (DAY_GREEDY.length !== DAY_BEST) console.error('earliest-finish greedy is not optimal on DAY?');
const DAY_EARLY = (() => { const out: Meeting[] = []; let free = -Infinity; for (const m of DAY.slice().sort((a, b) => a.s - b.s)) if (m.s >= free) { out.push(m); free = m.e; } return out; })();
const BAG = [{ name: 'laptop', kg: 6, value: 30 }, { name: 'camera', kg: 5, value: 22 }, { name: 'drone', kg: 5, value: 22 }, { name: 'book', kg: 1, value: 3 }];
const BAG_GREEDY = knapsackGreedy(BAG, 10);
const BAG_BEST = knapsackBest(BAG, 10);

// ---------------------------------------------------------------- lesson 8 data

const GRID_BLOCK: [number, number][] = [[1, 1]];
const QUIZ_BLOCK: [number, number][] = [[2, 2]];
const QUIZ_BLANKS: [number, number][] = [[1, 3], [2, 3], [3, 4]];
const GRID_Q = gridPaths(4, 5, QUIZ_BLOCK);
const QUIZ_EXPLAIN = QUIZ_BLANKS.map(([r, c]) => `Row ${r + 1}, column ${c + 1}: ${GRID_Q[r - 1][c]} + ${GRID_Q[r][c - 1]} = ${GRID_Q[r][c]}`).join('. ') + '. The blocked square counts 0.';

// ================================================================ practice generators

const genScanCount: Generator = (rng) => {
  if (rng() < 0.5) {
    const n = randInt(rng, 20, 5000);
    const c = maxScan(Array.from({ length: n }, () => randInt(rng, 1, 1000))).comparisons;
    return {
      kind: 'number', body: `Max-so-far scans a list of **${n.toLocaleString('en-US')}** numbers. How many comparisons does it make?`, answer: c, tol: 0,
      hint: 'The first item needs no comparison: it starts as the best.',
      explain: `Every item after the first is compared once with the best so far: ${n.toLocaleString('en-US')} − 1 = ${c.toLocaleString('en-US')}.`,
    };
  }
  const n = randInt(rng, 5, 60), c = pairCount(n);
  return {
    kind: 'number', body: `To check that **${n}** people all have different birthdays, you compare every pair once. How many comparisons?`, answer: c, tol: 0,
    hint: 'Person 1 is compared with the other n − 1, person 2 with the n − 2 after them, and so on.',
    explain: `${n - 1} + ${n - 2} + … + 1 = ${n} × ${n - 1} / 2 = ${c}.`,
  };
};

const genRecords: Generator = (rng) => {
  const a = distinctInts(rng, randInt(rng, 6, 8), 1, 40);
  const r = maxScan(a).records;
  return {
    kind: 'number', body: `Max-so-far scans ${list(a)} from left to right. How many times is **best** set, counting the first item?`, answer: r.length, tol: 0,
    hint: 'Count the items bigger than everything before them.',
    explain: `best is set at ${r.map((k) => a[k]).join(', ')}: each is bigger than everything to its left. That’s ${r.length}.`,
  };
};

const genBuggy: Generator = (rng) => {
  const n = randInt(rng, 3, 5);
  const neg = rng() < 0.5;
  const a = distinctInts(rng, n, neg ? -30 : -10, neg ? -1 : 30);
  const right = Math.max(...a), got = buggyMax(a), ok = right === got;
  return {
    kind: 'choice', body: `A buggy max-finder starts with \`best = 0\` instead of the first item. Does it give the right answer for ${list(a)}?`,
    options: [
      { text: 'Yes', correct: ok, why: ok ? undefined : `It returns ${got}, but the largest item is ${right}: 0 isn’t even in the list.` },
      { text: 'No', correct: !ok, why: ok ? `The list has an item ≥ 0, so best gets replaced by the real maximum, ${right}.` : undefined },
    ],
    ordered: true,
    explain: ok ? `Some item is at least 0, so the scan ends on the true maximum, ${right}. The bug only shows when every item is negative.` : `Every item is negative, so nothing beats 0 and it returns ${got} instead of ${right}.`,
  };
};

const genWorstProbes: Generator = (rng) => {
  const n = pick(rng, [10, 30, 64, 100, 500, 1000, 4000, 10_000, 50_000, 100_000, 1_000_000, 8_000_000, 1_000_000_000]);
  const k = worstProbes(n);
  return {
    kind: 'number', body: `Binary search on a sorted list of **${n.toLocaleString('en-US')}** items. In the worst case, how many probes does it need?`, answer: k, tol: 0,
    hint: 'Count how many times you can halve the list (rounding down) before nothing is left.',
    explain: `Each probe leaves at most half: ${n.toLocaleString('en-US')} → … → 1 → 0 takes ${k} halvings, so ${k} probes. (2^${k - 1} ≤ ${n.toLocaleString('en-US')} < 2^${k}.)`,
  };
};

const genNextMid: Generator = (rng) => {
  const N = pick(rng, [16, 20, 32, 40]);
  for (;;) {
    const lo = randInt(rng, 0, N - 8), hi = randInt(rng, lo + 4, N - 1), mid = (lo + hi) >> 1;
    const less = rng() < 0.5;
    const [nlo, nhi] = less ? [mid + 1, hi] : [lo, mid - 1];
    if (nlo > nhi) continue;
    const next = (nlo + nhi) >> 1;
    return {
      kind: 'point', body: `Binary search over indices 0–${N - 1} has narrowed to lo = ${lo}, hi = ${hi}. The probe at mid = ${mid} finds a value **${less ? 'smaller' : 'bigger'}** than the target. Mark where the **next** probe goes (mid = (lo + hi) // 2, rounding down).`,
      plot: { x: [0, N - 1], ticks: [N > 20 ? 4 : 2] }, answer: { x: next }, tol: 0.4, snap: 1,
      hint: less ? 'The target is to the right of mid: lo becomes mid + 1.' : 'The target is to the left of mid: hi becomes mid − 1.',
      explain: `New range: lo = ${nlo}, hi = ${nhi}. Next probe: (${nlo} + ${nhi}) // 2 = ${next}.`,
    };
  }
};

const genNewRange: Generator = (rng) => {
  const lo = randInt(rng, 0, 10), hi = lo + randInt(rng, 6, 20), mid = (lo + hi) >> 1;
  const less = rng() < 0.5;
  const tiles = (want: number, others: number[]) => [...new Set([want, ...others])].map(String);
  const loOpts = less ? tiles(mid + 1, [mid, lo, mid - 1]) : tiles(lo, [mid + 1, mid, lo + 1]);
  const hiOpts = less ? tiles(hi, [mid, mid - 1, hi - 1]) : tiles(mid - 1, [mid, hi, mid + 1]);
  return {
    kind: 'fill', body: `Binary search: lo = ${lo}, hi = ${hi}, so mid = ${mid}. a[mid] is **${less ? 'smaller' : 'bigger'}** than the target. What is the new range?`,
    template: 'lo = [[0]], hi = [[1]]',
    blanks: [{ options: loOpts, answer: 0 }, { options: hiOpts, answer: 0 }],
    hint: 'mid itself has been checked, so it is out too.',
    explain: less ? `The target is right of mid: lo = mid + 1 = ${mid + 1}; hi stays ${hi}.` : `The target is left of mid: hi = mid − 1 = ${mid - 1}; lo stays ${lo}.`,
  };
};

const genInversions: Generator = (rng) => {
  const a = shuffle(rng, range(1, randInt(rng, 5, 7) + 1));
  const k = inversions(a);
  return {
    kind: 'number', body: `You may only swap **neighbours**. What is the fewest number of swaps that sorts ${list(a)} smallest first?`, answer: k, tol: 0,
    hint: 'Count the pairs that are in the wrong order (a bigger number before a smaller one). Each neighbour swap fixes exactly one.',
    explain: `${k} pairs are out of order, and one neighbour swap changes the order of exactly one pair, so ${k} swaps are needed, and insertion sort uses exactly that many.`,
  };
};

const genMerge: Generator = (rng) => {
  const all = shuffle(rng, range(1, 30)).slice(0, randInt(rng, 6, 9));
  const cut = randInt(rng, 2, all.length - 2);
  const L = all.slice(0, cut).sort((a, b) => a - b), R = all.slice(cut).sort((a, b) => a - b);
  const c = mergeCount(L, R).comparisons;
  return {
    kind: 'number', body: `Merge the sorted lists ${list(L)} and ${list(R)} by repeatedly comparing their front items. How many comparisons?`, answer: c, tol: 0,
    hint: 'Each comparison moves one item to the output. You stop comparing as soon as one list runs out.',
    explain: `${c} comparisons. When one list is empty, the rest of the other is copied without comparing.`,
  };
};

const genSelectionOrder: Generator = (rng) => {
  for (;;) {
    const a = shuffle(rng, distinctInts(rng, 4, 1, 9));
    const frames: string[] = [];
    for (const p of selectionSort(a).passes) { const s = p.join(' '); if (!frames.includes(s)) frames.push(s); }
    if (frames.length < 3) continue;
    return {
      kind: 'order', body: `Selection sort runs on ${list(a)}. Put the states of the list in the order it passes through them.`, items: frames,
      hint: 'Each pass finds the smallest remaining item and swaps it to the front of the unsorted part.',
      explain: `Pass by pass: ${frames.join(' → ')}.`,
    };
  }
};

const genScale: Generator = (rng) => {
  const k = pick(rng, [1, 2, 3]);
  const n = pick(rng, [100, 1000, 5000]);
  const m = pick(rng, [2, 3, 4, 10]);
  const t = pick(rng, [1, 2, 3, 5]);
  const ans = t * Math.pow(m, k);
  const name = ['', 'O(n)', 'O(n²)', 'O(n³)'][k];
  return {
    kind: 'number', body: `An ${name} program takes ${t} second${t === 1 ? '' : 's'} on ${n.toLocaleString('en-US')} items. Roughly how many seconds on ${(m * n).toLocaleString('en-US')} items?`, answer: ans, unit: 's',
    hint: `The input is ${m}× bigger. What does ${name} do to that factor?`,
    explain: `${m}× the items means ${m}${k > 1 ? `^${k}` : ''} = ${Math.pow(m, k)}× the steps: ${t} × ${Math.pow(m, k)} = ${ans} s.`,
  };
};

const genCrossover: Generator = (rng) => {
  const a = randInt(rng, 2, 9) * 10;
  let x = 1;
  while (x * x < a * x) x++;
  return {
    kind: 'point', body: `Algorithm A takes ${a}·n steps; B takes n² steps. Mark the input size n where B stops being the faster one.`,
    plot: { x: [0, 2 * a], y: [0, 3 * a * a], size: [420, 300], xlabel: 'n', ylabel: 'steps', layers: [{ type: 'fn', f: (n) => a * n, label: `${a}n` }, { type: 'fn', f: (n) => n * n, label: 'n²' }] },
    answer: { x }, tol: a / 20, snap: 1,
    hint: `Solve n² = ${a}n.`,
    explain: `n² = ${a}n when n = ${a}. Below that the quadratic is cheaper (n < ${a}), above it the linear one wins, and keeps winning.`,
  };
};

const genBigO: Generator = (rng) => {
  const top = pick(rng, [0, 1, 2, 3]);
  const c = () => randInt(rng, 2, 60);
  const terms = [String(c()), `${c()}n`, `${c()}n²`, `${randInt(rng, 2, 9)}n³`].slice(0, top + 1).reverse();
  if (top >= 1 && rng() < 0.5) terms[0] = terms[0].replace(/^\d+/, '');
  const expr = terms.join(' + ');
  const names = ['O(1)', 'O(n)', 'O(n²)', 'O(n³)'];
  const why = ['A fixed number of steps, whatever n is, is O(1); this one grows.', 'The linear term is overtaken by the bigger power of n.', 'Look for the highest power of n; constants don’t change it.', 'There is no n³ term.'];
  return {
    kind: 'choice', body: `An algorithm takes **${expr}** steps on n items. What is its growth rate?`,
    options: names.map((t, k) => ({ text: t, correct: k === top, why: k === top ? undefined : k < top ? why[k] : 'That power of n doesn’t appear: the expression grows more slowly.' })),
    ordered: true,
    explain: `Keep the fastest-growing term and drop its constant: ${terms[0]} → ${names[top]}.`,
  };
};

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];
const genDegree: Generator = (rng) => {
  const all: [string, string][] = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) all.push([NAMES[i], NAMES[j]]);
  const es = shuffle(rng, all).slice(0, randInt(rng, 6, 9)).sort();
  const g: Graph = { nodes: NAMES.map((id) => ({ id, x: 0, y: 0 })), edges: es.map(([a, b]) => ({ a, b })) };
  const v = pick(rng, NAMES);
  const d = degree(g, v);
  return {
    kind: 'number', body: `A graph has the edges ${es.map(([a, b]) => `${a}–${b}`).join(', ')}. What is the **degree** of ${v}?`, answer: d, tol: 0,
    hint: `Count the edges with ${v} at one end.`,
    explain: `${v} is an end of ${d} edge${d === 1 ? '' : 's'}${d ? ': ' + es.filter((e) => e.includes(v)).map(([a, b]) => `${a}–${b}`).join(', ') : ''}.`,
  };
};

const genComplete: Generator = (rng) => {
  const n = randInt(rng, 4, 40), c = pairCount(n);
  return {
    kind: 'number', body: `In a group of **${n}** people, everyone is friends with everyone else. How many friendships (edges) is that?`, answer: c, tol: 0,
    hint: 'Each person has n − 1 friends, but that counts every friendship twice.',
    explain: `${n} × ${n - 1} ends, two per edge: ${n} × ${n - 1} / 2 = ${c}.`,
  };
};

const genHandshake: Generator = (rng) => {
  const n = randInt(rng, 5, 15), k = randInt(rng, 1, n + 1);
  const ok = k <= n - 1 && (n * k) % 2 === 0;
  return {
    kind: 'choice', body: `At a party of ${n} people, could **every** person shake hands with exactly ${k} of the others?`,
    options: [
      { text: 'Yes, it can be arranged', correct: ok, why: ok ? undefined : k > n - 1 ? `Each person has only ${n - 1} others to shake hands with.` : `The degrees would add to ${n} × ${k} = ${n * k}, an odd number, but they must add to twice the number of handshakes.` },
      { text: 'No, it’s impossible', correct: !ok, why: ok ? `${n} × ${k} = ${n * k} is even and ${k} ≤ ${n - 1}, and that is all it takes. Seat everyone in a circle; each shakes hands with the ${Math.floor(k / 2)} nearest on each side${k % 2 ? ', plus the person directly opposite' : ''}.` : undefined },
    ],
    ordered: true,
    explain: ok ? `${n * k} hand-ends is even, so it fits the handshake rule, and with ${k} ≤ ${n - 1} such a pattern always exists.` : k > n - 1 ? `Nobody has ${k} others to greet.` : `Sum of degrees = ${n * k}, which is odd. Every handshake has two ends, so the sum must be even. Impossible.`,
  };
};

const genMaze: Generator = (rng) => {
  for (;;) {
    const R = 5, C = 6;
    const rows = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (r === 0 && c === 0 ? 'S' : r === R - 1 && c === C - 1 ? 'E' : rng() < 0.32 ? '#' : '.')).join(''));
    const m = parseMaze(rows);
    const d = mazeDist(m)[m.e[0]][m.e[1]];
    if (d < 0 || (d === R + C - 2 && rng() < 0.7)) continue;
    const walls = rows.join('').split('#').length - 1;
    return {
      kind: 'number', body: `This maze has ${walls} wall squares. Moving up, down, left or right, what is the fewest steps from S to E?`, answer: d, tol: 0,
      widget: () => mazeView(m),
      hint: 'Number the squares outward from S: 1 for its open neighbours, 2 for theirs, and so on.',
      explain: `Breadth-first numbering reaches E at ${d}.`,
    };
  }
};

const genDijkstra: Generator = (rng) => {
  const g: Graph = { nodes: TOWN.nodes, edges: TOWN.edges.map((e) => ({ ...e, w: randInt(rng, 1, 9) })) };
  const r = dijkstra(g, 'S');
  const p = pathTo(r.prev, 'S', 'T');
  return {
    kind: 'number', body: `Road lengths: ${g.edges.map((e) => `${e.a}–${e.b} ${e.w}`).join(', ')}. What is the shortest distance from S to T?`, answer: r.dist.T, tol: 0,
    widget: () => network(g.nodes, g.edges, { nodeText: { S: 'start', T: 'goal' } }),
    hint: 'Settle the closest unsettled town each time, starting from S at 0.',
    explain: `Shortest route: ${p.join(' → ')}, length ${r.dist.T}.`,
  };
};

const genUSCoins: Generator = (rng) => {
  const a = randInt(rng, 11, 99), g = greedyCoins(US, a);
  return {
    kind: 'number', body: `Pay **${a}¢** greedily with 25¢, 10¢, 5¢ and 1¢ coins (biggest coin that fits, again and again). How many coins?`, answer: g.length, tol: 0,
    hint: 'Take as many 25s as fit, then 10s, then 5s, then 1s.',
    explain: `${g.join(' + ')} = ${a}: ${g.length} coins. For these coins greedy is also the fewest possible (${minCoins(US, a)}).`,
  };
};

const genGreedyFails: Generator = (rng) => {
  const sys = pick(rng, [[1, 3, 4], [1, 5, 6], [1, 4, 5], [1, 6, 9], [1, 7, 10]]);
  for (;;) {
    const amts = distinctInts(rng, 4, 2, 20).sort((a, b) => a - b);
    const fails = amts.map((a) => greedyCoins(sys, a).length > minCoins(sys, a));
    if (!fails.some(Boolean)) continue;
    return {
      kind: 'multi', body: `Coins: ${sys.join('¢, ')}¢. For which amounts does greedy (biggest coin first) **fail** to use the fewest coins?`,
      options: amts.map((a, k) => {
        const g = greedyCoins(sys, a), m = minCoins(sys, a);
        return { text: `${a}¢`, correct: fails[k], why: fails[k] ? `Greedy: ${g.join(' + ')} (${g.length} coins), but ${m} coins will do.` : `Greedy: ${g.join(' + ')}, ${g.length} coin${g.length === 1 ? '' : 's'}, which is already the fewest.` };
      }),
      ordered: true,
      hint: 'For each amount, run greedy, then look for a combination with fewer coins.',
      explain: amts.map((a, k) => `${a}¢: greedy ${greedyCoins(sys, a).length}, best ${minCoins(sys, a)}${fails[k] ? ' ✗' : ''}`).join('; ') + '.',
    };
  }
};

const genSchedule: Generator = (rng) => {
  const ms: Meeting[] = [];
  const used = new Set<string>();
  while (ms.length < 6) {
    const s = randInt(rng, 8, 16), e = s + randInt(rng, 1, 3);
    if (used.has(`${s}-${e}`)) continue;
    used.add(`${s}-${e}`);
    ms.push({ name: '', s, e });
  }
  ms.sort((a, b) => a.s - b.s || a.e - b.e).forEach((m, k) => { m.name = NAMES[k]; });
  const g = greedySchedule(ms);
  return {
    kind: 'number', body: `One room, these meeting requests: ${ms.map((m) => `${m.name} ${m.s}–${m.e}`).join(', ')}. What is the most meetings you can book without overlaps? (One may start the hour another ends.)`, answer: g.length, tol: 0,
    widget: () => scheduleView(ms),
    hint: 'Pick the meeting that ends first, drop everything that overlaps it, repeat.',
    explain: `Earliest finish first: ${g.map((m) => `${m.name} ${m.s}–${m.e}`).join(', ')}: ${g.length} meetings. Checking every subset agrees: ${bestSchedule(ms)}.`,
  };
};

const genStairs: Generator = (rng) => {
  const steps = rng() < 0.6 ? [1, 2] : [1, 2, 3];
  const n = randInt(rng, 4, steps.length === 2 ? 15 : 10);
  const w = stairs(n, steps);
  const recur = steps.map((d) => `ways(${n} − ${d})`).join(' + ');
  return {
    kind: 'number', body: `How many ways are there to climb **${n}** stairs taking ${steps.join(', ').replace(/, (\d)$/, ' or $1')} stairs at a time? (Order matters: 1 then 2 differs from 2 then 1.)`, answer: w, tol: 0,
    hint: `The last move was ${steps.join(', ').replace(/, (\d)$/, ' or $1')} stairs, so ways(n) adds up ways(n − ${steps.join('), ways(n − ')}).`,
    explain: `ways(0) = 1, then each value is the sum of the ${steps.length} before it: ${range(0, n + 1).map((k) => stairs(k, steps)).join(', ')}. So ${recur} = ${w}.`,
  };
};

const genGrid: Generator = (rng) => {
  const R = randInt(rng, 3, 5), C = randInt(rng, 3, 6);
  const block: [number, number][] = rng() < 0.5 ? [[randInt(rng, 1, R - 2), randInt(rng, 1, C - 2)]] : [];
  const t = gridPaths(R, C, block);
  return {
    kind: 'number', body: `A robot walks from the top-left to the bottom-right square of a ${R} × ${C} grid, moving only right or down${block.length ? `, and the square in row ${block[0][0] + 1}, column ${block[0][1] + 1} is blocked` : ''}. How many routes?`, answer: t[R - 1][C - 1], tol: 0,
    widget: () => mazeView(parseMaze(Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (r === 0 && c === 0 ? 'S' : r === R - 1 && c === C - 1 ? 'E' : block.some(([a, b]) => a === r && b === c) ? '#' : '.')).join('')))),
    hint: 'Every square’s count is the one above plus the one to its left. The top row and left column are all 1 (until a block).',
    explain: `Filling the table row by row, the bottom-right square gets ${t[R - 1][C - 1]}. Bottom row: ${t[R - 1].join(', ')}.`,
  };
};

const genFibCalls: Generator = (rng) => {
  const n = randInt(rng, 3, 16), c = fibCalls(n);
  return {
    kind: 'number', body: `The naive recursive \`fib(n)\` calls fib(n − 1) and fib(n − 2) and stops at fib(0) and fib(1). How many calls does **fib(${n})** make in total, counting the first?`, answer: c, tol: 0,
    hint: 'calls(n) = 1 + calls(n − 1) + calls(n − 2), with calls(0) = calls(1) = 1.',
    explain: `calls: ${range(0, n + 1).map((k) => fibCalls(k)).join(', ')}. So fib(${n}) makes ${c} calls. With memoization it would be only ${n + 1} distinct ones.`,
  };
};

// ================================================================ steps that are built from data

const buggyStep: AskStep = {
  kind: 'multi',
  body: 'A max-finder with a bug: it starts with `best = 0` instead of the first item. Which lists make it give the **wrong** answer?',
  widget: () => codeBlock('best = 0          # bug: should be a[0]\nfor x in a:\n    if x > best:\n        best = x\nreturn best', { marks: [1] }),
  options: L1_BUGGY.map((s): Choice => {
    const a = parseList(s), bad = buggyMax(a) !== Math.max(...a);
    return { text: s, correct: bad, why: bad ? `Every item is below 0, so it returns 0, which isn’t even in the list.` : `Some item is at least 0, so best ends on the real maximum, ${Math.max(...a)}.${a.includes(0) && Math.max(...a) === 0 ? ' (0 happens to be the right answer here.)' : ''}` };
  }),
  ordered: true,
  hint: 'The bug can only matter when nothing in the list beats 0.',
  explain: 'It fails exactly when every item is negative. Testing only “normal” lists would never catch it: correctness means every input, including the awkward ones.',
};

const sortedChoice: Choice[] = [
  { text: `Insertion sort: ${L3_SORTED.ins} comparisons`, correct: true },
  { text: `Selection sort: ${L3_SORTED.sel.toLocaleString('en-US')} comparisons`, why: 'Selection sort scans the whole unsorted part every pass, even when it is already in order. It never notices.' },
  { text: `Merge sort: ${L3_SORTED.mer.toLocaleString('en-US')} comparisons`, why: 'Merge sort still splits and merges everything. Sorted input helps it a little (each merge stops early) but it stays about n log n.' },
];

// ================================================================ course

export const algorithms: Course = {
  id: 'algorithms',
  title: 'Algorithms',
  blurb: 'Search, sort, find paths and count the steps: how computers solve problems fast.',
  color: '#0ea5a4',
  icon: '🧭',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'what',
      title: 'What is an algorithm?',
      goal: 'Write precise steps, check they always work, and count how many they take.',
      steps: [
        {
          kind: 'choice',
          body: 'Eight people stand in a line. You walk past them **one at a time** and may remember only one person. Which instructions always find the tallest?',
          options: [
            { text: 'Remember the first; whenever someone is taller than who you remember, remember them instead', correct: true },
            { text: 'Compare the first and the last person and pick the taller', why: 'The tallest could be anywhere in the middle; this never looks there.' },
            { text: 'Pick whoever looks tallest from the end of the line', why: 'That’s a judgment, not a step-by-step method: it can fail, and a computer can’t “look” like that.' },
            { text: 'Stop at the first person taller than the one before', why: 'That finds a local bump, not the tallest. Someone even taller may come later.' },
          ],
          explain: 'Keep a “best so far” and update it. Every person is checked, so the tallest can’t be missed.',
        },
        {
          kind: 'read',
          title: 'An algorithm is a recipe',
          body: 'An **algorithm** is a list of precise steps that solves a problem for **every** input, and finishes.\n\nThe “best so far” method is called **max-so-far**. Step through it on a list of heights.',
          widget: () => maxStepper(L1_MAX),
        },
        {
          kind: 'number',
          body: `How many comparisons did max-so-far make on those ${L1_MAX.length} people?`,
          widget: () => h('div', null, codeBlock('best = a[0]\nfor x in a[1:]:\n    if x > best:      # one comparison\n        best = x')),
          answer: maxScan(L1_MAX).comparisons, tol: 0,
          hint: 'The first person needs no comparison: they start as the best.',
          explain: `Everyone after the first is compared once: ${L1_MAX.length} − 1 = ${maxScan(L1_MAX).comparisons}. For n items, max-so-far makes n − 1 comparisons.`,
        },
        {
          kind: 'task',
          title: 'Be the computer',
          body: 'Run max-so-far on this list in your head. Tap every number that becomes the new **best** (the first one counts).',
          widget: recordPicker(L1_REC),
          hint: 'A number becomes best when it’s bigger than everything to its left.',
          explain: `best is set at ${maxScan(L1_REC).records.map((k) => L1_REC[k]).join(', ')}: each is a new record. The others are smaller than some earlier number.`,
        },
        {
          kind: 'order',
          body: 'Put the steps of max-so-far in order.',
          items: ['Set best to the first item', 'Move to the next item', 'If it is bigger than best, set best to it', 'Repeat until no items are left', 'Report best'],
          hint: 'You need a starting value before you can compare anything.',
          explain: 'Start, then loop (move, compare, maybe update), then report. Report too early and you return a value that hasn’t seen the whole list; compare before setting best and there is nothing to compare with.',
        },
        {
          kind: 'read',
          title: 'Correct means every input',
          body: 'An algorithm that works on the examples you tried isn’t necessarily correct. The awkward inputs (empty, one item, all equal, all negative, already sorted) are where bugs live.\n\nHere is a version that looks fine and passes most tests.',
          widget: () => codeBlock('best = 0          # looks harmless\nfor x in a:\n    if x > best:\n        best = x\nreturn best', { marks: [1] }),
        },
        buggyStep,
        {
          kind: 'fill',
          body: 'Complete max-so-far in code. `a` is the list; `len(a)` is its length, and `range(1, k)` counts 1, 2, …, k − 1.',
          code: true,
          template: 'best = a[0]\nfor i in range(1, [[0]]):\n    if a[i] [[1]] best:\n        best = a[i]\nreturn best',
          blanks: [{ options: ['len(a)', 'len(a) - 1', 'best'], answer: 0 }, { options: ['>', '<', '=='], answer: 0 }],
          hint: 'The last index of a list of length n is n − 1, and range stops one before its end.',
          explain: '`range(1, len(a))` visits indices 1 to n − 1, every item after the first. `len(a) - 1` would skip the last item. And best changes when a[i] is **bigger**.',
        },
        {
          kind: 'read',
          title: 'Count steps, not seconds',
          body: 'Computers differ in speed, so we compare algorithms by **how many basic steps** they take as the input grows. Call the input size **n**.\n\nMax-so-far: n − 1 comparisons. Checking every pair (are any two equal?): many more.',
          widget: () => dataTable(['n', 'max-so-far', 'every pair'], [10, 100, 1000].map((n) => [n.toLocaleString('en-US'), maxScan(range(0, n)).comparisons.toLocaleString('en-US'), pairCount(n).toLocaleString('en-US')])),
        },
        {
          kind: 'match',
          body: `Each job runs on a list of **10** numbers. Match it to the comparisons it makes (worst case).`,
          heads: ['Job', 'Comparisons'],
          pairs: [
            ['Find the largest (max-so-far)', String(maxScan(ten).comparisons)],
            ['Check every pair for a duplicate', String(pairCount(10))],
            ['Look for 99 one item at a time (it isn’t there)', String(linearMiss(ten, 99))],
          ],
          hint: 'Searching for something missing means checking every item.',
          explain: `Max: n − 1 = ${maxScan(ten).comparisons}. Missing item: all n = ${linearMiss(ten, 99)}. Every pair: 9 + 8 + … + 1 = ${pairCount(10)}.`,
        },
        {
          kind: 'estimate',
          body: 'Checking every pair of **1,000** people for a shared birthday: about how many comparisons?',
          min: 0, max: 1_000_000, step: 500, answer: L1_PAIRS_1000 - (L1_PAIRS_1000 % 500), tol: 60_000,
          format: (v) => v.toLocaleString('en-US'),
          hint: 'About n × n, halved (each pair once).',
          explain: `1,000 × 999 / 2 = ${L1_PAIRS_1000.toLocaleString('en-US')}: half a million, while max-so-far on the same list needs 999. How the count grows with n is what separates algorithms.`,
        },
      ],
      practice: [genScanCount, genRecords, genBuggy],
    },

    // ------------------------------------------------------------ 2
    {
      id: 'search',
      title: 'Searching',
      goal: 'Find things fast by halving, and know why 20 guesses cover a million.',
      steps: [
        {
          kind: 'task',
          title: 'Guess my number',
          body: 'I’m thinking of a whole number from **1 to 100**. Guess it; I’ll say higher or lower. You get **7 guesses**.\n\nFair warning: I’m sneaky. If your guesses leave me room, I’ll use it.',
          widget: guessGame(100, 7),
          hint: 'Guess so that whatever I answer, as few numbers as possible remain. The middle of the range does that.',
          explain: 'Guessing the middle keeps at most half each time: 100 → 50 → 25 → 12 → 6 → 3 → 1, then the 7th guess names it. Any other guess lets me keep the bigger side.',
        },
        {
          kind: 'read',
          title: 'Halving',
          body: 'Each middle guess throws away half of what’s left. Starting from 100 numbers, the worst case shrinks like this:',
          widget: () => columnChart(L2_HALVES.map((v, k) => ({ label: k === 0 ? 'start' : `#${k}`, value: v }))),
        },
        {
          kind: 'number',
          body: 'Same game, but from **1 to 1,000**. Playing perfectly, how many guesses do you need in the worst case?',
          answer: worstProbes(1000), tol: 0,
          hint: 'Halve 1,000 (rounding down) until nothing is left, and count.',
          explain: `1000 → 500 → 250 → 125 → 62 → 31 → 15 → 7 → 3 → 1 → 0: ${worstProbes(1000)} guesses. Ten times the numbers cost only 3 more guesses.`,
        },
        {
          kind: 'read',
          title: 'Binary search',
          body: 'The same trick finds an item in a **sorted** list. Keep two markers, **lo** and **hi**, around the part that could still hold it. Probe the middle (**mid**); if it’s too small, the target is to the right, so lo = mid + 1. Too big: hi = mid − 1.\n\nWatch it look for 52.',
          widget: () => bsStepper(L2_ARR, 52),
        },
        {
          kind: 'point',
          body: `A binary search on indices 0–30 probed mid = 15 and found a value **smaller** than the target. So now lo = 16, hi = 30. Mark where the next probe goes. (mid = (lo + hi) // 2, rounding down.)`,
          plot: { x: [0, 30], ticks: [5] }, answer: { x: L2_MID.mid }, tol: 0.4, snap: 1,
          hint: 'Halfway between 16 and 30.',
          explain: `(16 + 30) // 2 = ${L2_MID.mid}: the middle of what’s left, not the middle of the whole list.`,
        },
        {
          kind: 'fill',
          body: 'Complete binary search. It returns the index of `target`, or −1 if it isn’t there.',
          code: true,
          template: 'lo, hi = 0, len(a) - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if a[mid] == target:\n        return mid\n    elif a[mid] < target:\n        lo = [[0]]\n    else:\n        hi = [[1]]\nreturn -1',
          blanks: [{ options: ['mid + 1', 'mid', 'mid - 1'], answer: 0 }, { options: ['mid - 1', 'mid', 'mid + 1'], answer: 0 }],
          hint: 'a[mid] has already been checked. Should it stay in the range?',
          explain: '`lo = mid + 1` and `hi = mid - 1` drop mid, which was just ruled out. With `lo = mid` the range can stop shrinking (lo = 3, hi = 4 gives mid = 3 again and again) and the loop never ends.',
        },
        {
          kind: 'estimate',
          body: 'Binary search in a sorted list of **1,000,000** names. Worst case, how many probes?',
          min: 0, max: 100, step: 1, answer: worstProbes(1_000_000), tol: 1,
          hint: 'Each probe halves. 2^10 is about a thousand.',
          explain: `${worstProbes(1_000_000)} probes: 2^20 ≈ 1,048,576 is just over a million. Linear search could need all 1,000,000 checks.`,
        },
        {
          kind: 'read',
          title: 'Logarithms count halvings',
          body: 'The number of times you can halve n before reaching 1 is about **log₂ n**. It grows absurdly slowly: doubling n adds just one step.',
          widget: () => dataTable(['items n', 'linear search (worst)', 'binary search (worst)'],
            [16, 1000, 1_000_000, 1_000_000_000].map((n) => [n.toLocaleString('en-US'), n.toLocaleString('en-US'), worstProbes(n)])),
        },
        {
          kind: 'choice',
          body: `A sorted list grows from 1,000 to 1,000,000 items (1,000× bigger). Binary search’s worst case was ${worstProbes(1000)} probes. Now it is…`,
          options: [
            { text: String(worstProbes(1_000_000)), correct: true },
            { text: '10,000', why: 'That’s 1,000× more, how linear search scales. Binary search only adds a step per doubling.' },
            { text: '11', why: 'That would be one doubling. 1,000× is about ten doublings (2^10 = 1,024).' },
            { text: '100', why: 'Ten doublings add ten probes, not ninety.' },
          ],
          ordered: true,
          explain: `1,000× ≈ 2^10, ten doublings, so ten more probes: ${worstProbes(1000)} → ${worstProbes(1_000_000)}.`,
        },
        {
          kind: 'multi',
          body: 'Which are true about binary search?',
          options: [
            { text: 'The list must be sorted', correct: true, why: 'Order is what tells you which half to throw away.' },
            { text: 'Doubling the list adds about one probe', correct: true, why: 'One more halving undoes the doubling.' },
            { text: 'It works on an unsorted list, just more slowly', why: 'On an unsorted list, throwing away a half can throw away the target. It gives wrong answers, not slow ones.' },
            { text: 'It always needs fewer checks than linear search', why: 'If the target happens to be first, linear search finds it in one check. Binary search wins the worst case, not every case.' },
          ],
          hint: 'Two are true.',
          explain: 'Binary search needs sorted data and costs about log₂ n probes. It beats linear search in the worst case and on average, not on every single input.',
        },
        {
          kind: 'sort',
          body: 'Can you halve, or must you check one by one? Sort the situations.',
          bins: ['Halving works', 'One by one'],
          items: [
            { text: 'Finding a word in a dictionary', bin: 0 },
            { text: 'Finding a receipt in a jumbled shoebox', bin: 1 },
            { text: 'Finding the first broken version in a history where every later one is broken too', bin: 0 },
            { text: 'Guessing an age when told “older” or “younger”', bin: 0 },
            { text: 'Finding a red sock in a drawer of mixed socks', bin: 1 },
            { text: 'Finding a name in an unsorted guest list', bin: 1 },
          ],
          hint: 'Halving needs order: one look must tell you which side the answer is on.',
          explain: 'Dictionaries are sorted, ages have higher/lower, and the broken versions form a block (good…good, bad…bad), so a probe tells you which half to keep. Jumbled boxes, drawers and unsorted lists give no such hint.',
        },
      ],
      practice: [genWorstProbes, genNextMid, genNewRange],
    },

    // ------------------------------------------------------------ 3
    {
      id: 'sorting',
      title: 'Sorting',
      goal: 'Sort by swapping, selecting and merging, and see why merge sort wins.',
      steps: [
        {
          kind: 'task',
          title: 'Sort it yourself',
          body: 'Put the bars in order, smallest on the left. The only move allowed: swap two **neighbours** (tap ⇄). Try to use as few swaps as you can.',
          widget: swapSorter(L3_SWAP),
          hint: 'Only swap a pair that is in the wrong order (a highlighted ⇄); a pair already in order never needs swapping.',
          explain: `${inversions(L3_SWAP)} swaps is the fewest: that’s how many pairs start out in the wrong order, and each neighbour swap fixes exactly one of them.`,
        },
        {
          kind: 'read',
          title: 'Insertion sort',
          body: 'What you just did, done systematically, is **insertion sort**: take each new item and slide it left past bigger neighbours until it fits. Each swap fixes one out-of-order pair, so it makes as many swaps as there are such pairs.',
          widget: () => sortStepper(insertionSort(L3_SWAP).frames),
        },
        {
          kind: 'number',
          body: 'With neighbour swaps only, what is the fewest number of swaps to sort the **reversed** list [6, 5, 4, 3, 2, 1]?',
          answer: inversions([6, 5, 4, 3, 2, 1]), tol: 0,
          hint: 'Every pair is out of order. How many pairs are there among 6 items?',
          explain: `All pairs are inverted: 5 + 4 + 3 + 2 + 1 = ${inversions([6, 5, 4, 3, 2, 1])}. A reversed list is the worst case: about n²/2 swaps.`,
        },
        {
          kind: 'read',
          title: 'Selection sort',
          body: 'Another simple method: **find the smallest** item, swap it to the front, then repeat on the rest. It always scans everything that’s left, so the comparisons don’t depend on the input.',
          widget: () => sortStepper(selectionSort(L3_DEMO).frames),
        },
        {
          kind: 'number',
          body: 'How many comparisons does selection sort make on a list of **10** items?',
          answer: selectionSort(range(0, 10)).comparisons, tol: 0,
          hint: 'Finding the smallest of 10 takes 9 comparisons, of the remaining 9 takes 8, …',
          explain: `9 + 8 + … + 1 = ${selectionSort(range(0, 10)).comparisons}, whatever order the items start in: n(n − 1)/2.`,
        },
        {
          kind: 'order',
          body: 'Selection sort runs on [3, 1, 4, 2]. Put the states of the list in the order it passes through them.',
          items: L3_ORDER,
          hint: 'Each pass swaps the smallest remaining item to the front of the unsorted part.',
          explain: `${L3_ORDER.join(' → ')}: first 1 comes to the front, then 2 into the second slot, then 3 into the third.`,
        },
        {
          kind: 'read',
          title: 'Merge sort: split, sort, zip',
          body: 'A cleverer idea. Split the list in half, sort each half (the same way), then **merge** the two sorted halves: compare their front items and take the smaller, again and again.\n\nThe highlighted block is the part just merged.',
          widget: () => sortStepper(mergeSort(L3_DEMO).frames),
        },
        {
          kind: 'fill',
          body: 'Complete the merge. `L` and `R` are sorted; `pop(0)` removes and returns the front item.',
          code: true,
          template: 'out = []\nwhile L and R:            # both still have items\n    if L[0] <= R[0]:\n        out.append(L.pop(0))\n    else:\n        out.append([[0]])\nreturn out + [[1]]',
          blanks: [{ options: ['R.pop(0)', 'L.pop(0)', 'R[0]'], answer: 0 }, { options: ['L + R', 'L', '[]'], answer: 0 }],
          hint: 'When the loop ends, one list is empty but the other may still hold items.',
          explain: 'If R’s front is smaller, move it: `R.pop(0)` (just `R[0]` would copy it without removing it, forever). At the end, whatever remains in L or R is already sorted and bigger than everything in out, so add `L + R`.',
        },
        {
          kind: 'number',
          body: 'Merge [1, 4, 7, 9] with [2, 3, 8]. How many comparisons?',
          answer: L3_MERGE, tol: 0,
          hint: 'Each comparison moves one item into the output; once a list is empty, the rest are copied for free.',
          explain: `1<2, 2<4, 3<4, 4<8, 7<8, 8<9: ${L3_MERGE} comparisons, then 9 is copied. Merging n items costs at most n − 1.`,
        },
        {
          kind: 'read',
          title: 'Why n log n',
          body: 'Halving n items down to single items takes about **log₂ n levels**. At each level, all the merges together touch each item once: about **n** comparisons. Total: about **n log₂ n**.\n\nThe green dots are merge sort’s actual comparison counts on shuffled lists. The curves are selection sort’s n(n − 1)/2 and n log₂ n (dashed).',
          widget: () => plotEl({ x: [0, 64], y: [0, 2100], size: [420, 300], xlabel: 'n', ylabel: 'comparisons', layers: [
            { type: 'fn', f: (n) => (n * (n - 1)) / 2, label: 'selection', color: 'var(--c4)' },
            { type: 'fn', f: (n) => (n > 0 ? n * Math.log2(n) : 0), label: 'n log n', dash: true, color: 'var(--c1)' },
            { type: 'dots', pts: L3_POINTS, color: 'var(--c3)', r: 4.5 },
          ] }),
        },
        {
          kind: 'estimate',
          body: 'Sorting **1,000,000** items: selection sort makes n(n − 1)/2, about half a trillion comparisons. About how many **million** comparisons does merge sort make?',
          min: 0, max: 200, step: 1, answer: Math.round((1e6 * Math.log2(1e6)) / 1e6), tol: 3, format: (v) => `${v} million`,
          hint: 'n × log₂ n, and log₂ of a million is about 20.',
          explain: `1,000,000 × log₂(1,000,000) ≈ 1,000,000 × 19.9 ≈ ${Math.round((1e6 * Math.log2(1e6)) / 1e6)} million (a real run makes a bit fewer). That’s 25,000 times fewer than selection sort’s half a trillion.`,
        },
        {
          kind: 'match',
          body: 'Match each sort to its idea.',
          heads: ['Sort', 'Idea'],
          pairs: [
            ['Selection sort', 'Pick the smallest remaining, put it next'],
            ['Insertion sort', 'Slide each new item back into place'],
            ['Merge sort', 'Sort two halves, then zip them together'],
            ['Bubble sort', 'Swap out-of-order neighbours, pass after pass'],
          ],
          explain: 'Selection selects, insertion inserts, merge merges, and bubble lets big items bubble to the end one neighbour swap at a time.',
        },
        {
          kind: 'choice',
          body: 'A list of 1,000 items is **already sorted**, but your program doesn’t know that. Which sort makes the fewest comparisons?',
          options: sortedChoice,
          hint: 'Which method stops early when an item is already in place?',
          explain: `Insertion sort compares each new item with its left neighbour, sees it’s in place and moves on: ${L3_SORTED.ins} comparisons. Merge sort needs ${L3_SORTED.mer.toLocaleString('en-US')} and selection sort ${L3_SORTED.sel.toLocaleString('en-US')}. The best algorithm depends on the input you expect.`,
        },
      ],
      practice: [genInversions, genMerge, genSelectionOrder],
    },

    // ------------------------------------------------------------ 4
    {
      id: 'growth',
      title: 'Growth rates',
      goal: 'Compare algorithms by how their step counts grow: log n, n, n log n, n², 2ⁿ.',
      steps: [
        {
          kind: 'choice',
          body: 'Algorithm A takes **100·n** steps on n items. Algorithm B takes **n²**. For a big input, n = 10,000, which finishes first?',
          options: [
            { text: 'A', correct: true },
            { text: 'B', why: `B is faster only while n < 100. At n = 10,000 it takes ${(1e8).toLocaleString('en-US')} steps against A’s ${(1e6).toLocaleString('en-US')}.` },
            { text: 'They take the same time', why: 'They are equal only at n = 100.' },
          ],
          ordered: true,
          explain: 'A: 1,000,000 steps. B: 100,000,000. A big constant (100) matters far less than a bigger power of n once n is large.',
        },
        {
          kind: 'read',
          title: 'Curves race',
          body: 'Drag the slider to zoom out. The vertical axis always fits n², so watch what happens to the others.',
          widget: plotExplorer({
            params: [{ id: 'N', label: 'n up to', min: 8, max: 64, step: 8, value: 16 }],
            spec: (v) => ({ x: [1, v.N], y: [0, v.N * v.N], size: [420, 300], xlabel: 'n', ylabel: 'steps', layers: [
              { type: 'fn', f: (n) => Math.log2(n), label: 'log n' },
              { type: 'fn', f: (n) => n, label: 'n' },
              { type: 'fn', f: (n) => n * Math.log2(n), label: 'n log n' },
              { type: 'fn', f: (n) => n * n, label: 'n²' },
              { type: 'fn', f: (n) => 2 ** n, label: '2ⁿ' },
            ] }),
            readout: (v) => `At n = ${v.N}: log₂ n = ${Math.log2(v.N).toFixed(0)}, n log n = ${num(v.N * Math.log2(v.N))}, n² = ${num(v.N * v.N)}, 2ⁿ = ${num(2 ** v.N)}`,
          }),
        },
        {
          kind: 'point',
          body: 'Here are A (100·n) and B (n²). Mark the input size n where B stops being the faster one.',
          plot: { x: [0, 200], y: [0, 30000], size: [420, 300], xlabel: 'n', ylabel: 'steps', layers: [
            { type: 'fn', f: (n) => 100 * n, label: '100n' }, { type: 'fn', f: (n) => n * n, label: 'n²' },
          ] },
          answer: { x: range(1, 201).find((n) => n * n >= 100 * n)! }, tol: 5, snap: 1,
          hint: 'Where are the two curves equal?',
          explain: 'n² = 100n when n = 100. Left of that the quadratic is cheaper; right of it, it loses by more and more, forever.',
        },
        {
          kind: 'read',
          title: 'Big-O: keep the fastest-growing term',
          body: 'For large n, only the fastest-growing term matters, and constant factors don’t change the shape. So 3n² + 50n + 7 is **O(n²)** (“order n squared”). Watch the smaller terms’ share vanish:',
          widget: () => dataTable(['n', '3n² + 50n + 7', 'from 3n²'], [10, 100, 1000, 10000].map((n) => {
            const all = 3 * n * n + 50 * n + 7;
            return [n.toLocaleString('en-US'), all.toLocaleString('en-US'), `${((3 * n * n) / all * 100).toFixed(1)}%`];
          })),
        },
        {
          kind: 'sort',
          body: 'Sort the jobs by how their work grows with the list size n.',
          bins: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
          items: [
            { text: 'Read the item at position 5', bin: 0 },
            { text: 'Binary search a sorted list', bin: 1 },
            { text: 'Add up every item', bin: 2 },
            { text: 'Find the largest item', bin: 2 },
            { text: 'Compare every pair of items', bin: 3 },
            { text: 'Selection sort', bin: 3 },
            { text: 'Look at the first item', bin: 0 },
          ],
          hint: 'O(1) doesn’t depend on n at all; O(log n) halves; O(n) touches each item once; O(n²) pairs items up.',
          explain: 'Position lookups are one step. Binary search halves. Sums and maxima visit each item once. Pairs and selection sort do about n²/2 comparisons.',
        },
        {
          kind: 'read',
          title: 'What doubling does',
          body: 'The quickest way to feel a growth rate: double n and see what happens to the steps.',
          widget: () => dataTable(['growth', 'n = 10', 'n = 20', 'change'], [
            ['log n', Math.log2(10).toFixed(1), Math.log2(20).toFixed(1), '+1'],
            ['n', 10, 20, '×2'],
            ['n²', 100, 400, '×4'],
            ['2ⁿ', (2 ** 10).toLocaleString('en-US'), (2 ** 20).toLocaleString('en-US'), 'squared'],
          ]),
        },
        {
          kind: 'match',
          body: 'When the input size **doubles**, the steps…',
          heads: ['Growth', 'Effect'],
          pairs: [['O(log n)', 'go up by one'], ['O(n)', 'double'], ['O(n²)', 'quadruple'], ['O(n³)', 'grow 8×'], ['O(2ⁿ)', 'get squared']],
          hint: '(2n)² = 4n². And 2^(2n) = (2ⁿ)².',
          explain: 'log₂(2n) = log₂ n + 1. 2n is double. (2n)² = 4n², (2n)³ = 8n³, and 2^(2n) = (2ⁿ)²: exponential growth squares itself.',
        },
        {
          kind: 'number',
          body: 'An O(n²) program takes **2 seconds** on 1,000 items. Roughly how long on **3,000**?',
          answer: 2 * (3000 / 1000) ** 2, unit: 's',
          hint: 'Three times the items; what does squaring do to 3?',
          explain: `3× the items, 3² = 9× the steps: 2 × 9 = ${2 * 9} seconds.`,
        },
        {
          kind: 'estimate',
          body: 'An O(2ⁿ) algorithm (it tries every subset) runs on a computer doing a **billion** steps a second. For n = 60, about how many **years**?',
          min: 0, max: 100, step: 1, answer: Math.round(2 ** 60 / 1e9 / (3600 * 24 * 365.25)), tol: 4, format: (v) => `${v} years`,
          hint: '2^10 ≈ 1,000, so 2^60 ≈ 10^18. A year is about 3 × 10^7 seconds.',
          explain: `2^60 ≈ 1.15 × 10^18 steps ÷ 10^9 per second ≈ 1.15 × 10^9 seconds ≈ ${Math.round(2 ** 60 / 1e9 / (3600 * 24 * 365.25))} years. At n = 70 it would be over 37,000 years.`,
        },
        {
          kind: 'multi',
          body: 'Which step counts are **O(n)**?',
          options: [
            { text: '5n + 3', correct: true, why: 'Linear: constants don’t count.' },
            { text: 'n / 2', correct: true, why: 'Half of n still grows in proportion to n.' },
            { text: 'n + log n', correct: true, why: 'log n grows slower than n, so n dominates.' },
            { text: '100', why: 'A fixed 100 steps, whatever n is: that’s O(1).' },
            { text: 'n² / 1000', why: 'The small constant only delays it: past n = 1000 it outgrows any linear count. O(n²).' },
            { text: 'n log n', why: 'log n keeps growing, so n log n outgrows every c·n eventually. It’s its own class.' },
          ],
          explain: 'O(n) means “at most a constant times n” for large n. 5n + 3, n/2 and n + log n qualify; a constant is smaller still; n²/1000 and n log n eventually beat any c·n.',
        },
        {
          kind: 'choice',
          body: 'Your O(2ⁿ) program handles n = 40 in an hour. You buy a computer **1,000× faster**. In an hour it now handles about…',
          options: [
            { text: 'n = 50', correct: true },
            { text: 'n = 40,000', why: 'That would be true of an O(n) program. Exponential growth eats speedups.' },
            { text: 'n = 1,265', why: 'That’s √1000 × 40, the gain an O(n²) program would get.' },
            { text: 'n = 41', why: 'One more item only doubles the work; 1,000× buys about ten doublings.' },
          ],
          ordered: true,
          explain: '1,000 ≈ 2^10, so the faster machine affords about 10 more items: n ≈ 50. For exponential algorithms, better hardware barely helps; a better algorithm is the only real fix.',
        },
      ],
      practice: [genScale, genCrossover, genBigO],
    },

    // ------------------------------------------------------------ 5
    {
      id: 'graphs',
      title: 'Graphs',
      goal: 'Model friendships, maps and dependencies as nodes and edges.',
      steps: [
        {
          kind: 'choice',
          body: 'A line means two people are friends. Who has the **most** friends?',
          widget: () => network(SOCIAL.nodes, SOCIAL.edges),
          options: ['Dee', 'Cal', 'Ben', 'Ana'].map((v): Choice => v === SOC_MAX ? { text: v, correct: true } : { text: v, why: `${v} has ${SOC_DEG[v]} friends; ${SOC_MAX} has ${SOC_DEG[SOC_MAX]}.` }),
          ordered: true,
          explain: `${SOC_MAX} has ${SOC_DEG[SOC_MAX]} lines: ${SOCIAL.edges.filter((e) => e.a === SOC_MAX || e.b === SOC_MAX).map((e) => (e.a === SOC_MAX ? e.b : e.a)).join(', ')}.`,
        },
        {
          kind: 'read',
          title: 'Nodes and edges',
          body: 'A **graph** is a set of **nodes** (dots) joined by **edges** (lines). The number of edges at a node is its **degree**, shown above each person here.\n\nGraphs model anything made of things and connections: people and friendships, places and roads, pages and links.',
          widget: () => network(SOCIAL.nodes, SOCIAL.edges, { nodeText: Object.fromEntries(Object.entries(SOC_DEG).map(([k, d]) => [k, String(d)])) }),
        },
        {
          kind: 'task',
          body: 'Tap every person with **exactly 2** friends.',
          widget: nodePicker(SOCIAL, SOC_TWO),
          hint: 'Count the lines at each node.',
          explain: `${SOC_TWO.join(', ')}: two lines each.`,
        },
        {
          kind: 'number',
          body: 'Add up the degrees of **all seven** people.',
          widget: () => network(SOCIAL.nodes, SOCIAL.edges),
          answer: SOC_SUM, tol: 0,
          hint: 'Or: count the lines, and think about how many ends each one has.',
          explain: `${SOCIAL.nodes.map((n) => SOC_DEG[n.id]).join(' + ')} = ${SOC_SUM}, exactly twice the ${SOCIAL.edges.length} edges.`,
        },
        {
          kind: 'read',
          title: 'The handshake rule',
          body: '**Sum of degrees = 2 × number of edges**, in every graph: each edge has two ends, and each end adds 1 to some node’s degree.\n\nSo the sum of degrees is always even, a quick way to spot impossible setups.',
        },
        {
          kind: 'choice',
          body: 'At a party of **9** people, could everyone shake hands with exactly **3** others?',
          options: [
            { text: 'No', correct: true },
            { text: 'Yes', why: 'The degrees would add to 9 × 3 = 27, an odd number. But every handshake has two ends, so the sum must be even.' },
            { text: 'Only if someone shakes their own hand', why: 'A self-handshake (a loop) isn’t shaking hands with another person, and the question rules it out.' },
          ],
          ordered: true,
          explain: '9 × 3 = 27 is odd, and a sum of degrees is always twice the number of handshakes. Impossible, however people arrange themselves.',
        },
        {
          kind: 'sort',
          body: 'To model each situation as a graph, what becomes a node and what becomes an edge?',
          bins: ['Node', 'Edge'],
          items: [
            { text: 'A city', bin: 0 },
            { text: 'A road between two cities', bin: 1 },
            { text: 'A person', bin: 0 },
            { text: 'A friendship', bin: 1 },
            { text: 'A web page', bin: 0 },
            { text: 'A link from one page to another', bin: 1 },
            { text: 'A school course', bin: 0 },
            { text: '“Take Algebra before Calculus”', bin: 1 },
          ],
          hint: 'Things are nodes; relationships between two things are edges.',
          explain: 'Cities, people, pages and courses are things (nodes). Roads, friendships, links and prerequisites connect two things (edges).',
        },
        {
          kind: 'read',
          title: 'Directed graphs',
          body: 'Some connections have a direction. A link goes from one page to another; a prerequisite comes before what it unlocks. Draw these as arrows: a **directed** graph.\n\nHere is how a piece of software gets built: an arrow means “must finish before”.',
          widget: () => network(BUILD.nodes, BUILD.edges),
        },
        {
          kind: 'order',
          body: 'Put the build steps in an order that respects every arrow.',
          widget: () => network(BUILD.nodes, BUILD.edges),
          items: BUILD_TOPO,
          hint: 'Start with the step that has no arrows coming in.',
          explain: `${BUILD_TOPO.join(' → ')}. Only fetch has no prerequisites; once it is done only build is ready; and so on. An order like this is called a **topological order**.`,
        },
        {
          kind: 'match',
          body: 'An **adjacency list** writes a graph as text: each node with its neighbours. Match each node to its list.',
          widget: () => network(SMALL.nodes, SMALL.edges),
          heads: ['Node', 'Neighbours'],
          pairs: SMALL.nodes.map((n): [string, string] => [n.id, SMALL_ADJ[n.id].map((a) => a.to).join(', ')]),
          explain: SMALL.nodes.map((n) => `${n.id}: ${SMALL_ADJ[n.id].map((a) => a.to).join(', ')}`).join('; ') + '. This is how programs usually store graphs.',
        },
        {
          kind: 'multi',
          body: 'Which are naturally **directed** graphs?',
          options: [
            { text: 'Who follows whom on a social app', correct: true, why: 'You can follow someone who doesn’t follow you back.' },
            { text: 'One-way streets', correct: true, why: 'Traffic only goes one way along each edge.' },
            { text: 'Course prerequisites', correct: true, why: '“Algebra before Calculus” isn’t the same as the reverse.' },
            { text: 'Friendships', why: 'Friendship goes both ways: undirected.' },
            { text: 'Countries that share a border', why: 'If A borders B, B borders A: undirected.' },
          ],
          explain: 'A relationship that can hold one way but not the other needs arrows. Symmetric ones (friendship, borders) are undirected.',
        },
        {
          kind: 'number',
          body: 'In a club of **10** people, everyone is friends with everyone else. How many friendships (edges)?',
          answer: pairCount(10), tol: 0,
          hint: 'Each person has 9 friends. How many times does that count each friendship?',
          explain: `10 × 9 = 90 ends, two per edge: ${pairCount(10)} edges. A graph with every possible edge is a **complete** graph: n(n − 1)/2 edges.`,
        },
      ],
      practice: [genDegree, genComplete, genHandshake],
    },

    // ------------------------------------------------------------ 6
    {
      id: 'paths',
      title: 'Shortest paths',
      goal: 'Find fewest-step routes with breadth-first search and shortest routes with Dijkstra.',
      steps: [
        {
          kind: 'task',
          title: 'Escape the maze',
          body: 'Walk from **S** to **E**, one square at a time (no diagonals). Find a route with the **fewest steps**.',
          widget: mazeWalk(MAZE_A),
          hint: 'The obvious route along the top isn’t the shortest. Try the left side.',
          explain: `The shortest route takes ${mazeDist(MA)[MA.e[0]][MA.e[1]]} steps: down the left side, then along the middle. The tempting route along the top takes longer.`,
        },
        {
          kind: 'read',
          title: 'Breadth-first search',
          body: 'How can a program be sure no route is shorter? **Breadth-first search (BFS)** explores in rings: first every square 1 step from S, then every square 2 steps away, and so on. A square gets its number the first time a ring reaches it, so that number is its shortest distance.',
          widget: () => mazeBfsStepper(MA),
        },
        {
          kind: 'number',
          body: 'A new maze. What is the fewest number of steps from S to E?',
          widget: () => mazeView(MB),
          answer: MB_DIST, tol: 0,
          hint: 'Number the squares outward from S: 1, 2, 3, … until you reach E.',
          explain: `Ring by ring, BFS reaches E at distance ${MB_DIST}.`,
        },
        {
          kind: 'order',
          body: 'BFS on a graph uses a **queue**: first in, first out. Starting from S, and adding each node’s new neighbours in alphabetical order, in what order are the nodes visited?',
          widget: () => network(HOPS.nodes, HOPS.edges),
          items: HOPS_BFS.order,
          hint: 'S’s neighbours join the queue first (alphabetically), then their neighbours, and so on.',
          explain: `${HOPS_BFS.order.join(', ')}. By distance: ${[0, 1, 2, 3].map((d) => `${d}: ${HOPS_BFS.order.filter((v) => HOPS_BFS.dist[v] === d).join(' ')}`).join(' · ')}. B is 2 away but comes after F because it was queued by D, which came out after A.`,
        },
        {
          kind: 'fill',
          body: 'Complete BFS. `dist` records each node’s distance from the start once found.',
          code: true,
          template: 'queue = [start]\ndist = {start: 0}\nwhile queue:\n    u = queue.[[0]]\n    for v in neighbours(u):\n        if v not in dist:\n            dist[v] = [[1]]\n            queue.append(v)',
          blanks: [{ options: ['pop(0)', 'pop()', 'clear()'], answer: 0 }, { options: ['dist[u] + 1', 'dist[v] + 1', '1'], answer: 0 }],
          hint: 'A queue serves the oldest entry first. A neighbour of u is one step further than u.',
          explain: '`pop(0)` takes the oldest entry, so nodes leave in order of distance. `pop()` takes the newest: that’s depth-first search, which can label nodes with long detours. v is one step beyond u: `dist[u] + 1` (dist[v] doesn’t exist yet).',
        },
        {
          kind: 'read',
          title: 'When roads have lengths',
          body: `Now edges carry lengths. BFS counts **edges**, so it finds the route with the fewest roads: ${ROADS_BFS.join(' → ')}, total ${pathWeight(ROADS, ROADS_BFS)}. Is that the shortest distance?`,
          widget: () => network(ROADS.nodes, ROADS.edges, { hiNodes: ROADS_BFS, hiEdges: pathEdges(ROADS_BFS) }),
        },
        {
          kind: 'task',
          body: `Tap towns to build a route from A to F that is as **short** as possible (in total length, not number of roads).`,
          widget: pathPicker(ROADS, 'A', 'F'),
          hint: 'A detour through C makes the trip to B cheaper.',
          explain: `${ROADS_BEST.join(' → ')} = ${ROADS_DJ.dist.F}. It uses ${ROADS_BEST.length - 1} roads, more than BFS’s ${ROADS_BFS.length - 1}, but is shorter overall.`,
        },
        {
          kind: 'choice',
          body: 'Why did BFS miss that route?',
          options: [
            { text: 'It counts roads, not their lengths', correct: true },
            { text: 'BFS only works on grids', why: 'BFS works on any graph; it found the fewest-roads route here correctly.' },
            { text: 'The graph has a cycle', why: 'BFS handles cycles fine: the “seen” check stops it revisiting nodes.' },
            { text: 'It started from the wrong node', why: 'It started at A, as asked.' },
          ],
          explain: 'BFS answers “fewest edges”. With lengths, a route with more but shorter roads can win, so we need an algorithm that adds up lengths.',
        },
        {
          kind: 'read',
          title: 'Dijkstra’s algorithm',
          body: 'Like BFS, but it grows outward by **distance** instead of by number of edges. Keep a best-known distance for every node (∞ at first). Repeatedly **settle** the unsettled node with the smallest distance, then check whether going through it gets any neighbour closer.\n\nSettled nodes are filled; numbers are best-known distances.',
          widget: () => dijkstraStepper(ROADS, 'A'),
        },
        {
          kind: 'number',
          body: 'Run Dijkstra in your head: what is the shortest distance from S to T?',
          widget: () => network(TOWN.nodes, TOWN.edges, { nodeText: { S: 'start', T: 'goal' } }),
          answer: TOWN_DJ.dist.T, tol: 0,
          hint: 'Settle S (0), then always the closest unsettled town. Note Q is close to S but leads nowhere cheap.',
          explain: `Settle order: ${TOWN_DJ.order.map((v) => `${v} ${TOWN_DJ.dist[v]}`).join(', ')}. Shortest route ${pathTo(TOWN_DJ.prev, 'S', 'T').join(' → ')}, length ${TOWN_DJ.dist.T}.`,
        },
        {
          kind: 'multi',
          body: 'Which are true?',
          options: [
            { text: 'BFS finds the fewest-edge route in any graph', correct: true, why: 'It explores ring by ring, by number of edges.' },
            { text: 'Once Dijkstra settles a node, its distance is final (with no negative lengths)', correct: true, why: 'Any other route would pass through an unsettled node that is already at least as far.' },
            { text: 'Dijkstra works even if some roads have negative length', why: 'A negative road could make a settled node closer later, breaking the “final” guarantee.' },
            { text: 'Following the first open path you see (depth-first) finds the shortest route', why: 'Depth-first search dives down one route; it can reach the goal by a long detour first.' },
          ],
          explain: 'BFS: fewest edges. Dijkstra: shortest total length, as long as no length is negative. Depth-first search finds a route, not necessarily a short one.',
        },
      ],
      practice: [genMaze, genDijkstra],
    },

    // ------------------------------------------------------------ 7
    {
      id: 'greedy',
      title: 'Greedy choices',
      goal: 'Take the best-looking step each time, and know when that fails.',
      steps: [
        {
          kind: 'task',
          title: 'Make change',
          body: 'Pay **68¢** using the **fewest coins**.',
          widget: coinMaker(US, 68),
          hint: 'Start with the biggest coin that fits.',
          explain: `${greedyCoins(US, 68).join(' + ')}: ${minCoins(US, 68)} coins.`,
        },
        {
          kind: 'read',
          title: 'Greedy',
          body: 'You probably used the **greedy** method: take the biggest coin that fits, then repeat on what’s left. A greedy algorithm makes the choice that looks best right now and never reconsiders.',
          widget: () => greedyStepper(US, 68),
        },
        {
          kind: 'number',
          body: 'Greedy pays **87¢** with 25¢, 10¢, 5¢ and 1¢ coins. How many coins?',
          answer: greedyCoins(US, 87).length, tol: 0,
          explain: `${greedyCoins(US, 87).join(' + ')}: ${greedyCoins(US, 87).length} coins.`,
        },
        {
          kind: 'task',
          title: 'A strange country',
          body: 'This country has only **25¢, 10¢ and 1¢** coins. Pay **30¢** with the fewest coins.',
          widget: coinMaker(ODD, 30),
          hint: 'Do you need the 25¢ at all?',
          explain: `Three 10¢ coins. Greedy grabs the 25¢ first and then needs five 1¢ coins: ${greedyCoins(ODD, 30).length} coins instead of ${minCoins(ODD, 30)}.`,
        },
        {
          kind: 'read',
          title: 'Greedy can fail',
          body: `Once greedy commits to the 25¢ it can’t take it back. With 25/10/1 coins it gives too many coins for ${ODD_FAILS.length} of the amounts from 1¢ to 99¢. Some of them:`,
          widget: () => dataTable(['amount', 'greedy', 'fewest'], ODD_FAILS.slice(0, 5).map((a) => [`${a}¢`, `${greedyCoins(ODD, a).length} coins`, `${minCoins(ODD, a)} coins`])),
        },
        {
          kind: 'multi',
          body: 'Coins of **1¢, 3¢ and 4¢**. For which amounts does greedy **fail** to use the fewest coins?',
          options: [5, 6, 7, 8, 10].map((a): Choice => {
            const g = greedyCoins(C134, a), m = minCoins(C134, a), fail = g.length > m;
            return { text: `${a}¢`, correct: fail, why: fail ? `Greedy: ${g.join(' + ')} (${g.length} coins), but ${m} will do.` : `Greedy: ${g.join(' + ')}, ${g.length} coins, already the fewest.` };
          }),
          ordered: true,
          hint: 'For each amount, run greedy, then look for something better using the 3¢ coin.',
          explain: [5, 6, 7, 8, 10].map((a) => `${a}¢: greedy ${greedyCoins(C134, a).length}, best ${minCoins(C134, a)}`).join('; ') + '. Greedy fails at 6¢ (3 + 3) and 10¢ (3 + 3 + 4).',
        },
        {
          kind: 'read',
          title: 'Booking a room',
          body: 'A different problem: one meeting room, many requests, and you want to hold **as many meetings as possible**. Two meetings can’t overlap (one may start the hour another ends).',
          widget: () => scheduleView(DAY),
        },
        {
          kind: 'task',
          body: 'Book as many meetings as you can. Tap to book or unbook.',
          widget: scheduler(DAY),
          hint: 'The long meeting A blocks a lot. Which meeting frees the room soonest?',
          explain: `${DAY_BEST} is the most: for example ${DAY_GREEDY.map((m) => m.name).join(', ')}.`,
        },
        {
          kind: 'choice',
          body: 'Which greedy rule **always** books the most meetings?',
          options: [
            { text: 'Repeatedly take the meeting that ends earliest (and doesn’t clash)', correct: true },
            { text: 'Repeatedly take the meeting that starts earliest', why: `Here it books A (8–12) first, which blocks B and C: it ends with ${DAY_EARLY.length} meetings (${DAY_EARLY.map((m) => m.name).join(', ')}), not ${DAY_BEST}.` },
            { text: 'Repeatedly take the shortest meeting', why: 'It happens to work today, but a short meeting can straddle two longer ones: 9–11 and 11–13 are both lost to a 10:30–11:30.' },
            { text: 'Take meetings in the order they were requested', why: 'Request order has nothing to do with fitting meetings together.' },
          ],
          explain: 'Ending earliest leaves the most room for everything else. Swap the first meeting of any best schedule for the earliest-ending one and nothing breaks, so greedy is never behind. This one is provably optimal.',
        },
        {
          kind: 'number',
          title: 'Packing a bag',
          body: `Your bag holds **10 kg**. Items: ${BAG.map((i) => `${i.name} ${i.kg} kg $${i.value}`).join(', ')}. Greedy by value per kg takes ${BAG_GREEDY.map((i) => i.name).join(' and ')} for $${BAG_GREEDY.reduce((s, i) => s + i.value, 0)}. What is the **most** value that actually fits?`,
          answer: BAG_BEST, unit: '$', tol: 0,
          hint: 'Try not taking the item with the best value per kg.',
          explain: `Camera + drone: 10 kg, $${BAG_BEST}. Greedy grabbed the laptop (best $/kg) and wasted the leftover space. Choosing best-ratio first fails when items can’t be split.`,
        },
        {
          kind: 'sort',
          body: 'Does the greedy rule always give the best answer?',
          bins: ['Greedy is optimal', 'Greedy can fail'],
          items: [
            { text: 'Change with 25/10/5/1¢ coins', bin: 0 },
            { text: 'Change with 4/3/1¢ coins', bin: 1 },
            { text: 'Most meetings, earliest finish first', bin: 0 },
            { text: 'Packing a bag by best value per kg', bin: 1 },
            { text: 'Dijkstra: settle the closest node next', bin: 0 },
            { text: 'Touring cities by always visiting the nearest unvisited one', bin: 1 },
          ],
          hint: 'Dijkstra is a greedy algorithm too, and it is proved correct.',
          explain: 'Greedy is optimal when a local best choice never blocks a better global answer (US coins, earliest finish, Dijkstra). Odd coin systems, unsplittable packing and nearest-city tours are classic failures.',
        },
        {
          kind: 'fill',
          body: 'Complete greedy change-making.',
          code: true,
          template: 'count = 0\nfor c in sorted(coins, reverse=True):   # biggest first\n    while amount >= [[0]]:\n        amount = amount - c\n        count = [[1]]\nreturn count',
          blanks: [{ options: ['c', 'count', '0'], answer: 0 }, { options: ['count + 1', 'count + c', 'c'], answer: 0 }],
          hint: 'Keep using coin c while it still fits; each use is one more coin.',
          explain: '`while amount >= c` keeps taking the coin while it fits; each time, one more coin: `count + 1`. (`count + c` would add up cents, not coins.)',
        },
      ],
      practice: [genUSCoins, genGreedyFails, genSchedule],
    },

    // ------------------------------------------------------------ 8
    {
      id: 'recursion',
      title: 'Recursion & dynamic programming',
      goal: 'Solve a problem from smaller copies of itself, and remember answers to avoid repeating work.',
      steps: [
        {
          kind: 'number',
          body: 'You climb a staircase of **5** stairs, taking **1 or 2** stairs at a time. How many different ways are there? (1 + 2 + 2 and 2 + 1 + 2 count as different.)',
          answer: stairs(5), tol: 0,
          hint: 'List them for 1, 2 and 3 stairs first. Do you see a pattern?',
          explain: `${stairs(5)} ways. For 1, 2, 3, 4 stairs: ${[1, 2, 3, 4].map((n) => stairs(n)).join(', ')}. Each is the sum of the two before it.`,
        },
        {
          kind: 'read',
          title: 'Think about the last move',
          body: 'Every climb of n stairs ends with a 1-step (after climbing n − 1) or a 2-step (after climbing n − 2). So\n\n**ways(n) = ways(n − 1) + ways(n − 2)**\n\nA problem solved from smaller copies of itself is **recursive**. Start from ways(0) = 1 (stand still) and ways(1) = 1.',
          widget: () => dataTable(['stairs n', ...range(0, 9).map(String)], [['ways', ...range(0, 9).map((n) => stairs(n))]]),
        },
        {
          kind: 'fill',
          body: 'Complete the recursive function.',
          code: true,
          template: 'def ways(n):\n    if n <= 1:\n        return [[0]]\n    return ways(n - 1) + [[1]]',
          blanks: [{ options: ['1', '0', 'n'], answer: 0 }, { options: ['ways(n - 2)', 'ways(n - 1)', '2'], answer: 0 }],
          hint: 'How many ways are there to climb 0 stairs? 1 stair?',
          explain: 'One way each for 0 and 1 stairs (return 1; `return n` would give 0 ways for 0 stairs). The last move was 1 or 2 stairs: `ways(n - 1) + ways(n - 2)`.',
        },
        {
          kind: 'read',
          title: 'The same work, again and again',
          body: 'That function is Fibonacci in disguise, and run as written it repeats itself. Here are all the calls fib(5) makes. The highlighted ones are fib(2), computed from scratch three times.',
          widget: () => fibTree(5, 2),
        },
        {
          kind: 'number',
          body: 'How many calls in total does the naive recursion make for **fib(10)**? (fib(0) and fib(1) return at once.)',
          answer: fibCalls(10), tol: 0,
          hint: 'calls(n) = 1 + calls(n − 1) + calls(n − 2), with calls(0) = calls(1) = 1. fib(5) made 15.',
          explain: `${range(0, 11).map((k) => fibCalls(k)).join(', ')}: fib(10) makes ${fibCalls(10)} calls. The count grows like Fibonacci itself, about 1.6× per step.`,
        },
        {
          kind: 'estimate',
          body: 'And for **fib(40)**? About how many **million** calls?',
          min: 0, max: 1000, step: 10, answer: Math.round(fibCallsBig(40) / 1e7) * 10, tol: 40, format: (v) => `${v} million`,
          hint: 'Each step up multiplies the calls by about 1.6. From fib(10) to fib(40) is 30 steps.',
          explain: `${fibCallsBig(40).toLocaleString('en-US')} calls, about ${Math.round(fibCallsBig(40) / 1e6)} million, to compute a number below 10^9. Exponential: about 1.618ⁿ.`,
        },
        {
          kind: 'read',
          title: 'Memoization: remember answers',
          body: '**Dynamic programming** is recursion that never solves the same subproblem twice: store each answer the first time and look it up after. fib(n) then needs just n + 1 computations.',
          widget: () => h('div', null,
            codeBlock('memo = {0: 0, 1: 1}\ndef fib(n):\n    if n not in memo:\n        memo[n] = fib(n - 1) + fib(n - 2)\n    return memo[n]', { marks: [3, 4] }),
            dataTable(['n', 'naive calls', 'with memo'], [10, 20, 30, 40].map((n) => [n, fibCallsBig(n).toLocaleString('en-US'), n + 1]))),
        },
        {
          kind: 'choice',
          body: 'With memoization, how does the work for fib(n) grow?',
          options: [
            { text: 'O(n)', correct: true },
            { text: 'O(2ⁿ)', why: 'That’s the naive version. With memo, each fib(k) is computed once and then looked up.' },
            { text: 'O(log n)', why: 'It still has to fill in every value from 0 to n; no halving happens.' },
            { text: 'O(n²)', why: 'Each new value costs one addition and two lookups, not a pass over all earlier values.' },
          ],
          ordered: true,
          explain: `n + 1 subproblems, constant work each: O(n). For fib(40), remembering turns ${fibCallsBig(40).toLocaleString('en-US')} calls into 41 computations.`,
        },
        {
          kind: 'read',
          title: 'Counting grid paths',
          body: 'A robot goes from the top-left square to the bottom-right, moving only **right or down**. The dark square is blocked. How many routes reach each square? The last move came from above or from the left, so\n\n**paths = paths above + paths to the left**\n\nFill the table one square at a time:',
          widget: () => gridPathsStepper(4, 5, GRID_BLOCK),
        },
        {
          kind: 'task',
          body: 'Now the blocked square is somewhere else. Type the number of routes into each of the three empty squares.',
          widget: gridPathsQuiz(4, 5, QUIZ_BLANKS, QUIZ_BLOCK),
          hint: 'Each number is the one above it plus the one to its left. Blocked squares count 0.',
          explain: QUIZ_EXPLAIN,
        },
        {
          kind: 'number',
          body: 'An empty **5 × 5** grid (no blocks). How many right/down routes go from the top-left square to the bottom-right?',
          answer: gridPaths(5, 5)[4][4], tol: 0,
          hint: 'Fill the table: the top row and left column are all 1s.',
          explain: `The table’s bottom-right square is ${gridPaths(5, 5)[4][4]}. (Every route is 4 rights and 4 downs in some order: choose which 4 of the 8 moves go right, C(8, 4) = 70.)`,
        },
        {
          kind: 'match',
          body: 'Match each problem to the way it is built from smaller ones.',
          heads: ['Problem', 'Recurrence'],
          pairs: [
            ['Climbing stairs, 1 or 2 at a time', 'ways(n) = ways(n−1) + ways(n−2)'],
            ['Right/down grid routes', 'paths(r, c) = paths(r−1, c) + paths(r, c−1)'],
            ['Merge sort’s comparisons', 'T(n) = 2·T(n/2) + n'],
            ['Binary search’s probes', 'T(n) = T(n/2) + 1'],
          ],
          hint: 'Merge sort solves two halves and merges; binary search solves one half.',
          explain: 'Stairs and grids add up overlapping smaller answers. Merge sort splits into two halves plus a linear merge; binary search keeps one half plus one probe.',
        },
        {
          kind: 'sort',
          body: 'Divide and conquer splits a problem into **separate** parts. Dynamic programming handles subproblems that **overlap** and repeat. Which is which?',
          bins: ['Divide & conquer', 'Dynamic programming'],
          items: [
            { text: 'Merge sort', bin: 0 },
            { text: 'Binary search', bin: 0 },
            { text: 'Fibonacci numbers', bin: 1 },
            { text: 'Ways to climb stairs', bin: 1 },
            { text: 'Counting grid routes', bin: 1 },
            { text: 'Finding the max by splitting the list in halves', bin: 0 },
          ],
          hint: 'Do the two halves ever need the same smaller answer?',
          explain: 'Merge sort’s halves share nothing, and neither do binary search’s or the max’s. Fibonacci, stairs and grids reuse the same smaller answers over and over, which is exactly what remembering them fixes.',
        },
      ],
      practice: [genStairs, genGrid, genFibCalls],
    },
  ],
};
