// Pictures for the Algebra & Functions course: balance scales, algebra tiles, area models,
// function machines, completing the square, a lily pond. DOM/SVG only, theme colours via CSS vars.
import type { Widget } from '../types';
import { h, svg } from '../ui';
import { stepper } from '../viz/explore';
import { cellGrid } from '../viz/cs';

const MINUS = '−';

/** "3x + 2", "x", "11", "2x" for a pan holding x boxes and n weights. */
export function panText(x: number, n: number): string {
  const parts: string[] = [];
  if (x) parts.push(x === 1 ? 'x' : `${x}x`);
  if (n || !x) parts.push(String(n));
  return parts.join(' + ');
}

// ---------------------------------------------------------------- balance scale

export interface Pan { x: number; n: number }

/**
 * A balance scale: boxes (each weighs x) and unit weights on each pan. With the hidden value
 * `xv` the beam tilts toward the heavier side; without it the scale is drawn level.
 */
export function scaleSvg(left: Pan, right: Pan, xv?: number): SVGElement {
  const W = 400, H = 236, cx = 200, cy = 46, arm = 116, drop = 116;
  const L = xv === undefined ? 0 : left.x * xv + left.n;
  const R = xv === undefined ? 0 : right.x * xv + right.n;
  const deg = Math.max(-11, Math.min(11, (R - L) * 2.5));
  const a = (deg * Math.PI) / 180;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' }) as SVGSVGElement;
  s.style.maxWidth = '420px';
  // stand
  s.appendChild(svg('path', { d: `M${cx},${cy} L${cx - 26},${H - 8} L${cx + 26},${H - 8} Z`, style: 'fill:var(--panel2);stroke:var(--muted);stroke-width:1.5' }));
  const ends = [-1, 1].map((sg) => [cx + sg * arm * Math.cos(a), cy + sg * arm * Math.sin(a)] as [number, number]);
  s.appendChild(svg('line', { x1: ends[0][0], y1: ends[0][1], x2: ends[1][0], y2: ends[1][1], style: 'stroke:var(--text);stroke-width:5;stroke-linecap:round' }));
  s.appendChild(svg('circle', { cx, cy, r: 6, style: 'fill:var(--text)' }));
  [left, right].forEach((pan, side) => {
    const [ex, ey] = ends[side];
    const by = ey + drop, pw = 132;
    s.appendChild(svg('line', { x1: ex, y1: ey, x2: ex - pw / 2 + 4, y2: by, style: 'stroke:var(--muted);stroke-width:1.2' }));
    s.appendChild(svg('line', { x1: ex, y1: ey, x2: ex + pw / 2 - 4, y2: by, style: 'stroke:var(--muted);stroke-width:1.2' }));
    s.appendChild(svg('path', { d: `M${ex - pw / 2},${by} Q${ex},${by + 16} ${ex + pw / 2},${by}`, style: 'fill:var(--panel2);stroke:var(--muted);stroke-width:2' }));
    // items: boxes first, then weights, flowing in rows upward from the pan
    const items: ('x' | 'n')[] = [...Array(pan.x).fill('x'), ...Array(pan.n).fill('n')];
    let rowX = 0, rowY = 0, rowH = 0;
    const startX = ex - pw / 2 + 8, maxW = pw - 16;
    for (const it of items) {
      const w = it === 'x' ? 24 : 16;
      if (rowX + w > maxW) { rowX = 0; rowY += rowH + 2; rowH = 0; }
      const hgt = it === 'x' ? 24 : 16;
      const x = startX + rowX, y = by - 2 - rowY - hgt;
      if (it === 'x') {
        s.appendChild(svg('rect', { x, y, width: 22, height: 22, rx: 3, style: 'fill:var(--c1);stroke:var(--panel);stroke-width:1' }));
        s.appendChild(svg('text', { x: x + 11, y: y + 16, 'text-anchor': 'middle', style: 'fill:#fff;font-size:13px;font-weight:700;font-style:italic' }, 'x'));
      } else {
        s.appendChild(svg('circle', { cx: x + 7.5, cy: y + 8, r: 7, style: 'fill:var(--c2);stroke:var(--panel);stroke-width:1' }));
      }
      rowX += w + 2;
      rowH = Math.max(rowH, hgt);
    }
    s.appendChild(svg('text', { x: ex, y: by + 26, 'text-anchor': 'middle', class: 'plot-label', style: 'fill:var(--text)' }, panText(pan.x, pan.n)));
  });
  return s;
}

