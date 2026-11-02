// Personal Finance: compounding, inflation, debt, saving rate, risk, fees, big purchases and money
// psychology. General education only: every scenario uses round, hypothetical numbers (no products,
// no country-specific rules), and every figure is computed from the formulas in widgets/finance.ts.
import type { Course, Generator, Layer, Lesson, PlotSpec } from '../types';
import { h, num, pick, randInt, seeded } from '../ui';
import { barChart, columnChart, dataTable, iconArray, stackBar } from '../viz/charts';
import { explorer, plotExplorer, stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  amortYears, doubling, fv, fvAnnuity, ledger, ledgers, legendRow, note, payment, payoff, paySplit, pc, portfolioSD,
  real, runSequence, stackCols, usd, usdRound, yearsToFI,
} from '../widgets/finance';

const COLOR = '#b8860b';
const SZ: [number, number] = [360, 240];
const K = (v: number) => v / 1000; // plots show money in $ thousands

/** Estimate-slider settings for a money answer: a grid step, the answer on it, a tolerance and a range whose midpoint isn't already right. */
function moneySlider(ans: number, rel = 0.1, atLeast = 0) {
  const step = 10 ** Math.floor(Math.log10(ans)) / 10;
  const answer = Math.round(ans / step) * step;
  const tol = Math.max(step, Math.ceil((answer * rel) / step) * step);
  let max = Math.ceil(Math.max(answer * 1.7, atLeast) / step) * step;
  const mid = () => Math.round(max / 2 / step) * step;
  while (Math.abs(mid() - answer) <= tol) max += 2 * step;
  return { min: 0, max, step, answer, tol };
}

// ================================================================ lesson 1: compound growth

const KIM = fv(1000, 0.1, 30);
const ELLA = (t: number) => (t <= 10 ? fvAnnuity(2000, 0.07, t) : fvAnnuity(2000, 0.07, 10) * 1.07 ** (t - 10));
const LEO = (t: number) => (t <= 10 ? 0 : fvAnnuity(2000, 0.07, t - 10));
const ORDER_1 = [[30, 0.04], [20, 0.05], [10, 0.1], [5, 0.15]]
  .map(([n, r]) => ({ text: `${n} years at ${pc(r)}`, v: fv(10000, r, n) }))
  .sort((a, b) => b.v - a.v);

const growthPlot = (r: number, years: number, extra: Layer[] = []): PlotSpec => ({
  x: [0, years], y: [0, Math.ceil(K(fv(1000, r, years)) * 1.1)], xlabel: 'years', ylabel: '$ thousands', size: SZ,
  layers: [{ type: 'fn', f: (t) => K(fv(1000, r, t)), color: 'var(--c1)' }, ...extra],
});

const genRule72: Generator = (rng) => {
  const r = pick(rng, [2, 3, 4, 6, 8, 9, 12, 18]);
  const amt = randInt(rng, 2, 40) * 500;
  const rule = 72 / r, exact = doubling(r / 100);
  return {
    kind: 'number', unit: 'years',
    body: `You invest ${usd(amt)} at **${r}% a year**, compounded. Using the rule of 72, about how many years until it becomes ${usd(2 * amt)}?`,
    answer: rule, tol: Math.max(0.5, Math.abs(rule - exact) + 0.2),
    hint: 'Years to double ≈ 72 ÷ the yearly rate in percent.',
    explain: `72 ÷ ${r} = ${num(rule)} years. (Exactly: ${num(exact)} years. The amount doesn't matter: every amount doubles in the same time.)`,
  };
};

const genFV: Generator = (rng) => {
  const p = randInt(rng, 1, 10) * 1000, r = randInt(rng, 3, 10), n = randInt(rng, 2, 8) * 5;
  const exact = fv(p, r / 100, n);
  const s = moneySlider(exact);
  return {
    kind: 'estimate', ...s, format: (v: number) => usd(v),
    body: `Estimate: ${usd(p)} grows at **${r}% a year** for **${n} years**, interest left in. Roughly how much is there at the end?`,
    hint: `Rule of 72: it doubles about every ${num(72 / r)} years. Count the doublings.`,
    explain: `${n} ÷ ${num(72 / r)} ≈ ${num(n / (72 / r))} doublings, a factor of about ${num((1 + r / 100) ** n)}. Exactly: ${usd(p)} × ${1 + r / 100}^${n} = ${usd(exact)}.`,
  };
};

const genEarlyLate: Generator = (rng) => {
  const pmt = randInt(rng, 1, 6) * 1000, r = pick(rng, [0.05, 0.06, 0.07, 0.08]);
  const a = randInt(rng, 5, 12), gap = a, total = randInt(rng, 35, 42);
  const late = total - gap; // years the late starter pays, to the same end date
  const early = fv(fvAnnuity(pmt, r, a), r, total - a);
  const lateV = fvAnnuity(pmt, r, late);
  const earlyWins = early > lateV;
  return {
    kind: 'choice',
    body: `Over the same ${total}-year span at **${pc(r)} a year**: Ana saves ${usd(pmt)} a year for the **first ${a} years**, then stops. Ben waits ${gap} years, then saves ${usd(pmt)} a year for the **remaining ${late} years**. Who ends with more?`,
    options: [
      { text: `Ana, who paid in ${usd(pmt * a)}`, correct: earlyWins, why: earlyWins ? undefined : `Not this time: Ana's head start compounds to ${usd(early)}, but Ben's ${late} payments reach ${usd(lateV)}.` },
      { text: `Ben, who paid in ${usd(pmt * late)}`, correct: !earlyWins, why: earlyWins ? `Ben paid in more, but Ana's money had ${total - a} extra years of compounding: ${usd(early)} vs ${usd(lateV)}.` : undefined },
    ],
    explain: `Ana: ${usd(fvAnnuity(pmt, r, a))} after ${a} years, then it grows ${total - a} more years to **${usd(early)}**. Ben: ${late} payments grow to **${usd(lateV)}**. Time in the market is worth a lot of contributions.`,
  };
};

const lessonCompound: Lesson = {
  id: 'compound',
  title: 'Compound growth',
  goal: 'Use the rule of 72 and see why starting early beats starting big.',
  steps: [
    {
      kind: 'choice',
      body: `Sam and Kim each put **$1,000** into an account paying **10% a year** (a round, hypothetical rate). Sam takes his interest out as cash every year. Kim leaves hers in, so next year's interest is paid on a bigger balance.\n\nAfter **30 years** Sam has his $1,000 plus $3,000 of collected interest: $4,000. Roughly how much does Kim have?`,
      options: [
        { text: 'About $4,000', why: 'That is simple interest, $100 a year. Kim earns interest on her interest, so her yearly gain keeps growing.' },
        { text: 'About $7,000', why: 'Still too low: it treats compounding as a small bonus. Over 30 years the interest on interest ends up far bigger than the original interest.' },
        { text: `About ${usdRound(KIM)}`, correct: true },
        { text: 'About $30,000', why: 'Too high: 10% compounded for 30 years multiplies money by about 17, not 30.' },
      ],
      hint: 'Kim gets 10% more each year: 1,000 × 1.1 × 1.1 × … thirty times.',
      explain: `$1,000 × 1.1³⁰ = **${usd(KIM)}**, more than four times Sam's total. Same rate, same years: the only difference is that Kim's interest earns interest.`,
    },
    {
      kind: 'read',
      title: 'Interest on interest',
      body: `Simple interest adds the same **$100** every year: a straight line. Compound interest adds the same **percentage** every year, so the yearly gain itself grows. In year 1 Kim earns $100; in year 30 she earns ${usd(fv(1000, 0.1, 29) * 0.1)}.`,
      widget: () => h('div', null, plotEl({
        x: [0, 30], y: [0, 19], xlabel: 'years', ylabel: '$ thousands', size: SZ,
        layers: [
          { type: 'fn', f: (t) => K(fv(1000, 0.1, t)), color: 'var(--c1)', label: 'Kim (compound)' },
          { type: 'fn', f: (t) => K(1000 + 100 * t), color: 'var(--c2)', label: 'Sam (simple)' },
        ],
      })),
    },
    {
      kind: 'read',
      title: 'Doubling, again and again',
      body: 'Step through $1,000 growing at **8% a year**. Watch how long each doubling takes.',
      widget: () => stepper(5, (i) => columnChart(
        [0, 9, 18, 27, 36].map((y, k) => ({ label: `yr ${y}`, value: k <= i ? fv(1000, 0.08, y) : 0, color: 'var(--c1)' })),
        { max: fv(1000, 0.08, 36), format: (v) => (v ? usdRound(v) : ''), height: 200 }),
      { caption: (i) => i === 0 ? 'Start: $1,000' : `Year ${9 * i}: ${usd(fv(1000, 0.08, 9 * i))}, about ${2 ** i}× the start` }),
    },
    {
      kind: 'task',
      title: 'Find the rate',
      body: 'Find the yearly rate at which $1,000 doubles in **9 years**. The dashed line marks $2,000.',
      widget: plotExplorer({
        params: [{ id: 'r', label: 'rate', min: 1, max: 12, step: 1, value: 3, format: (v) => `${v}%` }],
        spec: (v) => ({ ...growthPlot(v.r / 100, 25, [
          { type: 'hline', y: 2, color: 'var(--c2)' },
          { type: 'vline', x: doubling(v.r / 100), color: 'var(--c3)' },
        ]), y: [0, 4] }),
        readout: (v) => `At ${v.r}% a year, $1,000 doubles in ${num(doubling(v.r / 100))} years`,
        goal: (v) => Math.abs(doubling(v.r / 100) - 9) < 0.5,
        goalText: '8% doubles money in 9 years: and 8 × 9 = 72.',
      }),
      hint: 'Lower rates take longer. Try the rates between 5% and 10%.',
      explain: `**8%**: 1.08⁹ ≈ ${num(1.08 ** 9)}, so the money doubles in about ${num(doubling(0.08))} years. Notice 8 × 9 = 72.`,
    },
    {
      kind: 'read',
      title: 'The rule of 72',
      body: 'For everyday rates, **years to double ≈ 72 ÷ rate (in %)**. It is a shortcut, not an exact law, but it is close:',
      widget: () => dataTable(['Rate', '72 ÷ rate', 'Exact'],
        [2, 3, 4, 6, 8, 9, 12].map((r) => [`${r}%`, `${num(72 / r)} yrs`, `${num(doubling(r / 100))} yrs`]), { highlight: [4] }),
    },
    {
      kind: 'number', unit: 'years',
      body: 'At **6% a year**, about how many years does money take to double?',
      answer: 12, tol: 0.5,
      widget: () => plotEl(growthPlot(0.06, 30, [{ type: 'hline', y: 2, color: 'var(--c2)', label: '$2,000' }])),
      hint: '72 ÷ 6. (Or read the curve where it crosses the $2,000 line.)',
      explain: `72 ÷ 6 = **12** years (exactly ${num(doubling(0.06))}).`,
    },
    {
      kind: 'estimate',
      body: 'Estimate: **$1,000** left at **7% a year** for **40 years**.',
      min: 0, max: 40000, step: 500, answer: 15000, tol: 2000, format: (v: number) => usd(v),
      hint: 'At 7% it doubles about every 10 years. How many doublings in 40 years?',
      explain: `About 4 doublings: $1,000 → 2,000 → 4,000 → 8,000 → 16,000. Exactly: $1,000 × 1.07⁴⁰ = **${usd(fv(1000, 0.07, 40))}**.`,
    },
    {
      kind: 'choice',
      title: 'Early or big?',
      body: '**Ella** invests $2,000 a year from age 25 to 35 (10 payments), then stops for good. **Leo** starts at 35 and invests $2,000 a year until 65 (30 payments). Both earn 7% a year. At 65, who has more?',
      options: [
        { text: 'Ella', correct: true },
        { text: 'Leo', why: 'He paid in three times as much ($60,000 against $20,000), but Ella\'s money had ten extra years to compound, and those years come at the big end of the curve.' },
        { text: 'About the same', why: 'They are not close: the gap is about $20,000 in Ella\'s favour.' },
      ],
      hint: 'By 35, Ella has about $27,600. How many times does that double by 65?',
      explain: `Ella: ${usd(ELLA(10))} at 35, then 30 years of growth: **${usd(ELLA(40))}**. Leo: 30 payments grow to **${usd(LEO(40))}**. Ella put in a third as much and still ends ahead.`,
    },
    {
      kind: 'read',
      title: 'Time does the heavy lifting',
      body: 'Ella\'s balance keeps growing after she stops paying in. Leo spends 30 years catching up and never quite does.',
      widget: () => h('div', null, plotEl({
        x: [25, 65], y: [0, 230], xlabel: 'age', ylabel: '$ thousands', size: SZ,
        layers: [
          { type: 'fn', f: (a) => K(ELLA(a - 25)), color: 'var(--c1)', label: 'Ella' },
          { type: 'fn', f: (a) => K(LEO(a - 25)), color: 'var(--c2)', label: 'Leo' },
          { type: 'vline', x: 35, color: 'var(--muted)' },
          { type: 'text', x: 35.8, y: 120, text: 'Ella stops', color: 'var(--muted)', anchor: 'start' },
        ],
      }), note('Hypothetical: a steady 7% a year, payments at the end of each year.')),
    },
    {
      kind: 'point',
      body: 'This is $1,000 growing at **9% a year**. Use the rule of 72 to click the point where it reaches **$4,000**.',
      plot: { ...growthPlot(0.09, 30), ticks: [5, 2] },
      answer: { x: 16, y: 4 }, tol: 1, snap: 1,
      hint: 'At 9% it doubles every 72 ÷ 9 = 8 years. $4,000 is two doublings.',
      explain: `Two doublings of 8 years: **year 16**, at $4,000 (exactly ${usd(fv(1000, 0.09, 16))} then).`,
    },
    {
      kind: 'order',
      body: 'Four ways to grow **$10,000**. Put them in order of the final balance, **largest first**.',
      items: ORDER_1.map((o) => o.text),
      hint: 'Count doublings with the rule of 72: years ÷ (72 ÷ rate).',
      explain: ORDER_1.map((o) => `${o.text}: ${usd(o.v)}`).join('; ') + '. A long time at a modest rate beats a short time at a high one.',
    },
    {
      kind: 'match',
      body: 'Match each yearly rate to its approximate doubling time.',
      heads: ['Rate', 'Doubles in about'],
      pairs: [['2%', '36 years'], ['4%', '18 years'], ['8%', '9 years'], ['12%', '6 years']],
      explain: '72 ÷ rate each time. Double the rate and you halve the doubling time.',
    },
    {
      kind: 'fill',
      body: 'Complete the idea.',
      template: 'A balance at a fixed rate grows by the same [[0]] each year, so its curve bends upward and every doubling takes the [[1]] number of years.',
      blanks: [{ options: ['percentage', 'dollar amount'], answer: 0 }, { options: ['same', 'growing', 'shrinking'], answer: 0 }],
      explain: 'Same **percentage** each year means exponential growth: doubling from $1,000 to $2,000 takes as long as from $8,000 to $16,000, the **same** number of years.',
    },
  ],
  practice: [genRule72, genFV, genEarlyLate],
};

