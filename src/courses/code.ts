// Thinking in Code: sequencing, state, conditionals, loops, lists, functions, debugging, patterns.
// Every printed output and every trace frame is computed by a small TypeScript mirror of the
// Python program next to it, never written by hand.
import type { Choice, Course, Generator, PlotSpec, Step } from '../types';
import { h, pick, randInt, shuffle } from '../ui';
import { cells, codeBlock, codeTrace, type TraceFrame } from '../viz/cs';
import { stepper } from '../viz/explore';
import { type Bot, type Cmd, type World, CMD_TEXT, DIRS, botGrid, botSteps, botTask, errorBox, expand, fnMachine, lineHunt, runBot } from '../widgets/code';

// ---------------------------------------------------------------- Python mirrors

type Val = number | string | boolean | null | Val[];
/** What Python's print shows for a value. */
const py = (v: Val): string => v === null ? 'None' : typeof v === 'boolean' ? (v ? 'True' : 'False') : Array.isArray(v) ? '[' + v.map(repr).join(', ') + ']' : String(v);
const repr = (v: Val): string => (typeof v === 'string' ? `'${v}'` : py(v));
/** Python's range(stop) / range(start, stop). */
const range = (a: number, b?: number): number[] => {
  const [lo, hi] = b === undefined ? [0, a] : [a, b];
  const r: number[] = [];
  for (let i = lo; i < hi; i++) r.push(i);
  return r;
};
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

type At = (line: number, vars: TraceFrame['vars'], note?: string) => void;
type Print = (...xs: Val[]) => void;
/** Run a mirror of a program, recording a frame after each line it runs. */
function trace(run: (at: At, print: Print) => void): TraceFrame[] {
  const frames: TraceFrame[] = [];
  const out: string[] = [];
  run((line, vars, note) => frames.push({ line, vars: JSON.parse(JSON.stringify(vars)), out: [...out], note }),
    (...xs) => out.push(xs.map(py).join(' ')));
  return frames;
}
/** Just the printed lines of a mirror. */
function output(run: (print: Print) => void): string[] {
  const out: string[] = [];
  run((...xs) => out.push(xs.map(py).join(' ')));
  return out;
}

/** Keep the first option with each text (the correct one is listed first by the callers). */
function uniq(opts: Choice[]): Choice[] {
  const seen = new Set<string>();
  return opts.filter((o) => (seen.has(o.text) ? false : (seen.add(o.text), true)));
}
const NB = '\u00a0\u00a0\u00a0\u00a0';
/** An order-step line of code, indented `depth` levels (non-breaking spaces survive the markdown). */
const ln = (code: string, depth = 0) => NB.repeat(depth) + '`' + code + '`';
const two = (...kids: HTMLElement[]) => h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:flex-start;' }, kids.map((k) => h('div', { style: 'min-width:150px;flex:1 1 150px;max-width:320px;' }, k)));
const label = (t: string) => h('div', { class: 'trace-head', style: 'text-align:center;' }, t);

// ---------------------------------------------------------------- lesson 1: robot helpers

const STEP = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const progSrc = (p: Cmd[]) => p.map((c) => CMD_TEXT[c]).join('\n');
const endOf = (w: World, s: Bot, p: Cmd[]) => runBot(w, s, p).states.at(-1)!;
/** A plot of the grid for "where does the robot stop?" questions. */
const botPlot = (w: number, hh: number, s: Bot): PlotSpec => ({
  x: [0, w - 1], y: [0, hh - 1], grid: true, ticks: [1, 1], equal: true, size: [400, 360],
  layers: [
    { type: 'dots', pts: [[s.x, s.y]], color: 'var(--c1)', r: 6 },
    { type: 'arrow', from: [s.x, s.y], to: [s.x + STEP[s.d][0] * 0.75, s.y + STEP[s.d][1] * 0.75], color: 'var(--c1)', label: 'start' },
  ],
});
const at = (b: { x: number; y: number }) => `(${b.x}, ${b.y})`;
/** Short program text for options: F, L, R. */
const short = (p: Cmd[]) => p.join(' ');

// lesson 1 worlds and programs
const W1: World & { goal: [number, number] } = { w: 5, h: 4, goal: [3, 2] };
const S0: Bot = { x: 0, y: 0, d: 1 };
const progA: Cmd[] = ['F', 'F', 'L', 'F'], progB: Cmd[] = ['F', 'L', 'F', 'F'];
const endA = endOf({ w: 5, h: 4 }, S0, progA), endB = endOf({ w: 5, h: 4 }, S0, progB);
const sameEnd = endA.x === endB.x && endA.y === endB.y;
const PT_W: World = { w: 7, h: 6 }, PT_S: Bot = { x: 1, y: 1, d: 0 };
const PT_P = expand([['F', 2], 'R', ['F', 3], 'R', 'F']);
const PT_E = endOf(PT_W, PT_S, PT_P);
const TURN_S: Bot = { x: 1, y: 1, d: 0 };
const TURN_P: Cmd[] = ['L', 'F', 'R', 'F', 'R', 'F'];
const SOUTH_LEFT = DIRS[endOf({ w: 3, h: 3 }, { x: 1, y: 1, d: 2 }, ['L']).d];
const PATH_W: World = { w: 6, h: 4 };
const PATH_P = expand([['F', 3], 'L', ['F', 2], 'R', ['F', 1]]);
const PATH_RUN = runBot(PATH_W, S0, PATH_P);
const PATH_END = PATH_RUN.states.at(-1)!;
const CRASH_W: World = { w: 5, h: 3, walls: [[3, 0]], goal: [4, 0] };
const CRASH_P = expand([['F', 4]]);
const CRASH_RUN = runBot(CRASH_W, S0, CRASH_P);
const MZ_W: World & { goal: [number, number] } = { w: 4, h: 4, walls: [[1, 1], [2, 1], [1, 2]], goal: [2, 2] };
const MZ_OPTS: Cmd[][] = [
  ['F', 'F', 'F', 'L', 'F', 'F', 'L', 'F'],
  ['L', 'F', 'F', 'R', 'F', 'F'],
  ['L', 'F', 'F', 'F', 'R', 'F', 'F', 'R', 'F'],
  ['F', 'F', 'L', 'F', 'F'],
  ['F', 'F', 'F', 'L', 'F', 'F', 'F', 'L', 'F'],
];
function botOption(w: World & { goal: [number, number] }, s: Bot, p: Cmd[]): Choice {
  const { states, crash } = runBot(w, s, p);
  const e = states.at(-1)!;
  const ok = crash < 0 && e.x === w.goal[0] && e.y === w.goal[1];
  return { text: short(p), correct: ok || undefined, why: ok ? undefined : crash >= 0 ? `Command ${crash + 1} walks into a wall (or off the grid) at ${at(e)}.` : `It stops at ${at(e)}, not on the star at ${at({ x: w.goal[0], y: w.goal[1] })}.` };
}
const faceAfter = (d: number, p: Cmd[]) => DIRS[endOf({ w: 3, h: 3 }, { x: 1, y: 1, d }, p).d];
const MAZE: World & { goal: [number, number] } = { w: 5, h: 5, walls: [[1, 0], [1, 1], [1, 2], [3, 4], [3, 3], [3, 2]], goal: [4, 0] };

const genBotPoint: Generator = (rng) => {
  const w: World = { w: 7, h: 6 };
  const s: Bot = { x: randInt(rng, 0, 6), y: randInt(rng, 0, 5), d: randInt(rng, 0, 3) };
  const p: Cmd[] = [];
  let b = s;
  const n = randInt(rng, 5, 8);
  while (p.length < n) {
    const r = rng();
    let c: Cmd = r < 0.6 ? 'F' : r < 0.8 ? 'L' : 'R';
    if (c === 'F' && runBot(w, b, ['F']).crash >= 0) c = rng() < 0.5 ? 'L' : 'R';
    if (c !== 'F' && p.at(-1) && p.at(-1) !== 'F') c = runBot(w, b, ['F']).crash >= 0 ? c : 'F';
    p.push(c);
    b = endOf(w, b, [c]);
  }
  const e = endOf(w, s, p);
  return {
    kind: 'point',
    body: `The robot starts at ${at(s)} facing **${DIRS[s.d]}** (north is up). Where does it stop after running this program? Tap the grid.`,
    widget: () => codeBlock(progSrc(p)),
    plot: botPlot(7, 6, s), answer: { x: e.x, y: e.y }, tol: 0.4, snap: 1,
    hint: 'Run it yourself one line at a time, keeping track of the heading as well as the square.',
    explain: `Line by line: ${runBot(w, s, p).states.slice(1).map((q) => at(q)).join(' → ')}. It stops at ${at(e)}, facing ${DIRS[e.d]}.`,
  };
};

const genTurns: Generator = (rng) => {
  const d0 = randInt(rng, 0, 3);
  const p: Cmd[] = Array.from({ length: randInt(rng, 2, 5) }, () => (rng() < 0.5 ? 'L' : 'R'));
  const nl = p.filter((c) => c === 'L').length, nr = p.length - nl;
  const fin = endOf({ w: 3, h: 3 }, { x: 1, y: 1, d: d0 }, p).d;
  const mirror = endOf({ w: 3, h: 3 }, { x: 1, y: 1, d: d0 }, p.map((c) => (c === 'L' ? 'R' : 'L'))).d;
  const opts: Choice[] = [0, 1, 2, 3].map((d) => d === fin ? { text: `Facing ${DIRS[d]}`, correct: true } : {
    text: `Facing ${DIRS[d]}`,
    why: d === mirror ? 'That’s where it would face with every left and right swapped. A left turn is anticlockwise seen from above: north → west → south → east.'
      : d === d0 ? `That’s where it started. ${nl} left${nl === 1 ? '' : 's'} and ${nr} right${nr === 1 ? '' : 's'} don’t cancel out here.`
        : `Count the net turn: ${nl} left and ${nr} right is ${Math.abs(nr - nl)} quarter turn${Math.abs(nr - nl) === 1 ? '' : 's'} ${nr >= nl ? 'right' : 'left'}.`,
  });
  return {
    kind: 'choice', ordered: true,
    body: `The robot faces **${DIRS[d0]}**. It runs ${p.map((c) => '`' + CMD_TEXT[c] + '`').join(', ')}. Which way does it face now?`,
    options: opts,
    hint: 'Lefts and rights cancel in pairs. What’s left over?',
    explain: `${nl} left and ${nr} right turns: the pairs cancel, leaving ${Math.abs(nr - nl)} quarter turn${Math.abs(nr - nl) === 1 ? '' : 's'} ${nr >= nl ? 'right' : 'left'} from ${DIRS[d0]}, which is ${DIRS[fin]}.`,
  };
};

const genOrderPath: Generator = (rng) => {
  const w: World = { w: 7, h: 6 };
  const up = rng() < 0.5;
  const s: Bot = { x: 0, y: up ? 0 : 5, d: 1 };
  const [a, c] = shuffle(rng, [1, 2, 3]).slice(0, 2);
  const b = pick(rng, [1, 2, 3, 4].filter((v) => v !== a && v !== c));
  const t1: Cmd = up ? 'L' : 'R', t2: Cmd = up ? 'R' : 'L';
  const p = expand([['F', a], t1, ['F', b], t2, ['F', c]]);
  const run = runBot(w, s, p);
  const e = run.states.at(-1)!;
  return {
    kind: 'order',
    body: `The robot starts at ${at(s)} facing east and must walk the shaded path to the star at ${at(e)}. Put the commands in order. (\`forward(n)\` moves n squares.)`,
    widget: () => botGrid({ ...w, goal: [e.x, e.y] }, s, run.states),
    items: [`\`forward(${a})\``, `\`${CMD_TEXT[t1]}\``, `\`forward(${b})\``, `\`${CMD_TEXT[t2]}\``, `\`forward(${c})\``],
    hint: 'Read the path from the start: how far east first, then which way does it turn?',
    explain: `East ${a}, ${t1 === 'L' ? 'left (to north)' : 'right (to south)'}, ${b} squares, ${t2 === 'L' ? 'left' : 'right'} back to east, then ${c}. Same commands in another order would trace a different path.`,
  };
};

// ---------------------------------------------------------------- lesson 2: variables

const aliasFrames = trace((at, pr) => {
  let a = 3; at(1, { a }, 'Box a gets 3.');
  const b = a; at(2, { a, b }, 'b gets a copy of the value in a: 3.');
  a = 10; at(3, { a, b }, 'a now holds 10. b still holds its own 3.');
  pr(b); at(4, { a, b }, 'print shows what b holds.');
});
const aliasOut = output((pr) => { let a = 3; const b = a; a = 10; pr(b); void a; })[0];

const scoreOut = output((pr) => { let s = 10; s = s * 2; s = s - 5; pr(s); })[0];
const ABSRC = 'a = 2\nb = a + 3\na = b * 2\nb = a - b\nprint(a, b)';
const abFrames = trace((at, pr) => {
  let a = 2; at(1, { a });
  let b = a + 3; at(2, { a, b }, 'Uses the current a (2).');
  a = b * 2; at(3, { a, b }, 'Uses the current b (5). Old a is gone.');
  b = a - b; at(4, { a, b }, 'Right side first: 10 − 5, then store in b.');
  pr(a, b); at(5, { a, b });
});
const abEnd = abFrames.at(-1)!.vars as { a: number; b: number };
const swapBug = output((pr) => { let a = 4; let b = 9; a = b; b = a; pr(a, b); })[0];
const ME = { a: 6, b: 2 };

