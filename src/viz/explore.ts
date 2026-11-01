// Explorers: sliders that redraw a picture live. The core Brilliant move: change a parameter, watch
// what happens. With a goal, an explorer becomes a task ("make the line pass through both points").
import type { PlotSpec, Widget } from '../types';
import { h } from '../ui';
import { plot } from './plot';

export interface Param {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (v: number) => string;
}
export type Values = Record<string, number>;

export interface ExplorerOpts {
  params: Param[];
  /** Draw the picture for the current values. */
  draw: (v: Values) => Node;
  /** Text under the picture (light HTML not allowed; plain text). */
  readout?: (v: Values) => string;
  /** If given, the widget reports solved(goal(v)) on every change (use as a TaskStep widget). */
  goal?: (v: Values) => boolean;
  /** Message shown when the goal is met. */
  goalText?: string;
}

/** Sliders + live picture + readout. */
export function explorer(o: ExplorerOpts): Widget {
  return (ctx) => {
    const vals: Values = Object.fromEntries(o.params.map((p) => [p.id, p.value]));
    const pic = h('div', { class: 'explore-pic' });
    const read = h('div', { class: 'readout' });
    const done = h('div', { class: 'goal-ok', hidden: true }, '✓ ', o.goalText ?? 'That’s it.');
    const redraw = () => {
      pic.replaceChildren(o.draw(vals));
      if (o.readout) read.textContent = o.readout(vals);
      if (o.goal) {
        const ok = o.goal(vals);
        done.hidden = !ok;
        ctx.solved?.(ok);
      }
    };
    const rows = o.params.map((p) => {
      const out = h('span', { class: 'slider-val' }, (p.format ?? String)(p.value));
      const sl = h('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: p.value, 'aria-label': p.label, 'data-param': p.id });
      sl.addEventListener('input', () => { vals[p.id] = Number(sl.value); out.textContent = (p.format ?? String)(vals[p.id]); redraw(); });
      return h('label', { class: 'slider-row' }, h('span', { class: 'slider-name' }, p.label), sl, out);
    });
    redraw();
    return h('div', { class: 'explorer' }, pic, o.readout ? read : null, h('div', { class: 'sliders' }, rows), done);
  };
}

/** Explorer whose picture is a plot built from the slider values. */
export function plotExplorer(o: Omit<ExplorerOpts, 'draw'> & { spec: (v: Values) => PlotSpec }): Widget {
  return explorer({ ...o, draw: (v) => { const d = h('div', { class: 'plot-wrap' }); d.appendChild(plot(o.spec(v)).el); return d; } });
}

/** Buttons that step through frames (an algorithm, a proof, a process). render(i) draws frame i. */
export function stepper(n: number, render: (i: number) => Node, opts: { caption?: (i: number) => string; autoplayMs?: number } = {}): HTMLElement {
  let i = 0;
  let timer = 0;
  const pic = h('div', { class: 'stepper-pic' });
  const cap = h('div', { class: 'stepper-cap' });
  const count = h('span', { class: 'muted small' });
  const prev = h('button', { class: 'ghost small-btn', onclick: () => go(i - 1) }, '‹ Back');
  const nextB = h('button', { class: 'ghost small-btn', onclick: () => go(i + 1) }, 'Next ›');
  const playB = h('button', { class: 'ghost small-btn', onclick: () => toggle() }, '▶ Play');
  const go = (k: number) => {
    i = Math.max(0, Math.min(n - 1, k));
    pic.replaceChildren(render(i));
    cap.textContent = opts.caption?.(i) ?? '';
    count.textContent = `${i + 1} / ${n}`;
    prev.disabled = i === 0;
    nextB.disabled = i === n - 1;
    if (i === n - 1) stop();
  };
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; playB.textContent = '▶ Play'; } };
  const toggle = () => {
    if (timer) return stop();
    if (i === n - 1) go(0);
    playB.textContent = '❚❚ Pause';
    timer = window.setInterval(() => { if (!pic.isConnected) return stop(); go(i + 1); }, opts.autoplayMs ?? 700);
  };
  go(0);
  return h('div', { class: 'stepper' }, pic, cap, h('div', { class: 'stepper-ctl' }, prev, playB, nextB, count));
}