// ================================================================ lesson 2: inflation and real returns

const buyPlot = (inf: number, nom: number, years: number, extra: Layer[] = []): PlotSpec => ({
  x: [0, years], y: [0, 2000], xlabel: 'years', ylabel: 'buying power, today\'s $', size: SZ, ticks: [5, 500],
  layers: [
    { type: 'hline', y: 1000, color: 'var(--muted)' },
    { type: 'fn', f: (t) => 1000 * ((1 + nom) / (1 + inf)) ** t, color: 'var(--c1)' }, ...extra],
});

const genReal: Generator = (rng) => {
  const nom = randInt(rng, 0, 20) / 2, inf = randInt(rng, 2, 16) / 2;
  const exact = real(nom / 100, inf / 100) * 100;
  return {
    kind: 'number', unit: '% a year',
    body: `Your money earns **${nom}% a year** while prices rise **${inf}% a year**. What is your real return? (Type a plain number, negative if you lose buying power.)`,
    answer: exact, tol: Math.abs(exact - (nom - inf)) + 0.15,
    hint: 'Real ≈ nominal − inflation.',
    explain: `About ${num(nom - inf)}%: ${nom} − ${inf}. Exactly, (1 + ${nom / 100}) ÷ (1 + ${inf / 100}) − 1 = ${num(exact)}%.`,
  };
};

const genPriceLater: Generator = (rng) => {
  const price = randInt(rng, 2, 50) * 10, inf = pick(rng, [2, 3, 4, 6]), years = pick(rng, [10, 12, 18, 20, 24, 30]);
  const later = fv(price, inf / 100, years);
  return {
    kind: 'number', unit: '$',
    body: `Something costs **${usd(price)}** today. If prices rise **${inf}% a year**, what will it cost in **${years} years**?`,
    answer: later, tol: Math.max(1, later * 0.03),
    hint: `Multiply by ${1 + inf / 100} once per year, or count doublings (72 ÷ ${inf} = ${num(72 / inf)} years).`,
    explain: `${usd(price)} × ${1 + inf / 100}^${years} = **${usd(later)}**.`,
  };
};

const genBuyingPower: Generator = (rng) => {
  const amt = randInt(rng, 1, 20) * 1000, inf = pick(rng, [2, 3, 4, 5]), years = pick(rng, [10, 15, 20, 25, 30, 35]);
  const left = amt / (1 + inf / 100) ** years;
  const s = moneySlider(left, 0.1, amt);
  return {
    kind: 'estimate', ...s, format: (v: number) => usd(v),
    body: `${usd(amt)} sits in cash for **${years} years** while prices rise **${inf}% a year**. Estimate what it will buy, in today's dollars.`,
    hint: `Prices double about every ${num(72 / inf)} years; each doubling halves what cash buys.`,
    explain: `${usd(amt)} ÷ ${1 + inf / 100}^${years} = **${usd(left)}** of today's buying power.`,
  };
};

const lessonInflation: Lesson = {
  id: 'inflation',
  title: 'Inflation and real returns',
  goal: 'Turn a nominal return into a real one and see why idle cash loses ground.',
  steps: [
    {
      kind: 'choice',
      body: 'A sandwich costs **$10** today. Suppose prices rise **3% a year** (a round, hypothetical rate). Roughly what will it cost in **24 years**?',
      options: [
        { text: 'About $12', why: 'Far too low: 3% a year feels small, but it compounds for 24 years.' },
        { text: 'About $17', why: 'That adds 30 cents a year, 24 times. Prices compound: each year\'s 3% is on the already higher price.' },
        { text: 'About $20', correct: true },
        { text: 'About $34', why: 'Too high: 3% for 24 years is about one doubling (72 ÷ 3 = 24), not more than three-fold.' },
      ],
      hint: 'The rule of 72 works for prices too.',
      explain: `72 ÷ 3 = 24 years per doubling, so about $20. Exactly: $10 × 1.03²⁴ = **${usd(fv(10, 0.03, 24), 2)}**.`,
    },
    {
      kind: 'read',
      title: 'Buying power',
      body: 'Flip it around: if prices double, each dollar buys **half** as much. Here is what $100 of cash buys, in today\'s money, as prices rise 3% a year.',
      widget: () => plotEl({
        x: [0, 40], y: [0, 110], xlabel: 'years', ylabel: 'today\'s $', size: SZ,
        layers: [
          { type: 'fn', f: (t) => 100 / 1.03 ** t, color: 'var(--c4)' },
          { type: 'text', x: 9, y: 95, text: '$100 in cash', color: 'var(--c4)', anchor: 'start' },
          { type: 'dots', pts: [[24, 100 / 1.03 ** 24]], color: 'var(--c4)', labels: [`yr 24: ${usd(100 / 1.03 ** 24)}`] },
        ],
      }),
    },
    {
      kind: 'estimate',
      body: 'Using the curve: after **30 years** of 3% inflation, $100 of cash buys what about how many of today\'s dollars buy?',
      min: 0, max: 100, step: 1, answer: Math.round(100 / 1.03 ** 30), tol: 4, format: (v: number) => usd(v),
      widget: () => plotEl({ x: [0, 40], y: [0, 110], xlabel: 'years', ylabel: 'today\'s $', size: SZ, layers: [{ type: 'fn', f: (t) => 100 / 1.03 ** t, color: 'var(--c4)' }] }),
      hint: 'It halves by year 24. Six more years takes a bit more off.',
      explain: `$100 ÷ 1.03³⁰ = **${usd(100 / 1.03 ** 30, 2)}**. The number on the note never changes; what it buys falls by more than half.`,
    },
    {
      kind: 'read',
      title: 'Nominal vs real',
      body: 'A **nominal** return is the number on your statement. A **real** return is the growth in what your money can **buy**.\n\n**Real ≈ nominal − inflation.** Earn 7% while prices rise 3%, and your buying power grows about 4% a year.\n\nExactly: (1 + nominal) ÷ (1 + inflation) − 1 = 1.07 ÷ 1.03 − 1 = ' + pc(real(0.07, 0.03), 2) + '. The shortcut is close at everyday rates.',
    },
    {
      kind: 'number', unit: '% a year',
      body: 'A savings account pays **2% a year** while inflation runs at **5%**. What is the real return? (Type a plain number, negative if you lose.)',
      answer: real(0.02, 0.05) * 100, tol: 0.2,
      widget: () => barChart([{ label: 'Balance grows', value: 2, color: 'var(--c3)' }, { label: 'Prices grow', value: 5, color: 'var(--c4)' }], { format: (v) => `${v}% a year` }),
      hint: 'Real ≈ nominal − inflation.',
      explain: `About **−3%**: 2 − 5. Exactly 1.02 ÷ 1.05 − 1 = ${num(real(0.02, 0.05) * 100)}%. The balance grows, but it buys less every year.`,
    },
    {
      kind: 'point',
      body: 'An investment earns **9%** in a year when prices rise **4%**. Place its real return on the line (in %).',
      plot: { x: [-6, 10], ticks: [2] },
      answer: { x: 5 }, tol: 0.5, snap: 0.5,
      hint: 'Nominal minus inflation, then nudge a little lower.',
      explain: `About **5%**: 9 − 4. Exactly 1.09 ÷ 1.04 − 1 = ${num(real(0.09, 0.04) * 100)}%.`,
    },
    {
      kind: 'sort',
      body: 'Inflation is **4% a year**. Sort each by what happens to its buying power.',
      bins: ['Gains buying power', 'Loses buying power'],
      items: [
        { text: 'Cash earning 0%', bin: 1 },
        { text: 'Savings earning 2%', bin: 1 },
        { text: 'A 3% pay raise', bin: 1 },
        { text: 'Savings earning 4.5%', bin: 0 },
        { text: 'A fund averaging 8%', bin: 0 },
        { text: 'A 6% pay raise', bin: 0 },
      ],
      hint: 'Compare each rate with 4%.',
      explain: 'Anything growing faster than 4% gains buying power; anything slower loses it. A 3% raise during 4% inflation is a real pay cut of about 1%.',
    },
    {
      kind: 'read',
      title: 'Why idle cash loses',
      body: 'What **$10,000** in cash at 0% will buy, in today\'s money. Even "low" inflation adds up over a working life.',
      widget: () => dataTable(['After', '2% inflation', '4% inflation'],
        [10, 20, 30, 40].map((y) => [`${y} years`, usd(10000 / 1.02 ** y), usd(10000 / 1.04 ** y)])),
    },
    {
      kind: 'match',
      body: 'Match each case to its approximate real return.',
      heads: ['Earns, while prices rise', 'Real return'],
      pairs: [
        ['6% earned, 2% inflation', 'about +4%'],
        ['3% earned, 3% inflation', 'about 0%'],
        ['1% earned, 4% inflation', 'about −3%'],
        ['10% earned, 7% inflation', 'about +3%'],
      ],
      explain: 'Nominal minus inflation each time. Note that 10% with 7% inflation (+3%) is worse than 6% with 2% (+4%): a bigger number on the statement can mean less real growth.',
    },
    {
      kind: 'multi',
      body: 'Which statements are true?',
      options: [
        { text: 'A 2% raise while prices rise 4% is a pay cut in real terms.', correct: true },
        { text: 'If prices double, a dollar buys half as much.', correct: true },
        { text: '2% inflation is too small to matter over 35 years.', why: '72 ÷ 2 = 36: over 35 years, 2% inflation nearly halves what cash buys.' },
        { text: 'A fixed payment that never changes costs less in today\'s money each year while prices rise.', correct: true },
        { text: 'If your balance grows every year, your buying power grows too.', why: 'Only if it grows faster than prices. A 1% balance during 3% inflation buys less every year.' },
      ],
      explain: 'Real terms are what matter: a raise, a return or a fixed payment all need to be compared with how fast prices are rising.',
    },
    {
      kind: 'task',
      title: 'Hold your ground',
      body: 'Inflation is **3% a year**. Find the **lowest** interest rate that keeps $1,000 from losing buying power over 20 years.',
      widget: plotExplorer({
        params: [{ id: 'r', label: 'interest', min: 0, max: 8, step: 0.5, value: 1, format: (v) => `${v}%` }],
        spec: (v) => buyPlot(0.03, v.r / 100, 20),
        readout: (v) => `After 20 years: ${usd(1000 * ((1 + v.r / 100) / 1.03) ** 20)} of today's buying power`,
        goal: (v) => v.r === 3,
        goalText: 'Earning exactly the inflation rate keeps buying power flat.',
      }),
      hint: 'The grey line is $1,000. When does the curve stay level?',
      explain: 'Set the rate to **3%**, equal to inflation: real return 0, so the curve stays flat at $1,000. Anything less slopes down.',
    },
    {
      kind: 'fill',
      body: 'Complete the sentence.',
      template: 'When prices rise 3% a year and savings earn 1%, the [[0]] balance goes up while its [[1]] value goes down.',
      blanks: [{ options: ['nominal', 'real'], answer: 0 }, { options: ['real', 'nominal'], answer: 0 }],
      widget: () => plotEl({
        x: [0, 30], y: [600, 1400], xlabel: 'years', ylabel: '$', size: SZ, ticks: [5, 200],
        layers: [
          { type: 'fn', f: (t) => 1000 * 1.01 ** t, color: 'var(--c1)', label: 'on the statement' },
          { type: 'fn', f: (t) => 1000 * (1.01 / 1.03) ** t, color: 'var(--c4)' },
          { type: 'text', x: 2, y: 790, text: 'what it buys', color: 'var(--c4)', anchor: 'start' },
        ],
      }),
      explain: 'The **nominal** number on the statement grows 1% a year; its **real** value (what it buys) shrinks about 2% a year.',
    },
  ],
  practice: [genReal, genPriceLater, genBuyingPower],
};

