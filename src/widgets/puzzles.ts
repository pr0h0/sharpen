// Puzzles and pictures for the Puzzle Solving course, plus the brute-force solvers that check them:
// a balance scale with an adversarial fake coin, river rafts, water jugs, fillable Latin grids
// (mini Sudoku, sum cages), a coin-flip row, a sliding puzzle, a corner race game and Lights Out.
// Every task reports through ctx.solved only when the puzzle is really solved.
import type { Widget } from '../types';
import { h, svg } from '../ui';

const C1 = 'var(--c1)', C2 = 'var(--c2)', C3 = 'var(--c3)', C5 = 'var(--c5)', C6 = 'var(--c6)';
const tint = (c: string, p = 22) => `color-mix(in srgb, ${c} ${p}%, var(--panel))`;

function svgBox(w: number, hgt: number, maxW = 340): SVGElement {
  return svg('svg', { viewBox: `0 0 ${w} ${hgt}`, width: '100%', style: `max-width:${maxW}px;display:block;margin:4px auto;height:auto` });
}
const btn = (label: string, onclick: () => void, attrs: Record<string, unknown> = {}) => h('button', { class: 'ghost small-btn', onclick, ...attrs }, label);
const ctlRow = (...kids: Node[]) => h('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px' }, ...kids);
const OK = (t: string) => h('div', { class: 'goal-ok' }, '✓ ', t);
const BAD = (t: string) => h('div', { style: 'margin-top:8px;color:var(--bad);font-weight:700;text-align:center' }, t);
const NOTE = (t: string) => h('div', { class: 'muted small', style: 'text-align:center;margin-top:6px' }, t);

// ---------------------------------------------------------------- search

/** Breadth-first search: the shortest path of states from start to a goal, or null. */
export function bfs<S>(start: S, key: (s: S) => string, next: (s: S) => S[], goal: (s: S) => boolean): S[] | null {
  const prev = new Map<string, S | null>([[key(start), null]]);
  if (goal(start)) return [start];
  let frontier = [start];
  while (frontier.length) {
    const nf: S[] = [];
    for (const s of frontier) {
      for (const t of next(s)) {
        const k = key(t);
        if (prev.has(k)) continue;
        prev.set(k, s);
        if (goal(t)) {
          const path = [t];
          let p: S | null = s;
          while (p !== null) { path.unshift(p); p = prev.get(key(p)) ?? null; }
          return path;
        }
        nf.push(t);
      }
    }
    frontier = nf;
  }
  return null;
}

/** Distance from start to every reachable state (by key). */
export function bfsAll<S>(start: S, key: (s: S) => string, next: (s: S) => S[]): Map<string, { s: S; d: number }> {
  const seen = new Map([[key(start), { s: start, d: 0 }]]);
  let frontier = [start], d = 0;
  while (frontier.length) {
    d++;
    const nf: S[] = [];
    for (const s of frontier) for (const t of next(s)) {
      const k = key(t);
      if (!seen.has(k)) { seen.set(k, { s: t, d }); nf.push(t); }
    }
    frontier = nf;
  }
  return seen;
}

// ---------------------------------------------------------------- balance scale

const memo = new Map<string, boolean>();
/** Can k weighings always find the one heavier (or lighter: same thing) coin among n? Brute force over first splits. */
export function canFind(n: number, k: number): boolean {
  if (n <= 1) return true;
  if (k === 0) return false;
  const key = `${n},${k}`;
  if (memo.has(key)) return memo.get(key)!;
  let ok = false;
  for (let a = 1; 2 * a <= n && !ok; a++) ok = canFind(a, k - 1) && canFind(n - 2 * a, k - 1);
  memo.set(key, ok);
  return ok;
}
export function minWeighings(n: number): number { let k = 0; while (!canFind(n, k)) k++; return k; }

/** A balance scale drawing. tilt 1 = left pan down, -1 = right pan down. */
export function balancePic(left: string[], right: string[], tilt: number, opts: { caption?: string; maxW?: number } = {}): HTMLElement {
  const s = svgBox(300, 150, opts.maxW ?? 300);
  const dy = tilt * 14;
  const L = { x: 62, y: 40 + dy }, R = { x: 238, y: 40 - dy };
  s.appendChild(svg('path', { d: 'M150 40 L150 132 M118 138 L182 138', style: 'stroke:var(--muted);stroke-width:5;stroke-linecap:round;fill:none' }));
  s.appendChild(svg('line', { x1: L.x, y1: L.y, x2: R.x, y2: R.y, style: 'stroke:var(--text);stroke-width:4;stroke-linecap:round' }));
  s.appendChild(svg('circle', { cx: 150, cy: 40, r: 5, style: 'fill:var(--text)' }));
  const pan = (p: { x: number; y: number }, coins: string[], col: string) => {
    const py = p.y + 52;
    s.appendChild(svg('path', { d: `M${p.x} ${p.y} L${p.x - 44} ${py} M${p.x} ${p.y} L${p.x + 44} ${py}`, style: 'stroke:var(--muted);stroke-width:1.5;fill:none' }));
    s.appendChild(svg('path', { d: `M${p.x - 50} ${py} Q${p.x} ${py + 22} ${p.x + 50} ${py} Z`, style: `fill:${tint(col, 35)};stroke:${col};stroke-width:2` }));
    coins.forEach((c, i) => {
      const row = Math.floor(i / 5), inRow = Math.min(5, coins.length - row * 5), k = i % 5;
      const cx = p.x + (k - (inRow - 1) / 2) * 19, cy = py - 9 - row * 18;
      s.appendChild(svg('circle', { cx, cy, r: 9, style: `fill:${C5};stroke:var(--text);stroke-width:1` }));
      s.appendChild(svg('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', style: 'font-size:10px;font-weight:700;fill:#2a2118' }, c));
    });
  };
  pan(L, left, C1);
  pan(R, right, C2);
  return h('div', null, s, opts.caption ? h('div', { class: 'readout' }, opts.caption) : null);
}

/** Three balance outcomes side by side. */
export function threeOutcomes(): HTMLElement {
  const one = (t: number, cap: string) => h('div', { style: 'flex:1;min-width:92px;max-width:130px;text-align:center' }, balancePic(['1'], ['2'], t, { maxW: 130 }), h('div', { class: 'small', style: 'font-weight:600' }, cap));
  return h('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap' },
    one(1, 'Left down: coin 1 is heavy'), one(0, 'Level: coin 3 is heavy'), one(-1, 'Right down: coin 2 is heavy'));
}

/** Coins split into labelled groups (for the "split in three" picture). */
export function coinGroups(groups: { label: string; coins: string[]; color: string; note?: string }[]): HTMLElement {
  return h('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap' }, groups.map((g) =>
    h('div', { style: `border:2px solid ${g.color};background:${tint(g.color, 14)};border-radius:12px;padding:6px 8px;text-align:center;min-width:86px` },
      h('div', { class: 'small', style: 'font-weight:700' }, g.label),
      h('div', { style: 'display:flex;gap:3px;justify-content:center;flex-wrap:wrap;max-width:110px;margin:4px auto' }, g.coins.map((c) =>
        h('span', { style: `width:22px;height:22px;border-radius:50%;background:${C5};color:#2a2118;font-size:11px;font-weight:700;display:grid;place-items:center;border:1px solid var(--line)` }, c))),
      g.note ? h('div', { class: 'muted small' }, g.note) : null)));
}

