// Pictures for the Calculus Intuition course: a growing square and cube (power rule), a fenced pen
// and a folded box (optimisation), a running-total plotter (area function), a tangent tracer that
// draws f′ as you slide along f, and small multiples for matching graphs. DOM/SVG only.
import type { Layer, PlotSpec, Widget } from '../types';
import { h, num as num3, svg } from '../ui';

const num = (v: number, d = 6): string => (v < 0 ? '−' + num3(-v, d) : num3(v, d));
import { explorer, type Values } from '../viz/explore';
import { plot } from '../viz/plot';

/** Numerical slope (central difference). */
export const slope = (f: (x: number) => number, x: number, e = 1e-6) => (f(x + e) - f(x - e)) / (2 * e);

/** Numerical area under f from a to b (Simpson's rule). */
export function integrate(f: (x: number) => number, a: number, b: number, n = 2000): number {
  if (a === b) return 0;
  const w = (b - a) / n;
  let s = f(a) + f(b);
  for (let k = 1; k < n; k++) s += f(a + k * w) * (k % 2 ? 4 : 2);
  return (s * w) / 3;
}

const wrap = (spec: PlotSpec) => { const d = h('div', { class: 'plot-wrap' }); d.appendChild(plot(spec).el); return d; };
const T = (x: number, y: number, text: string, style = '', anchor = 'middle') =>
  svg('text', { x, y, 'text-anchor': anchor, style: `font-size:14px;font-weight:700;fill:var(--text);${style}` }, text);

// ---------------------------------------------------------------- growing square

/** A square of side 3 growing by dx: the two strips (x·dx each) and the tiny corner (dx²). */
export function squareGrowth(): Widget {
  const x = 3;
  return explorer({
    params: [{ id: 'd', label: 'grow by dx', min: 0.05, max: 1, step: 0.05, value: 0.6, format: (v) => v.toFixed(2) }],
    draw: (v) => {
      const d = v.d, s = 62, o = 34, W = o + (x + 1) * s + 20, H = W;
      const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' }) as SVGSVGElement;
      el.style.maxWidth = '340px';
      const Y = (y: number) => H - o - y * s; // y up
      const rect = (x0: number, y0: number, w: number, hh: number, fill: string) =>
        el.appendChild(svg('rect', { x: o + x0 * s, y: Y(y0 + hh), width: w * s, height: hh * s, style: `fill:${fill};stroke:var(--panel);stroke-width:1.5` }));
      rect(0, 0, x, x, 'color-mix(in srgb, var(--c1) 45%, transparent)');
      rect(x, 0, d, x, 'var(--c2)');
      rect(0, x, x, d, 'var(--c2)');
      rect(x, x, d, d, 'var(--c4)');
      el.appendChild(T(o + (x * s) / 2, Y(x / 2) + 5, 'x²', 'font-size:20px'));
      el.appendChild(T(o + (x * s) / 2, H - o + 22, 'x = 3', 'fill:var(--muted)'));
      if (d >= 0.3) {
        el.appendChild(T(o + (x + d / 2) * s, Y(x / 2) + 5, 'x·dx', 'font-size:12px', 'middle'));
        el.appendChild(T(o + (x * s) / 2, Y(x + d / 2) + 5, 'x·dx', 'font-size:12px'));
      } else {
        el.appendChild(T(o + (x + d) * s + 4, Y(x / 2) + 5, 'x·dx', 'font-size:12px;fill:var(--c2)', 'start'));
      }
      el.appendChild(T(o + (x + d) * s + 4, Y(x + d) - 4, 'dx²', 'font-size:12px;fill:var(--c4)', 'start'));
      return h('div', { class: 'plot-wrap' }, el);
    },
    readout: (v) => {
      const add = 2 * x * v.d + v.d * v.d;
      return `added = ${num(2 * x * v.d)} + ${num(v.d * v.d)} = ${num(add)}  ·  per dx: ${num(add / v.d)}`;
    },
  });
}

// ---------------------------------------------------------------- growing cube

