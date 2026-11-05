// Make the Number: six numbers, one target. Combine pairs with + − × ÷ (whole, positive results
// only), each number at most once. The round is built so the target is always exactly reachable.
import type { Game } from './game';
import type { Rng } from '../types';
import { h, randInt, pick, seeded, shuffle } from '../ui';

type Op = '+' | '−' | '×' | '÷';
const OPS: Op[] = ['+', '−', '×', '÷'];
const LARGE = [25, 50, 75, 100];
const CAP = 20000; // ponytail: intermediates above this are skipped by the solver; it only shrinks the search, any answer it finds is still valid

function apply(a: number, op: Op, b: number): number | null {
  if (op === '+') return a + b;
  if (op === '×') return a * b;
  if (op === '−') return a > b ? a - b : null;
  return b > 0 && a % b === 0 ? a / b : null;
}

/** For every subset of the numbers (bitmask), the values it can make and one expression for each. */
export function solve(nums: number[]): Map<number, string>[] {
  const n = nums.length, full = (1 << n) - 1;
  const by: Map<number, string>[] = Array.from({ length: full + 1 }, () => new Map());
  for (let i = 0; i < n; i++) by[1 << i].set(nums[i], String(nums[i]));
  const order = Array.from({ length: full }, (_, i) => i + 1).sort((x, y) => pop(x) - pop(y));
  for (const m of order) {
    if (pop(m) < 2) continue;
    const out = by[m];
    // each unordered split {s, m^s} once: s holds the lowest set bit of m
    const low = m & -m;
    for (let s = (m - 1) & m; s > 0; s = (s - 1) & m) {
      if (!(s & low)) continue;
      const A = by[s], B = by[m ^ s];
      for (const [a, ea] of A) for (const [b, eb] of B) {
        const [x, ex, y, ey] = a >= b ? [a, ea, b, eb] : [b, eb, a, ea];
        const add = x + y;
        if (add <= CAP && !out.has(add)) out.set(add, `(${ex} + ${ey})`);
        if (x > y && !out.has(x - y)) out.set(x - y, `(${ex} − ${ey})`);
        if (y > 1) {
          const mul = x * y;
          if (mul <= CAP && !out.has(mul)) out.set(mul, `(${ex} × ${ey})`);
          if (x % y === 0 && !out.has(x / y)) out.set(x / y, `(${ex} ÷ ${ey})`);
        }
      }
    }
  }
  return by;
}
function pop(m: number) { let c = 0; while (m) { m &= m - 1; c++; } return c; }

/** Values reachable with a single operation on two of the numbers. */
function oneStep(nums: number[]): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < nums.length; i++) for (let j = 0; j < nums.length; j++) if (i !== j)
    for (const op of OPS) { const v = apply(nums[i], op, nums[j]); if (v !== null) s.add(v); }
  return s;
}

/** Tidy an expression for display: drop the outer brackets. */
const tidy = (e: string) => (e.startsWith('(') && e.endsWith(')') && depthOk(e) ? e.slice(1, -1) : e);
function depthOk(e: string) { let d = 0; for (let i = 0; i < e.length - 1; i++) { d += e[i] === '(' ? 1 : e[i] === ')' ? -1 : 0; if (d === 0) return false; } return true; }

export interface Round { nums: number[]; target: number; /** one expression that makes the target */ solution: string }

/** The solution as the steps a player would tap. */
export function solutionSteps(r: Round): string[] { const st: string[] = []; evalExpr(r.solution, st); return st; }

export function makeRound(rng: Rng): Round {
  for (;;) {
    const nLarge = pick(rng, [1, 1, 2, 2, 2, 3]);
    const large = shuffle(rng, LARGE).slice(0, nLarge);
    const small: number[] = [];
    while (small.length < 6 - nLarge) {
      const v = randInt(rng, 1, 10);
      if (small.filter((x) => x === v).length < 2) small.push(v);
    }
    const nums = [...large, ...small.sort((a, b) => b - a)];
    const by = solve(nums);
    const easy = oneStep(nums);
    // targets need at least 3 numbers: collect from subsets of size 3+, minus anything simpler
    const simple = new Set<number>([...nums, ...easy]);
    const found = new Map<number, string>();
    for (let m = 1; m < by.length; m++) {
      if (pop(m) < 3) continue;
      for (const [v, e] of by[m]) if (v >= 101 && v <= 999 && !simple.has(v) && !found.has(v)) found.set(v, e);
    }
    if (found.size < 50) continue;
    const vals = [...found.keys()].sort((a, b) => a - b);
    const target = pick(rng, vals);
    return { nums, target, solution: tidy(found.get(target)!) };
  }
}

