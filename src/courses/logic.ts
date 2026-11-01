// Logic: negation, if–then, checking rules, necessary vs sufficient, syllogisms, knights and knaves,
// grid deduction, and spotting bad arguments. Every generated puzzle is solved by brute force here,
// so the answer shown is computed, never hand-labelled.
import type { Choice, Course, Generator, Rng } from '../types';
import { cardPicker, elimGrid, truthTable } from '../widgets/logic';
import { pick, randInt, shuffle } from '../ui';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const stop = (s: string) => s.replace(/\.$/, '');

/** Two distinct items from a list. */
function two<T>(rng: Rng, xs: readonly T[]): [T, T] {
  const [a, b] = shuffle(rng, xs.slice());
  return [a, b];
}

// ---------------------------------------------------------------- lesson 1: negation

const GROUPS = [
  { grp: 'the windows', adj: 'shut' }, { grp: 'the invoices', adj: 'paid' }, { grp: 'the guests', adj: 'vegetarian' },
  { grp: 'the seats', adj: 'taken' }, { grp: 'the eggs', adj: 'fresh' }, { grp: 'the files', adj: 'saved' },
  { grp: 'the doors', adj: 'locked' }, { grp: 'the reports', adj: 'finished' }, { grp: 'the plants', adj: 'watered' },
];

/** Clauses with their exact negations (binary states only, so "not on" really is "off"). */
const CLAUSES = [
  { pos: 'the heating is on', neg: 'the heating is off' },
  { pos: 'the door is locked', neg: 'the door is unlocked' },
  { pos: 'the shop is open', neg: 'the shop is closed' },
  { pos: 'the printer has paper', neg: 'the printer has no paper' },
  { pos: 'the lights are on', neg: 'the lights are off' },
  { pos: 'the window is open', neg: 'the window is shut' },
  { pos: 'the tank is full', neg: 'the tank isn’t full' },
  { pos: 'the alarm is set', neg: 'the alarm isn’t set' },
];

const genNegation: Generator = (rng) => {
  const kind = pick(rng, ['all', 'some', 'none', 'and', 'or'] as const);
  let claim: string, right: string;
  let wrong: Choice[];
  if (kind === 'all' || kind === 'some' || kind === 'none') {
    const { grp, adj } = pick(rng, GROUPS);
    const all = `All of ${grp} are ${adj}.`, some = `Some of ${grp} are ${adj}.`;
    const none = `None of ${grp} are ${adj}.`, someNot = `At least one of ${grp} isn’t ${adj}.`;
    if (kind === 'all') {
      claim = all; right = someNot;
      wrong = [
        { text: none, why: 'Too strong. One exception is already enough to make “all” false.' },
        { text: some, why: 'That can be true at the same time as the claim, so it isn’t its negation.' },
      ];
    } else if (kind === 'some') {
      claim = some; right = none;
      wrong = [
        { text: `Some of ${grp} aren’t ${adj}.`, why: 'Both can be true together (some are, some aren’t), so this doesn’t contradict the claim.' },
        { text: all, why: 'That would make the claim true, not false.' },
      ];
    } else {
      claim = none; right = `At least one of ${grp} is ${adj}.`;
      wrong = [
        { text: all, why: 'Too strong. A single one being so is already enough to make “none” false.' },
        { text: `Some of ${grp} aren’t ${adj}.`, why: 'That fits perfectly well with the claim, so it isn’t its negation.' },
      ];
    }
  } else {
    const [a, b] = two(rng, CLAUSES);
    if (kind === 'and') {
      claim = `${cap(a.pos)} and ${b.pos}.`;
      right = `${cap(a.neg)} or ${b.neg} (or both).`;
      wrong = [
        { text: `${cap(a.neg)} and ${b.neg}.`, why: 'Too strong. The claim is already false if just one half fails.' },
        { text: `${cap(a.pos)} or ${b.pos}.`, why: 'That’s true whenever the claim is, so it can’t be its negation.' },
      ];
    } else {
      claim = `${cap(a.pos)} or ${b.pos}.`;
      right = `${cap(a.neg)} and ${b.neg}.`;
      wrong = [
        { text: `${cap(a.neg)} or ${b.neg}.`, why: 'That negates an “and”. An “or” claim survives as long as either half holds, so both must fail.' },
        { text: `${cap(a.pos)} and ${b.pos}.`, why: 'That makes the “or” claim true, not false.' },
      ];
    }
  }
  return {
    kind: 'choice',
    body: `Which statement is the exact **negation** of this one (true precisely when it’s false)?\n\n“${claim}”`,
    options: [{ text: right, correct: true }, ...wrong],
    hint: 'Ask: what is the least that would prove the claim wrong?',
    explain: `The negation of “${stop(claim)}” is “${stop(right)}”. ${kind === 'all' ? 'To break “all”, one exception is enough.' : kind === 'some' ? 'To break “some”, there must be none at all.' : kind === 'none' ? 'To break “none”, one is enough.' : kind === 'and' ? 'An “and” fails as soon as either half fails.' : 'An “or” fails only when both halves fail.'}`,
  };
};

// ---------------------------------------------------------------- lesson 2: if–then

/** Everyday rules as full sentences, so each fact and conclusion reads naturally. */
const RULES = [
  { rule: 'If a parcel is marked urgent, it goes out today.', P: 'This parcel is marked urgent.', nP: 'This parcel isn’t marked urgent.', Q: 'It goes out today.', nQ: 'It doesn’t go out today.' },
  { rule: 'If Mia is on the night shift, she sleeps in the afternoon.', P: 'Mia is on the night shift.', nP: 'Mia isn’t on the night shift.', Q: 'She sleeps in the afternoon.', nQ: 'She doesn’t sleep in the afternoon.' },
  { rule: 'If the match is at home, Leo walks to the ground.', P: 'The match is at home.', nP: 'The match isn’t at home.', Q: 'Leo walks to the ground.', nQ: 'Leo doesn’t walk to the ground.' },
  { rule: 'If a dish contains nuts, it has a red label.', P: 'This dish contains nuts.', nP: 'This dish doesn’t contain nuts.', Q: 'It has a red label.', nQ: 'It doesn’t have a red label.' },
  { rule: 'If the reservoir is low, a hosepipe ban is in force.', P: 'The reservoir is low.', nP: 'The reservoir isn’t low.', Q: 'A hosepipe ban is in force.', nQ: 'No hosepipe ban is in force.' },
  { rule: 'If Omar takes the train, he reads on the way.', P: 'Omar takes the train.', nP: 'Omar doesn’t take the train.', Q: 'He reads on the way.', nQ: 'He doesn’t read on the way.' },
  { rule: 'If a loan is over £5,000, the bank needs two signatures.', P: 'This loan is over £5,000.', nP: 'This loan isn’t over £5,000.', Q: 'The bank needs two signatures.', nQ: 'The bank doesn’t need two signatures.' },
  { rule: 'If the café is busy, the music is turned up.', P: 'The café is busy.', nP: 'The café isn’t busy.', Q: 'The music is turned up.', nQ: 'The music isn’t turned up.' },
];
const NOTHING = 'Nothing definite follows';

const genIfThen: Generator = (rng) => {
  const r = pick(rng, RULES);
  const fact = pick(rng, ['P', 'nP', 'Q', 'nQ'] as const);
  let options: Choice[], explain: string;
  if (fact === 'P') {
    options = [
      { text: r.Q, correct: true },
      { text: r.nQ, why: 'The rule says the opposite happens.' },
      { text: NOTHING, why: 'The “if” part is true, so the rule promises the “then” part.' },
    ];
    explain = `The condition holds, so the rule delivers: “${stop(r.Q)}”.`;
  } else if (fact === 'nQ') {
    options = [
      { text: r.nP, correct: true },
      { text: r.P, why: 'If that were so, the rule would force the very thing that didn’t happen.' },
      { text: NOTHING, why: 'Something does follow: the contrapositive. If the condition held, the result would have to happen, and it didn’t.' },
    ];
    explain = `If the condition held, the rule would force the result. It didn’t happen, so: “${stop(r.nP)}” (the contrapositive).`;
  } else if (fact === 'Q') {
    options = [
      { text: NOTHING, correct: true },
      { text: r.P, why: 'That’s affirming the consequent. The rule says what the condition leads to, not that it’s the only route to the result.' },
      { text: r.nP, why: 'The rule doesn’t rule that out either: the condition might well hold.' },
    ];
    explain = 'The result can happen for other reasons, so you can’t work backwards to the condition. Concluding it anyway is **affirming the consequent**.';
  } else {
    options = [
      { text: NOTHING, correct: true },
      { text: r.nQ, why: 'That’s denying the antecedent. The rule says nothing about what happens when the condition fails.' },
      { text: r.Q, why: 'Nothing guarantees that either. The rule is silent when its condition fails.' },
    ];
    explain = 'The rule only speaks when its condition holds. Concluding the result won’t happen is **denying the antecedent**.';
  }
  return {
    kind: 'choice',
    body: `Rule: **${r.rule}**\n\nYou learn: ${r[fact]} What follows?`,
    options, explain,
  };
};

/** Mechanical states for abstract rules, so world knowledge can't help or hinder. */
const STATES = [
  { pos: 'the green light is on', neg: 'the green light is off' },
  { pos: 'the gate is open', neg: 'the gate is shut' },
  { pos: 'the bell is ringing', neg: 'the bell is silent' },
  { pos: 'the fan is running', neg: 'the fan is off' },
  { pos: 'the pump is on', neg: 'the pump is off' },
  { pos: 'the door is locked', neg: 'the door is unlocked' },
  { pos: 'the tank is full', neg: 'the tank isn’t full' },
  { pos: 'the flag is up', neg: 'the flag is down' },
];

