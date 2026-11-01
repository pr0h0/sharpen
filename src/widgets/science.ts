// Interactive pieces for the Scientific Thinking course: Fermi factor chains, unit-cancelling
// chains, motion tracks, free-body diagrams, falling objects, a roller coaster with energy bars,
// a swinging pendulum, travelling waves, randomization and sample-size simulators.
import type { Layer, PlotSpec, Widget } from '../types';
import { h, num, seeded, shuffle, svg } from '../ui';
import { explorer, plotExplorer, stepper } from '../viz/explore';
import { plot } from '../viz/plot';

export const G = 9.8;
const SIZE: [number, number] = [400, 250];

function plotBox(spec: PlotSpec): HTMLElement {
  const d = h('div', { class: 'plot-wrap' });
  d.appendChild(plot({ size: SIZE, ...spec }).el);
  return d;
}

const card = 'background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;text-align:center;min-width:64px;';

// ---------------------------------------------------------------- Fermi

export interface Factor { value: string; label: string; op?: '×' | '÷' | '=' }

/** A Fermi estimate as a chain of cards: value over label, joined by × ÷ =. The last card is the result. */
export function factorChain(items: Factor[]): Widget {
  return () => h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;margin:8px 0;' },
    items.map((it, k) => [
      k > 0 ? h('span', { style: 'font-weight:700;font-size:1.2rem;color:var(--muted);' }, it.op ?? '×') : null,
      h('div', { style: card + (k === items.length - 1 ? 'border-color:var(--c3);border-width:2px;' : '') },
        h('div', { style: 'font-weight:800;font-size:1.05rem;font-variant-numeric:tabular-nums;' }, it.value),
        h('div', { class: 'muted small', style: 'max-width:110px;line-height:1.2;' }, it.label)),
    ]));
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** 10 to a power with superscript digits: pow10s(-3) = "10⁻³". */
export const pow10s = (k: number) => '10' + String(k).split('').map((c) => SUP[c] ?? c).join('');

/** A ladder of sizes on a log scale: each row sits at its power of ten. */
export function logLadder(items: { label: string; exp: number }[], unit: string): Widget {
  return () => {
    const lo = Math.min(...items.map((i) => i.exp)), hi = Math.max(...items.map((i) => i.exp));
    return h('div', { style: 'display:grid;gap:6px;margin:8px 0;' },
      items.map((it, k) => {
        const p = hi === lo ? 50 : ((it.exp - lo) / (hi - lo)) * 100;
        return h('div', { style: 'display:grid;grid-template-columns:4.6em minmax(0, 1fr) 40%;gap:8px;align-items:center;' },
          h('span', { style: 'font-weight:700;font-variant-numeric:tabular-nums;text-align:right;' }, `${pow10s(it.exp)} ${unit}`),
          h('span', { style: 'font-size:.9rem;line-height:1.2;' }, it.label),
          h('span', { style: 'position:relative;height:18px;border-radius:6px;background:var(--panel2);display:block;' },
            h('span', { style: `position:absolute;left:0;top:0;bottom:0;width:calc(${p}% * .85 + 8px);border-radius:6px;background:color-mix(in srgb, var(--c${(k % 6) + 1}) 70%, transparent);` })));
      }));
  };
}

// ---------------------------------------------------------------- units

/**
 * A unit-conversion chain as fractions. Each term has a top and a bottom; text in [brackets] is
 * drawn struck through (it cancels). The last term is the result.
 */
export function unitChain(terms: { top: string; bot?: string }[]): Widget {
  const tok = (s: string) => s.split(/(\[[^\]]*\])/).filter(Boolean).map((p) =>
    p.startsWith('[') ? h('s', { style: 'color:var(--bad);text-decoration-thickness:2px;' }, h('span', { style: 'color:var(--text);' }, p.slice(1, -1))) : p);
  const frac = (t: { top: string; bot?: string }, last: boolean) => h('span', {
    style: `display:inline-flex;flex-direction:column;align-items:center;padding:4px 8px;border-radius:8px;${last ? 'background:color-mix(in srgb, var(--c3) 18%, transparent);font-weight:700;' : ''}`,
  },
  h('span', { style: 'white-space:nowrap;' }, tok(t.top)),
  t.bot ? h('span', { style: 'border-top:2px solid var(--text);width:100%;text-align:center;white-space:nowrap;' }, tok(t.bot)) : null);
  return () => h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:2px 4px;margin:10px 0;font-size:1.05rem;font-variant-numeric:tabular-nums;' },
    terms.map((t, k) => [k ? h('span', { style: 'color:var(--muted);font-weight:700;' }, k === terms.length - 1 ? '=' : '×') : null, frac(t, k === terms.length - 1)]));
}