/**
 * n coins, one fake (heavier, or lighter). Tap coins onto the pans and weigh. The fake is chosen by an
 * adversary: each weighing gets the answer that keeps the most coins under suspicion, so luck never
 * helps. Solved when the learner names the one coin the results force, within the weighing budget.
 */
export function balanceTask(o: { n: number; weighings: number; light?: boolean }): Widget {
  return (ctx) => {
    const all = Array.from({ length: o.n }, (_, i) => i);
    let place: number[] = [], cand = new Set<number>(), log: string[] = [], used = 0, accuse = false, solved = false;
    let last: { L: number[]; R: number[]; tilt: number } | null = null;
    let msg: Node | null = null;
    const pic = h('div'), coinsEl = h('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:6px' });
    const logEl = h('div', { class: 'small', style: 'margin-top:8px;line-height:1.5;text-align:center' });
    const msgEl = h('div');
    const weighB = btn('⚖ Weigh', () => weigh());
    const accB = btn('Name the fake', () => { accuse = !accuse; msg = null; draw(); });
    const word = o.light ? 'lighter' : 'heavier';
    const reset = () => {
      place = all.map(() => 0); cand = new Set(all); log = []; used = 0; accuse = false; solved = false; last = null; msg = null;
      ctx.solved?.(false);
      draw();
    };
    const names = (xs: number[]) => xs.map((i) => i + 1).join(', ');
    function weigh() {
      const L = all.filter((i) => place[i] === 1), R = all.filter((i) => place[i] === 2);
      const inL = L.filter((i) => cand.has(i)), inR = R.filter((i) => cand.has(i)), off = [...cand].filter((i) => place[i] === 0);
      // Left pan goes down if a heavy fake is on the left, or a light fake is on the right.
      const outcomes: [number, number[], string][] = [[0, off, 'balance'], [1, o.light ? inR : inL, 'left pan down'], [-1, o.light ? inL : inR, 'right pan down']];
      const [tilt, keep, text] = outcomes.reduce((a, b) => (b[1].length > a[1].length ? b : a));
      cand = new Set(keep);
      used++;
      last = { L, R, tilt };
      log.push(`Weighing ${used}: ${names(L)} vs ${names(R)} → ${text}`);
      place = all.map(() => 0);
      msg = used === o.weighings ? NOTE('No weighings left. Can you name the fake for certain?') : null;
      draw();
    }
    function accuseCoin(c: number) {
      accuse = false;
      if (cand.size === 1 && cand.has(c)) {
        solved = true;
        msg = OK(`Proven: coin ${c + 1} must be the ${word} one${used <= o.weighings ? `, in ${used} weighing${used === 1 ? '' : 's'}` : ''}.`);
        ctx.solved?.(true);
      } else if (!cand.has(c)) {
        msg = BAD(`Coin ${c + 1} can’t be fake: look at the results again.`);
      } else {
        const others = [...cand].filter((i) => i !== c);
        msg = BAD(`Not proven yet: coin${others.length > 1 ? 's' : ''} ${names(others)} could also be the fake.${used === o.weighings ? ' Reset and try another plan.' : ''}`);
      }
      draw();
    }
    function draw() {
      const L = all.filter((i) => place[i] === 1), R = all.filter((i) => place[i] === 2);
      const showing = L.length || R.length || !last ? { L, R, tilt: 0 } : last;
      pic.replaceChildren(balancePic(showing.L.map((i) => String(i + 1)), showing.R.map((i) => String(i + 1)), showing.tilt));
      coinsEl.replaceChildren(...all.map((i) => {
        const p = place[i], col = p === 1 ? C1 : p === 2 ? C2 : 'var(--line)';
        return h('button', {
          'data-coin': i + 1, 'aria-label': `coin ${i + 1}${p === 1 ? ', on left pan' : p === 2 ? ', on right pan' : ''}`,
          style: `width:40px;height:40px;padding:0;border-radius:50%;font-weight:800;font-size:1rem;cursor:pointer;color:#2a2118;background:${C5};border:3px ${accuse ? 'dashed' : 'solid'} ${accuse ? 'var(--bad)' : col};position:relative`,
          disabled: solved,
          onclick: () => {
            if (accuse) return accuseCoin(i);
            place[i] = (place[i] + 1) % 3; msg = null; draw();
          },
        }, String(i + 1), p ? h('span', { style: `position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:800;color:#fff;background:${col};border-radius:6px;padding:0 4px` }, p === 1 ? 'L' : 'R') : null);
      }));
      const ok = L.length > 0 && L.length === R.length;
      weighB.disabled = solved || accuse || used >= o.weighings || !ok;
      accB.disabled = solved;
      accB.textContent = accuse ? 'Cancel' : 'Name the fake';
      logEl.replaceChildren(...(log.length ? log.map((t) => h('div', null, t)) : [h('span', { class: 'muted' }, `Weighings left: ${o.weighings}`)]),
        log.length ? h('div', { class: 'muted' }, `Weighings left: ${o.weighings - used}`) : '');
      const hint = accuse ? NOTE('Tap the coin you can prove is fake.')
        : L.length !== R.length ? NOTE('Put the same number of coins on each pan.')
        : !L.length && !log.length ? NOTE('Tap a coin: once for the left pan, twice for the right, again to take it off.') : null;
      msgEl.replaceChildren(...[msg, msg ? null : hint].filter((x): x is Node => !!x));
    }
    reset();
    return h('div', null, pic, coinsEl, ctlRow(weighB, accB, btn('Reset', reset)), logEl, msgEl);
  };
}

// ---------------------------------------------------------------- river raft

export interface RaftOpts {
  keeper: { name: string; icon: string };
  items: { id: string; name: string; icon: string }[];
  /** a and b can't be left together without the keeper; text says what happens. */
  conflicts: { a: string; b: string; text: string }[];
  /** Passengers besides the keeper. */
  cap: number;
}
/** far = bitmask of items on the far bank; k = keeper's bank (0 near, 1 far). */
export interface RaftState { far: number; k: number }

function raftClash(o: RaftOpts, s: RaftState): { text: string } | null {
  // The bank without the keeper: items whose side differs from k.
  const idx = (id: string) => o.items.findIndex((it) => it.id === id);
  for (const c of o.conflicts) {
    const a = idx(c.a), b = idx(c.b);
    const sa = (s.far >> a) & 1, sb = (s.far >> b) & 1;
    if (sa === sb && sa !== s.k) return c;
  }
  return null;
}
export const raftSafe = (o: RaftOpts, s: RaftState) => !raftClash(o, s);
export function raftNext(o: RaftOpts, s: RaftState): RaftState[] {
  const n = o.items.length, out: RaftState[] = [];
  const mine = Array.from({ length: n }, (_, i) => i).filter((i) => ((s.far >> i) & 1) === s.k);
  for (let sub = 0; sub < 1 << mine.length; sub++) {
    const pick = mine.filter((_, j) => (sub >> j) & 1);
    if (pick.length > o.cap) continue;
    let far = s.far;
    for (const i of pick) far ^= 1 << i;
    const t = { far, k: 1 - s.k };
    if (!raftClash(o, t)) out.push(t);
  }
  return out;
}
export const raftKey = (s: RaftState) => `${s.far},${s.k}`;
export function raftSolve(o: RaftOpts): RaftState[] | null {
  const all = (1 << o.items.length) - 1;
  return bfs<RaftState>({ far: 0, k: 0 }, raftKey, (s) => raftNext(o, s), (s) => s.far === all && s.k === 1);
}
/** "K C P S | ·" style label: near bank, then far bank (initials). */
export function raftLabel(o: RaftOpts, s: RaftState): string {
  const side = (b: number) => (s.k === b ? o.keeper.name[0] : '') + o.items.filter((_, i) => ((s.far >> i) & 1) === b).map((it) => it.name[0]).join('');
  return `${side(0) || '·'} | ${side(1) || '·'}`;
}

