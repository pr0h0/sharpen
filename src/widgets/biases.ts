// Interactive pieces for the Thinking Errors course: the 2-4-6 rule game, the returning
// bombers, a skill-plus-luck regression simulator, a framing pair and a 90% range quiz.
import type { Widget } from '../types';
import { h, svg, num, parseNumber, seeded } from '../ui';

const RED = '#e5534b', BLUE = '#4f8cff', GREY = '#8b95a7';

// ---------------------------------------------------------------- 2-4-6 rule game

/** Wason's 2-4-6 task: propose triples, see whether they fit, then name the rule. */
export function ruleGame(): Widget {
  return (ctx) => {
    const fits = (t: number[]) => t[0] < t[1] && t[1] < t[2];
    const log: { t: number[]; ok: boolean }[] = [{ t: [2, 4, 6], ok: true }];
    let done = false, shown = false;
    const ins = [0, 1, 2].map((k) => h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'num', placeholder: '?',
      style: 'width:5em;font-size:1.1rem;padding:.35em .5em',
      onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { if (k < 2) ins[k + 1].focus(); else test(); } },
    }));
    const list = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px' });
    const stats = h('div', { class: 'w-stats' });
    const msg = h('div', { class: 'w-msg' });
    const guesses = h('div', { class: 'w-btns' });
    const RULES: [string, boolean][] = [
      ['Each number is 2 more than the last', false],
      ['Even numbers, going up in twos', false],
      ['The third number is the sum of the first two', false],
      ['Any three numbers in increasing order', true],
      ['Any three different numbers', false],
    ];

    const test = () => {
      if (done) return;
      const t = ins.map((i) => parseNumber(i.value));
      if (t.some((x) => !Number.isFinite(x))) { msg.textContent = 'Enter three numbers first.'; return; }
      log.push({ t, ok: fits(t) });
      msg.textContent = fits(t) ? `${t.map((x) => num(x)).join(', ')}: yes, that fits the rule.` : `${t.map((x) => num(x)).join(', ')}: no, that doesn’t fit.`;
      ins.forEach((i) => { i.value = ''; });
      ins[0].focus();
      draw();
    };

    const draw = () => {
      list.replaceChildren(...log.map((e) => h('span', {
        style: `padding:.2em .6em;border-radius:8px;font-weight:600;background:var(${e.ok ? '--good-bg' : '--bad-bg'});color:var(${e.ok ? '--good' : '--bad'})`,
      }, `${e.t.map((x) => num(x)).join(', ')} ${e.ok ? '✓' : '✗'}`)));
      const tests = log.length - 1;
      const noes = log.filter((e) => !e.ok).length;
      const notPlus2 = log.slice(1).filter((e) => !(e.t[1] - e.t[0] === 2 && e.t[2] - e.t[1] === 2)).length;
      stats.replaceChildren(
        h('span', null, h('strong', null, String(tests)), ' tests'),
        h('span', null, h('strong', null, String(noes)), ' got a “no”'),
        h('span', null, h('strong', null, String(notPlus2)), ' didn’t go up in twos'));
      if (tests >= 3 && !shown) {
        shown = true;
        guesses.replaceChildren(h('div', { class: 'muted small', style: 'width:100%' }, 'Ready? The rule is:'),
          ...RULES.map(([text, right]) => h('button', { class: 'ghost', onclick: (e: Event) => guess(e.currentTarget as HTMLButtonElement, right) }, text)));
      } else if (tests < 3) {
        guesses.replaceChildren(h('div', { class: 'muted small' }, `Test at least ${3 - tests} more triple${3 - tests === 1 ? '' : 's'} before you name the rule.`));
      }
    };

    const guess = (btn: HTMLButtonElement, right: boolean) => {
      if (done) return;
      if (right) {
        done = true;
        btn.style.borderColor = 'var(--good)';
        guesses.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        msg.textContent = 'Yes: any three numbers that go up. That’s all it was.';
        ctx.solved?.(true);
      } else {
        btn.disabled = true;
        msg.textContent = 'Not that rule. It agrees with your tests so far, so find a triple that rule says should get a “no”, and test it.';
        ctx.solved?.(false);
      }
    };

    draw();
    return h('div', { class: 'w-rule' },
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
        ...ins, h('button', { class: 'ghost', onclick: test }, 'Test')),
      list, stats, msg, guesses);
  };
}

// ---------------------------------------------------------------- returning bombers