// ================================================================ lesson 3: debt

const MIN_RULE = (b: number) => Math.max(25, 0.03 * b);
const CARD_MIN = payoff(5000, 0.24, MIN_RULE);
const CARD = (pay: number) => payoff(5000, 0.24, () => pay);
const MORT = amortYears(200000, 0.06, 30);
const MORT_PMT = payment(200000, 0.005, 360);
const CAR_PMT = payment(20000, 0.06 / 12, 60);
const car = amortYears(20000, 0.06, 5);

/** Balance path month by month, drawn for at most `months` (stays flat at zero once paid). */
function cardPath(balance: number, apr: number, pay: (b: number) => number, months: number): [number, number][] {
  let b = balance;
  const pts: [number, number][] = [[0, K(b)]];
  for (let m = 1; m <= months; m++) {
    b = Math.max(0, b * (1 + apr / 12) - Math.min(b * (1 + apr / 12), pay(b * (1 + apr / 12))));
    pts.push([m, K(b)]);
  }
  return pts;
}

const genMonthInterest: Generator = (rng) => {
  const bal = randInt(rng, 5, 80) * 100, apr = pick(rng, [12, 15, 18, 21, 24, 27, 30]);
  const i = (bal * apr) / 1200;
  return {
    kind: 'number', unit: '$',
    body: `A card balance of **${usd(bal)}** at **${apr}% APR**. About how much interest is charged for one month?`,
    answer: i, tol: 0.5,
    hint: 'Monthly rate ≈ APR ÷ 12.',
    explain: `${apr}% ÷ 12 = ${num(apr / 12)}% a month; ${usd(bal)} × ${num(apr / 1200)} = **${usd(i, 2)}**.`,
  };
};

const genPayoffMonths: Generator = (rng) => {
  const bal = randInt(rng, 10, 60) * 100, apr = pick(rng, [12, 18, 24]);
  const interest1 = (bal * apr) / 1200;
  const pay = Math.ceil((interest1 * pick(rng, [1.5, 2, 3, 4])) / 10) * 10;
  const p = payoff(bal, apr / 100, () => pay);
  const right = `About ${p.months} months, paying ${usd(p.interest)} in interest`;
  const naive = Math.ceil(bal / pay);
  return {
    kind: 'choice',
    body: `You owe **${usd(bal)}** at **${apr}% APR** and pay a fixed **${usd(pay)} a month**. How long until it's paid off?`,
    options: [
      { text: right, correct: true },
      { text: `About ${naive} months, with little interest`, why: `${usd(bal)} ÷ ${usd(pay)} ignores interest: the first month alone charges ${usd(interest1)}, so only ${usd(pay - interest1)} comes off the balance.` },
      { text: 'Never: the payment only covers interest', why: `The first month's interest is ${usd(interest1)}, less than the ${usd(pay)} payment, so the balance does shrink.` },
    ],
    explain: `Month by month, ${num(apr / 12)}% interest is added and ${usd(pay)} comes off. It takes **${p.months} months**, and you pay ${usd(p.interest)} of interest on top of the ${usd(bal)}.`,
  };
};

const genFirstPrincipal: Generator = (rng) => {
  const loan = randInt(rng, 10, 50) * 10000, rate = pick(rng, [3, 4, 5, 6, 7, 8]), years = pick(rng, [15, 20, 25, 30]);
  const pm = payment(loan, rate / 1200, years * 12), int1 = (loan * rate) / 1200;
  return {
    kind: 'number', unit: '$',
    body: `A ${years}-year loan of **${usd(loan)}** at **${rate}% a year** has a monthly payment of **${usd(pm, 2)}**. Of the first payment, how much actually pays down the loan?`,
    answer: pm - int1, tol: 1,
    hint: `First find this month's interest: ${usd(loan)} × ${rate}% ÷ 12.`,
    explain: `Interest: ${usd(loan)} × ${rate / 100} ÷ 12 = ${usd(int1, 2)}. The rest, ${usd(pm, 2)} − ${usd(int1, 2)} = **${usd(pm - int1, 2)}**, reduces the balance.`,
  };
};

const lessonDebt: Lesson = {
  id: 'debt',
  title: 'The cost of debt',
  goal: 'See how much of a payment is interest, and why minimum payments take decades.',
  steps: [
    {
      kind: 'choice',
      body: 'You owe **$5,000** on a credit card at **24% APR** (a hypothetical rate) and pay **$100 every month**, adding no new purchases. When is it paid off?',
      options: [
        { text: 'In about 4 years', why: '50 payments of $100 is $5,000, but that forgets the interest added every month.' },
        { text: 'In about 6 years', why: 'It sounds like a sensible allowance for interest, but check the first month: how much interest is added?' },
        { text: 'In about 10 years', why: 'Even a long horizon is too optimistic here. Work out the first month\'s interest.' },
        { text: 'Never', correct: true },
      ],
      hint: '24% a year is about 2% a month. What is 2% of $5,000?',
      explain: '24% APR ≈ 2% a month, and 2% of $5,000 is **$100**. Each payment just covers the month\'s interest; the balance never moves.',
    },
    {
      kind: 'read',
      title: 'APR, one month at a time',
      body: 'A card\'s **APR** (annual percentage rate) is charged in monthly slices: 24% ÷ 12 = **2% a month**. Interest comes first; only what is left of your payment shrinks the debt.',
      widget: () => paySplit(100, 0, 'Your $100 payment, month 1'),
    },
    {
      kind: 'number', unit: '$',
      body: 'A balance of **$3,000** at **18% APR**. How much interest is added in the first month?',
      answer: 45, tol: 0.5,
      hint: '18% ÷ 12 = 1.5% a month.',
      explain: '$3,000 × 1.5% = **$45**.',
      widget: () => paySplit(45, 105, 'With a $150 payment'),
    },
    {
      kind: 'task',
      title: 'Clear it in three years',
      body: 'Same $5,000 at 24% APR. Choose a fixed monthly payment that clears it in **36 months or less**.',
      widget: plotExplorer({
        params: [{ id: 'p', label: 'payment', min: 110, max: 400, step: 10, value: 110, format: (v) => `$${v}` }],
        spec: (v) => ({
          x: [0, 60], y: [0, 5.5], xlabel: 'months', ylabel: '$ thousands owed', size: SZ, ticks: [12, 1],
          layers: [{ type: 'line', pts: cardPath(5000, 0.24, () => v.p, 60), color: 'var(--c4)' }, { type: 'vline', x: 36, color: 'var(--c3)', label: '36 months' }],
        }),
        readout: (v) => { const p = CARD(v.p); return `Paid off in ${p.months} months · interest ${usd(p.interest)}`; },
        goal: (v) => CARD(v.p).months <= 36,
        goalText: 'Done in three years.',
      }),
      hint: 'About $100 of each payment goes to interest at first. You need much more than that.',
      explain: `**$200 a month** or more: $200 clears it in ${CARD(200).months} months with ${usd(CARD(200).interest)} of interest ($190 takes ${CARD(190).months}). Compare $110 a month: ${CARD(110).months} months and ${usd(CARD(110).interest)} of interest.`,
    },
    {
      kind: 'read',
      title: 'Minimum payments',
      body: 'Cards usually ask for a small **minimum payment** that shrinks as the balance shrinks. Take a hypothetical rule: **3% of the balance, but at least $25**.\n\nOn $5,000 the first minimum is about $150, but it falls every month, so the debt is paid off slower and slower.',
      widget: () => dataTable(['Month', 'Balance', 'Minimum due'], [1, 12, 36, 60].map((m) => {
        const b = cardPath(5000, 0.24, MIN_RULE, m - 1)[m - 1][1] * 1000 * 1.02;
        return [String(m), usd(b), usd(MIN_RULE(b))];
      })),
    },
    {
      kind: 'estimate', format: (v: number) => `${v} years`,
      body: 'Paying only that minimum on **$5,000 at 24% APR**, how many **years** until the card is clear?',
      min: 0, max: 30, step: 1, answer: Math.round(CARD_MIN.months / 12), tol: 2,
      hint: 'Each month the balance falls by only about 1%.',
      explain: `**${num(CARD_MIN.months / 12)} years** (${CARD_MIN.months} months), with ${usd(CARD_MIN.interest)} of interest on top of the $5,000.`,
    },
    {
      kind: 'read',
      title: 'Minimum vs fixed',
      body: `Paying a fixed $200 instead of the shrinking minimum clears the card in ${CARD(200).months} months with ${usd(CARD(200).interest)} of interest, against ${num(CARD_MIN.months / 12)} years and ${usd(CARD_MIN.interest)}.`,
      widget: () => plotEl({
        x: [0, 240], y: [0, 5.5], xlabel: 'months', ylabel: '$ thousands owed', size: SZ, ticks: [48, 1],
        layers: [
          { type: 'line', pts: cardPath(5000, 0.24, MIN_RULE, 240), color: 'var(--c4)' },
          { type: 'text', x: 100, y: 2.6, text: 'minimum only', color: 'var(--c4)', anchor: 'start' },
          { type: 'line', pts: cardPath(5000, 0.24, () => 200, 60), color: 'var(--c3)' },
          { type: 'text', x: 44, y: 1.1, text: '$200 a month', color: 'var(--c3)', anchor: 'start' },
        ],
      }),
    },
    {
      kind: 'read',
      title: 'Amortization',
      body: `A loan with a **fixed payment**, like a mortgage, works the same way. Here is a hypothetical $200,000 loan over 30 years at 6%: ${usd(MORT_PMT, 2)} a month. Early on, most of each payment is interest; the share flips as the balance falls.`,
      widget: () => stackCols(MORT.map((y, k) => ({ label: String(k + 1), parts: [y.interest, y.principal] })),
        [{ label: 'interest', color: 'var(--c4)' }, { label: 'pays down the loan', color: 'var(--c3)' }], { every: 5, caption: 'year of the loan' }),
    },
    {
      kind: 'number', unit: '$',
      body: `On that $200,000 loan at 6%, the first payment is **${usd(MORT_PMT, 2)}**. How much of it reduces the balance?`,
      answer: MORT_PMT - 1000, tol: 1,
      hint: 'First find one month of interest on $200,000 at 6% a year.',
      explain: `Interest: $200,000 × 6% ÷ 12 = $1,000. Only **${usd(MORT_PMT - 1000, 2)}** goes to the loan itself.`,
    },
    {
      kind: 'choice',
      body: 'Over all 30 years, about how much **interest** does that loan cost in total?',
      options: [
        { text: 'About $12,000', why: 'That is roughly the first year\'s interest alone.' },
        { text: `About ${usdRound(MORT_PMT * 360 - 200000)}`, correct: true },
        { text: 'About $360,000', why: '6% of $200,000 for 30 years would be $12,000 × 30, but the balance shrinks, so later years charge less.' },
        { text: 'About $60,000', why: 'Far too low: in the first decade alone interest takes most of every payment.' },
      ],
      hint: 'Total paid is 360 payments of about $1,199. Subtract what you borrowed.',
      widget: () => paySplit(1000, MORT_PMT - 1000, 'Payment 1 of 360'),
      explain: `360 × ${usd(MORT_PMT, 2)} = ${usd(MORT_PMT * 360)} paid, minus the $200,000 borrowed: **${usd(MORT_PMT * 360 - 200000)}** of interest, more than the loan itself.`,
    },
    {
      kind: 'sort',
      body: 'Is each payment **mostly interest** or **mostly paying down the debt**?',
      bins: ['Mostly interest', 'Mostly paying down the debt'],
      items: [
        { text: 'Payment 1 of the 30-year loan at 6%', bin: 0 },
        { text: 'Payment 359 of the same loan', bin: 1 },
        { text: 'First year of a 30-year loan at 8%', bin: 0 },
        { text: 'Last year of a 5-year car loan at 6%', bin: 1 },
        { text: 'A $100 payment on $5,000 at 24% APR', bin: 0 },
      ],
      hint: 'Interest is charged on what is still owed. Is the balance big or small?',
      explain: `Big balance, mostly interest: payment 1 is ${pc(1000 / MORT_PMT, 0)} interest; at 8% the first year is ${pc(amortYears(200000, 0.08, 30)[0].interest / (12 * payment(200000, 0.08 / 12, 360)), 0)} interest; the card payment is 100%. Small balance, mostly principal: payment 359 and the car loan's last year (${pc(car[4].interest / (12 * CAR_PMT), 0)} interest).`,
    },
    {
      kind: 'order',
      body: 'Four ways to pay off the **$5,000 card at 24%**. Order them by total interest, **least first**.',
      items: ['$500 a month', '$250 a month', '$150 a month', 'The shrinking minimum'],
      explain: `$500: ${usd(CARD(500).interest)}; $250: ${usd(CARD(250).interest)}; $150: ${usd(CARD(150).interest)}; minimum: ${usd(CARD_MIN.interest)}. Faster payoff means less time for interest to build.`,
    },
    {
      kind: 'match',
      body: 'Match each term to its meaning.',
      heads: ['Term', 'Meaning'],
      pairs: [
        ['APR', 'the yearly rate charged on what you owe'],
        ['Principal', 'the borrowed amount still owed'],
        ['Amortization', 'repaying with fixed installments over time'],
        ['Minimum payment', 'the least the lender accepts this month'],
      ],
      explain: 'APR sets the interest; interest is charged on the principal; amortization schedules split each fixed payment between the two; the minimum is just what keeps the account in good standing.',
    },
    {
      kind: 'fill',
      body: 'You have several debts and some extra money each month (minimums paid on all of them).',
      widget: () => dataTable(['Debt', 'Balance', 'Rate'], [['Store card', '$800', '29%'], ['Credit card', '$4,000', '22%'], ['Car loan', '$9,000', '7%']]),
      template: 'Putting the extra on the debt with the [[0]] first saves the most interest; clearing the [[1]] first can feel more motivating but never saves more.',
      blanks: [
        { options: ['highest rate', 'smallest balance', 'largest balance'], answer: 0 },
        { options: ['highest rate', 'smallest balance', 'largest balance'], answer: 1 },
      ],
      explain: 'Each extra dollar on the **highest-rate** debt stops the most interest (the "avalanche"). Paying the **smallest balance** first (the "snowball") gives quick wins, which can help people stick with it, usually at some extra interest cost.',
    },
  ],
  practice: [genMonthInterest, genPayoffMonths, genFirstPrincipal],
};

