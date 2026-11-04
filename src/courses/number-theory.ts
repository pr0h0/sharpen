// Number Theory: divisibility tests and why they work, unique factorisation and counting divisors,
// GCD/LCM and Euclid, clock arithmetic, powers and cycles (Fermat), whole-number equations (coins
// and nuggets), number bases, and check digits. Problem first; every number is computed from its rule.
import type { Choice, Course, Generator } from '../types';
import { gcd, h, pick, randInt } from '../ui';
import { dataTable } from '../viz/charts';
import { explorer, stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import { modPow } from '../widgets/crypto';
import { factor, isPrime, numberGrid } from '../widgets/math-thinking';
import {
  checkDigitTask, clockFace, digitCount, digitRow, divisors, dotRows, euclidStepper, euclidSteps, factorTree, heatTable, inBase,
  isbn13Check, isbnSum, largestUnpayable, lcm, luhnCheck, luhnTable, luhnValid, mod, order, payable, payGrid, placeColumns,
  placeTask, tileRect, unpayableTask,
} from '../widgets/number-theory';

const fmt = (n: number) => n.toLocaleString('en-US');
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) => String(n).split('').map((c) => SUP[Number(c)]).join('');
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const neg = (n: number) => String(n).replace('-', '−');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const digitsOf = (n: number) => String(n).split('').map(Number);

/** Prime factorisation as {prime: exponent}. */
function expo(n: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of factor(n)) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
}
/** "2³ × 3² × 5" */
const factStr = (n: number) => [...expo(n)].map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : String(p))).join(' × ');
const exponentOf = (n: number, p: number) => expo(n).get(p) ?? 0;

/** Alternating digit sum from the right: d₀ − d₁ + d₂ − … */
const altSum = (n: number) => digitsOf(n).reverse().reduce((s, d, i) => s + (i % 2 ? -d : d), 0);
const altStr = (n: number) => digitsOf(n).reverse().map((d, i) => (i === 0 ? String(d) : `${i % 2 ? '−' : '+'} ${d}`)).join(' ');

/** Smallest m with n × m a perfect square: the product of primes with an odd exponent. */
const squareMult = (n: number) => [...expo(n)].filter(([, e]) => e % 2).reduce((a, [p]) => a * p, 1);
/** Zeros at the end of n!: the number of factors 5 (2s are plentiful). */
const trailingZeros = (n: number) => { let z = 0; for (let q = 5; q <= n; q *= 5) z += Math.floor(n / q); return z; };

/** Last digits of b, b², b³, … until they repeat. */
function cycle10(b: number): number[] {
  const out: number[] = [];
  let x = b % 10;
  while (!out.includes(x)) { out.push(x); x = (x * b) % 10; }
  return out;
}

/** Non-negative whole solutions of a·x + b·y = c. */
function solutions(a: number, b: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = 0; a * x <= c; x++) if ((c - a * x) % b === 0) out.push([x, (c - a * x) / b]);
  return out;
}

function check(cond: boolean, what: string) { if (!cond) throw new Error(`number-theory: ${what}`); }

// ================================================================ 1. divisibility

const genLastDigits: Generator = (rng) => {
  const d = pick(rng, [4, 8, 25]);
  const k = d === 8 ? 3 : 2, P = 10 ** k;
  const yes = rng() < 0.5;
  let tail = randInt(rng, 1, P - 1);
  if (yes) tail = d * randInt(rng, 1, Math.floor((P - 1) / d));
  else while (tail % d === 0) tail = randInt(rng, 1, P - 1);
  const N = randInt(rng, 10, 9999) * P + tail;
  const tailS = String(tail).padStart(k, '0');
  const right = N % d === 0;
  const whyYes = `${tail} leaves remainder ${tail % d} when divided by ${d}, and so does ${fmt(N)}.`;
  const whyNo = `The last ${k} digits make ${tail} = ${d} × ${tail / d}, and the rest is a multiple of ${fmt(P)}, which ${d} divides.`;
  return {
    kind: 'choice',
    body: `Is **${fmt(N)}** divisible by **${d}**? No calculator.`,
    options: [
      right ? { text: 'Yes', correct: true } : { text: 'Yes', why: whyYes },
      right ? { text: 'No', why: whyNo } : { text: 'No', correct: true },
      { text: 'Can’t tell without dividing the whole number', why: `${fmt(P)} is a multiple of ${d}, so everything except the last ${k} digits is too. Only the last ${k} digits matter.` },
    ],
    hint: `${fmt(P)} = ${d} × ${P / d}. Which digits does that leave to check?`,
    explain: `${fmt(P)} is a multiple of ${d}, so only the last ${k} digits matter: ${tailS} → ${tail} ${right ? `= ${d} × ${tail / d}. Divisible.` : `leaves remainder ${tail % d}. Not divisible.`}`,
  };
};

