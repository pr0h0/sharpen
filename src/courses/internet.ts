// How the Internet Works: packets, addresses and routing, latency vs bandwidth, reliable delivery,
// congestion, DNS, HTTP, and CDNs and HTTPS. Every stated number comes from the models in
// src/widgets/internet.ts (the same code that draws the pictures), never from a hand calculation.
import type { Choice, Course, Generator } from '../types';
import { h, num, pct, pick, randInt, shuffle } from '../ui';
import { barChart } from '../viz/charts';
import { codeBlock } from '../viz/cs';
import { explorer, plotExplorer } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  aimdRecover, aimdTwo, blockSize, cdnMs, cumAck, cwndTrace, DELIVER, dnsCache, exchanges, fibreMs, forwardPath, hopStepper, hopTask,
  inPrefix, ipBits, ladder, linkShareStepper, lpm, type Msg, packetsFor, pageLoad, prefixLen, race, raceStepper, type RNet, type Route,
  sendMs, shareLink, slowStartRtts, stopAndWait, type Table, transferMs, waterfall,
} from '../widgets/internet';

const COLOR = '#2487c9';
const fx = (v: number, d = 1) => num(+v.toFixed(d));
const big = (v: number) => v.toLocaleString('en-US');
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const check = (ok: boolean, what: string) => { if (!ok) console.error('internet course: ' + what); };

// ================================================================ lesson 1 data

const SENDERS = [{ name: 'A', packets: 6 }, { name: 'B', packets: 2 }, { name: 'C', packets: 0 }];
const CIRC = shareLink(SENDERS, 'circuit'), PACK = shareLink(SENDERS, 'packet');
const SENT = sum(SENDERS.map((s) => s.packets));
const PHOTO = 1_000_000, MSS = 1460, HDR = 40, MTU = 1500;
const PHOTO_PKTS = packetsFor(PHOTO, MSS);

const RACE_NODES = [{ id: 'S', x: 4, y: 30 }, { id: 'R1', x: 32, y: 8 }, { id: 'R2', x: 68, y: 8 }, { id: 'R3', x: 32, y: 52 }, { id: 'R4', x: 68, y: 52 }, { id: 'D', x: 96, y: 30 }];
const RACE_EDGES = [['S', 'R1', 1], ['R1', 'R2', 1], ['R2', 'D', 1], ['S', 'R3', 1], ['R3', 'R4', 4], ['R4', 'D', 1]].map(([a, b, w]) => ({ a: a as string, b: b as string, w: w as number }));
const TOP: Route = { nodes: ['S', 'R1', 'R2', 'D'], delays: [1, 1, 1] };
const LOW: Route = { nodes: ['S', 'R3', 'R4', 'D'], delays: [1, 4, 1] };
const RACE_ROUTES = [TOP, LOW, TOP, TOP, LOW, TOP];
const RACE = race(RACE_ROUTES);
const arrivedBy = (t: number) => RACE.arrive.map((a, k) => (a <= t ? k + 1 : 0)).filter(Boolean);
const RACE_T1 = 6, RACE_T2 = RACE.arrive[1];
const DELIV_T1 = cumAck(arrivedBy(RACE_T1)) - 1, DELIV_T2 = cumAck(arrivedBy(RACE_T2)) - 1;

// ================================================================ lesson 2 data

const NET: RNet = {
  nodes: [{ id: 'H', x: 4, y: 30 }, { id: 'I', x: 26, y: 30 }, { id: 'A', x: 52, y: 8 }, { id: 'B', x: 52, y: 52 }, { id: 'C', x: 76, y: 30 }, { id: 'M', x: 96, y: 8 }, { id: 'W', x: 96, y: 52 }],
  edges: [['H', 'I'], ['I', 'A'], ['I', 'B'], ['A', 'C'], ['B', 'C'], ['A', 'M'], ['C', 'W']].map(([a, b]) => ({ a, b })),
  tables: {
    H: [['192.168.1.0/24', DELIVER], ['0.0.0.0/0', 'I']],
    I: [['203.0.113.0/24', 'B'], ['198.51.100.0/24', 'A'], ['0.0.0.0/0', 'A']],
    A: [['198.51.100.0/24', 'M'], ['203.0.0.0/8', 'C'], ['0.0.0.0/0', 'I']],
    B: [['203.0.113.0/24', 'C'], ['0.0.0.0/0', 'I']],
    C: [['203.0.113.0/24', 'W'], ['0.0.0.0/0', 'A']],
    M: [['198.51.100.0/24', DELIVER], ['0.0.0.0/0', 'A']],
    W: [['203.0.113.0/24', DELIVER], ['0.0.0.0/0', 'C']],
  },
};
const DST1 = '203.0.113.7', DST2 = '198.51.100.20';
const PATH1 = forwardPath(NET, 'H', DST1), PATH2 = forwardPath(NET, 'H', DST2);
const I_PICK = lpm(NET.tables.I, DST1)!;
const I_MATCHES = NET.tables.I.filter(([p]) => inPrefix(DST1, p));
check(I_MATCHES.length === 2 && I_PICK[1] === 'B', 'router I example changed');
const ALL_V4 = 2 ** 32;
const NEAR = '203.0.114.5', NEAR_IN = inPrefix(NEAR, '203.0.113.0/24');
check(!NEAR_IN, 'NEAR should be outside the /24');
const HALF = '203.0.113.0/25';
const HALF_ITEMS = ['203.0.113.5', '203.0.113.100', '203.0.113.127', '203.0.113.128', '203.0.113.200', '203.0.112.5'];

// ================================================================ lesson 3 data

const LON_NY = 5570, SYD_LON = 17000, HALF_EARTH = 20000;
const LN_ONE = fibreMs(LON_NY), SL_RTT = 2 * fibreMs(SYD_LON), HE_RTT = 2 * fibreMs(HALF_EARTH);
const BIG = 1_000_000, SMALL = 10_000, LAT = 50, BW = 100;
const T_BIG = transferMs(LAT, BIG, BW), T_SMALL = transferMs(LAT, SMALL, BW);
const T_SMALL_2BW = transferMs(LAT, SMALL, 2 * BW), T_SMALL_HALFLAT = transferMs(LAT / 2, SMALL, BW);
const PAGE_RTTS = 8, PAGE_BYTES = 2_000_000, PAGE_GOAL = 300;
const pageMs = (rtt: number, mbps: number) => PAGE_RTTS * rtt + sendMs(PAGE_BYTES, mbps);
const PAGE_BEST_BW = pageMs(100, 1000);

// ================================================================ lesson 4 data

const SW_RTT = 100, SW_TIMEOUT = 300;
const SW = stopAndWait(3, [2], SW_RTT, SW_TIMEOUT);
const SW_CLEAN = stopAndWait(3, [], SW_RTT, SW_TIMEOUT);
const GOT = [1, 2, 3, 5, 6], GOT_ACK = cumAck(GOT);
const HS_RTT = 80;
const HS = exchanges([
  { with: 1, rtt: HS_RTT, ask: 'SYN', answer: 'SYN-ACK', askNote: '“I’d like to talk. My numbering starts here.”', answerNote: '“Fine. Mine starts here, and I got yours.” One round trip has gone by and no data has moved.' },
  { with: 1, rtt: HS_RTT, ask: 'ACK + GET /', answer: 'page', askNote: 'The client confirms and sends its request in the same packet.', answerNote: `The page arrives after two round trips: ${2 * HS_RTT} ms.` },
]);
const WIN = 65_535, WIN_RTT = 100;
const mbpsOf = (bytes: number, rttMs: number) => (bytes * 8) / (rttMs * 1000);
const WIN_MBPS = mbpsOf(WIN, WIN_RTT);
const LINK = 100, LINK_RTT = 40;
const BDP_KB = (LINK * 1000 * LINK_RTT) / 8 / 1000;

// ================================================================ lesson 5 data

const CW = cwndTrace({ rounds: 36, w0: 10, cap: 60 });
const W0 = 10, SS_TARGET = 640, SS_RTTS = slowStartRtts(W0, SS_TARGET);
const SS_K = 4, SS_SENT = sum(cwndTrace({ rounds: SS_K, w0: W0, cap: Infinity }));
const LOSS_W = 40, LOSS_BACK = aimdRecover(LOSS_W);
const TWO = aimdTwo({ x0: 40, y0: 4, cap: 60, rounds: 70 });
const H1 = TWO.halvings[0];
const GAP0 = TWO.x[0] - TWO.y[0], GAP1 = TWO.x[H1] - TWO.y[H1];
const FAIR_C = 100, FAIR_N = 4;

// ================================================================ lesson 6 data

const DNS = { client: 20, root: 30, tld: 40, auth: 60 };
const PARTIES = ['You', 'Resolver', 'Root', '.com', 'Auth'];
function dnsMsgs(cached: boolean): { msgs: Msg[]; total: number } {
  const msgs: Msg[] = [];
  let t = DNS.client / 2;
  msgs.push({ from: 0, to: 1, t0: 0, t1: t, label: 'example.com?', note: 'Your device asks its resolver (your ISP’s, or a public one).' });
  if (!cached) {
    const hop = (to: number, rtt: number, q: string, a: string, qn: string, an: string) => {
      msgs.push({ from: 1, to, t0: t, t1: t + rtt / 2, label: q, note: qn });
      msgs.push({ from: to, to: 1, t0: t + rtt / 2, t1: t + rtt, label: a, note: an });
      t += rtt;
    };
    hop(2, DNS.root, 'example.com?', 'ask .com', 'The resolver starts at a root server.', 'The root doesn’t know, but it knows who runs .com.');
    hop(3, DNS.tld, 'example.com?', 'ask Auth', 'Next, a .com server.', 'It knows which servers are in charge of example.com.');
    hop(4, DNS.auth, 'example.com?', 'address', 'Finally the authoritative server for example.com.', 'The actual answer, with a TTL saying how long it may be kept.');
  }
  msgs.push({ from: 1, to: 0, t0: t, t1: t + DNS.client / 2, label: cached ? 'from cache' : 'answer', note: cached ? 'Still in the cache: answered straight away.' : 'The resolver caches it and passes it on.' });
  return { msgs, total: t + DNS.client / 2 };
}
const COLD = dnsMsgs(false), WARM = dnsMsgs(true);
check(COLD.total === sum(Object.values(DNS)), 'cold DNS time');
const TTL_Q = [0, 100, 250, 320, 500, 700], TTL = 300, TTL_SIM = dnsCache(TTL_Q, TTL);
const DAY_TTL = 86_400, POP_TTL = 300, PER_HOUR = 3600 / POP_TTL;

// ================================================================ lesson 7 data

const PL_DEMO = pageLoad({ rtt: 50, setupRtts: 1, n: 12, conns: 6 });
const PL_30 = pageLoad({ rtt: 50, setupRtts: 1, n: 30, conns: 6 });
const PL_H2 = pageLoad({ rtt: 50, setupRtts: 1, n: 30, conns: 30 });
const NM_BYTES = 500_000, NM_BW = 20, NM_SAVED = sendMs(NM_BYTES, NM_BW);
const REDIR = 2, REDIR_RTT = 120;

// ================================================================ lesson 8 data

const EDGE = 10, ORIGIN = 190;
const CDN_90 = cdnMs(0.9, EDGE, ORIGIN);
const ORIGIN_RPS = 50_000, ORIGIN_HIT = 0.98, ORIGIN_LOAD = Math.round(ORIGIN_RPS * (1 - ORIGIN_HIT));
const FACTOR = Math.round((1 - 0.9) / (1 - 0.99));
const CDN_GOAL = 30;
const CDN_MIN_HIT = (() => { let k = 0; while (cdnMs(k / 100, EDGE, ORIGIN) > CDN_GOAL) k++; return k; })();
const TLS_RTT = 60;
const TLS = exchanges([
  { with: 1, rtt: TLS_RTT, ask: 'SYN', answer: 'SYN-ACK', askNote: 'TCP handshake: one round trip.' },
  { with: 1, rtt: TLS_RTT, ask: 'ClientHello', answer: 'ServerHello + cert', askNote: 'TLS 1.3: the browser proposes keys…', answerNote: '…the server answers with its share of the key and a certificate proving it is the real site. Now both sides have a shared secret.' },
  { with: 1, rtt: TLS_RTT, ask: 'GET / (encrypted)', answer: 'page (encrypted)', answerNote: `First byte of the page after three round trips: ${3 * TLS_RTT} ms.` },
]);

