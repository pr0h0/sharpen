// How AI Works: learning from examples, decision boundaries, measuring error, gradient descent,
// neurons, overfitting, language models and using AI wisely. Every number shown or asked for is
// computed here from the data below (fits, gradient steps, confusion counts, bigram counts).
import type { Choice, Course, Generator, Layer, PlotSpec } from '../types';
import { h, num, pct, pick, randInt, seeded, shuffle } from '../ui';
import { barChart, dataTable, iconArray } from '../viz/charts';
import { explorer, plotExplorer, stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  GATES, HAM, INPUTS, LEMON, LIME, SPAM, bigrams, chips, confusion, countAt, gateExplorer, gateName,
  legend, mse, netDiagram, neuron, neuronDiagram, note, pixels, polyfit, relu, scatterSpec, scoreSpec, sigmoid,
  stepFn, table, temper, type Counts, type Pt,
} from '../widgets/ai';

// ---------------------------------------------------------------- shared helpers

/** Fill-in tiles: the right text first (the player shuffles), distractors de-duplicated. */
function tiles(right: string, wrong: string[]): { options: string[]; answer: number } {
  const opts = [right];
  for (const w of wrong) if (!opts.includes(w)) opts.push(w);
  return { options: opts, answer: 0 };
}
const pt = (p: Pt) => `(${num(p[0])}, ${num(p[1])})`;
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fruitLegend = () => legend([[LIME, 'lime'], [LEMON, 'lemon']]);
const withLegend = (el: HTMLElement, lg: HTMLElement) => h('div', null, el, lg);

// ---------------------------------------------------------------- lesson 1-2 data: limes and lemons

const LIMES: Pt[] = [[3, 2], [4, 3], [2.5, 4], [5, 2.5], [4.5, 4.5], [3, 5.5], [6, 1.5], [5.5, 3.5]];
const LEMONS: Pt[] = [[7, 5], [6, 6.5], [8, 4], [5.5, 7], [7.5, 6.5], [8.5, 5.5], [6.5, 8], [4.5, 8]];
const FRUIT: { p: Pt; lemon: boolean }[] = [...LIMES.map((p) => ({ p, lemon: false })), ...LEMONS.map((p) => ({ p, lemon: true }))];

const NEW_FRUIT: Pt = [7.5, 7];
const PLACE: Pt = [6.5, 3];

// Sizes only: the two classes overlap.
const maxLimeSize = Math.max(...LIMES.map((p) => p[0]));
const minLemonSize = Math.min(...LEMONS.map((p) => p[0]));

// One feature (yellowness) for the first threshold task.
const Y_LIME = [1, 2, 2.5, 3.5, 4];
const Y_LEMON = [6, 6.5, 7.5, 8, 9];
const cutMistakes = (t: number) => Y_LIME.filter((y) => y > t).length + Y_LEMON.filter((y) => y <= t).length;
const CUT_GRID = Array.from({ length: 21 }, (_, k) => k / 2);
const GOOD_CUTS = CUT_GRID.filter((t) => cutMistakes(t) === 0);
const GAP_MID = (Math.max(...Y_LIME) + Math.min(...Y_LEMON)) / 2;

function cutSpec(t: number): PlotSpec {
  return {
    x: [0, 10], y: [-0.8, 1.8], size: [440, 190], ticks: [1, 10], grid: false, xlabel: 'yellowness',
    tickFormat: (v) => (v < -0.5 ? '' : String(v)),
    layers: [
      { type: 'area', f: () => 1.8, base: () => -0.8, from: t, to: 10, color: LEMON },
      { type: 'vline', x: t, color: 'var(--text)' },
      { type: 'dots', pts: Y_LIME.map((y) => [y, 0] as Pt), color: LIME, r: 8 },
      { type: 'dots', pts: Y_LEMON.map((y) => [y, 1] as Pt), color: LEMON, r: 8 },
      { type: 'text', x: 0.15, y: 0.35, text: 'limes', anchor: 'start', color: 'var(--muted)' },
      { type: 'text', x: 0.15, y: 1.35, text: 'lemons', anchor: 'start', color: 'var(--muted)' },
    ],
  };
}

// Tilted line: lemon if yellowness > m * size + b.
const lineMistakes = (m: number, b: number) => FRUIT.filter(({ p, lemon }) => (p[1] > m * p[0] + b) !== lemon).length;
const LINE_SOLUTIONS: [number, number][] = [];
for (let mi = 0; mi <= 16; mi++) for (let bi = 0; bi <= 32; bi++) {
  const m = -3 + mi * 0.25, b = bi * 0.5;
  if (lineMistakes(m, b) === 0) LINE_SOLUTIONS.push([m, b]);
}
const LINE_TILT = LINE_SOLUTIONS.filter(([m]) => m === -1);
const LINE_EX: [number, number] = LINE_TILT[Math.floor(LINE_TILT.length / 2)] ?? LINE_SOLUTIONS[0] ?? [-1, 10.5];
const flatWorks = LINE_SOLUTIONS.some(([m]) => m === 0);

const lineLayers = (m: number, b: number): Layer[] => [
  { type: 'area', f: () => 10, base: (x) => m * x + b, from: 0, to: 10, color: LEMON },
  { type: 'fn', f: (x) => m * x + b, color: 'var(--text)', width: 2.5 },
];

// Sum rule used in the fill and sort steps: lemon if size + yellowness > 10.
const SUM_RULE = 10;
const FILL_FRUIT: Pt = [7, 2];
const SORT_FRUIT: Pt[] = [[3, 8], [6, 3], [8, 4], [2, 7], [5, 5.5], [4.5, 5]];

// Nearest neighbour.
const STAR: Pt = [5.5, 5];
const byDist = FRUIT.map((f) => ({ ...f, d: dist(f.p, STAR) })).sort((a, b) => a.d - b.d);
const NEAREST = byDist[0];

function nnLabel(q: Pt, data: { p: Pt; lemon: boolean }[], k: number): boolean {
  const near = data.map((f) => ({ ...f, d: dist(f.p, q) })).sort((a, b) => a.d - b.d).slice(0, k);
  return near.filter((f) => f.lemon).length * 2 > k;
}
const NN_BG: Pt[] = [], NN_BG_LEMON: Pt[] = [];
for (let x = 0.25; x < 10; x += 0.5) for (let y = 0.25; y < 10; y += 0.5) (nnLabel([x, y], FRUIT, 1) ? NN_BG_LEMON : NN_BG).push([x, y]);

// A pile of limes with one mislabelled "lemon" among them.
const PILE: { p: Pt; lemon: boolean }[] = [
  { p: [2, 2], lemon: false }, { p: [3, 2.5], lemon: false }, { p: [2.5, 3.5], lemon: false }, { p: [3.5, 3.5], lemon: false },
  { p: [2, 4.5], lemon: false }, { p: [4, 2], lemon: false }, { p: [3, 3.2], lemon: true },
  { p: [7, 7], lemon: true }, { p: [8, 6], lemon: true }, { p: [7.5, 8], lemon: true },
];
const PILE_Q: Pt = [3.2, 3];
const PILE_1 = nnLabel(PILE_Q, PILE, 1), PILE_3 = nnLabel(PILE_Q, PILE, 3);
const fname = (lemon: boolean) => (lemon ? 'lemon' : 'lime');

function knnOptions(): Choice[] {
  const combos: [boolean, boolean][] = [[true, false], [false, false], [true, true], [false, true]];
  return combos.map(([a, b]) => {
    const text = `1-NN: ${fname(a)}, 3-NN: ${fname(b)}`;
    if (a === PILE_1 && b === PILE_3) return { text, correct: true };
    const why: string[] = [];
    if (a !== PILE_1) why.push(`The single closest fruit to the grey dot is the ${fname(PILE_1)} (the mislabelled one), so 1-NN copies “${fname(PILE_1)}”.`);
    if (b !== PILE_3) why.push(`Of the three closest, ${PILE_3 ? 'two are lemons' : 'two are limes'}, so the 3-NN vote says “${fname(PILE_3)}”.`);
    return { text, why: why.join(' ') };
  });
}

// ---------------------------------------------------------------- lesson 3 data: a spam filter

const SPAM_SCORES = [0.95, 0.9, 0.85, 0.8, 0.7, 0.62, 0.55, 0.4];
const HAM_SCORES = [0.72, 0.52, 0.45, 0.38, 0.33, 0.27, 0.22, 0.18, 0.12, 0.08, 0.04, 0.02];
const AT_HALF = countAt(SPAM_SCORES, HAM_SCORES, 0.5);
const accOf = (m: Counts) => (m.tp + m.tn) / (m.tp + m.tn + m.fp + m.fn);
const precOf = (m: Counts) => m.tp / (m.tp + m.fp);
const recOf = (m: Counts) => m.tp / (m.tp + m.fn);
const T_GRID = Array.from({ length: 21 }, (_, k) => k / 20);
const BEST_SAFE_TP = Math.max(...T_GRID.map((t) => countAt(SPAM_SCORES, HAM_SCORES, t)).filter((m) => m.fp === 0).map((m) => m.tp));
const SAFE_TS = T_GRID.filter((t) => { const m = countAt(SPAM_SCORES, HAM_SCORES, t); return m.fp === 0 && m.tp === BEST_SAFE_TP; });

// A rare disease and a test.
const RARE = { n: 1000, sick: 10, caught: 9, falseAlarms: 50 };
const RARE_PREC = RARE.caught / (RARE.caught + RARE.falseAlarms);

function countTiles(n: number): { options: string[]; answer: number } {
  return tiles(String(n), [String(n + 1), String(n > 0 ? n - 1 : n + 2), String(n + 3)]);
}

// ---------------------------------------------------------------- lesson 4 data: gradient descent

const A0 = 3; // bottom of the valley
const loss = (w: number) => (w - A0) ** 2 + 1;
const slope = (w: number) => 2 * (w - A0);
function descend(w0: number, eta: number, n: number): number[] {
  const ws = [w0];
  for (let i = 0; i < n; i++) ws.push(ws[i] - eta * slope(ws[i]));
  return ws;
}
const valley = (extra: Layer[] = []): PlotSpec => ({
  x: [-1, 7], y: [0, 18], size: [440, 280], ticks: [1, 5], xlabel: 'w', ylabel: 'loss',
  layers: [{ type: 'fn', f: loss, color: 'var(--c1)' }, ...extra],
});
const tangent = (w: number, half = 1.2): Layer => ({ type: 'fn', f: (x) => loss(w) + slope(w) * (x - w), from: w - half, to: w + half, color: 'var(--c2)', width: 2, dash: true });
const ball = (w: number): Layer => ({ type: 'dots', pts: [[w, loss(w)]], color: 'var(--c2)', r: 8 });

const PLAY_ETA = 0.25, PLAY_W0 = -1;
const PLAY_PATH = descend(PLAY_W0, PLAY_ETA, 7);

const FILL_W = 6, FILL_ETA = 0.25;
const FILL_SLOPE = slope(FILL_W), FILL_STEP = FILL_ETA * FILL_SLOPE, FILL_NEW = FILL_W - FILL_STEP;

const TWO_W0 = 0;
const TWO = descend(TWO_W0, PLAY_ETA, 2);

const LR_STEPS = 6, LR_TOL = 0.05;

type LrKind = 'slow' | 'one' | 'zigzag' | 'stuck' | 'diverge';
/** For loss c·(w − a)², each step multiplies the distance to the bottom by (1 − 2cη). */
function lrKind(eta: number, c = 1): LrKind {
  const f = 1 - 2 * c * eta;
  if (Math.abs(f) < 1e-9) return 'one';
  if (f > 0) return 'slow';
  if (f > -1 + 1e-9) return 'zigzag';
  if (Math.abs(f + 1) < 1e-9) return 'stuck';
  return 'diverge';
}
const LR_TEXT: Record<LrKind, string> = {
  slow: 'Slides toward the bottom without overshooting',
  one: 'Lands exactly on the bottom in one step',
  zigzag: 'Overshoots and zig-zags, but settles',
  stuck: 'Bounces between two points forever',
  diverge: 'Bounces farther out every step',
};

// Line through the origin fitted to three points.
const LINE_PTS: Pt[] = [[1, 3], [2, 5], [3, 5]];
const lineMse = (w: number) => mse((x) => w * x, LINE_PTS);
const W_BEST = LINE_PTS.reduce((s, [x, y]) => s + x * y, 0) / LINE_PTS.reduce((s, [x]) => s + x * x, 0);
const W_TRY = 1;
function fitSpec(w: number): PlotSpec {
  return {
    x: [0, 4], y: [0, 10], size: [440, 280], ticks: [1, 2], xlabel: 'x', ylabel: 'y',
    layers: [
      ...LINE_PTS.map(([x, y]): Layer => ({ type: 'line', pts: [[x, y], [x, w * x]], color: 'var(--bad)', width: 2, dash: true })),
      { type: 'fn', f: (x) => w * x, color: 'var(--c1)' },
      { type: 'dots', pts: LINE_PTS, color: 'var(--c2)', r: 7 },
    ],
  };
}

// ---------------------------------------------------------------- lesson 5 data: neurons

const FILL_N = { w1: 2, w2: -1, b: -0.5, x: [1, 1] as Pt };
const FILL_N_SUM = FILL_N.w1 * FILL_N.x[0] + FILL_N.w2 * FILL_N.x[1] + FILL_N.b;

const OR_CANDIDATES: [number, number, number][] = [[1, 1, -0.5], [2, 2, -1], [1, 1, -1.5], [1, -1, 0], [-1, -1, 1.5]];
const orOptions: Choice[] = OR_CANDIDATES.map(([a, b, c]) => {
  const f = neuron(a, b, c);
  const text = `w₁ = ${num(a)}, w₂ = ${num(b)}, b = ${num(c)}`;
  if (table(f) === table(GATES.OR)) return { text, correct: true };
  return { text, why: `This one outputs ${table(f).split('').join(', ')} for inputs 00, 01, 10, 11: that’s ${gateName(f) ?? 'not OR'}, not OR (0, 1, 1, 1).` };
});

const XOR_NET = { h1: [1, 1, -0.5] as const, h2: [-1, -1, 1.5] as const, o: [1, 1, -1.5] as const };
const xorNet = (a: number, b: number) => {
  const h1 = neuron(...XOR_NET.h1)(a, b), h2 = neuron(...XOR_NET.h2)(a, b);
  return { h1, h2, out: neuron(...XOR_NET.o)(h1, h2) };
};
const XOR_IN: Pt = [1, 0];
const XOR_TRACE = xorNet(...XOR_IN);
const xorDiagram = () => netDiagram(
  [[{ label: 'x₁' }, { label: 'x₂' }], [{ label: 'h₁', sub: `OR · bias ${num(XOR_NET.h1[2])}` }, { label: 'h₂', sub: `NAND · bias ${num(XOR_NET.h2[2])}` }], [{ label: 'out', sub: `AND · bias ${num(XOR_NET.o[2])}`, hi: true }]],
  [
    { from: [0, 0], to: [1, 0], w: num(XOR_NET.h1[0]) }, { from: [0, 1], to: [1, 0], w: num(XOR_NET.h1[1]) },
    { from: [0, 0], to: [1, 1], w: '−1' }, { from: [0, 1], to: [1, 1], w: '−1' },
    { from: [1, 0], to: [2, 0], w: num(XOR_NET.o[0]) }, { from: [1, 1], to: [2, 0], w: num(XOR_NET.o[1]) },
  ], { height: 190 });

/** Can one step neuron (weights on a 0.5 grid) compute this gate? Brute force. */
function oneNeuronCan(g: (a: number, b: number) => number): boolean {
  const want = table(g);
  for (let w1 = -4; w1 <= 4; w1++) for (let w2 = -4; w2 <= 4; w2++) for (let b = -6; b <= 6; b++)
    if (table(neuron(w1 / 2, w2 / 2, b / 2)) === want) return true;
  return false;
}
const XNOR = (a: number, b: number) => 1 - (a ^ b);
const GATE_SORT: [string, (a: number, b: number) => number][] = [
  ['AND', GATES.AND], ['OR', GATES.OR], ['NAND (not both)', GATES.NAND], ['NOR (neither)', GATES.NOR], ['XOR (exactly one)', GATES.XOR], ['XNOR (both the same)', XNOR],
];

