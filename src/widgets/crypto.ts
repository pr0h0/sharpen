// Interactive pieces for "Information & Cryptography": bit strings, a guess-the-number game against
// a sneaky opponent, binary switches, a prefix-code builder with its code tree, a parity grid with
// one flipped bit, a Caesar wheel, a substitution-cipher solver, a toy hash (with an avalanche view
// and a "mining" task), modular clocks, and paint mixing for Diffie–Hellman.
// Everything here is a TOY for learning: none of it is secure.
import type { Widget } from '../types';
import { h, svg } from '../ui';
import { barChart } from '../viz/charts';
import { stepper } from '../viz/explore';

const MONO = 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;';
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, var(--panel))`;

// ---------------------------------------------------------------- shared maths (used by the course too)

export const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Shift every letter by k (wrapping Z to A); other characters stay. */
export function caesar(s: string, k: number): string {
  return s.replace(/[A-Z]/g, (ch) => ALPHA[(((ch.charCodeAt(0) - 65 + k) % 26) + 26) % 26]);
}

/** Apply a substitution key: key[i] is the cipher letter for plain letter ALPHA[i]. */
export function substitute(s: string, key: string): string {
  return s.replace(/[A-Z]/g, (ch) => key[ch.charCodeAt(0) - 65]);
}

/** Letter counts of the A-Z letters in s, most common first. */
export function letterCounts(s: string): [string, number][] {
  const m = new Map<string, number>();
  for (const ch of s) if (ch >= 'A' && ch <= 'Z') m.set(ch, (m.get(ch) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * TOY 16-bit hash (FNV-1a over the characters, then a mixing step, folded to 16 bits). It scrambles
 * well enough to show the avalanche effect, but 16 bits is tiny: collisions take seconds to find.
 */
export function toyHash(s: string): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x ^ (x >>> 16)) & 0xffff;
}

export const toBits = (v: number, width: number) => v.toString(2).padStart(width, '0').slice(-width);
export const hex4 = (v: number) => v.toString(16).toUpperCase().padStart(4, '0');

/** b^e mod m by repeated squaring (small numbers only: stays well inside double precision). */
export function modPow(b: number, e: number, m: number): number {
  let r = 1 % m, x = ((b % m) + m) % m, k = e;
  while (k > 0) {
    if (k & 1) r = (r * x) % m;
    x = (x * x) % m;
    k = Math.floor(k / 2);
  }
  return r;
}

// ---------------------------------------------------------------- bit strings

/**
 * A wrapping row of small bit boxes. hi: indices tinted (c1), bad: indices marked red,
 * dim: faded, group: a gap after every `group` bits, labels: tiny text under each bit.
 */
export function bits(s: string, opts: { hi?: number[]; bad?: number[]; dim?: number[]; good?: number[]; group?: number; labels?: string[]; size?: number; onBit?: (i: number) => void } = {}): HTMLElement {
  const sz = opts.size ?? 28;
  const chars = [...s];
  return h('div', { style: `display:flex;flex-wrap:wrap;justify-content:center;gap:${sz < 20 ? 2 : 4}px;margin:6px 0;` },
    chars.map((ch, i) => {
      const bad = opts.bad?.includes(i), hi = opts.hi?.includes(i), good = opts.good?.includes(i);
      const border = bad ? 'var(--bad)' : good ? 'var(--good)' : hi ? 'var(--c1)' : 'var(--line)';
      const bg = bad ? 'var(--bad-bg)' : good ? 'var(--good-bg)' : hi ? tint('var(--c1)', 22) : 'var(--panel2)';
      const gap = opts.group && (i + 1) % opts.group === 0 && i < chars.length - 1 ? `margin-right:${sz < 20 ? 5 : Math.round(sz / 3)}px;` : '';
      const box = h(opts.onBit ? 'button' : 'div', {
        style: `${MONO}width:${sz}px;height:${sz}px;padding:0;display:grid;place-items:center;border:2px solid ${border};border-radius:6px;background:${bg};color:var(--text);font-weight:700;font-size:${Math.round(sz * (sz < 20 ? 0.62 : 0.5))}px;${opts.dim?.includes(i) ? 'opacity:.35;' : ''}`,
        onclick: opts.onBit ? () => opts.onBit!(i) : undefined,
        'aria-label': opts.onBit ? `bit ${i + 1}` : undefined,
      }, ch);
      return opts.labels ? h('div', { style: `display:grid;justify-items:center;gap:1px;${gap}` }, box, h('span', { style: 'font-size:.7rem;color:var(--muted);' }, opts.labels[i] ?? '')) : (gap ? h('div', { style: gap }, box) : box);
    }));
}

/** Several labelled rows of bits (or text), aligned in a column. */
export function bitRows(rows: { label: string; bits: string; hi?: number[]; bad?: number[]; group?: number }[], size = 24): HTMLElement {
  return h('div', { style: 'display:grid;gap:4px;' }, rows.map((r) =>
    h('div', { style: 'display:grid;gap:0;justify-items:center;' },
      h('div', { style: 'font-size:.8rem;color:var(--muted);font-weight:600;' }, r.label),
      bits(r.bits, { hi: r.hi, bad: r.bad, group: r.group, size }))));
}

// ---------------------------------------------------------------- 20 questions

/**
 * Guess my number from 1 to n with "Is it more than X?" questions. The opponent is sneaky: it never
 * commits to a number, it just answers so that as many numbers as possible stay possible (always
 * honestly consistent). Solved when the learner pins the number down within `max` questions.
 */
export function guessGame(o: { n: number; max: number }): Widget {
  return (ctx) => {
    let lo = 1, hi = o.n, asked = 0;
    const log: string[] = [];
    const root = h('div');
    const draw = () => {
      const left = hi - lo + 1;
      const cols = 20;
      const grid = h('div', { style: `display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px;max-width:340px;margin:6px auto;` },
        Array.from({ length: o.n }, (_, i) => {
          const v = i + 1, on = v >= lo && v <= hi;
          return h('span', { style: `aspect-ratio:1;border-radius:3px;font-size:7px;display:grid;place-items:center;background:${on ? 'var(--c1)' : 'var(--panel2)'};color:${on ? '#fff' : 'var(--muted)'};` }, (v % 10 === 0 || (on && left <= 4)) ? String(v) : '');
        }));
      const status = h('div', { class: 'readout' }, left === 1 ? `It's ${lo}! You used ${asked} question${asked === 1 ? '' : 's'}.` : `Still possible: ${lo} to ${hi} (${left} number${left === 1 ? '' : 's'}) · questions used: ${asked}`);
      const kids: Node[] = [grid, status];
      if (left > 1) {
        let x = lo;
        const val = h('strong', { style: 'font-variant-numeric:tabular-nums;min-width:2.2em;display:inline-block;text-align:center;' }, String(x));
        const sl = h('input', { type: 'range', min: lo, max: hi - 1, step: 1, value: lo, 'aria-label': 'threshold', style: 'width:100%;accent-color:var(--accent-default);' });
        const setX = (v: number) => { x = Math.max(lo, Math.min(hi - 1, v)); sl.value = String(x); val.textContent = String(x); };
        sl.addEventListener('input', () => setX(Number(sl.value)));
        const ask = () => {
          asked++;
          const yesCount = hi - x, noCount = x - lo + 1;
          const yes = yesCount === noCount ? Math.random() < 0.5 : yesCount > noCount; // keep the bigger half alive
          log.push(`Is it more than ${x}? ${yes ? 'Yes' : 'No'}.`);
          if (yes) lo = x + 1; else hi = x;
          draw();
        };
        kids.push(h('div', { style: 'display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin-top:6px;' },
          h('span', null, 'Is it more than'), h('button', { class: 'ghost small-btn', onclick: () => setX(x - 1), 'aria-label': 'minus one' }, '−'), val,
          h('button', { class: 'ghost small-btn', onclick: () => setX(x + 1), 'aria-label': 'plus one' }, '+'), h('span', null, '?')),
        sl, h('div', { style: 'text-align:center;margin-top:6px;' }, h('button', { class: 'ghost', onclick: ask, 'data-ask': '1' }, 'Ask')));
      } else {
        const ok = asked <= o.max;
        kids.push(h('div', { class: ok ? 'goal-ok' : 'w-msg', style: ok ? '' : 'text-align:center;color:var(--bad);font-weight:600;' },
          ok ? `✓ Found in ${asked}. No strategy can promise fewer.` : `That took ${asked}. Can you do it in ${o.max} or fewer?`));
        kids.push(h('div', { style: 'text-align:center;' }, h('button', { class: 'ghost small-btn', onclick: () => { lo = 1; hi = o.n; asked = 0; log.length = 0; draw(); } }, 'New game')));
        ctx.solved?.(ok);
      }
      if (log.length) kids.push(h('div', { class: 'muted small', style: 'margin-top:6px;text-align:center;' }, log.slice(-3).join('  ')));
      root.replaceChildren(...kids);
    };
    draw();
    return root;
  };
}

