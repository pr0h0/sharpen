// Interactive pieces for the Systems Thinking course: a bathtub (stock with an inflow and an
// outflow), stock-and-flow diagrams, causal loop diagrams with + / − links (and a builder where the
// learner sets the signs), a delayed thermostat and a shower with a slow pipe, small graph grids.
// Every simulation is computed here, step by step, in plain TypeScript.
import type { Layer, PlotSpec, Widget } from '../types';
import { h, num, svg } from '../ui';
import { plotExplorer, stepper } from '../viz/explore';
import { plot } from '../viz/plot';

export const SZ: [number, number] = [360, 230];

export function plotBox(spec: PlotSpec): HTMLElement {
  const d = h('div', { class: 'plot-wrap' });
  d.appendChild(plot({ size: SZ, ...spec }).el);
  return d;
}

const T = (x: number, y: number, text: string, style = '', anchor = 'middle') =>
  svg('text', { x, y, 'text-anchor': anchor, style: `fill:var(--text);font-size:13px;${style}` }, text);

// ---------------------------------------------------------------- simulations

/** Thermostat that reacts to a reading `d` steps old: T(t+1) = T(t) + g·(target − T(t−d)). */
export function thermo(g: number, d: number, n = 40, T0 = 10, target = 20): number[] {
  const out = [T0];
  for (let t = 0; t < n; t++) out.push(out[t] + g * (target - out[Math.max(0, t - d)]));
  return out;
}

/** Shower: each second you move the tap by k·(target − felt); water at the tap reaches you d seconds later. */
export function shower(k: number, d: number, n: number, start = 15, target = 38): { tap: number[]; felt: number[] } {
  const tap = [start], felt: number[] = [];
  for (let t = 0; t <= n; t++) {
    felt.push(tap[Math.max(0, t - d)]);
    tap.push(tap[t] + k * (target - felt[t]));
  }
  return { tap: tap.slice(0, n + 1), felt };
}

/** Run x(t+1) = step(x(t), t) for n steps. */
export function run(x0: number, n: number, step: (x: number, t: number) => number): number[] {
  const xs = [x0];
  for (let t = 0; t < n; t++) xs.push(step(xs[t], t));
  return xs;
}

export const pts = (xs: number[], dt = 1): [number, number][] => xs.map((v, k) => [k * dt, v]);

// ---------------------------------------------------------------- bathtub

export interface TubState { level: number; cap: number; inflow: number; outflow: number; maxFlow?: number; unit?: string; rate?: string }

