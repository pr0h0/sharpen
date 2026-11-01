// Mathematical Thinking: spotting structure, invariants, pigeonholes, counterexamples, proofs by
// picture, primes, induction, and working backwards. Problem first; the idea gets its name after.
import type { Choice, Course, Generator, Rng } from '../types';
import { h, num, pick, randInt, shuffle } from '../ui';
import { barChart, columnChart, dataTable } from '../viz/charts';
import { explorer, plotExplorer, stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import { cells, network } from '../viz/cs';
import {
  bigLine, binomialSquare, board, dominoRow, factor, fewestMoves, gaussRows, hanoiPic, hanoiStates, hanoiTask,
  isPrime, numberGrid, oddLayers, opChain, pigeonBoxes, primeTapTask, reachTask, removeTwoTask, sieveFrames,
  staircase, triDots, triRow,
} from '../widgets/math-thinking';

const tri = (n: number) => (n * (n + 1)) / 2;

/** Drop options whose text repeats an earlier one (the correct option goes first). */
function uniq(opts: Choice[]): Choice[] {
  const seen = new Set<string>();
  return opts.filter((o) => (seen.has(o.text) ? false : (seen.add(o.text), true)));
}

// ---------------------------------------------------------------- 1. patterns

const genNextTerm: Generator = (rng) => {
  const type = pick(rng, ['arith', 'tri', 'geo'] as const);
  let terms: number[], next: number, opts: Choice[], explain: string;
  if (type === 'arith') {
    const a = randInt(rng, 1, 20), d = randInt(rng, 2, 9);
    terms = [0, 1, 2, 3, 4].map((i) => a + d * i);
    next = a + 5 * d;
    const last = terms[4];
    opts = [
      { text: String(next), correct: true },
      { text: String(last + 2 * d), why: `That adds two gaps at once. Each term is just ${d} more than the one before.` },
      { text: String(2 * last), why: `Doubling isn’t the rule: the terms grow by the same ${d} every step.` },
      { text: String(last + d + 1), why: `The gap doesn’t change here: it’s ${d} every time.` },
    ];
    explain = `The gaps are all ${d}, so add ${d} once more: ${last} + ${d} = ${next}.`;
  } else if (type === 'tri') {
    const a = randInt(rng, 1, 10), d = randInt(rng, 1, 5);
    terms = [a];
    for (let i = 0; i < 4; i++) terms.push(terms[i] + d + i);
    const last = terms[4];
    next = last + d + 4;
    opts = [
      { text: String(next), correct: true },
      { text: String(last + d + 3), why: `That repeats the last gap (${d + 3}), but the gaps grow by 1 each time.` },
      { text: String(last + d + 5), why: `One too far: the gaps go ${d}, ${d + 1}, ${d + 2}, ${d + 3}, so the next is ${d + 4}.` },
      { text: String(2 * last), why: 'Doubling isn’t the rule: look at the differences between terms.' },
    ];
    explain = `The differences are ${d}, ${d + 1}, ${d + 2}, ${d + 3}: they grow by 1. Next difference ${d + 4}: ${last} + ${d + 4} = ${next}.`;
  } else {
    const a = randInt(rng, 1, 5), r = pick(rng, [2, 3]);
    terms = [0, 1, 2, 3, 4].map((i) => a * r ** i);
    const last = terms[4];
    next = last * r;
    opts = [
      { text: String(next), correct: true },
      { text: String(last + (last - terms[3])), why: 'That adds the last gap again, but here the gaps themselves keep multiplying.' },
      { text: String(last * (r + 1)), why: `The ratio stays the same: each term is ${r} times the one before.` },
      { text: String(last + r), why: `Each term is multiplied by ${r}, not increased by ${r}.` },
    ];
    explain = `Each term is ${r} times the one before: ${last} × ${r} = ${next}.`;
  }
  return {
    kind: 'choice', body: `What comes next? **${terms.join(', ')}, …**`, options: uniq(opts),
    hint: 'Write the differences between neighbouring terms. Are they constant, growing steadily, or multiplying?', explain,
  };
};

const genRangeSum: Generator = (rng) => {
  const a = randInt(rng, 1, 40), count = randInt(rng, 8, 60), b = a + count - 1;
  const s = ((a + b) * count) / 2;
  return {
    kind: 'number', tol: 0,
    body: `Add up every whole number from **${a}** to **${b}**. What's the total?`,
    answer: s,
    hint: 'Pair the first with the last, the second with the second-to-last… How many numbers are there, and what does each pair add to?',
    explain: `There are ${count} numbers. Writing the list forwards and backwards, every column adds to ${a} + ${b} = ${a + b}, so twice the sum is ${count} × ${a + b} = ${count * (a + b)}. The sum is half that: ${num(s)}.`,
  };
};

const genPairFill: Generator = (rng) => {
  const a = randInt(rng, 1, 40), count = 2 * randInt(rng, 4, 25), b = a + count - 1;
  return {
    kind: 'fill',
    body: `Gauss's trick on **${a} + ${a + 1} + … + ${b}** (${count} numbers): pair the first with the last, the second with the second-to-last, and so on.`,
    template: `${a} + ${a + 1} + … + ${b} = [[0]] pairs, each adding to [[1]]`,
    blanks: [
      { options: [String(count / 2), String(count), String(count / 2 + 1)], answer: 0 },
      { options: [String(a + b), String(b - a), String(a + b + 1)], answer: 0 },
    ],
    hint: 'Each pair uses up two numbers.',
    explain: `${count} numbers make ${count / 2} pairs, and each pair adds to ${a} + ${b} = ${a + b}. Total: ${count / 2} × ${a + b} = ${num((count / 2) * (a + b))}.`,
  };
};

// ---------------------------------------------------------------- 2. parity

const genParitySort: Generator = (rng) => {
  const aOdd = rng() < 0.5, bOdd = rng() < 0.5;
  const a = aOdd ? 2 * randInt(rng, 1, 9) + 1 : 2 * randInt(rng, 1, 9);
  const b = bOdd ? 2 * randInt(rng, 1, 9) + 1 : 2 * randInt(rng, 1, 9);
  const pool: [string, number][] = [
    ['a + b', a + b], ['a × b', a * b], ['a + a', a + a], ['b × b', b * b], ['a × a + b', a * a + b],
    ['3 × a', 3 * a], ['a + b + 1', a + b + 1], ['2 × b + 1', 2 * b + 1], ['a × b + a', a * b + a], ['b + b + b', 3 * b],
  ];
  const chosen = shuffle(rng, pool).slice(0, 5);
  return {
    kind: 'sort',
    body: `Let **a = ${a}** and **b = ${b}**. Sort each expression into even or odd. Use parity rules (odd × odd = odd, odd + odd = even…) rather than working the numbers out.`,
    bins: ['Even', 'Odd'],
    items: chosen.map(([t, v]) => ({ text: t, bin: v % 2 })),
    hint: `a is ${aOdd ? 'odd' : 'even'}, b is ${bOdd ? 'odd' : 'even'}. A product is odd only if every factor is odd; a sum is odd when it has an odd number of odd parts.`,
    explain: chosen.map(([t, v]) => `${t} = ${v} (${v % 2 ? 'odd' : 'even'})`).join('; ') + '.',
  };
};

const genErase: Generator = (rng) => {
  const n = randInt(rng, 5, 24);
  const s = tri(n), odd = s % 2 === 1;
  return {
    kind: 'choice',
    body: `The numbers 1, 2, …, ${n} are on a board. A move: erase any two numbers and write their (positive) difference. Keep going until one number is left. What can you say about it?`,
    options: [
      { text: 'It is always odd', correct: odd, why: odd ? undefined : `The total starts at ${s}, which is even, and its parity never changes.` },
      { text: 'It is always even', correct: !odd, why: odd ? `The total starts at ${s}, which is odd, and its parity never changes.` : undefined },
      { text: 'It depends on which moves you make', why: 'Its exact value can depend on the moves, but its parity can’t: replacing a and b by a − b changes the total by 2b, an even number.' },
    ],
    hint: 'Watch the parity of the total. Replacing a and b by a − b changes the total by how much?',
    explain: `Replacing a and b (a ≥ b) by a − b lowers the total by 2b, which is even, so the total's parity is an invariant. It starts at 1 + … + ${n} = ${s}, which is ${odd ? 'odd' : 'even'}, so the last number is ${odd ? 'odd' : 'even'}.`,
  };
};

const genHandshake: Generator = (rng) => {
  const k = randInt(rng, 4, 11), d = randInt(rng, 1, k - 1);
  const ok = (k * d) % 2 === 0;
  return {
    kind: 'choice', ordered: true,
    body: `${k} people are at a meeting. Could each of them shake hands with **exactly ${d}** of the others?`,
    options: [
      { text: 'Possible', correct: ok, why: ok ? undefined : `Adding everyone's count gives ${k} × ${d} = ${k * d}, which is odd. But every handshake adds exactly 2 to that total, so it must be even.` },
      { text: 'Impossible', correct: !ok, why: ok ? `The parity check passes: ${k} × ${d} = ${k * d} is even. Seat people in a circle and have each shake hands with their nearest neighbours${d % 2 ? ' and the person directly opposite' : ''}${d === 1 ? ' (for 1: just pair people off)' : ''}.` : undefined },
    ],
    hint: 'Count handshake "ends": each handshake has two.',
    explain: ok
      ? `The total of everyone's counts is ${k} × ${d} = ${k * d}, even, as it must be. And it can be arranged: ${d === 1 ? 'pair people off.' : `seat them in a circle; each shakes hands with the ${Math.floor(d / 2)} nearest on each side${d % 2 ? ', plus the person directly opposite' : ''}.`}`
      : `Each handshake adds 2 to the sum of everyone's counts, so that sum is even. Here it would be ${k} × ${d} = ${k * d}: odd. Impossible.`,
  };
};

// ---------------------------------------------------------------- 3. pigeonhole

const COLOURS = ['red', 'blue', 'green', 'black', 'white', 'grey', 'yellow', 'purple'];

const genSocks: Generator = (rng) => {
  const k = randInt(rng, 2, 8), m = randInt(rng, 2, 5);
  const ans = k * (m - 1) + 1;
  return {
    kind: 'number', tol: 0,
    body: `A drawer holds plenty of socks in ${k} colours (${COLOURS.slice(0, k).join(', ')}). In the dark, how many must you take out to be **sure** of having ${m} socks of the same colour?`,
    answer: ans, unit: 'socks',
    hint: `Imagine the worst luck: how many can you take with no colour reaching ${m}?`,
    explain: `Worst case: ${m - 1} of each colour, ${k} × ${m - 1} = ${k * (m - 1)} socks, and still no ${m} alike. The next sock must make ${m} of some colour: ${ans}.`,
  };
};

const genCeil: Generator = (rng) => {
  const k = randInt(rng, 3, 12), n = randInt(rng, k + 1, 9 * k);
  const ctx = pick(rng, [['letters', 'pigeonholes'], ['guests', 'tables'], ['files', 'folders'], ['books', 'shelves']] as const);
  const ans = Math.ceil(n / k);
  return {
    kind: 'number', tol: 0,
    body: `${n} ${ctx[0]} go into ${k} ${ctx[1]}, any way at all. The fullest of the ${ctx[1]} must hold **at least** how many?`,
    answer: ans,
    hint: `If every one held fewer than that, how many could they hold in total?`,
    explain: `If each held at most ${ans - 1}, the ${k} ${ctx[1]} would hold at most ${k * (ans - 1)} < ${n}. So one holds at least ${ans} (= ${n} ÷ ${k} rounded up). And spreading them as evenly as possible shows ${ans} can be the most.`,
  };
};

const genPairSum: Generator = (rng) => {
  const n = randInt(rng, 5, 30);
  return {
    kind: 'number', tol: 0,
    body: `You pick numbers from 1 to ${2 * n}. How many must you pick to be **sure** two of them add up to ${2 * n + 1}?`,
    answer: n + 1,
    hint: `Group the numbers into pairs that add to ${2 * n + 1}: 1 + ${2 * n}, 2 + ${2 * n - 1}, …`,
    explain: `There are ${n} pairs adding to ${2 * n + 1} (the boxes). You can pick one from each pair, ${n} numbers, without success. Pick ${n + 1} and two must come from the same pair.`,
  };
};

// ---------------------------------------------------------------- 4. counterexamples

const genCEMulti: Generator = (rng) => {
  const A = pick(rng, [2, 3, 4, 5]), m = pick(rng, [2, 3]), B = A * m;
  const vals = new Set<number>();
  const ce = () => { let k; do k = randInt(rng, 1, 15); while (k % m === 0); return A * k; };
  while (vals.size < 2) vals.add(ce());
  while (vals.size < 3) vals.add(B * randInt(rng, 1, 8));
  while (vals.size < 4) { const v = randInt(rng, 3, 60); if (v % A) vals.add(v); }
  while (vals.size < 5) vals.add(randInt(rng, 3, 60));
  const options: Choice[] = [...vals].map((v) => v % A === 0 && v % B !== 0
    ? { text: String(v), correct: true, why: `${v} is divisible by ${A} but not by ${B}: it breaks the claim.` }
    : v % A !== 0 ? { text: String(v), why: `${v} isn't divisible by ${A}, so the claim says nothing about it. It can't be a counterexample.` }
    : { text: String(v), why: `${v} is divisible by ${A} and by ${B}: it fits the claim.` });
  return {
    kind: 'multi', ordered: true,
    body: `Claim: “Every number divisible by ${A} is divisible by ${B}.” Select **all** the counterexamples.`,
    options,
    hint: `A counterexample must satisfy the "if" part (divisible by ${A}) and fail the "then" part.`,
    explain: `Counterexamples are divisible by ${A} but not by ${B}: ${options.filter((o) => o.correct).map((o) => o.text).join(', ')}. One is enough to sink the claim.`,
  };
};

interface Claim { claim: string; fails: (string | number)[]; fits: (string | number)[]; whyFit: (v: string) => string; whyFail: (v: string) => string }
const CLAIMS: Claim[] = [
  { claim: 'x² ≥ x for every number x.', fails: ['1/2', '0.3', '0.9', '1/4'], fits: ['2', '−3', '0', '1', '1.5', '−0.5'],
    whyFit: (v) => `x = ${v} satisfies x² ≥ x, so it fits the claim.`, whyFail: (v) => `${v} squared is smaller than ${v}: numbers between 0 and 1 shrink when squared.` },
  { claim: 'Every prime number is odd.', fails: ['2'], fits: ['3', '5', '7', '9', '11', '15', '13'],
    whyFit: (v) => (isPrime(Number(v)) ? `${v} is prime and odd: it fits.` : `${v} isn't prime, so the claim says nothing about it (an odd non-prime is the converse, not a counterexample).`),
    whyFail: () => '2 is prime and even.' },
  { claim: 'n² + n is divisible by 4 for every whole number n.', fails: ['1', '2', '5', '6', '9', '10'], fits: ['3', '4', '7', '8', '11', '12'],
    whyFit: (v) => { const n = Number(v); return `${n}² + ${n} = ${n * n + n}, which is divisible by 4.`; },
    whyFail: (v) => { const n = Number(v); return `${n}² + ${n} = ${n * n + n}, which isn't divisible by 4.`; } },
  { claim: 'Every whole number ending in 7 is prime.', fails: ['27', '57', '77', '87', '117'], fits: ['7', '17', '37', '47', '67', '97'],
    whyFit: (v) => `${v} is prime: it fits.`, whyFail: (v) => `${v} = ${factor(Number(v)).join(' × ')}: ends in 7 but isn't prime.` },
];

const genCEChoice: Generator = (rng) => {
  const c = pick(rng, CLAIMS);
  const bad = String(pick(rng, c.fails));
  const good = shuffle(rng, c.fits).slice(0, 3).map(String);
  return {
    kind: 'choice',
    body: `Claim: “${c.claim}” Which of these is a **counterexample**?`,
    options: [{ text: bad, correct: true }, ...good.map((g) => ({ text: g, why: c.whyFit(g) }))],
    hint: 'A counterexample meets the conditions of the claim but makes its conclusion false.',
    explain: `${c.whyFail(bad)} One counterexample is enough to show the claim is false.`,
  };
};

const NOUNS: [string, string, string][] = [['doors', 'door', 'locked'], ['trains', 'train', 'late'], ['lights', 'light', 'on'], ['answers', 'answer', 'correct'], ['tickets', 'ticket', 'sold'], ['windows', 'window', 'open']];

const genNegation: Generator = (rng) => {
  const [P, S, A] = pick(rng, NOUNS);
  const form = pick(rng, ['all', 'some', 'none'] as const);
  const all = `All the ${P} are ${A}.`, some = `At least one ${S} is ${A}.`, someNot = `At least one ${S} is not ${A}.`, none = `No ${S} is ${A}.`;
  const map = {
    all: { st: all, neg: someNot, wrong: [[none, `Too strong. To break "all", one exception is enough; you don't need every ${S} to fail.`], [some, `That can be true at the same time as the original, so it isn't its opposite.`]] },
    some: { st: some, neg: none, wrong: [[someNot, `Both can be true together (one ${S} ${A}, another not), so this isn't the opposite.`], [all, `That's stronger than the original, not its opposite.`]] },
    none: { st: none, neg: some, wrong: [[all, `Too strong. To break "none", a single ${S} that is ${A} is enough.`], [someNot, `That's compatible with the original, so it isn't its opposite.`]] },
  }[form];
  return {
    kind: 'choice',
    body: `What is the **negation** (exact opposite) of: “${map.st}”`,
    options: [{ text: map.neg, correct: true }, ...map.wrong.map(([t, w]) => ({ text: t, why: w }))],
    hint: 'The negation is true exactly when the original is false. What is the least that would make the original false?',
    explain: `“${map.st}” is false exactly when “${map.neg}” is true. "For all" flips to "there exists … not", and "there exists" flips to "none".`,
  };
};

// ---------------------------------------------------------------- 5. proof by picture

const genOddSum: Generator = (rng) => {
  const n = randInt(rng, 6, 60), last = 2 * n - 1;
  return {
    kind: 'number', tol: 0,
    body: `What is **1 + 3 + 5 + … + ${last}** (all the odd numbers up to ${last})?`,
    answer: n * n,
    hint: 'How many odd numbers are there from 1 to that last one? Then think of the L-shaped layers of a square.',
    explain: `The odd numbers 1 to ${last} are the first ${n} odd numbers (since 2 × ${n} − 1 = ${last}), and they stack into a ${n} × ${n} square: ${n * n}.`,
  };
};

const genDiffSquares: Generator = (rng) => {
  const mid = pick(rng, [20, 30, 40, 50, 60, 70, 80, 90, 100]), d = randInt(rng, 1, 4);
  const a = mid + d, b = mid - d;
  return {
    kind: 'number', tol: 0,
    body: `Without a calculator: **${a}² − ${b}²** = ?`,
    answer: a * a - b * b,
    hint: 'a² − b² = (a + b)(a − b).',
    explain: `(${a} + ${b}) × (${a} − ${b}) = ${a + b} × ${2 * d} = ${num(a * a - b * b)}. The cut-and-rearrange picture turns the L-shaped difference into a rectangle.`,
  };
};

const genFigPoint: Generator = (rng) => {
  const sq = rng() < 0.5;
  const n = sq ? randInt(rng, 2, 5) : randInt(rng, 3, 7);
  const f = sq ? (k: number) => k * k : tri;
  const shown = [1, 2, 3, 4, 5, 6, 7].filter((k) => k < n).slice(-3);
  return {
    kind: 'point',
    body: sq
      ? `Each dot is (n, 1 + 3 + … + (2n − 1)), the sum of the first n odd numbers. Place the dot for **n = ${n}**.`
      : `Each dot is (n, 1 + 2 + … + n), the n-th triangular number. Place the dot for **n = ${n}**.`,
    plot: { x: [0, 8], y: [0, 30], xlabel: 'n', ticks: [1, 5], size: [420, 300], layers: [{ type: 'dots', pts: shown.map((k) => [k, f(k)] as [number, number]) }] },
    answer: { x: n, y: f(n) }, tol: 0.5, snap: 1,
    hint: sq ? 'The sum of the first n odd numbers makes an n × n square.' : 'Triangular numbers: 1, 3, 6, 10, 15, … (add the next whole number each time).',
    explain: sq ? `First ${n} odd numbers: ${n}² = ${n * n}. So (${n}, ${n * n}).` : `1 + … + ${n} = ${n} × ${n + 1} ÷ 2 = ${tri(n)}. So (${n}, ${tri(n)}).`,
  };
};

// ---------------------------------------------------------------- 6. primes

const genDiv: Generator = (rng) => {
  const cls = pick(rng, [0, 1, 2]); // 0: by 9, 1: by 3 not 9, 2: not by 3
  const len = randInt(rng, 4, 7);
  const digits = [randInt(rng, 1, 9), ...Array.from({ length: len - 2 }, () => randInt(rng, 0, 9))];
  const s = digits.reduce((a, b) => a + b, 0);
  const okLast = Array.from({ length: 10 }, (_, d) => d).filter((d) => { const r = (s + d) % 9; return cls === 0 ? r === 0 : cls === 1 ? r === 3 || r === 6 : r % 3 !== 0; });
  digits.push(pick(rng, okLast));
  const N = Number(digits.join(''));
  const ds = digits.reduce((a, b) => a + b, 0);
  const real = N % 9 === 0 ? 0 : N % 3 === 0 ? 1 : 2;
  const texts = ['Divisible by 9', 'Divisible by 3 but not by 9', 'Not divisible by 3'];
  const whys = [`Its digit sum ${ds} is not a multiple of 9.`, ds % 3 === 0 ? `Its digit sum ${ds} is a multiple of 9 as well, so it's divisible by 9.` : `Its digit sum ${ds} isn't a multiple of 3.`, `Its digit sum ${ds} is a multiple of 3.`];
  return {
    kind: 'choice', ordered: true,
    body: `Which is true of **${N.toLocaleString('en-US')}**?`,
    options: texts.map((t, k) => (k === real ? { text: t, correct: true } : { text: t, why: whys[k] })),
    hint: 'Add up the digits.',
    explain: `Digit sum: ${digits.join(' + ')} = ${ds}. A number leaves the same remainder as its digit sum when divided by 3 or 9, so ${N.toLocaleString('en-US')} is ${['divisible by 9', 'divisible by 3 but not by 9', 'not divisible by 3'][real]}.`,
  };
};

const ODD_COMPOSITES = Array.from({ length: 100 }, (_, i) => i + 21).filter((n) => n % 2 && n % 5 && !isPrime(n));
const PRIMES_120 = Array.from({ length: 119 }, (_, i) => i + 2).filter(isPrime);

const genPrimeMulti: Generator = (rng) => {
  const vals = new Set<number>();
  while (vals.size < 2) vals.add(pick(rng, PRIMES_120.filter((p) => p > 10)));
  while (vals.size < 4) vals.add(pick(rng, ODD_COMPOSITES));
  while (vals.size < 5) vals.add(randInt(rng, 2, 120));
  const xs = [...vals].sort((a, b) => a - b);
  return {
    kind: 'multi', ordered: true,
    body: `Select **all** the primes: ${xs.join(', ')}.`,
    options: xs.map((n) => (isPrime(n) ? { text: String(n), correct: true, why: `${n} has no divisor between 2 and √${n}.` } : { text: String(n), why: `${n} = ${factor(n).join(' × ')}.` })),
    hint: 'Try dividing by 2, 3, 5, 7: for numbers up to 120 that is enough, since 11² = 121.',
    explain: `Primes: ${xs.filter(isPrime).join(', ')}. ${xs.filter((n) => !isPrime(n)).map((n) => `${n} = ${factor(n).join(' × ')}`).join('; ')}.`,
  };
};

const genSqrtBound: Generator = (rng) => {
  const N = randInt(rng, 60, 900);
  const r = Math.floor(Math.sqrt(N));
  let p = r; while (!isPrime(p)) p--;
  return {
    kind: 'number', tol: 0,
    body: `To check whether **${N}** is prime by trial division, what's the **largest prime** you'd ever need to try dividing by?`,
    answer: p,
    hint: `If ${N} = a × b, the smaller factor is at most √${N} ≈ ${num(Math.sqrt(N), 4)}.`,
    explain: `If ${N} had a factor bigger than √${N} ≈ ${num(Math.sqrt(N), 4)}, its partner factor would be smaller than √${N}, and you'd already have found it. So you only test primes up to ${r}: the largest is ${p}.`,
  };
};

// ---------------------------------------------------------------- 7. induction

const genHanoi: Generator = (rng) => {
  const n = randInt(rng, 3, 15);
  return {
    kind: 'number', tol: 0,
    body: `What is the fewest number of moves to shift a Tower of Hanoi with **${n} disks**?`,
    answer: 2 ** n - 1,
    hint: 'M(1) = 1 and M(n) = 2·M(n − 1) + 1. Or use the closed form.',
    explain: `M(n) = 2ⁿ − 1, so 2^${n} − 1 = ${num(2 ** n - 1)}.`,
  };
};

const genRecurrence: Generator = (rng) => {
  const a1 = randInt(rng, 1, 5), r = pick(rng, [2, 3]), c = randInt(rng, 0, 4), k = randInt(rng, 4, 6);
  const seq = [a1];
  for (let i = 1; i < k; i++) seq.push(r * seq[i - 1] + c);
  return {
    kind: 'number', tol: 0,
    body: `A sequence starts **a₁ = ${a1}**, and each term is **a(n) = ${r} × a(n − 1)${c ? ` + ${c}` : ''}**. What is **a${'₀₁₂₃₄₅₆₇₈₉'[k]}**?`,
    answer: seq[k - 1],
    hint: 'Build it up one term at a time from a₁.',
    explain: `${seq.join(', ')}. Each term is built from the one before, like dominoes knocking each other over.`,
  };
};

const genStepFill: Generator = (rng) => {
  const k = randInt(rng, 3, 12);
  return {
    kind: 'fill',
    body: `Inductive step for 1 + 3 + … + (2n − 1) = n². Suppose you know **1 + 3 + … + ${2 * k - 1} = ${k * k}** (that's n = ${k}). Add the next odd number:`,
    template: `${k * k} + [[0]] = [[1]] = ${k + 1}²`,
    blanks: [
      { options: [String(2 * k + 1), String(2 * k - 1), String(2 * k + 2)], answer: 0 },
      { options: [String((k + 1) ** 2), String(k * k + 2 * k), String((k + 2) ** 2)], answer: 0 },
    ],
    hint: `After ${2 * k - 1}, the next odd number is 2 more.`,
    explain: `The next odd number is ${2 * k + 1}, and ${k * k} + ${2 * k + 1} = ${(k + 1) ** 2} = ${k + 1}². In general k² + (2k + 1) = (k + 1)²: if the claim holds for k, it holds for k + 1.`,
  };
};

// ---------------------------------------------------------------- 8. working backwards

function describeOps(rng: Rng, x: number): { words: string[]; result: number; undo: string[] } {
  let v = x;
  const words: string[] = [], undo: string[] = [];
  const ops = shuffle(rng, ['mul', 'add', 'sub', 'mul2'] as const).slice(0, 3);
  for (const op of ops) {
    if (op === 'mul' || op === 'mul2') { const m = randInt(rng, 2, 5); v *= m; words.push(`multiply by ${m}`); undo.push(`÷ ${m}`); }
    else if (op === 'add') { const a = randInt(rng, 2, 15); v += a; words.push(`add ${a}`); undo.push(`− ${a}`); }
    else { const a = randInt(rng, 1, Math.min(9, v - 1)); v -= a; words.push(`subtract ${a}`); undo.push(`+ ${a}`); }
  }
  return { words, result: v, undo: undo.reverse() };
}

const genReverse: Generator = (rng) => {
  const x = randInt(rng, 2, 20);
  const { words, result, undo } = describeOps(rng, x);
  return {
    kind: 'number', tol: 0,
    body: `I think of a number. I ${words[0]}, then ${words[1]}, then ${words[2]}. I end up with **${result}**. What was my number?`,
    answer: x,
    hint: 'Start from the end and undo each step, last step first.',
    explain: `Undo in reverse order: ${result} ${undo.join(' ')} → ${x}.`,
  };
};

const genSpend: Generator = (rng) => {
  const m = randInt(rng, 1, 3), k = randInt(rng, 1, 6);
  let v = 0;
  const trail = [0];
  for (let i = 0; i < m; i++) { v = (v + k) * 2; trail.push(v); }
  const hi = Math.max(10, Math.ceil((v * 1.3) / 10) * 10);
  return {
    kind: 'point',
    body: `Sam spends half of his money, then $${k} more. He does this **${m === 1 ? 'once' : `${m} times`}** in total and ends with $0. Place his starting amount on the line.`,
    plot: { x: [0, hi], xlabel: '$', size: [420, 90] },
    answer: { x: v }, tol: 0.5, snap: 1,
    hint: `Work backwards from $0: before "$${k} more" he had $${k}; before "half", twice that.`,
    explain: `Backwards: ${trail.join(' → ')} (each round: add ${k}, then double). He started with $${v}.`,
  };
};

const genLily: Generator = (rng) => {
  const D = randInt(rng, 10, 60), k = randInt(rng, 1, 4);
  return {
    kind: 'number', tol: 0,
    body: `A patch of weed doubles in area every day and covers the whole pond on day ${D}. On which day did it cover **1/${2 ** k}** of the pond?`,
    answer: D - k,
    hint: 'Go backwards from the full pond: each day back halves it.',
    explain: `Day ${D}: all of it. Each day back halves the area${k > 1 ? `, and 1/${2 ** k} is ${k} halvings` : ''}: day ${D - k}.`,
  };
};

// ---------------------------------------------------------------- shared step pieces

const eulerExplorer = explorer({
  params: [{ id: 'n', label: 'n', min: 0, max: 45, step: 1, value: 0 }],
  draw: (v) => {
    const n = v.n, val = n * n + n + 41, f = factor(val), prime = f.length === 1;
    return bigLine(`${n}² + ${n} + 41 = ${val}`, prime ? 'var(--text)' : 'var(--bad)', prime ? 'prime' : `= ${f.join(' × ')}: not prime!`);
  },
  goal: (v) => !isPrime(v.n * v.n + v.n + 41),
  goalText: 'A counterexample: the claim is false.',
});

const sockExplorer = explorer({
  params: [{ id: 'n', label: 'socks taken', min: 1, max: 12, step: 1, value: 1 }],
  draw: (v) => {
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < v.n; i++) counts[i % 5]++;
    return pigeonBoxes(counts, { labels: ['red', 'blue', 'green', 'black', 'white'], colors: ['var(--c4)', 'var(--c1)', 'var(--c3)', 'var(--muted)', 'var(--c2)'] });
  },
  readout: (v) => (v.n <= 5 ? (v.n === 1 ? 'One sock: no pair yet.' : `Worst luck: ${v.n} socks, all different colours. No pair yet.`) : `Even with the worst luck, ${v.n} socks force a pair.`),
  goal: (v) => v.n === 6,
  goalText: '6 is the fewest that guarantees a pair.',
});

