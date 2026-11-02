// Interactive pieces for The Universe by Numbers: a powers-of-ten zoom, a grapefruit scale model,
// light racing to the Moon in real time, Newton's cannon, Kepler orbits, seasons on a tilted
// orbit, Moon phases, tidal locking, parallax, Eratosthenes, inverse-square light, star colours,
// raisin bread, a transit light curve and a Drake-equation explorer.
// "Space" scenes sit on a fixed dark panel with fixed light colours, so they read the same in
// light and dark themes; everything else uses the theme variables.
import type { Layer, PlotSpec, Widget } from '../types';
import { h, num, seeded, svg } from '../ui';
import { explorer, stepper } from '../viz/explore';
import { plot } from '../viz/plot';

// ---------------------------------------------------------------- constants (rounded, stated in the lessons)

export const C_KMS = 300_000; // speed of light, km/s
export const AU_KM = 150e6; // Earth–Sun
export const MOON_KM = 384_000; // Earth–Moon
export const SUN_D_KM = 1.4e6;
export const EARTH_D_KM = 12_700;
export const EARTH_R_KM = 6_400;
export const MOON_D_KM = 3_500;
export const YEAR_S = 365.25 * 86_400;
export const LY_KM = C_KMS * YEAR_S; // ≈ 9.5 trillion km
export const PC_LY = 3.26;
export const TILT = 23.4;
export const SYNODIC_DAYS = 29.5;

const SPACE = '#0c1430';
const INK = '#dfe6f5';
const DIM = '#8f9bb8';
const SUN = '#ffc94a';
const EARTH = '#4f9dff';
const MOONC = '#cfd3dc';
const HOT = '#ff8a3d';

const SUPS: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** "10⁷" for 7. */
export const p10 = (k: number) => '10' + String(k).split('').map((c) => SUPS[c] ?? c).join('');

/** A big number in words: 2.5e6 -> "2.5 million". */
export function words(v: number, digits = 2): string {
  const a = Math.abs(v);
  const units: [number, string][] = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  for (const [u, w] of units) if (a >= u) return `${num(Number((v / u).toPrecision(digits)))} ${w}`;
  if (a >= 1000) return Math.round(Number(v.toPrecision(Math.max(digits, 3)))).toLocaleString('en-US');
  return num(Number(v.toPrecision(digits)));
}

/** A duration in seconds as a readable phrase. */
export function duration(s: number): string {
  if (s < 60) return `${num(Number(s.toPrecision(2)))} s`;
  if (s < 3600) return `${num(Number((s / 60).toPrecision(2)))} min`;
  if (s < 86400) return `${num(Number((s / 3600).toPrecision(2)))} h`;
  if (s < YEAR_S) return `${num(Number((s / 86400).toPrecision(2)))} days`;
  return `${words(s / YEAR_S)} years`;
}

function space(W: number, H: number, opts: { stars?: number; seed?: number } = {}): SVGSVGElement {
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img', style: `max-width:${W}px;border-radius:12px;` }) as SVGSVGElement;
  el.appendChild(svg('rect', { x: 0, y: 0, width: W, height: H, rx: 12, style: `fill:${SPACE}` }));
  const rng = seeded(opts.seed ?? 11);
  for (let k = 0; k < (opts.stars ?? 40); k++) {
    el.appendChild(svg('circle', { cx: (rng() * W).toFixed(1), cy: (rng() * H).toFixed(1), r: (0.4 + rng() * 0.9).toFixed(2), style: `fill:#fff;opacity:${(0.25 + rng() * 0.55).toFixed(2)}` }));
  }
  return el;
}
const label = (x: number, y: number, text: string, o: { anchor?: string; color?: string; size?: number; weight?: number } = {}) =>
  svg('text', { x, y, 'text-anchor': o.anchor ?? 'middle', style: `fill:${o.color ?? INK};font-size:${o.size ?? 12}px;font-weight:${o.weight ?? 600};` }, text);
const wrap = (el: Node) => h('div', { class: 'plot-wrap' }, el);
const arrowHead = (x: number, y: number, ang: number, col: string, s = 8) =>
  svg('path', { d: `M${x},${y}L${x - s * Math.cos(ang - 0.45)},${y - s * Math.sin(ang - 0.45)}L${x - s * Math.cos(ang + 0.45)},${y - s * Math.sin(ang + 0.45)}Z`, style: `fill:${col}` });

export function plotBox(spec: PlotSpec): HTMLElement {
  return wrap(plot({ size: [400, 260], ...spec }).el);
}

// ---------------------------------------------------------------- 1 scale

export const SIZES: { exp: number; label: string }[] = [
  { exp: -15, label: 'a proton' },
  { exp: -10, label: 'an atom' },
  { exp: -7, label: 'a virus' },
  { exp: -5, label: 'a human cell' },
  { exp: -3, label: 'a grain of sand' },
  { exp: 0, label: 'a person' },
  { exp: 4, label: 'Mount Everest (8.8 km high)' },
  { exp: 7, label: 'Earth (12,700 km across)' },
  { exp: 9, label: 'the Sun (1.4 million km across)' },
  { exp: 11, label: 'Earth to Sun (150 million km)' },
  { exp: 13, label: 'Neptune’s orbit (9 billion km across)' },
  { exp: 16, label: 'one light-year' },
  { exp: 21, label: 'the Milky Way (100,000 light-years)' },
  { exp: 22, label: 'to the Andromeda galaxy' },
  { exp: 27, label: 'the observable universe' },
];

/** Slide through powers of ten, from a proton to the observable universe. */
export function powersOfTen(): Widget {
  const lo = -15, hi = 27;
  return explorer({
    params: [{ id: 'k', label: 'size', min: lo, max: hi, step: 1, value: 0, format: (v) => `${p10(v)} m` }],
    draw: (v) => {
      const W = 360, H = 120, pad = 18, px = (e: number) => pad + ((e - lo) / (hi - lo)) * (W - 2 * pad);
      const el = space(W, H, { stars: 30, seed: 4 });
      el.appendChild(svg('line', { x1: pad, y1: 78, x2: W - pad, y2: 78, style: `stroke:${DIM};stroke-width:1.5` }));
      for (let e = -10; e <= 20; e += 10) {
        el.appendChild(svg('line', { x1: px(e), y1: 73, x2: px(e), y2: 83, style: `stroke:${DIM};stroke-width:1.5` }));
        el.appendChild(label(px(e), 102, `${p10(e)} m`, { color: DIM, size: 12, weight: 600 }));
      }
      for (const s of SIZES) {
        const on = s.exp === v.k;
        el.appendChild(svg('circle', { cx: px(s.exp), cy: 78, r: on ? 6 : 3.2, style: `fill:${on ? SUN : INK};opacity:${on ? 1 : 0.7}` }));
      }
      el.appendChild(svg('path', { d: `M${px(v.k)},64 l-6,-9 h12 z`, style: `fill:${HOT}` }));
      const here = SIZES.find((s) => s.exp === v.k);
      const below = [...SIZES].reverse().find((s) => s.exp < v.k), above = SIZES.find((s) => s.exp > v.k);
      const text = here ? here.label : `between ${below?.label ?? '…'} and ${above?.label ?? '…'}`;
      el.appendChild(label(W / 2, 26, `${p10(v.k)} metres`, { size: 15, weight: 800 }));
      el.appendChild(label(W / 2, 46, text.length > 52 ? text.slice(0, 50) + '…' : text, { size: 12, color: here ? SUN : INK }));
      return wrap(el);
    },
    readout: (v) => {
      const here = SIZES.find((s) => s.exp === v.k);
      return here ? `${p10(v.k)} m: about the size of ${here.label}` : 'Each notch is ten times the one before.';
    },
  });
}