const legend = () => h('div', { class: 'muted small', style: 'text-align:center' },
  h('span', { style: 'display:inline-block;width:12px;height:12px;background:var(--c1);border-radius:2px;vertical-align:-1px' }), ' box (weighs x)   ',
  h('span', { style: 'display:inline-block;width:12px;height:12px;background:var(--c2);border-radius:50%;vertical-align:-1px' }), ' weight (weighs 1)');

/** A static scale (level when no hidden value is given). */
export function scale(left: Pan, right: Pan, xv?: number): Widget {
  return () => h('div', null, h('div', { class: 'plot-wrap' }, scaleSvg(left, right, xv)), legend());
}

/**
 * Interactive scale for ax + b = cx + d. Buttons do things to the pans; the beam tilts (using the
 * real x) whenever the two sides stop being equal. Solved when one box sits alone, level.
 */
export function balanceTask(left: Pan, right: Pan, xv: number): Widget {
  return (ctx) => {
    let l = { ...left }, r = { ...right };
    const pic = h('div', { class: 'plot-wrap' });
    const status = h('div', { class: 'readout' });
    const note = h('div', { class: 'muted small', style: 'text-align:center;min-height:1.3em' });
    const level = () => l.x * xv + l.n === r.x * xv + r.n;
    const draw = (msg = '') => {
      pic.replaceChildren(scaleSvg(l, r, xv));
      status.textContent = `${panText(l.x, l.n)} = ${panText(r.x, r.n)}   ${level() ? '· level' : '· tipping!'}`;
      note.textContent = msg;
      ctx.solved?.(l.x === 1 && l.n === 0 && r.x === 0 && level());
    };
    const both = (dx: number, dn: number) => {
      if (l.x + dx < 0 || r.x + dx < 0 || l.n + dn < 0 || r.n + dn < 0) return draw('One side has nothing of that kind left to take.');
      l = { x: l.x + dx, n: l.n + dn }; r = { x: r.x + dx, n: r.n + dn };
      draw();
    };
    const split = () => {
      const k = l.x;
      if (k < 2) return draw('Split when there are 2 or more boxes on the left.');
      if (r.x || l.n || [r.n].some((v) => v % k)) return draw(`Can't split both pans into ${k} equal groups yet: clear the weights from the box side first.`);
      l = { x: 1, n: 0 }; r = { x: 0, n: r.n / k };
      draw(`Kept 1 of ${k} equal groups on each side.`);
    };
    const btns = [
      h('button', { class: 'ghost', onclick: () => both(0, -1) }, `${MINUS}1 weight, both sides`),
      h('button', { class: 'ghost', onclick: () => { if (l.n < 1) return draw('No weights on the left.'); l = { ...l, n: l.n - 1 }; draw('Only the left side changed…'); } }, `${MINUS}1 weight, left only`),
      left.x && right.x ? h('button', { class: 'ghost', onclick: () => both(-1, 0) }, `${MINUS}1 box, both sides`) : null,
      h('button', { class: 'ghost', onclick: split }, 'Split into equal groups'),
      h('button', { class: 'ghost', onclick: () => { l = { ...left }; r = { ...right }; draw(); } }, 'Reset'),
    ];
    draw();
    return h('div', null, pic, legend(), status, h('div', { class: 'w-btns', style: 'justify-content:center' }, btns), note);
  };
}

// ---------------------------------------------------------------- algebra tiles

export interface TileGroup { kind: 'x2' | 'x' | '1'; n: number; neg?: boolean }