// ================================================================ lesson 4: budgeting and saving rate

const FI_PLOT = (s?: number): PlotSpec => ({
  x: [5, 80], y: [0, 70], xlabel: 'saving rate %', ylabel: 'years', size: SZ, ticks: [15, 10],
  layers: [
    { type: 'fn', f: (x) => yearsToFI(x / 100), color: 'var(--c1)', from: 5, to: 80 },
    { type: 'hline', y: 20, color: 'var(--c3)', label: '20 years' },
    ...(s === undefined ? [] : [{ type: 'dots', pts: [[s, yearsToFI(s / 100)]], color: 'var(--c2)', r: 6 } as Layer]),
  ],
});

const genSavingRate: Generator = (rng) => {
  const inc = randInt(rng, 20, 80) * 100, rate = randInt(rng, 1, 12) * 5;
  const spend = inc * (1 - rate / 100);
  return {
    kind: 'number', unit: '%',
    body: `Take-home pay is **${usd(inc)}** a month and spending is **${usd(spend)}**. What is the saving rate, in percent?`,
    answer: rate, tol: 0.2,
    hint: 'Saved ÷ take-home.',
    explain: `Saved: ${usd(inc)} − ${usd(spend)} = ${usd(inc - spend)}. ${usd(inc - spend)} ÷ ${usd(inc)} = **${rate}%**.`,
  };
};

const gen503020: Generator = (rng) => {
  const inc = randInt(rng, 15, 90) * 100;
  const which = pick(rng, [['needs', 0.5], ['wants', 0.3], ['savings', 0.2]] as const);
  return {
    kind: 'number', unit: '$',
    body: `With take-home pay of **${usd(inc)}** a month, how much does the 50/30/20 guideline put toward **${which[0]}**?`,
    answer: inc * which[1], tol: 0.5,
    hint: '50% needs, 30% wants, 20% savings and extra debt payments.',
    explain: `${pc(which[1])} of ${usd(inc)} = **${usd(inc * which[1])}**.`,
  };
};

const genFIYears: Generator = (rng) => {
  const s = randInt(rng, 2, 14) * 5;
  const n = yearsToFI(s / 100);
  const o = [Math.round(n), Math.round(n * 1.8 + 6), Math.max(1, Math.round(n * 0.45))];
  return {
    kind: 'choice',
    body: `Starting from zero, someone saves **${s}%** of take-home pay each year. Assume a 5% real return and a target of 25 × yearly spending (hypothetical). About how long until they reach it?`,
    options: [
      { text: `About ${o[0]} years`, correct: true },
      { text: `About ${o[1]} years`, why: 'Too long: a higher saving rate also lowers the spending the target has to cover.' },
      { text: `About ${o[2]} years`, why: 'Too short: savings need time to grow; returns can\'t do it in that time at this rate.' },
    ].filter((x, i, a) => a.findIndex((y) => y.text === x.text) === i),
    hint: 'The target is 25 × the other ' + (100 - s) + '% of pay.',
    explain: `They save ${s}% and spend ${100 - s}%, so the target is 25 × ${100 - s}% = ${num(25 * (100 - s) / 100)} years of pay. Growing at 5%, the savings get there in about **${num(n)} years**.`,
  };
};

const lessonBudget: Lesson = {
  id: 'budget',
  title: 'Budgeting and saving rate',
  goal: 'Measure a saving rate, see why it matters so much, and size an emergency fund.',
  steps: [
    {
      kind: 'number', unit: '%',
      body: 'Maya takes home **$3,000** a month and spends **$2,400**. What percentage of her pay does she save?',
      answer: 20, tol: 0.2,
      hint: 'What she keeps, divided by what she takes home.',
      explain: '$600 ÷ $3,000 = **20%**. That fraction, the **saving rate**, turns out to be the biggest lever in personal finance.',
    },
    {
      kind: 'read',
      title: 'One rule of thumb: 50/30/20',
      body: 'A common starting heuristic splits take-home pay into **50% needs** (housing, food, insurance, minimum debt payments), **30% wants** and **20% saving** (including extra debt payments). It is a starting point, not a law: where housing is expensive, needs can take more.',
      widget: () => stackBar([
        { label: 'Needs', value: 50, color: 'var(--c1)' }, { label: 'Wants', value: 30, color: 'var(--c2)' }, { label: 'Saving', value: 20, color: 'var(--c3)' }]),
    },
    {
      kind: 'sort',
      body: 'Sort each item into a 50/30/20 bucket.',
      bins: ['Needs', 'Wants', 'Saving'],
      items: [
        { text: 'Rent', bin: 0 },
        { text: 'Groceries', bin: 0 },
        { text: 'Minimum loan payment', bin: 0 },
        { text: 'Streaming subscription', bin: 1 },
        { text: 'Restaurant dinners', bin: 1 },
        { text: 'Emergency fund deposit', bin: 2 },
        { text: 'Extra loan payment', bin: 2 },
      ],
      hint: 'A need is what you must pay to live and keep your obligations; saving is anything that builds your future position.',
      explain: 'Needs: rent, groceries and the **minimum** loan payment. Wants: subscriptions and eating out. Saving: the emergency fund and **extra** debt payments, which raise your net worth just like saving does.',
    },
    {
      kind: 'number', unit: '$',
      body: 'Take-home pay is **$3,600** a month. How much does 50/30/20 leave for **wants**?',
      answer: 1080, tol: 0.5,
      explain: '30% of $3,600 = **$1,080** (and $1,800 for needs, $720 for saving).',
      widget: () => stackBar([
        { label: 'Needs', value: 1800, color: 'var(--c1)' }, { label: 'Wants', value: 1080, color: 'var(--c2)' }, { label: 'Saving', value: 720, color: 'var(--c3)' }],
      ),
    },
    {
      kind: 'read',
      title: 'Saving rate does double duty',
      body: 'A higher saving rate helps twice: you put more away, **and** you show you can live on less, so you need less saved.\n\nA simple hypothetical model: start from zero, earn a **5% real return**, and aim for **25 × yearly spending** (a common rule of thumb for "enough to live off"). Then the years needed depend only on the saving rate:',
      widget: () => dataTable(['Saves', 'Spends', 'Target'], [10, 25, 50].map((s) => [`${s}%`, `${100 - s}%`, `${num(25 * (100 - s) / 100)} years of pay`])),
    },
    {
      kind: 'estimate', format: (v: number) => `${v} years`,
      body: 'In that model, someone who saves **10%** of their pay: about how many years until they reach the target?',
      min: 0, max: 70, step: 1, answer: Math.round(yearsToFI(0.1)), tol: 5,
      hint: 'The target is 22.5 years of pay, and they put in 0.1 of a year\'s pay each year.',
      explain: `About **${num(yearsToFI(0.1))} years**: most of a working life. Without returns it would take 225 years; growth does a lot, but 10% is a slow start.`,
    },
    {
      kind: 'task',
      title: 'Twenty years',
      body: 'Find the **lowest** saving rate (in steps of 5%) that reaches the target in **20 years or less**.',
      widget: plotExplorer({
        params: [{ id: 's', label: 'saving rate', min: 5, max: 80, step: 5, value: 10, format: (v) => `${v}%` }],
        spec: (v) => FI_PLOT(v.s),
        readout: (v) => `Saving ${v.s}%: about ${num(yearsToFI(v.s / 100))} years`,
        goal: (v) => yearsToFI(v.s / 100) <= 20 && yearsToFI((v.s - 5) / 100) > 20,
        goalText: 'That is the lowest rate that does it in 20 years.',
      }),
      hint: 'Slide right until the dot drops below the green line, then check one step back.',
      explain: `**45%**: about ${num(yearsToFI(0.45))} years. At 40% it takes ${num(yearsToFI(0.4))}.`,
    },
    {
      kind: 'choice',
      body: 'In the same model, which change cuts **more years** off the wait?',
      options: [
        { text: 'Raising the saving rate from 10% to 20%', correct: true },
        { text: 'Raising the saving rate from 50% to 60%', why: `That saves ${num(yearsToFI(0.5) - yearsToFI(0.6))} years; going from 10% to 20% saves ${num(yearsToFI(0.1) - yearsToFI(0.2))}. The curve is steepest at low rates.` },
        { text: 'Both cut the same: each is 10 points', why: 'The curve is not a straight line: the same 10 points matter far more when you start low.' },
      ],
      widget: () => plotEl(FI_PLOT()),
      explain: `10% → 20%: from ${num(yearsToFI(0.1))} to ${num(yearsToFI(0.2))} years, **${num(yearsToFI(0.1) - yearsToFI(0.2))} years** sooner. 50% → 60%: ${num(yearsToFI(0.5) - yearsToFI(0.6))} years sooner. The first few points of saving are the most powerful.`,
    },
    {
      kind: 'read',
      title: 'The emergency fund',
      body: 'Before investing for decades, many people keep a cash buffer of a few months of **essential** expenses; **3 to 6 months** is a common guideline. It turns a job loss or a broken car into an inconvenience instead of a high-interest debt.',
      widget: () => barChart([3, 4, 5, 6].map((m) => ({ label: `${m} months`, value: 2000 * m, color: 'var(--c3)' })), { format: (v) => usd(v), title: 'Fund size if essentials cost $2,000 a month' }),
    },
    {
      kind: 'number', unit: '$',
      body: 'Essential costs are **$2,200** a month. How big is a **4-month** emergency fund?',
      answer: 8800, tol: 0.5,
      explain: '4 × $2,200 = **$8,800**.',
    },
    {
      kind: 'multi',
      body: 'Which belong in the **essential** monthly costs an emergency fund should cover?',
      options: [
        { text: 'Rent or mortgage payment', correct: true },
        { text: 'Groceries', correct: true },
        { text: 'Insurance premiums', correct: true },
        { text: 'Minimum debt payments', correct: true },
        { text: 'A planned holiday', why: 'In a real emergency the holiday is the first thing to go; it is not essential.' },
        { text: 'Upgrading to a new phone', why: 'A want: it can wait until income returns.' },
      ],
      explain: 'Essentials are what you must keep paying even if your income stops: housing, food, insurance, minimum debt payments, basic transport and utilities.',
    },
    {
      kind: 'fill',
      body: 'Complete the definition.',
      template: 'Saving rate = [[0]] ÷ [[1]]',
      blanks: [{ options: ['money saved', 'money spent', 'net worth'], answer: 0 }, { options: ['take-home pay', 'money spent', 'net worth'], answer: 0 }],
      explain: '**Money saved ÷ take-home pay**: the share of what you earn that you keep.',
    },
  ],
  practice: [genSavingRate, gen503020, genFIYears],
};

// ================================================================ lesson 5: risk and diversification

/** Standard normals (Box-Muller) from a seeded generator. */
function normals(seed: number, n: number): number[] {
  const rng = seeded(seed), out: number[] = [];
  while (out.length < n) {
    const u = Math.max(1e-12, rng()), v = rng(), r = Math.sqrt(-2 * Math.log(u));
    out.push(r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v));
  }
  return out.slice(0, n);
}
/** 40 simulated one-year results (%) for portfolios of n independent stocks, each 7% ± 30%. */
function portfolios(n: number): number[] {
  const z = normals(1000 + n, 40 * n);
  return Array.from({ length: 40 }, (_, k) => 7 + (30 * z.slice(k * n, k * n + n).reduce((a, b) => a + b, 0)) / n);
}
const SEQ = [-0.2, -0.1, 0.1, 0.15, 0.25];
const SEQ_BAD = runSequence(500000, SEQ, 40000), SEQ_GOOD = runSequence(500000, [...SEQ].reverse(), 40000);

const genRecovery: Generator = (rng) => {
  const loss = randInt(rng, 2, 16) * 5;
  const need = (1 / (1 - loss / 100) - 1) * 100;
  return {
    kind: 'number', unit: '%',
    body: `An investment falls **${loss}%**. What percentage gain does it then need to get back to where it started?`,
    answer: need, tol: Math.max(0.3, need * 0.01),
    hint: `After the fall you have ${100 - loss}% of the start. What multiplies ${100 - loss} back to 100?`,
    explain: `100 ÷ ${100 - loss} = ${num(100 / (100 - loss), 4)}, so it needs a **${num(need)}%** gain. Losses take bigger gains to undo.`,
  };
};

