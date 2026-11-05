// Deduction Grid: four people, three categories, a few clues, exactly one answer.
// Generation: random solution, add true clues until one candidate survives, then drop redundant clues.
import type { Game } from './game';
import type { Rng } from '../types';
import { h, seeded, shuffle } from '../ui';

interface Cat { name: string; items: string[]; has: (x: string) => string; not: (x: string, y?: string) => string; who: (x: string) => string }

const the = (x: string) => `the ${x}`;
const CATS: Cat[] = [
  { name: 'Pet', items: ['cat', 'dog', 'parrot', 'rabbit', 'turtle', 'hamster'], has: (x) => `has ${the(x)}`, not: (x, y) => `doesn't have ${the(x)}${y ? ` or ${the(y)}` : ''}`, who: (x) => `the ${x} owner` },
  { name: 'Drink', items: ['tea', 'coffee', 'juice', 'cocoa', 'milk', 'soda'], has: (x) => `drinks ${x}`, not: (x, y) => `doesn't drink ${x}${y ? ` or ${y}` : ''}`, who: (x) => `the ${x} drinker` },
  { name: 'Colour', items: ['red', 'blue', 'green', 'yellow', 'purple', 'orange'], has: (x) => `wears ${x}`, not: (x, y) => `doesn't wear ${x}${y ? ` or ${y}` : ''}`, who: (x) => `the person in ${x}` },
  { name: 'Sport', items: ['tennis', 'chess', 'judo', 'rowing', 'golf', 'yoga'], has: (x) => `does ${x}`, not: (x, y) => `doesn't do ${x}${y ? ` or ${y}` : ''}`, who: (x) => `the ${x} fan` },
  { name: 'Snack', items: ['apples', 'popcorn', 'chips', 'grapes', 'nuts', 'cheese'], has: (x) => `eats ${x}`, not: (x, y) => `doesn't eat ${x}${y ? ` or ${y}` : ''}`, who: (x) => `the one who eats ${x}` },
];
const NAMES = ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli', 'Femi', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kai', 'Lea', 'Milo', 'Nia'];
const N = 4, K = 3;

// All 24 orderings; a candidate solution is K indexes into PERMS (perm[person] = item).
const PERMS: number[][] = [];
(function gen(p: number[], rest: number[]) { if (!rest.length) PERMS.push(p); for (const x of rest) gen([...p, x], rest.filter((y) => y !== x)); })([], [0, 1, 2, 3]);
const INV = PERMS.map((p) => { const q = [0, 0, 0, 0]; p.forEach((x, i) => { q[x] = i; }); return q; }); // item -> person

type Clue =
  | { t: 'is'; p: number; c: number; i: number }
  | { t: 'not'; p: number; c: number; i: number; j?: number }
  | { t: 'link'; c: number; i: number; d: number; j: number; same: boolean }
  | { t: 'either'; p: number; q: number; c: number; i: number };

/** sol[c] = index into PERMS */
function holds(cl: Clue, sol: number[]): boolean {
  switch (cl.t) {
    case 'is': return PERMS[sol[cl.c]][cl.p] === cl.i;
    case 'not': { const v = PERMS[sol[cl.c]][cl.p]; return v !== cl.i && v !== cl.j; }
    case 'link': return (INV[sol[cl.c]][cl.i] === INV[sol[cl.d]][cl.j]) === cl.same;
    case 'either': { const o = INV[sol[cl.c]][cl.i]; return o === cl.p || o === cl.q; }
  }
}

const ALL: number[][] = [];
for (let a = 0; a < 24; a++) for (let b = 0; b < 24; b++) for (let c = 0; c < 24; c++) ALL.push([a, b, c]);

/** Number of solutions to the clues, stopping at `cap`. */
export function countSolutions(clues: Clue[], cap = 2): number {
  let n = 0;
  for (const s of ALL) if (clues.every((cl) => holds(cl, s)) && ++n >= cap) break;
  return n;
}

export interface Puzzle { names: string[]; cats: Cat[]; items: string[][]; sol: number[]; clues: Clue[] }

function randClue(rng: Rng, sol: number[]): Clue {
  const r = rng(), p = Math.floor(rng() * N), c = Math.floor(rng() * K);
  const val = (cc: number, pp: number) => PERMS[sol[cc]][pp];
  const other = (x: number) => (x + 1 + Math.floor(rng() * (N - 1))) % N;
  if (r < 0.08) return { t: 'is', p, c, i: val(c, p) };
  if (r < 0.35) { const i = other(val(c, p)); return { t: 'not', p, c, i } as Clue; }
  if (r < 0.5) { const i = other(val(c, p)); let j = other(val(c, p)); if (j === i) j = [0, 1, 2, 3].find((x) => x !== i && x !== val(c, p))!; return { t: 'not', p, c, i: Math.min(i, j), j: Math.max(i, j) }; }
  if (r < 0.85) {
    const d = (c + 1 + Math.floor(rng() * (K - 1))) % K, i = Math.floor(rng() * N);
    const owner = INV[sol[c]][i];
    if (rng() < 0.5) return { t: 'link', c, i, d, j: val(d, owner), same: true };
    return { t: 'link', c, i, d, j: other(val(d, owner)), same: false };
  }
  const q = other(p), i = val(c, rng() < 0.5 ? p : q);
  return { t: 'either', p: Math.min(p, q), q: Math.max(p, q), c, i };
}

