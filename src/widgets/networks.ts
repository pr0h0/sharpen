// Networks & Contagion: graph algorithms and simulations (pure, so lessons and practice problems get
// their answers by running them) plus the pictures and tasks built on them: coloured networks,
// spreading steppers, vaccination, cut-the-link, add-a-shortcut and cascade-seeding tasks.
import type { Rng, Widget } from '../types';
import { h, svg } from '../ui';
import { stepper } from '../viz/explore';
import { cellGrid } from '../viz/cs';

// ================================================================ graphs (pure)

export interface GNode { id: string; x: number; y: number }
export interface G { nodes: GNode[]; edges: [string, string][] }

export const ids = (g: G) => g.nodes.map((n) => n.id);
export const ek = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function adj(g: G, skipNodes: Iterable<string> = [], skipEdges: Iterable<string> = []): Record<string, string[]> {
  const sn = new Set(skipNodes), se = new Set(skipEdges);
  const out: Record<string, string[]> = {};
  for (const n of g.nodes) if (!sn.has(n.id)) out[n.id] = [];
  for (const [a, b] of g.edges) {
    if (sn.has(a) || sn.has(b) || se.has(ek(a, b))) continue;
    out[a].push(b);
    out[b].push(a);
  }
  return out;
}

export const deg = (g: G): Record<string, number> => Object.fromEntries(Object.entries(adj(g)).map(([k, v]) => [k, v.length]));

/** Hop distances from s (unreachable nodes are absent). */
export function dist(A: Record<string, string[]>, s: string): Record<string, number> {
  const d: Record<string, number> = { [s]: 0 };
  const q = [s];
  for (let i = 0; i < q.length; i++) for (const v of A[q[i]]) if (!(v in d)) { d[v] = d[q[i]] + 1; q.push(v); }
  return d;
}

/** Average hop distance from s to every other node (assumes connected). */
export function meanDistFrom(A: Record<string, string[]>, s: string): number {
  const d = dist(A, s);
  const ks = Object.keys(A).filter((k) => k !== s);
  return ks.reduce((t, k) => t + d[k], 0) / ks.length;
}

/** Average distance over all pairs, and the largest (diameter). Assumes connected. */
export function pathStats(A: Record<string, string[]>): { mean: number; diam: number } {
  const ks = Object.keys(A);
  let tot = 0, cnt = 0, diam = 0;
  for (const s of ks) {
    const d = dist(A, s);
    for (const t of ks) if (t !== s) { tot += d[t]; cnt++; diam = Math.max(diam, d[t]); }
  }
  return { mean: tot / cnt, diam };
}

/** Local clustering: share of pairs of a node's friends who are friends themselves. */
export function clustering(A: Record<string, string[]>, v: string): number {
  const nb = A[v];
  if (nb.length < 2) return 0;
  const S = new Set(nb);
  let links = 0;
  for (const a of nb) for (const b of A[a]) if (S.has(b) && a < b) links++;
  return links / ((nb.length * (nb.length - 1)) / 2);
}
export const meanClustering = (A: Record<string, string[]>) => { const ks = Object.keys(A); return ks.reduce((t, k) => t + clustering(A, k), 0) / ks.length; };

/** Connected components, largest first. */
export function components(A: Record<string, string[]>): string[][] {
  const seen = new Set<string>(), out: string[][] = [];
  for (const s of Object.keys(A)) {
    if (seen.has(s)) continue;
    const c = Object.keys(dist(A, s));
    c.forEach((v) => seen.add(v));
    out.push(c);
  }
  return out.sort((a, b) => b.length - a.length);
}

/** Edges whose removal splits the network (brute force: fine for lesson-sized graphs). */
export function bridges(g: G): string[] {
  const base = components(adj(g)).length;
  return g.edges.map(([a, b]) => ek(a, b)).filter((k) => components(adj(g, [], [k])).length > base);
}

/** Nodes whose removal splits what's left. */
export function cutNodes(g: G): string[] {
  const base = components(adj(g)).length;
  return ids(g).filter((v) => components(adj(g, [v])).length > base);
}

