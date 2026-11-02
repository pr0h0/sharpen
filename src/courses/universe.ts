// The Universe by Numbers: scale, light-travel time, gravity and orbits, seasons and phases,
// parallax and Eratosthenes, stars, the expanding universe, and estimating whether we're alone.
// Every number comes from the rounded constants in src/widgets/universe.ts, stated as "about".
import type { Course, Generator } from '../types';
import { h, num, pick, randInt, shuffle } from '../ui';
import { barChart, dataTable } from '../viz/charts';
import { plotEl } from '../viz/plot';
import {
  AU_KM, C_KMS, DRAKE_FIXED, EARTH_D_KM, EARTH_R_KM, H0, LY_KM, MOON_D_KM, MOON_KM, PC_LY, PLANETS, SUN_D_KM, TILT, V_CIRC, WIEN, YEAR_S,
  cannon, drake, eratosthenes, grapefruit, hubblePlot, inverseSquare, keplerOrbit, keplerPlot, lifePlot, lightReach, lightSpread,
  moonCycle, moonPhases, moonPulse, p10, phaseName, plotBox, powersOfTen, raisinBread, scaleModel, seasonOrbit, starSpectrum, stellarParallax,
  sunBeam, colourStrip, thumbParallax, tidalLock, transit, words,
} from '../widgets/universe';

const big = (v: number) => Math.round(v).toLocaleString('en-US');
const sig = (v: number, d = 3) => num(Number(v.toPrecision(d)));
/** Metres from a power-of-ten slider value, as a readable length. */
const fmtLen = (v: number) => {
  const m = 10 ** v;
  if (m < 1) return `≈ ${sig(m * 100, 2)} cm`;
  if (m < 1000) return `≈ ${sig(m, 2)} m`;
  return `≈ ${sig(m / 1000, 2).toLocaleString()} km`;
};
/** 9.5e20 -> "9.5 × 10²⁰". */
const sci = (v: number) => { const k = Math.floor(Math.log10(v)); return `${sig(v / 10 ** k, 2)} × ${p10(k)}`; };
/** Shrink a data table's text so five columns fit a phone. */
const smallTable = (el: HTMLElement) => { el.querySelectorAll('table').forEach((t) => { t.style.fontSize = '.8rem'; t.querySelectorAll('th, td').forEach((c) => { (c as HTMLElement).style.padding = '.3em .55em'; }); }); return el; };
const yearsFmt = (v: number) => { const y = 10 ** v; return y < 1.5 ? '≈ 1 year' : `≈ ${words(y)} years`; };

// ---------------------------------------------------------------- lesson 1 numbers

const GF_CM = 14; // grapefruit Sun
const cmPerKm = GF_CM / SUN_D_KM; // 1e-5: 1 cm = 100,000 km
const gfEarthM = (AU_KM * cmPerKm) / 100;
const gfEarthMm = EARTH_D_KM * cmPerKm * 10;
const gfMoonCm = MOON_KM * cmPerKm;
const proximaKm = 4.2 * LY_KM;
const gfProximaKm = (proximaKm * cmPerKm) / 100_000;
const gfExp = Math.round(Math.log10(gfEarthM) / 0.05) * 0.05;
const neptuneKm = 30 * AU_KM;

// ---------------------------------------------------------------- lesson 2 numbers

const moonSec = MOON_KM / C_KMS;
const sunSec = AU_KM / C_KMS;
const marsRoundMin = (2 * 225e6) / C_KMS / 60;
const voyagerYears = proximaKm / 17 / YEAR_S;
const andromedaExp = Math.round(Math.log10(2.5e6) * 10) / 10;

// ---------------------------------------------------------------- lesson 3 numbers

const ISS_KM = 400;
const issFrac = (EARTH_R_KM / (EARTH_R_KM + ISS_KM)) ** 2;
const issSpeed = (2 * Math.PI * (EARTH_R_KM + ISS_KM)) / (92 * 60);
const R0 = 1.02;
const vCircTop = V_CIRC * Math.sqrt(1 / R0), vEscTop = V_CIRC * Math.sqrt(2 / R0);
const marsT = 1.52 ** 1.5;

// ---------------------------------------------------------------- lesson 5 numbers

const thumbDeg = (d: number) => (2 * Math.atan(3.25 / d) * 180) / Math.PI;

// ---------------------------------------------------------------- lesson 7 numbers

const MPC_KM = 3.09e19, YR_S = 3.16e7;
const hubbleAgeGyr = (H: number) => MPC_KM / H / YR_S / 1e9;
const age70 = hubbleAgeGyr(H0);

// ---------------------------------------------------------------- lesson 8 numbers

const drakeN = DRAKE_FIXED.R * DRAKE_FIXED.fp * DRAKE_FIXED.ne * 0.1 * 0.01 * 0.1 * 1e6;
const earthDip = 100 * (1 / 109) ** 2;
const transitPct = (100 * 696_000) / AU_KM;

// ================================================================= practice generators

const MODEL_PLANETS: [string, number][] = [['Earth', 150], ['Mars', 230], ['Jupiter', 780], ['Venus', 108], ['Saturn', 1430]];
const genScaleModel: Generator = (rng) => {
  const s = pick(rng, [7, 10, 20, 28, 35, 70]);
  const [name, mkm] = pick(rng, MODEL_PLANETS);
  const m = (mkm * 1e6 * (s / SUN_D_KM)) / 100;
  return {
    kind: 'number', unit: 'm',
    body: `In a scale model the Sun is a ball **${s} cm** across (the real Sun is about 1.4 million km). ${name} orbits about ${big(mkm)} million km from the Sun. How many **metres** from the model Sun does model ${name} go?`,
    answer: m, tol: m * 0.02,
    hint: 'Find how many km 1 cm stands for, then convert the distance.',
    explain: `1 cm stands for 1.4 million ÷ ${s} = ${words(SUN_D_KM / s)} km. ${big(mkm)} million km ÷ that = ${sig(m * 100)} cm ≈ **${sig(m)} m**.`,
  };
};

const POW_ITEMS: [string, number][] = [
  ['Earth’s diameter (12,700 km)', 1.27e7], ['the Sun’s diameter (1.4 million km)', 1.4e9], ['the height of Mount Everest (8.8 km)', 8.8e3],
  ['the width of a human hair (0.08 mm)', 8e-5], ['the Earth–Sun distance (150 million km)', 1.5e11], ['one light-year (9.5 trillion km)', 9.5e15],
  ['a football pitch (about 100 m long)', 100], ['a red blood cell (8 thousandths of a mm)', 8e-6],
];
const genNearestPower: Generator = (rng) => {
  const [name, v] = pick(rng, POW_ITEMS);
  const k = Math.round(Math.log10(v));
  const lo = k - randInt(rng, 0, 3);
  const opts = [0, 1, 2, 3].map((j) => lo + j);
  return {
    kind: 'choice',
    body: `Which power of ten (in metres) is closest to **${name}**?`,
    options: opts.map((e) => (e === k ? { text: `${p10(e)} m`, correct: true } : {
      text: `${p10(e)} m`, why: `${p10(e)} m is ${e < k ? 'smaller' : 'bigger'} by a factor of about ${big(e < k ? v / 10 ** e : 10 ** e / v)}.`,
    })),
    hint: 'Convert to metres first: 1 km = 1,000 m = 10³ m.',
    explain: `${name} ≈ ${sci(v)} m, so about ${p10(k)} m.`,
  };
};

const RATIOS: [string, string, number][] = [
  ['Earths', 'the Sun', SUN_D_KM / EARTH_D_KM], ['Moons', 'Earth', EARTH_D_KM / MOON_D_KM],
  ['Earths, side by side,', 'the gap between Earth and the Moon', MOON_KM / EARTH_D_KM], ['Suns, side by side,', 'the gap between Earth and the Sun', AU_KM / SUN_D_KM],
  ['Earths', 'Jupiter', 140_000 / EARTH_D_KM],
];
const genRatio: Generator = (rng) => {
  const [a, b, r] = pick(rng, RATIOS);
  const ans = Math.round(Math.log10(r) * 10) / 10;
  const min = Math.abs(ans - 2) <= 0.6 ? -2 : 0; // keep the slider's starting midpoint away from the answer
  return {
    kind: 'estimate',
    body: `Roughly how many ${a} would fit across ${b}? (Earth ≈ 12,700 km across, Moon ≈ 3,500 km, Jupiter ≈ 140,000 km, Sun ≈ 1.4 million km; Earth–Moon ≈ 384,000 km, Earth–Sun ≈ 150 million km.)`,
    min, max: 4, step: 0.1, answer: ans, tol: 0.3, format: (v) => `≈ ${sig(10 ** v, 2)}`,
    explain: `Divide the big length by the small one: about ${big(r)}.`,
  };
};

const genLightTime: Generator = (rng) => {
  const d = pick(rng, [55, 80, 150, 225, 400, 630, 1200, 1430, 2900, 4500]);
  const min = (d * 1e6) / C_KMS / 60;
  return {
    kind: 'number', unit: 'min',
    body: `A space probe is **${big(d)} million km** from Earth. How many **minutes** does its radio signal (light speed, about 300,000 km/s) take to reach us?`,
    answer: min, tol: min * 0.01,
    hint: 'Time = distance ÷ speed. Then divide the seconds by 60.',
    explain: `${big(d)},000,000 ÷ 300,000 = ${big(min * 60)} s ≈ **${sig(min)} min**.`,
  };
};

const genRadar: Generator = (rng) => {
  const t = randInt(rng, 2, 60);
  const km = (C_KMS * t) / 2;
  return {
    kind: 'number', unit: 'km',
    body: `A radar pulse bounced off a passing asteroid comes back **${t} seconds** after it was sent. How far away is the asteroid, in km? (Light: about 300,000 km/s.)`,
    answer: km, tol: km * 0.005,
    hint: 'The pulse goes there and back.',
    explain: `In ${t} s light covers ${big(C_KMS * t)} km, but that's the round trip: the asteroid is half that, **${big(km)} km** away.`,
  };
};

const genLookback: Generator = (rng) => {
  const n = pick(rng, [2, 5, 12, 30, 50, 65, 100, 300]);
  return {
    kind: 'choice',
    body: `A galaxy is about **${n} million light-years** away. When did the light you see from it tonight set off?`,
    options: [
      { text: `About ${n} million years ago`, correct: true },
      { text: `About ${n} years ago`, why: 'A light-year is the distance light covers in a year, so each light-year of distance is a year of travel: millions of them.' },
      { text: 'Just now: light arrives instantly', why: 'Light is fast but not instant: 300,000 km every second, which still takes a year per light-year.' },
      { text: `About ${n * 2} million years ago`, why: 'Starlight only makes the trip once, from the galaxy to us. Doubling is for echoes like radar.' },
    ],
    explain: `${n} million light-years means ${n} million years of travel at light speed. We see the galaxy as it was then.`,
  };
};