/** A cube of side x with three thin slabs (x·x·dx each) pulled slightly apart from its faces. */
export function cubeSlabs(): Widget {
  return () => {
    const W = 360, H = 300, s = 92, cx = 170, cy = 180, c = Math.cos(Math.PI / 6), sn = 0.5;
    const P = (X: number, Y: number, Z: number) => `${(cx + (X - Z) * c * s).toFixed(1)},${(cy - Y * s + (X + Z) * sn * s).toFixed(1)}`;
    const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' }) as SVGSVGElement;
    el.style.maxWidth = '360px';
    const face = (pts: [number, number, number][], fill: string) =>
      el.appendChild(svg('polygon', { points: pts.map((p) => P(...p)).join(' '), style: `fill:${fill};stroke:var(--panel);stroke-width:1.5;stroke-linejoin:round` }));
    /** Visible faces (top, right, front) of the box [x0,x1]×[y0,y1]×[z0,z1]. */
    const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: string) => {
      face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], `color-mix(in srgb, ${col} 55%, var(--panel))`);
      face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], `color-mix(in srgb, ${col} 85%, var(--panel))`);
      face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], col);
    };
    const d = 0.22, g = 0.2;
    box(0, 1, 0, 1, 0, 1, 'var(--c1)');
    box(0, 1, 1 + g, 1 + g + d, 0, 1, 'var(--c2)');
    box(1 + g, 1 + g + d, 0, 1, 0, 1, 'var(--c2)');
    box(0, 1, 0, 1, 1 + g, 1 + g + d, 'var(--c2)');
    const at = (X: number, Y: number, Z: number) => P(X, Y, Z).split(',').map(Number) as [number, number];
    const lab = (p: [number, number], t: string) => el.appendChild(T(p[0], p[1], t, 'font-size:13px;paint-order:stroke;stroke:var(--panel);stroke-width:3px'));
    lab(at(0.5, 1 + g + d, 0.5), 'x²·dx');
    lab(at(1 + g + d, 0.5, 0.5), 'x²·dx');
    lab(at(0.5, 0.5, 1 + g + d), 'x²·dx');
    el.appendChild(T(20, 24, 'cube x³ + three slabs', 'font-size:13px;fill:var(--muted)', 'start'));
    return h('div', { class: 'plot-wrap' }, el);
  };
}

// ---------------------------------------------------------------- fenced pen against a wall

/** 40 m of fence, three sides of a rectangle against a wall. Goal: the widest area. */
export function penTask(L: number, best: number): Widget {
  const A = (w: number) => w * (L - 2 * w);
  return explorer({
    params: [{ id: 'w', label: 'depth (m)', min: 1, max: L / 2 - 1, step: 0.5, value: 4 }],
    draw: (v) => {
      const w = v.w, len = L - 2 * w, k = 340 / (L - 2), W = 380, H = 166;
      const kd = k * 0.55 * 1.6; // depth drawn a bit larger so shallow pens stay visible
      const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' }) as SVGSVGElement;
      el.style.maxWidth = '380px';
      const x0 = (W - len * k) / 2, dh = Math.min(104, w * kd);
      el.appendChild(svg('rect', { x: 10, y: 8, width: W - 20, height: 10, style: 'fill:var(--muted);opacity:.6' }));
            el.appendChild(svg('path', { d: `M${x0},18 L${x0},${18 + dh} L${x0 + len * k},${18 + dh} L${x0 + len * k},18`, style: 'fill:color-mix(in srgb, var(--c3) 22%, transparent);stroke:var(--c3);stroke-width:3' }));
      el.appendChild(T(x0 - 6, 22 + dh / 2, `${num(w)}`, 'font-size:12px;fill:var(--c3)', 'end'));
      el.appendChild(T(W / 2, 18 + dh + 17, `${num(len)} m`, 'font-size:12px;fill:var(--c3)'));
      el.appendChild(T(W / 2, 18 + dh + 38, `area ${num(A(w))} m²`, 'font-size:15px'));
      const p = wrap({ x: [0, L / 2], y: [0, A(best) * 1.15], size: [440, 180], ticks: [L / 8, undefined], xlabel: 'depth (m)', ylabel: 'area', layers: [
        { type: 'fn', f: A, color: 'var(--c1)' }, { type: 'dots', pts: [[w, A(w)]], color: 'var(--c2)' }] });
      return h('div', null, h('div', { class: 'plot-wrap' }, el), p);
    },
    readout: (v) => `${num(v.w)} × ${num(L - 2 * v.w)} = ${num(A(v.w))} m²`,
    goal: (v) => Math.abs(v.w - best) < 1e-9,
    goalText: 'The biggest pen: the area curve is flat here.',
  });
}