/** A bathtub: tap stream (width ~ inflow), water up to level/cap, drain stream (width ~ outflow). */
export function tubSvg(o: TubState): HTMLElement {
  const W = 340, H = 190, x0 = 70, x1 = 270, top = 52, bot = 160;
  const max = o.maxFlow ?? Math.max(o.inflow, o.outflow, 1);
  const unit = o.unit ?? 'L', rate = o.rate ?? 'L/min';
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
  const frac = Math.max(0, Math.min(1, o.level / o.cap));
  const wy = bot - frac * (bot - top);
  const full = o.level >= o.cap - 1e-9;
  // tap
  s.appendChild(svg('rect', { x: 18, y: 16, width: 78, height: 13, rx: 4, style: 'fill:var(--muted)' }));
  s.appendChild(svg('rect', { x: 84, y: 16, width: 13, height: 24, rx: 3, style: 'fill:var(--muted)' }));
  const inW = o.inflow > 0 ? 2 + (10 * o.inflow) / max : 0;
  if (inW) s.appendChild(svg('rect', { x: 90.5 - inW / 2, y: 40, width: inW, height: wy - 40, style: 'fill:var(--c1);opacity:.75' }));
  s.appendChild(T(104, 30, `in ${num(o.inflow)} ${rate}`, 'font-weight:700;fill:var(--c1)', 'start'));
  // water and tub
  s.appendChild(svg('rect', { x: x0, y: wy, width: x1 - x0, height: bot - wy, style: 'fill:var(--c1);opacity:.3' }));
  s.appendChild(svg('line', { x1: x0, y1: wy, x2: x1, y2: wy, style: 'stroke:var(--c1);stroke-width:2' }));
  s.appendChild(svg('path', { d: `M${x0},${top - 6}L${x0},${bot}L${x1},${bot}L${x1},${top - 6}`, style: 'fill:none;stroke:var(--text);stroke-width:3;stroke-linejoin:round' }));
  s.appendChild(T((x0 + x1) / 2, Math.min(bot - 8, Math.max(wy + 18, top + 22)), `${num(+o.level.toFixed(1))} ${unit}`, 'font-weight:800;font-size:15px'));
  s.appendChild(T(x1 + 6, top, `full: ${num(o.cap)} ${unit}`, 'fill:var(--muted);font-size:12px', 'start'));
  if (full) {
    s.appendChild(svg('path', { d: `M${x1},${top - 6}q12,10 10,40`, style: 'fill:none;stroke:var(--c1);stroke-width:4;opacity:.7' }));
    s.appendChild(T((x0 + x1) / 2, top - 10, 'overflowing!', 'font-weight:800;fill:var(--bad)'));
  }
  // drain
  s.appendChild(svg('rect', { x: 230, y: bot, width: 12, height: 14, style: 'fill:var(--muted)' }));
  s.appendChild(svg('rect', { x: 230, y: bot + 10, width: 60, height: 10, rx: 3, style: 'fill:var(--muted)' }));
  const outW = o.outflow > 0 && o.level > 0 ? 2 + (10 * o.outflow) / max : 0;
  if (outW) s.appendChild(svg('rect', { x: 290, y: bot + 15 - outW / 2, width: 34, height: outW, rx: 2, style: 'fill:var(--c1);opacity:.75' }));
  s.appendChild(T(222, bot + 24, `out ${num(o.outflow)} ${rate}`, 'font-weight:700;fill:var(--c2)', 'end'));
  return h('div', { class: 'plot-wrap' }, s);
}

export const tub = (o: TubState): Widget => () => tubSvg(o);

/**
 * The bathtub over time: flows are given per minute; each frame is one minute later. Shows the tub,
 * the two flows so far and the level so far.
 */
export function tubStepper(o: { cap: number; start: number; inflow: (t: number) => number; outflow: (t: number) => number; minutes: number; flowMax: number }): Widget {
  const lv = [o.start];
  for (let t = 0; t < o.minutes; t++) lv.push(Math.min(o.cap, Math.max(0, lv[t] + o.inflow(t) - o.outflow(t))));
  return () => stepper(o.minutes + 1, (i) => {
    const upto = Math.max(i, 1e-6);
    return h('div', null,
      tubSvg({ level: lv[i], cap: o.cap, inflow: o.inflow(i), outflow: o.outflow(i), maxFlow: o.flowMax }),
      plotBox({ x: [0, o.minutes], y: [0, o.flowMax], size: [360, 150], ylabel: 'flow (L/min)', layers: [
        { type: 'fn', f: o.inflow, from: 0, to: upto, color: 'var(--c1)', label: i > 2 ? 'in' : undefined },
        { type: 'fn', f: o.outflow, from: 0, to: upto, color: 'var(--c2)', label: i > 2 ? 'out' : undefined },
      ] }),
      plotBox({ x: [0, o.minutes], y: [0, o.cap], size: [360, 150], ylabel: 'water (L)', xlabel: 'minutes', layers: [
        { type: 'line', pts: pts(lv.slice(0, i + 1)), color: 'var(--c3)' },
        { type: 'dots', pts: [[i, lv[i]]], color: 'var(--c3)' },
      ] }));
  }, { caption: (i) => `minute ${i}: in ${num(o.inflow(i))}, out ${num(o.outflow(i))}, water ${num(+lv[i].toFixed(1))} L`, autoplayMs: 450 });
}