export function buildPuzzle(rng: Rng): Puzzle {
  const cats = shuffle(rng, CATS).slice(0, K);
  const names = shuffle(rng, NAMES).slice(0, N);
  const items = cats.map((c) => shuffle(rng, c.items).slice(0, N));
  const sol = [0, 1, 2].map(() => Math.floor(rng() * 24));
  let cand = ALL;
  const clues: Clue[] = [];
  while (cand.length > 1) {
    const cl = randClue(rng, sol);
    const next = cand.filter((s) => holds(cl, s));
    if (next.length < cand.length) { clues.push(cl); cand = next; }
  }
  // Drop clues the others already imply (random order, so the set differs day to day).
  // total[k] = how many kept clues candidate k satisfies; without clue m it must satisfy all the rest.
  const mask = new Map(clues.map((cl) => [cl, Uint8Array.from(ALL, (s) => (holds(cl, s) ? 1 : 0))]));
  const total = new Uint8Array(ALL.length);
  for (const m of mask.values()) for (let k = 0; k < ALL.length; k++) total[k] += m[k];
  for (const cl of shuffle(rng, clues)) {
    const m = mask.get(cl)!, need = clues.length - 1;
    let n = 0;
    for (let k = 0; k < ALL.length && n < 2; k++) if (total[k] - m[k] === need) n++;
    if (n === 1) { clues.splice(clues.indexOf(cl), 1); for (let k = 0; k < ALL.length; k++) total[k] -= m[k]; }
  }
  return { names, cats, items, sol, clues: shuffle(rng, clues) };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export function clueText(P: Puzzle, cl: Clue): string {
  const it = (c: number, i: number) => P.items[c][i];
  const C = P.cats;
  switch (cl.t) {
    case 'is': return `${P.names[cl.p]} ${C[cl.c].has(it(cl.c, cl.i))}.`;
    case 'not': return cl.j === undefined && (cl.p + cl.i) % 2 // vary the wording a little, deterministically
      ? `${cap(C[cl.c].who(it(cl.c, cl.i)))} isn't ${P.names[cl.p]}.`
      : `${P.names[cl.p]} ${C[cl.c].not(it(cl.c, cl.i), cl.j === undefined ? undefined : it(cl.c, cl.j))}.`;
    case 'link': return `${cap(C[cl.c].who(it(cl.c, cl.i)))} ${(cl.same ? C[cl.d].has : C[cl.d].not)(it(cl.d, cl.j))}.`;
    case 'either': return `Either ${P.names[cl.p]} or ${P.names[cl.q]} ${C[cl.c].has(it(cl.c, cl.i))}.`;
  }
}

function checkPuzzle(seed: number): string | null {
  const P = buildPuzzle(seeded(seed));
  for (const cl of P.clues) if (!holds(cl, P.sol)) return `clue false: ${clueText(P, cl)}`;
  if (countSolutions(P.clues, 3) !== 1) return 'not exactly one solution';
  const texts = P.clues.map((c) => clueText(P, c));
  if (new Set(texts).size !== texts.length) return 'duplicate clue';
  if (P.clues.length < 4 || P.clues.length > 16) return `${P.clues.length} clues`;
  return null;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const grid: Game = {
  id: 'grid', title: 'Deduction Grid', icon: '🧩', color: '#7b5cd6', course: 'logic',
  blurb: 'Four people, a handful of clues, one answer.',
  how: 'Each person has exactly one thing from each column, and no two people share one.\n\nUse the clues to fill in the table, then press **Check**. Tap a clue to cross it off. A first-time check scores best.',
  css: `

.g-grid .dg-clues { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 6px; }
.g-grid .dg-clues li { padding: .4em .7em; line-height: 1.35; border-radius: 10px; background: var(--panel2); border: 1px solid var(--line); cursor: pointer; user-select: none; min-height: 40px; display: flex; gap: 8px; align-items: center; }
.g-grid .dg-clues li .n { color: var(--muted); font-weight: 700; font-size: .85rem; min-width: 1.4em; }
.g-grid .dg-clues li.done { opacity: .5; text-decoration: line-through; }
.g-grid .dg-table { width: 100%; border-collapse: separate; border-spacing: 3px 4px; table-layout: fixed; }
.g-grid .dg-table th { font-size: .82rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 0 4px; }
.g-grid .dg-table td.name { font-weight: 700; padding-right: 4px; overflow-wrap: anywhere; }
.g-grid .dg-table col.name { width: 3.3em; }
.g-grid select { -webkit-appearance: none; appearance: none; text-align: center; text-align-last: center; width: 100%; height: 44px; font: inherit; font-size: .92rem; padding: 0 2px; border-radius: 10px; border: 2px solid var(--line); background: var(--panel); color: var(--text); }
.g-grid select:disabled { opacity: 1; color: var(--text); }
.g-grid select.dup { border-color: var(--bad); }
.g-grid select.right { border-color: var(--good); background: var(--good-bg); }
.g-grid select.wrong { border-color: var(--bad); background: var(--bad-bg); }
.g-grid .dg-btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.g-grid .dg-btns .primary { flex: 1 1 auto; }
@media (min-width: 760px) { .g-grid .dg-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; } }
`,
  mount(el, api) {
    const P = buildPuzzle(api.rng);
    const t0 = Date.now();
    let wrongChecks = 0, over = false;

    const clues = h('ol', { class: 'dg-clues' }, P.clues.map((cl, k) =>
      h('li', { onclick: (e: Event) => (e.currentTarget as HTMLElement).classList.toggle('done') }, h('span', { class: 'n' }, `${k + 1}.`), clueText(P, cl))));
    const sels = P.names.map(() => P.cats.map((_, c) => h('select', { 'aria-label': P.cats[c].name, onchange: () => dupes() },
      h('option', { value: '' }, '?'), P.items[c].map((x, i) => h('option', { value: i }, x)))));
    const dupes = () => P.cats.forEach((_, c) => {
      const v = sels.map((r) => r[c].value);
      sels.forEach((r, p) => r[c].classList.toggle('dup', v[p] !== '' && v.filter((x) => x === v[p]).length > 1));
    });
    const table = h('table', { class: 'dg-table' },
      h('colgroup', null, h('col', { class: 'name' }), P.cats.map(() => h('col'))),
      h('thead', null, h('tr', null, h('th', null, ''), P.cats.map((c) => h('th', null, c.name)))),
      h('tbody', null, P.names.map((n, p) => h('tr', null, h('td', { class: 'name' }, n), sels[p].map((s) => h('td', null, s))))));
    const fb = h('div');
    const say = (cls: string, head: string, body: string) => fb.replaceChildren(h('div', { class: `feedback ${cls}` }, h('div', { class: 'fb-head' }, head), body));

    const correct = (p: number, c: number) => sels[p][c].value === String(PERMS[P.sol[c]][p]);
    const end = (score: number, note: string) => {
      over = true;
      sels.forEach((r, p) => r.forEach((s, c) => { s.disabled = true; s.classList.remove('dup'); s.classList.add(correct(p, c) ? 'right' : 'wrong'); }));
      btns.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      api.finish(score, note);
    };
    const check = () => {
      if (over) return;
      if (sels.some((r) => r.some((s) => s.value === ''))) return say('shown', 'Not finished', 'Fill in every cell first. Each item is used exactly once per column.');
      let wrong = 0;
      sels.forEach((r, p) => r.forEach((_, c) => { if (!correct(p, c)) wrong++; }));
      if (wrong) { wrongChecks++; return say('bad', `${wrong} cell${wrong > 1 ? 's are' : ' is'} wrong`, 'Go back through the clues one at a time. Each “not” clue rules out a cell; a link clue ties two columns together.'); }
      const secs = Math.round((Date.now() - t0) / 1000);
      const score = Math.max(30, 100 - 15 * wrongChecks - Math.min(20, Math.max(0, Math.floor((secs - 180) / 20))));
      say('good', 'Solved!', `Every cell is right, in ${mmss(secs)}.`);
      end(score, `Solved in ${mmss(secs)} with ${wrongChecks ? `${wrongChecks} wrong check${wrongChecks > 1 ? 's' : ''}` : 'no wrong checks'}.\nThe trick: fix what a clue *forces*, and let “no two share” rule out the rest.`);
    };
    const giveUp = () => {
      if (over) return;
      sels.forEach((r, p) => r.forEach((s, c) => { s.value = String(PERMS[P.sol[c]][p]); }));
      say('shown', 'Here’s the answer', 'Read through the clues against it: each one is true, and together they leave only this table.');
      end(5, `Revealed the answer. Next time start with the clue that pins down the most, and use “no two share” to rule out the rest.`);
    };
    const btns = h('div', { class: 'dg-btns' },
      h('button', { class: 'primary', onclick: check }, 'Check'),
      h('button', { class: 'ghost', onclick: giveUp }, 'Show answer'));

    el.append(h('div', { class: 'card dg-wrap' },
      h('div', null, h('h3', { style: 'margin:0 0 8px' }, 'Clues'), clues),
      h('div', null, table, btns, fb)));
  },
  check: checkPuzzle,
};
