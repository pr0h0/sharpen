// Networks & Contagion: nodes and edges, the friendship paradox, hubs, small worlds, spreading and R,
// herd thresholds and targeting, cascades and tipping points, robustness. Every number in the text
// comes from running the graph algorithms and simulations in src/widgets/networks.ts.
import type { Choice, Course, Generator, Rng } from '../types';
import {
  COL, addBackup, addShortcut, adj, attackCurve, bridges, cascade, components, cutLink, cutNodes, deg, dist, edgeConnectivity,
  ek, extinction, granovetter, gridAdj, gridCascadeStepper, gridPic, gridSeeder, growthStepper, legend, meanClustering, mk,
  net, expectedOutbreak, pathStats, prefAttach, randomGraph, ringLattice, seedCascade, spreadStepper, sirWaves, tapNodes, tint, toG, treeG,
  vaccinate, waves,
} from '../widgets/networks';
import type { G } from '../widgets/networks';
import { h, num, pct, pick, randInt, seeded, shuffle } from '../ui';
import { plotEl } from '../viz/plot';
import { explorer } from '../viz/explore';
import { barChart, dataTable, iconArray } from '../viz/charts';
import { cells } from '../viz/cs';

const COLOR = '#d0457a';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const memo = <T,>(f: () => T): (() => T) => { let v: T | undefined; return () => (v ??= f()); };
const edgeList = (g: G) => g.edges.map(([a, b]) => `${a}–${b}`).join(', ');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Random connected graph on letters A.. (random tree plus `extra` more edges), laid out on a circle. */
function randG(rng: Rng, n: number, extra: number): G {
  const L = 'ABCDEFGHIJ'.slice(0, n).split('');
  const order = shuffle(rng, L);
  const nodes = L.map((id, k) => ({ id, x: +(50 + 42 * Math.cos(-Math.PI / 2 + (2 * Math.PI * k) / n)).toFixed(1), y: +(30 + 24 * Math.sin(-Math.PI / 2 + (2 * Math.PI * k) / n)).toFixed(1) }));
  const edges: [string, string][] = [];
  const has = (a: string, b: string) => edges.some(([x, y]) => ek(x, y) === ek(a, b));
  for (let i = 1; i < n; i++) edges.push([order[randInt(rng, 0, i - 1)], order[i]]);
  for (let t = 0, guard = 0; t < extra && guard < 200; guard++) {
    const a = pick(rng, L), b = pick(rng, L);
    if (a === b || has(a, b)) continue;
    edges.push([a, b]);
    t++;
  }
  edges.forEach((e) => e.sort());
  edges.sort((x, y) => (x[0] + x[1] < y[0] + y[1] ? -1 : 1));
  return { nodes, edges };
}

// ================================================================ 1. what a network is

const FR = mk({ Ann: [18, 30], Bo: [4, 13], Cy: [4, 47], Di: [24, 7], Ed: [24, 53], Fay: [44, 30], Gus: [66, 30], Hal: [84, 15], Ivy: [88, 42], Jo: [68, 54], Kim: [100, 2] },
  'Ann-Bo Ann-Cy Ann-Di Ann-Ed Ann-Fay Bo-Di Cy-Ed Fay-Gus Gus-Hal Gus-Ivy Gus-Jo Hal-Ivy Hal-Kim');
const FR_A = adj(FR), FR_D = deg(FR);
const FR_TOT = Object.fromEntries(Object.keys(FR_A).map((v) => [v, sum(Object.values(dist(FR_A, v)))]));
const FR_FAR = Object.fromEntries(Object.keys(FR_A).map((v) => [v, Math.max(...Object.values(dist(FR_A, v)))]));
const FR_MAX = Object.keys(FR_D).sort((a, b) => FR_D[b] - FR_D[a])[0];
const FR_CLOSE = Object.keys(FR_TOT).sort((a, b) => FR_TOT[a] - FR_TOT[b])[0];
const BO_KIM = dist(FR_A, 'Bo').Kim;
const GUS2 = Object.entries(dist(FR_A, 'Gus')).filter(([v, d]) => v !== 'Gus' && d <= 2).map(([v]) => v).sort();
const FR_DEGTXT = Object.fromEntries(Object.entries(FR_D).map(([k, d]) => [k, String(d)]));
const FR_PAIRS = (FR.nodes.length * (FR.nodes.length - 1)) / 2;

const genDegree: Generator = (rng) => {
  const g = randG(rng, randInt(rng, 5, 7), randInt(rng, 2, 4));
  const v = pick(rng, g.nodes).id;
  const d = deg(g)[v];
  return {
    kind: 'number',
    body: `A network has the links ${edgeList(g)}. What is the **degree** of ${v}?`,
    widget: () => net(g),
    answer: d, tol: 0,
    hint: `Count the links with ${v} at one end.`,
    explain: `${v} is linked to ${adj(g)[v].sort().join(', ')}: degree ${d}.`,
  };
};

const genEdges: Generator = (rng) => {
  const g = randG(rng, randInt(rng, 6, 9), randInt(rng, 1, 5));
  const ds = Object.values(deg(g)).sort((a, b) => b - a);
  return {
    kind: 'number',
    body: `The people in a network have these numbers of friends: ${ds.join(', ')}. How many friendships (edges) are there?`,
    answer: g.edges.length, tol: 0,
    hint: 'Every friendship has two ends, and each end counts once in someone’s total.',
    explain: `The degrees add to ${sum(ds)}. Each edge is counted twice (once from each end), so there are ${sum(ds)} ÷ 2 = ${g.edges.length} edges.`,
  };
};

const genHops: Generator = (rng) => {
  const g = randG(rng, randInt(rng, 6, 8), randInt(rng, 0, 2));
  const A = adj(g);
  const a = g.nodes[0].id;
  const d = dist(A, a);
  const far = Object.keys(d).filter((v) => d[v] >= 2);
  const b = far.length ? pick(rng, far) : Object.keys(d).find((v) => v !== a)!;
  return {
    kind: 'number',
    body: `Links: ${edgeList(g)}. What is the fewest number of hops from ${a} to ${b}?`,
    widget: () => net(g, { color: (v) => (v === a || v === b ? COL.hub : undefined) }),
    answer: d[b], tol: 0,
    hint: `List ${a}’s friends (1 hop), then their friends (2 hops), and so on.`,
    explain: `Spreading out from ${a} one hop at a time reaches ${b} after ${plural(d[b], 'hop')}.`,
  };
};

// ================================================================ 2. friendship paradox

const FP = mk({ Eve: [50, 30], Ana: [30, 8], Ben: [52, 4], Cat: [22, 44], Dan: [42, 56], Fin: [70, 8], Gil: [76, 34], Hu: [94, 20], Ida: [98, 48], Jay: [78, 56] },
  'Eve-Ana Eve-Ben Eve-Cat Eve-Dan Eve-Fin Eve-Gil Ana-Ben Fin-Gil Gil-Hu Hu-Ida Ida-Jay Jay-Hu');
const FP_A = adj(FP), FP_D = deg(FP);
const FP_N = FP.nodes.length;
const FP_MEAN = sum(Object.values(FP_D)) / FP_N;
const friendAvg = (A: Record<string, string[]>, D: Record<string, number>, v: string) => sum(A[v].map((u) => D[u])) / A[v].length;
const FP_FA = Object.fromEntries(Object.keys(FP_A).map((v) => [v, friendAvg(FP_A, FP_D, v)]));
const FP_FEWER = Object.keys(FP_A).filter((v) => FP_D[v] < FP_FA[v]).sort();
const FP_S1 = sum(Object.values(FP_D)), FP_S2 = sum(Object.values(FP_D).map((d) => d * d));
const FP_TXT = Object.fromEntries(Object.entries(FP_D).map(([k, d]) => [k, String(d)]));

const BA = memo(() => prefAttach(1000, 2, seeded(7)));
const BA_STATS = memo(() => {
  const ds = BA().map((x) => x.length);
  const s1 = sum(ds), s2 = sum(ds.map((d) => d * d));
  const sorted = ds.slice().sort((a, b) => b - a);
  return { mean: s1 / ds.length, friend: s2 / s1, max: sorted[0], top5: sum(sorted.slice(0, 50)) / s1, below: ds.filter((d) => d < s1 / ds.length).length / ds.length, median: sorted[500] };
});
const ER = memo(() => randomGraph(1000, sum(BA().map((x) => x.length)) / 2, seeded(7)));
const ER_STATS = memo(() => {
  const ds = ER().map((x) => x.length).sort((a, b) => b - a);
  return { max: ds[0], top5: sum(ds.slice(0, 50)) / sum(ds) };
});

const genStar: Generator = (rng) => {
  const k = randInt(rng, 4, 15);
  const s1 = 2 * k, s2 = k * k + k;
  return {
    kind: 'number',
    body: `A club has one organiser who is friends with all ${k} members, and the members know nobody else. List every member’s friends and every friend of the organiser, all in one long list. What is the **average number of friends** of the people on that list?`,
    answer: s2 / s1, tol: 0.01,
    hint: 'The organiser appears once in each member’s list; each member appears once, in the organiser’s list.',
    explain: `The list has ${s1} names: the organiser ${k} times (with ${k} friends each time) and each member once (1 friend). Average: (${k}×${k} + ${k}×1) ÷ ${s1} = ${num(s2 / s1)}, while the average person has only ${num(s1 / (k + 1))} friends.`,
  };
};

const genFriendList: Generator = (rng) => {
  const g = randG(rng, randInt(rng, 5, 7), randInt(rng, 1, 3));
  const D = Object.values(deg(g));
  const s1 = sum(D), s2 = sum(D.map((d) => d * d));
  return {
    kind: 'number',
    body: `Links: ${edgeList(g)}. Write down every person’s friends in one long list (a name appears once per friendship). What is the average number of friends of the people on the list?`,
    widget: () => net(g, { text: Object.fromEntries(Object.entries(deg(g)).map(([k, d]) => [k, String(d)])) }),
    answer: s2 / s1, tol: 0.01,
    hint: 'A person with d friends appears d times on the list, each time bringing d. So add up d² and divide by the sum of d.',
    explain: `Sum of degrees = ${s1}, sum of squared degrees = ${s2}. List average = ${s2} ÷ ${s1} ≈ ${num(s2 / s1)}, above the plain average of ${num(s1 / D.length)}.`,
  };
};

const genOneFriendAvg: Generator = (rng) => {
  const g = randG(rng, randInt(rng, 6, 7), randInt(rng, 2, 4));
  const A = adj(g), D = deg(g);
  const v = pick(rng, g.nodes.filter((n) => A[n.id].length >= 2)).id;
  const fa = friendAvg(A, D, v);
  return {
    kind: 'number',
    body: `Links: ${edgeList(g)}. On average, how many friends do **${v}’s friends** have?`,
    widget: () => net(g, { color: (u) => (u === v ? COL.hub : undefined) }),
    answer: fa, tol: 0.01,
    explain: `${v}’s friends are ${A[v].sort().map((u) => `${u} (${D[u]})`).join(', ')}. Average: ${sum(A[v].map((u) => D[u]))} ÷ ${A[v].length} ≈ ${num(fa)}, against ${v}’s own ${D[v]}.`,
  };
};

// ================================================================ 3. hubs

const TREE = memo(() => prefAttach(24, 1, seeded(5)));
const TREE_G = memo(() => treeG(TREE()));

/** Binary branching tree (generations 0..gens), coloured by generation. */
const BRANCH = (() => {
  const gens = 4, nodes: { id: string; x: number; y: number }[] = [], edges: [string, string][] = [];
  for (let g = 0; g <= gens; g++) for (let k = 0; k < 2 ** g; k++) {
    nodes.push({ id: `${g}.${k}`, x: +(((k + 0.5) / 2 ** g) * 100).toFixed(1), y: 3 + g * 13.5 });
    if (g) edges.push([`${g - 1}.${k >> 1}`, `${g}.${k}`]);
  }
  return { nodes, edges } as G;
})();
const GEN_COL = ['var(--c1)', 'var(--c3)', 'var(--c5)', 'var(--c2)', 'var(--bad)'];

