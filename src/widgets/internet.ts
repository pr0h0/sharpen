// How the Internet Works: the models (pure, so the course computes every stated number by running
// the same code the pictures run) and the pictures built on them: a shared-link timeline, packets
// racing through routers, IP prefixes in bits, a hop-by-hop forwarding task, message timelines
// (round trips, TCP, DNS, TLS), a page-load waterfall, and congestion-window plots.
import type { Widget } from '../types';
import { h, num, svg } from '../ui';
import { dataTable } from '../viz/charts';
import { cellGrid, network, type NetEdge, type NetNode } from '../viz/cs';
import { stepper } from '../viz/explore';

const fx = (v: number, d = 1) => num(+v.toFixed(d));
const USER_COL: Record<string, string> = { A: 'var(--c1)', B: 'var(--c2)', C: 'var(--c3)', D: 'var(--c4)' };

// ================================================================ physics and arithmetic

/** Light in glass fibre covers about 200,000 km/s (two thirds of c): 200 km per millisecond. */
export const FIBRE_KM_PER_MS = 200;
export const fibreMs = (km: number) => km / FIBRE_KM_PER_MS;
/** Milliseconds to push `bytes` through a link of `mbps` megabits per second. */
export const sendMs = (bytes: number, mbps: number) => (bytes * 8) / (mbps * 1000);
/** One message: latency plus size over bandwidth, in ms. */
export const transferMs = (latencyMs: number, bytes: number, mbps: number) => latencyMs + sendMs(bytes, mbps);
export const packetsFor = (bytes: number, payload: number) => Math.ceil(bytes / payload);

// ================================================================ sharing a link

export interface Sender { name: string; packets: number }
/**
 * Slot by slot, who uses the link. Circuit: slot t is reserved for sender t mod n whether or not
 * they have anything to send. Packet: slots go round-robin among senders that still have packets.
 */
export function shareLink(senders: Sender[], mode: 'circuit' | 'packet'): { slots: (string | null)[]; finish: Record<string, number> } {
  const left = Object.fromEntries(senders.map((s) => [s.name, s.packets]));
  const finish: Record<string, number> = {};
  const slots: (string | null)[] = [];
  let rr = 0;
  for (let t = 0; Object.values(left).some((v) => v > 0); t++) {
    let who: string | null = null;
    if (mode === 'circuit') {
      const s = senders[t % senders.length].name;
      if (left[s] > 0) who = s;
    } else {
      for (let k = 0; k < senders.length; k++) {
        const s = senders[(rr + k) % senders.length].name;
        if (left[s] > 0) { who = s; rr = (rr + k + 1) % senders.length; break; }
      }
    }
    slots.push(who);
    if (who) { left[who]--; if (left[who] === 0) finish[who] = t + 1; }
  }
  return { slots, finish };
}

/** Two rows of time slots (circuit, packet), revealed one slot at a time. */
export function linkShareStepper(senders: Sender[]): Widget {
  const c = shareLink(senders, 'circuit'), p = shareLink(senders, 'packet');
  const T = Math.max(c.slots.length, p.slots.length);
  return () => stepper(T + 1, (t) => {
    const row = (r: (string | null)[], k: number) => k < t ? (r[k] ? { fill: `color-mix(in srgb, ${USER_COL[r[k]!]} 75%, var(--panel))`, text: r[k]! } : k < r.length ? { text: '·' } : {}) : {};
    const grid = cellGrid(2, T, (r, k) => row(r === 0 ? c.slots : p.slots, k), { size: Math.min(26, Math.floor(280 / T)) });
    const used = (r: (string | null)[]) => r.slice(0, t).filter(Boolean).length;
    return h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:6px' },
      h('div', { class: 'small muted' }, 'top row: reserved circuit · bottom row: packets'),
      grid,
      h('div', { class: 'readout' }, `slot ${t}: circuit carried ${used(c.slots)} packets, packets carried ${used(p.slots)}`));
  }, { caption: (t) => t === 0 ? senders.map((s) => `${s.name} has ${s.packets} packet${s.packets === 1 ? '' : 's'}`).join(', ') + '.' : t === T ? 'All sent.' : '', autoplayMs: 450 });
}

// ================================================================ packets racing through routers

