// Systems Thinking: stocks and flows, reinforcing and balancing loops, delays, limits to growth,
// unintended consequences and leverage, step-by-step simulation, and using all of it for decisions.
// Every number in a question or an answer is computed below from its rule.
import type { Course, Generator, Layer, PlotSpec } from '../types';
import { h, num, pick, randInt, shuffle } from '../ui';
import { barChart, columnChart, dataTable } from '../viz/charts';
import { cellGrid } from '../viz/cs';
import { plotExplorer } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  SZ, graphGrid, loop, loopBuilder, loopSvg, plotBox, pts, run, showerStepper, stockFlow, tableStepper, thermo, thermoExplorer, tub, tubStepper,
} from '../widgets/systems';
import type { LLink, LNode } from '../widgets/systems';

const P = (spec: PlotSpec) => () => plotEl({ size: SZ, ...spec });
const r2 = (v: number) => Math.round(v * 100) / 100;
const fx = (v: number, d = 1) => num(+v.toFixed(d));

// ---------------------------------------------------------------- lesson data

// L1: inflow falling by 1 L/min each minute from 12, outflow steady 6.
const L1_IN = (t: number) => Math.max(0, 12 - t), L1_OUT = () => 6;
const L1_PEAK = 6; // inflow = outflow
// L1: overflow.
const OV = { cap: 120, start: 30, inflow: 15, outflow: 6 };
const OV_T = (OV.cap - OV.start) / (OV.inflow - OV.outflow);
const BANK_M = 2000 / (450 - 300);

// L2
const RUMOUR10 = 2 ** 9;
const DBL7 = Math.log(2) / Math.log(1.07);
const GROW30 = { linear: 1000 * 30, penny: 0.01 * 2 ** 30, ten: 100 * 1.1 ** 30, lump: 20000 };
const COMP3 = 1000 * 1.05 ** 3;

// L3: coffee at 90° in a 20° room, losing 10% of the gap each minute.
const coffee = (t: number) => 20 + 70 * 0.9 ** t;
const HALVE10 = Math.log(2) / -Math.log(0.9);
const GOAL_READ = [10, 16, 19]; // gap halves each minute: goal 22

// L4
const HAND = thermo(0.5, 1, 5, 16); // 16, 18, 20, 21, 21, 20.5
const OSC = thermo(0.5, 2, 40, 10);
const peaksOf = (xs: number[]) => xs.map((v, k) => (k > 0 && k < xs.length - 1 && v > xs[k - 1] && v >= xs[k + 1] ? k : -1)).filter((k) => k >= 0);
const OSC_PEAKS = peaksOf(OSC);
const OSC_PERIOD = (OSC_PEAKS[OSC_PEAKS.length - 1] - OSC_PEAKS[0]) / (OSC_PEAKS.length - 1);
const PK = thermo(0.35, 2, 30, 8);
const PK_T = PK.indexOf(Math.max(...PK)), PK_V = PK[PK_T];

// L5
const logi = (K: number, r: number, tm: number) => (t: number) => K / (1 + Math.exp(-r * (t - tm)));
const S1 = logi(10, 0.5, 10);
const S2 = logi(850, 0.45, 8);
const S2_PTS: [number, number][] = Array.from({ length: 11 }, (_, t) => [t, Math.round(S2(t))]);
const LSTEP = 200 + 0.5 * 200 * (1 - 200 / 1000);

// L7: fish: births 20% a year, catch 150.
const fish = (b: number, c: number) => (x: number) => Math.max(0, x + b * x - c);
const FISH = run(1000, 6, fish(0.2, 150));
const EST7 = run(1000, 10, fish(0.15, 120))[10];
const EST7_ANS = Math.round(EST7 / 50) * 50;
const SIR = { S: 990, I: 10, beta: 0.3, gamma: 0.1, N: 1000 };
const SIR_I = SIR.I + (SIR.beta * SIR.I * SIR.S) / SIR.N - SIR.gamma * SIR.I;

// L8
const WEEK8 = 50 * 0.95 ** 7;
const YEAR1 = 1.01 ** 365;

// ---------------------------------------------------------------- loop diagrams

const N = (id: string, label: string, x: number, y: number): LNode => ({ id, label, x, y });
const Lk = (from: string, to: string, sign: '+' | '−', more: Partial<LLink> = {}): LLink => ({ from, to, sign, ...more });

const rumourLoop = loop(
  [N('k', 'People who\nknow', 70, 85), N('t', 'New people\ntold per day', 270, 85)],
  [Lk('k', 't', '+', { bend: 0.35 }), Lk('t', 'k', '+', { bend: 0.35 })],
  { marks: [{ x: 170, y: 85, text: 'R' }], size: [340, 170] });

const signPairs = () => loopSvg(
  [N('p', 'Practice', 60, 30), N('s', 'Skill', 270, 30), N('pr', 'Price', 60, 95), N('b', 'Sales', 270, 95)],
  [Lk('p', 's', '+', { bend: 0 }), Lk('pr', 'b', '−', { bend: 0 })], { size: [340, 125] });

const stressLoop = loop(
  [N('st', 'Stress', 80, 85), N('sl', 'Sleep', 260, 85)],
  [Lk('st', 'sl', '−', { bend: 0.35 }), Lk('sl', 'st', '−', { bend: 0.35 })], { size: [340, 170] });

const coffeeLoop = loop(
  [N('T', 'Coffee\ntemperature', 90, 45), N('g', 'Gap above\nroom temp', 260, 110), N('c', 'Cooling\nper minute', 90, 180)],
  [Lk('T', 'g', '+', { bend: 0.2 }), Lk('g', 'c', '+', { bend: 0.2 }), Lk('c', 'T', '−', { bend: 0.25 })],
  { marks: [{ x: 150, y: 112, text: 'B' }] });

const showerLoop = loop(
  [N('g', 'Gap: wanted\nminus felt', 80, 45), N('tap', 'Turn tap\nhotter', 260, 45), N('f', 'Temperature\nyou feel', 170, 185)],
  [Lk('g', 'tap', '+', { bend: 0.15 }), Lk('tap', 'f', '+', { bend: 0.2, delay: true }), Lk('f', 'g', '−', { bend: 0.2 })],
  { marks: [{ x: 170, y: 100, text: 'B' }] });

const limitsPic = () => h('div', null,
  loopSvg(
    [N('p', 'Population', 170, 35), N('b', 'Births', 60, 175), N('f', 'Food per\nindividual', 270, 175)],
    [Lk('b', 'p', '+', { bend: 0.22 }), Lk('p', 'b', '+', { bend: 0.22 }), Lk('p', 'f', '−', { bend: 0.15 }), Lk('f', 'b', '+', { bend: 0.12 })],
    { marks: [{ x: 95, y: 100, text: 'R' }, { x: 190, y: 125, text: 'B' }], size: [340, 215] }),
  plotBox({ x: [0, 24], y: [0, 12], size: [360, 190], xlabel: 'time', ylabel: 'population', layers: [
    { type: 'hline', y: 10, color: 'var(--c3)', label: 'carrying capacity' },
    { type: 'fn', f: S1, color: 'var(--c1)' },
    { type: 'fn', f: (t) => (10 / (1 + Math.exp(5))) * Math.exp(0.5 * t), to: 11, dash: true, color: 'var(--c4)' },
    { type: 'text', x: 8.6, y: 7.5, text: 'pure exponential', color: 'var(--c4)', anchor: 'end' },
  ] }));

const fixesLoop = loop(
  [N('p', 'Problem', 60, 115), N('f', 'Quick fix', 270, 35), N('s', 'Side effect', 270, 195)],
  [Lk('p', 'f', '+', { bend: -0.3, at: 0.5 }), Lk('f', 'p', '−', { bend: -0.3, at: 0.5 }), Lk('f', 's', '+', { bend: -0.15, at: 0.5 }), Lk('s', 'p', '+', { bend: -0.15, delay: true, at: 0.75 })],
  { marks: [{ x: 162, y: 76, text: 'B' }, { x: 215, y: 140, text: 'R' }], size: [340, 240] });

const burdenLoop = loop(
  [N('y', 'Symptom', 50, 125), N('q', 'Quick fix', 190, 30), N('r', 'Real fix', 190, 220), N('s', 'Side effect', 288, 125)],
  [Lk('y', 'q', '+', { bend: -0.3, at: 0.5 }), Lk('q', 'y', '−', { bend: -0.3, at: 0.5 }), Lk('y', 'r', '+', { bend: 0.3, at: 0.5 }), Lk('r', 'y', '−', { bend: 0.3, delay: true, at: 0.5 }),
    Lk('q', 's', '+', { bend: 0.15, at: 0.5 }), Lk('s', 'r', '−', { bend: 0.15, at: 0.5 })],
  { marks: [{ x: 120, y: 78, text: 'B' }, { x: 120, y: 172, text: 'B' }, { x: 215, y: 125, text: 'R' }], size: [340, 250] });

const roadLoop = loop(
  [N('w', 'Widen\nroads', 70, 45), N('s', 'Trip speed', 265, 45), N('d', 'Amount of\ndriving', 265, 185), N('c', 'Congestion', 70, 185)],
  [Lk('w', 's', '+', { bend: 0 }), Lk('s', 'd', '+', { bend: 0 }), Lk('d', 'c', '+', { bend: 0 }), Lk('c', 'w', '+', { bend: 0 }), Lk('c', 's', '−', { bend: 0.12 })],
  { marks: [{ x: 120, y: 115, text: 'R' }, { x: 215, y: 145, text: 'B' }], size: [340, 230] });

const phoneLoop = loop(
  [N('b', 'Boredom\nfeels awful', 80, 45), N('c', 'Checking\nthe phone', 260, 45), N('t', 'Tolerance\nfor boredom', 170, 185)],
  [Lk('b', 'c', '+', { bend: 0.15 }), Lk('c', 't', '−', { bend: 0.2, delay: true }), Lk('t', 'b', '−', { bend: 0.2 })],
  { marks: [{ x: 170, y: 100, text: 'R' }] });

const OT_NODES = [N('b', 'Backlog', 70, 40), N('o', 'Overtime', 270, 40), N('w', 'Work done', 70, 190), N('f', 'Fatigue', 270, 190)];
const OT_LINKS = [Lk('b', 'o', '+', { bend: 0 }), Lk('o', 'w', '+', { bend: 0 }), Lk('w', 'b', '−', { bend: 0 }), Lk('o', 'f', '+', { bend: 0 }), Lk('f', 'w', '−', { bend: 0 })];

const shopLoop = loop(
  [N('c', 'Customers', 80, 40), N('r', 'Revenue', 260, 40), N('s', 'Staff', 260, 180), N('q', 'Service\nquality', 80, 180)],
  [Lk('c', 'r', '+', { bend: 0 }), Lk('r', 's', '+', { bend: 0 }), Lk('s', 'q', '+', { bend: 0 }), Lk('q', 'c', '+', { bend: 0 })],
  { marks: [{ x: 170, y: 110, text: 'R' }] });

const netLoop = () => loopSvg(
  [N('u', 'Users', 70, 85), N('v', 'Reasons\nto join', 270, 85)],
  [{ from: 'u', to: 'v', sign: '?', bend: 0.35 }, { from: 'v', to: 'u', sign: '?', bend: 0.35 }], { size: [340, 170] });

const salesLoop = loop(
  [N('s', 'Sales', 170, 170), N('m', 'Marketing\nbudget', 62, 40), N('w', 'Customers\nleft to win', 278, 40)],
  [Lk('s', 'm', '+', { bend: 0.3 }), Lk('m', 's', '+', { bend: 0.3 }), Lk('s', 'w', '−', { bend: -0.3 }), Lk('w', 's', '+', { bend: -0.3 })],
  { marks: [{ x: 112, y: 108, text: 'R' }, { x: 228, y: 108, text: 'B' }], size: [340, 200] });

const bugLoop = loop(
  [N('b', 'Bugs', 70, 105), N('p', 'Quick\npatches', 265, 40), N('m', 'Messy code', 260, 180)],
  [Lk('b', 'p', '+', { bend: -0.2 }), Lk('p', 'b', '−', { bend: -0.2 }), Lk('p', 'm', '+', { bend: 0.15 }), Lk('m', 'b', '+', { bend: 0.15, delay: true })]);

const meterLoop = loop(
  [N('u', 'Electricity\nuse', 80, 45), N('s', 'Meter you\ncan see', 260, 45), N('e', 'Effort\nto save', 170, 185)],
  [Lk('u', 's', '+', { bend: 0.15 }), Lk('s', 'e', '+', { bend: 0.2 }), Lk('e', 'u', '−', { bend: 0.2 })],
  { marks: [{ x: 170, y: 100, text: 'B' }] });

const screenLoop = loop(
  [N('s', 'Screen time\nat night', 80, 45), N('z', 'Sleep', 260, 45), N('t', 'Tiredness', 170, 185)],
  [Lk('s', 'z', '−', { bend: 0.15 }), Lk('z', 't', '−', { bend: 0.2 }), Lk('t', 's', '+', { bend: 0.2 })],
  { marks: [{ x: 170, y: 100, text: 'R' }] });

