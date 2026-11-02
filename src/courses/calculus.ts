// Calculus Intuition: rates of change, zooming in to the derivative, rules by picture, reading
// graphs of f and f′, optimisation, accumulation, the fundamental theorem, exponentials and change.
// Every number shown is computed here; closed forms are checked against numerical slopes and areas.
import type { Course, Generator, Layer, PlotSpec } from '../types';
import { num as num3, pick, randInt, shuffle } from '../ui';
import { plotExplorer } from '../viz/explore';
import { plotEl } from '../viz/plot';
import { dataTable } from '../viz/charts';
import { accumulator, boxTask, cubeSlabs, integrate, miniGraphs, penTask, slope, squareGrowth, tangentTracer } from '../widgets/calculus';

const COLOR = '#e8833a';
/** Numbers to 6 significant digits, with a real minus sign. */
const num = (v: number, d = 6): string => (v < 0 ? '−' + num3(-v, d) : num3(v, d));
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const SUP: Record<number, string> = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
/** "3x²", "x³", "5x", "7" */
const mono = (a: number, n: number) => {
  const c = a === 1 && n > 0 ? '' : a === -1 && n > 0 ? '−' : num(a);
  return n === 0 ? num(a) : n === 1 ? `${c}x` : `${c}x${SUP[n]}`;
};
/** "ax² + bx + c" with signs tidied. */
const quad = (a: number, b: number, c: number) => {
  let s = mono(a, 2);
  if (b) s += b > 0 ? ` + ${mono(b, 1)}` : ` − ${mono(-b, 1)}`;
  if (c) s += c > 0 ? ` + ${num(c)}` : ` − ${num(-c)}`;
  return s;
};
const tangent = (f: (x: number) => number, a: number, extra: Partial<Extract<Layer, { type: 'fn' }>> = {}): Layer =>
  ({ type: 'fn', f: (x) => f(a) + slope(f, a) * (x - a), dash: true, color: 'var(--c2)', ...extra });
const wplot = (spec: PlotSpec) => () => plotEl(spec);
function check(cond: boolean, what: string) { if (!cond) throw new Error('calculus: ' + what); }

// ================================================================ lesson 1: rates of change

const trip: [number, number][] = [[0, 0], [1, 15], [2, 20], [3, 45], [4, 50]];
const fall = (t: number) => 5 * t * t;

const genAvgSpeed: Generator = (rng) => {
  const t1 = randInt(rng, 1, 4), dt = randInt(rng, 1, 4), v = randInt(rng, 8, 24) * 5, d1 = randInt(rng, 2, 30) * 5;
  const d2 = d1 + v * dt;
  return {
    kind: 'number', unit: 'km/h',
    body: `A train is ${d1} km from the station at ${t1}:00 and ${d2} km from it at ${t1 + dt}:00. What was its **average speed** in that time?`,
    answer: v, tol: 0.01,
    hint: 'Change in distance ÷ change in time.',
    explain: `(${d2} − ${d1}) km ÷ ${dt} h = ${v} km/h: the slope of the line joining the two points on its position graph.`,
  };
};

const genSecant: Generator = (rng) => {
  const a = pick(rng, [1, 2, 3, 5]), p = randInt(rng, 0, 4), q = p + randInt(rng, 1, 4);
  const f = (x: number) => a * x * x;
  const m = (f(q) - f(p)) / (q - p);
  check(Math.abs(m - a * (p + q)) < 1e-9, 'secant');
  return {
    kind: 'number',
    body: `What is the average rate of change of f(x) = ${mono(a, 2)} from x = ${p} to x = ${q}?`,
    answer: m, tol: 0.01,
    hint: '(f(end) − f(start)) ÷ (end − start).',
    explain: `f(${q}) = ${num(f(q))}, f(${p}) = ${num(f(p))}. (${num(f(q))} − ${num(f(p))}) ÷ ${q - p} = ${num(m)}: the slope of the secant through those two points.`,
  };
};

const genSteepest: Generator = (rng) => {
  const inc = shuffle(rng, [randInt(rng, 2, 6), randInt(rng, 8, 12), randInt(rng, 14, 18), randInt(rng, 20, 26)]);
  const pos = [0];
  inc.forEach((d) => pos.push(pos[pos.length - 1] + d));
  const best = inc.indexOf(Math.max(...inc));
  const label = (k: number) => `${k}–${k + 1} h`;
  return {
    kind: 'choice',
    body: `A runner's distance from the start (km) after 0, 1, 2, 3, 4 hours: ${pos.join(', ')}. In which hour was the **average speed** highest?`,
    options: inc.map((d, k) => k === best ? { text: label(k), correct: true }
      : { text: label(k), why: `In that hour she covered only ${pos[k + 1]} − ${pos[k]} = ${d} km. ${k === 3 ? 'Being furthest away isn’t the same as being fastest.' : ''}`.trim() }),
    explain: `Speed in each hour = the change in distance: ${inc.join(', ')} km. The biggest jump, ${inc[best]} km, is in hour ${label(best)}: the steepest piece of the graph.`,
  };
};

const rates = {
  id: 'rates',
  title: 'Rates of change',
  goal: 'Read average speed as the slope between two points on a graph.',
  steps: [
    {
      kind: 'choice',
      body: 'A cyclist’s distance from home over a 4-hour ride. In which hour was she **fastest**?',
      widget: wplot({ x: [0, 4.2], y: [0, 55], ticks: [1, 10], xlabel: 'hours', ylabel: 'km from home', layers: [
        { type: 'line', pts: trip, color: 'var(--c1)' }, { type: 'dots', pts: trip, color: 'var(--c1)' }] }),
      options: [
        { text: '2–3 h', correct: true, why: 'She covered 25 km in that hour, the steepest stretch of the graph.' },
        { text: '0–1 h', why: '15 km that hour: quick, but the stretch from 2 to 3 h is steeper (25 km).' },
        { text: '1–2 h', why: 'Only 5 km: the flattest part of the ride (a long café stop?).' },
        { text: '3–4 h', why: 'That’s where she is furthest from home, but she only covered 5 km in it. High isn’t the same as steep.' },
      ],
      explain: 'Speed is how fast the distance changes, so look for the steepest piece, not the highest point: 2–3 h, where the distance rises by 25 km in one hour.',
    },
    {
      kind: 'read',
      title: 'Speed is steepness',
      body: 'On a distance–time graph, **steeper means faster**. The steepness of a straight piece is its **slope**:\n\n**slope = rise ÷ run = change in distance ÷ change in time**\n\nFrom 2 h to 3 h the rise is 45 − 20 = 25 km over a run of 1 h: 25 km/h. A flat piece means standing still.',
      widget: wplot({ x: [0, 4.2], y: [0, 55], ticks: [1, 10], xlabel: 'hours', ylabel: 'km', layers: [
        { type: 'line', pts: trip, color: 'var(--c1)' },
        { type: 'line', pts: [[2, 20], [3, 20], [3, 45]], color: 'var(--c2)', dash: true },
        { type: 'text', x: 2.5, y: 15, text: 'run 1 h', color: 'var(--c2)' },
        { type: 'text', x: 3.08, y: 32, text: 'rise 25 km', color: 'var(--c2)', anchor: 'start' }] }),
    },
    {
      kind: 'number', unit: 'km/h',
      body: 'What was her **average speed** over the whole 4-hour ride?',
      widget: wplot({ x: [0, 4.2], y: [0, 55], ticks: [1, 10], xlabel: 'hours', ylabel: 'km', layers: [
        { type: 'line', pts: trip, color: 'var(--c1)' }, { type: 'line', pts: [[0, 0], [4, 50]], color: 'var(--c2)', dash: true }] }),
      answer: 50 / 4, tol: 0.01,
      hint: 'Total distance ÷ total time: the slope of the dashed line.',
      explain: '50 km in 4 h: 12.5 km/h. That’s the slope of the straight line from the start point to the end point. It ignores all the speeding up and stopping in between.',
    },
    {
      kind: 'read',
      title: 'Curved graphs: use a secant',
      body: `A dropped stone falls 5t² metres in t seconds. Its graph curves: it keeps speeding up. To get the average speed between two times, join the two points with a straight line, a **secant**, and take its slope.\n\nFrom t = 1 to t = 3: (${fall(3)} − ${fall(1)}) ÷ 2 = **${(fall(3) - fall(1)) / 2} m/s**.`,
      widget: wplot({ x: [0, 4], y: [0, 80], ticks: [1, 10], xlabel: 's', ylabel: 'metres fallen', layers: [
        { type: 'fn', f: fall, color: 'var(--c1)', label: '5t²' },
        { type: 'fn', f: (t) => fall(1) + 20 * (t - 1), color: 'var(--c2)', dash: true, from: 0.5, to: 3.5 },
        { type: 'dots', pts: [[1, fall(1)], [3, fall(3)]], color: 'var(--c2)', labels: ['(1, 5)', '(3, 45)'] }] }),
    },
    {
      kind: 'task',
      body: 'Drag the two times so the stone’s **average speed** between them is exactly **30 m/s**.',
      widget: plotExplorer({
        params: [{ id: 'a', label: 'from t', min: 0, max: 5, step: 0.5, value: 1 }, { id: 'b', label: 'to t', min: 0, max: 5, step: 0.5, value: 2 }],
        spec: (v) => ({ x: [0, 5], y: [0, 130], ticks: [1, 20], xlabel: 's', ylabel: 'm', layers: [
          { type: 'fn', f: fall, color: 'var(--c1)' },
          ...(v.b > v.a ? [{ type: 'line', pts: [[v.a, fall(v.a)], [v.b, fall(v.b)]], color: 'var(--c2)' } as Layer] : []),
          { type: 'dots', pts: [[v.a, fall(v.a)], [v.b, fall(v.b)]], color: 'var(--c2)' }] }),
        readout: (v) => v.b > v.a ? `average speed = (${num(fall(v.b))} − ${num(fall(v.a))}) ÷ ${num(v.b - v.a)} = ${num((fall(v.b) - fall(v.a)) / (v.b - v.a))} m/s` : 'Put the second time after the first.',
        goal: (v) => v.b > v.a && Math.abs((fall(v.b) - fall(v.a)) / (v.b - v.a) - 30) < 1e-9,
        goalText: 'Average speed 30 m/s.',
      }),
      hint: 'Later windows are faster. Try starting at t = 2.',
      explain: 'For example t = 2 to t = 4: (80 − 20) ÷ 2 = 30 m/s. (Any pair adding to 6 works, like 1 to 5 or 2.5 to 3.5: the average speed of 5t² from a to b is 5(a + b).)',
    },
    {
      kind: 'estimate',
      body: 'A car’s position (metres) over 5 seconds. Estimate its **average speed** from t = 1 s to t = 5 s.',
      widget: wplot({ x: [0, 5.5], y: [0, 40], ticks: [1, 5], xlabel: 's', ylabel: 'm', layers: [
        { type: 'fn', f: (t) => t ** 3 / 5 + 2 * t, color: 'var(--c1)' },
        { type: 'dots', pts: [[1, 1 / 5 + 2], [5, 125 / 5 + 10]], color: 'var(--c2)' }] }),
      min: 0, max: 20, step: 0.1, answer: r2((125 / 5 + 10 - (1 / 5 + 2)) / 4), tol: 1,
      format: (v) => `${v.toFixed(1)} m/s`,
      hint: 'Read the two heights, subtract, divide by the 4 seconds between them.',
      explain: `About 2.2 m at t = 1 and 35 m at t = 5: (35 − 2.2) ÷ 4 = ${num(r2((35 - 2.2) / 4))} m/s.`,
    },
    {
      kind: 'sort',
      body: 'Speeding up, steady, or slowing down?',
      bins: ['speeding up', 'steady speed', 'slowing down'],
      items: [
        { text: 'Position graph bends upward, getting steeper', bin: 0 },
        { text: 'Position graph is a straight line', bin: 1 },
        { text: 'Position graph flattens out', bin: 2 },
        { text: 'A car pulling away from traffic lights', bin: 0 },
        { text: 'Cruise control on a motorway', bin: 1 },
        { text: 'A ball rolling to a stop', bin: 2 },
      ],
      hint: 'Speed is the slope. Is the slope growing, fixed, or shrinking?',
      explain: 'A straight line has one slope: steady speed. A graph getting steeper means growing speed; one flattening out means the speed is falling towards zero.',
    },
    {
      kind: 'choice',
      body: 'A driver covers 100 km in exactly 1 hour. Must her speedometer have read **exactly 100 km/h** at some moment?',
      options: [
        { text: 'Yes, at least once', correct: true },
        { text: 'No: she could have driven at 80 and 120 and never 100', why: 'To get from 80 to 120 (or back) the speed has to pass through 100: speed changes smoothly, it can’t jump.' },
        { text: 'Only if she drove at a steady speed', why: 'Steady driving is one way, but it’s guaranteed either way.' },
      ],
      explain: 'If she was always below 100 she’d cover less than 100 km; always above, more. So her speed was sometimes at or below 100 and sometimes at or above, and a smoothly changing speed must hit 100 in between. On the graph: somewhere the curve is exactly as steep as the secant.',
    },
    {
      kind: 'fill',
      body: 'Complete the definition.',
      template: 'average rate of change of f from a to b = [[0]] ÷ [[1]]',
      blanks: [{ options: ['f(b) − f(a)', 'f(b) + f(a)', 'f(b) × f(a)'], answer: 0 }, { options: ['b − a', 'b + a', 'f(a)'], answer: 0 }],
      explain: 'Rise over run: the change in output, f(b) − f(a), divided by the change in input, b − a. That’s the secant’s slope.',
    },
    {
      kind: 'number',
      body: 'What is the average rate of change of f(x) = x² from x = 1 to x = 3?',
      answer: (9 - 1) / 2, tol: 0.01,
      widget: wplot({ x: [0, 3.5], y: [0, 11], ticks: [1, 2], layers: [
        { type: 'fn', f: (x) => x * x, color: 'var(--c1)', label: 'x²' },
        { type: 'dots', pts: [[1, 1], [3, 9]], color: 'var(--c2)', labels: ['(1, 1)', '(3, 9)'] }] }),
      hint: 'Rise from 1 to 9, run from 1 to 3.',
      explain: '(9 − 1) ÷ (3 − 1) = 8 ÷ 2 = 4.',
    },
    {
      kind: 'number', unit: '°C per hour',
      body: 'The temperature was 18 °C at 2 pm and 9 °C at 8 pm. What was its average rate of change? (Falling means negative.)',
      answer: (9 - 18) / 6, tol: 0.01,
      explain: '(9 − 18) ÷ (8 − 2) = −9 ÷ 6 = −1.5 °C per hour. A negative slope: the graph goes down to the right.',
    },
    {
      kind: 'read',
      title: 'Averages hide the moment',
      body: 'An average over an hour can’t tell you how fast you were going at 2:17 pm. But averages over **shorter and shorter** windows tell you more and more about a single moment. Shrinking the window to nothing is the whole idea of the derivative: next lesson.',
    },
  ],
  practice: [genAvgSpeed, genSecant, genSteepest],
} satisfies Course['lessons'][number];