// ---------------------------------------------------------------- folded box

/** A square card of side S; cut x×x squares from the corners and fold up. Goal: maximum volume. */
export function boxTask(S: number, best: number): Widget {
  const V = (x: number) => x * (S - 2 * x) ** 2;
  return explorer({
    params: [{ id: 'x', label: 'cut x (cm)', min: 0.5, max: S / 2 - 0.5, step: 0.5, value: 2 }],
    draw: (v) => {
      const x = v.x, k = 200 / S, W = 380, H = 230, ox = 14, oy = 14;
      const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' }) as SVGSVGElement;
      el.style.maxWidth = '380px';
      const R = (a: number, b: number, w: number, hh: number, st: string) => el.appendChild(svg('rect', { x: ox + a * k, y: oy + b * k, width: w * k, height: hh * k, style: st }));
      R(0, 0, S, S, 'fill:color-mix(in srgb, var(--c1) 22%, transparent);stroke:var(--c1);stroke-width:2');
      for (const [a, b] of [[0, 0], [S - x, 0], [0, S - x], [S - x, S - x]]) R(a, b, x, x, 'fill:var(--panel);stroke:var(--bad);stroke-width:1.5;stroke-dasharray:4 3');
      R(x, x, S - 2 * x, S - 2 * x, 'fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:5 4');
      el.appendChild(T(ox + (S / 2) * k, oy + (S / 2) * k + 5, `base ${num(S - 2 * x)}`, 'font-size:12px'));
      el.appendChild(T(ox + (x / 2) * k, oy + x * k + 14, `${num(x)}`, 'font-size:11px;fill:var(--bad)'));
      // the folded box, drawn simply in oblique projection on the right
      const bx = 236, by = 190, q = 90 / S, L = (S - 2 * x) * q, Hh = x * q, dd = L * 0.45;
      const poly = (pts: [number, number][], st: string) => el.appendChild(svg('polygon', { points: pts.map((p) => p.join(',')).join(' '), style: st }));
      poly([[bx, by], [bx + L, by], [bx + L, by - Hh], [bx, by - Hh]], 'fill:color-mix(in srgb, var(--c1) 55%, var(--panel));stroke:var(--c1);stroke-width:1.5');
      poly([[bx + L, by], [bx + L + dd, by - dd], [bx + L + dd, by - dd - Hh], [bx + L, by - Hh]], 'fill:color-mix(in srgb, var(--c1) 35%, var(--panel));stroke:var(--c1);stroke-width:1.5');
      poly([[bx, by - Hh], [bx + L, by - Hh], [bx + L + dd, by - dd - Hh], [bx + dd, by - dd - Hh]], 'fill:color-mix(in srgb, var(--c1) 12%, var(--panel));stroke:var(--c1);stroke-width:1.5');
      el.appendChild(T(bx + (L + dd) / 2, 30, `${num(V(x))} cm³`, 'font-size:15px'));
      const p = wrap({ x: [0, S / 2], y: [0, V(best) * 1.15], size: [440, 180], xlabel: 'cut x (cm)', ylabel: 'volume', layers: [
        { type: 'fn', f: V, color: 'var(--c1)' }, { type: 'dots', pts: [[x, V(x)]], color: 'var(--c2)' }] });
      return h('div', null, h('div', { class: 'plot-wrap' }, el), p);
    },
    readout: (v) => `V = ${num(v.x)} × ${num(S - 2 * v.x)} × ${num(S - 2 * v.x)} = ${num(V(v.x))} cm³`,
    goal: (v) => Math.abs(v.x - best) < 1e-9,
    goalText: 'The biggest box.',
  });
}

// ---------------------------------------------------------------- running total (area function)

export interface AccumOpts {
  f: (x: number) => number;
  x: [number, number];
  fy: [number, number];
  Ay: [number, number];
  step: number;
  start: number;
  label?: string;
  goal?: (x: number) => boolean;
  goalText?: string;
  readout?: (x: number, A: number) => string;
}