// ================================================================ practice generators

const genPackets: Generator = (rng) => {
  const kb = randInt(rng, 20, 5000), payload = pick(rng, [1460, 1200, 536]);
  const n = packetsFor(kb * 1000, payload);
  return {
    kind: 'number', unit: 'packets',
    body: `A ${big(kb)} KB file (1 KB = 1,000 bytes) is sent in packets that each carry **${big(payload)} bytes** of data. How many packets does it take?`,
    answer: n, tol: 0,
    hint: 'Divide and round up: a last, partly filled packet still counts.',
    explain: `${big(kb * 1000)} ÷ ${big(payload)} = ${fx(kb * 1000 / payload, 2)}, so ${big(n)} packets (the last one only partly full).`,
  };
};

const genShare: Generator = (rng) => {
  const C = pick(rng, [10, 20, 50, 100]), N = randInt(rng, 2, 10), mb = pick(rng, [5, 10, 25, 50, 100]);
  const circuit = rng() < 0.5;
  const t = (mb * 8) / (circuit ? C / N : C);
  return {
    kind: 'number', unit: 's',
    body: `A ${C} Mbps link is shared by ${N} users, but right now only you are downloading: a ${mb} MB file (1 MB = 8 megabits). How many seconds does it take if the link is split into **${circuit ? `${N} reserved circuits, one per user` : 'packets, used by whoever has data'}**?`,
    answer: t, tol: Math.max(0.05, t * 0.01),
    hint: circuit ? `A reserved circuit gets 1/${N} of the link even when the others are idle.` : 'With packets, idle users take nothing, so you get the whole link.',
    explain: circuit
      ? `Your circuit is ${C}/${N} = ${fx(C / N, 2)} Mbps. ${mb * 8} megabits ÷ ${fx(C / N, 2)} = ${fx(t, 2)} s, while the other ${N - 1} circuits sit idle. Packets would take ${fx((mb * 8) / C, 2)} s.`
      : `You get all ${C} Mbps: ${mb * 8} megabits ÷ ${C} = ${fx(t, 2)} s. A reserved circuit would give you only ${fx(C / N, 2)} Mbps and take ${N} times as long.`,
  };
};

const genInOrder: Generator = (rng) => {
  const n = randInt(rng, 6, 10);
  const got = shuffle(rng, Array.from({ length: n }, (_, k) => k + 1)).slice(0, randInt(rng, 3, n - 1));
  const k = cumAck(got) - 1;
  return {
    kind: 'number', unit: 'packets',
    body: `A message was cut into packets 1–${n}. So far the receiver has packets **${got.join(', ')}** (in that arrival order). How many packets can it hand to the application **in order** right now?`,
    answer: k, tol: 0,
    hint: 'Start at packet 1 and count until the first missing number.',
    explain: k === 0 ? 'Packet 1 hasn’t arrived, so nothing can be handed over yet; the rest wait in a buffer.' : `Packets 1–${k} are all there; packet ${k + 1} is missing, so everything after it waits in a buffer.`,
  };
};

const genSubnetSize: Generator = (rng) => {
  const len = randInt(rng, 16, 30), n = blockSize(len);
  return {
    kind: 'number', unit: 'addresses',
    body: `How many IPv4 addresses are in a **/${len}** block?`,
    answer: n, tol: 0,
    hint: `An IPv4 address has 32 bits; /${len} fixes the first ${len}.`,
    explain: `${32 - len} bits are free to vary, so 2^${32 - len} = ${big(n)} addresses.`,
  };
};

const genInSubnet: Generator = (rng) => {
  const a = randInt(rng, 11, 223), b = randInt(rng, 0, 254), c = randInt(rng, 1, 254);
  const wide = rng() < 0.4;
  const prefix = wide ? `${a}.${b}.0.0/16` : `${a}.${b}.${c}.0/24`;
  const variant = randInt(rng, 0, 2);
  const ip = variant === 0 ? (wide ? `${a}.${b}.${randInt(rng, 0, 255)}.${randInt(rng, 1, 254)}` : `${a}.${b}.${c}.${randInt(rng, 1, 254)}`)
    : variant === 1 ? (wide ? `${a}.${b + 1}.${randInt(rng, 0, 255)}.${randInt(rng, 1, 254)}` : `${a}.${b}.${c + pick(rng, [-1, 1])}.${randInt(rng, 1, 254)}`)
      : `${a + 1}.${b}.${c}.${randInt(rng, 1, 254)}`;
  const yes = inPrefix(ip, prefix), fixed = wide ? 'two' : 'three';
  return {
    kind: 'choice',
    body: `Is **${ip}** inside the block **${prefix}**?`,
    options: [
      { text: 'Yes', correct: yes, why: yes ? undefined : `/${prefixLen(prefix)} fixes the first ${fixed} numbers, and they don’t all match.` },
      { text: 'No', correct: !yes, why: yes ? `The first ${fixed} numbers match exactly; the rest is free to be anything.` : undefined },
    ],
    hint: `/${prefixLen(prefix)} means the first ${prefixLen(prefix)} bits, that is the first ${fixed} numbers, must match.`,
    explain: yes ? `The first ${fixed} numbers agree, so it’s in the block.` : `The first ${fixed} numbers of ${ip} differ from ${prefix.split('/')[0]}, so it belongs to a different block.`,
  };
};

const genLongestPrefix: Generator = (rng) => {
  const p = randInt(rng, 11, 200), q = randInt(rng, 0, 250), r = randInt(rng, 0, 250);
  const table: Table = [['0.0.0.0/0', 'A'], [`${p}.0.0.0/8`, 'B'], [`${p}.${q}.0.0/16`, 'C'], [`${p}.${q}.${r}.0/24`, 'D']];
  const depth = randInt(rng, 0, 3), x = () => randInt(rng, 1, 254);
  const ip = [`${p + 1}.${x()}.${x()}.${x()}`, `${p}.${q + 1}.${x()}.${x()}`, `${p}.${q}.${r + 1}.${x()}`, `${p}.${q}.${r}.${x()}`][depth];
  const best = lpm(table, ip)!;
  const options: Choice[] = table.map(([pre, nh]) => ({
    text: `Link ${nh}`, correct: nh === best[1],
    why: nh === best[1] ? undefined : !inPrefix(ip, pre) ? `${pre} doesn’t contain ${ip}.` : `${pre} matches, but only ${prefixLen(pre)} bits; ${best[0]} matches more.`,
  }));
  return {
    kind: 'choice',
    body: `A router’s table:\n\n- ${table.map(([pre, nh]) => `${pre} → link ${nh}`).join('\n- ')}\n\nA packet arrives for **${ip}**. Which link does it go out on?`,
    options,
    hint: 'Find every entry that contains the address, then take the one with the longest prefix (the biggest number after the slash).',
    explain: `${table.filter(([pre]) => inPrefix(ip, pre)).map(([pre]) => pre).join(', ')} contain${table.filter(([pre]) => inPrefix(ip, pre)).length === 1 ? 's' : ''} it; the longest is ${best[0]}, so link ${best[1]}.`,
  };
};

const genFibre: Generator = (rng) => {
  const km = randInt(rng, 5, 200) * 100, rt = rng() < 0.5;
  const ms = (rt ? 2 : 1) * fibreMs(km);
  return {
    kind: 'number', unit: 'ms',
    body: `Light in optical fibre travels about 200,000 km/s. Two cities are ${big(km)} km apart along the cable. What is the fastest possible **${rt ? 'round trip' : 'one-way'}** time, in milliseconds?`,
    answer: ms, tol: Math.max(0.1, ms * 0.01),
    hint: '200,000 km/s is 200 km per millisecond.',
    explain: `${big(km)} ÷ 200 = ${fx(fibreMs(km), 2)} ms one way${rt ? `, so ${fx(ms, 2)} ms there and back` : ''}. Real paths are longer and add router delays, so measured times are higher.`,
  };
};

const genTransfer: Generator = (rng) => {
  const lat = pick(rng, [5, 10, 20, 40, 80, 150]), mbps = pick(rng, [10, 20, 50, 100, 200, 500, 1000]);
  const mb = rng() < 0.5, size = mb ? randInt(rng, 1, 20) : randInt(rng, 5, 500);
  const bytes = size * (mb ? 1e6 : 1e3), t = transferMs(lat, bytes, mbps), s = sendMs(bytes, mbps);
  return {
    kind: 'number', unit: 'ms',
    body: `Latency ${lat} ms, bandwidth ${mbps} Mbps. How long until a **${size} ${mb ? 'MB' : 'KB'}** file has fully arrived (1 ${mb ? 'MB' : 'KB'} = ${mb ? '1,000,000' : '1,000'} bytes = ${mb ? '8,000,000' : '8,000'} bits)? Use time = latency + size ÷ bandwidth.`,
    answer: t, tol: Math.max(0.1, t * 0.01),
    hint: `${mbps} Mbps is ${big(mbps * 1000)} bits per millisecond.`,
    explain: `${big(bytes * 8)} bits ÷ ${big(mbps * 1000)} bits/ms = ${fx(s, 3)} ms of sending, plus ${lat} ms latency: ${fx(t, 3)} ms. ${s > lat ? 'Here bandwidth dominates.' : 'Here latency dominates.'}`,
  };
};

const genWhichHelps: Generator = (rng) => {
  for (;;) {
    const lat = pick(rng, [10, 20, 40, 80, 150]), mbps = pick(rng, [10, 25, 50, 100, 300]);
    const kb = pick(rng, [5, 20, 50, 200, 1000, 5000, 20000]);
    const bytes = kb * 1000;
    const now = transferMs(lat, bytes, mbps), bw2 = transferMs(lat, bytes, 2 * mbps), lat2 = transferMs(lat / 2, bytes, mbps);
    if (Math.abs(bw2 - lat2) < 0.05 * now) continue;
    const bwWins = bw2 < lat2;
    return {
      kind: 'choice',
      body: `Downloading a ${big(kb)} KB file over a link with ${lat} ms latency and ${mbps} Mbps takes ${fx(now, 3)} ms. Which upgrade makes it faster?`,
      options: [
        { text: 'Double the bandwidth', correct: bwWins, why: bwWins ? undefined : `That gives ${fx(bw2, 3)} ms: the sending part was already small, latency dominates.` },
        { text: 'Halve the latency', correct: !bwWins, why: bwWins ? `That gives ${fx(lat2, 3)} ms: for a file this big, sending time dominates, not latency.` : undefined },
      ],
      hint: 'Compare the two parts: latency, and size ÷ bandwidth. Halving the bigger part helps more.',
      explain: `Latency part ${lat} ms, sending part ${fx(sendMs(bytes, mbps), 3)} ms. Double bandwidth: ${fx(bw2, 3)} ms. Halve latency: ${fx(lat2, 3)} ms.`,
    };
  }
};

const genHandshake: Generator = (rng) => {
  const rtt = randInt(rng, 2, 40) * 5, tls = rng() < 0.5;
  const rtts = 1 + (tls ? 1 : 0) + 1;
  return {
    kind: 'number', unit: 'ms',
    body: `Round-trip time to a server is ${rtt} ms. On a **brand-new** ${tls ? 'HTTPS connection (TCP, then TLS 1.3)' : 'plain TCP connection'}, how long from the first packet until the first byte of a small page arrives? Ignore DNS.`,
    answer: rtts * rtt, tol: 0.5,
    hint: tls ? 'TCP handshake: 1 round trip. TLS 1.3 handshake: 1 more. Then the request and response.' : 'TCP handshake: 1 round trip. Then the request and response.',
    explain: `${tls ? 'TCP 1 + TLS 1 + request 1' : 'Handshake 1 + request 1'} = ${rtts} round trips × ${rtt} ms = ${rtts * rtt} ms.`,
  };
};

