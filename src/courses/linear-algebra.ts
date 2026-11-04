// Linear Algebra: vectors as arrows, length and the dot product, span, matrices as moves of the
// plane, composing them, the determinant as area scaling, solving Ax = b, and eigenvectors.
// Geometric first: every matrix is "where î and ĵ land". Every number shown is computed here.
import type { Choice, Course, Generator, Layer } from '../types';
import { pct, pick, randInt } from '../ui';
import { dataTable } from '../viz/charts';
import { plotExplorer } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  type M, type V, CA, CB, CI, CT, ID, add, apply, arrow, cols, composeSteps, cross, det, dot, dragPlane, eigenPlane, gridLayers,
  eqn, fromCols, imagesFig, inv, len, ms, mul, mulS, n, planeFig, planeSpec, polyL, sameM, sameV, spanPlane, sub,
  transformFig, transformLayers, transformPlane, vs, withEqn,
} from '../widgets/linear-algebra';

const COLOR = '#4a6fd1';

function check(cond: boolean, what: string) { if (!cond) throw new Error('linear-algebra: ' + what); }
/** Drop distractors whose text repeats the answer or each other (generated numbers can collide). */
function opts(right: Choice, wrong: Choice[]): Choice[] {
  const seen = new Set([right.text]);
  const out: Choice[] = [{ ...right, correct: true }];
  for (const w of wrong) if (!seen.has(w.text)) { seen.add(w.text); out.push(w); }
  return out;
}
/** Tiles for one fill blank: the right one plus distinct wrong ones. */
function tiles(right: number, wrong: number[]): { options: string[]; answer: number } {
  const o = [n(right)];
  for (const w of wrong) if (!o.includes(n(w))) o.push(n(w));
  return { options: o, answer: 0 };
}
/** A number in parentheses when negative, for use after an operator: 3 × (−2). */
const pn = (x: number) => (x < 0 ? `(${n(x)})` : n(x));
const nz = (rng: () => number, lo: number, hi: number) => { let x = 0; while (!x) x = randInt(rng, lo, hi); return x; };
const rv = (rng: () => number, lo: number, hi: number): V => { let v: V = [0, 0]; while (!v[0] && !v[1]) v = [randInt(rng, lo, hi), randInt(rng, lo, hi)]; return v; };
const rm = (rng: () => number, lo: number, hi: number): M => [randInt(rng, lo, hi), randInt(rng, lo, hi), randInt(rng, lo, hi), randInt(rng, lo, hi)];
/** A target dot with its label kept inside the plot. */
const tgt = (p: V, label = 'target'): Layer[] => [
  { type: 'dots', pts: [p], color: CT },
  { type: 'text', x: p[0] + (p[0] > 1 ? -0.3 : 0.3), y: p[1] + 0.45, text: label, color: CT, anchor: p[0] > 1 ? 'end' : 'start' },
];
const inBox = (v: V, r: number) => Math.abs(v[0]) <= r && Math.abs(v[1]) <= r;
const deg = (u: V, v: V) => (Math.acos(dot(u, v) / (len(u) * len(v))) * 180) / Math.PI;

const MOVES: { name: string; m: M }[] = [
  { name: 'rotate 90° counter-clockwise', m: [0, -1, 1, 0] },
  { name: 'rotate 90° clockwise', m: [0, 1, -1, 0] },
  { name: 'rotate 180°', m: [-1, 0, 0, -1] },
  { name: 'reflect in the x-axis', m: [1, 0, 0, -1] },
  { name: 'reflect in the y-axis', m: [-1, 0, 0, 1] },
  { name: 'reflect in the line y = x', m: [0, 1, 1, 0] },
];

// ================================================================ lesson 1: vectors as arrows

const L1 = {
  a: [3, 1] as V, b: [1, 2] as V,
  p: [5, -2] as V, q: [-1, 4] as V,
  v: [2, 1] as V, k: -1.5,
  P: [1, 2] as V, Q: [6, -1] as V,
};

const genAdd: Generator = (rng) => {
  let a: V, b: V;
  do { a = rv(rng, -4, 4); b = rv(rng, -4, 4); } while (!inBox(add(a, b), 5) || cross(a, b) === 0 || sameV(add(a, b), [0, 0]));
  const s = add(a, b);
  return {
    kind: 'point',
    body: `a = ${vs(a)} and b = ${vs(b)}. Place the tip of **a + b**.`,
    plot: planeSpec([arrow(a, CA, 'a'), arrow(b, CB, 'b')]),
    answer: { x: s[0], y: s[1] }, tol: 0.3, snap: 1,
    hint: 'Walk a, then walk b from where a ends. Or just add the x’s and the y’s.',
    explain: `Add the components: (${n(a[0])} + ${pn(b[0])}, ${n(a[1])} + ${pn(b[1])}) = ${vs(s)}.`,
  };
};

const genCombo: Generator = (rng) => {
  const a = rv(rng, -5, 5), b = rv(rng, -5, 5);
  const k = pick(rng, [2, 3, -1, -2]), m = pick(rng, [1, -1, 2, -3]);
  const c = add(mulS(k, a), mulS(m, b));
  const which = randInt(rng, 0, 1);
  const term = (x: number, name: string, first: boolean) => (x === 1 ? (first ? name : `+ ${name}`) : x === -1 ? (first ? `−${name}` : `− ${name}`) : x < 0 ? (first ? `−${-x}${name}` : `− ${-x}${name}`) : first ? `${x}${name}` : `+ ${x}${name}`);
  const expr = `${term(k, 'a', true)} ${term(m, 'b', false)}`;
  return {
    kind: 'number',
    body: `a = ${vs(a)}, b = ${vs(b)}. What is the **${which ? 'y' : 'x'}-component** of ${expr}?`,
    answer: c[which], tol: 0.01,
    hint: 'Scale each vector (multiply both its numbers), then add component by component.',
    explain: `${n(k)} × ${pn(a[which])} + ${pn(m)} × ${pn(b[which])} = ${n(c[which])}. The whole vector is ${vs(c)}.`,
  };
};

const genDisplacement: Generator = (rng) => {
  let P: V, Q: V;
  do { P = [randInt(rng, -5, 5), randInt(rng, -5, 5)]; Q = [randInt(rng, -5, 5), randInt(rng, -5, 5)]; } while (sameV(P, Q) || P[0] === Q[0] || P[1] === Q[1]);
  const d = sub(Q, P);
  return {
    kind: 'choice',
    body: `A robot stands at P${vs(P)} and must drive to Q${vs(Q)}. Which vector is the move it has to make?`,
    options: opts({ text: vs(d), why: 'Destination minus start.' }, [
      { text: vs(sub(P, Q)), why: 'That’s start minus destination: the move from Q back to P.' },
      { text: vs(add(P, Q)), why: 'Adding two positions doesn’t mean anything here; the move is the difference Q − P.' },
      { text: vs([d[1], d[0]]), why: 'The components are swapped: x is the across part, y the up part.' },
    ]),
    hint: 'Where it ends minus where it starts.',
    explain: `Q − P = (${n(Q[0])} − ${pn(P[0])}, ${n(Q[1])} − ${pn(P[1])}) = ${vs(d)}.`,
  };
};

const addPlane = dragPlane({
  handles: [{ at: L1.a, color: CA }, { at: L1.b, color: CB }],
  layers: ([a, b]) => [
    { type: 'line', pts: [a, add(a, b)], color: CB, dash: true, width: 2 },
    { type: 'line', pts: [b, add(a, b)], color: CA, dash: true, width: 2 },
    arrow(add(a, b), CT, 'a + b'), arrow(a, CA, 'a'), arrow(b, CB, 'b'),
  ],
  readout: ([a, b]) => `a = ${vs(a)}, b = ${vs(b)}, a + b = ${vs(add(a, b))}`,
});

const scaleTask = plotExplorer({
  params: [{ id: 'k', label: 'k', min: -3, max: 3, step: 0.5, value: 2 }],
  spec: (p) => planeSpec([...tgt(mulS(L1.k, L1.v)), arrow(mulS(p.k, L1.v), CB, 'k·v'), arrow(L1.v, CA, 'v')]),
  readout: (p) => `k = ${n(p.k)}: k·v = ${vs(mulS(p.k, L1.v))}, ${n(Math.abs(p.k))} times as long${p.k < 0 ? ', pointing backwards' : ''}`,
  goal: (p) => p.k === L1.k,
  goalText: `k = ${n(L1.k)}: one and a half times as long, turned round.`,
});

// ================================================================ lesson 2: length and dot product

const L2 = {
  v: [3, 4] as V, P: [1, 2] as V, Q: [7, 10] as V,
  d1: [2, 3] as V, d2: [4, -1] as V,
  perpA: [3, 1] as V,
  F: [10, 5] as V, road: [3, 4] as V,
  ann: [4, 1] as V, ben: [8, 3] as V, cat: [2, 2] as V, dan: [1, 4] as V,
};

const projLayers = (a: V, b: V): Layer[] => {
  const pr = mulS(dot(a, b) / dot(a, a), a);
  return [
    { type: 'line', pts: [b, pr], color: 'var(--muted)', dash: true, width: 1.5 },
    { type: 'line', pts: [[0, 0], pr], color: CT, width: 6 },
    arrow(a, CA, 'a'), arrow(b, CB, 'b'),
  ];
};
const dotPlane = dragPlane({
  handles: [{ at: [4, 1], color: CA }, { at: [1, 3], color: CB }],
  layers: ([a, b]) => (len(a) ? projLayers(a, b) : [arrow(a, CA, 'a'), arrow(b, CB, 'b')]),
  readout: ([a, b]) => {
    const d = dot(a, b);
    if (!len(a) || !len(b)) return `a · b = ${n(d)} (a zero vector has no direction)`;
    return `a · b = ${n(a[0])}×${pn(b[0])} + ${pn(a[1])}×${pn(b[1])} = ${n(d)} · angle ${Math.round(deg(a, b))}° · ${d > 0 ? 'mostly the same way' : d < 0 ? 'mostly opposite' : 'perpendicular'}`;
  },
});
const perpTask = dragPlane({
  handles: [{ at: [2, 3], color: CB }],
  layers: ([b]) => [arrow(L2.perpA, CA, 'a'), arrow(b, CB, 'b')],
  readout: ([b]) => `a · b = ${n(L2.perpA[0])}×${pn(b[0])} + ${pn(L2.perpA[1])}×${pn(b[1])} = ${n(dot(L2.perpA, b))}`,
  goal: ([b]) => len(b) > 0 && dot(L2.perpA, b) === 0,
  goalText: 'Dot product 0: a right angle.',
});

const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25]];
const genDistance: Generator = (rng) => {
  const [p, q, c] = pick(rng, TRIPLES);
  const sw = rng() < 0.5;
  const d: V = [(sw ? q : p) * pick(rng, [1, -1]), (sw ? p : q) * pick(rng, [1, -1])];
  const P: V = [randInt(rng, -9, 9), randInt(rng, -9, 9)];
  const Q = add(P, d);
  check(Math.abs(len(d) - c) < 1e-9, 'triple');
  return {
    kind: 'number',
    body: `How far apart are the points P${vs(P)} and Q${vs(Q)}?`,
    answer: len(d), tol: 0.01,
    hint: 'Find the vector Q − P, then its length: √(x² + y²).',
    explain: `Q − P = ${vs(d)}, and √(${pn(d[0])}² + ${pn(d[1])}²) = √${n(dot(d, d))} = ${n(c)}.`,
  };
};

const genDot: Generator = (rng) => {
  const a = rv(rng, -6, 6), b = rv(rng, -6, 6);
  const d = dot(a, b);
  return {
    kind: 'number',
    body: `a = ${vs(a)}, b = ${vs(b)}. Compute **a · b**.${d === 0 ? '' : ' Then think: is the angle between them under or over 90°?'}`,
    answer: d, tol: 0.01,
    hint: 'Multiply the x’s, multiply the y’s, add.',
    explain: `${n(a[0])}×${pn(b[0])} + ${pn(a[1])}×${pn(b[1])} = ${n(d)}: ${d > 0 ? 'positive, so the angle is under 90°' : d < 0 ? 'negative, so the angle is over 90°' : 'zero, so they are perpendicular'}.`,
  };
};

const genPerp: Generator = (rng) => {
  const p = nz(rng, -5, 5), q = pick(rng, [1, 2, 3, -1, -2]), t = nz(rng, -3, 3);
  const x = q * t, y = -p * t;
  check(p * x + q * y === 0, 'perp');
  return {
    kind: 'number',
    body: `For which y is (${n(x)}, y) perpendicular to (${n(p)}, ${n(q)})?`,
    answer: y, tol: 0.01,
    hint: 'Perpendicular means the dot product is 0.',
    explain: `${n(p)}×${pn(x)} + ${pn(q)}×y = 0, so ${q === 1 ? '' : q === -1 ? '−' : n(q)}y = ${n(-p * x)} and y = ${n(y)}.`,
  };
};

// ================================================================ lesson 3: span

const L3 = {
  a: [2, 1] as V, b: [1, 3] as V, t: [5, 5] as V,
  p: [1, 2] as V, q: [2, -1] as V, pc: 3, qc: -2,
  par: [2, 4] as V,
  u: [1, 1] as V, w: [3, 1] as V, tgt: [8, 4] as V,
};
/** Coefficients (c, d) with c·a + d·b = t (a, b not parallel). */
const coeffs = (a: V, b: V, t: V): V => apply(inv(fromCols(a, b)), t);
const L3c = coeffs(L3.a, L3.b, L3.t);
const L3d = coeffs(L3.u, L3.w, L3.tgt);
check(L3c.every(Number.isInteger) && L3d.every(Number.isInteger), 'L3 coefficients');