const fishFlow = (value: string, c = 'catch\n150 a year') => stockFlow({ stock: 'Fish', inflow: 'births\n20% of fish', outflow: c, value });

// ---------------------------------------------------------------- practice generators

// L1
const genTubLevel: Generator = (rng) => {
  for (;;) {
    const start = randInt(rng, 2, 12) * 10, a = randInt(rng, 2, 15), b = randInt(rng, 2, 15), t = randInt(rng, 3, 12);
    const end = start + (a - b) * t;
    if (a === b || end < 0 || end > 300) continue;
    return {
      kind: 'number', unit: 'L',
      body: `A big tank holds ${start} L. Water flows in at ${a} L/min and drains out at ${b} L/min. How much water is in it after **${t} minutes**?`,
      widget: tub({ level: start, cap: 300, inflow: a, outflow: b, maxFlow: 15 }),
      answer: end, tol: 0.01,
      hint: 'Net flow = inflow − outflow, every minute.',
      explain: `Net flow is ${a} − ${b} = ${a - b} L/min. Over ${t} minutes that is ${(a - b) * t} L, so ${start} ${a - b >= 0 ? '+' : '−'} ${Math.abs((a - b) * t)} = ${end} L.`,
    };
  }
};

const genOverflow: Generator = (rng) => {
  for (;;) {
    const cap = randInt(rng, 8, 20) * 10, start = randInt(rng, 1, cap / 10 - 2) * 10;
    const b = randInt(rng, 1, 10), net = pick(rng, [2, 4, 5, 8, 10, 20]), a = b + net;
    const t = (cap - start) / net;
    if (t < 2 || t > 18 || Math.abs(t * 2 - Math.round(t * 2)) > 1e-9) continue;
    return {
      kind: 'point',
      body: `A ${cap} L tub holds ${start} L. The tap adds ${a} L/min and the drain removes ${b} L/min. Tap the time line where the tub starts to **overflow**.`,
      widget: tub({ level: start, cap, inflow: a, outflow: b }),
      plot: { x: [0, 20], xlabel: 'minutes from now', ticks: [2] }, answer: { x: t }, tol: 0.5, snap: 0.5,
      hint: 'How much room is left, and how fast does it fill?',
      explain: `Room left: ${cap} − ${start} = ${cap - start} L. Net filling: ${a} − ${b} = ${net} L/min. ${cap - start} ÷ ${net} = ${num(t)} minutes.`,
    };
  }
};

const STOCK_FLOW: { t: string; stock: boolean; why: string }[] = [
  { t: 'the money in your savings account', stock: true, why: 'It’s an amount you could count at one moment, in dollars, not dollars per month.' },
  { t: 'your monthly rent', stock: false, why: 'It’s money per month, a rate that drains your balance.' },
  { t: 'the number of trees in a forest', stock: true, why: 'You could count them at one moment. Planting and felling are the flows.' },
  { t: 'trees felled per year', stock: false, why: 'It’s per year: a rate that drains the stock of trees.' },
  { t: 'water in a reservoir', stock: true, why: 'It’s an amount (cubic metres) at a moment. Rain and river flow are the inflows.' },
  { t: 'the speed a river flows into a lake', stock: false, why: 'It’s cubic metres per second: a rate of change of the lake.' },
  { t: 'the unread emails in your inbox', stock: true, why: 'You could count them right now; arrivals and replies are the flows.' },
  { t: 'new subscribers per week', stock: false, why: 'It’s per week: an inflow to the stock of subscribers.' },
  { t: 'a country’s national debt', stock: true, why: 'It’s the total owed at a moment. The yearly deficit is the flow that adds to it.' },
  { t: 'a government’s yearly deficit', stock: false, why: 'It’s per year: the flow that adds to the stock of debt.' },
];
const genStockOrFlow: Generator = (rng) => {
  const it = pick(rng, STOCK_FLOW);
  return {
    kind: 'choice',
    body: `Is **${it.t}** a stock or a flow?`,
    options: [
      { text: 'A stock: an amount at a moment', correct: it.stock, why: it.stock ? undefined : `Not a stock. ${it.why}` },
      { text: 'A flow: a rate per unit of time', correct: !it.stock, why: it.stock ? `Not a flow. ${it.why}` : undefined },
    ],
    hint: 'Could you measure it with a snapshot, or does it need “per day / per year”?',
    explain: it.why,
  };
};

// L2
const genDoubling: Generator = (rng) => {
  const d = randInt(rng, 2, 7), a = randInt(rng, 1, 9), n = randInt(rng, 3, 8);
  const ans = a * 2 ** n;
  return {
    kind: 'number', unit: 'm²',
    body: `Algae on a pond doubles every ${d} days. Today it covers ${a} m². How much will it cover in **${d * n} days**, if nothing stops it?`,
    answer: ans, tol: 0.01,
    hint: `How many doublings fit in ${d * n} days?`,
    explain: `${d * n} days is ${n} doublings: ${a} × 2^${n} = ${a} × ${2 ** n} = ${ans} m².`,
  };
};

const genLoopType: Generator = (rng) => {
  const n = randInt(rng, 2, 5);
  const signs = Array.from({ length: n }, () => (rng() < 0.45 ? '−' : '+'));
  const minus = signs.filter((s) => s === '−').length;
  const R = minus % 2 === 0;
  const names = shuffle(rng, ['A', 'B', 'C', 'D', 'E']).slice(0, n);
  const chain = names.map((x, k) => `${x} →${signs[k]} ${names[(k + 1) % n]}`).join(', ');
  return {
    kind: 'choice',
    body: `A feedback loop has ${n} links: ${chain}. Is it reinforcing or balancing?`,
    options: [
      { text: 'Reinforcing', correct: R, why: R ? undefined : `There ${minus === 1 ? 'is 1 minus link' : `are ${minus} minus links`}, an odd number: a push goes round the loop and comes back reversed, so it balances.` },
      { text: 'Balancing', correct: !R, why: R ? `${minus === 0 ? 'There are no minus links' : `The ${minus} minus links come in pairs`}: each pair of reversals cancels, so a push comes back in the same direction and grows.` : undefined },
      { text: 'Can’t tell without numbers', why: 'The type depends only on the signs: count the minus links. Numbers decide how fast, not which way.' },
    ],
    hint: 'Count the minus links: even means reinforcing, odd means balancing.',
    explain: `${minus} minus link${minus === 1 ? '' : 's'} (${minus % 2 ? 'odd' : 'even'}), so the loop is ${R ? 'reinforcing' : 'balancing'}.`,
  };
};

const genCompound: Generator = (rng) => {
  const p = randInt(rng, 2, 9) * 500, r = randInt(rng, 2, 12), n = randInt(rng, 2, 6);
  const ans = p * (1 + r / 100) ** n;
  return {
    kind: 'number', unit: '$',
    body: `You put $${p.toLocaleString('en-US')} in an account paying ${r}% a year and reinvest the interest. How much is there after **${n} years**?`,
    answer: r2(ans), tol: 0.5,
    hint: `Each year multiplies the balance by ${num(1 + r / 100)}.`,
    explain: `$${p.toLocaleString('en-US')} × ${num(1 + r / 100)}^${n} ≈ $${r2(ans).toLocaleString('en-US')}. Simple interest would give only $${(p + (p * r * n) / 100).toLocaleString('en-US')}: the extra is interest earning interest.`,
  };
};

// L3
const genGapStep: Generator = (rng) => {
  const goal = randInt(rng, 15, 25), start = pick(rng, [goal - randInt(rng, 8, 15), goal + randInt(rng, 40, 70)]);
  const p = pick(rng, [10, 20, 25, 50]), n = randInt(rng, 1, 3);
  const ans = goal + (start - goal) * (1 - p / 100) ** n;
  return {
    kind: 'number', unit: '°C',
    body: `Something starts at ${start}° in a ${goal}° room. Each minute it closes ${p}% of the gap to room temperature. What is its temperature after **${n} minute${n > 1 ? 's' : ''}**?`,
    answer: r2(ans), tol: 0.06,
    hint: `The gap keeps ${100 - p}% of its size each minute.`,
    explain: `Gap: ${start} − ${goal} = ${start - goal}°. After ${n} minute${n > 1 ? 's' : ''} it is ${start - goal} × ${num(1 - p / 100)}^${n} = ${fx(ans - goal, 2)}°, so the temperature is ${goal} ${ans - goal >= 0 ? '+' : '−'} ${fx(Math.abs(ans - goal), 2)} = ${fx(ans, 2)}°.`,
  };
};

const genGoalInfer: Generator = (rng) => {
  const goal = randInt(rng, 12, 28), gap = pick(rng, [-16, -12, -8, 8, 12, 16]);
  const xs = [goal - gap, goal - gap / 2, goal - gap / 4];
  return {
    kind: 'point',
    body: `A thermostat-controlled room reads ${xs.join('°, ')}° on three minutes in a row. Each minute it closes the same share of the gap. Where is it heading? Tap the target on the line.`,
    plot: { x: [0, 40], ticks: [5] }, answer: { x: goal }, tol: 0.5, snap: 0.5,
    hint: 'Compare the first change with the second.',
    explain: `The changes are ${num(gap / 2)} then ${num(gap / 4)}: each step closes half the remaining gap. After ${xs[2]}° the gap left equals the last change, ${num(Math.abs(gap / 4))}°, so the target is ${goal}°.`,
  };
};

const genHalving: Generator = (rng) => {
  const p = pick(rng, [5, 10, 15, 20, 25, 30]);
  const n = Math.log(2) / -Math.log(1 - p / 100);
  return {
    kind: 'estimate',
    body: `A balancing loop closes **${p}%** of the remaining gap each step. About how many steps until the gap is half its starting size?`,
    min: 1, max: 30, step: 1, answer: Math.round(n), tol: 1,
    hint: `Multiply by ${num(1 - p / 100)} again and again until you get below 0.5.`,
    explain: `${num(1 - p / 100)}^k = 0.5 at k = ln 2 ÷ −ln ${num(1 - p / 100)} ≈ ${fx(n, 2)} steps. Rule of thumb: about 70 ÷ ${p} ≈ ${fx(70 / p)} for small shares.`,
  };
};

// L4
const genDelayedStep: Generator = (rng) => {
  const target = randInt(rng, 18, 24), start = target - 2 * randInt(rng, 2, 6);
  const T = thermo(0.5, 1, 4, start, target);
  return {
    kind: 'number', unit: '°C',
    body: `Target ${target}°. Each minute the heater adds **half the gap**, but its thermometer is one minute behind: the change into minute k+1 uses the reading from minute k−1. Minutes 0, 1, 2 read ${T[0]}°, ${num(T[1])}°, ${num(T[2])}°. What does minute 3 read?`,
    answer: T[3], tol: 0.01,
    hint: 'The change into minute 3 uses the reading from minute 1.',
    explain: `Gap seen = ${target} − ${num(T[1])} (minute 1) = ${num(target - T[1])}. Half of it: ${num((target - T[1]) / 2)}. So ${num(T[2])} + ${num((target - T[1]) / 2)} = ${num(T[3])}°: ${T[3] > target ? 'past the target, because the heater is acting on old news' : 'right on target'}.`,
  };
};

const classify = (g: number, d: number) => {
  const T = thermo(g, d, 220);
  const late = Math.max(...T.slice(180).map((v) => Math.abs(v - 20)));
  const mx = Math.max(...T.slice(0, 200));
  if (late > 5) return 'unstable';
  if (late > 0.01) return 'unclear';
  if (mx <= 20.01) return 'creep';
  if (mx >= 20.3) return 'over';
  return 'unclear';
};
const genOvershoot: Generator = (rng) => {
  for (;;) {
    const g = randInt(rng, 1, 18) / 10, d = randInt(rng, 0, 3);
    const c = classify(g, d);
    if (c === 'unclear') continue;
    return {
      kind: 'choice',
      body: `A room at 10° heads for 20°. Each minute the heater adds **${num(g)} × the gap**, using a reading ${d === 0 ? 'from right now (no delay)' : `${d} minute${d > 1 ? 's' : ''} old`}. What happens?`,
      options: [
        { text: 'It creeps up to 20° without overshooting', correct: c === 'creep', why: c === 'creep' ? undefined : 'Not here: the correction is too strong for the delay, so it is still heating when it reaches 20°.' },
        { text: 'It overshoots, then swings back and settles', correct: c === 'over', why: c === 'over' ? undefined : c === 'creep' ? 'The correction is gentle enough for this delay: each step closes only part of the gap the heater sees.' : 'The swings don’t die down here: each correction is so big and so late that it overshoots by more than the last.' },
        { text: 'It swings wider and wider', correct: c === 'unstable', why: c === 'unstable' ? undefined : 'A balancing loop only runs away when its corrections are both strong and late; these swings shrink.' },
      ],
      hint: 'Simulate a few steps: T(next) = T + gain × (20 − old reading).',
      explain: `Step by step with gain ${num(g)} and delay ${d}: ${thermo(g, d, 8).map((v) => fx(v)).join(', ')}, … ${c === 'creep' ? 'never passes 20°.' : c === 'over' ? 'passes 20°, then the swings shrink.' : 'the swings grow.'} Small gain and short delay: smooth. Big gain or long delay: overshoot, and with both, instability.`,
    };
  }
};

