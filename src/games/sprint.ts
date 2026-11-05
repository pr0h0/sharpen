// Mental Sprint: 60 seconds of arithmetic that gets harder as you go. The day's questions are
// generated up front from the seed, so everyone faces the same list in the same order.
import type { Game } from './game';
import type { Rng } from '../types';
import { gcd, h, pick, randInt, seeded } from '../ui';

const SECONDS = 60;
const COUNT = 80;
/** Correct answers for a full 100. A steady adult lands around 20–30 on this mix. */
const FULL = 30;

// Tiers in the order they appear, and how many questions each gets (sums to COUNT).
const TIERS = [
  { kind: 'Addition', n: 8, make: (r: Rng) => { const a = randInt(r, 2, 12), b = randInt(r, 2, 12); return [`${a} + ${b}`, a + b] as const; } },
  { kind: 'Subtraction', n: 8, make: (r: Rng) => { const a = randInt(r, 11, 30), b = randInt(r, 2, Math.min(15, a - 1)); return [`${a} − ${b}`, a - b] as const; } },
  { kind: 'Times tables', n: 12, make: (r: Rng) => { const a = randInt(r, 2, 9), b = randInt(r, 2, 9); return [`${a} × ${b}`, a * b] as const; } },
  { kind: 'Two-digit + and −', n: 12, make: (r: Rng) => {
    const a = randInt(r, 21, 89), b = randInt(r, 12, 79);
    return r() < 0.5 ? [`${a} + ${b}`, a + b] as const : [`${Math.max(a, b)} − ${Math.min(a, b)}`, Math.abs(a - b)] as const;
  } },
  { kind: 'Division', n: 12, make: (r: Rng) => { const b = randInt(r, 2, 9), q = randInt(r, 2, 12); return [`${b * q} ÷ ${b}`, q] as const; } },
  { kind: 'Bigger products', n: 12, make: (r: Rng) => { const a = randInt(r, 12, 49), b = randInt(r, 3, 9); return [`${a} × ${b}`, a * b] as const; } },
  { kind: 'Percentages', n: 16, make: (r: Rng) => {
    const p = pick(r, [10, 20, 25, 50, 75]);
    const step = 100 / gcd(p, 100); // smallest whole that gives a whole answer
    const x = step * randInt(r, Math.ceil(20 / step), Math.floor(800 / step));
    return [`${p}% of ${x}`, (p * x) / 100] as const;
  } },
];

export interface Q { text: string; answer: number; tier: number; kind: string }

export function makeQuestions(rng: Rng): Q[] {
  const out: Q[] = [];
  TIERS.forEach((t, tier) => {
    for (let i = 0; i < t.n; i++) {
      let q: readonly [string, number];
      do q = t.make(rng); while (out.length && out[out.length - 1].text === q[0]);
      out.push({ text: q[0], answer: q[1], tier, kind: t.kind });
    }
  });
  return out;
}

export const scoreFor = (correct: number) => Math.min(100, Math.round((correct * 100) / FULL));