export function raftTask(o: RaftOpts): Widget {
  return (ctx) => {
    const best = (raftSolve(o)?.length ?? 1) - 1;
    let side: number[] = [], k = 0, aboard: number[] = [], trips = 0, failed: string | null = null, solved = false;
    const view = h('div');
    const reset = () => { side = o.items.map(() => 0); k = 0; aboard = []; trips = 0; failed = null; solved = false; ctx.solved?.(false); draw(); };
    const chip = (i: number, onclick?: () => void) => h('button', {
      'data-item': o.items[i].id,
      style: `display:flex;align-items:center;gap:4px;width:100%;padding:5px 6px;border-radius:9px;font-size:.88rem;font-weight:600;color:var(--text);background:var(--panel);border:1px solid var(--line);cursor:${onclick ? 'pointer' : 'default'};${onclick ? '' : 'opacity:.75;'}`,
      onclick: onclick ?? (() => {}), disabled: !onclick || solved || !!failed,
    }, h('span', { style: 'font-size:1.15rem' }, o.items[i].icon), o.items[i].name);
    const keeperChip = () => h('div', { style: 'display:flex;align-items:center;gap:4px;padding:5px 6px;border-radius:9px;font-size:.88rem;font-weight:700' }, h('span', { style: 'font-size:1.15rem' }, o.keeper.icon), o.keeper.name);
    function cross() {
      for (const i of aboard) side[i] = 1 - k;
      k = 1 - k; aboard = []; trips++;
      const c = raftClash(o, { far: side.reduce((m, s, i) => m | (s << i), 0), k });
      if (c) failed = c.text;
      else if (side.every((s) => s === 1)) { solved = true; ctx.solved?.(true); }
      draw();
    }
    function draw() {
      const bank = (b: number) => h('div', { style: `display:flex;flex-direction:column;gap:5px;padding:6px;border-radius:10px;background:${tint(C3, 16)};min-height:170px` },
        h('div', { class: 'muted small', style: 'text-align:center;font-weight:700' }, b === 0 ? 'Start bank' : 'Far bank'),
        k === b ? keeperChip() : null,
        o.items.map((_, i) => i).filter((i) => side[i] === b && !aboard.includes(i))
          .map((i) => chip(i, k === b ? () => { if (aboard.length < o.cap) { aboard.push(i); draw(); } } : undefined)));
      const raft = h('div', { style: `border-radius:10px;border:2px solid #8a5a2b;background:${tint('#b07a43', 45)};padding:4px;display:flex;flex-direction:column;gap:4px;min-height:60px` },
        h('div', { class: 'small', style: 'text-align:center;font-weight:700' }, `Raft (${aboard.length}/${o.cap})`),
        aboard.map((i) => chip(i, () => { aboard = aboard.filter((j) => j !== i); draw(); })));
      const river = h('div', { style: `display:flex;flex-direction:column;justify-content:center;padding:6px 4px;border-radius:10px;background:${tint(C1, 26)};align-items:${k === 0 ? 'flex-start' : 'flex-end'}` },
        h('div', { style: 'width:88%' }, raft),
        h('div', { class: 'muted small', style: 'text-align:center;width:100%;margin-top:6px' }, k === 0 ? 'raft at start ⟶' : '⟵ raft at far side'));
      const crossB = btn(k === 0 ? 'Cross ⟶' : '⟵ Cross', cross, { disabled: solved || !!failed, 'data-cross': '1' });
      view.replaceChildren(
        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px' }, bank(0), river, bank(1)),
        ctlRow(crossB, btn('Reset', reset)),
        h('div', { class: 'readout' }, `Crossings: ${trips}`),
        failed ? BAD(`${failed} Reset to try again.`) : solved ? OK(`Everyone is across in ${trips} crossings${trips === best ? ' (the fewest possible)' : `. It can be done in ${best}`}.`)
          : NOTE(`Tap to load or unload the raft (up to ${o.cap} passenger${o.cap > 1 ? 's' : ''} besides the ${o.keeper.name.toLowerCase()}), then cross.`));
    }
    reset();
    return view;
  };
}

