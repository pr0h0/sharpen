// Negotiation: walk-away points, the bargaining zone, anchors, concessions, trading across issues,
// fairness, patience and deadlines, and commitment. Every number shown is computed from its rule.
import type { Choice, Course, Generator, Rng } from '../types';
import {
  BUY, MUTED, SELL, ZONE, bestExplorer, issueTable, money, offersPlot, packageBuilder, pieRounds, proposerKeeps, zopaExplorer,
  zopaPic,
} from '../widgets/negotiation';
import type { Issue } from '../widgets/negotiation';
import { barChart } from '../viz/charts';
import { pct, pick, randInt } from '../ui';

const COLOR = '#5f7d95';

const ITEMS = ['car', 'motorbike', 'piano', 'camper van', 'boat', 'vintage guitar'] as const;
const step = (rng: Rng, lo: number, hi: number, by: number) => by * randInt(rng, Math.ceil(lo / by), Math.floor(hi / by));
const mid = (a: number, b: number) => (a + b) / 2;
const ppl = (v: number) => pct(v, 1);

// ---------------------------------------------------------------- the running example
// You are selling your car. A dealer will buy it for DEALER, but you'd pay TOW to get it there.
// A private buyer could instead buy a similar car for ALT_CAR that needs ALT_FIX of repairs.

const DEALER = 6000, TOW = 150, RES = DEALER - TOW;
const ALT_CAR = 7000, ALT_FIX = 500, BMAX = ALT_CAR + ALT_FIX;
const ZOPA = BMAX - RES;
const HALF = mid(RES, BMAX);

// Job offer: another offer comes through with chance JOB_P at JOB_HI, otherwise you stay at JOB_LO.
const JOB_P = 0.6, JOB_HI = 70000, JOB_LO = 55000, JOB_EV = JOB_P * JOB_HI + (1 - JOB_P) * JOB_LO;

// Anchors: openers, and a simple walk-away model for aggressive openers.
const OPEN_YOU = 9000, OPEN_THEM = 6000, OPEN_LOW = 8200;
const WALK_FROM = 7000, WALK_SPAN = 3000;
const pWalk = (x: number) => Math.max(0, Math.min(1, (x - WALK_FROM) / WALK_SPAN));
const openEV = (x: number) => (1 - pWalk(x)) * mid(x, OPEN_THEM) + pWalk(x) * RES;
const OPEN_BEST = (() => { let b = 6000; for (let x = 6000; x <= 10000; x += 50) if (openEV(x) > openEV(b)) b = x; return b; })();

// Concessions: the buyer starts at C0 and each concession is half the last.
const C0 = 6000, C1 = 800, CR = 0.5;
const C_OFFERS = [0, 1, 2, 3].map((k) => C0 + C1 * (1 - CR ** k) / (1 - CR));
const C_LIMIT = C0 + C1 / (1 - CR);

// Multi-issue job offer.
const JOB_ISSUES: Issue[] = [
  { name: 'Salary', options: ['$60k', '$65k', '$70k'], you: [0, 20, 40], them: [30, 15, 0] },
  { name: 'Start date', options: ['in 2 weeks', 'in 1 month', 'in 2 months'], you: [0, 5, 10], them: [40, 20, 0] },
  { name: 'Remote days a week', options: ['0', '2', '4'], you: [0, 25, 50], them: [10, 5, 0] },
];
const pts = (pk: number[], who: 'you' | 'them') => pk.reduce((a, k, i) => a + JOB_ISSUES[i][who][k], 0);
const PK_MID = [1, 1, 1], PK_TRADE = [1, 0, 2];
const MID_YOU = pts(PK_MID, 'you'), MID_THEM = pts(PK_MID, 'them');
const TR_YOU = pts(PK_TRADE, 'you'), TR_THEM = pts(PK_TRADE, 'them');
const ALL_PK: number[][] = [];
for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) ALL_PK.push([a, b, c]);
const efficient = (pk: number[]) => !ALL_PK.some((q) => {
  const dy = pts(q, 'you') - pts(pk, 'you'), dt = pts(q, 'them') - pts(pk, 'them');
  return dy >= 0 && dt >= 0 && dy + dt > 0;
});
const pkName = (pk: number[]) => JOB_ISSUES.map((is, i) => is.options[pk[i]]).join(' · ');

// Earn-out.
const EARN = 100000, P_SELLER = 0.8, P_BUYER = 0.4;

// Ultimatum table: offers out of $100 and the share of responders who accept them.
const ULT_OFFERS = [10, 20, 30, 40, 50], ULT_ACCEPT = [0.3, 0.5, 0.75, 0.9, 0.97];
const ULT_EV = ULT_OFFERS.map((o, i) => (100 - o) * ULT_ACCEPT[i]);
const ULT_BEST = ULT_EV.indexOf(Math.max(...ULT_EV));
const pAccept = (x: number) => 1 / (1 + Math.exp(-(x - 25) / 6));
const ultEV = (x: number) => (100 - x) * pAccept(x);
// Responder's minimum uniform on [0, UMAX]: offer x accepted with chance x / UMAX.
const UMAX = 60, U_BEST = Math.min(50, UMAX), U_EV = (100 - U_BEST) * Math.min(1, U_BEST / UMAX);
// Joint venture: value JV, partners' alternatives JA and JB.
const JV = 10000, JA = 4000, JB = 2000, JA_GET = JA + (JV - JA - JB) / 2, JB_GET = JB + (JV - JA - JB) / 2;

// Patience.
const D = 0.8, PIE = 100;
const K2 = proposerKeeps(PIE, D, 2)[0], K3 = proposerKeeps(PIE, D, 3)[0];
const rub = (d: number) => 1 / (1 + d);
const asym = (da: number, db: number) => (1 - db) / (1 - da * db);
const DA = 0.9, DB = 0.6;

// Commitment: the buyer's maximum is equally likely to be anywhere from PL to PH.
const PL = 6000, PH = 9000;
const pBuy = (c: number) => Math.max(0, Math.min(1, (PH - c) / (PH - PL)));
const postEV = (c: number) => pBuy(c) * (c - RES);
const POST_BEST = (PH + RES) / 2;
const KNOW_EV = mid(PL, PH) - RES;
// Bluffing: claim a rival offer at BLUFF; believed with chance BP, else the buyer walks.
const BLUFF = 7400, BP = 0.5, BLUFF_EV = BP * BLUFF + (1 - BP) * RES;

// ---------------------------------------------------------------- practice: walk-away point

const genReservation: Generator = (rng) => {
  const item = pick(rng, ITEMS);
  const alt = step(rng, 3000, 15000, 500), cost = step(rng, 100, 600, 50);
  const res = alt - cost;
  let offer = res + step(rng, -400, 400, 50);
  if (offer === res) offer += 50;
  const ok = offer > res;
  const inGap = offer > res && offer < alt;
  const opts: Choice[] = [
    { text: 'Accept it', correct: ok, why: ok ? undefined : `Walking away gets you ${money(alt)} − ${money(cost)} = ${money(res)}, more than ${money(offer)}.` },
    { text: 'Turn it down', correct: !ok, why: ok ? (inGap ? `It's below the dealer's ${money(alt)}, but the dealer route costs you ${money(cost)}, so it's really worth ${money(res)}.` : `${money(offer)} beats your alternative of ${money(res)}.`) : undefined },
  ];
  return {
    kind: 'choice',
    body: `You're selling your ${item}. A dealer has made a firm offer of ${money(alt)}, but getting it to them would cost you ${money(cost)}. A private buyer offers **${money(offer)}**, final. Accept or turn it down?`,
    options: opts,
    hint: 'What would you actually end up with if you walked away?',
    explain: `Your walk-away option is worth ${money(alt)} − ${money(cost)} = ${money(res)}, so that's your reservation price. ${money(offer)} is ${ok ? 'above' : 'below'} it: ${ok ? 'take it' : 'turn it down'}.`,
  };
};

const genBatnaEV: Generator = (rng) => {
  const p = randInt(rng, 2, 8) / 10, hi = step(rng, 50000, 90000, 5000), lo = hi - step(rng, 10000, 25000, 5000);
  const ev = p * hi + (1 - p) * lo;
  return {
    kind: 'number', unit: '$',
    body: `You're negotiating a job offer. If you walk away, there's a ${pct(p, 0)} chance another company offers you ${money(hi)}; otherwise you stay in your current job at ${money(lo)}. Valued by its expected salary, what is your **BATNA** worth?`,
    answer: ev, tol: 1,
    hint: 'Weight each outcome by its chance.',
    explain: `${pct(p, 0)} × ${money(hi)} + ${pct(1 - p, 0)} × ${money(lo)} = ${money(ev)}. (A risk-averse person would value it a little lower.)`,
  };
};

const genBuyerMax: Generator = (rng) => {
  const item = pick(rng, ITEMS);
  const alt = step(rng, 3000, 15000, 500), fix = step(rng, 200, 1500, 100), extra = step(rng, 0, 400, 100);
  const max = alt + fix + extra;
  return {
    kind: 'number', unit: '$',
    body: `A buyer wants your ${item}. Their best alternative is a similar one for ${money(alt)}, but it needs ${money(fix)} of work to be as good as yours${extra ? `, plus ${money(extra)} to collect it from far away` : ''}. What's the **most** this buyer should be willing to pay you?`,
    answer: max, tol: 1,
    hint: 'What does their alternative really cost them, all in?',
    explain: `Their alternative costs ${money(alt)} + ${money(fix)}${extra ? ` + ${money(extra)}` : ''} = ${money(max)} for the same thing. Paying you more than that would be worse than walking away.`,
  };
};

// ---------------------------------------------------------------- practice: the zone

const genZopaSize: Generator = (rng) => {
  const s = step(rng, 20000, 60000, 1000), b = s + step(rng, -8000, 15000, 1000);
  const z = Math.max(0, b - s);
  const role = pick(rng, ['a delivery van', 'a small website business', 'a year of consulting', 'a used tractor']);
  return {
    kind: 'number', unit: '$',
    body: `The seller of ${role} won't go below ${money(s)}; the buyer won't go above ${money(b)}. How big is the **ZOPA** (the zone of possible agreement)? Answer 0 if there isn't one.`,
    answer: z, tol: 0.5,
    explain: b >= s
      ? `Any price from ${money(s)} to ${money(b)} beats both walk-away options: a zone ${money(z)} wide. That's the total gain the deal creates.`
      : `The buyer's maximum is ${money(s - b)} below the seller's minimum. No price works for both, so the ZOPA is 0 and no deal is the right result.`,
  };
};

const genSurplus: Generator = (rng) => {
  const s = step(rng, 4000, 20000, 100), b = s + step(rng, 600, 4000, 100), p = s + step(rng, 100, b - s - 100, 50);
  const seller = rng() < 0.5;
  return {
    kind: 'number', unit: '$',
    body: `The seller's minimum is ${money(s)} and the buyer's maximum is ${money(b)}. They agree on **${money(p)}**. How much better off than walking away is the **${seller ? 'seller' : 'buyer'}**?`,
    answer: seller ? p - s : b - p, tol: 0.5,
    explain: `Seller: ${money(p)} − ${money(s)} = ${money(p - s)}. Buyer: ${money(b)} − ${money(p)} = ${money(b - p)}. Together ${money(b - s)}, the whole zone, whatever the price.`,
  };
};