export interface Route { nodes: string[]; delays: number[] }
export interface Race { arrive: number[]; order: number[]; at: (pkt: number, t: number) => string | null }
/** Packet k (1-based) leaves at tick k − 1 along routes[k − 1]; delays are ticks per link. */
export function race(routes: Route[]): Race {
  const times = routes.map((r) => r.delays.reduce<number[]>((acc, d) => [...acc, acc[acc.length - 1] + d], [0]));
  const arrive = routes.map((_, k) => k + times[k][times[k].length - 1]);
  const order = arrive.map((_, k) => k + 1).sort((a, b) => arrive[a - 1] - arrive[b - 1] || a - b);
  const at = (pkt: number, t: number) => {
    const k = pkt - 1, rel = t - k;
    if (rel < 0) return null;
    let i = 0;
    while (i + 1 < times[k].length && times[k][i + 1] <= rel) i++;
    return routes[k].nodes[i];
  };
  return { arrive, order, at };
}

/** A network with packets drawn as numbers above the node they last reached, tick by tick. */
export function raceStepper(nodes: NetNode[], edges: NetEdge[], routes: Route[], dst: string): Widget {
  const r = race(routes);
  const T = Math.max(...r.arrive);
  return () => stepper(T + 1, (t) => {
    const text: Record<string, string> = {};
    const arrived: number[] = [];
    for (let p = 1; p <= routes.length; p++) {
      const n = r.at(p, t);
      if (!n) continue;
      if (n === dst) { arrived.push(p); continue; }
      text[n] = text[n] ? `${text[n]},${p}` : String(p);
    }
    arrived.sort((a, b) => r.arrive[a - 1] - r.arrive[b - 1] || a - b);
    return h('div', null,
      network(nodes, edges, { nodeText: text, hiNodes: Object.keys(text) }),
      h('div', { class: 'readout' }, `tick ${t} · arrived at ${dst}: ${arrived.length ? arrived.join(', ') : 'none yet'}`));
  }, { caption: (t) => t === 0 ? 'Numbers above a router are the packets sitting there. Edge labels are ticks per link.' : '', autoplayMs: 600 });
}

// ================================================================ addresses

export const ipToInt = (ip: string) => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0);
export const intToIp = (n: number) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');
/** Does ip fall inside prefix "a.b.c.d/n"? */
export function inPrefix(ip: string, prefix: string): boolean {
  const [base, len] = prefix.split('/');
  const size = 2 ** (32 - Number(len));
  return Math.floor(ipToInt(ip) / size) === Math.floor(ipToInt(base) / size);
}
export const prefixLen = (prefix: string) => Number(prefix.split('/')[1]);
export const blockSize = (len: number) => 2 ** (32 - len);
export type Table = [prefix: string, next: string][];
/** Longest-prefix match: the entry with the most fixed bits that contains ip. */
export function lpm(table: Table, ip: string): [string, string] | null {
  let best: [string, string] | null = null;
  for (const e of table) if (inPrefix(ip, e[0]) && (!best || prefixLen(e[0]) > prefixLen(best[0]))) best = e;
  return best;
}

/** The four bytes of an address in binary, the first `len` bits tinted (the fixed prefix). */
export function ipBits(ip: string, len: number): HTMLElement {
  const bits = ipToInt(ip).toString(2).padStart(32, '0');
  const mono = 'font-family:ui-monospace,Menlo,Consolas,monospace;';
  return h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;' },
    ip.split('.').map((o, k) => h('div', { style: 'text-align:center' },
      h('div', { style: 'font-weight:700' }, o),
      h('div', { style: mono + 'font-size:.9rem;letter-spacing:1px' }, [...bits.slice(k * 8, k * 8 + 8)].map((b, j) =>
        h('span', { style: k * 8 + j < len ? 'background:color-mix(in srgb, var(--c1) 30%, var(--panel));border-radius:2px' : 'color:var(--muted)' }, b))))),
    h('div', { class: 'small muted', style: 'width:100%;text-align:center' }, `/${len}: the tinted ${len} bits are fixed, the other ${32 - len} vary`));
}

// ================================================================ routers forwarding hop by hop

export interface RNet { nodes: NetNode[]; edges: NetEdge[]; tables: Record<string, Table> }
/** Which router delivers locally: a table entry whose next hop is "deliver". */
export const DELIVER = 'deliver';
/** Follow each router's longest-prefix match from `from` until a router delivers (or a loop). */
export function forwardPath(net: RNet, from: string, ip: string): string[] {
  const path = [from];
  for (let guard = 0; guard < 20; guard++) {
    const e = lpm(net.tables[path[path.length - 1]], ip);
    if (!e || e[1] === DELIVER) return path;
    path.push(e[1]);
  }
  return path;
}

