// Pictures for the Economic Thinking course: supply and demand plots, shifting curves, price
// controls, a revenue rectangle, a Pigouvian tax, a two-person island economy, a shared fishing lake
// and the lemons market. DOM/SVG only, theme colours via CSS vars.
import type { Layer, PlotSpec, Widget } from '../types';
import { h } from '../ui';
import { barChart, dataTable, stackBar } from '../viz/charts';
import { explorer, plotExplorer, stepper } from '../viz/explore';

export const DEM = 'var(--c1)';
export const SUP = 'var(--c2)';
export const POL = 'var(--c4)';
export const OK = 'var(--c3)';
export const MUTED = 'var(--muted)';

const n2 = (v: number) => String(+v.toFixed(2));

// ---------------------------------------------------------------- linear markets

/** Demand P = a − bQ, supply P = c + dQ. */
export interface Market { a: number; b: number; c: number; d: number }

/** The café market used throughout: demand P = 12 − Q, supply P = 2 + Q (Q in thousand cups a day). */
export const CAFE: Market = { a: 12, b: 1, c: 2, d: 1 };

export const demandAt = (m: Market, q: number) => m.a - m.b * q;
export const supplyAt = (m: Market, q: number) => m.c + m.d * q;
/** Quantity demanded / supplied at price p (never negative). */
export const qDemanded = (m: Market, p: number) => Math.max(0, (m.a - p) / m.b);
export const qSupplied = (m: Market, p: number) => Math.max(0, (p - m.c) / m.d);
export function equilibrium(m: Market): { q: number; p: number } {
  const q = (m.a - m.c) / (m.b + m.d);
  return { q, p: m.a - m.b * q };
}

/** A supply-and-demand plot of market m, with extra layers on top. */
export function marketSpec(m: Market, extra: Layer[] = [], o: { x?: [number, number]; y?: [number, number]; demand?: boolean; supply?: boolean; xlabel?: string } = {}): PlotSpec {
  const layers: Layer[] = [];
  if (o.demand !== false) layers.push({ type: 'fn', f: (q) => demandAt(m, q), color: DEM, label: 'Demand' });
  if (o.supply !== false) layers.push({ type: 'fn', f: (q) => supplyAt(m, q), color: SUP, label: 'Supply' });
  return {
    x: o.x ?? [0, 10], y: o.y ?? [0, 13], ticks: [1, 1], size: [400, 300],
    xlabel: o.xlabel ?? 'Q (thousand cups/day)', ylabel: 'price $', layers: [...layers, ...extra],
  };
}

/**
 * The café market with sliders that shift demand and/or supply sideways (by that many thousand
 * cups at every price). The original curves stay as faint dashed lines. With a goal it is a task.
 */
