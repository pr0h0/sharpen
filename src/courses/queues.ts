// Queues & Bottlenecks: arrival and service rates, utilization, Little's law, why waits explode near
// full load, variability, bottlenecks in pipelines, batch sizes and work in progress, pooling, and
// priorities. Every number in a question or an answer is computed below from its rule; simulated
// numbers come from the same seeded simulations the widgets draw.
import type { Course, Generator } from '../types';
import { num, pct, pick, randInt, shuffle } from '../ui';
import { dataTable } from '../viz/charts';
import {
  SZ, batchExplorer, batchRun, curveExplorer, erlangC, finishTimes, kingman, littlePic, meanFinish, mm1Lq, mm1W, mmcWq, orderTask,
  pipeline, pipelineStepper, poolExplorer, queueExplorer, runPipeline, shopStepper, simulate, staffTask, variabilityExplorer, wipExplorer,
} from '../widgets/queues';
import type { Job, Station } from '../widgets/queues';

const COLOR = '#2a9d8f'; // teal
const fx = (v: number, d = 1) => num(+v.toFixed(d), 12);
/** Service capacity per hour of c servers taking t minutes each. */
const capH = (c: number, t: number) => (c * 60) / t;
/** Fewest servers that keep ρ below 1. */
const serversNeeded = (perHour: number, t: number) => Math.floor((perHour * t) / 60 + 1e-9) + 1;

// ================================================================ lesson data

// L1: a coffee cart.
const CART = { perHour: 40, t: 2 };
const CART_CAP = capH(1, CART.t);
const CART_RHO = { perHour: 24, t: 2 };
const GROW = { hours: 3 };
const MATCH1 = [[1, 3], [2, 5], [3, 10], [4, 15]].map(([c, t]) => ({ c, t, cap: capH(c, t) }));
const SORT1 = [
  { what: 'Coffee cart', who: 'barista', c: 1, t: 2, each: 'a drink', lam: 25, unit: 'orders' },
  { what: 'Ticket desk', who: 'clerks', c: 2, t: 5, each: 'a ticket', lam: 30, unit: 'people' },
  { what: 'Call centre', who: 'agents', c: 3, t: 5, each: 'a call', lam: 33, unit: 'calls' },
  { what: 'Car wash', who: 'bay', c: 1, t: 6, each: 'a car', lam: 12, unit: 'cars' },
  { what: 'Clinic', who: 'doctors', c: 4, t: 15, each: 'a visit', lam: 16, unit: 'patients' },
  { what: 'Help desk', who: 'techs', c: 2, t: 12, each: 'a ticket', lam: 9, unit: 'tickets' },
].map((x) => ({ ...x, cap: capH(x.c, x.t) }));
const STAFF = { perHour: 100, t: 4 };
const STAFF_N = serversNeeded(STAFF.perHour, STAFF.t);
const STAFF_RHO = (STAFF.perHour * STAFF.t) / 60 / STAFF_N;

// L2: Little's law.
const CAFE = { L: 12, lam: 30 };
const CAFE_W = (CAFE.L / CAFE.lam) * 60;
const WINE = { L: 2000, lam: 400 };
const TICKETS = { L: 60, lam: 15 };
const PASSPORT = { L: 45, lam: 3 };
const PR = { L: 8, W: 2 };
const HOSP = { lam: 40, W: 4.5, W2: 4 };
const CITY = { L: 1_000_000, W: 80 };
const CITY_LAM = CITY.L / CITY.W;

// L3: the 1/(1−ρ) curve.
const API = { S: 10, r1: 0.5, r2: 0.9 };
const L3W = { S: 5, r: 0.8 };
const L3LQ = 0.9;
const L3PT = 5; // time = 5 × service time
const L3PT_RHO = 1 - 1 / L3PT;
const JUMP = { a: [0.5, 0.6], b: [0.8, 0.9] };
const ORDER3 = [
  { name: 'Ticket printer: 2 s per ticket, 95% busy', S: 2, r: 0.95, u: 's' },
  { name: 'Barber: 20 min per cut, 50% busy', S: 20, r: 0.5, u: 'min' },
  { name: 'Bakery counter: 3 min per order, 95% busy', S: 3, r: 0.95, u: 'min' },
  { name: 'Clinic: 10 min per visit, 80% busy', S: 10, r: 0.8, u: 'min' },
].map((x) => ({ ...x, W: x.u === 's' ? (x.S / 60) * mm1W(x.r) : x.S * mm1W(x.r) })).sort((a, b) => a.W - b.W);
const TARGET4 = 4;
const CAP3 = { lam: 54, W: 10 };
const CAP3_MU = CAP3.lam + 60 / CAP3.W;

// L4: variability.
const DENT = { perHour: 4, S: 12 };
const DENT_RHO = (DENT.perHour * DENT.S) / 60;
const DENT_WQ = kingman(DENT.S, DENT_RHO, 1, 1);
const MD1 = { S: 10, r: 0.75 };
const VC = { S: 6, r: 0.9, r2: 0.8 };
const VC_A = kingman(VC.S, VC.r, 1, 0), VC_B = kingman(VC.S, VC.r2, 1, 1);
const VAR_SEED = 10;
const VAR_ROWS: [string, number, number][] = [['clockwork', 0, 0], ['clockwork arrivals, random service', 0, 1], ['random arrivals, clockwork service', 1, 0], ['random', 1, 1]];
const DOC = { slot: 20, S: 18, sd: 9 };
const DOC_WQ = kingman(DOC.S, DOC.S / DOC.slot, 0, DOC.sd / DOC.S);

// L5: bottlenecks.
const KITCHEN: Station[] = [{ name: 'prep', cap: 30 }, { name: 'grill', cap: 20 }, { name: 'plating', cap: 40 }];
const KTHR = Math.min(...KITCHEN.map((s) => s.cap));
const K2 = KITCHEN.map((s) => (s.name === 'grill' ? { ...s, cap: s.cap * 2 } : s));
const K2THR = Math.min(...K2.map((s) => s.cap));
const KARR = 25, KHOURS = 4;
const KPILE = runPipeline(KITCHEN, KARR, KHOURS).piles[KHOURS][1];
const STAFF5 = { st: [{ name: 'prep', per: 15, workers: 2 }, { name: 'grill', per: 10, workers: 2 }, { name: 'plating', per: 20, workers: 2 }], budget: 3, target: 40 };
/** Fewest workers per station to reach the target (each station independently). */
const STAFF5_NEED = STAFF5.st.map((x) => Math.max(x.workers, Math.ceil(STAFF5.target / x.per)));
const DEPLOY = { build: 12, test: 20, testers: 2, ship: 5 };
const DEP_CAPS = { build: capH(1, DEPLOY.build), test: capH(DEPLOY.testers, DEPLOY.test), ship: capH(1, DEPLOY.ship) };
const DEP_THR = Math.min(DEP_CAPS.build, DEP_CAPS.test, DEP_CAPS.ship);
const MATCH5 = [[3, 12], [2, 10], [1, 3], [5, 30]].map(([c, t]) => ({ c, t, cap: capH(c, t) }));

// L6: batches.
const LET = { N: 10, names: ['fold', 'stuff', 'seal'] };
const letFirst = (B: number) => Math.min(...batchRun(3, LET.N, B).finish);
const letAll = (B: number) => Math.max(...batchRun(3, LET.N, B).finish);
const B4 = { st: 4, N: 12, B: 3, t: 2 };
const B4_ALL = Math.max(...batchRun(B4.st, B4.N, B4.B, B4.t).finish);
const B4_BIG = Math.max(...batchRun(B4.st, B4.N, B4.N, B4.t).finish);
const REL = { every: 10 };
const FP = { T0: 4, rb: 2, wip: 20 };
const TEAM = { wip: 30, thr: 5, wip2: 10 };

// L7: pooling.
const POOL = { S: 6, perLine: 8 };
const POOL_RHO = (POOL.perLine * POOL.S) / 60;
const SEP_WQ = POOL.S * mmcWq(1, POOL_RHO);
const ONE_WQ = POOL.S * mmcWq(2, 2 * POOL_RHO);
const SCALE = [1, 2, 4, 8, 16, 32];
const SQRT = { a: 64, beta: 1.5 };
const SLOW = { slower: 0.15 };
const SLOW_S = POOL.S * (1 + SLOW.slower);
const SLOW_WQ = SLOW_S * mmcWq(2, (2 * POOL.perLine * SLOW_S) / 60);
const CALL = { teams: 2, agents: 5, perTeam: 40, S: 6 };
const CALL_A = (CALL.perTeam * CALL.S) / 60;
const CALL_TEAM_S = CALL.S * 60 * mmcWq(CALL.agents, CALL_A);
const CALL_ALL_S = CALL.S * 60 * mmcWq(CALL.agents * CALL.teams, CALL_A * CALL.teams);

// L8: priorities.
const PRINT: Job[] = [{ name: 'report', dur: 30 }, { name: 'boarding pass', dur: 2 }, { name: 'letter', dur: 5 }];
const TASK8: Job[] = [{ name: 'A', dur: 9 }, { name: 'B', dur: 4 }, { name: 'C', dur: 15 }, { name: 'D', dur: 2 }, { name: 'E', dur: 6 }];
const FIFO8: Job[] = [{ name: 'deploy', dur: 12 }, { name: 'hotfix', dur: 3 }, { name: 'review', dur: 8 }, { name: 'email', dur: 5 }];
const sjf = (jobs: Job[]) => [...jobs].sort((a, b) => a.dur - b.dur);
const WSJF = [
  { name: 'Fix checkout bug', cost: 50, dur: 2 },
  { name: 'New onboarding flow', cost: 40, dur: 8 },
  { name: 'Faster search', cost: 30, dur: 3 },
  { name: 'Annual report export', cost: 6, dur: 3 },
].map((x) => ({ ...x, score: x.cost / x.dur })).sort((a, b) => b.score - a.score);
const MT = { n: 3, d: 10 };
const mtSerial = (n: number, d: number) => (d * (n + 1)) / 2;
const mtRobin = (n: number, d: number) => n * (d - 1) + (n + 1) / 2;
const INTR = { task: 60, k: 4, each: 5, refocus: 10 };

// ================================================================ practice generators

// L1
const genUtil: Generator = (rng) => {
  for (;;) {
    const c = randInt(rng, 1, 4), t = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15]), lam = randInt(rng, 2, 40) * (c > 1 ? 2 : 1);
    const rho = (lam * t) / 60 / c;
    if (rho < 0.3 || rho > 0.98) continue;
    return {
      kind: 'number', prob: true,
      body: `${lam} customers an hour arrive at a counter with ${c} server${c > 1 ? 's' : ''}, each taking ${t} minutes per customer. What is the **utilization** ρ (the share of time a server is busy)?`,
      answer: rho, tol: 0.006,
      hint: 'Work arriving per hour ÷ work the servers can do per hour.',
      explain: `Capacity: ${c} × 60/${t} = ${fx(capH(c, t), 2)} customers an hour. ρ = ${lam} ÷ ${fx(capH(c, t), 2)} ≈ ${pct(rho)}.`,
    };
  }
};

const genServers: Generator = (rng) => {
  const lam = randInt(rng, 3, 30) * 5, t = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
  const a = (lam * t) / 60, n = serversNeeded(lam, t);
  return {
    kind: 'number', unit: 'servers',
    body: `${lam} customers an hour, each needing ${t} minutes of a server’s time. What is the **fewest** servers that stops the line growing without limit?`,
    answer: n, tol: 0.01,
    hint: 'How many server-hours of work arrive per hour? You need strictly more than that.',
    explain: `Work arriving: ${lam} × ${t}/60 = ${fx(a, 3)} server-hours per hour. You need more capacity than that${Number.isInteger(a) ? ` (exactly ${a} means ρ = 1, which still grows)` : ''}: ${n} servers.`,
  };
};

const genGrowth: Generator = (rng) => {
  for (;;) {
    const t = pick(rng, [2, 3, 4, 5, 6]), mu = 60 / t, lam = mu + randInt(rng, 1, 12), hrs = randInt(rng, 2, 6);
    if (!Number.isInteger(mu)) continue;
    return {
      kind: 'number', unit: 'people',
      body: `A food truck opens with no line. ${lam} people an hour show up; the cook takes ${t} minutes per order. Roughly how many people are **waiting** after ${hrs} hours?`,
      answer: (lam - mu) * hrs, tol: 0.01,
      hint: 'Arrivals per hour minus orders served per hour.',
      explain: `The cook serves 60/${t} = ${mu} an hour, ${lam - mu} fewer than arrive. The line grows by about ${lam - mu} an hour: ${(lam - mu) * hrs} after ${hrs} hours.`,
    };
  }
};