/** Fewest edges whose removal disconnects g (brute force over small subsets). */
export function edgeConnectivity(g: G): number {
  const keys = g.edges.map(([a, b]) => ek(a, b));
  const rec = (k: number, from: number, cut: string[]): boolean => {
    if (cut.length === k) return components(adj(g, [], cut)).length > 1;
    for (let i = from; i < keys.length; i++) if (rec(k, i + 1, [...cut, keys[i]])) return true;
    return false;
  };
  for (let k = 1; k <= keys.length; k++) if (rec(k, 0, [])) return k;
  return keys.length;
}

// ---------------------------------------------------------------- builders

const circle = (n: number, cx = 50, cy = 30, rx = 44, ry = 25, rot = -Math.PI / 2) =>
  Array.from({ length: n }, (_, k) => ({ x: +(cx + rx * Math.cos(rot + (2 * Math.PI * k) / n)).toFixed(2), y: +(cy + ry * Math.sin(rot + (2 * Math.PI * k) / n)).toFixed(2) }));

/** Ring of n nodes, each joined to the nearest `h` on each side. Ids are "1".."n". */
export function ringLattice(n: number, hops: number): G {
  const pos = circle(n);
  const nodes = pos.map((p, k) => ({ id: String(k + 1), ...p }));
  const edges: [string, string][] = [];
  for (let i = 0; i < n; i++) for (let j = 1; j <= hops; j++) edges.push([String(i + 1), String(((i + j) % n) + 1)]);
  return { nodes, edges };
}

/** Graph from "A-B B-C ..." with positions. */
export function mk(pos: Record<string, [number, number]>, edges: string): G {
  return {
    nodes: Object.entries(pos).map(([id, [x, y]]) => ({ id, x, y })),
    edges: edges.trim().split(/\s+/).map((e) => e.split('-') as [string, string]),
  };
}

/** Preferential attachment (Barabási–Albert): each new node links to m existing ones, chosen in proportion to degree. */
export function prefAttach(n: number, m: number, rng: Rng): number[][] {
  const A: number[][] = Array.from({ length: n }, () => []);
  const ends: number[] = [];
  // Start from a small complete core of m + 1 nodes.
  for (let i = 0; i <= m; i++) for (let j = 0; j < i; j++) { A[i].push(j); A[j].push(i); ends.push(i, j); }
  for (let v = m + 1; v < n; v++) {
    const pick = new Set<number>();
    while (pick.size < m) pick.add(ends[Math.floor(rng() * ends.length)]);
    for (const u of pick) { A[v].push(u); A[u].push(v); ends.push(u, v); }
  }
  return A;
}

/** Random graph with n nodes and exactly `edges` distinct edges (Erdős–Rényi G(n, M)). */
export function randomGraph(n: number, edges: number, rng: Rng): number[][] {
  const A: number[][] = Array.from({ length: n }, () => []);
  const have = new Set<number>();
  while (have.size < edges) {
    const a = Math.floor(rng() * n), b = Math.floor(rng() * n);
    if (a === b) continue;
    const k = Math.min(a, b) * n + Math.max(a, b);
    if (have.has(k)) continue;
    have.add(k);
    A[a].push(b); A[b].push(a);
  }
  return A;
}

/** Size of the largest connected piece when the `gone` nodes are removed (index adjacency). */
export function giant(A: number[][], gone: Set<number>): number {
  const seen = new Uint8Array(A.length);
  let best = 0;
  for (let s = 0; s < A.length; s++) {
    if (seen[s] || gone.has(s)) continue;
    let size = 0;
    const st = [s];
    seen[s] = 1;
    while (st.length) {
      const u = st.pop()!;
      size++;
      for (const v of A[u]) if (!seen[v] && !gone.has(v)) { seen[v] = 1; st.push(v); }
    }
    best = Math.max(best, size);
  }
  return best;
}

/** Giant-component share after removing fractions 0, step, 2·step… of nodes, at random or biggest hubs first. */
export function attackCurve(A: number[][], mode: 'random' | 'hubs', rng: Rng, step = 0.02): [number, number][] {
  const n = A.length;
  const order = A.map((_, i) => i);
  if (mode === 'hubs') order.sort((a, b) => A[b].length - A[a].length || a - b);
  else for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const out: [number, number][] = [];
  for (let f = 0; f <= 1 + 1e-9; f += step) {
    const gone = new Set(order.slice(0, Math.round(f * n)));
    out.push([+f.toFixed(4), giant(A, gone) / n]);
  }
  return out;
}

