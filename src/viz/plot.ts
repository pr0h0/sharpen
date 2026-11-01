// Plots in data coordinates: axes, grid, functions, polylines, dots, bars, shaded areas, labels.
// One renderer serves graphs of functions, scatter plots, histograms, number lines, geometry and
// the "place a point" exercise. Colours are CSS (use var(--c1)..var(--c6) for the theme palette).
import type { Layer, PlotSpec } from '../types';
import { svg } from '../ui';

export const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

export interface PlotView {
  el: SVGSVGElement;
  /** data -> pixel */
  px: (x: number) => number;
  py: (y: number) => number;
  /** pixel -> data */
  dx: (px: number) => number;
  dy: (py: number) => number;
  /** Layer group, for adding marks after drawing. */
  marks: SVGGElement;
  xr: [number, number];
  yr: [number, number];
}

/** A tidy step (1, 2, 5 x 10^k) giving about `n` ticks over span. */
export function niceStep(span: number, n = 6): number {
  const raw = span / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

const fmtTick = (v: number) => {
  const r = Math.round(v * 1e6) / 1e6;
  return Math.abs(r) >= 10000 ? r.toLocaleString('en-US') : String(r);
};

export function plot(spec: PlotSpec): PlotView {
  const line = !spec.y;
  const [W, H] = spec.size ?? (line ? [600, 90] : [600, 360]);
  const pad = { l: line ? 20 : 46, r: 20, t: line ? 10 : 14, b: line ? 36 : 38 };
  const [x0, x1] = spec.x;
  const [y0, y1] = spec.y ?? [0, 1];
  let iw = W - pad.l - pad.r;
  let ih = H - pad.t - pad.b;
  if (spec.equal && !line) {
    // Same units per pixel on both axes: shrink the longer side.
    const k = Math.min(iw / (x1 - x0), ih / (y1 - y0));
    iw = k * (x1 - x0);
    ih = k * (y1 - y0);
  }
  const px = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * iw;
  const py = line ? () => pad.t + ih / 2 : (y: number) => pad.t + ih - ((y - y0) / (y1 - y0)) * ih;
  const dx = (p: number) => x0 + ((p - pad.l) / iw) * (x1 - x0);
  const dy = (p: number) => y0 + ((pad.t + ih - p) / ih) * (y1 - y0);
  const fmt = spec.tickFormat ?? fmtTick;
  const width = pad.l + iw + pad.r, height = pad.t + ih + pad.b;

  const el = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'plot', role: 'img' }) as SVGSVGElement;
  el.style.maxWidth = `${width}px`;
  const clipId = 'clip' + Math.random().toString(36).slice(2, 8);
  el.appendChild(svg('defs', {}, svg('clipPath', { id: clipId }, svg('rect', { x: pad.l, y: pad.t, width: iw, height: ih }))));

  const sx = spec.ticks?.[0] ?? niceStep(x1 - x0, Math.max(4, Math.round(iw / 70)));
  const sy = spec.ticks?.[1] ?? niceStep(y1 - y0, Math.max(3, Math.round(ih / 50)));
  const ticksOf = (a: number, b: number, s: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + 1e-9; v += s) out.push(Math.round(v / s) * s);
    return out;
  };
  const axes = svg('g', { class: 'axes' });
  el.appendChild(axes);

  if (line) {
    const y = py(0);
    axes.appendChild(svg('line', { x1: px(x0), y1: y, x2: px(x1), y2: y, class: 'axis' }));
    for (const t of ticksOf(x0, x1, sx)) {
      axes.appendChild(svg('line', { x1: px(t), y1: y - 6, x2: px(t), y2: y + 6, class: 'axis' }));
      axes.appendChild(svg('text', { x: px(t), y: y + 22, class: 'tick', 'text-anchor': 'middle' }, fmt(t)));
    }
  } else {
    if (spec.grid !== false) {
      for (const t of ticksOf(x0, x1, sx)) axes.appendChild(svg('line', { x1: px(t), y1: pad.t, x2: px(t), y2: pad.t + ih, class: 'gridline' }));
      for (const t of ticksOf(y0, y1, sy)) axes.appendChild(svg('line', { x1: pad.l, y1: py(t), x2: pad.l + iw, y2: py(t), class: 'gridline' }));
    }
    // Axes sit at 0 when 0 is in range, else on the edge.
    const ax = y0 <= 0 && y1 >= 0 ? py(0) : pad.t + ih;
    const ay = x0 <= 0 && x1 >= 0 ? px(0) : pad.l;
    axes.appendChild(svg('line', { x1: pad.l, y1: ax, x2: pad.l + iw, y2: ax, class: 'axis' }));
    axes.appendChild(svg('line', { x1: ay, y1: pad.t, x2: ay, y2: pad.t + ih, class: 'axis' }));
    for (const t of ticksOf(x0, x1, sx)) axes.appendChild(svg('text', { x: px(t), y: pad.t + ih + 16, class: 'tick', 'text-anchor': 'middle' }, fmt(t)));
    for (const t of ticksOf(y0, y1, sy)) axes.appendChild(svg('text', { x: pad.l - 6, y: py(t) + 4, class: 'tick', 'text-anchor': 'end' }, fmt(t)));
    if (spec.ylabel) axes.appendChild(svg('text', { x: pad.l + 4, y: pad.t + 12, class: 'axis-label' }, spec.ylabel));
  }
  if (spec.xlabel) axes.appendChild(svg('text', { x: pad.l + iw, y: height - 4, class: 'axis-label', 'text-anchor': 'end' }, spec.xlabel));

  const marks = svg('g', { 'clip-path': `url(#${clipId})` }) as SVGGElement;
  el.appendChild(marks);
  const labels = svg('g', {});
  el.appendChild(labels);
  const view: PlotView = { el, px, py, dx, dy, marks, xr: [x0, x1], yr: [y0, y1] };
  (spec.layers ?? []).forEach((l, i) => drawLayer(view, l, i, labels));
  return view;
}