// ---------------------------------------------------------------- motion

/** Frames of a moving car: the track on top, the position-time graph traced so far below. */
export function motionTrack(x: (t: number) => number, T: number, opts: { xmax: number; frames?: number; v?: (t: number) => number; vmax?: number }): Widget {
  const n = opts.frames ?? 21;
  return () => stepper(n, (i) => {
    const t = (T * i) / (n - 1);
    const pos = x(t);
    const W = 440, H = 54, pad = 20, px = (v: number) => pad + (v / opts.xmax) * (W - 2 * pad);
    const track = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
    track.appendChild(svg('line', { x1: pad, y1: 40, x2: W - pad, y2: 40, class: 'axis' }));
    for (let m = 0; m <= opts.xmax; m += opts.xmax / 5) {
      track.appendChild(svg('line', { x1: px(m), y1: 36, x2: px(m), y2: 44, class: 'axis' }));
    }
    track.appendChild(svg('rect', { x: px(pos) - 14, y: 22, width: 28, height: 13, rx: 4, style: 'fill:var(--c2)' }));
    track.appendChild(svg('circle', { cx: px(pos) - 7, cy: 37, r: 4, style: 'fill:var(--text)' }));
    track.appendChild(svg('circle', { cx: px(pos) + 7, cy: 37, r: 4, style: 'fill:var(--text)' }));
    track.appendChild(svg('text', { x: px(pos), y: 15, class: 'tick', 'text-anchor': 'middle' }, `${num(+pos.toFixed(1))} m`));
    const layers: Layer[] = [
      { type: 'fn', f: x, from: 0, to: Math.max(t, 1e-6), color: 'var(--c1)' },
      { type: 'dots', pts: [[t, pos]], color: 'var(--c2)' },
    ];
    const box = h('div', null, h('div', { class: 'plot-wrap' }, track),
      plotBox({ x: [0, T], y: [0, opts.xmax], xlabel: 'time (s)', ylabel: 'position (m)', size: [440, 220], layers }));
    if (opts.v) {
      box.appendChild(plotBox({ x: [0, T], y: [0, opts.vmax ?? 10], xlabel: 'time (s)', ylabel: 'velocity (m/s)', size: [440, 180],
        layers: [{ type: 'fn', f: opts.v, from: 0, to: Math.max(t, 1e-6), color: 'var(--c3)' }, { type: 'dots', pts: [[t, opts.v(t)]], color: 'var(--c2)' }] }));
    }
    return box;
  }, { caption: (i) => `t = ${num(+((T * i) / (n - 1)).toFixed(2))} s`, autoplayMs: 250 });
}

/** Small labelled graphs side by side (A, B, C, …) for matching. */
export function miniGraphs(graphs: { label: string; f: (t: number) => number }[], opts: { y: [number, number]; ylabel: string; x?: [number, number] }): Widget {
  return () => h('div', { style: 'display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px;' },
    graphs.map((g, k) => {
      const v = plot({ x: opts.x ?? [0, 10], y: opts.y, size: [220, 150], ylabel: opts.ylabel, xlabel: 't', tickFormat: () => '',
        layers: [{ type: 'fn', f: g.f, color: `var(--c${(k % 6) + 1})`, width: 3 }] });
      return h('div', { style: 'background:var(--panel2);border-radius:10px;padding:4px 6px;' },
        h('div', { style: 'font-weight:800;' }, g.label), h('div', { class: 'plot-wrap' }, v.el));
    }));
}

