// Data & Statistics widgets and data helpers: summary statistics, seeded data sets, dot plots,
// histograms, small multiples, a poll sampler and a few chart-distortion pictures.
import type { Layer, PlotSpec, Rng, Widget } from '../types';
import { h, seeded, svg } from '../ui';
import { niceStep, plot, plotEl } from '../viz/plot';

// ---------------------------------------------------------------- numbers

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => sum(xs) / xs.length;
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
/** Population standard deviation (divide by n). */
export function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
/** Quartiles by the median-of-halves method (the middle value is left out of both halves when n is odd). */
export function quartiles(xs: number[]): [number, number] {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length, half = Math.floor(n / 2);
  return [median(s.slice(0, half)), median(s.slice(n - half))];
}
export function corr(pts: [number, number][]): number {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}

/** Standard normal draws (Box-Muller). */
export function normals(rng: Rng, n: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const u = Math.max(1e-12, rng()), v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    out.push(r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v));
  }
  return out.slice(0, n);
}

const standardize = (xs: number[]) => { const m = mean(xs), s = sd(xs) || 1; return xs.map((x) => (x - m) / s); };

/**
 * n points (standardized: mean 0, SD 1 on both axes) whose sample correlation is exactly r:
 * the noise is made uncorrelated with x before mixing.
 */
export function corrPairs(seed: number, n: number, r: number): [number, number][] {
  const rng = seeded(seed);
  const x = standardize(normals(rng, n));
  let e = normals(rng, n);
  const me = mean(e);
  const b = sum(x.map((xi, i) => xi * (e[i] - me))) / n; // x has mean 0, variance 1
  e = standardize(e.map((ei, i) => ei - me - b * x[i]));
  const k = Math.sqrt(Math.max(0, 1 - r * r));
  return x.map((xi, i) => [xi, r * xi + k * e[i]]);
}

/** Histogram counts as bar centres: bins [start + k·width, start + (k+1)·width). */
export function bins(xs: number[], start: number, width: number, k: number): [number, number][] {
  const c = new Array(k).fill(0);
  for (const x of xs) {
    const i = Math.floor((x - start) / width);
    if (i >= 0 && i < k) c[i]++;
    else if (i === k && x === start + k * width) c[k - 1]++;
  }
  return c.map((n, i) => [start + (i + 0.5) * width, n] as [number, number]);
}

/** Stack equal values (after rounding to `step`) into columns: a dot plot. y = 1, 2, 3… */
export function stackDots(xs: number[], step = 1): [number, number][] {
  const seen = new Map<number, number>();
  return xs.map((x) => {
    const k = Math.round(x / step) * step;
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    return [k, c] as [number, number];
  });
}

/** A dot plot spec: stacked dots over a number line, no y ticks. */
export function dotPlot(xs: number[], o: { x: [number, number]; step?: number; xlabel?: string; size?: [number, number]; color?: string; tick?: number; layers?: Layer[]; minH?: number; r?: number }): PlotSpec {
  const pts = stackDots(xs, o.step ?? 1);
  const top = Math.max(o.minH ?? 3, ...pts.map((p) => p[1])) + 0.8;
  return {
    x: o.x, y: [0.3, top], xlabel: o.xlabel, grid: false, size: o.size ?? [480, 200],
    ticks: [o.tick ?? niceStep(o.x[1] - o.x[0], 7), 1e6],
    layers: [{ type: 'dots', pts, color: o.color ?? 'var(--c1)', r: o.r ?? 6 }, ...(o.layers ?? [])],
  };
}

/** Labelled grid of small plots (2 per row). */
export function thumbs(items: { label: string; spec: PlotSpec }[]): HTMLElement {
  return h('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px' },
    items.map((it) => h('div', { style: 'border:1px solid var(--line);border-radius:10px;padding:4px 6px 0;background:var(--panel)' },
      h('div', { style: 'font-weight:700;text-align:center;font-size:.95rem' }, it.label),
      plotEl(it.spec))));
}

/** Spec of a bare histogram thumbnail (no tick labels). */
export function thumbHist(xs: number[], start: number, width: number, k: number, color = 'var(--c1)'): PlotSpec {
  const b = bins(xs, start, width, k);
  const top = Math.max(...b.map((p) => p[1]));
  return { x: [start, start + width * k], y: [0, top * 1.1], grid: false, size: [260, 150], tickFormat: () => '', layers: [{ type: 'bars', pts: b, width, color }] };
}

/** Spec of a bare scatter thumbnail. */
export function thumbScatter(pts: [number, number][], color = 'var(--c1)'): PlotSpec {
  return { x: [-3.2, 3.2], y: [-3.2, 3.2], grid: false, size: [260, 200], tickFormat: () => '', layers: [{ type: 'dots', pts, color, r: 4 }] };
}

export function caption(text: string): HTMLElement {
  return h('div', { class: 'muted small', style: 'text-align:center;margin-top:2px' }, text);
}

/** A widget showing a picture with a caption under it. */
export const figure = (node: () => Node, cap?: string): Widget => () => h('div', null, node(), cap ? caption(cap) : null);