/** A state graph drawn in layers (BFS distance top to bottom). */
export function layeredGraph(layers: { id: string; label: string }[][], edges: [string, string][], opts: { hi?: string[]; dim?: string[]; upTo?: number; rowLabel?: (d: number) => string } = {}): HTMLElement {
  const W = 320, rowH = 40, bw = 92, bh = 24, H = layers.length * rowH + 8;
  const s = svgBox(W, H, 340);
  const pos = new Map<string, { x: number; y: number; d: number }>();
  layers.forEach((L, d) => L.forEach((n, i) => pos.set(n.id, { x: 40 + ((W - 40) * (i + 0.5)) / L.length, y: 18 + d * rowH, d })));
  const vis = (d: number) => opts.upTo === undefined || d <= opts.upTo;
  for (const [a, b] of edges) {
    const p = pos.get(a), q = pos.get(b);
    if (!p || !q || !vis(p.d) || !vis(q.d)) continue;
    s.appendChild(svg('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, style: `stroke:${opts.hi?.includes(a) && opts.hi?.includes(b) ? C2 : 'var(--muted)'};stroke-width:${opts.hi?.includes(a) && opts.hi?.includes(b) ? 3 : 1.4}` }));
  }
  layers.forEach((L, d) => {
    if (opts.rowLabel) s.appendChild(svg('text', { x: 4, y: 18 + d * rowH + 4, style: 'font-size:10px;fill:var(--muted)' }, opts.rowLabel(d)));
    if (!vis(d)) return;
    for (const n of L) {
      const p = pos.get(n.id)!;
      const on = opts.hi?.includes(n.id), front = opts.upTo === d;
      s.appendChild(svg('rect', { x: p.x - bw / 2, y: p.y - bh / 2, width: bw, height: bh, rx: 7,
        style: `fill:${on ? tint(C2, 40) : front ? tint(C1, 30) : 'var(--panel2)'};stroke:${on ? C2 : front ? C1 : 'var(--line)'};stroke-width:1.5` }));
      s.appendChild(svg('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', style: 'font-size:11.5px;font-weight:700;fill:var(--text);font-family:ui-monospace,monospace' }, n.label));
    }
  });
  return h('div', null, s);
}

// ---------------------------------------------------------------- water jugs

export type Jugs = [number, number];
export function jugNext(a: number, b: number, [x, y]: Jugs): Jugs[] {
  const ab = Math.min(x, b - y), ba = Math.min(y, a - x);
  return [[a, y], [x, b], [0, y], [x, 0], [x - ab, y + ab], [x + ba, y - ba]];
}
export function jugSolve(a: number, b: number, t: number): Jugs[] | null {
  return bfs<Jugs>([0, 0], (s) => s.join(','), (s) => jugNext(a, b, s), ([x, y]) => x === t || y === t);
}

export function jugTask(o: { a: number; b: number; t: number }): Widget {
  return (ctx) => {
    const best = (jugSolve(o.a, o.b, o.t)?.length ?? 1) - 1;
    let x = 0, y = 0, steps = 0, solved = false;
    const view = h('div');
    const jug = (name: string, v: number, cap: number, col: string) => {
      const scale = 120 / Math.max(o.a, o.b), hh = cap * scale, s = svgBox(90, 150, 90);
      const top = 140 - hh;
      s.appendChild(svg('rect', { x: 15, y: 140 - v * scale, width: 60, height: v * scale, style: `fill:${col};opacity:.75` }));
      for (let k = 1; k < cap; k++) s.appendChild(svg('line', { x1: 15, y1: 140 - k * scale, x2: 25, y2: 140 - k * scale, style: 'stroke:var(--muted);stroke-width:1' }));
      s.appendChild(svg('path', { d: `M15 ${top} L15 140 L75 140 L75 ${top}`, style: 'fill:none;stroke:var(--text);stroke-width:2.5;stroke-linejoin:round' }));
      return h('div', { style: 'text-align:center' }, s, h('div', { style: 'font-weight:700' }, `${name}: ${v} of ${cap} L`));
    };
    const act = (f: () => void) => () => { if (solved) return; f(); steps++; if (x === o.t || y === o.t) { solved = true; ctx.solved?.(true); } draw(); };
    const fillA = act(() => { x = o.a; }), fillB = act(() => { y = o.b; }), empA = act(() => { x = 0; }), empB = act(() => { y = 0; });
    const pAB = act(() => { const m = Math.min(x, o.b - y); x -= m; y += m; }), pBA = act(() => { const m = Math.min(y, o.a - x); y -= m; x += m; });
    const reset = () => { x = 0; y = 0; steps = 0; solved = false; ctx.solved?.(false); draw(); };
    function draw() {
      const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-width:330px;margin:8px auto 0' },
        btn('Fill A', fillA), btn('Empty A', empA), btn('Pour A → B', pAB), btn('Fill B', fillB), btn('Empty B', empB), btn('Pour B → A', pBA));
      view.replaceChildren(
        h('div', { style: 'display:flex;gap:24px;justify-content:center;align-items:flex-end' }, jug('A', x, o.a, C1), jug('B', y, o.b, C3)),
        grid, ctlRow(btn('Reset', reset)),
        h('div', { class: 'readout' }, `Steps: ${steps}`),
        solved ? OK(`${o.t} litres measured in ${steps} steps${steps === best ? ' (the fewest possible)' : `. The fewest is ${best}`}.`) : NOTE(`Goal: exactly ${o.t} litres in either jug. Pouring stops when one jug is empty or the other is full.`));
    }
    reset();
    return view;
  };
}

// ---------------------------------------------------------------- Latin grids (mini Sudoku, sum cages)

export interface GridPuzzle {
  n: number;
  /** Box size [rows, cols] for Sudoku-style boxes. */
  box?: [number, number];
  /** 0 = blank. */
  givens: number[][];
  cages?: { cells: [number, number][]; sum: number }[];
}

/** All solutions (up to limit) by backtracking: rows, columns, boxes and cage sums. */
export function gridSolutions(p: GridPuzzle, limit = 2): number[][][] {
  const n = p.n, g = p.givens.map((r) => r.slice()), out: number[][][] = [];
  const cageOf: number[][] = g.map((r) => r.map(() => -1));
  p.cages?.forEach((c, k) => c.cells.forEach(([r, cc]) => { cageOf[r][cc] = k; }));
  const ok = (r: number, c: number, v: number) => {
    for (let i = 0; i < n; i++) if ((i !== c && g[r][i] === v) || (i !== r && g[i][c] === v)) return false;
    if (p.box) {
      const [br, bc] = p.box, r0 = r - (r % br), c0 = c - (c % bc);
      for (let i = r0; i < r0 + br; i++) for (let j = c0; j < c0 + bc; j++) if ((i !== r || j !== c) && g[i][j] === v) return false;
    }
    const k = cageOf[r][c];
    if (k >= 0) {
      const cage = p.cages![k];
      let sum = 0, blanks = 0;
      for (const [i, j] of cage.cells) { const w = i === r && j === c ? v : g[i][j]; if (w) sum += w; else blanks++; }
      if (sum > cage.sum || (blanks === 0 && sum !== cage.sum)) return false;
    }
    return true;
  };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g[r][c] && !ok(r, c, g[r][c])) return [];
  const go = (i: number): void => {
    if (out.length >= limit) return;
    if (i === n * n) { out.push(g.map((r) => r.slice())); return; }
    const r = Math.floor(i / n), c = i % n;
    if (g[r][c]) return go(i + 1);
    for (let v = 1; v <= n; v++) if (ok(r, c, v)) { g[r][c] = v; go(i + 1); g[r][c] = 0; }
  };
  go(0);
  return out;
}

/** Candidates for each blank cell (rows, columns, boxes only). */
export function candidates(p: GridPuzzle, r: number, c: number): number[] {
  if (p.givens[r][c]) return [];
  const out: number[] = [];
  for (let v = 1; v <= p.n; v++) {
    let bad = false;
    for (let i = 0; i < p.n; i++) if (p.givens[r][i] === v || p.givens[i][c] === v) bad = true;
    if (p.box) {
      const [br, bc] = p.box, r0 = r - (r % br), c0 = c - (c % bc);
      for (let i = r0; i < r0 + br; i++) for (let j = c0; j < c0 + bc; j++) if (p.givens[i][j] === v) bad = true;
    }
    if (!bad) out.push(v);
  }
  return out;
}

function gridView(p: GridPuzzle, vals: number[][], o: { sel?: [number, number] | null; onCell?: (r: number, c: number) => void; mark?: string[]; bad?: Set<string>; badCage?: Set<number>; size?: number; notes?: Record<string, string> }): HTMLElement {
  const n = p.n, sz = o.size ?? (n <= 4 ? 58 : 46);
  const cageOf: number[][] = vals.map((r) => r.map(() => -1));
  p.cages?.forEach((cg, k) => cg.cells.forEach(([r, c]) => { cageOf[r][c] = k; }));
  const label = new Map<string, number>();
  p.cages?.forEach((cg, k) => { const [r, c] = cg.cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])[0]; label.set(`${r},${c}`, k); });
  const thick = '2.5px solid var(--text)', thin = '1px solid var(--line)';
  const edge = (r: number, c: number, r2: number, c2: number) => {
    if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) return thick;
    if (p.box && (Math.floor(r / p.box[0]) !== Math.floor(r2 / p.box[0]) || Math.floor(c / p.box[1]) !== Math.floor(c2 / p.box[1]))) return thick;
    if (p.cages && cageOf[r][c] !== cageOf[r2][c2]) return thick;
    return thin;
  };
  const cells: HTMLElement[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const key = `${r},${c}`, given = !!p.givens[r][c], v = vals[r][c];
    const sel = o.sel && o.sel[0] === r && o.sel[1] === c, marked = o.mark?.includes(key);
    const lab = label.get(key);
    const style = `position:relative;width:${sz}px;height:${sz}px;padding:0;border-radius:0;display:grid;place-items:center;font-size:${Math.round(sz * 0.45)}px;font-weight:${given ? 800 : 600};`
      + `color:${o.bad?.has(key) ? 'var(--bad)' : given ? 'var(--text)' : C1};`
      + `background:${sel ? tint(C1, 30) : marked ? tint(C2, 35) : given ? 'var(--panel2)' : 'var(--panel)'};`
      + `border-top:${edge(r, c, r - 1, c)};border-left:${edge(r, c, r, c - 1)};border-bottom:${edge(r, c, r + 1, c)};border-right:${edge(r, c, r, c + 1)};`
      + (o.onCell && !given ? 'cursor:pointer;' : '');
    const kids: (Node | string)[] = [];
    if (lab !== undefined) kids.push(h('span', { style: `position:absolute;top:2px;left:4px;font-size:11px;font-weight:700;color:${o.badCage?.has(lab) ? 'var(--bad)' : 'var(--muted)'}` }, `${p.cages![lab].sum}+`));
    if (o.notes?.[key]) kids.push(h('span', { style: 'font-size:11px;color:var(--muted);font-weight:600' }, o.notes[key]));
    else if (v) kids.push(String(v));
    cells.push(o.onCell
      ? h('button', { 'data-cell': key, 'aria-label': `row ${r + 1} column ${c + 1}${v ? `: ${v}` : ''}`, style, onclick: () => o.onCell!(r, c) }, ...kids)
      : h('div', { style }, ...kids));
  }
  return h('div', { style: `display:grid;grid-template-columns:repeat(${n},${sz}px);justify-content:center;margin:4px auto` }, cells);
}

