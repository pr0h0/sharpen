// Interactive pieces for the Bayesian thinking course: frequency trees, a screening lab with
// sliders, an odds-and-evidence stacker and a mystery coin you can flip to update a belief.
import type { Widget } from '../types';
import { h, svg, num, pct } from '../ui';

const COL = { tp: '#e5534b', fn: '#f0a6a1', fp: '#f2a33a', tn: '#8b95a7', h: '#a371f7', nh: '#8b95a7' };

const txt = 'fill:var(--text)';
const mut = 'fill:var(--muted)';

/** "3 : 1" or "1 : 4" from odds as a single number. */
export function oddsStr(o: number): string {
  if (!Number.isFinite(o)) return 'certain';
  if (o === 0) return '0 : 1';
  return o >= 1 ? `${num(o)} : 1` : `1 : ${num(1 / o)}`;
}

function bar(p: number, a: string, b: string, la: string, lb: string): HTMLElement {
  return h('div', null,
    h('div', { class: 'split' },
      h('div', { style: `flex:${p};background:${a};transition:flex .3s` }),
      h('div', { style: `flex:${1 - p};background:${b};transition:flex .3s` })),
    h('div', { class: 'legend' },
      h('span', null, h('i', { style: `background:${a}` }), `${la}: ${pct(p)}`),
      h('span', null, h('i', { style: `background:${b}` }), `${lb}: ${pct(1 - p)}`)));
}

// ---------------------------------------------------------------- frequency tree

export interface TreeOpts {
  total: number;
  /** Share with the condition, sensitivity (share of them testing positive), false-positive rate. */
  base: number;
  sens: number;
  fpr: number;
  /** Names: who has it / who doesn't. */
  yes?: string;
  no?: string;
  /** What the root counts. */
  who?: string;
}

/** Natural-frequency tree: total -> has it / doesn't -> positive / negative, as counts. */
export function freqTree(o: TreeOpts): Widget {
  return () => {
    const yes = o.yes ?? 'have it', no = o.no ?? 'don’t';
    const sick = Math.round(o.total * o.base), well = o.total - sick;
    const tp = Math.round(sick * o.sens), fn = sick - tp;
    const fp = Math.round(well * o.fpr), tn = well - fp;
    const W = 360, H = 200;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;max-width:460px;display:block;margin:0 auto' });
    const node = (x: number, y: number, n: number, label: string, stroke = 'var(--line)') => {
      s.appendChild(svg('rect', { x: x - 42, y: y - 18, width: 84, height: 38, rx: 7, style: `fill:var(--panel2);stroke:${stroke};stroke-width:2` }));
      s.appendChild(svg('text', { x, y: y + 1, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, style: txt }, num(n)));
      s.appendChild(svg('text', { x, y: y + 14, 'text-anchor': 'middle', 'font-size': 9.5, style: mut }, label));
    };
    const edge = (x1: number, y1: number, x2: number, y2: number, label: string) => {
      s.appendChild(svg('line', { x1, y1: y1 + 20, x2, y2: y2 - 18, style: 'stroke:var(--muted);stroke-width:1.2;opacity:.6' }));
      const mx = (x1 + x2) / 2, my = (y1 + 20 + y2 - 18) / 2;
      s.appendChild(svg('text', { x: mx + (x2 < x1 ? -6 : 6), y: my + 3, 'text-anchor': x2 < x1 ? 'end' : 'start', 'font-size': 9.5, style: mut }, label));
    };
    const y0 = 22, y1 = 96, y2 = 172;
    edge(180, y0, 90, y1, pct(o.base));
    edge(180, y0, 270, y1, pct(1 - o.base));
    edge(90, y1, 45, y2, pct(o.sens));
    edge(90, y1, 135, y2, pct(1 - o.sens));
    edge(270, y1, 225, y2, pct(o.fpr));
    edge(270, y1, 315, y2, pct(1 - o.fpr));
    node(180, y0, o.total, o.who ?? 'people');
    node(90, y1, sick, yes);
    node(270, y1, well, no);
    node(45, y2, tp, 'test positive', COL.tp);
    node(135, y2, fn, 'test negative');
    node(225, y2, fp, 'test positive', COL.fp);
    node(315, y2, tn, 'test negative');
    return h('div', null, s,
      h('div', { class: 'w-stats', style: 'justify-content:center' },
        h('span', null, 'Positives: ', h('strong', null, num(tp + fp)), ` (${num(tp)} real, ${num(fp)} false alarms)`)));
  };
}