const mixTask = plotExplorer({
  params: [
    { id: 'c', label: 'amount of a', min: -3, max: 3, step: 1, value: 0 },
    { id: 'd', label: 'amount of b', min: -3, max: 3, step: 1, value: 0 },
  ],
  spec: (p) => {
    const ca = mulS(p.c, L3.a), r = add(ca, mulS(p.d, L3.b));
    return planeSpec([
      ...tgt(L3.t),
      ...(p.c ? [arrow(ca, CA, `${n(p.c)}a`)] : []), ...(p.d ? [arrow(mulS(p.d, L3.b), CB, `${n(p.d)}b`, ca)] : []),
      { type: 'dots', pts: [r], color: 'var(--text)', r: 3.5 },
    ], 6);
  },
  readout: (p) => `${n(p.c)}·a + ${pn(p.d)}·b = ${vs(add(mulS(p.c, L3.a), mulS(p.d, L3.b)))}`,
  goal: (p) => sameV(add(mulS(p.c, L3.a), mulS(p.d, L3.b)), L3.t),
  goalText: `${n(L3c[0])} of a and ${n(L3c[1])} of b reach ${vs(L3.t)}.`,
});

const genCoeffs: Generator = (rng) => {
  let a: V, b: V, c: number, d: number, t: V;
  do {
    a = rv(rng, -3, 3); b = rv(rng, -3, 3); c = randInt(rng, -3, 3); d = randInt(rng, -3, 3);
    t = add(mulS(c, a), mulS(d, b));
  } while (cross(a, b) === 0 || !c || !d || !inBox(t, 6));
  const askC = rng() < 0.5;
  const back = coeffs(a, b, t);
  check(Math.abs(back[0] - c) < 1e-9 && Math.abs(back[1] - d) < 1e-9, 'coeffs');
  return {
    kind: 'number',
    body: `Write ${vs(t)} = c·a + d·b with a = ${vs(a)} and b = ${vs(b)}. What is **${askC ? 'c' : 'd'}**?`,
    widget: planeFig([arrow(a, CA, 'a'), arrow(b, CB, 'b'), ...tgt(t)], 6),
    answer: askC ? c : d, tol: 0.01,
    hint: 'Two equations, one for x and one for y: solve them like any 2×2 system.',
    explain: `x: ${n(a[0])}c + ${pn(b[0])}d = ${n(t[0])}; y: ${n(a[1])}c + ${pn(b[1])}d = ${n(t[1])}. They give c = ${n(c)}, d = ${n(d)}. Check: ${n(c)}·${vs(a)} + ${pn(d)}·${vs(b)} = ${vs(t)}.`,
  };
};

const genInSpan: Generator = (rng) => {
  const v = rv(rng, -3, 3);
  const k = pick(rng, [2, 3, -1, -2, 0.5, -3]);
  let w: V = mulS(k, v);
  const on = rng() < 0.5;
  if (!on) w = add(w, pick(rng, [[1, 0], [0, 1], [-1, 0], [0, -1]] as V[]));
  const isOn = cross(v, w) === 0;
  return {
    kind: 'choice',
    body: `Using only v = ${vs(v)}, stretched or flipped by any amount, can you reach ${vs(w)}?`,
    options: [
      { text: 'Yes', correct: isOn, why: isOn ? `${vs(w)} = ${n(dot(v, w) / dot(v, v))} × ${vs(v)}.` : `To reach it you need some k with k·${vs(v)} = ${vs(w)}, but the x-part and the y-part ask for different k: the point is off v’s line.` },
      { text: 'No', correct: !isOn, why: isOn ? `It is reachable: ${vs(w)} = ${n(dot(v, w) / dot(v, v))} × ${vs(v)}, which is on v’s line.` : 'Right: one vector’s span is a single line through the origin, and this point is off it.' },
    ],
    hint: 'The span of one vector is the line through the origin along it. Is there one k with k·v equal to the point?',
    explain: isOn ? `${vs(w)} is ${n(dot(v, w) / dot(v, v))} times v, so it sits on v’s line.`
      : v[0] && v[1] ? `The x-part needs k = ${n(w[0] / v[0])}, the y-part needs k = ${n(w[1] / v[1])}. No single k works, so ${vs(w)} is off v’s line.`
      : `v has a 0 component, so every k·v does too, and ${vs(w)} doesn’t: it’s off v’s line.`,
  };
};

const genSpanKind: Generator = (rng) => {
  const a = rv(rng, -4, 4);
  const b: V = rng() < 0.5 ? mulS(pick(rng, [2, -1, -2, 3]), a) : rv(rng, -4, 4);
  const plane = cross(a, b) !== 0;
  return {
    kind: 'choice',
    body: `What is the span of a = ${vs(a)} and b = ${vs(b)}: every point you can reach as c·a + d·b?`,
    options: [
      { text: 'The whole plane', correct: plane, why: plane ? 'Right: b isn’t a multiple of a, so they point different ways and together reach every point.' : `b = ${n(dot(a, b) / dot(a, a))}·a: they lie on one line, so every mix stays on it.` },
      { text: 'A line through the origin', correct: !plane, why: plane ? 'They point in different directions, so mixing them can head anywhere.' : `Right: b is just ${n(dot(a, b) / dot(a, a))} times a.` },
      { text: 'Just the origin', why: 'Only the zero vector spans just the origin; these aren’t zero.' },
    ],
    hint: 'Is b a multiple of a?',
    explain: plane ? `${n(a[0])}×${pn(b[1])} − ${pn(a[1])}×${pn(b[0])} = ${n(cross(a, b))} ≠ 0, so a and b aren’t on one line. Two directions reach everything.` : `b = ${n(dot(a, b) / dot(a, a))}·a, so both lie on one line, and so does every combination.`,
  };
};

// ================================================================ lesson 4: matrices move the plane

const L4 = {
  M1: fromCols([2, 0], [1, 1]), v1: [1, 2] as V,
  rot: [0, -1, 1, 0] as M,
  M2: [3, 1, -1, 2] as M, v2: [2, 1] as V,
  M3: [1, -1, 1, 1] as M, v3: [2, 1] as V,
  target: fromCols([2, 1], [-1, 1]),
  bake: fromCols([2, 1], [3, 4]), order: [5, 2] as V,
};

const genApply: Generator = (rng) => {
  let m: M, v: V, w: V;
  do { m = rm(rng, -2, 2); v = rv(rng, -2, 2); w = apply(m, v); } while (det(m) === 0 || sameM(m, ID) || !inBox(w, 5) || !inBox(cols(m)[0], 4) || !inBox(cols(m)[1], 4));
  const [i, j] = cols(m);
  return {
    kind: 'point',
    body: `This matrix sends î to ${vs(i)} and ĵ to ${vs(j)}. Where does v = ${vs(v)} land?`,
    plot: planeSpec(transformLayers(m, false)),
    answer: { x: w[0], y: w[1] }, tol: 0.3, snap: 1,
    hint: `v = ${n(v[0])}·î + ${pn(v[1])}·ĵ, so it lands on ${n(v[0])}·(where î went) + ${pn(v[1])}·(where ĵ went).`,
    explain: `${n(v[0])}·${vs(i)} + ${pn(v[1])}·${vs(j)} = ${vs(w)}. On the picture: ${n(v[0])} steps along the green arrow, ${n(v[1])} along the pink one.`,
  };
};

const genReadMatrix: Generator = (rng) => {
  let m: M;
  do { m = rm(rng, -3, 3); } while (det(m) === 0 || m[1] === m[2] || !inBox(cols(m)[0], 4) || !inBox(cols(m)[1], 4));
  const [i, j] = cols(m);
  return {
    kind: 'choice',
    body: `The grid has been transformed. Green î shows where (1, 0) went: to ${vs(i)}. Read where pink ĵ (from (0, 1)) went, then pick the matrix.`,
    widget: transformFig(m),
    options: opts({ text: ms(m), why: 'Column 1 is where î lands, column 2 where ĵ lands.' }, [
      { text: ms([m[0], m[2], m[1], m[3]]), why: 'That writes the landing spots as rows. They go in as columns.' },
      { text: ms([m[1], m[0], m[3], m[2]]), why: 'Columns swapped: the first column is where î (green) lands.' },
      { text: ms([m[0], -m[1], m[2], -m[3]]), why: `ĵ lands on ${vs(j)}, not on ${vs(mulS(-1, j))}: check which way the pink arrow points.` },
    ]),
    hint: 'First column: where î lands. Second column: where ĵ lands.',
    explain: `î → ${vs(i)} and ĵ → ${vs(j)}, so the columns are those: ${ms(m)}.`,
  };
};

const genEntry: Generator = (rng) => {
  const m = rm(rng, -4, 5), v = rv(rng, -4, 5);
  const w = apply(m, v), which = randInt(rng, 0, 1);
  const row: V = which ? [m[2], m[3]] : [m[0], m[1]];
  return {
    kind: 'number',
    body: `M = ${ms(m)}, v = ${vs(v)}. What is the **${which ? 'second' : 'first'}** number of Mv?`,
    widget: eqn([m, '×', v, '=', which ? ['', '?'] : ['?', '']]),
    answer: w[which], tol: 0.01,
    hint: `Row ${which + 1} of M times v: multiply in pairs and add.`,
    explain: `${n(row[0])}×${pn(v[0])} + ${pn(row[1])}×${pn(v[1])} = ${n(w[which])}. The whole result is ${vs(w)}.`,
  };
};

// ================================================================ lesson 5: composing

const R90: M = [0, -1, 1, 0], FX: M = [1, 0, 0, -1];
const L5 = {
  A: [1, 2, 0, 1] as M, B: [0, -1, 1, 0] as M,
  P: [2, -1, 3, 4] as M, Q: [1, 5, 2, -2] as M,
  shear: [1, 1, 0, 1] as M, turn: 45,
};
const L5AB = mul(L5.A, L5.B), L5PQ = mul(L5.P, L5.Q);
const RF = mul(FX, R90), FR = mul(R90, FX);
const rot = (t: number): M => { const r = (t * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [c, -s, s, c]; };
const L_SHAPE: V[] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 3], [0, 3]];

const PAIRS: [string, M, string, M][] = [
  ['rotate 90°', R90, 'rotate 30°', rot(30)],
  ['scale everything by 2', [2, 0, 0, 2], 'reflect in the x-axis', FX],
  ['rotate 90° counter-clockwise', R90, 'reflect in the x-axis', FX],
  ['shear (x, y) → (x + y, y)', [1, 1, 0, 1], 'shear (x, y) → (x, x + y)', [1, 0, 1, 1]],
  ['stretch x by 3', [3, 0, 0, 1], 'stretch y by 2', [1, 0, 0, 2]],
];

const genProduct: Generator = (rng) => {
  const A = rm(rng, -3, 4), B = rm(rng, -3, 4);
  const C = mul(A, B), r = randInt(rng, 0, 1), c = randInt(rng, 0, 1);
  const row: V = [A[2 * r], A[2 * r + 1]], col: V = [B[c], B[2 + c]];
  return {
    kind: 'number',
    body: `A = ${ms(A)}, B = ${ms(B)}. In the product AB, what is the entry in **row ${r + 1}, column ${c + 1}**?`,
    widget: eqn([A, B, '=', [0, 1, 2, 3].map((k) => (k === 2 * r + c ? '?' : '·'))]),
    answer: C[2 * r + c], tol: 0.01,
    hint: `Row ${r + 1} of A dotted with column ${c + 1} of B.`,
    explain: `${vs(row)} · ${vs(col)} = ${n(row[0])}×${pn(col[0])} + ${pn(row[1])}×${pn(col[1])} = ${n(C[2 * r + c])}. The whole product is ${ms(C)}.`,
  };
};

const genComposePoint: Generator = (rng) => {
  const i = randInt(rng, 0, MOVES.length - 1);
  let j = i;
  while (j === i) j = randInt(rng, 0, MOVES.length - 1);
  const P = rv(rng, -4, 4);
  const mid = apply(MOVES[i].m, P), end = apply(MOVES[j].m, mid);
  return {
    kind: 'point',
    body: `Take P${vs(P)}. First **${MOVES[i].name}**, then **${MOVES[j].name}** (both about the origin). Place where P ends up.`,
    plot: planeSpec([{ type: 'dots', pts: [[0, 0], P], labels: ['O', 'P'], color: CA }]),
    answer: { x: end[0], y: end[1] }, tol: 0.3, snap: 1,
    hint: 'One move at a time: find where the first move puts P, then apply the second to that point.',
    explain: `${MOVES[i].name}: ${vs(P)} → ${vs(mid)}. Then ${MOVES[j].name}: ${vs(mid)} → ${vs(end)}.`,
  };
};

const genCommute: Generator = (rng) => {
  const i = randInt(rng, 0, MOVES.length - 1);
  let j = i;
  while (j === i) j = randInt(rng, 0, MOVES.length - 1);
  const X = MOVES[i], Y = MOVES[j];
  const P: V = [1, 2];
  const xy = apply(Y.m, apply(X.m, P)), yx = apply(X.m, apply(Y.m, P));
  const same = sameM(mul(Y.m, X.m), mul(X.m, Y.m));
  return {
    kind: 'choice',
    body: `Does it matter which order you do these in: **${X.name}** and **${Y.name}**?`,
    options: [
      { text: 'Same result in either order', correct: same, why: same ? `Both orders give the same matrix, ${ms(mul(Y.m, X.m))}.` : `Try (1, 2): ${X.name} first gives ${vs(xy)}, ${Y.name} first gives ${vs(yx)}.` },
      { text: 'The order changes the result', correct: !same, why: same ? `Not for this pair: both orders give the matrix ${ms(mul(Y.m, X.m))}, e.g. (1, 2) → ${vs(xy)} either way.` : 'Right: matrices usually don’t commute.' },
    ],
    hint: 'Follow the point (1, 2) both ways.',
    explain: same ? `Either order sends (1, 2) to ${vs(xy)}, and indeed the two products are the same matrix. A lucky pair: most don’t commute.` : `(1, 2) goes to ${vs(xy)} one way and ${vs(yx)} the other. Matrix multiplication is not commutative.`,
  };
};

// ================================================================ lesson 6: determinant

const L6 = {
  D: [3, 0, 0, 2] as M, shape: 5,
  F: [4, 1, 2, 3] as M,
  S: [1, 2, 0, 1] as M,
  dA: 3, dB: -2,
  map: [2, 1, 1, 3] as M, field: 4,
};