/** The Sun shrunk to a ball of a chosen size: where does everything else land? */
export function scaleModel(): Widget {
  const rows: [string, number, number][] = [
    // name, diameter km, distance from Sun km
    ['Earth', EARTH_D_KM, AU_KM],
    ['Jupiter', 140_000, 5.2 * AU_KM],
    ['Neptune', 50_000, 30 * AU_KM],
    ['Nearest star', 0.15 * SUN_D_KM, 4.2 * LY_KM],
  ];
  const len = (cm: number) => cm >= 100_000 ? `${words(cm / 100_000)} km` : cm >= 100 ? `${num(Number((cm / 100).toPrecision(2)))} m` : cm >= 1 ? `${num(Number(cm.toPrecision(2)))} cm` : `${num(Number((cm * 10).toPrecision(2)))} mm`;
  return explorer({
    params: [{ id: 's', label: 'Sun', min: 2, max: 60, step: 1, value: 14, format: (v) => `${v} cm` }],
    draw: (v) => {
      const k = v.s / SUN_D_KM; // cm per km
      const W = 360, H = 86;
      const el = space(W, H, { stars: 5, seed: 9 });
      // True proportions: Sun at the left edge, Earth 150 million km away at the right.
      const x0 = 24, x1 = W - 26, kpx = (x1 - x0) / AU_KM;
      el.appendChild(svg('circle', { cx: x0, cy: 44, r: Math.max(0.8, (SUN_D_KM / 2) * kpx), style: `fill:${SUN}` }));
      el.appendChild(svg('circle', { cx: x1, cy: 44, r: 0.6, style: `fill:${EARTH}` }));
      el.appendChild(svg('circle', { cx: x1, cy: 44, r: 6, style: `fill:none;stroke:${EARTH};stroke-width:1;stroke-dasharray:2 2` }));
      el.appendChild(label(x0 + 2, 70, 'Sun', { anchor: 'start', color: SUN, size: 11 }));
      el.appendChild(label(x1 + 4, 70, 'Earth (circled)', { anchor: 'end', color: EARTH, size: 11 }));
      el.appendChild(label(W / 2, 20, 'True proportions: Sun and Earth, 150 million km apart', { color: DIM, size: 11, weight: 500 }));
      const table = h('table', { class: 'data' },
        h('tr', null, h('th', null, 'Model'), h('th', null, 'size'), h('th', null, 'from the Sun')),
        h('tr', null, h('td', null, 'Sun'), h('td', null, `${v.s} cm`), h('td', null, '–')),
        rows.map(([n, d, dist]) => h('tr', null, h('td', null, n), h('td', null, len(d * k)), h('td', null, len(dist * k)))));
      return h('div', null, wrap(el), h('div', { class: 'table-wrap' }, table));
    },
    readout: (v) => `1 cm in the model = ${words(SUN_D_KM / v.s)} km`,
  });
}

/** A ball of a given size with a caption, for the opening question. */
export function grapefruit(): Widget {
  return () => {
    const W = 360, H = 120, el = space(W, H, { stars: 22, seed: 2 });
    el.appendChild(svg('circle', { cx: 80, cy: 58, r: 34, style: `fill:${SUN}` }));
    el.appendChild(label(80, 110, 'Sun: 14 cm', { color: SUN }));
    el.appendChild(svg('circle', { cx: 300, cy: 58, r: 1.2, style: `fill:${EARTH}` }));
    el.appendChild(label(300, 110, 'Earth: ?', { color: EARTH }));
    el.appendChild(svg('line', { x1: 124, y1: 58, x2: 288, y2: 58, style: `stroke:${DIM};stroke-dasharray:4 4` }));
    el.appendChild(label(206, 48, 'how far?', { color: INK }));
    return wrap(el);
  };
}

// ---------------------------------------------------------------- 2 light

/** Earth and Moon to scale, with a light pulse crossing in real time (about 1.3 s). */
export function moonPulse(): Widget {
  return () => {
    const W = 360, H = 100, el = space(W, H, { stars: 8, seed: 5 });
    const x0 = 20, s = (W - 44) / (MOON_KM + EARTH_R_KM), er = EARTH_R_KM * s, mr = (MOON_D_KM / 2) * s;
    const ex = x0 + er, mx = ex + MOON_KM * s;
    el.appendChild(svg('circle', { cx: ex, cy: 50, r: er, style: `fill:${EARTH}` }));
    el.appendChild(svg('circle', { cx: mx, cy: 50, r: Math.max(1.4, mr), style: `fill:${MOONC}` }));
    el.appendChild(svg('circle', { cx: mx, cy: 50, r: 6, style: `fill:none;stroke:${MOONC};stroke-width:1;stroke-dasharray:2 2` }));
    el.appendChild(label(ex, 80, 'Earth', { color: EARTH, size: 11 }));
    el.appendChild(label(mx, 80, 'Moon', { color: MOONC, size: 11 }));
    const t = MOON_KM / C_KMS, dur = 2.5;
    const pulse = svg('circle', { cx: ex + er, cy: 50, r: 3, style: `fill:${SUN}` });
    pulse.appendChild(svg('animate', { attributeName: 'cx', values: `${ex + er};${mx};${mx}`, keyTimes: `0;${(t / dur).toFixed(3)};1`, dur: `${dur}s`, repeatCount: 'indefinite' }));
    pulse.appendChild(svg('animate', { attributeName: 'opacity', values: '1;1;0;0', keyTimes: `0;${(t / dur).toFixed(3)};${(t / dur + 0.02).toFixed(3)};1`, dur: `${dur}s`, repeatCount: 'indefinite' }));
    el.appendChild(pulse);
    el.appendChild(label(W / 2, 22, `To scale, in real time: ${num(t)} s for 384,000 km`, { color: INK, size: 12 }));
    return wrap(el);
  };
}

export const LIGHT_STOPS: { name: string; s: number }[] = [
  { name: 'Moon', s: MOON_KM / C_KMS },
  { name: 'Sun', s: AU_KM / C_KMS },
  { name: 'Neptune', s: (30 * AU_KM) / C_KMS },
  { name: 'nearest star', s: 4.2 * YEAR_S },
  { name: 'Sirius', s: 8.6 * YEAR_S },
  { name: 'galaxy’s centre', s: 26_000 * YEAR_S },
  { name: 'Andromeda', s: 2.5e6 * YEAR_S },
];

/** How far a flash has got after a given time (log slider); the same numbers say how old the light we see is. */
export function lightReach(): Widget {
  const lo = -1, hi = 14;
  return explorer({
    params: [{ id: 't', label: 'time', min: lo, max: hi, step: 0.1, value: 0, format: (v) => duration(10 ** v) }],
    draw: (v) => {
      const W = 360, H = 150, pad = 18, px = (e: number) => pad + ((e - lo) / (hi - lo)) * (W - 2 * pad);
      const el = space(W, H, { stars: 30, seed: 8 });
      el.appendChild(svg('rect', { x: pad, y: 62, width: Math.max(0, px(v.t) - pad), height: 6, rx: 3, style: `fill:${SUN};opacity:.85` }));
      el.appendChild(svg('line', { x1: pad, y1: 65, x2: W - pad, y2: 65, style: `stroke:${DIM};stroke-width:1` }));
      const ticks: [number, string][] = [[0, '1 s'], [Math.log10(3600), '1 h'], [Math.log10(86400 * 30), '1 mo'], [Math.log10(YEAR_S * 100), '100 yr'], [Math.log10(YEAR_S * 1e5), '100,000 yr']];
      for (const [e, t] of ticks) {
        el.appendChild(svg('line', { x1: px(e), y1: 70, x2: px(e), y2: 76, style: `stroke:${DIM}` }));
        el.appendChild(label(px(e), 90, t, { color: DIM, size: 10, weight: 500 }));
      }
      LIGHT_STOPS.forEach((st, k) => {
        const e = Math.log10(st.s), reached = e <= v.t + 1e-9;
        el.appendChild(svg('circle', { cx: px(e), cy: 65, r: 4.5, style: `fill:${reached ? SUN : SPACE};stroke:${reached ? SUN : INK};stroke-width:1.5` }));
        const up = k % 2 === 0, x = px(e);
        const anchor = x > W - 50 ? 'end' : x < 50 ? 'start' : 'middle';
        el.appendChild(label(anchor === 'end' ? W - 6 : anchor === 'start' ? 6 : x, up ? 48 : 110, st.name, { color: reached ? SUN : INK, size: 11, anchor }));
      });
      el.appendChild(label(W / 2, 22, `after ${duration(10 ** v.t)}: ${words((10 ** v.t) * C_KMS)} km`, { size: 13, weight: 800 }));
      el.appendChild(label(W / 2, 136, '(log scale: each notch ×10)', { color: DIM, size: 10, weight: 500 }));
      return wrap(el);
    },
    readout: (v) => {
      const got = LIGHT_STOPS.filter((s) => Math.log10(s.s) <= v.t + 1e-9);
      return got.length ? `Light has reached: ${got.map((g) => g.name).join(', ')}` : 'The flash hasn’t reached the Moon yet.';
    },
  });
}

