// Queues & Bottlenecks: queue simulations (pure and seeded, so the course computes its stated numbers
// by running the same code the pictures run), M/M/1 and Erlang C formulas, and the pictures built on
// them: a shop line stepper, a Little's-law picture, queue explorers, a pipeline with piles of work,
// a staffing task, batch Gantt charts, separate vs pooled lines, and a job-ordering task.
import type { PlotSpec, Widget } from '../types';
import { h, num, seeded, svg } from '../ui';
import { barChart } from '../viz/charts';
import { explorer, plotExplorer, stepper } from '../viz/explore';
import { plot } from '../viz/plot';

export const SZ: [number, number] = [360, 220];
const fx = (v: number, d = 1) => num(+v.toFixed(d));

export function plotBox(spec: PlotSpec): HTMLElement {
  const d = h('div', { class: 'plot-wrap' });
  d.appendChild(plot({ size: SZ, ...spec }).el);
  return d;
}
const note = (text = '') => h('div', { style: 'text-align:center;min-height:1.4em;margin:8px 0;color:var(--muted)' }, text);
const btn = (label: string, onclick: () => void) => h('button', { class: 'ghost small-btn', onclick }, label);
const btns = (...b: HTMLElement[]) => h('div', { class: 'w-btns', style: 'justify-content:center' }, b);

// ================================================================ formulas

/** M/M/1 average time in system, in units of the service time: 1 / (1 − ρ). */
export const mm1W = (rho: number) => 1 / (1 - rho);
/** M/M/1 average number waiting (not being served): ρ² / (1 − ρ). */
export const mm1Lq = (rho: number) => (rho * rho) / (1 - rho);
/** Kingman's approximation of the average wait in line: S · ρ/(1−ρ) · (ca² + cs²)/2. */
export const kingman = (S: number, rho: number, ca: number, cs: number) => S * (rho / (1 - rho)) * ((ca * ca + cs * cs) / 2);

/** Erlang C: chance an arrival must wait, with c servers and offered load a = λ·S (needs a < c). */
export function erlangC(c: number, a: number): number {
  let term = 1, sum = 1;
  for (let k = 1; k < c; k++) { term *= a / k; sum += term; }
  const pc = ((term * a) / c) * (c / (c - a));
  return pc / (sum + pc);
}
/** M/M/c average wait in line, in units of the service time. */
export const mmcWq = (c: number, a: number) => erlangC(c, a) / (c - a);

// ================================================================ simulation

export interface SimOpts {
  /** Customers to simulate. */
  n: number;
  /** Arrivals per minute. */
  lam: number;
  /** Mean service time, minutes. */
  S: number;
  /** Servers (default 1). */
  c?: number;
  /** Coefficient of variation of gaps between arrivals and of service times: 0 = clockwork, 1 = fully random (exponential). Default 1. */
  ca?: number;
  cs?: number;
  /** Separate lines: each customer joins one of the c lines at random and never switches. */
  separate?: boolean;
  seed: number;
}
export interface Sim { arr: number[]; start: number[]; end: number[]; wait: number[]; meanWait: number; meanTime: number }

/**
 * First-come-first-served queue. Uses the same random draws whatever the variability or the number
 * of servers (common random numbers), so two settings differ only by the setting.
 */
export function simulate(o: SimOpts): Sim {
  const c = o.c ?? 1, ca = o.ca ?? 1, cs = o.cs ?? 1;
  const ra = seeded(o.seed), rs = seeded(o.seed + 7919), rl = seeded(o.seed + 104729);
  const ex = (r: () => number) => -Math.log(1 - r());
  const arr: number[] = [], start: number[] = [], end: number[] = [], wait: number[] = [];
  const free = new Array(c).fill(0);
  let t = 0;
  for (let i = 0; i < o.n; i++) {
    t += (1 / o.lam) * (1 - ca + ca * ex(ra));
    const s = o.S * (1 - cs + cs * ex(rs));
    let k: number;
    if (o.separate) k = Math.floor(rl() * c);
    else { k = 0; for (let j = 1; j < c; j++) if (free[j] < free[k]) k = j; }
    const st = Math.max(t, free[k]);
    free[k] = st + s;
    arr.push(t); start.push(st); end.push(st + s); wait.push(st - t);
  }
  const meanWait = wait.reduce((a, b) => a + b, 0) / o.n;
  const meanTime = end.reduce((a, e, i) => a + e - arr[i], 0) / o.n;
  return { arr, start, end, wait, meanWait, meanTime };
}