const genCumAck: Generator = (rng) => {
  const n = randInt(rng, 5, 9);
  const got = shuffle(rng, Array.from({ length: n }, (_, k) => k + 1)).slice(0, randInt(rng, 2, n - 1)).sort((a, b) => a - b);
  const ack = cumAck(got);
  return {
    kind: 'number',
    body: `TCP acknowledgements are cumulative: “I have everything before n, send n next.” The receiver holds segments **${got.join(', ')}**. What number does its ACK carry?`,
    answer: ack, tol: 0,
    hint: 'Find the first segment number that is missing.',
    explain: `Segments 1–${ack - 1 || 0} ${ack === 1 ? 'are not all there (1 is missing)' : 'are complete'}, so the ACK asks for ${ack}. Segments after the gap are kept, but the ACK can’t mention them.`,
  };
};

const genWindow: Generator = (rng) => {
  const rtt = pick(rng, [10, 20, 25, 40, 50, 80, 100, 200]);
  if (rng() < 0.5) {
    const kb = pick(rng, [16, 32, 64, 128, 256, 512]), mbps = mbpsOf(kb * 1000, rtt);
    return {
      kind: 'number', unit: 'Mbps',
      body: `A sender may have at most **${kb} KB** unacknowledged (1 KB = 1,000 bytes), and the round trip is **${rtt} ms**. What is the most it can send, in megabits per second, however fast the link?`,
      answer: mbps, tol: Math.max(0.01, mbps * 0.01),
      hint: 'One window per round trip. Convert bytes to bits.',
      explain: `${kb * 1000 * 8} bits per ${rtt} ms = ${fx(mbps, 3)} Mbps. To go faster you need a bigger window or a shorter round trip.`,
    };
  }
  const link = pick(rng, [10, 50, 100, 200, 1000]), kb = (link * 1000 * rtt) / 8 / 1000;
  return {
    kind: 'number', unit: 'KB',
    body: `To keep a **${link} Mbps** link busy with a **${rtt} ms** round trip, how big must the window be, in KB (1 KB = 1,000 bytes)?`,
    answer: kb, tol: Math.max(0.1, kb * 0.01),
    hint: 'Window = bandwidth × round-trip time (the bandwidth-delay product).',
    explain: `${link} Mbps × ${rtt} ms = ${big(link * 1000 * rtt)} bits = ${fx(kb, 4)} KB in flight.`,
  };
};

const genSlowStart: Generator = (rng) => {
  const w0 = pick(rng, [1, 2, 4, 10]);
  if (rng() < 0.5) {
    const target = randInt(rng, w0 * 3, 2000), k = slowStartRtts(w0, target);
    return {
      kind: 'number', unit: 'RTTs',
      body: `Slow start begins with a window of ${w0} segment${w0 === 1 ? '' : 's'} and doubles it every round trip. After how many round trips is the window at least **${big(target)}** segments?`,
      answer: k, tol: 0,
      hint: 'Keep doubling and count.',
      explain: `${w0} × 2^${k} = ${big(w0 * 2 ** k)} ≥ ${big(target)}, but ${w0} × 2^${k - 1} = ${big(w0 * 2 ** (k - 1))} is not. So ${k} round trips.`,
    };
  }
  const k = randInt(rng, 2, 7), sent = sum(cwndTrace({ rounds: k, w0, cap: Infinity }));
  return {
    kind: 'number', unit: 'segments',
    body: `Slow start begins with ${w0} segment${w0 === 1 ? '' : 's'} and doubles every round trip, with no losses. How many segments in total are sent in the first **${k}** round trips?`,
    answer: sent, tol: 0,
    hint: `Add ${w0} + ${2 * w0} + ${4 * w0} + … for ${k} terms.`,
    explain: `${cwndTrace({ rounds: k, w0, cap: Infinity }).join(' + ')} = ${big(sent)}.`,
  };
};

const genFairShare: Generator = (rng) => {
  const C = pick(rng, [10, 50, 100, 200, 1000]), n = randInt(rng, 2, 8), d = randInt(rng, 1, 3), join = rng() < 0.5 || n - d < 1;
  const after = join ? n + d : n - d;
  return {
    kind: 'number', unit: 'Mbps',
    body: `${n} downloads share a ${C} Mbps bottleneck fairly. Then ${d} more download${d === 1 ? '' : 's'} ${join ? (d === 1 ? 'joins' : 'join') : (d === 1 ? 'finishes' : 'finish')}. What does each remaining download get?`,
    answer: C / after, tol: Math.max(0.01, (C / after) * 0.01),
    hint: 'Fair shares split the link equally among the flows using it.',
    explain: `${C} ÷ ${after} = ${fx(C / after, 3)} Mbps each (it was ${fx(C / n, 3)} with ${n}).`,
  };
};

const genAIMD: Generator = (rng) => {
  const w = randInt(rng, 8, 120), back = aimdRecover(w);
  return {
    kind: 'number', unit: 'RTTs',
    body: `A TCP sender’s window is **${w}** segments when a loss is detected. It halves (rounding down), then grows by 1 segment per round trip. How many round trips until it is back to ${w}?`,
    answer: back, tol: 0,
    hint: 'Halve, then count the +1 steps.',
    explain: `${w} → ${Math.floor(w / 2)}, then +1 per round trip: ${w} − ${Math.floor(w / 2)} = ${back} round trips. Slow and steady upward, sharp downward.`,
  };
};

const genDnsTime: Generator = (rng) => {
  const c = randInt(rng, 2, 10) * 5, r = randInt(rng, 2, 12) * 5, t = randInt(rng, 2, 12) * 5, a = randInt(rng, 2, 20) * 5;
  const kind = pick(rng, ['cold', 'tld', 'cached'] as const);
  const total = c + (kind === 'cold' ? r + t + a : kind === 'tld' ? t + a : 0);
  const desc = { cold: 'its cache is empty', tld: 'it already has the root’s referral to the TLD servers cached, but nothing else', cached: 'it already has the answer cached' }[kind];
  return {
    kind: 'number', unit: 'ms',
    body: `Round trips: you ↔ resolver ${c} ms, resolver ↔ root ${r} ms, resolver ↔ TLD server ${t} ms, resolver ↔ authoritative server ${a} ms. You look up a name and **${desc}**. How long does the lookup take?`,
    answer: total, tol: 0.5,
    hint: 'You always pay the trip to the resolver; it only asks the servers it has no cached answer for.',
    explain: kind === 'cold' ? `${c} + ${r} + ${t} + ${a} = ${total} ms.` : kind === 'tld' ? `It skips the root: ${c} + ${t} + ${a} = ${total} ms.` : `Only your trip to the resolver: ${total} ms.`,
  };
};

const genTtl: Generator = (rng) => {
  const ttl = pick(rng, [60, 120, 300, 600]);
  const qs: number[] = [];
  let t = 0;
  for (let k = 0; k < randInt(rng, 5, 7); k++) { qs.push(t); t += randInt(rng, 1, 8) * ttl / 4; }
  const sim = dnsCache(qs, ttl);
  return {
    kind: 'number', unit: 'lookups',
    body: `A resolver starts with an empty cache. The record has a TTL of **${ttl} s**. Queries for it arrive at seconds **${qs.join(', ')}**. How many times must the resolver fetch it from the authoritative server?`,
    answer: sim.upstream, tol: 0,
    hint: 'A fetch keeps the answer for TTL seconds from that moment. A query after it expires triggers a new fetch.',
    explain: `Fetches at ${qs.filter((_, k) => sim.miss[k]).join(', ')}: ${sim.upstream}. The others were within ${ttl} s of the last fetch.`,
  };
};

const SITES = [['news', 'example.org'], ['shop', 'example.com'], ['mail', 'example.net'], ['maps', 'example.com'], ['docs', 'example.org'], ['video', 'example.net']];
const genDnsWalk: Generator = (rng) => {
  const [sub, dom] = pick(rng, SITES), tld = dom.split('.')[1], name = `${sub}.${dom}`;
  return {
    kind: 'order',
    body: `A resolver with an empty cache looks up **${name}**. Put its steps in order.`,
    items: [`It asks a root server about ${name}`, `The root refers it to the .${tld} servers`, `A .${tld} server refers it to ${dom}’s servers`, `${dom}’s server replies with the address`, 'It caches the answer and replies to you'],
    hint: 'From the right end of the name to the left.',
    explain: `Names are read right to left: root, then .${tld}, then ${dom}. Each level only knows who handles the next one down.`,
  };
};

const CODES: [number, string][] = [[200, 'OK'], [201, 'Created'], [204, 'No Content'], [301, 'Moved Permanently'], [302, 'Found'], [304, 'Not Modified'], [400, 'Bad Request'], [401, 'Unauthorized'], [403, 'Forbidden'], [404, 'Not Found'], [429, 'Too Many Requests'], [500, 'Internal Server Error'], [502, 'Bad Gateway'], [503, 'Service Unavailable']];
const CLASSES = [
  { d: 2, text: 'Success: here it is', desc: 'the request worked' },
  { d: 3, text: 'Redirection: look elsewhere (or use your copy)', desc: 'the answer is somewhere else or unchanged' },
  { d: 4, text: 'Client error: the request was wrong', desc: 'the problem is with the request (address, permission, rate)' },
  { d: 5, text: 'Server error: the server failed', desc: 'the request may be fine but the server couldn’t handle it' },
];
const genStatus: Generator = (rng) => {
  const [code, name] = pick(rng, CODES), d = Math.floor(code / 100);
  return {
    kind: 'choice',
    body: `A server answers **${code} ${name}**. What kind of response is it?`,
    options: CLASSES.map((c) => ({ text: c.text, correct: c.d === d, why: c.d === d ? undefined : `${c.d}xx codes mean ${c.desc}. This one starts with ${d}.` })),
    hint: 'The first digit gives the class.',
    explain: `${code} starts with ${d}: ${CLASSES[d - 2].desc}.`,
  };
};

const genPageLoad: Generator = (rng) => {
  const rtt = randInt(rng, 2, 30) * 5, n = randInt(rng, 5, 60), conns = pick(rng, [2, 4, 6]), setup = pick(rng, [1, 2]);
  const pl = pageLoad({ rtt, setupRtts: setup, n, conns });
  return {
    kind: 'number', unit: 'ms',
    body: `Round trip ${rtt} ms. Opening the connection${conns > 1 ? 's' : ''} takes ${setup} round trip${setup > 1 ? 's' : ''} (${setup > 1 ? 'TCP + TLS' : 'TCP'}). The HTML takes 1 round trip, then ${n} small files are fetched **${conns} at a time**, each taking 1 round trip. Total time? (Ignore transfer time.)`,
    answer: pl.total, tol: 0.5,
    hint: `Files go out in waves of ${conns}: ⌈${n}/${conns}⌉ waves.`,
    explain: `${setup} + 1 + ${pl.waves} (⌈${n}/${conns}⌉) = ${setup + 1 + pl.waves} round trips × ${rtt} ms = ${pl.total} ms.`,
  };
};

