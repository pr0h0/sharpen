// Calibrate: give 90% ranges for five quantities; narrow ranges that still catch the truth score best.
import type { Game } from './game';
import type { Rng } from '../types';
import { h, md, seeded, shuffle } from '../ui';

interface Fact {
  q: string;
  a: number;
  /** Shown beside the inputs. */
  unit?: string;
  /** Shown at the reveal: where the number comes from. */
  note: string;
  /** A calendar year: width is judged in years, not as a ratio. */
  yr?: true;
}

const Y = (q: string, a: number, note: string): Fact => ({ q, a, note, yr: true, unit: 'year (AD)' });

export const FACTS: Fact[] = [
  // ---- time and counting
  { q: 'How many seconds are there in a week?', a: 604800, unit: 'seconds', note: '7 × 24 × 60 × 60 = 604,800.' },
  { q: 'How many minutes are there in a 365-day year?', a: 525600, unit: 'minutes', note: '365 × 24 × 60 = 525,600.' },
  { q: 'How many hours are there in a 365-day year?', a: 8760, unit: 'hours', note: '365 × 24 = 8,760.' },
  { q: 'How many seconds are there in a 365-day year?', a: 31536000, unit: 'seconds', note: '365 × 86,400 = 31,536,000, roughly π × 10⁷.' },
  { q: 'How many minutes are there in a week?', a: 10080, unit: 'minutes', note: '7 × 24 × 60 = 10,080.' },
  { q: 'What is 2 multiplied by itself 20 times (2²⁰)?', a: 1048576, note: '2¹⁰ = 1,024, so 2²⁰ = 1,024² = 1,048,576: just over a million.' },
  { q: 'What is 10! (10 × 9 × 8 × … × 1)?', a: 3628800, note: '10! = 3,628,800. Factorials grow fast: 13! is already over 6 billion.' },
  { q: 'How many different ways can a deck of 52 cards be ordered (52!)?', a: 8.0658e67, note: '52! ≈ 8.07 × 10⁶⁷. A well-shuffled deck is almost certainly in an order no deck has ever been in.' },
  { q: 'How many ways are there to choose 6 numbers from 49 (order not mattering)?', a: 13983816, note: '49 × 48 × 47 × 46 × 45 × 44 ÷ 720 = 13,983,816.' },
  { q: 'How many different 5-card hands can be dealt from a 52-card deck?', a: 2598960, note: '52 × 51 × 50 × 49 × 48 ÷ 120 = 2,598,960.' },
  { q: 'How many squares of any size are there on a chessboard (1×1 up to 8×8)?', a: 204, unit: 'squares', note: '1² + 2² + … + 8² = 204.' },
  { q: 'How many prime numbers are there below 1,000?', a: 168, unit: 'primes', note: 'There are 168 primes below 1,000 (and 25 below 100).' },
  { q: 'How many prime numbers are there below 100?', a: 25, unit: 'primes', note: '2, 3, 5, 7 … 97: 25 of them.' },
  { q: 'How many digits does 2¹⁰⁰ have?', a: 31, unit: 'digits', note: '2¹⁰⁰ ≈ 1.27 × 10³⁰, so 31 digits (100 × log₁₀2 ≈ 30.1).' },
  { q: 'What is the sum 1 + 2 + 3 + … + 100?', a: 5050, note: '100 × 101 ÷ 2 = 5,050, the sum young Gauss is said to have found.' },
  { q: 'How many grains of rice on the last square of a chessboard if square 1 has 1 and each square doubles (2⁶³)?', a: 9.2234e18, unit: 'grains', note: '2⁶³ ≈ 9.22 × 10¹⁸: far more rice than has ever been grown.' },
  { q: 'How many different three-letter strings can be made from the 26 letters (repeats allowed)?', a: 17576, unit: 'strings', note: '26³ = 17,576.' },
  { q: 'What do the interior angles of a pentagon add up to?', a: 540, unit: 'degrees', note: '(5 − 2) × 180° = 540°.' },
  { q: 'How many characters are in the original ASCII code?', a: 128, unit: 'characters', note: 'ASCII uses 7 bits: 2⁷ = 128 codes.' },
  { q: 'How many keys does a standard modern piano have?', a: 88, unit: 'keys', note: '52 white and 36 black: 88 keys.' },
  { q: 'How many letters are in the Greek alphabet?', a: 24, unit: 'letters', note: 'Alpha to omega: 24 letters.' },
  // ---- units
  { q: 'How many inches are there in a mile?', a: 63360, unit: 'inches', note: '5,280 feet × 12 = 63,360 inches.' },
  { q: 'How many feet are there in a mile?', a: 5280, unit: 'feet', note: '1,760 yards × 3 = 5,280 feet.' },
  { q: 'How many metres are there in a mile?', a: 1609.344, unit: 'metres', note: 'A mile is exactly 1,609.344 m.' },
  { q: 'How many grams are there in a pound (lb)?', a: 453.59237, unit: 'grams', note: 'A pound is defined as exactly 453.59237 g.' },
  { q: 'How long is a marathon?', a: 42.195, unit: 'km', note: '42.195 km (26 miles 385 yards), the distance run at the 1908 London Olympics, standardised in 1921.' },
  { q: 'How many litres are in a UK (imperial) gallon?', a: 4.54609, unit: 'litres', note: 'An imperial gallon is exactly 4.54609 litres.' },
  { q: 'How many millilitres are in a UK pint?', a: 568.26, unit: 'ml', note: 'An imperial pint is 1/8 of a gallon: about 568 ml.' },
  { q: 'How many metres are there in a nautical mile?', a: 1852, unit: 'metres', note: 'Defined as exactly 1,852 m: about one minute of latitude.' },
  { q: 'How many square feet are in an acre?', a: 43560, unit: 'sq ft', note: 'An acre is 43,560 sq ft (a furlong by a chain: 660 × 66 ft).' },
  { q: 'How many acres are in a square mile?', a: 640, unit: 'acres', note: '27,878,400 sq ft ÷ 43,560 = 640.' },
  { q: 'How many square metres are in a hectare?', a: 10000, unit: 'm²', note: 'A hectare is 100 m × 100 m = 10,000 m².' },
  { q: 'How many litres of water fill a pool 50 m long, 25 m wide and 2 m deep?', a: 2500000, unit: 'litres', note: '2,500 m³ × 1,000 litres per m³ = 2.5 million litres.' },
  { q: 'How long is a cricket pitch, wicket to wicket?', a: 20.12, unit: 'metres', note: '22 yards, which is 20.12 m.' },
  // ---- physics and chemistry
  { q: 'What is the speed of light in a vacuum?', a: 299792, unit: 'km per second', note: 'Exactly 299,792.458 km/s: about 300,000.' },
  { q: 'What is the speed of sound in air at 20 °C?', a: 343, unit: 'm/s', note: 'About 343 m/s, roughly 1 km every 3 seconds.' },
  { q: 'What is the boiling point of water at sea level in Fahrenheit?', a: 212, unit: '°F', note: '100 °C = 212 °F.' },
  { q: 'What is the freezing point of water in kelvin?', a: 273.15, unit: 'K', note: '0 °C = 273.15 K; absolute zero is 0 K.' },
  { q: 'What is the acceleration due to gravity at the Earth’s surface?', a: 9.81, unit: 'm/s²', note: 'About 9.81 m/s² (standard value 9.80665).' },
  { q: 'Avogadro’s number: how many atoms are in 12 grams of carbon-12?', a: 6.022e23, unit: 'atoms', note: 'About 6.022 × 10²³.' },
  { q: 'How many times heavier is a proton than an electron?', a: 1836, unit: 'times', note: 'The proton–electron mass ratio is about 1,836.' },
  { q: 'What is the atomic number of gold?', a: 79, note: 'Gold (Au) has 79 protons.' },
  { q: 'What is the atomic number of uranium?', a: 92, note: 'Uranium (U) has 92 protons, the heaviest element found in quantity in nature.' },
  { q: 'What is the atomic number of iron?', a: 26, note: 'Iron (Fe) has 26 protons.' },
  { q: 'How many elements are in the periodic table (as of 2016, when the 7th row was completed)?', a: 118, unit: 'elements', note: 'Oganesson (118) completed the seventh row; the names were approved in 2016.' },
  { q: 'What is the density of gold?', a: 19.3, unit: 'g per cm³', note: 'About 19.3 g/cm³: a litre of gold weighs over 19 kg.' },
  { q: 'What is the melting point of iron?', a: 1538, unit: '°C', note: 'Pure iron melts at about 1,538 °C.' },
  { q: 'Roughly what percentage of dry air is nitrogen?', a: 78, unit: '%', note: 'About 78% nitrogen, 21% oxygen, about 1% argon.' },
  { q: 'Roughly what percentage of dry air is oxygen?', a: 20.95, unit: '%', note: 'About 21% (20.95%).' },
  { q: 'What is the mass of a cubic metre of air at sea level?', a: 1.2, unit: 'kg', note: 'About 1.2 kg at 20 °C: the air in a room weighs more than you’d think.' },
  { q: 'How many kilocalories are in a gram of fat?', a: 9, unit: 'kcal', note: 'About 9 kcal per gram, against about 4 for carbohydrate or protein.' },
  // ---- Earth and space
  { q: 'What is the average distance from the Earth to the Moon?', a: 384400, unit: 'km', note: 'About 384,400 km, roughly 30 Earth diameters.' },
  { q: 'What is the average distance from the Earth to the Sun?', a: 149.6, unit: 'million km', note: '1 astronomical unit ≈ 149.6 million km.' },
  { q: 'What is the Earth’s circumference at the equator?', a: 40075, unit: 'km', note: 'About 40,075 km. The metre was first defined so a pole-to-equator quarter would be 10,000 km.' },
  { q: 'What is the Earth’s average radius?', a: 6371, unit: 'km', note: 'About 6,371 km.' },
  { q: 'How long does sunlight take to reach the Earth?', a: 8.3, unit: 'minutes', note: 'About 499 seconds, so 8.3 minutes.' },
  { q: 'How long does light take to travel from the Moon to the Earth?', a: 1.28, unit: 'seconds', note: '384,400 km ÷ 300,000 km/s ≈ 1.28 s.' },
  { q: 'What is the Moon’s diameter?', a: 3474, unit: 'km', note: 'About 3,474 km, a little over a quarter of the Earth’s.' },
  { q: 'What is the Sun’s diameter?', a: 1392000, unit: 'km', note: 'About 1.39 million km, roughly 109 Earths across.' },
  { q: 'What is Jupiter’s diameter at the equator?', a: 142984, unit: 'km', note: 'About 143,000 km, roughly 11 Earths across.' },
  { q: 'How many Earth days does Mars take to orbit the Sun?', a: 687, unit: 'days', note: 'A Martian year is about 687 Earth days.' },
  { q: 'How long is a day on Mars (one rotation relative to the Sun)?', a: 24.66, unit: 'hours', note: 'A Martian solar day (a “sol”) is about 24 h 40 min.' },
  { q: 'How many Earth days does Mercury take to orbit the Sun?', a: 88, unit: 'days', note: 'About 88 days.' },
  { q: 'How many years does Jupiter take to orbit the Sun?', a: 11.86, unit: 'years', note: 'About 11.9 years.' },
  { q: 'How many years does Saturn take to orbit the Sun?', a: 29.46, unit: 'years', note: 'About 29.5 years.' },
  { q: 'How many days from one full moon to the next?', a: 29.53, unit: 'days', note: 'The synodic month is about 29.5 days.' },
  { q: 'How many times more massive is the Sun than the Earth?', a: 333000, unit: 'times', note: 'About 333,000 Earth masses.' },
  { q: 'What is the mass of the Earth?', a: 5.97e24, unit: 'kg', note: 'About 5.97 × 10²⁴ kg.' },
  { q: 'What is the Earth’s escape velocity?', a: 11.2, unit: 'km per second', note: 'About 11.2 km/s.' },
  { q: 'What is the tilt of the Earth’s axis?', a: 23.4, unit: 'degrees', note: 'About 23.4°, which gives us seasons.' },
  { q: 'How fast does the Earth move around the Sun?', a: 29.8, unit: 'km per second', note: 'About 29.8 km/s: 2π × 149.6 million km in a year.' },
  { q: 'How fast does the ground at the equator move as the Earth spins?', a: 1670, unit: 'km/h', note: '40,075 km in about 24 hours: roughly 1,670 km/h.' },
  { q: 'How far away is Proxima Centauri, the nearest star after the Sun?', a: 4.24, unit: 'light years', note: 'About 4.24 light years.' },
  { q: 'How many kilometres are in a light year?', a: 9.461e12, unit: 'km', note: 'About 9.46 trillion km (9.46 × 10¹²).' },
  { q: 'How old is the universe?', a: 13.8, unit: 'billion years', note: 'About 13.8 billion years, from the cosmic microwave background.' },
  { q: 'How old is the Earth?', a: 4.54, unit: 'billion years', note: 'About 4.54 billion years, from radiometric dating of meteorites.' },
  { q: 'What is the total surface area of the Earth?', a: 510, unit: 'million km²', note: 'About 510 million km², about 71% of it ocean.' },
  { q: 'Roughly what percentage of the Earth’s surface is covered by water?', a: 71, unit: '%', note: 'About 71%.' },
  { q: 'How tall is Mount Everest?', a: 8849, unit: 'metres', note: '8,848.86 m, from the 2020 China–Nepal survey.' },
  { q: 'How tall is Ben Nevis, the highest mountain in the UK?', a: 1345, unit: 'metres', note: 'About 1,345 m.' },
  { q: 'How tall is Yr Wyddfa (Snowdon), the highest mountain in Wales?', a: 1085, unit: 'metres', note: 'About 1,085 m.' },
  { q: 'How tall was the Great Pyramid of Giza when it was built?', a: 146.6, unit: 'metres', note: 'About 146.6 m (481 ft); it stayed the tallest human-made structure for over 3,800 years.' },
  { q: 'How many years is Halley’s Comet’s orbit, on average?', a: 76, unit: 'years', note: 'About 75 to 76 years; it last passed in 1986.' },
  // ---- the human body
  { q: 'How many bones are in an adult human skeleton?', a: 206, unit: 'bones', note: 'Typically 206; babies start with around 300 that fuse.' },
  { q: 'How many teeth are in a full adult set, wisdom teeth included?', a: 32, unit: 'teeth', note: '32, including four wisdom teeth.' },
  { q: 'How many chromosomes are in a typical human cell?', a: 46, unit: 'chromosomes', note: '23 pairs: 46.' },
  { q: 'Roughly how many neurons are in the human brain?', a: 8.6e10, unit: 'neurons', note: 'About 86 billion, from cell-counting studies.' },
  { q: 'Roughly how many base pairs are in the human genome (one copy)?', a: 3.1e9, unit: 'base pairs', note: 'About 3.1 billion.' },
  { q: 'How long does a red blood cell last in the body?', a: 120, unit: 'days', note: 'About 120 days, then it’s recycled, mainly by the spleen and liver.' },
  { q: 'What is normal human body temperature in Fahrenheit?', a: 98.6, unit: '°F', note: '37 °C = 98.6 °F (real temperatures vary a little).' },
  { q: 'How many bones are in one human hand, wrist included?', a: 27, unit: 'bones', note: '27: 8 in the wrist, 5 in the palm, 14 in the fingers.' },
  { q: 'How many ribs does a typical adult have?', a: 24, unit: 'ribs', note: '12 pairs: 24.' },
  // ---- history
  Y('In what year was the Battle of Hastings?', 1066, '1066: William of Normandy defeated Harold II.'),
  Y('In what year was Magna Carta sealed?', 1215, 'King John sealed it at Runnymede in 1215.'),
  Y('In what year did Columbus first reach the Americas?', 1492, '1492.'),
  Y('In what year did humans first land on the Moon?', 1969, 'Apollo 11, July 1969.'),
  Y('In what year did the Berlin Wall fall?', 1989, 'November 1989.'),
  Y('In what year did the First World War begin?', 1914, '1914.'),
  Y('In what year did the Second World War end?', 1945, '1945.'),
  Y('In what year was the Bastille stormed?', 1789, '14 July 1789, at the start of the French Revolution.'),
  Y('In what year was the US Declaration of Independence signed?', 1776, '1776.'),
  Y('In what year did the Titanic sink?', 1912, 'April 1912, on her maiden voyage.'),
  Y('In what year did the Wright brothers make the first powered aeroplane flight?', 1903, 'December 1903, at Kitty Hawk.'),
  Y('In what year was Darwin’s *On the Origin of Species* published?', 1859, '1859.'),
  Y('In what year was Newton’s *Principia* published?', 1687, '1687.'),
  Y('In what year did William Shakespeare die?', 1616, '1616.'),
  Y('In what year was the Great Fire of London?', 1666, 'September 1666.'),
  Y('In what year was Sputnik 1, the first artificial satellite, launched?', 1957, 'October 1957.'),
  Y('In what year did Yuri Gagarin become the first person in space?', 1961, 'April 1961.'),
  Y('In what year did Einstein publish special relativity?', 1905, '1905, his “miracle year”.'),
  Y('In what year did Alexander Fleming discover penicillin?', 1928, '1928.'),
  Y('In what year was the structure of DNA published by Watson and Crick?', 1953, '1953, building on Rosalind Franklin’s X-ray images.'),
  Y('In what year did Mendeleev publish his periodic table?', 1869, '1869.'),
  Y('In what year did the Black Death reach England?', 1348, '1348.'),
  Y('In what year was the Chernobyl disaster?', 1986, 'April 1986.'),
  Y('In what year were the first modern Olympic Games held?', 1896, 'Athens, 1896.'),
  Y('In what year was the Battle of Waterloo?', 1815, 'June 1815.'),
  Y('In what year did the Acts of Union join England and Scotland?', 1707, '1707.'),
  Y('In what year did Queen Victoria come to the throne?', 1837, '1837; she reigned until 1901.'),
  Y('In what year was the Hubble Space Telescope launched?', 1990, '1990.'),
  Y('In what year was Voyager 1 launched?', 1977, '1977.'),
  Y('In what year did Alan Turing publish “On Computable Numbers”?', 1936, '1936.'),
  Y('In what year was Pluto discovered?', 1930, '1930, by Clyde Tombaugh.'),
  Y('In what year was Neptune discovered?', 1846, '1846, after its position was predicted from Uranus’s orbit.'),
  Y('In what year did William Herschel discover Uranus?', 1781, '1781.'),
  Y('In what year was the first iPhone released?', 2007, '2007.'),
  { q: 'How many years did the Hundred Years’ War actually last?', a: 116, unit: 'years', note: '1337 to 1453: 116 years.' },
];