const genDet: Generator = (rng) => {
  const m = rm(rng, -4, 6);
  const d = det(m);
  return {
    kind: 'number',
    body: `What is the determinant of ${ms(m)}?`,
    widget: eqn(['det', m, '= ?']),
    answer: d, tol: 0.01,
    hint: 'For [a b; c d] it’s ad − bc.',
    explain: `${n(m[0])}×${pn(m[3])} − ${pn(m[1])}×${pn(m[2])} = ${n(m[0] * m[3])} − ${pn(m[1] * m[2])} = ${n(d)}. ${d === 0 ? 'Zero: this matrix squashes the plane flat.' : `Areas get multiplied by ${n(Math.abs(d))}${d < 0 ? ', and the plane is flipped over' : ''}.`}`,
  };
};

const genArea: Generator = (rng) => {
  let m: M;
  do { m = rm(rng, -3, 4); } while (det(m) === 0);
  const a = pick(rng, [2, 3, 4, 5, 6, 10, 1.5]);
  const what = pick(rng, ['A park on a map', 'A logo', 'A triangle', 'A blob']);
  const d = det(m);
  return {
    kind: 'number',
    body: `${what} has area ${n(a)}. After applying ${ms(m)}, what is its area?`,
    answer: Math.abs(d) * a, tol: 0.01,
    hint: 'The determinant is the area factor for every shape, not only squares. Area can’t be negative.',
    explain: `det = ${n(m[0])}×${pn(m[3])} − ${pn(m[1])}×${pn(m[2])} = ${n(d)}, so every area is multiplied by ${n(Math.abs(d))}: ${n(a)} × ${pn(Math.abs(d))} = ${n(Math.abs(d) * a)}.${d < 0 ? ' (The minus sign means the shape is flipped, not that area goes negative.)' : ''}`,
  };
};

const genDetMeaning: Generator = (rng) => {
  let m: M;
  if (rng() < 0.3) {
    const c = rv(rng, -3, 3), k = pick(rng, [2, -1, -2, 3]);
    m = fromCols(c, mulS(k, c));
    if (rng() < 0.5) m = fromCols(mulS(k, c), c);
  } else do { m = rm(rng, -3, 4); } while (det(m) === 0);
  const d = det(m);
  const keep = `Multiplies areas by ${n(Math.abs(d) || 2)} and keeps orientation`;
  const flip = `Multiplies areas by ${n(Math.abs(d) || 2)} and flips the plane over`;
  const flat = 'Squashes the whole plane onto a line (or a point)';
  const right = d > 0 ? keep : d < 0 ? flip : flat;
  return {
    kind: 'choice',
    body: `What does ${ms(m)} do to areas?`,
    widget: transformFig(m, [], 6),
    options: [
      { text: keep, correct: right === keep, why: d === 0 ? 'Its determinant is 0: the columns lie on one line.' : `The determinant is ${n(d)}: negative means î and ĵ swapped their turning order, a flip.` },
      { text: flip, correct: right === flip, why: d === 0 ? 'Its determinant is 0: the columns lie on one line.' : `The determinant is ${n(d)}: positive, so no flip.` },
      { text: flat, correct: right === flat, why: `The determinant is ${n(d)}, not 0, so the square becomes a real parallelogram.` },
    ],
    hint: 'Compute ad − bc. Its size is the area factor, its sign says flip or not.',
    explain: `det = ${n(m[0])}×${pn(m[3])} − ${pn(m[1])}×${pn(m[2])} = ${n(d)}. ${d === 0 ? 'Zero: everything lands on one line, so areas become 0.' : `Areas × ${pn(Math.abs(d))}${d < 0 ? ', and the negative sign means a flip' : ', orientation kept'}.`}`,
  };
};

// ================================================================ lesson 7: solving and inverses

const L7 = {
  A: [2, 1, 1, 1] as M, b: [5, 3] as V,
  S: [2, 0, 0, 4] as M,
  B: [3, 1, 5, 2] as M, bb: [5, 9] as V,
  sing: [1, 2, 2, 4] as M, off: [3, 5] as V, on: [3, 6] as V,
};
const L7x = apply(inv(L7.A), L7.b), L7inv = inv(L7.B), L7y = apply(L7inv, L7.bb);
check(L7x.every(Number.isInteger) && L7inv.every(Number.isInteger) && L7y.every(Number.isInteger), 'L7 integers');
check(det(L7.sing) === 0 && cross(cols(L7.sing)[0], L7.on) === 0 && cross(cols(L7.sing)[0], L7.off) !== 0, 'L7 singular');

const solveTask = plotExplorer({
  params: [
    { id: 'x', label: 'x', min: -4, max: 4, step: 1, value: 1 },
    { id: 'y', label: 'y', min: -4, max: 4, step: 1, value: -1 },
  ],
  spec: (p) => {
    const v: V = [p.x, p.y];
    return planeSpec([...gridLayers(L7.A), ...tgt(L7.b, 'b'), arrow(v, 'var(--muted)', 'input'), arrow(apply(L7.A, v), CB, 'A·input')], 6);
  },
  readout: (p) => `A × ${vs([p.x, p.y])} = ${vs(apply(L7.A, [p.x, p.y]))}   (target b = ${vs(L7.b)})`,
  goal: (p) => sameV(apply(L7.A, [p.x, p.y]), L7.b),
  goalText: `A sends ${vs(L7x)} to ${vs(L7.b)}.`,
});

const SOLVE_DETS = [1, -1];
const genSolve: Generator = (rng) => {
  let A: M, x: V, b: V;
  do { A = rm(rng, -3, 4); x = rv(rng, -3, 3); b = apply(A, x); } while (!SOLVE_DETS.includes(det(A)) || A.filter((e) => e === 0).length > 1 || !inBox(b, 15));
  const which = randInt(rng, 0, 1);
  const Ai = inv(A);
  check(sameV(apply(Ai, b), x), 'solve');
  return {
    kind: 'number',
    body: `Solve A·(x, y) = ${vs(b)} for A = ${ms(A)}. What is **${which ? 'y' : 'x'}**?`,
    widget: eqn([A, ['x', 'y'], '=', b]),
    answer: x[which], tol: 0.01,
    hint: `det A = ${n(det(A))}, so A⁻¹ = (1/${n(det(A))})·[d −b; −c a]. Or solve the two equations by elimination.`,
    explain: `A⁻¹ = ${ms(Ai)}, and A⁻¹·${vs(b)} = ${vs(x)}. Check: ${n(A[0])}×${pn(x[0])} + ${pn(A[1])}×${pn(x[1])} = ${n(b[0])} ✓.`,
  };
};

const genInverse: Generator = (rng) => {
  let A: M;
  do { A = rm(rng, -3, 5); } while (![1, -1, 2].includes(det(A)) || A[1] === 0 || A[2] === 0 || A[0] === A[3]);
  const d = det(A), Ai = inv(A);
  check(sameM(mul(A, Ai), ID), 'inverse');
  const wrong: Choice[] = [
    { text: ms([A[3], A[1], A[2], A[0]]), why: 'Swapping a and d is half the recipe; b and c also change sign.' },
    { text: ms([A[0] / d, -A[1] / d, -A[2] / d, A[3] / d].map((x) => x + 0) as M), why: 'a and d swap places in the inverse; here they stayed put.' },
    { text: ms([-A[0], -A[1], -A[2], -A[3]]), why: 'Negating everything gives −A. Multiply it by A and you won’t get the identity.' },
  ];
  if (d !== 1) wrong.unshift({ text: ms([A[3], -A[1], -A[2], A[0]]), why: `Right pattern, but you must still divide by the determinant, ${n(d)}.` });
  return {
    kind: 'choice',
    body: `Which matrix is the inverse of A = ${ms(A)}?`,
    options: opts({ text: ms(Ai), why: `Multiply it by A and you get the identity [1 0; 0 1].` }, wrong),
    hint: 'For [a b; c d]: swap a and d, negate b and c, divide by ad − bc.',
    explain: `det A = ${n(d)}. Swap a and d, negate b and c: ${ms([A[3], -A[1], -A[2], A[0]])}${d !== 1 ? `, then divide by ${n(d)}: ${ms(Ai)}` : ''}. A × that = [1 0; 0 1].`,
  };
};

const genSolvable: Generator = (rng) => {
  const kind = randInt(rng, 0, 2); // 0 unique, 1 none, 2 infinite
  let A: M, b: V;
  if (kind === 0) { do { A = rm(rng, -3, 4); } while (det(A) === 0); b = rv(rng, -6, 6); }
  else {
    const c = rv(rng, -3, 3), k = pick(rng, [2, -1, 3, -2]);
    A = fromCols(c, mulS(k, c));
    b = mulS(pick(rng, [1, 2, -1, 3]), c);
    if (kind === 1) b = add(b, pick(rng, [[1, 0], [0, 1], [0, -1], [-1, 0]] as V[]));
  }
  const truth = det(A) !== 0 ? 0 : cross(cols(A)[0], b) === 0 && cross(cols(A)[1], b) === 0 ? 2 : 1;
  const why = [
    `det A = ${n(det(A))}, not 0, so A can be undone: exactly one input lands on b.`,
    `det A = 0: A squashes the plane onto the line through ${vs(cols(A)[0])}, and b = ${vs(b)} is off that line. Nothing lands there.`,
    `det A = 0, and b = ${vs(b)} lies on the line A squashes everything onto. Whole lines of inputs land on b.`,
  ];
  return {
    kind: 'choice',
    body: `How many solutions does A·(x, y) = ${vs(b)} have, for A = ${ms(A)}?`,
    widget: eqn([A, ['x', 'y'], '=', b]),
    options: ['Exactly one', 'None', 'Infinitely many'].map((text, k) => ({ text, correct: k === truth, why: k === truth ? why[k] : `${why[truth]}` })),
    hint: 'Start with the determinant. If it’s 0, check whether b is on the line the columns lie on.',
    explain: why[truth],
  };
};

// ================================================================ lesson 8: eigenvectors

const L8 = {
  T: [3, 1, 0, 2] as M, tv: [[1, 0], [0, 1], [1, 1], [1, -1]] as V[],
  S: [2, 1, 1, 2] as M, sv: [1, 1] as V,
  C: [4, 1, 2, 3] as M,
  stay: 0.9, back: 0.2,
  fib: [1, 1, 1, 0] as M,
};
const eigs = (m: M): [number, number] => { const t = m[0] + m[3], d = det(m), s = Math.sqrt(t * t - 4 * d); return [(t + s) / 2, (t - s) / 2]; };
const L8Cl = eigs(L8.C);
const markov: M = [L8.stay, L8.back, 1 - L8.stay, 1 - L8.back];
const steady = L8.back / (L8.back + 1 - L8.stay);
check(Math.abs(apply(markov, [steady, 1 - steady])[0] - steady) < 1e-12, 'steady state');
const PHI = (1 + Math.sqrt(5)) / 2;

/** An integer matrix with integer eigenvalues l1, l2 along (1, q) and (p, 1 + pq). */
function eigenMatrix(rng: () => number): { m: M; e: [V, V]; l: [number, number] } {
  for (;;) {
    const p = randInt(rng, -1, 2), q = randInt(rng, -1, 2), l1 = randInt(rng, -2, 5), l2 = randInt(rng, -2, 5);
    if (l1 === l2 || (!p && !q)) continue;
    const P: M = [1, p, q, 1 + p * q];
    const m = mul(mul(P, [l1, 0, 0, l2]), inv(P)).map((x) => Math.round(x) + 0) as M;
    if (m.some((x) => Math.abs(x) > 9) || !m[1] && !m[2]) continue;
    const e = cols(P);
    check(sameV(apply(m, e[0]), mulS(l1, e[0])) && sameV(apply(m, e[1]), mulS(l2, e[1])), 'eigen construction');
    return { m, e, l: [l1, l2] };
  }
}

const genIsEigen: Generator = (rng) => {
  const { m, e } = eigenMatrix(rng);
  let v: V;
  if (rng() < 0.5) v = mulS(pick(rng, [1, -1, 2]), e[randInt(rng, 0, 1)]);
  else do { v = rv(rng, -2, 2); } while (cross(apply(m, v), v) === 0);
  const w = apply(m, v), yes = cross(w, v) === 0;
  const lam = yes ? (len(v) ? dot(w, v) / dot(v, v) : 0) : 0;
  return {
    kind: 'choice',
    body: `Is v = ${vs(v)} an eigenvector of M = ${ms(m)}?`,
    options: [
      { text: `Yes`, correct: yes, why: yes ? `Mv = ${vs(w)} = ${n(lam)}·v.` : `Mv = ${vs(w)}, which isn’t a multiple of ${vs(v)}: the direction changed.` },
      { text: `No`, correct: !yes, why: yes ? `Mv = ${vs(w)} = ${n(lam)} × ${vs(v)}: same line, so it is one (eigenvalue ${n(lam)}).` : 'Right: M knocks v off its own line.' },
    ],
    hint: 'Compute Mv. Is it a number times v?',
    explain: yes ? `Mv = ${vs(w)} = ${n(lam)} × ${vs(v)}. Same line: an eigenvector with eigenvalue ${n(lam)}.` : `Mv = ${vs(w)}. For an eigenvector the two coordinates would scale by the same factor, and they don’t.`,
  };
};

const genLambda: Generator = (rng) => {
  const { m, e, l } = eigenMatrix(rng);
  const k = randInt(rng, 0, 1), v = mulS(pick(rng, [1, -1, 2]), e[k]), w = apply(m, v);
  return {
    kind: 'number',
    body: `v = ${vs(v)} is an eigenvector of M = ${ms(m)}. What is its eigenvalue λ (so that Mv = λv)?`,
    widget: eqn([m, v, '= λ', v]),
    answer: l[k], tol: 0.01,
    hint: 'Compute Mv and compare it with v.',
    explain: `Mv = ${vs(w)} = ${n(l[k])} × ${vs(v)}, so λ = ${n(l[k])}.${l[k] < 0 ? ' Negative: v gets flipped to point the other way along its line.' : l[k] === 0 ? ' Zero: v gets squashed to the origin.' : ''}`,
  };
};