// ---------------------------------------------------------------- forces

export interface Force { dir: 'up' | 'down' | 'left' | 'right'; size: number; label: string; color?: string }

/** A box with force arrows drawn from its sides, length proportional to size. */
export function freeBodySvg(forces: Force[], opts: { scale?: number; caption?: string; ground?: boolean; height?: number } = {}): HTMLElement {
  const W = 340, Hh = opts.height ?? 230, cx = W / 2, cy = Hh / 2, bw = 64, bh = 48;
  const max = Math.max(1e-9, ...forces.map((f) => f.size));
  const s = opts.scale ?? 80 / max;
  const el = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'plot', style: `max-width:${W}px` });
  if (opts.ground) el.appendChild(svg('line', { x1: 20, y1: cy + bh / 2, x2: W - 20, y2: cy + bh / 2, style: 'stroke:var(--muted);stroke-width:2' }));
  el.appendChild(svg('rect', { x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh, rx: 6, style: 'fill:var(--panel2);stroke:var(--text);stroke-width:2' }));
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;
  const sameDir: Record<string, number> = {};
  for (const f of forces) {
    const [dx, dy] = D[f.dir];
    const k = (sameDir[f.dir] = (sameDir[f.dir] ?? -1) + 1);
    const off = (k - (forces.filter((g) => g.dir === f.dir).length - 1) / 2) * 18;
    const ax = cx + dx * (bw / 2) + (dy ? off : 0), ay = cy + dy * (bh / 2) + (dx ? off : 0);
    const len = Math.max(8, f.size * s);
    const bx = ax + dx * len, by = ay + dy * len;
    const col = f.color ?? 'var(--c1)';
    if (f.size > 0) {
      el.appendChild(svg('line', { x1: ax, y1: ay, x2: bx - dx * 6, y2: by - dy * 6, style: `stroke:${col};stroke-width:4` }));
      const ang = Math.atan2(dy, dx), a = 11;
      el.appendChild(svg('path', { d: `M${bx},${by}L${bx - a * Math.cos(ang - 0.5)},${by - a * Math.sin(ang - 0.5)}L${bx - a * Math.cos(ang + 0.5)},${by - a * Math.sin(ang + 0.5)}Z`, style: `fill:${col}` }));
    }
    // Vertical arrows: label beside the shaft; horizontal: label above the tip.
    const lx = dy ? ax + 10 : bx, ly = dy ? (ay + by) / 2 + 5 : cy - bh / 2 - 8;
    el.appendChild(svg('text', { x: lx, y: ly, class: 'plot-label', style: `fill:${col}`, 'text-anchor': dy ? 'start' : dx < 0 ? 'start' : 'end' }, f.label));
  }
  return h('div', null, h('div', { class: 'plot-wrap' }, el), opts.caption ? h('div', { class: 'readout' }, opts.caption) : null);
}

export const freeBody = (forces: Force[], opts: { caption?: string; ground?: boolean } = {}): Widget => () => freeBodySvg(forces, opts);

/** Push a cart: force and mass sliders, acceleration readout and arrow. */
export function fmaExplorer(): Widget {
  return explorer({
    params: [
      { id: 'F', label: 'push F', min: 0, max: 100, step: 5, value: 40, format: (v) => `${v} N` },
      { id: 'm', label: 'mass m', min: 5, max: 50, step: 5, value: 20, format: (v) => `${v} kg` },
    ],
    draw: (v) => freeBodySvg([
      { dir: 'right', size: v.F, label: `F = ${v.F} N`, color: 'var(--c2)' },
    ], { scale: 1.1, ground: true, height: 110, caption: `a = F ÷ m = ${v.F} ÷ ${v.m} = ${num(v.F / v.m)} m/s²` }),
  });
}