/** Outbreak on an index graph: each infected node infects each susceptible neighbour with probability T. Returns final size. */
export function outbreakSize(A: number[][], seed: number, T: number, immune: Set<number>, rng: Rng): number {
  if (immune.has(seed)) return 0;
  const state = new Uint8Array(A.length);
  state[seed] = 1;
  let front = [seed], size = 1;
  while (front.length) {
    const next: number[] = [];
    for (const u of front) for (const v of A[u]) if (!state[v] && !immune.has(v) && rng() < T) { state[v] = 1; next.push(v); size++; }
    front = next;
  }
  return size;
}

// ---------------------------------------------------------------- spreading on lesson graphs

/** Generations of an outbreak where every contact transmits: who first gets it at each step. */
export function waves(g: G, seeds: string[], immune: Iterable<string> = []): string[][] {
  const A = adj(g, immune);
  const got = new Set(seeds.filter((s) => s in A));
  const out = [[...got]];
  for (;;) {
    const next = new Set<string>();
    for (const u of out[out.length - 1]) for (const v of A[u]) if (!got.has(v)) next.add(v);
    if (!next.size) break;
    next.forEach((v) => got.add(v));
    out.push([...next].sort());
  }
  return out;
}

/** SIR generations with per-contact transmission probability T (seeded rng): infected in each generation. */
export function sirWaves(g: G, seed: string, T: number, rng: Rng): string[][] {
  const A = adj(g);
  const got = new Set([seed]);
  const out = [[seed]];
  for (;;) {
    const next: string[] = [];
    for (const u of out[out.length - 1]) for (const v of A[u]) if (!got.has(v) && rng() < T) { got.add(v); next.push(v); }
    if (!next.length) break;
    out.push(next.sort());
  }
  return out;
}

/** Threshold cascade: a node adopts once at least `need(v)` of its neighbours have. Returns rounds of adopters. */
export function cascade(A: Record<string, string[]>, seeds: string[], need: (v: string, degree: number) => number): string[][] {
  const on = new Set(seeds);
  const out = [[...seeds]];
  for (;;) {
    const next = Object.keys(A).filter((v) => !on.has(v) && A[v].filter((u) => on.has(u)).length >= need(v, A[v].length));
    if (!next.length) break;
    next.forEach((v) => on.add(v));
    out.push(next);
  }
  return out;
}

/** Grid adjacency (4 neighbours); ids "r,c". */
export function gridAdj(R: number, C: number): Record<string, string[]> {
  const A: Record<string, string[]> = {};
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    A[`${r},${c}`] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C).map(([a, b]) => `${a},${b}`);
  }
  return A;
}

/** Granovetter's riot model: person i joins once at least t[i] others have. Returns how many end up joining. */
export function granovetter(t: number[]): number {
  let n = 0;
  for (;;) {
    const m = t.filter((x) => x <= n).length;
    if (m === n) return n;
    n = m;
  }
}

/** Chance a chain started by one case dies out, when each case infects Poisson(R) others. */
export function extinction(R: number): number {
  let q = 0;
  for (let i = 0; i < 2000; i++) q = Math.exp(R * (q - 1));
  return q;
}

// ================================================================ pictures

export const COL = {
  sick: 'var(--bad)',
  gone: 'var(--muted)',
  safe: 'var(--good)',
  on: 'var(--c6)',
  hub: 'var(--c2)',
  base: 'var(--c1)',
};
export const tint = (c: string, p = 45) => `color-mix(in srgb, ${c} ${p}%, var(--panel))`;

export interface NetOpts {
  /** Node colour (stroke; the fill is a tint of it). */
  color?: (id: string) => string | undefined;
  /** Node radius (default 4.6). */
  r?: number | ((id: string) => number);
  /** Show node ids inside (default true). */
  labels?: boolean;
  /** Small text above a node (e.g. its degree). */
  text?: Record<string, string>;
  /** Edge style by key ek(a, b). */
  edge?: (key: string) => 'hi' | 'dim' | 'cut' | 'new' | undefined;
  /** Extra edges drawn (e.g. added shortcuts). */
  extra?: [string, string][];
  onNode?: (id: string) => void;
  onEdge?: (key: string) => void;
  /** Accessible label for the picture. */
  label?: string;
}