// ---------------------------------------------------------------- stock-and-flow diagram

function lines(s: SVGElement, x: number, y: number, text: string, style: string) {
  text.split('\n').forEach((ln, k) => s.appendChild(T(x, y + k * 15, ln, style)));
}

/** Cloud → valve → [stock] → valve → cloud. Labels may contain \n. */
export function stockFlow(o: { stock: string; inflow?: string; outflow?: string; value?: string }): Widget {
  return () => {
    const W = 320, H = 112, y = 44;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
    const cloud = (cx: number) => {
      for (const [dx, dy, r] of [[-7, 3, 8], [5, 4, 8], [0, -4, 9]] as const) s.appendChild(svg('circle', { cx: cx + dx, cy: y + dy, r, style: 'fill:var(--panel2);stroke:var(--muted);stroke-width:1.5' }));
    };
    const pipe = (a: number, b: number, label: string | undefined) => {
      s.appendChild(svg('line', { x1: a, y1: y - 4, x2: b, y2: y - 4, style: 'stroke:var(--c1);stroke-width:2' }));
      s.appendChild(svg('line', { x1: a, y1: y + 4, x2: b, y2: y + 4, style: 'stroke:var(--c1);stroke-width:2' }));
      s.appendChild(svg('path', { d: `M${b - 8},${y - 8}L${b},${y}L${b - 8},${y + 8}Z`, style: 'fill:var(--c1)' }));
      const m = (a + b) / 2;
      s.appendChild(svg('path', { d: `M${m - 7},${y - 9}L${m + 7},${y + 9}L${m + 7},${y - 9}L${m - 7},${y + 9}Z`, style: 'fill:var(--panel);stroke:var(--text);stroke-width:1.5' }));
      if (label) lines(s, m, y + 30, label, 'font-size:13px;font-weight:600;fill:var(--muted)');
    };
    const bx = 112, bw = 96;
    if (o.inflow !== undefined) { cloud(18); pipe(30, bx, o.inflow); }
    if (o.outflow !== undefined) { pipe(bx + bw, W - 34, o.outflow); cloud(W - 18); }
    s.appendChild(svg('rect', { x: bx, y: y - 30, width: bw, height: 60, rx: 6, style: 'fill:color-mix(in srgb, var(--c3) 20%, var(--panel));stroke:var(--c3);stroke-width:2.5' }));
    const ls = o.stock.split('\n');
    lines(s, bx + bw / 2, y + 5 - (ls.length - 1) * 7.5 - (o.value ? 7 : 0), o.stock, 'font-weight:800');
    if (o.value) s.appendChild(T(bx + bw / 2, y + 22, o.value, 'font-weight:700;fill:var(--c3)'));
    return h('div', { class: 'plot-wrap' }, s);
  };
}

// ---------------------------------------------------------------- causal loop diagrams

export interface LNode { id: string; label: string; x: number; y: number }
export type Sign = '+' | '−' | '?';
/** bend: sideways bow as a share of the length (sign picks the side); at: where the sign sits along the arrow (0..1). */
export interface LLink { from: string; to: string; sign: Sign; delay?: boolean; bend?: number; at?: number }
export interface LoopMark { x: number; y: number; text: string; ccw?: boolean }

const SIGN_COL: Record<Sign, string> = { '+': 'var(--c1)', '−': 'var(--c2)', '?': 'var(--muted)' };