const genSteady: Generator = (rng) => {
  const leave = pick(rng, [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]), back = pick(rng, [0.05, 0.1, 0.2, 0.3, 0.4]);
  const [a, b] = pick(rng, [['the city', 'the suburbs'], ['town', 'the countryside'], ['the north', 'the south'], ['the capital', 'the provinces']]);
  const s = back / (leave + back);
  return {
    kind: 'number', prob: true,
    body: `Each year ${pct(leave, 0)} of people in ${a} move to ${b}, and ${pct(back, 0)} of people in ${b} move to ${a}. In the long run, what share of everyone lives in ${a}?`,
    answer: s, tol: 0.006,
    hint: 'In the steady state the flows balance: (share in A) × leave rate = (share in B) × return rate.',
    explain: `Balance: ${n(leave)}·A = ${n(back)}·(1 − A), so A = ${n(back)} / (${n(leave)} + ${pn(back)}) = ${pct(s)}. That steady split is the eigenvector of the yearly matrix with eigenvalue 1.`,
  };
};

const genLargest: Generator = (rng) => {
  const { m, l } = eigenMatrix(rng);
  const t = m[0] + m[3], d = det(m), big = Math.max(...l);
  check(Math.abs(Math.max(...eigs(m)) - big) < 1e-9, 'largest');
  return {
    kind: 'number',
    body: `What is the **larger** eigenvalue of M = ${ms(m)}?`,
    answer: big, tol: 0.01,
    hint: 'Solve λ² − (a + d)λ + (ad − bc) = 0.',
    explain: `a + d = ${n(t)}, ad − bc = ${n(d)}: λ² ${t < 0 ? '+' : '−'} ${n(Math.abs(t))}λ ${d < 0 ? '−' : '+'} ${n(Math.abs(d))} = 0 gives λ = ${n(l[0])} and ${n(l[1])}. The larger is ${n(big)}.`,
  };
};

// ================================================================ course