const genVolDrag: Generator = (rng) => {
  const up = randInt(rng, 2, 10) * 5, down = randInt(rng, 2, 8) * 5;
  const end = 100 * (1 + up / 100) * (1 - down / 100);
  return {
    kind: 'number', unit: '$',
    body: `$100 rises **${up}%** in year one and falls **${down}%** in year two. How much is left?`,
    answer: end, tol: 0.05,
    hint: 'Multiply: the second year\'s percentage applies to the new balance.',
    explain: `$100 × ${1 + up / 100} × ${1 - down / 100} = **${usd(end, 2)}**. The simple average return is ${num((up - down) / 2)}%, but the result is what the multiplication says.`,
  };
};

const genDiversify: Generator = (rng) => {
  const sigma = pick(rng, [20, 25, 30, 40]), n = pick(rng, [4, 9, 16, 25, 36, 100]);
  return {
    kind: 'number', unit: '%',
    body: `Each stock bounces with a volatility (standard deviation) of **${sigma}%** a year, and they move **independently**. What is the volatility of an equal mix of **${n}** of them?`,
    answer: sigma / Math.sqrt(n), tol: 0.05,
    hint: 'For independent assets, volatility shrinks with the square root of how many you hold.',
    explain: `${sigma}% ÷ √${n} = ${sigma}% ÷ ${Math.sqrt(n)} = **${num(sigma / Math.sqrt(n))}%**. (Real stocks are correlated, so the real benefit is smaller.)`,
  };
};

const lessonRisk: Lesson = {
  id: 'risk',
  title: 'Risk and diversification',
  goal: 'See why volatility costs money, why spreading out helps, and where it stops helping.',
  steps: [
    {
      kind: 'choice',
      body: 'Two hypothetical investments both **average** 5% a year. **A** gains 5% every year. **B** gains 30% one year and loses 20% the next. Start with $100. After two years, which has more?',
      options: [
        { text: 'A, the steady one', correct: true },
        { text: 'B, the bumpy one', why: 'The 30% gain feels big, but the 20% loss is then taken from the bigger balance.' },
        { text: 'They end level: both average 5%', why: 'Averaging the percentages ignores that returns multiply: +30% then −20% is × 1.3 × 0.8 = 1.04.' },
      ],
      hint: 'Work it out: 100 × 1.05 × 1.05, and 100 × 1.3 × 0.8.',
      explain: 'A: $100 × 1.05 × 1.05 = **$110.25**. B: $100 × 1.3 × 0.8 = **$104**. Same average, less money: volatility itself costs growth.',
    },
    {
      kind: 'read',
      title: 'Bumps cost growth',
      body: '**Volatility** is how much returns bounce around. Over ten years, B\'s ups and downs leave it well behind A, even though its average yearly return is the same.',
      widget: () => plotEl({
        x: [0, 10], y: [80, 170], xlabel: 'years', ylabel: '$', size: SZ, ticks: [2, 20],
        layers: [
          { type: 'line', pts: Array.from({ length: 11 }, (_, t) => [t, 100 * 1.05 ** t] as [number, number]), color: 'var(--c1)', label: `A: ${usd(100 * 1.05 ** 10)}` },
          { type: 'line', pts: Array.from({ length: 11 }, (_, t) => [t, 100 * 1.3 ** Math.ceil(t / 2) * 0.8 ** Math.floor(t / 2)] as [number, number]), color: 'var(--c4)' },
          { type: 'text', x: 9.6, y: 100 * 1.04 ** 5 - 12, text: `B: ${usd(100 * 1.04 ** 5)}`, color: 'var(--c4)', anchor: 'end' },
        ],
      }),
    },
    {
      kind: 'number', unit: '%',
      body: 'A portfolio falls **40%**. What percentage gain does it need to get back to where it started?',
      answer: (1 / 0.6 - 1) * 100, tol: 0.5,
      hint: 'After the fall you have $60 for every $100. What turns 60 back into 100?',
      widget: () => columnChart([{ label: 'start', value: 100, color: 'var(--c1)' }, { label: 'after −40%', value: 60, color: 'var(--c4)' }, { label: 'back to start', value: 100, color: 'var(--c3)' }], { format: (v) => usd(v), height: 170 }),
      explain: `100 ÷ 60 = 1.667, so it needs a **${num((1 / 0.6 - 1) * 100)}%** gain. A 50% loss needs a 100% gain.`,
    },
    {
      kind: 'choice',
      body: 'You can hold **one** stock, or an equal mix of **20** stocks, each with the same expected return and each moving independently of the others. Which gives a more predictable result?',
      options: [
        { text: 'The mix of 20', correct: true },
        { text: 'The single stock', why: 'One stock\'s good or bad year is your whole result; in the mix, one stock\'s bad luck is mostly offset by others\' good luck.' },
        { text: 'No difference: same expected return', why: 'Same average, but not the same spread. Mixing keeps the average and narrows the range.' },
      ],
      explain: 'The mix keeps the same expected return but its surprises partly cancel. That is diversification.',
    },
    {
      kind: 'read',
      title: 'Spreading out',
      body: 'Each dot is one simulated year for a portfolio (hypothetical stocks: average 7%, volatility 30%, independent). Slide the number of stocks and watch the cloud tighten around 7%.',
      widget: plotExplorer({
        params: [{ id: 'n', label: 'stocks', min: 1, max: 30, step: 1, value: 1 }],
        spec: (v) => ({
          x: [-70, 90], y: [0.3, 5.7], xlabel: 'one-year return %', size: [360, 170], ticks: [20, 10], grid: false,
          layers: [{ type: 'vline', x: 7, color: 'var(--muted)' }, { type: 'dots', pts: portfolios(v.n).map((x, k) => [x, 1 + (k % 5)] as [number, number]), color: 'var(--c1)', r: 4 }],
        }),
        readout: (v) => `${v.n} stock${v.n > 1 ? 's' : ''}: volatility about ${num(portfolioSD(30, v.n, 0))}%`,
      }),
    },
    {
      kind: 'estimate', format: (v: number) => `${v}%`,
      body: 'With **25** independent stocks, each with 30% volatility, about what is the volatility of the equal mix?',
      min: 0, max: 30, step: 1, answer: 6, tol: 1,
      hint: 'Volatility shrinks with the square root of the number of independent holdings.',
      explain: '30% ÷ √25 = 30% ÷ 5 = **6%**.',
    },
    {
      kind: 'read',
      title: 'Correlation',
      body: 'Real investments are not independent: in a recession many fall together. **Correlation** (from −1 to 1) measures how much two assets move together.\n\nWith every pair correlated at ρ, adding more holdings can only shrink volatility down to a floor of **σ × √ρ**. Diversification removes the risks that are particular to each holding, not the risk they all share.',
      widget: () => h('div', null, plotEl({
        x: [0, 10], y: [40, 200], xlabel: 'years', ylabel: '$', size: SZ, ticks: [2, 40],
        layers: (() => {
          const z = normals(77, 30), a = [100], b = [100], c = [100];
          for (let t = 0; t < 10; t++) {
            a.push(a[t] * (1.04 + 0.12 * z[t]));
            b.push(b[t] * (1.04 + 0.12 * (0.9 * z[t] + 0.44 * z[t + 10])));
            c.push(c[t] * (1.04 - 0.12 * z[t]));
          }
          const pts = (xs: number[]) => xs.map((v, t) => [t, v] as [number, number]);
          return [
            { type: 'line', pts: pts(a), color: 'var(--c1)' },
            { type: 'line', pts: pts(b), color: 'var(--c2)' },
            { type: 'line', pts: pts(c), color: 'var(--c3)' },
          ] as Layer[];
        })(),
      }), legendRow([{ label: 'A', color: 'var(--c1)' }, { label: 'B: moves with A', color: 'var(--c2)' }, { label: 'C: moves against A', color: 'var(--c3)' }])),
    },
    {
      kind: 'task',
      title: 'Below 15%',
      body: 'Each holding has **30%** volatility. Get the portfolio\'s volatility **below 15%**.',
      widget: plotExplorer({
        params: [
          { id: 'n', label: 'holdings', min: 1, max: 50, step: 1, value: 1 },
          { id: 'rho', label: 'correlation', min: 0, max: 1, step: 0.1, value: 0.6, format: (v) => v.toFixed(1) },
        ],
        spec: (v) => ({
          x: [1, 50], y: [0, 32], xlabel: 'holdings', ylabel: 'volatility %', size: SZ, ticks: [7, 5],
          layers: [
            { type: 'fn', f: (n) => portfolioSD(30, n, v.rho), color: 'var(--c1)', from: 1, to: 50 },
            { type: 'hline', y: 30 * Math.sqrt(v.rho), color: 'var(--c4)', label: 'floor' },
            { type: 'hline', y: 15, color: 'var(--c3)', dash: true },
            { type: 'dots', pts: [[v.n, portfolioSD(30, v.n, v.rho)]], color: 'var(--c2)', r: 6 },
          ],
        }),
        readout: (v) => `${v.n} holding${v.n > 1 ? 's' : ''}, correlation ${v.rho.toFixed(1)}: ${num(portfolioSD(30, v.n, v.rho))}%`,
        goal: (v) => portfolioSD(30, v.n, v.rho) < 15 - 1e-9,
        goalText: 'Below 15%: that took both many holdings and low correlation.',
      }),
      hint: 'At correlation 0.6 the floor is 30 × √0.6 ≈ 23%: no number of holdings gets you there.',
      explain: `Lower the correlation to **0.2 or less** and hold **17 or more**: at 0.2 and 20 holdings, ${num(portfolioSD(30, 20, 0.2))}%. At 0.3 the floor is ${num(30 * Math.sqrt(0.3))}%, so even 50 holdings can't do it.`,
    },
    {
      kind: 'match',
      body: 'Match each pair of businesses to how their fortunes are likely to move together.',
      heads: ['Pair', 'Correlation'],
      pairs: [
        ['Two airlines', 'strongly positive'],
        ['An umbrella maker and a sunscreen maker', 'negative'],
        ['A bakery in one town and a shipyard on another continent', 'near zero'],
      ],
      explain: 'Airlines share the same fuel prices and travel demand; rain helps umbrellas and hurts sunscreen; unrelated businesses in unrelated places barely move together.',
    },
    {
      kind: 'multi',
      body: 'Which of these lower a portfolio\'s overall risk?',
      options: [
        { text: 'Adding holdings that move independently of the rest', correct: true },
        { text: 'Spreading money across many industries and regions', correct: true },
        { text: 'Adding a holding that tends to rise when the others fall', correct: true },
        { text: 'Buying more of the stock you already own', why: 'That concentrates risk: it is still one company.' },
        { text: 'Replacing one stock with a second one that moves almost in lockstep', why: 'Highly correlated holdings share the same risk, so swapping one for the other changes little.' },
      ],
      explain: 'Risk falls when holdings don\'t all move together: independent, varied or opposite-moving assets offset one another.',
    },
    {
      kind: 'choice',
      title: 'Sequence of returns',
      widget: () => dataTable(['Year', '1', '2', '3', '4', '5'], [
        ['Bad first', ...SEQ.map((r) => pc(r, 0))],
        ['Good first', ...[...SEQ].reverse().map((r) => pc(r, 0))],
      ]),
      body: 'Two people each invest $500,000 and add or take out nothing. Over five years one gets returns of −20%, −10%, +10%, +15%, +25%; the other gets the same returns in reverse order. Who ends with more?',
      options: [
        { text: 'They end the same', correct: true },
        { text: 'The one with the bad years first', why: 'The order of multiplication doesn\'t change the product: 0.8 × 0.9 × 1.1 × 1.15 × 1.25 is the same either way.' },
        { text: 'The one with the good years first', why: 'Without money going in or out, each year just multiplies the balance, and order doesn\'t matter.' },
      ],
      explain: `Both end with ${usd(runSequence(500000, SEQ, 0)[5])}: multiplication doesn't care about order.`,
    },
    {
      kind: 'choice',
      body: 'Now both are retired and take out **$40,000 at the start of each year**. Same returns, opposite orders. Who ends with more?',
      widget: () => dataTable(['Year', '1', '2', '3', '4', '5'], [
        ['Bad first', ...SEQ.map((r) => pc(r, 0))],
        ['Good first', ...[...SEQ].reverse().map((r) => pc(r, 0))],
      ]),
      options: [
        { text: 'The one with the good years first', correct: true },
        { text: 'The one with the bad years first', why: 'Early losses hit the balance just as withdrawals shrink it further; the later gains then apply to a much smaller pile.' },
        { text: 'They end the same', why: 'That was true with no withdrawals. Withdrawals take a fixed amount whatever the balance, so the order now matters.' },
      ],
      explain: `Good years first: **${usd(SEQ_GOOD[5])}**. Bad years first: **${usd(SEQ_BAD[5])}**. Withdrawing during early losses locks them in.`,
    },
    {
      kind: 'read',
      title: 'Why order matters when money moves',
      body: 'With withdrawals, early losses sell more of the pile at low prices, and the later recovery has less to work on. The same is true in reverse while you are adding money. This **sequence risk** is one reason people often shift toward steadier investments near the time they will start drawing on them.',
      widget: () => plotEl({
        x: [0, 5], y: [0, 700], xlabel: 'years', ylabel: '$ thousands', size: SZ, ticks: [1, 100],
        layers: [
          { type: 'line', pts: SEQ_GOOD.map((b, t) => [t, K(b)] as [number, number]), color: 'var(--c3)', label: 'good first' },
          { type: 'line', pts: SEQ_BAD.map((b, t) => [t, K(b)] as [number, number]), color: 'var(--c4)' },
          { type: 'text', x: 4.9, y: K(SEQ_BAD[5]) - 80, text: 'bad first', color: 'var(--c4)', anchor: 'end' },
        ],
      }),
    },
    {
      kind: 'fill',
      body: 'Complete the summary.',
      template: 'Diversification keeps the expected return but shrinks volatility, because the [[0]] risks of each holding partly cancel; the risk they [[1]] remains.',
      blanks: [{ options: ['separate', 'shared', 'hidden'], answer: 0 }, { options: ['share', 'avoid', 'double'], answer: 0 }],
      explain: 'Each holding\'s **separate** surprises offset one another; the market-wide risk they **share** can\'t be diversified away.',
    },
  ],
  practice: [genRecovery, genVolDrag, genDiversify],
};

