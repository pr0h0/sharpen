// Pictures and small maths for the "How AI Works" course: fruit scatter plots, confusion matrices,
// neuron and network diagrams, pixel images, token chips, polynomial fits and bigram counts.
// Everything here is computed, so lesson text and answers can be derived from the same numbers.
import type { Layer, PlotSpec, Widget } from '../types';
import { h, svg, num } from '../ui';
import { explorer } from '../viz/explore';
import { dataTable } from '../viz/charts';

export const LIME = 'var(--c3)';
export const LEMON = 'var(--c5)';
export const SPAM = 'var(--c4)';
export const HAM = 'var(--c1)';

export type Pt = [number, number];

// ---------------------------------------------------------------- small maths

/** The step activation: fires (1) when the weighted sum is above 0. */
export const stepFn = (z: number) => (z > 0 ? 1 : 0);
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
export const relu = (z: number) => Math.max(0, z);

/** One neuron with a step activation. */
export const neuron = (w1: number, w2: number, b: number) => (x1: number, x2: number) => stepFn(w1 * x1 + w2 * x2 + b);

export const INPUTS: Pt[] = [[0, 0], [0, 1], [1, 0], [1, 1]];

export const GATES: Record<string, (a: number, b: number) => number> = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  NAND: (a, b) => 1 - (a & b),
  NOR: (a, b) => 1 - (a | b),
  XOR: (a, b) => a ^ b,
};

/** Truth table of a two-input function as a 4-character string (inputs 00, 01, 10, 11). */
export const table = (f: (a: number, b: number) => number) => INPUTS.map(([a, b]) => f(a, b)).join('');

/** Name of the gate a function computes, if it is one of the familiar ones. */
export function gateName(f: (a: number, b: number) => number): string | undefined {
  const t = table(f);
  const known: Record<string, string> = {
    '0001': 'AND', '0111': 'OR', '1110': 'NAND', '1000': 'NOR', '0110': 'XOR', '1001': 'XNOR',
    '0000': 'always 0', '1111': 'always 1', '0011': 'just copy x₁', '0101': 'just copy x₂',
    '1100': 'NOT x₁', '1010': 'NOT x₂', '0010': 'x₁ AND NOT x₂', '0100': 'x₂ AND NOT x₁',
  };
  return known[t];
}

/** Least-squares polynomial fit of degree d (x rescaled around `mid` by `half` for stability). */
export function polyfit(xs: number[], ys: number[], d: number, mid = 5, half = 5): (x: number) => number {
  const t = (x: number) => (x - mid) / half;
  const n = d + 1;
  const M: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(xs.reduce((s, x) => s + t(x) ** (i + j), 0));
    row.push(xs.reduce((s, x, k) => s + ys[k] * t(x) ** i, 0));
    M.push(row);
  }
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || !M[c][c]) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const coef = M.map((r, i) => (r[i] ? r[n] / r[i] : 0));
  return (x: number) => coef.reduce((s, ci, i) => s + ci * t(x) ** i, 0);
}

export const mse = (f: (x: number) => number, pts: Pt[]) => pts.reduce((s, [x, y]) => s + (f(x) - y) ** 2, 0) / pts.length;

/** Counts of next tokens: counts[a][b] = how often b follows a. */
export function bigrams(tokens: string[]): Record<string, Record<string, number>> {
  const c: Record<string, Record<string, number>> = {};
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i], b = tokens[i + 1];
    (c[a] ??= {})[b] = (c[a][b] ?? 0) + 1;
  }
  return c;
}

/** Re-weight probabilities by temperature T: p^(1/T), renormalised. */
export function temper(ps: number[], T: number): number[] {
  const w = ps.map((p) => Math.pow(p, 1 / T));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

// ---------------------------------------------------------------- small pieces

export function legend(items: [string, string][]): HTMLElement {
  return h('div', { class: 'legend' }, items.map(([c, l]) =>
    h('span', null, h('i', { style: `background:${c};border-radius:50%` }), l)));
}

/** A scatter of two labelled classes plus any extra layers (drawn underneath the dots). */
export function scatterSpec(a: Pt[], b: Pt[], o: { colors?: [string, string]; extra?: Layer[]; top?: Layer[]; x?: [number, number]; y?: [number, number]; xlabel?: string; ylabel?: string } = {}): PlotSpec {
  const [ca, cb] = o.colors ?? [LIME, LEMON];
  return {
    x: o.x ?? [0, 10], y: o.y ?? [0, 10], size: [440, 320], ticks: [2, 2],
    xlabel: o.xlabel ?? 'size (cm)', ylabel: o.ylabel ?? 'yellowness',
    layers: [...(o.extra ?? []), { type: 'dots', pts: a, color: ca, r: 6 }, { type: 'dots', pts: b, color: cb, r: 6 }, ...(o.top ?? [])],
  };
}

/** A token or word shown as a chip. */
export function chips(words: string[], opts: { hi?: number[]; sep?: boolean } = {}): HTMLElement {
  return h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0' },
    words.map((w, k) => h('span', {
      style: `font-family:ui-monospace,Menlo,Consolas,monospace;padding:.2em .55em;border-radius:8px;border:2px solid ${opts.hi?.includes(k) ? 'var(--c2)' : 'var(--line)'};background:${opts.hi?.includes(k) ? 'color-mix(in srgb, var(--c2) 18%, var(--panel))' : 'var(--panel2)'};color:var(--text);font-size:.95rem`,
    }, w)));
}