// ================================================================ lesson 2: the derivative

const sq = (x: number) => x * x;
const hRows = [1, 0.1, 0.01, 0.001].map((h) => [num(h), num(r4((fall(2 + h) - fall(2)) / h), 6)]);
const scurve = (x: number) => 4 / (1 + Math.exp(-2 * (x - 3)));
const cubicZ = (x: number) => x ** 3 - 2 * x;

const genSecantH: Generator = (rng) => {
  const a = randInt(rng, 1, 6), h = pick(rng, [0.5, 0.1, 0.01, 0.2, 0.05]);
  const m = (sq(a + h) - sq(a)) / h;
  return {
    kind: 'number',
    body: `For f(x) = x², what is the slope of the secant from x = ${a} to x = ${num(a + h)} (so h = ${num(h)})?`,
    answer: r4(m), tol: 0.002,
    hint: '(f(a + h) − f(a)) ÷ h.',
    explain: `(${num(r4(sq(a + h)))} − ${a * a}) ÷ ${num(h)} = ${num(r4(m))}. It’s 2·${a} + h, so as h shrinks it closes in on the tangent slope ${2 * a}.`,
  };
};

const genSlopeAt: Generator = (rng) => {
  const c = randInt(rng, 1, 5), n = pick(rng, [2, 3]), a = randInt(rng, 1, 4);
  const f = (x: number) => c * x ** n;
  const exact = c * n * a ** (n - 1);
  check(Math.abs(slope(f, a) - exact) < 1e-4, 'slopeAt');
  return {
    kind: 'number',
    body: `Shrinking h, the secant slopes of f(x) = ${mono(c, n)} at x = ${a} home in on one number. What is it (the slope of the tangent at x = ${a})?`,
    answer: exact, tol: 0.01,
    hint: n === 2 ? 'For x² the tangent slope at a is 2a. What does the factor in front do?' : 'Try h = 0.001 on a calculator, or use: x³ has slope 3a² at a.',
    explain: `${n === 2 ? `x² has slope 2·${a} = ${2 * a} at x = ${a}` : `x³ has slope 3·${a}² = ${3 * a * a} at x = ${a}`}; multiplying by ${c} multiplies every slope by ${c}: ${num(exact)}. (Numerically, h = 0.001 gives ${num(r2((f(a + 0.001) - f(a)) / 0.001))}.)`,
  };
};

const genSteepPoint: Generator = (rng) => {
  const A = randInt(rng, 2, 6), p = pick(rng, [1.5, 2, 2.5, 3, 3.5, 4, 4.5]);
  const f = (x: number) => A / (1 + Math.exp(-2 * (x - p)));
  return {
    kind: 'point',
    body: `This S-shaped curve climbs from 0 up to ${A}. Tap the x where it is **steepest**.`,
    plot: { x: [0, 6], y: [0, A + 0.5], ticks: [1, 1], layers: [{ type: 'fn', f, color: 'var(--c1)' }] },
    answer: { x: p }, tol: 0.5, snap: 0.25,
    hint: 'Steepest is where the climb is fastest, about halfway up.',
    explain: `It rises fastest at x = ${p}, halfway up (height ${num(A / 2)}); the slope there is ${num(r2(slope(f, p)))}. The tangent is flatter on either side.`,
  };
};

const derivative = {
  id: 'derivative',
  title: 'Zooming in: the derivative',
  goal: 'Find the slope at a single point by shrinking a secant.',
  steps: [
    {
      kind: 'number', unit: 'm/s',
      body: `The stone again: it has fallen 5t² metres after t seconds. What is its average speed between t = 2 and t = 2.1? (5·2.1² = ${num(fall(2.1))})`,
      answer: r4((fall(2.1) - fall(2)) / 0.1), tol: 0.01,
      hint: `(${num(fall(2.1))} − ${fall(2)}) ÷ 0.1`,
      explain: `(${num(fall(2.1))} − 20) ÷ 0.1 = ${num(r4((fall(2.1) - fall(2)) / 0.1))} m/s: the average over a tenth of a second, already close to the speed at t = 2.`,
    },
    {
      kind: 'read',
      title: 'Shrink the window',
      body: 'Here are the average speeds from t = 2 to t = 2 + h, for smaller and smaller h:',
      widget: () => dataTable(['window h (s)', 'average speed (m/s)'], hRows, { highlight: [3] }),
    },
    {
      kind: 'choice',
      body: 'As the window h shrinks towards 0, what number are the average speeds closing in on?',
      options: [
        { text: '20 m/s', correct: true },
        { text: '25 m/s', why: 'That’s the average over a whole second (h = 1). Smaller windows give 20.5, 20.05…' },
        { text: '10 m/s', why: 'That’s the average over the first 2 seconds (20 m ÷ 2 s). By t = 2 the stone is going faster than its average so far.' },
        { text: 'Nothing: at one instant no time passes, so there’s no speed', why: 'Each window gives a definite average, and those averages settle on one value. That value is what we mean by the speed at an instant.' },
      ],
      explain: '25, 20.5, 20.05, 20.005: the extra bit is 5h, which vanishes as h does. The speed at exactly t = 2 is 20 m/s.',
    },
    {
      kind: 'read',
      title: 'Secant becomes tangent',
      body: 'Slide h down. The secant through x = 2 and x = 2 + h swings round until it just grazes the curve: the **tangent line**. Its slope is the slope of the curve **at** x = 2. That number is called the **derivative**.',
      widget: plotExplorer({
        params: [{ id: 'h', label: 'h', min: 0.1, max: 2, step: 0.1, value: 2, format: (v) => v.toFixed(1) }],
        spec: (v) => ({ x: [0, 4.5], y: [-1, 18], ticks: [1, 2], layers: [
          { type: 'fn', f: sq, color: 'var(--c1)', label: 'x²' },
          tangent(sq, 2, { color: 'var(--muted)' }),
          { type: 'fn', f: (x) => 4 + ((sq(2 + v.h) - 4) / v.h) * (x - 2), color: 'var(--c2)' },
          { type: 'dots', pts: [[2, 4], [2 + v.h, sq(2 + v.h)]], color: 'var(--c2)' }] }),
        readout: (v) => `secant slope = (${num(r4(sq(2 + v.h)))} − 4) ÷ ${v.h.toFixed(1)} = ${num(r4((sq(2 + v.h) - 4) / v.h))}`,
      }),
    },
    {
      kind: 'task',
      body: 'For f(x) = x² at x = 2, shrink h until the secant slope is **within 0.01 of 4**.',
      widget: plotExplorer({
        params: [{ id: 'k', label: 'shrink', min: 0, max: 3, step: 0.25, value: 0, format: (k) => 'h = ' + num(r4(10 ** -k)) }],
        spec: (v) => {
          const h = 10 ** -v.k, m = (sq(2 + h) - 4) / h;
          return { x: [0, 4], y: [-1, 12], ticks: [1, 2], layers: [
            { type: 'fn', f: sq, color: 'var(--c1)' },
            { type: 'fn', f: (x) => 4 + m * (x - 2), color: 'var(--c2)' },
            { type: 'dots', pts: [[2, 4], [2 + h, sq(2 + h)]], color: 'var(--c2)' }] };
        },
        readout: (v) => { const h = 10 ** -v.k; return `h = ${num(r4(h))}   ·   secant slope = ${num((sq(2 + h) - 4) / h, 6)}`; },
        goal: (v) => { const h = 10 ** -v.k; return Math.abs((sq(2 + h) - 4) / h - 4) <= 0.01 + 1e-9; },
        goalText: 'Within 0.01 of 4.',
      }),
      hint: 'The secant slope here is exactly 4 + h.',
      explain: 'The secant slope is ((2 + h)² − 4) ÷ h = 4 + h, so you need h ≤ 0.01: slide to h = 0.01 (slope 4.01) or smaller.',
    },
    {
      kind: 'read',
      title: 'Zoom until it looks straight',
      body: 'Another way to see it. Zoom in on a smooth curve (here x³ − 2x around x = 1) and it looks more and more like a straight line. The slope of that line is the derivative.',
      widget: plotExplorer({
        params: [{ id: 'z', label: 'zoom', min: 0, max: 6, step: 1, value: 0, format: (z) => '×' + 2 ** z }],
        spec: (v) => {
          const w = 2 / 2 ** v.z, a = 1, y0 = cubicZ(a);
          return { x: [a - w, a + w], y: [y0 - w * 0.62, y0 + w * 0.62], layers: [{ type: 'fn', f: cubicZ, color: 'var(--c1)', width: 3 }, { type: 'dots', pts: [[a, y0]], color: 'var(--c2)' }] };
        },
        readout: (v) => { const w = 2 / 2 ** v.z; return `slope across the window: ${num(r4((cubicZ(1 + w) - cubicZ(1 - w)) / (2 * w)), 6)}`; },
      }),
    },
    {
      kind: 'estimate',
      body: 'The dashed line is the tangent to y = 2ˣ at x = 1. Estimate its **slope**.',
      widget: wplot({ x: [-1, 3], y: [0, 8], ticks: [0.5, 1], layers: [
        { type: 'fn', f: (x) => 2 ** x, color: 'var(--c1)', label: '2ˣ' },
        tangent((x) => 2 ** x, 1), { type: 'dots', pts: [[1, 2]], color: 'var(--c2)' }] }),
      min: 0, max: 3, step: 0.1, answer: Math.round(slope((x) => 2 ** x, 1) * 10) / 10, tol: 0.3,
      format: (v) => v.toFixed(1),
      hint: 'Follow the dashed line one unit to the right of (1, 2). How far does it rise?',
      explain: `One unit right of (1, 2) the tangent is at about 3.4, so the slope is about 1.4 (exactly ${num(r4(slope((x) => 2 ** x, 1)))}).`,
    },
    {
      kind: 'point',
      body: 'Tap the x where this curve is **steepest**.',
      plot: { x: [0, 6], y: [0, 4.5], ticks: [1, 1], layers: [{ type: 'fn', f: scurve, color: 'var(--c1)' }] },
      answer: { x: 3 }, tol: 0.5, snap: 0.25,
      hint: 'Imagine laying a ruler on the curve as a tangent at each point.',
      explain: `The climb is fastest at x = 3 (slope ${num(r2(slope(scurve, 3)))}). At the flat ends the tangent is nearly horizontal.`,
    },
    {
      kind: 'fill',
      body: 'Put it together.',
      template: 'The derivative f′(a) is the slope of the [[0]] line at x = a. It is what the [[1]] slopes approach as h shrinks to 0.',
      blanks: [{ options: ['tangent', 'secant', 'horizontal'], answer: 0 }, { options: ['secant', 'vertical', 'horizontal'], answer: 0 }],
      explain: 'Secants through a and a + h have slopes (f(a + h) − f(a)) ÷ h. As h → 0 they turn into the tangent, whose slope is f′(a).',
    },
    {
      kind: 'read',
      title: 'A slope for every x',
      body: `Do this at every point and you get a new function: **f′(x)**, “the slope of f at x”. For f(x) = x² the tangent slope is ${num(r4(slope(sq, 1)))} at x = 1, ${num(r4(slope(sq, 2)))} at x = 2 and ${num(r4(slope(sq, 3)))} at x = 3: always double x.\n\nSo **f′(x) = 2x**. Next lesson shows why with a picture.`,
      widget: wplot({ x: [-0.5, 3.5], y: [-2, 12], ticks: [1, 2], layers: [
        { type: 'fn', f: sq, color: 'var(--c1)', label: 'x²' },
        ...[1, 2, 3].map((a) => tangent(sq, a, { from: a - 0.7, to: a + 0.7, dash: false, width: 2 })),
        { type: 'dots', pts: [[1, 1], [2, 4], [3, 9]], color: 'var(--c2)' },
        ...[1, 2, 3].map((a) => ({ type: 'text', x: a - 0.12, y: a * a + 1.3, text: `slope ${2 * a}`, color: 'var(--c2)', anchor: 'end' }) as Layer)] }),
    },
    {
      kind: 'number',
      body: 'Using f′(x) = 2x: what is the slope of f(x) = x² at x = 5?',
      answer: 2 * 5, tol: 0.01,
      explain: `2 × 5 = 10. Check: (5.001² − 25) ÷ 0.001 = ${num(r4((sq(5.001) - 25) / 0.001))}.`,
    },
    {
      kind: 'multi',
      body: 'Which of these are rates of change **at an instant** (derivatives)?',
      options: [
        { text: 'A speedometer reading', correct: true },
        { text: 'How steep a hill is exactly where you stand', correct: true },
        { text: 'How fast a balloon is inflating right now, in litres per second', correct: true },
        { text: 'Average speed over a whole journey', why: 'That’s a secant slope: one rate over a long window.' },
        { text: 'Total rainfall this month', why: 'That’s an amount accumulated, not a rate. (Accumulation is the other half of calculus, lesson 6.)' },
      ],
      explain: 'A derivative is a rate right now: speed at this moment, steepness at this spot, inflow at this second.',
    },
  ],
  practice: [genSecantH, genSlopeAt, genSteepPoint],
} satisfies Course['lessons'][number];

