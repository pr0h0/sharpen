// Scientific Thinking: estimating, units, motion, forces, energy, waves, experiments and models.
// Every number in a question or an answer is computed below from its formula (g = 9.8 m/s²).
import type { Course, Generator, Layer, PlotSpec } from '../types';
import { num, pct, pick, randInt, shuffle } from '../ui';
import { barChart, dataTable } from '../viz/charts';
import { plotExplorer } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  G, brakingExplorer, coaster, factorChain, fallRace, fmaExplorer, freeBody, logLadder, miniGraphs, motionTrack,
  pendulum, period, pow10s, puckSlide, randomizer, sampleSim, unitChain, waveExplorer, waveStepper,
} from '../widgets/science';

const SZ: [number, number] = [400, 250];
const P = (spec: PlotSpec) => () => plotEl({ size: SZ, ...spec });
/** Slider position (a power of ten) shown as a plain number: 2.5 -> "≈ 320". */
const fmtPow = (v: number) => {
  const x = 10 ** v;
  return '≈ ' + (x >= 10 ? Math.round(Number(x.toPrecision(2))).toLocaleString('en-US') : x.toPrecision(2));
};
/** Mantissa well away from the 3.16-5.5 band, where "nearest power of ten" on a log scale and on a plain scale disagree. */
const clearPower = (v: number) => { const m = v / 10 ** Math.floor(Math.log10(v)); return m < 3 || m >= 5.6; };
const big = (v: number) => Math.round(v).toLocaleString('en-US');

// ---------------------------------------------------------------- lesson data

// Lesson 1: the classic piano-tuner chain.
const CHI = { pop: 3_000_000, perHome: 2, pianoShare: 1 / 20, tuningsPerYear: 1, perTuner: 4 * 250 };
const chiPianos = (CHI.pop / CHI.perHome) * CHI.pianoShare;
const chiTuners = (chiPianos * CHI.tuningsPerYear) / CHI.perTuner;
const chiTunersAlt = ((CHI.pop / CHI.perHome) * (1 / 10)) / 2000;
const secYear = 365.25 * 86400;
const heartsLife = 70 * 60 * 24 * 365 * 80;
const shower = 4 * 1 * 8 * 10 * 365;
const busVol = 10 * 2.5 * 2, ballCube = 0.04 ** 3, busBalls = busVol / ballCube;
const busExp = Math.round(Math.log10(busBalls) / 0.25) * 0.25;

// Lesson 3: a cyclist (piecewise) and a car that speeds up then cruises.
const CYC: [number, number][] = [[0, 0], [4, 20], [7, 20], [10, 44]];
const cycX = (t: number) => {
  for (let k = 0; k < CYC.length - 1; k++) {
    const [a, xa] = CYC[k], [b, xb] = CYC[k + 1];
    if (t <= b) return xa + ((xb - xa) * (t - a)) / (b - a);
  }
  return CYC[CYC.length - 1][1];
};
const carV = (t: number) => (t < 5 ? 2 * t : 10);
const carX = (t: number) => (t < 5 ? t * t : 25 + 10 * (t - 5));
const ramp = (t: number) => (t * (12 - t)) / 3;

// Lesson 5: braking that takes 14 m from 50 km/h.
const DECEL = (50 / 3.6) ** 2 / (2 * 14);
const brake = (kmh: number) => (kmh / 3.6) ** 2 / (2 * DECEL);
const dropH100 = (100 / 3.6) ** 2 / (2 * G);

// Lesson 6.
const L2s = G / Math.PI ** 2; // length for a 2 s period
const T10 = period(10);
const lam440 = 343 / 440;

// Lesson 7: chance of 7+ or 3- heads in 10 fair flips.
const choose = (n: number, k: number): number => (k === 0 ? 1 : (choose(n, k - 1) * (n - k + 1)) / k);
const swing10 = (2 * [7, 8, 9, 10].reduce((a, k) => a + choose(10, k), 0)) / 1024;

// Lesson 8: spring data (extension in cm against load in hundreds of grams).
const SPRING: [number, number][] = [[0, 0], [1, 2.1], [2, 3.9], [3, 6.2], [4, 7.9], [5, 10.1]];
const kBest = SPRING.reduce((a, [x, y]) => a + x * y, 0) / SPRING.reduce((a, [x]) => a + x * x, 0);
const SPRING_LONG: [number, number][] = [[1, 2.0], [2, 4.1], [3, 5.9], [4, 8.0], [5, 10.1], [6, 12.0], [7, 15.5], [8, 20.0], [9, 26.0], [10, 33.0]];

// ---------------------------------------------------------------- practice generators

// L1 Fermi
const genNearestPower: Generator = (rng) => {
  const kinds = [
    { what: 'seconds', per: 'day', k: 86400, lo: 2, hi: 400 },
    { what: 'minutes', per: 'week', k: 10080, lo: 2, hi: 300 },
    { what: 'hours', per: 'year', k: 8760, lo: 2, hi: 90 },
    { what: 'heartbeats (at 70 a minute)', per: 'day', k: 70 * 1440, lo: 2, hi: 400 },
  ];
  let kd = kinds[0], n = 2, v = 1;
  for (let tries = 0; tries < 60; tries++) {
    kd = pick(rng, kinds); n = randInt(rng, kd.lo, kd.hi); v = n * kd.k;
    if (clearPower(v)) break;
  }
  const e = Math.round(Math.log10(v));
  const start = e - randInt(rng, 0, 2);
  const opts = [0, 1, 2, 3].map((j) => start + j);
  return {
    kind: 'choice', ordered: true,
    body: `Roughly how many ${kd.what} are there in **${n} ${kd.per}s**? Pick the nearest power of ten.`,
    options: opts.map((p) => p === e
      ? { text: pow10s(p), correct: true }
      : { text: pow10s(p), why: `That's ${p < e ? 'too small' : 'too big'} by a factor of ${big(10 ** Math.abs(p - e))}: the real count is about ${num(v / 10 ** e, 2)} × ${pow10s(e)}.` }),
    hint: `One ${kd.per} has ${big(kd.k)} ${kd.what.split(' ')[0]}.`,
    explain: `${n} × ${big(kd.k)} = ${big(v)}, which is nearest to ${pow10s(e)}.`,
  };
};

const genFermiProduct: Generator = (rng) => {
  if (rng() < 0.5) {
    const pop = pick(rng, [20_000, 50_000, 100_000, 200_000, 500_000]);
    const cups = pick(rng, [0.5, 1, 1.5, 2]);
    const sold = pick(rng, [200, 250, 400, 500]);
    const ans = (pop * cups) / sold;
    return {
      kind: 'number',
      body: `Fermi it: a town has ${big(pop)} people who drink on average ${cups} cup${cups === 1 ? '' : 's'} of café coffee a day. A café sells about ${sold} cups a day. How many cafés can the town support?`,
      answer: ans, tol: Math.max(0.5, ans * 0.01), unit: 'cafés',
      hint: 'Cups wanted per day ÷ cups one café sells per day.',
      explain: `${big(pop)} × ${cups} = ${big(pop * cups)} cups a day; ÷ ${sold} per café ≈ ${num(ans)} cafés.`,
    };
  }
  const pop = pick(rng, [100_000, 200_000, 400_000, 1_000_000]);
  const per = pick(rng, [2, 2.5, 4]);
  const share = pick(rng, [4, 5, 10]);
  const kg = pick(rng, [2, 3, 5]);
  const ans = (((pop / per) / share) * kg) / 1000;
  return {
    kind: 'number',
    body: `Fermi it: a city of ${big(pop)} people, ${per} people per household, 1 in ${share} households has a dog, and a dog eats about ${kg} kg of food a week. How many **tonnes** of dog food a week?`,
    answer: ans, tol: Math.max(0.05, ans * 0.01), unit: 'tonnes',
    hint: 'Households, then dogs, then kilograms, then ÷ 1,000 for tonnes.',
    explain: `${big(pop)} ÷ ${per} = ${big(pop / per)} households; ÷ ${share} = ${big(pop / per / share)} dogs; × ${kg} kg = ${big((pop / per / share) * kg)} kg ≈ ${num(ans)} tonnes.`,
  };
};

const genLogEstimate: Generator = (rng) => {
  const kd = pick(rng, [
    { q: 'seconds in', unit: 'years', k: secYear, lo: 1, hi: 90 },
    { q: 'minutes in', unit: 'years', k: 525960, lo: 1, hi: 90 },
    { q: 'heartbeats (70 a minute) in', unit: 'days', k: 70 * 1440, lo: 1, hi: 900 },
  ] as const);
  const n = randInt(rng, kd.lo, kd.hi);
  const v = n * kd.k;
  const exact = Math.log10(v);
  const ans = Math.round(exact * 2) / 2;
  return {
    kind: 'estimate', min: 0, max: 12, step: 0.5, answer: ans, tol: 0.5, format: fmtPow,
    body: `Without a calculator: roughly how many ${kd.q} **${n} ${kd.unit}**? (The slider moves in half powers of ten; within about a factor of 3 counts.)`,
    hint: 'Round each factor to one digit and a power of ten, then add the powers.',
    explain: `${n} × ${big(kd.k)} ≈ ${num(v, 2)}, about 10^${num(exact, 3)}.`,
  };
};

// L2 Units
const genSpeedConvert: Generator = (rng) => {
  if (rng() < 0.5) {
    const k = randInt(rng, 1, 12), kmh = 18 * k;
    return {
      kind: 'number', unit: 'm/s', answer: 5 * k, tol: 0.05,
      body: `Convert **${kmh} km/h** to metres per second.`,
      hint: '1 km = 1,000 m and 1 h = 3,600 s, so divide by 3.6.',
      explain: `${kmh} × 1,000 m ÷ 3,600 s = ${5 * k} m/s.`,
    };
  }
  const ms = randInt(rng, 2, 40);
  return {
    kind: 'number', unit: 'km/h', answer: ms * 3.6, tol: 0.05,
    body: `Convert **${ms} m/s** to kilometres per hour.`,
    hint: 'In one hour (3,600 s) it goes 3,600 times as far; then ÷ 1,000 for km.',
    explain: `${ms} m/s × 3,600 s/h ÷ 1,000 m/km = ${num(ms * 3.6)} km/h.`,
  };
};

const DIMS = [
  { q: 'distance', u: 'm', ex: ['v · t', 'a · t²', 'v² / a'] },
  { q: 'speed', u: 'm/s', ex: ['a · t', 'd / t', '√(a · d)'] },
  { q: 'acceleration', u: 'm/s²', ex: ['v / t', 'd / t²', 'v² / d'] },
  { q: 'time', u: 's', ex: ['d / v', 'v / a', '√(d / a)'] },
] as const;
const genDimFormula: Generator = (rng) => {
  const ti = randInt(rng, 0, 3), target = DIMS[ti];
  const right = pick(rng, target.ex);
  const others = shuffle(rng, DIMS.filter((_, k) => k !== ti));
  const wrong = others.map((d) => ({ d, e: pick(rng, d.ex) }));
  return {
    kind: 'choice',
    body: `With d a distance (m), v a speed (m/s), a an acceleration (m/s²) and t a time (s): which expression has the units of a **${target.q}** (${target.u})?`,
    options: [{ text: right, correct: true }, ...wrong.map(({ d, e }) => ({ text: e, why: `${e} comes out in ${d.u}: that's a ${d.q}, not a ${target.q}.` }))],
    hint: 'Substitute the units and cancel.',
    explain: `${right}: put the units in and they cancel down to ${target.u}.`,
  };
};

const genUnitFill: Generator = (rng) => {
  const n = randInt(rng, 2, 48);
  const vals = shuffle(rng, [n * 3600, n * 60, n * 216000]);
  return {
    kind: 'fill',
    body: `Complete the chain to turn **${n} hours** into seconds.`,
    template: `${n} h × [[0]] × [[1]] = [[2]] s`,
    blanks: [
      { options: ['60 min / 1 h', '1 h / 60 min'], answer: 0 },
      { options: ['1 min / 60 s', '60 s / 1 min'], answer: 1 },
      { options: vals.map(big), answer: vals.indexOf(n * 3600) },
    ],
    hint: 'Put the unit you want to cancel on the bottom of each fraction.',
    explain: `Hours cancel against "per hour", minutes against "per minute": ${n} × 60 × 60 = ${big(n * 3600)} s.`,
  };
};