/** Causal loop diagram drawn in a W x H box; with onSign, the sign badges are tappable buttons. */
export function loopSvg(nodes: LNode[], links: LLink[], opts: { marks?: LoopMark[]; size?: [number, number]; onSign?: (k: number) => void; caption?: string } = {}): HTMLElement {
  const [W, H] = opts.size ?? [340, 220];
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
  const box = Object.fromEntries(nodes.map((n) => {
    const ls = n.label.split('\n');
    return [n.id, { ...n, ls, w: Math.max(...ls.map((l) => l.length)) * 7.3 + 16, h: ls.length * 15 + 10 }];
  }));
  const inside = (id: string, p: [number, number]) => { const b = box[id]; return Math.abs(p[0] - b.x) <= b.w / 2 + 3 && Math.abs(p[1] - b.y) <= b.h / 2 + 3; };
  const badges: SVGElement[] = [];
  links.forEach((l, k) => {
    const A = box[l.from], B = box[l.to];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const bend = l.bend ?? 0.25;
    const C: [number, number] = [(A.x + B.x) / 2 + (-dy / len) * bend * len, (A.y + B.y) / 2 + (dx / len) * bend * len];
    const Q = (t: number): [number, number] => [
      (1 - t) ** 2 * A.x + 2 * (1 - t) * t * C[0] + t * t * B.x,
      (1 - t) ** 2 * A.y + 2 * (1 - t) * t * C[1] + t * t * B.y,
    ];
    let t0 = 0, t1 = 1;
    while (t0 < 0.5 && inside(l.from, Q(t0))) t0 += 0.005;
    while (t1 > 0.5 && inside(l.to, Q(t1))) t1 -= 0.005;
    const P: [number, number][] = [];
    for (let i = 0; i <= 30; i++) P.push(Q(t0 + ((t1 - t0) * i) / 30));
    const [ex, ey] = P[30], [px, py] = Q(t1 - 0.03);
    const ang = Math.atan2(ey - py, ex - px), a = 10;
    const tip: [number, number] = [ex, ey];
    P[30] = [ex - Math.cos(ang) * 6, ey - Math.sin(ang) * 6];
    s.appendChild(svg('path', { d: P.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(''), style: 'fill:none;stroke:var(--muted);stroke-width:2' }));
    s.appendChild(svg('path', { d: `M${tip[0]},${tip[1]}L${tip[0] - a * Math.cos(ang - 0.45)},${tip[1] - a * Math.sin(ang - 0.45)}L${tip[0] - a * Math.cos(ang + 0.45)},${tip[1] - a * Math.sin(ang + 0.45)}Z`, style: 'fill:var(--muted)' }));
    if (l.delay) {
      const [mx, my] = Q((t0 + t1) / 2), [nx, ny] = Q((t0 + t1) / 2 + 0.01);
      const ta = Math.atan2(ny - my, nx - mx), nxp = -Math.sin(ta), nyp = Math.cos(ta);
      for (const off of [-3, 3]) {
        const cx = mx + Math.cos(ta) * off, cy = my + Math.sin(ta) * off;
        s.appendChild(svg('line', { x1: cx - nxp * 8, y1: cy - nyp * 8, x2: cx + nxp * 8, y2: cy + nyp * 8, style: 'stroke:var(--text);stroke-width:2.2' }));
      }
    }
    // Sign badge near the arrow head, pushed to the outside of the bend.
    const [bx, by] = Q(t0 + (t1 - t0) * (l.at ?? 0.8));
    const side = bend >= 0 ? 1 : -1;
    const ox = (-dy / len) * 13 * side, oy = (dx / len) * 13 * side;
    const r = opts.onSign ? 12 : 10;
    const g = svg('g', opts.onSign ? { style: 'cursor:pointer', role: 'button', 'data-link': k } : {});
    g.appendChild(svg('circle', { cx: bx + ox, cy: by + oy, r, style: `fill:var(--panel);stroke:${SIGN_COL[l.sign]};stroke-width:2` }));
    g.appendChild(T(bx + ox, by + oy + 5.5, l.sign, `font-weight:800;font-size:17px;fill:${SIGN_COL[l.sign]}`));
    if (opts.onSign) g.addEventListener('click', () => opts.onSign!(k));
    badges.push(g);
  });
  for (const n of Object.values(box)) {
    s.appendChild(svg('rect', { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: 9, style: 'fill:var(--panel2);stroke:var(--line);stroke-width:1.5' }));
    n.ls.forEach((ln, k) => s.appendChild(T(n.x, n.y - (n.ls.length - 1) * 7.5 + 4.5 + k * 15, ln, 'font-weight:700')));
  }
  for (const m of opts.marks ?? []) {
    const r = 15, dir = m.ccw ? -1 : 1;
    const a0 = -Math.PI / 2 + dir * 0.5, a1 = -Math.PI / 2 + dir * (2 * Math.PI - 0.3);
    const p0 = [m.x + r * Math.cos(a0), m.y + r * Math.sin(a0)], p1 = [m.x + r * Math.cos(a1), m.y + r * Math.sin(a1)];
    const col = m.text.startsWith('R') ? 'var(--c4)' : 'var(--c3)';
    s.appendChild(svg('path', { d: `M${p0[0]},${p0[1]}A${r},${r} 0 1 ${dir > 0 ? 1 : 0} ${p1[0]},${p1[1]}`, style: `fill:none;stroke:${col};stroke-width:2` }));
    const ta = a1 + dir * Math.PI / 2;
    s.appendChild(svg('path', { d: `M${p1[0] + 6 * Math.cos(ta)},${p1[1] + 6 * Math.sin(ta)}L${p1[0] - 4 * Math.cos(ta) + 4 * Math.cos(a1)},${p1[1] - 4 * Math.sin(ta) + 4 * Math.sin(a1)}L${p1[0] - 4 * Math.cos(ta) - 4 * Math.cos(a1)},${p1[1] - 4 * Math.sin(ta) - 4 * Math.sin(a1)}Z`, style: `fill:${col}` }));
    s.appendChild(T(m.x, m.y + 5.5, m.text, `font-weight:800;font-size:15px;fill:${col}`));
  }
  for (const b of badges) s.appendChild(b);
  return h('div', null, h('div', { class: 'plot-wrap' }, s), opts.caption ? h('div', { class: 'readout' }, opts.caption) : null);
}