const genEleven: Generator = (rng) => {
  const N = rng() < 0.4 ? 11 * randInt(rng, 100, 90909) : randInt(rng, 1000, 999999);
  const s = altSum(N);
  return {
    kind: 'number', tol: 0,
    body: `What is the remainder when **${fmt(N)}** is divided by **11**? Use the alternating digit sum.`,
    answer: N % 11,
    hint: 'From the right: add the last digit, subtract the next, add the next, … then take the remainder of that.',
    explain: `${altStr(N)} = ${neg(s)}, and ${neg(s)} leaves remainder ${mod(s, 11)} on division by 11${s < 0 ? ` (add 11s until it's between 0 and 10)` : ''}. Since 10 ≡ −1 (mod 11), ${fmt(N)} leaves the same remainder: ${N % 11}.`,
  };
};

const genMissingDigit: Generator = (rng) => {
  let ds: number[] = [], pos = 0, need = 0;
  do {
    const len = randInt(rng, 4, 6);
    ds = [randInt(rng, 1, 9), ...Array.from({ length: len - 1 }, () => randInt(rng, 0, 9))];
    pos = randInt(rng, 1, len - 1);
    need = mod(-(sum(ds) - ds[pos]), 9);
  } while (need === 0); // 0 and 9 would both work
  ds[pos] = need;
  const shown = ds.map((d, i) => (i === pos ? '?' : String(d))).join('');
  const rest = sum(ds) - need;
  return {
    kind: 'number', tol: 0,
    body: `The number **${shown}** is divisible by 9. Which digit is the **?**`,
    answer: need,
    hint: 'A number is divisible by 9 when its digit sum is.',
    explain: `The known digits add to ${rest}. The next multiple of 9 is ${rest + need}, so the missing digit is ${need}: ${ds.join('')} = 9 × ${fmt(Number(ds.join('')) / 9)}.`,
  };
};

// ================================================================ 2. factorisation

const genDivisorCount: Generator = (rng) => {
  let n = 1;
  do {
    n = 2 ** randInt(rng, 0, 5) * 3 ** randInt(rng, 0, 3) * 5 ** randInt(rng, 0, 2) * 7 ** randInt(rng, 0, 1);
  } while (n < 12 || n > 20000 || isPrime(n));
  const ex = [...expo(n)];
  const count = divisors(n).length;
  return {
    kind: 'number', tol: 0,
    body: `**${fmt(n)} = ${factStr(n)}**. How many divisors does it have (counting 1 and itself)?`,
    answer: count,
    hint: 'A divisor picks how many of each prime to use: from 0 up to its exponent.',
    explain: `Each exponent can be anything from 0 up to its value: ${ex.map(([p, e]) => `${e + 1} choice${e ? 's' : ''} for ${p}`).join(', ')}. ${ex.map(([, e]) => e + 1).join(' × ')} = ${count}.`,
  };
};

const genSquareMult: Generator = (rng) => {
  let n = 1;
  do { n = 2 ** randInt(rng, 0, 5) * 3 ** randInt(rng, 0, 3) * pick(rng, [1, 5, 7, 5, 25, 11]); } while (n < 20 || n > 5000 || squareMult(n) === 1);
  const m = squareMult(n);
  return {
    kind: 'number', tol: 0,
    body: `What is the smallest whole number you can multiply **${fmt(n)}** by to get a perfect square?`,
    answer: m,
    hint: `Factor ${fmt(n)}. A perfect square has every exponent even.`,
    explain: `${fmt(n)} = ${factStr(n)}. The odd exponents need one more copy each: × ${m} gives ${fmt(n * m)} = ${factStr(n * m)} = ${fmt(Math.round(Math.sqrt(n * m)))}².`,
  };
};

const genTrailingZeros: Generator = (rng) => {
  const n = randInt(rng, 10, 200);
  const z = trailingZeros(n);
  const parts: string[] = [];
  for (let q = 5; q <= n; q *= 5) parts.push(`${Math.floor(n / q)}`);
  return {
    kind: 'number', tol: 0,
    body: `How many zeros does **${n}!** (= 1 × 2 × 3 × … × ${n}) end in?`,
    answer: z,
    hint: 'Each final zero is a factor 10 = 2 × 5. There are far more 2s than 5s, so count the 5s.',
    explain: `Multiples of 5 up to ${n} give one 5 each${n >= 25 ? ', multiples of 25 an extra one' : ''}${n >= 125 ? ', multiples of 125 another' : ''}: ${parts.join(' + ')} = ${z}.`,
  };
};

// ================================================================ 3. gcd

const genGcd: Generator = (rng) => {
  let a = 0, b = 0;
  do {
    const g = randInt(rng, 2, 40);
    a = g * randInt(rng, 5, 40); b = g * randInt(rng, 3, 30);
  } while (a <= b || a > 1200 || euclidSteps(a, b).length < 3);
  const st = euclidSteps(a, b), g = gcd(a, b);
  return {
    kind: 'number', tol: 0,
    body: `Find **gcd(${a}, ${b})** with Euclid's algorithm.`,
    answer: g,
    hint: 'Divide the bigger by the smaller and keep the remainder; repeat with the smaller number and the remainder.',
    explain: `${st.map(([x, y, q, r]) => `${x} = ${q} × ${y} + ${r}`).join('; ')}. The last non-zero remainder is ${g}.`,
  };
};

const genLcmWord: Generator = (rng) => {
  let a = 0, b = 0;
  do { a = randInt(rng, 4, 30); b = randInt(rng, 4, 30); } while (a === b || a % b === 0 || b % a === 0 || gcd(a, b) === 1 && a * b > 200);
  const L = lcm(a, b);
  const thing = pick(rng, [['Two buses leave the depot', 'minutes'], ['Two lighthouses flash', 'seconds'], ['Two runners lap a track, one lap every', 'seconds']] as const);
  return {
    kind: 'number', tol: 0, unit: thing[1],
    body: thing[0].endsWith('every') ? `${thing[0]} ${a} ${thing[1]}, the other every ${b}. They start together. After how many ${thing[1]} are they together at the start line again?`
      : `${thing[0]} together; one repeats every ${a} ${thing[1]}, the other every ${b}. After how many ${thing[1]} do they next coincide?`,
    answer: L,
    hint: 'You want the first time that is a multiple of both.',
    explain: `lcm(${a}, ${b}) = ${a} × ${b} ÷ gcd(${a}, ${b}) = ${a * b} ÷ ${gcd(a, b)} = ${L}.`,
  };
};

const genTiles: Generator = (rng) => {
  let w = 0, hh = 0;
  do { const g = randInt(rng, 2, 25); w = g * randInt(rng, 2, 9); hh = g * randInt(rng, 2, 9); } while (w <= hh || gcd(w, hh) < 3);
  const g = gcd(w, hh), n = (w / g) * (hh / g);
  return {
    kind: 'number', tol: 0, unit: 'tiles',
    body: `A ${w} cm × ${hh} cm panel is covered with identical square tiles, as large as possible, with no cutting. How many tiles are needed?`,
    answer: n,
    hint: 'The largest tile side divides both lengths: that is the gcd.',
    explain: `The tile side is gcd(${w}, ${hh}) = ${g} cm. That makes ${w / g} × ${hh / g} = ${n} tiles.`,
  };
};

// ================================================================ 4. clock arithmetic

const genClock: Generator = (rng) => {
  const s = randInt(rng, 1, 12), add = randInt(rng, 20, 500);
  const end = mod(s + add - 1, 12) + 1;
  return {
    kind: 'number', tol: 0, unit: "o'clock",
    body: `It is ${s} o'clock. What will a 12-hour clock show **${add} hours** from now?`,
    answer: end,
    hint: `Full turns of 12 hours change nothing. What is ${add} mod 12?`,
    explain: `${add} = ${Math.floor(add / 12)} × 12 + ${add % 12}. The full turns change nothing, so move ${add % 12} hours on from ${s}: ${end} o'clock.`,
  };
};

const genWeekday: Generator = (rng) => {
  const d = randInt(rng, 0, 6), n = randInt(rng, 15, 400);
  const r = n % 7, ans = (d + r) % 7;
  const opts: Choice[] = [{ text: DAYS[ans], correct: true }];
  const used = new Set([ans]);
  const add = (k: number, why: string) => { if (!used.has(k)) { used.add(k); opts.push({ text: DAYS[k], why }); } };
  add((d + r + 6) % 7, `That's one day short. Counting today as day 1 is the usual slip: ${n} days on is ${r} past a whole number of weeks.`);
  add((d - r + 7) % 7, `That goes ${r} days backwards. The ${r} leftover days come after the whole weeks.`);
  add(d, `Only a whole number of weeks lands on ${DAYS[d]} again, and ${n} = ${Math.floor(n / 7)} × 7 + ${r}.`);
  add((d + (n % 10)) % 7, `${n % 10} is the last digit of ${n}, but weeks have 7 days, not 10: use the remainder on division by 7.`);
  return {
    kind: 'choice',
    body: `Today is **${DAYS[d]}**. What day of the week will it be in **${n} days**?`,
    options: opts.slice(0, 4),
    hint: `Whole weeks don't change the day. What is ${n} mod 7?`,
    explain: `${n} = ${Math.floor(n / 7)} × 7 + ${r}. ${r ? `Skip the whole weeks and count ${r} day${r === 1 ? '' : 's'} on from ${DAYS[d]}: ${DAYS[ans]}.` : `That's a whole number of weeks, so it's ${DAYS[d]} again.`}`,
  };
};

const genModProduct: Generator = (rng) => {
  const n = randInt(rng, 3, 12), a = randInt(rng, 100, 9999), b = randInt(rng, 100, 9999);
  const ra = a % n, rb = b % n, ans = (a * b) % n;
  return {
    kind: 'number', tol: 0,
    body: `What is the remainder when **${fmt(a)} × ${fmt(b)}** is divided by **${n}**? (Don't multiply them out.)`,
    answer: ans,
    hint: `Replace each number by its remainder mod ${n} first.`,
    explain: `${fmt(a)} ≡ ${ra} and ${fmt(b)} ≡ ${rb} (mod ${n}). So the product ≡ ${ra} × ${rb} = ${ra * rb} ≡ ${ans} (mod ${n}).`,
  };
};

// ================================================================ 5. powers

const genLastDigitPower: Generator = (rng) => {
  const b = pick(rng, [2, 3, 4, 7, 8, 9, 12, 13, 17, 18, 19]), e = randInt(rng, 20, 3000);
  const cyc = cycle10(b), L = cyc.length, k = e % L;
  const ans = modPow(b, e, 10);
  return {
    kind: 'number', tol: 0,
    body: `What is the **last digit** of **${b}${sup(e)}**?`,
    answer: ans,
    hint: `Only the last digit of ${b} matters. Write out the last digits of ${b}, ${b}², ${b}³, … until they repeat.`,
    explain: `Last digits of the powers of ${b} cycle ${cyc.join(', ')} (length ${L}). ${e} = ${Math.floor(e / L)} × ${L} + ${k}, so ${b}${sup(e)} ends like ${b}${sup(k || L)}: ${ans}.`,
  };
};

const genFermatMod: Generator = (rng) => {
  const p = pick(rng, [5, 7, 11, 13]), a = randInt(rng, 2, p - 1), e = randInt(rng, 20, 600);
  const r = e % (p - 1), ans = modPow(a, e, p);
  return {
    kind: 'number', tol: 0,
    body: `What is the remainder when **${a}${sup(e)}** is divided by **${p}**?`,
    answer: ans,
    hint: `${p} is prime, so ${a}${sup(p - 1)} ≡ 1 (mod ${p}). Strip off whole blocks of ${p - 1} from the exponent.`,
    explain: `Fermat: ${a}${sup(p - 1)} ≡ 1 (mod ${p}). ${e} = ${Math.floor(e / (p - 1))} × ${p - 1} + ${r}, so ${a}${sup(e)} ≡ ${a}${sup(r)} = ${fmt(a ** r)} ≡ ${ans} (mod ${p}).`,
  };
};

const genOrder: Generator = (rng) => {
  let a = 2, n = 5;
  do { n = randInt(rng, 5, 19); a = randInt(rng, 2, n - 1); } while (gcd(a, n) !== 1);
  const k = order(a, n);
  const seq = Array.from({ length: k }, (_, i) => modPow(a, i + 1, n));
  return {
    kind: 'number', tol: 0,
    body: `Take powers of **${a}** and keep only the remainder mod **${n}**: ${a}, ${a}², ${a}³, … How many steps until the remainder first comes back to **1**?`,
    answer: k,
    hint: 'Multiply the previous remainder by the base and reduce each time.',
    explain: `${seq.join(', ')}. The first 1 is at power ${k}.${isPrime(n) ? ` (${n} is prime, so the cycle length divides ${n - 1}, as Fermat promises.)` : ''}`,
  };
};

// ================================================================ 6. whole-number equations

const genFrobenius: Generator = (rng) => {
  let a = 3, b = 5;
  do { a = randInt(rng, 3, 9); b = randInt(rng, a + 1, 13); } while (gcd(a, b) !== 1);
  const F = largestUnpayable([a, b]);
  check(F === a * b - a - b, 'frobenius formula');
  return {
    kind: 'number', tol: 0, unit: '¢',
    body: `A machine takes only **${a}¢** and **${b}¢** coins, as many as you like, and gives no change. What is the **largest** price you can't pay exactly?`,
    answer: F,
    hint: `Arrange the amounts in columns of ${a}. Each column is all payable from its first multiple of ${b} on.`,
    explain: `For coprime coins a and b the largest impossible amount is a × b − a − b = ${a * b} − ${a} − ${b} = ${F}. Every amount from ${F + 1} on can be paid.`,
  };
};

const genSolvable: Generator = (rng) => {
  const g = pick(rng, [1, 2, 3, 4, 6]);
  let a = 2, b = 3;
  do { a = g * randInt(rng, 1, 7); b = g * randInt(rng, 1, 7); } while (a >= b || gcd(a, b) !== g || a < 2);
  const c = randInt(rng, 10, 99);
  const ok = c % g === 0;
  return {
    kind: 'choice',
    body: `Does **${a}x + ${b}y = ${c}** have a solution in whole numbers (negative allowed)?`,
    options: [
      ok ? { text: 'Yes', correct: true } : { text: 'Yes', why: `Any ${a}x + ${b}y is a multiple of ${g}, and ${c} isn't.` },
      ok ? { text: 'No', why: `gcd(${a}, ${b}) = ${g} divides ${c}, which is exactly the condition for a solution.` } : { text: 'No', correct: true },
    ],
    hint: `Every value of ${a}x + ${b}y is a multiple of gcd(${a}, ${b}).`,
    explain: `gcd(${a}, ${b}) = ${g}. Solutions exist exactly when ${g} divides ${c}: ${ok ? `it does (${c} = ${g} × ${c / g})` : `it doesn't (${c} leaves remainder ${c % g})`}.`,
  };
};

const genWays: Generator = (rng) => {
  let a = 3, b = 5, c = 40;
  do { a = randInt(rng, 2, 7); b = randInt(rng, a + 1, 12); c = randInt(rng, 25, 90); } while (solutions(a, b, c).length < 1);
  const sol = solutions(a, b, c);
  return {
    kind: 'number', tol: 0, unit: 'ways',
    body: `In how many ways can you pay exactly **${c}¢** using ${a}¢ and ${b}¢ coins? (Only the number of each coin matters.)`,
    answer: sol.length,
    hint: `Try each possible number of ${b}¢ coins and see if the rest is a multiple of ${a}.`,
    explain: `${sol.map(([x, y]) => `${x} × ${a}¢ + ${y} × ${b}¢`).join('; ')}. That's ${sol.length} way${sol.length === 1 ? '' : 's'}.`,
  };
};

// ================================================================ 7. bases

const genToDecimal: Generator = (rng) => {
  const b = pick(rng, [2, 2, 3, 5, 8, 16]);
  const n = randInt(rng, b === 2 ? 9 : 20, b === 2 ? 255 : 999);
  const ds = n.toString(b).toUpperCase().split('');
  const L = ds.length;
  return {
    kind: 'number', tol: 0,
    body: `What is **${inBase(n, b)}** (base ${b}) as an ordinary base-10 number?`,
    answer: n,
    hint: `The columns are worth ${Array.from({ length: L }, (_, i) => b ** (L - 1 - i)).join(', ')}.${b === 16 ? ' A = 10, B = 11, …, F = 15.' : ''}`,
    explain: `${ds.map((d, i) => `${parseInt(d, b)} × ${b ** (L - 1 - i)}`).join(' + ')} = ${n}.`,
  };
};

const genToBase: Generator = (rng) => {
  const b = pick(rng, [2, 3, 4, 5, 8]);
  const n = randInt(rng, b === 2 ? 9 : 20, b === 2 ? 127 : 600);
  const s = n.toString(b);
  const rems: string[] = [];
  for (let x = n; x > 0; x = Math.floor(x / b)) rems.push(`${x} = ${Math.floor(x / b)} × ${b} + ${x % b}`);
  return {
    kind: 'number', tol: 0,
    body: `Write **${n}** in base **${b}**. (Type the digits, e.g. 1021.)`,
    answer: Number(s),
    hint: `Divide by ${b} again and again; the remainders are the digits, last digit first.`,
    explain: `${rems.join('; ')}. Reading the remainders from the bottom up: ${inBase(n, b)}.`,
  };
};

const genBits: Generator = (rng) => {
  const b = pick(rng, [2, 2, 3, 8, 16]);
  const n = b === 2 ? randInt(rng, 20, 100000) : randInt(rng, 50, 1000000);
  const L = digitCount(n, b);
  return {
    kind: 'number', tol: 0, unit: 'digits',
    body: `How many digits does **${fmt(n)}** have when written in base **${b}**?`,
    answer: L,
    hint: `Find the largest power of ${b} that is no bigger than ${fmt(n)}.`,
    explain: `${b}${sup(L - 1)} = ${fmt(b ** (L - 1))} ≤ ${fmt(n)} < ${b}${sup(L)} = ${fmt(b ** L)}, so it needs ${L} digits: ${inBase(n, b)}.`,
  };
};

// ================================================================ 8. check digits

const genLuhnCheck: Generator = (rng) => {
  const d = Array.from({ length: randInt(rng, 6, 10) }, (_, i) => (i === 0 ? randInt(rng, 1, 9) : randInt(rng, 0, 9)));
  const c = luhnCheck(d);
  const dbl = d.map((v, i) => ((d.length - i) % 2 === 1 ? (2 * v > 9 ? 2 * v - 9 : 2 * v) : v));
  return {
    kind: 'number', tol: 0,
    body: `Luhn rule: starting from the check digit at the right end, double every second digit (subtract 9 if that's over 9); the total must end in 0. What check digit goes after **${d.join('')}**?`,
    answer: c,
    hint: 'The check digit itself is not doubled, so the digit just left of it is.',
    explain: `After doubling every second digit (starting next to the check digit): ${dbl.join(' + ')} = ${sum(dbl)}. Adding ${c} makes ${sum(dbl) + c}, which ends in 0.`,
  };
};

const genIsbn: Generator = (rng) => {
  const d = [9, 7, 8, ...Array.from({ length: 9 }, () => randInt(rng, 0, 9))];
  const c = isbn13Check(d), s = isbnSum(d);
  return {
    kind: 'number', tol: 0,
    body: `ISBN-13 rule: weights 1, 3, 1, 3, … from the left; the weighted total of all 13 digits must be a multiple of 10. The first 12 digits are **${d.join('')}**. What is the check digit?`,
    answer: c,
    hint: 'Multiply the digits by 1, 3, 1, 3, … and add; the check digit has weight 1.',
    explain: `Weighted total of the first 12: ${s}. Adding ${c} reaches ${s + c}, a multiple of 10.`,
  };
};

const genLuhnValid: Generator = (rng) => {
  const d = Array.from({ length: 10 }, (_, i) => (i === 0 ? randInt(rng, 1, 9) : randInt(rng, 0, 9)));
  const good = [...d, luhnCheck(d)];
  const kind = pick(rng, ['ok', 'digit', 'swap'] as const);
  let n = good.slice();
  if (kind === 'digit') { const i = randInt(rng, 0, 10); n[i] = (n[i] + randInt(rng, 1, 9)) % 10; if (i === 0 && n[0] === 0) n[0] = 1; }
  if (kind === 'swap') {
    const pairs = Array.from({ length: 10 }, (_, i) => i).filter((i) => n[i] !== n[i + 1] && !luhnValid([...n.slice(0, i), n[i + 1], n[i], ...n.slice(i + 2)]) && !(i === 0 && n[1] === 0));
    if (pairs.length) { const i = pick(rng, pairs); [n[i], n[i + 1]] = [n[i + 1], n[i]]; } else n = good;
  }
  const valid = luhnValid(n);
  const s = sum(n.map((v, i) => ((n.length - 1 - i) % 2 === 1 ? (2 * v > 9 ? 2 * v - 9 : 2 * v) : v)));
  return {
    kind: 'choice',
    body: `Does **${n.join('')}** pass the Luhn check? (From the right, double every second digit, subtract 9 from anything over 9, and add up.)`,
    options: [
      valid ? { text: 'Valid', correct: true } : { text: 'Valid', why: `The Luhn total is ${s}, which doesn't end in 0.` },
      valid ? { text: 'Invalid', why: `The Luhn total is ${s}, which ends in 0.` } : { text: 'Invalid', correct: true },
    ],
    hint: 'The rightmost digit is not doubled; the one next to it is.',
    explain: `Luhn total: ${s}. ${valid ? 'It ends in 0, so the number is valid.' : 'It doesn’t end in 0, so there is a typo somewhere.'}`,
  };
};

// ================================================================ fixed numbers used in the lessons (computed)

const TULIPS = 91;
const N4 = 7316;
const N8 = 5551234;
const N11 = 82918;
const SORT11 = [1331, 2728, 5555, 4321, 1234, 9090];
const MISS = [4, 0, 7, 2]; const MISS_POS = 1; const MISS_D = mod(-(sum(MISS) - MISS[MISS_POS]), 9);
check(MISS_D !== 0, 'missing digit unique');

const LOCKERS = 100;
function lockersOpen(n: number, passes = n): boolean[] {
  const open = Array(n + 1).fill(false) as boolean[];
  for (let k = 1; k <= passes; k++) for (let j = k; j <= n; j += k) open[j] = !open[j];
  return open;
}
const OPEN100 = lockersOpen(LOCKERS).filter(Boolean).length;
const SQ_FORMS: [number, number][][] = [[[2, 4], [3, 2]], [[2, 3], [5, 2]], [[3, 6]], [[2, 2], [3, 1], [7, 2]], [[5, 4], [7, 2]]];
const formText = (f: [number, number][]) => f.map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : String(p))).join(' × ');
const F30 = 30, DIG30 = Math.floor(sum(Array.from({ length: F30 }, (_, i) => Math.log10(i + 1)))) + 1;
// Even-land: evens that are not a product of two evens.
const evenPrime = (n: number) => n % 2 === 0 && !Array.from({ length: n }, (_, d) => d).some((d) => d >= 2 && d % 2 === 0 && n % d === 0 && (n / d) % 2 === 0);
check([2, 6, 10, 30].every(evenPrime) && 2 * 30 === 6 * 10, 'even-land');

