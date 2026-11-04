// Business by the Numbers: the formulas behind the course (profit, break-even, margins, unit
// economics, discounts, cash timing, churn, discounting) and a few pictures built on them.
// Every number in the course is computed from these; all businesses are small and hypothetical.
import type { Layer, PlotSpec, Widget } from '../types';
import { h } from '../ui';
import { dataTable } from '../viz/charts';
import { plotExplorer } from '../viz/explore';

// ---------------------------------------------------------------- formatting

/** Money: whole dollars print without cents ("$6,000"), others with ("$4.50"); negatives "−$1,500". */
export function money(v: number): string {
  const r = Math.round(v * 100) / 100;
  const whole = Math.abs(r - Math.round(r)) < 1e-9;
  const s = Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return (r < 0 ? '−$' : '$') + s;
}
/** Money rounded to whole dollars. */
export const dollars = (v: number) => money(Math.round(v));
/** 0.4 -> "40%", 0.3333 -> "33.3%". */
export function pc(r: number, digits = 1): string {
  const v = r * 100;
  return (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(digits)) + '%';
}
/** A count with thousands separators, rounded. */
export const count = (v: number) => Math.round(v).toLocaleString('en-US');

// ---------------------------------------------------------------- formulas

/** Profit of selling q units at price p, variable cost v each, with fixed costs F. */
export const profit = (p: number, v: number, F: number, q: number) => (p - v) * q - F;
/** Units needed to cover fixed costs (and an optional profit target). */
export const breakEven = (F: number, p: number, v: number, target = 0) => (F + target) / (p - v);
/** Margin = profit share of the price; markup = profit as a share of the cost. */
export const margin = (cost: number, price: number) => (price - cost) / price;
export const markup = (cost: number, price: number) => (price - cost) / cost;
export const marginFromMarkup = (k: number) => k / (1 + k);
export const markupFromMargin = (m: number) => m / (1 - m);
/** Degree of operating leverage: % change in profit per 1% change in volume. */
export const leverage = (p: number, v: number, F: number, q: number) => ((p - v) * q) / profit(p, v, F, q);

/** Volume multiplier needed to keep gross profit after a discount d (share of price) on margin m. */
export const discountVolume = (m: number, d: number) => m / (m - d);
/** Volume multiplier that keeps gross profit after a price rise u on margin m (below 1: you can lose some). */
export const riseVolume = (m: number, u: number) => m / (m + u);

/** Average customer lifetime in periods at a constant churn rate per period. */
export const lifetime = (churn: number) => 1 / churn;
/** Lifetime value in gross profit. */
export const ltv = (price: number, gm: number, churn: number) => (price * gm) / churn;
/** Months of gross profit to earn back the acquisition cost. */
export const payback = (cac: number, price: number, gm: number) => cac / (price * gm);
/** Share of a cohort still there after n periods. */
export const retained = (churn: number, n: number) => (1 - churn) ** n;
/** Customers after t periods, starting from zero, adding `add` and losing `churn` of the base each period. */
export const customersAt = (add: number, churn: number, t: number) => (add / churn) * (1 - (1 - churn) ** t);

/** Present value of `cf` received in n years at discount rate r. */
export const pv = (cf: number, r: number, n: number) => cf / (1 + r) ** n;
/** Value of a cash flow `cf` next year, growing at g forever, discounted at r (r > g). */
export const perpetuity = (cf: number, r: number, g = 0) => cf / (r - g);

/**
 * Month-end cash of a business whose sales start at `s0` a month and grow by g a month. Costs are a
 * share `cr` of sales; customers pay `col` months after the sale, suppliers are paid `pay` months
 * after the purchase. Every sale is profitable; whether the cash survives depends on timing.
 */
export function cashPath(o: { c0: number; s0: number; g: number; cr: number; col: number; pay: number; months: number }): { cash: number[]; profit: number[] } {
  const S = (i: number) => (i < 1 ? 0 : o.s0 * (1 + o.g) ** (i - 1));
  let c = o.c0, p = 0;
  const cash: number[] = [], prof: number[] = [];
  for (let t = 1; t <= o.months; t++) {
    c += S(t - o.col) - o.cr * S(t - o.pay);
    p += S(t) * (1 - o.cr);
    cash.push(c);
    prof.push(p);
  }
  return { cash, profit: prof };
}

// ---------------------------------------------------------------- pictures

/** A P&L: label / amount rows (costs negative) and a bold result line. */
export function pnl(title: string, rows: [string, number][], totalLabel = 'Profit'): HTMLElement {
  const tot = rows.reduce((a, r) => a + r[1], 0);
  const line = (l: string, v: number, bold = false) => h('div', { style: `display:flex;justify-content:space-between;gap:10px;padding:3px 0;${bold ? 'font-weight:800;border-top:2px solid var(--line);margin-top:4px;padding-top:6px;' : ''}` },
    h('span', { style: bold ? '' : 'color:var(--muted);' }, l),
    h('span', { style: `font-variant-numeric:tabular-nums;${bold && v < 0 ? 'color:var(--bad);' : ''}` }, money(v)));
  return h('div', { style: 'flex:1;min-width:160px;max-width:360px;margin:0 auto;background:var(--panel2);border-radius:10px;padding:10px 12px;' },
    h('div', { style: 'font-weight:700;margin-bottom:4px;' }, title), rows.map(([l, v]) => line(l, v)), line(totalLabel, tot, true));
}