export function shiftExplorer(which: ('dD' | 'dS')[], goal?: (q: number, p: number) => boolean, goalText?: string): Widget {
  const params = which.map((id) => ({
    id, label: id === 'dD' ? 'demand shift' : 'supply shift', min: -3, max: 3, step: 0.5, value: 0,
    format: (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'),
  }));
  const eq = (v: Record<string, number>) => {
    const dD = v.dD ?? 0, dS = v.dS ?? 0;
    return { q: 5 + (dD + dS) / 2, p: 7 + (dD - dS) / 2 };
  };
  return plotExplorer({
    params,
    spec: (v) => {
      const dD = v.dD ?? 0, dS = v.dS ?? 0, e = eq(v);
      const layers: Layer[] = [];
      if (dD) layers.push({ type: 'fn', f: (q) => 12 - q, color: MUTED, dash: true, width: 1.5 });
      if (dS) layers.push({ type: 'fn', f: (q) => 2 + q, color: MUTED, dash: true, width: 1.5 });
      layers.push(
        { type: 'fn', f: (q) => 12 - (q - dD), color: DEM, label: 'Demand' },
        { type: 'fn', f: (q) => 2 + (q - dS), color: SUP, label: 'Supply' },
        { type: 'dots', pts: [[5, 7]], color: MUTED, r: 4 },
        { type: 'dots', pts: [[e.q, e.p]], color: 'var(--text)', r: 6 },
      );
      return { x: [0, 10], y: [0, 13], ticks: [1, 1], size: [400, 300], xlabel: 'Q (thousand cups/day)', ylabel: 'price $', layers };
    },
    readout: (v) => { const e = eq(v); return `Equilibrium: $${n2(e.p)}, ${n2(e.q)} thousand cups (started at $7, 5)`; },
    goal: goal ? (v) => { const e = eq(v); return goal(e.q, e.p); } : undefined,
    goalText,
  });
}

/** Slide a price ceiling over the café market; a binding ceiling shows the shortage. Goal: shortage of `target`. */
export function ceilingTask(target: number): Widget {
  const m = CAFE, e = equilibrium(m);
  return plotExplorer({
    params: [{ id: 'c', label: 'price ceiling', min: 2, max: 12, step: 0.5, value: 10, format: (v) => `$${n2(v)}` }],
    spec: (v) => {
      const binding = v.c < e.p;
      const qs = qSupplied(m, v.c), qd = qDemanded(m, v.c);
      const extra: Layer[] = [{ type: 'hline', y: v.c, color: POL, label: `ceiling $${n2(v.c)}` }];
      if (binding) {
        extra.push(
          { type: 'line', pts: [[qs, v.c], [qd, v.c]], color: 'var(--bad)', width: 5 },
          { type: 'dots', pts: [[qs, v.c], [qd, v.c]], color: 'var(--bad)' },
          { type: 'text', x: (qs + qd) / 2, y: v.c - 0.8, text: `shortage ${n2(qd - qs)}`, color: 'var(--bad)' },
        );
      } else extra.push({ type: 'dots', pts: [[e.q, e.p]], color: 'var(--text)', r: 6 });
      return marketSpec(m, extra);
    },
    readout: (v) => (v.c < e.p
      ? `At $${n2(v.c)}: buyers want ${n2(qDemanded(m, v.c))}, sellers offer ${n2(qSupplied(m, v.c))}. Shortage ${n2(qDemanded(m, v.c) - qSupplied(m, v.c))} thousand cups.`
      : `Ceiling above $7: not binding. The price stays $7 and there's no shortage.`),
    goal: (v) => v.c < e.p && Math.abs(qDemanded(m, v.c) - qSupplied(m, v.c) - target) < 1e-9,
    goalText: `A shortage of exactly ${target} thousand cups.`,
  });
}

/** Demand Q = 100 − 10P for cinema tickets; the revenue rectangle P × Q. Goal: the revenue-maximising price. */
export function revenueTask(): Widget {
  const Q = (p: number) => 100 - 10 * p;
  return plotExplorer({
    params: [{ id: 'p', label: 'ticket price', min: 0.5, max: 9.5, step: 0.5, value: 2, format: (v) => `$${n2(v)}` }],
    spec: (v) => {
      const q = Q(v.p);
      return {
        x: [0, 100], y: [0, 10.5], ticks: [20, 1], size: [400, 290], xlabel: 'tickets sold', ylabel: 'price $',
        layers: [
          { type: 'line', pts: [[0, 0], [q, 0], [q, v.p], [0, v.p]], closed: true, color: OK, width: 1.5, fill: 'color-mix(in srgb, var(--c3) 28%, transparent)' },
          { type: 'fn', f: (x) => (100 - x) / 10, color: DEM },
          { type: 'text', x: 15, y: 9.6, text: 'Demand', color: DEM, anchor: 'start' },
          { type: 'dots', pts: [[q, v.p]], color: 'var(--text)', r: 6 },
          { type: 'text', x: q / 2, y: v.p / 2, text: `$${n2(v.p * q)}`, color: 'var(--text)' },
        ],
      };
    },
    readout: (v) => `$${n2(v.p)} × ${n2(Q(v.p))} tickets = revenue $${n2(v.p * Q(v.p))}`,
    goal: (v) => Math.abs(v.p - 5) < 1e-9,
    goalText: 'The biggest rectangle: $5 × 50 = $250.',
  });
}

/**
 * Café market where each cup also costs neighbours $2 (litter, noise): social cost = supply + 2.
 * A per-unit tax shifts supply up. Goal: market quantity at the efficient 4 thousand cups.
 */
export function taxTask(): Widget {
  const ext = 2;
  return plotExplorer({
    params: [{ id: 't', label: 'tax per cup', min: 0, max: 5, step: 0.5, value: 0, format: (v) => `$${n2(v)}` }],
    spec: (v) => {
      const q = (10 - v.t) / 2, p = 12 - q;
      const layers: Layer[] = [
        { type: 'fn', f: (x) => 12 - x, color: DEM, label: 'Demand' },
        { type: 'fn', f: (x) => 2 + x, color: SUP, label: 'Supply' },
        { type: 'fn', f: (x) => 2 + ext + x, color: 'var(--bad)', dash: true, width: 2, label: v.t === ext ? undefined : 'Social cost', from: 0, to: 6.6 },
      ];
      if (v.t > 0) layers.push({ type: 'fn', f: (x) => 2 + v.t + x, color: POL, label: 'Supply + tax', from: 0, to: 7.4 });
      layers.push({ type: 'vline', x: q, color: MUTED, dash: true }, { type: 'dots', pts: [[q, p]], color: 'var(--text)', r: 6 });
      return { x: [0, 10], y: [0, 13], ticks: [1, 1], size: [400, 300], xlabel: 'Q (thousand cups/day)', ylabel: 'price $', layers };
    },
    readout: (v) => { const q = (10 - v.t) / 2; return `Tax $${n2(v.t)}: ${n2(q)} thousand cups, buyers pay $${n2(12 - q)}, sellers keep $${n2(12 - q - v.t)}`; },
    goal: (v) => Math.abs(v.t - ext) < 1e-9,
    goalText: 'Quantity 4: where demand meets the full social cost.',
  });
}

// ---------------------------------------------------------------- comparative advantage

/** Ana: 6 fish or 3 coconuts an hour; Ben: 1 fish or 2 coconuts. 8 hours each. */
export const ISLAND = { ana: { fish: 6, coco: 3 }, ben: { fish: 1, coco: 2 }, hours: 8 };

export function islandOutput(aFish: number, bFish: number) {
  const { ana, ben, hours } = ISLAND;
  const af = ana.fish * aFish, ac = ana.coco * (hours - aFish), bf = ben.fish * bFish, bc = ben.coco * (hours - bFish);
  return { af, ac, bf, bc, fish: af + bf, coco: ac + bc };
}

/** Split each person's 8 hours between fish and coconuts. Goal: at least `fish` fish and `coco` coconuts in total. */
export function tradeTask(fish: number, coco: number): Widget {
  return explorer({
    params: [
      { id: 'a', label: 'Ana: hours fishing', min: 0, max: 8, step: 1, value: 4 },
      { id: 'b', label: 'Ben: hours fishing', min: 0, max: 8, step: 1, value: 4 },
    ],
    draw: (v) => {
      const o = islandOutput(v.a, v.b);
      return h('div', null,
        dataTable(['', 'Fish', 'Coconuts'], [['Ana', o.af, o.ac], ['Ben', o.bf, o.bc], [h('strong', null, 'Total'), h('strong', null, String(o.fish)), h('strong', null, String(o.coco))]], { highlight: [2] }),
        barChart([
          { label: 'Fish', value: o.fish, color: o.fish >= fish ? OK : DEM, note: `(need ${fish})` },
          { label: 'Coconuts', value: o.coco, color: o.coco >= coco ? OK : SUP, note: `(need ${coco})` },
        ], { max: 56 }));
    },
    readout: () => 'Each works 8 hours. Splitting 4 and 4 each gives 28 fish and 20 coconuts.',
    goal: (v) => { const o = islandOutput(v.a, v.b); return o.fish >= fish && o.coco >= coco; },
    goalText: `${fish}+ fish and ${coco}+ coconuts: more of both than splitting evenly.`,
  });
}

// ---------------------------------------------------------------- price signal flow

const box = (text: string, color: string) => h('div', {
  style: `border:2px solid ${color};border-radius:10px;padding:6px 10px;background:var(--panel2);color:var(--text);font-size:.92rem;text-align:center;`,
}, text);
const arrow = () => h('div', { style: 'color:var(--muted);font-size:1.2rem;text-align:center;line-height:1' }, '↓');

/** Frost → price up → buyers and sellers each react, without knowing why. */
export function signalFlow(): HTMLElement {
  return h('div', { style: 'display:flex;flex-direction:column;gap:6px;max-width:380px;margin:0 auto' },
    box('Frost destroys oranges in one region', 'var(--muted)'),
    arrow(),
    box('Price of orange juice rises', POL),
    arrow(),
    h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' },
      box('Buyers: use less, switch to apple', DEM),
      box('Sellers elsewhere: ship more oranges here', SUP)),
    h('div', { class: 'muted small', style: 'text-align:center' }, 'Nobody needs to know about the frost: the price carries the news.'));
}