const SIEVE = sieveFrames(50);

/** 1..2n grouped into the n pairs that add to 2n + 1. */
const pairBoxes = (n: number) => h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center' },
  Array.from({ length: n }, (_, k) => h('div', { style: `border:2px solid var(--c${(k % 6) + 1});border-radius:12px;padding:0 3px` }, cells([k + 1, 2 * n - k], { index: false }))));

/** Euclid numbers: product of the first k primes, plus 1, and its factorisation. */
const euclidTable = (upto: number) => {
  const ps = [2, 3, 5, 7, 11, 13].slice(0, upto);
  return dataTable(['Primes', 'Product + 1', 'Factors'], ps.map((_, i) => {
    const list = ps.slice(0, i + 1), N = list.reduce((a, b) => a * b, 1) + 1, f = factor(N);
    return [list.join(' × '), N.toLocaleString('en-US'), f.length === 1 ? 'prime' : f.join(' × ')];
  }));
};

// ---------------------------------------------------------------- course

export const mathThinking: Course = {
  id: 'math-thinking',
  title: 'Mathematical Thinking',
  blurb: 'Spot structure, find invariants, hunt counterexamples and build proofs you can see.',
  color: '#c2569b',
  icon: '🧮',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'patterns',
      title: 'Spotting structure',
      goal: 'Read the rule behind a sequence and add up long runs in one line.',
      steps: [
        {
          kind: 'choice', ordered: true,
          body: 'Dots stacked in triangles: 1, 3, 6, 10, 15, … How many dots in the **next** triangle?',
          widget: () => triRow([1, 2, 3, 4, 5]),
          options: [
            { text: '20', why: 'That adds 5 again, but each new row is one dot longer than the last: the 6th row has 6 dots.' },
            { text: '21', correct: true },
            { text: '25', why: '25 is a square number (5 × 5). Triangles grow by one longer row, not into squares.' },
            { text: '30', why: 'Doubling 15 overshoots: the triangle only gains one new row.' },
          ],
          hint: 'Each triangle adds a new bottom row. How long is that row?',
          explain: 'Each new triangle adds a row one dot longer than the previous one: 15 + 6 = 21.',
        },
        {
          kind: 'read',
          title: 'Triangular numbers',
          body: 'The n-th **triangular number** is 1 + 2 + 3 + … + n: the dots in a triangle with n rows. Step through them. The *differences* between neighbours, 2, 3, 4, 5…, are the new rows.',
          widget: () => stepper(8, (i) => triDots(i + 1, { last: 'var(--c2)' }), { caption: (i) => `${Array.from({ length: i + 1 }, (_, k) => k + 1).join(' + ')} = ${tri(i + 1)}` }),
        },
        {
          kind: 'number', tol: 0,
          body: 'How many dots are in the triangle with **10** rows?',
          answer: 55,
          hint: '1 + 2 + … + 10. You can keep adding rows from 21.',
          explain: '21 (6 rows) + 7 + 8 + 9 + 10 = 55.',
        },
        {
          kind: 'read',
          title: 'Gauss’s pairing trick',
          body: 'Adding row by row gets slow. Instead, write the sum forwards and **backwards** and add the columns. Every column makes the same total, so the hard sum becomes one multiplication. Then halve, because you used every number twice.',
          widget: () => gaussRows(10),
        },
        {
          kind: 'number', tol: 0,
          body: 'Use the trick: **1 + 2 + 3 + … + 100** = ?',
          answer: 5050,
          hint: '100 columns, each adding to 101. Then halve.',
          explain: 'Forwards and backwards, every column adds to 101, and there are 100 columns: 100 × 101 = 10,100. That counts every number twice, so the sum is 5,050.',
        },
        {
          kind: 'fill',
          body: 'Write the trick as a formula for any n.',
          template: '1 + 2 + … + n = [[0]] × [[1]] ÷ 2',
          blanks: [
            { options: ['n', 'n²', '2n'], answer: 0 },
            { options: ['(n + 1)', '(n − 1)', 'n'], answer: 0 },
          ],
          hint: 'How many columns, and what does each column add to?',
          explain: 'n columns, each adding to n + 1, counts everything twice: n(n + 1) ÷ 2. Check: 10 × 11 ÷ 2 = 55.',
        },
        {
          kind: 'point',
          body: 'Plotted: (rows, dots) for triangles with 1 to 5 rows. Place the dot for **6 rows**.',
          plot: { x: [0, 8], y: [0, 40], xlabel: 'rows', ylabel: 'dots', ticks: [1, 5], size: [420, 300], layers: [{ type: 'dots', pts: [[1, 1], [2, 3], [3, 6], [4, 10], [5, 15]] }] },
          answer: { x: 6, y: 21 }, tol: 0.5, snap: 1,
          hint: 'You found this number in the first question.',
          explain: '6 rows hold 21 dots: (6, 21). The dots curve upwards because each step adds a bigger row.',
        },
        {
          kind: 'read',
          title: 'Differences reveal the rule',
          body: 'A quick way to see the structure of a sequence: write the differences between neighbours. **Constant** differences mean a steady (linear) pattern. Differences that themselves grow steadily mean something like the triangular numbers. Differences that **multiply** mean doubling-type growth.',
          widget: () => dataTable(['Sequence', 'Differences', 'Kind'], [
            ['4, 7, 10, 13', '3, 3, 3', 'constant'],
            ['1, 3, 6, 10', '2, 3, 4', 'growing steadily'],
            ['3, 6, 12, 24', '3, 6, 12', 'multiplying'],
          ]),
        },
        {
          kind: 'sort',
          body: 'Sort the sequences by their differences.',
          bins: ['Constant differences', 'Changing differences'],
          items: [
            { text: '5, 8, 11, 14', bin: 0 },
            { text: '1, 4, 9, 16', bin: 1 },
            { text: '20, 16, 12, 8', bin: 0 },
            { text: '2, 4, 8, 16', bin: 1 },
            { text: '0.5, 1, 1.5, 2', bin: 0 },
            { text: '2, 3, 5, 8', bin: 1 },
          ],
          hint: 'Subtract each term from the next.',
          explain: '5, 8, 11, 14 (+3), 20, 16, 12, 8 (−4) and 0.5, 1, 1.5, 2 (+0.5) step evenly. The squares (+3, +5, +7), doubling (+2, +4, +8) and 2, 3, 5, 8 (+1, +2, +3) do not.',
        },
        {
          kind: 'match',
          body: 'Match each sequence to its rule (n = 1, 2, 3, …).',
          heads: ['Sequence', 'n-th term'],
          pairs: [
            ['1, 4, 9, 16, …', 'n²'],
            ['2, 4, 8, 16, …', '2ⁿ'],
            ['1, 3, 6, 10, …', 'n(n + 1) ÷ 2'],
            ['3, 5, 7, 9, …', '2n + 1'],
          ],
          hint: 'Test each rule with n = 1 and n = 2.',
          explain: 'n² gives 1, 4, 9; 2ⁿ gives 2, 4, 8; n(n + 1)/2 gives 1, 3, 6; 2n + 1 gives 3, 5, 7. Checking the first two terms usually separates candidates.',
        },
        {
          kind: 'task',
          title: 'Build a triangle',
          body: 'Find the triangle with exactly **36** dots.',
          widget: explorer({
            params: [{ id: 'n', label: 'rows', min: 1, max: 12, step: 1, value: 1 }],
            draw: (v) => triDots(v.n, { last: 'var(--c2)' }),
            readout: (v) => `${v.n} row${v.n === 1 ? '' : 's'}: ${tri(v.n)} dot${tri(v.n) === 1 ? '' : 's'}`,
            goal: (v) => tri(v.n) === 36,
            goalText: '8 rows: 8 × 9 ÷ 2 = 36.',
          }),
          hint: 'n(n + 1) ÷ 2 = 36 means n(n + 1) = 72.',
          explain: 'n(n + 1) = 72 = 8 × 9, so 8 rows.',
        },
        {
          kind: 'estimate',
          body: '30 people meet, and everyone shakes hands with everyone else once. Roughly how many handshakes? (The 2nd person shakes 1 hand already there, the 3rd shakes 2, …)',
          min: 0, max: 900, step: 5, answer: 435, tol: 40,
          hint: 'It’s 1 + 2 + … + 29.',
          explain: 'The k-th arrival shakes the k − 1 hands already there, so the total is 1 + 2 + … + 29 = 29 × 30 ÷ 2 = 435. Same structure, new costume.',
        },
      ],
      practice: [genNextTerm, genRangeSum, genPairFill],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'parity',
      title: 'Parity & invariants',
      goal: 'Prove things impossible by finding a quantity that never changes.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: 'Cut two opposite corners off an 8 × 8 chessboard. How many squares are left?',
          widget: () => board(8, { removed: ['0,0', '7,7'] }),
          answer: 62,
          explain: '64 − 2 = 62.',
        },
        {
          kind: 'choice',
          body: 'A domino covers two neighbouring squares. Can 31 dominoes cover the 62 remaining squares exactly (no overlaps, nothing hanging off)?',
          widget: () => board(8, { removed: ['0,0', '7,7'] }),
          options: [
            { text: 'Yes: 62 = 2 × 31, so it fits', why: 'The area matches, but matching area is necessary, not sufficient. The shape might still not work.' },
            { text: 'No, it’s impossible', correct: true },
            { text: 'Can’t know without trying every arrangement', why: 'There are far too many arrangements to try, yet a one-line argument settles it. Look at the colours.' },
          ],
          hint: 'What colours does a domino cover? What colours were the two corners?',
          explain: 'Every domino covers one dark and one light square. Both removed corners have the same colour, so 32 squares of one colour remain against 30 of the other. 31 dominoes would need 31 of each.',
        },
        {
          kind: 'read',
          title: 'Invariants',
          body: 'The colour count is an **invariant**: something that stays the same however the pieces go down. Each domino covers *one dark and one light* square, so any tiling covers equally many of each.\n\nIf the start and the goal disagree on an invariant, the goal is impossible. No search needed.',
          widget: () => h('div', null, board(4, { marks: { '1,1': '▮', '1,2': '▮' }, hi: ['1,1', '1,2'], size: 44 }),
            h('div', { class: 'readout' }, 'a domino always covers one dark and one light square')),
        },
        {
          kind: 'task',
          title: 'Keep it tileable',
          body: 'Remove two squares from this 4 × 4 board so the other 14 **can** still be covered by 7 dominoes. Tap two squares.',
          widget: removeTwoTask,
          hint: 'The colour count must stay balanced.',
          explain: 'Remove one dark and one light square. Balance is necessary; for a board like this one it is also enough (a theorem of Ralph Gomory: removing any one dark and one light square leaves a tileable board).',
        },
        {
          kind: 'read',
          title: 'Parity: odd or even',
          body: 'The simplest invariant is **parity**. You never need the actual numbers, only whether they are odd or even:',
          widget: () => dataTable(['', 'even', 'odd'], [['even +', 'even', 'odd'], ['odd +', 'odd', 'even'], ['even ×', 'even', 'even'], ['odd ×', 'even', 'odd']]),
        },
        {
          kind: 'sort',
          body: 'Always even or always odd? (Whole numbers.)',
          bins: ['Always even', 'Always odd'],
          items: [
            { text: 'odd + odd', bin: 0 },
            { text: 'odd × even', bin: 0 },
            { text: 'odd × odd', bin: 1 },
            { text: 'odd + odd + odd', bin: 1 },
            { text: 'even + odd', bin: 1 },
            { text: 'n × (n + 1)', bin: 0 },
          ],
          hint: 'For n × (n + 1): of two neighbouring whole numbers, one is even.',
          explain: 'A sum is odd when it has an odd number of odd parts; a product is odd only when every factor is odd. n(n + 1) always contains an even factor.',
        },
        {
          kind: 'choice',
          body: 'The numbers 1 to 10 are on a board. A move: erase two of them and write their difference (bigger minus smaller). After 9 moves one number is left. **Can it be 0?**',
          widget: () => h('div', null, cells([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { index: false }), h('div', { class: 'readout' }, 'total: 55')),
          options: [
            { text: 'No', correct: true },
            { text: 'Yes, with the right moves', why: 'Try as you like: the parity of the total never changes, and it starts odd.' },
            { text: 'Only if you start by pairing 1 and 2', why: 'No order of moves helps, because every move keeps the total’s parity.' },
          ],
          hint: 'Replacing a and b by a − b changes the total by how much? Is that even or odd?',
          explain: 'Replacing a and b by a − b lowers the total by 2b: an even amount. So the total stays odd forever (it starts at 55), and the last number is odd. Not 0.',
        },
        {
          kind: 'choice',
          body: 'Seven people each shake hands with exactly **three** of the others. Possible?',
          widget: () => h('div', null, network([
            { id: 'A', x: 50, y: 6 }, { id: 'B', x: 86, y: 20 }, { id: 'C', x: 86, y: 44 }, { id: 'D', x: 50, y: 56 }, { id: 'E', x: 14, y: 44 }, { id: 'F', x: 14, y: 20 },
          ], [
            { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'E' }, { a: 'E', b: 'F' }, { a: 'F', b: 'A' }, { a: 'A', b: 'D' }, { a: 'B', b: 'E' }, { a: 'C', b: 'F' },
          ]), h('div', { class: 'readout' }, 'Six people, three handshakes each: 6 × 3 = 18 ends, 9 handshakes')),
          options: [
            { text: 'Yes', why: 'Count the ends: 7 × 3 = 21. But every handshake has 2 ends, so the total must be even.' },
            { text: 'No', correct: true },
            { text: 'Only if someone shakes their own hand', why: 'That isn’t a handshake with one of the others. The counting argument rules it out anyway.' },
          ],
          hint: 'Add up everyone’s handshake count. What does each handshake contribute?',
          explain: 'Adding everyone’s count counts each handshake twice, so the total is always even. 7 × 3 = 21 is odd: impossible. With six people it works, as in the picture.',
        },
        {
          kind: 'fill',
          body: 'State the rule you just used (the "handshake lemma").',
          template: 'Each handshake has [[0]] ends, so the sum of everyone’s handshake counts is always [[1]].',
          blanks: [
            { options: ['2', '1', '3'], answer: 0 },
            { options: ['even', 'odd', 'a multiple of 3'], answer: 0 },
          ],
          explain: 'Two ends per handshake makes the total twice the number of handshakes: even. So the number of people with an odd count is always even too.',
        },
        {
          kind: 'multi',
          body: 'A knight jumps two squares one way and one square sideways. It starts on a light square. After how many jumps could it be back where it started? Select all.',
          widget: () => board(8, { marks: { '4,4': '♞', '2,3': '•', '2,5': '•', '3,2': '•', '3,6': '•', '5,2': '•', '5,6': '•', '6,3': '•', '6,5': '•' }, hi: ['2,3', '2,5', '3,2', '3,6', '5,2', '5,6', '6,3', '6,5'] }),
          options: [
            { text: '2', correct: true, why: 'Jump away and jump back.' },
            { text: '3', why: 'Every jump changes the square’s colour, so after an odd number of jumps the knight is on a dark square.' },
            { text: '4', correct: true, why: 'Away and back, twice.' },
            { text: '7', why: 'Odd number of jumps: the knight ends on a dark square, not its light start.' },
            { text: '8', correct: true, why: 'Any even number works: repeat away-and-back.' },
          ],
          hint: 'Look at the colours of the squares the knight can reach in one jump.',
          explain: 'Each jump moves 3 squares in total (2 + 1), an odd number, so the colour flips every time. Back on light needs an even number of jumps; 2, 4 and 8 all work by going back and forth.',
        },
      ],
      practice: [genParitySort, genErase, genHandshake],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'pigeonhole',
      title: 'The pigeonhole principle',
      goal: 'Guarantee that something must happen by counting boxes.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: 'A drawer is full of black, white and grey socks. The light is off. How many socks must you take out to be **certain** of a matching pair?',
          widget: () => pigeonBoxes([0, 0, 0], { labels: ['black', 'white', 'grey'] }),
          answer: 4, unit: 'socks',
          hint: 'What’s the worst luck you could have?',
          explain: 'With bad luck the first three are all different colours. The fourth must match one of them.',
        },
        {
          kind: 'read',
          title: 'Pigeons and holes',
          body: 'The **pigeonhole principle**: if more items go into boxes than there are boxes, some box gets at least two.\n\nIt sounds too obvious to be useful. The skill is in deciding what the *pigeons* and the *holes* are.',
          widget: () => pigeonBoxes([2, 1, 1], { labels: ['black', 'white', 'grey'], colors: ['var(--muted)', 'var(--c2)', 'var(--c1)'] }),
        },
        {
          kind: 'task',
          title: 'Five colours',
          body: 'Now the drawer has **five** colours. Slide to the fewest socks that guarantee a pair, whatever your luck.',
          widget: sockExplorer,
          hint: 'With worst luck, how many socks can be all different?',
          explain: 'Five socks can all be different. The sixth must repeat a colour: 5 colours + 1 = 6.',
        },
        {
          kind: 'choice',
          body: 'Suppose nobody has more than 1,000,000 hairs on their head. A city has 9,000,000 people. Must two of them have **exactly** the same number of hairs?',
          options: [
            { text: 'Yes, certainly', correct: true },
            { text: 'Very likely, but not certain', why: 'It’s not a matter of chance: there are only 1,000,001 possible counts (0 to 1,000,000) and far more people.' },
            { text: 'No, you’d need to count everyone', why: 'The pigeonhole principle guarantees it without counting a single head.' },
          ],
          hint: 'Pigeons: people. Holes: possible hair counts. How many holes?',
          explain: 'The possible counts 0, 1, …, 1,000,000 are 1,000,001 holes. 9,000,000 people is more than that, so two share a hole.',
        },
        {
          kind: 'number', tol: 0,
          body: 'Same city. In fact, at least **how many** people must share the same hair count?',
          answer: 9,
          hint: 'If every count were shared by at most 8 people, how many people could there be?',
          explain: 'At most 8 per count allows only 8 × 1,000,001 = 8,000,008 people, fewer than 9,000,000. So some count is shared by at least 9.',
        },
        {
          kind: 'read',
          title: 'The general version',
          body: 'With **n** items in **k** boxes, some box holds at least **n ÷ k, rounded up**. Spread 17 items over 5 boxes as evenly as you can and the fullest still has 4.',
          widget: () => barChart([{ label: 'Box 1', value: 4 }, { label: 'Box 2', value: 4 }, { label: 'Box 3', value: 3 }, { label: 'Box 4', value: 3 }, { label: 'Box 5', value: 3 }], { title: '17 items, 5 boxes: 17 ÷ 5 = 3.4, so at least 4' }),
        },
        {
          kind: 'fill',
          body: '“Among any 13 people, two were born in the same month.” Name the pigeons and the holes.',
          template: 'Pigeons: [[0]] · Holes: [[1]]',
          blanks: [
            { options: ['the 13 people', 'the 12 months', 'the matching pair'], answer: 0 },
            { options: ['the 12 months', 'the 13 people', 'the birthdays in common'], answer: 0 },
          ],
          hint: 'The things being placed are pigeons; the categories they go into are holes.',
          explain: 'Each person (pigeon) goes into their birth month (hole). 13 pigeons, 12 holes: two share.',
        },
        {
          kind: 'multi',
          body: 'Which of these are **guaranteed**? Select all.',
          options: [
            { text: 'Among 367 people, two share a birthday', correct: true, why: 'There are 366 possible birthdays, counting 29 February.' },
            { text: 'Among 366 people, two share a birthday', why: 'With 29 February there are 366 possible birthdays, so all 366 people could differ.' },
            { text: 'Among 30 people, two share a birthday', why: 'Likely (about 70%), but not guaranteed: 30 people fit into 366 days easily.' },
            { text: 'Among 27 English words, two start with the same letter', correct: true, why: '26 letters, 27 words.' },
            { text: 'Among 11 whole numbers, two end in the same digit', correct: true, why: '10 possible last digits, 11 numbers.' },
          ],
          hint: 'Count the holes in each case. Is there at least one more pigeon?',
          explain: 'Guaranteed exactly when there are more pigeons than holes: 367 > 366, 27 > 26, 11 > 10. "Very likely" isn’t "guaranteed".',
        },
        {
          kind: 'read',
          title: 'Choose the holes cleverly',
          body: 'Sometimes you have to invent the boxes. Split 1 to 10 into pairs that add to 11: {1, 10}, {2, 9}, {3, 8}, {4, 7}, {5, 6}. Five boxes.',
          widget: () => pairBoxes(5),
        },
        {
          kind: 'choice',
          body: 'You pick **6** different numbers from 1 to 10. Must two of them add up to 11?',
          widget: () => pairBoxes(5),
          options: [
            { text: 'Yes, always', correct: true },
            { text: 'No: 1, 2, 3, 4, 5, 6 has no such pair', why: 'Check again: 5 + 6 = 11. Two of your six always land in the same pair-box.' },
            { text: 'Only if you pick 5 or 6', why: 'Any six numbers work: five boxes can’t hold six picks without doubling up.' },
          ],
          hint: 'Use the five pair-boxes.',
          explain: 'Six numbers into the five boxes {1,10}, {2,9}, {3,8}, {4,7}, {5,6}: two land in the same box, and those two add to 11.',
        },
        {
          kind: 'number', tol: 0,
          body: 'You pick numbers from 1 to 20. How many must you pick to be **sure** two add up to 21?',
          widget: () => pairBoxes(10),
          answer: 11,
          hint: 'How many pairs add to 21? You could take one from each without success.',
          explain: 'Ten pairs add to 21 ({1,20}, …, {10,11}). Ten picks can dodge (one from each pair), but 11 can’t.',
        },
      ],
      practice: [genSocks, genCeil, genPairSum],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'counterexamples',
      title: 'Counterexamples',
      goal: 'Tell "for all" from "there exists", and break false claims with one example.',
      steps: [
        {
          kind: 'choice',
          body: 'The formula **n² + n + 41** gives a prime for n = 0, 1, 2, …, 9. Does that show it gives a prime for **every** whole number n?',
          widget: () => dataTable(['n', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], [['n² + n + 41', ...Array.from({ length: 10 }, (_, n) => n * n + n + 41)]]),
          options: [
            { text: 'No: ten cases can’t cover infinitely many', correct: true },
            { text: 'Yes, the pattern is clear', why: 'Ten examples, or ten thousand, never prove a claim about every n. Patterns can and do break.' },
            { text: 'Yes, because 41 is prime', why: '41 being prime only settles n = 0. Every n needs its own reason.' },
          ],
          hint: 'How many n are there?',
          explain: 'Examples can support a “for all” claim but never prove it. Let’s see whether this one survives.',
        },
        {
          kind: 'task',
          title: 'Hunt the counterexample',
          body: 'Slide n until n² + n + 41 is **not** prime.',
          widget: eulerExplorer,
          hint: 'Try n = 40: what happens to n² + n + 41 then?',
          explain: 'It’s prime all the way to n = 39, then n = 40 gives 1,681 = 41 × 41. (40² + 40 + 41 = 40 × 41 + 41 = 41 × 41.) One counterexample and the “for all” claim is dead.',
        },
        {
          kind: 'read',
          title: 'For all vs there exists',
          body: '- **"For all"** claims (every prime is odd) die from a single counterexample.\n- **"There exists"** claims (some prime is even) are proved by a single example.\n\nSo examples are lopsided: one example proves "there exists", one counterexample disproves "for all", but no pile of examples proves "for all".',
          widget: () => dataTable(['Claim type', 'Prove it by', 'Disprove it by'], [['For all', 'an argument', 'one counterexample'], ['There exists', 'one example', 'an argument']]),
        },
        {
          kind: 'sort',
          body: 'Sort the claims.',
          bins: ['“For all” claim', '“There exists” claim'],
          items: [
            { text: 'Every prime is odd', bin: 0 },
            { text: 'Some prime is even', bin: 1 },
            { text: 'All swans are white', bin: 0 },
            { text: 'Some square number ends in 9', bin: 1 },
            { text: 'No square number ends in 2', bin: 0 },
            { text: 'At least one month has 31 days', bin: 1 },
          ],
          hint: '"No X is Y" means "for every X, X is not Y".',
          explain: '"Every", "all" and "no" talk about everything in a group. "Some" and "at least one" only need one case.',
        },
        {
          kind: 'choice',
          body: '“Every prime number is odd.” True or false?',
          widget: () => numberGrid(20, (k) => (isPrime(k) ? 'prime' : 'plain')),
          options: [
            { text: 'False: 2 is prime and even', correct: true },
            { text: 'False: 9 is odd but not prime', why: '9 says nothing about primes. That would refute the converse (“every odd number is prime”), a different claim.' },
            { text: 'True', why: 'Nearly all primes are odd, but “every” allows no exceptions, and there is one.' },
          ],
          hint: 'Run through the smallest primes.',
          explain: 'A counterexample must satisfy the "if" part (be prime) and fail the "then" part (be odd). 2 does both.',
        },
        {
          kind: 'multi', ordered: true,
          body: 'Claim: “If n is odd, then n² − 1 is divisible by 16.” Select **all** the counterexamples.',
          options: [
            { text: '3', correct: true, why: '3² − 1 = 8: not divisible by 16.' },
            { text: '4', why: '4 isn’t odd, so the claim says nothing about it.' },
            { text: '5', correct: true, why: '5² − 1 = 24: not divisible by 16.' },
            { text: '7', why: '7² − 1 = 48 = 16 × 3. It fits the claim.' },
            { text: '9', why: '9² − 1 = 80 = 16 × 5. It fits the claim.' },
          ],
          hint: 'A counterexample must be odd, with n² − 1 not a multiple of 16.',
          explain: 'For odd n, n² − 1 is always divisible by 8, but only sometimes by 16: 3 and 5 break the claim, 7 and 9 don’t. 4 is irrelevant because it isn’t odd.',
        },
        {
          kind: 'point',
          body: 'Claim: “x² ≥ x for every number x.” Place a **counterexample** on the number line.',
          plot: { x: [-2, 2], ticks: [0.5], size: [420, 90] },
          answer: { x: 0.5 }, tol: 0.45, snap: 0.05,
          hint: 'Negative numbers and numbers above 1 obey the claim. What’s left?',
          explain: 'Any x strictly between 0 and 1 works: (1/2)² = 1/4 < 1/2. Squaring a number between 0 and 1 makes it smaller.',
        },
        {
          kind: 'read',
          title: 'Negating a claim',
          body: 'To say a "for all" claim is false, you don’t claim the opposite about everything. You claim **one exception** exists.\n\nnot (every door is locked) = **some door is unlocked**\n\nnot (some door is locked) = **no door is locked**',
          widget: () => dataTable(['Statement', 'Negation'], [['for all x, P(x)', 'there is an x with not P(x)'], ['there is an x with P(x)', 'for all x, not P(x)']]),
        },
        {
          kind: 'match',
          body: 'Match each statement with its negation.',
          heads: ['Statement', 'Negation'],
          pairs: [
            ['Every door is locked', 'Some door is unlocked'],
            ['Some test was failed', 'No test was failed'],
            ['Every student passed some exam', 'Some student failed every exam'],
            ['There is a dish everyone likes', 'Every dish is disliked by someone'],
          ],
          hint: 'Flip each "every" into "some" and each "some" into "every", and negate the end.',
          explain: 'Negation swaps "for all" and "there exists" and negates what follows. For two quantifiers, flip both: not (∀ student ∃ exam passed) = ∃ student ∀ exam failed.',
        },
        {
          kind: 'number', tol: 0,
          body: 'Claim: “2ⁿ > n² for every whole number n ≥ 1.” It fails for a few small n. What is the **largest** counterexample?',
          widget: plotExplorer({
            params: [{ id: 'n', label: 'n', min: 1, max: 6, step: 1, value: 1 }],
            spec: (v) => ({ x: [0, 6.5], y: [0, 70], xlabel: 'n', ticks: [1, 10], size: [420, 300], layers: [
              { type: 'fn', f: (x) => 2 ** x, label: '2ⁿ', from: 0.5 }, { type: 'fn', f: (x) => x * x, dash: true, label: 'n²', color: 'var(--c2)', from: 0.5 },
              { type: 'vline', x: v.n, color: 'var(--muted)' },
              { type: 'dots', pts: [[v.n, 2 ** v.n], [v.n, v.n * v.n]], color: 'var(--c4)' }] }),
            readout: (v) => `n = ${v.n}: 2ⁿ = ${2 ** v.n}, n² = ${v.n * v.n} → ${2 ** v.n > v.n * v.n ? 'claim holds' : 'counterexample'}`,
          }),
          answer: 4,
          hint: 'Compare 2ⁿ and n² for n = 1 to 6. "Greater than" fails on ties too.',
          explain: '2 > 1 holds; then 4 = 4, 8 < 9 and 16 = 16 all fail; 32 > 25 and from then on 2ⁿ stays ahead. Largest counterexample: n = 4.',
        },
        {
          kind: 'choice',
          body: 'A friend checks “the sum of two odd numbers is even” on a million random pairs. All pass. What has she shown?',
          options: [
            { text: 'Strong evidence, but not a proof', correct: true },
            { text: 'A proof', why: 'A million cases is still not all of them. A proof needs an argument covering every pair.' },
            { text: 'Nothing at all', why: 'Evidence counts for something: it’s why the claim is worth proving. It just isn’t proof.' },
          ],
          explain: 'Proof: two odd numbers are 2a + 1 and 2b + 1; their sum 2(a + b + 1) is even. That covers every pair at once.',
        },
      ],
      practice: [genCEMulti, genCEChoice, genNegation],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'pictures',
      title: 'Proof by picture',
      goal: 'See why sum formulas and algebra identities are true.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: '**1 + 3 + 5 + 7 + 9** = ?',
          answer: 25,
          explain: '25. Notice: that’s 5 × 5. And 1 + 3 = 4 = 2 × 2, 1 + 3 + 5 = 9 = 3 × 3…',
        },
        {
          kind: 'read',
          title: 'Odd numbers build squares',
          body: 'Each odd number is an L-shaped layer that turns an n × n square into an (n + 1) × (n + 1) one. The layer adds n on top, n on the side and 1 in the corner: 2n + 1, the next odd number.',
          widget: () => stepper(7, (i) => oddLayers(i + 1, 7), { caption: (i) => `${Array.from({ length: i + 1 }, (_, k) => 2 * k + 1).join(' + ')} = ${(i + 1) ** 2} = ${i + 1}²` }),
        },
        {
          kind: 'number', tol: 0,
          body: 'What is the sum of the first **20** odd numbers?',
          answer: 400,
          hint: 'They make a square. How wide?',
          explain: 'The first 20 odd numbers stack into a 20 × 20 square: 400.',
        },
        {
          kind: 'fill',
          body: 'Complete the formula.',
          template: '1 + 3 + 5 + … + [[0]] = n²',
          blanks: [{ options: ['(2n − 1)', '(2n + 1)', 'n', '2n'], answer: 0 }],
          hint: 'For n = 3 the sum is 1 + 3 + 5. What is the last term in terms of n?',
          explain: 'The n-th odd number is 2n − 1 (for n = 3: 5). So 1 + 3 + … + (2n − 1) = n².',
        },
        {
          kind: 'point',
          body: 'The dots are (n, 1 + 3 + … + (2n − 1)) for n = 1, 2, 3. Place the dot for **n = 4**.',
          plot: { x: [0, 6], y: [0, 30], xlabel: 'n', ticks: [1, 5], size: [420, 300], layers: [{ type: 'dots', pts: [[1, 1], [2, 4], [3, 9]] }] },
          answer: { x: 4, y: 16 }, tol: 0.5, snap: 1,
          explain: '1 + 3 + 5 + 7 = 16 = 4²: the point (4, 16).',
        },
        {
          kind: 'read',
          title: 'Two staircases make a rectangle',
          body: 'Back to 1 + 2 + … + n. Draw it as a staircase. A second, upside-down copy fits on top to make an **n × (n + 1)** rectangle. So the staircase is half of it: n(n + 1) ÷ 2. Gauss’s trick, as a picture.',
          widget: () => h('div', null, staircase(5), h('div', { class: 'readout' }, '1 + 2 + 3 + 4 + 5 = half of 5 × 6 = 15')),
        },
        {
          kind: 'choice',
          body: 'Is **(a + b)² = a² + b²**?',
          widget: () => binomialSquare(3, 2),
          options: [
            { text: 'No: the two a × b rectangles are missing', correct: true },
            { text: 'Yes, squaring each part', why: 'The picture shows the (a + b) square has four pieces, not two. (3 + 2)² = 25 but 3² + 2² = 13.' },
            { text: 'Only when a = b', why: 'Then (2a)² = 4a², but a² + a² = 2a². It holds only when a or b is 0.' },
          ],
          hint: 'Count the pieces of the big square.',
          explain: 'A side of a + b splits the square into a², b² and two a × b rectangles: (a + b)² = a² + 2ab + b².',
        },
        {
          kind: 'task',
          title: 'Build (a + b)²',
          body: 'Make the picture show **7² = 9 + 24 + 16**: a 7 × 7 square whose top-left square is 3 × 3.',
          widget: explorer({
            params: [{ id: 'a', label: 'a', min: 1, max: 6, step: 1, value: 2 }, { id: 'b', label: 'b', min: 1, max: 6, step: 1, value: 2 }],
            draw: (v) => binomialSquare(v.a, v.b),
            readout: (v) => `(${v.a} + ${v.b})² = ${v.a * v.a} + ${2 * v.a * v.b} + ${v.b * v.b} = ${(v.a + v.b) ** 2}`,
            goal: (v) => v.a === 3 && v.b === 4,
            goalText: '(3 + 4)² = 9 + 2 × 12 + 16 = 49.',
          }),
          hint: 'a is the side of the top-left square.',
          explain: 'a = 3 and b = 4: 3² = 9, two 3 × 4 rectangles make 24, 4² = 16. Total 49 = 7².',
        },
        {
          kind: 'number', tol: 0,
          body: 'Cut a b × b square from the corner of an a × a square. The L-shape left can be cut and rearranged into an (a + b) × (a − b) rectangle. Use it: **51² − 49²** = ?',
          widget: () => plotEl({ x: [-0.2, 7.2], y: [-0.7, 5.3], equal: true, grid: false, size: [400, 260], layers: [
            { type: 'line', pts: [[0, 0], [5, 0], [5, 3], [3, 3], [3, 5], [0, 5]], closed: true, fill: 'color-mix(in srgb, var(--c1) 35%, transparent)', color: 'var(--c1)' },
            { type: 'line', pts: [[3, 3], [5, 3], [5, 5], [3, 5]], closed: true, dash: true, color: 'var(--muted)' },
            { type: 'text', x: 2.5, y: -0.5, text: 'a' }, { type: 'text', x: 4, y: 4.1, text: 'b²' }, { type: 'text', x: 1.5, y: 2.5, text: 'a² − b²' },
            { type: 'line', pts: [[5.6, 0], [7, 0], [7, 5], [5.6, 5]], closed: true, fill: 'color-mix(in srgb, var(--c2) 35%, transparent)', color: 'var(--c2)' },
            { type: 'text', x: 6.3, y: 2.5, text: '(a+b)(a−b)' }] }),
          answer: 200,
          hint: '(a + b)(a − b) with a = 51, b = 49.',
          explain: '(51 + 49)(51 − 49) = 100 × 2 = 200. No squaring needed.',
        },
        {
          kind: 'match',
          body: 'Match each picture to the fact it proves.',
          heads: ['Picture', 'Fact'],
          pairs: [
            ['Square built from L-shaped layers', '1 + 3 + … + (2n − 1) = n²'],
            ['Two staircases forming a rectangle', '1 + 2 + … + n = n(n + 1) ÷ 2'],
            ['Square cut into a², b² and two rectangles', '(a + b)² = a² + 2ab + b²'],
            ['Corner square removed, rest rearranged', 'a² − b² = (a + b)(a − b)'],
          ],
          explain: 'Each picture shows one quantity two ways, and the two ways must be equal. That’s the whole proof.',
        },
        {
          kind: 'read',
          title: 'One more beauty',
          body: 'Cubes add up to a square of a triangular number: **1³ + 2³ + … + n³ = (1 + 2 + … + n)²**. Check the table; there is a lovely picture proof too (each cube becomes an L-shaped layer of a square).',
          widget: () => dataTable(['n', '1³ + … + n³', '(1 + … + n)²'], [1, 2, 3, 4, 5, 6].map((n) => {
            let s = 0; for (let k = 1; k <= n; k++) s += k ** 3;
            return [n, s, `${tri(n)}² = ${tri(n) ** 2}`];
          })),
        },
        {
          kind: 'multi',
          body: 'Which of these sums are perfect squares? Select all.',
          options: [
            { text: '1 + 3 + 5 + 7', correct: true, why: '= 16 = 4².' },
            { text: '1 + 2 + 3 + 4', why: '= 10, not a square.' },
            { text: '1³ + 2³ + 3³', correct: true, why: '= 36 = (1 + 2 + 3)².' },
            { text: '2 + 4 + 6 + 8', why: '= 20 = 4 × 5: twice a triangular number, a rectangle not a square.' },
            { text: '(1 + 2 + … + 8) + (1 + 2 + … + 7)', correct: true, why: '36 + 28 = 64 = 8²: two neighbouring staircases fit into a square.' },
          ],
          hint: 'Use the pictures: odd layers, cubes, and two staircases.',
          explain: 'Odd numbers from 1 make squares, sums of cubes make squares, and two consecutive triangular numbers fit together into a square (8 × 8 here).',
        },
        {
          kind: 'estimate',
          body: 'Estimate **1 + 3 + 5 + … + 1999** (all the odd numbers below 2000).',
          min: 0, max: 2000000, step: 10000, answer: 1000000, tol: 50000, format: (v) => v.toLocaleString('en-US'),
          hint: 'How many odd numbers are there below 2000?',
          explain: 'There are 1000 odd numbers below 2000, and the first 1000 odd numbers make a 1000 × 1000 square: exactly 1,000,000.',
        },
      ],
      practice: [genOddSum, genDiffSquares, genFigPoint],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'primes',
      title: 'Divisibility & primes',
      goal: 'Test divisibility at a glance, sieve for primes, and see why they never run out.',
      steps: [
        {
          kind: 'choice', ordered: true,
          body: 'Is **123,456** divisible by 3? (No calculator.)',
          options: [
            { text: 'Yes', correct: true },
            { text: 'No', why: 'Add the digits: 1 + 2 + 3 + 4 + 5 + 6 = 21, a multiple of 3.' },
            { text: 'Can’t tell without dividing', why: 'There’s a shortcut: the digit sum tells you.' },
          ],
          hint: 'Add up the digits.',
          explain: 'The digit sum is 21, a multiple of 3, so 123,456 is too (it’s 3 × 41,152).',
        },
        {
          kind: 'read',
          title: 'Why digit sums work',
          body: '10 is one more than 9, 100 is one more than 99, and so on. So a number is a multiple of 9 **plus its digit sum**. That means a number and its digit sum leave the same remainder when you divide by 9, or by 3.',
          widget: () => dataTable(['4,527 =', ''], [['4 × 1000', '= 4 × 999 + 4'], ['5 × 100', '= 5 × 99 + 5'], ['2 × 10', '= 2 × 9 + 2'], ['7', '= 7'], ['total', '(multiple of 9) + 18']], { highlight: [4] }),
        },
        {
          kind: 'sort',
          body: 'Divisible by 9 or not?',
          bins: ['Divisible by 9', 'Not divisible by 9'],
          items: [
            { text: '729', bin: 0 },
            { text: '1,234', bin: 1 },
            { text: '8,181', bin: 0 },
            { text: '5,005', bin: 1 },
            { text: '99,999', bin: 0 },
            { text: '1,000,001', bin: 1 },
          ],
          hint: 'Digit sums: is each a multiple of 9?',
          explain: 'Digit sums: 729 → 18, 8,181 → 18, 99,999 → 45 (all multiples of 9). 1,234 → 10, 5,005 → 10, 1,000,001 → 2.',
        },
        {
          kind: 'match',
          body: 'Match each quick test to the divisor it checks.',
          heads: ['Test', 'Divisible by'],
          pairs: [
            ['last digit is even', '2'],
            ['digit sum is a multiple of 3', '3'],
            ['last two digits form a multiple of 4', '4'],
            ['last digit is 0 or 5', '5'],
            ['digit sum is a multiple of 9', '9'],
          ],
          explain: '100 is a multiple of 4, so only the last two digits matter for 4. 10 is a multiple of 2 and 5, so only the last digit matters. 3 and 9 use the digit sum.',
        },
        {
          kind: 'task',
          title: 'Spot the primes',
          body: 'A **prime** has exactly two divisors: 1 and itself. Tap **every** prime from 1 to 30.',
          widget: primeTapTask(30),
          hint: 'There are 10 of them. 1 is not prime.',
          explain: 'The primes up to 30: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29. Watch out for 1 (only one divisor), 9, 15, 21, 25 and 27.',
        },
        {
          kind: 'read',
          title: 'The sieve of Eratosthenes',
          body: 'A systematic way: keep 2 and cross out its multiples, then keep the next survivor, 3, and cross out its multiples, and so on. Up to 50 you can stop after 7, because 7² = 49 and the next prime squared, 11² = 121, is past 50.',
          widget: () => stepper(SIEVE.frames, SIEVE.render, { caption: SIEVE.caption }),
        },
        {
          kind: 'choice',
          body: 'To test whether **97** is prime, which divisors do you need to try? Notice how the factor pairs of its neighbour 96 behave.',
          widget: () => dataTable(['Factor pairs of 96', 'smaller', 'larger'], [[1, 96], [2, 48], [3, 32], [4, 24], [6, 16], [8, 12]].map(([a, b]) => [`${a} × ${b}`, a, b]), { caption: '√96 ≈ 9.8: the smaller factor never passes it' }),
          options: [
            { text: '2, 3, 5 and 7', correct: true },
            { text: 'Every number from 2 to 96', why: 'Overkill. If 97 = a × b, one of a, b is at most √97 ≈ 9.8, so you’d meet it early.' },
            { text: 'Every prime up to 48', why: 'Half of 97 is a safe bound but far too generous: √97 ≈ 9.8 is enough.' },
          ],
          hint: 'If 97 = a × b, can both a and b be bigger than 10?',
          explain: 'Factors come in pairs a × b with one of them at most √97 ≈ 9.8. So test the primes up to 9: 2, 3, 5, 7. None divides 97, so it’s prime.',
        },
        {
          kind: 'number', tol: 0,
          body: 'How many primes are there **below 50**?',
          widget: () => numberGrid(50, (k) => (isPrime(k) ? 'prime' : 'plain')),
          answer: 15,
          hint: 'Count the highlighted squares, row by row.',
          explain: '2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47: fifteen.',
        },
        {
          kind: 'estimate',
          body: 'The chart counts the primes in each block of 100 up to 500 (95 in all). Estimate how many primes there are **below 1000**.',
          widget: () => columnChart([0, 1, 2, 3, 4].map((b) => ({ label: `${b * 100 + 1}–${(b + 1) * 100}`, value: Array.from({ length: 100 }, (_, i) => b * 100 + 1 + i).filter(isPrime).length }))),
          min: 0, max: 500, step: 1, answer: Array.from({ length: 999 }, (_, i) => i + 1).filter(isPrime).length, tol: 30,
          hint: 'The blocks are thinning out slowly. About how many per block from 500 to 1000?',
          explain: 'There are 168 primes below 1000. Primes thin out, but slowly: roughly 14 to 16 per hundred between 500 and 1000.',
        },
        {
          kind: 'read',
          title: 'The primes never run out',
          body: 'Euclid’s argument. Suppose someone hands you a complete list of primes p₁, p₂, …, pₖ. Multiply them all and add 1:\n\n**N = p₁ × p₂ × … × pₖ + 1**\n\nDividing N by any prime on the list leaves remainder 1. But N, like every whole number above 1, has some prime factor. That prime isn’t on the list. So no list is complete.',
          widget: () => euclidTable(5),
        },
        {
          kind: 'fill',
          body: 'Fill in the heart of Euclid’s argument.',
          template: 'N = p₁·p₂·…·pₖ + 1 leaves remainder [[0]] when divided by each pᵢ, so N’s prime factors are [[1]] the list.',
          blanks: [
            { options: ['1', '0', 'pᵢ − 1'], answer: 0 },
            { options: ['not in', 'all in', 'the largest in'], answer: 0 },
          ],
          explain: 'Each pᵢ divides the product exactly, so the +1 leaves remainder 1. N’s prime factors therefore can’t be on the list.',
        },
        {
          kind: 'choice',
          body: '2 × 3 × 5 × 7 × 11 × 13 + 1 = **30,031**. Is it prime?',
          options: [
            { text: 'No: 30,031 = 59 × 509, but both are new primes', correct: true },
            { text: 'Yes: Euclid’s argument says it must be', why: 'Euclid only says N has a prime factor not on the list. N itself needn’t be prime.' },
            { text: 'No: it’s divisible by 13', why: 'Dividing by 13 (or any listed prime) leaves remainder 1: that’s the whole point of the +1.' },
          ],
          hint: 'What exactly does Euclid’s argument claim about N?',
          explain: '30,031 = 59 × 509. Neither 59 nor 509 was on the list {2, 3, 5, 7, 11, 13}: exactly what the argument promises.',
        },
        {
          kind: 'multi', ordered: true,
          body: 'Which are prime? Select all.',
          options: [
            { text: '1', why: '1 has only one divisor; primes need exactly two.' },
            { text: '51', why: '51 = 3 × 17 (digit sum 6).' },
            { text: '53', correct: true, why: 'Not divisible by 2, 3, 5 or 7.' },
            { text: '57', why: '57 = 3 × 19 (digit sum 12).' },
            { text: '59', correct: true, why: 'Not divisible by 2, 3, 5 or 7.' },
            { text: '91', why: '91 = 7 × 13.' },
          ],
          hint: 'Check 2, 3, 5, 7. Digit sums help with 3.',
          explain: '53 and 59 are prime. 51 and 57 hide a factor of 3; 91 = 7 × 13 fools many people.',
        },
      ],
      practice: [genDiv, genPrimeMulti, genSqrtBound],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'induction',
      title: 'Induction & recursion',
      goal: 'Solve a big problem through a smaller copy of itself, and prove it for every n.',
      steps: [
        {
          kind: 'task',
          title: 'Tower of Hanoi',
          body: 'Move the whole tower to peg **C**. Tap a peg to lift its top disk, then tap where it goes. One disk at a time, and never a bigger disk on a smaller one.',
          widget: hanoiTask(3),
          hint: 'The smallest disk has to get out of the way first. Where should it go so the middle disk can reach B?',
          explain: 'The fewest is 7 moves: smallest to C, middle to B, smallest to B, largest to C, smallest to A, middle to C, smallest to C.',
        },
        {
          kind: 'number', tol: 0,
          body: 'What is the fewest number of moves for **3** disks?',
          answer: 7,
          hint: 'To free the largest disk, the two above it must first go somewhere else.',
          explain: 'Move the top 2 aside (3 moves), the largest across (1), then the 2 back on top (3): 7.',
        },
        {
          kind: 'read',
          title: 'A smaller copy inside',
          body: 'To move n disks: move the top **n − 1** to the spare peg, move the biggest, then move the n − 1 back on top. So M(n) = 2·M(n − 1) + 1. Step through the 3-disk solution and spot the 2-disk solutions inside it.',
          widget: () => {
            const st = hanoiStates(3);
            return stepper(st.length, (i) => hanoiPic(st[i], 3), { caption: (i) => (i === 0 ? 'start' : i <= 3 ? `move ${i}: top two disks go to B` : i === 4 ? 'move 4: the largest disk goes to C' : `move ${i}: the two disks come back on top`) });
          },
        },
        {
          kind: 'fill',
          body: 'Write the rule for the fewest moves M(n).',
          template: 'M(n) = [[0]] · M(n − 1) + [[1]]',
          blanks: [
            { options: ['2', '1', 'n'], answer: 0 },
            { options: ['1', '0', 'n'], answer: 0 },
          ],
          explain: 'Two copies of the (n − 1)-disk job, plus 1 move for the biggest disk: M(n) = 2·M(n − 1) + 1.',
        },
        {
          kind: 'order',
          body: 'Put the plan for moving a **4**-disk tower from A to C in order.',
          items: ['Move the top 3 disks from A to B (using C)', 'Move the largest disk from A to C', 'Move the 3 disks from B to C (using A)'],
          explain: 'Clear the top 3 out of the way, move the big one, bring the 3 back on top. Each 3-disk move is itself the same plan one size smaller.',
        },
        {
          kind: 'point',
          body: 'The dots show M(n) for n = 1 to 4: 1, 3, 7, 15. Place the dot for **n = 5**.',
          plot: { x: [0, 6], y: [0, 40], xlabel: 'disks', ylabel: 'moves', ticks: [1, 5], size: [420, 300], layers: [{ type: 'dots', pts: [[1, 1], [2, 3], [3, 7], [4, 15]] }] },
          answer: { x: 5, y: 31 }, tol: 0.5, snap: 1,
          hint: 'Double and add one.',
          explain: 'M(5) = 2 × 15 + 1 = 31.',
        },
        {
          kind: 'read',
          title: 'The pattern: 2ⁿ − 1',
          body: 'Each M(n) is one less than a power of 2. Doubling and adding 1 keeps it that way: 2(2ⁿ − 1) + 1 = 2ⁿ⁺¹ − 1.',
          widget: () => dataTable(['n', '1', '2', '3', '4', '5'], [['M(n)', 1, 3, 7, 15, 31], ['2ⁿ', 2, 4, 8, 16, 32]]),
        },
        {
          kind: 'read',
          title: 'Induction is dominoes',
          body: 'How do you prove M(n) = 2ⁿ − 1 for **every** n? Like a line of dominoes:\n\n- **Base case**: the first domino falls (it’s true for n = 1).\n- **Inductive step**: whenever one falls, it knocks over the next (true for k ⇒ true for k + 1).\n\nThen they all fall.',
          widget: () => stepper(9, (i) => dominoRow(8, i), { caption: (i) => (i === 0 ? 'push the first one…' : i === 8 ? 'all fallen' : `${i} down`), autoplayMs: 350 }),
        },
        {
          kind: 'choice',
          body: 'Which of these proves M(n) = 2ⁿ − 1 for every n ≥ 1?',
          options: [
            { text: 'M(1) = 1 = 2¹ − 1, and if M(k) = 2ᵏ − 1 then M(k + 1) = 2(2ᵏ − 1) + 1 = 2ᵏ⁺¹ − 1', correct: true },
            { text: 'It works for n = 1 to 10, so it always works', why: 'That’s evidence, not proof. Without the step, the 11th domino might not fall.' },
            { text: 'If M(k) = 2ᵏ − 1 then M(k + 1) = 2ᵏ⁺¹ − 1', why: 'The step alone is not enough: something has to knock over the first domino.' },
          ],
          explain: 'Base case plus inductive step: the first domino falls, and each one knocks the next over.',
        },
        {
          kind: 'sort',
          body: 'An induction proof that 1 + 3 + … + (2n − 1) = n². Sort its parts.',
          bins: ['Base case', 'Inductive step'],
          items: [
            { text: 'Check n = 1: 1 = 1²', bin: 0 },
            { text: 'Suppose it holds for n = k', bin: 1 },
            { text: 'Add the next odd number, 2k + 1, to both sides', bin: 1 },
            { text: 'Notice k² + 2k + 1 = (k + 1)²', bin: 1 },
          ],
          explain: 'The base case is the one direct check. Everything that assumes "true for k" and reaches "true for k + 1" is the inductive step.',
        },
        {
          kind: 'choice',
          body: '“Proof” that all horses are the same colour: one horse is one colour. Given k + 1 horses, the first k are one colour and so are the last k; they overlap, so all k + 1 are. **Where does it break?**',
          widget: () => h('div', { style: 'text-align:center;font-size:1.8rem;letter-spacing:6px' }, '🐎🐎'),
          options: [
            { text: 'Going from 1 horse to 2: the two groups don’t overlap', correct: true },
            { text: 'The base case is false', why: 'One horse really is one colour. The base case is fine.' },
            { text: 'Induction doesn’t apply to horses', why: 'Induction works for anything indexed by whole numbers. The flaw is in one specific step.' },
          ],
          hint: 'Try the step with k = 1, so k + 1 = 2.',
          explain: 'With 2 horses, "the first 1" and "the last 1" share no horse, so nothing links their colours. One broken step (1 → 2) and the chain of dominoes stops.',
        },
        {
          kind: 'estimate',
          body: 'Legend says monks move a 64-disk tower, one move per second. M(64) = 2⁶⁴ − 1 moves. Roughly how long would it take, in **billions of years**?',
          min: 0, max: 1000, step: 5, answer: Math.round((2 ** 64 - 1) / (365.25 * 86400) / 1e9 / 5) * 5, tol: 60, format: (v) => `${v} billion years`,
          hint: '2⁶⁴ ≈ 1.8 × 10¹⁹ seconds, and a year is about 3.2 × 10⁷ seconds.',
          explain: '2⁶⁴ − 1 ≈ 1.84 × 10¹⁹ seconds ÷ 3.16 × 10⁷ seconds per year ≈ 585 billion years, about 40 times the age of the universe.',
        },
      ],
      practice: [genHanoi, genRecurrence, genStepFill],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'backwards',
      title: 'Working backwards & extremes',
      goal: 'Start from the goal, or from the biggest case, when the front door is locked.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: 'I think of a number, double it, add 6, then divide by 4. I get **5**. What was my number?',
          answer: 7,
          hint: 'Start at 5 and undo the steps, last one first.',
          explain: '5 × 4 = 20, 20 − 6 = 14, 14 ÷ 2 = 7.',
        },
        {
          kind: 'read',
          title: 'Undo, in reverse',
          body: 'When you know the end, walk back: undo the **last** step first, with its inverse. Doubling is undone by halving, adding 6 by subtracting 6.',
          widget: () => stepper(2, (i) => (i === 0 ? opChain([7, 14, 20, 5], ['× 2', '+ 6', '÷ 4']) : opChain([7, 14, 20, 5], ['÷ 2', '− 6', '× 4'], { back: true, hi: 0 })),
            { caption: (i) => (i === 0 ? 'forwards: what I did' : 'backwards: undo from the right') }),
        },
        {
          kind: 'order',
          body: 'To undo "double, add 6, divide by 4", put the undo steps in the order you do them.',
          items: ['Multiply by 4', 'Subtract 6', 'Divide by 2'],
          explain: 'The last thing done (÷ 4) is the first to undo (× 4), like taking off shoes before socks.',
        },
        {
          kind: 'choice', ordered: true,
          body: 'A patch of lilies doubles in area every day. It covers the whole pond on day 30. On what day did it cover **half** the pond?',
          widget: () => columnChart([25, 26, 27, 28, 29, 30].map((d) => ({ label: `day ${d}`, value: 100 / 2 ** (30 - d) })), { format: (v) => `${+v.toFixed(1)}%`, max: 100 }),
          options: [
            { text: 'Day 15', why: 'Halfway in time isn’t halfway in area. Growth that doubles daily is tiny for most of the month.' },
            { text: 'Day 28', why: 'Day 28 is a quarter: two halvings back from full.' },
            { text: 'Day 29', correct: true },
          ],
          hint: 'Go one day back from full.',
          explain: 'One day before full it was half: day 29. Working back from the end makes it obvious.',
        },
        {
          kind: 'task',
          title: 'Reach 100',
          body: 'Start at 1. Each move is **+1** or **×2**. Reach exactly **100** in as few moves as possible.',
          widget: reachTask(100),
          hint: 'Work backwards from 100: if even, it came from half of it (halving shrinks fastest); if odd, from one less.',
          explain: `Backwards from 100: 100 ← 50 ← 25 ← 24 ← 12 ← 6 ← 3 ← 2 ← 1. Read forwards, that’s ${fewestMoves(100)} moves: +1, +1, ×2, ×2, ×2, +1, ×2, ×2.`,
        },
        {
          kind: 'fill',
          body: 'Fill in the backward chain from 100.',
          template: '100 ← [[0]] ← 25 ← [[1]] ← 12',
          blanks: [
            { options: ['50', '99', '200'], answer: 0 },
            { options: ['24', '26', '12.5'], answer: 0 },
          ],
          hint: '×2 is undone by halving; +1 by subtracting 1.',
          explain: '100 is even, so it came from 50 (×2). 50 from 25 (×2). 25 is odd, so it came from 24 (+1). 24 from 12.',
        },
        {
          kind: 'point',
          body: 'Ana spent half her money, then $4 more. Then she spent half of what was left, then $4 more. She has $0. Place her **starting** amount.',
          plot: { x: [0, 40], xlabel: '$', ticks: [5], size: [420, 90] },
          answer: { x: 24 }, tol: 0.5, snap: 1,
          hint: 'Before the last "$4 more" she had $4. Before the half, $8. Keep going.',
          explain: 'Backwards: $0 → (+4) $4 → (×2) $8 → (+4) $12 → (×2) $24. Check: half of 24 is 12, minus 4 is 8; half of 8 is 4, minus 4 is 0.',
        },
        {
          kind: 'number', tol: 0,
          body: 'A snail at the bottom of a 10 m well climbs 3 m each day and slides back 2 m each night. On which day does it reach the top?',
          widget: () => {
            const pts: [number, number][] = [[0, 0]];
            let y = 0;
            for (let d = 1; d <= 8; d++) { y += 3; pts.push([d - 0.5, Math.min(y, 10)]); if (y >= 10) break; y -= 2; pts.push([d, y]); }
            return plotEl({ x: [0, 9], y: [0, 11], xlabel: 'day', ylabel: 'm', ticks: [1, 2], size: [400, 240], layers: [{ type: 'hline', y: 10, label: 'top', color: 'var(--c3)' }, { type: 'line', pts: pts.slice(0, 7) }] });
          },
          answer: 8,
          hint: 'Work back from the last day: it needs to start that day within 3 m of the top.',
          explain: 'On the last day it climbs 3 m without sliding back, so it must start that day at 7 m or higher. It gains 1 m per full day, so it’s at 7 m after day 7, and climbs out on day 8. (Not day 10: the final climb skips the slide.)',
        },
        {
          kind: 'read',
          title: 'The extreme principle',
          body: 'A cousin of working backwards: when stuck, look at the **biggest** or **smallest** thing. Why does every whole number above 1 have a prime factor? Take its **smallest** divisor bigger than 1. If that divisor had a smaller factor, that would divide the number too, and be smaller still. So the smallest divisor must be prime.',
        },
        {
          kind: 'choice',
          body: 'People sit round a table, each holding a number. Each person’s number is the **average** of their two neighbours’. What must be true?',
          widget: () => network([0, 1, 2, 3, 4, 5].map((k) => ({ id: 'ABCDEF'[k], x: 50 + 36 * Math.sin((k * Math.PI) / 3), y: 30 - 24 * Math.cos((k * Math.PI) / 3), label: '?' })),
            [0, 1, 2, 3, 4, 5].map((k) => ({ a: 'ABCDEF'[k], b: 'ABCDEF'[(k + 1) % 6] })), { hiNodes: ['A'], nodeText: { A: 'max' } }),
          options: [
            { text: 'All the numbers are equal', correct: true },
            { text: 'The numbers alternate high, low, high, …', why: 'A high number would then be above the average of its two lower neighbours, breaking the rule.' },
            { text: 'Nothing: it depends on the numbers', why: 'The rule forces a lot. Look at the largest number.' },
          ],
          hint: 'Look at the person with the largest number. Their neighbours average to it, and neither is bigger…',
          explain: 'Take the largest number M. Its two neighbours average to M and neither exceeds M, so both equal M. Repeat around the table: everyone holds M.',
        },
        {
          kind: 'multi', ordered: true,
          body: 'A game: players take turns counting up from 1, saying one, two or three numbers each turn. Whoever says **21** wins. Working backwards, which numbers do you want to end your turn on? Select all.',
          widget: () => cells(Array.from({ length: 21 }, (_, i) => i + 1), { index: false, hi: [20] }),
          options: [
            { text: '1', correct: true, why: '1 is in the chain 21 ← 17 ← 13 ← 9 ← 5 ← 1.' },
            { text: '5', correct: true, why: 'Four below 9.' },
            { text: '12', why: 'From 12 the opponent can say 13 and take over the winning chain.' },
            { text: '15', why: 'The opponent jumps to 17, then you can’t stop them reaching 21.' },
            { text: '17', correct: true, why: 'Whatever they add (1 to 3), you can reach 21.' },
          ],
          hint: 'If you end on 17, can the opponent stop you saying 21? Now what number guarantees you can end on 17?',
          explain: 'Ending on 17 wins: they reach 18–20, you reach 21. By the same logic 13, 9, 5 and 1 are winning: every turn you make the total jump by 4. So say "1" first and keep to 1, 5, 9, 13, 17.',
        },
      ],
      practice: [genReverse, genSpend, genLily],
    },
  ],
};