const genDealCheck: Generator = (rng) => {
  const s = step(rng, 4000, 20000, 100);
  const kind = pick(rng, ['ok', 'lowS', 'highB', 'none'] as const);
  const b = kind === 'none' ? s - step(rng, 200, 1500, 100) : s + step(rng, 500, 3000, 100);
  const p = kind === 'ok' ? s + step(rng, 100, b - s - 100, 50)
    : kind === 'lowS' ? s - step(rng, 100, 800, 50)
    : kind === 'highB' ? b + step(rng, 100, 800, 50)
    : mid(s, b);
  return {
    kind: 'choice',
    body: `The seller's walk-away price is ${money(s)}; the buyer's is ${money(b)}. A mediator proposes **${money(p)}**. Should both accept?`,
    options: [
      { text: 'Yes: both come out ahead', correct: kind === 'ok', why: kind === 'ok' ? undefined : `Check each side against their walk-away price: seller ${money(p)} vs ${money(s)}, buyer ${money(p)} vs ${money(b)}.` },
      { text: 'No: the seller would do better walking away', correct: kind === 'lowS', why: kind === 'lowS' ? undefined : p >= s ? `${money(p)} is at least the seller's ${money(s)}.` : `The seller would lose, but the real problem is bigger: there is no price that works for both.` },
      { text: 'No: the buyer would do better walking away', correct: kind === 'highB', why: kind === 'highB' ? undefined : p <= b ? `${money(p)} is within the buyer's ${money(b)}.` : `The buyer would lose, but the real problem is bigger: there is no price that works for both.` },
      { text: 'No: there is no price both should accept', correct: kind === 'none', why: kind === 'none' ? undefined : `The buyer's maximum ${money(b)} is above the seller's minimum ${money(s)}, so some prices work.` },
    ],
    explain: kind === 'none'
      ? `The buyer's maximum (${money(b)}) is below the seller's minimum (${money(s)}). Splitting the gap at ${money(p)} leaves both worse off than walking away.`
      : `A deal must sit between ${money(s)} and ${money(b)}. ${money(p)} is ${kind === 'ok' ? 'inside, so both gain' : kind === 'lowS' ? 'below the seller’s minimum' : 'above the buyer’s maximum'}.`,
  };
};

// ---------------------------------------------------------------- practice: anchors

const genMidpoint: Generator = (rng) => {
  const them = step(rng, 20000, 60000, 1000), target = them + step(rng, 4000, 20000, 1000);
  if (rng() < 0.5) {
    const you = 2 * target - them;
    return {
      kind: 'number', unit: '$',
      body: `Deals often land near the midpoint of the two opening offers. You're selling; the buyer opened at ${money(them)}. You open at ${money(you)}. If the deal lands at the midpoint, what's the price?`,
      answer: mid(you, them), tol: 0.5,
      explain: `(${money(you)} + ${money(them)}) / 2 = ${money(mid(you, them))}.`,
    };
  }
  return {
    kind: 'number', unit: '$',
    body: `Deals often land near the midpoint of the two opening offers. You're selling; the buyer opened at ${money(them)}. You'd like to end up at ${money(target)}. Where should you open, if the midpoint rule holds?`,
    answer: 2 * target - them, tol: 0.5,
    hint: 'The target is halfway between the two openers.',
    explain: `You need (opener + ${money(them)}) / 2 = ${money(target)}, so opener = 2 × ${money(target)} − ${money(them)} = ${money(2 * target - them)}. Every extra dollar on your opener moves the midpoint 50 cents.`,
  };
};

const genOpenEV: Generator = (rng) => {
  const w = step(rng, 4000, 10000, 100), deal = w + step(rng, 500, 3000, 100), q = randInt(rng, 1, 8) / 10;
  const ev = (1 - q) * deal + q * w;
  return {
    kind: 'number', unit: '$',
    body: `You plan an aggressive opening offer. You estimate a ${pct(q, 0)} chance the buyer is insulted and walks away, leaving you with your BATNA of ${money(w)}. If they stay, you expect to settle at ${money(deal)}. What's the **expected value** of this opener?`,
    answer: ev, tol: 1,
    explain: `${pct(1 - q, 0)} × ${money(deal)} + ${pct(q, 0)} × ${money(w)} = ${money(ev)}. Compare it with a softer opener's expected value before you choose.`,
  };
};

// ---------------------------------------------------------------- practice: concessions

const genGeomLimit: Generator = (rng) => {
  const o = step(rng, 3000, 20000, 500), c = step(rng, 400, 2000, 200), r = pick(rng, [0.5, 0.25]);
  const offers = [0, 1, 2, 3].map((k) => o + c * (1 - r ** k) / (1 - r));
  const lim = o + c / (1 - r);
  return {
    kind: 'number', unit: '$',
    body: `A buyer's offers so far: ${offers.map(money).join(', ')}. Each concession is ${r === 0.5 ? 'half' : 'a quarter of'} the one before. If the pattern continues forever, what price are they heading towards (their likely limit)?`,
    widget: () => offersPlot([], offers, { y: [o - c, lim + c] }),
    answer: lim, tol: 1,
    hint: `The concessions ${money(c)} + ${money(c * r)} + … form a geometric series.`,
    explain: `Total concessions: ${money(c)} / (1 − ${r}) = ${money(c / (1 - r))}. So they're converging on ${money(o)} + ${money(c / (1 - r))} = ${money(lim)}. Shrinking steps say "I'm near my limit".`,
  };
};

const genSplit: Generator = (rng) => {
  const res = step(rng, 5000, 20000, 100);
  const you = res + step(rng, -600, 1500, 100), them = you - step(rng, 400, 2000, 200);
  const sp = mid(you, them);
  const ok = sp >= res;
  return {
    kind: 'choice',
    body: `You're selling, with a walk-away price of ${money(res)}. You're asking ${money(you)}; the buyer is at ${money(them)} and says "Let's just split the difference." Should you agree?`,
    options: [
      { text: `Yes: ${money(sp)} is above my walk-away price`, correct: ok, why: ok ? undefined : `The split is ${money(sp)}, below your ${money(res)}.` },
      { text: `No: ${money(sp)} is below my walk-away price`, correct: !ok, why: ok ? `${money(sp)} is at least your ${money(res)}. It may not be the best you could get, but it beats walking away.` : undefined },
      { text: 'Yes: splitting the difference is always fair', why: 'A split is only as fair as the two positions it starts from, and it can fall outside your reservation price.' },
    ],
    explain: `The split is (${money(you)} + ${money(them)}) / 2 = ${money(sp)}. Compare it with your walk-away price, ${money(res)}, not with how fair it sounds.`,
  };
};

const genNextConcession: Generator = (rng) => {
  const first = step(rng, 800, 4000, 400), r = pick(rng, [0.5, 0.75]);
  const cs = [first, first * r, first * r * r];
  return {
    kind: 'number', unit: '$',
    body: `The other side's concessions so far: ${cs.map(money).join(', then ')}. Each is the same fraction of the one before. If the pattern holds, how big is their **next** concession?`,
    answer: first * r ** 3, tol: 0.5,
    explain: `Each concession is ${pct(r, 0)} of the last: ${money(cs[2])} × ${r} = ${money(first * r ** 3)}. All future concessions add up to only ${money(cs[2] * r / (1 - r))}: they're signalling they're close to their limit.`,
  };
};

// ---------------------------------------------------------------- practice: several issues

const genLogroll: Generator = (rng) => {
  for (;;) {
    const names = pick(rng, [['price', 'delivery date'], ['rent', 'lease length'], ['salary', 'remote days'], ['price', 'warranty']]);
    const v = () => step(rng, 0, 60, 5);
    const you = [[0, v()], [0, v()]], them = [[v(), 0], [v(), 0]];
    const pks = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const tot = pks.map(([a, b]) => you[0][a] + you[1][b] + them[0][a] + them[1][b]);
    const best = Math.max(...tot);
    if (tot.filter((t) => t === best).length !== 1) continue;
    const label = ([a, b]: number[]) => `${names[0]}: ${a ? 'your way' : 'their way'}, ${names[1]}: ${b ? 'your way' : 'their way'}`;
    const bi = tot.indexOf(best);
    return {
      kind: 'choice',
      body: `Two issues, ${names[0]} and ${names[1]}; each can go your way or their way. Going your way on ${names[0]} is worth ${you[0][1]} points to you and costs them ${them[0][0]}; on ${names[1]}, ${you[1][1]} to you and ${them[1][0]} to them. Which package creates the **most total points**?`,
      options: pks.map((pk, i) => ({
        text: label(pk), correct: i === bi,
        why: i === bi ? undefined : `Together that's ${tot[i]} points, less than ${best}.`,
      })),
      hint: 'On each issue, give it to whichever side values it more.',
      explain: `Settle each issue in favour of whoever values it more: ${names[0]} ${you[0][1] > them[0][0] ? 'your way' : 'their way'} (${you[0][1]} vs ${them[0][0]}), ${names[1]} ${you[1][1] > them[1][0] ? 'your way' : 'their way'} (${you[1][1]} vs ${them[1][0]}). Total: ${best} points. Then bargain over how to share them.`,
    };
  }
};

const genContingent: Generator = (rng) => {
  const x = step(rng, 20000, 200000, 10000), ps = randInt(rng, 5, 9) / 10, pb = randInt(rng, 1, Math.round(ps * 10) - 1) / 10;
  return {
    kind: 'number', unit: '$',
    body: `You're buying a firm. The seller is sure sales will boom; you're not. You agree to pay a bonus of ${money(x)} next year **only if** sales hit the target. The seller thinks that's ${pct(ps, 0)} likely; you think ${pct(pb, 0)}. How much more is the bonus worth to the seller (in their expectation) than it costs you (in yours)?`,
    answer: (ps - pb) * x, tol: 1,
    explain: `Seller values it at ${pct(ps, 0)} × ${money(x)} = ${money(ps * x)}. You expect to pay ${pct(pb, 0)} × ${money(x)} = ${money(pb * x)}. The gap, ${money((ps - pb) * x)}, is value created by betting on your disagreement instead of arguing about it.`,
  };
};

// ---------------------------------------------------------------- practice: fairness

const genUltTable: Generator = (rng) => {
  const offers = [10, 20, 30, 40, 50];
  for (;;) {
    const acc = offers.map(() => randInt(rng, 1, 99) / 100).sort((a, b) => a - b);
    if (new Set(acc).size < 5) continue;
    const ev = offers.map((o, i) => (100 - o) * acc[i]);
    const best = Math.max(...ev);
    if (ev.filter((e) => Math.abs(e - best) < 1).length !== 1) continue;
    const bi = ev.indexOf(best);
    return {
      kind: 'choice',
      body: `You propose how to split $100; if the responder rejects, both get nothing. From past games, the share of responders who accept each offer: ${offers.map((o, i) => `$${o}: ${pct(acc[i], 0)}`).join(', ')}. Which offer gives you the **highest expected payoff**?`,
      options: offers.map((o, i) => ({
        text: `Offer $${o}`, correct: i === bi,
        why: i === bi ? undefined : `You'd keep $${100 - o} × ${pct(acc[i], 0)} = ${money(ev[i])} on average, less than ${money(best)}.`,
      })),
      ordered: true,
      hint: 'For each offer: what you keep × the chance it’s accepted.',
      explain: `Expected payoffs: ${offers.map((o, i) => `$${o} → ${money(ev[i])}`).join(', ')}. Best: offer $${offers[bi]}.`,
    };
  }
};

