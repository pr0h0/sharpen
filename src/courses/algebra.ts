// Algebra & Functions: balancing equations, expressions, functions, lines, systems, growth,
// parabolas, inverses and logarithms. Pictures first (scales, tiles, area models, machines,
// graphs), names second.
import type { Course, Generator } from '../types';
import { h, num, pick, randInt } from '../ui';
import { columnChart, dataTable } from '../viz/charts';
import { plotExplorer } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  areaModel, balanceTask, completeSquare, doublingStepper, machine, machineStepper, pond, pondStepper,
  scale, sup, tiles, undoStepper, workStepper,
} from '../widgets/algebra';

// ---------------------------------------------------------------- formatting helpers

/** Number with a proper minus sign. */
const m = (v: number) => (v < 0 ? '−' + num(Math.abs(v)) : num(v));
/** ax + b, tidy: "3x + 2", "−x", "x − 4", "7". */
function lin(a: number, b: number, v = 'x'): string {
  let s = a === 0 ? '' : a === 1 ? v : a === -1 ? '−' + v : m(a) + v;
  if (b !== 0) s = s ? s + (b > 0 ? ' + ' : ' − ') + num(Math.abs(b)) : m(b);
  return s || '0';
}
/** ax² + bx + c, tidy. */
function quad(a: number, b: number, c: number): string {
  let s = a === 1 ? 'x²' : a === -1 ? '−x²' : m(a) + 'x²';
  if (b) s += (b > 0 ? ' + ' : ' − ') + (Math.abs(b) === 1 ? 'x' : num(Math.abs(b)) + 'x');
  if (c) s += (c > 0 ? ' + ' : ' − ') + num(Math.abs(c));
  return s;
}
/** "+ 5", "− 5" (for a term after something). */
const signed = (v: number, unit = '') => (v < 0 ? '− ' : '+ ') + (unit && Math.abs(v) === 1 ? '' : num(Math.abs(v))) + unit;
/** (x − r) or (x + r) */
const factor = (r: number) => (r > 0 ? `(x − ${r})` : `(x + ${-r})`);

/** Tiles for a fill blank: the right value first, then distinct distractors (padded if needed). */
function tiles3(right: string, cands: string[], pad: (k: number) => string): { options: string[]; answer: number } {
  const out = [right];
  for (const c of cands) if (out.length < 3 && !out.includes(c)) out.push(c);
  for (let k = 1; out.length < 3 && k < 50; k++) { const p = pad(k); if (!out.includes(p)) out.push(p); }
  return { options: out, answer: 0 };
}
const numTiles = (right: number, cands: number[]) => tiles3(m(right), cands.map(m), (k) => m(right + k));

const C = { main: '#2fa37a' };

// ---------------------------------------------------------------- practice generators

// Lesson 1: balancing
const genSolve: Generator = (rng) => {
  const a = randInt(rng, 2, 9), x = randInt(rng, -5, 12) || 7;
  let b = randInt(rng, -15, 15);
  if (b === 0) b = 4;
  const c = a * x + b;
  return {
    kind: 'number',
    body: `Solve **${lin(a, b)} = ${m(c)}**. What is x?`,
    answer: x, tol: 1e-9,
    hint: `First undo the ${b > 0 ? `+ ${b}` : `− ${-b}`}, on both sides. Then undo the × ${a}.`,
    explain: `${b > 0 ? `Subtract ${b} from` : `Add ${-b} to`} both sides: ${a}x = ${m(c - b)}. Divide both sides by ${a}: x = ${m(x)}. Check: ${a} × ${m(x)} ${b > 0 ? '+' : '−'} ${Math.abs(b)} = ${m(c)}.`,
  };
};

const genBothSides: Generator = (rng) => {
  const c = randInt(rng, 1, 6), a = c + randInt(rng, 1, 5), x = randInt(rng, -4, 10), b = randInt(rng, 0, 12);
  const d = (a - c) * x + b;
  return {
    kind: 'number',
    body: `Solve **${lin(a, b)} = ${lin(c, d)}**. What is x?`,
    answer: x, tol: 1e-9,
    hint: `Take ${lin(c, 0)} off both sides so x appears on one side only.`,
    explain: `Take ${lin(c, 0)} off both sides: ${lin(a - c, b)} = ${m(d)}.${b ? ` Take ${b} off both sides: ${lin(a - c, 0)} = ${m(d - b)}.` : ''}${a - c > 1 ? ` Divide by ${a - c}: x = ${m(x)}.` : ` So x = ${m(x)}.`}`,
  };
};

const genFillSolve: Generator = (rng) => {
  const a = randInt(rng, 2, 9), x = randInt(rng, 1, 12), b = randInt(rng, 1, 20), c = a * x + b;
  return {
    kind: 'fill',
    body: `Fill in each step of solving **${lin(a, b)} = ${c}**.`,
    template: `${lin(a, b)} = ${c}  →  ${a}x = [[0]]  →  x = [[1]]`,
    blanks: [numTiles(c - b, [c + b, c - b + a, c]), numTiles(x, [x * a, (c - b) - a, x + 1])],
    hint: 'Do the same thing to both sides each time.',
    explain: `Subtract ${b} from both sides: ${a}x = ${c - b}. Divide both sides by ${a}: x = ${x}.`,
  };
};

// Lesson 2: expressions
const genEvaluate: Generator = (rng) => {
  const a = pick(rng, [1, 2, 3, -1]), b = randInt(rng, -6, 6) || 2, c = randInt(rng, -9, 9), x = randInt(rng, -4, 5) || -2;
  const v = a * x * x + b * x + c;
  return {
    kind: 'number',
    body: `What is **${quad(a, b, c)}** when **x = ${m(x)}**?`,
    answer: v, tol: 1e-9,
    hint: x < 0 ? 'Brackets help: a negative number squared is positive.' : 'Square first, then multiply, then add.',
    explain: `x² = ${x * x}, so ${quad(a, b, c)} = ${m(a * x * x)} ${b * x < 0 ? '−' : '+'} ${Math.abs(b * x)}${c ? ` ${c < 0 ? '−' : '+'} ${Math.abs(c)}` : ''} = ${m(v)}.`,
  };
};

const genExpand: Generator = (rng) => {
  let p = randInt(rng, -6, 7) || 3, q = randInt(rng, -6, 7) || -2;
  if (p + q === 0) q += 1;
  if (q === 0) q = 5;
  const s = p + q, pr = p * q;
  const xt = (v: number) => signed(v, 'x');
  return {
    kind: 'fill',
    body: `Expand **${factor(-p)}${factor(-q)}**. (Picture the area model: x², two strips and a corner.)`,
    template: 'x² [[0]] [[1]]',
    blanks: [
      tiles3(xt(s), [xt(pr), xt(-s), xt(s + 1)], (k) => xt(s + k + 1)),
      tiles3(signed(pr), [signed(s), signed(-pr), signed(pr + 1)], (k) => signed(pr + k + 1)),
    ],
    hint: 'The two strips are ' + `${m(p)}x and ${m(q)}x; the corner is ${m(p)} × ${m(q)}.`,
    explain: `x·x = x², the strips give ${m(p)}x + ${m(q)}x = ${lin(s, 0)}, and the corner is ${m(p)} × ${m(q)} = ${m(pr)}. So ${quad(1, s, pr)}.`,
  };
};

const genCollect: Generator = (rng) => {
  const a = randInt(rng, 2, 7), c = randInt(rng, 1, 6), b = randInt(rng, 1, 9), d = randInt(rng, 1, 8);
  const right = lin(a + c, b - d);
  const opts = [
    { text: right, correct: true },
    { text: lin(a + c + b - d, 0), why: 'Numbers and x-terms aren’t like terms, so they can’t merge into one x-term.' },
    { text: lin(a + c, b + d), why: `The ${d} is being subtracted: ${b} − ${d}, not ${b} + ${d}.` },
    { text: lin(a * c, b - d), why: `Like terms add: ${a}x + ${c}x = ${a + c}x, not ${a} × ${c}.` },
  ];
  const seen = new Set<string>();
  return {
    kind: 'choice',
    body: `Simplify **${lin(a, b)} + ${lin(c, -d)}**.`,
    options: opts.filter((o) => (seen.has(o.text) ? false : (seen.add(o.text), true))),
    hint: 'Gather the x-terms, then the plain numbers.',
    explain: `x-terms: ${a}x + ${c}x = ${a + c}x. Numbers: ${b} − ${d} = ${m(b - d)}. Together: ${right}.`,
  };
};

// Lesson 3: functions
const genEvalFn: Generator = (rng) => {
  const sq = rng() < 0.5;
  const a = randInt(rng, 2, 6), b = randInt(rng, -9, 9) || 1, x = randInt(rng, -5, 6) || 3;
  const v = sq ? x * x + b : a * x + b;
  const rule = sq ? `x² ${signed(b)}` : lin(a, b);
  return {
    kind: 'number',
    body: `**f(x) = ${rule}**. What is **f(${m(x)})**?`,
    answer: v, tol: 1e-9,
    hint: `Replace every x with ${m(x)}${x < 0 ? ' (in brackets)' : ''}.`,
    explain: sq ? `f(${m(x)}) = (${m(x)})² ${signed(b)} = ${x * x} ${signed(b)} = ${m(v)}.` : `f(${m(x)}) = ${a} × ${m(x)} ${signed(b)} = ${m(a * x)} ${signed(b)} = ${m(v)}.`,
  };
};

const genCompose: Generator = (rng) => {
  const a = randInt(rng, 1, 9), b = randInt(rng, 2, 5), x = randInt(rng, -3, 6);
  const gf = rng() < 0.5;
  const v = gf ? b * (x + a) : b * x + a;
  return {
    kind: 'number',
    body: `**f(x) = x + ${a}** and **g(x) = ${b}x**. What is **${gf ? `g(f(${m(x)}))` : `f(g(${m(x)}))`}**?`,
    answer: v, tol: 1e-9,
    hint: 'Work from the inside out: the inner function runs first.',
    explain: gf ? `Inside first: f(${m(x)}) = ${m(x + a)}. Then g(${m(x + a)}) = ${b} × ${m(x + a)} = ${m(v)}.` : `Inside first: g(${m(x)}) = ${m(b * x)}. Then f(${m(b * x)}) = ${m(b * x)} + ${a} = ${m(v)}.`,
  };
};

const genRule: Generator = (rng) => {
  const a = randInt(rng, 2, 6), b = randInt(rng, -7, 9) || 3;
  const xs = [0, 1, 2, 3];
  return {
    kind: 'fill',
    body: `Find the rule behind this table (f(0) = ${m(b)}, f(1) = ${m(a + b)}, …).`,
    widget: () => dataTable(['x', ...xs.map(String)], [['f(x)', ...xs.map((x) => m(a * x + b))]]),
    template: 'f(x) = [[0]]x [[1]]',
    blanks: [numTiles(a, [b, a + 1, a - 1]), tiles3(signed(b), [signed(-b), signed(a), signed(b + a)], (k) => signed(b + k + 1))],
    hint: 'How much does f(x) go up each time x goes up by 1? And what is f(0)?',
    explain: `Each step up in x adds ${a}, so the rule multiplies by ${a}. At x = 0 the output is ${m(b)}, so f(x) = ${lin(a, b)}.`,
  };
};

