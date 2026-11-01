// Pictures and puzzles for the Mathematical Thinking course: dot figures, Gauss's pairing, chessboards
// and domino colouring, pigeonholes, a prime sieve, the Tower of Hanoi, falling dominoes and a
// "reach the target" puzzle. Tasks report through ctx.solved. Colours come from the theme variables.
import type { Widget } from '../types';
import { h, svg } from '../ui';

const C1 = 'var(--c1)', C2 = 'var(--c2)', C3 = 'var(--c3)', C4 = 'var(--c4)';

function svgBox(w: number, hgt: number, maxW = 420): SVGElement {
  return svg('svg', { viewBox: `0 0 ${w} ${hgt}`, width: '100%', style: `max-width:${maxW}px;display:block;margin:4px auto;height:auto` });
}

// ---------------------------------------------------------------- number helpers

export function isPrime(n: number): boolean {
  if (n < 2 || !Number.isInteger(n)) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** Prime factors with repetition, smallest first: 60 -> [2, 2, 3, 5]. */
export function factor(n: number): number[] {
  const out: number[] = [];
  for (let d = 2; d * d <= n; d++) while (n % d === 0) { out.push(d); n /= d; }
  if (n > 1) out.push(n);
  return out;
}

/** Optimal Tower of Hanoi moves for n disks from peg a to peg c. */
export function hanoiMoves(n: number, a = 0, b = 1, c = 2): [number, number][] {
  if (n === 0) return [];
  return [...hanoiMoves(n - 1, a, c, b), [a, c], ...hanoiMoves(n - 1, b, a, c)];
}

// ---------------------------------------------------------------- figurate numbers

/** A triangle of dots: rows 1..n. */
export function triDots(n: number, opts: { color?: string; last?: string } = {}): HTMLElement {
  const r = 7, gap = 20, W = Math.max(n, 4) * gap + 20, H = n * gap * 0.9 + 20;
  const s = svgBox(W, H, Math.min(360, W * 1.6));
  for (let row = 0; row < n; row++) {
    for (let k = 0; k <= row; k++) {
      const x = W / 2 + (k - row / 2) * gap, y = 14 + row * gap * 0.9;
      const fill = row === n - 1 && opts.last ? opts.last : opts.color ?? C1;
      s.appendChild(svg('circle', { cx: x, cy: y, r, style: `fill:${fill}` }));
    }
  }
  return h('div', null, s);
}

/** Several triangles side by side with their counts underneath. */
export function triRow(ns: number[]): HTMLElement {
  return h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:flex-end' },
    ns.map((n) => h('div', { style: 'text-align:center;min-width:56px' }, triDots(n, { last: C2 }),
      h('div', { class: 'muted small' }, String((n * (n + 1)) / 2)))));
}

/** An n x n square split into L-shaped layers 1, 3, 5, ... in alternating colours. */
export function oddLayers(n: number, size = 9): HTMLElement {
  const cs = 26, W = size * cs + 4;
  const s = svgBox(W, W, 300);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const layer = Math.max(r, c);
    if (layer >= n) {
      s.appendChild(svg('rect', { x: 2 + c * cs, y: 2 + (size - 1 - r) * cs, width: cs - 3, height: cs - 3, rx: 4, style: 'fill:none;stroke:var(--line);stroke-width:1.5' }));
      continue;
    }
    s.appendChild(svg('rect', { x: 2 + c * cs, y: 2 + (size - 1 - r) * cs, width: cs - 3, height: cs - 3, rx: 4,
      style: `fill:${layer % 2 ? C2 : C1};opacity:${layer === n - 1 ? 1 : 0.75}` }));
  }
  return h('div', null, s);
}

/** Two staircases of 1..n blocks fitting together into an n x (n+1) rectangle. */
export function staircase(n: number): HTMLElement {
  const cs = Math.min(30, Math.floor(300 / (n + 1)));
  const W = (n + 1) * cs + 4, H = n * cs + 4;
  const s = svgBox(W, H, Math.min(340, W * 1.4));
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) {
    const mine = c <= r; // row r of the first staircase has r + 1 blocks
    s.appendChild(svg('rect', { x: 2 + c * cs, y: 2 + r * cs, width: cs - 3, height: cs - 3, rx: 3, style: `fill:${mine ? C1 : C2}` }));
  }
  return h('div', null, s);
}