// ================================================================ lesson 6: fees and costs

const FEE_LOST = (f: number, years = 30, r = 0.07) => 1 - ((1 + r - f) / (1 + r)) ** years;
const FEE_ORDER = [
  { text: 'A 0.2% yearly fee', v: 10000 * 1.068 ** 30 },
  { text: 'A 5% upfront charge, then 0.2% a year', v: 9500 * 1.068 ** 30 },
  { text: 'A 1% yearly fee', v: 10000 * 1.06 ** 30 },
  { text: 'A 2% yearly fee', v: 10000 * 1.05 ** 30 },
].sort((a, b) => b.v - a.v);

const genFeeShare: Generator = (rng) => {
  const f = pick(rng, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]), r = pick(rng, [5, 6, 7, 8]), years = pick(rng, [20, 25, 30, 35, 40]);
  const lost = FEE_LOST(f / 100, years, r / 100) * 100;
  return {
    kind: 'number', unit: '%',
    body: `A fund returns **${r}% a year** before fees and charges **${f}% a year**. Over **${years} years**, what percentage of your final balance does the fee take, compared with no fee?`,
    answer: lost, tol: Math.max(0.5, lost * 0.03),
    hint: `Compare (1 + ${num((r - f) / 100)})^${years} with (1 + ${r / 100})^${years}.`,
    explain: `With the fee you end with (${num(1 + (r - f) / 100, 5)} ÷ ${1 + r / 100})^${years} = ${num(100 - lost)}% of the no-fee balance, so the fee takes **${num(lost)}%**.`,
  };
};

const genFeeDollars: Generator = (rng) => {
  const bal = randInt(rng, 5, 100) * 2000, f = pick(rng, [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2]);
  return {
    kind: 'number', unit: '$',
    body: `An account holds **${usd(bal)}** and charges a **${f}%** yearly fee. How much does that cost this year?`,
    answer: (bal * f) / 100, tol: 0.5,
    explain: `${usd(bal)} × ${f / 100} = **${usd((bal * f) / 100)}**, and it is charged again every year on a (hopefully) bigger balance.`,
  };
};

const genSurvivor: Generator = (rng) => {
  const start = pick(rng, [100, 200, 400, 500]);
  const closed = Math.round(start * randInt(rng, 2, 6) / 10);
  const survivors = start - closed;
  const beat = Math.round(survivors * randInt(rng, 1, 4) / 10);
  return {
    kind: 'number', unit: '%',
    body: `Hypothetical: ${start} funds launched 15 years ago. ${closed} were closed or merged after doing badly. Of the ${survivors} still running, ${beat} beat the index. A report studies **only the surviving funds**. What share does it say beat the index?`,
    answer: (beat / survivors) * 100, tol: 0.5,
    hint: 'Count only the funds the report can see.',
    explain: `${beat} ÷ ${survivors} = **${num((beat / survivors) * 100)}%**. Of all ${start} funds that started, only ${num((beat / start) * 100)}% both survived and beat the index.`,
  };
};

const lessonFees: Lesson = {
  id: 'fees',
  title: 'Fees and costs',
  goal: 'Measure what a small yearly fee costs over decades, and read fund records with care.',
  steps: [
    {
      kind: 'estimate', format: (v: number) => `${v}%`,
      body: 'You invest $100,000 for **30 years** at a hypothetical 7% a year. One option charges no fee; another charges **1% a year**, so you earn 6%. What share of the no-fee ending balance does the 1% fee take?',
      min: 0, max: 60, step: 1, answer: Math.round(FEE_LOST(0.01) * 100), tol: 3,
      hint: 'Compare 1.06³⁰ with 1.07³⁰.',
      explain: `1.06³⁰ ÷ 1.07³⁰ = ${num(1 - FEE_LOST(0.01))}, so the fee takes **${num(FEE_LOST(0.01) * 100)}%**: about a quarter of the ending balance, for "just 1%".`,
    },
    {
      kind: 'read',
      title: 'The gap grows',
      body: `The fee is charged every year on the whole balance, including all past growth, so the gap compounds too: after 30 years, ${usd(fv(100000, 0.07, 30))} against ${usd(fv(100000, 0.06, 30))}.`,
      widget: () => plotEl({
        x: [0, 30], y: [0, 850], xlabel: 'years', ylabel: '$ thousands', size: SZ,
        layers: [
          { type: 'area', f: (t) => K(fv(100000, 0.07, t)), base: (t) => K(fv(100000, 0.06, t)), from: 0, to: 30, color: 'var(--c4)' },
          { type: 'fn', f: (t) => K(fv(100000, 0.07, t)), color: 'var(--c3)', label: 'no fee' },
          { type: 'fn', f: (t) => K(fv(100000, 0.06, t)), color: 'var(--c1)' },
          { type: 'text', x: 29, y: K(fv(100000, 0.06, 30)) - 110, text: '1% fee', color: 'var(--c1)', anchor: 'end' },
        ],
      }),
    },
    {
      kind: 'number', unit: '$',
      body: 'An account of **$50,000** charges **1.5%** a year. How much is this year\'s fee?',
      answer: 750, tol: 0.5,
      widget: () => dataTable(['Balance', '1.5% fee'], [['$50,000', '?'], ['$100,000', '$1,500'], ['$200,000', '$3,000']]),
      explain: '$50,000 × 0.015 = **$750**. A percentage fee grows as your balance grows.',
    },
    {
      kind: 'task',
      title: 'Keep 80%',
      body: '$10,000 invested for **40 years** at 7% before fees. Find the **highest** yearly fee that still leaves you at least **80%** of the no-fee result.',
      widget: plotExplorer({
        params: [{ id: 'f', label: 'fee', min: 0, max: 2, step: 0.1, value: 1.5, format: (v) => `${v.toFixed(1)}%` }],
        spec: (v) => ({
          x: [0, 40], y: [0, 160], xlabel: 'years', ylabel: '$ thousands', size: SZ,
          layers: [
            { type: 'fn', f: (t) => K(fv(10000, 0.07, t)), color: 'var(--c3)' },
            { type: 'text', x: 31, y: 95, text: 'no fee', color: 'var(--c3)', anchor: 'end' },
            { type: 'fn', f: (t) => K(fv(10000, 0.07 - v.f / 100, t)), color: 'var(--c1)' },
            { type: 'hline', y: K(0.8 * fv(10000, 0.07, 40)), color: 'var(--c2)', label: '80%' },
          ],
        }),
        readout: (v) => `${v.f.toFixed(1)}% fee: you keep ${pc(1 - FEE_LOST(v.f / 100, 40), 1)} (${usd(fv(10000, 0.07 - v.f / 100, 40))})`,
        goal: (v) => 1 - FEE_LOST(v.f / 100, 40) >= 0.8 && 1 - FEE_LOST((v.f + 0.1) / 100, 40) < 0.8,
        goalText: 'Over 40 years, even half a percent is a fifth of the result.',
      }),
      hint: 'The answer is well under 1%.',
      explain: `**0.5%**: you keep ${pc(1 - FEE_LOST(0.005, 40))}. At 0.6% you keep only ${pc(1 - FEE_LOST(0.006, 40))}.`,
    },
    {
      kind: 'order',
      body: 'Four ways to pay for investing **$10,000** for 30 years at 7% before costs. Order by the final balance, **largest first**.',
      items: FEE_ORDER.map((o) => o.text),
      hint: 'A one-time charge is taken once; a yearly fee compounds against you every year.',
      explain: FEE_ORDER.map((o) => `${o.text}: ${usd(o.v)}`).join('; ') + '. A one-time 5% hurts less over 30 years than an extra 0.8% every year.',
    },
    {
      kind: 'read',
      title: 'Index funds and active funds',
      body: 'An **index fund** simply holds everything in a market, so it earns the market\'s return minus a small fee. An **active fund** picks what it thinks will do better, usually for a higher fee.\n\nHere is a piece of arithmetic: all investors together **are** the market. So before costs, the average actively managed dollar must earn the market return. After costs, the average active dollar must trail it by its extra costs.',
      widget: () => barChart([
        { label: 'Market', value: 7, color: 'var(--c3)' },
        { label: 'Active, before costs', value: 7, color: 'var(--c1)' },
        { label: 'Active, after 1%', value: 6, color: 'var(--c4)' },
        { label: 'Index, after 0.1%', value: 6.9, color: 'var(--c3)' }], { max: 8, format: (v) => `${v}%`, title: 'Hypothetical year: market returns 7% (active = average active dollar)' }),
    },
    {
      kind: 'choice',
      body: 'Why must the **average** actively managed dollar trail an index fund of the same market, after costs?',
      options: [
        { text: 'Before costs, active investors together earn the market average; their higher costs then come off', correct: true },
        { text: 'Active managers are less skilled than index funds', why: 'Skill isn\'t the point: it is arithmetic. Some active managers win, but their wins are other active managers\' losses.' },
        { text: 'Index funds are guaranteed not to lose money', why: 'Index funds fall when the market falls; the argument is only about the average result relative to the market.' },
      ],
      explain: 'Winners and losers among active investors cancel out to the market return, before costs. Subtract higher fees and trading costs, and the average active dollar comes out behind.',
    },
    {
      kind: 'match',
      body: 'A fund earns 7% a year before fees. Match each fee to roughly how much of the 30-year ending balance it takes.',
      heads: ['Yearly fee', 'Share lost'],
      pairs: ([0.001, 0.005, 0.01, 0.02] as const).map((f) => [`${pc(f)} a year`, `about ${Math.round(FEE_LOST(f) * 100)}%`] as [string, string]),
      hint: 'A 1% fee takes about a quarter, from the first question. The curve shows the rest.',
      widget: () => plotEl({ x: [0, 2], y: [0, 50], xlabel: 'yearly fee %', ylabel: '% of balance lost', size: SZ, ticks: [0.5, 10], layers: [{ type: 'fn', f: (f) => FEE_LOST(f / 100) * 100, color: 'var(--c4)' }] }),
      explain: [0.001, 0.005, 0.01, 0.02].map((f) => `${pc(f)}: ${num(FEE_LOST(f) * 100)}%`).join('; ') + '. Doubling the fee nearly doubles what it takes.',
    },
    {
      kind: 'read',
      title: 'The funds you never see',
      body: 'Funds that do badly are often **closed or merged** into others, and their records disappear from the lists. Here are 100 hypothetical funds started 15 years ago.',
      widget: () => h('div', null,
        iconArray(100, (i) => (i < 15 ? 0 : i < 60 ? 1 : 2), { cols: 20, colors: ['var(--c3)', 'var(--c1)', 'var(--line)'] }),
        legendRow([{ label: '15 survived and beat the index', color: 'var(--c3)' }, { label: '45 survived, trailed it', color: 'var(--c1)' }, { label: '40 closed or merged', color: 'var(--line)' }])),
    },
    {
      kind: 'number', unit: '%',
      body: 'A report today looks only at the funds still running. What percentage of **those** beat the index?',
      answer: 25, tol: 0.5,
      hint: '15 winners among how many survivors?',
      widget: () => iconArray(100, (i) => (i < 15 ? 0 : i < 60 ? 1 : 2), { cols: 20, colors: ['var(--c3)', 'var(--c1)', 'var(--line)'] }),
      explain: '15 ÷ 60 = **25%**. But of the 100 funds an investor could have picked 15 years ago, only **15%** survived and beat the index. Looking only at survivors flatters the record.',
    },
    {
      kind: 'multi',
      body: 'Which are examples of **survivorship bias**?',
      options: [
        { text: 'Judging fund managers by the funds that still exist today', correct: true },
        { text: 'Concluding a strategy works because everyone you hear about who used it got rich', correct: true },
        { text: 'Checking a fund\'s fee before buying it', why: 'That is just good practice: nothing has been filtered out of view.' },
        { text: 'Comparing all funds launched in a year, including the closed ones', why: 'That is the fix: counting the failures along with the survivors.' },
      ],
      explain: 'Survivorship bias is judging by what is left after the failures were filtered out. The cure is to count everyone who started.',
    },
    {
      kind: 'sort',
      body: 'Sort each habit by its effect on your total investing costs.',
      bins: ['Raises total cost', 'Lowers total cost'],
      items: [
        { text: 'Trading in and out often', bin: 0 },
        { text: 'Choosing a fund with a high yearly fee', bin: 0 },
        { text: 'Paying a sales charge on every deposit', bin: 0 },
        { text: 'Holding a low-fee index fund for years', bin: 1 },
        { text: 'Checking the fee before buying', bin: 1 },
      ],
      explain: 'Fees and trading costs are among the few things about investing you can control, and they compound just like returns do.',
    },
  ],
  practice: [genFeeShare, genFeeDollars, genSurvivor],
};

