// Pictures and puzzles for the Number Theory course: dots in rows (divisibility and remainders),
// clock faces (arithmetic mod n), factor trees, square tiles and Euclid's square-cutting, coin
// amounts you can and can't pay, place-value columns, and check-digit tasks. Also the small number
// helpers the course and its generators share. Tasks report through ctx.solved.
import type { Widget } from '../types';
import { gcd, h, svg } from '../ui';
import { stepper } from '../viz/explore';

const C1 = 'var(--c1)', C2 = 'var(--c2)', C3 = 'var(--c3)', C4 = 'var(--c4)', C6 = 'var(--c6)';
const tint = (c: string, p = 25) => `color-mix(in srgb, ${c} ${p}%, var(--panel))`;

function svgBox(w: number, hgt: number, maxW = 360): SVGElement {
  return svg('svg', { viewBox: `0 0 ${w} ${hgt}`, width: '100%', style: `max-width:${maxW}px;display:block;margin:4px auto;height:auto` });
}

// ---------------------------------------------------------------- number helpers

export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
export const mod = (a: number, n: number) => ((a % n) + n) % n;

export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

/** Euclid's algorithm as a list of [a, b, q, r] with a = q·b + r, ending with r = 0. */
export function euclidSteps(a: number, b: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  while (b) { out.push([a, b, Math.floor(a / b), a % b]); [a, b] = [b, a % b]; }
  return out;
}

/** Which amounts 0..N can be paid exactly with the given coins (unlimited supply of each). */
export function payable(coins: number[], N: number): boolean[] {
  const ok = Array.from({ length: N + 1 }, (_, k) => k === 0);
  for (let k = 1; k <= N; k++) ok[k] = coins.some((c) => c <= k && ok[k - c]);
  return ok;
}

/** Largest amount that can't be paid (coins with gcd 1), by checking until min(coins) in a row work. */
export function largestUnpayable(coins: number[]): number {
  const N = 2000, ok = payable(coins, N);
  let last = -1;
  for (let k = 1; k <= N; k++) if (!ok[k]) last = k;
  return last;
}

/** Luhn: from the right, double every second digit (minus 9 if over 9); valid when the sum ends in 0. */
export function luhnSum(d: number[]): number {
  let s = 0;
  for (let i = 0; i < d.length; i++) {
    const fromRight = d.length - 1 - i;
    let v = d[i];
    if (fromRight % 2 === 1) { v *= 2; if (v > 9) v -= 9; }
    s += v;
  }
  return s;
}
export const luhnValid = (d: number[]) => luhnSum(d) % 10 === 0;
/** The digit to append to `d` so the whole thing passes Luhn. */
export const luhnCheck = (d: number[]) => (10 - (luhnSum([...d, 0]) % 10)) % 10;

/** ISBN-13 / EAN: weights 1, 3, 1, 3, …; the total including the check digit is a multiple of 10. */
export const isbnSum = (d: number[]) => d.reduce((s, v, i) => s + v * (i % 2 ? 3 : 1), 0);
export const isbn13Check = (d12: number[]) => (10 - (isbnSum(d12) % 10)) % 10;

/** Number of digits a positive n needs in base b. */
export function digitCount(n: number, b: number): number {
  return n.toString(b).length;
}

/** Smallest k ≥ 1 with a^k ≡ 1 (mod n), for gcd(a, n) = 1. */
export function order(a: number, n: number): number {
  let x = a % n, k = 1;
  while (x !== 1 % n) { x = (x * a) % n; k++; }
  return k;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
/** "1101₂" */
export const inBase = (n: number, b: number) => n.toString(b).toUpperCase() + String(b).split('').map((c) => SUB[Number(c)]).join('');

// ---------------------------------------------------------------- dots in rows

/** n dots in rows of `cols`: complete rows in one colour, the leftover (remainder) in another. */
export function dotRows(n: number, cols: number): HTMLElement {
  const rows = Math.ceil(n / cols), full = Math.floor(n / cols) * cols;
  const gap = Math.max(6, Math.min(26, Math.floor(330 / Math.max(cols, 1)), Math.floor(230 / Math.max(rows, 1))));
  const r = gap * 0.36, W = cols * gap + 8, H = rows * gap + 8;
  const s = svgBox(W, H, Math.min(360, W * 1.4));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), c = i % cols;
    s.appendChild(svg('circle', { cx: 4 + c * gap + gap / 2, cy: 4 + row * gap + gap / 2, r, style: `fill:${i < full ? C1 : C2}` }));
  }
  return h('div', null, s);
}

