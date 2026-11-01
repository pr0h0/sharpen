// Pictures for the geometry course: a small figure renderer (data coordinates, y up, no axes) and
// the dissection proofs, explorers and solids built on it. Colours are theme CSS variables.
import type { Widget } from '../types';
import { h, num, svg } from '../ui';
import { explorer, stepper } from '../viz/explore';

export type Pt = [number, number];

/** A see-through version of a theme colour, for fills. */
export const tint = (c: string, p = 28) => `color-mix(in srgb, ${c} ${p}%, transparent)`;

export type Item =
  | { t: 'poly'; pts: Pt[]; fill?: string; stroke?: string; dash?: boolean; open?: boolean; w?: number }
  | { t: 'text'; at: Pt; s: string; color?: string; anchor?: 'start' | 'middle' | 'end'; size?: number }
  | { t: 'wedge'; c: Pt; r: number; a0: number; a1: number; fill?: string; stroke?: string }
  | { t: 'arc'; c: Pt; r: number; a0: number; a1: number; stroke?: string; w?: number }
  | { t: 'circle'; c: Pt; r: number; fill?: string; stroke?: string; dash?: boolean }
  | { t: 'dot'; at: Pt; color?: string; r?: number }
  | { t: 'right'; at: Pt; u: Pt; v: Pt; s?: number }
  | { t: 'grid'; from: Pt; to: Pt; step?: number }
  | { t: 'arrow'; from: Pt; to: Pt; color?: string };

const rad = (d: number) => (d * Math.PI) / 180;