const genSurplusSplit: Generator = (rng) => {
  const a = step(rng, 1000, 8000, 500), b = step(rng, 1000, 8000, 500), v = a + b + step(rng, 1000, 10000, 1000);
  const ga = a + (v - a - b) / 2;
  const who = rng() < 0.5 ? 'A' : 'B';
  return {
    kind: 'number', unit: '$',
    body: `Two partners can earn ${money(v)} together. Alone, A would earn ${money(a)} and B ${money(b)}. They agree to split the **gain from working together** equally. How much does **${who}** get in total?`,
    answer: who === 'A' ? ga : v - ga, tol: 0.5,
    hint: 'First find the gain: the joint value minus both alternatives.',
    explain: `Gain = ${money(v)} − ${money(a)} − ${money(b)} = ${money(v - a - b)}, so ${money((v - a - b) / 2)} each on top of their alternatives: A gets ${money(ga)}, B gets ${money(v - ga)}.`,
  };
};

const genUniformMin: Generator = (rng) => {
  const pie = pick(rng, [100, 200, 1000]), m = pie * pick(rng, [0.3, 0.4, 0.6, 0.8, 1]);
  const x = Math.min(pie / 2, m), ev = (pie - x) * Math.min(1, x / m);
  return {
    kind: 'number', unit: '$',
    body: `You propose a split of ${money(pie)}. The responder accepts if your offer is at least their private minimum, which is equally likely to be anything from $0 to ${money(m)}. So an offer of x is accepted with chance x / ${money(m)} (or for sure once x ≥ ${money(m)}). What's your **best possible expected payoff**?`,
    answer: ev, tol: 0.5,
    hint: `Expected payoff = (${money(pie)} − x) × chance of acceptance. Try a few offers.`,
    explain: m > pie / 2
      ? `(${money(pie)} − x) × x / ${money(m)} peaks at x = ${money(pie / 2)}, giving ${money(pie - x)} × ${pct(x / m)} = ${money(ev)}.`
      : `Below ${money(m)} the payoff (${money(pie)} − x) × x / ${money(m)} keeps rising, so offer exactly ${money(m)}: accepted for sure, and you keep ${money(ev)}.`,
  };
};

// ---------------------------------------------------------------- practice: patience

const DELTAS = [0.5, 0.6, 0.75, 0.8, 0.9];

const genFinite: Generator = (rng) => {
  const T = randInt(rng, 2, 4), d = pick(rng, DELTAS), pie = pick(rng, [100, 1000]);
  const keep = proposerKeeps(pie, d, T);
  return {
    kind: 'number', unit: '$',
    body: `A and B split ${money(pie)}, taking turns to propose; A goes first. After each rejection the pie shrinks to ${pct(d, 0)} of its size. There are at most ${T} rounds: if the round-${T} offer is rejected, both get nothing. Each accepts any offer at least as good as what waiting would bring. How much does **A** keep?`,
    answer: keep[0], tol: 0.01,
    hint: `Start at round ${T}: whoever proposes there keeps everything. Then work back.`,
    explain: `Working back from round ${T}, the proposer keeps: ${keep.map((k, t) => `round ${t + 1}: ${money(k)}`).reverse().join(', ')}. A offers B exactly what B would keep as proposer in round 2, and keeps ${money(keep[0])}.`,
  };
};

const genRubinstein: Generator = (rng) => {
  const d = pick(rng, [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 0.95]);
  return {
    kind: 'number', prob: true,
    body: `Two equally patient sides take turns proposing how to split a pie, with no deadline. Every round of delay shrinks the pie to ${pct(d, 0)} of its size. What **share** does the first proposer get?`,
    answer: rub(d), tol: 0.006,
    hint: 'The first proposer gets 1 / (1 + d), where d is the fraction left after a round of delay.',
    explain: `1 / (1 + ${d}) = ${pct(rub(d))}. The first-mover edge is ${pct(rub(d) - 0.5)} above half, and it shrinks as delay gets cheaper.`,
  };
};

const genAsym: Generator = (rng) => {
  const da = pick(rng, [0.5, 0.6, 0.7, 0.8, 0.9]), db = pick(rng, [0.5, 0.6, 0.7, 0.8, 0.9]);
  return {
    kind: 'number', prob: true,
    body: `Alternating offers with no deadline; A proposes first. Each round of delay leaves A with ${pct(da, 0)} of what the deal was worth to them, and B with ${pct(db, 0)}. A's share is (1 − d_B) / (1 − d_A × d_B). What **share** does A get?`,
    answer: asym(da, db), tol: 0.006,
    explain: `(1 − ${db}) / (1 − ${da} × ${db}) = ${num4(1 - db)} / ${num4(1 - da * db)} = ${pct(asym(da, db))}. ${da > db ? 'A is more patient, and patience pays.' : da < db ? 'B is more patient, which eats into A’s first-mover edge.' : 'Equal patience: only the first-mover edge remains.'}`,
  };
};
const num4 = (v: number) => String(+v.toFixed(4));

// ---------------------------------------------------------------- practice: commitment

const genPosted: Generator = (rng) => {
  const s = step(rng, 2000, 10000, 100), lo = s + step(rng, 0, 1000, 100), hi = lo + step(rng, 2000, 6000, 200);
  const c = (hi + s) / 2, ev = ((hi - c) / (hi - lo)) * (c - s);
  const askEV = rng() < 0.5;
  return {
    kind: 'number', unit: '$',
    body: `You'll name one take-it-or-leave-it price and stick to it. Your walk-away value is ${money(s)}. The buyer's maximum is equally likely to be anything from ${money(lo)} to ${money(hi)}; they buy if your price is at or below it. ${askEV ? 'At the best price, what is your **expected gain** over walking away?' : 'What price maximises your **expected gain** over walking away?'}`,
    answer: askEV ? ev : c, tol: 1,
    hint: `Expected gain at price c = chance they buy × (c − ${money(s)}) = (${money(hi)} − c) / ${money(hi - lo)} × (c − ${money(s)}).`,
    explain: `The gain (${money(hi)} − c)(c − ${money(s)}) peaks halfway between ${money(s)} and ${money(hi)}: c = ${money(c)}. They buy with chance ${pct((hi - c) / (hi - lo))}, so the expected gain is ${money(ev)}.`,
  };
};

const genBluff: Generator = (rng) => {
  const w = step(rng, 4000, 12000, 100), honest = w + step(rng, 400, 1500, 100), claim = honest + step(rng, 300, 1500, 100);
  const p = randInt(rng, 3, 8) / 10;
  const ev = p * claim + (1 - p) * w;
  const better = ev > honest;
  if (Math.abs(ev - honest) < 1) return genBluff(rng);
  return {
    kind: 'choice',
    body: `Bargaining honestly, you expect to settle at ${money(honest)}. Or you could claim a rival offer you don't have, at ${money(claim)}. You think the buyer believes you and pays ${money(claim)} with chance ${pct(p, 0)}; otherwise they call it and walk, leaving you with your BATNA of ${money(w)}. Counting money only, which has the higher expected value?`,
    options: [
      { text: 'Bluffing', correct: better, why: better ? undefined : `${pct(p, 0)} × ${money(claim)} + ${pct(1 - p, 0)} × ${money(w)} = ${money(ev)}, less than ${money(honest)}.` },
      { text: 'Bargaining honestly', correct: !better, why: better ? `The bluff averages ${money(ev)}, more than ${money(honest)}, in money alone (before any cost to your reputation).` : undefined },
    ],
    explain: `Bluff: ${pct(p, 0)} × ${money(claim)} + ${pct(1 - p, 0)} × ${money(w)} = ${money(ev)}, against ${money(honest)} for sure. ${better ? 'The bluff wins on paper, but only before counting the cost of being caught lying, which follows you into every later deal.' : 'The risk of losing the deal outweighs the extra price.'}`,
  };
};

// ---------------------------------------------------------------- course

