// Fermi Chain: break a big estimate into factors, set each on a log slider, compare with a reference.
import type { Game } from './game';
import type { Rng } from '../types';
import { h, pick, seeded } from '../ui';
import { fmt } from './estimate';

interface Step {
  label: string;
  unit: string;
  ref: number;
  why: string;
  /** Slider spans 10^lo .. 10^hi. */
  lo: number;
  hi: number;
  /** Divide by this factor instead of multiplying. */
  div?: true;
}
interface Problem { q: string; unit: string; answer: number; steps: Step[] }

const s = (label: string, unit: string, ref: number, lo: number, hi: number, why: string, div?: true): Step => ({ label, unit, ref, lo, hi, why, div });

export const PROBLEMS: Problem[] = [
  { q: 'How many litres of water do the people of a city of 1 million drink in a day?', unit: 'litres a day', answer: 2e6, steps: [
    s('People in the city', 'people', 1e6, 5, 7, 'Given in the question.'),
    s('Drinks per person per day', 'drinks', 8, 0, 2, 'The old “eight glasses” rule is a fair round figure, counting tea and coffee.'),
    s('Litres per drink', 'litres', 0.25, -2, 0, 'A glass or mug holds about a quarter of a litre.')] },
  { q: 'How many piano tuners work in a city of 1 million people?', unit: 'tuners', answer: 20, steps: [
    s('People in the city', 'people', 1e6, 5, 7, 'Given in the question.'),
    s('People per household', 'people', 2.5, 0, 1, 'About 2 to 3 people share a home on average.', true),
    s('Share of homes with a piano', 'fraction', 0.05, -3, 0, 'Perhaps 1 home in 20.'),
    s('Tunings per piano per year', 'tunings', 1, -1, 1, 'Pianos are meant to be tuned about once a year.'),
    s('Tunings one tuner does a year', 'tunings', 1000, 2, 4, 'About 4 a day, 5 days a week, 50 weeks a year.', true)] },
  { q: 'How many times does a human heart beat in an 80-year life?', unit: 'beats', answer: 70 * 1440 * 365 * 80, steps: [
    s('Beats per minute', 'beats', 70, 1, 3, 'A resting adult pulse is around 60 to 80.'),
    s('Minutes in a day', 'minutes', 1440, 2, 4, '24 × 60 = 1,440.'),
    s('Days in a year', 'days', 365, 1, 3, '365.'),
    s('Years', 'years', 80, 1, 3, 'Given in the question.')] },
  { q: 'How many litres of petrol and diesel do the UK’s cars burn in a day?', unit: 'litres a day', answer: 3e7 * 30 * 0.07, steps: [
    s('Cars on UK roads', 'cars', 3e7, 6, 9, 'Roughly 30 million licensed cars (2020s).'),
    s('Kilometres per car per day', 'km', 30, 0, 3, 'About 11,000 km a year, so roughly 30 a day.'),
    s('Litres per kilometre', 'litres', 0.07, -3, 0, 'About 7 litres per 100 km for a typical car.')] },
  { q: 'How many golf balls would fit inside an empty single-deck bus?', unit: 'golf balls', answer: 10 * 2.5 * 2.2 * 15000, steps: [
    s('Length of the bus', 'metres', 10, 0, 2, 'A single-deck bus is about 10 to 12 m long.'),
    s('Width', 'metres', 2.5, -1, 1, 'Buses are about 2.5 m wide (the legal limit is 2.55 m).'),
    s('Height inside', 'metres', 2.2, -1, 1, 'Roughly 2.2 m floor to ceiling, ignoring seats and wheel arches.'),
    s('Golf balls per cubic metre', 'balls', 15000, 2, 6, 'A ball is 4.3 cm across (about 42 cm³); random packing fills about 64% of space: 0.64 ÷ 0.000042 ≈ 15,000.')] },
  { q: 'How many hours does a person sleep in an 80-year life?', unit: 'hours', answer: 8 * 365 * 80, steps: [
    s('Hours of sleep a night', 'hours', 8, 0, 2, 'Adults average 7 to 8; children much more, so 8 is fair over a life.'),
    s('Nights in a year', 'nights', 365, 1, 3, '365.'),
    s('Years', 'years', 80, 1, 3, 'Given in the question.')] },
  { q: 'How many grains of sand are in a 1 kg bag of fine sand?', unit: 'grains', answer: 0.6 * 1000 * 8000, steps: [
    s('Litres of sand in 1 kg', 'litres', 0.6, -2, 1, 'Dry sand weighs about 1.6 kg per litre, so 1 kg is about 0.6 litres.'),
    s('Cubic centimetres per litre', 'cm³', 1000, 1, 5, '1 litre = 1,000 cm³.'),
    s('Grains per cubic centimetre', 'grains', 8000, 1, 6, 'Fine grains are about 0.5 mm across: 2 × 2 × 2 per mm³ cube, so 1,000 mm³ ÷ 0.125 = 8,000.')] },
  { q: 'How many breaths does a person take in a year?', unit: 'breaths', answer: 15 * 1440 * 365, steps: [
    s('Breaths per minute', 'breaths', 15, 0, 2, 'At rest, adults breathe about 12 to 20 times a minute.'),
    s('Minutes in a day', 'minutes', 1440, 2, 4, '24 × 60 = 1,440.'),
    s('Days in a year', 'days', 365, 1, 3, '365.')] },
  { q: 'How many times does a car tyre turn on a 100 km drive?', unit: 'turns', answer: 50000, steps: [
    s('Distance', 'km', 100, 1, 3, 'Given in the question.'),
    s('Metres per kilometre', 'metres', 1000, 2, 4, '1,000.'),
    s('Distance per turn (tyre circumference)', 'metres', 2, -1, 1, 'A car tyre is about 65 cm across: π × 0.65 ≈ 2 m.', true)] },
  { q: 'How many litres of blood does a human heart pump in a day?', unit: 'litres', answer: 70 * 0.07 * 1440, steps: [
    s('Beats per minute', 'beats', 70, 1, 3, 'A resting pulse of about 70.'),
    s('Litres per beat', 'litres', 0.07, -3, 0, 'Each beat pushes out about 70 ml from each side of the heart.'),
    s('Minutes in a day', 'minutes', 1440, 2, 4, '24 × 60 = 1,440.')] },
  { q: 'How many cups of tea are drunk in the UK each day?', unit: 'cups', answer: 7e7 * 0.6 * 2.5, steps: [
    s('People in the UK', 'people', 7e7, 6, 9, 'About 67 to 70 million (2020s).'),
    s('Share who drink tea', 'fraction', 0.6, -2, 0, 'A clear majority of adults; fewer children.'),
    s('Cups per tea drinker per day', 'cups', 2.5, -1, 1, 'Many drink 2 to 4 a day, some only one.')] },
  { q: 'Counting one number at a time, about 3 seconds each, how many years would it take to count to a billion?', unit: 'years', answer: 1e9 * 3 / 86400 / 365, steps: [
    s('Numbers to say', 'numbers', 1e9, 7, 11, 'A billion is 10⁹.'),
    s('Seconds per number', 'seconds', 3, -1, 1, 'Given: big numbers like “four hundred million …” take a while to say.'),
    s('Seconds in a day', 'seconds', 86400, 3, 6, '24 × 60 × 60 = 86,400.', true),
    s('Days in a year', 'days', 365, 1, 3, 'No sleeping, no breaks.', true)] },
  { q: 'How many hairs are on a typical human head?', unit: 'hairs', answer: 600 * 200 * 0.9, steps: [
    s('Area of the scalp', 'cm²', 600, 1, 4, 'A head is roughly an 18 cm ball; the hairy part is about half its 1,000 cm² surface.'),
    s('Hairs per cm²', 'hairs', 200, 0, 3, 'Measured densities are about 150 to 250 per cm².'),
    s('Share of the scalp that has hair', 'fraction', 0.9, -1, 0, 'Most of it, for a full head of hair.')] },
  { q: 'How many litres of water fill an Olympic swimming pool?', unit: 'litres', answer: 50 * 25 * 2 * 1000, steps: [
    s('Length', 'metres', 50, 0, 3, 'An Olympic pool is 50 m long.'),
    s('Width', 'metres', 25, 0, 3, '25 m wide (10 lanes of 2.5 m).'),
    s('Depth', 'metres', 2, -1, 1, 'At least 2 m deep.'),
    s('Litres per cubic metre', 'litres', 1000, 1, 5, '1 m³ = 1,000 litres.')] },
  { q: 'How many steps does a person walk in an 80-year life?', unit: 'steps', answer: 5000 * 365 * 80, steps: [
    s('Steps per day', 'steps', 5000, 2, 5, 'Many adults average around 4,000 to 6,000.'),
    s('Days in a year', 'days', 365, 1, 3, '365.'),
    s('Years', 'years', 80, 1, 3, 'Given in the question.')] },
  { q: 'How many people are in the air on passenger planes at any moment?', unit: 'people', answer: 1e5 * 2 / 24 * 150, steps: [
    s('Flights per day worldwide', 'flights', 1e5, 3, 6, 'Roughly 100,000 flights a day before 2020.'),
    s('Hours per flight', 'hours', 2, -1, 2, 'Most flights are short hops; 2 hours is a fair average.'),
    s('Hours in a day', 'hours', 24, 0, 2, 'Flights are spread over 24 hours, so divide.', true),
    s('Passengers per flight', 'people', 150, 1, 3, 'A typical narrow-body jet seats 150 to 180.')] },
  { q: 'How many drops of water are in a full bath?', unit: 'drops', answer: 150 * 1000 * 20, steps: [
    s('Litres in a full bath', 'litres', 150, 1, 3, 'A typical bath holds around 150 litres.'),
    s('Millilitres per litre', 'ml', 1000, 2, 4, '1,000.'),
    s('Drops per millilitre', 'drops', 20, 0, 2, 'A drop is about 0.05 ml, so 20 to a millilitre.')] },
  { q: 'How many sheets of paper would make a stack as tall as Mount Everest?', unit: 'sheets', answer: 8800 * 1000 / 0.1, steps: [
    s('Height of Everest', 'metres', 8800, 2, 5, 'About 8,850 m; 8,800 is close enough.'),
    s('Millimetres per metre', 'mm', 1000, 2, 4, '1,000.'),
    s('Thickness of one sheet', 'mm', 0.1, -3, 0, 'Office paper is about 0.1 mm: a 500-sheet ream is about 5 cm.', true)] },
  { q: 'How many words are in all the books of a library holding a million books?', unit: 'words', answer: 1e6 * 300 * 300, steps: [
    s('Books', 'books', 1e6, 5, 7, 'Given in the question.'),
    s('Pages per book', 'pages', 300, 1, 4, 'A typical book runs to about 300 pages.'),
    s('Words per page', 'words', 300, 1, 4, 'About 250 to 350 words on a printed page.')] },
  { q: 'Walking non-stop, how many days would it take to walk around the equator?', unit: 'days', answer: 40000 / 5 / 24, steps: [
    s('Distance round the equator', 'km', 40000, 3, 6, 'About 40,000 km.'),
    s('Walking speed', 'km per hour', 5, 0, 2, 'A brisk walk is about 5 km/h.', true),
    s('Hours in a day', 'hours', 24, 0, 2, 'Walking all day and night.', true)] },
  { q: 'How many grains of rice are in a 5 kg sack?', unit: 'grains', answer: 5 * 1000 * 50, steps: [
    s('Kilograms in the sack', 'kg', 5, 0, 2, 'Given in the question.'),
    s('Grams per kilogram', 'grams', 1000, 2, 4, '1,000.'),
    s('Grains per gram', 'grains', 50, 0, 3, 'A grain of long-grain rice weighs about 0.02 g.')] },
  { q: 'How many Earths would fit inside the Sun (by volume)?', unit: 'Earths', answer: 109 ** 3, steps: [
    s('Sun’s width ÷ Earth’s width', 'times', 109, 1, 3, 'The Sun is about 109 Earths across.'),
    s('× that again (for depth)', 'times', 109, 1, 3, 'Volume scales with width cubed: the same ratio again…'),
    s('× that again (for height)', 'times', 109, 1, 3, '…and once more. 109³ ≈ 1.3 million.')] },
  { q: 'How many litres of air does a person breathe in a day?', unit: 'litres', answer: 15 * 0.5 * 1440, steps: [
    s('Breaths per minute', 'breaths', 15, 0, 2, 'About 12 to 20 at rest.'),
    s('Litres per breath', 'litres', 0.5, -2, 1, 'A resting breath is about half a litre.'),
    s('Minutes in a day', 'minutes', 1440, 2, 4, '24 × 60 = 1,440.')] },
];