// ================================================================ lesson 3: rules by picture

const genPower: Generator = (rng) => {
  const a = randInt(rng, 2, 6), n = randInt(rng, 2, 5), b = pick(rng, [1, 2, 3, -1, -2]);
  const f = (x: number) => a * x ** n, exact = a * n * b ** (n - 1);
  check(Math.abs(slope(f, b, 1e-5) - exact) < 1e-3 * Math.max(1, Math.abs(exact)), 'power');
  return {
    kind: 'number',
    body: `What is the slope of f(x) = ${mono(a, n)} at x = ${num(b)}?`,
    answer: exact, tol: 0.01,
    hint: `Power rule: x${SUP[n]} has slope ${n}x${n - 1 > 1 ? SUP[n - 1] : ''}. Then multiply by ${a}.`,
    explain: `f′(x) = ${a}·${n}x${n - 1 > 1 ? SUP[n - 1] : ''} = ${mono(a * n, n - 1)}. At x = ${num(b)}: ${a * n} × ${b < 0 ? `(${num(b)})` : b}${n - 1 > 1 ? SUP[n - 1] : ''} = ${num(exact)}.`,
  };
};

const genPoly: Generator = (rng) => {
  const a = randInt(rng, 1, 5), b = randInt(rng, -6, 6), c = randInt(rng, -9, 9), x0 = randInt(rng, -3, 4);
  const f = (x: number) => a * x * x + b * x + c, exact = 2 * a * x0 + b;
  check(Math.abs(slope(f, x0) - exact) < 1e-4, 'poly');
  return {
    kind: 'number',
    body: `f(x) = ${quad(a, b, c)}. What is f′(${num(x0)}), the slope at x = ${num(x0)}?`,
    answer: exact, tol: 0.01,
    hint: 'Do each term separately and add. The constant term has slope 0.',
    explain: `f′(x) = ${mono(2 * a, 1)}${b ? (b > 0 ? ` + ${b}` : ` − ${-b}`) : ''} (the ${c} adds nothing). At x = ${num(x0)}: ${2 * a}·${x0 < 0 ? `(${num(x0)})` : x0}${b ? (b > 0 ? ` + ${b}` : ` − ${-b}`) : ''} = ${num(exact)}.`,
  };
};

const genPowerChoice: Generator = (rng) => {
  const n = randInt(rng, 3, 6);
  let a = randInt(rng, 2, 8);
  if (a >= n) a++; // a ≠ n keeps the options distinct
  return {
    kind: 'choice',
    body: `What is the derivative of ${mono(a, n)}?`,
    options: [
      { text: mono(a * n, n - 1), correct: true },
      { text: mono(a, n - 1), why: `You lowered the power but forgot to bring the ${n} down in front.` },
      { text: mono(a * n, n), why: 'The power has to drop by one: growing x³ adds slabs of size x², not x³.' },
      { text: mono(n, n - 1), why: `That’s the slope of x${SUP[n]}; the factor ${a} multiplies every slope too.` },
    ],
    explain: `Power rule: x${SUP[n]} → ${n}x${n - 1 > 1 ? SUP[n - 1] : ''}. The constant ${a} stretches the graph, multiplying all slopes: ${mono(a * n, n - 1)}.`,
  };
};

const rules = {
  id: 'rules',
  title: 'Derivative rules by picture',
  goal: 'See why x² has slope 2x and x³ has slope 3x², and combine rules.',
  steps: [
    {
      kind: 'choice',
      body: 'A square has side x. It grows a tiny amount dx on two sides. About how much **area** does it gain?',
      widget: squareGrowth(),
      options: [
        { text: '2x·dx', correct: true },
        { text: 'x·dx', why: 'There are two strips, one along each side that grew.' },
        { text: 'dx²', why: 'That’s only the tiny corner. When dx is small, dx² is far smaller still: shrink dx and watch it vanish.' },
        { text: 'x²·dx', why: 'Units check: area added should be a length × a length. Each strip is x long and dx thick.' },
      ],
      explain: 'Two strips of x by dx, plus a corner dx² that becomes negligible as dx shrinks. Added area ≈ 2x·dx, so area grows 2x times as fast as the side: the slope of x² is 2x.',
    },
    {
      kind: 'number',
      body: 'A square of side 10 cm grows to 10.1 cm. Exactly how much area does it gain, in cm²?',
      answer: r4(10.1 ** 2 - 100), tol: 0.001, unit: 'cm²',
      hint: 'Two strips of 10 × 0.1, plus the corner.',
      explain: `10 × 0.1 + 10 × 0.1 + 0.1 × 0.1 = 1 + 1 + 0.01 = ${num(r4(10.1 ** 2 - 100))}. Per unit of growth that’s 2.01 ÷ 0.1 = 20.1, close to 2x = 20.`,
    },
    {
      kind: 'read',
      title: 'The slope of x² is 2x',
      body: 'Gained area ÷ growth = 2x + dx, and as dx shrinks that becomes **2x**. Same answer as the shrinking-secant tables, but now you can *see* where it comes from: the two edges of the square.',
    },
    {
      kind: 'choice',
      body: 'Now a cube of side x grows by dx on three faces. The gain is about three thin slabs (the edge and corner bits are tiny). What’s the slope of x³?',
      widget: cubeSlabs(),
      options: [
        { text: '3x²', correct: true },
        { text: 'x²', why: 'That’s one slab per dx. The cube grows on three faces.' },
        { text: '3x', why: 'Each slab is x by x by dx: a face area x² times the thickness.' },
        { text: '2x³', why: 'The gain per unit of growth is an area (a face), not a volume.' },
      ],
      explain: 'Three slabs of x²·dx: the volume grows 3x² times as fast as the side. So the slope of x³ is 3x².',
    },
    {
      kind: 'fill',
      body: 'Spot the pattern.',
      template: 'x² → 2x,  x³ → 3x²,  x⁴ → [[0]],  xⁿ → [[1]]',
      blanks: [{ options: ['4x³', '3x⁴', '4x', 'x³'], answer: 0 }, { options: ['n·xⁿ⁻¹', 'xⁿ⁻¹', 'n·xⁿ', '(n − 1)·xⁿ'], answer: 0 }],
      hint: 'The old power comes down in front; the new power is one less.',
      explain: 'The **power rule**: bring the power down in front and lower it by one. x⁴ → 4x³, and in general xⁿ → n·xⁿ⁻¹.',
    },
    {
      kind: 'number',
      body: 'Use the power rule: what is the slope of x⁴ at x = 2?',
      answer: 4 * 2 ** 3, tol: 0.01,
      explain: `4x³ at x = 2: 4 × 8 = 32. (Numerically: (2.001⁴ − 16) ÷ 0.001 = ${num(r2((2.001 ** 4 - 16) / 0.001))}.)`,
    },
    {
      kind: 'read',
      title: 'Stretch and shift',
      body: 'Multiply f by a: the graph stretches vertically and **every slope is multiplied by a**. Add a constant b: the graph slides up, and **no slope changes**. Add two functions: their slopes **add**.',
      widget: plotExplorer({
        params: [{ id: 'a', label: 'stretch a', min: 0.5, max: 3, step: 0.5, value: 1 }, { id: 'b', label: 'shift b', min: -3, max: 3, step: 1, value: 0 }],
        spec: (v) => {
          const f = (x: number) => v.a * x * x + v.b;
          return { x: [-2, 3], y: [-4, 14], ticks: [1, 2], layers: [{ type: 'fn', f, color: 'var(--c1)' }, tangent(f, 1, { from: 0, to: 2.2 }), { type: 'dots', pts: [[1, f(1)]], color: 'var(--c2)' }] };
        },
        readout: (v) => `f(x) = ${v.a === 1 ? '' : num(v.a)}x²${v.b ? (v.b > 0 ? ' + ' + v.b : ' − ' + -v.b) : ''}   ·   slope at x = 1: ${num(2 * v.a)}`,
      }),
    },
    {
      kind: 'match',
      body: 'Match each function to its derivative.',
      heads: ['f(x)', 'f′(x)'],
      pairs: [['5x²', '10x'], ['x³ + x', '3x² + 1'], ['7', '0'], ['4x', '4'], ['x² + 9', '2x']],
      hint: 'Term by term; constants on their own have slope 0.',
      explain: '5x² → 5·2x = 10x. x³ + x → 3x² + 1. A constant like 7 is a flat line: slope 0. 4x is a line of slope 4. x² + 9 is x² shifted up: still 2x.',
    },
    {
      kind: 'sort',
      body: 'Does the change alter the slopes of a graph?',
      bins: ['changes the slopes', 'slopes stay the same'],
      items: [
        { text: 'Adding 5 to f', bin: 1 },
        { text: 'Multiplying f by 3', bin: 0 },
        { text: 'Adding x to f', bin: 0 },
        { text: 'Sliding the graph up 100', bin: 1 },
        { text: 'Flipping the graph upside down (× −1)', bin: 0 },
        { text: 'Subtracting a constant 2', bin: 1 },
      ],
      explain: 'Adding or subtracting a constant slides the graph up or down without tilting it. Multiplying scales every slope (× −1 flips their signs), and adding x adds 1 to every slope.',
    },
    {
      kind: 'order',
      body: 'Order these functions by their slope at **x = 2**, smallest first.',
      items: ['3x', 'x²', 'x⁴ ÷ 4', 'x³'],
      hint: 'Slopes at 2: 3; 2·2; 2³; 3·2².',
      explain: `At x = 2: 3x has slope 3; x² has 2x = 4; x⁴ ÷ 4 has x³ = 8; x³ has 3x² = 12. (Numerically: ${[(x: number) => 3 * x, sq, (x: number) => x ** 4 / 4, (x: number) => x ** 3].map((f) => num(r2(slope(f, 2)))).join(', ')}.)`,
    },
    {
      kind: 'number',
      body: 'f(x) = 3x² + 4x. What is f′(2)?',
      answer: 6 * 2 + 4, tol: 0.01,
      hint: 'Slope of 3x² is 6x; slope of 4x is 4.',
      explain: `f′(x) = 6x + 4, so f′(2) = 12 + 4 = 16. (Check: ${num(r2(slope((x) => 3 * x * x + 4 * x, 2)))}.)`,
    },
  ],
  practice: [genPower, genPoly, genPowerChoice],
} satisfies Course['lessons'][number];

