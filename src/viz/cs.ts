// Computer-science pictures: highlighted code, step-through code traces, array bars, networks
// (graphs of nodes and edges) and cell grids (mazes, pixels, automata).
import { h, svg } from '../ui';
import { stepper } from './explore';

const KW = new Set(['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'and', 'or', 'not', 'True', 'False', 'None', 'print', 'range', 'len', 'break', 'continue', 'function', 'let', 'const', 'var', 'true', 'false', 'null']);

/** Light syntax colouring for short Python-like snippets. */
function colour(line: string): Node[] {
  const out: Node[] = [];
  const re = /(#.*$|\/\/.*$)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [t, com, str, numb, word] = m;
    if (com) out.push(h('span', { class: 'tk-com' }, t));
    else if (str) out.push(h('span', { class: 'tk-str' }, t));
    else if (numb) out.push(h('span', { class: 'tk-num' }, t));
    else if (word && KW.has(word)) out.push(h('span', { class: 'tk-kw' }, t));
    else out.push(document.createTextNode(t));
  }
  return out;
}

/** A code listing with line numbers; `active` highlights a line (1-based), `marks` tints others. */
export function codeBlock(src: string, opts: { active?: number; marks?: number[] } = {}): HTMLElement {
  const lines = src.replace(/^\n+|\s+$/g, '').split('\n');
  return h('pre', { class: 'code' }, lines.map((l, k) =>
    h('div', { class: `cl${opts.active === k + 1 ? ' active' : ''}${opts.marks?.includes(k + 1) ? ' marked' : ''}` },
      h('span', { class: 'ln' }, String(k + 1)), h('span', { class: 'lc' }, colour(l)))));
}

export interface TraceFrame {
  /** Line about to run / just run (1-based). */
  line: number;
  vars: Record<string, string | number | boolean | (string | number)[]>;
  /** Output printed so far. */
  out?: string[];
  note?: string;
}

/** Step through a program: highlighted line, variable table, output so far. */
export function codeTrace(src: string, frames: TraceFrame[]): HTMLElement {
  const show = (v: unknown) => Array.isArray(v) ? `[${v.join(', ')}]` : typeof v === 'string' ? `"${v}"` : String(v);
  return stepper(frames.length, (i) => {
    const f = frames[i];
    const prev = frames[i - 1];
    const names = Object.keys(f.vars);
    return h('div', { class: 'trace' },
      codeBlock(src, { active: f.line }),
      h('div', { class: 'trace-side' },
        h('div', { class: 'trace-head' }, 'Variables'),
        names.length ? h('table', { class: 'vars' }, names.map((n) =>
          h('tr', { class: prev && show(prev.vars[n]) !== show(f.vars[n]) ? 'changed' : '' }, h('td', null, n), h('td', null, show(f.vars[n])))))
          : h('div', { class: 'muted small' }, '(none yet)'),
        h('div', { class: 'trace-head' }, 'Output'),
        h('pre', { class: 'trace-out' }, (f.out ?? []).join('\n') || ' ')));
  }, { caption: (i) => frames[i].note ?? '' });
}

/** Bars for an array of numbers; hi = indices to highlight, done = indices finished, labels under. */
export function arrayBars(arr: number[], opts: { hi?: number[]; done?: number[]; pointer?: Record<string, number>; max?: number; showValues?: boolean } = {}): HTMLElement {
  const max = opts.max ?? Math.max(...arr, 1);
  const W = Math.max(240, arr.length * 34), H = 150, bw = W / arr.length;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H + 26}`, class: 'plot' }) as SVGSVGElement;
  s.style.maxWidth = `${W}px`;
  arr.forEach((v, k) => {
    const hh = ((H - 20) * v) / max;
    const cls = opts.hi?.includes(k) ? 'ab hi' : opts.done?.includes(k) ? 'ab done' : 'ab';
    s.appendChild(svg('rect', { x: k * bw + 3, y: H - hh, width: bw - 6, height: hh, rx: 3, class: cls }));
    if (opts.showValues !== false) s.appendChild(svg('text', { x: k * bw + bw / 2, y: H - hh - 4, class: 'tick', 'text-anchor': 'middle' }, String(v)));
  });
  for (const [name, k] of Object.entries(opts.pointer ?? {})) {
    s.appendChild(svg('text', { x: k * bw + bw / 2, y: H + 18, class: 'plot-label', 'text-anchor': 'middle' }, '▲' + name));
  }
  const d = h('div', { class: 'plot-wrap' });
  d.appendChild(s);
  return d;
}

/** A row of boxes with indices: an array as memory cells (for search, two pointers, etc.). */
export function cells(arr: (string | number)[], opts: { hi?: number[]; dim?: number[]; pointer?: Record<string, number>; index?: boolean } = {}): HTMLElement {
  return h('div', { class: 'cells' }, arr.map((v, k) =>
    h('div', { class: `cell${opts.hi?.includes(k) ? ' hi' : ''}${opts.dim?.includes(k) ? ' dim' : ''}` },
      h('span', { class: 'cell-v' }, String(v)),
      opts.index !== false ? h('span', { class: 'cell-i' }, String(k)) : null,
      h('span', { class: 'cell-p' }, Object.entries(opts.pointer ?? {}).filter(([, i]) => i === k).map(([n]) => n).join(' ')))));
}

export interface NetNode { id: string; x: number; y: number; label?: string }
export interface NetEdge { a: string; b: string; w?: number | string; directed?: boolean }

/**
 * A network drawn in a 100 x 60 box. hiNodes/hiEdges highlight; onNode makes nodes clickable
 * (the callback gets the id; return value ignored). Edge keys for highlighting are "a-b".
 */
export function network(nodes: NetNode[], edges: NetEdge[], opts: { hiNodes?: string[]; hiEdges?: string[]; dimNodes?: string[]; nodeText?: Record<string, string>; onNode?: (id: string) => void; size?: [number, number] } = {}): HTMLElement {
  const [W, H] = opts.size ?? [100, 60];
  const s = svg('svg', { viewBox: `-6 -6 ${W + 12} ${H + 12}`, class: 'net' }) as SVGSVGElement;
  const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const hiE = new Set(opts.hiEdges ?? []);
  for (const e of edges) {
    const a = at[e.a], b = at[e.b];
    const on = hiE.has(`${e.a}-${e.b}`) || (!e.directed && hiE.has(`${e.b}-${e.a}`));
    let x2 = b.x, y2 = b.y;
    if (e.directed) { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; x2 = b.x - ((b.x - a.x) / d) * 5.2; y2 = b.y - ((b.y - a.y) / d) * 5.2; }
    s.appendChild(svg('line', { x1: a.x, y1: a.y, x2, y2, class: `net-edge${on ? ' hi' : ''}`, 'marker-end': e.directed ? 'url(#arrow)' : '' }));
    if (e.w !== undefined) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      s.appendChild(svg('rect', { x: mx - 3.6, y: my - 3, width: 7.2, height: 6, rx: 1.5, class: 'net-wbg' }));
      s.appendChild(svg('text', { x: mx, y: my + 1.8, class: 'net-w', 'text-anchor': 'middle' }, String(e.w)));
    }
  }
  s.insertBefore(svg('defs', {}, svg('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0L10,5L0,10Z', class: 'net-arrow' }))), s.firstChild);
  for (const n of nodes) {
    const g = svg('g', { class: `net-node${opts.hiNodes?.includes(n.id) ? ' hi' : ''}${opts.dimNodes?.includes(n.id) ? ' dim' : ''}${opts.onNode ? ' clickable' : ''}`, 'data-node': n.id });
    g.appendChild(svg('circle', { cx: n.x, cy: n.y, r: 4.6 }));
    g.appendChild(svg('text', { x: n.x, y: n.y + 1.6, 'text-anchor': 'middle' }, n.label ?? n.id));
    const extra = opts.nodeText?.[n.id];
    if (extra) g.appendChild(svg('text', { x: n.x, y: n.y - 6.4, 'text-anchor': 'middle', class: 'net-extra' }, extra));
    if (opts.onNode) g.addEventListener('click', () => opts.onNode!(n.id));
    s.appendChild(g);
  }
  return h('div', { class: 'net-wrap' }, s);
}

/** A grid of cells; cell(r, c) gives its fill colour and optional text. onCell makes it clickable. */
export function cellGrid(rows: number, cols: number, cell: (r: number, c: number) => { fill?: string; text?: string; cls?: string }, opts: { onCell?: (r: number, c: number) => void; size?: number } = {}): HTMLElement {
  const sz = opts.size ?? Math.min(40, Math.floor(420 / cols));
  return h('div', { class: 'cellgrid', style: `grid-template-columns:repeat(${cols}, ${sz}px)` },
    Array.from({ length: rows * cols }, (_, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const d = cell(r, c);
      return h('div', { class: `gc${d.cls ? ' ' + d.cls : ''}${opts.onCell ? ' clickable' : ''}`, style: `height:${sz}px;${d.fill ? `background:${d.fill};` : ''}`, onclick: opts.onCell ? () => opts.onCell!(r, c) : undefined }, d.text ?? '');
    }));
}