/** Algebra tiles: x² squares, x bars and unit squares; negatives drawn hollow in another colour. */
export function tiles(groups: TileGroup[], caption?: string): Widget {
  return () => {
    const row = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end;justify-content:center;margin:8px 0' });
    for (const g of groups) {
      const [w, ht] = g.kind === 'x2' ? [44, 44] : g.kind === 'x' ? [14, 44] : [14, 14];
      const col = g.neg ? 'var(--c4)' : g.kind === 'x2' ? 'var(--c6)' : g.kind === 'x' ? 'var(--c1)' : 'var(--c2)';
      const box = h('div', { style: 'display:flex;gap:3px;align-items:flex-end;padding:0 4px' });
      for (let k = 0; k < g.n; k++) {
        box.appendChild(h('span', { style: `display:inline-block;width:${w}px;height:${ht}px;border-radius:3px;${g.neg ? `border:2px dashed ${col};background:transparent` : `background:${col}`}` }));
      }
      row.appendChild(box);
    }
    const key = h('div', { class: 'muted small', style: 'text-align:center' },
      ...[['var(--c6)', '44px', '14px', 'x²'], ['var(--c1)', '6px', '14px', 'x'], ['var(--c2)', '10px', '10px', '1'], ['var(--c4)', '10px', '10px', 'negative (dashed)']].map(([c, w, ht, t]) =>
        h('span', { style: 'margin:0 8px;white-space:nowrap' }, h('span', { style: `display:inline-block;width:${w === '44px' ? '14px' : w};height:${ht};background:${c};border-radius:2px;margin-right:4px;vertical-align:-1px` }), t)));
    return h('div', null, row, caption ? h('div', { class: 'readout' }, caption) : null, key);
  };
}

// ---------------------------------------------------------------- area model

/**
 * A rectangle cut into a grid: column widths and row heights (relative), edge labels, cell labels.
 * Each cell is tinted; cells listed in `hide` show "?".
 */