// ================================================================ lesson 4: reading derivatives

const bump = (x: number) => x ** 3 / 3 - 2 * x * x + 3 * x + 1; // f′ = (x − 1)(x − 3)
const bumpD = (x: number) => (x - 1) * (x - 3);
const gD = (x: number) => 0.5 * (x - 1) * (x - 4);
check(Math.abs(slope(bump, 2) - bumpD(2)) < 1e-6 && Math.abs(slope(bump, 4) - 3) < 1e-6, 'bump');

const genVertexPoint: Generator = (rng) => {
  const up = rng() < 0.5, a = up ? 0.5 : -0.5, p = pick(rng, [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5]);
  const q = up ? randInt(rng, 1, 3) : randInt(rng, 6, 9);
  const b = -2 * a * p, c = a * p * p + q;
  const f = (x: number) => a * x * x + b * x + c;
  check(Math.abs(slope(f, p)) < 1e-6, 'vertex');
  return {
    kind: 'point',
    body: `f(x) = ${quad(a, b, c)}. Tap the x where the **slope is 0** (the ${up ? 'bottom of the valley' : 'top of the hill'}).`,
    plot: { x: [0, 8], y: [-2, 12], ticks: [1, 2], layers: [{ type: 'fn', f, color: 'var(--c1)' }] },
    answer: { x: p }, tol: 0.25, snap: 0.25,
    hint: `f′(x) = ${mono(2 * a, 1)} ${b >= 0 ? '+' : '−'} ${num(Math.abs(b))}. Set it to 0.`,
    explain: `f′(x) = ${mono(2 * a, 1)} ${b >= 0 ? '+' : '−'} ${num(Math.abs(b))} = 0 at x = ${num(p)}. There the tangent is flat: the ${up ? 'minimum' : 'maximum'}, f(${num(p)}) = ${num(q)}.`,
  };
};

const genIncDec: Generator = (rng) => {
  const p = randInt(rng, -4, 4);
  let t = randInt(rng, -6, 6);
  if (rng() < 0.15) t = p;
  const d = 2 * t - 2 * p;
  const f = `x² ${p > 0 ? '−' : '+'} ${Math.abs(2 * p)}x`;
  const body = `f(x) = ${p === 0 ? 'x²' : f}. At x = ${num(t)}, is f increasing or decreasing?`;
  const opts = [
    { text: 'Increasing', ok: d > 0, why: `f′(${num(t)}) = ${num(d)}${d < 0 ? ' is negative: the graph goes down' : ': flat, neither up nor down'} there.` },
    { text: 'Decreasing', ok: d < 0, why: `f′(${num(t)}) = ${num(d)}${d > 0 ? ' is positive: the graph goes up' : ': flat, neither up nor down'} there.` },
    { text: 'Neither: the slope is 0 there', ok: d === 0, why: `f′(${num(t)}) = ${num(d)}, not 0.` },
  ];
  return {
    kind: 'choice', body,
    options: opts.map((o) => (o.ok ? { text: o.text, correct: true } : { text: o.text, why: o.why })),
    hint: `f′(x) = 2x${p ? (p > 0 ? ` − ${2 * p}` : ` + ${-2 * p}`) : ''}.`,
    explain: `f′(x) = 2x${p ? (p > 0 ? ` − ${2 * p}` : ` + ${-2 * p}`) : ''}, so f′(${num(t)}) = ${num(d)}: ${d > 0 ? 'positive, so f is increasing' : d < 0 ? 'negative, so f is decreasing' : 'zero: the bottom of the valley'}.`,
  };
};

const genCrit: Generator = (rng) => {
  const a = randInt(rng, 1, 3) * (rng() < 0.3 ? -1 : 1), p = pick(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]), c = randInt(rng, -8, 8);
  const b = -2 * a * p;
  return {
    kind: 'number',
    body: `f(x) = ${quad(a, b, c)}. At what x is the slope **zero**?`,
    answer: p, tol: 0.01,
    hint: 'Find f′(x) and set it equal to 0.',
    explain: `f′(x) = ${mono(2 * a, 1)} ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = 0 gives x = ${num(p)}. That’s the ${a > 0 ? 'minimum (the parabola opens up)' : 'maximum (the parabola opens down)'}.`,
  };
};

const reading = {
  id: 'reading',
  title: 'Reading derivatives',
  goal: 'Read rising, falling, peaks and valleys from f and from f′.',
  steps: [
    {
      kind: 'point',
      body: 'Tap the top of the bump on this graph (a **local maximum**).',
      plot: { x: [0, 4.5], y: [-0.5, 5], ticks: [0.5, 1], layers: [{ type: 'fn', f: bump, color: 'var(--c1)' }] },
      answer: { x: 1 }, tol: 0.25, snap: 0.25,
      explain: `The top of the bump is at x = 1 (height ${num(r2(bump(1)))}). There the graph stops rising and starts falling.`,
    },
    {
      kind: 'read',
      title: 'Flat at the top and bottom',
      body: 'At a peak or a valley the tangent is **horizontal**: the slope is 0. Going up (slope +) to going down (slope −) means passing through 0. For this curve the flat spots are at x = 1 (a peak) and x = 3 (a valley).',
      widget: wplot({ x: [0, 4.5], y: [-0.5, 5], ticks: [0.5, 1], layers: [
        { type: 'fn', f: bump, color: 'var(--c1)' },
        tangent(bump, 1, { from: 0.3, to: 1.7, color: 'var(--c5)' }), tangent(bump, 3, { from: 2.3, to: 3.7, color: 'var(--c5)' }),
        { type: 'dots', pts: [[1, bump(1)], [3, bump(3)]], color: 'var(--c5)', labels: ['slope 0', 'slope 0'] }] }),
    },
    {
      kind: 'sort',
      body: 'For the same curve: is the slope positive or negative here?',
      bins: ['f′ > 0 (rising)', 'f′ < 0 (falling)'],
      items: [
        { text: 'between x = 0 and 1', bin: 0 },
        { text: 'between x = 1 and 3', bin: 1 },
        { text: 'between x = 3 and 4.5', bin: 0 },
        { text: 'at x = 2', bin: 1 },
        { text: 'at x = 0.5', bin: 0 },
        { text: 'at x = 4', bin: 0 },
      ],
      hint: 'Rising left to right means positive slope.',
      explain: `f′ = (x − 1)(x − 3): positive before 1, negative between 1 and 3, positive after 3. E.g. f′(2) = ${bumpD(2)}, f′(0.5) = ${bumpD(0.5)}, f′(4) = ${bumpD(4)}.`,
    },
    {
      kind: 'read',
      title: 'Draw the slope as you go',
      body: 'Slide along f. The lower graph plots the slope at each point: that’s the graph of **f′**. Watch it cross zero exactly where f has its peak and valley.',
      widget: tangentTracer(bump, [0, 4.5], [-0.5, 5], [-2, 6], 0.2),
    },
    {
      kind: 'choice',
      body: `f′(2) = ${bumpD(2)}. What does the graph of f do at x = 2?`,
      options: [
        { text: 'It is going down', correct: true },
        { text: 'It is below zero', why: 'A negative slope says which way the graph is heading, not where it is. f(2) is about 1.7, above zero.' },
        { text: 'It is at its lowest point', why: 'At the lowest point the slope would be 0, not −1. The valley is at x = 3.' },
      ],
      explain: `Negative slope means falling: at x = 2 the curve is heading down at slope −1, even though f(2) = ${num(r2(bump(2)))} is positive.`,
    },
    {
      kind: 'match',
      body: 'Match each graph of f (letters) to the graph of its slope f′ (numbers).',
      widget: () => {
        const xs: [number, number] = [-2, 2];
        return miniGraphs([
          { label: 'f: A', f: (x) => 0.8 * x + 0.5, y: [-2, 2.5] },
          { label: 'f: B', f: (x) => x * x, y: [-0.5, 4.5] },
          { label: 'f: C', f: (x) => 3 - x * x, y: [-1.5, 3.5] },
          { label: 'f: D', f: (x) => x ** 3 / 2, y: [-4.5, 4.5] },
          { label: 'f′: 1', f: (x) => 2 * x, y: [-4.5, 4.5], color: 'var(--c2)' },
          { label: 'f′: 2', f: (x) => 1.5 * x * x, y: [-1, 6.5], color: 'var(--c2)' },
          { label: 'f′: 3', f: () => 0.8, y: [-2, 2], color: 'var(--c2)' },
          { label: 'f′: 4', f: (x) => -2 * x, y: [-4.5, 4.5], color: 'var(--c2)' },
        ], xs, { caption: 'x from −2 to 2; the horizontal line in each is y = 0' });
      },
      heads: ['f', 'f′'],
      pairs: [['A', '3'], ['B', '1'], ['C', '4'], ['D', '2']],
      hint: 'A straight line has a constant slope. Where is each f flat? That’s where f′ crosses 0.',
      explain: 'A is a straight line: constant slope (3). B (a valley) falls then rises: slope goes − to + through 0 (1). C (a hill) rises then falls: + to − (4). D always rises, flattest at 0: slope positive except touching 0 there (2).',
    },
    {
      kind: 'multi',
      body: 'This is a graph of **f′** (the slope), not f. Which statements about **f** are true?',
      widget: wplot({ x: [0, 5], y: [-2, 3], ticks: [1, 1], ylabel: 'f′', layers: [{ type: 'fn', f: gD, color: 'var(--c2)' }] }),
      options: [
        { text: 'f has a peak at x = 1', correct: true },
        { text: 'f is falling between x = 1 and 4', correct: true },
        { text: 'f has a valley at x = 4', correct: true },
        { text: 'f is highest at x = 2.5, where this graph is lowest', why: 'The lowest point of f′ is where f falls most steeply, not where f is high.' },
        { text: 'f is negative between x = 1 and 4', why: 'A negative slope means f is going down there, but f itself could be any height.' },
      ],
      explain: 'f′ is + before 1, − from 1 to 4, + after 4. So f rises to a peak at 1, falls until 4, then rises: a valley at 4. The lowest point of f′ (x = 2.5) is where f is falling fastest.',
    },
    {
      kind: 'point',
      body: 'Same graph of **f′**. Tap the x where **f** reaches its valley (local minimum).',
      plot: { x: [0, 5], y: [-2, 3], ticks: [1, 1], ylabel: 'f′', layers: [{ type: 'fn', f: gD, color: 'var(--c2)' }] },
      answer: { x: 4 }, tol: 0.25, snap: 0.25,
      hint: 'A valley: f stops falling and starts rising. f′ goes from − to +.',
      explain: 'At x = 4 the slope changes from negative to positive: f stops going down and starts going up. (At x = 1 it goes + to −: a peak.)',
    },
    {
      kind: 'estimate',
      body: 'Back to the bump graph. Estimate the slope of f at **x = 4**.',
      widget: wplot({ x: [0, 4.5], y: [-0.5, 5], ticks: [0.5, 1], layers: [{ type: 'fn', f: bump, color: 'var(--c1)' }, { type: 'dots', pts: [[4, bump(4)]], color: 'var(--c2)' }] }),
      min: -2, max: 6, step: 0.5, answer: bumpD(4), tol: 1,
      hint: 'Picture the tangent at the dot: how much does it rise over one unit?',
      explain: `f′(4) = (4 − 1)(4 − 3) = 3: the curve is climbing 3 units up per unit across. (From x = 3.9 to 4.1 it rises ${num(r2(bump(4.1) - bump(3.9)))} in 0.2.)`,
    },
    {
      kind: 'read',
      title: 'Flat doesn’t always mean a turn',
      body: 'x³ has slope 3x², which is 0 at x = 0. But x³ doesn’t turn there: it flattens for an instant and keeps rising. A zero slope marks a **candidate**; check the sign of f′ on each side.',
      widget: wplot({ x: [-1.6, 1.6], y: [-3, 3], ticks: [0.5, 1], layers: [{ type: 'fn', f: (x) => x ** 3, color: 'var(--c1)', label: 'x³' }, { type: 'hline', y: 0, color: 'var(--c5)' }, { type: 'dots', pts: [[0, 0]], color: 'var(--c5)', labels: ['slope 0'] }] }),
    },
    {
      kind: 'choice',
      body: 'A smooth function has f′(5) = 0. Must f have a peak or a valley at x = 5?',
      options: [
        { text: 'No: it could flatten and carry on, like x³ at 0', correct: true },
        { text: 'Yes: slope 0 always means a peak or valley', why: 'x³ at 0 is the counterexample: flat for an instant, rising on both sides.' },
        { text: 'Yes, always a peak', why: 'Valleys are flat too; and some flat points are neither.' },
      ],
      explain: 'Slope 0 is necessary for a smooth peak or valley, not sufficient. Look at f′ on either side: + then − is a peak, − then + a valley, no sign change is neither.',
    },
    {
      kind: 'number',
      body: 'f(x) = x² − 6x + 2. At what x is the slope zero?',
      answer: 3, tol: 0.01,
      hint: 'f′(x) = 2x − 6.',
      explain: '2x − 6 = 0 gives x = 3. f(3) = −7 is the bottom of the valley.',
    },
  ],
  practice: [genVertexPoint, genIncDec, genCrit],
} satisfies Course['lessons'][number];