const genChain: Generator = (rng) => {
  const name = pick(rng, ['x', 'score', 'n', 'total', 'coins']);
  let v = randInt(rng, 2, 9);
  const lines = [`${name} = ${v}`];
  const parts: string[] = [];
  for (let k = 0; k < 3; k++) {
    const op = pick(rng, ['+', '-', '*'] as const);
    const c = op === '*' ? randInt(rng, 2, 3) : randInt(rng, 1, 9);
    lines.push(`${name} = ${name} ${op} ${c}`);
    v = op === '+' ? v + c : op === '-' ? v - c : v * c;
    parts.push(String(v));
  }
  lines.push(`print(${name})`);
  return {
    kind: 'number',
    body: `\`${lines[0]}\` starts it off. What does this program print?`,
    widget: () => codeBlock(lines.join('\n')),
    answer: v, tol: 0,
    hint: 'Each line uses the value from the line before, then replaces it.',
    explain: `Line by line, ${name} holds ${lines[0].split(' = ')[1]} → ${parts.join(' → ')}. It prints ${v}.`,
  };
};

const genAlias: Generator = (rng) => {
  const [p, q] = shuffle(rng, ['a', 'b', 'x', 'y', 'm', 'n']).slice(0, 2);
  const v = randInt(rng, 1, 9), w = randInt(rng, 10, 30), add = randInt(rng, 1, 5);
  const bump = rng() < 0.5;
  const src = [`${p} = ${v}`, `${q} = ${p}`, `${p} = ${w}`, ...(bump ? [`${q} = ${q} + ${add}`] : []), `print(${q})`].join('\n');
  const ans = output((pr) => { let P = v; let Q = P; P = w; if (bump) Q = Q + add; pr(Q); void P; })[0];
  const opts = uniq([
    { text: ans, correct: true },
    { text: String(bump ? w + add : w), why: `${q} got a copy of ${p}’s value (${v}) on line 2. Changing ${p} afterwards doesn’t reach back into ${q}.` },
    { text: String(v + w), why: 'Nothing adds the two values; each assignment replaces what was in the box.' },
    { text: 'An error', why: `Every name is assigned before it’s used, so this runs fine.` },
  ]);
  return {
    kind: 'choice',
    body: `${p} starts at ${v} and is later set to ${w}. What does this print?`,
    widget: () => codeBlock(src),
    options: opts,
    hint: `What value did ${q} receive on line 2?`,
    explain: `Line 2 copies the value ${v} into ${q}. Line 3 puts ${w} in ${p} only.${bump ? ` Then ${q} becomes ${v} + ${add}.` : ''} So it prints ${ans}.`,
  };
};

const genTrace3: Generator = (rng) => {
  const a0 = randInt(rng, 1, 6), k = randInt(rng, 2, 5), m = randInt(rng, 2, 3);
  const src = `a = ${a0}\nb = a + ${k}\na = b * ${m}\nb = a - b\nprint(a, b)`;
  let a = a0; let b = a + k; a = b * m; b = a - b;
  const which = rng() < 0.5 ? 'a' : 'b';
  return {
    kind: 'number',
    body: `This time \`a\` starts at ${a0}. What value does **${which}** hold at the end?`,
    widget: () => codeBlock(src),
    answer: which === 'a' ? a : b, tol: 0,
    hint: 'Keep a little table: a and b, updated after every line.',
    explain: `a = ${a0}; b = ${a0} + ${k} = ${a0 + k}; a = ${a0 + k} × ${m} = ${a}; b = ${a} − ${a0 + k} = ${b}. It prints ${a} ${b}.`,
  };
};

// ---------------------------------------------------------------- lesson 3: conditionals

const tempProg = (t: number, hi = 30, lo = 20) => `temp = ${t}\nif temp > ${hi}:\n    print("hot")\nelif temp > ${lo}:\n    print("warm")\nelse:\n    print("cold")`;
const tempOut = (t: number, hi = 30, lo = 20) => (t > hi ? 'hot' : t > lo ? 'warm' : 'cold');
const X7 = 7;
const BOOLS: [string, (x: number) => boolean][] = [
  ['x > 5', (x) => x > 5], ['x == 7', (x) => x === 7], ['x != 7', (x) => x !== 7], ['x < 7', (x) => x < 7],
  ['x >= 7', (x) => x >= 7], ['x > 5 and x < 6', (x) => x > 5 && x < 6], ['x < 3 or x > 6', (x) => x < 3 || x > 6], ['not x > 5', (x) => !(x > 5)],
];
const GRADE = 'score = 95\nif score >= 50:\n    print("C")\nelif score >= 70:\n    print("B")\nelif score >= 90:\n    print("A")';
const gradeOut = ((s: number) => (s >= 50 ? 'C' : s >= 70 ? 'B' : s >= 90 ? 'A' : ''))(95);
const teenCode = (a: number) => a > 13 && a < 19;
const teenMeant = (a: number) => a >= 13 && a <= 19;
const AGES = range(11, 22);
const big = range(0, 13).find((x) => 3 * x > 20)!;
const TWO_IFS = 'x = 12\nif x > 10:\n    x = x - 5\nif x > 5:\n    x = x * 2\nprint(x)';
const twoIfs = output((pr) => { let x = 12; if (x > 10) x = x - 5; if (x > 5) x = x * 2; pr(x); })[0];
const ELIF = 'x = 12\nif x > 10:\n    x = x - 5\nelif x > 5:\n    x = x * 2\nprint(x)';
const elifOut = output((pr) => { let x = 12; if (x > 10) x = x - 5; else if (x > 5) x = x * 2; pr(x); })[0];

const genBranch: Generator = (rng) => {
  const hi = randInt(rng, 25, 32), lo = randInt(rng, 12, 20), t = randInt(rng, 5, 40);
  const ans = tempOut(t, hi, lo);
  const why: Record<string, string> = {
    hot: `${t} > ${hi} is False, so the "hot" branch is skipped.`,
    warm: t > hi ? 'The first test is already True, so the chain stops there: an elif is only checked when everything above it was False.' : `${t} > ${lo} is False too, so "warm" is skipped.`,
    cold: `else only runs when every test above it was False, and here ${t > hi ? `${t} > ${hi}` : `${t} > ${lo}`} is True.`,
  };
  return {
    kind: 'choice', ordered: true,
    body: `With \`temp = ${t}\`, what does this print?`,
    widget: () => codeBlock(tempProg(t, hi, lo)),
    options: [
      ...['hot', 'warm', 'cold'].map((o) => (o === ans ? { text: o, correct: true } : { text: o, why: why[o] })),
      { text: 'Nothing', why: 'The else branch catches everything the tests miss, so this chain always prints exactly one word.' },
    ],
    hint: 'Check the tests from the top; the first True one wins.',
    explain: `${t} > ${hi} is ${t > hi ? 'True' : 'False'}${t > hi ? '' : `; ${t} > ${lo} is ${t > lo ? 'True' : 'False'}`}. So it prints ${ans}.`,
  };
};

const genBool: Generator = (rng) => {
  const x = randInt(rng, 1, 20);
  const c = () => randInt(rng, Math.max(0, x - 4), x + 4);
  const lo = randInt(rng, 0, 10), hi = lo + randInt(rng, 3, 10);
  const all: [string, boolean][] = [
    [`x > ${c()}`, false], [`x <= ${c()}`, false], [`x == ${pick(rng, [x, x + 1, x - 1])}`, false], [`x != ${pick(rng, [x, x + 2])}`, false],
    [`x > ${lo} and x < ${hi}`, false], [`x < ${lo} or x > ${hi}`, false], [`not x > ${c()}`, false], [`x >= ${x}`, false],
  ].map(([t]) => [t as string, evalCond(t as string, x)]);
  const seen = new Set<string>();
  const items = shuffle(rng, all).filter(([t]) => (seen.has(t) ? false : (seen.add(t), true))).slice(0, 6);
  return {
    kind: 'sort',
    body: `Suppose \`x = ${x}\`. Sort each condition into True or False.`,
    bins: ['True', 'False'],
    items: items.map(([t, v]) => ({ text: '`' + t + '`', bin: v ? 0 : 1 })),
    hint: '`and` needs both sides True; `or` needs at least one; `not` flips.',
    explain: items.map(([t, v]) => `\`${t}\` is ${v ? 'True' : 'False'}`).join('; ') + '.',
  };
};
/** Evaluate the small conditions genBool makes (x OP n, joined by and/or, maybe with not). */
function evalCond(s: string, x: number): boolean {
  if (s.includes(' and ')) return s.split(' and ').every((p) => evalCond(p, x));
  if (s.includes(' or ')) return s.split(' or ').some((p) => evalCond(p, x));
  if (s.startsWith('not ')) return !evalCond(s.slice(4), x);
  const [, op, n] = s.match(/^x (>=|<=|==|!=|>|<) (-?\d+)$/)!;
  const v = Number(n);
  return op === '>' ? x > v : op === '<' ? x < v : op === '>=' ? x >= v : op === '<=' ? x <= v : op === '==' ? x === v : x !== v;
}

const genTwoIfs: Generator = (rng) => {
  const x0 = randInt(rng, 5, 30), a = randInt(rng, 5, 20), b = randInt(rng, 1, 9), c = randInt(rng, 3, 20), m = randInt(rng, 2, 3);
  const useElif = rng() < 0.4;
  const src = `x = ${x0}\nif x > ${a}:\n    x = x - ${b}\n${useElif ? 'elif' : 'if'} x > ${c}:\n    x = x * ${m}\nprint(x)`;
  let x = x0;
  const first = x > a;
  if (first) x = x - b;
  const second = useElif ? !first && x > c : x > c;
  if (second) x = x * m;
  return {
    kind: 'number',
    body: `\`x\` starts at ${x0}. What does this print?${useElif ? ' (Watch for the `elif`.)' : ''}`,
    widget: () => codeBlock(src),
    answer: x, tol: 0,
    hint: useElif ? 'An elif is only checked if the if above it was False.' : 'Two separate ifs are two separate questions: both can run.',
    explain: `${x0} > ${a} is ${first ? 'True' : 'False'}${first ? `, so x becomes ${x0 - b}` : ''}. ${useElif && first ? 'The elif is skipped because the if ran.' : `Then ${first ? x0 - b : x0} > ${c} is ${second ? 'True' : 'False'}${second ? `, so x becomes ${x}` : ''}.`} It prints ${x}.`,
  };
};

// ---------------------------------------------------------------- lesson 4: loops

const SUM5 = 'total = 0\nfor i in range(5):\n    total = total + i\nprint(total)';
const sum5Frames = trace((at, pr) => {
  let total = 0; at(1, { total });
  for (const i of range(5)) { at(2, { total, i }, `i takes the next value: ${i}`); total = total + i; at(3, { total, i }); }
  pr(total); at(4, { total, i: 4 }, 'range(5) stops before 5: i was 0, 1, 2, 3, 4.');
});
const sum5 = Number(sum5Frames.at(-1)!.out!.at(-1));
const DBL = 'n = 1\nwhile n < 20:\n    n = n * 2\nprint(n)';
const dblFrames = trace((at, pr) => {
  let n = 1; at(1, { n });
  while (n < 20) { at(2, { n }, `${n} < 20 is True: run the body`); n = n * 2; at(3, { n }); }
  at(2, { n }, `${n} < 20 is False: leave the loop`);
  pr(n); at(4, { n });
});
const dblOut = Number(dblFrames.at(-1)!.out!.at(-1));
const halvings = (() => { let n = 1_000_000, steps = 0; while (n > 1) { n = Math.floor(n / 2); steps++; } return steps; })();
const product = range(1, 6).reduce((p, i) => p * i, 1);
const ACC = [4, 7, 1, 8];
const LOOPS_1_10: [string, number[]][] = [
  ['for i in range(10): print(i)', range(10)],
  ['for i in range(1, 11): print(i)', range(1, 11)],
  ['for i in range(10): print(i + 1)', range(10).map((i) => i + 1)],
  ['for i in range(1, 10): print(i)', range(1, 10)],
  ['for i in range(0, 11): print(i)', range(0, 11)],
  ['for i in range(2, 12): print(i - 1)', range(2, 12).map((i) => i - 1)],
];
const is1to10 = (xs: number[]) => xs.length === 10 && xs.every((v, k) => v === k + 1);
const WHILES: { text: string; x: number; cond: (x: number) => boolean; step: (x: number) => number }[] = [
  { text: 'x = 5 · `while x > 0: x = x - 1`', x: 5, cond: (x) => x > 0, step: (x) => x - 1 },
  { text: 'x = 5 · `while x > 0: x = x + 1`', x: 5, cond: (x) => x > 0, step: (x) => x + 1 },
  { text: 'x = 5 · `while x != 0: x = x - 2`', x: 5, cond: (x) => x !== 0, step: (x) => x - 2 },
  { text: 'x = 6 · `while x != 0: x = x - 2`', x: 6, cond: (x) => x !== 0, step: (x) => x - 2 },
  { text: 'x = 1 · `while x < 100: x = x * 2`', x: 1, cond: (x) => x < 100, step: (x) => x * 2 },
  { text: 'x = 0 · `while x < 100: x = x * 2`', x: 0, cond: (x) => x < 100, step: (x) => x * 2 },
];
const ends = (w: typeof WHILES[number]) => { let x = w.x; for (let k = 0; k < 10000; k++) { if (!w.cond(x)) return true; x = w.step(x); } return false; };
const STAIRS: World & { goal: [number, number] } = { w: 6, h: 5, goal: [4, 4], walls: [[0, 2], [2, 0], [4, 1], [1, 4]] };

