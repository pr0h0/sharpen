// Odds Duel: two chance events side by side, tap the likelier one. Exact odds are worked out with
// whole-number fractions (BigInt), never by simulation; the simulation is only the show afterwards.
import type { Game } from './game';
import type { Rng } from '../types';
import { h, pick, randInt, seeded } from '../ui';

// ---------------------------------------------------------------- exact fractions

interface Q { n: bigint; d: bigint }
const bgcd = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
function Qn(n: number | bigint, d: number | bigint): Q {
  const a = BigInt(n), b = BigInt(d), g = bgcd(a, b) || 1n;
  return { n: a / g, d: b / g };
}
/** 1 - (miss/all)^k */
const oneMinusPow = (miss: number, all: number, k: number) => Qn(BigInt(all) ** BigInt(k) - BigInt(miss) ** BigInt(k), BigInt(all) ** BigInt(k));
const val = (q: Q) => Number(q.n) / Number(q.d);
const choose = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };

/** Count outcomes of k dice where pred holds (exact enumeration, k <= 4). */
function countDice(k: number, pred: (xs: number[]) => boolean): number {
  let c = 0;
  const xs = new Array(k).fill(1);
  for (let i = 0; i < 6 ** k; i++) {
    let t = i;
    for (let j = 0; j < k; j++) { xs[j] = (t % 6) + 1; t = Math.floor(t / 6); }
    if (pred(xs)) c++;
  }
  return c;
}

