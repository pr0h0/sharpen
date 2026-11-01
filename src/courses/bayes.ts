// Bayesian thinking: base rates, natural frequencies, updating, likelihood ratios, and the
// classic mix-ups of P(A|B) with P(B|A). Builds on the 99%-accurate test that ends Probability.
import type { Course, Generator, Rng } from '../types';
import { dots } from '../widgets/prob';
import { bayesLab, freqTree, mysteryCoin, oddsStacker, oddsStr, treeFill } from '../widgets/bayes';
import { num, pct, pick, randInt } from '../ui';

const C = { a: '#4f8cff', b: '#f2a33a', c: '#43b581', d: '#e5534b', e: '#a371f7', mute: '#8b95a7' };

/** Tolerance for a probability answer: tighter for small ones, never silly. */
const ptol = (p: number) => Math.max(0.002, Math.min(0.006, 0.03 * Math.min(p, 1 - p)));
const n = (v: number) => num(v);
/** Percent with up to 1 decimal, e.g. 0.005 -> "0.5%". */
const P = (p: number) => pct(p, 1);

// ---------------------------------------------------------------- practice generators

interface Groups { a: string; b: string; tp: string; ts: string }
const GROUPS: Groups[] = [
  { a: 'librarians', b: 'salespeople', tp: 'are quiet and love books', ts: 'is quiet and loves books' },
  { a: 'professional chess players', b: 'software developers', tp: 'love puzzles', ts: 'loves puzzles' },
  { a: 'poets', b: 'teachers', tp: 'keep a journal', ts: 'keeps a journal' },
  { a: 'marathon runners', b: 'office workers', tp: 'are very lean', ts: 'is very lean' },
  { a: 'jazz musicians', b: 'accountants', tp: 'stay up past midnight', ts: 'stays up past midnight' },
  { a: 'surgeons', b: 'nurses', tp: 'are calm under pressure', ts: 'is calm under pressure' },
];

function groupNumbers(rng: Rng) {
  const g = pick(rng, GROUPS);
  // nA multiple of 10 and pA multiple of 10 -> integer; nB multiple of 100 -> integer.
  const nA = pick(rng, [10, 20, 40, 50]);
  const nB = pick(rng, [200, 400, 500, 1000]);
  const pA = pick(rng, [50, 60, 70, 80, 90]);
  const pB = pick(rng, [5, 10, 15, 20, 25, 30]);
  const a = (nA * pA) / 100, b = (nB * pB) / 100;
  return { g, nA, nB, pA, pB, a, b };
}

const genBaseRate: Generator = (rng) => {
  const { g, nA, nB, pA, pB, a, b } = groupNumbers(rng);
  const p = a / (a + b);
  return {
    kind: 'number', prob: true,
    body: `A town has ${nA} ${g.a} and ${n(nB)} ${g.b}. ${pA}% of the ${g.a} ${g.tp}; so do ${pB}% of the ${g.b}. You meet one of these people, who ${g.ts}. What's the chance they're one of the **${g.a}**?`,
    answer: p, tol: ptol(p),
    hint: 'Count the people who fit in each group, then compare.',
    explain: `${pA}% of ${nA} = ${n(a)} ${g.a} fit; ${pB}% of ${n(nB)} = ${n(b)} ${g.b} fit. So ${n(a)} of the ${n(a + b)} who fit: ≈ ${P(p)}.`,
  };
};

const genWhoMoreLikely: Generator = (rng) => {
  let r = groupNumbers(rng);
  while (r.a === r.b) r = groupNumbers(rng);
  const { g, nA, nB, pA, pB, a, b } = r;
  const aWins = a > b;
  return {
    kind: 'choice',
    body: `There are ${nA} ${g.a} and ${n(nB)} ${g.b} in a town. ${pA}% of the ${g.a} ${g.tp}, but only ${pB}% of the ${g.b} do. Someone from these groups ${g.ts}. Which are they more likely to be?`,
    options: [
      { text: `One of the ${g.a}`, correct: aWins, why: aWins ? undefined : `The description fits the ${g.a} better, but there are so many ${g.b} that more of the people who fit are ${g.b}: ${n(b)} against ${n(a)}.` },
      { text: `One of the ${g.b}`, correct: !aWins, why: aWins ? `There are more ${g.b}, but the trait is so much rarer among them that only ${n(b)} fit, against ${n(a)} ${g.a}.` : undefined },
      { text: 'Equally likely', why: `Count the people who fit: ${n(a)} ${g.a} against ${n(b)} ${g.b}.` },
    ],
    explain: `${pA}% of ${nA} = ${n(a)}; ${pB}% of ${n(nB)} = ${n(b)}. Weigh how well the description fits by how many people are in each group.`,
  };
};

const CONDS = ['a rare infection', 'an allergy', 'a vitamin deficiency', 'a gene variant', 'a thyroid condition'];

/** Screening numbers out of 10,000 that always give whole people. */
function screen10k(rng: Rng) {
  const base = pick(rng, [1, 2, 5, 10, 20]); // percent
  const sens = pick(rng, [60, 70, 80, 90, 95]);
  const fpr = pick(rng, [1, 2, 3, 5, 10]);
  const sick = base * 100; // of 10,000
  const well = 10000 - sick; // multiple of 100
  const tp = (sick * sens) / 100, fp = (well * fpr) / 100;
  return { cond: pick(rng, CONDS), base, sens, fpr, sick, well, tp, fp };
}

const genTreeCount: Generator = (rng) => {
  const s = screen10k(rng);
  const ask = pick(rng, ['true', 'false', 'all'] as const);
  const answer = ask === 'true' ? s.tp : ask === 'false' ? s.fp : s.tp + s.fp;
  const q = ask === 'true' ? 'how many **have it and test positive**'
    : ask === 'false' ? 'how many **don’t have it but test positive**' : 'how many test **positive in total**';
  return {
    kind: 'number',
    body: `${s.base}% of people have ${s.cond}. A test catches ${s.sens}% of people who have it, and wrongly flags ${s.fpr}% of people who don't. Out of 10,000 people tested, ${q}?`,
    answer, tol: 0.5, unit: 'people',
    hint: 'First split the 10,000 into who has it and who doesn’t.',
    explain: `${s.base}% of 10,000 = ${n(s.sick)} have it, and ${s.sens}% of them = ${n(s.tp)} test positive. ${n(s.well)} don't, and ${s.fpr}% of them = ${n(s.fp)} test positive anyway. ${ask === 'all' ? `Total: ${n(s.tp)} + ${n(s.fp)} = ${n(s.tp + s.fp)}.` : ''}`,
  };
};

const genTreePost: Generator = (rng) => {
  const s = screen10k(rng);
  const p = s.tp / (s.tp + s.fp);
  return {
    kind: 'number', prob: true,
    body: `${s.base}% of people have ${s.cond}. A test catches ${s.sens}% of them, and flags ${s.fpr}% of people who don't have it. Someone tests positive. What's the chance they **have it**?`,
    answer: p, tol: ptol(p),
    hint: 'Imagine 10,000 people. How many positives are real, and how many are false alarms?',
    explain: `Of 10,000: ${n(s.sick)} have it, ${n(s.tp)} of them test positive. Of the ${n(s.well)} who don't, ${n(s.fp)} test positive. So ${n(s.tp)} of ${n(s.tp + s.fp)} positives are real: ≈ ${P(p)}.`,
  };
};