const genAttach: Generator = (rng) => {
  const ds = Array.from({ length: randInt(rng, 3, 5) }, () => randInt(rng, 1, 9));
  const k = randInt(rng, 0, ds.length - 1);
  const names = 'PQRSTU'.slice(0, ds.length).split('');
  return {
    kind: 'number', prob: true,
    body: `Existing sites ${names.map((n, i) => `${n} (${ds[i]} links)`).join(', ')}. A new site links to one of them, chosen in proportion to links. What is the chance it picks **${names[k]}**?`,
    answer: ds[k] / sum(ds), tol: 0.005,
    hint: 'Its share of all the links.',
    explain: `${names[k]} holds ${ds[k]} of the ${sum(ds)} links: ${ds[k]}/${sum(ds)} ≈ ${pct(ds[k] / sum(ds))}.`,
  };
};

const genTail: Generator = (rng) => {
  const k1 = pick(rng, [5, 10, 20]), mult = pick(rng, [2, 3, 4, 5, 10]), p = pick(rng, [2, 4, 5, 8, 10, 20]) / 100;
  const a = pick(rng, [1, 2]);
  const ans = p * Math.pow(1 / mult, a);
  return {
    kind: 'number', prob: true,
    body: `In a heavy-tailed network the share of nodes with at least k links falls like 1/k${a === 2 ? '²' : ''}. If ${pct(p, 0)} of nodes have at least ${k1} links, what share have at least **${k1 * mult}**?`,
    answer: ans, tol: Math.max(ans * 0.02, 1e-6),
    hint: `k grew ${mult}-fold, so the share shrinks by ${mult}${a === 2 ? '²' : ''}.`,
    explain: `${pct(p, 0)} × (1/${mult})${a === 2 ? '²' : ''} = ${pct(ans, 3)}. Rare, but in a bell-shaped distribution it would be essentially zero.`,
  };
};

const genMeanMedian: Generator = (rng) => {
  const small = Array.from({ length: randInt(rng, 6, 8) }, () => randInt(rng, 1, 4));
  const hub = randInt(rng, 25, 60);
  const ds = [...small, hub].sort((a, b) => a - b);
  const mean = sum(ds) / ds.length;
  const med = ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2;
  const askMean = rng() < 0.5;
  return {
    kind: 'number',
    body: `Degrees in a small network: ${ds.join(', ')}. What is the **${askMean ? 'mean' : 'median'}** degree?`,
    answer: askMean ? mean : med, tol: 0.01,
    explain: `Mean = ${sum(ds)} ÷ ${ds.length} ≈ ${num(mean)}; median (middle value) = ${num(med)}. One hub drags the mean far above the typical node.`,
  };
};

// ================================================================ 4. small worlds

const R20 = ringLattice(20, 2);
const R12 = ringLattice(12, 1);
const R12_FAR = Math.max(...Object.values(dist(adj(R12), '1')));
const R20_OPP = dist(adj(R20), '1')['11'];

/** Random shortcuts between nodes at least 3 apart on a ring of n ("1".."n"), in a fixed order. */
function shortcuts(n: number, count: number, rng: Rng): [string, string][] {
  const out: [string, string][] = [];
  while (out.length < count) {
    const a = 1 + Math.floor(rng() * n), b = 1 + Math.floor(rng() * n);
    const d = Math.min(Math.abs(a - b), n - Math.abs(a - b));
    if (d < 3 || out.some(([x, y]) => ek(x, y) === ek(String(a), String(b)))) continue;
    out.push([String(a), String(b)]);
  }
  return out;
}
const SC30 = shortcuts(30, 10, seeded(11));
const R30 = ringLattice(30, 2);
const SW200 = memo(() => {
  const base = ringLattice(200, 2), sc = shortcuts(200, 40, seeded(11));
  return Array.from({ length: 21 }, (_, i) => {
    const A = adj({ nodes: base.nodes, edges: [...base.edges, ...sc.slice(0, 2 * i)] });
    return { s: 2 * i, L: pathStats(A).mean, C: meanClustering(A) };
  });
});

const genReach: Generator = (rng) => {
  const k = pick(rng, [20, 30, 40, 50, 80, 100, 150, 200]);
  const target = pick(rng, [1e6, 1e7, 1e8, 1e9, 8e9]);
  let s = 0, r = 1;
  while (r < target) { r *= k; s++; }
  return {
    kind: 'number',
    body: `Suppose everyone has ${k} acquaintances and nobody’s circles overlap. How many steps out from you before you could reach **${target.toLocaleString('en-US')}** people?`,
    answer: s, tol: 0,
    hint: `After s steps you reach about ${k}^s people.`,
    explain: `${k}^${s - 1} = ${Math.pow(k, s - 1).toLocaleString('en-US')} is too few; ${k}^${s} = ${Math.pow(k, s).toLocaleString('en-US')} is enough. So ${s} steps. Real circles overlap a lot, which is why shortcuts matter.`,
  };
};

const genClustering: Generator = (rng) => {
  const d = randInt(rng, 3, 7);
  const pairs = (d * (d - 1)) / 2;
  const t = randInt(rng, 0, pairs);
  return {
    kind: 'number', prob: true,
    body: `Mo has ${d} friends. Among them, ${plural(t, 'pair')} are friends with each other. What is Mo’s **clustering** (the share of pairs of Mo’s friends who are friends)?`,
    answer: t / pairs, tol: 0.005,
    hint: `${d} friends make ${d} × ${d - 1} ÷ 2 pairs.`,
    explain: `${d} friends form ${pairs} pairs; ${t} are linked: ${t}/${pairs} ≈ ${pct(t / pairs)}.`,
  };
};

const genRingDiam: Generator = (rng) => {
  const n = randInt(rng, 10, 40), hh = randInt(rng, 1, 4);
  const ans = Math.ceil(Math.floor(n / 2) / hh);
  return {
    kind: 'number',
    body: `${n} people sit in a circle, and each knows the ${hh === 1 ? 'person' : hh + ' people'} on each side. What is the most hops any message must take between two of them?`,
    answer: ans, tol: 0,
    hint: `The furthest person is ${Math.floor(n / 2)} seats away, and one hop covers up to ${hh} seat${hh === 1 ? '' : 's'}.`,
    explain: `The furthest pair is ${Math.floor(n / 2)} seats apart; ${Math.floor(n / 2)} ÷ ${hh} rounded up = ${ans} hops.`,
  };
};

// ================================================================ 5. spreading and R

const SPREAD = toG(randomGraph(16, 24, seeded(4)), seeded(4));
const SPREAD_W = sirWaves(SPREAD, '1', 0.5, seeded(3));