/** Top: f with the area from the left edge to x shaded. Bottom: the running total A traced so far. */
export function accumulator(o: AccumOpts): Widget {
  const [a] = o.x;
  const A = (x: number) => integrate(o.f, a, x, 400);
  return explorer({
    params: [{ id: 'x', label: 'up to x', min: o.x[0] + o.step, max: o.x[1], step: o.step, value: o.start }],
    draw: (v: Values) => {
      const x = v.x;
      // area above / below the axis in two colours
      const pos = (t: number) => Math.max(0, o.f(t)), neg = (t: number) => Math.min(0, o.f(t));
      const top = wrap({ x: o.x, y: o.fy, size: [440, 190], ylabel: o.label ?? 'f', layers: [
        { type: 'area', f: pos, from: a, to: x, color: 'var(--c3)' },
        { type: 'area', f: neg, from: a, to: x, color: 'var(--bad)' },
        { type: 'fn', f: o.f, color: 'var(--c1)' },
        { type: 'vline', x, color: 'var(--c2)' }] });
      const bot = wrap({ x: o.x, y: o.Ay, size: [440, 190], ylabel: 'running total A', layers: [
        { type: 'fn', f: A, from: a, to: x, color: 'var(--c3)', width: 3 },
        { type: 'dots', pts: [[x, A(x)]], color: 'var(--c2)' }] });
      return h('div', null, top, bot);
    },
    readout: (v) => (o.readout ? o.readout(v.x, A(v.x)) : `x = ${num(v.x)}   ·   A(x) = ${num(Math.round(A(v.x) * 1e4) / 1e4)}`),
    goal: o.goal ? (v) => o.goal!(v.x) : undefined,
    goalText: o.goalText,
  });
}

// ---------------------------------------------------------------- tangent tracer

/** Slide along f: the tangent shows the slope, and the lower plot draws f′ as you go. */
export function tangentTracer(f: (x: number) => number, xr: [number, number], fy: [number, number], dy: [number, number], start: number): Widget {
  return explorer({
    params: [{ id: 'x', label: 'x', min: xr[0], max: xr[1], step: 0.1, value: start, format: (v) => v.toFixed(1) }],
    draw: (v) => {
      const x = v.x, m = slope(f, x);
      const col = Math.abs(m) < 0.05 ? 'var(--c5)' : m > 0 ? 'var(--good)' : 'var(--bad)';
      const top = wrap({ x: xr, y: fy, size: [440, 190], ylabel: 'f', layers: [
        { type: 'fn', f, color: 'var(--c1)' },
        { type: 'fn', f: (t) => f(x) + m * (t - x), color: col, dash: true, from: x - 0.9, to: x + 0.9 },
        { type: 'dots', pts: [[x, f(x)]], color: col }] });
      const bot = wrap({ x: xr, y: dy, size: [440, 170], ylabel: 'slope f′', layers: [
        { type: 'fn', f: (t) => slope(f, t), from: xr[0], to: x, color: 'var(--c2)', width: 3 },
        { type: 'dots', pts: [[x, m]], color: col }] });
      return h('div', null, top, bot);
    },
    readout: (v) => {
      const m = slope(f, v.x);
      return `slope at x = ${v.x.toFixed(1)}: ${num(Math.round(m * 100) / 100)}  ${Math.abs(m) < 0.05 ? '(flat)' : m > 0 ? '(going up)' : '(going down)'}`;
    },
  });
}

// ---------------------------------------------------------------- small multiples

export interface Mini { label: string; f: (x: number) => number; y: [number, number]; color?: string }

/** A 2-column grid of small labelled graphs (no tick numbers: shapes only). */
export function miniGraphs(items: Mini[], x: [number, number], opts: { caption?: string } = {}): HTMLElement {
  return h('div', null,
    opts.caption ? h('div', { class: 'muted small', style: 'text-align:center;margin-bottom:4px' }, opts.caption) : null,
    h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px 10px' },
      items.map((it) => {
        const layers: Layer[] = [{ type: 'fn', f: it.f, color: it.color ?? 'var(--c1)', width: 3 }];
        const p = plot({ x, y: it.y, size: [220, 130], ticks: [x[1] - x[0], it.y[1] - it.y[0]], tickFormat: () => '', layers });
        return h('div', null, h('div', { style: 'font-weight:700;text-align:center;font-size:.95rem' }, it.label), h('div', { class: 'plot-wrap' }, p.el));
      })));
}