// L2
const LITTLE_CTX = [
  { thing: 'people in a museum', rate: 'visitors arrive', ru: 'an hour', tu: 'hours', item: 'visitor' },
  { thing: 'open support tickets', rate: 'tickets come in', ru: 'a day', tu: 'days', item: 'ticket' },
  { thing: 'cars in a car park', rate: 'cars drive in', ru: 'an hour', tu: 'hours', item: 'car' },
  { thing: 'orders being packed in a warehouse', rate: 'orders arrive', ru: 'an hour', tu: 'hours', item: 'order' },
  { thing: 'patients in a ward', rate: 'patients are admitted', ru: 'a day', tu: 'days', item: 'patient' },
];
const genLittle: Generator = (rng) => {
  const c = pick(rng, LITTLE_CTX), lam = randInt(rng, 2, 30), W = pick(rng, [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]), L = lam * W;
  const ask = pick(rng, ['L', 'W', 'lam'] as const);
  const given = { L: `On average there are ${fx(L, 2)} ${c.thing}.`, W: `Each ${c.item} stays ${fx(W, 2)} ${c.tu} on average.`, lam: `${lam} ${c.rate} ${c.ru}.` };
  const q = { L: `How many ${c.thing} are there **on average**?`, W: `How long does the average ${c.item} stay (in ${c.tu})?`, lam: `How many ${c.rate.split(' ')[0]} arrive ${c.ru}?` };
  const ans = { L, W, lam }[ask];
  return {
    kind: 'number',
    body: `The system is steady (as many leave as arrive). ${(['L', 'W', 'lam'] as const).filter((k) => k !== ask).map((k) => given[k]).join(' ')} ${q[ask]}`,
    answer: ans, tol: Math.max(0.01, ans * 0.005),
    hint: 'Little’s law: L = λ × W.',
    explain: ask === 'L' ? `L = λW = ${lam} × ${fx(W, 2)} = ${fx(L, 3)}.` : ask === 'W' ? `W = L ÷ λ = ${fx(L, 3)} ÷ ${lam} = ${fx(W, 3)} ${c.tu}.` : `λ = L ÷ W = ${fx(L, 3)} ÷ ${fx(W, 2)} = ${lam} ${c.ru}.`,
  };
};

const genLittleQueue: Generator = (rng) => {
  const lam = randInt(rng, 2, 8), L = lam * randInt(rng, 2, 12), W = L / lam;
  const place = pick(rng, ['passport office', 'theme-park ride', 'post office', 'stadium gate']);
  return {
    kind: 'choice',
    body: `You join the line at a ${place}. You count ${L} people ahead of you, and the line moves at a steady ${lam} people a minute. About how long will you wait?`,
    options: [
      { text: `${fx(W)} minutes`, correct: true },
      { text: `${L * lam} minutes`, why: `That multiplies people by rate. The units say divide: people ÷ (people per minute) = minutes.` },
      { text: `${fx(lam / L, 3)} minutes`, why: 'That’s rate ÷ people, upside down: it gets shorter the longer the line.' },
      { text: 'Can’t tell without the service time', why: 'Little’s law needs only two of count, rate and time. How long each person takes is already inside the rate.' },
    ],
    hint: 'W = L ÷ λ.',
    explain: `W = L ÷ λ = ${L} ÷ ${lam} = ${fx(W)} minutes.`,
  };
};

const genStayCut: Generator = (rng) => {
  const lam = randInt(rng, 10, 80), W1 = randInt(rng, 3, 9), cut = pick(rng, [0.5, 1, 1.5, 2]);
  return {
    kind: 'number', unit: 'beds',
    body: `A hospital admits ${lam} patients a day and the average stay is ${W1} days. If the average stay falls to ${fx(W1 - cut)} days (admissions unchanged), how many beds are freed on an average day?`,
    answer: lam * cut, tol: 0.01,
    hint: 'Beds in use = admissions per day × days per stay.',
    explain: `Beds in use: ${lam} × ${W1} = ${lam * W1} before, ${lam} × ${fx(W1 - cut)} = ${fx(lam * (W1 - cut))} after. Freed: ${fx(lam * cut)}.`,
  };
};

// L3
const genMM1W: Generator = (rng) => {
  const S = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]), r = pick(rng, [0.5, 0.6, 0.75, 0.8, 0.9, 0.95]);
  const ctx = pick(rng, ['a print server', 'a single ATM', 'a one-chair barber', 'a ticket machine']);
  return {
    kind: 'number', unit: 'min',
    body: `Customers arrive at random at ${ctx}. Service takes ${S} minutes on average (and varies at random too). It is busy ${pct(r)} of the time. What is the average **total time** a customer spends there (waiting plus service)?`,
    answer: S * mm1W(r), tol: 0.05,
    hint: 'Time in system = service time ÷ (1 − ρ).',
    explain: `W = S ÷ (1 − ρ) = ${S} ÷ ${fx(1 - r, 2)} = ${fx(S * mm1W(r), 3)} minutes: ${fx(mm1W(r), 3)} times the service time.`,
  };
};

const genMaxRho: Generator = (rng) => {
  const k = pick(rng, [2, 2.5, 3, 4, 5, 8, 10, 20]);
  return {
    kind: 'number', prob: true,
    body: `With random arrivals and service, the average time in the system is service time ÷ (1 − ρ). You want it to stay under **${fx(k)} times** the service time. What is the highest utilization you can run at?`,
    answer: 1 - 1 / k, tol: 0.006,
    hint: 'Solve 1 ÷ (1 − ρ) = k for ρ.',
    explain: `1/(1 − ρ) = ${fx(k)} gives 1 − ρ = ${fx(1 / k, 3)}, so ρ = ${pct(1 - 1 / k)}.`,
  };
};

const genJump: Generator = (rng) => {
  for (;;) {
    const r1 = randInt(rng, 5, 18) / 20, r2 = r1 + pick(rng, [0.05, 0.1]);
    if (r2 > 0.96) continue;
    const f = mm1W(r2) / mm1W(r1);
    return {
      kind: 'number',
      body: `A busy single server goes from ${pct(r1)} to ${pct(r2)} utilization (random arrivals and service). By what **factor** does the average time in the system grow?`,
      answer: f, tol: 0.01,
      hint: 'Compare 1/(1 − ρ) before and after.',
      explain: `1/(1 − ${fx(r1, 2)}) = ${fx(mm1W(r1), 3)} and 1/(1 − ${fx(r2, 2)}) = ${fx(mm1W(r2), 3)}. Ratio: ${fx(f, 3)}. The same step of extra load costs more the fuller you already are.`,
    };
  }
};

// L4
const CV_NAME: Record<number, string> = { 0: 'clockwork (no spread)', 0.5: 'moderately variable (CV 0.5)', 1: 'fully random (CV 1)' };
const genKingman: Generator = (rng) => {
  const S = pick(rng, [4, 5, 6, 8, 10, 12]), r = pick(rng, [0.5, 0.6, 0.75, 0.8, 0.9]), ca = pick(rng, [0, 0.5, 1]), cs = pick(rng, [0.5, 1]);
  const w = kingman(S, r, ca, cs);
  return {
    kind: 'number', unit: 'min',
    body: `Use Kingman’s formula, wait ≈ S × ρ/(1 − ρ) × (ca² + cs²)/2. Service averages ${S} minutes, utilization is ${pct(r)}, arrivals are ${CV_NAME[ca]}, service is ${CV_NAME[cs]}. About how long is the average wait **in line**?`,
    answer: w, tol: Math.max(0.05, w * 0.01),
    hint: 'Three factors: service time, the utilization term, the variability term.',
    explain: `${S} × ${fx(r / (1 - r), 3)} × (${ca * ca} + ${cs * cs})/2 = ${S} × ${fx(r / (1 - r), 3)} × ${fx((ca * ca + cs * cs) / 2, 3)} ≈ ${fx(w, 3)} minutes.`,
  };
};

const genVarFactor: Generator = (rng) => {
  for (;;) {
    const ca = pick(rng, [0.5, 1]), c1 = pick(rng, [0.5, 1, 1.5]), c2 = pick(rng, [0, 0.5, 1]);
    if (c2 >= c1) continue;
    const f = (ca * ca + c2 * c2) / (ca * ca + c1 * c1);
    return {
      kind: 'number', prob: true,
      body: `Arrivals have a CV of ${ca}. A team makes its service times more consistent: CV from ${c1} to ${c2}, same average, same utilization. By Kingman’s formula, the new average wait is what **fraction** of the old one?`,
      answer: f, tol: 0.006,
      hint: 'Only the (ca² + cs²)/2 factor changes.',
      explain: `(${ca}² + ${c2}²) ÷ (${ca}² + ${c1}²) = ${fx(ca * ca + c2 * c2, 3)} ÷ ${fx(ca * ca + c1 * c1, 3)} ≈ ${pct(f)} of the old wait.`,
    };
  }
};

const genVarCompare: Generator = (rng) => {
  for (;;) {
    const S = pick(rng, [5, 6, 8, 10]), r = pick(rng, [0.85, 0.9, 0.95]), r2 = r - pick(rng, [0.05, 0.1, 0.15]);
    const A = kingman(S, r, 1, 0), B = kingman(S, r2, 1, 1);
    if (Math.abs(A - B) / Math.min(A, B) < 0.15) continue;
    const aWins = A < B;
    return {
      kind: 'choice',
      body: `Random arrivals, fully random service (CV 1), ${S}-minute average service, ${pct(r)} utilization. Which change shortens the average wait more (by Kingman’s formula)?`,
      options: [
        { text: 'A: make every service take exactly the average time', correct: aWins, why: aWins ? undefined : `A gives ${fx(A)} min but B gives ${fx(B)} min. At this load, spare capacity beats consistency.` },
        { text: `B: add capacity so utilization drops to ${pct(r2)}`, correct: !aWins, why: aWins ? `B gives ${fx(B)} min but A gives ${fx(A)} min: halving the variability term beats this cut in load.` : undefined },
      ],
      hint: 'Compute S × ρ/(1−ρ) × (ca² + cs²)/2 for each.',
      explain: `Now: ${fx(kingman(S, r, 1, 1))} min. A (cs = 0): ${fx(A)} min. B (ρ = ${fx(r2, 2)}): ${fx(B)} min. Both levers matter; which is bigger depends on how close to full you are.`,
    };
  }
};

// L5
const STAGE_SETS = [
  ['wash', 'chop', 'cook', 'plate'], ['code', 'review', 'test', 'deploy'], ['cut', 'sew', 'press', 'pack'], ['scan', 'check', 'approve', 'file'],
];
const genThroughput: Generator = (rng) => {
  const names = pick(rng, STAGE_SETS).slice(0, randInt(rng, 3, 4));
  const st = names.map((name) => ({ name, cap: randInt(rng, 3, 12) * 5 }));
  const thr = Math.min(...st.map((s) => s.cap));
  return {
    kind: 'number', unit: 'per hour',
    body: `Work flows through ${st.map((s) => `${s.name} (${s.cap}/h)`).join(' → ')}, with plenty of work waiting at the start. How many jobs an hour come out of the end?`,
    widget: pipeline(st),
    answer: thr, tol: 0.01,
    hint: 'A chain is as fast as its slowest link.',
    explain: `Throughput is the slowest station’s rate: ${thr}/h. Faster stations just wait for work.`,
  };
};

const genWhereAdd: Generator = (rng) => {
  for (;;) {
    const names = pick(rng, STAGE_SETS);
    const caps = names.map(() => randInt(rng, 3, 12) * 5);
    const lo = Math.min(...caps);
    if (caps.filter((c) => c === lo).length > 1) continue;
    const b = caps.indexOf(lo);
    const st = names.map((name, i) => ({ name, cap: caps[i] }));
    const second = Math.min(...caps.filter((_, i) => i !== b));
    return {
      kind: 'choice',
      body: `${st.map((s) => `${s.name} ${s.cap}/h`).join(', ')}. You can speed up **one** station. Which one raises output?`,
      widget: pipeline(st),
      options: st.map((s, i) => i === b
        ? { text: s.name, correct: true }
        : { text: s.name, why: `${s.name} already has spare capacity (${s.cap}/h against ${lo}/h). Speeding it up leaves the output at ${lo}/h.` }),
      hint: 'Find the slowest station.',
      explain: `${names[b]} is the bottleneck at ${lo}/h. Speeding it up raises output, but only to ${second}/h, where the next-slowest station takes over.`,
    };
  }
};