/** Two pucks pushed once: one on frictionless ice, one on carpet. Snapshots every 0.5 s. */
export function puckSlide(): Widget {
  const v0 = 4, dec = 1; // m/s, m/s² on the carpet
  return () => stepper(9, (i) => {
    const W = 440, Hh = 130, pad = 20, xmax = 18, px = (x: number) => pad + (x / xmax) * (W - 2 * pad);
    const el = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'plot', style: `max-width:${W}px` });
    const rows: [string, (t: number) => number, string][] = [
      ['ice: no friction', (t) => v0 * t, 'var(--c1)'],
      ['carpet: friction', (t) => { const ts = Math.min(t, v0 / dec); return v0 * ts - 0.5 * dec * ts * ts; }, 'var(--c2)'],
    ];
    rows.forEach(([name, x, col], r) => {
      const y = 40 + r * 60;
      el.appendChild(svg('line', { x1: pad, y1: y + 10, x2: W - pad, y2: y + 10, class: 'axis' }));
      el.appendChild(svg('text', { x: pad, y: y - 16, class: 'tick' }, name));
      for (let k = 0; k <= i; k++) {
        el.appendChild(svg('circle', { cx: px(x(k * 0.5)), cy: y, r: k === i ? 8 : 4, style: `fill:${col};opacity:${k === i ? 1 : 0.35}` }));
      }
    });
    return h('div', { class: 'plot-wrap' }, el);
  }, { caption: (i) => `t = ${i * 0.5} s (dots every 0.5 s)`, autoplayMs: 500 });
}

/** Two balls dropped together; positions every 0.1 s. With air: a feather lags behind. */
export function fallRace(opts: { air?: boolean } = {}): Widget {
  const n = 11, dt = 0.1, Hm = 5;
  return () => stepper(n, (i) => {
    const t = i * dt;
    const W = 300, Hh = 270, top = 44, bottom = 240, py = (d: number) => top + (Math.min(d, Hm) / Hm) * (bottom - top);
    const el = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'plot', style: `max-width:${W}px` });
    el.appendChild(svg('line', { x1: 20, y1: bottom + 12, x2: W - 20, y2: bottom + 12, style: 'stroke:var(--muted);stroke-width:2' }));
    for (let m = 0; m <= Hm; m++) {
      el.appendChild(svg('text', { x: 18, y: py(m) + 4, class: 'tick', 'text-anchor': 'end' }, `${m}`));
      el.appendChild(svg('line', { x1: 24, y1: py(m), x2: W - 20, y2: py(m), class: 'gridline' }));
    }
    const free = 0.5 * G * t * t;
    // A feather in air: terminal speed about 0.5 m/s, reached almost at once.
    const feather = 0.5 * t;
    const balls: [string, number, number, string][] = opts.air
      ? [['ball', free, 14, 'var(--c1)'], ['feather', feather, 7, 'var(--c5)']]
      : [['1 kg', free, 9, 'var(--c1)'], ['10 kg', free, 18, 'var(--c2)']];
    balls.forEach(([name, d, r, col], k) => {
      const x = 110 + k * 110;
      el.appendChild(svg('text', { x, y: 14, class: 'tick', 'text-anchor': 'middle' }, name));
      el.appendChild(svg('circle', { cx: x, cy: Math.min(py(d), bottom + 12 - r), r, style: `fill:${col}` }));
    });
    return h('div', { class: 'plot-wrap' }, el);
  }, { caption: (i) => `t = ${(i * dt).toFixed(1)} s · fallen ${num(+(0.5 * G * (i * dt) ** 2).toFixed(2))} m (½gt²)`, autoplayMs: 300 });
}

// ---------------------------------------------------------------- energy

// Coaster track: smooth (cosine) between knots, heights in metres.
const KNOTS: [number, number][] = [[0, 40], [30, 5], [60, 28], [85, 10], [100, 14]];
export function trackY(x: number): number {
  for (let k = 0; k < KNOTS.length - 1; k++) {
    const [a, ya] = KNOTS[k], [b, yb] = KNOTS[k + 1];
    if (x <= b) { const s = Math.max(0, (x - a) / (b - a)); return ya + (yb - ya) * (1 - Math.cos(Math.PI * s)) / 2; }
  }
  return KNOTS[KNOTS.length - 1][1];
}
export const COASTER_TOP = 40, COASTER_MASS = 500;