// ================================================================ lesson 5: optimisation

const PEN = 40, PEN_BEST = PEN / 4, BOX = 30, BOX_BEST = BOX / 6;
const penA = (w: number) => w * (PEN - 2 * w);
const boxV = (x: number) => x * (BOX - 2 * x) ** 2;
const profit = (p: number) => (p - 4) * (24 - 2 * p);
const argmax = (f: (x: number) => number, a: number, b: number, step: number) => {
  let best = a;
  for (let x = a; x <= b + 1e-9; x += step) if (f(x) > f(best)) best = x;
  return Math.round(best / step) * step;
};
check(argmax(penA, 0, 20, 0.5) === PEN_BEST && argmax(boxV, 0, 15, 0.5) === BOX_BEST && argmax(profit, 4, 12, 0.25) === 8, 'optima');

const genPen: Generator = (rng) => {
  const L = randInt(rng, 5, 25) * 4;
  const best = argmax((w) => w * (L - 2 * w), 0, L / 2, 0.5);
  check(best === L / 4, 'pen');
  return {
    kind: 'number', unit: 'm²',
    body: `You have ${L} m of fence to make a rectangular pen against a long wall (fence on three sides only). What is the **largest area** you can enclose?`,
    answer: (L * L) / 8, tol: 0.01,
    hint: `With depth w, the side along the wall is ${L} − 2w. Area A = w(${L} − 2w); set A′ = 0.`,
    explain: `A = ${L}w − 2w², A′ = ${L} − 4w = 0 at w = ${num(L / 4)}. The pen is ${num(L / 4)} × ${num(L / 2)}: area ${num((L * L) / 8)} m².`,
  };
};

const genBox: Generator = (rng) => {
  const S = pick(rng, [12, 18, 24, 36, 42, 48, 54, 60]);
  const V = (x: number) => x * (S - 2 * x) ** 2;
  check(argmax(V, 0, S / 2, 0.5) === S / 6, 'box');
  return {
    kind: 'number', unit: 'cm',
    body: `From a ${S} × ${S} cm card you cut equal squares from the corners and fold up an open box. What size of cut gives the **biggest volume**?`,
    answer: S / 6, tol: 0.01,
    hint: `V = x(${S} − 2x)². V′ = (${S} − 2x)(${S} − 6x).`,
    explain: `V′ = (${S} − 2x)(${S} − 6x) is 0 at x = ${S / 6} (the other root, x = ${S / 2}, leaves no base). Volume ${num(V(S / 6))} cm³; check: x = ${S / 6 - 0.5} gives ${num(V(S / 6 - 0.5))}, x = ${S / 6 + 0.5} gives ${num(V(S / 6 + 0.5))}.`,
  };
};

const genProduct: Generator = (rng) => {
  const S = randInt(rng, 4, 40) * 2;
  return {
    kind: 'number',
    body: `Two numbers add up to ${S}. What is the **largest** their product can be?`,
    answer: (S / 2) ** 2, tol: 0.01,
    hint: `Product P(x) = x(${S} − x). Where is P′ = 0?`,
    explain: `P′ = ${S} − 2x = 0 at x = ${S / 2}: both numbers ${S / 2}, product ${(S / 2) ** 2}. (${S / 2 - 1} × ${S / 2 + 1} = ${(S / 2) ** 2 - 1}, a bit less.)`,
  };
};

const optimise = {
  id: 'optimise',
  title: 'Optimisation',
  goal: 'Find the best value by setting the derivative to zero.',
  steps: [
    {
      kind: 'task',
      body: `You have **${PEN} m** of fence for a rectangular pen against a long wall, so you only fence three sides. Choose the depth that gives the **biggest area**.`,
      widget: penTask(PEN, PEN_BEST),
      hint: 'Too shallow: long and thin. Too deep: little left for the long side.',
      explain: `Depth ${PEN_BEST} m: the pen is ${PEN_BEST} × ${PEN - 2 * PEN_BEST} m = ${penA(PEN_BEST)} m². Depth 9.5 or 10.5 gives ${penA(9.5)} m².`,
    },
    {
      kind: 'read',
      title: 'The best point is flat',
      body: `The area A(w) = w(${PEN} − 2w) rises, peaks and falls. At the peak its tangent is **horizontal**: A′(w) = 0. That turns “try lots of values” into “solve one equation”.`,
      widget: wplot({ x: [0, 20], y: [0, 230], ticks: [2, 50], xlabel: 'depth w (m)', ylabel: 'area', layers: [
        { type: 'fn', f: penA, color: 'var(--c1)' }, { type: 'hline', y: penA(PEN_BEST), color: 'var(--c5)' }, { type: 'dots', pts: [[PEN_BEST, penA(PEN_BEST)]], color: 'var(--c5)', labels: ['A′ = 0'] }] }),
    },
    {
      kind: 'fill',
      body: 'Solve it with the derivative.',
      template: 'A(w) = 40w − 2w², so A′(w) = [[0]]. Setting A′ = 0 gives w = [[1]].',
      blanks: [{ options: ['40 − 4w', '40 − 2w', '40w − 4'], answer: 0 }, { options: ['10', '20', '5'], answer: 0 }],
      hint: 'Slope of 40w is 40; slope of 2w² is 4w.',
      explain: 'A′(w) = 40 − 4w, which is 0 when w = 10: the depth you found by sliding.',
    },
    {
      kind: 'number', unit: 'm²',
      body: 'So what is the maximum area of the pen?',
      answer: penA(PEN_BEST), tol: 0.01,
      explain: `Depth 10, length 40 − 2·10 = 20: area ${penA(PEN_BEST)} m². Notice it’s twice as long as it is deep, not a square: the wall is a free side.`,
    },
    {
      kind: 'read',
      title: 'Folding a box',
      body: `A ${BOX} × ${BOX} cm card. Cut a square of side x from each corner and fold up the flaps: an open box with base (${BOX} − 2x) by (${BOX} − 2x) and height x.\n\n**V(x) = x(${BOX} − 2x)²**\n\nSmall cuts: shallow tray. Big cuts: tall but tiny base.`,
    },
    {
      kind: 'task',
      body: 'Choose the corner cut that gives the box the **biggest volume**.',
      widget: boxTask(BOX, BOX_BEST),
      hint: 'Watch the dot on the volume curve and look for the top.',
      explain: `Cut x = ${BOX_BEST} cm: base 20 × 20, height 5, volume ${boxV(BOX_BEST)} cm³. Neighbours: x = 4.5 gives ${num(boxV(4.5))}, x = 5.5 gives ${num(boxV(5.5))}.`,
    },
    {
      kind: 'number', unit: 'cm³',
      body: 'The derivative agrees: V′(x) = (30 − 2x)(30 − 6x), zero at x = 5. What is the box’s volume at x = 5?',
      answer: boxV(5), tol: 0.01,
      explain: `5 × 20 × 20 = ${boxV(5)} cm³. (V′’s other zero, x = 15, uses up the whole card: volume 0, the worst box.)`,
    },
    {
      kind: 'choice',
      body: 'A cut of 1 cm and a cut of 14 cm both make poor boxes. What goes wrong at 14 cm?',
      options: [
        { text: 'The base shrinks to 2 × 2 cm', correct: true },
        { text: 'The box is too shallow', why: 'That’s the 1 cm problem. At 14 cm the box is 14 cm tall.' },
        { text: 'You can’t cut 14 cm squares from a 30 cm card', why: 'You can: four 14 cm squares leave a 2 cm strip in the middle, which is the base.' },
      ],
      explain: `At 14 cm the base is (30 − 28) = 2 cm: volume 14 × 2 × 2 = ${boxV(14)} cm³. At 1 cm: 1 × 28 × 28 = ${boxV(1)} cm³. The best is in between, where the curve is flat.`,
    },
    {
      kind: 'point',
      body: 'A café sells lemonade at price p ($). Its profit (in $100s) is P(p) = (p − 4)(24 − 2p). Tap the price that **maximises profit**.',
      plot: { x: [4, 12], y: [0, 40], ticks: [1, 10], xlabel: 'price p', ylabel: 'profit', layers: [{ type: 'fn', f: profit, color: 'var(--c1)' }] },
      answer: { x: 8 }, tol: 0.25, snap: 0.25,
      hint: 'P = −2p² + 32p − 96. Where is P′ = 0?',
      explain: `P′(p) = −4p + 32 = 0 at p = $8, profit ${profit(8)} (in $100s). Cheaper sells more cups but earns less on each; dearer sells too few.`,
    },
    {
      kind: 'multi',
      body: 'To find the largest value of a smooth f on an interval (say 0 ≤ x ≤ 10), which points must you check?',
      options: [
        { text: 'Points inside where f′ = 0', correct: true },
        { text: 'The two endpoints, 0 and 10', correct: true },
        { text: 'Points where f = 0', why: 'Where f crosses zero says nothing about where it’s largest.' },
        { text: 'The midpoint, x = 5', why: 'Nothing special happens at the middle unless the slope is 0 there.' },
      ],
      explain: 'The maximum is either at a flat point inside or at an edge (a function climbing the whole way peaks at the right end, with no flat point at all). Compare f at all candidates.',
    },
    {
      kind: 'order',
      body: 'Put the steps of an optimisation problem in order.',
      items: [
        'Write the quantity as a function of one variable',
        'Find its derivative',
        'Solve derivative = 0 for the candidates',
        'Check candidates and endpoints; pick the best',
      ],
      explain: 'Model (e.g. V = x(30 − 2x)²), differentiate, solve V′ = 0, then compare the candidates with the endpoints to be sure it’s a maximum inside the allowed range.',
    },
  ],
  practice: [genPen, genBox, genProduct],
} satisfies Course['lessons'][number];

// ================================================================ lesson 6: accumulation

const t2 = (t: number) => t * t;
const riemann = (f: (x: number) => number, a: number, b: number, n: number, rule: number) => {
  const w = (b - a) / n;
  let s = 0;
  for (let k = 0; k < n; k++) s += f(a + (k + (rule === 1 ? 0.5 : rule === 2 ? 1 : 0)) * w) * w;
  return s;
};
const EXACT9 = integrate(t2, 0, 3);
check(Math.abs(EXACT9 - 9) < 1e-9, 'int t²');
const midNeeded = (() => { let n = 1; while (Math.abs(riemann(t2, 0, 3, n, 1) - 9) / 9 >= 0.01) n++; return n; })();
const leftNeeded = (() => { let n = 1; while (Math.abs(riemann(t2, 0, 3, n, 0) - 9) / 9 >= 0.01) n++; return n; })();
const sinV = (t: number) => 10 * Math.sin((Math.PI * t) / 10);