const tableView = (net: RNet, at: string, ip: string, chosen?: boolean) => {
  const t = net.tables[at], m = lpm(t, ip);
  return dataTable(['prefix', 'next hop'], t.map(([p, n]) => [p, n]), { highlight: chosen && m ? [t.indexOf(m)] : [], caption: `${at}’s forwarding table` });
};

/** Task: carry a packet by clicking, at each router, the neighbour its table names. */
export function hopTask(net: RNet, from: string, ip: string): Widget {
  const path = forwardPath(net, from, ip);
  return (ctx) => {
    let at = from;
    const visited = [from];
    const box = h('div');
    const msg = h('div', { class: 'w-msg', style: 'text-align:center;min-height:1.4em' });
    const linked = (a: string, b: string) => net.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    const draw = () => {
      const done = at === path[path.length - 1];
      const hiE = visited.slice(1).map((v, k) => `${visited[k]}-${v}`);
      box.replaceChildren(
        h('div', { class: 'readout' }, `packet for ${ip} · now at ${at}`),
        network(net.nodes, net.edges, { hiNodes: [at], hiEdges: hiE, onNode: done ? undefined : click }),
        tableView(net, at, ip, done));
      if (done) { msg.textContent = `Delivered: ${at}’s table says ${lpm(net.tables[at], ip)![0]} is its own network.`; ctx.solved?.(true); }
    };
    const click = (id: string) => {
      if (id === at) return;
      if (!linked(at, id)) { msg.textContent = `${id} isn’t linked to ${at}: a router can only hand a packet to a neighbour.`; return; }
      const want = lpm(net.tables[at], ip)!;
      if (id !== want[1]) { msg.textContent = `Not ${id}. Find every prefix in ${at}’s table that contains ${ip}, and take the longest.`; return; }
      at = id; visited.push(id);
      msg.textContent = `${visited[visited.length - 2]} matched ${want[0]} → ${id}.`;
      draw();
    };
    draw();
    return h('div', null, box, msg);
  };
}

/** The same walk, played automatically, showing the matching row at each router. */
export function hopStepper(net: RNet, from: string, ip: string): Widget {
  const path = forwardPath(net, from, ip);
  return () => stepper(path.length, (i) => h('div', null,
    network(net.nodes, net.edges, { hiNodes: [path[i]], hiEdges: path.slice(1, i + 1).map((v, k) => `${path[k]}-${v}`) }),
    tableView(net, path[i], ip, true)), {
    caption: (i) => { const m = lpm(net.tables[path[i]], ip)!; return m[1] === DELIVER ? `${path[i]}: ${m[0]} is local. Delivered.` : `${path[i]}: longest match ${m[0]} → send to ${m[1]}.`; },
  });
}

// ================================================================ message timelines

export interface Msg { from: number; to: number; t0: number; t1: number; label: string; lost?: boolean; note?: string }
let markerId = 0;