const genRangeSum: Generator = (rng) => {
  const one = rng() < 0.4;
  const a = one ? 0 : randInt(rng, 1, 6), b = a + randInt(rng, 3, 7);
  const call = one ? `range(${b})` : `range(${a}, ${b})`;
  const xs = range(a, b);
  return {
    kind: 'number',
    body: `The loop runs over \`${call}\`. What does it print?`,
    widget: () => codeBlock(`total = 0\nfor i in ${call}:\n    total = total + i\nprint(total)`),
    answer: sum(xs), tol: 0,
    hint: `${call} stops just before ${b}.`,
    explain: `${call} is ${xs.join(', ')} (not ${b}). Their total is ${sum(xs)}.`,
  };
};

const genWhile: Generator = (rng) => {
  const s = randInt(rng, 1, 5), k = randInt(rng, 2, 3), L = randInt(rng, 20, 150);
  const seq: number[] = [s];
  let n = s;
  while (n < L) { n = n * k; seq.push(n); }
  return {
    kind: 'number',
    body: `\`n\` starts at ${s}, and the loop runs \`while n < ${L}\`. What does it print?`,
    widget: () => codeBlock(`n = ${s}\nwhile n < ${L}:\n    n = n * ${k}\nprint(n)`),
    answer: n, tol: 0,
    hint: 'The test happens before each pass; the loop stops the first time it is False.',
    explain: `n goes ${seq.join(' → ')}. At ${n} the test ${n} < ${L} is False, so the loop stops and prints ${n}.`,
  };
};

const genRangeFill: Generator = (rng) => {
  const a = randInt(rng, 1, 9), b = a + randInt(rng, 3, 12);
  return {
    kind: 'fill', code: true,
    body: `Complete the loop so it prints every whole number from ${a} to ${b}, including both.`,
    template: 'for i in range([[0]], [[1]]):\n    print(i)',
    blanks: [{ options: [String(a - 1), String(a), String(a + 1)], answer: 1 }, { options: [String(b - 1), String(b), String(b + 1)], answer: 2 }],
    hint: 'range includes its start but stops before its end.',
    explain: `range(${a}, ${b + 1}) gives ${a}, ${a + 1}, …, ${b}: the start is included and the end is one past the last number you want.`,
  };
};

// ---------------------------------------------------------------- lesson 5: lists

const PETS = ['cat', 'dog', 'fish'];
const PN = [4, 7, 2, 9, 5, 1];
const LN = [3, 8, 1, 6];
const APP = 'nums = [3, 8, 1]\nnums.append(5)\ntotal = 0\nfor x in nums:\n    total = total + x\nprint(total)';
const appFrames = trace((at, pr) => {
  const nums = [3, 8, 1]; at(1, { nums });
  nums.push(5); at(2, { nums }, 'append adds 5 at the end.');
  let total = 0; at(3, { nums, total });
  for (const x of nums) { at(4, { nums, total, x }, `x is the next item: ${x}`); total = total + x; at(5, { nums, total, x }); }
  pr(total); at(6, { nums, total });
});
const appOut = Number(appFrames.at(-1)!.out!.at(-1));
const BEST = [3, 9, 4, 12, 7];
const bestFrames = (() => {
  const fr: { k: number; best: number; bi: number; cap: string }[] = [{ k: -1, best: BEST[0], bi: 0, cap: `best = nums[0] = ${BEST[0]}: the first item is the best seen so far.` }];
  let best = BEST[0], bi = 0;
  BEST.forEach((x, k) => {
    const better = x > best;
    const cap = better ? `x = ${x} is bigger than ${best}, so best = ${x}.` : `x = ${x} is not bigger than ${best}: keep best.`;
    if (better) { best = x; bi = k; }
    fr.push({ k, best, bi, cap });
  });
  fr.push({ k: -1, best, bi, cap: `End of the list: best = ${best}.` });
  return fr;
})();
const BUGMAX = 'best = 0\nfor x in nums:\n    if x > best:\n        best = x\nprint(best)';
const bugMax = (xs: number[]) => xs.reduce((b, x) => (x > b ? x : b), 0);
const MAXLISTS = [[3, 9, 4], [-5, -2, -8], [0, 0, 0], [-1, 4], [-3], [-7, 0, -2]];
const MN = [5, 2, 9, 4];

const genIndex: Generator = (rng) => {
  const n = 5;
  const xs = shuffle(rng, range(1, 30)).slice(0, n);
  const k = randInt(rng, 1, n - 1);
  const opts = uniq([
    { text: String(xs[k]), correct: true },
    { text: String(xs[k - 1]), why: `That’s item number ${k}, which sits at index ${k - 1}. Indexes start at 0, so [${k}] is item number ${k + 1}.` },
    ...(k + 1 < n ? [{ text: String(xs[k + 1]), why: `That’s index ${k + 1}, one too far.` }] : []),
    { text: 'IndexError', why: `Index ${k} exists: a list of ${n} items has indexes 0 to ${n - 1}.` },
  ]);
  return {
    kind: 'choice',
    body: `\`nums = ${py(xs)}\`. What does \`print(nums[${k}])\` show?`,
    widget: () => cells(xs, { hi: [k] }),
    options: opts,
    hint: 'Count from 0.',
    explain: `Index 0 is ${xs[0]}, so index ${k} is the ${k + 1}${k + 1 === 2 ? 'nd' : k + 1 === 3 ? 'rd' : 'th'} item: ${xs[k]}.`,
  };
};

const genListSum: Generator = (rng) => {
  const xs = Array.from({ length: randInt(rng, 2, 4) }, () => randInt(rng, 1, 12));
  const add = Array.from({ length: randInt(rng, 1, 2) }, () => randInt(rng, 1, 12));
  const askLen = rng() < 0.4;
  const all = [...xs, ...add];
  const src = [`nums = ${py(xs)}`, ...add.map((a) => `nums.append(${a})`), askLen ? 'print(len(nums))' : 'total = 0\nfor x in nums:\n    total = total + x\nprint(total)'].join('\n');
  return {
    kind: 'number',
    body: `The list starts as \`${py(xs)}\`. What does this print?`,
    widget: () => codeBlock(src),
    answer: askLen ? all.length : sum(all), tol: 0,
    hint: 'append adds one item to the end each time.',
    explain: `After the appends, nums is ${py(all)}. ${askLen ? `It has ${all.length} items.` : `Its items add up to ${sum(all)}.`}`,
  };
};

const genLast: Generator = (rng) => {
  const n = randInt(rng, 3, 7);
  const xs = shuffle(rng, range(1, 40)).slice(0, n);
  return {
    kind: 'multi',
    body: `\`nums = ${py(xs)}\` has ${n} items. Which expressions give its **last** item, ${xs[n - 1]}?`,
    widget: () => cells(xs, { hi: [n - 1] }),
    options: [
      { text: '`nums[len(nums) - 1]`', correct: true },
      { text: `\`nums[${n - 1}]\``, correct: true },
      { text: '`nums[-1]`', correct: true },
      { text: '`nums[len(nums)]`', why: `len(nums) is ${n}, and the indexes only go up to ${n - 1}: IndexError.` },
      { text: `\`nums[${n}]\``, why: `With ${n} items the last index is ${n - 1}; index ${n} is past the end.` },
      { text: '`nums[len(nums) - 2]`', why: `That’s the second-to-last item, ${xs[n - 2]}.` },
    ],
    hint: 'The last index is one less than the length. Python also counts from the end with negative indexes.',
    explain: `Indexes run 0 to ${n - 1}, so the last item is nums[${n - 1}], which is nums[len(nums) − 1]. nums[-1] is Python’s shorthand for “last”.`,
  };
};

// ---------------------------------------------------------------- lesson 6: functions

const dbl = (n: number) => n * 2;
const fsq = (x: number) => x * x - 1;
const inc = (n: number) => n + 1, sq = (n: number) => n * n;
const composeOut = sq(inc(3)) - inc(sq(3));
const triple = (x: number) => x * 3, plus = (a: number, b: number) => a + b;
const CALLS: [string, number][] = [
  ['print(plus(4, 6))', plus(4, 6)], ['print(triple(3) + 1)', triple(3) + 1], ['print(plus(triple(2), 4))', plus(triple(2), 4)],
  ['print(triple(plus(1, 2)))', triple(plus(1, 2))], ['print(plus(triple(1), triple(2)))', plus(triple(1), triple(2))], ['print(triple(4) - plus(1, 1))', triple(4) - plus(1, 1)],
];
const ADDP = 'def add(a, b):\n    print(a + b)\n\nresult = add(2, 3)\nprint(result)';
const addOut = output((pr) => { const add = (a: number, b: number) => { pr(a + b); return null; }; const r = add(2, 3); pr(r); });

const genCall: Generator = (rng) => {
  const a = randInt(rng, 2, 9), b = randInt(rng, -5, 9), k = randInt(rng, 1, 9);
  const f = (x: number) => a * x + b;
  return {
    kind: 'number',
    body: `What does \`print(f(${k}))\` show?`,
    widget: () => codeBlock(`def f(x):\n    return ${a} * x ${b < 0 ? '-' : '+'} ${Math.abs(b)}\n\nprint(f(${k}))`),
    answer: f(k), tol: 0,
    hint: `Inside f, x is ${k}.`,
    explain: `The call puts ${k} into x: ${a} × ${k} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${f(k)}, which is returned and printed.`,
  };
};

const genCompose: Generator = (rng) => {
  const a = randInt(rng, 1, 9), b = randInt(rng, 2, 5), k = randInt(rng, 1, 6);
  const g = (x: number) => x + a, m = (x: number) => x * b;
  const inner = rng() < 0.5;
  const call = inner ? `g(m(${k}))` : `m(g(${k}))`;
  const ans = inner ? g(m(k)) : m(g(k));
  return {
    kind: 'number',
    body: `What does \`print(${call})\` show?`,
    widget: () => codeBlock(`def g(x):\n    return x + ${a}\n\ndef m(x):\n    return x * ${b}\n\nprint(${call})`),
    answer: ans, tol: 0,
    hint: 'Work from the inside out: the inner call runs first and its result goes into the outer one.',
    explain: inner ? `m(${k}) = ${m(k)}, then g(${m(k)}) = ${ans}.` : `g(${k}) = ${g(k)}, then m(${g(k)}) = ${ans}.`,
  };
};

const genReturnPrint: Generator = (rng) => {
  const a = randInt(rng, 1, 9), k = randInt(rng, 1, 20);
  const prints = rng() < 0.5;
  const v = k + a;
  const out = output((pr) => { const f = (x: number): number | null => { if (prints) { pr(x + a); return null; } return x + a; }; const r = f(k); pr(r); });
  const say = out.join(', then ');
  const opts = uniq([
    { text: say, correct: true },
    { text: `${v}, then None`, why: 'That would need f to print the value itself and return nothing. This f returns it, so calling it prints nothing.' },
    { text: `${v}, then ${v}`, why: prints ? 'f prints the value but returns nothing, so result is None.' : 'Calling f returns a value without showing it; only the last line prints.' },
    { text: String(v), why: 'f prints, and then print(result) prints too: two lines. And since f has no return, result is None.' },
    { text: 'None', why: prints ? 'f does print first, before returning None.' : 'f returns the sum, so result holds it.' },
  ]);
  return {
    kind: 'choice',
    body: `\`f(${k})\` is called once and its result printed. What appears on screen?`,
    widget: () => codeBlock(`def f(x):\n    ${prints ? 'print' : 'return'}${prints ? `(x + ${a})` : ` x + ${a}`}\n\nresult = f(${k})\nprint(result)`),
    options: opts,
    hint: 'print shows a value; return hands it back to the caller. A function without return gives back None.',
    explain: prints ? `f prints ${v} itself, then returns None (no return line), so print(result) shows None.` : `f hands back ${v} silently; print(result) shows it once.`,
  };
};

// ---------------------------------------------------------------- lesson 7: debugging