/** Several boxes side by side, wrapping on a phone. */
export function row(...boxes: HTMLElement[]): HTMLElement {
  return h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' }, boxes);
}

/** A short caption line under a picture. */
export function note(text: string): HTMLElement {
  return h('div', { class: 'muted small', style: 'text-align:center;margin-top:6px;' }, text);
}

/** Revenue and total-cost lines for a one-product business, with a break-even marker. */
export function costSpec(p: number, v: number, F: number, qmax: number, extra: Layer[] = [], o: { ymax?: number; mark?: boolean; unit?: string } = {}): PlotSpec {
  const be = breakEven(F, p, v);
  const layers: Layer[] = [
    { type: 'fn', f: (q) => p * q, color: 'var(--c1)', label: 'revenue' },
    { type: 'fn', f: (q) => F + v * q, color: 'var(--c4)', label: 'total cost' },
    { type: 'hline', y: F, color: 'var(--muted)', label: 'fixed cost' },
  ];
  if (o.mark !== false && be <= qmax) layers.push({ type: 'vline', x: be, color: 'var(--c3)' });
  return { x: [0, qmax], y: [0, o.ymax ?? Math.ceil((p * qmax * 1.05) / 1000) * 1000], xlabel: o.unit ?? 'units', ylabel: '$', size: [400, 270], layers: [...layers, ...extra] };
}

/** Customers paying late vs suppliers paid early: month-end cash as bars, cumulative profit as a line. */
export function cashSim(o: { c0: number; s0: number; cr: number; growth?: number; goal?: boolean }): Widget {
  const months = 12;
  const params = [
    ...(o.growth === undefined ? [{ id: 'g', label: 'sales growth', min: 0, max: 30, step: 5, value: 10, format: (x: number) => `${x}%/mo` }] : []),
    { id: 'col', label: 'customers pay after', min: 0, max: 90, step: 30, value: 60, format: (x: number) => `${x} days` },
    { id: 'pay', label: 'we pay suppliers after', min: 0, max: 30, step: 30, value: 0, format: (x: number) => `${x} days` },
  ];
  const run = (v: Record<string, number>) => cashPath({ c0: o.c0, s0: o.s0, cr: o.cr, g: (o.growth ?? v.g) / 100, col: v.col / 30, pay: v.pay / 30, months });
  return plotExplorer({
    params,
    spec: (v) => {
      const r = run(v);
      const lo = Math.min(0, ...r.cash), hi = Math.max(...r.cash, ...r.profit);
      const k = (x: number) => x / 1000;
      return {
        x: [0.4, months + 0.6], y: [Math.floor(k(lo) / 10) * 10 - 5, Math.ceil(k(hi) / 10) * 10 + 5], ticks: [1], size: [400, 270],
        xlabel: 'month', ylabel: '$ thousands',
        layers: [
          { type: 'bars', width: 0.75, color: 'var(--c1)', pts: r.cash.map((c, i) => [i + 1, k(c)] as [number, number]) },
          { type: 'line', pts: r.profit.map((p, i) => [i + 1, k(p)] as [number, number]), color: 'var(--c3)', label: 'total profit' },
        ],
      };
    },
    readout: (v) => {
      const r = run(v), low = Math.min(...r.cash);
      return `Profit so far: ${dollars(r.profit[months - 1])}. Lowest cash: ${dollars(low)}${low < 0 ? ' (out of cash)' : ''}.`;
    },
    goal: o.goal ? (v) => Math.min(...run(v).cash) >= 0 : undefined,
    goalText: 'Same sales, same profit: the cash never runs out.',
  });
}

/** Cohort table: rows of cohorts, columns months since joining, cells % still subscribed. */
export function cohortTable(cohorts: { name: string; size: number; churn: number }[], months: number): HTMLElement {
  const head = ['Cohort', ...Array.from({ length: months + 1 }, (_, m) => `M${m}`)];
  const rows = cohorts.map((c, i) => [c.name, ...Array.from({ length: months + 1 }, (_, m) => {
    if (m > months - i) return '';
    const share = retained(c.churn, m);
    return h('span', { style: `display:block;padding:2px 4px;border-radius:4px;background:color-mix(in srgb, var(--c3) ${Math.round(share * 60)}%, transparent);` }, pc(share, 0));
  })]);
  return dataTable(head, rows, { caption: '% of each month’s sign-ups still subscribed' });
}