// L3 Motion
const genSlope: Generator = (rng) => {
  const v = randInt(rng, 1, 9), t1 = randInt(rng, 0, 4), dt = randInt(rng, 2, 6), x1 = randInt(rng, 0, 20);
  const t2 = t1 + dt, x2 = x1 + v * dt;
  return {
    kind: 'number', unit: 'm/s', answer: v, tol: 0.01,
    body: `On a position-time graph, a runner's straight line goes from (${t1} s, ${x1} m) to (${t2} s, ${x2} m). What is the runner's speed?`,
    widget: P({ x: [0, 12], y: [0, 80], xlabel: 'time (s)', ylabel: 'position (m)', layers: [{ type: 'line', pts: [[t1, x1], [t2, x2]], color: 'var(--c1)' }, { type: 'dots', pts: [[t1, x1], [t2, x2]], color: 'var(--c2)' }] }),
    hint: 'Slope = change in position ÷ change in time.',
    explain: `(${x2} − ${x1}) m ÷ (${t2} − ${t1}) s = ${v * dt} ÷ ${dt} = ${v} m/s.`,
  };
};

const genArea: Generator = (rng) => {
  const v1 = randInt(rng, 0, 8), v2 = v1 + randInt(rng, 2, 10), T = randInt(rng, 2, 8);
  const d = ((v1 + v2) / 2) * T;
  return {
    kind: 'number', unit: 'm', answer: d, tol: 0.05,
    body: `A cart speeds up steadily from ${v1} m/s to ${v2} m/s over ${T} s. How far does it go in that time?`,
    widget: P({ x: [0, 10], y: [0, 20], xlabel: 'time (s)', ylabel: 'velocity (m/s)', layers: [
      { type: 'area', f: (t) => v1 + ((v2 - v1) * t) / T, from: 0, to: T, color: 'var(--c3)' },
      { type: 'line', pts: [[0, v1], [T, v2]], color: 'var(--c1)' }] }),
    hint: 'Distance is the shaded area under the v-t line: a trapezoid.',
    explain: `Area = average speed × time = (${v1} + ${v2}) ÷ 2 × ${T} = ${num(d)} m.`,
  };
};

const genStopPoint: Generator = (rng) => {
  const a = pick(rng, [1, 2, 3, 4, 5]), ts = randInt(rng, 2, 9), v0 = a * ts;
  return {
    kind: 'point', answer: { x: ts }, tol: 0.25, snap: 0.25,
    body: `A cart rolls up a slope at ${v0} m/s and slows by ${a} m/s every second (then rolls back). Tap the time axis at the moment it stops at the top.`,
    widget: P({ x: [0, 10], y: [-10 * a, v0 + 2], xlabel: 'time (s)', ylabel: 'velocity (m/s)', layers: [{ type: 'fn', f: (t) => v0 - a * t, color: 'var(--c1)' }] }),
    plot: { x: [0, 10], ticks: [1], xlabel: 'time (s)', size: [360, 80] },
    hint: 'It stops when its velocity is zero: where the line crosses the time axis.',
    explain: `v = ${v0} − ${a}t is zero at t = ${v0} ÷ ${a} = ${ts} s. After that the velocity is negative: it rolls back.`,
  };
};

// L4 Forces
const genFma: Generator = (rng) => {
  const m = pick(rng, [2, 5, 10, 20, 50, 800, 1200, 1500]), a = pick(rng, [0.5, 1.5, 2, 2.5, 3, 4]), F = m * a;
  const which = randInt(rng, 0, 2);
  if (which === 0) return { kind: 'number', unit: 'N', answer: F, body: `What net force gives a ${m} kg object an acceleration of ${a} m/s²?`, hint: 'F = m × a.', explain: `F = ${m} × ${a} = ${num(F)} N.` };
  if (which === 1) return { kind: 'number', unit: 'm/s²', answer: a, body: `A net force of ${num(F)} N acts on a ${m} kg object. What is its acceleration?`, hint: 'a = F ÷ m.', explain: `a = ${num(F)} ÷ ${m} = ${a} m/s².` };
  return { kind: 'number', unit: 'kg', answer: m, body: `A net force of ${num(F)} N gives an object an acceleration of ${a} m/s². What is its mass?`, hint: 'm = F ÷ a.', explain: `m = ${num(F)} ÷ ${a} = ${m} kg.` };
};

const genFall: Generator = (rng) => {
  const t = pick(rng, [0.5, 1, 1.5, 2, 2.5, 3]);
  if (rng() < 0.5) {
    const d = 0.5 * G * t * t;
    return { kind: 'number', unit: 'm', answer: d, tol: 0.02, body: `A stone is dropped from rest (ignore air). How far does it fall in **${t} s**?`, hint: 'd = ½ g t², with g = 9.8 m/s².', explain: `½ × 9.8 × ${t}² = ${num(d, 4)} m. Its mass doesn't matter.` };
  }
  return { kind: 'number', unit: 'm/s', answer: G * t, tol: 0.02, body: `A stone is dropped from rest (ignore air). How fast is it falling after **${t} s**?`, hint: 'Each second, gravity adds 9.8 m/s.', explain: `v = g t = 9.8 × ${t} = ${num(G * t, 4)} m/s.` };
};

const NETPOOL: { t: string; zero: boolean; why: string }[] = [
  { t: 'A book resting on a table', zero: true, why: 'Weight down, table pushing up: balanced, so no acceleration.' },
  { t: 'A car cruising at a steady 90 km/h on a straight road', zero: true, why: 'Constant speed in a straight line: no acceleration, so the forces balance.' },
  { t: 'A skydiver falling at constant terminal speed', zero: true, why: 'Air resistance has grown to equal the weight.' },
  { t: 'A lamp hanging still from the ceiling', zero: true, why: 'Cord tension equals weight.' },
  { t: 'A ball at the very top of its throw', zero: false, why: 'Momentarily still, but gravity still acts: it is accelerating downward at 9.8 m/s².' },
  { t: 'A car going round a bend at a steady speed', zero: false, why: 'Its direction is changing, which is an acceleration; a sideways force (friction) causes it.' },
  { t: 'A sprinter leaving the blocks', zero: false, why: 'Speeding up needs a net forward force.' },
  { t: 'An apple falling from a tree', zero: false, why: 'Gravity is unbalanced: it speeds up as it falls.' },
  { t: 'A train braking to a stop', zero: false, why: 'Slowing down is acceleration too; friction is unbalanced.' },
];
const genNetZero: Generator = (rng) => {
  const frame = randInt(rng, 0, 2), accel = frame === 0;
  let picks = shuffle(rng, NETPOOL).slice(0, 5);
  if (!picks.some((p) => p.zero !== accel)) picks = [NETPOOL.find((p) => p.zero !== accel)!, ...picks.slice(1)];
  return {
    kind: 'multi',
    body: ['Select every object that is **accelerating** (net force not zero).', 'Select every object with **zero net force** on it.', 'In which of these are the forces on the object **balanced**?'][frame],
    options: picks.map((p) => (p.zero !== accel ? { text: p.t, correct: true, why: p.why } : { text: p.t, why: p.why })),
    hint: 'Zero net force ⇔ constant velocity: same speed AND same direction (including at rest).',
    explain: 'Newton’s first law: forces balance exactly when the velocity (speed and direction) isn’t changing.',
  };
};

// L5 Energy
const genKE: Generator = (rng) => {
  const m = pick(rng, [2, 60, 80, 500, 1000, 1500]), v = pick(rng, [2, 4, 5, 10, 15, 20, 30]);
  const ke = 0.5 * m * v * v;
  return {
    kind: 'number', unit: 'J', answer: ke, tol: Math.max(0.01, ke * 0.002),
    body: `What is the kinetic energy of a ${m} kg object moving at ${v} m/s?`,
    hint: 'KE = ½ m v².',
    explain: `½ × ${m} × ${v}² = ${big(ke)} J.`,
  };
};

const genDrop: Generator = (rng) => {
  if (rng() < 0.5) {
    const h = pick(rng, [1, 2, 5, 10, 20, 45, 80]);
    const v = Math.sqrt(2 * G * h);
    return { kind: 'number', unit: 'm/s', answer: v, tol: 0.05, body: `A ball is dropped from ${h} m (ignore air). How fast is it going when it reaches the ground?`, hint: 'mgh = ½mv², so v = √(2gh). The mass cancels.', explain: `v = √(2 × 9.8 × ${h}) = ${num(v, 3)} m/s.` };
  }
  const v = pick(rng, [5, 7, 10, 14, 20, 28]);
  const h = (v * v) / (2 * G);
  return { kind: 'number', unit: 'm', answer: h, tol: 0.05, body: `A ball is thrown straight up at ${v} m/s (ignore air). How high does it rise?`, hint: 'All its kinetic energy turns into potential: ½mv² = mgh.', explain: `h = v² ÷ (2g) = ${v * v} ÷ 19.6 = ${num(h, 3)} m.` };
};

const genStopScale: Generator = (rng) => {
  const d = randInt(rng, 6, 20), k = pick(rng, [2, 3, 1.5, 0.5]);
  const right = d * k * k;
  const cands = [right, d * k, d * k * k * k, d * (k + 1)].filter((x, i, a) => a.indexOf(x) === i);
  const why = (x: number) => x === d * k ? 'That scales distance with speed. But braking has to remove ½mv², which grows with the square of speed.'
    : x === d * k * k * k ? 'Too much: energy goes with v², not v³.' : 'Distance isn’t speed-plus-something: it scales with the square of the speed.';
  return {
    kind: 'choice',
    body: `Braking hard, a car stops in ${d} m. With the same brakes, how far does it need from **${num(k)}× that speed**?`,
    options: cands.map((x) => (x === right ? { text: `${num(x)} m`, correct: true } : { text: `${num(x)} m`, why: why(x) })),
    hint: 'Braking distance ∝ v².',
    explain: `Kinetic energy, and so braking distance, grows with v²: ${d} × ${num(k)}² = ${num(right)} m.`,
  };
};

// L6 Waves
const genPeriod: Generator = (rng) => {
  const L = pick(rng, [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5]);
  const T = period(L);
  return {
    kind: 'number', unit: 's', answer: T, tol: 0.01,
    body: `What is the period of a simple pendulum ${L} m long (small swings, g = 9.8 m/s²)?`,
    hint: 'T = 2π √(L / g).',
    explain: `T = 2π √(${L} ÷ 9.8) = ${num(T, 3)} s.`,
  };
};

const genWave: Generator = (rng) => {
  const f = pick(rng, [2, 4, 5, 10, 20, 50]), l = pick(rng, [0.5, 1.5, 2, 3, 4]), v = f * l;
  const w = randInt(rng, 0, 2);
  if (w === 0) return { kind: 'number', unit: 'm/s', answer: v, body: `A wave has frequency ${f} Hz and wavelength ${l} m. How fast does it travel?`, hint: 'v = f λ.', explain: `${f} × ${l} = ${num(v)} m/s.` };
  if (w === 1) return { kind: 'number', unit: 'm', answer: l, body: `A wave travels at ${num(v)} m/s with frequency ${f} Hz. What is its wavelength?`, hint: 'λ = v ÷ f.', explain: `${num(v)} ÷ ${f} = ${l} m.` };
  return { kind: 'number', unit: 'Hz', answer: f, body: `A wave travels at ${num(v)} m/s and its crests are ${l} m apart. What is its frequency?`, hint: 'f = v ÷ λ.', explain: `${num(v)} ÷ ${l} = ${f} Hz.` };
};

const genLengthScale: Generator = (rng) => {
  const k = pick(rng, [4, 9, 16, 0.25, 2]);
  const T0 = pick(rng, [1, 1.5, 2, 3]);
  const right = T0 * Math.sqrt(k);
  const cands = [right, T0 * k, T0 / Math.sqrt(k), T0].filter((x, i, a) => a.findIndex((y) => Math.abs(y - x) < 1e-9) === i);
  return {
    kind: 'choice',
    body: `A pendulum has a period of ${T0} s. You make its string **${num(k)}×** as long. New period?`,
    options: cands.map((x) => Math.abs(x - right) < 1e-9 ? { text: `${num(x, 3)} s`, correct: true }
      : { text: `${num(x, 3)} s`, why: Math.abs(x - T0 * k) < 1e-9 ? 'Period grows with the square root of length, not in proportion.' : Math.abs(x - T0) < 1e-9 ? 'Length does change the period (it’s the mass that doesn’t).' : `Upside down: T ∝ √L, so multiply by √${num(k)}, don’t divide.` }),
    hint: 'T ∝ √L.',
    explain: `T = 2π√(L/g), so T scales with √${num(k)} = ${num(Math.sqrt(k), 3)}: ${T0} × ${num(Math.sqrt(k), 3)} = ${num(right, 3)} s.`,
  };
};