/** Halving picture: how many numbers are still possible after each perfect yes/no question. */
export function halving(n: number): HTMLElement {
  const sizes = [n];
  while (sizes[sizes.length - 1] > 1) sizes.push(Math.ceil(sizes[sizes.length - 1] / 2));
  return stepper(sizes.length, (i) => h('div', { style: 'display:grid;gap:4px;' },
    sizes.slice(0, i + 1).map((s, k) => h('div', { style: 'display:grid;grid-template-columns:5.5em 1fr 2.6em;gap:8px;align-items:center;font-size:.9rem;' },
      h('span', { class: 'muted', style: 'text-align:right;' }, k === 0 ? 'start' : `after ${k}`),
      h('span', { style: 'height:16px;background:var(--panel2);border-radius:5px;overflow:hidden;' },
        h('span', { style: `display:block;height:100%;width:${(s / n) * 100}%;min-width:3px;background:${k === i ? 'var(--c2)' : 'var(--c1)'};border-radius:5px;` })),
      h('strong', { style: 'font-variant-numeric:tabular-nums;' }, String(s))))),
  { caption: (i) => i === 0 ? `${n} possibilities before any question.` : i === sizes.length - 1 ? `Down to one after ${i} questions.` : `At most ${sizes[i]} left after ${i} question${i === 1 ? '' : 's'}.` });
}