/** Number waiting in line (not being served) at time t. */
export function waitingAt(s: Sim, t: number): number {
  let q = 0;
  for (let i = 0; i < s.arr.length && s.arr[i] <= t; i++) if (s.start[i] > t) q++;
  return q;
}
/** Number in the system (waiting or being served) at time t. */
export function inSystemAt(s: Sim, t: number): number {
  let q = 0;
  for (let i = 0; i < s.arr.length && s.arr[i] <= t; i++) if (s.end[i] > t) q++;
  return q;
}
/** [time, waiting] samples every dt minutes up to T. */
export const lineSeries = (s: Sim, T: number, dt = 2): [number, number][] =>
  Array.from({ length: Math.floor(T / dt) + 1 }, (_, k) => [k * dt, waitingAt(s, k * dt)]);

// ---------------------------------------------------------------- shop line stepper

/** A shop counter minute by minute: people waiting in line, the one being served, and the count served. */
export function shopStepper(o: { perHour: number; serviceMin: number; minutes: number; seed: number; c?: number; label?: string }): Widget {
  const sim = simulate({ n: Math.ceil((o.perHour / 60) * o.minutes * 2) + 20, lam: o.perHour / 60, S: o.serviceMin, c: o.c ?? 1, seed: o.seed });
  return () => stepper(o.minutes + 1, (t) => {
    const W = 360, H = 120, cx = 300;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
    const q = waitingAt(sim, t), busy = inSystemAt(sim, t) - q;
    const c = o.c ?? 1;
    for (let k = 0; k < c; k++) {
      const y = 20 + (k * 80) / Math.max(1, c);
      s.appendChild(svg('rect', { x: cx, y, width: 46, height: 34, rx: 6, style: 'fill:var(--panel);stroke:var(--c3);stroke-width:2' }));
      if (k < busy) s.appendChild(svg('circle', { cx: cx - 14, cy: y + 17, r: 9, style: 'fill:var(--c3)' }));
    }
    s.appendChild(svg('text', { x: cx + 23, y: 112, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:12px' }, o.label ?? 'counter'));
    const shown = Math.min(q, 12);
    for (let k = 0; k < shown; k++) s.appendChild(svg('circle', { cx: cx - 40 - k * 21, cy: 55, r: 9, style: 'fill:var(--c2)' }));
    if (q > shown) s.appendChild(svg('text', { x: 20, y: 85, style: 'fill:var(--text);font-size:13px' }, `+${q - shown} more`));
    const served = sim.end.filter((e) => e <= t).length;
    const d = h('div', { class: 'plot-wrap' }); d.appendChild(s);
    return h('div', null, d, h('div', { class: 'readout' }, `minute ${t}: ${q} waiting · ${served} served`));
  }, { autoplayMs: 250 });
}

// ---------------------------------------------------------------- queue explorer

/** Sliders for arrivals and service rate; plots the line over a shift from a seeded simulation. */
export function queueExplorer(o: { lam: number; mu: number; hours?: number; seed: number }): Widget {
  const T = (o.hours ?? 8) * 60;
  return plotExplorer({
    params: [
      { id: 'lam', label: 'arrivals', min: 10, max: 40, step: 1, value: o.lam, format: (v) => `${v}/h` },
      { id: 'mu', label: 'can serve', min: 10, max: 40, step: 1, value: o.mu, format: (v) => `${v}/h` },
    ],
    spec: (v) => {
      const s = simulate({ n: Math.ceil((v.lam / 60) * T) + 5, lam: v.lam / 60, S: 60 / v.mu, seed: o.seed });
      const pts = lineSeries(s, T, 3).map(([t, q]) => [t / 60, q] as [number, number]);
      const top = Math.max(20, ...pts.map((p) => p[1]));
      return { x: [0, T / 60], y: [0, Math.ceil(top / 10) * 10], size: SZ, xlabel: 'hours', ylabel: 'waiting', layers: [{ type: 'line', pts, color: 'var(--c2)' }] };
    },
    readout: (v) => {
      const rho = v.lam / v.mu;
      return `ρ = ${v.lam}/${v.mu} = ${fx(rho, 2)}${rho >= 1 ? ': more arrive than can be served' : ''}`;
    },
  });
}

/** Utilization slider on the 1/(1−ρ) curve, with the seeded simulation's average next to it. */
export function curveExplorer(o: { S: number; seed: number }): Widget {
  return plotExplorer({
    params: [{ id: 'r', label: 'utilization', min: 10, max: 95, step: 5, value: 50, format: (v) => `${v}%` }],
    spec: (v) => {
      const r = v.r / 100;
      return { x: [0, 1], y: [0, 20], size: SZ, xlabel: 'utilization ρ', ylabel: 'time ÷ service time', layers: [
        { type: 'fn', f: (x) => mm1W(x), to: 0.951, color: 'var(--c1)' },
        { type: 'dots', pts: [[r, mm1W(r)]], color: 'var(--c2)', r: 6 },
      ] };
    },
    readout: (v) => {
      const r = v.r / 100;
      const s = simulate({ n: 20000, lam: r / o.S, S: o.S, seed: o.seed });
      return `formula: ${fx(o.S * mm1W(r))} min in the system · simulated 20,000 customers: ${fx(s.meanTime)} min`;
    },
  });
}

/** Variability sliders (arrivals and service) at fixed utilization: the line over a day, simulated vs Kingman. */
export function variabilityExplorer(o: { rho: number; S: number; seed: number }): Widget {
  const lam = o.rho / o.S, T = 480;
  const fmt = (v: number) => (v === 0 ? 'clockwork' : v === 1 ? 'random' : String(v));
  return plotExplorer({
    params: [
      { id: 'ca', label: 'arrival spread', min: 0, max: 1, step: 0.25, value: 1, format: fmt },
      { id: 'cs', label: 'service spread', min: 0, max: 1, step: 0.25, value: 1, format: fmt },
    ],
    spec: (v) => {
      const s = simulate({ n: 200, lam, S: o.S, ca: v.ca, cs: v.cs, seed: o.seed });
      return { x: [0, T / 60], y: [0, 20], size: SZ, xlabel: 'hours', ylabel: 'waiting', layers: [{ type: 'line', pts: lineSeries(s, T, 2).map(([t, q]) => [t / 60, q]), color: 'var(--c2)' }] };
    },
    readout: (v) => {
      const s = simulate({ n: 20000, lam, S: o.S, ca: v.ca, cs: v.cs, seed: o.seed });
      return `average wait: simulated ${fx(s.meanWait)} min · Kingman ${fx(kingman(o.S, o.rho, v.ca, v.cs))} min`;
    },
  });
}

// ---------------------------------------------------------------- Little's law picture

/** Each customer's stay as a bar (top) and the count in the shop (bottom): the two areas are equal. */
export function littlePic(o: { perHour: number; stayMin: number; n: number; seed: number }): Widget {
  const s = simulate({ n: o.n, lam: o.perHour / 60, S: o.stayMin, c: 100, seed: o.seed });
  const T = Math.ceil(Math.max(...s.end) / 10) * 10;
  const area = s.end.reduce((a, e, i) => a + e - s.arr[i], 0);
  const steps: [number, number][] = [];
  const evs = [...s.arr.map((t) => [t, 1]), ...s.end.map((t) => [t, -1])].sort((a, b) => a[0] - b[0]);
  let k = 0;
  steps.push([0, 0]);
  for (const [t, d] of evs) { steps.push([t, k]); k += d; steps.push([t, k]); }
  steps.push([T, 0]);
  const maxN = Math.max(...steps.map((p) => p[1]));
  return () => h('div', null,
    plotBox({ x: [0, T], y: [0, o.n + 1], size: [360, 170], ylabel: 'customer', ticks: [10, 5], layers: s.arr.map((a, i) => ({ type: 'line' as const, pts: [[a, i + 1], [s.end[i], i + 1]] as [number, number][], color: 'var(--c1)', width: 5 })) }),
    plotBox({ x: [0, T], y: [0, maxN + 1], size: [360, 150], xlabel: 'minutes', ylabel: 'in shop', ticks: [10, 2], layers: [{ type: 'line', pts: steps, color: 'var(--c2)', fill: 'var(--c2)' }] }),
    h('div', { class: 'readout' }, `total length of the bars = area under the count = ${fx(area, 0)} customer-minutes`));
}

// ---------------------------------------------------------------- pipelines

export interface Station { name: string; cap: number }

/** Run a pipeline hour by hour: `arrive` jobs per hour, each station does up to cap of what's waiting for it. Returns piles in front of each station, per hour, and the total finished. */
export function runPipeline(st: Station[], arrive: number, hours: number): { piles: number[][]; done: number[] } {
  const pile = st.map(() => 0), piles = [pile.slice()], done = [0];
  for (let t = 0; t < hours; t++) {
    pile[0] += arrive;
    let fin = done[done.length - 1];
    for (let i = 0; i < st.length; i++) {
      const m = Math.min(pile[i], st[i].cap);
      pile[i] -= m;
      if (i + 1 < st.length) pile[i + 1] += m; else fin += m;
    }
    piles.push(pile.slice()); done.push(fin);
  }
  return { piles, done };
}

function pipeSvg(st: Station[], pile?: number[], extra = ''): HTMLElement {
  const n = st.length, W = 360, bw = 66, gap = (W - n * bw) / (n + 1), H = 150;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
  const minCap = Math.min(...st.map((x) => x.cap));
  st.forEach((x, i) => {
    const X = gap + i * (bw + gap), bott = x.cap === minCap;
    if (pile) {
      const p = pile[i], shown = Math.min(p, 40);
      for (let k = 0; k < shown; k++) s.appendChild(svg('rect', { x: X + (k % 8) * 8, y: 54 - Math.floor(k / 8) * 8, width: 6, height: 6, style: 'fill:var(--c2)' }));
      s.appendChild(svg('text', { x: X + bw / 2, y: 12, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:12px' }, `${p} waiting`));
    }
    s.appendChild(svg('rect', { x: X, y: 66, width: bw, height: 44, rx: 6, style: `fill:var(--panel);stroke:${bott ? 'var(--bad)' : 'var(--c3)'};stroke-width:${bott ? 3 : 2}` }));
    s.appendChild(svg('text', { x: X + bw / 2, y: 85, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:12px' }, x.name));
    s.appendChild(svg('text', { x: X + bw / 2, y: 102, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:12px;font-weight:600' }, `${x.cap}/h`));
    if (i + 1 < n) s.appendChild(svg('text', { x: X + bw + gap / 2, y: 92, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:16px' }, '→'));
  });
  s.appendChild(svg('text', { x: W / 2, y: 136, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:12px' }, extra || `throughput = slowest station = ${minCap}/h`));
  const d = h('div', { class: 'plot-wrap' }); d.appendChild(s);
  return d;
}

/** Static pipeline picture with the bottleneck outlined. */
export const pipeline = (st: Station[]): Widget => () => pipeSvg(st);

/** Hour-by-hour stepper: work piles up in front of the bottleneck. */
export function pipelineStepper(st: Station[], arrive: number, hours: number): Widget {
  const r = runPipeline(st, arrive, hours);
  return () => stepper(hours + 1, (t) => pipeSvg(st, r.piles[t], `hour ${t}: ${arrive}/h arrive · ${r.done[t]} finished so far`), { autoplayMs: 600 });
}

/** Task: add up to `budget` workers (each station gets `per` jobs/h per worker); reach `target` jobs/h. */
export function staffTask(o: { st: { name: string; per: number; workers: number }[]; budget: number; target: number }): Widget {
  return (ctx) => {
    const add = o.st.map(() => 0);
    const box = h('div'), msg = note();
    const draw = () => {
      const st = o.st.map((x, i) => ({ name: x.name, cap: x.per * (x.workers + add[i]) }));
      const used = add.reduce((a, b) => a + b, 0), thr = Math.min(...st.map((x) => x.cap));
      box.replaceChildren(pipeSvg(st), h('div', { class: 'w-btns', style: 'justify-content:center' }, o.st.map((x, i) =>
        h('span', { style: 'display:inline-flex;align-items:center;gap:4px' },
          btn('−', () => { if (add[i] > 0) { add[i]--; draw(); } }),
          h('span', { class: 'small' }, `${x.name}: ${x.workers + add[i]}`),
          btn('+', () => { if (used < o.budget) { add[i]++; draw(); } else { msg.textContent = `All ${o.budget} new workers are placed. Take one back first.`; } })))));
      const ok = thr >= o.target && used <= o.budget;
      msg.textContent = ok ? `✓ ${thr} jobs an hour with ${used} new worker${used === 1 ? '' : 's'}.` : `Throughput ${thr}/h (target ${o.target}/h) · ${used} of ${o.budget} new workers placed`;
      ctx.solved?.(ok);
    };
    draw();
    return h('div', null, box, msg);
  };
}

// ---------------------------------------------------------------- batches

/**
 * N items through `stations` stations, t minutes per item at each, moved on in batches of B (the last
 * may be smaller): a station starts a batch once the whole batch has arrived. Returns, per station,
 * each item's start minute, and each item's finish minute at the last station.
 */
export function batchRun(stations: number, N: number, B: number, t = 1): { start: number[][]; finish: number[] } {
  const start = Array.from({ length: stations }, () => new Array(N).fill(0));
  const batchDone = Array.from({ length: stations }, () => [] as number[]);
  const finish = new Array(N).fill(0);
  const nb = Math.ceil(N / B);
  for (let b = 0; b < nb; b++) {
    const lo = b * B, hi = Math.min(N, lo + B);
    for (let s = 0; s < stations; s++) {
      const ready = s === 0 ? 0 : batchDone[s - 1][b];
      const freeAt = b === 0 ? 0 : batchDone[s][b - 1];
      let tt = Math.max(ready, freeAt);
      for (let i = lo; i < hi; i++) { start[s][i] = tt; tt += t; if (s === stations - 1) finish[i] = tt; }
      batchDone[s][b] = tt;
    }
  }
  return { start, finish };
}

/** Gantt chart of a batch run: rows are stations, columns minutes, cells show which item is being worked on (colour = batch). */
export function batchGrid(names: string[], N: number, B: number): HTMLElement {
  const r = batchRun(names.length, N, B);
  const T = Math.max(...r.finish);
  const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
  const W = 360, lw = 46, rh = 24, cw = (W - lw - 14) / T, H = names.length * (rh + 4) + 22;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
  names.forEach((n, k) => {
    const y = k * (rh + 4);
    s.appendChild(svg('text', { x: lw - 6, y: y + rh / 2 + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:12px' }, n));
    s.appendChild(svg('rect', { x: lw, y, width: W - lw - 14, height: rh, style: 'fill:var(--line);opacity:.35' }));
    r.start[k].forEach((m, i) => {
      s.appendChild(svg('rect', { x: lw + m * cw + 0.5, y, width: Math.max(1, cw - 1), height: rh, rx: 2, style: `fill:${colors[Math.floor(i / B) % colors.length]}` }));
      if (cw >= 11) s.appendChild(svg('text', { x: lw + (m + 0.5) * cw, y: y + rh / 2 + 4, 'text-anchor': 'middle', style: 'fill:#fff;font-size:10px' }, String(i + 1)));
    });
  });
  const step = T > 40 ? 10 : 5;
  for (let m = 0; m <= T; m += step) s.appendChild(svg('text', { x: lw + m * cw, y: H - 6, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:10px' }, String(m)));
  s.appendChild(svg('text', { x: lw - 6, y: H - 6, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:10px' }, 'minute'));
  const d = h('div', { class: 'plot-wrap' }); d.appendChild(s);
  return h('div', null, d, h('div', { class: 'readout' }, `first item done at minute ${Math.min(...r.finish)} · all ${N} done at minute ${T}`));
}

/** Slider over batch size. */
export function batchExplorer(names: string[], N: number, B0: number): Widget {
  return explorer({ params: [{ id: 'B', label: 'batch size', min: 1, max: N, step: 1, value: B0 }], draw: (v) => batchGrid(names, N, v.B) });
}

/** Throughput and lead time against work in progress (a pipeline with raw process time T0 and bottleneck rate rb). */
export function wipExplorer(o: { T0: number; rb: number; wip: number }): Widget {
  const W0 = o.T0 * o.rb, max = Math.ceil(W0 * 3);
  return plotExplorer({
    params: [{ id: 'w', label: 'jobs in progress', min: 1, max, step: 1, value: o.wip }],
    spec: (v) => ({ x: [0, max], y: [0, (max / o.rb) * 1.05], size: SZ, xlabel: 'jobs in progress', ylabel: 'lead time (h)', layers: [
      { type: 'fn', f: (w) => Math.max(o.T0, w / o.rb), color: 'var(--c2)' },
      { type: 'vline', x: W0, color: 'var(--muted)', dash: true, label: 'enough to keep the bottleneck busy' },
      { type: 'dots', pts: [[v.w, Math.max(o.T0, v.w / o.rb)]], color: 'var(--c2)', r: 6 },
    ] }),
    readout: (v) => `throughput ${fx(Math.min(v.w / o.T0, o.rb), 2)} jobs/h · lead time ${fx(Math.max(o.T0, v.w / o.rb), 2)} h`,
  });
}

// ---------------------------------------------------------------- pooling

/** Separate lines vs one shared line, same customers and same service times. */
export function poolExplorer(o: { S: number; seed: number }): Widget {
  return explorer({
    params: [
      { id: 'c', label: 'servers', min: 2, max: 8, step: 1, value: 2 },
      { id: 'r', label: 'utilization', min: 50, max: 95, step: 5, value: 80, format: (v) => `${v}%` },
    ],
    draw: (v) => {
      const lam = (v.r / 100) * v.c / o.S;
      const sep = simulate({ n: 20000, lam, S: o.S, c: v.c, separate: true, seed: o.seed });
      const one = simulate({ n: 20000, lam, S: o.S, c: v.c, seed: o.seed });
      return barChart([
        { label: `${v.c} separate lines`, value: sep.meanWait, color: 'var(--c2)' },
        { label: 'one shared line', value: one.meanWait, color: 'var(--c3)' },
      ], { format: (x) => `${fx(x)} min`, title: `average wait in line (service ${o.S} min, 20,000 customers)` });
    },
  });
}

// ---------------------------------------------------------------- job ordering

export interface Job { name: string; dur: number }
/** Finish times when jobs are done in this order, starting at 0. */
export const finishTimes = (jobs: Job[]) => { let t = 0; return jobs.map((j) => (t += j.dur)); };
export const meanFinish = (jobs: Job[]) => finishTimes(jobs).reduce((a, b) => a + b, 0) / jobs.length;

/** Task: tap jobs in the order to do them; solved when the average finish time is as low as possible. */
export function orderTask(jobs: Job[], unit = 'min'): Widget {
  const best = meanFinish([...jobs].sort((a, b) => a.dur - b.dur));
  const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
  return (ctx) => {
    const order: number[] = [];
    const box = h('div'), msg = note();
    const total = jobs.reduce((a, j) => a + j.dur, 0);
    const draw = () => {
      const W = 360, s = svg('svg', { viewBox: `0 0 ${W} 60`, class: 'plot', style: `max-width:${W}px` });
      let t = 0;
      for (const i of order) {
        const x = (t / total) * (W - 10) + 5, w = (jobs[i].dur / total) * (W - 10);
        s.appendChild(svg('rect', { x, y: 8, width: Math.max(1, w - 1), height: 26, rx: 3, style: `fill:${colors[i % colors.length]}` }));
        if (w > 18) s.appendChild(svg('text', { x: x + w / 2, y: 26, 'text-anchor': 'middle', style: 'fill:#fff;font-size:12px' }, jobs[i].name));
        t += jobs[i].dur;
        s.appendChild(svg('text', { x: x + w, y: 50, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px' }, String(t)));
      }
      const d = h('div', { class: 'plot-wrap' }); d.appendChild(s);
      box.replaceChildren(d, btns(...jobs.map((j, i) => {
        const b = btn(`${j.name} (${j.dur} ${unit})`, () => { order.push(i); draw(); });
        b.disabled = order.includes(i);
        return b;
      })));
      if (order.length < jobs.length) { msg.textContent = 'Tap the jobs in the order you would do them.'; ctx.solved?.(false); return; }
      const m = meanFinish(order.map((i) => jobs[i]));
      const ok = Math.abs(m - best) < 1e-9;
      msg.textContent = ok ? `✓ Average finish time ${fx(m, 2)} ${unit}: as low as it goes.` : `Average finish time ${fx(m, 2)} ${unit}. You can do better.`;
      ctx.solved?.(ok);
    };
    draw();
    return h('div', null, box, msg, btns(btn('Start over', () => { order.length = 0; draw(); })));
  };
}