const genContrapositive: Generator = (rng) => {
  const [p, q] = two(rng, STATES);
  return {
    kind: 'choice',
    body: `A machine follows the rule: **If ${p.pos}, then ${q.pos}.**\n\nWhich of these says exactly the same thing?`,
    options: [
      { text: `If ${q.neg}, then ${p.neg}.`, correct: true },
      { text: `If ${q.pos}, then ${p.pos}.`, why: 'That’s the converse: the rule run backwards. It’s a different claim.' },
      { text: `If ${p.neg}, then ${q.neg}.`, why: 'That’s the inverse. The rule says nothing about what happens when its condition fails.' },
    ],
    explain: `This is the contrapositive: swap the parts and negate both. The rule forbids only “${p.pos}” with “${q.neg}”. So when ${q.neg}, it can’t be that ${p.pos}.`,
  };
};

// ---------------------------------------------------------------- lesson 3: Wason cards

interface WasonSet { intro: string; rule: string; faces: [string, string, string, string]; Pd: string; nQd: string }

function wasonSet(rng: Rng): WasonSet {
  const kind = pick(rng, ['letters', 'letters', 'shapes', 'social', 'social'] as const);
  if (kind === 'letters') {
    const V = ['A', 'E', 'I', 'O', 'U'], C = ['B', 'D', 'K', 'M', 'R', 'T'], Ev = ['2', '4', '6', '8'], Od = ['3', '5', '7', '9'];
    const letters = { a: { name: 'a vowel', ex: pick(rng, V) }, b: { name: 'a consonant', ex: pick(rng, C) } };
    const nums = { a: { name: 'an even number', ex: pick(rng, Ev) }, b: { name: 'an odd number', ex: pick(rng, Od) } };
    const lp = rng() < 0.5 ? 'a' : 'b', nq = rng() < 0.5 ? 'a' : 'b';
    const other = (k: 'a' | 'b') => (k === 'a' ? 'b' : 'a');
    const [P, nP, Q, nQ] = rng() < 0.6
      ? [letters[lp], letters[other(lp)], nums[nq], nums[other(nq)]]
      : [nums[nq], nums[other(nq)], letters[lp], letters[other(lp)]];
    return {
      intro: 'Each card has a letter on one side and a number on the other.',
      rule: `If a card has ${P.name} on one side, it has ${Q.name} on the other.`,
      faces: [P.ex, nP.ex, Q.ex, nQ.ex], Pd: P.name, nQd: nQ.name,
    };
  }
  if (kind === 'shapes') {
    const shapes = shuffle(rng, ['circle', 'square', 'triangle', 'star']).slice(0, 2);
    const cols = shuffle(rng, ['red', 'blue', 'green', 'yellow']).slice(0, 2);
    return {
      intro: `Each card has a shape on one side (a ${shapes[0]} or a ${shapes[1]}) and a colour on the other (${cols[0]} or ${cols[1]}).`,
      rule: `If a card has a ${shapes[0]} on one side, it is ${cols[0]} on the other.`,
      faces: [cap(shapes[0]), cap(shapes[1]), cap(cols[0]), cap(cols[1])], Pd: `a ${shapes[0]}`, nQd: cols[1],
    };
  }
  const s = pick(rng, [
    { intro: 'Each card is a person in a bar: what they’re drinking on one side, their age on the other.', rule: 'If someone is drinking beer, they must be over 18.',
      faces: ['Beer', pick(rng, ['Cola', 'Lemonade', 'Water']), `Age ${randInt(rng, 21, 64)}`, `Age ${randInt(rng, 13, 17)}`] as [string, string, string, string], Pd: 'beer', nQd: 'an age of 18 or under' },
    { intro: 'Each card is a parcel: its weight on one side, its stamp on the other.', rule: 'If a parcel weighs over 2 kg, it must have a £5 stamp.',
      faces: [`${randInt(rng, 3, 9)} kg`, `${pick(rng, ['1', '1.5', '0.5'])} kg`, '£5 stamp', '£1 stamp'] as [string, string, string, string], Pd: 'a weight over 2 kg', nQd: 'a stamp that isn’t £5' },
    { intro: 'Each card is a visitor: where they are on one side, whether they’re wearing goggles on the other.', rule: 'If someone is in the lab, they must wear goggles.',
      faces: ['In the lab', pick(rng, ['In the café', 'In the office']), 'Goggles on', 'No goggles'] as [string, string, string, string], Pd: '“In the lab”', nQd: '“No goggles”' },
    { intro: 'Each card is an order form: the amount on one side, whether a manager signed it on the other.', rule: 'If an order is over £100, a manager must sign it.',
      faces: [`£${randInt(rng, 12, 90) * 10}`, `£${randInt(rng, 10, 95)}`, 'Signed', 'Not signed'] as [string, string, string, string], Pd: 'an amount over £100', nQd: '“Not signed”' },
  ]);
  return s;
}

/** A Wason task from a set: faces are [P, not-P, Q, not-Q]; the answer is always P and not-Q. */
function wasonTask(s: WasonSet, rng: Rng) {
  const order = shuffle(rng, [0, 1, 2, 3]);
  const cards = order.map((k) => s.faces[k]);
  const answer = order.map((k) => k === 0 || k === 3);
  return { cards, answer, explain: `Turn over **${s.faces[0]}** (its back might show ${s.nQd}) and **${s.faces[3]}** (its back might show ${s.Pd}). Those are the only cards that could break the rule. **${s.faces[2]}** and **${s.faces[1]}** are safe whatever is on the back.` };
}

const genWason: Generator = (rng) => {
  const s = wasonSet(rng);
  const t = wasonTask(s, rng);
  return {
    kind: 'task',
    body: `${s.intro}\n\nRule: **${s.rule}**\n\nTap exactly the cards you must turn over to check whether the rule is being followed.`,
    widget: cardPicker(t.cards, t.answer),
    hint: 'Which cards could hide a case that breaks the rule?',
    explain: t.explain,
  };
};

// ---------------------------------------------------------------- lesson 4: necessary and sufficient

/** Pairs of conditions and how they relate. rel 'sub': a guarantees b; 'eq': each guarantees the other. */
const PAIRS = [
  { ctx: '', a: 'being a dog', b: 'being a mammal', rel: 'sub', bNotA: 'a cat is a mammal but not a dog' },
  { ctx: '', a: 'living in Cardiff', b: 'living in Wales', rel: 'sub', bNotA: 'someone in Swansea lives in Wales but not in Cardiff' },
  { ctx: 'For whole numbers: ', a: 'being divisible by 4', b: 'being even', rel: 'sub', bNotA: '6 is even but not divisible by 4' },
  { ctx: 'For whole numbers: ', a: 'being a multiple of 6', b: 'being a multiple of 3', rel: 'sub', bNotA: '9 is a multiple of 3 but not of 6' },
  { ctx: 'For shapes: ', a: 'being a square', b: 'having four equal sides', rel: 'sub', bNotA: 'a squashed diamond (a rhombus) has four equal sides but isn’t a square' },
  { ctx: '', a: 'being over 2 metres tall', b: 'being over 1.8 metres tall', rel: 'sub', bNotA: 'someone 1.9 metres tall is over 1.8 metres but not over 2' },
  { ctx: 'For calendar years: ', a: 'being a leap year', b: 'having 366 days', rel: 'eq' },
  { ctx: 'For whole numbers: ', a: 'ending in 0', b: 'being divisible by 10', rel: 'eq' },
  { ctx: 'For triangles: ', a: 'having three equal sides', b: 'having three equal angles', rel: 'eq' },
  { ctx: 'For whole numbers: ', a: 'being prime', b: 'being odd', rel: 'none', aNotB: '2 is prime but not odd', bNotA: '9 is odd but not prime' },
  { ctx: 'For whole numbers: ', a: 'being a square number', b: 'being even', rel: 'none', aNotB: '9 is a square number but not even', bNotA: '6 is even but not a square number' },
] as const;

const NS_OPTS = ['Sufficient but not necessary', 'Necessary but not sufficient', 'Both necessary and sufficient', 'Neither necessary nor sufficient'];

const genNecSuff: Generator = (rng) => {
  const p = pick(rng, PAIRS);
  const flip = rng() < 0.5;
  const [x, y] = flip ? [p.b, p.a] : [p.a, p.b];
  // Does x guarantee y (sufficient)? Is x required for y (necessary: y guarantees x)?
  const suff = p.rel === 'eq' || (p.rel === 'sub' && !flip);
  const nec = p.rel === 'eq' || (p.rel === 'sub' && flip);
  // Counterexamples: x without y (not sufficient), y without x (not necessary).
  const xNotY = p.rel === 'sub' ? (flip ? p.bNotA : undefined) : p.rel === 'none' ? (flip ? p.bNotA : p.aNotB) : undefined;
  const yNotX = p.rel === 'sub' ? (flip ? undefined : p.bNotA) : p.rel === 'none' ? (flip ? p.aNotB : p.bNotA) : undefined;
  const claim = [[true, false], [false, true], [true, true], [false, false]] as const;
  const why = (s: boolean, n: boolean) => {
    if (s && !suff) return `It isn’t sufficient: ${xNotY}.`;
    if (!s && suff) return `It is sufficient: there’s no case of ${x} without ${y}.`;
    if (n && !nec) return `It isn’t necessary: ${yNotX}.`;
    return `It is necessary: there’s no case of ${y} without ${x}.`;
  };
  const options: Choice[] = NS_OPTS.map((text, k) => {
    const [s, n] = claim[k];
    return s === suff && n === nec ? { text, correct: true } : { text, why: why(s, n) };
  });
  const parts = [
    suff ? `${cap(x)} guarantees ${y}, so it’s sufficient.` : `It isn’t sufficient: ${xNotY}.`,
    nec ? `There’s no case of ${y} without it, so it’s necessary.` : `It isn’t necessary: ${yNotX}.`,
  ];
  return {
    kind: 'choice', ordered: true,
    body: `${p.ctx}**${p.ctx ? x : cap(x)}** is ___ for **${y}**.`,
    options,
    hint: 'Sufficient: does it guarantee the other? Necessary: can you have the other without it?',
    explain: parts.join(' '),
  };
};

