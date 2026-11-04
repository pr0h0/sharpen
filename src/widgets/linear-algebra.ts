// Pictures for the Linear Algebra course: vectors on an equal-scale grid, draggable arrow tips, a
// plane transformed by a 2×2 matrix (where î and ĵ land), areas, spans and eigen-directions.
// Built on the shared plot renderer (src/viz/plot.ts); colours are theme CSS variables.
import type { Layer, PlotSpec, Widget } from '../types';
import { h, num, svg } from '../ui';
import { stepper } from '../viz/explore';
import { drawLayer, plot, plotEl } from '../viz/plot';
import { tint } from './geometry';

export type V = [number, number];
/** A 2×2 matrix by rows: [a, b, c, d] is [a b; c d], with columns (a, c) and (b, d). */
export type M = [number, number, number, number];

// ---------------------------------------------------------------- arithmetic

export const add = (u: V, v: V): V => [u[0] + v[0], u[1] + v[1]];
export const sub = (u: V, v: V): V => [u[0] - v[0], u[1] - v[1]];
export const mulS = (k: number, v: V): V => [k * v[0] + 0, k * v[1] + 0];
export const dot = (u: V, v: V) => u[0] * v[0] + u[1] * v[1];
export const len = (v: V) => Math.hypot(v[0], v[1]);
/** z-component of the 3D cross product: 0 exactly when u and v lie on one line. */
export const cross = (u: V, v: V) => u[0] * v[1] - u[1] * v[0];
export const apply = (m: M, v: V): V => [m[0] * v[0] + m[1] * v[1] + 0, m[2] * v[0] + m[3] * v[1] + 0];
export const mul = (A: M, B: M): M => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
export const det = (m: M) => m[0] * m[3] - m[1] * m[2];
export const inv = (m: M): M => { const d = det(m); return [m[3] / d + 0, -m[1] / d + 0, -m[2] / d + 0, m[0] / d + 0]; };
export const cols = (m: M): [V, V] => [[m[0], m[2]], [m[1], m[3]]];
export const fromCols = (i: V, j: V): M => [i[0], j[0], i[1], j[1]];
export const sameM = (A: M, B: M) => A.every((x, k) => Math.abs(x - B[k]) < 1e-9);
export const sameV = (u: V, v: V) => Math.abs(u[0] - v[0]) < 1e-9 && Math.abs(u[1] - v[1]) < 1e-9;
export const ID: M = [1, 0, 0, 1];

/** A number with a real minus sign and no "-0". */
export const n = (x: number) => num(x + 0).replace(/^-/, '−');
export const vs = (v: V) => `(${n(v[0])}, ${n(v[1])})`;
export const ms = (m: M) => `[${n(m[0])} ${n(m[1])}; ${n(m[2])} ${n(m[3])}]`;

export const CI = 'var(--c3)', CJ = 'var(--c4)', CA = 'var(--c1)', CB = 'var(--c2)', CT = 'var(--c6)';

// ---------------------------------------------------------------- static pictures

/** An equal-scale grid from −r to r on both axes. */
export function planeSpec(layers: Layer[], r = 5): PlotSpec {
  return { x: [-r, r], y: [-r, r], equal: true, grid: true, ticks: [1, 1], size: [400, 400], layers };
}
export const arrow = (v: V, color: string, label?: string, from: V = [0, 0]): Layer => ({ type: 'arrow', from, to: add(from, v), color, label });
export const polyL = (pts: V[], color: string, dash = false): Layer => ({ type: 'line', pts, closed: true, color, fill: dash ? undefined : tint(color, 28), dash, width: 2 });

/** The grid lines x = k and y = k after the matrix m: still parallel and evenly spaced. */
export function gridLayers(m: M, N = 12): Layer[] {
  const out: Layer[] = [];
  const color = tint('var(--c1)', 55);
  for (let k = -N; k <= N; k++) {
    const width = k === 0 ? 2 : 1;
    out.push({ type: 'line', pts: [apply(m, [k, -N]), apply(m, [k, N])], color, width });
    out.push({ type: 'line', pts: [apply(m, [-N, k]), apply(m, [N, k])], color, width });
  }
  return out;
}
export const unitSquare = (m: M, color = 'var(--c5)', dash = false): Layer => polyL([[0, 0], apply(m, [1, 0]), apply(m, [1, 1]), apply(m, [0, 1])], color, dash);
/** Transformed grid, the image of the unit square and the two basis arrows î, ĵ. */
export function transformLayers(m: M, square = true): Layer[] {
  const [i, j] = cols(m);
  return [...gridLayers(m), ...(square ? [unitSquare(m)] : []), arrow(i, CI, 'î'), arrow(j, CJ, 'ĵ')];
}
export const transformFig = (m: M, extra: Layer[] = [], r = 5): Widget => () => plotEl(planeSpec([...transformLayers(m), ...extra], r));
export const planeFig = (layers: Layer[], r = 5): Widget => () => plotEl(planeSpec(layers, r));