function energyBars(pe: number, ke: number): HTMLElement {
  const tot = pe + ke || 1;
  const row = (label: string, v: number, col: string) => h('div', { style: 'display:grid;grid-template-columns:7.5em 1fr 4.5em;gap:8px;align-items:center;' },
    h('span', { class: 'muted', style: 'font-weight:600;' }, label),
    h('span', { style: 'display:block;height:16px;border-radius:5px;background:var(--panel2);overflow:hidden;' },
      h('span', { style: `display:block;height:100%;width:${(v / tot) * 100}%;background:${col};` })),
    h('span', { style: 'text-align:right;font-weight:700;font-variant-numeric:tabular-nums;' }, `${Math.round(v / 1000)} kJ`));
  return h('div', { style: 'display:grid;gap:5px;margin-top:6px;' },
    row('Potential mgh', pe, 'var(--c1)'), row('Kinetic ½mv²', ke, 'var(--c2)'), row('Total', pe + ke, 'var(--c3)'));
}

/** Frictionless coaster from rest at the top: drag the car along; energy moves between PE and KE. */
export function coaster(goal?: (h: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [{ id: 'x', label: 'position', min: 0, max: 100, step: 0.5, value: 0, format: (v) => `${v} m` }],
    draw: (v) => {
      const y = trackY(v.x);
      const pe = COASTER_MASS * G * y, ke = COASTER_MASS * G * (COASTER_TOP - y);
      return h('div', null,
        plotBox({ x: [0, 100], y: [0, 45], size: [440, 200], ylabel: 'height (m)', layers: [
          { type: 'area', f: trackY, from: 0, to: 100, color: 'var(--muted)' },
          { type: 'fn', f: trackY, color: 'var(--text)', width: 3 },
          { type: 'hline', y: COASTER_TOP, color: 'var(--c3)', label: 'start height' },
          { type: 'dots', pts: [[v.x, y]], color: 'var(--c2)', r: 8 },
        ] }),
        energyBars(pe, ke));
    },
    readout: (v) => { const y = trackY(v.x); return `height ${y.toFixed(1)} m · speed ${Math.sqrt(2 * G * (COASTER_TOP - y)).toFixed(1)} m/s`; },
    goal: goal ? (v) => goal(trackY(v.x)) : undefined,
    goalText,
  });
}

/** Braking distance against speed: d = v² / (2a). */
export function brakingExplorer(decel: number): Widget {
  const d = (kmh: number) => (kmh / 3.6) ** 2 / (2 * decel);
  return plotExplorer({
    params: [{ id: 'v', label: 'speed', min: 0, max: 130, step: 10, value: 50, format: (v) => `${v} km/h` }],
    spec: (v) => ({ x: [0, 130], y: [0, 100], size: SIZE, xlabel: 'speed (km/h)', ylabel: 'braking distance (m)', layers: [
      { type: 'fn', f: d, color: 'var(--c1)' },
      { type: 'line', pts: [[v.v, 0], [v.v, d(v.v)], [0, d(v.v)]], color: 'var(--c2)', dash: true, width: 1.5 },
      { type: 'dots', pts: [[v.v, d(v.v)]], color: 'var(--c2)', r: 6 },
    ] }),
    readout: (v) => `${v.v} km/h → ${d(v.v).toFixed(1)} m of braking`,
  });
}

// ---------------------------------------------------------------- oscillations and waves

export const period = (L: number, g = G) => 2 * Math.PI * Math.sqrt(L / g);