/** (a + b)^2 as a square cut into a^2, b^2 and two a x b rectangles. */
export function binomialSquare(a: number, b: number): HTMLElement {
  const cs = 26, n = a + b, W = n * cs + 4;
  const s = svgBox(W, W, 300);
  const part = (x0: number, y0: number, w: number, hh: number, fill: string, label: string) => {
    if (w <= 0 || hh <= 0) return;
    s.appendChild(svg('rect', { x: 2 + x0 * cs, y: 2 + y0 * cs, width: w * cs - 2, height: hh * cs - 2, rx: 4, style: `fill:${fill};opacity:.85` }));
    for (let i = 1; i < w; i++) s.appendChild(svg('line', { x1: 2 + (x0 + i) * cs - 1, y1: 2 + y0 * cs, x2: 2 + (x0 + i) * cs - 1, y2: 2 + (y0 + hh) * cs - 2, style: 'stroke:var(--panel);stroke-width:1;opacity:.6' }));
    for (let i = 1; i < hh; i++) s.appendChild(svg('line', { x1: 2 + x0 * cs, y1: 2 + (y0 + i) * cs - 1, x2: 2 + (x0 + w) * cs - 2, y2: 2 + (y0 + i) * cs - 1, style: 'stroke:var(--panel);stroke-width:1;opacity:.6' }));
    s.appendChild(svg('text', { x: 2 + (x0 + w / 2) * cs, y: 2 + (y0 + hh / 2) * cs + 6, 'text-anchor': 'middle',
      style: 'fill:#fff;font-weight:700;font-size:16px;paint-order:stroke;stroke:rgba(0,0,0,.35);stroke-width:3px' }, label));
  };
  part(0, 0, a, a, C1, `${a}²`);
  part(a, 0, b, a, C3, `${a}×${b}`);
  part(0, a, a, b, C3, `${a}×${b}`);
  part(a, a, b, b, C2, `${b}²`);
  return h('div', null, s);
}

// ---------------------------------------------------------------- Gauss pairing

/** 1..n on top, n..1 underneath, and the column sums. */
export function gaussRows(n: number): HTMLElement {
  const cell = (v: string | number, style = '') => h('div', { style: `display:grid;place-items:center;height:30px;border-radius:6px;font-weight:700;font-variant-numeric:tabular-nums;font-size:.9rem;${style}` }, String(v));
  const cols = `grid-template-columns:repeat(${n}, minmax(0, 1fr))`;
  const row = (vals: (number | string)[], style: string) => h('div', { style: `display:grid;gap:3px;${cols};margin:3px 0` }, vals.map((v) => cell(v, style)));
  const up = Array.from({ length: n }, (_, i) => i + 1);
  return h('div', { style: 'max-width:440px;margin:0 auto' },
    row(up, `background:color-mix(in srgb, ${C1} 25%, var(--panel))`),
    row(up.slice().reverse(), `background:color-mix(in srgb, ${C2} 25%, var(--panel))`),
    h('div', { style: 'border-top:2px solid var(--line);margin:4px 0' }),
    row(up.map(() => n + 1), 'color:var(--good)'),
    h('div', { class: 'readout' }, `${n} columns × ${n + 1} = ${n * (n + 1)} = twice the sum, so the sum is ${(n * (n + 1)) / 2}`));
}

// ---------------------------------------------------------------- boards

// Fixed wood colours so "dark" and "light" squares mean the same thing in both themes.
const DARK = '#9b7653';
const LIGHT = '#eadbc2';