// Lesson 4: lines
const genSlope: Generator = (rng) => {
  const sl = pick(rng, [-3, -2, -1, -0.5, 0.5, 1, 2, 3]), run = pick(rng, [2, 4]);
  const x1 = randInt(rng, -5, 3), y1 = randInt(rng, -6, 6);
  const x2 = x1 + run, y2 = y1 + sl * run;
  return {
    kind: 'number',
    body: `What is the slope of the line through **(${m(x1)}, ${m(y1)})** and **(${m(x2)}, ${m(y2)})**?`,
    answer: sl, tol: 0.01,
    hint: 'Slope = rise ÷ run: change in y over change in x.',
    explain: `Rise: ${m(y2)} − ${m(y1)} = ${m(y2 - y1)}. Run: ${m(x2)} − ${m(x1)} = ${run}. Slope = ${m(y2 - y1)} ÷ ${run} = ${m(sl)}.`,
  };
};

const genIntercept: Generator = (rng) => {
  let sl = 0, x1 = 0, y1 = 0, b = 99;
  while (Math.abs(b) > 8) {
    sl = pick(rng, [-3, -2, -1, 1, 2, 3]); x1 = pick(rng, [-3, -2, -1, 1, 2, 3, 4]); y1 = randInt(rng, -6, 7);
    b = y1 - sl * x1;
  }
  return {
    kind: 'point',
    body: `A line has slope **${m(sl)}** and passes through the marked point (${m(x1)}, ${m(y1)}). Place the point where it crosses the **y-axis**.`,
    plot: { x: [-6, 6], y: [-10, 10], ticks: [1, 2], layers: [{ type: 'dots', pts: [[x1, y1]], color: 'var(--c2)', labels: [`(${m(x1)}, ${m(y1)})`] }] },
    answer: { x: 0, y: b }, tol: 0.3, snap: 1,
    hint: `Walk from x = ${m(x1)} to x = 0: that’s ${Math.abs(x1)} step${Math.abs(x1) === 1 ? '' : 's'} ${x1 > 0 ? 'left' : 'right'}, and each step ${x1 > 0 ? 'left' : 'right'} changes y by ${m(x1 > 0 ? -sl : sl)}.`,
    explain: `b = y − m·x = ${m(y1)} − (${m(sl)})(${m(x1)}) = ${m(b)}. The line crosses at (0, ${m(b)}).`,
  };
};

const genLineFill: Generator = (rng) => {
  const sl = pick(rng, [-3, -2, -1, 1, 2, 3, 4]), b = randInt(rng, -6, 6) || 2;
  const x1 = randInt(rng, 1, 3), x2 = x1 + randInt(rng, 1, 3);
  const P = (x: number) => `(${x}, ${m(sl * x + b)})`;
  return {
    kind: 'fill',
    body: `Write the line through **${P(x1)}** and **${P(x2)}** as y = mx + b.`,
    template: 'y = [[0]]x [[1]]',
    blanks: [numTiles(sl, [-sl, b, sl + 1]), tiles3(signed(b), [signed(-b), signed(sl * x1 + b), signed(b + 1)], (k) => signed(b + k + 1))],
    hint: 'Slope first (rise over run), then work back to x = 0.',
    explain: `Slope: (${m(sl * x2 + b)} − ${m(sl * x1 + b)}) ÷ (${x2} − ${x1}) = ${m(sl)}. Then b = ${m(sl * x1 + b)} − ${m(sl)} × ${x1} = ${m(b)}. So y = ${lin(sl, b)}.`,
  };
};

// Lesson 5: systems
const genIntersect: Generator = (rng) => {
  const X = randInt(rng, -4, 4), Y = randInt(rng, -5, 5);
  const m1 = pick(rng, [-3, -2, -1, 1, 2, 3]);
  let m2 = pick(rng, [-2, -1, 0, 1, 2]);
  if (m2 === m1) m2 = m1 > 0 ? -1 : 1;
  const b1 = Y - m1 * X, b2 = Y - m2 * X;
  return {
    kind: 'point',
    body: `Place the point that satisfies both **y = ${lin(m1, b1)}** and **y = ${lin(m2, b2)}**.`,
    plot: { x: [-6, 6], y: [-10, 10], ticks: [1, 2], layers: [
      { type: 'fn', f: (x) => m1 * x + b1, color: 'var(--c1)', label: 'y = ' + lin(m1, b1) },
      { type: 'fn', f: (x) => m2 * x + b2, color: 'var(--c4)', label: 'y = ' + lin(m2, b2) }] },
    answer: { x: X, y: Y }, tol: 0.3, snap: 1,
    hint: 'The crossing point is on both lines. Check it in both equations.',
    explain: `Set them equal: ${lin(m1, b1)} = ${lin(m2, b2)} gives x = ${m(X)}, and then y = ${m(Y)}. Check: ${m(m1)}·${m(X)} ${signed(b1)} = ${m(Y)} and ${m(m2)}·${m(X)} ${signed(b2)} = ${m(Y)}.`,
  };
};

const genElim: Generator = (rng) => {
  const c = randInt(rng, 2, 6), u = randInt(rng, 1, 5), n1 = randInt(rng, 3, 5), n2 = randInt(rng, 1, n1 - 1);
  const [it, other] = pick(rng, [['coffee', 'muffin'], ['pen', 'notebook'], ['apple', 'melon']] as const);
  const A = n1 * c + u, B = n2 * c + u;
  return {
    kind: 'number',
    body: `${n1} ${it}s and 1 ${other} cost $${A}. ${n2} ${it}${n2 > 1 ? 's' : ''} and 1 ${other} cost $${B}. What does one **${it}** cost?`,
    answer: c, tol: 0.001, unit: '$',
    hint: 'Compare the two orders: what is different between them?',
    explain: `The orders differ only by ${n1 - n2} ${it}${n1 - n2 > 1 ? 's' : ''}, and the prices differ by $${A - B}. So one ${it} costs $${A - B} ÷ ${n1 - n2} = $${c} (and the ${other} costs $${u}).`,
  };
};

const genSubst: Generator = (rng) => {
  const k = randInt(rng, 2, 5), x = randInt(rng, 1, 9), S = x * (k + 1);
  const askY = rng() < 0.5;
  return {
    kind: 'number',
    body: `**y = ${k}x** and **x + y = ${S}**. What is **${askY ? 'y' : 'x'}**?`,
    answer: askY ? k * x : x, tol: 1e-9,
    hint: `Swap y for ${k}x in the second equation.`,
    explain: `Substitute: x + ${k}x = ${S}, so ${k + 1}x = ${S} and x = ${x}. Then y = ${k} × ${x} = ${k * x}.`,
  };
};

// Lesson 6: growth
const genCompound: Generator = (rng) => {
  const P = pick(rng, [500, 1000, 2000, 5000]), r = pick(rng, [5, 10, 20, 50]), n = randInt(rng, 2, 4);
  const v = P * (1 + r / 100) ** n;
  return {
    kind: 'number',
    body: `You invest **$${P.toLocaleString('en-US')}** at **${r}%** a year, compounded yearly. How much is there after **${n} years**?`,
    answer: Math.round(v * 100) / 100, tol: 0.5, unit: '$',
    hint: `Each year multiplies the amount by ${num(1 + r / 100)}.`,
    explain: `Multiply by ${num(1 + r / 100)} once per year: $${P.toLocaleString('en-US')} × ${num(1 + r / 100)}${sup(n)} = $${(Math.round(v * 100) / 100).toLocaleString('en-US')}.`,
  };
};

const genDoubling: Generator = (rng) => {
  const D = randInt(rng, 20, 60), k = randInt(rng, 1, 4);
  const thing = pick(rng, ['Lily pads cover a pond', 'Mould covers a slice of bread', 'Algae covers a lake']);
  const share = ['half', 'a quarter', 'an eighth', 'a sixteenth'][k - 1];
  return {
    kind: 'number',
    body: `${thing}, doubling the covered area every day. It is fully covered on **day ${D}**. On which day was it **${share}** covered?`,
    answer: D - k, tol: 1e-9,
    hint: 'Work backwards: each day back halves the cover.',
    explain: `Going back one day halves the cover. ${share[0].toUpperCase() + share.slice(1)} is ${k} halving${k > 1 ? 's' : ''} from full, so day ${D} − ${k} = ${D - k}.`,
  };
};

const genNextTerm: Generator = (rng) => {
  const geo = rng() < 0.5;
  const a = randInt(rng, 1, 9), d = geo ? pick(rng, [2, 3]) : randInt(rng, 2, 12);
  const seq = Array.from({ length: 5 }, (_, k) => (geo ? a * d ** k : a + d * k));
  return {
    kind: 'number',
    body: `What comes next: **${seq.slice(0, 4).join(', ')}, …**?`,
    answer: seq[4], tol: 1e-9,
    hint: 'Is it adding the same amount each step, or multiplying by the same number?',
    explain: geo ? `Each term is ${d} times the last (exponential): ${seq[3]} × ${d} = ${seq[4]}.` : `Each term adds ${d} (linear): ${seq[3]} + ${d} = ${seq[4]}.`,
  };
};

// Lesson 7: quadratics
const genVertex: Generator = (rng) => {
  const hh = randInt(rng, -4, 4), k = randInt(rng, -6, 6), a = pick(rng, [1, -1, 2, -2, 3]);
  const inner = hh === 0 ? 'x²' : `(x ${hh > 0 ? '−' : '+'} ${Math.abs(hh)})²`;
  const lead = a === 1 ? '' : a === -1 ? '−' : m(a);
  return {
    kind: 'point',
    body: `Place the **vertex** of **y = ${lead}${inner}${k ? ` ${signed(k)}` : ''}**.`,
    plot: { x: [-6, 6], y: [-8, 8], ticks: [1, 2] },
    answer: { x: hh, y: k }, tol: 0.3, snap: 1,
    hint: 'The squared part is never negative and is 0 at exactly one x.',
    explain: `The square is 0 when x = ${m(hh)}, and then y = ${m(k)}. Every other x moves y ${a > 0 ? 'up' : 'down'}, so the vertex is (${m(hh)}, ${m(k)}).`,
  };
};

const genRoots: Generator = (rng) => {
  let r1 = 0, r2 = 0;
  while (r1 === 0 || r2 === 0 || r1 === r2 || r1 === -r2) { r1 = randInt(rng, -6, 6); r2 = randInt(rng, -6, 6); }
  const opt = (v: number, ok: boolean) => ({ text: `x = ${m(v)}`, correct: ok || undefined, why: ok ? undefined : `At x = ${m(v)} neither bracket is 0. Watch the signs: (x − a) is 0 at x = a, and (x + a) is 0 at x = −a.` });
  return {
    kind: 'multi',
    body: `Where does **y = ${factor(r1)}${factor(r2)}** cross the x-axis? Select all.`,
    options: [opt(r1, true), opt(r2, true), opt(-r1, false), opt(-r2, false)].sort((p, q) => Number(p.text.slice(4).replace('−', '-')) - Number(q.text.slice(4).replace('−', '-'))),
    ordered: true,
    hint: 'A product is 0 exactly when one of its factors is 0.',
    explain: `y = 0 when ${factor(r1)} = 0 or ${factor(r2)} = 0: x = ${m(r1)} or x = ${m(r2)}.`,
  };
};