/** A pendulum that really swings with its period (small angle). Sliders: length, mass. */
export function pendulum(goal?: (T: number, L: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [
      { id: 'L', label: 'length', min: 0.1, max: 2.5, step: 0.01, value: 0.5, format: (v) => `${v.toFixed(2)} m` },
      { id: 'm', label: 'mass', min: 0.1, max: 5, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)} kg` },
    ],
    draw: (v) => {
      const W = 320, Hh = 250, cx = W / 2, cy = 16, len = 40 + (v.L / 2.5) * 180, r = 6 + 6 * Math.cbrt(v.m);
      const T = period(v.L);
      const el = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'plot', style: `max-width:${W}px` });
      el.appendChild(svg('line', { x1: cx - 60, y1: cy, x2: cx + 60, y2: cy, style: 'stroke:var(--muted);stroke-width:4' }));
      const amp = 14;
      for (const s of [-1, 1]) {
        const a = (s * amp * Math.PI) / 180;
        el.appendChild(svg('circle', { cx: cx + len * Math.sin(a), cy: cy + len * Math.cos(a), r, style: 'fill:none;stroke:var(--line);stroke-width:2;stroke-dasharray:4 3' }));
      }
      const arm = svg('g', {});
      arm.appendChild(svg('line', { x1: cx, y1: cy, x2: cx, y2: cy + len, style: 'stroke:var(--text);stroke-width:2' }));
      arm.appendChild(svg('circle', { cx, cy: cy + len, r, style: 'fill:var(--c2)' }));
      const spline = '0.37 0 0.63 1;0.37 0 0.63 1';
      arm.appendChild(svg('animateTransform', { attributeName: 'transform', type: 'rotate', values: `${amp} ${cx} ${cy};${-amp} ${cx} ${cy};${amp} ${cx} ${cy}`,
        keyTimes: '0;0.5;1', calcMode: 'spline', keySplines: spline, dur: `${T.toFixed(3)}s`, repeatCount: 'indefinite' }));
      el.appendChild(arm);
      return h('div', { class: 'plot-wrap' }, el);
    },
    readout: (v) => `period T = ${period(v.L).toFixed(3)} s (one full swing there and back)`,
    goal: goal ? (v) => goal(period(v.L), v.L) : undefined,
    goalText,
  });
}

/** A travelling wave in frames; a buoy at a fixed spot only bobs up and down. */
export function waveStepper(f: number, lambda: number): Widget {
  const n = 17, T = 1 / f, vel = f * lambda;
  return () => stepper(n, (i) => {
    const t = (i / (n - 1)) * 2 * T;
    const y = (x: number) => Math.sin(2 * Math.PI * (x / lambda - f * t));
    const crest = ((vel * t + lambda / 4) % (4 * lambda));
    const buoy = 1.5 * lambda;
    return plotBox({ x: [0, 4 * lambda], y: [-1.6, 1.6], size: [440, 200], xlabel: 'distance (m)', ticks: [lambda / 2, 1], layers: [
      { type: 'fn', f: y, color: 'var(--c1)', width: 3 },
      { type: 'dots', pts: [[crest, 1]], color: 'var(--c2)', r: 6, labels: ['crest'] },
      { type: 'dots', pts: [[buoy, y(buoy)]], color: 'var(--c3)', r: 7, labels: ['buoy'] },
    ] });
  }, { caption: (i) => `t = ${((i / (n - 1)) * 2 * T).toFixed(2)} s: the crest moves on, the buoy only bobs`, autoplayMs: 220 });
}

/** Frequency and wavelength sliders; speed = f × λ. */
export function waveExplorer(): Widget {
  return plotExplorer({
    params: [
      { id: 'f', label: 'frequency', min: 0.5, max: 4, step: 0.5, value: 1, format: (v) => `${v} Hz` },
      { id: 'l', label: 'wavelength', min: 0.5, max: 4, step: 0.5, value: 2, format: (v) => `${v} m` },
    ],
    spec: (v) => ({ x: [0, 8], y: [-1.6, 1.6], size: [440, 200], xlabel: 'distance (m)', ticks: [1, 1], layers: [
      { type: 'fn', f: (x) => Math.sin((2 * Math.PI * x) / v.l), color: 'var(--c1)', width: 3 },
      { type: 'arrow', from: [0, 1.3], to: [v.l, 1.3], color: 'var(--c2)', label: 'λ' },
    ] }),
    readout: (v) => `speed = f × λ = ${v.f} × ${v.l} = ${num(v.f * v.l)} m/s`,
  });
}

// ---------------------------------------------------------------- experiments

/**
 * 20 volunteers with a hidden fitness score. "Volunteers choose" puts the fittest into the exercise
 * group (they're the ones who sign up); "Randomize" deals them out by chance.
 */
export function randomizer(): Widget {
  return () => {
    const rng = seeded(7);
    const people = Array.from({ length: 20 }, () => Math.round(30 + rng() * 60));
    let groupA: number[] = [], groupB: number[] = [], mode = '';
    let rolls = 0;
    const pic = h('div');
    const draw = () => {
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const row = (name: string, xs: number[], col: string) => h('div', { style: 'margin:6px 0;' },
        h('div', { class: 'small', style: 'font-weight:700;' }, `${name}: average fitness `, h('span', { style: `color:${col}` }, String(Math.round(mean(xs))))),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;' },
          xs.map((f) => h('span', { style: `display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:.75rem;font-weight:700;color:#fff;background:color-mix(in srgb, ${col} ${35 + f * 0.7}%, #555);` }, String(f)))));
      pic.replaceChildren(
        h('div', { class: 'muted small' }, mode),
        row('Exercise group', groupA, 'var(--c2)'), row('Comparison group', groupB, 'var(--c1)'));
    };
    const choose = () => {
      const s = people.slice().sort((a, b) => b - a);
      groupA = [...s.slice(0, 8), ...s.slice(18)];
      groupB = s.slice(8, 18);
      mode = 'Volunteers chose: the keen, fit ones signed up for exercise.';
      draw();
    };
    const randomize = () => {
      rolls++;
      const s = shuffle(seeded(100 + rolls * 7919 + Math.floor(Math.random() * 1e6)), people);
      groupA = s.slice(0, 10); groupB = s.slice(10);
      mode = `Random assignment #${rolls}: a coin decides.`;
      draw();
    };
    choose();
    return h('div', null,
      h('div', { class: 'w-btns' },
        h('button', { class: 'ghost', onclick: choose }, 'Let volunteers choose'),
        h('button', { class: 'ghost', onclick: randomize }, 'Assign at random')),
      pic);
  };
}