/** Draw items in the data box view = [x0, y0, x1, y1] (y up), W viewBox pixels wide. */
export function figEl(items: Item[], view: [number, number, number, number], W = 400): SVGSVGElement {
  const [x0, y0, x1, y1] = view;
  const k = W / (x1 - x0);
  const H = Math.max(10, (y1 - y0) * k);
  const X = (x: number) => (x - x0) * k, Y = (y: number) => (y1 - y) * k;
  const P = (p: Pt) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`;
  const el = svg('svg', { viewBox: `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`, class: 'plot', role: 'img' }) as SVGSVGElement;
  el.style.maxWidth = `${W}px`;
  const top: SVGElement[] = [];
  const line = (stroke = 'var(--text)', w = 2.2, dash = false) => `stroke:${stroke};stroke-width:${w};${dash ? 'stroke-dasharray:6 5;' : ''}stroke-linejoin:round;stroke-linecap:round;`;
  for (const it of items) {
    switch (it.t) {
      case 'poly':
        el.appendChild(svg('path', { d: 'M' + it.pts.map(P).join('L') + (it.open ? '' : 'Z'), style: line(it.stroke, it.w, it.dash) + `fill:${it.open ? 'none' : it.fill ?? 'none'};` }));
        break;
      case 'grid': {
        const s = it.step ?? 1;
        const [gx0, gy0] = it.from, [gx1, gy1] = it.to;
        for (let x = gx0; x <= gx1 + 1e-9; x += s) el.appendChild(svg('line', { x1: X(x), y1: Y(gy0), x2: X(x), y2: Y(gy1), class: 'gridline' }));
        for (let y = gy0; y <= gy1 + 1e-9; y += s) el.appendChild(svg('line', { x1: X(gx0), y1: Y(y), x2: X(gx1), y2: Y(y), class: 'gridline' }));
        break;
      }
      case 'wedge': {
        const a = [rad(it.a0), rad(it.a1)];
        const p0: Pt = [it.c[0] + it.r * Math.cos(a[0]), it.c[1] + it.r * Math.sin(a[0])];
        const p1: Pt = [it.c[0] + it.r * Math.cos(a[1]), it.c[1] + it.r * Math.sin(a[1])];
        const large = it.a1 - it.a0 > 180 ? 1 : 0;
        el.appendChild(svg('path', { d: `M${P(it.c)}L${P(p0)}A${(it.r * k).toFixed(1)},${(it.r * k).toFixed(1)} 0 ${large} 0 ${P(p1)}Z`, style: `fill:${it.fill ?? tint('var(--c1)')};${it.stroke ? line(it.stroke, 1.5) : 'stroke:none;'}` }));
        break;
      }
      case 'arc': {
        const a = [rad(it.a0), rad(it.a1)];
        const p0: Pt = [it.c[0] + it.r * Math.cos(a[0]), it.c[1] + it.r * Math.sin(a[0])];
        const p1: Pt = [it.c[0] + it.r * Math.cos(a[1]), it.c[1] + it.r * Math.sin(a[1])];
        const large = it.a1 - it.a0 > 180 ? 1 : 0;
        el.appendChild(svg('path', { d: `M${P(p0)}A${(it.r * k).toFixed(1)},${(it.r * k).toFixed(1)} 0 ${large} 0 ${P(p1)}`, style: line(it.stroke ?? 'var(--muted)', it.w ?? 2) + 'fill:none;' }));
        break;
      }
      case 'circle':
        el.appendChild(svg('circle', { cx: X(it.c[0]), cy: Y(it.c[1]), r: it.r * k, style: line(it.stroke, 2.2, it.dash) + `fill:${it.fill ?? 'none'};` }));
        break;
      case 'dot':
        top.push(svg('circle', { cx: X(it.at[0]), cy: Y(it.at[1]), r: it.r ?? 4.5, style: `fill:${it.color ?? 'var(--text)'};stroke:var(--panel);stroke-width:1.2` }));
        break;
      case 'right': {
        const n = (p: Pt): Pt => { const d = Math.hypot(p[0], p[1]) || 1; return [p[0] / d, p[1] / d]; };
        const s = (it.s ?? 11) / k, u = n(it.u), v = n(it.v), a = it.at;
        const q1: Pt = [a[0] + u[0] * s, a[1] + u[1] * s], q2: Pt = [q1[0] + v[0] * s, q1[1] + v[1] * s], q3: Pt = [a[0] + v[0] * s, a[1] + v[1] * s];
        el.appendChild(svg('path', { d: `M${P(q1)}L${P(q2)}L${P(q3)}`, style: line('var(--muted)', 1.5) + 'fill:none;' }));
        break;
      }
      case 'arrow': {
        const [ax, ay, bx, by] = [X(it.from[0]), Y(it.from[1]), X(it.to[0]), Y(it.to[1])];
        const ang = Math.atan2(by - ay, bx - ax), s = 9, c = it.color ?? 'var(--muted)';
        el.appendChild(svg('line', { x1: ax, y1: ay, x2: bx, y2: by, style: line(c, 2.2) }));
        el.appendChild(svg('path', { d: `M${bx},${by}L${bx - s * Math.cos(ang - 0.45)},${by - s * Math.sin(ang - 0.45)}L${bx - s * Math.cos(ang + 0.45)},${by - s * Math.sin(ang + 0.45)}Z`, style: `fill:${c}` }));
        break;
      }
      case 'text': {
        const size = it.size ?? 19;
        top.push(svg('text', { x: X(it.at[0]), y: Y(it.at[1]) + size * 0.35, class: 'plot-label', 'text-anchor': it.anchor ?? 'middle', style: `fill:${it.color ?? 'var(--text)'};font-size:${size}px` }, it.s));
        break;
      }
    }
  }
  for (const t of top) el.appendChild(t);
  return el;
}

/** A figure as a widget-ready element. */
export function fig(items: Item[], view: [number, number, number, number], W = 400): HTMLElement {
  const d = h('div', { class: 'plot-wrap' });
  d.appendChild(figEl(items, view, W));
  return d;
}
export const figW = (items: Item[], view: [number, number, number, number], W = 400): Widget => () => fig(items, view, W);

// ---------------------------------------------------------------- small geometry helpers

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dir = (from: Pt, to: Pt) => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const norm360 = (a: number) => ((a % 360) + 360) % 360;
/** Interior angle at b (degrees) of the path a-b-c. */
export function angleAt(a: Pt, b: Pt, c: Pt): number {
  const u = sub(a, b), v = sub(c, b);
  return (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI;
}
/** A wedge marking the interior angle at b of triangle/polygon corner a-b-c. */
function cornerWedge(a: Pt, b: Pt, c: Pt, r: number, fill: string): Item {
  let a0 = norm360(dir(b, a)), a1 = norm360(dir(b, c));
  if (norm360(a1 - a0) > 180) [a0, a1] = [a1, a0];
  if (a1 < a0) a1 += 360;
  return { t: 'wedge', c: b, r, a0, a1, fill };
}
/** Triangle on base (0,0)-(base,0) with angles A and B (degrees) at the base ends. */
export function triFromAngles(A: number, B: number, base: number): Pt[] {
  const C = 180 - A - B;
  const ac = (base * Math.sin(rad(B))) / Math.sin(rad(C));
  return [[0, 0], [base, 0], [ac * Math.cos(rad(A)), ac * Math.sin(rad(A))]];
}
function bounds(pts: Pt[], pad: number): [number, number, number, number] {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

const C1 = 'var(--c1)', C2 = 'var(--c2)', C3 = 'var(--c3)', C4 = 'var(--c4)', C6 = 'var(--c6)';

// ---------------------------------------------------------------- lesson 1: angles

/** A straight line with a ray; the two angles marked, one labelled, the other "?" (or both). */
export function lineAngles(a: number, showB = false): Widget {
  return () => fig(rayFig(a, `${a}°`, showB ? `${180 - a}°` : '?'), [-4.3, -0.8, 4.3, 3.9]);
}
function rayFig(a: number, la: string, lb: string): Item[] {
  const r = 3.4, e: Pt = [r * Math.cos(rad(a)), r * Math.sin(rad(a))];
  const ma = rad(a / 2), mb = rad((a + 180) / 2);
  return [
    { t: 'wedge', c: [0, 0], r: 1.1, a0: 0, a1: a, fill: tint(C1, 35) },
    { t: 'wedge', c: [0, 0], r: 0.85, a0: a, a1: 180, fill: tint(C2, 35) },
    { t: 'poly', pts: [[-4, 0], [4, 0]], open: true },
    { t: 'poly', pts: [[0, 0], e], open: true, stroke: C1, w: 2.6 },
    { t: 'dot', at: [0, 0] },
    { t: 'text', at: [1.75 * Math.cos(ma), 1.75 * Math.sin(ma)], s: la, color: C1 },
    { t: 'text', at: [1.55 * Math.cos(mb), 1.55 * Math.sin(mb)], s: lb, color: C2 },
  ];
}
export const lineExplorer: Widget = explorer({
  params: [{ id: 'a', label: 'angle', min: 10, max: 170, step: 5, value: 40, format: (v) => `${v}°` }],
  draw: (v) => fig(rayFig(v.a, `${v.a}°`, `${180 - v.a}°`), [-4.3, -0.8, 4.3, 3.9]),
  readout: (v) => `${v.a}° + ${180 - v.a}° = 180°`,
});

/** Rays from a point at the given directions; labels for the angles between consecutive rays. */
export function aroundPoint(dirs: number[], labels: string[]): Widget {
  return () => {
    const items: Item[] = [];
    const cols = [C1, C2, C3, C4, C6];
    dirs.forEach((d, i) => {
      const nx = dirs[(i + 1) % dirs.length] + (i === dirs.length - 1 ? 360 : 0);
      items.push({ t: 'wedge', c: [0, 0], r: 1, a0: d, a1: nx, fill: tint(cols[i % 5], 35) });
      const m = rad((d + nx) / 2);
      items.push({ t: 'text', at: [1.65 * Math.cos(m), 1.65 * Math.sin(m)], s: labels[i], color: cols[i % 5] });
    });
    dirs.forEach((d) => items.push({ t: 'poly', pts: [[0, 0], [3 * Math.cos(rad(d)), 3 * Math.sin(rad(d))]], open: true }));
    items.push({ t: 'dot', at: [0, 0] });
    return fig(items, [-3.3, -3.2, 3.3, 3.2], 320);
  };
}

/** A triangle with its corners shaded, labels at each corner. */
export function triangleFig(pts: Pt[], labels: string[], sideLabels: string[] = [], extra: Item[] = [], wedges = true): Widget {
  return () => {
    const cols = [C1, C2, C3];
    const items: Item[] = [];
    const span = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const r = span * 0.11;
    if (wedges) pts.forEach((b, i) => items.push(cornerWedge(pts[(i + 2) % 3], b, pts[(i + 1) % 3], r, tint(cols[i], 45))));
    items.push({ t: 'poly', pts, fill: wedges ? 'none' : tint(C1, 25), stroke: wedges ? undefined : C1 }, ...extra);
    const cen: Pt = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
    pts.forEach((p, i) => {
      if (!labels[i]) return;
      const d = sub(cen, p), L = Math.hypot(...d);
      items.push({ t: 'text', at: [p[0] + (d[0] / L) * r * 2.1, p[1] + (d[1] / L) * r * 2.1], s: labels[i], color: cols[i] });
    });
    sideLabels.forEach((s, i) => {
      if (!s) return;
      const a = pts[i], b = pts[(i + 1) % 3], m = mid(a, b), d = sub(m, cen), L = Math.hypot(...d);
      items.push({ t: 'text', at: [m[0] + (d[0] / L) * span * 0.07, m[1] + (d[1] / L) * span * 0.07], s });
    });
    return fig(items, bounds(pts, span * 0.12));
  };
}

/** Tear the three corners off a triangle and line them up: they make a straight angle. */
export function tearCorners(): HTMLElement {
  const T: Pt[] = [[0, 0], [6, 0], [2, 4]];
  const A = angleAt(T[2], T[0], T[1]), B = angleAt(T[0], T[1], T[2]), Cc = 180 - A - B;
  const r = 1.1;
  const view: [number, number, number, number] = [-1.2, -1.4, 7.2, 5];
  const wA = (c: Pt): Item => ({ t: 'wedge', c, r, a0: 0, a1: A, fill: tint(C1, 55), stroke: C1 });
  const wB = (c: Pt, a0 = 180 - B): Item => ({ t: 'wedge', c, r, a0, a1: a0 + B, fill: tint(C2, 55), stroke: C2 });
  const wC = (c: Pt, a0 = 180 + A): Item => ({ t: 'wedge', c, r, a0, a1: a0 + Cc, fill: tint(C3, 55), stroke: C3 });
  return stepper(3, (i) => {
    if (i === 0) return fig([{ t: 'poly', pts: T }, wA(T[0]), wB(T[1]), wC(T[2])], view);
    if (i === 1) return fig([{ t: 'poly', pts: T, dash: true, stroke: 'var(--muted)' }, wA([-0.6, -0.6]), wB([6.6, -0.6]), wC([2, 4.6])], view);
    const o: Pt = [3, 0];
    return fig([
      { t: 'poly', pts: T, dash: true, stroke: 'var(--line)' },
      { t: 'poly', pts: [[0, 0], [6, 0]], open: true },
      wA(o), wC(o, A), wB(o, A + Cc), { t: 'dot', at: o },
      { t: 'text', at: [3, -0.7], s: 'a straight line: 180°' }], view);
  }, { caption: (i) => ['Any triangle. Shade its three corners.', 'Tear the corners off.', 'Put the tips together: the corners fill a straight line exactly.'][i] });
}

/** Explorer: drag the top corner of a triangle; the angles change, the sum doesn't. Goal: C = 90°. */
export const triangleExplorer: Widget = explorer({
  params: [
    { id: 'x', label: 'top corner x', min: -2, max: 8, step: 1, value: 1 },
    { id: 'y', label: 'top corner y', min: 1, max: 6, step: 1, value: 5 },
  ],
  draw: (v) => {
    const T: Pt[] = [[0, 0], [6, 0], [v.x, v.y]];
    const items: Item[] = [{ t: 'grid', from: [-2, 0], to: [8, 6] }];
    const cols = [C1, C2, C3];
    T.forEach((b, i) => items.push(cornerWedge(T[(i + 2) % 3], b, T[(i + 1) % 3], 0.75, tint(cols[i], 50))));
    items.push({ t: 'poly', pts: T }, { t: 'text', at: [-0.45, -0.35], s: 'A', color: C1 }, { t: 'text', at: [6.45, -0.35], s: 'B', color: C2 }, { t: 'text', at: [v.x, v.y + 0.45], s: 'C', color: C3 });
    return fig(items, [-2.6, -0.8, 8.6, 6.9]);
  },
  readout: (v) => {
    const T: Pt[] = [[0, 0], [6, 0], [v.x, v.y]];
    const a = angleAt(T[2], T[0], T[1]), b = angleAt(T[0], T[1], T[2]), c = angleAt(T[0], T[2], T[1]);
    return `A ≈ ${a.toFixed(1)}°, B ≈ ${b.toFixed(1)}°, C ≈ ${c.toFixed(1)}°, sum = ${Math.round(a + b + c)}°`;
  },
  goal: (v) => Math.abs(angleAt([0, 0], [v.x, v.y], [6, 0]) - 90) < 0.01,
  goalText: 'A right angle at C, and the sum is still 180°.',
});

/** A regular n-gon cut into triangles from one corner. */
function polygonFig(n: number): HTMLElement {
  const P: Pt[] = Array.from({ length: n }, (_, i) => { const a = rad(-90 - 180 / n + (360 * i) / n); return [2 * Math.cos(a), 2 * Math.sin(a)]; });
  const cols = [C1, C2, C3, C4, C6];
  const items: Item[] = [];
  for (let i = 1; i < n - 1; i++) items.push({ t: 'poly', pts: [P[0], P[i], P[i + 1]], fill: tint(cols[(i - 1) % 5], 30), stroke: 'var(--muted)', w: 1.2 });
  items.push({ t: 'poly', pts: P, w: 2.6 }, { t: 'dot', at: P[0] });
  return fig(items, [-2.3, -2.3, 2.3, 2.3], 260);
}
export const polygonExplorer: Widget = explorer({
  params: [{ id: 'n', label: 'sides', min: 3, max: 10, step: 1, value: 4 }],
  draw: (v) => polygonFig(v.n),
  readout: (v) => `${v.n} sides → ${v.n - 2} triangles → ${v.n - 2} × 180° = ${(v.n - 2) * 180}°`,
});
export const polygonW = (n: number): Widget => () => polygonFig(n);

// ---------------------------------------------------------------- lesson 2: area

const lab = (at: Pt, s: string, color?: string): Item => ({ t: 'text', at, s, color });

/** Rectangle 6x4 beside a parallelogram with base 6, height 4 and slanted side 5. */
export const rectVsPara: Widget = () => fig([
  { t: 'poly', pts: [[0, 0], [6, 0], [6, 4], [0, 4]], fill: tint(C1, 30), stroke: C1 },
  lab([3, -0.55], '6'), lab([-0.5, 2], '4'),
  { t: 'poly', pts: [[8, 0], [14, 0], [17, 4], [11, 4]], fill: tint(C2, 30), stroke: C2 },
  { t: 'poly', pts: [[11, 4], [11, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 },
  { t: 'right', at: [11, 0], u: [1, 0], v: [0, 1] },
  lab([12.5, -0.55], '6'), lab([10.55, 2], '4'), lab([16.2, 1.7], '5'),
], [-1.1, -1.1, 17.6, 4.6]);

/** A parallelogram with base, height and slanted side labelled. */
export function paraFig(base: number, height: number, off: number, labels: { base: string; height: string; side?: string }): Widget {
  return () => fig([
    { t: 'poly', pts: [[0, 0], [base, 0], [base + off, height], [off, height]], fill: tint(C2, 30), stroke: C2 },
    { t: 'poly', pts: [[off, height], [off, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 },
    { t: 'right', at: [off, 0], u: [1, 0], v: [0, 1] },
    lab([base / 2, -0.6], labels.base), lab([off - 0.45, height / 2], labels.height),
    ...(labels.side ? [lab([base + off / 2 + 0.55, height / 2], labels.side)] : []),
  ], [-0.8, -1.2, base + off + 1.2, height + 0.6]);
}

/** Cut a triangle off a parallelogram and slide it across: a rectangle with the same area. */
export function paraToRect(): HTMLElement {
  const b = 6, hgt = 4, o = 2;
  const view: [number, number, number, number] = [-0.6, -1.2, 8.8, 4.6];
  const tri = (dx: number, dy = 0): Item => ({ t: 'poly', pts: [[dx, dy], [o + dx, dy], [o + dx, hgt + dy]], fill: tint(C1, 45), stroke: C1 });
  const rest: Item = { t: 'poly', pts: [[o, 0], [b, 0], [b + o, hgt], [o, hgt]], fill: tint(C2, 30), stroke: C2 };
  return stepper(4, (i) => {
    const base: Item[] = [lab([b / 2 + (i === 3 ? o : 0), -0.6], `base ${b}`), lab([o + 0.5, hgt / 2], `${hgt}`)];
    if (i === 0) return fig([{ t: 'poly', pts: [[0, 0], [b, 0], [b + o, hgt], [o, hgt]], fill: tint(C2, 30), stroke: C2 }, { t: 'poly', pts: [[o, hgt], [o, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 }, ...base], view);
    if (i === 1) return fig([rest, tri(0), ...base], view);
    if (i === 2) return fig([rest, tri(3, 0.5), ...base], view);
    return fig([rest, tri(b), ...base], view);
  }, { caption: (i) => ['A parallelogram: base 6, height 4.', 'Cut along the height: a triangle comes off.', 'Slide the triangle across…', '…it fits the other end exactly: a 6 × 4 rectangle, area 24.'][i] });
}

/** Explorer: shear a parallelogram (slide its top edge); the area never changes. Goal: offset 6. */
export const shearExplorer: Widget = explorer({
  params: [{ id: 's', label: 'slide top', min: 0, max: 8, step: 1, value: 0 }],
  draw: (v) => fig([
    { t: 'grid', from: [0, 0], to: [14, 4] },
    { t: 'poly', pts: [[0, 0], [6, 0], [6 + v.s, 4], [v.s, 4]], fill: tint(C2, 35), stroke: C2 },
    { t: 'dot', at: [v.s, 4], color: C1 }, { t: 'dot', at: [6, 0], color: C1 },
  ], [-0.4, -0.4, 14.4, 4.4]),
  readout: (v) => { const side = Math.hypot(v.s, 4); return `area 6 × 4 = 24 · slanted side ${num(side)} · perimeter ${num(12 + 2 * side)}`; },
  goal: (v) => v.s === 6,
  goalText: 'Top-left corner right above bottom-right. Still 24.',
});

/** A deck of cards, straight and pushed: same cards, same area. */
export const cardStacks: Widget = () => {
  const items: Item[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    items.push({ t: 'poly', pts: [[0, i * 0.5], [4, i * 0.5], [4, i * 0.5 + 0.5], [0, i * 0.5 + 0.5]], fill: tint(i % 2 ? C1 : C3, 40), stroke: 'var(--muted)', w: 1 });
    const s = i * 0.35;
    items.push({ t: 'poly', pts: [[6 + s, i * 0.5], [10 + s, i * 0.5], [10 + s, i * 0.5 + 0.5], [6 + s, i * 0.5 + 0.5]], fill: tint(i % 2 ? C1 : C3, 40), stroke: 'var(--muted)', w: 1 });
  }
  return fig(items, [-0.3, -0.3, 13.3, 4.3]);
};

/** A triangle, then a copy turned half a turn, together making a parallelogram. */
export function triToPara(): HTMLElement {
  const T: Pt[] = [[0, 0], [6, 0], [2, 4]], Cp: Pt[] = [[8, 4], [2, 4], [6, 0]];
  const view: [number, number, number, number] = [-0.6, -1.2, 8.8, 4.6];
  return stepper(3, (i) => fig([
    ...(i >= 1 ? [{ t: 'poly', pts: Cp, fill: tint(C2, 30), stroke: C2, dash: i === 1 } as Item] : []),
    { t: 'poly', pts: T, fill: tint(C1, 35), stroke: C1 },
    { t: 'poly', pts: [[2, 4], [2, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 },
    lab([3, -0.6], 'base 6'), lab([1.6, 1.4], '4'),
    ...(i === 2 ? [lab([5.4, 3.1], 'copy', C2)] : []),
  ], view), { caption: (i) => ['A triangle: base 6, height 4.', 'Make a copy and turn it half a turn.', 'Together: a parallelogram 6 × 4 = 24. The triangle is half: 12.'][i] });
}

/** Two copies of a trapezoid make a parallelogram with base a + b. */
export function trapToPara(): HTMLElement {
  const T: Pt[] = [[0, 0], [7, 0], [4, 3], [1, 3]], Cp: Pt[] = [[7, 0], [10, 0], [11, 3], [4, 3]];
  const view: [number, number, number, number] = [-0.6, -1.2, 11.6, 3.9];
  return stepper(3, (i) => fig([
    ...(i >= 1 ? [{ t: 'poly', pts: Cp, fill: tint(C2, 30), stroke: C2, dash: i === 1 } as Item] : []),
    { t: 'poly', pts: T, fill: tint(C1, 35), stroke: C1 },
    lab([3.5, -0.55], 'a = 7', C1), lab([2.5, 3.5], 'b = 3', C1),
    ...(i >= 1 ? [lab([8.5, -0.55], 'b', C2), lab([7.5, 3.5], 'a', C2)] : []),
    ...(i === 2 ? [lab([5.5, 1.5], 'base a + b = 10')] : []),
  ], view), { caption: (i) => ['A trapezoid: parallel sides 7 and 3, height 3.', 'Copy it and turn the copy half a turn.', 'A parallelogram, base 7 + 3 = 10, height 3: area 30. One trapezoid: 15.'][i] });
}

export function trapFig(a: number, b: number, hgt: number): Widget {
  const off = (a - b) / 2;
  return () => fig([
    { t: 'poly', pts: [[0, 0], [a, 0], [off + b, hgt], [off, hgt]], fill: tint(C3, 30), stroke: C3 },
    { t: 'poly', pts: [[off, hgt], [off, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 },
    { t: 'right', at: [off, 0], u: [1, 0], v: [0, 1] },
    lab([a / 2, -0.6], String(a)), lab([off + b / 2, hgt + 0.5], String(b)), lab([off + 0.45, hgt / 2], String(hgt)),
  ], [-0.6, -1.2, a + 0.6, hgt + 1]);
}

// ---------------------------------------------------------------- lesson 3: Pythagoras

/** Right triangle (legs a along x, b along y) with a square on each side. */
function pythItems(a: number, b: number, opts: { grid?: boolean; cLabel?: string } = {}): Item[] {
  const c = Math.hypot(a, b);
  const items: Item[] = [];
  if (opts.grid) items.push({ t: 'grid', from: [-b, -a], to: [a + b, a + b] });
  items.push(
    { t: 'poly', pts: [[0, 0], [a, 0], [a, -a], [0, -a]], fill: tint(C1, 30), stroke: C1 },
    { t: 'poly', pts: [[0, 0], [0, b], [-b, b], [-b, 0]], fill: tint(C2, 30), stroke: C2 },
    { t: 'poly', pts: [[a, 0], [a + b, a], [b, a + b], [0, b]], fill: tint(C3, 30), stroke: C3 },
    { t: 'poly', pts: [[0, 0], [a, 0], [0, b]], fill: 'var(--panel)' },
    { t: 'right', at: [0, 0], u: [1, 0], v: [0, 1] },
    lab([a / 2, -a / 2], `a² = ${a * a}`, C1), lab([-b / 2, b / 2], `b² = ${b * b}`, C2),
    lab([(a + b) / 2, (a + b) / 2 + 0.2], opts.cLabel ?? `c² = ${a * a + b * b}`, C3),
    lab([a / 2, 0.4], `a = ${a}`), lab([0.75, b / 2], `b = ${b}`, undefined),
  );
  if (Math.abs(c - Math.round(c)) < 1e-9) items.push(lab([a / 2 + 0.6, b / 2 + 0.5], `c = ${c}`));
  return items;
}
export const pythGrid: Widget = () => fig(pythItems(3, 4, { grid: true, cLabel: '?' }).filter((it) => !(it.t === 'text' && it.s.startsWith('c ='))), [-4.5, -3.5, 7.5, 7.5], 360);
export const pythExplorer: Widget = explorer({
  params: [
    { id: 'a', label: 'a', min: 1, max: 6, step: 1, value: 3 },
    { id: 'b', label: 'b', min: 1, max: 6, step: 1, value: 4 },
  ],
  draw: (v) => fig(pythItems(v.a, v.b, { grid: true }), [-v.b - 0.6, -v.a - 0.6, v.a + v.b + 0.6, v.a + v.b + 0.6], 360),
  readout: (v) => `${v.a}² + ${v.b}² = ${v.a * v.a + v.b * v.b} = c², so c ≈ ${num(Math.hypot(v.a, v.b))}`,
});

/** The rearrangement proof: the same big square holds 4 triangles + c², or 4 triangles + a² + b². */
export function pythProof(): HTMLElement {
  const a = 2, b = 3.4, s = a + b, g = 1.2;
  const triA: Pt[][] = [
    [[0, 0], [a, 0], [0, b]], [[a, 0], [s, 0], [s, a]], [[s, a], [s, s], [b, s]], [[b, s], [0, s], [0, b]],
  ];
  const R = s + g;
  const triB: Pt[][] = [
    [[R + a, 0], [R + s, 0], [R + s, a]], [[R + a, 0], [R + a, a], [R + s, a]],
    [[R, a], [R + a, a], [R + a, s]], [[R, a], [R + a, s], [R, s]],
  ];
  const tri = (p: Pt[]): Item => ({ t: 'poly', pts: p, fill: tint(C6, 30), stroke: C6, w: 1.6 });
  const view: [number, number, number, number] = [-0.3, -0.9, 2 * s + g + 0.3, s + 0.3];
  return stepper(3, (i) => {
    const items: Item[] = [
      { t: 'poly', pts: [[0, 0], [s, 0], [s, s], [0, s]] },
      { t: 'poly', pts: [[a, 0], [s, a], [b, s], [0, b]], fill: tint(C3, 35), stroke: C3 },
      ...triA.map(tri), lab([s / 2, s / 2], 'c²', C3), lab([s / 2, -0.5], 'side a + b'),
      { t: 'poly', pts: [[R, 0], [R + s, 0], [R + s, s], [R, s]], dash: i === 0, stroke: i === 0 ? 'var(--muted)' : 'var(--text)' },
    ];
    if (i >= 1) {
      items.push({ t: 'poly', pts: [[R, 0], [R + a, 0], [R + a, a], [R, a]], fill: tint(C1, 35), stroke: C1 },
        { t: 'poly', pts: [[R + a, a], [R + s, a], [R + s, s], [R + a, s]], fill: tint(C2, 35), stroke: C2 },
        ...triB.map(tri), lab([R + a / 2, a / 2], 'a²', C1), lab([R + a + b / 2, a + b / 2], 'b²', C2), lab([R + s / 2, -0.5], 'side a + b'));
    }
    return fig(items, view, 420);
  }, { caption: (i) => [
    'A square of side a + b holding four copies of the triangle. The gap in the middle is a square on c.',
    'The same square, the same four triangles, moved. Now the gaps are a square on a and a square on b.',
    'Same big square minus the same four triangles: the gaps have equal area. c² = a² + b².'][i] });
}

/** A right triangle with labelled sides (legs a, b; hypotenuse c). */
export function rightTri(a: number, b: number, la: string, lb: string, lc: string): Widget {
  const s = Math.max(a, b);
  return () => fig([
    { t: 'poly', pts: [[0, 0], [a, 0], [0, b]], fill: tint(C3, 25), stroke: C3 },
    { t: 'right', at: [0, 0], u: [1, 0], v: [0, 1] },
    lab([a / 2, -s * 0.08], la), lab([-s * 0.08, b / 2], lb, undefined),
    lab([a / 2 + s * 0.08, b / 2 + s * 0.06], lc),
  ], [-s * 0.2, -s * 0.16, a + s * 0.15, b + s * 0.1], 340);
}

/** A square field: walking the diagonal vs along two sides. */
export const fieldFig: Widget = () => fig([
  { t: 'poly', pts: [[0, 0], [100, 0], [100, 100], [0, 100]], fill: tint(C3, 20), stroke: C3 },
  { t: 'poly', pts: [[0, 0], [100, 0], [100, 100]], open: true, stroke: C2, w: 3, dash: true },
  { t: 'poly', pts: [[0, 0], [100, 100]], open: true, stroke: C1, w: 3 },
  lab([50, -8], '100 m'), lab([111, 50], '100 m'), lab([40, 55], 'diagonal', C1),
], [-10, -16, 125, 106], 300);

// ---------------------------------------------------------------- lesson 4: circles

export function circleFig(r: number, label: string, mode: 'd' | 'r' = 'd'): Widget {
  return () => fig([
    { t: 'circle', c: [0, 0], r, fill: tint(C1, 20), stroke: C1 },
    { t: 'poly', pts: [[mode === 'd' ? -r : 0, 0], [r, 0]], open: true, stroke: C2, w: 2.6 },
    { t: 'dot', at: [0, 0] },
    lab([mode === 'd' ? 0 : r / 2, r * 0.16], label, C2),
  ], [-r * 1.15, -r * 1.15, r * 1.15, r * 1.15], 220);
}

/** Roll a circle of diameter 1 one full turn: it covers π ≈ 3.14 diameters. */
export function rollCircle(): HTMLElement {
  const r = 0.5;
  const view: [number, number, number, number] = [-0.3, -0.6, 4.1, 1.25];
  return stepper(3, (i) => {
    const t = [0, 0.5, 1][i] * Math.PI; // distance rolled
    const cx = r + t;
    const ang = -90 - (t / r) * (180 / Math.PI); // marked point starts at bottom, turns clockwise
    const mark: Pt = [cx + r * Math.cos(rad(ang)), r + r * Math.sin(rad(ang))];
    const items: Item[] = [
      { t: 'poly', pts: [[-0.2, 0], [4, 0]], open: true, stroke: 'var(--muted)' },
      { t: 'poly', pts: [[r, 0], [r + t, 0]], open: true, stroke: C2, w: 4 },
      { t: 'circle', c: [cx, r], r, fill: tint(C1, 20), stroke: C1 },
      { t: 'poly', pts: [[cx - r, r], [cx + r, r]], open: true, stroke: 'var(--muted)', w: 1.5, dash: true },
      { t: 'dot', at: mark, color: C2 },
    ];
    if (i === 2) for (let k = 1; k <= 3; k++) items.push({ t: 'poly', pts: [[r + k, -0.1], [r + k, 0.1]], open: true, w: 2 }, lab([r + k, -0.3], `${k}d`));
    return fig(items, view, 420);
  }, { caption: (i) => ['A wheel of diameter d. Mark the point touching the ground.', 'Half a turn: the mark is at the top.', 'One full turn: the wheel has rolled a bit more than 3 diameters: π × d ≈ 3.14 d.'][i] });
}

/** Explorer: cut a circle into n slices and lay them top-to-tail: nearly a rectangle r by πr. */
function slicesFig(n: number): HTMLElement {
  const r = 1, th = 360 / n, a = r * Math.sin(rad(th / 2)), cH = r * Math.cos(rad(th / 2));
  const items: Item[] = [];
  for (let i = 0; i < n; i++) items.push({ t: 'wedge', c: [1, 0], r, a0: i * th, a1: (i + 1) * th, fill: tint(i < n / 2 ? C1 : C2, 55), stroke: 'var(--panel)' });
  items.push({ t: 'circle', c: [1, 0], r });
  const x0 = 2.5, y0 = -0.55;
  for (let j = 0; j < n / 2; j++) {
    items.push({ t: 'wedge', c: [x0 + 2 * a * j + a, y0], r, a0: 90 - th / 2, a1: 90 + th / 2, fill: tint(C1, 55), stroke: 'var(--panel)' });
    items.push({ t: 'wedge', c: [x0 + 2 * a * j + 2 * a, y0 + cH], r, a0: 270 - th / 2, a1: 270 + th / 2, fill: tint(C2, 55), stroke: 'var(--panel)' });
  }
  items.push(lab([x0 + Math.PI / 2, y0 - 0.32], 'about πr wide'), lab([x0 - 0.18, y0 + 0.5], 'r', undefined));
  return fig(items, [-0.1, -1.15, x0 + Math.PI + 0.75, 1.1], 420);
}
export const slicesExplorer: Widget = explorer({
  params: [{ id: 'n', label: 'slices', min: 4, max: 40, step: 2, value: 6 }],
  draw: (v) => slicesFig(v.n),
  readout: (v) => { const a = Math.sin(Math.PI / v.n); return `${v.n} slices: ${num(v.n * a, 3)} wide (π ≈ 3.142), ${num(Math.cos(Math.PI / v.n), 3)} tall (r = 1)`; },
});

/** Circles drawn to scale, side by side, with labels. */
export function circlesRow(ds: number[], labels: string[]): Widget {
  return () => {
    const items: Item[] = [];
    let x = 0;
    const cols = [C1, C2, C2, C3];
    ds.forEach((d, i) => {
      items.push({ t: 'circle', c: [x + d / 2, d / 2], r: d / 2, fill: tint(cols[i % 4], 25), stroke: cols[i % 4] }, lab([x + d / 2, d / 2], labels[i], cols[i % 4]));
      x += d + 1.2;
    });
    const H = Math.max(...ds);
    return fig(items, [-0.4, -0.4, x - 0.8, H + 0.4], 380);
  };
}

// ---------------------------------------------------------------- lesson 5: similarity

/** A stick and a tree with their shadows under parallel sun rays. */
export function shadowFig(stick: number, sShadow: number, tShadow: number, treeLabel = '?'): Widget {
  const tree = (stick * tShadow) / sShadow;
  const gap = Math.max(2, sShadow * 1.4);
  return () => fig([
    { t: 'poly', pts: [[-0.5, 0], [gap + tShadow + 1, 0]], open: true, stroke: 'var(--muted)' },
    { t: 'poly', pts: [[0, stick], [sShadow, 0]], open: true, stroke: C5Ray, dash: true, w: 1.8 },
    { t: 'poly', pts: [[gap, tree], [gap + tShadow, 0]], open: true, stroke: C5Ray, dash: true, w: 1.8 },
    { t: 'poly', pts: [[0, 0], [sShadow, 0]], open: true, stroke: 'var(--text)', w: 5 },
    { t: 'poly', pts: [[gap, 0], [gap + tShadow, 0]], open: true, stroke: 'var(--text)', w: 5 },
    { t: 'poly', pts: [[0, 0], [0, stick]], open: true, stroke: C2, w: 4 },
    { t: 'poly', pts: [[gap, 0], [gap, tree]], open: true, stroke: C3, w: 6 },
    { t: 'circle', c: [gap, tree], r: Math.max(0.6, tree * 0.08), fill: tint(C3, 50), stroke: C3 },
    lab([-0.25, stick + 0.9], `${stick} m`, C2), lab([sShadow / 2 + 0.2, -0.9], `${sShadow} m`),
    lab([gap - 0.6, tree / 2], treeLabel, C3), lab([gap + tShadow / 2, -0.9], `${tShadow} m`),
  ], [-1.8, -1.8, gap + tShadow + 1.2, tree + Math.max(0.6, tree * 0.08) + 0.6], 400);
}
const C5Ray = 'var(--c5)';

/** Explorer: scale a 3-4-5 triangle by k. Lengths scale, angles stay. */
export const scaleExplorer: Widget = explorer({
  params: [{ id: 'k', label: 'scale ×', min: 0.5, max: 3, step: 0.5, value: 2 }],
  draw: (v) => {
    const k = v.k, ox = 5;
    return fig([
      { t: 'grid', from: [0, 0], to: [ox + 12, 9] },
      { t: 'poly', pts: [[0, 0], [4, 0], [0, 3]], fill: tint(C1, 30), stroke: C1 },
      { t: 'poly', pts: [[ox, 0], [ox + 4 * k, 0], [ox, 3 * k]], fill: tint(C2, 30), stroke: C2 },
      lab([2, -0.6], '4', C1), lab([-0.5, 1.5], '3', C1), lab([2.5, 2], '5', C1),
      lab([ox + 2 * k, -0.6], num(4 * k), C2), lab([ox - 0.6, 1.5 * k], num(3 * k), C2), lab([ox + 2 * k + 0.5, 1.5 * k + 0.6], num(5 * k), C2),
    ], [-1.1, -1.2, ox + 12.4, 9.4], 400);
  },
  readout: (v) => `every side × ${v.k}; angles unchanged (90°, ≈36.9°, ≈53.1°)`,
});

/** Thumb at arm's length covering a distant car: similar triangles from the eye. */
export const thumbFig: Widget = () => fig([
  { t: 'poly', pts: [[0, 0], [12, 2], [12, -2]], fill: tint(C1, 15), stroke: 'var(--muted)', dash: true, w: 1.5 },
  { t: 'poly', pts: [[2.4, -0.4], [2.4, 0.4]], open: true, stroke: C2, w: 5 },
  { t: 'poly', pts: [[12, -2], [12, 2]], open: true, stroke: C3, w: 6 },
  { t: 'dot', at: [0, 0] }, lab([0, -0.6], 'eye'), lab([2.4, 0.95], 'thumb 2 cm', C2), lab([2.4, -1.0], '60 cm away'),
  lab([10.6, 2.4], 'car 4 m', C3), lab([7, -2.4], 'how far?'),
], [-0.8, -3, 13, 3], 380);

// ---------------------------------------------------------------- lesson 6: square-cube

/** A k x k x k cube of unit cubes in isometric view, at a fixed scale (fits k up to `maxK`). */
function cubeFig(k: number, maxK = 5): HTMLElement {
  const c30 = Math.cos(Math.PI / 6);
  const P = (x: number, y: number, z: number): Pt => [(x - y) * c30, z - (x + y) / 2];
  const items: Item[] = [];
  const face = (pts: Pt[], fill: string) => items.push({ t: 'poly', pts, fill, stroke: 'var(--text)', w: 1.8 });
  face([P(0, 0, k), P(k, 0, k), P(k, k, k), P(0, k, k)], tint(C1, 45));
  face([P(k, 0, 0), P(k, k, 0), P(k, k, k), P(k, 0, k)], tint(C1, 70));
  face([P(0, k, 0), P(k, k, 0), P(k, k, k), P(0, k, k)], tint(C1, 25));
  const ln = (a: Pt, b: Pt) => items.push({ t: 'poly', pts: [a, b], open: true, stroke: 'var(--text)', w: 0.8 });
  for (let i = 1; i < k; i++) {
    ln(P(i, 0, k), P(i, k, k)); ln(P(0, i, k), P(k, i, k)); // top
    ln(P(k, i, 0), P(k, i, k)); ln(P(k, 0, i), P(k, k, i)); // right
    ln(P(i, k, 0), P(i, k, k)); ln(P(0, k, i), P(k, k, i)); // left
  }
  const m = maxK * c30 + 0.3;
  return fig(items, [-m, -maxK - 0.3, m, maxK + 0.3], 260);
}
export const cubeW = (k: number, maxK = 3): Widget => () => cubeFig(k, maxK);
export const cubeExplorer: Widget = explorer({
  params: [{ id: 'k', label: 'side', min: 1, max: 5, step: 1, value: 1 }],
  draw: (v) => cubeFig(v.k),
  readout: (v) => `side ${v.k}: surface ${6 * v.k * v.k} squares · volume ${v.k ** 3} cube${v.k > 1 ? 's' : ''}`,
  goal: (v) => v.k ** 3 === 64,
  goalText: '64 sugar cubes: side 4.',
});

/** One big ice cube next to the same ice cut into small cubes. */
export const iceFig: Widget = () => {
  const c30 = Math.cos(Math.PI / 6);
  const P = (x: number, y: number, z: number, ox = 0): Pt => [ox + (x - y) * c30, z - (x + y) / 2];
  const items: Item[] = [];
  const cube = (x: number, y: number, z: number, s: number, ox: number) => {
    items.push(
      { t: 'poly', pts: [P(x, y, z + s, ox), P(x + s, y, z + s, ox), P(x + s, y + s, z + s, ox), P(x, y + s, z + s, ox)], fill: tint(C1, 30), stroke: C1, w: 1.2 },
      { t: 'poly', pts: [P(x + s, y, z, ox), P(x + s, y + s, z, ox), P(x + s, y + s, z + s, ox), P(x + s, y, z + s, ox)], fill: tint(C1, 55), stroke: C1, w: 1.2 },
      { t: 'poly', pts: [P(x, y + s, z, ox), P(x + s, y + s, z, ox), P(x + s, y + s, z + s, ox), P(x, y + s, z + s, ox)], fill: tint(C1, 18), stroke: C1, w: 1.2 });
  };
  cube(0, 0, 0, 3, 0);
  // Small cubes, spread apart so every face shows (draw back to front).
  for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) cube(x * 1.5, y * 1.5, z * 1.5, 0.8, 7.5);
  items.push(lab([0, -3.9], 'one cube'), lab([7.5, -3.9], 'cut up (a few drawn)'));
  return fig(items, [-3.2, -4.4, 12.2, 4.4], 400);
};

// ---------------------------------------------------------------- lesson 8: estimating

/** A square metre ruled into 10 cm squares. */
export const squareMetre: Widget = () => fig([
  { t: 'poly', pts: [[0, 0], [10, 0], [10, 10], [0, 10]], fill: tint(C3, 18), stroke: C3 },
  { t: 'grid', from: [0, 0], to: [10, 10] },
  { t: 'poly', pts: [[0, 0], [1, 0], [1, 1], [0, 1]], fill: tint(C2, 60), stroke: C2 },
  { t: 'poly', pts: [[0, 0], [10, 0], [10, 10], [0, 10]], stroke: C3, w: 2.6 },
  lab([5, -0.8], '1 m = 100 cm'), lab([2.6, 0.5], '10 × 10 cm = 100 cm²', C2),
], [-0.6, -1.6, 10.6, 10.6], 300);

/** A box with three labelled edges (length along x, width along y, height), in isometric view. */
export function boxFig(L: number, W: number, H: number, labels: [string, string, string]): Widget {
  const c30 = Math.cos(Math.PI / 6);
  const P = (x: number, y: number, z: number): Pt => [(x - y) * c30, z - (x + y) / 2];
  const s = 4 / Math.max(L, W, H);
  const [l, w, hh] = [L * s, W * s, H * s];
  const at = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];
  return () => fig([
    { t: 'poly', pts: [P(0, 0, hh), P(l, 0, hh), P(l, w, hh), P(0, w, hh)], fill: tint(C1, 30), stroke: C1 },
    { t: 'poly', pts: [P(l, 0, 0), P(l, w, 0), P(l, w, hh), P(l, 0, hh)], fill: tint(C1, 50), stroke: C1 },
    { t: 'poly', pts: [P(0, w, 0), P(l, w, 0), P(l, w, hh), P(0, w, hh)], fill: tint(C1, 18), stroke: C1 },
    { t: 'text', at: at(P(l / 2, w, 0), -0.6, -0.45), s: labels[0], anchor: 'end' },
    { t: 'text', at: at(P(l, w / 2, 0), 0.6, -0.45), s: labels[1], anchor: 'start' },
    { t: 'text', at: at(P(l, 0, hh / 2), 0.3, 0), s: labels[2], anchor: 'start' },
  ], [-(w * c30) - 3.2, -(l + w) / 2 - 1, l * c30 + 3.4, hh + 0.4], 360);
}
