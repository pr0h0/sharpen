// Economic Thinking: incentives, opportunity cost and the margin, supply and demand, prices as
// signals, comparative advantage, elasticity, externalities and the commons, and where simple
// market models break down. Mechanisms, not policy verdicts; all numbers are stylised.
import type { Course, Generator, Layer } from '../types';
import { h, num, pct, pick, randInt } from '../ui';
import { barChart, columnChart, dataTable, stackBar } from '../viz/charts';
import { plotEl } from '../viz/plot';
import {
  CAFE, DEM, MUTED, OK, POL, SUP, ceilingTask, fishery, lemonsStepper, marketSpec,
  revenueTask, shiftExplorer, signalFlow, taxTask, tradeTask,
} from '../widgets/economics';

const COLOR = '#2c7be5';
/** "Q", "0.5Q", "2Q" */
const coef = (k: number) => (k === 1 ? 'Q' : `${num(k)}Q`);

// ---------------------------------------------------------------- practice: incentives

const genBounty: Generator = (rng) => {
  const b = randInt(rng, 3, 9), c = randInt(rng, 1, b - 1), n = pick(rng, [50, 100, 200, 300, 500]);
  const animal = pick(rng, ['rat tail', 'cobra skin', 'snail shell', 'locust']);
  return {
    kind: 'number', unit: '$',
    body: `A town pays a bounty of $${b} per ${animal} handed in, to cut a pest problem. Raising one at home costs about $${c}. How much profit does someone make by raising and handing in **${n}**?`,
    answer: n * (b - c), tol: 0.01,
    hint: 'Profit per animal is bounty minus cost.',
    explain: `Each one earns $${b} − $${c} = $${b - c}, so ${n} earn $${num(n * (b - c))}. While that is positive, the bounty pays people to **create** the pest it was meant to remove.`,
  };
};

const GOODHART: { setup: string; right: string; wrong: [string, string][] }[] = [
  { setup: 'A call centre ranks staff by **shortest average call length**.', right: 'Agents rush or drop hard calls',
    wrong: [['Agents spend longer solving each problem', 'That would lengthen calls and hurt their ranking: the opposite of what the target rewards.'], ['Customers start calling less', 'The target changes what agents do, not why customers call.']] },
  { setup: 'A school is judged only on the **share of students passing one exam**.', right: 'Lessons narrow to what that exam tests',
    wrong: [['Students learn more of everything', 'The measure rewards passing that exam, not broad learning, so effort flows to the exam.'], ['The exam becomes harder to pass', 'The exam hasn’t changed; behaviour around it has.']] },
  { setup: 'A hospital is judged on **minutes from arrival to being seen by a nurse**.', right: 'A nurse says hello quickly, then the real wait starts',
    wrong: [['All treatment speeds up', 'Only the measured moment is rewarded; the rest of the visit isn’t.'], ['Fewer patients arrive', 'The target changes what staff do, not how many people get ill.']] },
  { setup: 'Programmers are paid **per line of code written**.', right: 'Code gets longer and more padded',
    wrong: [['Code gets shorter and cleaner', 'Shorter code would pay less: the incentive points the other way.'], ['Bugs disappear', 'Line count says nothing about bugs; nothing rewards fixing them.']] },
  { setup: 'A sales team is rewarded for **number of contracts signed this quarter**.', right: 'Deals get split and pulled forward to hit the count',
    wrong: [['Each contract gets bigger', 'Bigger contracts don’t add to the count; more, smaller ones do.'], ['Sales next quarter rise too', 'Pulling deals forward borrows from next quarter.']] },
  { setup: 'Police units are rated on **number of crimes recorded** (fewer is better).', right: 'Some reports go unrecorded or get downgraded',
    wrong: [['Crime falls everywhere', 'Recording is cheaper to change than crime itself, so the number can fall without crime falling.'], ['More crimes get recorded', 'That would make the rating worse.']] },
];

const genGoodhart: Generator = (rng) => {
  const s = pick(rng, GOODHART);
  return {
    kind: 'choice',
    body: `${s.setup} What is the most likely side effect?`,
    options: [{ text: s.right, correct: true }, ...s.wrong.map(([text, why]) => ({ text, why }))],
    hint: 'Ask: what is the cheapest way to move the number?',
    explain: `Goodhart’s law: when a measure becomes a target, people find the cheapest way to move the measure. Here: ${s.right.toLowerCase()}.`,
  };
};

const genFine: Generator = (rng) => {
  const f = randInt(rng, 4, 40) * 500, p = pick(rng, [0.05, 0.1, 0.2, 0.25, 0.5]);
  const ef = f * p;
  let c = randInt(rng, 2, 40) * 100;
  if (c === ef) c += 100;
  const comply = ef > c;
  return {
    kind: 'choice',
    body: `A firm can fit a filter for $${num(c)} a year, or skip it and risk a $${num(f)} fine. Inspectors catch a firm that skips it with probability ${pct(p, 0)} a year. Counting **only money**, what does the firm do?`,
    options: [
      { text: 'Fit the filter', correct: comply, why: comply ? undefined : `The expected fine is only ${pct(p, 0)} × $${num(f)} = $${num(ef)}, less than the $${num(c)} filter.` },
      { text: 'Skip it and risk the fine', correct: !comply, why: comply ? `The expected fine is ${pct(p, 0)} × $${num(f)} = $${num(ef)}, more than the $${num(c)} filter.` : undefined },
    ],
    hint: 'Expected fine = chance of being caught × size of the fine.',
    explain: `Expected fine: ${pct(p, 0)} × $${num(f)} = $${num(ef)} a year, against $${num(c)} for the filter. A fine is an incentive only as big as size × probability of enforcement.`,
  };
};

// ---------------------------------------------------------------- practice: margin

const genHire: Generator = (rng) => {
  const mp: number[] = [randInt(rng, 34, 50)];
  for (let i = 1; i < 5; i++) mp.push(mp[i - 1] - randInt(rng, 4, 9));
  const price = pick(rng, [1, 2]);
  const k = randInt(rng, 1, 4); // workers to hire: the k-th worker pays, the (k+1)-th doesn't
  const wage = randInt(rng, price * mp[k] + 1, price * mp[k - 1] - 1);
  const totals = mp.reduce<number[]>((a, m) => [...a, (a[a.length - 1] ?? 0) + m], []);
  return {
    kind: 'number', unit: 'workers',
    body: `A bakery’s daily output with 1, 2, 3, 4, 5 workers is ${totals.join(', ')} loaves. Loaves sell for $${price}; each worker costs $${wage} a day. How many workers maximise profit?`,
    answer: k, tol: 0,
    hint: 'Find what each extra worker adds, and hire while that is worth more than the wage.',
    explain: `Extra loaves per worker: ${mp.join(', ')}, worth $${mp.map((m) => m * price).join(', $')}. Worker ${k} adds $${mp[k - 1] * price} > $${wage}, worker ${k + 1} only $${mp[k] * price} < $${wage}. Hire ${k}.`,
  };
};

const genOppCost: Generator = (rng) => {
  const w = randInt(rng, 12, 30), hrs = randInt(rng, 2, 6), t = pick(rng, [0, 10, 15, 25, 40]);
  const event = pick(rng, ['a festival', 'a match', 'a friend’s party', 'a talk']);
  return {
    kind: 'number', unit: '$',
    body: `Instead of working a ${hrs}-hour shift at $${w} an hour, you go to ${event}. ${t ? `The ticket costs $${t}.` : 'Entry is free.'} Working was your next-best option. What is the full cost of going?`,
    answer: w * hrs + t, tol: 0.01,
    hint: 'Money you pay plus the value of what you give up.',
    explain: `You give up ${hrs} × $${w} = $${w * hrs} of wages${t ? ` and pay $${t}` : ''}: $${w * hrs + t} in all. ${t ? '' : 'Free entry doesn’t mean free.'}`,
  };
};

const genSunk: Generator = (rng) => {
  const spent = randInt(rng, 4, 18) * 50;
  const more = randInt(rng, 3, 12) * 10;
  let worth = randInt(rng, 2, 16) * 10;
  if (worth === more) worth += 10;
  const finish = worth > more;
  const thing = pick(rng, ['a pottery course', 'a coding bootcamp', 'a season ticket', 'a language class']);
  return {
    kind: 'choice',
    body: `You paid $${spent}, non-refundable, for ${thing}. Going to the rest will cost you $${more} more in travel and materials. Looking ahead, the rest is worth about $${worth} to you. Should you go to the rest?`,
    options: [
      { text: 'Yes, go to the rest', correct: finish, why: finish ? undefined : `Going costs $${more} more and gives $${worth}. The $${spent} is gone whichever you choose, so “not wasting it” isn’t a reason.` },
      { text: 'No, stop now', correct: !finish, why: finish ? `Going gives $${worth} for $${more} more: a gain of $${worth - more}. Counting the $${spent} already spent against it is the sunk-cost mistake.` : undefined },
    ],
    hint: 'Which costs and benefits are different depending on what you choose now?',
    explain: `Only the future differs between the choices: $${worth} of value against $${more} of extra cost. The $${spent} is sunk. ${finish ? 'Go.' : 'Stop.'}`,
  };
};

// ---------------------------------------------------------------- practice: supply and demand

const genEqPoint: Generator = (rng) => {
  const q = randInt(rng, 2, 7);
  const b = pick(rng, [0.5, 1, 1.5]), d = pick(rng, [0.5, 1, 1.5]);
  const c = randInt(rng, 1, 4);
  const p = c + d * q, a = p + b * q;
  return {
    kind: 'point',
    body: `Demand: P = ${num(a)} − ${coef(b)}. Supply: P = ${c} + ${coef(d)}. Place the market equilibrium.`,
    plot: { x: [0, 12], y: [0, Math.ceil(a) + 1], ticks: [1, a > 16 ? 2 : 1], size: [400, 300], xlabel: 'Q', ylabel: 'P', layers: [
      { type: 'fn', f: (x) => a - b * x, color: DEM, label: 'Demand' },
      { type: 'fn', f: (x) => c + d * x, color: SUP, label: 'Supply' }] },
    answer: { x: q, y: p }, tol: 0.5, snap: 0.5,
    hint: 'Where the two curves cross: buyers want exactly what sellers offer.',
    explain: `Set ${num(a)} − ${coef(b)} = ${c} + ${coef(d)}: ${num(a - c)} = ${num(b + d)}Q, so Q = ${q} and P = ${c} + ${num(d * q)} = ${num(p)}.`,
  };
};

const genEqPrice: Generator = (rng) => {
  const p = randInt(rng, 3, 15), b = randInt(rng, 1, 5), d = randInt(rng, 1, 5), C = randInt(rng, 0, 20);
  const A = p * (b + d) - C;
  const q = A - b * p;
  const item = pick(rng, ['umbrellas', 'concert tickets', 'bike rentals', 'pies']);
  return {
    kind: 'number', unit: '$',
    body: `For ${item}, quantity demanded is Qd = ${A} − ${b}P and quantity supplied is Qs = ${d}P${C ? ` − ${C}` : ''}. What is the equilibrium price?`,
    answer: p, tol: 0.01,
    hint: 'Set Qd = Qs and solve for P.',
    explain: `${A} − ${b}P = ${d}P${C ? ` − ${C}` : ''} → ${A + C} = ${b + d}P → P = $${p}, where ${q} are bought and sold.`,
  };
};