// ---------------------------------------------------------------- clock faces

/**
 * A clock with n positions, 0 at the top (shown as `top`, e.g. "12"). path draws hops between
 * consecutive positions; hi rings positions; hand points at one position.
 */
export function clockFace(n: number, opts: { path?: number[]; hi?: number[]; hand?: number; top?: string; size?: number } = {}): HTMLElement {
  const S = opts.size ?? 230, c = S / 2, R = S / 2 - 26;
  const s = svgBox(S, S, S);
  const at = (v: number, rr = R): [number, number] => { const a = (mod(v, n) / n) * 2 * Math.PI - Math.PI / 2; return [c + rr * Math.cos(a), c + rr * Math.sin(a)]; };
  s.appendChild(svg('circle', { cx: c, cy: c, r: R, style: 'fill:none;stroke:var(--line);stroke-width:2' }));
  const p = opts.path ?? [];
  for (let k = 1; k < p.length; k++) {
    const [x1, y1] = at(p[k - 1], R - 14), [x2, y2] = at(p[k], R - 14);
    const ang = Math.atan2(y2 - y1, x2 - x1), a = 7;
    s.appendChild(svg('line', { x1, y1, x2, y2, style: `stroke:${C2};stroke-width:2.2;opacity:.85` }));
    s.appendChild(svg('path', { d: `M${x2},${y2}L${x2 - a * Math.cos(ang - 0.45)},${y2 - a * Math.sin(ang - 0.45)}L${x2 - a * Math.cos(ang + 0.45)},${y2 - a * Math.sin(ang + 0.45)}Z`, style: `fill:${C2}` }));
  }
  if (opts.hand !== undefined) {
    const [x, y] = at(opts.hand, R - 22);
    s.appendChild(svg('line', { x1: c, y1: c, x2: x, y2: y, style: `stroke:${C4};stroke-width:4;stroke-linecap:round` }));
    s.appendChild(svg('circle', { cx: c, cy: c, r: 5, style: `fill:${C4}` }));
  }
  for (let v = 0; v < n; v++) {
    const [x, y] = at(v);
    const on = opts.hi?.includes(v) || p.includes(v) || opts.hand === v;
    s.appendChild(svg('circle', { cx: x, cy: y, r: 13, style: `fill:${on ? tint(C3, 45) : 'var(--panel)'};stroke:${on ? C3 : 'var(--line)'};stroke-width:2` }));
    s.appendChild(svg('text', { x, y: y + 4.5, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:13px;font-weight:700' }, v === 0 && opts.top ? opts.top : String(v)));
  }
  return h('div', null, s);
}

// ---------------------------------------------------------------- factor trees

interface TNode { v: number; kids: TNode[] }

function isPrimeN(n: number) { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }

/** Split n into its most balanced factor pair (n composite). */
function balanced(n: number): [number, number] {
  for (let d = Math.floor(Math.sqrt(n)); d >= 2; d--) if (n % d === 0) return [d, n / d];
  return [1, n];
}

function grow(n: number, first?: [number, number]): TNode {
  if (isPrimeN(n)) return { v: n, kids: [] };
  const [a, b] = first ?? balanced(n);
  return { v: n, kids: [grow(a), grow(b)] };
}

/** A factor tree for n; `first` fixes the top split, later splits are the most balanced pair. */
export function factorTree(n: number, first?: [number, number]): HTMLElement {
  const root = grow(n, first);
  const leaves: TNode[] = [];
  const depth = (t: TNode): number => (t.kids.length ? 1 + Math.max(...t.kids.map(depth)) : 0);
  const walk = (t: TNode) => { if (!t.kids.length) leaves.push(t); t.kids.forEach(walk); };
  walk(root);
  const D = depth(root), gx = 40, gy = 46, W = leaves.length * gx + 10, H = D * gy + 40;
  const s = svgBox(W, H, Math.min(260, W * 1.6));
  const pos = new Map<TNode, [number, number]>();
  const place = (t: TNode, d: number): number => {
    const x = t.kids.length ? t.kids.map((k) => place(k, d + 1)).reduce((a, b) => a + b) / t.kids.length : 5 + gx / 2 + leaves.indexOf(t) * gx;
    pos.set(t, [x, 20 + d * gy]);
    return x;
  };
  place(root, 0);
  for (const [t, [x, y]] of pos) for (const k of t.kids) { const [kx, ky] = pos.get(k)!; s.appendChild(svg('line', { x1: x, y1: y + 10, x2: kx, y2: ky - 12, style: 'stroke:var(--muted);stroke-width:1.5' })); }
  for (const [t, [x, y]] of pos) {
    const leaf = !t.kids.length;
    s.appendChild(svg('rect', { x: x - 17, y: y - 12, width: 34, height: 24, rx: leaf ? 12 : 5, style: `fill:${leaf ? tint(C3, 40) : 'var(--panel)'};stroke:${leaf ? C3 : 'var(--line)'};stroke-width:1.5` }));
    s.appendChild(svg('text', { x, y: y + 5, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:13px;font-weight:700' }, String(t.v)));
  }
  return h('div', null, s);
}

// ---------------------------------------------------------------- tiles and Euclid

/** A w x h rectangle covered by s x s tiles from the corner; any strip left over is shaded red. */
export function tileRect(w: number, hh: number, s: number): HTMLElement {
  const k = Math.min(300 / w, 170 / hh), W = w * k + 4, H = hh * k + 4;
  const box = svgBox(W, H, 340);
  const nx = Math.floor(w / s), ny = Math.floor(hh / s);
  box.appendChild(svg('rect', { x: 2, y: 2, width: w * k, height: hh * k, style: `fill:${tint('var(--bad)', 35)};stroke:var(--line);stroke-width:1.5` }));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    box.appendChild(svg('rect', { x: 2 + i * s * k, y: 2 + j * s * k, width: s * k, height: s * k, style: `fill:${(i + j) % 2 ? tint(C1, 55) : tint(C1, 30)};stroke:var(--panel);stroke-width:1` }));
  }
  return h('div', null, box);
}

/** Squares cut from a w x h rectangle, largest first, as Euclid's algorithm does. */
export function euclidSquares(w: number, hh: number): { x: number; y: number; s: number }[] {
  const out: { x: number; y: number; s: number }[] = [];
  let x = 0, y = 0;
  while (w > 0 && hh > 0) {
    if (w >= hh) { out.push({ x, y, s: hh }); x += hh; w -= hh; }
    else { out.push({ x, y, s: w }); y += w; hh -= w; }
  }
  return out;
}

/** Step through cutting the largest possible squares off a w x h rectangle. */
export function euclidStepper(w: number, hh: number): HTMLElement {
  const sq = euclidSquares(w, hh);
  const sizes = [...new Set(sq.map((q) => q.s))];
  const col = (s: number) => [C1, C2, C3, C6, C4][sizes.indexOf(s) % 5];
  const k = Math.min(300 / w, 180 / hh);
  const draw = (i: number) => {
    const box = svgBox(w * k + 4, hh * k + 4, 340);
    box.appendChild(svg('rect', { x: 2, y: 2, width: w * k, height: hh * k, style: 'fill:var(--panel2);stroke:var(--line);stroke-width:1.5' }));
    sq.slice(0, i).forEach((q) => {
      box.appendChild(svg('rect', { x: 2 + q.x * k, y: 2 + q.y * k, width: q.s * k, height: q.s * k, style: `fill:${tint(col(q.s), 55)};stroke:var(--panel);stroke-width:1.5` }));
      if (q.s * k > 18) box.appendChild(svg('text', { x: 2 + (q.x + q.s / 2) * k, y: 2 + (q.y + q.s / 2) * k + 5, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:13px;font-weight:700' }, String(q.s)));
    });
    return h('div', null, box);
  };
  const left = (i: number) => {
    let a = w, b = hh;
    for (const q of sq.slice(0, i)) { if (a >= b) a -= q.s; else b -= q.s; }
    return [a, b];
  };
  return stepper(sq.length + 1, draw, {
    caption: (i) => {
      if (i === 0) return `A ${w} × ${hh} rectangle. Cut off the biggest square you can, again and again.`;
      const [a, b] = left(i);
      return a && b ? `Cut a ${sq[i - 1].s} × ${sq[i - 1].s} square; ${Math.max(a, b)} × ${Math.min(a, b)} left.`
        : `The last square is ${sq[i - 1].s} × ${sq[i - 1].s}, and nothing is left: gcd(${w}, ${hh}) = ${sq[i - 1].s}.`;
    },
    autoplayMs: 900,
  });
}

// ---------------------------------------------------------------- coins

/** Amounts 1..N in rows of `cols`; payable ones filled. */
export function payGrid(coins: number[], N: number, cols: number): HTMLElement {
  const ok = payable(coins, N), sz = Math.min(36, Math.floor(300 / cols));
  return h('div', { style: `display:grid;grid-template-columns:repeat(${cols}, ${sz}px);gap:3px;justify-content:center;margin:6px auto` },
    Array.from({ length: N }, (_, i) => {
      const k = i + 1, on = ok[k];
      return h('div', { style: `height:${Math.min(30, sz)}px;display:grid;place-items:center;border-radius:6px;font-weight:700;font-size:.82rem;font-variant-numeric:tabular-nums;border:1px solid ${on ? C3 : 'var(--line)'};background:${on ? tint(C3, 35) : 'var(--panel)'};${on ? '' : 'color:var(--bad)'}` }, String(k));
    }));
}

/** Tap every amount from 1 to N that can't be paid with the two coins. */
export function unpayableTask(a: number, b: number, N: number): Widget {
  const ok = payable([a, b], N);
  return (ctx) => {
    const picked = new Set<number>();
    const pic = h('div');
    const read = h('div', { class: 'readout' });
    const draw = () => {
      pic.replaceChildren(h('div', { style: 'display:grid;grid-template-columns:repeat(5, minmax(0, 52px));gap:5px;justify-content:center;margin:6px auto' },
        Array.from({ length: N }, (_, i) => {
          const k = i + 1, on = picked.has(k);
          return h('button', { 'data-n': k, style: `height:40px;padding:0;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;border:2px solid ${on ? 'var(--bad)' : 'var(--line)'};background:${on ? tint('var(--bad)', 22) : 'var(--panel)'};color:var(--text);${on ? 'text-decoration:line-through' : ''}`,
            onclick: () => { if (on) picked.delete(k); else picked.add(k); draw(); } }, `${k}¢`);
        })));
      read.textContent = `${picked.size} marked impossible`;
      ctx.solved?.(Array.from({ length: N }, (_, i) => i + 1).every((k) => picked.has(k) === !ok[k]));
    };
    draw();
    return h('div', null, pic, read);
  };
}

// ---------------------------------------------------------------- bases

/** Place-value columns for n in base b: each digit over its column weight. */
export function placeColumns(n: number, b: number, minCols = 1): HTMLElement {
  const ds = n.toString(b).toUpperCase().padStart(minCols, '0').split('');
  const L = ds.length;
  return h('div', { style: `display:grid;grid-template-columns:repeat(${L}, minmax(0, 60px));gap:4px;justify-content:center;margin:8px auto` },
    ds.map((d, i) => {
      const w = b ** (L - 1 - i);
      return h('div', { style: 'text-align:center' },
        h('div', { class: 'muted small', style: 'font-variant-numeric:tabular-nums' }, w.toLocaleString('en-US')),
        h('div', { style: `height:44px;display:grid;place-items:center;border-radius:8px;border:2px solid ${d === '0' ? 'var(--line)' : C1};background:${d === '0' ? 'var(--panel)' : tint(C1, 25)};font-size:1.4rem;font-weight:800` }, d));
    }));
}

/** Set the digits of a base-b number (one counter per column) to make `target`. */
export function placeTask(target: number, b: number, cols: number): Widget {
  return (ctx) => {
    const ds = Array(cols).fill(0) as number[];
    const pic = h('div');
    const read = h('div', { class: 'readout' });
    const draw = () => {
      const val = ds.reduce((s, d, i) => s + d * b ** (cols - 1 - i), 0);
      pic.replaceChildren(h('div', { style: `display:grid;grid-template-columns:repeat(${cols}, minmax(0, 64px));gap:6px;justify-content:center;margin:8px auto` },
        ds.map((d, i) => {
          const set = (v: number) => { ds[i] = (v + b) % b; draw(); };
          return h('div', { style: 'text-align:center;display:grid;gap:3px' },
            h('div', { class: 'muted small' }, (b ** (cols - 1 - i)).toLocaleString('en-US')),
            h('button', { class: 'ghost small-btn', 'data-up': i, 'aria-label': `raise digit ${i + 1}`, onclick: () => set(d + 1) }, '▲'),
            h('div', { style: `height:44px;display:grid;place-items:center;border-radius:8px;border:2px solid ${C1};background:${tint(C1, d ? 28 : 6)};font-size:1.4rem;font-weight:800` }, String(d)),
            h('button', { class: 'ghost small-btn', 'aria-label': `lower digit ${i + 1}`, onclick: () => set(d - 1) }, '▼'));
        })));
      read.textContent = `${ds.join('')} in base ${b} = ${ds.map((d, i) => `${d}×${b ** (cols - 1 - i)}`).join(' + ')} = ${val}` + (val === target ? '  ✓' : `   (target ${target})`);
      ctx.solved?.(val === target);
    };
    draw();
    return h('div', null, pic, read);
  };
}

// ---------------------------------------------------------------- tables

/** A small table of numbers, cells tinted by value (0..n-1); `mark` picks cells to ring. */
export function heatTable(rowHead: string[], colHead: string[], val: (r: number, c: number) => number, n: number, opts: { corner?: string; mark?: (v: number) => boolean } = {}): HTMLElement {
  const cols = colHead.length + 1;
  const cell = (t: string, st: string) => h('div', { style: `height:30px;display:grid;place-items:center;border-radius:5px;font-weight:700;font-size:.85rem;font-variant-numeric:tabular-nums;${st}` }, t);
  const kids: HTMLElement[] = [cell(opts.corner ?? '', 'color:var(--muted)')];
  colHead.forEach((c) => kids.push(cell(c, 'color:var(--muted)')));
  rowHead.forEach((rh, r) => {
    kids.push(cell(rh, 'color:var(--muted)'));
    colHead.forEach((_, c) => {
      const v = val(r, c), m = opts.mark?.(v);
      kids.push(cell(String(v), `background:color-mix(in srgb, ${C1} ${Math.round(8 + (62 * v) / Math.max(1, n - 1))}%, var(--panel));${m ? `outline:2px solid ${C2};outline-offset:-2px` : ''}`));
    });
  });
  return h('div', { style: `display:grid;grid-template-columns:repeat(${cols}, minmax(0, 38px));gap:3px;justify-content:center;margin:6px auto` }, kids);
}

/** Digits in a row, each with a caption under it (weights, doubled values, …); hi = indices tinted. */
export function digitRow(rows: { label: string; cells: (string | number)[] }[], hi: number[] = []): HTMLElement {
  const n = rows[0].cells.length;
  const kids: HTMLElement[] = [];
  rows.forEach((row, r) => {
    kids.push(h('div', { class: 'muted small', style: 'display:grid;align-items:center;white-space:nowrap;padding-right:4px' }, row.label));
    row.cells.forEach((v, i) => kids.push(h('div', { style: `height:28px;display:grid;place-items:center;border-radius:5px;font-weight:${r === 0 ? 800 : 600};font-size:.85rem;font-variant-numeric:tabular-nums;${hi.includes(i) ? `background:${tint(C2, 30)}` : r === 0 ? 'background:var(--panel2)' : ''}` }, String(v))));
  });
  return h('div', { style: `display:grid;grid-template-columns:auto repeat(${n}, minmax(0, 24px));gap:2px;justify-content:center;margin:6px auto;overflow-x:auto` }, kids);
}

/** The Luhn working for a digit string: doubled positions tinted, then the digit sum. */
export function luhnTable(d: number[]): HTMLElement {
  const dbl = d.map((_, i) => (d.length - 1 - i) % 2 === 1);
  const vals = d.map((v, i) => (dbl[i] ? (2 * v > 9 ? 2 * v - 9 : 2 * v) : v));
  return h('div', null,
    digitRow([{ label: 'digit', cells: d }, { label: 'use', cells: vals }], dbl.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)),
    h('div', { class: 'readout' }, `sum = ${luhnSum(d)} → ${luhnSum(d) % 10 === 0 ? 'ends in 0: valid' : 'doesn’t end in 0: invalid'}`));
}

/** Pick the last digit (0-9) so that `valid` passes. */
export function checkDigitTask(prefix: number[], valid: (d: number[]) => boolean, show: (d: number[]) => Node): Widget {
  return (ctx) => {
    let last = -1;
    const pic = h('div');
    const draw = () => {
      const full = [...prefix, Math.max(0, last)];
      pic.replaceChildren(
        h('div', { style: 'text-align:center;font-size:1.25rem;font-weight:800;letter-spacing:.06em;font-variant-numeric:tabular-nums;margin:6px 0' },
          prefix.join(''), h('span', { style: `color:${C2};border-bottom:3px solid ${C2};padding:0 2px` }, last < 0 ? '?' : String(last))),
        last < 0 ? h('div', { class: 'readout' }, 'Pick a last digit.') : show(full),
        h('div', { class: 'w-btns', style: 'justify-content:center' },
          Array.from({ length: 10 }, (_, k) => h('button', { class: 'ghost small-btn', 'data-digit': k, style: k === last ? `border-color:${C2};background:${tint(C2, 25)}` : '', onclick: () => { last = k; draw(); } }, String(k)))));
      ctx.solved?.(last >= 0 && valid(full));
    };
    draw();
    return pic;
  };
}