/** Task: fill in the counts of a frequency tree. */
export function treeFill(o: TreeOpts): Widget {
  return (ctx) => {
    const sick = o.total * o.base, well = o.total - sick;
    const want = [sick, well, sick * o.sens, sick * (1 - o.sens), well * o.fpr, well * (1 - o.fpr)];
    const yes = o.yes ?? 'have it', no = o.no ?? 'don’t';
    const labels = [yes, no, `${yes}, test +`, `${yes}, test −`, `${no}, test +`, `${no}, test −`];
    const vals: number[] = want.map(() => NaN);
    const box = (i: number) => h('label', { style: 'display:flex;flex-direction:column;gap:2px;font-size:.8rem;color:var(--muted);min-width:0' },
      labels[i],
      h('input', {
        class: 'num', inputmode: 'numeric', autocomplete: 'off',
        style: 'width:100%;font-size:1rem;padding:.35em .45em',
        oninput: (e: Event) => {
          vals[i] = Number((e.target as HTMLInputElement).value.replace(/,/g, '').trim() || 'NaN');
          ctx.solved?.(want.every((w, k) => Math.abs(vals[k] - w) < 0.5));
        },
      }));
    return h('div', null,
      h('div', { style: 'text-align:center;font-weight:700;margin-bottom:8px' }, `${num(o.total)} ${o.who ?? 'people'}`),
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px' }, box(0), box(1)),
      h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px' }, box(2), box(3), box(4), box(5)));
  };
}

// ---------------------------------------------------------------- screening lab

const BASES = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5];
const FPRS = [0, 0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3];

/** Sliders for base rate, sensitivity and false-positive rate; 1,000 people and the live posterior. */
/** A count of people: whole numbers as they are, others as "≈ 50" (expected counts can be fractional). */
const people = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : `≈ ${Math.round(x)}`);

export function bayesLab(start: { base: number; sens: number; fpr: number } = { base: 0.01, sens: 0.9, fpr: 0.05 }): Widget {
  return () => {
    let bi = Math.max(0, BASES.indexOf(start.base)), fi = Math.max(0, FPRS.indexOf(start.fpr)), sens = Math.round(start.sens * 100);
    const dotsBox = svg('svg', { viewBox: '0 0 322 202', class: 'dots' });
    const out = h('div');
    const lbl = [h('strong'), h('strong'), h('strong')];
    const slider = (i: number, name: string, max: number, value: number, set: (v: number) => void) =>
      h('label', { style: 'display:block;margin:4px 0' },
        h('div', { style: 'display:flex;justify-content:space-between;font-size:.95rem' }, h('span', null, name), lbl[i]),
        h('input', { type: 'range', min: '0', max: String(max), step: '1', value: String(value), style: 'width:100%;accent-color:#a371f7',
          oninput: (e: Event) => { set(Number((e.target as HTMLInputElement).value)); draw(); } }));
    const draw = () => {
      const b = BASES[bi], s = sens / 100, f = FPRS[fi];
      lbl[0].textContent = pct(b);
      lbl[1].textContent = pct(s, 0);
      lbl[2].textContent = pct(f);
      const sick = Math.round(1000 * b);
      const tp = Math.round(sick * s), fn = sick - tp;
      const fp = Math.round((1000 - sick) * f), tn = 1000 - sick - fp;
      dotsBox.replaceChildren();
      const groups: [number, string, number][] = [[tp, COL.tp, 1], [fn, COL.fn, 1], [fp, COL.fp, 1], [tn, COL.tn, 0.35]];
      let k = 0;
      for (const [n, c, op] of groups) for (let j = 0; j < n; j++, k++)
        dotsBox.appendChild(svg('circle', { cx: (k % 40) * 8 + 5, cy: Math.floor(k / 40) * 8 + 5, r: 3, fill: c, 'fill-opacity': op }));
      const truePos = b * s, falsePos = (1 - b) * f;
      const post = truePos + falsePos > 0 ? truePos / (truePos + falsePos) : 0;
      out.replaceChildren(
        h('div', { class: 'legend' },
          h('span', null, h('i', { style: `background:${COL.tp}` }), `have it, test + (${people(1000 * truePos)})`),
          h('span', null, h('i', { style: `background:${COL.fn}` }), `have it, test − (${people(1000 * b * (1 - s))})`),
          h('span', null, h('i', { style: `background:${COL.fp}` }), `don’t, test + (${people(1000 * falsePos)})`),
          h('span', null, h('i', { style: `background:${COL.tn};opacity:.5` }), 'don’t, test −')),
        h('div', { class: 'small muted', style: 'margin-top:10px' }, 'Among everyone who tests positive:'),
        bar(post, COL.tp, COL.fp, 'really have it', 'false alarms'),
        h('div', { class: 'w-stats', style: 'justify-content:center' },
          h('span', null, 'A positive means ', h('strong', null, pct(post)), ' chance of having it')));
    };
    const box = h('div', null,
      slider(0, 'Base rate (how common it is)', BASES.length - 1, bi, (v) => { bi = v; }),
      slider(1, 'Sensitivity (sick people caught)', 50, sens - 50, (v) => { sens = 50 + v; }),
      slider(2, 'False-positive rate (healthy flagged)', FPRS.length - 1, fi, (v) => { fi = v; }),
      h('div', { class: 'small muted', style: 'margin:8px 0 4px' }, '1,000 people tested (counts rounded to whole dots):'),
      dotsBox, out);
    draw();
    return box;
  };
}