const RESULTS = ['Price up, quantity up', 'Price down, quantity down', 'Price down, quantity up', 'Price up, quantity down'];
const RESULT_WHY = [
  'That’s what demand shifting right does (more wanted at every price).',
  'That’s what demand shifting left does (less wanted at every price).',
  'That’s what supply shifting right does (more offered at every price).',
  'That’s what supply shifting left does (less offered at every price).',
];
const EVENTS: { e: string; r: number; why: string }[] = [
  { e: 'A heatwave hits a beach town. What happens in the ice-cream market?', r: 0, why: 'More ice cream is wanted at every price: demand shifts right.' },
  { e: 'A cheaper way to make solar panels is invented. What happens in the solar-panel market?', r: 2, why: 'Lower costs mean more is offered at every price: supply shifts right.' },
  { e: 'A disease cuts the cocoa harvest. What happens in the chocolate market?', r: 3, why: 'Cocoa costs more, so less chocolate is offered at every price: supply shifts left.' },
  { e: 'A popular video says avocados are bad for you. What happens in the avocado market?', r: 1, why: 'Fewer avocados are wanted at every price: demand shifts left.' },
  { e: 'Petrol becomes much more expensive. What happens in the market for bicycles?', r: 0, why: 'Bikes substitute for driving, so more are wanted at every price: demand shifts right.' },
  { e: 'Wages for fruit pickers rise sharply. What happens in the strawberry market?', r: 3, why: 'Higher costs mean fewer strawberries offered at every price: supply shifts left.' },
  { e: 'A big new factory starts making phone cases. What happens in the phone-case market?', r: 2, why: 'More sellers means more offered at every price: supply shifts right.' },
  { e: 'Streaming gets cheaper and better. What happens in the market for DVDs?', r: 1, why: 'Streaming is a substitute, so fewer DVDs are wanted at every price: demand shifts left.' },
];

const genShift: Generator = (rng) => {
  const ev = pick(rng, EVENTS);
  return {
    kind: 'choice',
    body: ev.e,
    options: RESULTS.map((t, k) => (k === ev.r ? { text: t, correct: true } : { text: t, why: RESULT_WHY[k] })),
    hint: 'First decide which curve moves (buyers or sellers), then which way.',
    explain: `${ev.why} So: ${RESULTS[ev.r].toLowerCase()}.`,
  };
};

// ---------------------------------------------------------------- practice: price controls

/** Qd = A − bP, Qs = dP − C with an integer equilibrium price p and quantity q (at least 4). */
function linMarket(rng: () => number) {
  const p = randInt(rng, 6, 14), b = randInt(rng, 1, 4), d = randInt(rng, 1, 4);
  const q = randInt(rng, Math.max(4, b + 1), Math.min(30, d * p));
  const C = d * p - q, A = q + b * p;
  return { p, q, b, d, C, A, qd: (x: number) => A - b * x, qs: (x: number) => d * x - C };
}

const genShortage: Generator = (rng) => {
  const m = linMarket(rng);
  // lowest cap that keeps sellers' quantity at or above zero
  const cap = randInt(rng, Math.max(1, m.p - Math.floor(m.q / m.d)), m.p - 1);
  const gap = m.qd(cap) - m.qs(cap);
  return {
    kind: 'number', unit: 'units',
    body: `In a market, Qd = ${m.A} − ${m.b}P and Qs = ${m.d}P${m.C ? ` − ${m.C}` : ''}. The price is capped at $${cap}. How big is the shortage?`,
    answer: gap, tol: 0.01,
    hint: 'Work out how much buyers want and sellers offer at the capped price.',
    explain: `At $${cap}: buyers want ${m.A} − ${m.b * cap} = ${m.qd(cap)}, sellers offer ${m.qs(cap)}. Shortage = ${gap}. (Without the cap the price would be $${m.p}.)`,
  };
};

const genSurplus: Generator = (rng) => {
  const m = linMarket(rng);
  // highest floor that keeps buyers' quantity above zero
  const floor = randInt(rng, m.p + 1, m.p + Math.max(1, Math.min(6, Math.floor((m.q - 1) / m.b))));
  const gap = m.qs(floor) - m.qd(floor);
  return {
    kind: 'number', unit: 'units',
    body: `In a market, Qd = ${m.A} − ${m.b}P and Qs = ${m.d}P${m.C ? ` − ${m.C}` : ''}. A minimum price of $${floor} is set. How big is the surplus (unsold units)?`,
    answer: gap, tol: 0.01,
    hint: 'At the minimum price, compare what sellers offer with what buyers take.',
    explain: `At $${floor}: sellers offer ${m.qs(floor)}, buyers want ${m.qd(floor)}. Surplus = ${gap}. (The market price would be $${m.p}.)`,
  };
};

const genBinding: Generator = (rng) => {
  const m = linMarket(rng);
  const isCap = rng() < 0.5;
  let at = m.p + randInt(rng, -4, 4);
  if (at === m.p) at += 1;
  const res = isCap ? (at < m.p ? 0 : 2) : (at > m.p ? 1 : 2);
  const labels = ['A shortage', 'A surplus', 'No effect: it doesn’t bind'];
  const whys = [
    'A shortage needs a cap below the market price, so buyers want more than sellers offer.',
    'A surplus needs a minimum above the market price, so sellers offer more than buyers take.',
    'It binds here: the rule forces a price the market wouldn’t pick.',
  ];
  return {
    kind: 'choice',
    body: `With Qd = ${m.A} − ${m.b}P and Qs = ${m.d}P${m.C ? ` − ${m.C}` : ''}, the market price is $${m.p}. A ${isCap ? '**maximum** price (ceiling)' : '**minimum** price (floor)'} of $${at} is introduced. What results?`,
    options: labels.map((t, k) => (k === res ? { text: t, correct: true } : { text: t, why: whys[k] })),
    hint: 'A ceiling only matters below the market price; a floor only above it.',
    explain: res === 2
      ? `A ${isCap ? 'ceiling' : 'floor'} at $${at} is ${isCap ? 'above' : 'below'} the $${m.p} market price, so trade happens at $${m.p} as before.`
      : `At $${at}: buyers want ${Math.max(0, m.qd(at))}, sellers offer ${Math.max(0, m.qs(at))}. ${res === 0 ? 'Shortage' : 'Surplus'} of ${Math.abs(Math.max(0, m.qd(at)) - Math.max(0, m.qs(at)))}.`,
  };
};

// ---------------------------------------------------------------- practice: comparative advantage

const NAMES = [['Mia', 'Leo'], ['Ava', 'Sam'], ['Zoe', 'Raj'], ['Ivy', 'Tom']];
const GOODS = [['shirts', 'hats'], ['loaves', 'pies'], ['chairs', 'stools'], ['essays', 'posters']];

const genOppRate: Generator = (rng) => {
  const [A, B] = pick(rng, GOODS);
  const y = pick(rng, [1, 2, 3, 4, 5]), k = pick(rng, [0.5, 1.5, 2, 3, 4]);
  const x = y * k;
  if (!Number.isInteger(x)) return genOppRate(rng);
  const who = pick(rng, NAMES)[0];
  return {
    kind: 'number', unit: A,
    body: `In an hour ${who} can make ${x} ${A} or ${y} ${B}. What is ${who}’s opportunity cost of **one** of the ${B}, measured in ${A}?`,
    answer: x / y, tol: 0.01,
    hint: `An hour on ${B} gives up ${x} ${A}. Share that over the ${y} ${B} it makes.`,
    explain: `One hour = ${x} ${A} or ${y} ${B}, so each of the ${B} costs ${x} ÷ ${y} = ${num(x / y)} ${A}.`,
  };
};

const genSpecialise: Generator = (rng) => {
  const [A, B] = pick(rng, GOODS);
  const [n1, n2] = pick(rng, NAMES);
  // rates per hour; person 1 better at both (absolute advantage) half the time
  let a1 = randInt(rng, 2, 9), b1 = randInt(rng, 1, 6), a2 = randInt(rng, 1, 8), b2 = randInt(rng, 1, 6);
  if (rng() < 0.5) { a2 = randInt(rng, 1, a1 - 1); b2 = randInt(rng, 1, Math.max(1, b1 - 1)); }
  if (a1 * b2 === a2 * b1) b2 += 1; // make opportunity costs differ
  const oc1 = a1 / b1, oc2 = a2 / b2; // cost of one B in A
  const right = oc1 < oc2 ? n1 : n2;
  const other = right === n1 ? n2 : n1;
  return {
    kind: 'choice',
    body: `In an hour, ${n1} makes ${a1} ${A} or ${b1} ${B}; ${n2} makes ${a2} ${A} or ${b2} ${B}. To get the most of both, who should specialise in **${B}**?`,
    options: [
      { text: right, correct: true },
      { text: other, why: `${other} gives up ${num(right === n1 ? oc2 : oc1)} ${A} per one of the ${B}, more than ${right}’s ${num(right === n1 ? oc1 : oc2)}.` },
      { text: 'Whoever makes more of them per hour', why: 'That’s absolute advantage. What matters is who gives up less of the other good.' },
    ],
    hint: `Compare what one of the ${B} costs each of them in ${A}.`,
    explain: `One of the ${B} costs ${n1} ${num(oc1)} ${A} and ${n2} ${num(oc2)} ${A}. ${right} gives up less, so ${right} has the comparative advantage in ${B}.`,
  };
};

// ---------------------------------------------------------------- practice: elasticity

const genElasticity: Generator = (rng) => {
  const dp = pick(rng, [5, 10, 20, 25]), e = pick(rng, [0.2, 0.4, 0.5, 0.8, 1, 1.2, 1.5, 2, 3]);
  const dq = dp * e;
  if (dq >= 100 || !Number.isInteger(dq)) return genElasticity(rng);
  const item = pick(rng, ['coffee', 'bus tickets', 'gym memberships', 'cinema seats', 'phone cases']);
  return {
    kind: 'number',
    body: `When the price of ${item} rises ${dp}%, the quantity bought falls ${dq}%. What is the price elasticity of demand (as a positive number)?`,
    answer: e, tol: 0.01,
    hint: '% change in quantity ÷ % change in price.',
    explain: `${dq}% ÷ ${dp}% = ${num(e)}. ${e > 1 ? 'Above 1: elastic, so a price rise cuts revenue.' : e < 1 ? 'Below 1: inelastic, so a price rise lifts revenue.' : 'Exactly 1: revenue stays the same.'}`,
  };
};