// Slider notches: a roughly even log spacing that lands on round numbers.
const MANT = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8];
export function notches(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = lo; e < hi; e++) for (const m of MANT) out.push(Number((m * 10 ** e).toPrecision(3)));
  out.push(10 ** hi);
  return out;
}

export const chain = (steps: Step[], vals: number[]) => steps.reduce((p, st, k) => st.div ? p / vals[k] : p * vals[k], 1);
/** Orders of magnitude between guess and reference. */
export const decades = (guess: number, ref: number) => Math.abs(Math.log10(guess / ref));
/** 100 / (1 + d⁴): ×2 off ≈ 99, ×3 ≈ 95, ×10 = 50, ×30 ≈ 16, ×100 ≈ 6. */
export const fermiScore = (guess: number, ref: number) => 100 / (1 + decades(guess, ref) ** 4);

export function buildRound(rng: Rng) {
  const p = pick(rng, PROBLEMS);
  // Each slider starts at a seeded random notch, so the start gives nothing away.
  const start = p.steps.map((st) => Math.floor(rng() * notches(st.lo, st.hi).length));
  return { p, start };
}

const ratio = (mine: number, ref: number) => {
  const r = mine / ref;
  if (r > 0.83 && r < 1.2) return 'spot on';
  return r > 1 ? `×${fmt(Number(r.toPrecision(2)))} high` : `×${fmt(Number((1 / r).toPrecision(2)))} low`;
};