const genDistance: Generator = (rng) => {
  const v1 = randInt(rng, 2, 8) * 2, t1 = randInt(rng, 2, 6), v2 = v1 + randInt(rng, 1, 6) * 2, t2_ = randInt(rng, 2, 5);
  const d = v1 * t1 + ((v1 + v2) / 2) * t2_;
  const f = (t: number) => (t <= t1 ? v1 : v1 + ((v2 - v1) * (t - t1)) / t2_);
  check(Math.abs(integrate(f, 0, t1) + integrate(f, t1, t1 + t2_) - d) < 1e-6, 'distance');
  return {
    kind: 'number', unit: 'm',
    body: `A cyclist rides at ${v1} m/s for ${t1} s, then speeds up steadily to ${v2} m/s over the next ${t2_} s. How far does she travel in total?`,
    widget: wplot({ x: [0, t1 + t2_ + 1], y: [0, v2 + 4], xlabel: 's', ylabel: 'm/s', layers: [
      { type: 'area', f, from: 0, to: t1 + t2_, color: 'var(--c3)' }, { type: 'fn', f, from: 0, to: t1 + t2_, color: 'var(--c1)' }] }),
    answer: d, tol: 0.01,
    hint: 'Area under the velocity graph: a rectangle, then a trapezoid.',
    explain: `Rectangle ${v1} × ${t1} = ${v1 * t1} m, trapezoid ${t2_} × (${v1} + ${v2}) ÷ 2 = ${num(((v1 + v2) / 2) * t2_)} m. Total ${num(d)} m.`,
  };
};

const genLeftSum: Generator = (rng) => {
  const w = pick(rng, [0.5, 1]), n = randInt(rng, 2, 5), c = randInt(rng, 0, 2);
  const f = (x: number) => x * x + c;
  const b = n * w, s = riemann(f, 0, b, n, 0);
  const fx = c ? `x² + ${c}` : 'x²';
  return {
    kind: 'number',
    body: `Estimate the area under f(x) = ${fx} from 0 to ${num(b)} with ${n} rectangles of width ${num(w)}, each as tall as f at its **left** edge.`,
    answer: r4(s), tol: 0.01,
    hint: `Left edges: ${Array.from({ length: n }, (_, k) => num(k * w)).join(', ')}.`,
    explain: `Heights ${Array.from({ length: n }, (_, k) => num(f(k * w))).join(', ')}, each × ${num(w)}: total ${num(r4(s))}. The exact area is ${num(r4(integrate(f, 0, b)))}; left rectangles fall short because f is increasing.`,
  };
};

const genUnderOver: Generator = (rng) => {
  const inc = rng() < 0.5, left = rng() < 0.5;
  const fn = pick(rng, inc ? ['x² from 0 to 3', '√x from 1 to 9', 'x³ from 0 to 2', '2ˣ from 0 to 4'] : ['9 − x² from 0 to 3', '1 ÷ x from 1 to 5', '10 − 2x from 0 to 4']);
  const under = inc === left;
  return {
    kind: 'choice',
    body: `You estimate the area under ${fn} with rectangles whose heights come from each strip’s **${left ? 'left' : 'right'}** edge. The estimate is…`,
    options: [
      { text: 'Too small', correct: under, why: under ? undefined : `This function is ${inc ? 'increasing' : 'decreasing'}, so the ${left ? 'left' : 'right'} edge is the higher end of each strip: rectangles poke above the curve.` },
      { text: 'Too big', correct: !under, why: !under ? undefined : `This function is ${inc ? 'increasing' : 'decreasing'}, so the ${left ? 'left' : 'right'} edge is the lower end of each strip: rectangles sit below the curve.` },
      { text: 'Exactly right', why: 'Flat-topped rectangles can’t follow a curve exactly; there is always a gap or an overlap on each strip.' },
    ].map((o) => (o.correct ? { text: o.text, correct: true } : { text: o.text, why: o.why })),
    hint: `Is the function going up or down? Which edge of each strip is lower?`,
    explain: `${fn.split(' from')[0]} is ${inc ? 'increasing' : 'decreasing'} there, so each strip’s ${left ? 'left' : 'right'} edge is its ${under ? 'lowest' : 'highest'} point: the rectangles ${under ? 'miss a sliver above' : 'stick out above the curve'}. Too ${under ? 'small' : 'big'}.`,
  };
};

const area = {
  id: 'area',
  title: 'Accumulation: area under a curve',
  goal: 'Turn a rate into a total by adding up thin rectangles.',
  steps: [
    {
      kind: 'number', unit: 'm',
      body: 'A car drives at a steady 20 m/s for 6 seconds. How far does it go?',
      widget: wplot({ x: [0, 8], y: [0, 25], ticks: [1, 5], xlabel: 's', ylabel: 'm/s', layers: [
        { type: 'area', f: () => 20, from: 0, to: 6, color: 'var(--c3)' }, { type: 'fn', f: () => 20, from: 0, to: 6, color: 'var(--c1)' }] }),
      answer: 120, tol: 0.01,
      explain: '20 m every second for 6 seconds: 120 m. On the velocity graph that’s the shaded rectangle: height 20 × width 6.',
    },
    {
      kind: 'read',
      title: 'Distance is area',
      body: 'On a **velocity–time** graph, the distance travelled is the **area under the graph**. A rectangle is speed × time. If the speed changes steadily, the shape is a triangle or trapezoid, and the area still works.',
    },
    {
      kind: 'number', unit: 'm',
      body: 'A car starts from rest and speeds up steadily to 10 m/s over 4 seconds. How far does it travel?',
      widget: wplot({ x: [0, 5], y: [0, 12], ticks: [1, 2], xlabel: 's', ylabel: 'm/s', layers: [
        { type: 'area', f: (t) => 2.5 * t, from: 0, to: 4, color: 'var(--c3)' }, { type: 'fn', f: (t) => 2.5 * t, from: 0, to: 4, color: 'var(--c1)' }] }),
      answer: (4 * 10) / 2, tol: 0.01,
      hint: 'A triangle: half of base × height.',
      explain: '½ × 4 s × 10 m/s = 20 m. Same as going at its average speed, 5 m/s, for 4 s.',
    },
    {
      kind: 'read',
      title: 'Curves: chop into rectangles',
      body: 'Velocity v = t² (m/s) for 3 s. No simple shape fits, so slice the time into thin strips and treat the speed as constant on each: a rectangle per strip. More strips, better fit.',
      widget: plotExplorer({
        params: [{ id: 'n', label: 'rectangles', min: 1, max: 40, step: 1, value: 3 }],
        spec: (v) => {
          const w = 3 / v.n;
          return { x: [0, 3.2], y: [0, 10], ticks: [0.5, 2], xlabel: 's', ylabel: 'm/s', layers: [
            { type: 'bars', pts: Array.from({ length: v.n }, (_, k) => [(k + 0.5) * w, t2(k * w)] as [number, number]), width: w, color: 'var(--c3)' },
            { type: 'fn', f: t2, from: 0, to: 3, color: 'var(--c1)' }] };
        },
        readout: (v) => { const s = riemann(t2, 0, 3, v.n, 0); return `left-edge rectangles: ${num(r4(s))} m   ·   error ${num(r2((100 * (9 - s)) / 9))}%`; },
      }),
    },
    {
      kind: 'number',
      body: 'With **3** rectangles of width 1, each as tall as v = t² at its **left** edge (t = 0, 1, 2), what’s the estimate of the distance?',
      answer: riemann(t2, 0, 3, 3, 0), tol: 0.01, unit: 'm',
      explain: `Heights 0, 1, 4, each × 1: total ${riemann(t2, 0, 3, 3, 0)} m. The true distance is 9 m: left rectangles miss the sliver above each one because v is increasing.`,
    },
    {
      kind: 'task',
      body: 'Get the area estimate for v = t² (0 to 3 s, true value 9) **within 1%**, using at most 40 rectangles. You may also move where each rectangle takes its height.',
      widget: plotExplorer({
        params: [
          { id: 'n', label: 'rectangles', min: 1, max: 40, step: 1, value: 2 },
          { id: 'r', label: 'height from', min: 0, max: 2, step: 1, value: 0, format: (r) => ['left', 'middle', 'right'][r] },
        ],
        spec: (v) => {
          const w = 3 / v.n, off = v.r / 2;
          return { x: [0, 3.2], y: [0, 10], ticks: [0.5, 2], xlabel: 's', ylabel: 'm/s', layers: [
            { type: 'bars', pts: Array.from({ length: v.n }, (_, k) => [(k + 0.5) * w, t2((k + off) * w)] as [number, number]), width: w, color: 'var(--c3)' },
            { type: 'fn', f: t2, from: 0, to: 3, color: 'var(--c1)' }] };
        },
        readout: (v) => { const s = riemann(t2, 0, 3, v.n, v.r); return `estimate ${num(r4(s))}   ·   error ${num(r2((100 * Math.abs(9 - s)) / 9))}%`; },
        goal: (v) => Math.abs(riemann(t2, 0, 3, v.n, v.r) - 9) / 9 < 0.01,
        goalText: 'Under 1% off.',
      }),
      hint: 'Left or right edges need far more than 40. Try the middle of each strip.',
      explain: `Switch to **middle** heights and use ${midNeeded} or more rectangles (${midNeeded} gives ${num(r4(riemann(t2, 0, 3, midNeeded, 1)))}, error ${num(r2((100 * (9 - riemann(t2, 0, 3, midNeeded, 1))) / 9))}%). Left edges would need ${leftNeeded} rectangles: midpoints balance the gap and the overlap in each strip.`,
    },
    {
      kind: 'read',
      title: 'The exact area',
      body: `As the rectangles get thinner, every rule closes in on one number: the **exact area**, written ∫₀³ t² dt (“the integral”, a stretched S for sum). Here it’s exactly **9**: with 1,000 left rectangles you get ${num(r4(riemann(t2, 0, 3, 1000, 0)))}. Lesson 7 shows how to get 9 with no rectangles at all.`,
    },
    {
      kind: 'estimate',
      body: 'A runner’s speed rises and falls over 10 seconds. Estimate the **distance** she covers (the shaded area). Each grid box is 1 s × 2 m/s = 2 m.',
      widget: wplot({ x: [0, 10], y: [0, 12], ticks: [1, 2], xlabel: 's', ylabel: 'm/s', layers: [
        { type: 'area', f: sinV, from: 0, to: 10, color: 'var(--c3)' }, { type: 'fn', f: sinV, from: 0, to: 10, color: 'var(--c1)' }] }),
      min: 0, max: 120, step: 1, answer: Math.round(integrate(sinV, 0, 10)), tol: 8,
      format: (v) => `${v} m`,
      hint: 'If the peak lasted all 10 s it would be 100 m. The hump fills about two thirds of that box.',
      explain: `The exact area is ${num(r2(integrate(sinV, 0, 10)))} m (about 64% of the 10 × 10 box). Counting boxes, about 32 boxes of 2 m.`,
    },
    {
      kind: 'choice',
      body: 'For a velocity that keeps **increasing**, rectangles using each strip’s **left** edge give an estimate that is…',
      options: [
        { text: 'Too small', correct: true },
        { text: 'Too big', why: 'That’s right-edge rectangles: the right end of each strip is its highest point when v increases.' },
        { text: 'Exactly right if you use enough of them', why: 'More rectangles shrink the error but any fixed number still leaves a gap above each one.' },
      ],
      explain: 'The left edge is the lowest point of each strip when the curve rises, so every rectangle sits under the curve: the total is too small.',
    },
    {
      kind: 'sort',
      body: 'A velocity graph can dip **below** the axis (moving backwards). Does each piece add to or take away from your position?',
      bins: ['moves you forward', 'moves you back'],
      items: [
        { text: 'v = 3 m/s for 2 s', bin: 0 },
        { text: 'v = −1 m/s for 4 s', bin: 1 },
        { text: 'Area above the time axis', bin: 0 },
        { text: 'Area below the time axis', bin: 1 },
        { text: 'Reversing out of a driveway (forward = out of the garage)', bin: 0 },
        { text: 'Speeding up in reverse', bin: 1 },
      ],
      explain: 'Area above the axis (positive velocity) counts forward; area below (negative velocity) counts backward. Note the driveway: forward was defined as out of the garage, so reversing out is positive.',
    },
    {
      kind: 'number', unit: 'm',
      body: 'A robot moves at +4 m/s for 3 s, then at −2 m/s for 2 s. How far is it from where it started?',
      widget: wplot({ x: [0, 6], y: [-3, 5], ticks: [1, 1], xlabel: 's', ylabel: 'm/s', layers: [
        { type: 'area', f: () => 4, from: 0, to: 3, color: 'var(--c3)' }, { type: 'area', f: () => -2, from: 3, to: 5, color: 'var(--bad)' },
        { type: 'line', pts: [[0, 4], [3, 4], [3, -2], [5, -2]], color: 'var(--c1)' }] }),
      answer: 4 * 3 - 2 * 2, tol: 0.01,
      hint: 'Area above minus area below.',
      explain: '12 m forward, then 4 m back: 12 − 4 = 8 m from the start. (It travelled 16 m in total, but it is 8 m away.)',
    },
    {
      kind: 'match',
      body: 'Match each shape under a velocity graph to its distance.',
      heads: ['Shape', 'Distance'],
      pairs: [
        ['Rectangle (steady speed)', 'speed × time'],
        ['Triangle (speeding up from rest)', '½ × time × top speed'],
        ['Trapezoid (steady change between two speeds)', 'time × average of the two speeds'],
        ['Any smooth curve', 'the limit of thinner and thinner rectangles'],
      ],
      explain: 'Rectangles, triangles and trapezoids have area formulas; a curve needs the rectangle limit, the integral.',
    },
  ],
  practice: [genDistance, genLeftSum, genUnderOver],
} satisfies Course['lessons'][number];