const genRevenue: Generator = (rng) => {
  const p1 = randInt(rng, 4, 20), q1 = randInt(rng, 10, 60) * 10;
  const up = rng() < 0.5;
  const p2 = up ? p1 + randInt(rng, 1, 5) : p1 - randInt(rng, 1, Math.min(3, p1 - 1));
  let q2 = up ? q1 - randInt(rng, 1, Math.floor(q1 / 20)) * 10 : q1 + randInt(rng, 1, 20) * 10;
  if (p2 * q2 === p1 * q1) q2 += 10;
  const r1 = p1 * q1, r2 = p2 * q2;
  const res = r2 > r1 ? 0 : 1;
  const texts = ['Revenue rises', 'Revenue falls'];
  return {
    kind: 'choice',
    body: `A shop ${up ? 'raises' : 'cuts'} a price from $${p1} to $${p2}. Sales go from ${q1} to ${q2} a week. What happens to revenue?`,
    options: [
      { text: texts[res], correct: true },
      { text: texts[1 - res], why: `Multiply it out: $${p1} × ${q1} = $${num(r1)} before, $${p2} × ${q2} = $${num(r2)} after.` },
      { text: 'Can’t tell without costs', why: 'Revenue is just price × quantity; costs matter for profit, not revenue.' },
    ],
    hint: 'Revenue = price × quantity, before and after.',
    explain: `Before: $${p1} × ${q1} = $${num(r1)}. After: $${p2} × ${q2} = $${num(r2)}. ${res === 0 ? 'Up' : 'Down'} $${num(Math.abs(r2 - r1))}.`,
  };
};

const genElasticEstimate: Generator = (rng) => {
  const q0 = pick(rng, [200, 400, 600, 800, 1000]);
  let e = pick(rng, [0.5, 1, 1.5, 2]), r = pick(rng, [5, 10, 20]);
  if (e * r > 40) { e = 1; r = 10; }
  const q = q0 * (1 - (e * r) / 100);
  const tol = Math.max(5, Math.round((q0 * 0.03) / 5) * 5);
  return {
    kind: 'estimate',
    body: `A café sells ${q0} drinks a week. Its price elasticity of demand is about ${num(e)}. It raises prices ${r}%. Roughly how many drinks a week will it sell now?`,
    min: 0, max: q0, step: 5, answer: q, tol,
    format: (v) => `${v} drinks`,
    hint: 'Quantity falls by (elasticity × % price rise) percent.',
    explain: `${num(e)} × ${r}% = ${num(e * r)}% fewer drinks: ${q0} × ${num(1 - (e * r) / 100)} = ${num(q)}.`,
  };
};

// ---------------------------------------------------------------- practice: externalities

const genPigou: Generator = (rng) => {
  const c = randInt(rng, 1, 5), e = randInt(rng, 1, 4), q = randInt(rng, 2, 7);
  const a = c + e + 2 * q; // demand P = a − Q meets social cost P = c + e + Q at q
  const qm = (a - c) / 2;
  return {
    kind: 'number', unit: 'units',
    body: `Demand: P = ${a} − Q. Firms’ own cost (supply): P = ${c} + Q. Each unit also does $${e} of harm to bystanders. With a tax of $${e} per unit, how many units are made? (Without it: ${num(qm)}.)`,
    answer: q, tol: 0.01,
    hint: 'The tax lifts supply by its size: solve demand = supply + tax.',
    explain: `${a} − Q = ${c} + ${e} + Q → 2Q = ${a - c - e} → Q = ${q}. The tax makes firms face the full cost, so output falls from ${num(qm)} to ${q}.`,
  };
};

const genSustain: Generator = (rng) => {
  const K = pick(rng, [60, 120, 180, 240, 300, 600]), g = pick(rng, [1.25, 1.5, 2]);
  const catchMax = K - K / g;
  return {
    kind: 'number', unit: 'fish',
    body: `A lake holds at most ${K} fish. Each season, the fish left after fishing multiply by ${num(g)} (capped at ${K}). Starting full, what is the **largest total catch** each season that keeps the lake full year after year?`,
    answer: catchMax, tol: 0.01,
    hint: `Leave enough that × ${num(g)} gets back to ${K}.`,
    explain: `You must leave ${K} ÷ ${num(g)} = ${num(K / g)} fish, so the catch can be ${K} − ${num(K / g)} = ${num(catchMax)}. Any more and the stock shrinks every season.`,
  };
};

const EXTERNAL: { t: string; k: number }[] = [
  { t: 'A neighbour runs a leaf blower at 7 am every Sunday.', k: 0 },
  { t: 'You get a flu jab, so you can’t pass flu to others.', k: 1 },
  { t: 'A beekeeper’s bees pollinate the orchards next door.', k: 1 },
  { t: 'A factory’s smoke dirties washing in nearby gardens.', k: 0 },
  { t: 'You buy a sandwich and eat it alone at your desk.', k: 2 },
  { t: 'One more car joins a jammed road at rush hour.', k: 0 },
  { t: 'A shop owner plants flowers that brighten the whole street.', k: 1 },
  { t: 'You pay a mechanic to fix your own car.', k: 2 },
];
const genExternal: Generator = (rng) => {
  const s = pick(rng, EXTERNAL);
  const labels = ['A negative externality', 'A positive externality', 'No externality'];
  const whys = [
    'A negative externality puts a cost on someone outside the deal.',
    'A positive externality hands a benefit to someone outside the deal.',
    'Someone outside the deal is affected here, without being paid or paying.',
  ];
  return {
    kind: 'choice',
    body: `${s.t} Which is it?`,
    options: labels.map((t, k) => (k === s.k ? { text: t, correct: true } : { text: t, why: whys[k] })),
    hint: 'Is anyone outside the decision helped or harmed, with no payment either way?',
    explain: ['Bystanders bear a cost the decision-maker doesn’t pay for.', 'Bystanders get a benefit the decision-maker isn’t paid for.', 'Everyone affected is part of the deal: costs and benefits stay with the buyer and seller.'][s.k],
  };
};

// ---------------------------------------------------------------- practice: information

const genLemons: Generator = (rng) => {
  const share = pick(rng, [0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.8]);
  const G = randInt(rng, 8, 14) * 1000, L = randInt(rng, 2, 6) * 1000;
  const avg = share * G + (1 - share) * L;
  return {
    kind: 'number', unit: '$',
    body: `${pct(share, 0)} of used cars for sale are good (worth $${num(G)} to a buyer); the rest are lemons (worth $${num(L)}). Buyers can’t tell which is which. What is the most a buyer should pay for a random car?`,
    answer: avg, tol: 1,
    hint: 'The average value, weighting each kind by how common it is.',
    explain: `${num(share)} × $${num(G)} + ${num(1 - share)} × $${num(L)} = $${num(avg)}. Any good-car owner who wants more than that pulls out, which drags the average down further.`,
  };
};

const INFO: { t: string; k: number }[] = [
  { t: 'After getting full phone insurance, Jo stops using a case.', k: 1 },
  { t: 'An insurer finds its expensive plan attracts mostly people who expect big claims.', k: 0 },
  { t: 'A start-up offers a 10-year warranty that only a reliable product could afford.', k: 2 },
  { t: 'A worker paid a fixed salary and rarely checked on slows down.', k: 1 },
  { t: 'Sellers of the worst used laptops are keenest to sell at the going price.', k: 0 },
  { t: 'A restaurant pays for an expensive fit-out to show it plans to stay for years.', k: 2 },
  { t: 'A bank bails out risky lenders, who then lend even more riskily.', k: 1 },
  { t: 'People who know they are bad drivers are the first to buy full cover.', k: 0 },
];
const genInfo: Generator = (rng) => {
  const s = pick(rng, INFO);
  const labels = ['Adverse selection', 'Moral hazard', 'Signalling'];
  const whys = [
    'Adverse selection is about hidden types before a deal: the riskiest or worst are keenest to trade.',
    'Moral hazard is about hidden actions after a deal: someone takes less care because others bear the cost.',
    'Signalling is a costly action that’s cheaper for high-quality types, used to prove quality.',
  ];
  return {
    kind: 'choice',
    body: `${s.t} Which idea fits best?`,
    options: labels.map((t, k) => (k === s.k ? { text: t, correct: true } : { text: t, why: whys[k] })),
    hint: 'Before the deal (who signs up) or after (how they behave)? Or a costly proof of quality?',
    explain: whys[s.k],
  };
};

const genPremium: Generator = (rng) => {
  const nl = randInt(rng, 4, 8) * 10, nh = randInt(rng, 2, 6) * 10;
  const cl = randInt(rng, 1, 4) * 100, ch = randInt(rng, 8, 15) * 100;
  const prem = (nl * cl + nh * ch) / (nl + nh);
  return {
    kind: 'number', unit: '$',
    body: `An insurer can’t tell customers apart. ${nl} low-risk people expect $${cl} of claims a year; ${nh} high-risk people expect $${num(ch)}. If everyone buys, what premium covers the average expected claim?`,
    answer: prem, tol: 1,
    hint: 'Total expected claims ÷ number of customers.',
    explain: `(${nl} × $${cl} + ${nh} × $${num(ch)}) ÷ ${nl + nh} = $${num(Math.round(prem * 100) / 100)}. That’s more than the low-risk people expect to claim, so many of them may drop out, pushing the premium up.`,
  };
};

// ---------------------------------------------------------------- pictures used by steps

const cafe = (extra: Layer[] = [], o: Parameters<typeof marketSpec>[2] = {}) => () => plotEl(marketSpec(CAFE, extra, o));
const BAKERY = [0, 40, 70, 90, 100, 105];
const bakeryTable = () => dataTable(['Workers', 'Loaves a day', 'Extra loaves'], BAKERY.map((t, k) => [k, t, k ? t - BAKERY[k - 1] : '–']));

// ---------------------------------------------------------------- course