// ---------------------------------------------------------------- the commons

/**
 * A shared lake of up to 100 fish and four boats (you and three others). Each season you choose a
 * catch; the other boats copy what you caught last season (they start at 8). The fish left grow by
 * half, up to 100. Goal: catch at least `goal` fish yourself over 8 seasons.
 */
export function fishery(goal = 60): Widget {
  return (ctx) => {
    const K = 100, G = 1.5, SEASONS = 8, OTHERS = 3;
    let stock = K, season = 0, mine = 0, last = 8;
    let log: string[] = [];
    const lake = h('div', { style: 'height:22px;border-radius:6px;background:var(--panel2);border:1px solid var(--line);overflow:hidden' });
    const status = h('div', { class: 'readout' });
    const logBox = h('div', { class: 'muted small', style: 'min-height:4.2em;line-height:1.4' });
    const btns = [4, 8, 12].map((c) => h('button', { class: 'ghost', onclick: () => play(c) }, `Catch ${c}`));
    const reset = h('button', { class: 'ghost', onclick: () => { stock = K; season = 0; mine = 0; last = 8; log = []; draw(); } }, 'Reset');
    const draw = () => {
      const pct = Math.max(0, Math.min(100, (stock / K) * 100));
      const col = stock > 60 ? OK : stock > 25 ? 'var(--c5)' : 'var(--bad)';
      lake.replaceChildren(h('div', { style: `height:100%;width:${pct}%;background:${col};transition:width .3s` }));
      const over = season >= SEASONS;
      status.textContent = over
        ? `Done: you caught ${mine} fish over ${SEASONS} seasons; the lake has ${stock} left.`
        : `Season ${season + 1} of ${SEASONS} · lake: ${stock} fish · your catch so far: ${mine}`;
      logBox.replaceChildren(...log.slice(-3).map((l) => h('div', null, l)));
      btns.forEach((b) => { b.disabled = over; });
      ctx.solved?.(over && mine >= goal);
    };
    const play = (c: number) => {
      if (season >= SEASONS) return;
      const each = last, want = c + OTHERS * each;
      let got = c, theirs = each;
      if (want > stock) { got = Math.floor((stock * c) / want); theirs = Math.floor((stock * each) / want); }
      const before = stock, left = stock - got - OTHERS * theirs;
      stock = Math.min(K, Math.floor(left * G));
      mine += got;
      season++;
      log.push(before === 0 ? `Season ${season}: the lake is empty. Nothing to catch.`
        : `Season ${season}: you ${got}, others ${theirs} each; ${left} left, regrew to ${stock}.`);
      last = c;
      draw();
    };
    draw();
    return h('div', null,
      h('div', { class: 'muted small', style: 'margin-bottom:4px' }, '🐟 Lake (max 100). The fish left after fishing grow by half. The other 3 boats copy your last catch (they start at 8).'),
      lake, status, h('div', { class: 'w-btns', style: 'justify-content:center' }, btns, reset), logBox);
  };
}