const genGravity: Generator = (rng) => {
  const k = pick(rng, [1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 60]);
  const f = 1 / (k * k);
  return {
    kind: 'number', prob: true,
    body: `How strong is Earth’s gravity **${big(k * EARTH_R_KM)} km from Earth’s centre**, as a fraction of its strength at the surface? (Earth’s radius is about 6,400 km.)`,
    answer: f, tol: Math.max(0.0005, f * 0.02),
    hint: 'How many Earth radii is that? Gravity falls with the square of the distance.',
    explain: `${big(k * EARTH_R_KM)} ÷ 6,400 = ${k} radii, so the pull is 1/${num(k * k)} ≈ ${sig(f)} of surface gravity.`,
  };
};

const genKepler: Generator = (rng) => {
  const a = pick(rng, [0.5, 1.5, 2, 2.5, 3, 4, 6, 9, 16, 40, 50]);
  const T = a ** 1.5;
  return {
    kind: 'number', unit: 'years',
    body: `An asteroid orbits the Sun at an average distance of **${a} AU**. Using T² = a³ (T in years, a in AU), how long is its year?`,
    answer: T, tol: T * 0.01,
    hint: `Cube the distance, then take the square root.`,
    explain: `a³ = ${num(a ** 3)}; √${num(a ** 3)} ≈ **${sig(T)} years**.`,
  };
};

const genKeplerInv: Generator = (rng) => {
  const x = randInt(rng, 2, 7), T = x ** 3, a = x * x;
  return {
    kind: 'number', unit: 'AU',
    body: `A comet takes **${T} years** to go round the Sun. Using T² = a³, what is its average distance a, in AU?`,
    answer: a, tol: a * 0.01,
    hint: `T² = ${T * T}. Which number cubed gives that?`,
    explain: `T² = ${big(T * T)} = ${a}³, so a = **${a} AU**.`,
  };
};

const genNoonSun: Generator = (rng) => {
  const L = randInt(rng, 25, 60);
  const [when, d] = pick(rng, [['June solstice', TILT], ['December solstice', -TILT], ['March equinox', 0]] as [string, number][]);
  const e = 90 - L + d;
  return {
    kind: 'number', unit: '°',
    body: `At latitude **${L}°N**, how high above the horizon is the Sun at noon on the **${when}**? (Earth’s tilt: 23.4°.)`,
    answer: e, tol: 0.3,
    hint: 'Noon height = 90° − latitude, then add the tilt in June, subtract it in December.',
    explain: `90 − ${L} = ${90 - L}°${d > 0 ? ' + 23.4°' : d < 0 ? ' − 23.4°' : ' (no tilt correction at an equinox)'} = **${num(e)}°**.`,
  };
};

const PHASES = [0, 45, 90, 135, 180, 225, 270, 315];
const genPhase: Generator = (rng) => {
  const e = pick(rng, PHASES);
  const right = phaseName(e);
  const others = shuffle(rng, PHASES.filter((x) => x !== e)).slice(0, 3);
  return {
    kind: 'choice',
    body: `Seen from above the North Pole, the Moon has gone **${e}°** round its orbit since new moon (about ${Math.round((e / 360) * 29.5)} days). What phase do we see?`,
    options: [{ text: right, correct: true }, ...others.map((o) => ({ text: phaseName(o), why: `That’s what we see at ${o}° round, about ${Math.round((o / 360) * 29.5)} days after new moon.` }))],
    hint: 'New at 0°, first quarter at 90°, full at 180°, third quarter at 270°.',
    explain: `At ${e}° the Moon shows us a ${e === 0 ? 'dark' : e === 180 ? 'fully lit' : 'partly lit'} face: ${right}.`,
  };
};

const CITIES: [string, boolean][] = [['Sydney', false], ['Buenos Aires', false], ['Cape Town', false], ['Auckland', false], ['Oslo', true], ['Tokyo', true], ['Chicago', true], ['Madrid', true]];
const MONTH_SEASON_N: [string, string][] = [['January', 'winter'], ['February', 'winter'], ['April', 'spring'], ['May', 'spring'], ['July', 'summer'], ['August', 'summer'], ['October', 'autumn'], ['November', 'autumn']];
const OPP: Record<string, string> = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };
const genSeason: Generator = (rng) => {
  const [city, north] = pick(rng, CITIES);
  const [month, sn] = pick(rng, MONTH_SEASON_N);
  const s = north ? sn : OPP[sn];
  return {
    kind: 'choice',
    body: `It’s mid-${month}. What season is it in **${city}**?`,
    options: ['winter', 'spring', 'summer', 'autumn'].map((x) => (x === s ? { text: x, correct: true } : {
      text: x, why: x === OPP[s] ? `That’s the season in the other hemisphere: ${city} is in the ${north ? 'north' : 'south'}.` : 'That’s three months off.',
    })),
    explain: `In ${month} the ${sn === 'summer' || sn === 'spring' ? 'north' : 'south'}ern hemisphere is tilted towards the Sun. ${city} is in the ${north ? 'north' : 'south'}, so it’s ${s} there (seasons are opposite in the two hemispheres).`,
  };
};

const genParallax: Generator = (rng) => {
  const p = pick(rng, [0.02, 0.04, 0.05, 0.1, 0.125, 0.2, 0.25, 0.4, 0.5, 0.8]);
  const ly = (1 / p) * PC_LY;
  return {
    kind: 'number', unit: 'light-years',
    body: `A star’s parallax is **${p}″** (arcseconds). How far away is it, in light-years? (1 parsec ≈ 3.26 light-years.)`,
    answer: ly, tol: ly * 0.01,
    hint: 'Distance in parsecs = 1 ÷ parallax in arcseconds.',
    explain: `1 ÷ ${p} = ${num(1 / p)} pc; × 3.26 ≈ **${sig(ly)} light-years**.`,
  };
};

const genEratosthenes: Generator = (rng) => {
  const D = randInt(rng, 6, 24) * 50;
  const A = Math.round(((D * 360) / 40_000) * (0.9 + rng() * 0.2) * 10) / 10;
  const c = (D * 360) / A;
  return {
    kind: 'number', unit: 'km',
    body: `At noon the Sun is straight overhead in one town. At the same moment, in a town **${big(D)} km** due north, a vertical stick’s shadow makes an angle of **${A}°**. What circumference does that give for Earth, in km?`,
    answer: c, tol: c * 0.005,
    hint: `${A}° is what fraction of 360°?`,
    explain: `${A}° is 1/${sig(360 / A)} of a circle, so the circumference is ${big(D)} × 360 ÷ ${A} ≈ **${big(c)} km**.`,
  };
};

const genParallaxRatio: Generator = (rng) => {
  const k = randInt(rng, 2, 6), p = pick(rng, [0.3, 0.4, 0.6, 0.9]);
  return {
    kind: 'choice',
    body: `Star A has a parallax of ${p}″. Star B’s parallax is ${num(p / k)}″, ${k} times smaller. How do their distances compare?`,
    options: [
      { text: `B is ${k} times as far`, correct: true },
      { text: `B is ${k * k} times as far`, why: 'Parallax angle shrinks in simple proportion to distance; there’s no square here (that’s brightness).' },
      { text: `B is ${k} times nearer`, why: 'Nearer stars shift more. A smaller shift means farther away.' },
      { text: 'They’re the same distance', why: 'Parallax depends only on distance, so different parallaxes mean different distances.' },
    ],
    explain: `Distance = 1 ÷ parallax: A is ${sig(1 / p)} pc, B is ${sig(k / p)} pc: ${k} times as far.`,
  };
};

const genBrightness: Generator = (rng) => {
  const k = randInt(rng, 2, 12);
  return {
    kind: 'number', prob: true,
    body: `Two identical stars: one is **${k} times** as far from us as the other. What fraction as bright does the farther one look?`,
    answer: 1 / (k * k), tol: Math.max(0.0004, 0.01 / (k * k)),
    hint: 'Light spreads over an area that grows with distance squared.',
    explain: `${k}× the distance spreads the light over ${k * k}× the area: 1/${k * k} ≈ ${sig(1 / (k * k))} as bright.`,
  };
};

const genWien: Generator = (rng) => {
  const T = randInt(rng, 6, 60) * 500;
  const l = WIEN / T;
  return {
    kind: 'number', unit: 'nm',
    body: `A star’s surface is about **${T.toLocaleString('en-US')} K**. At what wavelength does its light peak, in nanometres? (Peak ≈ 2,900,000 ÷ T.)`,
    answer: l, tol: l * 0.005,
    explain: `2,900,000 ÷ ${T.toLocaleString('en-US')} ≈ **${sig(l)} nm**${l < 380 ? ': ultraviolet, so the star looks blue-white' : l > 750 ? ': infrared, so the visible light is dominated by red' : ': in the visible band'}.`,
  };
};

const genLifetime: Generator = (rng) => {
  const M = pick(rng, [0.5, 2, 4, 9, 16, 25]);
  const myr = 10_000 * M ** -2.5;
  return {
    kind: 'number', unit: 'million years',
    body: `Rough model: a star’s lifetime ≈ 10 billion years × M⁻²·⁵, with M its mass in Suns. How long does a **${M}-Sun** star shine, in **millions** of years?`,
    answer: myr, tol: myr * 0.02,
    hint: M === 0.5 ? '0.5^−2.5 = 2^2.5 ≈ 5.66.' : `${M}^2.5 = ${M}² × √${M}.`,
    explain: `${M}^2.5 = ${sig(M ** 2.5)}, so 10,000 million ÷ ${sig(M ** 2.5)} ≈ **${sig(myr)} million years**.`,
  };
};

const genHubbleV: Generator = (rng) => {
  const d = randInt(rng, 1, 80) * 10;
  return {
    kind: 'number', unit: 'km/s',
    body: `A galaxy is **${d} Mpc** away. Using Hubble’s law with H₀ ≈ 70 km/s per Mpc, how fast is it moving away?`,
    answer: H0 * d, tol: H0 * d * 0.005,
    explain: `v = H₀ × d = 70 × ${d} = **${big(H0 * d)} km/s**.`,
  };
};

const genHubbleD: Generator = (rng) => {
  const d = randInt(rng, 2, 90) * 5;
  return {
    kind: 'number', unit: 'Mpc',
    body: `A galaxy’s light shows it moving away at **${big(H0 * d)} km/s**. With H₀ ≈ 70 km/s per Mpc, how far away is it?`,
    answer: d, tol: d * 0.005,
    hint: 'd = v ÷ H₀.',
    explain: `${big(H0 * d)} ÷ 70 = **${d} Mpc** (about ${sig(d * 3.26)} million light-years).`,
  };
};

