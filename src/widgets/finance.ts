// Personal Finance: money maths (compounding, loans, card payoff, years to independence, portfolio
// volatility) and a few small pictures (stacked columns, a cost ledger, a payment split).
// Every number in the course is computed from these formulas; all scenarios are hypothetical.
import { h, svg } from '../ui';

// ---------------------------------------------------------------- formatting

/** 1234.5 -> "$1,235"; negative -> "−$1,235". */
export function usd(v: number, digits = 0): string {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (v < 0 ? '−$' : '$') + s;
}
/** Round to a "nice" figure for prose: 17449 -> "$17,000" (2 significant figures). */
export function usdRound(v: number, sig = 2): string {
  const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.abs(v))) - sig + 1);
  return usd(Math.round(v / p) * p);
}
/** 0.0712 -> "7.1%"; whole percents print without decimals. */
export function pc(r: number, digits = 1): string {
  const v = r * 100;
  return (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(digits)) + '%';
}

// ---------------------------------------------------------------- formulas

/** Future value of a lump sum. */
export const fv = (p: number, r: number, n: number) => p * (1 + r) ** n;
/** Future value of `pmt` paid at the end of each of n periods. */
export const fvAnnuity = (pmt: number, r: number, n: number) => (r === 0 ? pmt * n : pmt * (((1 + r) ** n - 1) / r));
/** Exact doubling time. */
export const doubling = (r: number) => Math.log(2) / Math.log(1 + r);
/** Real return from nominal and inflation (exact). */
export const real = (nom: number, inf: number) => (1 + nom) / (1 + inf) - 1;
/** Level payment for a loan of p over n periods at rate r per period. */
export const payment = (p: number, r: number, n: number) => (r === 0 ? p / n : (p * r) / (1 - (1 + r) ** -n));

/**
 * Years until savings reach `mult` × yearly spending, starting from zero, saving a share s of
 * income each year (end of year), growing at real rate r. Spending is the other (1 − s).
 */
export function yearsToFI(s: number, r = 0.05, mult = 25): number {
  if (s <= 0) return Infinity;
  if (s >= 1) return 0;
  return Math.log(1 + (mult * (1 - s) * r) / s) / Math.log(1 + r);
}

export interface Payoff { months: number; interest: number; path: number[]; paid: number }
/**
 * Month by month: interest (apr/12 of the balance) is added, then the payment (pay(balance after
 * interest), capped at what is owed) comes off. months = Infinity if it never gets paid off.
 */
export function payoff(balance: number, apr: number, pay: (b: number) => number, maxMonths = 1200): Payoff {
  let b = balance, interest = 0, paid = 0, m = 0;
  const path = [b];
  while (b > 0.005 && m < maxMonths) {
    const i = b * (apr / 12);
    interest += i;
    b += i;
    const p = Math.min(b, pay(b));
    if (p <= i + 1e-9 && p < b) return { months: Infinity, interest, path, paid };
    b -= p;
    paid += p;
    m++;
    path.push(b);
  }
  return { months: b > 0.005 ? Infinity : m, interest, path, paid };
}

/** Yearly interest and principal of a level-payment loan (monthly payments). */
export function amortYears(p: number, apr: number, years: number): { interest: number; principal: number; balance: number }[] {
  const r = apr / 12, pm = payment(p, r, years * 12);
  let b = p;
  const out: { interest: number; principal: number; balance: number }[] = [];
  for (let y = 0; y < years; y++) {
    let ii = 0, pp = 0;
    for (let m = 0; m < 12; m++) {
      const i = b * r;
      ii += i;
      pp += pm - i;
      b -= pm - i;
    }
    out.push({ interest: ii, principal: pp, balance: Math.max(0, b) });
  }
  return out;
}

/** Volatility (SD) of an equal-weight portfolio of n assets, each with SD sigma and pairwise correlation rho. */
export const portfolioSD = (sigma: number, n: number, rho: number) => sigma * Math.sqrt(rho + (1 - rho) / n);

/** Run a balance through yearly returns, taking `withdraw` out at the start of each year. */
export function runSequence(start: number, rets: number[], withdraw: number): number[] {
  const out = [start];
  let b = start;
  for (const r of rets) {
    b = Math.max(0, (b - withdraw) * (1 + r));
    out.push(b);
  }
  return out;
}

// ---------------------------------------------------------------- pictures

export interface Part { label: string; value: number; color: string }