// ---------------------------------------------------------------- polls

/** Draw a binomial count: exact for small n, normal approximation for large n. */
export function binomial(rng: Rng, n: number, p: number): number {
  if (n <= 300) { let k = 0; for (let i = 0; i < n; i++) if (rng() < p) k++; return k; }
  const z = normals(rng, 1)[0];
  return Math.max(0, Math.min(n, Math.round(n * p + z * Math.sqrt(n * p * (1 - p)))));
}

/** 30 polls of size n from a population with support p (percent results), as a dot-plot spec. */
export function pollCloud(o: { n: number; p: number; truth?: number; band?: boolean; seed: number; polls?: number }): PlotSpec {
  const rng = seeded(o.seed + o.n * 7);
  const res = Array.from({ length: o.polls ?? 30 }, () => (100 * binomial(rng, o.n, o.p)) / o.n);
  const m = 100 / Math.sqrt(o.n);
  const pts = stackDots(res, 1);
  const top = Math.max(6, ...pts.map((p) => p[1])) + 0.8;
  const layers: Layer[] = [];
  if (o.band) layers.push({ type: 'area', f: () => top, from: o.p * 100 - m, to: o.p * 100 + m, color: 'var(--c3)' });
  layers.push({ type: 'dots', pts, color: 'var(--c1)', r: 5 });
  if (o.truth !== undefined) layers.push({ type: 'vline', x: o.truth, color: 'var(--c2)', label: `truth ${o.truth}%` });
  return { x: [10, 90], y: [0.3, top], xlabel: 'poll result (% yes)', grid: false, ticks: [10, 1e6], size: [480, 220], layers };
}

/**
 * Run polls of size n from a population with true share p and watch where the results land.
 * Buttons pick n and run 1 or 20 polls; the dot plot fills up.
 */
export function sampler(o: { p: number; sizes: number[]; seed?: number }): Widget {
  return () => {
    const rng = seeded(o.seed ?? 99);
    let n = o.sizes[0];
    let res: number[] = [];
    const pic = h('div', { class: 'plot-wrap' });
    const read = h('div', { class: 'readout' });
    const sizeBtns = o.sizes.map((s) => h('button', { class: 'ghost small-btn', onclick: () => { n = s; res = []; run(20); } }, `n = ${s}`));
    const run = (k: number) => {
      for (let i = 0; i < k && res.length < 200; i++) res.push((100 * binomial(rng, n, o.p)) / n);
      draw();
    };
    const draw = () => {
      sizeBtns.forEach((b, i) => { b.style.outline = o.sizes[i] === n ? '2px solid var(--c1)' : ''; });
      const pts = stackDots(res, 1);
      const top = Math.max(8, ...pts.map((p) => p[1])) + 0.8;
      pic.replaceChildren(plot({ x: [0, 100], y: [0.3, top], xlabel: 'poll result (% yes)', grid: false, ticks: [10, 1e6], size: [480, 220],
        layers: [{ type: 'dots', pts, color: 'var(--c1)', r: top > 20 ? 3.5 : 5 }, { type: 'vline', x: o.p * 100, color: 'var(--c2)', label: `truth ${o.p * 100}%` }] }).el);
      const s = res.length > 1 ? sd(res) : 0;
      read.textContent = res.length
        ? `n = ${n} · ${res.length} polls · lowest ${Math.round(Math.min(...res))}%, highest ${Math.round(Math.max(...res))}% · spread (SD) ${s.toFixed(1)} pts`
        : `n = ${n}`;
    };
    run(20);
    return h('div', null, pic, read,
      h('div', { class: 'stepper-ctl' }, sizeBtns,
        h('button', { class: 'ghost small-btn', onclick: () => run(1) }, '+1 poll'),
        h('button', { class: 'ghost small-btn', onclick: () => run(20) }, '+20 polls')));
  };
}

// ---------------------------------------------------------------- pictures for misleading graphs

/** Two squares: the value doubles but so do both sides, so the area is 4x. */
export function areaTrick(): HTMLElement {
  const s = svg('svg', { viewBox: '0 0 320 170', class: 'plot', style: 'max-width:420px' });
  s.append(
    svg('rect', { x: 40, y: 100, width: 50, height: 50, rx: 4, style: 'fill:var(--c1)' }),
    svg('rect', { x: 170, y: 50, width: 100, height: 100, rx: 6, style: 'fill:var(--c2)' }),
    svg('text', { x: 65, y: 166, class: 'tick', 'text-anchor': 'middle' }, 'last year: 100'),
    svg('text', { x: 220, y: 166, class: 'tick', 'text-anchor': 'middle' }, 'this year: 200'),
    svg('text', { x: 65, y: 92, class: 'plot-label', 'text-anchor': 'middle', style: 'fill:var(--c1)' }, 'side 1'),
    svg('text', { x: 220, y: 42, class: 'plot-label', 'text-anchor': 'middle', style: 'fill:var(--c2)' }, 'side 2 → area 4×'),
  );
  return h('div', { class: 'plot-wrap' }, s);
}