const genAge: Generator = (rng) => {
  const H = randInt(rng, 10, 20) * 5;
  const a = hubbleAgeGyr(H);
  return {
    kind: 'number', unit: 'billion years',
    body: `Suppose you measured H₀ = **${H} km/s per Mpc**. Estimate the universe’s age as 1/H₀, in billions of years. (1 Mpc ≈ 3.09 × 10¹⁹ km; 1 year ≈ 3.16 × 10⁷ s.)`,
    answer: a, tol: a * 0.01,
    hint: 'Divide km per Mpc by H₀ to get seconds, then convert to years.',
    explain: `3.09 × 10¹⁹ ÷ ${H} = ${sig(MPC_KM / H)} s ÷ 3.16 × 10⁷ ≈ **${sig(a)} billion years**.`,
  };
};

const genDrake: Generator = (rng) => {
  const fl = pick(rng, [1, 0.1, 0.01]), fi = pick(rng, [0.1, 0.01, 0.001]), fc = pick(rng, [1, 0.1]), L = pick(rng, [1e3, 1e4, 1e5, 1e6, 1e7]);
  const N = 2 * 1 * 0.2 * fl * fi * fc * L;
  return {
    kind: 'number',
    body: `Drake estimate: 2 stars born a year × 1 (all have planets) × 0.2 habitable planets each × ${num(fl)} (life starts) × ${num(fi)} (intelligence) × ${num(fc)} (transmits) × ${big(L)} years lasting. How many civilisations, N?`,
    answer: N, tol: Math.max(0.001, N * 0.01),
    hint: 'Multiply the plain numbers first, then the powers of ten.',
    explain: `2 × 1 × 0.2 = 0.4; × ${num(fl)} × ${num(fi)} × ${num(fc)} × ${big(L)} = **${sig(N)}**.`,
  };
};

const TRANSITS: [string, number, string, number][] = [
  ['an Earth-sized planet (radius 6,400 km)', 6_400, 'a Sun-like star (radius 696,000 km)', 696_000],
  ['a Neptune-sized planet (radius 24,600 km)', 24_600, 'a Sun-like star (radius 696,000 km)', 696_000],
  ['a Jupiter-sized planet (radius 70,000 km)', 70_000, 'a Sun-like star (radius 696,000 km)', 696_000],
  ['an Earth-sized planet (radius 6,400 km)', 6_400, 'a small red dwarf (radius 140,000 km)', 140_000],
  ['a Jupiter-sized planet (radius 70,000 km)', 70_000, 'a small red dwarf (radius 140,000 km)', 140_000],
];
const genTransitDepth: Generator = (rng) => {
  const [p, r, s, R] = pick(rng, TRANSITS);
  const d = 100 * (r / R) ** 2;
  return {
    kind: 'number', unit: '%',
    body: `${p[0].toUpperCase() + p.slice(1)} crosses the face of ${s}. By what **percentage** does the starlight dip?`,
    answer: d, tol: d * 0.01,
    hint: 'The dip is the fraction of the star’s disc covered: (planet radius ÷ star radius)².',
    explain: `(${big(r)} ÷ ${big(R)})² = ${sig(d / 100)} ≈ **${sig(d)}%**.`,
  };
};

const genTransitChance: Generator = (rng) => {
  const a = pick(rng, [0.05, 0.1, 0.2, 0.5, 1, 2]);
  const p = (100 * 696_000) / (a * AU_KM);
  const ans = Math.round(p * 10) / 10;
  return {
    kind: 'estimate',
    body: `A planet orbits a Sun-like star (radius about 700,000 km) at **${a} AU** (1 AU ≈ 150 million km). The chance its orbit happens to line up so we see transits is about star radius ÷ orbit radius. Roughly what percentage?`,
    min: 0, max: 12, step: 0.1, answer: ans, tol: Math.max(0.2, ans * 0.2), format: (v) => `${v.toFixed(1)}%`,
    explain: `696,000 ÷ ${big(a * AU_KM)} ≈ ${sig(p / 100, 2)}, about **${sig(p, 2)}%**. Close-in planets are far more likely to be caught.`,
  };
};

// ================================================================= course