/** A bomber seen from above, with the bullet holes found on planes that made it home. */
export function bomber(): Widget {
  return () => {
    const W = 300, H = 220;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'A returning bomber: holes on wings, body and tail, none on the engines' });
    const engines = [70, 108, 192, 230];
    s.append(
      svg('polygon', { points: '150,84 288,104 288,118 150,113 12,118 12,104', fill: GREY }),
      svg('polygon', { points: '150,178 205,194 205,203 150,199 95,203 95,194', fill: GREY }),
      svg('ellipse', { cx: 150, cy: 112, rx: 15, ry: 96, fill: GREY }),
      svg('ellipse', { cx: 150, cy: 30, rx: 8, ry: 10, fill: '#5d6779' }),
      ...engines.map((x) => svg('circle', { cx: x, cy: 104, r: 9, fill: '#5d6779' })));
    const rng = seeded(11);
    const holes: [number, number][] = [];
    while (holes.length < 22) { // wings, away from engines and body
      const x = 18 + rng() * 264, y = 104 + rng() * 9;
      if (Math.abs(x - 150) < 20 || engines.some((e) => Math.abs(e - x) < 16)) continue;
      holes.push([x, y]);
    }
    for (let k = 0; k < 16; k++) holes.push([143 + rng() * 14, 50 + rng() * 120]); // body
    for (let k = 0; k < 7; k++) holes.push([102 + rng() * 96, 195 + rng() * 4]); // tail
    for (const [x, y] of holes) s.appendChild(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 2.6, fill: RED }));
    s.append(
      svg('text', { x: 70, y: 84, 'text-anchor': 'middle', class: 'axis-label', style: 'fill:var(--muted);font-size:10px' }, 'engine'),
      svg('text', { x: 230, y: 84, 'text-anchor': 'middle', class: 'axis-label', style: 'fill:var(--muted);font-size:10px' }, 'engine'));
    return h('div', { class: 'w-bomber' }, s,
      h('div', { class: 'legend' },
        h('span', null, h('i', { style: `background:${RED}` }), 'bullet holes on planes that came back'),
        h('span', null, h('i', { style: 'background:#5d6779' }), 'engines')));
  };
}

// ---------------------------------------------------------------- regression simulator