const genOnlyIf: Generator = (rng) => {
  const [p, q] = two(rng, STATES);
  const form = pick(rng, [
    `${cap(p.pos)} only if ${q.pos}.`,
    `${cap(q.pos)} if ${p.pos}.`,
    `Whenever ${p.pos}, ${q.pos}.`,
    `${cap(p.pos)} only when ${q.pos}.`,
  ]);
  return {
    kind: 'choice',
    body: `A machine follows this rule:\n\n**${form}**\n\nWhich if–then says the same?`,
    options: [
      { text: `If ${p.pos}, then ${q.pos}.`, correct: true },
      { text: `If ${q.pos}, then ${p.pos}.`, why: 'That runs the rule backwards. Watch which part is the requirement (necessary) and which is the guarantee (sufficient).' },
      { text: `If ${p.neg}, then ${q.neg}.`, why: 'That’s the inverse, which says the same as the backwards version. The rule doesn’t say that.' },
    ],
    explain: `Whatever the wording, the rule makes “${q.pos}” necessary for “${p.pos}”. So whenever ${p.pos}, ${q.pos}: **if ${p.pos}, then ${q.pos}**.`,
  };
};

// ---------------------------------------------------------------- lesson 5: syllogisms

type Quant = 'all' | 'some' | 'no' | 'someNot';
interface Stmt { q: Quant; x: number; y: number }

/** A model says which of the 7 non-empty regions of a 3-set Venn diagram have members (bit r-1 for region r). */
function holds(model: number, s: Stmt): boolean {
  const X = 1 << s.x, Y = 1 << s.y;
  let xy = false, xNotY = false;
  for (let r = 1; r < 8; r++) {
    if (!(model & (1 << (r - 1)))) continue;
    if (r & X && r & Y) xy = true;
    if (r & X && !(r & Y)) xNotY = true;
  }
  return s.q === 'all' ? !xNotY : s.q === 'some' ? xy : s.q === 'no' ? !xy : xNotY;
}

/** Every term has at least one member (the traditional reading of “all”). */
function termsNonEmpty(model: number): boolean {
  for (let t = 0; t < 3; t++) {
    let any = false;
    for (let r = 1; r < 8; r++) if (model & (1 << (r - 1)) && r & (1 << t)) any = true;
    if (!any) return false;
  }
  return true;
}

/** Valid if no model makes the premises true and the conclusion false. */
function valid(prem: Stmt[], c: Stmt, existential: boolean): boolean {
  for (let m = 0; m < 128; m++) {
    if (existential && !termsNonEmpty(m)) continue;
    if (prem.every((p) => holds(m, p)) && !holds(m, c)) return false;
  }
  return true;
}

/** 'valid' / 'invalid' when the modern and traditional readings agree, otherwise null (we skip those). */
function verdict(prem: Stmt[], c: Stmt): 'valid' | 'invalid' | null {
  const a = valid(prem, c, false), b = valid(prem, c, true);
  return a === b ? (a ? 'valid' : 'invalid') : null;
}

const TERMS = [
  { pl: 'painters', sg: 'a painter' }, { pl: 'cyclists', sg: 'a cyclist' }, { pl: 'chess players', sg: 'a chess player' },
  { pl: 'singers', sg: 'a singer' }, { pl: 'gardeners', sg: 'a gardener' }, { pl: 'runners', sg: 'a runner' },
  { pl: 'cooks', sg: 'a cook' }, { pl: 'swimmers', sg: 'a swimmer' }, { pl: 'teachers', sg: 'a teacher' },
];
type Term = (typeof TERMS)[number];

function say(s: Stmt, t: Term[]): string {
  const x = t[s.x].pl, y = t[s.y].pl;
  return s.q === 'all' ? `All the ${x} are ${y}.` : s.q === 'some' ? `Some of the ${x} are ${y}.` : s.q === 'no' ? `None of the ${x} are ${y}.` : `Some of the ${x} aren’t ${y}.`;
}

