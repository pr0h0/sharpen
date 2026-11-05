// Rule Hunt: a hidden rule about three whole numbers. Test triples, then pick the rule.
// The lesson is the Wason 2-4-6 one: tests you expect to fail teach you the most.
import type { Game } from './game';
import type { Rng } from '../types';
import { h, pick, seeded, shuffle } from '../ui';

type Pred = (a: number, b: number, c: number) => boolean;
interface Rule { text: string; f: Pred }

const has7 = (n: number) => String(n).includes('7');
const prime = (n: number) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
const square = (n: number) => n > 0 && Number.isInteger(Math.sqrt(n));
const even = (n: number) => n % 2 === 0;

export const RULES: Rule[] = [
  { text: 'The numbers go up', f: (a, b, c) => a < b && b < c },
  { text: 'The numbers go down', f: (a, b, c) => a > b && b > c },
  { text: 'All three are even', f: (a, b, c) => even(a) && even(b) && even(c) },
  { text: 'All three are odd', f: (a, b, c) => !even(a) && !even(b) && !even(c) },
  { text: 'All even or all odd', f: (a, b, c) => even(a) === even(b) && even(b) === even(c) },
  { text: 'The sum is even', f: (a, b, c) => even(a + b + c) },
  { text: 'The sum is a multiple of 3', f: (a, b, c) => (a + b + c) % 3 === 0 },
  { text: 'The middle number is the largest', f: (a, b, c) => b > a && b > c },
  { text: 'The middle number is the smallest', f: (a, b, c) => b < a && b < c },
  { text: 'The first number is the smallest', f: (a, b, c) => a < b && a < c },
  { text: 'The last number is the largest', f: (a, b, c) => c > a && c > b },
  { text: 'The first is less than the last', f: (a, b, c) => a < c },
  { text: 'Each number is double the one before', f: (a, b, c) => b === 2 * a && c === 2 * b },
  { text: 'Each number is 2 more than the one before', f: (a, b, c) => b === a + 2 && c === b + 2 },
  { text: 'Same step each time (like 9, 6, 3 or 4, 4, 4)', f: (a, b, c) => b - a === c - b },
  { text: 'At least one number has a 7 in it', f: (a, b, c) => has7(a) || has7(b) || has7(c) },
  { text: 'All three are different', f: (a, b, c) => a !== b && b !== c && a !== c },
  { text: 'At least two are the same', f: (a, b, c) => a === b || b === c || a === c },
  { text: 'The first two add up to the third', f: (a, b, c) => a + b === c },
  { text: 'The first two multiply to the third', f: (a, b, c) => a * b === c },
  { text: 'Multiplied together they make less than 100', f: (a, b, c) => a * b * c < 100 },
  { text: 'The sum is less than 20', f: (a, b, c) => a + b + c < 20 },
  { text: 'The sum is more than 15', f: (a, b, c) => a + b + c > 15 },
  { text: 'Every number is under 10', f: (a, b, c) => a < 10 && b < 10 && c < 10 },
  { text: 'Every number is more than 3', f: (a, b, c) => a > 3 && b > 3 && c > 3 },
  { text: 'All three are multiples of 3', f: (a, b, c) => a % 3 === 0 && b % 3 === 0 && c % 3 === 0 },
  { text: 'Exactly one number is even', f: (a, b, c) => [a, b, c].filter(even).length === 1 },
  { text: 'At least one number is even', f: (a, b, c) => even(a) || even(b) || even(c) },
  { text: 'The middle number is even', f: (_a, b) => even(b) },
  { text: 'At least one is a prime number', f: (a, b, c) => prime(a) || prime(b) || prime(c) },
  { text: 'At least one is a square number (1, 4, 9, 16…)', f: (a, b, c) => square(a) || square(b) || square(c) },
  { text: 'Largest minus smallest is at least 5', f: (a, b, c) => Math.max(a, b, c) - Math.min(a, b, c) >= 5 },
  { text: 'The last is a multiple of the first', f: (a, b, c) => a > 0 && c % a === 0 },
];

// Brute-force domain for telling rules apart: every triple with numbers 0..20.
const D = 21;
const tri = (i: number): [number, number, number] => [Math.floor(i / (D * D)), Math.floor(i / D) % D, i % D];
let tables: Uint8Array[] | null = null;
function table(): Uint8Array[] {
  if (!tables) tables = RULES.map((r) => { const t = new Uint8Array(D ** 3); for (let i = 0; i < t.length; i++) t[i] = r.f(...tri(i)) ? 1 : 0; return t; });
  return tables;
}