/** A chessboard; removed cells are blank, marks maps "r,c" -> text. */
export function board(n: number, opts: { removed?: string[]; marks?: Record<string, string>; hi?: string[]; size?: number } = {}): HTMLElement {
  const sz = opts.size ?? Math.min(40, Math.floor(320 / n));
  return h('div', { style: `display:grid;grid-template-columns:repeat(${n}, ${sz}px);gap:1px;justify-content:center;margin:6px auto` },
    Array.from({ length: n * n }, (_, i) => {
      const r = Math.floor(i / n), c = i % n, key = `${r},${c}`;
      const gone = opts.removed?.includes(key);
      const dark = (r + c) % 2 === 1;
      const hi = opts.hi?.includes(key);
      return h('div', { style: `height:${sz}px;display:grid;place-items:center;font-size:${Math.round(sz * 0.55)}px;font-weight:700;border-radius:2px;`
        + (gone ? 'background:transparent;outline:1px dashed var(--line);color:var(--bad)' : `background:${hi ? `color-mix(in srgb, ${C2} 70%, ${dark ? DARK : LIGHT})` : dark ? DARK : LIGHT};color:${dark ? '#fff' : '#2a2118'}`) },
        gone ? '×' : opts.marks?.[key] ?? '');
    }));
}

/** Tap two squares of a 4x4 board to remove them so that dominoes can still cover the rest. */
export const removeTwoTask: Widget = (ctx) => {
  const n = 4;
  const removed: string[] = [];
  const pic = h('div');
  const read = h('div', { class: 'readout' });
  const draw = () => {
    const sz = 52;
    pic.replaceChildren(h('div', { style: `display:grid;grid-template-columns:repeat(${n}, ${sz}px);gap:2px;justify-content:center;margin:6px auto` },
      Array.from({ length: n * n }, (_, i) => {
        const r = Math.floor(i / n), c = i % n, key = `${r},${c}`, dark = (r + c) % 2 === 1, gone = removed.includes(key);
        return h('button', { 'data-cell': key, 'aria-label': `square ${r + 1},${c + 1}`,
          style: `height:${sz}px;padding:0;border-radius:4px;border:1px solid var(--line);font-size:1.3rem;cursor:pointer;`
            + (gone ? 'background:transparent;border-style:dashed;color:var(--bad)' : `background:${dark ? DARK : LIGHT};color:#2a2118`),
          onclick: () => {
            const k = removed.indexOf(key);
            if (k >= 0) removed.splice(k, 1);
            else { if (removed.length === 2) removed.shift(); removed.push(key); }
            draw();
          } }, gone ? '×' : '');
      })));
    const dk = removed.filter((k) => { const [r, c] = k.split(',').map(Number); return (r + c) % 2 === 1; }).length;
    const darkLeft = 8 - dk, lightLeft = 8 - (removed.length - dk);
    read.textContent = `Left: ${darkLeft} dark, ${lightLeft} light` + (removed.length < 2 ? ` · tap ${2 - removed.length} more` : darkLeft === lightLeft ? ' · balanced' : ' · unbalanced');
    ctx.solved?.(removed.length === 2 && darkLeft === lightLeft);
  };
  draw();
  return h('div', null, pic, read);
};

// ---------------------------------------------------------------- pigeonholes

/** Boxes with items in them (worst-case filling of `n` items into k boxes, or given counts). */
export function pigeonBoxes(counts: number[], opts: { labels?: string[]; colors?: string[]; glyph?: string } = {}): HTMLElement {
  const max = Math.max(...counts);
  return h('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:6px 0' },
    counts.map((c, k) => h('div', { style: `width:58px;border:2px solid ${c >= 2 ? 'var(--good)' : 'var(--line)'};border-top:none;border-radius:0 0 10px 10px;padding:4px 2px;min-height:${Math.max(3, max) * 18 + 10}px;display:flex;flex-direction:column-reverse;align-items:center;gap:2px` },
      h('div', { class: 'muted small', style: 'order:-1' }, opts.labels?.[k] ?? ''),
      Array.from({ length: c }, () => h('div', { style: `width:30px;height:16px;border-radius:8px;background:${opts.colors?.[k] ?? C1};display:grid;place-items:center;font-size:11px;color:#fff` }, opts.glyph ?? '')))));
}