function joinAnd(xs: string[], w = 'and'): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${w} ${xs[xs.length - 1]}`;
}

/** A smallest club where the premises hold and the conclusion fails, in words. */
function counterexample(prem: Stmt[], c: Stmt, t: Term[]): string {
  let best = -1, bestN = 99;
  for (let m = 1; m < 128; m++) {
    if (!termsNonEmpty(m) || !prem.every((p) => holds(m, p)) || holds(m, c)) continue;
    let n = 0;
    for (let k = m; k; k >>= 1) n += k & 1;
    if (n < bestN) { best = m; bestN = n; }
  }
  const kinds: string[] = [];
  for (let r = 1; r < 8; r++) {
    if (!(best & (1 << (r - 1)))) continue;
    const ins = [0, 1, 2].filter((k) => r & (1 << k)).map((k) => t[k].sg);
    const outs = [0, 1, 2].filter((k) => !(r & (1 << k))).map((k) => t[k].sg);
    kinds.push(`someone who is ${joinAnd(ins)}${outs.length ? `, but not ${joinAnd(outs, 'or')}` : ''}`);
  }
  const who = kinds.length === 1 ? `whose only member is ${kinds[0]}` : `whose only members are: ${kinds.slice(0, -1).join('; ')}; and ${kinds[kinds.length - 1]}`;
  return `Picture a club ${who}. Both premises are true there, yet the conclusion is false.`;
}

const QUANTS: Quant[] = ['all', 'some', 'no', 'someNot'];
function randStmt(rng: Rng, a: number, b: number): Stmt {
  const [x, y] = rng() < 0.5 ? [a, b] : [b, a];
  return { q: pick(rng, QUANTS), x, y };
}

const genSyllogism: Generator = (rng) => {
  const t = shuffle(rng, TERMS.slice()).slice(0, 3);
  const want = rng() < 0.5 ? 'valid' : 'invalid';
  let prem: Stmt[] = [], c: Stmt = { q: 'all', x: 0, y: 2 };
  for (let tries = 0; tries < 2000; tries++) {
    prem = [randStmt(rng, 0, 1), randStmt(rng, 1, 2)];
    c = randStmt(rng, 0, 2);
    const v = verdict(prem, c);
    if (v === want || (v && tries > 1500)) break;
  }
  const ok = verdict(prem, c) === 'valid';
  const cx = ok ? '' : counterexample(prem, c, t);
  const sure = 'Try to build a club where both premises are true and the conclusion is false: you can’t, so the conclusion is forced.';
  return {
    kind: 'choice', ordered: true,
    body: `About the members of a club:\n\n- ${say(prem[0], t)}\n- ${say(prem[1], t)}\n\nDoes it follow that **${low(stop(say(c, t)))}**?`,
    options: [
      ok ? { text: 'Yes, it must be true', correct: true } : { text: 'Yes, it must be true', why: cx },
      ok ? { text: 'No, it doesn’t follow', why: sure } : { text: 'No, it doesn’t follow', correct: true },
    ],
    hint: 'Hunt for a counterexample: a club where both premises hold but the conclusion fails.',
    explain: ok ? sure : cx,
  };
};

const genWhichFollows: Generator = (rng) => {
  const t = shuffle(rng, TERMS.slice()).slice(0, 3);
  const cands: Stmt[] = [
    { q: 'all', x: 0, y: 2 }, { q: 'all', x: 2, y: 0 }, { q: 'some', x: 0, y: 2 },
    { q: 'no', x: 0, y: 2 }, { q: 'someNot', x: 0, y: 2 }, { q: 'someNot', x: 2, y: 0 },
  ];
  for (let tries = 0; ; tries++) {
    const prem = [randStmt(rng, 0, 1), randStmt(rng, 1, 2)];
    const v = cands.map((c) => verdict(prem, c));
    if (v.includes(null) && tries < 5000) continue; // the two readings of “all” disagree: skip
    const good = cands.filter((_, k) => v[k] === 'valid');
    const bad = cands.filter((_, k) => v[k] === 'invalid');
    if (bad.length < 3 && tries < 5000) continue;
    // Prefer puzzles where something follows about two thirds of the time.
    if (!good.length && rng() < 0.6 && tries < 5000) continue;
    const none = `Nothing follows about the ${t[0].pl} and the ${t[2].pl}`;
    const wrong = shuffle(rng, bad).slice(0, 3).map((c) => ({ text: say(c, t), why: counterexample(prem, c, t) }));
    const right = good.length ? pick(rng, good) : null;
    const options: Choice[] = right
      ? [{ text: say(right, t), correct: true }, ...wrong.slice(0, 2), { text: none, why: `Something does follow: ${low(say(right, t))}` }]
      : [{ text: none, correct: true }, ...wrong];
    return {
      kind: 'choice',
      body: `About the members of a club:\n\n- ${say(prem[0], t)}\n- ${say(prem[1], t)}\n\nWhich conclusion **must** be true?`,
      options,
      hint: 'For each option, try to picture a club where the premises hold but it fails.',
      explain: right
        ? `${say(right, t)} No club can satisfy both premises without it. Each of the others has a counterexample.`
        : `Every conclusion on offer can fail while both premises hold, so nothing follows about those two groups.`,
    };
  }
};

// ---------------------------------------------------------------- lesson 6: knights and knaves

interface Claim { text: string; f: (a: boolean[]) => boolean }
const NAMES = ['Ada', 'Bram', 'Cleo', 'Dev', 'Esme', 'Finn', 'Hana', 'Ivo', 'Juno', 'Kit'];

function claimFor(rng: Rng, s: number, n: number, names: string[]): Claim {
  const t = pick(rng, [...Array(n).keys()].filter((k) => k !== s));
  const T = names[t];
  const kinds: Claim[] = [
    { text: `${T} is a knight.`, f: (a) => a[t] },
    { text: `${T} is a knave.`, f: (a) => !a[t] },
    { text: `${T} and I are both knights.`, f: (a) => a[s] && a[t] },
    { text: `${T} and I are both knaves.`, f: (a) => !a[s] && !a[t] },
    { text: `At least one of ${T} and me is a knave.`, f: (a) => !a[s] || !a[t] },
    { text: `${T} and I are the same kind.`, f: (a) => a[s] === a[t] },
    { text: `${T} and I are different kinds.`, f: (a) => a[s] !== a[t] },
  ];
  if (n === 3) kinds.push(
    { text: 'Exactly one of us is a knight.', f: (a) => a.filter(Boolean).length === 1 },
    { text: 'All three of us are knaves.', f: (a) => a.every((x) => !x) },
    { text: 'At least two of us are knights.', f: (a) => a.filter(Boolean).length >= 2 },
  );
  return pick(rng, kinds);
}

/** All assignments (true = knight) where every speaker's claim is true exactly when they're a knight. */
function kkSolutions(n: number, claims: (Claim | null)[]): boolean[][] {
  const out: boolean[][] = [];
  for (let m = 0; m < 1 << n; m++) {
    const a = [...Array(n).keys()].map((k) => !!(m & (1 << k)));
    if (claims.every((c, k) => !c || c.f(a) === a[k])) out.push(a);
  }
  return out;
}

const genKnights: Generator = (rng) => {
  const n = rng() < 0.6 ? 2 : 3;
  const names = shuffle(rng, NAMES).slice(0, n);
  let claims: (Claim | null)[] = [];
  let sol: boolean[][] = [];
  for (let tries = 0; tries < 500; tries++) {
    claims = names.map((_, s) => (n === 2 && s === 1 && rng() < 0.3 ? null : claimFor(rng, s, n, names)));
    sol = kkSolutions(n, claims);
    if (sol.length === 1) break;
  }
  if (sol.length !== 1) { // vanishingly rare; a known unique fallback (first a knave, the rest knights)
    claims = names.map((_, k) => k === 0 ? { text: `${names[1]} and I are both knaves.`, f: (a) => !a[0] && !a[1] }
      : k === 2 ? { text: `${names[0]} is a knave.`, f: (a) => !a[0] } : null);
    sol = kkSolutions(n, claims);
  }
  if (sol.length !== 1) throw new Error('knights puzzle not unique');
  const ans = sol[0];
  const label = (a: boolean[]) => names.map((nm, k) => `${nm} is a ${a[k] ? 'knight' : 'knave'}`).join(', ');
  const whyWrong = (a: boolean[]) => {
    const k = claims.findIndex((c, i) => c && c.f(a) !== a[i]);
    const c = claims[k]!;
    return a[k]
      ? `Then ${names[k]} is a knight, but “${stop(c.text)}” would be false.`
      : `Then ${names[k]} is a knave, but “${stop(c.text)}” would be true, and knaves never tell the truth.`;
  };
  const all: boolean[][] = [];
  for (let m = 0; m < 1 << n; m++) all.push([...Array(n).keys()].map((k) => !!(m & (1 << k))));
  const wrongs = shuffle(rng, all.filter((a) => a.some((x, k) => x !== ans[k]))).slice(0, 3);
  const said = names.map((nm, k) => (claims[k] ? `- ${nm} says: “${claims[k]!.text}”` : null)).filter(Boolean);
  const silent = names.filter((_, k) => !claims[k]);
  const check = names.map((nm, k) => claims[k]
    ? `${nm} is a ${ans[k] ? 'knight' : 'knave'} and “${stop(claims[k]!.text)}” is ${claims[k]!.f(ans) ? 'true' : 'false'}, as it should be.`
    : null).filter(Boolean).join(' ');
  return {
    kind: 'choice',
    body: `Knights always tell the truth; knaves always lie. You meet ${joinAnd(names)}.\n\n${said.join('\n')}${silent.length ? `\n\n${silent.join(' and ')} says nothing.` : ''}\n\nWho is what?`,
    options: [{ text: label(ans), correct: true }, ...wrongs.map((a) => ({ text: label(a), why: whyWrong(a) }))],
    hint: 'Test each option: is every knight’s claim true and every knave’s claim false?',
    explain: `${check} Every other combination contradicts someone’s claim.`,
  };
};

// ---------------------------------------------------------------- lesson 7: grid deduction

const PEOPLE = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];
const THEMES = [
  { intro: 'each own a different pet', items: ['cat', 'dog', 'rabbit', 'parrot'], does: 'owns', doesnt: 'doesn’t own' },
  { intro: 'each ordered a different drink', items: ['tea', 'coffee', 'juice', 'cocoa'], does: 'ordered', doesnt: 'didn’t order' },
  { intro: 'each play a different instrument', items: ['piano', 'violin', 'drums', 'flute'], does: 'plays', doesnt: 'doesn’t play' },
  { intro: 'each wore a different hat', items: ['red hat', 'blue hat', 'green hat', 'yellow hat'], does: 'wore', doesnt: 'didn’t wear' },
];

function perms(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of perms(n - 1)) for (let k = 0; k <= p.length; k++) out.push([...p.slice(0, k), n - 1, ...p.slice(k)]);
  return out;
}

/** keys: the person–item pairs a clue mentions, so we don't pair "X doesn't have A" with "X has A or B". */
interface GridClue { text: string; f: (p: number[]) => boolean; keys: string[] }

const genGrid: Generator = (rng) => {
  const n = rng() < 0.35 ? 3 : 4;
  const th = pick(rng, THEMES);
  const people = shuffle(rng, PEOPLE).slice(0, n).sort();
  const items = th.items.slice(0, n);
  const sol = shuffle(rng, [...Array(n).keys()]); // sol[person] = item
  const all = perms(n);
  // Every true clue of three kinds.
  const pool: GridClue[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) if (j !== sol[i]) pool.push({ text: `${people[i]} ${th.doesnt} the ${items[j]}.`, f: (p) => p[i] !== j, keys: [`${i}:${j}`] });
    for (let j = 0; j < n; j++) if (j !== sol[i]) {
      const [x, y] = rng() < 0.5 ? [sol[i], j] : [j, sol[i]];
      pool.push({ text: `${people[i]} ${th.does} the ${items[x]} or the ${items[y]}.`, f: (p) => p[i] === x || p[i] === y, keys: [`${i}:${x}`, `${i}:${y}`] });
    }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) {
    if (sol[i] !== j && sol[k] !== j) pool.push({ text: `Neither ${people[i]} nor ${people[k]} ${th.does} the ${items[j]}.`, f: (p) => p[i] !== j && p[k] !== j, keys: [`${i}:${j}`, `${k}:${j}`] });
  }
  const count = (cs: GridClue[]) => all.filter((p) => cs.every((c) => c.f(p))).length;
  const clues: GridClue[] = [];
  // First prefer clues about fresh pairings; if those run out before the answer is pinned down, use the rest.
  const skipped: GridClue[] = [];
  for (const c of shuffle(rng, pool)) {
    if (count(clues) === 1) break;
    if (c.keys.some((key) => clues.some((d) => d.keys.includes(key)))) skipped.push(c);
    else clues.push(c);
  }
  for (const c of skipped) {
    if (count(clues) === 1) break;
    clues.push(c);
  }
  // Drop clues that aren't needed, so every clue matters.
  for (let k = clues.length - 1; k >= 0; k--) {
    const without = clues.filter((_, i) => i !== k);
    if (count(without) === 1) clues.splice(k, 1);
  }
  if (count(clues) !== 1) throw new Error('grid puzzle not unique');
  return {
    kind: 'task',
    body: `${joinAnd(people)} ${th.intro}: ${joinAnd(items)}.\n\n${clues.map((c) => `- ${c.text}`).join('\n')}\n\nFill in the grid: tick who has which.`,
    widget: elimGrid(people, items, sol),
    hint: 'Cross out what each clue rules out. A row or column with one blank left gives you a tick.',
    explain: `${people.map((p, i) => `${p}: ${items[sol[i]]}`).join(' · ')}. Each tick lets you cross out the rest of its row and column.`,
  };
};

// ---------------------------------------------------------------- lesson 8: arguments

const ARGS = [
  { rule: 'If the boiler is broken, the radiators are cold.', P: 'The boiler is broken.', nP: 'The boiler isn’t broken.', Q: 'The radiators are cold.', nQ: 'The radiators aren’t cold.' },
  { rule: 'If Priya got the job, she’s moving to Leeds.', P: 'Priya got the job.', nP: 'Priya didn’t get the job.', Q: 'She’s moving to Leeds.', nQ: 'She isn’t moving to Leeds.' },
  { rule: 'If the advert worked, sales went up.', P: 'The advert worked.', nP: 'The advert didn’t work.', Q: 'Sales went up.', nQ: 'Sales didn’t go up.' },
  { rule: 'If the battery is flat, the car won’t start.', P: 'The battery is flat.', nP: 'The battery isn’t flat.', Q: 'The car won’t start.', nQ: 'The car starts.' },
  { rule: 'If the new diet works, Tom loses weight.', P: 'The new diet works.', nP: 'The new diet doesn’t work.', Q: 'Tom loses weight.', nQ: 'Tom doesn’t lose weight.' },
  { rule: 'If the server is down, the website shows an error.', P: 'The server is down.', nP: 'The server isn’t down.', Q: 'The website shows an error.', nQ: 'The website doesn’t show an error.' },
  { rule: 'If it snowed overnight, school is closed.', P: 'It snowed overnight.', nP: 'It didn’t snow overnight.', Q: 'School is closed.', nQ: 'School isn’t closed.' },
];
const VALID = 'Valid';
const AC = 'Invalid: affirming the consequent';
const DA = 'Invalid: denying the antecedent';

const genArgForm: Generator = (rng) => {
  const r = pick(rng, ARGS);
  const form = pick(rng, ['MP', 'MT', 'AC', 'DA'] as const);
  const [fact, concl] = form === 'MP' ? [r.P, r.Q] : form === 'MT' ? [r.nQ, r.nP] : form === 'AC' ? [r.Q, r.P] : [r.nP, r.nQ];
  const right = form === 'MP' || form === 'MT' ? VALID : form === 'AC' ? AC : DA;
  const whys: Record<string, string> = {
    [VALID]: form === 'AC'
      ? 'The result could have another cause, so it doesn’t prove the condition.'
      : 'The rule is silent when its condition fails, so this conclusion isn’t forced.',
    [AC]: form === 'DA'
      ? 'Close, but this argument starts from the condition failing (denying the antecedent), not from the result.'
      : form === 'MT' ? 'This one is the contrapositive: the result failed, so the condition must have failed too. That’s valid.' : 'Here the condition holds, so the result is guaranteed. That’s valid.',
    [DA]: form === 'AC'
      ? 'Close, but this argument starts from the result happening (affirming the consequent), not from the condition failing.'
      : form === 'MT' ? 'This one is the contrapositive: the result failed, so the condition must have failed too. That’s valid.' : 'Here the condition holds, so the result is guaranteed. That’s valid.',
  };
  const explain = {
    MP: 'The condition holds, so the rule guarantees the result. Valid.',
    MT: 'If the condition held, the result would have followed. It didn’t, so the condition failed. Valid (the contrapositive).',
    AC: 'The result can happen for other reasons, so it doesn’t prove the condition. That’s affirming the consequent.',
    DA: 'The rule doesn’t say what happens when the condition fails; the result might still come about. That’s denying the antecedent.',
  }[form];
  return {
    kind: 'choice', ordered: true,
    body: `Is this argument valid?\n\n- ${r.rule}\n- ${fact}\n- So: **${concl}**`,
    options: [VALID, AC, DA].map((text) => (text === right ? { text, correct: true } : { text, why: whys[text] })),
    explain,
  };
};

const GAPS = [
  { name: 'Sam', cat: 'a lawyer', cats: 'lawyers', does: 'went to university', do: 'went to university' },
  { name: 'Rosa', cat: 'a pilot', cats: 'pilots', does: 'has a licence', do: 'have a licence' },
  { name: 'Theo', cat: 'a vegan', cats: 'vegans', does: 'avoids cheese', do: 'avoid cheese' },
  { name: 'Nia', cat: 'a nurse', cats: 'nurses', does: 'knows first aid', do: 'know first aid' },
  { name: 'Ravi', cat: 'a chess club member', cats: 'chess club members', does: 'pays a fee', do: 'pay a fee' },
  { name: 'Lily', cat: 'a referee', cats: 'referees', does: 'knows the offside rule', do: 'know the offside rule' },
  { name: 'Joe', cat: 'a bus driver', cats: 'bus drivers', does: 'has had an eye test', do: 'have had an eye test' },
  { name: 'Ama', cat: 'a marathon runner', cats: 'marathon runners', does: 'trains every week', do: 'train every week' },
];

const genMissingPremise: Generator = (rng) => {
  const g = pick(rng, GAPS);
  return {
    kind: 'choice',
    body: `“${g.name} is ${g.cat}, so ${g.name} ${g.does}.”\n\nWhich unstated assumption would make this argument **valid**?`,
    options: [
      { text: `All ${g.cats} ${g.do}.`, correct: true },
      { text: `Everyone who ${g.does} is ${g.cat}.`, why: `That’s the converse. It says who counts as ${g.cat}, not what every one of the ${g.cats} does.` },
      { text: `Some ${g.cats} ${g.do}.`, why: `Too weak: ${g.name} might be one of the others.` },
    ],
    explain: `To get from “is ${g.cat}” to “${g.does}” you need every ${g.cat.replace(/^an? /, '')} to have that property. Spotting the hidden premise tells you what to check.`,
  };
};

// ---------------------------------------------------------------- course

export const logic: Course = {
  id: 'logic',
  title: 'Logic',
  blurb: 'Negate claims, test rules, solve puzzles, and catch arguments that only look airtight.',
  color: '#43b581',
  icon: '🧩',
  lessons: [
    {
      id: 'negation',
      title: 'Not, and, or',
      goal: 'Say exactly what it would take to prove a claim wrong.',
      steps: [
        {
          kind: 'choice',
          body: 'Your flatmate says: “**All** the mugs are clean.” You want to prove them wrong. What do you need to find?',
          options: [
            { text: 'At least one mug that isn’t clean', correct: true },
            { text: 'Every mug dirty', why: 'Much more than you need. A single dirty mug already makes “all” false.' },
            { text: 'At least one clean mug', why: 'That fits perfectly well with the claim. It can’t prove it wrong.' },
          ],
          explain: 'One exception breaks “all”. You don’t need the opposite extreme.',
        },
        {
          kind: 'read',
          title: 'The negation',
          body: 'A **statement** is something that’s either true or false. Its **negation** is true exactly when the statement is false. It isn’t the opposite extreme; it’s the least that would make the statement wrong.\n\n- “All are clean” is negated by “at least one isn’t clean”.\n- “Some are clean” is negated by “none are clean”.\n- “None are clean” is negated by “at least one is clean”.',
        },
        {
          kind: 'choice',
          body: 'Negate: “**Some** of the trains were late.”',
          options: [
            { text: 'None of the trains were late', correct: true },
            { text: 'Some of the trains were not late', why: 'Both can be true at once (some late, some on time), so this doesn’t contradict the claim.' },
            { text: 'All of the trains were late', why: 'That would make the claim true, not false.' },
          ],
          explain: '“Some” means at least one. It’s false only when there are none at all.',
        },
        {
          kind: 'choice',
          body: 'A friend promises: “The shop is open **and** it has bread.” When you arrive, the promise turns out false. What do you know?',
          options: [
            { text: 'The shop is closed, or it has no bread, or both', correct: true },
            { text: 'The shop is closed and has no bread', why: 'Too strong. An open shop with no bread is already enough to break the promise.' },
            { text: 'The shop is closed', why: 'That’s one way it could fail, but an open shop with no bread fails too.' },
          ],
          explain: 'An “and” claim needs both halves. It fails as soon as either half fails.',
        },
        {
          kind: 'read',
          title: 'De Morgan’s laws',
          body: 'Negating flips **and** into **or**, and **or** into **and**:\n\n- not (A and B) = (not A) or (not B)\n- not (A or B) = (not A) and (not B)\n\nIn logic, “or” is **inclusive**: “A or B” is true when either holds, including both.',
        },
        {
          kind: 'task',
          body: 'Fill in the last column: when is **not (A and B)** true?',
          widget: truthTable({ vars: ['A', 'B'], out: 'not (A and B)', fn: ([a, b]) => !(a && b) }),
          hint: 'First work out “A and B” on each row, then flip it.',
          explain: '“A and B” is true only on the top row (both true), so its negation is false there and true on the other three. That’s the same as “not A, or not B”.',
        },
        {
          kind: 'choice',
          body: 'Negate: “I’ll have tea **or** coffee.”',
          options: [
            { text: 'I’ll have neither tea nor coffee', correct: true },
            { text: 'I’ll have tea but not coffee', why: 'That actually makes the claim true: you had tea.' },
            { text: 'I won’t have tea, or I won’t have coffee', why: 'That’s the negation of “tea and coffee”. Having tea alone satisfies it, yet keeps the original claim true.' },
          ],
          explain: 'An “or” fails only when both halves fail: no tea and no coffee.',
        },
        {
          kind: 'choice',
          body: 'Harder: negate “**Every** student passed **at least one** exam.”',
          options: [
            { text: 'Some student failed every exam', correct: true },
            { text: 'Every student failed at least one exam', why: 'That can be true alongside the claim: everyone passed one and failed another.' },
            { text: 'No student passed any exam', why: 'Too strong. One student who failed everything is enough.' },
            { text: 'Some student failed at least one exam', why: 'That fits the claim fine: they could have passed a different exam.' },
          ],
          explain: 'Negate step by step: “every” becomes “some … not”, and “passed at least one” becomes “passed none”, that is, failed every one.',
        },
      ],
      practice: [genNegation],
    },
    {
      id: 'if-then',
      title: 'If… then',
      goal: 'Know what an if–then lets you conclude, and what it doesn’t.',
      steps: [
        {
          kind: 'choice',
          body: '“If it’s raining, the pavement is wet.” You look outside: the pavement is wet. Has it rained?',
          options: [
            { text: 'Not necessarily', correct: true },
            { text: 'Yes', why: 'A street cleaner or a burst pipe could have wet it. The rule doesn’t say rain is the only cause.' },
            { text: 'No', why: 'It may well have rained; you just can’t be sure.' },
          ],
          explain: 'The rule says what rain leads to. It doesn’t say a wet pavement can only come from rain.',
        },
        {
          kind: 'read',
          title: 'What an if–then rules out',
          body: '“If P, then Q” rules out **one** situation: P true and Q false. That’s all it says.\n\nThree statements look similar but aren’t the same:\n\n- **Converse**: if Q, then P.\n- **Inverse**: if not P, then not Q.\n- **Contrapositive**: if not Q, then not P.\n\nOnly the **contrapositive** is equivalent to the original.',
        },
        {
          kind: 'choice',
          body: '“If it’s raining, the pavement is wet.” This time the pavement is **dry**. What follows?',
          options: [
            { text: 'It isn’t raining', correct: true },
            { text: 'Nothing follows', why: 'Something does: if it were raining, the pavement would have to be wet.' },
            { text: 'It’s about to rain', why: 'The rule says nothing about the future.' },
          ],
          explain: 'Not Q, so not P: the contrapositive. Rain would have wet the pavement.',
        },
        {
          kind: 'choice',
          body: 'Same rule. It **isn’t raining**. What follows?',
          options: [
            { text: 'Nothing about the pavement', correct: true },
            { text: 'The pavement is dry', why: 'The rule is silent when it isn’t raining. A sprinkler could still wet the pavement.' },
            { text: 'The pavement is wet', why: 'Nothing points that way either.' },
          ],
          explain: 'Concluding “not Q” from “not P” is **denying the antecedent**. Concluding “P” from “Q” (the first question) is **affirming the consequent**. Both are classic mistakes.',
        },
        {
          kind: 'task',
          body: 'A parent promises: “If you tidy your room, you’ll get dessert.” In which situations was the promise **broken**? Mark each row.',
          widget: truthTable({ vars: ['Tidied', 'Dessert'], out: 'Promise', fn: ([p, q]) => !p || q, inYes: 'yes', inNo: 'no', yes: 'kept', no: 'broken' }),
          hint: 'The promise is only about what happens if the room gets tidied.',
          explain: 'Only one row breaks it: tidied, no dessert. If the room wasn’t tidied, the promise never kicked in, so dessert or not, it wasn’t broken.',
        },
        {
          kind: 'choice',
          body: 'Which says the same as “If you’re in Paris, you’re in France”?',
          options: [
            { text: 'If you’re not in France, you’re not in Paris', correct: true },
            { text: 'If you’re in France, you’re in Paris', why: 'That’s the converse, and it’s false: you could be in Lyon.' },
            { text: 'If you’re not in Paris, you’re not in France', why: 'That’s the inverse, also false: Lyon again.' },
          ],
          explain: 'The contrapositive flips and negates both parts, and it always means the same as the original.',
        },
        {
          kind: 'choice',
          body: 'A councillor: “If we build the bypass, traffic in town will fall. We’re not building it, so traffic won’t fall.” What’s wrong?',
          options: [
            { text: 'It denies the antecedent: traffic could fall for other reasons', correct: true },
            { text: 'It affirms the consequent', why: 'That would be “traffic fell, so we built the bypass”. Here the argument starts from the condition failing.' },
            { text: 'Nothing: it’s valid', why: 'The first sentence says nothing about what happens without the bypass.' },
          ],
          explain: 'From “not P” you can’t get “not Q”. Other measures, like a new bus route, could cut traffic too.',
        },
      ],
      practice: [genIfThen, genContrapositive],
    },
    {
      id: 'wason',
      title: 'Checking a rule',
      goal: 'Know which cases can break a rule, and check only those.',
      steps: [
        {
          kind: 'task',
          body: 'Each card has a letter on one side and a number on the other.\n\nRule: **If a card has a vowel on one side, it has an even number on the other.**\n\nTap exactly the cards you must turn over to find out whether the rule is true.',
          widget: cardPicker(['E', 'K', '4', '7'], [true, false, false, true]),
          hint: 'Which cards could hide a vowel paired with an odd number?',
          explain: 'Turn **E** (an odd number on the back would break the rule) and **7** (a vowel on the back would break it). **4** can’t break it: the rule doesn’t say even numbers need vowels. **K** can’t either.',
        },
        {
          kind: 'read',
          title: 'Look for the breaking case',
          body: 'This is the **Wason selection task**. Fewer than one person in ten gets it right; most pick E and 4.\n\nThe rule “if P, then Q” is broken only by **P with not-Q**. So turn over:\n\n- the **P** card (E), in case it hides not-Q, and\n- the **not-Q** card (7), in case it hides P.\n\nTurning the 4 feels useful because it could *agree* with the rule. But agreeing cases can’t prove a rule; only a breaking case can settle it.',
        },
        {
          kind: 'task',
          body: 'You’re checking a bar. Each card is a person: what they’re drinking on one side, their age on the other.\n\nRule: **If someone is drinking beer, they must be over 18.**\n\nWho do you need to check?',
          widget: cardPicker(['Beer', 'Cola', 'Age 25', 'Age 16'], [true, false, false, true]),
          explain: 'Check the **beer** drinker’s age and what the **16-year-old** is drinking. The 25-year-old can drink what they like, and the cola drinker can be any age.',
        },
        {
          kind: 'choice',
          body: 'Most people find the bar version easy and the letters version hard. Why, given that the logic is identical?',
          options: [
            { text: 'We’re good at spotting rule-breakers, so the breaking case jumps out', correct: true },
            { text: 'The bar version has a different correct pattern', why: 'Same pattern: the P card (beer) and the not-Q card (under 18).' },
            { text: 'Numbers are harder than ages', why: 'Ages are numbers too. The difference is that the familiar setting makes us hunt for a violation.' },
          ],
          explain: 'Framing it as catching cheaters makes us look for P with not-Q. With abstract cards, we look for matches instead. The fix is to always ask: what would break this?',
        },
        {
          kind: 'choice',
          body: 'Back to the letters: why don’t you need to turn the **4**?',
          options: [
            { text: 'Whatever is on its back, the rule isn’t broken', correct: true },
            { text: 'Because 4 is even, it must have a vowel', why: 'That’s the converse. The rule doesn’t say that, which is exactly why a consonant behind the 4 would be fine.' },
            { text: 'Because you’re only allowed to turn two cards', why: 'There’s no limit. You turn the cards that could break the rule, however many that is.' },
          ],
          explain: 'A vowel behind the 4 fits the rule; a consonant behind it doesn’t matter. So the 4 can’t tell you anything.',
        },
        {
          kind: 'task',
          body: 'Each card has a shape on one side (a circle or a square) and a colour on the other (red or blue).\n\nRule: **If a card has a circle on one side, it is red on the other.**',
          widget: cardPicker(['Red', 'Square', 'Blue', 'Circle'], [false, false, true, true]),
          hint: 'The breaking case is a circle that isn’t red.',
          explain: 'Turn the **circle** (it might be blue) and the **blue** card (it might be a circle). Red and square can’t break the rule.',
        },
        {
          kind: 'choice',
          body: 'Your manager claims: “Every customer who used the discount code spent over £50.” Whose orders should you pull to test it?',
          options: [
            { text: 'Code users, and customers who spent £50 or less', correct: true },
            { text: 'Code users, and customers who spent over £50', why: 'Big spenders can’t break the claim, whether or not they used the code.' },
            { text: 'Only customers who spent over £50', why: 'These can only agree with the claim. Look where it could fail.' },
          ],
          explain: 'The claim fails only for a code user who spent £50 or less. So check code users’ totals, and whether the small spenders used the code.',
        },
      ],
      practice: [genWason],
    },
    {
      id: 'necessary-sufficient',
      title: 'Necessary and sufficient',
      goal: 'Tell a requirement from a guarantee, whatever the wording.',
      steps: [
        {
          kind: 'choice',
          body: 'You need a ticket to get into the concert. Sam has a ticket. Is Sam definitely getting in?',
          options: [
            { text: 'Not necessarily', correct: true },
            { text: 'Yes', why: 'A ticket is needed, but that doesn’t make it enough. Sam might arrive late or be turned away at the door.' },
          ],
          explain: 'Needing something isn’t the same as it being enough.',
        },
        {
          kind: 'read',
          title: 'Two directions',
          body: 'In “if P, then Q”:\n\n- P is **sufficient** for Q: having P guarantees Q.\n- Q is **necessary** for P: you can’t have P without Q.\n\n“Oxygen is necessary for fire” means “if there’s a fire, there’s oxygen”, not the other way round.\n\nWatch the words: “P **if** Q” puts Q in the guarantee seat, while “P **only if** Q” makes Q a requirement, so it means “if P, then Q”.',
        },
        {
          kind: 'choice',
          body: 'Which if–then captures “Oxygen is necessary for fire”?',
          options: [
            { text: 'If there’s a fire, there’s oxygen', correct: true },
            { text: 'If there’s oxygen, there’s a fire', why: 'That makes oxygen sufficient. There’s oxygen in this room, and no fire.' },
          ],
          explain: 'A necessary condition follows the “then”: whenever there’s a fire, oxygen is present.',
        },
        {
          kind: 'choice', ordered: true,
          body: 'Being a square is ___ for being a rectangle.',
          options: [
            { text: 'Sufficient but not necessary', correct: true },
            { text: 'Necessary but not sufficient', why: 'A long thin rectangle isn’t a square, so being a square isn’t required.' },
            { text: 'Both necessary and sufficient', why: 'It isn’t necessary: plenty of rectangles aren’t squares.' },
            { text: 'Neither necessary nor sufficient', why: 'It is sufficient: every square is a rectangle.' },
          ],
          explain: 'Every square is a rectangle (sufficient), but not every rectangle is a square (not necessary).',
        },
        {
          kind: 'choice', ordered: true,
          body: 'Being at least 18 is ___ for being allowed to vote in a UK general election.',
          options: [
            { text: 'Sufficient but not necessary', why: 'Lots of adults can’t vote, for example those who aren’t eligible citizens or aren’t registered.' },
            { text: 'Necessary but not sufficient', correct: true },
            { text: 'Both necessary and sufficient', why: 'You also need to be an eligible citizen and registered.' },
            { text: 'Neither necessary nor sufficient', why: 'It is necessary: no one under 18 can vote in a general election.' },
          ],
          explain: 'You can’t vote without being 18 (necessary), but being 18 alone doesn’t give you the vote (not sufficient).',
        },
        {
          kind: 'choice',
          body: '“You can go out **only if** you’ve finished your homework.” You’ve finished. Can you go out?',
          options: [
            { text: 'Not necessarily: homework is a requirement, not a promise', correct: true },
            { text: 'Yes: that’s what “only if” means', why: '“Only if” sets a requirement. It says nothing about what happens once you’ve met it.' },
          ],
          explain: '“Go out only if homework” means “if you go out, you’ve done your homework”. Homework is necessary; it isn’t a guarantee.',
        },
        {
          kind: 'choice',
          body: '“**Unless** you book, you won’t get a table.” Which says the same?',
          options: [
            { text: 'Booking is necessary for getting a table', correct: true },
            { text: 'Booking guarantees a table', why: 'The sentence only says what happens if you don’t book. Booked tables can still fall through.' },
            { text: 'Getting a table is necessary for booking', why: 'That’s backwards: the sentence is about what you need for a table.' },
          ],
          explain: '“Unless P, not Q” means “if not P, then not Q”: without booking, no table. So booking is necessary.',
        },
        {
          kind: 'choice',
          body: 'A founder: “Every successful start-up had a brilliant team. We’ve got a brilliant team, so we’ll succeed.” What’s the flaw?',
          options: [
            { text: 'It treats a necessary condition as a sufficient one', correct: true },
            { text: 'It treats a sufficient condition as a necessary one', why: 'The other way round: a brilliant team is (at best) required, and the founder treats it as a guarantee.' },
            { text: 'There’s no flaw', why: 'Many failed start-ups had brilliant teams too.' },
          ],
          explain: '“Success → brilliant team” makes the team necessary. The founder reverses it to “brilliant team → success”.',
        },
      ],
      practice: [genNecSuff, genOnlyIf],
    },
    {
      id: 'syllogisms',
      title: 'All, some, none',
      goal: 'Decide which conclusions really follow from “all” and “some” claims.',
      steps: [
        {
          kind: 'choice',
          body: 'All bloops are razzies. All razzies are lazzies. Must all bloops be lazzies?',
          options: [
            { text: 'Yes', correct: true },
            { text: 'No', why: 'Every bloop is a razzie, and every razzie is a lazzie, so there’s no room for a bloop outside the lazzies.' },
            { text: 'You can’t tell without knowing what bloops are', why: 'You don’t need to. The form alone settles it.' },
          ],
          explain: 'Picture circles: bloops inside razzies, razzies inside lazzies. The conclusion is forced, whatever the words mean.',
        },
        {
          kind: 'choice',
          body: 'All roses are flowers. Some flowers fade quickly. So some roses fade quickly?',
          options: [
            { text: 'It doesn’t follow', correct: true },
            { text: 'It follows', why: 'The quick-fading flowers could all be tulips. Nothing links them to roses.' },
          ],
          explain: 'Roses are inside flowers, but the quick-fading flowers could sit entirely outside the roses.',
        },
        {
          kind: 'read',
          title: 'Hunt for a counterexample',
          body: 'An argument is **valid** when its conclusion can’t be false while its premises are true. Validity is about **form**, not about whether the claims are actually true.\n\nTo test one, try to build a counterexample: a situation where the premises hold and the conclusion fails. If you can, it’s invalid. If every attempt fails, it follows.',
        },
        {
          kind: 'choice',
          body: 'All living things need water. Roses need water. So roses are living things?',
          options: [
            { text: 'It doesn’t follow, even though the conclusion is true', correct: true },
            { text: 'It follows', why: 'Rust needs water too, and it isn’t alive. The premises don’t rule out non-living things that need water.' },
          ],
          explain: 'A true conclusion doesn’t make an argument valid. This is **belief bias**: we accept arguments whose conclusions we already believe.',
        },
        {
          kind: 'choice',
          body: 'No cats are dogs. Some pets are cats. Which must be true?',
          options: [
            { text: 'Some pets are not dogs', correct: true },
            { text: 'No pets are dogs', why: 'The premises say nothing to stop other pets being dogs.' },
            { text: 'Some pets are dogs', why: 'True in real life, but these premises don’t give it to you.' },
            { text: 'Some dogs are not pets', why: 'The premises allow every dog to be a pet.' },
          ],
          explain: 'The pets that are cats can’t be dogs, so at least some pets aren’t dogs.',
        },
        {
          kind: 'choice',
          body: 'All the climbers in a club are vegetarians. None of the vegetarians eat ham. What follows?',
          options: [
            { text: 'None of the climbers eat ham', correct: true },
            { text: 'Some of the ham-eaters are climbers', why: 'Climbers sit inside the vegetarians, who don’t eat ham, so no climber eats ham.' },
            { text: 'Nothing follows', why: 'Something does: every climber is a vegetarian, and no vegetarian eats ham.' },
          ],
          explain: 'Climbers ⊂ vegetarians, and vegetarians don’t overlap with ham-eaters. So climbers don’t either.',
        },
        {
          kind: 'choice',
          body: 'Some of the managers are cyclists. Some of the cyclists are under 30. So some of the managers are under 30?',
          options: [
            { text: 'It doesn’t follow', correct: true },
            { text: 'It follows', why: 'The cyclist managers and the young cyclists could be completely different people.' },
          ],
          explain: 'Two “some” premises almost never give a conclusion: the overlaps needn’t overlap each other.',
        },
        {
          kind: 'choice',
          body: 'None of the managers are under 30. Some of the cyclists are under 30. Which must be true?',
          options: [
            { text: 'Some of the cyclists are not managers', correct: true },
            { text: 'None of the cyclists are managers', why: 'Older cyclists could still be managers.' },
            { text: 'Some of the managers are not cyclists', why: 'Every manager could be a cyclist, as long as the young cyclists aren’t managers.' },
          ],
          explain: 'The cyclists who are under 30 can’t be managers, so at least those cyclists aren’t managers.',
        },
      ],
      practice: [genSyllogism, genWhichFollows],
    },
    {
      id: 'knights-knaves',
      title: 'Knights and knaves',
      goal: 'Solve truth-teller and liar puzzles by testing every case.',
      steps: [
        {
          kind: 'choice',
          body: 'On an island, **knights** always tell the truth and **knaves** always lie. You meet Ada. She says: “I am a knight.” What is she?',
          options: [
            { text: 'You can’t tell', correct: true },
            { text: 'A knight', why: 'A knave would say exactly the same thing, as a lie.' },
            { text: 'A knave', why: 'A knight would say it too, truthfully.' },
          ],
          explain: 'Both kinds can say it, so it tells you nothing. Evidence that fits every possibility isn’t evidence.',
        },
        {
          kind: 'choice',
          body: 'Bram says: “I am a knave.” What is he?',
          options: [
            { text: 'No islander could say that', correct: true },
            { text: 'A knave', why: 'Then the statement would be true, and knaves never tell the truth.' },
            { text: 'A knight', why: 'Then the statement would be false, and knights never lie.' },
          ],
          explain: 'A knight saying it would be lying; a knave saying it would be telling the truth. Neither is possible.',
        },
        {
          kind: 'read',
          title: 'Test every case',
          body: 'With two people there are only four cases: knight–knight, knight–knave, knave–knight, knave–knave.\n\nFor each case, check every speaker: a **knight**’s claim must be **true**, a **knave**’s must be **false**. Strike out any case where that fails. Whatever survives is the answer.',
        },
        {
          kind: 'choice',
          body: 'Cleo says: “Dev and I are **both knaves**.” Dev says nothing. Who is what?',
          options: [
            { text: 'Cleo is a knave, Dev is a knight', correct: true },
            { text: 'Both are knaves', why: 'Then Cleo’s claim would be true, and a knave can’t say something true.' },
            { text: 'Cleo is a knight, Dev is a knave', why: 'A knight can’t call herself a knave.' },
            { text: 'Both are knights', why: 'Then Cleo, a knight, would be saying something false.' },
          ],
          explain: 'Cleo can’t be a knight (she calls herself a knave). So she’s a knave and her claim is false: they’re not both knaves. So Dev is a knight.',
        },
        {
          kind: 'choice',
          body: 'Esme says: “**At least one** of Finn and me is a knave.” Finn says nothing. Who is what?',
          options: [
            { text: 'Esme is a knight, Finn is a knave', correct: true },
            { text: 'Esme is a knave, Finn is a knight', why: 'Then Esme’s claim would be true (she’s a knave), and knaves can’t say true things.' },
            { text: 'Both are knaves', why: 'Then Esme’s claim would be true, which a knave can’t say.' },
            { text: 'Both are knights', why: 'Then Esme’s claim would be false, and knights don’t lie.' },
          ],
          explain: 'If Esme were a knave, her claim would be true: impossible. So she’s a knight, her claim is true, and since she isn’t the knave, Finn must be.',
        },
        {
          kind: 'choice',
          body: 'Hana says: “Ivo is a knave.” Ivo says: “Hana and I are the **same kind**.” Who is what?',
          options: [
            { text: 'Hana is a knight, Ivo is a knave', correct: true },
            { text: 'Hana is a knave, Ivo is a knight', why: 'Then Ivo, a knight, says they’re the same kind, which would be false.' },
            { text: 'Both are knights', why: 'Then Hana’s claim that Ivo is a knave would be false.' },
            { text: 'Both are knaves', why: 'Then Hana’s claim that Ivo is a knave would be true, which a knave can’t say.' },
          ],
          explain: 'Only one case survives: Hana a knight (Ivo really is a knave), Ivo a knave (they really are different, so his claim is a lie).',
        },
        {
          kind: 'choice',
          body: 'Three islanders. Juno: “Kit is a knave.” Kit: “Ada is a knave.” Ada: “Juno and Kit are **both knaves**.” Who is what?',
          options: [
            { text: 'Juno is a knave, Kit is a knight, Ada is a knave', correct: true },
            { text: 'Juno is a knight, Kit is a knave, Ada is a knight', why: 'Then Ada, a knight, says Juno and Kit are both knaves, but Juno is a knight: false.' },
            { text: 'All three are knaves', why: 'Then Juno’s claim “Kit is a knave” would be true, which a knave can’t say.' },
            { text: 'Juno is a knight, Kit is a knave, Ada is a knave', why: 'Then Kit, a knave, says “Ada is a knave”, which would be true.' },
          ],
          hint: 'Start with Ada: what if she were a knight?',
          explain: 'If Ada were a knight, Juno and Kit would both be knaves, but then Juno’s “Kit is a knave” would be true. So Ada is a knave. Kit’s “Ada is a knave” is then true, so Kit is a knight, and Juno’s “Kit is a knave” is false, so Juno is a knave. Ada’s claim is false too, as it should be.',
        },
        {
          kind: 'choice',
          body: 'Two roads: one to the village. A guard stands at the fork, knight or knave, you don’t know which. You get one yes/no question. Which one tells you the way?',
          options: [
            { text: '“If I asked you whether the left road goes to the village, would you say yes?”', correct: true },
            { text: '“Does the left road go to the village?”', why: 'A knave would lie, and you don’t know which you’re talking to.' },
            { text: '“Are you a knight?”', why: 'Both say yes, and you’ve learned nothing about the roads.' },
          ],
          explain: 'A knight answers truthfully. A knave lies about what he would say, and since he would lie, the two lies cancel. Either way, “yes” means the left road is right.',
        },
      ],
      practice: [genKnights],
    },
    {
      id: 'elimination',
      title: 'Grid deduction',
      goal: 'Solve who-has-what puzzles by ruling things out.',
      steps: [
        {
          kind: 'task',
          body: 'Ana, Ben and Cal each have a different pet: a cat, a dog and a fish.\n\n- Ana is allergic to fur.\n- Ben’s pet doesn’t bark.\n\nTick who owns which pet.',
          widget: elimGrid(['Ana', 'Ben', 'Cal'], ['cat', 'dog', 'fish'], [2, 0, 1]),
          hint: 'Cats and dogs both have fur.',
          explain: 'Ana can’t have the cat or the dog, so she has the **fish**. Ben’s pet isn’t the dog, and the fish is taken, so Ben has the **cat**. That leaves Cal with the **dog**.',
        },
        {
          kind: 'read',
          title: 'Rule things out',
          body: 'The grid turns clues into marks:\n\n- A **✗** for every pairing a clue rules out.\n- A **✓** when a row or column has only one blank left, since everyone has exactly one thing.\n- Each ✓ lets you put ✗ in the rest of its row and column.\n\nYou rarely deduce a match directly. You get there by ruling out everything else.',
        },
        {
          kind: 'choice',
          body: 'In a 4 × 4 grid, Dee’s row has ✗ under tea, coffee and juice. Water is blank. What now?',
          options: [
            { text: 'Tick water for Dee, and cross out water for everyone else', correct: true },
            { text: 'Leave it blank until a clue mentions Dee and water', why: 'You already know: Dee has exactly one drink and three are ruled out.' },
            { text: 'Tick water for Dee and stop', why: 'Right tick, but keep going: no one else can have water now.' },
          ],
          explain: 'One option left means it must be the one. Then the ✓ spreads ✗s down its column.',
        },
        {
          kind: 'task',
          body: 'Dee, Eli, Fay and Gus each ordered a different drink: tea, coffee, juice and water. Tea and coffee are hot; juice and water are cold.\n\n- Neither Dee nor Eli ordered a hot drink.\n- Eli didn’t order water.\n- Fay ordered the tea or the juice.',
          widget: elimGrid(['Dee', 'Eli', 'Fay', 'Gus'], ['tea', 'coffee', 'juice', 'water'], [3, 2, 0, 1]),
          hint: 'The first clue fills four ✗s at once. Then the cold drinks are shared between Dee and Eli.',
          explain: 'Dee and Eli have the cold drinks. Eli didn’t have water, so **Eli: juice**, **Dee: water**. Fay had tea or juice, and juice is gone, so **Fay: tea**. That leaves **Gus: coffee**.',
        },
        {
          kind: 'read',
          title: 'Clues that link two people',
          body: 'Some clues don’t name a pairing at all: “The person who ordered coffee sat next to Fay” still tells you **Fay didn’t order coffee**.\n\nOrder clues work the same way. “Ivy finished ahead of Hal” means Ivy wasn’t last and Hal wasn’t first.',
        },
        {
          kind: 'task',
          body: 'Hal, Ivy, Jo and Kit ran a race and finished 1st to 4th, with no ties.\n\n- Ivy finished ahead of Hal.\n- Jo was neither first nor last.\n- Kit finished directly behind Hal.\n\nTick each runner’s place.',
          widget: elimGrid(['Hal', 'Ivy', 'Jo', 'Kit'], ['1st', '2nd', '3rd', '4th'], [2, 0, 1, 3]),
          hint: 'Hal can’t be first (Ivy beat him) or last (Kit is behind him).',
          explain: 'Hal is 2nd or 3rd. If Hal were 2nd, Kit would be 3rd, Ivy 1st and Jo last, but Jo isn’t last. So **Hal 3rd**, **Kit 4th**, and Jo, not first, is **2nd**, leaving **Ivy 1st**.',
        },
        {
          kind: 'choice',
          body: 'Halfway through a puzzle you’re stuck: no row or column is forced. What’s the best next move?',
          options: [
            { text: 'Suppose one option and follow it until it works or contradicts a clue', correct: true },
            { text: 'Guess the rest and check at the end', why: 'Random guessing can take ages. A targeted supposition rules things out as you go.' },
            { text: 'Give up: the puzzle has no unique answer', why: 'Being stuck with simple marks doesn’t mean the puzzle is ambiguous.' },
          ],
          explain: 'If an assumption leads to a contradiction, you’ve earned a ✗. That’s the same case-testing you used on knights and knaves, and on Hal in the race.',
        },
      ],
      practice: [genGrid],
    },
    {
      id: 'arguments',
      title: 'Valid, sound and sneaky',
      goal: 'Check both the logic and the premises of everyday arguments.',
      steps: [
        {
          kind: 'choice',
          body: '“All fish can fly. A salmon is a fish. So a salmon can fly.” Is this argument **valid**?',
          options: [
            { text: 'Yes: if the premises were true, the conclusion would have to be', correct: true },
            { text: 'No, because the conclusion is false', why: 'Validity is about whether the conclusion follows, not whether it’s true.' },
            { text: 'No, because a premise is false', why: 'A false premise makes the argument unsound, not invalid.' },
          ],
          explain: 'The logic is perfect; the first premise is nonsense. Valid, but not sound.',
        },
        {
          kind: 'read',
          title: 'Two separate checks',
          body: '- **Valid**: the conclusion follows from the premises. If they’re true, it must be.\n- **Sound**: valid **and** the premises really are true.\n\nOnly a sound argument guarantees its conclusion. So with any argument, ask two questions: *does it follow?* and *are the premises true?* Many bad arguments pass one and quietly fail the other.',
        },
        {
          kind: 'choice',
          body: 'Can a valid argument have a false premise and a **true** conclusion?',
          options: [
            { text: 'Yes', correct: true },
            { text: 'No', why: 'Example: “All cats are fish. All fish are mammals. So all cats are mammals.” Valid, two false premises, true conclusion.' },
          ],
          explain: '“All cats are fish; all fish are mammals; so all cats are mammals.” A true conclusion doesn’t vouch for the argument that reached it.',
        },
        {
          kind: 'choice',
          body: '“If the new manager is any good, sales will rise. Sales rose. So the new manager is good.” What’s the problem?',
          options: [
            { text: 'Sales could have risen for other reasons', correct: true },
            { text: 'Nothing: the argument is valid', why: 'It’s affirming the consequent: the result doesn’t prove this particular cause.' },
            { text: 'The first premise must be false', why: 'Even if the premise is true, the conclusion doesn’t follow.' },
          ],
          explain: 'That’s affirming the consequent. A seasonal boom, a rival closing down… plenty of things raise sales.',
        },
        {
          kind: 'choice',
          body: '“Hannah’s a doctor, so she knows the best diet for you.” What hidden premise is this relying on?',
          options: [
            { text: 'Doctors know the best diet for anyone', correct: true },
            { text: 'Hannah went to medical school', why: 'That just restates that she’s a doctor. The leap is from doctor to diet expert.' },
            { text: 'Some doctors know about diets', why: 'Too weak to support the conclusion: Hannah might not be one of them.' },
          ],
          explain: 'Spelled out, the hidden premise is much shakier than it sounded. Finding it shows you what to question.',
        },
        {
          kind: 'choice',
          body: '“Either we build the new road, or the town centre dies.” What does this argument quietly assume?',
          options: [
            { text: 'That there’s no third option', correct: true },
            { text: 'That the road will be expensive', why: 'Cost isn’t part of the argument at all.' },
            { text: 'That the town centre is already dying', why: 'Not needed; the claim is about what happens without the road.' },
          ],
          explain: 'An “either–or” is only as good as its claim to cover every option. Better buses, parking or rents might also save the centre. This is a **false dilemma**.',
        },
        {
          kind: 'choice',
          body: '“Everyone who got rich worked hard. I work hard, so I’ll get rich.” Which mistake is this?',
          options: [
            { text: 'Treating a necessary condition as sufficient', correct: true },
            { text: 'Denying the antecedent', why: 'That would be “I don’t work hard, so I won’t get rich”. This one runs the rule backwards instead.' },
            { text: 'No mistake: it’s valid', why: 'Plenty of hard workers never get rich. The premise doesn’t say hard work is enough.' },
          ],
          explain: '“Rich → worked hard” makes hard work necessary. The speaker reverses it to “worked hard → rich”, the converse.',
        },
        {
          kind: 'choice',
          body: '“Sam is a lawyer, so Sam went to university.” Which added premise would make this valid?',
          options: [
            { text: 'All lawyers went to university', correct: true },
            { text: 'Everyone who went to university is a lawyer', why: 'That’s the converse; it doesn’t tell you about Sam.' },
            { text: 'Some lawyers went to university', why: 'Too weak: Sam might be one of the others.' },
          ],
          explain: 'Now you know what to check. (In England it isn’t even true: some lawyers qualify through apprenticeships.)',
        },
      ],
      practice: [genArgForm, genMissingPremise],
    },
  ],
};
