// Decisions under uncertainty: trees, risk and ruin, bet sizing, the value of information,
// opportunity and sunk costs, option value, judging process not outcome, and calibration.
import type { Course, Generator } from '../types';
import { bankrollSim, calibrationQuiz, decisionTree, growthCurve, infoValue, luckGrid, money, stakeFinder } from '../widgets/decisions';
import { frac, num, pct, pick, randInt, shuffle } from '../ui';

/** Round away floating-point dust (0.1 × 3 = 0.30000000000000004). */
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- practice generators

// Lesson 1: trees
const genRiskySure: Generator = (rng) => {
  const sure = randInt(rng, 2, 8) * 100;
  const win = sure + randInt(rng, 2, 10) * 100;
  const lose = randInt(rng, 1, 5) * 100;
  let p = randInt(rng, 2, 8) / 10;
  if (Math.abs(r2(p * win - (1 - p) * lose) - sure) < 1e-9) p = p >= 0.5 ? p - 0.1 : p + 0.1;
  const ev = r2(p * win - (1 - p) * lose);
  const riskyBetter = ev > sure;
  return {
    kind: 'choice', ordered: true,
    body: `Option A pays ${money(sure)} for sure. Option B pays ${money(win)} with probability ${pct(p, 0)} and loses ${money(lose)} otherwise. Which is better **on average**?`,
    options: [
      { text: 'Option A', correct: !riskyBetter, why: riskyBetter ? `B averages ${money(ev)}, more than A’s ${money(sure)}.` : undefined },
      { text: 'Option B', correct: riskyBetter, why: riskyBetter ? undefined : `B’s big prize is tempting, but it averages only ${money(ev)}, less than A’s ${money(sure)}.` },
      { text: 'They’re equal', why: `Fold B back: ${num(p)} × ${money(win)} − ${num(r2(1 - p))} × ${money(lose)} = ${money(ev)}, which isn’t ${money(sure)}.` },
    ],
    hint: 'Fold the chance node back to a single number, its expected value.',
    explain: `B is worth ${num(p)} × ${money(win)} − ${num(r2(1 - p))} × ${money(lose)} = ${money(ev)} on average, against ${money(sure)} for A. So ${riskyBetter ? 'B' : 'A'} is better on average.`,
  };
};

const genBreakeven: Generator = (rng) => {
  const win = randInt(rng, 6, 15) * 100;
  const lose = randInt(rng, 1, 5) * 100;
  const sure = randInt(rng, 1, win / 100 - 1) * 100;
  const p = (sure + lose) / (win + lose);
  return {
    kind: 'number', prob: true,
    body: `A sure ${money(sure)}, or a gamble that pays ${money(win)} with probability *p* and loses ${money(lose)} otherwise. At what *p* are the two **equally good on average**?`,
    answer: p, tol: 0.006,
    hint: `Solve p × ${win} − (1 − p) × ${lose} = ${sure}.`,
    explain: `p × ${win} − (1 − p) × ${lose} = ${sure} gives p × ${win + lose} = ${sure + lose}, so p = ${frac(sure + lose, win + lose)} ≈ ${pct(p)}. Above that, take the gamble; below it, take the sure thing.`,
  };
};

const genTwoStage: Generator = (rng) => {
  const cost = pick(rng, [1000, 2000, 3000]);
  const pWin = pick(rng, [0.2, 0.25, 0.3, 0.4, 0.5]);
  const pGood = pick(rng, [0.6, 0.7, 0.8, 0.9]);
  const good = randInt(rng, 2, 6) * 5000;
  const bad = randInt(rng, 1, 4) * 5000;
  const node = r2(pGood * good - (1 - pGood) * bad);
  const ev = r2(pWin * node - cost);
  return {
    kind: 'number', unit: '$',
    body: `Preparing a bid costs ${money(cost)}. You win the contract with probability ${pct(pWin, 0)}. If you win, the job goes well (${pct(pGood, 0)}) for a profit of ${money(good)}, or badly for a loss of ${money(bad)}. What is the expected value of **bidding** (counting the bid cost; negative if it loses on average)?`,
    answer: ev, tol: 1,
    hint: 'Fold back from the right: first the value of winning, then the value of bidding.',
    explain: `Winning is worth ${num(pGood)} × ${money(good)} − ${num(r2(1 - pGood))} × ${money(bad)} = ${money(node)}. Bidding: ${num(pWin)} × ${money(node)} − ${money(cost)} = ${money(ev)}.`,
  };
};

// Lesson 2: ruin
const genSurvive: Generator = (rng) => {
  const p = pick(rng, [0.5, 0.6, 0.7, 0.8, 0.9]);
  const n = randInt(rng, 2, 8);
  const s = Math.pow(p, n);
  return {
    kind: 'number', prob: true,
    body: `Each round you stake **everything** on a bet you win with probability ${pct(p, 0)}. One loss and you’re broke. What’s the chance you’re still in the game after ${n} rounds?`,
    answer: s, tol: Math.min(0.006, Math.max(0.0005, s * 0.02)),
    hint: 'You need to win every single round.',
    explain: `You must win all ${n}: ${num(p)}^${n} ≈ ${pct(s)}. However good each bet is, going all-in again and again makes ruin almost certain.`,
  };
};

const genRuinYears: Generator = (rng) => {
  const r = pick(rng, [0.005, 0.01, 0.02, 0.03, 0.05]);
  const n = pick(rng, [10, 20, 30, 40, 50]);
  const p = 1 - Math.pow(1 - r, n);
  return {
    kind: 'number', prob: true,
    body: `A strategy has a ${pct(r)} chance each year of a loss that would wipe you out. Over ${n} years, what’s the chance it happens **at least once**?`,
    answer: p, tol: 0.006,
    hint: 'Find the chance it never happens, then take that from 1.',
    explain: `Surviving one year: ${num(1 - r)}. All ${n}: ${num(1 - r)}^${n} ≈ ${num(1 - p)}. So at least one wipe-out: ≈ ${pct(p)}. Small yearly risks of ruin pile up.`,
  };
};

// Lesson 3: sizing
const genKellyEven: Generator = (rng) => {
  const p = randInt(rng, 51, 75) / 100;
  const f = r2(2 * p - 1);
  return {
    kind: 'number', prob: true,
    body: `An even-money bet (win and you gain your stake; lose and you lose it) wins ${pct(p, 0)} of the time. What fraction of your bankroll does the Kelly rule say to stake each round?`,
    answer: f, tol: 0.005,
    hint: 'For even money, Kelly = chance of winning − chance of losing.',
    explain: `${pct(p, 0)} − ${pct(r2(1 - p), 0)} = ${pct(f, 0)}. The Kelly stake equals your edge.`,
  };
};