// ---------------------------------------------------------------- primes

/** Numbers 1..n in a grid; crossed numbers are dimmed and struck through, circled ones highlighted. */
export function numberGrid(n: number, look: (k: number) => 'plain' | 'crossed' | 'prime' | 'now', cols = 10): HTMLElement {
  return h('div', { style: `display:grid;grid-template-columns:repeat(${cols}, minmax(0, 34px));gap:3px;justify-content:center;margin:6px auto` },
    Array.from({ length: n }, (_, i) => {
      const k = i + 1, l = look(k);
      const st = l === 'crossed' ? 'opacity:.35;text-decoration:line-through;background:var(--panel2)'
        : l === 'prime' ? `background:color-mix(in srgb, ${C3} 30%, var(--panel));border-color:${C3}`
        : l === 'now' ? `background:color-mix(in srgb, ${C4} 30%, var(--panel));border-color:${C4}`
        : 'background:var(--panel)';
      return h('div', { style: `height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:6px;font-weight:600;font-size:.85rem;font-variant-numeric:tabular-nums;${st}` }, String(k));
    }));
}

/** Sieve of Eratosthenes up to n, one frame per prime p with p*p <= n, plus start and end. */
export function sieveFrames(n: number): { primes: number[]; render: (i: number) => Node; caption: (i: number) => string; frames: number } {
  const ps: number[] = [];
  for (let p = 2; p * p <= n; p++) if (isPrime(p)) ps.push(p);
  const frames = ps.length + 2;
  const render = (i: number) => numberGrid(n, (k) => {
    if (i === 0) return 'plain';
    if (k === 1) return 'crossed';
    if (i === frames - 1) return isPrime(k) ? 'prime' : 'crossed';
    const used = ps.slice(0, i), p = ps[i - 1];
    if (used.includes(k)) return 'prime';
    if (k % p === 0) return 'now';
    if (used.some((q) => k % q === 0)) return 'crossed';
    return 'plain';
  });
  const caption = (i: number) => i === 0 ? `The numbers 1 to ${n}. (1 is not prime.)`
    : i === frames - 1 ? `Everything left is prime: ${Array.from({ length: n }, (_, k) => k + 1).filter(isPrime).length} primes up to ${n}.`
    : `Keep ${ps[i - 1]}; cross out its multiples ${ps[i - 1] * 2}, ${ps[i - 1] * 3}, …`;
  return { primes: ps, render, caption, frames };
}

/** Tap every prime from 1 to n. */
export function primeTapTask(n: number): Widget {
  return (ctx) => {
    const picked = new Set<number>();
    const pic = h('div');
    const read = h('div', { class: 'readout' });
    const draw = () => {
      pic.replaceChildren(h('div', { style: 'display:grid;grid-template-columns:repeat(6, minmax(0, 46px));gap:4px;justify-content:center;margin:6px auto' },
        Array.from({ length: n }, (_, i) => {
          const k = i + 1, on = picked.has(k);
          return h('button', { 'data-n': k, style: `height:40px;padding:0;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;border:2px solid ${on ? C3 : 'var(--line)'};background:${on ? `color-mix(in srgb, ${C3} 30%, var(--panel))` : 'var(--panel)'};color:var(--text)`,
            onclick: () => { if (on) picked.delete(k); else picked.add(k); draw(); } }, String(k));
        })));
      read.textContent = `${picked.size} picked`;
      const all = Array.from({ length: n }, (_, i) => i + 1);
      ctx.solved?.(all.every((k) => picked.has(k) === isPrime(k)));
    };
    draw();
    return h('div', null, pic, read);
  };
}

// ---------------------------------------------------------------- Tower of Hanoi

const DISK = [C1, C2, C3, C4, 'var(--c5)', 'var(--c6)'];