export const loop = (nodes: LNode[], links: LLink[], opts: { marks?: LoopMark[]; size?: [number, number]; caption?: string } = {}): Widget => () => loopSvg(nodes, links, opts);

/** Task: tap each link's badge to cycle ? → + → − until every sign matches the situation. */
export function loopBuilder(nodes: LNode[], links: LLink[], opts: { size?: [number, number]; marks?: LoopMark[] } = {}): Widget {
  return (ctx) => {
    const cur: Sign[] = links.map(() => '?');
    const wrap = h('div');
    const draw = () => {
      const set = cur.filter((c) => c !== '?').length;
      wrap.replaceChildren(loopSvg(nodes, links.map((l, k) => ({ ...l, sign: cur[k] })), {
        size: opts.size, marks: set === links.length ? opts.marks : undefined,
        onSign: (k) => { cur[k] = cur[k] === '?' ? '+' : cur[k] === '+' ? '−' : '+'; draw(); },
        caption: `${set} of ${links.length} signed · tap a circle to switch`,
      }));
      ctx.solved?.(cur.every((c, k) => c === links[k].sign));
    };
    draw();
    return wrap;
  };
}

// ---------------------------------------------------------------- delays

/** Delayed thermostat explorer: gain and delay sliders. With goal: settle at 20° with no overshoot. */
export function thermoExplorer(o: { g: number; d: number; goal?: boolean; n?: number }): Widget {
  const n = o.n ?? 40;
  const verdict = (Ts: number[]) => {
    const mx = Math.max(...Ts), end = Ts[n];
    return { mx, end, over: mx > 20.1, settled: Math.abs(end - 20) <= 0.5 };
  };
  return plotExplorer({
    params: [
      { id: 'g', label: 'gain', min: 0.05, max: 1, step: 0.05, value: o.g, format: (v) => v.toFixed(2) },
      { id: 'd', label: 'delay', min: 0, max: 4, step: 1, value: o.d, format: (v) => `${v} min` },
    ],
    spec: (v) => {
      const Ts = thermo(v.g, v.d, n);
      return { x: [0, n], y: [0, 40], size: SZ, xlabel: 'minutes', ylabel: 'room °C', layers: [
        { type: 'hline', y: 20, color: 'var(--c3)', label: 'target 20°' },
        { type: 'line', pts: pts(Ts), color: 'var(--c2)' },
      ] };
    },
    readout: (v) => {
      const r = verdict(thermo(v.g, v.d, n));
      return `peak ${r.mx.toFixed(1)}° · minute ${n}: ${r.end.toFixed(1)}° · ${r.over ? 'overshoots' : r.settled ? 'settles, no overshoot' : 'too slow to arrive'}`;
    },
    goal: o.goal ? (v) => { const r = verdict(thermo(v.g, v.d, n)); return !r.over && r.settled; } : undefined,
    goalText: 'Settles at 20° without overshooting.',
  });
}