export const negotiation: Course = {
  id: 'negotiation',
  title: 'Negotiation',
  blurb: 'Know your walk-away point, find the zone, anchor, trade and commit: bargaining by the numbers.',
  color: COLOR,
  icon: '🤝',
  lessons: [
    // ============================================================ 1 walk-away point
    {
      id: 'batna',
      title: 'Your walk-away point',
      goal: 'Find your BATNA and turn it into a reservation price.',
      steps: [
        {
          kind: 'choice',
          body: `You're selling your car. A dealer has made a firm offer of **${money(DEALER)}**, good all week. A private buyer offers **${money(DEALER - 200)}**, final. What do you do?`,
          options: [
            { text: 'Turn it down and sell to the dealer', correct: true },
            { text: 'Accept: a bird in the hand', why: `The dealer's offer is just as certain, and ${money(200)} better.` },
            { text: 'Accept if the buyer seems nice', why: 'Nice is pleasant, but it doesn’t change the arithmetic: you can get more elsewhere.' },
          ],
          explain: `No deal is better than a bad deal. Any offer below what you can get by walking away is a bad deal.`,
        },
        {
          kind: 'read',
          title: 'BATNA',
          body: `Your **BATNA** is your **B**est **A**lternative **T**o a **N**egotiated **A**greement: what you'll do if this deal falls through. Here: sell to the dealer.\n\nYour **reservation price** (walk-away price) is the worst deal you'd still accept. It comes straight from your BATNA: you should accept anything better than your alternative, and nothing worse.\n\nNegotiation power starts here, before anyone says a word.`,
          widget: () => barChart([
            { label: 'dealer (BATNA)', value: DEALER, color: SELL },
            { label: 'private offer', value: DEALER - 200, color: BUY },
          ], { format: money }),
        },
        {
          kind: 'number', unit: '$',
          body: `A catch: the dealer is across town and your car needs a tow to get there, costing **${money(TOW)}**. What is your reservation price now?`,
          answer: RES, tol: 0.5,
          hint: 'What would you actually end up with if you walked away?',
          explain: `Walking away nets ${money(DEALER)} − ${money(TOW)} = ${money(RES)}. That, not the dealer's headline number, is your walk-away price.`,
        },
        {
          kind: 'choice',
          body: `The private buyer now offers **${money(RES + 50)}**. Accept?`,
          options: [
            { text: 'Yes: it beats my real alternative', correct: true },
            { text: `No: it's below the dealer's ${money(DEALER)}`, why: `The dealer route costs you ${money(TOW)}, so it's really worth ${money(RES)}.` },
            { text: 'No: always hold out for more', why: 'You may push for more, but if this is truly final, turning it down leaves you worse off.' },
          ],
          explain: `${money(RES + 50)} > ${money(RES)}, so this deal beats walking away. It might not be the best possible price, but it clears the bar.`,
        },
        {
          kind: 'number', unit: '$',
          body: `Not every BATNA is certain. You're negotiating a job offer. If you walk away, there's a **${pct(JOB_P, 0)}** chance another company offers you ${money(JOB_HI)}; otherwise you stay in your current job at ${money(JOB_LO)}. What is your BATNA worth, as an expected salary?`,
          answer: JOB_EV, tol: 1,
          hint: 'Weight each outcome by its chance.',
          explain: `${pct(JOB_P, 0)} × ${money(JOB_HI)} + ${pct(1 - JOB_P, 0)} × ${money(JOB_LO)} = ${money(JOB_EV)}. If you dislike the risk, your walk-away salary can sensibly sit a bit lower.`,
        },
        {
          kind: 'choice',
          body: `The employer offers ${money(JOB_EV - 4000)}. Your friend says: "Take it. It's ${money(JOB_EV - 4000 - JOB_LO)} more than you earn now!" What's the flaw?`,
          options: [
            { text: 'It compares with the current job, not with the real alternative', correct: true },
            { text: 'Nothing: more money is more money', why: `Turning it down isn't the same as staying put: it gives you a ${pct(JOB_P, 0)} shot at ${money(JOB_HI)}, worth ${money(JOB_EV)} on average.` },
            { text: 'Salary offers should always be refused the first time', why: 'There’s no such rule. Compare the offer with your BATNA.' },
          ],
          explain: `The bar to clear is the value of walking away, ${money(JOB_EV)}, and ${money(JOB_EV - 4000)} falls short of it. (You might still take it if you strongly dislike the uncertainty.)`,
        },
        {
          kind: 'number', unit: '$',
          body: `Now the buyer's side. Their best alternative to your car is a similar one for ${money(ALT_CAR)} that needs ${money(ALT_FIX)} of repairs to be as good as yours. What's the **most** they should pay you?`,
          answer: BMAX, tol: 0.5,
          explain: `Their alternative really costs ${money(ALT_CAR)} + ${money(ALT_FIX)} = ${money(BMAX)}. That's the buyer's reservation price: above it, they're better off walking away.`,
        },
        {
          kind: 'sort',
          body: 'You want a raise. Sort each thought.',
          bins: ['BATNA', 'Reservation price', 'Neither'],
          items: [
            { text: 'If they say no, I take the offer from the other firm', bin: 0 },
            { text: 'If they say no, I keep my current job', bin: 0 },
            { text: 'I’ll accept nothing less than a 6% raise', bin: 1 },
            { text: 'My walk-away number is $72k', bin: 1 },
            { text: 'I’d love a 15% raise', bin: 2 },
            { text: 'I deserve more than my colleague', bin: 2 },
          ],
          hint: 'A BATNA is something you would do. A reservation price is a line you won’t cross. Hopes and grievances are neither.',
          explain: 'The BATNA is a plan (what happens if no deal); the reservation price is the number that plan implies. A wish (15%) is an aspiration, useful for opening but not a walk-away point.',
        },
        {
          kind: 'multi',
          body: 'Which of these **strengthen** your position before you negotiate to sell your car? Select all that apply.',
          options: [
            { text: 'Getting a second dealer to bid', correct: true },
            { text: 'Finding a dealer who collects the car for free', correct: true },
            { text: 'Telling the buyer how much you love the car', why: 'That changes nothing about your alternatives, and it hints you might be reluctant to walk away... or eager to sell.' },
            { text: 'Remembering what you paid for it', why: 'What you paid is sunk. Your walk-away point depends on what you can get now.' },
          ],
          explain: `Both real options raise what you get by walking away, which raises your reservation price. (A free tow alone lifts it from ${money(RES)} to ${money(DEALER)}.)`,
        },
        {
          kind: 'choice',
          body: 'Your BATNA is weak: no other buyers, and you need the money this week. The buyer asks, "Do you have other offers?" What’s the best answer?',
          options: [
            { text: 'Don’t lie, but don’t volunteer it: steer back to why the car is worth the price', correct: true },
            { text: '"No, I really need to sell this week."', why: 'That tells them your reservation price is low, and they’ll offer near it.' },
            { text: '"Yes, three people offered more."', why: 'Inventing offers is a lie that can collapse the deal if they call it (lesson 8 runs the numbers).' },
          ],
          explain: 'A weak BATNA is information worth protecting. A strong one is worth letting them know about. Either way, keep it true.',
        },
        {
          kind: 'fill',
          body: 'In one line:',
          template: 'Your [[0]] is what you do if talks fail. It sets your [[1]] price: accept any deal [[2]] than it, and walk away from anything worse.',
          blanks: [
            { options: ['BATNA', 'target', 'opening offer'], answer: 0 },
            { options: ['reservation', 'asking', 'list'], answer: 0 },
            { options: ['better', 'fairer', 'faster'], answer: 0 },
          ],
          explain: 'BATNA → reservation price → the line between deals worth taking and deals worth leaving.',
        },
      ],
      practice: [genReservation, genBatnaEV, genBuyerMax],
    },

    // ============================================================ 2 the bargaining zone
    {
      id: 'zopa',
      title: 'The bargaining zone',
      goal: 'Find the ZOPA, see what a price does to each side, and recognise when no deal is right.',
      steps: [
        {
          kind: 'choice',
          body: `You (the seller) won't go below **${money(RES)}**. The buyer won't go above **${money(BMAX)}**. Neither knows the other's number. Is a deal possible?`,
          options: [
            { text: `Yes: any price from ${money(RES)} to ${money(BMAX)} beats both walk-away options`, correct: true },
            { text: 'Only if one side reveals their number', why: 'Revealing helps find it, but whether a deal is possible depends only on the two numbers.' },
            { text: 'No: they want to pay less than you want to receive', why: `Wanting isn't the test. The buyer would pay up to ${money(BMAX)}, more than your minimum.` },
          ],
          explain: 'Between the seller’s minimum and the buyer’s maximum, every price leaves both better off than walking away.',
        },
        {
          kind: 'read',
          title: 'ZOPA',
          body: `The **zone of possible agreement** runs from the seller's reservation price to the buyer's. Its width is the **surplus**: the total gain the deal creates.\n\nWhere the price lands inside the zone decides **who** gets that gain. Haggling is a fight over the zone, not over the whole price.`,
          widget: () => zopaPic({ s: RES, b: BMAX, range: [5000, 8500] }),
        },
        {
          kind: 'number', unit: '$',
          body: 'How wide is this ZOPA?',
          widget: () => zopaPic({ s: RES, b: BMAX, range: [5000, 8500] }),
          answer: ZOPA, tol: 0.5,
          explain: `${money(BMAX)} − ${money(RES)} = ${money(ZOPA)}. That's the gain to be shared.`,
        },
        {
          kind: 'number', unit: '$',
          body: `You agree on **${money(7000)}**. How much better off than walking away are **you**, the seller?`,
          answer: 7000 - RES, tol: 0.5,
          explain: `${money(7000)} − ${money(RES)} = ${money(7000 - RES)}. The buyer gains ${money(BMAX)} − ${money(7000)} = ${money(BMAX - 7000)}. Together: ${money(ZOPA)}, the whole zone.`,
        },
        {
          kind: 'task',
          body: 'Slide the price to split the surplus **exactly evenly**.',
          widget: zopaExplorer({ s: RES, b: BMAX, range: [5000, 8500], step: 25, start: 7400, goal: (p) => p === HALF, goalText: 'Equal gains: the midpoint of the zone.' }),
          hint: 'Both gains must equal half the zone.',
          explain: `Each side gains ${money(ZOPA / 2)} at ${money(HALF)}, the midpoint of ${money(RES)} and ${money(BMAX)}. Notice the total never changes as you slide.`,
        },
        {
          kind: 'point',
          body: 'Place the price at which **you** (the seller) gain **twice** as much as the buyer.',
          plot: { x: [5500, 8000], ticks: [500], tickFormat: money, size: [460, 80], layers: [{ type: 'dots', pts: [[RES, 0], [BMAX, 0]], color: MUTED, labels: ['your min', 'their max'] }] },
          answer: { x: (RES + 2 * BMAX) / 3 }, tol: 50, snap: 50,
          hint: `Your gain is two thirds of the ${money(ZOPA)} zone.`,
          explain: `You get ⅔ × ${money(ZOPA)} = ${money(ZOPA * 2 / 3)}, so the price is ${money(RES)} + ${money(ZOPA * 2 / 3)} = ${money((RES + 2 * BMAX) / 3)}. The buyer keeps ${money(ZOPA / 3)}.`,
        },
        {
          kind: 'multi',
          body: `Which of these prices could both sides sensibly accept? (Seller's minimum ${money(RES)}, buyer's maximum ${money(BMAX)}.)`,
          options: [
            { text: money(RES - 50), why: `Below the seller's ${money(RES)}: they'd rather tow it to the dealer.` },
            { text: money(6000), correct: true },
            { text: money(7400), correct: true },
            { text: money(BMAX + 100), why: `Above the buyer's ${money(BMAX)}: they'd rather buy the other car and fix it.` },
          ],
          ordered: true,
          explain: `Anything from ${money(RES)} to ${money(BMAX)} works for both. The buyer would love ${money(6000)} and you'd love ${money(7400)}, but both clear the bars.`,
        },
        {
          kind: 'choice',
          body: `A different buyer can go no higher than **${money(5600)}**; you still won't go below ${money(RES)}. They suggest meeting in the middle at ${money(mid(5600, RES))}. What should happen?`,
          widget: () => zopaPic({ s: RES, b: 5600, range: [5000, 6500] }),
          options: [
            { text: 'No deal: there is no price that’s good for both', correct: true },
            { text: `Agree at ${money(mid(5600, RES))}: it's fair`, why: `You'd get ${money(RES - mid(5600, RES))} less than walking away, and they'd pay ${money(mid(5600, RES) - 5600)} more than their limit. Both lose.` },
            { text: 'Keep haggling until someone gives in', why: 'Haggling can’t create a zone that isn’t there. One side would end up worse off than their alternative.' },
          ],
          explain: 'When the buyer’s maximum is below the seller’s minimum, the deal would destroy value. Walking away is the success here, not a failure.',
        },
        {
          kind: 'sort',
          body: 'Deal possible, or not? (Seller’s minimum first, then buyer’s maximum.)',
          bins: ['Zone exists', 'No zone'],
          items: [
            { text: 'Flat: landlord’s min $1,400/month, tenant’s max $1,550', bin: 1550 >= 1400 ? 0 : 1 },
            { text: 'Laptop: seller’s min $500, buyer’s max $450', bin: 450 >= 500 ? 0 : 1 },
            { text: 'Salary: candidate’s min $68k, firm’s max $72k', bin: 72 >= 68 ? 0 : 1 },
            { text: 'Contract: supplier’s min $9,000, client’s max $8,200', bin: 8200 >= 9000 ? 0 : 1 },
          ],
          explain: 'There’s a zone exactly when the buyer’s maximum is at least the seller’s minimum. (For a job, the candidate is the seller.)',
        },
        {
          kind: 'number', unit: '$',
          body: `Before meeting the buyer, you find a second dealer who'll pay **${money(6600)}** and collect the car for free. How wide is the ZOPA now?`,
          answer: BMAX - 6600, tol: 0.5,
          explain: `Your reservation price rises to ${money(6600)}, so the zone shrinks to ${money(BMAX)} − ${money(6600)} = ${money(BMAX - 6600)}. A smaller zone, but every dollar of it is above ${money(6600)}: a better BATNA moves the whole fight in your favour.`,
        },
        {
          kind: 'choice',
          body: 'Which statement about the ZOPA is true?',
          options: [
            { text: 'The deal price decides who gains, not how much is gained in total', correct: true },
            { text: 'A higher price creates more total value', why: 'Every dollar the seller gains, the buyer loses. The total is fixed by the two reservation prices.' },
            { text: 'Both sides usually know where the zone is', why: 'Usually neither does: each knows only their own reservation price. Much of negotiation is estimating the other’s.' },
          ],
          explain: 'On a single issue like price, the total gain is fixed at the width of the zone. (Lesson 5 shows how adding issues can grow it.)',
        },
      ],
      practice: [genZopaSize, genSurplus, genDealCheck],
    },

    // ============================================================ 3 anchors
    {
      id: 'anchors',
      title: 'Anchors and first offers',
      goal: 'Choose a first offer that pulls the deal your way without scaring the other side off.',
      steps: [
        {
          kind: 'choice',
          body: `You're selling the car. You know cars like it go for about ${money(7000)}. Should you make the first offer, or wait for the buyer?`,
          options: [
            { text: 'Make it: a well-informed first offer pulls the talks towards it', correct: true },
            { text: 'Always wait: whoever names a number first loses', why: 'That old rule mostly protects people who don’t know the value. When you do, going first sets the anchor.' },
            { text: 'It makes no difference', why: 'Experiments repeatedly find final prices track first offers.' },
          ],
          explain: 'First offers act as anchors: counter-offers and final prices drift towards them. If you know the value well, you usually want to set the anchor.',
        },
        {
          kind: 'read',
          title: 'The midpoint rule of thumb',
          body: `Once both sides have opened, many deals land near the **middle** of the two opening numbers. That makes your opener a lever: every extra dollar on it moves the expected deal by about **50 cents**.\n\nYou open at ${money(OPEN_YOU)}; the buyer opens at ${money(OPEN_THEM)}. Midpoint: ${money(mid(OPEN_YOU, OPEN_THEM))}.`,
          widget: () => offersPlot([OPEN_YOU], [OPEN_THEM], { y: [5500, 9500], extra: [{ type: 'hline', y: mid(OPEN_YOU, OPEN_THEM), color: ZONE, dash: true, label: 'midpoint' }] }),
        },
        {
          kind: 'number', unit: '$',
          body: `Suppose you'd opened at ${money(OPEN_LOW)} instead of ${money(OPEN_YOU)}, and the buyer still opened at ${money(OPEN_THEM)}. Where does the midpoint rule predict the deal?`,
          answer: mid(OPEN_LOW, OPEN_THEM), tol: 0.5,
          explain: `(${money(OPEN_LOW)} + ${money(OPEN_THEM)}) / 2 = ${money(mid(OPEN_LOW, OPEN_THEM))}: ${money(mid(OPEN_YOU, OPEN_THEM) - mid(OPEN_LOW, OPEN_THEM))} less, for a ${money(OPEN_YOU - OPEN_LOW)} softer opener.`,
        },
        {
          kind: 'choice',
          body: `So why not open at ${money(20000)}?`,
          options: [
            { text: 'An absurd opener can make the buyer walk away or stop trusting you', correct: true },
            { text: 'No reason: the midpoint would be higher', why: 'Only if they stay. Far outside their zone, many buyers leave, and you’re back to your BATNA.' },
            { text: 'Anchors only work on inexperienced buyers', why: 'Anchoring affects experts too, from estate agents to judges. The limit is credibility, not experience.' },
          ],
          explain: 'An opener should be ambitious but defensible: something you can justify with reasons (comparable sales, condition, extras).',
        },
        {
          kind: 'read',
          title: 'Ambition has a price',
          body: `A simple model. If you open at ${money(WALK_FROM)} or below, the buyer always stays. Each ${money(WALK_SPAN / 10)} above that adds a 10% chance they walk (gone for sure by ${money(WALK_FROM + WALK_SPAN)}), leaving you your BATNA of ${money(RES)}. If they stay, you settle at the midpoint with their ${money(OPEN_THEM)}.\n\nExpected value = P(stay) × midpoint + P(walk) × ${money(RES)}.`,
        },
        {
          kind: 'number', unit: '$',
          body: `In this model, what's the expected value of opening at ${money(OPEN_YOU)}?`,
          answer: openEV(OPEN_YOU), tol: 1,
          hint: `P(walk) = (${money(OPEN_YOU)} − ${money(WALK_FROM)}) / ${money(WALK_SPAN)}.`,
          explain: `P(walk) = ${pct(pWalk(OPEN_YOU))}. If they stay you get ${money(mid(OPEN_YOU, OPEN_THEM))}. EV = ${pct(1 - pWalk(OPEN_YOU))} × ${money(mid(OPEN_YOU, OPEN_THEM))} + ${pct(pWalk(OPEN_YOU))} × ${money(RES)} = ${money(openEV(OPEN_YOU))}. Less than a safe ${money(WALK_FROM)} opener, which gets ${money(openEV(WALK_FROM))}.`,
        },
        {
          kind: 'task',
          body: 'Find the opening offer with the **highest expected value** in this model.',
          widget: bestExplorer({
            f: openEV, x: [6000, 10000], y: [5800, 6800], step: 50, start: 9500, goal: true, near: 50,
            label: 'opener', xlabel: 'your opening offer', ylabel: 'expected price', fmtX: money, ticks: [1000, 200],
            readout: (x) => `P(walk) ${pct(pWalk(x), 0)} · if they stay ${money(mid(x, OPEN_THEM))} · EV ${money(openEV(x))}`,
            goalText: 'The sweet spot between too timid and too greedy.',
          }),
          hint: 'Below the knee, raising your opener is free. Above it, each step trades a higher price for more risk.',
          explain: `The best opener is about ${money(OPEN_BEST)}, worth ${money(openEV(OPEN_BEST))} on average: ambitious enough to move the midpoint, modest enough that most buyers stay.`,
        },
        {
          kind: 'choice',
          body: 'You open at **$7,350** rather than **$7,000**. Research on precise offers suggests what?',
          options: [
            { text: 'Precise numbers get smaller counter-offers: they look carefully calculated', correct: true },
            { text: 'Round numbers are stronger anchors', why: 'Round numbers invite round counters ("how about $6,000?"). Precise ones suggest you’ve done the maths.' },
            { text: 'Precision only matters for prices over $1 million', why: 'The effect shows up for cars, houses and salaries alike.' },
          ],
          explain: 'Precise first offers tend to be adjusted less, because they signal research. They work best when you can back them up.',
        },
        {
          kind: 'choice',
          body: `The buyer opens first, at an insulting **${money(3000)}**. What's the best response?`,
          options: [
            { text: 'Don’t counter from their number: say it’s far off and put your own, justified number on the table', correct: true },
            { text: `Counter halfway between their offer and your ideal`, why: `That accepts their anchor as the reference point and drags the midpoint towards ${money(3000)}.` },
            { text: 'Walk out immediately', why: 'Maybe they’re testing you. Reanchoring keeps a possibly good deal alive.' },
          ],
          explain: 'Treat an extreme anchor as noise, not as half of a midpoint. Re-anchor with your own number and the reasons behind it.',
        },
        {
          kind: 'choice',
          body: 'When is it wise to let the other side open first?',
          options: [
            { text: 'When you have little idea what the thing is worth', correct: true },
            { text: 'Never', why: 'If you badly misjudge the value, your own opener could leave money on the table. Their offer is information.' },
            { text: 'When you have a strong BATNA', why: 'A strong BATNA makes going first safer, not riskier.' },
          ],
          explain: 'Going first helps when your information is good. With poor information, their opener teaches you about the zone, and you can still reanchor.',
        },
        {
          kind: 'order',
          body: 'Put the preparation for an opening offer in order.',
          items: [
            'Work out your BATNA',
            'Turn it into a reservation price',
            'Estimate the other side’s reservation price',
            'Pick an ambitious opener you can justify',
            'Plan how far and how fast you’ll concede',
          ],
          explain: 'Walk-away first, then the zone, then the opener inside (or at the far edge of) that zone, then the concession plan.',
        },
      ],
      practice: [genMidpoint, genOpenEV],
    },

    // ============================================================ 4 concessions
    {
      id: 'concessions',
      title: 'Concessions and splitting the difference',
      goal: 'Read a concession pattern, and know when “split the difference” helps you.',
      steps: [
        {
          kind: 'estimate',
          body: `The buyer's offers so far: ${C_OFFERS.slice(0, 4).map(money).join(', ')}. Where do you think their limit is?`,
          widget: () => offersPlot([], C_OFFERS, { y: [5800, 8000] }),
          min: 7000, max: 9000, step: 50, answer: C_LIMIT, tol: 150, format: money,
          explain: `Each concession is half the last (${money(C1)}, ${money(C1 * CR)}, ${money(C1 * CR * CR)}…). Those add up to ${money(C1)} / (1 − ${CR}) = ${money(C1 / (1 - CR))}, so they're closing in on ${money(C_LIMIT)}.`,
        },
        {
          kind: 'read',
          title: 'Concessions talk',
          body: `Each concession tells the other side something. **Big, then shrinking** says "I'm near my limit". **Equal steps** say "there's more where that came from". A **big late concession** says "my first numbers weren't serious".\n\nA geometric pattern (each step a fixed fraction r of the last) adds up to first step / (1 − r).`,
          widget: () => offersPlot([9000, 8200, 7800, 7600], C_OFFERS, { y: [5800, 9300] }),
        },
        {
          kind: 'number', unit: '$',
          body: `Your own concessions so far: ${money(1000)}, then ${money(500)}, then ${money(250)}. If you keep halving, how much **more** in total can you still give up from here?`,
          answer: 250 * 0.5 / (1 - 0.5), tol: 0.5,
          hint: 'The next steps are 125, 62.50, …',
          explain: `${money(125)} + ${money(62.5)} + … = ${money(125)} / (1 − ½) = ${money(250)}. Shrinking steps protect you: the buyer can see the end is near.`,
        },
        {
          kind: 'choice',
          body: 'The buyer asks you for a concession. You can give it in one of two ways. Which is stronger?',
          options: [
            { text: '"If you can collect it this weekend, I can come down $200."', correct: true },
            { text: '"Fine, I’ll come down $200."', why: 'A free concession teaches them that pushing works, and you get nothing back.' },
            { text: 'Neither: never concede', why: 'Deals need movement. The point is to trade concessions, not hand them out.' },
          ],
          explain: 'Make concessions conditional: "if you…, then I…". You get something for each dollar, and they learn that every ask has a price.',
        },
        {
          kind: 'read',
          title: 'Splitting the difference',
          body: `"Let's split the difference" sounds fair: each side moves the same amount. But the split lands halfway between the **current positions**, so it rewards whoever started (and stayed) more extreme.\n\nIf both sides always concede equal amounts, the deal ends at the midpoint of the **opening offers**: lesson 3's rule, again.`,
        },
        {
          kind: 'number', unit: '$',
          body: `Seller A opens at ${money(9000)}, seller B (same car) at ${money(7500)}. Each faces a buyer who opens at ${money(6000)}, and each pair trades equal concessions until they meet. How much more does seller A get?`,
          answer: mid(9000, 6000) - mid(7500, 6000), tol: 0.5,
          explain: `A meets at ${money(mid(9000, 6000))}, B at ${money(mid(7500, 6000))}: a gap of ${money(mid(9000, 6000) - mid(7500, 6000))}, half the difference in their openers. "Equal concessions" is only fair if the starting points were.`,
        },
        {
          kind: 'choice',
          body: `You're asking ${money(6200)}; the buyer is at ${money(5400)} and offers to split the difference. Your walk-away price is ${money(RES)}. Agree?`,
          options: [
            { text: `No: the split, ${money(mid(6200, 5400))}, is below my walk-away price`, correct: true },
            { text: 'Yes: meeting in the middle is fair', why: `Fair-sounding or not, ${money(mid(6200, 5400))} leaves you ${money(RES - mid(6200, 5400))} worse off than the dealer.` },
            { text: `Yes: it's only ${money(RES - mid(6200, 5400))} below my limit`, why: 'Any amount below your reservation price is a loss compared with walking away.' },
          ],
          explain: 'Always check a proposed split against your reservation price, not against how reasonable it sounds.',
        },
        {
          kind: 'choice',
          body: `You're at ${money(7600)}; they're at ${money(7200)}, and they suggest splitting the difference at ${money(7400)}. Their offers so far have been ${C_OFFERS.slice(0, 3).map(money).join(', ')}, ${money(7200)}. You're fine with ${money(7400)}. What's the smartest move?`,
          options: [
            { text: `Accept, or counter just under ${money(7600)} if you think there's room`, correct: true },
            { text: `Insist on ${money(7600)} and threaten to walk`, why: `A walk-out threat over the last ${money(7600 - 7400)} risks a deal that already beats your BATNA by ${money(7400 - RES)}.` },
            { text: `Propose splitting again, at ${money(7300)}`, why: 'That splits towards their side. You’d be conceding, not splitting.' },
          ],
          explain: `${money(7400)} is ${money(7400 - RES)} above your walk-away price. Splitting is a fine closing move when the remaining gap is small relative to the gains on the table.`,
        },
        {
          kind: 'multi',
          body: 'Which are good concession habits? Select all that apply.',
          options: [
            { text: 'Make each concession smaller than the last', correct: true },
            { text: 'Ask for something in return', correct: true },
            { text: 'Give your biggest concession first to build goodwill', why: 'A big first move signals lots of room and invites more pushing.' },
            { text: 'Concede quickly to avoid awkward silences', why: 'Silence costs nothing. Fast concessions signal impatience.' },
          ],
          explain: 'Shrinking, conditional concessions signal that you’re near your limit and make each one buy something.',
        },
        {
          kind: 'match',
          body: 'Match each concession pattern to what it signals.',
          heads: ['Pattern', 'Signal'],
          pairs: [
            ['$1,000, $500, $250, $125', 'Close to the limit'],
            ['$500, $500, $500, $500', 'Plenty of room left'],
            ['$100, $100, $2,000', 'Earlier offers weren’t serious'],
            ['$0, $0, $0', 'Committed, or bluffing'],
          ],
          explain: 'Patterns are read as messages, whether you mean them or not. Plan yours deliberately.',
        },
        {
          kind: 'fill',
          body: 'In one line:',
          template: 'Make concessions [[0]] and [[1]]. Splitting the difference lands at the midpoint of the [[2]], so it favours whoever started more [[3]].',
          blanks: [
            { options: ['shrinking', 'equal', 'growing'], answer: 0 },
            { options: ['conditional', 'generous', 'early'], answer: 0 },
            { options: ['current positions', 'reservation prices', 'true values'], answer: 0 },
            { options: ['extreme', 'honest', 'patient'], answer: 0 },
          ],
          explain: 'Shrinking and conditional concessions; and remember that a split is only as fair as its starting points.',
        },
      ],
      practice: [genGeomLimit, genSplit, genNextConcession],
    },

    // ============================================================ 5 several issues
    {
      id: 'logrolling',
      title: 'Trading across issues',
      goal: 'Create value by trading issues the sides value differently, before you divide it.',
      steps: [
        {
          kind: 'choice',
          body: 'Two sisters argue over the last orange. They cut it in half. One squeezes her half for juice and throws away the peel; the other grates her half’s peel for a cake and throws away the fruit. What went wrong?',
          options: [
            { text: 'They split the orange instead of asking what each wanted it for', correct: true },
            { text: 'Nothing: half each is fair', why: 'Fair, but wasteful. Each could have had all of what she wanted.' },
            { text: 'One sister should have just given in', why: 'No one needed to lose. Their interests didn’t even conflict.' },
          ],
          explain: 'Arguing over positions ("I want the orange") hid compatible interests (juice vs peel). Each could have had 100% of what she needed.',
        },
        {
          kind: 'read',
          title: 'Bigger pie, then slice it',
          body: `With one issue (price), every gain for you is a loss for them. With **several issues**, the sides usually care about them **differently**, and that lets you trade: give ground where it's cheap for you and valuable to them, and take it where the reverse holds. This is **logrolling**.\n\nA job offer, in points for you and for the employer:`,
          widget: () => issueTable(JOB_ISSUES),
        },
        {
          kind: 'number',
          body: `The obvious compromise: the middle option on every issue (${pkName(PK_MID)}). How many points does it give **both sides together**?`,
          widget: () => issueTable(JOB_ISSUES),
          answer: MID_YOU + MID_THEM, tol: 0,
          explain: `You get ${JOB_ISSUES.map((is) => is.you[1]).join(' + ')} = ${MID_YOU}; they get ${JOB_ISSUES.map((is) => is.them[1]).join(' + ')} = ${MID_THEM}. Together ${MID_YOU + MID_THEM}.`,
        },
        {
          kind: 'task',
          body: `Find a package that beats the compromise by **at least 10 points for each side**: you at least ${MID_YOU + 10}, them at least ${MID_THEM + 10}.`,
          widget: packageBuilder(JOB_ISSUES, (y, t) => y >= MID_YOU + 10 && t >= MID_THEM + 10, 'Both sides beat the compromise.'),
          hint: 'Which issue matters most to you but little to them? Which is the reverse?',
          explain: `${pkName(PK_TRADE)}: you get ${TR_YOU}, they get ${TR_THEM}. You concede the start date (cheap for you, precious to them) and win remote days (precious to you, cheap for them).`,
        },
        {
          kind: 'number',
          body: `How many total points did that trade **create**, compared with the compromise?`,
          answer: TR_YOU + TR_THEM - (MID_YOU + MID_THEM), tol: 0,
          explain: `${TR_YOU} + ${TR_THEM} = ${TR_YOU + TR_THEM}, against ${MID_YOU + MID_THEM}: ${TR_YOU + TR_THEM - MID_YOU - MID_THEM} points that splitting each issue down the middle left on the table.`,
        },
        {
          kind: 'choice',
          body: 'Looking at the table, which issue should you be most willing to give up?',
          widget: () => issueTable(JOB_ISSUES),
          options: [
            { text: 'Start date', correct: true },
            { text: 'Remote days', why: `That's your most valuable issue (up to ${JOB_ISSUES[2].you[2]} points) and costs them at most ${JOB_ISSUES[2].them[0]}.` },
            { text: 'Salary', why: `Salary is about equally valuable to both (${JOB_ISSUES[0].you[2]} vs ${JOB_ISSUES[0].them[0]}), so trading it creates little.` },
          ],
          explain: `Start date costs you at most ${JOB_ISSUES[1].you[2]} points but is worth up to ${JOB_ISSUES[1].them[0]} to them: a ${JOB_ISSUES[1].them[0] / JOB_ISSUES[1].you[2]}-to-1 exchange rate in their favour, so it's the best thing to give.`,
        },
        {
          kind: 'multi',
          body: 'A package is **efficient** if no other package gives one side more without giving the other less. Which of these are efficient? Select all that apply.',
          options: [PK_MID, PK_TRADE, [2, 0, 2], [0, 0, 2], [0, 2, 2]].map((pk) => ({
            text: `${pkName(pk)} (${pts(pk, 'you')} / ${pts(pk, 'them')})`,
            correct: efficient(pk),
            why: efficient(pk) ? undefined : (() => {
              const q = ALL_PK.find((x) => pts(x, 'you') >= pts(pk, 'you') && pts(x, 'them') >= pts(pk, 'them') && pts(x, 'you') + pts(x, 'them') > pts(pk, 'you') + pts(pk, 'them'))!;
              return `${pkName(q)} gives ${pts(q, 'you')} / ${pts(q, 'them')}: at least as good for both.`;
            })(),
          })),
          hint: 'For each, look for a package that’s at least as good for both sides.',
          explain: 'The efficient packages here all give the start date to them and remote days to you; they differ only in salary, which simply moves points from one side to the other.',
        },
        {
          kind: 'sort',
          body: 'Creating value or claiming value?',
          bins: ['Creating value', 'Claiming value'],
          items: [
            { text: 'Asking why they want an early start', bin: 0 },
            { text: 'Trading start date for remote days', bin: 0 },
            { text: 'Adding a bonus tied to a result you disagree about', bin: 0 },
            { text: 'Anchoring high on salary', bin: 1 },
            { text: 'Holding out for the last $1,000', bin: 1 },
            { text: 'Shrinking your concessions', bin: 1 },
          ],
          explain: 'Creating value grows what’s available to share (interests, trades, contingencies). Claiming decides who gets it (anchors, concessions, patience). Do the first before the second.',
        },
        {
          kind: 'choice',
          body: 'Should you settle the issues one at a time (salary first, then start date, then remote days) or negotiate them as a package?',
          options: [
            { text: 'As a package: trades need several issues on the table at once', correct: true },
            { text: 'One at a time: it keeps things simple', why: 'Settled issues can’t be traded any more. Each becomes a separate tug of war.' },
            { text: 'Start with the hardest issue', why: 'The order isn’t the problem; separating them is.' },
          ],
          explain: 'Keep everything open until the end ("nothing is agreed until everything is agreed") so you can trade across issues.',
        },
        {
          kind: 'number', unit: '$',
          body: `Differences in **forecasts** can be traded too. You're buying a firm. The seller is sure sales will boom (${pct(P_SELLER, 0)} chance of hitting a target); you think it's ${pct(P_BUYER, 0)}. You add a ${money(EARN)} bonus paid only if the target is hit. How much more is it worth to the seller, by their estimate, than it costs you, by yours?`,
          answer: (P_SELLER - P_BUYER) * EARN, tol: 1,
          explain: `Seller: ${pct(P_SELLER, 0)} × ${money(EARN)} = ${money(P_SELLER * EARN)}. You: ${pct(P_BUYER, 0)} × ${money(EARN)} = ${money(P_BUYER * EARN)}. The ${money((P_SELLER - P_BUYER) * EARN)} gap is value both of you see, created by a **contingent** deal instead of an argument about the future.`,
        },
        {
          kind: 'match',
          body: 'Match each difference between the sides to a way of trading on it.',
          heads: ['Difference', 'Trade'],
          pairs: [
            ['Different priorities', 'Logroll: give each side its key issue'],
            ['Different forecasts', 'Contingent bonus or earn-out'],
            ['Different attitudes to risk', 'Fixed fee for one side, variable for the other'],
            ['Different time preferences', 'Pay less now and more later'],
          ],
          explain: 'Differences are the raw material of value creation. Similar sides can only split; different sides can trade.',
        },
      ],
      practice: [genLogroll, genContingent],
    },

    // ============================================================ 6 fairness
    {
      id: 'fairness',
      title: 'Fairness and the ultimatum game',
      goal: 'Price in how people react to unfair offers, and split gains by a principled rule.',
      steps: [
        {
          kind: 'choice',
          body: `You propose how to split $100 with a stranger; if they reject, both get nothing. From past games, the share of responders who accept each offer is: ${ULT_OFFERS.map((o, i) => `$${o}: ${pct(ULT_ACCEPT[i], 0)}`).join(', ')}. Which offer earns you the most on average?`,
          options: ULT_OFFERS.map((o, i) => ({
            text: `Offer $${o}`, correct: i === ULT_BEST,
            why: i === ULT_BEST ? undefined : `$${100 - o} × ${pct(ULT_ACCEPT[i], 0)} = ${money(ULT_EV[i])} on average, less than ${money(ULT_EV[ULT_BEST])}.`,
          })),
          ordered: true,
          hint: 'For each offer: what you keep × the chance it’s accepted.',
          explain: `Expected payoffs: ${ULT_OFFERS.map((o, i) => `$${o} → ${money(ULT_EV[i])}`).join(', ')}. Offering $${ULT_OFFERS[ULT_BEST]} wins: generous enough to be accepted, not so generous it gives the pot away.`,
        },
        {
          kind: 'read',
          title: 'Rejection is a real risk',
          body: `Pure self-interest says a responder accepts any positive offer. Real people often reject offers they find insulting, paying to punish unfairness. So a proposer's expected payoff is\n\n**(pot − offer) × P(accept)**\n\nand the best offer balances the two. (The Strategy course shows the "rational" prediction; here we price in the people.)`,
          widget: () => barChart(ULT_OFFERS.map((o, i) => ({ label: `offer $${o}`, value: ULT_EV[i], color: i === ULT_BEST ? ZONE : MUTED })), { format: money, title: 'your expected payoff' }),
        },
        {
          kind: 'task',
          body: 'A smoother version: the chance an offer is accepted rises steeply around $25. Find the offer with the **highest expected payoff**.',
          widget: bestExplorer({
            f: ultEV, x: [0, 60], y: [0, 80], step: 1, start: 10, goal: true, near: 1,
            label: 'offer', xlabel: 'your offer ($ of 100)', ylabel: 'expected payoff $', fmtX: money, ticks: [10, 20],
            readout: (x) => `P(accept) ${pct(pAccept(x), 0)} · you keep ${money(100 - x)} · expected ${money(ultEV(x))}`,
            goalText: 'That’s the best balance.',
          }),
          hint: 'Below the steep part you lose too many rejections; above it you’re giving money away.',
          explain: (() => { let b = 0; for (let x = 0; x <= 60; x++) if (ultEV(x) > ultEV(b)) b = x; return `The peak is at about ${money(b)}: accepted ${pct(pAccept(b), 0)} of the time, for an average of ${money(ultEV(b))}.`; })(),
        },
        {
          kind: 'number', unit: '$',
          body: `Another model: the responder has a private minimum, equally likely to be anything from $0 to $${UMAX}. An offer of x is accepted with chance x / ${UMAX}. What's your best expected payoff from a $100 pot?`,
          answer: U_EV, tol: 0.5,
          hint: `Expected payoff = (100 − x) × x / ${UMAX}. Try $30, $40, $50.`,
          explain: `(100 − x) × x / ${UMAX} peaks at x = $${U_BEST}: you keep $${100 - U_BEST} with chance ${pct(U_BEST / UMAX)}, for ${money(U_EV)} on average.`,
        },
        {
          kind: 'choice',
          body: 'Why might a responder turn down $20 out of $100, ending up with nothing?',
          options: [
            { text: 'Punishing unfairness is worth more to them than $20', correct: true },
            { text: 'They misunderstood the rules', why: 'Rejections persist when people fully understand the game, even with real money at stake.' },
            { text: 'They expect a better offer next round', why: 'There is no next round in the ultimatum game.' },
          ],
          explain: 'People have preferences about fairness, not just money. In negotiations with repeat dealings, reputation adds a second reason to reject lowball offers.',
        },
        {
          kind: 'read',
          title: 'Split the gain, not the pot',
          body: `What does "fair" mean when the sides have different alternatives? A principled answer: each gets their BATNA, then they **split the gain** from the deal equally. (This is the Nash bargaining solution.)\n\nTwo partners can earn ${money(JV)} together. Alone, A would earn ${money(JA)} and B ${money(JB)}.`,
          widget: () => barChart([
            { label: 'A alone', value: JA, color: SELL },
            { label: 'B alone', value: JB, color: BUY },
            { label: 'gain together', value: JV - JA - JB, color: ZONE },
          ], { format: money }),
        },
        {
          kind: 'number', unit: '$',
          body: 'Under "each gets their alternative plus half the gain", how much does **A** get?',
          answer: JA_GET, tol: 0.5,
          hint: 'First find the gain: joint value minus both alternatives.',
          explain: `Gain = ${money(JV)} − ${money(JA)} − ${money(JB)} = ${money(JV - JA - JB)}. A gets ${money(JA)} + ${money((JV - JA - JB) / 2)} = ${money(JA_GET)}; B gets ${money(JB_GET)}.`,
        },
        {
          kind: 'choice',
          body: `B says: "Let's just split the ${money(JV)} 50/50." Why will A refuse?`,
          options: [
            { text: `A would get ${money(JV / 2)}, only ${money(JV / 2 - JA)} more than going alone, while B gains ${money(JV / 2 - JB)}`, correct: true },
            { text: '50/50 is always fair, so A won’t refuse', why: 'Equal shares of the pot ignore that A brings a better alternative to the table.' },
            { text: 'A would be worse off than going alone', why: `${money(JV / 2)} still beats A's ${money(JA)}; it's just a lopsided share of the gain.` },
          ],
          explain: 'Equal pots give the weaker-BATNA side most of the gain. Splitting the gain respects what each side could get anyway.',
        },
        {
          kind: 'choice',
          body: 'In the **dictator game**, the responder can’t reject: they just get what they’re given. Compared with the ultimatum game, people typically give…',
          options: [
            { text: 'Less, though often still something', correct: true },
            { text: 'Exactly the same', why: 'Offers drop when the veto disappears, so part of ultimatum generosity is fear of rejection.' },
            { text: 'Nothing at all', why: 'Many people still give a share: there is real generosity too, just less of it.' },
          ],
          explain: 'Ultimatum offers mix fairness and strategy. Remove the threat of rejection and offers fall: the strategic part was pricing in the veto.',
        },
        {
          kind: 'multi',
          body: 'Which help an offer feel fair, making it more likely to be accepted? Select all that apply.',
          options: [
            { text: 'Basing it on an outside standard, like recent sale prices', correct: true },
            { text: 'Explaining how you reached the number', correct: true },
            { text: 'Saying "this is fair" more firmly', why: 'Assertions aren’t reasons. Standards and explanations are.' },
            { text: 'Making it in a round number', why: 'Round numbers can look arbitrary. Reasoned numbers look principled.' },
          ],
          explain: 'Objective criteria (market data, precedent, formulas) let the other side accept without feeling they lost a contest of wills.',
        },
        {
          kind: 'fill',
          body: 'In one line:',
          template: 'Expected payoff of an offer = what you keep × [[0]]. A principled fair split gives each side its [[1]] plus [[2]] of the gain.',
          blanks: [
            { options: ['P(accept)', 'P(reject)', 'the pot'], answer: 0 },
            { options: ['BATNA', 'opening offer', 'target'], answer: 0 },
            { options: ['half', 'all', 'none'], answer: 0 },
          ],
          explain: 'Price in rejection; split gains, not pots.',
        },
      ],
      practice: [genUltTable, genSurplusSplit, genUniformMin],
    },

    // ============================================================ 7 patience
    {
      id: 'patience',
      title: 'Deadlines, patience and who blinks',
      goal: 'Work out splits when delay is costly, and see why patience is power.',
      steps: [
        {
          kind: 'number', unit: '$',
          body: `A and B split $${PIE}. A proposes first. If B rejects, a round passes and the pie shrinks to **${pct(D, 0)}** ($${PIE * D}); then B proposes, and that's final: if A rejects, both get nothing. Each accepts any offer at least as good as waiting. How much can A keep?`,
          answer: K2, tol: 0.01,
          hint: 'In round 2, B can offer A nothing and A must accept. So what does B need in round 1?',
          explain: `In round 2 B keeps the whole $${PIE * D}. So B rejects anything below $${PIE * D} in round 1. A offers exactly $${PIE * D} and keeps ${money(K2)}.`,
        },
        {
          kind: 'read',
          title: 'Solve it backwards',
          body: 'Step through the game from the last round. Whoever proposes last can take everything; each earlier proposer must offer the other side exactly what they’d get by waiting.',
          widget: pieRounds(PIE, D, 2),
        },
        {
          kind: 'number', unit: '$',
          body: `Same game with **three** rounds (A, then B, then A proposes last, at $${num2(PIE * D * D)}). How much does A keep in round 1?`,
          widget: pieRounds(PIE, D, 3),
          answer: K3, tol: 0.01,
          explain: `Round 3: A keeps $${num2(PIE * D * D)}. Round 2: B must give A $${num2(PIE * D * D)} of $${PIE * D}, keeping ${money(PIE * D - PIE * D * D)}. Round 1: A gives B that and keeps ${money(K3)}. Whoever has the last word holds the power.`,
        },
        {
          kind: 'read',
          title: 'No deadline at all',
          body: `With more and more rounds, the advantage of moving last fades and A's share settles down. With no deadline (Rubinstein's model), the first proposer gets\n\n**1 / (1 + d)**\n\nwhere d is the share of the pie left after one round of delay. Here d = ${D}: A gets ${pct(rub(D))}. Below, blue bars are games where A has the last word, orange where B does.`,
          widget: () => barChart(Array.from({ length: 8 }, (_, k) => ({ label: `${k + 1} round${k ? 's' : ''}`, value: proposerKeeps(PIE, D, k + 1)[0], color: (k + 1) % 2 ? SELL : BUY })), { format: (v) => money(v), max: PIE, title: 'what A keeps, by number of rounds' }),
        },
        {
          kind: 'number', prob: true,
          body: 'Delay is cheaper now: each round leaves **90%** of the pie. With no deadline, what share does the first proposer get?',
          answer: rub(0.9), tol: 0.006,
          explain: `1 / (1 + 0.9) = ${ppl(rub(0.9))}. Cheaper delay, smaller first-mover edge.`,
        },
        {
          kind: 'estimate',
          body: 'Now delay is very costly: each round leaves only **half** the pie. Roughly what share (%) does the first proposer get?',
          min: 0, max: 100, step: 1, answer: Math.round(100 * rub(0.5)), tol: 3, format: (v) => `${v}%`,
          explain: `1 / (1 + 0.5) = ${ppl(rub(0.5))}. When waiting is expensive, the side that gets to propose first can demand a lot.`,
        },
        {
          kind: 'number', prob: true,
          body: `Patience can differ. A loses 10% per round of delay (d_A = ${DA}); B, who needs the money soon, loses 40% (d_B = ${DB}). A proposes first; A's share is (1 − d_B) / (1 − d_A × d_B). What is it?`,
          answer: asym(DA, DB), tol: 0.006,
          explain: `(1 − ${DB}) / (1 − ${DA} × ${DB}) = ${num4(1 - DB)} / ${num4(1 - DA * DB)} = ${ppl(asym(DA, DB))}. The patient side takes most of the pie.`,
        },
        {
          kind: 'choice',
          body: 'A union strike costs workers $1 million a day in lost wages and costs the firm $3 million a day in lost sales. Other things equal, who is under more pressure to settle?',
          options: [
            { text: 'The firm: delay costs it more', correct: true },
            { text: 'The workers: they’re individuals with bills', why: 'That would matter if their costs were higher relative to what they stand to gain. Here the firm bleeds faster.' },
            { text: 'Neither: they share the losses', why: 'They lose different amounts. Whoever loses more per day has the stronger reason to concede.' },
          ],
          explain: 'In bargaining, the side that finds waiting more painful concedes more. Cutting your own cost of delay (savings, a strike fund, inventory) is a source of power.',
        },
        {
          kind: 'choice',
          body: 'You must sell your flat by Friday to close on your new one. Should you tell the buyer?',
          options: [
            { text: 'No: a known deadline lets them wait for you to blink', correct: true },
            { text: 'Yes: it shows you’re serious', why: 'It shows you’re impatient, which is what the other side wants to know.' },
            { text: 'Yes, and also tell them your walk-away price', why: 'Now they know when and where you’ll fold.' },
          ],
          explain: 'Deadlines shift power to whoever doesn’t have one. Most concessions cluster near deadlines, so hiding yours (or finding theirs) matters.',
        },
        {
          kind: 'multi',
          body: 'Which make you more patient, and so stronger, in a negotiation? Select all that apply.',
          options: [
            { text: 'A good BATNA you could switch to at any time', correct: true },
            { text: 'Cash in the bank, so delay isn’t painful', correct: true },
            { text: 'Starting talks early, well before any deadline', correct: true },
            { text: 'Announcing that you need the deal this week', why: 'That broadcasts a high cost of delay.' },
          ],
          explain: 'Patience is low cost of delay. A strong BATNA, a financial cushion and time all lower it.',
        },
        {
          kind: 'match',
          body: 'Match each situation to who has the edge.',
          heads: ['Situation', 'Edge'],
          pairs: [
            ['Single final round, A proposes', 'A takes almost everything'],
            ['Two rounds, B has the last word', 'B, the last proposer'],
            ['No deadline, delay barely costs anything', 'Nearly 50/50'],
            ['No deadline, B is much more impatient', 'A, the patient side'],
          ],
          explain: 'Last word wins with a hard deadline; patience wins without one; cheap delay pushes towards an even split.',
        },
      ],
      practice: [genFinite, genRubinstein, genAsym],
    },

    // ============================================================ 8 commitment
    {
      id: 'commitment',
      title: 'Information, bluffing and commitment',
      goal: 'Use commitments that are credible, and price the risks of bluffing.',
      steps: [
        {
          kind: 'choice',
          body: `The buyer shows you a bank letter: their car loan is capped at **${money(7000)}**, and they have no other money. You'd hoped for ${money(7400)}. What does the letter do?`,
          widget: () => zopaPic({ s: RES, b: 7000, range: [5000, 8500] }),
          options: [
            { text: `It credibly cuts the zone to ${money(RES)}–${money(7000)}, shifting the deal their way`, correct: true },
            { text: 'Nothing: it’s just their opening position', why: 'A verifiable outside limit isn’t a position: they really can’t pay more.' },
            { text: 'It means there’s no deal', why: `${money(7000)} is still above your ${money(RES)}. There's a deal, just a smaller slice for you.` },
          ],
          explain: 'Tying your own hands can be powerful: if you truly can’t go further, the other side has to meet you there.',
        },
        {
          kind: 'read',
          title: 'Credible commitment',
          body: `A **commitment** removes options from yourself so the other side must adapt: "the price is fixed by head office", a public pledge, a contract penalty. It works only if it's **credible**: backing down must cost you more than holding firm.\n\nThe risk: if you commit beyond their reservation price, there's no deal at all.`,
        },
        {
          kind: 'task',
          body: `You'll name one take-it-or-leave-it price for the car, and stick to it. You think the buyer's maximum is equally likely to be anywhere from ${money(PL)} to ${money(PH)}. Find the price with the **highest expected gain** over your walk-away price of ${money(RES)}.`,
          widget: bestExplorer({
            f: postEV, x: [5800, 9000], y: [0, 1000], step: 25, start: 8500, goal: true, near: 25,
            label: 'price', xlabel: 'your fixed price', ylabel: 'expected gain $', fmtX: money, ticks: [500, 200],
            readout: (c) => `P(they buy) ${pct(pBuy(c), 0)} · gain if they do ${money(c - RES)} · expected ${money(postEV(c))}`,
            goalText: 'That’s the best commitment.',
          }),
          hint: `Expected gain = P(they buy) × (price − ${money(RES)}).`,
          explain: `The best price is halfway between ${money(RES)} and ${money(PH)}: ${money(POST_BEST)}, with an expected gain of ${money(postEV(POST_BEST))}.`,
        },
        {
          kind: 'number', prob: true,
          body: `At that best price, ${money(POST_BEST)}, what's the chance there's **no deal** at all?`,
          answer: 1 - pBuy(POST_BEST), tol: 0.006,
          explain: `No deal if their maximum is below ${money(POST_BEST)}: (${money(POST_BEST)} − ${money(PL)}) / ${money(PH - PL)} = ${pct(1 - pBuy(POST_BEST))}. Even the best rigid commitment loses many deals that flexible bargaining would have saved.`,
        },
        {
          kind: 'number', unit: '$',
          body: `If you somehow knew the buyer's maximum exactly, you'd name exactly that price every time. Your average gain would be (average maximum) − ${money(RES)}. How much more is that than the best commitment's ${money(postEV(POST_BEST))}?`,
          answer: KNOW_EV - postEV(POST_BEST), tol: 1,
          explain: `Average maximum ${money(mid(PL, PH))}, so knowing it is worth ${money(KNOW_EV)} on average, ${money(KNOW_EV - postEV(POST_BEST))} more. That's why negotiators work so hard to learn the other side's limit, and to hide their own.`,
        },
        {
          kind: 'number', unit: '$',
          body: `Bargaining honestly, you expect to settle at ${money(HALF)}. Instead you could claim a rival offer at ${money(BLUFF)} that you don't have. You think the buyer believes it ${pct(BP, 0)} of the time and pays ${money(BLUFF)}; otherwise they call your bluff and walk, leaving you with ${money(RES)}. What's the bluff's expected value?`,
          answer: BLUFF_EV, tol: 1,
          explain: `${pct(BP, 0)} × ${money(BLUFF)} + ${pct(1 - BP, 0)} × ${money(RES)} = ${money(BLUFF_EV)}, ${BLUFF_EV < HALF ? `${money(HALF - BLUFF_EV)} less than` : `${money(BLUFF_EV - HALF)} more than`} the honest ${money(HALF)}, before counting what being caught does to your reputation.`,
        },
        {
          kind: 'multi',
          body: 'Which commitments are **credible**? Select all that apply.',
          options: [
            { text: 'A shop’s posted price that staff aren’t allowed to change', correct: true },
            { text: 'A union leader’s public promise to members not to accept less than 5%', correct: true },
            { text: '"This is my final offer!", said for the third time', why: 'Repeated "final" offers teach the other side that your finals aren’t final.' },
            { text: 'A secret promise to yourself never to go below $7,000', why: 'The other side can’t see it, so it can’t change their behaviour.' },
          ],
          explain: 'Credible commitments are visible and costly to break: rules, public promises, contracts. Cheap talk is neither.',
        },
        {
          kind: 'choice',
          body: 'In a multi-issue deal, what should you share with the other side?',
          options: [
            { text: 'Your priorities across issues, but not your reservation price', correct: true },
            { text: 'Everything: honesty maximises value', why: 'Revealing your walk-away price lets them claim nearly all the surplus.' },
            { text: 'Nothing: all information is ammunition', why: 'Hiding your priorities blocks the trades that create value (lesson 5).' },
          ],
          explain: 'Sharing interests helps create value; guarding your reservation price protects your share of it.',
        },
        {
          kind: 'choice',
          body: 'Which of these crosses the line from tough bargaining into deception that can void the deal (or worse)?',
          options: [
            { text: '"The engine was rebuilt last year," when it wasn’t', correct: true },
            { text: '"I can’t go any lower," when you could', why: 'Posturing about your limit is widely expected in haggling. It can still hurt trust if exposed.' },
            { text: 'Opening at a high price', why: 'An ambitious opener is a normal part of bargaining.' },
          ],
          explain: 'Lying about material facts is misrepresentation and can make a contract voidable. Even legal bluffs carry reputation costs in repeated dealings.',
        },
        {
          kind: 'match',
          body: 'Match each tactic to how it works.',
          heads: ['Tactic', 'How it works'],
          pairs: [
            ['"My manager won’t approve more"', 'Commitment through limited authority'],
            ['"This offer expires at 5 pm"', 'Deadline pressure'],
            ['"I have another buyer at $7,400"', 'Raising your apparent BATNA'],
            ['"If you take it today, I’ll include the roof rack"', 'Conditional concession'],
          ],
          explain: 'Most tactics work on one of the levers from this course: BATNA, commitment, time or concessions. Name the lever and you can respond to it.',
        },
        {
          kind: 'order',
          body: 'The whole course in one plan. Put the steps in order.',
          items: [
            'Know your BATNA and reservation price',
            'Estimate theirs and the ZOPA',
            'List the issues and each side’s priorities',
            'Open ambitiously, with reasons',
            'Trade conditional, shrinking concessions',
            'Close, or walk away if the deal is worse than your BATNA',
          ],
          explain: 'Prepare your walk-away, map the zone, find trades, anchor, concede deliberately, and be willing to say no.',
        },
      ],
      practice: [genPosted, genBluff],
    },
  ],
};

function num2(v: number): string {
  return String(+v.toFixed(2));
}