// ---------------------------------------------------------------- binary

/** Place-value boxes for a number in binary. */
export function placeValues(v: number, width: number, opts: { hi?: boolean } = {}): HTMLElement {
  const b = toBits(v, width);
  const labels = Array.from({ length: width }, (_, i) => String(2 ** (width - 1 - i)));
  return bits(b, { labels, hi: opts.hi === false ? [] : [...b].map((c, i) => (c === '1' ? i : -1)).filter((i) => i >= 0), size: 34 });
}

/** Tap bits to switch them; solved when the bits spell `target` in binary. */
export function binarySwitches(o: { target: number; width: number }): Widget {
  return (ctx) => {
    const on = Array<boolean>(o.width).fill(false);
    const root = h('div');
    const draw = () => {
      const s = on.map((b) => (b ? '1' : '0')).join('');
      const v = parseInt(s, 2);
      const labels = Array.from({ length: o.width }, (_, i) => String(2 ** (o.width - 1 - i)));
      const sum = on.map((b, i) => (b ? 2 ** (o.width - 1 - i) : 0)).filter((x) => x);
      root.replaceChildren(
        bits(s, { labels, size: 40, hi: on.map((b, i) => (b ? i : -1)).filter((i) => i >= 0), onBit: (i) => { on[i] = !on[i]; draw(); } }),
        h('div', { class: 'readout' }, `${s} = ${sum.length ? sum.join(' + ') : '0'}${sum.length > 1 ? ` = ${v}` : ''}`),
        v === o.target ? h('div', { class: 'goal-ok' }, `✓ ${o.target} in binary is ${s}.`) : h('div', { class: 'muted small', style: 'text-align:center;' }, 'Tap a box to switch it between 0 and 1.'));
      ctx.solved?.(v === o.target);
    };
    draw();
    return root;
  };
}

// ---------------------------------------------------------------- code trees and prefix codes

