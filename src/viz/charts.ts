// Categorical charts and tables: bar charts, stacked proportion bars, donuts, data tables.
import { h, svg } from '../ui';
import { PALETTE } from './plot';

export interface BarItem { label: string; value: number; color?: string; note?: string }

/** Horizontal bar chart with value labels. Good for comparing a handful of categories. */
export function barChart(items: BarItem[], opts: { max?: number; format?: (v: number) => string; title?: string } = {}): HTMLElement {
  const max = opts.max ?? Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  const fmt = opts.format ?? ((v: number) => String(+v.toPrecision(4)));
  return h('div', { class: 'barchart' },
    opts.title ? h('div', { class: 'chart-title' }, opts.title) : null,
    items.map((it, k) =>
      h('div', { class: 'bc-row' },
        h('span', { class: 'bc-label' }, it.label),
        h('span', { class: 'bc-track' },
          h('span', { class: 'bc-fill', style: `width:${Math.max(0, (it.value / max) * 100)}%;background:${it.color ?? PALETTE[k % PALETTE.length]}` })),
        h('span', { class: 'bc-value' }, fmt(it.value), it.note ? h('span', { class: 'muted small' }, ' ' + it.note) : null))));
}

/** Vertical column chart (SVG), e.g. a category histogram or a time series of counts. */
export function columnChart(items: BarItem[], opts: { max?: number; format?: (v: number) => string; height?: number } = {}): HTMLElement {
  const W = Math.max(280, items.length * 56), H = opts.height ?? 200, pb = 34, pt = 22;
  const max = opts.max ?? Math.max(...items.map((i) => i.value), 1e-9);
  const fmt = opts.format ?? ((v: number) => String(+v.toPrecision(4)));
  const bw = W / items.length;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot' });
  s.appendChild(svg('line', { x1: 0, y1: H - pb, x2: W, y2: H - pb, class: 'axis' }));
  items.forEach((it, k) => {
    const hgt = ((H - pb - pt) * it.value) / max;
    const x = k * bw + bw * 0.15;
    s.appendChild(svg('rect', { x, y: H - pb - hgt, width: bw * 0.7, height: Math.max(0, hgt), rx: 3, style: `fill:${it.color ?? PALETTE[0]}` }));
    s.appendChild(svg('text', { x: x + bw * 0.35, y: H - pb - hgt - 6, class: 'tick', 'text-anchor': 'middle' }, fmt(it.value)));
    s.appendChild(svg('text', { x: x + bw * 0.35, y: H - pb + 18, class: 'tick', 'text-anchor': 'middle' }, it.label));
  });
  const d = h('div', { class: 'plot-wrap' });
  (s as SVGSVGElement).style.maxWidth = `${W}px`;
  d.appendChild(s);
  return d;
}

/** One bar split into parts (shares of a whole), with a legend. */
export function stackBar(parts: BarItem[], opts: { format?: (v: number) => string } = {}): HTMLElement {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const fmt = opts.format ?? ((v: number) => `${Math.round((v / total) * 100)}%`);
  return h('div', { class: 'stackbar' },
    h('div', { class: 'sb-bar' }, parts.map((p, k) =>
      h('span', { class: 'sb-part', title: `${p.label}: ${fmt(p.value)}`, style: `width:${(p.value / total) * 100}%;background:${p.color ?? PALETTE[k % PALETTE.length]}` }))),
    h('div', { class: 'legend' }, parts.map((p, k) =>
      h('span', { class: 'legend-item' }, h('i', { style: `background:${p.color ?? PALETTE[k % PALETTE.length]}` }), `${p.label} `, h('strong', null, fmt(p.value))))));
}

/** Donut chart of shares. */
export function donut(parts: BarItem[], opts: { center?: string } = {}): HTMLElement {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 60, c = 2 * Math.PI * r;
  const s = svg('svg', { viewBox: '0 0 160 160', class: 'donut' });
  let off = 0;
  parts.forEach((p, k) => {
    const len = (p.value / total) * c;
    s.appendChild(svg('circle', { cx: 80, cy: 80, r, style: `fill:none;stroke:${p.color ?? PALETTE[k % PALETTE.length]};stroke-width:26`, 'stroke-dasharray': `${len} ${c - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 80 80)' }));
    off += len;
  });
  if (opts.center) s.appendChild(svg('text', { x: 80, y: 86, class: 'donut-center', 'text-anchor': 'middle' }, opts.center));
  return h('div', { class: 'donut-wrap' }, s,
    h('div', { class: 'legend col' }, parts.map((p, k) =>
      h('span', { class: 'legend-item' }, h('i', { style: `background:${p.color ?? PALETTE[k % PALETTE.length]}` }), `${p.label} `, h('strong', null, `${Math.round((p.value / total) * 100)}%`)))));
}

/** A small data table. Cells may be strings, numbers or nodes; highlight rows by index. */
export function dataTable(head: string[], rows: (string | number | Node)[][], opts: { highlight?: number[]; caption?: string } = {}): HTMLElement {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'data' },
      opts.caption ? h('caption', null, opts.caption) : null,
      h('thead', null, h('tr', null, head.map((c) => h('th', null, c)))),
      h('tbody', null, rows.map((r, k) => h('tr', { class: opts.highlight?.includes(k) ? 'hl' : '' }, r.map((c) => h('td', null, c)))))));
}

/** Icon array: n items, the first `on` marked (or by predicate), in rows. A frequency picture. */
export function iconArray(n: number, on: number | ((i: number) => number), opts: { cols?: number; colors?: string[]; glyph?: string } = {}): HTMLElement {
  const cols = opts.cols ?? Math.min(20, n);
  const colors = opts.colors ?? ['var(--c1)', 'var(--line)'];
  const cls = typeof on === 'number' ? (i: number) => (i < on ? 0 : 1) : on;
  return h('div', { class: 'icon-array', style: `grid-template-columns:repeat(${cols}, 1fr)` },
    Array.from({ length: n }, (_, i) => h('span', { class: 'ia-dot', style: `background:${colors[cls(i)] ?? colors[colors.length - 1]}` }, opts.glyph ?? '')));
}