/** A grid picture: givens, optional marked cells (e.g. "1,2") and notes in cells. */
export function gridPic(p: GridPuzzle, opts: { mark?: string[]; notes?: Record<string, string>; size?: number; vals?: number[][] } = {}): HTMLElement {
  return gridView(p, opts.vals ?? p.givens, opts);
}

/** Fill the grid: tap a cell, then a number. Clashes show red at once; solved when complete and valid. */
export function gridTask(p: GridPuzzle): Widget {
  return (ctx) => {
    const n = p.n;
    let vals = p.givens.map((r) => r.slice()), sel: [number, number] | null = null;
    const view = h('div');
    const check = () => {
      const bad = new Set<string>(), badCage = new Set<number>();
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const v = vals[r][c];
        if (!v) continue;
        for (let r2 = 0; r2 < n; r2++) for (let c2 = 0; c2 < n; c2++) {
          if ((r2 === r && c2 === c) || vals[r2][c2] !== v) continue;
          const sameBox = p.box && Math.floor(r / p.box[0]) === Math.floor(r2 / p.box[0]) && Math.floor(c / p.box[1]) === Math.floor(c2 / p.box[1]);
          if (r2 === r || c2 === c || sameBox) bad.add(`${r},${c}`);
        }
      }
      p.cages?.forEach((cg, k) => {
        const vs = cg.cells.map(([r, c]) => vals[r][c]), s = vs.reduce((a, b) => a + b, 0);
        if (s > cg.sum || (vs.every((v) => v) && s !== cg.sum)) badCage.add(k);
      });
      const full = vals.every((r) => r.every((v) => v));
      return { bad, badCage, done: full && !bad.size && !badCage.size };
    };
    const set = (v: number) => { if (!sel) return; vals[sel[0]][sel[1]] = v; draw(); };
    const reset = () => { vals = p.givens.map((r) => r.slice()); sel = null; draw(); };
    function draw() {
      const { bad, badCage, done } = check();
      ctx.solved?.(done);
      const filled = vals.flat().filter((v) => v).length;
      view.replaceChildren(
        gridView(p, vals, { sel, bad, badCage, onCell: (r, c) => { if (!p.givens[r][c]) { sel = [r, c]; draw(); } } }),
        h('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:10px' },
          Array.from({ length: n }, (_, i) => h('button', { class: 'ghost', 'data-num': i + 1, style: 'width:46px;height:42px;padding:0;font-size:1.15rem;font-weight:700', disabled: !sel, onclick: () => set(i + 1) }, String(i + 1))),
          h('button', { class: 'ghost', style: 'width:46px;height:42px;padding:0', 'aria-label': 'clear cell', disabled: !sel, onclick: () => set(0) }, '⌫')),
        ctlRow(btn('Reset', reset)),
        done ? OK('Solved: every row, column' + (p.box ? ', box' : '') + (p.cages ? ' and cage' : '') + ' checks out.')
          : h('div', { class: 'readout' }, bad.size || badCage.size ? 'Red means a clash.' : sel ? `Row ${sel[0] + 1}, column ${sel[1] + 1}: pick a number` : `${filled} of ${n * n} filled · tap an empty cell`));
    }
    draw();
    return view;
  };
}

/** Every n x n Latin square (rows and columns each hold 1..n once). */
export function latinSquares(n: number): number[][][] {
  return gridSolutions({ n, givens: Array.from({ length: n }, () => Array(n).fill(0)) }, Infinity);
}

// ---------------------------------------------------------------- coin row (flip two neighbours)

export function flipMin(start: boolean[]): number {
  const n = start.length, key = (s: boolean[]) => s.map((b) => (b ? 'H' : 'T')).join('');
  const path = bfs(start, key, (s) => Array.from({ length: n - 1 }, (_, i) => s.map((b, j) => (j === i || j === i + 1 ? !b : b))), (s) => s.every((b) => b));
  return path ? path.length - 1 : -1;
}

/** Coins in a row (true = heads). Tap two neighbours to flip both. Goal: all heads. */
export function flipTask(start: boolean[]): Widget {
  return (ctx) => {
    let s = start.slice(), sel = -1, moves = 0;
    const view = h('div');
    const reset = () => { s = start.slice(); sel = -1; moves = 0; draw(); };
    const tap = (i: number) => {
      if (s.every((b) => b)) return;
      if (sel === -1 || sel === i) sel = sel === i ? -1 : i;
      else if (Math.abs(sel - i) === 1) { s[sel] = !s[sel]; s[i] = !s[i]; sel = -1; moves++; }
      else sel = i;
      draw();
    };
    function draw() {
      const done = s.every((b) => b);
      ctx.solved?.(done);
      const tails = s.filter((b) => !b).length;
      view.replaceChildren(
        h('div', { style: 'display:flex;gap:5px;justify-content:center;flex-wrap:wrap' }, s.map((b, i) => h('button', {
          'data-coin': i + 1, 'aria-label': `coin ${i + 1}: ${b ? 'heads' : 'tails'}`,
          style: `width:36px;height:36px;padding:0;border-radius:50%;font-weight:800;cursor:pointer;color:${b ? '#2a2118' : '#fff'};background:${b ? C5 : C6};border:3px solid ${sel === i ? 'var(--text)' : 'transparent'};${sel === i ? 'transform:translateY(-4px);' : ''}`,
          onclick: () => tap(i),
        }, b ? 'H' : 'T'))),
        ctlRow(btn('Reset', reset)),
        h('div', { class: 'readout' }, `Moves: ${moves} · tails showing: ${tails}`),
        done ? OK(`All heads in ${moves} moves.`) : NOTE(sel >= 0 ? `Coin ${sel + 1} picked: tap a coin right next to it.` : 'Tap a coin, then one beside it: both flip.'));
    }
    draw();
    return view;
  };
}

// ---------------------------------------------------------------- sliding puzzle