const WALL: [number, number] = [60, 36];
const BUS: [number, number] = [12, 18];
const GL: [number, number] = [84, 120];
const EU: [number, number] = [252, 105];
const EU2: [number, number] = [391, 299];
const FIB: [number, number] = [89, 55];
const GEAR: [number, number] = [24, 36];
const COPRIME = [[8, 15], [14, 21], [9, 28], [12, 35], [26, 39]];

const START = 9, LATER = 100, CLOCK_END = mod(START + LATER - 1, 12) + 1;
const TODAY = 2, DAYS_ON = 100;
const P1 = 7384, P2 = 2967;
const M9: [number, number] = [1234, 5678];
const MULTI7 = [10, 21, 38, 45, 50, -4];
const SORT3 = [12, 25, 41, 100, 222, 1000];

const B3 = 3, E3 = 100;
const B7 = 7, E7 = 2026;
const SQ: [number, number, number] = [3, 13, 7];
const PSEUDO = 341;
const carmichael561 = Array.from({ length: 560 }, (_, i) => i + 1).every((a) => gcd(a, 561) !== 1 || modPow(a, 560, 561) === 1);
check(modPow(2, PSEUDO - 1, PSEUDO) === 1 && !isPrime(PSEUDO) && carmichael561 && !isPrime(561), 'pseudoprimes');
const LAST1 = [[3, 8], [7, 12], [9, 7], [11, 5], [2, 20], [13, 6]];

const COINS: [number, number] = [3, 5];
const NUGGETS = [6, 9, 20];
const LINE: [number, number, number] = [3, 5, 22];
const PT: [number, number, number] = [5, 7, 38];
check(solutions(...PT).length === 1, 'point puzzle unique');
const PT_SOL = solutions(...PT)[0];
const EQS: [number, number, number][] = [[6, 10, 14], [6, 9, 10], [4, 6, 7], [5, 7, 1], [12, 18, 30]];
const STAMPS: [number, number, number] = [7, 11, 100];
const STAMP_BEST = Math.min(...solutions(...STAMPS).map(([x, y]) => x + y));
const FOWLS = (() => { const out: number[][] = []; for (let r = 1; r <= 20; r++) for (let hn = 1; hn <= 33; hn++) { const c = 100 - r - hn; if (c > 0 && c % 3 === 0 && 5 * r + 3 * hn + c / 3 === 100) out.push([r, hn, c]); } return out; })();
const WAYS50 = solutions(3, 5, 50);

const LAMPS = '1011';
const BUILD = 50, BUILD_B = 3;
const OCT = 2024;
const MATCHB: [number, number][] = [[13, 2], [21, 3], [15, 4], [24, 5], [26, 16]];
const PAR3 = [14, 23, 40, 51, 66, 79];
const MILLION = 1000000;

const SIMPLE = [4, 7, 1, 9]; const SIMPLE_C = mod(-sum(SIMPLE), 10);
const CARD15 = [4, 5, 3, 9, 1, 4, 8, 8, 0, 3, 4, 3, 6, 4, 6];
const CARD = [...CARD15, luhnCheck(CARD15)];
const TASK11 = [3, 7, 1, 4, 4, 9, 6, 3, 5, 3, 9];
const LUHN_Q = [7, 9, 9, 2, 7, 3, 9, 8, 7, 1];
const LUHN_OPTS = (() => {
  const base = [6, 0, 1, 1, 0, 0, 0, 9, 9, 0, 1];
  const v1 = [...base, luhnCheck(base)];
  const b2 = [5, 1, 0, 5, 1, 0, 5, 1, 0, 5, 1];
  const v2 = [...b2, luhnCheck(b2)];
  const bad1 = v1.slice(); bad1[4] = (bad1[4] + 3) % 10;
  const bad2 = v2.slice(); [bad2[2], bad2[3]] = [bad2[3], bad2[2]];
  const v3b = [3, 7, 8, 2, 8, 2, 2, 4, 6, 3, 1]; const v3 = [...v3b, luhnCheck(v3b)];
  return [v1, bad1, v2, bad2, v3];
})();
const ISBN12 = [9, 7, 8, 0, 3, 0, 6, 4, 0, 6, 1, 5];
const ISBN_Q = [9, 7, 8, 1, 8, 6, 1, 9, 7, 2, 7, 1];
// A valid ISBN-13 with a 1 next to a 6 (swap undetected) and other neighbours (swaps caught).
const SWAP12 = [9, 7, 8, 0, 1, 6, 3, 2, 7, 4, 9, 2];
const SWAP = [...SWAP12, isbn13Check(SWAP12)];
const swapped = (d: number[], i: number) => { const e = d.slice(); [e[i], e[i + 1]] = [e[i + 1], e[i]]; return e; };
const swapCaught = (i: number) => isbnSum(swapped(SWAP, i)) % 10 !== 0;
check(!swapCaught(4) && swapCaught(6) && swapCaught(8) && swapCaught(1), 'isbn swap example');

// ================================================================ course