/** Check a written solution with plain arithmetic, so the shown answer is never wrong. NaN if any step isn't a positive whole number. */
function evalExpr(e: string, steps: string[] = []): number {
  const toks = e.replace(/\s+/g, '').match(/\d+|[()+−×÷]/g) ?? [];
  let i = 0;
  const ok = (a: number, o: string, b: number, v: number) => { steps.push(`${a} ${o} ${b} = ${v}`); return Number.isInteger(v) && v > 0 ? v : NaN; };
  const atom = (): number => { const t = toks[i++]; if (t === '(') { const v = sum(); i++; return v; } return Number(t); };
  const prod = (): number => { let v = atom(); while (toks[i] === '×' || toks[i] === '÷') { const o = toks[i++], b = atom(); v = ok(v, o, b, o === '×' ? v * b : v / b); } return v; };
  const sum = (): number => { let v = prod(); while (toks[i] === '+' || toks[i] === '−') { const o = toks[i++], b = prod(); v = ok(v, o, b, o === '+' ? v + b : v - b); } return v; };
  return sum();
}

export const score = (diff: number) => Math.max(0, 100 - 10 * diff);

interface Tile { v: number; id: number; made: boolean }
interface Snap { tiles: Tile[]; steps: string[] }

export const target: Game = {
  id: 'target', title: 'Make the Number', icon: '🔢', color: '#3b7ddd',
  blurb: 'Six numbers, four operations, one target.',
  how: 'Tap a number, an operation, then another number: the two are replaced by the result. Each number can be used once, and every result must be a whole, positive number.\n\nHit the target exactly for **100**. Otherwise tap **I’m done** to submit your closest number: each one off costs 10 points.',
  course: 'math-thinking',
  css: `

.g-target .t-goal { text-align: center; margin: 4px 0 14px; }
.g-target .t-goal .lbl { color: var(--muted); font-size: .9rem; font-weight: 600; }
.g-target .t-goal .val { font-size: 3rem; font-weight: 800; line-height: 1.1; color: var(--accent); font-variant-numeric: tabular-nums; }
.g-target .t-near { color: var(--muted); font-size: .9rem; min-height: 1.3em; }
.g-target .t-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 420px; margin: 0 auto; }
.g-target .t-tile { font-size: 1.6rem; font-weight: 700; min-height: 64px; padding: .3em; background: var(--panel); color: var(--text); border: 2px solid var(--line); font-variant-numeric: tabular-nums; }
.g-target .t-tile.made { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 60%, var(--line)); }
.g-target .t-tile.sel { border: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 16%, var(--panel)); }
.g-target .t-ops { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-width: 420px; margin: 14px auto 0; }
.g-target .t-op { font-size: 1.7rem; font-weight: 700; min-height: 58px; padding: 0; background: var(--panel2); color: var(--text); border: 2px solid var(--line); }
.g-target .t-op.sel { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, var(--panel)); }
.g-target .t-msg { text-align: center; min-height: 1.4em; margin: 10px 0 0; font-size: .95rem; color: var(--muted); }
.g-target .t-msg.bad { color: var(--bad); }
.g-target .t-steps { max-width: 420px; margin: 10px auto 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
.g-target .t-steps li { padding: 4px 10px; border-left: 3px solid var(--accent); margin: 4px 0; background: var(--panel); border-radius: 0 8px 8px 0; }
.g-target .t-btns { display: flex; gap: 10px; max-width: 420px; margin: 14px auto 0; }
.g-target .t-btns button { flex: 1; min-height: 48px; padding: .5em; }
.g-target .t-sol { max-width: 420px; margin: 14px auto 0; }
.g-target .t-way { margin: 6px 0 0; padding-left: 1.4em; font-variant-numeric: tabular-nums; }
`,
  mount(el, api) {
    const round = makeRound(api.rng);
    let nextId = 0;
    let tiles: Tile[] = round.nums.map((v) => ({ v, id: nextId++, made: false }));
    let steps: string[] = [];
    const history: Snap[] = [];
    let selA: number | null = null, op: Op | null = null, over = false;

    const tileBox = h('div', { class: 't-tiles' });
    const opBtns = OPS.map((o) => h('button', { class: 't-op', 'aria-label': o, onclick: () => tapOp(o) }, o));
    const msg = h('p', { class: 't-msg', 'aria-live': 'polite' });
    const near = h('div', { class: 't-near' });
    const stepList = h('ol', { class: 't-steps' });
    const undoBtn = h('button', { class: 'ghost', onclick: () => undo() }, '↶ Undo');
    const resetBtn = h('button', { class: 'ghost', onclick: () => reset() }, 'Reset');
    const doneBtn = h('button', { class: 'primary', onclick: () => end() }, 'I’m done');
    const sol = h('div', { class: 't-sol' });
    const btnRow = h('div', { class: 't-btns' }, undoBtn, resetBtn, doneBtn);

    el.append(
      h('div', { class: 't-goal' }, h('div', { class: 'lbl' }, 'Target'), h('div', { class: 'val' }, String(round.target)), near),
      tileBox, h('div', { class: 't-ops' }, opBtns), msg, stepList,
      btnRow, sol);

    const closest = () => tiles.reduce((b, t) => (Math.abs(t.v - round.target) < Math.abs(b.v - round.target) ? t : b));
    const say = (t: string, bad = false) => { msg.textContent = t; msg.classList.toggle('bad', bad); };

    function render() {
      tileBox.replaceChildren(...tiles.map((t) => h('button', {
        class: `t-tile${t.made ? ' made' : ''}${t.id === selA ? ' sel' : ''}`, disabled: over, onclick: () => tapTile(t.id),
      }, String(t.v))));
      opBtns.forEach((b, i) => { b.classList.toggle('sel', OPS[i] === op); b.disabled = over; });
      stepList.replaceChildren(...steps.map((s) => h('li', null, s)));
      const c = closest(), d = Math.abs(c.v - round.target);
      near.textContent = d === 0 ? 'Got it!' : `Closest so far: ${c.v} (${d} off)`;
      undoBtn.disabled = over || !history.length;
      resetBtn.disabled = over || !history.length;
      doneBtn.disabled = over;
    }

    function tapTile(id: number) {
      if (over) return;
      if (selA === null || op === null || selA === id) {
        selA = selA === id ? null : id; op = selA === null ? null : op;
        say(selA === null ? '' : 'Now pick an operation.');
        return render();
      }
      const a = tiles.find((t) => t.id === selA)!, b = tiles.find((t) => t.id === id)!;
      const v = apply(a.v, op, b.v);
      if (v === null) {
        say(op === '−' ? `${a.v} − ${b.v} isn’t positive. Pick the bigger number first.` : `${a.v} ÷ ${b.v} isn’t a whole number.`, true);
        return;
      }
      history.push({ tiles, steps });
      tiles = tiles.filter((t) => t !== a).map((t) => (t === b ? { v, id: nextId++, made: true } : t));
      steps = [...steps, `${a.v} ${op} ${b.v} = ${v}`];
      selA = null; op = null;
      say('');
      render();
      if (v === round.target) end();
    }

    function tapOp(o: Op) {
      if (over) return;
      if (selA === null) { say('Pick a number first.'); return; }
      op = o; say('Now pick the second number.'); render();
    }

    function undo() { const s = history.pop(); if (!s) return; ({ tiles, steps } = s); selA = null; op = null; say(''); render(); }
    function reset() { if (!history.length) return; ({ tiles, steps } = history[0]); history.length = 0; selA = null; op = null; say(''); render(); }

    function end() {
      if (over) return;
      over = true; selA = null; op = null;
      const c = closest(), d = Math.abs(c.v - round.target), sc = score(d);
      render();
      btnRow.remove();
      say(d === 0 ? 'Exactly on target!' : `You finished on ${c.v}, ${d} away.`);
      const way = solutionSteps(round);
      sol.replaceChildren(h('div', { class: `feedback ${d === 0 ? 'good' : 'shown'}` },
        h('strong', null, 'One way to get there:'), h('ol', { class: 't-way' }, way.map((s) => h('li', null, s)))));
      api.finish(sc, d === 0
        ? `Hit **${round.target}** exactly in ${steps.length} step${steps.length === 1 ? '' : 's'}.`
        : `Closest: **${c.v}** for a target of **${round.target}** (${d} off).`);
    }

    render();
  },
  check(seed) {
    const r = makeRound(seeded(seed));
    if (r.nums.length !== 6) return `got ${r.nums.length} numbers`;
    if (r.target < 101 || r.target > 999) return `target ${r.target} not three digits`;
    if (r.nums.includes(r.target)) return `target ${r.target} is one of the numbers`;
    if (oneStep(r.nums).has(r.target)) return `target ${r.target} is one operation away`;
    const expr = r.solution;
    if (evalExpr(expr) !== r.target) return `solution ${r.solution} evaluates to ${evalExpr(expr)}, not ${r.target}`;
    const used = (expr.match(/\d+/g) ?? []).map(Number).sort((a, b) => a - b);
    const pool = [...r.nums].sort((a, b) => a - b);
    for (const u of used) { const k = pool.indexOf(u); if (k < 0) return `solution ${r.solution} uses ${u} too often`; pool.splice(k, 1); }
    return null;
  },
};