export function slideNext(rows: number, cols: number, s: number[]): number[][] {
  const z = s.indexOf(0), r = Math.floor(z / cols), c = z % cols, out: number[][] = [];
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const r2 = r + dr, c2 = c + dc;
    if (r2 < 0 || c2 < 0 || r2 >= rows || c2 >= cols) continue;
    const t = s.slice(), j = r2 * cols + c2;
    [t[z], t[j]] = [t[j], t[z]];
    out.push(t);
  }
  return out;
}
export const slideGoal = (n: number) => [...Array.from({ length: n - 1 }, (_, i) => i + 1), 0];
export function slideMin(rows: number, cols: number, start: number[]): number {
  const g = slideGoal(rows * cols).join(',');
  const p = bfs(start, (s) => s.join(','), (s) => slideNext(rows, cols, s), (s) => s.join(',') === g);
  return p ? p.length - 1 : -1;
}

/** Tap a tile next to the gap to slide it. Goal: 1, 2, 3, … with the gap last. */
export function slideTask(rows: number, cols: number, start: number[]): Widget {
  return (ctx) => {
    let s = start.slice(), moves = 0;
    const best = slideMin(rows, cols, start);
    const view = h('div');
    const goal = slideGoal(rows * cols).join(',');
    const reset = () => { s = start.slice(); moves = 0; draw(); };
    function draw() {
      const done = s.join(',') === goal;
      ctx.solved?.(done);
      const z = s.indexOf(0);
      view.replaceChildren(
        h('div', { style: `display:grid;grid-template-columns:repeat(${cols},64px);gap:5px;justify-content:center;padding:6px;border-radius:12px;background:var(--panel2);width:max-content;margin:0 auto` },
          s.map((v, i) => {
            const adj = Math.abs(Math.floor(i / cols) - Math.floor(z / cols)) + Math.abs((i % cols) - (z % cols)) === 1;
            return v === 0 ? h('div', { style: 'width:64px;height:64px' }) : h('button', {
              'data-tile': v, 'aria-label': `tile ${v}`,
              style: `width:64px;height:64px;padding:0;border-radius:10px;font-size:1.5rem;font-weight:800;color:var(--text);background:${tint(C1, 28)};border:2px solid ${C1};cursor:${adj ? 'pointer' : 'default'}`,
              onclick: () => { if (adj && !done) { [s[i], s[z]] = [s[z], s[i]]; moves++; draw(); } },
            }, String(v));
          })),
        ctlRow(btn('Reset', reset)),
        h('div', { class: 'readout' }, `Moves: ${moves}`),
        done ? OK(`Sorted in ${moves} moves${moves === best ? ' (the fewest possible)' : `. The fewest is ${best}`}.`) : NOTE('Tap a tile next to the gap to slide it in.'));
    }
    draw();
    return view;
  };
}

/** A static sliding-puzzle board. */
export function slidePic(cols: number, s: number[], opts: { hi?: number[] } = {}): HTMLElement {
  return h('div', { style: `display:grid;grid-template-columns:repeat(${cols},44px);gap:4px;justify-content:center;padding:5px;border-radius:10px;background:var(--panel2);width:max-content;margin:0 auto` },
    s.map((v) => h('div', { style: `width:44px;height:44px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:1.1rem;${v ? `background:${opts.hi?.includes(v) ? tint(C2, 40) : tint(C1, 28)};border:2px solid ${opts.hi?.includes(v) ? C2 : C1}` : ''}` }, v ? String(v) : '')));
}

// ---------------------------------------------------------------- corner race (move left or down)

/** Positions where the player to move loses with best play, by working back from the corner. */
export function cornerLosing(size: number): boolean[][] {
  const lose = Array.from({ length: size }, () => Array(size).fill(false));
  for (let s = 0; s < 2 * size; s++) for (let x = 0; x < size; x++) {
    const y = s - x;
    if (y < 0 || y >= size) continue;
    // Losing if every move goes to a winning square (the corner itself counts as losing for the mover).
    let canWin = false;
    for (let x2 = 0; x2 < x; x2++) if (lose[x2][y]) canWin = true;
    for (let y2 = 0; y2 < y; y2++) if (lose[x][y2]) canWin = true;
    lose[x][y] = !canWin;
  }
  return lose;
}

function cornerBoard(size: number, at: [number, number], o: { onCell?: (x: number, y: number) => void; legal?: boolean; labels?: (x: number, y: number) => string; hiDiag?: boolean; sz?: number }): HTMLElement {
  const sz = o.sz ?? Math.min(38, Math.floor(300 / size));
  const cells: HTMLElement[] = [];
  for (let row = size - 1; row >= 0; row--) {
    cells.push(h('div', { class: 'muted small', style: `width:16px;height:${sz}px;display:grid;place-items:center` }, String(row)));
    for (let x = 0; x < size; x++) {
      const y = row, here = at[0] === x && at[1] === y, corner = x === 0 && y === 0;
      const legal = o.legal && ((y === at[1] && x < at[0]) || (x === at[0] && y < at[1]));
      const lab = o.labels?.(x, y) ?? '';
      const style = `width:${sz}px;height:${sz}px;padding:0;border-radius:4px;display:grid;place-items:center;font-weight:800;font-size:${Math.round(sz * 0.42)}px;border:1px solid var(--line);`
        + `background:${here ? tint(C2, 55) : corner ? tint(C3, 45) : o.hiDiag && x === y ? tint(C6, 30) : legal ? tint(C1, 22) : (x + y) % 2 ? 'var(--panel2)' : 'var(--panel)'};color:var(--text);`
        + (legal ? `cursor:pointer;border-color:${C1};` : '');
      const txt = here ? h('span', { style: `color:${C2};font-size:${Math.round(sz * 0.6)}px;line-height:1` }, '●') : lab || (corner ? '★' : '');
      cells.push(o.onCell ? h('button', { 'data-xy': `${x},${y}`, 'aria-label': `column ${x} row ${y}`, style, 'aria-disabled': legal ? 'false' : 'true', onclick: () => { if (legal) o.onCell!(x, y); } }, txt) : h('div', { style }, txt));
    }
  }
  cells.push(h('div'));
  for (let x = 0; x < size; x++) cells.push(h('div', { class: 'muted small', style: 'text-align:center' }, String(x)));
  return h('div', { style: `display:grid;grid-template-columns:16px repeat(${size},${sz}px);gap:2px;justify-content:center;margin:4px auto` }, cells);
}

/** A static corner-race board with labels per square. */
export function cornerPic(size: number, at: [number, number], labels?: (x: number, y: number) => string, hiDiag = false): HTMLElement {
  return cornerBoard(size, at, { labels, hiDiag, sz: Math.min(34, Math.floor(280 / size)) });
}