// L7 Experiments
const genPctDiff: Generator = (rng) => {
  const n = pick(rng, [50, 80, 100, 200, 250]);
  const a = randInt(rng, 10, n * 0.6), b = randInt(rng, 5, a);
  const d = ((a - b) / n) * 100;
  return {
    kind: 'number', unit: 'percentage points', answer: d, tol: 0.05,
    body: `In a trial, ${a} of ${n} people on the drug improved, and ${b} of ${n} on the placebo did. By how many **percentage points** did the drug group do better?`,
    widget: () => dataTable(['Group', 'Improved', 'Total'], [['Drug', a, n], ['Placebo', b, n]]),
    hint: 'Turn each into a percentage first, then subtract.',
    explain: `${pct(a / n)} − ${pct(b / n)} = ${num(d, 4)} percentage points.`,
  };
};

const EXPERIMENTS = [
  { q: 'Does the temperature of water change how fast sugar dissolves?', iv: 'Water temperature', dv: 'Time for the sugar to dissolve', c: ['Amount of sugar', 'Volume of water', 'Stirring'] },
  { q: 'Does the length of a pendulum change its period?', iv: 'String length', dv: 'Time for 10 swings', c: ['Bob mass', 'Release angle', 'Stopwatch used'] },
  { q: 'Does music while studying change test scores?', iv: 'Music on or off', dv: 'Test score', c: ['Study time', 'The test given', 'Time of day'] },
  { q: 'Does ramp height change how far a toy car rolls?', iv: 'Ramp height', dv: 'Distance rolled', c: ['The car used', 'Floor surface', 'Ramp length'] },
  { q: 'Does the amount of light change how fast cress grows?', iv: 'Hours of light a day', dv: 'Height after a week', c: ['Water given', 'Seed type', 'Temperature'] },
];
const genVariables: Generator = (rng) => {
  const e = pick(rng, EXPERIMENTS);
  return {
    kind: 'sort', bins: ['Independent (changed)', 'Dependent (measured)', 'Controlled (kept the same)'],
    body: `Experiment: *${e.q}* Sort the variables.`,
    items: shuffle(rng, [{ text: e.iv, bin: 0 }, { text: e.dv, bin: 1 }, ...e.c.map((t) => ({ text: t, bin: 2 }))]),
    hint: 'What do you change on purpose? What do you measure? What must stay put?',
    explain: `You change ${e.iv.toLowerCase()}, measure ${e.dv.toLowerCase()}, and keep everything else (${e.c.join(', ').toLowerCase()}) the same so it can't explain the result.`,
  };
};

const FLAWS = [
  { s: 'A teacher tries a new reading app with her class and their scores rise over the term.', ans: 'No comparison group', note: 'scores usually rise over a term anyway' },
  { s: 'Patients choose whether to take a new supplement; the takers turn out healthier a year later.', ans: 'No random assignment', note: 'health-conscious people choose supplements' },
  { s: 'A researcher who invented a pain cream asks patients how they feel, knowing who got the cream.', ans: 'Not blinded', note: 'hopes can nudge questions and readings' },
  { s: 'A sleep trick is tested on 4 people; 3 of them sleep better.', ans: 'Sample too small', note: '3 of 4 can easily happen by chance' },
  { s: 'Everyone in a pill trial gets the real pill, and most feel better.', ans: 'No comparison group', note: 'people often recover, or feel better from expecting to' },
  { s: 'A gym compares members who picked its new class with those who didn’t, and the class-takers are fitter.', ans: 'No random assignment', note: 'keen people pick extra classes' },
  { s: 'Judges who know which essays came from the new teaching method rate those essays higher.', ans: 'Not blinded', note: 'knowing the group colours the judgement' },
];
const FLAW_NAMES = ['No comparison group', 'No random assignment', 'Not blinded', 'Sample too small'];
const genFlaw: Generator = (rng) => {
  const f = pick(rng, FLAWS);
  const whyOf: Record<string, string> = {
    'No comparison group': 'There may well be a comparison problem elsewhere, but it isn’t the main flaw here.',
    'No random assignment': 'Assignment isn’t the main issue in this design.',
    'Not blinded': 'Blinding isn’t the main issue here.',
    'Sample too small': 'The sample size isn’t the main issue here.',
  };
  return {
    kind: 'choice',
    body: `What's the biggest flaw? ${f.s}`,
    options: FLAW_NAMES.map((n) => (n === f.ans ? { text: n, correct: true } : { text: n, why: whyOf[n] })),
    hint: 'Ask: compared with what? Who decided the groups? Who knew? How many?',
    explain: `${f.ans}: ${f.note}.`,
  };
};

// L8 Models
const genPredict: Generator = (rng) => {
  const b = pick(rng, [1.5, 2, 2.5, 3, 4]), a = randInt(rng, 5, 20);
  const x1 = randInt(rng, 1, 3), x2 = x1 + randInt(rng, 2, 4), x3 = x2 + randInt(rng, 1, 5);
  const y = (x: number) => a + b * x;
  return {
    kind: 'number', unit: '°C', answer: y(x3), tol: 0.05,
    body: `Water in a pan warms steadily: ${num(y(x1))} °C after ${x1} min and ${num(y(x2))} °C after ${x2} min. Using a straight-line model, predict the temperature after **${x3} min**.`,
    widget: P({ x: [0, 14], y: [0, 80], xlabel: 'time (min)', ylabel: 'temperature (°C)', layers: [{ type: 'dots', pts: [[x1, y(x1)], [x2, y(x2)]], color: 'var(--c2)' }] }),
    hint: 'Rate = rise ÷ time between the readings; then extend the line.',
    explain: `Rate: (${num(y(x2))} − ${num(y(x1))}) ÷ ${x2 - x1} = ${b} °C per min. At ${x3} min: ${num(y(x2))} + ${b} × ${x3 - x2} = ${num(y(x3))} °C (as long as the model still holds: it breaks at boiling).`,
  };
};

const TESTABLE = [
  'Ice melts faster in salt water than in fresh water',
  'Seeds sprout sooner when kept warm',
  'A heavier pendulum bob swings with a longer period',
  'Taller people, on average, have bigger shoe sizes',
  'Bread goes mouldy faster in a warm room',
];
const UNTESTABLE = [
  'Everything happens for a reason',
  'The crystal heals, but only if you truly believe',
  'An undetectable spirit guides the planets',
  'The universe was created five minutes ago, memories included',
  'Lucky charms work in ways science can’t measure',
];
const genFalsifiable: Generator = (rng) => {
  const right = pick(rng, TESTABLE);
  const wrong = shuffle(rng, UNTESTABLE).slice(0, 3);
  const ask = pick(rng, ['Which claim could an experiment show to be **false**?', 'Which claim makes a **risky, testable** prediction?', 'Only one of these could ever be caught out by evidence. Which?']);
  return {
    kind: 'choice', body: ask,
    options: [{ text: right, correct: true }, ...wrong.map((w) => ({ text: w, why: 'No possible observation could count against this, so it can’t be tested (which isn’t the same as false).' }))],
    hint: 'Imagine the result that would prove it wrong. Can you?',
    explain: `“${right}” says what you should observe, so a fair test could catch it out. That’s what makes it scientific, true or not.`,
  };
};

const genCandle: Generator = (rng) => {
  const r = pick(rng, [0.5, 1, 1.5, 2, 2.5, 3]), k = randInt(rng, 3, 9), L = r * k;
  return {
    kind: 'point', answer: { x: k }, tol: 0.25, snap: 0.5,
    body: `A candle starts ${num(L)} cm tall. The dots show its height in the first two hours. Model it as burning at a steady rate: tap the time when it will be gone.`,
    widget: P({ x: [0, 10], y: [0, Math.ceil(L) + 1], xlabel: 'time (h)', ylabel: 'height (cm)', layers: [{ type: 'dots', pts: [[0, L], [1, L - r], [2, L - 2 * r]], color: 'var(--c2)' }] }),
    plot: { x: [0, 10], ticks: [1], xlabel: 'time (h)', size: [360, 80] },
    hint: 'How much does it lose per hour? How many hours to lose all of it?',
    explain: `It loses ${num(r)} cm an hour, so ${num(L)} ÷ ${num(r)} = ${k} hours.`,
  };
};

// ---------------------------------------------------------------- course

const proj = (v: number, deg: number) => {
  const th = (deg * Math.PI) / 180;
  return { R: (v * v * Math.sin(2 * th)) / G, y: (x: number) => x * Math.tan(th) - (G * x * x) / (2 * v * v * Math.cos(th) ** 2) };
};

const fit = (k: number) => SPRING.reduce((a, [x, y]) => a + (y - k * x) ** 2, 0);