const genSupplyLine: Generator = (rng) => {
  const want = randInt(rng, 8, 20) * 10, shelf = randInt(rng, 1, want / 10 - 3) * 10, pipe = randInt(rng, 1, (want - shelf) / 5 - 1) * 5;
  const ans = want - shelf - pipe;
  return {
    kind: 'number', unit: 'units',
    body: `You want ${want} units in stock. The shelf holds ${shelf}, and ${pipe} more are already ordered but won’t arrive for weeks. Demand has stopped for now. How many should you order today?`,
    answer: ans, tol: 0.01,
    hint: 'Count what is already on its way.',
    explain: `Gap = ${want} − ${shelf} on the shelf − ${pipe} in the pipeline = ${ans}. Ordering ${want - shelf} (ignoring the pipeline) would leave you ${pipe} over: the classic overshoot of the beer game.`,
  };
};

// L5
const FRACS = ['half', 'a quarter', 'an eighth', 'a sixteenth', 'a thirty-second'];
const genLilyPad: Generator = (rng) => {
  const full = randInt(rng, 20, 60), k = randInt(rng, 1, 5);
  return {
    kind: 'number', unit: 'day',
    body: `Lilies on a pond double in area every day and cover the whole pond on day ${full}. On what day was the pond **${FRACS[k - 1]}** covered?`,
    answer: full - k, tol: 0.01,
    hint: 'Run time backwards: each day back halves the cover.',
    explain: `Halve ${k} time${k > 1 ? 's' : ''} going back from day ${full}: day ${full - k}. Only ${k} day${k > 1 ? 's' : ''} before the end, the pond still looked ${k >= 3 ? 'mostly empty' : 'half empty or more'}.`,
  };
};

const genLogisticStep: Generator = (rng) => {
  const K = randInt(rng, 5, 20) * 100, Pp = randInt(rng, 1, K / 100 - 1) * 100, r = pick(rng, [0.2, 0.3, 0.4, 0.5, 0.6]);
  const grow = r * Pp * (1 - Pp / K);
  return {
    kind: 'number',
    body: `A population follows next = P + ${num(r)} × P × (1 − P/${K}). It is ${Pp} now. What is it next step?`,
    answer: r2(Pp + grow), tol: 0.06,
    hint: 'Growth = rate × P × (share of room left).',
    explain: `Room left: 1 − ${Pp}/${K} = ${num(1 - Pp / K)}. Growth = ${num(r)} × ${Pp} × ${num(1 - Pp / K)} = ${fx(grow, 2)}. Next: ${fx(Pp + grow, 2)}.`,
  };
};

const genMaxGrowth: Generator = (rng) => {
  const K = randInt(rng, 4, 30) * 100, r = pick(rng, [0.2, 0.4, 0.5, 0.6, 0.8, 1]);
  return {
    kind: 'number',
    body: `A population grows by ${num(r)} × P × (1 − P/${K}) per year. What is the **most** it can grow in one year?`,
    answer: (r * K) / 4, tol: 0.01,
    hint: 'P × (1 − P/K) is largest at half the carrying capacity.',
    explain: `Growth peaks at P = ${K}/2 = ${K / 2}: ${num(r)} × ${K / 2} × 0.5 = ${num((r * K) / 4)} per year. Below that there are too few to breed; above it, too little room.`,
  };
};

// L6
const genInduced: Generator = (rng) => {
  const now = randInt(rng, 3, 8) * 1000, add = randInt(rng, 1, 4) * 1000, g = randInt(rng, 2, 8) * 50;
  return {
    kind: 'number', unit: 'years',
    body: `A road is jammed at ${now.toLocaleString('en-US')} cars an hour. It is widened by ${add.toLocaleString('en-US')} cars an hour of capacity. Faster trips attract ${g} more cars an hour each year. How many years until it is jammed again?`,
    answer: r2(add / g), tol: 0.06,
    hint: 'How long until the new demand uses up the new room?',
    explain: `The spare capacity is ${add.toLocaleString('en-US')}; demand grows ${g} a year: ${add.toLocaleString('en-US')} ÷ ${g} ≈ ${fx(add / g, 2)} years. The fix feeds a loop (faster roads → more driving) that eats it.`,
  };
};

const ARCH = [
  { s: 'A city pays a bounty for each rat tail. Soon people farm rats.', a: 0 },
  { s: 'Staff fix bugs with quick patches. The messier code causes more bugs months later.', a: 0 },
  { s: 'A manager handles every crisis personally, so the team never learns to handle them.', a: 1 },
  { s: 'A student relies on energy drinks to stay awake instead of sleeping more, and sleeps worse.', a: 1 },
  { s: 'A café’s queue grows with its popularity until waiting times put new customers off.', a: 2 },
  { s: 'A viral app gains users fast, then growth stalls as almost everyone has it.', a: 2 },
  { s: 'Two shops cut prices to beat each other until neither makes money.', a: 3 },
  { s: 'Two countries each build weapons because the other is building weapons.', a: 3 },
];
const ARCH_NAMES = ['Fixes that fail', 'Shifting the burden', 'Limits to growth', 'Escalation'];
const ARCH_WHY = [
  'Fixes that fail: the fix helps now but its side effect feeds the problem later.',
  'Shifting the burden: a quick fix relieves the symptom and weakens the ability to apply the real fix.',
  'Limits to growth: a growth loop runs into a balancing limit that slows it.',
  'Escalation: each side’s response is the other side’s threat, a reinforcing loop of rivalry.',
];
const genArchetype: Generator = (rng) => {
  const it = pick(rng, ARCH);
  return {
    kind: 'choice',
    body: `Which pattern is this? ${it.s}`,
    options: ARCH_NAMES.map((n, k) => ({ text: n, correct: k === it.a, why: k === it.a ? undefined : `Not quite. ${ARCH_WHY[k]} That isn’t the shape here.` })),
    hint: 'Is there a side effect, a weakened real fix, a limit, or two rivals?',
    explain: ARCH_WHY[it.a],
  };
};

const MEADOWS = [
  'Numbers: taxes, subsidies, standards',
  'Delays: how fast feedback arrives',
  'Information: who sees what, when',
  'Rules: incentives and constraints',
  'Goals: what the system is for',
  'Mindset: the beliefs behind it all',
];
const genLeverage: Generator = (rng) => {
  const keep = shuffle(rng, [0, 1, 2, 3, 4, 5]).slice(0, 4).sort((a, b) => a - b);
  const items = keep.map((k) => MEADOWS[k]);
  return {
    kind: 'order',
    body: `Rank these places to intervene from **weakest** (top) to **strongest**: ${shuffle(rng, items).map((t) => t.split(':')[0].toLowerCase()).join(', ')}.`,
    items,
    hint: 'Changing a number rarely changes behaviour; changing what the system is for changes everything.',
    explain: `Meadows’ order, weakest first: ${items.map((t) => t.split(':')[0]).join(' < ')}. The deeper the change (from parameters to goals and mindsets), the more it reshapes behaviour, and the harder it is.`,
  };
};

// L7
const genFishStep: Generator = (rng) => {
  const p0 = randInt(rng, 5, 30) * 100, b = pick(rng, [5, 10, 15, 20, 25]), c = randInt(rng, 2, 30) * 10, n = randInt(rng, 1, 3);
  const xs = run(p0, n, fish(b / 100, c));
  if (xs.some((x) => x <= 0)) return genFishStep(rng);
  return {
    kind: 'number', unit: 'fish',
    body: `A lake has ${p0.toLocaleString('en-US')} fish. Each year births add ${b}% of the fish, then ${c} are caught. How many fish after **${n} year${n > 1 ? 's' : ''}**?`,
    answer: r2(xs[n]), tol: 0.06,
    hint: 'One row per year: births from this year’s stock, minus the catch.',
    explain: `Year by year: ${xs.map((x) => fx(x, 2)).join(' → ')}. Each step: fish + ${b}% of fish − ${c}.`,
  };
};

const genTipping: Generator = (rng) => {
  const b = pick(rng, [10, 20, 50]), T = randInt(rng, 2, 30) * 50, c = (b / 100) * T;
  return {
    kind: 'point',
    body: `Fish births are ${b}% of the stock each year, and ${c} fish are caught every year. Below what stock does the population shrink every year? Tap it on the line.`,
    plot: { x: [0, 2000], ticks: [250], xlabel: 'fish' }, answer: { x: T }, tol: 25, snap: 50,
    hint: 'Births exactly match the catch at the tipping point.',
    explain: `Births = catch when ${b}% × stock = ${c}, so stock = ${c} ÷ ${num(b / 100)} = ${T}. Below ${T}, the catch beats births every year and the stock spirals down.`,
  };
};

const genSIR: Generator = (rng) => {
  const Nn = 1000, I = randInt(rng, 5, 40), S = Nn - I, beta = pick(rng, [0.2, 0.3, 0.4, 0.5]), gamma = pick(rng, [0.1, 0.2, 0.25]);
  const nI = I + (beta * I * S) / Nn - gamma * I;
  return {
    kind: 'number', unit: 'sick',
    body: `Town of ${Nn}: ${S} healthy, ${I} sick. Each day new cases = ${num(beta)} × sick × (healthy ÷ ${Nn}), and ${num(gamma)} of the sick recover. How many are sick tomorrow?`,
    answer: r2(nI), tol: 0.06,
    hint: 'Sick tomorrow = sick + new cases − recoveries.',
    explain: `New cases: ${num(beta)} × ${I} × ${S}/${Nn} = ${fx((beta * I * S) / Nn, 3)}. Recoveries: ${num(gamma)} × ${I} = ${num(gamma * I)}. Sick tomorrow: ${I} + ${fx((beta * I * S) / Nn, 3)} − ${num(gamma * I)} = ${fx(nI, 3)}.`,
  };
};

// L8
const genHabit: Generator = (rng) => {
  const p = pick(rng, [0.5, 1, 2]), n = pick(rng, [30, 60, 90, 180, 365]);
  const up = rng() < 0.6;
  const v = (1 + (up ? p : -p) / 100) ** n;
  return {
    kind: 'number',
    body: `If something gets ${p}% ${up ? 'better' : 'worse'} each day, compounding, how many times its starting level is it after ${n} days?`,
    answer: +v.toPrecision(3), tol: Math.max(0.005, v * 0.01),
    hint: `Multiply by ${num(1 + (up ? p : -p) / 100)} once per day.`,
    explain: `${num(1 + (up ? p : -p) / 100)}^${n} ≈ ${num(+v.toPrecision(3))}. Real habits don’t compound forever (limits arrive), but the loop explains why small daily changes add up to so much.`,
  };
};

const genOvertime: Generator = (rng) => {
  const hrs = pick(rng, [50, 55, 60]), drop = pick(rng, [3, 4, 5, 6]), wk = randInt(rng, 4, 12);
  const out = hrs * (1 - drop / 100) ** (wk - 1);
  return {
    kind: 'number', unit: 'units',
    body: `Working 40 h a week you produce 40 units. Switch to ${hrs} h: week 1 gives ${hrs} units, but fatigue cuts your output per hour by ${drop}% every week after. What do you produce in **week ${wk}**?`,
    answer: r2(out), tol: 0.06,
    hint: `Week k gives ${hrs} × ${num(1 - drop / 100)}^(k−1).`,
    explain: `${hrs} × ${num(1 - drop / 100)}^${wk - 1} ≈ ${fx(out, 2)} units, ${out < 40 ? 'less than the 40 you made working 40 hours: the second-order effect has beaten the first' : 'still above 40, for now: the gap closes every week'}.`,
  };
};

const STORIES = [
  { s: 'The more you save, the more interest you earn, so the more you save.', R: true },
  { s: 'When you feel full you stop eating; when you’re hungry you eat.', R: false },
  { s: 'Debt brings interest, interest adds to the debt.', R: true },
  { s: 'As your inbox grows you spend more time clearing it, which shrinks it.', R: false },
  { s: 'Skipping the gym makes you less fit, which makes the gym feel harder, so you skip more.', R: true },
  { s: 'Prices rise when a product is scarce, which draws in more sellers, which ends the scarcity.', R: false },
  { s: 'A popular restaurant gets reviews, the reviews bring more diners, who write more reviews.', R: true },
  { s: 'When a team is short-staffed, it hires until the workload is manageable again.', R: false },
];
const genStory: Generator = (rng) => {
  const it = pick(rng, STORIES);
  return {
    kind: 'choice',
    body: `What kind of loop is this? “${it.s}”`,
    options: [
      { text: 'Reinforcing: change feeds more of the same change', correct: it.R, why: it.R ? undefined : 'Here the change triggers a response that pushes back toward a level: that’s balancing.' },
      { text: 'Balancing: change triggers a push back toward a goal', correct: !it.R, why: it.R ? 'Nothing pushes back here: each turn round the loop amplifies the change.' : undefined },
    ],
    hint: 'Follow one increase round the loop: does it come back bigger or get cancelled?',
    explain: it.R ? 'Each turn round the loop amplifies the change: reinforcing (it can run up or down).' : 'The change triggers a correction toward a target: balancing.',
  };
};