const genCompleteSq: Generator = (rng) => {
  const hb = pick(rng, [-7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7]), b = 2 * hb, sq = hb * hb, A = Math.abs(hb);
  return {
    kind: 'fill',
    body: `Complete the square for **${quad(1, b, 0)}**.`,
    template: `x² ${signed(b, 'x')} + [[0]] = (x ${hb > 0 ? '+' : '−'} [[1]])²`,
    blanks: [numTiles(sq, [b * b, Math.abs(b), sq * 2]), numTiles(A, [Math.abs(b), sq, A + 1])],
    hint: 'Split the x-strip into two halves: the missing corner is (half)².',
    explain: `Half of ${Math.abs(b)} is ${A}, and the missing corner is ${A}² = ${sq}. So ${quad(1, b, sq)} = (x ${hb > 0 ? '+' : '−'} ${A})².`,
  };
};

// Lesson 8: inverses and logs
const genThink: Generator = (rng) => {
  const a = randInt(rng, 2, 9), x = randInt(rng, 2, 15), b = randInt(rng, 1, 20), add = rng() < 0.5;
  const c = add ? a * x + b : a * x - b;
  return {
    kind: 'number',
    body: `I think of a number, multiply it by ${a}, then ${add ? `add ${b}` : `subtract ${b}`}. I get **${m(c)}**. What was my number?`,
    answer: x, tol: 1e-9,
    hint: 'Undo the steps in reverse order.',
    explain: `Undo the last step first: ${m(c)} ${add ? `− ${b}` : `+ ${b}`} = ${a * x}. Then undo the multiply: ${a * x} ÷ ${a} = ${x}.`,
  };
};

const SUB: Record<number, string> = { 2: '₂', 3: '₃', 5: '₅', 10: '₁₀' };
const genLog: Generator = (rng) => {
  const b = pick(rng, [2, 2, 3, 5, 10]), k = randInt(rng, 0, b === 2 ? 10 : b === 10 ? 6 : 4);
  const N = b ** k;
  return {
    kind: 'number',
    body: `What is **log${SUB[b]} ${N.toLocaleString('en-US')}**?`,
    answer: k, tol: 1e-9,
    hint: `How many times do you multiply 1 by ${b} to reach ${N.toLocaleString('en-US')}?`,
    explain: `${b}${sup(k)} = ${N.toLocaleString('en-US')}${k === 0 ? ' (multiply by ' + b + ' zero times)' : ''}, so log${SUB[b]} ${N.toLocaleString('en-US')} = ${k}.`,
  };
};

const genInvFn: Generator = (rng) => {
  const a = randInt(rng, 2, 9), b = (randInt(rng, 1, 12)) * (rng() < 0.5 ? -1 : 1);
  const undo = b > 0 ? '−' : '+', bad = b > 0 ? '+' : '−', B = Math.abs(b);
  return {
    kind: 'choice',
    body: `**f(x) = ${lin(a, b)}**. Which rule undoes it (the inverse, f⁻¹)?`,
    options: [
      { text: `f⁻¹(x) = (x ${undo} ${B}) ÷ ${a}`, correct: true },
      { text: `f⁻¹(x) = (x ${bad} ${B}) ÷ ${a}`, why: `To undo ${b > 0 ? 'adding' : 'subtracting'} ${B} you must ${b > 0 ? 'subtract' : 'add'} it.` },
      { text: `f⁻¹(x) = x ÷ ${a} ${undo} ${B}`, why: `Right operations, wrong order: f multiplied first, so the inverse must undo the ${b > 0 ? '+' : '−'} ${B} first.` },
      { text: `f⁻¹(x) = ${a}x ${undo} ${B}`, why: `Multiplying by ${a} is undone by dividing by ${a}, not by multiplying again.` },
    ],
    hint: 'f multiplies, then adds. Undo in reverse order with opposite operations.',
    explain: `f does × ${a} then ${b > 0 ? '+' : '−'} ${B}. Undo the last step first: ${undo} ${B}, then ÷ ${a}. Check with x = 1: f(1) = ${m(a + b)}, and (${m(a + b)} ${undo} ${B}) ÷ ${a} = 1.`,
  };
};

// ---------------------------------------------------------------- shared pictures

const linesABCD = () => plotEl({ x: [-5, 5], y: [-6, 8], ticks: [1, 2], layers: [
  { type: 'fn', f: (x) => 2 * x + 1, color: 'var(--c1)' },
  { type: 'fn', f: (x) => -x + 4, color: 'var(--c2)' },
  { type: 'fn', f: () => 3, color: 'var(--c3)' },
  { type: 'fn', f: (x) => x / 2 - 2, color: 'var(--c4)' },
  { type: 'text', x: 3.4, y: 7, text: 'A', color: 'var(--c1)', anchor: 'start' },
  { type: 'text', x: -2.5, y: 7.1, text: 'B', color: 'var(--c2)', anchor: 'start' },
  { type: 'text', x: -4.5, y: 3.6, text: 'C', color: 'var(--c3)' },
  { type: 'text', x: -4.3, y: -3.3, text: 'D', color: 'var(--c4)' }] });

const fmtMoney = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const centsDay = (d: number) => fmtMoney(2 ** (d - 1) / 100);

// ---------------------------------------------------------------- course