/** A little caption line in muted text. */
export const note = (t: string) => h('div', { class: 'muted small', style: 'text-align:center;margin-top:4px' }, t);

/** Pixel picture from rows of '#' and '.'. */
export function pixels(rows: string[], opts: { size?: number; color?: string } = {}): HTMLElement {
  const sz = opts.size ?? 18;
  const cols = rows[0].length;
  return h('div', { style: `display:grid;grid-template-columns:repeat(${cols}, ${sz}px);gap:2px;justify-content:center` },
    rows.flatMap((r) => [...r].map((ch) => h('div', { style: `height:${sz}px;border-radius:3px;background:${ch === '#' ? opts.color ?? 'var(--text)' : ch === '+' ? 'color-mix(in srgb, var(--text) 45%, var(--panel2))' : 'var(--panel2)'}` }))));
}

// ---------------------------------------------------------------- confusion matrix

export interface Counts { tp: number; fp: number; fn: number; tn: number }

/** A 2 x 2 confusion matrix: rows are the truth, columns the model's call. */
export function confusion(m: Counts, o: { pos?: string; neg?: string; hide?: boolean } = {}): HTMLElement {
  const pos = o.pos ?? 'spam', neg = o.neg ?? 'not spam';
  const cell = (n: number, name: string, good: boolean) => h('div', {
    style: `padding:10px 6px;border-radius:10px;text-align:center;background:color-mix(in srgb, ${good ? 'var(--good)' : 'var(--bad)'} 16%, var(--panel));border:2px solid color-mix(in srgb, ${good ? 'var(--good)' : 'var(--bad)'} 45%, transparent)`,
  }, h('div', { style: 'font-size:1.5rem;font-weight:800;color:var(--text)' }, o.hide ? '?' : String(n)), h('div', { class: 'muted small' }, name));
  const head = (t: string, extra = '') => h('div', { class: 'muted small', style: `font-weight:700;text-align:center;align-self:center;${extra}` }, t);
  return h('div', { style: 'max-width:380px;margin:6px auto' },
    h('div', { style: 'display:grid;grid-template-columns:minmax(64px,auto) 1fr 1fr;gap:6px' },
      h('div'), head(`model says ${pos}`), head(`model says ${neg}`),
      head(`really ${pos}`, 'text-align:right'), cell(m.tp, 'true positive', true), cell(m.fn, 'false negative', false),
      head(`really ${neg}`, 'text-align:right'), cell(m.fp, 'false positive', false), cell(m.tn, 'true negative', true)));
}

/** Count outcomes when scores at or above t are called positive. */
export function countAt(pos: number[], neg: number[], t: number): Counts {
  const tp = pos.filter((s) => s >= t - 1e-9).length, fp = neg.filter((s) => s >= t - 1e-9).length;
  return { tp, fn: pos.length - tp, fp, tn: neg.length - fp };
}

/** Emails on a score line: real spam on the top row, real mail below, threshold as a dashed line. */
export function scoreSpec(spam: number[], ham: number[], t?: number): PlotSpec {
  const layers: Layer[] = [];
  if (t !== undefined) {
    layers.push({ type: 'area', f: () => 2.6, base: () => 0.5, from: t, to: 1.02, color: SPAM });
    layers.push({ type: 'vline', x: t, color: 'var(--text)' });
  }
  layers.push({ type: 'dots', pts: spam.map((s, k) => [s, k % 2 ? 1.9 : 2.1] as Pt), color: SPAM, r: 7 });
  layers.push({ type: 'dots', pts: ham.map((s, k) => [s, k % 2 ? 0.9 : 1.1] as Pt), color: HAM, r: 7 });
  layers.push({ type: 'text', x: 0.01, y: 2.4, text: 'really spam', anchor: 'start', color: 'var(--muted)' });
  layers.push({ type: 'text', x: 0.01, y: 1.4, text: 'really fine', anchor: 'start', color: 'var(--muted)' });
  return { x: [0, 1], y: [0.5, 2.6], size: [440, 200], ticks: [0.1, 10], grid: false, xlabel: 'spam score', layers };
}

// ---------------------------------------------------------------- networks

export interface NNode { label: string; sub?: string; hi?: boolean; dim?: boolean }
export interface NEdge { from: [number, number]; to: [number, number]; w?: string }