// ---------------------------------------------------------------- course

export const systems: Course = {
  id: 'systems',
  title: 'Systems Thinking',
  blurb: 'Stocks, flows and feedback loops: why things grow, stall, overshoot and bite back.',
  color: '#3fa34d',
  icon: '🔁',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'stocks',
      title: 'Stocks and flows',
      goal: 'Track how a stock changes from its inflow and outflow.',
      steps: [
        {
          kind: 'choice',
          body: 'A bathtub holds 50 L. The tap pours in 10 L a minute, while the open drain lets out 6 L a minute. What is the water level doing?',
          widget: tub({ level: 50, cap: 120, inflow: 10, outflow: 6 }),
          options: [
            { text: 'Rising', correct: true },
            { text: 'Falling', why: 'An open drain doesn’t mean falling. More comes in (10) than goes out (6).' },
            { text: 'Staying the same', why: 'Water flowing both ways doesn’t mean balance: the flows would have to be equal.' },
          ],
          explain: 'In 10, out 6: the tub gains 4 L every minute. Only the difference between the flows matters.',
        },
        {
          kind: 'number', unit: 'L',
          body: 'Same tub: 50 L now, in 10 L/min, out 6 L/min. How much water is in it after **5 minutes**?',
          widget: tub({ level: 50, cap: 120, inflow: 10, outflow: 6 }),
          answer: 70, tol: 0.01,
          hint: 'Net gain per minute, times 5.',
          explain: 'Net 10 − 6 = 4 L/min. Over 5 minutes: 20 L. 50 + 20 = 70 L.',
        },
        {
          kind: 'read',
          title: 'Stocks and flows',
          body: 'The water in the tub is a **stock**: an amount you could measure in a snapshot. The tap and the drain are **flows**: rates, *per minute*.\n\n**change in stock = inflow − outflow** (per unit of time)\n\nThe same picture fits money in an account, people in a country, CO₂ in the air, even your skill at something. A stock is the memory of all the flows that came before.',
          widget: stockFlow({ stock: 'Water\nin the tub', inflow: 'tap\n(L/min)', outflow: 'drain\n(L/min)', value: '50 L' }),
        },
        {
          kind: 'sort',
          body: 'Stock or flow? (A stock is an amount at a moment; a flow is per unit of time.)',
          bins: ['Stock', 'Flow'],
          items: [
            { text: 'Bank balance', bin: 0 },
            { text: 'Monthly salary', bin: 1 },
            { text: 'Population of a city', bin: 0 },
            { text: 'Births per year', bin: 1 },
            { text: 'CO₂ in the atmosphere', bin: 0 },
            { text: 'Yearly emissions', bin: 1 },
            { text: 'How well you speak French', bin: 0 },
            { text: 'Hours of practice a week', bin: 1 },
          ],
          hint: 'Ask: does it need “per month / per year” to make sense?',
          explain: 'Stocks: balance, population, CO₂, your French. Flows feed or drain them: salary, births, emissions, practice hours.',
        },
        {
          kind: 'choice',
          body: 'Now the tap starts at 12 L/min and is turned down by 1 L/min every minute, while the drain lets out a steady 6 L/min. When is the water **highest**?',
          widget: P({ x: [0, 12], y: [0, 14], xlabel: 'minutes', ylabel: 'L/min', layers: [
            { type: 'fn', f: L1_IN, color: 'var(--c1)', label: 'inflow' },
            { type: 'fn', f: L1_OUT, color: 'var(--c2)', label: 'outflow' },
          ] }),
          options: [
            { text: `At minute ${L1_PEAK}, when inflow has fallen to equal outflow`, correct: true },
            { text: 'At minute 0, when the inflow is biggest', why: 'The biggest inflow means the fastest rise, not the highest level. The water is still climbing after that.' },
            { text: 'At minute 12, at the end', why: `After minute ${L1_PEAK} the outflow beats the inflow, so the level falls.` },
            { text: 'Never: the inflow falls the whole time, so the water does too', why: 'A falling inflow is still an inflow. While it beats the outflow, the tub keeps filling.' },
          ],
          hint: 'The stock rises whenever inflow > outflow, however fast the inflow is shrinking.',
          explain: `The level rises while inflow > outflow and falls once outflow > inflow. It peaks at the crossing: minute ${L1_PEAK}.`,
        },
        {
          kind: 'read',
          title: 'Watch it happen',
          body: 'Press play. The inflow falls the whole time, yet the water keeps rising until the two flow lines cross. **A stock peaks when its flows are equal**, not when the inflow peaks. Reading this right is half of systems thinking.',
          widget: tubStepper({ cap: 60, start: 30, inflow: L1_IN, outflow: L1_OUT, minutes: 12, flowMax: 14 }),
        },
        {
          kind: 'point',
          body: `A ${OV.cap} L tub holds ${OV.start} L. The tap adds ${OV.inflow} L/min and the drain removes ${OV.outflow} L/min. Tap the time line where it starts to **overflow**.`,
          widget: tub({ level: OV.start, cap: OV.cap, inflow: OV.inflow, outflow: OV.outflow }),
          plot: { x: [0, 20], xlabel: 'minutes from now', ticks: [2] }, answer: { x: OV_T }, tol: 0.5, snap: 0.5,
          hint: 'How much room is left, and how fast is it filling?',
          explain: `Room left: ${OV.cap} − ${OV.start} = ${OV.cap - OV.start} L. Net filling: ${OV.inflow} − ${OV.outflow} = ${OV.inflow - OV.outflow} L/min. ${OV.cap - OV.start} ÷ ${OV.inflow - OV.outflow} = ${OV_T} minutes.`,
        },
        {
          kind: 'match',
          body: 'Each graph shows a stock over time. Match it to its flows.',
          widget: graphGrid([
            { label: 'A', f: (t) => 2 + 0.6 * t },
            { label: 'B', f: () => 5 },
            { label: 'C', f: (t) => 9 - 0.6 * t },
            { label: 'D', f: (t) => 1 + 0.08 * t * t },
          ], { y: [0, 10], ylabel: 'stock' }),
          heads: ['Graph', 'Flows'],
          pairs: [
            ['A', 'Steady inflow bigger than a steady outflow'],
            ['B', 'Inflow exactly equal to outflow'],
            ['C', 'Steady outflow bigger than a steady inflow'],
            ['D', 'Inflow growing steadily, no outflow'],
          ],
          hint: 'The slope of the stock is the net flow.',
          explain: 'A stock’s slope is inflow − outflow. A constant positive net flow is a straight rise (A), zero is flat (B), negative is a straight fall (C), and a net flow that keeps growing makes a curve that gets steeper (D).',
        },
        {
          kind: 'fill',
          body: 'Write the bathtub rule for one minute.',
          template: 'water next minute = water now [[0]] inflow [[1]] outflow',
          blanks: [{ options: ['+', '−', '×'], answer: 0 }, { options: ['+', '−', '÷'], answer: 1 }],
          explain: 'Inflows add to the stock and outflows subtract: water next = water now + inflow − outflow (each times one minute).',
        },
        {
          kind: 'estimate',
          body: 'Your account holds $2,000. You pay in $300 a month and spend $450 a month. About how many months until it is empty?',
          min: 0, max: 30, step: 1, answer: Math.round(BANK_M), tol: 1, format: (v) => `${v} months`,
          hint: 'Find the net flow first.',
          explain: `Net flow: 300 − 450 = −$150 a month. $2,000 ÷ $150 ≈ ${fx(BANK_M)} months. It’s a bathtub with a bigger drain than tap.`,
        },
        {
          kind: 'choice',
          body: 'The world still emits more CO₂ each year than oceans and plants absorb, but emissions are now growing more slowly. What is happening to the **amount** of CO₂ in the air?',
          widget: stockFlow({ stock: 'CO₂ in\nthe air', inflow: 'emissions', outflow: 'absorbed by\nseas, plants' }),
          options: [
            { text: 'Still rising, as long as emissions exceed absorption', correct: true },
            { text: 'Falling, because emissions are growing more slowly', why: 'That confuses the flow with the stock. Slower growth of the inflow still adds more than is removed.' },
            { text: 'Steady, because emissions have stopped speeding up', why: 'A steady stock needs inflow = outflow, not a steady inflow.' },
          ],
          hint: 'Inflow vs outflow, not inflow this year vs last year.',
          explain: 'The stock rises whenever inflow > outflow. To stop CO₂ rising, emissions must fall to the absorption rate, not just grow more slowly. Many smart people get this wrong in studies of “bathtub thinking”.',
        },
      ],
      practice: [genTubLevel, genOverflow, genStockOrFlow],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'reinforcing',
      title: 'Reinforcing loops',
      goal: 'Spot loops that feed on themselves and read + / − links.',
      steps: [
        {
          kind: 'number',
          body: 'Day 1: one person knows a secret. Each day, everyone who knows it tells one person who doesn’t. How many people know it on **day 10**?',
          widget: () => columnChart([1, 2, 3, 4, 5].map((d) => ({ label: `day ${d}`, value: 2 ** (d - 1) })), { height: 150 }),
          answer: RUMOUR10, tol: 0.01,
          hint: 'Write out days 1, 2, 3, 4: 1, 2, 4, …',
          explain: `The number doubles every day: day n has 2^(n−1) people. Day 10: 2^9 = ${RUMOUR10}.`,
        },
        {
          kind: 'read',
          title: 'A reinforcing loop',
          body: 'More people knowing means more people telling, which means more people knowing. When a stock feeds its own inflow, you get a **reinforcing loop** (R): growth that speeds up as it goes.\n\nIn a loop diagram, each arrow says “this pushes that”.',
          widget: rumourLoop,
        },
        {
          kind: 'read',
          title: 'Plus and minus links',
          body: 'A **+** link means *same direction*: more practice, more skill (and less practice, less skill).\n\nA **−** link means *opposite direction*: a higher price, fewer sales.\n\nThe sign says which way the effect goes, not whether it’s good.',
          widget: signPairs,
        },
        {
          kind: 'choice',
          body: 'More stress means less sleep (−). Less sleep means more stress (− again: more sleep, less stress). What kind of loop is this?',
          widget: stressLoop,
          options: [
            { text: 'Reinforcing: a vicious circle', correct: true },
            { text: 'Balancing, because it has minus signs', why: 'Count them: two reversals cancel. Stress up → sleep down → stress up again.' },
            { text: 'Neither: the two effects cancel out', why: 'They don’t cancel, they compound: each turn around the loop pushes stress the same way.' },
          ],
          hint: 'Push stress up and follow it round the loop.',
          explain: 'Stress ↑ → sleep ↓ → stress ↑. Two minus signs make a plus, so the loop reinforces. Rule: an even number of − links (including zero) is reinforcing.',
        },
        {
          kind: 'sort',
          body: 'Is each link + (same direction) or − (opposite direction)?',
          bins: ['+ same direction', '− opposite direction'],
          items: [
            { text: 'Hours practised → skill', bin: 0 },
            { text: 'Price → number bought', bin: 1 },
            { text: 'Fear of a bank failing → withdrawals', bin: 0 },
            { text: 'Exercise → resting heart rate', bin: 1 },
            { text: 'Rabbits → rabbit births', bin: 0 },
            { text: 'Speed cameras → speeding', bin: 1 },
          ],
          hint: 'If the cause goes up, does the effect go up or down?',
          explain: 'Same direction (+): practice → skill, fear → withdrawals, rabbits → births. Opposite (−): price → purchases, exercise → resting heart rate, cameras → speeding.',
        },
        {
          kind: 'multi',
          body: 'Which of these are driven by a **reinforcing** loop? Pick all that apply.',
          options: [
            { text: 'Interest earning interest in a savings account', correct: true, why: 'A bigger balance earns more interest, which makes the balance bigger.' },
            { text: 'A video going viral as viewers share it', correct: true, why: 'More viewers → more shares → more viewers.' },
            { text: 'A bank run: withdrawals spark fear of more withdrawals', correct: true, why: 'Withdrawals → fear → more withdrawals: it feeds on itself.' },
            { text: 'A thermostat keeping a room at 21°', why: 'A thermostat pushes back toward a target. That’s a balancing loop (next lesson).' },
            { text: 'Eating when hungry, stopping when full', why: 'Eating reduces hunger: the loop seeks a level. Balancing.' },
          ],
          explain: 'Interest, virality and bank runs feed themselves (reinforcing). The thermostat and hunger push back toward a target (balancing).',
        },
        {
          kind: 'read',
          title: 'Compounding',
          body: 'Slide the growth rate. The straight line adds the same amount every year; the curve adds a share of what’s already there. They start together, then the reinforcing loop runs away. Doubling time is roughly **70 ÷ (growth % per year)**.',
          widget: plotExplorer({
            params: [{ id: 'r', label: 'growth', min: 1, max: 15, step: 1, value: 12, format: (v) => `${v}%/yr` }],
            spec: (v) => ({ x: [0, 30], y: [0, 10000], size: SZ, xlabel: 'years', ylabel: '$', layers: [
              { type: 'fn', f: (t) => 1000 * (1 + v.r / 100) ** t, color: 'var(--c4)', label: 'compound' },
              { type: 'fn', f: (t) => 1000 + 10 * v.r * t, color: 'var(--c1)', dash: true, label: 'simple' },
            ] }),
            readout: (v) => `after 30 years: compound $${Math.round(1000 * (1 + v.r / 100) ** 30).toLocaleString('en-US')}, simple $${(1000 + 300 * v.r).toLocaleString('en-US')}`,
          }),
        },
        {
          kind: 'estimate',
          body: 'An investment grows 7% a year, compounding. About how many years does it take to **double**?',
          min: 1, max: 40, step: 1, answer: Math.round(DBL7), tol: 1, format: (v) => `${v} years`,
          hint: 'Rule of 70.',
          explain: `70 ÷ 7 = 10 years (exactly: ln 2 ÷ ln 1.07 ≈ ${fx(DBL7, 2)}). Linear growth of 7% of the start each year would take 14.3 years.`,
        },
        {
          kind: 'order',
          body: 'Order these by how much they’re worth after 30 days, **smallest** first.',
          items: [
            '$100 growing 10% a day for 30 days',
            '$20,000 handed over once',
            '$1,000 a day for 30 days',
            'One cent doubling every day for 30 days',
          ],
          hint: 'Work each out: 100 × 1.1^30, 20,000, 30 × 1,000, 0.01 × 2^30.',
          explain: `$100 × 1.1^30 ≈ $${Math.round(GROW30.ten).toLocaleString('en-US')} < $20,000 < $${GROW30.linear.toLocaleString('en-US')} < $0.01 × 2^30 ≈ $${Math.round(GROW30.penny).toLocaleString('en-US')}. Doubling beats everything, given time.`,
        },
        {
          kind: 'fill',
          body: 'Complete the network-effect loop of a messaging app.',
          widget: netLoop,
          template: 'More users → [[0]] reasons for each person to join → [[1]] new users. This is a [[2]] loop.',
          blanks: [
            { options: ['more', 'fewer'], answer: 0 },
            { options: ['more', 'fewer'], answer: 0 },
            { options: ['reinforcing', 'balancing'], answer: 0 },
          ],
          explain: 'Each user makes the app more useful to others, which brings more users: two + links, a reinforcing loop.',
        },
        {
          kind: 'choice',
          body: 'A shop loses customers, so it earns less, so it cuts staff, so service gets worse, so it loses more customers. What does this show?',
          widget: shopLoop,
          options: [
            { text: 'A reinforcing loop running downward: a vicious circle', correct: true },
            { text: 'A balancing loop, because things are getting smaller', why: 'Balancing means pushing back toward a goal. Here every step pushes further the same way.' },
            { text: 'Random bad luck with no structure', why: 'Each step causes the next: that is structure, and it predicts the spiral will continue unless the loop is broken.' },
          ],
          explain: 'Reinforcing loops amplify change in whichever direction it goes: growth spirals up, decline spirals down. Every link here is +.',
        },
        {
          kind: 'number', unit: '$',
          body: 'You put $1,000 in an account paying 5% a year and reinvest the interest. How much do you have after 3 years?',
          widget: stockFlow({ stock: 'Balance', inflow: 'interest\n5% of balance', value: '$1,000' }),
          answer: r2(COMP3), tol: 0.5,
          hint: '1,000 × 1.05 × 1.05 × 1.05.',
          explain: `1,000 × 1.05³ = $${r2(COMP3).toLocaleString('en-US')}. Simple interest would give $1,150; the extra $7.63 is interest on interest.`,
        },
      ],
      practice: [genDoubling, genLoopType, genCompound],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'balancing',
      title: 'Balancing loops',
      goal: 'See how goal-seeking loops close a gap, fast at first, then slowly.',
      steps: [
        {
          kind: 'number', unit: '°C',
          body: 'A coffee at 90° sits in a 20° room. Each minute it loses **10% of the gap** between itself and the room. What is its temperature after 1 minute?',
          widget: stockFlow({ stock: 'Coffee\ntemperature', outflow: 'cooling\n10% of gap', value: '90°' }),
          answer: 83, tol: 0.01,
          hint: 'The gap is 70°.',
          explain: 'Gap: 90 − 20 = 70°. It loses 10% of that, 7°: 90 − 7 = 83°.',
        },
        {
          kind: 'read',
          title: 'A balancing loop',
          body: 'Hotter coffee means a bigger gap, a bigger gap means faster cooling, and faster cooling means cooler coffee. One **−** link in the loop turns it around: a **balancing loop** (B) pushes the stock toward a goal, here room temperature.',
          widget: coffeeLoop,
        },
        {
          kind: 'number', unit: '°C',
          body: 'Same coffee: 90° in a 20° room, losing 10% of the gap each minute. What is its temperature after **2 minutes**?',
          widget: () => dataTable(['minute', 'coffee', 'gap', 'loses (10%)'], [[0, '90°', '70°', '7°'], [1, '83°', '63°', '?'], [2, '?', '?', '']], { highlight: [2] }),
          answer: r2(coffee(2)), tol: 0.06,
          hint: 'After minute 1 the gap is 63°.',
          explain: `The gap keeps 90% each minute: 70 × 0.9 × 0.9 = ${fx(70 * 0.81, 2)}°. So ${fx(coffee(2), 2)}°. The second minute it loses only 6.3°, less than the first.`,
        },
        {
          kind: 'read',
          title: 'Fast, then slow',
          body: 'Because the correction is proportional to the gap, every minute removes the same **share** of what’s left. The curve dives at first, then creeps, approaching the goal without ever quite reaching it. That’s the signature of a balancing loop.',
          widget: P({ x: [0, 30], y: [0, 100], xlabel: 'minutes', ylabel: 'coffee °C', layers: [
            { type: 'hline', y: 20, color: 'var(--c3)', label: 'room 20°' },
            { type: 'line', pts: pts(Array.from({ length: 31 }, (_, t) => coffee(t))), color: 'var(--c2)' },
            { type: 'dots', pts: pts(Array.from({ length: 31 }, (_, t) => coffee(t))).filter((_, k) => k % 3 === 0), color: 'var(--c2)', r: 3.5 },
          ] }),
        },
        {
          kind: 'match',
          body: 'Match each graph to the system that makes it.',
          widget: graphGrid([
            { label: 'A', f: (t) => 0.5 * 1.35 ** t },
            { label: 'B', f: (t) => 9 - 8 * 0.7 ** t },
            { label: 'C', f: (t) => 2 + 7 * 0.7 ** t },
            { label: 'D', f: (t) => 1 + 0.8 * t },
          ], { y: [0, 10] }),
          heads: ['Graph', 'System'],
          pairs: [
            ['A', 'Savings with the interest reinvested'],
            ['B', 'A cold room warming toward the thermostat setting'],
            ['C', 'Hot tea cooling to room temperature'],
            ['D', 'A tub filling from a steady tap, drain closed'],
          ],
          hint: 'Which curves bend toward a level, which bend away?',
          explain: 'A curves upward ever faster: reinforcing. B and C bend toward a level from below and above: balancing loops seeking a goal. D is a constant net flow: a straight line.',
        },
        {
          kind: 'sort',
          body: 'Reinforcing or balancing?',
          bins: ['Reinforcing', 'Balancing'],
          items: [
            { text: 'Cruise control holding 100 km/h', bin: 1 },
            { text: 'Interest earning interest', bin: 0 },
            { text: 'Shivering when you’re cold', bin: 1 },
            { text: 'Panic selling drives prices down, causing more panic', bin: 0 },
            { text: 'Hiring more staff as the backlog grows', bin: 1 },
            { text: 'Bigger audience → more ad money → better shows → bigger audience', bin: 0 },
          ],
          hint: 'Does the loop amplify a change, or push back toward a target?',
          explain: 'Balancing loops have a target (a speed, body temperature, a manageable backlog). Reinforcing loops amplify: compounding, panic, audience growth.',
        },
        {
          kind: 'choice',
          body: 'You fill a glass from a jug, pouring fast while it’s empty and slowing as it nears the top. What does the water level look like over time?',
          options: [
            { text: 'Rises fast, then more and more slowly, levelling off at the top', correct: true },
            { text: 'A straight line up to the top', why: 'That would need a steady pour. You pour in proportion to the room left, so the rise slows.' },
            { text: 'Slow at first, then faster and faster', why: 'That’s the reinforcing shape. Here the inflow shrinks as the gap shrinks.' },
          ],
          explain: 'Your pour rate depends on the gap to the top: a balancing loop. Big gap, fast fill; small gap, slow fill. The level approaches the rim like the coffee approached room temperature.',
        },
        {
          kind: 'fill',
          body: 'Every balancing loop has the same parts. Fill them in.',
          template: 'It has a [[0]], measures the [[1]] between that and the actual state, and acts to [[2]] it.',
          blanks: [
            { options: ['goal', 'delay', 'reward'], answer: 0 },
            { options: ['gap', 'sum', 'ratio'], answer: 0 },
            { options: ['shrink', 'grow', 'ignore'], answer: 0 },
          ],
          explain: 'Goal, gap, action: a thermostat (goal 21°), your hunger (goal: enough energy), a manager’s hiring (goal: manageable workload).',
        },
        {
          kind: 'estimate',
          body: 'The coffee loses 10% of its gap each minute. About how many minutes until the gap is **half** of what it was?',
          widget: P({ x: [0, 20], y: [0, 80], xlabel: 'minutes', ylabel: 'gap °C', ticks: [2, 10], layers: [
            { type: 'hline', y: 35, color: 'var(--c3)', label: 'half: 35°' },
            { type: 'fn', f: (t) => 70 * 0.9 ** t, color: 'var(--c2)' },
          ] }),
          min: 1, max: 20, step: 1, answer: Math.round(HALVE10), tol: 1, format: (v) => `${v} min`,
          hint: '0.9 × 0.9 × … until you reach 0.5.',
          explain: `0.9^k = 0.5 at k ≈ ${fx(HALVE10, 2)} minutes (rule of thumb 70 ÷ 10 = 7). And every 7 minutes after that it halves again: 70° → 35° → 17.5° above room temperature.`,
        },
        {
          kind: 'point',
          body: `A heated room reads ${GOAL_READ.join('°, ')}° on three minutes in a row. The heater closes the same share of the gap each minute. Where is it heading? Tap the target on the line.`,
          widget: P({ x: [0, 6], y: [8, 26], size: [360, 180], xlabel: 'minute', ylabel: '°C', layers: [
            { type: 'dots', pts: pts(GOAL_READ), color: 'var(--c2)', labels: GOAL_READ.map((v) => `${v}°`) },
          ] }),
          plot: { x: [10, 30], ticks: [2] }, answer: { x: 22 }, tol: 0.5, snap: 0.5,
          hint: 'Compare the first rise with the second.',
          explain: 'It rose 6, then 3: each minute closes half the remaining gap. After 19° the remaining gap equals the last rise, 3°, so the target is 22°.',
        },
        {
          kind: 'choice',
          body: 'A heater is set so that each minute it closes **150%** of the gap: from 10° toward a 20° target, it jumps to 25° in one minute. What happens next?',
          options: [
            { text: 'It overshoots back and forth, with swings that shrink', correct: true },
            { text: 'It settles smoothly at 20°', why: 'From 25° the gap is −5; 150% of that is −7.5, landing at 17.5°. It crosses the target each time.' },
            { text: 'It swings wider and wider', why: 'Each swing is half the last (gap × −0.5), so they shrink. Swings grow only past 200%.' },
          ],
          hint: 'Gap after each step = gap × (1 − 1.5).',
          explain: 'The gap is multiplied by 1 − 1.5 = −0.5 each step: 10, 25, 17.5, 21.25, 19.4… Over-correcting makes a balancing loop oscillate. Next lesson: delays do this too.',
        },
      ],
      practice: [genGapStep, genGoalInfer, genHalving],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'delays',
      title: 'Delays and oscillation',
      goal: 'Predict when a delayed balancing loop overshoots, and how to tame it.',
      steps: [
        {
          kind: 'choice',
          body: 'Hot water takes 3 seconds to travel from the tap to your head. The shower is cold, so you turn the tap hotter. Nothing changes, so you turn it hotter again. What happens next?',
          options: [
            { text: 'It gets too hot, you turn it down, it gets too cold…', correct: true },
            { text: 'It warms up to exactly the right temperature', why: 'You kept turning for 3 seconds while the first change was still on its way. All that heat arrives.' },
            { text: 'Nothing: delays only slow things down', why: 'A delay does more than slow you: it makes you act on old information, so you overcorrect.' },
          ],
          explain: 'Every turn you made during the delay arrives later. By the time you feel the heat, you’ve already asked for far too much. That’s overshoot, and it repeats the other way.',
        },
        {
          kind: 'read',
          title: 'The shower, simulated',
          body: 'Each second you move the tap by 35% of the gap between what you want (38°) and what you **feel**. What you feel is the tap setting from 3 seconds ago. Press play.',
          widget: showerStepper(0.35, 3, 30),
        },
        {
          kind: 'read',
          title: 'A delay in a balancing loop',
          body: 'Same balancing loop as before, with one change: the link from the tap to what you feel has a **delay** (the ‖ mark). The loop corrects on old news, keeps pushing after the goal is reached, and overshoots. Strong correction plus a long delay means **oscillation**.',
          widget: showerLoop,
        },
        {
          kind: 'number', unit: '°C',
          body: 'Target 20°. Each minute the heater adds **half the gap**, but its thermometer is one minute behind: the change into minute 3 uses the reading from minute 1. What does minute 3 read?',
          widget: () => h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, ['minute', 'room', 'reading the heater used'].map((c) => h('th', null, c)))),
            h('tbody', null,
              h('tr', null, h('td', null, '0'), h('td', null, `${HAND[0]}°`), h('td', null, '–')),
              h('tr', null, h('td', null, '1'), h('td', null, `${HAND[1]}°`), h('td', null, `${HAND[0]}° (start)`)),
              h('tr', null, h('td', null, '2'), h('td', null, `${HAND[2]}°`), h('td', null, `${HAND[0]}° (minute 0, still)`)),
              h('tr', { class: 'hl' }, h('td', null, '3'), h('td', null, '?'), h('td', null, `${HAND[1]}° (minute 1)`))))),
          answer: HAND[3], tol: 0.01,
          hint: `Gap the heater sees: 20 − ${HAND[1]}.`,
          explain: `The heater sees 20 − ${HAND[1]} = ${20 - HAND[1]}°, adds half: ${HAND[2]} + ${(20 - HAND[1]) / 2} = ${HAND[3]}°. The room hit 20° at minute 2, but the heater was still looking at an older, colder reading, so it overshoots.`,
        },
        {
          kind: 'task',
          title: 'Tune the thermostat',
          body: 'The room starts at 10° and the target is 20°. **Gain** is the share of the gap the heater closes each minute; **delay** is how old its reading is. Find a setting that settles at 20° by minute 40 **without overshooting**.',
          widget: thermoExplorer({ g: 0.6, d: 2, goal: true }),
          hint: 'Lower the gain, or shorten the delay, or both.',
          explain: 'Any gentle enough setting works. For example: delay 0 with gain 0.5 (or anything from 0.1 to 1); delay 1 with gain 0.1 to 0.25; delay 2 with gain 0.1 or 0.15; delay 3 with gain 0.1. The longer the delay, the gentler the correction must be. (At delay 4, gain 0.1 avoids overshoot but is too slow to arrive by minute 40.)',
        },
        {
          kind: 'multi',
          body: 'Which of these would stop the shower swinging between too hot and too cold? Pick all that apply.',
          options: [
            { text: 'Make smaller adjustments', correct: true, why: 'Lower gain: less heat is “in the pipe” when it arrives.' },
            { text: 'Wait a few seconds before adjusting again', correct: true, why: 'Waiting lets the old adjustments arrive before you judge them.' },
            { text: 'Shorten the pipe to the shower head', correct: true, why: 'A shorter delay means fresher information.' },
            { text: 'Turn the tap faster and harder to get there sooner', why: 'Higher gain with the same delay overshoots more, and can make the swings grow.' },
          ],
          explain: 'Oscillation comes from strong correction × long delay. Reduce either: adjust gently, be patient, or shorten the delay.',
        },
        {
          kind: 'estimate',
          body: 'This thermostat has gain 0.5 and a 2-minute delay. Estimate the **period**: minutes from one peak to the next.',
          widget: P({ x: [0, 40], y: [0, 35], xlabel: 'minutes', ylabel: 'room °C', ticks: [5, 5], layers: [
            { type: 'hline', y: 20, color: 'var(--c3)', label: 'target' },
            { type: 'line', pts: pts(OSC), color: 'var(--c2)' },
            { type: 'dots', pts: pts(OSC), color: 'var(--c2)', r: 2.5 },
          ] }),
          min: 1, max: 30, step: 1, answer: Math.round(OSC_PERIOD), tol: 2, format: (v) => `${v} min`,
          hint: 'Read off the minutes of two peaks.',
          explain: `Peaks at minutes ${OSC_PEAKS.join(', ')}: about ${fx(OSC_PERIOD)} minutes apart. Delayed loops often cycle with a period of a few times the delay.`,
        },
        {
          kind: 'point',
          body: 'A thermostat with gain 0.35 and a 2-minute delay heats a room from 8°. Tap the **highest point** the temperature reaches.',
          plot: { x: [0, 30], y: [0, 30], size: SZ, xlabel: 'minutes', ylabel: '°C', ticks: [5, 5], layers: [
            { type: 'hline', y: 20, color: 'var(--c3)', label: 'target 20°' },
            { type: 'line', pts: pts(PK), color: 'var(--c2)' },
          ] },
          answer: { x: PK_T, y: +PK_V.toFixed(2) }, tol: 1,
          hint: 'The peak comes after the curve crosses the target.',
          explain: `It peaks at minute ${PK_T} at ${fx(PK_V)}°, ${fx(PK_V - 20)}° above target: it crossed 20° and kept going because the heater was reading old, colder temperatures.`,
        },
        {
          kind: 'match',
          body: 'Each of these systems overshoots and cycles. Match it to the delay responsible.',
          heads: ['System', 'Delay'],
          pairs: [
            ['Pig prices: high prices → farmers breed more → prices crash', 'Months to raise a pig'],
            ['A shower that swings hot and cold', 'Water travelling down the pipe'],
            ['Central banks raising rates to cool inflation', 'A year or more for rates to bite'],
            ['Shops over-ordering stock, then cancelling', 'Weeks for deliveries to arrive'],
          ],
          explain: 'Each is a balancing loop acting on stale information: farmers, bathers, central bankers and shopkeepers keep correcting until the results of their first corrections arrive.',
        },
        {
          kind: 'choice',
          body: 'You run a shop. Deliveries take 4 weeks. Demand jumped, your shelf is low, and you’ve ordered extra for 3 weeks, but nothing has arrived yet. Before ordering again, what should you count?',
          options: [
            { text: 'The orders already on the way', correct: true },
            { text: 'Only what’s on the shelf: that’s what customers see', why: 'Ignoring the supply line is how people over-order: three weeks of extra orders are about to land.' },
            { text: 'Nothing: order as much as you can, to be safe', why: 'Bigger corrections with the same delay mean bigger overshoot: a glut, then cancellations.' },
          ],
          explain: 'What’s in the pipeline is part of your stock; it just hasn’t arrived. In the classic “beer game”, players who forget the supply line wildly overshoot. Order for the gap minus what’s on its way.',
        },
        {
          kind: 'read',
          title: 'Taming delays',
          body: '- Delays + strong corrections = overshoot and oscillation.\n- Correct gently, in proportion to the gap.\n- Wait for earlier actions to show up before judging them.\n- Count what’s already in the pipeline.\n- Better: shorten the delay itself (faster feedback).',
        },
      ],
      practice: [genDelayedStep, genOvershoot, genSupplyLine],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'limits',
      title: 'Limits to growth',
      goal: 'Recognise S-curves, carrying capacity and why growth stalls.',
      steps: [
        {
          kind: 'number', unit: 'day',
          body: 'Lilies on a pond double in area every day. On day 30 they cover the whole pond. On which day was it **half** covered?',
          widget: () => h('div', null, cellGrid(6, 8, () => ({ fill: 'color-mix(in srgb, var(--c3) 70%, transparent)', text: '❀' }), { size: 34 }), h('div', { class: 'readout' }, 'day 30: covered')),
          answer: 29, tol: 0.01,
          hint: 'Go back one doubling.',
          explain: 'Doubling from half gives full in one day: day 29. On day 25 it covered only 1/32 of the pond, about 3%: exponential growth looks harmless until the very end.',
        },
        {
          kind: 'read',
          title: 'Growth meets a limit',
          body: 'Real growth eventually hits a limit. A reinforcing loop (more animals, more births) runs into a balancing one (more animals, less food each, fewer births). Early on the R loop dominates and growth looks exponential; later the B loop takes over and the population levels off at the **carrying capacity**. The result is an **S-curve**.',
          widget: limitsPic,
        },
        {
          kind: 'read',
          title: 'Play with an S-curve',
          body: 'Each step the population grows by **r × P × (1 − P/K)**: the growth rate, times the population, times the share of room left. Change the rate and the capacity.',
          widget: plotExplorer({
            params: [
              { id: 'r', label: 'rate r', min: 0.1, max: 1, step: 0.1, value: 0.4, format: (v) => v.toFixed(1) },
              { id: 'K', label: 'capacity K', min: 200, max: 1000, step: 100, value: 800 },
            ],
            spec: (v) => ({ x: [0, 40], y: [0, 1100], size: SZ, xlabel: 'steps', ylabel: 'population', layers: [
              { type: 'hline', y: v.K, color: 'var(--c3)', label: 'K' },
              { type: 'line', pts: pts(run(10, 40, (x) => x + v.r * x * (1 - x / v.K))), color: 'var(--c1)' },
            ] }),
            readout: (v) => { const xs = run(10, 40, (x) => x + v.r * x * (1 - x / v.K)); const k = xs.findIndex((x) => x >= v.K / 2); return `reaches half of K at step ${k < 0 ? '> 40' : k} · step 40: ${Math.round(xs[40])}`; },
          }),
        },
        {
          kind: 'point',
          body: 'Here is an S-curve (population in hundreds). Tap the point where the population is **growing fastest**.',
          plot: { x: [0, 24], y: [0, 12], size: SZ, xlabel: 'time', ylabel: 'hundreds', layers: [
            { type: 'hline', y: 10, color: 'var(--c3)', label: 'capacity' },
            { type: 'fn', f: S1, color: 'var(--c1)' },
          ] },
          answer: { x: 10, y: 5 }, tol: 1, snap: 0.5,
          hint: 'Where is the curve steepest?',
          explain: 'The steepest point is at half the capacity: time 10, population 500. Below it there are too few to breed fast; above it the limit bites. After this point, growth slows every step.',
        },
        {
          kind: 'number',
          body: 'A population follows next = P + 0.5 × P × (1 − P/1000). It is 200 now. What is it next step?',
          widget: stockFlow({ stock: 'Population', inflow: 'growth\nrP(1 − P/K)', value: '200' }),
          answer: LSTEP, tol: 0.01,
          hint: 'Room left: 1 − 200/1000 = 0.8.',
          explain: `Growth = 0.5 × 200 × 0.8 = 80. Next: ${LSTEP}. Without the limit it would have grown by 100.`,
        },
        {
          kind: 'estimate',
          body: 'A new app’s users (in thousands) over its first 10 months. Growth is starting to slow. Estimate where it will **level off**.',
          widget: P({ x: [0, 16], y: [0, 1000], xlabel: 'month', ylabel: 'thousand users', layers: [
            { type: 'dots', pts: S2_PTS, color: 'var(--c1)' },
          ] }),
          min: 0, max: 2000, step: 50, answer: 850, tol: 100, format: (v) => `${v}k`,
          hint: 'The biggest monthly jump happens at half the capacity.',
          explain: `The biggest jumps come around month 8, at about ${Math.round(S2(8))} thousand users. That is half the carrying capacity, so it should level off near ${2 * Math.round(S2(8))}k (the model used 850k).`,
        },
        {
          kind: 'match',
          body: 'Match each kind of growth to the limit that will slow it.',
          heads: ['Growth', 'Limit'],
          pairs: [
            ['Yeast in bread dough', 'Sugar runs out, alcohol builds up'],
            ['A startup’s user numbers', 'Everyone who wants it already has it'],
            ['A city’s population', 'Housing, land and water'],
            ['Fish in a new lake', 'Food and space'],
          ],
          explain: 'Every reinforcing loop eventually meets a balancing one: resources run out, wastes build up, or the market saturates.',
        },
        {
          kind: 'choice',
          body: 'A company’s sales grew 40% a year for five years. Now growth is slowing even though marketing spend keeps rising. What does a systems thinker do first?',
          widget: salesLoop,
          options: [
            { text: 'Find the limit that’s slowing growth and work on that', correct: true },
            { text: 'Double the marketing budget', why: 'Pushing the growth loop harder makes the limit push back harder. Effort rises, results don’t.' },
            { text: 'Wait: growth always comes back', why: 'Not when a limit is binding. The S-curve flattens for a reason.' },
          ],
          explain: 'In “limits to growth”, the leverage is in the balancing loop: the saturated market, the overloaded support team, the capacity constraint. Relax that, and growth can resume.',
        },
        {
          kind: 'multi',
          body: 'Which are signs that growth is nearing a limit? Pick all that apply.',
          options: [
            { text: 'Growth per step is shrinking though effort is the same', correct: true, why: 'Same push, less result: a balancing loop is taking over.' },
            { text: 'Each new customer costs more to win', correct: true, why: 'The easy ones are taken: the market is saturating.' },
            { text: 'Queues, waiting lists or shortages appear', correct: true, why: 'A capacity limit is binding.' },
            { text: 'The total is still rising', why: 'A rising total fits both exponential growth and the top half of an S-curve. Look at the growth per step.' },
          ],
          explain: 'Watch the flows, not the stock: a shrinking growth rate, rising costs per unit and congestion all mean the balancing loop is getting stronger.',
        },
        {
          kind: 'order',
          body: 'Put the stages of an S-curve in order.',
          items: [
            'A slow start with few individuals',
            'Rapid, almost exponential growth',
            'Fastest growth, at half the capacity',
            'Growth slowing as the limit bites',
            'Levelling off at the carrying capacity',
          ],
          explain: 'Reinforcing loop dominant → the shift at half capacity → balancing loop dominant → equilibrium.',
        },
      ],
      practice: [genLilyPad, genLogisticStep, genMaxGrowth],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'leverage',
      title: 'Unintended consequences and leverage',
      goal: 'Spot fixes that backfire and find better places to intervene.',
      steps: [
        {
          kind: 'choice',
          body: 'Colonial Delhi had too many cobras, so the government paid a bounty for every dead cobra. What happened?',
          options: [
            { text: 'People bred cobras for the bounty, and when it ended they released them', correct: true },
            { text: 'The cobra population fell for good', why: 'That’s the first-order effect. The bounty also created a new incentive: produce more cobras.' },
            { text: 'Nothing: people ignored the bounty', why: 'They didn’t ignore it, they optimised for it.' },
          ],
          explain: 'The “cobra effect”: the fix rewarded the measure (dead cobras) rather than the goal (fewer cobras). When the scheme was scrapped, breeders freed their snakes, leaving more cobras than before.',
        },
        {
          kind: 'read',
          title: 'Fixes that fail',
          body: 'A quick fix eases the problem now (balancing loop B). But the fix has a side effect that, after a **delay**, makes the problem worse (reinforcing loop R). Because the side effect is late, nobody connects it to the fix, and the usual answer is… more fix.',
          widget: fixesLoop,
        },
        {
          kind: 'sort',
          body: 'Symptomatic fix or fundamental solution?',
          bins: ['Treats the symptom', 'Fixes the cause'],
          items: [
            { text: 'Painkillers for back pain from a bad chair', bin: 0 },
            { text: 'A better chair and stretching', bin: 1 },
            { text: 'More coffee to fight constant tiredness', bin: 0 },
            { text: 'Going to bed an hour earlier', bin: 1 },
            { text: 'A loan to cover overspending every month', bin: 0 },
            { text: 'A budget that matches spending to income', bin: 1 },
          ],
          explain: 'Symptomatic fixes work fast and feel good, which is exactly why they crowd out the slower, fundamental fix.',
        },
        {
          kind: 'read',
          title: 'Shifting the burden',
          body: 'A quick fix relieves the symptom (top loop), so the pressure to apply the real fix (bottom loop) fades. Worse, the quick fix often has a side effect that **weakens** the ability to apply the real fix, a reinforcing loop of dependence. Think painkillers, a hero manager who solves every crisis, or borrowing to pay bills.',
          widget: burdenLoop,
        },
        {
          kind: 'choice',
          body: 'A team fixes bugs with quick patches. The patches make the code messier, which causes more bugs months later, which get more quick patches. Which pattern is this?',
          widget: bugLoop,
          options: [
            { text: 'Fixes that fail', correct: true },
            { text: 'Limits to growth', why: 'There’s no growth engine running into a limit here; the fix itself feeds the problem.' },
            { text: 'A healthy balancing loop', why: 'The patches balance in the short term, but the delayed side effect (messy code) reinforces the problem.' },
          ],
          explain: 'Patch → fewer bugs now (B), but patch → messy code → more bugs later (R, delayed). The cure: pay down the mess, not just the symptoms.',
        },
        {
          kind: 'number', unit: 'years',
          body: 'A road is jammed at 5,000 cars an hour. It’s widened to 6,000. Faster trips attract 300 more cars an hour every year. How many years until it’s jammed again?',
          widget: roadLoop,
          answer: r2(1000 / 300), tol: 0.06,
          hint: 'Spare capacity ÷ growth in demand.',
          explain: '1,000 spare ÷ 300 a year ≈ 3.33 years. Faster roads invite more driving (the R loop) until congestion returns. Traffic engineers call it induced demand.',
        },
        {
          kind: 'read',
          title: 'Where to intervene',
          body: 'Donella Meadows ranked places to intervene in a system, from weak to strong. Weak: **numbers** (a tax rate, a subsidy). Stronger: **delays** and **feedback loops**. Stronger still: **information flows** (who sees what), the **rules**, the system’s **goal**, and the **mindset** it grew out of. Most effort goes into numbers; most leverage lies deeper.',
          widget: () => barChart([
            { label: 'Numbers', value: 1 }, { label: 'Delays', value: 2 }, { label: 'Feedback loops', value: 3 },
            { label: 'Information', value: 4 }, { label: 'Rules', value: 5 }, { label: 'Goals', value: 6 }, { label: 'Mindset', value: 7 },
          ].map((it, k) => ({ ...it, color: `color-mix(in srgb, var(--c6) ${30 + k * 10}%, transparent)` })), { title: 'Leverage (weak → strong)', format: () => '' }),
        },
        {
          kind: 'order',
          body: 'Rank these interventions from **weakest** (top) to **strongest**.',
          items: [
            'Changing a number, like a tax rate by 1%',
            'Shortening a delay in the feedback',
            'Adding an information flow: who sees what',
            'Changing the rules of the system',
            'Changing the goal of the system',
          ],
          hint: 'The deeper the change, the more behaviour it reshapes.',
          explain: 'Meadows’ order: parameters < delays < information flows < rules < goals. Parameters matter, but rarely change how a system behaves.',
        },
        {
          kind: 'choice',
          body: 'In a Dutch housing estate, some houses had their electricity meter in the front hall instead of the basement. Those houses used about a third less electricity. Which kind of intervention is that?',
          widget: meterLoop,
          options: [
            { text: 'A new information flow', correct: true },
            { text: 'A change in price', why: 'Prices were the same. Only what people could see changed.' },
            { text: 'A new rule', why: 'Nobody was required to do anything. People simply saw their use.' },
          ],
          explain: 'Putting feedback where people can see it closes a loop that was missing: cheap, and often powerful.',
        },
        {
          kind: 'multi',
          body: 'A school pays teachers bonuses based on test scores. Which side effects should you expect? Pick all that apply.',
          options: [
            { text: 'Teaching to the test', correct: true, why: 'The measured part gets the attention.' },
            { text: 'Less time on untested subjects like art', correct: true, why: 'Unmeasured goals lose out.' },
            { text: 'Some cheating on tests', correct: true, why: 'When the number is the target, gaming it pays.' },
            { text: 'Students learning everything better', why: 'Scores may rise without broader learning: the measure drifts from the goal.' },
          ],
          explain: 'Rewarding a measure makes people optimise the measure. That’s Goodhart’s law, the same trap as the cobra bounty.',
        },
        {
          kind: 'fill',
          body: 'Goodhart’s law, in Marilyn Strathern’s phrasing:',
          template: 'When a measure becomes a [[0]], it ceases to be a good [[1]].',
          blanks: [
            { options: ['target', 'habit', 'secret'], answer: 0 },
            { options: ['measure', 'reward', 'goal'], answer: 0 },
          ],
          explain: 'When a measure becomes a target, it ceases to be a good measure.',
        },
        {
          kind: 'match',
          body: 'Match each pattern to an example.',
          heads: ['Pattern', 'Example'],
          pairs: [
            ['Fixes that fail', 'A cobra bounty that breeds cobras'],
            ['Shifting the burden', 'Painkillers instead of fixing the cause'],
            ['Limits to growth', 'A startup saturating its market'],
            ['Escalation', 'Two shops in a price war'],
            ['Tragedy of the commons', 'Overfishing shared waters'],
          ],
          explain: 'Each pattern is a recurring loop structure. Learn to spot them and you can predict the behaviour before it happens.',
        },
      ],
      practice: [genInduced, genArchetype, genLeverage],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'simulate',
      title: 'Simulating a system',
      goal: 'Step a system forward by hand and predict where it goes.',
      steps: [
        {
          kind: 'number', unit: 'fish',
          body: 'A lake has 1,000 fish. Each year, births add 20% of the fish, then fishers catch 150. How many fish are there after one year?',
          widget: fishFlow('1,000'),
          answer: FISH[1], tol: 0.01,
          hint: 'Births: 20% of 1,000.',
          explain: `1,000 + 200 births − 150 caught = ${FISH[1]}.`,
        },
        {
          kind: 'read',
          title: 'A simulation is a table',
          body: 'To simulate, repeat one rule: work out each flow **from the current stock**, then update the stock. One row per step. Step through the years.',
          widget: tableStepper(['year', 'fish', 'births (20%)', 'caught', 'next'],
            FISH.slice(0, 6).map((x, k) => [k, fx(x, 2), fx(0.2 * x, 2), 150, fx(FISH[k + 1], 2)]), {
              caption: (i) => `year ${i}: ${fx(FISH[i], 2)} + ${fx(0.2 * FISH[i], 2)} − 150 = ${fx(FISH[i + 1], 2)}`,
              spec: { x: [0, 6], y: [0, 1600], size: [360, 170], xlabel: 'year', ylabel: 'fish' },
              chart: (i): Layer[] => [{ type: 'line', pts: pts(FISH.slice(0, i + 2)), color: 'var(--c1)' }, { type: 'dots', pts: pts(FISH.slice(0, i + 2)), color: 'var(--c1)' }],
            }),
        },
        {
          kind: 'number', unit: 'fish',
          body: `Year 1 ends with ${FISH[1]} fish. Same rule (births 20%, catch 150). How many after **year 2**?`,
          widget: fishFlow(num(FISH[1])),
          answer: FISH[2], tol: 0.01,
          explain: `${FISH[1]} + ${fx(0.2 * FISH[1])} − 150 = ${FISH[2]}. The births grew because the stock grew: a reinforcing loop.`,
        },
        {
          kind: 'number', unit: 'fish',
          body: 'Back at 1,000 fish with 20% births. What yearly catch would keep the population **exactly** at 1,000?',
          widget: fishFlow('1,000', 'catch\n? a year'),
          answer: 200, tol: 0.01,
          hint: 'Catch = births.',
          explain: 'Births are 200, so catching 200 makes inflow = outflow: an equilibrium.',
        },
        {
          kind: 'choice',
          body: 'With 20% births and a catch of 150, what happens if the lake starts with only 700 fish?',
          widget: fishFlow('700'),
          options: [
            { text: 'It shrinks every year, faster and faster', correct: true },
            { text: 'It grows back toward 1,000', why: '20% of 700 is only 140, less than the 150 caught. It loses fish from the very first year.' },
            { text: 'It stays at 700', why: 'Staying put needs births = catch: 140 ≠ 150.' },
          ],
          explain: '700 → 690 → 678 → … births shrink with the stock, so the losses grow. A fixed catch turns a reinforcing loop into a spiral down.',
        },
        {
          kind: 'point',
          body: 'With 20% births and a fixed catch of 150, below what stock does the population shrink every year? Tap that **tipping point**.',
          plot: { x: [0, 2000], ticks: [250], xlabel: 'fish' }, answer: { x: 750 }, tol: 25, snap: 50,
          hint: 'Births exactly equal the catch.',
          explain: '20% × stock = 150 at a stock of 750. Above 750 the fish multiply; below it the catch beats births and they spiral to zero.',
        },
        {
          kind: 'task',
          title: 'Set the quota',
          body: 'The lake starts at 1,000 fish with 20% births. Find the **largest** yearly catch that never lets the population fall.',
          widget: plotExplorer({
            params: [{ id: 'c', label: 'catch', min: 100, max: 300, step: 10, value: 260 }],
            spec: (v) => ({ x: [0, 20], y: [0, 2500], size: SZ, xlabel: 'years', ylabel: 'fish', layers: [
              { type: 'hline', y: 1000, color: 'var(--c3)', label: 'start' },
              { type: 'line', pts: pts(run(1000, 20, fish(0.2, v.c))), color: 'var(--c1)' },
            ] }),
            readout: (v) => { const xs = run(1000, 20, fish(0.2, v.c)); return `year 1 births ${Math.round(0.2 * 1000)} vs catch ${v.c} · year 20: ${Math.round(xs[20]).toLocaleString('en-US')} fish`; },
            goal: (v) => v.c === 200,
            goalText: 'Catch 200: births exactly replace it, forever.',
          }),
          hint: 'Births in year one are 20% of 1,000.',
          explain: 'Set the catch to 200. Births are 200 a year at 1,000 fish, so the stock stays flat. Any more and it starts to shrink, which shrinks births, which accelerates the collapse.',
        },
        {
          kind: 'fill',
          body: 'Write the fish simulation as two lines of code.',
          code: true,
          template: 'births = [[0]] × fish\nfish = fish + [[1]] − [[2]]',
          blanks: [
            { options: ['0.2', '20', '1.2'], answer: 0 },
            { options: ['births', 'catch', 'fish'], answer: 0 },
            { options: ['catch', 'births', '0.2'], answer: 0 },
          ],
          explain: 'births = 0.2 × fish; fish = fish + births − catch. Flows first (from the current stock), then the stock update.',
        },
        {
          kind: 'order',
          body: 'Put one simulation step in order.',
          items: [
            'Read the current value of each stock',
            'Work out every flow from those current values',
            'Add the inflows to each stock and subtract the outflows',
            'Record the new stocks and move to the next step',
          ],
          explain: 'Compute all flows from the same snapshot before updating anything; otherwise a stock you’ve already changed feeds the wrong numbers into the next flow.',
        },
        {
          kind: 'estimate',
          body: 'A different lake: 1,000 fish, births 15% a year, catch 120. Roughly how many fish after **10 years**?',
          min: 0, max: 3000, step: 50, answer: EST7_ANS, tol: 100,
          hint: 'Equilibrium is where 15% of the stock = 120. How far above it do you start, and how fast does that gap grow?',
          explain: `The balance point is 120 ÷ 0.15 = 800. The 200 fish above it grow 15% a year: 800 + 200 × 1.15^10 ≈ ${Math.round(EST7).toLocaleString('en-US')}.`,
        },
        {
          kind: 'match',
          body: 'Match each update rule to how it behaves over many steps.',
          heads: ['Rule', 'Behaviour'],
          pairs: [
            ['x → x + 0.1x', 'Grows exponentially'],
            ['x → x + 0.5(50 − x)', 'Settles at 50'],
            ['x → x + 5', 'Grows in a straight line'],
            ['x → x − 0.2x', 'Decays toward 0'],
            ['x → x + 0.5x(1 − x/100)', 'S-curve up to 100'],
          ],
          hint: 'Is the change fixed, proportional to x, or proportional to a gap?',
          explain: 'A fixed change gives a line; a change proportional to x compounds (up or down); a change proportional to a gap seeks a goal; the logistic rule mixes growth with a limit.',
        },
        {
          kind: 'number', unit: 'sick',
          body: 'An outbreak in a town of 1,000: 990 healthy, 10 sick. Each day new cases = 0.3 × sick × (healthy ÷ 1,000), and 10% of the sick recover. How many are sick the next day?',
          answer: r2(SIR_I), tol: 0.02,
          hint: 'Sick tomorrow = sick + new cases − recoveries.',
          explain: `New cases: 0.3 × 10 × 0.99 = 2.97. Recoveries: 1. Sick: 10 + 2.97 − 1 = ${r2(SIR_I)}. Two stocks, two flows, same table method: this is how epidemic models work.`,
        },
      ],
      practice: [genFishStep, genTipping, genSIR],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'decisions',
      title: 'Thinking in systems',
      goal: 'Map the loops in a real situation and look past first-order effects.',
      steps: [
        {
          kind: 'choice',
          body: 'Whenever you’re bored you check your phone. It brings relief, but you get less practice sitting with boredom, so boredom feels worse, so you check more. What kind of loop is this?',
          widget: phoneLoop,
          options: [
            { text: 'Reinforcing: the habit strengthens itself', correct: true },
            { text: 'Balancing: checking relieves boredom', why: 'Relief in the moment is a balancing effect, but the delayed link (tolerance falls) closes a loop that amplifies the habit.' },
            { text: 'No loop: it’s just a choice each time', why: 'Each choice changes the next situation. That’s exactly what a loop is.' },
          ],
          hint: 'Count the minus links around the loop.',
          explain: 'Checking → tolerance (−) → boredom feels awful (−) → checking (+). Two minuses: reinforcing. Many habits are loops like this, with a delay that hides the cost.',
        },
        {
          kind: 'read',
          title: 'And then what?',
          body: 'A **first-order effect** is what you intend: widen a road, trips get faster. **Second-order effects** come from how the system responds: faster trips attract more driving, which brings congestion back, which creates pressure to widen again. Ecologist Garrett Hardin: *we can never do merely one thing*. Keep asking “and then what?”',
          widget: roadLoop,
        },
        {
          kind: 'order',
          body: 'A café raises its prices by 20%. Put the chain of consequences in order.',
          items: [
            'Each sale brings in more money',
            'Some regulars switch to the café down the road',
            'The rival’s busier tills fund a nicer fit-out',
            'The rival becomes a stronger competitor',
          ],
          explain: 'The first-order effect (more per sale) is real. The later effects feed a rival’s reinforcing loop, which can outweigh it.',
        },
        {
          kind: 'sort',
          body: 'Personal loops: reinforcing or balancing?',
          bins: ['Reinforcing', 'Balancing'],
          items: [
            { text: 'Exercise → more energy → more exercise', bin: 0 },
            { text: 'Debt → interest → more debt', bin: 0 },
            { text: 'Reading more → knowing more → reading is more fun', bin: 0 },
            { text: 'Weight up → diet → weight down → diet relaxes', bin: 1 },
            { text: 'Messy room → tidy up → tidy room → stop tidying', bin: 1 },
            { text: 'Low on cash → spend less → savings recover', bin: 1 },
          ],
          explain: 'Reinforcing loops build (or erode) momentum: energy, debt, knowledge. Balancing loops hold a level: weight, tidiness, cash. To change a balancing loop, you have to change its goal.',
        },
        {
          kind: 'task',
          title: 'Map the overtime trap',
          body: 'A team has a backlog. More backlog → more overtime. Overtime → more work done. Work done → smaller backlog. But overtime → fatigue, and fatigue → less work done. Tap each circle to set its sign.',
          widget: loopBuilder(OT_NODES, OT_LINKS, { marks: [{ x: 125, y: 95, text: 'B' }, { x: 210, y: 145, text: 'R' }] }),
          hint: 'For each arrow: if the cause goes up, does the effect go up (+) or down (−)?',
          explain: 'Backlog → Overtime: +. Overtime → Work done: +. Work done → Backlog: −. Overtime → Fatigue: +. Fatigue → Work done: −. The left loop balances (overtime clears the backlog); the right one, through fatigue, reinforces it.',
        },
        {
          kind: 'choice',
          body: 'In that map, follow the path Overtime → Fatigue → Work done → Backlog → Overtime. What kind of loop is it?',
          widget: loop(OT_NODES, OT_LINKS, { marks: [{ x: 125, y: 95, text: 'B' }, { x: 210, y: 145, text: 'R' }] }),
          options: [
            { text: 'Reinforcing: overtime breeds more overtime', correct: true },
            { text: 'Balancing: overtime clears the backlog', why: 'That’s the other loop (through work done directly). Through fatigue, there are two minus links.' },
            { text: 'It isn’t a loop', why: 'It starts and ends at Overtime, so it is one.' },
          ],
          hint: 'Signs: +, −, −, +.',
          explain: 'Two minus links (fatigue → work done, work done → backlog) make the fatigue loop reinforcing. Short term the balancing loop wins; sustained overtime lets the reinforcing one take over.',
        },
        {
          kind: 'number', unit: 'units',
          body: 'Working 40 h a week you produce 40 units. You switch to 50 h. Week 1 gives 50 units, but fatigue cuts output per hour by 5% each week after. What do you produce in **week 8**?',
          widget: () => columnChart([1, 2, 3, 4].map((w) => ({ label: `wk ${w}`, value: 50 * 0.95 ** (w - 1) })).concat([{ label: '40 h', value: 40, color: 'var(--c3)' } as never]), { height: 150, format: (v) => v.toFixed(1) }),
          answer: r2(WEEK8), tol: 0.06,
          hint: '50 × 0.95^7.',
          explain: `50 × 0.95⁷ ≈ ${fx(WEEK8, 2)} units: less than the 40 from a normal week. The first-order gain (+10 hours) was overtaken by the second-order loss.`,
        },
        {
          kind: 'multi',
          body: 'Which questions help you see second-order effects before you decide? Pick all that apply.',
          options: [
            { text: 'And then what happens?', correct: true, why: 'It pushes you past the intended effect.' },
            { text: 'Who will react to this, and how?', correct: true, why: 'Other people’s responses are where feedback comes from.' },
            { text: 'What delays sit between action and result?', correct: true, why: 'Delayed effects are the ones that surprise you.' },
            { text: 'What will happen in the first week?', why: 'Useful, but it’s the first-order view. Loops and delays play out over longer times.' },
            { text: 'Which option pays off fastest?', why: 'Fast payoffs are often the quick fixes that backfire.' },
          ],
          explain: 'Ask what happens next, who responds, and how long the delays are. Those three questions surface most loops.',
        },
        {
          kind: 'estimate',
          body: 'A skill improves 1% a day, compounding, for a year. About how many times better is it after 365 days?',
          widget: P({ x: [0, 180], y: [0, 7], xlabel: 'days', ylabel: '× start', layers: [
            { type: 'fn', f: (t) => 1.01 ** t, color: 'var(--c3)', label: '1% better' },
            { type: 'fn', f: (t) => 0.99 ** t, color: 'var(--c2)', label: '1% worse' },
          ] }),
          min: 0, max: 100, step: 1, answer: Math.round(YEAR1), tol: 4, format: (v) => `${v}×`,
          hint: '1.01^365.',
          explain: `1.01^365 ≈ ${fx(YEAR1)}. (And 0.99^365 ≈ ${fx(0.99 ** 365, 2)}.) Real skills meet limits, so this is an upper bound, but small reinforcing loops are worth starting early.`,
        },
        {
          kind: 'match',
          body: 'Match each situation to the structure behind it.',
          heads: ['Situation', 'Structure'],
          pairs: [
            ['The rich get richer', 'Reinforcing loop'],
            ['Weight returns after a crash diet', 'Balancing loop with a set point'],
            ['A shower too hot, then too cold', 'Balancing loop with a delay'],
            ['A viral app’s growth stalls', 'Limits to growth'],
            ['A quick fix makes things worse later', 'Fixes that fail'],
          ],
          explain: 'The structure produces the behaviour. Recognise the structure and you can predict what happens next, and where to push.',
        },
        {
          kind: 'fill',
          body: 'Map a late-night screen loop.',
          template: 'More screen time at night → [[0]] sleep → [[1]] tiredness next day → [[2]] screen time (too tired for anything else). It’s a [[3]] loop.',
          blanks: [
            { options: ['less', 'more'], answer: 0 },
            { options: ['more', 'less'], answer: 0 },
            { options: ['more', 'less'], answer: 0 },
            { options: ['reinforcing', 'balancing'], answer: 0 },
          ],
          explain: 'Screens → less sleep (−) → more tiredness (−: less sleep, more tired) → more screens (+). Two minuses: reinforcing.',
        },
        {
          kind: 'choice',
          body: 'Where is the best leverage to break the late-night screen loop?',
          widget: screenLoop,
          options: [
            { text: 'Change the structure: charge the phone outside the bedroom', correct: true },
            { text: 'Rely on willpower each night', why: 'Willpower fights the loop at its strongest point, when you’re tired. The loop wins most nights.' },
            { text: 'Sleep in at weekends to catch up', why: 'A symptomatic fix: it eases tiredness without touching the loop, and can shift your body clock later.' },
          ],
          explain: 'Changing the structure (where the phone lives) breaks a link in the loop, so you don’t have to win the same fight every night.',
        },
        {
          kind: 'read',
          title: 'Thinking in systems',
          body: '- Find the stocks and the flows that change them.\n- Trace the loops: reinforcing ones amplify, balancing ones seek a goal.\n- Look for delays: they cause overshoot and hide consequences.\n- Expect limits to every growth loop.\n- Ask “and then what?” and intervene in structure, information, rules or goals, not just numbers.',
        },
      ],
      practice: [genHabit, genOvertime, genStory],
    },
  ],
};