export const algebra: Course = {
  id: 'algebra',
  title: 'Algebra & Functions',
  blurb: 'Balance equations, read graphs, and see why doubling beats adding.',
  color: C.main,
  icon: '➗',
  lessons: [
    // ============================================================ 1
    {
      id: 'balance',
      title: 'Balancing',
      goal: 'Solve equations by doing the same thing to both sides.',
      steps: [
        {
          kind: 'number',
          title: 'A puzzle on a scale',
          body: 'The scale is level. Every blue box weighs the same; each orange weight weighs 1. How much does **one box** weigh?',
          widget: scale({ x: 3, n: 2 }, { x: 0, n: 11 }),
          answer: 3, tol: 1e-9,
          hint: 'What if you lifted 2 weights off each side? Would it stay level?',
          explain: 'Take 2 weights off both sides: 3 boxes balance 9 weights. Split each side into 3 equal groups: 1 box balances 3 weights.',
        },
        {
          kind: 'read',
          title: 'An equation is a balance',
          body: 'You just solved **3x + 2 = 11**. The = sign says the two sides weigh the same.\n\nThe one rule: **whatever you do to one side, do to the other.** Then it stays level. Take 2 off only one side, and it tips:',
          widget: scale({ x: 3, n: 0 }, { x: 0, n: 11 }, 3),
        },
        {
          kind: 'task',
          title: 'Your turn',
          body: 'Solve **3x + 4 = 10** with the scale: get **one box alone** on the left, with the scale level.',
          widget: balanceTask({ x: 3, n: 4 }, { x: 0, n: 10 }, 2),
          hint: 'Clear the loose weights from the box side first, then split into equal groups.',
          explain: 'Take 4 weights off both sides (3x = 6), then split each side into 3 equal groups: x = 2.',
        },
        {
          kind: 'choice',
          body: 'Back to **3x + 2 = 11** (so x = 3). You take 2 weights off the **left side only**. What happens?',
          widget: scale({ x: 3, n: 2 }, { x: 0, n: 11 }),
          options: [
            { text: 'The right side goes down', correct: true },
            { text: 'The left side goes down', why: 'The left just got lighter, so it rises.' },
            { text: 'It stays level', why: 'Only one side changed. Left is now 3 × 3 = 9, right is still 11.' },
          ],
          explain: 'Left: 9, right: 11. The heavier right side drops. An equation changed on one side only stops being true.',
        },
        {
          kind: 'read',
          title: 'Undo, in reverse order',
          body: 'To build 3x + 2, you start with x, **multiply by 3**, then **add 2**. To get back to x, undo those steps **last one first**: subtract 2, then divide by 3. Like taking off shoes before socks.',
          widget: undoStepper(['× 3', '+ 2'], ['− 2', '÷ 3'], [3, 9, 11]),
        },
        {
          kind: 'order',
          body: 'Put the solution of **5x − 4 = 21** in order.',
          items: ['5x − 4 = 21', '5x = 25   (add 4 to both sides)', 'x = 5   (divide both sides by 5)', 'Check: 5 × 5 − 4 = 21 ✓'],
          hint: 'Undo the − 4 before the × 5.',
          explain: 'Undo the last thing done to x first (the − 4), then the × 5. Then check by putting x = 5 back in.',
        },
        {
          kind: 'fill',
          body: 'Fill in the steps.',
          widget: scale({ x: 2, n: 7 }, { x: 0, n: 19 }),
          template: '2x + 7 = 19  →  2x = [[0]]  →  x = [[1]]',
          blanks: [{ options: ['12', '26', '9'], answer: 0 }, { options: ['6', '24', '10'], answer: 0 }],
          hint: 'Take 7 off both sides first.',
          explain: '19 − 7 = 12, so 2x = 12. Halve both sides: x = 6.',
        },
        {
          kind: 'multi',
          body: 'Start from **3x + 6 = 18**. Which moves give an equation that is **still true**? Select all.',
          options: [
            { text: 'Subtract 6 from both sides', correct: true },
            { text: 'Divide both sides by 3', correct: true },
            { text: 'Multiply both sides by 2', correct: true },
            { text: 'Add 6 to the left side only', why: 'One side only tips the scale: 3x + 12 is not 18 when x = 4.' },
            { text: 'Divide the 6 by 3, leaving the rest', why: 'Dividing a side means dividing **all** of it: (3x + 6) ÷ 3 = x + 2, not 3x + 2.' },
          ],
          explain: 'Any move done to the whole of both sides keeps them equal: subtracting 6 gives 3x = 12, dividing by 3 gives x + 2 = 6, doubling gives 6x + 12 = 36. All still say x = 4.',
        },
        {
          kind: 'number',
          title: 'Boxes on both sides',
          body: 'Now there are boxes on both pans: **5x + 2 = 2x + 14**. What is x?',
          widget: balanceTask({ x: 5, n: 2 }, { x: 2, n: 14 }, 4),
          answer: 4, tol: 1e-9,
          hint: 'Lift 2 boxes off each side first.',
          explain: 'Take 2x off both sides: 3x + 2 = 14. Take 2 off both: 3x = 12. Divide by 3: x = 4. (Check: 22 = 22.)',
        },
        {
          kind: 'sort',
          body: 'Sort the equations by their solution.',
          bins: ['x = 2', 'x = 3', 'x = 4'],
          items: [
            { text: '2x + 1 = 7', bin: 1 }, { text: 'x − 5 = −3', bin: 0 }, { text: '3x = 12', bin: 2 },
            { text: '4x − 2 = 10', bin: 1 }, { text: '10 − x = 8', bin: 0 }, { text: 'x ÷ 2 = 2', bin: 2 },
          ],
          hint: 'You can always test: put the value in and see if both sides match.',
          explain: '2x + 1 = 7 → x = 3; x − 5 = −3 → x = 2; 3x = 12 → x = 4; 4x − 2 = 10 → x = 3; 10 − x = 8 → x = 2; x ÷ 2 = 2 → x = 4.',
        },
        {
          kind: 'choice',
          title: 'Spot the slip',
          body: 'Ben solves **4x + 8 = 20** by dividing first and writes **x + 8 = 5**. What went wrong?',
          options: [
            { text: 'He divided the 4x by 4 but not the 8', correct: true },
            { text: 'You may never divide before subtracting', why: 'You may: dividing **every** term by 4 gives x + 2 = 5, which also leads to x = 3.' },
            { text: 'Nothing: x = −3 is right', why: 'Check it: 4 × (−3) + 8 = −4, not 20.' },
          ],
          explain: 'Dividing a side divides all of it: (4x + 8) ÷ 4 = x + 2. Then x + 2 = 5 and x = 3. Check: 12 + 8 = 20 ✓.',
        },
        {
          kind: 'read',
          title: 'The whole lesson in one line',
          body: 'An equation is a level scale. Do the **same thing to both whole sides**, undo operations **in reverse order**, and **check** by putting your answer back in.',
          widget: scale({ x: 1, n: 0 }, { x: 0, n: 3 }),
        },
      ],
      practice: [genSolve, genBothSides, genFillSolve],
    },

    // ============================================================ 2
    {
      id: 'expressions',
      title: 'Variables & expressions',
      goal: 'Combine like terms, distribute, and expand brackets with area pictures.',
      steps: [
        {
          kind: 'choice',
          body: 'Simplify **3x + 5 + 2x − 1**.',
          widget: tiles([{ kind: 'x', n: 3 }, { kind: '1', n: 5 }, { kind: 'x', n: 2 }, { kind: '1', n: 1, neg: true }]),
          options: [
            { text: '5x + 4', correct: true },
            { text: '9x', why: 'The 5 and the −1 are plain numbers, not x’s. Bars and little squares can’t merge into one pile.' },
            { text: '5x + 6', why: 'The 1 is subtracted: 5 − 1 = 4.' },
            { text: '6x + 4', why: 'Count the bars: 3 + 2 = 5, not 3 × 2.' },
          ],
          explain: 'Gather the bars (3x + 2x = 5x) and the units (5 − 1 = 4): 5x + 4.',
        },
        {
          kind: 'read',
          title: 'Like terms are the same shape',
          body: 'Picture each term as a tile. **x** is a bar, **1** is a small square, **x²** is a big x-by-x square. You can only add tiles of the same shape: 2x + 3x = 5x, but 2x + 3 stays 2x + 3, and x² + x stays x² + x.',
          widget: tiles([{ kind: 'x2', n: 2 }, { kind: 'x', n: 3 }, { kind: '1', n: 4 }], '2x² + 3x + 4'),
        },
        {
          kind: 'sort',
          body: 'Sort the terms into groups that can be combined.',
          bins: ['x terms', 'x² terms', 'plain numbers'],
          items: [
            { text: '4x', bin: 0 }, { text: '−x', bin: 0 }, { text: 'x ÷ 2', bin: 0 }, { text: '3x²', bin: 1 },
            { text: '−5x²', bin: 1 }, { text: '7', bin: 2 }, { text: '−2', bin: 2 },
          ],
          hint: 'Look at the letter part only; the number in front doesn’t matter.',
          explain: 'Like terms share the same letter part: x-terms (4x, −x, x ÷ 2), x²-terms (3x², −5x²) and numbers (7, −2).',
        },
        {
          kind: 'number',
          body: 'An expression is a recipe waiting for a number. What is **2x² − 3x + 1** when **x = 4**?',
          answer: 21, tol: 1e-9,
          hint: 'Square first: x² = 16.',
          explain: '2 × 16 − 3 × 4 + 1 = 32 − 12 + 1 = 21.',
        },
        {
          kind: 'read',
          title: 'Distributing: copies of a bracket',
          body: '**3(x + 4)** means three copies of (x + 4). As an area: a rectangle 3 tall and (x + 4) wide splits into a 3-by-x piece and a 3-by-4 piece. So 3(x + 4) = **3x + 12**. The 3 multiplies **everything** inside.',
          widget: areaModel({ cols: ['x', '4'], rows: ['3'], colW: [5, 3], rowH: [2.4], cells: [['3x', '12']] }),
        },
        {
          kind: 'fill',
          body: 'Distribute.',
          widget: areaModel({ cols: ['2x', '−3'], rows: ['4'], colW: [5, 3], rowH: [2.4], cells: [['?', '?']] }),
          template: '4(2x − 3) = [[0]]x − [[1]]',
          blanks: [{ options: ['8', '6', '2'], answer: 0 }, { options: ['12', '3', '7'], answer: 0 }],
          hint: 'The 4 multiplies both the 2x and the 3.',
          explain: '4 × 2x = 8x and 4 × 3 = 12, so 8x − 12. A common slip is 8x − 3: forgetting to multiply the second term.',
        },
        {
          kind: 'read',
          title: 'Two brackets: four rectangles',
          body: '**(x + 3)(x + 2)** is the area of a rectangle with sides x + 3 and x + 2. Cut it along both splits and you get four pieces: x², 3x, 2x and 6.\n\nSo (x + 3)(x + 2) = x² + 5x + 6. Every term in one bracket meets every term in the other.',
          widget: areaModel({ cols: ['x', '3'], rows: ['x', '2'], colW: [5, 3], rowH: [5, 2], cells: [['x²', '3x'], ['2x', '6']] }),
        },
        {
          kind: 'choice',
          body: 'What is **(x + 5)²**?',
          widget: areaModel({ cols: ['x', '5'], rows: ['x', '5'], colW: [5, 3.2], rowH: [5, 3.2], cells: [['x²', '?'], ['?', '?']], hide: [[0, 1], [1, 0], [1, 1]] }),
          options: [
            { text: 'x² + 10x + 25', correct: true },
            { text: 'x² + 25', why: 'That only counts the two squares. The picture has two more strips, each 5x.' },
            { text: 'x² + 5x + 25', why: 'There are **two** 5x strips (top right and bottom left): 10x.' },
            { text: '2x + 10', why: 'That’s 2(x + 5), doubling, not squaring.' },
          ],
          explain: 'Four pieces: x², 5x, 5x and 25. So (x + 5)² = x² + 10x + 25. Squaring a sum is not the sum of the squares.',
        },
        {
          kind: 'match',
          body: 'Match each product to its expansion.',
          heads: ['Product', 'Expanded'],
          pairs: [['(x + 1)(x + 6)', 'x² + 7x + 6'], ['(x + 2)²', 'x² + 4x + 4'], ['(x + 2)(x + 3)', 'x² + 5x + 6'], ['(x − 2)(x + 2)', 'x² − 4']],
          hint: 'The middle term is the two numbers added; the last term is them multiplied.',
          explain: '(x + p)(x + q) = x² + (p + q)x + pq. For (x − 2)(x + 2), the strips −2x and +2x cancel, leaving x² − 4.',
        },
        {
          kind: 'number',
          title: 'Mental math, by area',
          body: 'The same picture works for numbers. Use it to work out **23 × 17**.',
          widget: areaModel({ cols: ['20', '3'], rows: ['10', '7'], colW: [6, 2], rowH: [4, 3], cells: [['200', '60'], ['140', '21']], hide: [[0, 0], [0, 1], [1, 0], [1, 1]] }),
          answer: 391, tol: 1e-9,
          hint: '20 × 10, 3 × 10, 20 × 7, 3 × 7. Then add.',
          explain: '200 + 30 + 140 + 21 = 391. (23 = 20 + 3 and 17 = 10 + 7.)',
        },
        {
          kind: 'multi',
          body: 'Which expressions equal **2(x + 3) + x** for **every** x? Select all.',
          options: [
            { text: '3x + 6', correct: true },
            { text: '3(x + 2)', correct: true },
            { text: 'x + 6 + 2x', correct: true },
            { text: '2x + 3 + x', why: 'The 2 must multiply the 3 as well: 2(x + 3) = 2x + 6.' },
            { text: '2x + 6', why: 'That forgets the + x at the end.' },
          ],
          hint: 'Simplify 2(x + 3) + x first, then compare. Or test x = 1 in each.',
          explain: '2(x + 3) + x = 2x + 6 + x = 3x + 6. Both 3(x + 2) and x + 6 + 2x are the same thing written differently. Testing x = 1: the right ones all give 9.',
        },
      ],
      practice: [genEvaluate, genExpand, genCollect],
    },

    // ============================================================ 3
    {
      id: 'functions',
      title: 'Functions as machines',
      goal: 'Read rules from tables, evaluate functions and chain them.',
      steps: [
        {
          kind: 'number',
          title: 'A mystery machine',
          body: 'A machine turns numbers into other numbers. Here’s what came out for a few inputs. What comes out for **10**?',
          widget: () => dataTable(['input', '1', '2', '3', '4', '10'], [['output', '5', '8', '11', '14', '?']]),
          answer: 32, tol: 1e-9,
          hint: 'Each input step of 1 adds how much to the output? And what would input 0 give?',
          explain: 'Outputs go up by 3 per step, and input 0 would give 5 − 3 = 2. The rule is “times 3, plus 2”: 3 × 10 + 2 = 32.',
        },
        {
          kind: 'read',
          title: 'A function is a rule',
          body: 'A **function** takes an input and gives **exactly one** output by a fixed rule. This one is **f(x) = 3x + 2**: f(10) means “the output when 10 goes in”. Step through some inputs:',
          widget: machineStepper([{ label: '× 3', f: (x) => 3 * x }, { label: '+ 2', f: (x) => x + 2 }], [1, 2, 3, 4, 10], 'f(x)'),
        },
        {
          kind: 'fill',
          body: 'Find the rule for this table.',
          widget: () => dataTable(['x', '0', '1', '2', '3'], [['f(x)', '1', '3', '5', '7']]),
          template: 'f(x) = [[0]]x + [[1]]',
          blanks: [{ options: ['2', '3', '1'], answer: 0 }, { options: ['1', '0', '3'], answer: 0 }],
          hint: 'The step size is the multiplier; the output at x = 0 is the starting value.',
          explain: 'Each step adds 2, and f(0) = 1. So f(x) = 2x + 1. Check: f(3) = 7 ✓.',
        },
        {
          kind: 'match',
          body: 'Match each table to its rule.',
          heads: ['Table', 'Rule'],
          pairs: [['1→2, 2→4, 3→6', 'x ↦ 2x'], ['1→3, 2→4, 3→5', 'x ↦ x + 2'], ['1→1, 2→4, 3→9', 'x ↦ x²'], ['1→1, 2→3, 3→5', 'x ↦ 2x − 1']],
          hint: 'Test each rule on input 1, then on input 3.',
          explain: 'Input 1 separates 2x (gives 2) from x + 2 (gives 3) and 2x − 1 (gives 1). x² is the only table whose steps grow (3, then 5) instead of staying constant.',
        },
        {
          kind: 'number',
          body: '**f(x) = 2x² − x**. What is **f(−3)**?',
          widget: machine(['square', '× 2', '− input'], ['−3', '9', '18', '']),
          answer: 21, tol: 1e-9,
          hint: '(−3)² = 9, and subtracting −3 adds 3.',
          explain: 'f(−3) = 2 × (−3)² − (−3) = 2 × 9 + 3 = 21. Brackets around negative inputs save you here.',
        },
        {
          kind: 'read',
          title: 'Chaining machines',
          body: 'Feed one machine’s output into another and you get a new function, a **composition**. With **f(x) = x + 2** and **g(x) = 4x**, the chain **g(f(x))** runs f first (inside), then g.',
          widget: machine(['f: + 2', 'g: × 4'], ['3', '5', '20']),
        },
        {
          kind: 'number',
          body: 'Same machines, other order: what is **f(g(3))**?',
          widget: machine(['g: × 4', 'f: + 2'], ['3', '', '']),
          answer: 14, tol: 1e-9,
          hint: 'Inside first: g(3).',
          explain: 'g(3) = 12, then f(12) = 14. Not the 20 from before: order matters.',
        },
        {
          kind: 'choice',
          body: 'Write **g(f(x))** as one rule (f(x) = x + 2, g(x) = 4x).',
          options: [
            { text: '4x + 8', correct: true },
            { text: '4x + 2', why: 'That’s f(g(x)): multiply first, then add 2.' },
            { text: '4x² + 8x', why: 'That multiplies the two functions, f(x) × g(x). Chaining feeds one into the other.' },
            { text: 'x + 6', why: 'Adding 2 and 4 mixes up the operations: g multiplies by 4.' },
          ],
          explain: 'g(f(x)) = 4 × (x + 2) = 4x + 8. Check with x = 3: 20 ✓.',
        },
        {
          kind: 'multi',
          body: 'A function gives each input **exactly one** output. Which of these are functions? Select all.',
          options: [
            { text: 'Person ↦ their date of birth', correct: true },
            { text: 'x ↦ x²', correct: true },
            { text: 'Student ↦ their height right now', correct: true },
            { text: 'Number ↦ a number that squares to it (9 ↦ 3 or −3)', why: '9 has two square roots, 3 and −3: two outputs for one input.' },
            { text: 'Month ↦ a day in that month', why: 'March has 31 days; which one? Many outputs for one input.' },
          ],
          explain: 'Several inputs may share an output (lots of people share a birthday), but one input may not have two outputs.',
        },
        {
          kind: 'sort',
          body: 'Each list pairs inputs with outputs. Sort them.',
          bins: ['function', 'not a function'],
          items: [
            { text: '(1, 2), (2, 3), (3, 4)', bin: 0 },
            { text: '(1, 5), (1, 6), (2, 7)', bin: 1 },
            { text: '(1, 4), (2, 4), (3, 4)', bin: 0 },
            { text: '(0, 0), (0, 1)', bin: 1 },
            { text: '(−1, 1), (1, 1), (2, 4)', bin: 0 },
          ],
          hint: 'Look for an input that appears twice with different outputs.',
          explain: 'Input 1 → 5 and 6, and input 0 → 0 and 1 break the rule. Repeated **outputs** (all 4s, or 1 twice) are fine.',
        },
        {
          kind: 'point',
          title: 'Functions draw graphs',
          body: 'Each input–output pair of **f(x) = x² − 4** is a point (x, f(x)). Three are plotted. Place the point for **x = 3**.',
          plot: { x: [-4, 4], y: [-6, 10], ticks: [1, 2], layers: [{ type: 'dots', pts: [[0, -4], [1, -3], [2, 0]], labels: ['(0, −4)', '(1, −3)', '(2, 0)'] }] },
          answer: { x: 3, y: 5 }, tol: 0.3, snap: 1,
          hint: 'f(3) = 3² − 4.',
          explain: 'f(3) = 9 − 4 = 5, so the point is (3, 5). Join all such points and you get the graph of f.',
        },
      ],
      practice: [genEvalFn, genCompose, genRule],
    },

    // ============================================================ 4
    {
      id: 'lines',
      title: 'Slope & lines',
      goal: 'Read and write y = mx + b: rate of change and starting value.',
      steps: [
        {
          kind: 'number',
          title: 'A taxi ride',
          body: 'A taxi charges **$3** to get in plus **$2 per km**. What does a **5 km** ride cost?',
          widget: () => dataTable(['km', '0', '1', '2', '3', '5'], [['cost ($)', '3', '5', '7', '9', '?']]),
          answer: 13, tol: 1e-9, unit: '$',
          explain: '$3 + 5 × $2 = $13.',
        },
        {
          kind: 'read',
          title: 'Constant rate = straight line',
          body: 'Plot the fares and they fall on a straight line: every 1 km **right** goes $2 **up**. That steady rate is the **slope** (m = 2). Where the line starts, at x = 0, is the **intercept** (b = 3).\n\n**y = mx + b**, here y = 2x + 3.',
          widget: () => plotEl({ x: [0, 6], y: [0, 16], ticks: [1, 2], xlabel: 'km', ylabel: 'cost ($)', layers: [
            { type: 'fn', f: (x) => 2 * x + 3, color: 'var(--c1)' },
            { type: 'dots', pts: [[0, 3], [1, 5], [2, 7], [3, 9], [5, 13]], color: 'var(--c1)' },
            { type: 'line', pts: [[3, 9], [4, 9], [4, 11]], color: 'var(--c2)', dash: true },
            { type: 'text', x: 3.5, y: 8.1, text: 'run 1', color: 'var(--c2)' },
            { type: 'text', x: 4.25, y: 10, text: 'rise 2', color: 'var(--c2)', anchor: 'start' },
            { type: 'text', x: 0.15, y: 4.4, text: 'b = 3', color: 'var(--c3)', anchor: 'start' }] }),
        },
        {
          kind: 'task',
          body: 'Set **m** and **b** so the line passes through **both** points.',
          widget: plotExplorer({
            params: [{ id: 'm', label: 'slope m', min: -3, max: 3, step: 0.5, value: 0 }, { id: 'b', label: 'intercept b', min: -5, max: 5, step: 1, value: 0 }],
            spec: (v) => ({ x: [-5, 5], y: [-6, 8], ticks: [1, 2], layers: [{ type: 'fn', f: (x) => v.m * x + v.b }, { type: 'dots', pts: [[1, 1], [3, 5]], color: 'var(--c2)', labels: ['(1, 1)', '(3, 5)'] }] }),
            readout: (v) => `y = ${lin(v.m, v.b)}`,
            goal: (v) => Math.abs(v.m - 2) < 1e-9 && Math.abs(v.b + 1) < 1e-9,
            goalText: 'Through both points.',
          }),
          hint: 'From (1, 1) to (3, 5): 2 right, 4 up. That fixes the slope; then slide b.',
          explain: 'Slope = 4 ÷ 2 = 2. Going one step left from (1, 1) to x = 0 drops y by 2, so b = −1: y = 2x − 1.',
        },
        {
          kind: 'number',
          body: 'What is the slope of the line through **(2, 3)** and **(6, 11)**?',
          widget: () => plotEl({ x: [0, 8], y: [0, 12], ticks: [1, 2], layers: [
            { type: 'dots', pts: [[2, 3], [6, 11]], labels: ['(2, 3)', '(6, 11)'] },
            { type: 'line', pts: [[2, 3], [6, 3], [6, 11]], color: 'var(--c2)', dash: true }] }),
          answer: 2, tol: 0.01,
          hint: 'Rise ÷ run: (11 − 3) ÷ (6 − 2).',
          explain: 'Rise 8, run 4: slope 8 ÷ 4 = 2. It doesn’t matter which two points of a line you use.',
        },
        {
          kind: 'point',
          body: 'A line has slope **3** and passes through **(2, 5)**. Place the point where it crosses the **y-axis**.',
          plot: { x: [-4, 4], y: [-6, 10], ticks: [1, 2], layers: [{ type: 'dots', pts: [[2, 5]], color: 'var(--c2)', labels: ['(2, 5)'] }] },
          answer: { x: 0, y: -1 }, tol: 0.3, snap: 1,
          hint: 'Walk 2 steps left to x = 0. Each step left goes down 3.',
          explain: 'Two steps left drop y by 2 × 3 = 6: from 5 to −1. So b = −1 and the line is y = 3x − 1.',
        },
        {
          kind: 'match',
          body: 'Match each line to its equation.',
          widget: linesABCD,
          heads: ['Line', 'Equation'],
          pairs: [['Line A', 'y = 2x + 1'], ['Line B', 'y = −x + 4'], ['Line C', 'y = 3'], ['Line D', 'y = x/2 − 2']],
          hint: 'Check the steepness and direction first, then where each crosses the y-axis.',
          explain: 'A is steepest and rising (m = 2). B falls (m = −1) from 4. C is flat (m = 0). D rises gently (m = 1/2) from −2.',
        },
        {
          kind: 'choice',
          title: 'Slope as a rate',
          body: 'A phone’s battery level is **y = 100 − 8x** (percent, x hours after unplugging). What does the **−8** tell you?',
          options: [
            { text: 'It loses 8 percentage points per hour', correct: true },
            { text: 'It started at 8%', why: 'The starting level is the constant term, 100%.' },
            { text: 'It lasts 8 hours', why: 'At 8 points an hour from 100%, it lasts 100 ÷ 8 = 12.5 hours.' },
            { text: 'It loses 8% of what is left each hour', why: 'That would be exponential decay. A fixed −8 each hour is a straight line.' },
          ],
          explain: 'The slope is the rate of change: −8 points per hour. Negative means falling.',
        },
        {
          kind: 'estimate',
          body: 'Read it off the graph: when does the battery hit **0%**?',
          widget: () => plotEl({ x: [0, 16], y: [0, 110], ticks: [2, 20], xlabel: 'hours', ylabel: 'battery %', layers: [{ type: 'fn', f: (x) => 100 - 8 * x, from: 0, to: 12.5 }] }),
          min: 0, max: 16, step: 0.5, answer: 12.5, tol: 0.5, format: (v) => `${v} h`,
          explain: '100 − 8x = 0 when x = 100 ÷ 8 = 12.5 hours.',
        },
        {
          kind: 'sort',
          body: 'Sort by the sign of the slope.',
          bins: ['positive', 'negative', 'zero'],
          items: [
            { text: 'y = 3x − 7', bin: 0 }, { text: 'y = 5 − 2x', bin: 1 }, { text: 'y = 4', bin: 2 },
            { text: 'y = −x/3 + 1', bin: 1 }, { text: 'Savings growing $50 a week', bin: 0 },
            { text: 'A candle burning down', bin: 1 }, { text: 'A room kept at 20 °C all day', bin: 2 },
          ],
          hint: 'Find the number multiplying x. In 5 − 2x, it is −2.',
          explain: 'Rising: 3x − 7, growing savings. Falling: 5 − 2x, −x/3 + 1, the candle. Flat: y = 4 and the steady room.',
        },
        {
          kind: 'multi',
          body: 'Which points lie on **y = 3x − 2**? Select all.',
          options: [
            { text: '(1, 1)', correct: true },
            { text: '(2, 4)', correct: true },
            { text: '(−1, −5)', correct: true },
            { text: '(0, 2)', why: 'At x = 0, y = −2: the intercept is −2, not 2.' },
            { text: '(3, 6)', why: '3 × 3 − 2 = 7, not 6.' },
          ],
          hint: 'Put each x into 3x − 2 and compare with the y.',
          explain: 'x = 1 → 1, x = 2 → 4, x = −1 → −5. A point is on the line exactly when its coordinates make the equation true.',
        },
        {
          kind: 'read',
          title: 'Play with m and b',
          body: '**m** tilts the line (bigger = steeper, negative = falling). **b** slides it up and down without changing the tilt.',
          widget: plotExplorer({
            params: [{ id: 'm', label: 'slope m', min: -3, max: 3, step: 0.5, value: 1 }, { id: 'b', label: 'intercept b', min: -5, max: 5, step: 1, value: 2 }],
            spec: (v) => ({ x: [-5, 5], y: [-8, 8], ticks: [1, 2], layers: [{ type: 'fn', f: (x) => v.m * x + v.b }, { type: 'dots', pts: [[0, v.b]], color: 'var(--c3)' }] }),
            readout: (v) => `y = ${lin(v.m, v.b)}`,
          }),
        },
      ],
      practice: [genSlope, genIntercept, genLineFill],
    },

    // ============================================================ 5
    {
      id: 'systems',
      title: 'Systems of equations',
      goal: 'Find what satisfies two conditions at once, by picture and by substitution.',
      steps: [
        {
          kind: 'number',
          title: 'Two orders',
          body: 'At a café, **2 coffees and 1 muffin** cost **$8**. **1 coffee and 1 muffin** cost **$5**. What does one **coffee** cost?',
          widget: () => dataTable(['order', 'coffees', 'muffins', 'total'], [['A', 2, 1, '$8'], ['B', 1, 1, '$5']]),
          answer: 3, tol: 0.001, unit: '$',
          hint: 'What’s the only difference between the two orders?',
          explain: 'Order A is order B plus one coffee, and costs $3 more. So a coffee is $3, and then a muffin is $5 − $3 = $2.',
        },
        {
          kind: 'read',
          title: 'Each condition is a line',
          body: 'Call the coffee price c and the muffin price u. **2c + u = 8** has endless solutions: every point on one line. **c + u = 5** is another line. Only the point on **both** works: where they cross, (3, 2).',
          widget: () => plotEl({ x: [0, 6], y: [0, 9], ticks: [1, 1], xlabel: 'coffee c ($)', ylabel: 'muffin u ($)', layers: [
            { type: 'fn', f: (c) => 8 - 2 * c, color: 'var(--c1)', label: '2c + u = 8' },
            { type: 'fn', f: (c) => 5 - c, color: 'var(--c4)', label: 'c + u = 5' },
            { type: 'dots', pts: [[3, 2]], color: 'var(--c2)', labels: ['(3, 2)'] }] }),
        },
        {
          kind: 'multi',
          body: 'Which of these satisfy **x + y = 7**? Select all.',
          options: [
            { text: '(4, 3)', correct: true }, { text: '(2, 5)', correct: true }, { text: '(7, 0)', correct: true }, { text: '(−1, 8)', correct: true },
            { text: '(3, 5)', why: '3 + 5 = 8, not 7.' },
          ],
          explain: 'One equation with two unknowns has infinitely many solutions: a whole line. It takes a second condition to pin down a single point.',
        },
        {
          kind: 'point',
          body: 'Place the point that is on **both** lines: **y = x + 1** and **y = −x + 5**.',
          plot: { x: [-2, 6], y: [-2, 7], ticks: [1, 1], layers: [
            { type: 'fn', f: (x) => x + 1, color: 'var(--c1)', label: 'y = x + 1' },
            { type: 'fn', f: (x) => -x + 5, color: 'var(--c4)', label: 'y = −x + 5' }] },
          answer: { x: 2, y: 3 }, tol: 0.3, snap: 1,
          hint: 'Find where they cross, then check both equations.',
          explain: '(2, 3): 2 + 1 = 3 ✓ and −2 + 5 = 3 ✓.',
        },
        {
          kind: 'read',
          title: 'Substitution: the same y',
          body: 'No graph needed. Both equations give y, and at the crossing they give the **same** y. So set the right-hand sides equal:',
          widget: workStepper([['x + 1 = −x + 5', 'same y'], ['2x + 1 = 5', 'add x to both sides'], ['2x = 4', 'subtract 1'], ['x = 2', 'divide by 2'], ['y = 2 + 1 = 3', 'put x back in']]),
        },
        {
          kind: 'fill',
          body: 'Solve **y = 2x** and **x + y = 12** by substitution.',
          template: 'x + [[0]] = 12, so 3x = 12. Then x = [[1]] and y = [[2]].',
          blanks: [{ options: ['2x', 'y', '12'], answer: 0 }, { options: ['4', '3', '6'], answer: 0 }, { options: ['8', '4', '24'], answer: 0 }],
          hint: 'y is 2x, so swap it in.',
          explain: 'Replace y with 2x: x + 2x = 12, 3x = 12, x = 4, and y = 2 × 4 = 8. Check: 4 + 8 = 12 ✓.',
        },
        {
          kind: 'task',
          body: 'Slide x and y to find the point that makes **both** equations true.',
          widget: plotExplorer({
            params: [{ id: 'x', label: 'x', min: 0, max: 6, step: 1, value: 0 }, { id: 'y', label: 'y', min: 0, max: 10, step: 1, value: 0 }],
            spec: (v) => ({ x: [0, 6], y: [-1, 10], ticks: [1, 1], layers: [
              { type: 'fn', f: (x) => 2 * x - 1, color: 'var(--c1)', label: 'y = 2x − 1' },
              { type: 'fn', f: (x) => -x + 8, color: 'var(--c4)', label: 'y = −x + 8' },
              { type: 'dots', pts: [[v.x, v.y]], color: 'var(--c2)', r: 6 }] }),
            readout: (v) => `2·${v.x} − 1 = ${2 * v.x - 1} ${2 * v.x - 1 === v.y ? '✓' : '✗'}   ·   −${v.x} + 8 = ${8 - v.x} ${8 - v.x === v.y ? '✓' : '✗'}`,
            goal: (v) => v.x === 3 && v.y === 5,
            goalText: 'On both lines.',
          }),
          hint: 'Set 2x − 1 = −x + 8 and solve for x first.',
          explain: '2x − 1 = −x + 8 gives 3x = 9, x = 3, and y = 5. The dot sits on both lines.',
        },
        {
          kind: 'choice',
          body: 'How many solutions does **y = 2x + 1** and **y = 2x − 3** have?',
          widget: () => plotEl({ x: [-4, 4], y: [-8, 8], ticks: [1, 2], layers: [
            { type: 'fn', f: (x) => 2 * x + 1, color: 'var(--c1)', label: 'y = 2x + 1' },
            { type: 'fn', f: (x) => 2 * x - 3, color: 'var(--c4)', label: 'y = 2x − 3' }] }),
          options: [
            { text: 'None', correct: true },
            { text: 'One', why: 'Lines with the same slope never cross unless they are the same line.' },
            { text: 'Infinitely many', why: 'That happens when both equations describe the same line. These have different intercepts.' },
          ],
          explain: 'Same slope, different intercepts: parallel lines, always 4 apart. Setting them equal gives 1 = −3, which is never true.',
        },
        {
          kind: 'sort',
          body: 'Sort the systems by how many solutions they have.',
          bins: ['one', 'none', 'infinitely many'],
          items: [
            { text: 'y = x and y = −x', bin: 0 },
            { text: 'y = x + 1 and y = 2x', bin: 0 },
            { text: 'x + y = 4 and x + y = 6', bin: 1 },
            { text: 'y = 3x + 2 and y = 3x', bin: 1 },
            { text: 'y = 3x + 2 and 2y = 6x + 4', bin: 2 },
            { text: 'y = 2 − x and 3x + 3y = 6', bin: 2 },
          ],
          hint: 'Rewrite each as y = mx + b. Different slopes → one. Same slope, different b → none. Identical → infinitely many.',
          explain: 'Halve 2y = 6x + 4 to get y = 3x + 2: the same line. Divide 3x + 3y = 6 by 3: x + y = 2, the same as y = 2 − x. x + y can’t be 4 and 6 at once.',
        },
        {
          kind: 'number',
          title: 'Tickets',
          body: 'A show sold **20 tickets** for **$164**. Adult tickets are **$10**, child tickets **$6**. How many **child** tickets were sold?',
          answer: 9, tol: 1e-9,
          hint: 'If all 20 were adult tickets, that’s $200. Each swap to a child ticket saves $4.',
          explain: 'Two conditions: a + k = 20 and 10a + 6k = 164. Substituting a = 20 − k: 200 − 4k = 164, so k = 9 (and a = 11: $110 + $54 = $164 ✓).',
        },
      ],
      practice: [genIntersect, genElim, genSubst],
    },

    // ============================================================ 6
    {
      id: 'growth',
      title: 'Linear vs exponential',
      goal: 'Tell adding from multiplying, and feel how fast doubling gets away.',
      steps: [
        {
          kind: 'choice',
          title: 'Two job offers',
          body: 'For 30 days of work you can take **$1,000 a day**, or **1 cent on day 1, doubling every day** (2 cents, 4 cents, …). Which pays more in total?',
          options: [
            { text: 'The doubling cents', correct: true },
            { text: 'The $1,000 a day', why: 'It leads for a long time, but doubling 29 times turns a cent into over $5 million on day 30 alone.' },
            { text: 'About the same', why: 'Not remotely: $30,000 against more than $10 million.' },
          ],
          explain: 'The flat offer pays $30,000. The cents add up to 2³⁰ − 1 cents, about **$10.7 million**.',
        },
        {
          kind: 'number',
          body: 'The doubling offer pays 1 cent on day 1, 2 cents on day 2, 4 on day 3, … On which day does it **first** pay more than $1,000 **that day**?',
          widget: () => dataTable(['day', 'pay that day'], [['1', '$0.01'], ['2', '$0.02'], ['3', '$0.04'], ['…', '…'], ['10', '$5.12'], ['…', '…']]),
          answer: 18, tol: 1e-9,
          hint: 'Day 10 pays $5.12. Keep doubling: day 11 is $10.24…',
          explain: 'Day 17 pays $655.36, day 18 pays $1,310.72. So day 18, and after that every day pays more than the last 12 days of the flat offer combined.',
        },
        {
          kind: 'read',
          title: 'The slow start, the fast finish',
          body: 'For 17 days the doubling offer looks hopeless. Then it explodes. That’s the signature of exponential growth.',
          widget: () => h('div', null,
            dataTable(['day', 'doubling pays', 'flat pays'], [1, 10, 17, 18, 20, 25, 30].map((d) => [String(d), centsDay(d), '$1,000.00']), { highlight: [3] }),
            columnChart([24, 25, 26, 27, 28, 29, 30].map((d) => ({ label: 'day ' + d, value: 2 ** (d - 1) / 100, color: 'var(--c2)' })),
              { format: (v) => (v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1000) + 'k'), height: 180 })),
        },
        {
          kind: 'read',
          title: 'Adding vs multiplying',
          body: '**Linear**: add the same amount each step (a straight line). **Exponential**: multiply by the same factor each step (a curve that bends upward). Both start at 10 here. Try different settings: the curve may lag at first, but any factor above 1 wins in the end.',
          widget: plotExplorer({
            params: [{ id: 'd', label: 'add per step', min: 5, max: 50, step: 5, value: 20 }, { id: 'r', label: 'multiply by', min: 1.1, max: 2, step: 0.1, value: 1.5, format: (v) => '×' + v.toFixed(1) }],
            spec: (v) => ({ x: [0, 12], y: [0, 600], ticks: [1, 100], xlabel: 'step', layers: [
              { type: 'fn', f: (x) => 10 + v.d * x, color: 'var(--c1)', label: 'linear' },
              { type: 'fn', f: (x) => 10 * v.r ** x, color: 'var(--c2)', label: 'exponential' }] }),
            readout: (v) => `after 12 steps: linear ${num(10 + 12 * v.d)}, exponential ${num(Math.round(10 * v.r ** 12))}`,
          }),
        },
        {
          kind: 'sort',
          body: 'Adds a fixed amount, or multiplies by a fixed factor?',
          bins: ['linear (adds)', 'exponential (multiplies)'],
          items: [
            { text: 'Saving $20 every week', bin: 0 },
            { text: 'Bacteria doubling every hour', bin: 1 },
            { text: 'Prices rising 3% a year', bin: 1 },
            { text: 'A taxi meter: $2 per km', bin: 0 },
            { text: 'A car losing 15% of its value each year', bin: 1 },
            { text: 'Walking at 5 km/h', bin: 0 },
          ],
          hint: 'A percentage of the current amount is a multiplication.',
          explain: 'Percent changes multiply (3% up is × 1.03; 15% down is × 0.85), so they are exponential, even when shrinking. Fixed amounts per step are linear.',
        },
        {
          kind: 'number',
          title: 'The lily pond',
          body: 'Lily pads on a pond **double** the area they cover every day. The pond is completely covered on **day 30**. On which day was it **half** covered?',
          widget: () => pond(30),
          answer: 29, tol: 1e-9,
          hint: 'Work backwards one day.',
          explain: 'If it doubles each day, the day before full it was half full: day 29. Not day 15: halfway in time is nowhere near halfway in area.',
        },
        {
          kind: 'read',
          title: 'Watch the last week',
          body: 'Each square is 1/64 of the pond. Step from day 24 to day 30.',
          widget: pondStepper(),
        },
        {
          kind: 'estimate',
          body: 'On **day 26**, roughly what percentage of the pond is covered?',
          widget: () => pond(26),
          min: 0, max: 100, step: 0.25, answer: 6.25, tol: 3, format: (v) => `${v}%`,
          explain: 'Day 26 is 4 doublings before full: 1/16 of the pond, 4/64 = 6.25%. Four days before the end, the pond still looks almost empty.',
        },
        {
          kind: 'number',
          title: 'Money grows the same way',
          body: '**$1,000** earns **10%** a year, and the interest stays in, so next year’s 10% is of a bigger amount. How much after **3 years**?',
          widget: () => dataTable(['year', '0', '1', '2', '3'], [['balance', '$1,000', '$1,100', '?', '?']]),
          answer: 1331, tol: 0.5, unit: '$',
          hint: 'Each year multiplies by 1.1.',
          explain: '$1,000 × 1.1 × 1.1 × 1.1 = $1,331. Simple interest (always 10% of the original) would give $1,300.',
        },
        {
          kind: 'read',
          title: 'Compound vs simple, over decades',
          body: 'Simple interest adds the same amount every year (linear). Compound interest multiplies (exponential). Drag the rate and watch the gap open up.',
          widget: plotExplorer({
            params: [{ id: 'r', label: 'rate', min: 1, max: 12, step: 1, value: 7, format: (v) => v + '%' }],
            spec: (v) => ({ x: [0, 30], y: [0, 12000], ticks: [5, 2000], xlabel: 'years', layers: [
              { type: 'fn', f: (t) => 1000 * (1 + (v.r / 100) * t), color: 'var(--c1)', label: 'simple' },
              { type: 'fn', f: (t) => 1000 * (1 + v.r / 100) ** t, color: 'var(--c2)', label: 'compound' }] }),
            readout: (v) => `$1,000 after 30 years: simple $${Math.round(1000 * (1 + (v.r / 100) * 30)).toLocaleString('en-US')}, compound $${Math.round(1000 * (1 + v.r / 100) ** 30).toLocaleString('en-US')}`,
          }),
        },
        {
          kind: 'choice',
          body: 'A handy rule of thumb, the **rule of 72**: money compounding at r% a year doubles in about 72 ÷ r years. At **6%**, about how long does it take to double?',
          options: [
            { text: 'About 12 years', correct: true },
            { text: 'About 6 years', why: 'That would need about 12% a year.' },
            { text: 'About 17 years', why: '100 ÷ 6 ≈ 17 is how long simple interest takes to double. Compounding is faster.' },
            { text: 'About 72 years', why: 'Divide 72 by the rate: 72 ÷ 6.' },
          ],
          explain: '72 ÷ 6 = 12. The exact answer is about 11.9 years (1.06¹² ≈ 2.01).',
        },
        {
          kind: 'match',
          body: 'Match each sequence to its rule.',
          heads: ['Sequence', 'Rule'],
          pairs: [['3, 6, 9, 12', 'add 3'], ['3, 6, 12, 24', 'multiply by 2'], ['100, 50, 25, 12.5', 'multiply by 1/2'], ['100, 90, 80, 70', 'subtract 10']],
          hint: 'Look at differences (subtract neighbours) and ratios (divide neighbours).',
          explain: 'Constant differences mean linear (add 3, subtract 10). Constant ratios mean exponential (× 2, × 1/2).',
        },
        {
          kind: 'multi',
          body: 'Compare **y = 5 · 2ˣ** with **y = 100x** for x ≥ 1. Which are true? Select all.',
          widget: () => plotEl({ x: [0, 10], y: [0, 1400], ticks: [1, 200], layers: [
            { type: 'fn', f: (x) => 100 * x, color: 'var(--c1)', label: '100x' },
            { type: 'fn', f: (x) => 5 * 2 ** x, color: 'var(--c2)', label: '5·2ˣ' }] }),
          options: [
            { text: 'At x = 1, 100x is bigger', correct: true },
            { text: 'Eventually 5 · 2ˣ pulls ahead for good', correct: true },
            { text: 'At x = 5, 5 · 2ˣ is ahead', why: '5 · 2⁵ = 160, while 100 × 5 = 500.' },
            { text: 'They never cross, since 5 · 2ˣ starts smaller', why: 'Doubling catches up: at x = 8, 5 · 2⁸ = 1,280 beats 800.' },
          ],
          explain: '10 vs 100 at x = 1; 640 vs 700 at x = 7; 1,280 vs 800 at x = 8. From there the doubling only widens the gap.',
        },
      ],
      practice: [genCompound, genDoubling, genNextTerm],
    },

    // ============================================================ 7
    {
      id: 'quadratics',
      title: 'Quadratics & parabolas',
      goal: 'Find vertices and roots, and complete the square by picture.',
      steps: [
        {
          kind: 'number',
          title: 'A thrown ball',
          body: 'A ball is thrown straight up. Its height in metres after t seconds is **h = 20t − 5t²**. When does it land (h = 0 again)?',
          widget: () => dataTable(['t (s)', '0', '1', '2', '3', '?'], [['height (m)', '0', '15', '20', '15', '0']]),
          answer: 4, tol: 1e-9, unit: 's',
          hint: 'The heights rise and fall symmetrically around t = 2.',
          explain: '15 at t = 1 and t = 3, peak at t = 2. By symmetry it lands at t = 4. Check: 20 × 4 − 5 × 16 = 0 ✓.',
        },
        {
          kind: 'read',
          title: 'The parabola',
          body: 'Any **x²** curve is a **parabola**: symmetric about a vertical line through its **vertex** (the top or bottom point). The **roots** are where it crosses the x-axis. The vertex sits exactly halfway between them.',
          widget: () => plotEl({ x: [-0.5, 4.5], y: [-2, 24], ticks: [1, 5], xlabel: 't', ylabel: 'h', layers: [
            { type: 'fn', f: (t) => 20 * t - 5 * t * t, color: 'var(--c1)' },
            { type: 'vline', x: 2, color: 'var(--muted)' },
            { type: 'dots', pts: [[2, 20], [0, 0], [4, 0]], color: 'var(--c2)', labels: ['vertex (2, 20)', 'root', 'root'] }] }),
        },
        {
          kind: 'task',
          title: 'Steer a parabola',
          body: 'In **y = a(x − h)² + k**, (h, k) is the vertex and a sets width and direction. Make the parabola have its vertex at **(2, −3)** and pass through **(3, −1)**.',
          widget: plotExplorer({
            params: [
              { id: 'a', label: 'a', min: -3, max: 3, step: 0.5, value: 1 },
              { id: 'h', label: 'h', min: -4, max: 4, step: 1, value: 0 },
              { id: 'k', label: 'k', min: -5, max: 5, step: 1, value: 0 }],
            spec: (v) => ({ x: [-5, 6], y: [-6, 8], ticks: [1, 2], layers: [
              { type: 'fn', f: (x) => v.a * (x - v.h) ** 2 + v.k, color: 'var(--c1)' },
              { type: 'dots', pts: [[2, -3], [3, -1]], color: 'var(--c2)', labels: ['(2, −3)', '(3, −1)'] }] }),
            readout: (v) => `y = ${v.a}(x ${v.h < 0 ? '+' : '−'} ${Math.abs(v.h)})² ${v.k < 0 ? '−' : '+'} ${Math.abs(v.k)}`,
            goal: (v) => v.a === 2 && v.h === 2 && v.k === -3,
            goalText: 'Vertex (2, −3), through (3, −1).',
          }),
          hint: 'Set h and k from the vertex. One step right of the vertex, y must rise by 2: that’s a.',
          explain: 'h = 2, k = −3. At x = 3: a × 1² − 3 = −1, so a = 2.',
        },
        {
          kind: 'point',
          body: 'Place the vertex of **y = (x − 3)² − 4**.',
          plot: { x: [-6, 6], y: [-8, 8], ticks: [1, 2] },
          answer: { x: 3, y: -4 }, tol: 0.3, snap: 1,
          hint: 'The square is smallest (0) when x − 3 = 0.',
          explain: 'At x = 3 the square is 0, so y = −4. Any other x adds a positive amount. Vertex (3, −4). Note the sign: x − 3 means 3, not −3.',
        },
        {
          kind: 'multi',
          body: 'Where does **y = (x − 1)(x + 3)** cross the x-axis? Select all.',
          options: [
            { text: 'x = −3', correct: true },
            { text: 'x = −1', why: '(−1 − 1)(−1 + 3) = −4, not 0. Watch the signs: x − 1 is zero at +1.' },
            { text: 'x = 1', correct: true },
            { text: 'x = 3', why: '(3 − 1)(3 + 3) = 12. x + 3 is zero at −3, not 3.' },
          ],
          ordered: true,
          hint: 'A product is 0 exactly when one factor is 0.',
          explain: 'x − 1 = 0 at x = 1, x + 3 = 0 at x = −3. Those are the roots.',
        },
        {
          kind: 'read',
          title: 'Roots give the vertex',
          body: 'Halfway between the roots 1 and −3 is **x = −1**. Put it in: y = (−2)(2) = **−4**. So the vertex is (−1, −4).',
          widget: () => plotEl({ x: [-5, 3], y: [-5, 6], ticks: [1, 1], layers: [
            { type: 'fn', f: (x) => (x - 1) * (x + 3), color: 'var(--c1)' },
            { type: 'vline', x: -1, color: 'var(--muted)' },
            { type: 'dots', pts: [[-3, 0], [1, 0]], color: 'var(--c3)', labels: ['−3', '1'] },
            { type: 'dots', pts: [[-1, -4]], color: 'var(--c2)', labels: ['(−1, −4)'] }] }),
        },
        {
          kind: 'number',
          body: '**y = x² − 6x + 8 = (x − 2)(x − 4)**. What is its **lowest** value?',
          answer: -1, tol: 1e-9,
          hint: 'The vertex is halfway between the roots 2 and 4.',
          explain: 'Vertex at x = 3: y = 9 − 18 + 8 = −1. (Or (3 − 2)(3 − 4) = −1.)',
        },
        {
          kind: 'read',
          title: 'Completing the square, by picture',
          body: 'What if there are no neat roots? Draw **x² + 6x** as tiles and rearrange them into a square.',
          widget: completeSquare(6),
        },
        {
          kind: 'fill',
          body: 'Complete the square for **x² + 8x**.',
          widget: completeSquare(8),
          template: 'x² + 8x + [[0]] = (x + [[1]])²',
          blanks: [{ options: ['16', '64', '8'], answer: 0 }, { options: ['4', '8', '16'], answer: 0 }],
          hint: 'Half of 8, then square it.',
          explain: 'Split the 8x strip into two 4x strips; the missing corner is 4 × 4 = 16. So x² + 8x + 16 = (x + 4)².',
        },
        {
          kind: 'choice',
          body: 'So **x² + 8x + 10 = (x + 4)² − 6**. What is the **lowest value** of x² + 8x + 10?',
          options: [
            { text: '−6', correct: true },
            { text: '10', why: 'That’s the value at x = 0, which isn’t the bottom.' },
            { text: '−4', why: '−4 is the x where the minimum happens, not the minimum itself.' },
            { text: '−16', why: '(x + 4)² − 6 is at least −6, since a square is never negative.' },
          ],
          explain: '(x + 4)² is at least 0 and equals 0 at x = −4, so the lowest value is −6. Vertex (−4, −6).',
        },
        {
          kind: 'match',
          body: 'Match each equation to what it tells you at a glance.',
          heads: ['Equation', 'Feature'],
          pairs: [
            ['y = (x − 2)² + 1', 'vertex (2, 1), opens up'],
            ['y = −(x + 1)² + 4', 'vertex (−1, 4), opens down'],
            ['y = (x − 1)(x − 5)', 'crosses the x-axis at 1 and 5'],
            ['y = x² − 9', 'crosses the x-axis at −3 and 3'],
          ],
          hint: 'Vertex form shows the vertex; factored form shows the roots.',
          explain: 'a(x − h)² + k: vertex (h, k), and a minus sign in front flips it. (x − p)(x − q): roots p and q. x² − 9 = (x − 3)(x + 3).',
        },
        {
          kind: 'sort',
          body: 'Which way does each parabola open?',
          bins: ['opens up ∪', 'opens down ∩'],
          items: [
            { text: 'y = −2x² + 3', bin: 1 }, { text: 'y = 0.5x² − 4', bin: 0 }, { text: 'y = 3 − x²', bin: 1 },
            { text: 'y = (x − 4)²', bin: 0 }, { text: 'y = −(x + 1)(x − 2)', bin: 1 }, { text: 'y = 5 + 2x²', bin: 0 },
          ],
          hint: 'Only the sign of the x² term matters.',
          explain: 'Positive x² coefficient: opens up (has a lowest point). Negative: opens down, like the thrown ball.',
        },
      ],
      practice: [genVertex, genRoots, genCompleteSq],
    },

    // ============================================================ 8
    {
      id: 'logs',
      title: 'Inverses & logarithms',
      goal: 'Undo functions, and read a log as “how many times”.',
      steps: [
        {
          kind: 'number',
          body: 'I think of a number. I **double** it and **add 3**, and get **17**. What was my number?',
          widget: machine(['× 2', '+ 3'], ['', '', '17']),
          answer: 7, tol: 1e-9,
          hint: 'Run the machine backwards.',
          explain: '17 − 3 = 14, then 14 ÷ 2 = 7. Check: 2 × 7 + 3 = 17 ✓.',
        },
        {
          kind: 'read',
          title: 'Inverse functions',
          body: 'An **inverse** function f⁻¹ undoes f: put f’s output in, get the original input back. Build it by reversing the steps and swapping each for its opposite.\n\nf(x) = 2x + 3 → f⁻¹(x) = (x − 3) ÷ 2.',
          widget: undoStepper(['× 2', '+ 3'], ['− 3', '÷ 2'], [7, 14, 17]),
        },
        {
          kind: 'fill',
          body: 'Build the inverse of **f(x) = 3x − 4**.',
          template: 'f⁻¹(x) = (x [[0]] 4) [[1]] 3',
          blanks: [{ options: ['+', '−', '×'], answer: 0 }, { options: ['÷', '×', '+'], answer: 0 }],
          hint: 'f multiplies by 3, then subtracts 4. Undo the subtraction first.',
          explain: 'Undo − 4 with + 4, then undo × 3 with ÷ 3: f⁻¹(x) = (x + 4) ÷ 3. Check: f(2) = 2, and (2 + 4) ÷ 3 = 2 ✓.',
        },
        {
          kind: 'match',
          body: 'Match each operation to the one that undoes it.',
          heads: ['Do', 'Undo'],
          pairs: [['add 5', 'subtract 5'], ['multiply by 4', 'divide by 4'], ['square (x ≥ 0)', 'square root'], ['2 to the power x', 'log base 2']],
          explain: 'Squaring needs x ≥ 0 to be undone cleanly (both 3 and −3 square to 9). And the operation that undoes “2 to the power” is the logarithm, next.',
        },
        {
          kind: 'number',
          title: 'Counting doublings',
          body: 'Start at 1 and keep doubling: 2, 4, 8, … How many doublings does it take to reach **32**?',
          widget: doublingStepper(3),
          answer: 5, tol: 1e-9,
          explain: '1 → 2 → 4 → 8 → 16 → 32: five doublings. In symbols 2⁵ = 32.',
        },
        {
          kind: 'read',
          title: 'A log counts multiplications',
          body: '**log₂ 32 = 5** says: you multiply by 2 **five times** to get from 1 to 32. It undoes 2⁵ = 32.\n\nThe small number is the **base**: log₁₀ 1,000 = 3 because 10 × 10 × 10 = 1,000. For powers of 10, the log counts the zeros.',
          widget: doublingStepper(5),
        },
        {
          kind: 'order',
          body: 'Order from smallest to largest.',
          items: ['log₂ 2', 'log₃ 9', 'log₂ 8', 'log₁₀ 10,000', 'log₂ 32'],
          hint: 'Turn each into “how many times”: 2 = 2¹, 9 = 3², …',
          explain: '1, 2, 3, 4, 5: 2 = 2¹, 9 = 3², 8 = 2³, 10,000 = 10⁴, 32 = 2⁵.',
        },
        {
          kind: 'estimate',
          title: 'Halving a million',
          body: 'Start at **1,000,000** and halve it again and again. About how many halvings until it drops **below 1**?',
          min: 0, max: 60, step: 1, answer: 20, tol: 2,
          hint: '2¹⁰ = 1,024 is about a thousand.',
          explain: '2²⁰ = 1,048,576 is just over a million, so 20 halvings (log₂ 1,000,000 ≈ 19.9). That’s why a guess-the-number game up to a million takes only 20 higher/lower questions.',
        },
        {
          kind: 'read',
          title: 'Mirror images',
          body: '**y = 2ˣ** and **y = log₂ x** undo each other, so their graphs are reflections across the line y = x: the point (3, 8) on one matches (8, 3) on the other. Exponentials shoot up; logs climb ever more slowly.',
          widget: () => plotEl({ x: [-2, 10], y: [-2, 10], equal: true, ticks: [1, 1], layers: [
            { type: 'fn', f: (x) => 2 ** x, color: 'var(--c2)', label: 'y = 2ˣ' },
            { type: 'fn', f: (x) => Math.log2(x), color: 'var(--c1)', label: 'y = log₂ x' },
            { type: 'fn', f: (x) => x, color: 'var(--muted)', dash: true, width: 1.5 },
            { type: 'dots', pts: [[3, 8], [8, 3]], color: 'var(--c4)', labels: ['(3, 8)', '(8, 3)'] }] }),
        },
        {
          kind: 'point',
          body: '**(2, 4)** is on y = 2ˣ. Place the matching point on **y = log₂ x**.',
          plot: { x: [-2, 10], y: [-2, 10], equal: true, ticks: [1, 1], layers: [
            { type: 'fn', f: (x) => 2 ** x, color: 'var(--c2)', label: 'y = 2ˣ' },
            { type: 'fn', f: (x) => Math.log2(x), color: 'var(--c1)', label: 'y = log₂ x' },
            { type: 'fn', f: (x) => x, color: 'var(--muted)', dash: true, width: 1.5 },
            { type: 'dots', pts: [[2, 4]], color: 'var(--c4)', labels: ['(2, 4)'] }] },
          answer: { x: 4, y: 2 }, tol: 0.3, snap: 1,
          hint: 'An inverse swaps input and output.',
          explain: '2² = 4, so log₂ 4 = 2: the point (4, 2). Swap the coordinates to reflect across y = x.',
        },
        {
          kind: 'multi',
          body: 'Which are true? Select all.',
          options: [
            { text: 'log₁₀ 1,000 = 3', correct: true },
            { text: 'log₂ 1 = 0', correct: true },
            { text: 'log₂(2 × 64) = 1 + 6', correct: true },
            { text: 'log₂ 16 = 8', why: 'That halves 16. Count doublings instead: 1 → 2 → 4 → 8 → 16 is 4.' },
            { text: 'log₁₀ 0 = 0', why: 'No power of 10 equals 0; log₁₀ 0 is undefined. (10⁰ = 1, so log₁₀ 1 = 0.)' },
          ],
          explain: '10³ = 1,000; 2⁰ = 1 (zero doublings). And multiplying adds the counts: 2 × 64 = 2¹ × 2⁶ = 2⁷ = 128, so log₂ 128 = 1 + 6 = 7.',
        },
        {
          kind: 'choice',
          title: 'Logs answer “how long?”',
          body: 'Money grows by **× 1.1** each year. Doubling needs 1.1ᵗ = 2. Which expression gives t?',
          widget: () => plotEl({ x: [0, 12], y: [0, 3.2], ticks: [1, 0.5], xlabel: 'years t', layers: [
            { type: 'fn', f: (t) => 1.1 ** t, color: 'var(--c2)', label: '1.1ᵗ' },
            { type: 'hline', y: 2, color: 'var(--c1)', label: 'doubled' }] }),
          options: [
            { text: 'log 2 ÷ log 1.1', correct: true },
            { text: '2 ÷ 1.1', why: 'That treats the growth as one multiplication. It’s repeated: we need how many times.' },
            { text: '2 × log 1.1', why: 'The log of 2 must be divided by the log of the growth factor, not multiplied.' },
            { text: 'log(2 − 1.1)', why: 'Logs undo powers, not subtraction.' },
          ],
          explain: 'Taking logs turns 1.1ᵗ = 2 into t × log 1.1 = log 2, so t = log 2 ÷ log 1.1 ≈ 7.27 years (any base, as long as both logs use the same one). The rule of 72 guessed 7.2.',
        },
      ],
      practice: [genThink, genLog, genInvFn],
    },
  ],
};

