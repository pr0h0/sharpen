// Chemistry by Numbers: atoms and the periodic table's logic, the mole, balancing equations,
// stoichiometry and the limiting reagent, concentration and dilution, pH and the log scale, gases
// (PV = nRT) and reaction energy and rates. Every number in a question or an answer is computed
// below from its rule (molar masses from the formula parser, coefficients from the balancer).
import type { Choice, Course, Generator } from '../types';
import { h, num as num0, pick, randInt } from '../ui';
import { dataTable } from '../viz/charts';
import { plotEl } from '../viz/plot';
import {
  AVOGADRO, ELEMENTS, K0, MASS, R_ATM, R_J, atom, atomBuilder, atoms, balancer, beakers, bySym, chargeText, dilution, eqText,
  gasBox, ionCharge, isBalanced, molar, molarWorking, moleScale, periodicMini, phBar, phExplorer, profileExplorer, profileLayers,
  reactionBox, shells, solve, spreadExplorer, sub, tally, valence,
} from '../widgets/chemistry';
import type { Eq } from '../widgets/chemistry';

const COLOR = '#9c5b2e';
/** Up to 6 significant digits, so computed values like 14.625 g show exactly. */
const num = (v: number, d = 6) => num0(v, d).replace(/^-/, '−');
/** Rounded to d decimal places. */
const f2 = (v: number, d = 2) => (+v.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }).replace(/^-/, '−');
/** Signed integer with a real minus: "+2", "−3". */
const sg = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
const sci = (v: number, d = 2) => v.toExponential(d).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${(s + e).split('').map((c: string) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]).join('')}`);
const pow = (k: number) => '10' + String(k).split('').map((c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]).join('');
const g = (f: string) => `${num(molar(f))} g/mol`;
const E = (l: string[], r: string[]): Eq => ({ l, r });

// ---------------------------------------------------------------- lesson data

// L1
const CL = { z: 17, a: 37 };
const CL_AVG = { a: 35, b: 37, p: 0.758 };
const CL_AVG_V = CL_AVG.p * CL_AVG.a + (1 - CL_AVG.p) * CL_AVG.b;
const O2M = { p: 8, n: 8, e: 8 - ionCharge(8) };
const AL = ionCharge(13), OX = ionCharge(8);
const lcm = (a: number, b: number) => (a * b) / gcdN(a, b);
function gcdN(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
const AL_N = lcm(AL, -OX) / AL, O_N = lcm(AL, -OX) / -OX;
const ATOM_R = 1e-10, NUC_R = 1e-15, MARBLE_M = 0.01;
const MARBLE_EDGE = Math.round((MARBLE_M * ATOM_R) / NUC_R);
const CA_E = 20 - ionCharge(20);

// L2
const RICE = { grain: 0.02, jar: 500 };
const TSP = 5, TSP_N = (TSP / molar('H2O')) * AVOGADRO, TSP_EXP = Math.floor(Math.log10(TSP_N));
const DRINK = 2000 / molar('H2O');
const C_MG = { c: 12 / MASS.C, mg: 12 / MASS.Mg };
const MULTI1: [string, number][] = [['H2O', 18], ['H2', 2], ['CO2', 44], ['O2', 16], ['NaCl', 29.25], ['H2', 1]];

// L3
const WATER = E(['H2', 'O2'], ['H2O']);
const METHANE = E(['CH4', 'O2'], ['CO2', 'H2O']);
const PROPANE = E(['C3H8', 'O2'], ['CO2', 'H2O']);
const AMMONIA = E(['N2', 'H2'], ['NH3']);
const RUST = E(['Fe', 'O2'], ['Fe2O3']);
const LIME = E(['CaCO3'], ['CaO', 'CO2']);
const AMM_C = solve(AMMONIA), RUST_C = solve(RUST), WATER_C = solve(WATER);
const LIME_M = 10, LIME_CAO = (LIME_M / molar('CaCO3')) * molar('CaO');
const SORT3: [Eq, number[]][] = [
  [WATER, [2, 1, 2]], [METHANE, [1, 2, 1, 2]], [AMMONIA, [1, 1, 1]], [E(['Na', 'Cl2'], ['NaCl']), [2, 1, 2]], [RUST, [2, 3, 1]], [E(['C', 'O2'], ['CO2']), [1, 1, 1]], [PROPANE, [1, 3, 3, 4]],
];

// L4
const SANDWICH = { bread: 14, cheese: 9 };
const SAND_N = Math.min(Math.floor(SANDWICH.bread / 2), SANDWICH.cheese);
const H2_MOL = 6, H2O_FROM = (H2_MOL / WATER_C[0]) * WATER_C[2];
const H2_G = 4, H2O_G = (H2_G / molar('H2')) * (WATER_C[2] / WATER_C[0]) * molar('H2O');
const LIM = { h2: 10, o2: 32 };
const LIM_RUNS = { h2: LIM.h2 / molar('H2') / WATER_C[0], o2: LIM.o2 / molar('O2') / WATER_C[1] };
const NH = { n2: 5, h2: 9 };
const NH_RUNS = Math.min(NH.n2 / AMM_C[0], NH.h2 / AMM_C[1]);
const NH_MAX = NH_RUNS * AMM_C[2], NH_LEFT = NH.n2 - NH_RUNS * AMM_C[0];
const KINK = { a: 3, ratio: 2 };
const YIELD = { theory: H2O_G, got: 27 };

// L5
const SQUASH = { a: [20, 200], b: [30, 400] };
const M1 = { mol: 0.5, ml: 250 };
const NACL = { ml: 500, M: 0.2 };
const NACL_G = (NACL.ml / 1000) * NACL.M * molar('NaCl');
const DIL = { c: 2, v1: 100, v2: 500 };
const DTASK = { c0: 2, c: 0.5, v: 250 };
const SERIAL = { c: 1, f: 10, n: 3 };
const POOL = { L: 50000, ppm: 3 };

// L6
const LEMON = 2, COFFEE = 5;
const PH7 = 2.5e-4;
const OH = 1e-3;
const MIX = (-Math.log10((1e-2 + 1e-4) / 2));
const RAIN = { acid: 4.3, normal: 5.6 };
const PH_ORDER: [string, number][] = ([
  ['[H⁺] = 0.1 mol/L', 1], ['pH 2.5', 2.5], [`[H⁺] = ${pow(-4)} mol/L`, 4], ['pH 6', 6], [`[OH⁻] = ${pow(-5)} mol/L`, 9],
] as [string, number][]).sort((a, b) => a[1] - b[1]);

// L7
const SYR = { p: 1, v1: 2, v2: 0.5 };
const CH = { v: 3, t1: 27, t2: 127 };
const CH_V2 = (CH.v * (CH.t2 + K0)) / (CH.t1 + K0);
const WARM = { t1: 20, t2: 40 };
const MOLAR_V = (R_ATM * K0) / 1;
const ROOM = { l: 5, w: 4, h: 2.5, t: 25 };
const ROOM_L = ROOM.l * ROOM.w * ROOM.h * 1000;
const ROOM_N = ROOM_L / (R_ATM * (ROOM.t + K0));
const ROOM_KG = (ROOM_N * 29) / 1000;
const BOYLE = { k: 8, p: 2 };
const TYRE = { p: 2.2, t1: 7, t2: 42 };
const TYRE_P = (TYRE.p * (TYRE.t2 + K0)) / (TYRE.t1 + K0);
const GAS0 = { n: 1, T: 300, V: 50 };

// L8
const BOND: Record<string, number> = { 'H–H': 436, 'Cl–Cl': 243, 'H–Cl': 432, 'F–F': 158, 'H–F': 568, 'Br–Br': 193, 'H–Br': 366, 'I–I': 151, 'H–I': 298 };
const HCL_DH = BOND['H–H'] + BOND['Cl–Cl'] - 2 * BOND['H–Cl'];
const FRIDGE = { room: 24, fridge: 4, days: 1 };
const FRIDGE_X = 2 ** ((FRIDGE.room - FRIDGE.fridge) / 10);
const arrh = (Ea: number, t1: number, t2: number) => Math.exp(((Ea * 1000) / R_J) * (1 / t1 - 1 / t2));
const AR = { Ea: 50, t1: 25, t2: 35 };
const AR_X = arrh(AR.Ea, AR.t1 + K0, AR.t2 + K0);
const CAT = { from: 75, to: 50, T: 298 };
const CAT_X = Math.exp(((CAT.from - CAT.to) * 1000) / (R_J * CAT.T));
const LEVELS = { dH: -90, Ea: 120, cat: 60 };
const RULE = { t1: 20, t2: 60 };

// ---------------------------------------------------------------- practice: atoms

const ISOTOPES: [string, number][] = [['C', 12], ['C', 13], ['C', 14], ['N', 15], ['O', 18], ['Na', 23], ['Mg', 26], ['Al', 27], ['P', 31], ['S', 34], ['Cl', 35], ['Cl', 37], ['K', 40], ['Ca', 44], ['Li', 7], ['F', 19]];
const genNeutrons: Generator = (rng) => {
  const [s, a] = pick(rng, ISOTOPES), el = bySym(s);
  return {
    kind: 'number',
    body: `${el.name} has atomic number ${el.z}. How many **neutrons** are in an atom of ${el.name.toLowerCase()}-${a}?`,
    answer: a - el.z, tol: 0.01,
    hint: 'The mass number counts protons and neutrons together.',
    explain: `Atomic number = protons = ${el.z}. Mass number = protons + neutrons = ${a}. Neutrons: ${a} − ${el.z} = ${a - el.z}.`,
  };
};

const IONS = ELEMENTS.filter((e) => ionCharge(e.z) !== 0 && e.z > 2 && e.sym !== 'B');
const genIonElectrons: Generator = (rng) => {
  const el = pick(rng, IONS), q = ionCharge(el.z);
  return {
    kind: 'number',
    body: `${el.name} (atomic number ${el.z}) forms the ion **${el.sym}${chargeText(q)}**. How many electrons does that ion have?`,
    answer: el.z - q, tol: 0.01,
    hint: 'A positive charge means electrons were lost; a negative one means they were gained.',
    explain: `The neutral atom has ${el.z} electrons. ${q > 0 ? `Losing ${q}` : `Gaining ${-q}`} leaves ${el.z - q}. (${q > 0 ? `${el.z} protons against ${el.z - q} electrons: ${q}+` : `${el.z - q} electrons against ${el.z} protons: ${-q}−`}.)`,
  };
};

const ISO_PAIRS: [string, number, number][] = [['chlorine', 35, 37], ['boron', 10, 11], ['copper', 63, 65], ['lithium', 6, 7], ['gallium', 69, 71], ['bromine', 79, 81]];
const genAvgMass: Generator = (rng) => {
  const [name, a, b] = pick(rng, ISO_PAIRS), p = randInt(rng, 10, 90) / 100;
  const avg = p * a + (1 - p) * b;
  return {
    kind: 'number', unit: 'u',
    body: `Natural ${name} is ${num(p * 100)}% ${name}-${a} and ${num((1 - p) * 100)}% ${name}-${b}. What is its **average atomic mass** (to 2 decimal places)?`,
    answer: avg, tol: 0.006,
    hint: 'A weighted average: each mass times its share.',
    explain: `${num(p)} × ${a} + ${num(1 - p)} × ${b} = ${f2(avg)}. That’s why the periodic table shows masses that aren’t whole numbers.`,
  };
};

const METALS = ['Li', 'Na', 'K', 'Mg', 'Ca', 'Al'], NONMETALS = ['F', 'Cl', 'O', 'S', 'N'];
const formula = (m: string, i: number, x: string, j: number) => `${m}${i > 1 ? sub(String(i)) : ''}${x}${j > 1 ? sub(String(j)) : ''}`;
const genIonFormula: Generator = (rng) => {
  const m = pick(rng, METALS), x = pick(rng, NONMETALS);
  const qm = ionCharge(bySym(m).z), qx = ionCharge(bySym(x).z);
  const L = lcm(qm, -qx), a = L / qm, b = L / -qx;
  const right = formula(m, a, x, b);
  const opts: Choice[] = [{ text: right, correct: true, why: `${a} × (${sg(qm)}) + ${b} × (${sg(qx)}) = 0.` }];
  for (const [i, j] of [[1, 1], [b, a], [1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]]) {
    const t = formula(m, i, x, j);
    if (opts.some((o) => o.text === t) || opts.length >= 4) continue;
    const q = i * qm + j * qx;
    opts.push({ text: t, why: `That totals ${i} × (${sg(qm)}) + ${j} × (${sg(qx)}) = ${sg(q)}. An ionic compound is neutral: the charges must cancel.` });
  }
  return {
    kind: 'choice',
    body: `${bySym(m).name} forms ${m}${chargeText(qm)} ions and ${bySym(x).name.toLowerCase()} forms ${x}${chargeText(qx)} ions. What is the formula of the compound they make?`,
    options: opts,
    hint: 'Find the smallest numbers of each ion whose charges add to zero.',
    explain: `${a} ${m}${chargeText(qm)} give ${sg(a * qm)}; ${b} ${x}${chargeText(qx)} give ${sg(b * qx)}. Neutral: **${right}**.`,
  };
};

// ---------------------------------------------------------------- practice: moles

const FORMULAS = ['H2O', 'CO2', 'NH3', 'CH4', 'NaCl', 'O2', 'N2', 'C2H5OH', 'CaCO3', 'H2SO4', 'NaOH', 'C6H12O6', 'MgO', 'HCl', 'Ca(OH)2', 'C12H22O11', 'KCl', 'MgCl2'];
const genMolarMass: Generator = (rng) => {
  const f = pick(rng, FORMULAS);
  return {
    kind: 'number', unit: 'g/mol',
    body: `Using H = 1, C = 12, N = 14, O = 16, Na = 23, Mg = 24, S = 32, Cl = 35.5, K = 39, Ca = 40: what is the **molar mass** of ${sub(f)}?`,
    answer: molar(f), tol: 0.01,
    hint: 'Add up the masses of every atom in the formula.',
    explain: `${sub(f)}: ${molarWorking(f)} = ${num(molar(f))} g/mol.`,
  };
};

const genGramsToMoles: Generator = (rng) => {
  const f = pick(rng, FORMULAS), n = pick(rng, [0.1, 0.2, 0.25, 0.5, 1.5, 2, 3, 4, 5]);
  const grams = n * molar(f);
  return {
    kind: 'number', unit: 'mol',
    body: `How many **moles** are in ${num(grams)} g of ${sub(f)} (molar mass ${g(f)})?`,
    answer: n, tol: 0.001,
    hint: 'Grams ÷ grams per mole.',
    explain: `${num(grams)} g ÷ ${num(molar(f))} g/mol = ${num(n)} mol.`,
  };
};

const ATOM_COUNT: [string, string][] = [['H2O', 'H'], ['CH4', 'H'], ['NH3', 'H'], ['CO2', 'O'], ['C6H12O6', 'C'], ['H2SO4', 'O'], ['C2H5OH', 'H'], ['CaCO3', 'O']];
const genAtomMoles: Generator = (rng) => {
  const [f, el] = pick(rng, ATOM_COUNT), n = randInt(rng, 1, 6) / 2, k = atoms(f)[el];
  return {
    kind: 'number', unit: 'mol',
    body: `How many **moles of ${bySym(el).name.toLowerCase()} atoms** are in ${num(n * molar(f))} g of ${sub(f)} (molar mass ${g(f)})?`,
    answer: n * k, tol: 0.001,
    hint: 'First the moles of molecules, then how many of those atoms each molecule holds.',
    explain: `${num(n * molar(f))} ÷ ${num(molar(f))} = ${num(n)} mol of ${sub(f)}. Each has ${k} ${el} atom${k > 1 ? 's' : ''}: ${num(n)} × ${k} = ${num(n * k)} mol of ${el}.`,
  };
};

// ---------------------------------------------------------------- practice: balancing

const EQS: Eq[] = [
  WATER, METHANE, PROPANE, AMMONIA, RUST, E(['Na', 'Cl2'], ['NaCl']), E(['Al', 'O2'], ['Al2O3']), E(['C2H6', 'O2'], ['CO2', 'H2O']),
  E(['Mg', 'HCl'], ['MgCl2', 'H2']), E(['C6H12O6', 'O2'], ['CO2', 'H2O']), E(['KClO3'], ['KCl', 'O2']), E(['Fe2O3', 'CO'], ['Fe', 'CO2']),
  E(['C2H5OH', 'O2'], ['CO2', 'H2O']), E(['Ca(OH)2', 'HCl'], ['CaCl2', 'H2O']), E(['NaOH', 'H2SO4'], ['Na2SO4', 'H2O']), E(['H2O2'], ['H2O', 'O2']),
];
const SOLVED = EQS.map((e) => solve(e));

const genCoef: Generator = (rng) => {
  const i = randInt(rng, 0, EQS.length - 1), eq = EQS[i], c = SOLVED[i];
  const k = randInt(rng, 0, c.length - 1);
  const shown = c.map((v, j) => (j === k ? '?' : v));
  return {
    kind: 'number',
    body: `Balance it: **${eqText(eq, shown)}**. What number goes in place of the **?**`,
    answer: c[k], tol: 0.01,
    hint: 'Count each kind of atom on both sides; the ? must make them equal.',
    explain: `Balanced: ${eqText(eq, c)}. Check: ${tally(eq, c).map(([s, a]) => `${s} ${a} = ${a}`).join(', ')}.`,
  };
};

const genIsBalanced: Generator = (rng) => {
  const i = randInt(rng, 0, EQS.length - 1), eq = EQS[i];
  const c = SOLVED[i].slice();
  if (rng() < 0.5) { const k = randInt(rng, 0, c.length - 1); c[k] += c[k] > 1 && rng() < 0.5 ? -1 : 1; }
  const ok = isBalanced(eq, c), t = tally(eq, c), bad = t.filter(([, a, b]) => a !== b);
  const count = t.map(([s, a, b]) => `${s} ${a} vs ${b}`).join(', ');
  return {
    kind: 'choice',
    body: `Is this equation balanced? **${eqText(eq, c)}**`,
    options: [
      { text: 'Yes, every element balances', correct: ok, why: ok ? undefined : `Count again: ${count}. ${bad.map(([s]) => s).join(' and ')} ${bad.length > 1 ? 'differ' : 'differs'}.` },
      { text: 'No, some element doesn’t balance', correct: !ok, why: ok ? `Count again: ${count}. Every element matches.` : undefined },
    ],
    hint: 'Multiply each subscript by the coefficient in front, then add up each side.',
    explain: `${count}. ${ok ? 'Balanced.' : `Not balanced; the smallest balanced version is ${eqText(eq, SOLVED[i])}.`}`,
  };
};

const MASS_EQS = [0, 1, 3, 5, 6, 8, 10, 11];
const genMassConserved: Generator = (rng) => {
  const i = pick(rng, MASS_EQS), eq = EQS[i], c = SOLVED[i], sp = [...eq.l, ...eq.r];
  const k = pick(rng, [0.5, 1, 2, 0.1, 0.2, 5]);
  const m = sp.map((f, j) => Math.round(c[j] * molar(f) * k * 1000) / 1000);
  const hide = randInt(rng, 0, sp.length - 1);
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const onLeft = hide < eq.l.length;
  const other = r3((onLeft ? m.slice(eq.l.length) : m.slice(0, eq.l.length)).reduce((x, y) => x + y, 0));
  const sibs = (onLeft ? m.slice(0, eq.l.length) : m.slice(eq.l.length)).filter((_, j) => j !== (onLeft ? hide : hide - eq.l.length));
  const known = sp.map((f, j) => (j === hide ? null : `${num(m[j])} g of ${sub(f)}`)).filter(Boolean).join(', ');
  return {
    kind: 'number', unit: 'g',
    body: `In the reaction ${eqText(eq, c)}, the amounts involved are ${known}. How many grams of **${sub(sp[hide])}** ${onLeft ? 'reacted' : 'formed'}?`,
    answer: m[hide], tol: 0.01,
    hint: 'Atoms are only rearranged, so total mass in = total mass out.',
    explain: `Mass in = mass out. The ${onLeft ? 'products' : 'reactants'} total ${num(other)} g, so ${sub(sp[hide])} is ${sibs.length ? `${num(other)} − ${sibs.map((v) => num(v)).join(' − ')} = ` : ''}${num(m[hide])} g.`,
  };
};

// ---------------------------------------------------------------- practice: stoichiometry

const TWO = EQS.map((_, i) => i).filter((i) => EQS[i].l.length === 2 && i < 13);
const genLimiting: Generator = (rng) => {
  const i = pick(rng, TWO), eq = EQS[i], c = SOLVED[i];
  let a = randInt(rng, 1, 12), b = randInt(rng, 1, 12);
  if (a / c[0] === b / c[1]) b += 1;
  const ra = a / c[0], rb = b / c[1], lim = ra < rb ? 0 : 1;
  const [A, B] = eq.l;
  const runs = `${num(a)} mol ${sub(A)} is enough for ${f2(ra)} "batches" of the equation; ${num(b)} mol ${sub(B)} for ${f2(rb)}.`;
  return {
    kind: 'choice',
    body: `${eqText(eq, c)}. You start with **${a} mol of ${sub(A)}** and **${b} mol of ${sub(B)}**. Which runs out first (the limiting reagent)?`,
    options: [
      { text: sub(A), correct: lim === 0, why: lim === 0 ? undefined : `${runs} ${sub(B)} allows fewer, so it runs out first.` },
      { text: sub(B), correct: lim === 1, why: lim === 1 ? undefined : `${runs} ${sub(A)} allows fewer, so it runs out first.` },
      { text: 'Neither: they run out together', why: `That needs exactly ${c[0]} : ${c[1]}. ${runs}` },
    ],
    hint: 'Divide each amount by its coefficient: the smaller result limits.',
    explain: `${runs} The smaller number wins: **${sub(eq.l[lim])}** limits.`,
  };
};

const genMaxProduct: Generator = (rng) => {
  const i = pick(rng, TWO), eq = EQS[i], c = SOLVED[i];
  const a = randInt(rng, 2, 12), b = randInt(rng, 2, 12);
  const runs = Math.min(a / c[0], b / c[1]), P = eq.r[0], cp = c[eq.l.length];
  return {
    kind: 'number', unit: 'mol',
    body: `${eqText(eq, c)}. From **${a} mol of ${sub(eq.l[0])}** and **${b} mol of ${sub(eq.l[1])}**, how many moles of **${sub(P)}** can form at most?`,
    answer: runs * cp, tol: 0.01,
    hint: 'Find the limiting reagent first, then use its ratio to the product.',
    explain: `Batches: ${a} ÷ ${c[0]} = ${f2(a / c[0])} vs ${b} ÷ ${c[1]} = ${f2(b / c[1])}. The smaller, ${f2(runs)}, sets it: ${f2(runs)} × ${cp} = ${f2(runs * cp)} mol ${sub(P)}.`,
  };
};

const MASS_TO_MASS = [1, 2, 3, 5, 9];
const genMassToMass: Generator = (rng) => {
  const i = pick(rng, MASS_TO_MASS), eq = EQS[i], c = SOLVED[i];
  const A = eq.l[0], P = eq.r[0], cp = c[eq.l.length];
  const molA = pick(rng, [0.5, 1, 2, 3, 0.25, 4]), gA = molA * molar(A), gP = (molA * cp) / c[0] * molar(P);
  return {
    kind: 'number', unit: 'g',
    body: `${eqText(eq, c)}. How many grams of **${sub(P)}** form from ${num(gA)} g of ${sub(A)}, with plenty of everything else? (${sub(A)}: ${g(A)}, ${sub(P)}: ${g(P)})`,
    answer: gP, tol: Math.max(0.01, gP * 0.005),
    hint: 'Grams → moles, use the equation’s ratio, moles → grams.',
    explain: `${num(gA)} ÷ ${num(molar(A))} = ${num(molA)} mol ${sub(A)} → × ${cp}/${c[0]} = ${num((molA * cp) / c[0])} mol ${sub(P)} → × ${num(molar(P))} = ${f2(gP)} g.`,
  };
};

// ---------------------------------------------------------------- practice: solutions

const SOLUTES = ['NaCl', 'NaOH', 'KCl', 'C6H12O6', 'HCl', 'MgCl2'];
const genMolarity: Generator = (rng) => {
  const f = pick(rng, SOLUTES), mol = pick(rng, [0.1, 0.2, 0.25, 0.5, 1, 1.5]), ml = pick(rng, [100, 200, 250, 500, 750, 1000]);
  return {
    kind: 'number', unit: 'mol/L',
    body: `${num(mol * molar(f))} g of ${sub(f)} (${g(f)}) is dissolved to make **${ml} mL** of solution. What is its concentration in mol/L?`,
    answer: mol / (ml / 1000), tol: 0.001,
    hint: 'Moles of solute ÷ litres of solution.',
    explain: `${num(mol * molar(f))} ÷ ${num(molar(f))} = ${num(mol)} mol. ${ml} mL = ${num(ml / 1000)} L. ${num(mol)} ÷ ${num(ml / 1000)} = ${num(mol / (ml / 1000))} mol/L.`,
  };
};

const genDilution: Generator = (rng) => {
  const c1 = pick(rng, [0.5, 1, 2, 3, 5, 6]), v1 = pick(rng, [10, 20, 25, 50, 100]), k = pick(rng, [2, 4, 5, 10, 20]);
  const v2 = v1 * k, c2 = c1 / k;
  if (rng() < 0.5) {
    return {
      kind: 'number', unit: 'mol/L',
      body: `You dilute ${v1} mL of a ${num(c1)} mol/L solution with water to a total of **${v2} mL**. What is the new concentration?`,
      answer: c2, tol: Math.max(0.0005, c2 * 0.005),
      hint: 'The moles don’t change: C₁V₁ = C₂V₂.',
      explain: `C₂ = ${num(c1)} × ${v1} ÷ ${v2} = ${num(c2)} mol/L. ${k}× the volume, 1/${k} the concentration.`,
    };
  }
  return {
    kind: 'number', unit: 'mL',
    body: `You need **${v2} mL of ${num(c2)} mol/L** solution. How many mL of the ${num(c1)} mol/L stock do you start with (before topping up with water)?`,
    answer: v1, tol: 0.01,
    hint: 'C₁V₁ = C₂V₂, solve for V₁.',
    explain: `V₁ = ${num(c2)} × ${v2} ÷ ${num(c1)} = ${v1} mL of stock, then water up to ${v2} mL.`,
  };
};

const genMassForSolution: Generator = (rng) => {
  const f = pick(rng, SOLUTES), ml = pick(rng, [100, 250, 500, 1000, 2000]), M = pick(rng, [0.05, 0.1, 0.2, 0.5, 1, 2]);
  const grams = (ml / 1000) * M * molar(f);
  return {
    kind: 'number', unit: 'g',
    body: `How many grams of ${sub(f)} (${g(f)}) do you weigh out to make **${ml} mL of ${num(M)} mol/L** solution?`,
    answer: grams, tol: Math.max(0.01, grams * 0.005),
    hint: 'Moles needed = concentration × litres; then grams = moles × molar mass.',
    explain: `${num(M)} × ${num(ml / 1000)} L = ${num((ml / 1000) * M)} mol. × ${num(molar(f))} g/mol = ${f2(grams)} g.`,
  };
};

// ---------------------------------------------------------------- practice: pH

const genPhFromH: Generator = (rng) => {
  const m = pick(rng, [1, 2, 3, 5]), k = randInt(rng, 1, 6), H = m * 10 ** -k, ph = -Math.log10(H);
  return {
    kind: 'number',
    body: `A solution has [H⁺] = ${m === 1 ? '' : `${m} × `}${pow(-k)} mol/L. What is its pH (to 2 decimal places)?`,
    answer: ph, tol: 0.02,
    hint: 'pH = −log₁₀[H⁺]. Each power of ten is one pH unit.',
    explain: `−log₁₀(${m === 1 ? '' : `${m} × `}${pow(-k)}) = ${k}${m === 1 ? '' : ` − log₁₀ ${m} = ${k} − ${f2(Math.log10(m))}`} = ${f2(ph)}.`,
  };
};

const genPhRatio: Generator = (rng) => {
  const a = randInt(rng, 1, 6), b = a + randInt(rng, 1, 5);
  return {
    kind: 'number',
    body: `Solution A has pH ${a}; solution B has pH ${b}. How many times higher is A’s H⁺ concentration?`,
    answer: 10 ** (b - a), tol: 0.01,
    hint: 'Each pH unit is a factor of 10.',
    explain: `${b} − ${a} = ${b - a} pH units, so 10^${b - a} = ${num(10 ** (b - a))} times more H⁺.`,
  };
};

const genDilutePh: Generator = (rng) => {
  const a = randInt(rng, 1, 3), k = randInt(rng, 1, 3), f = 10 ** k;
  return {
    kind: 'number',
    body: `A strong acid has pH ${a}. You dilute it **${num(f)}-fold** with pure water. What is the new pH?`,
    answer: a + k, tol: 0.01,
    hint: `[H⁺] falls by a factor of ${num(f)}. How many powers of ten is that?`,
    explain: `[H⁺] goes from ${pow(-a)} to ${pow(-(a + k))}: pH ${a + k}. A ${num(f)}-fold dilution moves pH up ${k}, not ${num(f)}×.`,
  };
};

// ---------------------------------------------------------------- practice: gases

const genBoyle: Generator = (rng) => {
  const p1 = pick(rng, [1, 1.5, 2, 3]), v1 = pick(rng, [2, 4, 6, 8, 12]), k = pick(rng, [0.25, 0.5, 2, 3, 4]);
  const v2 = v1 * k, p2 = p1 / k;
  return {
    kind: 'number', unit: 'atm',
    body: `A gas at ${num(p1)} atm fills ${v1} L. At the same temperature you ${k < 1 ? 'squeeze' : 'let'} it ${k < 1 ? 'into' : 'expand to'} **${num(v2)} L**. What is its pressure now?`,
    answer: p2, tol: Math.max(0.005, p2 * 0.005),
    hint: 'At fixed temperature P × V stays the same.',
    explain: `P₁V₁ = ${num(p1 * v1)} atm·L, so P₂ = ${num(p1 * v1)} ÷ ${num(v2)} = ${num(p2)} atm.`,
  };
};

const genCharles: Generator = (rng) => {
  const v1 = pick(rng, [1, 2, 3, 5, 10]), t1 = pick(rng, [0, 10, 20, 27, 37]), t2 = t1 + pick(rng, [-50, -20, 30, 50, 100, 200]);
  const v2 = (v1 * (t2 + K0)) / (t1 + K0);
  return {
    kind: 'number', unit: 'L',
    body: `A balloon holds ${v1} L at ${t1} °C. At the same pressure, what volume does it have at **${num(t2)} °C**? (2 decimal places)`,
    answer: v2, tol: 0.01,
    hint: 'Volume is proportional to temperature in kelvin (°C + 273.15).',
    explain: `${t1} °C = ${f2(t1 + K0)} K, ${num(t2)} °C = ${f2(t2 + K0)} K. V₂ = ${v1} × ${f2(t2 + K0)} ÷ ${f2(t1 + K0)} = ${f2(v2)} L.`,
  };
};

const genIdealN: Generator = (rng) => {
  const P = pick(rng, [1, 2, 0.5, 1.5]), V = pick(rng, [5, 10, 20, 22.4, 50]), t = pick(rng, [0, 25, 100, -20]);
  const n = (P * V) / (R_ATM * (t + K0));
  return {
    kind: 'number', unit: 'mol',
    body: `How many moles of gas are in a ${num(V)} L container at ${num(P)} atm and ${num(t)} °C? (R = 0.08206 L·atm/(mol·K), 2 decimal places)`,
    answer: n, tol: Math.max(0.01, n * 0.01),
    hint: 'n = PV / RT, with T in kelvin.',
    explain: `n = ${num(P)} × ${num(V)} ÷ (0.08206 × ${f2(t + K0)}) = ${f2(n)} mol.`,
  };
};

// ---------------------------------------------------------------- practice: energy and rates

const HALOGENS = ['F', 'Cl', 'Br', 'I'];
const genBondEnthalpy: Generator = (rng) => {
  const x = pick(rng, HALOGENS), k = pick(rng, [1, 2, 3]);
  const hh = BOND['H–H'], xx = BOND[`${x}–${x}`], hx = BOND[`H–${x}`];
  const dH = k * (hh + xx - 2 * hx);
  return {
    kind: 'number', unit: 'kJ',
    body: `Bond energies: H–H ${hh}, ${x}–${x} ${xx}, H–${x} ${hx} kJ/mol. What is ΔH when **${k} mol** of H₂ reacts: ${k === 1 ? '' : `${k} `}H₂ + ${k === 1 ? '' : `${k} `}${x}₂ → ${2 * k} H${x}? (negative = heat released)`,
    answer: dH, tol: 0.5,
    hint: 'Energy to break bonds minus energy released making new ones.',
    explain: `Break: ${k} × (${hh} + ${xx}) = ${k * (hh + xx)}. Make: ${2 * k} × ${hx} = ${2 * k * hx}. ΔH = ${k * (hh + xx)} − ${2 * k * hx} = ${num(dH)} kJ: ${dH < 0 ? 'exothermic' : 'endothermic'}.`,
  };
};

const genRuleOfTen: Generator = (rng) => {
  const t1 = pick(rng, [0, 10, 20, 30]), d = pick(rng, [10, 20, 30, 40]), hot = rng() < 0.5, mins = pick(rng, [8, 16, 32, 64, 80]);
  const t2 = hot ? t1 + d : t1 - d, x = 2 ** (d / 10), ans = hot ? mins / x : mins * x;
  return {
    kind: 'number', unit: 'min',
    body: `A reaction takes ${mins} minutes at ${t1} °C. Using the rule of thumb that its rate **doubles for every 10 °C**, how long does it take at **${num(t2)} °C**?`,
    answer: ans, tol: Math.max(0.01, ans * 0.005),
    hint: `${d} °C is ${d / 10} doublings.`,
    explain: `${d / 10} doubling${d > 10 ? 's' : ''}: rate × ${x}. ${hot ? 'Faster' : 'Slower'}, so the time is ${mins} ${hot ? '÷' : '×'} ${x} = ${num(ans)} min.`,
  };
};

const genArrhenius: Generator = (rng) => {
  const Ea = pick(rng, [40, 50, 60, 75, 90, 100]), t1 = pick(rng, [20, 25, 30]), d = pick(rng, [10, 20, 30]);
  const x = arrh(Ea, t1 + K0, t1 + d + K0);
  return {
    kind: 'number',
    body: `A reaction has activation energy ${Ea} kJ/mol. Its rate goes as e^(−Ea/RT). By what factor does it speed up from ${t1} °C to **${t1 + d} °C**? (R = 8.314 J/(mol·K), 2 decimal places)`,
    answer: x, tol: Math.max(0.02, x * 0.01),
    hint: 'Ratio = e^[(Ea/R)(1/T₁ − 1/T₂)], temperatures in kelvin, Ea in joules.',
    explain: `(${Ea * 1000} ÷ 8.314) × (1/${f2(t1 + K0)} − 1/${f2(t1 + d + K0)}) = ${f2(Math.log(x), 3)}. e^${f2(Math.log(x), 3)} ≈ ${f2(x)}.`,
  };
};

// ---------------------------------------------------------------- course

export const chemistry: Course = {
  id: 'chemistry',
  title: 'Chemistry by Numbers',
  blurb: 'Atoms, moles and reactions as arithmetic: balance, scale, dilute and predict.',
  color: COLOR,
  icon: '⚗️',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'atoms',
      title: 'Atoms and the table',
      goal: 'Read an atom from its numbers and predict its ions from the periodic table.',
      steps: [
        {
          kind: 'choice',
          body: 'Two atoms each have **6 protons**. One has 6 neutrons, the other 8. Are they the same element?',
          options: [
            { text: 'Yes: both are carbon, because the proton count decides', correct: true },
            { text: 'No: a different number of neutrons makes a different element', why: 'Neutrons change the mass, not the identity. Atoms of one element with different neutron counts are called isotopes.' },
            { text: 'Only if they also weigh the same', why: 'They don’t weigh the same (12 vs 14), yet both behave as carbon: chemistry follows the protons and electrons, not the mass.' },
          ],
          explain: 'The number of protons (the **atomic number**) defines the element. 6 protons is carbon, whatever the neutrons. Carbon-12 and carbon-14 are isotopes of carbon.',
        },
        {
          kind: 'read',
          title: 'Three numbers describe an atom',
          body: 'A tiny nucleus holds **protons** (charge +1) and **neutrons** (no charge), each weighing about 1 unit. Around it sit **electrons** (charge −1, almost no mass).\n\n- **atomic number** = protons: which element\n- **mass number** = protons + neutrons: which isotope\n- charge = protons − electrons: a neutral atom has as many electrons as protons',
          widget: atom(6, 6, 6, 'carbon-12: 6 protons, 6 neutrons, 6 electrons'),
        },
        {
          kind: 'number',
          body: `Chlorine has atomic number ${CL.z}. How many **neutrons** are in chlorine-${CL.a}?`,
          answer: CL.a - CL.z, tol: 0.01,
          hint: 'Mass number = protons + neutrons.',
          explain: `${CL.a} − ${CL.z} = ${CL.a - CL.z} neutrons.`,
        },
        {
          kind: 'task',
          body: `Build the oxide ion **O${chargeText(ionCharge(8))}** from oxygen-16 (oxygen has 8 protons). Set the sliders.`,
          widget: atomBuilder(O2M),
          hint: 'Mass number 16 fixes the neutrons. A 2− charge means two more electrons than protons.',
          explain: `Oxygen: ${O2M.p} protons. Mass 16: ${O2M.n} neutrons. Charge ${sg(ionCharge(8))}: ${O2M.p} − ${O2M.e} = ${sg(ionCharge(8))}, so ${O2M.e} electrons.`,
        },
        {
          kind: 'number', unit: 'u',
          body: `Natural chlorine is ${num(CL_AVG.p * 100)}% chlorine-${CL_AVG.a} and ${num((1 - CL_AVG.p) * 100)}% chlorine-${CL_AVG.b}. What is the **average** mass of a chlorine atom (2 decimal places)?`,
          answer: CL_AVG_V, tol: 0.006,
          hint: 'Weight each mass by how common it is.',
          explain: `${num(CL_AVG.p)} × ${CL_AVG.a} + ${num(1 - CL_AVG.p)} × ${CL_AVG.b} = ${f2(CL_AVG_V)}. That’s why the table lists chlorine as about 35.5, not a whole number.`,
        },
        {
          kind: 'read',
          title: 'Why the table has its shape',
          body: 'Electrons fill **shells**: up to 2 in the first, then 8, then 8 (for the first 20 elements). A row of the periodic table is a new shell; a column counts the electrons in the **outer** shell.\n\nOuter electrons do the chemistry, so elements in one column behave alike. Tap a few.',
          widget: periodicMini(),
        },
        {
          kind: 'choice',
          body: `Sodium (${MASS.Na} u) and potassium (${MASS.K} u) both fizz in water and form +1 ions. Why are they so alike?`,
          options: [
            { text: `Both have ${valence(11)} electron in their outer shell`, correct: true },
            { text: 'They have similar masses', why: `${MASS.Na} and ${MASS.K} aren’t close, and mass doesn’t drive chemistry. Magnesium (${MASS.Mg}) is closer to sodium in mass but forms 2+ ions.` },
            { text: 'They have the same number of shells', why: `Sodium has ${shells(11).length} shells, potassium ${shells(19).length} (they’re in different rows). The same column, not the same row, means similar behaviour.` },
          ],
          explain: `Sodium is ${shells(11).join(', ')} and potassium is ${shells(19).join(', ')}. One lone outer electron, easily lost: same column, same chemistry.`,
        },
        {
          kind: 'match',
          body: 'Atoms lose or gain electrons to reach a full outer shell. Match each element to its usual ion.',
          heads: ['Element', 'Ion'],
          pairs: ['Na', 'Mg', 'Al', 'O', 'Cl'].map((s) => [`${bySym(s).name} (${bySym(s).z})`, `${s}${chargeText(ionCharge(bySym(s).z))}`] as [string, string]),
          hint: 'Count outer electrons: 1-3 are easier to lose, 5-7 easier to fill up to 8.',
          explain: 'Na (1 outer) → +1, Mg (2) → 2+, Al (3) → 3+. O (6 outer) gains 2 → 2−, Cl (7) gains 1 → −1. Each ends with the electron arrangement of a noble gas.',
        },
        {
          kind: 'sort',
          body: 'Which tend to **lose** electrons (forming + ions) and which tend to **gain** them?',
          bins: ['Lose (+ ions)', 'Gain (− ions)'],
          items: ['Li', 'Na', 'Mg', 'Ca', 'Al', 'N', 'O', 'F', 'S', 'Cl'].map((s) => ({ text: `${bySym(s).name} (${bySym(s).z})`, bin: ionCharge(bySym(s).z) > 0 ? 0 : 1 })),
          hint: 'Work out the outer electrons from the atomic number: shells of 2, 8, 8.',
          explain: 'Left of the table (1-3 outer electrons, the metals) lose them; right of the table (5-7, the non-metals) gain enough to reach 8.',
        },
        {
          kind: 'fill',
          body: `Aluminium forms Al${chargeText(AL)} and oxygen forms O${chargeText(OX)}. Write aluminium oxide so the charges cancel.`,
          template: 'Al[[0]] O[[1]]',
          blanks: [{ options: ['1', '2', '3', '6'], answer: ['1', '2', '3', '6'].indexOf(String(AL_N)) }, { options: ['1', '2', '3', '6'], answer: ['1', '2', '3', '6'].indexOf(String(O_N)) }],
          hint: `Find the smallest total charge both ${AL} and ${-OX} divide into.`,
          explain: `${AL_N} × (${sg(AL)}) = ${sg(AL_N * AL)} and ${O_N} × (${sg(OX)}) = ${sg(O_N * OX)}: neutral. Aluminium oxide is Al${sub(String(AL_N))}O${sub(String(O_N))}.`,
        },
        {
          kind: 'estimate',
          body: `An atom is about ${sci(ATOM_R, 0)} m across; its nucleus about ${sci(NUC_R, 0)} m. If the nucleus were a 1 cm marble, how far out would the atom’s edge be?`,
          min: 0, max: 2000, step: 50, answer: MARBLE_EDGE, tol: 100, format: (v) => `${v} m`,
          hint: 'How many times bigger is the atom than the nucleus?',
          explain: `The ratio is ${sci(ATOM_R, 0)} ÷ ${sci(NUC_R, 0)} = ${num(ATOM_R / NUC_R)}. 1 cm × ${num(ATOM_R / NUC_R)} = ${num(MARBLE_EDGE)} m. Almost all of an atom is empty space, and almost all its mass sits in that marble.`,
        },
        {
          kind: 'number',
          body: `Calcium has atomic number 20. How many electrons does a **Ca${chargeText(ionCharge(20))}** ion have?`,
          answer: CA_E, tol: 0.01,
          explain: `20 electrons in the atom, minus the ${ionCharge(20)} it loses: ${CA_E}. (The same as argon, a noble gas.)`,
        },
      ],
      practice: [genNeutrons, genIonElectrons, genAvgMass, genIonFormula],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'mole',
      title: 'The mole: counting by weighing',
      goal: 'Convert between grams, moles and numbers of particles.',
      steps: [
        {
          kind: 'number', unit: 'grains',
          body: `One grain of rice weighs about ${num(RICE.grain)} g. A jar holds ${RICE.jar} g of rice. Without counting, how many grains is that?`,
          answer: RICE.jar / RICE.grain, tol: 1,
          explain: `${RICE.jar} ÷ ${num(RICE.grain)} = ${num(RICE.jar / RICE.grain)} grains. If you know what one weighs, weighing a pile counts it. Chemists do exactly this with atoms.`,
        },
        {
          kind: 'read',
          title: 'The mole',
          body: `Atoms are far too small to count, so chemists count them in packs. One **mole** is ${sci(AVOGADRO, 3)} things, chosen so that a mole of carbon-12 weighs exactly 12 g.\n\nSo the **molar mass** (grams per mole) of anything is just its atomic or molecular mass in grams: carbon ${MASS.C} g/mol, water ${g('H2O')}.\n\n**moles = grams ÷ molar mass**`,
          widget: moleScale('C', 36, 1, undefined, MASS.C),
        },
        {
          kind: 'number', unit: 'g/mol',
          body: `Using H = ${MASS.H} and O = ${MASS.O}: what is the molar mass of water, ${sub('H2O')}?`,
          answer: molar('H2O'), tol: 0.01,
          explain: `Two hydrogens and one oxygen: ${molarWorking('H2O')} = ${num(molar('H2O'))} g/mol.`,
        },
        {
          kind: 'number', unit: 'g/mol',
          body: `Using C = ${MASS.C} and O = ${MASS.O}: what is the molar mass of carbon dioxide, ${sub('CO2')}?`,
          answer: molar('CO2'), tol: 0.01,
          explain: `${molarWorking('CO2')} = ${num(molar('CO2'))} g/mol.`,
        },
        {
          kind: 'number', unit: 'mol',
          body: `How many moles of water are in ${num(5 * molar('H2O'))} g of it?`,
          answer: 5, tol: 0.001,
          hint: 'Grams ÷ molar mass.',
          explain: `${num(5 * molar('H2O'))} ÷ ${num(molar('H2O'))} = ${num(5)} mol.`,
        },
        {
          kind: 'choice',
          body: `Which holds more atoms: 12 g of carbon (${MASS.C} g/mol) or 12 g of magnesium (${MASS.Mg} g/mol)?`,
          options: [
            { text: `Carbon, ${num(C_MG.c / C_MG.mg)} times as many`, correct: true },
            { text: 'Magnesium', why: 'Magnesium atoms are heavier, so the same mass holds fewer of them.' },
            { text: 'The same: equal masses, equal atoms', why: 'Equal masses would only mean equal counts if the atoms weighed the same. A kilo of grapes isn’t as many fruit as a kilo of cherries.' },
          ],
          explain: `Carbon: 12 ÷ ${MASS.C} = ${num(C_MG.c)} mol. Magnesium: 12 ÷ ${MASS.Mg} = ${num(C_MG.mg)} mol. Moles count atoms, grams don’t.`,
        },
        {
          kind: 'task',
          body: `Weigh out exactly **2 mol of table salt**, ${sub('NaCl')} (Na = ${MASS.Na}, Cl = ${MASS.Cl}).`,
          widget: moleScale('NaCl', 200, 0.5, 2),
          hint: `First find the molar mass of NaCl.`,
          explain: `${sub('NaCl')}: ${molarWorking('NaCl')} = ${num(molar('NaCl'))} g/mol. 2 mol × ${num(molar('NaCl'))} = ${num(2 * molar('NaCl'))} g.`,
        },
        {
          kind: 'match',
          body: 'Match each substance to its molar mass (H = 1, C = 12, O = 16, Na = 23, Cl = 35.5).',
          heads: ['Substance', 'g/mol'],
          pairs: ['H2O', 'O2', 'NaCl', 'CO2', 'CH4'].map((f) => [sub(f), num(molar(f))] as [string, string]),
          explain: ['H2O', 'O2', 'NaCl', 'CO2', 'CH4'].map((f) => `${sub(f)} = ${molarWorking(f)} = ${num(molar(f))}`).join('; ') + '.',
        },
        {
          kind: 'number', unit: 'g',
          body: `Glucose is ${sub('C6H12O6')}. What is the mass of **0.25 mol** of it?`,
          answer: 0.25 * molar('C6H12O6'), tol: 0.01,
          hint: 'Find the molar mass, then multiply by the moles.',
          explain: `${molarWorking('C6H12O6')} = ${num(molar('C6H12O6'))} g/mol. 0.25 × ${num(molar('C6H12O6'))} = ${num(0.25 * molar('C6H12O6'))} g.`,
        },
        {
          kind: 'choice',
          body: `About how many water molecules are in a ${TSP} g teaspoon of water?`,
          options: [TSP_EXP - 11, TSP_EXP - 5, TSP_EXP, TSP_EXP + 3].map((k): Choice => ({
            text: pow(k),
            correct: k === TSP_EXP,
            why: k === TSP_EXP ? undefined : k < TSP_EXP ? `Far too few: that’s ${num(10 ** (TSP_EXP - k))} times short. Avogadro’s number is ${sci(AVOGADRO, 1)} per mole.` : `Too many: a whole mole (18 g) is only ${sci(AVOGADRO, 1)} molecules.`,
          })),
          hint: 'Moles first (grams ÷ 18), then × 6 × 10²³.',
          explain: `${TSP} ÷ ${num(molar('H2O'))} = ${f2(TSP / molar('H2O'), 3)} mol × ${sci(AVOGADRO, 3)} ≈ ${sci(TSP_N, 1)} molecules: around ${pow(TSP_EXP)}.`,
        },
        {
          kind: 'fill',
          body: 'Complete the two conversions.',
          template: 'moles = grams [[0]] molar mass;  particles = moles [[1]] 6.022 × 10²³',
          blanks: [{ options: ['×', '÷', '+'], answer: 1 }, { options: ['×', '÷', '−'], answer: 0 }],
          explain: 'Molar mass is grams per mole, so dividing grams by it gives moles. Each mole is 6.022 × 10²³ particles, so multiply.',
        },
        {
          kind: 'multi',
          body: 'Which samples contain exactly **1 mole** of molecules? (H = 1, C = 12, O = 16, Na = 23, Cl = 35.5)',
          options: MULTI1.map(([f, gr]): Choice => {
            const n = gr / molar(f), ok = Math.abs(n - 1) < 1e-9;
            return { text: `${num(gr)} g of ${sub(f)}`, correct: ok, why: ok ? undefined : `${num(gr)} ÷ ${num(molar(f))} = ${num(n)} mol, not 1.` };
          }),
          explain: `A mole of a substance weighs its molar mass: ${MULTI1.filter(([f, gr]) => Math.abs(gr / molar(f) - 1) < 1e-9).map(([f, gr]) => `${num(gr)} g of ${sub(f)}`).join(', ')}. The others are fractions of a mole.`,
        },
        {
          kind: 'estimate',
          body: 'You drink about 2 litres (2,000 g) of water a day. Roughly how many **moles** is that?',
          min: 0, max: 300, step: 1, answer: Math.round(DRINK), tol: 10, format: (v) => `${v} mol`,
          explain: `2,000 ÷ ${num(molar('H2O'))} ≈ ${Math.round(DRINK)} mol, or about ${sci(DRINK * AVOGADRO, 0)} molecules.`,
        },
      ],
      practice: [genMolarMass, genGramsToMoles, genAtomMoles],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'balance',
      title: 'Balancing equations',
      goal: 'Balance a reaction by conserving every kind of atom.',
      steps: [
        {
          kind: 'choice',
          body: `Someone writes the burning of hydrogen as **${eqText(WATER)}**. What’s wrong with it?`,
          options: [
            { text: 'An oxygen atom has vanished', correct: true },
            { text: 'Nothing: every element appears on both sides', why: 'Appearing isn’t enough: the counts must match. Left has 2 O atoms, right has 1.' },
            { text: 'The hydrogen doesn’t balance', why: 'Hydrogen is fine: 2 on the left (in H₂), 2 on the right (in H₂O). Count the oxygen.' },
          ],
          explain: `Left: 2 H, 2 O. Right: 2 H, 1 O. Reactions only rearrange atoms, so the equation must account for every one: ${eqText(WATER, WATER_C)}.`,
        },
        {
          kind: 'read',
          title: 'Atoms are conserved',
          body: 'In a reaction atoms are **rearranged**, never created or destroyed. So each element must have the same count on both sides.\n\nYou balance by changing the **coefficients** (how many molecules), never the **subscripts** (what the molecule is).',
          widget: () => dataTable(['atom', 'left side', 'right side'],
            tally(WATER, WATER_C).map(([s, a, b]) => [s, String(a), String(b)]), { caption: eqText(WATER, WATER_C) }),
        },
        {
          kind: 'choice',
          body: `To balance ${eqText(WATER)}, a student changes it to **H₂ + O₂ → H₂O₂**. The atoms now match. What’s the problem?`,
          options: [
            { text: 'H₂O₂ is a different substance (hydrogen peroxide), not water', correct: true },
            { text: 'Nothing: the atoms balance, so it’s right', why: 'It balances a different reaction. Changing a subscript changes what the molecule is.' },
            { text: 'O₂ should be written O', why: 'Oxygen gas really is O₂ molecules; that part was right.' },
          ],
          explain: 'Subscripts define the substance. To keep it water, change coefficients instead: 2 H₂ + O₂ → 2 H₂O.',
        },
        {
          kind: 'task',
          body: `Balance the burning of methane (natural gas): **${eqText(METHANE)}**. Use + and − to set each coefficient.`,
          widget: balancer(METHANE),
          hint: 'Carbon first, then hydrogen, and oxygen last (O₂ appears alone, so it’s easiest to adjust).',
          explain: `${eqText(METHANE, solve(METHANE))}: ${tally(METHANE, solve(METHANE)).map(([s, a]) => `${a} ${s}`).join(', ')} on each side.`,
        },
        {
          kind: 'number',
          body: `Making ammonia: **${eqText(AMMONIA, [AMM_C[0], '?', AMM_C[2]])}**. What goes in place of the **?**`,
          answer: AMM_C[1], tol: 0.01,
          hint: `Count the hydrogen in ${AMM_C[2]} NH₃.`,
          explain: `${AMM_C[2]} NH₃ hold ${AMM_C[2] * 3} H atoms, and each H₂ brings 2: ${AMM_C[2] * 3} ÷ 2 = ${AMM_C[1]}.`,
        },
        {
          kind: 'fill',
          body: 'Balance the rusting of iron with the smallest whole numbers.',
          template: '[[0]] Fe + [[1]] O₂ → [[2]] Fe₂O₃',
          blanks: RUST_C.map((c) => ({ options: ['1', '2', '3', '4'], answer: c - 1 })),
          hint: 'O₂ brings oxygen in pairs and Fe₂O₃ needs it in threes: the smallest number of O atoms that works is 6.',
          explain: `${eqText(RUST, RUST_C)}: ${tally(RUST, RUST_C).map(([s, a]) => `${a} ${s}`).join(' and ')} on each side.`,
        },
        {
          kind: 'sort',
          body: 'Balanced or not? Count each element on both sides.',
          bins: ['Balanced', 'Not balanced'],
          items: SORT3.map(([eq, c]) => ({ text: eqText(eq, c), bin: isBalanced(eq, c) ? 0 : 1 })),
          hint: 'Coefficient × subscript, for every element.',
          explain: SORT3.filter(([eq, c]) => !isBalanced(eq, c)).map(([eq, c]) => `${eqText(eq, c)} fails on ${tally(eq, c).filter(([, a, b]) => a !== b).map(([s, a, b]) => `${s} (${a} vs ${b})`).join(', ')}`).join('; ') + '. The rest balance.',
        },
        {
          kind: 'task',
          body: `A harder one: propane (camping gas) burning. **${eqText(PROPANE)}**`,
          widget: balancer(PROPANE),
          hint: 'Carbon sets CO₂, hydrogen sets H₂O; then count the oxygen on the right and fix O₂.',
          explain: `${eqText(PROPANE, solve(PROPANE))}. 3 C give 3 CO₂; 8 H give 4 H₂O; the right then has ${tally(PROPANE, solve(PROPANE)).find(([s]) => s === 'O')![2]} O, which is ${solve(PROPANE)[1]} O₂.`,
        },
        {
          kind: 'order',
          body: 'Put a reliable balancing routine in order.',
          items: [
            'Write the correct formulas, then leave them alone',
            'Balance an element that appears in just one substance on each side',
            'Balance the others, leaving single elements like O₂ for last',
            'Recount every element on both sides',
            'Divide through if all coefficients share a factor',
          ],
          explain: 'Fix formulas first (subscripts never change). Start with elements that appear once per side, since they pin down a ratio. Lone elements like O₂ can be adjusted without upsetting anything else, so do them last. Then check and simplify.',
        },
        {
          kind: 'number', unit: 'g',
          body: `Heating limestone: ${eqText(LIME, solve(LIME))}. ${LIME_M} g of CaCO₃ leaves ${f2(LIME_CAO)} g of CaO. How many grams of CO₂ escaped?`,
          answer: LIME_M - LIME_CAO, tol: 0.01,
          hint: 'Atoms are conserved, so mass is too.',
          explain: `${LIME_M} − ${f2(LIME_CAO)} = ${f2(LIME_M - LIME_CAO)} g of CO₂. Total mass never changes; it just leaves as gas.`,
        },
        {
          kind: 'choice',
          body: 'A 5 kg log burns down to a few hundred grams of ash. Where did most of the mass go?',
          options: [
            { text: 'Into the air, as carbon dioxide and water vapour', correct: true },
            { text: 'It was destroyed as heat and light', why: 'Chemical reactions don’t destroy measurable mass. The energy released comes from rearranging bonds.' },
            { text: 'Nowhere: the ash weighs as much as the log', why: 'The ash really is much lighter. The missing mass is in gases you can’t see.' },
          ],
          explain: 'Wood is mostly C, H and O. Burning combines it with oxygen from the air into CO₂ and H₂O, which float away. Weigh the gases too and mass is conserved (it even goes up, since oxygen from the air joins in).',
        },
        {
          kind: 'multi',
          body: 'Which are **always** the same before and after a reaction?',
          options: [
            { text: 'The number of atoms of each element', correct: true },
            { text: 'The total mass', correct: true },
            { text: 'The total electric charge', correct: true },
            { text: 'The number of molecules', why: `Not necessarily: ${eqText(WATER, WATER_C)} turns ${WATER_C[0] + WATER_C[1]} molecules into ${WATER_C[2]}.` },
            { text: 'The volume of gas', why: `Gas volume follows molecule count, which can change: ${eqText(AMMONIA, AMM_C)} turns ${AMM_C[0] + AMM_C[1]} volumes into ${AMM_C[2]}.` },
          ],
          explain: 'Atoms, mass and charge are conserved. Molecules are what get rebuilt, so their number (and the gas volume) can change.',
        },
      ],
      practice: [genCoef, genIsBalanced, genMassConserved],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'stoichiometry',
      title: 'Recipes and the limiting reagent',
      goal: 'Use mole ratios to predict amounts and find what runs out first.',
      steps: [
        {
          kind: 'number', unit: 'sandwiches',
          body: `A sandwich takes 2 slices of bread and 1 slice of cheese. You have ${SANDWICH.bread} slices of bread and ${SANDWICH.cheese} slices of cheese. How many sandwiches can you make?`,
          answer: SAND_N, tol: 0.01,
          explain: `Bread allows ${SANDWICH.bread} ÷ 2 = ${SANDWICH.bread / 2}; cheese allows ${SANDWICH.cheese}. The smaller wins: ${SAND_N}, with ${SANDWICH.cheese - SAND_N} cheese slices left. The bread is the **limiting** ingredient.`,
        },
        {
          kind: 'read',
          title: 'An equation is a recipe in moles',
          body: `${eqText(AMMONIA, AMM_C)} reads: ${AMM_C[0]} molecule of N₂ and ${AMM_C[1]} of H₂ make ${AMM_C[2]} of NH₃, or the same in moles. The coefficients are **mole ratios**, not mass ratios.\n\nWhatever runs out first, the **limiting reagent**, decides how much product you get. Move the sliders.`,
          widget: reactionBox(AMMONIA, { maxA: 8, maxB: 15, a0: 3, b0: 6 }),
        },
        {
          kind: 'number', unit: 'mol',
          body: `${eqText(WATER, WATER_C)}. How many moles of water form from **${H2_MOL} mol of H₂** (with plenty of oxygen)?`,
          answer: H2O_FROM, tol: 0.01,
          explain: `H₂ : H₂O is ${WATER_C[0]} : ${WATER_C[2]}, so ${H2_MOL} mol of H₂ gives ${H2O_FROM} mol of water.`,
        },
        {
          kind: 'choice',
          body: `${eqText(WATER, WATER_C)}. Does that mean 2 g of hydrogen reacts with 1 g of oxygen?`,
          options: [
            { text: `No: 2 g of H₂ is 1 mol, which needs 0.5 mol of O₂, or ${num(0.5 * molar('O2'))} g`, correct: true },
            { text: 'Yes: the coefficients give the masses', why: `Coefficients count molecules (moles). An O₂ molecule weighs ${num(molar('O2') / molar('H2'))} times as much as an H₂, so mass ratios are very different.` },
            { text: 'No: 2 g of hydrogen reacts with 2 g of oxygen', why: 'Equal masses would only match if the molecules weighed the same. Convert to moles first.' },
          ],
          explain: `2 g ÷ ${num(molar('H2'))} g/mol = 1 mol H₂. The ratio ${WATER_C[0]} : ${WATER_C[1]} means 0.5 mol O₂ = ${num(0.5 * molar('O2'))} g. By mass, water is 1 part hydrogen to ${num(MASS.O / (2 * MASS.H))} parts oxygen.`,
        },
        {
          kind: 'number', unit: 'g',
          body: `How many grams of water form when **${H2_G} g of H₂** burns completely? (H = 1, O = 16)`,
          answer: H2O_G, tol: 0.01,
          hint: 'Grams → moles → use the ratio → grams.',
          explain: `${H2_G} ÷ ${num(molar('H2'))} = ${num(H2_G / molar('H2'))} mol H₂ → ${num(H2_G / molar('H2'))} mol H₂O (ratio ${WATER_C[0]} : ${WATER_C[2]}) → × ${num(molar('H2O'))} = ${num(H2O_G)} g.`,
        },
        {
          kind: 'task',
          body: `Make exactly **4 NH₃** molecules with nothing left over. (${eqText(AMMONIA, AMM_C)})`,
          widget: reactionBox(AMMONIA, { maxA: 8, maxB: 15, a0: 1, b0: 1, goal: 4 }),
          hint: `4 NH₃ is ${4 / AMM_C[2]} batches of the recipe.`,
          explain: `4 ÷ ${AMM_C[2]} = ${4 / AMM_C[2]} batches: ${(4 / AMM_C[2]) * AMM_C[0]} N₂ and ${(4 / AMM_C[2]) * AMM_C[1]} H₂.`,
        },
        {
          kind: 'choice',
          body: `${eqText(WATER, WATER_C)}. You mix **${LIM.h2} g of H₂** with **${LIM.o2} g of O₂**. Which is the limiting reagent?`,
          options: [
            { text: 'O₂', correct: LIM_RUNS.o2 < LIM_RUNS.h2, why: LIM_RUNS.o2 < LIM_RUNS.h2 ? undefined : 'Compare batches, not grams.' },
            { text: 'H₂, because there’s less of it by mass', correct: LIM_RUNS.h2 < LIM_RUNS.o2, why: LIM_RUNS.h2 < LIM_RUNS.o2 ? undefined : `Less mass isn’t fewer moles: ${LIM.h2} g of H₂ is ${num(LIM.h2 / molar('H2'))} mol, but ${LIM.o2} g of O₂ is only ${num(LIM.o2 / molar('O2'))} mol.` },
            { text: 'Neither: they react exactly', why: `That would need ${WATER_C[0]} mol H₂ per ${WATER_C[1]} mol O₂. Here it’s ${num(LIM.h2 / molar('H2'))} to ${num(LIM.o2 / molar('O2'))}.` },
          ],
          hint: 'Convert both to moles, then divide by the coefficients.',
          explain: `H₂: ${num(LIM.h2 / molar('H2'))} mol ÷ ${WATER_C[0]} = ${num(LIM_RUNS.h2)} batches. O₂: ${num(LIM.o2 / molar('O2'))} mol ÷ ${WATER_C[1]} = ${num(LIM_RUNS.o2)}. Oxygen runs out first; ${num(LIM.h2 / molar('H2') - LIM_RUNS.o2 * WATER_C[0])} mol of H₂ is left over.`,
        },
        {
          kind: 'number', unit: 'mol',
          body: `${eqText(AMMONIA, AMM_C)}. From **${NH.n2} mol N₂** and **${NH.h2} mol H₂**, what is the most NH₃ you can make?`,
          answer: NH_MAX, tol: 0.01,
          hint: 'Batches: divide each by its coefficient.',
          explain: `N₂ allows ${NH.n2} ÷ ${AMM_C[0]} = ${NH.n2 / AMM_C[0]} batches; H₂ allows ${NH.h2} ÷ ${AMM_C[1]} = ${NH.h2 / AMM_C[1]}. H₂ limits: ${NH_RUNS} × ${AMM_C[2]} = ${NH_MAX} mol NH₃.`,
        },
        {
          kind: 'number', unit: 'mol',
          body: `Same mix: ${NH.n2} mol N₂ and ${NH.h2} mol H₂. How much **N₂ is left over**?`,
          answer: NH_LEFT, tol: 0.01,
          explain: `${NH_RUNS} batches use ${NH_RUNS * AMM_C[0]} mol N₂, leaving ${NH.n2} − ${NH_RUNS * AMM_C[0]} = ${NH_LEFT} mol.`,
        },
        {
          kind: 'point',
          body: `A + ${KINK.ratio} B → C. You hold A fixed at ${KINK.a} mol and add more and more B. Tap the amount of B where adding more **stops making more C**.`,
          plot: { x: [0, 12], xlabel: 'mol of B added', ticks: [1] }, answer: { x: KINK.a * KINK.ratio }, tol: 0.5, snap: 0.5,
          hint: `How much B does ${KINK.a} mol of A need?`,
          explain: `${KINK.a} mol A needs ${KINK.a} × ${KINK.ratio} = ${KINK.a * KINK.ratio} mol B. Before that, B limits and C rises; after it, A has run out and extra B just sits there.`,
        },
        {
          kind: 'read',
          title: 'The graph of a limiting reagent',
          body: 'Product grows in step with B until A runs out, then goes flat: a straight line with a sharp corner. The corner is where the two are in the exact ratio of the equation.',
          widget: () => plotEl({ x: [0, 12], y: [0, 4], size: [420, 230], xlabel: 'mol of B added', ylabel: 'mol of C', ticks: [1, 1], layers: [
            { type: 'fn', f: (b) => Math.min(b / KINK.ratio, KINK.a), color: 'var(--c1)' },
            { type: 'vline', x: KINK.a * KINK.ratio, color: 'var(--c4)', label: 'A runs out' },
          ] }),
        },
        {
          kind: 'number', prob: true,
          body: `The equation predicts ${num(YIELD.theory)} g of water, but you collect only ${YIELD.got} g. What is the **percent yield**?`,
          answer: YIELD.got / YIELD.theory, tol: 0.006,
          explain: `${YIELD.got} ÷ ${num(YIELD.theory)} = ${num(YIELD.got / YIELD.theory)} = ${num((YIELD.got / YIELD.theory) * 100)}%. Real reactions lose product to side reactions, spills and incomplete conversion.`,
        },
        {
          kind: 'choice',
          body: 'Factories often add far more of a cheap reactant (like air) than the equation needs. Why?',
          options: [
            { text: 'So the expensive reactant is the limiting one and gets fully used', correct: true },
            { text: 'Because the equation’s ratio is only approximate', why: 'The ratio is exact: atoms are conserved. The excess is a choice about which reactant runs out.' },
            { text: 'To make more product than the equation allows', why: 'The limiting reagent caps the product. Extra of the other one can’t push past it.' },
          ],
          explain: 'Whatever runs out first sets the yield and whatever is in excess is partly wasted. Make sure the waste is the cheap stuff.',
        },
      ],
      practice: [genLimiting, genMaxProduct, genMassToMass],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'solutions',
      title: 'Concentration and dilution',
      goal: 'Compute concentrations and plan dilutions with C₁V₁ = C₂V₂.',
      steps: [
        {
          kind: 'choice',
          body: `Glass A: ${SQUASH.a[0]} mL of syrup topped up to ${SQUASH.a[1]} mL. Glass B: ${SQUASH.b[0]} mL topped up to ${SQUASH.b[1]} mL. Which tastes stronger?`,
          widget: beakers([[SQUASH.a[1], SQUASH.a[0] / SQUASH.a[1], 'A'], [SQUASH.b[1], SQUASH.b[0] / SQUASH.b[1], 'B']], 450),
          options: [
            { text: 'A', correct: SQUASH.a[0] / SQUASH.a[1] > SQUASH.b[0] / SQUASH.b[1] },
            { text: 'B, because it has more syrup', correct: false, why: `More syrup but spread through twice the volume: ${SQUASH.b[0]}/${SQUASH.b[1]} = ${num(SQUASH.b[0] / SQUASH.b[1])} of B is syrup, against ${num(SQUASH.a[0] / SQUASH.a[1])} of A.` },
            { text: 'They taste the same', why: `Different shares: ${num(SQUASH.a[0] / SQUASH.a[1])} vs ${num(SQUASH.b[0] / SQUASH.b[1])}.` },
          ],
          explain: `Strength is amount ÷ volume. A: ${SQUASH.a[0]} ÷ ${SQUASH.a[1]} = ${num(SQUASH.a[0] / SQUASH.a[1])}. B: ${SQUASH.b[0]} ÷ ${SQUASH.b[1]} = ${num(SQUASH.b[0] / SQUASH.b[1])}. A is stronger.`,
        },
        {
          kind: 'read',
          title: 'Concentration',
          body: `Concentration is **how much per volume**. Chemists count the solute in moles and the solution in litres:\n\n**concentration (mol/L, written M) = moles of solute ÷ litres of solution**\n\nSo 1 M salt water has 1 mol (${num(molar('NaCl'))} g) of NaCl in every litre of solution.`,
        },
        {
          kind: 'number', unit: 'mol/L',
          body: `${M1.mol} mol of sugar is dissolved to make **${M1.ml} mL** of solution. What is the concentration?`,
          answer: M1.mol / (M1.ml / 1000), tol: 0.001,
          hint: 'Convert mL to L first.',
          explain: `${M1.ml} mL = ${num(M1.ml / 1000)} L. ${M1.mol} ÷ ${num(M1.ml / 1000)} = ${num(M1.mol / (M1.ml / 1000))} mol/L.`,
        },
        {
          kind: 'number', unit: 'g',
          body: `How many grams of NaCl (${g('NaCl')}) do you need for **${NACL.ml} mL of ${NACL.M} M** salt solution?`,
          answer: NACL_G, tol: 0.01,
          hint: 'Moles = concentration × litres. Then grams = moles × molar mass.',
          explain: `${NACL.M} × ${num(NACL.ml / 1000)} L = ${num((NACL.ml / 1000) * NACL.M)} mol. × ${num(molar('NaCl'))} = ${num(NACL_G)} g.`,
        },
        {
          kind: 'choice',
          body: 'You add water to a salt solution. What stays the same?',
          options: [
            { text: 'The amount (moles) of salt', correct: true },
            { text: 'The concentration', why: 'Concentration drops: the same salt is spread through more volume.' },
            { text: 'The volume', why: 'The volume grows by the water you add.' },
          ],
          explain: 'Water adds volume, not salt. So moles stay fixed: C₁ × V₁ (moles before) = C₂ × V₂ (moles after).',
        },
        {
          kind: 'read',
          title: 'C₁V₁ = C₂V₂',
          body: 'Diluting keeps the moles fixed, so concentration × volume is the same before and after. Double the volume, halve the concentration. Try it: pour some stock, add water, and watch the readout.',
          widget: dilution(2, { maxStock: 100, maxWater: 400, step: 10, stock: 50, water: 50 }),
        },
        {
          kind: 'number', unit: 'mol/L',
          body: `You dilute ${DIL.v1} mL of ${DIL.c} M acid to a total of **${DIL.v2} mL**. What is the new concentration?`,
          answer: (DIL.c * DIL.v1) / DIL.v2, tol: 0.001,
          hint: 'C₂ = C₁ × V₁ ÷ V₂.',
          explain: `${DIL.c} × ${DIL.v1} ÷ ${DIL.v2} = ${num((DIL.c * DIL.v1) / DIL.v2)} M. ${DIL.v2 / DIL.v1}× the volume, 1/${DIL.v2 / DIL.v1} the concentration.`,
        },
        {
          kind: 'task',
          body: `From ${DTASK.c0} M stock, make exactly **${DTASK.v} mL of ${DTASK.c} M** solution.`,
          widget: dilution(DTASK.c0, { maxStock: 150, maxWater: 250, step: 2.5, stock: 25, water: 25, target: { c: DTASK.c, v: DTASK.v } }),
          hint: `V₁ = C₂ × V₂ ÷ C₁. Then add water up to ${DTASK.v} mL.`,
          explain: `V₁ = ${DTASK.c} × ${DTASK.v} ÷ ${DTASK.c0} = ${num((DTASK.c * DTASK.v) / DTASK.c0)} mL of stock, plus ${num(DTASK.v - (DTASK.c * DTASK.v) / DTASK.c0)} mL of water.`,
        },
        {
          kind: 'sort',
          body: 'What does each do to the **concentration** of a salt solution?',
          bins: ['Raises it', 'Lowers it', 'No change'],
          items: [
            { text: 'Boiling off some water', bin: 0 },
            { text: 'Stirring in more salt', bin: 0 },
            { text: 'Adding water', bin: 1 },
            { text: 'Mixing in a weaker salt solution', bin: 1 },
            { text: 'Pouring half of it away', bin: 2 },
            { text: 'Pouring it into a bigger jar', bin: 2 },
          ],
          hint: 'Ask what happens to moles and to volume, and whether their ratio changes.',
          explain: 'Less water or more salt raises it; more water (or weaker solution) lowers it. Pouring some away removes salt and water in the same ratio, and the jar size doesn’t matter at all.',
        },
        {
          kind: 'number', unit: 'mol/L',
          body: `A lab dilutes a ${SERIAL.c} M solution 1 : ${SERIAL.f} (1 part into ${SERIAL.f} total), then dilutes that 1 : ${SERIAL.f} again, ${SERIAL.n} times in all. What is the final concentration?`,
          answer: SERIAL.c / SERIAL.f ** SERIAL.n, tol: 1e-6,
          hint: 'Each step divides by the same factor.',
          explain: `${SERIAL.n} steps of ÷${SERIAL.f}: ${SERIAL.c} ÷ ${num(SERIAL.f ** SERIAL.n)} = ${num(SERIAL.c / SERIAL.f ** SERIAL.n)} M. Serial dilution reaches tiny concentrations with small, accurate volumes.`,
        },
        {
          kind: 'estimate',
          body: `Pool chlorine should be about ${POOL.ppm} parts per million: ${POOL.ppm} mg per litre (a litre of water weighs a million mg). How many **grams** of chlorine is that in a ${num(POOL.L)} L pool?`,
          min: 0, max: 500, step: 10, answer: (POOL.ppm * POOL.L) / 1000, tol: 20, format: (v) => `${v} g`,
          explain: `${POOL.ppm} mg × ${num(POOL.L)} L = ${num(POOL.ppm * POOL.L)} mg = ${num((POOL.ppm * POOL.L) / 1000)} g. A few hundred grams treats a whole pool.`,
        },
        {
          kind: 'fill',
          body: 'Complete the two rules.',
          template: 'moles = concentration [[0]] volume (in litres);  C₂ = C₁ × V₁ [[1]] V₂',
          blanks: [{ options: ['×', '÷', '+'], answer: 0 }, { options: ['×', '÷', '−'], answer: 1 }],
          explain: 'Concentration is moles per litre, so moles = C × V. In a dilution the moles C₁V₁ are spread over the new volume: C₂ = C₁V₁ ÷ V₂.',
        },
      ],
      practice: [genMolarity, genDilution, genMassForSolution],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'ph',
      title: 'pH and the log scale',
      goal: 'Move between pH and H⁺ concentration and reason about dilution and mixing.',
      steps: [
        {
          kind: 'number',
          body: `Lemon juice has pH ${LEMON}; coffee has pH ${COFFEE}. Each step down the pH scale means 10 times more H⁺ ions. How many times more H⁺ does lemon juice have?`,
          answer: 10 ** (COFFEE - LEMON), tol: 0.01,
          explain: `${COFFEE - LEMON} steps of ×10: 10^${COFFEE - LEMON} = ${num(10 ** (COFFEE - LEMON))}. The difference looks like 3; it is really a factor of ${num(10 ** (COFFEE - LEMON))}.`,
        },
        {
          kind: 'read',
          title: 'pH counts powers of ten',
          body: 'Acidity is the concentration of hydrogen ions, [H⁺], which spans from about 1 mol/L to 10⁻¹⁴. Rather than writing those exponents, chemists use\n\n**pH = −log₁₀ [H⁺]**\n\nso [H⁺] = 10⁻³ is pH 3. Lower pH = more acidic, and **one pH unit is a factor of 10**. Pure water is pH 7.',
          widget: phExplorer(),
        },
        {
          kind: 'number',
          body: 'A solution has [H⁺] = 0.001 mol/L. What is its pH?',
          answer: -Math.log10(0.001), tol: 0.01,
          explain: `0.001 = ${pow(-3)}, so pH = ${num(-Math.log10(0.001))}.`,
        },
        {
          kind: 'choice',
          body: 'A strong acid of pH 2 is diluted with water to **10 times** its volume. What is its pH now?',
          options: [
            { text: String(2 + 1), correct: true },
            { text: num(2 / 10), why: 'Dividing the pH by 10 would make it far more acidic. Dilution lowers [H⁺], so pH goes up.' },
            { text: String(2 * 10), why: 'pH 20 is off the scale. A tenfold change in [H⁺] moves pH by just 1.' },
            { text: '2: it’s the same acid', why: 'Same acid, but fewer H⁺ per litre. pH measures concentration, not identity.' },
          ],
          explain: `[H⁺] drops from ${pow(-2)} to ${pow(-3)}: pH 3. Ten times more dilute is one pH unit.`,
        },
        {
          kind: 'number',
          body: 'A strong acid of pH 3 is diluted **100-fold**. What is its new pH?',
          answer: 3 + Math.log10(100), tol: 0.01,
          hint: 'How many factors of 10 is 100?',
          explain: `100 = 10², so pH rises by 2: ${3 + Math.log10(100)}.`,
        },
        {
          kind: 'choice',
          body: 'Keep diluting that acid, a million-fold, a billion-fold. What happens to the pH?',
          options: [
            { text: 'It creeps up towards 7 but never passes it', correct: true },
            { text: 'It keeps rising: 9, 12, …', why: 'Diluting an acid can’t make it basic. Water itself supplies 10⁻⁷ mol/L of H⁺, so the mixture never drops below that.' },
            { text: 'It stays at 3', why: 'Each tenfold dilution removes H⁺ per litre, so pH does rise, at first one unit per tenfold.' },
          ],
          explain: 'Pure water has [H⁺] = 10⁻⁷ from its own molecules splitting. Once the acid’s contribution falls below that, water dominates and pH settles at 7.',
        },
        {
          kind: 'number',
          body: `Acid rain sample: [H⁺] = ${num(PH7)} mol/L. What is its pH (2 decimal places)?`,
          answer: -Math.log10(PH7), tol: 0.02,
          hint: `${num(PH7)} = 2.5 × 10⁻⁴. The log of 2.5 is about 0.4.`,
          explain: `−log₁₀(2.5 × ${pow(-4)}) = 4 − log₁₀ 2.5 = 4 − ${f2(Math.log10(2.5))} = ${f2(-Math.log10(PH7))}.`,
        },
        {
          kind: 'read',
          title: 'Bases: the other end',
          body: 'Water molecules split a tiny bit into H⁺ and OH⁻, and the two always balance as\n\n**[H⁺] × [OH⁻] = 10⁻¹⁴**\n\nso pH + pOH = 14. A base adds OH⁻, which pushes [H⁺] down and pH above 7.',
          widget: () => h('div', { class: 'plot-wrap' }, phBar(null)),
        },
        {
          kind: 'number',
          body: `A cleaning solution has [OH⁻] = ${num(OH)} mol/L. What is its pH?`,
          answer: 14 + Math.log10(OH), tol: 0.01,
          hint: '[H⁺] = 10⁻¹⁴ ÷ [OH⁻].',
          explain: `[H⁺] = 10⁻¹⁴ ÷ ${pow(Math.log10(OH))} = ${pow(-14 - Math.log10(OH))}, so pH ${num(14 + Math.log10(OH))}. (Or pOH ${num(-Math.log10(OH))}, pH = 14 − ${num(-Math.log10(OH))}.)`,
        },
        {
          kind: 'order',
          body: 'Order from **most acidic** to least.',
          items: PH_ORDER.map((p) => p[0]),
          hint: 'Turn each into a pH first.',
          explain: `As pH: ${PH_ORDER.map(([t, p]) => `${t} → ${num(p)}`).join('; ')}.`,
        },
        {
          kind: 'choice',
          body: 'You mix equal volumes of a pH 2 acid and a pH 4 acid. Roughly what pH is the mixture?',
          options: [
            { text: f2(MIX, 1), correct: true },
            { text: '3', why: 'Averaging pH averages the exponents. Average the [H⁺] instead: the pH 2 acid has 100 times more and dominates.' },
            { text: '2', why: 'Close, but mixing doubles the volume, halving the strong acid’s [H⁺].' },
            { text: '6', why: 'pH values don’t add. Mixing two acids gives an acid between them.' },
          ],
          hint: 'Average the H⁺ concentrations, not the pH values.',
          explain: `[H⁺] = (0.01 + 0.0001) ÷ 2 = ${num((0.01 + 0.0001) / 2)}. pH = ${f2(MIX)}. On a log scale, the bigger number swamps the smaller.`,
        },
        {
          kind: 'estimate',
          body: `Normal rain is about pH ${RAIN.normal} (from dissolved CO₂). Acid rain at pH ${RAIN.acid} has about how many times more H⁺?`,
          min: 0, max: 50, step: 1, answer: Math.round(10 ** (RAIN.normal - RAIN.acid)), tol: 3, format: (v) => `${v}×`,
          explain: `10^(${RAIN.normal} − ${RAIN.acid}) = 10^${f2(RAIN.normal - RAIN.acid, 1)} ≈ ${num(10 ** (RAIN.normal - RAIN.acid), 2)}. A pH drop of just over 1 means about ${Math.round(10 ** (RAIN.normal - RAIN.acid))} times more acid.`,
        },
      ],
      practice: [genPhFromH, genPhRatio, genDilutePh],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'gases',
      title: 'Gases: PV = nRT',
      goal: 'Predict how pressure, volume, temperature and amount of a gas trade off.',
      steps: [
        {
          kind: 'number', unit: 'atm',
          body: `A syringe holds ${SYR.v1} L of air at ${SYR.p} atm. You seal the tip and push the plunger until the air fills **${SYR.v2} L**, keeping the temperature steady. What is the pressure now?`,
          answer: (SYR.p * SYR.v1) / SYR.v2, tol: 0.01,
          hint: 'The same molecules, squeezed into a fraction of the space, hit the walls that much more often.',
          explain: `${num(SYR.v1 / SYR.v2)} times less volume, ${num(SYR.v1 / SYR.v2)} times the pressure: ${SYR.p} × ${SYR.v1} ÷ ${SYR.v2} = ${num((SYR.p * SYR.v1) / SYR.v2)} atm. P × V stays constant (Boyle’s law).`,
        },
        {
          kind: 'read',
          title: 'One law for all gases',
          body: 'Pressure is molecules hitting the walls. More molecules (n), faster molecules (higher T) or less room (smaller V) all mean more hits:\n\n**PV = nRT**\n\nwith T in **kelvin** (°C + 273.15) and R = 0.08206 L·atm/(mol·K). Remarkably, it doesn’t matter which gas it is. Play with the box.',
          widget: gasBox({ n: 1, T: 300, V: 50 }),
        },
        {
          kind: 'choice',
          body: `A sealed balloon is warmed from ${WARM.t1} °C to ${WARM.t2} °C at constant pressure. Does its volume double?`,
          options: [
            { text: `No, it grows only ${num(((WARM.t2 + K0) / (WARM.t1 + K0) - 1) * 100, 2)}%`, correct: true },
            { text: 'Yes: double the temperature, double the volume', why: `Only on the kelvin scale. ${WARM.t1} °C → ${WARM.t2} °C is ${f2(WARM.t1 + K0)} K → ${f2(WARM.t2 + K0)} K, nowhere near double.` },
            { text: 'No, volume doesn’t depend on temperature', why: 'It does: hotter molecules push harder, so at fixed pressure the gas expands. V ∝ T in kelvin.' },
          ],
          explain: `V ∝ T (kelvin): ${f2(WARM.t2 + K0)} ÷ ${f2(WARM.t1 + K0)} = ${num((WARM.t2 + K0) / (WARM.t1 + K0), 3)}. Celsius has an arbitrary zero, so ratios of °C mean nothing.`,
        },
        {
          kind: 'number', unit: 'L',
          body: `A balloon holds ${CH.v} L at ${CH.t1} °C. At the same pressure, what is its volume at **${CH.t2} °C**? (Use 273 for the kelvin offset if you like.)`,
          answer: CH_V2, tol: 0.02,
          hint: 'Convert both temperatures to kelvin; volume scales with their ratio.',
          explain: `${CH.t1} °C ≈ ${Math.round(CH.t1 + K0)} K, ${CH.t2} °C ≈ ${Math.round(CH.t2 + K0)} K. ${CH.v} × ${f2(CH.t2 + K0)} ÷ ${f2(CH.t1 + K0)} = ${f2(CH_V2)} L.`,
        },
        {
          kind: 'point',
          body: `At fixed temperature, a gas follows P × V = ${BOYLE.k} (atm·L). Tap the point on the curve where the pressure is **${BOYLE.p} atm**.`,
          plot: { x: [0, 10], y: [0, 10], xlabel: 'V (L)', ylabel: 'P (atm)', ticks: [1, 1], layers: [{ type: 'fn', f: (v) => BOYLE.k / v, color: 'var(--c1)', from: 0.5 }] },
          answer: { x: BOYLE.k / BOYLE.p, y: BOYLE.p }, tol: 0.5, snap: 0.5,
          hint: `V = ${BOYLE.k} ÷ P.`,
          explain: `V = ${BOYLE.k} ÷ ${BOYLE.p} = ${BOYLE.k / BOYLE.p} L, at P = ${BOYLE.p} atm. Halve the pressure, double the volume: a hyperbola.`,
        },
        {
          kind: 'number', unit: 'L',
          body: 'What volume does **1 mol** of any gas take up at 0 °C and 1 atm? (R = 0.08206 L·atm/(mol·K), 1 decimal place)',
          answer: MOLAR_V, tol: 0.06,
          hint: 'V = nRT / P with T = 273.15 K.',
          explain: `V = 1 × 0.08206 × ${K0} ÷ 1 = ${f2(MOLAR_V, 1)} L: about a cube 28 cm on a side. The same for hydrogen, oxygen or CO₂.`,
        },
        {
          kind: 'choice',
          body: 'Two equal balloons at the same temperature and pressure: one of helium, one of carbon dioxide. Which holds more molecules?',
          options: [
            { text: 'They hold the same number', correct: true },
            { text: 'Carbon dioxide, because its molecules are bigger', why: 'Gas molecules are tiny compared with the space between them, so their size barely matters. PV = nRT has no term for the type of gas.' },
            { text: 'Helium, because its atoms are lighter', why: 'Lighter atoms move faster, but at equal T each hits the wall with the same average energy. Same P, V, T means same n.' },
          ],
          explain: 'n = PV/RT: same P, V and T give the same n whatever the gas (Avogadro’s law). The CO₂ balloon is heavier, not fuller.',
        },
        {
          kind: 'estimate',
          body: `A room is ${ROOM.l} m × ${ROOM.w} m × ${ROOM.h} m (${num(ROOM_L)} L) at ${ROOM.t} °C and 1 atm. About how many **moles** of air does it hold?`,
          min: 0, max: 5000, step: 50, answer: Math.round(ROOM_N / 50) * 50, tol: 200, format: (v) => `${v} mol`,
          hint: 'n = PV/RT, or roughly volume ÷ 24.5 L per mole at room temperature.',
          explain: `n = 1 × ${num(ROOM_L)} ÷ (0.08206 × ${f2(ROOM.t + K0)}) ≈ ${num(Math.round(ROOM_N))} mol.`,
        },
        {
          kind: 'number', unit: 'kg',
          body: `Air averages about 29 g/mol. Using your ${num(Math.round(ROOM_N))} mol, what does the air in that room **weigh**?`,
          answer: ROOM_KG, tol: 1,
          explain: `${num(Math.round(ROOM_N))} × 29 g ≈ ${num(Math.round(ROOM_KG))} kg: as much as a person. Air is light per litre, but a room holds a lot of litres.`,
        },
        {
          kind: 'sort',
          body: 'A sealed, rigid can of gas (its volume can’t change). What does each do to the **pressure** inside?',
          bins: ['Raises it', 'Lowers it'],
          items: [
            { text: 'Leaving it in the sun', bin: 0 },
            { text: 'Pumping in more gas', bin: 0 },
            { text: 'Putting it in the freezer', bin: 1 },
            { text: 'Letting some gas out', bin: 1 },
            { text: 'Throwing it on a fire', bin: 0 },
            { text: 'A slow leak', bin: 1 },
          ],
          hint: 'P = nRT/V with V fixed: only n and T can change.',
          explain: 'With V fixed, P ∝ nT. Heating or adding gas raises pressure (which is why aerosol cans warn against fire); cooling or losing gas lowers it.',
        },
        {
          kind: 'task',
          body: `This box holds ${GAS0.n} mol at ${GAS0.T} K in ${GAS0.V} L. Change the temperature and/or volume to make the pressure **exactly double** what it is now.`,
          widget: gasBox({ ...GAS0, lock: ['n'], goal: (v) => Math.abs((v.n * v.T) / v.V - 2 * ((GAS0.n * GAS0.T) / GAS0.V)) < 1e-9, goalText: 'Pressure doubled.' }),
          hint: 'P ∝ T/V. Double T, or halve V, or any mix that doubles T/V.',
          explain: `P ∝ T/V, so any setting with T/V = 2 × ${GAS0.T}/${GAS0.V} works: ${2 * GAS0.T} K at ${GAS0.V} L, or ${GAS0.T} K at ${GAS0.V / 2} L, and more.`,
        },
        {
          kind: 'number', unit: 'atm',
          body: `A tyre holds air at ${TYRE.p} atm (absolute pressure) at ${TYRE.t1} °C. After a long drive the air inside is ${TYRE.t2} °C. If its volume barely changes, what is the pressure? (2 decimal places)`,
          answer: TYRE_P, tol: 0.02,
          hint: 'At fixed V, pressure ∝ kelvin temperature.',
          explain: `${TYRE.p} × ${f2(TYRE.t2 + K0)} ÷ ${f2(TYRE.t1 + K0)} = ${f2(TYRE_P)} atm. That’s why you check tyre pressure cold.`,
        },
        {
          kind: 'fill',
          body: 'In a fixed volume, you double the amount of gas **and** double its kelvin temperature.',
          template: 'P = nRT ÷ V, so P becomes [[0]] times bigger',
          blanks: [{ options: ['2', '4', '1', '8'], answer: 1 }],
          explain: 'P ∝ n × T at fixed V: 2 × 2 = 4 times the pressure.',
        },
      ],
      practice: [genBoyle, genCharles, genIdealN],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'energy',
      title: 'Reaction energy and rates',
      goal: 'Estimate reaction heat from bonds and explain why heat and catalysts speed reactions.',
      steps: [
        {
          kind: 'number', unit: 'days',
          body: `Milk goes off in about ${FRIDGE.days} day on a ${FRIDGE.room} °C counter. Suppose spoilage reactions double in speed for every 10 °C warmer. About how long would it last in a ${FRIDGE.fridge} °C fridge?`,
          answer: FRIDGE.days * FRIDGE_X, tol: 0.01,
          hint: `${FRIDGE.room - FRIDGE.fridge} °C colder is how many halvings?`,
          explain: `${FRIDGE.room - FRIDGE.fridge} °C is ${(FRIDGE.room - FRIDGE.fridge) / 10} halvings of the rate: ${FRIDGE.days} × 2^${(FRIDGE.room - FRIDGE.fridge) / 10} = ${num(FRIDGE.days * FRIDGE_X)} days. Small temperature changes have big effects on reaction speed.`,
        },
        {
          kind: 'read',
          title: 'Heat from bonds',
          body: 'Breaking a bond **costs** energy; forming one **releases** it. A reaction’s heat is the balance:\n\n**ΔH = energy to break old bonds − energy released forming new ones**\n\nNegative ΔH: more released than spent, heat flows out (**exothermic**, like burning). Positive: heat is taken in (**endothermic**, like a cold pack).',
          widget: () => dataTable(['bond', 'energy (kJ/mol)'], ['H–H', 'Cl–Cl', 'H–Cl'].map((b) => [b, String(BOND[b])]), { caption: 'Average bond energies' }),
        },
        {
          kind: 'number', unit: 'kJ',
          body: `H₂ + Cl₂ → 2 HCl. Using the table (H–H ${BOND['H–H']}, Cl–Cl ${BOND['Cl–Cl']}, H–Cl ${BOND['H–Cl']} kJ/mol), what is ΔH per mole of H₂?`,
          answer: HCL_DH, tol: 0.5,
          hint: 'Break one H–H and one Cl–Cl; make two H–Cl.',
          explain: `Break: ${BOND['H–H']} + ${BOND['Cl–Cl']} = ${BOND['H–H'] + BOND['Cl–Cl']}. Make: 2 × ${BOND['H–Cl']} = ${2 * BOND['H–Cl']}. ΔH = ${BOND['H–H'] + BOND['Cl–Cl']} − ${2 * BOND['H–Cl']} = ${num(HCL_DH)} kJ.`,
        },
        {
          kind: 'choice',
          body: `So H₂ + Cl₂ → 2 HCl has ΔH = ${num(HCL_DH)} kJ. What does the reaction mixture do?`,
          options: [
            { text: HCL_DH < 0 ? 'Gives out heat (exothermic)' : 'Takes in heat (endothermic)', correct: true },
            { text: HCL_DH < 0 ? 'Takes in heat (endothermic)' : 'Gives out heat (exothermic)', why: `The sign says which: ΔH ${HCL_DH < 0 ? '< 0 means the products hold less energy, and the difference leaves as heat' : '> 0 means energy is taken in'}.` },
            { text: 'Neither: bonds broken and made cancel', why: `They’d cancel only if ΔH were 0. Here the new bonds are ${HCL_DH < 0 ? 'stronger' : 'weaker'} by ${Math.abs(HCL_DH)} kJ.` },
          ],
          explain: `The two H–Cl bonds formed are stronger than the H–H and Cl–Cl broken, so ${Math.abs(HCL_DH)} kJ leaves as heat (it can be explosive).`,
        },
        {
          kind: 'sort',
          body: 'Gives out heat or takes it in?',
          bins: ['Exothermic (heat out)', 'Endothermic (heat in)'],
          items: [
            { text: 'Burning wood', bin: 0 },
            { text: 'A hand warmer (iron rusting)', bin: 0 },
            { text: 'Your cells respiring glucose', bin: 0 },
            { text: 'An instant cold pack', bin: 1 },
            { text: 'Photosynthesis', bin: 1 },
            { text: 'Baking soda decomposing in the oven', bin: 1 },
          ],
          hint: 'Does it warm its surroundings or need energy fed in?',
          explain: 'Burning, rusting and respiration form strong bonds (in CO₂, H₂O, iron oxide) and release heat. Cold packs, photosynthesis (driven by light) and decomposing baking soda need energy put in.',
        },
        {
          kind: 'read',
          title: 'The hump: activation energy',
          body: 'Even exothermic reactions need a push to start: old bonds must partly break before new ones form. That energy barrier is the **activation energy**, Ea.\n\nΔH (the drop from start to finish) decides the heat. Ea (the height of the hump) decides the **speed**. Paper is very exothermic to burn, yet it sits on your desk: its hump is high.',
          widget: profileExplorer(),
        },
        {
          kind: 'choice',
          body: 'A catalyst speeds up a reaction without being used up. The solid curve is without it, the dashed one with it. What does it change?',
          widget: () => plotEl({ x: [0, 10], y: [-120, 150], size: [420, 240], ylabel: 'energy', xlabel: 'reaction progress', tickFormat: () => '', layers: profileLayers(LEVELS.dH, LEVELS.Ea, LEVELS.cat) }),
          options: [
            { text: 'It lowers the activation energy, but not ΔH', correct: true },
            { text: 'It makes the reaction release more heat', why: 'ΔH depends only on where you start and finish. The catalyst offers a lower route, not a lower destination.' },
            { text: 'It gives the molecules extra energy', why: 'Catalysts don’t add energy. They provide a different pathway with a lower barrier, so more of the existing collisions succeed.' },
          ],
          explain: 'The dashed path has a lower hump but starts and ends at the same levels. Same heat, much faster: enzymes in your body do this for nearly every reaction.',
        },
        {
          kind: 'order',
          body: `An exothermic reaction (ΔH = ${num(LEVELS.dH)} kJ) has a barrier of ${LEVELS.Ea} kJ, or ${LEVELS.cat} kJ with a catalyst. Order the energies from **highest to lowest**.`,
          items: ([['Top of the hump, no catalyst', LEVELS.Ea], ['Top of the hump, with catalyst', LEVELS.cat], ['Reactants', 0], ['Products', LEVELS.dH]] as [string, number][]).sort((a, b) => b[1] - a[1]).map((x) => x[0]),
          explain: `Measured from the reactants (0): uncatalysed peak ${LEVELS.Ea}, catalysed peak ${LEVELS.cat}, reactants 0, products ${num(LEVELS.dH)}.`,
        },
        {
          kind: 'read',
          title: 'Why heat speeds things up',
          body: 'Molecules don’t all have the same energy: they have a spread, with a long tail of fast ones. Only collisions in the tail beyond Ea react. Warm the gas a little and the curve flattens, and the **tail** past Ea grows a lot. Slide the temperature and watch the shaded share. (Real barriers are usually higher than this one, which makes the effect steeper still.)',
          widget: spreadExplorer(8),
        },
        {
          kind: 'number',
          body: `For a reaction with Ea = ${AR.Ea} kJ/mol, the rate goes as e^(−Ea/RT). By what factor does it speed up from ${AR.t1} °C to ${AR.t2} °C? (R = 8.314 J/(mol·K), 2 decimal places)`,
          answer: AR_X, tol: 0.03,
          hint: 'Ratio = e^[(Ea/R)(1/T₁ − 1/T₂)], with T in kelvin and Ea in joules.',
          explain: `(${AR.Ea * 1000} ÷ 8.314) × (1/${f2(AR.t1 + K0)} − 1/${f2(AR.t2 + K0)}) = ${f2(Math.log(AR_X), 3)}; e^${f2(Math.log(AR_X), 3)} ≈ ${f2(AR_X)}. That’s where “doubles every 10 °C” comes from: it fits typical activation energies near room temperature.`,
        },
        {
          kind: 'choice',
          body: `A catalyst lowers Ea from ${CAT.from} to ${CAT.to} kJ/mol at ${CAT.T} K. Roughly how much faster is the reaction? (rate ∝ e^(−Ea/RT))`,
          options: [2, 25, 300, CAT_X].map((x): Choice => ({
            text: `About ${num(x, 2)} times`,
            correct: x === CAT_X,
            why: x === CAT_X ? undefined : `${num(x)} times is far too small. The factor is e^(ΔEa/RT) = e^(${(CAT.from - CAT.to) * 1000} ÷ (8.314 × ${CAT.T})) = e^${f2(Math.log(CAT_X), 1)}: exponentials grow fast.`,
          })),
          hint: 'Ratio = e^[(Ea₁ − Ea₂)/RT].',
          explain: `e^(${(CAT.from - CAT.to) * 1000} ÷ ${f2(R_J * CAT.T, 0)}) = e^${f2(Math.log(CAT_X), 2)} ≈ ${num(CAT_X, 2)}. A modest drop in the barrier makes a reaction thousands of times faster.`,
        },
        {
          kind: 'multi',
          body: 'Which of these would speed up a reaction between a solid and a solution?',
          options: [
            { text: 'Heating it', correct: true },
            { text: 'Using a more concentrated solution', correct: true },
            { text: 'Grinding the solid into powder', correct: true },
            { text: 'Adding a suitable catalyst', correct: true },
            { text: 'Using one big lump instead of chips', why: 'One lump has less surface, so fewer particles can collide with it. Slower.' },
            { text: 'Cooling it', why: 'Colder means fewer collisions energetic enough to clear Ea. Slower.' },
          ],
          explain: 'Rate depends on how often particles collide (concentration, surface area) and how many collisions clear the barrier (temperature, catalyst).',
        },
        {
          kind: 'estimate',
          body: `Using “the rate doubles every 10 °C”, how many times faster is a reaction at ${RULE.t2} °C than at ${RULE.t1} °C?`,
          min: 0, max: 40, step: 1, answer: 2 ** ((RULE.t2 - RULE.t1) / 10), tol: 1, format: (v) => `${v}×`,
          explain: `${(RULE.t2 - RULE.t1) / 10} doublings: 2^${(RULE.t2 - RULE.t1) / 10} = ${2 ** ((RULE.t2 - RULE.t1) / 10)}. That’s why cooking works and why fridges do.`,
        },
      ],
      practice: [genBondEnthalpy, genRuleOfTen, genArrhenius],
    },
  ],
};