const SCORES = 'scores = [70, 85, 90]\ntotal = 0\nfor i in range(4):\n    total = total + scores[i]\nprint(total)';
const COUNT = 'nums = [7, 2, 9, 5]\ncount = 0\nfor x in nums:\n    if x > 5:\n        count = 1\nprint(count)';
const countFrames = trace((at, pr) => {
  const nums = [7, 2, 9, 5]; at(1, { nums });
  let count = 0; at(2, { nums, count }, 'I expect count to go up once per big number.');
  for (const x of nums) {
    at(3, { nums, count, x });
    at(4, { nums, count, x }, `Is ${x} > 5? ${x > 5 ? 'Yes.' : 'No, skip.'}`);
    if (x > 5) { const was = count; count = 1; at(5, { nums, count, x }, was === 1 ? 'count was already 1 and is set to 1 again. It should be 2 now!' : 'count becomes 1. Fine so far.'); }
  }
  pr(count); at(6, { nums, count }, 'Prints 1, but two numbers (7 and 9) are bigger than 5.');
});
const countRight = [7, 2, 9, 5].filter((x) => x > 5).length;
const BIG = 'def biggest(a, b, c):\n    if a > b and a > c:\n        return a\n    elif b > a:\n        return b\n    else:\n        return c';
const biggest = (a: number, b: number, c: number) => (a > b && a > c ? a : b > a ? b : c);
const TESTS: [number, number, number][] = [[9, 3, 1], [1, 3, 9], [1, 9, 3], [3, 1, 9], [4, 5, 7]];
const OFF = 'total = 0\nfor i in range(1, 5):\n    total = total + i\nprint(total)';
const offOut = sum(range(1, 5));

const genErrorType: Generator = (rng) => {
  const n = randInt(rng, 2, 9), m = randInt(rng, 2, 9);
  const kinds = ['NameError', 'TypeError', 'IndexError', 'ZeroDivisionError', 'SyntaxError'] as const;
  const which = pick(rng, kinds);
  const nm = pick(rng, [['score', 'scroe'], ['total', 'totl'], ['count', 'cuont'], ['name', 'nmae']]);
  const body = {
    NameError: `After \`${nm[0]} = ${n}\`, the program runs \`print(${nm[1]})\`. Which error stops it?`,
    TypeError: `The program runs \`print("level " + ${n})\`. Which error stops it?`,
    IndexError: `\`nums\` holds ${m % 3 + 2} items and the program runs \`print(nums[${m % 3 + 2 + n % 3}])\`. Which error stops it?`,
    ZeroDivisionError: `After \`x = ${m}\`, the program runs \`print(${n} / (x - ${m}))\`. Which error stops it?`,
    SyntaxError: `A line reads \`if ${nm[0]} > ${n}\` with nothing after the ${n}, and the next line is indented. Which error stops it?`,
  }[which];
  const whys: Record<string, string> = {
    NameError: 'NameError means a name Python has never seen, like a misspelt variable.',
    TypeError: 'TypeError means an operation on the wrong kind of value, like adding text to a number.',
    IndexError: 'IndexError means asking a list for a position it doesn’t have.',
    ZeroDivisionError: 'ZeroDivisionError means dividing by zero.',
    SyntaxError: 'SyntaxError means the code isn’t valid Python at all, so nothing runs. Here every line is valid; it fails while running.',
  };
  return {
    kind: 'choice',
    body,
    options: kinds.map((k) => (k === which ? { text: k, correct: true } : { text: k, why: whys[k] })),
    hint: 'What exactly would Python be unable to do on that line?',
    explain: {
      NameError: `${nm[1]} was never assigned (the variable is ${nm[0]}), so Python raises NameError.`,
      TypeError: 'Text + a number is not defined in Python: TypeError. Use str() to turn the number into text first.',
      IndexError: `A list of ${m % 3 + 2} items has indexes 0 to ${m % 3 + 1}. Index ${m % 3 + 2 + n % 3} is out of range: IndexError.`,
      ZeroDivisionError: `x − ${m} is 0, and dividing by 0 raises ZeroDivisionError.`,
      SyntaxError: 'An if line must end with a colon. Without it the program isn’t valid Python: SyntaxError, before anything runs.',
    }[which],
  };
};

const genTestBug: Generator = (rng) => {
  const lo = randInt(rng, 1, 20), hi = lo + randInt(rng, 3, 15);
  const mid = randInt(rng, lo + 1, hi - 1);
  const xs = [lo - 1, lo, mid, hi, hi + 1];
  const got = (x: number) => x > lo && x < hi, want = (x: number) => x >= lo && x <= hi;
  return {
    kind: 'multi', ordered: true,
    body: `\`in_range(x)\` should return True for every x from ${lo} to ${hi}, including both ends. Which tests would **catch** the bug?`,
    widget: () => codeBlock(`def in_range(x):\n    return x > ${lo} and x < ${hi}`),
    options: xs.map((x) => (got(x) !== want(x) ? { text: `in_range(${x})`, correct: true } : { text: `in_range(${x})`, why: `It returns ${got(x) ? 'True' : 'False'}, which is right, so this test passes and hides the bug.` })),
    hint: 'Bugs with < and <= live at the boundaries.',
    explain: `\`>\` and \`<\` leave out the ends: in_range(${lo}) and in_range(${hi}) return False but should be True. Every other test passes. Always test the edges.`,
  };
};

const genOffByOne: Generator = (rng) => {
  const a = randInt(rng, 0, 5), b = a + randInt(rng, 3, 8);
  return {
    kind: 'number',
    body: `This was meant to add up the numbers from ${a} to ${b}. What does it actually print?`,
    widget: () => codeBlock(`total = 0\nfor i in range(${a}, ${b}):\n    total = total + i\nprint(total)`),
    answer: sum(range(a, b)), tol: 0,
    hint: `Does range(${a}, ${b}) include ${b}?`,
    explain: `range(${a}, ${b}) stops at ${b - 1}, so it prints ${sum(range(a, b))} instead of ${sum(range(a, b + 1))}. The fix is range(${a}, ${b + 1}).`,
  };
};

// ---------------------------------------------------------------- lesson 8: patterns

const fizz = (n: number) => (n % 15 === 0 ? 'FizzBuzz' : n % 3 === 0 ? 'Fizz' : n % 5 === 0 ? 'Buzz' : String(n));
const fizzBuzzCount = range(1, 101).filter((n) => fizz(n) === 'FizzBuzz').length;
const plainCount = range(1, 1001).filter((n) => fizz(n) === String(n)).length;
const BADFIZZ = 'n = 15\nif n % 3 == 0:\n    print("Fizz")\nelif n % 5 == 0:\n    print("Buzz")\nelif n % 15 == 0:\n    print("FizzBuzz")';
const badFizz = ((n: number) => (n % 3 === 0 ? 'Fizz' : n % 5 === 0 ? 'Buzz' : n % 15 === 0 ? 'FizzBuzz' : ''))(15);
const TEMPS = [3, 1, 4, 1, 5, 9, 2, 6];
const RECORDS = `temps = ${py(TEMPS)}\nbest = temps[0]\nrecords = 0\nfor t in temps:\n    if t > best:\n        best = t\n        records = records + 1\nprint(records)`;
const records = (() => { let best = TEMPS[0], r = 0; for (const t of TEMPS) if (t > best) { best = t; r++; } return r; })();
const PAT_W: World & { goal: [number, number] } = { w: 7, h: 4, walls: [[0, 2], [1, 3], [3, 3], [6, 0], [6, 1]], goal: [6, 3] };
const FLAG = 'found = False\nfor x in nums:\n    if x < 0:\n        found = True\nprint(found)';

function fizzGrid(): HTMLElement {
  const col: Record<string, string> = { Fizz: 'var(--c1)', Buzz: 'var(--c3)', FizzBuzz: 'var(--c5)' };
  return h('div', { style: 'display:grid;grid-template-columns:repeat(5,minmax(0,62px));gap:4px;justify-content:center;' },
    range(1, 16).map((n) => {
      const f = fizz(n), c = col[f];
      return h('div', { style: `border-radius:8px;padding:4px 2px;text-align:center;border:2px solid ${c ?? 'var(--line)'};background:${c ? `color-mix(in srgb, ${c} 16%, var(--panel))` : 'var(--panel2)'};` },
        h('div', { class: 'muted small' }, String(n)),
        h('div', { style: 'font-weight:700;font-size:.8rem;overflow-wrap:anywhere;' }, f));
    }));
}

const genFizz: Generator = (rng) => {
  const n = randInt(rng, 1, 100);
  const ans = fizz(n);
  const why = (o: string): string => {
    if (o === 'FizzBuzz') return `FizzBuzz needs a multiple of both 3 and 5 (so of 15). ${n} isn’t.`;
    if (o === 'Fizz') return n % 15 === 0 ? `${n} is a multiple of 3, but also of 5, and the FizzBuzz test comes first.` : `${n} isn’t a multiple of 3 (${n} % 3 is ${n % 3}).`;
    if (o === 'Buzz') return n % 15 === 0 ? `${n} is a multiple of 5, but also of 3, and the FizzBuzz test comes first.` : `${n} isn’t a multiple of 5 (${n} % 5 is ${n % 5}).`;
    return `${n} is a multiple of ${n % 3 === 0 ? 3 : 5}, so a word prints instead of the number.`;
  };
  return {
    kind: 'choice',
    body: `In the FizzBuzz program, what is printed for **${n}**?`,
    widget: () => codeBlock('if n % 15 == 0:\n    print("FizzBuzz")\nelif n % 3 == 0:\n    print("Fizz")\nelif n % 5 == 0:\n    print("Buzz")\nelse:\n    print(n)'),
    options: ['Fizz', 'Buzz', 'FizzBuzz', String(n)].map((o) => (o === ans ? { text: o, correct: true } : { text: o, why: why(o) })),
    hint: `Work out ${n} % 15, ${n} % 3 and ${n} % 5.`,
    explain: `${n} % 15 = ${n % 15}, ${n} % 3 = ${n % 3}, ${n} % 5 = ${n % 5}. The first test that gives 0 wins, so it prints ${ans}.`,
  };
};

const genCountPattern: Generator = (rng) => {
  const xs = Array.from({ length: randInt(rng, 6, 8) }, () => randInt(rng, 1, 20));
  const k = randInt(rng, 5, 15);
  const hits = xs.filter((x) => x > k);
  return {
    kind: 'number',
    body: `\`nums = ${py(xs)}\`. What does this counter print?`,
    widget: () => codeBlock(`count = 0\nfor x in nums:\n    if x > ${k}:\n        count = count + 1\nprint(count)`),
    answer: hits.length, tol: 0,
    hint: `Count the items strictly greater than ${k}.`,
    explain: hits.length ? `The items above ${k} are ${hits.join(', ')}: ${hits.length} of them.` : `No item is above ${k}, so count stays 0.`,
  };
};

const genMultiples: Generator = (rng) => {
  const [a, b] = pick(rng, [[2, 3], [2, 5], [3, 4], [3, 5], [3, 7], [4, 6], [2, 7]]);
  const N = randInt(rng, 20, 60);
  const hits = range(1, N + 1).filter((n) => n % a === 0 || n % b === 0).length;
  const both = range(1, N + 1).filter((n) => n % a === 0 && n % b === 0).length;
  return {
    kind: 'number',
    body: `Counting from 1 to ${N}: how many numbers are multiples of ${a} **or** ${b}? (That’s what this program prints.)`,
    widget: () => codeBlock(`count = 0\nfor n in range(1, ${N + 1}):\n    if n % ${a} == 0 or n % ${b} == 0:\n        count = count + 1\nprint(count)`),
    answer: hits, tol: 0,
    hint: `Multiples of ${a}, plus multiples of ${b}, minus the ones you counted twice.`,
    explain: `${Math.floor(N / a)} multiples of ${a} plus ${Math.floor(N / b)} of ${b}, minus ${both} counted twice (multiples of both) = ${hits}.`,
  };
};

// ---------------------------------------------------------------- course