/** A layered network: columns of nodes, left to right, with weight labels on the edges. */
export function netDiagram(cols: NNode[][], edges: NEdge[], o: { width?: number; height?: number } = {}): HTMLElement {
  const W = o.width ?? 340, H = o.height ?? 180, R = 19;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, style: `width:100%;max-width:${W + 40}px;display:block;margin:0 auto` });
  const pos = (l: number, i: number): Pt => {
    const x = 52 + (l * (W - 104)) / Math.max(1, cols.length - 1);
    const n = cols[l].length;
    const y = n === 1 ? (H - 14) / 2 : 24 + (i * (H - 70)) / (n - 1);
    return [x, y];
  };
  for (const e of edges) {
    const [x1, y1] = pos(...e.from), [x2, y2] = pos(...e.to);
    s.appendChild(svg('line', { x1, y1, x2, y2, style: 'stroke:var(--muted);stroke-width:1.6;opacity:.75' }));
  }
  for (const e of edges) {
    if (!e.w) continue;
    const [x1, y1] = pos(...e.from), [x2, y2] = pos(...e.to);
    const f = 0.42, mx = x1 + (x2 - x1) * f, my = y1 + (y2 - y1) * f;
    const wpx = 9 + e.w.length * 7.5;
    s.appendChild(svg('rect', { x: mx - wpx / 2, y: my - 10, width: wpx, height: 19, rx: 5, style: 'fill:var(--panel);stroke:var(--line)' }));
    s.appendChild(svg('text', { x: mx, y: my + 4.5, 'text-anchor': 'middle', style: 'fill:var(--c2);font-size:13px;font-weight:700' }, e.w));
  }
  cols.forEach((col, l) => col.forEach((n, i) => {
    const [x, y] = pos(l, i);
    s.appendChild(svg('circle', { cx: x, cy: y, r: R, style: `fill:${n.hi ? 'color-mix(in srgb, var(--c1) 30%, var(--panel))' : 'var(--panel2)'};stroke:${n.hi ? 'var(--c1)' : 'var(--line)'};stroke-width:2;opacity:${n.dim ? 0.45 : 1}` }));
    s.appendChild(svg('text', { x, y: y + 5, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:14px;font-weight:700' }, n.label));
    if (n.sub) s.appendChild(svg('text', { x, y: y + R + 14, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11.5px' }, n.sub));
  }));
  return h('div', null, s);
}

const sgn = (v: number) => (v < 0 ? `−${num(-v)}` : num(v));

/** A single neuron: two inputs, weights, bias, step output. */
export function neuronDiagram(w1: number, w2: number, b: number, x?: Pt): HTMLElement {
  const z = x ? w1 * x[0] + w2 * x[1] + b : undefined;
  return netDiagram(
    [[{ label: x ? String(x[0]) : 'x₁', sub: 'input x₁' }, { label: x ? String(x[1]) : 'x₂', sub: 'input x₂' }],
      [{ label: 'Σ', sub: `bias ${sgn(b)}${z !== undefined ? ` · sum ${sgn(z)}` : ''}`, hi: true }],
      [{ label: z !== undefined ? String(stepFn(z)) : 'out', sub: '1 if sum > 0' }]],
    [{ from: [0, 0], to: [1, 0], w: sgn(w1) }, { from: [0, 1], to: [1, 0], w: sgn(w2) }, { from: [1, 0], to: [2, 0] }]);
}

/** Truth table of a neuron next to the target function, mismatches marked. */
export function gateTable(f: (a: number, b: number) => number, want?: (a: number, b: number) => number, wantName = 'want'): HTMLElement {
  const head = want ? ['x₁', 'x₂', wantName, 'neuron'] : ['x₁', 'x₂', 'out'];
  const rows = INPUTS.map(([a, b]) => {
    const out = f(a, b);
    if (!want) return [a, b, out];
    const ok = out === want(a, b);
    return [a, b, want(a, b), h('span', { style: `font-weight:800;color:${ok ? 'var(--good)' : 'var(--bad)'}` }, `${out} ${ok ? '✓' : '✗'}`)];
  });
  return dataTable(head, rows);
}

/** Sliders for w1, w2, b; the neuron's truth table updates; solved when it matches `want`. */
export function gateExplorer(want: (a: number, b: number) => number, name: string, start: [number, number, number]): Widget {
  return explorer({
    params: [
      { id: 'w1', label: 'weight w₁', min: -2, max: 2, step: 0.5, value: start[0] },
      { id: 'w2', label: 'weight w₂', min: -2, max: 2, step: 0.5, value: start[1] },
      { id: 'b', label: 'bias b', min: -3, max: 3, step: 0.5, value: start[2] },
    ],
    draw: (v) => h('div', null, neuronDiagram(v.w1, v.w2, v.b), gateTable(neuron(v.w1, v.w2, v.b), want, name)),
    readout: (v) => {
      const wrong = INPUTS.filter(([a, b]) => neuron(v.w1, v.w2, v.b)(a, b) !== want(a, b)).length;
      return wrong ? `${wrong} of 4 rows wrong` : `All 4 rows match ${name}`;
    },
    goal: (v) => table(neuron(v.w1, v.w2, v.b)) === table(want),
    goalText: `The neuron computes ${name}.`,
  });
}