export const sprint: Game = {
  id: 'sprint', title: 'Mental Sprint', icon: '⚡', color: '#d9a520',
  blurb: 'Sixty seconds of quick sums, getting harder as you go.',
  how: `Tap **Start**, then answer as many as you can in ${SECONDS} seconds. Type with the pad or your keyboard: a right answer moves on by itself.\n\nStuck? **Skip** (or Enter) costs only time. ${FULL} right answers is a full 100.`,
  course: 'math-thinking',
  css: `
.g-sprint { touch-action: manipulation; }
.g-sprint .s-wrap { max-width: 420px; margin: 0 auto; }
.g-sprint .s-start { text-align: center; padding: 28px 16px; }
.g-sprint .s-start button { min-height: 56px; min-width: 200px; font-size: 1.2rem; }
.g-sprint .s-bar { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-variant-numeric: tabular-nums; }
.g-sprint .s-time { font-size: 1.4rem; }
.g-sprint .s-time.low { color: var(--bad); }
.g-sprint .s-meter { height: 6px; background: var(--panel2); border-radius: 99px; overflow: hidden; margin: 6px 0 8px; }
.g-sprint .s-meter i { display: block; height: 100%; background: var(--accent); }
.g-sprint .s-q { text-align: center; font-size: 2.4rem; font-weight: 800; font-variant-numeric: tabular-nums; margin: 6px 0; white-space: nowrap; }
.g-sprint .s-ans { text-align: center; font-size: 2.2rem; font-weight: 700; min-height: 1.6em; margin: 0 auto 12px; padding: 0 .4em; border-radius: 12px; border: 2px solid var(--line); background: var(--panel); font-variant-numeric: tabular-nums; max-width: 240px; transition: border-color .15s, background .15s; }
.g-sprint .s-ans.good { border-color: var(--good); background: var(--good-bg); }
.g-sprint .s-ans.bad { border-color: var(--bad); background: var(--bad-bg); }
.g-sprint .s-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.g-sprint .s-pad button { min-height: 54px; font-size: 1.6rem; font-weight: 700; padding: 0; background: var(--panel); color: var(--text); border: 2px solid var(--line); }
.g-sprint .s-pad button.s-fn { font-size: 1.05rem; background: var(--panel2); }
.g-sprint .s-kind { text-align: center; color: var(--muted); font-size: .85rem; font-weight: 600; }
`,
  mount(el, api) {
    const qs = makeQuestions(api.rng);
    let i = 0, typed = '', correct = 0, skipped = 0, t0 = 0, qStart = 0, over = false;
    let timer: ReturnType<typeof setInterval> | undefined, flash: ReturnType<typeof setTimeout> | undefined;
    const spent = new Map<string, { ms: number; n: number }>();

    const timeEl = h('span', { class: 's-time' }, `${SECONDS}s`);
    const scoreEl = h('span', null, '0 right');
    const meter = h('i', { style: 'width:100%' });
    const kindEl = h('div', { class: 's-kind' });
    const qEl = h('div', { class: 's-q', 'aria-live': 'polite' });
    const ansEl = h('div', { class: 's-ans', 'aria-label': 'Your answer' });
    const key = (label: string, fn: () => void, cls = '') => h('button', { class: cls, onclick: fn }, label);
    const pad = h('div', { class: 's-pad' },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => key(String(d), () => digit(String(d)))),
      key('⌫', back, 's-fn'), key('0', () => digit('0')), key('Skip', skip, 's-fn'));
    const play = h('div', { class: 's-wrap' }, h('div', { class: 's-bar' }, timeEl, scoreEl), h('div', { class: 's-meter' }, meter), kindEl, qEl, ansEl, pad);
    const start = h('div', { class: 'card s-start' },
      h('p', null, `${SECONDS} seconds. Answers move on by themselves.`),
      h('button', { class: 'primary', onclick: begin }, 'Start'));
    el.append(h('div', { class: 's-wrap' }, start));

    function begin() {
      el.replaceChildren(play);
      requestAnimationFrame(() => play.scrollIntoView({ block: 'end' }));
      t0 = qStart = performance.now();
      show();
      timer = setInterval(tick, 100);
      window.addEventListener('keydown', onKey);
    }

    function show() {
      const q = qs[i];
      qEl.textContent = q.text;
      kindEl.textContent = q.kind;
      typed = '';
      ansEl.textContent = '';
      ansEl.classList.remove('bad');
    }

    function log() {
      const now = performance.now(), s = spent.get(qs[i].kind) ?? { ms: 0, n: 0 };
      s.ms += now - qStart; s.n++;
      spent.set(qs[i].kind, s);
      qStart = now;
    }

    function next() {
      log();
      i++;
      if (i >= qs.length) return end();
      show();
    }

    function digit(d: string) {
      if (over || typed.length >= 6) return;
      clearTimeout(flash);
      ansEl.classList.remove('bad', 'good');
      typed += d;
      ansEl.textContent = typed;
      const ans = String(qs[i].answer);
      if (typed === ans) {
        correct++;
        scoreEl.textContent = `${correct} right`;
        ansEl.classList.add('good');
        flash = setTimeout(() => ansEl.classList.remove('good'), 180);
        next();
      } else if (typed.length >= ans.length) {
        // as long as the answer and still wrong: show it, then clear for another go
        typed = '';
        ansEl.classList.add('bad');
        flash = setTimeout(() => { ansEl.textContent = ''; ansEl.classList.remove('bad'); }, 350);
      }
    }

    function back() { if (over) return; typed = typed.slice(0, -1); ansEl.textContent = typed; ansEl.classList.remove('bad'); }
    function skip() { if (over) return; skipped++; next(); }

    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) digit(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') skip();
      else return;
      e.preventDefault();
    }

    function tick() {
      const left = Math.max(0, SECONDS - (performance.now() - t0) / 1000);
      timeEl.textContent = `${Math.ceil(left)}s`;
      timeEl.classList.toggle('low', left <= 10);
      meter.style.width = `${(left / SECONDS) * 100}%`;
      if (left <= 0) end();
    }

    function end() {
      if (over) return;
      over = true;
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      pad.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      qEl.textContent = 'Time!';
      kindEl.textContent = '';
      // slowest kind: average time per finished question, among kinds seen at least twice
      const kinds = [...spent].filter(([, s]) => s.n >= 2).map(([k, s]) => [k, s.ms / s.n / 1000] as const).sort((a, b) => b[1] - a[1]);
      const slow = kinds.length >= 2 ? ` Slowest: **${kinds[0][0].toLowerCase()}** (${kinds[0][1].toFixed(1)} s each).` : '';
      api.finish(scoreFor(correct), `**${correct}** right, ${skipped} skipped in ${SECONDS} seconds.${slow}`);
    }

    return () => { over = true; clearInterval(timer); clearTimeout(flash); window.removeEventListener('keydown', onKey); };
  },
  check(seed) {
    const qs = makeQuestions(seeded(seed));
    if (qs.length !== COUNT) return `${qs.length} questions, want ${COUNT}`;
    for (let k = 0; k < qs.length; k++) {
      const q = qs[k];
      if (!Number.isInteger(q.answer) || q.answer < 0) return `${q.text} = ${q.answer} is not a whole number`;
      if (k && qs[k - 1].text === q.text) return `${q.text} twice in a row`;
      if (k && qs[k - 1].tier > q.tier) return `difficulty drops at question ${k + 1}`;
    }
    if (qs[0].tier !== 0 || qs[COUNT - 1].tier !== TIERS.length - 1) return 'tiers not all used';
    return null;
  },
};