type Ent = number | string;
/** A bracketed matrix (4 entries, by rows) or column vector (2 entries). */
export function matEl(x: Ent[]): HTMLElement {
  const c = x.length === 4 ? 2 : 1;
  return h('span', {
    style: `display:inline-grid;grid-template-columns:repeat(${c},auto);gap:2px 14px;padding:4px 9px;border-left:2px solid var(--text);border-right:2px solid var(--text);border-radius:7px;font-variant-numeric:tabular-nums;text-align:center;font-size:1.1rem`,
  }, x.map((v) => h('span', null, typeof v === 'number' ? n(v) : v)));
}
/** A row of matrices, vectors and symbols: eqn([A, '×', v, '=', ['?', '?']]). */
export const eqn = (parts: (Ent[] | string)[]): Widget => () => h('div', { style: 'display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:8px 0;font-size:1.1rem' },
  parts.map((p) => (typeof p === 'string' ? h('span', null, p) : matEl(p))));

/** A picture and an equation under it. */
export const withEqn = (pic: Widget, parts: (Ent[] | string)[]): Widget => (ctx) => h('div', null, pic(ctx), eqn(parts)(ctx));

/** Vectors v (dashed, dot at the tip) and where the matrix sends them (solid arrows, same colour). */
export function imagesFig(m: M, vecs: V[], names: string[], r = 4): Widget {
  const colors = [CA, CB, CI, CJ, CT];
  const layers: Layer[] = [];
  vecs.forEach((v, k) => {
    const c = colors[k % colors.length];
    layers.push({ type: 'line', pts: [[0, 0], v], color: c, dash: true, width: 2 }, { type: 'dots', pts: [v], color: c, labels: [names[k]] }, arrow(apply(m, v), c));
  });
  return planeFig(layers, r);
}

const L_SHAPE: V[] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 3], [0, 3]];
/** An L-shape put through the matrices one after another (frame 0 = untouched). */
export function composeSteps(ms_: M[], caps: string[], r = 5): Widget {
  return () => stepper(ms_.length + 1, (i) => {
    let m = ID;
    for (let k = 0; k < i; k++) m = mul(ms_[k], m);
    return plotEl(planeSpec([polyL(L_SHAPE, 'var(--muted)', true), polyL(L_SHAPE.map((p) => apply(m, p)), CA)], r));
  }, { caption: (i) => caps[i] });
}

// ---------------------------------------------------------------- drag the tips

export interface Handle { at: V; color: string }
export interface DragOpts {
  handles: Handle[];
  layers: (p: V[]) => Layer[];
  readout?: (p: V[]) => string;
  /** Shown above the readout, e.g. the current matrix. */
  extra?: (p: V[]) => Node;
  goal?: (p: V[]) => boolean;
  goalText?: string;
  r?: number;
  snap?: number;
}

/** An equal-scale grid with draggable points (arrow tips). Tap near a dot and drag it. */
export function dragPlane(o: DragOpts): Widget {
  return (ctx) => {
    const r = o.r ?? 5, snap = o.snap ?? 1;
    const p: V[] = o.handles.map((x) => [x.at[0], x.at[1]]);
    const v = plot(planeSpec([], r));
    const labels = svg('g', {}), knobs = svg('g', {});
    v.el.append(labels, knobs);
    v.el.classList.add('pickable');
    v.el.style.touchAction = 'none';
    const read = h('div', { class: 'readout' });
    const side = h('div');
    const done = h('div', { class: 'goal-ok', hidden: true }, '✓ ', o.goalText ?? 'That’s it.');
    const redraw = () => {
      v.marks.replaceChildren();
      labels.replaceChildren();
      knobs.replaceChildren();
      o.layers(p).forEach((l, i) => drawLayer(v, l, i, labels));
      o.handles.forEach((x, i) => knobs.appendChild(svg('circle', { cx: v.px(p[i][0]), cy: v.py(p[i][1]), r: 11, style: `fill:${tint(x.color, 30)};stroke:${x.color};stroke-width:2.5;cursor:grab` })));
      if (o.readout) read.textContent = o.readout(p);
      if (o.extra) side.replaceChildren(o.extra(p));
      if (o.goal) {
        const ok = o.goal(p);
        done.hidden = !ok;
        ctx.solved?.(ok);
      }
    };
    const toData = (e: PointerEvent): V => {
      const b = v.el.getBoundingClientRect(), vb = v.el.viewBox.baseVal;
      return [v.dx(((e.clientX - b.left) / b.width) * vb.width), v.dy(((e.clientY - b.top) / b.height) * vb.height)];
    };
    let cur = -1;
    const move = (q: V) => {
      const s = (x: number) => Math.max(-r, Math.min(r, Math.round(x / snap) * snap)) + 0;
      const nx = s(q[0]), ny = s(q[1]);
      if (nx === p[cur][0] && ny === p[cur][1]) return;
      p[cur] = [nx, ny];
      redraw();
    };
    v.el.addEventListener('pointerdown', (e) => {
      const q = toData(e);
      let best = -1, bd = 1.4;
      p.forEach((pt, i) => { const d = len(sub(pt, q)); if (d < bd) { bd = d; best = i; } });
      if (best < 0 && p.length === 1) best = 0; // one dot: tap anywhere to move it
      if (best < 0) return;
      cur = best;
      v.el.setPointerCapture(e.pointerId);
      move(q);
    });
    v.el.addEventListener('pointermove', (e) => { if (cur >= 0) move(toData(e)); });
    const end = () => { cur = -1; };
    v.el.addEventListener('pointerup', end);
    v.el.addEventListener('pointercancel', end);
    redraw();
    const wrap = h('div', { class: 'plot-wrap' });
    wrap.appendChild(v.el);
    return h('div', { class: 'explorer' }, wrap, o.extra ? side : null, o.readout ? read : null,
      h('div', { class: 'muted small', style: 'text-align:center' }, o.handles.length > 1 ? 'Drag the dots at the arrow tips.' : 'Drag the dot (or tap where it should go).'), done);
  };
}