/** Poisson sample (Knuth). */
function poisson(rng: Rng, lam: number): number {
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
/** 50 chains from one case, each case infecting Poisson(R): did each die out before reaching 200 cases? */
const CHAINS = (() => {
  const rng = seeded(21);
  return Array.from({ length: 50 }, () => {
    let cur = 1, total = 1;
    while (cur > 0 && total < 200) { let next = 0; for (let i = 0; i < cur; i++) next += poisson(rng, 1.5); cur = next; total += next; }
    return cur === 0;
  });
})();
const CHAINS_DIED = CHAINS.filter((x) => x).length;

const casesPlot = (R: number, start: number, gens = 8) => plotEl({
  x: [-0.6, gens + 0.6], y: [0, 100], size: [360, 240], xlabel: 'generation', ylabel: 'new cases', ticks: [1, 20],
  layers: [{ type: 'bars', pts: Array.from({ length: gens + 1 }, (_, g) => [g, start * Math.pow(R, g)] as [number, number]), width: 0.7, color: R > 1 + 1e-9 ? 'var(--bad)' : R < 1 - 1e-9 ? 'var(--good)' : 'var(--c1)' }],
});

const genGenerations: Generator = (rng) => {
  const R = pick(rng, [1.5, 2, 2.5, 3, 4]), g = randInt(rng, 3, 7), c0 = pick(rng, [1, 2, 5, 10]);
  const v = c0 * Math.pow(R, g);
  return {
    kind: 'number',
    body: `Each case infects ${R} others on average. Generation 0 is ${plural(c0, 'case')}. About how many **new** cases are there in generation ${g}?`,
    answer: v, tol: Math.max(0.5, v * 0.01),
    explain: `Each generation multiplies by R: ${c0} × ${R}^${g} = ${num(v, 4)}.`,
  };
};

const genTotal: Generator = (rng) => {
  const R = pick(rng, [0.2, 0.25, 0.5, 0.6, 0.75, 0.8, 0.9]), c0 = pick(rng, [10, 20, 50, 100, 200]);
  const tot = c0 / (1 - R);
  return {
    kind: 'number',
    body: `${c0} cases arrive in a town where R = ${R}. Counting those first ${c0}, how many cases will there be in total before the chains die out (on average)?`,
    answer: tot, tol: Math.max(0.5, tot * 0.01),
    hint: `${c0} + ${c0}×${R} + ${c0}×${R}² + … is a geometric series: first term ÷ (1 − R).`,
    explain: `${c0} ÷ (1 − ${R}) = ${num(tot, 4)}. R below 1 still means more cases, just a finite number.`,
  };
};

const genContactsR: Generator = (rng) => {
  const c = randInt(rng, 2, 15), p = pick(rng, [0.02, 0.04, 0.05, 0.1]), D = randInt(rng, 2, 10);
  const R = c * p * D;
  if (Math.abs(R - 1) < 1e-9) return genContactsR(rng);
  return {
    kind: 'choice',
    body: `Someone infectious meets ${c} people a day, infects each with probability ${p}, and stays infectious for ${D} days. Will an outbreak grow or shrink?`,
    options: [
      { text: `Grow: R = ${num(R)}`, correct: R > 1, why: R > 1 ? undefined : `R = ${c} × ${p} × ${D} = ${num(R)}, below 1.` },
      { text: `Shrink: R = ${num(R)}`, correct: R < 1, why: R < 1 ? undefined : `R = ${c} × ${p} × ${D} = ${num(R)}, above 1.` },
      { text: 'Can’t tell without the population size', why: 'Early in an outbreak, when nearly everyone is susceptible, R depends only on contacts, chance per contact and duration.' },
    ],
    explain: `R = contacts per day × chance per contact × days infectious = ${c} × ${p} × ${D} = ${num(R)}, so it ${R > 1 ? 'grows' : 'shrinks'}.`,
  };
};

// ================================================================ 6. herd thresholds

const VAC = mk({ A: [46, 30], B: [38, 46], C: [58, 44], H: [24, 22], K: [74, 22], a: [6, 8], b: [20, 3], c: [3, 30], d: [36, 7], e: [12, 50], f: [96, 10], g: [84, 3], h: [97, 32], i: [62, 6], j: [88, 50] },
  'A-B A-C B-C A-H B-H C-K B-K H-K H-a H-b H-c H-d H-e K-f K-g K-h K-i K-j a-b f-g e-c');
const VAC_ALL = waves(VAC, ['A']).flat().length;
const VAC_LIMIT = 3;

const VAC_CURVES = memo(() => {
  const A = prefAttach(500, 2, seeded(3)), n = A.length;
  const byDeg = A.map((_, i) => i).sort((a, b) => A[b].length - A[a].length || a - b);
  const fr = Array.from({ length: 11 }, (_, i) => i * 0.03);
  const run = (mode: 'random' | 'friend' | 'hubs') => fr.map((v) => {
    const rng = seeded(99), k = Math.round(v * n);
    let tot = 0;
    const runs = 40;
    for (let r = 0; r < runs; r++) {
      let imm: Set<number>;
      if (mode === 'hubs') imm = new Set(byDeg.slice(0, k));
      else if (mode === 'random') imm = new Set(shuffle(rng, A.map((_, i) => i)).slice(0, k));
      else { imm = new Set(); while (imm.size < k) { const p = Math.floor(rng() * n); imm.add(A[p][Math.floor(rng() * A[p].length)]); } }
      tot += expectedOutbreak(A, 0.35, imm, rng);
    }
    return [v * 100, (tot / runs) * 100] as [number, number];
  });
  return { random: run('random'), friend: run('friend'), hubs: run('hubs') };
});

const genHerd: Generator = (rng) => {
  const R0 = pick(rng, [1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 18]);
  return {
    kind: 'number', prob: true,
    body: `A disease has R0 = ${R0} in a population with no immunity. What fraction must be immune for outbreaks to shrink?`,
    answer: 1 - 1 / R0, tol: 0.006,
    hint: 'Each case infects R0 × (share still susceptible). Set that to 1.',
    explain: `R0 × (1 − v) = 1 gives v = 1 − 1/R0 = 1 − 1/${R0} ≈ ${pct(1 - 1 / R0)}.`,
  };
};

const genReff: Generator = (rng) => {
  const R0 = pick(rng, [2, 3, 4, 5, 6, 8]), v = randInt(rng, 2, 18) * 5 / 100;
  const Re = R0 * (1 - v);
  if (Math.abs(Re - 1) < 1e-9) return genReff(rng);
  return {
    kind: 'choice',
    body: `R0 = ${R0}, and ${pct(v, 0)} of people are immune (mixing at random). What happens to an outbreak?`,
    options: [
      { text: 'It grows', correct: Re > 1, why: Re > 1 ? undefined : `Each case now infects ${R0} × ${num(1 - v)} = ${num(Re)} people, fewer than 1.` },
      { text: 'It shrinks', correct: Re < 1, why: Re < 1 ? undefined : `Each case still infects ${R0} × ${num(1 - v)} = ${num(Re)} people, more than 1.` },
      { text: 'It stops at once', why: 'Even above the threshold, chains continue for a few generations before dying out.' },
    ],
    explain: `Effective R = ${R0} × (1 − ${num(v)}) = ${num(Re)}. The threshold is 1 − 1/${R0} ≈ ${pct(1 - 1 / R0, 0)}.`,
  };
};

const genEfficacy: Generator = (rng) => {
  const R0 = pick(rng, [1.5, 2, 2.5, 3, 4]), e = pick(rng, [0.8, 0.85, 0.9, 0.95]);
  const cov = (1 - 1 / R0) / e;
  return {
    kind: 'number', prob: true,
    body: `R0 = ${R0}. A vaccine makes ${pct(e, 0)} of vaccinated people immune. What share of the population must be vaccinated to reach the herd threshold?`,
    answer: cov, tol: 0.006,
    hint: 'Immune share = coverage × efficacy.',
    explain: `Need ${pct(1 - 1 / R0)} immune; coverage × ${e} = ${num(1 - 1 / R0)} gives coverage ≈ ${pct(cov)}.`,
  };
};

// ================================================================ 7. cascades

const CAS = mk({ A: [8, 10], B: [35, 6], C: [65, 8], D: [92, 12], E: [18, 32], F: [48, 28], G: [80, 32], H: [6, 52], I: [34, 54], J: [62, 52], K: [94, 52] },
  'A-E B-C B-E C-D D-G E-F E-I F-I F-J G-K H-I I-J');
const CAS_A = adj(CAS);
const halfRule = (_v: string, d: number) => Math.ceil(d / 2 - 1e-9);
const CAS_WIN = Object.keys(CAS_A).filter((v) => new Set(cascade(CAS_A, [v], halfRule).flat()).size === CAS.nodes.length).sort();
const CAS_E = new Set(cascade(CAS_A, ['E'], halfRule).flat());
const STALL = gridAdj(6, 6);
const STALL_SEEDS = ['0,0', '1,1', '2,2', '4,4'];
const STALL_ON = cascade(STALL, STALL_SEEDS, () => 2).flat().length;
const GRAN = Array.from({ length: 100 }, (_, i) => i);
const GRAN2 = GRAN.map((t) => (t === 1 ? 2 : t));
// 5 x 5 picture for "will it adopt?"
const Q_ON = ['1,1', '1,2', '2,1', '3,3', '0,4', '2,4'];
const Q_CELLS: Record<string, string> = { '2,2': 'P', '0,2': 'Q', '2,3': 'R', '1,4': 'S', '3,2': 'T', '4,0': 'U' };
const Q_A = gridAdj(5, 5);
const qCount = (k: string) => Q_A[k].filter((u) => Q_ON.includes(u)).length;

const genGran: Generator = (rng) => {
  const n = randInt(rng, 8, 12);
  const t = Array.from({ length: n }, () => randInt(rng, 0, Math.floor(n / 2))).sort((a, b) => a - b);
  if (!t.includes(0)) t[0] = 0;
  const ans = granovetter(t);
  return {
    kind: 'number',
    body: `${n} people each join a protest once at least that many others have joined. Their thresholds: ${t.join(', ')}. How many end up joining?`,
    answer: ans, tol: 0,
    hint: 'Start with the 0s. Then count everyone whose threshold is at most the number in so far; repeat until nothing changes.',
    explain: `Repeatedly count thresholds ≤ the number already in: the count settles at ${ans}.${ans < n ? ` The next threshold needed is ${t[ans]}, but only ${ans} have joined.` : ' Everyone joins.'}`,
  };
};

const genAdopt: Generator = (rng) => {
  const d = randInt(rng, 2, 9), a = randInt(rng, 0, d), th = pick(rng, [0.25, 0.3, 0.4, 0.5, 0.6, 0.75]);
  const yes = a / d >= th - 1e-9;
  return {
    kind: 'choice',
    body: `Rule: adopt once at least ${pct(th, 0)} of your friends have. Lee has ${d} friends and ${a} of them have adopted. Does Lee adopt?`,
    options: [
      { text: 'Yes', correct: yes, why: yes ? undefined : `${a} of ${d} is ${pct(a / d, 0)}, below ${pct(th, 0)}.` },
      { text: 'No', correct: !yes, why: !yes ? undefined : `${a} of ${d} is ${pct(a / d, 0)}, which reaches ${pct(th, 0)}.` },
    ],
    explain: `${a}/${d} = ${pct(a / d, 0)} ${yes ? '≥' : '<'} ${pct(th, 0)}, so ${yes ? 'yes' : 'no'}.`,
  };
};

const genGridFinal: Generator = (rng) => {
  const R = 5, C = 5;
  const k = randInt(rng, 3, 6);
  const all = Array.from({ length: R * C }, (_, i) => `${Math.floor(i / C)},${i % C}`);
  const seeds = shuffle(rng, all).slice(0, k).sort();
  const on = cascade(gridAdj(R, C), seeds, () => 2).flat();
  return {
    kind: 'number',
    body: `On a 5 × 5 grid, a cell adopts once at least 2 of its 4 neighbours have. Seeds (row, column from 0): ${seeds.map((s) => `(${s})`).join(' ')}. How many cells adopt in the end, seeds included?`,
    widget: () => gridPic(R, C, Object.fromEntries(seeds.map((s) => [s, COL.hub]))),
    answer: on.length, tol: 0,
    hint: 'Look for empty cells with two adopted neighbours, fill them, and repeat.',
    explain: `Filling cells with two adopted neighbours until none are left gives ${on.length} of 25. A cascade fills out rectangles around nearby seeds and then stops.`,
  };
};

// ================================================================ 8. robustness

const BR = mk({ A: [8, 14], B: [26, 4], C: [6, 46], D: [28, 32], E: [44, 52], F: [60, 28], G: [76, 6], H: [96, 18], I: [78, 50], J: [96, 46] },
  'A-B A-C A-D B-D C-D C-E D-E E-F F-G F-I G-H H-J I-J G-I');
const BR_BRIDGE = bridges(BR)[0];
const BR_CUT = cutNodes(BR).sort();
const TR = mk({ A: [32, 12], B: [54, 12], C: [54, 42], D: [32, 42], E: [14, 54], F: [4, 28], G: [76, 26], H: [96, 44] }, 'A-B B-C C-D D-A D-E E-F B-G G-H');
const TR_BR = bridges(TR);
const SHAPE_G: { name: string; short: string; g: G }[] = [
  { name: 'A star: one hub with 5 others', short: 'star', g: mk({ H: [50, 30], a: [50, 5], b: [80, 20], c: [70, 55], d: [30, 55], e: [20, 20] }, 'H-a H-b H-c H-d H-e') },
  { name: 'A ring of 6', short: 'ring', g: ringLattice(6, 1) },
  { name: 'A wheel: a ring of 5 plus a hub', short: 'wheel', g: mk({ H: [50, 30], a: [50, 5], b: [80, 20], c: [70, 55], d: [30, 55], e: [20, 20] }, 'H-a H-b H-c H-d H-e a-b b-c c-d d-e e-a') },
  { name: '5 nodes, every pair linked', short: 'all pairs linked', g: mk({ a: [50, 5], b: [80, 20], c: [70, 55], d: [30, 55], e: [20, 20] }, 'a-b a-c a-d a-e b-c b-d b-e c-d c-e d-e') },
];
const SHAPES = SHAPE_G.map((s) => ({ name: s.name, short: s.short, k: edgeConnectivity(s.g) })).sort((x, y) => x.k - y.k);

const ATTACK = memo(() => ({ random: attackCurve(BA(), 'random', seeded(5)), hubs: attackCurve(BA(), 'hubs', seeded(5)), erHubs: attackCurve(ER(), 'hubs', seeded(5)) }));
const firstBelow = (c: [number, number][], y: number) => c.find((p) => p[1] < y)![0];

const genReliable: Generator = (rng) => {
  const p = pick(rng, [0.8, 0.85, 0.9, 0.95, 0.99]), len = randInt(rng, 1, 4), routes = randInt(rng, 1, 3);
  if (len === 1 && routes === 1) return genReliable(rng);
  const one = Math.pow(p, len), ans = 1 - Math.pow(1 - one, routes);
  return {
    kind: 'number', prob: true,
    body: `Each link works ${pct(p, 0)} of the time, independently. A and B are joined by ${routes === 1 ? 'one route' : routes + ' separate routes'}, each ${plural(len, 'link')} long. What is the chance A can still reach B?`,
    answer: ans, tol: 0.005,
    hint: 'A route works only if all its links do (multiply). The connection fails only if every route fails.',
    explain: `One route works with ${p}^${len} ≈ ${num(one, 4)}.${routes > 1 ? ` All ${routes} fail with (1 − ${num(one, 4)})^${routes}; so the chance at least one works is ≈ ${num(ans, 4)}.` : ''} That is ≈ ${pct(ans)}.`,
  };
};

const genBridges: Generator = (rng) => {
  const g = randG(rng, randInt(rng, 6, 8), randInt(rng, 1, 3));
  const b = bridges(g);
  return {
    kind: 'number',
    body: `Links: ${edgeList(g)}. How many of these links are **bridges** (cutting it alone splits the network)?`,
    widget: () => net(g),
    answer: b.length, tol: 0,
    hint: 'A link is a bridge exactly when it is not part of any loop.',
    explain: b.length ? `The bridges are ${b.map((k) => k.replace('|', '–')).join(', ')}: none of them lies on a loop. Every other link has a way round.` : 'None: every link lies on a loop, so there is always a way round.',
  };
};

const genPieces: Generator = (rng) => {
  const g = randG(rng, randInt(rng, 6, 8), randInt(rng, 0, 2));
  const v = pick(rng, g.nodes).id;
  const parts = components(adj(g, [v])).length;
  return {
    kind: 'number',
    body: `Links: ${edgeList(g)}. If node ${v} fails, into how many separate pieces does the rest fall?`,
    widget: () => net(g, { color: (u) => (u === v ? COL.sick : undefined) }),
    answer: parts, tol: 0,
    hint: `Delete ${v} and its links, then see who can still reach whom.`,
    explain: `Without ${v}: ${components(adj(g, [v])).map((c) => '{' + c.sort().join(', ') + '}').join(', ')}. That is ${plural(parts, 'piece')}.`,
  };
};

// ================================================================ course

const opt = (text: string, ok: boolean, why?: string): Choice => (ok ? { text, correct: true, why } : { text, why });

export const networks: Course = {
  id: 'networks',
  title: 'Networks & Contagion',
  blurb: 'Hubs, small worlds, R, herd thresholds, cascades and why some networks shatter: learn how things spread.',
  color: COLOR,
  icon: '🕸️',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'what-network',
      title: 'What a network is',
      goal: 'Read a network: nodes, edges, degree, distance and who is central.',
      steps: [
        {
          kind: 'choice',
          body: 'Each line joins two friends. Who has the **most** friends?',
          widget: () => net(FR),
          options: ['Ann', 'Gus', 'Fay', 'Hal'].map((v) => opt(v, v === FR_MAX, v === FR_MAX ? undefined : `${v} has ${FR_D[v]} lines; ${FR_MAX} has ${FR_D[FR_MAX]}.${v === 'Fay' ? ' Sitting in the middle of the picture isn’t the same as having many friends.' : ''}`)),
          explain: `${FR_MAX} has ${FR_D[FR_MAX]} lines: ${FR_A[FR_MAX].join(', ')}.`,
        },
        {
          kind: 'read',
          title: 'Nodes, edges, degree',
          body: 'A **network** (or graph) is a set of **nodes** joined by **edges**. The number of edges at a node is its **degree**, shown above each person here.\n\nThe same picture describes people and friendships, towns and roads, web pages and links, airports and flights.',
          widget: () => net(FR, { text: FR_DEGTXT }),
        },
        {
          kind: 'sort',
          body: 'To model each thing as a network, is it a node or an edge?',
          bins: ['Node', 'Edge'],
          items: [
            { text: 'A web page', bin: 0 },
            { text: 'A hyperlink', bin: 1 },
            { text: 'An airport', bin: 0 },
            { text: 'A direct flight route', bin: 1 },
            { text: 'A person', bin: 0 },
            { text: 'Two people having met', bin: 1 },
          ],
          explain: 'Things are nodes; relationships between two things are edges. Pages, airports and people are nodes; links, routes and meetings join two of them.',
        },
        {
          kind: 'number',
          body: 'A rumour hops from friend to friend. What is the fewest number of hops from **Bo** to **Kim**?',
          widget: () => net(FR, { color: (v) => (v === 'Bo' || v === 'Kim' ? COL.hub : undefined) }),
          answer: BO_KIM, tol: 0,
          hint: 'Follow the lines; the two halves of the group meet in the middle.',
          explain: `Bo → Ann → Fay → Gus → Hal → Kim: ${BO_KIM} hops. The fewest hops between two nodes is their **distance**.`,
        },
        {
          kind: 'task',
          body: 'Tap everyone within **2 hops** of Gus (not Gus).',
          widget: tapNodes(FR, GUS2),
          hint: 'Gus’s friends are 1 hop away; their friends are 2 hops away.',
          explain: `Gus’s friends: ${FR_A.Gus.join(', ')}. Their other friends: ${GUS2.filter((v) => !FR_A.Gus.includes(v)).join(', ')}. So: ${GUS2.join(', ')}.`,
        },
        {
          kind: 'choice',
          body: 'Any message between the left group (Ann’s side) and the right group (Gus’s side) has to pass through one person. Who?',
          widget: () => net(FR),
          options: [
            opt('Fay', true),
            opt('Ann', false, 'Ann reaches the left group, but every route from Ann to the right still goes on through Fay.'),
            opt('Gus', false, 'Gus is the hub of the right group; every route from there to the left still goes through Fay.'),
            opt('Nobody: there are several routes', false, 'Count the lines between the halves: only Ann–Fay and Fay–Gus join them, both at Fay.'),
          ],
          explain: 'Fay has only 2 friends, yet every one of the shortest routes between the two groups runs through her. She is a **broker**.',
        },
        {
          kind: 'read',
          title: 'Central can mean different things',
          body: `**Degree**: most direct contacts (Ann). **Closeness**: fewest hops to everyone else in total. **Betweenness**: on the most shortest routes between others (Fay).\n\nBy closeness, ${FR_CLOSE} wins too: ${FR_TOT[FR_CLOSE]} hops in total to reach all ten others, with nobody more than ${FR_FAR[FR_CLOSE]} away.`,
          widget: () => dataTable(['Person', 'Friends', 'Total hops', 'Furthest'], ['Ann', 'Fay', 'Gus', 'Hal'].map((v) => [v, FR_D[v], FR_TOT[v], FR_FAR[v]]), { highlight: [1] }),
        },
        {
          kind: 'match',
          body: 'Match each kind of centrality to the question it answers.',
          heads: ['Measure', 'Question'],
          pairs: [
            ['Degree', 'Who has the most direct contacts?'],
            ['Closeness', 'Who can reach everyone in the fewest hops?'],
            ['Betweenness', 'Who lies on the most shortest routes between others?'],
          ],
          explain: 'Degree counts neighbours, closeness adds up distances, betweenness counts how often you are on the way between others. They can pick different people, as Ann and Fay show.',
        },
        {
          kind: 'number',
          body: 'Seven people have these numbers of friends: 3, 3, 2, 2, 2, 1, 1. How many friendships are there?',
          answer: 7, tol: 0,
          hint: 'Each friendship has two ends, and each end adds 1 to someone’s count.',
          explain: 'The degrees add to 14. Every edge is counted twice, once from each end, so there are 14 ÷ 2 = 7 edges. (Sum of degrees = 2 × edges, always.)',
        },
        {
          kind: 'multi',
          body: 'Some links only go one way (directed edges). Which of these are naturally **one-way**?',
          options: [
            { text: 'Following an account', correct: true },
            { text: 'A web page linking to another', correct: true },
            { text: 'A paper citing an older paper', correct: true },
            { text: 'Two countries sharing a border', why: 'A border is shared: if A borders B, B borders A.' },
            { text: 'Two people being married', why: 'Marriage is mutual, so the edge has no direction.' },
          ],
          explain: 'Following, linking and citing can be one-sided; borders and marriages are symmetric by nature.',
        },
        {
          kind: 'estimate',
          body: `These 11 people could form ${FR_PAIRS} pairs. Roughly what share of the possible pairs are actually friends?`,
          widget: () => net(FR),
          min: 0, max: 100, step: 1, answer: Math.round((FR.edges.length / FR_PAIRS) * 100), tol: 5, format: (v) => `${v}%`,
          hint: 'Count the lines.',
          explain: `${FR.edges.length} of ${FR_PAIRS} pairs ≈ ${pct(FR.edges.length / FR_PAIRS, 0)}. This **density** is low in real social networks: you know a tiny fraction of everyone.`,
        },
      ],
      practice: [genDegree, genEdges, genHops],
    },

    // ------------------------------------------------------------ 2
    {
      id: 'friendship-paradox',
      title: 'The friendship paradox',
      goal: 'See why your friends have more friends than you, on average.',
      steps: [
        {
          kind: 'choice',
          body: 'Pick a random person in this group, then a random friend of theirs. On average, who has more friends?',
          widget: () => net(FP),
          options: [
            opt('The friend', true),
            opt('The person', false, 'The person is a fair sample of everyone; the friend is not, because popular people are someone’s friend more often.'),
            opt('Neither: it’s symmetric', false, 'It sounds symmetric, but you reach the friend by following a line, and people with many lines are easier to reach.'),
          ],
          explain: 'The friend. Following a friendship lands you on popular people more often, because they sit at the end of more friendships.',
        },
        {
          kind: 'read',
          title: 'Count it',
          body: `Here are everyone’s friend counts. Eve has ${FP_D.Eve}. Cat and Dan have just 1 each, and their one friend is Eve.\n\nWhen Cat looks at her friends, the average she sees is ${FP_D.Eve}.`,
          widget: () => net(FP, { text: FP_TXT }),
        },
        {
          kind: 'number',
          body: 'What is the average number of friends per person in this group?',
          widget: () => net(FP, { text: FP_TXT }),
          answer: FP_MEAN, tol: 0.01,
          hint: `Add up the ${FP_N} counts and divide by ${FP_N}.`,
          explain: `The counts add to ${FP_S1} (twice the ${FP.edges.length} friendships). ${FP_S1} ÷ ${FP_N} = ${num(FP_MEAN)}.`,
        },
        {
          kind: 'number',
          body: 'Gil has 3 friends. On average, how many friends do **Gil’s friends** have?',
          widget: () => net(FP, { text: FP_TXT, color: (v) => (v === 'Gil' ? COL.hub : undefined) }),
          answer: FP_FA.Gil, tol: 0.01,
          explain: `Gil’s friends are ${FP_A.Gil.map((u) => `${u} (${FP_D[u]})`).join(', ')}: ${sum(FP_A.Gil.map((u) => FP_D[u]))} ÷ 3 ≈ ${num(FP_FA.Gil)}. More than Gil’s own 3.`,
        },
        {
          kind: 'task',
          body: 'Tap everyone who has **fewer** friends than their friends have on average.',
          widget: tapNodes(FP, FP_FEWER, FP_TXT),
          hint: 'For each person, average the numbers on their friends. Only a couple of people beat their friends.',
          explain: `${FP_FEWER.length} of ${FP_N}: everyone except ${Object.keys(FP_A).filter((v) => !FP_FEWER.includes(v)).join(' and ')}. Eve (6) beats her friends’ average of ${num(FP_FA.Eve)}; Hu (3) beats ${num(FP_FA.Hu)}.`,
        },
        {
          kind: 'read',
          title: 'Why: popular people are counted again and again',
          body: `Write down everyone’s friends in one long list. Eve appears ${FP_D.Eve} times (once for each friend), Cat once. A person with d friends appears d times, bringing d each time.\n\nSo the list’s average is **sum of d² ÷ sum of d** = ${FP_S2} ÷ ${FP_S1} ≈ ${num(FP_S2 / FP_S1)}, above the plain average of ${num(FP_MEAN)}.`,
          widget: () => barChart(Object.keys(FP_D).sort((a, b) => FP_D[b] - FP_D[a]).map((v) => ({ label: v, value: FP_D[v], color: v === 'Eve' ? 'var(--c2)' : 'var(--c1)' })), { title: 'times each person appears in the friend list' }),
        },
        {
          kind: 'fill',
          body: 'The gap has a neat formula, with μ the mean number of friends.',
          template: 'friend-list average = μ + [[0]] ÷ μ, so the gap disappears only when [[1]].',
          blanks: [
            { options: ['variance', 'median', 'population'], answer: 0 },
            { options: ['everyone has the same number of friends', 'the network is very large', 'nobody has more than 3 friends'], answer: 0 },
          ],
          explain: 'Sum of d² ÷ sum of d = (μ² + variance) ÷ μ = μ + variance ÷ μ. Any spread in friend counts makes your friends look more popular; only if everyone has the same count is there no gap.',
        },
        {
          kind: 'number',
          body: 'A star: one hub is friends with 9 people who know nobody else. The average person has 1.8 friends. What is the average friend count on the **friend list**?',
          widget: () => net(mk({ H: [50, 30], ...Object.fromEntries(Array.from({ length: 9 }, (_, k) => [String(k + 1), [+(50 + 40 * Math.cos((2 * Math.PI * k) / 9)).toFixed(1), +(30 + 25 * Math.sin((2 * Math.PI * k) / 9)).toFixed(1)]])) }, Array.from({ length: 9 }, (_, k) => `H-${k + 1}`).join(' '))),
          answer: 5, tol: 0.01,
          hint: 'The hub appears 9 times (with 9 friends); each of the others appears once (with 1).',
          explain: '(9 × 9 + 9 × 1) ÷ 18 = 90 ÷ 18 = 5. The friend list is dominated by the hub, so it averages 5 against a population average of 1.8.',
        },
        {
          kind: 'choice',
          body: 'In which network do your friends have exactly as many friends as you, on average, for everyone?',
          widget: () => h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' }, net(ringLattice(6, 1), { labels: false }), net(mk({ H: [50, 30], a: [50, 2], b: [90, 16], c: [90, 44], d: [50, 58], e: [10, 44], f: [10, 16] }, 'H-a H-b H-c H-d H-e H-f'), { labels: false })),
          options: [
            opt('A ring where everyone has 2 friends', true),
            opt('A star with one hub', false, 'The star has the biggest gap of all: every leaf’s only friend is the hub.'),
            opt('A school with a few very popular pupils', false, 'Popular pupils appear on many friend lists, so friend lists average above the pupil average.'),
          ],
          explain: 'With every degree equal, the variance is 0 and the gap vanishes. Any spread in popularity creates the paradox.',
        },
        {
          kind: 'estimate',
          body: `Now a big network grown by rich-get-richer rules (next lesson): 1,000 people, average ${num(BA_STATS().mean, 2)} contacts. A random person’s **contact** has about how many contacts?`,
          min: 0, max: 40, step: 1, answer: Math.round(BA_STATS().friend), tol: 3,
          hint: 'Hubs dominate the friend list. Expect a multiple of the average.',
          explain: `Sum of d² ÷ sum of d ≈ ${num(BA_STATS().friend, 3)}, about ${Math.round(BA_STATS().friend / BA_STATS().mean)} times the average. The more unequal the network, the stronger the paradox.`,
        },
        {
          kind: 'multi',
          body: 'Which statements follow from the friendship paradox?',
          options: [
            { text: 'A random friend tends to have more friends than a random person', correct: true },
            { text: 'Feeling less popular than your friends can be a counting effect', correct: true },
            { text: 'Most people are less popular than the population average', why: 'The paradox compares you with your friends, not with the population average. It is about who gets sampled.' },
            { text: 'Popular people must be exaggerating', why: 'No exaggeration is needed: the effect follows from counting alone.' },
          ],
          explain: 'Sampling by friendship over-samples people with many friendships. That makes friends look popular even when every count is honest.',
        },
        {
          kind: 'choice',
          body: 'Health officials want to spot an outbreak early by watching people who are well connected. They can’t see the network. What should they watch?',
          options: [
            opt('Friends named by randomly chosen people', true),
            opt('A random sample of people', false, 'A random sample has only average connections, so it hears about the outbreak at an average time.'),
            opt('Whoever lives nearest the hospital', false, 'Location isn’t connectedness; it gives no extra warning in general.'),
          ],
          explain: 'Named friends are a cheap sample of better-connected people, so they tend to catch things earlier. Studies have used exactly this trick to get early warning of flu outbreaks.',
        },
      ],
      practice: [genStar, genFriendList, genOneFriendAvg],
    },

    // ------------------------------------------------------------ 3
    {
      id: 'hubs',
      title: 'Hubs and heavy tails',
      goal: 'Explain how rich-get-richer growth makes a few hubs dominate.',
      steps: [
        {
          kind: 'choice',
          body: 'People find web pages mostly by following links. A new page will link to one page it found. Page P already has 500 links pointing to it; page Q has 5. Which is more likely to get the new link?',
          options: [
            opt('P', true),
            opt('Q', false, 'Q is findable through only 5 links; P through 500. Pages you can find are pages you link to.'),
            opt('Equally likely', false, 'That would be true if the new page picked at random, but it picks among pages it found, and P is found far more often.'),
          ],
          explain: 'Popular pages are easier to find, so they gain links faster: the **rich get richer** (preferential attachment).',
        },
        {
          kind: 'read',
          title: 'Grow a network',
          body: 'Each new node joins by linking to one existing node, chosen **in proportion to how many links it already has**. Press Play and watch where the links go (bigger circle, more links).',
          widget: () => growthStepper(TREE()),
        },
        {
          kind: 'number', prob: true,
          body: 'Existing nodes have 6, 3, 2 and 1 links. A newcomer links to one, chosen in proportion to links. What is the chance it picks the node with **6**?',
          widget: () => barChart([6, 3, 2, 1].map((v, k) => ({ label: 'PQRS'[k], value: v })), { title: 'links per node' }),
          answer: 0.5, tol: 0.005,
          hint: 'Its share of all the links.',
          explain: '6 of the 12 links: 6/12 = 1/2. The best-connected node gets half of all new links, so it pulls further ahead.',
        },
        {
          kind: 'choice',
          body: 'The grown network again, each node labelled with its arrival order (1 came first). Which nodes usually end up as the biggest hubs?',
          widget: () => { const d = deg(TREE_G()); return net(TREE_G(), { r: (v) => 3.1 + 0.45 * d[v], color: (v) => (d[v] >= 4 ? COL.hub : undefined) }); },
          options: [
            opt('The oldest ones', true),
            opt('The newest ones', false, 'Newcomers start with 1 link and have had little time to collect more.'),
            opt('Any node equally', false, 'Early nodes get a head start and the head start compounds: more links bring more links.'),
          ],
          explain: 'Early nodes have had the longest to collect links, and every link they get raises their chance of the next. Small early leads snowball.',
        },
        {
          kind: 'read',
          title: 'Two networks with the same number of links',
          body: `Both have 1,000 nodes and ${num(ER().reduce((t, x) => t + x.length, 0) / 2)} links (average ${num(BA_STATS().mean, 2)} each). In a **random** network, links land anywhere: degrees bunch around the average and the top node has ${ER_STATS().max}. In the **rich-get-richer** one, most nodes have 2 or 3 links and the top hub has **${BA_STATS().max}**.`,
          widget: () => {
            const hist = (A: number[][]) => { const c = new Map<number, number>(); A.forEach((x) => c.set(x.length, (c.get(x.length) ?? 0) + 1)); return c; };
            const hb = hist(BA()), he = hist(ER());
            const ks = Array.from({ length: 13 }, (_, i) => i);
            return h('div', null, plotEl({
              x: [-0.6, 12.6], y: [0, 520], size: [360, 250], xlabel: 'links', ylabel: 'nodes', ticks: [2, 100],
              layers: [
                { type: 'bars', pts: ks.map((k) => [k - 0.2, he.get(k) ?? 0] as [number, number]), width: 0.38, color: 'var(--c1)' },
                { type: 'bars', pts: ks.map((k) => [k + 0.2, hb.get(k) ?? 0] as [number, number]), width: 0.38, color: 'var(--c2)' },
              ],
            }), legend([['var(--c1)', 'random'], ['var(--c2)', 'rich-get-richer (tail runs off the chart)']]));
          },
        },
        {
          kind: 'choice',
          body: `In the rich-get-richer network of 1,000 nodes (average ${num(BA_STATS().mean, 2)} links), roughly how many links does the biggest hub have?`,
          options: [
            opt(String(ER_STATS().max), false, `That’s the top node of the random network. Rich-get-richer growth produces far bigger hubs.`),
            opt(String(BA_STATS().max), true),
            opt('400', false, 'Too big: that would be 40% of all nodes linked to one hub.'),
            opt('6', false, 'That’s barely above the average. The whole point of hubs is that they are far above it.'),
          ],
          explain: `${BA_STATS().max} links, about ${Math.round(BA_STATS().max / BA_STATS().mean)} times the average. In the random network the top node has ${ER_STATS().max}.`,
        },
        {
          kind: 'estimate',
          body: 'The best-connected 5% of nodes in the rich-get-richer network hold what share of all link-ends?',
          min: 0, max: 100, step: 1, answer: Math.round(BA_STATS().top5 * 100), tol: 5, format: (v) => `${v}%`,
          hint: 'If links were spread evenly, 5% of nodes would hold 5%.',
          explain: `About ${pct(BA_STATS().top5, 0)}, against ${pct(ER_STATS().top5, 0)} in the random network and 5% for perfect equality.`,
        },
        {
          kind: 'multi',
          body: 'Which are true of the rich-get-richer network?',
          widget: () => dataTable(['', 'Rich-get-richer', 'Random'], [['mean links', num(BA_STATS().mean, 2), num(BA_STATS().mean, 2)], ['biggest hub', BA_STATS().max, ER_STATS().max]]),
          options: [
            { text: 'Most nodes have fewer links than the average', correct: true },
            { text: 'The mean degree is above the median', correct: true },
            { text: 'A few nodes touch a large share of all links', correct: true },
            { text: 'Nearly every node has close to the average number of links', why: 'That describes the random network. Here degrees range from 2 to almost 100.' },
          ],
          explain: `${pct(BA_STATS().below, 0)} of nodes are below the mean of ${num(BA_STATS().mean, 2)} (the median is ${BA_STATS().median}): a few hubs drag the average up. That’s the signature of a **heavy tail**.`,
        },
        {
          kind: 'sort',
          body: 'Heavy tail (a few giants) or bell-shaped (nobody far from typical)?',
          bins: ['Heavy-tailed', 'Bell-shaped'],
          items: [
            { text: 'Followers per social media account', bin: 0 },
            { text: 'How often each word appears in a book', bin: 0 },
            { text: 'Populations of cities', bin: 0 },
            { text: 'Heights of adults', bin: 1 },
            { text: 'Birth weights of babies', bin: 1 },
            { text: 'Daily high temperatures in one city', bin: 1 },
          ],
          explain: 'Follower counts, word frequencies and city sizes span many orders of magnitude, and rich-get-richer effects are one way to grow them. Heights, birth weights and temperatures cluster around a typical value.',
        },
        {
          kind: 'number', prob: true,
          body: 'In a heavy tail like this one, the share of nodes with at least k links falls like 1/k². If 4% have at least 10 links, what share have at least **50**?',
          widget: () => plotEl({ x: [10, 50], y: [0, 4.2], size: [360, 220], xlabel: 'k links', ylabel: '% with ≥ k', ticks: [10, 1], layers: [{ type: 'fn', f: (k) => 4 * (10 / k) ** 2, color: 'var(--c2)' }, { type: 'dots', pts: [[10, 4]], color: 'var(--c2)' }] }),
          answer: 0.0016, tol: 0.0001,
          hint: 'k grows 5-fold, so the share shrinks by 5².',
          explain: '4% × (10/50)² = 4% ÷ 25 = 0.16%. Small, but in a bell-shaped distribution a node with 12 times the average would essentially never occur.',
        },
        {
          kind: 'match',
          body: 'Match each term to its meaning.',
          heads: ['Term', 'Meaning'],
          pairs: [
            ['Preferential attachment', 'New links favour nodes that already have many'],
            ['Hub', 'A node with far more links than typical'],
            ['Heavy tail', 'Rare values far above the typical one are not that rare'],
            ['Random network', 'Links placed anywhere, so degrees cluster near the average'],
          ],
          explain: 'Preferential attachment grows hubs; hubs are the heavy tail of the degree distribution; a random network has no such tail.',
        },
        {
          kind: 'fill',
          body: 'Summing up.',
          template: 'In a heavy-tailed network, the [[0]] is pulled up by a few hubs, so it sits [[1]] the median.',
          blanks: [
            { options: ['mean', 'median', 'smallest degree'], answer: 0 },
            { options: ['above', 'below', 'exactly at'], answer: 0 },
          ],
          explain: 'A few huge values raise the mean but barely move the median, so "average degree" describes almost nobody.',
        },
      ],
      practice: [genAttach, genTail, genMeanMedian],
    },

    // ------------------------------------------------------------ 4
    {
      id: 'small-worlds',
      title: 'Small worlds',
      goal: 'See how a few shortcuts make a big clustered network small.',
      steps: [
        {
          kind: 'number',
          body: '20 people sit in a circle, each friends with the **2 nearest on each side**. How many hops from person 1 to person 11, directly opposite?',
          widget: () => net(R20, { r: 3.2, color: (v) => (v === '1' || v === '11' ? COL.hub : undefined) }),
          answer: R20_OPP, tol: 0,
          hint: 'Each hop moves you at most 2 seats round the circle.',
          explain: `Person 11 is 10 seats away and a hop covers at most 2, so ${R20_OPP} hops.`,
        },
        {
          kind: 'task',
          body: `In this ring of 12, everyone knows just their two neighbours, so person 1’s furthest friend-of-a-friend chain is ${R12_FAR} hops. Person 1 makes **one** new friend. Tap who, so that **everyone** is within 3 hops of 1.`,
          widget: addShortcut(R12, '1', 3),
          hint: 'Where is the person furthest from 1?',
          explain: 'Befriend person 7, directly opposite. Then 1 reaches 2–4 and 10–12 round the ring, and 5, 6, 8, 9 through 7, all within 3 hops.',
        },
        {
          kind: 'read',
          title: 'Add shortcuts',
          body: 'A ring of 30 where everyone knows their 2 nearest on each side. Slide to add random long-range links and watch the **average distance** and the **clustering** (how often two of your friends are friends with each other).',
          widget: explorer({
            params: [{ id: 's', label: 'shortcuts', min: 0, max: 10, step: 1, value: 0 }],
            draw: (v) => net(R30, { labels: false, r: 1.8, extra: SC30.slice(0, v.s) }),
            readout: (v) => { const A = adj({ nodes: R30.nodes, edges: [...R30.edges, ...SC30.slice(0, v.s)] }); return `average distance ${num(pathStats(A).mean, 3)} hops · clustering ${num(meanClustering(A), 2)}`; },
          }),
        },
        {
          kind: 'number', prob: true,
          body: 'In the ring with no shortcuts, person 1 has 4 friends (2 each side). Of the 6 pairs of those friends, what share are friends with each other? (That share is 1’s **clustering**.)',
          widget: () => net(R20, { r: 3.2, color: (v) => (v === '1' ? COL.hub : ['2', '3', '19', '20'].includes(v) ? COL.on : undefined) }),
          answer: 0.5, tol: 0.005,
          hint: 'Friends 19, 20, 2, 3. Two of them are friends if they sit at most 2 seats apart.',
          explain: '19–20, 20–2 and 2–3 are within 2 seats; 19–2, 19–3 and 20–3 are not. 3 of 6 pairs: 0.5. Neighbourhoods in a ring are tightly knit.',
        },
        {
          kind: 'read',
          title: 'Short paths, still cliquey',
          body: `Now a ring of 200 (the same 2-each-side rule). With no shortcuts the average distance is ${num(SW200()[0].L, 3)} hops. Just **20 shortcuts**, one per 10 people, cut it to ${num(SW200()[10].L, 3)}, while clustering only slips from ${num(SW200()[0].C, 2)} to ${num(SW200()[10].C, 2)}.`,
          widget: () => h('div', null, plotEl({
            x: [0, 40], y: [0, 1.05], size: [360, 240], xlabel: 'shortcuts', ticks: [10, 0.25],
            layers: [
              { type: 'line', pts: SW200().map((p) => [p.s, p.L / SW200()[0].L] as [number, number]), color: 'var(--c1)' },
              { type: 'line', pts: SW200().map((p) => [p.s, p.C / SW200()[0].C] as [number, number]), color: 'var(--c2)' },
            ],
          }), legend([['var(--c1)', 'average distance (share of start)'], ['var(--c2)', 'clustering (share of start)']])),
        },
        {
          kind: 'choice',
          body: 'Why do a handful of shortcuts shrink distances so much?',
          widget: () => net(R30, { labels: false, r: 1.8, extra: SC30.slice(0, 3) }),
          options: [
            opt('Each shortcut sits on the shortest routes of many pairs', true),
            opt('Shortcuts give everyone many more friends', false, '20 shortcuts add only 40 link-ends to the 800 already there. The effect comes from where they go, not how many.'),
            opt('Shortcuts make neighbourhoods more tightly knit', false, 'Clustering actually drops slightly: a shortcut’s two ends rarely share friends.'),
          ],
          explain: 'A shortcut joins two distant regions, so everyone near one end gets close to everyone near the other. One link helps thousands of pairs at once.',
        },
        {
          kind: 'order',
          body: 'Order these 200-person networks from **longest** to **shortest** average distance.',
          items: ['Ring, no shortcuts', 'Ring plus 4 shortcuts', 'Ring plus 20 shortcuts', 'Everyone linked to everyone'],
          explain: `Average distances: ${num(SW200()[0].L, 3)}, ${num(SW200()[2].L, 3)}, ${num(SW200()[10].L, 3)} and exactly 1.`,
        },
        {
          kind: 'number',
          body: 'Suppose everyone has 100 acquaintances and nobody’s circles overlap. How many steps out from you before you could reach **100 million** people?',
          answer: 4, tol: 0,
          hint: 'After s steps: 100^s people.',
          explain: '100² = 10,000, 100³ = 1 million, 100⁴ = 100 million. Four steps. Branching makes worlds small fast.',
        },
        {
          kind: 'read',
          title: 'Six degrees',
          body: 'In the 1960s Stanley Milgram asked people to pass a letter towards a stranger via acquaintances on first-name terms. The letters that arrived took about six steps. Later studies of email and online networks also found short chains.\n\nReal acquaintances overlap heavily (high clustering), so the fast branching above is too optimistic. It is the few long-range ties that keep paths short anyway.',
        },
        {
          kind: 'point',
          body: 'If everyone has 50 acquaintances with no overlap, after how many steps could you reach all **8 billion** people? Place it on the line.',
          plot: { x: [0, 10], ticks: [1] },
          answer: { x: 6 }, tol: 0.4, snap: 1,
          hint: '50² = 2,500, 50³ = 125,000. Keep multiplying by 50.',
          explain: '50⁵ ≈ 312 million is too few; 50⁶ ≈ 15.6 billion is enough. So 6 steps.',
        },
        {
          kind: 'multi',
          body: 'A **small-world** network has which features?',
          options: [
            { text: 'Short average distances', correct: true },
            { text: 'High clustering: friends of friends are often friends', correct: true },
            { text: 'Every node has the same degree', why: 'Degrees can vary any way; the ring just made it easy to see.' },
            { text: 'One central node everything passes through', why: 'Short paths come from many scattered shortcuts, not from a single centre.' },
          ],
          explain: 'Small worlds combine the tight neighbourhoods of a lattice with the short paths of a random network.',
        },
        {
          kind: 'fill',
          body: 'Summing up.',
          template: 'A few random shortcuts shrink [[0]] dramatically but barely change [[1]].',
          blanks: [
            { options: ['average distance', 'clustering', 'the number of people'], answer: 0 },
            { options: ['clustering', 'average distance', 'the number of shortcuts'], answer: 0 },
          ],
          explain: 'Distance depends on the few long ties; clustering depends on the many local ones.',
        },
      ],
      practice: [genReach, genClustering, genRingDiam],
    },

    // ------------------------------------------------------------ 5
    {
      id: 'spreading',
      title: 'Spreading: R and exponential growth',
      goal: 'Use R to tell when an outbreak grows, levels off or dies out.',
      steps: [
        {
          kind: 'number',
          body: 'Each case passes an infection to 2 new people, then recovers. The first case is generation 0. How many **new** cases are there in generation 6?',
          widget: () => h('div', null, net(BRANCH, { labels: false, r: 2.2, color: (v) => GEN_COL[Number(v.split('.')[0])] }), h('div', { style: 'text-align:center;color:var(--muted);font-size:.9rem' }, 'generations 0 to 4')),
          answer: 64, tol: 0,
          hint: 'Generation 1 has 2, generation 2 has 4…',
          explain: 'Each generation doubles: 2⁶ = 64. Multiplying by a fixed factor each step is **exponential growth**.',
        },
        {
          kind: 'read',
          title: 'Spreading on a network',
          body: 'Here each sick person passes it to each friend with probability 1/2, then recovers. Press Play.',
          widget: () => spreadStepper(SPREAD, SPREAD_W, { words: ['new cases', 'recovered'] }),
        },
        {
          kind: 'read',
          title: 'R: cases per case',
          body: '**R** is the average number of new people each case infects. **R0** (R-nought) is its value at the start, when nobody is immune. Each generation multiplies cases by R. Slide R starting from 10 cases.',
          widget: explorer({
            params: [{ id: 'R', label: 'R', min: 0.5, max: 2, step: 0.1, value: 1.3, format: (v) => v.toFixed(1) }],
            draw: (v) => casesPlot(v.R, 10),
            readout: (v) => `generation 8: ${num(10 * Math.pow(v.R, 8), 3)} new cases`,
          }),
        },
        {
          kind: 'choice',
          body: 'What happens to new cases per generation when **R is exactly 1**?',
          options: [
            opt('They stay level', true),
            opt('They grow slowly', false, 'Growth needs each case to be replaced by more than one; at 1 it is replaced by exactly one.'),
            opt('They die out at once', false, 'Each case still causes one more, so the chain carries on.'),
          ],
          explain: 'Each case replaces itself once, so the count holds steady. R = 1 is the tipping point between growth and decline.',
        },
        {
          kind: 'sort',
          body: 'Will cases grow or shrink?',
          bins: ['Grow', 'Shrink'],
          items: [
            { text: 'Each case infects 3 others', bin: 0 },
            { text: '10 cases cause 12 new ones', bin: 0 },
            { text: 'R = 1.1', bin: 0 },
            { text: 'Each case infects 0.7 others', bin: 1 },
            { text: '10 cases cause 8 new ones', bin: 1 },
            { text: 'R = 0.95', bin: 1 },
          ],
          explain: 'Only whether R is above or below 1 matters for the direction. 12 from 10 is R = 1.2; 8 from 10 is R = 0.8.',
        },
        {
          kind: 'number',
          body: '100 cases arrive in a town where R = 0.8. Counting those 100, how many cases will there be in total before it dies out (on average)?',
          widget: () => casesPlot(0.8, 100, 10),
          answer: 500, tol: 1,
          hint: '100 + 80 + 64 + … : a geometric series, first term ÷ (1 − R).',
          explain: '100 ÷ (1 − 0.8) = 500. R below 1 means decline, not zero: each arrival still causes 4 more cases on average.',
        },
        {
          kind: 'fill',
          body: 'Where does R come from? For a person who is infectious:',
          template: 'R = [[0]] per day × chance of infecting each contact × [[1]]',
          blanks: [
            { options: ['contacts', 'tests', 'deaths'], answer: 0 },
            { options: ['days infectious', 'days before symptoms', 'size of the population'], answer: 0 },
          ],
          explain: 'Contacts per day × chance per contact = infections per day; times the days you stay infectious = infections in total. Each factor is a lever.',
        },
        {
          kind: 'number',
          body: 'An infectious person meets 10 people a day, infects each with probability 0.04, and is infectious for 5 days, so R = 2. If they cut contacts to **4 a day**, what is R?',
          answer: 0.8, tol: 0.005,
          explain: '4 × 0.04 × 5 = 0.8. Cutting contacts by 60% took R from 2 to below 1.',
        },
        {
          kind: 'task',
          body: 'Each contact is infected with probability 0.05 and people are infectious for 5 days. Set contacts per day so that the outbreak **shrinks**.',
          widget: explorer({
            params: [{ id: 'c', label: 'contacts/day', min: 1, max: 12, step: 1, value: 8 }],
            draw: (v) => casesPlot(v.c * 0.25, 10),
            readout: (v) => `R = ${v.c} × 0.05 × 5 = ${num(v.c * 0.25)}`,
            goal: (v) => v.c * 0.25 < 1,
            goalText: 'R is below 1: each generation is smaller.',
          }),
          hint: 'R = contacts × 0.25. You need R below 1.',
          explain: 'R = contacts × 0.05 × 5 = contacts ÷ 4, so 3 contacts a day or fewer (R = 0.75) makes it shrink; 4 a day is R = 1, merely level.',
        },
        {
          kind: 'point',
          body: 'R0 = 2.5. Everyone cuts their contacts by the same fraction. Place the cut that brings R to exactly 1.',
          plot: { x: [0, 1], ticks: [0.1], tickFormat: (v) => pct(v, 0) },
          answer: { x: 0.6 }, tol: 0.025, snap: 0.05,
          hint: '2.5 × (1 − cut) = 1.',
          explain: '1 − cut = 1/2.5 = 0.4, so cut = 60%. Remember this shape: 1 − 1/R0 comes back in the next lesson.',
        },
        {
          kind: 'read',
          title: 'Luck at the start',
          body: `Even with R above 1, one case can fizzle: its few contacts may all escape. Here are 50 simulated chains, each started by one case with R = 1.5 (the number each case infects varies randomly around 1.5). **${CHAINS_DIED} of 50** died out (green); the rest took off (red).`,
          widget: () => h('div', null, iconArray(50, (i) => (CHAINS[i] ? 0 : 1), { cols: 10, colors: [tint(COL.safe, 70), 'var(--bad)'] }), legend([[COL.safe, 'died out'], [COL.sick, 'took off']])),
        },
        {
          kind: 'estimate',
          body: 'Now R = 2 (with the same kind of randomness). What is the chance that one case’s chain dies out on its own?',
          min: 0, max: 100, step: 1, answer: Math.round(extinction(2) * 100), tol: 5, format: (v) => `${v}%`,
          hint: 'For R = 1.5 it was about 4 in 10. A higher R gives fewer escapes.',
          explain: `About ${pct(extinction(2), 0)} (for R = 1.5 the theory gives ${pct(extinction(1.5), 0)}). The chance q solves q = e^(R(q − 1)). Many introductions fizzle, but not all, and one that takes off is enough.`,
        },
      ],
      practice: [genGenerations, genTotal, genContactsR],
    },

    // ------------------------------------------------------------ 6
    {
      id: 'herd',
      title: 'Herd thresholds and targeting',
      goal: 'Find the immunity threshold 1 − 1/R0 and see why targeting hubs beats random.',
      steps: [
        {
          kind: 'number', prob: true,
          body: 'A disease has R0 = 4: each case infects 4 people when nobody is immune. What fraction of people must be immune so that each case infects only **1** on average?',
          widget: () => net(mk({ X: [50, 30], a: [20, 10], b: [80, 10], c: [20, 50], d: [80, 50] }, 'X-a X-b X-c X-d'), { color: (v) => (v === 'X' ? COL.sick : undefined) }),
          answer: 0.75, tol: 0.006,
          hint: 'Of the 4 people a case would infect, how many may still be susceptible?',
          explain: 'Each case now infects 4 × (share susceptible). For that to be 1, the share susceptible must be 1/4, so 3/4 must be immune.',
        },
        {
          kind: 'read',
          title: 'The herd immunity threshold',
          body: 'With a share v immune (and people mixing at random), **R = R0 × (1 − v)**. It drops below 1 once v passes **1 − 1/R0**. The bigger R0, the higher the bar.',
          widget: () => plotEl({
            x: [0, 1], y: [0, 4.2], size: [360, 240], xlabel: 'share immune', ylabel: 'R', ticks: [0.25, 1], 
            layers: [
              { type: 'fn', f: (v) => 2 * (1 - v), color: 'var(--c1)' },
              { type: 'fn', f: (v) => 4 * (1 - v), color: 'var(--c2)' },
              { type: 'text', x: 0.1, y: 1.45, text: 'R0 = 2', color: 'var(--c1)', anchor: 'start' },
              { type: 'text', x: 0.18, y: 3.65, text: 'R0 = 4', color: 'var(--c2)', anchor: 'start' },
              { type: 'hline', y: 1, dash: true, color: 'var(--muted)', label: 'R = 1' },
              { type: 'dots', pts: [[0.5, 1], [0.75, 1]], color: 'var(--c4)' },
            ],
          }),
        },
        {
          kind: 'point',
          body: 'Place the herd immunity threshold for **R0 = 5**.',
          plot: { x: [0, 1], ticks: [0.1], tickFormat: (v) => pct(v, 0) },
          answer: { x: 0.8 }, tol: 0.025, snap: 0.05,
          explain: '1 − 1/5 = 0.8: 80% must be immune.',
        },
        {
          kind: 'match',
          body: 'Match each R0 to its threshold.',
          heads: ['R0', 'Must be immune'],
          pairs: [['R0 = 2', '50%'], ['R0 = 4', '75%'], ['R0 = 5', '80%'], ['R0 = 10', '90%']],
          explain: '1 − 1/R0 each time: 1/2, 3/4, 4/5, 9/10.',
        },
        {
          kind: 'estimate',
          body: 'Measles is among the most contagious diseases known; its R0 is often quoted at 12 to 18. Taking R0 = 15, what share must be immune?',
          min: 0, max: 100, step: 1, answer: 93, tol: 3, format: (v) => `${v}%`,
          explain: '1 − 1/15 ≈ 93%. That is why even a small drop in measles vaccination can let outbreaks back in.',
        },
        {
          kind: 'number', prob: true,
          body: 'R0 = 3, and a vaccine makes 90% of vaccinated people immune. What share of the population must be vaccinated?',
          answer: (2 / 3) / 0.9, tol: 0.006,
          hint: 'You need 2/3 immune, and immune = vaccinated × 0.9.',
          explain: '(1 − 1/3) ÷ 0.9 = 0.667 ÷ 0.9 ≈ 74%. Imperfect vaccines push the coverage needed higher.',
        },
        {
          kind: 'task',
          body: `Real contacts aren’t random: some people have many. **A** is sick and passes it to every contact. You have **2 vaccines**. Tap two people so the outbreak reaches at most ${VAC_LIMIT} people (now it reaches all ${VAC_ALL}).`,
          widget: vaccinate(VAC, 'A', 2, VAC_LIMIT),
          hint: 'Which two people would carry it out to everyone else?',
          explain: 'Vaccinate the two hubs, H and K. Then the outbreak is stuck at A, B and C: every route outwards ran through a hub.',
        },
        {
          kind: 'read',
          title: 'Random versus targeted',
          body: 'A 500-person rich-get-richer network, each contact infected with probability 0.35. The average outbreak, in % of people, as more are immunised: picked **at random**, picked as **a named contact** of a random person, or the **biggest hubs** first.',
          widget: () => { const c = VAC_CURVES(); const top = Math.ceil(c.random[0][1] / 5) * 5 + 5; return h('div', null, plotEl({
            x: [0, 30], y: [0, top], size: [360, 240], xlabel: '% immunised', ylabel: 'outbreak %', ticks: [5, 5],
            layers: [
              { type: 'line', pts: c.random, color: 'var(--c1)' },
              { type: 'line', pts: c.friend, color: 'var(--c3)' },
              { type: 'line', pts: c.hubs, color: 'var(--c2)' },
            ],
          }), legend([['var(--c1)', 'random'], ['var(--c3)', 'named contact'], ['var(--c2)', 'hubs first']])); },
        },
        {
          kind: 'choice',
          body: 'Why does immunising hubs first work so much better than random?',
          widget: () => net(VAC, { color: (v) => (v === 'H' || v === 'K' ? COL.safe : v === 'A' ? COL.sick : undefined), edge: (k) => (k.includes('H') || k.includes('K') ? 'dim' : undefined) }),
          options: [
            opt('Each hub removes many transmission routes at once', true),
            opt('Hubs are more likely to fall seriously ill', false, 'Nothing here depends on how ill anyone gets; it is about how many people each person can pass it to.'),
            opt('Hubs get infected last', false, 'The opposite: with many contacts, hubs tend to be infected early, and then spread widely.'),
          ],
          explain: 'An immune hub cuts every route through it. Random picks are mostly low-degree nodes, which remove few routes each.',
        },
        {
          kind: 'choice',
          body: 'You can’t see the network. Which plan gets closer to “hubs first”?',
          options: [
            opt('Ask random people to name a contact; vaccinate the contact', true),
            opt('Vaccinate random people', false, 'Random people have only average contacts, so you mostly protect low-degree nodes.'),
            opt('Vaccinate whoever volunteers first', false, 'Volunteers aren’t chosen by how many contacts they have, so this is close to random.'),
          ],
          explain: 'The friendship paradox again: a named contact has more contacts than a random person, on average. The plot shows the named-contact plan landing much nearer to hubs-first than random.',
        },
        {
          kind: 'sort',
          body: 'Each measure lowers R through one factor. Which?',
          bins: ['Fewer contacts', 'Lower chance per contact', 'Shorter infectious time'],
          items: [
            { text: 'Working from home', bin: 0 },
            { text: 'Cancelling large events', bin: 0 },
            { text: 'Wearing masks', bin: 1 },
            { text: 'Better ventilation', bin: 1 },
            { text: 'Isolating as soon as you test positive', bin: 2 },
            { text: 'Faster treatment that clears the infection', bin: 2 },
          ],
          explain: 'R = contacts × chance per contact × time infectious. Isolation and treatment shorten the time a person can pass it on in the community.',
        },
        {
          kind: 'multi',
          body: 'Which statements about herd immunity are correct?',
          options: [
            { text: 'Below the threshold, an outbreak can still grow', correct: true },
            { text: 'Above the threshold, chains shrink and die out', correct: true },
            { text: 'Clustered groups of unvaccinated people can sustain spread even when the average is above the threshold', correct: true },
            { text: 'Above the threshold, a new case infects nobody', why: 'R below 1 means fewer than one on average, not zero. Small chains still happen.' },
          ],
          explain: 'The threshold assumes random mixing. Real networks have pockets, where the local share immune can be far lower than the average.',
        },
      ],
      practice: [genHerd, genReff, genEfficacy],
    },

    // ------------------------------------------------------------ 7
    {
      id: 'cascades',
      title: 'Cascades and tipping points',
      goal: 'Predict when an idea needing several adopting neighbours takes over.',
      steps: [
        {
          kind: 'sort',
          body: 'An idea spreads on a grid: a cell adopts once **at least 2** of its 4 neighbours (up, down, left, right) have. Coloured cells have adopted. Which lettered cells adopt next?',
          widget: () => gridPic(5, 5, Object.fromEntries(Q_ON.map((k) => [k, COL.hub])), Q_CELLS),
          bins: ['Adopts', 'Not yet'],
          items: Object.entries(Q_CELLS).map(([k, t]) => ({ text: t, bin: qCount(k) >= 2 ? 0 : 1 })),
          explain: `Count adopted cells directly above, below, left and right: ${Object.entries(Q_CELLS).map(([k, t]) => `${t} has ${qCount(k)}`).join(', ')}. Two or more adopts; diagonals don’t count.`,
        },
        {
          kind: 'read',
          title: 'Watch a cascade',
          body: `Four seeds on a 6 × 6 grid, same rule (2 neighbours). Press Play. The three seeds on a diagonal fill a 3 × 3 block; then it stalls at ${STALL_ON} cells.`,
          widget: () => gridCascadeStepper(6, 6, STALL_SEEDS, 2),
        },
        {
          kind: 'choice',
          body: 'Why does the lone seed near the bottom right do nothing?',
          options: [
            opt('Each of its neighbours has only 1 adopted neighbour', true),
            opt('It is too far from the edge', false, 'Edges don’t matter here; what matters is how many adopted neighbours each cell has.'),
            opt('Seeds only work in groups of three', false, 'There’s no such rule. Two seeds that both touch the same cell would already convert it.'),
          ],
          explain: 'Under a 2-neighbour rule one isolated adopter can never convert anyone. Complex contagions need reinforcement.',
        },
        {
          kind: 'task',
          body: 'A 5 × 5 grid, same rule. Place **5 seeds** so that the **whole grid** adopts.',
          widget: gridSeeder(5, 5, 5, 2),
          hint: 'Two seeds that touch the same empty cell from two sides convert it. Try seeds that are diagonal neighbours.',
          explain: 'Put the 5 seeds on a diagonal, for example (0,0), (1,1), (2,2), (3,3), (4,4). Each pair of diagonal neighbours converts the two cells between them, and the block grows until it fills the grid.',
        },
        {
          kind: 'read',
          title: 'Why you need 5',
          body: 'Look at the **perimeter** of the adopted region (the total length of its boundary). When a cell adopts, at least 2 of its sides already touch the region and at most 2 are new, so the perimeter never grows.\n\nThe full 5 × 5 grid has perimeter 20, and each seed brings at most 4. So you need at least 5 seeds.',
        },
        {
          kind: 'number',
          body: 'Same rule on an **8 × 8** grid. What is the fewest seeds that can make every cell adopt?',
          widget: () => gridPic(8, 8, {}),
          answer: 8, tol: 0,
          hint: 'Perimeter of the full grid ÷ 4.',
          explain: 'The full grid’s perimeter is 32 and each seed adds at most 4, so at least 8. The diagonal shows 8 is enough.',
        },
        {
          kind: 'match',
          body: 'Diseases and ideas spread differently. Match each kind of contagion to its description.',
          heads: ['Kind', 'Description'],
          pairs: [
            ['Simple contagion', 'One contact can be enough to pass it on'],
            ['Complex contagion', 'Needs several contacts who already have it'],
          ],
          explain: 'A virus needs only one exposure. Adopting a costly behaviour or a new technology often needs reinforcement from several people you know.',
        },
        {
          kind: 'task',
          body: 'Now a network. Each person adopts once **at least half** their friends have. Tap **one** person to start with so that **everyone** adopts.',
          widget: seedCascade(CAS),
          hint: 'A good seed has friends who need only one or two adopters, and they in turn unlock their friends.',
          explain: `Start with ${CAS_WIN.join(' or ')}. From I: H and J (who need only 1) adopt, then F has I and J (2 of 3), then E has F and I (2 of 4), and it rolls on to everyone.`,
        },
        {
          kind: 'choice',
          body: `E has the most friends (tied), yet seeding E stalls at ${CAS_E.size} of ${CAS.nodes.length}. Why?`,
          widget: () => net(CAS, { color: (v) => (v === 'E' ? COL.hub : CAS_E.has(v) ? COL.on : undefined) }),
          options: [
            opt('E’s best-connected friends need 2 adopters and only have E', true),
            opt('E doesn’t have enough friends', false, 'E has 4 friends, as many as anyone; the problem is who those friends are.'),
            opt('Cascades can never start at a hub', false, 'Not a rule: hubs can seed cascades when their friends are easy to convert.'),
          ],
          explain: 'F and I each need two adopting friends, and E alone isn’t enough. For complex contagion, a seed inside a tight cluster (where friends share friends) works better than a hub with scattered contacts.',
        },
        {
          kind: 'number',
          body: '100 people. Person 0 riots no matter what; person 1 joins once 1 other has; person 2 once 2 have; …; person 99 once 99 have. How many riot?',
          widget: () => h('div', null, cells([...GRAN.slice(0, 6), '…', 99], { index: false }), h('div', { style: 'text-align:center;color:var(--muted);font-size:.9rem' }, 'thresholds')),
          answer: granovetter(GRAN), tol: 0,
          explain: `Person 0 starts, which triggers person 1, which triggers person 2, and so on: all ${granovetter(GRAN)}. (This is Mark Granovetter’s threshold model.)`,
        },
        {
          kind: 'number',
          body: 'Same crowd, but person 1 is a bit more cautious: they join once **2** others have. How many riot now?',
          widget: () => h('div', null, cells([...GRAN2.slice(0, 6), '…', 99], { index: false, hi: [1] }), h('div', { style: 'text-align:center;color:var(--muted);font-size:.9rem' }, 'thresholds')),
          answer: granovetter(GRAN2), tol: 0,
          hint: 'After person 0, who has a threshold of 1 or less?',
          explain: `Only person 0. Nobody else has a threshold of 1, so it stops at ${granovetter(GRAN2)}. Two almost identical crowds, completely different outcomes: a **tipping point**.`,
        },
        {
          kind: 'multi',
          body: 'What do the threshold models teach?',
          options: [
            { text: 'Tiny changes can flip a cascade on or off', correct: true },
            { text: 'Outcomes depend on the whole chain of thresholds, not just their average', correct: true },
            { text: 'Where you seed matters as much as how many seeds', correct: true },
            { text: 'A big outcome needs a big cause', why: 'One changed threshold took the riot from 100 people to 1.' },
          ],
          explain: 'In cascades, effects aren’t proportional to causes. Gaps in the chain stop everything; filled gaps let one seed tip a whole network.',
        },
      ],
      practice: [genGran, genAdopt, genGridFinal],
    },

    // ------------------------------------------------------------ 8
    {
      id: 'robustness',
      title: 'Robustness',
      goal: 'Find single points of failure and see why hub networks shrug off accidents but not attacks.',
      steps: [
        {
          kind: 'task',
          body: 'Tap the **one link** whose loss splits this network into two pieces.',
          widget: cutLink(BR),
          hint: 'Most links lie on a loop, so there is a way round. Find the one that doesn’t.',
          explain: `Cut ${BR_BRIDGE.replace('|', '–')}. It is the only link between the left group (A–E) and the right group (F–J).`,
        },
        {
          kind: 'read',
          title: 'Bridges and cut nodes',
          body: 'A **bridge** is a link whose loss disconnects the network: exactly the links that lie on no loop. A **cut node** is a node whose loss does the same. Either is a **single point of failure**.\n\nAdding a second, separate route is **redundancy**.',
          widget: () => net(BR, { edge: (k) => (k === BR_BRIDGE ? 'hi' : undefined), color: (v) => (BR_CUT.includes(v) ? COL.hub : undefined) }),
        },
        {
          kind: 'multi',
          body: 'Which of these nodes are **cut nodes** (their failure splits the rest)?',
          widget: () => net(BR),
          options: ['D', 'E', 'F', 'G', 'I'].map((v) => (BR_CUT.includes(v) ? { text: v, correct: true } : { text: v, why: `Without ${v}, everyone else can still reach each other: ${v} lies on a loop.` })),
          explain: `${BR_CUT.join(' and ')}: the two ends of the bridge. Without E, A–D lose the right side; without F, G–J lose the left side.`,
        },
        {
          kind: 'order',
          body: 'Order from **easiest** to **hardest** to disconnect by cutting links.',
          widget: () => h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px 10px' }, SHAPE_G.map((s) => h('div', null, net(s.g, { labels: false }), h('div', { style: 'text-align:center;font-size:.85rem;color:var(--muted)' }, s.short)))),
          items: SHAPES.map((s) => s.name),
          explain: `Fewest links to cut: ${SHAPES.map((s) => `${s.short} ${s.k}`).join(', ')}. Cutting off one node takes as many cuts as it has links, and here that is also the weakest spot. More separate routes, more robust.`,
        },
        {
          kind: 'task',
          body: 'The orange links are bridges. Add **one link** (tap its two ends) so that no single link failure can split the network.',
          widget: addBackup(TR),
          hint: 'A link removes every bridge on the loop it closes. Join the two tips furthest apart.',
          explain: `Join F and H. That closes a loop F–E–D–A–B–G–H–F (or through C instead of A), and every one of the ${TR_BR.length} bridges lies on it, so each now has a way round.`,
        },
        {
          kind: 'number', prob: true,
          body: 'Each link works 90% of the time, independently. A and B are joined by **two separate routes**, each 3 links long. What is the chance A can still reach B?',
          answer: 1 - Math.pow(1 - 0.729, 2), tol: 0.005,
          hint: 'One route: 0.9³. Both fail: (1 − 0.9³)².',
          explain: 'One route works with 0.9³ = 0.729. Both fail with 0.271² ≈ 0.073. So the chance of a connection is ≈ 0.927: redundancy turned 73% into 93%.',
        },
        {
          kind: 'read',
          title: 'Accidents versus attacks',
          body: 'The 1,000-node rich-get-richer network again. Knock out nodes **at random** (accidents) or **biggest hubs first** (an attack), and track the largest piece still connected.',
          widget: () => { const a = ATTACK(); return h('div', null, plotEl({
            x: [0, 1], y: [0, 1], size: [360, 240], xlabel: 'share removed', ylabel: 'largest piece', ticks: [0.2, 0.25], tickFormat: (v) => pct(v, 0),
            layers: [{ type: 'line', pts: a.random, color: 'var(--c1)' }, { type: 'line', pts: a.hubs, color: 'var(--bad)' }],
          }), legend([['var(--c1)', 'random failures'], ['var(--bad)', 'hubs removed first']])); },
        },
        {
          kind: 'estimate',
          body: 'Removing hubs first, what share of the nodes must go before the largest connected piece falls **below half** the network?',
          widget: () => { const a = ATTACK(); return plotEl({ x: [0, 0.5], y: [0, 1], size: [360, 220], xlabel: 'share removed', ticks: [0.1, 0.25], tickFormat: (v) => pct(v, 0), layers: [{ type: 'line', pts: a.hubs.filter((p) => p[0] <= 0.5), color: 'var(--bad)' }, { type: 'hline', y: 0.5, dash: true, color: 'var(--muted)' }] }); },
          min: 0, max: 50, step: 2, answer: Math.round(firstBelow(ATTACK().hubs, 0.5) * 100), tol: 4, format: (v) => `${v}%`,
          explain: `About ${pct(firstBelow(ATTACK().hubs, 0.5), 0)}. Random failures need about ${pct(firstBelow(ATTACK().random, 0.5), 0)} to do the same damage.`,
        },
        {
          kind: 'choice',
          body: 'Why do random failures barely hurt a hub network?',
          options: [
            opt('Most nodes are minor, so random failures rarely hit a hub', true),
            opt('Random failures avoid important nodes on purpose', false, 'Random means no aim at all; hubs are spared only because they are rare.'),
            opt('Hub networks have more links in total', false, `The random network from lesson 3 has exactly the same ${num(BA().reduce((t, x) => t + x.length, 0) / 2)} links. What differs is how they are shared out.`),
          ],
          explain: `About ${pct(BA_STATS().below, 0)} of nodes have below-average links. A random failure almost always takes out one of those, and the hubs hold everything together.`,
        },
        {
          kind: 'choice',
          body: 'A **random** network with the same number of links but no hubs is attacked hubs-first. Compared with the hub network, it…',
          options: [
            opt('holds out much longer', true),
            opt('collapses sooner', false, `Its best-connected nodes have only about ${ER_STATS().max} links, so removing them does little extra damage.`),
            opt('behaves exactly the same', false, 'The degree distribution is the whole difference: no hubs, no Achilles’ heel.'),
          ],
          explain: `It keeps a majority connected until about ${pct(firstBelow(ATTACK().erHubs, 0.5), 0)} are removed, against ${pct(firstBelow(ATTACK().hubs, 0.5), 0)} for the hub network. Hubs make a network robust to accidents but fragile to attacks.`,
        },
        {
          kind: 'match',
          body: 'Match each term to its meaning.',
          heads: ['Term', 'Meaning'],
          pairs: [
            ['Bridge', 'A link whose loss disconnects the network'],
            ['Cut node', 'A node whose loss disconnects the network'],
            ['Redundancy', 'A separate backup route'],
            ['Giant component', 'The largest piece that is still connected'],
          ],
          explain: 'Bridges and cut nodes are single points of failure; redundancy removes them; the giant component measures what still works.',
        },
        {
          kind: 'fill',
          body: 'Summing up.',
          template: 'Networks with hubs are robust to [[0]] failures but fragile to [[1]] attacks.',
          blanks: [{ options: ['random', 'targeted'], answer: 0 }, { options: ['targeted', 'random'], answer: 0 }],
          explain: 'The same hubs that keep everything joined when failures are random are the obvious target for an attacker, or the obvious place to vaccinate.',
        },
      ],
      practice: [genReliable, genBridges, genPieces],
    },
  ],
};