// ================================================================ lesson 7: big decisions

const CARS = {
  x: { name: 'Car X', price: 30000, resale: 15000, fuel: 1500, ins: 1200, maint: 500 },
  y: { name: 'Car Y', price: 18000, resale: 6000, fuel: 2500, ins: 900, maint: 1200 },
};
type CarT = typeof CARS.x;
const tco = (c: CarT, yrs = 5) => c.price - c.resale + yrs * (c.fuel + c.ins + c.maint);
const carRows = (c: CarT): [string, number][] => [['Lost value', c.price - c.resale], ['Fuel', 5 * c.fuel], ['Insurance', 5 * c.ins], ['Upkeep', 5 * c.maint]];
const carTable = () => dataTable(['', 'Car X', 'Car Y'], [
    ['Price', usd(CARS.x.price), usd(CARS.y.price)],
    ['Resale after 5 yrs', usd(CARS.x.resale), usd(CARS.y.resale)],
    ['Fuel / yr', usd(CARS.x.fuel), usd(CARS.y.fuel)],
    ['Insurance / yr', usd(CARS.x.ins), usd(CARS.y.ins)],
    ['Upkeep / yr', usd(CARS.x.maint), usd(CARS.y.maint)],
  ]);
const HOME = { price: 300000, down: 60000, rate: 0.06, tax: 0.01, maint: 0.01, opp: 0.04 };
const HOME_ROWS: [string, number][] = [
  ['Loan interest (6% of $240,000)', (HOME.price - HOME.down) * HOME.rate],
  ['Property tax (1%)', HOME.price * HOME.tax],
  ['Upkeep (1%)', HOME.price * HOME.maint],
  ['Lost return on $60,000 down (4%)', HOME.down * HOME.opp],
];
const HOME_COST = HOME_ROWS.reduce((a, r) => a + r[1], 0);

const genTCO: Generator = (rng) => {
  const price = randInt(rng, 12, 40) * 1000, resale = Math.round(price * randInt(rng, 3, 6) / 10 / 1000) * 1000;
  const yrs = pick(rng, [3, 4, 5, 6, 8]);
  const run = randInt(rng, 20, 60) * 100;
  const total = price - resale + yrs * run;
  return {
    kind: 'number', unit: '$',
    body: `A car costs **${usd(price)}** and sells for **${usd(resale)}** after **${yrs} years**. Fuel, insurance and upkeep come to **${usd(run)}** a year. What is its total cost of ownership over those years?`,
    answer: total, tol: 0.5,
    hint: 'What you lose on the price, plus the running costs.',
    explain: `${usd(price)} − ${usd(resale)} = ${usd(price - resale)} lost on the price, plus ${yrs} × ${usd(run)} = ${usd(yrs * run)}: **${usd(total)}**, or ${usd(total / yrs)} a year.`,
  };
};

const genOpp: Generator = (rng) => {
  const amt = randInt(rng, 2, 40) * 500, r = pick(rng, [3, 4, 5, 6, 7]), years = pick(rng, [10, 15, 20, 25, 30]);
  const v = fv(amt, r / 100, years);
  return {
    kind: 'number', unit: '$',
    body: `Spending **${usd(amt)}** today instead of investing it at a hypothetical **${r}% a year**: what could it have grown to in **${years} years**?`,
    answer: v, tol: Math.max(1, v * 0.01),
    hint: `${usd(amt)} × ${1 + r / 100}^${years}.`,
    explain: `${usd(amt)} × ${1 + r / 100}^${years} = **${usd(v)}**. That is the opportunity cost of spending it now.`,
  };
};

const genRentBuy: Generator = (rng) => {
  const price = randInt(rng, 15, 60) * 20000, rate = pick(rng, [4, 5, 6, 7]), opp = pick(rng, [3, 4, 5]);
  const down = price * 0.2;
  const cost = (price - down) * rate / 100 + price * 0.02 + down * opp / 100;
  const rent = Math.round((cost / 12) * pick(rng, [0.7, 0.8, 1.2, 1.3]) / 50) * 50;
  const rentCheaper = rent * 12 < cost;
  return {
    kind: 'choice',
    body: `A home costs **${usd(price)}** with 20% down. Hypothetical yearly unrecoverable costs: ${rate}% interest on the loan, 1% property tax, 1% upkeep, and a ${opp}% lost return on the down payment. A similar place rents for **${usd(rent)} a month**. On unrecoverable costs, which is cheaper?`,
    options: [
      { text: 'Renting', correct: rentCheaper, why: rentCheaper ? undefined : `Owning's unrecoverable costs are ${usd(cost / 12)} a month, less than ${usd(rent)} rent.` },
      { text: 'Buying', correct: !rentCheaper, why: rentCheaper ? `Owning costs ${usd(cost / 12)} a month in money you don't get back, more than the ${usd(rent)} rent.` : undefined },
    ],
    explain: `Owning: ${usd((price - down) * rate / 100)} interest + ${usd(price * 0.02)} tax and upkeep + ${usd(down * opp / 100)} lost return = ${usd(cost)} a year, **${usd(cost / 12)} a month**, against ${usd(rent)} rent.`,
  };
};

const lessonDecisions: Lesson = {
  id: 'decisions',
  title: 'Big decisions',
  goal: 'Compare big purchases by total cost, opportunity cost and cash that never comes back.',
  steps: [
    {
      kind: 'choice',
      body: 'Ignoring everything but the price: Car A costs **$20,000** and lasts 10 years; Car B costs **$12,000** and lasts 4 years (hypothetical). Which is cheaper **per year of use**?',
      options: [
        { text: 'Car A', correct: true },
        { text: 'Car B', why: 'Cheaper to buy, but you need a new one far sooner: $12,000 ÷ 4 = $3,000 a year.' },
        { text: 'The same', why: '$20,000 ÷ 10 = $2,000 a year; $12,000 ÷ 4 = $3,000 a year.' },
      ],
      explain: 'A: $2,000 a year. B: **$3,000** a year. The sticker price is not the cost: what matters is cost per year of use.',
    },
    {
      kind: 'read',
      title: 'Total cost of ownership',
      body: 'The full cost of owning something is what you pay, minus what you get back when you sell it, plus everything it costs to run. Two hypothetical cars kept for **5 years**:',
      widget: carTable,
    },
    {
      kind: 'number', unit: '$',
      body: 'Using the table, what is **Car Y\'s** total cost of ownership over 5 years? (Price − resale, plus 5 years of running costs.)',
      answer: tco(CARS.y), tol: 0.5,
      widget: carTable,
      hint: '$18,000 − $6,000, plus 5 × ($2,500 + $900 + $1,200).',
      explain: `$12,000 lost on the price + 5 × $4,600 = **${usd(tco(CARS.y))}**.`,
    },
    {
      kind: 'choice',
      widget: carTable,
      body: `Car X has a higher price (${usd(CARS.x.price)}) but keeps its value better and costs less to run. Over 5 years, which costs less in total?`,
      options: [
        { text: 'Car X', correct: true },
        { text: 'Car Y', why: `Y's lower price is more than eaten by its bigger loss in value and running costs: ${usd(tco(CARS.y))} against ${usd(tco(CARS.x))}.` },
        { text: 'They cost the same', why: `Work out X: ${usd(CARS.x.price - CARS.x.resale)} + 5 × ${usd(CARS.x.fuel + CARS.x.ins + CARS.x.maint)}.` },
      ],
      explain: `Car X: ${usd(CARS.x.price - CARS.x.resale)} + 5 × ${usd(CARS.x.fuel + CARS.x.ins + CARS.x.maint)} = **${usd(tco(CARS.x))}**, against ${usd(tco(CARS.y))} for Car Y.`,
    },
    {
      kind: 'read',
      title: 'The pricier car, the cheaper choice',
      body: 'Laid side by side, the sticker price is only part of the story.',
      widget: () => h('div', null,
        ledgers(ledger('Car X', carRows(CARS.x)), ledger('Car Y', carRows(CARS.y))),
        note('5 years each. Lost value = price − resale. Hypothetical round numbers; financing interest would add to both.')),
    },
    {
      kind: 'multi',
      body: 'Which belong in a car\'s total cost of ownership?',
      options: [
        { text: 'Loss of value while you own it', correct: true },
        { text: 'Insurance', correct: true },
        { text: 'Interest on a car loan', correct: true },
        { text: 'Fuel or charging', correct: true },
        { text: 'What you paid for your previous car', why: 'That money is gone whatever you do next: a sunk cost, not a cost of this car.' },
      ],
      explain: 'Everything this car will cost you from now on counts: lost value, running costs and financing. Past spending doesn\'t.',
    },
    {
      kind: 'read',
      title: 'Opportunity cost',
      body: 'Every dollar spent is a dollar not invested. The **opportunity cost** of a choice is the value of the best alternative you give up. For money, that alternative is often simply "it could have grown".',
    },
    {
      kind: 'number', unit: '$',
      body: 'You spend an extra **$5,000** on a nicer car instead of investing it at a hypothetical **5% a year**. What could it have grown to in **20 years**?',
      answer: fv(5000, 0.05, 20), tol: 30,
      hint: '$5,000 × 1.05²⁰.',
      explain: `$5,000 × 1.05²⁰ = **${usd(fv(5000, 0.05, 20))}**. That is what the upgrade really costs your future self, in today's money if 5% is a real return.`,
      widget: () => plotEl({ x: [0, 20], y: [0, 14], xlabel: 'years', ylabel: '$ thousands', size: SZ, layers: [{ type: 'fn', f: (t) => K(fv(5000, 0.05, t)), color: 'var(--c1)' }, { type: 'dots', pts: [[0, 5]], labels: ['$5,000'], color: 'var(--c1)' }] }),
    },
    {
      kind: 'read',
      title: 'Rent vs buy, as cash flows',
      body: '"Rent is throwing money away" leaves half the picture out. Owners throw money away too: on interest, taxes, upkeep, and the return their down payment could have earned. Paying down the loan itself is not a cost, since it becomes equity you get back.\n\nA hypothetical **$300,000** home with **$60,000** down, first year:',
      widget: () => ledgers(ledger('Owning: money you don\'t get back', HOME_ROWS, 'Per year')),
    },
    {
      kind: 'number', unit: '$',
      body: 'From that ledger, what are owning\'s unrecoverable costs **per month**?',
      answer: HOME_COST / 12, tol: 0.5,
      widget: () => ledgers(ledger('Owning: money you don\'t get back', HOME_ROWS, 'Per year')),
      hint: 'Add the four lines, then divide by 12.',
      explain: `${usd(HOME_COST)} ÷ 12 = **${usd(HOME_COST / 12)}** a month.`,
    },
    {
      kind: 'choice',
      body: `A similar home rents for **$1,700 a month**. On unrecoverable costs alone (owning: ${usd(HOME_COST / 12)} a month), which is cheaper?`,
      options: [
        { text: 'Renting', correct: true },
        { text: 'Buying, because rent is money thrown away', why: `So is ${usd(HOME_COST / 12)} a month of interest, tax, upkeep and lost return. Compare like with like.` },
        { text: 'Buying, because the whole mortgage payment builds wealth', why: 'Only the part that repays the loan builds equity. The interest part is a cost, just like rent.' },
      ],
      explain: `$1,700 rent against ${usd(HOME_COST / 12)} of owning costs: with these numbers renting is cheaper by ${usd(HOME_COST / 12 - 1700)} a month. Change the rates or the prices and the answer can flip, which is why it is worth doing the sum.`,
    },
    {
      kind: 'sort',
      body: 'For a homeowner, which money comes back to them and which is gone?',
      bins: ['Gone (a cost)', 'Comes back (as equity or cash)'],
      items: [
        { text: 'Mortgage interest', bin: 0 },
        { text: 'Property tax', bin: 0 },
        { text: 'Repairs and upkeep', bin: 0 },
        { text: 'The return the down payment could have earned', bin: 0 },
        { text: 'Repaying the loan principal', bin: 1 },
        { text: 'The down payment itself', bin: 1 },
      ],
      hint: 'Would you get it back if you sold the house at the price you paid?',
      explain: 'Principal repaid and the down payment are stored in the house as equity (if prices hold). Interest, taxes, upkeep and the lost return on the down payment are gone, just like rent.',
    },
    {
      kind: 'task',
      title: 'Break even',
      body: 'Using the same hypothetical home, find the monthly rent at which renting and owning cost the **same** in unrecoverable money.',
      widget: explorer({
        params: [{ id: 'rent', label: 'rent', min: 1000, max: 3000, step: 50, value: 1200, format: (v) => `$${v}` }],
        draw: (v) => columnChart([
          { label: 'Renting', value: v.rent, color: 'var(--c2)' },
          { label: 'Owning', value: HOME_COST / 12, color: 'var(--c1)' }], { max: 3000, format: (x) => usd(x), height: 180 }),
        readout: (v) => v.rent < HOME_COST / 12 ? 'Renting is cheaper' : v.rent > HOME_COST / 12 ? 'Owning is cheaper' : 'Break-even',
        goal: (v) => Math.abs(v.rent - HOME_COST / 12) < 1,
        goalText: 'Above this rent, owning costs less; below it, renting does.',
      }),
      hint: 'Match the rent to owning\'s monthly cost from the ledger.',
      explain: `**${usd(HOME_COST / 12)} a month** (${usd(HOME_COST)} a year). The "5% rule" some people use is this same sum with round guesses for each line.`,
    },
    {
      kind: 'fill',
      body: 'Complete the definition.',
      template: 'The opportunity cost of a choice is the value of the [[0]] you give up by making it.',
      blanks: [{ options: ['best alternative', 'money already spent', 'sticker price'], answer: 0 }],
      explain: 'The **best alternative** given up. Money already spent is a sunk cost; the sticker price is only one part of the cost.',
    },
  ],
  practice: [genTCO, genOpp, genRentBuy],
};