/** Play the corner race against the computer, moving first. Solved when you move the token onto ★. */
export function cornerTask(o: { size: number; start: [number, number] }): Widget {
  return (ctx) => {
    let at: [number, number] = [...o.start], turn: 'you' | 'cpu' | 'over' = 'you', won = false, note = '';
    const view = h('div');
    const reset = () => { at = [...o.start]; turn = 'you'; won = false; note = ''; ctx.solved?.(false); draw(); };
    const cpu = () => {
      const [x, y] = at;
      // Best play: move onto the diagonal if possible; if already on it, any move loses, so step one square.
      const to: [number, number] = x !== y ? [Math.min(x, y), Math.min(x, y)] : x > 0 ? [x - 1, y] : [x, y - 1];
      at = to;
      if (to[0] === 0 && to[1] === 0) { turn = 'over'; note = 'The computer reached ★ and wins. Reset and try again.'; }
      else { turn = 'you'; note = `Computer moved to column ${to[0]}, row ${to[1]}. Your move.`; }
      draw();
    };
    const move = (x: number, y: number) => {
      if (turn !== 'you') return;
      at = [x, y];
      if (x === 0 && y === 0) { turn = 'over'; won = true; note = ''; ctx.solved?.(true); draw(); return; }
      turn = 'cpu'; note = 'Computer is thinking…';
      draw();
      setTimeout(cpu, 450);
    };
    function draw() {
      view.replaceChildren(
        cornerBoard(o.size, at, { onCell: move, legal: turn === 'you' }),
        ctlRow(btn('Reset', reset)),
        won ? OK('You reached ★ first. You win!') : turn === 'over' ? BAD(note) : NOTE(note || 'Your move: tap a highlighted square (left along the row, or down the column).'));
    }
    draw();
    return view;
  };
}

// ---------------------------------------------------------------- Lights Out (3 x 3)

export function lightsPress(s: boolean[], i: number, n = 3): boolean[] {
  const r = Math.floor(i / n), c = i % n, t = s.slice();
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const r2 = r + dr, c2 = c + dc;
    if (r2 >= 0 && c2 >= 0 && r2 < n && c2 < n) t[r2 * n + c2] = !t[r2 * n + c2];
  }
  return t;
}
/** Every set of presses (order doesn't matter, twice = never) and the pattern it switches on, from all-off. */
export function lightsTable(n = 3): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (let m = 0; m < 1 << (n * n); m++) {
    let s = Array(n * n).fill(false);
    const presses: number[] = [];
    for (let i = 0; i < n * n; i++) if ((m >> i) & 1) { s = lightsPress(s, i, n); presses.push(i); }
    const k = s.map((b) => (b ? 1 : 0)).join('');
    const prev = out.get(k);
    if (!prev || presses.length < prev.length) out.set(k, presses);
  }
  return out;
}
let LT: Map<string, number[]> | null = null;
/** Fewest presses that switch every light off (the unique press set). */
export function lightsSolve(start: boolean[]): number[] {
  LT ??= lightsTable(3);
  return LT.get(start.map((b) => (b ? 1 : 0)).join(''))!;
}

export function lightsTask(start: boolean[]): Widget {
  return (ctx) => {
    let s = start.slice(), presses = 0;
    const best = lightsSolve(start).length;
    const view = h('div');
    const reset = () => { s = start.slice(); presses = 0; draw(); };
    function draw() {
      const done = s.every((b) => !b);
      ctx.solved?.(done);
      view.replaceChildren(
        h('div', { style: 'display:grid;grid-template-columns:repeat(3,72px);gap:7px;justify-content:center;padding:8px;border-radius:14px;background:var(--panel2);width:max-content;margin:0 auto' },
          s.map((on, i) => h('button', {
            'data-light': i, 'aria-label': `light ${i + 1}: ${on ? 'on' : 'off'}`,
            style: `width:72px;height:72px;padding:0;border-radius:12px;cursor:pointer;font-size:1.4rem;border:2px solid ${on ? C5 : 'var(--line)'};background:${on ? C5 : 'var(--panel)'};${on ? `box-shadow:0 0 14px ${C5};` : ''}color:#2a2118`,
            onclick: () => { if (!done) { s = lightsPress(s, i); presses++; draw(); } },
          }, on ? '✦' : ''))),
        ctlRow(btn('Reset', reset)),
        h('div', { class: 'readout' }, `Presses: ${presses} · lights on: ${s.filter((b) => b).length}`),
        done ? OK(`All dark in ${presses} presses${presses === best ? ' (the fewest possible)' : `. The fewest is ${best}`}.`) : NOTE('A press switches that light and its up/down/left/right neighbours.'));
    }
    draw();
    return view;
  };
}

export function lightsPic(s: boolean[], opts: { press?: number[] } = {}): HTMLElement {
  return h('div', { style: 'display:grid;grid-template-columns:repeat(3,38px);gap:4px;justify-content:center;padding:5px;border-radius:10px;background:var(--panel2);width:max-content;margin:0 auto' },
    s.map((on, i) => h('div', { style: `width:38px;height:38px;border-radius:7px;display:grid;place-items:center;font-weight:800;border:2px solid ${opts.press?.includes(i) ? C2 : on ? C5 : 'var(--line)'};background:${on ? C5 : 'var(--panel)'};color:${on ? '#2a2118' : 'var(--text)'}` }, opts.press?.includes(i) ? '●' : '')));
}

// ---------------------------------------------------------------- handshakes

/** People round a table: tap one, then another, to draw (or remove) their handshake. Solved when every pair is joined. */
export function handshakeTask(names: string[]): Widget {
  return (ctx) => {
    const n = names.length, R = 100, cx = 150, cy = 140;
    const at = names.map((_, i) => ({ x: cx + R * Math.sin((2 * Math.PI * i) / n), y: cy - R * Math.cos((2 * Math.PI * i) / n) }));
    const edges = new Set<string>();
    let sel = -1;
    const view = h('div');
    const tap = (i: number) => {
      if (sel === -1) sel = i;
      else if (sel === i) sel = -1;
      else { const k = `${Math.min(sel, i)}-${Math.max(sel, i)}`; if (edges.has(k)) edges.delete(k); else edges.add(k); sel = -1; }
      draw();
    };
    function draw() {
      const done = edges.size === (n * (n - 1)) / 2;
      ctx.solved?.(done);
      const s = svgBox(300, 280, 300);
      for (const k of edges) {
        const [a, b] = k.split('-').map(Number);
        s.appendChild(svg('line', { x1: at[a].x, y1: at[a].y, x2: at[b].x, y2: at[b].y, style: `stroke:${C1};stroke-width:3;stroke-linecap:round` }));
      }
      names.forEach((nm, i) => {
        const deg = [...edges].filter((k) => k.split('-').map(Number).includes(i)).length;
        const g = svg('g', { 'data-person': i, style: 'cursor:pointer' });
        g.appendChild(svg('circle', { cx: at[i].x, cy: at[i].y, r: 21, style: `fill:${sel === i ? C2 : tint(C3, 55)};stroke:${sel === i ? 'var(--text)' : C3};stroke-width:2.5` }));
        g.appendChild(svg('text', { x: at[i].x, y: at[i].y + 5, 'text-anchor': 'middle', style: 'font-size:15px;font-weight:800;fill:var(--text)' }, nm));
        g.appendChild(svg('text', { x: at[i].x, y: at[i].y + (at[i].y > cy ? 36 : -27), 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--muted)' }, `${deg} hand${deg === 1 ? '' : 's'}`));
        g.addEventListener('click', () => tap(i));
        s.appendChild(g);
      });
      view.replaceChildren(s,
        h('div', { class: 'readout' }, `Handshakes drawn: ${edges.size}`),
        done ? OK(`Everyone has shaken everyone’s hand: ${edges.size} handshakes.`) : NOTE(sel >= 0 ? `${names[sel]} picked: tap someone to shake hands with.` : 'Tap a person, then another. Tap a pair again to remove it.'));
    }
    draw();
    return view;
  };
}

// ---------------------------------------------------------------- chords in a circle (pizza cuts, points on a circle)

function cut(p: [number, number], q: [number, number], r: [number, number], s: [number, number]): [number, number] | null {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-12) return null;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9 ? [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])] : null;
}
const onCircle = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