/**
 * Many studies of a treatment that does nothing. Each study compares two groups of n people where
 * everyone has a 50% chance of improving; we plot the difference in improvement rates.
 */
export function sampleSim(): Widget {
  return () => {
    let rng = seeded(3);
    const study = (n: number) => {
      let a = 0, b = 0;
      for (let k = 0; k < n; k++) { if (rng() < 0.5) a++; if (rng() < 0.5) b++; }
      return ((a - b) / n) * 100;
    };
    const pic = h('div');
    const strip = (n: number, xs: number[]) => {
      const W = 440, Hh = 58, pad = 20, px = (d: number) => pad + ((d + 50) / 100) * (W - 2 * pad);
      const el = svg('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'plot', style: `max-width:${W}px` });
      el.appendChild(svg('line', { x1: pad, y1: 30, x2: W - pad, y2: 30, class: 'axis' }));
      for (const t of [-50, -25, 0, 25, 50]) {
        el.appendChild(svg('line', { x1: px(t), y1: 25, x2: px(t), y2: 35, class: 'axis' }));
        el.appendChild(svg('text', { x: px(t), y: 52, class: 'tick', 'text-anchor': 'middle' }, `${t > 0 ? '+' : ''}${t}`));
      }
      for (const d of xs) el.appendChild(svg('circle', { cx: px(Math.max(-50, Math.min(50, d))), cy: 30, r: 5, style: 'fill:var(--c2);opacity:.55' }));
      return h('div', null, h('div', { class: 'small', style: 'font-weight:700;' }, `${n} people per group`), h('div', { class: 'plot-wrap' }, el));
    };
    const run = () => {
      const small = Array.from({ length: 20 }, () => study(10));
      const big = Array.from({ length: 20 }, () => study(200));
      pic.replaceChildren(strip(10, small), strip(200, big),
        h('div', { class: 'readout' }, 'Each dot: one study’s “effect” (percentage points). The true effect is 0.'));
    };
    run();
    return h('div', null, h('div', { class: 'w-btns' },
      h('button', { class: 'ghost', onclick: () => { rng = seeded(Math.floor(Math.random() * 1e9)); run(); } }, 'Run 20 more studies of each')), pic);
  };
}