const L1: Step[] = [
  {
    kind: 'task', title: 'Program a robot',
    body: 'Get the robot to the **star**. Tap commands to build a program, then press **Run**. `forward()` moves one square the way the arrow points; the turns rotate it on the spot.',
    widget: botTask({ world: W1, start: S0 }),
    hint: 'It faces east. How many squares east is the star? Then which way must it turn to go up?',
    explain: 'One solution: forward() three times, turn_left(), forward() twice. The robot did exactly what the list said, in order, nothing more.',
  },
  {
    kind: 'read', title: 'A program is a list of instructions',
    body: 'The computer runs a program **one line at a time, top to bottom**, doing exactly what each line says. It doesn’t guess what you meant. Step through this one and watch the highlighted line.',
    widget: () => botSteps({ w: 5, h: 4 }, S0, progA),
  },
  {
    kind: 'choice',
    body: 'Programs A and B use the **same four commands** in a different order. Both start in the bottom-left corner facing east. Do they stop on the same square?',
    widget: () => two(h('div', null, label('Program A'), codeBlock(progSrc(progA))), h('div', null, label('Program B'), codeBlock(progSrc(progB)))),
    options: [
      { text: sameEnd ? 'Yes' : 'No, they stop on different squares', correct: true },
      { text: sameEnd ? 'No' : 'Yes: same commands, same result', why: 'Each forward() goes whichever way the robot faces at that moment, so moving a turn earlier changes where every later step goes.' },
      { text: 'It depends on how fast it runs', why: 'Speed never changes the result; only the commands and their order do.' },
    ],
    hint: 'Trace each one: where is the robot when it turns?',
    explain: `A ends at ${at(endA)}, B at ${at(endB)}. Order is part of the program: the same instructions in a different order are a different program.`,
  },
  {
    kind: 'point',
    body: `The robot starts at ${at(PT_S)} facing **north** (up the page). Where does it stop after this program? Tap the grid.`,
    widget: () => codeBlock(progSrc(PT_P)),
    plot: botPlot(7, 6, PT_S), answer: { x: PT_E.x, y: PT_E.y }, tol: 0.4, snap: 1,
    hint: 'Up two, then turn right: which way does it face now?',
    explain: `Up two to (1, 3); turn right to face east; three squares to (4, 3); turn right to face south; one down to ${at(PT_E)}.`,
  },
  {
    kind: 'read', title: 'Turns are relative',
    body: '`turn_left()` means the **robot’s** left, not the page’s. Facing north, its left is west; facing south, its left is east. Step through and watch the arrow.',
    widget: () => botSteps({ w: 4, h: 4 }, TURN_S, TURN_P),
  },
  {
    kind: 'choice', ordered: true,
    body: 'The robot faces **south** (down the page). It runs `turn_left()`. Which way does it face now?',
    widget: () => botGrid({ w: 3, h: 3 }, { x: 1, y: 1, d: 2 }),
    options: ['north', 'east', 'south', 'west'].map((d) => d === SOUTH_LEFT ? { text: `Facing ${d}`, correct: true } : {
      text: `Facing ${d}`,
      why: d === 'west' ? 'West is the left side of the page. Walking down the page, your left hand points to the page’s right: east.'
        : d === 'north' ? 'That’s a half turn (turning around). A turn is a quarter turn.' : 'A turn always changes the heading.',
    }),
    hint: 'Imagine walking down the page yourself. Which side is your left hand on?',
    explain: 'Left turns go anticlockwise as seen from above: north → west → south → east. So from south, a left turn faces east.',
  },
  {
    kind: 'order',
    body: `Put these commands in order so the robot walks the shaded path from the bottom-left corner to the star. (\`forward(n)\` moves n squares.)`,
    widget: () => botGrid({ ...PATH_W, goal: [PATH_END.x, PATH_END.y] }, S0, PATH_RUN.states),
    items: ['`forward(3)`', '`turn_left()`', '`forward(2)`', '`turn_right()`', '`forward(1)`'],
    hint: 'How far east does the path go before it bends?',
    explain: 'Three east, left to face north, two up, right to face east again, one more. This kind of puzzle (arranging given lines) is called a Parsons problem.',
  },
  {
    kind: 'read', title: 'A bug is a mismatch',
    body: `This program was meant to reach the star, but the robot bumps into a wall on command ${CRASH_RUN.crash + 1}. The computer did exactly what it was told; the instructions were wrong. That gap between what you wrote and what you meant is a **bug**.`,
    widget: () => h('div', null, botGrid(CRASH_W, CRASH_RUN.states.at(-1)!, CRASH_RUN.states, { crash: true, start: S0 }), codeBlock(progSrc(CRASH_P), { active: CRASH_RUN.crash + 1 })),
  },
  {
    kind: 'multi',
    body: 'Which programs take the robot from the corner (facing east) to the star without hitting a wall? Shorthand: **F** = `forward()`, **L** = `turn_left()`, **R** = `turn_right()`.',
    widget: () => botGrid(MZ_W, S0),
    options: MZ_OPTS.map((p) => botOption(MZ_W, S0, p)),
    hint: 'Trace each one with your finger, square by square.',
    explain: 'Two routes work: along the bottom and up the right side, or up the left side and across the top. There’s usually more than one correct program.',
  },
  {
    kind: 'match',
    body: 'The robot faces **east**. Match each program to the way it faces afterwards.',
    heads: ['Program', 'Faces'],
    pairs: [
      ['`turn_left()`', faceAfter(1, ['L'])],
      ['`turn_left()` twice', faceAfter(1, ['L', 'L'])],
      ['`turn_right()`', faceAfter(1, ['R'])],
      ['`turn_right()` four times', faceAfter(1, ['R', 'R', 'R', 'R'])],
    ],
    hint: 'Each turn is a quarter turn. Four quarter turns is a full circle.',
    explain: 'Left from east is north; two lefts is a half turn, west; right is south; four rights bring it back to east.',
  },
  {
    kind: 'task', title: 'The maze',
    body: 'Now a maze. Get the robot to the star without hitting a wall. Plan the route first, then write the whole program before you run it.',
    widget: botTask({ world: MAZE, start: { x: 0, y: 0, d: 0 } }),
    hint: 'Go up past the end of the left wall, then right, then down the middle gap.',
    explain: 'One route: forward() ×3, turn_right(), forward() ×2, turn_right(), forward() ×3, turn_left(), forward() ×2. Planning the route before typing is half of programming.',
  },
];

const L2: Step[] = [
  {
    kind: 'choice', ordered: true,
    body: 'What does this print?',
    widget: () => codeBlock('a = 3\nb = a\na = 10\nprint(b)'),
    options: [
      { text: aliasOut, correct: true },
      { text: '10', why: 'b got a copy of the value 3 on line 2. Changing a afterwards doesn’t reach back into b.' },
      { text: '13', why: 'Nothing adds the two values. Each line replaces what a box holds.' },
      { text: 'An error', why: 'Every variable is given a value before it’s used, so this runs fine.' },
    ],
    hint: 'What value does b receive on line 2, at that moment?',
    explain: '`b = a` copies the value a holds right then (3) into b. Line 3 changes a only. So b is still 3.',
  },
  {
    kind: 'read', title: 'Variables are labelled boxes',
    body: 'A **variable** is a named box holding a value. `b = a` means “put the value of a into box b”, right now. It is not a promise that b and a stay equal. Step through and watch the table.',
    widget: () => codeTrace('a = 3\nb = a\na = 10\nprint(b)', aliasFrames),
  },
  {
    kind: 'choice',
    body: 'In maths, `x = x + 1` has no solution. What does it do in a program?',
    widget: () => codeBlock('x = 4\nx = x + 1'),
    options: [
      { text: 'Works out x + 1, then stores that in x', correct: true },
      { text: 'Checks whether x equals x + 1', why: 'That would be `x == x + 1`, which is a question (always False). A single = stores a value.' },
      { text: 'Causes an error, since it can’t be true', why: 'It’s not a claim to be true or false. It’s an instruction: compute, then store.' },
      { text: 'Makes x permanently one more than itself', why: 'It happens once, when the line runs. x is now 5 and stays 5 until another line changes it.' },
    ],
    hint: 'Python always works out the right side first.',
    explain: 'In code, = means **assignment**: evaluate the right side using the current values (4 + 1 = 5), then put the result in the box named on the left.',
  },
  {
    kind: 'number',
    body: 'What does this print?',
    widget: () => codeBlock('score = 10\nscore = score * 2\nscore = score - 5\nprint(score)'),
    answer: Number(scoreOut), tol: 0,
    hint: 'Each line uses the value left by the line before.',
    explain: 'score is 10, then 10 × 2 = 20, then 20 − 5 = 15.',
  },
  {
    kind: 'number',
    body: 'Three lines change a and b. What value does **b** hold at the end?',
    widget: () => codeBlock(ABSRC),
    answer: abEnd.b, tol: 0,
    hint: 'Keep a small table of a and b and update it after every line.',
    explain: `a = 2, b = 5, then a = 5 × 2 = 10, then b = 10 − 5 = ${abEnd.b}. It prints ${abEnd.a} ${abEnd.b}.`,
  },
  {
    kind: 'read', title: 'Tracing',
    body: 'What you just did is called **tracing**: running the program by hand, keeping track of every variable. The set of values at a moment is the program’s **state**; each line changes it a little. Check your table against this one.',
    widget: () => codeTrace(ABSRC, abFrames),
  },
  {
    kind: 'choice',
    body: 'Someone tries to swap a and b like this. What does it print?',
    widget: () => codeBlock('a = 4\nb = 9\na = b\nb = a\nprint(a, b)'),
    options: [
      { text: swapBug, correct: true },
      { text: '9 4', why: 'That’s the swap they wanted. But line 3 throws away the 4 before line 4 can copy it.' },
      { text: '4 9', why: 'Line 3 does change a: it becomes 9.' },
      { text: '4 4', why: '`a = b` copies b into a, not the other way round.' },
    ],
    hint: 'After line 3, what does a hold? Is the 4 still anywhere?',
    explain: 'Line 3 overwrites a with 9, so the 4 is gone. Line 4 copies that 9 back into b. Both end up 9.',
  },
  {
    kind: 'fill', code: true,
    body: 'Fix the swap with a third box, `temp`, that keeps a’s value safe. Fill the blanks so a and b trade values.',
    widget: () => h('div', { class: 'muted small', style: 'text-align:center;' }, 'Start: a = 4, b = 9. Goal: a = 9, b = 4.'),
    template: 'a = 4\nb = 9\ntemp = [[0]]\na = [[1]]\nb = [[2]]',
    blanks: [{ options: ['a', 'b', 'temp'], answer: 0 }, { options: ['a', 'b', 'temp'], answer: 1 }, { options: ['a', 'b', 'temp'], answer: 2 }],
    hint: 'Save the value you’re about to overwrite.',
    explain: 'temp = a saves the 4. a = b puts 9 in a. b = temp puts the saved 4 in b. (Python also has a shortcut, `a, b = b, a`, but the idea underneath is the same.)',
  },
  {
    kind: 'sort',
    body: 'One `=` stores a value; `==` asks whether two values are equal. Sort these lines.',
    bins: ['Stores a value', 'Asks a True/False question'],
    items: [
      { text: '`x = 5`', bin: 0 }, { text: '`x == 5`', bin: 1 }, { text: '`y = x`', bin: 0 },
      { text: '`x == y`', bin: 1 }, { text: '`count = count + 1`', bin: 0 }, { text: '`total == 0`', bin: 1 },
    ],
    hint: 'Count the equals signs.',
    explain: 'A single = is assignment: it changes a box. A double == compares and gives True or False, changing nothing. Mixing them up is one of the most common beginner bugs.',
  },
  {
    kind: 'match',
    body: `With \`a = ${ME.a}\` and \`b = ${ME.b}\`, match each expression to its value.`,
    widget: () => codeBlock(`a = ${ME.a}\nb = ${ME.b}`),
    heads: ['Expression', 'Value'],
    pairs: [
      ['`a + b`', String(ME.a + ME.b)], ['`a - b`', String(ME.a - ME.b)], ['`b - a`', String(ME.b - ME.a)], ['`a + a + b`', String(ME.a + ME.a + ME.b)],
    ],
    hint: 'Swap each name for the value in its box.',
    explain: `${ME.a} + ${ME.b} = ${ME.a + ME.b}; ${ME.a} − ${ME.b} = ${ME.a - ME.b}; ${ME.b} − ${ME.a} = ${ME.b - ME.a}; ${ME.a} + ${ME.a} + ${ME.b} = ${ME.a * 2 + ME.b}. An expression just reads the boxes; it doesn’t change them.`,
  },
  {
    kind: 'order',
    body: 'Arrange the lines so the program prints **50**.',
    items: ['`price = 20`', '`price = price + 5`', '`price = price + price`', '`print(price)`'],
    hint: 'Doubling 25 gives 50. Doubling 20 first gives something else.',
    explain: `20, then 25, then 25 + 25 = ${output((pr) => { let p = 20; p = p + 5; p = p + p; pr(p); })[0]}. Doubling first would give 20 + 20 + 5 = 45: same lines, different order, different state.`,
  },
];