export const linearAlgebra: Course = {
  id: 'linear-algebra',
  title: 'Linear Algebra',
  blurb: 'Vectors as arrows, matrices as moves of the plane: span, determinants, inverses and eigenvectors, by picture.',
  color: COLOR,
  icon: '↗',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'vectors',
      title: 'Vectors as arrows',
      goal: 'Add, scale and subtract vectors, as arrows and as pairs of numbers.',
      steps: [
        {
          kind: 'point',
          body: `A treasure map says: walk ${vs(L1.a)} (${L1.a[0]} east, ${L1.a[1]} north), then walk ${vs(L1.b)}. Starting at the origin, where do you end up?`,
          plot: planeSpec([arrow(L1.a, CA, 'first'), arrow(L1.b, CB, 'second')]),
          answer: { x: add(L1.a, L1.b)[0], y: add(L1.a, L1.b)[1] }, tol: 0.3, snap: 1,
          hint: 'Do the first walk, then start the second one from where you are.',
          explain: `East: ${L1.a[0]} + ${L1.b[0]} = ${add(L1.a, L1.b)[0]}. North: ${L1.a[1]} + ${L1.b[1]} = ${add(L1.a, L1.b)[1]}. You end at ${vs(add(L1.a, L1.b))}.`,
        },
        {
          kind: 'read',
          title: 'A vector is a move',
          body: `A **vector** is an arrow: a length and a direction. Write it by its **components**, how far across and how far up: ${vs(L1.a)} means ${L1.a[0]} right, ${L1.a[1]} up.\n\nWhere the arrow starts doesn’t matter: all three arrows below are the same vector ${vs(L1.a)}. When an arrow starts at the origin, its tip sits at the point with the same numbers, which is why vectors and points look alike.`,
          widget: planeFig([arrow(L1.a, CA, '', [-4, -3]), arrow(L1.a, CA, '', [-3, 2]), arrow(L1.a, CA, vs(L1.a))]),
        },
        {
          kind: 'task',
          body: 'Drag the tip of v so that v = (−2, 3).',
          widget: dragPlane({
            handles: [{ at: [3, 1], color: CA }],
            layers: ([v]) => [{ type: 'line', pts: [[v[0], 0], v], color: 'var(--muted)', dash: true, width: 1.5 }, { type: 'line', pts: [[0, 0], [v[0], 0]], color: 'var(--muted)', dash: true, width: 1.5 }, arrow(v, CA, 'v')],
            readout: ([v]) => `v = ${vs(v)}: ${Math.abs(v[0])} ${v[0] < 0 ? 'left' : 'right'}, ${Math.abs(v[1])} ${v[1] < 0 ? 'down' : 'up'}`,
            goal: ([v]) => sameV(v, [-2, 3]),
            goalText: '2 left, 3 up.',
          }),
          hint: 'The first number is across (negative = left), the second is up.',
          explain: '(−2, 3): the tip is 2 to the left of the origin and 3 above it.',
        },
        {
          kind: 'read',
          title: 'Adding: tip to tail',
          body: 'To add a + b, do a and then b: put b’s tail on a’s tip. In numbers, add across to across and up to up.\n\nDoing b first and then a lands on the same spot: the two routes are the sides of a **parallelogram**, and a + b is its diagonal. Drag the tips.',
          widget: addPlane,
        },
        {
          kind: 'fill',
          body: 'Fill in the sum.',
          template: `${vs(L1.p)} + ${vs(L1.q)} = ([[0]], [[1]])`,
          blanks: [
            tiles(L1.p[0] + L1.q[0], [L1.p[0] - L1.q[0], L1.p[0] * L1.q[0], L1.p[0] + L1.q[1]]),
            tiles(L1.p[1] + L1.q[1], [L1.p[1] - L1.q[1], L1.p[1] * L1.q[1], L1.p[1] + L1.q[0]]),
          ],
          hint: 'x with x, y with y.',
          explain: `(${n(L1.p[0])} + ${pn(L1.q[0])}, ${n(L1.p[1])} + ${pn(L1.q[1])}) = ${vs(add(L1.p, L1.q))}.`,
        },
        {
          kind: 'choice',
          body: 'Is a + b always the same vector as b + a?',
          options: [
            { text: 'Yes: both are the diagonal of the same parallelogram', correct: true },
            { text: 'No: the order of the moves changes where you end', why: 'You end in the same place: each component is a sum of two numbers, and 3 + 1 = 1 + 3.' },
            { text: 'Only when a and b are perpendicular', why: 'The parallelogram works for any two arrows, not just square corners.' },
          ],
          explain: 'Adding vectors adds numbers component by component, and number addition doesn’t care about order. In the picture: two routes round a parallelogram, same corner.',
        },
        {
          kind: 'task',
          body: `Scaling stretches an arrow: k·v multiplies both components by k. Find the k that puts k·v on the target dot.`,
          widget: scaleTask,
          hint: `The target ${vs(mulS(L1.k, L1.v))} points the opposite way from v = ${vs(L1.v)}. How many v’s long is it?`,
          explain: `${n(L1.k)} × ${vs(L1.v)} = ${vs(mulS(L1.k, L1.v))}. A negative k flips the arrow round; its size sets the length.`,
        },
        {
          kind: 'choice',
          body: `What does multiplying v = ${vs(L1.v)} by −1 do?`,
          options: [
            { text: `Same length, opposite direction: ${vs(mulS(-1, L1.v))}`, correct: true },
            { text: `Makes it shorter: ${vs(sub(L1.v, [1, 1]))}`, why: 'Scaling multiplies both numbers by k; it doesn’t subtract from them.' },
            { text: `Turns it a quarter turn: ${vs([-L1.v[1], L1.v[0]])}`, why: 'That’s a rotation by 90°. −1 turns it a half turn: straight back.' },
          ],
          explain: '−v is v reversed: walk the same distance the other way. That’s why a − b means a + (−b).',
        },
        {
          kind: 'fill',
          body: `A drone is at P${vs(L1.P)} and must fly straight to Q${vs(L1.Q)}. Fill in the vector of its flight.`,
          template: 'Q − P = ([[0]], [[1]])',
          blanks: [
            tiles(L1.Q[0] - L1.P[0], [L1.P[0] - L1.Q[0], L1.Q[0] + L1.P[0], L1.Q[1] - L1.P[1]]),
            tiles(L1.Q[1] - L1.P[1], [L1.P[1] - L1.Q[1], L1.Q[1] + L1.P[1], L1.Q[0] - L1.P[0]]),
          ],
          hint: 'Where it ends minus where it starts.',
          explain: `(${n(L1.Q[0])} − ${pn(L1.P[0])}, ${n(L1.Q[1])} − ${pn(L1.P[1])}) = ${vs(sub(L1.Q, L1.P))}. Check: P + ${vs(sub(L1.Q, L1.P))} = Q.`,
        },
        {
          kind: 'match',
          body: 'Match each description to its vector.',
          heads: ['Move', 'Vector'],
          pairs: [['2 right, 3 up', '(2, 3)'], ['3 right, 2 up', '(3, 2)'], ['2 left, 3 up', '(−2, 3)'], ['3 down', '(0, −3)'], ['twice (1, −1)', '(2, −2)']],
          hint: 'Across first, then up. Left and down are negative.',
          explain: 'The order matters: (2, 3) and (3, 2) are different arrows. Scaling (1, −1) by 2 doubles both numbers.',
        },
        {
          kind: 'multi',
          body: `Which of these equal ${vs(mulS(2, L1.v))}? Select all that apply.`,
          options: [
            { text: `${vs(L1.v)} + ${vs(L1.v)}`, correct: true },
            { text: `2 · ${vs(L1.v)}`, correct: true },
            { text: `${vs([5, 3])} − ${vs(sub([5, 3], mulS(2, L1.v)))}`, correct: true },
            { text: `${vs(L1.v)} + ${vs([L1.v[1], L1.v[0]])}`, why: `That adds a different vector, ${vs([L1.v[1], L1.v[0]])}, giving ${vs(add(L1.v, [L1.v[1], L1.v[0]]))}.` },
            { text: `${vs(L1.v)} · 2 + 1`, why: 'You can’t add a plain number to a vector: which component would get it?' },
          ],
          explain: `v + v and 2v are the same thing: ${vs(mulS(2, L1.v))}. Subtraction works component by component too: ${vs([5, 3])} − ${vs(sub([5, 3], mulS(2, L1.v)))} = ${vs(mulS(2, L1.v))}.`,
        },
      ],
      practice: [genAdd, genCombo, genDisplacement],
    },

    // ------------------------------------------------------------ 2
    {
      id: 'dot',
      title: 'Length, distance and the dot product',
      goal: 'Measure lengths and distances, and use the dot product to tell how far two vectors point the same way.',
      steps: [
        {
          kind: 'number',
          body: `How long is the arrow v = ${vs(L2.v)}?`,
          widget: planeFig([{ type: 'line', pts: [[0, 0], [L2.v[0], 0], L2.v], color: 'var(--muted)', dash: true, width: 1.5 }, arrow(L2.v, CA, 'v')]),
          answer: len(L2.v), tol: 0.01,
          hint: 'The arrow is the long side of a right triangle.',
          explain: `Pythagoras: √(${L2.v[0]}² + ${L2.v[1]}²) = √${dot(L2.v, L2.v)} = ${n(len(L2.v))}.`,
        },
        {
          kind: 'read',
          title: 'Length and distance',
          body: 'The **length** of v = (x, y) is |v| = √(x² + y²): Pythagoras on its components.\n\nThe **distance** between two points is the length of the vector from one to the other, |Q − P|. Scaling multiplies length by the size of the factor: |3v| = 3|v|, and |−3v| = 3|v| too.',
        },
        {
          kind: 'number',
          body: `How far is P${vs(L2.P)} from Q${vs(L2.Q)}?`,
          answer: len(sub(L2.Q, L2.P)), tol: 0.01,
          hint: 'Find Q − P first.',
          explain: `Q − P = ${vs(sub(L2.Q, L2.P))}, length √(${pn(sub(L2.Q, L2.P)[0])}² + ${pn(sub(L2.Q, L2.P)[1])}²) = √${dot(sub(L2.Q, L2.P), sub(L2.Q, L2.P))} = ${n(len(sub(L2.Q, L2.P)))}.`,
        },
        {
          kind: 'choice',
          body: `|v| = ${n(len(L2.v))}. What is |−2v|?`,
          options: opts({ text: n(2 * len(L2.v)) }, [
            { text: n(-2 * len(L2.v)), why: 'Lengths are never negative. The minus sign flips the direction, not the length.' },
            { text: n(len(L2.v) - 2), why: 'Scaling multiplies the length; it doesn’t subtract from it.' },
            { text: n(4 * len(L2.v)), why: 'That would be squaring the factor. Length grows by |k|, area by k².' },
          ]),
          explain: `|−2v| = |−2| × |v| = 2 × ${pn(len(L2.v))} = ${n(2 * len(L2.v))}.`,
        },
        {
          kind: 'read',
          title: 'The dot product',
          body: 'The **dot product** multiplies matching components and adds: a · b = a₁b₁ + a₂b₂. One number out.\n\nIt measures **how much two vectors point the same way**: a · b = |a| |b| cos(angle). Positive: within 90° of each other. Zero: perpendicular. Negative: more than 90° apart. The thick segment is b’s shadow on a. Drag the tips and watch the sign.',
          widget: dotPlane,
        },
        {
          kind: 'number',
          body: `Compute ${vs(L2.d1)} · ${vs(L2.d2)}.`,
          answer: dot(L2.d1, L2.d2), tol: 0.01,
          hint: 'x times x, plus y times y.',
          explain: `${n(L2.d1[0])}×${pn(L2.d2[0])} + ${pn(L2.d1[1])}×${pn(L2.d2[1])} = ${n(L2.d1[0] * L2.d2[0])} + ${pn(L2.d1[1] * L2.d2[1])} = ${n(dot(L2.d1, L2.d2))}. Positive, but small for vectors this long: the angle is ${Math.round(deg(L2.d1, L2.d2))}°, not far below 90°.`,
        },
        {
          kind: 'sort',
          body: 'Sort each pair by the sign of its dot product.',
          bins: ['Positive (under 90°)', 'Zero (perpendicular)', 'Negative (over 90°)'],
          items: ([[[1, 2], [3, 1]], [[2, 1], [-1, 2]], [[3, 0], [-2, 1]], [[1, 1], [2, 5]], [[4, 2], [-1, 2]], [[1, -3], [-2, 1]]] as [V, V][])
            .map(([a, b]) => ({ text: `${vs(a)} and ${vs(b)}`, bin: dot(a, b) > 0 ? 0 : dot(a, b) === 0 ? 1 : 2 })),
          hint: 'Compute a₁b₁ + a₂b₂ for each.',
          explain: 'The sign of the dot product is the sign of cos(angle): positive for sharp angles, zero at exactly 90°, negative for wide ones.',
        },
        {
          kind: 'task',
          body: `Drag b until it is perpendicular to a = ${vs(L2.perpA)}.`,
          widget: perpTask,
          hint: `You need ${L2.perpA[0]}·x + ${L2.perpA[1]}·y = 0. Try swapping a’s numbers and negating one.`,
          explain: `(−1, 3) works: ${L2.perpA[0]}×(−1) + ${L2.perpA[1]}×3 = ${dot(L2.perpA, [-1, 3])}. So does any multiple of it, like (1, −3) or (−2, 6). Swap and negate always gives a perpendicular in 2D.`,
        },
        {
          kind: 'number',
          body: 'What is the angle between (1, 0) and (1, 1), in degrees? Use a · b = |a| |b| cos(angle).',
          answer: deg([1, 0], [1, 1]), tol: 0.5, unit: '°',
          hint: 'a · b = 1, |a| = 1, |b| = √2.',
          explain: `cos(angle) = 1 / (1 × √2) ≈ ${n(1 / Math.SQRT2)}, so the angle is ${n(deg([1, 0], [1, 1]))}°. Makes sense: (1, 1) points halfway between east and north.`,
        },
        {
          kind: 'read',
          title: 'Projection: how much is along a direction',
          body: 'The dot product with a **unit** vector u (length 1) gives the **component** along u: how much of a points in u’s direction. For any direction b: component = a · b / |b|.\n\nThis is the shadow b casts on a in the picture: everything perpendicular to a is thrown away.',
          widget: planeFig(projLayers([4, 1], [2, 3])),
        },
        {
          kind: 'number',
          body: `Wind pushes a cyclist with force ${vs(L2.F)}. The road runs in the direction ${vs(L2.road)}. How much of the push is along the road?`,
          answer: dot(L2.F, L2.road) / len(L2.road), tol: 0.01,
          hint: `Dot the force with the road direction, then divide by the length of ${vs(L2.road)}.`,
          explain: `F · ${vs(L2.road)} = ${dot(L2.F, L2.road)}, and |${vs(L2.road)}| = ${n(len(L2.road))}, so the push along the road is ${dot(L2.F, L2.road)} / ${n(len(L2.road))} = ${n(dot(L2.F, L2.road) / len(L2.road))}. The rest of the force pushes sideways.`,
        },
        (() => {
          const cos = (u: V) => dot(L2.ann, u) / (len(L2.ann) * len(u));
          const people: [string, V][] = [['Ben', L2.ben], ['Cat', L2.cat], ['Dan', L2.dan]];
          const best = people.reduce((a, b) => (cos(b[1]) > cos(a[1]) ? b : a));
          const nearest = people.reduce((a, b) => (len(sub(b[1], L2.ann)) < len(sub(a[1], L2.ann)) ? b : a));
          check(best[0] === 'Ben' && nearest[0] === 'Cat', 'taste vectors');
          return {
            kind: 'choice' as const,
            body: `A music app scores taste as (rock, jazz) listening hours: Ann ${vs(L2.ann)}, Ben ${vs(L2.ben)}, Cat ${vs(L2.cat)}, Dan ${vs(L2.dan)}. It recommends by **direction** (the angle between taste vectors), not by amount. Whose taste is most like Ann’s?`,
            options: [
              { text: 'Ben', correct: true },
              { text: 'Cat', why: `Cat is the closest point (distance ${n(len(sub(L2.cat, L2.ann)))}), but her taste is an even mix; the angle is ${Math.round(deg(L2.ann, L2.cat))}°. Ben just listens more.` },
              { text: 'Dan', why: `Dan mostly listens to jazz: ${Math.round(deg(L2.ann, L2.dan))}° away from Ann.` },
            ],
            hint: 'Compare cos(angle) = a · b / (|a| |b|) for each.',
            explain: `cos(angle) with Ann: Ben ${n(cos(L2.ben))}, Cat ${n(cos(L2.cat))}, Dan ${n(cos(L2.dan))}. Ben points almost exactly Ann’s way (${Math.round(deg(L2.ann, L2.ben))}°) despite being twice as far out. This **cosine similarity** is how search engines and recommenders compare documents and tastes.`,
          };
        })(),
      ],
      practice: [genDistance, genDot, genPerp],
    },

    // ------------------------------------------------------------ 3
    {
      id: 'span',
      title: 'Linear combinations and span',
      goal: 'Decide which points you can reach by mixing two vectors, and when a vector adds nothing new.',
      steps: [
        {
          kind: 'task',
          body: `You can only move in whole steps of a = ${vs(L3.a)} and b = ${vs(L3.b)} (backwards counts). Reach the target ${vs(L3.t)}.`,
          widget: mixTask,
          hint: `x: ${L3.a[0]}c + ${L3.b[0]}d = ${L3.t[0]}. y: ${L3.a[1]}c + ${L3.b[1]}d = ${L3.t[1]}.`,
          explain: `${n(L3c[0])}·${vs(L3.a)} + ${pn(L3c[1])}·${vs(L3.b)} = ${vs(L3.t)}.`,
        },
        {
          kind: 'read',
          title: 'Linear combinations',
          body: 'A **linear combination** of a and b is c·a + d·b for any numbers c and d: scale each, then add. Think of a mixing desk with two sliders.\n\nFinding c and d is solving two equations, one for each component: exactly the systems you solved by elimination in Algebra. The vector view says what that means: how much of each arrow gets you there.',
        },
        {
          kind: 'fill',
          body: `a = ${vs(L3.p)}, b = ${vs(L3.q)}. Fill in ${L3.pc}a − ${-L3.qc}b.`,
          template: `${L3.pc}a − ${-L3.qc}b = ([[0]], [[1]])`,
          blanks: [
            tiles(add(mulS(L3.pc, L3.p), mulS(L3.qc, L3.q))[0], [L3.pc * L3.p[0] - L3.qc * L3.q[0], L3.p[0] - L3.q[0], add(mulS(L3.pc, L3.p), mulS(L3.qc, L3.q))[1]]),
            tiles(add(mulS(L3.pc, L3.p), mulS(L3.qc, L3.q))[1], [L3.pc * L3.p[1] - L3.qc * L3.q[1], L3.p[1] - L3.q[1], add(mulS(L3.pc, L3.p), mulS(L3.qc, L3.q))[0]]),
          ],
          hint: 'Scale each vector first, then subtract component by component. Watch the minus signs.',
          explain: `${L3.pc}a = ${vs(mulS(L3.pc, L3.p))}, ${-L3.qc}b = ${vs(mulS(-L3.qc, L3.q))}, difference ${vs(add(mulS(L3.pc, L3.p), mulS(L3.qc, L3.q)))}.`,
        },
        {
          kind: 'choice',
          body: `Now the steps are a = ${vs(L3.p)} and b = ${vs(L3.par)}, any amounts. Can you reach ${vs(L3.t)}?`,
          options: [
            { text: `No: every mix stays on the line y = 2x`, correct: true },
            { text: 'Yes: two vectors reach everything', why: `Only if they point different ways. b = ${n(L3.par[0] / L3.p[0])}a, so b adds no new direction.` },
            { text: 'Yes, with fractional amounts', why: `Fractions don’t help: c·${vs(L3.p)} + d·${vs(L3.par)} = (c + 2d)·${vs(L3.p)}, always a multiple of ${vs(L3.p)}, always on y = 2x. ${vs(L3.t)} isn’t.` },
          ],
          explain: `b = 2a, so c·a + d·b = (c + 2d)·a: always on the line through ${vs(L3.p)}, where y = 2x. ${vs(L3.t)} has y ≠ 2x.`,
        },
        {
          kind: 'read',
          title: 'Span',
          body: 'The **span** of some vectors is every point their combinations can reach.\n\n- two vectors pointing different ways: the **whole plane**\n- two vectors on one line: just **that line**\n- only zero vectors: just the **origin**\n\nDrag the tips: line them up and the shaded plane collapses to a line.',
          widget: spanPlane([2, 1], [-1, 2]),
        },
        {
          kind: 'sort',
          body: 'What does each pair span?',
          bins: ['The whole plane', 'Only a line'],
          items: ([[[1, 2], [2, 1]], [[1, 2], [-2, -4]], [[3, 0], [0, 1]], [[2, 3], [4, 6]], [[1, 1], [1, -1]], [[0, 2], [0, -5]]] as [V, V][])
            .map(([a, b]) => ({ text: `${vs(a)} and ${vs(b)}`, bin: cross(a, b) !== 0 ? 0 : 1 })),
          hint: 'Is one a multiple of the other?',
          explain: 'A pair spans only a line exactly when one vector is a multiple of the other: (−2, −4) = −2·(1, 2), (4, 6) = 2·(2, 3), (0, −5) = −2.5·(0, 2). The rest point different ways and reach everything.',
        },
        {
          kind: 'task',
          body: 'Drag the tips so that a and b (neither of them zero) span only a line.',
          widget: spanPlane([2, 1], [-1, 2], (a, b) => len(a) > 0 && len(b) > 0 && cross(a, b) === 0, 'One line: every mix stays on it.'),
          hint: 'Make b a multiple of a: same direction, or exactly opposite.',
          explain: 'Any b = k·a works, such as a = (2, 1), b = (4, 2) or (−2, −1). Then c·a + d·b = (c + kd)·a never leaves a’s line.',
        },
        {
          kind: 'number',
          body: `Write ${vs(L3.tgt)} = c·${vs(L3.u)} + d·${vs(L3.w)}. What is d?`,
          widget: planeFig([arrow(L3.u, CA, 'a'), arrow(L3.w, CB, 'b'), ...tgt(L3.tgt)], 9),
          answer: L3d[1], tol: 0.01,
          hint: `x: c + 3d = ${L3.tgt[0]}. y: c + d = ${L3.tgt[1]}. Subtract.`,
          explain: `Subtracting the equations: 2d = ${L3.tgt[0] - L3.tgt[1]}, so d = ${n(L3d[1])}, and c = ${L3.tgt[1]} − ${pn(L3d[1])} = ${n(L3d[0])}. Check: ${n(L3d[0])}·${vs(L3.u)} + ${pn(L3d[1])}·${vs(L3.w)} = ${vs(L3.tgt)}.`,
        },
        {
          kind: 'choice',
          body: 'a and b point different ways in the plane. You add a third vector c. What does c add to the span?',
          options: [
            { text: 'Nothing: a and b already reach every point, including c', correct: true },
            { text: 'A new direction, so the span gets bigger', why: 'The span is already the whole plane; there’s nothing left to reach in 2D.' },
            { text: 'It depends on how long c is', why: 'Length never matters for span: you can scale by anything.' },
          ],
          explain: 'c is itself some combination of a and b, so it is **redundant** (the three vectors are linearly dependent). Two independent directions are all the plane has room for.',
        },
        {
          kind: 'multi',
          body: 'Which of these are in the span of the single vector (1, 2)? Select all that apply.',
          options: [
            { text: '(2, 4)', correct: true },
            { text: '(−3, −6)', correct: true },
            { text: '(0, 0)', correct: true },
            { text: '(2, 1)', why: '(2, 1) has y = x/2, not y = 2x: off the line through (1, 2).' },
            { text: '(1, 3)', why: 'k·(1, 2) with x = 1 needs k = 1, which gives (1, 2), not (1, 3).' },
          ],
          explain: 'The span of one vector is every multiple of it: the line through the origin along it. 0·(1, 2) = (0, 0) is always included.',
        },
        {
          kind: 'read',
          title: 'Bases: a coordinate system',
          body: 'Two vectors that span the plane form a **basis**: every point is exactly one combination of them. î = (1, 0) and ĵ = (0, 1) are the usual basis, and the numbers (x, y) are just “x of î plus y of ĵ”.\n\nAny other pair that isn’t on one line works too, with a slanted grid. Keep this in mind: next lesson, a matrix will move î and ĵ somewhere else, and drag every point with them.',
        },
        {
          kind: 'choice',
          body: 'In 3D space, two vectors that point different ways span…',
          options: [
            { text: 'A plane through the origin', correct: true },
            { text: 'All of 3D space', why: 'Each vector only adds one direction. You’d need a third one, off their plane.' },
            { text: 'A line', why: 'Two different directions already give a flat sheet, not just one line.' },
          ],
          explain: 'Their combinations fill a flat sheet through the origin. To fill 3D space you need three vectors, none in the plane of the other two.',
        },
      ],
      practice: [genCoeffs, genInSpan, genSpanKind],
    },

    // ------------------------------------------------------------ 4
    {
      id: 'matrices',
      title: 'Matrices move the plane',
      goal: 'Read a matrix as where î and ĵ land, and use it to move any vector.',
      steps: [
        {
          kind: 'point',
          body: `The whole grid has been reshaped: î = (1, 0) now lands on ${vs(cols(L4.M1)[0])}, ĵ = (0, 1) on ${vs(cols(L4.M1)[1])}, and the grid lines went along. The point ${vs(L4.v1)} was “${L4.v1[0]} of î plus ${L4.v1[1]} of ĵ”. Where does it land?`,
          plot: planeSpec(transformLayers(L4.M1, false)),
          answer: { x: apply(L4.M1, L4.v1)[0], y: apply(L4.M1, L4.v1)[1] }, tol: 0.3, snap: 1,
          hint: `Follow the new grid: ${L4.v1[0]} step along the green arrow, then ${L4.v1[1]} along the pink one.`,
          explain: `${L4.v1[0]}·${vs(cols(L4.M1)[0])} + ${L4.v1[1]}·${vs(cols(L4.M1)[1])} = ${vs(apply(L4.M1, L4.v1))}.`,
        },
        {
          kind: 'read',
          title: 'Linear transformations',
          body: 'A **linear transformation** moves every point of the plane so that grid lines stay **straight, parallel and evenly spaced**, and the origin stays put.\n\nThat makes it easy to track: (x, y) = x·î + y·ĵ, so it lands on x·(new î) + y·(new ĵ). Two arrows decide everything. Write them as the columns of a **matrix**:',
          widget: withEqn(transformFig(L4.M1), ['M =', L4.M1, '   columns: where î and ĵ land']),
        },
        {
          kind: 'task',
          body: 'Drag where î and ĵ land to build the matrix that **rotates the plane 90° counter-clockwise**.',
          widget: transformPlane({ r: 3, init: [1, 0, 0, 1], goal: (m) => sameM(m, L4.rot), goalText: `${ms(L4.rot)}: a quarter turn.` }),
          hint: 'A quarter turn left sends (1, 0) straight up and (0, 1) to the left.',
          explain: `î → (0, 1), ĵ → (−1, 0), so the matrix is ${ms(L4.rot)}. (We write [a b; c d] for rows a b and c d.)`,
        },
        {
          kind: 'fill',
          body: `Compute M·v for M = ${ms(L4.M2)} and v = ${vs(L4.v2)}.`,
          widget: eqn([L4.M2, '×', L4.v2]),
          template: 'Mv = ([[0]], [[1]])',
          blanks: [
            tiles(apply(L4.M2, L4.v2)[0], [L4.M2[0] * L4.v2[0] + L4.M2[2] * L4.v2[1], L4.M2[0] + L4.M2[1], L4.M2[0] * L4.v2[0]]),
            tiles(apply(L4.M2, L4.v2)[1], [L4.M2[1] * L4.v2[0] + L4.M2[3] * L4.v2[1], L4.M2[2] + L4.M2[3], L4.M2[3] * L4.v2[1]]),
          ],
          hint: `${L4.v2[0]} of column 1 plus ${L4.v2[1]} of column 2.`,
          explain: `${L4.v2[0]}·${vs(cols(L4.M2)[0])} + ${L4.v2[1]}·${vs(cols(L4.M2)[1])} = ${vs(apply(L4.M2, L4.v2))}.`,
        },
        {
          kind: 'read',
          title: 'The row shortcut',
          body: 'Same calculation, organised by rows: the first entry of Mv is (row 1) · v, the second is (row 2) · v.\n\n[a b; c d] × (x, y) = (ax + by, cx + dy)\n\nThe column view tells you **what it means** (a mix of where î and ĵ went); the row view is **quicker by hand** (two dot products).',
        },
        {
          kind: 'match',
          body: 'Match each matrix to what it does to the plane.',
          heads: ['Matrix', 'Move'],
          pairs: [['[2 0; 0 2]', 'Scale everything by 2'], ['[−1 0; 0 1]', 'Reflect in the y-axis'], ['[0 −1; 1 0]', 'Rotate 90° counter-clockwise'], ['[1 1; 0 1]', 'Shear sideways'], ['[1 0; 0 0]', 'Flatten onto the x-axis']],
          hint: 'Read the columns: where does î go? Where does ĵ go?',
          explain: '[−1 0; 0 1] sends î to (−1, 0) and leaves ĵ: a left-right flip. [1 1; 0 1] leaves î but tips ĵ to (1, 1): a shear. [1 0; 0 0] sends ĵ to zero, so everything drops onto the x-axis.',
        },
        {
          kind: 'choice',
          body: 'Which matrix reflects the plane in the **x-axis** (up becomes down)?',
          options: [
            { text: '[1 0; 0 −1]', correct: true },
            { text: '[−1 0; 0 1]', why: 'That sends î to (−1, 0): left-right flip, a reflection in the y-axis.' },
            { text: '[0 1; 1 0]', why: 'That swaps î and ĵ: a reflection in the diagonal line y = x.' },
            { text: '[−1 0; 0 −1]', why: 'Both arrows reversed: that’s a half turn (rotation by 180°), not a reflection.' },
          ],
          explain: 'Reflecting in the x-axis leaves î = (1, 0) alone and flips ĵ to (0, −1). Those are the columns.',
        },
        {
          kind: 'point',
          body: `M = ${ms(L4.M3)} (î → ${vs(cols(L4.M3)[0])}, ĵ → ${vs(cols(L4.M3)[1])}). Where does v = ${vs(L4.v3)} land?`,
          plot: planeSpec(transformLayers(L4.M3, false)),
          answer: { x: apply(L4.M3, L4.v3)[0], y: apply(L4.M3, L4.v3)[1] }, tol: 0.3, snap: 1,
          hint: `${L4.v3[0]} of the green arrow plus ${L4.v3[1]} of the pink one.`,
          explain: `${L4.v3[0]}·${vs(cols(L4.M3)[0])} + ${L4.v3[1]}·${vs(cols(L4.M3)[1])} = ${vs(apply(L4.M3, L4.v3))}. This matrix turns the plane 45° and stretches it by √2.`,
        },
        {
          kind: 'choice',
          body: 'Can a 2×2 matrix slide the whole plane 1 unit to the right, (x, y) → (x + 1, y)?',
          options: [
            { text: 'No: a matrix always sends (0, 0) to (0, 0)', correct: true },
            { text: 'Yes: [1 1; 0 1]', why: '[1 1; 0 1] sends (x, y) to (x + y, y): a shear. Points on the x-axis don’t move at all.' },
            { text: 'Yes: [2 0; 0 1]', why: 'That doubles x, so (3, 0) goes to (6, 0), not (4, 0).' },
          ],
          explain: 'M × (0, 0) = 0·(new î) + 0·(new ĵ) = (0, 0), always. A slide moves the origin, so it isn’t linear. (Computer graphics gets round this with a third coordinate.)',
        },
        {
          kind: 'task',
          body: 'Drag î and ĵ so the shaded square lands exactly on the dashed outline.',
          widget: transformPlane({ r: 3, target: L4.target, goal: (m) => sameM(m, L4.target), goalText: `${ms(L4.target)}: the outline’s two edges from the origin are the columns.` }),
          hint: 'The corner of the square at (1, 0) is where î goes; the corner at (0, 1) is where ĵ goes. Find those corners on the outline.',
          explain: `The outline’s edges from the origin go to ${vs(cols(L4.target)[0])} and ${vs(cols(L4.target)[1])}: those are the columns, ${ms(L4.target)}.`,
        },
        {
          kind: 'number',
          body: `Matrices aren’t only geometry. A bakery’s muffin needs ${L4.bake[0]} eggs and ${L4.bake[2]} cup of flour; a cake needs ${L4.bake[1]} eggs and ${L4.bake[3]} cups. As a matrix, columns are products, rows are ingredients: ${ms(L4.bake)}. An order of ${L4.order[0]} muffins and ${L4.order[1]} cakes needs how many **eggs**?`,
          widget: eqn([L4.bake, '×', L4.order, '=', ['eggs', 'flour']]),
          answer: apply(L4.bake, L4.order)[0], tol: 0.01,
          hint: `${L4.order[0]} of the muffin column plus ${L4.order[1]} of the cake column.`,
          explain: `${L4.order[0]}·${vs(cols(L4.bake)[0])} + ${L4.order[1]}·${vs(cols(L4.bake)[1])} = ${vs(apply(L4.bake, L4.order))}: ${apply(L4.bake, L4.order)[0]} eggs and ${apply(L4.bake, L4.order)[1]} cups of flour. Same rule: each column is what one unit of an input turns into.`,
        },
      ],
      practice: [genApply, genReadMatrix, genEntry],
    },

    // ------------------------------------------------------------ 5
    {
      id: 'compose',
      title: 'Composing transformations',
      goal: 'Multiply matrices as “do one, then the other”, and see why the order matters.',
      steps: [
        {
          kind: 'choice',
          body: 'Rotate the L-shape 90° counter-clockwise, then reflect it in the x-axis (step through it). Would doing the reflection **first** and the rotation second give the same final shape?',
          widget: composeSteps([R90, FX], ['The L-shape.', 'Rotated 90° counter-clockwise.', 'Then reflected in the x-axis.']),
          options: [
            { text: 'No: it ends up somewhere else', correct: true },
            { text: 'Yes: the same two moves happened', why: 'Try it: rotating first leaves the L lying left of the origin with its foot pointing down; reflecting first leaves it lying to the right, foot up. Same moves, different order.' },
            { text: 'Yes, because both moves keep the shape’s size', why: 'Both keep size, but where the shape ends up and which way it faces still depend on the order.' },
          ],
          explain: `Rotate then reflect is ${ms(RF)} (a reflection in the line y = −x); reflect then rotate is ${ms(FR)} (a reflection in y = x). Different.`,
        },
        {
          kind: 'read',
          title: 'Composition is multiplication',
          body: `Doing B and then A is one transformation, written **AB** (read right to left, like f(g(x))). Its columns are where î and ĵ end up: A applied to each column of B.\n\nHere, reflecting first and then rotating: R × F = ${ms(FR)}, versus F × R = ${ms(RF)}.`,
          widget: composeSteps([FX, R90], ['The L-shape.', 'Reflected in the x-axis first.', 'Then rotated 90° counter-clockwise: a different place.']),
        },
        {
          kind: 'point',
          body: 'Follow î = (1, 0): rotate it 90° counter-clockwise, then reflect in the x-axis. Where does it end up?',
          plot: planeSpec([arrow([1, 0], CI, 'î')], 3),
          answer: { x: apply(RF, [1, 0])[0], y: apply(RF, [1, 0])[1] }, tol: 0.2, snap: 1,
          hint: 'The rotation sends (1, 0) to (0, 1). Now flip that up-down.',
          explain: `(1, 0) → ${vs(apply(R90, [1, 0]))} → ${vs(apply(RF, [1, 0]))}. That is the first column of F × R.`,
        },
        {
          kind: 'fill',
          body: `A = ${ms(L5.A)}, B = ${ms(L5.B)}. Fill in AB: column 1 is A × (column 1 of B), column 2 is A × (column 2 of B).`,
          widget: eqn([L5.A, L5.B, '= ?']),
          template: 'AB = ⎡ [[0]]  [[1]] ⎤\n     ⎣ [[2]]  [[3]] ⎦', code: true,
          blanks: [0, 1, 2, 3].map((k) => tiles(L5AB[k], [mul(L5.B, L5.A)[k], L5.A[k] * L5.B[k], L5AB[(k + 1) % 4], L5AB[k] + 1])),
          hint: `Column 1 of B is ${vs(cols(L5.B)[0])}; A sends it to ${vs(apply(L5.A, cols(L5.B)[0]))}.`,
          explain: `A × ${vs(cols(L5.B)[0])} = ${vs(apply(L5.A, cols(L5.B)[0]))} and A × ${vs(cols(L5.B)[1])} = ${vs(apply(L5.A, cols(L5.B)[1]))}, so AB = ${ms(L5AB)}. Multiplying entry by entry would give ${ms(L5.A.map((x, k) => x * L5.B[k]) as M)}, which means nothing.`,
        },
        {
          kind: 'read',
          title: 'Row times column',
          body: 'The quick rule: the entry in **row i, column j** of AB is (row i of A) · (column j of B).\n\nIt’s the same calculation as “A applied to each column of B”, just one number at a time.',
        },
        {
          kind: 'number',
          body: `A = ${ms(L5.P)}, B = ${ms(L5.Q)}. What is the entry in row 2, column 1 of AB?`,
          widget: eqn([L5.P, L5.Q, '=', ['·', '·', '?', '·']]),
          answer: L5PQ[2], tol: 0.01,
          hint: 'Row 2 of A dotted with column 1 of B.',
          explain: `${vs([L5.P[2], L5.P[3]])} · ${vs(cols(L5.Q)[0])} = ${L5.P[2]}×${L5.Q[0]} + ${L5.P[3]}×${L5.Q[2]} = ${n(L5PQ[2])}. The full product is ${ms(L5PQ)}.`,
        },
        {
          kind: 'choice',
          body: 'For numbers, 3 × 5 = 5 × 3. For matrices, is AB = BA?',
          options: [
            { text: 'Not in general: order matters', correct: true },
            { text: 'Always: multiplication commutes', why: `It does for numbers, not matrices: the L-shape showed F × R = ${ms(RF)} but R × F = ${ms(FR)}.` },
            { text: 'Never: AB and BA are always different', why: 'Some pairs do commute: two rotations, or scaling everything by 2 and any other matrix.' },
          ],
          explain: 'AB means “B first, then A”. Putting on socks then shoes is not the same as shoes then socks. Sometimes the order happens not to matter, but you can’t assume it.',
        },
        (() => {
          const comm = (A: M, B: M) => sameM(mul(A, B), mul(B, A));
          return {
            kind: 'multi' as const,
            body: 'Which pairs give the same result in either order? Select all that apply.',
            options: PAIRS.map(([a, A, b, B]) => {
              const ok = comm(A, B), x = apply(B, apply(A, [1, 2])), y = apply(A, apply(B, [1, 2]));
              return { text: `${a}, and ${b}`, correct: ok, why: ok ? undefined : `Follow (1, 2): ${a} first gives ${vs(x)}, ${b} first gives ${vs(y)}.` };
            }),
            hint: 'Follow the point (1, 2) both ways for each pair.',
            explain: 'Rotations about the same point add their angles in any order. Scaling everything by 2 commutes with anything, and stretches along the two axes don’t interfere. Rotations and reflections, or two different shears, don’t commute.',
          };
        })(),
        {
          kind: 'order',
          body: 'You want: first scale S, then rotate R, then reflect F. Put the matrices in the order they are written in the single product matrix (left to right).',
          items: ['F (reflect)', 'R (rotate)', 'S (scale)'],
          hint: 'The matrix next to the vector acts first: F R S v = F(R(S v)).',
          explain: 'F R S v: S touches v first, then R, then F. Products read right to left, like nested functions.',
        },
        {
          kind: 'read',
          title: 'Rotations add',
          body: 'Rotating by a and then by b is one rotation by a + b, so its matrix R(b)R(a) is R(a + b), and the order doesn’t matter here. Try it.',
          widget: plotExplorer({
            params: [
              { id: 'a', label: 'first turn', min: 0, max: 180, step: 15, value: 30, format: (v) => `${v}°` },
              { id: 'b', label: 'second turn', min: 0, max: 180, step: 15, value: 60, format: (v) => `${v}°` },
            ],
            spec: (p) => planeSpec([polyL(L_SHAPE, 'var(--muted)', true), polyL(L_SHAPE.map((q) => apply(rot(p.a), q)), CA, true), polyL(L_SHAPE.map((q) => apply(mul(rot(p.b), rot(p.a)), q)), CB)], 4),
            readout: (p) => `turn ${p.a}°, then ${p.b}°: one turn of ${p.a + p.b}°`,
          }),
        },
        {
          kind: 'number',
          body: `R turns the plane ${L5.turn}°. What is the smallest number of times you must apply R to get back exactly where you started (Rⁿ = I, the identity)?`,
          answer: 360 / L5.turn, tol: 0.01,
          hint: 'Each application adds another turn.',
          explain: `${360 / L5.turn} turns of ${L5.turn}° make ${360}°: a full circle, so R^${360 / L5.turn} = I = [1 0; 0 1].`,
        },
        {
          kind: 'choice',
          body: `The shear H = ${ms(L5.shear)} tips ĵ over by 1. What is H × H (shear twice)?`,
          options: opts({ text: ms(mul(L5.shear, L5.shear)) }, [
            { text: ms(L5.shear.map((x) => x * x) as M), why: 'Squaring each entry isn’t matrix multiplication. Use rows times columns.' },
            { text: ms(L5.shear.map((x) => 2 * x) as M), why: 'That doubles everything, including î’s column: î would move, but a shear leaves î alone.' },
            { text: ms(ID), why: 'A shear doesn’t undo itself: the second one tips ĵ further, not back.' },
          ]),
          explain: `H sends ĵ to (1, 1); H again sends (1, 1) to ${vs(apply(L5.shear, [1, 1]))}. î stays. H² = ${ms(mul(L5.shear, L5.shear))}: a shear by 2.`,
        },
      ],
      practice: [genProduct, genComposePoint, genCommute],
    },

    // ------------------------------------------------------------ 6
    {
      id: 'determinant',
      title: 'The determinant: area scaling',
      goal: 'Read the determinant as the factor a matrix scales areas by, and know what its sign and zero mean.',
      steps: [
        {
          kind: 'number',
          body: `The matrix ${ms(L6.D)} stretches the plane. The unit square (area 1) becomes the shaded rectangle. What is its area?`,
          widget: transformFig(L6.D),
          answer: det(L6.D), tol: 0.01,
          hint: 'Width times height.',
          explain: `î goes to ${vs(cols(L6.D)[0])}, ĵ to ${vs(cols(L6.D)[1])}: a ${L6.D[0]} × ${L6.D[3]} rectangle, area ${det(L6.D)}.`,
        },
        {
          kind: 'read',
          title: 'Every area scales by the same factor',
          body: 'Because grid lines stay parallel and evenly spaced, **every** little grid square becomes the same parallelogram. So every shape’s area gets multiplied by the same number: the area of the image of the unit square. That number is the **determinant**.\n\nDrag î and ĵ and watch it.',
          widget: transformPlane({ r: 4, init: [2, 1, 0, 2], readout: (m) => `unit square → area ${n(Math.abs(det(m)))} · det = ${n(det(m))}${det(m) < 0 ? ' (flipped)' : det(m) === 0 ? ' (squashed flat)' : ''}` }),
        },
        {
          kind: 'number',
          body: `A shape of area ${L6.shape} goes through the same matrix ${ms(L6.D)}. What is its new area?`,
          answer: L6.shape * det(L6.D), tol: 0.01,
          hint: 'Every area gets multiplied by the determinant.',
          explain: `${L6.shape} × ${det(L6.D)} = ${L6.shape * det(L6.D)}. The shape doesn’t matter, only the factor.`,
        },
        {
          kind: 'read',
          title: 'The formula',
          body: `For [a b; c d] the determinant is **ad − bc**. When b = c = 0 it’s a × d, the rectangle. The −bc corrects for the tilt: for ${ms(L6.F)}, the parallelogram is a ${L6.F[0] + L6.F[1]} × ${L6.F[2] + L6.F[3]} box minus corner triangles and rectangles, leaving ${L6.F[0]}×${L6.F[3]} − ${L6.F[1]}×${L6.F[2]} = ${det(L6.F)}.`,
          widget: transformFig(L6.F, [{ type: 'line', pts: [[0, 0], [L6.F[0] + L6.F[1], 0], [L6.F[0] + L6.F[1], L6.F[2] + L6.F[3]], [0, L6.F[2] + L6.F[3]]], closed: true, color: 'var(--muted)', dash: true, width: 1.5 }]),
        },
        {
          kind: 'number',
          body: `What is the determinant of ${ms(L6.F)}?`,
          answer: det(L6.F), tol: 0.01,
          hint: 'ad − bc.',
          explain: `${L6.F[0]}×${L6.F[3]} − ${L6.F[1]}×${L6.F[2]} = ${L6.F[0] * L6.F[3]} − ${L6.F[1] * L6.F[2]} = ${det(L6.F)}.`,
        },
        {
          kind: 'choice',
          body: `The shear ${ms(L6.S)} slants every square into a parallelogram. What does it do to areas?`,
          widget: transformFig(L6.S),
          options: [
            { text: 'Nothing: the determinant is 1', correct: true },
            { text: `Doubles them: there’s a ${L6.S[1]} in it`, why: `det = ${L6.S[0]}×${L6.S[3]} − ${L6.S[1]}×${L6.S[2]} = ${det(L6.S)}. The slant changes the shape, not the area.` },
            { text: 'Shrinks them: the parallelogram is thinner', why: 'Thinner, but longer: same base, same height, same area (like a pushed stack of cards).' },
          ],
          explain: `det = ${det(L6.S)}. A shear slides rows of the grid along without changing base or height, so area is unchanged.`,
        },
        {
          kind: 'task',
          body: 'Drag the arrows so the square is **squashed flat**: area 0, with neither arrow zero.',
          widget: transformPlane({ r: 4, init: [2, -1, 1, 1], goal: (m) => det(m) === 0 && len(cols(m)[0]) > 0 && len(cols(m)[1]) > 0, readout: (m) => `area ${n(Math.abs(det(m)))} · det = ${n(det(m))}`, goalText: 'det = 0: the whole plane collapses onto a line.' }),
          hint: 'Put ĵ on the same line as î.',
          explain: 'When the columns lie on one line the square becomes a flat segment, and the whole plane is squashed onto that line. Then ad − bc = 0.',
        },
        {
          kind: 'choice',
          body: 'The matrix [0 1; 1 0] has determinant −1. What does the minus sign mean?',
          widget: transformFig([0, 1, 1, 0]),
          options: [
            { text: 'The plane is flipped over, like a mirror image', correct: true },
            { text: 'Areas become negative', why: 'Area is still 1 here. The sign carries different information: orientation.' },
            { text: 'The plane shrinks', why: 'Size is |det| = 1: no shrinking.' },
          ],
          explain: 'Normally ĵ is a counter-clockwise turn from î. After [0 1; 1 0] (a reflection in y = x) it’s clockwise: the plane has been flipped like a page. Negative determinant = orientation reversed.',
        },
        {
          kind: 'sort',
          body: 'Sort the matrices by what they do.',
          bins: ['Keeps orientation', 'Flips orientation', 'Squashes flat'],
          items: ([[2, 1, 1, 3], [0, -1, 1, 0], [1, 0, 0, -1], [1, 2, 3, 4], [2, 4, 1, 2], [3, 0, 0, 0], [1, 3, 0, 2]] as M[])
            .map((m) => ({ text: ms(m), bin: det(m) > 0 ? 0 : det(m) < 0 ? 1 : 2 })),
          hint: 'Compute ad − bc for each: positive, negative or zero?',
          explain: 'Positive determinant: orientation kept. Negative: flipped. Zero: the columns lie on one line (or one is zero), so the plane collapses.',
        },
        {
          kind: 'number',
          body: `det A = ${L6.dA} and det B = ${L6.dB}. What is det(AB)?`,
          answer: L6.dA * L6.dB, tol: 0.01,
          hint: 'AB means B then A. Each one scales areas by its own factor.',
          explain: `B multiplies areas by ${L6.dB} (with a flip), then A by ${L6.dA}: in total ${L6.dA} × (${L6.dB}) = ${L6.dA * L6.dB}. det(AB) = det A × det B, a fact that is obvious from the picture and messy from the formula.`,
        },
        {
          kind: 'multi',
          body: 'A matrix has determinant 0. Which must be true? Select all that apply.',
          options: [
            { text: 'It squashes the plane onto a line or a point', correct: true },
            { text: 'Some different points land on the same spot', correct: true },
            { text: 'Every shape ends up with area 0', correct: true },
            { text: 'All its entries are 0', why: '[1 2; 2 4] has det 1×4 − 2×2 = 0 with no zero entries. Its columns just lie on one line.' },
            { text: 'It flips the plane over', why: 'Flipping is a negative determinant. Zero is a collapse.' },
          ],
          explain: 'det 0 means the image of the unit square has no area: everything lands on a line (or the origin), so many points pile onto the same spots. Keep this in mind for the next lesson.',
        },
        {
          kind: 'number',
          body: `A garden designer distorts a plan with the matrix ${ms(L6.map)}. A flower bed has area ${L6.field} m² on the plan. What is its area after the distortion?`,
          answer: L6.field * Math.abs(det(L6.map)), tol: 0.01, unit: 'm²',
          hint: 'Find the determinant first.',
          explain: `det = ${L6.map[0]}×${L6.map[3]} − ${L6.map[1]}×${L6.map[2]} = ${det(L6.map)}, so ${L6.field} × ${det(L6.map)} = ${L6.field * det(L6.map)} m².`,
        },
      ],
      practice: [genDet, genArea, genDetMeaning],
    },

    // ------------------------------------------------------------ 7
    {
      id: 'inverses',
      title: 'Solving Ax = b and undoing',
      goal: 'Solve Ax = b by undoing the transformation, and recognise when it can’t be undone.',
      steps: [
        {
          kind: 'task',
          body: `The matrix A = ${ms(L7.A)} moves the plane. Which input does it send to the target b = ${vs(L7.b)}? Use the sliders to find it.`,
          widget: solveTask,
          hint: `Use the transformed grid: b = ${vs(L7.b)} sits on a grid point. Count how many green and pink steps reach it.`,
          explain: `A × ${vs(L7x)} = ${L7x[0]}·${vs(cols(L7.A)[0])} + ${L7x[1]}·${vs(cols(L7.A)[1])} = ${vs(L7.b)}. So x = ${vs(L7x)}.`,
        },
        {
          kind: 'read',
          title: 'Two views of Ax = b',
          body: `Ax = b is a system of equations, one per row: ${L7.A[0]}x + ${L7.A[1]}y = ${L7.b[0]} and ${L7.A[2]}x + ${L7.A[3]}y = ${L7.b[1]}. Elimination solves it.\n\nThe geometric view: A moved the plane; which point **landed** on b? To find it, run the transformation backwards.`,
        },
        {
          kind: 'read',
          title: 'The inverse matrix',
          body: 'The **inverse** A⁻¹ undoes A: A⁻¹A = I, the identity [1 0; 0 1], which leaves everything put. Then Ax = b gives x = A⁻¹b.\n\nFor 2×2 there’s a recipe:\n\n[a b; c d]⁻¹ = (1 / (ad − bc)) × [d −b; −c a]\n\nSwap a and d, negate b and c, divide by the determinant.',
          widget: eqn([L7.A, '⁻¹ =', inv(L7.A)]),
        },
        {
          kind: 'choice',
          body: 'R rotates the plane 90° counter-clockwise. What is R⁻¹?',
          options: [
            { text: 'Rotate 90° clockwise', correct: true },
            { text: 'Rotate 90° counter-clockwise again', why: 'That makes a 180° turn in total, not back to the start.' },
            { text: 'Reflect in the x-axis', why: 'A reflection flips the plane over; a rotation never did, so you can’t undo it with a flip.' },
          ],
          explain: `Turn back the way you came: ${ms([0, 1, -1, 0])}. Check: ${ms([0, 1, -1, 0])} × ${ms(R90)} = ${ms(mul([0, 1, -1, 0], R90))}.`,
        },
        {
          kind: 'choice',
          body: `What is the inverse of ${ms(L7.S)} (stretch x by ${L7.S[0]}, y by ${L7.S[3]})?`,
          options: opts({ text: ms(inv(L7.S)) }, [
            { text: ms(L7.S.map((x) => -x) as M), why: 'That flips everything through the origin and keeps the stretch. Undo a stretch by shrinking.' },
            { text: ms([L7.S[3], 0, 0, L7.S[0]]), why: 'Swapping a and d without dividing by the determinant just stretches the other way round.' },
            { text: ms([1, 0, 0, 1]), why: 'The identity does nothing, so it can’t undo a stretch.' },
          ]),
          explain: `Undo stretching by ${L7.S[0]} by shrinking by ${L7.S[0]}: ${ms(inv(L7.S))}. The recipe agrees: det = ${det(L7.S)}, and ${ms([L7.S[3], 0, 0, L7.S[0]])} / ${det(L7.S)} = ${ms(inv(L7.S))}.`,
        },
        {
          kind: 'fill',
          body: `Find the inverse of B = ${ms(L7.B)}. (Its determinant is ${det(L7.B)}.)`,
          template: 'B⁻¹ = ⎡ [[0]]  [[1]] ⎤\n      ⎣ [[2]]  [[3]] ⎦', code: true,
          blanks: [0, 1, 2, 3].map((k) => tiles(L7inv[k], [L7.B[k], -L7inv[k], L7.B[3 - k]])),
          hint: 'Swap a and d, negate b and c, divide by det (here 1).',
          explain: `Swap ${L7.B[0]} and ${L7.B[3]}, negate ${L7.B[1]} and ${L7.B[2]}: ${ms(L7inv)}. Check: ${ms(L7.B)} × ${ms(L7inv)} = ${ms(mul(L7.B, L7inv))}.`,
        },
        {
          kind: 'number',
          body: `Use it: solve B·(x, y) = ${vs(L7.bb)}. What is y?`,
          widget: eqn([L7.B, ['x', 'y'], '=', L7.bb]),
          answer: L7y[1], tol: 0.01,
          hint: `(x, y) = B⁻¹ × ${vs(L7.bb)}.`,
          explain: `${ms(L7inv)} × ${vs(L7.bb)} = ${vs(L7y)}. Check: ${L7.B[0]}×${L7y[0]} + ${L7.B[1]}×${L7y[1]} = ${L7.bb[0]} ✓ and ${L7.B[2]}×${L7y[0]} + ${L7.B[3]}×${L7y[1]} = ${L7.bb[1]} ✓.`,
        },
        {
          kind: 'choice',
          body: `Solve A·(x, y) = ${vs(L7.off)} for A = ${ms(L7.sing)}.`,
          widget: withEqn(transformFig(L7.sing, tgt(L7.off, 'b'), 6), [L7.sing, ['x', 'y'], '=', L7.off]),
          options: [
            { text: 'No solution', correct: true },
            { text: 'Exactly one solution', why: `det = ${L7.sing[0]}×${L7.sing[3]} − ${L7.sing[1]}×${L7.sing[2]} = 0: there is no inverse to apply.` },
            { text: 'Infinitely many solutions', why: `That happens when b is on the line A squashes onto. ${vs(L7.off)} isn’t on it (it would need y = 2x).` },
          ],
          explain: `The columns ${vs(cols(L7.sing)[0])} and ${vs(cols(L7.sing)[1])} lie on one line, so A squashes the whole plane onto the line y = 2x. b = ${vs(L7.off)} is off that line: nothing lands on it.`,
        },
        {
          kind: 'choice',
          body: `Same A = ${ms(L7.sing)}, but now A·(x, y) = ${vs(L7.on)}.`,
          options: [
            { text: 'Infinitely many solutions', correct: true },
            { text: 'No solution', why: `${vs(L7.on)} is on the line y = 2x, where everything lands. ${vs(L7.on)} = A × (3, 0), for one.` },
            { text: 'Exactly one solution', why: `A squashed the plane, so many points pile on each spot: (3, 0), (1, 1), (−1, 2) all land on ${vs(L7.on)}.` },
          ],
          explain: `Each of ${vs([3, 0])}, ${vs([1, 1])}, ${vs([-1, 2])} gives ${vs(apply(L7.sing, [3, 0]))}: a whole line of inputs, x + 2y = 3, lands on b. With det 0 the answer is never “exactly one”.`,
        },
        {
          kind: 'sort',
          body: 'How many solutions does each system have?',
          bins: ['Exactly one', 'None', 'Infinitely many'],
          items: ([[[2, 1, 1, 1], [5, 3]], [[1, 2, 2, 4], [1, 1]], [[1, 2, 2, 4], [2, 4]], [[3, 0, 0, 2], [1, 1]], [[2, -1, -4, 2], [1, -2]], [[2, -1, -4, 2], [1, 2]]] as [M, V][])
            .map(([A, b]) => ({ text: `${ms(A)} × (x, y) = ${vs(b)}`, bin: det(A) !== 0 ? 0 : cross(cols(A)[0], b) === 0 ? 2 : 1 })),
          hint: 'det ≠ 0: exactly one. det = 0: is b on the line through the columns?',
          explain: 'A non-zero determinant means A can be undone: one answer. A zero determinant means a collapse onto a line: b on that line gives infinitely many, off it gives none.',
        },
        {
          kind: 'read',
          title: 'Undoing in reverse order',
          body: 'To undo “socks, then shoes”, take off the shoes first. Matrices work the same: **(AB)⁻¹ = B⁻¹A⁻¹**. AB did B first, so its undo removes A first.\n\nAnd a matrix with determinant 0 has no inverse at all: once points have been piled together, nothing can tell them apart again.',
        },
        {
          kind: 'order',
          body: 'An image was sheared (H), then rotated (R), then scaled (S). Put the undo steps in the order you apply them.',
          items: ['S⁻¹: unscale', 'R⁻¹: rotate back', 'H⁻¹: unshear'],
          hint: 'The last thing done is the first thing undone.',
          explain: 'The image is S R H x. Undo the outermost first: S⁻¹, then R⁻¹, then H⁻¹, so (S R H)⁻¹ = H⁻¹ R⁻¹ S⁻¹.',
        },
      ],
      practice: [genSolve, genInverse, genSolvable],
    },

    // ------------------------------------------------------------ 8
    {
      id: 'eigen',
      title: 'Eigenvectors: directions that only stretch',
      goal: 'Find the directions a matrix only stretches, and use them to predict what repeated steps do.',
      steps: [
        {
          kind: 'multi',
          body: `M = ${ms(L8.T)}. The dashed arrows are a, b, c, d; the solid arrow of the same colour is where M sends each one. Which vectors stay on their own line (only stretched or flipped)? Select all that apply.`,
          widget: imagesFig(L8.T, L8.tv, ['a', 'b', 'c', 'd']),
          options: L8.tv.map((v, k) => {
            const w = apply(L8.T, v), on = cross(v, w) === 0;
            return { text: `${'abcd'[k]} = ${vs(v)}`, correct: on, why: on ? undefined : `M sends it to ${vs(w)}, which points in a different direction.` };
          }),
          hint: 'Compute Mv for each and ask: is it a multiple of v?',
          explain: L8.tv.map((v, k) => `M${'abcd'[k]} = ${vs(apply(L8.T, v))}`).join(', ') + `. Only ${L8.tv.filter((v) => cross(v, apply(L8.T, v)) === 0).map(vs).join(' and ')} keep their direction.`,
        },
        {
          kind: 'read',
          title: 'Eigenvectors and eigenvalues',
          body: 'Most vectors get turned by a matrix. An **eigenvector** v is one that stays on its own line: **Mv = λv**. The number λ is its **eigenvalue**, the stretch factor (negative means flipped, 0 means squashed).\n\nDrag v around and watch for the moments when Mv lines up with it.',
          widget: eigenPlane(L8.T, [1, 1]),
        },
        {
          kind: 'task',
          body: `Find an eigenvector of M = ${ms(L8.S)}: drag v until Mv lies on v’s line.`,
          widget: eigenPlane(L8.S, [2, 0], (v) => len(v) > 0 && cross(v, apply(L8.S, v)) === 0, 'Found one: M only stretches this direction.'),
          hint: 'The matrix is symmetric. Try the diagonals.',
          explain: `${vs([1, 1])} → ${vs(apply(L8.S, [1, 1]))} (stretched ×${eigs(L8.S)[0]}) and ${vs([1, -1])} → ${vs(apply(L8.S, [1, -1]))} (×${eigs(L8.S)[1]}): both diagonals, and any multiple of them.`,
        },
        {
          kind: 'number',
          body: `v = ${vs(L8.sv)} is an eigenvector of ${ms(L8.S)}. What is its eigenvalue?`,
          answer: dot(apply(L8.S, L8.sv), L8.sv) / dot(L8.sv, L8.sv), tol: 0.01,
          hint: 'Compute Mv and compare with v.',
          explain: `Mv = ${vs(apply(L8.S, L8.sv))} = ${eigs(L8.S)[0]} × ${vs(L8.sv)}, so λ = ${eigs(L8.S)[0]}.`,
        },
        {
          kind: 'choice',
          body: 'What are the eigenvectors of a 90° rotation?',
          options: [
            { text: 'There are none: every direction gets turned', correct: true },
            { text: 'î and ĵ', why: 'î turns into ĵ’s direction, and ĵ into −î’s. Neither stays on its own line.' },
            { text: 'Every vector, with eigenvalue 1', why: 'Lengths stay the same, but directions don’t: an eigenvector must stay on its own line.' },
          ],
          explain: 'A rotation (other than 0° or 180°) moves every direction, so no real vector stays on its line. Algebra agrees: its eigenvalues come out as complex numbers.',
        },
        {
          kind: 'match',
          body: 'Match each transformation to its eigenvectors.',
          heads: ['Transformation', 'Eigenvectors'],
          pairs: [
            ['Scale everything by 2', 'Every vector, λ = 2'], ['Reflect in the x-axis', 'x-axis (λ = 1) and y-axis (λ = −1)'],
            ['Shear [1 1; 0 1]', 'Only the x-axis, λ = 1'], ['Flatten onto the x-axis [1 0; 0 0]', 'x-axis (λ = 1) and y-axis (λ = 0)'], ['Rotate 90°', 'None'],
          ],
          hint: 'For each one, which arrows stay on their own line?',
          explain: 'A mirror keeps the mirror line (λ = 1) and reverses the perpendicular (λ = −1). A shear slides everything except its own axis. Flattening kills the y-direction: λ = 0.',
        },
        {
          kind: 'read',
          title: 'Finding them: det(M − λI) = 0',
          body: 'Mv = λv means (M − λI)v = 0: the matrix M − λI squashes a non-zero vector to nothing. Last lesson: that only happens when its **determinant is 0**.\n\nFor [a b; c d] that gives a quadratic, the **characteristic equation**:\n\nλ² − (a + d)λ + (ad − bc) = 0\n\nSolve it for the eigenvalues, then find each eigenvector.',
        },
        {
          kind: 'number',
          body: `What is the **larger** eigenvalue of ${ms(L8.C)}?`,
          answer: L8Cl[0], tol: 0.01,
          hint: `a + d = ${L8.C[0] + L8.C[3]}, ad − bc = ${det(L8.C)}. Solve λ² − ${L8.C[0] + L8.C[3]}λ + ${det(L8.C)} = 0.`,
          explain: `λ² − ${L8.C[0] + L8.C[3]}λ + ${det(L8.C)} = (λ − ${L8Cl[0]})(λ − ${L8Cl[1]}), so λ = ${L8Cl[0]} or ${L8Cl[1]}. The larger is ${L8Cl[0]}.`,
        },
        (() => {
          const years = 25, series = (c0: number) => { const out: [number, number][] = []; let v: V = [c0, 1 - c0]; for (let t = 0; t <= years; t++) { out.push([t, v[0]]); v = apply(markov, v); } return out; };
          return {
            kind: 'read' as const,
            title: 'Repeated steps settle on an eigenvector',
            body: `Each year ${pct(1 - L8.stay, 0)} of city dwellers move to the suburbs and ${pct(L8.back, 0)} of suburbanites move to the city. As a matrix acting on (city share, suburb share): ${ms(markov)}.\n\nWherever you start, the split creeps towards the same place. That end state doesn’t change from year to year, so M·s = s: an **eigenvector with eigenvalue 1**. The other eigenvalue, ${n(eigs(markov)[1])}, shrinks every difference from it by that factor each year.`,
            widget: () => plotEl({ x: [0, years], y: [0, 1], xlabel: 'year', ylabel: 'city share', size: [440, 240], layers: [
              { type: 'hline', y: steady, color: 'var(--muted)', label: `steady ${pct(steady)}` },
              { type: 'line', pts: series(0.1), color: CA }, { type: 'line', pts: series(0.95), color: CB },
              { type: 'text', x: 1.2, y: 0.1, text: 'start 10%', color: CA, anchor: 'start' }, { type: 'text', x: 3.5, y: 0.88, text: 'start 95%', color: CB, anchor: 'start' },
            ] }),
          };
        })(),
        {
          kind: 'number', prob: true,
          body: `In that model (${pct(1 - L8.stay, 0)} leave the city, ${pct(L8.back, 0)} leave the suburbs each year), what share of people live in the city in the long run?`,
          answer: steady, tol: 0.006,
          hint: 'At the steady state, the number moving out of the city equals the number moving in.',
          explain: `${n(1 - L8.stay)}·c = ${n(L8.back)}·(1 − c), so c = ${n(L8.back)} / ${n(1 - L8.stay + L8.back)} = ${pct(steady)}. Check: (${pct(steady)}, ${pct(1 - steady)}) is unchanged by the matrix.`,
        },
        (() => {
          const rows: (string | number)[][] = [];
          let v: V = [1, 1];
          for (let t = 0; t < 8; t++) { const w = apply(L8.fib, v); rows.push([t + 1, v[0], w[0], n(w[0] / v[0])]); v = w; }
          return {
            kind: 'choice' as const,
            body: `Rabbit pairs: each year, (adults, babies) → (adults + babies, adults), the matrix ${ms(L8.fib)}. Watch the yearly growth factor. What does it settle on?`,
            widget: () => dataTable(['year', 'adults', 'next year', 'growth ×'], rows),
            options: opts({ text: `≈ ${PHI.toFixed(3)}, the larger eigenvalue` }, [
              { text: '2: the population doubles', why: 'Babies need a year before they breed, so it grows slower than doubling.' },
              { text: '1: it levels off', why: 'The adult counts keep climbing; the growth factor stays well above 1.' },
              { text: `≈ ${'−' + (1 / PHI).toFixed(3)}, the smaller eigenvalue`, why: 'The smaller eigenvalue has size under 1: its part shrinks away each year, leaving the larger one in charge.' },
            ]),
            explain: `λ² − λ − 1 = 0 gives λ = (1 + √5)/2 ≈ ${PHI.toFixed(3)} (the golden ratio) and ≈ ${'−' + (1 / PHI).toFixed(3)}. Repeating M amplifies the eigenvector with the biggest |λ| fastest, so the population ends up growing by ×${PHI.toFixed(3)} a year: the Fibonacci numbers.`,
          };
        })(),
        {
          kind: 'read',
          title: 'Where eigenvectors show up',
          body: 'Whenever a step is repeated, the eigenvector with the largest eigenvalue takes over:\n\n- **Google’s PageRank**: the importance of every web page is the steady-state eigenvector of a giant “follow a random link” matrix\n- **Vibrations**: a bridge or guitar string has natural modes, eigenvectors of its stiffness matrix\n- **Data**: the directions in which a cloud of data points spreads most (principal components) are eigenvectors\n\nFind the directions a matrix only stretches, and the matrix becomes simple: just stretching along those lines.',
        },
      ],
      practice: [genIsEigen, genLambda, genLargest, genSteady],
    },
  ],
};