const genUpgrade: Generator = (rng) => {
  for (;;) {
    const names = pick(rng, STAGE_SETS).slice(0, 3);
    const caps = names.map(() => randInt(rng, 3, 12) * 5);
    const lo = Math.min(...caps), b = caps.indexOf(lo), k = pick(rng, [1.5, 2, 3]);
    if (caps.filter((c) => c === lo).length > 1 || !Number.isInteger(lo * k)) continue;
    const after = caps.map((c, i) => (i === b ? c * k : c)), thr = Math.min(...after);
    return {
      kind: 'number', unit: 'per hour',
      body: `A line runs ${names.map((n, i) => `${n} ${caps[i]}/h`).join(' → ')}. The ${names[b]} station is made ${fx(k)}× faster. What is the line’s output now?`,
      answer: thr, tol: 0.01,
      hint: 'Recompute every station’s rate, then take the slowest.',
      explain: `${names[b]} goes to ${lo * k}/h. The slowest is now ${names[after.indexOf(thr)]} at ${thr}/h${thr < lo * k ? ': the bottleneck moved' : ''}.`,
    };
  }
};

// L6
const genBatchFirst: Generator = (rng) => {
  for (;;) {
    const st = randInt(rng, 2, 4), N = pick(rng, [6, 8, 10, 12]), B = pick(rng, [2, 3, 4, 6, N]), t = randInt(rng, 1, 3);
    if (N % B) continue;
    const first = Math.min(...batchRun(st, N, B, t).finish);
    return {
      kind: 'number', unit: 'min',
      body: `${N} items go through ${st} stations, ${t} min per item at each. Items move on in batches of ${B}: a station starts a batch only when the whole batch has arrived. When is the **first** item finished?`,
      answer: first, tol: 0.01,
      hint: 'The first batch has to be fully done at every station but the last.',
      explain: `The first batch takes ${B} × ${t} = ${B * t} min at ${st > 2 ? `each of the first ${st - 1} stations` : 'the first station'} (${(st - 1) * B * t} min), then the first item takes ${t} min at the last: ${first} min.`,
    };
  }
};

const genBatchTotal: Generator = (rng) => {
  for (;;) {
    const st = randInt(rng, 2, 4), N = pick(rng, [6, 8, 10, 12]), B = pick(rng, [1, 2, 3, 4, 6, N]), t = randInt(rng, 1, 3);
    if (N % B) continue;
    const all = Math.max(...batchRun(st, N, B, t).finish);
    return {
      kind: 'number', unit: 'min',
      body: `${N} items, ${st} stations, ${t} min per item at each, moved on in batches of ${B}. When are **all** items finished?`,
      answer: all, tol: 0.01,
      hint: 'The batches march through like a pipeline: (stations + batches − 1) batch-steps.',
      explain: `Each batch takes ${B * t} min per station. With ${N / B} batch${N / B > 1 ? 'es' : ''} and ${st} stations: (${st} + ${N / B} − 1) × ${B * t} = ${all} min.`,
    };
  }
};

const genWip: Generator = (rng) => {
  const thr = randInt(rng, 2, 12), wip = thr * randInt(rng, 2, 10), unit = pick(rng, ['day', 'week']);
  const thing = pick(rng, ['features', 'insurance claims', 'repair jobs', 'design requests']);
  return {
    kind: 'number', unit: `${unit}s`,
    body: `A team finishes ${thr} ${thing} a ${unit} and has ${wip} in progress at any time. How long does a new one take from start to finish, on average?`,
    answer: wip / thr, tol: 0.01,
    hint: 'Lead time = work in progress ÷ throughput.',
    explain: `Little’s law: ${wip} ÷ ${thr} = ${fx(wip / thr, 3)} ${unit}s. Starting fewer at once (same throughput) shortens it.`,
  };
};

// L7
const genSeparate: Generator = (rng) => {
  const S = pick(rng, [3, 4, 5, 6, 8, 10]), r = pick(rng, [0.5, 0.6, 0.7, 0.75, 0.8, 0.9]);
  const lam = (r * 60) / S;
  return {
    kind: 'number', unit: 'min',
    body: `A teller has her own line. ${fx(lam, 3)} customers an hour join it at random; service averages ${S} minutes and varies at random. What is the average wait **in line** (before service)?`,
    answer: S * mm1W(r) - S, tol: 0.05,
    hint: 'ρ = λS; wait in line = S × ρ/(1 − ρ).',
    explain: `ρ = ${fx(lam, 3)} × ${S}/60 = ${fx(r, 2)}. Wait = ${S} × ${fx(r, 2)}/${fx(1 - r, 2)} = ${fx(S * r / (1 - r), 3)} minutes.`,
  };
};

const genSqrt: Generator = (rng) => {
  const a = pick(rng, [4, 9, 16, 25, 36, 49, 64, 81, 100, 144, 400]), beta = pick(rng, [0.5, 1, 1.5, 2]);
  const n = Math.ceil(a + beta * Math.sqrt(a) - 1e-9);
  return {
    kind: 'number', unit: 'agents',
    body: `Square-root staffing: agents ≈ a + β√a, where a is the offered load (calls per hour × hours per call). A call centre has a load of ${a} and uses β = ${beta}. How many agents (round up)?`,
    answer: n, tol: 0.01,
    hint: 'a + β × √a.',
    explain: `${a} + ${beta} × √${a} = ${a} + ${fx(beta * Math.sqrt(a), 3)} = ${n}. The safety margin is ${fx((n - a) / a * 100, 2)}% of the load${a >= 100 ? ': big pools need proportionally little slack' : ''}.`,
  };
};

const genPoolChoice: Generator = (rng) => {
  const c = randInt(rng, 2, 4), S = pick(rng, [4, 5, 6, 8]), r = pick(rng, [0.6, 0.7, 0.8, 0.9]);
  const sep = S * mmcWq(1, r), one = S * mmcWq(c, c * r);
  return {
    kind: 'choice',
    body: `${c} identical servers, each ${pct(r)} busy, service ${S} min on average (random arrivals and service). Now: each server has its own line, and customers can’t switch. About how long is the average wait in line if they all share **one** line instead?`,
    options: shuffle(rng, [
      { text: `About ${fx(one)} min`, correct: true },
      { text: `About ${fx(sep)} min, the same`, why: 'Same servers and customers, but a shared line never leaves a server idle while someone waits elsewhere.' },
      { text: `About ${fx(sep * 2)} min`, why: 'A longer shared line moves proportionally faster: every server feeds from it.' },
    ]),
    hint: `Separate lines: ${fx(sep)} min each (S × ρ/(1−ρ)).`,
    explain: `Separate: ${S} × ${fx(r, 2)}/${fx(1 - r, 2)} = ${fx(sep)} min. One shared line (Erlang C with ${c} servers): ${fx(one)} min.`,
  };
};

// L8
const JOBNAMES = ['A', 'B', 'C', 'D', 'E'];
const genSJF: Generator = (rng) => {
  const n = randInt(rng, 3, 5);
  const jobs = JOBNAMES.slice(0, n).map((name) => ({ name, dur: randInt(rng, 1, 20) }));
  const m = meanFinish(sjf(jobs));
  return {
    kind: 'number', unit: 'min',
    body: `One machine, ${n} jobs waiting, all ready now: ${jobs.map((j) => `${j.name} ${j.dur} min`).join(', ')}. Run them in the order that makes the **average finish time** as small as possible. What is that average?`,
    answer: m, tol: 0.01,
    hint: 'Shortest first, then average the finish times.',
    explain: `Shortest first: ${sjf(jobs).map((j) => j.name).join(', ')}. Finish times ${finishTimes(sjf(jobs)).join(', ')}, average ${fx(m, 3)} min.`,
  };
};

const genFifoGap: Generator = (rng) => {
  const n = randInt(rng, 3, 5);
  const jobs = JOBNAMES.slice(0, n).map((name) => ({ name, dur: randInt(rng, 1, 20) }));
  const a = meanFinish(jobs), b = meanFinish(sjf(jobs));
  if (a - b < 0.5) return genFifoGap(rng);
  return {
    kind: 'number', unit: 'min',
    body: `Jobs arrive at a print queue in this order, all at once: ${jobs.map((j) => `${j.name} ${j.dur} min`).join(', ')}. How many minutes does shortest-first save on the **average** finish time, compared with first-come-first-served?`,
    answer: a - b, tol: 0.01,
    hint: 'Average finish time for each order, then subtract.',
    explain: `In arrival order the finish times are ${finishTimes(jobs).join(', ')} (average ${fx(a, 3)}). Shortest first: ${finishTimes(sjf(jobs)).join(', ')} (average ${fx(b, 3)}). Saving: ${fx(a - b, 3)} min.`,
  };
};

const genMultitask: Generator = (rng) => {
  const n = randInt(rng, 2, 5), d = randInt(rng, 3, 12);
  const s = mtSerial(n, d), r = mtRobin(n, d);
  return {
    kind: 'number', unit: 'days',
    body: `You have ${n} projects, each needing ${d} days of work. Instead of finishing them one at a time, you rotate: a day on each in turn. On average, how many days later does a project finish than if you did them one after another?`,
    answer: r - s, tol: 0.01,
    hint: 'One at a time: finishes at d, 2d, …. Rotating: every project is nearly done only at the end.',
    explain: `One at a time: finishes at ${Array.from({ length: n }, (_, k) => (k + 1) * d).join(', ')} (average ${fx(s, 3)}). Rotating: finishes at ${Array.from({ length: n }, (_, k) => n * (d - 1) + k + 1).join(', ')} (average ${fx(r, 3)}). Later by ${fx(r - s, 3)} days, before counting any switching cost.`,
  };
};

// ================================================================ course