const L3: Step[] = [
  {
    kind: 'choice', ordered: true,
    body: 'What does this print?',
    widget: () => codeBlock(tempProg(25)),
    options: [
      { text: 'hot', why: '25 > 30 is False, so that branch is skipped.' },
      { text: tempOut(25), correct: true },
      { text: 'cold', why: 'else only runs if every test above it was False, but 25 > 20 is True.' },
      { text: 'warm, then cold', why: 'In an if/elif/else chain exactly one branch runs: the first whose test is True.' },
    ],
    hint: 'Check the tests from the top. The first one that’s True wins.',
    explain: '25 > 30 is False; 25 > 20 is True, so it prints warm and skips the rest of the chain.',
  },
  {
    kind: 'read', title: 'Choosing a path',
    body: '`if` runs its indented block only when its condition is True. `elif` (“else if”) is checked only when everything above it was False. `else` catches whatever is left. The highlighted lines are the path temp = 25 takes.',
    widget: () => codeBlock(tempProg(25), { marks: [1, 2, 4, 5] }),
  },
  {
    kind: 'sort',
    body: `With \`x = ${X7}\`, sort each condition into True or False.`,
    bins: ['True', 'False'],
    items: BOOLS.map(([t, f]) => ({ text: '`' + t + '`', bin: f(X7) ? 0 : 1 })),
    hint: '`and` needs both sides True; `or` needs at least one; `not` flips True and False.',
    explain: `x > 5, x == 7, x >= 7 and x < 3 or x > 6 are True. x != 7, x < 7, x > 5 and x < 6 (no number is both) and not x > 5 are False.`,
  },
  {
    kind: 'choice', ordered: true,
    body: 'This grading program has a bug. What does it print for a score of 95?',
    widget: () => codeBlock(GRADE),
    options: [
      { text: 'A', why: 'The A test is never reached: an earlier test was already True.' },
      { text: 'B', why: 'The B test is an elif, so it is skipped once the first test is True.' },
      { text: gradeOut, correct: true },
      { text: 'C, B and A', why: 'Only one branch of an if/elif chain ever runs.' },
    ],
    hint: 'Is 95 >= 50?',
    explain: '95 >= 50 is True, so it prints C and the chain is over. Every passing score gets a C.',
  },
  {
    kind: 'read', title: 'Order the tests',
    body: 'In a chain, the first True test wins, so put the **strictest** test first. Checking 90 before 70 before 50 makes each branch mean what you intended.',
    widget: () => codeBlock('if score >= 90:\n    print("A")\nelif score >= 70:\n    print("B")\nelif score >= 50:\n    print("C")\nelse:\n    print("try again")'),
  },
  {
    kind: 'multi', ordered: true,
    body: 'This should print teen for every age from **13 to 19, including both**. For which ages does it get the answer wrong?',
    widget: () => codeBlock('if age > 13 and age < 19:\n    print("teen")'),
    options: [12, 13, 16, 19, 20].map((a) => teenCode(a) !== teenMeant(a)
      ? { text: `age = ${a}`, correct: true }
      : { text: `age = ${a}`, why: `${a}: the code ${teenCode(a) ? 'prints teen' : 'prints nothing'}, which is what we want.` }),
    hint: 'Try the ages right at the edges of the range.',
    explain: '13 > 13 and 19 < 19 are both False, so the two ends are left out. It needs `>=` and `<=`. Bugs like this hide at the boundaries.',
  },
  {
    kind: 'read', title: 'Edge cases',
    body: 'Here are ages 11 to 21. Highlighted: where the code says teen. The marks show the two teenagers it misses. Whenever a condition has `<` or `>`, test the exact boundary value, one below and one above. Those are the **edge cases**.',
    widget: () => cells(AGES, { hi: AGES.map((a, k) => (teenCode(a) ? k : -1)).filter((k) => k >= 0), index: false, pointer: { 'missed': AGES.indexOf(13), 'missed ': AGES.indexOf(19) } }),
  },
  {
    kind: 'fill', code: true,
    body: 'Tickets are free for children **under 5** and for people **65 or older**. Complete the condition.',
    template: 'if age [[0]] 5 [[1]] age [[2]] 65:\n    print("free")',
    blanks: [{ options: ['<', '<=', '>'], answer: 0 }, { options: ['or', 'and', 'not'], answer: 0 }, { options: ['>=', '>', '<='], answer: 0 }],
    hint: 'Can one person be both under 5 and over 65?',
    explain: '“Under 5” is age < 5 (5 itself pays). “65 or older” is age >= 65. Either is enough, so join them with or; with and, nobody would ever be free.',
  },
  {
    kind: 'point',
    body: 'What is the **smallest whole number** x for which this prints big? Place it on the number line.',
    widget: () => codeBlock('if 3 * x > 20:\n    print("big")'),
    plot: { x: [0, 12], ticks: [1] }, answer: { x: big }, tol: 0.4, snap: 1,
    hint: 'Try x = 6 and x = 7.',
    explain: `3 × 6 = 18, not more than 20. 3 × ${big} = ${3 * big} > 20. So ${big} is the first.`,
  },
  {
    kind: 'number',
    body: 'Two separate ifs. What does this print?',
    widget: () => codeBlock(TWO_IFS),
    answer: Number(twoIfs), tol: 0,
    hint: 'Two ifs (not if/elif) are two separate questions, asked one after the other.',
    explain: '12 > 10, so x becomes 7. Then the second if asks its own question with the new x: 7 > 5, so x becomes 14.',
  },
  {
    kind: 'choice', ordered: true,
    body: 'Same program, but the second `if` is now an `elif`. What does it print?',
    widget: () => codeBlock(ELIF, { marks: [4] }),
    options: [
      { text: elifOut, correct: true },
      { text: twoIfs, why: 'That’s the two-ifs answer. With elif, the second test is skipped because the first was True.' },
      { text: '12', why: 'The first test (12 > 10) is True, so x does change.' },
      { text: '24', why: 'The elif never runs here, and even if it did it would see 7, not 12.' },
    ],
    hint: 'When is an elif checked?',
    explain: 'The if ran (x becomes 7), so the elif is skipped entirely. It prints 7. One small word changes the program’s behaviour.',
  },
  {
    kind: 'match',
    body: 'Match each condition to its meaning in plain words.',
    heads: ['Condition', 'Means'],
    pairs: [
      ['`x > 0 and x < 10`', 'strictly between 0 and 10'],
      ['`x < 0 or x > 10`', 'outside 0 to 10'],
      ['`not x == 0`', 'anything except zero'],
      ['`x >= 0`', 'zero or more'],
    ],
    hint: 'and narrows (both must hold); or widens (either will do).',
    explain: 'and: both conditions at once, a window. or: at least one, so either side outside the window. not flips: not x == 0 is the same as x != 0.',
  },
];

const L4: Step[] = [
  {
    kind: 'number',
    body: 'What does this print?',
    widget: () => codeBlock(SUM5),
    answer: sum5, tol: 0,
    hint: 'Which values does i take? range(5) has five of them.',
    explain: 'range(5) gives 0, 1, 2, 3, 4 (five numbers, starting at 0, stopping before 5). Their total is 10, not 15.',
  },
  {
    kind: 'read', title: 'A loop repeats its body',
    body: 'A **for loop** runs its indented body once for each value: i is 0, then 1, … The last value is 4, one short of 5. Step through and watch total grow.',
    widget: () => codeTrace(SUM5, sum5Frames),
  },
  {
    kind: 'choice',
    body: 'Which numbers does `range(2, 6)` produce?',
    options: [
      { text: range(2, 6).join(', '), correct: true },
      { text: range(2, 7).join(', '), why: 'range stops *before* its end value: 6 is left out.' },
      { text: range(3, 7).join(', '), why: 'The start value is included: 2 is first.' },
      { text: range(0, 6).join(', '), why: 'With two numbers, the first is where it starts. range(6) would start at 0.' },
    ],
    hint: 'Start included, end excluded.',
    explain: 'range(a, b) starts at a and stops just before b: 2, 3, 4, 5. It has b − a = 4 values.',
  },
  {
    kind: 'task', title: 'Loop the robot',
    body: 'The robot climbs the stairs to the star, but your program can hold **at most 4 commands**. They run inside a loop, 4 times over. Find the step that repeats.',
    widget: botTask({ world: STAIRS, start: S0, repeat: 4, maxLen: 4 }),
    hint: 'One stair is: one square east, then one square north, ending up facing east again.',
    explain: 'forward(), turn_left(), forward(), turn_right() climbs one stair and faces east again, so repeating it 4 times climbs 4 stairs. Spotting the repeating chunk is how you turn a long program into a loop.',
  },
  {
    kind: 'read', title: 'The accumulator',
    body: 'Adding up with a loop is a pattern called an **accumulator**: start with a neutral value (0 for adding), then fold in one item per pass.',
    widget: () => stepper(ACC.length + 1, (i) => h('div', null,
      cells(ACC, { hi: i < ACC.length ? [i] : [], dim: range(i) }),
      h('div', { style: 'text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;' }, `total = ${sum(ACC.slice(0, i))}`)),
    { caption: (i) => (i < ACC.length ? `Next: total = ${sum(ACC.slice(0, i))} + ${ACC[i]}` : 'Every item added once.') }),
  },
  {
    kind: 'fill', code: true,
    body: `Complete the program so it multiplies 1 × 2 × 3 × 4 × 5 and prints ${product}.`,
    template: 'product = [[0]]\nfor i in range(1, [[1]]):\n    product = product [[2]] i\nprint(product)',
    blanks: [{ options: ['0', '1', '5'], answer: 1 }, { options: ['5', '6', '4'], answer: 1 }, { options: ['+', '*', '-'], answer: 1 }],
    hint: 'What starting value doesn’t change a product? And range stops before its end.',
    explain: 'Start a product at 1 (starting at 0 would make everything 0). range(1, 6) gives 1 to 5. Multiply in each one.',
  },
  {
    kind: 'number',
    body: 'A `while` loop repeats as long as its condition is True. What does this print?',
    widget: () => codeBlock(DBL),
    answer: dblOut, tol: 0,
    hint: 'The condition is checked before each pass. Keep doubling until it fails.',
    explain: '1 → 2 → 4 → 8 → 16 → 32. At 16 the test 16 < 20 is still True, so it doubles once more. At 32 it’s False and the loop ends.',
  },
  {
    kind: 'read', title: 'While loops',
    body: 'Use `while` when you don’t know in advance how many passes you need. The body must make progress toward making the condition False, or the loop never ends.',
    widget: () => codeTrace(DBL, dblFrames),
  },
  {
    kind: 'estimate',
    body: 'Start at a million and keep halving (rounding down) until you reach 1. Roughly how many times does the loop body run? (`//` divides and rounds down.)',
    widget: () => codeBlock('n = 1000000\nsteps = 0\nwhile n > 1:\n    n = n // 2\n    steps = steps + 1\nprint(steps)'),
    min: 0, max: 500, step: 1, answer: halvings, tol: 3, format: (v) => `${v} times`,
    hint: 'Ten halvings divide by 1024, about a thousand.',
    explain: `Only ${halvings}. Each halving divides by 2, and 2 to the 20th is about a million. Halving loops are astonishingly fast; it’s why binary search can scan a phone book in a few steps.`,
  },
  {
    kind: 'multi',
    body: 'Which loops print the numbers **1 to 10**, each exactly once?',
    options: LOOPS_1_10.map(([t, xs]) => is1to10(xs) ? { text: '`' + t + '`', correct: true } : {
      text: '`' + t + '`', why: `This prints ${xs[0]} to ${xs.at(-1)}.`,
    }),
    hint: 'For each: what’s the first value printed, and the last?',
    explain: 'range(1, 11) gives 1 to 10 directly. range(10) gives 0 to 9, so print i + 1. range(2, 12) gives 2 to 11, so print i − 1. Being one off at either end is the famous **off-by-one** bug.',
  },
  {
    kind: 'order',
    body: 'Arrange the lines so it prints 3, 2, 1, then liftoff.',
    items: [ln('n = 3'), ln('while n > 0:'), ln('print(n)', 1), ln('n = n - 1', 1), ln('print("liftoff")')],
    hint: 'Print before or after counting down?',
    explain: 'Print n first, then subtract 1. The other way round prints 2, 1, 0. liftoff is unindented, so it runs once, after the loop.',
  },
  {
    kind: 'sort',
    body: 'Does each loop finish, or run forever?',
    bins: ['Finishes', 'Runs forever'],
    items: WHILES.map((w) => ({ text: w.text, bin: ends(w) ? 0 : 1 })),
    hint: 'Does each pass move x toward making the condition False? Can it jump over the stopping value?',
    explain: 'Adding 1 moves away from 0. From 5, subtracting 2 gives 3, 1, −1… and skips 0 forever. From 6 it hits 0. And 0 × 2 is still 0, so doubling never reaches 100.',
  },
];