/** A triple in 1..20 (smallest numbers first) that one rule accepts and the other rejects, or null. */
export function splitter(x: Rule, y: Rule): [number, number, number] | null {
  for (let m = 1; m < D; m++) // grow the largest number allowed, so the example is as small as possible
    for (let a = 1; a <= m; a++) for (let b = 1; b <= m; b++) for (let c = 1; c <= m; c++)
      if (Math.max(a, b, c) === m && x.f(a, b, c) !== y.f(a, b, c)) return [a, b, c];
  for (let i = 0; i < D ** 3; i++) { const t = tri(i); if (x.f(...t) !== y.f(...t)) return t; }
  return null;
}

export interface Round { truth: number; start: [number, number, number]; choices: number[] }

export function buildRound(rng: Rng): Round {
  const T = table();
  const truth = Math.floor(rng() * RULES.length);
  const differs = (k: number) => { const a = T[truth], b = T[k]; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true; return false; };
  const others = RULES.map((_, k) => k).filter((k) => k !== truth && differs(k));
  // Starting example: a triple (1..20) that fits the rule and as many look-alikes as possible.
  const fits: number[] = [];
  for (let i = 0; i < D ** 3; i++) { const [a, b, c] = tri(i); if (a && b && c && T[truth][i]) fits.push(i); }
  let best = fits[0], bestN = -1;
  for (let s = 0; s < 40; s++) {
    const i = pick(rng, fits);
    const n = others.filter((k) => T[k][i]).length;
    if (n > bestN) { best = i; bestN = n; }
  }
  const sh = shuffle(rng, others);
  const yes = sh.filter((k) => T[k][best]).slice(0, 4);
  const no = sh.filter((k) => !T[k][best]).slice(0, 5 - yes.length);
  return { truth, start: tri(best), choices: shuffle(rng, [truth, ...yes, ...no]) };
}

function checkRound(seed: number): string | null {
  const r = buildRound(seeded(seed));
  const t = RULES[r.truth];
  if (!t.f(...r.start)) return `start ${r.start} doesn't fit "${t.text}"`;
  if (r.choices.length !== 6 || new Set(r.choices).size !== 6) return `bad choices ${r.choices}`;
  if (!r.choices.includes(r.truth)) return 'truth not among choices';
  const decoys = r.choices.filter((k) => k !== r.truth);
  if (decoys.filter((k) => RULES[k].f(...r.start)).length < 2) return `fewer than 2 decoys fit ${r.start}`;
  for (const k of decoys) if (!splitter(t, RULES[k])) return `"${RULES[k].text}" can't be told apart from "${t.text}"`;
  return null;
}

const fmt = (t: number[]) => t.join(', ');