// ================================================================ lesson 7: the fundamental theorem

const tank = (t: number) => 6 * t - t * t;
const drain = (t: number) => 4 - t;
const Adrain = (x: number) => 4 * x - (x * x) / 2;
check(Math.abs(integrate(tank, 0, 6) - 36) < 1e-9 && Math.abs(integrate(drain, 0, 7) - Adrain(7)) < 1e-9, 'tank');
const orderPts = [0.5, 7, 2, 4].map((x) => ({ x, A: Adrain(x) })).sort((p, q) => p.A - q.A);

const genFTC: Generator = (rng) => {
  const n = randInt(rng, 1, 3), m = randInt(rng, 1, 4), c = m * (n + 1), a = randInt(rng, 0, 2), b = a + randInt(rng, 1, 2);
  const F = (t: number) => m * t ** (n + 1), f = (t: number) => c * t ** n;
  const exact = F(b) - F(a);
  check(Math.abs(integrate(f, a, b) - exact) < 1e-6, 'ftc');
  return {
    kind: 'number',
    body: `What is the exact area under f(t) = ${mono(c, n).replace(/x/g, 't')} from t = ${a} to t = ${b}?`,
    answer: exact, tol: 0.01,
    hint: `Find F with slope ${mono(c, n).replace(/x/g, 't')}: try ${mono(m, n + 1).replace(/x/g, 't')}. Then F(${b}) − F(${a}).`,
    explain: `F(t) = ${mono(m, n + 1).replace(/x/g, 't')} has slope ${mono(c, n).replace(/x/g, 't')}. Area = F(${b}) − F(${a}) = ${F(b)} − ${F(a)} = ${exact}.`,
  };
};

const genAreaSlope: Generator = (rng) => {
  const p = randInt(rng, 1, 4), q = randInt(rng, 0, 6), s = randInt(rng, 1, 6);
  const f = (t: number) => p * t + q;
  const A = (x: number) => integrate(f, 0, x);
  check(Math.abs(slope(A, s, 1e-3) - f(s)) < 1e-4, 'areaSlope');
  return {
    kind: 'number', unit: 'litres per minute',
    body: `Water flows into a tank at ${p === 1 ? '' : p}t${q ? ` + ${q}` : ''} litres per minute after t minutes. How fast is the **total** in the tank growing at t = ${s}?`,
    answer: f(s), tol: 0.01,
    hint: 'The running total grows at the current rate of flow.',
    explain: `The slope of the running total is the flow rate itself: ${p}·${s}${q ? ` + ${q}` : ''} = ${f(s)} litres per minute.`,
  };
};