const L5: Step[] = [
  {
    kind: 'choice', ordered: true,
    body: 'What does this print?',
    widget: () => codeBlock(`pets = ${py(PETS)}\nprint(pets[1])`),
    options: [
      { text: PETS[0], why: 'cat is at index 0. Python counts positions from 0.' },
      { text: PETS[1], correct: true },
      { text: PETS[2], why: 'fish is at index 2, the third item.' },
      { text: 'An error', why: 'Index 1 exists: a list of 3 items has indexes 0, 1 and 2.' },
    ],
    hint: 'The first item is pets[0].',
    explain: 'A list numbers its items from 0: pets[0] is cat, pets[1] is dog, pets[2] is fish.',
  },
  {
    kind: 'read', title: 'Lists',
    body: 'A **list** holds many values in order. Each sits at an **index**, counting from 0, so a list of n items has indexes 0 to n − 1. `len(pets)` is how many items there are: 3.',
    widget: () => cells(PETS, { hi: [1], pointer: { 'pets[1]': 1 } }),
  },
  {
    kind: 'point',
    body: `\`nums = ${py(PN)}\`. The chart plots each item: index across, value up. One item is missing. Place the point for **nums[3]**.`,
    plot: {
      x: [0, 5], y: [0, 10], grid: true, ticks: [1, 1], xlabel: 'index', ylabel: 'value', size: [420, 300],
      layers: [{ type: 'dots', pts: PN.map((v, k) => [k, v] as [number, number]).filter(([k]) => k !== 3), color: 'var(--c1)' }],
    },
    answer: { x: 3, y: PN[3] }, tol: 0.4, snap: 1,
    hint: 'Count from 0: 4 is at index 0.',
    explain: `Index 3 is the fourth item: ${PN[3]}. So the point is (3, ${PN[3]}).`,
  },
  {
    kind: 'number',
    body: 'What does this print?',
    widget: () => codeBlock(`nums = ${py(LN)}\nprint(nums[len(nums) - 1])`),
    answer: LN[LN.length - 1], tol: 0,
    hint: `len(nums) is ${LN.length}. What is ${LN.length} − 1?`,
    explain: `len(nums) is ${LN.length}, so the index is ${LN.length - 1}: the last item, ${LN.at(-1)}. nums[len(nums) − 1] is the classic way to get the last item.`,
  },
  {
    kind: 'choice',
    body: `What happens on \`print(nums[len(nums)])\`, with the same \`nums = ${py(LN)}\`?`,
    widget: () => cells(LN, { pointer: { 'len = 4': LN.length - 1 } }),
    options: [
      { text: 'An IndexError', correct: true },
      { text: String(LN.at(-1)), why: `That’s nums[${LN.length - 1}]. Index ${LN.length} is one past the end.` },
      { text: '0', why: 'Python doesn’t fill missing positions with 0; it stops with an error.' },
      { text: 'It wraps round to the first item', why: 'Positive indexes past the end don’t wrap; they’re an error.' },
    ],
    hint: 'What is the largest index in a list of 4?',
    explain: 'The indexes are 0 to 3. Asking for index 4 raises **IndexError: list index out of range**. You’ll meet this one a lot.',
  },
  {
    kind: 'number',
    body: '`append` adds an item to the end. A `for` loop can walk straight through a list. What does this print?',
    widget: () => codeBlock(APP),
    answer: appOut, tol: 0,
    hint: 'What does the list hold after line 2?',
    explain: 'After append, nums is [3, 8, 1, 5]. The loop adds each: 3 + 8 + 1 + 5 = 17.',
  },
  {
    kind: 'read', title: 'Looping over a list',
    body: '`for x in nums:` sets x to each item in turn, so you never touch indexes at all. Step through and watch x and total.',
    widget: () => codeTrace(APP, appFrames),
  },
  {
    kind: 'read', title: 'Best so far',
    body: 'To find the biggest item, walk the list keeping the **best so far**. Start with the first item; whenever you see something bigger, it becomes the new best.',
    widget: () => stepper(bestFrames.length, (i) => {
      const f = bestFrames[i];
      return cells(BEST, { hi: f.k >= 0 ? [f.k] : [], pointer: f.k >= 0 ? { x: f.k, best: f.bi } : { best: f.bi } });
    }, { caption: (i) => bestFrames[i].cap }),
  },
  {
    kind: 'fill', code: true,
    body: 'Complete the best-so-far program so it prints the largest item of nums.',
    template: 'best = [[0]]\nfor x in nums:\n    if x [[1]] best:\n        best = [[2]]\nprint(best)',
    blanks: [{ options: ['nums[0]', 'len(nums)', 'nums'], answer: 0 }, { options: ['>', '<', '=='], answer: 0 }, { options: ['x', 'best', 'nums'], answer: 0 }],
    hint: 'Start from a real item, and replace best when x beats it.',
    explain: 'Start with the first item, then whenever x > best, store x. (len(nums) is a count, not an item, and could be bigger than everything.)',
  },
  {
    kind: 'multi',
    body: 'This version starts with `best = 0` instead of `nums[0]`. For which lists does it print the **wrong** answer?',
    widget: () => codeBlock(BUGMAX, { marks: [1] }),
    options: MAXLISTS.map((xs) => bugMax(xs) !== Math.max(...xs)
      ? { text: '`' + py(xs) + '`', correct: true }
      : { text: '`' + py(xs) + '`', why: `It prints ${bugMax(xs)}, which is the right answer here.` }),
    hint: 'What if every number is below 0?',
    explain: 'If every item is negative, nothing beats 0, so it prints 0, which isn’t even in the list. Starting from nums[0] can never invent a value.',
  },
  {
    kind: 'match',
    body: `With \`nums = ${py(MN)}\`, match each expression to its value.`,
    widget: () => cells(MN),
    heads: ['Expression', 'Value'],
    pairs: [
      ['`nums[0]`', String(MN[0])], ['`nums[2]`', String(MN[2])], ['`len(nums)`', String(MN.length)], ['`nums[1] + nums[3]`', String(MN[1] + MN[3])],
    ],
    hint: 'Indexes start at 0; len counts items.',
    explain: `nums[0] = ${MN[0]}, nums[2] = ${MN[2]}, there are ${MN.length} items, and nums[1] + nums[3] = ${MN[1]} + ${MN[3]} = ${MN[1] + MN[3]}.`,
  },
];

const L6: Step[] = [
  {
    kind: 'choice', ordered: true,
    body: 'What does this print?',
    widget: () => codeBlock('def double(n):\n    return n * 2\n\nprint(double(3) + double(4))'),
    options: [
      { text: String(dbl(3) + dbl(4)), correct: true },
      { text: `${dbl(3)} ${dbl(4)}`, why: 'The two results are added with +, giving one number.' },
      { text: '7', why: 'Each call doubles its input before the + happens: 6 + 8.' },
      { text: 'An error', why: 'double is defined before it’s used, and returns a number each time.' },
    ],
    hint: 'Work out double(3) and double(4) separately.',
    explain: 'double(3) returns 6 and double(4) returns 8, so it prints 14.',
  },
  {
    kind: 'read', title: 'Functions',
    body: 'A **function** is a named, reusable piece of code. `def double(n):` defines it; `n` is its **parameter**, the input. `return` hands a value back to whoever called it. Calling `double(3)` runs the body with n = 3 and the call becomes the returned value.',
    widget: () => fnMachine('double', ['n = 3'], '6', 'return n * 2'),
  },
  {
    kind: 'match',
    body: 'Match each call to what it returns.',
    widget: () => codeBlock('def f(x):\n    return x * x - 1'),
    heads: ['Call', 'Returns'],
    pairs: [['`f(0)`', String(fsq(0))], ['`f(1)`', String(fsq(1))], ['`f(2)`', String(fsq(2))], ['`f(3)`', String(fsq(3))]],
    hint: 'Put the number in for x: x times x, minus 1.',
    explain: `f(0) = 0 − 1 = ${fsq(0)}; f(1) = ${fsq(1)}; f(2) = 4 − 1 = ${fsq(2)}; f(3) = 9 − 1 = ${fsq(3)}. One definition, used four times.`,
  },
  {
    kind: 'read', title: 'Return is not print',
    body: '`print` shows something to a **person**. `return` gives a value back to the **code**, which can store it, add to it or pass it on. A function with no return line gives back the special value `None`.',
    widget: () => two(h('div', null, label('returns'), codeBlock('def area(w, h):\n    return w * h\n\nx = area(3, 4) + 1\n# x is 13'))),
  },
  {
    kind: 'choice',
    body: 'What appears on screen?',
    widget: () => codeBlock(ADDP),
    options: [
      { text: addOut.join(', then '), correct: true },
      { text: '5, then 5', why: 'add prints the sum but never returns it, so result is None.' },
      { text: 'Just 5', why: 'print(result) also prints something: the None that add returned.' },
      { text: 'An error', why: 'Printing None is allowed. The bug is silent, which makes it sneaky.' },
    ],
    hint: 'What does add return?',
    explain: 'Calling add prints 5. It has no return, so result is None, and print(result) shows None. If you want to use the answer, return it.',
  },
  {
    kind: 'sort',
    body: 'Does each function give back a useful value, or None?',
    bins: ['Returns a value', 'Returns None'],
    items: [
      { text: '`def f(x): return x + 1`', bin: 0 }, { text: '`def f(x): print(x + 1)`', bin: 1 },
      { text: '`def f(x): x + 1`', bin: 1 }, { text: '`def f(x): return x > 0`', bin: 0 },
      { text: '`def f(x): y = x + 2`', bin: 1 }, { text: '`def f(x): return "hi"`', bin: 0 },
    ],
    hint: 'Look for the word return.',
    explain: 'Only a return hands a value back (a number, True/False, or text). Printing, computing and throwing it away, or storing it in a local variable all leave the caller with None.',
  },
  {
    kind: 'fill', code: true,
    body: 'Complete the function so the program prints 12.',
    template: 'def area(width, height):\n    [[0]] width [[1]] height\n\nprint(area(3, 4))',
    blanks: [{ options: ['return', 'print', 'def'], answer: 0 }, { options: ['*', '+', '=='], answer: 0 }],
    hint: 'The caller prints whatever area hands back.',
    explain: 'return width * height hands 12 back, and print shows it. With print inside, you’d see 12 and then None.',
  },
  {
    kind: 'number',
    body: 'Calls can go inside calls; the inner one runs first. What does this print?',
    widget: () => codeBlock('def inc(n):\n    return n + 1\n\ndef sq(n):\n    return n * n\n\nprint(sq(inc(3)) - inc(sq(3)))'),
    answer: composeOut, tol: 0,
    hint: 'sq(inc(3)): first inc(3). inc(sq(3)): first sq(3).',
    explain: `sq(inc(3)) = sq(4) = ${sq(inc(3))}. inc(sq(3)) = inc(9) = ${inc(sq(3))}. ${sq(inc(3))} − ${inc(sq(3))} = ${composeOut}. Order matters for functions too.`,
  },
  {
    kind: 'read', title: 'Decomposition',
    body: 'Big problems get split into small functions, each doing one job with a clear name. Then the main program reads almost like English, and each piece can be tested on its own.',
    widget: () => codeBlock('def total(nums):\n    t = 0\n    for x in nums:\n        t = t + x\n    return t\n\ndef average(nums):\n    return total(nums) / len(nums)\n\nprint(average([4, 8, 6]))', { marks: [8] }),
  },
  {
    kind: 'order',
    body: 'Arrange the lines into a function that returns the average of a list.',
    items: [ln('def average(nums):'), ln('total = 0', 1), ln('for x in nums:', 1), ln('total = total + x', 2), ln('return total / len(nums)', 1)],
    hint: 'Start the total before the loop; return only after the loop has finished.',
    explain: 'The def line comes first, then the accumulator, the loop that adds each item, and finally the return, outside the loop (indented once). Returning inside the loop would stop after the first item.',
  },
  {
    kind: 'multi',
    body: 'Which lines print **10**?',
    widget: () => codeBlock('def triple(x):\n    return x * 3\n\ndef plus(a, b):\n    return a + b'),
    options: CALLS.map(([t, v]) => (v === 10 ? { text: '`' + t + '`', correct: true } : { text: '`' + t + '`', why: `This prints ${v}.` })),
    hint: 'Work each one inside out.',
    explain: `plus(4, 6) = 10; triple(3) + 1 = 10; plus(triple(2), 4) = 6 + 4 = 10; triple(4) − plus(1, 1) = 12 − 2 = 10. triple(plus(1, 2)) = 9 and plus(triple(1), triple(2)) = 3 + 6 = 9.`,
  },
];