/** You at the shower: the tap moves now, the water you feel is the tap setting d seconds ago. */
export function showerStepper(k = 0.35, d = 3, n = 30): Widget {
  const { tap, felt } = shower(k, d, n);
  return () => stepper(n + 1, (i) => plotBox({ x: [0, n], y: [0, 60], xlabel: 'seconds', ylabel: '°C', layers: [
    { type: 'area', f: () => 60, base: () => 44, from: 0, to: n, color: 'var(--c2)' },
    { type: 'area', f: () => 30, base: () => 0, from: 0, to: n, color: 'var(--c1)' },
    { type: 'hline', y: 38, color: 'var(--c3)', label: 'just right 38°' },
    { type: 'line', pts: pts(tap.slice(0, i + 1)), color: 'var(--c6)', dash: true, label: i > 2 ? 'tap' : undefined },
    { type: 'line', pts: pts(felt.slice(0, i + 1)), color: 'var(--c2)', label: i > 2 ? 'you feel' : undefined },
  ] }), {
    caption: (i) => `${i} s: tap set to ${tap[i].toFixed(0)}°, you feel ${felt[i].toFixed(0)}°${felt[i] > 44 ? ' (ouch!)' : felt[i] < 30 ? ' (brr)' : ''}`,
    autoplayMs: 380,
  });
}

// ---------------------------------------------------------------- small multiples, tables

/** Small labelled graphs side by side (A, B, C, …) for matching. */
export function graphGrid(graphs: { label: string; f: (t: number) => number }[], opts: { y: [number, number]; x?: [number, number]; ylabel?: string }): Widget {
  return () => h('div', { style: 'display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px;' },
    graphs.map((g, k) => {
      const v = plot({ x: opts.x ?? [0, 10], y: opts.y, size: [200, 130], ylabel: opts.ylabel, xlabel: 'time', tickFormat: () => '', grid: false,
        layers: [{ type: 'fn', f: g.f, color: `var(--c${(k % 6) + 1})`, width: 3 }] });
      return h('div', { style: 'background:var(--panel2);border-radius:10px;padding:4px 6px;' },
        h('div', { style: 'font-weight:800;' }, g.label), h('div', { class: 'plot-wrap' }, v.el));
    }));
}

/** A simulation table revealed one row at a time. */
export function tableStepper(head: string[], rows: (string | number)[][], opts: { caption?: (i: number) => string; chart?: (i: number) => Layer[]; spec?: Omit<PlotSpec, 'layers'> } = {}): Widget {
  return () => stepper(rows.length, (i) => h('div', null,
    h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, head.map((c) => h('th', null, c)))),
      h('tbody', null, rows.slice(0, i + 1).map((r, k) => h('tr', { class: k === i ? 'hl' : '' }, r.map((c) => h('td', null, c))))))),
    opts.chart && opts.spec ? plotBox({ ...opts.spec, layers: opts.chart(i) }) : null),
  { caption: opts.caption, autoplayMs: 700 });
}