const genTwoRounds: Generator = (rng) => {
  const start = pick(rng, [100, 200, 500, 1000]);
  const f = pick(rng, [0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75]);
  const end = r2(start * (1 + f) * (1 - f));
  const order = pick(rng, ['win then lose', 'lose then win']);
  return {
    kind: 'number', unit: '$',
    body: `You start with ${money(start)} and stake ${pct(f, 0)} of whatever you have on each of two even-money bets. You ${order}. How much do you have now?`,
    answer: end, tol: 0.01,
    hint: `A win multiplies your money by ${num(1 + f)}, a loss by ${num(r2(1 - f))}.`,
    explain: `${money(start)} × ${num(1 + f)} × ${num(r2(1 - f))} = ${money(end)}. One win and one loss leave you down ${pct(r2(f * f), 0)}, in either order: the bigger the stake, the worse.`,
  };
};

const genKellyOdds: Generator = (rng) => {
  let b = 2, p = 0.4, f = 0;
  do {
    b = pick(rng, [2, 3, 4]);
    p = pick(rng, [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]);
    f = p - (1 - p) / b;
  } while (f < 0.04);
  return {
    kind: 'number', prob: true,
    body: `A bet pays **${b} to 1** (stake $1, win $${b} profit) and wins ${pct(p, 0)} of the time. Using Kelly, *p − q/b*, what fraction of your bankroll should you stake?`,
    answer: f, tol: 0.005,
    hint: `p = ${num(p)}, q = ${num(r2(1 - p))}, b = ${b}.`,
    explain: `${num(p)} − ${num(r2(1 - p))}/${b} = ${num(p)} − ${num((1 - p) / b)} ≈ ${pct(f)}.`,
  };
};

// Lesson 4: information
const genEVPI: Generator = (rng) => {
  const gain = pick(rng, [40, 60, 80, 100, 120, 150, 200]) * 1000;
  const loss = pick(rng, [20, 30, 40, 50, 60, 80, 100]) * 1000;
  const p = randInt(rng, 1, 9) / 10;
  const evNow = r2(p * gain - (1 - p) * loss);
  const launch = evNow > 0;
  const withInfo = r2(p * gain);
  const evpi = r2(withInfo - Math.max(0, evNow));
  return {
    kind: 'number', unit: '$',
    body: `A launch gains ${money(gain)} if it succeeds (${pct(p, 0)} likely) and loses ${money(loss)} if it flops. You can also not launch, for $0. What is **perfect information** about the outcome worth to you?`,
    answer: evpi, tol: 1,
    hint: 'Value deciding after you know, minus the value of deciding now.',
    explain: `Deciding now: launching averages ${money(evNow)}, so you’d ${launch ? 'launch' : 'not launch'}, worth ${money(Math.max(0, evNow))}. Knowing first, you launch only on success: ${num(p)} × ${money(gain)} = ${money(withInfo)}. The difference, ${money(evpi)}, is the most knowing could be worth.`,
  };
};

const genPayForInfo: Generator = (rng) => {
  const gain = pick(rng, [50, 80, 100, 150]) * 1000;
  const loss = pick(rng, [20, 40, 50, 60]) * 1000;
  const p = randInt(rng, 2, 8) / 10;
  const evNow = Math.max(0, p * gain - (1 - p) * loss);
  const evpi = r2(p * gain - evNow);
  let fee = Math.round(evpi * pick(rng, [0.5, 0.7, 1.4, 2]) / 1000) * 1000;
  if (fee === evpi) fee += 5000;
  const worth = fee < evpi;
  return {
    kind: 'choice', ordered: true,
    body: `A launch gains ${money(gain)} if it succeeds (${pct(p, 0)} likely) and loses ${money(loss)} otherwise; not launching is $0. A forecaster who is **never wrong** will tell you the outcome for ${money(fee)}. Is it worth paying?`,
    options: [
      { text: 'Yes', correct: worth, why: worth ? undefined : `Even perfect knowledge is worth only ${money(evpi)} here, less than the ${money(fee)} fee.` },
      { text: 'No', correct: !worth, why: worth ? `Knowing first is worth ${money(evpi)}, more than the ${money(fee)} fee.` : undefined },
      { text: 'Can’t tell until you hear what they’ll say', why: 'You can price information before you hear it: average over what it might tell you.' },
    ],
    hint: 'Work out the value of deciding now and the value of deciding with the answer in hand.',
    explain: `Now you’d ${p * gain - (1 - p) * loss > 0 ? 'launch' : 'stay out'}, worth ${money(evNow)}. Knowing first, you launch only on success: ${money(r2(p * gain))}. So the information is worth ${money(evpi)}, ${worth ? 'more' : 'less'} than the fee.`,
  };
};

// Lesson 5: costs
const genSunk: Generator = (rng) => {
  const spent = randInt(rng, 4, 40) * 5000;
  const left = randInt(rng, 2, 12) * 5000;
  let delta = randInt(rng, -5, 8) * 5000;
  if (delta === 0) delta = 5000;
  const worth = left + delta;
  const thing = pick(rng, ['an app', 'a warehouse', 'a film', 'a website', 'a prototype']);
  return {
    kind: 'number', unit: '$',
    body: `You’ve spent ${money(spent)} building ${thing}. Finishing will cost ${money(left)} more, and the finished thing will be worth ${money(worth)}. Unfinished, it’s worth nothing. How much better off are you if you **finish** rather than stop now (negative if worse)?`,
    answer: delta, tol: 1,
    hint: 'Only compare what’s still ahead of you.',
    explain: `Finish: ${money(worth)} − ${money(left)} = ${money(delta)}. Stop: $0. The ${money(spent)} is gone either way, so it doesn’t enter. ${delta > 0 ? 'Finish.' : 'Stop, however painful.'}`,
  };
};

const ACTIVITIES = ['freelance design work', 'tutoring', 'a weekend shift at a café', 'selling at a market stall', 'walking dogs', 'proofreading'];
const genOpportunity: Generator = (rng) => {
  const acts = shuffle(rng, ACTIVITIES).slice(0, 3);
  const vals = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3).map((v) => v * 40);
  const k = randInt(rng, 0, 2);
  const others = vals.filter((_, j) => j !== k);
  const best = Math.max(...others);
  const list = acts.map((a, j) => `${a} (${money(vals[j])})`).join(', ');
  return {
    kind: 'number', unit: '$',
    body: `You can spend Saturday on one of: ${list}. You choose **${acts[k]}**. What’s the opportunity cost of that choice?`,
    answer: best, tol: 0.01,
    hint: 'What’s the best thing you gave up? (Only one, since you could only do one.)',
    explain: `The best alternative was worth ${money(best)}. Not the sum: you could only have done one of them.${vals[k] < best ? ` Since that’s more than the ${money(vals[k])} you chose, money alone says you chose wrong.` : ''}`,
  };
};