/** Draw parties as vertical lines and messages as arrows sloping down with time. */
export function ladderSvg(parties: string[], msgs: Msg[], shown: number, tMax?: number): HTMLElement {
  const T = tMax ?? Math.max(...msgs.map((m) => m.t1));
  const W = 360, top = 30, H = 290, left = 64, right = 34;
  const x = (k: number) => parties.length === 1 ? (left + W - right) / 2 : left + (k * (W - left - right)) / (parties.length - 1);
  const y = (t: number) => top + (t / T) * (H - top - 14);
  const id = `lad${++markerId}`;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
  s.appendChild(svg('defs', {}, svg('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0L10,5L0,10Z', style: 'fill:var(--c1)' }))));
  parties.forEach((p, k) => {
    s.appendChild(svg('line', { x1: x(k), y1: top - 4, x2: x(k), y2: H - 6, style: 'stroke:var(--line);stroke-width:2' }));
    s.appendChild(svg('text', { x: x(k), y: 16, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:12px;font-weight:700' }, p));
  });
  msgs.slice(0, shown).forEach((m, i) => {
    const cur = i === shown - 1;
    const col = m.lost ? 'var(--bad)' : cur ? 'var(--c1)' : 'color-mix(in srgb, var(--c1) 55%, var(--panel))';
    const x1 = x(m.from), y1 = y(m.t0);
    let x2 = x(m.to), y2 = y(m.t1);
    if (m.lost) { x2 = (x1 + x2) / 2; y2 = (y1 + y2) / 2; }
    s.appendChild(svg('line', { x1, y1, x2, y2, style: `stroke:${col};stroke-width:${cur ? 2.4 : 1.6}`, 'marker-end': m.lost ? '' : `url(#${id})` }));
    if (m.lost) s.appendChild(svg('text', { x: x2, y: y2 + 5, 'text-anchor': 'middle', style: 'fill:var(--bad);font-size:16px;font-weight:700' }, '✕'));
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 4;
    s.appendChild(svg('text', { x: mx, y: my, 'text-anchor': 'middle', class: 'plot-label', style: `fill:${m.lost ? 'var(--bad)' : 'var(--text)'};font-size:11px;font-weight:600` }, m.label));
    const tEnd = m.lost ? (m.t0 + m.t1) / 2 : m.t1;
    s.appendChild(svg('text', { x: 4, y: y(tEnd) + 4, style: `fill:var(--muted);font-size:10px` }, m.lost ? '' : `${fx(m.t1)} ms`));
  });
  const d = h('div', { class: 'plot-wrap' });
  d.appendChild(s);
  return d;
}

/** Step through a message timeline one message at a time. */
export function ladder(parties: string[], msgs: Msg[]): Widget {
  return () => stepper(msgs.length + 1, (i) => ladderSvg(parties, msgs, i), {
    caption: (i) => i === 0 ? 'Time runs downwards.' : msgs[i - 1].note ?? `${msgs[i - 1].label}: arrives at ${fx(msgs[i - 1].t1)} ms.`,
    autoplayMs: 900,
  });
}

/** Messages for a chain of back-and-forth exchanges between party 0 and the others, one after another. */
export function exchanges(steps: { with: number; rtt: number; ask: string; answer: string; askNote?: string; answerNote?: string; host?: number }[]): { msgs: Msg[]; total: number } {
  const msgs: Msg[] = [];
  let t = 0;
  for (const s of steps) {
    const a = s.host ?? 0;
    msgs.push({ from: a, to: s.with, t0: t, t1: t + s.rtt / 2, label: s.ask, note: s.askNote });
    msgs.push({ from: s.with, to: a, t0: t + s.rtt / 2, t1: t + s.rtt, label: s.answer, note: s.answerNote });
    t += s.rtt;
  }
  return { msgs, total: t };
}

// ================================================================ reliable delivery

/**
 * Stop-and-wait: send one segment, wait for its ACK (or a timeout), then the next. `lost` lists
 * segments whose first copy is dropped. Returns the timeline and the time the last ACK arrives.
 */
export function stopAndWait(n: number, lost: number[], rtt: number, timeout: number): { msgs: Msg[]; total: number; ackAt: Record<number, number> } {
  const msgs: Msg[] = [];
  const ackAt: Record<number, number> = {};
  let t = 0;
  for (let k = 1; k <= n; k++) {
    if (lost.includes(k)) {
      msgs.push({ from: 0, to: 1, t0: t, t1: t + rtt / 2, label: `seg ${k}`, lost: true, note: `Segment ${k} is dropped by a full router. The sender hears nothing…` });
      t += timeout;
    }
    msgs.push({ from: 0, to: 1, t0: t, t1: t + rtt / 2, label: lost.includes(k) ? `seg ${k} again` : `seg ${k}`, note: lost.includes(k) ? `…until its ${timeout} ms timer runs out at ${t} ms, and it sends segment ${k} again.` : undefined });
    msgs.push({ from: 1, to: 0, t0: t + rtt / 2, t1: t + rtt, label: `ACK ${k + 1}`, note: `“Got everything up to ${k}; send ${k + 1} next.” Arrives at ${t + rtt} ms.` });
    t += rtt;
    ackAt[k] = t;
  }
  return { msgs, total: t, ackAt };
}

/** Cumulative ACK: the lowest segment number not yet received (segments start at 1). */
export function cumAck(received: number[]): number {
  const s = new Set(received);
  let k = 1;
  while (s.has(k)) k++;
  return k;
}

// ================================================================ congestion

/**
 * Congestion window per round trip (in segments): doubles in slow start, then +1 per RTT. When the
 * window exceeds `cap` (what the path holds before a router drops), the sender sees a loss and halves.
 */
export function cwndTrace(o: { rounds: number; w0: number; cap: number }): number[] {
  const out: number[] = [];
  let w = o.w0, ssthresh = Infinity;
  for (let r = 0; r < o.rounds; r++) {
    out.push(w);
    if (w > o.cap) { ssthresh = Math.max(2, Math.floor(w / 2)); w = ssthresh; }
    else if (w < ssthresh) w = Math.min(w * 2, ssthresh === Infinity ? w * 2 : ssthresh);
    else w += 1;
  }
  return out;
}

/** Two AIMD flows on one link: both +1 per RTT; when together they exceed cap, both halve. */
export function aimdTwo(o: { x0: number; y0: number; cap: number; rounds: number }): { x: number[]; y: number[]; halvings: number[] } {
  const x = [o.x0], y = [o.y0], halvings: number[] = [];
  for (let r = 1; r < o.rounds; r++) {
    let a = x[r - 1], b = y[r - 1];
    if (a + b > o.cap) { a = a / 2; b = b / 2; halvings.push(r); } else { a += 1; b += 1; }
    x.push(a); y.push(b);
  }
  return { x, y, halvings };
}

/** RTTs of +1 growth to climb back to w after halving it (rounded down). */
export const aimdRecover = (w: number) => w - Math.floor(w / 2);
/** RTTs of doubling from w0 until the window reaches at least target. */
export function slowStartRtts(w0: number, target: number): number {
  let w = w0, k = 0;
  while (w < target) { w *= 2; k++; }
  return k;
}

// ================================================================ DNS caching

/** A resolver cache: each miss fetches upstream and keeps the answer for ttl seconds. */
export function dnsCache(queries: number[], ttl: number): { miss: boolean[]; upstream: number } {
  let expires = -Infinity;
  const miss = queries.map((t) => { if (t < expires) return false; expires = t + ttl; return true; });
  return { miss, upstream: miss.filter(Boolean).length };
}

// ================================================================ page loads

export interface Fetch { label: string; start: number; end: number; kind: 'setup' | 'html' | 'res' }
/**
 * A page load on connections that need `setupRtts` round trips to open (TCP, maybe TLS): the HTML
 * takes one round trip, then `n` small resources go out `conns` at a time, one round trip per wave.
 * Transfer time is ignored (small files), so only round trips count.
 */
export function pageLoad(o: { rtt: number; setupRtts: number; n: number; conns: number }): { rows: Fetch[]; total: number; waves: number } {
  const rows: Fetch[] = [];
  let t = 0;
  if (o.setupRtts) { rows.push({ label: 'connect', start: 0, end: o.setupRtts * o.rtt, kind: 'setup' }); t = o.setupRtts * o.rtt; }
  rows.push({ label: 'HTML', start: t, end: t + o.rtt, kind: 'html' });
  t += o.rtt;
  const waves = Math.ceil(o.n / o.conns);
  for (let k = 0; k < o.n; k++) {
    const w = Math.floor(k / o.conns);
    rows.push({ label: `file ${k + 1}`, start: t + w * o.rtt, end: t + (w + 1) * o.rtt, kind: 'res' });
  }
  return { rows, total: t + waves * o.rtt, waves };
}

/** Horizontal bars on a shared time axis. */
export function waterfall(rows: Fetch[]): HTMLElement {
  const T = Math.max(...rows.map((r) => r.end));
  const W = 360, lw = 58, rh = Math.max(9, Math.min(16, Math.floor(300 / rows.length))), top = 6;
  const H = top + rows.length * rh + 22;
  const x = (t: number) => lw + (t / T) * (W - lw - 10);
  const col = { setup: 'var(--c5)', html: 'var(--c2)', res: 'var(--c1)' };
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', style: `max-width:${W}px` });
  rows.forEach((r, k) => {
    const y = top + k * rh;
    s.appendChild(svg('text', { x: lw - 6, y: y + rh * 0.75, 'text-anchor': 'end', style: `fill:var(--muted);font-size:${Math.min(11, rh - 1)}px` }, r.label));
    s.appendChild(svg('rect', { x: x(r.start), y: y + 1, width: Math.max(1, x(r.end) - x(r.start)), height: rh - 2, rx: 2, style: `fill:${col[r.kind]}` }));
  });
  const yb = top + rows.length * rh + 4;
  s.appendChild(svg('line', { x1: lw, y1: yb, x2: W - 10, y2: yb, class: 'axis' }));
  s.appendChild(svg('text', { x: lw, y: yb + 14, class: 'tick' }, '0'));
  s.appendChild(svg('text', { x: W - 10, y: yb + 14, class: 'tick', 'text-anchor': 'end' }, `${fx(T)} ms`));
  const d = h('div', { class: 'plot-wrap' });
  d.appendChild(s);
  return d;
}

/** Average time to fetch through a CDN edge: every request pays the edge, misses also pay the origin. */
export const cdnMs = (hit: number, edgeMs: number, originMs: number) => edgeMs + (1 - hit) * originMs;