export const ROUND = 5;
/** Width of a range in "decades": log10(high/low), or for a year, every 100 years counts as one. */
export const width = (f: Fact, lo: number, hi: number) => f.yr ? (hi - lo) / 100 : Math.log10(hi / lo);
/** Points for one answer, out of 20: 0 for a miss, 20 × e^(−0.2 × width) for a hit. */
export const points = (f: Fact, lo: number, hi: number) => lo <= f.a && f.a <= hi ? 20 * Math.exp(-0.2 * width(f, lo, hi)) : 0;

export const buildRound = (rng: Rng) => shuffle(rng, FACTS).slice(0, ROUND);

const MULT: Record<string, number> = { '': 1, k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, tn: 1e12, trillion: 1e12 };
/** "1,000", "2.5e6", "3k", "3 million", "2bn" -> number; NaN if unreadable. */
export function parseAmount(s: string): number {
  const m = s.trim().toLowerCase().replace(/[,\s_]/g, '').match(/^(\d*\.?\d+(?:e[+-]?\d+)?)([a-z]*)$/);
  if (!m || !(m[2] in MULT)) return NaN;
  return Number(m[1]) * MULT[m[2]];
}

const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Friendly display: 604,800 · 3.2 million · 8.07 × 10⁶⁷ · 0.042. */
export function fmt(v: number): string {
  if (!Number.isFinite(v)) return '?';
  const a = Math.abs(v);
  const r = (x: number, d = 3) => Number(x.toPrecision(d)).toLocaleString('en-US', { maximumFractionDigits: 6 });
  if (a >= 1e15 || (a > 0 && a < 1e-4)) {
    const e = Math.floor(Math.log10(a));
    return `${r(v / 10 ** e)} × 10${String(e).replace(/./g, (c) => SUP[c])}`;
  }
  for (const [n, w] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']] as const) if (a >= n) return `${r(v / n)} ${w}`;
  return r(v, 6);
}

const show = (f: Fact, v: number) => f.yr ? String(Math.round(v)) : fmt(v);

export const estimate: Game = {
  id: 'estimate', title: 'Calibrate', icon: '🎯', color: '#e2703a', course: 'biases',
  blurb: 'Five questions, five ranges. Be 90% sure, and no wider than you need.',
  how: 'For each question give a **low** and a **high** number you’re **90% sure** the answer lies between.\n\nA range that misses scores nothing; a range that hits scores more the narrower it is. You can type `2,500`, `3.5k`, `4 million` or `2e9`.',
  css: `

.g-estimate .ce-q { font-size: 1.15rem; font-weight: 600; margin: 4px 0 14px; }
.g-estimate .ce-q p { margin: 0; }
.g-estimate .ce-top { display: flex; justify-content: space-between; gap: 8px; color: var(--muted); font-size: .9rem; }
.g-estimate .ce-ins { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.g-estimate .ce-ins label { display: grid; gap: 4px; font-weight: 600; font-size: .9rem; min-width: 0; }
.g-estimate .ce-ins .num { width: 100%; box-sizing: border-box; min-height: 48px; }
.g-estimate .ce-prev { color: var(--muted); font-size: .85rem; font-weight: 400; min-height: 1.2em; overflow-wrap: anywhere; }
.g-estimate .ce-unit { color: var(--muted); margin: 8px 0 0; font-size: .9rem; }
.g-estimate .ce-go { margin-top: 14px; width: 100%; min-height: 48px; }
.g-estimate .ce-err { color: var(--bad); margin-top: 8px; font-size: .9rem; }
.g-estimate .ce-err:empty { display: none; }
.g-estimate .feedback p:last-child { margin-bottom: 0; }
.g-estimate .ce-line { position: relative; height: 34px; margin: 14px 4px 4px; }
.g-estimate .ce-axis { position: absolute; left: 0; right: 0; top: 16px; height: 2px; background: var(--line); }
.g-estimate .ce-band { position: absolute; top: 9px; height: 16px; border-radius: 8px; background: color-mix(in srgb, var(--accent) 45%, transparent); min-width: 4px; }
.g-estimate .ce-true { position: absolute; top: 0; width: 4px; height: 34px; margin-left: -2px; border-radius: 2px; background: var(--good); }
.g-estimate .bad .ce-true { background: var(--bad); }
.g-estimate .ce-pips { display: flex; gap: 6px; }
.g-estimate .ce-pip { width: 12px; height: 12px; border-radius: 50%; background: var(--line); }
.g-estimate .ce-pip.hit { background: var(--good); }
.g-estimate .ce-pip.miss { background: var(--bad); }
.g-estimate .ce-pip.now { outline: 2px solid var(--accent); outline-offset: 1px; }
`,
  mount(el, api) {
    const round = buildRound(api.rng);
    const results: { hit: boolean; pts: number; w: number }[] = [];
    let i = 0;

    const pips = () => h('div', { class: 'ce-pips', 'aria-hidden': 'true' }, round.map((_, k) =>
      h('span', { class: `ce-pip${k < results.length ? (results[k].hit ? ' hit' : ' miss') : ''}${k === i ? ' now' : ''}` })));

    const ask = () => {
      const f = round[i];
      const field = (label: string) => {
        const prev = h('span', { class: 'ce-prev' });
        const inp = h('input', { class: 'num', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'next', 'aria-label': `${label} bound` }) as HTMLInputElement;
        inp.addEventListener('input', () => {
          const v = parseAmount(inp.value);
          prev.textContent = !inp.value.trim() ? '' : Number.isNaN(v) ? 'can’t read that' : `= ${show(f, v)}`;
        });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (inp === lo) hi.focus(); else submit(); } });
        return { inp, box: h('label', null, label, inp, prev) };
      };
      const L = field('Low'), H = field('High');
      const lo = L.inp, hi = H.inp;
      const err = h('div', { class: 'ce-err', role: 'alert' });
      const go = h('button', { class: 'primary ce-go', onclick: () => submit() }, 'Lock in my range');
      const card = h('div', { class: 'card' },
        h('div', { class: 'ce-top' }, h('span', null, `Question ${i + 1} of ${ROUND}`), pips()),
        h('div', { class: 'ce-q' }, md(f.q)),
        h('div', { class: 'ce-ins' }, L.box, H.box),
        f.unit ? h('p', { class: 'ce-unit' }, `Answer in ${f.unit}. 90% sure it’s between your two numbers.`) : h('p', { class: 'ce-unit' }, '90% sure it’s between your two numbers.'),
        err, go);
      const submit = () => {
        const a = parseAmount(lo.value), b = parseAmount(hi.value);
        if (Number.isNaN(a) || Number.isNaN(b)) { err.textContent = 'Enter both numbers, like 1200, 3.5k or 2 million.'; return; }
        if (!(a > 0 && b > 0)) { err.textContent = 'Both numbers need to be more than zero.'; return; }
        if (a > b) { err.textContent = 'Low must not be more than high.'; return; }
        reveal(card, f, a, b);
      };
      el.replaceChildren(card);
      lo.focus({ preventScroll: true });
    };

    const reveal = (card: HTMLElement, f: Fact, lo: number, hi: number) => {
      const pts = points(f, lo, hi), hit = pts > 0, w = width(f, lo, hi);
      results.push({ hit, pts, w });
      card.querySelectorAll('input, .ce-go').forEach((x) => ((x as HTMLInputElement).disabled = true));
      card.querySelector('.ce-go')?.remove();
      card.querySelector('.ce-pips')?.replaceWith(pips());
      // A strip on a log scale (linear for years) showing the range and the truth.
      const t = (v: number) => f.yr ? v : Math.log10(v);
      const a = Math.min(t(lo), t(f.a)), b = Math.max(t(hi), t(f.a));
      const pad = (b - a) * 0.12 || (f.yr ? 5 : 0.3);
      const x = (v: number) => `${((t(v) - (a - pad)) / (b - a + 2 * pad)) * 100}%`;
      const last = results.length === ROUND;
      const next = h('button', { class: 'primary ce-go', onclick: () => { if (last) { next.remove(); end(); } else { i++; ask(); } } }, last ? 'See my score' : 'Next question');
      card.append(h('div', { class: `feedback ${hit ? 'good' : 'bad'}` },
        h('div', { class: 'fb-head' }, h('strong', null, hit ? `Inside your range: +${Math.round(pts)}` : 'Missed: the answer is outside your range')),
        h('div', { class: 'ce-line', 'aria-hidden': 'true' },
          h('div', { class: 'ce-axis' }),
          h('div', { class: 'ce-band', style: `left:${x(lo)};width:calc(${x(hi)} - ${x(lo)})` }),
          h('div', { class: 'ce-true', style: `left:${x(f.a)}` })),
        h('p', null, 'Answer: ', h('strong', null, show(f, f.a), f.unit && !f.yr ? ` ${f.unit}` : ''), `. You said ${show(f, lo)} to ${show(f, hi)}.`),
        h('p', { class: 'muted' }, f.note.replace(/\*/g, ''))), next);
      next.focus({ preventScroll: true });
      next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const end = () => {
      const hits = results.filter((r) => r.hit).length;
      const score = results.reduce((s, r) => s + r.pts, 0);
      const avgW = results.filter((r) => r.hit).reduce((s, r) => s + r.w, 0) / (hits || 1);
      const lesson = hits <= 3
        ? 'That looks **overconfident**: honest 90% ranges catch about 9 in 10. Next time, push each end out until a miss would genuinely surprise you.'
        : hits === 5 && avgW > 2.5
          ? 'Every range caught the truth, but they were wide. You can afford to tighten them a little.'
          : 'That’s in line with **good calibration**: 90% ranges should catch about 4 or 5 out of 5.';
      api.finish(score, `You caught the answer **${hits} of ${ROUND}** times. ${lesson}`);
    };

    ask();
  },
  check(seed) {
    const qs = new Set<string>();
    for (const f of FACTS) {
      if (qs.has(f.q)) return `duplicate question in bank: ${f.q}`;
      qs.add(f.q);
      if (!(Number.isFinite(f.a) && f.a > 0)) return `bad answer ${f.a} for ${f.q}`;
      if (!f.note.trim()) return `no note for ${f.q}`;
      if (f.yr && !(Number.isInteger(f.a) && f.a > 0 && f.a < 2100)) return `bad year ${f.a}`;
      if (Math.abs(points(f, f.a, f.a) - 20) > 1e-9 || points(f, f.a * 2, f.a * 3) !== 0) return `scoring broken for ${f.q}`;
    }
    if (FACTS.length < 80) return `only ${FACTS.length} facts`;
    const r = buildRound(seeded(seed));
    if (r.length !== ROUND || new Set(r).size !== ROUND) return 'round lacks 5 distinct questions';
    const tests: [string, number][] = [['1,000', 1000], ['2.5e6', 2.5e6], ['3k', 3000], ['3 million', 3e6], ['2bn', 2e9], ['0.5', 0.5]];
    for (const [s, v] of tests) if (parseAmount(s) !== v) return `parseAmount(${s}) = ${parseAmount(s)}`;
    if (!Number.isNaN(parseAmount('abc')) || !Number.isNaN(parseAmount('-5'))) return 'parseAmount accepts junk';
    return null;
  },
};