// Lesson 6: options
const genOption: Generator = (rng) => {
  const price = randInt(rng, 8, 20) * 10000;
  const up = randInt(rng, 2, 12) * 10000;
  const down = randInt(rng, 1, 6) * 10000;
  const p = randInt(rng, 3, 7) / 10;
  const fee = Math.min(r2(p * up), r2((1 - p) * down));
  const evNow = r2(p * up - (1 - p) * down);
  return {
    kind: 'number', unit: '$',
    body: `A plot of land costs ${money(price)}. Next year it will be worth ${money(price + up)} if a new road is approved (${pct(p, 0)} likely) or ${money(price - down)} if not. Instead of buying now, you could buy an **option**: the right to buy at ${money(price)} once the road decision is known. What’s the most the option is worth, compared with your best choice today (buy now or don’t)?`,
    answer: fee, tol: 1,
    hint: 'With the option you only buy if the road is approved. Compare that with the best you can do today.',
    explain: `With the option: ${num(p)} × ${money(up)} = ${money(r2(p * up))}. Today, buying averages ${money(evNow)}, so your best today is ${money(Math.max(0, evNow))}. The option is worth up to ${money(r2(p * up))} − ${money(Math.max(0, evNow))} = ${money(fee)}.`,
  };
};

const PAIRS: [string, string][] = [
  ['Signing a five-year lease on an office', 'Trying a new note-taking app with a free trial'],
  ['Selling the family home', 'Rearranging the furniture'],
  ['Emailing an angry resignation letter', 'Drafting an angry letter and sleeping on it'],
  ['Deleting the only copy of a project folder', 'Renaming a project folder'],
  ['Getting a large tattoo', 'Dyeing your hair a bold colour'],
  ['Merging two companies', 'Running a two-week pilot of a new team process'],
  ['Pouring concrete foundations', 'Sketching floor plans'],
  ['Publishing a public statement for the company', 'Sharing a draft with two colleagues'],
];
const genReversible: Generator = (rng) => {
  const [hard, easy] = pick(rng, PAIRS);
  const [a, b] = rng() < 0.5 ? [hard, easy] : [easy, hard];
  return {
    kind: 'choice',
    body: `Which of these deserves slower, more careful thought?\n\n- ${a}\n- ${b}`,
    options: [
      { text: hard, correct: true },
      { text: easy, why: 'This one is easy to undo: try it, learn, and change course if it’s wrong.' },
      { text: 'Both equally', why: 'One of them can be undone cheaply and one can’t. That difference should set how long you deliberate.' },
    ],
    explain: `“${hard}” is hard or impossible to undo, so mistakes are permanent: slow down. The other is a two-way door: decide quickly and learn by doing.`,
  };
};

// Lesson 7: process
const genFailOnce: Generator = (rng) => {
  const p = pick(rng, [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]);
  const n = randInt(rng, 3, 10);
  const fail = 1 - Math.pow(p, n);
  return {
    kind: 'number', prob: true,
    body: `A sound strategy works ${pct(p, 0)} of the time. You use it on ${n} independent occasions. What’s the chance it fails **at least once**?`,
    answer: fail, tol: 0.006,
    hint: 'Take the chance it works every time from 1.',
    explain: `Works all ${n} times: ${num(p)}^${n} ≈ ${pct(1 - fail)}. So at least one failure: ≈ ${pct(fail)}. Good decisions produce bad outcomes regularly.`,
  };
};

const CASES: { act: string; good: boolean; win: string; lose: string }[] = [
  { act: 'checked the forecast (80% rain) and took an umbrella', good: true, win: 'it rained', lose: 'it stayed dry all day' },
  { act: 'drove home after several drinks', good: false, win: 'got home without incident', lose: 'was stopped by the police' },
  { act: 'put a lump of savings into a broad index fund for the long term', good: true, win: 'the market rose that year', lose: 'the market fell that year' },
  { act: 'bet the rent money on a 20-to-1 horse', good: false, win: 'the horse won', lose: 'the horse lost' },
  { act: 'left two hours early for an important flight', good: true, win: 'made the flight comfortably', lose: 'still missed it after a motorway closure' },
  { act: 'skipped the safety checks to save ten minutes', good: false, win: 'nothing went wrong', lose: 'the machine broke down' },
  { act: 'hired the candidate with the strongest track record and references', good: true, win: 'they excelled', lose: 'they quit after a month for family reasons' },
  { act: 'signed a contract without reading it', good: false, win: 'the terms turned out fine', lose: 'it contained a nasty penalty clause' },
];
const genResulting: Generator = (rng) => {
  const c = pick(rng, CASES);
  const lucky = rng() < 0.5;
  const who = pick(rng, ['Sam', 'Priya', 'Tom', 'Aisha', 'Leo', 'Mei']);
  const label = c.good ? (lucky ? 'Deserved' : 'Bad luck') : (lucky ? 'Dumb luck' : 'Comeuppance');
  const all: [string, string][] = [
    ['Deserved', 'Good decision, good outcome'],
    ['Bad luck', 'Good decision, bad outcome'],
    ['Dumb luck', 'Bad decision, good outcome'],
    ['Comeuppance', 'Bad decision, bad outcome'],
  ];
  return {
    kind: 'choice', ordered: true,
    body: `${who} ${c.act}, and ${lucky ? c.win : c.lose}. Which box does this belong in?`,
    options: all.map(([l, text]) => {
      const goodDecision = l === 'Deserved' || l === 'Bad luck';
      const goodOutcome = l === 'Deserved' || l === 'Dumb luck';
      return {
        text,
        correct: l === label,
        why: l === label ? undefined
          : goodDecision !== c.good
            ? `Judge the decision by what ${who} knew at the time, not by how it turned out: it was ${c.good ? 'sound' : 'poor'}.`
            : `The decision part is right, but the outcome was ${goodOutcome ? 'bad' : 'good'}: ${lucky ? c.win : c.lose}.`,
      };
    }),
    explain: `The decision was ${c.good ? 'sound' : 'poor'} given what ${who} knew; the outcome was ${lucky ? 'good' : 'bad'}. Separating the two is the whole skill.`,
  };
};

// Lesson 8: calibration
const genBrier: Generator = (rng) => {
  const f = randInt(rng, 1, 19) * 5 / 100;
  const happened = rng() < 0.5;
  const what = pick(rng, ['it rains tomorrow', 'the train is late', 'the project ships on time', 'the team wins on Saturday', 'the parcel arrives by Friday']);
  const s = Math.pow((happened ? 1 : 0) - f, 2);
  return {
    kind: 'number',
    body: `You give a ${pct(f, 0)} chance that ${what}. It ${happened ? '**does**' : '**doesn’t**'}. What is your Brier score, (forecast − outcome)², where the outcome is 1 if it happened and 0 if not?`,
    answer: Math.round(s * 10000) / 10000, tol: 0.0005,
    hint: `Forecast ${num(f)}, outcome ${happened ? 1 : 0}.`,
    explain: `(${num(f)} − ${happened ? 1 : 0})² = ${num(r2(Math.abs((happened ? 1 : 0) - f)))}² = ${num(Math.round(s * 10000) / 10000)}. Lower is better; confident misses cost the most.`,
  };
};

const genCalibCount: Generator = (rng) => {
  const n = pick(rng, [10, 20, 30, 40, 50]);
  const p = randInt(rng, 1, 9) / 10;
  const what = pick(rng, ['rain', 'a late train', 'a sell-out crowd', 'a delayed delivery']);
  return {
    kind: 'number',
    body: `On ${n} different days a forecaster gave a ${pct(p, 0)} chance of ${what}. If they’re **well calibrated**, on about how many of those days did it happen?`,
    answer: Math.round(n * p), tol: 0.5, unit: 'days',
    explain: `Calibrated means a ${pct(p, 0)} forecast comes true about ${pct(p, 0)} of the time: ${num(p)} × ${n} = ${Math.round(n * p)} days.`,
  };
};