/** Picture of three pegs; pegs[p] lists disk sizes bottom to top (1 = smallest). */
export function hanoiPic(pegs: number[][], n: number, sel = -1): SVGElement {
  const W = 330, H = 30 + n * 18 + 26, pw = W / 3;
  const s = svgBox(W, H, 420);
  s.appendChild(svg('rect', { x: 4, y: H - 14, width: W - 8, height: 8, rx: 3, style: 'fill:var(--muted);opacity:.5' }));
  pegs.forEach((peg, p) => {
    const cx = pw * p + pw / 2;
    s.appendChild(svg('rect', { x: cx - 3, y: 18, width: 6, height: H - 32, rx: 3, style: `fill:${sel === p ? 'var(--c2)' : 'var(--muted)'};opacity:.7` }));
    s.appendChild(svg('text', { x: cx, y: 12, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:12px;font-weight:700' }, 'ABC'[p]));
    peg.forEach((d, k) => {
      const w = 22 + (d * (pw - 30)) / n;
      const y = H - 14 - (k + 1) * 18;
      const lift = sel === p && k === peg.length - 1 ? -6 : 0;
      s.appendChild(svg('rect', { x: cx - w / 2, y: y + 1 + lift, width: w, height: 16, rx: 7, style: `fill:${DISK[(d - 1) % DISK.length]}` }));
    });
  });
  return s;
}

/** Hanoi states after each optimal move. */
export function hanoiStates(n: number): number[][][] {
  const st: number[][][] = [[Array.from({ length: n }, (_, i) => n - i), [], []]];
  for (const [a, c] of hanoiMoves(n)) {
    const cur = st[st.length - 1].map((p) => p.slice());
    cur[c].push(cur[a].pop()!);
    st.push(cur);
  }
  return st;
}

/** Play the Tower of Hanoi: tap a peg to lift its top disk, tap another to drop it. */
export function hanoiTask(n: number): Widget {
  return (ctx) => {
    let pegs: number[][] = [Array.from({ length: n }, (_, i) => n - i), [], []];
    let sel = -1, moves = 0;
    const pic = h('div');
    const read = h('div', { class: 'readout' });
    const best = 2 ** n - 1;
    const draw = (msg = '') => {
      const s = hanoiPic(pegs, n, sel);
      const el = h('div', { style: 'position:relative' }, s,
        h('div', { style: 'position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr)' },
          [0, 1, 2].map((p) => h('button', { 'data-peg': p, 'aria-label': `peg ${'ABC'[p]}`, style: 'background:transparent;border:none;padding:0;cursor:pointer', onclick: () => tap(p) }))));
      pic.replaceChildren(el);
      const done = pegs[2].length === n;
      read.textContent = msg || (done ? `Done in ${moves} moves${moves === best ? ' (the minimum!)' : ''}.` : `Moves: ${moves}${sel >= 0 ? ' · now tap where it goes' : ''}`);
      ctx.solved?.(done);
    };
    const tap = (p: number) => {
      if (pegs[2].length === n) return;
      if (sel < 0) { if (pegs[p].length) sel = p; draw(); return; }
      if (p === sel) { sel = -1; draw(); return; }
      const d = pegs[sel][pegs[sel].length - 1], top = pegs[p][pegs[p].length - 1];
      if (top !== undefined && top < d) { sel = -1; draw('A bigger disk can’t go on a smaller one.'); return; }
      pegs[p].push(pegs[sel].pop()!);
      sel = -1; moves++; draw();
    };
    const reset = h('button', { class: 'ghost small-btn', onclick: () => { pegs = [Array.from({ length: n }, (_, i) => n - i), [], []]; sel = -1; moves = 0; draw(); } }, '↺ Start over');
    draw();
    return h('div', null, pic, read, h('div', { class: 'w-btns', style: 'justify-content:center' }, reset));
  };
}

// ---------------------------------------------------------------- dominoes

/** A row of n dominoes, the first `fallen` of them knocked over. */
export function dominoRow(n: number, fallen: number): SVGElement {
  const gap = 30, W = n * gap + 40, H = 90;
  const s = svgBox(W, H, 440);
  s.appendChild(svg('line', { x1: 0, y1: H - 10, x2: W, y2: H - 10, style: 'stroke:var(--muted);stroke-width:2' }));
  for (let k = 0; k < n; k++) {
    const x = 20 + k * gap, down = k < fallen;
    const g = svg('g', { transform: `translate(${x} ${H - 10}) rotate(${down ? (k === n - 1 ? 80 : 62) : 0})` });
    g.appendChild(svg('rect', { x: -5, y: -56, width: 10, height: 56, rx: 2, style: `fill:${down ? C2 : C1}` }));
    s.appendChild(g);
    s.appendChild(svg('text', { x, y: H, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:10px' }, String(k + 1)));
  }
  return s;
}

// ---------------------------------------------------------------- reach the target

/** Fewest moves from 1 to t using +1 and x2 (work backwards: halve when even, else subtract 1). */
export function fewestMoves(t: number): number {
  let m = 0;
  while (t > 1) { t = t % 2 ? t - 1 : t / 2; m++; }
  return m;
}

/** Start at 1; buttons +1 and x2; reach the target in the fewest moves. */
export function reachTask(target: number): Widget {
  const best = fewestMoves(target);
  return (ctx) => {
    let chain = [1];
    const pic = h('div');
    const read = h('div', { class: 'readout' });
    const draw = () => {
      const cur = chain[chain.length - 1];
      pic.replaceChildren(h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;min-height:40px' },
        chain.map((v, k) => [k ? h('span', { class: 'muted' }, '→') : null,
          h('span', { class: 'chip', style: k === chain.length - 1 ? `border-color:${v === target ? 'var(--good)' : v > target ? 'var(--bad)' : C1};font-size:1.05rem` : '' }, String(v))])));
      const moves = chain.length - 1;
      read.textContent = cur === target ? (moves === best ? `${target} in ${moves} moves: as few as possible.` : `${target} in ${moves} moves. Can you do it in fewer?`)
        : cur > target ? `Past ${target}: undo.` : `Moves: ${moves} · target ${target}`;
      ctx.solved?.(cur === target && moves === best);
    };
    const push = (f: (v: number) => number) => { chain.push(f(chain[chain.length - 1])); draw(); };
    const btns = h('div', { class: 'w-btns', style: 'justify-content:center' },
      h('button', { class: 'ghost', 'data-op': 'add', onclick: () => push((v) => v + 1) }, '+1'),
      h('button', { class: 'ghost', 'data-op': 'dbl', onclick: () => push((v) => v * 2) }, '×2'),
      h('button', { class: 'ghost', onclick: () => { if (chain.length > 1) chain.pop(); draw(); } }, 'Undo'),
      h('button', { class: 'ghost', onclick: () => { chain = [1]; draw(); } }, 'Reset'));
    draw();
    return h('div', null, pic, read, btns);
  };
}

/** A left-to-right chain of values with operation labels on the arrows. */
export function opChain(vals: (number | string)[], ops: string[], opts: { hi?: number; back?: boolean } = {}): HTMLElement {
  return h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;margin:8px 0' },
    vals.map((v, k) => [
      k ? h('span', { style: 'display:inline-flex;flex-direction:column;align-items:center;font-size:.78rem;color:var(--muted);padding:0 2px' },
        h('span', null, ops[k - 1]), h('span', { style: 'font-size:1rem' }, opts.back ? '←' : '→')) : null,
      h('span', { class: 'chip', style: `font-size:1.05rem;${opts.hi === k ? `border-color:${C2};background:color-mix(in srgb, ${C2} 22%, var(--panel))` : ''}` }, String(v)),
    ]));
}

/** Big centred line of text, e.g. for an explorer readout picture. */
export function bigLine(text: string, color = 'var(--text)', sub = ''): HTMLElement {
  return h('div', { style: 'text-align:center;margin:10px 0' },
    h('div', { style: `font-size:1.35rem;font-weight:800;font-variant-numeric:tabular-nums;color:${color}` }, text),
    sub ? h('div', { class: 'muted small', style: 'margin-top:4px' }, sub) : null);
}