function cornersSpec(f: (a: number, b: number) => number, extra: Layer[] = []): PlotSpec {
  const on = INPUTS.filter(([a, b]) => f(a, b) === 1), off = INPUTS.filter(([a, b]) => f(a, b) === 0);
  return {
    x: [-0.5, 1.5], y: [-0.5, 1.5], size: [360, 300], ticks: [0.5, 0.5], xlabel: 'x₁', ylabel: 'x₂',
    layers: [...extra, { type: 'dots', pts: on, color: 'var(--c1)', r: 10, labels: on.map(() => '1') }, { type: 'dots', pts: off, color: 'var(--muted)', r: 10, labels: off.map(() => '0') }],
  };
}

const NET_SIZES = [4, 3, 2];
const countWeights = (sizes: number[]) => sizes.slice(1).reduce((s, n, i) => s + n * sizes[i], 0);

// ---------------------------------------------------------------- lesson 6 data: overfitting

const TRUE_F = (x: number) => 1 + 1.2 * x - 0.09 * x * x;
const TRAIN_X = [0.5, 1.7, 3, 4.2, 5.5, 6.6, 8, 9.3], TRAIN_NOISE = [0.5, -0.6, 0.4, -0.3, 0.6, -0.5, 0.3, -0.45];
const TEST_X = [1, 2.4, 3.6, 5, 6.1, 7.3, 8.7, 9.8], TEST_NOISE = [-0.3, 0.4, -0.5, 0.35, -0.2, 0.45, -0.4, 0.3];
const round2 = (v: number) => Math.round(v * 100) / 100;
const TRAIN: Pt[] = TRAIN_X.map((x, i) => [x, round2(TRUE_F(x) + TRAIN_NOISE[i])]);
const TEST: Pt[] = TEST_X.map((x, i) => [x, round2(TRUE_F(x) + TEST_NOISE[i])]);
const fitDeg = (d: number, pts: Pt[] = TRAIN) => polyfit(pts.map((p) => p[0]), pts.map((p) => p[1]), d);
const DEGS = [0, 1, 2, 3, 4, 5, 6, 7];
const FITS = DEGS.map((d) => fitDeg(d));
const TRAIN_ERR = FITS.map((f) => mse(f, TRAIN));
const TEST_ERR = FITS.map((f) => mse(f, TEST));
const BEST_DEG = TEST_ERR.indexOf(Math.min(...TEST_ERR));
const SIMPLE_DEG = BEST_DEG, WIGGLY_DEG = 7;
const ORDER_DEGS = [0, 1, 3, 7].sort((a, b) => TRAIN_ERR[b] - TRAIN_ERR[a]);
const degName = (d: number) => (d === 0 ? 'degree 0 (a flat line)' : d === 1 ? 'degree 1 (a straight line)' : d === 2 ? 'degree 2 (a parabola)' : `degree ${d}`);
const e2 = (v: number) => (v >= 10 ? num(v, 3) : v.toFixed(2));

function curveSpec(curves: { f: (x: number) => number; color: string; dash?: boolean }[], showTest: boolean, train: Pt[] = TRAIN): PlotSpec {
  return {
    x: [0, 10], y: [-1, 9], size: [440, 300], ticks: [2, 2], xlabel: 'x', ylabel: 'y',
    layers: [
      ...curves.map((c): Layer => ({ type: 'fn', f: c.f, color: c.color, dash: c.dash })),
      { type: 'dots', pts: train, color: 'var(--c1)', r: 6 },
      ...(showTest ? [{ type: 'dots', pts: TEST, color: 'var(--c2)', r: 6 } as Layer] : []),
    ],
  };
}
const trainTestLegend = (test = true) => legend(test ? [['var(--c1)', 'training points'], ['var(--c2)', 'test points (held back)']] : [['var(--c1)', 'training points']]);

// More data: degree 7 fitted to 8, 16 and 40 points from the same curve.
const MORE_N = [8, 16, 40];
const MORE_SETS: Pt[][] = MORE_N.map((n, k) => {
  if (k === 0) return TRAIN;
  const r = seeded(1000 + n);
  return Array.from({ length: n }, (_, i) => {
    const x = 0.3 + (9.4 * (i + 0.5)) / n;
    return [x, round2(TRUE_F(x) + (r() - 0.5) * 1.2)] as Pt;
  });
});
const MORE_FITS = MORE_SETS.map((s) => fitDeg(7, s));
const MORE_TEST = MORE_FITS.map((f) => mse(f, TEST));

// ---------------------------------------------------------------- lesson 7 data: a bigram model

const CORPUS = 'the cat sat on the mat . the dog sat on the rug . the cat ate the fish . the dog saw the cat . the cat sat on the dog .';
const TOK = CORPUS.split(' ');
const BG = bigrams(TOK);
const followers = (w: string) => Object.entries(BG[w] ?? {}).sort((a, b) => b[1] - a[1]);
const totalAfter = (w: string) => followers(w).reduce((s, [, n]) => s + n, 0);
const P = (a: string, b: string) => (BG[a]?.[b] ?? 0) / totalAfter(a);
const THE_COUNT = TOK.filter((t) => t === 'the').length;
const AFTER_THE = followers('the');
const THE_PROBS = AFTER_THE.map(([, n]) => n / totalAfter('the'));
const TOP_THE = AFTER_THE[0][0];

function greedy(start: string, n: number): string[] {
  const out: string[] = [];
  let w = start;
  for (let i = 0; i < n; i++) {
    const f = followers(w);
    if (f.length > 1 && f[0][1] === f[1][1]) throw new Error(`greedy tie after ${w}`);
    w = f[0][0];
    out.push(w);
  }
  return out;
}
const GREEDY_START = 'cat';
const GREEDY = greedy(GREEDY_START, 4);

const canSay = (s: string) => { const t = s.split(' '); return t.every((w, i) => i === 0 || (BG[t[i - 1]]?.[w] ?? 0) > 0); };
const SENTENCES = CORPUS.split(' . ').map((s) => s.replace(/ \.$/, '') + ' .');
const inCorpus = (s: string) => SENTENCES.includes(s);
const CANDIDATES = ['the dog sat on the mat .', 'the cat sat on the rug .', 'the dog saw the cat sat on the dog .', 'the dog ate the fish .', 'the fish sat on the mat .', 'the cat sat on the mat .'];
const sentenceOptions: Choice[] = CANDIDATES.map((s) => {
  const ok = canSay(s), seen = inCorpus(s);
  if (ok && !seen) return { text: `“${s}”`, correct: true };
  if (seen) return { text: `“${s}”`, why: 'That sentence is already in the text word for word, so it isn’t new.' };
  const t = s.split(' ');
  const k = t.findIndex((w, i) => i > 0 && !(BG[t[i - 1]]?.[w]));
  return { text: `“${s}”`, why: `The text never has “${t[k - 1]}” followed by “${t[k]}”, so the model gives that step probability 0.` };
});

const TEMP_GOAL = 0.8;
const tempTop = (T: number) => temper(THE_PROBS, T)[0];

const SYD = 'the biggest city is sydney . the oldest city is sydney . the harbour city is sydney . the capital is canberra .';
const SYD_BG = bigrams(SYD.split(' '));
const SYD_AFTER = Object.entries(SYD_BG['is']).sort((a, b) => b[1] - a[1]);
const SYD_TOTAL = SYD_AFTER.reduce((s, [, n]) => s + n, 0);
const SYD_TOP = SYD_AFTER[0][0], SYD_P = SYD_AFTER[0][1] / SYD_TOTAL;

// ---------------------------------------------------------------- lesson 8 data

const HIRES = { a: 180, b: 12 };
const GROUPS = { a: 900, b: 100, accA: 0.98, accB: 0.8 };
const OVERALL = (GROUPS.a * GROUPS.accA + GROUPS.b * GROUPS.accB) / (GROUPS.a + GROUPS.b);
const CHAIN = { p: 0.9, n: 20 };
const XRAY = ['##..........', '##..+....+..', '...++....++.', '...++++++++.', '..+++.++.+++', '..++++++++++', '..+++.++.+++', '..++++++++++', '...+++++++..', '....+++++...'];
const CHAIN_ALL = CHAIN.p ** CHAIN.n;

// ---------------------------------------------------------------- practice generators

const genPlace: Generator = (rng) => {
  const p: Pt = [randInt(rng, 2, 18) / 2, randInt(rng, 2, 18) / 2];
  return {
    kind: 'point',
    body: `A new fruit measures **${num(p[0])} cm** across and scores **${num(p[1])}** on yellowness. Place it on the plot.`,
    plot: scatterSpec(LIMES, LEMONS),
    answer: { x: p[0], y: p[1] }, tol: 0.3, snap: 0.5,
    hint: 'Size is across (x), yellowness is up (y).',
    explain: `Each example is a point: its features are its coordinates, ${pt(p)}. The model only ever sees those numbers.`,
  };
};

const TASKS: [string, string, string][] = [
  ['house-price model', 'floor area', 'sale price'],
  ['spam filter', 'number of links', 'spam or not'],
  ['cat detector', 'pixel brightness values', 'cat or no cat'],
  ['film recommender', 'films you rated before', 'your rating of a new film'],
  ['loan model', 'income', 'repaid or defaulted'],
  ['weather model', 'today’s air pressure', 'tomorrow’s rainfall'],
];
const genFeatureLabel: Generator = (rng) => {
  const ts = shuffle(rng, TASKS).slice(0, 3);
  return {
    kind: 'sort',
    body: `Three models: a ${ts[0][0]}, a ${ts[1][0]} and a ${ts[2][0]}. Sort each item into **feature** (what the model is given) or **label** (what it must predict).`,
    bins: ['Feature (input)', 'Label (answer)'],
    items: shuffle(rng, ts.flatMap(([m, f, l]) => [{ text: `${f} (${m})`, bin: 0 }, { text: `${l} (${m})`, bin: 1 }])),
    hint: 'The label is the thing you’d like to know but don’t yet.',
    explain: ts.map(([m, f, l]) => `${m}: given ${f}, predict ${l}.`).join(' '),
  };
};

const genPixels: Generator = (rng) => {
  const w = pick(rng, [8, 16, 20, 28, 32, 64]), hh = pick(rng, [8, 16, 20, 28, 32, 64]);
  const colour = rng() < 0.5;
  const n = w * hh * (colour ? 3 : 1);
  return {
    kind: 'number',
    body: `An image classifier reads a ${colour ? '**colour**' : '**greyscale**'} picture of ${w} × ${hh} pixels. ${colour ? 'Each pixel has three numbers (red, green, blue).' : 'Each pixel is one brightness number.'} How many input features is that?`,
    answer: n, tol: 0.5,
    hint: colour ? 'Pixels times numbers per pixel.' : 'Count the pixels.',
    explain: `${w} × ${hh} = ${num(w * hh)} pixels${colour ? `, × 3 channels = ${num(n)}` : ''}. To the model, a picture is just a long list of numbers.`,
  };
};

const genSide: Generator = (rng) => {
  const a = randInt(rng, 1, 3), b = randInt(rng, 1, 3), c = randInt(rng, 3 * (a + b), 6 * (a + b));
  let pts: Pt[] = [];
  for (let tries = 0; tries < 50; tries++) {
    pts = [];
    for (let guard = 0; pts.length < 5 && guard < 200; guard++) {
      const p: Pt = [randInt(rng, 0, 9), randInt(rng, 0, 9)];
      const s = a * p[0] + b * p[1];
      if (s === c || pts.some((q) => q[0] === p[0] && q[1] === p[1])) continue;
      pts.push(p);
    }
    const lemons = pts.filter((p) => a * p[0] + b * p[1] > c).length;
    if (lemons >= 1 && lemons <= 4) break;
  }
  const rule = `${a === 1 ? '' : a + ' × '}size + ${b === 1 ? '' : b + ' × '}yellowness > ${c}`;
  return {
    kind: 'sort',
    body: `A model calls a fruit a **lemon** when **${rule}**, otherwise a lime. Sort these fruits, written as (size, yellowness).`,
    bins: ['Lemon', 'Lime'],
    items: pts.map((p) => ({ text: pt(p), bin: a * p[0] + b * p[1] > c ? 0 : 1 })),
    hint: 'Work out the weighted sum for each one and compare it with the cutoff.',
    explain: pts.map((p) => `${pt(p)}: ${a * p[0] + b * p[1]} ${a * p[0] + b * p[1] > c ? '>' : '<'} ${c}`).join('; ') + '.',
  };
};

const genNearest: Generator = (rng) => {
  for (;;) {
    const lime: Pt[] = [], lemon: Pt[] = [];
    const used = new Set<string>();
    const fresh = (lo: number, hi: number): Pt => {
      for (;;) { const p: Pt = [randInt(rng, lo, hi), randInt(rng, lo, hi)]; const k = p.join(); if (!used.has(k)) { used.add(k); return p; } }
    };
    for (let i = 0; i < 4; i++) lime.push(fresh(1, 6));
    for (let i = 0; i < 4; i++) lemon.push(fresh(4, 9));
    const q: Pt = [randInt(rng, 2, 16) / 2, randInt(rng, 2, 16) / 2];
    if (used.has(q.join())) continue;
    const all = [...lime.map((p) => ({ p, lemon: false })), ...lemon.map((p) => ({ p, lemon: true }))].map((f) => ({ ...f, d: dist(f.p, q) })).sort((a, b) => a.d - b.d);
    if (all[1].d - all[0].d < 0.6 || all[0].d < 0.6) continue;
    const near = all[0];
    return {
      kind: 'point',
      body: `New fruit at the grey dot ${pt(q)}. Tap the **labelled fruit nearest to it**. What would 1-nearest-neighbour call it?`,
      plot: scatterSpec(lime, lemon, { top: [{ type: 'dots', pts: [q], color: 'var(--muted)', r: 7, labels: ['?'] }] }),
      answer: { x: near.p[0], y: near.p[1] }, tol: 0.4, snap: 0.5,
      hint: 'Straight-line distance: compare a few candidates with Pythagoras if it’s close.',
      explain: `The closest is the ${fname(near.lemon)} at ${pt(near.p)}, ${num(near.d, 3)} away (next: ${num(all[1].d, 3)}). So 1-NN calls the new fruit a ${fname(near.lemon)}.`,
    };
  }
};

const TRIPLES: [number, number][] = [[3, 4], [6, 8], [5, 12], [1, 1], [2, 3], [1, 2], [4, 4], [8, 6]];
const genDistance: Generator = (rng) => {
  const [dx, dy] = pick(rng, TRIPLES);
  const a: Pt = [randInt(rng, 0, 3), randInt(rng, 0, 3)];
  const b: Pt = [a[0] + dx, a[1] + dy];
  const d = Math.hypot(dx, dy);
  return {
    kind: 'number',
    body: `Nearest-neighbour models measure similarity as distance. How far apart are the examples ${pt(a)} and ${pt(b)}?`,
    answer: d, tol: 0.01,
    hint: 'Pythagoras: √(difference in x² + difference in y²).',
    explain: `√(${dx}² + ${dy}²) = √${dx * dx + dy * dy} ${Number.isInteger(d) ? '=' : '≈'} ${num(d, 4)}.`,
  };
};

const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const par = (v: number) => (v < 0 ? `(${num(v)})` : num(v));
const genRates: Generator = (rng) => {
  const m: Counts = { tp: randInt(rng, 5, 40), fn: randInt(rng, 1, 15), fp: randInt(rng, 1, 30), tn: randInt(rng, 30, 150) };
  const which = pick(rng, ['accuracy', 'precision', 'recall'] as const);
  const v = which === 'accuracy' ? accOf(m) : which === 'precision' ? precOf(m) : recOf(m);
  const how = which === 'accuracy' ? `(${m.tp} + ${m.tn}) / ${m.tp + m.tn + m.fp + m.fn}` : which === 'precision' ? `${m.tp} / (${m.tp} + ${m.fp})` : `${m.tp} / (${m.tp} + ${m.fn})`;
  const q = which === 'accuracy' ? 'What is its **accuracy** (share of all cases it gets right)?' : which === 'precision' ? 'What is its **precision** (of the cases it flagged, the share that were real)?' : 'What is its **recall** (of the real cases, the share it flagged)?';
  return {
    kind: 'number', prob: true,
    body: `A fraud detector is tested: ${pl(m.tp, 'fraud', 'frauds')} flagged, ${pl(m.fn, 'fraud', 'frauds')} missed, ${pl(m.fp, 'honest payment', 'honest payments')} flagged by mistake, ${m.tn} honest payments passed. ${q}`,
    widget: () => confusion(m, { pos: 'fraud', neg: 'honest' }),
    answer: v, tol: 0.006,
    hint: which === 'accuracy' ? 'Right answers are the true positives and true negatives.' : which === 'precision' ? 'Only look at the “model says fraud” column.' : 'Only look at the “really fraud” row.',
    explain: `${how} = ${pct(v)}.`,
  };
};