/**
 * Stacked columns: one column per entry, parts stacked bottom-up, with a legend. Good for interest vs
 * principal by year, or comparing total costs. `every` labels only every k-th column.
 */
export function stackCols(cols: { label: string; parts: number[] }[], legend: { label: string; color: string }[],
  o: { format?: (v: number) => string; every?: number; height?: number; width?: number; totals?: boolean; caption?: string } = {}): HTMLElement {
  const W = o.width ?? 340, H = o.height ?? 210, pb = 26, pt = o.totals ? 22 : 8, pl = 6, pr = 8;
  const max = Math.max(...cols.map((c) => c.parts.reduce((a, b) => a + b, 0)), 1e-9);
  const bw = (W - pl - pr) / cols.length;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' }) as SVGSVGElement;
  s.style.maxWidth = `${W}px`;
  s.appendChild(svg('line', { x1: 0, y1: H - pb, x2: W, y2: H - pb, class: 'axis' }));
  const fmt = o.format ?? ((v: number) => usdRound(v));
  cols.forEach((c, k) => {
    let y = H - pb;
    const x = pl + k * bw + bw * 0.12, w = bw * 0.76;
    c.parts.forEach((v, j) => {
      const hh = ((H - pb - pt) * v) / max;
      y -= hh;
      s.appendChild(svg('rect', { x, y, width: Math.max(1, w), height: Math.max(0, hh), style: `fill:${legend[j].color}` }));
    });
    if (o.totals) s.appendChild(svg('text', { x: x + w / 2, y: y - 6, class: 'tick', 'text-anchor': 'middle' }, fmt(c.parts.reduce((a, b) => a + b, 0))));
    if (!o.every || k % o.every === 0 || k === cols.length - 1)
      s.appendChild(svg('text', { x: x + w / 2, y: H - pb + 17, class: 'tick', 'text-anchor': 'middle' }, c.label));
  });
  return h('div', null, h('div', { class: 'plot-wrap' }, s), o.caption ? note(o.caption) : null, legendRow(legend));
}

export function legendRow(items: { label: string; color: string }[]): HTMLElement {
  return h('div', { class: 'legend' }, items.map((it) => h('span', { class: 'legend-item' }, h('i', { style: `background:${it.color}` }), it.label)));
}

/** A short caption line under a picture. */
export function note(text: string): HTMLElement {
  return h('div', { class: 'muted small', style: 'text-align:center;margin-top:6px;' }, text);
}

/** One payment split into interest and principal, as a labelled bar. */
export function paySplit(interest: number, principal: number, title?: string): HTMLElement {
  const tot = interest + principal || 1;
  const seg = (v: number, color: string, label: string) => v > 0
    ? h('span', { style: `width:${(v / tot) * 100}%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem;white-space:nowrap;overflow:hidden;` }, (v / tot) > 0.18 ? label : '')
    : null;
  return h('div', null,
    title ? h('div', { class: 'chart-title', style: 'text-align:center;' }, title) : null,
    h('div', { style: 'display:flex;height:34px;border-radius:8px;overflow:hidden;background:var(--panel2);' },
      seg(interest, 'var(--c4)', `interest ${usd(interest)}`), seg(principal, 'var(--c3)', `principal ${usd(principal)}`)),
    legendRow([{ label: `interest ${usd(interest)}`, color: 'var(--c4)' }, { label: `pays down debt ${usd(principal)}`, color: 'var(--c3)' }]));
}

/** A ledger: rows of label / amount with a bold total line. */
export function ledger(title: string, rows: [string, number][], totalLabel = 'Total'): HTMLElement {
  const tot = rows.reduce((a, r) => a + r[1], 0);
  const line = (l: string, v: number, bold = false) => h('div', { style: `display:flex;justify-content:space-between;gap:10px;padding:3px 0;${bold ? 'font-weight:800;border-top:2px solid var(--line);margin-top:4px;padding-top:6px;' : ''}` },
    h('span', { style: bold ? '' : 'color:var(--muted);' }, l), h('span', { style: 'font-variant-numeric:tabular-nums;' }, usd(v)));
  return h('div', { style: 'flex:1;min-width:150px;background:var(--panel2);border-radius:10px;padding:10px 12px;' },
    h('div', { style: 'font-weight:700;margin-bottom:4px;' }, title), rows.map(([l, v]) => line(l, v)), line(totalLabel, tot, true));
}

/** Side-by-side ledgers that wrap on a phone. */
export function ledgers(...boxes: HTMLElement[]): HTMLElement {
  return h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' }, boxes);
}