const die = (g: Rng) => 1 + Math.floor(g() * 6);
const rolls = (g: Rng, k: number) => Array.from({ length: k }, () => die(g));
/** Draw `k` distinct indices from 0..n-1. */
function drawK(g: Rng, n: number, k: number): number[] {
  const out: number[] = [];
  while (out.length < k) { const x = Math.floor(g() * n); if (!out.includes(x)) out.push(x); }
  return out;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const hasRun = (bits: boolean[], k: number) => { let r = 0; for (const b of bits) { r = b ? r + 1 : 0; if (r >= k) return true; } return false; };

const runMemo = new Map<string, number>();
/** Sequences of n coins containing k heads in a row, by brute force over all 2^n. */
function runCount(n: number, k: number): number {
  const key = `${n},${k}`;
  let c = runMemo.get(key);
  if (c === undefined) {
    c = 0;
    for (let m = 0; m < 2 ** n; m++) if (hasRun(Array.from({ length: n }, (_, i) => ((m >> i) & 1) === 1), k)) c++;
    runMemo.set(key, c);
  }
  return c;
}

// ---------------------------------------------------------------- templates

export interface Ev { tpl: string; icon: string; text: string; p: Q; why: string; trial: (g: Rng) => boolean }
type Tpl = (r: Rng) => Ev;

// Cards: index 0..51, rank = i % 13 (0 = ace, 10..12 = J Q K), suit = floor(i / 13) (0 hearts, 1 diamonds, 2 clubs, 3 spades).
const rank = (c: number) => c % 13, suit = (c: number) => Math.floor(c / 13), red = (c: number) => suit(c) < 2;
const face = (c: number) => rank(c) >= 10;
const ONE_CARD: [string, (c: number) => boolean][] = [
  ['an ace', (c) => rank(c) === 0],
  ['a red face card (J, Q or K)', (c) => red(c) && face(c)],
  ['an ace or a king', (c) => rank(c) === 0 || rank(c) === 12],
  ['a face card (J, Q or K)', face],
  ['a heart', (c) => suit(c) === 0],
  ['a spade or an ace', (c) => suit(c) === 3 || rank(c) === 0],
  ['a heart or a face card', (c) => suit(c) === 0 || face(c)],
  ['a red card or an ace', (c) => red(c) || rank(c) === 0],
  ['a number card (2 to 10)', (c) => rank(c) >= 1 && rank(c) <= 9],
  ['anything but a face card', (c) => !face(c)],
  ['a black card from 2 to 5', (c) => !red(c) && rank(c) >= 1 && rank(c) <= 4],
];
const TWO_CARDS: [string, (a: number, b: number) => boolean, string][] = [
  ['the same suit', (a, b) => suit(a) === suit(b), 'After the first card, 12 of the 51 left match its suit.'],
  ['a pair (same rank)', (a, b) => rank(a) === rank(b), 'After the first card, only 3 of the 51 left match its rank.'],
  ['at least one ace', (a, b) => rank(a) === 0 || rank(b) === 0, 'Count the ways to miss: 48·47 of 52·51 orders have no ace.'],
  ['both red', (a, b) => red(a) && red(b), '26/52 for the first, then 25/51 for the second.'],
  ['at least one heart', (a, b) => suit(a) === 0 || suit(b) === 0, 'No heart at all is 39/52 × 38/51; take that from 1.'],
  ['one red and one black', (a, b) => red(a) !== red(b), 'Whatever comes first, 26 of the 51 left are the other colour.'],
  ['two face cards', (a, b) => face(a) && face(b), '12/52 for the first, then 11/51.'],
];

const T: Tpl[] = [
  (r) => {
    const n = randInt(r, 2, 8);
    return { tpl: 'six', icon: '🎲', text: `Roll a die ${n} times and get at least one 6.`, p: oneMinusPow(5, 6, n),
      why: `Missing every time is (5/6)^${n}; at least one 6 is 1 minus that.`, trial: (g) => rolls(g, n).includes(6) };
  },
  (r) => {
    const n = randInt(r, 8, 30);
    return { tpl: 'double6', icon: '🎲', text: `Roll a pair of dice ${n} times and get at least one double six.`, p: oneMinusPow(35, 36, n),
      why: `A double six is 1/36 a go, so missing all ${n} goes is (35/36)^${n}.`, trial: (g) => { for (let i = 0; i < n; i++) if (die(g) === 6 && die(g) === 6) return true; return false; } };
  },
  (r) => {
    const kind = randInt(r, 0, 2);
    const s = kind === 0 ? randInt(r, 5, 9) : kind === 1 ? randInt(r, 6, 11) : randInt(r, 3, 8);
    const pred = (xs: number[]) => kind === 0 ? sum(xs) === s : kind === 1 ? sum(xs) >= s : sum(xs) <= s;
    const c = countDice(2, pred);
    return { tpl: 'sum2', icon: '🎲', text: `Roll two dice: the total is ${kind === 0 ? `exactly ${s}` : kind === 1 ? `${s} or more` : `${s} or less`}.`, p: Qn(c, 36),
      why: `${c} of the 36 equally likely pairs give that total.`, trial: (g) => pred(rolls(g, 2)) };
  },
  (r) => {
    const kind = randInt(r, 0, 2), x = pick(r, [6, 8, 10, 12, 15, 18, 20]);
    const pred = (xs: number[]) => { const p = xs[0] * xs[1]; return kind === 0 ? p % 2 === 0 : kind === 1 ? p % 3 === 0 : p > x; };
    const c = countDice(2, pred);
    const what = kind === 0 ? 'is even' : kind === 1 ? 'is a multiple of 3' : `is more than ${x}`;
    return { tpl: 'product', icon: '✖️', text: `Roll two dice and multiply: the product ${what}.`, p: Qn(c, 36),
      why: kind === 0 ? 'It is odd only if both dice are odd (9 of 36), so even wins 27 of 36.' : `${c} of the 36 pairs give a product that ${what}.`, trial: (g) => pred(rolls(g, 2)) };
  },
  (r) => {
    const n = randInt(r, 4, 10), k = Math.round(n / 2) + randInt(r, -1, 1);
    return { tpl: 'coinsExact', icon: '🪙', text: `Flip ${n} coins and get exactly ${k} heads.`, p: Qn(choose(n, k), 2 ** n),
      why: `${choose(n, k)} of the ${2 ** n} head-tail sequences have exactly ${k} heads.`, trial: (g) => { let c = 0; for (let i = 0; i < n; i++) if (g() < 0.5) c++; return c === k; } };
  },
  (r) => {
    const n = randInt(r, 3, 9), k = randInt(r, 2, n - 1);
    let c = 0; for (let j = k; j <= n; j++) c += choose(n, j);
    return { tpl: 'coinsAtLeast', icon: '🪙', text: `Flip ${n} coins and get at least ${k} heads.`, p: Qn(c, 2 ** n),
      why: `${c} of the ${2 ** n} sequences have ${k} or more heads.`, trial: (g) => { let h = 0; for (let i = 0; i < n; i++) if (g() < 0.5) h++; return h >= k; } };
  },
  (r) => {
    const [what, pred] = pick(r, ONE_CARD);
    let c = 0; for (let i = 0; i < 52; i++) if (pred(i)) c++;
    return { tpl: 'card1', icon: '🃏', text: `Draw one card from a shuffled deck: it’s ${what}.`, p: Qn(c, 52),
      why: `${c} of the 52 cards count.`, trial: (g) => pred(Math.floor(g() * 52)) };
  },
  (r) => {
    const [what, pred, why] = pick(r, TWO_CARDS);
    let c = 0; for (let a = 0; a < 52; a++) for (let b = 0; b < 52; b++) if (a !== b && pred(a, b)) c++;
    return { tpl: 'card2', icon: '🃏', text: `Deal two cards from a shuffled deck: ${what}.`, p: Qn(c, 52 * 51), why, trial: (g) => { const [a, b] = drawK(g, 52, 2); return pred(a, b); } };
  },
  (r) => {
    const R = randInt(r, 2, 7), B = randInt(r, 2, 7), t = R + B, both = r() < 0.5;
    return { tpl: 'bag2', icon: '👜', text: `A bag has ${R} red and ${B} blue balls. Pull out 2 without looking: ${both ? 'both red' : 'one of each colour'}.`,
      p: both ? Qn(R * (R - 1), t * (t - 1)) : Qn(2 * R * B, t * (t - 1)),
      why: both ? `${R}/${t} for the first red, then ${R - 1}/${t - 1} for the second.` : `Red then blue or blue then red: 2 × ${R}/${t} × ${B}/${t - 1}.`,
      trial: (g) => { const [a, b] = drawK(g, t, 2); const ra = a < R, rb = b < R; return both ? ra && rb : ra !== rb; } };
  },
  (r) => {
    const R = randInt(r, 2, 6), B = randInt(r, 2, 6), t = R + B, both = r() < 0.5;
    return { tpl: 'bagBack', icon: '👜', text: `A bag has ${R} red and ${B} blue balls. Pull one, put it back, pull again: ${both ? 'red both times' : 'the same colour both times'}.`,
      p: both ? Qn(R * R, t * t) : Qn(R * R + B * B, t * t),
      why: both ? `Putting it back keeps it at ${R}/${t} each time: (${R}/${t})².` : `Both red (${R}/${t})² plus both blue (${B}/${t})².`,
      trial: (g) => { const a = g() * t < R, b = g() * t < R; return both ? a && b : a === b; } };
  },
  (r) => {
    const [who, m, how] = pick(r, [
      ['friends each name a random month', 12, 'month'], ['people each roll a die', 6, 'number'],
      ['people each pick a whole number from 1 to 10', 10, 'number'], ['people each pick a number from 1 to 20', 20, 'number'],
      ['friends each pick a random day of the week', 7, 'day'], ['people each pick a number from 1 to 30', 30, 'number'],
    ] as [string, number, string][]);
    const k = randInt(r, 2, Math.min(7, m - 1));
    let miss = 1n; for (let i = 0; i < k; i++) miss *= BigInt(m - i);
    const all = BigInt(m) ** BigInt(k);
    return { tpl: 'shared', icon: '🎂', text: `${k} ${who}: at least two land on the same ${how}.`, p: Qn(all - miss, all),
      why: `All different is ${m}/${m} × ${m - 1}/${m} × … (${k} terms); a match is 1 minus that. Matches come sooner than people expect.`,
      trial: (g) => { const seen = new Set<number>(); for (let i = 0; i < k; i++) { const x = Math.floor(g() * m); if (seen.has(x)) return true; seen.add(x); } return false; } };
  },
  (r) => {
    const b = randInt(r, 4, 20), n = randInt(r, 2, b);
    return { tpl: 'raffle', icon: '🎟️', text: `A weekly prize draw gives you a 1 in ${b} chance. Enter ${n} weeks and win at least once.`, p: oneMinusPow(b - 1, b, n),
      why: `Missing all ${n} weeks is (${b - 1}/${b})^${n}. Odds don’t simply add up: ${n} × 1/${b} would overcount.`,
      trial: (g) => { for (let i = 0; i < n; i++) if (g() * b < 1) return true; return false; } };
  },
  (r) => {
    const n = randInt(r, 2, 4);
    if (r() < 0.6) {
      const v = randInt(r, 4, 6);
      return { tpl: 'maxDice', icon: '🎲', text: `Roll ${n} dice: the highest one shows ${v === 6 ? 'a 6' : `${v} or more`}.`, p: oneMinusPow(v - 1, 6, n),
        why: `All ${n} dice below ${v} is (${v - 1}/6)^${n}; take that from 1.`, trial: (g) => Math.max(...rolls(g, n)) >= v };
    }
    const c = countDice(n, (xs) => new Set(xs).size === xs.length);
    return { tpl: 'maxDice', icon: '🎲', text: `Roll ${n} dice: every one shows a different number.`, p: Qn(c, 6 ** n),
      why: `6 × 5 × … choices for ${n} different faces, out of 6^${n} rolls.`, trial: (g) => new Set(rolls(g, n)).size === n };
  },
  (r) => {
    const n = randInt(r, 5, 14), k = randInt(r, 3, Math.min(5, n - 1));
    const c = runCount(n, k);
    return { tpl: 'run', icon: '🪙', text: `Flip ${n} coins in a row: somewhere there are ${k} heads in a row.`, p: Qn(c, 2 ** n),
      why: `Counting all ${2 ** n} sequences, ${c} contain a run of ${k} heads. Streaks turn up more than intuition says.`,
      trial: (g) => hasRun(Array.from({ length: n }, () => g() < 0.5), k) };
  },
  (r) => {
    const n = randInt(r, 1, 3), ties = r() < 0.4;
    const win = (xs: number[]) => { const me = Math.max(...xs.slice(1)); return ties ? me >= xs[0] : me > xs[0]; };
    const c = countDice(n + 1, win);
    return { tpl: 'duel', icon: '⚔️', text: `You roll ${n === 1 ? 'one die' : `${n} dice and keep the highest`}; a friend rolls one die. You win${ties ? ', and ties go to you' : ' only if strictly higher'}.`,
      p: Qn(c, 6 ** (n + 1)), why: `Checking all ${6 ** (n + 1)} equally likely rolls, you win in ${c}.`, trial: (g) => win(rolls(g, n + 1)) };
  },
  (r) => {
    const exact = r() < 0.5, s = exact ? randInt(r, 6, 15) : randInt(r, 10, 16);
    const pred = (xs: number[]) => exact ? sum(xs) === s : sum(xs) >= s;
    const c = countDice(3, pred);
    return { tpl: 'sum3', icon: '🎲', text: `Roll three dice: the total is ${exact ? `exactly ${s}` : `${s} or more`}.`, p: Qn(c, 216),
      why: `${c} of the 216 ways three dice can land give that total.`, trial: (g) => pred(rolls(g, 3)) };
  },
];

// ---------------------------------------------------------------- round

export interface Duel { a: Ev; b: Ev }
const ROUNDS = 6, GAP_LO = 0.02, GAP_HI = 0.15;
const gapOk = (a: Ev, b: Ev) => { const d = Math.abs(val(a.p) - val(b.p)); return d >= GAP_LO && d <= GAP_HI && a.p.n * b.p.d !== b.p.n * a.p.d; };
const inside = (e: Ev) => e.p.n > 0n && e.p.n < e.p.d;
/** Same template and same odds counts as a repeat (e.g. 4 red + 6 blue vs 6 red + 4 blue). */
const keys = (e: Ev) => [e.text, `${e.tpl}:${e.p.n}/${e.p.d}`];

export function makeRound(r: Rng): Duel[] {
  const out: Duel[] = [], texts = new Set<string>(), uses: Record<string, number> = {};
  for (let guard = 0; out.length < ROUNDS; guard++) {
    if (guard > 5000) throw new Error('could not build a round');
    const a = pick(r, T)(r);
    if (keys(a).some((x) => texts.has(x)) || (uses[a.tpl] ?? 0) >= 2 || !inside(a)) continue;
    for (let t = 0; t < 400; t++) {
      const b = pick(r, T)(r);
      if (b.tpl === a.tpl || keys(b).some((x) => texts.has(x)) || (uses[b.tpl] ?? 0) >= 2 || !inside(b) || !gapOk(a, b)) continue;
      out.push(r() < 0.5 ? { a, b } : { a: b, b: a });
      for (const e of [a, b]) { keys(e).forEach((x) => texts.add(x)); uses[e.tpl] = (uses[e.tpl] ?? 0) + 1; }
      break;
    }
  }
  return out;
}

/** Cross-check every template's exact odds against a simulation, once. */
let simChecked: string | null | undefined;
function crossCheck(): string | null {
  if (simChecked !== undefined) return simChecked;
  simChecked = null;
  const N = 4000;
  T.forEach((tpl, i) => {
    for (let s = 1; s <= 30 && !simChecked; s++) {
      const e = tpl(seeded(s * 7919 + i));
      const g = seeded(s * 104729 + i);
      let hit = 0; for (let k = 0; k < N; k++) if (e.trial(g)) hit++;
      const p = val(e.p), tol = 5 * Math.sqrt(p * (1 - p) / N) + 0.004;
      if (Math.abs(hit / N - p) > tol) simChecked = `template ${e.tpl} "${e.text}": exact ${p.toFixed(4)} vs simulated ${(hit / N).toFixed(4)}`;
    }
  });
  return simChecked;
}

function checkRound(seed: number): string | null {
  const ds = makeRound(seeded(seed));
  if (ds.length !== ROUNDS) return `${ds.length} duels`;
  const texts = new Set<string>();
  for (const { a, b } of ds) {
    for (const e of [a, b]) {
      if (!inside(e)) return `probability out of (0,1): ${e.text}`;
      if (keys(e).some((x) => texts.has(x))) return `duplicate event: ${e.text}`;
      keys(e).forEach((x) => texts.add(x));
    }
    if (!gapOk(a, b)) return `gap out of band or tie: ${a.text} vs ${b.text}`;
  }
  return crossCheck();
}

// ---------------------------------------------------------------- display

const showPct = (p: number) => { const v = p * 100; return (v < 1 ? v.toFixed(2) : v.toFixed(1)).replace(/\.0+$/, '') + '%'; };
const showFrac = (q: Q) => q.d <= 10_000_000n ? `${q.n}/${q.d}` : '';

const css = `

.g-odds .od-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 600; color: var(--muted); }
.g-odds .od-dots { display: flex; gap: 6px; }
.g-odds .od-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--line); }
.g-odds .od-dot.right { background: var(--good); } .g-odds .od-dot.wrong { background: var(--bad); } .g-odds .od-dot.now { background: var(--accent); }
.g-odds .od-q { font-size: 1.15rem; font-weight: 700; margin: 0 0 10px; text-align: center; }
.g-odds .od-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: stretch; }
.g-odds .od-ev { flex-direction: column; align-items: stretch; justify-content: flex-start; text-align: left; gap: 8px; min-height: 140px; padding: 14px 12px;
  background: var(--panel); color: var(--text); border: 2px solid var(--line); border-radius: 14px; font-size: 1rem; line-height: 1.35; }
.g-odds .od-ev:hover:not([disabled]) { border-color: var(--accent); }
.g-odds .od-ev[disabled] { opacity: 1; }
.g-odds .od-ev.right { border-color: var(--good); background: var(--good-bg); }
.g-odds .od-ev.wrong { border-color: var(--bad); background: var(--bad-bg); }
.g-odds .od-icon { font-size: 1.6rem; display: flex; align-items: center; gap: 6px; }
.g-odds .od-tag { font-size: .9rem; width: 1.6em; height: 1.6em; border-radius: 50%; display: grid; place-items: center; background: var(--panel2); color: var(--muted); }
.g-odds .od-p { font-size: 1.5rem; font-weight: 800; }
.g-odds .od-p small { font-size: .85rem; font-weight: 600; color: var(--muted); margin-left: 4px; }
.g-odds .od-bar { position: relative; height: 12px; border-radius: 6px; background: var(--panel2); overflow: visible; }
.g-odds .od-fill { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: var(--accent); opacity: .75; }
.g-odds .od-mark { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); }
.g-odds .od-sim { font-size: .82rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.g-odds .od-why { margin: 0 0 6px; }
.g-odds .od-btns { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap; }
.g-odds .od-btns button { min-height: 48px; min-width: 120px; }
@media (max-width: 420px) { .g-odds .od-ev { font-size: .95rem; padding: 12px 10px; } .g-odds .od-p { font-size: 1.3rem; } }
`;

const SIMS = 1000, SIM_MS = 1500;

export const odds: Game = {
  id: 'odds', title: 'Odds Duel', icon: '🎲', color: '#2fa37a',
  blurb: 'Two chances, one tap: which is more likely?',
  how: 'Each duel shows two chance events. Tap the one you think is **more likely**.\n\nThen see the exact odds and watch 1,000 simulated tries. Six duels a round.',
  course: 'probability',
  css,
  mount(el, api) {
    const duels = makeRound(api.rng);
    let i = 0, right = 0, streak = 0, best = 0, raf = 0;
    const marks: ('right' | 'wrong' | '')[] = duels.map(() => '');

    const show = () => {
      cancelAnimationFrame(raf);
      const d = duels[i], evs = [d.a, d.b];
      const better = Number(val(d.b.p) > val(d.a.p));
      const dots = h('div', { class: 'od-dots' }, ...marks.map((m, k) => h('span', { class: `od-dot ${m || (k === i ? 'now' : '')}` })));
      const head = h('div', { class: 'od-head' }, h('span', null, `Duel ${i + 1} of ${duels.length}`), dots);
      const cards = evs.map((e, k) => h('button', { class: 'od-ev', onclick: () => answer(k) }, h('span', { class: 'od-icon' }, h('b', { class: 'od-tag' }, k === 0 ? 'A' : 'B'), ' ', e.icon), h('span', null, e.text)));
      const after = h('div');
      el.replaceChildren(head, h('p', { class: 'od-q' }, 'Which is more likely?'), h('div', { class: 'od-pair' }, ...cards), after);

      const answer = (k: number) => {
        const ok = k === better;
        cards.forEach((c) => { c.disabled = true; });
        cards[k].classList.add(ok ? 'right' : 'wrong');
        if (!ok) cards[better].classList.add('right');
        marks[i] = ok ? 'right' : 'wrong';
        if (ok) { right++; streak++; best = Math.max(best, streak); } else streak = 0;
        dots.replaceChildren(...marks.map((m) => h('span', { class: `od-dot ${m}` })));

        // Reveal exact odds, then animate a seeded simulation tally in each card.
        const hits = evs.map((e) => { const xs: boolean[] = []; for (let t = 0; t < SIMS; t++) xs.push(e.trial(api.rng)); return xs; });
        const bars = evs.map((e, j) => {
          const p = val(e.p), f = showFrac(e.p);
          const fill = h('div', { class: 'od-fill', style: 'width:0' });
          const sim = h('div', { class: 'od-sim' }, 'Simulating…');
          cards[j].append(h('div', { class: 'od-p' }, showPct(p), f ? h('small', null, f) : null),
            h('div', { class: 'od-bar' }, fill, h('div', { class: 'od-mark', style: `left:${(p * 100).toFixed(2)}%` })), sim);
          return { fill, sim, xs: hits[j], c: 0, n: 0 };
        });
        const t0 = performance.now();
        const step = (now: number) => {
          const upto = Math.min(SIMS, Math.ceil((SIMS * (now - t0)) / SIM_MS));
          for (const b of bars) {
            while (b.n < upto) { if (b.xs[b.n]) b.c++; b.n++; }
            b.fill.style.width = `${((b.c / Math.max(1, b.n)) * 100).toFixed(1)}%`;
            b.sim.textContent = `${b.n.toLocaleString('en-US')} tries: ${b.c.toLocaleString('en-US')} hits (${showPct(b.c / Math.max(1, b.n))})`;
          }
          if (upto < SIMS) raf = requestAnimationFrame(step); else skip.remove();
        };
        raf = requestAnimationFrame(step);

        const last = i === duels.length - 1;
        const skip = h('button', { class: 'ghost', onclick: () => { cancelAnimationFrame(raf); step(t0 + SIM_MS); } }, 'Skip sim');
        const next = h('button', { class: 'primary', onclick: () => {
          if (!last) { i++; show(); return; }
          cancelAnimationFrame(raf);
          next.disabled = true; skip.remove();
          const score = Math.round((right * 100) / duels.length);
          api.finish(score, `You picked the likelier event in **${right} of ${duels.length}** duels${best >= 3 ? `, with a best streak of ${best} 🔥` : ''}.`);
        } }, last ? 'Finish' : 'Next duel');
        after.replaceChildren(
          h('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
            h('div', { class: 'fb-head' }, ok ? (streak >= 3 ? `Right! ${streak} in a row 🔥` : 'Right!') : 'Not this time.'),
            ...evs.map((e, j) => h('p', { class: 'od-why' }, h('strong', null, j === 0 ? 'A: ' : 'B: '), e.why))),
          h('div', { class: 'od-btns' }, skip, next));
        next.focus({ preventScroll: true });
      };
    };
    show();
    return () => cancelAnimationFrame(raf);
  },
  check: checkRound,
};