// ---------------------------------------------------------------- odds stacker

export interface Clue { label: string; lr: number }

/** Start from a prior, switch pieces of evidence on and off, watch the odds multiply. */
export function oddsStacker(o: { prior: number; h: string; notH: string; clues: Clue[] }): Widget {
  return () => {
    const on = o.clues.map(() => false);
    const btns = h('div', { class: 'w-btns' });
    const out = h('div');
    const draw = () => {
      btns.replaceChildren(...o.clues.map((c, i) => h('button', {
        class: 'ghost',
        style: on[i] ? 'border-color:#a371f7;background:color-mix(in srgb,#a371f7 18%,var(--panel2))' : '',
        onclick: () => { on[i] = !on[i]; draw(); },
      }, `${on[i] ? '✓ ' : ''}${c.label} (×${num(c.lr)})`)));
      const prior = o.prior / (1 - o.prior);
      const lr = o.clues.reduce((m, c, i) => (on[i] ? m * c.lr : m), 1);
      const post = prior * lr;
      const p = post / (1 + post);
      out.replaceChildren(
        bar(p, COL.h, COL.nh, o.h, o.notH),
        h('div', { class: 'w-stats', style: 'justify-content:center' },
          h('span', null, 'Prior odds ', h('strong', null, oddsStr(prior))),
          h('span', null, '× evidence ', h('strong', null, num(lr))),
          h('span', null, '= ', h('strong', null, oddsStr(post))),
          h('span', null, 'that is ', h('strong', null, pct(p)))));
    };
    draw();
    return h('div', null, h('div', { class: 'small muted' }, 'Tap evidence to add or remove it:'), btns, out);
  };
}

// ---------------------------------------------------------------- mystery coin

/** A coin that is either fair or lands heads 75% of the time (50/50 prior). Flip it and update. */
export function mysteryCoin(): Widget {
  return () => {
    let biased = false, heads = 0, tails = 0, seq: string[] = [], shown = false;
    const row = h('div', { class: 'coin-row' });
    const out = h('div');
    const msg = h('div', { class: 'w-msg small muted' });
    const fresh = () => { biased = Math.random() < 0.5; heads = tails = 0; seq = []; shown = false; draw(); };
    const flip = (n: number) => {
      for (let k = 0; k < n; k++) {
        const hd = Math.random() < (biased ? 0.75 : 0.5);
        if (hd) heads++; else tails++;
        seq.push(hd ? 'H' : 'T');
      }
      draw();
    };
    const draw = () => {
      // Each head: 0.75/0.5 = 1.5 times as likely if biased. Each tail: 0.25/0.5 = 0.5.
      const odds = Math.pow(1.5, heads) * Math.pow(0.5, tails);
      const p = odds / (1 + odds);
      row.replaceChildren(...seq.slice(-24).map((x) => h('span', { class: `coin ${x === 'H' ? 'heads' : 'tails'}` }, x)));
      out.replaceChildren(
        bar(p, COL.h, COL.nh, 'biased (75% heads)', 'fair'),
        h('div', { class: 'w-stats', style: 'justify-content:center' },
          h('span', null, h('strong', null, String(heads)), ' heads'),
          h('span', null, h('strong', null, String(tails)), ' tails'),
          h('span', null, 'odds biased : fair ', h('strong', null, oddsStr(odds)))));
      msg.textContent = shown ? `It was the ${biased ? 'biased' : 'fair'} coin.` : 'Each head multiplies the odds of “biased” by 1.5; each tail halves them.';
    };
    fresh();
    return h('div', null,
      h('div', { class: 'w-btns' },
        h('button', { class: 'ghost', onclick: () => flip(1) }, 'Flip 1'),
        h('button', { class: 'ghost', onclick: () => flip(10) }, 'Flip 10'),
        h('button', { class: 'ghost', onclick: () => { shown = true; draw(); } }, 'Reveal'),
        h('button', { class: 'ghost', onclick: fresh }, 'New coin')),
      row, out, msg);
  };
}
