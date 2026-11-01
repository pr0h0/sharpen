// Interactive pieces for the decisions course: a decision tree that folds back, a bankroll
// simulator, a stake-size finder, a growth curve, a value-of-information explorer, the luck grid
// and a calibration quiz.
import type { Widget } from '../types';
import { h, svg, pct, shuffle } from '../ui';

const COLOURS = ['#4f8cff', '#f2a33a', '#43b581', '#e5534b', '#a371f7', '#2fb6c9'];

/** "$1,250", "−$200", "$0.37" */
export function money(v: number): string {
  const a = Math.round(Math.abs(v) * 100) / 100;
  const digits = a < 1000 && Math.abs(a - Math.round(a)) > 1e-9 ? 2 : 0;
  return (v < -1e-9 ? '−$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const textStyle = 'fill: var(--text); font-size: 11px;';
const mutedStyle = 'fill: var(--muted); font-size: 10px;';

// ---------------------------------------------------------------- decision tree

export interface TreeOpts {
  sureLabel: string;
  sure: number;
  riskyLabel: string;
  upLabel: string;
  win: number;
  downLabel: string;
  lose: number;
  /** Starting probability of the good outcome. */
  p: number;
}

/** A two-option tree (sure thing vs gamble). Drag the chance and watch it fold back. */
export function decisionTree(o: TreeOpts): Widget {
  return () => {
    let p = o.p;
    const W = 380, H = 190;
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const stats = h('div', { class: 'w-stats' });
    const slider = h('input', { type: 'range', min: 0, max: 100, step: 1, value: String(Math.round(p * 100)), class: 'est' }) as HTMLInputElement;
    const lab = h('div', { class: 'muted small' });
    const draw = () => {
      const ev = p * o.win + (1 - p) * o.lose;
      const riskyBest = ev > o.sure + 1e-9;
      const tie = Math.abs(ev - o.sure) < 1e-9;
      const best = Math.max(ev, o.sure);
      const on = 'stroke: var(--accent-default); stroke-width: 4;';
      const off = 'stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 4 4;';
      const plain = 'stroke: var(--muted); stroke-width: 1.5;';
      chart.replaceChildren(
        // root (choice) to the sure leaf and to the chance node
        svg('line', { x1: 30, y1: 95, x2: 200, y2: 40, style: tie || !riskyBest ? on : off }),
        svg('line', { x1: 30, y1: 95, x2: 130, y2: 140, style: tie || riskyBest ? on : off }),
        svg('line', { x1: 150, y1: 140, x2: 250, y2: 115, style: plain }),
        svg('line', { x1: 150, y1: 140, x2: 250, y2: 170, style: plain }),
        svg('rect', { x: 10, y: 85, width: 20, height: 20, rx: 3, style: 'fill: var(--panel); stroke: var(--text); stroke-width: 1.5;' }),
        svg('circle', { cx: 140, cy: 140, r: 10, style: 'fill: var(--panel); stroke: var(--text); stroke-width: 1.5;' }),
        svg('text', { x: 8, y: 76, style: textStyle + ' font-weight: 700;' }, `best ${money(best)}`),
        svg('text', { x: 92, y: 58, style: mutedStyle }, o.sureLabel),
        svg('text', { x: 50, y: 132, style: mutedStyle }, o.riskyLabel),
        svg('text', { x: 206, y: 44, style: textStyle }, `${money(o.sure)} for sure`),
        svg('text', { x: 256, y: 119, style: textStyle }, `${o.upLabel} ${pct(p, 0)}: ${money(o.win)}`),
        svg('text', { x: 256, y: 174, style: textStyle }, `${o.downLabel} ${pct(1 - p, 0)}: ${money(o.lose)}`),
        svg('text', { x: 140, y: 166, 'text-anchor': 'middle', style: textStyle + ' font-weight: 700;' }, `EV ${money(ev)}`));
      lab.textContent = `Chance of ${o.upLabel.toLowerCase()}: ${pct(p, 0)}`;
      stats.replaceChildren(
        h('span', null, o.riskyLabel, ' averages ', h('strong', null, money(ev))),
        h('span', null, 'Best choice: ', h('strong', null, tie ? 'either' : riskyBest ? o.riskyLabel : o.sureLabel)));
    };
    slider.addEventListener('input', () => { p = Number(slider.value) / 100; draw(); });
    draw();
    return h('div', { class: 'w-tree' }, chart, lab, slider, stats,
      h('div', { class: 'muted small' }, 'Square: your choice (take the best branch). Circle: chance (take the average).'));
  };
}

// ---------------------------------------------------------------- bankroll simulator

export interface BankrollOpts {
  /** Chance of winning each round. */
  p: number;
  /** Net odds: a win pays b × stake (1 = even money). */
  b: number;
  /** Stake sizes to choose from, as fractions of the current bankroll. */
  fractions: number[];
  rounds?: number;
  paths?: number;
  start?: number;
}

/** Repeat a favourable bet, staking a fixed fraction each round. Plots several runs on a log scale. */
export function bankrollSim(o: BankrollOpts): Widget {
  return () => {
    const rounds = o.rounds ?? 100, paths = o.paths ?? 5, start = o.start ?? 100;
    let f = o.fractions[0];
    const W = 320, H = 170, lo = -2, hi = 6; // log10 of $0.01 .. $1,000,000
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const stats = h('div', { class: 'w-stats' });
    const y = (v: number) => {
      if (v <= 0) return H;
      const t = (Math.log10(v) - lo) / (hi - lo);
      return Math.max(0, Math.min(H, H - t * H));
    };
    const btns = o.fractions.map((fr) => h('button', { class: 'ghost', onclick: () => { f = fr; run(); } }, `Stake ${pct(fr, 0)}`));
    const run = () => {
      btns.forEach((b, k) => b.setAttribute('style', o.fractions[k] === f ? 'border-color: var(--accent-default); font-weight: 700;' : ''));
      const kids: SVGElement[] = [];
      for (const [v, label] of [[1e6, '$1M'], [1e4, '$10k'], [start, `$${start}`], [1, '$1']] as [number, string][]) {
        kids.push(svg('line', { x1: 0, x2: W, y1: y(v), y2: y(v), class: v === start ? 'axis-mid' : '', style: v === start ? '' : 'stroke: var(--line);' }));
        kids.push(svg('text', { x: 4, y: y(v) < 14 ? y(v) + 12 : y(v) - 3, class: 'axis-label' }, label));
      }
      const finals: number[] = [];
      for (let k = 0; k < paths; k++) {
        let m = start;
        const pts = [`0,${y(m)}`];
        for (let r = 1; r <= rounds; r++) {
          const stake = m * f;
          m += Math.random() < o.p ? stake * o.b : -stake;
          if (m < 1e-9) m = 0;
          pts.push(`${(r / rounds) * W},${y(m)}`);
          if (m === 0) break;
        }
        finals.push(m);
        kids.push(svg('polyline', { points: pts.join(' '), style: `fill: none; stroke: ${COLOURS[k % COLOURS.length]}; stroke-width: 2; opacity: .85;` }));
      }
      chart.replaceChildren(...kids);
      const sorted = finals.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const up = finals.filter((v) => v > start).length;
      const broke = finals.filter((v) => v < 1).length;
      stats.replaceChildren(
        h('span', null, 'Middle run ends at ', h('strong', null, money(median))),
        h('span', null, h('strong', null, `${up} of ${paths}`), ' runs ahead'),
        h('span', null, h('strong', null, String(broke)), ' under $1'));
    };
    run();
    return h('div', { class: 'w-bankroll' },
      h('div', { class: 'w-btns' }, btns, h('button', { class: 'ghost', onclick: () => run() }, 'Run again')),
      chart, stats,
      h('div', { class: 'muted small' }, `${paths} runs of ${rounds} rounds from $${start}. Log scale: each grid line is 100× the one below.`));
  };
}

// ---------------------------------------------------------------- stake size

/** Long-run growth per round when staking fraction f: p·ln(1 + b·f) + q·ln(1 − f). */
export function growth(p: number, b: number, f: number): number {
  return p * Math.log(1 + b * f) + (1 - p) * Math.log(1 - f);
}

/** Task: hunt for the stake that grows a $100 bankroll fastest over 100 typical rounds. */
export function stakeFinder(p: number, b: number, target: number): Widget {
  return (ctx) => {
    const slider = h('input', { type: 'range', min: 0, max: 60, step: 1, value: '50', class: 'est' }) as HTMLInputElement;
    const big = h('div', { class: 'est-value' });
    const stats = h('div', { class: 'w-stats' });
    const draw = () => {
      const f = Number(slider.value) / 100;
      const end = 100 * Math.exp(100 * growth(p, b, f));
      big.textContent = `Stake ${pct(f, 0)}`;
      stats.replaceChildren(h('span', null, `Win exactly ${Math.round(p * 100)} of 100 rounds and $100 becomes `, h('strong', null, money(end))));
      ctx.solved?.(Math.abs(f - target) <= 0.02 + 1e-9);
    };
    slider.addEventListener('input', draw);
    draw();
    return h('div', { class: 'w-stake' }, big, slider, h('div', { class: 'est-ends' }, h('span', null, '0%'), h('span', null, '60%')), stats);
  };
}

/** The growth curve: typical growth per round against the fraction staked, with marked points. */
export function growthCurve(p: number, b: number, fmax = 0.6, marks: number[] = []): Widget {
  return () => {
    const W = 320, H = 160, padB = 18;
    const n = 120;
    const pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
      const f = (k / n) * fmax;
      pts.push([f, Math.exp(growth(p, b, f)) - 1]);
    }
    const ys = pts.map((q) => q[1]);
    const ymax = Math.max(...ys, 0) * 1.4 + 1e-6, ymin = Math.min(...ys, 0) * 1.1 - 1e-6;
    const X = (f: number) => (f / fmax) * W;
    const Y = (g: number) => (H - padB) * (1 - (g - ymin) / (ymax - ymin));
    const kids: SVGElement[] = [
      svg('line', { x1: 0, x2: W, y1: Y(0), y2: Y(0), class: 'axis-mid' }),
      svg('text', { x: W - 4, y: Y(0) - 4, 'text-anchor': 'end', class: 'axis-label' }, 'no growth'),
      svg('polyline', { points: pts.map(([f, g]) => `${X(f)},${Y(g)}`).join(' '), class: 'line' }),
    ];
    for (let t = 0; t <= fmax + 1e-9; t += 0.1) {
      const anchor = t < 1e-9 ? 'start' : t > fmax - 0.05 ? 'end' : 'middle';
      kids.push(svg('text', { x: anchor === 'start' ? 2 : anchor === 'end' ? W - 2 : X(t), y: H - 4, 'text-anchor': anchor, class: 'axis-label' }, pct(t, 0)));
    }
    const rate = (m: number) => { const g = Math.exp(growth(p, b, m)) - 1; return `${g >= 0 ? '+' : '−'}${pct(Math.abs(g), 1)}`; };
    marks.forEach((m, k) => kids.push(svg('circle', { cx: X(m), cy: Y(Math.exp(growth(p, b, m)) - 1), r: 4, style: `fill: ${COLOURS[(k + 1) % COLOURS.length]};` })));
    return h('div', { class: 'w-growth' }, svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' }, ...kids),
      h('div', { class: 'w-stats' }, marks.map((m, k) => h('span', null,
        h('i', { style: `display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; background: ${COLOURS[(k + 1) % COLOURS.length]};` }),
        `Stake ${pct(m, 0)}: `, h('strong', null, rate(m)), ' per round'))),
      h('div', { class: 'muted small' }, 'Typical growth per round (vertical) against the share of your bankroll you stake (horizontal).'));
  };
}

// ---------------------------------------------------------------- value of information

/** Launch or not: gain `gain` on success, lose `loss` on a flop. Slide the chance of success. */
export function infoValue(gain: number, loss: number, p0: number): Widget {
  return () => {
    let p = p0;
    const W = 320, H = 130;
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const stats = h('div', { class: 'w-stats' });
    const lab = h('div', { class: 'muted small' });
    const slider = h('input', { type: 'range', min: 0, max: 100, step: 1, value: String(Math.round(p * 100)), class: 'est' }) as HTMLInputElement;
    const evpi = (q: number) => q * gain - Math.max(0, q * gain - (1 - q) * loss);
    const peak = evpi(loss / (gain + loss));
    const Y = (v: number) => H - 16 - (v / peak) * (H - 32);
    const draw = () => {
      const now = Math.max(0, p * gain - (1 - p) * loss);
      const full = p * gain;
      const pts: string[] = [];
      for (let k = 0; k <= 100; k++) pts.push(`${(k / 100) * W},${Y(evpi(k / 100))}`);
      chart.replaceChildren(
        svg('line', { x1: 0, x2: W, y1: Y(0), y2: Y(0), class: 'axis-mid' }),
        svg('polyline', { points: pts.join(' '), class: 'line' }),
        svg('circle', { cx: p * W, cy: Y(evpi(p)), r: 5, style: 'fill: #f2a33a;' }),
        svg('text', { x: 4, y: 12, class: 'axis-label' }, 'value of knowing for sure'),
        svg('text', { x: 4, y: H - 4, class: 'axis-label' }, '0%'),
        svg('text', { x: W - 30, y: H - 4, class: 'axis-label' }, '100%'));
      lab.textContent = `Chance of success: ${pct(p, 0)} (decide now: ${p * gain - (1 - p) * loss > 0 ? 'launch' : 'don’t launch'})`;
      stats.replaceChildren(
        h('span', null, 'Decide now: ', h('strong', null, money(now))),
        h('span', null, 'Decide knowing: ', h('strong', null, money(full))),
        h('span', null, 'Knowing is worth ', h('strong', null, money(full - now))));
    };
    slider.addEventListener('input', () => { p = Number(slider.value) / 100; draw(); });
    draw();
    return h('div', { class: 'w-info' }, chart, lab, slider, stats);
  };
}

// ---------------------------------------------------------------- luck grid

/** The 2 × 2 of decision quality against outcome. */
export function luckGrid(): Widget {
  const cell = (head: string, text: string, bg: string) => h('div', {
    style: `background: ${bg}; border-radius: 10px; padding: 10px 12px; border: 1px solid var(--line);`,
  }, h('div', { style: 'font-weight: 700;' }, head), h('div', { class: 'muted small' }, text));
  return () => h('div', { class: 'w-luck' },
    h('div', { style: 'display: grid; grid-template-columns: auto 1fr 1fr; gap: 8px; align-items: stretch;' },
      h('div'), h('div', { class: 'muted small', style: 'text-align: center;' }, 'Good outcome'), h('div', { class: 'muted small', style: 'text-align: center;' }, 'Bad outcome'),
      h('div', { class: 'muted small', style: 'align-self: center;' }, 'Good decision'),
      cell('Deserved', 'Sound reasoning, and it paid off.', 'var(--good-bg)'),
      cell('Bad luck', 'Sound reasoning; the dice went against you.', 'var(--shown-bg)'),
      h('div', { class: 'muted small', style: 'align-self: center;' }, 'Bad decision'),
      cell('Dumb luck', 'Poor reasoning, rescued by chance. The dangerous one.', 'var(--panel2)'),
      cell('Comeuppance', 'Poor reasoning, and it showed.', 'var(--bad-bg)')));
}

// ---------------------------------------------------------------- calibration quiz

const CLAIMS: [string, boolean][] = [
  ['Mount Everest is more than 8,000 metres tall.', true],
  ['Sharks are mammals.', false],
  ['Venus is the hottest planet in the Solar System.', true],
  ['Botanically, bananas are berries.', true],
  ['Light from the Sun takes about 8 minutes to reach Earth.', true],
  ['Octopuses have three hearts.', true],
  ['The Great Wall of China is easily visible with the naked eye from the Moon.', false],
  ['Lightning never strikes the same place twice.', false],
  ['The Pacific Ocean covers more area than all of Earth’s land put together.', true],
  ['Non-bird dinosaurs and humans lived at the same time.', false],
  ['Goldfish have a memory span of only three seconds.', false],
  ['Australia is wider from east to west than the Moon is across.', true],
  ['Bats are blind.', false],
  ['Water boils at a lower temperature on a high mountain than at sea level.', true],
];

/** True or false, with a confidence. Scores you (Brier) and shows how often each confidence was right. */
export function calibrationQuiz(n = 8): Widget {
  return () => {
    const levels = [0.1, 0.3, 0.5, 0.7, 0.9];
    let items: [string, boolean][] = [];
    let k = 0;
    let scores: number[] = [];
    let picks: [number, boolean][] = []; // confidence that it's true, truth
    const box = h('div');
    const start = () => {
      items = shuffle(Math.random, CLAIMS).slice(0, n);
      k = 0;
      scores = [];
      picks = [];
      ask();
    };
    const ask = () => {
      if (k >= items.length) return summary();
      const [claim] = items[k];
      box.replaceChildren(
        h('div', { class: 'muted small' }, `Claim ${k + 1} of ${items.length}`),
        h('div', { class: 'w-msg', style: 'font-weight: 600;' }, claim),
        h('div', { class: 'muted small' }, 'How likely is it to be true?'),
        h('div', { class: 'w-btns' }, levels.map((c) => h('button', { class: 'ghost', onclick: () => answer(c) }, pct(c, 0)))));
    };
    const answer = (c: number) => {
      const truth = items[k][1];
      const s = (c - (truth ? 1 : 0)) ** 2;
      scores.push(s);
      picks.push([c, truth]);
      box.replaceChildren(
        h('div', { class: 'w-msg', style: 'font-weight: 600;' }, items[k][0]),
        h('div', { class: 'w-msg' }, `It’s ${truth ? 'true' : 'false'}. You said ${pct(c, 0)}: score (${c.toFixed(1)} − ${truth ? 1 : 0})² = ${s.toFixed(2)}.`),
        h('div', { class: 'w-btns' }, h('button', { class: 'ghost', onclick: () => { k++; ask(); } }, k + 1 < items.length ? 'Next claim' : 'See results')));
    };
    const summary = () => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      // Fold each answer into "how sure of my answer was I" (50–90%) and whether that answer was right.
      const rows = [0.5, 0.7, 0.9].map((conf) => {
        const hits = picks.filter(([c]) => Math.abs(Math.max(c, 1 - c) - conf) < 1e-9);
        const right = hits.filter(([c, t]) => (c > 0.5) === t).length;
        return { conf, n: hits.length, right };
      }).filter((r) => r.n > 0);
      box.replaceChildren(
        h('div', { class: 'w-msg' }, 'Average score: ', h('strong', null, avg.toFixed(3)),
          avg < 0.25 ? ' (better than always saying 50%, which scores 0.25)' : ' (no better than always saying 50%, which scores 0.25)'),
        h('div', { class: 'w-stats' }, rows.map((r) => h('span', null,
          `When ${r.conf === 0.5 ? 'unsure (50%)' : `${pct(r.conf, 0)} sure`}: `, h('strong', null, r.conf === 0.5 ? `${r.n} claim${r.n === 1 ? '' : 's'}` : `${r.right} of ${r.n} right`)))),
        h('div', { class: 'w-btns' }, h('button', { class: 'ghost', onclick: start }, 'Try a new set')));
    };
    start();
    return h('div', { class: 'w-calib' }, box);
  };
}