export function areaModel(o: { cols: string[]; rows: string[]; colW: number[]; rowH: number[]; cells: string[][]; hide?: [number, number][] }): Widget {
  return () => {
    const W = 340, pad = 40, sw = o.colW.reduce((a, b) => a + b, 0), sh = o.rowH.reduce((a, b) => a + b, 0);
    const k = Math.min((W - pad - 10) / sw, 220 / sh);
    const s = svg('svg', { viewBox: `0 0 ${W} ${pad + sh * k + 10}`, class: 'plot', role: 'img' }) as SVGSVGElement;
    s.style.maxWidth = '420px';
    const tint = ['var(--c1)', 'var(--c3)', 'var(--c2)', 'var(--c6)'];
    let y = pad;
    o.rowH.forEach((rh, r) => {
      let x = pad;
      const hh = rh * k;
      s.appendChild(svg('text', { x: pad - 8, y: y + hh / 2 + 5, 'text-anchor': 'end', class: 'plot-label', style: 'fill:var(--text)' }, o.rows[r]));
      o.colW.forEach((cw, c) => {
        const ww = cw * k;
        if (r === 0) s.appendChild(svg('text', { x: x + ww / 2, y: pad - 10, 'text-anchor': 'middle', class: 'plot-label', style: 'fill:var(--text)' }, o.cols[c]));
        const col = tint[(r * 2 + c) % tint.length];
        s.appendChild(svg('rect', { x, y, width: ww, height: hh, style: `fill:color-mix(in srgb, ${col} 28%, var(--panel));stroke:var(--text);stroke-width:1.5` }));
        const hidden = o.hide?.some(([a, b]) => a === r && b === c);
        s.appendChild(svg('text', { x: x + ww / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', class: 'plot-label', style: 'fill:var(--text)' }, hidden ? '?' : o.cells[r][c]));
        x += ww;
      });
      y += hh;
    });
    return h('div', { class: 'plot-wrap' }, s);
  };
}

// ---------------------------------------------------------------- function machines

const bubble = (v: string, hi = false) => h('span', { style: `display:inline-grid;place-items:center;min-width:38px;height:38px;padding:0 6px;border-radius:19px;border:2px solid ${hi ? 'var(--c2)' : 'var(--line)'};background:var(--panel);font-weight:700;font-variant-numeric:tabular-nums` }, v);
const box = (label: string) => h('span', { style: 'display:inline-grid;place-items:center;min-width:46px;height:44px;padding:0 8px;border-radius:10px;background:color-mix(in srgb, var(--c1) 22%, var(--panel));border:2px solid var(--c1);font-weight:800' }, label);
const arrow = () => h('span', { class: 'muted', style: 'font-size:1.2rem' }, '→');

/** One picture: value → [stage] → value → [stage] → value. values[k] = '' hides it as "?". */
export function machineRow(stages: string[], values: string[]): HTMLElement {
  const kids: Node[] = [];
  values.forEach((v, k) => {
    kids.push(bubble(v === '' ? '?' : v, k === values.length - 1));
    if (k < stages.length) kids.push(arrow(), box(stages[k]), arrow());
  });
  return h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;margin:10px 0' }, kids);
}

export function machine(stages: string[], values: string[]): Widget {
  return () => machineRow(stages, values);
}

/** Feed inputs through a chain of stages one at a time; a table of results builds up. */
export function machineStepper(stages: { label: string; f: (x: number) => number }[], inputs: number[], name = 'output'): Widget {
  const fmt = (v: number) => (v < 0 ? MINUS + Math.abs(v) : String(v));
  return () => stepper(inputs.length, (i) => {
    const vals = [inputs[i]];
    for (const s of stages) vals.push(s.f(vals[vals.length - 1]));
    const done = inputs.slice(0, i + 1);
    const out = (x: number) => stages.reduce((v, s) => s.f(v), x);
    return h('div', null, machineRow(stages.map((s) => s.label), vals.map(fmt)),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('tr', null, h('th', null, 'input'), done.map((x) => h('td', null, fmt(x)))),
        h('tr', null, h('th', null, name), done.map((x) => h('td', null, fmt(out(x))))))));
  }, { caption: (i) => `Input ${fmt(inputs[i])} goes in…`, autoplayMs: 1100 });
}

/** Run a chain forward, then backward with the opposite operations. */
export function undoStepper(fwd: string[], back: string[], values: number[]): Widget {
  const fmt = (v: number) => (v < 0 ? MINUS + Math.abs(v) : String(v));
  const n = fwd.length;
  return () => stepper(2 * n + 1, (i) => {
    if (i <= n) {
      const shown = values.map((v, k) => (k <= i ? fmt(v) : ''));
      return h('div', null, h('div', { class: 'muted small', style: 'text-align:center' }, 'Forward'), machineRow(fwd, shown));
    }
    const j = i - n; // steps undone
    const rev = values.slice().reverse();
    const shown = rev.map((v, k) => (k <= j ? fmt(v) : ''));
    return h('div', null, h('div', { class: 'muted small', style: 'text-align:center' }, 'Backward: undo the last step first'), machineRow(back, shown));
  }, { caption: (i) => (i < n ? 'Do the steps in order…' : i === n ? 'That’s the output.' : i < 2 * n ? 'Undo the last step first…' : 'Back to the input.') });
}

// ---------------------------------------------------------------- completing the square

/** x² + bx as a picture, cut and rearranged into an almost-square, missing (b/2)². */
export function completeSquare(b: number): Widget {
  const X = 110, u = 9, hb = (b / 2) * u;
  const W = 300, H = 230, ox = 30, oy = 30;
  const rect = (x: number, y: number, w: number, hgt: number, col: string, label: string, dash = false) => [
    svg('rect', { x, y, width: w, height: hgt, style: `fill:${dash ? 'transparent' : `color-mix(in srgb, ${col} 35%, var(--panel))`};stroke:${dash ? col : 'var(--text)'};stroke-width:${dash ? 2 : 1.5};${dash ? 'stroke-dasharray:5 4;' : ''}` }),
    svg('text', { x: x + w / 2, y: y + hgt / 2 + 5, 'text-anchor': 'middle', class: 'plot-label', style: 'fill:var(--text)' }, label),
  ];
  const caps = [
    `x² + ${b}x: a square plus a strip ${b} wide.`,
    `Cut the strip into two halves, each ${b / 2} wide.`,
    `Move one half under the square. Almost a square, side x + ${b / 2}…`,
    `…missing one ${b / 2} × ${b / 2} corner. So x² + ${b}x = (x + ${b / 2})² − ${(b / 2) ** 2}.`,
  ];
  return () => stepper(4, (i) => {
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img' }) as SVGSVGElement;
    s.style.maxWidth = '380px';
    const add = (els: SVGElement[]) => els.forEach((e) => s.appendChild(e));
    add(rect(ox, oy, X, X, 'var(--c6)', 'x²'));
    s.appendChild(svg('text', { x: ox + X / 2, y: oy - 8, 'text-anchor': 'middle', class: 'tick' }, 'x'));
    s.appendChild(svg('text', { x: ox - 8, y: oy + X / 2 + 4, 'text-anchor': 'end', class: 'tick' }, 'x'));
    if (i === 0) {
      add(rect(ox + X, oy, b * u, X, 'var(--c1)', `${b}x`));
      s.appendChild(svg('text', { x: ox + X + (b * u) / 2, y: oy - 8, 'text-anchor': 'middle', class: 'tick' }, String(b)));
    } else if (i === 1) {
      add(rect(ox + X, oy, hb, X, 'var(--c1)', `${b / 2}x`));
      add(rect(ox + X + hb + 8, oy, hb, X, 'var(--c3)', `${b / 2}x`));
    } else {
      add(rect(ox + X, oy, hb, X, 'var(--c1)', `${b / 2}x`));
      add(rect(ox, oy + X, X, hb, 'var(--c3)', `${b / 2}x`));
      s.appendChild(svg('text', { x: ox + X + hb / 2, y: oy - 8, 'text-anchor': 'middle', class: 'tick' }, String(b / 2)));
      s.appendChild(svg('text', { x: ox - 8, y: oy + X + hb / 2 + 4, 'text-anchor': 'end', class: 'tick' }, String(b / 2)));
      if (i === 3) add(rect(ox + X, oy + X, hb, hb, 'var(--c2)', String((b / 2) ** 2), true));
    }
    return h('div', { class: 'plot-wrap' }, s);
  }, { caption: (i) => caps[i], autoplayMs: 1500 });
}

// ---------------------------------------------------------------- lily pond

/** 64-cell pond: covered cells double each day, full on day 30. */
export function pond(day: number): HTMLElement {
  const covered = day >= 24 ? 2 ** (day - 24) : 0;
  return cellGrid(8, 8, (r, c) => ({ fill: r * 8 + c < covered ? 'var(--c3)' : undefined }), { size: 30 });
}

export function pondStepper(): Widget {
  return () => stepper(7, (i) => pond(24 + i), {
    caption: (i) => {
      const d = 24 + i, f = 2 ** i;
      return `Day ${d}: ${f === 64 ? 'all' : `${f}/64`} of the pond${f === 32 ? ' (half)' : ''}${d < 28 ? ', still mostly open water' : ''}.`;
    },
    autoplayMs: 1000,
  });
}

/** 1 → 2 → 4 → … doublings as a row of cells, counting the steps. */
export function doublingStepper(n: number, base = 2): Widget {
  return () => stepper(n + 1, (i) => {
    const vals = Array.from({ length: i + 1 }, (_, k) => base ** k);
    return h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;margin:10px 0' },
      vals.map((v, k) => [k ? h('span', { class: 'muted small' }, `×${base}`) : null, bubble(v.toLocaleString('en-US'), k === i)]));
  }, { caption: (i) => `${i} multiplication${i === 1 ? '' : 's'} by ${base}: ${base}${sup(i)} = ${(base ** i).toLocaleString('en-US')}`, autoplayMs: 900 });
}

const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
export const sup = (n: number) => String(n).split('').map((c) => SUP[c] ?? c).join('');

/** A few lines of algebra revealed one at a time. */
export function workStepper(lines: [string, string][]): Widget {
  return () => stepper(lines.length, (i) =>
    h('div', { style: 'display:grid;gap:4px;justify-content:center;margin:10px 0;font-size:1.1rem' },
      lines.slice(0, i + 1).map(([eq, why], k) => h('div', { style: `display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;${k === i ? '' : 'opacity:.55'}` },
        h('span', { style: 'font-weight:700;font-variant-numeric:tabular-nums;min-width:9em' }, eq), h('span', { class: 'muted small' }, why)))),
  { autoplayMs: 1300 });
}
