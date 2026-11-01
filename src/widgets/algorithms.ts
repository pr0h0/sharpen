// Algorithms course: the algorithms themselves (instrumented, so lessons and practice problems
// get their answers and animation frames by running them) and the interactive pieces built on them:
// guess-my-number, neighbour-swap sorting, maze walking, path picking, coin making, meeting picking.
import type { Widget } from '../types';
import { h } from '../ui';
import { stepper } from '../viz/explore';
import { arrayBars, cellGrid, cells, network, type NetEdge, type NetNode } from '../viz/cs';

const ACC = 'var(--accent, var(--accent-default))';
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, var(--panel))`;
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);
const msg = () => h('div', { class: 'w-msg', style: 'text-align:center;min-height:1.4em;' });
const stats = () => h('div', { class: 'w-stats', style: 'justify-content:center;' });
const btn = (label: string, onclick: () => void) => h('button', { class: 'ghost small-btn', onclick }, label);

// ================================================================ algorithms (pure)

/** Max-so-far scan: the indices where `best` gets set (the first item counts) and the comparisons. */
export function maxScan(a: number[]): { records: number[]; comparisons: number } {
  const records = [0];
  let best = a[0], comparisons = 0;
  for (let i = 1; i < a.length; i++) {
    comparisons++;
    if (a[i] > best) { best = a[i]; records.push(i); }
  }
  return { records, comparisons };
}

/** Out-of-order pairs: the fewest neighbour swaps that sort the list. */
export function inversions(a: number[]): number {
  let c = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++;
  return c;
}

export interface SortFrame { arr: number[]; hi?: number[]; done?: number[]; note: string; cmp: number }

export function selectionSort(a0: number[]): { frames: SortFrame[]; comparisons: number; passes: number[][] } {
  const a = a0.slice();
  let cmp = 0;
  const frames: SortFrame[] = [{ arr: a.slice(), note: 'Start.', cmp }];
  const passes = [a.slice()];
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) { cmp++; if (a[j] < a[m]) m = j; }
    const moved = m !== i;
    [a[i], a[m]] = [a[m], a[i]];
    frames.push({ arr: a.slice(), hi: moved ? [i, m] : [i], done: range(0, i + 1), cmp,
      note: moved ? `Smallest of the rest is ${a[i]}: swap it into slot ${i}.` : `${a[i]} is already the smallest of the rest.` });
    passes.push(a.slice());
  }
  frames[frames.length - 1].done = range(0, a.length);
  return { frames, comparisons: cmp, passes };
}

export function insertionSort(a0: number[]): { frames: SortFrame[]; comparisons: number; swaps: number } {
  const a = a0.slice();
  let cmp = 0, swaps = 0;
  const frames: SortFrame[] = [{ arr: a.slice(), done: [0], note: 'Start: the first item alone is sorted.', cmp }];
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      cmp++;
      if (a[j - 1] <= a[j]) break;
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      swaps++;
      j--;
      frames.push({ arr: a.slice(), hi: [j], done: range(0, i + 1).filter((k) => k !== j), note: `${a[j]} is smaller than its left neighbour: swap.`, cmp });
    }
    frames.push({ arr: a.slice(), done: range(0, i + 1), note: `${a[j]} is in place. The first ${i + 1} items are sorted.`, cmp });
  }
  return { frames, comparisons: cmp, swaps };
}

/** Comparisons made merging two sorted lists. */
export function mergeCount(L: number[], R: number[]): { out: number[]; comparisons: number } {
  const out: number[] = [];
  let i = 0, j = 0, comparisons = 0;
  while (i < L.length && j < R.length) {
    comparisons++;
    if (L[i] <= R[j]) out.push(L[i++]); else out.push(R[j++]);
  }
  return { out: out.concat(L.slice(i), R.slice(j)), comparisons };
}

export function mergeSort(a0: number[]): { frames: SortFrame[]; comparisons: number } {
  const a = a0.slice();
  let cmp = 0;
  const frames: SortFrame[] = [{ arr: a.slice(), note: 'Start: split into halves until each piece is one item.', cmp }];
  const rec = (lo: number, hi: number) => { // [lo, hi)
    if (hi - lo < 2) return;
    const mid = (lo + hi) >> 1;
    rec(lo, mid);
    rec(mid, hi);
    const m = mergeCount(a.slice(lo, mid), a.slice(mid, hi));
    cmp += m.comparisons;
    m.out.forEach((v, k) => { a[lo + k] = v; });
    frames.push({ arr: a.slice(), hi: range(lo, hi), cmp, note: `Merge slots ${lo}–${mid - 1} with ${mid}–${hi - 1}: ${m.comparisons} comparison${m.comparisons === 1 ? '' : 's'}.` });
  };
  rec(0, a.length);
  frames[frames.length - 1].done = range(0, a.length);
  frames[frames.length - 1].hi = [];
  return { frames, comparisons: cmp };
}

export interface BsFrame { lo: number; hi: number; mid?: number; note: string }

/** Binary search with the usual lo/hi/mid; frames for a stepper. */
export function binarySearch(a: number[], target: number): { frames: BsFrame[]; probes: number; found: number } {
  let lo = 0, hi = a.length - 1, probes = 0;
  const frames: BsFrame[] = [{ lo, hi, note: `Looking for ${target}. Everything from lo to hi might hold it.` }];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    probes++;
    if (a[mid] === target) { frames.push({ lo, hi, mid, note: `Probe ${probes}: a[${mid}] = ${target}. Found it.` }); return { frames, probes, found: mid }; }
    if (a[mid] < target) {
      frames.push({ lo, hi, mid, note: `Probe ${probes}: a[${mid}] = ${a[mid]} < ${target}, so it can only be to the right.` });
      lo = mid + 1;
    } else {
      frames.push({ lo, hi, mid, note: `Probe ${probes}: a[${mid}] = ${a[mid]} > ${target}, so it can only be to the left.` });
      hi = mid - 1;
    }
    frames.push({ lo, hi, note: lo <= hi ? `${hi - lo + 1} candidate${hi === lo ? '' : 's'} left.` : 'Nothing left: it isn’t there.' });
  }
  return { frames, probes, found: -1 };
}

/** Worst-case guesses for binary search over n candidates (always probing the middle). */
export function worstProbes(n: number): number {
  let k = 0;
  while (n > 0) { n = Math.floor(n / 2); k++; }
  return k;
}

// ---------------------------------------------------------------- graphs

export interface Graph { nodes: NetNode[]; edges: NetEdge[] }
export interface Arc { to: string; w: number }

export function adjacency(g: Graph): Record<string, Arc[]> {
  const out: Record<string, Arc[]> = Object.fromEntries(g.nodes.map((n) => [n.id, [] as Arc[]]));
  for (const e of g.edges) {
    const w = typeof e.w === 'number' ? e.w : 1;
    out[e.a].push({ to: e.b, w });
    if (!e.directed) out[e.b].push({ to: e.a, w });
  }
  for (const k in out) out[k].sort((x, y) => (x.to < y.to ? -1 : 1));
  return out;
}

export const degree = (g: Graph, id: string) => g.edges.filter((e) => e.a === id || e.b === id).length;
export const edgeKey = (a: string, b: string) => `${a}-${b}`;

/** Breadth-first search; neighbours are queued in alphabetical order. */
export function bfs(g: Graph, s: string): { order: string[]; dist: Record<string, number>; prev: Record<string, string> } {
  const adj = adjacency(g);
  const dist: Record<string, number> = { [s]: 0 }, prev: Record<string, string> = {};
  const order: string[] = [], queue = [s];
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    for (const { to } of adj[u]) if (!(to in dist)) { dist[to] = dist[u] + 1; prev[to] = u; queue.push(to); }
  }
  return { order, dist, prev };
}

export function pathTo(prev: Record<string, string>, s: string, t: string): string[] {
  const p = [t];
  while (p[0] !== s) { const q = prev[p[0]]; if (q === undefined) return []; p.unshift(q); }
  return p;
}

export const pathEdges = (p: string[]) => p.slice(1).map((v, k) => edgeKey(p[k], v));

export function pathWeight(g: Graph, p: string[]): number {
  const adj = adjacency(g);
  let w = 0;
  for (let k = 1; k < p.length; k++) {
    const arc = adj[p[k - 1]].find((a) => a.to === p[k]);
    if (!arc) return NaN;
    w += arc.w;
  }
  return w;
}

export interface DjFrame { settled: string[]; dist: Record<string, number>; cur?: string; tree: string[]; note: string }

/** Dijkstra from s (ties broken alphabetically), with a frame per settled node. */
export function dijkstra(g: Graph, s: string): { dist: Record<string, number>; prev: Record<string, string>; frames: DjFrame[]; order: string[] } {
  const adj = adjacency(g);
  const dist: Record<string, number> = Object.fromEntries(g.nodes.map((n) => [n.id, Infinity]));
  const prev: Record<string, string> = {};
  dist[s] = 0;
  const settled: string[] = [];
  const tree = () => settled.filter((v) => prev[v]).map((v) => edgeKey(prev[v], v));
  const frames: DjFrame[] = [{ settled: [], dist: { ...dist }, tree: [], note: `Start: ${s} is 0 away; everything else is unknown (∞).` }];
  for (;;) {
    const open = g.nodes.map((n) => n.id).filter((v) => !settled.includes(v) && dist[v] < Infinity).sort((a, b) => dist[a] - dist[b] || (a < b ? -1 : 1));
    if (!open.length) break;
    const u = open[0];
    settled.push(u);
    const upd: string[] = [];
    for (const { to, w } of adj[u]) {
      if (settled.includes(to)) continue;
      if (dist[u] + w < dist[to]) { dist[to] = dist[u] + w; prev[to] = u; upd.push(`${to} → ${dist[to]}`); }
    }
    frames.push({ settled: settled.slice(), dist: { ...dist }, cur: u, tree: tree(),
      note: `Settle ${u} (closest unsettled, ${dist[u]}).${upd.length ? ' Update: ' + upd.join(', ') + '.' : ' No neighbour gets closer.'}` });
  }
  return { dist, prev, frames, order: settled };
}

export function dijkstraStepper(g: Graph, s: string): HTMLElement {
  const { frames } = dijkstra(g, s);
  return stepper(frames.length, (i) => {
    const f = frames[i];
    return network(g.nodes, g.edges, { hiNodes: f.settled, hiEdges: f.tree,
      nodeText: Object.fromEntries(g.nodes.map((n) => [n.id, f.dist[n.id] === Infinity ? '∞' : String(f.dist[n.id])])) });
  }, { caption: (i) => frames[i].note, autoplayMs: 1300 });
}

// ---------------------------------------------------------------- grids and mazes

export interface Maze { R: number; C: number; wall: boolean[][]; s: [number, number]; e: [number, number] }

/** Rows of '#' (wall), '.', 'S' (start), 'E' (exit). */
export function parseMaze(rows: string[]): Maze {
  let s: [number, number] = [0, 0], e: [number, number] = [0, 0];
  const wall = rows.map((row, r) => [...row].map((ch, c) => {
    if (ch === 'S') s = [r, c];
    if (ch === 'E') e = [r, c];
    return ch === '#';
  }));
  return { R: rows.length, C: rows[0].length, wall, s, e };
}

const DIRS: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

/** BFS distances from the start (-1 = unreachable). */
export function mazeDist(m: Maze): number[][] {
  const d = m.wall.map((row) => row.map(() => -1));
  d[m.s[0]][m.s[1]] = 0;
  const q: [number, number][] = [m.s];
  while (q.length) {
    const [r, c] = q.shift()!;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= m.R || cc >= m.C || m.wall[rr][cc] || d[rr][cc] >= 0) continue;
      d[rr][cc] = d[r][c] + 1;
      q.push([rr, cc]);
    }
  }
  return d;
}

/** One shortest route, start to exit, by walking back down the distances. */
export function mazePath(m: Maze, d = mazeDist(m)): [number, number][] {
  if (d[m.e[0]][m.e[1]] < 0) return [];
  const p: [number, number][] = [m.e];
  while (d[p[0][0]][p[0][1]] > 0) {
    const [r, c] = p[0];
    const back = DIRS.map(([dr, dc]) => [r + dr, c + dc] as [number, number])
      .find(([rr, cc]) => rr >= 0 && cc >= 0 && rr < m.R && cc < m.C && d[rr][cc] === d[r][c] - 1)!;
    p.unshift(back);
  }
  return p;
}

const WALL = 'var(--muted)';
const cellSize = (m: Maze) => Math.min(40, Math.floor(300 / m.C));

/** The maze, with optional distance numbers. */
export function mazeView(m: Maze, opts: { dist?: number[][]; upto?: number; path?: [number, number][] } = {}): HTMLElement {
  const onPath = new Set((opts.path ?? []).map(([r, c]) => r * 1000 + c));
  return cellGrid(m.R, m.C, (r, c) => {
    if (m.wall[r][c]) return { fill: WALL };
    const se = r === m.s[0] && c === m.s[1] ? 'S' : r === m.e[0] && c === m.e[1] ? 'E' : '';
    const d = opts.dist?.[r][c] ?? -1;
    const shown = d >= 0 && d <= (opts.upto ?? Infinity);
    const fill = onPath.has(r * 1000 + c) ? tint('var(--c3)', 60) : shown ? (d === opts.upto ? tint('var(--c2)', 55) : tint('var(--c1)', 22)) : undefined;
    return { fill, text: se && !(shown && opts.dist) ? se : shown ? String(d) : se };
  }, { size: cellSize(m) });
}

/** BFS on a maze, one ring of equal distance per frame, then the route found. */
export function mazeBfsStepper(m: Maze): HTMLElement {
  const d = mazeDist(m);
  const goal = d[m.e[0]][m.e[1]];
  const path = mazePath(m, d);
  const n = goal + 2;
  return stepper(n, (i) => i <= goal ? mazeView(m, { dist: d, upto: i }) : mazeView(m, { dist: d, upto: goal, path }), {
    caption: (i) => {
      if (i > goal) return `Walk back from E, always to a number one smaller: a shortest route, ${goal} steps.`;
      const k = d.flat().filter((x) => x === i).length;
      return i === 0 ? 'Ring 0: the start.' : `Ring ${i}: ${k} new cell${k === 1 ? '' : 's'}, each one step from ring ${i - 1}.${i === goal ? ' The exit is in this ring.' : ''}`;
    }, autoplayMs: 800,
  });
}

/** Task: click cells to walk from S to E; solved when E is reached in the fewest possible steps. */
export function mazeWalk(rows: string[]): Widget {
  const m = parseMaze(rows);
  const best = mazeDist(m)[m.e[0]][m.e[1]];
  return (ctx) => {
    let path: [number, number][] = [m.s];
    const box = h('div');
    const st = stats(), note = msg();
    const draw = () => {
      const on = new Map(path.map(([r, c], k) => [r * 1000 + c, k]));
      box.replaceChildren(cellGrid(m.R, m.C, (r, c) => {
        if (m.wall[r][c]) return { fill: WALL };
        const k = on.get(r * 1000 + c);
        const se = r === m.s[0] && c === m.s[1] ? 'S' : r === m.e[0] && c === m.e[1] ? 'E' : '';
        return { fill: k !== undefined ? tint('var(--c3)', k === path.length - 1 ? 85 : 50) : undefined, text: se || (k !== undefined ? String(k) : '') };
      }, { size: cellSize(m), onCell: click }));
      const [r, c] = path[path.length - 1];
      const at = r === m.e[0] && c === m.e[1];
      const steps = path.length - 1;
      st.replaceChildren(h('span', null, h('strong', null, String(steps)), ` step${steps === 1 ? '' : 's'} so far`));
      note.textContent = at ? (steps === best ? `✓ Out in ${steps} steps. No route is shorter.` : `Out in ${steps} steps, but there is a shorter route.`) : 'Tap a square next to the end of your trail. Tap your trail to back up.';
      ctx.solved?.(at && steps === best);
    };
    const click = (r: number, c: number) => {
      if (m.wall[r][c]) return;
      const k = path.findIndex(([a, b]) => a === r && b === c);
      if (k >= 0) { path = path.slice(0, Math.max(1, k + (k === path.length - 1 ? 0 : 1))); draw(); return; }
      const [lr, lc] = path[path.length - 1];
      if (lr === m.e[0] && lc === m.e[1]) return;
      if (Math.abs(lr - r) + Math.abs(lc - c) !== 1) { note.textContent = 'Move one square at a time: up, down, left or right.'; return; }
      path.push([r, c]);
      draw();
    };
    draw();
    return h('div', null, box, st, note, h('div', { class: 'w-btns', style: 'justify-content:center;' }, btn('Start over', () => { path = [m.s]; draw(); })));
  };
}

/** Number of monotone (right/down) paths to every cell; blocked cells hold 0. */
export function gridPaths(R: number, C: number, blocked: [number, number][] = []): number[][] {
  const bl = new Set(blocked.map(([r, c]) => r * 1000 + c));
  const t = Array.from({ length: R }, () => Array(C).fill(0) as number[]);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (bl.has(r * 1000 + c)) continue;
    t[r][c] = r === 0 && c === 0 ? 1 : (r ? t[r - 1][c] : 0) + (c ? t[r][c - 1] : 0);
  }
  return t;
}

/** Fill the grid-paths table one cell at a time. */
export function gridPathsStepper(R: number, C: number, blocked: [number, number][] = []): HTMLElement {
  const t = gridPaths(R, C, blocked);
  const bl = new Set(blocked.map(([r, c]) => r * 1000 + c));
  const n = R * C;
  return stepper(n, (i) => {
    const cr = Math.floor(i / C), cc = i % C;
    return cellGrid(R, C, (r, c) => {
      const k = r * C + c;
      if (bl.has(r * 1000 + c)) return { fill: WALL };
      const src = (r === cr - 1 && c === cc) || (r === cr && c === cc - 1);
      return { fill: k === i ? tint('var(--c2)', 55) : src && k < i ? tint('var(--c1)', 35) : k < i ? tint('var(--c1)', 12) : undefined, text: k <= i ? String(t[r][c]) : '' };
    }, { size: Math.min(44, Math.floor(300 / C)) });
  }, {
    caption: (i) => {
      const r = Math.floor(i / C), c = i % C;
      if (bl.has(r * 1000 + c)) return 'A blocked square: 0 ways through it.';
      if (i === 0) return 'The start: 1 way (stay put).';
      const up = r ? t[r - 1][c] : 0, left = c ? t[r][c - 1] : 0;
      return `Arrive from above (${up}) or from the left (${left}): ${up} + ${left} = ${t[r][c]}.`;
    }, autoplayMs: 650,
  });
}

/** Task: type the missing numbers of a grid-paths table. */
export function gridPathsQuiz(R: number, C: number, blanks: [number, number][], blocked: [number, number][] = []): Widget {
  const t = gridPaths(R, C, blocked);
  const bl = new Set(blocked.map(([r, c]) => r * 1000 + c));
  return (ctx) => {
    const inputs: { el: HTMLInputElement; want: number }[] = [];
    const sz = Math.min(52, Math.floor(310 / C));
    const grid = h('div', { class: 'cellgrid', style: `grid-template-columns:repeat(${C}, ${sz}px)` });
    const note = msg();
    const check = () => {
      const ok = inputs.every((i) => Number(i.el.value) === i.want && i.el.value.trim() !== '');
      inputs.forEach((i) => { i.el.style.borderColor = i.el.value.trim() === '' ? 'var(--line)' : Number(i.el.value) === i.want ? 'var(--good)' : 'var(--line)'; });
      note.textContent = ok ? '✓ The table is complete.' : '';
      ctx.solved?.(ok);
    };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const isBlank = blanks.some(([a, b]) => a === r && b === c);
      const cell = h('div', { class: 'gc', style: `height:${sz}px;${bl.has(r * 1000 + c) ? `background:${WALL};` : isBlank ? `background:${tint('var(--c2)', 30)};` : ''}` });
      if (isBlank) {
        const el = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': `row ${r + 1}, column ${c + 1}`, style: `width:${sz - 8}px;height:${sz - 12}px;text-align:center;font:inherit;font-weight:700;border:2px solid var(--line);border-radius:6px;background:var(--panel);color:var(--text);padding:0;` }) as HTMLInputElement;
        el.addEventListener('input', check);
        inputs.push({ el, want: t[r][c] });
        cell.appendChild(el);
      } else if (!bl.has(r * 1000 + c)) cell.textContent = String(t[r][c]);
      grid.appendChild(cell);
    }
    return h('div', null, grid, note);
  };
}

// ---------------------------------------------------------------- recursion, coins, schedules, knapsack

/** Calls made by the naive recursive Fibonacci (fib(0) and fib(1) are base cases). */
export function fibCalls(n: number): number {
  let calls = 0;
  const f = (k: number): number => { calls++; return k < 2 ? k : f(k - 1) + f(k - 2); };
  f(n);
  return calls;
}

/** Ways to climb n stairs taking any of the allowed step sizes. */
export function stairs(n: number, steps: number[] = [1, 2]): number {
  const w = [1];
  for (let k = 1; k <= n; k++) w[k] = steps.reduce((s, d) => s + (k - d >= 0 ? w[k - d] : 0), 0);
  return w[n];
}

/** The naive fib(n) call tree; nodes with value `mark` highlighted (repeated work). */
export function fibTree(n: number, mark: number): HTMLElement {
  const nodes: NetNode[] = [], edges: NetEdge[] = [], hi: string[] = [];
  let leaf = 0, maxDepth = 0;
  const raw: { id: string; v: number; x: number; d: number }[] = [];
  const rec = (v: number, d: number): number => {
    const id = `n${raw.length}`;
    const me = { id, v, x: 0, d };
    raw.push(me);
    maxDepth = Math.max(maxDepth, d);
    if (v < 2) { me.x = leaf++; return raw.indexOf(me); }
    const a = rec(v - 1, d + 1), b = rec(v - 2, d + 1);
    edges.push({ a: id, b: raw[a].id }, { a: id, b: raw[b].id });
    me.x = (raw[a].x + raw[b].x) / 2;
    return raw.indexOf(me);
  };
  rec(n, 0);
  for (const r of raw) {
    nodes.push({ id: r.id, label: String(r.v), x: 2 + (r.x / Math.max(1, leaf - 1)) * 96, y: 4 + (r.d / Math.max(1, maxDepth)) * 52 });
    if (r.v === mark) hi.push(r.id);
  }
  return network(nodes, edges, { hiNodes: hi });
}

/** Greedy change: the biggest coin that fits, again and again. */
export function greedyCoins(coins: number[], amount: number): number[] {
  const out: number[] = [];
  for (const c of coins.slice().sort((a, b) => b - a)) while (amount >= c) { amount -= c; out.push(c); }
  return amount === 0 ? out : [];
}

/** Fewest coins (dynamic programming); Infinity if it can't be made. */
export function minCoins(coins: number[], amount: number): number {
  const best = [0];
  for (let a = 1; a <= amount; a++) best[a] = Math.min(Infinity, ...coins.filter((c) => c <= a).map((c) => best[a - c] + 1));
  return best[amount];
}

const coinChip = (c: number, onclick?: () => void) => h(onclick ? 'button' : 'span', {
  onclick, 'aria-label': `${c}¢ coin`,
  style: `display:inline-grid;place-items:center;width:${c >= 25 ? 46 : c >= 10 ? 40 : 34}px;height:${c >= 25 ? 46 : c >= 10 ? 40 : 34}px;border-radius:50%;font-weight:700;font-size:.85rem;padding:0;background:${tint('var(--c4)', c >= 10 ? 45 : 25)};color:var(--text);border:2px solid ${tint('var(--c4)', 80)};`,
}, `${c}¢`);

/** Frames of greedy change-making. */
export function greedyStepper(coins: number[], amount: number): HTMLElement {
  const picks = greedyCoins(coins, amount);
  return stepper(picks.length + 1, (i) => h('div', { style: 'text-align:center;' },
    h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:50px;align-items:center;margin:6px 0;' }, picks.slice(0, i).map((c) => coinChip(c))),
    h('div', { class: 'w-stats', style: 'justify-content:center;' },
      h('span', null, 'still to pay ', h('strong', null, `${amount - picks.slice(0, i).reduce((s, c) => s + c, 0)}¢`)),
      h('span', null, h('strong', null, String(i)), ' coins'))), {
    caption: (i) => {
      if (i === 0) return `Pay ${amount}¢ with coins of ${coins.slice().sort((a, b) => b - a).join(', ')}¢.`;
      const left = amount - picks.slice(0, i - 1).reduce((s, c) => s + c, 0);
      return `${left}¢ to go: the biggest coin that fits is ${picks[i - 1]}¢.`;
    }, autoplayMs: 900,
  });
}

/** Task: pay `target` with the fewest coins. */
export function coinMaker(coins: number[], target: number): Widget {
  const best = minCoins(coins, target);
  return (ctx) => {
    let picked: number[] = [];
    const tray = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:52px;align-items:center;padding:6px;border:1px dashed var(--line);border-radius:12px;margin:8px 0;' });
    const st = stats(), note = msg();
    const draw = () => {
      const sum = picked.reduce((s, c) => s + c, 0);
      tray.replaceChildren(...(picked.length ? picked.map((c, k) => coinChip(c, () => { picked.splice(k, 1); draw(); })) : [h('span', { class: 'muted small' }, 'Your coins go here (tap one to take it back).')]));
      st.replaceChildren(h('span', null, 'paid ', h('strong', null, `${sum}¢`), ` of ${target}¢`), h('span', null, h('strong', null, String(picked.length)), ` coin${picked.length === 1 ? '' : 's'}`));
      note.textContent = sum > target ? 'Too much: take a coin back.' : sum < target ? '' : picked.length === best ? `✓ ${target}¢ in ${best} coins. You can’t do it in fewer.` : `That pays ${target}¢ with ${picked.length} coins. Can you use fewer?`;
      ctx.solved?.(sum === target && picked.length === best);
    };
    draw();
    return h('div', { style: 'text-align:center;' },
      h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:center;' },
        coins.slice().sort((a, b) => b - a).map((c) => coinChip(c, () => { picked.push(c); picked.sort((a, b) => b - a); draw(); }))),
      h('div', { class: 'muted small', style: 'margin-top:4px;' }, 'Tap a coin to add it.'),
      tray, st, note);
  };
}

export interface Meeting { name: string; s: number; e: number }

export const overlaps = (a: Meeting, b: Meeting) => a.s < b.e && b.s < a.e;

/** Earliest-finish greedy: the picked meetings, in the order picked. */
export function greedySchedule(ms: Meeting[]): Meeting[] {
  const out: Meeting[] = [];
  let free = -Infinity;
  for (const m of ms.slice().sort((a, b) => a.e - b.e || a.s - b.s)) if (m.s >= free) { out.push(m); free = m.e; }
  return out;
}

/** Brute force over every subset: the largest number of non-overlapping meetings. */
export function bestSchedule(ms: Meeting[]): number {
  let best = 0;
  for (let mask = 0; mask < 1 << ms.length; mask++) {
    const sel = ms.filter((_, k) => (mask >> k) & 1);
    if (sel.length <= best) continue;
    if (sel.every((a, i) => sel.every((b, j) => i >= j || !overlaps(a, b)))) best = sel.length;
  }
  return best;
}

/** A day of meetings as bars; `picked` names are highlighted. Clickable when onPick is given. */
function timeline(ms: Meeting[], picked: Set<string>, onPick?: (name: string) => void): HTMLElement {
  const t0 = Math.min(...ms.map((m) => m.s)), t1 = Math.max(...ms.map((m) => m.e));
  const pos = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const clash = new Set(ms.filter((a) => picked.has(a.name) && ms.some((b) => b !== a && picked.has(b.name) && overlaps(a, b))).map((m) => m.name));
  const rows = ms.map((m) => {
    const on = picked.has(m.name);
    const narrow = pos(m.e) - pos(m.s) < 26;
    const label = `${m.name} ${m.s}–${m.e}`;
    const bar = h('span', {
      style: `position:absolute;left:${pos(m.s)}%;width:${pos(m.e) - pos(m.s)}%;top:2px;bottom:2px;border-radius:7px;padding:0 6px;font-weight:700;font-size:.85rem;display:flex;align-items:center;white-space:nowrap;overflow:hidden;color:var(--text);box-sizing:border-box;` +
        `background:${clash.has(m.name) ? tint('var(--bad)', 45) : on ? tint('var(--c3)', 60) : 'var(--panel2)'};border:2px solid ${clash.has(m.name) ? 'var(--bad)' : on ? 'var(--c3)' : 'var(--line)'};`,
    }, narrow ? '' : label);
    const outside = narrow ? h('span', { style: `position:absolute;top:0;bottom:0;display:flex;align-items:center;font-weight:700;font-size:.85rem;white-space:nowrap;${pos(m.e) > 70 ? `right:${100 - pos(m.s)}%;padding-right:5px;` : `left:${pos(m.e)}%;padding-left:5px;`}` }, label) : null;
    return h(onPick ? 'button' : 'div', {
      onclick: onPick ? () => onPick(m.name) : undefined, 'aria-pressed': onPick ? String(on) : undefined, 'aria-label': onPick ? `meeting ${label}` : undefined,
      style: 'position:relative;display:block;width:100%;height:30px;padding:0;margin:0;border:0;background:none;color:var(--text);font:inherit;' + (onPick ? 'cursor:pointer;' : ''),
    }, bar, outside);
  });
  const ticks = range(t0, t1 + 1).map((t) => h('span', { style: `position:absolute;left:${pos(t)}%;transform:translateX(-50%);font-size:.75rem;color:var(--muted);` }, String(t)));
  const lines = range(t0, t1 + 1).map((t) => h('span', { style: `position:absolute;left:${pos(t)}%;top:0;bottom:0;border-left:1px dashed var(--line);` }));
  return h('div', { style: 'position:relative;margin:4px 10px 0;' },
    h('div', { style: 'position:absolute;inset:0 0 18px 0;pointer-events:none;' }, lines),
    rows, h('div', { style: 'position:relative;height:18px;' }, ticks));
}

export function scheduleView(ms: Meeting[], picked: string[] = []): HTMLElement {
  return timeline(ms, new Set(picked));
}

/** Task: book as many non-overlapping meetings as possible. */
export function scheduler(ms: Meeting[]): Widget {
  const best = bestSchedule(ms);
  return (ctx) => {
    const picked = new Set<string>();
    const box = h('div'), st = stats(), note = msg();
    const draw = () => {
      box.replaceChildren(timeline(ms, picked, (n) => { if (picked.has(n)) picked.delete(n); else picked.add(n); draw(); }));
      const sel = ms.filter((m) => picked.has(m.name));
      const clash = sel.some((a, i) => sel.some((b, j) => i < j && overlaps(a, b)));
      st.replaceChildren(h('span', null, h('strong', null, String(sel.length)), ` meeting${sel.length === 1 ? '' : 's'} booked`));
      note.textContent = clash ? 'Two of your meetings overlap (red). One room can’t hold both.' : sel.length === best ? `✓ ${best} meetings, no overlaps. That’s the most possible.` : sel.length ? 'No overlaps so far. Can you fit more?' : 'Tap meetings to book them.';
      ctx.solved?.(!clash && sel.length === best);
    };
    draw();
    return h('div', null, box, st, note);
  };
}

export interface Item { name: string; kg: number; value: number }

export function knapsackBest(items: Item[], cap: number): number {
  let best = 0;
  for (let mask = 0; mask < 1 << items.length; mask++) {
    const sel = items.filter((_, k) => (mask >> k) & 1);
    if (sel.reduce((s, i) => s + i.kg, 0) <= cap) best = Math.max(best, sel.reduce((s, i) => s + i.value, 0));
  }
  return best;
}

export function knapsackGreedy(items: Item[], cap: number): Item[] {
  const out: Item[] = [];
  for (const it of items.slice().sort((a, b) => b.value / b.kg - a.value / a.kg)) if (it.kg <= cap) { out.push(it); cap -= it.kg; }
  return out;
}

// ================================================================ widgets

/** Max-so-far scan, one comparison per frame. */
export function maxStepper(a: number[]): HTMLElement {
  const frames: { i: number; best: number; note: string }[] = [{ i: 0, best: 0, note: `best = ${a[0]} (the first item).` }];
  let b = 0;
  for (let i = 1; i < a.length; i++) {
    const nb = a[i] > a[b] ? i : b;
    frames.push({ i, best: nb, note: `Compare ${a[i]} with best ${a[b]}: ${nb === i ? `bigger, so best = ${a[i]}.` : 'not bigger, keep it.'}` });
    b = nb;
  }
  frames.push({ i: -1, best: b, note: `Done after ${a.length - 1} comparisons: the largest is ${a[b]}.` });
  return stepper(frames.length, (k) => {
    const f = frames[k];
    return cells(a, { hi: [f.best], dim: f.i < 0 ? [] : range(f.i + 1, a.length), pointer: f.i < 0 ? { best: f.best } : f.i === f.best ? { 'i best': f.i } : { i: f.i, best: f.best } });
  }, { caption: (k) => frames[k].note, autoplayMs: 900 });
}

/** Task: tap every item that becomes the new best during a max-so-far scan. */
export function recordPicker(a: number[]): Widget {
  const want = new Set(maxScan(a).records);
  return (ctx) => {
    const sel = new Set<number>();
    const row = h('div', { class: 'cells' });
    const st = stats();
    const draw = () => {
      row.replaceChildren(...a.map((v, k) => h('button', {
        class: `cell${sel.has(k) ? ' hi' : ''}`, style: 'background:none;border:0;padding:0;cursor:pointer;color:var(--text);font:inherit;',
        'aria-pressed': String(sel.has(k)), onclick: () => { if (sel.has(k)) sel.delete(k); else sel.add(k); draw(); },
      }, h('span', { class: 'cell-v' }, String(v)), h('span', { class: 'cell-i' }, String(k)), h('span', { class: 'cell-p' }, sel.has(k) ? 'best' : ''))));
      st.replaceChildren(h('span', null, h('strong', null, String(sel.size)), ' marked'));
      ctx.solved?.(sel.size === want.size && [...sel].every((k) => want.has(k)));
    };
    draw();
    return h('div', null, row, st);
  };
}

/** Binary search as cells with lo / mid / hi pointers. */
export function bsStepper(a: number[], target: number): HTMLElement {
  const { frames } = binarySearch(a, target);
  return stepper(frames.length, (i) => {
    const f = frames[i];
    const ptr: Record<string, number> = { lo: f.lo, hi: f.hi };
    if (f.mid !== undefined) ptr.mid = f.mid;
    return cells(a, { hi: f.mid !== undefined ? [f.mid] : [], dim: a.map((_, k) => k).filter((k) => k < f.lo || k > f.hi), pointer: ptr });
  }, { caption: (i) => frames[i].note, autoplayMs: 1100 });
}

export function sortStepper(frames: SortFrame[], showCmp = true): HTMLElement {
  const max = Math.max(...frames[0].arr);
  return stepper(frames.length, (i) => arrayBars(frames[i].arr, { hi: frames[i].hi, done: frames[i].done, max }), {
    caption: (i) => frames[i].note + (showCmp ? ` (${frames[i].cmp} comparison${frames[i].cmp === 1 ? '' : 's'} so far)` : ''), autoplayMs: 900,
  });
}

/** Task: sort by swapping neighbours; counts swaps. */
export function swapSorter(start: number[]): Widget {
  const min = inversions(start);
  return (ctx) => {
    let a = start.slice(), swaps = 0;
    const n = a.length, max = Math.max(...a);
    const box = h('div'), st = stats(), note = msg();
    const draw = () => {
      const sorted = a.every((v, k) => k === 0 || a[k - 1] <= v);
      const g = h('div', { style: `display:grid;grid-template-columns:repeat(${2 * n}, minmax(0, 1fr));max-width:${n * 56}px;margin:0 auto;row-gap:6px;` });
      a.forEach((v, k) => g.appendChild(h('div', { style: `grid-column:${2 * k + 1} / span 2;grid-row:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:140px;` },
        h('span', { class: 'small', style: 'font-weight:700;' }, String(v)),
        h('span', { style: `width:70%;height:${(v / max) * 110}px;border-radius:5px 5px 2px 2px;background:${sorted ? 'var(--good)' : ACC};` }))));
      for (let k = 0; k < n - 1; k++) {
        g.appendChild(h('button', { class: 'ghost', 'aria-label': `swap ${k} and ${k + 1}`, style: `grid-column:${2 * k + 2} / span 2;grid-row:2;padding:.3em 0;margin:0 3px;font-size:1rem;${a[k] > a[k + 1] ? `border-color:${ACC};` : ''}`,
          onclick: () => { [a[k], a[k + 1]] = [a[k + 1], a[k]]; swaps++; draw(); } }, '⇄'));
      }
      box.replaceChildren(g);
      st.replaceChildren(h('span', null, h('strong', null, String(swaps)), ` swap${swaps === 1 ? '' : 's'}`), h('span', null, h('strong', null, String(inversions(a))), ' out-of-order pairs left'));
      note.textContent = sorted ? (swaps === min ? `✓ Sorted in ${swaps} swaps: the fewest possible.` : `✓ Sorted in ${swaps} swaps (the fewest possible is ${min}).`) : 'Tap ⇄ to swap the two bars above it.';
      ctx.solved?.(sorted);
    };
    draw();
    return h('div', null, box, st, note, h('div', { class: 'w-btns', style: 'justify-content:center;' }, btn('Start over', () => { a = start.slice(); swaps = 0; draw(); })));
  };
}

/**
 * Task: guess my number in 1..n with at most `max` guesses. The host is sneaky: it hasn't fixed a
 * number and always answers so that as many candidates as possible survive.
 */
export function guessGame(n: number, max: number): Widget {
  return (ctx) => {
    let lo = 1, hi = n, used = 0, won = false;
    const log: string[] = [];
    const track = h('div', { style: 'position:relative;height:18px;border-radius:9px;background:var(--panel2);border:1px solid var(--line);margin:10px 4px 2px;overflow:hidden;' });
    const ends = h('div', { class: 'muted small', style: 'display:flex;justify-content:space-between;margin:0 4px;' });
    const inp = h('input', { type: 'text', inputmode: 'numeric', class: 'num', 'aria-label': 'your guess', style: 'width:6em;text-align:center;' }) as HTMLInputElement;
    const go = h('button', { class: 'primary small-btn' }, 'Guess');
    const st = stats(), note = msg();
    const hist = h('div', { class: 'muted small', style: 'text-align:center;min-height:1.2em;' });
    const draw = () => {
      track.replaceChildren(h('span', { style: `position:absolute;top:0;bottom:0;left:${((lo - 1) / n) * 100}%;width:${((hi - lo + 1) / n) * 100}%;background:${won ? 'var(--good)' : ACC};opacity:.75;` }));
      ends.replaceChildren(h('span', null, '1'), h('span', null, `still possible: ${lo === hi ? lo : `${lo}–${hi}`} (${hi - lo + 1})`), h('span', null, String(n)));
      st.replaceChildren(h('span', null, h('strong', null, String(used)), ` of ${max} guesses used`));
      hist.textContent = log.join('  ·  ');
      go.disabled = won || used >= max;
      inp.disabled = go.disabled;
    };
    const guess = () => {
      const g = Number(inp.value.trim());
      inp.value = '';
      if (!Number.isInteger(g) || g < 1 || g > n) { note.textContent = `Guess a whole number from 1 to ${n}.`; return; }
      if (g < lo || g > hi) { note.textContent = `${g} is already ruled out (free, no guess used). Pick from ${lo}–${hi}.`; return; }
      used++;
      if (lo === hi) { won = true; log.push(`${g} ✓`); note.textContent = `✓ Got it in ${used}: it was ${g}.`; }
      else {
        // Answer so that the bigger part survives.
        if (hi - g >= g - lo) { lo = g + 1; log.push(`${g} ↑`); note.textContent = `Higher than ${g}.`; }
        else { hi = g - 1; log.push(`${g} ↓`); note.textContent = `Lower than ${g}.`; }
        if (used >= max) note.textContent += ` Out of guesses: it could still be ${lo === hi ? lo : `anything from ${lo} to ${hi}`}.`;
      }
      draw();
      ctx.solved?.(won);
      if (!won && used < max) inp.focus();
    };
    go.addEventListener('click', guess);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); guess(); } });
    draw();
    return h('div', null, track, ends,
      h('div', { style: 'display:flex;gap:8px;justify-content:center;align-items:center;margin-top:10px;' }, inp, go),
      st, note, hist,
      h('div', { class: 'w-btns', style: 'justify-content:center;' }, btn('New game', () => { lo = 1; hi = n; used = 0; won = false; log.length = 0; note.textContent = ''; draw(); ctx.solved?.(false); })));
  };
}

/** Task: tap exactly the nodes in `answer`. */
export function nodePicker(g: Graph, answer: string[]): Widget {
  const want = new Set(answer);
  return (ctx) => {
    const sel = new Set<string>();
    const box = h('div'), st = stats();
    const draw = () => {
      box.replaceChildren(network(g.nodes, g.edges, { hiNodes: [...sel], onNode: (id) => { if (sel.has(id)) sel.delete(id); else sel.add(id); draw(); } }));
      st.replaceChildren(h('span', null, h('strong', null, String(sel.size)), ' picked'));
      ctx.solved?.(sel.size === want.size && [...sel].every((v) => want.has(v)));
    };
    draw();
    return h('div', null, box, st);
  };
}

/** Task: tap nodes to build a route from s to t; solved when it is a shortest one. */
export function pathPicker(g: Graph, s: string, t: string): Widget {
  const best = dijkstra(g, s).dist[t];
  const adj = adjacency(g);
  return (ctx) => {
    let path = [s];
    const box = h('div'), st = stats(), note = msg();
    const draw = () => {
      box.replaceChildren(network(g.nodes, g.edges, { hiNodes: path, hiEdges: pathEdges(path), nodeText: { [s]: 'start', [t]: 'goal' }, onNode: click }));
      const w = pathWeight(g, path), at = path[path.length - 1] === t;
      st.replaceChildren(h('span', null, 'route ', h('strong', null, path.join(' → '))), h('span', null, 'length ', h('strong', null, String(w))));
      note.textContent = at ? (w === best ? `✓ ${w}: no route from ${s} to ${t} is shorter.` : `You reached ${t} with length ${w}. There is a shorter route.`) : `Tap a neighbour of ${path[path.length - 1]} to extend the route. Tap the route to back up.`;
      ctx.solved?.(at && w === best);
    };
    const click = (id: string) => {
      const k = path.indexOf(id);
      if (k >= 0) { path = path.slice(0, Math.max(1, k === path.length - 1 ? k : k + 1)); draw(); return; }
      const last = path[path.length - 1];
      if (last === t) return;
      if (!adj[last].some((a) => a.to === id)) { note.textContent = `${id} isn’t joined to ${last} by a road.`; return; }
      path.push(id);
      draw();
    };
    draw();
    return h('div', null, box, st, note, h('div', { class: 'w-btns', style: 'justify-content:center;' }, btn('Start over', () => { path = [s]; draw(); })));
  };
}