function path(pts: [number, number][], closed = false) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + (closed ? 'Z' : '');
}

/** Sample f over [a, b] into pixel polylines, breaking at gaps (NaN, infinities, jumps). */
function sample(v: PlotView, f: (x: number) => number, a: number, b: number): [number, number][][] {
  const n = 240;
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  const h = v.el.viewBox.baseVal.height;
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = f(x);
    const p = v.py(y);
    if (!Number.isFinite(y) || p < -h * 2 || p > h * 3) {
      if (cur.length > 1) runs.push(cur);
      cur = [];
      continue;
    }
    if (cur.length && Math.abs(p - cur[cur.length - 1][1]) > h * 1.5) { runs.push(cur); cur = []; }
    cur.push([v.px(x), p]);
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

export function drawLayer(v: PlotView, l: Layer, i: number, labels: SVGElement = v.marks) {
  const color = ('color' in l && l.color) || PALETTE[i % PALETTE.length];
  const g = v.marks;
  const stroke = (w = 2.5, dash = false) => `stroke:${color};stroke-width:${w};fill:none;${dash ? 'stroke-dasharray:6 5;' : ''}`;
  const domain = () => v.xr;
  switch (l.type) {
    case 'fn': {
      const [a, b] = domain();
      for (const run of sample(v, l.f, l.from ?? a, l.to ?? b)) g.appendChild(svg('path', { d: path(run), style: stroke(l.width ?? 2.5, l.dash) }));
      if (l.label) {
        // Label the curve at the rightmost point that is comfortably inside the plot.
        const lo = l.from ?? a, hi = l.to ?? b, [y0, y1] = v.yr, m = (y1 - y0) * 0.08;
        for (let t = 0.9; t >= 0.1; t -= 0.04) {
          const x = lo + (hi - lo) * t, y = l.f(x);
          if (Number.isFinite(y) && y > y0 + m && y < y1 - m) {
            labels.appendChild(svg('text', { x: v.px(x) - 6, y: v.py(y) - 8, class: 'plot-label', style: `fill:${color}`, 'text-anchor': 'end' }, l.label));
            break;
          }
        }
      }
      break;
    }
    case 'line': {
      const pts = l.pts.map(([x, y]) => [v.px(x), v.py(y)] as [number, number]);
      g.appendChild(svg('path', { d: path(pts, l.closed), style: stroke(l.width ?? 2.5, l.dash) + (l.fill ? `fill:${l.fill};` : '') + 'stroke-linejoin:round;' }));
      if (l.label && pts.length) {
        const [x, y] = pts[pts.length - 1];
        labels.appendChild(svg('text', { x: x - 4, y: y - 8, class: 'plot-label', style: `fill:${color}`, 'text-anchor': 'end' }, l.label));
      }
      break;
    }
    case 'dots':
      l.pts.forEach(([x, y], k) => {
        g.appendChild(svg('circle', { cx: v.px(x), cy: v.py(y), r: l.r ?? 4.5, style: `fill:${color};stroke:var(--panel);stroke-width:1.2` }));
        const t = l.labels?.[k];
        if (t) labels.appendChild(svg('text', { x: v.px(x) + 7, y: v.py(y) - 7, class: 'plot-label', style: `fill:${color}` }, t));
      });
      break;
    case 'bars': {
      const base = v.py(0);
      for (const [x, y] of l.pts) {
        const a = v.px(x - l.width / 2), b = v.px(x + l.width / 2), top = v.py(y);
        g.appendChild(svg('rect', { x: a + 1, y: Math.min(top, base), width: Math.max(1, b - a - 2), height: Math.abs(base - top), style: `fill:${color};opacity:.85`, rx: 2 }));
      }
      break;
    }
    case 'area': {
      const n = 120, top: [number, number][] = [], bot: [number, number][] = [];
      for (let k = 0; k <= n; k++) {
        const x = l.from + ((l.to - l.from) * k) / n;
        top.push([v.px(x), v.py(l.f(x))]);
        bot.push([v.px(x), v.py(l.base ? l.base(x) : 0)]);
      }
      g.appendChild(svg('path', { d: path([...top, ...bot.reverse()], true), style: `fill:${color};opacity:.25;stroke:none` }));
      break;
    }
    case 'vline': {
      const vb = v.el.viewBox.baseVal;
      g.appendChild(svg('line', { x1: v.px(l.x), y1: 0, x2: v.px(l.x), y2: vb.height, style: stroke(2, l.dash ?? true) }));
      if (l.label) labels.appendChild(svg('text', { x: v.px(l.x) + 5, y: 24, class: 'plot-label', style: `fill:${color}` }, l.label));
      break;
    }
    case 'hline': {
      const vb = v.el.viewBox.baseVal;
      g.appendChild(svg('line', { x1: 0, y1: v.py(l.y), x2: vb.width, y2: v.py(l.y), style: stroke(2, l.dash ?? true) }));
      if (l.label) labels.appendChild(svg('text', { x: vb.width - 24, y: v.py(l.y) - 6, class: 'plot-label', style: `fill:${color}`, 'text-anchor': 'end' }, l.label));
      break;
    }
    case 'text':
      labels.appendChild(svg('text', { x: v.px(l.x), y: v.py(l.y), class: 'plot-label', style: `fill:${l.color ?? 'var(--text)'}`, 'text-anchor': l.anchor ?? 'middle' }, l.text));
      break;
    case 'arrow': {
      const [ax, ay] = [v.px(l.from[0]), v.py(l.from[1])];
      const [bx, by] = [v.px(l.to[0]), v.py(l.to[1])];
      const ang = Math.atan2(by - ay, bx - ax), s = 9;
      g.appendChild(svg('line', { x1: ax, y1: ay, x2: bx, y2: by, style: stroke(2.5) }));
      g.appendChild(svg('path', { d: path([[bx, by], [bx - s * Math.cos(ang - 0.45), by - s * Math.sin(ang - 0.45)], [bx - s * Math.cos(ang + 0.45), by - s * Math.sin(ang + 0.45)]], true), style: `fill:${color}` }));
      if (l.label) labels.appendChild(svg('text', { x: (ax + bx) / 2 + 6, y: (ay + by) / 2 - 6, class: 'plot-label', style: `fill:${color}` }, l.label));
      break;
    }
  }
}

/** A plot as a widget-ready element (wrapped so it scales to the column). */
export function plotEl(spec: PlotSpec): HTMLElement {
  const d = document.createElement('div');
  d.className = 'plot-wrap';
  d.appendChild(plot(spec).el);
  return d;
}