/** Regions inside a circle cut by chords (angle pairs in degrees), assuming no three chords meet at a point; also returns the crossings. */
export function chordRegions(chords: [number, number][]): { regions: number; crossings: [number, number][] } {
  const segs = chords.map(([a, b]) => [onCircle(a), onCircle(b)] as const);
  const pts: [number, number][] = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const x = cut(segs[i][0], segs[i][1], segs[j][0], segs[j][1]);
    if (x && !pts.some((p) => Math.hypot(p[0] - x[0], p[1] - x[1]) < 1e-6)) pts.push(x);
  }
  // Each chord adds 1 + (number of crossings on it) regions when crossings are simple.
  return { regions: 1 + chords.length + pts.length, crossings: pts };
}

/** A pizza (circle) cut by chords, with a caption giving the piece count. */
export function pizzaPic(chords: [number, number][], caption?: string, maxW = 120): HTMLElement {
  const s = svgBox(120, 120, maxW), c = 60, R = 52;
  s.appendChild(svg('circle', { cx: c, cy: c, r: R, style: `fill:${tint(C5, 45)};stroke:#b07a43;stroke-width:4` }));
  for (const [a, b] of chords) {
    const p = onCircle(a), q = onCircle(b);
    s.appendChild(svg('line', { x1: c + R * p[0], y1: c - R * p[1], x2: c + R * q[0], y2: c - R * q[1], style: 'stroke:var(--text);stroke-width:2' }));
  }
  return h('div', { style: 'text-align:center' }, s, caption ? h('div', { class: 'small', style: 'font-weight:600' }, caption) : null);
}

/** Points on a circle with every chord drawn. */
export function circlePointsPic(angles: number[], caption?: string, maxW = 110): HTMLElement {
  const s = svgBox(120, 120, maxW), c = 60, R = 50;
  s.appendChild(svg('circle', { cx: c, cy: c, r: R, style: 'fill:none;stroke:var(--muted);stroke-width:1.5' }));
  for (let i = 0; i < angles.length; i++) for (let j = i + 1; j < angles.length; j++) {
    const p = onCircle(angles[i]), q = onCircle(angles[j]);
    s.appendChild(svg('line', { x1: c + R * p[0], y1: c - R * p[1], x2: c + R * q[0], y2: c - R * q[1], style: `stroke:${C1};stroke-width:1.4` }));
  }
  for (const a of angles) { const p = onCircle(a); s.appendChild(svg('circle', { cx: c + R * p[0], cy: c - R * p[1], r: 3.5, style: `fill:${C2}` })); }
  return h('div', { style: 'text-align:center' }, s, caption ? h('div', { class: 'small', style: 'font-weight:600' }, caption) : null);
}

// ---------------------------------------------------------------- small pictures

/** A straight fence of `gaps` sections with posts at both ends. */
export function fencePic(gaps: number, label: string, posts = true): HTMLElement {
  const W = 300, x0 = 16, x1 = W - 16, s = svgBox(W, 74, 320);
  s.appendChild(svg('line', { x1: x0, y1: 34, x2: x1, y2: 34, style: 'stroke:#b07a43;stroke-width:4' }));
  for (let i = 0; i <= gaps; i++) {
    const x = x0 + ((x1 - x0) * i) / gaps;
    if (posts) s.appendChild(svg('rect', { x: x - 4, y: 16, width: 8, height: 34, rx: 2, style: `fill:${C2}` }));
    if (i < gaps) s.appendChild(svg('text', { x: x + (x1 - x0) / gaps / 2, y: 66, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--muted)' }, label));
  }
  return h('div', null, s);
}

/** Numbers 1..n in a grid (optional highlight). */
export function numberGrid(n: number, cols = 10, hi: (k: number) => boolean = () => false): HTMLElement {
  return h('div', { style: `display:grid;grid-template-columns:repeat(${cols}, minmax(0, 30px));gap:3px;justify-content:center;margin:4px auto` },
    Array.from({ length: n }, (_, i) => h('div', { style: `height:26px;display:grid;place-items:center;border:1px solid var(--line);border-radius:5px;font-size:.8rem;font-weight:600;font-variant-numeric:tabular-nums;background:${hi(i + 1) ? tint(C2, 40) : 'var(--panel)'}` }, String(i + 1))));
}

/** A row of numbered seats (optionally filled with names). */
export function seatsPic(names: (string | null)[]): HTMLElement {
  return h('div', { style: 'display:flex;gap:6px;justify-content:center;margin:6px 0' }, names.map((nm, i) =>
    h('div', { style: 'text-align:center' },
      h('div', { style: `width:50px;height:44px;border-radius:10px 10px 4px 4px;display:grid;place-items:center;font-weight:700;border:2px solid ${nm ? C3 : 'var(--line)'};background:${nm ? tint(C3, 25) : 'var(--panel2)'}` }, nm ?? ''),
      h('div', { class: 'muted small' }, `seat ${i + 1}`))));
}

/** A 3 x 3 magic square; optional marks: number -> colour. */
export function magicPic(marks: Record<number, string> = {}): HTMLElement {
  const M = [2, 7, 6, 9, 5, 1, 4, 3, 8];
  return h('div', { style: 'display:grid;grid-template-columns:repeat(3,52px);gap:4px;justify-content:center;margin:4px auto' }, M.map((v) =>
    h('div', { style: `height:52px;border-radius:8px;display:grid;place-items:center;font-size:1.4rem;font-weight:800;border:2px solid ${marks[v] ?? 'var(--line)'};background:${marks[v] ? tint(marks[v], 35) : 'var(--panel)'}` }, String(v))));
}

/** Lockers 1..n after `k` people have passed (person j toggles every j-th locker). */
export function lockersPic(n: number, k: number): HTMLElement {
  const open = Array.from({ length: n }, (_, i) => { let c = 0; for (let j = 1; j <= k; j++) if ((i + 1) % j === 0) c++; return c % 2 === 1; });
  return h('div', { style: 'display:flex;gap:3px;justify-content:center;flex-wrap:wrap;margin:4px 0' }, open.map((o, i) =>
    h('div', { style: `width:24px;height:46px;border-radius:3px;display:flex;align-items:flex-end;justify-content:center;font-size:10px;font-weight:700;padding-bottom:2px;border:2px solid ${o ? C3 : 'var(--line)'};background:${o ? tint(C3, 30) : 'var(--panel2)'}` }, String(i + 1))));
}

/** Three-colour token counts as bars. */
export function tokenBars(counts: [number, number, number], names = ['red', 'green', 'blue']): HTMLElement {
  const cols = ['#d64545', '#2fa37a', '#3b7ddd'];
  return h('div', { style: 'display:flex;gap:12px;justify-content:center;align-items:flex-end;margin:6px 0' }, counts.map((c, k) =>
    h('div', { style: 'text-align:center' },
      h('div', { style: 'display:flex;flex-direction:column-reverse;gap:2px;align-items:center;min-height:120px' },
        Array.from({ length: c }, () => h('span', { style: `width:13px;height:13px;border-radius:50%;background:${cols[k]}` }))),
      h('div', { class: 'small', style: 'font-weight:700' }, `${c} ${names[k]}`))));
}