/** Drag where î and ĵ land; the grid, the unit square and the matrix follow. */
export function transformPlane(o: { init?: M; target?: M; goal?: (m: M) => boolean; goalText?: string; readout?: (m: M) => string; extraLayers?: (m: M) => Layer[]; r?: number } = {}): Widget {
  const [i0, j0] = cols(o.init ?? ID);
  const m = (p: V[]) => fromCols(p[0], p[1]);
  return dragPlane({
    r: o.r,
    handles: [{ at: i0, color: CI }, { at: j0, color: CJ }],
    layers: (p) => [...(o.target ? [unitSquare(o.target, 'var(--muted)', true)] : []), ...transformLayers(m(p)), ...(o.extraLayers?.(m(p)) ?? [])],
    extra: (p) => eqn(['M =', m(p)])({}),
    readout: (p) => o.readout?.(m(p)) ?? `î lands on ${vs(p[0])}, ĵ lands on ${vs(p[1])}`,
    goal: o.goal ? (p) => o.goal!(m(p)) : undefined,
    goalText: o.goalText,
  });
}

/** Two draggable vectors and what they can reach: the whole plane, one line, or only the origin. */
export function spanPlane(a: V, b: V, goal?: (a: V, b: V) => boolean, goalText?: string): Widget {
  const r = 5;
  return dragPlane({
    handles: [{ at: a, color: CA }, { at: b, color: CB }],
    layers: ([u, w]) => {
      const out: Layer[] = [];
      const d = len(u) ? u : w;
      if (cross(u, w) !== 0) out.push({ type: 'line', pts: [[-r, -r], [r, -r], [r, r], [-r, r]], closed: true, color: 'transparent', fill: tint('var(--c5)', 22) });
      else if (len(d)) out.push({ type: 'line', pts: [mulS(-20 / len(d), d), mulS(20 / len(d), d)], color: tint('var(--c5)', 70), width: 8 });
      out.push(arrow(u, CA, 'a'), arrow(w, CB, 'b'));
      return out;
    },
    readout: ([u, w]) => cross(u, w) !== 0 ? `a = ${vs(u)}, b = ${vs(w)}: different directions, so together they reach the whole plane`
      : !len(u) && !len(w) ? 'Both are zero: the only point you can reach is the origin'
      : `a = ${vs(u)}, b = ${vs(w)}: on one line, so they only reach that line`,
    goal: goal ? ([u, w]) => goal(u, w) : undefined,
    goalText,
  });
}

/** Drag v; see Mv. When Mv lies along v's own line, v is an eigenvector. */
export function eigenPlane(m: M, init: V, goal?: (v: V) => boolean, goalText?: string): Widget {
  const r = 6;
  return dragPlane({
    r,
    handles: [{ at: init, color: CA }],
    layers: ([v]) => {
      const out: Layer[] = [];
      if (len(v)) out.push({ type: 'line', pts: [mulS(-30 / len(v), v), mulS(30 / len(v), v)], color: 'var(--muted)', dash: true, width: 1.5 });
      out.push(arrow(apply(m, v), CB, 'Mv'), arrow(v, CA, 'v'));
      return out;
    },
    readout: ([v]) => {
      const w = apply(m, v);
      if (!len(v)) return 'v = (0, 0) doesn’t count: it has no direction.';
      if (cross(v, w) === 0) return `v = ${vs(v)}, Mv = ${vs(w)} = ${n(len(w) ? (Math.sign(dot(v, w)) * len(w)) / len(v) : 0)} × v: same line, only stretched`;
      return `v = ${vs(v)}, Mv = ${vs(w)}: knocked off v’s line`;
    },
    goal: goal ? ([v]) => goal(v) : undefined,
    goalText,
  });
}