export const science: Course = {
  id: 'science',
  title: 'Scientific Thinking',
  blurb: 'Estimate, measure, model and test: physics intuition and how science knows things.',
  color: '#d9653b',
  icon: '🔭',
  lessons: [
    // ============================================================ 1 Fermi
    {
      id: 'fermi',
      title: 'Fermi estimation',
      goal: 'Get the right order of magnitude by breaking a question into factors.',
      steps: [
        {
          kind: 'estimate',
          body: 'Gut guess first, no method yet. **How many piano tuners work in Chicago?** (The slider moves in powers of ten.)',
          min: 0, max: 5, step: 0.25, answer: 2, tol: 1, format: fmtPow,
          hint: 'Is it more like 10, 100, 1,000 or 10,000?',
          explain: `A chain of rough guesses (next screen) lands at about ${Math.round(chiTuners)}: on the order of 100. Anything from about 10 to 1,000 counts as the right ballpark here.`,
        },
        {
          kind: 'read',
          title: 'Break it into factors',
          body: 'Enrico Fermi’s trick: an impossible question becomes a few guessable ones. People → homes → pianos → tunings a year → tuners needed. Each factor can be off, but the chain lands in the right ballpark.',
          widget: factorChain([
            { value: big(CHI.pop), label: 'people in Chicago' },
            { value: String(CHI.perHome), label: 'people per home', op: '÷' },
            { value: '1/20', label: 'homes with a piano' },
            { value: '1', label: 'tuning per piano per year' },
            { value: big(CHI.perTuner), label: 'tunings a tuner does a year (4 a day × 250 days)', op: '÷' },
            { value: `≈ ${Math.round(chiTuners)}`, label: 'piano tuners', op: '=' },
          ]),
        },
        {
          kind: 'order',
          body: 'Put the steps of the piano-tuner estimate in the order you’d calculate them.',
          items: ['Start with the population', 'Divide by people per home to get homes', 'Multiply by the share of homes with a piano', 'Multiply by tunings per piano per year', 'Divide by the tunings one tuner can do a year'],
          hint: 'Each step uses the result of the one before.',
          explain: 'Each factor turns one quantity into the next: people → homes → pianos → tunings → tuners. Writing it as a chain makes it easy to check the units line up.',
        },
        {
          kind: 'choice', ordered: true,
          body: 'Suppose you’d guessed **twice** as many homes have a piano (1 in 10) and also that a tuner does **twice** as many tunings (2,000 a year). Now how many tuners?',
          options: [
            { text: `${chiTunersAlt / 2}`, why: 'Doubling pianos raises the answer; doubling each tuner’s workload lowers it. They don’t both push the same way.' },
            { text: `${chiTunersAlt}`, correct: true },
            { text: `${chiTunersAlt * 2}`, why: 'That counts the extra pianos but forgets that each tuner now handles twice as many.' },
            { text: `${chiTunersAlt * 4}`, why: 'The two changes work in opposite directions: pianos are on top of the fraction, tunings per tuner on the bottom.' },
          ],
          explain: `1,500,000 homes × 1/10 = 150,000 pianos, ÷ 2,000 = ${chiTunersAlt}. The two errors cancelled. With several rough factors, some guesses run high and some low, so the product is usually better than any single factor.`,
        },
        {
          kind: 'read',
          title: 'Orders of magnitude',
          body: 'A Fermi answer aims for the right **power of ten**. Each rung below is ten times the one before, or more. Being off by 30% hardly matters on this ladder; being off by 1,000× is a different universe.',
          widget: logLadder([
            { label: 'atom', exp: -10 }, { label: 'bacterium', exp: -6 }, { label: 'grain of sand', exp: -3 }, { label: 'person', exp: 0 },
            { label: 'Mount Everest (8.8 km)', exp: 4 }, { label: 'Earth’s diameter', exp: 7 }, { label: 'Earth to Sun', exp: 11 },
          ], 'm'),
        },
        {
          kind: 'choice', ordered: true,
          body: 'Which is closest to the number of **seconds in a year**?',
          options: [
            { text: '3 × 10⁵', why: `That’s only about ${num(3e5 / 86400, 2)} days’ worth of seconds.` },
            { text: '3 × 10⁷', correct: true },
            { text: '3 × 10⁹', why: `That’s about a century: ${num(3e9 / secYear, 2)} years.` },
            { text: '3 × 10¹¹', why: `That’s nearly ${big(Math.round(3e11 / secYear / 100) * 100)} years.` },
          ],
          hint: '60 × 60 × 24 × 365. Round each to one digit: 60 × 60 ≈ 4,000, × 24 ≈ 100,000…',
          explain: `${big(secYear)} seconds (365¼ days): about 3 × 10⁷. A handy fact: a year is roughly π × 10⁷ seconds.`,
        },
        {
          kind: 'match',
          body: 'Match each count to its nearest power of ten.',
          heads: ['Count', 'About'],
          pairs: [['Minutes in a day', '10³'], ['Hours in a year', '10⁴'], ['Heartbeats in a day (70 a minute)', '10⁵'], ['People on Earth', '10¹⁰']],
          hint: 'Minutes in a day: 24 × 60. Hours in a year: 24 × 365.',
          explain: `${big(1440)} minutes; ${big(8760)} hours; ${big(70 * 1440)} heartbeats; about 8 billion people, which is nearer 10¹⁰ than 10⁹.`,
        },
        {
          kind: 'fill',
          body: 'Fermi-estimate a family of four’s **shower water for a year**: pick a sensible value for each blank.',
          template: '4 people × [[0]] shower a day × 8 minutes × [[1]] litres a minute × 365 days ≈ [[2]] litres',
          blanks: [
            { options: ['0.01', '1', '100'], answer: 1 },
            { options: ['0.1', '10', '1,000'], answer: 1 },
            { options: ['10,000', '100,000', '10,000,000'], answer: 1 },
          ],
          hint: 'A shower head runs roughly a bucket a minute.',
          explain: `About one shower each a day; a shower head gives roughly 10 litres a minute. 4 × 1 × 8 × 10 × 365 = ${big(shower)}: about 100,000 litres.`,
        },
        {
          kind: 'number', unit: 'billion',
          body: 'A resting heart beats about 70 times a minute. How many beats in an 80-year life (use 365-day years)? Answer in **billions**.',
          answer: heartsLife / 1e9, tol: 0.15,
          hint: '70 × 60 × 24 × 365 × 80.',
          explain: `70 × 60 × 24 × 365 × 80 = ${big(heartsLife)} ≈ ${num(heartsLife / 1e9, 2)} billion beats.`,
        },
        {
          kind: 'estimate',
          body: 'Now with a method: roughly how many **golf balls fit in a school bus**? (The inside of a bus is about 10 m long, 2.5 m wide and 2 m high; a golf ball is about 4 cm across.)',
          min: 3, max: 9, step: 0.25, answer: busExp, tol: 0.5, format: fmtPow,
          hint: 'Volume of the bus ÷ volume of one ball. Treat a ball as a 4 cm cube.',
          explain: `Bus: 10 × 2.5 × 2 = ${busVol} m³. A 4 cm cube is 0.000064 m³. ${busVol} ÷ 0.000064 ≈ ${big(busBalls)}: about a million. (Seats take space and spheres pack less tightly than cubes, so the real figure is lower but the same order of magnitude.)`,
        },
        {
          kind: 'multi',
          body: 'Which are good ways to **sanity-check** a Fermi estimate? Select all that apply.',
          options: [
            { text: 'Estimate it a second way, with different factors', correct: true, why: 'Two independent routes landing close together is strong reassurance.' },
            { text: 'Check it against a hard limit (e.g. it can’t exceed the population)', correct: true, why: 'Bounds catch errors of a factor of 1,000 instantly.' },
            { text: 'Check the units cancel to what you asked for', correct: true, why: 'If tuners comes out as “tuners per day²”, a factor is upside down.' },
            { text: 'Report the answer to more decimal places', why: 'Precision isn’t accuracy: factors guessed to ±50% can’t support decimals.' },
            { text: 'Round every factor up, to be safe', why: 'Rounding all one way stops errors cancelling, and biases the answer.' },
          ],
          explain: 'A second route, a bound and a unit check all test whether the estimate could be wildly wrong. Extra digits only make it look surer than it is.',
        },
        {
          kind: 'read',
          title: 'The Fermi habit',
          body: '- Break the question into factors you can guess.\n- Round each to a power of ten or one digit.\n- Multiply; let the errors partly cancel.\n- Check with a second route or a bound.\n\nThe point is not the exact answer, but knowing whether it’s 10, 1,000 or 1,000,000 before you spend money or time finding out.',
        },
      ],
      practice: [genNearestPower, genFermiProduct, genLogEstimate],
    },

    // ============================================================ 2 Units
    {
      id: 'units',
      title: 'Units & dimensions',
      goal: 'Convert units with chains and use dimensions to catch errors and guess formulas.',
      steps: [
        {
          kind: 'choice',
          body: 'A cheetah sprints at about **30 m/s**. A car drives at **100 km/h**. Which is faster?',
          widget: () => barChart([{ label: 'cheetah', value: 30, note: 'm/s' }, { label: 'car', value: 100, note: 'km/h' }], { title: 'The raw numbers (different units!)' }),
          options: [
            { text: 'The cheetah', correct: true },
            { text: 'The car', why: '100 is bigger than 30, but the units differ: 100 km/h is only about 27.8 m/s.' },
            { text: 'Can’t compare them', why: 'You can, once both are in the same unit.' },
          ],
          hint: 'How many metres does the car go in one second?',
          explain: '100 km/h = 100,000 m in 3,600 s ≈ 27.8 m/s, a little slower than the cheetah. Numbers with different units can’t be compared directly.',
        },
        {
          kind: 'read',
          title: 'Multiply by 1',
          body: '1,000 m and 1 km are the same thing, so the fraction 1,000 m / 1 km **equals 1**. Multiplying by it changes the units, not the quantity. Units cancel like numbers: km on top cancels km below.',
          widget: unitChain([{ top: '100 [km]', bot: '[h]' }, { top: '1000 m', bot: '1 [km]' }, { top: '1 [h]', bot: '3600 s' }, { top: '27.8 m', bot: 's' }]),
        },
        {
          kind: 'fill',
          body: 'Convert **90 km/h** to m/s. Choose each factor so the unwanted unit cancels.',
          template: '90 km/h × [[0]] × [[1]] = [[2]]',
          blanks: [
            { options: ['1000 m / 1 km', '1 km / 1000 m'], answer: 0 },
            { options: ['3600 s / 1 h', '1 h / 3600 s'], answer: 1 },
            { options: ['324 m/s', '25 m/s', '1.5 m/s'], answer: 1 },
          ],
          hint: 'km is on top in 90 km/h, so the factor needs km on the bottom. h is on the bottom, so the next needs h on top.',
          explain: `90 × 1,000 ÷ 3,600 = ${90 / 3.6} m/s. Shortcut: km/h ÷ 3.6 = m/s.`,
        },
        {
          kind: 'number', unit: 'm³/h',
          body: 'A tap delivers 12 litres a minute. How many **cubic metres per hour** is that? (1 m³ = 1,000 L.)',
          widget: unitChain([{ top: '12 [L]', bot: '[min]' }, { top: '60 [min]', bot: '1 h' }, { top: '1 m³', bot: '1000 [L]' }, { top: '? m³', bot: 'h' }]),
          answer: (12 * 60) / 1000, tol: 0.005,
          hint: 'Follow the chain: × 60, then ÷ 1,000.',
          explain: `12 × 60 = 720 L an hour, ÷ 1,000 = ${(12 * 60) / 1000} m³/h.`,
        },
        {
          kind: 'read',
          title: 'Dimensions',
          body: 'Underneath every unit is a **dimension**: length (L), time (T), mass (M). Derived quantities are built from them. A newton is just a kg·m/s²; a joule is a newton times a metre.',
          widget: () => dataTable(['Quantity', 'Units', 'Dimensions'], [
            ['speed', 'm/s', 'L / T'], ['acceleration', 'm/s²', 'L / T²'], ['force', 'N = kg·m/s²', 'M·L / T²'], ['energy', 'J = kg·m²/s²', 'M·L² / T²']]),
        },
        {
          kind: 'sort',
          body: 'Sort the units by what they measure.',
          bins: ['Speed', 'Acceleration', 'Force', 'Energy'],
          items: [
            { text: 'm/s', bin: 0 }, { text: 'mph', bin: 0 }, { text: 'm/s²', bin: 1 }, { text: '(km/h) per second', bin: 1 },
            { text: 'N', bin: 2 }, { text: 'kg·m/s²', bin: 2 }, { text: 'J', bin: 3 }, { text: 'kWh', bin: 3 },
          ],
          hint: '“Per second per second” is acceleration. A kWh is power (energy per time) × time.',
          explain: 'Speed: distance per time. Acceleration: speed per time, so (km/h)/s counts. Force: mass × acceleration. Energy: J, and kWh (1 kW for 1 hour = 3.6 million J).',
        },
        {
          kind: 'choice',
          body: 'A student writes the distance a dropped stone falls as **d = g·t** (g in m/s², t in s). How can you tell it’s wrong without doing an experiment?',
          options: [
            { text: 'Its units come out as m/s, a speed, not a distance', correct: true },
            { text: 'It’s fine: it multiplies the right things', why: 'Check the units: (m/s²) × s = m/s. That’s a speed.' },
            { text: 'Its units come out as s², a time', why: 'Multiply m/s² by s: one s cancels, leaving m/s.' },
          ],
          explain: '(m/s²)·s = m/s. A formula for a distance must come out in metres. The correct one, d = ½·g·t², gives (m/s²)·s² = m. ✓',
        },
        {
          kind: 'multi',
          body: 'With v a speed, a an acceleration and t a time, which formulas could possibly give a **distance**? Select all that apply.',
          widget: () => dataTable(['Symbol', 'Units'], [['v', 'm/s'], ['a', 'm/s²'], ['t', 's']]),
          options: [
            { text: 'v · t', correct: true, why: '(m/s)·s = m.' },
            { text: '½ · a · t²', correct: true, why: '(m/s²)·s² = m. Numbers like ½ have no units.' },
            { text: 'v² / a', correct: true, why: '(m²/s²) ÷ (m/s²) = m.' },
            { text: 'v / t', why: '(m/s) ÷ s = m/s²: an acceleration.' },
            { text: 'a · t', why: '(m/s²)·s = m/s: a speed.' },
            { text: 'v · t + a', why: 'You can’t add metres to m/s²: the sum is meaningless.' },
          ],
          hint: 'Substitute units and cancel; anything you add must have the same units.',
          explain: 'Dimensional analysis can’t tell you the numbers in front (like ½), but it rules out impossible formulas instantly. All three survivors really are used for distances.',
        },
        {
          kind: 'read',
          title: 'Guessing a formula',
          body: 'What sets a pendulum’s period T (seconds)? Candidates: its length L, its mass m, and gravity g. Only m contains kilograms, so nothing could cancel them: **mass can’t appear**. To get seconds from m and m/s², divide and take a root. Units alone predict T ∝ √(L/g). The real formula is T = 2π√(L/g).',
          widget: () => dataTable(['Ingredient', 'Units'], [['length L', 'm'], ['mass m', 'kg'], ['gravity g', 'm/s²'], ['period T (wanted)', 's']], { highlight: [3] }),
        },
        {
          kind: 'choice',
          body: 'Which combination of L (m) and g (m/s²) has the units of **seconds**?',
          options: [
            { text: '√(L / g)', correct: true },
            { text: 'L / g', why: 'm ÷ (m/s²) = s². Close: take the square root.' },
            { text: '√(g / L)', why: '(m/s²) ÷ m = 1/s², whose root is 1/s: a frequency, not a time.' },
            { text: 'L · g', why: 'm·m/s² = m²/s²: the square of a speed.' },
          ],
          explain: 'L/g has units m ÷ (m/s²) = s², so √(L/g) is in seconds. We’ll test this pendulum formula in the Waves lesson.',
        },
        {
          kind: 'match',
          body: 'Match each unit to the quantity it measures.',
          heads: ['Units', 'Quantity'],
          pairs: [['kg·m/s²', 'Force'], ['kg·m²/s²', 'Energy'], ['kg/m³', 'Density'], ['1/s', 'Frequency']],
          hint: 'Force = mass × acceleration; energy = force × distance.',
          explain: 'Force: kg × m/s². Energy: force × metres. Density: mass per volume. Frequency: how many per second (hertz).',
        },
        {
          kind: 'number', unit: 'minutes',
          body: 'Light travels at 3.0 × 10⁸ m/s, and the Sun is 1.5 × 10¹¹ m away. How many **minutes** does sunlight take to reach us?',
          answer: 1.5e11 / 3e8 / 60, tol: 0.1,
          hint: 'time = distance ÷ speed gives seconds; then ÷ 60.',
          explain: `1.5 × 10¹¹ ÷ 3.0 × 10⁸ = ${1.5e11 / 3e8} s, ÷ 60 ≈ ${num(1.5e11 / 3e8 / 60, 3)} minutes.`,
        },
      ],
      practice: [genSpeedConvert, genDimFormula, genUnitFill],
    },

    // ============================================================ 3 Motion graphs
    {
      id: 'motion',
      title: 'Motion graphs',
      goal: 'Read speed as slope and distance as area.',
      steps: [
        {
          kind: 'choice',
          body: 'This position-time graph shows a cyclist on a straight road. What is the cyclist doing between **t = 4 s and t = 7 s**?',
          widget: P({ x: [0, 10], y: [0, 50], xlabel: 'time (s)', ylabel: 'position (m)', layers: [{ type: 'line', pts: CYC, color: 'var(--c1)' }] }),
          options: [
            { text: 'Stopped', correct: true },
            { text: 'Riding at a steady speed', why: 'Steady speed would be a sloping straight line. Flat means the position isn’t changing.' },
            { text: 'Riding back toward the start', why: 'That would make the line slope down: position decreasing.' },
          ],
          explain: 'Position stays at 20 m for those 3 seconds: the cyclist is standing still.',
        },
        {
          kind: 'read',
          title: 'Slope is speed',
          body: 'Press Play. The graph traces the cyclist’s position over time. Where the line is **steep**, the cyclist covers many metres per second; where it is **flat**, none.',
          widget: motionTrack(cycX, 10, { xmax: 50 }),
        },
        {
          kind: 'number', unit: 'm/s',
          body: 'What is the cyclist’s speed during the first 4 seconds?',
          widget: P({ x: [0, 10], y: [0, 50], xlabel: 'time (s)', ylabel: 'position (m)', layers: [{ type: 'line', pts: CYC, color: 'var(--c1)' }, { type: 'dots', pts: [[4, 20]], labels: ['(4, 20)'], color: 'var(--c2)' }] }),
          answer: 20 / 4, tol: 0.01,
          hint: 'Slope = rise ÷ run = change in position ÷ change in time.',
          explain: '20 m in 4 s: 20 ÷ 4 = 5 m/s.',
        },
        {
          kind: 'choice',
          body: 'During which stretch is the cyclist **fastest**?',
          widget: P({ x: [0, 10], y: [0, 50], xlabel: 'time (s)', ylabel: 'position (m)', layers: [{ type: 'line', pts: CYC, color: 'var(--c1)' }, { type: 'dots', pts: CYC, color: 'var(--c2)' }] }),
          options: [
            { text: '0 to 4 s', why: 'It covers 20 m, but over 4 s: 5 m/s. Speed is the slope, not how far the line has climbed.' },
            { text: '4 to 7 s', why: 'Flat: stopped.' },
            { text: '7 to 10 s', correct: true },
          ],
          explain: `From 7 to 10 s it goes from 20 m to 44 m: 24 m in 3 s = ${24 / 3} m/s, the steepest part.`,
        },
        {
          kind: 'point',
          body: 'A ball rolls up a ramp, slows, and rolls back. Its position up the ramp is graphed. **Tap the point** where it is farthest up the ramp.',
          plot: { x: [0, 12], y: [0, 14], xlabel: 'time (s)', ylabel: 'position (m)', ticks: [1, 2], size: SZ, layers: [{ type: 'fn', f: ramp, color: 'var(--c1)' }] },
          answer: { x: 6, y: ramp(6) }, tol: 0.75, snap: 0.5,
          hint: 'The highest point of the curve.',
          explain: 'At t = 6 s it’s 12 m up. There the curve is momentarily flat: slope zero, so the ball is stopped for an instant before rolling back.',
        },
        {
          kind: 'read',
          title: 'The velocity-time graph',
          body: 'A car speeds up for 5 s, then cruises. Under the position graph is its **velocity** graph. The height of the v-t graph at each moment is the slope of the x-t graph: as the curve steepens, velocity rises; once it’s straight, velocity is flat.',
          widget: motionTrack(carX, 10, { xmax: 80, v: carV, vmax: 12 }),
        },
        {
          kind: 'choice',
          body: 'On a **velocity**-time graph, an object’s line is flat at 3 m/s. What is it doing?',
          widget: P({ x: [0, 10], y: [0, 5], xlabel: 'time (s)', ylabel: 'velocity (m/s)', layers: [{ type: 'hline', y: 3, color: 'var(--c3)', dash: false }] }),
          options: [
            { text: 'Moving at a steady 3 m/s', correct: true },
            { text: 'Standing still', why: 'That’s what a flat line means on a position graph. Here the flat line is the velocity: it stays at 3 m/s.' },
            { text: 'Speeding up', why: 'Speeding up would make the velocity line slope upward.' },
          ],
          explain: 'Always read the axis label first. Flat on v-t means constant velocity; flat on x-t means stopped.',
        },
        {
          kind: 'match',
          body: 'Match each **position-time** graph to its story.',
          widget: miniGraphs([
            { label: 'A', f: (t) => 2 * t }, { label: 'B', f: () => 10 },
            { label: 'C', f: (t) => 0.2 * t * t }, { label: 'D', f: (t) => 20 - 2 * t }], { y: [0, 22], ylabel: 'x' }),
          heads: ['Graph', 'Story'],
          pairs: [['A', 'Walking steadily away'], ['B', 'Standing still'], ['C', 'Speeding up, away from the start'], ['D', 'Walking steadily back to the start']],
          hint: 'Straight = steady speed; curving steeper = speeding up; sloping down = coming back.',
          explain: 'A: straight and rising, steady speed away. B: flat, no motion. C: steepening, speeding up. D: straight and falling, steady speed back.',
        },
        {
          kind: 'read',
          title: 'Area is distance',
          body: 'At a steady 10 m/s for 3 s you go 30 m: a rectangle 10 high and 3 wide. That holds piece by piece for any v-t graph: **the area under it is the distance**. Drag the time and watch the shaded area match the distance covered.',
          widget: plotExplorer({
            params: [{ id: 't', label: 'time', min: 0, max: 10, step: 0.5, value: 4, format: (v) => `${v} s` }],
            spec: (v) => ({ x: [0, 10], y: [0, 12], size: SZ, xlabel: 'time (s)', ylabel: 'velocity (m/s)', layers: [
              { type: 'area', f: carV, from: 0, to: Math.max(v.t, 1e-6), color: 'var(--c3)' },
              { type: 'fn', f: carV, color: 'var(--c1)' }, { type: 'vline', x: v.t, color: 'var(--c2)' }] }),
            readout: (v) => `shaded area = distance = ${num(carX(v.t))} m`,
          }),
        },
        {
          kind: 'number', unit: 'm',
          body: 'A car speeds up steadily from 0 to 20 m/s in 8 s. How far does it travel in those 8 s?',
          widget: P({ x: [0, 10], y: [0, 24], xlabel: 'time (s)', ylabel: 'velocity (m/s)', layers: [
            { type: 'area', f: (t) => 2.5 * t, from: 0, to: 8, color: 'var(--c3)' }, { type: 'line', pts: [[0, 0], [8, 20]], color: 'var(--c1)' }] }),
          answer: 0.5 * 8 * 20, tol: 0.1,
          hint: 'The shaded region is a triangle: ½ × base × height.',
          explain: '½ × 8 s × 20 m/s = 80 m. (Its average speed was 10 m/s, for 8 s.)',
        },
        {
          kind: 'task',
          body: 'Set the walker’s **starting position** and **speed** so the position-time line passes through both measured dots.',
          widget: plotExplorer({
            params: [
              { id: 'x0', label: 'start', min: 0, max: 20, step: 1, value: 0, format: (v) => `${v} m` },
              { id: 'v', label: 'speed', min: -5, max: 5, step: 0.5, value: 1, format: (v) => `${v} m/s` },
            ],
            spec: (v) => ({ x: [0, 10], y: [0, 40], size: SZ, xlabel: 'time (s)', ylabel: 'position (m)', layers: [
              { type: 'fn', f: (t) => v.x0 + v.v * t, color: 'var(--c1)' }, { type: 'dots', pts: [[2, 10], [6, 22]], color: 'var(--c2)', r: 6 }] }),
            readout: (v) => `x = ${v.x0} + ${v.v}·t`,
            goal: (v) => v.x0 + v.v * 2 === 10 && v.x0 + v.v * 6 === 22,
            goalText: 'Through both dots: 3 m/s from 4 m.',
          }),
          hint: 'The slope between the dots is the speed: (22 − 10) ÷ (6 − 2).',
          explain: 'Speed = 12 m ÷ 4 s = 3 m/s. Going back 2 s from (2, 10) gives 10 − 6 = 4 m at t = 0. The slope is the speed and the intercept is where it started.',
        },
        {
          kind: 'sort',
          body: 'Sort each graph description by what the object is doing.',
          bins: ['Speeding up', 'Steady speed', 'Slowing down'],
          items: [
            { text: 'v-t line rising away from zero', bin: 0 }, { text: 'x-t curve getting steeper', bin: 0 },
            { text: 'x-t straight sloping line', bin: 1 }, { text: 'v-t flat line at 4 m/s', bin: 1 },
            { text: 'v-t line falling toward zero', bin: 2 }, { text: 'x-t curve flattening out', bin: 2 },
          ],
          hint: 'On x-t look at how the slope changes; on v-t look at the height.',
          explain: 'On a v-t graph the height is the speed. On an x-t graph the slope is the speed, so steepening = faster, flattening = slower.',
        },
        {
          kind: 'point',
          body: 'A car brakes: its velocity falls steadily as shown. **Tap the time axis** at the moment it stops.',
          widget: P({ x: [0, 8], y: [0, 16], xlabel: 'time (s)', ylabel: 'velocity (m/s)', layers: [{ type: 'fn', f: (t) => Math.max(0, 15 - 3 * t), color: 'var(--c1)' }] }),
          plot: { x: [0, 8], ticks: [1], xlabel: 'time (s)', size: [360, 80] },
          answer: { x: 15 / 3 }, tol: 0.25, snap: 0.25,
          hint: 'Stopped means velocity zero.',
          explain: 'It loses 3 m/s each second from 15 m/s: 15 ÷ 3 = 5 s.',
        },
        {
          kind: 'fill',
          body: 'Complete the rules of motion graphs.',
          template: 'The slope of an x-t graph is the [[0]]. The area under a v-t graph is the [[1]]. The slope of a v-t graph is the [[2]].',
          blanks: [
            { options: ['velocity', 'distance', 'acceleration'], answer: 0 },
            { options: ['velocity', 'distance', 'acceleration'], answer: 1 },
            { options: ['velocity', 'distance', 'acceleration'], answer: 2 },
          ],
          explain: 'Slope = rate of change: position changes at the velocity, velocity changes at the acceleration. Area undoes slope: summing velocity × time gives distance.',
        },
      ],
      practice: [genSlope, genArea, genStopPoint],
    },

    // ============================================================ 4 Forces
    {
      id: 'forces',
      title: 'Forces & Newton’s laws',
      goal: 'Predict motion from forces: inertia, F = ma, balance, and free fall.',
      steps: [
        {
          kind: 'choice',
          body: 'A hockey puck slides across **perfectly frictionless** ice. Nothing pushes or pulls it sideways. What happens?',
          options: [
            { text: 'It keeps going at the same speed in a straight line', correct: true },
            { text: 'It gradually slows and stops', why: 'Real pucks slow because of friction and air. With no sideways force at all, nothing changes its motion.' },
            { text: 'It slows only if it was pushed gently', why: 'However it was set moving, without a force its velocity stays the same.' },
          ],
          explain: 'Newton’s first law: without a net force, velocity doesn’t change. Moving things don’t “run out” of motion; forces like friction take it away.',
        },
        {
          kind: 'read',
          title: 'Inertia',
          body: 'Two pucks get the same shove. On ice, the dots stay evenly spaced: constant speed. On carpet, friction pulls back, so the gaps shrink until it stops. Motion doesn’t need a force; **changing** motion does.',
          widget: puckSlide(),
        },
        {
          kind: 'read',
          title: 'F = m a',
          body: 'Newton’s second law: the **net force** sets the acceleration, a = F ÷ m. Double the push, double the acceleration; double the mass, half the acceleration. Try it.',
          widget: fmaExplorer(),
        },
        {
          kind: 'number', unit: 'N',
          body: 'A 1,200 kg car speeds up at 2.5 m/s². What net force is acting on it?',
          answer: 1200 * 2.5, tol: 1,
          hint: 'F = m × a.',
          explain: '1,200 × 2.5 = 3,000 N (newtons: 1 N = 1 kg·m/s²).',
        },
        {
          kind: 'choice',
          body: 'A lift moves **upward at a constant speed**. How does the cable’s pull compare with the lift’s weight?',
          widget: freeBody([{ dir: 'up', size: 10, label: 'cable', color: 'var(--c1)' }, { dir: 'down', size: 10, label: 'weight', color: 'var(--c2)' }]),
          options: [
            { text: 'Equal', correct: true },
            { text: 'Greater: it’s going up', why: 'A bigger pull would make it speed up. Constant velocity needs zero net force, whichever way it moves.' },
            { text: 'Less', why: 'Then the net force would be downward and the lift would slow down.' },
          ],
          explain: 'Constant velocity ⇒ zero acceleration ⇒ forces balance. The pull only exceeds the weight briefly while the lift speeds up.',
        },
        {
          kind: 'multi',
          body: 'In which situations is the **net force zero**? Select all that apply.',
          options: NETPOOL.slice(0, 7).map((p) => (p.zero ? { text: p.t, correct: true, why: p.why } : { text: p.t, why: p.why })),
          hint: 'Zero net force ⇔ not speeding up, slowing down or turning.',
          explain: 'Balanced forces mean constant velocity: steady speed in a straight line, or at rest. Turning and the top of a throw are both accelerations.',
        },
        {
          kind: 'sort',
          body: 'A box is pushed across the floor to the right at constant speed. Sort the forces on the box by direction.',
          bins: ['Up', 'Down', 'Right (forward)', 'Left (backward)'],
          items: [
            { text: 'Gravity (weight)', bin: 1 }, { text: 'Floor pushing back (normal force)', bin: 0 },
            { text: 'The push from your hands', bin: 2 }, { text: 'Friction from the floor', bin: 3 }, { text: 'Air resistance', bin: 3 },
          ],
          hint: 'Friction and air resistance always oppose the motion.',
          explain: 'Weight pulls down; the floor pushes up equally. Your push is forward; friction and air resistance act backward and, at constant speed, add up to your push.',
        },
        {
          kind: 'read',
          title: 'Heavier falls faster?',
          body: 'Drop a 1 kg and a 10 kg ball together (ignore air). The 10 kg ball is pulled 10× harder, but it also has 10× the inertia. a = F ÷ m = mg ÷ m = **g** for both: they fall side by side. Galileo argued this; astronaut David Scott showed it with a hammer and a feather on the Moon.',
          widget: fallRace(),
        },
        {
          kind: 'choice',
          body: 'A 7 kg bowling ball and a 0.06 kg tennis ball are dropped together from 2 m. Air resistance is negligible at these speeds. Which lands first?',
          options: [
            { text: 'They land together', correct: true },
            { text: 'The bowling ball', why: 'Its weight is about 100× bigger, but so is its mass: the acceleration, weight ÷ mass, is the same 9.8 m/s².' },
            { text: 'The tennis ball', why: 'Lighter things aren’t quicker either: both accelerate at g.' },
          ],
          explain: `Same acceleration, same start, so the same time: √(2 × 2 ÷ 9.8) ≈ ${num(Math.sqrt(4 / G), 2)} s for both.`,
        },
        {
          kind: 'read',
          title: 'Where air matters',
          body: 'On Earth a feather does drift down: air resistance grows with speed and soon matches its tiny weight, so it stops speeding up (terminal speed). A ball’s weight is huge compared with the air drag at these speeds, so it hardly notices. The difference is the air, not the mass itself.',
          widget: fallRace({ air: true }),
        },
        {
          kind: 'number', unit: 'm',
          body: 'A stone is dropped from rest. Ignoring air, how far does it fall in **2 seconds**?',
          answer: 0.5 * G * 4, tol: 0.05,
          hint: 'd = ½ g t².',
          explain: `½ × 9.8 × 2² = ${num(0.5 * G * 4)} m. Its speed by then is 9.8 × 2 = ${num(G * 2)} m/s.`,
        },
        {
          kind: 'fill',
          body: 'Weight and mass are different things. Complete the sentences (g = 9.8 m/s²).',
          template: 'A 5 kg ball weighs [[0]]. Dropped, it accelerates at [[1]]. A 10 kg ball dropped beside it accelerates at [[2]].',
          blanks: [
            { options: ['5 N', '49 N', '0.5 N'], answer: 1 },
            { options: ['9.8 m/s²', '49 m/s²', '0.98 m/s²'], answer: 0 },
            { options: ['19.6 m/s²', '4.9 m/s²', '9.8 m/s²'], answer: 2 },
          ],
          explain: `Weight = m g = 5 × 9.8 = ${5 * G} N: a force. Mass is the amount of stuff (kg). Every dropped object, whatever its mass, accelerates at g without air.`,
        },
        {
          kind: 'task',
          body: 'Gravity pulls only **down**, so a launched ball keeps its sideways speed while it falls. Choose the launch **speed** and **angle** so the ball lands on the target 20 m away (ignore air).',
          widget: plotExplorer({
            params: [
              { id: 'v', label: 'speed', min: 5, max: 25, step: 1, value: 10, format: (v) => `${v} m/s` },
              { id: 'a', label: 'angle', min: 15, max: 75, step: 5, value: 30, format: (v) => `${v}°` },
            ],
            spec: (v) => {
              const p = proj(v.v, v.a);
              const layers: Layer[] = [
                { type: 'fn', f: p.y, from: 0, to: p.R, color: 'var(--c1)' },
                { type: 'line', pts: [[19, 0], [21, 0]], color: 'var(--c3)', width: 8 },
                { type: 'text', x: 20, y: 1.8, text: 'target', color: 'var(--c3)' },
              ];
              return { x: [0, 65], y: [0, 30], size: SZ, xlabel: 'distance (m)', ylabel: 'height (m)', layers };
            },
            readout: (v) => `lands at ${proj(v.v, v.a).R.toFixed(1)} m`,
            goal: (v) => Math.abs(proj(v.v, v.a).R - 20) <= 0.6,
            goalText: 'Bullseye.',
          }),
          hint: 'At 45° the range is v² ÷ g. Which speed gives 20 m?',
          explain: 'Range = v² sin(2θ) ÷ g. At 45°, 14 m/s gives 14² ÷ 9.8 = 20 m exactly. Other pairs work too: 30° and 60° give the same range for the same speed.',
        },
      ],
      practice: [genFma, genFall, genNetZero],
    },

    // ============================================================ 5 Energy
    {
      id: 'energy',
      title: 'Energy',
      goal: 'Track energy between motion and height, and see why speed is so costly.',
      steps: [
        {
          kind: 'choice', ordered: true,
          body: 'Braking hard from **50 km/h**, a car stops in about 14 m (not counting reaction time). With the same brakes from **100 km/h**, it stops in about…',
          options: [
            { text: `${2 * 14} m`, why: 'Twice the speed, but not twice the distance: braking must remove the kinetic energy, which grows with speed squared.' },
            { text: `${3 * 14} m`, why: 'Distance grows faster than that: with v², double speed means four times the distance.' },
            { text: `${Math.round(brake(100))} m`, correct: true },
          ],
          explain: `(100/50)² = 4, so 4 × 14 = ${Math.round(brake(100))} m. Kinetic energy is ½mv²: double the speed, four times the energy for the brakes to remove.`,
        },
        {
          kind: 'read',
          title: 'Kinetic energy: ½ m v²',
          body: 'Brakes turn motion energy into heat at a roughly steady rate per metre, so the braking distance follows the energy, ∝ v². Slide the speed: from 50 to 100 km/h the curve climbs four times as high.',
          widget: brakingExplorer(DECEL),
        },
        {
          kind: 'number', unit: 'kJ',
          body: 'What is the kinetic energy of a 1,000 kg car at 20 m/s? Answer in **kilojoules**.',
          answer: (0.5 * 1000 * 20 * 20) / 1000, tol: 0.5,
          hint: 'KE = ½ m v², in joules; ÷ 1,000 for kJ.',
          explain: '½ × 1,000 × 20² = 200,000 J = 200 kJ.',
        },
        {
          kind: 'choice', ordered: true,
          body: 'You **triple** your speed. Your kinetic energy is multiplied by…',
          options: [
            { text: '3', why: 'KE isn’t proportional to speed; it’s proportional to speed squared.' },
            { text: '6', why: 'That’s 3 × 2. The 2 in v² is a power: 3² = 9.' },
            { text: '9', correct: true },
            { text: '27', why: 'That would be v³. Kinetic energy goes with v².' },
          ],
          explain: '½m(3v)² = 9 × ½mv².',
        },
        {
          kind: 'read',
          title: 'Height is stored energy',
          body: 'Lifting something a height h stores **potential energy** m g h. On a frictionless coaster that starts at rest at the top, the total never changes: as the car drops, potential turns into kinetic, and back again on the climbs. Drag the car along.',
          widget: coaster(),
        },
        {
          kind: 'task',
          body: 'Move the car to a spot where its **kinetic energy equals its potential energy** (heights measured from the ground; start: 40 m, at rest).',
          widget: coaster((y) => Math.abs(y - 20) <= 1, 'KE ≈ PE: halfway down in height.'),
          hint: 'Total energy is m g × 40 m. Half of it is potential at what height?',
          explain: 'Total = mg·40. PE = KE means each is mg·20, so the car is at a height of 20 m, wherever that happens on the track (there are several such spots).',
        },
        {
          kind: 'number', unit: 'm/s',
          body: 'A 2 kg ball is dropped from 5 m. Ignoring air, how fast is it moving just before it hits the ground?',
          answer: Math.sqrt(2 * G * 5), tol: 0.05,
          hint: 'm g h = ½ m v². The mass cancels.',
          explain: `v = √(2gh) = √(2 × 9.8 × 5) = √98 ≈ ${num(Math.sqrt(98), 3)} m/s. A 20 kg ball would hit at the same speed.`,
        },
        {
          kind: 'choice',
          body: 'A frictionless coaster car starts **at rest at 40 m**. Further along there’s a hill **45 m** high. Does it get over?',
          options: [
            { text: 'No: it would need more energy than it started with', correct: true },
            { text: 'Yes, if it picks up enough speed on the way down', why: 'Every bit of speed was bought with height. It can climb back to 40 m at most, then rolls back.' },
            { text: 'Yes, if the car is heavy enough', why: 'Mass cancels: m g h on both sides. A heavier car reaches the same height.' },
          ],
          explain: 'Starting energy is mg·40. Reaching 45 m needs mg·45, which it doesn’t have. A real coaster’s first hill is its tallest for this reason.',
        },
        {
          kind: 'sort',
          body: 'Heights measured from the ground. Sort by the kind of energy each has (ignore heat and sound).',
          bins: ['All kinetic', 'All potential', 'Some of each'],
          items: [
            { text: 'A bowling ball rolling along the floor', bin: 0 }, { text: 'A puck sliding on ice', bin: 0 },
            { text: 'A boulder resting on a cliff edge', bin: 1 }, { text: 'A ball thrown straight up, at its highest point', bin: 1 },
            { text: 'A drawn bow, arrow not yet released', bin: 1 },
            { text: 'A diver halfway down to the pool', bin: 2 },
          ],
          hint: 'Moving: kinetic. Raised up or stretched: potential.',
          explain: 'Floor-level movers have only KE. Things at rest but high (or stretched, like the bow: elastic potential) have only PE. The diver is both high and moving.',
        },
        {
          kind: 'multi',
          body: 'Which changes would exactly **double** a car’s kinetic energy? Select all that apply.',
          options: [
            { text: 'Double its mass', correct: true, why: 'KE ∝ m.' },
            { text: 'Multiply its speed by √2 ≈ 1.41', correct: true, why: '(√2)² = 2.' },
            { text: 'Halve its mass and double its speed', correct: true, why: '½ × 2² = 2.' },
            { text: 'Double its speed', why: '2² = 4: four times the energy.' },
            { text: 'Double both mass and speed', why: '2 × 2² = 8 times the energy.' },
          ],
          hint: 'KE ∝ m × v².',
          explain: 'Multiply m by a and v by b and KE multiplies by a·b². Doubling needs a·b² = 2.',
        },
        {
          kind: 'fill',
          body: 'Complete the energy argument for a falling ball.',
          template: 'It loses potential energy m·g·[[0]] and gains kinetic energy ½·m·[[1]]. Setting them equal, its speed is v = [[2]].',
          blanks: [
            { options: ['t', 'h', 'v'], answer: 1 },
            { options: ['v²', 'v', 'h²'], answer: 0 },
            { options: ['2gh', '√(gh)', '√(2gh)'], answer: 2 },
          ],
          explain: 'mgh = ½mv² ⇒ v² = 2gh ⇒ v = √(2gh). The mass is on both sides and cancels.',
        },
        {
          kind: 'estimate',
          body: 'A crash at **100 km/h** carries the same energy as a fall from what height?',
          min: 0, max: 100, step: 1, answer: Math.round(dropH100), tol: 4, format: (v) => `${v} m`,
          hint: 'h = v² ÷ (2g), with v in m/s (100 km/h ≈ 27.8 m/s).',
          explain: `h = 27.8² ÷ 19.6 ≈ ${num(dropH100, 3)} m: like driving off a 13-storey building. At 50 km/h it’s a quarter of that, about ${num(dropH100 / 4, 2)} m.`,
        },
        {
          kind: 'read',
          title: 'Energy is conserved',
          body: 'On a real coaster, friction and air turn some energy into heat and sound each second, so the car can’t quite climb back to its start. The energy isn’t destroyed; it changes form. Tracking where it goes lets you skip the details of the path: only the start and end heights and speeds matter.',
        },
      ],
      practice: [genKE, genDrop, genStopScale],
    },

    // ============================================================ 6 Waves
    {
      id: 'waves',
      title: 'Waves & oscillations',
      goal: 'Use period, frequency and wavelength, and know what sets a pendulum’s beat.',
      steps: [
        {
          kind: 'choice',
          body: 'Two pendulums have the **same length**. One bob is 1 kg, the other 4 kg. Pulled back a little and released together, which completes a swing first?',
          options: [
            { text: 'Neither: they keep time together', correct: true },
            { text: 'The 4 kg one', why: 'It’s pulled harder by gravity, but it also has 4× the inertia. As with falling, these cancel.' },
            { text: 'The 1 kg one', why: 'Lighter doesn’t mean quicker: mass cancels out of the motion.' },
          ],
          explain: 'A simple pendulum’s period depends on its length and on g, not on its mass. (Dimensional analysis already told us mass couldn’t appear.)',
        },
        {
          kind: 'read',
          title: 'A pendulum clock',
          body: 'This pendulum swings in real time. Change the mass: nothing. Change the length: longer swings more slowly. The time for one full swing, there and back, is the **period** T = 2π√(L/g).',
          widget: pendulum(),
        },
        {
          kind: 'read',
          title: 'Period and frequency',
          body: 'Anything that repeats has a **period** T (seconds per cycle) and a **frequency** f (cycles per second, hertz). They’re reciprocals: f = 1/T. A 2 s period is a frequency of 0.5 Hz.',
          widget: P({ x: [0, 6], y: [-1.6, 1.6], xlabel: 'time (s)', ylabel: 'displacement', ticks: [1, 1], layers: [
            { type: 'fn', f: (t) => Math.sin(Math.PI * t), color: 'var(--c1)', width: 3 },
            { type: 'arrow', from: [0.5, 1.3], to: [2.5, 1.3], color: 'var(--c2)', label: 'T = 2 s' }] }),
        },
        {
          kind: 'number', unit: 'Hz',
          body: 'A pendulum makes 30 full swings in 60 seconds. What is its **frequency**?',
          answer: 30 / 60, tol: 0.005,
          hint: 'Cycles ÷ seconds.',
          explain: '30 ÷ 60 = 0.5 Hz. Its period is the reciprocal: 2 s.',
        },
        {
          kind: 'task',
          body: 'Set the pendulum’s length so its period is **2.00 s** (within 0.02 s). Clockmakers did exactly this.',
          widget: pendulum((T) => Math.abs(T - 2) <= 0.02, 'A seconds pendulum: each one-way swing takes 1 s.'),
          hint: 'Try about a metre. Mass won’t help.',
          explain: `T = 2 s needs L = g ÷ π² ≈ ${num(L2s, 3)} m. That’s why a “seconds pendulum” is just under a metre long.`,
        },
        {
          kind: 'choice', ordered: true,
          body: 'To **double** a pendulum’s period, multiply its length by…',
          options: [
            { text: '√2', why: 'That would multiply the period by only 2^¼ ≈ 1.19.' },
            { text: '2', why: 'Period grows with the square root of length: doubling L multiplies T by √2 ≈ 1.41.' },
            { text: '4', correct: true },
            { text: '8', why: 'That overshoots: √8 ≈ 2.83.' },
          ],
          explain: 'T ∝ √L, so 2× the period needs 2² = 4× the length.',
        },
        {
          kind: 'read',
          title: 'Travelling waves',
          body: 'A wave carries a pattern, not stuff. Press Play: the crest moves along, but the buoy only bobs up and down in place. In one period, the pattern moves one **wavelength** λ. So its speed is **v = f λ**.',
          widget: waveStepper(1, 2),
        },
        {
          kind: 'read',
          title: 'v = f λ',
          body: 'Play with frequency and wavelength. In a given medium the speed is fixed (sound in air ≈ 343 m/s at 20 °C), so higher frequency means shorter wavelength.',
          widget: waveExplorer(),
        },
        {
          kind: 'fill',
          body: 'Use v = f λ.',
          template: 'A wave with f = 5 Hz and λ = 2 m travels at [[0]]. In the same medium (same speed) at twice the frequency, its wavelength is [[1]].',
          blanks: [
            { options: ['2.5 m/s', '10 m/s', '7 m/s'], answer: 1 },
            { options: ['4 m', '2 m', '1 m'], answer: 2 },
          ],
          explain: '5 × 2 = 10 m/s. Speed fixed, f doubled ⇒ λ halves: 10 ÷ 10 = 1 m.',
        },
        {
          kind: 'number', unit: 'm',
          body: 'Sound travels at 343 m/s in air (20 °C). What is the wavelength of the note A at **440 Hz**?',
          answer: lam440, tol: 0.005,
          hint: 'λ = v ÷ f.',
          explain: `343 ÷ 440 ≈ ${num(lam440, 3)} m: about 78 cm.`,
        },
        {
          kind: 'point',
          body: 'This graph shows a vibrating spring’s displacement over time. **Tap the point** where the first full cycle ends.',
          plot: { x: [0, 4], y: [-1.5, 1.5], xlabel: 'time (s)', ylabel: 'displacement', ticks: [0.4, 0.5], size: SZ, layers: [{ type: 'fn', f: (t) => Math.sin((2 * Math.PI * t) / 1.6), color: 'var(--c1)', width: 3 }] },
          answer: { x: 1.6, y: 0 }, tol: 0.15, snap: 0.05,
          hint: 'A full cycle: up, back through zero, down, and back to zero going up again.',
          explain: 'The motion repeats from t = 1.6 s, so the period is 1.6 s. (At 0.8 s it’s back at zero but moving down: only half a cycle.)',
        },
        {
          kind: 'match',
          body: 'Match each wave word to its meaning.',
          heads: ['Word', 'Meaning'],
          pairs: [['Period', 'Seconds per cycle'], ['Frequency', 'Cycles per second (Hz)'], ['Wavelength', 'Distance between crests'], ['Amplitude', 'Biggest displacement from rest']],
          explain: 'Period and frequency describe time; wavelength describes space; amplitude, how big the swing is (it doesn’t affect a pendulum’s period for small swings).',
        },
        {
          kind: 'multi',
          body: 'Which would change a simple pendulum’s period (small swings)? Select all that apply.',
          options: [
            { text: 'A longer string', correct: true, why: 'T ∝ √L.' },
            { text: 'A shorter string', correct: true, why: 'Shorter swings faster.' },
            { text: 'Taking it to the Moon', correct: true, why: 'Weaker gravity (1.6 m/s²): T ∝ 1/√g, so about 2.5× slower.' },
            { text: 'A heavier bob', why: 'Mass cancels: more weight, but more inertia too.' },
            { text: 'Pulling it back 5° instead of 10°', why: 'For small swings the period barely depends on the amplitude. That’s what made pendulum clocks accurate.' },
          ],
          explain: 'T = 2π√(L/g): only length and gravity matter (for small angles).',
        },
        {
          kind: 'estimate',
          body: 'Roughly what is the period of a **10 m** pendulum, like a giant rope swing?',
          min: 0, max: 15, step: 0.1, answer: Math.round(T10 * 10) / 10, tol: 0.4, format: (v) => `${v.toFixed(1)} s`,
          hint: 'A 1 m pendulum takes 2 s. Ten times the length is √10 ≈ 3.2 times the period.',
          explain: `2π√(10 ÷ 9.8) ≈ ${num(T10, 3)} s, about √10 × 2 s.`,
        },
      ],
      practice: [genPeriod, genWave, genLengthScale],
    },

    // ============================================================ 7 Experiments
    {
      id: 'experiments',
      title: 'Experiments & controls',
      goal: 'Design a fair test: controls, placebos, randomization, blinding and enough data.',
      steps: [
        {
          kind: 'choice',
          body: 'A school gives every student a new “focus drink” before exams. Average scores are 8 points higher than last year. Does the drink work?',
          options: [
            { text: 'Can’t tell: there’s nothing to compare against this year', correct: true },
            { text: 'Yes: scores went up', why: 'Many things changed since last year: different students, teachers, exams. Without a no-drink group this year, the drink can’t be separated from those.' },
            { text: 'No: 8 points is too small to matter', why: 'The size isn’t the problem; the design is. Even a big rise would be uninterpretable.' },
          ],
          explain: 'To see what a cause does, compare with a group that didn’t get it, under the same conditions, at the same time.',
        },
        {
          kind: 'read',
          title: 'Three kinds of variable',
          body: 'An experiment changes **one** thing on purpose (the independent variable), measures the effect (the dependent variable), and keeps everything else the same (controlled variables). Then only the change you made can explain a difference.',
          widget: () => dataTable(['Pot', 'Fertilizer (changed)', 'Water', 'Light', 'Height (measured)'], [
            ['A', '0 g', '200 ml', '8 h', '?'], ['B', '5 g', '200 ml', '8 h', '?'], ['C', '10 g', '200 ml', '8 h', '?']], { highlight: [1] }),
        },
        {
          kind: 'sort',
          body: 'Experiment: *Does the amount of fertilizer affect how tall tomato plants grow?* Sort the variables.',
          bins: ['Independent (changed)', 'Dependent (measured)', 'Controlled (kept the same)'],
          items: [
            { text: 'Grams of fertilizer', bin: 0 }, { text: 'Plant height after 6 weeks', bin: 1 },
            { text: 'Water per day', bin: 2 }, { text: 'Pot size', bin: 2 }, { text: 'Hours of light', bin: 2 }, { text: 'Tomato variety', bin: 2 },
          ],
          hint: 'What does the gardener choose? What does she measure? What would spoil the comparison if it varied?',
          explain: 'Fertilizer is what you vary; height is what you measure. Water, pot, light and variety could all change height, so they must be held equal.',
        },
        {
          kind: 'multi',
          body: 'Ana wants to know if her new paper-plane design flies farther than her old one. Which would make it a **fair test**? Select all that apply.',
          options: [
            { text: 'Fold both from the same kind of paper', correct: true, why: 'Paper weight could change the distance, so keep it the same.' },
            { text: 'Launch both with the same rubber-band launcher', correct: true, why: 'Removes differences in throwing strength.' },
            { text: 'Fly each 10 times and compare the averages', correct: true, why: 'One flight can be a fluke; averages smooth out chance.' },
            { text: 'Fly the new one outdoors and the old one indoors', why: 'Wind and space now differ: you can’t tell the design from the setting.' },
            { text: 'Let her friend throw the new one and her throw the old one', why: 'Different throwers add a second difference besides the design.' },
          ],
          explain: 'Change only the design; hold everything else fixed; repeat to beat chance.',
        },
        {
          kind: 'read',
          title: 'Control groups and placebos',
          body: 'People often get better on their own, and **expecting** to get better can help too (the placebo effect). So a drug trial compares the drug with a dummy pill that looks identical. In this illustrative trial, crediting the drug with all 35 points would be badly wrong.',
          widget: () => barChart([
            { label: 'No pill', value: 10, color: 'var(--muted)' }, { label: 'Placebo', value: 30, color: 'var(--c1)' }, { label: 'Drug', value: 35, color: 'var(--c2)' }],
          { title: 'Improved after 4 weeks (illustrative)', format: (v) => `${v}%` }),
        },
        {
          kind: 'number', unit: 'percentage points',
          body: 'In a trial, 42 of 120 people on a drug improved, and 30 of 120 on a placebo did. How many **percentage points** better did the drug group do?',
          widget: () => dataTable(['Group', 'Improved', 'Total'], [['Drug', 42, 120], ['Placebo', 30, 120]]),
          answer: ((42 - 30) / 120) * 100, tol: 0.05,
          hint: 'Each as a percentage first.',
          explain: `${pct(42 / 120)} − ${pct(30 / 120)} = 10 percentage points: the drug’s effect beyond the placebo.`,
        },
        {
          kind: 'read',
          title: 'Why randomize?',
          body: 'Twenty volunteers, each with a fitness score nobody measured. If they **choose** whether to join an exercise programme, the keen, fit ones sign up, and the programme looks great before it starts. Press “Assign at random” a few times: chance spreads fitness roughly evenly, even traits you never thought to measure.',
          widget: randomizer(),
        },
        {
          kind: 'choice',
          body: 'What does random assignment to groups buy you?',
          options: [
            { text: 'Groups that differ only by chance, even in things you didn’t measure', correct: true },
            { text: 'Groups that are exactly identical', why: 'Chance imbalances still happen (you saw them). They shrink as groups get bigger, and statistics can say how big they could be.' },
            { text: 'It saves time compared with choosing', why: 'It may or may not; that’s not why scientists do it.' },
          ],
          explain: 'You can’t match groups on everything that matters, because you don’t know everything that matters. A coin can’t be biased by any of it.',
        },
        {
          kind: 'read',
          title: 'Blinding',
          body: 'If patients know they got the real drug, expectation creeps in. If the doctors measuring the outcome know, their hopes can nudge readings and questions. **Single-blind**: patients don’t know. **Double-blind**: neither patients nor the people measuring know, until the end.',
          widget: () => dataTable(['Design', 'Patients know?', 'Measurers know?'], [['Open', 'yes', 'yes'], ['Single-blind', 'no', 'yes'], ['Double-blind', 'no', 'no']], { highlight: [2] }),
        },
        {
          kind: 'match',
          body: 'Match each safeguard to the problem it guards against.',
          heads: ['Safeguard', 'Guards against'],
          pairs: [
            ['Control group', 'Changes that would happen anyway'],
            ['Placebo', 'Improvement from expecting to improve'],
            ['Random assignment', 'Groups that differ before the test starts'],
            ['Double blinding', 'Researchers’ hopes nudging the results'],
            ['Large sample', 'Flukes from small numbers'],
          ],
          explain: 'Each safeguard removes one alternative explanation, until the treatment is the only thing left that could explain a difference.',
        },
        {
          kind: 'read',
          title: 'Sample size',
          body: 'Here a treatment does **nothing**: everyone has a 50% chance of improving either way. Each dot is one study’s apparent effect. With 10 people per group, “effects” of ±20 points or more are routine; with 200 per group they shrink to a few points. Run it again.',
          widget: sampleSim(),
        },
        {
          kind: 'choice',
          body: 'A study of 8 people finds a new diet improves memory by 30%. A well-run study of 2,000 people finds 2%. Which result should you lean on?',
          options: [
            { text: 'The 2,000-person study', correct: true },
            { text: 'The 8-person study: its effect is bigger', why: 'Small studies swing wildly by chance, so the most dramatic results tend to come from them. Big effect + tiny sample = suspicious.' },
            { text: 'Average them: 16%', why: 'They don’t deserve equal weight: the big study is far more precise.' },
          ],
          explain: 'Chance wobble shrinks roughly with √n. 2,000 people pin an effect down far more tightly than 8.',
        },
        {
          kind: 'estimate',
          body: 'How noisy are small samples? Flip a fair coin 10 times. How often do you get **7 or more heads, or 3 or fewer**, purely by chance?',
          min: 0, max: 100, step: 1, answer: Math.round(swing10 * 100), tol: 6, format: (v) => `${v}%`,
          hint: 'It’s more often than most people guess.',
          explain: `${num(swing10 * 1024)} of the 1,024 possible sequences: ${pct(swing10)}. A “70% vs 30%” split from 10 trials happens about a third of the time with no effect at all.`,
        },
        {
          kind: 'order',
          body: 'Put the steps of an experiment in order.',
          items: [
            'Ask a question',
            'State a hypothesis and what it predicts',
            'Design the test: control group, random assignment, blinding',
            'Collect the data',
            'Analyse: is the difference bigger than chance?',
            'Report it, so others can try to replicate it',
          ],
          hint: 'You decide what would count as evidence before you look at the data.',
          explain: 'Predictions and design come before data, so the result can’t be bent to fit. Replication by others is the final check.',
        },
      ],
      practice: [genPctDiff, genVariables, genFlaw],
    },

    // ============================================================ 8 Models
    {
      id: 'models',
      title: 'Models & falsifiability',
      goal: 'Make testable predictions, fit a model to data, and know when it breaks.',
      steps: [
        {
          kind: 'choice',
          body: 'Which claim could an experiment show to be **false**?',
          options: [
            { text: 'Heavier objects fall faster in a vacuum', correct: true },
            { text: 'Everything happens for a reason', why: 'What observation could ever count against it? Any event can be given a “reason” afterwards.' },
            { text: 'The crystal heals, but only if you truly believe', why: 'Any failure can be blamed on not believing enough: an escape hatch makes it untestable.' },
            { text: 'An undetectable spirit guides the planets', why: '“Undetectable” rules out any test by definition.' },
          ],
          explain: 'The first makes a definite prediction, so it can be tested, and it fails the test: in a vacuum everything falls together. Being falsifiable is what made it science; the test made it wrong.',
        },
        {
          kind: 'read',
          title: 'Risky predictions',
          body: 'The philosopher Karl Popper argued that a scientific idea is one that **sticks its neck out**: it forbids some outcomes. Einstein’s general relativity predicted that starlight passing the Sun would bend by a definite amount, about twice Newton’s value. Eclipse measurements in 1919 could have sunk it. They didn’t.',
        },
        {
          kind: 'read',
          title: 'A model from data',
          body: 'Hang weights from a spring and measure how far it stretches. The points look like they lie on a straight line through zero: **extension = k × load** (Hooke’s law). The model is the line; k is the one number to fit.',
          widget: P({ x: [0, 6], y: [0, 14], xlabel: 'load (×100 g)', ylabel: 'extension (cm)', ticks: [1, 2], layers: [{ type: 'dots', pts: SPRING, color: 'var(--c2)', r: 6 }] }),
        },
        {
          kind: 'task',
          body: 'Adjust the slope k until the line fits the points as well as it can (the total squared miss is smallest).',
          widget: plotExplorer({
            params: [{ id: 'k', label: 'slope k', min: 0.5, max: 4, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}` }],
            spec: (v) => ({ x: [0, 6], y: [0, 14], size: SZ, xlabel: 'load (×100 g)', ylabel: 'extension (cm)', ticks: [1, 2], layers: [
              ...SPRING.map(([x, y]): Layer => ({ type: 'line', pts: [[x, y], [x, v.k * x]], color: 'var(--bad)', width: 1.5, dash: true })),
              { type: 'fn', f: (x) => v.k * x, color: 'var(--c1)' },
              { type: 'dots', pts: SPRING, color: 'var(--c2)', r: 6 }] }),
            readout: (v) => `squared misses: ${fit(v.k).toFixed(2)} cm²`,
            goal: (v) => Math.abs(v.k - kBest) <= 0.12,
            goalText: 'A good fit: about 2 cm per 100 g.',
          }),
          hint: 'Watch the red misses: make them small on both sides of the line.',
          explain: `The best slope is about ${num(kBest, 3)} cm per 100 g (least squares). Fitting a model means choosing its numbers to make the misses small overall, not to hit every point.`,
        },
        {
          kind: 'number', unit: 'cm',
          body: 'Take the model as 2.0 cm of stretch per 100 g. Predict the extension for a **350 g** load.',
          answer: 2 * 3.5, tol: 0.1,
          hint: '350 g is 3.5 hundred grams.',
          explain: '2.0 × 3.5 = 7.0 cm. A model’s job is to predict what you haven’t measured yet, which is also what lets it be tested.',
        },
        {
          kind: 'point',
          body: 'Now loads go further. The line is the Hooke’s law model. **Tap the load axis** where the data stop following the model.',
          widget: P({ x: [0, 10.5], y: [0, 35], xlabel: 'load (×100 g)', ylabel: 'extension (cm)', ticks: [1, 5], layers: [
            { type: 'fn', f: (x) => 2 * x, color: 'var(--c1)', dash: true, label: 'model' }, { type: 'dots', pts: SPRING_LONG, color: 'var(--c2)', r: 5 }] }),
          plot: { x: [0, 10], ticks: [1], xlabel: 'load (×100 g)', size: [360, 80] },
          answer: { x: 6.5 }, tol: 0.5, snap: 0.5,
          hint: 'Up to which load do the dots sit on the dashed line?',
          explain: 'Up to 600 g the points hug the line; from 700 g they curve away. The spring has passed its elastic limit: a new regime the simple model doesn’t cover.',
        },
        {
          kind: 'choice',
          body: 'Your model predicted 14 cm at 700 g; you measured 15.5 cm, and the misses grow at higher loads. What’s the best conclusion?',
          options: [
            { text: 'The model works up to about 600 g; beyond that something new happens', correct: true },
            { text: 'The measurement must be wrong: discard it', why: 'Throwing out data because it disagrees with your model is how bad ideas survive. The misses are systematic, not one odd point.' },
            { text: 'The model is useless: throw it away', why: 'It predicts very well below 600 g. Models have ranges of validity.' },
          ],
          explain: 'All models are approximations with a domain where they work. Finding the edge is progress: it tells you where new physics (here, permanent stretching) begins.',
        },
        {
          kind: 'multi',
          body: 'Hypothesis: *plants grow faster under blue light than under white light.* Which results would count **against** it? Select all that apply.',
          options: [
            { text: 'In a fair randomized trial, blue-lit plants grew the same as white-lit ones', correct: true, why: 'The hypothesis predicted a difference; none appeared.' },
            { text: 'In a fair trial, blue-lit plants grew slower', correct: true, why: 'The opposite of the prediction.' },
            { text: 'In a fair trial, blue-lit plants grew faster', why: 'That supports it (though one trial doesn’t prove it).' },
            { text: 'One blue-lit plant died after a cat knocked it over', why: 'That has nothing to do with the light: it’s not a test of the hypothesis.' },
          ],
          explain: 'A testable hypothesis says which results would count against it. Spell those out before you run the test.',
        },
        {
          kind: 'read',
          title: 'How science updates',
          body: 'Newton’s gravity predicted the planets superbly, except for a tiny leftover drift in Mercury’s orbit: about **43 arcseconds per century**. In 1915 general relativity explained exactly that. Newton wasn’t thrown out: his model still flies spacecraft. It was found to be a special case, accurate when gravity is weak and speeds are low.',
        },
        {
          kind: 'order',
          body: 'Each model of the atom replaced the last when an experiment didn’t fit. Put them in historical order.',
          items: ['Dalton: atoms are solid, indivisible balls', 'Thomson: electrons in a positive “plum pudding”', 'Rutherford: a tiny, dense nucleus', 'Bohr: electrons on fixed energy levels', 'Quantum model: electron clouds of probability'],
          hint: 'You need to discover the electron before you can put it on orbits.',
          explain: 'Dalton (1803), Thomson (1904), Rutherford (1911), Bohr (1913), Schrödinger’s quantum model (1926): each one kept what worked and fixed what didn’t.',
        },
        {
          kind: 'match',
          body: 'Match each observation to the model it pushed scientists toward.',
          heads: ['Observation', 'Model'],
          pairs: [
            ['Elements combine in fixed whole-number ratios', 'Dalton’s atoms'],
            ['Cathode rays are streams of tiny negative particles', 'Thomson’s plum pudding'],
            ['A few alpha particles bounce straight back off gold foil', 'Rutherford’s nucleus'],
            ['Hydrogen glows only at a few sharp colours', 'Bohr’s energy levels'],
          ],
          explain: 'Each model was built to explain a stubborn observation, and replaced when a new one didn’t fit.',
        },
        {
          kind: 'fill',
          body: 'Sum up how science handles ideas.',
          template: 'A good hypothesis makes a [[0]] prediction. If a fair test contradicts it, the hypothesis is [[1]]. If the test agrees, the hypothesis is [[2]].',
          blanks: [
            { options: ['vague, flexible', 'risky, testable', 'untestable'], answer: 1 },
            { options: ['falsified, or needs revising', 'proven anyway', 'unaffected'], answer: 0 },
            { options: ['proven true forever', 'disproven', 'supported, not proven'], answer: 2 },
          ],
          explain: 'Evidence can sink an idea decisively but only ever supports one provisionally: the next test could still catch it out. That is why science can correct itself.',
        },
      ],
      practice: [genPredict, genFalsifiable, genCandle],
    },
  ],
};