export const rules: Game = {
  id: 'rules', title: 'Rule Hunt', icon: '🔍', color: '#c34fa0', course: 'biases',
  blurb: 'Find the hidden rule behind three numbers.',
  how: 'A secret rule decides which triples of whole numbers fit. You get one that does.\n\nType your own triples to test them, then pick the rule from the list. Fewer tests score more, but a wrong pick scores little: test the triples you think will **fail**.',
  css: `

.g-rules .rh-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.g-rules .rh-in { width: 64px; height: 52px; font: inherit; font-size: 1.35rem; text-align: center; border-radius: 11px; border: 2px solid var(--line); background: var(--panel); color: var(--text); }
.g-rules .rh-in:focus { border-color: var(--accent); outline: none; }
.g-rules .rh-row .primary { height: 52px; flex: 1 1 auto; min-width: 90px; max-width: 180px; }
.g-rules .rh-msg { min-height: 1.4em; margin: 8px 0 0; color: var(--muted); font-size: .95rem; }
.g-rules .rh-log { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.g-rules .rh-t { display: inline-flex; gap: 6px; align-items: center; padding: .35em .7em; border-radius: 10px; font-weight: 600; font-variant-numeric: tabular-nums; border: 1px solid var(--line); }
.g-rules .rh-t.yes { background: var(--good-bg); border-color: var(--good); }
.g-rules .rh-t.no { background: var(--bad-bg); border-color: var(--bad); }
.g-rules .rh-t b { color: var(--good); }
.g-rules .rh-t.no b { color: var(--bad); }
.g-rules .rh-t.start { border-width: 2px; }
.g-rules .rh-t.new { animation: rise .2s ease; }
.g-rules h3 { margin: 18px 0 8px; font-size: 1.05rem; }
.g-rules .rh-opts { display: grid; gap: 8px; grid-template-columns: 1fr; }
.g-rules .rh-opts .option { min-height: 48px; }
.g-rules .rh-go { margin-top: 12px; width: 100%; }
@media (min-width: 700px) { .g-rules .rh-opts { grid-template-columns: 1fr 1fr; } .g-rules .rh-go { width: auto; } }
`,
  mount(el, api) {
    const R = buildRound(api.rng);
    const truth = RULES[R.truth];
    const seen = new Set<string>([fmt(R.start)]);
    let tests = 0, fails = 0, chosen = -1;

    const ins = [0, 1, 2].map((k) => h('input', {
      class: 'rh-in', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 2, 'aria-label': `Number ${k + 1}`,
      oninput: (e: Event) => { const t = e.target as HTMLInputElement; t.value = t.value.replace(/\D/g, ''); if (t.value.length === 2 && k < 2) ins[k + 1].focus(); },
      onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') test(); },
    }));
    const msg = h('p', { class: 'rh-msg' }, 'Numbers from 0 to 99.');
    const count = h('span', { class: 'muted small' });
    const entry = (t: number[], ok: boolean, start = false) =>
      h('span', { class: `rh-t ${ok ? 'yes' : 'no'}${start ? ' start' : ' new'}` }, fmt(t), h('b', null, ok ? '✓' : '✗'), start ? h('span', { class: 'muted small' }, 'given') : null);
    const log = h('div', { class: 'rh-log', 'aria-live': 'polite' }, entry(R.start, true, true));
    const testBtn = h('button', { class: 'primary', onclick: () => test() }, 'Test');
    const updCount = () => { count.textContent = tests ? `${tests} test${tests > 1 ? 's' : ''} · ${fails} came back ✗` : 'No tests yet'; };

    function test() {
      const v = ins.map((i) => i.value.trim());
      if (v.some((s) => s === '')) { msg.textContent = 'Fill in all three numbers.'; ins[v.findIndex((s) => s === '')].focus(); return; }
      const t = v.map(Number) as [number, number, number];
      if (seen.has(fmt(t))) { msg.textContent = `You already tried ${fmt(t)}.`; return; }
      seen.add(fmt(t));
      const ok = truth.f(...t);
      tests++;
      if (!ok) fails++;
      log.insertBefore(entry(t, ok), log.children[1] ?? null);
      msg.textContent = `${fmt(t)} ${ok ? 'fits ✓' : 'doesn’t fit ✗'}`;
      updCount();
      ins.forEach((i) => { i.value = ''; });
      ins[0].focus();
    }

    const opts = R.choices.map((k) => h('button', { class: 'option', onclick: () => { chosen = k; opts.forEach((o, j) => o.classList.toggle('picked', R.choices[j] === k)); go.disabled = false; } }, RULES[k].text));
    const go = h('button', { class: 'primary rh-go', disabled: true, onclick: () => lockIn() }, 'Lock in my answer');
    const after = h('div');
    const optBox = h('div', { class: 'rh-opts' }, opts);

    function lockIn() {
      if (chosen < 0) return;
      [...ins, testBtn, go].forEach((b) => { b.disabled = true; });
      optBox.classList.add('locked');
      opts.forEach((o, j) => { if (R.choices[j] === R.truth) o.classList.add('right'); else if (R.choices[j] === chosen) o.classList.add('wrong'); });
      const lesson = fails ? `${fails} of your ${tests} test${tests === 1 ? '' : 's'} came back ✗: tests you expect to fail are the ones that rule out look-alike rules.`
        : 'None of your tests came back ✗. Next time try triples you expect to *fail*: a ✗ tells you more than another ✓.';
      if (chosen === R.truth) {
        const score = Math.max(50, 100 - 4 * Math.max(0, tests - 3));
        after.replaceChildren(h('div', { class: 'feedback good' }, h('div', { class: 'fb-head' }, 'Got it!'), `The rule was “${truth.text}”.`));
        api.finish(score, `You found it: **${truth.text.toLowerCase()}**.\n${lesson}`);
      } else {
        const wrong = RULES[chosen];
        // Prefer a triple they already saw: then the lesson is "look at your own evidence".
        const mine = [...seen].map((x) => x.split(', ').map(Number) as [number, number, number]).find((t) => truth.f(...t) !== wrong.f(...t));
        const s = mine ?? splitter(truth, wrong)!;
        const how = `${fmt(s)} ${truth.f(...s) ? 'fits' : 'doesn’t fit'} the real rule but ${wrong.f(...s) ? 'would fit' : 'wouldn’t fit'} yours`;
        after.replaceChildren(h('div', { class: 'feedback bad' }, h('div', { class: 'fb-head' }, 'Not quite'), `The rule was “${truth.text}”. ${mine ? 'You already had the clue' : 'One test would have shown it'}: ${how}.`));
        api.finish(10, `The rule was **${truth.text.toLowerCase()}**, not “${wrong.text.toLowerCase()}”. ${mine ? `Your own test \`${fmt(s)}\` already told them apart.` : `Testing \`${fmt(s)}\` would have told them apart.`}\n${lesson}`);
      }
    }

    updCount();
    el.append(h('div', { class: 'card' },
      h('div', { class: 'rh-row' }, ...ins, testBtn), msg,
      h('div', { style: 'margin-top:10px' }, count), log,
      h('h3', null, 'Which rule is it?'),
      optBox, go, after));
  },
  check: checkRound,
};