// ---------------------------------------------------------------- 3 orbits

/** Pull of gravity against distance from Earth's centre (in Earth radii). */
export function inverseSquare(): Widget {
  return explorer({
    params: [{ id: 'r', label: 'distance', min: 1, max: 10, step: 0.5, value: 1.5, format: (v) => `${v} R` }],
    draw: (v) => {
      const W = 360, H = 150, el = space(W, H, { stars: 14, seed: 3 });
      const R = 22, ex = 6 + R, step = (W - ex - R - 22) / 9, sx = ex + R + (v.r - 1) * step;
      const cy = 44;
      el.appendChild(svg('circle', { cx: ex, cy, r: R, style: `fill:${EARTH}` }));
      for (let k = 2; k <= 10; k++) el.appendChild(svg('line', { x1: ex + R + (k - 1) * step, y1: 74, x2: ex + R + (k - 1) * step, y2: 80, style: `stroke:${DIM}` }));
      el.appendChild(svg('line', { x1: ex + R, y1: 77, x2: W - 22, y2: 77, style: `stroke:${DIM}` }));
      el.appendChild(label(ex + R + step, 94, '2R', { color: DIM, size: 11 }));
      el.appendChild(label(ex + R + 4 * step, 94, '5R', { color: DIM, size: 11 }));
      el.appendChild(label(ex + R + 9 * step, 94, '10R', { color: DIM, size: 11 }));
      const pull = 1 / (v.r * v.r);
      el.appendChild(svg('rect', { x: sx - 6, y: cy - 6, width: 12, height: 12, rx: 2, style: `fill:${INK}` }));
      el.appendChild(svg('line', { x1: sx - 22, y1: cy, x2: sx - 8, y2: cy, style: `stroke:${HOT};stroke-width:2.5` }));
      el.appendChild(arrowHead(sx - 24, cy, Math.PI, HOT, 7));
      // Pull bar along the bottom: full width = surface gravity.
      const bw = W - 2 * 16;
      el.appendChild(svg('rect', { x: 16, y: 124, width: bw, height: 12, rx: 4, style: 'fill:#26304f' }));
      el.appendChild(svg('rect', { x: 16, y: 124, width: Math.max(2, bw * pull), height: 12, rx: 4, style: `fill:${HOT}` }));
      el.appendChild(label(16, 118, `pull: ${num(Number((pull * 100).toPrecision(3)))}% of surface gravity`, { color: HOT, size: 12, anchor: 'start' }));
      return wrap(el);
    },
    readout: (v) => `${v.r} Earth radii from the centre: pull ÷ ${num(v.r * v.r)} = ${num(Number((9.8 / v.r / v.r).toPrecision(3)))} m/s²`,
  });
}