const genBaseline: Generator = (rng) => {
  const n = pick(rng, [200, 500, 1000, 2000, 5000]);
  const rare = pick(rng, [0.5, 1, 2, 3, 5, 8]) / 100;
  const k = Math.max(2, Math.round(n * rare));
  const what = pick(rng, ['fraudulent transactions', 'defective parts', 'patients with the condition', 'fake reviews']);
  return {
    kind: 'number', prob: true,
    body: `In a test set of ${num(n)} cases, ${num(k)} are ${what}. A lazy model always answers “no”. What is its accuracy?`,
    answer: (n - k) / n, tol: 0.0006,
    hint: 'It is right about every case that isn’t one of the rare ones.',
    explain: `It gets the ${num(n - k)} ordinary cases right: ${num(n - k)}/${num(n)} = ${pct((n - k) / n)}, while catching none of the ${num(k)} that matter. On imbalanced data, compare with this baseline.`,
  };
};

const ERR_POOL: [string, number, string][] = [
  ['A smoke alarm goes off when someone makes toast', 0, 'a smoke alarm'],
  ['A cancer screen says all clear to a patient who has cancer', 1, 'a cancer screen'],
  ['A face unlock opens for the owner’s sibling', 0, 'a face unlock'],
  ['A fraud model lets a stolen card through', 1, 'a fraud model'],
  ['A spam filter hides a real job offer', 0, 'a spam filter'],
  ['A quality check passes a cracked part', 1, 'a quality check'],
  ['A plagiarism checker flags a student’s original essay', 0, 'a plagiarism checker'],
  ['A virus scanner misses real malware', 1, 'a virus scanner'],
];
const genErrorSort: Generator = (rng) => {
  const fp = shuffle(rng, ERR_POOL.filter((e) => e[1] === 0)).slice(0, 2), fn = shuffle(rng, ERR_POOL.filter((e) => e[1] === 1)).slice(0, 2);
  const all = shuffle(rng, [...fp, ...fn]);
  return {
    kind: 'sort',
    body: `Mistakes by ${all.map((e) => e[2]).join(', ')}. Each system is looking for something (fire, cancer, fraud…). Is each mistake a **false positive** (a false alarm) or a **false negative** (a miss)?`,
    bins: ['False positive', 'False negative'],
    items: all.map(([text, bin]) => ({ text, bin })),
    hint: 'Positive means “the thing it looks for is here”. Was that call wrong (false positive) or was a real case missed (false negative)?',
    explain: 'False positive: the system raised the alarm but nothing was there. False negative: something was there and the system said all clear.',
  };
};