const genAvgBrier: Generator = (rng) => {
  const n = 10;
  const f10 = randInt(rng, 5, 10);
  const f = f10 / 10;
  const k = randInt(rng, 3, 9);
  const avg = (k * (1 - f) ** 2 + (n - k) * f * f) / n;
  return {
    kind: 'number',
    body: `A forecaster says “${pct(f, 0)} chance of rain” on each of ${n} days. It rains on ${k} of them. What’s their **average** Brier score?`,
    answer: Math.round(avg * 10000) / 10000, tol: 0.002,
    hint: `Rainy days score (1 − ${num(f)})², dry days score ${num(f)}².`,
    explain: `${k} × ${num(r2(1 - f))}² + ${n - k} × ${num(f)}² = ${num(r2(k * (1 - f) ** 2))} + ${num(r2((n - k) * f * f))}, divided by ${n}: ≈ ${num(Math.round(avg * 10000) / 10000)}.${f10 === k ? ' Their forecast matched the frequency exactly, the best a constant forecast can do.' : ''}`,
  };
};

// ---------------------------------------------------------------- course

export const decisions: Course = {
  id: 'decisions',
  title: 'Decisions Under Uncertainty',
  blurb: 'Lay out choices, size your bets, price information, and judge decisions by their reasoning, not their luck.',
  color: '#f2a33a',
  icon: '⚖️',
  lessons: [
    {
      id: 'trees',
      title: 'Decision trees',
      goal: 'Lay out choices, chances and payoffs, then fold the tree back to a decision.',
      steps: [
        {
          kind: 'choice',
          body: 'You’re running a food stall at a festival. An **outdoor** pitch makes $900 if it’s sunny (70% likely) but loses $200 if it rains. An **indoor** pitch makes $500 whatever the weather. Which earns more on average?',
          options: [
            { text: 'Outdoor', correct: true },
            { text: 'Indoor', why: 'The sure $500 feels safer, but outdoor averages 0.7 × $900 − 0.3 × $200 = $570.' },
            { text: 'You can’t say without knowing the weather', why: 'You don’t need to know the weather, only its chances. That’s what makes a decision under uncertainty workable.' },
          ],
          explain: 'Outdoor averages 0.7 × $900 + 0.3 × (−$200) = $630 − $60 = $570, against $500 indoors.',
        },
        {
          kind: 'read',
          title: 'Draw it, then fold it back',
          body: 'A **decision tree** lays out, in time order, the **choices** you make (squares) and the **chances** you face (circles), with a payoff at the end of each branch.\n\nTo solve it, work from the right: replace each circle by its **expected value**, and each square by its **best** branch. Drag the chance of sun and watch the best choice flip.',
          widget: decisionTree({ sureLabel: 'Indoor', sure: 500, riskyLabel: 'Outdoor', upLabel: 'Sun', win: 900, downLabel: 'Rain', lose: -200, p: 0.7 }),
        },
        {
          kind: 'number', prob: true,
          body: 'At what chance of sun are the two pitches **equally good** on average?',
          answer: 7 / 11, tol: 0.006,
          hint: 'Solve p × 900 − (1 − p) × 200 = 500.',
          explain: '900p − 200 + 200p = 500, so 1100p = 700 and p = 7/11 ≈ 63.6%. That break-even point tells you how sure about the weather you need to be.',
        },
        {
          kind: 'number', unit: '$',
          body: 'A chance node has three branches: 50% for $40, 30% for $10, and the rest for −$20. What value does it fold back to?',
          answer: 19, tol: 0.01,
          hint: 'The last branch has probability 1 − 0.5 − 0.3.',
          explain: '0.5 × 40 + 0.3 × 10 + 0.2 × (−20) = 20 + 3 − 4 = $19. A chance node’s branches must add to 100%.',
        },
        {
          kind: 'choice', ordered: true,
          body: 'A **choice** node has two branches, already folded back to $300 and $100. What is the node worth?',
          options: [
            { text: '$300', correct: true },
            { text: '$200', why: 'Averaging is for chance nodes. At a choice node you pick, and you’d pick the better branch.' },
            { text: '$400', why: 'You only get to take one branch, so you can’t add them.' },
          ],
          explain: 'You control a choice node, so it’s worth its best branch: $300.',
        },
        {
          kind: 'number', unit: '$',
          body: 'Two stages now. Preparing a bid costs $2,000. You win the contract 30% of the time. If you win, the job goes well 80% of the time (profit $20,000) or badly (loss $10,000). First fold back the “won the contract” node: what’s it worth?',
          answer: 14000, tol: 1,
          explain: '0.8 × $20,000 − 0.2 × $10,000 = $16,000 − $2,000 = $14,000.',
        },
        {
          kind: 'number', unit: '$',
          body: 'Now fold back one more step. What’s the expected value of **bidding**, after the $2,000 cost? (Not bidding is worth $0.)',
          answer: 2200, tol: 1,
          hint: 'Win 30% of the time and get the node you just valued; pay the bid cost either way.',
          explain: '0.3 × $14,000 − $2,000 = $4,200 − $2,000 = $2,200. Better than $0, so bid, even though you’ll lose the bid most of the time.',
        },
        {
          kind: 'order',
          body: 'Put the steps of solving a decision tree in order.',
          items: [
            'List the choices and chance events in the order they happen',
            'Write a payoff at the end of every branch',
            'Starting from the right, replace each chance node by its expected value',
            'Replace each choice node by its best branch, working back to the start',
          ],
          explain: 'Lay it out forwards in time, then solve it backwards. That backward pass is called **folding back** (or backward induction).',
        },
      ],
      practice: [genRiskySure, genBreakeven, genTwoStage],
    },
    {
      id: 'ruin',
      title: 'Risk, variance and ruin',
      goal: 'See why a bet with positive expected value can still be a terrible idea.',
      steps: [
        {
          kind: 'number', unit: '$',
          body: 'You have $10,000 in savings. Someone offers a coin flip: stake all of it, and heads returns **$25,000**; tails, you lose the lot. What’s your expected **profit**?',
          answer: 2500, tol: 1,
          hint: 'Heads: +$15,000. Tails: −$10,000.',
          explain: '0.5 × $15,000 − 0.5 × $10,000 = +$2,500. A generous bet, on average.',
        },
        {
          kind: 'choice',
          body: 'So should most people take it?',
          options: [
            { text: 'No: half the time you lose everything, and that can’t be undone', correct: true },
            { text: 'Yes: a positive expected value is always worth taking', why: 'Expected value is a long-run average. With one shot and your whole savings at stake, you don’t get a long run.' },
            { text: 'Yes, if you’re feeling lucky', why: 'Feeling lucky doesn’t change the coin. The odds are 50/50 either way.' },
          ],
          explain: 'Expected value assumes you can average over many tries. If one bad outcome takes you out of the game, there’s nothing to average over.',
        },
        {
          kind: 'read',
          title: 'Going all-in, again and again',
          body: 'Repeat that bet, staking everything each time. Each round **multiplies** your money by 2.5 or by 0. The average keeps growing, but almost every run ends at zero.\n\nCompare staking 100% with staking 10% of whatever you have each round.',
          widget: bankrollSim({ p: 0.5, b: 1.5, fractions: [1, 0.1], rounds: 50, paths: 6, start: 100 }),
        },
        {
          kind: 'number', prob: true,
          body: 'Stake everything on that coin flip five times in a row. What’s the chance you still have any money at the end?',
          answer: 1 / 32, tol: 0.002,
          explain: 'You must win all five: (1/2)⁵ = 1/32 ≈ 3%. The other 97% of the time you’re broke.',
        },
        {
          kind: 'number', unit: '$',
          body: 'Yet the **expected** bankroll after those five rounds, starting from $10,000, keeps rising. Each round multiplies the average by 1.25. What is it?',
          answer: 10000 * 1.25 ** 5, tol: 5,
          hint: '$10,000 × 1.25⁵',
          explain: '$10,000 × 1.25⁵ ≈ $30,518. It comes entirely from the 1-in-32 runs that won five times and hold $976,563. The average is real, but almost nobody gets it.',
        },
        {
          kind: 'choice',
          body: 'Two side projects each have an expected profit of $5,000. **A** will make between $4,000 and $6,000. **B** loses $5,000 90% of the time and makes $95,000 10% of the time. You have $3,000 of savings and a $5,000 loss would put you in debt you can’t repay. Which suits you?',
          options: [
            { text: 'A', correct: true },
            { text: 'B', why: 'Same average, but 90% of the time B leaves you in debt you can’t repay. For you, the spread matters.' },
            { text: 'No difference: same expected value', why: 'Expected value ignores spread. Two bets with the same average can carry very different risks.' },
          ],
          explain: 'B checks out: −0.9 × $5,000 + 0.1 × $95,000 = $5,000. But its **variance** (spread) is huge, and its bad outcome is one you can’t absorb.',
        },
        {
          kind: 'number', prob: true,
          body: 'A strategy carries a 1% chance each year of a loss that would ruin you. Over 50 years, what’s the chance of ruin at least once?',
          answer: 1 - 0.99 ** 50, tol: 0.006,
          hint: 'Find the chance of surviving all 50 years first.',
          explain: '0.99⁵⁰ ≈ 0.605, so the chance of ruin is about 39.5%. A risk that sounds negligible each year becomes a coin flip over a lifetime.',
        },
        {
          kind: 'choice',
          body: 'Which rule best sums up this lesson?',
          options: [
            { text: 'Among the choices that keep you in the game, prefer higher expected value', correct: true },
            { text: 'Always take the highest expected value', why: 'That’s how you end up staking everything on a good coin flip, and losing it.' },
            { text: 'Avoid all risk', why: 'Avoiding all risk throws away good bets. The goal is to avoid ruin, not uncertainty.' },
          ],
          explain: 'Survive first, then maximise. Ruin is special because it ends every future bet too.',
        },
      ],
      practice: [genSurvive, genRuinYears],
    },
    {
      id: 'sizing',
      title: 'How much to bet',
      goal: 'Size a favourable bet so your money grows instead of draining away.',
      steps: [
        {
          kind: 'choice',
          body: 'An even-money bet wins 60% of the time: win and you gain your stake, lose and you lose it. You can play it 100 times, staking a fixed share of whatever you have each time. Which share will **typically** leave you richest?',
          options: [
            { text: '10%', correct: true },
            { text: '50%', why: 'Big stakes win big, but each loss halves you. Typically you end up with less than you started with.' },
            { text: '100%', why: 'A single loss wipes you out, and in 100 rounds you’re all but certain to lose at least once.' },
            { text: 'They’re all the same, the bet is favourable', why: 'Every stake has the same edge per dollar, but how much you stake changes how losses compound.' },
          ],
          explain: 'Let’s see why. The bet is good, but how much you stake decides whether you grow or shrink.',
        },
        {
          kind: 'read',
          title: 'Try it',
          body: 'Each line is one run of 100 rounds starting from $100. Try 10%, 20%, 50% and 100%. Run each a few times.',
          widget: bankrollSim({ p: 0.6, b: 1, fractions: [0.1, 0.2, 0.5, 1], rounds: 100, paths: 5, start: 100 }),
        },
        {
          kind: 'number', unit: '$',
          body: 'Start with $100 and stake 50% each time. You win once, then lose once. How much do you have?',
          answer: 75, tol: 0.01,
          explain: '$100 → $150 → $75. A win multiplies by 1.5 and a loss by 0.5, so one of each leaves 0.75 of your money, in either order.',
        },
        {
          kind: 'number', unit: '$',
          body: 'In a typical 10 rounds you win 6 and lose 4. Staking 50% each time from $100, where do you end up?',
          answer: 100 * 1.5 ** 6 * 0.5 ** 4, tol: 0.1,
          hint: '$100 × 1.5⁶ × 0.5⁴',
          explain: '$100 × 1.5⁶ × 0.5⁴ ≈ $71.19. You won most rounds and still lost money. At 10% stakes the same luck gives $100 × 1.1⁶ × 0.9⁴ ≈ $116.23.',
        },
        {
          kind: 'task',
          body: 'Find the stake that makes your money grow **fastest** in a typical run of this 60% even-money bet.',
          widget: stakeFinder(0.6, 1, 0.2),
          hint: 'Start low and creep up. The result rises, peaks, then falls.',
          explain: 'The peak is at 20%: about $749 after 100 typical rounds. The top is flat, so 18% to 22% are nearly as good, but go much past it and growth collapses.',
        },
        {
          kind: 'read',
          title: 'The Kelly stake',
          body: 'The stake that grows money fastest in the long run is the **Kelly** stake. For an even-money bet it’s simply your edge:\n\n**chance of winning − chance of losing** (60% − 40% = 20%)\n\nBelow it you grow more slowly but safely. Above it, risk rises and growth falls; at about **twice** Kelly growth stops altogether.',
          widget: growthCurve(0.6, 1, 0.6, [0.1, 0.2, 0.5]),
        },
        {
          kind: 'number', prob: true,
          body: 'An even-money bet wins 55% of the time. What’s the Kelly stake?',
          answer: 0.1, tol: 0.005,
          explain: '55% − 45% = 10% of your bankroll per round.',
        },
        {
          kind: 'number', prob: true,
          body: 'For bets that pay *b* to 1, Kelly is *p − q/b* (*p* = chance of winning, *q* = chance of losing). A bet pays 2 to 1 and wins half the time. What’s the Kelly stake?',
          answer: 0.25, tol: 0.005,
          hint: 'p = 0.5, q = 0.5, b = 2.',
          explain: '0.5 − 0.5/2 = 0.25: stake 25%. Better odds justify a bigger stake.',
        },
        {
          kind: 'choice',
          body: 'Many professional investors deliberately stake **half** the Kelly amount. Why?',
          options: [
            { text: 'Their estimate of the edge may be too high, and overbetting hurts far more than underbetting', correct: true },
            { text: 'Half-Kelly grows faster than Kelly', why: 'If your chances are right, Kelly grows fastest. Half-Kelly gives about three-quarters of the growth.' },
            { text: 'Full Kelly will eventually bankrupt you', why: 'Staking a fraction never takes you to exactly zero. The problem is wild swings, and Kelly on an overestimated edge is overbetting.' },
          ],
          explain: 'Your real edge is uncertain. Half-Kelly keeps about 75% of the growth with far smaller swings, and protects you if you’ve overestimated your chances.',
        },
      ],
      practice: [genKellyEven, genTwoRounds, genKellyOdds],
    },
    {
      id: 'information',
      title: 'The value of information',
      goal: 'Work out what knowing more is worth before you pay for it.',
      steps: [
        {
          kind: 'number', unit: '$',
          body: 'A product launch makes $100,000 if it succeeds (40% likely) and loses $50,000 if it flops. Not launching is $0. What’s the expected value of launching?',
          answer: 10000, tol: 1,
          explain: '0.4 × $100,000 − 0.6 × $50,000 = $40,000 − $30,000 = $10,000. So you’d launch.',
        },
        {
          kind: 'choice', ordered: true,
          body: 'A consultant can tell you, with certainty, whether the launch will succeed. What’s the **most** you should pay to hear it?',
          options: [
            { text: '$10,000', why: 'That’s what the decision is worth without the information, not what the information adds.' },
            { text: '$30,000', correct: true },
            { text: '$40,000', why: 'That’s what the decision is worth **with** the information. But you already have $10,000 without it.' },
            { text: '$100,000', why: 'If they say “success”, you’d have launched anyway. The information only helps when it stops you launching a flop.' },
          ],
          hint: 'If you knew the outcome, when would you launch?',
          explain: 'Knowing first, you launch only on success: 0.4 × $100,000 = $40,000. Deciding now is worth $10,000. The information adds $30,000: it saves you the $50,000 loss 60% of the time.',
        },
        {
          kind: 'read',
          title: 'What knowing is worth',
          body: '**Value of perfect information = value deciding after you know − value deciding now.**\n\nInformation only has value if it might **change what you do**. Slide the chance of success: when are you most in need of knowing?',
          widget: infoValue(100000, 50000, 0.4),
        },
        {
          kind: 'number', unit: '$',
          body: 'Same launch, but now success is 80% likely. What is perfect information worth?',
          answer: 10000, tol: 1,
          hint: 'Deciding now: 0.8 × 100,000 − 0.2 × 50,000.',
          explain: 'Now: $80,000 − $10,000 = $70,000. Knowing: 0.8 × $100,000 = $80,000. Worth $10,000. When you’re fairly sure already, there’s less to learn.',
        },
        {
          kind: 'choice',
          body: 'When is information worth the most?',
          options: [
            { text: 'When you’re close to the tipping point between options', correct: true },
            { text: 'When success is very unlikely', why: 'Then you wouldn’t launch, and the news would rarely change that.' },
            { text: 'When success is very likely', why: 'Then you’d launch, and the news would rarely change that.' },
          ],
          explain: 'The peak is at the break-even chance (here 1/3), where either choice is equally good and the news is most likely to flip it.',
        },
        {
          kind: 'choice',
          body: 'You’ve already decided to accept a job offer whatever the salary turns out to be. An agency offers to find out the exact salary for a fee. As far as **this decision** goes, what’s that information worth?',
          options: [
            { text: 'Nothing', correct: true },
            { text: 'About the fee they charge', why: 'The price of information says nothing about its value to you.' },
            { text: 'A lot, because salary matters', why: 'Salary matters, but you’ve said nothing it says would change your choice.' },
          ],
          explain: 'Information that can’t change your action can’t improve your outcome. Before you research, ask: what answer would make me choose differently?',
        },
        {
          kind: 'choice',
          body: 'Back to the launch at 40%. Instead of the consultant, you could run a **test market** that’s right 80% of the time. Is it worth more or less than $30,000?',
          options: [
            { text: 'Less', correct: true },
            { text: 'More', why: 'Nothing can beat knowing for certain. Perfect information is the upper bound.' },
            { text: 'Exactly $30,000', why: 'An imperfect test sometimes misleads you, so it must be worth less than the perfect version.' },
          ],
          explain: 'Perfect information is the ceiling. If a test costs more than $30,000, you can reject it without any more maths.',
        },
        {
          kind: 'number', unit: '$',
          body: 'Picture 100 such launches: 40 would succeed, 60 would flop. The test says “good” for 32 of the successes and 12 of the flops. You launch only on “good”. What’s your average profit **per launch decision** (total ÷ 100)?',
          answer: 26000, tol: 1,
          hint: '32 successes at +$100,000 and 12 flops at −$50,000.',
          explain: '32 × $100,000 − 12 × $50,000 = $2,600,000, or $26,000 per decision. Against $10,000 without the test, it’s worth $16,000: less than the $30,000 ceiling, as it must be.',
        },
      ],
      practice: [genEVPI, genPayForInfo],
    },
    {
      id: 'costs',
      title: 'Opportunity cost and sunk cost',
      goal: 'Count what you give up, and ignore what you can’t get back.',
      steps: [
        {
          kind: 'choice',
          body: 'You paid $60 for a non-refundable concert ticket. On the night you’re tired, and a friend invites you to a free dinner you’d enjoy more. What should decide it?',
          options: [
            { text: 'Which you’d enjoy more tonight', correct: true },
            { text: 'Go to the concert, or the $60 is wasted', why: 'The $60 is spent whether you go or not. Going to something you’d enjoy less doesn’t bring it back.' },
            { text: 'Go only if the ticket cost more than dinner would', why: 'Dinner is free and the ticket price can’t be recovered either way, so neither price matters now.' },
          ],
          explain: 'The $60 is a **sunk cost**: gone whatever you do. Only the futures in front of you differ, so compare those.',
        },
        {
          kind: 'read',
          title: 'Two costs, two rules',
          body: '**Sunk cost:** money, time or effort already spent that you can’t get back. It’s the same whichever option you choose, so leave it out.\n\n**Opportunity cost:** the value of the best option you give up by choosing this one. It’s invisible (no bill arrives), so put it in deliberately.',
        },
        {
          kind: 'number', unit: '$',
          body: 'On Saturday you could do freelance work for $300, tutor for $200, or go to a free festival. You go to the festival. What’s its opportunity cost?',
          answer: 300, tol: 0.01,
          explain: 'The best thing you gave up was the $300 of freelance work.',
        },
        {
          kind: 'choice',
          body: 'A friend says the festival really cost you $500: the $300 plus the $200. What’s wrong?',
          options: [
            { text: 'You could only have done one of the jobs, so you gave up only the best one', correct: true },
            { text: 'Nothing, $500 is right', why: 'You couldn’t freelance and tutor in the same day, so you never had $500 on offer.' },
            { text: 'The festival was free, so it cost nothing', why: 'No ticket price, but you still gave up $300 you could have earned.' },
          ],
          explain: 'Opportunity cost is the **next-best** option, not the sum of every alternative.',
        },
        {
          kind: 'number', unit: '$',
          body: 'A project has used $80,000 so far. Finishing costs $30,000 more, and the finished product will be worth $50,000. Abandoned, it’s worth nothing. How much better off are you if you finish rather than stop?',
          answer: 20000, tol: 1,
          hint: 'Leave out what’s already spent.',
          explain: 'Finish: $50,000 − $30,000 = +$20,000. Stop: $0. The project as a whole lost money, but that $80,000 is gone either way. From here, finishing is right.',
        },
        {
          kind: 'choice',
          body: 'Same project, but now the finished product would be worth only $25,000. What should you do?',
          options: [
            { text: 'Stop', correct: true },
            { text: 'Finish, or the $80,000 is wasted', why: 'That’s the sunk-cost trap. The $80,000 is gone; spending $30,000 to get $25,000 just loses another $5,000.' },
            { text: 'Finish, since it’s mostly done', why: 'How much is done doesn’t matter, only what finishing costs versus what it brings.' },
          ],
          explain: '$25,000 − $30,000 = −$5,000. Stopping now loses less. Throwing good money after bad is called the **sunk-cost fallacy**.',
        },
        {
          kind: 'number', unit: '$',
          body: 'You keep $20,000 in a current account paying 0%, when a savings account would pay 4% a year. What does that cost you each year?',
          answer: 800, tol: 0.01,
          explain: '4% of $20,000 = $800 a year. No fee appears on any statement, but it’s a real cost.',
        },
        {
          kind: 'choice',
          body: 'A manager says: “Building our own tool was free: the team’s salaries are paid anyway.” What’s missing?',
          options: [
            { text: 'What else the team could have built in that time', correct: true },
            { text: 'Nothing: salaries are a fixed cost', why: 'The salaries are fixed, but the team’s time isn’t free: it could have gone elsewhere.' },
            { text: 'The cost of the office space', why: 'That’s paid either way too. The missing cost is the work that didn’t get done.' },
          ],
          explain: 'Time has an opportunity cost even when no money changes hands. Ask: what would this time have produced otherwise?',
        },
      ],
      practice: [genSunk, genOpportunity],
    },
    {
      id: 'options',
      title: 'Reversible decisions and option value',
      goal: 'Know when to wait, when to act, and what keeping a choice open is worth.',
      steps: [
        {
          kind: 'choice',
          body: 'Which deserves more time and care?',
          options: [
            { text: 'Signing a five-year lease', correct: true },
            { text: 'Choosing a project tool with a free 30-day trial', why: 'You’ll use it daily, but if it’s wrong you can switch next month at little cost.' },
            { text: 'Both equally', why: 'One is easy to undo and one isn’t. That difference should set how long you deliberate.' },
          ],
          explain: 'The lease is hard to undo; the trial is designed to be undone. Spend your deliberation where mistakes stick.',
        },
        {
          kind: 'read',
          title: 'One-way and two-way doors',
          body: 'Some decisions are **two-way doors**: if you don’t like what’s on the other side, you walk back. Make those quickly and learn from what happens.\n\nOthers are **one-way doors**: hard or impossible to undo. Those reward slowing down, gathering information, or finding a way to keep your options open.\n\nKeeping an option open has a value you can calculate.',
        },
        {
          kind: 'number', unit: '$',
          body: 'A plot of land costs $100,000. Next year it will be worth $200,000 if a road is approved (50% likely) or $70,000 if not. What’s the expected profit of **buying now**?',
          answer: 35000, tol: 1,
          explain: '0.5 × $200,000 + 0.5 × $70,000 = $135,000, minus $100,000: +$35,000.',
        },
        {
          kind: 'number', unit: '$',
          body: 'Alternatively, pay the owner $5,000 now for an **option**: the right to buy at $100,000 after the road decision. You’d only buy if the road is approved. What’s the expected profit of this plan, after the $5,000?',
          answer: 45000, tol: 1,
          hint: 'Road: buy and gain $100,000. No road: walk away with $0.',
          explain: '0.5 × $100,000 + 0.5 × $0 − $5,000 = $45,000. Better than buying now: you’ve cut off the bad branch.',
        },
        {
          kind: 'number', unit: '$',
          body: 'What’s the **most** the option would be worth paying for?',
          answer: 15000, tol: 1,
          explain: 'Before its fee the option plan is worth $50,000, and buying now is worth $35,000. So the option is worth up to $15,000. That’s **option value**: the value of being able to decide after you learn more.',
        },
        {
          kind: 'choice',
          body: 'Which of these makes waiting **less** attractive?',
          options: [
            { text: 'Each month of delay loses you customers to a competitor', correct: true },
            { text: 'The decision can’t be undone', why: 'Irreversibility makes waiting more attractive: a mistake can’t be fixed later.' },
            { text: 'A big uncertainty will clear up next month', why: 'That makes waiting more valuable: you’ll soon decide with better information.' },
          ],
          explain: 'Waiting pays when information is coming and mistakes are permanent. It costs when delay itself is expensive. Weigh both.',
        },
        {
          kind: 'choice',
          body: 'Which move turns a one-way door into something closer to a two-way door?',
          options: [
            { text: 'Renting in a new city for six months before buying there', correct: true },
            { text: 'Buying quickly to lock in today’s price', why: 'That makes the commitment sooner and just as permanent.' },
            { text: 'Asking more friends what they think', why: 'That gathers opinions, but the decision is still just as hard to undo.' },
          ],
          explain: 'Renting first is a cheap, reversible experiment. You pay a little (rent) for the option to change your mind.',
        },
      ],
      practice: [genOption, genReversible],
    },
    {
      id: 'process',
      title: 'Good decision, bad luck',
      goal: 'Judge a decision by what was known when it was made, not by how it turned out.',
      steps: [
        {
          kind: 'choice',
          body: 'Alex drove home after several drinks and arrived safely. “See? It was fine.” Was it a good decision?',
          options: [
            { text: 'No: a bad decision that happened to turn out well', correct: true },
            { text: 'Yes: nothing went wrong', why: 'That’s judging the decision by its outcome. The risk Alex took was the same whether or not anything happened.' },
            { text: 'You can’t judge a decision until you know the outcome', why: 'You can: by what was known and what the risks were at the time.' },
          ],
          explain: 'A good outcome doesn’t make a decision good. Judging decisions by results is so common it has a name: **resulting**.',
        },
        {
          kind: 'read',
          title: 'Two things, not one',
          body: 'Every decision has a **quality** (was the reasoning sound, given what you knew?) and an **outcome** (how did it turn out?). Under uncertainty they come apart, and all four combinations happen.',
          widget: luckGrid(),
        },
        {
          kind: 'number', prob: true,
          body: 'A sound strategy works 70% of the time. You use it on 5 independent occasions. What’s the chance it fails **at least once**?',
          answer: 1 - 0.7 ** 5, tol: 0.006,
          hint: 'Find the chance it works all 5 times first.',
          explain: '0.7⁵ ≈ 0.168, so at least one failure is about 83% likely. Good decisions will regularly lead to bad outcomes; that alone isn’t evidence of a mistake.',
        },
        {
          kind: 'choice',
          body: 'At poker you put all your chips in as an 80% favourite. Your opponent hits a lucky card and you lose. Was going all-in a mistake?',
          options: [
            { text: 'No: you’d make that play every time you could', correct: true },
            { text: 'Yes: you lost your chips', why: 'You lost, but you’d win 4 times in 5 making the same play. The loss was the 1.' },
            { text: 'Yes: you should never risk everything', why: 'Avoiding ruin matters for your life savings, not for chips at a table where you can buy in again. Here the play is simply strong.' },
          ],
          explain: 'Losing a 4-to-1 favourite is bad luck, not bad play. Changing your strategy because of it would make you worse.',
        },
        {
          kind: 'choice',
          body: 'Two analysts. Dana made a carefully reasoned investment that lost money. Eli made a reckless bet that paid off handsomely. Based on these results alone, whom should you trust with the next decision?',
          options: [
            { text: 'Look at their reasoning: one result each tells you little', correct: true },
            { text: 'Eli: results are what count', why: 'That’s resulting. Rewarding reckless bets that happen to win encourages more of them, until one doesn’t.' },
            { text: 'Dana: the loss proves she was careful', why: 'A bad outcome isn’t proof of good process either. You still have to check the reasoning.' },
          ],
          explain: 'With single outcomes, luck dominates. Judge the reasoning, and judge results only over many decisions.',
        },
        {
          kind: 'order',
          body: 'Put the steps of a fair decision review in order.',
          items: [
            'Write down what you knew and expected before deciding',
            'Make the decision and record it',
            'See how it turned out',
            'Ask which parts of the result were skill and which were luck',
            'Change your process only where the reasoning was wrong',
          ],
          explain: 'Writing down your reasoning beforehand protects you from **hindsight bias**: once you know the outcome, it always looks like it was obvious.',
        },
        {
          kind: 'choice',
          body: 'So when **should** a bad outcome make you doubt your process?',
          options: [
            { text: 'When bad outcomes keep coming more often than your estimates said they would', correct: true },
            { text: 'Every time something goes wrong', why: 'A 70% strategy should fail about 3 times in 10. One failure is expected.' },
            { text: 'Never: process is all that matters', why: 'Outcomes are evidence too. Over many decisions they show whether your estimates were right.' },
          ],
          explain: 'One outcome is noise; a pattern is a signal. Checking whether your chances come true as often as you said is called calibration, the next lesson.',
        },
      ],
      practice: [genFailOnce, genResulting],
    },
    {
      id: 'calibration',
      title: 'Thinking in bets',
      goal: 'State your confidence as a probability, and check you’re right that often.',
      steps: [
        {
          kind: 'estimate',
          body: 'A forecaster says “70% chance of rain” on 20 different days. If she’s **well calibrated**, on how many of those days does it rain?',
          min: 0, max: 20, step: 1, answer: 14, tol: 0, format: (v) => `${v} days`,
          explain: '70% of 20 = 14. On the other 6 it stays dry, and that’s not a failure: a 70% forecast should miss 30% of the time.',
        },
        {
          kind: 'read',
          title: 'How sure are you, really?',
          body: 'You’re **calibrated** if, of all the things you call 70% likely, about 70% happen. Most people are **overconfident**: their “90% sure” is right far less than 90% of the time.\n\nTry it. For each claim, say how likely it is to be true. Your score is explained in a moment; lower is better.',
          widget: calibrationQuiz(8),
        },
        {
          kind: 'choice',
          body: 'Forecaster A says 90% on every forecast and is right 70% of the time. Forecaster B says 70% on every forecast and is right 70% of the time. Who’s better calibrated?',
          options: [
            { text: 'B', correct: true },
            { text: 'A', why: 'A sounds more confident, but claims 90% and delivers 70%: overconfident.' },
            { text: 'Both the same: both are right 70% of the time', why: 'They’re equally accurate, but only B’s stated confidence matches how often she’s right.' },
          ],
          explain: 'Calibration means your stated confidence matches your hit rate. B says 70% and is right 70% of the time.',
        },
        {
          kind: 'number',
          body: 'A simple way to score a forecast is the **Brier score**: (forecast − outcome)², with outcome 1 if it happened and 0 if not. Lower is better. You say 80% chance of rain, and it rains. What’s your score?',
          answer: 0.04, tol: 0.0005,
          explain: '(0.8 − 1)² = (−0.2)² = 0.04. Close to 0: a good forecast.',
        },
        {
          kind: 'number',
          body: 'You say 80% chance of rain, and it **stays dry**. What’s your score now?',
          answer: 0.64, tol: 0.0005,
          explain: '(0.8 − 0)² = 0.64. Squaring makes confident misses expensive. Saying 50% always scores 0.25, so beating 0.25 means you know something.',
        },
        {
          kind: 'number',
          body: 'Over 10 days it rains on 7. Forecaster A said 70% every day. What’s A’s **average** Brier score?',
          answer: 0.21, tol: 0.002,
          hint: 'Rainy days score (1 − 0.7)², dry days score 0.7².',
          explain: '7 × 0.09 + 3 × 0.49 = 0.63 + 1.47 = 2.10, divided by 10: 0.21. A forecaster who said 100% every day would score 3 ÷ 10 = 0.30: worse, despite sounding surer.',
        },
        {
          kind: 'choice',
          body: 'You say you’re “90% sure” your project will ship on time. A colleague offers a bet: you win $1 if it ships on time and pay $9 if it’s late. If you really believe 90%, this bet is fair. You find yourself hesitating. What does that suggest?',
          options: [
            { text: 'Your real confidence is lower than 90%', correct: true },
            { text: 'Nothing: betting is just uncomfortable', why: 'A $9 stake is small. If you truly believed 90%, the bet would be break-even and easy to take.' },
            { text: 'You should be more confident', why: 'Hesitation is a sign your gut puts the chance below 90%, not above.' },
          ],
          explain: 'At 90%, the bet averages 0.9 × $1 − 0.1 × $9 = $0. “Would I bet on it?” is a quick test of whether you mean the number you said.',
        },
        {
          kind: 'choice',
          body: 'Which habit best guards against overconfidence when you say “90% sure”?',
          options: [
            { text: 'Imagine ten claims like this one and ask whether you’d really be wrong only once', correct: true },
            { text: 'Use 90% only for things you feel strongly about', why: 'Strong feelings are exactly what overconfidence is made of. Feeling sure is not the same as being right 90% of the time.' },
            { text: 'Always say 50% to be safe', why: 'That avoids embarrassment but throws away what you know. It scores 0.25 every time.' },
          ],
          explain: 'Thinking in frequencies (“1 in 10 of these will be wrong”) makes the number concrete. Then keep score, and adjust.',
        },
      ],
      practice: [genBrier, genCalibCount, genAvgBrier],
    },
  ],
};