export const economics: Course = {
  id: 'economics',
  title: 'Economic Thinking',
  blurb: 'Incentives, trade-offs, markets and prices, and the places where simple models break.',
  color: COLOR,
  icon: '🛒',
  lessons: [
    // ============================================================ 1 incentives
    {
      id: 'incentives',
      title: 'People respond to incentives',
      goal: 'Predict how rewards and penalties change behaviour, including the unintended ways.',
      steps: [
        {
          kind: 'choice',
          body: 'A city has too many venomous cobras. It offers a cash reward for every dead cobra handed in. A few years later there are **more** cobras than before. What most likely happened?',
          options: [
            { text: 'People started breeding cobras to collect the reward', correct: true },
            { text: 'Cobras just had a good breeding season', why: 'Possible, but the reward gives a direct reason for more cobras to exist: each one is now worth money.' },
            { text: 'The reward was too small to make anyone hunt', why: 'A reward that’s too small would leave cobra numbers about where they were, not push them up.' },
          ],
          hint: 'What is a cobra worth to someone once the reward exists?',
          explain: 'Paying per dead cobra made cobras valuable. Raising them became a business. The reward paid for the thing it was meant to remove.',
        },
        {
          kind: 'read',
          title: 'The cobra effect',
          body: 'The story is told about colonial Delhi (probably embellished; a well-documented version involves rat tails in Hanoi). When officials noticed the cobra farms and scrapped the reward, breeders released their now-worthless snakes.\n\nA fix that makes the problem worse is now called the **cobra effect**.',
          widget: () => h('div', null,
            h('div', { class: 'muted small', style: 'text-align:center' }, 'Wild cobras (stylised)'),
            columnChart([
              { label: 'Before', value: 100 }, { label: 'Year 1', value: 80 }, { label: 'Year 3', value: 95 }, { label: 'Scrapped', value: 140, color: 'var(--bad)' },
            ], { format: (v) => String(v) })),
        },
        {
          kind: 'order',
          body: 'Put the cobra story in order.',
          items: ['A reward per dead cobra is announced', 'Wild cobras are hunted and handed in', 'Some people start breeding cobras for the reward', 'Officials notice and scrap the reward', 'Breeders release their worthless snakes'],
          hint: 'Each step is a reaction to the one before.',
          explain: 'Reward → hunting → breeding (the cheaper way to get rewarded) → reward scrapped → release. Each move was sensible for the people making it.',
        },
        {
          kind: 'number', unit: '$',
          body: 'A town pays **$5 per rat tail**. Raising a rat to adulthood costs a farmer about **$2**. How much profit does a farmer make from raising and handing in **200** rats?',
          answer: 600, tol: 0.01,
          hint: 'Profit per rat × number of rats.',
          explain: '$5 − $2 = $3 a rat, × 200 = $600. As long as the reward beats the cost of producing the thing rewarded, someone will produce it.',
          widget: () => dataTable(['', 'Per rat'], [['Reward', '$5'], ['Cost to raise', '$2'], ['Profit', '$3']], { highlight: [2] }),
        },
        {
          kind: 'read',
          title: 'Incentives are prices on actions',
          body: 'Anything that changes the cost or reward of an action changes how often people take it. Money is only one kind.',
          widget: () => dataTable(['Kind', 'Example'], [['Money', 'bonus, fine, bounty'], ['Time', 'carpool lane, queue'], ['Effort', 'opt-out vs opt-in forms'], ['Social', 'public rankings, praise'], ['Moral', 'guilt, duty']]),
        },
        {
          kind: 'sort',
          body: 'Does each rule make the action **costlier** or more **rewarding**?',
          bins: ['Costlier', 'More rewarding'],
          items: [
            { text: 'Littering: a $100 fine', bin: 0 },
            { text: 'Carpooling: use the fast lane', bin: 1 },
            { text: 'Driving at rush hour: a toll', bin: 0 },
            { text: 'Returning bottles: 10¢ back each', bin: 1 },
            { text: 'Free clinic: a two-hour queue', bin: 0 },
            { text: 'Shopping here: loyalty points', bin: 1 },
          ],
          hint: 'Ask whether the person taking the action gains or loses something.',
          explain: 'Fines, tolls and queues raise the cost of the action; the fast lane, deposits and points raise its reward. A queue is a price paid in time.',
        },
        {
          kind: 'choice',
          body: 'Some daycares were annoyed by parents picking children up late. They introduced a **small fine** for lateness. In a well-known study of this (Israel, 2000), what happened to late pickups?',
          options: [
            { text: 'They went up, and stayed up after the fine was dropped', correct: true },
            { text: 'They fell to almost zero', why: 'That assumes money was the only thing keeping parents on time. Guilt was doing a lot of the work.' },
            { text: 'Nothing changed', why: 'Behaviour did change, just not in the intended direction.' },
          ],
          hint: 'What did the fine say about lateness that guilt didn’t?',
          explain: 'Before, lateness felt like letting the staff down. The fine turned it into a service with a price, and a cheap one. Adding a money incentive can push out a moral one.',
        },
        {
          kind: 'read',
          title: 'Goodhart’s law',
          body: '“When a measure becomes a target, it ceases to be a good measure.”\n\nA number is useful because it tracks something you care about. Reward the number, and people find cheaper ways to move it than doing the thing.',
          widget: () => dataTable(['Target', 'Cheapest way to hit it'], [['Short calls', 'hang up on hard ones'], ['Cobras handed in', 'breed cobras'], ['Test scores', 'teach only the test']]),
        },
        {
          kind: 'match',
          body: 'A factory is rewarded on one number. Match each target to how it gets gamed.',
          heads: ['Rewarded for', 'Likely result'],
          pairs: [
            ['Number of nails made', 'Tiny, useless nails'],
            ['Total weight of nails', 'A few huge, heavy nails'],
            ['Lines of code written', 'Long, padded code'],
            ['Fewer crimes recorded', 'Reports quietly downgraded'],
          ],
          hint: 'For each, what is the cheapest way to move just that number?',
          explain: 'Count rewards many small things, weight rewards few big ones, lines reward padding, and a “fewer recorded” target rewards not recording. Each target is hit, and what you actually wanted is lost.',
        },
        {
          kind: 'multi',
          body: 'A city pays road crews **per pothole filled**. Which side effects are likely? Pick all that apply.',
          options: [
            { text: 'Quick patches that soon need filling again', correct: true },
            { text: 'Less preventive resurfacing, which would stop potholes forming', correct: true },
            { text: 'Small cracks being counted as potholes', correct: true },
            { text: 'Crews losing all reason to work', why: 'They have a strong reason to work, just on what gets counted.' },
            { text: 'Potholes becoming impossible to fix', why: 'Filling still works; the issue is what gets prioritised.' },
          ],
          hint: 'What earns more under this rule: a lasting road, or many fills?',
          explain: 'The rule rewards the number of fills, not smooth roads. Fills that don’t last, skipped prevention and generous counting all raise the count.',
        },
        {
          kind: 'fill',
          body: 'Sum up the cobra story.',
          template: 'The city paid for [[0]] but wanted fewer [[1]]. When what you pay for is only a [[2]] for what you want, people find cheaper ways to produce the measure.',
          blanks: [
            { options: ['dead cobras', 'snake bites', 'cobra farms'], answer: 0 },
            { options: ['wild cobras', 'reward claims', 'cobra hunters'], answer: 0 },
            { options: ['proxy', 'price', 'cause'], answer: 0 },
          ],
          hint: 'What was counted, and what was the goal?',
          explain: 'Dead cobras were a proxy for fewer wild cobras. Breeding produced the proxy without the goal.',
        },
        {
          kind: 'read',
          title: 'The habit',
          body: 'Before judging a rule, ask: **who gains from which action now, and what is the cheapest way to collect?** People respond to the incentive you actually created, not the one you meant.',
          widget: () => dataTable(['Rule', 'Cheapest way to collect'], [['Pay per dead cobra', 'breed cobras'], ['Fine for late pickup', 'pay and stay late'], ['Pay per pothole', 'quick patches']]),
        },
      ],
      practice: [genBounty, genGoodhart, genFine],
    },

    // ============================================================ 2 margin
    {
      id: 'margin',
      title: 'Opportunity cost and the margin',
      goal: 'Count what you give up, ignore sunk costs, and decide one unit at a time.',
      steps: [
        {
          kind: 'choice',
          body: 'A friend gives you a free concert ticket for tonight (it can’t be resold). Your other option was a shift that pays **$80**. What does going to the concert cost you?',
          options: [
            { text: '$80', correct: true },
            { text: '$0', why: 'Nothing leaves your wallet, but you give up the $80 shift. Free to get isn’t free to use.' },
            { text: '$130', why: 'The ticket’s $50 face value isn’t yours to lose: you didn’t pay it and can’t sell it.' },
          ],
          hint: 'What do you give up by going?',
          explain: 'The cost of a choice is what you give up for it: the $80 shift.',
        },
        {
          kind: 'read',
          title: 'Opportunity cost',
          body: 'The **opportunity cost** of a choice is the value of the **best** alternative you give up. Not the sum of all of them: you could only have done one.',
          widget: () => barChart([
            { label: 'Work the shift', value: 80, color: 'var(--bad)', note: '← the cost' },
            { label: 'Study', value: 30, color: MUTED },
            { label: 'Early night', value: 20, color: MUTED },
          ], { format: (v) => `$${v}` }),
        },
        {
          kind: 'number', unit: '$',
          body: 'Sam quits a job paying **$30,000** a year to study full-time for a year. Tuition is **$8,000**. Rent and food are **$12,000**, which Sam pays whether studying or working. What does the year of study really cost?',
          answer: 38000, tol: 1,
          hint: 'Count only what changes because Sam studies.',
          explain: 'Lost wages $30,000 + tuition $8,000 = $38,000. Rent and food are paid either way, so they aren’t a cost of studying.',
          widget: () => dataTable(['Item', 'Study', 'Work'], [['Wages', '$0', '$30,000'], ['Tuition', '−$8,000', '$0'], ['Rent and food', '−$12,000', '−$12,000']]),
        },
        {
          kind: 'multi',
          body: 'You take a gap year to travel. Which are part of its cost? Pick all that apply.',
          options: [
            { text: 'Wages you would have earned working', correct: true },
            { text: 'Flights and hostels', correct: true },
            { text: 'Groceries you’d buy whether or not you travel', why: 'Paid either way, so they don’t depend on the choice.' },
            { text: 'Fees you already paid last year for a course', why: 'Already spent and not refundable: sunk. Same whichever you choose.' },
          ],
          hint: 'Only what would be different if you didn’t go.',
          explain: 'Costs of a choice are the things that change with it: forgone wages and travel spending. Spending that happens either way, or already happened, doesn’t count.',
        },
        {
          kind: 'read',
          title: 'Sunk costs',
          body: 'Money already spent that you can’t get back is the **same whichever option you pick now**. So it can’t help you choose. Only future costs and benefits differ.',
          widget: () => dataTable(['', 'Keep going', 'Stop'], [['Already paid (gone)', '$300', '$300'], ['Still to pay', '$40', '$0'], ['Value from here on', '$25', '$0']], { highlight: [1, 2] }),
        },
        {
          kind: 'choice',
          body: 'Using the table above: you paid **$300** for a course. Finishing costs **$40** more and is now worth only **$25** to you. What should the $300 do to your decision?',
          options: [
            { text: 'Nothing: compare $25 with $40', correct: true },
            { text: 'Make you finish, so the $300 isn’t wasted', why: 'The $300 is gone either way. Finishing loses another $15 on top.' },
            { text: 'Make you stop, to cut your losses on the $300', why: 'Stopping is right here, but because $25 < $40, not because of the $300.' },
          ],
          hint: 'Which rows differ between the two columns?',
          explain: 'Only the future rows differ: $25 of value against $40 of cost. Stop. The $300 is identical in both columns.',
        },
        {
          kind: 'read',
          title: 'Thinking at the margin',
          body: 'Most choices aren’t all-or-nothing but **one more?** One more worker, one more hour, one more slice. Compare the **extra** benefit of the next unit with its **extra** cost.\n\nA bakery’s daily output as it hires:',
          widget: bakeryTable,
        },
        {
          kind: 'number', unit: 'loaves',
          body: 'How many extra loaves does the **3rd** worker add?',
          answer: 20, tol: 0,
          hint: 'Output with 3 workers minus output with 2.',
          explain: '90 − 70 = 20. Each new worker adds less (40, 30, 20, 10, 5): the oven and counter are shared. That’s **diminishing marginal returns**.',
          widget: bakeryTable,
        },
        {
          kind: 'choice',
          body: 'Loaves sell for **$1**. Each worker costs **$15** a day. How many workers give the most profit?',
          options: [
            { text: '2', why: 'The 3rd worker adds 20 loaves ($20) for $15. Worth hiring.' },
            { text: '3', correct: true },
            { text: '4', why: 'The 4th worker adds only 10 loaves ($10) but costs $15.' },
            { text: '5', why: 'Workers 4 and 5 each add less than they cost.' },
          ],
          hint: 'Hire while the next worker adds more than $15.',
          explain: 'Extra loaves 40, 30, 20 beat $15; the 4th adds 10. Profit: 2 workers $40, 3 workers $45, 4 workers $40.',
          widget: () => plotEl({ x: [0.4, 5.6], y: [0, 45], ticks: [1, 10], size: [400, 240], xlabel: 'worker #', ylabel: 'extra loaves', layers: [
            { type: 'bars', pts: [[1, 40], [2, 30], [3, 20], [4, 10], [5, 5]], width: 0.6, color: DEM },
            { type: 'hline', y: 15, color: 'var(--bad)', label: 'wage = 15 loaves' }] }),
        },
        {
          kind: 'estimate',
          body: 'With **4** workers, what is the **average** output per worker?',
          min: 0, max: 50, step: 1, answer: 25, tol: 1,
          format: (v) => `${v} loaves`,
          hint: 'Total loaves ÷ workers.',
          explain: '100 ÷ 4 = 25 loaves each, comfortably above the 15-loaf wage. Yet the 4th worker only added 10.',
        },
        {
          kind: 'choice',
          body: 'A manager says: “Each worker brings in 25 loaves on average and costs 15. Hire more!” What’s wrong?',
          options: [
            { text: 'The next worker adds far less than the average', correct: true },
            { text: 'Nothing: 25 is more than 15', why: 'The average includes the early, productive workers. The decision is about the next one.' },
            { text: 'The average should be 15', why: 'The average really is 25 (100 ÷ 4); the issue is that it’s the wrong number to use.' },
          ],
          hint: 'Average or marginal: which one tells you what one more worker does?',
          explain: 'Averages describe what you already have; margins describe the next step. A 5th worker adds 5 loaves for a 15-loaf wage.',
        },
        {
          kind: 'fill',
          body: 'The rules of this lesson in one line:',
          template: 'Ignore [[0]] costs. Compare the [[1]] benefit of the next unit with its [[2]] cost, including what you [[3]].',
          blanks: [
            { options: ['sunk', 'future', 'hidden'], answer: 0 },
            { options: ['marginal', 'average', 'total'], answer: 0 },
            { options: ['marginal', 'average', 'past'], answer: 0 },
            { options: ['give up', 'already paid', 'hope for'], answer: 0 },
          ],
          explain: 'Ignore sunk costs; compare marginal benefit with marginal cost; and count opportunity cost, what you give up.',
        },
      ],
      practice: [genHire, genOppCost, genSunk],
    },

    // ============================================================ 3 supply and demand
    {
      id: 'supply-demand',
      title: 'Supply and demand',
      goal: 'Find an equilibrium and predict how events move price and quantity.',
      steps: [
        {
          kind: 'choice',
          body: 'At **$10** a cup, cafés in a town would happily sell **8** thousand cups a day, but buyers only want **2** thousand. What will tend to happen to the price?',
          options: [
            { text: 'It falls', correct: true },
            { text: 'It rises', why: 'Rising prices would leave even more coffee unsold. Sellers with unsold stock cut prices.' },
            { text: 'It stays at $10', why: 'Cafés stuck with unsold coffee each have a reason to undercut the others.' },
          ],
          hint: 'What do sellers do when they can’t sell what they make?',
          explain: 'With 6 thousand cups unsold, cafés compete for buyers by cutting prices. As the price falls, buyers want more and sellers offer less.',
          widget: cafe([{ type: 'hline', y: 10, color: MUTED }, { type: 'dots', pts: [[2, 10], [8, 10]], color: 'var(--text)', labels: ['want 2', 'offer 8'] }]),
        },
        {
          kind: 'read',
          title: 'Demand slopes down',
          body: 'The **demand curve** shows how much buyers want at each price. Higher price, less wanted: fewer people find it worth it, and those who do buy less.',
          widget: cafe([{ type: 'dots', pts: [[2, 10], [7, 5]], color: DEM, labels: ['$10: 2', '$5: 7'] }], { supply: false }),
        },
        {
          kind: 'read',
          title: 'Supply slopes up',
          body: 'The **supply curve** shows how much sellers offer at each price. A higher price covers the cost of extra staff, longer hours and pricier beans, so more gets offered.',
          widget: cafe([{ type: 'dots', pts: [[2, 4], [7, 9]], color: SUP, labels: ['2k cups at $4', '7k cups at $9'] }], { demand: false }),
        },
        {
          kind: 'point',
          body: 'Place the **equilibrium**: the price where the quantity buyers want equals the quantity sellers offer.',
          plot: marketSpec(CAFE),
          answer: { x: 5, y: 7 }, tol: 0.5, snap: 0.5,
          hint: 'Where the curves cross.',
          explain: 'They cross at 5 thousand cups and $7. At that price nobody is left wanting to buy or sell at the going price, so there’s no pressure to change it.',
        },
        {
          kind: 'number', unit: 'thousand cups',
          body: 'If the price were **$9**, how many thousand cups would go unsold each day?',
          answer: 4, tol: 0,
          hint: 'Read off how much sellers offer and buyers want at $9.',
          explain: 'At $9 sellers offer 7 thousand and buyers want 3 thousand: a surplus of 4. That surplus pushes the price back down toward $7.',
          widget: cafe([{ type: 'hline', y: 9, color: MUTED, label: '$9' }]),
        },
        {
          kind: 'read',
          title: 'Shifting demand',
          body: 'A heatwave hits and people want iced coffee. Slide demand right and left. The faint curve is where it was.',
          widget: shiftExplorer(['dD']),
        },
        {
          kind: 'choice',
          body: 'A big study says coffee is good for you. What happens in this market?',
          options: [
            { text: 'Demand shifts right: price and quantity both rise', correct: true },
            { text: 'We move along the demand curve', why: 'Moving along a curve happens when the coffee’s own price changes. Here, tastes changed: buyers want more at every price.' },
            { text: 'Supply shifts right: price falls', why: 'Nothing changed for sellers’ costs. The news changes buyers.' },
          ],
          hint: 'Did buyers or sellers change?',
          explain: 'Buyers want more at every price, so demand shifts right. The new equilibrium has a higher price and a higher quantity.',
        },
        {
          kind: 'read',
          title: 'Shift vs movement along',
          body: 'A change in the good’s **own price** moves you **along** a curve. Anything else that changes how much is wanted or offered **at every price** (income, tastes, other goods’ prices, costs, technology) **shifts** the curve.',
          widget: cafe([
            { type: 'fn', f: (q) => 14 - q, color: DEM, dash: true },
            { type: 'text', x: 3.4, y: 11.9, text: 'new demand', color: DEM, anchor: 'start' },
            { type: 'arrow', from: [1.4, 10.6], to: [3, 9], color: 'var(--text)', label: 'along' },
            { type: 'arrow', from: [6, 6], to: [7.9, 6], color: POL },
            { type: 'text', x: 6.9, y: 4.6, text: 'shift', color: POL }], { supply: false }),
        },
        {
          kind: 'sort',
          body: 'In the coffee market, which curve moves?',
          bins: ['Demand shifts', 'Supply shifts', 'Neither (along a curve)'],
          items: [
            { text: 'Coffee beans get cheaper to grow', bin: 1 },
            { text: 'A popular diet bans coffee', bin: 0 },
            { text: 'Tea prices double', bin: 0 },
            { text: 'A new machine halves brewing time', bin: 1 },
            { text: 'Coffee’s price rises, so people buy less of it', bin: 2 },
            { text: 'Cafés cut prices and sell more cups', bin: 2 },
          ],
          hint: 'Buyers changing → demand. Sellers’ costs changing → supply. Coffee’s own price → along.',
          explain: 'Diet and tea prices change buyers (tea is a substitute). Beans and machines change sellers’ costs. A coffee price change by itself is a movement along both curves.',
        },
        {
          kind: 'match',
          body: 'Match each shift to what happens at the new equilibrium.',
          heads: ['Shift', 'Result'],
          pairs: [
            ['Demand shifts right', 'Price up, quantity up'],
            ['Demand shifts left', 'Price down, quantity down'],
            ['Supply shifts right', 'Price down, quantity up'],
            ['Supply shifts left', 'Price up, quantity down'],
          ],
          hint: 'Picture one curve sliding along the other.',
          explain: 'A demand shift moves price and quantity the same way; a supply shift moves them in opposite ways. That’s how you tell from data which side moved.',
        },
        {
          kind: 'task',
          body: 'Now both curves can move. Make the price rise to **$8** while the quantity stays at **5** thousand cups.',
          widget: shiftExplorer(['dD', 'dS'], (q, p) => Math.abs(q - 5) < 1e-9 && Math.abs(p - 8) < 1e-9, 'Price $8, quantity 5.'),
          hint: 'Price up with no change in quantity: one curve moves right, the other left, by the same amount.',
          explain: 'Demand shift +1 and supply shift −1. Demand right pushes price and quantity up; supply left pushes price up and quantity down. The quantity effects cancel; the price rises $1.',
        },
        {
          kind: 'read',
          title: 'The picture to keep',
          body: 'Price settles where buyers and sellers agree on quantity. To predict an event: **which curve moves, and which way?** Then read off price and quantity.',
          widget: cafe([{ type: 'dots', pts: [[5, 7]], color: 'var(--text)', r: 6, labels: ['$7, 5'] }]),
        },
      ],
      practice: [genEqPoint, genEqPrice, genShift],
    },

    // ============================================================ 4 prices as signals
    {
      id: 'signals',
      title: 'Prices as signals',
      goal: 'See what prices communicate, and what price ceilings and floors do to a market.',
      steps: [
        {
          kind: 'multi',
          body: 'A frost destroys half the oranges in one region, and the price of orange juice jumps. Which responses does the higher price encourage? Pick all that apply.',
          options: [
            { text: 'Some shoppers switch to apple juice', correct: true },
            { text: 'Growers in other regions ship more oranges there', correct: true },
            { text: 'Juice makers waste fewer oranges', correct: true },
            { text: 'The frost damage gets undone', why: 'Prices can’t make oranges; they change what people do with the oranges there are.' },
            { text: 'Everyone keeps buying exactly as before', why: 'That would need more oranges than exist. The price rise is what rations them.' },
          ],
          hint: 'What does a higher price make people want to do, as buyers and as sellers?',
          explain: 'Buyers use less, sellers elsewhere send more, and everyone is more careful with the scarce oranges. Nobody needed to be told about the frost.',
        },
        {
          kind: 'read',
          title: 'A price is a message',
          body: 'A price compresses lots of scattered information into one number. When it rises, it says “this got scarcer: use less, make more”, and it gives everyone a reason to act on it.',
          widget: signalFlow,
        },
        {
          kind: 'read',
          title: 'A price ceiling',
          body: 'A **price ceiling** is a legal maximum. Set below the equilibrium price, it stops the price rising to where buyers and sellers agree. At the capped price, buyers want more than sellers offer: a **shortage**.',
          widget: cafe([
            { type: 'hline', y: 5, color: POL, label: 'ceiling $5' },
            { type: 'line', pts: [[3, 5], [7, 5]], color: 'var(--bad)', width: 5 },
            { type: 'text', x: 5, y: 4.2, text: 'shortage', color: 'var(--bad)' }]),
        },
        {
          kind: 'number', unit: 'thousand cups',
          body: 'In the café market, a ceiling of **$4** is imposed. How big is the shortage?',
          answer: 6, tol: 0,
          hint: 'Read buyers’ and sellers’ quantities at $4.',
          explain: 'At $4 buyers want 8 thousand cups and sellers offer 2 thousand: a shortage of 6.',
          widget: cafe([{ type: 'hline', y: 4, color: POL, label: '$4' }]),
        },
        {
          kind: 'task',
          body: 'Set a ceiling that creates a shortage of exactly **4** thousand cups.',
          widget: ceilingTask(4),
          hint: 'Each $1 below $7 adds 1 to what buyers want and removes 1 from what sellers offer.',
          explain: 'A ceiling of $5: buyers want 7, sellers offer 3, shortage 4. Each $1 below $7 widens the gap by 2.',
        },
        {
          kind: 'multi',
          body: 'When a ceiling causes a shortage, what else tends to show up? Pick all that apply.',
          options: [
            { text: 'Queues and waiting lists', correct: true },
            { text: 'Resale above the ceiling on a black market', correct: true },
            { text: 'Sellers cutting quality or extras', correct: true },
            { text: 'Sellers producing more than before', why: 'At a lower price, sellers offer less, not more.' },
            { text: 'Legal prices drifting above the ceiling', why: 'That’s exactly what the law forbids; that pressure shows up as queues, quality cuts or illegal resale instead.' },
          ],
          hint: 'If price can’t ration the cups, something else must.',
          explain: 'Something has to decide who gets the scarce units: time in queues, connections, side payments, or lower quality at the same price.',
        },
        {
          kind: 'choice',
          body: 'In the same market (equilibrium $7), a ceiling of **$9** is set. What happens?',
          options: [
            { text: 'Nothing changes: the price stays at $7', correct: true },
            { text: 'A shortage, as with every ceiling', why: 'A ceiling only bites if it’s below the market price. $9 is above $7.' },
            { text: 'The price rises to $9', why: 'A ceiling is a maximum, not a target. Sellers competing still drive the price to $7.' },
          ],
          hint: 'Does a $9 limit stop anything the market was going to do?',
          explain: 'The market price of $7 is already under the cap, so the ceiling doesn’t bind.',
        },
        {
          kind: 'read',
          title: 'A price floor',
          body: 'A **price floor** is a legal minimum. Set above equilibrium, sellers offer more than buyers take: a **surplus** of unsold goods.',
          widget: cafe([
            { type: 'hline', y: 9, color: POL, label: 'floor $9' },
            { type: 'line', pts: [[3, 9], [7, 9]], color: 'var(--bad)', width: 5 },
            { type: 'text', x: 5, y: 9.8, text: 'surplus', color: 'var(--bad)' }]),
        },
        {
          kind: 'point',
          body: 'A price floor of **$8** is set. Tap the point on the **supply** curve showing how much sellers want to sell at $8.',
          plot: marketSpec(CAFE, [{ type: 'hline', y: 8, color: POL, label: 'floor $8' }]),
          answer: { x: 6, y: 8 }, tol: 0.5, snap: 0.5,
          hint: 'Follow the $8 line to where it meets the orange curve.',
          explain: 'Supply is P = 2 + Q, so at $8 sellers offer 6 thousand cups: the point (6, 8).',
        },
        {
          kind: 'number', unit: 'thousand cups',
          body: 'And at that $8 floor, how many thousand cups a day go unsold?',
          answer: 2, tol: 0,
          hint: 'Sellers offer 6. How many do buyers want at $8?',
          explain: 'Buyers want 12 − 8 = 4 thousand; sellers offer 6. Surplus of 2.',
          widget: cafe([{ type: 'hline', y: 8, color: POL, label: 'floor $8' }, { type: 'dots', pts: [[4, 8], [6, 8]], color: 'var(--text)' }]),
        },
        {
          kind: 'sort',
          body: 'What does each rule cause?',
          bins: ['Shortage', 'Surplus', 'No effect'],
          items: [
            { text: 'Ceiling below the market price', bin: 0 },
            { text: 'Floor above the market price', bin: 1 },
            { text: 'Ceiling above the market price', bin: 2 },
            { text: 'Floor below the market price', bin: 2 },
            { text: 'Rent cap set under the market rent', bin: 0 },
            { text: 'Guaranteed milk price set over the market price', bin: 1 },
          ],
          hint: 'A rule only bites when it blocks the price the market would pick.',
          explain: 'Binding ceilings (below the market price) cause shortages; binding floors (above it) cause surpluses; rules that don’t bind change nothing.',
        },
        {
          kind: 'read',
          title: 'Mechanism, not verdict',
          body: 'The model says what a price control **does**: who wants how much at the new price. Whether a control is worth it depends on goals the graph doesn’t show: who gets the units, fairness, how long it lasts, and things like market power that a simple model leaves out.',
        },
      ],
      practice: [genShortage, genSurplus, genBinding],
    },

    // ============================================================ 5 comparative advantage
    {
      id: 'trade',
      title: 'Comparative advantage',
      goal: 'Show why specialising and trading helps even when one side is better at everything.',
      steps: [
        {
          kind: 'choice',
          body: 'Two people on an island. **Ana** is better than **Ben** at both fishing and gathering coconuts. Can they both gain by specialising and trading?',
          options: [
            { text: 'Yes, if each does what they give up least to do', correct: true },
            { text: 'No: Ana gains nothing from Ben', why: 'Ana’s time is limited. Every hour she spends on coconuts is an hour of very productive fishing lost.' },
            { text: 'Only Ben gains', why: 'Trade can be arranged so both end up with more of both goods, as you’ll see.' },
          ],
          hint: 'Being better at everything doesn’t mean having time for everything.',
          explain: 'Yes. What matters is not who is better, but who gives up less to make each thing. Let’s check with numbers.',
        },
        {
          kind: 'read',
          title: 'The island',
          body: 'In one hour:',
          widget: () => dataTable(['', 'Fish', 'or Coconuts'], [['Ana', 6, 3], ['Ben', 1, 2]]),
        },
        {
          kind: 'number', unit: 'fish',
          body: 'What does **one coconut** cost **Ana**, in fish she doesn’t catch?',
          answer: 2, tol: 0.01,
          hint: 'An hour gives 6 fish or 3 coconuts.',
          explain: 'Three coconuts cost her 6 fish, so one coconut costs 2 fish.',
          widget: () => dataTable(['', 'Fish', 'or Coconuts'], [['Ana', 6, 3], ['Ben', 1, 2]], { highlight: [0] }),
        },
        {
          kind: 'number', unit: 'fish',
          body: 'And what does one coconut cost **Ben**?',
          answer: 0.5, tol: 0.01,
          hint: 'An hour gives 1 fish or 2 coconuts.',
          explain: 'Two coconuts cost him 1 fish, so one coconut costs half a fish.',
          widget: () => dataTable(['', 'Fish', 'or Coconuts'], [['Ana', 6, 3], ['Ben', 1, 2]], { highlight: [1] }),
        },
        {
          kind: 'read',
          title: 'Comparative advantage',
          body: 'Ana is faster at both (**absolute advantage**). But a coconut costs Ben only ½ fish and Ana 2 fish. Ben has the **comparative advantage** in coconuts: the lower opportunity cost. Ana has it in fish.',
          widget: () => barChart([
            { label: 'Ana', value: 2, color: DEM }, { label: 'Ben', value: 0.5, color: SUP },
          ], { title: 'Cost of one coconut, in fish', format: (v) => `${v} fish` }),
        },
        {
          kind: 'choice',
          body: 'So who should gather the coconuts?',
          options: [
            { text: 'Ben', correct: true },
            { text: 'Ana', why: 'Ana gathers coconuts faster, but each one costs her 2 fish against Ben’s ½.' },
            { text: 'Both equally', why: 'Splitting the work ignores that the same coconut costs them very different amounts of fish.' },
          ],
          explain: 'Ben: each coconut he gathers costs the island ½ fish instead of 2.',
        },
        {
          kind: 'read',
          title: 'What the island can make',
          body: 'Each line shows what one person can make in 8 hours. Together, the best mix puts Ben on coconuts first (the cheap ones), then Ana. Splitting time evenly lands **inside** the frontier: 28 fish and 20 coconuts, when 40 fish and 20 coconuts were possible.',
          widget: () => plotEl({ x: [0, 42], y: [0, 60], ticks: [8, 10], size: [400, 290], xlabel: 'coconuts', ylabel: 'fish', layers: [
            { type: 'line', pts: [[0, 48], [24, 0]], color: DEM },
            { type: 'line', pts: [[0, 8], [16, 0]], color: SUP },
            { type: 'line', pts: [[0, 56], [16, 48], [40, 0]], color: OK, width: 3 },
            { type: 'text', x: 3, y: 31, text: 'Ana alone', color: DEM, anchor: 'start' },
            { type: 'text', x: 1, y: 11, text: 'Ben alone', color: SUP, anchor: 'start' },
            { type: 'text', x: 25, y: 46, text: 'together', color: OK, anchor: 'start' },
            { type: 'dots', pts: [[20, 28], [20, 40]], color: 'var(--text)', labels: ['even split', 'possible'] }] }),
        },
        {
          kind: 'task',
          body: 'Split their hours so the island gets at least **34 fish and 21 coconuts**: more of both than the even split.',
          widget: tradeTask(34, 21),
          hint: 'Put Ben fully on coconuts. Then give Ana just enough coconut hours.',
          explain: 'Ben spends all 8 hours on coconuts (16); Ana fishes 6 hours (36 fish) and gathers 2 hours (6 coconuts): 36 fish and 22 coconuts.',
        },
        {
          kind: 'fill',
          body: 'Ana’s side of it:',
          template: 'Ana should specialise in [[0]], because one fish costs her [[1]] coconut, less than the [[2]] coconuts it costs Ben.',
          blanks: [
            { options: ['fish', 'coconuts'], answer: 0 },
            { options: ['0.5', '2', '6'], answer: 0 },
            { options: ['2', '0.5', '1'], answer: 0 },
          ],
          hint: 'Flip the coconut costs: if a coconut costs 2 fish, a fish costs ½ coconut.',
          explain: 'A fish costs Ana ½ coconut and Ben 2 coconuts. Opportunity costs are mirror images, so each person always has a comparative advantage in something.',
        },
        {
          kind: 'estimate',
          body: 'Ben trades coconuts to Ana for fish. Pick a price (fish per coconut) at which **both** gain compared with making everything themselves.',
          min: 0, max: 3, step: 0.05, answer: 1.25, tol: 0.7,
          format: (v) => `${v.toFixed(2)} fish per coconut`,
          hint: 'Ben gives up ½ fish to make a coconut; Ana gives up 2.',
          explain: 'Any price between ½ and 2 fish per coconut works: Ben gets more than the ½ fish a coconut costs him, Ana pays less than the 2 fish it would cost her.',
        },
        {
          kind: 'multi',
          body: 'Which are true? Pick all that apply.',
          options: [
            { text: 'You can have a comparative advantage without being best at anything', correct: true },
            { text: 'If opportunity costs differ, each person has a comparative advantage in something', correct: true },
            { text: 'If one person is better at everything, trade can’t help', why: 'That confuses absolute with comparative advantage: the island example is a counterexample.' },
            { text: 'Comparative advantage is fixed forever', why: 'Skills, tools and prices change, and with them who gives up less for what.' },
          ],
          explain: 'Comparative advantage is about relative costs. As long as they differ, specialising and trading can leave both sides with more.',
        },
        {
          kind: 'order',
          body: 'Order the reasoning for any two-producer trade problem.',
          items: ['Work out each person’s opportunity cost of each good', 'Find who has the lower cost for each good', 'Each specialises in their lower-cost good', 'Trade at a price between their two costs'],
          explain: 'Costs → comparison → specialise → trade at a price between the two costs, so both gain.',
        },
        {
          kind: 'read',
          title: 'Beyond the island',
          body: 'The same logic covers people, firms and countries. The model shows **total** output rising; it doesn’t say how gains are shared, or what happens to people whose jobs shift. Those are real questions the simple model leaves open.',
        },
      ],
      practice: [genOppRate, genSpecialise],
    },

    // ============================================================ 6 elasticity
    {
      id: 'elasticity',
      title: 'Elasticity',
      goal: 'Measure how strongly quantity responds to price, and what that means for revenue.',
      steps: [
        {
          kind: 'choice',
          body: 'A cinema raises its ticket price from **$10** to **$12**. Weekly ticket sales fall from **500** to **450**. What happens to its ticket revenue?',
          options: [
            { text: 'It rises', correct: true },
            { text: 'It falls', why: 'Fewer tickets, yes, but each earns more: $12 × 450 = $5,400, up from $5,000.' },
            { text: 'It stays the same', why: 'Multiply it out: $5,000 before, $5,400 after.' },
          ],
          hint: 'Revenue = price × tickets.',
          widget: () => dataTable(['', 'Price', 'Tickets a week'], [['Before', '$10', 500], ['After', '$12', 450]]),
          explain: '$10 × 500 = $5,000 before; $12 × 450 = $5,400 after. Sales fell, but by less than enough to offset the higher price.',
        },
        {
          kind: 'read',
          title: 'Revenue is a rectangle',
          body: 'On a demand graph, revenue = price × quantity is the area of the rectangle under the point. Raising the price makes it taller and thinner. Whether the area grows depends on how much thinner.',
          widget: () => plotEl({ x: [0, 100], y: [0, 10.5], ticks: [20, 1], size: [400, 270], xlabel: 'tickets sold', ylabel: 'price $', layers: [
            { type: 'line', pts: [[0, 0], [30, 0], [30, 7], [0, 7]], closed: true, color: OK, width: 1.5, fill: 'color-mix(in srgb, var(--c3) 28%, transparent)' },
            { type: 'fn', f: (x) => (100 - x) / 10, color: DEM, label: 'Demand' },
            { type: 'text', x: 15, y: 3.5, text: '$7 × 30 = $210' }] }),
        },
        {
          kind: 'number', unit: '$',
          body: 'If instead sales had fallen from 500 to **400** at the new $12 price, what would revenue be?',
          answer: 4800, tol: 0.01,
          explain: '$12 × 400 = $4,800, below the original $5,000. Same price rise, different response, opposite result.',
        },
        {
          kind: 'read',
          title: 'Elasticity',
          body: '**Price elasticity of demand** = % change in quantity ÷ % change in price (written as a positive number).\n\nCinema: sales fell 10% when price rose 20%, so 10 ÷ 20 = **0.5**.\n\n- Below 1 (**inelastic**): raising price raises revenue.\n- Above 1 (**elastic**): raising price lowers revenue.',
          widget: () => barChart([{ label: 'Price', value: 20, color: POL, note: 'up' }, { label: 'Quantity', value: 10, color: DEM, note: 'down' }], { format: (v) => `${v}%` }),
        },
        {
          kind: 'number',
          body: 'A bakery raises prices **10%** and sells **25%** fewer cakes. What is the elasticity?',
          answer: 2.5, tol: 0.01,
          hint: '% change in quantity ÷ % change in price.',
          explain: '25 ÷ 10 = 2.5: elastic. Revenue falls: roughly 1.1 × 0.75 = 0.825 of what it was.',
        },
        {
          kind: 'sort',
          body: 'Is demand for each likely to be **elastic** or **inelastic**?',
          bins: ['Elastic (responds a lot)', 'Inelastic (responds little)'],
          items: [
            { text: 'Insulin for a diabetic', bin: 1 },
            { text: 'One cereal brand among many', bin: 0 },
            { text: 'Petrol, over the next week', bin: 1 },
            { text: 'Meals at restaurants', bin: 0 },
            { text: 'Table salt', bin: 1 },
            { text: 'One airline’s seats on a busy route', bin: 0 },
          ],
          hint: 'Can buyers easily do without it or switch to something close?',
          explain: 'Close substitutes (other cereals, other airlines) and luxuries (eating out) make demand elastic. Necessities with no substitute, tiny budget items and short time horizons make it inelastic.',
        },
        {
          kind: 'match',
          body: 'Match each feature to why it changes elasticity.',
          heads: ['Feature', 'Why'],
          pairs: [
            ['Many close substitutes', 'Buyers switch easily'],
            ['A tiny share of your budget', 'The price change is barely noticed'],
            ['More time to adjust', 'Habits and equipment can change'],
            ['A necessity with no substitute', 'Buyers pay almost anything'],
          ],
          explain: 'Substitutes and time make demand more elastic; small budget shares and necessities make it less elastic.',
        },
        {
          kind: 'task',
          body: 'A cinema faces demand **Q = 100 − 10P**. Find the ticket price that makes revenue (the green rectangle) as **large as possible**.',
          widget: revenueTask(),
          hint: 'Try prices on both sides. Revenue peaks where it stops growing.',
          explain: 'At $5: 50 tickets, revenue $250, the maximum. Revenue = P(100 − 10P) = 100P − 10P², which peaks at P = 5. There, elasticity is exactly 1.',
        },
        {
          kind: 'choice',
          body: 'With the same demand (Q = 100 − 10P), the cinema charges **$8** and sells 20 tickets. To raise revenue, should it raise or cut the price?',
          options: [
            { text: 'Cut it', correct: true },
            { text: 'Raise it', why: 'At $9: 10 tickets, $90. Revenue falls: demand is elastic up here.' },
            { text: 'Either works', why: 'Check both: $7 gives $210 and $9 gives $90, against $160 now.' },
          ],
          hint: 'Compare revenue at $7 and $9 with $160 now.',
          widget: () => plotEl({ x: [0, 100], y: [0, 10.5], ticks: [20, 1], size: [400, 260], xlabel: 'tickets sold', ylabel: 'price $', layers: [
            { type: 'fn', f: (x) => (100 - x) / 10, color: DEM, label: 'Demand' },
            { type: 'dots', pts: [[20, 8]], color: 'var(--text)', r: 6, labels: ['$8, 20 tickets'] }] }),
          explain: 'At $8 revenue is $160. At $7: 30 × $7 = $210. On the upper part of a straight-line demand curve, demand is elastic, so cutting the price raises revenue.',
        },
        {
          kind: 'estimate',
          body: 'A shop sells **200** mugs a week. It estimates elasticity at **1.5**. If it raises the price **10%**, about how many mugs will it sell?',
          min: 100, max: 250, step: 5, answer: 170, tol: 5,
          format: (v) => `${v} mugs`,
          hint: 'Quantity falls by elasticity × % price rise.',
          explain: '1.5 × 10% = 15% fewer: 200 × 0.85 = 170 mugs. Revenue: 1.10 × 0.85 = 0.935 of before, so down about 6.5%.',
        },
        {
          kind: 'fill',
          body: 'The rule of thumb:',
          template: 'When demand is [[0]] (elasticity below 1), a price rise [[1]] revenue. When it is [[2]], a price rise [[3]] revenue.',
          blanks: [
            { options: ['inelastic', 'elastic'], answer: 0 },
            { options: ['raises', 'lowers'], answer: 0 },
            { options: ['elastic', 'inelastic'], answer: 0 },
            { options: ['lowers', 'raises'], answer: 0 },
          ],
          explain: 'Inelastic: quantity falls proportionally less than price rises, so revenue rises. Elastic: quantity falls proportionally more, so revenue falls.',
        },
      ],
      practice: [genElasticity, genRevenue, genElasticEstimate],
    },

    // ============================================================ 7 externalities and the commons
    {
      id: 'externalities',
      title: 'Externalities and the commons',
      goal: 'Spot costs and benefits that fall outside a deal, and see how they distort outcomes.',
      steps: [
        {
          kind: 'choice',
          body: 'A factory dumps waste into a river, harming fishers downstream. When the factory decides how much to make, whose costs does it count?',
          options: [
            { text: 'Only its own: materials, wages, energy', correct: true },
            { text: 'Its own and the fishers’', why: 'Nothing makes it pay the fishers’ losses, so they don’t show up in its accounts.' },
            { text: 'Nobody’s: firms ignore costs', why: 'Firms watch their own costs closely. It’s other people’s costs they can ignore.' },
          ],
          hint: 'Which costs show up on the factory’s bills?',
          explain: 'The fishers’ loss is real but nobody bills the factory for it, so it makes more than it would if it had to pay the full cost.',
        },
        {
          kind: 'read',
          title: 'Externalities',
          body: 'An **externality** is a cost or benefit that lands on people outside a deal, with no payment for it. Prices then miss part of the story.',
          widget: () => dataTable(['', 'Example'], [['Negative', 'pollution, noise, traffic jams'], ['Positive', 'vaccination, bees pollinating orchards']]),
        },
        {
          kind: 'sort',
          body: 'Negative or positive externality?',
          bins: ['Negative', 'Positive'],
          items: [
            { text: 'A loud party at 3 am', bin: 0 },
            { text: 'Getting vaccinated', bin: 1 },
            { text: 'A neighbour’s beautiful front garden', bin: 1 },
            { text: 'One more car in a rush-hour jam', bin: 0 },
            { text: 'Bees pollinating a nearby orchard', bin: 1 },
            { text: 'Smoking in a crowded room', bin: 0 },
          ],
          hint: 'Are the bystanders worse off or better off?',
          explain: 'Noise, congestion and smoke impose costs on others; vaccines, gardens and bees hand out benefits nobody pays for.',
        },
        {
          kind: 'read',
          title: 'Private cost vs social cost',
          body: 'Back to cafés. Say each cup also costs the neighbours **$2** (litter, noise). The **social cost** curve adds that to the cafés’ own cost. The market makes **5** thousand cups; counting the neighbours’ cost, the best amount is **less**.',
          widget: cafe([
            { type: 'fn', f: (q) => 4 + q, color: 'var(--bad)', dash: true, label: 'Social cost', to: 6.6 },
            { type: 'dots', pts: [[5, 7]], color: 'var(--text)', labels: ['market'] }]),
        },
        {
          kind: 'point',
          body: 'Place the point where **demand meets social cost**: the amount where the last cup is worth exactly what it costs everyone.',
          plot: marketSpec(CAFE, [{ type: 'fn', f: (q) => 4 + q, color: 'var(--bad)', dash: true, label: 'Social cost', to: 6.6 }]),
          answer: { x: 4, y: 8 }, tol: 0.5, snap: 0.5,
          hint: 'Where the dashed red line crosses the blue one.',
          explain: '12 − Q = 4 + Q → Q = 4, P = $8. Cups 4 to 5 are worth less to buyers than they cost everyone, counting the neighbours.',
        },
        {
          kind: 'task',
          body: 'Set a tax per cup so the market makes the amount you just found.',
          widget: taxTask(),
          hint: 'The neighbours’ cost is $2 a cup.',
          explain: 'A $2 tax lifts supply onto the social-cost curve: the market makes 4 thousand cups. Buyers pay $8, cafés keep $6.',
        },
        {
          kind: 'number', unit: '$',
          body: 'With the $2 tax, buyers pay **$8** a cup. How much of that do the cafés keep?',
          answer: 6, tol: 0.01,
          hint: 'The tax goes to the government.',
          explain: '$8 − $2 = $6. Compared with $7 before, buyers pay $1 more and sellers get $1 less: here the tax is split evenly, because the two curves are equally steep.',
        },
        {
          kind: 'read',
          title: 'A Pigouvian tax',
          body: 'Economist Arthur Pigou suggested taxing an activity by the harm it does to others. Then the people deciding face the full cost, and they choose the amount that weighs everyone’s costs against the benefits.\n\nOther tools aim at the same gap: rules and limits, tradeable permits, or bargaining between the parties. Which works best depends on the details.',
        },
        {
          kind: 'read',
          title: 'The commons',
          body: 'A shared lake, four boats. The lake holds up to 100 fish; whatever is left after fishing grows by half (up to 100). Catching 8 per boat (32 in all) leaves 68, which regrows to 100. More than that, and the lake shrinks every season.',
          widget: () => columnChart([{ label: '8 each', value: 100, color: OK }, { label: '12 each', value: 72, color: 'var(--c5)' }, { label: '16 each', value: 54, color: 'var(--bad)' }], { format: (v) => `${v} fish` }),
        },
        {
          kind: 'task',
          body: 'Fish the lake for 8 seasons. End with at least **60** fish of your own.',
          widget: fishery(60),
          hint: 'The other boats copy whatever you did last season.',
          explain: 'Catch 8 every season: the 4 boats take 32, the 68 left regrow to 100, and you end with 64. Catching 12 gets copied and empties the lake by season 4, leaving you about 45.',
        },
        {
          kind: 'choice',
          body: 'Why can fishers empty a lake even when they all know that hurts everyone?',
          options: [
            { text: 'Each fish I catch is mine, but most of each fish I leave goes to others', correct: true },
            { text: 'They don’t understand that fish regrow', why: 'Even fishers who understand it perfectly face the same pull: holding back mostly benefits the others.' },
            { text: 'They are simply irrational', why: 'Each is responding sensibly to their own incentives. The problem is the structure, not the people.' },
          ],
          hint: 'Who gets the benefit when one boat holds back?',
          explain: 'The benefit of restraint is shared; the gain from taking more is private. That’s a prisoner’s dilemma played every season: the tragedy of the commons.',
        },
        {
          kind: 'multi',
          body: 'Which can help a commons survive? Pick all that apply.',
          options: [
            { text: 'Catch limits that everyone can see are enforced', correct: true },
            { text: 'Rights to a share of the catch that can be owned or traded', correct: true },
            { text: 'Long-standing groups that monitor and sanction each other', correct: true },
            { text: 'Adding more boats so everyone gets more', why: 'More boats means more pressure on the same regrowth. It makes the problem worse.' },
          ],
          hint: 'What makes holding back pay off for the person doing it?',
          explain: 'Limits, ownership of shares, and communities that watch and punish over-fishing (studied by Elinor Ostrom) all make restraint pay off for whoever practises it.',
        },
      ],
      practice: [genPigou, genSustain, genExternal],
    },

    // ============================================================ 8 markets vs reality
    {
      id: 'reality',
      title: 'Markets vs. reality',
      goal: 'Recognise hidden information, hidden actions and signals, and what simple models leave out.',
      steps: [
        {
          kind: 'choice',
          body: 'Half the used cars for sale are good (worth **$10,000** to a buyer), half are lemons (worth **$4,000**). Buyers can’t tell which is which. What’s the most a careful buyer would pay for a random car?',
          options: [
            { text: '$4,000', why: 'That’s too cautious when half the cars are good.' },
            { text: '$7,000', correct: true },
            { text: '$10,000', why: 'Only if you knew it was good. Half the time it’s a lemon.' },
          ],
          hint: 'Average the two values.',
          widget: () => stackBar([{ label: 'Good ($10,000)', value: 50, color: OK }, { label: 'Lemons ($4,000)', value: 50, color: 'var(--c5)' }]),
          explain: '½ × $10,000 + ½ × $4,000 = $7,000.',
        },
        {
          kind: 'read',
          title: 'The market for lemons',
          body: 'Economist George Akerlof showed how hidden quality can unravel a market. Step through it.',
          widget: lemonsStepper,
        },
        {
          kind: 'number', unit: '$',
          body: 'Suppose instead **3 in 4** cars are good ($10,000) and 1 in 4 are lemons ($4,000). What would buyers pay for a random car?',
          answer: 8500, tol: 1,
          hint: '¾ × 10,000 + ¼ × 4,000.',
          widget: () => stackBar([{ label: 'Good ($10,000)', value: 75, color: OK }, { label: 'Lemons ($4,000)', value: 25, color: 'var(--c5)' }]),
          explain: '$7,500 + $1,000 = $8,500. That beats the $8,000 good-car owners want, so they stay. The market can survive when lemons are rare enough.',
        },
        {
          kind: 'multi',
          body: 'Which help a used-car market escape the lemons trap? Pick all that apply.',
          options: [
            { text: 'Dealer warranties', correct: true },
            { text: 'Independent inspections', correct: true },
            { text: 'Seller ratings and reputation', correct: true },
            { text: 'Letting sellers hide a car’s history', why: 'That widens the information gap, which is the cause of the problem.' },
            { text: 'Banning used-car sales', why: 'That removes the market rather than fixing the information gap.' },
          ],
          hint: 'The problem is buyers not knowing. What lets them know, or trust?',
          explain: 'Warranties, inspections and reputations all narrow the information gap, so good cars can fetch a good-car price.',
        },
        {
          kind: 'read',
          title: 'Moral hazard',
          body: 'Once you’re insured, part of the cost of carelessness falls on someone else, so people take a little less care. It needn’t be dishonest; incentives just shifted.',
          widget: () => dataTable(['You lose your $600 phone', 'You pay'], [['No insurance', '$600'], ['Insured, $50 excess', '$50'], ['Fully insured', '$0']], { highlight: [2] }),
        },
        {
          kind: 'choice',
          body: 'Why do many insurers make you pay the first part of each claim (an excess or deductible)?',
          options: [
            { text: 'So you still bear some cost, and keep taking care', correct: true },
            { text: 'Only to make claims more profitable', why: 'It does save money, but the main logic is keeping some of the risk with the person who controls it.' },
            { text: 'To stop risky people from buying', why: 'That’s closer to screening for adverse selection; an excess mainly targets behaviour after you’re insured.' },
          ],
          hint: 'Who decides how careful to be once the policy is signed?',
          explain: 'An excess leaves part of each loss with you, so carelessness still costs you something. That limits moral hazard.',
        },
        {
          kind: 'read',
          title: 'Signalling',
          body: 'If quality is hidden, people with high quality want to prove it. A **signal** works if it’s cheaper for high-quality types than for low ones. A long warranty is cheap to offer on a good car and ruinous on a lemon.',
          widget: () => dataTable(['Offer a 3-year warranty', 'Expected repair cost'], [['Good car', '$300'], ['Lemon', '$3,000']], { highlight: [0] }),
        },
        {
          kind: 'match',
          body: 'Match each situation to the idea.',
          heads: ['Situation', 'Idea'],
          pairs: [
            ['Buyers can’t tell good used cars from bad', 'Adverse selection'],
            ['Fully insured drivers park in riskier spots', 'Moral hazard'],
            ['A firm offers a long warranty to show it trusts its product', 'Signalling'],
            ['A farm’s pesticide drifts onto a neighbour’s hives', 'Externality'],
          ],
          hint: 'Hidden type, hidden action, costly proof, or a cost on bystanders?',
          explain: 'Hidden quality before a deal: adverse selection. Hidden behaviour after it: moral hazard. Costly proof of quality: signalling. Harm to outsiders: externality.',
        },
        {
          kind: 'sort',
          body: 'Before the deal (who signs up) or after it (how they behave)?',
          bins: ['Adverse selection (before)', 'Moral hazard (after)'],
          items: [
            { text: 'Mostly heavy users buy an all-you-can-eat plan', bin: 0 },
            { text: 'Renters of a car drive it harder than their own', bin: 1 },
            { text: 'People expecting big medical bills buy the best cover', bin: 0 },
            { text: 'A salaried worker nobody checks on slows down', bin: 1 },
            { text: 'Sellers of the worst laptops are keenest to sell', bin: 0 },
            { text: 'Insured homeowners skip fixing a leaky roof', bin: 1 },
          ],
          hint: 'Is the hidden thing who they are, or what they do?',
          explain: 'Adverse selection: the hidden thing is the type of person or product. Moral hazard: the hidden thing is an action taken after the deal.',
        },
        {
          kind: 'number', unit: '$',
          body: 'An insurer can’t tell customers apart. 50 low-risk people expect **$200** of claims a year; 50 high-risk people expect **$1,000**. It charges the average, $600. The low-risk people decide that’s too much and leave. If the insurer re-prices to the average of those left, what’s the new premium?',
          answer: 1000, tol: 1,
          hint: 'Who is left?',
          widget: () => barChart([{ label: '50 low-risk', value: 200, color: OK }, { label: '50 high-risk', value: 1000, color: 'var(--bad)' }], { title: 'Expected claims per person a year', format: (v) => `$${num(v)}` }),
          explain: 'Only high-risk customers remain, so the premium must rise to $1,000. Adverse selection can shrink a market to its riskiest members.',
        },
        {
          kind: 'read',
          title: 'What simple models leave out',
          body: 'The supply-and-demand picture assumes a lot. When an assumption fails, the conclusions can change.',
          widget: () => dataTable(['Assumes', 'When it fails'], [
            ['Everyone knows the quality', 'lemons, insurance'],
            ['No effects on outsiders', 'externalities'],
            ['Many small buyers and sellers', 'market power'],
            ['People weigh costs carefully', 'habits, biases'],
            ['Only efficiency matters', 'fairness, who gets what']]),
        },
        {
          kind: 'choice',
          body: 'So what is a simple market model good for?',
          options: [
            { text: 'A starting point: ask which assumptions fail here, and how that changes the answer', correct: true },
            { text: 'An exact forecast of what will happen', why: 'The numbers are stylised; real curves are estimated with error and shift over time.' },
            { text: 'Nothing: real markets are too messy', why: 'Simple models get directions right surprisingly often (shortages under binding caps, for instance) and show where to look.' },
          ],
          explain: 'A model is a map: useful because it leaves things out. Use it to predict directions and mechanisms, and check which simplifications matter for the case in front of you.',
        },
      ],
      practice: [genLemons, genInfo, genPremium],
    },
  ],
};