const genNotModified: Generator = (rng) => {
  const kb = pick(rng, [50, 100, 200, 500, 1000, 2000]), mbps = pick(rng, [5, 10, 20, 50, 100]);
  const saved = sendMs(kb * 1000, mbps);
  return {
    kind: 'number', unit: 'ms',
    body: `Your browser has a cached copy of a ${big(kb)} KB image (1 KB = 1,000 bytes). It asks “has this changed?” and the server answers **304 Not Modified**. On a ${mbps} Mbps connection, how much sending time did that save compared with downloading it again?`,
    answer: saved, tol: Math.max(0.1, saved * 0.01),
    hint: 'The round trip happens either way; the saving is the size ÷ bandwidth part.',
    explain: `${big(kb * 8000)} bits ÷ ${big(mbps * 1000)} bits/ms = ${fx(saved, 3)} ms saved. The round trip itself is still paid; a long enough cache lifetime (max-age) skips even that.`,
  };
};

const genCdnAvg: Generator = (rng) => {
  const hit = randInt(rng, 50, 99) / 100, edge = pick(rng, [5, 10, 15, 20]), origin = randInt(rng, 5, 30) * 10;
  const avg = cdnMs(hit, edge, origin);
  return {
    kind: 'number', unit: 'ms',
    body: `A CDN edge is ${edge} ms away. On a miss, the edge must also fetch from the origin, adding ${origin} ms. With a **${pct(hit, 0)} hit ratio**, what is the average time per request?`,
    answer: avg, tol: Math.max(0.1, avg * 0.01),
    hint: 'Everyone pays the edge; only misses pay the origin.',
    explain: `${edge} + ${pct(1 - hit, 0)} × ${origin} = ${edge} + ${fx((1 - hit) * origin, 3)} = ${fx(avg, 3)} ms.`,
  };
};

const genOriginLoad: Generator = (rng) => {
  const rps = pick(rng, [1000, 5000, 20_000, 50_000, 100_000]), hit = pick(rng, [0.8, 0.9, 0.95, 0.98, 0.99, 0.995]);
  const load = Math.round(rps * (1 - hit));
  return {
    kind: 'number', unit: 'requests/s',
    body: `A site gets ${big(rps)} requests per second through a CDN with a **${pct(hit)} hit ratio**. How many requests per second reach the origin server?`,
    answer: load, tol: 0.5,
    hint: 'Only the misses go through.',
    explain: `${pct(1 - hit)} of ${big(rps)} = ${big(load)} per second. Every extra “nine” in the hit ratio divides the origin’s load by 10.`,
  };
};

const VISIBLE = ['The site’s IP address', 'That you visited SITE (usually)', 'How much data you sent and received', 'When you were connected'];
const HIDDEN = ['The page path PATH', 'The words you typed into a search box', 'Your password on the login form', 'The cookies your browser sent', 'The text of the page you read'];
const PATHS = ['/account/settings', '/search?q=symptoms', '/orders/1234', '/messages/inbox', '/watch/new-episode', '/cart'];
const genWhoSees: Generator = (rng) => {
  const [sub, dom] = pick(rng, SITES), site = `${sub}.${dom}`, path = pick(rng, PATHS);
  const fill = (s: string) => s.replace('SITE', site).replace('PATH', path);
  const items = [...shuffle(rng, VISIBLE).slice(0, 3).map((t) => ({ text: fill(t), bin: 0 })), ...shuffle(rng, HIDDEN).slice(0, 3).map((t) => ({ text: fill(t), bin: 1 }))];
  return {
    kind: 'sort',
    body: `On café Wi-Fi you open **https://${site}${path}**. Sort: what can the café’s network operator see?`,
    bins: ['Can see', 'Hidden by HTTPS'],
    items: shuffle(rng, items),
    hint: 'HTTPS encrypts everything inside the connection, but not who is connecting to whom, when, or how much.',
    explain: `The operator sees the addresses, timing and volume, and usually the name ${site} (from the DNS lookup and the TLS greeting, unless encrypted DNS and Encrypted Client Hello are used). The path, content, cookies and form data are encrypted.`,
  };
};

// ================================================================ course