const genScreen: Generator = (rng) => {
  // Base rates are multiples of 0.1%, so out of 100,000 every count is a whole number.
  const b = pick(rng, [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2]);
  const s = pick(rng, [80, 90, 95, 99]) / 100;
  const f = pick(rng, [1, 2, 5, 10]) / 100;
  const sick = Math.round(100000 * b), well = 100000 - sick;
  const tp = Math.round(sick * s), fp = Math.round(well * f);
  const p = (b * s) / (b * s + (1 - b) * f);
  return {
    kind: 'number', prob: true,
    body: `A test catches ${pct(s, 0)} of people with ${pick(rng, CONDS)} and gives a false positive for ${pct(f, 0)} of people without it. Among the people being tested, ${P(b)} have it. Someone tests positive. What's the chance they really **have it**?`,
    answer: p, tol: ptol(p),
    hint: 'Picture 100,000 people tested.',
    explain: `Out of 100,000: ${n(sick)} have it and ${n(tp)} of them test positive; ${n(well)} don't and ${n(fp)} of them test positive. ${n(tp)} / ${n(tp + fp)} ≈ ${P(p)}.`,
  };
};

const genNegTest: Generator = (rng) => {
  const b = pick(rng, [10, 20, 30, 40, 50]); // percent, so out of 1,000: multiples of 100
  const s = pick(rng, [70, 80, 90]);
  const f = pick(rng, [5, 10, 20]);
  const sick = b * 10, well = 1000 - sick;
  const fn = (sick * (100 - s)) / 100, tn = (well * (100 - f)) / 100;
  const p = fn / (fn + tn);
  return {
    kind: 'number', prob: true,
    body: `In a clinic, ${b}% of patients with these symptoms have flu. A quick test catches ${s}% of flu cases and flags ${f}% of people without flu. A patient tests **negative**. What's the chance they have flu anyway?`,
    answer: p, tol: ptol(p),
    hint: 'This time, count the negatives.',
    explain: `Out of 1,000 patients: ${n(sick)} have flu and ${n(fn)} of them test negative (the ${100 - s}% missed). ${n(well)} don't, and ${n(tn)} of them test negative. So ${n(fn)} / ${n(fn + tn)} ≈ ${P(p)}.`,
  };
};

const genCoins: Generator = (rng) => {
  const k = randInt(rng, 1, 4), m = randInt(rng, 1, 3);
  const q = pick(rng, [0.75, 0.9, 1]);
  const flips = randInt(rng, 1, 3);
  const like = Math.pow(q, flips), likeFair = Math.pow(0.5, flips);
  const p = (m * like) / (m * like + k * likeFair);
  const trick = q === 1 ? `two-headed coin${m > 1 ? 's' : ''}` : `trick coin${m > 1 ? 's' : ''} that land${m > 1 ? '' : 's'} heads ${pct(q, 0)} of the time`;
  return {
    kind: 'number', prob: true,
    body: `A drawer holds ${k} ordinary coin${k > 1 ? 's' : ''} and ${m} ${trick}. You pick one at random and flip it ${flips === 1 ? 'once' : `${flips} times`}: ${flips === 1 ? 'heads' : 'heads every time'}. What's the chance you're holding a **${q === 1 ? 'two-headed' : 'trick'}** coin?`,
    answer: p, tol: ptol(p),
    hint: 'Prior × how likely the flips are, for each kind of coin. Then rescale.',
    explain: `Prior: ${m} trick to ${k} ordinary. Chance of ${flips === 1 ? 'that head' : 'those heads'}: ${num(like)} with a trick coin, ${num(likeFair)} with an ordinary one. ${m} × ${num(like)} = ${num(m * like)} against ${k} × ${num(likeFair)} = ${num(k * likeFair)}, so ≈ ${P(p)}.`,
  };
};

const genUrn: Generator = (rng) => {
  const r1 = randInt(rng, 1, 8), b1 = randInt(rng, 1, 8);
  const r2 = randInt(rng, 1, 8), b2 = randInt(rng, 1, 8);
  const la = r1 / (r1 + b1), lb = r2 / (r2 + b2);
  const p = la / (la + lb);
  return {
    kind: 'number', prob: true,
    body: `Box A has ${r1} red and ${b1} blue balls. Box B has ${r2} red and ${b2} blue. You toss a coin to choose a box, then draw one ball from it without looking: **red**. What's the chance it came from **box A**?`,
    answer: p, tol: ptol(p),
    hint: 'Each box is equally likely at first. How likely is red from each?',
    explain: `Red from A: ${r1}/${r1 + b1}; red from B: ${r2}/${r2 + b2}. With equal priors, P(A | red) = ${num(la)} / (${num(la)} + ${num(lb)}) ≈ ${P(p)}. Counting all ${r1 + r2} red balls together would be wrong unless the boxes held the same number of balls.`,
  };
};

const CLUES = [
  { h: 'the dog took the sandwich', e: 'there are crumbs by the dog bed' },
  { h: 'a review is fake', e: 'the review uses lots of exclamation marks' },
  { h: 'an email is a phishing attempt', e: 'the sender’s address is misspelled' },
  { h: 'a plant has root rot', e: 'its leaves are yellowing' },
  { h: 'the car has a flat battery', e: 'the dashboard lights are dim' },
];

const genLR: Generator = (rng) => {
  const c = pick(rng, CLUES);
  const a = pick(rng, [20, 30, 40, 50, 60, 70, 80, 90]);
  let b = pick(rng, [1, 2, 4, 5, 10, 20, 25, 40, 50]);
  while (b === a) b = pick(rng, [1, 2, 4, 5, 10]);
  const lr = a / b;
  return {
    kind: 'number',
    body: `Hypothesis: ${c.h}. Evidence: ${c.e}. This happens in ${a}% of cases where the hypothesis is true, and ${b}% of cases where it's false. What's the **likelihood ratio** of this evidence?`,
    answer: lr, tol: Math.max(0.01, lr * 0.01),
    hint: 'P(evidence if true) ÷ P(evidence if false).',
    explain: `${a}% ÷ ${b}% = ${num(lr)}. The evidence is ${num(lr)} times as likely if the hypothesis is true, so it multiplies the odds by ${num(lr)}.`,
  };
};

const genOdds: Generator = (rng) => {
  const k = pick(rng, [2, 3, 4, 5, 10, 20, 50, 100]);
  const lr = pick(rng, [2, 3, 4, 5, 10, 20, 50]);
  const p = lr / (lr + k - 1);
  return {
    kind: 'number', prob: true,
    body: `Before any evidence you give a claim a 1 in ${k} chance. Then evidence arrives with a likelihood ratio of **${lr}**. What's the probability now?`,
    answer: p, tol: ptol(p),
    hint: `1 in ${k} is odds of 1 : ${k - 1}.`,
    explain: `Prior odds 1 : ${k - 1}. Times ${lr}: ${lr} : ${k - 1}. As a probability: ${lr} / (${lr} + ${k - 1}) ≈ ${P(p)}.`,
  };
};

const genOddsPct: Generator = (rng) => {
  const pr = pick(rng, [10, 20, 25, 50, 75, 80, 90]) / 100;
  const lr = pick(rng, [0.1, 0.2, 0.25, 0.5, 2, 3, 4, 5]);
  const o = pr / (1 - pr), post = o * lr, p = post / (1 + post);
  return {
    kind: 'number', prob: true,
    body: `You're ${pct(pr, 0)} sure of something. New evidence has a likelihood ratio of **${num(lr)}**${lr < 1 ? ' (it’s more likely if you’re wrong)' : ''}. How sure should you be now?`,
    answer: p, tol: ptol(p),
    hint: 'Convert to odds, multiply, convert back.',
    explain: `${pct(pr, 0)} is odds of ${oddsStr(o)}. Times ${num(lr)}: ${oddsStr(post)}. Back to a probability (for ÷ (for + against)): ≈ ${P(p)}.`,
  };
};