/** A network in a 100 x 60 box, coloured per node, with optional clickable nodes and edges. */
export function net(g: G, o: NetOpts = {}): HTMLElement {
  const s = svg('svg', { viewBox: '-6 -7 112 73', class: 'net', role: 'img', 'aria-label': o.label ?? 'network' }) as SVGSVGElement;
  const at = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const R = (id: string) => (typeof o.r === 'function' ? o.r(id) : o.r ?? 4.6);
  const drawEdge = (a: string, b: string, isExtra: boolean) => {
    const k = ek(a, b), st = isExtra ? 'new' : o.edge?.(k);
    const A = at[a], B = at[b];
    const style = st === 'hi' ? 'stroke:var(--c2);stroke-width:1.5;opacity:1'
      : st === 'new' ? 'stroke:var(--c6);stroke-width:1.4;opacity:1;stroke-dasharray:2 1.2'
      : st === 'cut' ? 'stroke:var(--bad);stroke-width:1;opacity:.9;stroke-dasharray:1.2 1.2'
      : st === 'dim' ? 'stroke:var(--muted);stroke-width:.6;opacity:.2'
      : 'stroke:var(--muted);stroke-width:.7;opacity:.6';
    s.appendChild(svg('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, style }));
    if (st === 'cut') s.appendChild(svg('text', { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 + 1.5, 'text-anchor': 'middle', style: 'font-size:5px;font-weight:700;fill:var(--bad)' }, '✕'));
    if (o.onEdge && !isExtra) {
      const hit = svg('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, 'data-edge': k, style: 'stroke:transparent;stroke-width:4.5;cursor:pointer;pointer-events:stroke' });
      hit.addEventListener('click', () => o.onEdge!(k));
      s.appendChild(hit);
    }
  };
  for (const [a, b] of g.edges) drawEdge(a, b, false);
  for (const [a, b] of o.extra ?? []) drawEdge(a, b, true);
  for (const n of g.nodes) {
    const c = o.color?.(n.id);
    const r = R(n.id);
    const gEl = svg('g', { 'data-node': n.id, style: o.onNode ? 'cursor:pointer' : '' });
    gEl.appendChild(svg('circle', { cx: n.x, cy: n.y, r, style: `fill:${c ? tint(c) : 'var(--panel)'};stroke:${c ?? 'var(--c1)'};stroke-width:${c ? 1.2 : 0.9}` }));
    if (o.labels !== false) gEl.appendChild(svg('text', { x: n.x, y: n.y + 1.5, 'text-anchor': 'middle', style: `font-size:${n.id.length > 2 ? 3.3 : 4}px;font-weight:700;fill:var(--text);pointer-events:none` }, n.id));
    const t = o.text?.[n.id];
    if (t) gEl.appendChild(svg('text', { x: n.x, y: n.y - r - 1.4, 'text-anchor': 'middle', style: 'font-size:3.6px;font-weight:700;fill:var(--c4);pointer-events:none' }, t));
    if (o.onNode) gEl.addEventListener('click', () => o.onNode!(n.id));
    s.appendChild(gEl);
  }
  return h('div', { class: 'net-wrap' }, s);
}

/** Colour key under a picture. */
export function legend(items: [string, string][]): HTMLElement {
  return h('div', { style: 'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:.85rem;color:var(--muted);margin-top:4px' },
    items.map(([c, label]) => h('span', { style: 'display:inline-flex;align-items:center;gap:5px' },
      h('i', { style: `display:inline-block;width:12px;height:12px;border-radius:50%;background:${c === 'none' ? 'var(--panel)' : tint(c)};border:2px solid ${c === 'none' ? 'var(--c1)' : c}` }), label)));
}

const note = () => h('div', { style: 'text-align:center;min-height:1.4em;margin:8px 0;color:var(--muted)' });
const btn = (label: string, onclick: () => void) => h('button', { class: 'ghost small-btn', onclick }, label);
const btns = (...b: HTMLElement[]) => h('div', { class: 'w-btns', style: 'justify-content:center' }, b);

/** Stepper through the generations of an outbreak (sick now, already had it, not yet). */
export function spreadStepper(g: G, gens: string[][], opts: { immune?: string[]; words?: [string, string] } = {}): HTMLElement {
  const imm = new Set(opts.immune ?? []);
  const [now, before] = opts.words ?? ['new cases', 'earlier'];
  return h('div', null, stepper(gens.length, (i) => {
    const cur = new Set(gens[i]), past = new Set(gens.slice(0, i).flat());
    return net(g, { color: (v) => (imm.has(v) ? COL.safe : cur.has(v) ? COL.sick : past.has(v) ? COL.gone : undefined) });
  }, {
    caption: (i) => {
      const total = gens.slice(0, i + 1).flat().length;
      return i === 0 ? `Generation 0: ${gens[0].length} case${gens[0].length === 1 ? '' : 's'}.` : `Generation ${i}: ${gens[i].length} ${gens[i].length === 1 ? now.replace(/s$/, '') : now}, ${total} in all${i === gens.length - 1 ? '. The chain has stopped.' : '.'}`;
    },
    autoplayMs: 900,
  }), legend([[COL.sick, now], [COL.gone, before], ...(imm.size ? [[COL.safe, 'immune'] as [string, string]] : []), ['none', 'not reached']]));
}

/** Task: tap nodes. solved when ok(selection) holds. live(sel) renders the colouring and a status line. */
function picker(g: G, max: number, view: (sel: Set<string>) => { color: (id: string) => string | undefined; status: string; ok: boolean; extra?: [string, string][] }): Widget {
  return (ctx) => {
    const sel = new Set<string>();
    const box = h('div'), msg = note();
    const draw = () => {
      const v = view(sel);
      box.replaceChildren(net(g, { color: v.color, extra: v.extra, onNode: (id) => {
        if (sel.has(id)) sel.delete(id);
        else { if (sel.size >= max) { if (max === 1) sel.clear(); else { msg.textContent = `You can only pick ${max}. Tap one to undo it first.`; return; } } sel.add(id); }
        draw();
      } }));
      msg.textContent = v.status;
      ctx.solved?.(v.ok);
    };
    draw();
    return h('div', null, box, msg, btns(btn('Clear', () => { sel.clear(); draw(); })));
  };
}

/** Task: tap exactly the nodes in `answer`. */
export function tapNodes(g: G, answer: string[], text?: Record<string, string>): Widget {
  const want = new Set(answer);
  return (ctx) => {
    const sel = new Set<string>();
    const box = h('div'), msg = note();
    const draw = () => {
      box.replaceChildren(net(g, { text, color: (v) => (sel.has(v) ? COL.hub : undefined), onNode: (id) => { if (sel.has(id)) sel.delete(id); else sel.add(id); draw(); } }));
      msg.textContent = `${sel.size} picked`;
      ctx.solved?.(sel.size === want.size && [...sel].every((v) => want.has(v)));
    };
    draw();
    return h('div', null, box, msg);
  };
}

/** Task: immunise up to k nodes so that an outbreak from `seed` (every contact transmits) reaches at most `limit` people. */
export function vaccinate(g: G, seed: string, k: number, limit: number): Widget {
  return picker(g, k, (sel) => {
    const reach = new Set(waves(g, [seed], [...sel].filter((v) => v !== seed)).flat());
    const n = reach.size;
    const bad = sel.has(seed);
    const ok = !bad && n <= limit;
    return {
      color: (v) => (sel.has(v) ? COL.safe : v === seed ? COL.sick : reach.has(v) ? tint(COL.sick, 70) : undefined),
      status: bad ? `${seed} is already sick: a vaccine can't help them.` : ok ? `✓ The outbreak stops at ${n} people.` : `Outbreak from ${seed} reaches ${n} people (${sel.size} of ${k} vaccines used).`,
      ok,
    };
  });
}

/** Task: node `from` adds one new link; solved when everyone is within `within` hops of it. */
export function addShortcut(g: G, from: string, within: number): Widget {
  return picker(g, 1, (sel) => {
    const to = [...sel][0];
    const extra: [string, string][] = to && to !== from ? [[from, to]] : [];
    const g2: G = { nodes: g.nodes, edges: [...g.edges, ...extra] };
    const d = dist(adj(g2), from);
    const far = Math.max(...Object.values(d));
    const ok = !!extra.length && far <= within;
    return {
      color: (v) => (v === from ? COL.hub : v === to ? COL.on : d[v] > within ? COL.sick : undefined),
      extra,
      status: !to ? `Now the furthest person is ${far} hops from ${from}. Tap who ${from} should befriend.` : to === from ? 'Pick someone else.' : ok ? `✓ Everyone is within ${far} hops of ${from}.` : `Furthest is ${far} hops away (red: more than ${within}).`,
      ok,
    };
  });
}

/** Task: remove one link (tap it); solved when the network falls into two pieces. */
export function cutLink(g: G): Widget {
  return (ctx) => {
    let cut: string | null = null;
    const box = h('div'), msg = note();
    const draw = () => {
      const parts = components(adj(g, [], cut ? [cut] : []));
      const side = new Set(parts[1] ?? []);
      box.replaceChildren(net(g, { onEdge: (k) => { cut = cut === k ? null : k; draw(); }, edge: (k) => (k === cut ? 'cut' : undefined), color: (v) => (parts.length > 1 ? (side.has(v) ? COL.hub : COL.base) : undefined) }));
      msg.textContent = !cut ? 'Tap a link to cut it.' : parts.length > 1 ? `✓ Split: ${parts[0].length} and ${parts[1].length} people can no longer reach each other.` : 'Still one piece: there is another way round. Tap a different link.';
      ctx.solved?.(parts.length > 1);
    };
    draw();
    return h('div', null, box, msg);
  };
}

/** Task: add one link (tap two nodes); solved when no single link failure can split the network. */
export function addBackup(g: G): Widget {
  return (ctx) => {
    let pair: string[] = [];
    const box = h('div'), msg = note();
    const draw = () => {
      const extra: [string, string][] = pair.length === 2 ? [[pair[0], pair[1]]] : [];
      const dup = extra.length && g.edges.some(([a, b]) => ek(a, b) === ek(pair[0], pair[1]));
      const br = new Set(bridges({ nodes: g.nodes, edges: [...g.edges, ...extra] }));
      box.replaceChildren(net(g, { extra, edge: (k) => (br.has(k) ? 'hi' : undefined), color: (v) => (pair.includes(v) ? COL.on : undefined),
        onNode: (id) => { if (pair.includes(id)) pair = pair.filter((x) => x !== id); else pair = pair.length >= 2 ? [id] : [...pair, id]; draw(); } }));
      const ok = extra.length > 0 && !dup && br.size === 0;
      msg.textContent = dup ? 'Those two are already linked.' : ok ? '✓ No single link is critical any more.' : `${br.size} critical link${br.size === 1 ? '' : 's'} (orange). ${pair.length < 2 ? 'Tap two nodes to join them.' : 'Try another pair.'}`;
      ctx.solved?.(ok);
    };
    draw();
    return h('div', null, box, msg);
  };
}

/** Task: seed one node; a node adopts once at least half its friends have. Solved when everyone adopts. */
export function seedCascade(g: G, frac = 0.5): Widget {
  const A = adj(g);
  return picker(g, 1, (sel) => {
    const s = [...sel];
    const rounds = s.length ? cascade(A, s, (_v, d) => Math.ceil(frac * d - 1e-9)) : [[]];
    const on = new Set(rounds.flat());
    const ok = on.size === g.nodes.length;
    return {
      color: (v) => (sel.has(v) ? COL.hub : on.has(v) ? COL.on : undefined),
      status: !s.length ? 'Tap one person to give the idea to first.' : ok ? `✓ Everyone adopts, in ${rounds.length - 1} rounds.` : `It stalls at ${on.size} of ${g.nodes.length}. Try someone else.`,
      ok,
    };
  });
}

/** Stepper of a cascade on a grid. */
export function gridCascadeStepper(R: number, C: number, seeds: string[], need: number): HTMLElement {
  const rounds = cascade(gridAdj(R, C), seeds, () => need);
  const sz = Math.min(40, Math.floor(300 / C));
  return stepper(rounds.length, (i) => {
    const cur = new Set(rounds[i]), past = new Set(rounds.slice(0, i).flat());
    return cellGrid(R, C, (r, c) => { const k = `${r},${c}`; return { fill: cur.has(k) ? COL.hub : past.has(k) ? tint(COL.on, 60) : undefined }; }, { size: sz });
  }, { caption: (i) => (i === 0 ? `${rounds[0].length} seeds.` : `Round ${i}: ${rounds[i].length} more adopt (${rounds.slice(0, i + 1).flat().length} of ${R * C}).`), autoplayMs: 800 });
}

/** Task: tap up to k grid cells to seed; a cell adopts once `need` of its 4 neighbours have. Solved when all adopt. */
export function gridSeeder(R: number, C: number, k: number, need: number): Widget {
  const A = gridAdj(R, C);
  return (ctx) => {
    const seeds = new Set<string>();
    const box = h('div'), msg = note();
    const draw = () => {
      const on = new Set(cascade(A, [...seeds], () => need).flat());
      const ok = on.size === R * C && seeds.size <= k;
      box.replaceChildren(cellGrid(R, C, (r, c) => {
        const key = `${r},${c}`;
        return { fill: seeds.has(key) ? COL.hub : on.has(key) ? tint(COL.on, 60) : undefined, text: seeds.has(key) ? '●' : '' };
      }, { size: Math.min(44, Math.floor(300 / C)), onCell: (r, c) => {
        const key = `${r},${c}`;
        if (seeds.has(key)) seeds.delete(key);
        else if (seeds.size < k) seeds.add(key);
        else { msg.textContent = `Only ${k} seeds. Tap one to remove it first.`; return; }
        draw();
      } }));
      msg.textContent = ok ? `✓ All ${R * C} cells adopt.` : `${seeds.size} of ${k} seeds placed. ${on.size} of ${R * C} cells end up adopting.`;
      ctx.solved?.(ok);
    };
    draw();
    return h('div', null, box, msg, legend([[COL.hub, 'seed'], [tint(COL.on, 60), 'adopts later']]));
  };
}

/** A static grid picture with marked cells. */
export function gridPic(R: number, C: number, marks: Record<string, string>, text: Record<string, string> = {}): HTMLElement {
  return cellGrid(R, C, (r, c) => ({ fill: marks[`${r},${c}`], text: text[`${r},${c}`] ?? '' }), { size: Math.min(44, Math.floor(300 / C)) });
}

/** Stepper: a network grown by preferential attachment (index adjacency, nodes in arrival order); node size shows links. */
export function growthStepper(A: number[][]): HTMLElement {
  const g = treeG(A);
  const n = A.length;
  const sub = (k: number): G => ({ nodes: g.nodes.filter((v) => Number(v.id) <= k), edges: g.edges.filter(([a, b]) => Number(a) <= k && Number(b) <= k) });
  return h('div', null, stepper(n - 1, (i) => {
    const s = sub(i + 2), d = deg(s);
    const max = Math.max(...Object.values(d));
    return net(s, { labels: false, r: (v) => 1.4 + 0.6 * d[v], color: (v) => (v === String(i + 2) && i > 0 ? COL.on : d[v] === max ? COL.hub : undefined) });
  }, {
    caption: (i) => {
      if (i === 0) return 'Start: two linked nodes.';
      const k = i + 2, target = A[k - 1].filter((j) => j < k - 1);
      const before = deg(sub(k - 1));
      return `Node ${k} arrives and links to a node that had ${target.map((j) => before[String(j + 1)]).join(' and ')} link${target.length === 1 && before[String(target[0] + 1)] === 1 ? '' : 's'}.`;
    },
    autoplayMs: 500,
  }), legend([[COL.on, 'newest'], [COL.hub, 'biggest hub']]));
}

/** Deterministic spring layout fitted to the 100 x 60 box (index adjacency in, positions out). */
export function layout(A: number[][], rng: Rng, iters = 400): [number, number][] {
  const n = A.length;
  let P: [number, number][] = A.map((_, i) => [50 + 30 * Math.cos((2 * Math.PI * i) / n) + rng(), 30 + 20 * Math.sin((2 * Math.PI * i) / n) + rng()]);
  const k = Math.sqrt((100 * 60) / n) * 0.9;
  for (let it = 0; it < iters; it++) {
    const t = 6 * (1 - it / iters) + 0.2;
    const D: [number, number][] = P.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d = Math.hypot(dx, dy) || 0.01;
      const f = (k * k) / d;
      D[i][0] += (dx / d) * f; D[i][1] += (dy / d) * f; D[j][0] -= (dx / d) * f; D[j][1] -= (dy / d) * f;
    }
    for (let i = 0; i < n; i++) for (const j of A[i]) if (j > i) {
      const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      D[i][0] -= (dx / d) * f; D[i][1] -= (dy / d) * f; D[j][0] += (dx / d) * f; D[j][1] += (dy / d) * f;
    }
    P = P.map(([x, y], i) => { const d = Math.hypot(...D[i]) || 0.01; return [x + (D[i][0] / d) * Math.min(d, t), y + (D[i][1] / d) * Math.min(d, t)]; });
  }
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return P.map(([x, y]) => [+(3 + ((x - x0) / (x1 - x0 || 1)) * 94).toFixed(1), +(3 + ((y - y0) / (y1 - y0 || 1)) * 54).toFixed(1)]);
}

/** Index adjacency to a lesson graph with ids "1".."n" and a spring layout. */
export function toG(A: number[][], rng: Rng): G {
  const P = layout(A, rng);
  const edges: [string, string][] = [];
  A.forEach((nb, i) => nb.forEach((j) => { if (j > i) edges.push([String(i + 1), String(j + 1)]); }));
  return { nodes: P.map(([x, y], i) => ({ id: String(i + 1), x, y })), edges };
}

/** Radial layout of a tree (index adjacency) around node 0: depth = ring, angle share = number of leaves below. */
export function treeG(A: number[][]): G {
  const n = A.length, parent = new Array<number>(n).fill(-1), depth = new Array<number>(n).fill(0), order = [0];
  const seen = new Set([0]);
  for (let i = 0; i < order.length; i++) for (const v of A[order[i]]) if (!seen.has(v)) { seen.add(v); parent[v] = order[i]; depth[v] = depth[order[i]] + 1; order.push(v); }
  const kids = A.map((_, u) => order.filter((v) => parent[v] === u));
  const leaves = new Array<number>(n).fill(0);
  for (let i = order.length - 1; i >= 0; i--) { const u = order[i]; leaves[u] = kids[u].length ? sum(kids[u].map((v) => leaves[v])) : 1; }
  const maxD = Math.max(...depth), ang = new Array<number>(n).fill(0);
  const place = (u: number, a0: number, a1: number) => {
    ang[u] = (a0 + a1) / 2;
    let a = a0;
    for (const v of kids[u]) { const w = ((a1 - a0) * leaves[v]) / leaves[u]; place(v, a, a + w); a += w; }
  };
  place(0, 0, 2 * Math.PI);
  const nodes = order.map((u) => ({ id: String(u + 1), x: +(50 + (47 * depth[u] / maxD) * Math.cos(ang[u])).toFixed(1), y: +(30 + (28 * depth[u] / maxD) * Math.sin(ang[u])).toFixed(1) }));
  const edges: [string, string][] = [];
  A.forEach((nb, i) => nb.forEach((j) => { if (j > i) edges.push([String(i + 1), String(j + 1)]); }));
  return { nodes, edges };
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Expected outbreak share (of all n) from a random non-immune seed, when each contact transmits with
 * probability T: the final size of such an outbreak is the seed's cluster in a random "bond percolation"
 * of the network, so per sample it is (sum of cluster sizes squared) / (non-immune count).
 */
export function expectedOutbreak(A: number[][], T: number, immune: Set<number>, rng: Rng): number {
  const n = A.length;
  const keep: number[][] = A.map(() => []);
  for (let u = 0; u < n; u++) for (const v of A[u]) if (v > u && !immune.has(u) && !immune.has(v) && rng() < T) { keep[u].push(v); keep[v].push(u); }
  const seen = new Uint8Array(n);
  let s2 = 0;
  for (let s = 0; s < n; s++) {
    if (seen[s] || immune.has(s)) continue;
    let c = 0;
    const st = [s];
    seen[s] = 1;
    while (st.length) { const u = st.pop()!; c++; for (const v of keep[u]) if (!seen[v]) { seen[v] = 1; st.push(v); } }
    s2 += c * c;
  }
  return s2 / (n - immune.size) / n;
}