export const internet: Course = {
  id: 'internet',
  title: 'How the Internet Works',
  blurb: 'Packets, addresses, round trips and caches: why pages load the speed they do, and who can see what.',
  color: COLOR,
  icon: '🌐',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'packets',
      title: 'Packets, not circuits',
      goal: 'See why the internet chops data into packets and shares links between everyone.',
      steps: [
        {
          kind: 'choice',
          body: 'An old phone call reserved a whole line from end to end for as long as you talked. Reading a web page, though, you download for a moment and then read for a minute. If the line were reserved for you anyway, what happens while you read?',
          options: [
            { text: 'The reserved capacity sits idle, and nobody else can use it', correct: true },
            { text: 'The line lends itself to other users automatically', why: 'That is exactly what a reserved circuit does *not* do. Lending idle capacity to whoever needs it is the packet idea.' },
            { text: 'Nothing is wasted, since you are still connected', why: 'Being connected and sending are different: an idle reserved line carries nothing.' },
          ],
          explain: 'Computer traffic is bursty: short bursts, long silences. Reserving capacity for bursty traffic wastes most of it.',
        },
        {
          kind: 'read',
          title: 'Reserve or share?',
          body: `A link sends one packet per time slot. A has ${SENDERS[0].packets} packets to send, B has ${SENDERS[1].packets}, and C (on the line, but silent) has none.\n\n**Circuit:** every third slot belongs to each user, used or not. **Packets:** each slot goes to the next user who actually has something to send. Step through both.`,
          widget: linkShareStepper(SENDERS),
        },
        {
          kind: 'number', unit: 'slots',
          body: 'With reserved circuits, after how many slots has **A** sent its last packet?',
          answer: CIRC.finish.A, tol: 0,
          hint: 'A only gets slots 1, 4, 7, …',
          explain: `A owns one slot in three: its ${SENDERS[0].packets}th packet goes out in slot ${CIRC.finish.A}. Meanwhile C’s slots carried nothing.`,
        },
        {
          kind: 'number', unit: 'slots',
          body: 'With packet sharing, after how many slots is A done?',
          answer: PACK.finish.A, tol: 0,
          hint: 'Nobody waits for C, and once B is done, A gets every slot.',
          explain: `A and B alternate until B is finished, then A takes every slot: done after ${PACK.finish.A}. All ${SENT} packets went out in ${PACK.slots.length} slots instead of ${CIRC.slots.length}.`,
        },
        {
          kind: 'number', prob: true,
          body: 'In the circuit version, what share of the slots actually carried a packet?',
          answer: SENT / CIRC.slots.length, tol: 0.01,
          explain: `${SENT} packets in ${CIRC.slots.length} slots: ${pct(SENT / CIRC.slots.length)}. Packet sharing kept the link 100% busy. That efficiency is why the internet is built on packets.`,
        },
        {
          kind: 'read',
          title: 'Chopping data up',
          body: `Every message (a photo, a web page, a video call) is cut into **packets** of at most about ${big(MTU)} bytes. Each packet carries a **header**: where it’s from, where it’s going, and its sequence number, so the receiver can put the pieces back together.\n\nTypical headers (IPv4 plus TCP) take ${HDR} bytes, leaving ${big(MSS)} bytes of your data per full packet.`,
        },
        {
          kind: 'number', unit: 'packets',
          body: `A ${big(PHOTO)}-byte photo is sent in packets carrying ${big(MSS)} bytes of data each. How many packets?`,
          answer: PHOTO_PKTS, tol: 0,
          hint: 'Divide and round up.',
          explain: `${big(PHOTO)} ÷ ${big(MSS)} = ${fx(PHOTO / MSS, 4)}, so ${PHOTO_PKTS} packets, the last one partly full.`,
        },
        {
          kind: 'number', prob: true,
          body: `In a full ${big(MTU)}-byte packet, ${HDR} bytes are headers. What share of the bytes on the wire is header rather than your data?`,
          answer: HDR / MTU, tol: 0.002,
          explain: `${HDR} ÷ ${big(MTU)} = ${pct(HDR / MTU, 2)}. A small price for letting any router handle any packet on its own.`,
        },
        {
          kind: 'choice',
          body: 'Packets 1 to 6 of one message leave in order. Routers handle each packet separately, and may send them along different paths. Can packet 4 arrive before packet 2?',
          options: [
            { text: 'Yes: a faster path can overtake a slower one', correct: true },
            { text: 'No: packets always arrive in the order they were sent', why: 'Nothing in the network enforces order. Each packet is forwarded on its own.' },
            { text: 'No: all packets of a message must take the same path', why: 'Usually they do, but routes change and links get busy; nothing guarantees it.' },
          ],
          explain: 'Each packet is delivered independently. Order is restored at the receiver, using the sequence numbers.',
        },
        {
          kind: 'read',
          title: 'Packets racing',
          body: 'Packets leave S one per tick. Some go along the top, some along the bottom, where the R3–R4 link is slow (4 ticks). Watch them arrive at D.',
          widget: raceStepper(RACE_NODES, RACE_EDGES, RACE_ROUTES, 'D'),
        },
        {
          kind: 'order',
          body: 'In what order did the packets reach D? Step through the race again if you need to.',
          widget: raceStepper(RACE_NODES, RACE_EDGES, RACE_ROUTES, 'D'),
          items: RACE.order.map((k) => `packet ${k}`),
          hint: 'Packet k leaves at tick k − 1. Top takes 3 ticks, bottom 6. Packets 2 and 5 went along the bottom.',
          explain: `Arrival ticks: ${RACE.arrive.map((a, k) => `${k + 1} at ${a}`).join(', ')}. So ${RACE.order.join(', ')}.`,
        },
        {
          kind: 'number', unit: 'packets',
          body: `At tick ${RACE_T1}, D holds packets ${arrivedBy(RACE_T1).join(', ')}. How many can it pass to the application **in order**? And note what happens at tick ${RACE_T2}.`,
          answer: DELIV_T1, tol: 0,
          hint: 'Start from packet 1 and stop at the first gap.',
          explain: `Only packet${DELIV_T1 === 1 ? '' : 's'} 1${DELIV_T1 > 1 ? `–${DELIV_T1}` : ''}: packet 2 is missing, so the others wait in a buffer. When packet 2 lands at tick ${RACE_T2}, ${DELIV_T2} packets are released at once.`,
        },
        {
          kind: 'match',
          body: 'Match each term to what it is.',
          heads: ['Term', 'Meaning'],
          pairs: [
            ['Header', 'Addresses and sequence number on each packet'],
            ['Payload', 'The chunk of your data inside a packet'],
            ['Router', 'Passes packets one hop closer to their destination'],
            ['Reassembly', 'Putting chunks back in order at the receiver'],
          ],
          explain: 'A packet is a header plus a payload. Routers read the header; the receiver reassembles the payloads.',
        },
      ],
      practice: [genPackets, genShare, genInOrder],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'routing',
      title: 'Addresses and routing',
      goal: 'Read IP addresses and prefixes, and follow a packet router by router.',
      steps: [
        {
          kind: 'choice',
          body: 'A router in Frankfurt receives a packet for a server in Sydney. How does it know where to send it?',
          options: [
            { text: 'Its table says which neighbour to hand blocks of addresses to', correct: true, why: 'Right: it only needs the next hop, and it stores that per block of addresses, not per device.' },
            { text: 'It knows where every device on the internet is', why: 'There are billions of devices. Routers group addresses into blocks; the biggest tables hold around a million blocks, not billions of devices.' },
            { text: 'The packet carries the full route, worked out by the sender', why: 'The sender has no idea of the route. Each router decides only the next step.' },
            { text: 'It asks DNS for directions', why: 'DNS turns names into addresses. Routers work only with addresses, and never ask DNS.' },
          ],
          explain: 'Routing is hop by hop: every router only knows, for each block of addresses, which neighbour is one step closer.',
        },
        {
          kind: 'read',
          title: 'IP addresses',
          body: `An **IPv4** address is 32 bits, written as four numbers from 0 to 255, like **${DST1}**. Each number is one byte (8 bits).\n\n**IPv6** addresses are 128 bits, written in hexadecimal, like 2001:db8::7. Both are in use today; IPv6 carries a large and growing share of traffic.`,
          widget: () => ipBits(DST1, 24),
        },
        {
          kind: 'estimate',
          body: 'There are 2^32 possible IPv4 addresses. Roughly how many billion is that?',
          min: 0, max: 10, step: 0.1, answer: +(ALL_V4 / 1e9).toFixed(1), tol: 0.3, format: (v) => `${v.toFixed(1)} billion`,
          hint: '2^10 ≈ 1,000, so 2^30 ≈ 1 billion.',
          explain: `2^32 = ${big(ALL_V4)}, about ${fx(ALL_V4 / 1e9, 2)} billion. Fewer than one per person on Earth, and far fewer than the number of connected devices.`,
        },
        {
          kind: 'choice',
          body: 'There are more phones, laptops and gadgets online than IPv4 addresses. How does that work today?',
          options: [
            { text: 'Home and mobile networks share one public address among many devices (NAT)', correct: true },
            { text: 'Everything has moved to IPv6', why: 'IPv6 is widely deployed but not universal; much of the internet still runs IPv4 alongside it.' },
            { text: 'Addresses are handed out by time zone and reused at night', why: 'There’s no such scheme. Addresses are reused, but by sharing (NAT) and reassignment, not by time zone.' },
            { text: 'Most devices don’t need an address', why: 'Every device that sends packets needs an address; the trick is that private ones (like 192.168.1.20) are translated at the router.' },
          ],
          explain: 'Your router gives devices private addresses (192.168.x.x, 10.x.x.x) and translates them to its one public address on the way out. IPv6 removes the need, with 2^128 addresses.',
        },
        {
          kind: 'read',
          title: 'Prefixes: postcodes for addresses',
          body: `**203.0.113.0/24** means “every address whose first 24 bits match 203.0.113”: that is 203.0.113.0 to 203.0.113.255, ${blockSize(24)} addresses. The number after the slash is how many bits are fixed. A smaller number fixes fewer bits and so means a **bigger** block.\n\nRouters store routes for prefixes, the way post is sorted by postcode before street.`,
        },
        {
          kind: 'number', unit: 'addresses',
          body: 'How many addresses are in a **/22**?',
          answer: blockSize(22), tol: 0,
          hint: '32 − 22 bits are free.',
          explain: `10 free bits: 2^10 = ${big(blockSize(22))} addresses (four /24s).`,
        },
        {
          kind: 'choice',
          body: `Is **${NEAR}** inside **203.0.113.0/24**?`,
          options: [
            { text: 'No', correct: !NEAR_IN, why: NEAR_IN ? 'Check the first three numbers again.' : undefined },
            { text: 'Yes', correct: NEAR_IN, why: NEAR_IN ? undefined : 'Close in value, but /24 needs the first three numbers to match exactly, and 114 ≠ 113.' },
          ],
          explain: 'The third number differs (114 vs 113), so it’s in the neighbouring block 203.0.114.0/24.',
        },
        {
          kind: 'sort',
          body: `**${HALF}** fixes 25 bits: one bit more than the /24, which splits it in half. Which addresses are inside?`,
          bins: [`Inside ${HALF}`, 'Outside'],
          items: HALF_ITEMS.map((ip) => ({ text: ip, bin: inPrefix(ip, HALF) ? 0 : 1 })),
          hint: 'The extra bit is the top bit of the last number: 0–127 or 128–255.',
          explain: `${HALF} is 203.0.113.0 to 203.0.113.${blockSize(25) - 1}. So ${HALF_ITEMS.filter((ip) => inPrefix(ip, HALF)).join(', ')} are in; ${HALF_ITEMS.filter((ip) => !inPrefix(ip, HALF)).join(', ')} are not.`,
        },
        {
          kind: 'choice',
          title: 'Longest match wins',
          body: `Router I has this table:\n\n- ${NET.tables.I.map(([p, n]) => `${p} → ${n}`).join('\n- ')}\n\nA packet for **${DST1}** arrives. Two entries contain it. Where does it go?`,
          options: [
            { text: I_PICK[1], correct: true },
            { text: 'A', why: '0.0.0.0/0 matches every address: it’s the default route, used only when nothing more specific matches.' },
            { text: 'Both, to be safe', why: 'Routers forward each packet once. Copies would double the traffic and arrive twice.' },
            { text: 'Nowhere: the table is ambiguous', why: 'Not ambiguous: the rule is to take the most specific (longest) matching prefix.' },
          ],
          explain: `${I_MATCHES.map(([p]) => p).join(' and ')} both contain it; ${I_PICK[0]} fixes more bits, so it is more specific and wins: send to ${I_PICK[1]}.`,
        },
        {
          kind: 'task',
          body: `You are the network. Deliver a packet for **${DST1}** starting at home router H: at each router, read its table and tap the neighbour it names.`,
          widget: hopTask(NET, 'H', DST1),
          hint: 'At each router, find all prefixes containing the address and take the longest. 0.0.0.0/0 matches everything.',
          explain: `Path: ${PATH1.join(' → ')}. Each router knew only one step, yet together they delivered it.`,
        },
        {
          kind: 'number', unit: 'links',
          body: `Now a packet for **${DST2}**, also starting at H. Following the tables, how many links does it cross before it is delivered?`,
          widget: hopStepper(NET, 'H', DST2),
          answer: PATH2.length - 1, tol: 0,
          hint: 'Step through, or read the tables yourself.',
          explain: `${PATH2.join(' → ')}: ${PATH2.length - 1} links. M’s table says ${DST2} is its own network.`,
        },
      ],
      practice: [genSubnetSize, genInSubnet, genLongestPrefix],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'latency',
      title: 'Latency vs bandwidth',
      goal: 'Estimate transfer times, and tell when a faster connection will and won’t help.',
      steps: [
        {
          kind: 'choice',
          body: 'A page made of 30 small files loads slowly from a server across the ocean. You upgrade from 50 to 500 Mbps. What happens?',
          options: [
            { text: 'It barely gets faster', correct: true, why: 'Right: small files are dominated by waiting for round trips, which bandwidth doesn’t touch.' },
            { text: 'It loads about 10 times faster', why: 'Only the sending time shrinks 10×. For small files, most of the time is distance (round trips), which stays the same.' },
            { text: 'It gets slower', why: 'More bandwidth never hurts by itself; it just may not help.' },
          ],
          explain: 'Two different numbers describe a connection. Upgrading the wrong one changes little.',
        },
        {
          kind: 'read',
          title: 'Length and width of the pipe',
          body: '**Latency** is how long one bit takes to get there: the length of the pipe, in milliseconds. **Bandwidth** is how many bits per second fit through: its width.\n\nA message of a given size takes about\n\n**time = latency + size ÷ bandwidth**\n\nMore bandwidth shrinks only the second part.',
        },
        {
          kind: 'number', unit: 'ms',
          body: `Light in fibre covers about 200,000 km/s, that is 200 km per millisecond. London to New York is about ${big(LON_NY)} km. What’s the fastest possible one-way time?`,
          answer: LN_ONE, tol: 0.3,
          hint: 'Distance ÷ 200 km per ms.',
          explain: `${big(LON_NY)} ÷ 200 = ${fx(LN_ONE, 4)} ms. Real cables are longer than the straight line and routers add a little, so measured times are higher. No upgrade can beat this.`,
        },
        {
          kind: 'number', unit: 'ms',
          body: `Sydney to London is about ${big(SYD_LON)} km. Even along a perfectly straight fibre, what is the shortest possible **round trip**?`,
          answer: SL_RTT, tol: 1,
          hint: 'There and back: twice the distance.',
          explain: `2 × ${big(SYD_LON)} ÷ 200 = ${fx(SL_RTT)} ms. Every request and reply from Sydney to London costs at least that, which is why big sites put servers on every continent.`,
        },
        {
          kind: 'read',
          title: 'Play with the two numbers',
          body: 'The line shows time against file size. Latency sets where it starts; bandwidth sets how steep it is.',
          widget: plotExplorer({
            params: [
              { id: 'lat', label: 'latency', min: 0, max: 200, step: 5, value: 50, format: (v) => `${v} ms` },
              { id: 'bw', label: 'bandwidth', min: 10, max: 1000, step: 10, value: 100, format: (v) => `${v} Mbps` },
            ],
            spec: (v) => {
              const top = transferMs(v.lat, 2e6, v.bw);
              return {
                x: [0, 2000], y: [0, Math.max(100, Math.ceil(top / 100) * 100)], xlabel: 'file size (KB)', ylabel: 'time (ms)', size: [360, 220],
                layers: [{ type: 'fn', f: (kb) => transferMs(v.lat, kb * 1000, v.bw), color: COLOR }, { type: 'hline', y: v.lat, dash: true, label: 'latency' }],
              };
            },
            readout: (v) => { const t = transferMs(v.lat, 100_000, v.bw); return `100 KB: ${fx(t)} ms, ${pct(v.lat / t || 0, 0)} of it latency`; },
          }),
        },
        {
          kind: 'number', unit: 'ms',
          body: `Latency ${LAT} ms, bandwidth ${BW} Mbps. How long until a **1 MB** file (${big(BIG * 8)} bits) has arrived?`,
          answer: T_BIG, tol: 0.5,
          hint: `${BW} Mbps = ${big(BW * 1000)} bits per millisecond.`,
          explain: `Sending: ${big(BIG * 8)} ÷ ${big(BW * 1000)} = ${fx(sendMs(BIG, BW))} ms. Plus ${LAT} ms latency: ${fx(T_BIG)} ms.`,
        },
        {
          kind: 'number', unit: 'ms',
          body: `Same connection, but a **10 KB** file (${big(SMALL * 8)} bits)?`,
          answer: T_SMALL, tol: 0.2,
          explain: `Sending takes ${fx(sendMs(SMALL, BW))} ms, so the total is ${fx(T_SMALL)} ms: ${pct(LAT / T_SMALL)} of it is latency.`,
        },
        {
          kind: 'choice',
          body: 'For that 10 KB file, which upgrade helps more?',
          options: [
            { text: `Halve the latency (to ${LAT / 2} ms)`, correct: true, why: `${fx(T_SMALL_HALFLAT)} ms: nearly twice as fast.` },
            { text: `Double the bandwidth (to ${2 * BW} Mbps)`, why: `Only ${fx(T_SMALL_2BW)} ms: you shaved the tiny sending part.` },
            { text: 'They help equally', why: `Compute both: ${fx(T_SMALL_HALFLAT)} ms vs ${fx(T_SMALL_2BW)} ms.` },
          ],
          explain: 'Shrink the part that dominates. For small transfers, that’s latency.',
        },
        {
          kind: 'read',
          title: 'Round trips multiply',
          body: 'A page load is not one message. Before you see anything: look up the name, open a connection, set up encryption, ask for the HTML, then ask for the files it mentions. Each is at least one **round trip**.\n\n**time ≈ round trips × RTT + bytes ÷ bandwidth**\n\nCutting round trips is the main way to make pages fast. The next lessons show where they come from.',
        },
        {
          kind: 'task',
          body: `A ${PAGE_BYTES / 1e6} MB page needs **${PAGE_RTTS} round trips**. Get it under **${PAGE_GOAL} ms**. First try maxing out the bandwidth alone.`,
          widget: explorer({
            params: [
              { id: 'rtt', label: 'round trip', min: 5, max: 150, step: 5, value: 100, format: (v) => `${v} ms` },
              { id: 'bw', label: 'bandwidth', min: 10, max: 1000, step: 10, value: 50, format: (v) => `${v} Mbps` },
            ],
            draw: (v) => barChart([
              { label: 'round trips', value: PAGE_RTTS * v.rtt, color: 'var(--c2)' },
              { label: 'sending', value: sendMs(PAGE_BYTES, v.bw), color: 'var(--c1)' },
            ], { max: PAGE_RTTS * 150 + sendMs(PAGE_BYTES, 10), format: (x) => `${fx(x)} ms` }),
            readout: (v) => `total ${fx(pageMs(v.rtt, v.bw))} ms`,
            goal: (v) => pageMs(v.rtt, v.bw) < PAGE_GOAL,
            goalText: 'Under budget, and it took a shorter round trip to get there.',
          }),
          hint: `Even at 1000 Mbps with a 100 ms round trip it takes ${fx(PAGE_BEST_BW)} ms. Bring the server closer.`,
          explain: `Round trips cost ${PAGE_RTTS} × RTT, untouched by bandwidth. At 100 ms that alone is ${PAGE_RTTS * 100} ms. You need an RTT under ${PAGE_GOAL / PAGE_RTTS} ms (a nearby server) plus enough bandwidth.`,
        },
        {
          kind: 'estimate',
          body: `Two points on opposite sides of Earth are about ${big(HALF_EARTH)} km apart along the surface. What’s the fastest possible round trip through fibre?`,
          min: 0, max: 500, step: 10, answer: HE_RTT, tol: 30, format: (v) => `${v} ms`,
          explain: `2 × ${big(HALF_EARTH)} ÷ 200 = ${fx(HE_RTT)} ms. That’s the floor for any conversation with the far side of the planet.`,
        },
        {
          kind: 'sort',
          body: 'Which are mostly limited by latency, and which by bandwidth?',
          bins: ['Latency-bound', 'Bandwidth-bound'],
          items: [
            { text: 'Loading a small web page', bin: 0 }, { text: 'Each move in an online game', bin: 0 }, { text: 'A quick API call from an app', bin: 0 },
            { text: 'Downloading a 50 GB game', bin: 1 }, { text: 'Backing up a whole photo library', bin: 1 }, { text: 'Streaming 4K video', bin: 1 },
          ],
          hint: 'Small and chatty: latency. Big and steady: bandwidth.',
          explain: 'Small exchanges are all waiting; big transfers are all sending.',
        },
      ],
      practice: [genFibre, genTransfer, genWhichHelps],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'tcp',
      title: 'Reliable delivery',
      goal: 'Explain how TCP turns lossy packets into a reliable stream, and what that costs.',
      steps: [
        {
          kind: 'choice',
          body: 'The network is “best effort”: routers drop packets when they are full, and packets can arrive out of order. How can two computers still exchange a file with nothing missing?',
          options: [
            { text: 'The receiver confirms what it got; the sender resends whatever isn’t confirmed', correct: true },
            { text: 'Send every packet three times', why: 'That triples the traffic and still fails if all three copies are lost. Resending only what’s missing is cheaper and certain.' },
            { text: 'Routers guarantee delivery', why: 'Routers are kept simple and fast: when full, they drop. Reliability is the job of the two ends.' },
            { text: 'Error-correcting codes', why: 'Those repair flipped bits inside a packet that arrived (see Information & Cryptography). A packet that never arrives has nothing to repair.' },
          ],
          explain: 'This is TCP: acknowledgements and retransmission, run by the two endpoints over an unreliable network.',
        },
        {
          kind: 'read',
          title: 'Acknowledge, or resend',
          body: `The simplest version, one segment at a time: send, wait for the ACK, send the next. If no ACK arrives before a timer (here ${SW_TIMEOUT} ms) runs out, send again. Round trip: ${SW_RTT} ms. Segment 2 gets lost.`,
          widget: ladder(['Sender', 'Receiver'], SW.msgs),
        },
        {
          kind: 'number', unit: 'ms',
          body: 'When does the sender get the acknowledgement for segment 2 (“ACK 3”)?',
          answer: SW.ackAt[2], tol: 0.5,
          hint: 'Count: the first try, the timeout, then a full round trip.',
          explain: `Segment 2 first left at ${SW_CLEAN.ackAt[1]} ms and was lost. The timer fired at ${SW_CLEAN.ackAt[1] + SW_TIMEOUT} ms; the retry’s ACK came back at ${SW.ackAt[2]} ms. Without the loss it would have been ${SW_CLEAN.ackAt[2]} ms: one loss cost a whole timeout.`,
        },
        {
          kind: 'read',
          title: 'Cumulative acknowledgements',
          body: 'Real TCP numbers every byte, and the ACK says “I have everything before this number; send this one next.” We’ll number whole segments to keep it simple.\n\nIf a segment is missing, the ACK keeps asking for it, even while later segments arrive. Repeated ACKs for the same number are a hint to the sender that something was lost, often faster than waiting for a timer.',
        },
        {
          kind: 'number',
          body: `The receiver has segments ${GOT.join(', ')}. What number does its ACK carry?`,
          answer: GOT_ACK, tol: 0,
          hint: 'The first missing one.',
          explain: `Everything before ${GOT_ACK} is in; ${GOT_ACK} is missing, so the ACK says ${GOT_ACK}. Segments ${GOT.filter((g) => g > GOT_ACK).join(' and ')} are kept but can’t be acknowledged yet.`,
        },
        {
          kind: 'read',
          title: 'The handshake',
          body: `Before any data, the two sides agree to talk and pick their starting numbers: **SYN**, **SYN-ACK**, **ACK**. That costs one round trip. Round trip here: ${HS_RTT} ms.`,
          widget: ladder(['Client', 'Server'], HS.msgs),
        },
        {
          kind: 'number', unit: 'ms',
          body: 'Round trip 50 ms. On a brand-new TCP connection, how long until the first byte of a small page arrives? (Ignore DNS and encryption.)',
          answer: 2 * 50, tol: 0.5,
          hint: 'One round trip for the handshake, one for the request.',
          explain: `Handshake 1 + request 1 = 2 round trips = ${2 * 50} ms. Half of that is spent just saying hello.`,
        },
        {
          kind: 'choice',
          body: 'Browsers keep connections open and reuse them for many requests instead of opening a new one per file. Why?',
          options: [
            { text: 'Each new connection costs a handshake round trip (and more, with encryption)', correct: true },
            { text: 'Servers can only accept one connection per user', why: 'Servers accept many; browsers routinely open several per site.' },
            { text: 'It saves bandwidth', why: 'A handshake is a few tiny packets; the cost is the waiting, not the bytes.' },
          ],
          explain: 'Reuse skips the setup round trips. A warm, reused connection is one of the cheapest speed-ups on the web.',
        },
        {
          kind: 'read',
          title: 'Don’t wait for each ACK',
          body: 'Stop-and-wait sends one segment per round trip: painfully slow over long distances. Real TCP keeps a **window** of segments in flight and slides it forward as ACKs return.\n\nAt most one window per round trip, so **throughput ≤ window ÷ RTT**.',
        },
        {
          kind: 'number', unit: 'Mbps',
          body: `Old TCP allowed at most ${big(WIN)} bytes in flight. With a ${WIN_RTT} ms round trip, what’s the most it can send per second, in megabits?`,
          answer: WIN_MBPS, tol: 0.05,
          hint: 'Bytes × 8 = bits, per round trip.',
          explain: `${big(WIN * 8)} bits per ${WIN_RTT} ms = ${fx(WIN_MBPS, 3)} Mbps, on a gigabit link or not. That’s why TCP gained a “window scale” option for bigger windows.`,
        },
        {
          kind: 'task',
          body: `A ${LINK} Mbps link with a ${LINK_RTT} ms round trip. Make the window big enough to keep the link **completely busy**.`,
          widget: explorer({
            params: [{ id: 'kb', label: 'window', min: 20, max: 1000, step: 20, value: 60, format: (v) => `${v} KB` }],
            draw: (v) => barChart([{ label: 'throughput', value: Math.min(LINK, mbpsOf(v.kb * 1000, LINK_RTT)), color: COLOR }], { max: LINK, format: (x) => `${fx(x)} Mbps` }),
            readout: (v) => `window ÷ RTT = ${fx(mbpsOf(v.kb * 1000, LINK_RTT))} Mbps · link ${LINK} Mbps`,
            goal: (v) => mbpsOf(v.kb * 1000, LINK_RTT) >= LINK,
            goalText: 'Link full: the window covers a whole round trip of data.',
          }),
          hint: 'The window must hold everything the link sends during one round trip: bandwidth × RTT.',
          explain: `${LINK} Mbps × ${LINK_RTT} ms = ${big(LINK * 1000 * LINK_RTT)} bits = ${fx(BDP_KB)} KB. This “bandwidth-delay product” is how much data is in the pipe at once.`,
        },
        {
          kind: 'order',
          body: 'Put the life of a TCP connection in order.',
          items: ['Client sends SYN', 'Server replies SYN-ACK', 'Client sends ACK (often with its request)', 'Data flows, each side acknowledging', 'One side sends FIN to close'],
          explain: 'Handshake, data with acknowledgements, then a polite close.',
        },
      ],
      practice: [genHandshake, genCumAck, genWindow],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'congestion',
      title: 'Congestion',
      goal: 'See how millions of senders share links with no one in charge.',
      steps: [
        {
          kind: 'choice',
          body: 'A router’s outgoing link carries 100 Mbps, but packets for it arrive at 120 Mbps. What happens?',
          options: [
            { text: 'A queue builds up, delays grow, and when the buffer is full packets are dropped', correct: true },
            { text: 'The link speeds up to 120 Mbps', why: 'A link’s capacity is fixed by its hardware.' },
            { text: 'Packets wait in line as long as needed, never lost', why: 'Buffers are finite. Once full, arriving packets are dropped.' },
            { text: 'The router tells each sender exactly how fast to go', why: 'Routers don’t track senders. At most they mark packets (ECN); senders work out their own rate.' },
          ],
          explain: 'Excess traffic first becomes delay (queueing), then loss.',
        },
        {
          kind: 'read',
          title: 'Loss means slow down',
          body: 'No one coordinates the internet’s traffic. Instead, every TCP sender treats a lost packet (and, in newer schemes, a rising round-trip time) as a sign of congestion and slows down; when things go well, it speeds up.\n\nIt controls its speed with the **congestion window**: how many segments it lets be in flight per round trip.',
        },
        {
          kind: 'read',
          title: 'Slow start, then a sawtooth',
          body: `Modern stacks start with a window of about ${W0} segments and **double** it each round trip until a loss: that’s “slow start” (slow only compared to jumping straight to full speed). After a loss, the window **halves**, then grows by just **1 segment per round trip**. Here the path holds about 60 segments before a router drops one.`,
          widget: () => plotEl({
            x: [0, CW.length - 1], y: [0, Math.max(...CW) + 10], xlabel: 'round trip', ylabel: 'window (segments)', size: [360, 220],
            layers: [{ type: 'line', pts: CW.map((w, k) => [k, w] as [number, number]), color: COLOR }, { type: 'hline', y: 60, dash: true, label: 'path holds' }],
          }),
        },
        {
          kind: 'number', unit: 'RTTs',
          body: `Starting from ${W0} segments and doubling each round trip, after how many round trips is the window at least ${SS_TARGET}?`,
          answer: SS_RTTS, tol: 0,
          hint: '10, 20, 40, …',
          explain: `${cwndTrace({ rounds: SS_RTTS + 1, w0: W0, cap: Infinity }).join(' → ')}: ${SS_RTTS} round trips. Doubling reaches high speed in a few round trips even from a cautious start.`,
        },
        {
          kind: 'number', unit: 'segments',
          body: `How many segments in total are sent in the first ${SS_K} round trips (starting at ${W0}, doubling, no loss)?`,
          answer: SS_SENT, tol: 0,
          explain: `${cwndTrace({ rounds: SS_K, w0: W0, cap: Infinity }).join(' + ')} = ${SS_SENT} segments, about ${big(Math.round(SS_SENT * MSS / 1000))} KB. This is why the first ~${Math.round(W0 * MSS / 1000)} KB of a page arrive in the very first round trip, and why small pages feel fast.`,
        },
        {
          kind: 'number', unit: 'RTTs',
          body: `In the sawtooth phase, the window is ${LOSS_W} when a loss happens. It halves, then grows 1 per round trip. How many round trips until it’s back to ${LOSS_W}?`,
          answer: LOSS_BACK, tol: 0,
          explain: `${LOSS_W} → ${LOSS_W / 2}, then ${LOSS_BACK} steps of +1. This rule is called **AIMD**: additive increase, multiplicative decrease.`,
        },
        {
          kind: 'read',
          title: 'Why AIMD is fair',
          body: `Two flows share a link that holds 60 segments. One starts big (blue, ${TWO.x[0]}), one small (orange, ${TWO.y[0]}). Both add 1 per round trip; when together they overflow, both halve.\n\nAdding the same amount keeps the gap; halving halves it. So the flows drift towards equal shares.`,
          widget: () => plotEl({
            x: [0, TWO.x.length - 1], y: [0, Math.ceil(Math.max(...TWO.x) / 10) * 10 + 5], xlabel: 'round trip', ylabel: 'window', size: [360, 220],
            layers: [{ type: 'line', pts: TWO.x.map((w, k) => [k, w] as [number, number]), color: 'var(--c1)' }, { type: 'line', pts: TWO.y.map((w, k) => [k, w] as [number, number]), color: 'var(--c2)' }],
          }),
        },
        {
          kind: 'number', unit: 'segments',
          body: `The flows start ${GAP0} segments apart. How far apart are they right after the first halving?`,
          answer: GAP1, tol: 0.01,
          hint: 'Adding 1 to both keeps the gap. Halving both halves it.',
          explain: `The gap stays ${GAP0} while both grow, then halves to ${fx(GAP1)} at round trip ${H1}. Every loss halves it again.`,
        },
        {
          kind: 'number', unit: 'Mbps',
          body: `${FAIR_N} downloads share a ${FAIR_C} Mbps bottleneck fairly. A fifth starts. What does each get now?`,
          answer: FAIR_C / (FAIR_N + 1), tol: 0.01,
          explain: `${FAIR_C} ÷ ${FAIR_N + 1} = ${FAIR_C / (FAIR_N + 1)} Mbps each, down from ${FAIR_C / FAIR_N}. Nobody “took” bandwidth on purpose: every sender backed off a little.`,
        },
        {
          kind: 'choice',
          body: 'At 9 pm everything at home slows down at once: video, games, downloads. What’s the likeliest reason?',
          options: [
            { text: 'Many people share the same bottleneck link, so everyone’s share shrinks', correct: true },
            { text: 'Websites slow their servers down in the evening', why: 'Popular sites are built for evening peaks; the shared links near you are the usual bottleneck.' },
            { text: 'Signals travel more slowly at night', why: 'The speed of light in fibre doesn’t change with time of day.' },
            { text: 'DNS caches expire at night', why: 'TTLs are counted in seconds from each lookup, not tied to the clock.' },
          ],
          explain: 'Shared links mean shared slowdowns: when the neighbourhood link is busy, fair sharing splits it more ways and queues add delay.',
        },
        {
          kind: 'multi',
          body: 'Which of these do TCP senders treat as signs of congestion?',
          options: [
            { text: 'A packet that is never acknowledged', correct: true },
            { text: 'Several duplicate ACKs asking for the same segment', correct: true },
            { text: 'Round-trip times rising as queues fill', correct: true, why: 'Delay-based schemes (and BBR, used by many big services) watch this.' },
            { text: 'A 404 Not Found page', why: 'That’s the web application saying a page doesn’t exist; it says nothing about the network.' },
            { text: 'A DNS lookup taking longer than usual', why: 'DNS is a separate exchange; TCP’s congestion control only watches its own packets.' },
          ],
          explain: 'Loss (by timeout or duplicate ACKs) and growing delay are the signals. Some routers also mark packets explicitly (ECN).',
        },
      ],
      practice: [genSlowStart, genFairShare, genAIMD],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'dns',
      title: 'Names to numbers',
      goal: 'Walk a DNS lookup and predict when caching makes it instant.',
      steps: [
        {
          kind: 'choice',
          body: 'You type **example.com**. What must happen before your browser can send a single packet to the website?',
          options: [
            { text: 'Find out the site’s IP address', correct: true },
            { text: 'Nothing: routers understand names', why: 'Routers only read addresses. Names are for people.' },
            { text: 'Ask one central computer that lists every website', why: 'One list would be a single point of failure and overload. DNS is spread across millions of servers.' },
            { text: 'Download the site’s certificate', why: 'That happens later, inside the encrypted connection, which needs an address first.' },
          ],
          explain: 'The Domain Name System (DNS) turns names into addresses. It’s the internet’s phone book, split into pieces.',
        },
        {
          kind: 'read',
          title: 'A lookup, step by step',
          body: `Your device asks a **resolver**. With an empty cache, the resolver walks the hierarchy from the right of the name: a **root** server, then a **.com** server, then the **authoritative** server run for example.com (“Auth”).\n\nRound trips from the resolver: root ${DNS.root} ms, .com ${DNS.tld} ms, Auth ${DNS.auth} ms; you ↔ resolver ${DNS.client} ms.`,
          widget: ladder(PARTIES, COLD.msgs),
        },
        {
          kind: 'number', unit: 'ms',
          body: 'How long did that lookup take, from your question to the answer?',
          answer: COLD.total, tol: 0.5,
          hint: 'Add up the round trips.',
          explain: `${DNS.client} + ${DNS.root} + ${DNS.tld} + ${DNS.auth} = ${COLD.total} ms before the browser can even start connecting.`,
        },
        {
          kind: 'order',
          body: 'Put the steps of an uncached lookup in order.',
          items: ['Your device asks the resolver', 'The resolver asks a root server', 'The root points to the .com servers', 'A .com server points to example.com’s servers', 'example.com’s server gives the address', 'The resolver answers your device'],
          explain: 'Each level only knows who is responsible for the next level down. That’s what lets DNS scale.',
        },
        {
          kind: 'read',
          title: 'Caching and TTL',
          body: `Every answer carries a **TTL** (time to live), in seconds: how long anyone may keep and reuse it. The resolver serves thousands of users, so a popular name is almost always already in its cache. The second lookup:`,
          widget: ladder(PARTIES, WARM.msgs),
        },
        {
          kind: 'number', unit: 'ms',
          body: 'How long did the cached lookup take?',
          answer: WARM.total, tol: 0.5,
          explain: `Just the trip to the resolver: ${WARM.total} ms instead of ${COLD.total}. Your device and browser keep their own small caches too, which can make it 0.`,
        },
        {
          kind: 'number', unit: 'fetches',
          body: `A resolver starts empty. A record has a TTL of ${TTL} s. Queries arrive at seconds ${TTL_Q.join(', ')}. How many times does the resolver fetch it from the authoritative server?`,
          answer: TTL_SIM.upstream, tol: 0,
          hint: 'A fetch is good for TTL seconds from the moment it was made.',
          explain: `Fetches at ${TTL_Q.filter((_, k) => TTL_SIM.miss[k]).join(', ')}; the rest were answered from cache. ${TTL_SIM.upstream} fetches for ${TTL_Q.length} queries.`,
        },
        {
          kind: 'number', unit: 'per hour',
          body: `A name with a ${POP_TTL}-second TTL is asked for constantly by 10,000 users of the same resolver. At most how many times per hour does that resolver ask the authoritative server?`,
          answer: PER_HOUR, tol: 0,
          hint: 'The number of users doesn’t matter.',
          explain: `Once per TTL: 3,600 ÷ ${POP_TTL} = ${PER_HOUR} times an hour, whether 10 or 10,000 people ask. Caching is what lets a few servers answer the whole internet.`,
        },
        {
          kind: 'choice',
          body: `You move your website to a new server and update its DNS record. The old record had a TTL of ${big(DAY_TTL)} seconds. What can happen?`,
          options: [
            { text: `Some users keep going to the old server for up to ${DAY_TTL / 3600} hours`, correct: true },
            { text: 'Everyone switches instantly', why: 'Caches around the world may keep the old answer until its TTL runs out.' },
            { text: 'The site goes down until every cache is cleared by hand', why: 'Caches expire on their own; nobody clears them. Until then they send people to the old address.' },
          ],
          explain: `${big(DAY_TTL)} s is ${DAY_TTL / 3600} hours. The usual trick: lower the TTL a day before a move, then change the record.`,
        },
        {
          kind: 'match',
          body: 'DNS stores more than one kind of record. Match each type to what it holds.',
          heads: ['Record', 'Holds'],
          pairs: [['A', 'An IPv4 address'], ['AAAA', 'An IPv6 address'], ['CNAME', 'Another name this one is an alias for'], ['MX', 'The mail server for the domain'], ['NS', 'Which servers are authoritative for the domain']],
          explain: 'A lookup asks for a name and a record type. Browsers usually ask for both A and AAAA.',
        },
        {
          kind: 'choice',
          body: 'Every uncached lookup starts at the root. Why aren’t the root servers swamped?',
          options: [
            { text: 'Resolvers cache the referrals to .com and other TLDs, and each root is copied at many sites worldwide', correct: true },
            { text: 'Only a few special resolvers are allowed to ask them', why: 'Any resolver may ask; they simply rarely need to.' },
            { text: 'They answer with every address on the internet in one go', why: 'They know only which servers handle each top-level domain, nothing deeper.' },
          ],
          explain: 'The answer “here are the .com servers” has a TTL of days, so resolvers seldom need the root. And the 13 root server identities are served from well over a thousand locations by anycast.',
        },
      ],
      practice: [genDnsTime, genTtl, genDnsWalk],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'http',
      title: 'The web on top',
      goal: 'Read HTTP requests and responses, and count the round trips of a page load.',
      steps: [
        {
          kind: 'choice',
          body: 'Your browser has a connection to the server. What does it actually send to get a page?',
          options: [
            { text: 'A short request naming a method and a path, like “GET /news”, plus headers', correct: true },
            { text: 'A copy of the page it expects, for the server to confirm', why: 'The browser doesn’t have the page yet; it asks for it by path.' },
            { text: 'Its IP address and nothing else', why: 'The address is already in every packet. The request says *what* you want.' },
          ],
          explain: 'HTTP is a request–response protocol: the client asks for a resource, the server answers with a status and the content.',
        },
        {
          kind: 'read',
          title: 'A request and its response',
          body: 'This is HTTP/1.1, which is readable text. (HTTP/2 and HTTP/3 send the same information in a compact binary form.) The response starts with a **status code**.',
          widget: () => h('div', null,
            codeBlock('GET /news HTTP/1.1\nHost: example.com\nAccept: text/html\nCookie: session=8f2c…'),
            codeBlock('HTTP/1.1 200 OK\nContent-Type: text/html\nCache-Control: max-age=60\nContent-Length: 14210\n\n<!doctype html> …')),
        },
        {
          kind: 'match',
          body: 'Match each status code to what it means.',
          heads: ['Status', 'Meaning'],
          pairs: [['200 OK', 'Here is what you asked for'], ['301 Moved Permanently', 'It lives at a new address now; go there'], ['304 Not Modified', 'Unchanged since your copy: use that'], ['404 Not Found', 'No such page here'], ['503 Service Unavailable', 'The server is overloaded or down for now']],
          explain: 'The first digit is the class: 2 success, 3 redirection, 4 client error, 5 server error.',
        },
        {
          kind: 'sort',
          body: 'Whose fault? Sort the codes.',
          bins: ['Fine (2xx/3xx)', 'Client error (4xx)', 'Server error (5xx)'],
          items: [
            { text: '201 Created', bin: 0 }, { text: '302 Found', bin: 0 }, { text: '403 Forbidden', bin: 1 },
            { text: '404 Not Found', bin: 1 }, { text: '429 Too Many Requests', bin: 1 }, { text: '500 Internal Server Error', bin: 2 }, { text: '502 Bad Gateway', bin: 2 },
          ],
          hint: 'Just read the first digit.',
          explain: '2xx and 3xx went as intended. 4xx: the request was wrong (no permission, no such page, too many). 5xx: the server or something behind it failed.',
        },
        {
          kind: 'read',
          title: 'What a page load fetches',
          body: `The HTML is only the start: it names stylesheets, scripts, images and fonts, each a separate request. Here: one round trip to connect, one for the HTML, then ${PL_DEMO.rows.length - 2} files over 6 connections, each taking a round trip of 50 ms.`,
          widget: () => waterfall(PL_DEMO.rows),
        },
        {
          kind: 'number', unit: 'round trips',
          body: 'How many round trips did that page load take in total?',
          widget: () => waterfall(PL_DEMO.rows),
          answer: PL_DEMO.total / 50, tol: 0,
          explain: `1 to connect + 1 for the HTML + ${PL_DEMO.waves} waves of files = ${PL_DEMO.total / 50} round trips, ${PL_DEMO.total} ms. Notice: waves, not file count, set the time.`,
        },
        {
          kind: 'number', unit: 'ms',
          body: 'Same setup (50 ms round trip, 1 to connect, 1 for HTML, 6 at a time) but the page needs **30** files. How long?',
          answer: PL_30.total, tol: 0.5,
          hint: '30 files, 6 at a time: how many waves?',
          explain: `${PL_30.waves} waves. 1 + 1 + ${PL_30.waves} = ${PL_30.total / 50} round trips × 50 ms = ${PL_30.total} ms.`,
        },
        {
          kind: 'number', unit: 'ms',
          body: 'HTTP/2 lets one connection carry all 30 requests at once. Ignoring transfer time, how long now?',
          answer: PL_H2.total, tol: 0.5,
          explain: `All 30 go out in one wave: 1 + 1 + 1 = ${PL_H2.total / 50} round trips = ${PL_H2.total} ms, versus ${PL_30.total}. Fewer round trips, not more bandwidth.`,
        },
        {
          kind: 'read',
          title: 'Not downloading at all',
          body: '`Cache-Control: max-age=60` lets the browser reuse its copy for 60 seconds without asking. After that it can ask “changed since my copy?”; if not, the server replies **304 Not Modified** with no body. One round trip, but no re-download.',
        },
        {
          kind: 'number', unit: 'ms',
          body: `A ${NM_BYTES / 1000} KB script hasn’t changed. On a ${NM_BW} Mbps connection, how much sending time does a 304 save compared with downloading it again?`,
          answer: NM_SAVED, tol: 0.5,
          hint: 'Size ÷ bandwidth; the round trip is paid either way.',
          explain: `${big(NM_BYTES * 8)} bits ÷ ${big(NM_BW * 1000)} bits/ms = ${fx(NM_SAVED)} ms saved. Within max-age, the round trip is skipped too.`,
        },
        {
          kind: 'number', unit: 'ms',
          body: `You type example.com. The server redirects to https://example.com, which redirects to https://www.example.com/. Round trip ${REDIR_RTT} ms. At least how much delay do the ${REDIR} redirects add?`,
          answer: REDIR * REDIR_RTT, tol: 0.5,
          explain: `Each redirect is a request and a response that carry no page: ${REDIR} × ${REDIR_RTT} = ${REDIR * REDIR_RTT} ms, more if the new address needs a new connection. Link to the final address directly.`,
        },
        {
          kind: 'fill',
          body: 'Complete the sentences.',
          template: 'To load a page the browser usually sends [[0]]. To submit a sign-up form it usually sends [[1]]. If the page doesn’t exist, the reply is [[2]].',
          blanks: [{ options: ['GET', 'POST', 'PUT'], answer: 0 }, { options: ['POST', 'GET', 'HEAD'], answer: 0 }, { options: ['404', '304', '503'], answer: 0 }],
          explain: 'GET fetches, POST submits data. 404 means not found; 304 means “use your copy”, 503 means the server is unavailable.',
        },
      ],
      practice: [genStatus, genPageLoad, genNotModified],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'scale',
      title: 'Speed and safety at scale',
      goal: 'Work out what CDNs buy, and who can see what on an HTTPS connection.',
      steps: [
        {
          kind: 'choice',
          body: `A site’s only server is in Virginia. A user in Sydney sees ${EDGE + ORIGIN} ms round trips. What makes the site fastest for them?`,
          options: [
            { text: 'Keep copies of the content on servers near Sydney', correct: true, why: 'Right: distance is the cost, so shorten it. That is a CDN.' },
            { text: 'Buy the Virginia server a faster network connection', why: 'Bandwidth doesn’t shorten the trip across the Pacific; round trips dominate.' },
            { text: 'Buy a faster processor for the server', why: 'The server answers in milliseconds; the round trip takes hundreds.' },
          ],
          explain: 'A content delivery network (CDN) runs servers (“edges”) in many cities, each keeping a cache of popular content.',
        },
        {
          kind: 'read',
          title: 'Hits and misses',
          body: `A request reaches the nearest edge (${EDGE} ms away). If the edge has the file (a **hit**), it answers. If not (a **miss**), it fetches from the origin first, adding ${ORIGIN} ms, and keeps a copy for next time.\n\n**average = edge + miss rate × origin**`,
          widget: () => barChart([
            { label: 'origin only', value: EDGE + ORIGIN, color: 'var(--c2)' },
            { label: 'CDN, 90% hits', value: CDN_90, color: COLOR },
          ], { format: (x) => `${fx(x)} ms` }),
        },
        {
          kind: 'number', unit: 'ms',
          body: `With a 90% hit ratio, edge ${EDGE} ms and origin ${ORIGIN} ms extra, what’s the average time per request?`,
          answer: CDN_90, tol: 0.2,
          explain: `${EDGE} + 0.1 × ${ORIGIN} = ${fx(CDN_90)} ms, instead of ${EDGE + ORIGIN}.`,
        },
        {
          kind: 'task',
          body: `Get the average under **${CDN_GOAL} ms** by raising the hit ratio (longer cache lifetimes, more content cached).`,
          widget: explorer({
            params: [{ id: 'hit', label: 'hit ratio', min: 0, max: 100, step: 1, value: 50, format: (v) => `${v}%` }],
            draw: (v) => barChart([{ label: 'average', value: cdnMs(v.hit / 100, EDGE, ORIGIN), color: COLOR }], { max: EDGE + ORIGIN, format: (x) => `${fx(x)} ms` }),
            readout: (v) => `average ${fx(cdnMs(v.hit / 100, EDGE, ORIGIN))} ms · ${100 - v.hit}% of requests reach the origin`,
            goal: (v) => cdnMs(v.hit / 100, EDGE, ORIGIN) <= CDN_GOAL,
            goalText: 'Fast for users, and the origin is barely working.',
          }),
          hint: `Every missed percent costs ${fx(ORIGIN / 100)} ms on average.`,
          explain: `You need ${EDGE} + miss × ${ORIGIN} ≤ ${CDN_GOAL}, so a miss rate of at most ${fx((CDN_GOAL - EDGE) / ORIGIN * 100)}%: a hit ratio of ${CDN_MIN_HIT}% or more.`,
        },
        {
          kind: 'number', unit: 'requests/s',
          body: `A site gets ${big(ORIGIN_RPS)} requests per second; the CDN hit ratio is ${pct(ORIGIN_HIT)}. How many requests per second reach the origin?`,
          answer: ORIGIN_LOAD, tol: 0.5,
          explain: `${pct(1 - ORIGIN_HIT)} of ${big(ORIGIN_RPS)} = ${big(ORIGIN_LOAD)}. The CDN absorbs ${pct(ORIGIN_HIT)} of the load as well as cutting latency.`,
        },
        {
          kind: 'number', unit: '×',
          body: 'The hit ratio improves from 90% to 99%. By what factor does the origin’s load drop?',
          answer: FACTOR, tol: 0.01,
          hint: 'Compare the miss rates, not the hit rates.',
          explain: `Misses go from 10% to 1%: a factor of ${FACTOR}. The last few percent of hit ratio matter most.`,
        },
        {
          kind: 'read',
          title: 'HTTPS: who can read what',
          body: `**HTTPS** is HTTP inside **TLS**, an encrypted connection. A certificate, signed by an authority your browser trusts, proves the server really is the named site (the public-key ideas from Information & Cryptography). Almost all web traffic today is HTTPS.\n\nOn a fresh connection, TLS 1.3 adds one round trip after TCP’s. Round trip: ${TLS_RTT} ms.`,
          widget: ladder(['Browser', 'Server'], TLS.msgs),
        },
        {
          kind: 'number', unit: 'ms',
          body: `Older TLS 1.2 needed **two** round trips for its handshake instead of one. With a ${TLS_RTT} ms round trip, when does the first byte of the page arrive on a fresh TLS 1.2 connection? (TCP 1 + TLS 2 + request 1, ignore DNS.)`,
          answer: 4 * TLS_RTT, tol: 0.5,
          explain: `4 round trips × ${TLS_RTT} = ${4 * TLS_RTT} ms, against ${TLS.total} ms with TLS 1.3. HTTP/3 (over QUIC) merges the transport and TLS handshakes, saving another round trip.`,
        },
        {
          kind: 'sort',
          body: 'On café Wi-Fi you visit **https://shop.example.com/orders/1234**. What can the café’s network operator see?',
          bins: ['Can see', 'Hidden by HTTPS'],
          items: [
            { text: 'Your device and the site’s IP addresses', bin: 0 }, { text: 'The name shop.example.com (usually)', bin: 0 }, { text: 'When, and how much data, you exchanged', bin: 0 },
            { text: 'The path /orders/1234', bin: 1 }, { text: 'Your password on the login form', bin: 1 }, { text: 'The contents of the page', bin: 1 },
          ],
          hint: 'Encryption hides what is inside the connection, not the fact of the connection.',
          explain: 'Addresses, timing and volume are needed to deliver packets, so they stay visible. The name usually leaks through the DNS lookup and the unencrypted start of the TLS handshake, unless encrypted DNS and Encrypted Client Hello are used. Everything inside is encrypted.',
        },
        {
          kind: 'choice',
          body: 'A page shows the padlock. What does that tell you?',
          options: [
            { text: 'The connection is encrypted, to a server that proved it controls that domain name', correct: true },
            { text: 'The site is safe and honest', why: 'Scam sites get certificates too. The padlock vouches for the connection, not the business.' },
            { text: 'Nobody, including the site, can see your data', why: 'The site decrypts everything you send it: it has to, to use it.' },
            { text: 'Your internet provider can’t tell which site you visited', why: 'It still sees the IP addresses and, usually, the name.' },
          ],
          explain: 'HTTPS protects the data in transit and checks the name. Whether to trust that site is still your call.',
        },
        {
          kind: 'multi',
          body: 'You turn on a VPN at the café. Which become true?',
          options: [
            { text: 'The café can no longer see which sites you connect to', correct: true },
            { text: 'The VPN provider can now see what the café used to see', correct: true },
            { text: 'The websites you visit can no longer see what you do on them', why: 'Your traffic still ends up at the site, which sees everything you send it.' },
            { text: 'HTTPS is no longer needed', why: 'Past the VPN server, traffic crosses the internet as usual. Without HTTPS, the VPN provider and everyone beyond could read it.' },
          ],
          explain: 'A VPN moves the vantage point: you swap trusting the café for trusting the VPN provider.',
        },
        {
          kind: 'order',
          body: 'Opening a new HTTPS site for the first time: put the steps in order.',
          items: ['DNS lookup for the name', 'TCP handshake', 'TLS handshake and certificate check', 'HTTP request for the HTML', 'Requests for the page’s other files'],
          explain: 'Name, connection, encryption, then requests: every step costs round trips, which is why caches, reused connections and nearby servers matter so much.',
        },
      ],
      practice: [genCdnAvg, genOriginLoad, genWhoSees],
    },
  ],
};