/** Newton's cannon on a (very tall) mountain: drawn from the exact conic for each launch speed. */
export const V_CIRC = 7.9; // km/s at Earth's surface
export function cannon(goal?: (v: number) => boolean, goalText?: string): Widget {
  const r0 = 1.02; // launch height in Earth radii (a 130 km mountain, no air)
  return explorer({
    params: [{ id: 'v', label: 'launch speed', min: 0, max: 12, step: 0.5, value: 4, format: (v) => `${v} km/s` }],
    draw: (v) => {
      const W = 360, H = 300, cx = W / 2, cy = 172, R = 78;
      const el = space(W, H, { stars: 36, seed: 6 });
      el.appendChild(svg('circle', { cx, cy, r: R, style: `fill:${EARTH}` }));
      el.appendChild(svg('path', { d: `M${cx - 9},${cy - R + 1}L${cx},${cy - R * r0 - 2}L${cx + 9},${cy - R + 1}Z`, style: 'fill:#7a6a55' }));
      const u = v.v / V_CIRC;
      const pts: [number, number][] = [];
      let fate: 'falls' | 'orbits' | 'escapes' = 'falls';
      let travelled = 0;
      if (u < 0.02) {
        pts.push([cx, cy - R * r0], [cx, cy - R]);
      } else {
        const p = r0 * r0 * u * u, e = Math.abs(r0 * u * u - 1), omega = r0 * u * u >= 1 ? Math.PI / 2 : -Math.PI / 2;
        // Moving right from the top = clockwise = decreasing math angle.
        const n = 720;
        fate = e >= 1 ? 'escapes' : 'orbits';
        for (let k = 0; k <= n; k++) {
          const th = Math.PI / 2 - (2 * Math.PI * k) / n;
          const den = 1 + e * Math.cos(th - omega);
          const r = den > 1e-6 ? p / den : Infinity;
          if (r < 1) { fate = 'falls'; travelled = (2 * Math.PI * k) / n; pts.push([cx + R * Math.cos(th), cy - R * Math.sin(th)]); break; }
          if (r > 4) { if (e < 1) fate = 'orbits'; break; }
          pts.push([cx + R * r * Math.cos(th), cy - R * r * Math.sin(th)]);
        }
      }
      el.appendChild(svg('path', { d: pts.map((q, k) => `${k ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(''), style: `fill:none;stroke:${HOT};stroke-width:2.5;stroke-linejoin:round` }));
      el.appendChild(svg('circle', { cx, cy: cy - R * r0 - 2, r: 4, style: `fill:${HOT}` }));
      const msg = fate === 'falls' ? (u < 0.02 ? 'drops straight down' : `falls back after ${words(travelled * EARTH_R_KM)} km`) : fate === 'orbits' ? 'keeps falling, keeps missing: an orbit' : 'escapes Earth for good';
      el.appendChild(label(W / 2, 22, msg, { color: fate === 'orbits' ? '#7ee2a8' : INK, size: 13, weight: 800 }));
      el.appendChild(label(W / 2, H - 10, 'Earth to scale; mountain hugely exaggerated; no air', { color: DIM, size: 10, weight: 500 }));
      return wrap(el);
    },
    readout: (v) => `${v.v} km/s sideways (about ${num(Math.round(v.v * 3600 / 100) * 100)} km/h)`,
    goal: goal ? (v) => goal(v.v) : undefined,
    goalText,
  });
}

export const PLANETS: { name: string; a: number; T: number }[] = [
  { name: 'Mercury', a: 0.39, T: 0.24 },
  { name: 'Venus', a: 0.72, T: 0.62 },
  { name: 'Earth', a: 1, T: 1 },
  { name: 'Mars', a: 1.52, T: 1.88 },
  { name: 'Jupiter', a: 5.2, T: 11.9 },
  { name: 'Saturn', a: 9.54, T: 29.5 },
  { name: 'Uranus', a: 19.2, T: 84 },
  { name: 'Neptune', a: 30.1, T: 165 },
];

/** Planet data on log-log axes: a straight line of slope 3/2. */
export function keplerPlot(extra: Layer[] = []): PlotSpec {
  const lab = (k: number) => (k === 0 ? '1' : k === 1 ? '10' : k === 2 ? '100' : k === 3 ? '1,000' : k === -1 ? '0.1' : '');
  return {
    x: [-1, 2.5], y: [-1, 3.5], size: [380, 300], ticks: [1, 1], xlabel: 'distance a (AU), log scale', ylabel: 'period T (years)',
    tickFormat: lab,
    layers: [
      { type: 'fn', f: (x) => 1.5 * x, color: 'var(--muted)', dash: true, width: 1.5 },
      { type: 'dots', pts: PLANETS.map((p) => [Math.log10(p.a), Math.log10(p.T)] as [number, number]), color: 'var(--c1)', r: 5,
        labels: PLANETS.map((p) => (['Mercury', 'Earth', 'Jupiter', 'Neptune'].includes(p.name) ? p.name : '')) },
      ...extra,
    ],
  };
}

/** A planet orbiting the Sun at a chosen distance, with its true period (1 year = 2 s). */
export function keplerOrbit(goal?: (a: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [{ id: 'a', label: 'orbit size', min: 0.5, max: 6, step: 0.5, value: 1, format: (v) => `${v} AU` }],
    draw: (v) => {
      const W = 360, H = 300, cx = W / 2, cy = H / 2 + 6, k = 21;
      const el = space(W, H, { stars: 40, seed: 12 });
      el.appendChild(svg('circle', { cx, cy, r: 9, style: `fill:${SUN}` }));
      el.appendChild(svg('circle', { cx, cy, r: k, style: `fill:none;stroke:${EARTH};stroke-dasharray:3 4;opacity:.8` }));
      el.appendChild(svg('circle', { cx, cy, r: k * v.a, style: `fill:none;stroke:${DIM}` }));
      const spin = (r: number, T: number, col: string, size: number) => {
        const g = svg('g', {});
        g.appendChild(svg('circle', { cx: cx + r, cy, r: size, style: `fill:${col}` }));
        g.appendChild(svg('animateTransform', { attributeName: 'transform', type: 'rotate', from: `0 ${cx} ${cy}`, to: `-360 ${cx} ${cy}`, dur: `${(2 * T).toFixed(3)}s`, repeatCount: 'indefinite' }));
        return g;
      };
      el.appendChild(spin(k, 1, EARTH, 3.5));
      el.appendChild(spin(k * v.a, v.a ** 1.5, HOT, 6));
      el.appendChild(label(W / 2, 20, `T = √(${v.a}³) = ${num(Number((v.a ** 1.5).toPrecision(3)))} year${v.a === 1 ? '' : 's'}`, { size: 13, weight: 800 }));
      el.appendChild(label(W / 2, H - 10, 'blue: Earth, 1 AU · 1 year = 2 seconds here', { color: DIM, size: 10, weight: 500 }));
      return wrap(el);
    },
    readout: (v) => `a = ${v.a} AU → a³ = ${num(v.a ** 3)} → T = ${num(Number((v.a ** 1.5).toPrecision(3)))} year${v.a === 1 ? '' : 's'}`,
    goal: goal ? (v) => goal(v.a) : undefined,
    goalText,
  });
}

// ---------------------------------------------------------------- 4 seasons and the Moon

/** A beam of sunlight hitting flat ground: the lower the Sun, the more ground it covers. */
export function sunBeam(): Widget {
  return explorer({
    params: [{ id: 'e', label: 'Sun height', min: 10, max: 90, step: 5, value: 70, format: (v) => `${v}°` }],
    draw: (v) => {
      const W = 360, H = 190, gy = 160, w = 60, cx = 180;
      const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
      const a = (v.e * Math.PI) / 180, foot = w / Math.sin(a);
      el.appendChild(svg('rect', { x: 0, y: gy, width: W, height: H - gy, style: 'fill:color-mix(in srgb, var(--c3) 30%, transparent)' }));
      el.appendChild(svg('line', { x1: 0, y1: gy, x2: W, y2: gy, style: 'stroke:var(--c3);stroke-width:2' }));
      // Beam comes down from the upper left at angle e above the horizon.
      const dx = Math.cos(a), dy = Math.sin(a), Lb = 200;
      const xA = cx - foot / 2, xB = cx + foot / 2;
      const poly = [[xA, gy], [xB, gy], [xB - dx * Lb, gy - dy * Lb], [xA - dx * Lb, gy - dy * Lb]];
      el.appendChild(svg('path', { d: 'M' + poly.map((p) => p.map((q) => q.toFixed(1)).join(',')).join('L') + 'Z', style: 'fill:color-mix(in srgb, var(--c5) 45%, transparent);stroke:color-mix(in srgb, var(--c5) 70%, var(--text));stroke-width:1.5' }));
      el.appendChild(svg('line', { x1: xA, y1: gy + 8, x2: xB, y2: gy + 8, style: 'stroke:var(--text);stroke-width:2' }));
      el.appendChild(svg('text', { x: cx, y: gy + 24, 'text-anchor': 'middle', class: 'tick', style: 'fill:var(--text);font-weight:700' }, `ground lit: ${num(Number((1 / Math.sin(a)).toPrecision(3)))} × the beam’s width`));
      return h('div', { class: 'plot-wrap' }, el);
    },
    readout: (v) => `Each patch of ground gets ${Math.round(Math.sin((v.e * Math.PI) / 180) * 100)}% of what an overhead Sun gives`,
  });
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NORTH_SEASON = ['winter', 'winter', 'spring begins', 'spring', 'spring', 'midsummer', 'summer', 'summer', 'autumn begins', 'autumn', 'autumn', 'midwinter'];
const SOUTH_SEASON = ['summer', 'summer', 'autumn begins', 'autumn', 'autumn', 'midwinter', 'winter', 'winter', 'spring begins', 'spring', 'spring', 'midsummer'];
/** The Sun's declination on the 21st of month m (0 = January). */
export const declination = (m: number) => TILT * Math.sin((2 * Math.PI * (m - 2)) / 12);
/** Earth–Sun distance (million km) on the 21st of month m: closest in early January. */
export const sunDistance = (m: number) => 149.6 * (1 - 0.0167 * Math.cos((2 * Math.PI * (m * 30.44 + 21 - 3)) / 365.25));

/** Earth on its orbit, axis fixed in space. Slider: the month (21st). */
export function seasonOrbit(goal?: (m: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [{ id: 'm', label: 'month', min: 0, max: 11, step: 1, value: 5, format: (v) => `21 ${MONTHS[v]}` }],
    draw: (v) => {
      const W = 360, H = 210, cx = W / 2, cy = 112, rx = 132, ry = 56;
      const el = space(W, H, { stars: 30, seed: 14 });
      el.appendChild(svg('ellipse', { cx, cy, rx, ry, style: `fill:none;stroke:${DIM};stroke-dasharray:3 4` }));
      const pos = (m: number): [number, number] => { const ps = Math.PI + ((m - 5) * Math.PI) / 6; return [cx + rx * Math.cos(ps), cy - ry * Math.sin(ps)]; };
      for (const [m, t] of [[5, 'June'], [8, 'Sep'], [11, 'Dec'], [2, 'Mar']] as [number, string][]) {
        const [x, y] = pos(m);
        el.appendChild(label(x + (m === 5 ? -4 : m === 11 ? 4 : 0), y + (m === 8 ? 20 : m === 2 ? -10 : 34), t, { color: DIM, size: 10, weight: 500, anchor: m === 5 ? 'start' : m === 11 ? 'end' : 'middle' }));
      }
      const [x, y] = pos(v.m);
      const behind = y < cy; // far side of the orbit: drawn before the Sun
      const earth = svg('g', {});
      const r = 15, ang = Math.atan2(cy - y, cx - x); // towards the Sun on screen
      earth.appendChild(svg('circle', { cx: x, cy: y, r, style: 'fill:#24406e' }));
      // Lit half faces the Sun.
      const ax = Math.cos(ang + Math.PI / 2) * r, ay = Math.sin(ang + Math.PI / 2) * r;
      earth.appendChild(svg('path', { d: `M${x + ax},${y + ay}A${r},${r} 0 0 0 ${x - ax},${y - ay}Z`, style: `fill:${EARTH}` }));
      const t = (TILT * Math.PI) / 180, tx = Math.sin(t) * (r + 8), ty = Math.cos(t) * (r + 8);
      earth.appendChild(svg('line', { x1: x - tx, y1: y + ty, x2: x + tx, y2: y - ty, style: `stroke:${INK};stroke-width:2` }));
      earth.appendChild(label(x + tx + 3, y - ty - 2, 'N', { color: INK, size: 10, anchor: 'start' }));
      // Equator: perpendicular to the axis, flattened.
      earth.appendChild(svg('ellipse', { cx: x, cy: y, rx: r, ry: 3, transform: `rotate(${TILT} ${x} ${y})`, style: `fill:none;stroke:${INK};stroke-width:1;opacity:.6` }));
      const sun = svg('circle', { cx, cy, r: 18, style: `fill:${SUN}` });
      if (behind) el.append(earth, sun); else el.append(sun, earth);
      el.appendChild(label(W / 2, 22, `North: ${NORTH_SEASON[v.m]} · South: ${SOUTH_SEASON[v.m]}`, { size: 13, weight: 700 }));
      el.appendChild(label(W / 2, H - 8, 'the axis always points the same way in space', { color: DIM, size: 10, weight: 500 }));
      return wrap(el);
    },
    readout: (v) => `Sun ${num(Number(sunDistance(v.m).toPrecision(4)))} million km away · noon Sun at 40°N: ${(90 - 40 + declination(v.m)).toFixed(1)}° high`,
    goal: goal ? (v) => goal(v.m) : undefined,
    goalText,
  });
}

export function phaseName(e: number): string {
  const d = ((e % 360) + 360) % 360;
  if (d === 0) return 'new moon';
  if (d < 90) return 'waxing crescent';
  if (d === 90) return 'first quarter';
  if (d < 180) return 'waxing gibbous';
  if (d === 180) return 'full moon';
  if (d < 270) return 'waning gibbous';
  if (d === 270) return 'third quarter';
  return 'waning crescent';
}

/** The Moon as seen from Earth's northern hemisphere, e degrees past new moon. */
export function phaseDisc(e: number, r: number, cx: number, cy: number): SVGElement {
  const g = svg('g', {});
  g.appendChild(svg('circle', { cx, cy, r, style: 'fill:#2a3350' }));
  const d = ((e % 360) + 360) % 360;
  if (d === 180) { g.appendChild(svg('circle', { cx, cy, r, style: `fill:${MOONC}` })); return g; }
  if (d === 0) { g.appendChild(svg('circle', { cx, cy, r, style: `fill:none;stroke:${DIM};stroke-dasharray:2 3` })); return g; }
  const s = Math.cos((d * Math.PI) / 180), rx = Math.abs(s) * r, waxing = d < 180;
  const limb = waxing ? 1 : 0, term = waxing ? (s > 0 ? 0 : 1) : (s > 0 ? 1 : 0);
  g.appendChild(svg('path', { d: `M${cx},${cy - r}A${r},${r} 0 0 ${limb} ${cx},${cy + r}A${rx.toFixed(2)},${r} 0 0 ${term} ${cx},${cy - r}Z`, style: `fill:${MOONC}` }));
  return g;
}

/** Top-down: Sun's light from the left, the Moon at e degrees past new; inset: what we see. */
function moonScene(e: number): SVGSVGElement {
  const W = 360, H = 220, cx = 140, cy = 112, R = 74;
  const el = space(W, H, { stars: 26, seed: 21 });
  for (let k = 0; k < 5; k++) {
    const y = 40 + k * 36;
    el.appendChild(svg('line', { x1: 6, y1: y, x2: 30, y2: y, style: `stroke:${SUN};stroke-width:2;opacity:.8` }));
    el.appendChild(arrowHead(36, y, 0, SUN, 6));
  }
  el.appendChild(label(24, 22, 'sunlight', { color: SUN, size: 10, anchor: 'start' }));
  el.appendChild(svg('circle', { cx, cy, r: R, style: `fill:none;stroke:${DIM};stroke-dasharray:3 4` }));
  const half = (x: number, y: number, r: number, lit: string, dark: string) => {
    const g = svg('g', {});
    g.appendChild(svg('circle', { cx: x, cy: y, r, style: `fill:${dark}` }));
    g.appendChild(svg('path', { d: `M${x},${y - r}A${r},${r} 0 0 0 ${x},${y + r}Z`, style: `fill:${lit}` }));
    return g;
  };
  el.appendChild(half(cx, cy, 16, EARTH, '#24406e'));
  const a = (e * Math.PI) / 180, mx = cx - R * Math.cos(a), my = cy + R * Math.sin(a);
  el.appendChild(svg('line', { x1: cx, y1: cy, x2: mx, y2: my, style: `stroke:${DIM};stroke-width:1;opacity:.6` }));
  el.appendChild(half(mx, my, 9, MOONC, '#3a4260'));
  // Inset: the view from Earth.
  el.appendChild(svg('rect', { x: 262, y: 56, width: 90, height: 112, rx: 10, style: 'fill:#060a18;stroke:#2a3350' }));
  el.appendChild(label(307, 74, 'we see', { color: DIM, size: 10, weight: 500 }));
  el.appendChild(phaseDisc(e, 28, 307, 114));
  el.appendChild(label(W / 2, H - 10, `${phaseName(e)} · day ${num(Number(((e / 360) * SYNODIC_DAYS).toFixed(1)))} of 29.5`, { size: 12, weight: 700 }));
  el.appendChild(label(cx, cy + 32, 'Earth', { color: EARTH, size: 10 }));
  return el;
}

/** Slide the Moon round its orbit. */
export function moonPhases(goal?: (e: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [{ id: 'e', label: 'Moon', min: 0, max: 345, step: 15, value: 180, format: (v) => `${v}°` }],
    draw: (v) => wrap(moonScene(v.e)),
    readout: (v) => `${v.e}° round from new moon (orbiting anticlockwise, seen from above the North Pole)`,
    goal: goal ? (v) => goal(v.e) : undefined,
    goalText,
  });
}

/** A month of phases, with Play. */
export function moonCycle(): Widget {
  return () => stepper(9, (i) => wrap(moonScene(i * 45)), { caption: (i) => phaseName(i * 45), autoplayMs: 900 });
}

/** The real Moon (spins once per orbit) against a Moon that doesn't spin. */
export function tidalLock(): Widget {
  return () => stepper(9, (i) => {
    const W = 360, H = 200, el = space(W, H, { stars: 26, seed: 31 });
    const a = (i / 8) * 2 * Math.PI;
    const panel = (ox: number, spins: boolean, title: string) => {
      const cx = ox + 88, cy = 108, R = 56;
      el.appendChild(label(cx, 22, title, { size: 11, weight: 700 }));
      el.appendChild(svg('circle', { cx, cy, r: R, style: `fill:none;stroke:${DIM};stroke-dasharray:3 4` }));
      el.appendChild(svg('circle', { cx, cy, r: 11, style: `fill:${EARTH}` }));
      const mx = cx + R * Math.cos(a), my = cy - R * Math.sin(a);
      el.appendChild(svg('circle', { cx: mx, cy: my, r: 13, style: `fill:${MOONC}` }));
      // The marked face: towards Earth if it spins with its orbit, else always towards the right.
      const fa = spins ? a + Math.PI : 0;
      const fx = mx + 9 * Math.cos(fa), fy = my - 9 * Math.sin(fa);
      el.appendChild(svg('circle', { cx: fx, cy: fy, r: 4, style: `fill:${HOT}` }));
      const facing = Math.cos(fa - (a + Math.PI)) > 0.7;
      el.appendChild(label(cx, H - 14, facing ? 'same face to Earth' : 'Earth sees another side', { color: facing ? '#7ee2a8' : INK, size: 11, weight: 600 }));
    };
    panel(4, true, 'Spins once per orbit');
    panel(180, false, 'Doesn’t spin');
    el.appendChild(svg('line', { x1: 180, y1: 34, x2: 180, y2: H - 30, style: `stroke:${DIM};opacity:.4` }));
    return wrap(el);
  }, { caption: (i) => `day ${Math.round((i / 8) * 27.3)} of the Moon’s 27-day orbit`, autoplayMs: 700 });
}

// ---------------------------------------------------------------- 5 measuring

/** Your thumb seen by each eye in turn (top view, eyes 6.5 cm apart, not to scale). */
export function thumbParallax(): Widget {
  return explorer({
    params: [{ id: 'd', label: 'thumb', min: 15, max: 70, step: 5, value: 60, format: (v) => `${v} cm` }],
    draw: (v) => {
      const W = 360, H = 220, eyeY = 200, wallY = 24, sep = 40, cx = W / 2;
      const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
      // Thumb drawn at d on a 0..80 cm scale between the eyes and the wall.
      const ty = eyeY - (v.d / 80) * (eyeY - wallY - 20);
      const L: [number, number] = [cx - sep / 2, eyeY], R: [number, number] = [cx + sep / 2, eyeY];
      const hit = (e: [number, number]) => e[0] + ((cx - e[0]) * (eyeY - wallY)) / (eyeY - ty);
      el.appendChild(svg('rect', { x: 10, y: wallY - 12, width: W - 20, height: 12, rx: 3, style: 'fill:var(--panel2);stroke:var(--line)' }));
      const lx = hit(L), rx = hit(R);
      el.appendChild(svg('line', { x1: L[0], y1: L[1], x2: lx, y2: wallY, style: 'stroke:var(--c1);stroke-width:1.5' }));
      el.appendChild(svg('line', { x1: R[0], y1: R[1], x2: rx, y2: wallY, style: 'stroke:var(--c2);stroke-width:1.5' }));
      el.appendChild(svg('circle', { cx: Math.max(12, Math.min(W - 12, lx)), cy: wallY - 6, r: 5, style: 'fill:var(--c1)' }));
      el.appendChild(svg('circle', { cx: Math.max(12, Math.min(W - 12, rx)), cy: wallY - 6, r: 5, style: 'fill:var(--c2)' }));
      el.appendChild(svg('rect', { x: cx - 7, y: ty - 10, width: 14, height: 20, rx: 6, style: 'fill:var(--c5);stroke:var(--text);stroke-width:1' }));
      el.appendChild(svg('circle', { cx: L[0], cy: L[1], r: 6, style: 'fill:var(--c1)' }));
      el.appendChild(svg('circle', { cx: R[0], cy: R[1], r: 6, style: 'fill:var(--c2)' }));
      el.appendChild(svg('text', { x: L[0] - 10, y: eyeY + 4, 'text-anchor': 'end', class: 'tick' }, 'left eye'));
      el.appendChild(svg('text', { x: R[0] + 10, y: eyeY + 4, class: 'tick' }, 'right eye'));
      el.appendChild(svg('text', { x: cx + 14, y: ty + 4, class: 'tick' }, 'thumb'));
      el.appendChild(svg('text', { x: 14, y: wallY + 16, class: 'tick' }, 'far wall'));
      return h('div', { class: 'plot-wrap' }, el);
    },
    readout: (v) => `thumb ${v.d} cm away: it jumps by ${(2 * Math.atan(3.25 / v.d) * 180 / Math.PI).toFixed(1)}° against the wall`,
  });
}

/** Earth half a year apart sees a nearby star shift against far ones. p = 1/d. */
export function stellarParallax(goal?: (d: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [{ id: 'd', label: 'distance', min: 1, max: 10, step: 0.5, value: 1, format: (v) => `${v} pc` }],
    draw: (v) => {
      const W = 360, H = 260, cx = W / 2, sy = 214, orb = 70;
      const el = space(W, H, { stars: 0 });
      // Far background stars along the top.
      for (let k = 0; k < 13; k++) el.appendChild(svg('circle', { cx: 20 + k * 26.5, cy: 18 + (k % 3) * 5, r: 1.4, style: `fill:${INK};opacity:.7` }));
      el.appendChild(svg('ellipse', { cx, cy: sy, rx: orb, ry: 18, style: `fill:none;stroke:${DIM};stroke-dasharray:3 4` }));
      el.appendChild(svg('circle', { cx, cy: sy, r: 8, style: `fill:${SUN}` }));
      const J: [number, number] = [cx - orb, sy], Jl: [number, number] = [cx + orb, sy];
      // Star height: exaggerated, nearer stars lower (bigger angle).
      const starY = sy - 40 - (v.d - 1) * 14;
      el.appendChild(svg('line', { x1: J[0], y1: J[1], x2: cx, y2: starY, style: `stroke:${EARTH};stroke-width:1.2` }));
      el.appendChild(svg('line', { x1: Jl[0], y1: Jl[1], x2: cx, y2: starY, style: `stroke:${HOT};stroke-width:1.2` }));
      // Extend the sight lines to the background.
      const toBg = (e: [number, number]) => { const k = (30 - e[1]) / (starY - e[1]); return e[0] + (cx - e[0]) * k; };
      el.appendChild(svg('line', { x1: cx, y1: starY, x2: toBg(J), y2: 30, style: `stroke:${EARTH};stroke-width:1;stroke-dasharray:3 3;opacity:.7` }));
      el.appendChild(svg('line', { x1: cx, y1: starY, x2: toBg(Jl), y2: 30, style: `stroke:${HOT};stroke-width:1;stroke-dasharray:3 3;opacity:.7` }));
      el.appendChild(svg('circle', { cx, cy: starY, r: 5, style: `fill:#fff` }));
      el.appendChild(svg('circle', { cx: J[0], cy: J[1], r: 6, style: `fill:${EARTH}` }));
      el.appendChild(svg('circle', { cx: Jl[0], cy: Jl[1], r: 6, style: `fill:${HOT}` }));
      el.appendChild(label(J[0] - 8, sy + 26, 'Earth in Jan', { color: EARTH, size: 10, anchor: 'middle' }));
      el.appendChild(label(Jl[0] + 8, sy + 26, 'Earth in July', { color: HOT, size: 10, anchor: 'middle' }));
      el.appendChild(label(cx + 10, starY + 4, 'nearby star', { size: 10, anchor: 'start' }));
      el.appendChild(label(cx, H - 6, 'angles hugely exaggerated', { color: DIM, size: 10, weight: 500 }));
      return wrap(el);
    },
    readout: (v) => `parallax p = 1 ÷ ${v.d} = ${num(1 / v.d)}″ · distance ${v.d} pc ≈ ${num(Number((v.d * PC_LY).toPrecision(3)))} light-years`,
    goal: goal ? (v) => goal(v.d) : undefined,
    goalText,
  });
}

/** Eratosthenes: Sun overhead at Syene, a shadow at Alexandria 800 km north. */
export function eratosthenes(goal?: (a: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [{ id: 'a', label: 'shadow angle', min: 2, max: 15, step: 0.1, value: 12, format: (v) => `${v.toFixed(1)}°` }],
    draw: (v) => {
      const W = 360, H = 250, cx = 150, cy = 250, R = 190;
      const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
      el.appendChild(svg('circle', { cx, cy, r: R, style: 'fill:color-mix(in srgb, var(--c1) 16%, transparent);stroke:var(--c1);stroke-width:2' }));
      // Parallel sunbeams straight down.
      for (let x = 20; x <= W - 10; x += 34) el.appendChild(svg('line', { x1: x, y1: 0, x2: x, y2: 22, style: 'stroke:color-mix(in srgb, var(--c5) 70%, var(--text));stroke-width:2' }));
      el.appendChild(svg('text', { x: W - 8, y: 38, 'text-anchor': 'end', class: 'tick', style: 'fill:color-mix(in srgb, var(--c5) 70%, var(--text));font-weight:700' }, 'parallel sunbeams'));
      const t = (v.a * Math.PI) / 180;
      const S: [number, number] = [cx, cy - R];
      const A: [number, number] = [cx + R * Math.sin(t), cy - R * Math.cos(t)];
      el.appendChild(svg('line', { x1: cx, y1: cy, x2: S[0], y2: S[1] - 22, style: 'stroke:var(--muted);stroke-dasharray:4 4' }));
      el.appendChild(svg('line', { x1: cx, y1: cy, x2: cx + (R + 34) * Math.sin(t), y2: cy - (R + 34) * Math.cos(t), style: 'stroke:var(--muted);stroke-dasharray:4 4' }));
      // Stick at Alexandria, radial, and its shadow along the ground (away from Syene).
      const sl = 26, top: [number, number] = [A[0] + sl * Math.sin(t), A[1] - sl * Math.cos(t)];
      el.appendChild(svg('line', { x1: top[0], y1: top[1] - 18, x2: top[0], y2: top[1], style: 'stroke:color-mix(in srgb, var(--c5) 70%, var(--text));stroke-width:1.5' }));
      el.appendChild(svg('line', { x1: A[0], y1: A[1], x2: top[0], y2: top[1], style: 'stroke:var(--text);stroke-width:3' }));
      const shLen = sl * Math.tan(t);
      el.appendChild(svg('line', { x1: A[0], y1: A[1], x2: A[0] + shLen * Math.cos(t), y2: A[1] + shLen * Math.sin(t), style: 'stroke:var(--text);stroke-width:4;opacity:.45' }));
      el.appendChild(svg('rect', { x: S[0] - 4, y: S[1] - 2, width: 8, height: 12, style: 'fill:var(--panel2);stroke:var(--text)' }));
      el.appendChild(svg('text', { x: S[0] - 8, y: S[1] - 8, 'text-anchor': 'end', class: 'tick', style: 'font-weight:700' }, 'Syene: no shadow'));
      el.appendChild(svg('text', { x: A[0] + 16, y: A[1] + 6, class: 'tick', style: 'font-weight:700' }, 'Alexandria, 800 km on'));
      // Angle at the centre.
      const ar = 40;
      el.appendChild(svg('path', { d: `M${cx},${cy - ar}A${ar},${ar} 0 0 1 ${cx + ar * Math.sin(t)},${cy - ar * Math.cos(t)}`, style: 'fill:none;stroke:var(--c2);stroke-width:2.5' }));
      el.appendChild(svg('text', { x: cx + 6, y: cy - ar - 6, class: 'tick', style: 'fill:var(--c2);font-weight:700' }, `${v.a.toFixed(1)}°`));
      return h('div', { class: 'plot-wrap' }, el);
    },
    readout: (v) => `circumference = 800 km × 360 ÷ ${v.a.toFixed(1)} = ${Math.round(800 * 360 / v.a).toLocaleString('en-US')} km`,
    goal: goal ? (v) => goal(v.a) : undefined,
    goalText,
  });
}

// ---------------------------------------------------------------- 6 stars

/** The same light spread over a screen d times as far: d × d squares. */
export function lightSpread(): Widget {
  return explorer({
    params: [{ id: 'd', label: 'distance', min: 1, max: 4, step: 1, value: 2, format: (v) => `${v}×` }],
    draw: (v) => {
      const W = 360, H = 180, sx = 18, cy = 90, u = 44;
      const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
      const x = sx + v.d * u, half = (v.d * 34) / 2;
      el.appendChild(svg('path', { d: `M${sx},${cy}L${x},${cy - half}L${x},${cy + half}Z`, style: 'fill:color-mix(in srgb, var(--c5) 35%, transparent);stroke:var(--c5)' }));
      el.appendChild(svg('circle', { cx: sx, cy, r: 7, style: 'fill:var(--c5);stroke:var(--text);stroke-width:1' }));
      el.appendChild(svg('line', { x1: x, y1: cy - half, x2: x, y2: cy + half, style: 'stroke:var(--text);stroke-width:3' }));
      // Face-on view of that screen: d × d cells, one highlighted.
      const gx = 220, n = v.d, size = 120, c = size / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        el.appendChild(svg('rect', { x: gx + i * c, y: cy - size / 2 + j * c, width: c - 2, height: c - 2, rx: 2, style: `fill:${i === 0 && j === 0 ? 'var(--c5)' : 'color-mix(in srgb, var(--c5) 30%, transparent)'};stroke:var(--line)` }));
      }
      el.appendChild(svg('text', { x: gx + size / 2, y: H - 12, 'text-anchor': 'middle', class: 'tick' }, `screen face-on: ${n * n} square${n > 1 ? 's' : ''}`));
      el.appendChild(svg('text', { x: sx, y: H - 12, class: 'tick' }, 'side view'));
      return h('div', { class: 'plot-wrap' }, el);
    },
    readout: (v) => v.d === 1 ? 'Distance 1: the light covers 1 square' : `${v.d}× as far: the light covers ${v.d * v.d} squares, so each gets 1/${v.d * v.d}`,
  });
}

/** Approximate RGB of a black body at temperature T kelvin (Tanner Helland's fit). */
export function tempColor(T: number): string {
  const t = T / 100;
  const cl = (x: number) => Math.round(Math.max(0, Math.min(255, x)));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}
export const WIEN = 2_900_000; // nm·K
/** Planck spectrum shape, scaled so its peak is 1. */
export function planck(lnm: number, T: number): number {
  const f = (l: number) => 1 / (l ** 5 * (Math.exp(1.4388e7 / (l * T)) - 1));
  return f(lnm) / f(2.898e6 / T);
}

/** Temperature slider: the spectrum's peak moves, and the star's colour changes. */
export function starSpectrum(goal?: (T: number) => boolean, goalText?: string): Widget {
  return explorer({
    params: [{ id: 'T', label: 'temperature', min: 2500, max: 15000, step: 100, value: 3000, format: (v) => `${v.toLocaleString('en-US')} K` }],
    draw: (v) => {
      const view = plot({ x: [100, 2000], y: [0, 1.15], size: [380, 220], ticks: [300, 0.5], xlabel: 'wavelength (nm)', grid: false,
        tickFormat: (x) => (x > 50 ? String(x) : ''),
        layers: [] });
      const grad = 'g' + Math.random().toString(36).slice(2, 8);
      const stops = [[0, '#7b2cff'], [0.2, '#2a5bff'], [0.38, '#18c0d8'], [0.5, '#32c94a'], [0.62, '#f4e23a'], [0.78, '#ff8a1e'], [1, '#e8222a']];
      view.el.appendChild(svg('defs', {}, svg('linearGradient', { id: grad, x1: 0, x2: 1, y1: 0, y2: 0 }, ...stops.map(([o, c]) => svg('stop', { offset: String(o), 'stop-color': String(c) })))));
      const x0 = view.px(380), x1 = view.px(750);
      view.marks.appendChild(svg('rect', { x: x0, y: view.py(1.15), width: x1 - x0, height: view.py(0) - view.py(1.15), style: `fill:url(#${grad});opacity:.35` }));
      const pts: string[] = [];
      for (let l = 100; l <= 2000; l += 10) pts.push(`${pts.length ? 'L' : 'M'}${view.px(l).toFixed(1)},${view.py(planck(l, v.T)).toFixed(1)}`);
      view.marks.appendChild(svg('path', { d: pts.join(''), style: 'fill:none;stroke:var(--text);stroke-width:2.5' }));
      const pk = WIEN / v.T;
      if (pk <= 2000) {
        view.marks.appendChild(svg('line', { x1: view.px(pk), y1: view.py(0), x2: view.px(pk), y2: view.py(1.0), style: 'stroke:var(--c2);stroke-width:2;stroke-dasharray:5 4' }));
      }
      view.el.appendChild(svg('text', { x: view.px(565), y: view.py(0.04), 'text-anchor': 'middle', class: 'tick', style: 'font-weight:700;fill:var(--text)' }, 'visible'));
      const disc = h('div', { style: `flex:none;padding:10px;border-radius:12px;background:${SPACE};` }, h('div', { style: `width:40px;height:40px;border-radius:50%;background:${tempColor(v.T)};box-shadow:0 0 14px 3px ${tempColor(v.T)};` }));
      return h('div', null, h('div', { class: 'plot-wrap' }, view.el),
        h('div', { style: 'display:flex;align-items:center;gap:14px;justify-content:center;margin-top:4px;' }, disc,
          h('span', { style: 'font-weight:700;' }, `peak ≈ 2,900,000 ÷ ${v.T.toLocaleString('en-US')} = ${Math.round(WIEN / v.T)} nm`)));
    },
    goal: goal ? (v) => goal(v.T) : undefined,
    goalText,
  });
}

/** Lifetime ≈ 10 billion years × M^-2.5, on log axes. */
export function lifePlot(): PlotSpec {
  const stars: [number, string][] = [[0.2, 'red dwarf'], [1, 'Sun'], [2, ''], [10, '10 Suns'], [30, '']];
  return {
    x: [-1, 1.6], y: [6, 13], size: [380, 260], ticks: [1, 1], xlabel: 'mass (Suns), log', ylabel: 'lifetime (years), log',
    tickFormat: (v) => (Number.isInteger(Math.round(v * 1000) / 1000) ? p10(Math.round(v)) : ''),
    layers: [
      { type: 'fn', f: (x) => 10 - 2.5 * x, color: 'var(--c1)' },
      { type: 'dots', pts: stars.map(([m]) => [Math.log10(m), 10 - 2.5 * Math.log10(m)] as [number, number]), color: 'var(--c2)', r: 5, labels: stars.map((s) => s[1]) },
    ],
  };
}

// ---------------------------------------------------------------- 7 expanding universe

/** Raisins in rising dough, seen from a raisin of your choice. Distances double in the first hour. */
export function raisinBread(): Widget {
  return () => {
    let home = 0;
    const holder = h('div');
    const btns = h('div', { class: 'w-btns', style: 'justify-content:center' });
    const POS = [0, 1, 2, 3, 4]; // cm, at the start
    const build = () => {
      btns.replaceChildren(...POS.map((_, k) => h('button', { class: 'ghost small-btn', style: k === home ? 'border-color:var(--c2);font-weight:800' : '', onclick: () => { home = k; build(); } }, k === home ? `● raisin ${k + 1}` : `raisin ${k + 1}`)));
      holder.replaceChildren(stepper(5, (i) => {
        const t = i * 0.25, s = 1 + t; // hours, scale factor
        const W = 360, H = 150, x0 = 26, u = 31; // px per cm at the start (× 1.2 below): 4 cm × 2.0 still fits
        const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
        const left = x0 - 16, width = 4 * u * s * 1.2 + 32;
        el.appendChild(svg('rect', { x: left, y: 52, width: Math.min(W - left - 4, width), height: 46, rx: 20, style: 'fill:color-mix(in srgb, var(--c5) 40%, var(--panel2));stroke:color-mix(in srgb, var(--c5) 70%, var(--text))' }));
        POS.forEach((p, k) => {
          const x = x0 + p * u * s * 1.2 + 4;
          const me = k === home;
          el.appendChild(svg('circle', { cx: x, cy: 75, r: me ? 8 : 6, style: `fill:${me ? 'var(--c2)' : '#5a3a2a'};stroke:var(--panel);stroke-width:1.5` }));
          if (!me) {
            const d0 = Math.abs(p - POS[home]);
            el.appendChild(svg('text', { x, y: 42, 'text-anchor': 'middle', class: 'tick', style: 'font-weight:700' }, num(d0 * s)));
            el.appendChild(svg('text', { x, y: 118, 'text-anchor': 'middle', class: 'tick', style: 'fill:var(--c1);font-weight:700' }, String(d0)));
          } else {
            el.appendChild(svg('text', { x, y: 42, 'text-anchor': 'middle', class: 'tick', style: 'fill:var(--c2);font-weight:800' }, 'you'));
          }
        });
        el.appendChild(svg('text', { x: W / 2, y: 142, 'text-anchor': 'middle', class: 'tick' }, 'top: distance (cm) · bottom: speed away (cm per hour)'));
        return h('div', { class: 'plot-wrap' }, el);
      }, { caption: (i) => `after ${num(i * 0.25)} h: every distance × ${num(1 + i * 0.25)}`, autoplayMs: 800 }));
    };
    build();
    return h('div', null, h('div', { class: 'muted small', style: 'text-align:center' }, 'Pick which raisin you live on:'), btns, holder);
  };
}

export const H0 = 70; // km/s per megaparsec
/** Illustrative galaxies scattered about v = H0 d. Distances in Mpc, speeds in thousands of km/s. */
export function hubbleData(): [number, number][] {
  const rng = seeded(1929);
  const pts: [number, number][] = [];
  for (let k = 0; k < 22; k++) {
    const d = 20 + rng() * 430;
    pts.push([d, (H0 * d * (1 + (rng() - 0.5) * 0.22)) / 1000]);
  }
  return pts;
}
export function hubblePlot(extra: Layer[] = [], withLine = true): PlotSpec {
  return {
    x: [0, 500], y: [0, 36], size: [380, 260], ticks: [100, 10], xlabel: 'distance (Mpc)', ylabel: 'speed away (1,000 km/s)',
    layers: [
      ...(withLine ? [{ type: 'fn', f: (x: number) => (H0 * x) / 1000, color: 'var(--c2)', dash: true, width: 2 } as Layer] : []),
      { type: 'dots', pts: hubbleData(), color: 'var(--c1)', r: 4 },
      ...extra,
    ],
  };
}

// ---------------------------------------------------------------- 8 are we alone?

/** A planet crossing its star, with the light curve traced so far. */
export function transit(): Widget {
  const ratio = 0.1, depth = ratio * ratio; // a Jupiter around a Sun-like star
  const n = 13;
  const flux = (t: number) => {
    // Planet centre x from -1.4 to 1.4 star radii; approximate partial overlap linearly at the edges.
    const x = -1.4 + 2.8 * t, edge = 1 + ratio, inner = 1 - ratio, ax = Math.abs(x);
    if (ax >= edge) return 1;
    if (ax <= inner) return 1 - depth;
    return 1 - depth * (edge - ax) / (edge - inner);
  };
  return () => stepper(n, (i) => {
    const t = i / (n - 1);
    const W = 360, H = 120, el = space(W, H, { stars: 20, seed: 41 });
    const cx = W / 2, cy = 60, R = 44;
    el.appendChild(svg('circle', { cx, cy, r: R, style: `fill:${SUN}` }));
    el.appendChild(svg('circle', { cx: cx + (-1.4 + 2.8 * t) * R, cy: cy + 8, r: R * ratio, style: `fill:#05070f;stroke:${INK};stroke-width:1` }));
    el.appendChild(label(cx, 112, 'a Jupiter-sized planet, 1/10 of its star’s width', { color: DIM, size: 10, weight: 500 }));
    const plotSpec: PlotSpec = { x: [0, 1], y: [0.985, 1.003], size: [380, 170], ticks: [2, 0.005], ylabel: 'starlight', xlabel: 'time',
      tickFormat: (v) => (v > 0.9 ? `${(v * 100).toFixed(1)}%` : ''),
      layers: [{ type: 'fn', f: flux, from: 0, to: Math.max(t, 1e-4), color: 'var(--c1)', width: 3 }, { type: 'dots', pts: [[t, flux(t)]], color: 'var(--c2)' }] };
    return h('div', null, wrap(el), wrap(plot(plotSpec).el));
  }, { caption: (i) => `dip: ${num(Number(((1 - flux(i / (n - 1))) * 100).toPrecision(2)))}% of the light`, autoplayMs: 380 });
}

export const DRAKE_FIXED = { R: 2, fp: 1, ne: 0.2 };
const ratioText = (e: number) => (e === 0 ? 'all' : `1 in ${(10 ** -e).toLocaleString('en-US')}`);
/** N = R* · fp · ne · fl · fi · fc · L, with the unknown factors on power-of-ten sliders. */
export function drake(goal?: (N: number) => boolean, goalText?: string): Widget {
  const N = (v: Record<string, number>) => DRAKE_FIXED.R * DRAKE_FIXED.fp * DRAKE_FIXED.ne * 10 ** (v.fl + v.fi + v.fc + v.L);
  return explorer({
    params: [
      { id: 'fl', label: 'life starts', min: -6, max: 0, step: 1, value: 0, format: ratioText },
      { id: 'fi', label: 'gets clever', min: -6, max: 0, step: 1, value: -1, format: ratioText },
      { id: 'fc', label: 'transmits', min: -3, max: 0, step: 1, value: -1, format: ratioText },
      { id: 'L', label: 'lasts (yr)', min: 1, max: 8, step: 1, value: 6, format: (v) => words(10 ** v) },
    ],
    draw: (v) => {
      const n = N(v);
      const card = (val: string, lab: string, hi = false) => h('div', { style: `background:var(--panel2);border:${hi ? '2px solid var(--c3)' : '1px solid var(--line)'};border-radius:10px;padding:4px 7px;text-align:center;min-width:52px;` },
        h('div', { style: 'font-weight:800;font-variant-numeric:tabular-nums;' }, val), h('div', { class: 'muted small', style: 'line-height:1.15;max-width:88px;' }, lab));
      const x = () => h('span', { style: 'font-weight:700;color:var(--muted);' }, '×');
      const nTxt = n >= 1 ? words(n) : n >= 0.001 ? num(Number(n.toPrecision(2))) : `1 in ${words(1 / n)}`;
      return h('div', { style: 'display:flex;flex-wrap:wrap;gap:5px;align-items:center;justify-content:center;' },
        card('2', 'stars born a year'), x(), card('1', 'have planets'), x(), card('0.2', 'habitable planets each'), x(),
        card(v.fl === 0 ? '1' : p10(v.fl), 'life starts'), x(), card(v.fi === 0 ? '1' : p10(v.fi), 'intelligence'), x(),
        card(v.fc === 0 ? '1' : p10(v.fc), 'transmits'), x(), card(p10(v.L), 'years it lasts'),
        h('span', { style: 'font-weight:700;color:var(--muted);' }, '='), card(nTxt, 'civilisations now', true));
    },
    readout: (v) => `N ≈ ${N(v) >= 1 ? words(N(v)) : num(Number(N(v).toPrecision(2)))} talking civilisations in the Milky Way`,
    goal: goal ? (v) => goal(N(v)) : undefined,
    goalText,
  });
}

/** Glowing discs at a few temperatures, on a dark panel so pale colours still show in the light theme. */
export function colourStrip(temps: number[]): Widget {
  return () => h('div', { style: `display:flex;flex-wrap:wrap;gap:12px;justify-content:center;background:${SPACE};border-radius:12px;padding:14px 8px;` },
    temps.map((T) => h('div', { style: 'text-align:center;' },
      h('div', { style: `width:40px;height:40px;margin:0 auto 6px;border-radius:50%;background:${tempColor(T)};box-shadow:0 0 14px 3px ${tempColor(T)};` }),
      h('div', { style: `font-size:.85rem;font-weight:700;color:${INK};` }, `${T.toLocaleString('en-US')} K`))));
}