function normal(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

/** 100 players, score = skill + luck. Pick round 1's top and bottom 10 and watch round 2. */
export function regressionSim(): Widget {
  return () => {
    let luck = 10;
    const W = 320, H = 240, lo = 10, hi = 90;
    const X = (v: number) => 24 + ((v - lo) / (hi - lo)) * (W - 32);
    const Y = (v: number) => H - 20 - ((v - lo) / (hi - lo)) * (H - 28);
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const stats = h('div', { style: 'margin-top:8px' });
    const label = h('div', { class: 'muted small' });
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const run = () => {
      const ps = Array.from({ length: 100 }, () => {
        const skill = 50 + 8 * normal();
        return { r1: skill + luck * normal(), r2: skill + luck * normal() };
      });
      const sorted = ps.slice().sort((a, b) => b.r1 - a.r1);
      const top = new Set(sorted.slice(0, 10)), bottom = new Set(sorted.slice(-10));
      const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
      chart.replaceChildren(
        svg('line', { x1: X(lo), y1: Y(lo), x2: X(hi), y2: Y(hi), class: 'axis-mid' }),
        svg('text', { x: W - 4, y: H - 6, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:10px' }, 'round 1 →'),
        svg('text', { x: 4, y: 12, style: 'fill:var(--muted);font-size:10px' }, '↑ round 2'),
        svg('text', { x: X(hi) - 4, y: Y(hi) + 14, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:10px' }, 'same score both rounds'),
        ...ps.map((p) => svg('circle', {
          cx: X(clamp(p.r1)).toFixed(1), cy: Y(clamp(p.r2)).toFixed(1), r: top.has(p) || bottom.has(p) ? 3.5 : 2.5,
          fill: top.has(p) ? RED : bottom.has(p) ? BLUE : GREY, 'fill-opacity': top.has(p) || bottom.has(p) ? 1 : 0.45,
        })));
      const t = [...top], b = [...bottom];
      const row = (color: string, name: string, xs: typeof t) => h('div', { class: 'w-stats', style: 'margin-top:2px' },
        h('span', null, h('i', { style: `display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:5px` }), name),
        h('span', null, 'round 1 ', h('strong', null, num(mean(xs.map((p) => p.r1)), 3))),
        h('span', null, '→ round 2 ', h('strong', null, num(mean(xs.map((p) => p.r2)), 3))));
      stats.replaceChildren(row(RED, 'Top 10', t), row(BLUE, 'Bottom 10', b),
        h('div', { class: 'w-stats', style: 'margin-top:2px' }, h('span', null, 'Everyone’s average skill: ', h('strong', null, '50'))));
      label.textContent = `Luck: ${luck === 4 ? 'small' : luck === 10 ? 'about as big as skill differences' : 'bigger than skill differences'}. Each round is a fresh draw of luck; skill stays the same.`;
    };
    const set = (l: number) => { luck = l; run(); };
    run();
    return h('div', { class: 'w-regress' },
      h('div', { class: 'w-btns' },
        h('button', { class: 'ghost', onclick: () => set(4) }, 'Mostly skill'),
        h('button', { class: 'ghost', onclick: () => set(10) }, 'Skill and luck'),
        h('button', { class: 'ghost', onclick: () => set(20) }, 'Mostly luck'),
        h('button', { class: 'ghost', onclick: run }, 'Play again')),
      label, chart, stats);
  };
}

// ---------------------------------------------------------------- framing pair

export interface Frame {
  text: string;
  options: [string, string];
}

/** Two descriptions of the same choice, one after the other. Options line up: first ≡ first. */
export function framePair(first: Frame, second: Frame, note: string): Widget {
  return (ctx) => {
    const picks: number[] = [];
    const box = h('div');
    const show = () => {
      const f = picks.length === 0 ? first : second;
      if (picks.length < 2) {
        box.replaceChildren(
          h('div', { class: 'muted small' }, picks.length === 0 ? 'Situation 1 of 2' : 'Situation 2 of 2: same outbreak, another committee'),
          h('p', { style: 'margin:.4em 0' }, f.text),
          h('div', { class: 'w-btns' }, f.options.map((o, k) => h('button', { class: 'ghost', style: 'text-align:left', onclick: () => { picks.push(k); show(); } }, o))));
        return;
      }
      const same = picks[0] === picks[1];
      box.replaceChildren(
        h('p', { style: 'margin:.2em 0' }, `You chose “${first.options[picks[0]]}”, then “${second.options[picks[1]]}”.`),
        h('p', { style: 'margin:.2em 0' }, same
          ? 'You chose consistently. Look closely, though: the two situations were the same choice in different words.'
          : 'You switched. Look closely: the two situations were the same choice in different words.'),
        h('p', { class: 'muted small', style: 'margin:.2em 0' }, note));
      ctx.solved?.(true);
    };
    show();
    return h('div', { class: 'w-frames' }, box);
  };
}

// ---------------------------------------------------------------- 90% ranges

export interface RangeQ {
  q: string;
  answer: number;
  unit?: string;
  /** A year: show without a thousands separator. */
  year?: boolean;
}

/** Give a low and high value you're 90% sure brackets each answer; then see how many you caught. */
export function rangeQuiz(qs: RangeQ[]): Widget {
  return (ctx) => {
    const rows = qs.map((q) => {
      const mk = (ph: string) => h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'num', placeholder: ph, style: 'width:6.5em;font-size:1rem;padding:.3em .5em' });
      const lo = mk('low'), hi = mk('high');
      const res = h('div', { class: 'small', style: 'min-height:1.2em' });
      const el = h('div', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' },
        h('div', null, q.q),
        h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px' }, lo, h('span', { class: 'muted' }, 'to'), hi, q.unit ? h('span', { class: 'muted small' }, q.unit) : null),
        res);
      return { q, lo, hi, res, el };
    });
    const msg = h('div', { class: 'w-msg' });
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      const vals = rows.map((r) => [parseNumber(r.lo.value), parseNumber(r.hi.value)]);
      if (vals.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b))) { msg.textContent = 'Fill in a low and a high for every question first. Wide is allowed!'; return; }
      if (vals.some(([a, b]) => a > b)) { msg.textContent = 'Each low should be no bigger than its high.'; return; }
      revealed = true;
      let hits = 0;
      rows.forEach((r, k) => {
        const [a, b] = vals[k];
        const hit = a <= r.q.answer && r.q.answer <= b;
        if (hit) hits++;
        r.lo.disabled = r.hi.disabled = true;
        r.res.replaceChildren(h('span', { style: `font-weight:700;color:var(${hit ? '--good' : '--bad'})` }, hit ? '✓ caught it: ' : '✗ missed: '),
          `the answer is ${r.q.year ? String(r.q.answer) : num(r.q.answer)}${r.q.unit ? ' ' + r.q.unit : ''}.`);
      });
      const expect = num(qs.length * 0.9, 2);
      msg.replaceChildren(h('strong', null, `Your ranges caught ${hits} of ${qs.length}.`),
        ` Truly 90%-sure ranges would catch about ${expect} on average.`);
      btn.disabled = true;
      ctx.solved?.(true);
    };
    const btn = h('button', { class: 'ghost', onclick: reveal }, 'Reveal the answers');
    return h('div', { class: 'w-ranges' }, ...rows.map((r) => r.el), h('div', { class: 'w-btns', style: 'margin-top:10px' }, btn), msg);
  };
}