export const queues: Course = {
  id: 'queues',
  title: 'Queues & Bottlenecks',
  blurb: 'Why lines form, why waits explode near full load, and where to add capacity: utilization, Little’s law, variability, bottlenecks, batches, pooling and priorities.',
  color: COLOR,
  icon: '⏳',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'arrivals',
      title: 'Arrivals and service',
      goal: 'Compute utilization ρ = λ/μ and tell whether a line settles or grows forever.',
      steps: [
        {
          kind: 'choice',
          body: `A coffee cart opens at 7:00. About ${CART.perHour} customers an hour arrive, and the barista takes ${CART.t} minutes per drink. What happens to the line over the morning?`,
          widget: shopStepper({ perHour: CART.perHour, serviceMin: CART.t, minutes: 60, seed: 4, label: 'barista' }),
          options: [
            { text: `It keeps growing, by about ${CART.perHour - CART_CAP} people an hour`, correct: true },
            { text: 'It settles at a few people', why: `Lines settle only if the server can keep up on average. ${CART.t} min per drink is ${CART_CAP} drinks an hour, fewer than the ${CART.perHour} who arrive.` },
            { text: 'It comes and goes: quiet spells let the barista catch up', why: 'Quiet spells happen, but on average more arrive than can be served, so every quiet spell is outweighed by busy ones.' },
          ],
          hint: 'How many drinks an hour can the barista make?',
          explain: `Capacity is 60 ÷ ${CART.t} = ${CART_CAP} drinks an hour. Demand is ${CART.perHour}. The line grows by about ${CART.perHour - CART_CAP} an hour until people give up or the cart closes. Press play to watch the first hour.`,
        },
        {
          kind: 'read',
          title: 'Two rates',
          body: '**λ** (lambda), the **arrival rate**: customers per hour.\n\n**μ** (mu), the **service rate**: how many one server can finish per hour, which is 60 ÷ (minutes per customer).\n\n**ρ = λ / μ** (rho), the **utilization**: the share of time the server is busy. With c servers, the capacity is cμ and ρ = λ / (cμ).\n\nIf ρ ≥ 1, the line has no long-run level: it grows without limit.',
        },
        {
          kind: 'number', prob: true,
          body: `Later the rush eases: ${CART_RHO.perHour} customers an hour, still ${CART_RHO.t} minutes per drink. What is the barista’s utilization ρ?`,
          answer: (CART_RHO.perHour * CART_RHO.t) / 60, tol: 0.006,
          hint: 'λ ÷ μ, with μ in drinks per hour.',
          explain: `μ = 60 ÷ ${CART_RHO.t} = ${CART_CAP}/h. ρ = ${CART_RHO.perHour} ÷ ${CART_CAP} = ${pct((CART_RHO.perHour * CART_RHO.t) / 60)}: busy ${pct((CART_RHO.perHour * CART_RHO.t) / 60)} of the time, idle the rest.`,
        },
        {
          kind: 'number', unit: 'people',
          body: `Back to the rush: ${CART.perHour} arrive an hour and ${CART_CAP} are served. Starting with no line, roughly how many people are waiting after ${GROW.hours} hours (if nobody gives up)?`,
          answer: (CART.perHour - CART_CAP) * GROW.hours, tol: 0.01,
          hint: 'The line is a stock: arrivals in, services out.',
          explain: `It gains ${CART.perHour} − ${CART_CAP} = ${CART.perHour - CART_CAP} people an hour: about ${(CART.perHour - CART_CAP) * GROW.hours} after ${GROW.hours} hours. When ρ > 1, the line grows by (λ − cμ) per hour.`,
        },
        {
          kind: 'match',
          body: 'Match each counter to its capacity (customers per hour).',
          heads: ['Servers × minutes each', 'Capacity'],
          pairs: MATCH1.map((m) => [`${m.c} server${m.c > 1 ? 's' : ''}, ${m.t} min each`, `${fx(m.cap)} an hour`] as [string, string]),
          hint: 'One server does 60 ÷ minutes per hour; multiply by the number of servers.',
          explain: MATCH1.map((m) => `${m.c} × 60/${m.t} = ${fx(m.cap)}`).join('; ') + '. Slower service can be made up for with more servers.',
        },
        {
          kind: 'read',
          title: 'Play with it',
          body: 'This simulates a single counter over an 8-hour shift, with customers arriving at random and service times that vary at random. Slide the arrivals up towards the service rate, then past it.\n\nBelow ρ = 1 the line bounces around a level. Above it, the line drifts upward and never comes back. Near ρ = 1 it already swings wildly: that’s the next lessons.',
          widget: queueExplorer({ lam: 24, mu: 30, seed: 11 }),
        },
        {
          kind: 'choice',
          body: 'A clinic gets 30 random walk-ins an hour and can see exactly 30 an hour on average (ρ = 1). What happens to the waiting room over a long day?',
          options: [
            { text: 'It drifts ever longer: there is no spare capacity to recover from a bad stretch', correct: true },
            { text: 'It stays empty, because capacity matches demand', why: 'Only if patients arrived on a perfect schedule and every visit took exactly the same time. With randomness, a burst builds a line, and with no spare capacity nothing works it off.' },
            { text: 'It settles at about 30 people', why: 'At ρ = 1 there is no settled level at all: the line wanders like a random walk and tends to grow over time.' },
          ],
          hint: 'After a burst of arrivals, what clears the backlog?',
          explain: 'A queue only shrinks when the server is faster than arrivals. At ρ = 1 that never holds on average, so random bursts pile up and are never worked off. Stable queues need ρ strictly below 1.',
        },
        {
          kind: 'sort',
          body: 'Will each line settle, or grow without limit over a long day? (Arrivals and service are random.)',
          bins: ['Settles', 'Grows without limit'],
          items: SORT1.map((x) => ({ text: `${x.what}: ${x.c} ${x.who}, ${x.t} min ${x.each}, ${x.lam} ${x.unit} an hour`, bin: x.lam < x.cap ? 0 : 1 })),
          hint: 'Capacity = servers × 60 ÷ minutes. Settles only if arrivals are strictly below it.',
          explain: SORT1.map((x) => `${x.what}: capacity ${fx(x.cap)} vs ${x.lam} → ${x.lam < x.cap ? 'settles' : x.lam === x.cap ? 'ρ = 1, grows' : 'grows'}`).join('; ') + '.',
        },
        {
          kind: 'number', unit: 'servers',
          body: `A vaccination centre expects ${STAFF.perHour} people an hour, and each jab takes a nurse ${STAFF.t} minutes. What is the **fewest** nurses that keeps the line from growing without limit?`,
          answer: STAFF_N, tol: 0.01,
          hint: 'Work arriving per hour, in nurse-hours. You need strictly more nurses than that.',
          explain: `Work arriving: ${STAFF.perHour} × ${STAFF.t}/60 = ${fx((STAFF.perHour * STAFF.t) / 60, 3)} nurse-hours each hour. That number (λ/μ) is the **offered load**. You need more nurses than it: ${STAFF_N}.`,
        },
        {
          kind: 'number', prob: true,
          body: `With ${STAFF_N} nurses for ${STAFF.perHour} people an hour at ${STAFF.t} min each, what is the utilization ρ?`,
          answer: STAFF_RHO, tol: 0.006,
          hint: 'ρ = λ / (cμ).',
          explain: `Capacity ${STAFF_N} × ${capH(1, STAFF.t)} = ${capH(STAFF_N, STAFF.t)} an hour. ρ = ${STAFF.perHour}/${capH(STAFF_N, STAFF.t)} ≈ ${pct(STAFF_RHO)}. Stable, but as you’ll see, waits at ${pct(STAFF_RHO, 0)} are long.`,
        },
        {
          kind: 'multi',
          body: 'Which of these lower the utilization ρ? Pick all that apply.',
          options: [
            { text: 'Opening another counter', correct: true, why: 'More servers, more capacity: λ / (cμ) falls.' },
            { text: 'Making each service faster', correct: true, why: 'A higher μ means more capacity per server.' },
            { text: 'Moving some customers to an online form', correct: true, why: 'Fewer arrivals, smaller λ.' },
            { text: 'Adding chairs to the waiting room', why: 'Chairs make waiting comfier but serve nobody faster. Capacity is unchanged.' },
            { text: 'Staying open an hour longer', why: 'That changes the hours, not the rates. Per hour, the same people arrive and the same number are served.' },
          ],
          explain: 'ρ = λ / (cμ): fewer arrivals, faster service or more servers. Waiting space and opening hours don’t touch the rates.',
        },
      ],
      practice: [genUtil, genServers, genGrowth],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'little',
      title: 'Little’s law',
      goal: 'Use L = λW to turn any two of count, rate and time into the third.',
      steps: [
        {
          kind: 'number', unit: 'min',
          body: `A café has, on average, ${CAFE.L} customers inside. About ${CAFE.lam} customers come in per hour, and the café is steady (as many leave as come in). How long does the average customer stay?`,
          answer: CAFE_W, tol: 0.1,
          hint: 'If 30 come in each hour and 12 are inside at any moment, what share of an hour does each one spend?',
          explain: `Average stay = number inside ÷ arrival rate = ${CAFE.L} ÷ ${CAFE.lam} per hour = ${fx(CAFE.L / CAFE.lam, 3)} h = ${fx(CAFE_W)} minutes.`,
        },
        {
          kind: 'read',
          title: 'Little’s law',
          body: '**L = λ × W**\n\n- **L**: average number in the system\n- **λ**: arrival rate (= departure rate, if steady)\n- **W**: average time each one spends inside\n\nWhy it holds: draw each customer’s stay as a bar. The total length of the bars is the area under the “how many are inside” curve, measured two ways. It doesn’t care about the order of service, the distribution of times, or the number of servers.',
          widget: littlePic({ perHour: 30, stayMin: 12, n: 15, seed: 8 }),
        },
        {
          kind: 'number', unit: 'years',
          body: `A wine cellar holds ${WINE.L.toLocaleString('en-US')} bottles. It sells and restocks about ${WINE.lam} bottles a year. How old is the average bottle when it is sold?`,
          answer: WINE.L / WINE.lam, tol: 0.01,
          hint: 'W = L ÷ λ.',
          explain: `W = ${WINE.L.toLocaleString('en-US')} ÷ ${WINE.lam} = ${WINE.L / WINE.lam} years. No need to track a single bottle.`,
        },
        {
          kind: 'number', unit: 'days',
          body: `A support team always has about ${TICKETS.L} open tickets, and closes (and receives) about ${TICKETS.lam} a day. How long does the average ticket stay open?`,
          answer: TICKETS.L / TICKETS.lam, tol: 0.01,
          hint: 'Count ÷ rate = time.',
          explain: `W = ${TICKETS.L} ÷ ${TICKETS.lam} = ${TICKETS.L / TICKETS.lam} days.`,
        },
        {
          kind: 'choice',
          body: `You join the line at a passport office and count ${PASSPORT.L} people ahead of you. Watching for a while, you see about ${PASSPORT.lam} people called each minute. Roughly how long will you wait?`,
          options: [
            { text: `About ${PASSPORT.L / PASSPORT.lam} minutes`, correct: true },
            { text: `About ${PASSPORT.L * PASSPORT.lam} minutes`, why: 'That multiplies people by people per minute. The units only work out as people ÷ (people per minute) = minutes.' },
            { text: 'Can’t say without knowing how long each appointment takes', why: 'How long each takes and how many desks are open are already folded into the 3 per minute you observed.' },
          ],
          hint: 'W = L ÷ λ.',
          explain: `${PASSPORT.L} ÷ ${PASSPORT.lam} = ${PASSPORT.L / PASSPORT.lam} minutes. Little’s law lets you estimate a wait from two things you can see.`,
        },
        {
          kind: 'fill',
          body: 'Complete Little’s law in words.',
          template: 'average number inside = [[0]] × [[1]]',
          blanks: [
            { options: ['arrival rate', 'service time', 'number of servers'], answer: 0 },
            { options: ['average time inside', 'utilization', 'arrival rate'], answer: 0 },
          ],
          explain: 'L = λ × W: arrivals per unit of time, times how long each stays.',
        },
        {
          kind: 'number', unit: 'per day',
          body: `A software team has on average ${PR.L} pull requests waiting for review, and each one waits ${PR.W} days on average. How many pull requests get reviewed per day?`,
          answer: PR.L / PR.W, tol: 0.01,
          hint: 'λ = L ÷ W.',
          explain: `λ = ${PR.L} ÷ ${PR.W} = ${PR.L / PR.W} a day. To cut review time without reviewing faster, you’d have to keep fewer waiting.`,
        },
        {
          kind: 'match',
          body: 'In a hospital, what plays each role in L = λW?',
          heads: ['Symbol', 'Hospital'],
          pairs: [
            ['L', 'Beds occupied on an average day'],
            ['λ', 'Patients admitted per day'],
            ['W', 'Average length of stay'],
          ],
          explain: 'L counts what’s inside (occupied beds), λ is the flow in (admissions), W is the time inside (length of stay).',
        },
        {
          kind: 'number', unit: 'beds',
          body: `A hospital admits ${HOSP.lam} patients a day, and the average stay is ${HOSP.W} days. How many beds are occupied on an average day?`,
          answer: HOSP.lam * HOSP.W, tol: 0.01,
          hint: 'L = λW.',
          explain: `${HOSP.lam} × ${HOSP.W} = ${HOSP.lam * HOSP.W} beds.`,
        },
        {
          kind: 'choice',
          body: `Better discharge planning cuts the average stay from ${HOSP.W} to ${HOSP.W2} days, with admissions unchanged. What happens to occupied beds?`,
          options: [
            { text: `${HOSP.lam * (HOSP.W - HOSP.W2)} fewer beds in use`, correct: true },
            { text: 'No change: the same patients still come in', why: 'Same arrivals, but each one occupies a bed for less time, so fewer beds are full at any moment.' },
            { text: `${fx(((HOSP.W - HOSP.W2) / HOSP.W) * 100)} fewer beds`, why: `That’s the percentage cut in stay, not a number of beds. ${fx(((HOSP.W - HOSP.W2) / HOSP.W) * 100)}% of ${HOSP.lam * HOSP.W} beds is ${HOSP.lam * (HOSP.W - HOSP.W2)}.` },
          ],
          hint: 'Compute L before and after.',
          explain: `${HOSP.lam} × ${HOSP.W} = ${HOSP.lam * HOSP.W} before, ${HOSP.lam} × ${HOSP.W2} = ${HOSP.lam * HOSP.W2} after: ${HOSP.lam * (HOSP.W - HOSP.W2)} beds freed. Shorter stays are capacity.`,
        },
        {
          kind: 'multi',
          body: 'What does Little’s law need to hold (on long-run averages)? Pick all that apply.',
          options: [
            { text: 'The system is steady: arrivals and departures balance over the period', correct: true, why: 'If the stock keeps growing, the people inside haven’t finished their stays yet, and the averages don’t line up.' },
            { text: 'L, λ and W are measured over the same system and period', correct: true, why: 'Mix the whole shop’s count with the checkout line’s wait and it breaks.' },
            { text: 'Random (Poisson) arrivals', why: 'Any arrival pattern works. That generality is what makes it so useful.' },
            { text: 'First-come-first-served order', why: 'Order changes who waits, not the average: the bars’ total length is the same.' },
            { text: 'A single server', why: 'The number of servers doesn’t matter; it works for a whole hospital or a country.' },
          ],
          explain: 'Little’s law is nearly an accounting identity: it needs a stable system and consistent measurement, not any particular distribution, order or number of servers.',
        },
        {
          kind: 'estimate',
          body: `A country holds steady at about ${CITY.L.toLocaleString('en-US')} people, and people live about ${CITY.W} years. Roughly how many births a year keep it steady (ignore migration)?`,
          min: 0, max: 50000, step: 500, answer: CITY_LAM, tol: 2500, format: (v) => `${v.toLocaleString('en-US')} a year`,
          hint: 'People are the L, lifespan is the W.',
          explain: `λ = L ÷ W = ${CITY.L.toLocaleString('en-US')} ÷ ${CITY.W} = ${CITY_LAM.toLocaleString('en-US')} births a year.`,
        },
      ],
      practice: [genLittle, genLittleQueue, genStayCut],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'explode',
      title: 'Why waits explode',
      goal: 'Read the 1/(1−ρ) curve and predict what extra load costs.',
      steps: [
        {
          kind: 'choice',
          body: `A server handles requests in ${API.S} ms on average. Requests arrive at random and processing time varies. At ${pct(API.r1)} busy, a request spends ${fx(API.S * mm1W(API.r1))} ms in total (waiting plus processing). Traffic grows until it is ${pct(API.r2)} busy. About how long now?`,
          options: [
            { text: `About ${fx(API.S * mm1W(API.r2))} ms`, correct: true },
            { text: `About ${fx((API.S * mm1W(API.r1) * API.r2) / API.r1)} ms`, why: `That scales the time in proportion to the load. Waiting doesn’t grow in a straight line: the last bits of capacity cost far more.` },
            { text: `About ${fx(API.S * mm1W(API.r1))} ms, unchanged until it’s full`, why: 'There’s no cliff at 100%. Waits climb smoothly and steeply long before that.' },
          ],
          hint: 'The time in the system is the service time ÷ (1 − ρ).',
          explain: `At ${pct(API.r1)}: ${API.S} ÷ ${fx(1 - API.r1, 2)} = ${fx(API.S * mm1W(API.r1))} ms. At ${pct(API.r2)}: ${API.S} ÷ ${fx(1 - API.r2, 2)} = ${fx(API.S * mm1W(API.r2))} ms. ${fx(API.r2 / API.r1, 2)}× the load, ${fx(mm1W(API.r2) / mm1W(API.r1), 2)}× the time.`,
        },
        {
          kind: 'read',
          title: 'The hockey stick',
          body: `For a single server with random arrivals and random service (the “M/M/1” queue):\n\n**time in system W = S ÷ (1 − ρ)**, where S is the average service time.\n\n**wait in line = S × ρ/(1 − ρ)**\n\n${[0.5, 0.8, 0.9, 0.95].map((r, i) => `${i ? `at ${pct(r)}, ` : `At ${pct(r)} busy you spend `}${fx(mm1W(r))}S`).join('; ')}. Each step closer to full costs more than the last. Slide it, and compare with a simulation of 20,000 customers.`,
          widget: curveExplorer({ S: 5, seed: 9 }),
        },
        {
          kind: 'number', unit: 'min',
          body: `A one-desk post office: service averages ${L3W.S} minutes (randomly varying), customers arrive at random, the clerk is ${pct(L3W.r)} busy. Average total time per customer?`,
          answer: L3W.S * mm1W(L3W.r), tol: 0.05,
          hint: 'W = S ÷ (1 − ρ).',
          explain: `${L3W.S} ÷ ${fx(1 - L3W.r, 2)} = ${fx(L3W.S * mm1W(L3W.r))} minutes, of which ${fx(L3W.S * mm1W(L3W.r) - L3W.S)} is waiting in line and ${L3W.S} is service.`,
        },
        {
          kind: 'number', unit: 'people',
          body: `The average number **waiting in line** in an M/M/1 queue is ρ²/(1 − ρ). How many is that at ρ = ${L3LQ}?`,
          answer: mm1Lq(L3LQ), tol: 0.01,
          hint: `${L3LQ}² ÷ (1 − ${L3LQ}).`,
          explain: `${fx(L3LQ * L3LQ, 3)} ÷ ${fx(1 - L3LQ, 2)} = ${fx(mm1Lq(L3LQ), 3)} people waiting on average, even though the server is idle ${pct(1 - L3LQ)} of the time.`,
        },
        {
          kind: 'point',
          body: `Tap the utilization at which the average time in the system is **${L3PT} times** the service time.`,
          plot: { x: [0, 1], y: [0, 20], size: SZ, xlabel: 'utilization ρ', ylabel: 'time ÷ service time', ticks: [0.1, 5], layers: [{ type: 'fn', f: mm1W, to: 0.951, color: 'var(--c1)' }, { type: 'hline', y: L3PT, color: 'var(--muted)', dash: true }] },
          answer: { x: L3PT_RHO }, tol: 0.03, snap: 0.01,
          hint: `1 ÷ (1 − ρ) = ${L3PT}.`,
          explain: `1 − ρ = 1/${L3PT}, so ρ = ${fx(L3PT_RHO, 2)}.`,
        },
        {
          kind: 'choice',
          body: `Two managers each add 10 points of load. One goes from ${pct(JUMP.a[0])} to ${pct(JUMP.a[1])}, the other from ${pct(JUMP.b[0])} to ${pct(JUMP.b[1])}. How do their average times in the system change?`,
          options: [
            { text: `The first: ×${fx(mm1W(JUMP.a[1]) / mm1W(JUMP.a[0]), 3)}; the second: ×${fx(mm1W(JUMP.b[1]) / mm1W(JUMP.b[0]), 3)}`, correct: true },
            { text: 'Both grow by the same amount: same extra load', why: 'The curve gets steeper as it climbs. The same 10 points cost far more near full.' },
            { text: `Both grow ×${fx(JUMP.a[1] / JUMP.a[0], 3)}`, why: 'That treats waiting as proportional to load. It goes as 1/(1 − ρ), not ρ.' },
          ],
          hint: 'Compare 1/(1 − ρ) before and after, for each.',
          explain: `1/(1 − ρ): ${fx(mm1W(JUMP.a[0]), 3)} → ${fx(mm1W(JUMP.a[1]), 3)} for the first, ${fx(mm1W(JUMP.b[0]), 3)} → ${fx(mm1W(JUMP.b[1]), 3)} for the second. Near full, the time doubles.`,
        },
        {
          kind: 'read',
          title: 'Why so steep?',
          body: `Time in the system depends on the **idle** fraction, 1 − ρ, not the busy one. Going from 90% to 95% busy halves the idle time, so it doubles the wait.\n\nIntuition: a backlog only drains during the server’s spare capacity. At 50% busy, half of every hour works it off. At 95%, only ${fx(60 * (1 - 0.95))} minutes of every hour do, so every random burst lingers for a long time and the next burst lands on top of it.`,
          widget: queueExplorer({ lam: 27, mu: 30, seed: 11 }),
        },
        {
          kind: 'order',
          body: 'Each has random arrivals and service. Order them from **shortest** to **longest** average time in the system.',
          items: ORDER3.map((x) => x.name),
          hint: 'Compute S ÷ (1 − ρ) for each, in the same units.',
          explain: ORDER3.map((x) => `${x.name.split(':')[0]}: ${x.u === 's' ? `${fx(x.S * mm1W(x.r))} s = ${fx(x.W, 3)} min` : `${fx(x.W)} min`}`).join('; ') + '. A slow service at low load can beat a fast one near full.',
        },
        {
          kind: 'number', prob: true,
          body: `An ops team wants the average time in the system to stay below **${TARGET4}×** the service time (random arrivals and service). What is the highest utilization they can run at?`,
          answer: 1 - 1 / TARGET4, tol: 0.006,
          hint: `1/(1 − ρ) = ${TARGET4}.`,
          explain: `1 − ρ = 1/${TARGET4}, so ρ = ${pct(1 - 1 / TARGET4)}. Running “efficiently” at 95% would mean ${fx(mm1W(0.95))}× instead.`,
        },
        {
          kind: 'multi',
          body: 'Why do well-run teams and servers deliberately keep slack (run at, say, 60–80%)? Pick all that apply.',
          options: [
            { text: 'Waits grow like 1/(1 − ρ), so the last few % of utilization cost huge delays', correct: true },
            { text: 'Spare capacity absorbs surprises: bursts, urgent jobs, a server going down', correct: true },
            { text: 'A small change in demand near 100% causes a big change in waiting', correct: true, why: 'The curve is steepest there, so it’s also the least predictable place to operate.' },
            { text: 'Idle time is wasted, so the goal is 100%', why: 'At 100% the line grows without limit. Idle time is what keeps waits finite.' },
          ],
          explain: 'Utilization and responsiveness trade off. Slack isn’t waste; it’s what keeps waiting short and predictable.',
        },
        {
          kind: 'number', unit: 'per hour',
          body: `A single checkout gets ${CAP3.lam} customers an hour (random). For an M/M/1 queue, W = 1/(μ − λ). How fast must the checkout serve (μ, per hour) for the average total time to be ${CAP3.W} minutes?`,
          answer: CAP3_MU, tol: 0.01,
          hint: `W = ${CAP3.W}/60 h, so μ − λ = 60/${CAP3.W}.`,
          explain: `μ − ${CAP3.lam} = 1 ÷ (${CAP3.W}/60 h) = ${60 / CAP3.W}/h, so μ = ${CAP3_MU} an hour (${fx(60 / CAP3_MU, 3)} min per customer). The server runs at ${pct(CAP3.lam / CAP3_MU)}.`,
        },
      ],
      practice: [genMM1W, genMaxRho, genJump],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'variability',
      title: 'Variability hurts',
      goal: 'Predict how spread in arrivals and service lengthens waits, with Kingman’s formula.',
      steps: [
        {
          kind: 'choice',
          body: `Two dentists each see ${DENT.perHour} patients an hour, and visits average ${DENT.S} minutes. Dentist A books patients exactly every ${60 / DENT.perHour} minutes and every visit takes exactly ${DENT.S}. Dentist B takes walk-ins at random, and visit lengths vary at random. How long do patients wait?`,
          options: [
            { text: `A: nobody waits. B: about ${fx(DENT_WQ)} minutes on average`, correct: true },
            { text: 'The same for both: same averages, same waits', why: 'Same utilization, yes. But a queue forms when arrivals bunch up or a visit runs long, and A has neither.' },
            { text: 'B waits less: some walk-ins are quick', why: 'Quick visits help, but long ones and bunched arrivals hurt more, and the line remembers the bad stretches.' },
          ],
          hint: 'In A, does any patient ever arrive while the dentist is busy?',
          explain: `Both are ${pct(DENT_RHO)} busy. In A each visit ends ${60 / DENT.perHour - DENT.S} minutes before the next patient arrives: zero wait. In B, randomness alone gives ${DENT.S} × ${fx(DENT_RHO, 2)}/${fx(1 - DENT_RHO, 2)} = ${fx(DENT_WQ)} minutes. Same averages, very different lines.`,
        },
        {
          kind: 'read',
          title: 'Kingman’s formula',
          body: 'For a single server, the average wait in line is about\n\n**wait ≈ S × ρ/(1 − ρ) × (ca² + cs²)/2**\n\nwhere ca and cs are the **coefficients of variation** (standard deviation ÷ mean) of the gaps between arrivals and of the service times. Clockwork has CV 0; fully random (exponential) has CV 1.\n\nThree factors: how long service takes, how full you are, how variable things are. Slide the spreads and watch the simulated line.',
          widget: variabilityExplorer({ rho: 0.85, S: 6, seed: VAR_SEED }),
        },
        {
          kind: 'number', unit: 'min',
          body: `A car-wash tunnel takes exactly ${MD1.S} minutes per car (CV 0). Cars arrive at random (CV 1) and it is ${pct(MD1.r)} busy. Average wait in line, by Kingman?`,
          answer: kingman(MD1.S, MD1.r, 1, 0), tol: 0.05,
          hint: `${MD1.S} × ρ/(1 − ρ) × (1² + 0²)/2.`,
          explain: `${MD1.S} × ${fx(MD1.r / (1 - MD1.r), 3)} × ½ = ${fx(kingman(MD1.S, MD1.r, 1, 0), 3)} minutes: half of what it would be if wash times were random too (here this is exact).`,
        },
        {
          kind: 'choice',
          body: 'Arrivals stay random (CV 1). Service goes from fully random (CV 1) to perfectly consistent (CV 0), same average, same load. What happens to the average wait in line?',
          options: [
            { text: 'It halves', correct: true },
            { text: 'It drops to zero', why: 'Random arrivals still bunch up. Only when both arrivals and service are clockwork does the wait vanish.' },
            { text: 'Nothing: the average service time didn’t change', why: 'Averages aren’t the whole story. Spread creates waiting even with the same mean.' },
          ],
          hint: 'Compare (ca² + cs²)/2 before and after.',
          explain: '(1 + 1)/2 = 1 before, (1 + 0)/2 = ½ after. The wait halves.',
        },
        {
          kind: 'sort',
          body: 'What does each change do?',
          bins: ['Smooths arrivals', 'Smooths service', 'Adds capacity'],
          items: [
            { text: 'Booking appointments instead of walk-ins', bin: 0 },
            { text: 'A checklist so every job follows the same steps', bin: 1 },
            { text: 'Sending rare complex cases to a specialist desk', bin: 1 },
            { text: 'Staggering school start times', bin: 0 },
            { text: 'Hiring another clerk', bin: 2 },
            { text: 'Buying a faster machine', bin: 2 },
          ],
          hint: 'Smoothing changes the spread; capacity changes ρ.',
          explain: 'Appointments and staggering spread arrivals out (lower ca). Checklists and splitting off odd cases make service times more alike (lower cs). Another clerk or a faster machine lowers ρ instead.',
        },
        {
          kind: 'choice',
          body: `Random arrivals and fully random service, ${VC.S}-minute average service, ${pct(VC.r)} busy: the wait is ${fx(kingman(VC.S, VC.r, 1, 1))} minutes. Option A: make service perfectly consistent. Option B: add capacity so the load is ${pct(VC.r2)}. Which gives the shorter wait?`,
          options: [
            { text: 'A: make service perfectly consistent', correct: VC_A < VC_B, why: VC_A < VC_B ? undefined : `B gives ${fx(VC_B)} minutes, shorter than A’s ${fx(VC_A)}.` },
            { text: `B: add capacity, down to ${pct(VC.r2)} busy`, correct: VC_B < VC_A, why: VC_B < VC_A ? undefined : `A gives ${fx(VC_A)} minutes, shorter than B’s ${fx(VC_B)}.` },
          ],
          hint: 'Kingman for each option.',
          explain: `A: ${VC.S} × ${fx(VC.r / (1 - VC.r), 3)} × ½ = ${fx(VC_A)}. B: ${VC.S} × ${fx(VC.r2 / (1 - VC.r2), 3)} × 1 = ${fx(VC_B)}. Near full load both levers are big; here ${VC_A < VC_B ? 'consistency' : 'capacity'} edges it.`,
        },
        {
          kind: 'read',
          title: 'Same average, different spread',
          body: `The same simulated day four ways: ${pct(0.85)} busy, ${6}-minute average service, 20,000 customers each. Only the spread differs.`,
          widget: () => dataTable(['Arrivals / service', 'Simulated wait', 'Kingman'], VAR_ROWS.map(([label, ca, cs]) => [
            label, `${fx(simulate({ n: 20000, lam: 0.85 / 6, S: 6, ca, cs, seed: VAR_SEED }).meanWait)} min`, `${fx(kingman(6, 0.85, ca, cs))} min`,
          ]), { caption: 'Kingman is an approximation; it’s best with random arrivals' }),
        },
        {
          kind: 'estimate',
          body: `A doctor books patients every ${DOC.slot} minutes and they arrive on time. Visits average ${DOC.S} minutes, with a standard deviation of ${DOC.sd} minutes. Roughly how long does the average patient wait past their slot, by Kingman?`,
          min: 0, max: 120, step: 5, answer: Math.round(DOC_WQ / 5) * 5, tol: 5, format: (v) => `${v} min`,
          hint: `ρ = ${DOC.S}/${DOC.slot}, ca = 0, cs = ${DOC.sd}/${DOC.S}.`,
          explain: `ρ = ${fx(DOC.S / DOC.slot, 2)}, cs = ${fx(DOC.sd / DOC.S, 2)}. ${DOC.S} × ${fx(DOC.S / DOC.slot / (1 - DOC.S / DOC.slot), 3)} × (0 + ${fx((DOC.sd / DOC.S) ** 2, 3)})/2 ≈ ${fx(DOC_WQ)} minutes. Visits shorter than the slot on average, yet the doctor still runs late.`,
        },
        {
          kind: 'multi',
          body: 'Which are true? Pick all that apply.',
          options: [
            { text: 'With zero variability, there is no waiting until ρ reaches 1', correct: true, why: 'Clockwork arrivals and service never collide below full load.' },
            { text: 'Variability matters more the busier the server is', correct: true, why: 'The variability term is multiplied by ρ/(1 − ρ), which explodes near 1.' },
            { text: 'A long job early in the day can delay everyone after it', correct: true, why: 'Lines have memory: delay carries forward until slack absorbs it.' },
            { text: 'Fast and slow customers average out, so spread doesn’t matter', why: 'Waiting doesn’t average out: a slow customer delays everyone behind, a fast one can’t give time back to the past.' },
          ],
          explain: 'Queues punish spread because delay accumulates and only slack removes it. That effect is multiplied by how full the system is.',
        },
        {
          kind: 'fill',
          body: 'Complete Kingman’s formula in words.',
          template: 'average wait ≈ [[0]] × [[1]] × [[2]]',
          blanks: [
            { options: ['service time', 'arrival rate', 'number waiting'], answer: 0 },
            { options: ['ρ/(1 − ρ)', 'ρ', '1 − ρ'], answer: 0 },
            { options: ['(ca² + cs²)/2', 'ca × cs', 'ca + cs'], answer: 0 },
          ],
          explain: 'Time scale × utilization term × variability term: S × ρ/(1 − ρ) × (ca² + cs²)/2.',
        },
      ],
      practice: [genKingman, genVarFactor, genVarCompare],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'bottleneck',
      title: 'The bottleneck sets the pace',
      goal: 'Find a pipeline’s bottleneck, its throughput, and where extra capacity pays off.',
      steps: [
        {
          kind: 'number', unit: 'per hour',
          body: `A restaurant kitchen: every plate goes through ${KITCHEN.map((s) => `${s.name} (${s.cap} plates/h)`).join(' → ')}. On a packed night with orders always waiting, how many plates an hour reach diners?`,
          widget: pipeline(KITCHEN),
          answer: KTHR, tol: 0.01,
          hint: 'Can plates leave faster than the slowest station makes them?',
          explain: `${KTHR} an hour: the grill. Prep could do ${KITCHEN[0].cap}, plating ${KITCHEN[2].cap}, but they can only pass on what the grill passes them.`,
        },
        {
          kind: 'read',
          title: 'Watch the piles',
          body: `Now orders arrive at ${KARR} an hour. Step through the evening. Prep keeps up; work piles up in front of the **bottleneck**, and plating sits idle part of the time, waiting for the grill.`,
          widget: pipelineStepper(KITCHEN, KARR, 6),
        },
        {
          kind: 'number', unit: 'orders',
          body: `With ${KARR} orders an hour arriving, how many orders are piled up in front of the grill after ${KHOURS} hours?`,
          answer: KPILE, tol: 0.01,
          hint: 'What reaches the grill per hour, and what leaves it?',
          explain: `Prep passes all ${KARR} an hour on; the grill finishes ${KITCHEN[1].cap}. The pile grows ${KARR - KITCHEN[1].cap} an hour: ${KPILE} after ${KHOURS} hours.`,
        },
        {
          kind: 'choice',
          body: 'The owner can afford one upgrade. Which raises the number of plates served?',
          widget: pipeline(KITCHEN),
          options: [
            { text: 'A second grill', correct: true },
            { text: 'A faster plating station', why: `Plating already has spare capacity (${KITCHEN[2].cap}/h vs ${KTHR}/h). Faster plating means more idle plating.` },
            { text: 'Another prep cook', why: 'Prep isn’t the constraint: more prep just builds a bigger pile in front of the grill.' },
          ],
          hint: 'Only one station limits output.',
          explain: 'An hour gained at the bottleneck is an hour gained for the whole kitchen. An hour gained anywhere else is an illusion.',
        },
        {
          kind: 'number', unit: 'per hour',
          body: `They double the grill to ${K2[1].cap} plates an hour. What is the kitchen’s output now?`,
          widget: pipeline(K2),
          answer: K2THR, tol: 0.01,
          hint: 'Take the minimum again.',
          explain: `Not ${K2[1].cap}: prep now limits it to ${K2THR}. Fixing a bottleneck moves it somewhere else.`,
        },
        {
          kind: 'task',
          title: 'Staff the kitchen',
          body: `Each prep cook does ${STAFF5.st[0].per} plates an hour, each grill cook ${STAFF5.st[1].per}, each plater ${STAFF5.st[2].per}; there are ${STAFF5.st[0].workers} of each now. You can hire **${STAFF5.budget}** more people. Reach **${STAFF5.target}** plates an hour.`,
          widget: staffTask(STAFF5),
          hint: 'Grill first, then see what becomes the slowest.',
          explain: STAFF5.st.map((x, i) => `${x.name}: ${STAFF5_NEED[i]} × ${x.per} = ${STAFF5_NEED[i] * x.per}${STAFF5_NEED[i] > x.workers ? ` (+${STAFF5_NEED[i] - x.workers})` : ' (already enough)'}`).join('; ') + `. That is exactly ${STAFF5_NEED.reduce((a, n, i) => a + n - STAFF5.st[i].workers, 0)} new people. Putting them all on the grill would leave prep at ${STAFF5.st[0].per * STAFF5.st[0].workers}: the bottleneck moves.`,
        },
        {
          kind: 'number', unit: 'per hour',
          body: `A deploy pipeline: each change is built (${DEPLOY.build} min, one build at a time), tested (${DEPLOY.test} min, ${DEPLOY.testers} test runners in parallel), then shipped (${DEPLOY.ship} min, one at a time). How many changes an hour can it ship at most?`,
          answer: DEP_THR, tol: 0.01,
          hint: 'Capacity of each stage = parallel slots × 60 ÷ minutes.',
          explain: `Build: 60/${DEPLOY.build} = ${DEP_CAPS.build}/h. Test: ${DEPLOY.testers} × 60/${DEPLOY.test} = ${DEP_CAPS.test}/h. Ship: 60/${DEPLOY.ship} = ${DEP_CAPS.ship}/h. The slowest is ${DEP_THR}/h. The longest step (test) isn’t the bottleneck: parallel runners make up for it.`,
        },
        {
          kind: 'match',
          body: 'Match each station to its capacity.',
          heads: ['Station', 'Capacity'],
          pairs: MATCH5.map((m) => [`${m.c} worker${m.c > 1 ? 's' : ''}, ${m.t} min per job`, `${fx(m.cap)} jobs an hour`] as [string, string]),
          hint: 'workers × 60 ÷ minutes.',
          explain: MATCH5.map((m) => `${m.c} × 60/${m.t} = ${fx(m.cap)}`).join('; ') + '.',
        },
        {
          kind: 'multi',
          body: 'You walk through a factory. Which are signs that a station is the bottleneck? Pick all that apply.',
          options: [
            { text: 'Work piles up in front of it', correct: true },
            { text: 'It is busy all the time', correct: true },
            { text: 'Stations after it often stand idle, waiting for work', correct: true },
            { text: 'It is the station with the longest task', why: 'Parallel workers can make a long task fast in total. Compare capacities, not task lengths.' },
            { text: 'Its workers look the most stressed', why: 'Busy-looking isn’t the test. Look at the piles and idle stations around it.' },
          ],
          explain: 'A bottleneck has a queue in front, never rests, and starves what comes after it.',
        },
        {
          kind: 'number', prob: true,
          body: `In the original kitchen (grill ${KTHR}/h is the bottleneck), what share of the time is the prep station (capacity ${KITCHEN[0].cap}/h) actually busy?`,
          answer: KTHR / KITCHEN[0].cap, tol: 0.006,
          hint: 'In the long run prep can only make what the grill takes.',
          explain: `Prep makes ${KTHR} an hour out of a possible ${KITCHEN[0].cap}: ${pct(KTHR / KITCHEN[0].cap)} busy. Keeping prep 100% busy would just build inventory in front of the grill.`,
        },
        {
          kind: 'choice',
          body: `On a packed night the grill (${KTHR}/h, the bottleneck) breaks down for an hour. Another night the dishwasher, which has plenty of spare capacity, breaks down for an hour. How many plates does each breakdown cost?`,
          options: [
            { text: `Grill: about ${KTHR} plates, gone for good. Dishwasher: about none, it catches up`, correct: true },
            { text: 'About the same: an hour is an hour', why: 'An hour lost where there’s slack is absorbed by that slack. An hour lost at the bottleneck is lost for the whole system.' },
            { text: 'Dishwasher worse: plates run out', why: 'With spare capacity, it clears the backlog once fixed, before plates run out (unless the stock of clean plates is tiny).' },
          ],
          explain: `The bottleneck sets output: an hour of grill time is ${KTHR} plates. Protect it: never let it starve, never let it stop.`,
        },
        {
          kind: 'order',
          body: 'Put the “five focusing steps” for improving a system’s constraint in order.',
          items: [
            'Identify the bottleneck',
            'Exploit it: never let it sit idle or work on the wrong thing',
            'Subordinate everything else to its pace',
            'Elevate it: add capacity there',
            'Repeat: find where the bottleneck has moved',
          ],
          hint: 'Cheap fixes before expensive ones.',
          explain: 'Find it, squeeze it, pace the rest to it, then (only if needed) buy capacity, and look again because it will have moved.',
        },
      ],
      practice: [genThroughput, genWhereAdd, genUpgrade],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'batches',
      title: 'Batches and work in progress',
      goal: 'See how batch size and work in progress drive lead time.',
      steps: [
        {
          kind: 'choice',
          body: `You must fold, stuff and seal ${LET.N} letters, 1 minute per letter for each step. You fold all ${LET.N}, then stuff all ${LET.N}, then seal all ${LET.N}. When is the **first** letter ready to post?`,
          options: [
            { text: `Minute ${letFirst(LET.N)}`, correct: true },
            { text: `Minute ${letFirst(1)}`, why: 'That’s one letter at a time. In a batch, the first letter waits for all the others at every step but the last.' },
            { text: `Minute ${letAll(LET.N)}`, why: `That’s when the last one is ready. The first one is sealed ${letAll(LET.N) - letFirst(LET.N)} minutes earlier.` },
          ],
          hint: `Folding takes until minute ${LET.N}, stuffing until minute ${2 * LET.N}…`,
          explain: `Folding ends at ${LET.N}, stuffing at ${2 * LET.N}, and the first seal is done at ${letFirst(LET.N)}. One letter at a time, the first is ready at minute ${letFirst(1)}.`,
        },
        {
          kind: 'read',
          title: 'Batch size',
          body: 'Each row is a step, each column a minute, each colour a batch. Slide the batch size. The total work never changes, yet with small batches the first letter is out sooner, all letters finish sooner, and fewer half-done letters are lying around.',
          widget: batchExplorer(LET.names, LET.N, LET.N),
        },
        {
          kind: 'number', unit: 'min',
          body: `Same ${LET.N} letters, one at a time through fold → stuff → seal. When is the **last** letter done?`,
          answer: letAll(1), tol: 0.01,
          hint: 'The first is done at minute 3; after that one comes out every minute.',
          explain: `First out at 3, then one per minute: ${letAll(1)}. In one big batch: ${letAll(LET.N)}.`,
        },
        {
          kind: 'number', unit: 'min',
          body: `${B4.N} parts through ${B4.st} machines, ${B4.t} min per part on each. They move on in batches of ${B4.B}. When are all parts done? (In one batch of ${B4.N} it would be minute ${B4_BIG}.)`,
          answer: B4_ALL, tol: 0.01,
          hint: `Each batch takes ${B4.B * B4.t} min per machine; count the batch-steps.`,
          explain: `${B4.N / B4.B} batches march through ${B4.st} machines: (${B4.st} + ${B4.N / B4.B} − 1) × ${B4.B * B4.t} = ${B4_ALL} min.`,
        },
        {
          kind: 'choice',
          body: 'A machine at the first station is misaligned, and the defect is only noticed at the last station. How many bad parts have been made when the first one is spotted?',
          options: [
            { text: 'With big batches, the whole batch; with one-piece flow, about one per station', correct: true },
            { text: 'The same either way: the defect rate is the same', why: 'The rate is the same, but the feedback delay isn’t. Big batches hide problems until a whole batch is done.' },
            { text: 'Fewer with big batches, since there are fewer handoffs', why: 'Handoffs aren’t where defects come from. The longer it takes a part to reach inspection, the more bad parts are made meanwhile.' },
          ],
          explain: 'Small batches shorten feedback loops: problems surface after a few items, not after hundreds.',
        },
        {
          kind: 'number', unit: 'days',
          body: `A team releases software every ${REL.every} days, bundling everything finished since the last release. Changes are finished at a steady pace. On average, how long does a finished change wait to be released?`,
          answer: REL.every / 2, tol: 0.01,
          hint: 'A change finished just after a release waits the whole interval; one finished just before waits almost nothing.',
          explain: `Waits are spread evenly from 0 to ${REL.every} days: average ${REL.every / 2}. Releasing daily would cut it to half a day.`,
        },
        {
          kind: 'read',
          title: 'Work in progress',
          body: `A pipeline whose stations add up to ${FP.T0} hours of work per job, with a bottleneck finishing ${FP.rb} jobs an hour. Slide the number of jobs in progress.\n\nBelow ${FP.T0 * FP.rb} jobs, the bottleneck sometimes runs dry. Above, throughput is stuck at ${FP.rb}/h and every extra job just waits: lead time = WIP ÷ throughput, Little’s law again.`,
          widget: wipExplorer(FP),
        },
        {
          kind: 'number', unit: 'h',
          body: `Same pipeline: bottleneck at ${FP.rb} jobs an hour. The manager keeps ${FP.wip} jobs in progress to “keep everyone busy”. What is the average lead time per job?`,
          answer: FP.wip / FP.rb, tol: 0.01,
          hint: 'WIP ÷ throughput.',
          explain: `${FP.wip} ÷ ${FP.rb} = ${FP.wip / FP.rb} hours, against ${FP.T0} hours of actual work. Output would be the same with ${FP.T0 * FP.rb} in progress, at a lead time of ${FP.T0} hours.`,
        },
        {
          kind: 'number', unit: 'days',
          body: `A team has ${TEAM.wip} tasks in progress and finishes ${TEAM.thr} a day. They adopt a WIP limit of ${TEAM.wip2} (finishing the same ${TEAM.thr} a day). What is the new average lead time?`,
          answer: TEAM.wip2 / TEAM.thr, tol: 0.01,
          hint: 'Lead time = WIP ÷ throughput.',
          explain: `Before: ${TEAM.wip}/${TEAM.thr} = ${TEAM.wip / TEAM.thr} days. After: ${TEAM.wip2}/${TEAM.thr} = ${TEAM.wip2 / TEAM.thr} days. Same output, ${TEAM.wip / TEAM.wip2}× faster delivery: stop starting, start finishing.`,
        },
        {
          kind: 'sort',
          body: 'Which way does each consideration push the batch size?',
          bins: ['Towards bigger batches', 'Towards smaller batches'],
          items: [
            { text: 'Each oven warm-up takes 40 minutes', bin: 0 },
            { text: 'A shipping container costs the same however full', bin: 0 },
            { text: 'Customers want their order soon', bin: 1 },
            { text: 'Defects are found only at the end', bin: 1 },
            { text: 'Half-finished work ties up cash and space', bin: 1 },
          ],
          hint: 'Fixed costs per batch favour big batches; everything about waiting favours small ones.',
          explain: 'Setup and fixed transport costs reward big batches. Lead time, feedback and inventory reward small ones. The usual fix is to cut the setup cost so small batches become cheap.',
        },
        {
          kind: 'fill',
          body: 'Little’s law, for a work pipeline.',
          template: 'lead time = [[0]] ÷ [[1]]',
          blanks: [
            { options: ['work in progress', 'batch size', 'utilization'], answer: 0 },
            { options: ['throughput', 'work in progress', 'number of stations'], answer: 0 },
          ],
          explain: 'W = L ÷ λ: the work in the system divided by how fast it comes out.',
        },
      ],
      practice: [genBatchFirst, genBatchTotal, genWip],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'pooling',
      title: 'Pooling',
      goal: 'Compare separate lines with one shared line, and see why big pools run hotter.',
      steps: [
        {
          kind: 'choice',
          body: `A bank has two tellers, each with her own line. Each line gets ${POOL.perLine} customers an hour at random; service averages ${POOL.S} minutes (random). Average wait in line: ${fx(SEP_WQ)} minutes. The bank switches to **one shared line** feeding both tellers. Now?`,
          options: [
            { text: `About ${fx(ONE_WQ)} minutes`, correct: true },
            { text: `About ${fx(SEP_WQ)} minutes: same tellers, same customers`, why: 'With separate lines, one teller can sit idle while the other line is long. A shared line never wastes a free teller.' },
            { text: `About ${fx(SEP_WQ * 2)} minutes: the line is twice as long`, why: 'The shared line is longer but drains twice as fast, and there’s less wasted idle time, so the wait falls.' },
          ],
          hint: 'With separate lines, can a teller be idle while people wait?',
          explain: `Separate lines are two M/M/1 queues at ρ = ${fx(POOL_RHO, 2)}: ${POOL.S} × ${fx(POOL_RHO, 2)}/${fx(1 - POOL_RHO, 2)} = ${fx(SEP_WQ)} min. One line with two tellers (M/M/2): ${fx(ONE_WQ)} min, ${fx(SEP_WQ / ONE_WQ, 2)}× shorter.`,
        },
        {
          kind: 'read',
          title: 'Same customers, two layouts',
          body: 'This simulates the very same customers and service times both ways: once where each customer picks a line at random and stays in it, once with a single shared line. Try more servers and higher loads.',
          widget: poolExplorer({ S: POOL.S, seed: 5 }),
        },
        {
          kind: 'choice',
          body: 'Why does one shared line beat separate lines?',
          options: [
            { text: 'No server is ever idle while someone is waiting', correct: true },
            { text: 'Servers work faster when they see a long line', why: 'The simulation keeps service times identical. The gain is purely from who serves whom.' },
            { text: 'Fewer customers arrive', why: 'Arrivals are exactly the same in both layouts.' },
          ],
          explain: 'With separate lines, bad luck in one line can’t borrow the spare capacity of another. Pooling shares the slack, so it absorbs variability.',
        },
        {
          kind: 'read',
          title: 'Bigger pools run hotter',
          body: `Average wait in line at the same ${pct(0.8)} utilization, ${POOL.S}-minute service, one shared line (Erlang C formula):`,
          widget: () => dataTable(['Servers', 'Chance of waiting', 'Average wait'], SCALE.map((c) => [String(c), pct(erlangC(c, 0.8 * c), 0), `${fx(POOL.S * 60 * mmcWq(c, 0.8 * c), 2)} s`]), { caption: 'All at 80% busy' }),
        },
        {
          kind: 'multi',
          body: 'What does the table show? Pick all that apply.',
          options: [
            { text: 'At the same utilization, big pools have much shorter waits', correct: true },
            { text: 'A big pool can run at higher utilization for the same wait', correct: true, why: 'Big call centres run at 90%+ busy with short waits; a lone server can’t.' },
            { text: 'Adding servers at the same utilization doesn’t change waits', why: `1 server: ${fx(POOL.S * 60 * mmcWq(1, 0.8), 2)} s; 32 servers: ${fx(POOL.S * 60 * mmcWq(32, 25.6), 2)} s, same 80%.` },
          ],
          explain: 'Random fluctuations grow only like the square root of the load, so a big pool needs proportionally less slack.',
        },
        {
          kind: 'number', unit: 'agents',
          body: `That gives the **square-root staffing** rule: agents ≈ a + β√a, where a is the offered load (calls per hour × hours per call) and β sets the service level. A help line has a = ${SQRT.a} and uses β = ${SQRT.beta}. How many agents?`,
          answer: SQRT.a + SQRT.beta * Math.sqrt(SQRT.a), tol: 0.01,
          hint: `√${SQRT.a} = ${Math.sqrt(SQRT.a)}.`,
          explain: `${SQRT.a} + ${SQRT.beta} × ${Math.sqrt(SQRT.a)} = ${SQRT.a + SQRT.beta * Math.sqrt(SQRT.a)}. Utilization ≈ ${pct(SQRT.a / (SQRT.a + SQRT.beta * Math.sqrt(SQRT.a)))}. Four times the load would need only twice the safety margin.`,
        },
        {
          kind: 'number', unit: 'min',
          body: `Back to one teller with her own line: ${POOL.perLine} customers an hour, ${POOL.S}-minute service, both random. Average wait **in line**?`,
          answer: SEP_WQ, tol: 0.05,
          hint: 'S × ρ/(1 − ρ).',
          explain: `ρ = ${POOL.perLine} × ${POOL.S}/60 = ${fx(POOL_RHO, 2)}. ${POOL.S} × ${fx(POOL_RHO, 2)}/${fx(1 - POOL_RHO, 2)} = ${fx(SEP_WQ)} minutes.`,
        },
        {
          kind: 'choice',
          body: `Pooling has a price. If both tellers must handle every kind of request, each becomes ${pct(SLOW.slower, 0)} slower (${fx(SLOW_S)} min instead of ${POOL.S}). Shared line with slower tellers, or separate lines with fast ones (${fx(SEP_WQ)} min wait)?`,
          options: [
            { text: `Separate lines: the pooled wait would be about ${fx(SLOW_WQ)} min`, correct: SLOW_WQ > SEP_WQ, why: SLOW_WQ > SEP_WQ ? undefined : `Pooled is ${fx(SLOW_WQ)} min, shorter than ${fx(SEP_WQ)}.` },
            { text: `Shared line: about ${fx(SLOW_WQ)} min`, correct: SLOW_WQ <= SEP_WQ, why: SLOW_WQ <= SEP_WQ ? undefined : `Slower service pushes utilization to ${pct((2 * POOL.perLine * SLOW_S) / 60 / 2)}, and near full load that costs more than pooling saves.` },
          ],
          hint: `New utilization: ${POOL.perLine} × ${fx(SLOW_S)}/60.`,
          explain: `Utilization rises from ${pct(POOL_RHO)} to ${pct((POOL.perLine * SLOW_S) / 60)}. Pooled M/M/2 wait: ${fx(SLOW_WQ)} min vs ${fx(SEP_WQ)} separate. Near full load, speed matters more than pooling; at lighter loads pooling usually wins.`,
        },
        {
          kind: 'sort',
          body: 'Pooled (one shared line or resource) or separate?',
          bins: ['Pooled', 'Separate'],
          items: [
            { text: 'The snaking single line at airport security', bin: 0 },
            { text: 'Supermarket checkouts, each with its own line', bin: 1 },
            { text: 'Take-a-number at the post office', bin: 0 },
            { text: 'Each doctor with a personal patient list and waiting room', bin: 1 },
            { text: 'Cloud servers shared by many apps', bin: 0 },
          ],
          explain: 'Snaking lines, ticket systems and shared server pools pool the capacity. Per-checkout lines and personal lists don’t, though they keep other advantages (specialisation, continuity).',
        },
        {
          kind: 'estimate',
          body: `A call centre has ${CALL.teams} teams of ${CALL.agents} agents, each team getting ${CALL.perTeam} calls an hour (${CALL.S}-minute calls). Average wait now: ${fx(CALL_TEAM_S, 2)} seconds. They merge into one team of ${CALL.agents * CALL.teams} taking all ${CALL.perTeam * CALL.teams} calls. Estimate the new average wait, in seconds.`,
          min: 0, max: Math.ceil(CALL_TEAM_S / 10) * 10, step: 1, answer: Math.round(CALL_ALL_S), tol: Math.max(2, Math.round(CALL_ALL_S * 0.25)), format: (v) => `${v} s`,
          hint: 'Same 80% load per agent, twice the pool. Look back at the table.',
          explain: `Erlang C with ${CALL.agents * CALL.teams} agents and load ${CALL_A * CALL.teams}: about ${fx(CALL_ALL_S, 2)} seconds, down from ${fx(CALL_TEAM_S, 2)}. No new staff, ${fx(CALL_TEAM_S / CALL_ALL_S, 2)}× shorter waits.`,
        },
      ],
      practice: [genSeparate, genSqrt, genPoolChoice],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'priorities',
      title: 'Priorities and fairness',
      goal: 'Order work to cut average waiting, and see what priorities and multitasking really cost.',
      steps: [
        {
          kind: 'choice',
          body: `Three print jobs arrive together: ${PRINT.map((j) => `a ${j.name} (${j.dur} min)`).join(', ')}. Which order gives the lowest **average** finish time?`,
          options: [
            { text: `${sjf(PRINT).map((j) => j.name).join(', ')}`, correct: true },
            { text: `${PRINT.map((j) => j.name).join(', ')}`, why: `Finish times ${finishTimes(PRINT).join(', ')}: average ${fx(meanFinish(PRINT), 3)} min. The long job makes both short ones wait.` },
            { text: `${[...sjf(PRINT)].reverse().map((j) => j.name).join(', ')}`, why: `Longest first is the worst order: finish times ${finishTimes([...sjf(PRINT)].reverse()).join(', ')}, average ${fx(meanFinish([...sjf(PRINT)].reverse()), 3)} min.` },
          ],
          hint: 'Each job’s length is added to the finish time of every job after it.',
          explain: `Shortest first: finish times ${finishTimes(sjf(PRINT)).join(', ')}, average ${fx(meanFinish(sjf(PRINT)), 3)} min. The last job finishes at ${PRINT.reduce((a, j) => a + j.dur, 0)} in every order.`,
        },
        {
          kind: 'task',
          title: 'Schedule the jobs',
          body: 'Five jobs are waiting for one machine. Tap them in the order to run them so that the **average finish time** is as low as possible.',
          widget: orderTask(TASK8),
          hint: 'A job’s duration delays every job behind it.',
          explain: `Shortest first: ${sjf(TASK8).map((j) => j.name).join(', ')}. Finish times ${finishTimes(sjf(TASK8)).join(', ')}, average ${fx(meanFinish(sjf(TASK8)), 3)}.`,
        },
        {
          kind: 'read',
          title: 'Shortest job first',
          body: 'A job’s duration is paid by itself **and by every job waiting behind it**. Put short ones first and the long durations delay fewer jobs. Shortest-job-first minimises the average wait for any set of jobs you know in advance. Express lanes (“10 items or fewer”) borrow the idea.',
        },
        {
          kind: 'number', unit: 'min',
          body: `Jobs in arrival order: ${FIFO8.map((j) => `${j.name} ${j.dur} min`).join(', ')}. Average finish time if run **first come, first served**?`,
          answer: meanFinish(FIFO8), tol: 0.01,
          hint: 'Running totals, then their average.',
          explain: `Finish times ${finishTimes(FIFO8).join(', ')}: average ${fx(meanFinish(FIFO8), 3)} min.`,
        },
        {
          kind: 'number', unit: 'min',
          body: `Same jobs (${FIFO8.map((j) => `${j.name} ${j.dur}`).join(', ')}), shortest first. Average finish time?`,
          answer: meanFinish(sjf(FIFO8)), tol: 0.01,
          hint: 'Sort by duration first.',
          explain: `Order ${sjf(FIFO8).map((j) => j.name).join(', ')}; finish times ${finishTimes(sjf(FIFO8)).join(', ')}: average ${fx(meanFinish(sjf(FIFO8)), 3)} min, ${fx(meanFinish(FIFO8) - meanFinish(sjf(FIFO8)), 3)} less than first come, first served.`,
        },
        {
          kind: 'choice',
          body: 'A busy server always runs the shortest waiting job first, and short jobs keep arriving. What is the risk?',
          options: [
            { text: 'Long jobs may wait almost forever (starvation)', correct: true },
            { text: 'The average wait goes up', why: 'The average goes down. The cost is in fairness and in the worst case, not the average.' },
            { text: 'None: shortest first is optimal', why: 'Optimal for the average. A job that’s always overtaken can wait without limit.' },
          ],
          explain: 'Real schedulers mix in ageing (waiting raises a job’s priority) or a cap on how long anything can be overtaken.',
        },
        {
          kind: 'order',
          body: 'Not all delays cost the same. **Weighted shortest job first**: do jobs in order of (cost of delay per week) ÷ (weeks of work). Order these, first to last.',
          items: WSJF.map((x) => `${x.name}: costs $${x.cost}k a week, takes ${x.dur} weeks`),
          hint: 'Divide cost of delay by duration for each.',
          explain: WSJF.map((x) => `${x.name}: ${x.cost}/${x.dur} = ${fx(x.score, 3)}`).join('; ') + '. Shortest first is the special case where every delay costs the same.',
        },
        {
          kind: 'number', unit: 'days',
          body: `You have ${MT.n} projects, each needing ${MT.d} days of work. If you rotate a day on each in turn, what is the **average** finish day? (One after another, it would be ${mtSerial(MT.n, MT.d)}.)`,
          answer: mtRobin(MT.n, MT.d), tol: 0.01,
          hint: `Each project gets its last day of work only in the last round.`,
          explain: `Rotating, they finish on days ${Array.from({ length: MT.n }, (_, k) => MT.n * (MT.d - 1) + k + 1).join(', ')}: average ${fx(mtRobin(MT.n, MT.d), 3)}. One at a time: ${Array.from({ length: MT.n }, (_, k) => (k + 1) * MT.d).join(', ')}, average ${mtSerial(MT.n, MT.d)}. Multitasking delays everything, even before switching costs.`,
        },
        {
          kind: 'number', unit: 'min',
          body: `A ${INTR.task}-minute task is interrupted ${INTR.k} times. Each interruption takes ${INTR.each} minutes, plus ${INTR.refocus} minutes to get back into the task. How long does the task take from start to finish?`,
          answer: INTR.task + INTR.k * (INTR.each + INTR.refocus), tol: 0.01,
          hint: 'Each interruption costs its own time plus the restart.',
          explain: `${INTR.task} + ${INTR.k} × (${INTR.each} + ${INTR.refocus}) = ${INTR.task + INTR.k * (INTR.each + INTR.refocus)} minutes. The restart cost is ${INTR.k * INTR.refocus} minutes of pure loss.`,
        },
        {
          kind: 'choice',
          body: 'A single server adds a priority lane: urgent customers jump ahead of normal ones (nobody is interrupted mid-service, and both kinds take the same time on average). What happens to the **average wait over all customers**?',
          options: [
            { text: 'It stays the same: urgent customers wait less, normal ones wait more', correct: true },
            { text: 'It goes down: urgent customers are served faster', why: 'Their gain is paid for by the normal customers they jump ahead of. The server does the same work at the same speed.' },
            { text: 'It goes up: reordering wastes time', why: 'Reordering costs nothing here; the server is just as busy.' },
          ],
          explain: 'A conservation law (Kleinrock): when jobs take the same time on average and the server never idles with work waiting, priorities redistribute waiting but don’t remove it. Only putting short jobs first lowers the average.',
        },
        {
          kind: 'match',
          body: 'Match each rule to its effect.',
          heads: ['Rule', 'Effect'],
          pairs: [
            ['First come, first served', 'Fair and predictable, but long jobs hold up short ones'],
            ['Shortest job first', 'Lowest average wait, but long jobs can starve'],
            ['Priority classes', 'Urgent work is fast; everyone else waits longer'],
            ['Round robin (take turns)', 'Everyone makes progress; everyone finishes late'],
          ],
          explain: 'There’s no free lunch: each rule decides who pays for the waiting. Pick the one whose trade-off fits what matters.',
        },
      ],
      practice: [genSJF, genFifoGap, genMultitask],
    },
  ],
};