const genStack: Generator = (rng) => {
  const k = pick(rng, [2, 4, 5, 10, 20]);
  const count = randInt(rng, 2, 4);
  const lrs: number[] = [];
  for (let i = 0; i < count; i++) lrs.push(pick(rng, [0.5, 2, 3, 4, 5]));
  const lr = lrs.reduce((a, b) => a * b, 1);
  const p = lr / (lr + k - 1);
  return {
    kind: 'number', prob: true,
    body: `A suspicion starts at 1 in ${k}. You then find ${count} independent clues with likelihood ratios ${lrs.map((x) => num(x)).join(', ')}. What's the probability now?`,
    answer: p, tol: ptol(p),
    hint: 'Independent clues: multiply their likelihood ratios.',
    explain: `Combined ratio: ${lrs.map((x) => num(x)).join(' × ')} = ${num(lr)}. Prior odds 1 : ${k - 1}, so posterior odds ${num(lr)} : ${k - 1}, which is ${num(lr)} / (${num(lr)} + ${k - 1}) ≈ ${P(p)}.`,
  };
};

const genRetest: Generator = (rng) => {
  const b = pick(rng, [0.005, 0.01, 0.02, 0.05]);
  const s = pick(rng, [90, 95, 99]) / 100;
  const f = pick(rng, [1, 2, 5, 10]) / 100;
  const lr = s / f, o = (b / (1 - b)) * lr * lr, p = o / (1 + o);
  return {
    kind: 'number', prob: true,
    body: `${P(b)} of people have a condition. A test catches ${pct(s, 0)} of cases and falsely flags ${pct(f, 0)} of healthy people. You test positive, then take a **second, independent** test of the same kind: positive again. What's the chance you have the condition?`,
    answer: p, tol: ptol(p),
    hint: 'Each positive multiplies the odds by sensitivity ÷ false-positive rate.',
    explain: `Likelihood ratio of one positive: ${pct(s, 0)} ÷ ${pct(f, 0)} = ${num(lr)}. Prior odds ${oddsStr(b / (1 - b))}; two positives multiply them by ${num(lr)}² = ${num(lr * lr, 6)}, giving ${oddsStr(o)}, or ≈ ${P(p)}.`,
  };
};

const genDNA: Generator = (rng) => {
  const m = pick(rng, [10000, 50000, 100000, 1000000]);
  const pop = pick(rng, [100000, 500000, 1000000, 5000000]);
  const innocent = (pop - 1) / m;
  const p = 1 / (1 + innocent);
  return {
    kind: 'number', prob: true,
    body: `A crime was committed by one of ${n(pop)} people. A suspect's DNA matches the crime scene; a random person would match with probability 1 in ${n(m)}. There is **no other evidence**. What's the chance the suspect is guilty?`,
    answer: p, tol: ptol(p),
    hint: 'How many innocent people would also match?',
    explain: `About ${num(innocent)} innocent people match too (${n(pop - 1)} ÷ ${n(m)}), plus the culprit. So P(guilty | match) ≈ 1 / (1 + ${num(innocent)}) ≈ ${P(p)}, not 1 − 1/${n(m)}.`,
  };
};

const FLIPS = [
  { a: 'have a lung disease', b: 'have a persistent cough', who: 'people with the lung disease', bwho: 'people with a persistent cough' },
  { a: 'were in a serious crash', b: 'were driving a grey car', who: 'drivers in serious crashes', bwho: 'drivers of grey cars' },
  { a: 'won a chess tournament', b: 'practise every day', who: 'tournament winners', bwho: 'players who practise every day' },
  { a: 'are professional models', b: 'are over 1.80 m tall', who: 'professional models', bwho: 'people over 1.80 m' },
];

const genReverse: Generator = (rng) => {
  const f = pick(rng, FLIPS);
  const nA = pick(rng, [20, 40, 50, 100]);
  const share = pick(rng, [60, 70, 80, 90]);
  const k = (nA * share) / 100;
  const nB = pick(rng, [500, 800, 1000, 2000, 4000]);
  const forward = rng() < 0.5;
  const p = forward ? k / nA : k / nB;
  return {
    kind: 'number', prob: true,
    body: `In a town, ${nA} people ${f.a}, and ${n(k)} of them ${f.b}. Altogether ${n(nB)} people in the town ${f.b}. Pick one of the **${forward ? f.who : f.bwho}** at random. What's the chance they ${forward ? f.b : f.a}?`,
    answer: p, tol: ptol(p),
    hint: 'Which group are you counting within?',
    explain: forward
      ? `Within the ${nA} ${f.who}, ${n(k)} fit: ${n(k)}/${nA} = ${P(p)}. The other way round, ${n(k)}/${n(nB)}, is only ${P(k / nB)}.`
      : `Within the ${n(nB)} ${f.bwho}, only ${n(k)} ${f.a}: ${n(k)}/${n(nB)} ≈ ${P(p)}. The ${P(k / nA)} figure is the reverse question.`,
  };
};

const genExtra: Generator = (rng) => {
  const k = pick(rng, [100, 1000, 10000]);
  const lr = pick(rng, [10, 50, 100, 1000]);
  const p = lr / (lr + k - 1);
  const claim = pick(rng, ['a friend’s homemade remedy cures colds', 'a coin dealer’s coin is genuinely Roman', 'a startup really has a battery that lasts a year', 'a stranger online is a real prince']);
  return {
    kind: 'number', prob: true,
    body: `Your prior that ${claim} is 1 in ${n(k)}. The evidence you're shown is ${n(lr)} times as likely if the claim is true than if it's false. What's the probability now?`,
    answer: p, tol: ptol(p),
    explain: `Odds 1 : ${n(k - 1)} × ${n(lr)} = ${n(lr)} : ${n(k - 1)}, so ${n(lr)} / ${n(lr + k - 1)} ≈ ${P(p)}. ${p < 0.5 ? 'Strong-sounding evidence, still not enough for so unlikely a claim.' : 'Here the evidence is strong enough to win.'}`,
  };
};

const genReplication: Generator = (rng) => {
  const t = pick(rng, [5, 10, 20, 25, 50]); // % of tested ideas that are true
  const power = pick(rng, [50, 80, 90]);
  const alpha = pick(rng, [1, 5]);
  const tru = t * 100, fls = 10000 - tru; // of 10,000 ideas
  const tp = (tru * power) / 100, fp = (fls * alpha) / 100;
  const p = tp / (tp + fp);
  return {
    kind: 'number', prob: true,
    body: `In a field, ${t}% of the ideas researchers test are actually true. A study detects a true effect ${power}% of the time, and gives a false "significant" result for ${alpha}% of false ideas. A study comes out significant. What's the chance the idea is **true**?`,
    answer: p, tol: ptol(p),
    hint: 'Imagine 10,000 ideas being tested.',
    explain: `Of 10,000 ideas, ${n(tru)} are true and ${n(tp)} of those come out significant; ${n(fls)} are false and ${n(fp)} come out significant anyway. ${n(tp)} / ${n(tp + fp)} ≈ ${P(p)}.`,
  };
};