export const universe: Course = {
  id: 'universe',
  title: 'The Universe by Numbers',
  blurb: 'Sizes, distances, orbits, starlight and the age of everything, worked out from a few numbers.',
  color: '#3f5bd9',
  icon: '🌌',
  lessons: [
    // ============================================================ 1 scale
    {
      id: 'scale',
      title: 'A sense of scale',
      goal: 'Picture sizes from atoms to galaxies with scale models and powers of ten.',
      steps: [
        {
          kind: 'estimate',
          body: 'Shrink the Sun to a **grapefruit**, 14 cm across, and shrink everything else by the same amount. Gut guess: how far away is the model Earth? (The slider moves in powers of ten.)',
          widget: grapefruit(),
          min: -1, max: 5, step: 0.05, answer: gfExp, tol: 0.5, format: fmtLen,
          hint: 'The Sun is about 1.4 million km across; Earth is about 150 million km from it. That’s roughly 100 Sun-widths.',
          explain: `150 million km is about 107 Sun-widths, and 107 × 14 cm ≈ **${sig(gfEarthM, 2)} m**. The model Earth is a ${sig(gfEarthMm, 2)} mm grain about 15 big steps from the grapefruit.`,
        },
        {
          kind: 'read',
          title: 'The grapefruit model',
          body: 'At this scale, 1 cm stands for 100,000 km. Earth is a 1.3 mm pinhead 15 m from the grapefruit, Jupiter a grape 78 m away, Neptune a peppercorn nearly half a km away. Change the Sun’s size and watch everything scale with it.',
          widget: scaleModel(),
        },
        {
          kind: 'number', unit: 'cm',
          body: 'In the grapefruit model (1 cm = 100,000 km), the Moon is about 384,000 km from Earth. How many **centimetres** from the model Earth is the model Moon?',
          answer: gfMoonCm, tol: 0.05,
          hint: 'Divide by 100,000.',
          explain: `384,000 ÷ 100,000 = **${num(gfMoonCm)} cm**: the whole Earth–Moon system fits in your palm, while the Sun is 15 m away.`,
        },
        {
          kind: 'choice',
          body: 'The nearest star, Proxima Centauri, is about 4.2 light-years away: about 40 trillion km. In the grapefruit model, where is it?',
          options: [
            { text: 'About 4,000 km away: across a continent', correct: true },
            { text: 'Across a big room, about 10 m away', why: 'That would put it closer than Earth, which is already 15 m out.' },
            { text: 'Across a town, about 3 km away', why: `Neptune alone is ${sig((neptuneKm * cmPerKm) / 100, 2)} m out, and the star is thousands of times farther than Neptune.` },
            { text: 'Most of the way to the real Moon', why: `That overshoots: 40 trillion km ÷ 100,000 km per cm = ${words(proximaKm * cmPerKm)} cm, which is about 4,000 km.` },
          ],
          hint: '40 trillion ÷ 100,000 gives centimetres. Then 100,000 cm = 1 km.',
          explain: `40 trillion ÷ 100,000 = 400 million cm = **${big(Math.round(gfProximaKm / 10) * 10)} km**. Two grapefruits a continent apart, with a few grains of sand between: space is mostly empty.`,
        },
        {
          kind: 'read',
          title: 'Powers of ten',
          body: 'Lengths in the universe span over 40 powers of ten. Each notch on this slider is ten times the last. Slide from a proton up to the observable universe.',
          widget: powersOfTen(),
        },
        {
          kind: 'match',
          body: 'Match each thing to its size, to the nearest power of ten.',
          heads: ['Thing', 'Size'],
          pairs: [['An atom', '10⁻¹⁰ m'], ['A person', '10⁰ m (1 m)'], ['Earth’s diameter', '10⁷ m'], ['Earth to Sun', '10¹¹ m'], ['The Milky Way', '10²¹ m']],
          hint: '1 km = 10³ m. Earth is 12,700 km; the Earth–Sun distance is 150 million km.',
          explain: `Earth: 1.27 × 10⁷ m. Earth–Sun: 1.5 × 10¹¹ m. The Milky Way is 100,000 light-years ≈ ${sci(1e5 * LY_KM * 1000)} m, closest to 10²¹. An atom is about a ten-billionth of a metre.`,
        },
        {
          kind: 'order',
          body: 'Put these in order of size, **smallest first**.',
          items: ['The Moon’s diameter', 'Jupiter’s diameter', 'The diameter of the Moon’s orbit round Earth', 'The Sun’s diameter', 'The Earth–Sun distance', 'The diameter of Neptune’s orbit'],
          hint: 'Moon 3,500 km; Jupiter 140,000 km; the Moon orbits 384,000 km out; Sun 1.4 million km.',
          explain: `3,500 km < 140,000 km < ${big(2 * MOON_KM)} km < 1.4 million km < 150 million km < 9 billion km. The surprise: the Sun is almost twice as wide as the Moon’s whole orbit.`,
        },
        {
          kind: 'multi',
          body: 'Which of these are true? Select all that apply.',
          options: [
            { text: 'The Sun is wider than the whole orbit of the Moon', correct: true, why: `1.4 million km against ${big(2 * MOON_KM)} km.` },
            { text: 'The solar system is almost entirely empty space', correct: true, why: 'A grapefruit and a few grains spread over a kilometre.' },
            { text: 'A light-year is a length of time', why: 'It’s a distance: how far light goes in a year, about 9.5 trillion km.' },
            { text: 'The nearest star is a few times farther than Neptune', why: `Neptune is about 4.5 billion km out; the nearest star about 40 trillion km. That’s about ${big(Math.round(proximaKm / neptuneKm / 1000) * 1000)} times farther.` },
          ],
          explain: 'Sizes are tiny compared with the gaps between them. The Sun dwarfs the Earth–Moon system, and the stars are thousands of times farther than the planets.',
        },
        {
          kind: 'estimate',
          body: 'About how many stars are in our galaxy, the Milky Way?',
          min: 4, max: 14, step: 0.5, answer: 11, tol: 1, format: (v) => `≈ ${words(10 ** v)}`,
          hint: 'Far more than the few thousand you can see by eye.',
          explain: 'Estimates run from about 100 to 400 billion: around **10¹¹**. The few thousand stars visible by eye are our close neighbours.',
        },
        {
          kind: 'number', unit: 'widths',
          body: 'The Milky Way is about 100,000 light-years across. The Andromeda galaxy is about 2.5 million light-years away. How many Milky Way widths is that?',
          answer: 25, tol: 0.1,
          explain: '2,500,000 ÷ 100,000 = **25**. Galaxies are far apart compared with their size, but nowhere near as far apart, relatively, as stars are.',
        },
        {
          kind: 'sort',
          body: 'Where is each one?',
          bins: ['In our solar system', 'In the Milky Way, beyond the solar system', 'Beyond the Milky Way'],
          items: [
            { text: 'The Moon', bin: 0 }, { text: 'Pluto', bin: 0 }, { text: 'Halley’s Comet', bin: 0 },
            { text: 'Proxima Centauri', bin: 1 }, { text: 'The Orion Nebula', bin: 1 },
            { text: 'The Andromeda galaxy', bin: 2 }, { text: 'The Large Magellanic Cloud', bin: 2 },
          ],
          hint: 'Every single star you can see by eye is in the Milky Way. Galaxies are separate islands of stars.',
          explain: 'Moon, Pluto and Halley’s Comet orbit the Sun. Proxima and the Orion Nebula (a star nursery about 1,300 light-years away) are in our galaxy. Andromeda and the Large Magellanic Cloud are other galaxies.',
        },
        {
          kind: 'read',
          title: 'Thinking at scale',
          body: '- Build a scale model: pick one size, divide everything by the same factor.\n- Think in powers of ten: being off by 30% is close; being off by 1,000× is a different universe.\n- Space is mostly gap: planets are grains metres apart, and stars are continents apart.',
        },
      ],
      practice: [genScaleModel, genNearestPower, genRatio],
    },

    // ============================================================ 2 light
    {
      id: 'light',
      title: 'Light takes time',
      goal: 'Turn distances into light-travel times, and see that looking out is looking back.',
      steps: [
        {
          kind: 'choice',
          body: 'Suppose the Sun suddenly vanished. How long before we on Earth would notice the light go out?',
          options: [
            { text: 'About 8 minutes', correct: true },
            { text: 'Instantly', why: 'Light is fast but not instant. Its speed is finite: about 300,000 km every second.' },
            { text: 'About 1 second', why: 'That’s roughly the light time to the Moon, which is 400 times nearer than the Sun.' },
            { text: 'About 8 hours', why: 'That’s 60 times too long: 150 million km at 300,000 km/s is a few hundred seconds.' },
          ],
          hint: 'The Sun is about 150 million km away; light goes about 300,000 km/s.',
          explain: `150,000,000 ÷ 300,000 = ${big(sunSec)} s ≈ **8 minutes 20 seconds**. Gravity also travels at light speed, so Earth would keep circling the empty spot for those 8 minutes too.`,
        },
        {
          kind: 'read',
          title: '300,000 km every second',
          body: 'Light could go round Earth more than seven times in a second. Here are Earth and the Moon **to scale**, with a flash of light crossing at its **real speed**.',
          widget: moonPulse(),
        },
        {
          kind: 'number', unit: 's',
          body: 'The Moon is about 384,000 km away. How many seconds does its light take to reach us?',
          answer: moonSec, tol: 0.02,
          hint: 'Time = distance ÷ speed.',
          explain: `384,000 ÷ 300,000 = **${num(moonSec)} s**. Astronauts talking from the Moon had a pause of over 2.5 s for a reply.`,
        },
        {
          kind: 'number', unit: 'min',
          body: 'The Sun is about 150 million km away. How many **minutes** does sunlight take to reach Earth?',
          answer: sunSec / 60, tol: 0.1,
          hint: 'Find the seconds first, then divide by 60.',
          explain: `150,000,000 ÷ 300,000 = ${big(sunSec)} s; ÷ 60 ≈ **${sig(sunSec / 60)} min**. The Sun you see is the Sun of 8 minutes ago.`,
        },
        {
          kind: 'fill',
          body: 'Build the light-year.',
          template: 'A light-year is how far light goes in one [[0]]: 300,000 km/s × about [[1]] seconds ≈ [[2]] km.',
          blanks: [
            { options: ['year', 'day', 'second'], answer: 0 },
            { options: ['86,400', '31.6 million', '3,600'], answer: 1 },
            { options: [words(LY_KM), words(LY_KM / 1000), words(C_KMS * 86_400)], answer: 0 },
          ],
          hint: 'Seconds in a year: 60 × 60 × 24 × 365¼.',
          explain: `A year is ${big(YEAR_S)} s ≈ 31.6 million s. × 300,000 km/s ≈ **${words(LY_KM)} km**. A light-year is a distance, named after the time light takes.`,
        },
        {
          kind: 'choice',
          body: 'Proxima Centauri is 4.2 light-years away. What does that tell you?',
          options: [
            { text: 'Its light takes 4.2 years to reach us', correct: true },
            { text: 'It is 4.2 years old', why: 'A light-year is a distance, not an age. Stars are millions to billions of years old.' },
            { text: 'A rocket could get there in 4.2 years', why: `Only light gets there in 4.2 years. At Voyager 1’s 17 km/s, the trip would take about ${big(Math.round(voyagerYears / 1000) * 1000)} years.` },
            { text: 'It’s 4.2 times as far as the Sun', why: `The Sun is 8 light-minutes away; 4.2 light-years is about ${big(Math.round((4.2 * YEAR_S) / sunSec / 1000) * 1000)} times farther.` },
          ],
          explain: '4.2 light-years means light needs 4.2 years for the trip, which is about 40 trillion km.',
        },
        {
          kind: 'read',
          title: 'Looking out is looking back',
          body: 'Imagine a flash set off here. Slide time forward and watch how far its light has got. Read it backwards too: the light we see from each object left it that long ago. We see the Sun as it was 8 minutes ago and Andromeda as it was 2.5 million years ago.',
          widget: lightReach(),
        },
        {
          kind: 'order',
          body: 'Order by how long their light takes to reach us, **shortest first**.',
          items: ['The Moon', 'The Sun', 'Neptune', 'Proxima Centauri', 'The centre of the Milky Way', 'The Andromeda galaxy'],
          hint: 'Planets are light-minutes or light-hours away; stars are light-years away.',
          explain: '1.3 s; 8 min; about 4 h; 4.2 years; about 26,000 years; about 2.5 million years.',
        },
        {
          kind: 'estimate',
          body: 'You spot the Andromeda galaxy on a dark night, 2.5 million light-years away. How long ago did that light leave it?',
          min: 0, max: 10, step: 0.1, answer: andromedaExp, tol: 0.5, format: (v) => yearsFmt(v) + ' ago',
          explain: 'About **2.5 million years ago**, when early human relatives were just starting to make stone tools. You’re seeing a galaxy’s past, not its present.',
        },
        {
          kind: 'multi',
          body: 'You look at a star 1,000 light-years away. Which can you conclude? Select all that apply.',
          options: [
            { text: 'You see it as it was about 1,000 years ago', correct: true, why: 'The light set off 1,000 years ago.' },
            { text: 'It may have changed since then', correct: true, why: 'Anything that happened in the last 1,000 years hasn’t reached us yet.' },
            { text: 'It has almost certainly burned out by now', why: 'Most stars shine for billions of years. A thousand years is nothing to a star.' },
            { text: 'Its light took 1,000 days to arrive', why: 'Each light-year takes a year, not a day.' },
          ],
          explain: 'Distance in light-years is also the age of the light. The farther you look, the older the view, but a few thousand years is a blink for a star.',
        },
        {
          kind: 'match',
          body: 'Match each light-travel distance to what’s that far away.',
          heads: ['Light time', 'Object'],
          pairs: [['1.3 light-seconds', 'The Moon'], ['8 light-minutes', 'The Sun'], ['4.2 light-years', 'The nearest star'], ['100,000 light-years', 'Across the Milky Way'], ['2.5 million light-years', 'The Andromeda galaxy']],
          explain: 'Each step out multiplies the light time hugely: seconds, minutes, years, a hundred thousand years, millions of years.',
        },
        {
          kind: 'number', unit: 'min',
          body: 'Mars is about 225 million km away (it varies a lot). A rover driver sends a command. How many **minutes** until she sees the rover’s reply, assuming it answers at once?',
          answer: marsRoundMin, tol: 0.2,
          hint: 'The command goes there, and the reply comes back.',
          explain: `One way: 225,000,000 ÷ 300,000 = 750 s. There and back: 1,500 s = **${num(marsRoundMin)} min**. That’s why Mars rovers drive themselves.`,
        },
        {
          kind: 'read',
          title: 'Light as a ruler and a clock',
          body: '- Light-travel time = distance ÷ 300,000 km/s.\n- The Moon is 1.3 light-seconds away, the Sun 8 light-minutes, the nearest star 4.2 light-years.\n- Every view of the sky is a view of the past: the farther, the older.',
        },
      ],
      practice: [genLightTime, genRadar, genLookback],
    },

    // ============================================================ 3 orbits
    {
      id: 'orbits',
      title: 'Orbits and gravity',
      goal: 'Use the inverse-square law, see an orbit as endless falling, and apply Kepler’s third law.',
      steps: [
        {
          kind: 'choice',
          body: 'Astronauts float inside the Space Station, about 400 km up. Compared with the ground, how strong is Earth’s gravity up there?',
          options: [
            { text: 'About 90% as strong', correct: true },
            { text: 'Zero: there’s no gravity in space', why: 'Gravity reaches out forever, weakening with distance. It’s what holds the Moon, 384,000 km away, in orbit.' },
            { text: 'About half as strong', why: '400 km is small next to Earth’s 6,400 km radius, so the distance from Earth’s centre barely changes.' },
            { text: 'About 1% as strong', why: 'That would need you to be 10 Earth radii away, about 64,000 km from the centre.' },
          ],
          hint: 'Gravity depends on the distance from Earth’s centre: 6,400 km on the ground, 6,800 km at the station.',
          explain: `(6,400 ÷ 6,800)² ≈ ${sig(issFrac, 2)}: about **90%**. Astronauts float not because gravity has gone but because they are falling. More on that soon.`,
        },
        {
          kind: 'read',
          title: 'Double the distance, a quarter of the pull',
          body: 'Gravity weakens with the **square** of the distance from Earth’s centre: twice as far, 1/4 the pull; three times, 1/9; ten times, 1/100. Slide the satellite out and watch the arrow shrink.',
          widget: inverseSquare(),
        },
        {
          kind: 'number', prob: true,
          body: 'A satellite is 3 Earth radii from Earth’s centre. What fraction of surface gravity does it feel?',
          answer: 1 / 9, tol: 0.003,
          hint: 'Square the distance, then flip it.',
          explain: '3² = 9, so the pull is **1/9** ≈ 11% of surface gravity.',
        },
        {
          kind: 'fill',
          body: 'Complete the pattern.',
          template: 'Twice as far: pull × [[0]]. Ten times as far: pull × [[1]]. The Moon is about 60 Earth radii away, so Earth’s pull there is [[2]] of surface gravity.',
          blanks: [
            { options: ['1/2', '1/4', '1/8'], answer: 1 },
            { options: ['1/10', '1/100', '1/1,000'], answer: 1 },
            { options: ['1/60', '1/3,600', '1/216,000'], answer: 1 },
          ],
          hint: `384,000 ÷ 6,400 = ${MOON_KM / EARTH_R_KM}.`,
          explain: '1/2² = 1/4, 1/10² = 1/100 and 1/60² = 1/3,600. Newton checked exactly this: the Moon falls towards Earth 3,600 times more gently than an apple.',
        },
        {
          kind: 'read',
          title: 'Newton’s cannon',
          body: 'Fire a cannonball sideways from a very tall mountain (and ignore the air). Faster shots land farther away. Fast enough, and the ground curves away as fast as the ball falls: it never lands. Try it.',
          widget: cannon(),
        },
        {
          kind: 'task',
          body: 'Find a launch speed that puts the cannonball **in orbit**: it never lands, and it doesn’t escape.',
          widget: cannon((v) => v >= 8 && v <= 11, 'In orbit: falling all the way round.'),
          hint: 'Too slow and it falls back; too fast and it leaves for good.',
          explain: `Set the speed to anything from **8 to 11 km/s**. Below about ${sig(vCircTop, 2)} km/s the ball falls back; from there up to about ${sig(vEscTop, 3)} km/s it orbits (a circle near 7.9 km/s, longer ovals above); beyond that it escapes.`,
        },
        {
          kind: 'multi',
          body: 'Why do astronauts on the Space Station feel weightless? Select all that apply.',
          options: [
            { text: 'They and the station are falling together', correct: true, why: 'With nothing pushing up on them, falling feels like floating.' },
            { text: 'They move sideways so fast they keep missing Earth', correct: true, why: 'About 7.7 km/s: they fall around Earth instead of into it.' },
            { text: 'There’s no gravity up there', why: 'Gravity at 400 km is about 90% of what it is on the ground.' },
            { text: 'They’re above the air, and gravity needs air', why: 'Gravity works through empty space: it holds the Moon and the planets.' },
            { text: 'The Moon’s pull cancels Earth’s', why: 'Near Earth the Moon’s pull is over 100,000 times weaker than Earth’s.' },
          ],
          explain: 'An orbit is free fall with enough sideways speed to keep missing the ground. Everything aboard falls at the same rate, so nothing presses on anything.',
        },
        {
          kind: 'number', unit: 'km/s',
          body: 'The Space Station circles at about 6,800 km from Earth’s centre and goes round once every 92 minutes. What is its speed in km/s?',
          answer: issSpeed, tol: 0.1,
          hint: 'Distance round the circle = 2π × radius. Then divide by the time in seconds.',
          explain: `2π × 6,800 ≈ ${big(2 * Math.PI * 6800)} km in 92 × 60 = 5,520 s: about **${sig(issSpeed)} km/s**, roughly 28,000 km/h.`,
        },
        {
          kind: 'read',
          title: 'Kepler’s third law',
          body: 'Farther planets take longer to go round. Kepler found the exact rule: with the period T in years and the distance a in AU (1 AU = Earth–Sun = 150 million km),\n\n**T² = a³**\n\nOn log scales every planet sits on one straight line with slope 3/2.',
          widget: () => h('div', null,
            plotEl(keplerPlot()),
            smallTable(dataTable(['Planet', 'a', 'T', 'a³', 'T²'], PLANETS.filter((p) => ['Mercury', 'Earth', 'Mars', 'Jupiter', 'Neptune'].includes(p.name)).map((p) => [p.name, p.a, p.T, sig(p.a ** 3, 2), sig(p.T ** 2, 2)]),
              { caption: 'a in AU, T in years: a³ and T² match' }))),
        },
        {
          kind: 'number', unit: 'years',
          body: 'Mars orbits at about 1.52 AU. Using T² = a³, how long is a Mars year, in Earth years?',
          answer: marsT, tol: 0.03,
          hint: '1.52³, then the square root.',
          explain: `1.52³ ≈ ${sig(1.52 ** 3)}; √${sig(1.52 ** 3)} ≈ **${sig(marsT)} years**, about 687 days.`,
        },
        {
          kind: 'task',
          body: 'Here a year passes in 2 seconds. Set the orbit so the orange planet takes **8 years** to go round.',
          widget: keplerOrbit((a) => a === 4, 'Eight years per orbit.'),
          hint: 'T² = 64. What cubed gives 64?',
          explain: 'T = 8, so T² = 64 = 4³: set the orbit to **4 AU**. Notice it’s 4 times as far but takes 8 times as long: the path is longer and the planet moves more slowly.',
        },
        {
          kind: 'point',
          body: 'A distant icy world orbits at **100 AU**. Place it on the log-log Kepler plot.',
          plot: keplerPlot(),
          answer: { x: 2, y: 3 }, tol: 0.25, snap: 0.25,
          hint: '100 AU is at 10² on the distance axis. Its period is √(100³).',
          explain: '100³ = 1,000,000, and √1,000,000 = 1,000 years: the point (10², 10³), on the same line as the planets.',
        },
        {
          kind: 'choice',
          body: 'A satellite is boosted into a higher orbit. What happens to the time it takes to go round?',
          options: [
            { text: 'It gets longer', correct: true },
            { text: 'It gets shorter', why: 'A higher orbit is a longer path, and the weaker gravity there means a slower orbit too.' },
            { text: 'It stays the same', why: 'Period depends on orbit size: T² ∝ a³. The Moon, far out, takes 27 days; the Space Station 92 minutes.' },
          ],
          explain: 'Higher orbits are longer and slower. That’s why TV satellites sit 36,000 km up: there one orbit takes exactly a day, so they hover over one spot.',
        },
        {
          kind: 'read',
          title: 'Gravity by numbers',
          body: '- Pull ∝ 1/distance²: double the distance, a quarter of the pull.\n- An orbit is falling sideways fast enough to keep missing: about 8 km/s near Earth.\n- T² = a³ (years, AU): farther out means a longer year.',
        },
      ],
      practice: [genGravity, genKepler, genKeplerInv],
    },

    // ============================================================ 4 seasons and the Moon
    {
      id: 'seasons',
      title: 'Seasons and the Moon',
      goal: 'Explain seasons by tilt, phases by geometry, and why we always see the same face of the Moon.',
      steps: [
        {
          kind: 'choice',
          body: 'Why is it warmer in summer than in winter?',
          options: [
            { text: 'Earth’s tilt makes sunlight hit more directly and days longer', correct: true },
            { text: 'Earth is closer to the Sun in summer', why: 'Earth is closest to the Sun in early January, in the middle of the northern winter. And when it’s summer in the north it’s winter in the south, at the same distance.' },
            { text: 'The Sun burns hotter in summer', why: 'The Sun’s output is steady to about 0.1%. The difference is how its light lands on us.' },
          ],
          explain: 'Earth’s axis is tilted about 23.4°. The hemisphere leaning towards the Sun gets high, direct sunlight and long days: summer.',
        },
        {
          kind: 'read',
          title: 'Distance barely changes',
          body: 'Earth’s orbit is almost a circle. Its distance from the Sun changes by only about 3%, and it’s **closest in January**.',
          widget: () => barChart([
            { label: 'early January', value: 149.6 * (1 - 0.0167), note: 'closest' },
            { label: 'early July', value: 149.6 * (1 + 0.0167), note: 'farthest' },
          ], { max: 160, format: (v) => `${sig(v, 4)} million km` }),
        },
        {
          kind: 'read',
          title: 'Low Sun, spread-out light',
          body: 'The same beam of sunlight covers more ground when the Sun is low, so each square metre gets less. Lower the Sun and watch the patch stretch.',
          widget: sunBeam(),
        },
        {
          kind: 'number', unit: '×',
          body: 'At noon in winter the Sun is 30° above the horizon. The beam’s light is spread over 1 ÷ sin 30° times the area it would cover if the Sun were overhead. How many times?',
          answer: 2, tol: 0.02,
          hint: 'sin 30° = 0.5.',
          explain: '1 ÷ 0.5 = **2**: each square metre gets half the sunlight it would from an overhead Sun. Add short days, and winter is cold.',
        },
        {
          kind: 'task',
          body: 'Earth’s axis always points the same way in space. Move Earth round its orbit to the **southern hemisphere’s midsummer** (its longest day).',
          widget: seasonOrbit((m) => m === 11, 'Southern midsummer: the south leans towards the Sun.'),
          hint: 'You want the South Pole tipped towards the Sun, so the North Pole tipped away.',
          explain: 'Slide to **21 December**. There the north end of the axis leans away from the Sun and the south towards it: midsummer in the south, midwinter in the north, even though Earth is nearly at its closest to the Sun.',
        },
        {
          kind: 'sort',
          body: 'Which goes with **northern summer**, and which with **northern winter**?',
          bins: ['Northern summer', 'Northern winter'],
          items: [
            { text: 'The North Pole leans towards the Sun', bin: 0 },
            { text: 'Long days in London', bin: 0 },
            { text: 'Winter in Australia', bin: 0 },
            { text: 'Low noon Sun in New York', bin: 1 },
            { text: 'Summer in Argentina', bin: 1 },
            { text: 'Earth at its closest to the Sun', bin: 1 },
          ],
          hint: 'Hemispheres have opposite seasons. And remember when Earth is closest to the Sun.',
          explain: 'Northern summer: pole tipped towards the Sun, long days in the north, winter in the south. Northern winter: low Sun in the north, summer in the south, and, in early January, Earth at its closest to the Sun.',
        },
        {
          kind: 'number', unit: '°',
          body: 'At latitude 40°N (Madrid, New York), how high above the horizon is the noon Sun on the June solstice?',
          answer: 90 - 40 + TILT, tol: 0.3,
          hint: 'At an equinox the noon Sun is 90° − latitude high. At the June solstice, add the tilt, 23.4°.',
          explain: `90 − 40 + 23.4 = **${num(90 - 40 + TILT)}°**. In December it’s 90 − 40 − 23.4 = ${num(90 - 40 - TILT)}°, and the beam is spread over ${sig(Math.sin(((90 - 40 + TILT) * Math.PI) / 180) / Math.sin(((90 - 40 - TILT) * Math.PI) / 180), 2)} times as much ground.`,
        },
        {
          kind: 'read',
          title: 'Phases are geometry',
          body: 'The Sun always lights half the Moon. As the Moon goes round us, we see different amounts of that lit half. Press Play to run through a month.',
          widget: moonCycle(),
        },
        {
          kind: 'task',
          body: 'Move the Moon so we see a **first quarter** (the right half lit, in the northern hemisphere).',
          widget: moonPhases((e) => e === 90, 'First quarter: a quarter of the way round.'),
          hint: 'It comes a week after new moon, when the Moon has gone a quarter of the way round.',
          explain: 'Set it to **90°**, a quarter orbit past new moon. The Sun–Earth–Moon angle is a right angle, so we look at the lit half side-on and see half of the disc lit.',
        },
        {
          kind: 'match',
          body: 'Match each position of the Moon to the phase we see.',
          heads: ['Where the Moon is', 'Phase'],
          pairs: [['Roughly between Earth and Sun', 'New moon'], ['A quarter orbit past new', 'First quarter'], ['On the far side of Earth from the Sun', 'Full moon'], ['Three quarters of the way round', 'Third quarter']],
          explain: 'Between us and the Sun, its lit side faces away (new). Opposite the Sun, the lit side faces us (full). At the quarter points we see half the disc lit.',
        },
        {
          kind: 'choice',
          body: 'What causes the Moon’s phases?',
          options: [
            { text: 'We see different amounts of its sunlit half', correct: true },
            { text: 'Earth’s shadow covers part of the Moon', why: 'That’s a lunar eclipse, which can only happen at full moon. Crescents happen when the Moon is nowhere near Earth’s shadow.' },
            { text: 'Clouds of dust drift across it', why: 'The Moon has no thick atmosphere, and phases repeat like clockwork every 29.5 days.' },
            { text: 'The Moon gives off less light some nights', why: 'The Moon makes no light of its own; it only reflects sunlight.' },
          ],
          explain: 'Phases are pure viewing angle: half the Moon is always lit, and its position in its orbit decides how much of that half faces us.',
        },
        {
          kind: 'read',
          title: 'Why we see one face',
          body: 'The Moon spins exactly once for every trip round Earth (about 27 days), so the same side always faces us. Compare a Moon that doesn’t spin at all.',
          widget: tidalLock(),
        },
        {
          kind: 'choice',
          body: 'The Moon takes about 27 days to orbit Earth. How long does it take to spin once on its axis?',
          options: [
            { text: 'About 27 days', correct: true },
            { text: 'It doesn’t spin at all', why: 'A Moon that didn’t spin would show us every side during a month, as the right-hand picture showed.' },
            { text: 'About a day, like Earth', why: 'Then we’d see all of its faces turn past every day or so.' },
            { text: 'About a year', why: 'Then it would turn too slowly to keep one face towards us.' },
          ],
          explain: 'Spin and orbit are locked together, both about 27 days. Earth’s tides slowed the young Moon’s spin until they matched; this is called tidal locking.',
        },
      ],
      practice: [genNoonSun, genPhase, genSeason],
    },

    // ============================================================ 5 measuring
    {
      id: 'measuring',
      title: 'Measuring the unmeasurable',
      goal: 'Measure distances to stars with parallax and the size of Earth with shadows.',
      steps: [
        {
          kind: 'choice',
          body: 'Hold your thumb up at arm’s length. Close one eye, then the other: your thumb jumps against the background. What happens to the jump if you bring your thumb closer?',
          options: [
            { text: 'It gets bigger', correct: true },
            { text: 'It gets smaller', why: 'Try it: close objects shift the most. Distant mountains hardly shift at all.' },
            { text: 'It stays the same', why: 'The jump depends on how far the thumb is compared with the gap between your eyes.' },
          ],
          explain: 'Each eye sees from a slightly different spot. The nearer the object, the bigger the angle between the two views. That shift is **parallax**.',
        },
        {
          kind: 'read',
          title: 'Parallax',
          body: 'Your eyes are about 6.5 cm apart: that’s the **baseline**. Slide the thumb and watch the jump.',
          widget: thumbParallax(),
        },
        {
          kind: 'choice',
          body: `At 60 cm your thumb jumps about ${sig(thumbDeg(60), 2)}°. A pencil at 3 m (5 times as far) would jump about how much?`,
          options: [
            { text: `About ${sig(thumbDeg(300), 2)}°, a fifth as much`, correct: true },
            { text: `About ${sig(thumbDeg(60), 2)}°, the same`, why: 'The baseline is the same but the object is farther, so the angle shrinks.' },
            { text: `About ${sig(thumbDeg(60) / 25, 2)}°, a 25th as much`, why: 'Small angles shrink in simple proportion to distance. The square is for brightness, not parallax.' },
            { text: `About ${sig(thumbDeg(60) * 5, 2)}°, five times as much`, why: 'Farther things shift less, not more.' },
          ],
          explain: 'For small angles, shift ≈ baseline ÷ distance. Five times the distance, a fifth of the shift. So measure the shift, and you know the distance.',
        },
        {
          kind: 'read',
          title: 'Stellar parallax',
          body: 'For stars we need a much bigger baseline: Earth’s orbit. Six months apart, Earth is 300 million km from where it was, and a nearby star shifts a tiny bit against far ones.\n\nAstronomers define a **parsec** (about 3.26 light-years) so that **distance in parsecs = 1 ÷ parallax in arcseconds** (an arcsecond is 1/3,600 of a degree).',
          widget: stellarParallax(),
        },
        {
          kind: 'fill',
          body: 'Use the parsec rule.',
          template: 'A parallax of 0.5″ means the star is [[0]] parsecs away, which is about [[1]] light-years.',
          blanks: [
            { options: ['0.5', '2', '4'], answer: 1 },
            { options: ['3.26', '6.5', '13'], answer: 1 },
          ],
          hint: 'Distance = 1 ÷ parallax. Then × 3.26.',
          explain: `1 ÷ 0.5 = 2 parsecs; 2 × 3.26 ≈ **${sig(2 * PC_LY, 2)} light-years**.`,
        },
        {
          kind: 'task',
          body: 'Set the star’s distance so that its parallax is **0.25″**.',
          widget: stellarParallax((d) => d === 4, 'Parallax 0.25″.'),
          hint: 'Distance in parsecs = 1 ÷ parallax.',
          explain: `1 ÷ 0.25 = **4 parsecs**, about ${sig(4 * PC_LY, 2)} light-years. Even the nearest star, at 1.3 parsecs, shows only 0.77″.`,
        },
        {
          kind: 'choice',
          body: 'Ancient Greek astronomers looked for stellar parallax and saw none. Some concluded Earth doesn’t move. What was really going on?',
          options: [
            { text: 'Stars are so far that the shift is under 1 arcsecond, far too small for the naked eye', correct: true },
            { text: 'They were right: Earth stays still', why: 'Earth does orbit the Sun; the parallax exists. It was finally measured in 1838.' },
            { text: 'Stars move too fast to track', why: 'Stars’ own motions are tiny too. The problem is how small the angles are.' },
            { text: 'Parallax only works with telescopes, not eyes', why: 'Your thumb proves eyes see parallax fine. The biggest stellar shift is about 80 times smaller than the eye can resolve.' },
          ],
          explain: 'The eye can resolve about 1 arcminute, 60″. The biggest stellar parallax is 0.77″. Not seeing a shift was actually evidence of enormous distances.',
        },
        {
          kind: 'number', unit: 'light-years',
          body: 'A star has a parallax of **0.05″**. How far away is it in light-years?',
          answer: (1 / 0.05) * PC_LY, tol: 0.5,
          hint: 'Parsecs first: 1 ÷ 0.05.',
          explain: `1 ÷ 0.05 = 20 parsecs; × 3.26 ≈ **${sig(20 * PC_LY)} light-years**.`,
        },
        {
          kind: 'read',
          title: 'Eratosthenes measures Earth',
          body: 'Around 240 BC, Eratosthenes heard that at noon on midsummer’s day the Sun shone straight down a well in Syene, casting no shadow. In Alexandria, about 800 km north, a stick cast a shadow at the same time. Because sunbeams arrive parallel, **the shadow angle equals the angle between the two cities at Earth’s centre**. Slide the angle and watch the circumference.',
          widget: eratosthenes(),
        },
        {
          kind: 'number', unit: 'km',
          body: 'Try it yourself: the Sun is overhead in one town, and in a town 500 km due north a stick’s shadow makes an angle of **4.5°**. What is Earth’s circumference?',
          answer: (500 * 360) / 4.5, tol: 100,
          hint: '4.5° is 1/80 of 360°.',
          explain: `4.5° is 1/80 of a full circle, so the circumference is 80 × 500 = **${big((500 * 360) / 4.5)} km**. Eratosthenes’s shadow was about 7.2°, a fiftieth of a circle: 50 × 800 = 40,000 km.`,
        },
        {
          kind: 'order',
          body: 'Put Eratosthenes’s reasoning in order.',
          items: [
            'At noon on midsummer’s day, the Sun is straight overhead at Syene',
            'At the same moment, measure a stick’s shadow angle in Alexandria',
            'Parallel sunbeams make that angle equal to the angle at Earth’s centre',
            'Work out what fraction of 360° the angle is',
            'Multiply the distance between the cities by the same factor',
          ],
          explain: 'Overhead Sun in one place, a measured shadow in another, the same angle at the centre, then scale up: 7.2° is 1/50 of a circle, so Earth is 50 × 800 km round.',
        },
        {
          kind: 'multi',
          body: 'Which assumptions does Eratosthenes’s method need? Select all that apply.',
          options: [
            { text: 'The Sun is so far away that its rays arrive parallel', correct: true, why: 'Otherwise the shadow angle wouldn’t equal the angle at the centre.' },
            { text: 'Earth is round', correct: true, why: 'The method measures a curve; a flat Earth gives the same shadow everywhere under a distant Sun.' },
            { text: 'Syene is roughly due south of Alexandria', correct: true, why: 'The 800 km must run along the curve the angle measures.' },
            { text: 'The Sun goes round Earth', why: 'It doesn’t matter what goes round what; only the angle of the sunlight at one moment.' },
            { text: 'Knowing the distance to the Sun', why: 'Only that it’s very far, so the rays are parallel.' },
          ],
          explain: 'Parallel rays, a round Earth and a north–south baseline are all the method needs. With them, a stick and a measured walk sized the planet to within a few per cent.',
        },
        {
          kind: 'read',
          title: 'Distances from angles',
          body: '- Parallax: shift ≈ baseline ÷ distance, so a measured shift gives a distance.\n- Stars: distance (parsecs) = 1 ÷ parallax (arcseconds); 1 parsec ≈ 3.26 light-years.\n- Eratosthenes: one angle and one distance sized the whole Earth.',
        },
      ],
      practice: [genParallax, genEratosthenes, genParallaxRatio],
    },

    // ============================================================ 6 stars
    {
      id: 'stars',
      title: 'Starlight',
      goal: 'Use the inverse-square law for brightness, read temperature from colour, and see how mass sets a star’s life.',
      steps: [
        {
          kind: 'choice',
          body: 'Two identical streetlights: one is 3 times as far from you as the other. How bright does the far one look?',
          options: [
            { text: '1/9 as bright', correct: true },
            { text: '1/3 as bright', why: 'The light spreads out both sideways and up-down, so the area grows as distance squared.' },
            { text: '1/6 as bright', why: 'Not double the distance: square it. 3 × 3 = 9.' },
            { text: 'Just as bright: it’s the same bulb', why: 'Same bulb, but its light is spread over a much bigger area by the time it reaches you.' },
          ],
          explain: 'Three times as far, the light covers 3 × 3 = 9 times the area, so each bit of it, including your eye, gets **1/9**.',
        },
        {
          kind: 'read',
          title: 'Light spreads over d²',
          body: 'The light passing through one square at distance 1 is spread over 4 squares at distance 2, 9 at distance 3. **Brightness ∝ 1 / distance²**, the same rule as gravity.',
          widget: lightSpread(),
        },
        {
          kind: 'point',
          body: 'A star at distance 1 has brightness 1. Place the point for the **same star moved to distance 2**.',
          plot: { x: [0, 5], y: [0, 1.1], size: [380, 240], ticks: [1, 0.25], xlabel: 'distance', ylabel: 'brightness',
            layers: [{ type: 'dots', pts: [[1, 1]], color: 'var(--c2)', r: 5, labels: ['distance 1'] }] },
          answer: { x: 2, y: 0.25 }, tol: 0.06, snap: 0.05,
          hint: 'Twice the distance spreads the light over 2² squares.',
          explain: 'Brightness 1/2² = **0.25** at distance 2. (At 3 it would be 0.11, at 4 just 0.06: the curve drops fast.)',
        },
        {
          kind: 'number', unit: 'light-years',
          body: 'Two stars are identical. One is 10 light-years away; the other looks **1/100 as bright**. How far away is it?',
          answer: 100, tol: 0.5,
          hint: 'Which distance factor, squared, gives 100?',
          explain: '1/100 as bright means 10 times as far (10² = 100): **100 light-years**. Astronomers use exactly this to find distances to far galaxies, using stars of known true brightness.',
        },
        {
          kind: 'read',
          title: 'Colour is temperature',
          body: 'Heat a poker: it glows dull red, then orange, then yellow-white. Stars work the same way. Cool stars glow red, hot ones blue-white.',
          widget: colourStrip([3000, 4500, 5800, 10000, 25000]),
        },
        {
          kind: 'task',
          body: 'A glowing body’s light peaks at a wavelength of about **2,900,000 ÷ T** nanometres (T in kelvin). Set the temperature so the peak sits at about **500 nm**, like our Sun.',
          widget: starSpectrum((T) => T >= 5600 && T <= 6000, 'Peak near 500 nm: a Sun-like star.'),
          hint: 'T ≈ 2,900,000 ÷ 500.',
          explain: '2,900,000 ÷ 500 = 5,800: set about **5,800 K** (anything from 5,600 to 6,000 K counts). The Sun’s surface is about 5,800 K, and its light peaks in the middle of the visible band.',
        },
        {
          kind: 'order',
          body: 'Order these star colours from **coolest to hottest**.',
          items: ['Red', 'Orange', 'Yellow', 'White', 'Blue'],
          hint: 'Think of a heated poker, then keep going.',
          explain: 'Roughly: red about 3,000 K, orange 4,500 K, yellow 5,800 K, white 10,000 K, blue 20,000 K and up.',
        },
        {
          kind: 'choice',
          body: 'In Orion, Betelgeuse looks red and Rigel looks blue-white. Which has the hotter surface?',
          options: [
            { text: 'Rigel', correct: true },
            { text: 'Betelgeuse', why: 'Red for hot is a tap-label convention. For glowing things, red is the coolest colour.' },
            { text: 'You can’t tell from colour', why: 'Colour is one of the best thermometers we have for stars: it shows where the spectrum peaks.' },
          ],
          explain: 'Rigel is about 12,000 K; Betelgeuse about 3,500 K. Blue-white means hot.',
        },
        {
          kind: 'number', unit: 'nm',
          body: 'An orange star has a surface temperature of 4,000 K. At what wavelength does its light peak? (Peak ≈ 2,900,000 ÷ T nm.)',
          answer: WIEN / 4000, tol: 3,
          explain: `2,900,000 ÷ 4,000 = **${num(WIEN / 4000)} nm**, at the red end of the visible band (380 to 750 nm), so the star looks orange.`,
        },
        {
          kind: 'read',
          title: 'Mass decides a star’s life',
          body: 'A star with more mass has more fuel, but it burns it **much** faster: brightness rises roughly as mass³·⁵. So lifetime ≈ fuel ÷ burn rate ≈ mass ÷ mass³·⁵ = mass⁻²·⁵. The Sun gets about 10 billion years:\n\n**lifetime ≈ 10 billion years × M⁻²·⁵** (M in Suns)',
          widget: () => plotBox(lifePlot()),
        },
        {
          kind: 'estimate',
          body: 'Using that rule, roughly how long does a star of **10 Sun masses** shine?',
          min: 6, max: 12, step: 0.25, answer: 7.5, tol: 0.5, format: yearsFmt,
          hint: '10^2.5 ≈ 316.',
          explain: `10 billion ÷ 10^2.5 ≈ 10 billion ÷ 316 ≈ **${words(1e10 * 10 ** -2.5)} years**: ten times the fuel, gone hundreds of times sooner.`,
        },
        {
          kind: 'multi',
          body: 'Which are true of very massive stars? Select all that apply.',
          options: [
            { text: 'They shine far brighter than the Sun', correct: true, why: 'Brightness rises steeply with mass: a 10-Sun star is thousands of times brighter.' },
            { text: 'They live much shorter lives', correct: true, why: 'They burn their fuel so fast they last only millions of years.' },
            { text: 'They are hotter and bluer', correct: true, why: 'Massive stars burn hot: blue-white in colour.' },
            { text: 'They live longer, because they have more fuel', why: 'More fuel, but burned thousands of times faster: lifetime goes as mass⁻²·⁵.' },
          ],
          explain: 'Massive stars live fast and die young: bright, hot, blue and short-lived. Small red dwarfs sip their fuel for hundreds of billions of years.',
        },
        {
          kind: 'sort',
          body: 'How will each star end?',
          bins: ['Ends as a white dwarf', 'Collapses: supernova, then neutron star or black hole'],
          items: [
            { text: 'The Sun', bin: 0 }, { text: 'A red dwarf of 0.3 Sun masses', bin: 0 }, { text: 'A star of 2 Sun masses', bin: 0 },
            { text: 'A star of 15 Sun masses', bin: 1 }, { text: 'A star of 40 Sun masses', bin: 1 },
          ],
          hint: 'The dividing line is about 8 Sun masses.',
          explain: 'Stars up to about 8 Sun masses puff off their outer layers and leave a white dwarf. Heavier ones collapse and explode as supernovae, leaving a neutron star or a black hole.',
        },
        {
          kind: 'read',
          title: 'Reading starlight',
          body: '- Brightness ∝ 1/distance²: a star of known power tells you its distance.\n- Colour gives temperature: peak ≈ 2,900,000 ÷ T nm; red is cool, blue is hot.\n- Mass sets everything else: lifetime ≈ 10 billion years × M⁻²·⁵.',
        },
      ],
      practice: [genBrightness, genWien, genLifetime],
    },

    // ============================================================ 7 expanding universe
    {
      id: 'expanding',
      title: 'The expanding universe',
      goal: 'Use Hubble’s law as a proportional model and estimate the universe’s age as 1/H₀.',
      steps: [
        {
          kind: 'choice',
          body: 'Almost every distant galaxy is moving away from us, and the farther ones are moving faster. Does that mean we’re at the centre of the universe?',
          options: [
            { text: 'No: from any galaxy, the others would seem to rush away in the same way', correct: true },
            { text: 'Yes: everything flies away from us, so we must be the middle', why: 'In a uniform expansion every point sees the same thing. Being in the middle isn’t needed, as the next screen shows.' },
            { text: 'Yes, but only by coincidence', why: 'No coincidence is needed: uniform stretching makes every galaxy look like the centre.' },
          ],
          explain: 'If all of space stretches evenly, every observer sees everything receding, faster with distance. It looks the same from every galaxy.',
        },
        {
          kind: 'read',
          title: 'Raisin bread',
          body: 'Raisins sit in dough that rises, doubling every distance in an hour. Pick any raisin to live on and press Play. Raisins farther from you move away faster, in proportion to their distance, whichever raisin you pick.',
          widget: raisinBread(),
        },
        {
          kind: 'number', unit: 'cm/h',
          body: 'The dough doubles all distances in one hour. A raisin starts 5 cm from yours. How fast does it move away from you, in cm per hour?',
          answer: 5, tol: 0.01,
          hint: 'Where is it after an hour?',
          explain: 'It ends 10 cm away, so it moved **5 cm** in the hour. A raisin 1 cm away moves 1 cm/h: speed ∝ distance.',
        },
        {
          kind: 'multi',
          body: 'In the raisin-bread picture, which are true? Select all that apply.',
          options: [
            { text: 'Every raisin sees all the others moving away', correct: true, why: 'The stretching is the same everywhere.' },
            { text: 'Speed away is proportional to distance', correct: true, why: 'Twice as far away, twice as much dough between, so twice as fast.' },
            { text: 'The dough stretches; the raisins don’t move through it', correct: true, why: 'Galaxies are carried apart by stretching space.' },
            { text: 'The raisins themselves grow at the same rate', why: 'Raisins stay the same size, just as galaxies, held together by their own gravity, don’t expand.' },
            { text: 'Only the raisin in the middle sees this pattern', why: 'Try another raisin: the view is the same.' },
          ],
          explain: 'Uniform stretching gives speed ∝ distance from every viewpoint. Galaxies are the raisins: they don’t grow; the space between them does.',
        },
        {
          kind: 'read',
          title: 'Hubble’s law',
          body: 'Real galaxies follow the same rule: **v = H₀ × d**. With distance in megaparsecs (1 Mpc ≈ 3.26 million light-years), **H₀ ≈ 70 km/s per Mpc**. A galaxy 100 Mpc away recedes at about 7,000 km/s. (Dots: illustrative galaxies with measurement scatter.)',
          widget: () => plotBox(hubblePlot()),
        },
        {
          kind: 'number', unit: 'km/s',
          body: 'A galaxy is 150 Mpc away. How fast is it moving away from us?',
          answer: H0 * 150, tol: 50,
          explain: `v = 70 × 150 = **${big(H0 * 150)} km/s**.`,
        },
        {
          kind: 'point',
          body: 'Another galaxy is moving away at **14,000 km/s** (the dashed line). Tap where it should sit on the Hubble line.',
          plot: hubblePlot([{ type: 'hline', y: 14, color: 'var(--c3)', dash: true, label: '14,000 km/s' }]),
          answer: { x: 200 }, tol: 15,
          hint: 'd = v ÷ H₀.',
          explain: '14,000 ÷ 70 = **200 Mpc**, about 650 million light-years.',
        },
        {
          kind: 'read',
          title: 'Run the film backwards',
          body: 'If galaxies have been flying apart at these speeds, then at some time in the past they were all together. A galaxy at distance d moving at v took **d ÷ v** to get here. Hubble’s law makes that time the same for every galaxy.',
        },
        {
          kind: 'fill',
          body: 'Work out the time since everything was together.',
          template: 'time = distance ÷ speed = d ÷ (H₀ × d) = [[0]], which is the [[1]].',
          blanks: [
            { options: ['1/H₀', 'H₀', 'H₀ × d²'], answer: 0 },
            { options: ['same for every galaxy', 'longer for far galaxies', 'shorter for far galaxies'], answer: 0 },
          ],
          explain: 'The d cancels: every galaxy gives the same time, 1/H₀. Far galaxies are farther but faster in exactly the same proportion.',
        },
        {
          kind: 'number', unit: 'billion years',
          body: 'Now put numbers in. H₀ = 70 km/s per Mpc, 1 Mpc ≈ 3.09 × 10¹⁹ km and 1 year ≈ 3.16 × 10⁷ s. What is 1/H₀ in **billions of years**?',
          answer: age70, tol: 0.3,
          hint: '3.09 × 10¹⁹ km ÷ 70 km/s gives seconds.',
          explain: `3.09 × 10¹⁹ ÷ 70 ≈ ${sig(MPC_KM / H0)} s; ÷ 3.16 × 10⁷ ≈ **${sig(age70)} billion years**. The detailed modern figure is 13.8 billion years: this one-line estimate lands close.`,
        },
        {
          kind: 'estimate',
          body: 'If astronomers had measured H₀ twice as big, 140 km/s per Mpc, what age would the same estimate give?',
          min: 0, max: 30, step: 0.5, answer: Math.round(hubbleAgeGyr(140) * 2) / 2, tol: 1, format: (v) => `${v} billion years`,
          hint: 'Age = 1/H₀.',
          explain: `Twice the expansion rate, half the time: about **${sig(hubbleAgeGyr(140), 2)} billion years**. Hubble’s own first value was about 500, which gave an age younger than Earth itself: a clue the measurement was off.`,
        },
        {
          kind: 'choice',
          body: 'Light from distant galaxies arrives stretched to longer, redder wavelengths. What does this **redshift** show?',
          options: [
            { text: 'The galaxy is moving away from us', correct: true },
            { text: 'The galaxy is made of red stars', why: 'Redshift isn’t a colour: every line in the spectrum shifts by the same factor, even in blue-white galaxies.' },
            { text: 'The galaxy is cooling down', why: 'Temperature changes the spectrum’s shape, not the positions of its sharp lines.' },
            { text: 'Dust has dimmed the light', why: 'Dust dims and reddens, but it doesn’t move spectral lines.' },
          ],
          explain: 'Redshift shifts the spectral lines themselves, and the shift grows with distance. That is how speeds for Hubble’s law are measured.',
        },
        {
          kind: 'read',
          title: 'A proportional model',
          body: '- v = H₀ × d, with H₀ ≈ 70 km/s per Mpc.\n- Everyone sees the same thing: there’s no centre.\n- Age ≈ 1/H₀ ≈ 14 billion years. The expansion rate has changed over time, so precise ages need more detailed models, but the estimate is close.',
        },
      ],
      practice: [genHubbleV, genHubbleD, genAge],
    },

    // ============================================================ 8 are we alone?
    {
      id: 'alone',
      title: 'Are we alone?',
      goal: 'Estimate with a chain of factors, spot selection effects, and weigh what counts as evidence.',
      steps: [
        {
          kind: 'number', unit: 'billion',
          body: 'Warm-up. The Milky Way has about 200 billion stars. Suppose 1 in 5 has a roughly Earth-sized planet at a comfortable distance for liquid water. How many such planets, in **billions**?',
          answer: 40, tol: 0.1,
          explain: '200 billion ÷ 5 = **40 billion**. Even with rough guesses, the number of possible homes is huge. The hard part is what happens on them.',
        },
        {
          kind: 'read',
          title: 'The Drake equation',
          body: 'In 1961 Frank Drake broke “how many civilisations could we hear?” into factors:\n\n**N = R* × fp × ne × fl × fi × fc × L**\n\n- R*: stars born per year in our galaxy\n- fp: share with planets; ne: habitable planets per system\n- fl, fi, fc: shares where life starts, intelligence evolves, and it transmits\n- L: how many years a civilisation keeps transmitting',
        },
        {
          kind: 'match',
          body: 'Match each factor to its meaning.',
          heads: ['Factor', 'Meaning'],
          pairs: [['R*', 'Stars born per year'], ['fp', 'Share of stars with planets'], ['fl', 'Share of habitable planets where life starts'], ['fi', 'Share of those where intelligence evolves'], ['L', 'Years a civilisation stays detectable']],
          explain: 'The first few are astronomy; the last few are biology and history. L turns a birth rate into how many exist at once.',
        },
        {
          kind: 'sort',
          body: 'Which factors have we roughly **measured**, and which are still **guesses**?',
          bins: ['Roughly measured', 'Unknown: guesses'],
          items: [
            { text: 'Stars born per year', bin: 0 }, { text: 'Share of stars with planets', bin: 0 }, { text: 'Habitable planets per system', bin: 0 },
            { text: 'Share where life starts', bin: 1 }, { text: 'Share where intelligence evolves', bin: 1 }, { text: 'How long civilisations last', bin: 1 },
          ],
          hint: 'Telescopes have counted stars and planets. We have only one example of life.',
          explain: 'Star formation and planets have been measured since the 1990s (most stars have planets). For life, intelligence and lifetimes, we have a sample of one: us.',
        },
        {
          kind: 'task',
          body: 'Here the measured part is fixed: 2 stars a year × 1 × 0.2 = 0.4 new habitable planets a year. With these optimistic guesses, N = 4,000. Change the unknowns to make **N less than 1**.',
          widget: drake((N) => N < 1, 'Fewer than one: we might be alone.'),
          hint: 'Each slider moves N by a power of ten. You need to lose about four powers.',
          explain: `For example set **life starts** to 1 in 10,000: 0.4 × 10⁻⁴ × 0.1 × 0.1 × 1,000,000 = 0.4. Any mix that removes four powers of ten works. Plausible guesses swing N from millions to far below one.`,
        },
        {
          kind: 'number',
          body: 'With R* = 2, fp = 1, ne = 0.2, fl = 0.1, fi = 0.01, fc = 0.1 and L = 1,000,000 years, what is N?',
          answer: drakeN, tol: 0.5,
          hint: '2 × 0.2 = 0.4. Then multiply by the powers of ten.',
          explain: `0.4 × 0.1 × 0.01 × 0.1 = 0.00004; × 1,000,000 = **${num(drakeN)}**.`,
        },
        {
          kind: 'choice',
          body: 'A pessimist’s Drake estimate gives N = 0.0001; an optimist’s gives 10 million. What does that tell you?',
          options: [
            { text: 'The answer hinges on factors nobody has measured yet', correct: true },
            { text: 'One of them did the arithmetic wrong', why: 'Both can be calculated perfectly: the inputs differ, by many powers of ten.' },
            { text: 'The real answer is the average, about 5 million', why: 'Averaging guesses doesn’t make them data. With unknowns spanning powers of ten, the average just copies the optimist.' },
            { text: 'The equation is useless', why: 'It shows exactly which factors to measure: that’s why searching for life on Mars and Europa matters.' },
          ],
          explain: 'A Fermi estimate is only as good as its weakest factor. Here three factors are unknown, so the honest answer is a range of more than ten powers of ten, plus a list of what to measure.',
        },
        {
          kind: 'read',
          title: 'Finding planets: the transit method',
          body: 'When a planet crosses its star, the starlight dips by the fraction of the disc it covers: **(planet radius ÷ star radius)²**. Press Play.',
          widget: transit(),
        },
        {
          kind: 'number', unit: '%',
          body: 'Earth is about 1/109 of the Sun’s width. By what **percentage** does the Sun dim when Earth crosses it, as seen from far away?',
          answer: earthDip, tol: 0.0005,
          hint: '(1/109)², then × 100 for a percentage.',
          explain: `(1/109)² ≈ ${sig(earthDip / 100, 2)}, which is **${sig(earthDip, 2)}%**: over 100 times smaller than Jupiter’s 1% dip. Earth twins are hard to spot.`,
        },
        {
          kind: 'choice',
          body: 'Early planet surveys mostly found “hot Jupiters”: giant planets orbiting very close to their stars. Why?',
          options: [
            { text: 'Big, close planets are by far the easiest to detect', correct: true },
            { text: 'Hot Jupiters are the most common kind of planet', why: 'That’s the selection effect talking. Later, more sensitive surveys found that small planets are much more common.' },
            { text: 'Only stars with hot Jupiters have planets', why: 'Most stars have planets; most planets are just harder to see.' },
          ],
          explain: 'Big planets make big dips; close planets transit every few days and are much likelier to line up with us. A survey finds what it can see, not a fair sample.',
        },
        {
          kind: 'estimate',
          body: 'Selection effect, in numbers. If every Sun-like star had an Earth twin at 1 AU, the chance that its orbit lines up for us to see transits is about star radius ÷ orbit radius (700,000 km ÷ 150 million km). What percentage of them would we catch?',
          min: 0, max: 5, step: 0.1, answer: Math.round(transitPct * 10) / 10, tol: 0.3, format: (v) => `${v.toFixed(1)}%`,
          hint: '700,000 ÷ 150,000,000.',
          explain: `About **${sig(transitPct, 2)}%**: roughly 1 in 200. For every Earth twin we catch transiting, about 200 more go unseen.`,
        },
        {
          kind: 'choice',
          body: 'Someone argues: “Life arose on Earth, so life must arise easily.” What’s the problem?',
          options: [
            { text: 'We could only ever find ourselves on a planet where life arose, however rare that is', correct: true },
            { text: 'Nothing: one example proves it’s common', why: 'One example, chosen by the fact we exist to look, can’t tell common from rare.' },
            { text: 'Life on Earth might have come from somewhere else', why: 'Possible, but it doesn’t fix the logic: the sample is still biased by our existence.' },
          ],
          explain: 'This is a selection effect too: observers always find themselves where observers can exist. Our existence fits a universe where life is common and one where it is very rare.',
        },
        {
          kind: 'multi',
          body: 'Which would be strong evidence of an alien radio transmitter? Select all that apply.',
          options: [
            { text: 'A narrow-band signal seen again by independent telescopes', correct: true, why: 'Repeatable and confirmed by others: that rules out one instrument’s glitch.' },
            { text: 'It stays fixed among the stars as Earth turns', correct: true, why: 'Local interference moves with us; a real sky source moves with the stars.' },
            { text: 'A single strong burst, never seen again', why: 'One unrepeated event (like the 1977 “Wow!” signal) can’t be checked against glitches or Earth sources.' },
            { text: 'An odd light in the sky filmed on one phone', why: 'Single, unverifiable observations fit many ordinary explanations: planes, satellites, lens flares.' },
          ],
          explain: 'Extraordinary claims need evidence that repeats, is independently confirmed, and rules out ordinary causes. That’s the standard SETI uses.',
        },
        {
          kind: 'read',
          title: 'Estimating the unknown',
          body: '- Break a big unknown into factors; know which ones are measured and which are guesses.\n- Watch for selection effects: what you can detect, and the fact that you exist to look.\n- Good evidence repeats, is checked independently, and beats ordinary explanations.',
        },
      ],
      practice: [genDrake, genTransitDepth, genTransitChance],
    },
  ],
};
