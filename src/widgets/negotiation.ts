// Pictures and interactive pieces for the Negotiation course: the bargaining zone, offer sequences,
// multi-issue packages, "pick the best number" explorers and the shrinking pie of alternating offers.
import type { Layer, Widget } from '../types';
import { h, svg } from '../ui';
import { dataTable } from '../viz/charts';
import { explorer, plotExplorer, stepper } from '../viz/explore';
import { niceStep, plotEl } from '../viz/plot';

export const SELL = 'var(--c1)';
export const BUY = 'var(--c2)';
export const ZONE = 'var(--c3)';
export const MUTED = 'var(--muted)';

/** 7500 -> "$7,500", -40 -> "−$40", 41.666 -> "$41.67". */
export function money(v: number): string {
  const r = Math.round(v * 100) / 100;
  return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------- the bargaining zone

export interface ZopaOpts {
  /** Seller's minimum and buyer's maximum (reservation prices). */
  s: number;
  b: number;
  range?: [number, number];
  /** A proposed price: shows how the surplus splits. */
  price?: number;
  names?: [string, string];
}

/** A price line with the seller's minimum, the buyer's maximum and the zone between them. */
export function zopaPic(o: ZopaOpts): HTMLElement {
  const lo0 = Math.min(o.s, o.b), hi0 = Math.max(o.s, o.b);
  const [lo, hi] = o.range ?? [lo0 - (hi0 - lo0) * 0.6 - 1, hi0 + (hi0 - lo0) * 0.6 + 1];
  const [sName, bName] = o.names ?? ['Seller', 'Buyer'];
  const W = 520, H = 160, L = 24, R = 24, Y = 82;
  const px = (x: number) => L + ((x - lo) / (hi - lo)) * (W - L - R);
  const cx = (x: number) => Math.max(70, Math.min(W - 70, px(x)));
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' });
  el.style.maxWidth = `${W}px`;
  const ok = o.s <= o.b;
  el.appendChild(svg('rect', {
    x: px(lo0), y: Y - 11, width: Math.max(1, px(hi0) - px(lo0)), height: 22, rx: 4,
    style: `fill:${ok ? ZONE : 'var(--bad)'};opacity:${ok ? 0.35 : 0.22}`,
  }));
  el.appendChild(svg('line', { x1: L, y1: Y, x2: W - R, y2: Y, class: 'axis' }));
  const st = niceStep(hi - lo, 6);
  for (let t = Math.ceil(lo / st) * st; t <= hi + 1e-9; t += st) {
    el.appendChild(svg('line', { x1: px(t), y1: Y - 4, x2: px(t), y2: Y + 4, class: 'axis' }));
    el.appendChild(svg('text', { x: px(t), y: Y + 34, class: 'tick', 'text-anchor': 'middle' }, money(t)));
  }
  const mark = (x: number, color: string, label: string, above: boolean) => {
    el.appendChild(svg('line', { x1: px(x), y1: above ? Y - 40 : Y, x2: px(x), y2: above ? Y : Y + 16, style: `stroke:${color};stroke-width:3` }));
    el.appendChild(svg('text', { x: cx(x), y: above ? Y - 46 : Y + 58, 'text-anchor': 'middle', style: `fill:${color};font-weight:700;font-size:13px` }, label));
  };
  mark(o.s, SELL, `${sName}’s minimum ${money(o.s)}`, true);
  mark(o.b, BUY, `${bName}’s maximum ${money(o.b)}`, false);
  el.appendChild(svg('text', { x: px((lo0 + hi0) / 2), y: Y - 16, 'text-anchor': 'middle', class: 'tick', style: 'font-weight:700' },
    ok ? `ZOPA ${money(o.b - o.s)}` : `gap ${money(o.s - o.b)}: no deal`));
  if (o.price !== undefined) {
    el.appendChild(svg('circle', { cx: px(o.price), cy: Y, r: 7, style: 'fill:var(--text)' }));
  }
  return h('div', { class: 'plot-wrap' }, el);
}

/** Slide a price through the zone and watch the surplus split. With a goal it is a task. */
export function zopaExplorer(o: ZopaOpts & { range: [number, number]; step: number; start: number; goal?: (p: number) => boolean; goalText?: string }): Widget {
  const [sName, bName] = o.names ?? ['Seller', 'Buyer'];
  return explorer({
    params: [{ id: 'p', label: 'price', min: o.range[0], max: o.range[1], step: o.step, value: o.start, format: money }],
    draw: (v) => zopaPic({ ...o, price: v.p }),
    readout: (v) => {
      const gs = v.p - o.s, gb = o.b - v.p;
      if (gs < 0) return `At ${money(v.p)} the ${sName.toLowerCase()} is ${money(-gs)} worse off than walking away: no deal.`;
      if (gb < 0) return `At ${money(v.p)} the ${bName.toLowerCase()} is ${money(-gb)} worse off than walking away: no deal.`;
      return `${sName} gains ${money(gs)} · ${bName} gains ${money(gb)} · together ${money(gs + gb)}`;
    },
    goal: o.goal ? (v) => o.goal!(v.p) : undefined,
    goalText: o.goalText,
  });
}

// ---------------------------------------------------------------- offers over time

/** Two offer sequences converging over rounds (seller's asks falling, buyer's bids rising). */
export function offersPlot(asks: number[], bids: number[], o: { y: [number, number]; extra?: Layer[] } = { y: [0, 1] }): HTMLElement {
  const n = Math.max(asks.length, bids.length);
  const pts = (xs: number[]): [number, number][] => xs.map((v, i) => [i + 1, v]);
  const layers: Layer[] = [
    ...(o.extra ?? []),
    { type: 'line', pts: pts(asks), color: SELL, width: 2 },
    { type: 'dots', pts: pts(asks), color: SELL, labels: asks.map(money) },
    { type: 'line', pts: pts(bids), color: BUY, width: 2 },
    { type: 'dots', pts: pts(bids), color: BUY, labels: bids.map(money) },
  ];
  return h('div', null, plotEl({
    x: [0.5, n + 0.5], y: o.y, ticks: [1], size: [440, 270], xlabel: 'round', grid: true, layers,
    tickFormat: (v) => (v >= 100 ? money(v) : String(v)),
  }), h('div', { class: 'legend', style: 'justify-content:center' },
    asks.length ? h('span', { class: 'legend-item' }, h('i', { style: `background:${SELL}` }), 'seller’s asks') : null,
    bids.length ? h('span', { class: 'legend-item' }, h('i', { style: `background:${BUY}` }), 'buyer’s offers') : null));
}

// ---------------------------------------------------------------- best-number explorer

/**
 * Slide x and watch a payoff curve; the dot marks the current choice. With goal: true it is a task,
 * solved when x is within `near` of the grid point that maximises f.
 */
export function bestExplorer(o: {
  f: (x: number) => number; x: [number, number]; y: [number, number]; step: number; start: number;
  label: string; xlabel: string; ylabel: string; fmtX: (x: number) => string; readout: (x: number) => string;
  goal?: boolean; near?: number; goalText?: string; ticks?: [number, number];
}): Widget {
  let best = o.x[0];
  for (let x = o.x[0]; x <= o.x[1] + 1e-9; x += o.step) if (o.f(x) > o.f(best)) best = x;
  return plotExplorer({
    params: [{ id: 'x', label: o.label, min: o.x[0], max: o.x[1], step: o.step, value: o.start, format: o.fmtX }],
    spec: (v) => ({
      x: o.x, y: o.y, size: [440, 260], xlabel: o.xlabel, ylabel: o.ylabel, ticks: o.ticks,
      layers: [
        { type: 'fn', f: o.f, color: ZONE },
        { type: 'vline', x: v.x, color: MUTED, dash: true },
        { type: 'dots', pts: [[v.x, o.f(v.x)]], color: 'var(--text)', r: 6 },
      ],
    }),
    readout: (v) => o.readout(v.x),
    goal: o.goal ? (v) => Math.abs(v.x - best) <= (o.near ?? 0) + 1e-9 : undefined,
    goalText: o.goalText,
  });
}

// ---------------------------------------------------------------- several issues at once

export interface Issue {
  name: string;
  options: string[];
  /** Points for you and for them, per option. */
  you: number[];
  them: number[];
}

/** Pick one option per issue; see both sides' points. Solved when goal(you, them) holds. */
export function packageBuilder(issues: Issue[], goal: (you: number, them: number) => boolean, goalText: string): Widget {
  return (ctx) => {
    const pick = issues.map((is) => Math.floor(is.options.length / 2));
    const rows = h('div');
    const stats = h('div', { class: 'w-stats', style: 'justify-content:center' });
    const done = h('div', { class: 'goal-ok', hidden: true }, '✓ ', goalText);
    const draw = () => {
      rows.replaceChildren(...issues.map((is, i) => h('div', { style: 'margin:8px 0' },
        h('div', { class: 'muted small', style: 'font-weight:700' }, is.name),
        h('div', { class: 'w-btns' }, is.options.map((op, k) => h('button', {
          class: pick[i] === k ? 'primary' : 'ghost',
          onclick: () => { pick[i] = k; draw(); },
        }, `${op} (${is.you[k]} / ${is.them[k]})`))))));
      const you = issues.reduce((a, is, i) => a + is.you[pick[i]], 0);
      const them = issues.reduce((a, is, i) => a + is.them[pick[i]], 0);
      stats.replaceChildren(
        h('span', { style: `color:${SELL}` }, 'You ', h('strong', null, String(you))),
        h('span', { style: `color:${BUY}` }, 'Them ', h('strong', null, String(them))),
        h('span', null, 'Together ', h('strong', null, String(you + them))));
      const ok = goal(you, them);
      done.hidden = !ok;
      ctx.solved?.(ok);
    };
    draw();
    return h('div', null, h('div', { class: 'muted small' }, 'Points in brackets: (you / them)'), rows, stats, done);
  };
}

/** Points table of a multi-issue deal. */
export function issueTable(issues: Issue[]): HTMLElement {
  const rows: (string | number)[][] = [];
  for (const is of issues) is.options.forEach((op, k) => rows.push([k === 0 ? is.name : '', op, is.you[k], is.them[k]]));
  return dataTable(['Issue', 'Option', 'You', 'Them'], rows);
}

// ---------------------------------------------------------------- alternating offers

/**
 * What the first proposer keeps in each round of a T-round alternating-offers game over a pie that
 * shrinks by factor d per round. keep[t] = pie_t − keep[t+1]; in the last round the proposer keeps it all.
 */
export function proposerKeeps(pie: number, d: number, T: number): number[] {
  const keep: number[] = new Array(T);
  for (let t = T - 1; t >= 0; t--) {
    const size = pie * d ** t;
    keep[t] = t === T - 1 ? size : size - keep[t + 1];
  }
  return keep;
}

/** Step backwards through a T-round shrinking-pie game, filling in each round's split. */
export function pieRounds(pie: number, d: number, T: number, names: [string, string] = ['A', 'B']): Widget {
  return () => {
    const keep = proposerKeeps(pie, d, T);
    const r2 = (v: number) => money(v);
    return stepper(T + 1, (i) => {
      const known = (t: number) => t >= T - i;
      return dataTable(['Round', 'Proposer', 'Pie', `${names[0]} gets`, `${names[1]} gets`], Array.from({ length: T }, (_, t) => {
        const size = pie * d ** t, prop = t % 2 === 0 ? 0 : 1;
        const mine = keep[t], other = size - keep[t];
        const a = prop === 0 ? mine : other, b = prop === 0 ? other : mine;
        return [t + 1, names[prop], r2(size), known(t) ? r2(a) : '?', known(t) ? r2(b) : '?'];
      }), { highlight: i > 0 ? [T - i] : [] });
    }, {
      caption: (i) => {
        if (i === 0) return `Start at the end: round ${T} is take-it-or-leave-it.`;
        const t = T - i, prop = names[t % 2], resp = names[(t + 1) % 2];
        return t === T - 1
          ? `Round ${T}: ${prop} proposes and ${resp} must accept anything (rejecting leaves nothing). ${prop} keeps the whole ${r2(pie * d ** t)}.`
          : `Round ${t + 1}: ${resp} would get ${r2(keep[t + 1])} by rejecting and proposing next round, so ${prop} offers exactly that and keeps ${r2(keep[t])}.`;
      },
    });
  };
}