// ================================================================ lesson 8: money psychology

const CREEP = (() => {
  let inc = 50000, sp = 45000;
  const creep: [number, number][] = [[0, 45]], half: [number, number][] = [[0, 45]], incs: [number, number][] = [[0, 50]];
  for (let y = 1; y <= 10; y++) {
    const ni = inc * 1.03;
    sp += (ni - inc) / 2;
    inc = ni;
    incs.push([y, K(inc)]);
    creep.push([y, K(inc * 0.9)]);
    half.push([y, K(sp)]);
  }
  return { inc, sp, rate: 1 - sp / inc, creep, half, incs };
})();

const genLossAversion: Generator = (rng) => {
  const lose = randInt(rng, 2, 10) * 50, win = lose + randInt(rng, 1, 8) * 25;
  const ev = 0.5 * win - 0.5 * lose;
  return {
    kind: 'number', unit: '$',
    body: `A fair coin flip: heads you win **${usd(win)}**, tails you lose **${usd(lose)}**. What is the expected value of one flip?`,
    answer: ev, tol: 0.01,
    hint: 'Half the time each: ½ × win − ½ × loss.',
    explain: `½ × ${usd(win)} − ½ × ${usd(lose)} = **+${usd(ev, ev % 1 ? 2 : 0)}**. Positive, yet many people turn bets like this down unless the win is about twice the loss: losses loom larger than gains.`,
  };
};

const genMentalAccount: Generator = (rng) => {
  const card = randInt(rng, 5, 40) * 100, apr = pick(rng, [15, 18, 20, 22, 25]), sav = pick(rng, [0.5, 1, 1.5, 2, 3]);
  const gain = card * (apr - sav) / 100;
  return {
    kind: 'number', unit: '$ a year',
    body: `You keep **${usd(card)}** in savings earning **${sav}%**, and owe **${usd(card)}** on a card at **${apr}%**. If you used the savings to clear the card, how much better off would you be each year?`,
    answer: gain, tol: 0.5,
    hint: 'You stop paying the card\'s interest, but stop earning the savings interest.',
    explain: `Interest saved: ${usd(card * apr / 100)}. Interest given up: ${usd(card * sav / 100)}. Net **${usd(gain)}** a year. (Keeping some emergency cash can still be wise.)`,
  };
};

const genImplied: Generator = (rng) => {
  const now = randInt(rng, 1, 5) * 100, extraPct = pick(rng, [1, 2, 3, 5]), weeks = pick(rng, [1, 2, 4]);
  const extra = (now * extraPct) / 100;
  const yr = (1 + extraPct / 100) ** (52 / weeks) - 1;
  const opts = [
    { text: `about ${num(yr * 100, 2)}% a year`, correct: true },
    { text: `about ${extraPct}% a year`, why: `${extraPct}% is the gain for the ${weeks}-week wait, not for a whole year.` },
    { text: `about ${num((extraPct * 52) / weeks, 2)}% a year`, why: 'That scales the gain up to a year without compounding it.' },
  ].filter((o, i, a) => a.findIndex((x) => x.text === o.text) === i);
  return {
    kind: 'choice',
    body: `Someone takes **${usd(now)} now** rather than **${usd(now + extra)} in ${weeks} week${weeks > 1 ? 's' : ''}**. What yearly growth rate are they, in effect, turning down?`,
    options: opts,
    hint: `The wait grows the money by ${extraPct}%. There are ${num(52 / weeks)} such waits in a year, and growth compounds.`,
    explain: `${1 + extraPct / 100}^${num(52 / weeks)} − 1 ≈ **${num(yr * 100, 2)}%** a year. Giving up that much to have the money now is present bias at work.`,
  };
};

const lessonPsychology: Lesson = {
  id: 'psychology',
  title: 'Money psychology',
  goal: 'Spot loss aversion, mental accounting, present bias and lifestyle creep, and design defaults that work.',
  steps: [
    {
      kind: 'number', unit: '$',
      body: 'A fair coin flip: heads you win **$150**, tails you lose **$100**. What is the expected value of one flip?',
      answer: 25, tol: 0.01,
      hint: '½ × 150 − ½ × 100.',
      explain: '½ × $150 − ½ × $100 = **+$25**. On average you gain. Yet in experiments many people turn bets like this down.',
    },
    {
      kind: 'read',
      title: 'Loss aversion',
      body: 'Losing $100 tends to feel about **twice** as bad as winning $100 feels good (estimates vary, typically between 1.5 and 2.5 times). This **loss aversion** makes people refuse good bets, hold losing investments too long to avoid "making the loss real", and panic-sell in a fall.',
      widget: () => barChart([{ label: 'Win $100', value: 100, color: 'var(--c3)' }, { label: 'Lose $100', value: 200, color: 'var(--c4)' }], { format: (v) => (v === 100 ? '+1 unit of feeling' : '−2 units'), title: 'How it feels (rough model)' }),
    },
    {
      kind: 'choice',
      widget: () => barChart([{ label: 'Win $150', value: 150, color: 'var(--c3)' }, { label: 'Lose $100, felt double', value: 200, color: 'var(--c4)' }], { format: (v) => `${v} units` }),
      body: 'If losses feel **twice** as strong as gains, how does the $150 / $100 coin flip feel overall?',
      options: [
        { text: 'Like a loss, though on average it pays', correct: true },
        { text: 'Like a gain of $25', why: 'That is the money. The feeling counts the $100 loss double: ½ × 150 − ½ × 200 = −25.' },
        { text: 'Neutral', why: 'Work it out: ½ × 150 − ½ × (2 × 100) = 75 − 100 = −25.' },
      ],
      explain: 'Felt value: ½ × 150 − ½ × 2 × 100 = **−25**. The bet pays on average but feels bad, which is why people turn it down.',
    },
    {
      kind: 'number', unit: '$ a year',
      body: 'Jo keeps **$5,000** in a "house fund" earning **1%**, while carrying **$3,000** on a card at **20%**. If Jo used $3,000 of the fund to clear the card, how much better off would Jo be each year?',
      answer: 3000 * 0.19, tol: 0.5,
      widget: () => dataTable(['Box', 'Amount', 'Rate'], [['House fund', '$5,000', 'earns 1%'], ['Credit card', '$3,000 owed', 'costs 20%']]),
      hint: 'Interest saved on the card, minus interest no longer earned on $3,000.',
      explain: '$3,000 × 20% = $600 saved; $3,000 × 1% = $30 given up. **$570** a year better off.',
    },
    {
      kind: 'read',
      title: 'Mental accounting',
      body: 'Money is **fungible**: a dollar in the "house fund" is the same as a dollar owed on the card. But we put money in mental boxes ("savings is for the house", "a tax refund is fun money") and treat the boxes differently. Labels can be useful for sticking to goals, but they can also mean paying 20% while earning 1%.',
      widget: () => barChart([{ label: 'House fund earns', value: 50, color: 'var(--c3)' }, { label: 'Card costs', value: 600, color: 'var(--c4)' }], { format: (v) => `${usd(v)} a year` }),
    },
    {
      kind: 'read',
      title: 'Present bias',
      body: 'Asked to choose between **$100 today** and **$110 in a week**, many people take the $100. Asked to choose between **$100 in 52 weeks** and **$110 in 53 weeks**, most wait for the $110. It is the same one-week trade-off; only the distance from **now** changed.',
      widget: () => dataTable(['Choice', 'Sooner', 'Later', 'Most pick'], [['Near', '$100 today', '$110 in 1 week', 'sooner'], ['Far', '$100 in 52 weeks', '$110 in 53 weeks', 'later']]),
    },
    {
      kind: 'choice',
      body: 'Which pattern is **present bias**?',
      options: [
        { text: 'Planning to start saving next month, then putting it off again when next month arrives', correct: true },
        { text: 'Always choosing the larger amount, whenever it arrives', why: 'That is consistent patience, not a bias toward now.' },
        { text: 'Always choosing the money that comes sooner', why: 'Consistent impatience is a preference. Present bias is the inconsistency: patient about the future, impatient when the future becomes now.' },
      ],
      explain: 'Present bias is time inconsistency: we plan to be patient later, but "later" keeps turning into "now", when the immediate option wins.',
    },
    {
      kind: 'estimate', format: (v: number) => `${v}%`,
      body: 'Sam earns $50,000 and saves 10% ($5,000). Pay rises **3% every year**. Instead of spending every raise, Sam saves **half of each raise**. After **10 years**, roughly what is Sam\'s saving rate?',
      min: 0, max: 40, step: 1, answer: Math.round(CREEP.rate * 100), tol: 2,
      hint: `Pay after 10 years is about ${usd(CREEP.inc)}; half the extra is saved.`,
      explain: `Pay grows to ${usd(CREEP.inc)}; spending to ${usd(CREEP.sp)}. Saving rate: **${num(CREEP.rate * 100)}%**, double where Sam started, without ever cutting spending.`,
    },
    {
      kind: 'read',
      title: 'Lifestyle creep',
      body: '**Lifestyle creep** is spending rising in step with income, so the saving rate never moves. Sam\'s "save half of each raise" rule lets spending rise and the gap widen at the same time.',
      widget: () => h('div', null, plotEl({
        x: [0, 10], y: [40, 70], xlabel: 'years', ylabel: '$ thousands', size: SZ, ticks: [2, 5],
        layers: [
          { type: 'line', pts: CREEP.incs, color: 'var(--c3)' },
          { type: 'line', pts: CREEP.creep, color: 'var(--c4)', dash: true },
          { type: 'line', pts: CREEP.half, color: 'var(--c1)' },
        ],
      }), legendRow([{ label: 'pay', color: 'var(--c3)' }, { label: 'spending with creep (90% of pay)', color: 'var(--c4)' }, { label: 'spending, saving half of raises', color: 'var(--c1)' }])),
    },
    {
      kind: 'match',
      body: 'Match each behaviour to the bias behind it.',
      heads: ['Behaviour', 'Bias'],
      pairs: [
        ['Holding a falling stock to avoid locking in the loss', 'loss aversion'],
        ['Splurging a tax refund because it feels like free money', 'mental accounting'],
        ['Always meaning to start saving next year', 'present bias'],
        ['Upgrading car and flat every time pay rises', 'lifestyle creep'],
      ],
      explain: 'Fear of realizing a loss; money treated differently by its label; "later" that never comes; spending that rises with income.',
    },
    {
      kind: 'read',
      title: 'Make the good choice the default',
      body: 'Willpower is unreliable; **defaults** are not. In a well-known study of one company\'s retirement plan (Madrian and Shea, 2001), the share of new employees who joined rose from about **37%** to about **86%** when joining became the default and people had to opt out instead of opt in.',
      widget: () => barChart([{ label: 'Opt in', value: 37, color: 'var(--c2)' }, { label: 'Opt out', value: 86, color: 'var(--c3)' }], { max: 100, format: (v) => `${v}%`, title: 'New employees who joined the plan' }),
    },
    {
      kind: 'order',
      body: 'Put a "pay yourself first" month in order.',
      items: ['Pay arrives', 'An automatic transfer moves savings away', 'Bills are paid', 'The rest is free to spend'],
      explain: 'Saving comes **straight after** pay arrives, automatically, so it never depends on what is left at the end of the month.',
    },
    {
      kind: 'multi',
      body: 'Which are good **defaults** for your own money?',
      options: [
        { text: 'An automatic transfer to savings on payday', correct: true },
        { text: 'Raising your saving rate automatically with each raise', correct: true },
        { text: 'Paying the full card balance automatically each month', correct: true },
        { text: 'Saving whatever is left at the end of the month', why: 'That makes saving the leftover, which present bias and lifestyle creep usually shrink to nothing.' },
        { text: 'Keeping your card details saved on shopping sites', why: 'That makes spending the easy default, not saving.' },
      ],
      explain: 'Good defaults make the wise choice happen when you do nothing, and make impulsive spending take a little effort.',
    },
    {
      kind: 'fill',
      body: 'Complete the principle.',
      template: 'Make the good choice the [[0]], so that doing nothing means [[1]].',
      blanks: [{ options: ['default', 'exception', 'reward'], answer: 0 }, { options: ['saving', 'spending', 'deciding'], answer: 0 }],
      explain: 'Set it up once as the **default**, and inertia works for you: doing nothing means **saving**.',
    },
  ],
  practice: [genLossAversion, genMentalAccount, genImplied],
};

// ================================================================ course

export const finance: Course = {
  id: 'finance',
  title: 'Personal Finance',
  blurb: 'Compounding, inflation, debt, risk and fees: the maths of money, and the habits that make it work.',
  color: COLOR,
  icon: '🪙',
  lessons: [lessonCompound, lessonInflation, lessonDebt, lessonBudget, lessonRisk, lessonFees, lessonDecisions, lessonPsychology],
};