// ---------------------------------------------------------------- lemons

/** The unravelling of a used-car market when buyers can't tell good cars from lemons. */
export function lemonsStepper(): HTMLElement {
  const frames: { good: number; lemon: number; cap: string }[] = [
    { good: 50, lemon: 50, cap: 'For sale: 50 good cars (worth $10,000 to a buyer) and 50 lemons (worth $4,000). Buyers can’t tell them apart, so they offer the average: $7,000.' },
    { good: 50, lemon: 50, cap: 'Good-car owners won’t sell for less than $8,000. At $7,000 they keep their cars.' },
    { good: 0, lemon: 50, cap: 'Only lemons are left. Buyers expect this, so offers fall to $4,000.' },
    { good: 0, lemon: 50, cap: 'Good cars never trade, though a buyer would pay $10,000 and the owner would take $8,000. A deal both want is lost to missing information.' },
  ];
  return stepper(frames.length, (i) => {
    const f = frames[i];
    return h('div', null, stackBar([
      { label: 'Good cars', value: f.good, color: OK },
      { label: 'Lemons', value: f.lemon, color: 'var(--c5)' },
    ], { format: (v) => String(v) }),
    h('div', { class: 'readout' }, `Buyers offer: $${['7,000', '7,000', '4,000', '4,000'][i]}`));
  }, { caption: (i) => frames[i].cap });
}