const genGDStep: Generator = (rng) => {
  const a = randInt(rng, -3, 5), w = a + pick(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
  const eta = pick(rng, [0.1, 0.2, 0.25, 0.3]);
  const g = 2 * (w - a), nw = w - eta * g;
  const inner = a === 0 ? 'w' : a < 0 ? `w + ${-a}` : `w − ${a}`;
  return {
    kind: 'number',
    body: `Loss = (${inner})², so its slope is 2(${inner}). You are at **w = ${w}** with learning rate **η = ${eta}**. Where does one gradient-descent step take you?`,
    answer: nw, tol: 0.005,
    hint: 'New w = w − η × slope.',
    explain: `Slope = 2 × (${w} − ${par(a)}) = ${g}. Step = ${eta} × ${par(g)} = ${num(eta * g)}. New w = ${w} − ${par(eta * g)} = ${num(nw)}: closer to the bottom at w = ${a}.`,
  };
};

const genLR: Generator = (rng) => {
  const c = pick(rng, [1, 2]);
  const eta = c === 1 ? pick(rng, [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 1, 1.2]) : pick(rng, [0.05, 0.1, 0.25, 0.35, 0.5, 0.6]);
  const k = lrKind(eta, c);
  const f = 1 - 2 * c * eta;
  const kinds: LrKind[] = ['slow', 'one', 'zigzag', 'stuck', 'diverge'];
  return {
    kind: 'choice',
    body: `Loss = ${c === 1 ? '' : c + '·'}(w − 3)². Each gradient step multiplies your distance from the bottom by (1 − ${2 * c}η). With learning rate **η = ${eta}**, what happens?`,
    options: kinds.map((kk) => kk === k ? { text: LR_TEXT[kk], correct: true } : { text: LR_TEXT[kk], why: `The factor is 1 − ${2 * c} × ${eta} = ${num(f)}. ${kk === 'one' ? 'Only a factor of exactly 0 lands in one step.' : kk === 'slow' ? 'Smooth progress needs a factor between 0 and 1.' : kk === 'zigzag' ? 'Zig-zag-and-settle needs a factor between −1 and 0.' : kk === 'stuck' ? 'Endless bouncing needs a factor of exactly −1.' : 'Divergence needs a factor below −1.'}` }),
    ordered: true,
    hint: 'Compute the factor. Between 0 and 1: shrinks smoothly. Negative: flips side each step. Beyond −1: grows.',
    explain: `Factor = 1 − ${2 * c} × ${eta} = ${num(f)}, so: ${LR_TEXT[k].toLowerCase()}.`,
  };
};

const genMSE: Generator = (rng) => {
  const xs = [1, 2, 3];
  const w = pick(rng, [1, 1.5, 2, 2.5, 3]);
  const ys = xs.map(() => randInt(rng, 1, 9));
  const errs = xs.map((x, i) => w * x - ys[i]);
  const v = errs.reduce((s, e) => s + e * e, 0) / 3;
  const pts: Pt[] = xs.map((x, i) => [x, ys[i]]);
  return {
    kind: 'number',
    body: `The model y = ${w}·x is tested on the points ${pts.map(pt).join(', ')}. What is its **mean squared error**?`,
    widget: () => plotEl({ x: [0, 4], y: [0, 10], size: [400, 240], ticks: [1, 2], layers: [
      ...pts.map(([x, y]): Layer => ({ type: 'line', pts: [[x, y], [x, w * x]], color: 'var(--bad)', width: 2, dash: true })),
      { type: 'fn', f: (x) => w * x, color: 'var(--c1)' }, { type: 'dots', pts, color: 'var(--c2)', r: 6 }] }),
    answer: v, tol: 0.01,
    hint: 'For each point: prediction − actual, squared. Then average the three.',
    explain: `Errors: ${errs.map((e) => num(e)).join(', ')}. Squares: ${errs.map((e) => num(e * e)).join(', ')}. Mean: ${num(v, 4)}.`,
  };
};

const genNeuronOut: Generator = (rng) => {
  const w1 = pick(rng, [-2, -1, -0.5, 0.5, 1, 2, 3]), w2 = pick(rng, [-2, -1, -0.5, 0.5, 1, 2, 3]), b = pick(rng, [-2, -1.5, -1, -0.5, 0.5, 1]);
  const x1 = randInt(rng, 0, 3), x2 = randInt(rng, 0, 3);
  const z = w1 * x1 + w2 * x2 + b;
  return {
    kind: 'number',
    body: `A neuron has weights w₁ = ${num(w1)}, w₂ = ${num(w2)} and bias b = ${num(b)}. Inputs: x₁ = ${x1}, x₂ = ${x2}. What is its **weighted sum** w₁x₁ + w₂x₂ + b?`,
    widget: () => neuronDiagram(w1, w2, b),
    answer: z, tol: 0.001,
    hint: 'Multiply each input by its weight, add them, then add the bias.',
    explain: `${par(w1)}×${x1} + ${par(w2)}×${x2} + ${par(b)} = ${num(z)}. ${z > 0 ? 'Above 0, so a step neuron fires: output 1.' : 'Not above 0, so a step neuron stays at 0.'}`,
  };
};

const GATE_W: [number, number, number][] = [];
for (const w1 of [-2, -1, 1, 2]) for (const w2 of [-2, -1, 1, 2]) for (const b of [-3, -2.5, -1.5, -1, -0.5, 0.5, 1, 1.5, 2.5]) {
  const n = gateName(neuron(w1, w2, b));
  if (n && ['AND', 'OR', 'NAND', 'NOR'].includes(n)) GATE_W.push([w1, w2, b]);
}
const genGate: Generator = (rng) => {
  const [w1, w2, b] = pick(rng, GATE_W);
  const f = neuron(w1, w2, b);
  const name = gateName(f)!;
  const others = ['AND', 'OR', 'NAND', 'NOR'].filter((g) => g !== name);
  return {
    kind: 'choice',
    body: `A step neuron has w₁ = ${num(w1)}, w₂ = ${num(w2)}, b = ${num(b)}. Which gate does it compute? (Work out the output for inputs 00, 01, 10, 11.)`,
    widget: () => neuronDiagram(w1, w2, b),
    options: [
      { text: name, correct: true },
      ...others.map((g) => ({ text: g, why: `${g} gives ${table(GATES[g]).split('').join(', ')}; this neuron gives ${table(f).split('').join(', ')}.` })),
      { text: 'XOR', why: 'No single neuron can compute XOR: its 1s and 0s can’t be split by one straight line.' },
    ],
    hint: 'Try (0,0) first: the sum is just the bias.',
    explain: `Sums for 00, 01, 10, 11: ${INPUTS.map(([a, c]) => num(w1 * a + w2 * c + b)).join(', ')} → outputs ${table(f).split('').join(', ')}: that’s ${name}.`,
  };
};

const genWeights: Generator = (rng) => {
  const sizes = [randInt(rng, 2, 10), randInt(rng, 2, 8), ...(rng() < 0.5 ? [randInt(rng, 2, 6)] : []), randInt(rng, 1, 4)];
  const withBias = rng() < 0.5;
  const w = countWeights(sizes), bias = sizes.slice(1).reduce((s, n) => s + n, 0);
  const ans = withBias ? w + bias : w;
  return {
    kind: 'number',
    body: `A fully connected network has layers of ${sizes.join(', ')} neurons (inputs first). Every neuron connects to every neuron in the next layer. How many ${withBias ? '**weights plus biases** (one bias per non-input neuron)' : '**weights** (connections)'} does it have?`,
    answer: ans, tol: 0.5,
    hint: 'Between two layers of sizes a and b there are a × b connections.',
    explain: `${sizes.slice(1).map((n, i) => `${sizes[i]}×${n}`).join(' + ')} = ${w} weights${withBias ? `, plus ${bias} biases = ${ans}` : ''}.`,
  };
};

const genDiagnose: Generator = (rng) => {
  const kind = pick(rng, ['under', 'over', 'good'] as const);
  const tr = kind === 'under' ? randInt(rng, 25, 40) : kind === 'over' ? randInt(rng, 0, 3) : randInt(rng, 4, 9);
  const te = kind === 'under' ? tr + randInt(rng, 0, 4) : kind === 'over' ? randInt(rng, 25, 45) : tr + randInt(rng, 1, 3);
  const opts: Record<typeof kind, string> = { under: 'Underfitting: too simple', over: 'Overfitting: memorised the training data', good: 'A good fit' };
  const whys: Record<typeof kind, string> = {
    under: 'Underfitting shows up as high error on the training data itself.',
    over: 'Overfitting shows up as a big gap: low training error, much higher test error.',
    good: 'A good fit has low error on both, with only a small gap.',
  };
  return {
    kind: 'choice',
    body: `A model gets **${tr}%** error on its training data and **${te}%** error on held-back test data. What does that suggest?`,
    options: (['under', 'over', 'good'] as const).map((k) => k === kind ? { text: opts[k], correct: true } : { text: opts[k], why: whys[k] }),
    ordered: true,
    hint: 'Look at the training error first, then at the gap.',
    explain: kind === 'under' ? `${tr}% wrong even on data it trained on: it can’t capture the pattern. Try a richer model.` : kind === 'over' ? `${tr}% on training but ${te}% on new data: it learned the specifics of the training set, not the pattern.` : `Low error on both (${tr}% and ${te}%), small gap: it generalises.`,
  };
};

const genMemorize: Generator = (rng) => {
  const n = pick(rng, [200, 400, 500, 1000]);
  const share = pick(rng, [10, 15, 20, 25, 30, 40]) / 100;
  const def = pick(rng, ['not spam', 'genuine', 'no']);
  return {
    kind: 'number', prob: true,
    body: `A “model” simply memorises its training emails, so its training accuracy is 100%. On ${num(n)} **new** emails it has never seen, it always falls back to “${def}”. ${pct(share, 0)} of the new emails are spam. What is its test accuracy?`,
    answer: 1 - share, tol: 0.006,
    hint: 'Its fallback answer is right for every email that isn’t spam.',
    explain: `It is right on the ${pct(1 - share, 0)} that aren’t spam and wrong on every spam: ${pct(1 - share, 0)}. Perfect training accuracy said nothing about new data.`,
  };
};

const genBestDegree: Generator = (rng) => {
  const best = randInt(rng, 1, 6);
  const curv = pick(rng, [0.6, 0.9, 1.2, 1.5]);
  const floor = randInt(rng, 2, 6);
  const tr = Array.from({ length: 9 }, (_, d) => Math.max(0.4, floor + 9 * Math.exp(-0.6 * d) - 0.5 * d));
  const te = Array.from({ length: 9 }, (_, d) => tr[d] + curv * (d - best) ** 2 * 0.5 + (d > best ? 1 : 0) + 1);
  const bestTest = te.indexOf(Math.min(...te));
  const top = Math.ceil(Math.max(...te.slice(0, 9)) / 5) * 5;
  const n = pick(rng, [50, 100, 200, 500, 1000]);
  return {
    kind: 'point',
    body: `Models of degree 0 to 8 were fitted to ${n} training examples. Here are their training error (blue) and test error (orange). Tap the degree you would **choose**.`,
    plot: { x: [0, 8], y: [0, Math.min(top, 40)], size: [440, 280], ticks: [1, 5], xlabel: 'degree', ylabel: 'error', layers: [
      { type: 'line', pts: tr.map((v, d) => [d, v] as Pt), color: 'var(--c1)' }, { type: 'dots', pts: tr.map((v, d) => [d, v] as Pt), color: 'var(--c1)', r: 4 },
      { type: 'line', pts: te.map((v, d) => [d, v] as Pt), color: 'var(--c2)' }, { type: 'dots', pts: te.map((v, d) => [d, v] as Pt), color: 'var(--c2)', r: 4 }] },
    answer: { x: bestTest }, tol: 0.4, snap: 1,
    hint: 'Training error always falls as the model gets more complex. Which curve tells you about new data?',
    explain: `Pick the lowest **test** error: degree ${bestTest}. Beyond it, training error keeps falling while test error rises: overfitting.`,
  };
};

const NOUNS = ['cat', 'dog', 'bird', 'fox'], VERBS = ['sat', 'ran', 'slept', 'ate'], PLACES = ['mat', 'rug', 'log', 'box'];
const genBigramProb: Generator = (rng) => {
  for (;;) {
    const sents = Array.from({ length: 5 }, () => `the ${pick(rng, NOUNS)} ${pick(rng, VERBS)} on the ${pick(rng, PLACES)} .`);
    const tok = sents.join(' ').split(' ');
    const bg = bigrams(tok);
    const a = pick(rng, ['the', ...NOUNS.filter((n) => bg[n])]);
    const f = Object.entries(bg[a] ?? {});
    if (f.length < 2) continue;
    const [b, n] = pick(rng, f);
    const total = f.reduce((s, [, k]) => s + k, 0);
    return {
      kind: 'number', prob: true,
      body: `A bigram model is trained on this text. What probability does it give to “**${b}**” coming right after “**${a}**”?`,
      widget: () => chips(tok, { hi: tok.map((t, i) => (t === a ? i : -1)).filter((i) => i >= 0) }),
      answer: n / total, tol: 0.006,
      hint: `Count every “${a}” that has a word after it, and how many of those are followed by “${b}”.`,
      explain: `“${a}” is followed by a word ${total} times; ${n} of those are “${b}”: ${n}/${total} = ${pct(n / total)}.`,
    };
  }
};

const genTemp: Generator = (rng) => {
  const p = pick(rng, [0.6, 0.7, 0.75, 0.8, 0.9]);
  const T = pick(rng, [0.5, 2]);
  const v = temper([p, 1 - p], T)[0];
  return {
    kind: 'number', prob: true,
    body: `A model gives the next token two options: “yes” ${pct(p, 0)}, “no” ${pct(1 - p, 0)}. Temperature T re-weights each probability to p^(1/T) and rescales so they add to 1. At **T = ${T}**, what is the new probability of “yes”?`,
    answer: v, tol: 0.006,
    hint: T === 0.5 ? 'At T = 0.5, square each probability, then divide by their sum.' : 'At T = 2, take the square root of each, then divide by their sum.',
    explain: T === 0.5
      ? `${num(p)}² = ${num(p * p)}, ${num(1 - p)}² = ${num((1 - p) ** 2)}. Share: ${num(p * p)} / ${num(p * p + (1 - p) ** 2)} ≈ ${pct(v)}. Low temperature sharpens the favourite.`
      : `√${num(p)} ≈ ${num(Math.sqrt(p))}, √${num(1 - p)} ≈ ${num(Math.sqrt(1 - p))}. Share ≈ ${pct(v)}. High temperature flattens the choices.`,
  };
};

const genGreedy: Generator = (rng) => {
  const word = pick(rng, ['sunny', 'cold', 'quiet', 'late', 'busy']);
  const cands = shuffle(rng, ['day', 'night', 'morning', 'room', 'street', 'week']).slice(0, 4);
  const counts = shuffle(rng, [randInt(rng, 9, 14), randInt(rng, 5, 8), randInt(rng, 2, 4), 1]);
  const top = cands[counts.indexOf(Math.max(...counts))];
  const total = counts.reduce((a, b) => a + b, 0);
  return {
    kind: 'fill',
    body: `In a model’s training text, “${word}” is followed by these words this many times.`,
    widget: () => barChart(cands.map((c, i) => ({ label: c, value: counts[i] }))),
    template: `Greedy decoding after “${word}” picks [[0]], with probability [[1]].`,
    blanks: [
      tiles(top, cands.filter((c) => c !== top)),
      tiles(`${Math.max(...counts)}/${total}`, [`1/${cands.length}`, `${Math.max(...counts)}/${Math.max(...counts) + 1}`, `1/${total}`]),
    ],
    hint: 'Greedy means: always take the most frequent next word.',
    explain: `“${top}” follows “${word}” ${Math.max(...counts)} times out of ${total}, so P = ${Math.max(...counts)}/${total} ≈ ${pct(Math.max(...counts) / total)}.`,
  };
};

const genGroupAcc: Generator = (rng) => {
  const a = pick(rng, [700, 800, 850, 900, 950]), b = 1000 - a;
  const accA = pick(rng, [0.95, 0.97, 0.98, 0.99]), accB = pick(rng, [0.6, 0.7, 0.75, 0.8, 0.85]);
  const v = (a * accA + b * accB) / 1000;
  return {
    kind: 'number', prob: true,
    body: `A speech recogniser is tested on 1,000 clips: ${a} from speakers of accent A (it gets ${pct(accA, 0)} right) and ${b} from accent B (${pct(accB, 0)} right). What is its **overall** accuracy?`,
    answer: v, tol: 0.0006,
    hint: 'Count the correct clips in each group, add, divide by 1,000.',
    explain: `${a}×${num(accA)} + ${b}×${num(accB)} = ${num(a * accA + b * accB)} correct of 1,000: ${pct(v)}. The headline number hides how much worse it is for accent B.`,
  };
};

const genAllRight: Generator = (rng) => {
  const p = pick(rng, [0.8, 0.9, 0.95, 0.98, 0.99]), n = pick(rng, [5, 10, 20, 30, 50]);
  const v = p ** n;
  return {
    kind: 'number', prob: true,
    body: `An assistant answers ${pct(p, 0)} of questions correctly, independently. You ask it ${n} questions and don’t check any. What is the chance **every** answer is right?`,
    answer: v, tol: Math.max(0.003, v * 0.01),
    hint: `Multiply ${num(p)} by itself ${n} times.`,
    explain: `${num(p)}^${n} ≈ ${pct(v)}. Small error rates compound: across many answers, some are probably wrong, so check the ones that matter.`,
  };
};

const STRONG: string[] = ['Drafting a first version of an email', 'Summarising a document you also have', 'Brainstorming names for a project', 'Rewording a paragraph more simply', 'Translating a casual message between common languages'];
const CAREFUL: string[] = ['Quoting exact sources and page numbers', 'Facts about events after its training data', 'Long exact arithmetic without a calculator tool', 'Medical or legal decisions about you', 'Cases very unlike its training examples'];
const genStrongWeak: Generator = (rng) => {
  const s = shuffle(rng, STRONG).slice(0, 2), c = shuffle(rng, CAREFUL).slice(0, 2);
  const who = pick(rng, ['a general chat assistant', 'an AI writing assistant', 'a chatbot at work', 'an AI model in a search box']);
  return {
    kind: 'sort',
    body: `Sort these uses of ${who}: where is it usually **helpful**, and where should you **check carefully** before relying on it?`,
    bins: ['Usually helpful', 'Check carefully'],
    items: shuffle(rng, [...s.map((text) => ({ text, bin: 0 })), ...c.map((text) => ({ text, bin: 1 }))]),
    hint: 'Is there a single exact right answer that the model might not reliably know, or would a plausible draft be fine?',
    explain: 'Language models are good at producing plausible text you can judge yourself. They are weaker where a plausible answer can still be wrong: exact facts, citations, recent events, precise arithmetic and unusual cases.',
  };
};

// ---------------------------------------------------------------- course

const SEVEN_A = ['#####', '....#', '...#.', '..#..', '..#..', '.#...', '.#...'];
const SEVEN_B = ['.###.', '....#', '...#.', '.###.', '..#..', '.#...', '#....'];

export const ai: Course = {
  id: 'ai',
  title: 'How AI Works',
  blurb: 'How machines learn from examples, measure their mistakes, and why they can be confidently wrong.',
  color: '#8b5cf6',
  icon: '🤖',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'examples',
      title: 'Learning from examples',
      goal: 'Describe things as features and labels, and see why examples beat hand-written rules.',
      steps: [
        {
          kind: 'choice',
          body: 'Someone has measured 16 fruits and labelled each one: green dots are **limes**, yellow dots are **lemons**. A new fruit arrives at the grey dot. What is it most likely to be?',
          widget: () => withLegend(plotEl(scatterSpec(LIMES, LEMONS, { top: [{ type: 'dots', pts: [NEW_FRUIT], color: 'var(--muted)', r: 7, labels: ['?'] }] })), fruitLegend()),
          options: [
            { text: 'A lemon', correct: true },
            { text: 'A lime', why: 'The limes are all in the lower left: smaller and greener. The grey dot sits among the lemons.' },
            { text: 'Impossible to say without a definition of a lemon', why: 'You didn’t need one: you compared the new fruit with labelled examples. That is exactly the trick machine learning uses.' },
          ],
          explain: `The new fruit ${pt(NEW_FRUIT)} is big and yellow, right in the lemon cluster. You judged by similarity to examples, not by a rule.`,
        },
        {
          kind: 'read',
          title: 'Features and labels',
          body: 'Most modern AI works the way you just did. Instead of a programmer writing rules, a program is shown many **examples**. Each one is described by **features** (numbers it can measure: here, size and yellowness) and tagged with a **label** (the right answer: lemon or lime).\n\nThe program finds a pattern linking features to labels: that pattern is the **model**. Then it applies the model to new, unlabelled cases.',
          widget: () => dataTable(['size (cm)', 'yellowness', 'label'], [...LIMES.slice(0, 2).map((p) => [num(p[0]), num(p[1]), 'lime']), ...LEMONS.slice(0, 2).map((p) => [num(p[0]), num(p[1]), 'lemon']), ['…', '…', '…']], { caption: 'A few of the 16 examples' }),
        },
        {
          kind: 'read',
          title: 'Why not just write rules?',
          body: 'For fruit, rules look easy. Now try handwriting. Both pictures below are a 7. Write a rule, in terms of which pixels are dark, that accepts both of these and every other 7 anyone might write, but rejects every 1 and every 9.\n\nIt gets hopeless fast. Given thousands of labelled examples, a learning program can find such patterns by itself. That is why “learn from examples” took over from “write the rules” for messy tasks like seeing and listening.',
          widget: () => h('div', { style: 'display:flex;gap:28px;justify-content:center;flex-wrap:wrap' }, pixels(SEVEN_A, { size: 16 }), pixels(SEVEN_B, { size: 16 })),
        },
        {
          kind: 'match',
          body: 'Match each term to what it means for the fruit sorter.',
          heads: ['Term', 'In the fruit sorter'],
          pairs: [
            ['Feature', 'A fruit’s size'],
            ['Label', '“lemon” or “lime”'],
            ['Example', 'One measured, labelled fruit'],
            ['Model', 'The pattern that maps size and yellowness to a label'],
          ],
          hint: 'Features go in, the label is the answer, and the model is what’s learned.',
          explain: 'Examples are the data; each has features (inputs) and a label (the answer). The model is the learned mapping from features to labels.',
        },
        {
          kind: 'sort',
          body: 'Three different models. Sort each item into **feature** (what the model is given) or **label** (what it must predict).',
          bins: ['Feature (input)', 'Label (answer)'],
          items: [
            { text: 'floor area (house-price model)', bin: 0 },
            { text: 'sale price (house-price model)', bin: 1 },
            { text: 'number of links (spam filter)', bin: 0 },
            { text: 'spam or not (spam filter)', bin: 1 },
            { text: 'pixel brightness values (cat detector)', bin: 0 },
            { text: 'cat or no cat (cat detector)', bin: 1 },
          ],
          hint: 'The label is the thing you’d like to know but don’t yet.',
          explain: 'Features are measurable inputs; the label is the answer you want for new cases. A model learns how the first predicts the second.',
        },
        {
          kind: 'multi',
          body: 'You want to add more features to the fruit sorter. Which of these would actually help tell lemons from limes?',
          widget: () => withLegend(plotEl(scatterSpec(LIMES, LEMONS)), fruitLegend()),
          options: [
            { text: 'Skin colour from a camera', correct: true },
            { text: 'Weight', correct: true },
            { text: 'Shape (lemons often have a pointed tip)', correct: true },
            { text: 'The number on the price sticker', why: 'A sticker number says nothing about the fruit itself. A model might latch onto it by accident in one shop and fail in the next.' },
            { text: 'The day of the week it was picked', why: 'Picking day doesn’t differ between lemons and limes, so it only adds noise.' },
          ],
          explain: 'Good features differ between the classes for a real reason. Irrelevant ones add noise, and accidental ones (like a sticker code) can be learned as shortcuts that break later.',
        },
        {
          kind: 'point',
          body: `To the model, each fruit is just a point. Place a fruit that measures **${num(PLACE[0])} cm** across and scores **${num(PLACE[1])}** on yellowness.`,
          plot: scatterSpec(LIMES, LEMONS),
          answer: { x: PLACE[0], y: PLACE[1] }, tol: 0.3, snap: 0.5,
          hint: 'Size runs across (x), yellowness runs up (y).',
          explain: `That fruit is the point ${pt(PLACE)}: fairly big, but green. It sits between the groups, which is where models find decisions hardest.`,
        },
        {
          kind: 'choice',
          body: 'Suppose the sorter could measure **size only**. Here are the same 16 fruits by size alone. Could any single size cutoff (“bigger than this → lemon”) get every fruit right?',
          widget: () => withLegend(plotEl({
            x: [2, 9], y: [-0.8, 1.8], size: [440, 180], ticks: [1, 10], grid: false, xlabel: 'size (cm)', tickFormat: (v) => (v < 2 ? '' : String(v)),
            layers: [{ type: 'dots', pts: LIMES.map((p) => [p[0], 0] as Pt), color: LIME, r: 8 }, { type: 'dots', pts: LEMONS.map((p) => [p[0], 1] as Pt), color: LEMON, r: 8 }],
          }), fruitLegend()),
          options: [
            { text: 'No: the sizes overlap', correct: true },
            { text: 'Yes: put the cutoff at 5 cm', why: `Some limes are bigger than 5 cm (up to ${num(maxLimeSize)} cm), so they’d be called lemons.` },
            { text: 'Yes: put the cutoff at 7 cm', why: `Lemons start at ${num(minLemonSize)} cm, so every lemon smaller than 7 cm would be called a lime.` },
          ],
          explain: `Limes go up to ${num(maxLimeSize)} cm and lemons start at ${num(minLemonSize)} cm: the ranges overlap, so no cutoff is perfect. Adding yellowness pulls the groups apart. Choosing features well matters as much as the learning method.`,
        },
        {
          kind: 'number',
          body: 'Images work the same way. A small greyscale image of a handwritten digit is **28 × 28** pixels, and each pixel’s brightness is one feature. How many features does one image have?',
          widget: () => pixels(SEVEN_A, { size: 14 }),
          answer: 784, tol: 0.5,
          hint: 'Rows times columns.',
          explain: '28 × 28 = 784 numbers. A picture is a point in a 784-dimensional space; the same ideas apply, just with many more axes than we can draw.',
        },
        {
          kind: 'read',
          title: 'The real goal: new cases',
          body: 'Remembering the 16 labelled fruits is easy: just store them. The point is to be right about the **grey** ones nobody has labelled yet. That is called **generalising**.\n\nThe rest of this course is how machines generalise: drawing boundaries, measuring mistakes, improving step by step, and how it goes wrong.',
          widget: () => withLegend(plotEl(scatterSpec(LIMES, LEMONS, { top: [{ type: 'dots', pts: [[2, 2.5], [8, 7.5], [5.5, 5], [7, 2]], color: 'var(--muted)', r: 7, labels: ['?', '?', '?', '?'] }] })), legend([[LIME, 'lime'], [LEMON, 'lemon'], ['var(--muted)', 'new, unlabelled']])),
        },
        {
          kind: 'order',
          body: 'Put the steps of building a learned model in order.',
          items: [
            'Collect examples',
            'Label each example with the right answer',
            'Train a model on the labelled examples',
            'Test it on labelled examples it never saw in training',
            'Use it on new, unlabelled cases',
          ],
          hint: 'You can’t learn before you have answers, and you shouldn’t trust it before testing.',
          explain: 'Data first, then labels, then training. Testing on held-back examples tells you how it will do on new cases, before you rely on it.',
        },
      ],
      practice: [genPlace, genFeatureLabel, genPixels],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'boundaries',
      title: 'Decision boundaries',
      goal: 'Separate classes with a threshold or a line, and classify by nearest neighbour.',
      steps: [
        {
          kind: 'task',
          body: 'A sorting machine measures only **yellowness**. It calls a fruit a lemon if its yellowness is **above the cutoff** (the shaded side). Slide the cutoff until every fruit is sorted correctly.',
          widget: plotExplorer({
            params: [{ id: 't', label: 'cutoff', min: 0, max: 10, step: 0.5, value: 8 }],
            spec: (v) => cutSpec(v.t),
            readout: (v) => { const m = cutMistakes(v.t); return m ? `${m} fruit${m === 1 ? '' : 's'} sorted wrong` : 'No mistakes'; },
            goal: (v) => cutMistakes(v.t) === 0,
            goalText: 'Every fruit on the right side.',
          }),
          hint: 'Find the gap between the yellowest lime and the palest lemon.',
          explain: `Any cutoff from ${num(GOOD_CUTS[0])} to ${num(GOOD_CUTS[GOOD_CUTS.length - 1])} works: it sits in the gap between the yellowest lime (${num(Math.max(...Y_LIME))}) and the palest lemon (${num(Math.min(...Y_LEMON))}).`,
        },
        {
          kind: 'read',
          title: 'A decision boundary',
          body: 'That cutoff is a complete model: one number, chosen from the examples. The place where its answer flips from lime to lemon is its **decision boundary**. Everything on one side gets one label, everything on the other side the other.\n\nLearning, here, means finding a boundary that sorts the training examples well.',
          widget: () => plotEl(cutSpec(GAP_MID)),
        },
        {
          kind: 'choice',
          body: `Cutoffs ${GOOD_CUTS.filter((t) => t === Math.min(...GOOD_CUTS) || t === GAP_MID || t === Math.max(...GOOD_CUTS)).map(num).join(', ')} all sort the training fruit perfectly. Which would you trust most on **new** fruit?`,
          widget: () => plotEl(cutSpec(GAP_MID)),
          options: [
            { text: num(GOOD_CUTS[0]), why: `It touches the yellowest lime (${num(Math.max(...Y_LIME))}): a lime only slightly yellower would be called a lemon.` },
            { text: num(GAP_MID), correct: true },
            { text: num(GOOD_CUTS[GOOD_CUTS.length - 1]), why: `It sits right next to the palest lemon (${num(Math.min(...Y_LEMON))}): a lemon only slightly paler would be missed.` },
          ],
          ordered: true,
          explain: `${num(GAP_MID)} is in the middle of the gap, as far as possible from both groups. New fruit will vary a bit from the training fruit, and a wide **margin** leaves room for that. Some classic methods (support vector machines) are built around exactly this idea.`,
        },
        {
          kind: 'task',
          body: 'Now use both features. Fruit **above the line** is called a lemon. Tilt and shift the line until it makes **no mistakes**.',
          widget: (ctx) => withLegend(plotExplorer({
            params: [
              { id: 'm', label: 'tilt (slope)', min: -3, max: 1, step: 0.25, value: 0 },
              { id: 'b', label: 'height (intercept)', min: 0, max: 16, step: 0.5, value: 5 },
            ],
            spec: (v) => scatterSpec(LIMES, LEMONS, { extra: lineLayers(v.m, v.b) }),
            readout: (v) => { const m = lineMistakes(v.m, v.b); return m ? `${m} fruit${m === 1 ? '' : 's'} on the wrong side` : 'No mistakes'; },
            goal: (v) => lineMistakes(v.m, v.b) === 0,
            goalText: 'The line separates the two classes.',
          })(ctx), fruitLegend()),
          hint: `A flat line ${flatWorks ? 'can' : 'can’t'} do it here. Try a slope near ${num(LINE_EX[0])} and then adjust the height.`,
          explain: `For example slope ${num(LINE_EX[0])} with intercept ${num(LINE_EX[1])} works. Neither feature alone separates the fruit, but a tilted line using both does.`,
        },
        {
          kind: 'read',
          title: 'A line is a weighted sum',
          body: 'Your line says: lemon when *yellowness > slope × size + intercept*. Move everything to one side and it becomes\n\n**w₁ × size + w₂ × yellowness + b > 0**\n\nMultiply each feature by a **weight**, add a constant, check the sign. That is a **linear classifier**, and it’s exactly what one artificial neuron computes (lesson 5). With three features the boundary is a flat plane; with more, a “hyperplane”. Same idea.',
          widget: () => withLegend(plotEl(scatterSpec(LIMES, LEMONS, { extra: lineLayers(...LINE_EX) })), fruitLegend()),
        },
        {
          kind: 'fill',
          body: `A model uses the rule **lemon if size + yellowness > ${SUM_RULE}**. A fruit has size ${num(FILL_FRUIT[0])} and yellowness ${num(FILL_FRUIT[1])}.`,
          template: `${num(FILL_FRUIT[0])} + ${num(FILL_FRUIT[1])} = [[0]], which is [[1]] ${SUM_RULE}, so it is called a [[2]].`,
          blanks: [
            tiles(num(FILL_FRUIT[0] + FILL_FRUIT[1]), [num(FILL_FRUIT[0] * FILL_FRUIT[1]), num(FILL_FRUIT[0] - FILL_FRUIT[1])]),
            tiles(FILL_FRUIT[0] + FILL_FRUIT[1] > SUM_RULE ? 'more than' : 'less than', [FILL_FRUIT[0] + FILL_FRUIT[1] > SUM_RULE ? 'less than' : 'more than']),
            tiles(fname(FILL_FRUIT[0] + FILL_FRUIT[1] > SUM_RULE), [fname(!(FILL_FRUIT[0] + FILL_FRUIT[1] > SUM_RULE))]),
          ],
          hint: 'Add the two features, then compare with the cutoff.',
          explain: `${num(FILL_FRUIT[0])} + ${num(FILL_FRUIT[1])} = ${num(FILL_FRUIT[0] + FILL_FRUIT[1])}, ${FILL_FRUIT[0] + FILL_FRUIT[1] > SUM_RULE ? 'above' : 'below'} ${SUM_RULE}: a ${fname(FILL_FRUIT[0] + FILL_FRUIT[1] > SUM_RULE)}. A big fruit can still be called a lime if it’s green enough: the features trade off.`,
        },
        {
          kind: 'sort',
          body: `Same rule: **lemon if size + yellowness > ${SUM_RULE}**. Sort these fruits, written as (size, yellowness).`,
          bins: ['Lemon', 'Lime'],
          items: SORT_FRUIT.map((p) => ({ text: pt(p), bin: p[0] + p[1] > SUM_RULE ? 0 : 1 })),
          hint: 'Add the two numbers in each pair.',
          explain: SORT_FRUIT.map((p) => `${pt(p)}: ${num(p[0] + p[1])}`).join('; ') + `. Above ${SUM_RULE} is a lemon.`,
        },
        {
          kind: 'read',
          title: 'Nearest neighbour',
          body: 'A different idea: don’t draw a line at all. To label a new fruit, find the **most similar labelled example** (the closest dot) and copy its label. This is the **nearest-neighbour** method.\n\nThe pale background shows what it would answer at every spot. Its boundary isn’t straight: it bends around the data.',
          widget: () => withLegend(plotEl(scatterSpec(LIMES, LEMONS, { extra: [
            { type: 'dots', pts: NN_BG, color: 'color-mix(in srgb, var(--c3) 55%, transparent)', r: 3.5 },
            { type: 'dots', pts: NN_BG_LEMON, color: 'color-mix(in srgb, var(--c5) 60%, transparent)', r: 3.5 },
          ] })), fruitLegend()),
        },
        {
          kind: 'point',
          body: `A new fruit lands at the grey dot ${pt(STAR)}. Tap the **labelled fruit closest to it**.`,
          plot: scatterSpec(LIMES, LEMONS, { top: [{ type: 'dots', pts: [STAR], color: 'var(--muted)', r: 7, labels: ['?'] }] }),
          answer: { x: NEAREST.p[0], y: NEAREST.p[1] }, tol: 0.4, snap: 0.5,
          hint: 'Several are close. Compare distances with Pythagoras if you need to.',
          explain: `The ${fname(NEAREST.lemon)} at ${pt(NEAREST.p)} is ${num(NEAREST.d, 3)} away; the next closest is ${num(byDist[1].d, 3)}. So nearest neighbour calls it a ${fname(NEAREST.lemon)}, even though it’s nearly a tie.`,
        },
        {
          kind: 'number',
          body: 'Nearest neighbour needs distances. How far apart are the fruits **(2, 3)** and **(5, 7)**?',
          widget: () => plotEl({ x: [0, 8], y: [0, 9], size: [360, 300], ticks: [1, 1], equal: true, layers: [
            { type: 'line', pts: [[2, 3], [5, 3], [5, 7]], color: 'var(--muted)', dash: true, width: 2 },
            { type: 'line', pts: [[2, 3], [5, 7]], color: 'var(--c2)' },
            { type: 'dots', pts: [[2, 3], [5, 7]], color: 'var(--c1)', r: 7 }] }),
          answer: dist([2, 3], [5, 7]), tol: 0.01,
          hint: 'Across 3, up 4. Pythagoras.',
          explain: `√(3² + 4²) = √25 = ${num(dist([2, 3], [5, 7]))}.`,
        },
        {
          kind: 'choice',
          body: 'One fruit in this pile was **labelled lemon by mistake**: it sits among the limes. A new fruit lands at the grey dot, right next to it. What do **1-nearest-neighbour** and **3-nearest-neighbours** (a vote among the 3 closest) answer?',
          widget: () => withLegend(plotEl(scatterSpec(PILE.filter((f) => !f.lemon).map((f) => f.p), PILE.filter((f) => f.lemon).map((f) => f.p), { top: [{ type: 'dots', pts: [PILE_Q], color: 'var(--muted)', r: 6 }] })), fruitLegend()),
          options: knnOptions(),
          hint: 'Find the single closest dot, then the three closest.',
          explain: `1-NN copies the one mislabelled neighbour and says ${fname(PILE_1)}. 3-NN lets two real limes outvote it: ${fname(PILE_3)}. Looking at more neighbours makes the model less sensitive to noise in the labels.`,
        },
        {
          kind: 'multi',
          body: 'Which statements are true?',
          options: [
            { text: 'A straight line can’t separate a class that forms a ring around another', correct: true },
            { text: 'Nearest-neighbour boundaries can bend and curve', correct: true },
            { text: 'With three features, a linear boundary is a flat plane', correct: true },
            { text: 'A line that separates the training data perfectly will be perfect on new data', why: 'New examples can land in places the training data never covered, and a boundary hugging one class will misjudge them. Perfect on training is not perfect on new data.' },
            { text: 'Nearest neighbour needs no training data', why: 'Nearest neighbour *is* its training data: it keeps every example and compares new ones against them.' },
          ],
          explain: 'Lines (and planes) are simple and robust but can only cut space straight. Nearest neighbour adapts to any shape, but leans on every individual example, including mislabelled ones.',
        },
      ],
      practice: [genSide, genNearest, genDistance],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'error',
      title: 'Measuring error',
      goal: 'Read a confusion matrix and see why accuracy misleads on rare events.',
      steps: [
        {
          kind: 'choice',
          body: 'A disease affects **1 in 100** people. Test A is **99%** accurate. Test B is **92%** accurate. Which test is better at its job?',
          options: [
            { text: 'Can’t tell from accuracy alone', correct: true },
            { text: 'Test A', why: 'A “test” that simply says “healthy” to everyone is also 99% accurate here, and it finds nobody. 99% could be that.' },
            { text: 'Test B', why: 'B might be better, but nothing here shows it. You need to know what kinds of mistakes each one makes.' },
          ],
          explain: 'When one outcome is rare, a model can score high accuracy by ignoring it. We need to look at the mistakes separately.',
        },
        {
          kind: 'number', prob: true,
          body: `Check it. ${num(RARE.n)} patients, ${RARE.sick} of them sick. A lazy model says “healthy” to everyone. What is its **accuracy** (share of patients it labels correctly)?`,
          widget: () => h('div', null, iconArray(100, 1, { cols: 20, colors: ['var(--bad)', 'var(--line)'] }), note(`Each dot is ${RARE.n / 100} patients; red = sick`)),
          answer: (RARE.n - RARE.sick) / RARE.n, tol: 0.0006,
          hint: 'It is right about everyone who is healthy.',
          explain: `${num(RARE.n - RARE.sick)} of ${num(RARE.n)} correct: ${pct((RARE.n - RARE.sick) / RARE.n)}, while catching **zero** sick patients.`,
        },
        {
          kind: 'read',
          title: 'Four outcomes',
          body: 'For a yes/no model, every case lands in one of four boxes. Call the thing we’re looking for (sick, spam, fraud) **positive**.\n\n- **True positive**: it’s there and the model says so.\n- **False negative**: it’s there, the model misses it.\n- **False positive**: it isn’t there, the model raises a false alarm.\n- **True negative**: it isn’t there, the model says so.\n\nThe table is a **confusion matrix**. Here it is for the lazy model: 99% accurate, and useless.',
          widget: () => confusion({ tp: 0, fn: RARE.sick, fp: 0, tn: RARE.n - RARE.sick }, { pos: 'sick', neg: 'healthy' }),
        },
        {
          kind: 'sort',
          body: 'A spam filter treats **spam as positive**. Sort each outcome into its box.',
          bins: ['True positive', 'False positive', 'False negative', 'True negative'],
          items: [
            { text: 'A “you won a prize” scam goes to the spam folder', bin: 0 },
            { text: 'A real invoice from a client lands in spam', bin: 1 },
            { text: 'A newsletter you subscribed to is filtered as spam', bin: 1 },
            { text: 'A phishing email reaches your inbox', bin: 2 },
            { text: 'A fake bank-login email slips through', bin: 2 },
            { text: 'A friend’s message arrives in your inbox', bin: 3 },
          ],
          hint: 'First: was it really spam? Then: did the filter call it spam?',
          explain: 'True/false says whether the model was right; positive/negative says what the model *said*. A real email marked spam is a false positive; spam that gets through is a false negative.',
        },
        {
          kind: 'fill',
          body: 'Here are 20 test emails by **spam score** (the model’s confidence). Pink dots are really spam; blue ones are real mail. The filter calls an email spam when its score is **at least 0.5** (the shaded side). Fill in the confusion matrix.',
          widget: () => withLegend(plotEl(scoreSpec(SPAM_SCORES, HAM_SCORES, 0.5)), legend([[SPAM, 'really spam'], [HAM, 'real mail']])),
          template: 'True positives: [[0]] · False negatives: [[1]] · False positives: [[2]] · True negatives: [[3]]',
          blanks: [countTiles(AT_HALF.tp), countTiles(AT_HALF.fn), countTiles(AT_HALF.fp), countTiles(AT_HALF.tn)],
          hint: 'Top row: spam dots right of the line are caught, left are missed. Bottom row: blue dots right of the line are false alarms.',
          explain: `Spam caught: ${AT_HALF.tp}, spam missed: ${AT_HALF.fn}. Real mail flagged: ${AT_HALF.fp}, real mail passed: ${AT_HALF.tn}.`,
        },
        {
          kind: 'number', prob: true,
          body: 'What is this filter’s **accuracy**?',
          widget: () => confusion(AT_HALF),
          answer: accOf(AT_HALF), tol: 0.006,
          hint: 'Correct = true positives + true negatives.',
          explain: `(${AT_HALF.tp} + ${AT_HALF.tn}) / 20 = ${pct(accOf(AT_HALF))}.`,
        },
        {
          kind: 'read',
          title: 'Precision and recall',
          body: `Two more numbers say *which* mistakes a model makes.\n\n**Precision**: of the emails it flagged, how many really were spam? ${AT_HALF.tp} / (${AT_HALF.tp} + ${AT_HALF.fp}) = ${pct(precOf(AT_HALF))}.\n\n**Recall**: of the real spam, how much did it catch? ${AT_HALF.tp} / (${AT_HALF.tp} + ${AT_HALF.fn}) = ${pct(recOf(AT_HALF))}.\n\nMoving the threshold trades one against the other.`,
          widget: () => confusion(AT_HALF),
        },
        {
          kind: 'task',
          body: 'Losing a real email is worse than seeing a spam. Move the threshold so **no real email is flagged**, while still catching **as much spam as possible**.',
          widget: (ctx) => {
            const ex = plotExplorer({
              params: [{ id: 't', label: 'threshold', min: 0, max: 1, step: 0.05, value: 0.5, format: (v) => v.toFixed(2) }],
              spec: (v) => scoreSpec(SPAM_SCORES, HAM_SCORES, v.t),
              readout: (v) => { const m = countAt(SPAM_SCORES, HAM_SCORES, v.t); return `caught ${m.tp} of ${SPAM_SCORES.length} spam · ${m.fp} real email${m.fp === 1 ? '' : 's'} flagged`; },
              goal: (v) => { const m = countAt(SPAM_SCORES, HAM_SCORES, v.t); return m.fp === 0 && m.tp === BEST_SAFE_TP; },
              goalText: 'No false alarms, and as much spam caught as that allows.',
            });
            return h('div', null, ex(ctx), legend([[SPAM, 'really spam'], [HAM, 'real mail']]));
          },
          hint: 'Find the highest-scoring real email. The threshold must be just above it.',
          explain: `The highest-scoring real email scores ${num(Math.max(...HAM_SCORES))}, so the threshold must be above it: ${SAFE_TS.map((t) => t.toFixed(2)).join(' or ')}. That catches ${BEST_SAFE_TP} of ${SPAM_SCORES.length} spam: precision 100%, recall ${pct(BEST_SAFE_TP / SPAM_SCORES.length)}. Fewer false positives cost more false negatives.`,
        },
        {
          kind: 'match',
          body: 'Which kind of mistake matters more? Match each system to the better choice of threshold.',
          heads: ['System', 'Set it to…'],
          pairs: [
            ['Smoke alarm', 'Avoid misses, even if it means false alarms'],
            ['Spam filter for work email', 'Avoid false alarms, even if some spam gets through'],
            ['Song recommendations', 'Neither error is costly: just aim for good overall'],
          ],
          hint: 'What happens in each case if the system misses something, versus if it cries wolf?',
          explain: 'A missed fire can kill; burnt toast just annoys. A hidden work email can cost a job; a stray spam costs seconds. A bad song recommendation costs a skip. The right trade-off depends on the costs, not on accuracy.',
        },
        {
          kind: 'estimate',
          body: `Back to the rare disease: ${num(RARE.n)} patients, ${RARE.sick} sick. A real test catches **${RARE.caught} of the ${RARE.sick}** sick patients, and also flags **${RARE.falseAlarms}** healthy people by mistake. If you test positive, roughly what’s the chance you’re actually sick (the test’s precision)?`,
          widget: () => confusion({ tp: RARE.caught, fn: RARE.sick - RARE.caught, fp: RARE.falseAlarms, tn: RARE.n - RARE.sick - RARE.falseAlarms }, { pos: 'sick', neg: 'healthy' }),
          min: 0, max: 100, step: 1, answer: Math.round(RARE_PREC * 100), tol: 5, format: (v) => `${v}%`,
          hint: 'Only look at the “model says sick” column.',
          explain: `${RARE.caught} true positives among ${RARE.caught + RARE.falseAlarms} positives: ${RARE.caught}/${RARE.caught + RARE.falseAlarms} ≈ ${pct(RARE_PREC, 0)}. The test has ${pct(RARE.caught / RARE.sick, 0)} recall and ${pct((RARE.n - RARE.sick - RARE.falseAlarms + RARE.caught) / RARE.n, 1)} accuracy, yet most positives are false alarms, because healthy people vastly outnumber sick ones.`,
        },
        {
          kind: 'multi',
          body: 'You are judging a fraud detector, and fraud is rare. Which of these tell you more than its accuracy does?',
          options: [
            { text: 'The full confusion matrix', correct: true },
            { text: 'Recall: the share of real frauds it catches', correct: true },
            { text: 'Precision: the share of its alarms that are real fraud', correct: true },
            { text: 'Its accuracy to more decimal places', why: 'More decimals of the same number don’t fix the problem: “always say honest” would still look excellent.' },
            { text: 'How many transactions it was tested on, alone', why: 'Test size tells you how reliable the measurement is, not whether the detector catches fraud.' },
          ],
          explain: 'On imbalanced data, look at the errors per class: confusion matrix, precision and recall. Compare against the “always say the common answer” baseline too.',
        },
      ],
      practice: [genRates, genBaseline, genErrorSort],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'descent',
      title: 'Gradient descent',
      goal: 'Improve a model by stepping downhill on its loss, and choose a sensible learning rate.',
      steps: [
        {
          kind: 'task',
          body: 'This curve is a **loss**: how wrong a model is for each setting of one knob, **w**. Lower is better. Move the ball to the setting with the **lowest loss**.',
          widget: plotExplorer({
            params: [{ id: 'w', label: 'w', min: -1, max: 7, step: 0.5, value: 0 }],
            spec: (v) => valley([tangent(v.w), ball(v.w)]),
            readout: (v) => `loss = ${num(loss(v.w))} · slope = ${num(slope(v.w))}`,
            goal: (v) => v.w === A0,
            goalText: 'The bottom of the valley.',
          }),
          hint: 'Watch the slope. Where is it zero?',
          explain: `The bottom is at w = ${A0} (loss ${num(loss(A0))}). There the dashed tangent line is flat: the slope is 0.`,
        },
        {
          kind: 'read',
          title: 'Feel the slope',
          body: 'With one knob you can see the whole curve. A real model has millions of knobs (weights), and you can’t draw that landscape. What you *can* compute, at the point where you stand, is the **slope** in every direction: the **gradient**.\n\nThe slope points uphill. So step the other way.',
          widget: () => plotEl(valley([tangent(5.5, 1.5), ball(5.5), { type: 'arrow', from: [5.5, loss(5.5) + 2.5], to: [4.2, loss(5.5) + 2.5], color: 'var(--c3)', label: 'downhill' }])),
        },
        {
          kind: 'choice',
          body: 'You are at a point where the slope of the loss is **+4**. Which way should you change w?',
          options: [
            { text: 'Decrease w', correct: true },
            { text: 'Increase w', why: 'A positive slope means the loss *rises* as w increases. Increasing w goes uphill.' },
            { text: 'Leave it: you’re at the bottom', why: 'At the bottom the slope is 0. A slope of 4 means you’re on a hillside.' },
          ],
          explain: 'Always move against the slope: positive slope → decrease w; negative slope → increase w.',
        },
        {
          kind: 'read',
          title: 'The update rule',
          body: `**new w = w − η × slope**\n\nη (eta) is the **learning rate**. A steep slope gives a big step; near the bottom the slope shrinks, so the steps shrink too. Press **Play**: η = ${PLAY_ETA}, starting at w = ${PLAY_W0}.`,
          widget: () => stepper(PLAY_PATH.length, (i) => plotEl(valley([
            { type: 'line', pts: PLAY_PATH.slice(0, i + 1).map((w) => [w, loss(w)] as Pt), color: 'var(--c2)', width: 1.5, dash: true },
            { type: 'dots', pts: PLAY_PATH.slice(0, i).map((w) => [w, loss(w)] as Pt), color: 'color-mix(in srgb, var(--c2) 45%, transparent)', r: 5 },
            ball(PLAY_PATH[i])])), { caption: (i) => `step ${i}: w = ${num(PLAY_PATH[i], 4)}, loss = ${num(loss(PLAY_PATH[i]), 4)}${i ? `, slope was ${num(slope(PLAY_PATH[i - 1]), 4)}` : ''}`, autoplayMs: 900 }),
        },
        {
          kind: 'fill',
          body: `Loss = (w − ${A0})² + 1, so slope = 2(w − ${A0}). You stand at **w = ${FILL_W}** with learning rate **η = ${FILL_ETA}**. Take one step.`,
          widget: () => plotEl(valley([tangent(FILL_W), ball(FILL_W)])),
          template: `slope = [[0]] · step = η × slope = [[1]] · new w = [[2]]`,
          blanks: [
            tiles(num(FILL_SLOPE), [num(FILL_SLOPE / 2), num(FILL_SLOPE * 2)]),
            tiles(num(FILL_STEP), [num(FILL_SLOPE), num(FILL_ETA)]),
            tiles(num(FILL_NEW), [num(FILL_W + FILL_STEP), num(A0)]),
          ],
          hint: 'Plug w into 2(w − 3) first.',
          explain: `slope = 2 × (${FILL_W} − ${A0}) = ${num(FILL_SLOPE)}; step = ${FILL_ETA} × ${num(FILL_SLOPE)} = ${num(FILL_STEP)}; new w = ${FILL_W} − ${num(FILL_STEP)} = ${num(FILL_NEW)}. Closer to the bottom at ${A0}, but not there yet.`,
        },
        {
          kind: 'number',
          body: `Same valley, same η = ${PLAY_ETA}. Start at **w = ${TWO_W0}** and take **two** steps. Where are you?`,
          answer: TWO[2], tol: 0.005,
          hint: `First step: slope at ${TWO_W0} is ${num(slope(TWO_W0))}.`,
          explain: `Step 1: ${TWO_W0} − ${PLAY_ETA} × (${num(slope(TWO[0]))}) = ${num(TWO[1])}. Step 2: ${num(TWO[1])} − ${PLAY_ETA} × (${num(slope(TWO[1]))}) = ${num(TWO[2])}. Each step halves the distance to ${A0}.`,
        },
        {
          kind: 'task',
          body: `Now you choose the learning rate. Starting at w = 0, the ball takes ${LR_STEPS} steps. Find a learning rate that ends **within ${LR_TOL} of the bottom** (w = ${A0}).`,
          widget: plotExplorer({
            params: [{ id: 'eta', label: 'learning rate η', min: 0.05, max: 1.1, step: 0.05, value: 0.05, format: (v) => v.toFixed(2) }],
            spec: (v) => {
              const ws = descend(0, v.eta, LR_STEPS);
              return valley([
                { type: 'line', pts: ws.map((w) => [w, loss(w)] as Pt), color: 'var(--c2)', width: 1.5 },
                { type: 'dots', pts: ws.slice(0, -1).map((w) => [w, loss(w)] as Pt), color: 'color-mix(in srgb, var(--c2) 45%, transparent)', r: 5 },
                ball(ws[LR_STEPS])]);
            },
            readout: (v) => { const w = descend(0, v.eta, LR_STEPS)[LR_STEPS]; return `after ${LR_STEPS} steps: w = ${num(w, 4)}, ${num(Math.abs(w - A0), 3)} from the bottom`; },
            goal: (v) => Math.abs(descend(0, v.eta, LR_STEPS)[LR_STEPS] - A0) < LR_TOL,
            goalText: 'Close enough to the bottom.',
          }),
          hint: 'Too small and you crawl; too big and you overshoot. Try the middle of the range.',
          explain: `Learning rates from about 0.25 to 0.75 get there in ${LR_STEPS} steps. Below that you crawl; above it you bounce from side to side, and beyond 1 the bounces grow.`,
        },
        {
          kind: 'match',
          body: `For this valley, match each learning rate to what gradient descent does.`,
          heads: ['Learning rate', 'Behaviour'],
          pairs: ([0.02, 0.5, 0.9, 1.1] as const).map((eta): [string, string] => [`η = ${eta}`, LR_TEXT[lrKind(eta)]]),
          hint: 'Each step multiplies the distance to the bottom by (1 − 2η).',
          explain: 'Factor 1 − 2η: 0.96 (creeps), 0 (straight to the bottom), −0.8 (flips side but shrinks), −1.2 (flips and grows: diverges). Real training uses rates chosen by experiment for the same reason.',
        },
        {
          kind: 'read',
          title: 'Training = going downhill on data',
          body: `Where does the loss come from? From data. Take the model **y = w·x** (a line through the origin) and three points. For each point, the **error** is prediction − actual (the dashed red bars). Square them and average: the **mean squared error**.\n\nEach value of w gives a different loss. Training means finding the w with the lowest one. Here, w = ${W_TRY}.`,
          widget: () => plotEl(fitSpec(W_TRY)),
        },
        {
          kind: 'number',
          body: `Points ${LINE_PTS.map(pt).join(', ')}. With **w = ${W_TRY}**, what is the mean squared error?`,
          widget: () => plotEl(fitSpec(W_TRY)),
          answer: lineMse(W_TRY), tol: 0.01,
          hint: `Predictions are ${LINE_PTS.map(([x]) => num(W_TRY * x)).join(', ')}.`,
          explain: `Errors: ${LINE_PTS.map(([x, y]) => num(W_TRY * x - y)).join(', ')}. Squares: ${LINE_PTS.map(([x, y]) => num((W_TRY * x - y) ** 2)).join(', ')}. Mean: ${num(lineMse(W_TRY), 4)}.`,
        },
        {
          kind: 'task',
          body: 'Now fit it. Adjust w to make the mean squared error as small as possible.',
          widget: plotExplorer({
            params: [{ id: 'w', label: 'w', min: 0, max: 4, step: 0.1, value: W_TRY, format: (v) => v.toFixed(1) }],
            spec: (v) => fitSpec(v.w),
            readout: (v) => `mean squared error = ${lineMse(v.w).toFixed(3)}`,
            goal: (v) => Math.abs(v.w - W_BEST) < 0.001,
            goalText: 'Lowest possible error.',
          }),
          hint: 'Watch the error readout: it falls, bottoms out, then rises again.',
          explain: `w = ${num(W_BEST)} gives the lowest error, ${num(lineMse(W_BEST), 4)}. The line can’t pass through all three points, so the best it can do is balance the errors.`,
        },
        {
          kind: 'point',
          body: 'Here is that error for every w: the loss curve for this data. Tap its **lowest point**.',
          plot: { x: [0, 4], y: [0, 20], size: [440, 280], ticks: [0.5, 5], xlabel: 'w', ylabel: 'loss', layers: [{ type: 'fn', f: lineMse, color: 'var(--c1)' }] },
          answer: { x: W_BEST }, tol: 0.15, snap: 0.1,
          hint: 'It’s the w you found by hand.',
          explain: `The minimum is at w = ${num(W_BEST)}. Gradient descent would roll there on its own, using only the slope. Real networks do exactly this, with millions of w’s at once.`,
        },
        {
          kind: 'order',
          body: 'Put one round of training in order.',
          items: [
            'Make predictions with the current weights',
            'Measure the loss against the right answers',
            'Compute the slope (gradient) of the loss',
            'Nudge every weight a small step downhill',
            'Repeat until the loss stops improving',
          ],
          hint: 'You need predictions before you can measure how wrong they are.',
          explain: 'Predict, measure, compute the gradient, step. Repeat thousands of times. That loop, scaled up, is how neural networks are trained.',
        },
      ],
      practice: [genGDStep, genLR, genMSE],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'neurons',
      title: 'Neurons & networks',
      goal: 'Compute a neuron’s output, build logic gates, and see why XOR needs a hidden layer.',
      steps: [
        {
          kind: 'choice',
          body: 'A tiny decision unit adds up evidence: **rain counts 3**, **cold counts 1**. It says “take a coat” when the total is **above 2**. Today it’s raining (rain = 1) but warm (cold = 0). Coat?',
          options: [
            { text: 'Yes', correct: true },
            { text: 'No', why: 'Rain alone adds 3 × 1 = 3, which is already above 2.' },
            { text: 'Only if it’s also cold', why: 'Cold adds just 1. Rain’s 3 clears the bar by itself.' },
          ],
          explain: '3 × 1 + 1 × 0 = 3 > 2, so yes. Inputs times weights, summed, compared with a threshold.',
        },
        {
          kind: 'read',
          title: 'An artificial neuron',
          body: 'That’s an **artificial neuron**. Multiply each input by its **weight**, add a **bias**, then pass the total through an **activation**. The simplest is a **step**: output 1 if the total is above 0, else 0.\n\nThe bias is the threshold moved across: “total > 2” is the same as “total − 2 > 0”, so bias = −2. Here is the coat neuron with today’s inputs.',
          widget: () => neuronDiagram(3, 1, -2, [1, 0]),
        },
        {
          kind: 'fill',
          body: `A neuron has weights **${num(FILL_N.w1)}** and **${num(FILL_N.w2)}**, bias **${num(FILL_N.b)}**. Both inputs are 1.`,
          widget: () => neuronDiagram(FILL_N.w1, FILL_N.w2, FILL_N.b),
          template: `sum = ${num(FILL_N.w1)}×1 + (${num(FILL_N.w2)})×1 + (${num(FILL_N.b)}) = [[0]], so the output is [[1]].`,
          blanks: [
            tiles(num(FILL_N_SUM), [num(FILL_N.w1 + FILL_N.w2 - FILL_N.b), num(-FILL_N_SUM), num(FILL_N.w1 - FILL_N.w2)]),
            tiles(String(stepFn(FILL_N_SUM)), [String(1 - stepFn(FILL_N_SUM))]),
          ],
          hint: 'Careful with the signs.',
          explain: `${num(FILL_N.w1)} − 1 − 0.5 = ${num(FILL_N_SUM)}, which is ${FILL_N_SUM > 0 ? 'above' : 'not above'} 0, so it outputs ${stepFn(FILL_N_SUM)}.`,
        },
        {
          kind: 'task',
          body: 'Inputs are 0 or 1. Set the weights and bias so the neuron outputs 1 **only when both inputs are 1**: logical **AND**.',
          widget: gateExplorer(GATES.AND, 'AND', [1, 1, 0]),
          hint: 'With both inputs on, the sum is w₁ + w₂ + b; with one on, it’s w₁ + b or w₂ + b. Only the first should be above 0.',
          explain: 'For example w₁ = 1, w₂ = 1, b = −1.5: sums −1.5, −0.5, −0.5, 0.5 for 00, 01, 10, 11. Only both-on clears 0.',
        },
        {
          kind: 'multi',
          body: 'Which of these settings make the neuron compute **OR** (output 1 if at least one input is 1)?',
          options: orOptions,
          hint: 'Check each against all four inputs. With both inputs 0, the sum is just the bias: it must not be above 0.',
          explain: 'OR needs a bias that is not above 0 (so 00 gives 0), but small enough that one input’s weight lifts the sum above 0. Many weight settings do the same job.',
        },
        {
          kind: 'read',
          title: 'A neuron draws a line',
          body: 'Plot the four inputs as corners of a square. The neuron fires where w₁x₁ + w₂x₂ + b > 0, and the boundary w₁x₁ + w₂x₂ + b = 0 is a **straight line**: the same linear classifier as lesson 2. Here is the AND neuron (1, 1, −1.5): its line cuts off only the (1, 1) corner.',
          widget: () => plotEl(cornersSpec(GATES.AND, [
            { type: 'area', f: () => 1.5, base: (x) => 1.5 - x, from: -0.5, to: 1.5, color: 'var(--c1)' },
            { type: 'fn', f: (x) => 1.5 - x, color: 'var(--text)', width: 2 }])),
        },
        {
          kind: 'point',
          body: 'The OR neuron with weights 1, 1 and bias −0.5 fires when **x₁ + x₂ − 0.5 > 0**. Its boundary is the line x₁ + x₂ = 0.5. Tap where that line **crosses the x₁ axis** (where x₂ = 0).',
          plot: cornersSpec(GATES.OR),
          answer: { x: 0.5, y: 0 }, tol: 0.1, snap: 0.25,
          hint: 'Set x₂ = 0 in x₁ + x₂ = 0.5.',
          explain: 'x₁ + 0 = 0.5, so (0.5, 0). The line runs from there to (0, 0.5), cutting off the (0, 0) corner: everything else fires. That’s OR.',
        },
        {
          kind: 'choice',
          body: '**XOR** outputs 1 when **exactly one** input is 1. Can any single straight line put both 1s on one side and both 0s on the other?',
          widget: () => plotEl(cornersSpec(GATES.XOR)),
          options: [
            { text: 'No: the 1s sit on opposite corners', correct: true },
            { text: 'Yes: a diagonal line', why: 'A diagonal between the 1s would pass through them; one cutting across separates one corner from the rest. Either way, a 1 and a 0 end up together.' },
            { text: 'Yes, with a big enough bias', why: 'The bias only slides the line; it can’t make one line split opposite corners.' },
          ],
          explain: 'Any line leaves a 1 and a 0 together. So no single neuron computes XOR. This limitation of single-layer networks was famously highlighted in the late 1960s.',
        },
        {
          kind: 'read',
          title: 'A hidden layer',
          body: 'Use two neurons first. **h₁** computes OR (at least one), **h₂** computes NAND (not both). A third neuron ANDs them: “at least one, but not both” = XOR.\n\nThe middle neurons are a **hidden layer**. Their outputs are new features the network makes for itself, and in those features the problem *is* separable by a line.',
          widget: () => xorDiagram(),
        },
        {
          kind: 'fill',
          body: `Trace the network for input **x₁ = ${XOR_IN[0]}, x₂ = ${XOR_IN[1]}**.`,
          widget: () => xorDiagram(),
          template: 'h₁ (OR) = [[0]] · h₂ (NAND) = [[1]] · out (AND of h₁, h₂) = [[2]]',
          blanks: [tiles(String(XOR_TRACE.h1), [String(1 - XOR_TRACE.h1)]), tiles(String(XOR_TRACE.h2), [String(1 - XOR_TRACE.h2)]), tiles(String(XOR_TRACE.out), [String(1 - XOR_TRACE.out)])],
          hint: 'h₁: 1·x₁ + 1·x₂ − 0.5. h₂: −x₁ − x₂ + 1.5. Then out: h₁ + h₂ − 1.5.',
          explain: `h₁ = step(${XOR_IN[0]} + ${XOR_IN[1]} − 0.5) = ${XOR_TRACE.h1}; h₂ = step(−${XOR_IN[0]} − ${XOR_IN[1]} + 1.5) = ${XOR_TRACE.h2}; out = step(${XOR_TRACE.h1} + ${XOR_TRACE.h2} − 1.5) = ${XOR_TRACE.out}. Exactly one input is on, so XOR is ${GATES.XOR(...XOR_IN)}.`,
        },
        {
          kind: 'sort',
          body: 'Which two-input functions can **one** step neuron compute, and which need a **hidden layer**?',
          widget: () => dataTable(['x₁ x₂', ...GATE_SORT.map(([n]) => n.split(' ')[0])], INPUTS.map(([a, b]) => [`${a} ${b}`, ...GATE_SORT.map(([, g]) => g(a, b))])),
          bins: ['One neuron can', 'Needs a hidden layer'],
          items: GATE_SORT.map(([text, g]) => ({ text, bin: oneNeuronCan(g) ? 0 : 1 })),
          hint: 'Picture the 1s on the corners of the square. Can one line cut them off?',
          explain: 'AND, OR, NAND and NOR each cut off one corner or three: one line does it. XOR and XNOR put the 1s on opposite corners: no line can, so they need a hidden layer.',
        },
        {
          kind: 'read',
          title: 'Deep networks',
          body: 'Stack many layers and you have a **deep** network. Each layer builds features from the one before: in image models, early layers tend to respond to edges, later ones to larger shapes.\n\nReal networks use smooth activations such as **sigmoid** or **ReLU** instead of a hard step, so a tiny change in a weight makes a tiny change in the output. That gives a slope everywhere, which is what gradient descent needs to tune every weight. Large modern networks have millions to billions of weights, but each one is this same simple ingredient.',
          widget: () => withLegend(plotEl({ x: [-4, 4], y: [-0.5, 3], size: [440, 260], ticks: [1, 1], layers: [
            { type: 'fn', f: (x) => stepFn(x), color: 'var(--muted)', width: 2 },
            { type: 'fn', f: sigmoid, color: 'var(--c1)' },
            { type: 'fn', f: relu, color: 'var(--c2)' }] }), legend([['var(--muted)', 'step'], ['var(--c1)', 'sigmoid'], ['var(--c2)', 'ReLU']])),
        },
        {
          kind: 'match',
          body: 'Match each activation function to its shape (see the previous picture).',
          heads: ['Activation', 'Shape'],
          pairs: [
            ['Step', 'Jumps straight from 0 to 1 at zero'],
            ['Sigmoid', 'A smooth S-curve from 0 up to 1'],
            ['ReLU', 'Zero for negatives, then a straight rising line'],
          ],
          hint: 'Only one of them keeps growing without limit.',
          explain: 'Step is all-or-nothing (no useful slope). Sigmoid smooths it into an S. ReLU, max(0, z), is simple and widely used in deep networks.',
        },
        {
          kind: 'number',
          body: `A network has **${NET_SIZES[0]} inputs**, a hidden layer of **${NET_SIZES[1]}** neurons and **${NET_SIZES[2]}** outputs. Every neuron connects to every neuron in the next layer. How many **weights** (connections) does it have? Don’t count biases.`,
          widget: () => netDiagram(NET_SIZES.map((n, l) => Array.from({ length: n }, (_, i) => ({ label: l === 0 ? `x${i + 1}` : l === 1 ? `h${i + 1}` : `y${i + 1}` }))),
            NET_SIZES.slice(1).flatMap((n, l) => Array.from({ length: NET_SIZES[l] * n }, (_, k) => ({ from: [l, Math.floor(k / n)] as [number, number], to: [l + 1, k % n] as [number, number] }))), { height: 200 }),
          answer: countWeights(NET_SIZES), tol: 0.5,
          hint: 'Count the lines: inputs × hidden, plus hidden × outputs.',
          explain: `${NET_SIZES[0]} × ${NET_SIZES[1]} + ${NET_SIZES[1]} × ${NET_SIZES[2]} = ${countWeights(NET_SIZES)}. Widen the layers and the count grows fast, which is how networks reach millions of weights.`,
        },
      ],
      practice: [genNeuronOut, genGate, genWeights],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'overfitting',
      title: 'Overfitting & generalisation',
      goal: 'Tell memorising from learning, using training and test error.',
      steps: [
        {
          kind: 'choice',
          body: `Two curves were fitted to the same 8 training points. The dashed one bends through **every** point exactly. Which will predict **new** points from the same source better?`,
          widget: () => withLegend(plotEl(curveSpec([{ f: FITS[SIMPLE_DEG], color: 'var(--c3)' }, { f: FITS[WIGGLY_DEG], color: 'var(--c4)', dash: true }], false)), legend([['var(--c3)', 'smooth curve'], ['var(--c4)', 'wiggly curve'], ['var(--c1)', 'training points']])),
          options: [
            { text: 'The smooth curve', correct: true },
            { text: 'The wiggly curve: it has zero error', why: 'Zero error on the training points, yes, but it bent itself to fit their random noise. Between and beyond the points it swings wildly.' },
            { text: 'Both equally: they both fit the data', why: 'They fit the *training* data differently, and they disagree wildly between the points. They can’t both predict well there.' },
          ],
          explain: 'The data have a simple trend plus noise. The smooth curve captures the trend; the wiggly one memorises the noise.',
        },
        {
          kind: 'read',
          title: 'Train and test',
          body: `To find out, we hold back **test points**: data from the same source that the model never saw while fitting (orange).\n\nThe smooth curve’s mean squared error on them is ${e2(TEST_ERR[SIMPLE_DEG])}. The wiggly one’s is ${e2(TEST_ERR[WIGGLY_DEG])}, even though its training error is ${e2(TRAIN_ERR[WIGGLY_DEG])}. It has **overfitted**: learned the particular examples instead of the pattern.`,
          widget: () => withLegend(plotEl(curveSpec([{ f: FITS[SIMPLE_DEG], color: 'var(--c3)' }, { f: FITS[WIGGLY_DEG], color: 'var(--c4)', dash: true }], true)), trainTestLegend()),
        },
        {
          kind: 'task',
          body: 'Slide the model’s **complexity** (polynomial degree: 0 is a flat line, 1 a straight line, higher degrees can bend more). Find the degree with the **lowest test error**.',
          widget: (ctx) => h('div', null, plotExplorer({
            params: [{ id: 'd', label: 'degree', min: 0, max: 7, step: 1, value: 0 }],
            spec: (v) => curveSpec([{ f: FITS[v.d], color: 'var(--c3)' }], true),
            readout: (v) => `training error ${e2(TRAIN_ERR[v.d])} · test error ${e2(TEST_ERR[v.d])}`,
            goal: (v) => v.d === BEST_DEG,
            goalText: 'Best on the held-back data.',
          })(ctx), trainTestLegend()),
          hint: 'Ignore the training error: it always falls as the degree rises.',
          explain: `Degree ${BEST_DEG} gives the lowest test error (${e2(TEST_ERR[BEST_DEG])}). Lower degrees are too stiff (underfitting); higher ones chase noise (overfitting).`,
        },
        {
          kind: 'order',
          body: 'Rank these fits from **highest training error to lowest**.',
          items: ORDER_DEGS.map(degName),
          hint: 'A more flexible curve can always do at least as well on the points it is fitted to.',
          explain: `Training error: ${ORDER_DEGS.map((d) => `degree ${d}: ${e2(TRAIN_ERR[d])}`).join(', ')}. More flexibility always fits the training data better, so training error alone can’t tell you when to stop.`,
        },
        {
          kind: 'read',
          title: 'The U-curve',
          body: `Training error (blue) falls steadily as the model gets more flexible. Test error (orange) falls at first, then climbs as the model starts fitting noise (at degree 7 it is off the chart: ${e2(TEST_ERR[7])}). The sweet spot is where test error bottoms out.`,
          widget: () => withLegend(plotEl({ x: [0, 7], y: [0, 1.6], size: [440, 260], ticks: [1, 0.4], xlabel: 'degree', ylabel: 'error', layers: [
            { type: 'line', pts: DEGS.map((d) => [d, TRAIN_ERR[d]] as Pt), color: 'var(--c1)' }, { type: 'dots', pts: DEGS.map((d) => [d, TRAIN_ERR[d]] as Pt), color: 'var(--c1)', r: 4 },
            { type: 'line', pts: DEGS.map((d) => [d, Math.min(TEST_ERR[d], 3)] as Pt), color: 'var(--c2)' }, { type: 'dots', pts: DEGS.map((d) => [d, TEST_ERR[d]] as Pt), color: 'var(--c2)', r: 4 }] }),
            legend([['var(--c1)', 'training error'], ['var(--c2)', 'test error']])),
        },
        {
          kind: 'match',
          body: 'Match each result to its diagnosis.',
          heads: ['Result', 'Diagnosis'],
          pairs: [
            ['High training error, high test error', 'Underfitting: too simple'],
            ['Near-zero training error, high test error', 'Overfitting: memorised'],
            ['Low training error, similar test error', 'Good fit'],
          ],
          hint: 'Training error tells you if it learned anything; the gap tells you if it generalised.',
          explain: 'Underfitting fails even on data it trained on. Overfitting shows as a gap between training and test. A good fit does well on both.',
        },
        {
          kind: 'sort',
          body: 'Sort each sign into overfitting or underfitting.',
          bins: ['Overfitting', 'Underfitting'],
          items: [
            { text: 'Curve passes through every training point but swings between them', bin: 0 },
            { text: 'Training error far below test error', bin: 0 },
            { text: 'It memorised the labels of noisy examples', bin: 0 },
            { text: 'A straight line through clearly curved data', bin: 1 },
            { text: 'Training error is high', bin: 1 },
            { text: 'It predicts roughly the average for everything', bin: 1 },
          ],
          hint: 'Too flexible, or too stiff?',
          explain: 'Overfitting = too flexible for the data: great on training, poor on new cases. Underfitting = too stiff: poor even on training.',
        },
        {
          kind: 'multi',
          body: 'A model overfits. Which of these are likely to help?',
          options: [
            { text: 'Collect more training data', correct: true },
            { text: 'Use a simpler model', correct: true },
            { text: 'Penalise complexity during training (regularisation)', correct: true },
            { text: 'Keep training longer on the same data', why: 'More passes over the same data usually lets the model memorise it even more closely.' },
            { text: 'Report training accuracy instead of test accuracy', why: 'That hides the problem rather than fixing it: the model would still fail on new data.' },
          ],
          explain: 'More data leaves less room to memorise; simpler models and regularisation limit how much they can bend. Only the test set tells you whether it worked.',
        },
        {
          kind: 'read',
          title: 'More data tames wiggles',
          body: 'Same flexible degree-7 model, more training points. With 8 points it can thread through each one. With many more, it can’t chase them all, so it has to follow the trend. Step through.',
          widget: () => h('div', null, stepper(MORE_N.length, (i) => plotEl(curveSpec([{ f: MORE_FITS[i], color: 'var(--c4)' }], false, MORE_SETS[i])),
            { caption: (i) => `${MORE_N[i]} training points · test error ${e2(MORE_TEST[i])}`, autoplayMs: 1400 }), trainTestLegend(false)),
        },
        {
          kind: 'number', prob: true,
          body: 'A “model” just memorises its 1,000 training emails, so its training accuracy is 100%. On new emails it has never seen, it always answers “not spam”. If **20%** of new emails are spam, what is its test accuracy?',
          widget: () => h('div', null, iconArray(100, 20, { cols: 20, colors: ['var(--c4)', 'var(--line)'] }), note('100 new emails; pink = spam')),
          answer: 0.8, tol: 0.006,
          hint: 'Its fallback is right for every email that isn’t spam.',
          explain: 'It gets the 80% non-spam right and misses all spam: 80%, no better than knowing nothing. Memorising isn’t learning.',
        },
        {
          kind: 'choice',
          body: 'You try 50 different models and keep the one with the best **test** score. Is that score now a fair estimate of how it will do on brand-new data?',
          options: [
            { text: 'No: picking the best on the test set makes it look a bit too good', correct: true },
            { text: 'Yes: the test data was never used for training', why: 'It wasn’t used to set weights, but it was used to *choose* the model. Among 50 tries, the winner is partly the one that got lucky on those particular test points.' },
            { text: 'Yes, as long as there are 50 models', why: 'More models makes it worse: more chances for one to look good by luck.' },
          ],
          explain: 'Choosing with the test set leaks information. The standard fix: choose with a separate **validation** set, and keep the test set for one final check.',
        },
        {
          kind: 'fill',
          body: 'Complete the standard recipe.',
          template: 'Fit the weights on the [[0]] set. Compare models and settings on the [[1]] set. Report final performance on the [[2]] set, looked at only [[3]].',
          blanks: [
            { options: ['training', 'validation', 'test'], answer: 0 },
            { options: ['training', 'validation', 'test'], answer: 1 },
            { options: ['training', 'validation', 'test'], answer: 2 },
            { options: ['once, at the end', 'after every change', 'never'], answer: 0 },
          ],
          hint: 'Three separate piles of data, each with one job.',
          explain: 'Training data sets the weights, validation data picks among models, and the untouched test set gives an honest estimate of performance on new data.',
        },
      ],
      practice: [genDiagnose, genMemorize, genBestDegree],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'language',
      title: 'Language models',
      goal: 'Build a bigram model by counting, sample from it, and see why fluent isn’t the same as true.',
      steps: [
        {
          kind: 'choice',
          body: 'Finish the phrase: **“Once upon a …”**',
          options: [
            { text: 'time', correct: true },
            { text: 'mountain', why: 'It’s grammatical, but in all the text you’ve ever read, “once upon a” is almost always followed by “time”.' },
            { text: 'Tuesday', why: 'Possible, but you have seen “once upon a time” far more often.' },
          ],
          explain: 'You didn’t look anything up; you predicted the most likely next word from all the text you have seen. That is the core job of a language model.',
        },
        {
          kind: 'read',
          title: 'Predict the next token',
          body: 'A **language model** reads text as **tokens** (words, or pieces of words) and, given the tokens so far, gives a probability to every possible next token. To write, it picks one, appends it, and repeats.\n\nThe split below is only illustrative: real tokenizers differ, but common words are often a single token and rarer words are split into pieces.',
          widget: () => h('div', null, chips(['Once', ' upon', ' a', ' time', ',', ' an', ' un', 'believ', 'able', ' dragon'], { hi: [6, 7, 8] }), note('“unbelievable” split into three pieces')),
        },
        {
          kind: 'number',
          body: 'Let’s build the simplest language model from this tiny text (“.” counts as a token: end of sentence). First, how many times does the word **“the”** appear?',
          widget: () => chips(TOK),
          answer: THE_COUNT, tol: 0.5,
          hint: 'Each sentence has a couple.',
          explain: `“the” appears ${THE_COUNT} times. Counting is all this model will do.`,
        },
        {
          kind: 'read',
          title: 'A bigram model',
          body: `For every word, count which word comes **right after** it. Those counts, turned into fractions, are a **bigram model**. After “the” the text has ${AFTER_THE.map(([w, n]) => `“${w}” ${n}×`).join(', ')}. So P(${TOP_THE} | the) = ${BG['the'][TOP_THE]}/${totalAfter('the')} = ${num(P('the', TOP_THE))}.`,
          widget: () => dataTable(['after “the”', 'count', 'probability'], AFTER_THE.map(([w, n]) => [w, n, num(n / totalAfter('the'))])),
        },
        {
          kind: 'number', prob: true,
          body: 'Your turn. Using the same text, what probability does the bigram model give to **“sat”** coming right after **“cat”**?',
          widget: () => chips(TOK, { hi: TOK.map((t, i) => (t === 'cat' ? i : -1)).filter((i) => i >= 0) }),
          answer: P('cat', 'sat'), tol: 0.006,
          hint: 'Look at each highlighted “cat”: what comes next?',
          explain: `“cat” is followed by ${followers('cat').map(([w, n]) => `“${w}” ${n}×`).join(', ')}: ${BG['cat']['sat']}/${totalAfter('cat')} = ${pct(P('cat', 'sat'))}.`,
        },
        {
          kind: 'fill',
          body: 'And after **“sat”**?',
          widget: () => chips(TOK, { hi: TOK.map((t, i) => (t === 'sat' ? i : -1)).filter((i) => i >= 0) }),
          template: 'After “sat” the next word is always [[0]], so the model gives it probability [[1]].',
          blanks: [tiles(followers('sat')[0][0], ['the', 'mat', 'cat']), tiles(num(P('sat', followers('sat')[0][0])), ['0.5', '1/3', '0'])],
          hint: 'Find every “sat”.',
          explain: `All ${totalAfter('sat')} times, “sat” is followed by “${followers('sat')[0][0]}”: probability ${num(P('sat', 'on'))}. The model is certain, because its tiny text never showed anything else.`,
        },
        {
          kind: 'order',
          body: `**Greedy** generation always picks the single most likely next word. Starting from **“${GREEDY_START}”**, put the next four words it produces in order.`,
          widget: () => dataTable(['word', 'followed by (count)'], [...new Set([GREEDY_START, ...GREEDY])].sort().map((w) => [w, followers(w).map(([x, n]) => `${x} ${n}`).join(', ')])),
          items: GREEDY,
          hint: 'Follow the table one row at a time.',
          explain: `${[GREEDY_START, ...GREEDY].join(' → ')} → … It then loops forever: “cat sat on the cat sat on the…”. Always taking the top choice gets repetitive, which is one reason real systems **sample** instead.`,
        },
        {
          kind: 'task',
          body: `Sampling picks the next word at random, in proportion to its probability. **Temperature** reshapes those probabilities first: below 1 sharpens them, above 1 flattens them. Set the temperature so the top word after “the” gets **at least ${pct(TEMP_GOAL, 0)}**.`,
          widget: explorer({
            params: [{ id: 'T', label: 'temperature', min: 0.1, max: 2, step: 0.1, value: 1, format: (v) => v.toFixed(1) }],
            draw: (v) => barChart(AFTER_THE.map(([w], i) => ({ label: w, value: temper(THE_PROBS, v.T)[i] })), { max: 1, format: (x) => pct(x, 0), title: 'next word after “the”' }),
            readout: (v) => `top word “${TOP_THE}”: ${pct(tempTop(v.T))}`,
            goal: (v) => tempTop(v.T) >= TEMP_GOAL,
            goalText: 'Nearly always the same word now.',
          }),
          hint: 'Lower the temperature.',
          explain: `At T = 1 the model samples its counted probabilities (${pct(THE_PROBS[0])} for “${TOP_THE}”). Turning T down to ${[0.1, 0.2, 0.3, 0.4, 0.5].filter((T) => tempTop(T) >= TEMP_GOAL).pop()} or below pushes it over ${pct(TEMP_GOAL, 0)}. As T approaches 0, sampling becomes greedy.`,
        },
        {
          kind: 'match',
          body: 'Match each temperature to how the generated text behaves.',
          heads: ['Temperature', 'Behaviour'],
          pairs: [
            ['Near 0', 'Almost always the top word: predictable, repetitive'],
            ['1', 'Words picked in proportion to the model’s probabilities'],
            ['Very high', 'Close to random: unlikely words often, frequent nonsense'],
          ],
          hint: 'Low temperature sharpens, high temperature flattens.',
          explain: 'Temperature trades predictability for variety. Low suits answers where you want the most likely text; higher gives more varied writing, at the risk of nonsense.',
        },
        {
          kind: 'multi',
          body: 'Which of these sentences could this bigram model generate even though they **never appear** in its text?',
          widget: () => chips(TOK),
          options: sentenceOptions,
          hint: 'Check each consecutive pair of words: has the model ever seen it?',
          explain: 'Any chain of word pairs it has seen is possible, so it produces new sentences, some sensible and some odd. It never “understood” anything; it stitched together familiar pairs.',
        },
        {
          kind: 'estimate',
          body: `At temperature 1, how many of 100 continuations of “the” would you expect to be **“${TOP_THE}”**?`,
          widget: () => barChart(AFTER_THE.map(([w], i) => ({ label: w, value: THE_PROBS[i] })), { max: 1, format: (x) => pct(x, 0) }),
          min: 0, max: 100, step: 1, answer: Math.round(THE_PROBS[0] * 100), tol: 5,
          hint: 'Probability times number of tries.',
          explain: `${pct(THE_PROBS[0])} of 100 ≈ ${Math.round(THE_PROBS[0] * 100)}. Run it again and you’d get a slightly different count: sampled text varies from run to run.`,
        },
        {
          kind: 'choice',
          body: `A second bigram model learns from this text. You prompt it with **“the capital is”**. What does it predict next?`,
          widget: () => h('div', null, chips(SYD.split(' ')), barChart(SYD_AFTER.map(([w, n]) => ({ label: w, value: n / SYD_TOTAL })), { max: 1, format: (x) => pct(x, 0), title: 'next word after “is”' })),
          options: [
            { text: `“${SYD_TOP}”, with ${pct(SYD_P, 0)} probability`, correct: true },
            { text: '“canberra”, because the text says the capital is canberra', why: 'A bigram model only looks at the last word, “is”. It never connects “capital” with “canberra”.' },
            { text: 'Nothing: it never saw “the capital is sydney”', why: 'It doesn’t need to have seen the whole sentence. It only asks what most often follows “is”.' },
          ],
          explain: `“is” is followed by “${SYD_TOP}” ${SYD_AFTER[0][1]} of ${SYD_TOTAL} times, so the model confidently says “${SYD_TOP}”, which is wrong. Real language models use far more context and are vastly better, but the principle holds: they predict likely text, they don’t check facts. Fluent and confident is not the same as true.`,
        },
      ],
      practice: [genBigramProb, genTemp, genGreedy],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'wisely',
      title: 'Using AI wisely',
      goal: 'Spot bias and hallucination, and know when to verify.',
      steps: [
        {
          kind: 'choice',
          body: 'A company trains a model on ten years of its own hiring decisions to screen new CVs. In those years it rarely hired people from group B. What will the model likely do with strong CVs from group B?',
          widget: () => barChart([{ label: 'group A', value: HIRES.a, color: 'var(--c1)' }, { label: 'group B', value: HIRES.b, color: 'var(--c2)' }], { title: 'past hires in the training data (example)' }),
          options: [
            { text: 'Score them lower: it learned the past pattern', correct: true },
            { text: 'Score them fairly: computers are neutral', why: 'The model is “neutral” only in that it copies faithfully. It reproduces whatever pattern is in its training labels, including past unfairness.' },
            { text: 'Score them higher to make up for the past', why: 'Nothing in the data asks it to correct anything. It predicts what past decisions would have been.' },
          ],
          explain: 'A model learns to predict its labels. If the labels encode biased decisions, the model learns the bias, and can apply it at scale.',
        },
        {
          kind: 'read',
          title: 'Bias comes in with the data',
          body: `Models learn from data, so they inherit its gaps and slants. A face detector trained on ${GROUPS.a} photos of group A and only ${GROUPS.b} of group B saw far fewer examples of B, so it’s typically worse on B.\n\nIn this example it gets ${pct(GROUPS.accA, 0)} right for A and ${pct(GROUPS.accB, 0)} for B.`,
          widget: () => h('div', null, barChart([{ label: 'group A', value: GROUPS.a, color: 'var(--c1)' }, { label: 'group B', value: GROUPS.b, color: 'var(--c2)' }], { title: 'training photos' }),
            h('div', { style: 'height:12px' }), barChart([{ label: 'group A', value: GROUPS.accA, color: 'var(--c1)' }, { label: 'group B', value: GROUPS.accB, color: 'var(--c2)' }], { max: 1, format: (v) => pct(v, 0), title: 'accuracy' })),
        },
        {
          kind: 'number', prob: true,
          body: `It’s tested on ${GROUPS.a + GROUPS.b} faces in the same mix: ${GROUPS.a} from A, ${GROUPS.b} from B. What **overall** accuracy does the report show?`,
          widget: () => barChart([{ label: 'group A', value: GROUPS.accA, color: 'var(--c1)' }, { label: 'group B', value: GROUPS.accB, color: 'var(--c2)' }], { max: 1, format: (v) => pct(v, 0), title: 'accuracy per group' }),
          answer: OVERALL, tol: 0.0006,
          hint: 'Correct answers in each group, added, over the total.',
          explain: `${GROUPS.a} × ${num(GROUPS.accA)} + ${GROUPS.b} × ${num(GROUPS.accB)} = ${num(OVERALL * (GROUPS.a + GROUPS.b))} correct: ${pct(OVERALL)}. The headline looks great because group B is a small share. Always ask for results **per group**.`,
        },
        {
          kind: 'sort',
          body: 'Sort these uses of a general chat assistant: where is it usually **helpful**, and where should you **check carefully** before relying on it?',
          bins: ['Usually helpful', 'Check carefully'],
          items: [
            { text: 'Drafting a first version of an email', bin: 0 },
            { text: 'Brainstorming names for a project', bin: 0 },
            { text: 'Summarising a document you also have', bin: 0 },
            { text: 'Quoting exact sources and page numbers', bin: 1 },
            { text: 'Facts about events after its training data', bin: 1 },
            { text: 'Cases very unlike its training examples', bin: 1 },
          ],
          hint: 'Can you easily judge the output yourself, or does it hinge on an exact fact the model might not reliably know?',
          explain: 'Models are strong at producing plausible drafts you can judge yourself. They are weaker where plausible can still be wrong: exact citations, recent events, unusual cases.',
        },
        {
          kind: 'read',
          title: 'Hallucination',
          body: 'A language model generates likely-sounding text. When it doesn’t “know” something, the likely-sounding text can be **made up**: a plausible citation, a confident statistic, a function that doesn’t exist. This is called **hallucination**, and it comes out in the same fluent, confident tone as everything else.\n\nSo the tone tells you nothing. What matters is whether you can check it.',
          widget: () => dataTable(['If it gives you…', 'check by…'], [['a quote or citation', 'finding the original source'], ['a number or fact', 'a reliable reference'], ['code', 'running it and testing it'], ['a calculation', 'redoing it, or using a calculator']]),
        },
        {
          kind: 'multi',
          body: 'Which are good ways to verify an important answer from an AI assistant?',
          options: [
            { text: 'Check that cited sources exist and say what’s claimed', correct: true },
            { text: 'Compare with a reliable primary source', correct: true },
            { text: 'Run and test any code it wrote', correct: true },
            { text: 'Ask the same assistant “are you sure?” and accept its reply', why: 'It isn’t an independent check: models may simply agree, or apologise and change a right answer to a wrong one.' },
            { text: 'Trust it more when the answer is longer and more detailed', why: 'Length and detail are style, not evidence. Made-up answers can be long and specific too.' },
          ],
          explain: 'Verification means checking against something independent of the model: sources, references, tests.',
        },
        {
          kind: 'match',
          body: 'Match each failure to an example of it.',
          heads: ['Failure', 'Example'],
          pairs: [
            ['Hallucination', 'It cites a book that doesn’t exist'],
            ['Biased data', 'It works worse for a group rare in its training set'],
            ['Distribution shift', 'Trained on daytime photos, it fails on night-time ones'],
            ['Out-of-date knowledge', 'It describes something that changed after its training data'],
          ],
          hint: 'Each failure is about where the training data falls short.',
          explain: 'Each is the same root issue from a different side: a model only reflects the data it learned from, and says something fluent either way.',
        },
        {
          kind: 'estimate',
          body: `An assistant answers **${pct(CHAIN.p, 0)}** of questions correctly, independently. You ask it **${CHAIN.n}** questions and don’t check any. Roughly what’s the chance that **all ${CHAIN.n}** answers are right?`,
          widget: () => h('div', null, iconArray(CHAIN.n, Math.round(CHAIN.n * CHAIN.p), { cols: 10, colors: ['var(--good)', 'var(--bad)'] }), note(`On average ${Math.round(CHAIN.n * CHAIN.p)} of ${CHAIN.n} right… but which ones?`)),
          min: 0, max: 100, step: 1, answer: Math.round(CHAIN_ALL * 100), tol: 5, format: (v) => `${v}%`,
          hint: `${num(CHAIN.p)} multiplied by itself ${CHAIN.n} times.`,
          explain: `${num(CHAIN.p)}^${CHAIN.n} ≈ ${pct(CHAIN_ALL)}. Even a usually-right assistant is probably wrong somewhere across many answers, so check the ones that matter.`,
        },
        {
          kind: 'choice',
          body: 'A model learns to spot a disease in X-rays. In its training data, most sick patients’ scans came from one hospital whose scanner stamps a small logo in the corner. At a new hospital it does badly. What probably happened?',
          widget: () => h('div', null, pixels(XRAY, { size: 14, color: 'var(--c2)' }), note('A made-up scan: the orange mark is the scanner’s logo')),
          options: [
            { text: 'It learned to recognise the logo, not the disease', correct: true },
            { text: 'The new hospital’s patients are sicker', why: 'Possible in principle, but the logo is a much simpler explanation: the model found an easy shortcut that predicted the label in training.' },
            { text: 'It needs a higher learning rate', why: 'The learning rate affects how training converges, not what pattern the data rewards. It learned the shortcut successfully.' },
          ],
          explain: 'This is **shortcut learning**: the model latches onto any feature that predicts the label in training, even an accidental one. Testing on data from a different source exposes it.',
        },
        {
          kind: 'fill',
          body: 'Sum it up.',
          template: 'A model is only as good as its [[0]]. It is most reliable on inputs [[1]] its training examples, and its outputs should be [[2]] when the stakes are high.',
          blanks: [tiles('training data', ['vocabulary', 'confidence']), tiles('similar to', ['unlike', 'longer than']), tiles('verified', ['trusted', 'ignored'])],
          hint: 'Where does everything a model “knows” come from?',
          explain: 'Everything a model knows comes from its data. It does best on familiar kinds of input and is a useful first draft, not a final authority, when it matters.',
        },
        {
          kind: 'order',
          body: 'Put a sensible workflow for using AI on something important in order.',
          items: [
            'Describe the task clearly, with the context it needs',
            'Read the output critically',
            'Check key facts and test anything testable',
            'Decide what to use, and own the result',
          ],
          hint: 'Your own judgement comes last, and stays yours.',
          explain: 'Good input, critical reading, independent checks, then your decision. The tool can draft; responsibility for the result stays with you.',
        },
        {
          kind: 'read',
          title: 'What you now know',
          body: 'Models learn from **examples**: features in, labels out. They draw **boundaries**, measured by the right **errors** (not just accuracy). They improve by **gradient descent** on a loss. **Networks** of simple neurons build their own features. They must **generalise**, not memorise. **Language models** predict likely next tokens, which makes them fluent but not automatically right.\n\nUse them for what they’re good at, and check what matters.',
        },
      ],
      practice: [genGroupAcc, genAllRight, genStrongWeak],
    },
  ],
};
