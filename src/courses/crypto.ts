// Information & Cryptography: bits, surprise and entropy, compression, error correction, classical
// ciphers, brute force, hashing, public-key ideas. Every number shown is computed by running the
// encoder, check or cipher below. All ciphers and hashes here are toys and insecure on purpose.
import type { AskStep, Course, Generator } from '../types';
import { num, pick, randInt, shuffle } from '../ui';
import { barChart, columnChart, dataTable, iconArray } from '../viz/charts';
import { cells } from '../viz/cs';
import { stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  ALPHA, avalanche, binarySwitches, bitRows, bits, caesar, caesarTask, cipherWheel, codeTree, dlogTask, ENGLISH, freqChart,
  guessGame, halving, hex4, huffmanSteps, letterCounts, miner, modClock, modPow, paintMix, parityGrid, placeValues,
  powerSteps, prefixBuilder, subSolver, substitute, toBits, toyHash,
} from '../widgets/crypto';
import { h } from '../ui';

const COLOR = '#c08a1e';

// ---------------------------------------------------------------- maths

const log2 = Math.log2;
const bitsFor = (n: number) => Math.ceil(log2(n) - 1e-12);
const entropy = (ps: number[]) => -ps.filter((p) => p > 0).reduce((a, p) => a + p * log2(p), 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Run-length encoding: "WWWBB" -> "3W2B". */
const rle = (s: string) => (s.match(/(.)\1*/g) ?? []).map((run) => `${run.length}${run[0]}`).join('');

/** Huffman code lengths (ties: lighter first, then smaller group). */
function huffman(counts: [string, number][]): { len: Record<string, number>; total: number } {
  let pool = counts.map(([l, n]) => ({ members: [l], w: n }));
  const len: Record<string, number> = Object.fromEntries(counts.map(([l]) => [l, 0]));
  while (pool.length > 1) {
    pool.sort((a, b) => a.w - b.w || a.members.length - b.members.length);
    const [a, b] = pool;
    for (const m of [...a.members, ...b.members]) len[m]++;
    pool = pool.slice(2).concat({ members: [...a.members, ...b.members], w: a.w + b.w });
  }
  if (counts.length === 1) len[counts[0][0]] = 1;
  return { len, total: counts.reduce((acc, [l, n]) => acc + n * len[l], 0) };
}

const parity = (s: string) => [...s].filter((c) => c === '1').length % 2;

/** ISBN-10 check value (10 means X) for the first nine digits. */
function isbnCheck(d: number[]): number {
  const s = d.reduce((a, x, i) => a + (10 - i) * x, 0);
  return (11 - (s % 11)) % 11;
}

/** Hamming(7,4): data d1..d4 -> positions 1..7 (parity at 1, 2, 4; even parity). */
function hamming(d: number[]): number[] {
  const c = [0, 0, d[0], 0, d[1], d[2], d[3]];
  for (const p of [1, 2, 4]) c[p - 1] = [1, 2, 3, 4, 5, 6, 7].filter((q) => q & p && q !== p).reduce((a, q) => a ^ c[q - 1], 0);
  return c;
}
/** Position (1..7) of a single flipped bit, 0 if all checks pass. */
const syndrome = (c: number[]) => [1, 2, 4].reduce((acc, p) => acc + ([1, 2, 3, 4, 5, 6, 7].filter((q) => q & p).reduce((a, q) => a ^ c[q - 1], 0) ? p : 0), 0);
const checkSets = { 1: [1, 3, 5, 7], 2: [2, 3, 6, 7], 4: [4, 5, 6, 7] };

const fmtBig = (v: number) => (v < 1e6 ? v.toLocaleString('en-US') : v.toExponential(1).replace('e+', ' × 10^'));

// ---------------------------------------------------------------- fixed examples (computed)

const GUESS_N = 100, GUESS_Q = bitsFor(GUESS_N); // 7

// Lesson 3: prefix code task and Huffman example
const PREFIX_COUNTS: [string, number][] = [['A', 8], ['B', 4], ['C', 2], ['D', 2]];
const PREFIX_BEST = huffman(PREFIX_COUNTS).total; // 28
const PREFIX_FIXED = PREFIX_COUNTS.reduce((a, [, n]) => a + n * 2, 0); // 32
const PREFIX_POOL = ['0', '1', '00', '01', '10', '11', '000', '001', '010', '011', '100', '101', '110', '111'];
const ABRA = 'ABRACADABRA';
const ABRA_COUNTS = letterCounts(ABRA); // A5 B2 R2 C1 D1
const ABRA_H = huffman(ABRA_COUNTS);
const ABRA_FIXED = ABRA.length * bitsFor(ABRA_COUNTS.length); // 33
const ABRA_CODES: Record<string, string> = { A: '0', B: '100', R: '101', C: '110', D: '111' };

// Lesson 4
const PAR_DATA = '1101001';
const PAR_GRID = [[1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 1], [0, 0, 1, 0]];
const PAR_FLIP: [number, number] = [1, 2];
const ISBN9 = [0, 3, 0, 6, 4, 0, 6, 1, 5];
const ISBN_CHECK = isbnCheck(ISBN9);
const HAM_DATA = [1, 0, 1, 1];
const HAM_SENT = hamming(HAM_DATA);
const HAM_ERR = 6;
const HAM_GOT = HAM_SENT.map((b, i) => (i === HAM_ERR - 1 ? b ^ 1 : b));
const HAM_FOUND = syndrome(HAM_GOT);
const REP_GOT = ['110', '001', '111', '010'];
const REP_DEC = REP_GOT.map((g) => ([...g].filter((c) => c === '1').length >= 2 ? '1' : '0'));

// Lesson 5
const CAESAR_PLAIN = 'THE KEY IS UNDER THE MAT';
const CAESAR_KEY = 7;
const CAESAR_CIPHER = caesar(CAESAR_PLAIN, CAESAR_KEY);
const FREQ_PLAIN = 'PEOPLE NEED TREES AND GREEN SPACES';
const FREQ_KEY = 10;
const FREQ_CIPHER = caesar(FREQ_PLAIN, FREQ_KEY);
const FREQ_TOP = letterCounts(FREQ_CIPHER)[0][0];
const SUB_KEY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const SUB_PLAIN = 'MEET ME AT THE TREE';
const SUB_CIPHER = substitute(SUB_PLAIN, SUB_KEY);
const FACT26 = Array.from({ length: 26 }, (_, i) => i + 1).reduce((a, b) => a * b, 1);

// Lesson 6
const DES_YEARS = r1(2 ** 56 / 1e9 / (365.25 * 86400));

// Lesson 7
const HASH_OUT = 2 ** 16;
const BDAY = Math.round(Math.sqrt(2 * Math.log(2) * HASH_OUT)); // about 301
const MINE_TEXT = 'block';
const MINE_ZEROS = 4;
const MINE_MAX = 60;
const MINE_SOLS = Array.from({ length: MINE_MAX + 1 }, (_, k) => k).filter((k) => toBits(toyHash(MINE_TEXT + k), 16).startsWith('0'.repeat(MINE_ZEROS)));

// Lesson 8
const CLOCK_G = 3, CLOCK_P = 7;
const DL = { g: 3, p: 17, x: 11 };
const DL_T = modPow(DL.g, DL.x, DL.p);
const DH = { p: 23, g: 5, a: 6, b: 15 };
const DH_A = modPow(DH.g, DH.a, DH.p), DH_B = modPow(DH.g, DH.b, DH.p);
const DH_KEY = modPow(DH_B, DH.a, DH.p);
const RSA = { p: 5, q: 11, n: 55, phi: 40, e: 3, d: 27, m: 8 };
const RSA_C = modPow(RSA.m, RSA.e, RSA.n);
const RSA_BACK = modPow(RSA_C, RSA.d, RSA.n);
const RSA_DIGITS = Math.floor(2048 * Math.log10(2)) + 1; // 617

// Sanity checks: fail loudly at load time if an example ever stops being what the text says.
const sane: [boolean, string][] = [
  [GUESS_Q === 7, 'guess'], [PREFIX_BEST === 28, 'prefix best'], [ABRA_H.total === 23 && ABRA_FIXED === 33, 'abra'],
  [ABRA_COUNTS.every(([l, n]) => n * ABRA_CODES[l].length >= 0) && ABRA_COUNTS.reduce((a, [l, n]) => a + n * ABRA_CODES[l].length, 0) === ABRA_H.total, 'abra codes'],
  [HAM_FOUND === HAM_ERR, 'hamming'], [ISBN_CHECK === 2, 'isbn'], [FREQ_TOP === caesar('E', FREQ_KEY), 'freq'],
  [MINE_SOLS.length > 0 && MINE_SOLS[0] > 0, 'miner'], [DH_KEY === modPow(DH_A, DH.b, DH.p), 'dh'],
  [RSA_BACK === RSA.m && (RSA.e * RSA.d) % RSA.phi === 1, 'rsa'], [DL_T !== DL.g, 'dlog start'],
];
for (const [ok, what] of sane) if (!ok) throw new Error(`crypto course example broken: ${what}`);

// ---------------------------------------------------------------- practice generators

const THINGS: [string, number][] = [['students in a school of', 0], ['books in a library of', 0], ['seats in a stadium of', 0], ['songs in a playlist of', 0], ['houses on a street of', 0]];

const genBitsNeeded: Generator = (rng) => {
  const n = randInt(rng, 3, 5000);
  const [thing] = pick(rng, THINGS);
  const b = bitsFor(n);
  return {
    kind: 'number',
    body: `You want to give each of the ${thing} **${n.toLocaleString('en-US')}** its own binary label, all labels the same length. How many bits must each label have (at least)?`,
    answer: b, tol: 0, unit: 'bits',
    hint: 'Find the smallest power of 2 that is at least as big as the count.',
    explain: `2^${b - 1} = ${(2 ** (b - 1)).toLocaleString('en-US')} is too few, 2^${b} = ${(2 ** b).toLocaleString('en-US')} is enough. So ${b} bits.`,
  };
};

const genBinToDec: Generator = (rng) => {
  const w = randInt(rng, 5, 8);
  const v = randInt(rng, 2 ** (w - 1), 2 ** w - 1);
  const s = toBits(v, w);
  const parts = [...s].map((c, i) => (c === '1' ? 2 ** (w - 1 - i) : 0)).filter((x) => x);
  return {
    kind: 'number',
    body: `What number is **${s}** in binary?`,
    widget: () => bits(s, { labels: Array.from({ length: w }, (_, i) => String(2 ** (w - 1 - i))), size: 30 }),
    answer: v, tol: 0,
    hint: 'Add the place values under each 1.',
    explain: `${parts.join(' + ')} = ${v}.`,
  };
};

const genDecToBin: Generator = (rng) => {
  const v = randInt(rng, 9, 60);
  const w = bitsFor(v + 1);
  const right = toBits(v, w);
  const cands = [toBits(v + 1, w), toBits(v - 1, w), [...right].reverse().join(''), toBits(v ^ 2, w), toBits(v ^ 4, w)];
  const wrong = [...new Set(cands.filter((c) => c !== right && c.length === w))].slice(0, 3);
  return {
    kind: 'choice',
    body: `Which bit string is **${v}** in binary?`,
    options: [{ text: right, correct: true }, ...wrong.map((t) => ({ text: t, why: `${t} is ${parseInt(t, 2)}, not ${v}.` }))],
    hint: 'Take out the biggest power of 2 that fits, then the next, and so on.',
    explain: `${v} = ${[...right].map((c, i) => (c === '1' ? 2 ** (w - 1 - i) : 0)).filter((x) => x).join(' + ')}, so the bits are ${right}.`,
  };
};

const genSurprise: Generator = (rng) => {
  if (rng() < 0.5) {
    const k = randInt(rng, 1, 12);
    return {
      kind: 'number',
      body: `An event has probability **1/${(2 ** k).toLocaleString('en-US')}**. How many bits of information (surprise) do you get when it happens?`,
      answer: k, tol: 0.01, unit: 'bits',
      hint: 'Surprise = log₂(1/p): how many halvings get you from 1 to p?',
      explain: `1/${2 ** k} is ${k} halvings of 1, so the surprise is log₂(${2 ** k}) = ${k} bits.`,
    };
  }
  const n = pick(rng, [3, 5, 6, 10, 12, 20, 26, 52, 100, 365]);
  return {
    kind: 'number',
    body: `Something with probability **1 in ${n}** just happened. How many bits of surprise is that? (two decimals)`,
    answer: log2(n), tol: 0.02, unit: 'bits',
    hint: 'log₂(n) = ln(n) / ln(2).',
    explain: `log₂(${n}) ≈ ${r2(log2(n))} bits. It sits between ${Math.floor(log2(n))} and ${Math.ceil(log2(n))} because ${n} is between ${2 ** Math.floor(log2(n))} and ${2 ** Math.ceil(log2(n))}.`,
  };
};

const genUniform: Generator = (rng) => {
  const n = pick(rng, [2, 3, 4, 6, 8, 10, 12, 16, 20, 32, 64]);
  const what = n === 2 ? 'a fair coin' : `a fair ${n}-sided die`;
  return {
    kind: 'number',
    body: `What is the entropy of ${what}, in bits? (two decimals if needed)`,
    answer: log2(n), tol: 0.02, unit: 'bits',
    hint: 'With n equally likely outcomes, every outcome carries log₂(n) bits, so the average does too.',
    explain: `All ${n} outcomes are equally likely, so the entropy is log₂(${n}) ≈ ${r2(log2(n))} bits.`,
  };
};

const DISTS: number[][] = [[1 / 2, 1 / 4, 1 / 4], [1 / 2, 1 / 4, 1 / 8, 1 / 8], [1 / 4, 1 / 4, 1 / 4, 1 / 8, 1 / 8], [1 / 2, 1 / 8, 1 / 8, 1 / 8, 1 / 8], [1 / 2, 1 / 2], [1 / 4, 1 / 4, 1 / 4, 1 / 4], [1 / 2, 1 / 4, 1 / 8, 1 / 16, 1 / 16]];
const WEATHER = ['sun', 'cloud', 'rain', 'wind', 'snow'];
const ps = (p: number) => `1/${Math.round(1 / p)}`;

const genDyadic: Generator = (rng) => {
  const d = pick(rng, DISTS);
  const names = shuffle(rng, WEATHER).slice(0, d.length);
  const H = entropy(d);
  return {
    kind: 'number',
    body: `Tomorrow's weather in a made-up town: ${names.map((n, i) => `${n} ${ps(d[i])}`).join(', ')}. What is the entropy of the forecast, in bits?`,
    widget: () => barChart(names.map((n, i) => ({ label: n, value: d[i] })), { format: ps, max: 1 }),
    answer: H, tol: 0.01, unit: 'bits',
    hint: 'Average surprise: each outcome contributes p × log₂(1/p).',
    explain: `${d.map((p) => `${ps(p)} × ${log2(1 / p)}`).join(' + ')} = ${num(H)} bits.`,
  };
};

const genRLE: Generator = (rng) => {
  const runs: [number, string][] = [];
  const nr = randInt(rng, 3, 5);
  let c = pick(rng, ['W', 'B']);
  for (let i = 0; i < nr; i++) { runs.push([randInt(rng, 1, 7), c]); c = c === 'W' ? 'B' : 'W'; }
  const s = runs.map(([n, ch]) => ch.repeat(n)).join('');
  const right = rle(s);
  const swapped = runs.map(([n], i) => `${n}${runs[(i + 1) % runs.length][1]}`).join('');
  const off = runs.map(([n, ch], i) => `${i === 0 ? n + 1 : n}${ch}`).join('');
  const rev = runs.slice().reverse().map(([n], i) => `${n}${runs[i][1]}`).join('');
  const opts = [...new Set([right, swapped, off, rev])];
  return {
    kind: 'fill',
    body: `Run-length encode this row of pixels: **${s}**`,
    template: `${s} → [[0]]`,
    blanks: [{ options: opts, answer: 0 }],
    hint: 'Count each run of the same letter, then write count + letter.',
    explain: `Runs: ${runs.map(([n, ch]) => ch.repeat(n)).join(' | ')}, so ${right}.`,
  };
};

const genHuffman: Generator = (rng) => {
  const ls = ['A', 'B', 'C', 'D', 'E'].slice(0, randInt(rng, 4, 5));
  const counts: [string, number][] = ls.map((l) => [l, randInt(rng, 1, 12)]);
  const hf = huffman(counts);
  const fixed = counts.reduce((a, [, n]) => a + n, 0) * bitsFor(ls.length);
  return {
    kind: 'number',
    body: `A message uses these letters: ${counts.map(([l, n]) => `${l} × ${n}`).join(', ')}. Build a Huffman code (keep merging the two lightest groups). How many bits does the whole message take?`,
    answer: hf.total, tol: 0, unit: 'bits',
    hint: 'Each merge adds one bit to every letter inside it, so the total is the sum of all the merged weights.',
    explain: `Code lengths: ${counts.map(([l]) => `${l} ${hf.len[l]}`).join(', ')}. Total ${counts.map(([l, n]) => `${n}×${hf.len[l]}`).join(' + ')} = ${hf.total} bits (a fixed ${bitsFor(ls.length)}-bit code would need ${fixed}).`,
  };
};

const genPigeon: Generator = (rng) => {
  const n = randInt(rng, 3, 20);
  return {
    kind: 'number',
    body: `There are 2^${n} = ${(2 ** n).toLocaleString('en-US')} different files of exactly ${n} bits. How many bit strings are **shorter** than ${n} bits (count the empty string too)?`,
    answer: 2 ** n - 1, tol: 0,
    hint: '1 + 2 + 4 + … + 2^(n−1).',
    explain: `1 + 2 + … + 2^${n - 1} = 2^${n} − 1 = ${(2 ** n - 1).toLocaleString('en-US')}: one too few. A compressor that shrank every ${n}-bit file would have to send two files to the same output.`,
  };
};

const genParity: Generator = (rng) => {
  const s = Array.from({ length: 7 }, () => (rng() < 0.5 ? '1' : '0')).join('');
  const ones = [...s].filter((c) => c === '1').length;
  return {
    kind: 'number',
    body: `Even parity: add one bit so the total number of 1s is even. What parity bit goes after **${s}**?`,
    widget: () => bits(s + '?', { hi: [7] }),
    answer: parity(s), tol: 0,
    hint: 'Count the 1s.',
    explain: `${ones} ones is ${ones % 2 ? 'odd, so add a 1' : 'already even, so add a 0'}.`,
  };
};

const genISBN: Generator = (rng) => {
  const d = Array.from({ length: 9 }, () => randInt(rng, 0, 9));
  const c = isbnCheck(d);
  const s = d.reduce((a, x, i) => a + (10 - i) * x, 0);
  return {
    kind: 'number',
    body: `ISBN-10 rule: multiply the ten digits by 10, 9, …, 1 and add; the total must be divisible by 11. The first nine digits are **${d.join('')}**. What is the check digit? (Enter 10 if it is X.)`,
    answer: c, tol: 0,
    hint: 'Weighted sum of the nine digits, then add whatever makes it a multiple of 11.',
    explain: `Weighted sum: ${s}. ${s} mod 11 = ${s % 11}, so the check digit adds ${c} to reach ${s + c} = 11 × ${(s + c) / 11}.${c === 10 ? ' Written as X.' : ''}`,
  };
};

const genHamming: Generator = (rng) => {
  const d = Array.from({ length: 4 }, () => randInt(rng, 0, 1));
  const sent = hamming(d);
  const e = randInt(rng, 1, 7);
  const got = sent.map((b, i) => (i === e - 1 ? b ^ 1 : b));
  const fails = [1, 2, 4].filter((p) => checkSets[p as 1 | 2 | 4].reduce((a, q) => a ^ got[q - 1], 0));
  return {
    kind: 'number',
    body: `Hamming(7,4) word received: **${got.join('')}** (positions 1 to 7). Check 1 covers positions 1,3,5,7; check 2 covers 2,3,6,7; check 4 covers 4,5,6,7. Each should have an even number of 1s. Exactly one bit flipped: which position?`,
    widget: () => bits(got.join(''), { labels: ['1', '2', '3', '4', '5', '6', '7'], size: 30 }),
    answer: syndrome(got), tol: 0,
    hint: 'Add up the names of the checks that fail.',
    explain: `Failing checks: ${fails.join(' and ')}. ${fails.join(' + ')} = ${e}, so position ${e} flipped.`,
  };
};

const WORDS = ['CAT', 'DOG', 'SUN', 'MAP', 'KEY', 'BOX', 'CODE', 'LOCK', 'RAIN', 'MOON', 'FISH', 'BIRD', 'TREE', 'STAR'];

const genCaesarEnc: Generator = (rng) => {
  const w = pick(rng, WORDS);
  const k = randInt(rng, 1, 12);
  const right = caesar(w, k);
  const opts = [...new Set([right, caesar(w, -k), caesar(w, k + 1), caesar(w, k - 1)])];
  return {
    kind: 'choice',
    body: `Encrypt **${w}** with a Caesar shift of ${k} (each letter moves ${k} places forward, Z wraps to A).`,
    widget: () => h('div', { class: 'plot-wrap' }, cipherWheel(k, { size: 240 })),
    options: opts.map((t) => ({ text: t, correct: t === right, why: t === right ? undefined : t === caesar(w, -k) ? 'That shifts backwards: that is decrypting.' : 'Off by one place: count the shift again.' })),
    hint: `Find each letter on the outer ring and read the inner ring.`,
    explain: `${[...w].map((c) => `${c}→${caesar(c, k)}`).join(', ')}: ${right}.`,
  };
};

const genCaesarKey: Generator = (rng) => {
  const a = randInt(rng, 0, 25), k = randInt(rng, 1, 25);
  const p = ALPHA[a], c = ALPHA[(a + k) % 26];
  return {
    kind: 'number',
    body: `In a Caesar cipher, the plain letter **${p}** became **${c}**. What is the shift (1 to 25)?`,
    answer: k, tol: 0,
    hint: 'Count forward from the plain letter, wrapping past Z.',
    explain: `${p} is letter ${a}, ${c} is letter ${(a + k) % 26} (counting A as 0). (${(a + k) % 26} − ${a}) mod 26 = ${k}.`,
  };
};

const genFreqKey: Generator = (rng) => {
  const k = randInt(rng, 1, 25);
  const top = ALPHA[(4 + k) % 26];
  return {
    kind: 'number',
    body: `A long English text was encrypted with an unknown Caesar shift. In the ciphertext the most common letter by far is **${top}**. Assuming it stands for E, what is the shift?`,
    answer: k, tol: 0,
    hint: 'How far is it from E to that letter, going forward?',
    explain: `E is letter 4, ${top} is letter ${(4 + k) % 26}: the shift is ${k}. Decrypt by shifting back ${k} and check that it reads as English.`,
  };
};

const genKeySpace: Generator = (rng) => {
  const [what, base] = pick(rng, [['digit (0–9)', 10], ['lowercase letter', 26], ['coin flip', 2], ['die roll', 6], ['hex digit (0–F)', 16]] as [string, number][]);
  const maxLen = Math.floor(Math.log(5e7) / Math.log(base));
  const len = randInt(rng, 2, Math.min(maxLen, 8));
  return {
    kind: 'number',
    body: `A key is ${len} random choices, each a ${what}. How many different keys are possible?`,
    answer: base ** len, tol: 0,
    hint: 'Choices multiply: the number of options to the power of the length.',
    explain: `${base}^${len} = ${(base ** len).toLocaleString('en-US')}.`,
  };
};

const genDoubling: Generator = (rng) => {
  const n = randInt(rng, 30, 60), k = randInt(rng, 1, 10), t = pick(rng, [1, 2, 3, 5]);
  return {
    kind: 'number',
    body: `Trying every ${n}-bit key takes a computer ${t} hour${t === 1 ? '' : 's'}. How many hours for every **${n + k}-bit** key on the same computer?`,
    answer: t * 2 ** k, tol: 0, unit: 'hours',
    hint: 'Each extra bit doubles the number of keys.',
    explain: `${k} more bit${k === 1 ? '' : 's'}: ×2^${k} = ×${2 ** k}, so ${t} × ${2 ** k} = ${(t * 2 ** k).toLocaleString('en-US')} hours.`,
  };
};

const genPassBits: Generator = (rng) => {
  const [what, n] = pick(rng, [['digits', 10], ['lowercase letters', 26], ['letters (upper and lower case)', 52], ['letters and digits', 62], ['printable keyboard characters', 94]] as [string, number][]);
  const len = randInt(rng, 4, 16);
  const H = len * log2(n);
  return {
    kind: 'number',
    body: `A password of **${len}** characters, each picked at random from ${n} ${what}. How many bits of entropy? (one decimal)`,
    answer: H, tol: 0.15, unit: 'bits',
    hint: 'Each random character adds log₂ of the alphabet size.',
    explain: `${len} × log₂(${n}) = ${len} × ${r2(log2(n))} ≈ ${r1(H)} bits. Only true if the characters really are random.`,
  };
};

const genOutputs: Generator = (rng) => {
  const n = randInt(rng, 4, 24);
  return {
    kind: 'number',
    body: `A hash function outputs **${n}** bits. How many different outputs are possible?`,
    answer: 2 ** n, tol: 0,
    explain: `2^${n} = ${(2 ** n).toLocaleString('en-US')}. Inputs are unlimited, so many inputs share each output: collisions must exist.`,
  };
};

const HWORDS = ['cat', 'dog', 'sun', 'map', 'key', 'box', 'code', 'lock', 'rain', 'moon', 'fish', 'bird', 'tree', 'star', 'salt', 'mint'];

const genAvalanche: Generator = (rng) => {
  const w = pick(rng, HWORDS);
  const i = randInt(rng, 0, w.length - 1);
  const letters = 'abcdefghijklmnopqrstuvwxyz'.replace(w[i], '');
  const w2 = w.slice(0, i) + letters[randInt(rng, 0, letters.length - 1)] + w.slice(i + 1);
  const a = toBits(toyHash(w), 16), b = toBits(toyHash(w2), 16);
  const diff = [...a].filter((c, k) => c !== b[k]).length;
  return {
    kind: 'number',
    body: `Toy hash of "${w}": **${a}**. Toy hash of "${w2}": **${b}**. In how many of the 16 positions do they differ?`,
    widget: () => bitRows([{ label: `toyhash("${w}")`, bits: a, group: 4 }, { label: `toyhash("${w2}")`, bits: b, group: 4 }], 17),
    answer: diff, tol: 0,
    hint: 'Compare the two strings position by position.',
    explain: `${diff} of 16 bits differ, from changing one letter. A good hash flips about half the bits (8) on average.`,
  };
};

const genMine: Generator = (rng) => {
  const k = randInt(rng, 2, 24);
  return {
    kind: 'number',
    body: `Proof of work: you need a nonce whose hash starts with **${k}** zero bits. Each try is a fresh coin-flip-like hash. On average, how many tries does it take?`,
    answer: 2 ** k, tol: 0, unit: 'tries',
    hint: `Each try succeeds with probability 1/2^${k}.`,
    explain: `The chance per try is 1/2^${k}, so on average 2^${k} = ${(2 ** k).toLocaleString('en-US')} tries. Checking an answer takes one.`,
  };
};

const genModPow: Generator = (rng) => {
  const p = pick(rng, [7, 11, 13, 17, 19, 23]);
  const g = randInt(rng, 2, p - 2), e = randInt(rng, 2, 6);
  const steps = Array.from({ length: e }, (_, k) => modPow(g, k + 1, p));
  return {
    kind: 'number',
    body: `Compute **${g}^${e} mod ${p}** (the remainder when ${g}^${e} is divided by ${p}).`,
    answer: modPow(g, e, p), tol: 0,
    hint: 'Multiply by the base one step at a time, reducing mod p after each step.',
    explain: `Powers of ${g} mod ${p}: ${steps.join(', ')}. So ${g}^${e} mod ${p} = ${steps[e - 1]}.`,
  };
};

const PRIM: [number, number][] = [[11, 2], [13, 2], [17, 3], [19, 2], [23, 5], [29, 2]];
const genDH: Generator = (rng) => {
  const [p, g] = pick(rng, PRIM);
  const a = randInt(rng, 2, p - 2), b = randInt(rng, 2, p - 2);
  const A = modPow(g, a, p), B = modPow(g, b, p), K = modPow(B, a, p);
  return {
    kind: 'number',
    body: `Toy Diffie–Hellman with p = ${p}, g = ${g}. Alice's secret is a = ${a}; Bob sends B = ${B}. What shared key does Alice compute?`,
    answer: K, tol: 0,
    hint: 'Alice raises what Bob sent to her own secret: B^a mod p.',
    explain: `${B}^${a} mod ${p} = ${K}. Bob gets the same from A = ${g}^${a} mod ${p} = ${A}: ${A}^${b} mod ${p} = ${modPow(A, b, p)}.`,
  };
};

const RSA_KEYS = [{ n: 55, e: 3 }, { n: 33, e: 7 }, { n: 35, e: 5 }, { n: 77, e: 7 }, { n: 51, e: 5 }];
const genRSA: Generator = (rng) => {
  const k = pick(rng, RSA_KEYS);
  const m = randInt(rng, 2, k.n - 2);
  const c = modPow(m, k.e, k.n);
  return {
    kind: 'number',
    body: `Toy RSA public key (n = ${k.n}, e = ${k.e}). Encrypt the message m = **${m}**: c = m^e mod n.`,
    answer: c, tol: 0,
    hint: 'Multiply step by step, taking mod n as you go.',
    explain: `${m}^${k.e} mod ${k.n} = ${c}. Only someone who knows the factors of ${k.n} can work out the private exponent to undo it.`,
  };
};

// ---------------------------------------------------------------- course

const ask = (s: AskStep) => s;

export const crypto: Course = {
  id: 'crypto',
  title: 'Information & Cryptography',
  blurb: 'Bits, surprise, compression, error correction, and how secrets are kept: from Caesar to public keys.',
  color: COLOR,
  icon: '🔐',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'bits',
      title: 'Bits and yes/no questions',
      goal: 'Count how many yes/no questions pin something down, and read binary numbers.',
      steps: [
        {
          kind: 'choice',
          body: 'I’m thinking of a whole number from 1 to 100. You may only ask yes/no questions. Which first question is best?',
          options: [
            { text: 'Is it more than 50?', correct: true, why: 'Whatever the answer, half the numbers are gone.' },
            { text: 'Is it 37?', why: 'Usually the answer is “no” and you have ruled out just one number of 100.' },
            { text: 'Is it more than 90?', why: 'Nine times in ten the answer is “no”, leaving 90 numbers. Lopsided questions waste answers.' },
            { text: 'Is it a multiple of 10?', why: 'Only 10 of the 100 numbers are; “no” is very likely and leaves 90.' },
          ],
          explain: 'The best question splits the possibilities in half, so you learn the most whichever way it goes.',
        },
        {
          kind: 'task',
          title: 'Twenty questions, with a sneaky opponent',
          body: `Find my number from 1 to ${GUESS_N} in **${GUESS_Q} questions or fewer**. Careful: I don't commit to a number in advance. I answer so that as many numbers as possible stay possible.`,
          widget: guessGame({ n: GUESS_N, max: GUESS_Q }),
          hint: 'Always ask about the middle of what is still possible.',
          explain: `Halve every time: more than 50? then more than 75 or 25, and so on. 100 → 50 → 25 → 13 → 7 → 4 → 2 → 1 takes ${GUESS_Q} questions, because 2^${GUESS_Q} = ${2 ** GUESS_Q} ≥ 100 but 2^${GUESS_Q - 1} = ${2 ** (GUESS_Q - 1)} < 100.`,
        },
        {
          kind: 'read',
          title: 'Each answer halves',
          body: `A perfect yes/no question cuts the possibilities in half (rounding up when they don't split evenly). Step through it: 100 numbers need ${GUESS_Q} questions.\n\nWith q questions you can tell apart at most **2^q** possibilities.`,
          widget: () => halving(GUESS_N),
        },
        ask({
          kind: 'number',
          body: 'Same game, but the number is from 1 to **1,000**. With the best strategy, how many questions do you need in the worst case?',
          answer: bitsFor(1000), tol: 0, unit: 'questions',
          hint: 'Find the smallest power of 2 that reaches 1,000.',
          explain: `2^9 = 512 is not enough, 2^10 = 1,024 is. So ${bitsFor(1000)} questions. Ten times as many numbers costs only 3 more questions.`,
        }),
        {
          kind: 'read',
          title: 'One answer = one bit',
          body: 'The answer to one fair yes/no question is called a **bit** (binary digit). Write yes as 1 and no as 0, and every sequence of answers becomes a string of bits.\n\nThree questions give 2 × 2 × 2 = 8 possible answer strings, so 3 bits can label 8 things:',
          widget: () => cells(Array.from({ length: 8 }, (_, i) => toBits(i, 3))),
        },
        ask({
          kind: 'match',
          body: 'Match each number of bits to how many different things it can label.',
          heads: ['Bits', 'Possibilities'],
          pairs: [['1 bit', '2'], ['3 bits', '8'], ['8 bits (a byte)', '256'], ['10 bits', '1,024']],
          hint: 'Each bit doubles the count.',
          explain: '2^1 = 2, 2^3 = 8, 2^8 = 256, 2^10 = 1,024.',
        }),
        {
          kind: 'read',
          title: 'Binary numbers',
          body: 'Binary is the same idea written as a number. Each position asks “is this power of 2 included?” From the right: 1, 2, 4, 8, 16…\n\n**1101** = 8 + 4 + 1 = **13**.',
          widget: () => placeValues(13, 4),
        },
        {
          kind: 'task',
          body: 'Switch bits on until they spell **22** in binary.',
          widget: binarySwitches({ target: 22, width: 5 }),
          hint: 'Take the biggest place value that fits (16), then see what is left.',
          explain: '22 = 16 + 4 + 2, so switch on 16, 4 and 2: **10110**.',
        },
        ask({
          kind: 'fill',
          body: 'Complete the conversions.',
          template: '6 in binary is [[0]] and 9 in binary is [[1]]',
          blanks: [{ options: ['110', '101', '011'], answer: 0 }, { options: ['1001', '1010', '0110'], answer: 0 }],
          hint: '6 = 4 + 2. 9 = 8 + 1.',
          explain: '6 = 4 + 2 → 110 (101 is 5, 011 is 3). 9 = 8 + 1 → 1001 (1010 is 10, 0110 is 6).',
        }),
        ask({
          kind: 'estimate',
          body: 'There are about a million people in a city. Picking out one person by yes/no questions: roughly how many questions?',
          min: 0, max: 40, step: 1, answer: bitsFor(1e6), tol: 1, format: (v) => `${v} questions`,
          hint: '2^10 is about a thousand.',
          explain: `2^10 ≈ 1,000, so 2^20 ≈ 1,000 × 1,000 = a million (exactly 1,048,576). About ${bitsFor(1e6)} questions. That is the game “twenty questions”.`,
        }),
        ask({
          kind: 'order',
          body: 'Order these by how many bits it takes to record one outcome (fewest first).',
          items: ['A coin flip (2 outcomes)', 'A die roll (6)', 'A letter A–Z (26)', 'A day of the year (366)', 'One person on Earth (8 billion)'],
          hint: 'Bits needed = the smallest q with 2^q at least the number of outcomes.',
          explain: `1 bit, ${bitsFor(6)} bits, ${bitsFor(26)} bits, ${bitsFor(366)} bits, ${bitsFor(8e9)} bits. Even 8 billion people need only ${bitsFor(8e9)} bits: doubling is powerful.`,
        }),
        ask({
          kind: 'sort',
          body: 'Four bits give 16 labels. Which of these fit in 4 bits?',
          widget: () => h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center;font-family:ui-monospace,Menlo,Consolas,monospace;' }, Array.from({ length: 16 }, (_, i) => h('span', { class: 'chip' }, toBits(i, 4)))),
          bins: ['Fits in 4 bits', 'Needs 5 or more'],
          items: [
            { text: 'A decimal digit (10)', bin: 0 }, { text: 'A month (12)', bin: 0 }, { text: 'A hex digit (16)', bin: 0 },
            { text: 'An amino acid (20)', bin: 1 }, { text: 'A letter A–Z (26)', bin: 1 }, { text: 'A playing card (52)', bin: 1 },
          ],
          hint: 'Anything with more than 16 possibilities needs a fifth bit.',
          explain: '10, 12 and 16 are at most 16, so 4 bits do. 20, 26 and 52 are more than 16: they need 5 bits (or 6 for the 52 cards).',
        }),
      ],
      practice: [genBitsNeeded, genBinToDec, genDecToBin],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'surprise',
      title: 'Information and surprise',
      goal: 'Measure the information in an outcome and the entropy of a source.',
      steps: [
        {
          kind: 'choice',
          body: 'Which weather report tells you more about the Sahara today?',
          options: [
            { text: '“It rained in the Sahara today.”', correct: true, why: 'Rare news: you would never have guessed it.' },
            { text: '“It was sunny in the Sahara today.”', why: 'You could have guessed that without being told. Expected news carries little information.' },
            { text: 'They tell you the same amount', why: 'Both are one sentence, but one removes far more uncertainty: you would almost certainly have bet on sun.' },
          ],
          explain: 'Information is about surprise. The less likely an outcome, the more you learn when it happens.',
        },
        {
          kind: 'read',
          title: 'Surprise in bits',
          body: 'An outcome with probability **1/2** is worth 1 bit: it is one fair yes/no answer. Probability **1/4** is two fair answers in a row: 2 bits. In general\n\n**surprise = log₂(1 / p) bits**\n\nHalve the probability, add one bit.',
          widget: () => barChart([1 / 2, 1 / 4, 1 / 8, 1 / 64, 1 / 1024].map((p) => ({ label: `p = 1/${1 / p}`, value: log2(1 / p), color: 'var(--c2)' })), { format: (v) => `${v} bit${v === 1 ? '' : 's'}` }),
        },
        ask({
          kind: 'number',
          body: 'You draw a raffle ticket and it is the single winner among **32** tickets. How many bits of surprise?',
          widget: () => iconArray(32, 1, { cols: 16 }),
          answer: 5, tol: 0, unit: 'bits',
          hint: 'How many halvings take 1 down to 1/32?',
          explain: '1/32 = (1/2)^5, so log₂(32) = 5 bits: the same as guessing five fair coin flips correctly.',
        }),
        ask({
          kind: 'match',
          body: 'Match each probability to the surprise of seeing it happen.',
          heads: ['Probability', 'Surprise'],
          pairs: [['1 (certain)', '0 bits'], ['1/2', '1 bit'], ['1/16', '4 bits'], ['1/256', '8 bits']],
          hint: 'Surprise = log₂(1/p).',
          explain: 'log₂1 = 0: a certain event tells you nothing. log₂2 = 1, log₂16 = 4, log₂256 = 8.',
        }),
        ask({
          kind: 'point',
          body: 'Picture a coin that may be biased. Across the bottom: the chance of heads. Up the side: how much you learn, on average, from one flip. Place the point for a coin that **always** lands heads.',
          plot: { x: [0, 1], y: [0, 1.2], xlabel: 'chance of heads', ylabel: 'average bits per flip', ticks: [0.25, 0.25], grid: true },
          answer: { x: 1, y: 0 }, tol: 0.08, snap: 0.05,
          hint: 'If you know the result before the flip, how much does seeing it tell you?',
          explain: 'Chance of heads 1, information 0: you knew the outcome before the flip, so seeing it teaches you nothing.',
        }),
        {
          kind: 'read',
          title: 'Entropy: average surprise',
          body: 'The **entropy** of a source is its average surprise: add up p × log₂(1/p) over the outcomes.\n\nA fair coin: ½ × 1 + ½ × 1 = **1 bit**, the most a coin can have. Bias it and the flips get more predictable, so the entropy falls, down to 0 for a coin that always lands the same way.',
          widget: () => plotEl({ x: [0, 1], y: [0, 1.2], xlabel: 'chance of heads', ylabel: 'entropy (bits)', ticks: [0.25, 0.25], grid: true, layers: [
            { type: 'fn', f: (p) => entropy([p, 1 - p]), color: 'var(--c1)', width: 3 },
            { type: 'dots', pts: [[0.5, 1], [0, 0], [1, 0]] },
            { type: 'text', x: 0.5, y: 1.08, text: 'fair: 1 bit', anchor: 'middle' },
            { type: 'text', x: 0.97, y: 0.08, text: 'always heads: 0', anchor: 'end' }] }),
        },
        ask({
          kind: 'number',
          body: 'What is the entropy of a fair six-sided die, in bits? (two decimals)',
          widget: () => columnChart([1, 2, 3, 4, 5, 6].map((f) => ({ label: String(f), value: 1 / 6, color: 'var(--c1)' })), { format: () => '1/6', height: 140 }),
          answer: log2(6), tol: 0.01, unit: 'bits',
          hint: 'Six equally likely outcomes, each with surprise log₂(6).',
          explain: `Each face has p = 1/6 and surprise log₂6 ≈ ${r2(log2(6))}, so the average is ${r2(log2(6))} bits: between 2 bits (4 outcomes) and 3 bits (8 outcomes).`,
        }),
        ask({
          kind: 'multi',
          body: 'Which of these have an entropy of exactly **2 bits**?',
          options: [
            { text: 'A fair four-sided die', correct: true },
            { text: 'Two fair coins flipped together', correct: true },
            { text: 'A letter picked at random from A, B, C, D', correct: true },
            { text: 'A fair six-sided die', why: `Six outcomes: log₂6 ≈ ${r2(log2(6))} bits, more than 2.` },
            { text: 'A coin that lands heads 3/4 of the time', why: `A biased coin has less than 1 bit: about ${r2(entropy([0.75, 0.25]))}.` },
          ],
          hint: 'Exactly 2 bits means it behaves like 4 equally likely outcomes.',
          explain: 'Four equally likely outcomes give log₂4 = 2 bits, however you make them: a 4-sided die, two coins (HH, HT, TH, TT), or one of four letters.',
        }),
        ask({
          kind: 'number',
          body: 'A town’s weather: sunny 1/2 of days, cloudy 1/4, rain 1/8, snow 1/8. What is the entropy of tomorrow’s weather, in bits?',
          widget: () => barChart([['sunny', 1 / 2], ['cloudy', 1 / 4], ['rain', 1 / 8], ['snow', 1 / 8]].map(([l, p]) => ({ label: l as string, value: p as number })), { format: ps, max: 1 }),
          answer: entropy([1 / 2, 1 / 4, 1 / 8, 1 / 8]), tol: 0.01, unit: 'bits',
          hint: 'Surprises are 1, 2, 3 and 3 bits. Weight each by its probability.',
          explain: '½ × 1 + ¼ × 2 + ⅛ × 3 + ⅛ × 3 = 0.5 + 0.5 + 0.375 + 0.375 = 1.75 bits: less than the 2 bits of four equally likely kinds of weather.',
        }),
        ask({
          kind: 'estimate',
          body: 'A coin lands heads 90% of the time. Estimate its entropy in bits.',
          min: 0, max: 1, step: 0.01, answer: r2(entropy([0.9, 0.1])), tol: 0.05, format: (v) => `${v.toFixed(2)} bits`,
          hint: 'Heads: surprise log₂(1/0.9) ≈ 0.15. Tails: log₂10 ≈ 3.32.',
          explain: `0.9 × 0.152 + 0.1 × 3.32 ≈ ${r2(entropy([0.9, 0.1]))} bits. Under half a bit: the flips are mostly predictable.`,
        }),
        ask({
          kind: 'choice',
          body: `There are 26 letters, so a random letter carries log₂26 ≈ ${r2(log2(26))} bits. Yet English text carries far less than that per letter. Why?`,
          widget: () => barChart(ENGLISH.slice(0, 6).concat([['Q', 0.1], ['Z', 0.07]]).map(([l, p]) => ({ label: l, value: p, color: 'var(--c3)' })), { format: (v) => `${v}%`, title: 'Share of letters in English text' }),
          options: [
            { text: 'Letters are not equally likely, and each depends on the ones before', correct: true },
            { text: 'Some letters are never used', why: 'All 26 appear. The point is that they appear with very different frequencies (E is common, Z rare), and context makes the next letter guessable.' },
            { text: 'Computers store letters in 8 bits', why: 'That is a storage format, not the information content. Entropy measures how unpredictable the text is.' },
          ],
          explain: 'Uneven frequencies lower entropy, and context lowers it further: after “Q” you can bet on “U”. That predictability is exactly what compression exploits (next lesson).',
        }),
        ask({
          kind: 'sort',
          body: 'How much information does each outcome carry?',
          bins: ['Less than 1 bit', 'Exactly 1 bit', 'More than 1 bit'],
          items: [
            { text: 'A forecast of 99% sun comes true', bin: 0 }, { text: 'A coin that is heads 3/4 of the time lands heads', bin: 0 },
            { text: 'A fair coin lands tails', bin: 1 }, { text: 'A fair coin lands heads', bin: 1 },
            { text: 'A fair die shows 6', bin: 2 }, { text: 'You draw the ace of spades', bin: 2 },
          ],
          hint: 'Probability above 1/2 means less than 1 bit; below 1/2 means more.',
          explain: `Probabilities 0.99 and 3/4 give ${r2(log2(1 / 0.99))} and ${r2(log2(4 / 3))} bits. Exactly 1/2 gives 1 bit. 1/6 and 1/52 give ${r2(log2(6))} and ${r2(log2(52))} bits.`,
        }),
      ],
      practice: [genSurprise, genUniform, genDyadic],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'compression',
      title: 'Compression',
      goal: 'Shrink data by exploiting patterns, and see why not everything can shrink.',
      steps: [
        {
          kind: 'choice',
          body: 'You have to read one of these out over the phone. Which can you say in far fewer words?\n\n`AAAAAAAAAAAAAAAAAAAA`\n\n`QXJZPWMRKVBTLNFYDHGC`',
          options: [
            { text: 'The row of A’s: “twenty A’s”', correct: true, why: 'A pattern lets you describe the whole thing briefly.' },
            { text: 'The jumble of letters', why: 'There is no pattern in it: you have to say every letter.' },
            { text: 'Neither: both are 20 letters', why: 'Same length, but one has a pattern you can describe much more briefly.' },
          ],
          explain: 'Compression means describing data by its patterns. Twenty identical letters have a two-word description; the jumble has none shorter than itself.',
        },
        {
          kind: 'read',
          title: 'Run-length encoding',
          body: 'One simple compressor: replace each **run** of the same symbol by its length and the symbol. Good for images with big flat areas. Step through a row of white (W) and black (B) pixels:',
          widget: () => {
            const row = 'WWWWBBBWWWWWWBW';
            const runs = row.match(/(.)\1*/g) ?? [];
            return stepper(runs.length, (i) => {
              const start = runs.slice(0, i).join('').length, end = start + runs[i].length;
              const px = h('div', { style: 'display:flex;gap:2px;justify-content:center;flex-wrap:wrap;margin:6px 0;' }, [...row].map((c, k) => {
                const on = k >= start && k < end;
                return h('span', { style: `width:19px;height:26px;border-radius:4px;display:grid;place-items:center;font-size:11px;font-weight:700;background:${c === 'W' ? '#f2f2f2' : '#26262b'};color:${c === 'W' ? '#555' : '#ddd'};border:2px solid ${on ? 'var(--c2)' : 'var(--line)'};${k < start ? 'opacity:.4;' : ''}` }, c);
              }));
              return h('div', null, px, h('div', { class: 'readout', style: 'font-size:1.1rem;color:var(--text);' }, rle(runs.slice(0, i + 1).join(''))));
            }, { caption: (i) => i < runs.length - 1 ? `Run ${i + 1}: ${runs[i].length} × ${runs[i][0]} → ${runs[i].length}${runs[i][0]}` : `${row.length} pixels → ${rle(row).length} characters: ${rle(row)}` });
          },
        },
        ask({
          kind: 'fill',
          body: 'Run-length encode this row of pixels.',
          template: 'WWWWWBBBWW → [[0]]',
          blanks: [{ options: [rle('WWWWWBBBWW'), '5W2B3W', '3W5B2W', '5B3W2B'], answer: 0 }],
          hint: 'Count each run: how many W, then how many B, then W again.',
          explain: `Five W, three B, two W: ${rle('WWWWWBBBWW')}.`,
        }),
        ask({
          kind: 'choice',
          body: 'What happens when you run-length encode **ABCDEF**?',
          options: [
            { text: `It doubles in length: ${rle('ABCDEF')}`, correct: true },
            { text: 'It shrinks a little', why: `Every run has length 1, so every letter becomes two characters: ${rle('ABCDEF')}.` },
            { text: 'It stays the same', why: 'Each letter gets a “1” in front of it, so the output is longer.' },
          ],
          explain: 'No runs, no saving: RLE only helps data that has the pattern it looks for. Every compressor makes some inputs longer.',
        }),
        {
          kind: 'read',
          title: 'Short codes for common letters',
          body: 'Text has few long runs, but its letters are very uneven. Morse code used that: E, the most common letter, is a single dot; Q is dash-dash-dot-dash.\n\nGive frequent symbols short codes and rare ones long codes, and the average message gets shorter.',
          widget: () => barChart(ENGLISH.slice(0, 8).map(([l, p]) => ({ label: l, value: p, color: 'var(--c3)' })), { format: (v) => `${v}%`, title: 'Most common letters in English' }),
        },
        ask({
          kind: 'choice',
          body: 'Try a code: A = 0, B = 01, C = 1. You receive **01**. What was sent?',
          options: [
            { text: 'You can’t tell: it could be B or AC', correct: true },
            { text: 'B', why: 'It could also be A (0) followed by C (1). The code is ambiguous.' },
            { text: 'AC', why: 'It could also be B (01). The code is ambiguous.' },
          ],
          explain: 'The codeword for A (0) is the start of the codeword for B (01), so the receiver can’t tell where one letter ends. Fix: no codeword may be the start (prefix) of another, a **prefix-free** code.',
        }),
        {
          kind: 'task',
          title: 'Build a prefix code',
          body: `A 16-letter message has A × 8, B × 4, C × 2, D × 2. A fixed 2-bit code (00, 01, 10, 11) takes ${PREFIX_FIXED} bits. Give each letter a codeword, with no codeword starting another, so the message takes **${PREFIX_BEST} bits or fewer**.`,
          widget: prefixBuilder({ counts: PREFIX_COUNTS, best: PREFIX_BEST, pool: PREFIX_POOL }),
          hint: 'Give A, the most common letter, a 1-bit codeword. Everything else must then start with the other bit.',
          explain: `A = 0, B = 10, C = 110, D = 111: 8×1 + 4×2 + 2×3 + 2×3 = ${PREFIX_BEST} bits. In the tree every letter sits on a leaf, which is what prefix-free means.`,
        },
        {
          kind: 'read',
          title: 'Huffman’s recipe',
          body: `There is a recipe that always finds the best prefix code: keep merging the two **lightest** groups. Each merge puts one more bit in front of every letter inside it. Here it is for ${ABRA}:`,
          widget: () => h('div', null, huffmanSteps(ABRA_COUNTS), codeTree(ABRA_CODES)),
        },
        ask({
          kind: 'number',
          body: `With that code (A = 0, and B, R, C, D get 3-bit codewords), how many bits does **${ABRA}** take? Its letters: ${ABRA_COUNTS.map(([l, n]) => `${l} × ${n}`).join(', ')}.`,
          widget: () => codeTree(ABRA_CODES),
          answer: ABRA_H.total, tol: 0, unit: 'bits',
          hint: 'Multiply each count by its codeword length and add.',
          explain: `5 × 1 + (2 + 2 + 1 + 1) × 3 = ${ABRA_H.total} bits, against ${ABRA_FIXED} for a fixed 3-bit code (5 letters need 3 bits each).`,
        }),
        {
          kind: 'read',
          title: 'Not everything can shrink',
          body: 'Could a clever compressor shrink **every** file? Count. There are 8 files of exactly 3 bits, but only 7 strings shorter than that (counting the empty one). Two files would have to share a compressed version, and then you could not get both back.',
          widget: () => h('div', null, h('div', { class: 'muted small', style: 'text-align:center;' }, '3-bit files (8)'), cells(Array.from({ length: 8 }, (_, i) => toBits(i, 3)), { index: false }),
            h('div', { class: 'muted small', style: 'text-align:center;' }, 'shorter strings (7)'), cells(['∅', '0', '1', '00', '01', '10', '11'], { index: false })),
        },
        ask({
          kind: 'number',
          body: 'There are 16 files of exactly 4 bits. How many bit strings are **shorter** than 4 bits, counting the empty string?',
          answer: 1 + 2 + 4 + 8, tol: 0,
          hint: 'Lengths 0, 1, 2 and 3: 1 + 2 + 4 + 8.',
          explain: '1 + 2 + 4 + 8 = 15, one fewer than 16. Always 2^n − 1 against 2^n: by the pigeonhole principle, any compressor that shrinks some files must grow others.',
        }),
        ask({
          kind: 'sort',
          body: 'Which of these will a good compressor (like zip) shrink a lot?',
          bins: ['Shrinks a lot', 'Barely shrinks'],
          items: [
            { text: 'A spreadsheet that is mostly zeros', bin: 0 }, { text: 'A long English text', bin: 0 }, { text: 'A picture of a clear blue sky', bin: 0 },
            { text: 'A file that is already zipped', bin: 1 }, { text: 'A record of random coin flips', bin: 1 }, { text: 'Well-encrypted data', bin: 1 },
          ],
          hint: 'Compression needs patterns or predictability.',
          explain: 'Zeros, English and flat colour are full of patterns. Zipped files have had their patterns squeezed out already, random flips never had any, and good encryption deliberately looks random.',
        }),
      ],
      practice: [genRLE, genHuffman, genPigeon],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'errors',
      title: 'Catching and fixing errors',
      goal: 'Use parity, check digits and Hamming codes to detect and correct mistakes.',
      steps: [
        {
          kind: 'choice',
          body: 'You send **1011** over a noisy radio link. It arrives as **1001**. How can the receiver tell something went wrong?',
          widget: () => bitRows([{ label: 'sent', bits: '1011' }, { label: 'received', bits: '1001', bad: [2] }]),
          options: [
            { text: 'It can’t, unless you also send some extra checking bits', correct: true },
            { text: '1001 looks wrong, so it can tell', why: '1001 is a perfectly valid 4-bit message. Without extra information every received string looks fine.' },
            { text: 'By asking for the message again and again', why: 'Repeating is one kind of extra information, and a costly one. The point stands: you need redundancy.' },
          ],
          explain: 'If every bit pattern is a valid message, an error just turns one valid message into another. Detection needs **redundancy**: extra bits that follow a rule.',
        },
        {
          kind: 'read',
          title: 'The parity bit',
          body: 'Simplest rule: add one bit so the number of 1s is **even**. 1011 has three 1s, so send **10111**. If any single bit flips, the count becomes odd and the receiver knows.',
          widget: () => bitRows([{ label: 'data + parity bit', bits: '10111', hi: [4] }, { label: 'one bit flipped: three 1s, odd', bits: '10011', bad: [2] }]),
        },
        ask({
          kind: 'number',
          body: `What even-parity bit goes after **${PAR_DATA}**?`,
          widget: () => bits(PAR_DATA + '?', { hi: [7] }),
          answer: parity(PAR_DATA), tol: 0,
          hint: 'Count the 1s.',
          explain: `${PAR_DATA} has ${[...PAR_DATA].filter((c) => c === '1').length} ones, already even, so the parity bit is ${parity(PAR_DATA)}.`,
        }),
        ask({
          kind: 'multi',
          body: 'Each 5-bit word below was sent with even parity. Which ones certainly arrived damaged?',
          options: [
            { text: '10101', correct: true },
            { text: '00001', correct: true },
            { text: '01110', correct: true },
            { text: '11000', why: 'Two 1s: even, so the check passes.' },
            { text: '11110', why: 'Four 1s: even, so the check passes.' },
          ],
          hint: 'An odd number of 1s means the rule was broken.',
          explain: '10101, 00001 and 01110 have an odd number of 1s (3, 1, 3), so something flipped. The others pass, which means “no single error”, not “certainly correct”.',
        }),
        ask({
          kind: 'choice',
          body: 'Parity catches one flipped bit. What if **two** bits flip?',
          widget: () => bitRows([{ label: 'sent', bits: '10111' }, { label: 'two flips: four 1s, even', bits: '00101', bad: [0, 3] }]),
          options: [
            { text: 'The error slips through: the count is even again', correct: true },
            { text: 'It is caught twice as easily', why: 'Each flip changes the count of 1s by one, so two flips return it to even. The check passes.' },
            { text: 'Parity also tells you which bits flipped', why: 'A single parity bit only says even or odd. It can’t point at a position, even for one flip.' },
          ],
          explain: 'One parity bit detects any odd number of flips and misses any even number. Stronger codes add more check bits.',
        }),
        {
          kind: 'read',
          title: 'Check digits',
          body: `The same idea guards numbers typed by people. An ISBN-10 book number ends in a **check digit**: multiply the ten digits by 10, 9, …, 1 and the total must be divisible by 11.\n\nIt catches any single wrong digit, and any swap of two neighbouring digits, the two commonest typing mistakes. (Credit cards use a similar rule, the Luhn check.)`,
          widget: () => h('div', null, bits(ISBN9.join('') + '?', { labels: Array.from({ length: 10 }, (_, i) => `×${10 - i}`), hi: [9], size: 26 }),
            h('div', { class: 'readout' }, `${ISBN9.map((d, i) => `${d}×${10 - i}`).join(' + ')} + ?×1`),
            h('div', { class: 'muted small', style: 'text-align:center;' }, 'digit × weight, added up, must be a multiple of 11')),
        },
        ask({
          kind: 'number',
          body: `The first nine digits of an ISBN are **${ISBN9.join('')}**. The weighted sum of those nine is ${ISBN9.reduce((a, d, i) => a + d * (10 - i), 0)}. What check digit (0 to 10, where 10 is written X) makes the total divisible by 11?`,
          answer: ISBN_CHECK, tol: 0,
          hint: `What must you add to ${ISBN9.reduce((a, d, i) => a + d * (10 - i), 0)} to reach a multiple of 11?`,
          explain: `${ISBN9.reduce((a, d, i) => a + d * (10 - i), 0)} + ${ISBN_CHECK} = ${ISBN9.reduce((a, d, i) => a + d * (10 - i), 0) + ISBN_CHECK} = 11 × ${(ISBN9.reduce((a, d, i) => a + d * (10 - i), 0) + ISBN_CHECK) / 11}. The full ISBN is ${ISBN9.join('')}${ISBN_CHECK}.`,
        }),
        {
          kind: 'read',
          title: 'Fixing, not just finding',
          body: 'Detecting an error means asking for a resend. Sometimes you can’t (a scratched disc, a probe near Jupiter). Crude fix: send every bit **three times** and take a majority vote. One flip per group gets outvoted.',
          widget: () => bitRows([{ label: 'send 1 0 1', bits: '111000111', group: 3 }, { label: 'received: majority still reads 1 0 1', bits: '101000111', bad: [1], group: 3 }]),
        },
        ask({
          kind: 'fill',
          body: `A triple-repetition message arrives as **${REP_GOT.join(' ')}**. Decode each group by majority vote.`,
          template: REP_GOT.map((g, i) => `${g} → [[${i}]]`).join('   '),
          blanks: REP_DEC.map((d) => ({ options: ['0', '1'], answer: Number(d) })),
          hint: 'Whichever bit appears at least twice in a group wins.',
          explain: `${REP_GOT.map((g, i) => `${g} → ${REP_DEC[i]}`).join(', ')}. The message is ${REP_DEC.join('')}.`,
        }),
        {
          kind: 'task',
          title: 'Find the flipped bit',
          body: 'Smarter: arrange data in a grid with a parity bit on every row and every column. One bit of this block flipped in transit. **Tap it.**',
          widget: parityGrid({ data: PAR_GRID, flip: PAR_FLIP }),
          hint: 'Find the one row and the one column that fail their checks.',
          explain: `Only row ${PAR_FLIP[0] + 1} and column ${PAR_FLIP[1] + 1} fail, so the culprit is where they cross: row ${PAR_FLIP[0] + 1}, column ${PAR_FLIP[1] + 1}. Flip it back and every check passes.`,
        },
        {
          kind: 'read',
          title: 'Hamming(7,4)',
          body: 'Richard Hamming found a tighter design: 4 data bits plus 3 check bits. Number the positions 1 to 7. Check 1 covers positions 1, 3, 5, 7; check 2 covers 2, 3, 6, 7; check 4 covers 4, 5, 6, 7 (each position is in the checks that add up to it: 6 = 2 + 4).\n\nIf one bit flips, **add up the failing checks** and you get its position.',
          widget: () => stepper(3, (i) => {
            const pos = i === 0 ? [] : i === 1 ? [HAM_ERR - 1] : [];
            const word = i === 0 ? HAM_SENT : HAM_GOT;
            return h('div', null, bits(word.join(''), { labels: ['1', '2', '3', '4', '5', '6', '7'], bad: pos, good: i === 2 ? [HAM_ERR - 1] : [], size: 32 }),
              i === 2 ? h('div', { class: 'readout' }, [1, 2, 4].map((p) => `check ${p}: ${checkSets[p as 1 | 2 | 4].reduce((a, q) => a ^ HAM_GOT[q - 1], 0) ? 'fails' : 'ok'}`).join(' · ')) : null);
          }, { caption: (i) => [`Sent: data ${HAM_DATA.join('')} in positions 3, 5, 6, 7; check bits in 1, 2, 4.`, `Position ${HAM_ERR} flips in transit.`, `Checks 2 and 4 fail: 2 + 4 = ${HAM_FOUND}. Flip position ${HAM_FOUND} back.`][i] }),
        },
        ask({
          kind: 'number',
          body: 'A Hamming(7,4) word arrives as **1010110**. Check 1 (positions 1,3,5,7) has 1s at positions 1, 3, 5. Check 2 (2,3,6,7) has 1s at positions 3, 6. Check 4 (4,5,6,7) has 1s at 5, 6. Which position flipped?',
          widget: () => bits('1010110', { labels: ['1', '2', '3', '4', '5', '6', '7'], size: 30 }),
          answer: syndrome([1, 0, 1, 0, 1, 1, 0]), tol: 0,
          hint: 'Which checks have an odd number of 1s? Add their names.',
          explain: `Check 1 has three 1s (fails), check 2 has two (ok), check 4 has two (ok). Only check 1 fails, so position ${syndrome([1, 0, 1, 0, 1, 1, 0])} flipped.`,
        }),
        ask({
          kind: 'match',
          body: 'Match each method to what it does.',
          heads: ['Method', 'What it does'],
          pairs: [
            ['One parity bit', 'Detects one flipped bit'],
            ['ISBN check digit', 'Catches a swapped pair of digits'],
            ['Hamming(7,4)', 'Fixes one flip with 3 extra bits'],
            ['Triple repetition', 'Fixes one flip per bit, tripling the length'],
          ],
          explain: 'Parity detects, check digits target human typos, and Hamming and repetition both correct, but Hamming spends 3 extra bits per 4 where repetition spends 8.',
        }),
        ask({
          kind: 'order',
          body: 'To send 4 data bits, how many bits in total does each scheme transmit? Order from fewest to most.',
          items: ['One parity bit (5)', 'Hamming(7,4) (7)', '2 × 2 grid with row and column parity (8)', 'Triple repetition (12)'],
          explain: '4 + 1 = 5, 4 + 3 = 7, 4 + 2 + 2 = 8, 4 × 3 = 12. Hamming corrects single errors as well as repetition does, for far fewer bits.',
        }),
      ],
      practice: [genParity, genISBN, genHamming],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'ciphers',
      title: 'Classical ciphers',
      goal: 'Encrypt with Caesar and substitution ciphers, then break them.',
      steps: [
        {
          kind: 'choice',
          body: `Every letter of a message was moved forward the same number of places in the alphabet. The result is **${caesar('HELLO', 3)}**. What was the message?`,
          options: [
            { text: 'HELLO', correct: true, why: 'Each letter moved back 3: K→H, H→E, O→L, R→O.' },
            { text: caesar('HELLO', 6), why: 'That moves the letters further forward. To decrypt, shift back.' },
            { text: 'You can’t know without the key', why: 'There are only 25 possible shifts. Try them and only one gives a real word.' },
          ],
          explain: `Shift each letter of ${caesar('HELLO', 3)} back by 3: HELLO. This is the **Caesar cipher**, used by Julius Caesar with a shift of 3.`,
        },
        {
          kind: 'read',
          title: 'The Caesar cipher',
          body: 'Pick a shift k. Encrypt by moving each letter k places forward (Z wraps round to A); decrypt by moving k back. The wheel shows shift 3: find a plain letter on the outer ring, read its cipher letter inside.',
          widget: () => h('div', { class: 'plot-wrap' }, cipherWheel(3, { size: 270 })),
        },
        {
          kind: 'task',
          title: 'Turn the wheel',
          body: 'This message was Caesar-encrypted with an unknown shift. Turn the wheel until it reads as English.',
          widget: caesarTask({ cipher: CAESAR_CIPHER, key: CAESAR_KEY }),
          hint: 'Watch short words. A one-letter word or a common word like THE will pop out first.',
          explain: `The shift is ${CAESAR_KEY}: ${CAESAR_CIPHER} decrypts to ${CAESAR_PLAIN}.`,
        },
        ask({
          kind: 'fill',
          body: 'Encrypt **DOG** with shift 3.',
          widget: () => h('div', { class: 'plot-wrap' }, cipherWheel(3, { size: 220 })),
          template: 'DOG → [[0]]',
          blanks: [{ options: [caesar('DOG', 3), caesar('DOG', -3), caesar('DOG', 4)], answer: 0 }],
          hint: 'D + 3 = G.',
          explain: `D→G, O→R, G→J: ${caesar('DOG', 3)}. (${caesar('DOG', -3)} is shifting backwards.)`,
        }),
        ask({
          kind: 'number',
          body: 'A Caesar cipher has 26 possible shifts, but one of them leaves the message unchanged. How many useful keys does an attacker have to try?',
          answer: 25, tol: 0, unit: 'keys',
          explain: 'Shifts 1 to 25 (shift 0, or 26, does nothing). A patient person tries all 25 in minutes. A key you can try exhaustively protects nothing.',
        }),
        {
          kind: 'read',
          title: 'Substitution: a huge key space',
          body: `A **substitution cipher** scrambles the alphabet any way at all: A might become Q, B become W, and so on. The key is the whole scrambled alphabet, and there are 26! ≈ ${fmtBig(FACT26)} of them. Trying them all would take longer than the age of the universe.\n\nSo is it safe?`,
          widget: () => h('div', { style: 'display:grid;gap:10px;justify-content:center;' }, [0, 13].map((s0) =>
            h('div', { style: 'display:grid;grid-template-columns:auto repeat(13, 21px);gap:2px;align-items:center;font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;text-align:center;' },
              h('span', { class: 'muted small', style: 'font-family:inherit;padding-right:4px;' }, 'plain'), [...ALPHA.slice(s0, s0 + 13)].map((c) => h('span', null, c)),
              h('span', { class: 'muted small', style: 'font-family:inherit;padding-right:4px;' }, 'cipher'), [...SUB_KEY.slice(s0, s0 + 13)].map((c) => h('span', { style: 'color:var(--c6);background:var(--panel2);border-radius:4px;' }, c))))),
        },
        {
          kind: 'read',
          title: 'Letters leave fingerprints',
          body: 'No. A substitution changes the letters’ names but not their **frequencies**. In English, E is about 13% of letters, T about 9%. Whatever E became, that cipher letter will still be about 13% of the ciphertext.\n\nThis is **frequency analysis**, described by al-Kindi in the 9th century.',
          widget: () => barChart(ENGLISH.map(([l, p]) => ({ label: l, value: p, color: 'var(--c3)' })), { format: (v) => `${v}%`, title: 'English letter frequency' }),
        },
        ask({
          kind: 'number',
          body: `A Caesar ciphertext: **${FREQ_CIPHER}**. Its most common letter is ${FREQ_TOP}. If ${FREQ_TOP} stands for E, what is the shift?`,
          widget: () => freqChart(FREQ_CIPHER, { top: 6, title: 'Letters in the ciphertext' }),
          answer: FREQ_KEY, tol: 0,
          hint: `Count forward from E to ${FREQ_TOP}.`,
          explain: `E is letter 4 (A = 0) and ${FREQ_TOP} is letter ${ALPHA.indexOf(FREQ_TOP)}: shift ${FREQ_KEY}. Shifting back gives ${FREQ_PLAIN}.`,
        }),
        {
          kind: 'task',
          title: 'Break a substitution cipher',
          body: 'This short message was encrypted with a substitution cipher. Use the frequencies and common words to recover it: tap a cipher letter, then the plain letter you think it stands for.',
          widget: subSolver({ cipher: SUB_CIPHER, plain: SUB_PLAIN }),
          hint: 'The most common cipher letter is probably E. A three-letter word ending in E is probably THE.',
          explain: `${SUB_CIPHER} is ${SUB_PLAIN}. ${letterCounts(SUB_CIPHER).map(([c]) => `${c}=${SUB_PLAIN[SUB_CIPHER.indexOf(c)]}`).join(', ')}. The commonest letter is E; then THE and TREE fall out.`,
        },
        ask({
          kind: 'multi',
          body: 'Which clues help break a substitution cipher on an English message?',
          options: [
            { text: 'How often each cipher letter appears', correct: true },
            { text: 'Common short words like THE, AND, OF', correct: true },
            { text: 'Doubled letters such as EE, LL, SS', correct: true },
            { text: 'Trying every possible key', why: `There are about ${fmtBig(FACT26)} keys: far too many. Frequency analysis is what makes the attack feasible.` },
            { text: 'Nothing: 26! keys make it unbreakable', why: 'A big key space is necessary, not sufficient. The cipher leaks the structure of the language.' },
          ],
          explain: 'A substitution cipher preserves patterns: frequencies, word shapes, doubled letters. Each one narrows the key down, letter by letter, without trying keys one at a time.',
        }),
        ask({
          kind: 'choice',
          body: 'An inventor says: “My cipher is secure because nobody knows how it works.” What is the standard reply?',
          options: [
            { text: 'Assume the enemy knows the method; only the key should be secret', correct: true },
            { text: 'Good: secret methods are the strongest', why: 'Methods leak: software gets copied, devices get captured, insiders talk. Once it leaks, a secret-method cipher has no protection left.' },
            { text: 'Fine, as long as the method is complicated', why: 'Complexity hides weaknesses from the designer as well. Ciphers earn trust by surviving public attack.' },
          ],
          explain: 'This is **Kerckhoffs’s principle** (1883): a system should stay secure even if everything except the key is public. Modern ciphers are published and attacked openly; the key is the only secret.',
        }),
      ],
      practice: [genCaesarEnc, genCaesarKey, genFreqKey],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'keys',
      title: 'Keys and brute force',
      goal: 'Size a key space, and see why each extra bit doubles an attacker’s work.',
      steps: [
        {
          kind: 'choice',
          body: 'A bike lock has 4 dials, each 0 to 9. A thief tries one combination per second. In the worst case, how long until it opens?',
          widget: () => bits('????', { labels: ['0–9', '0–9', '0–9', '0–9'], size: 40 }),
          options: [
            { text: 'About 2.8 hours', correct: true },
            { text: '40 seconds', why: 'That would be 4 × 10, as if you could set each dial separately and hear it click. Combinations multiply: 10 × 10 × 10 × 10.' },
            { text: 'About 11 days', why: 'That is a million seconds, for 6 dials. Four dials give 10,000 combinations.' },
          ],
          explain: '10 × 10 × 10 × 10 = 10,000 combinations, 10,000 seconds ≈ 2.8 hours. Fine against a passer-by, not against a patient thief.',
        },
        {
          kind: 'read',
          title: 'Key spaces multiply',
          body: 'The **key space** is the number of possible keys. With L positions and N choices each, it is N^L. Computers use bits, so a k-bit key has 2^k possibilities, and **each extra bit doubles** the work of trying them all.',
          widget: () => columnChart(Array.from({ length: 8 }, (_, i) => ({ label: `${i + 1} bit${i ? 's' : ''}`, value: 2 ** (i + 1), color: 'var(--c1)' })), { height: 180 }),
        },
        ask({
          kind: 'number',
          body: 'How many different keys does a **10-bit** key have?',
          widget: () => bits('??????????', { size: 26 }),
          answer: 1024, tol: 0, unit: 'keys',
          explain: '2^10 = 1,024. A computer tries that many in well under a millisecond.',
        }),
        ask({
          kind: 'match',
          body: 'Match each key to the size of its key space.',
          heads: ['Key', 'Possible keys'],
          pairs: [['3 coin flips', '8'], ['2 lowercase letters', '676'], ['4-digit PIN', '10,000'], ['20 bits', '1,048,576']],
          hint: 'Choices to the power of the length.',
          explain: '2^3 = 8, 26^2 = 676, 10^4 = 10,000, 2^20 = 1,048,576.',
        }),
        ask({
          kind: 'number',
          body: 'Trying every **40-bit** key takes a computer one day. How many days for every **50-bit** key?',
          widget: () => columnChart([40, 41, 42, 43, 44].map((b) => ({ label: `${b} bits`, value: 2 ** (b - 40), color: 'var(--c1)' })), { format: (v) => `${v} d`, height: 150 }),
          answer: 2 ** 10, tol: 0, unit: 'days',
          hint: 'Ten extra bits, each doubling.',
          explain: '2^10 = 1,024 times as many keys: 1,024 days, nearly three years. Ten bits added, a thousand times the work.',
        }),
        ask({
          kind: 'estimate',
          body: 'An old cipher standard used **56-bit** keys. At a billion (10^9) keys per second, roughly how many years to try them all?',
          min: 0, max: 10, step: 0.1, answer: DES_YEARS, tol: 0.4, format: (v) => `${v.toFixed(1)} years`,
          hint: '2^56 ≈ 7.2 × 10^16. A year is about 3.2 × 10^7 seconds.',
          explain: `2^56 ≈ 7.2 × 10^16 keys ÷ 10^9 per second ≈ 7.2 × 10^7 s ≈ ${DES_YEARS} years. Special hardware did it in days by 1998, which is why 56 bits was retired.`,
        }),
        ask({
          kind: 'point',
          body: 'Since 2^10 ≈ 1,000, place the number of bits that gives about **a billion** (10^9) possible keys.',
          plot: { x: [0, 40], ticks: [5], xlabel: 'key length (bits)' },
          answer: { x: 30 }, tol: 0.5, snap: 1,
          hint: 'A billion is 1,000 × 1,000 × 1,000.',
          explain: '10^9 = 1,000^3 ≈ (2^10)^3 = 2^30. So 30 bits (2^30 = 1,073,741,824).',
        }),
        {
          kind: 'read',
          title: 'Passwords have bits too',
          body: 'If each character of a password is chosen **at random** from N symbols, each adds log₂N bits. A random 8-letter lowercase password: 8 × log₂26 ≈ 37.6 bits.\n\nThe catch is *at random*. People pick names, words and dates, and attackers try those first, so a human-chosen password has far fewer bits than its length suggests.',
          widget: () => barChart([['4-digit PIN', 4 * log2(10)], ['8 lowercase', 8 * log2(26)], ['4 random words', 4 * log2(7776)], ['12 of 94 chars', 12 * log2(94)]].map(([l, v]) => ({ label: l as string, value: v as number, color: 'var(--c4)' })), { format: (v) => `${r1(v)} bits` }),
        },
        ask({
          kind: 'order',
          body: 'Order these randomly generated secrets by entropy, weakest first.',
          items: ['A 4-digit PIN', '6 random lowercase letters', '4 random words from a 7,776-word list', '10 random printable characters (94)', 'A random 128-bit key'],
          hint: 'Bits = length × log₂(choices).',
          explain: `${r1(4 * log2(10))}, ${r1(6 * log2(26))}, ${r1(4 * log2(7776))}, ${r1(10 * log2(94))} and 128 bits.`,
        }),
        ask({
          kind: 'multi',
          body: 'Assume the attacker knows how you make passwords. Which make yours harder to brute-force?',
          options: [
            { text: 'Making it longer', correct: true },
            { text: 'Picking each character at random from a bigger set', correct: true },
            { text: 'Letting a random generator choose instead of you', correct: true },
            { text: 'Writing a dictionary word with @ for a and 0 for o', why: 'Attackers’ word lists include these swaps. It adds only a few bits.' },
            { text: 'Using your pet’s name and birth year', why: 'Personal facts are guessable and often public. They add very few bits against a targeted attacker.' },
          ],
          explain: 'Entropy comes from randomness and length. Clever-looking human tricks are predictable, so they add little.',
        }),
        ask({
          kind: 'sort',
          body: 'By how much does each change multiply an attacker’s brute-force work?',
          bins: ['× 2', '× 26', '× 1,024'],
          items: [
            { text: 'One more key bit', bin: 0 }, { text: 'Randomly making one letter upper or lower case', bin: 0 },
            { text: 'One more random lowercase letter', bin: 1 }, { text: 'One more random capital letter', bin: 1 },
            { text: 'Ten more key bits', bin: 2 }, { text: 'Two more random 32-way choices', bin: 2 },
          ],
          hint: 'Multiply the number of options each change adds.',
          explain: 'A bit or a random case choice: 2 options. A random letter: 26. Ten bits: 2^10 = 1,024, and 32 × 32 = 1,024 too.',
        }),
        ask({
          kind: 'number',
          body: 'A passphrase is **4 words** picked at random from a list of **2,048** words. How many bits of entropy?',
          answer: 4 * log2(2048), tol: 0.01, unit: 'bits',
          hint: '2,048 = 2^11.',
          explain: 'Each word is log₂2048 = 11 bits; four words: 44 bits (2^44 ≈ 17.6 trillion combinations).',
        }),
        ask({
          kind: 'choice',
          body: 'Modern ciphers use 128-bit keys. Suppose an attacker could try 10^18 keys every second. Roughly how long to try them all?',
          options: [
            { text: 'About 10^13 years, a thousand times the age of the universe', correct: true },
            { text: 'About a year', why: '2^128 ≈ 3.4 × 10^38. Divided by 10^18 per second that is 3.4 × 10^20 seconds, around 10^13 years.' },
            { text: 'A few minutes', why: 'Doubling 128 times makes an astronomically large number; no speed-up of today’s computers comes close.' },
          ],
          explain: `2^128 ≈ 3.4 × 10^38 keys ÷ 10^18 per second ≈ 3.4 × 10^20 s ≈ ${fmtBig(Math.round(2 ** 128 / 1e18 / 3.15576e7))} years. Real attacks look for flaws or stolen keys, not brute force.`,
        }),
      ],
      practice: [genKeySpace, genDoubling, genPassBits],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'hashing',
      title: 'One-way functions and hashing',
      goal: 'Recognise one-way functions, and use hashes as fingerprints.',
      steps: [
        {
          kind: 'choice',
          body: 'Which is quicker to do by hand?',
          options: [
            { text: 'Work out 37 × 61', correct: true, why: 'A few minutes of long multiplication: 2,257.' },
            { text: 'Find the two primes that multiply to 2,257', why: 'You have to try divisor after divisor (2, 3, 5, 7, …) until one works. Much slower, even though it is the same fact backwards.' },
            { text: 'They take the same effort', why: 'They are the same fact, but finding it backwards means searching.' },
          ],
          explain: '37 × 61 = 2,257. Forwards is a recipe; backwards is a search. Functions that are easy one way and hard the other are the raw material of cryptography.',
        },
        {
          kind: 'read',
          title: 'One-way functions',
          widget: () => dataTable(['Input', 'Toy hash'], ['a', 'hello', 'Hello', 'The whole of a long book…'].map((w) => [`"${w}"`, hex4(toyHash(w))]), { caption: 'Any input, a 16-bit fingerprint (4 hex digits)' }),
          body: 'A **one-way function** is easy to compute but hard to undo. Everyday picture: mixing paint, or a phone book (name → number is a quick lookup, number → name means reading the whole book).\n\nA **hash function** is a one-way function that turns any input, of any length, into a short fixed-size **fingerprint**.',
        },
        {
          kind: 'read',
          title: 'A toy hash to play with',
          body: 'Here is a **toy** 16-bit hash, made for this course (it scrambles the input’s characters, then folds the result to 16 bits). It is far too small to be secure; real hashes such as SHA-256 output 256 bits.\n\nType in either box and compare the fingerprints. Try changing a single letter.',
          widget: avalanche('hello', 'hellp'),
        },
        ask({
          kind: 'number',
          body: 'The toy hash outputs 16 bits. How many different fingerprints can it produce?',
          widget: () => bits('?'.repeat(16), { group: 4, size: 17 }),
          answer: HASH_OUT, tol: 0, unit: 'outputs',
          explain: `2^16 = ${HASH_OUT.toLocaleString('en-US')}. That is tiny: a computer can try that many inputs in a blink.`,
        }),
        ask({
          kind: 'choice',
          body: `There are endless possible inputs but only ${HASH_OUT.toLocaleString('en-US')} toy-hash outputs. What follows?`,
          options: [
            { text: 'Some different inputs must share a fingerprint', correct: true },
            { text: 'The hash must be broken', why: 'Every hash has collisions; a good one makes them infeasible to find. The toy one is weak because 16 bits is so few.' },
            { text: 'Nothing: each input still gets its own output', why: `Pigeonhole: more inputs than ${HASH_OUT.toLocaleString('en-US')} outputs means some outputs are shared.` },
          ],
          explain: 'Pigeonhole again: collisions always exist. Security means nobody can **find** one, which needs a large output (256 bits).',
        }),
        {
          kind: 'read',
          title: 'The avalanche effect',
          body: 'Changing one letter changes about **half** the output bits, in an unpredictable pattern. So similar inputs give unrelated fingerprints, and the fingerprint gives no hint which way to adjust the input.',
          widget: () => {
            const ws = ['cat', 'bat', 'cap', 'cat.'];
            const base = toBits(toyHash(ws[0]), 16);
            return h('div', null, ws.map((w) => {
              const b = toBits(toyHash(w), 16);
              const diff = [...b].map((c, i) => (c !== base[i] ? i : -1)).filter((i) => i >= 0);
              return h('div', { style: 'display:grid;justify-items:center;' },
                h('div', { class: 'muted small' }, `"${w}" → ${hex4(toyHash(w))}${w === ws[0] ? '' : ` · ${diff.length} bits differ from "cat"`}`), bits(b, { group: 4, size: 17, bad: diff }));
            }));
          },
        },
        ask({
          kind: 'estimate',
          body: 'For a good 16-bit hash, change one letter of the input. On average, how many of the 16 output bits change?',
          min: 0, max: 16, step: 1, answer: 8, tol: 1, format: (v) => `${v} bits`,
          hint: 'Each output bit should look like a fresh coin flip.',
          explain: 'Each bit flips with probability ½, so on average 16 × ½ = 8 change. Fewer would mean the output leaks how similar the inputs were.',
        }),
        ask({
          kind: 'multi',
          body: 'Which properties should a cryptographic hash have?',
          options: [
            { text: 'The same input always gives the same output', correct: true },
            { text: 'A tiny change to the input scrambles the output', correct: true },
            { text: 'Given an output, finding an input for it is infeasible', correct: true },
            { text: 'With the right key you can turn the output back into the input', why: 'That describes encryption. A hash has no key and no way back; it throws information away.' },
            { text: 'Similar inputs give similar outputs', why: 'That would leak information about the input. A good hash does the opposite (avalanche).' },
          ],
          explain: 'Deterministic, avalanche, and one-way (plus: hard to find any two inputs with the same output).',
        }),
        {
          kind: 'task',
          title: 'Mine a block',
          body: `Hard backwards means the only way to hit a target is trial and error. Find a nonce (a number to append) so that the toy hash of “${MINE_TEXT}” + nonce **starts with ${MINE_ZEROS} zero bits**.`,
          widget: miner({ text: MINE_TEXT, zeros: MINE_ZEROS, max: MINE_MAX }),
          hint: `Each try has about a 1 in ${2 ** MINE_ZEROS} chance. Keep stepping the slider.`,
          explain: `Nonces that work in 0 to ${MINE_MAX}: ${MINE_SOLS.join(', ')}. For example “${MINE_TEXT}${MINE_SOLS[0]}” hashes to ${hex4(toyHash(MINE_TEXT + MINE_SOLS[0]))}. Bitcoin-style proof of work is this, with far more zero bits.`,
        },
        ask({
          kind: 'number',
          body: 'Real proof of work asks for many more zero bits. With a good hash, how many tries does it take on average to find a hash starting with **20** zero bits?',
          widget: () => bits('0'.repeat(20) + '?'.repeat(12), { group: 4, size: 17, good: Array.from({ length: 20 }, (_, i) => i) }),
          answer: 2 ** 20, tol: 0, unit: 'tries',
          hint: 'Each try succeeds with probability 1/2^20.',
          explain: '2^20 = 1,048,576 tries on average, and checking someone’s answer takes one hash. That asymmetry is the point.',
        }),
        ask({
          kind: 'match',
          body: 'Match each use of hashing to why it works.',
          heads: ['Use', 'Why a hash helps'],
          pairs: [
            ['Storing passwords', 'The server keeps only fingerprints'],
            ['Checking a download', 'Any change gives a different fingerprint'],
            ['Proof of work', 'Rare outputs cost many tries to find'],
            ['Finding duplicate files', 'Equal files give equal fingerprints'],
          ],
          explain: 'Each use leans on a different property: one-wayness, avalanche, unpredictability, and determinism. (Real password storage also adds a random salt and a deliberately slow hash.)',
        }),
        ask({
          kind: 'sort',
          body: 'With big numbers and a good hash, which tasks are easy and which are infeasible?',
          bins: ['Easy', 'Infeasible'],
          items: [
            { text: 'Multiply two large primes', bin: 0 }, { text: 'Hash a file', bin: 0 }, { text: 'Check that an input matches a fingerprint', bin: 0 },
            { text: 'Factor the product of two large primes', bin: 1 }, { text: 'Find an input with a given fingerprint', bin: 1 }, { text: 'Find two files with the same 256-bit fingerprint', bin: 1 },
          ],
          hint: 'Forwards and checking are easy; going backwards is the hard part.',
          explain: 'Computing and checking are fast. Undoing (factoring, inverting a hash, finding a collision) means searching an astronomically large space.',
        }),
        ask({
          kind: 'choice',
          body: `Hash random inputs with the toy 16-bit hash. Roughly how many before two of them probably share a fingerprint?`,
          options: [
            { text: `About ${BDAY}`, correct: true },
            { text: 'About 32,768', why: 'That is half the outputs: roughly the work to hit one particular fingerprint. Any matching pair turns up much sooner, like shared birthdays.' },
            { text: '65,537', why: 'That many guarantees a collision (pigeonhole), but one becomes likely far earlier.' },
          ],
          explain: `The birthday effect: with k inputs there are about k²/2 pairs, each matching with chance 1/65,536. A collision becomes likely around √(2 ln2 × 65,536) ≈ ${BDAY}. That is why real hashes need 256 bits: about 2^128 tries to find a collision.`,
        }),
      ],
      practice: [genOutputs, genAvalanche, genMine],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'publickey',
      title: 'Public-key ideas',
      goal: 'See how two strangers agree a secret in public, with toy Diffie–Hellman and RSA.',
      steps: [
        {
          kind: 'choice',
          body: 'You want a friend to post you a secret. Every letter is opened and read by a snoop, and you have never met to agree a key. Can it be done?',
          options: [
            { text: 'Yes: post them an open padlock that only you have the key to', correct: true, why: 'They lock the box with your padlock and post it back. The snoop sees an open padlock, then a locked box, and can open neither.' },
            { text: 'No: any key you post, the snoop copies', why: 'True if you post a key. Post a padlock instead: anyone can snap it shut, only your key opens it.' },
            { text: 'Only if you invent a secret code nobody knows', why: 'Kerckhoffs: assume the snoop knows your method. The trick has to work in full view.' },
          ],
          explain: 'This is the idea of **public-key cryptography**: the locking part (public key) can be given to anyone; the unlocking part (private key) never leaves you.',
        },
        {
          kind: 'read',
          title: 'Mixing paint in public',
          body: 'A second trick, **Diffie–Hellman** (1976), lets two people build a shared secret in public. The picture: mixing paint is easy, unmixing it is hard. Step through it.',
          widget: () => paintMix(),
        },
        ask({
          kind: 'order',
          body: 'Put the paint-mixing exchange in order.',
          items: ['Agree a public starting colour', 'Each secretly picks a private colour', 'Each mixes their private colour into the public one and sends it', 'Each adds their own private colour to the mix they received', 'Both now hold the same colour'],
          explain: 'Public colour, private colours, swap mixtures, add your own secret again. Both end with start + Alice’s + Bob’s colour; the eavesdropper never sees either secret alone.',
        }),
        {
          kind: 'read',
          title: 'Clock arithmetic',
          body: `Numbers can do the unmixing-is-hard trick. Work **mod p**: on a clock with p positions, keep only the remainder after dividing by p. Here are the powers of ${CLOCK_G} mod ${CLOCK_P}: each step multiplies by ${CLOCK_G} and wraps round the clock. They jump around without an obvious pattern.`,
          widget: () => powerSteps(CLOCK_G, CLOCK_P, CLOCK_P - 1),
        },
        ask({
          kind: 'number',
          body: `What is **${CLOCK_G}^4 mod ${CLOCK_P}**?`,
          widget: () => h('div', { class: 'plot-wrap' }, modClock(CLOCK_P, [], { size: 200 })),
          answer: modPow(CLOCK_G, 4, CLOCK_P), tol: 0,
          hint: `${CLOCK_G}^4 = ${CLOCK_G ** 4}. Divide by ${CLOCK_P} and keep the remainder.`,
          explain: `${CLOCK_G ** 4} = ${CLOCK_P} × ${Math.floor(CLOCK_G ** 4 / CLOCK_P)} + ${modPow(CLOCK_G, 4, CLOCK_P)}, so ${CLOCK_G}^4 mod ${CLOCK_P} = ${modPow(CLOCK_G, 4, CLOCK_P)}.`,
        }),
        {
          kind: 'task',
          title: 'Unmix it',
          body: `Going forwards is easy. Now go backwards: find x so that **${DL.g}^x mod ${DL.p} = ${DL_T}**.`,
          widget: dlogTask({ g: DL.g, p: DL.p, target: DL_T }),
          hint: 'There is no neat formula: try exponents.',
          explain: `x = ${DL.x}: ${DL.g}^${DL.x} mod ${DL.p} = ${DL_T}. With a 17-position clock you can try everything. With a prime hundreds of digits long, nobody knows a fast way: this is the **discrete logarithm** problem.`,
        },
        {
          kind: 'read',
          title: 'Diffie–Hellman with numbers',
          body: `Public: a prime p = ${DH.p} and a base g = ${DH.g}. Alice picks a secret a = ${DH.a} and sends A = g^a mod p = **${DH_A}**. Bob picks b = ${DH.b} and sends B = g^b mod p = **${DH_B}**.\n\nAlice computes B^a mod p; Bob computes A^b mod p. Both equal g^(ab) mod p. An eavesdropper sees p, g, A and B, and would have to undo a power to get a or b.`,
          widget: () => dataTable(['', 'Alice', 'Bob'], [['secret', `a = ${DH.a}`, `b = ${DH.b}`], ['sends', `A = ${DH_A}`, `B = ${DH_B}`], ['computes', `${DH_B}^${DH.a} mod ${DH.p}`, `${DH_A}^${DH.b} mod ${DH.p}`]], { caption: `public: p = ${DH.p}, g = ${DH.g}, A and B` }),
        },
        ask({
          kind: 'number',
          body: `Finish the exchange: what is Alice’s shared key, **${DH_B}^${DH.a} mod ${DH.p}**?`,
          answer: DH_KEY, tol: 0,
          hint: `Square ${DH_B} mod ${DH.p}, then keep multiplying by ${DH_B}, reducing each time.`,
          explain: `Powers of ${DH_B} mod ${DH.p}: ${Array.from({ length: DH.a }, (_, k) => modPow(DH_B, k + 1, DH.p)).join(', ')}. So the key is ${DH_KEY}. Bob gets the same: ${DH_A}^${DH.b} mod ${DH.p} = ${modPow(DH_A, DH.b, DH.p)}.`,
        }),
        {
          kind: 'read',
          title: 'RSA: a padlock made of primes',
          body: `RSA (1977) builds the padlock. A toy key: primes p = ${RSA.p} and q = ${RSA.q}, so n = ${RSA.n}. Public exponent e = ${RSA.e}. The private exponent d = ${RSA.d} is chosen so that e × d leaves remainder 1 when divided by (p−1)(q−1) = ${RSA.phi}: ${RSA.e} × ${RSA.d} = ${RSA.e * RSA.d} = ${RSA.phi} × ${Math.floor((RSA.e * RSA.d) / RSA.phi)} + 1.\n\nEncrypt: c = m^e mod n. Decrypt: m = c^d mod n. Finding d needs p and q, which means **factoring n**.`,
          widget: () => dataTable(['Part', 'Value', 'Who knows it'], [['n = p × q', String(RSA.n), 'everyone'], ['e', String(RSA.e), 'everyone'], ['p, q', `${RSA.p}, ${RSA.q}`, 'owner only'], ['d', String(RSA.d), 'owner only']]),
        },
        ask({
          kind: 'number',
          body: `Encrypt the message m = **${RSA.m}** with the toy public key (n = ${RSA.n}, e = ${RSA.e}): c = ${RSA.m}^${RSA.e} mod ${RSA.n}.`,
          answer: RSA_C, tol: 0,
          hint: `${RSA.m}^${RSA.e} = ${RSA.m ** RSA.e}.`,
          explain: `${RSA.m ** RSA.e} = ${RSA.n} × ${Math.floor(RSA.m ** RSA.e / RSA.n)} + ${RSA_C}, so c = ${RSA_C}. Decrypting, ${RSA_C}^${RSA.d} mod ${RSA.n} gives ${RSA_BACK} again.`,
        }),
        ask({
          kind: 'fill',
          body: `The owner decrypts c = ${RSA_C}. Fill in the private recipe.`,
          template: `m = ${RSA_C}^[[0]] mod [[1]]`,
          blanks: [{ options: [String(RSA.d), String(RSA.e), String(RSA.phi)], answer: 0 }, { options: [String(RSA.n), String(RSA.phi), String(RSA.q)], answer: 0 }],
          hint: 'Decryption uses the private exponent and the same modulus as encryption.',
          explain: `m = ${RSA_C}^${RSA.d} mod ${RSA.n} = ${RSA_BACK}. Using e again would just encrypt a second time; ${RSA.phi} is a secret helper used to find d, not the modulus.`,
        }),
        ask({
          kind: 'sort',
          body: 'In the toy RSA and Diffie–Hellman examples, which values are public and which must stay private?',
          bins: ['Public', 'Private'],
          items: [
            { text: `RSA modulus n = ${RSA.n}`, bin: 0 }, { text: `RSA exponent e = ${RSA.e}`, bin: 0 }, { text: `DH values A = ${DH_A} and B = ${DH_B}`, bin: 0 },
            { text: `RSA exponent d = ${RSA.d}`, bin: 1 }, { text: `RSA primes ${RSA.p} and ${RSA.q}`, bin: 1 }, { text: `DH secret a = ${DH.a}`, bin: 1 },
          ],
          hint: 'Anything sent or published is public. Anything that would let someone undo a step is private.',
          explain: 'n, e, A and B are sent in the open by design. d, the primes, and the DH exponents are what an attacker would need, so they never leave their owners.',
        }),
        ask({
          kind: 'multi',
          body: 'Why are these toy examples hopelessly insecure?',
          options: [
            { text: `${RSA.n} factors instantly into ${RSA.p} × ${RSA.q}`, correct: true },
            { text: `There are only ${RSA.n} possible messages, so an attacker can encrypt them all and compare`, correct: true },
            { text: `A ${DH.p}-position clock lets anyone find a secret exponent by trying them all`, correct: true },
            { text: 'The public exponent e is published', why: 'It is meant to be public. Security rests on n being impossible to factor, not on hiding e.' },
            { text: 'Everyone knows how RSA works', why: 'Kerckhoffs’s principle: the method is public on purpose. Only the key needs to be secret.' },
          ],
          explain: 'Every weakness comes from small numbers: tiny n, tiny message space, tiny clock. Real systems use numbers hundreds of digits long, plus padding schemes that randomise messages.',
        }),
        ask({
          kind: 'estimate',
          body: 'A typical real RSA modulus is 2,048 bits long. About how many decimal digits is that?',
          min: 0, max: 1000, step: 1, answer: RSA_DIGITS, tol: 40, format: (v) => `${v} digits`,
          hint: 'Each decimal digit is worth log₂10 ≈ 3.32 bits.',
          explain: `2,048 ÷ 3.32 ≈ ${RSA_DIGITS} digits. Multiplying two 300-digit primes takes a computer microseconds; factoring the product is beyond anyone with known methods and ordinary computers.`,
        }),
      ],
      practice: [genModPow, genDH, genRSA],
    },
  ],
};