const L7: Step[] = [
  {
    kind: 'choice',
    body: 'This should print the total of the scores, but it stops with an error. What’s the bug?',
    widget: () => errorBox(SCORES, 4, 'IndexError: list index out of range'),
    options: [
      { text: 'The loop goes to index 3, but the list only has indexes 0 to 2', correct: true },
      { text: 'total should start at 1', why: 'Starting at 0 is right for adding up, and wouldn’t cause an IndexError anyway.' },
      { text: 'The list needs a fourth score', why: 'That would hide the error, not fix the program. The loop should fit the list, not the other way round.' },
      { text: 'Line 5 should be inside the loop', why: 'The crash happens on line 4, before line 5 ever runs.' },
    ],
    hint: 'Which values does i take in range(4)? Which indexes does scores have?',
    explain: 'range(4) gives i = 0, 1, 2, 3, but scores only has 3 items. Use range(len(scores)), or simply for s in scores:.',
  },
  {
    kind: 'read', title: 'Read the error',
    body: 'An error message is a clue, not a scolding. It tells you **where** (the line number) and **what kind** of problem (the last line: its type and a description). Always read it before changing anything.',
    widget: () => errorBox(SCORES, 4, 'IndexError: list index out of range'),
  },
  {
    kind: 'match',
    body: 'Match each mistake to the error Python reports.',
    heads: ['Mistake', 'Error'],
    pairs: [
      ['`print(totl)` when the variable is total', 'NameError'],
      ['`"age: " + 5`', 'TypeError'],
      ['`nums[10]` on a 3-item list', 'IndexError'],
      ['`if x > 3` with no colon', 'SyntaxError'],
      ['`10 / 0`', 'ZeroDivisionError'],
    ],
    hint: 'Names, types, positions, grammar, arithmetic.',
    explain: 'NameError: Python doesn’t know that name. TypeError: wrong kind of value (text + number). IndexError: no such position. SyntaxError: not valid Python. ZeroDivisionError: dividing by zero.',
  },
  {
    kind: 'task', title: 'Find the bug',
    body: `This should count how many numbers are greater than 5 (that’s ${countRight}). It runs without an error but prints 1. **Tap the buggy line.**`,
    widget: lineHunt(COUNT, 5, {
      1: 'The data is fine.', 2: 'Starting a counter at 0 is right.', 3: 'This visits every number.',
      4: 'The test is right: 7 and 9 pass it.', 6: 'Printing the count is fine; the count itself is wrong.',
    }),
    hint: 'What should happen to count each time a big number is found?',
    explain: `Line 5 sets count to 1 every time instead of adding 1. It should be count = count + 1. Bugs that give a wrong answer quietly (logic bugs) are found by checking the output against an answer you know (${countRight}).`,
  },
  {
    kind: 'read', title: 'Rubber duck debugging',
    body: 'Programmers keep a rubber duck on the desk and explain their code to it, line by line, out loud. Saying what each line **should** do makes the line that doesn’t jump out. Trace it with the notes below.',
    widget: () => codeTrace(COUNT, countFrames),
  },
  {
    kind: 'fill', code: true,
    body: 'Fix line 5.',
    template: 'nums = [7, 2, 9, 5]\ncount = 0\nfor x in nums:\n    if x > 5:\n        count = [[0]]\nprint(count)',
    blanks: [{ options: ['count + 1', '1', 'x', 'count + x'], answer: 0 }],
    hint: 'A counter goes up by one.',
    explain: `count = count + 1 adds one for each match, giving ${countRight}. count + x would add up the big numbers instead of counting them.`,
  },
  {
    kind: 'read', title: 'Test cases',
    body: 'A **test case** is an input whose correct answer you already know. Good tests include easy cases, but also the edges: the smallest input, ties, negatives, the boundaries of every condition. A bug survives only where nobody looked.',
    widget: () => codeBlock(BIG),
  },
  {
    kind: 'multi', ordered: true,
    body: 'This `biggest` function has a bug. Which tests **catch** it, by returning something other than the largest number?',
    widget: () => codeBlock(BIG),
    options: TESTS.map(([a, b, c]) => {
      const got = biggest(a, b, c), want = Math.max(a, b, c);
      return got !== want ? { text: `biggest(${a}, ${b}, ${c})`, correct: true } : { text: `biggest(${a}, ${b}, ${c})`, why: `Returns ${got}, which is right, so this test passes.` };
    }),
    hint: 'The elif only compares b with a. What if c is the biggest but b > a?',
    explain: 'When b > a, it returns b without checking c. So (1, 3, 9) gives 3 and (4, 5, 7) gives 5. The fix: elif b > c. One passing test proves little; you need tests aimed at each path.',
  },
  {
    kind: 'sort',
    body: 'Each line comes with what it’s meant to do. Bug or no bug?',
    bins: ['Bug', 'No bug'],
    items: [
      { text: 'Loop 1 to 10: `for i in range(1, 10):`', bin: 0 },
      { text: 'Adults are 18 or older: `if age >= 18:`', bin: 1 },
      { text: 'Last item: `nums[len(nums)]`', bin: 0 },
      { text: 'Add x to total: `total = total + x`', bin: 1 },
      { text: 'Check if x is 5: `if x = 5:`', bin: 0 },
      { text: 'Every index of nums: `for i in range(len(nums)):`', bin: 1 },
    ],
    hint: 'Watch for range ends, the last index, and = versus ==.',
    explain: 'range(1, 10) stops at 9. nums[len(nums)] is one past the end. `if x = 5:` uses assignment where a comparison (==) is needed. The others do what they say.',
  },
  {
    kind: 'number',
    body: 'This was meant to add up 1 to 5 (which is 15). What does it actually print?',
    widget: () => codeBlock(OFF),
    answer: offOut, tol: 0,
    hint: 'Which values does range(1, 5) give?',
    explain: `range(1, 5) is 1, 2, 3, 4, so it prints ${offOut}. The off-by-one fix is range(1, 6).`,
  },
  {
    kind: 'order',
    body: 'Put a calm debugging routine in order.',
    items: [
      'Reproduce the bug with a small input',
      'Read the error message or compare with the expected output',
      'Guess the cause and trace that part by hand',
      'Change one thing',
      'Re-run all your tests',
    ],
    hint: 'You can’t fix what you can’t see happen.',
    explain: 'Make it happen reliably, read what it tells you, form a specific guess, change one thing (so you know what helped), then re-run everything in case the fix broke something else.',
  },
  {
    kind: 'choice',
    body: 'You’ve stared at a bug for 20 minutes. What’s the most useful next move?',
    options: [
      { text: 'Explain the code line by line, out loud, to someone (or a duck)', correct: true },
      { text: 'Change things at random until it works', why: 'Even if it starts working, you won’t know why, and you may have added new bugs.' },
      { text: 'Delete it all and start over', why: 'Sometimes worth it, but usually you throw away mostly-working code along with one small mistake.' },
      { text: 'Add more features first, then come back', why: 'More code on top of a bug makes it harder to find.' },
    ],
    hint: 'What makes hidden assumptions visible?',
    explain: 'Explaining forces you to state what each line does, and the mismatch with what it should do usually appears mid-sentence. It’s called rubber duck debugging because the listener doesn’t need to know anything.',
  },
];

const L8: Step[] = [
  {
    kind: 'choice',
    body: 'Read this program. What does it tell you about the list `nums`?',
    widget: () => codeBlock(FLAG),
    options: [
      { text: 'Whether any number in it is negative', correct: true },
      { text: 'How many numbers are negative', why: 'found is only ever True or False. Counting would need count = count + 1.' },
      { text: 'Whether all the numbers are negative', why: 'One negative number is enough to make found True.' },
      { text: 'The last negative number', why: 'It never stores x, only True or False.' },
    ],
    hint: 'What values can found ever hold?',
    explain: 'found starts False and flips to True the moment a negative turns up. At the end it answers: was there at least one? This is the **flag** pattern.',
  },
  {
    kind: 'read', title: 'Four patterns',
    body: 'Most loops over data are one of four shapes. Experienced programmers don’t invent these each time; they recognise which one a problem needs.',
    widget: () => h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;' },
      ([['Counter', 'count = 0\nfor x in nums:\n    if x > 5:\n        count = count + 1'],
        ['Accumulator', 'total = 0\nfor x in nums:\n    total = total + x'],
        ['Flag', 'found = False\nfor x in nums:\n    if x < 0:\n        found = True'],
        ['Best so far', 'best = nums[0]\nfor x in nums:\n    if x > best:\n        best = x']] as const)
        .map(([t, src]) => h('div', null, label(t), codeBlock(src)))),
  },
  {
    kind: 'sort',
    body: 'Which pattern does each task need?',
    bins: ['Counter', 'Accumulator', 'Flag', 'Best so far'],
    items: [
      { text: 'How many emails are unread?', bin: 0 }, { text: 'Total cost of the cart', bin: 1 },
      { text: 'Is any password shorter than 8?', bin: 2 }, { text: 'The highest score', bin: 3 },
      { text: 'Number of rainy days', bin: 0 }, { text: 'Distance run this week', bin: 1 },
      { text: 'Does the list contain a zero?', bin: 2 }, { text: 'The cheapest flight', bin: 3 },
    ],
    hint: 'How many? → counter. How much in all? → accumulator. Is there any? → flag. Which is most/least? → best so far.',
    explain: 'The question’s wording gives it away: “how many” counts, “total” accumulates, “is any / does it contain” flags, “highest / cheapest” keeps the best so far.',
  },
  {
    kind: 'match',
    body: 'Each pattern needs the right starting value. Match them.',
    heads: ['Pattern', 'Starts with'],
    pairs: [
      ['Counter', '`count = 0`'],
      ['Product accumulator', '`product = 1`'],
      ['Flag', '`found = False`'],
      ['Best so far', '`best = nums[0]`'],
    ],
    hint: 'Start with a value that doesn’t affect the answer before any item is seen.',
    explain: 'Nothing counted yet: 0. Multiplying: 1 changes nothing. Nothing found yet: False. Best so far: a real item, so it can’t invent a value.',
  },
  {
    kind: 'read', title: 'Mini project: FizzBuzz',
    body: 'A classic: for each number from 1 to 100, print **Fizz** if it’s a multiple of 3, **Buzz** if it’s a multiple of 5, **FizzBuzz** if both, otherwise the number. `n % 3` is the remainder after dividing by 3, so `n % 3 == 0` means “divides exactly by 3”. Here are the first 15.',
    widget: () => fizzGrid(),
  },
  {
    kind: 'number',
    body: 'From 1 to 100, how many times is **FizzBuzz** printed?',
    widget: () => fizzGrid(),
    answer: fizzBuzzCount, tol: 0,
    hint: 'A multiple of both 3 and 5 is a multiple of 15.',
    explain: `Multiples of 15 up to 100: 15, 30, 45, 60, 75, 90. That’s ${fizzBuzzCount}.`,
  },
  {
    kind: 'choice', ordered: true,
    body: 'Here the tests are in a different order. What does it print for n = 15?',
    widget: () => codeBlock(BADFIZZ),
    options: [
      { text: badFizz, correct: true },
      { text: 'Buzz', why: 'The Buzz test is an elif: it’s skipped because the first test was already True.' },
      { text: 'FizzBuzz', why: 'That’s what we want, but the 15 test comes last and is never reached for 15.' },
      { text: 'Fizz, Buzz and FizzBuzz', why: 'Only one branch of an if/elif chain runs.' },
    ],
    hint: 'Which test is checked first?',
    explain: '15 % 3 == 0 is True, so it prints Fizz and the chain stops. The most specific case (multiple of 15) must come first, just like the grading bug.',
  },
  {
    kind: 'fill', code: true,
    body: 'Complete a correct FizzBuzz for 1 to 100.',
    template: 'for n in range(1, [[0]]):\n    if n % [[1]] == 0:\n        print("FizzBuzz")\n    elif n % 3 == 0:\n        print("Fizz")\n    elif n % 5 == 0:\n        print("Buzz")\n    else:\n        print([[2]])',
    blanks: [{ options: ['100', '101', '99'], answer: 1 }, { options: ['15', '3', '5'], answer: 0 }, { options: ['n', '"n"', 'i'], answer: 0 }],
    hint: 'range stops before its end; the both-case test goes first; print the variable, not the letter.',
    explain: 'range(1, 101) includes 100. Test for 15 first. print(n) prints the number; print("n") would print the letter n every time, and i doesn’t exist here.',
  },
  {
    kind: 'estimate',
    body: 'Run FizzBuzz from 1 to **1000**. Roughly how many lines are plain numbers (no Fizz, no Buzz)?',
    min: 0, max: 1000, step: 1, answer: plainCount, tol: 30,
    hint: 'About a third are multiples of 3, a fifth multiples of 5, and some are both.',
    explain: `${plainCount}. 333 multiples of 3 plus 200 of 5, minus the 66 counted twice (multiples of 15), is 467 words, leaving ${plainCount} numbers. You can check it with a counter in the loop.`,
  },
  {
    kind: 'order',
    body: 'Arrange the lines into a function that counts the vowels in a word. (`for ch in word:` visits each letter; `ch in "aeiou"` asks whether ch is a vowel.)',
    items: [ln('def count_vowels(word):'), ln('count = 0', 1), ln('for ch in word:', 1), ln('if ch in "aeiou":', 2), ln('count = count + 1', 3), ln('return count', 1)],
    hint: 'It’s a counter pattern inside a function.',
    explain: 'Counter starts at 0, loop over letters, test, add one, and return after the loop. Decomposed into a function, it can be reused for any word.',
  },
  {
    kind: 'number',
    body: 'Two patterns at once: best so far plus a counter. How many times is a new record set?',
    widget: () => codeBlock(RECORDS),
    answer: records, tol: 0,
    hint: 'best starts at 3. Walk the list and count each time something beats the current best.',
    explain: `best starts at 3; 4 beats it, then 5, then 9. Nothing after 9 beats it. So ${records} new records.`,
  },
  {
    kind: 'task', title: 'Find the pattern',
    body: 'Final challenge. The loop body runs **3 times** and may hold at most **5 commands**. Find the repeating chunk that takes the robot to the star.',
    widget: botTask({ world: PAT_W, start: S0, repeat: 3, maxLen: 5 }),
    hint: 'The star is 6 squares east and 3 north. Split that into 3 equal chunks.',
    explain: 'Each pass must move 2 east and 1 north and end up facing east: forward(), turn_left(), forward(), turn_right(), forward() works. Break the problem down, spot the repetition, then let the loop do the work.',
  },
];

export const code: Course = {
  id: 'code',
  title: 'Thinking in Code',
  blurb: 'Programs as precise instructions: state, choices, loops, lists, functions, and finding bugs.',
  color: '#6b5bd6',
  icon: '💻',
  lessons: [
    { id: 'sequence', title: 'Instructions in order', goal: 'Turn a goal into exact steps, in the right order.', steps: L1, practice: [genBotPoint, genTurns, genOrderPath] },
    { id: 'variables', title: 'Variables and state', goal: 'Trace how assignments change a program’s state.', steps: L2, practice: [genChain, genAlias, genTrace3] },
    { id: 'conditionals', title: 'Making choices', goal: 'Predict which branch runs, and test the edges.', steps: L3, practice: [genBranch, genBool, genTwoIfs] },
    { id: 'loops', title: 'Loops', goal: 'Repeat work with for and while, without being off by one.', steps: L4, practice: [genRangeSum, genWhile, genRangeFill] },
    { id: 'lists', title: 'Lists', goal: 'Index from 0, loop over items, find the biggest.', steps: L5, practice: [genIndex, genListSum, genLast] },
    { id: 'functions', title: 'Functions', goal: 'Package code with inputs and a return value, and reuse it.', steps: L6, practice: [genCall, genCompose, genReturnPrint] },
    { id: 'debugging', title: 'Debugging', goal: 'Read errors, test the edges and track down bugs calmly.', steps: L7, practice: [genErrorType, genTestBug, genOffByOne] },
    { id: 'patterns', title: 'Thinking like a programmer', goal: 'Recognise counters, accumulators, flags and best-so-far, and build FizzBuzz.', steps: L8, practice: [genFizz, genCountPattern, genMultiples] },
  ],
};