export const numberTheory: Course = {
  id: 'number-theory',
  title: 'Number Theory',
  blurb: 'Divisibility tricks, clock arithmetic, Euclid, Fermat, and the maths hiding in card numbers.',
  color: '#3a86a8',
  icon: '🔢',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'divisibility',
      title: 'Divisibility tricks',
      goal: 'Test for 4, 8, 11 and friends at a glance, and know why each test works.',
      steps: [
        {
          kind: 'task',
          body: `A gardener has **${TULIPS} tulips** and wants equal rows: more than one row, more than one tulip per row, none left over. Slide to find a row length that works.`,
          widget: explorer({
            params: [{ id: 'c', label: 'per row', min: 2, max: 15, step: 1, value: 4 }],
            draw: (v) => dotRows(TULIPS, v.c),
            readout: (v) => `${TULIPS} = ${Math.floor(TULIPS / v.c)} rows of ${v.c}` + (TULIPS % v.c ? ` + ${TULIPS % v.c} left over` : ', nothing left over'),
            goal: (v) => TULIPS % v.c === 0,
            goalText: `${TULIPS} = ${factor(TULIPS).join(' × ')}: it only looked prime.`,
          }),
          hint: 'It isn’t even, and its digit sum isn’t a multiple of 3. Try the next prime.',
          explain: `${TULIPS} = ${factor(TULIPS).join(' × ')}, so rows of ${factor(TULIPS)[0]} (or ${factor(TULIPS)[1]}) work. "a divides b" means b dots fit into rows of a exactly, with nothing left over.`,
        },
        {
          kind: 'read',
          title: 'Divides means "nothing left over"',
          body: `**a divides b** (written a | b) when b = a × k for a whole number k. Otherwise there's a remainder: b = q × a + r, with 0 < r < a. In the picture, the orange dots are the remainder.\n\nDividing is slow. The tricks below let you read the remainder straight off the digits, and each one has a reason you can see.`,
          widget: () => h('div', null, dotRows(23, 5), h('div', { class: 'readout' }, `23 = ${Math.floor(23 / 5)} × 5 + ${23 % 5}`)),
        },
        {
          kind: 'choice',
          body: `Is **${fmt(N4)}** divisible by 4? No calculator.`,
          options: [
            { text: 'Yes', correct: N4 % 4 === 0, why: N4 % 4 === 0 ? undefined : `${N4 % 100} isn't a multiple of 4.` },
            { text: `No: its digit sum ${sum(digitsOf(N4))} isn't a multiple of 4`, why: 'Digit sums only test 3 and 9, because 10 leaves remainder 1 on division by 9. Divided by 4, 10 leaves remainder 2, so the trick breaks.' },
            { text: 'No: multiples of 4 end in 0, 4 or 8', why: `Plenty end in 2 or 6: 16 = 4 × 4, 36 = 4 × 9, ${N4 % 100} = 4 × ${(N4 % 100) / 4}.` },
          ],
          hint: '100 is a multiple of 4. So which part of the number decides it?',
          explain: `${fmt(N4)} = ${Math.floor(N4 / 100)} × 100 + ${N4 % 100}. Every hundred is 4 × 25, so only the last two digits matter: ${N4 % 100} = 4 × ${(N4 % 100) / 4}. Divisible.`,
        },
        {
          kind: 'read',
          title: 'Why the last digits decide',
          body: 'Every test for 2, 4, 5, 8 or 25 comes from one fact: some power of ten is a multiple of the divisor. Then everything to the left of those last digits is a multiple too, and only the last few digits are left to check.',
          widget: () => dataTable(['Power of 10', 'Is a multiple of', 'So check'], [
            [`10 = 2 × 5`, '2 and 5', 'the last digit'],
            [`100 = 4 × 25`, '4 and 25', 'the last two digits'],
            [`1000 = 8 × 125`, '8 and 125', 'the last three digits'],
          ]),
        },
        {
          kind: 'number', tol: 0,
          body: `What is the remainder when **${fmt(N8)}** is divided by **8**?`,
          answer: N8 % 8,
          hint: '1000 = 8 × 125, so only the last three digits matter.',
          explain: `Only ${N8 % 1000} matters: ${N8 % 1000} = ${Math.floor((N8 % 1000) / 8)} × 8 + ${N8 % 8}. So the remainder is ${N8 % 8}.`,
        },
        {
          kind: 'read',
          title: 'Eleven: signs that alternate',
          body: 'For 9, the trick is that 10 is **one more** than 9. For 11, it is that 10 is **one less** than 11. So 10 counts as −1 when you divide by 11, 100 = 99 + 1 counts as +1, 1000 counts as −1, and so on.\n\nThat gives the test: from the right, **add, subtract, add, subtract** the digits. The number leaves the same remainder on division by 11 as that alternating sum.',
          widget: () => dataTable(['Power of 10', 'Remainder ÷ 9', 'Remainder ÷ 11'], [1, 10, 100, 1000, 10000].map((p) => [fmt(p), p % 9, `${p % 11}${p % 11 === 10 ? '  (= −1)' : ''}`])),
        },
        {
          kind: 'number', tol: 0,
          body: `Use the alternating sum to find the remainder when **${fmt(N11)}** is divided by 11.`,
          answer: N11 % 11,
          hint: `From the right: ${digitsOf(N11).reverse()[0]} − ${digitsOf(N11).reverse()[1]} + …`,
          explain: `${altStr(N11)} = ${neg(altSum(N11))}, which leaves remainder ${mod(altSum(N11), 11)}. So ${fmt(N11)} = 11 × ${fmt(Math.floor(N11 / 11))} + ${N11 % 11}.`,
        },
        {
          kind: 'sort',
          body: 'Divisible by 11 or not? Use the alternating sum.',
          bins: ['Divisible by 11', 'Not divisible'],
          items: SORT11.map((n) => ({ text: fmt(n), bin: n % 11 === 0 ? 0 : 1 })),
          hint: 'A multiple of 11 has an alternating sum of 0, ±11, ±22, …',
          explain: SORT11.map((n) => `${fmt(n)}: ${neg(altSum(n))}`).join('; ') + '. Those with 0 or a multiple of 11 are divisible.',
        },
        {
          kind: 'match',
          body: 'Each test comes from a fact about powers of ten. Match them.',
          heads: ['Fact', 'Test it gives'],
          pairs: [
            ['10 = 9 + 1', 'Digit sum tests 9'],
            ['10 = 11 − 1', 'Alternating sum tests 11'],
            ['100 = 4 × 25', 'Last two digits test 4'],
            ['1000 = 8 × 125', 'Last three digits test 8'],
            ['10 = 2 × 5', 'Last digit tests 5'],
          ],
          explain: '"One more than d" gives a plain digit sum, "one less than d" an alternating sum, and "a multiple of d" means only the last few digits matter.',
        },
        {
          kind: 'choice',
          body: 'A number is divisible by **2** and by **6**. Must it be divisible by 2 × 6 = **12**?',
          options: [
            { text: `No: ${lcm(2, 6)} itself is divisible by both`, correct: true },
            { text: 'Yes: divisible by two numbers means divisible by their product', why: `Only when they share no factor. 2 and 6 share a 2, so "divisible by 6" already includes "divisible by 2". ${lcm(2, 6) * 3} works too, and ${lcm(2, 6) * 3} = 12 + ${lcm(2, 6) * 3 - 12}.` },
            { text: 'Yes, as long as it’s even', why: `Being divisible by 6 already makes it even, and ${lcm(2, 6)} is even but not a multiple of 12.` },
          ],
          explain: `Divisible by both a and b means divisible by lcm(a, b), which is a × b only when a and b share no factor. lcm(2, 6) = ${lcm(2, 6)}. That's why the test for 12 is "by 3 and by 4" (no common factor), not "by 2 and by 6".`,
        },
        {
          kind: 'multi',
          body: 'Which facts **guarantee** a number is divisible by 24? Select all.',
          options: [
            { text: 'Divisible by 3 and by 8', correct: true, why: `3 and 8 share no factor, so lcm(3, 8) = ${lcm(3, 8)}.` },
            { text: 'Divisible by 3, by 4 and by 8', correct: true, why: 'The 3 and the 8 already do it; the 4 is extra.' },
            { text: 'Divisible by 4 and by 6', why: `lcm(4, 6) = ${lcm(4, 6)}: ${lcm(4, 6)} is divisible by both but not by 24.` },
            { text: 'Divisible by 2 and by 12', why: `lcm(2, 12) = ${lcm(2, 12)}: ${lcm(2, 12)} passes both and isn't a multiple of 24.` },
          ],
          hint: 'Divisible by a and b means divisible by lcm(a, b). Which pairs have lcm 24?',
          explain: `What counts is the lcm: lcm(3, 8) = ${lcm(3, 8)}, but lcm(4, 6) = ${lcm(4, 6)} and lcm(2, 12) = ${lcm(2, 12)}.`,
        },
        {
          kind: 'number', tol: 0,
          body: `**${MISS.map((d, i) => (i === MISS_POS ? '?' : d)).join('')}** is divisible by 9. Which digit is the **?**`,
          answer: MISS_D,
          hint: 'Its digit sum must be a multiple of 9.',
          explain: `The known digits add to ${sum(MISS) - MISS[MISS_POS]}; the next multiple of 9 is ${sum(MISS) - MISS[MISS_POS] + MISS_D}. So ? = ${MISS_D}, and ${MISS.map((d, i) => (i === MISS_POS ? MISS_D : d)).join('')} = 9 × ${Number(MISS.map((d, i) => (i === MISS_POS ? MISS_D : d)).join('')) / 9}.`,
        },
      ],
      practice: [genLastDigits, genEleven, genMissingDigit],
    },

    // ------------------------------------------------------------ 2
    {
      id: 'factorisation',
      title: 'Prime building blocks',
      goal: 'Use unique prime factorisation to count divisors, spot squares and count zeros.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: 'How many whole numbers divide **36** exactly (including 1 and 36)?',
          answer: divisors(36).length,
          hint: 'List them in pairs that multiply to 36: 1 × 36, 2 × 18, …',
          explain: `${divisors(36).filter((d) => d * d <= 36).map((d) => (d * d === 36 ? `${d} × ${d}` : `${d} × ${36 / d}`)).join(', ')}. That's ${divisors(36).length}: the pair 6 × 6 gives only one new divisor.`,
        },
        {
          kind: 'read',
          title: 'Different trees, same leaves',
          body: `Split 360 into any two factors, then split those, until only primes are left. Start with 12 × 30 or with 8 × 45: the trees look different, but the leaves are the same primes, ${factStr(360)}.\n\nThat's the **fundamental theorem of arithmetic**: every whole number above 1 is a product of primes in exactly one way (apart from order). Primes are the atoms; factorisation is the formula.`,
          widget: () => h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center' }, factorTree(360, [12, 30]), factorTree(360, [8, 45])),
        },
        {
          kind: 'fill',
          body: 'Write 360 in prime-power form.',
          template: '360 = 2^[[0]] × 3^[[1]] × 5^[[2]]',
          blanks: [2, 3, 5].map((p) => ({ options: ['1', '2', '3', '4'], answer: exponentOf(360, p) - 1 })),
          hint: 'Count how many times each prime appears among the leaves.',
          explain: `360 = ${factor(360).join(' × ')} = ${factStr(360)}.`,
        },
        {
          kind: 'read',
          title: 'Counting divisors without listing them',
          body: `Every divisor of 360 = ${factStr(360)} is built from the same primes, using **at most** as many of each: 2 can appear 0 to ${exponentOf(360, 2)} times (${exponentOf(360, 2) + 1} choices), 3 can appear 0 to ${exponentOf(360, 3)} times (${exponentOf(360, 3) + 1}), 5 can appear 0 or 1 times (2).\n\nSo 360 has ${exponentOf(360, 2) + 1} × ${exponentOf(360, 3) + 1} × 2 = **${divisors(360).length}** divisors. The table shows each one exactly once.`,
          widget: () => {
            const cols = [1, 3, 9, 5, 15, 45];
            return heatTable([1, 2, 4, 8].map(String), cols.map(String), (r, c) => 2 ** r * cols[c], 360, { corner: '×' });
          },
        },
        {
          kind: 'number', tol: 0,
          body: `How many divisors does **${fmt(144)} = ${factStr(144)}** have?`,
          answer: divisors(144).length,
          hint: 'Add one to each exponent and multiply.',
          explain: `(${exponentOf(144, 2)} + 1) × (${exponentOf(144, 3)} + 1) = ${divisors(144).length}.`,
        },
        {
          kind: 'choice',
          title: 'The locker puzzle',
          body: `A corridor has ${LOCKERS} closed lockers. Student 1 opens every locker. Student 2 toggles every 2nd one (closing it if open, opening it if closed), student 3 every 3rd, and so on up to student ${LOCKERS}. Which lockers end up **open**? The picture plays it for 30 lockers.`,
          widget: () => stepper(31, (i) => { const o = lockersOpen(30, i); return numberGrid(30, (k) => (o[k] ? 'prime' : 'plain'), 6); },
            { caption: (i) => (i === 0 ? 'All closed. Green = open.' : `After student ${i}: ${lockersOpen(30, i).filter(Boolean).length} open`), autoplayMs: 500 }),
          options: [
            { text: 'The perfect squares', correct: true },
            { text: 'The primes', why: 'A prime is touched by exactly two students (1 and itself): opened, then closed again.' },
            { text: 'The odd numbers', why: '3 is touched by students 1 and 3, so it ends closed; 4 is touched by 1, 2 and 4, so it ends open.' },
            { text: 'None of them', why: 'Locker 1 is only ever touched by student 1, so it stays open.' },
          ],
          hint: 'Locker n is touched once for every divisor of n. When is that number odd?',
          explain: 'Divisors come in pairs d × (n/d), so most numbers have an even count and their lockers end closed. Only a perfect square has a divisor paired with itself (6 × 6 = 36), giving an odd count: those stay open.',
        },
        {
          kind: 'number', tol: 0,
          body: `So how many of the ${LOCKERS} lockers are open at the end?`,
          answer: OPEN100,
          explain: `The squares up to ${LOCKERS}: 1, 4, 9, …, ${Math.floor(Math.sqrt(LOCKERS)) ** 2}. That's ${OPEN100}.`,
        },
        {
          kind: 'multi',
          body: 'Which of these are **perfect squares**? Select all.',
          options: SQ_FORMS.map((f) => {
            const odd = f.find(([, e]) => e % 2);
            return odd ? { text: formText(f), why: `The exponent of ${odd[0]} is ${odd[1]}, which is odd: you can't split it evenly between two equal halves.` }
              : { text: formText(f), correct: true, why: `Halve every exponent: it's (${formText(f.map(([p, e]) => [p, e / 2]))})².` };
          }),
          hint: 'A square is something × itself, so every prime appears an even number of times.',
          explain: 'A number is a perfect square exactly when every exponent in its prime factorisation is even. Unique factorisation is what makes this test reliable.',
        },
        {
          kind: 'number', tol: 0,
          body: 'What is the smallest whole number you can multiply **72** by to get a perfect square?',
          answer: squareMult(72),
          hint: `72 = ${factStr(72)}. Which exponent is odd?`,
          explain: `72 = ${factStr(72)}. The 2 has an odd exponent, so one more 2 fixes it: 72 × ${squareMult(72)} = ${72 * squareMult(72)} = ${Math.sqrt(72 * squareMult(72))}².`,
        },
        {
          kind: 'number', tol: 0,
          body: `${F30}! = 1 × 2 × 3 × … × ${F30} is a ${DIG30}-digit number. How many **zeros** does it end in?`,
          answer: trailingZeros(F30),
          hint: 'Each final zero is a factor 10 = 2 × 5. Which is scarcer, 2s or 5s?',
          explain: `There are plenty of 2s, so count the 5s: ${Math.floor(F30 / 5)} multiples of 5, and 25 adds an extra one: ${Math.floor(F30 / 5)} + ${Math.floor(F30 / 25)} = ${trailingZeros(F30)}.`,
        },
        {
          kind: 'read',
          title: 'A world where it fails',
          body: 'Unique factorisation can sound obvious. Here is a world where it is false. Pretend only **even** numbers exist, and call an even number *even-prime* if it isn\'t a product of two evens: 2, 6, 10, 14, 18, 30, …\n\nNow 60 = 2 × 30 = 6 × 10, and all four of 2, 30, 6, 10 are even-prime. Two different factorisations into "primes".',
        },
        {
          kind: 'choice',
          body: 'What does Even-land show?',
          options: [
            { text: 'Unique factorisation is a real theorem about whole numbers, not automatic', correct: true },
            { text: 'Factor trees for ordinary numbers can end at different primes', why: 'Not for the ordinary whole numbers: the theorem says every tree for 360 ends at 2, 2, 2, 3, 3, 5. Even-land breaks the rules because it lacks the odd numbers.' },
            { text: 'Even numbers have no prime factors', why: 'Every even number has the ordinary prime 2 as a factor. Even-land just redefines "prime" inside a smaller set of numbers.' },
          ],
          explain: 'Uniqueness depends on the numbers you allow. For the ordinary whole numbers it has a proof (resting on Euclid’s lemma: if a prime divides a × b, it divides a or b). In Even-land 30 divides 6 × 10 but neither 6 nor 10, and uniqueness collapses.',
        },
      ],
      practice: [genDivisorCount, genSquareMult, genTrailingZeros],
    },

    // ------------------------------------------------------------ 3
    {
      id: 'gcd',
      title: 'GCD, LCM and Euclid',
      goal: 'Find greatest common divisors fast with Euclid’s algorithm, and use LCMs for cycles.',
      steps: [
        {
          kind: 'task',
          body: `A ${WALL[0]} cm × ${WALL[1]} cm wall gets identical square tiles, with no cutting. Find the **largest** tile that fits exactly.`,
          widget: explorer({
            params: [{ id: 's', label: 'tile side', min: 1, max: WALL[1], step: 1, value: 5, format: (v) => `${v} cm` }],
            draw: (v) => tileRect(WALL[0], WALL[1], v.s),
            readout: (v) => {
              const a = WALL[0] % v.s, b = WALL[1] % v.s;
              return a || b ? `Red strip left over: ${a ? `${a} cm along ${WALL[0]}` : ''}${a && b ? ', ' : ''}${b ? `${b} cm along ${WALL[1]}` : ''}` : `Fits: ${WALL[0] / v.s} × ${WALL[1] / v.s} tiles`;
            },
            goal: (v) => v.s === gcd(...WALL),
            goalText: `${gcd(...WALL)} cm: the greatest common divisor of ${WALL[0]} and ${WALL[1]}.`,
          }),
          hint: 'The side has to divide both 60 and 36.',
          explain: `The tile side must divide both lengths. The common divisors of ${WALL[0]} and ${WALL[1]} are ${divisors(gcd(...WALL)).join(', ')}; the greatest is ${gcd(...WALL)}. Every common divisor divides the greatest one.`,
        },
        {
          kind: 'read',
          title: 'GCD and LCM from the factors',
          body: `Write both numbers as prime powers. The **gcd** (greatest common divisor) takes each prime to the **smaller** exponent; the **lcm** (least common multiple) takes the **larger**.\n\ngcd(${WALL[0]}, ${WALL[1]}) = ${factStr(gcd(...WALL))} = ${gcd(...WALL)}, and lcm(${WALL[0]}, ${WALL[1]}) = ${factStr(lcm(...WALL))} = ${lcm(...WALL)}.`,
          widget: () => dataTable(['Prime', String(WALL[0]), String(WALL[1]), 'gcd (min)', 'lcm (max)'], [2, 3, 5].map((p) => {
            const a = exponentOf(WALL[0], p), b = exponentOf(WALL[1], p);
            return [p, `${p}${sup(a)}`, `${p}${sup(b)}`, `${p}${sup(Math.min(a, b))}`, `${p}${sup(Math.max(a, b))}`];
          })),
        },
        {
          kind: 'number', tol: 0, unit: 'minutes',
          body: `Bus A leaves every ${BUS[0]} minutes and bus B every ${BUS[1]} minutes. Both leave at 9:00. How many minutes until they next leave together?`,
          answer: lcm(...BUS),
          hint: 'You want the smallest time that is a multiple of both.',
          explain: `Multiples of ${BUS[0]}: ${[1, 2, 3, 4].map((k) => k * BUS[0]).join(', ')}, … The first one that ${BUS[1]} also divides is ${lcm(...BUS)} = lcm(${BUS[0]}, ${BUS[1]}).`,
        },
        {
          kind: 'number', tol: 0,
          body: `gcd(${GL[0]}, ${GL[1]}) = ${gcd(...GL)}. Use the fact that **gcd × lcm = a × b** to find lcm(${GL[0]}, ${GL[1]}).`,
          answer: lcm(...GL),
          hint: `lcm = ${GL[0]} × ${GL[1]} ÷ ${gcd(...GL)}.`,
          explain: `${GL[0]} × ${GL[1]} = ${fmt(GL[0] * GL[1])}, and ÷ ${gcd(...GL)} gives ${lcm(...GL)}. It works because for each prime, min + max of the two exponents is just their sum.`,
        },
        {
          kind: 'read',
          title: 'Euclid: cut off squares',
          body: 'Factoring big numbers is hard. Euclid (c. 300 BC) found a way around it: anything that divides a and b also divides a − b, so **gcd(a, b) = gcd(b, a mod b)**. Keep replacing the bigger number by the remainder until it hits 0.\n\nAs a picture: from an a × b rectangle, cut off the biggest squares you can, again and again. The last square fits exactly, and its side is the gcd.',
          widget: () => euclidStepper(66, 24),
        },
        {
          kind: 'order',
          body: `Put Euclid's steps for **gcd(${EU[0]}, ${EU[1]})** in order.`,
          items: [...euclidSteps(...EU).map(([a, b, q, r]) => `${a} = ${q} × ${b} + ${r}`), `So gcd = ${gcd(...EU)}`],
          hint: 'Each line divides the previous divisor by the previous remainder.',
          explain: `Each step's divisor and remainder become the next step's pair, until the remainder is 0. The last non-zero remainder, ${gcd(...EU)}, is the gcd.`,
        },
        {
          kind: 'number', tol: 0,
          body: `Find **gcd(${EU2[0]}, ${EU2[1]})**. Neither has a factor below 10, so use Euclid.`,
          answer: gcd(...EU2),
          hint: `${EU2[0]} = 1 × ${EU2[1]} + ${EU2[0] % EU2[1]}. Now continue with ${EU2[1]} and ${EU2[0] % EU2[1]}.`,
          explain: `${euclidSteps(...EU2).map(([a, b, q, r]) => `${a} = ${q} × ${b} + ${r}`).join('; ')}. gcd = ${gcd(...EU2)} (${EU2[0]} = ${factStr(EU2[0])}, ${EU2[1]} = ${factStr(EU2[1])}).`,
        },
        {
          kind: 'number', tol: 0, unit: 'steps',
          body: `How many division steps does Euclid's algorithm take on **${FIB[0]} and ${FIB[1]}** (counting the last one, with remainder 0)?`,
          answer: euclidSteps(...FIB).length,
          hint: 'These are neighbouring Fibonacci numbers. Watch what the remainders are.',
          explain: `${euclidSteps(...FIB).map(([, , , r]) => r).join(', ')}: every remainder is the previous Fibonacci number, so it takes ${euclidSteps(...FIB).length} steps. Fibonacci pairs are Euclid's slowest case, and even so the step count only grows with the number of digits (about 5 steps per digit at worst).`,
        },
        {
          kind: 'number', tol: 0, unit: 'turns',
          body: `Two meshed gears have ${GEAR[0]} and ${GEAR[1]} teeth. A mark on each starts at the contact point. How many full turns does the **${GEAR[0]}-tooth** gear make before both marks meet again?`,
          answer: lcm(...GEAR) / GEAR[0],
          hint: 'The same number of teeth pass the contact point on both gears.',
          explain: `Both marks return when the teeth passed is a multiple of ${GEAR[0]} and of ${GEAR[1]}: lcm = ${lcm(...GEAR)} teeth. That's ${lcm(...GEAR) / GEAR[0]} turns of the small gear (and ${lcm(...GEAR) / GEAR[1]} of the big one).`,
        },
        {
          kind: 'multi',
          body: 'Which pairs are **coprime** (gcd 1)? Select all.',
          options: COPRIME.map(([a, b]) => (gcd(a, b) === 1
            ? { text: `${a} and ${b}`, correct: true, why: `${a} = ${factStr(a)} and ${b} = ${factStr(b)} share no prime.` }
            : { text: `${a} and ${b}`, why: `Both are divisible by ${gcd(a, b)}.` })),
          hint: 'Coprime numbers share no prime factor, even if neither is prime.',
          explain: `${COPRIME.map(([a, b]) => `gcd(${a}, ${b}) = ${gcd(a, b)}`).join('; ')}. Being coprime is about the pair, not about either number being prime.`,
        },
        {
          kind: 'choice',
          body: 'Suppose gcd(a, b) = 1 and a divides b × c. What must be true?',
          options: [
            { text: 'a divides c', correct: true },
            { text: 'a divides b', why: 'a and b share no factor, so a can only divide b if a = 1.' },
            { text: 'Nothing more can be said', why: `Try it: gcd(4, 9) = 1 and 4 divides 9 × 8 = 72; sure enough 4 divides 8. a has to find all its factors in c.` },
          ],
          hint: 'a shares no prime with b. So where do the primes of a come from?',
          explain: `Every prime of a must come from b or c, and none comes from b, so a divides c. The coprime condition matters: 6 divides 4 × 3 = 12 but not 3, because gcd(6, 4) = ${gcd(6, 4)}. This is Euclid's lemma, the key to unique factorisation.`,
        },
      ],
      practice: [genGcd, genLcmWord, genTiles],
    },

    // ------------------------------------------------------------ 4
    {
      id: 'clock',
      title: 'Clock arithmetic',
      goal: 'Compute with remainders: times, weekdays, last digits.',
      steps: [
        {
          kind: 'choice',
          body: `It's ${START} o'clock. What will a 12-hour clock show **${LATER} hours** from now?`,
          options: [
            { text: `${CLOCK_END} o'clock`, correct: true },
            { text: `${LATER % 12} o'clock`, why: `${LATER} = ${Math.floor(LATER / 12)} × 12 + ${LATER % 12} is right, but that's ${LATER % 12} hours on from 12, not from ${START}.` },
            { text: `${START} o'clock`, why: `Only a multiple of 12 hours brings the hand back to ${START}, and ${LATER} leaves ${LATER % 12} over.` },
          ],
          hint: 'Every 12 hours the hand is back where it started.',
          explain: `${LATER} = ${Math.floor(LATER / 12)} × 12 + ${LATER % 12}. The ${Math.floor(LATER / 12)} full turns change nothing; ${LATER % 12} hours on from ${START} is ${CLOCK_END} o'clock.`,
        },
        {
          kind: 'read',
          title: 'Only the remainder matters',
          body: `On a clock, numbers wrap around. Mathematicians write **a mod n** for the remainder when a is divided by n, and **a ≡ b (mod n)** ("a is congruent to b") when a and b leave the same remainder: they land on the same spot of an n-hour clock.\n\n${START} + ${LATER} = ${START + LATER} ≡ ${(START + LATER) % 12} (mod 12). Slide below: a and every a ± n land in the same place.`,
          widget: explorer({
            params: [
              { id: 'a', label: 'a', min: 0, max: 60, step: 1, value: START + LATER - 60 },
              { id: 'n', label: 'clock size n', min: 2, max: 12, step: 1, value: 12 },
            ],
            draw: (v) => clockFace(v.n, { hand: v.a % v.n }),
            readout: (v) => `${v.a} = ${Math.floor(v.a / v.n)} × ${v.n} + ${v.a % v.n}, so ${v.a} ≡ ${v.a % v.n} (mod ${v.n})`,
          }),
        },
        {
          kind: 'choice',
          body: `Today is **${DAYS[TODAY]}**. What day of the week will it be in **${DAYS_ON} days**?`,
          options: [
            { text: DAYS[(TODAY + DAYS_ON) % 7], correct: true },
            { text: DAYS[(TODAY + DAYS_ON + 6) % 7], why: `One short: that counts today as day 1. ${DAYS_ON} days on is ${DAYS_ON % 7} past a whole number of weeks.` },
            { text: DAYS[TODAY], why: `${DAYS_ON} isn't a whole number of weeks: ${DAYS_ON} = ${Math.floor(DAYS_ON / 7)} × 7 + ${DAYS_ON % 7}.` },
            { text: DAYS[(TODAY - DAYS_ON % 7 + 7) % 7], why: `That counts ${DAYS_ON % 7} days backwards; the leftover days come after the whole weeks.` },
          ],
          hint: 'A week is a 7-hour clock.',
          explain: `${DAYS_ON} = ${Math.floor(DAYS_ON / 7)} × 7 + ${DAYS_ON % 7}. ${Math.floor(DAYS_ON / 7)} whole weeks later it's ${DAYS[TODAY]} again; ${DAYS_ON % 7} more days makes it ${DAYS[(TODAY + DAYS_ON) % 7]}.`,
        },
        {
          kind: 'number', tol: 0,
          body: `What is the **last digit** of ${fmt(P1)} × ${fmt(P2)}?`,
          answer: (P1 * P2) % 10,
          hint: 'The last digit of a product depends only on the last digits.',
          explain: `Last digits ${P1 % 10} × ${P2 % 10} = ${(P1 % 10) * (P2 % 10)}, which ends in ${(P1 * P2) % 10}. The last digit is the number mod 10, and everything else is a multiple of 10 that can't affect it.`,
        },
        {
          kind: 'read',
          title: 'Reduce first, then compute',
          body: 'Adding and multiplying **respect remainders**: (a + b) mod n and (a × b) mod n depend only on a mod n and b mod n. So you can swap any number for its remainder before you start, and the numbers never get big.\n\nThe table is multiplication mod 10: the last digit of a × b. It is all you need for the last digit of any product.',
          widget: () => heatTable(Array.from({ length: 10 }, (_, i) => String(i)), Array.from({ length: 10 }, (_, i) => String(i)), (r, c) => (r * c) % 10, 10, { corner: '×' }),
        },
        {
          kind: 'number', tol: 0,
          body: `What is the remainder when **${fmt(M9[0])} × ${fmt(M9[1])}** is divided by **9**?`,
          answer: (M9[0] * M9[1]) % 9,
          hint: 'A number leaves the same remainder mod 9 as its digit sum.',
          explain: `${fmt(M9[0])}: digit sum ${sum(digitsOf(M9[0]))} ≡ ${M9[0] % 9}. ${fmt(M9[1])}: digit sum ${sum(digitsOf(M9[1]))} ≡ ${M9[1] % 9}. So the product ≡ ${M9[0] % 9} × ${M9[1] % 9} = ${(M9[0] % 9) * (M9[1] % 9)} ≡ ${(M9[0] * M9[1]) % 9}. (Old bookkeepers used this to check multiplication: "casting out nines".)`,
        },
        {
          kind: 'multi',
          body: 'Which of these are **≡ 3 (mod 7)**? Select all.',
          options: MULTI7.map((n) => (mod(n, 7) === 3
            ? { text: String(n).replace('-', '−'), correct: true, why: n < 0 ? `${String(n).replace('-', '−')} + 7 = ${n + 7}: same spot on the 7-clock.` : `${n} = ${Math.floor(n / 7)} × 7 + 3.` }
            : { text: String(n).replace('-', '−'), why: `${n} leaves remainder ${mod(n, 7)}.` })),
          hint: 'Negative numbers count too: add 7 until it’s positive.',
          explain: `Remainders: ${MULTI7.map((n) => `${String(n).replace('-', '−')} → ${mod(n, 7)}`).join(', ')}. Going backwards round the clock, −4 lands where 3 does.`,
        },
        {
          kind: 'sort',
          body: 'Sort by remainder when divided by 3.',
          bins: ['Remainder 0', 'Remainder 1', 'Remainder 2'],
          items: SORT3.map((n) => ({ text: fmt(n), bin: n % 3 })),
          hint: 'Digit sums work for 3 too.',
          explain: SORT3.map((n) => `${fmt(n)}: digit sum ${sum(digitsOf(n))} → ${n % 3}`).join('; ') + '.',
        },
        {
          kind: 'choice',
          body: 'New Year’s Day falls on a **Monday** in a year that is **not** a leap year. What day is the next New Year’s Day?',
          options: [
            { text: DAYS[365 % 7], correct: true },
            { text: 'Monday', why: `365 isn't a whole number of weeks: 365 = ${Math.floor(365 / 7)} × 7 + ${365 % 7}.` },
            { text: DAYS[366 % 7], why: `That's for a leap year: 366 = ${Math.floor(366 / 7)} × 7 + ${366 % 7}.` },
          ],
          hint: 'What is 365 mod 7?',
          explain: `365 = ${Math.floor(365 / 7)} × 7 + ${365 % 7}, so each ordinary year moves dates on by ${365 % 7} weekday (a leap year by ${366 % 7}). That's why your birthday drifts through the week.`,
        },
        {
          kind: 'fill',
          body: 'Work mod 5, reducing first.',
          template: '47 ≡ [[0]] (mod 5), so 47 × 47 ≡ [[1]] (mod 5), and 47 + 38 ≡ [[2]] (mod 5).',
          blanks: [
            { options: ['0', '1', '2', '3', '4'], answer: 47 % 5 },
            { options: ['0', '1', '2', '3', '4'], answer: (47 * 47) % 5 },
            { options: ['0', '1', '2', '3', '4'], answer: (47 + 38) % 5 },
          ],
          hint: '38 ≡ 3 (mod 5).',
          explain: `47 ≡ ${47 % 5}; ${47 % 5} × ${47 % 5} = ${(47 % 5) ** 2} ≡ ${(47 * 47) % 5}; ${47 % 5} + ${38 % 5} = ${(47 % 5) + (38 % 5)} ≡ ${(47 + 38) % 5}. Check: 47 × 47 = ${47 * 47} and 47 + 38 = ${47 + 38}.`,
        },
      ],
      practice: [genClock, genWeekday, genModProduct],
    },

    // ------------------------------------------------------------ 5
    {
      id: 'powers',
      title: 'Powers and cycles',
      goal: 'Find last digits and remainders of huge powers using cycles and Fermat’s little theorem.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: `What is the **last digit** of **${B3}${sup(E3)}**? (It has ${Math.floor(E3 * Math.log10(B3)) + 1} digits, so don't try to write it out.)`,
          answer: modPow(B3, E3, 10),
          hint: `Write the last digits of ${B3}, ${B3}², ${B3}³, ${B3}⁴, ${B3}⁵, … and look for a repeat.`,
          explain: `Last digits go ${cycle10(B3).join(', ')}, ${cycle10(B3)[0]}, … a cycle of ${cycle10(B3).length}. ${E3} = ${E3 / cycle10(B3).length} × ${cycle10(B3).length}, a whole number of cycles, so the last digit is ${modPow(B3, E3, 10)}.`,
        },
        {
          kind: 'read',
          title: 'Last digits go round a clock',
          body: `The last digit of the next power depends only on the last digit of this one (it's arithmetic mod 10). There are only 10 possible digits, so sooner or later one repeats, and from then on the sequence loops forever.\n\nFor ${B3} the loop is ${cycle10(B3).join(' → ')} → ${cycle10(B3)[0]}, with length ${cycle10(B3).length}. To find ${B3}${sup(E3)}, you only need ${E3} mod ${cycle10(B3).length}.`,
          widget: () => clockFace(10, { path: [...cycle10(B3), cycle10(B3)[0]] }),
        },
        {
          kind: 'match',
          body: 'Match each base to the cycle of last digits of its powers.',
          heads: ['Base', 'Last digits cycle'],
          pairs: [2, 3, 4, 7, 9].map((b) => [String(b), cycle10(b).join(', ')] as [string, string]),
          hint: 'Multiply the last digit by the base, keep the last digit, repeat.',
          explain: `${[2, 3, 4, 7, 9].map((b) => `${b}: ${cycle10(b).join(', ')}`).join('; ')}. Every cycle length is 1, 2 or 4, so working mod 4 on the exponent always does the job.`,
        },
        {
          kind: 'number', tol: 0,
          body: `What is the last digit of **${B7}${sup(E7)}**?`,
          answer: modPow(B7, E7, 10),
          hint: `The cycle for ${B7} is ${cycle10(B7).join(', ')}.`,
          explain: `${E7} = ${Math.floor(E7 / 4)} × 4 + ${E7 % 4}, so ${B7}${sup(E7)} ends like ${B7}${sup(E7 % 4 || 4)}: ${modPow(B7, E7, 10)}.`,
        },
        {
          kind: 'read',
          title: 'Fast powers: square, square, square',
          body: `Multiplying ${SQ[0]} by itself ${SQ[1] - 1} times works, but squaring is faster: ${SQ[0]}, ${SQ[0]}², ${SQ[0]}⁴, ${SQ[0]}⁸, … each is the square of the last. Then write the exponent as a sum of powers of two, ${SQ[1]} = ${SQ[1].toString(2).split('').map((b, i, a) => (b === '1' ? 2 ** (a.length - 1 - i) : 0)).filter(Boolean).join(' + ')}, and multiply those pieces. Reducing mod ${SQ[2]} at every step keeps the numbers tiny.\n\n${SQ[0]}${sup(SQ[1])} ≡ ${SQ[1].toString(2).split('').map((b, i, a) => (b === '1' ? modPow(SQ[0], 2 ** (a.length - 1 - i), SQ[2]) : -1)).filter((x) => x >= 0).join(' × ')} ≡ **${modPow(...SQ)}** (mod ${SQ[2]}). Computers use exactly this to raise numbers to powers with hundreds of digits (it's how RSA encryption is fast).`,
          widget: () => dataTable(['Power', `Value mod ${SQ[2]}`], [1, 2, 4, 8].map((e) => [`${SQ[0]}${sup(e)}`, `${modPow(SQ[0], e, SQ[2])}${SQ[1] & e ? '  ← used' : ''}`])),
        },
        {
          kind: 'number', tol: 0, unit: 'squarings',
          body: 'Starting from x, how many squarings does it take to reach **x⁶⁴**?',
          answer: Math.log2(64),
          hint: 'x → x² → x⁴ → …',
          explain: `Each squaring doubles the exponent: 1, 2, 4, 8, 16, 32, 64. That's ${Math.log2(64)} squarings instead of 63 multiplications. For an exponent with 300 digits, about 1,000 squarings instead of more steps than there are atoms in the universe.`,
        },
        {
          kind: 'fill',
          body: 'To compute x²¹ by squaring, split the exponent into powers of two.',
          template: '21 = [[0]] + [[1]] + [[2]]',
          blanks: [16, 4, 1].map((p) => ({ options: ['1', '2', '4', '8', '16'], answer: ['1', '2', '4', '8', '16'].indexOf(String(p)) })),
          hint: `21 in binary is ${(21).toString(2)}.`,
          explain: `21 = 16 + 4 + 1 (binary ${(21).toString(2)}), so x²¹ = x¹⁶ × x⁴ × x. The binary digits of the exponent say which squares to use.`,
        },
        {
          kind: 'read',
          title: 'Fermat’s little theorem',
          body: 'Mod a **prime** p, something special happens. The table shows a^k mod 7. Look at the column k = 6: every entry is 1.\n\n**Fermat’s little theorem**: if p is prime and p doesn’t divide a, then a^(p−1) ≡ 1 (mod p). The reason: multiplying the remainders 1, 2, …, p−1 by a just shuffles them (no two can collide, because p is prime), so the product of all of them gets multiplied by a^(p−1) and yet stays the same. Since that product isn’t a multiple of p, a^(p−1) must be ≡ 1.',
          widget: () => heatTable([1, 2, 3, 4, 5, 6].map((a) => `a=${a}`), [1, 2, 3, 4, 5, 6].map((k) => `k=${k}`), (r, c) => modPow(r + 1, c + 1, 7), 7, { mark: (v) => v === 1 }),
        },
        {
          kind: 'number', tol: 0,
          body: `What is the remainder when **${B3}${sup(E3)}** is divided by **7**?`,
          answer: modPow(B3, E3, 7),
          hint: `${B3}⁶ ≡ 1 (mod 7). What is ${E3} mod 6?`,
          explain: `${E3} = ${Math.floor(E3 / 6)} × 6 + ${E3 % 6}, so ${B3}${sup(E3)} ≡ ${B3}${sup(E3 % 6)} = ${B3 ** (E3 % 6)} ≡ ${modPow(B3, E3, 7)} (mod 7).`,
        },
        {
          kind: 'choice',
          body: `Fermat says: if n is prime, then 2^(n−1) ≡ 1 (mod n). It turns out 2${sup(PSEUDO - 1)} ≡ ${modPow(2, PSEUDO - 1, PSEUDO)} (mod ${PSEUDO}). Is ${PSEUDO} prime?`,
          options: [
            { text: `No: ${PSEUDO} = ${factor(PSEUDO).join(' × ')}`, correct: true },
            { text: 'Yes: it passes Fermat’s test', why: 'Fermat says primes pass. It doesn’t say only primes pass: that would be the converse, and it’s false.' },
            { text: 'Can’t tell from this', why: `You can: just try small factors. ${PSEUDO} = ${factor(PSEUDO).join(' × ')}.` },
          ],
          explain: `${PSEUDO} is a composite that fools base 2 (a "pseudoprime"). Trying base 3 catches it: 3${sup(PSEUDO - 1)} ≡ ${modPow(3, PSEUDO - 1, PSEUDO)} (mod ${PSEUDO}), not 1. But some composites, like 561 = ${factor(561).join(' × ')}, fool every base coprime to them. Fermat's test is a fast filter; real primality tests add extra checks.`,
        },
        {
          kind: 'multi',
          body: 'Which of these powers end in the digit **1**? Select all.',
          options: LAST1.map(([b, e]) => (modPow(b, e, 10) === 1
            ? { text: `${b}${sup(e)}`, correct: true, why: `${b}'s last digits cycle ${cycle10(b).join(', ')}, and ${e} lands on the 1.` }
            : { text: `${b}${sup(e)}`, why: `It ends in ${modPow(b, e, 10)}: ${b}'s cycle is ${cycle10(b).join(', ')}.` })),
          hint: 'Use the cycles: 3 and 7 have length 4, 9 has length 2, 11 always ends in 1, 2 never ends in 1.',
          explain: LAST1.map(([b, e]) => `${b}${sup(e)} ends in ${modPow(b, e, 10)}`).join('; ') + '.',
        },
        {
          kind: 'number', tol: 0, unit: 'steps',
          body: 'Powers of 2 mod 11: 2, 4, 8, 5, … After how many steps does the remainder first return to **1**?',
          answer: order(2, 11),
          hint: 'Keep doubling and reducing mod 11.',
          explain: `${Array.from({ length: order(2, 11) }, (_, i) => modPow(2, i + 1, 11)).join(', ')}: back to 1 at step ${order(2, 11)}, the most Fermat allows (p − 1 = 10). The cycle length always divides p − 1.`,
        },
      ],
      practice: [genLastDigitPower, genFermatMod, genOrder],
    },

    // ------------------------------------------------------------ 6
    {
      id: 'diophantine',
      title: 'Whole-number equations',
      goal: 'Decide when ax + by = c has whole-number answers, and solve coin and nugget puzzles.',
      steps: [
        {
          kind: 'task',
          body: `A vending machine takes only **${COINS[0]}¢** and **${COINS[1]}¢** coins, as many as you like, and gives no change. Mark every price from 1¢ to 20¢ that you **can't** pay exactly.`,
          widget: unpayableTask(COINS[0], COINS[1], 20),
          hint: `Every multiple of ${COINS[0]} works; so does ${COINS[1]} plus a multiple of ${COINS[0]}, and ${2 * COINS[1]} plus a multiple of ${COINS[0]}.`,
          explain: `Impossible: ${Array.from({ length: 20 }, (_, i) => i + 1).filter((k) => !payable(COINS, 20)[k]).join(', ')}. From ${largestUnpayable(COINS) + 1} on, everything works.`,
        },
        {
          kind: 'read',
          title: 'Why big amounts always work',
          body: `Arrange the amounts in columns of ${COINS[0]}. Going down a column adds a ${COINS[0]}¢ coin, so once a column contains a payable amount, everything below it is payable too. Each column starts at a multiple of ${COINS[1]}: ${Array.from({ length: COINS[0] }, (_, k) => k * COINS[1]).map((v) => (v ? String(v) : '0 (no ${COINS[1]}¢ coins)')).join(', ')}. They land in different columns because ${COINS[0]} and ${COINS[1]} are coprime.\n\nThe last column starts at (${COINS[0]} − 1) × ${COINS[1]} = ${(COINS[0] - 1) * COINS[1]}, so the last gap is just above it: ${(COINS[0] - 1) * COINS[1]} − ${COINS[0]} = ${largestUnpayable(COINS)}. In general, for coprime coins a and b, the largest impossible amount is (a − 1)b − a = **a × b − a − b**.`,
          widget: () => payGrid(COINS, 30, COINS[0]),
        },
        {
          kind: 'number', tol: 0, unit: 'nuggets',
          body: `Chicken nuggets used to come in boxes of ${NUGGETS.join(', ')}. What is the **largest** number of nuggets you **couldn't** buy exactly?`,
          answer: largestUnpayable(NUGGETS),
          hint: `With three box sizes there's no simple formula. Work in columns of ${NUGGETS[0]}: when does each remainder mod ${NUGGETS[0]} first become possible?`,
          explain: (() => {
            const first = [0, 1, 2, 3, 4, 5].map((r) => { const ok = payable(NUGGETS, 200); let k = r || 6; while (!ok[k]) k += 6; return k; });
            return `Mod 6, boxes of 6 and 9 only reach remainders 0 and 3; you need 20s for the rest. First amount reachable in each remainder class: ${first.map((k, r) => `${r} → ${k}`).join(', ')}. The latest start is ${Math.max(...first)}, so the largest impossible amount is ${Math.max(...first)} − 6 = ${largestUnpayable(NUGGETS)}.`;
          })(),
        },
        {
          kind: 'choice',
          body: 'A shop sells nuggets only in boxes of **6** and **9**. Can you buy every large enough amount?',
          options: [
            { text: `No: you can only ever get multiples of ${gcd(6, 9)}`, correct: true },
            { text: 'Yes: past some point every amount works', why: `That needs coprime box sizes. 6 and 9 are both multiples of ${gcd(6, 9)}, so any total is too: 100 is never possible.` },
            { text: 'Yes, from 6 × 9 − 6 − 9 = 39 on', why: `That formula is for coprime sizes only. gcd(6, 9) = ${gcd(6, 9)}, and 40 isn't a multiple of 3.` },
          ],
          explain: `Every total 6x + 9y is a multiple of gcd(6, 9) = ${gcd(6, 9)}. That's why the real boxes added a 20: gcd(6, 9, 20) = ${gcd(gcd(6, 9), 20)}.`,
        },
        {
          kind: 'read',
          title: 'When is ax + by = c solvable?',
          body: `Allow negative numbers too (paying and getting change). Then **ax + by = c has whole-number solutions exactly when gcd(a, b) divides c**. Necessary, since gcd(a, b) divides every ax + by; and Euclid's algorithm, run backwards, always finds x and y with ax + by = gcd(a, b).\n\nThe dots are the whole-number solutions of ${LINE[0]}x + ${LINE[1]}y = ${LINE[2]}. They are evenly spaced: step ${LINE[1]} right and ${LINE[0]} down to get the next one.`,
          widget: () => {
            const [a, b, c] = LINE;
            const pts: [number, number][] = [];
            for (let x = -4; x <= 11; x++) if ((c - a * x) % b === 0) pts.push([x, (c - a * x) / b]);
            return plotEl({ x: [-5, 13], y: [-3, 8], equal: true, ticks: [2, 2], size: [440, 320], xlabel: 'x', ylabel: 'y',
              layers: [{ type: 'fn', f: (x) => (c - a * x) / b, color: 'var(--c1)' }, { type: 'dots', pts, color: 'var(--c2)', labels: pts.map(([x, y]) => `(${x}, ${y})`) }] });
          },
        },
        {
          kind: 'multi',
          body: 'Which equations have whole-number solutions (negatives allowed)? Select all.',
          options: EQS.map(([a, b, c]) => {
            const g = gcd(a, b);
            return c % g === 0 ? { text: `${a}x + ${b}y = ${c}`, correct: true, why: `gcd(${a}, ${b}) = ${g} divides ${c}.` }
              : { text: `${a}x + ${b}y = ${c}`, why: `Left side is always a multiple of ${g}; ${c} isn't.` };
          }),
          hint: 'Find gcd(a, b) and check whether it divides c.',
          explain: EQS.map(([a, b, c]) => `gcd(${a}, ${b}) = ${gcd(a, b)} ${c % gcd(a, b) ? 'doesn’t divide' : 'divides'} ${c}`).join('; ') + '.',
        },
        {
          kind: 'point',
          body: `Place the only point with whole numbers x ≥ 0 and y ≥ 0 on the line **${PT[0]}x + ${PT[1]}y = ${PT[2]}**.`,
          plot: { x: [0, 8], y: [0, 6], equal: true, ticks: [1, 1], xlabel: 'x', ylabel: 'y', layers: [{ type: 'fn', f: (x) => (PT[2] - PT[0] * x) / PT[1], color: 'var(--c1)' }] },
          answer: { x: PT_SOL[0], y: PT_SOL[1] }, tol: 0.4, snap: 1,
          hint: `Try y = 0, 1, 2, …: when is ${PT[2]} − ${PT[1]}y a multiple of ${PT[0]}?`,
          explain: `${PT[0]} × ${PT_SOL[0]} + ${PT[1]} × ${PT_SOL[1]} = ${PT[2]}. The next solutions are ${PT[1]} steps along in x, which takes y below 0, so this is the only one in the corner.`,
        },
        {
          kind: 'fill',
          body: `One solution of ${LINE[0]}x + ${LINE[1]}y = ${LINE[2]} is x = ${solutions(...LINE)[0][0]}, y = ${solutions(...LINE)[0][1]}. Complete the formula for **all** whole-number solutions (t any whole number).`,
          template: `x = ${solutions(...LINE)[0][0]} + [[0]]t,   y = ${solutions(...LINE)[0][1]} − [[1]]t`,
          blanks: [
            { options: [String(LINE[0]), String(LINE[1]), String(LINE[2])], answer: 1 },
            { options: [String(LINE[0]), String(LINE[1]), String(LINE[2])], answer: 0 },
          ],
          hint: `Adding to x raises ${LINE[0]}x; y must fall to compensate exactly.`,
          explain: `${LINE[0]}(x + ${LINE[1]}t) + ${LINE[1]}(y − ${LINE[0]}t) = ${LINE[0]}x + ${LINE[1]}y + ${LINE[0] * LINE[1]}t − ${LINE[0] * LINE[1]}t: the changes cancel. Because ${LINE[0]} and ${LINE[1]} are coprime, these are all the solutions.`,
        },
        {
          kind: 'number', tol: 0, unit: 'stamps',
          body: `You have ${STAMPS[0]}¢ and ${STAMPS[1]}¢ stamps and need **exactly ${STAMPS[2]}¢** of postage. How many stamps do you use in total?`,
          answer: STAMP_BEST,
          hint: `Try 0, 1, 2, … ${STAMPS[1]}¢ stamps: when is the rest a multiple of ${STAMPS[0]}?`,
          explain: `${solutions(...STAMPS).map(([x, y]) => `${x} × ${STAMPS[0]}¢ + ${y} × ${STAMPS[1]}¢ = ${STAMPS[2]}¢`).join('; ')}: ${STAMP_BEST} stamps.`,
        },
        {
          kind: 'number', tol: 0, unit: 'ways',
          title: 'The hundred fowls (China, 5th century)',
          body: 'A rooster costs 5 coins, a hen 3 coins, and 3 chicks cost 1 coin. You buy **100 birds for exactly 100 coins**, with at least one of each. How many different ways are there?',
          answer: FOWLS.length,
          hint: 'Two equations: r + h + c = 100 and 5r + 3h + c/3 = 100. Eliminate c: 7r + 4h = 100.',
          explain: `Subtracting the equations (after × 3) gives 7r + 4h = 100, so r must be a multiple of 4. The solutions: ${FOWLS.map(([r, hn, c]) => `${r} roosters, ${hn} hens, ${c} chicks`).join('; ')}.`,
        },
        {
          kind: 'number', tol: 0, unit: 'ways',
          body: 'In how many ways can you pay exactly **50¢** with 3¢ and 5¢ coins?',
          answer: WAYS50.length,
          hint: 'Solutions step along by 5 threes for every 3 fives. Find one, then step.',
          explain: `${WAYS50.map(([x, y]) => `${x} × 3¢ + ${y} × 5¢`).join('; ')}: ${WAYS50.length} ways, each 5 threes swapped for 3 fives.`,
        },
      ],
      practice: [genFrobenius, genSolvable, genWays],
    },

    // ------------------------------------------------------------ 7
    {
      id: 'bases',
      title: 'Number bases',
      goal: 'Read and write numbers in any base, and see which divisibility tricks each base gets.',
      steps: [
        {
          kind: 'number', tol: 0,
          body: `A row of four lamps reads **on, off, on, on**. The lamps are worth 8, 4, 2 and 1. Read it as a binary number: what number is it?`,
          answer: parseInt(LAMPS, 2),
          hint: 'Add up the values of the lamps that are on.',
          explain: `${LAMPS.split('').map((b, i) => `${b} × ${2 ** (3 - i)}`).join(' + ')} = ${parseInt(LAMPS, 2)}. Binary is place value with 2 in place of 10.`,
        },
        {
          kind: 'read',
          title: 'Place value in any base',
          body: 'In base 10, the columns are worth 1, 10, 100, … and each digit runs from 0 to 9. In base b, the columns are worth 1, b, b², … and each digit runs from 0 to b − 1. Base 16 (hexadecimal) borrows letters: A = 10, …, F = 15.\n\nSlide both: the same number, dressed in different bases.',
          widget: explorer({
            params: [
              { id: 'n', label: 'number', min: 0, max: 255, step: 1, value: 45 },
              { id: 'b', label: 'base', min: 2, max: 16, step: 1, value: 2 },
            ],
            draw: (v) => placeColumns(v.n, v.b),
            readout: (v) => { const s = v.n.toString(v.b).toUpperCase(); return `${v.n} = ${s.split('').map((d, i) => `${parseInt(d, 16)}×${v.b ** (s.length - 1 - i)}`).join(' + ')}`; },
          }),
        },
        {
          kind: 'task',
          body: `Build **${BUILD}** in base ${BUILD_B}. Each digit can be 0, 1 or 2.`,
          widget: placeTask(BUILD, BUILD_B, 4),
          hint: `Start with the biggest column: how many ${BUILD_B ** 3}s fit in ${BUILD}?`,
          explain: `${BUILD} = ${BUILD.toString(BUILD_B).split('').map((d, i, a) => `${d} × ${BUILD_B ** (a.length - 1 - i)}`).join(' + ')}, so ${BUILD} = ${inBase(BUILD, BUILD_B)}. Fill the biggest column first, then carry on with what's left.`,
        },
        {
          kind: 'number', tol: 0,
          body: `Write **${OCT}** in base 8 (type the digits).`,
          answer: Number(OCT.toString(8)),
          hint: 'Divide by 8 repeatedly; the remainders are the digits from right to left.',
          explain: (() => { const r: string[] = []; for (let x = OCT; x > 0; x = Math.floor(x / 8)) r.push(`${x} = ${Math.floor(x / 8)} × 8 + ${x % 8}`); return `${r.join('; ')}. Bottom-up: ${inBase(OCT, 8)}.`; })(),
        },
        {
          kind: 'match',
          body: 'Match each number to its base-10 value.',
          heads: ['Written in base b', 'Base 10'],
          pairs: MATCHB.map(([n, b]) => [inBase(n, b), String(n)] as [string, string]),
          hint: 'The small number is the base. 1A₁₆ means 1 × 16 + 10.',
          explain: MATCHB.map(([n, b]) => `${inBase(n, b)} = ${n.toString(b).toUpperCase().split('').map((d, i, a) => `${parseInt(d, 16)}×${b ** (a.length - 1 - i)}`).join(' + ')} = ${n}`).join('; ') + '.',
        },
        {
          kind: 'choice',
          body: 'In base 10, digit sums test divisibility by 9, because 10 = 9 + 1. In **base 16**, digit sums test divisibility by…',
          options: [
            { text: '15 (and so by 3 and 5)', correct: true },
            { text: '9', why: '9 works in base 10 only because 10 = 9 + 1. In base 16 the column values are 16, 256, …, which are 1 more than multiples of 15.' },
            { text: '17', why: '16 = 17 − 1, so 17 gets the alternating sum test, like 11 in base 10.' },
            { text: '16', why: 'Divisibility by the base itself is a last-digit test: a hex number is a multiple of 16 when it ends in 0.' },
          ],
          explain: `16 ≡ 1 (mod 15), so every column value 16ᵏ ≡ 1, and a hex number ≡ its digit sum (mod 15). Example: FF₁₆ = ${0xff} = 15 × ${0xff / 15}, and its digit sum is 15 + 15 = 30.`,
        },
        {
          kind: 'number', tol: 0, unit: 'zeros',
          body: 'A binary number is divisible by **8** exactly when it ends in how many zeros (at least)?',
          answer: Math.log2(8),
          hint: 'In base 10, a multiple of 1000 ends in three zeros.',
          explain: `8 = 2³ is a column value in binary, just as 1000 is in base 10. So a multiple of 8 ends in ${Math.log2(8)} zeros: ${(40).toString(2)} = 40 = 8 × 5.`,
        },
        {
          kind: 'sort',
          body: 'These are written in **base 3**. Sort them into even and odd, without converting.',
          bins: ['Even', 'Odd'],
          items: PAR3.map((n) => ({ text: inBase(n, 3), bin: n % 2 })),
          hint: 'In base 3 every column value (1, 3, 9, …) is odd. So what decides parity?',
          explain: `Every power of 3 is odd, so the number is even exactly when its **digit sum** is even. The last digit doesn't decide it (it does in even bases). ${PAR3.map((n) => `${inBase(n, 3)} = ${n}`).join(', ')}.`,
        },
        {
          kind: 'number', tol: 0, unit: 'binary digits',
          body: 'One hex digit is exactly 4 binary digits, because 16 = 2⁴. How many binary digits does the hex number **FFF** take?',
          answer: (0xfff).toString(2).length,
          hint: 'Each F is 1111.',
          explain: `FFF₁₆ = ${(0xfff).toString(2)}₂ = ${fmt(0xfff)}: ${(0xfff).toString(2).length} binary digits. That's why programmers like hex: it's a compact way to write bits.`,
        },
        {
          kind: 'choice',
          body: 'In base 5, what does writing an extra **0** on the right of a number do?',
          options: [
            { text: 'Multiplies it by 5', correct: true },
            { text: 'Multiplies it by 10', why: `"10" in base 5 means five. 12₅ = 7 becomes 120₅ = ${parseInt('120', 5)} = 7 × 5.` },
            { text: 'Nothing: a zero adds no value', why: 'A trailing zero shifts every digit into the next column up, each worth 5 times more.' },
          ],
          explain: `Every digit moves up one column, and each column is worth 5 times the one before. 12₅ = ${parseInt('12', 5)}, 120₅ = ${parseInt('120', 5)}.`,
        },
        {
          kind: 'estimate',
          body: 'About how many binary digits does **1,000,000** need?',
          min: 1, max: 40, step: 1, answer: digitCount(MILLION, 2), tol: 1,
          hint: '2¹⁰ = 1,024 is about a thousand.',
          explain: `2¹⁰ ≈ 1,000, so 2²⁰ ≈ 1,000,000. Exactly: 2¹⁹ = ${fmt(2 ** 19)} ≤ 1,000,000 < 2²⁰ = ${fmt(2 ** 20)}, so ${digitCount(MILLION, 2)} digits. Every 10 binary digits buy about 3 decimal ones.`,
        },
      ],
      practice: [genToDecimal, genToBase, genBits],
    },

    // ------------------------------------------------------------ 8
    {
      id: 'checksums',
      title: 'Check digits',
      goal: 'Compute Luhn and ISBN check digits and know which typos each one catches.',
      steps: [
        {
          kind: 'choice',
          body: 'You mistype one digit of your card number on a shop’s website. It turns red **before** anything is sent to the bank. How does it know?',
          options: [
            { text: 'The last digit is computed from the others, and yours no longer matches', correct: true },
            { text: 'It looks the number up in a list of real cards', why: 'Shops don’t have such a list, and the check works offline, instantly. It’s pure arithmetic.' },
            { text: 'Card numbers are all prime', why: 'They aren’t, and checking primality wouldn’t help spot typos anyway.' },
          ],
          explain: 'Card numbers, ISBNs, barcodes and bank account numbers end in a **check digit**: a digit chosen so that some sum comes out to a multiple of 10 (or 11). A typo almost always breaks the sum.',
        },
        {
          kind: 'read',
          title: 'The simplest check digit',
          body: `Choose the last digit so the **digit sum is a multiple of 10**. For ${SIMPLE.join('')}, the digits add to ${sum(SIMPLE)}, so the check digit is ${SIMPLE_C}: ${SIMPLE.join('')}${SIMPLE_C}, total ${sum(SIMPLE) + SIMPLE_C}.\n\nChange any one digit and the sum moves by 1 to 9, never by 10, so a single wrong digit is always caught. But not every typo is a single wrong digit.`,
        },
        {
          kind: 'choice',
          body: 'With the digit-sum check, which typo can **never** be caught?',
          options: [
            { text: 'Swapping two neighbouring digits (…37… → …73…)', correct: true },
            { text: 'Typing one digit wrong', why: 'That changes the sum by 1 to 9, never a multiple of 10, so it’s always caught.' },
            { text: 'Typing 6 instead of 1', why: 'That changes the sum by 5, not a multiple of 10: caught.' },
          ],
          explain: 'Adding doesn’t care about order, so a swap leaves the digit sum unchanged. Swaps are one of the commonest typing errors, so real schemes give positions different **weights**.',
        },
        {
          kind: 'read',
          title: 'Luhn: the card-number check',
          body: 'Every bank card uses the **Luhn algorithm** (1954). Starting from the right, leave the check digit alone, **double every second digit**, and if a doubled digit is over 9, subtract 9 (that is, add its two digits). The total must end in 0.\n\nThe doubling gives neighbouring digits different weights, so most swaps change the total.',
          widget: () => luhnTable(CARD),
        },
        {
          kind: 'task',
          body: 'Choose the check digit so this number passes Luhn.',
          widget: checkDigitTask(TASK11, luhnValid, (d) => luhnTable(d)),
          hint: 'Pick any digit and look at the total: how far is it from the next multiple of 10?',
          explain: `The check digit is ${luhnCheck(TASK11)}: it brings the Luhn total up to a multiple of 10.`,
        },
        {
          kind: 'number', tol: 0,
          body: `What Luhn check digit goes after **${LUHN_Q.join('')}**?`,
          answer: luhnCheck(LUHN_Q),
          hint: 'The check digit isn’t doubled, so the digit just left of it is.',
          explain: (() => {
            const v = LUHN_Q.map((x, i) => ((LUHN_Q.length - i) % 2 === 1 ? (2 * x > 9 ? 2 * x - 9 : 2 * x) : x));
            return `Values: ${v.join(' + ')} = ${sum(v)}. Adding ${luhnCheck(LUHN_Q)} makes ${sum(v) + luhnCheck(LUHN_Q)}.`;
          })(),
        },
        {
          kind: 'multi',
          body: 'Which of these pass the Luhn check? Select all.',
          options: LUHN_OPTS.map((d) => {
            const s = sum(d.map((x, i) => ((d.length - 1 - i) % 2 === 1 ? (2 * x > 9 ? 2 * x - 9 : 2 * x) : x)));
            return luhnValid(d) ? { text: d.join(''), correct: true, why: `Luhn total ${s}, ends in 0.` } : { text: d.join(''), why: `Luhn total ${s}, doesn’t end in 0.` };
          }),
          hint: 'Double every second digit from the right (not the last one), subtract 9 where needed, add.',
          explain: 'Two of the invalid ones are copies of valid ones with a single typo: one digit changed, and two neighbours swapped. Luhn caught both.',
        },
        {
          kind: 'read',
          title: 'Books: ISBN-13',
          body: `Books and supermarket barcodes use weights **1, 3, 1, 3, …** from the left; the weighted total of all 13 digits must be a multiple of 10.\n\nFor 978-0-306-40615, the weighted total is ${isbnSum(ISBN12)}, so the check digit is ${isbn13Check(ISBN12)}.`,
          widget: () => digitRow([{ label: 'digit', cells: [...ISBN12, isbn13Check(ISBN12)] }, { label: 'weight', cells: [...ISBN12, 0].map((_, i) => (i % 2 ? 3 : 1)) }, { label: '×', cells: [...ISBN12, isbn13Check(ISBN12)].map((v, i) => v * (i % 2 ? 3 : 1)) }], [12]),
        },
        {
          kind: 'number', tol: 0,
          body: `Find the ISBN-13 check digit for **${ISBN_Q.join('')}**.`,
          answer: isbn13Check(ISBN_Q),
          hint: 'Weights 1, 3, 1, 3, … Then what makes the total a multiple of 10?',
          explain: `Weighted total: ${ISBN_Q.map((v, i) => v * (i % 2 ? 3 : 1)).join(' + ')} = ${isbnSum(ISBN_Q)}. Adding ${isbn13Check(ISBN_Q)} reaches ${isbnSum(ISBN_Q) + isbn13Check(ISBN_Q)}.`,
        },
        {
          kind: 'choice',
          body: `**${SWAP.join('')}** is a valid ISBN-13. Which swap of neighbouring digits would **still pass** the check, going unnoticed?`,
          options: [4, 6, 8, 1].map((i) => {
            const t = `Swap the ${SWAP[i]} and the ${SWAP[i + 1]} (positions ${i + 1}–${i + 2})`;
            const diff = Math.abs(SWAP[i] - SWAP[i + 1]);
            return swapCaught(i) ? { text: t, why: `The total changes by 2 × ${diff} = ${2 * diff}, not a multiple of 10: caught.` } : { text: t, correct: true };
          }),
          hint: 'Swapping neighbours a and b (weights 1 and 3) changes the total by 2 × (a − b). When is that a multiple of 10?',
          explain: `Swapping neighbours changes the total by 2(a − b). That's a multiple of 10 only when a and b differ by 5, like the ${SWAP[4]} and ${SWAP[5]}. So ISBN-13 misses swaps of digits 5 apart (such as 16 ↔ 61), while Luhn misses only 09 ↔ 90.`,
        },
        {
          kind: 'choice',
          body: 'The older ISBN-10 used weights 10, 9, 8, …, 1 and required the total to be a multiple of **11** (writing X for a check value of 10). Why 11?',
          options: [
            { text: '11 is prime, so no single error or neighbour swap can change the total by a multiple of 11', correct: true },
            { text: 'Because an ISBN-10 has 11 digits', why: 'It has 10 digits; the 11 is the modulus, chosen for its arithmetic.' },
            { text: 'Mod 11 totals are smaller and easier to add', why: 'The totals are about the same size. The point is which changes 11 can and can’t divide.' },
          ],
          explain: 'A single error changes the total by weight × (digit change), and a swap by (difference of weights) × (difference of digits). Every one of those factors is between 1 and 10, and a prime can’t divide a product of numbers it doesn’t divide. Mod 10 can: 2 × 5 = 10. The price is needing an 11th symbol, X.',
        },
        {
          kind: 'estimate',
          body: 'A check digit mod 10 is added to an ID number. If a typo scrambles the number completely at random, what percentage of such typos would slip through?',
          min: 0, max: 50, step: 1, answer: 10, tol: 2, format: (v) => `${v}%`,
          hint: 'A random number passes if its check digit happens to be the right one.',
          explain: 'One digit can only take 10 values, so a random wrong number has a 1 in 10 chance (10%) of matching. Check digits are designed so that the *common* typos (one digit, a swap) land in the other 90%, ideally all of them.',
        },
      ],
      practice: [genLuhnCheck, genIsbn, genLuhnValid],
    },
  ],
};