const genRunningMax: Generator = (rng) => {
  const c = pick(rng, [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
  const f = (t: number) => c - t;
  return {
    kind: 'point',
    body: `Water flows into a tank at ${num(c)} − t litres per minute (negative means it drains). Tap the time when the tank holds the **most** water.`,
    plot: { x: [0, 8], y: [-4, 6], ticks: [1, 1], xlabel: 'min', ylabel: 'flow', layers: [{ type: 'fn', f, color: 'var(--c1)' }] },
    answer: { x: c }, tol: 0.25, snap: 0.25,
    hint: 'The total rises while the flow is positive.',
    explain: `The total grows while ${num(c)} − t > 0 and shrinks after: it peaks at t = ${num(c)}, where the flow crosses 0, holding ${num(c * c / 2)} litres more than at the start.`,
  };
};

const ftc = {
  id: 'ftc',
  title: 'The fundamental theorem',
  goal: 'See that the slope of a running total is the original rate.',
  steps: [
    {
      kind: 'choice',
      body: 'Water pours into a tank at the rate shown (litres per minute). When does the tank hold the **most** water?',
      widget: wplot({ x: [0, 6.5], y: [0, 10], ticks: [1, 2], xlabel: 'min', ylabel: 'litres/min', layers: [{ type: 'fn', f: tank, from: 0, to: 6, color: 'var(--c1)' }] }),
      options: [
        { text: 'At 6 minutes, the end', correct: true },
        { text: 'At 3 minutes, when the flow peaks', why: 'At 3 minutes water arrives fastest, but it keeps arriving after that. The total keeps going up.' },
        { text: 'At 0 minutes', why: 'Nothing has flowed in yet: that’s the emptiest moment.' },
      ],
      explain: 'The rate is never negative, so the total only ever grows: most at the end, 36 litres. The peak rate is where the total grows **fastest**, not where it’s largest.',
    },
    {
      kind: 'read',
      title: 'The running total',
      body: 'Make a new function: **A(x) = the area under f from 0 to x**, a running total. Slide x. Green area adds; when f goes below zero, red area takes away, so the total starts falling.',
      widget: accumulator({ f: drain, x: [0, 7], fy: [-3.5, 4.5], Ay: [-1, 9], step: 0.25, start: 2, label: 'f(t) = 4 − t' }),
    },
    {
      kind: 'number',
      body: 'f(t) = 2t. What is the running total A(3), the area under f from 0 to 3?',
      widget: wplot({ x: [0, 4], y: [0, 8], ticks: [1, 1], layers: [{ type: 'area', f: (t) => 2 * t, from: 0, to: 3, color: 'var(--c3)' }, { type: 'fn', f: (t) => 2 * t, color: 'var(--c1)', label: '2t' }] }),
      answer: 9, tol: 0.01,
      hint: 'A triangle with base 3 and height 2·3.',
      explain: '½ × 3 × 6 = 9. In general the triangle up to x has area ½ · x · 2x = x². So A(x) = x².',
    },
    {
      kind: 'read',
      title: 'Why A′ = f',
      body: 'Push x a tiny bit further, to x + dx. The total gains one thin strip: about **f(x) tall and dx wide**, so A grows by f(x)·dx. Gain ÷ dx = f(x).\n\n**The slope of the running total is the function you’re adding up.** That’s the **fundamental theorem of calculus**: slopes and areas undo each other.',
      widget: wplot({ x: [0, 4], y: [0, 8], ticks: [1, 1], layers: [
        { type: 'area', f: (t) => 2 * t, from: 0, to: 2.5, color: 'var(--c3)' }, { type: 'area', f: (t) => 2 * t, from: 2.5, to: 2.8, color: 'var(--c2)' },
        { type: 'fn', f: (t) => 2 * t, color: 'var(--c1)' }, { type: 'text', x: 1.7, y: 1.2, text: 'A(x)' }, { type: 'text', x: 3.15, y: 6.1, text: 'f(x)·dx', color: 'var(--c2)', anchor: 'start' }] }),
    },
    {
      kind: 'fill',
      body: 'Check it with f(t) = 2t.',
      template: 'The running total of 2t is A(x) = [[0]]. Its slope is A′(x) = [[1]]: the original function again.',
      blanks: [{ options: ['x²', '2x²', 'x'], answer: 0 }, { options: ['2x', 'x²', '2'], answer: 0 }],
      explain: 'A(x) = x² (the triangle), and the slope of x² is 2x. Area then slope brings you back to f.',
    },
    {
      kind: 'task',
      body: 'Inflow rate f(t) = 6t − t² (top). Find the time when the **running total** (bottom) is **growing fastest**.',
      widget: accumulator({ f: tank, x: [0, 6], fy: [0, 10], Ay: [0, 40], step: 0.25, start: 0.5, label: 'f', readout: (x, A) => `t = ${num(x)}   ·   total so far ${num(r2(A))} litres`, goal: (x) => Math.abs(x - 3) < 1e-9, goalText: 'Steepest point of the total.' }),
      hint: 'The total’s slope is f. Where is f biggest?',
      explain: 'A′ = f, so A grows fastest where f peaks: t = 3, flow 9 litres/min. The bottom curve is steepest there, then keeps rising, more gently.',
    },
    {
      kind: 'multi',
      body: 'Back to f(t) = 4 − t, which is positive before t = 4 and negative after. Which are true of its running total A?',
      options: [
        { text: 'A increases until t = 4', correct: true },
        { text: 'A is largest at t = 4', correct: true },
        { text: 'A′(4) = 0', correct: true },
        { text: 'A is negative after t = 4', why: `After 4 the total falls, but from its peak of ${Adrain(4)}; it is still ${Adrain(7)} at t = 7 and only reaches 0 at t = 8.` },
        { text: 'A is largest at t = 0, where f is largest', why: 'A(0) = 0: nothing has been added yet. A big f means A grows fast, not that A is big.' },
      ],
      explain: `A′ = f: positive before 4 (A rising), zero at 4 (the peak, A = ${Adrain(4)}), negative after (A falling). Falling isn’t the same as negative: A(7) = ${Adrain(7)}.`,
    },
    {
      kind: 'order',
      body: 'Still f(t) = 4 − t. Order these running totals, smallest first.',
      items: orderPts.map((p) => `total up to t = ${num(p.x)}`),
      hint: 'A(x) = 4x − x²/2. Or think: it rises until 4, then gives some back.',
      explain: `A(x) = 4x − x²/2: ${orderPts.map((p) => `A(${num(p.x)}) = ${num(p.A)}`).join(', ')}. The total up to 7 is smaller than up to 2, because of the draining after t = 4.`,
    },
    {
      kind: 'read',
      title: 'Exact areas without rectangles',
      body: `To find the area under f from a to b: find any **F whose slope is f**, then\n\n**area = F(b) − F(a)**\n\nFor t² from 0 to 3: F(t) = t³ ÷ 3 has slope t². Area = 27 ÷ 3 − 0 = **9**. The 1,000 rectangles from last lesson gave ${num(r4(riemann(t2, 0, 3, 1000, 0)))}, edging towards exactly this.`,
    },
    {
      kind: 'number',
      body: 'Using F(t) = t³ (whose slope is 3t²), what is the area under 3t² from t = 1 to t = 2?',
      answer: 2 ** 3 - 1 ** 3, tol: 0.01,
      hint: 'F(2) − F(1).',
      explain: `8 − 1 = 7. (Numerically: ${num(r4(integrate((t) => 3 * t * t, 1, 2)))}.)`,
    },
    {
      kind: 'choice',
      body: 'f(t) is a car’s **velocity**, and F′ = f. What does F measure?',
      options: [
        { text: 'Its position (distance along the road)', correct: true },
        { text: 'Its acceleration', why: 'Acceleration is the slope of velocity: one step the other way, f′ not F.' },
        { text: 'Its top speed', why: 'F is a running total of velocity over time, which is distance covered.' },
      ],
      explain: 'Position’s slope is velocity, and the area under velocity is distance travelled. Position, velocity and acceleration are each the slope of the one before.',
    },
    {
      kind: 'match',
      body: 'Match each rate f to its running total from 0 (the F with F′ = f and F(0) = 0).',
      heads: ['f(x)', 'running total'],
      pairs: [['2x', 'x²'], ['3x²', 'x³'], ['5', '5x'], ['x', 'x² ÷ 2']],
      hint: 'Check each by taking the slope of the right-hand side.',
      explain: 'Slopes: x² → 2x; x³ → 3x²; 5x → 5; x² ÷ 2 → x. Each running total starts at 0 when x = 0.',
    },
  ],
  practice: [genFTC, genAreaSlope, genRunningMax],
} satisfies Course['lessons'][number];

// ================================================================ lesson 8: exponentials & change

const compRows = [1, 2, 12, 365, 1e6].map((n) => [n === 1e6 ? '1,000,000' : num(n), '$' + ((1 + 1 / n) ** n).toFixed(5)]);
const eulerE = (n: number) => (1 + 1 / n) ** n;
const eulerNeeded = (() => { let n = 1; while (Math.E - eulerE(n) >= 0.05) n++; return n; })();
const dbl7 = Math.log(2) / 0.07;

const genDoubling: Generator = (rng) => {
  const r = pick(rng, [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12]);
  const T = Math.log(2) / (r / 100);
  return {
    kind: 'number', unit: 'years',
    body: `Something grows continuously at ${r}% a year (its growth rate is always ${r / 100} × its size). How many years until it **doubles**?`,
    answer: r2(T), tol: Math.max(0.05, T * 0.01),
    hint: 'Solve e^(kt) = 2: t = ln 2 ÷ k, with ln 2 ≈ 0.693.',
    explain: `t = 0.693 ÷ ${r / 100} = ${num(r2(T))} years. The rule of 70 gives 70 ÷ ${r} = ${num(r2(70 / r))}.`,
  };
};

const genHalfLife: Generator = (rng) => {
  const T = pick(rng, [3, 5, 8, 10, 12, 30, 1600, 5730]), k = randInt(rng, 1, 5);
  const unit = T >= 1000 ? 'years' : pick(rng, ['hours', 'days', 'minutes']);
  return {
    kind: 'number', prob: true,
    body: `A substance has a half-life of ${num(T)} ${unit}. What fraction of it is left after ${num(k * T)} ${unit}?`,
    answer: 0.5 ** k, tol: 0.001,
    hint: `How many half-lives is ${num(k * T)} ${unit}?`,
    explain: `${num(k * T)} ÷ ${num(T)} = ${k} half-li${k === 1 ? 'fe' : 'ves'}: (1/2)${SUP[k]} = ${num(0.5 ** k)} (1/${2 ** k}).`,
  };
};

const genEuler: Generator = (rng) => {
  const y0 = pick(rng, [1, 2, 10, 100]), k = pick(rng, [1, 0.5, 2, -0.5]), dt = pick(rng, [0.5, 0.25, 0.1]), n = randInt(rng, 2, 3);
  let y = y0;
  const rows: string[] = [];
  for (let i = 0; i < n; i++) { const yn = y + k * y * dt; rows.push(num(r4(yn))); y = yn; }
  return {
    kind: 'number',
    body: `Euler’s method for y′ = ${k === 1 ? '' : num(k) + '·'}y, starting at y = ${y0}: take ${n} steps of size ${num(dt)} (each step: y ← y + slope × ${num(dt)}). What y do you reach?`,
    answer: r4(y), tol: Math.max(0.001, Math.abs(y) * 0.002),
    hint: `Each step multiplies y by 1 + ${num(k)} × ${num(dt)} = ${num(1 + k * dt)}.`,
    explain: `Each step: y × ${num(1 + k * dt)}. ${y0} → ${rows.join(' → ')}. (The exact value ${num(y0)}·e^(${num(k * dt * n)}) is ${num(r4(y0 * Math.exp(k * dt * n)))}.)`,
  };
};

const exp = {
  id: 'exp',
  title: 'Exponentials & change',
  goal: 'Use eˣ, continuous growth, half-lives and small steps.',
  steps: [
    {
      kind: 'choice',
      body: 'A bank pays 100% interest a year. Once a year, $1 becomes $2. Half the rate twice a year: $2.25. If it adds interest more and more often (monthly, daily, every second), what happens to $1 after one year?',
      options: [
        { text: 'It settles towards about $2.72', correct: true },
        { text: 'It grows without limit', why: 'More frequent compounding helps less and less: each piece of interest is smaller. The totals level off.' },
        { text: 'It stays $2: the yearly rate is the same', why: 'Compounding pays interest on interest, so more often means a bit more: $2.25 at twice a year already beats $2.' },
      ],
      explain: '(1 + 1/n)ⁿ for n = 1, 2, 12, 365… is 2, 2.25, 2.613, 2.7146…, closing in on 2.71828…, the number **e**.',
    },
    {
      kind: 'read',
      title: 'The number e',
      body: 'Compounding n times a year at 100%:',
      widget: () => dataTable(['times per year', '$1 becomes'], compRows, { highlight: [4] }),
    },
    {
      kind: 'read',
      title: 'Slope equals height',
      body: 'Growth where **the rate is proportional to the amount** is exponential. The curve y = eˣ is special: its slope at every point **equals its height**. Slide along and compare.',
      widget: plotExplorer({
        params: [{ id: 'x', label: 'x', min: -2, max: 2, step: 0.25, value: 0 }],
        spec: (v) => ({ x: [-2.5, 2.5], y: [0, 8], ticks: [0.5, 1], layers: [
          { type: 'fn', f: Math.exp, color: 'var(--c1)', label: 'eˣ' }, tangent(Math.exp, v.x, { from: v.x - 1.2, to: v.x + 1.2 }),
          { type: 'dots', pts: [[v.x, Math.exp(v.x)]], color: 'var(--c2)' }] }),
        readout: (v) => `height ${num(r4(Math.exp(v.x)))}   ·   slope ${num(r4(slope(Math.exp, v.x)))}`,
      }),
    },
    {
      kind: 'task',
      body: 'Every curve bˣ has height 1 at x = 0. Find the base b whose slope at x = 0 is **1** (its tangent there matches the dashed line y = 1 + x).',
      widget: plotExplorer({
        params: [{ id: 'b', label: 'base b', min: 1.5, max: 4, step: 0.05, value: 2, format: (b) => b.toFixed(2) }],
        spec: (v) => {
          const f = (x: number) => v.b ** x;
          return { x: [-1.5, 1.5], y: [0, 4], ticks: [0.5, 1], layers: [
            { type: 'fn', f: (x) => 1 + x, color: 'var(--muted)', dash: true },
            { type: 'fn', f, color: 'var(--c1)' }, tangent(f, 0, { dash: false, width: 2 }), { type: 'dots', pts: [[0, 1]], color: 'var(--c2)' }] };
        },
        readout: (v) => `slope of ${v.b.toFixed(2)}ˣ at x = 0: ${num(r4(slope((x) => v.b ** x, 0)))}`,
        goal: (v) => Math.abs(slope((x) => v.b ** x, 0) - 1) < 0.02,
        goalText: 'Slope 1: that base is e.',
      }),
      hint: '2ˣ is too shallow (slope 0.69), 3ˣ slightly too steep (1.10).',
      explain: `b = 2.70 or 2.75 (slopes ${num(r4(Math.log(2.7)))} and ${num(r4(Math.log(2.75)))}). The exact base is e ≈ 2.71828: the same number as from compounding.`,
    },
    {
      kind: 'number', unit: 'million per year',
      body: 'A population grows continuously: its growth rate is always 0.03 × its size, per year. When it is 5 million, how fast is it growing?',
      answer: 0.03 * 5, tol: 0.001,
      explain: '0.03 × 5 = 0.15 million (150,000) per year. At 10 million it would grow twice as fast: rate proportional to size.',
    },
    {
      kind: 'read',
      title: 'Continuous growth',
      body: 'If y′ = k·y (rate proportional to amount) then **y = y₀·e^(kt)**. It doubles every ln 2 ÷ k = 0.693 ÷ k. For a growth rate of r% that’s about **70 ÷ r**: the rule of 70.',
      widget: wplot({ x: [0, 40], y: [0, 9], ticks: [10, 1], xlabel: 'years', ylabel: '× start', layers: [
        { type: 'fn', f: (t) => Math.exp(0.05 * t), color: 'var(--c1)', label: '5%' },
        { type: 'dots', pts: [1, 2, 3].map((k) => [k * Math.log(2) / 0.05, 2 ** k] as [number, number]), color: 'var(--c2)', labels: ['×2', '×4', '×8'] }] }),
    },
    {
      kind: 'estimate',
      body: 'At 7% continuous growth a year, about how many years does it take to **double**?',
      min: 0, max: 30, step: 0.5, answer: Math.round(dbl7 * 2) / 2, tol: 1,
      format: (v) => `${v} years`,
      hint: 'Rule of 70.',
      explain: `ln 2 ÷ 0.07 = ${num(r2(dbl7))} years; rule of 70: 70 ÷ 7 = 10.`,
    },
    {
      kind: 'read',
      title: 'Decay and half-life',
      body: 'With k negative the amount shrinks in proportion to what’s left: **exponential decay**. It loses half in a fixed time, the **half-life**, whatever amount you start with.',
      widget: wplot({ x: [0, 4.2], y: [0, 1.1], ticks: [1, 0.25], xlabel: 'half-lives', ylabel: 'fraction left', layers: [
        { type: 'fn', f: (t) => 0.5 ** t, color: 'var(--c1)' },
        { type: 'dots', pts: [0, 1, 2, 3, 4].map((k) => [k, 0.5 ** k] as [number, number]), color: 'var(--c2)', labels: ['1', '1/2', '1/4', '1/8', '1/16'] }] }),
    },
    {
      kind: 'number', prob: true,
      body: 'Carbon-14 has a half-life of about 5,730 years. What fraction of a sample’s carbon-14 remains after 17,190 years?',
      answer: 0.5 ** (17190 / 5730), tol: 0.002,
      hint: '17,190 ÷ 5,730 half-lives.',
      explain: `17,190 ÷ 5,730 = ${17190 / 5730} half-lives: ½ × ½ × ½ = 1/8 = ${num(0.5 ** 3)}.`,
    },
    {
      kind: 'read',
      title: 'Small steps: Euler’s method',
      body: 'Know the slope rule but not the curve? Walk: from where you are, step a little in the direction of the slope.\n\n**y_new = y + slope × step**\n\nFor y′ = y starting at 1, steps of 1/n: each step multiplies y by (1 + 1/n). After n steps, at x = 1, you have (1 + 1/n)ⁿ: the compounding formula again.',
    },
    {
      kind: 'task',
      body: `Use Euler’s method for y′ = y from y(0) = 1 to estimate **e = y(1)**. Use enough steps to get **within 0.05** of e ≈ ${num(r4(Math.E))}.`,
      widget: plotExplorer({
        params: [{ id: 'n', label: 'steps', min: 1, max: 60, step: 1, value: 2 }],
        spec: (v) => {
          const pts: [number, number][] = [[0, 1]];
          for (let k = 1; k <= v.n; k++) pts.push([k / v.n, pts[k - 1][1] * (1 + 1 / v.n)]);
          return { x: [0, 1.05], y: [0.8, 3], ticks: [0.25, 0.5], layers: [
            { type: 'fn', f: Math.exp, color: 'var(--muted)', dash: true, label: 'eˣ' },
            { type: 'line', pts, color: 'var(--c2)' }, ...(v.n <= 30 ? [{ type: 'dots', pts, color: 'var(--c2)', r: 3 } as Layer] : [])] };
        },
        readout: (v) => `estimate ${num(r4(eulerE(v.n)), 6)}   ·   short by ${num(r4(Math.E - eulerE(v.n)))}`,
        goal: (v) => Math.E - eulerE(v.n) < 0.05,
        goalText: 'Within 0.05 of e.',
      }),
      hint: 'Each step follows the tangent, so it undershoots a curve that bends up. Smaller steps, smaller error.',
      explain: `You need ${eulerNeeded} steps or more: ${eulerNeeded} steps give ${num(r4(eulerE(eulerNeeded)))} (short by ${num(r4(Math.E - eulerE(eulerNeeded)))}); ${eulerNeeded - 1} give ${num(r4(eulerE(eulerNeeded - 1)))}. The error shrinks roughly like 1/n.`,
    },
    {
      kind: 'fill',
      body: 'One Euler step.',
      template: 'y_new = y + [[0]] × [[1]]',
      blanks: [{ options: ['slope', 'height', 'y²'], answer: 0 }, { options: ['step size', 'total time', 'y'], answer: 0 }],
      explain: 'Follow the slope for one small step: the change in y is about slope × step size, the same tangent-line idea as the derivative.',
    },
    {
      kind: 'sort',
      body: 'Exponential growth or exponential decay?',
      bins: ['growth (k > 0)', 'decay (k < 0)'],
      items: [
        { text: 'Money earning compound interest', bin: 0 },
        { text: 'Hot coffee’s temperature gap to the room', bin: 1 },
        { text: 'Carbon-14 in an old bone', bin: 1 },
        { text: 'Bacteria in a dish with plenty of food', bin: 0 },
        { text: 'A drug clearing from the blood', bin: 1 },
        { text: 'Early spread of a viral video', bin: 0 },
      ],
      explain: 'Each changes at a rate proportional to its current size. Interest, bacteria and early sharing grow; the coffee’s temperature gap, carbon-14 and a drug dose shrink by a fixed fraction per unit time.',
    },
  ],
  practice: [genDoubling, genHalfLife, genEuler],
} satisfies Course['lessons'][number];

// ================================================================ course

export const calculus: Course = {
  id: 'calculus',
  title: 'Calculus Intuition',
  blurb: 'Slopes and areas from pictures: speed, the derivative, optimising, accumulating and growth.',
  color: COLOR,
  icon: '🎢',
  lessons: [rates, derivative, rules, reading, optimise, area, ftc, exp],
};