export const fermi: Game = {
  id: 'fermi', title: 'Fermi Chain', icon: '🧮', color: '#2a9d8f', course: 'science',
  blurb: 'One big question, a few small guesses, multiplied together.',
  how: 'A big question is split into a few factors. Set each one with its slider (or the − and + buttons); your answer multiplies up live.\n\nLock it in to compare with a reference answer. Within ×2 scores about 100, ×10 scores 50.',
  css: `

.g-fermi .fc-q { font-size: 1.15rem; font-weight: 600; margin: 0 0 6px; }
.g-fermi .fc-step { padding: 12px 0; border-top: 1px solid var(--line); }
.g-fermi .fc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.g-fermi .fc-op { color: var(--accent); font-weight: 700; margin-right: 4px; }
.g-fermi .fc-lab { font-weight: 600; }
.g-fermi .fc-val { font-weight: 700; font-size: 1.15rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
.g-fermi .fc-unit { color: var(--muted); font-size: .85rem; }
.g-fermi .fc-ctl { display: grid; grid-template-columns: 44px 1fr 44px; gap: 8px; align-items: center; margin-top: 6px; }
.g-fermi .fc-ctl button { min-height: 44px; padding: 0; font-size: 1.3rem; }
.g-fermi .fc-ctl .est { accent-color: var(--accent); margin: 0; }
.g-fermi .fc-total { position: sticky; bottom: 0; background: var(--panel); border-top: 2px solid var(--accent); margin-top: 4px; padding: 12px 0 4px; }
.g-fermi .feedback p:last-child { margin-bottom: 0; }
.g-fermi .fc-ans { font-size: 1.4rem; font-weight: 700; overflow-wrap: anywhere; }
.g-fermi .fc-go { width: 100%; min-height: 48px; margin-top: 10px; }
.g-fermi .fc-ref { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: var(--panel2); font-size: .95rem; }
.g-fermi .fc-ref .fc-tag { font-weight: 700; }
.g-fermi .fc-ref.near .fc-tag { color: var(--good); }
.g-fermi .fc-ref.far .fc-tag { color: var(--bad); }
`,
  mount(el, api) {
    const { p, start } = buildRound(api.rng);
    const grids = p.steps.map((st) => notches(st.lo, st.hi));
    const idx = start.slice();
    const vals = () => idx.map((k, j) => grids[j][k]);
    const ans = h('div', { class: 'fc-ans', 'aria-live': 'polite' });
    const update = () => { ans.textContent = `≈ ${fmt(chain(p.steps, vals()))} ${p.unit}`; };

    const rows = p.steps.map((st, j) => {
      const val = h('span', { class: 'fc-val' });
      const range = h('input', { type: 'range', class: 'est', min: 0, max: grids[j].length - 1, step: 1, value: String(idx[j]), 'aria-label': st.label }) as HTMLInputElement;
      const set = (k: number) => {
        idx[j] = Math.max(0, Math.min(grids[j].length - 1, k));
        range.value = String(idx[j]);
        val.textContent = fmt(grids[j][idx[j]]);
        range.setAttribute('aria-valuetext', `${fmt(grids[j][idx[j]])} ${st.unit}`);
        update();
      };
      range.addEventListener('input', () => set(Number(range.value)));
      const minus = h('button', { class: 'ghost', 'aria-label': `Less ${st.label}`, onclick: () => set(idx[j] - 1) }, '−');
      const plus = h('button', { class: 'ghost', 'aria-label': `More ${st.label}`, onclick: () => set(idx[j] + 1) }, '+');
      const row = h('div', { class: 'fc-step' },
        h('div', { class: 'fc-head' },
          h('div', null, j ? h('span', { class: 'fc-op' }, st.div ? '÷' : '×') : null, h('span', { class: 'fc-lab' }, st.label), h('div', { class: 'fc-unit' }, st.unit)),
          val),
        h('div', { class: 'fc-ctl' }, minus, range, plus));
      set(idx[j]);
      return { row, range, minus, plus };
    });

    const go = h('button', { class: 'primary fc-go', onclick: () => lock() }, 'Lock in my answer');
    const total = h('div', { class: 'fc-total' }, h('div', { class: 'fc-unit' }, 'Your answer'), ans, go);
    const card = h('div', { class: 'card' }, h('p', { class: 'fc-q' }, p.q), ...rows.map((r) => r.row), total);
    el.replaceChildren(card);
    update();

    const lock = () => {
      const mine = vals(), guess = chain(p.steps, mine);
      for (const r of rows) { r.range.disabled = true; r.minus.disabled = true; r.plus.disabled = true; }
      go.remove();
      total.style.position = 'static';
      // Biggest drift, signed in the direction it pushes the answer.
      let worst = 0, worstD = -1;
      p.steps.forEach((st, j) => {
        const d = decades(mine[j], st.ref);
        rows[j].row.append(h('div', { class: `fc-ref ${d < 0.3 ? 'near' : 'far'}` },
          h('span', { class: 'fc-tag' }, ratio(mine[j], st.ref)), ' · reference ', h('strong', null, `≈ ${fmt(st.ref)}`), `. ${st.why}`));
        if (d > worstD) { worstD = d; worst = j; }
      });
      const score = fermiScore(guess, p.answer);
      const off = decades(guess, p.answer);
      const sum = p.steps.reduce((a, st, j) => a + decades(mine[j], st.ref), 0);
      total.append(h('div', { class: `feedback ${off < 0.5 ? 'good' : 'bad'}` },
        h('div', { class: 'fb-head' }, h('strong', null, `Reference answer ≈ ${fmt(p.answer)} ${p.unit}`)),
        h('p', null, `Yours is ${ratio(guess, p.answer)}${off >= 0.05 ? ` (${off.toFixed(1)} orders of magnitude)` : ''}. These references are rough approximations too: being within a factor of 2 or 3 is a good Fermi estimate.`)));
      const ws = p.steps[worst];
      const lesson = worstD < 0.3
        ? 'Every factor was close to the reference: a tidy chain.'
        : sum > off + 0.5
          ? `Some of your errors cancelled out; the biggest drift was **${ws.label.toLowerCase()}** (${ratio(mine[worst], ws.ref)}).`
          : `Your biggest drift was **${ws.label.toLowerCase()}**: you said ${fmt(mine[worst])}, the reference is about ${fmt(ws.ref)}.`;
      api.finish(score, `Your estimate was ${ratio(guess, p.answer)} against the reference of about ${fmt(p.answer)} ${p.unit}. ${lesson}`);
    };
  },
  check(seed) {
    const qs = new Set<string>();
    for (const p of PROBLEMS) {
      if (qs.has(p.q)) return `duplicate problem: ${p.q}`;
      qs.add(p.q);
      if (p.steps.length < 3 || p.steps.length > 5) return `${p.steps.length} steps in ${p.q}`;
      for (const st of p.steps) {
        if (!(Number.isFinite(st.ref) && st.ref > 0)) return `bad factor ${st.ref} in ${p.q}`;
        if (!(st.ref >= 10 ** st.lo && st.ref <= 10 ** st.hi)) return `factor ${st.ref} outside slider in ${p.q}`;
        if (!st.why.trim() || !st.label.trim()) return `step without text in ${p.q}`;
      }
      const prod = chain(p.steps, p.steps.map((st) => st.ref));
      if (!(Number.isFinite(p.answer) && p.answer > 0)) return `bad answer in ${p.q}`;
      if (Math.abs(prod / p.answer - 1) > 0.01) return `factors give ${prod}, not ${p.answer}, in ${p.q}`;
    }
    if (PROBLEMS.length < 20) return `only ${PROBLEMS.length} problems`;
    if (Math.round(fermiScore(2, 1)) < 95 || Math.round(fermiScore(10, 1)) !== 50 || fermiScore(100, 1) > 10) return 'score curve off';
    const { p, start } = buildRound(seeded(seed));
    if (start.some((k, j) => !(k >= 0 && k < notches(p.steps[j].lo, p.steps[j].hi).length))) return 'slider start out of range';
    return null;
  },
};