const genSpam: Generator = (rng) => {
  const s = pick(rng, [20, 30, 40, 50, 60, 70]);
  const a = pick(rng, [10, 20, 30, 40, 50]);
  const b = pick(rng, [1, 2, 5]);
  const word = pick(rng, ['winner', 'urgent', 'free gift', 'act now', 'guaranteed']);
  const spam = s * 10, ham = 1000 - spam; // of 1,000 emails
  const x = (spam * a) / 100, y = (ham * b) / 100;
  const p = x / (x + y);
  return {
    kind: 'number', prob: true,
    body: `${s}% of your email is spam. The phrase "${word}" appears in ${a}% of spam and ${b}% of genuine email. An email contains it. What's the chance it's **spam**?`,
    answer: p, tol: ptol(p),
    explain: `Of 1,000 emails: ${n(spam)} spam, ${n(x)} with "${word}"; ${n(ham)} genuine, ${n(y)} with it. ${n(x)} / ${n(x + y)} ≈ ${P(p)}.`,
  };
};

// ---------------------------------------------------------------- course

export const bayes: Course = {
  id: 'bayes',
  title: 'Bayesian Thinking',
  blurb: 'Start from base rates, weigh evidence by its strength, and change your mind by the right amount.',
  color: C.e,
  icon: '🔍',
  lessons: [
    {
      id: 'base-rates',
      title: 'Base rates first',
      goal: 'Start every judgement from how common the thing is.',
      steps: [
        {
          kind: 'choice',
          body: 'Steve is shy and tidy, with a love of order and detail. In his country there are about 20 farmers for every librarian. Is Steve more likely a **librarian** or a **farmer**?',
          options: [
            { text: 'A farmer', correct: true },
            { text: 'A librarian', why: 'He sounds like a librarian, but there are 20 farmers for each librarian. Plenty of farmers are shy and tidy too.' },
            { text: 'Equally likely', why: 'The description and the 20-to-1 headcount don’t cancel out. You’d need the description to be 20 times likelier for librarians.' },
          ],
          explain: 'Even if the description fits librarians much better, there are so many more farmers that shy, tidy farmers outnumber shy, tidy librarians. This puzzle comes from Kahneman and Tversky.',
        },
        {
          kind: 'read',
          title: 'The base rate',
          body: 'The **base rate** is how common something is before you know any details: here, 20 farmers per librarian.\n\nSay 4 in 10 librarians fit Steve’s description, but only 1 in 10 farmers. Among 10 librarians and 200 farmers, that’s 4 librarians against 20 farmers who fit.',
          widget: dots([
            { n: 4, color: C.e, label: 'librarians who fit' },
            { n: 6, color: '#d3bdfa', label: 'other librarians' },
            { n: 20, color: C.b, label: 'farmers who fit' },
            { n: 180, color: '#c9cfd9', label: 'other farmers' },
          ], 21),
        },
        {
          kind: 'number', prob: true,
          body: 'From the picture: you meet someone who fits Steve’s description. What’s the chance they’re a **librarian**?',
          answer: 4 / 24, tol: 0.004,
          hint: 'Count only the people who fit.',
          explain: '4 librarians and 20 farmers fit: 4 / 24 = 1/6 ≈ 17%. The description made “librarian” four times more likely than the base rate alone (1 in 21), but not likely.',
        },
        {
          kind: 'choice',
          body: 'A new acquaintance loves logic puzzles and plays chess online every night. More likely a **professional chess player** or a **software developer**?',
          options: [
            { text: 'Software developer', correct: true },
            { text: 'Professional chess player', why: 'The description fits, but professional players are a few thousand worldwide against tens of millions of developers.' },
            { text: 'Can’t say without more information', why: 'You already have the most useful information: how many of each there are.' },
          ],
          explain: 'Developers outnumber professional chess players by thousands to one. Even if a tiny share of developers fit the description, that’s still far more people.',
        },
        {
          kind: 'estimate',
          body: 'A school has 100 students who play an instrument and 900 who don’t. Half the players wear glasses, as do 20% of the others. A student wears glasses. Roughly what’s the chance they play an instrument?',
          min: 0, max: 100, step: 1, answer: 22, tol: 4, format: (v) => `${v}%`,
          explain: '50 players wear glasses, and 20% of 900 = 180 non-players do. 50 / 230 ≈ 22%. Glasses make “player” more likely than the 10% base rate, but still unlikely.',
        },
        {
          kind: 'choice',
          body: 'When you judge “is this person an X?”, which question should come **first**?',
          options: [
            { text: 'How common are X’s in the first place?', correct: true },
            { text: 'How well does this person fit my picture of an X?', why: 'Fit matters, but only once you know how many X’s there are to begin with. Judging by fit alone is called the representativeness heuristic.' },
            { text: 'How confident do I feel?', why: 'A strong feeling of fit is exactly what makes people ignore the base rate.' },
          ],
          explain: 'Start from the base rate, then adjust for how well the evidence fits. Skipping the first step is **base-rate neglect**.',
        },
        {
          kind: 'choice',
          body: 'A shop’s camera system flags 95% of shoplifters, and also flags 5% of honest shoppers. About 1 in 1,000 shoppers is a shoplifter. The system flags someone. Which is more likely?',
          options: [
            { text: 'They’re an honest shopper', correct: true },
            { text: 'They’re a shoplifter: the system catches 95% of them', why: 'That’s the chance a shoplifter is flagged, not the chance a flagged person is a shoplifter. Honest shoppers are 999 times as common.' },
            { text: 'About 50/50', why: 'Count it out: per 1,000 shoppers, about 1 shoplifter is flagged and about 50 honest people are.' },
          ],
          explain: 'Per 100,000 shoppers: 100 shoplifters, 95 flagged. 99,900 honest, 5% of them = 4,995 flagged. False alarms swamp the real ones.',
        },
        {
          kind: 'number', prob: true,
          body: 'Same shop, per 100,000 shoppers: 95 shoplifters flagged and 4,995 honest people flagged. What’s the chance a flagged person is a shoplifter?',
          answer: 95 / 5090, tol: 0.002,
          explain: '95 / (95 + 4,995) = 95 / 5,090 ≈ 1.9%. A 95%-accurate alarm, and 98% of its alerts are honest people.',
        },
      ],
      practice: [genBaseRate, genWhoMoreLikely],
    },
    {
      id: 'natural-frequencies',
      title: 'Count people, not percentages',
      goal: 'Turn percentages into a tree of counts, and read the answer off it.',
      steps: [
        {
          kind: 'estimate',
          body: '1% of women in a screening group have breast cancer. A mammogram detects 90% of cancers, and gives a false positive for 9% of women without cancer. A woman tests positive. Roughly what’s the chance she has cancer?',
          min: 0, max: 100, step: 1, answer: 9, tol: 4, format: (v) => `${v}%`,
          explain: 'About 9%. When Gerd Gigerenzer gave doctors this problem in percentages, most guessed far too high. Next, the same facts as counts.',
        },
        {
          kind: 'read',
          title: 'Imagine 1,000 people',
          body: 'Turn each percentage into people. Of 1,000 women, 1% (10) have cancer and 9 of them test positive. Of the 990 without cancer, 9% (about 89) test positive anyway.\n\nThese are **natural frequencies**: counts of people, all out of the same 1,000.',
          widget: freqTree({ total: 1000, base: 0.01, sens: 0.9, fpr: 0.09, yes: 'cancer', no: 'no cancer', who: 'women' }),
        },
        {
          kind: 'number', unit: 'women',
          body: 'From the tree: how many of the 1,000 women test **positive** in total?',
          answer: 98, tol: 0.5,
          explain: '9 with cancer plus 89 without: 98 positives.',
        },
        {
          kind: 'number', prob: true,
          body: 'Of those 98 positive tests, what fraction belong to women who **have cancer**?',
          answer: 9 / 98, tol: 0.004,
          explain: '9 / 98 ≈ 9%. More than 9 in 10 positives are false alarms, simply because so many more women don’t have cancer.',
        },
        {
          kind: 'task',
          body: 'Your turn. 2% of 1,000 people have a condition. A test catches 75% of them, and flags 10% of people without it. Fill in the tree.',
          widget: treeFill({ total: 1000, base: 0.02, sens: 0.75, fpr: 0.1 }),
          hint: 'First split 1,000 into 2% and 98%. Then split each group.',
          explain: '20 have it (15 test positive, 5 negative). 980 don’t (98 test positive, 882 negative).',
        },
        {
          kind: 'number', prob: true,
          body: 'From your tree: someone tests positive. What’s the chance they have the condition?',
          answer: 15 / 113, tol: 0.004,
          hint: 'Real positives over all positives.',
          explain: '15 real positives out of 15 + 98 = 113: about 13%.',
        },
        {
          kind: 'choice',
          body: 'Why do counts work so much better than percentages here?',
          options: [
            { text: 'Every number is out of the same 1,000, so you can add and compare them directly', correct: true },
            { text: 'Counts are more precise than percentages', why: 'They hold the same information, if anything a little rounded.' },
            { text: 'They give a different, more accurate answer', why: 'The answer is identical; it’s just easier to see.' },
          ],
          explain: 'Percentages like 90% and 9% are out of different groups (sick, healthy). Counts put everyone on one scale, and the base rate is built in.',
        },
        {
          kind: 'number', prob: true,
          body: 'Back to the mammogram tree: 1 woman with cancer tests negative, and 901 without cancer do. A woman tests **negative**. What’s the chance she has cancer anyway?',
          widget: freqTree({ total: 1000, base: 0.01, sens: 0.9, fpr: 0.09, yes: 'cancer', no: 'no cancer', who: 'women' }),
          answer: 1 / 902, tol: 0.0005,
          explain: '1 / (1 + 901) ≈ 0.1%. A negative is very reassuring, again because cancer is rare to begin with.',
        },
      ],
      practice: [genTreeCount, genTreePost],
    },
    {
      id: 'false-positives',
      title: 'When the test says yes',
      goal: 'See how base rate, sensitivity and false alarms each move the answer.',
      steps: [
        {
          kind: 'choice',
          body: 'A disease affects 1 in 1,000 people. **Test A** catches 99% of cases but flags 5% of healthy people. **Test B** catches only 80% but flags just 0.1% of healthy people. Which positive result is more worrying?',
          options: [
            { text: 'A positive on test B', correct: true },
            { text: 'A positive on test A: it catches more cases', why: 'Catching cases tells you about negatives. For positives, what matters is how many healthy people get flagged too.' },
            { text: 'About the same', why: 'Per 100,000 people, test A flags about 5,000 healthy people, test B only about 100.' },
          ],
          explain: 'Per 100,000: test A gives 99 real positives and 4,995 false ones (about 2% real). Test B gives 80 real and about 100 false (about 44% real).',
        },
        {
          kind: 'read',
          title: 'The screening lab',
          body: 'Drag the sliders. Watch the bar of positives: how much of it is real? Try a rare condition with a very good test, then make the condition common.',
          widget: bayesLab({ base: 0.01, sens: 0.9, fpr: 0.05 }),
        },
        {
          kind: 'number', prob: true,
          body: 'The last course’s test: 1 in 1,000 have the disease, the test catches 99% and flags 1% of healthy people. Exactly: out of 100,000 people, 99 real positives and 999 false ones. What’s the chance a positive is real?',
          answer: 99 / 1098, tol: 0.003,
          explain: '99 / (99 + 999) = 99 / 1,098 ≈ 9.0%. “About 1 in 11” was a good approximation.',
        },
        {
          kind: 'choice',
          body: 'Which change would make that positive result most convincing?',
          options: [
            { text: 'Cut false positives from 1% to 0.1%', correct: true },
            { text: 'Raise the catch rate from 99% to 100%', why: 'That adds just 1 real positive per 100,000 (100 instead of 99); the 999 false ones remain. Still about 9%.' },
            { text: 'Test twice as many people', why: 'Doubling everyone doubles both kinds of positive. The share stays the same.' },
          ],
          explain: 'With 0.1% false positives, 99,900 healthy people give about 100 false alarms against 99 real: roughly 50%. For a rare condition, the false-positive rate is what counts.',
        },
        {
          kind: 'number', prob: true,
          body: 'Same test (99% caught, 1% false positives), but now used on people with symptoms, where **1 in 10** has the disease. A positive: what’s the chance it’s real?',
          answer: 99 / 108, tol: 0.004,
          hint: 'Out of 1,000 people: how many sick, how many healthy?',
          explain: 'Of 1,000: 100 sick, 99 test positive. 900 healthy, 1% = 9 test positive. 99 / 108 ≈ 92%.',
        },
        {
          kind: 'choice',
          body: 'The same positive result means about 9% in random screening and 92% in the clinic. Why?',
          options: [
            { text: 'The base rate differs: the clinic’s patients were far more likely to be ill before the test', correct: true },
            { text: 'The test works better on people with symptoms', why: 'We kept the test’s numbers identical: 99% caught, 1% false alarms.' },
            { text: 'One of the calculations must be wrong', why: 'Both are right. A test result can’t be read without knowing who was tested.' },
          ],
          explain: 'A test’s accuracy is fixed; what its result **means** depends on the prior. That’s why doctors test people with symptoms rather than everyone.',
        },
        {
          kind: 'estimate',
          body: 'A workplace drug test catches 95% of users and flags 5% of non-users. 5% of staff use the drug. Someone tests positive. Roughly what’s the chance they’re a user?',
          min: 0, max: 100, step: 1, answer: 50, tol: 4, format: (v) => `${v}%`,
          explain: 'Of 1,000 staff: 50 users, 47.5 caught. 950 non-users, 47.5 flagged. Exactly 50%: a “95% accurate” test, and a coin flip.',
        },
        {
          kind: 'number', prob: true,
          body: 'Base rates matter for negatives too. In a ward, 40% of patients have an infection. A quick test misses 30% of cases and flags 10% of healthy patients. A patient tests **negative**. What’s the chance they’re infected anyway?',
          answer: 12 / 66, tol: 0.004,
          hint: 'Out of 100 patients: who tests negative?',
          explain: 'Of 100: 40 infected, 12 missed (negative). 60 healthy, 54 negative. 12 / 66 ≈ 18%. When a condition is common, a negative from a weak test is far from all-clear.',
        },
      ],
      practice: [genScreen, genNegTest],
    },
    {
      id: 'updating',
      title: 'Prior, evidence, posterior',
      goal: 'Update a belief step by step, using each answer as the next starting point.',
      steps: [
        {
          kind: 'number', prob: true,
          body: 'A bag holds two coins: one fair, one with heads on both sides. You pull one out at random and flip it: **heads**. What’s the chance you’re holding the two-headed coin?',
          answer: 2 / 3, tol: 0.004,
          hint: 'Imagine doing this many times. How often do you see heads with each coin?',
          explain: 'Of 4 imagined tries, 2 use the two-headed coin (2 heads) and 2 the fair one (1 head). Of 3 heads, 2 came from the two-headed coin: 2/3.',
        },
        {
          kind: 'read',
          title: 'The update',
          body: 'Every Bayesian update has three parts:\n\n- **Prior**: how likely each explanation was before (½ and ½).\n- **Likelihood**: how likely the evidence is under each (heads: 1 for two-headed, ½ for fair).\n- **Posterior**: prior × likelihood, rescaled to add to 1 (½ × 1 against ½ × ½, so 2/3 and 1/3).\n\nTry it: this coin is either fair or lands heads 75% of the time.',
          widget: mysteryCoin(),
        },
        {
          kind: 'number', prob: true,
          body: 'Back to the two coins. You flip the same coin again: **heads** again. Starting from your 2/3, what’s the chance it’s two-headed now?',
          answer: 0.8, tol: 0.004,
          hint: 'New prior: 2/3 against 1/3. Likelihood of heads: 1 against ½.',
          explain: '2/3 × 1 = 2/3 against 1/3 × ½ = 1/6. Rescale: (2/3) / (2/3 + 1/6) = 4/5 = 80%.',
        },
        {
          kind: 'choice',
          body: 'The third flip comes up **tails**. Now what’s the chance it’s two-headed?',
          ordered: true,
          options: [
            { text: '0', correct: true },
            { text: '50%', why: 'A two-headed coin can never show tails. Likelihood 0 wipes that explanation out.' },
            { text: '80% minus a bit', why: 'Updates aren’t always nudges. Evidence impossible under a hypothesis rules it out completely.' },
          ],
          explain: 'P(tails | two-headed) = 0, so the posterior is 0 whatever the prior. One piece of evidence can be decisive if it’s impossible under one explanation.',
        },
        {
          kind: 'order',
          body: 'Put the steps of a Bayesian update in order.',
          items: [
            'Write down how likely each explanation is before the evidence',
            'Ask how likely the evidence would be under each explanation',
            'Multiply each prior by its likelihood',
            'Rescale so the results add up to 1',
            'Use the result as the prior for the next piece of evidence',
          ],
          explain: 'Prior, likelihood, multiply, rescale, repeat. Today’s posterior is tomorrow’s prior.',
        },
        {
          kind: 'number', prob: true,
          body: 'You wake up to wet grass. Your priors: rain overnight 30%, the sprinkler ran 20%, neither (just dew) 50%. Wet grass is 90% likely after rain, 90% after the sprinkler, and 10% with only dew. What’s the chance it **rained**?',
          answer: 0.54, tol: 0.005,
          hint: 'Prior × likelihood for each: 0.3 × 0.9, 0.2 × 0.9, 0.5 × 0.1. Then rescale.',
          explain: 'Rain 0.27, sprinkler 0.18, dew 0.05; total 0.50. Rain: 0.27 / 0.50 = 54% (sprinkler 36%, dew 10%).',
        },
        {
          kind: 'number', prob: true,
          body: 'Then you notice the pavement is wet too. The sprinkler doesn’t reach it: a wet pavement is 90% likely after rain, but only 10% after the sprinkler or with just dew. Starting from 54% / 36% / 10%, what’s the chance it rained?',
          answer: 0.486 / 0.532, tol: 0.005,
          explain: 'Rain 0.54 × 0.9 = 0.486; sprinkler 0.36 × 0.1 = 0.036; dew 0.10 × 0.1 = 0.010. Total 0.532. Rain: 0.486 / 0.532 ≈ 91%.',
        },
        {
          kind: 'choice',
          body: 'Two friends see exactly the same evidence and both update correctly, yet still disagree. Most likely reason?',
          options: [
            { text: 'They started from different priors', correct: true },
            { text: 'One of them must be reasoning badly', why: 'Not necessarily: correct updates from different starting points give different answers.' },
            { text: 'Evidence can’t change anyone’s mind', why: 'It moved both of them; it just didn’t move them to the same place yet.' },
          ],
          explain: 'Same evidence, different priors, different posteriors. With enough strong evidence, though, the priors matter less and less and they converge.',
        },
      ],
      practice: [genCoins, genUrn],
    },
    {
      id: 'likelihood-ratios',
      title: 'How strong is the evidence?',
      goal: 'Measure evidence by its likelihood ratio, and update in odds.',
      steps: [
        {
          kind: 'choice',
          body: 'Did your flatmate eat your cake? Clue 1: **crumbs on their desk**, seen 90% of the time if they did and 60% if they didn’t (they snack a lot). Clue 2: **cream on their sleeve**, 30% if they did, 3% if they didn’t. Which clue is stronger evidence?',
          options: [
            { text: 'The cream', correct: true },
            { text: 'The crumbs: they’re much more likely if guilty', why: '90% is high, but crumbs are common anyway (60%). They’re only 1.5 times as likely if guilty.' },
            { text: 'Equally strong', why: 'Compare each clue’s chances with and without guilt: 90/60 against 30/3.' },
          ],
          explain: 'Cream is 10 times as likely if they did it (30% vs 3%); crumbs only 1.5 times (90% vs 60%). Strength is about the **comparison**, not how often the clue turns up.',
        },
        {
          kind: 'read',
          title: 'Likelihood ratio and odds',
          body: 'The **likelihood ratio** (LR) of a clue is\n\nP(clue if true) ÷ P(clue if false)\n\nWork in **odds** and updating is one multiplication:\n\n**posterior odds = prior odds × LR**\n\nSay you start at 1 : 4 (20%). Tap the clues.',
          widget: oddsStacker({ prior: 0.2, h: 'they ate it', notH: 'they didn’t', clues: [
            { label: 'Crumbs', lr: 1.5 }, { label: 'Cream on sleeve', lr: 10 }, { label: 'Says they were out all day', lr: 0.5 },
          ] }),
        },
        {
          kind: 'choice',
          body: 'A probability of 20% is what in odds?',
          ordered: true,
          options: [
            { text: '1 : 3', why: '1 : 3 means 1 for every 3 against: 1 in 4, which is 25%.' },
            { text: '1 : 4', correct: true },
            { text: '1 : 5', why: '1 : 5 is 1 in 6, about 17%. Odds compare for against against, not for against the total.' },
          ],
          explain: '20% is 1 in 5: 1 for, 4 against, so odds 1 : 4. Back again: odds a : b means probability a / (a + b).',
        },
        {
          kind: 'number', prob: true,
          body: 'Start at odds 1 : 4. The cream (LR 10) turns up. What’s the probability now?',
          answer: 10 / 14, tol: 0.005,
          hint: 'New odds: 10 : 4.',
          explain: '1 : 4 × 10 = 10 : 4, so 10 / 14 ≈ 71%.',
        },
        {
          kind: 'number',
          body: 'A mammogram detects 90% of cancers and falsely flags 9% of healthy women. What’s the likelihood ratio of a **positive** result?',
          answer: 10, tol: 0.01,
          explain: '90% ÷ 9% = 10. A positive is 10 times as likely if she has cancer.',
        },
        {
          kind: 'number', prob: true,
          body: 'With a 1% base rate (odds 1 : 99) and that LR of 10, what’s the probability after a positive?',
          answer: 10 / 109, tol: 0.004,
          explain: '1 : 99 × 10 = 10 : 99, so 10 / 109 ≈ 9.2%. The same answer the tree gave, in one line.',
        },
        {
          kind: 'choice',
          body: 'A clue is **equally likely** whether or not your theory is true (LR = 1). What should it do to your belief?',
          options: [
            { text: 'Nothing', correct: true },
            { text: 'Raise it a little: the clue is consistent with the theory', why: '“Consistent with” isn’t evidence. It’s just as consistent with the alternative.' },
            { text: 'Lower it a little', why: 'It points neither way: multiplying odds by 1 changes nothing.' },
          ],
          explain: 'Evidence only counts if it’s more likely under one explanation than the other. Watch for “this is consistent with…”: so is lots of other stuff.',
        },
        {
          kind: 'estimate',
          body: 'You’re 50/50 on something. A clue arrives with LR 0.2 (five times as likely if you’re wrong). Roughly how likely is it now?',
          min: 0, max: 100, step: 1, answer: 17, tol: 3, format: (v) => `${v}%`,
          explain: 'Odds 1 : 1 × 0.2 = 1 : 5, which is 1 in 6 ≈ 17%. An LR below 1 is evidence against.',
        },
      ],
      practice: [genLR, genOdds, genOddsPct],
    },
    {
      id: 'stacking',
      title: 'Stacking evidence',
      goal: 'Combine several clues, and spot when they aren’t independent.',
      steps: [
        {
          kind: 'number', prob: true,
          body: 'Back to the mammogram: base rate 1% (odds 1 : 99), and a positive has LR 10. A woman tests positive, then takes a second, **independent** test of the same quality: positive again. What’s the chance she has cancer?',
          answer: 100 / 199, tol: 0.005,
          hint: 'Each positive multiplies the odds by 10.',
          explain: '1 : 99 × 10 × 10 = 100 : 99, so 100 / 199 ≈ 50%. One positive took her to 9%, the second to about 50%.',
        },
        {
          kind: 'read',
          title: 'Independent evidence multiplies',
          body: 'If clues are independent (each one’s chances don’t depend on the others, given the truth), you can chain them:\n\n**posterior odds = prior odds × LR₁ × LR₂ × LR₃ …**\n\nThis rumour starts at 1 in 10. Stack the clues and watch.',
          widget: oddsStacker({ prior: 0.1, h: 'rumour true', notH: 'false', clues: [
            { label: 'Colleague heard it too', lr: 3 }, { label: 'Leaked email', lr: 5 }, { label: 'Company denies it', lr: 0.8 }, { label: 'Hiring freeze', lr: 2 },
          ] }),
        },
        {
          kind: 'number',
          body: 'Three independent clues have likelihood ratios 2, 3 and 0.5. What’s their combined likelihood ratio?',
          answer: 3, tol: 0.01,
          explain: '2 × 3 × 0.5 = 3. The clue against (0.5) cancels half the weight of the others.',
        },
        {
          kind: 'choice',
          body: 'Two newspapers report the same surprising story. Then you learn both copied it from the same press release. How much should the second report add?',
          options: [
            { text: 'Almost nothing beyond the first', correct: true },
            { text: 'As much as the first: two sources are two sources', why: 'They aren’t independent. If the press release is wrong, both papers are wrong together.' },
            { text: 'It should lower your belief', why: 'Copying doesn’t make the story less likely; it just isn’t new evidence.' },
          ],
          explain: 'Multiplying LRs only works for independent evidence. Echoes of one source count once.',
        },
        {
          kind: 'choice',
          body: 'Why might re-running the same lab test on the **same blood sample** add less than the formula says?',
          options: [
            { text: 'Whatever caused a false positive (say, something in that sample) will probably cause it again', correct: true },
            { text: 'Tests get less accurate each time they’re used', why: 'The test isn’t worn out. The problem is that its errors are linked.' },
            { text: 'It adds more: the same sample gives a fairer comparison', why: 'Identical conditions mean identical mistakes. You want errors that are independent.' },
          ],
          explain: 'Independence means the second result’s errors don’t follow the first’s. A fresh sample, or a different kind of test, is much stronger.',
        },
        {
          kind: 'number', prob: true,
          body: 'A rumour starts at odds 1 : 4. Three people who heard it **independently** each confirm it, and each confirmation has LR 3. What’s the probability now?',
          answer: 27 / 31, tol: 0.005,
          explain: '1 : 4 × 3 × 3 × 3 = 27 : 4, so 27 / 31 ≈ 87%.',
        },
        {
          kind: 'estimate',
          body: 'Ten independent weak clues each have LR 1.5. You started at 1%. Roughly where do you end up?',
          min: 0, max: 100, step: 1, answer: 37, tol: 4, format: (v) => `${v}%`,
          explain: '1.5¹⁰ ≈ 58. Odds 1 : 99 × 58 = 58 : 99, about 37%. Lots of weak, independent clues add up to strong evidence.',
        },
        {
          kind: 'choice',
          body: 'You see clue B before clue A, and a friend sees A before B. Do you end up in different places?',
          options: [
            { text: 'No: multiplication doesn’t care about order', correct: true },
            { text: 'Yes: first impressions weigh more', why: 'They often do in people’s heads, but not in correct reasoning.' },
            { text: 'Yes: the later clue counts more', why: 'Recent evidence feels stronger, but LR × LR is the same in either order.' },
          ],
          explain: 'Prior × LR_A × LR_B = prior × LR_B × LR_A. If order changes your conclusion, a bias is at work.',
        },
      ],
      practice: [genStack, genRetest],
    },
    {
      id: 'which-way-round',
      title: 'Which way round?',
      goal: 'Keep P(A given B) and P(B given A) apart.',
      steps: [
        {
          kind: 'choice',
          body: 'DNA from a crime scene matches the suspect. Only 1 in 100,000 people would match by chance. The prosecutor says: “So there’s only a 1 in 100,000 chance he’s innocent.” Is that right?',
          options: [
            { text: 'No: 1 in 100,000 is the chance an innocent person matches, not the chance a match is innocent', correct: true },
            { text: 'Yes: that’s what a match probability means', why: 'It means P(match | innocent). The jury needs P(innocent | match), which depends on how many people could have done it.' },
            { text: 'No: it should be 1 in 50,000', why: 'The number isn’t off by a factor; it answers a different question.' },
          ],
          explain: 'Swapping P(match | innocent) for P(innocent | match) is the **prosecutor’s fallacy**.',
        },
        {
          kind: 'read',
          title: 'Count the matches',
          body: 'Suppose the culprit is one of a million people and there’s no other evidence. About 10 innocent people would match too (1,000,000 ÷ 100,000), plus the culprit.\n\nSo among everyone who matches, only 1 in 11 is guilty.',
          widget: dots([{ n: 1, color: C.d, label: 'the culprit' }, { n: 10, color: C.b, label: 'innocent people who match' }], 11),
        },
        {
          kind: 'number', prob: true,
          body: 'So: the culprit is one of 1,000,000 people, the suspect was found only by searching a DNA database, and about 10 innocent people would match. What’s P(guilty | match)?',
          answer: 1 / 11, tol: 0.004,
          explain: '1 guilty out of about 11 matches ≈ 9%. Very different from “1 in 100,000 chance of innocence”.',
        },
        {
          kind: 'choice',
          body: 'The defence replies: “So my client is just 1 of 11 matches: the DNA is worthless.” What’s wrong with that?',
          options: [
            { text: 'The DNA cut the field from a million to 11: it’s very strong evidence, to be combined with the rest', correct: true },
            { text: 'Nothing: 1 in 11 is weak', why: 'It’s 1 in 11 with no other evidence. A likelihood ratio of 100,000 multiplies whatever else points to him.' },
            { text: 'The defence should have said 1 in 100,000', why: 'That repeats the prosecutor’s mix-up from the other side.' },
          ],
          explain: 'This is the **defence attorney’s fallacy**. If other evidence already put the suspect among, say, 100 people, the match makes guilt almost certain.',
        },
        {
          kind: 'choice',
          body: 'Most professional basketball players are over 1.90 m. Your neighbour is 1.95 m. Is he probably a basketball player?',
          options: [
            { text: 'No: most tall people aren’t basketball players', correct: true },
            { text: 'Yes: he has the main trait they share', why: 'P(tall | player) is high, but P(player | tall) is tiny: there are millions of tall people and a few hundred pros.' },
            { text: 'About 50/50', why: 'Count tall people versus professional players: it’s nowhere near even.' },
          ],
          explain: 'P(tall | player) and P(player | tall) share a top (tall players) but have very different bottoms (all players vs all tall people).',
        },
        {
          kind: 'number', prob: true,
          body: 'In a city, 50 people have used heroin, and 40 of them used cannabis first: 80%. Altogether 2,000 people have used cannabis. What’s the chance a cannabis user goes on to heroin?',
          answer: 0.02, tol: 0.002,
          explain: '40 / 2,000 = 2%. “80% of heroin users started with cannabis” is P(cannabis | heroin); the question was P(heroin | cannabis).',
        },
        {
          kind: 'choice',
          body: 'In a real 1999 trial, an expert said two cot deaths in one family would happen by chance only 1 in 73 million times, and the mother was convicted. What was the biggest flaw?',
          options: [
            { text: 'It ignored how rare the alternative is: a double murder is also extremely unlikely', correct: true },
            { text: 'None: 1 in 73 million is the chance she was innocent', why: 'That’s the prosecutor’s fallacy again: P(evidence | innocent) is not P(innocent | evidence).' },
            { text: 'The chance should have been even smaller', why: 'If anything it was already too small: squaring 1 in 8,543 treated two deaths in one family as independent, ignoring shared genetic and household factors.' },
          ],
          explain: 'Given two deaths, you must compare two rare explanations against each other. Sally Clark’s conviction was overturned in 2003, and the Royal Statistical Society publicly criticised the figure.',
        },
        {
          kind: 'choice',
          body: 'A test’s **sensitivity** is 95%. Which statement says the same thing?',
          options: [
            { text: '95% of people with the disease test positive', correct: true },
            { text: '95% of people who test positive have the disease', why: 'That’s the reverse, P(disease | positive), and it depends on the base rate.' },
            { text: 'The test is right 95% of the time', why: 'That mixes up how it does on sick people with how it does on healthy ones.' },
          ],
          explain: 'Sensitivity is P(positive | disease). What a patient wants is P(disease | positive): you need Bayes to get from one to the other.',
        },
      ],
      practice: [genDNA, genReverse],
    },
    {
      id: 'everyday',
      title: 'Bayes in the wild',
      goal: 'Weigh claims, reviews, studies and surprises with priors and likelihood ratios.',
      steps: [
        {
          kind: 'choice',
          body: 'The same friend, equally sure both times, tells you they saw a famous actor in your local supermarket, and on another day that they saw a ghost. Which should you believe more?',
          options: [
            { text: 'The actor', correct: true },
            { text: 'Equally: same friend, same confidence', why: 'Same evidence, but very different priors. Actors do go shopping.' },
            { text: 'The ghost: nobody would invent that', why: 'People sincerely misperceive things all the time; a sincere report has a modest likelihood ratio.' },
          ],
          explain: 'A report is evidence, but its LR is the same in both cases, and the priors are wildly different. Extraordinary claims need extraordinary evidence.',
        },
        {
          kind: 'read',
          title: 'Extraordinary claims',
          body: 'Posterior odds = prior odds × LR. If a claim starts at 1 in 1,000, evidence with LR 100 only brings it to about 1 in 11.\n\nTo believe something very unlikely, you need evidence that would be very hard to explain otherwise. Try it on this claim: “this herbal pill cures colds”.',
          widget: oddsStacker({ prior: 0.001, h: 'it works', notH: 'it doesn’t', clues: [
            { label: 'Glowing testimonials', lr: 1.2 }, { label: 'Small study', lr: 3 }, { label: 'Large blinded trial', lr: 100 }, { label: 'Independent replication', lr: 50 },
          ] }),
        },
        {
          kind: 'number', prob: true,
          body: 'A claim starts at 1 in 1,000 (odds 1 : 999). Evidence arrives with LR 100. What’s the probability now?',
          answer: 100 / 1099, tol: 0.004,
          explain: '1 : 999 × 100 = 100 : 999, so 100 / 1,099 ≈ 9%. Strong evidence, still probably false.',
        },
        {
          kind: 'number',
          body: 'Same claim, prior odds 1 : 999. What likelihood ratio would bring it to **50%**?',
          answer: 999, tol: 1,
          explain: '50% is odds 1 : 1, so you need × 999 (about 1,000). That’s what “extraordinary evidence” means in numbers.',
        },
        {
          kind: 'choice',
          body: 'Restaurant A has 5.0 stars from 3 reviews. Restaurant B has 4.6 stars from 800 reviews. Which is more likely to be excellent?',
          options: [
            { text: 'B', correct: true },
            { text: 'A: it has the higher score', why: 'Three reviews is weak evidence; a perfect score from three people happens to plenty of ordinary places (and their friends).' },
            { text: 'Can’t tell', why: 'You can: 800 reviews at 4.6 is strong evidence, 3 at 5.0 is weak.' },
          ],
          explain: 'Start from the prior that most restaurants are ordinary. Weak evidence should move you only a little from there; strong evidence a lot.',
        },
        {
          kind: 'number', prob: true,
          body: 'In a field, 1 in 10 hypotheses researchers test is true. Studies detect a true effect 80% of the time, and give a false “significant” result for 5% of false hypotheses. A study is significant. What’s the chance the hypothesis is true?',
          answer: 0.64, tol: 0.005,
          hint: 'Picture 1,000 hypotheses tested.',
          explain: 'Of 1,000: 100 true, 80 significant. 900 false, 45 significant. 80 / 125 = 64%. One significant study isn’t proof, which is why replication matters.',
        },
        {
          kind: 'choice',
          body: 'You search your garden carefully for an hour for your lost keys and don’t find them. Should that lower your belief that they’re in the garden?',
          options: [
            { text: 'Yes: not finding them is more likely if they’re not there', correct: true },
            { text: 'No: absence of evidence isn’t evidence of absence', why: 'It is, whenever you’d probably have found the thing if it were there. A careful search has an LR well below 1.' },
            { text: 'Only if you’re now certain they’re elsewhere', why: 'Evidence shifts belief by degrees; it doesn’t have to settle the question.' },
          ],
          explain: 'A search that would usually succeed if they were there, but failed, is evidence against. A quick glance would be much weaker evidence.',
        },
        {
          kind: 'estimate',
          body: 'Half your email is spam. The word “winner” appears in 20% of spam and 1% of genuine email. An email says “winner”. Roughly what’s the chance it’s spam?',
          min: 0, max: 100, step: 1, answer: 95, tol: 2, format: (v) => `${v}%`,
          explain: 'Prior odds 1 : 1, LR 20 ÷ 1 = 20, so 20 : 1: 20 / 21 ≈ 95%. Spam filters do exactly this, over many words.',
        },
        {
          kind: 'number', prob: true,
          body: 'You’re 90% sure your plan will work. Then you get evidence that’s 4 times as likely if you’re wrong (LR 0.25). How sure should you be now?',
          answer: 9 / 13, tol: 0.005,
          explain: '90% is odds 9 : 1. Times 0.25: 9 : 4, so 9 / 13 ≈ 69%. Not 90%, not panic: just the right amount of doubt.',
        },
      ],
      practice: [genExtra, genReplication, genSpam],
    },
  ],
};