/** A binary code tree for a prefix code: left edge = 0, right edge = 1, letters at their leaves. */
export function codeTree(codes: Record<string, string>, opts: { depth?: number; bad?: string[] } = {}): HTMLElement {
  const words = Object.entries(codes).filter(([, c]) => c);
  const depth = Math.max(opts.depth ?? 0, 1, ...words.map(([, c]) => c.length));
  const W = 300, H = 40 + depth * 52;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W + 40}px;` });
  const pos = (code: string): [number, number] => {
    let x0 = 0, x1 = W;
    for (const ch of code) { const m = (x0 + x1) / 2; if (ch === '0') x1 = m; else x0 = m; }
    return [(x0 + x1) / 2, 18 + code.length * 52];
  };
  // every prefix of every codeword is a node
  const nodes = new Set<string>(['']);
  for (const [, c] of words) for (let k = 1; k <= c.length; k++) nodes.add(c.slice(0, k));
  for (const n of nodes) {
    if (!n) continue;
    const [x, y] = pos(n), [px, py] = pos(n.slice(0, -1));
    s.appendChild(svg('line', { x1: px, y1: py, x2: x, y2: y, style: 'stroke:var(--muted);stroke-width:1.5;' }));
    s.appendChild(svg('text', { x: (x + px) / 2 + (n.endsWith('0') ? -8 : 8), y: (y + py) / 2 + 3, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11px;font-weight:700;' }, n.slice(-1)));
  }
  for (const n of nodes) {
    const [x, y] = pos(n);
    const letter = words.filter(([, c]) => c === n).map(([l]) => l).join('/');
    const bad = letter && opts.bad?.some((l) => letter.includes(l));
    if (letter) {
      s.appendChild(svg('circle', { cx: x, cy: y, r: 13, style: `fill:${bad ? 'var(--bad-bg)' : tint('var(--c3)', 30)};stroke:${bad ? 'var(--bad)' : 'var(--c3)'};stroke-width:2;` }));
      s.appendChild(svg('text', { x, y: y + 5, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:14px;font-weight:800;' }, letter));
    } else {
      s.appendChild(svg('circle', { cx: x, cy: y, r: 5, style: 'fill:var(--panel2);stroke:var(--muted);stroke-width:1.5;' }));
    }
  }
  return h('div', { class: 'plot-wrap' }, s);
}

/** Letters in `codes` whose codeword is a prefix of (or equal to) another letter's codeword. */
export function prefixClashes(codes: Record<string, string>): string[] {
  const out = new Set<string>();
  const e = Object.entries(codes).filter(([, c]) => c);
  for (const [a, ca] of e) for (const [b, cb] of e) if (a !== b && cb.startsWith(ca)) { out.add(a); out.add(b); }
  return [...out];
}

/**
 * Build a prefix code: tap a letter, then a codeword. Shows the tree, clashes and the total length.
 * Solved when every letter has a codeword, no codeword is a prefix of another, and the message
 * takes at most `best` bits.
 */
export function prefixBuilder(o: { counts: [string, number][]; best: number; pool: string[] }): Widget {
  return (ctx) => {
    const codes: Record<string, string> = Object.fromEntries(o.counts.map(([l]) => [l, '']));
    let sel = o.counts[0][0];
    const root = h('div');
    const draw = () => {
      const clashes = prefixClashes(codes);
      const all = o.counts.every(([l]) => codes[l]);
      const total = o.counts.reduce((a, [l, n]) => a + n * codes[l].length, 0);
      const ok = all && !clashes.length && total <= o.best;
      const letters = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;' }, o.counts.map(([l, n]) =>
        h('button', {
          class: 'ghost', 'data-letter': l, onclick: () => { sel = l; draw(); },
          style: `padding:.35em .6em;display:grid;gap:0;min-width:64px;${sel === l ? 'border:2px solid var(--accent-default);' : ''}${clashes.includes(l) ? 'background:var(--bad-bg);' : ''}`,
        }, h('span', { style: 'font-weight:800;' }, `${l} ×${n}`), h('span', { style: `${MONO}font-size:.9rem;color:${codes[l] ? 'var(--text)' : 'var(--muted)'};` }, codes[l] || '—'))));
      const pool = h('div', { style: 'display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:8px;' }, o.pool.map((c) => {
        const owner = Object.keys(codes).find((l) => codes[l] === c);
        return h('button', {
          class: 'tile', 'data-code': c, style: `padding:.25em .55em;${owner ? 'opacity:.5;' : ''}`,
          onclick: () => { for (const l of Object.keys(codes)) if (codes[l] === c) codes[l] = ''; codes[sel] = codes[sel] === c ? '' : c; const i = o.counts.findIndex(([l]) => l === sel); const next = o.counts.slice(i + 1).concat(o.counts.slice(0, i)).find(([l]) => !codes[l]); if (next && codes[sel]) sel = next[0]; draw(); },
        }, c);
      }));
      const msg = !all ? `Tap a letter, then a codeword for it. Picking: ${sel}`
        : clashes.length ? `Clash: ${clashes.join(', ')}. A codeword that starts another makes decoding ambiguous.`
          : total > o.best ? `Prefix-free, ${total} bits. You can get it down to ${o.best}.` : '';
      root.replaceChildren(letters, pool, codeTree(codes, { depth: 3, bad: clashes }),
        h('div', { class: 'readout' }, `Message length: ${o.counts.map(([l, n]) => `${n}×${codes[l].length || '?'}`).join(' + ')} = ${all ? total : '?'} bits`),
        ok ? h('div', { class: 'goal-ok' }, `✓ ${total} bits, prefix-free. Common letters got the short codes.`) : h('div', { class: 'muted small', style: 'text-align:center;' }, msg));
      ctx.solved?.(ok);
    };
    draw();
    return root;
  };
}

/** Huffman merging as a stepper: each frame shows the pool of weighted groups. */
export function huffmanSteps(counts: [string, number][]): HTMLElement {
  type G = { name: string; w: number };
  let pool: G[] = counts.map(([l, n]) => ({ name: l, w: n }));
  const frames: { pool: G[]; note: string }[] = [{ pool: pool.slice(), note: 'Start: every letter is its own group, weighted by its count.' }];
  while (pool.length > 1) {
    const sorted = pool.slice().sort((a, b) => a.w - b.w || a.name.length - b.name.length);
    const [a, b] = sorted;
    pool = pool.filter((g) => g !== a && g !== b).concat({ name: a.name + b.name, w: a.w + b.w });
    frames.push({ pool: pool.slice(), note: `Merge the two lightest: ${a.name} (${a.w}) + ${b.name} (${b.w}) = ${a.w + b.w}. Every letter inside gets one more bit.` });
  }
  return stepper(frames.length, (i) => h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:44px;align-items:center;' },
    frames[i].pool.map((g) => h('span', { class: 'chip', style: `font-size:1rem;${g.name.length > 1 ? `background:${tint('var(--c2)', 22)};` : ''}` }, `${g.name} · ${g.w}`))),
  { caption: (i) => frames[i].note });
}

// ---------------------------------------------------------------- error detection

/**
 * A 4x4 block of data bits with a parity bit on each row and column (even parity). One bit was
 * flipped in transit; tap the one you think it is. Row and column checks are shown as ✓ / ✗.
 */
export function parityGrid(o: { data: number[][]; flip: [number, number] }): Widget {
  return (ctx) => {
    const n = o.data.length;
    const sent = o.data.map((r) => [...r, r.reduce((a, b) => a ^ b, 0)]);
    sent.push(Array.from({ length: n + 1 }, (_, c) => sent.reduce((a, r) => a ^ r[c], 0)));
    const got = sent.map((r) => r.slice());
    got[o.flip[0]][o.flip[1]] ^= 1;
    const rowOk = got.map((r) => r.reduce((a, b) => a ^ b, 0) === 0);
    const colOk = Array.from({ length: n + 1 }, (_, c) => got.reduce((a, r) => a ^ r[c], 0) === 0);
    let pick: [number, number] | null = null;
    const root = h('div');
    const draw = () => {
      const sz = 38;
      const grid = h('div', { style: `display:grid;grid-template-columns:repeat(${n + 2},${sz}px);gap:4px;justify-content:center;` });
      for (let r = 0; r <= n + 1; r++) {
        for (let c = 0; c <= n + 1; c++) {
          if (r === n + 1 || c === n + 1) {
            const okv = r === n + 1 && c <= n ? colOk[c] : c === n + 1 && r <= n ? rowOk[r] : null;
            grid.appendChild(h('div', { style: `height:${sz}px;display:grid;place-items:center;font-weight:800;color:${okv === null ? 'transparent' : okv ? 'var(--good)' : 'var(--bad)'};` }, okv === null ? '' : okv ? '✓' : '✗'));
            continue;
          }
          const parity = r === n || c === n;
          const picked = pick && pick[0] === r && pick[1] === c;
          const right = picked && r === o.flip[0] && c === o.flip[1];
          grid.appendChild(h('button', {
            'data-cell': `${r},${c}`,
            style: `${MONO}width:${sz}px;height:${sz}px;padding:0;border-radius:7px;font-weight:700;font-size:1rem;color:var(--text);border:2px solid ${picked ? (right ? 'var(--good)' : 'var(--bad)') : 'var(--line)'};background:${picked ? (right ? 'var(--good-bg)' : 'var(--bad-bg)') : parity ? tint('var(--c5)', 28) : 'var(--panel2)'};`,
            onclick: () => { pick = [r, c]; draw(); ctx.solved?.(r === o.flip[0] && c === o.flip[1]); },
          }, String(got[r][c])));
        }
      }
      const right = pick && pick[0] === o.flip[0] && pick[1] === o.flip[1];
      root.replaceChildren(grid,
        h('div', { class: 'muted small', style: 'text-align:center;margin-top:6px;' }, 'Shaded: parity bits (each makes its row or column even). ✓/✗: does that row or column still have an even number of 1s?'),
        pick ? h('div', { class: right ? 'goal-ok' : 'w-msg', style: right ? '' : 'text-align:center;color:var(--bad);font-weight:600;' },
          right ? `✓ Row ${o.flip[0] + 1}, column ${o.flip[1] + 1}: the only spot on both a failing row and a failing column. Flip it back.` : `Flipping that bit back would ${rowOk[pick[0]] ? 'break its row, which checks out now' : colOk[pick[1]] ? 'break its column, which checks out now' : 'fix nothing'}.`) : '');
    };
    draw();
    return root;
  };
}

// ---------------------------------------------------------------- Caesar

/** Two rings of letters: outer = plain, inner = cipher (plain shifted by `shift`). */
export function cipherWheel(shift: number, opts: { size?: number } = {}): SVGElement {
  const S = opts.size ?? 300, c = S / 2, r1 = S / 2 - 16, r2 = S / 2 - 46;
  const s = svg('svg', { viewBox: `0 0 ${S} ${S}`, class: 'plot', style: `max-width:${S}px;` });
  s.appendChild(svg('circle', { cx: c, cy: c, r: r1 + 12, style: 'fill:var(--panel2);stroke:var(--line);stroke-width:1.5;' }));
  s.appendChild(svg('circle', { cx: c, cy: c, r: r2 + 13, style: `fill:${tint('var(--c6)', 18)};stroke:var(--line);stroke-width:1.5;` }));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 2 * Math.PI - Math.PI / 2;
    const top = i === 0;
    s.appendChild(svg('text', { x: c + r1 * Math.cos(a), y: c + r1 * Math.sin(a) + 5, 'text-anchor': 'middle', style: `fill:${top ? 'var(--c2)' : 'var(--text)'};font-size:14px;font-weight:${top ? 800 : 600};` }, ALPHA[i]));
    s.appendChild(svg('text', { x: c + r2 * Math.cos(a), y: c + r2 * Math.sin(a) + 5, 'text-anchor': 'middle', style: `fill:${top ? 'var(--c2)' : 'var(--c6)'};font-size:14px;font-weight:800;` }, ALPHA[(i + shift) % 26]));
  }
  s.appendChild(svg('text', { x: c, y: c - 4, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:12px;' }, 'outer: plain'));
  s.appendChild(svg('text', { x: c, y: c + 12, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:12px;' }, 'inner: cipher'));
  s.appendChild(svg('text', { x: c, y: c + 32, 'text-anchor': 'middle', style: 'fill:var(--c2);font-size:15px;font-weight:800;' }, `shift ${shift}`));
  return s;
}

const bigText = (t: string, color = 'var(--text)') => h('div', { style: `${MONO}text-align:center;font-size:1.05rem;font-weight:700;letter-spacing:.08em;overflow-wrap:anywhere;color:${color};margin:6px 0;` }, t);

/** Turn the wheel until the ciphertext decodes: solved at shift `key`. */
export function caesarTask(o: { cipher: string; key: number }): Widget {
  return (ctx) => {
    let k = 0;
    const pic = h('div');
    const out = h('div');
    const val = h('span', { class: 'slider-val' }, '0');
    const sl = h('input', { type: 'range', min: 0, max: 25, step: 1, value: 0, 'aria-label': 'shift', 'data-param': 'shift' });
    const draw = () => {
      pic.replaceChildren(h('div', { class: 'plot-wrap' }, cipherWheel(k, { size: 260 })));
      const plain = caesar(o.cipher, -k);
      out.replaceChildren(h('div', { class: 'muted small', style: 'text-align:center;' }, 'ciphertext'), bigText(o.cipher, 'var(--c6)'),
        h('div', { class: 'muted small', style: 'text-align:center;' }, `shifted back by ${k}`), bigText(plain, k === o.key ? 'var(--good)' : 'var(--text)'),
        k === o.key ? h('div', { class: 'goal-ok' }, `✓ Shift ${o.key}: it reads as English.`) : '');
      val.textContent = String(k);
      ctx.solved?.(k === o.key);
    };
    sl.addEventListener('input', () => { k = Number(sl.value); draw(); });
    draw();
    return h('div', null, pic, out, h('label', { class: 'slider-row' }, h('span', { class: 'slider-name' }, 'shift'), sl, val));
  };
}

/** English letter frequencies (percent of letters in typical text). */
export const ENGLISH: [string, number][] = [
  ['E', 12.7], ['T', 9.1], ['A', 8.2], ['O', 7.5], ['I', 7.0], ['N', 6.7], ['S', 6.3], ['H', 6.1], ['R', 6.0], ['D', 4.3], ['L', 4.0], ['U', 2.8],
];

/** Bar chart of the letter counts in a text (most common first, up to `top`). */
export function freqChart(text: string, opts: { top?: number; title?: string; color?: string } = {}): HTMLElement {
  return barChart(letterCounts(text).slice(0, opts.top ?? 8).map(([l, n]) => ({ label: l, value: n, color: opts.color ?? 'var(--c6)' })), { title: opts.title });
}

/**
 * Break a substitution cipher: tap a cipher letter, then the plain letter you think it stands for.
 * Solved when every cipher letter is mapped correctly.
 */
export function subSolver(o: { cipher: string; plain: string }): Widget {
  return (ctx) => {
    const truth = new Map<string, string>();
    for (let i = 0; i < o.cipher.length; i++) if (/[A-Z]/.test(o.cipher[i])) truth.set(o.cipher[i], o.plain[i]);
    const guess = new Map<string, string>();
    const order = letterCounts(o.cipher).map(([l]) => l);
    let sel = order[0];
    const root = h('div');
    const draw = () => {
      const ok = [...truth].every(([c, p]) => guess.get(c) === p);
      const words = o.cipher.split(' ').map((w) => h('span', { style: 'display:inline-flex;gap:2px;margin:0 6px 8px;' }, [...w].map((ch) => {
        const g = guess.get(ch);
        const on = ch === sel;
        return h('button', {
          onclick: () => { sel = ch; draw(); },
          style: `padding:2px 0 3px;width:27px;display:grid;gap:1px;justify-items:center;border-radius:6px;border:2px solid ${on ? 'var(--accent-default)' : 'var(--line)'};background:${on ? tint('var(--accent-default)', 16) : 'var(--panel2)'};`,
        }, h('span', { style: `${MONO}font-size:1.05rem;font-weight:800;color:${g ? 'var(--good)' : 'var(--muted)'};line-height:1.25;` }, g ?? '?'),
        h('span', { style: `${MONO}font-size:.85rem;color:var(--c6);font-weight:800;line-height:1.1;border-top:1px solid var(--line);width:100%;text-align:center;` }, ch));
      })));
      const used = new Map([...guess].map(([c, p]) => [p, c]));
      const keys = h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:340px;margin:6px auto 0;' }, [...ALPHA].map((p) =>
        h('button', {
          class: 'ghost', 'data-plain': p,
          style: `${MONO}width:34px;height:34px;padding:0;font-weight:700;${used.has(p) ? 'opacity:.45;' : ''}`,
          onclick: () => {
            const prev = used.get(p);
            if (prev) guess.delete(prev);
            if (prev === sel) { draw(); return; }
            guess.set(sel, p);
            const next = order.find((c) => !guess.has(c));
            if (next) sel = next;
            draw();
          },
        }, p)));
      root.replaceChildren(
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;' },
          h('div', { style: 'flex:1 1 140px;max-width:200px;' }, freqChart(o.cipher, { top: 6, title: 'Cipher letters' })),
          h('div', { class: 'muted small', style: 'flex:1 1 120px;max-width:180px;align-self:center;' }, 'English, most common first: E T A O I N S H R D L U. Common words: THE, AND, OF, TO, IS.')),
        h('div', { style: 'display:flex;flex-wrap:wrap;justify-content:center;margin-top:10px;' }, words),
        h('div', { class: 'readout' }, `Cipher letter ${sel} stands for: ${guess.get(sel) ?? '?'}`),
        keys,
        ok ? h('div', { class: 'goal-ok' }, `✓ ${o.plain}`) : '');
      ctx.solved?.(ok);
    };
    draw();
    return root;
  };
}

// ---------------------------------------------------------------- hashing

/** Two inputs and their toy hashes, with the differing bits marked. Type to change either. */
export function avalanche(a0: string, b0: string): Widget {
  return () => {
    let a = a0, b = b0;
    const out = h('div');
    const draw = () => {
      const ha = toBits(toyHash(a), 16), hb = toBits(toyHash(b), 16);
      const diff = [...ha].map((c, i) => (c !== hb[i] ? i : -1)).filter((i) => i >= 0);
      out.replaceChildren(
        h('div', { class: 'muted small', style: 'text-align:center;' }, `toyhash("${a}") = ${hex4(toyHash(a))}`), bits(ha, { group: 4, size: 17 }),
        h('div', { class: 'muted small', style: 'text-align:center;' }, `toyhash("${b}") = ${hex4(toyHash(b))}`), bits(hb, { group: 4, size: 17, bad: diff }),
        h('div', { class: 'readout' }, `${diff.length} of 16 bits differ`));
    };
    const inp = (v: string, set: (s: string) => void) => {
      const el = h('input', { value: v, maxlength: 16, 'aria-label': 'input text', style: `${MONO}font:inherit;width:9em;padding:.3em .5em;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);` });
      el.addEventListener('input', () => { set(el.value); draw(); });
      return el;
    };
    draw();
    return h('div', null, h('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;' }, inp(a, (s) => (a = s)), inp(b, (s) => (b = s))), out,
      h('div', { class: 'muted small', style: 'text-align:center;' }, 'Toy hash: 16 bits, for learning only. Real hashes use 256 bits.'));
  };
}

/** Find a nonce so toyhash(text + nonce) starts with `zeros` zero bits. */
export function miner(o: { text: string; zeros: number; max: number }): Widget {
  return (ctx) => {
    let k = 0, tries = new Set<number>([0]);
    const pic = h('div');
    const val = h('span', { class: 'slider-val' }, '0');
    const sl = h('input', { type: 'range', min: 0, max: o.max, step: 1, value: 0, 'aria-label': 'nonce', 'data-param': 'nonce' });
    const draw = () => {
      const hv = toyHash(o.text + k), b = toBits(hv, 16);
      const ok = b.startsWith('0'.repeat(o.zeros));
      const lead = Array.from({ length: o.zeros }, (_, i) => i);
      pic.replaceChildren(
        h('div', { class: 'muted small', style: 'text-align:center;' }, 'input'), bigText(`${o.text}${k}`),
        h('div', { class: 'muted small', style: 'text-align:center;' }, `toy hash = ${hex4(hv)}`),
        bits(b, { group: 4, size: 17, good: ok ? lead : [], bad: ok ? [] : lead.filter((i) => b[i] === '1') }),
        h('div', { class: 'readout' }, `nonces tried: ${tries.size}`),
        ok ? h('div', { class: 'goal-ok' }, `✓ Nonce ${k} works. Anyone can check it with one hash; finding it took trial and error.`) : '');
      val.textContent = String(k);
      ctx.solved?.(ok);
    };
    sl.addEventListener('input', () => { k = Number(sl.value); tries.add(k); draw(); });
    draw();
    return h('div', null, pic, h('label', { class: 'slider-row' }, h('span', { class: 'slider-name' }, 'nonce'), sl, val));
  };
}

// ---------------------------------------------------------------- modular arithmetic

/** A clock with p positions; marks the values in `path` in order, the last one highlighted. */
export function modClock(p: number, path: number[], opts: { size?: number } = {}): SVGElement {
  const S = opts.size ?? 240, c = S / 2, r = S / 2 - 24;
  const s = svg('svg', { viewBox: `0 0 ${S} ${S}`, class: 'plot', style: `max-width:${S}px;` });
  s.appendChild(svg('circle', { cx: c, cy: c, r, style: 'fill:none;stroke:var(--line);stroke-width:2;' }));
  const at = (v: number): [number, number] => { const a = (v / p) * 2 * Math.PI - Math.PI / 2; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  for (let k = 1; k < path.length; k++) {
    const [x1, y1] = at(path[k - 1]), [x2, y2] = at(path[k]);
    s.appendChild(svg('line', { x1, y1, x2, y2, style: `stroke:${k === path.length - 1 ? 'var(--c2)' : 'var(--c1)'};stroke-width:2;opacity:${k === path.length - 1 ? 1 : 0.5};` }));
  }
  const last = path[path.length - 1];
  for (let v = 0; v < p; v++) {
    const [x, y] = at(v);
    const on = path.includes(v), cur = v === last && path.length > 0;
    s.appendChild(svg('circle', { cx: x, cy: y, r: p > 16 ? 9 : 12, style: `fill:${cur ? 'var(--c2)' : on ? tint('var(--c1)', 40) : 'var(--panel2)'};stroke:${cur ? 'var(--c2)' : 'var(--line)'};stroke-width:1.5;` }));
    s.appendChild(svg('text', { x, y: y + 4, 'text-anchor': 'middle', style: `fill:${cur ? '#fff' : 'var(--text)'};font-size:${p > 16 ? 10 : 12}px;font-weight:700;` }, String(v)));
  }
  return s;
}

/** Step through g^1, g^2, ... mod p on the clock. */
export function powerSteps(g: number, p: number, n: number): HTMLElement {
  const vals = Array.from({ length: n }, (_, k) => modPow(g, k + 1, p));
  return stepper(n, (i) => h('div', { class: 'plot-wrap' }, modClock(p, vals.slice(0, i + 1))),
    { caption: (i) => i === 0 ? `${g}^1 mod ${p} = ${vals[0]}` : `${g}^${i + 1} mod ${p} = ${vals[i - 1]} × ${g} mod ${p} = ${vals[i]}` });
}

/** Find x with g^x mod p = target by trying exponents on a slider. */
export function dlogTask(o: { g: number; p: number; target: number }): Widget {
  return (ctx) => {
    let x = 1;
    const tried = new Set<number>([1]);
    const pic = h('div');
    const val = h('span', { class: 'slider-val' }, '1');
    const sl = h('input', { type: 'range', min: 1, max: o.p - 2, step: 1, value: 1, 'aria-label': 'exponent', 'data-param': 'x' });
    const draw = () => {
      const v = modPow(o.g, x, o.p);
      const ok = v === o.target;
      pic.replaceChildren(h('div', { class: 'plot-wrap' }, modClock(o.p, [v], { size: 230 })),
        h('div', { class: 'readout' }, `${o.g}^${x} mod ${o.p} = ${v}   (want ${o.target}) · tried ${tried.size}`),
        ok ? h('div', { class: 'goal-ok' }, `✓ x = ${x}. No shortcut: you had to try exponents.`) : '');
      val.textContent = String(x);
      ctx.solved?.(ok);
    };
    sl.addEventListener('input', () => { x = Number(sl.value); tried.add(x); draw(); });
    draw();
    return h('div', null, pic, h('label', { class: 'slider-row' }, h('span', { class: 'slider-name' }, 'x'), sl, val));
  };
}

// ---------------------------------------------------------------- paint mixing

const PAINT = { yellow: [240, 200, 60], red: [214, 60, 60], blue: [50, 100, 210] } as const;
const mix = (...cs: (readonly number[])[]) => `rgb(${[0, 1, 2].map((k) => Math.round(cs.reduce((a, c) => a + c[k], 0) / cs.length)).join(',')})`;

/** The paint-mixing picture of Diffie–Hellman, as a four-frame stepper. */
export function paintMix(): HTMLElement {
  const Y = PAINT.yellow, R = PAINT.red, B = PAINT.blue;
  const blob = (col: string, label: string, sub = '') => h('div', { style: 'display:grid;justify-items:center;gap:2px;width:92px;' },
    h('div', { style: `width:46px;height:46px;border-radius:50%;background:${col};border:2px solid var(--line);` }),
    h('div', { style: 'font-size:.8rem;font-weight:700;text-align:center;line-height:1.2;' }, label),
    sub ? h('div', { class: 'muted', style: 'font-size:.7rem;text-align:center;line-height:1.2;' }, sub) : null);
  const row = (title: string, ...kids: HTMLElement[]) => h('div', { style: 'display:grid;gap:4px;justify-items:center;' },
    h('div', { class: 'muted small', style: 'font-weight:700;' }, title), h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;' }, kids));
  const frames = [
    () => row('Public: everyone sees it', blob(mix(Y), 'yellow', 'agreed in the open')),
    () => h('div', { style: 'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;' },
      row('Alice', blob(mix(R), 'red', 'her secret'), blob(mix(Y, R), 'yellow+red', 'sends this')),
      row('Bob', blob(mix(B), 'blue', 'his secret'), blob(mix(Y, B), 'yellow+blue', 'sends this'))),
    () => row('The eavesdropper sees', blob(mix(Y), 'yellow'), blob(mix(Y, R), 'yellow+red'), blob(mix(Y, B), 'yellow+blue')),
    () => h('div', { style: 'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;' },
      row('Alice adds red to Bob’s mix', blob(mix(Y, B, R), 'shared colour')),
      row('Bob adds blue to Alice’s mix', blob(mix(Y, R, B), 'shared colour'))),
  ];
  const caps = [
    'Alice and Bob agree on a starting colour in public.',
    'Each mixes in a secret colour and sends the mixture. Unmixing paint is hard.',
    'An eavesdropper has all three public colours, but no way to separate them.',
    'Each adds their own secret to the other’s mixture: both end with the same colour.',
  ];
  return stepper(frames.length, (i) => frames[i](), { caption: (i) => caps[i] });
}
