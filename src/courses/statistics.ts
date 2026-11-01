// Data & Statistics: reading charts, centre, spread, sampling, bias, correlation, Simpson's paradox
// and misleading graphs. All data sets are made up (and seeded, so the pictures are stable) unless
// a step says otherwise.
import type { Course, Generator, Layer, PlotSpec } from '../types';
import { h, num, pct, pick, randInt, seeded, shuffle } from '../ui';
import { barChart, columnChart, dataTable, iconArray, stackBar } from '../viz/charts';
import { cells } from '../viz/cs';
import { plotExplorer, stepper } from '../viz/explore';
import { niceStep, plotEl } from '../viz/plot';
import {
  areaTrick, bins, caption, corr, corrPairs, dotPlot, figure, mean, median, normals, pollCloud, quartiles, sampler, sd,
  sum, thumbHist, thumbs, thumbScatter,
} from '../widgets/statistics';

const COLOR = '#2f9e6b';
const MONTHS = 'JFMAMJJASOND';

/** Mean and median as two dashed lines with labels that never overlap (each label points away from the other). */
function centreLines(m: number, md: number, yTop: number, span: number): Layer[] {
  const off = span * 0.012;
  const meanRight = m >= md;
  return [
    { type: 'vline', x: md, color: 'var(--c3)' },
    { type: 'vline', x: m, color: 'var(--c2)' },
    { type: 'text', x: md + (meanRight ? -off : off), y: yTop, text: `median ${num(md)}`, color: 'var(--c3)', anchor: meanRight ? 'end' : 'start' },
    { type: 'text', x: m + (meanRight ? off : -off), y: yTop, text: `mean ${num(m)}`, color: 'var(--c2)', anchor: meanRight ? 'start' : 'end' },
  ];
}

const histSpec = (xs: number[], o: { start: number; width: number; k: number; xlabel?: string; ylabel?: string; size?: [number, number]; layers?: Layer[]; top?: number; color?: string }): PlotSpec => {
  const b = bins(xs, o.start, o.width, o.k);
  const top = o.top ?? Math.ceil(Math.max(...b.map((p) => p[1])) * 1.18);
  return {
    x: [o.start, o.start + o.width * o.k], y: [0, top], xlabel: o.xlabel, ylabel: o.ylabel, size: o.size ?? [480, 260],
    layers: [{ type: 'bars', pts: b, width: o.width, color: o.color ?? 'var(--c1)' }, ...(o.layers ?? [])],
  };
};

// ---------------------------------------------------------------- data sets (seeded, made up)

const PETS = [{ label: 'Dogs', value: 12 }, { label: 'Cats', value: 8 }, { label: 'Fish', value: 3 }, { label: 'Rabbits', value: 5 }];
const ICE = [1200, 1300, 1900, 2600, 3400, 5300, 5900, 5600, 4100, 2700, 1600, 1400];
const COMMUTE = [4, 9, 12, 7, 4, 2, 1]; // people per 10-minute bin, 0-70 minutes

const STUDY: [number, number][] = (() => {
  const r = seeded(11), z = normals(r, 16);
  return z.map((e, i) => {
    const hrs = Math.round((0.5 + (9 * i) / 15) * 2) / 2;
    return [hrs, Math.min(98, Math.round(50 + 4.5 * hrs + 5 * e))] as [number, number];
  }).filter(([x, y]) => Math.abs(x - 6) > 0.6 || Math.abs(y - 85) > 4);
})();

const SALARIES = [32, 35, 36, 38, 40, 42, 45, 48, 400]; // thousands
const BASE_OUT = [3, 4, 4, 5, 5, 6, 7];
const MEAN_DOTS = [1, 2, 2, 3, 3, 4, 4, 5, 9, 17];

const INCOMES = (() => normals(seeded(31), 400).map((z) => Math.exp(3.7 + 0.55 * z)).filter((x) => x < 150))();
const EASY_TEST = (() => normals(seeded(32), 400).map((z) => 100 - Math.exp(2.2 + 0.6 * z)).filter((x) => x > 40))();

const BUS_A = [4, 5, 5, 5, 6, 4, 5, 6, 5, 4, 6, 5];
const BUS_B = [0, 1, 2, 3, 5, 5, 7, 8, 9, 12, 0, 8];
const IQR_DATA = [2, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 30];

const Z200 = (() => { const z = normals(seeded(5), 200); const m = mean(z), s = sd(z); return z.map((x) => (x - m) / s); })();
const spreadSet = (s: number, seed: number) => normals(seeded(seed), 300).map((z) => 50 + s * z);

const phi = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
const sigmaTicks = (v: number) => (v === 0 ? 'μ' : `μ${v > 0 ? '+' : '−'}${Math.abs(v)}σ`);

const FLIPS = (() => { const r = seeded(21); return Array.from({ length: 2000 }, () => (r() < 0.5 ? 1 : 0)); })();

const HEIGHTS: [number, number][] = (() => {
  const r = seeded(41), z = normals(r, 50);
  return Array.from({ length: 25 }, (_, i) => { const ht = 168 + 9 * z[i]; return [Math.round(ht), Math.round(ht + 4 * z[25 + i])] as [number, number]; });
})();

const USHAPE: [number, number][] = (() => {
  const z = normals(seeded(43), 25);
  return Array.from({ length: 25 }, (_, i) => { const x = -3 + i * 0.25; return [x, x * x + 0.6 * z[i]] as [number, number]; });
})();
const R_USHAPE = corr(USHAPE);

const LINE_PTS: [number, number][] = (() => {
  const z = normals(seeded(47), 10);
  return Array.from({ length: 10 }, (_, i) => [i + 1, Math.round((2 * (i + 1) + 1 + z[i]) * 2) / 2] as [number, number]);
})();
const OUTLIER: [number, number] = [8, 3];
const R_WITH = corr([...LINE_PTS, OUTLIER]), R_WITHOUT = corr(LINE_PTS);

const WEATHER: [number, number][] = (() => {
  const z = normals(seeded(53), 24);
  const temp = [2, 4, 8, 12, 16, 20, 24, 23, 18, 12, 6, 3];
  return temp.map((t, i) => [Math.round(150 + 30 * t + 40 * z[i]), Math.max(0, Math.round((1 + 0.35 * t + 1.2 * z[12 + i]) * 10) / 10)] as [number, number]);
})();

const CHERRY = [50, 51.5, 51, 53, 54.5, 54, 56, 57.5, 57, 59, 60.5, 61, 62.5, 63, 64.5, 66, 64.5, 63, 62, 65.5, 67, 68.5, 69, 70.5, 72];
const REVENUE = [100, 104, 103, 108, 110, 113, 112, 116, 119, 121, 124];
const VIDEOS = [2, 3, 3.5, 5, 6, 6.5, 8, 9, 9.5, 11, 12];

// ---------------------------------------------------------------- practice generators

const genHistCount: Generator = (rng) => {
  const w = pick(rng, [5, 10]);
  const counts = Array.from({ length: 6 }, () => randInt(rng, 1, 12));
  const k = randInt(rng, 1, 5);
  const below = rng() < 0.5;
  const ctx = pick(rng, [['wait times at a clinic', 'minutes'], ['delivery times', 'minutes'], ['lengths of phone calls', 'minutes']] as const);
  const ans = below ? sum(counts.slice(0, k)) : sum(counts.slice(k));
  const T = k * w;
  return {
    kind: 'number', unit: 'people',
    body: `This histogram shows ${ctx[0]} (in ${ctx[1]}), in bins ${w} ${ctx[1]} wide. How many are **${below ? `under ${T}` : `${T} or more`}** ${ctx[1]}?`,
    widget: () => plotEl({ x: [0, 6 * w], y: [0, 14], ticks: [w, 2], xlabel: ctx[1], ylabel: 'count', size: [460, 240], layers: [{ type: 'bars', pts: counts.map((c, i) => [(i + 0.5) * w, c] as [number, number]), width: w }] }),
    answer: ans, tol: 0.01,
    hint: `Add up the heights of the bars ${below ? `to the left of ${T}` : `from ${T} rightwards`}.`,
    explain: `Each bar's height is a count. ${below ? 'The first' : 'The last'} ${below ? k : 6 - k} bar${(below ? k : 6 - k) === 1 ? '' : 's'}: ${(below ? counts.slice(0, k) : counts.slice(k)).join(' + ')} = ${ans}.`,
  };
};

const CHART_TASKS: [string, number][] = [
  ['compare how many members five clubs have', 0], ['show a city’s population every year since 1950', 1],
  ['see whether taller trees have wider trunks', 2], ['show how 300 students’ exam scores are spread out', 3],
  ['compare average rent in four neighbourhoods', 0], ['track a patient’s temperature every hour overnight', 1],
  ['check whether advertising spend relates to sales across 40 shops', 2], ['show the distribution of 1,000 adults’ heights', 3],
];
const CHART_KINDS = ['Bar chart', 'Line chart', 'Scatter plot', 'Histogram'];
const CHART_WHY = [
  'Bar charts compare separate categories, one bar each.',
  'Line charts show change along an ordered axis such as time.',
  'Scatter plots show how two numeric variables relate, one dot per case.',
  'Histograms show how one numeric variable is spread out, by counting values in ranges.',
];
const genChartPick: Generator = (rng) => {
  const [task, right] = pick(rng, CHART_TASKS);
  return {
    kind: 'choice', ordered: true,
    body: `You want to **${task}**. Which chart fits best?`,
    options: CHART_KINDS.map((t, i) => (i === right ? { text: t, correct: true } : { text: t, why: `${CHART_WHY[i]} That isn’t what this question needs.` })),
    explain: CHART_WHY[right],
  };
};

const genPlacePoint: Generator = (rng) => {
  const ctx = pick(rng, [['hours of sleep', 'mood score'], ['years of experience', 'skill rating'], ['km run per week', 'fitness score']] as const);
  const x = randInt(rng, 1, 9), y = randInt(rng, 2, 18) * 5;
  const cloud = Array.from({ length: 12 }, () => [randInt(rng, 0, 20) / 2, randInt(rng, 10, 95)] as [number, number]).filter(([a, b]) => Math.abs(a - x) > 1.2 || Math.abs(b - y) > 6);
  return {
    kind: 'point',
    body: `Each dot is one person: ${ctx[0]} across, ${ctx[1]} up. Add a person with **${x} ${ctx[0]}** and a **${ctx[1]} of ${y}**.`,
    plot: { x: [0, 10], y: [0, 100], xlabel: ctx[0], ylabel: ctx[1], size: [460, 300], layers: [{ type: 'dots', pts: cloud, color: 'var(--muted)' }] },
    answer: { x, y }, tol: 1, snap: 1,
    hint: 'Go across the horizontal axis first, then up.',
    explain: `${x} along the x-axis (${ctx[0]}), then up to ${y} on the y-axis (${ctx[1]}).`,
  };
};

const listOf = (xs: number[]) => xs.join(', ');

const genMean: Generator = (rng) => {
  const n = randInt(rng, 4, 6);
  const xs = Array.from({ length: n }, () => randInt(rng, 2, 30));
  const ctx = pick(rng, ['goals scored in a season by', 'books read last year by', 'hours of sport per week for']);
  const m = mean(xs);
  return {
    kind: 'number',
    body: `The ${ctx} ${n} friends: ${listOf(xs)}. What is the **mean**?`,
    answer: m, tol: 0.01,
    hint: 'Add them all up, then divide by how many there are.',
    explain: `Sum = ${sum(xs)}, and ${sum(xs)} ÷ ${n} = ${num(m)}.`,
  };
};

const genMedian: Generator = (rng) => {
  const n = randInt(rng, 5, 8);
  const xs = Array.from({ length: n }, () => randInt(rng, 1, 40));
  const s = [...xs].sort((a, b) => a - b);
  const md = median(xs);
  return {
    kind: 'number',
    body: `Waiting times (minutes) for ${n} patients: ${listOf(xs)}. What is the **median**?`,
    answer: md, tol: 0.01,
    hint: n % 2 ? 'Sort them; the median is the middle one.' : 'Sort them. With an even count, average the two middle values.',
    explain: `Sorted: ${listOf(s)}. ${n % 2 ? `The middle (${(n + 1) / 2}th) value is ${md}.` : `The two middle values are ${s[n / 2 - 1]} and ${s[n / 2]}; their average is ${num(md)}.`}`,
  };
};

const genMedianPoint: Generator = (rng) => {
  const n = randInt(rng, 5, 8);
  const xs = Array.from({ length: n }, () => randInt(rng, 1, 20));
  const md = median(xs);
  return {
    kind: 'point',
    body: `The dots are ${n} values: ${listOf(xs)}. Tap the number line at the **median**.`,
    plot: dotPlot(xs, { x: [0, 21], tick: 2, size: [480, 200] }),
    answer: { x: md }, tol: 0.3, snap: 0.5,
    hint: n % 2 ? 'Count in from either end to the middle dot.' : 'With an even count, the median is halfway between the two middle dots.',
    explain: `Sorted: ${listOf([...xs].sort((a, b) => a - b))}. The median is ${num(md)}.`,
  };
};

const genMedianMulti: Generator = (rng) => {
  const xs = new Set<number>();
  while (xs.size < 5) xs.add(randInt(rng, 1, 30));
  const s = [...xs].sort((a, b) => a - b);
  const md = s[2];
  const ch: [string, number[]][] = [
    [`Change ${s[4]} to ${s[4] * 10}`, [s[0], s[1], s[2], s[3], s[4] * 10]],
    [`Change ${s[0]} to 0`, [0, s[1], s[2], s[3], s[4]]],
    [`Change ${s[2]} to ${s[2] + 1}`, [s[0], s[1], s[2] + 1, s[3], s[4]]],
    [`Add a new value, ${s[4] + 10}`, [...s, s[4] + 10]],
    [`Change ${s[1]} to ${s[1] - 1}`, [s[0], s[1] - 1, s[2], s[3], s[4]]],
  ];
  return {
    kind: 'multi',
    body: `Data: ${listOf(shuffle(rng, s))} (median ${md}). Which changes would **change the median**? Select all that apply.`,
    options: ch.map(([text, ys]) => {
      const m2 = median(ys);
      return m2 !== md ? { text, correct: true, why: `The median becomes ${num(m2)}.` } : { text, why: `The middle value is still ${md}: only values crossing the middle (or changing the count) move the median.` };
    }),
    hint: 'Sort the values and watch what happens to the middle one.',
    explain: `The median only cares about the middle position. Pushing an extreme further out leaves it alone; changing the middle value, or adding a value (which shifts the middle), can move it.`,
  };
};

const genRangeIQR: Generator = (rng) => {
  const xs = new Set<number>();
  while (xs.size < 8) xs.add(randInt(rng, 1, 50));
  const s = [...xs].sort((a, b) => a - b);
  const shown = shuffle(rng, s);
  const iqr = rng() < 0.5;
  const [q1, q3] = quartiles(s);
  return {
    kind: 'number',
    body: `Eight runners’ finishing positions changed by: ${listOf(shown)} places. What is the **${iqr ? 'interquartile range (IQR)' : 'range'}**?${iqr ? ' (Use the median of each half for the quartiles.)' : ''}`,
    answer: iqr ? q3 - q1 : s[7] - s[0], tol: 0.01,
    hint: iqr ? 'Sort, split into the lower 4 and upper 4, take each half’s median.' : 'Largest minus smallest.',
    explain: iqr
      ? `Sorted: ${listOf(s)}. Lower half ${listOf(s.slice(0, 4))} → Q1 = ${num(q1)}; upper half ${listOf(s.slice(4))} → Q3 = ${num(q3)}. IQR = ${num(q3 - q1)}.`
      : `Sorted: ${listOf(s)}. Range = ${s[7]} − ${s[0]} = ${s[7] - s[0]}.`,
  };
};

const genEmpirical: Generator = (rng) => {
  const [mu, s, what, unit] = pick(rng, [[170, 7, 'Adult heights', 'cm'], [100, 15, 'Test scores', 'points'], [500, 20, 'Bags of rice', 'g'], [72, 4, 'Resting heart rates', 'bpm'], [38, 3, 'Shoe widths', 'mm']] as const);
  const k = randInt(rng, 1, 3);
  const mode = pick(rng, ['between', 'above', 'below'] as const);
  const within = [0.68, 0.95, 0.997][k - 1];
  const ans = mode === 'between' ? within : (1 - within) / 2;
  const lo = mu - k * s, hi = mu + k * s;
  return {
    kind: 'number', prob: true,
    body: `${what} are roughly normal with mean ${mu} ${unit} and SD ${s} ${unit}. About what share are **${mode === 'between' ? `between ${lo} and ${hi}` : mode === 'above' ? `above ${hi}` : `below ${lo}`}** ${unit}?`,
    answer: ans, tol: k === 3 && mode !== 'between' ? 0.0008 : 0.006,
    hint: `How many SDs from the mean is that? Then use 68–95–99.7${mode === 'between' ? '' : ' and split what’s left over between the two tails'}.`,
    explain: `${k} SD either side of the mean holds about ${pct(within)}.${mode === 'between' ? '' : ` The remaining ${pct(1 - within)} is split equally between the two tails: ${pct(ans, 2)} ${mode} that.`}`,
  };
};

const genSDChoice: Generator = (rng) => {
  const m = randInt(rng, 3, 8) * 10;
  const a = randInt(rng, 1, 5), b = randInt(rng, 1, 5);
  const A = [-2, -1, 0, 1, 2].map((d) => m + d * a);
  const B = [-3, 0, 0, 0, 3].map((d) => m + d * b);
  const sA = sd(A), sB = sd(B);
  const right = sA > sB ? 0 : 1;
  return {
    kind: 'choice', ordered: true,
    body: `Two sets with the same mean (${m}):\n\n**Set A**: ${listOf(shuffle(rng, A))}\n\n**Set B**: ${listOf(shuffle(rng, B))}\n\nWhich has the **larger standard deviation**?`,
    options: [
      right === 0 ? { text: 'Set A', correct: true } : { text: 'Set A', why: `Set A’s values sit about ${num(sA, 2)} from the mean on average (SD); Set B’s about ${num(sB, 2)}.` },
      right === 1 ? { text: 'Set B', correct: true } : { text: 'Set B', why: `B has three values right at the mean, but its other two are only ${3 * b} away. A’s SD is ${num(sA, 2)}, B’s ${num(sB, 2)}.` },
      { text: 'They’re the same', why: 'Same mean doesn’t mean same spread.' },
    ],
    hint: 'SD is roughly the typical distance from the mean. Count how far each value is from it.',
    explain: `SD of A = ${num(sA, 3)}, SD of B = ${num(sB, 3)}. Values far from the mean count a lot (they’re squared), so a few far values can outweigh several close ones.`,
  };
};

const genSDSort: Generator = (rng) => {
  const mu = randInt(rng, 5, 30) * 10, s = pick(rng, [10, 20, 30]);
  const zs = shuffle(rng, [0.5, -0.5, 0.8, -0.8, 1.3, -1.3, 1.6, -1.6, 2.4, -2.4, 3, -3]).slice(0, 5);
  const binOf = (z: number) => (Math.abs(z) < 1 ? 0 : Math.abs(z) < 2 ? 1 : 2);
  if (new Set(zs.map(binOf)).size < 2) zs[0] = 2.4;
  const uniq = [...new Set(zs)];
  return {
    kind: 'sort',
    body: `A data set has mean **${mu}** and SD **${s}**. Sort each value by how far it is from the mean.`,
    bins: ['Within 1 SD', '1 to 2 SDs away', 'More than 2 SDs away'],
    items: uniq.map((z) => ({ text: String(Math.round(mu + z * s)), bin: binOf(z) })),
    hint: `Work out each value’s distance from ${mu}, then divide by ${s}.`,
    explain: uniq.map((z) => `${Math.round(mu + z * s)} is ${num(Math.abs(z))} SD ${z > 0 ? 'above' : 'below'}`).join('; ') + '.',
  };
};

const genMargin: Generator = (rng) => {
  const n = pick(rng, [100, 400, 625, 900, 1600, 2500, 10000, 1000, 1500]);
  const m = 100 / Math.sqrt(n);
  return {
    kind: 'number', unit: 'points',
    body: `A random poll asks **${n.toLocaleString('en-US')}** people a yes/no question. Using margin of error ≈ 1/√n, about how many percentage points is the margin of error?`,
    answer: m, tol: 0.1,
    hint: 'Take 1/√n, then turn the proportion into percentage points (× 100).',
    explain: `√${n} ≈ ${num(Math.sqrt(n))}, so 1/√n ≈ ${num(1 / Math.sqrt(n))} = ±${num(m)} points.`,
  };
};

const genSampleNeeded: Generator = (rng) => {
  const m = pick(rng, [1, 2, 2.5, 4, 5, 10]);
  const n = (100 / m) ** 2;
  return {
    kind: 'number', unit: 'people',
    body: `You want a poll with a margin of error of about **±${m} points**. Using margin ≈ 1/√n, roughly how many people do you need?`,
    answer: n, tol: n * 0.01,
    hint: `Solve 1/√n = ${m / 100}: √n = ${num(100 / m)}.`,
    explain: `√n = 1 / ${m / 100} = ${num(100 / m)}, so n = ${num(100 / m)}² = ${n.toLocaleString('en-US')}.`,
  };
};

const genScaleFill: Generator = (rng) => {
  const n0 = pick(rng, [100, 400, 625, 2500]);
  const k = pick(rng, [2, 4, 5]);
  const m0 = 100 / Math.sqrt(n0);
  const opts = shuffle(rng, [m0 / k, m0 / (k * k), m0]);
  return {
    kind: 'fill',
    body: `A random poll of **${n0}** people has a margin of error of about ±${num(m0)} points. Complete the sentence.`,
    template: `A poll of ${(n0 * k * k).toLocaleString('en-US')} people (${k * k}× as many) has a margin of about ±[[0]] points.`,
    blanks: [{ options: opts.map((v) => num(v)), answer: opts.indexOf(m0 / k) }],
    hint: 'The margin goes like 1/√n. What is √ of the multiplier?',
    explain: `${k * k}× the people shrinks the margin by √${k * k} = ${k}: ${num(m0)} ÷ ${k} = ${num(m0 / k)}.`,
  };
};

const genNonresponse: Generator = (rng) => {
  const N = randInt(rng, 5, 20) * 100;
  const r = randInt(rng, 2, 6) / 10;
  const rep = Math.round(N * r);
  const yes = Math.round(rep * randInt(rng, 5, 9) / 10);
  const worst = rng() < 0.5;
  const ans = worst ? yes / N : (yes + N - rep) / N;
  return {
    kind: 'number', prob: true,
    body: `A company emails a satisfaction survey to all **${N.toLocaleString('en-US')}** customers. **${rep}** reply, and **${yes}** of them say they’re satisfied. If ${worst ? '**none**' : '**all**'} of the non-repliers are satisfied, what share of all customers is satisfied?`,
    answer: ans, tol: 0.003,
    hint: 'Count satisfied customers among everyone, not just repliers.',
    explain: `${worst ? `Only the ${yes}` : `${yes} + all ${N - rep} non-repliers = ${yes + N - rep}`} out of ${N}: ${pct(ans)}. The repliers alone say ${pct(yes / rep)}; with ${pct(1 - r, 0)} silent, the truth could be anywhere from ${pct(yes / N)} to ${pct((yes + N - rep) / N)}.`,
  };
};

const BIAS_CASES: [string, number][] = [
  ['A radio station asks listeners to phone in their views on its new presenter.', 1],
  ['A study of successful startups finds that their founders all took big risks.', 2],
  ['A poll about public transport is done by stopping people in a car park.', 0],
  ['A health survey is mailed to everyone; mostly retired people have time to fill it in.', 1],
  ['A guide to “how old houses were built better” looks only at houses still standing.', 2],
  ['To estimate average income, a researcher surveys people at an expensive golf club.', 0],
  ['A school asks parents to rate it at the open evening, which busy parents skip.', 1],
  ['A fund manager advertises the average return of the funds they still run.', 2],
  ['A city counts cyclists only on the road with a new bike lane, then estimates city-wide cycling.', 0],
];
const BIAS_KINDS = ['Selection bias', 'Nonresponse bias', 'Survivorship bias'];
const BIAS_WHY = [
  'Selection bias: the way people were chosen leaves part of the population out (or over-represents some).',
  'Nonresponse bias: everyone could answer, but the people who actually answer differ from those who don’t.',
  'Survivorship bias: you only see the cases that made it through some filter; the failures are invisible.',
];
const genBiasKind: Generator = (rng) => {
  const [text, k] = pick(rng, BIAS_CASES);
  return {
    kind: 'choice', ordered: true,
    body: `${text} Which bias is the main problem?`,
    options: BIAS_KINDS.map((t, i) => (i === k ? { text: t, correct: true } : { text: t, why: `${BIAS_WHY[i]} That’s not the main issue here.` })),
    explain: BIAS_WHY[k],
  };
};

const genBigVsRandom: Generator = (rng) => {
  const n1 = randInt(rng, 3, 15) * 100, n2 = randInt(rng, 2, 20) * 10000;
  const topic = pick(rng, ['a new city park', 'a four-day school week', 'banning cars from the centre', 'a new football stadium']);
  return {
    kind: 'choice',
    body: `Two estimates of support for **${topic}**. Poll X: ${n1.toLocaleString('en-US')} people picked at random from the voter list. Poll Y: ${n2.toLocaleString('en-US')} votes on a newspaper’s website. They disagree. Which should you trust more?`,
    options: [
      { text: 'Poll X, the random sample', correct: true },
      { text: 'Poll Y: it’s much bigger', why: 'Size shrinks random error, not bias. Website voters chose themselves, and they may feel more strongly or differ in age and views.' },
      { text: 'Average the two', why: 'Averaging in a biased number just moves you toward the bias.' },
    ],
    explain: `A random sample of ${n1} has a margin of about ±${num(100 / Math.sqrt(n1), 2)} points. Poll Y’s self-selection bias could be any size, and more votes won’t reduce it.`,
  };
};

const R_CHOICES = [-0.9, -0.5, 0, 0.5, 0.9];
const rDesc = (r: number) => (r === 0 ? 'no straight-line trend' : `${Math.abs(r) > 0.7 ? 'a tight' : 'a loose'} ${r > 0 ? 'upward' : 'downward'} trend`);
const genRPick: Generator = (rng) => {
  const r = pick(rng, R_CHOICES);
  const n = randInt(rng, 40, 70);
  const seed = randInt(rng, 1, 1e6);
  const ctx = pick(rng, ['students', 'towns', 'shops', 'patients', 'farms']);
  const pts = corrPairs(seed, n, r);
  return {
    kind: 'choice', ordered: true,
    body: `Each dot is one of ${n} ${ctx}. Which correlation fits best?`,
    widget: () => plotEl({ ...thumbScatter(pts), size: [360, 260] }),
    options: R_CHOICES.map((c) => (c === r ? { text: `r = ${c}`, correct: true } : { text: `r = ${c}`, why: `r = ${c} would look like ${rDesc(c)}; this cloud shows ${rDesc(r)}.` })),
    hint: 'Direction first (up or down?), then how tightly the dots hug a line.',
    explain: `The dots show ${rDesc(r)}, so r = ${r}.`,
  };
};

const CONFOUNDS: [string, string, string[]][] = [
  ['Children with bigger feet read better.', 'Age: older children have bigger feet and read better', ['Shoe shops sell books', 'Reading makes feet grow']],
  ['Days with more ice cream sold have more sunburn cases.', 'Hot, sunny weather', ['Ice cream makes skin burn', 'Sunburnt people crave ice cream']],
  ['Towns with more churches have more pubs.', 'Population: bigger towns have more of everything', ['Church-goers drink more', 'Pubs fund churches']],
  ['People who carry lighters get lung cancer more often.', 'Smoking', ['Lighters give off radiation', 'Cancer makes people buy lighters']],
  ['Neighbourhoods with more police officers have more crime.', 'Police are sent where crime already is (and big areas need more of both)', ['Police commit the crimes', 'Crime statistics are always faked']],
  ['Students who own more books get higher grades.', 'Family background: income and parents’ education affect both', ['Owning a book raises grades by itself', 'Grades decide how many books shops sell']],
];
const genConfounder: Generator = (rng) => {
  const [claim, right, wrongs] = pick(rng, CONFOUNDS);
  return {
    kind: 'choice',
    body: `${claim} What is the most likely explanation?`,
    options: [
      { text: right, correct: true },
      ...wrongs.map((w) => ({ text: w, why: 'That’s a direct causal story with no good reason behind it. Look for a third factor that drives both.' })),
    ],
    explain: `${right}. A lurking third variable (a confounder) can make two things move together without either causing the other.`,
  };
};

const genOutlierPoint: Generator = (rng) => {
  const a = pick(rng, [1.5, 2, 2.5]), b = randInt(rng, 1, 4);
  const pts: [number, number][] = Array.from({ length: 10 }, (_, i) => [i + 1, Math.round(a * (i + 1) + b + (rng() - 0.5) * 3)] as [number, number]);
  const ox = randInt(rng, 2, 9);
  const line = a * ox + b;
  const oy = line > 15 ? Math.round(line - randInt(rng, 9, 12)) : Math.round(line + randInt(rng, 9, 12));
  const all = [...pts, [ox, oy] as [number, number]];
  const ctx = pick(rng, ['A lab’s temperature sensor', 'A tide gauge', 'A delivery van’s fuel log', 'A plant-growth experiment']);
  return {
    kind: 'point',
    body: `${ctx}: 11 readings, and one was mistyped. Tap the **outlier**.`,
    plot: { x: [0, 11], y: [0, 32], size: [460, 300], layers: [{ type: 'dots', pts: shuffle(rng, all), color: 'var(--c1)' }] },
    answer: { x: ox, y: oy }, tol: 1, snap: 1,
    hint: 'Follow the trend with your eye and find the dot far off it.',
    explain: `The point (${ox}, ${oy}) sits about ${num(Math.abs(oy - line), 2)} away from the trend that the other ten follow. With it, r = ${num(corr(all), 2)}; without it, r = ${num(corr(pts), 2)}.`,
  };
};

const genSimpsonOverall: Generator = (rng) => {
  const n1 = randInt(rng, 1, 20) * 20, n2 = randInt(rng, 1, 20) * 20;
  const r1 = randInt(rng, 14, 19) * 5, r2 = randInt(rng, 6, 13) * 5;
  const s1 = (n1 * r1) / 100, s2 = (n2 * r2) / 100;
  const ans = (s1 + s2) / (n1 + n2);
  return {
    kind: 'number', prob: true,
    body: `A clinic treated **${n1}** mild cases (${r1}% recovered) and **${n2}** severe cases (${r2}% recovered). What is its **overall** recovery rate?`,
    answer: ans, tol: 0.003,
    hint: 'Count recoveries in each group, add them, divide by all patients. Don’t just average the two percentages.',
    explain: `${s1} + ${s2} = ${s1 + s2} recovered out of ${n1 + n2}: ${pct(ans)}. The simple average ${pct((r1 + r2) / 200)} ignores that the groups are different sizes.`,
  };
};

const genSimpsonWhich: Generator = (rng) => {
  // Hospital A is better in both groups by construction but (usually) gets more severe cases.
  const ra1 = randInt(rng, 17, 19) * 5, rb1 = ra1 - randInt(rng, 1, 2) * 5;
  const ra2 = randInt(rng, 8, 12) * 5, rb2 = ra2 - randInt(rng, 1, 2) * 5;
  const aMild = randInt(rng, 1, 4) * 100, aSev = randInt(rng, 3, 8) * 100;
  const bMild = randInt(rng, 3, 8) * 100, bSev = randInt(rng, 1, 4) * 100;
  const sa = (aMild * ra1 + aSev * ra2) / 100, sb = (bMild * rb1 + bSev * rb2) / 100;
  const oa = sa / (aMild + aSev), ob = sb / (bMild + bSev);
  const right = Math.abs(oa - ob) < 1e-12 ? 2 : oa > ob ? 0 : 1;
  const w = 'Compare overall counts: survivors ÷ patients for each hospital.';
  return {
    kind: 'choice', ordered: true,
    body: `Hospital A treated ${aMild + aSev} patients, Hospital B ${bMild + bSev}. Which has the higher **overall** survival rate?`,
    widget: () => dataTable(['', 'Mild', 'Severe'], [
      ['Hospital A', `${aMild * ra1 / 100}/${aMild} (${ra1}%)`, `${aSev * ra2 / 100}/${aSev} (${ra2}%)`],
      ['Hospital B', `${bMild * rb1 / 100}/${bMild} (${rb1}%)`, `${bSev * rb2 / 100}/${bSev} (${rb2}%)`]]),
    options: [
      right === 0 ? { text: 'Hospital A', correct: true } : { text: 'Hospital A', why: `A wins inside each group, but overall it saves ${sa}/${aMild + aSev} = ${pct(oa)} against B’s ${pct(ob)}: it takes more severe cases.` },
      right === 1 ? { text: 'Hospital B', correct: true } : { text: 'Hospital B', why: `${w} A: ${pct(oa)}, B: ${pct(ob)}.` },
      right === 2 ? { text: 'They’re equal', correct: true } : { text: 'They’re equal', why: `${w} A: ${pct(oa)}, B: ${pct(ob)}.` },
    ],
    hint: w,
    explain: `A: ${sa}/${aMild + aSev} = ${pct(oa)}. B: ${sb}/${bMild + bSev} = ${pct(ob)}. A is better within both groups${right === 1 ? ', yet B wins overall because B treats mostly mild cases: Simpson’s paradox.' : '.'}`,
  };
};

const genWeightFill: Generator = (rng) => {
  let n1 = randInt(rng, 1, 7) * 50, n2 = randInt(rng, 1, 7) * 50;
  if (n1 === n2) n2 += 50;
  const r1 = randInt(rng, 15, 19) * 5, r2 = randInt(rng, 6, 12) * 5;
  const w = n1 / (n1 + n2);
  const fmtW = (x: number) => num(Math.round(x * 1000) / 1000);
  const wOpts = shuffle(rng, [w, 1 - w, 0.5]);
  const wOpts2 = shuffle(rng, [1 - w, w, 0.5]);
  const res = shuffle(rng, [w * r1 + (1 - w) * r2, (r1 + r2) / 2, (1 - w) * r1 + w * r2]);
  const f = (v: number) => `${num(Math.round(v * 10) / 10)}%`;
  return {
    kind: 'fill',
    body: `${n1} mild patients (${r1}% recover) and ${n2} severe (${r2}% recover). Fill in the overall rate as a weighted average.`,
    template: `overall = [[0]] × ${r1}% + [[1]] × ${r2}% = [[2]]`,
    blanks: [
      { options: wOpts.map(fmtW), answer: wOpts.indexOf(w) },
      { options: wOpts2.map(fmtW), answer: wOpts2.indexOf(1 - w) },
      { options: res.map(f), answer: res.indexOf(w * r1 + (1 - w) * r2) },
    ],
    hint: 'Each group’s weight is its share of all the patients.',
    explain: `Weights: ${n1}/${n1 + n2} = ${fmtW(w)} and ${n2}/${n1 + n2} = ${fmtW(1 - w)}. Overall = ${f(w * r1 + (1 - w) * r2)}.`,
  };
};

const genTruncRatio: Generator = (rng) => {
  const a = randInt(rng, 40, 90), b = a + randInt(rng, 2, 12), s = a - randInt(rng, 1, 6);
  const looks = (b - s) / (a - s);
  return {
    kind: 'number',
    body: `A bar chart compares **${a}** and **${b}**, but its y-axis starts at **${s}**. How many times taller does the second bar *look*?`,
    answer: looks, tol: 0.02, unit: '×',
    hint: `The visible part of each bar starts at ${s}.`,
    explain: `Visible heights: ${b} − ${s} = ${b - s} and ${a} − ${s} = ${a - s}, so it looks ${num(looks)}× as tall. The real ratio is ${b}/${a} ≈ ${num(b / a)}.`,
  };
};

const genAreaScale: Generator = (rng) => {
  const k = randInt(rng, 2, 5);
  const cube = rng() < 0.4;
  const what = pick(rng, ['sales', 'users', 'profit', 'visitors']);
  const ans = cube ? k ** 3 : k * k;
  return {
    kind: 'number', unit: '×',
    body: cube
      ? `An infographic shows ${what} growing ${k}× by drawing a 3D box ${k}× as wide, ${k}× as tall and ${k}× as deep. How many times bigger does the new box’s **volume** look?`
      : `An infographic shows ${what} growing ${k}× by drawing an icon ${k}× as wide and ${k}× as tall. How many times bigger is its **area**?`,
    answer: ans, tol: 0.01,
    hint: cube ? 'Volume scales with all three dimensions.' : 'Area scales with width and height.',
    explain: `${cube ? `${k} × ${k} × ${k}` : `${k} × ${k}`} = ${ans}, for a real change of only ${k}×. Scale one length, or use plain bars.`,
  };
};

const genPerCapita: Generator = (rng) => {
  const popA = randInt(rng, 10, 40) * 100000, popB = randInt(rng, 1, 8) * 50000;
  const rateA = randInt(rng, 5, 40), rateB = randInt(rng, 3, 20) * 2;
  const cA = (popA / 100000) * rateA, cB = (popB / 100000) * rateB;
  const right = rateA === rateB ? 2 : rateA > rateB ? 0 : 1;
  const per = `per 100,000 people: Northton ${rateA}, Southby ${rateB}`;
  return {
    kind: 'choice', ordered: true,
    body: `Northton (population ${popA.toLocaleString('en-US')}) had **${cA.toLocaleString('en-US')}** bike thefts. Southby (population ${popB.toLocaleString('en-US')}) had **${cB.toLocaleString('en-US')}**. Where is a bike **more likely** to be stolen (per person)?`,
    options: [
      right === 0 ? { text: 'Northton', correct: true } : { text: 'Northton', why: `More thefts in total, but far more people too. ${per}.` },
      right === 1 ? { text: 'Southby', correct: true } : { text: 'Southby', why: `Compare rates, not totals: ${per}.` },
      right === 2 ? { text: 'Same rate', correct: true } : { text: 'Same rate', why: `Work out the rates: ${per}.` },
    ],
    hint: 'Divide thefts by population (then × 100,000).',
    explain: `Rates ${per}. Totals mostly tell you which place is bigger.`,
  };
};

// ---------------------------------------------------------------- course

const corrSlider = plotExplorer({
  params: [{ id: 'r', label: 'correlation r', min: -1, max: 1, step: 0.05, value: 0.6, format: (v) => v.toFixed(2) }],
  spec: (v) => ({ ...thumbScatter(corrPairs(77, 60, v.r)), size: [420, 320], tickFormat: undefined, xlabel: 'x', ylabel: 'y' }),
  readout: (v) => `r = ${v.r.toFixed(2)}`,
  goal: (v) => v.r <= -0.9 + 1e-9,
  goalText: 'A strong negative relationship: as x goes up, y reliably goes down.',
});

export const statistics: Course = {
  id: 'statistics',
  title: 'Data & Statistics',
  blurb: 'Read charts, summarise data, sample fairly and spot the graphs and numbers that mislead.',
  color: COLOR,
  icon: '📊',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'charts',
      title: 'Reading charts',
      goal: 'Know what bar, line, scatter and histogram charts show, and read their axes and units.',
      steps: [
        {
          kind: 'number', unit: 'students',
          body: 'A class was asked which pet they have. How many **more** students have a dog than a cat?',
          widget: figure(() => columnChart(PETS, { height: 200 }), 'Pets owned by students in one class (made-up data)'),
          answer: 4, tol: 0.01,
          explain: 'Dogs 12, cats 8: 12 − 8 = 4. In a bar chart, the length of each bar is the value, so comparing lengths compares values.',
        },
        {
          kind: 'read',
          title: 'Bar charts compare categories',
          body: 'Each bar is a separate **category** (dogs, cats…). The order of the bars doesn’t mean anything, so it often helps to sort them. What matters is **length**, which is why bars should start at zero.',
          widget: figure(() => barChart([...PETS].sort((a, b) => b.value - a.value), { title: 'Same data, sorted' })),
        },
        {
          kind: 'choice',
          body: 'An ice-cream shop’s monthly sales (made up). Between which two **consecutive** months did sales rise the most?',
          widget: figure(() => plotEl({ x: [0.5, 12.5], y: [0, 6500], ticks: [1, 1000], size: [480, 260], ylabel: 'ice creams sold',
            tickFormat: (v) => (Number.isInteger(v) && v >= 1 && v <= 12 ? MONTHS[v - 1] : String(v)),
            layers: [{ type: 'line', pts: ICE.map((y, i) => [i + 1, y] as [number, number]) }, { type: 'dots', pts: ICE.map((y, i) => [i + 1, y] as [number, number]), color: 'var(--c1)', r: 4 }] })),
          options: [
            { text: 'May → June', correct: true },
            { text: 'June → July', why: 'July is the peak, but the climb into it is small (+600). The steepest part of the line is just before.' },
            { text: 'April → May', why: 'A rise (+800), but May → June is much steeper (+1,900).' },
            { text: 'August → September', why: 'The line goes down there: sales fell by 1,500.' },
          ],
          hint: 'The biggest rise is where the line slopes up most steeply.',
          explain: 'May 3,400 → June 5,300 is +1,900, the steepest climb. On a line chart, **slope is the rate of change**: steep up = fast growth.',
        },
        {
          kind: 'read',
          title: 'Line charts show change',
          body: 'A line chart joins values along an **ordered** axis, usually time. Read it for **trends** (up, down, seasonal), and for the **slope**: how fast things change. Joining the dots only makes sense when the x-axis has an order; you wouldn’t join “dogs” to “cats”.',
        },
        {
          kind: 'point',
          body: 'Each dot is one student: hours studied (across) and test score (up). A new student studied **6 hours** and scored **85**. Place them.',
          plot: { x: [0, 10], y: [40, 100], xlabel: 'hours studied', ylabel: 'test score', size: [460, 300], layers: [{ type: 'dots', pts: STUDY, color: 'var(--muted)' }] },
          answer: { x: 6, y: 85 }, tol: 1, snap: 1,
          hint: 'Across to 6 on the bottom axis, then up to 85.',
          explain: 'x = 6 hours, y = 85 points. A **scatter plot** has one dot per case and two numeric axes, so you can see whether the two variables move together. Here: more study, higher scores, with plenty of scatter.',
        },
        {
          kind: 'choice',
          body: 'A histogram of 39 people’s commute times. What does the **height** of the tallest bar tell you?',
          widget: figure(() => plotEl({ x: [0, 70], y: [0, 14], ticks: [10, 2], xlabel: 'commute (minutes)', ylabel: 'people', size: [480, 260],
            layers: [{ type: 'bars', pts: COMMUTE.map((c, i) => [i * 10 + 5, c] as [number, number]), width: 10 }] }), 'Bars are 10 minutes wide (made-up data)'),
          options: [
            { text: '12 people have commutes between 20 and 30 minutes', correct: true },
            { text: 'The longest commute is 30 minutes', why: 'The x-axis is the commute time; bars go up to 70 minutes. Height is a count, not a time.' },
            { text: 'One person commutes for 12 minutes', why: 'That mixes up the axes: 12 is the count (up), and the bar covers 20–30 minutes (across).' },
            { text: 'The average commute is 25 minutes', why: 'The tallest bar is the most common range, not the average.' },
          ],
          explain: 'In a histogram, each bar covers a **range** of values and its height is **how many** values fall in that range. No gaps between bars: the x-axis is a continuous number.',
        },
        {
          kind: 'number', unit: 'people',
          body: 'Same histogram. How many people commute for **less than 20 minutes**?',
          widget: () => plotEl({ x: [0, 70], y: [0, 14], ticks: [10, 2], xlabel: 'commute (minutes)', ylabel: 'people', size: [480, 260],
            layers: [{ type: 'bars', pts: COMMUTE.map((c, i) => [i * 10 + 5, c] as [number, number]), width: 10 }] }),
          answer: 13, tol: 0.01,
          hint: 'Which bars cover times under 20?',
          explain: 'The 0–10 bar (4) and the 10–20 bar (9): 4 + 9 = 13 people.',
        },
        {
          kind: 'match',
          body: 'Match each question to the chart that answers it best.',
          heads: ['Question', 'Chart'],
          pairs: [
            ['Which of 5 products sold most?', 'Bar chart'],
            ['How did a share price move this year?', 'Line chart'],
            ['Do taller people have bigger feet?', 'Scatter plot'],
            ['How are 500 exam scores spread out?', 'Histogram'],
          ],
          explain: 'Categories → bars. Change over time → line. Two numbers per case → scatter. How one number is distributed → histogram.',
        },
        {
          kind: 'read',
          title: 'Always read the axes',
          body: 'Before reading any chart: what is on each axis, in what **units**, and where does each axis **start**? “Thousands” vs “millions”, “%” vs “percentage points”, per day vs per year: the picture can be identical while the meaning changes completely.',
          widget: figure(() => columnChart([{ label: 'Jan', value: 2.5 }, { label: 'Feb', value: 3 }, { label: 'Mar', value: 4.5 }, { label: 'Apr', value: 4 }], { height: 180 }), 'Museum visitors per month, in thousands'),
        },
        {
          kind: 'number', unit: 'visitors',
          body: 'From that chart (visitors per month, **in thousands**): how many visitors came in **March**?',
          widget: figure(() => columnChart([{ label: 'Jan', value: 2.5 }, { label: 'Feb', value: 3 }, { label: 'Mar', value: 4.5 }, { label: 'Apr', value: 4 }], { height: 180 }), 'Museum visitors per month, in thousands'),
          answer: 4500, tol: 0.5,
          hint: 'The bar says 4.5, but in what unit?',
          explain: '4.5 thousand = 4,500 visitors. Ignoring the unit would be off by a factor of 1,000.',
        },
        {
          kind: 'fill',
          body: 'Complete the description of a histogram.',
          template: 'Each bar covers a [[0]] of values, and its height is the [[1]] of values in it.',
          blanks: [
            { options: ['single category', 'range', 'point in time'], answer: 1 },
            { options: ['average', 'largest', 'count'], answer: 2 },
          ],
          explain: 'A histogram groups a numeric variable into ranges (bins) and counts how many values land in each. That’s what makes it different from a bar chart of categories.',
        },
      ],
      practice: [genHistCount, genChartPick, genPlacePoint],
    },
    // ------------------------------------------------------------ 2
    {
      id: 'center',
      title: 'Mean vs median',
      goal: 'Compute both centres, and know which one describes “typical” when there are outliers or skew.',
      steps: [
        {
          kind: 'choice',
          body: 'A small company’s nine salaries (in $ thousands). The boss earns 400. Which number best describes what a **typical** employee earns?',
          widget: figure(() => barChart(SALARIES.map((v, i) => ({ label: i === 8 ? 'Boss' : `Staff ${i + 1}`, value: v, color: i === 8 ? 'var(--c2)' : 'var(--c1)' })), { format: (v) => `$${v}k` }), 'Made-up salaries'),
          options: [
            { text: 'The median: $40k', correct: true },
            { text: 'The mean: about $79.6k', why: 'Eight of the nine people earn less than $50k. The single $400k salary drags the mean far above anyone typical.' },
            { text: 'The highest: $400k', why: 'That’s one person, the extreme, not the typical case.' },
          ],
          hint: 'Would most employees recognise that figure as their pay?',
          explain: 'Mean = 716 ÷ 9 ≈ 79.6. Median = the middle (5th) of the sorted values = 40. With one huge outlier, the median is the better “typical”.',
        },
        {
          kind: 'read',
          title: 'Two kinds of centre',
          body: '**Mean**: add everything up and divide by the count. It’s the balance point: if the dots were weights on a ruler, it would balance at the mean.\n\n**Median**: sort the values and take the middle one (or the average of the middle two). Half the values are below it, half above.',
          widget: figure(() => plotEl(dotPlot(SALARIES, { x: [0, 420], step: 4, tick: 50, xlabel: '$ thousands', minH: 3, layers: centreLines(mean(SALARIES), median(SALARIES), 3.4, 420) }))),
        },
        {
          kind: 'number',
          body: 'Find the **mean** of 4, 8, 6, 10, 7.',
          answer: 7, tol: 0.01,
          explain: '4 + 8 + 6 + 10 + 7 = 35, and 35 ÷ 5 = 7.',
        },
        {
          kind: 'number',
          body: 'Find the **median** of 9, 2, 7, 4, 12, 5.',
          answer: 6, tol: 0.01,
          hint: 'Sort first. Six values means there are two middle ones.',
          explain: 'Sorted: 2, 4, 5, 7, 9, 12. The middle two are 5 and 7, so the median is (5 + 7) ÷ 2 = 6.',
        },
        {
          kind: 'task',
          body: 'Seven values sit between 3 and 7. Drag the **last value** to the right until the **mean is at least double the median**.',
          widget: plotExplorer({
            params: [{ id: 'v', label: 'last value', min: 6, max: 60, step: 1, value: 8 }],
            spec: (v) => {
              const xs = [...BASE_OUT, v.v];
              return dotPlot(xs, { x: [0, 62], tick: 10, minH: 3, layers: centreLines(mean(xs), median(xs), 3.4, 62) });
            },
            readout: (v) => { const xs = [...BASE_OUT, v.v]; return `mean ${num(mean(xs))} · median ${num(median(xs))}`; },
            goal: (v) => mean([...BASE_OUT, v.v]) >= 2 * median([...BASE_OUT, v.v]),
            goalText: 'One value dragged the mean to double the median, which never moved.',
          }),
          hint: 'Watch the two lines: one follows the outlier, one barely notices it.',
          explain: 'The median stays at 5 however far the last value goes. The mean is (34 + v) ÷ 8, so it reaches 10 when v = 46. One extreme value can pull the mean anywhere.',
        },
        {
          kind: 'read',
          title: 'The median is resistant',
          body: 'The mean uses every value’s **size**, so one extreme value pulls it. The median only uses the **order**: making the largest value bigger doesn’t change which value is in the middle.\n\nThat’s why “average” house prices and incomes are usually reported as medians.',
        },
        {
          kind: 'point',
          body: 'Ten values: 1, 2, 2, 3, 3, 4, 4, 5, 9, 17. Tap the number line at the **mean** (the balance point).',
          plot: dotPlot(MEAN_DOTS, { x: [0, 18], tick: 1, minH: 2, size: [500, 200] }),
          answer: { x: 5 }, tol: 0.3, snap: 0.5,
          hint: 'Add them up (50) and divide by 10. It’s to the right of the big cluster: the 17 pulls it.',
          explain: 'Sum = 50, mean = 50 ÷ 10 = 5. The median is (3 + 4) ÷ 2 = 3.5: the long tail to the right pulls the mean past it.',
        },
        {
          kind: 'read',
          title: 'Skew: which way the tail points',
          body: 'When a distribution has a long **tail** on one side, it’s **skewed** that way. The mean is pulled into the tail; the median stays with the bulk.\n\nRight-skewed (incomes): mean > median. Left-skewed (scores on an easy test): mean < median.',
          widget: () => {
            const L = histSpec(INCOMES, { start: 0, width: 10, k: 15, xlabel: 'income ($k)', size: [480, 230] });
            const top = (L.y as [number, number])[1];
            L.layers!.push(...centreLines(mean(INCOMES), median(INCOMES), top * 0.9, 150));
            const R = histSpec(EASY_TEST, { start: 35, width: 5, k: 14, xlabel: 'score on an easy test', size: [480, 230], color: 'var(--c6)' });
            const top2 = (R.y as [number, number])[1];
            R.layers!.push(...centreLines(mean(EASY_TEST), median(EASY_TEST), top2 * 0.9, 70));
            return h('div', null, plotEl(L), caption('Right-skewed: a tail of high incomes'), plotEl(R), caption('Left-skewed: a tail of low scores'));
          },
        },
        {
          kind: 'choice',
          body: 'In most countries, the **mean** household income is well above the **median** household income. What does that tell you about the distribution?',
          options: [
            { text: 'It’s right-skewed: a long tail of very high incomes', correct: true },
            { text: 'Most households earn more than the mean', why: 'The opposite: when the mean is above the median, more than half the households earn less than the mean.' },
            { text: 'It’s left-skewed: a tail of very low incomes', why: 'A tail of low values would pull the mean below the median.' },
            { text: 'One of the numbers must be wrong', why: 'Both are right; they answer different questions. The gap is information about shape.' },
          ],
          explain: 'A few very high incomes pull the mean up; the median stays with the typical household. Mean far above median = right skew.',
        },
        {
          kind: 'sort',
          body: 'Which centre would you report? (Hint: the mean is right when you care about **totals**.)',
          bins: ['Median', 'Mean'],
          items: [
            { text: 'Typical house price in a city', bin: 0 },
            { text: 'Average spend per customer, to forecast next month’s total takings', bin: 1 },
            { text: 'Typical wait at A&E, when a few waits last 10+ hours', bin: 0 },
            { text: 'Average daily rainfall, to estimate the yearly total', bin: 1 },
            { text: 'A typical worker’s salary at a company with a billionaire founder', bin: 0 },
            { text: 'Average fuel use per truck, to budget fuel for the whole fleet', bin: 1 },
          ],
          explain: 'Mean × count = total, so the mean is the right tool for budgets and totals, outliers and all. For “what’s typical?” with skew or outliers, the median is more honest.',
        },
        {
          kind: 'multi',
          body: 'Data: 3, 5, 8, 11, 20 (median 8). Which changes would **change the median**? Select all that apply.',
          options: [
            { text: 'Change 20 to 200', why: 'The largest value moves further out, but 8 is still in the middle.' },
            { text: 'Change 8 to 9', correct: true, why: 'The middle value itself changed, so the median is now 9.' },
            { text: 'Change 3 to 1', why: 'Still below the middle; the median stays 8.' },
            { text: 'Add a new value, 30', correct: true, why: 'Six values now: the median is (8 + 11) ÷ 2 = 9.5.' },
            { text: 'Change 5 to 7', why: 'Sorted: 3, 7, 8, 11, 20. The middle is still 8.' },
          ],
          hint: 'Re-sort after each change and look at the middle.',
          explain: 'Only changes that touch the middle position (or shift it by changing the count) move the median. That’s its strength and its blind spot.',
        },
      ],
      practice: [genMean, genMedian, genMedianPoint, genMedianMulti],
    },
    // ------------------------------------------------------------ 3
    {
      id: 'spread',
      title: 'Spread and distributions',
      goal: 'Measure spread with range, IQR and SD, recognise shapes, and use the 68–95–99.7 rule.',
      steps: [
        {
          kind: 'choice',
          body: 'Two bus lines, 12 trips each. Both are **5 minutes late on average**. You need to catch a train. Which line do you take?',
          widget: () => h('div', null,
            plotEl(dotPlot(BUS_A, { x: [-0.5, 13], tick: 1, size: [480, 150], minH: 5, color: 'var(--c1)' })), caption('Line A: minutes late'),
            plotEl(dotPlot(BUS_B, { x: [-0.5, 13], tick: 1, size: [480, 150], minH: 5, color: 'var(--c2)' })), caption('Line B: minutes late')),
          options: [
            { text: 'Line A', correct: true },
            { text: 'Line B', why: 'Same average, but B is sometimes 12 minutes late. You can’t plan around it.' },
            { text: 'It doesn’t matter: same average', why: 'The average hides how **reliable** each line is. A is always 4–6 minutes late; B ranges from 0 to 12.' },
          ],
          explain: 'Same centre, very different **spread**. To plan, you need to know how far values wander from the average, not just the average.',
        },
        {
          kind: 'read',
          title: 'Range: the simplest spread',
          body: '**Range = largest − smallest.** Line A: 6 − 4 = 2 minutes. Easy, but fragile: it depends on just two values, so a single freak trip sets it.',
        },
        {
          kind: 'number', unit: 'minutes',
          body: 'Line B’s delays: 0, 1, 2, 3, 5, 5, 7, 8, 9, 12, 0, 8. What is the **range**?',
          answer: 12, tol: 0.01,
          explain: 'Largest 12, smallest 0: range = 12 minutes, six times Line A’s.',
        },
        {
          kind: 'read',
          title: 'IQR: the spread of the middle half',
          body: 'Sort the data. **Q1** is the median of the lower half, **Q3** the median of the upper half. The **interquartile range** IQR = Q3 − Q1 covers the middle 50%, so outliers can’t stretch it.\n\nBelow: Q1 = (5 + 6) ÷ 2 = 5.5, Q3 = (12 + 13) ÷ 2 = 12.5, IQR = 7. The range is 28, thanks to the 30.',
          widget: figure(() => cells(IQR_DATA, { hi: [3, 4, 5, 6, 7, 8], index: false }), 'Highlighted: the middle half (Q1 sits between the 3rd and 4th values, Q3 between the 9th and 10th)'),
        },
        {
          kind: 'number',
          body: 'Find the **IQR** of 1, 3, 4, 6, 8, 9, 11, 14 (use the median of each half).',
          answer: 6.5, tol: 0.01,
          hint: 'Lower half: 1, 3, 4, 6. Upper half: 8, 9, 11, 14.',
          explain: 'Q1 = (3 + 4) ÷ 2 = 3.5, Q3 = (9 + 11) ÷ 2 = 10. IQR = 10 − 3.5 = 6.5.',
        },
        {
          kind: 'read',
          title: 'Standard deviation: the typical distance from the mean',
          body: 'The **standard deviation** (SD) roughly measures how far values typically are from the mean. (Exactly: square each distance, average the squares, take the square root.) Small SD = values huddle close; large SD = they spread out.\n\nSlide it and watch the shaded band (mean ± 1 SD).',
          widget: plotExplorer({
            params: [{ id: 's', label: 'SD', min: 4, max: 20, step: 1, value: 10 }],
            spec: (v) => {
              const xs = Z200.map((z) => 50 + v.s * z);
              return histSpec(xs, { start: 0, width: 5, k: 20, top: 110, xlabel: 'value', ylabel: 'count', layers: [{ type: 'area', f: () => 110, from: 50 - v.s, to: 50 + v.s, color: 'var(--c3)' }, { type: 'vline', x: 50, color: 'var(--c2)', label: 'mean 50' }] });
            },
            readout: (v) => { const xs = Z200.map((z) => 50 + v.s * z); return `SD ${v.s} · ${Math.round(100 * xs.filter((x) => Math.abs(x - 50) <= v.s).length / xs.length)}% of values within 1 SD of the mean`; },
          }),
        },
        {
          kind: 'order',
          body: 'Order the four histograms from **smallest** to **largest** standard deviation. (Same x-axis on all four.)',
          widget: () => thumbs([
            { label: 'Plot A', spec: thumbHist(spreadSet(10, 61), 0, 5, 20, 'var(--c1)') },
            { label: 'Plot B', spec: thumbHist(spreadSet(3, 62), 0, 5, 20, 'var(--c2)') },
            { label: 'Plot C', spec: thumbHist(spreadSet(16, 63), 0, 5, 20, 'var(--c3)') },
            { label: 'Plot D', spec: thumbHist(spreadSet(6, 64), 0, 5, 20, 'var(--c6)') },
          ]),
          items: ['Plot B', 'Plot D', 'Plot A', 'Plot C'],
          hint: 'Narrow and tall = small SD. Wide and flat = large SD.',
          explain: 'B is a narrow spike (SD 3), then D (6), A (10) and C, spread across nearly the whole axis (16).',
        },
        {
          kind: 'match',
          body: 'Match each histogram to its shape.',
          widget: () => thumbs([
            { label: 'Plot 1', spec: thumbHist(INCOMES, 0, 10, 15, 'var(--c1)') },
            { label: 'Plot 2', spec: thumbHist(spreadSet(10, 65), 0, 5, 20, 'var(--c2)') },
            { label: 'Plot 3', spec: thumbHist([...normals(seeded(66), 150).map((z) => 30 + 6 * z), ...normals(seeded(67), 150).map((z) => 70 + 6 * z)], 0, 5, 20, 'var(--c3)') },
            { label: 'Plot 4', spec: thumbHist(EASY_TEST, 40, 5, 12, 'var(--c6)') },
          ]),
          heads: ['Plot', 'Shape'],
          pairs: [
            ['Plot 1', 'Long tail to the right (right-skewed)'],
            ['Plot 2', 'Symmetric, one peak'],
            ['Plot 3', 'Two peaks (bimodal)'],
            ['Plot 4', 'Long tail to the left (left-skewed)'],
          ],
          explain: 'Name a skew after its **tail**, not its peak. Two peaks often mean two groups mixed together (say, the heights of children and adults).',
        },
        {
          kind: 'read',
          title: 'The normal curve and 68–95–99.7',
          body: 'Many measurements (heights, measurement errors, test scores) pile up in a symmetric bell: the **normal distribution**. For a normal distribution:\n\n- about **68%** of values are within 1 SD of the mean\n- about **95%** within 2 SDs\n- about **99.7%** within 3 SDs',
          widget: figure(() => plotEl({ x: [-3.5, 3.5], y: [0.0005, 0.45], ticks: [1, 1e6], grid: false, size: [480, 230], tickFormat: sigmaTicks,
            layers: [{ type: 'area', f: phi, from: -2, to: 2, color: 'var(--c1)' }, { type: 'area', f: phi, from: -1, to: 1, color: 'var(--c1)' },
              { type: 'fn', f: phi, color: 'var(--c1)' }, { type: 'text', x: 0, y: 0.17, text: '68%' }, { type: 'text', x: -1.5, y: 0.03, text: '13.5%' }, { type: 'text', x: 1.5, y: 0.03, text: '13.5%' }] }),
          'Darker: within 1 SD (68%). Both shades: within 2 SDs (95%).'),
        },
        {
          kind: 'number', prob: true,
          body: 'In a made-up population, adult heights are roughly normal with mean **170 cm** and SD **7 cm**. About what share are between **163 and 177 cm**?',
          answer: 0.68, tol: 0.01,
          hint: '163 and 177 are each how many SDs from 170?',
          explain: '163 = 170 − 7 and 177 = 170 + 7: within 1 SD, so about 68%.',
        },
        {
          kind: 'estimate',
          body: 'Same heights (mean 170, SD 7). About what percentage are **taller than 184 cm**?',
          min: 0, max: 20, step: 0.5, answer: 2.5, tol: 1, format: (v) => `${v}%`,
          hint: '184 is 2 SDs above the mean. 95% are within 2 SDs; the rest is split between two tails.',
          explain: '95% are between 156 and 184, leaving 5% outside, half in each tail: about 2.5% taller than 184.',
        },
        {
          kind: 'fill',
          body: 'Complete the sentence about a normal distribution.',
          template: 'About [[0]] of values lie within 2 SDs of the mean, and a value more than 3 SDs above the mean is [[1]].',
          blanks: [
            { options: ['68%', '95%', '99.7%'], answer: 1 },
            { options: ['common (about 1 in 6)', 'impossible', 'rare (about 1 in 740)'], answer: 2 },
          ],
          explain: '99.7% within 3 SDs leaves 0.3% outside, half above: about 0.13%, or 1 in 740. Rare, not impossible; in a big data set you’ll see a few.',
        },
      ],
      practice: [genRangeIQR, genEmpirical, genSDChoice, genSDSort],
    },
    // ------------------------------------------------------------ 4
    {
      id: 'sampling',
      title: 'Sampling',
      goal: 'See how samples vary, why bigger samples vary less, and estimate a margin of error with 1/√n.',
      steps: [
        {
          kind: 'read',
          title: 'A town of opinions',
          body: 'In a town, exactly **40%** of people support a new park (the dark dots). You can’t ask everyone, so you ask a **random sample**: everyone has the same chance of being picked.',
          widget: figure(() => iconArray(100, (i) => ((i * 37) % 100 < 40 ? 0 : 1), { cols: 20 }), 'Each dot is 1% of the town'),
        },
        {
          kind: 'choice',
          body: 'You pick **10** people at random. Will exactly 4 of them support the park?',
          options: [
            { text: 'Not necessarily: 2, 3, 5 or 6 are quite likely too', correct: true },
            { text: 'Yes, because 40% of 10 is 4', why: 'That’s the average over many samples. Any single sample of 10 can easily land on 2 or 6 by luck.' },
            { text: 'No, it will be exactly 4 only if the sample is biased', why: 'Even a perfectly random sample varies from the population; that variation is just chance.' },
          ],
          explain: 'Exactly 4 happens only about a quarter of the time (25%). Samples vary by chance: **sampling variation**.',
        },
        {
          kind: 'read',
          title: 'Run some polls',
          body: 'Each dot is one poll’s result. Start with polls of 10 people, then switch to 100 and 1,000. Watch how far results land from the truth (40%).',
          widget: sampler({ p: 0.4, sizes: [10, 100, 1000], seed: 404 }),
        },
        {
          kind: 'choice',
          body: 'Polls of 1,000 people cluster much more tightly around 40% than polls of 10. Why?',
          options: [
            { text: 'In a big sample, lucky and unlucky picks tend to cancel out', correct: true },
            { text: 'Big samples include a bigger share of the town', why: 'Even 1,000 people might be a tiny share of a big city; precision comes from the sample size itself, not the share.' },
            { text: 'People answer more honestly in big polls', why: 'Nothing about honesty changed; it’s the same simulated people. The difference is pure arithmetic of chance.' },
          ],
          explain: 'Each person is a little random draw. Averaging more draws means the random ups and downs cancel more: the **law of large numbers**.',
        },
        {
          kind: 'read',
          title: 'The law of large numbers',
          body: 'Flip a fair coin and track the share of heads so far. Early on it lurches about; as flips pile up, it settles near 50%. Slide to add flips.',
          widget: plotExplorer({
            params: [{ id: 'n', label: 'flips', min: 10, max: 2000, step: 10, value: 30 }],
            spec: (v) => {
              const pts: [number, number][] = [];
              let heads = 0;
              for (let i = 0; i < v.n; i++) { heads += FLIPS[i]; if (v.n <= 400 || i % 4 === 3) pts.push([i + 1, (100 * heads) / (i + 1)]); }
              return { x: [0, v.n], y: [0, 100], ticks: [niceStep(v.n, 6), 25], xlabel: 'flips', ylabel: '% heads so far', size: [480, 260], layers: [{ type: 'hline', y: 50, color: 'var(--c2)' }, { type: 'line', pts }] };
            },
            readout: (v) => { const k = sum(FLIPS.slice(0, v.n)); return `${k} heads in ${v.n} flips = ${(100 * k / v.n).toFixed(1)}%`; },
          }),
        },
        {
          kind: 'estimate',
          body: 'Back to the town (40% support). A random poll of **100** people: within about how many percentage points of 40% will it land, 95% of the time?',
          min: 0, max: 30, step: 1, answer: 10, tol: 3, format: (v) => `±${v} points`,
          hint: 'Think about the n = 100 polls in the simulation: most landed between about 30% and 50%.',
          explain: 'About ±10 points: most polls of 100 land between 30% and 50%. (The exact 95% figure is ±9.6.)',
        },
        {
          kind: 'read',
          title: 'Margin of error ≈ 1/√n',
          body: 'For a random poll of n people on a yes/no question, the **95% margin of error** is at most about **1/√n**:\n\n- n = 100: 1/10 = ±10 points\n- n = 400: 1/20 = ±5 points\n- n = 2,500: 1/50 = ±2 points\n\nThe √ is the catch: precision grows much more slowly than sample size.',
          widget: figure(() => plotEl({ x: [0, 2500], y: [0, 16], ticks: [500, 4], xlabel: 'sample size n', ylabel: 'margin (± points)', size: [480, 240], layers: [{ type: 'fn', f: (n) => (n > 30 ? 100 / Math.sqrt(n) : NaN) }, { type: 'dots', pts: [[100, 10], [400, 5], [2500, 2]], labels: ['±10', '±5', '±2'], color: 'var(--c2)' }] })),
        },
        {
          kind: 'number', unit: 'points',
          body: 'Using margin ≈ 1/√n, what is the margin of error (in percentage points) for a random poll of **900** people?',
          answer: 100 / 30, tol: 0.06,
          hint: '√900 = 30.',
          explain: '1/√900 = 1/30 ≈ 0.033 = ±3.3 points.',
        },
        {
          kind: 'choice',
          body: 'To **halve** a poll’s margin of error, you need…',
          options: [
            { text: '4 times as many people', correct: true },
            { text: '2 times as many people', why: 'Margin goes like 1/√n. Doubling n only divides it by √2 ≈ 1.41.' },
            { text: 'Half as many people', why: 'Smaller samples have bigger margins, not smaller.' },
            { text: '8 times as many people', why: 'That would cut it by √8 ≈ 2.8, more than half.' },
          ],
          explain: 'To halve 1/√n, √n must double, so n must quadruple. This is why polls rarely go much past a few thousand people: the gains get expensive.',
        },
        {
          kind: 'task',
          body: 'Each dot is one of 30 simulated polls; the green band is 40% ± 1/√n. Choose the **smallest n** that gets the margin down to **±2.5 points**.',
          widget: plotExplorer({
            params: [{ id: 'n', label: 'sample size n', min: 100, max: 2500, step: 100, value: 100 }],
            spec: (v) => pollCloud({ n: v.n, p: 0.4, truth: 40, band: true, seed: 3 }),
            readout: (v) => `n = ${v.n} · margin ≈ ±${(100 / Math.sqrt(v.n)).toFixed(2)} points`,
            goal: (v) => v.n === 1600,
            goalText: '√1600 = 40, so the margin is 1/40 = ±2.5 points.',
          }),
          hint: '1/√n = 0.025 means √n = 40.',
          explain: 'n = 1,600: √1600 = 40 and 1/40 = 2.5%. Notice the dots squeeze in as n grows, but ever more slowly.',
        },
        {
          kind: 'multi',
          body: 'A well-run random poll of **1,000** adults in a country of 300 million. Which statements are true? Select all that apply.',
          options: [
            { text: 'Its margin of error is about ±3 points', correct: true, why: '1/√1000 ≈ 0.032.' },
            { text: 'It’s useless: it covers only 0.0003% of the population', why: 'Precision depends on the sample size, not the share of the population sampled (as long as the population is much bigger than the sample).' },
            { text: 'A random poll of 1,000 in a city of 1 million would be about as precise', correct: true, why: 'Same n, same margin: the population size barely matters.' },
            { text: 'If it weren’t random, a bigger n would fix the problem', why: 'More of a biased sample just gives a more precise wrong answer. That’s the next lesson.' },
          ],
          explain: 'A random sample of 1,000 gives about ±3 points whether the population is a city or a continent. It’s like tasting soup: one spoonful of a well-stirred pot is enough, however big the pot.',
        },
        {
          kind: 'fill',
          body: 'Complete the key idea.',
          template: 'A random sample’s precision depends mostly on the [[0]], not on the [[1]].',
          blanks: [
            { options: ['population size', 'sample size', 'margin of error'], answer: 1 },
            { options: ['population size', 'sample size', 'question wording'], answer: 0 },
          ],
          explain: 'Margin ≈ 1/√n uses only n, the sample size. Stir well (sample at random) and a spoonful tells you about the whole pot.',
        },
      ],
      practice: [genMargin, genSampleNeeded, genScaleFill],
    },
    // ------------------------------------------------------------ 5
    {
      id: 'bias',
      title: 'Bias in samples',
      goal: 'Spot selection, nonresponse and survivorship bias, and know why a bigger sample doesn’t fix them.',
      steps: [
        {
          kind: 'choice',
          body: 'A website pops up a survey: “Do you use the internet every day?” **97%** of 20,000 respondents say yes. Can you conclude that 97% of people use the internet daily?',
          options: [
            { text: 'No: only people on the website could answer', correct: true },
            { text: 'Yes: 20,000 is a huge sample', why: 'Size doesn’t help when the sample can only include internet users. Everyone not online is invisible to this survey.' },
            { text: 'Yes, give or take the margin of error (±0.7 points)', why: 'The margin of error only covers random sampling luck. It assumes a random sample, which this isn’t.' },
          ],
          explain: 'The way the sample was gathered guaranteed internet users. That’s **selection bias**: the sample systematically differs from the population you care about.',
        },
        {
          kind: 'read',
          title: 'Bias doesn’t shrink with n',
          body: 'Suppose the true support is 40%, but you poll only people outside a gym, where 60% support. Slide n up: the polls get very **precise**… around the wrong number.',
          widget: plotExplorer({
            params: [{ id: 'n', label: 'sample size n', min: 100, max: 5000, step: 100, value: 100 }],
            spec: (v) => pollCloud({ n: v.n, p: 0.6, truth: 40, seed: 8 }),
            readout: (v) => `n = ${v.n} · polls cluster near 60% (±${(100 / Math.sqrt(v.n)).toFixed(1)}) · truth 40%`,
          }),
        },
        {
          kind: 'choice',
          body: 'A famous real case: in **1936**, the *Literary Digest* magazine got about **2.4 million** replies to its US presidential poll and predicted that Landon would beat Roosevelt. Roosevelt won in a landslide. Why was such a huge poll so wrong?',
          options: [
            { text: 'Who got the poll, and who chose to reply, didn’t represent voters', correct: true },
            { text: '2.4 million is still too small a sample', why: 'A random 2.4 million would have a margin of about ±0.06 points. Size was never the problem.' },
            { text: 'Voters changed their minds at the last minute', why: 'Pollsters with far smaller random-ish samples, such as George Gallup, called the winner correctly.' },
          ],
          explain: 'The mailing lists leaned toward better-off households (magazine readers, car and phone owners), and only about a quarter of the roughly 10 million people sent ballots replied. Selection plus nonresponse: a giant, precise, wrong answer.',
        },
        {
          kind: 'read',
          title: 'Nonresponse bias',
          body: 'Even if you reach a perfect random sample, the people who **answer** may differ from those who don’t: busier, angrier, keener. When only 30% reply, the other 70% could be anything.',
          widget: figure(() => stackBar([{ label: 'Replied, satisfied', value: 240, color: 'var(--c3)' }, { label: 'Replied, not', value: 60, color: 'var(--c4)' }, { label: 'Didn’t reply', value: 700, color: 'var(--line)' }], { format: (v) => String(v) }), '1,000 employees surveyed (made-up numbers)'),
        },
        {
          kind: 'number', prob: true,
          body: 'In that survey, 240 of the 300 repliers (80%) are satisfied. If **none** of the 700 non-repliers is satisfied, what share of all 1,000 employees is satisfied?',
          answer: 0.24, tol: 0.003,
          hint: 'Satisfied people ÷ everyone.',
          explain: '240 ÷ 1,000 = 24%. And if every non-replier were satisfied it would be 940 ÷ 1,000 = 94%. The honest summary of “80% of repliers” is “somewhere between 24% and 94%”, unless you know why people didn’t reply.',
        },
        {
          kind: 'read',
          title: 'Survivorship bias',
          body: 'Some data has already been filtered by success. Investment funds that do badly often close, and databases may drop them, so the funds still listed look better than the funds that were launched.',
          widget: figure(() => barChart([{ label: 'All funds launched', value: 3, color: 'var(--c1)' }, { label: 'Funds still open', value: 6, color: 'var(--c2)' }], { format: (v) => `${v}% a year` }), 'Average yearly return (made-up numbers)'),
        },
        {
          kind: 'sort',
          body: 'Sort each study into the bias that most threatens it.',
          bins: ['Selection', 'Nonresponse', 'Survivorship'],
          items: [
            { text: 'Phoning only landlines to poll young adults', bin: 0 },
            { text: 'Polling shoppers at a luxury mall about the economy', bin: 0 },
            { text: 'Every customer is emailed a survey; mostly angry ones fill it in', bin: 1 },
            { text: 'A long survey sent to busy doctors; only those with free time reply', bin: 1 },
            { text: 'Judging a gym programme by surveying people still enrolled after a year', bin: 2 },
            { text: '“Old buildings were built to last”, judged from the ones still standing', bin: 2 },
          ],
          explain: 'Selection: who you **could** reach was skewed. Nonresponse: you reached everyone, but who **answered** was skewed. Survivorship: the failures dropped out **before** you looked.',
        },
        {
          kind: 'multi',
          body: 'Which of these help reduce bias in a survey? Select all that apply.',
          options: [
            { text: 'Choose people at random from a complete list of the population', correct: true, why: 'Random selection from the whole population tackles selection bias.' },
            { text: 'Follow up with people who didn’t reply', correct: true, why: 'Chasing non-repliers tackles nonresponse bias.' },
            { text: 'Weight answers so age, region etc. match the population', correct: true, why: 'Weighting corrects for groups that are known to be under-represented (though only on the traits you weight by).' },
            { text: 'Collect many more responses the same way', why: 'More of the same biased sample gives a more precise wrong answer.' },
            { text: 'Let anyone who wants to answer vote online', why: 'Self-selected samples over-represent people with strong views and free time.' },
          ],
          explain: 'Bias is about **who** is in the data. Fix it by how you choose people and chase them, not by how many you get.',
        },
        {
          kind: 'choice',
          body: 'Poll X: **500** people chosen at random. Poll Y: **50,000** self-selected online votes. They disagree. Which is more trustworthy?',
          options: [
            { text: 'Poll X', correct: true },
            { text: 'Poll Y: 100 times bigger', why: 'Bigger shrinks random error only. Self-selection bias can be any size, and 50,000 votes won’t reduce it.' },
            { text: 'Neither can be trusted at all', why: 'A random sample of 500 is quite useful: about ±4.5 points.' },
          ],
          explain: 'A random 500 has a known margin of about ±4.5 points (1/√500). Poll Y’s error is unknown and doesn’t shrink with size.',
        },
        {
          kind: 'fill',
          body: 'Complete the summary.',
          template: 'A bigger sample shrinks [[0]], but does nothing about [[1]].',
          blanks: [
            { options: ['bias', 'random sampling error'], answer: 1 },
            { options: ['random sampling error', 'bias'], answer: 1 },
          ],
          explain: 'Random error averages away as n grows (1/√n). Bias is the same in every sample drawn the same way, so it never averages away.',
        },
      ],
      practice: [genNonresponse, genBiasKind, genBigVsRandom],
    },
    // ------------------------------------------------------------ 6
    {
      id: 'correlation',
      title: 'Correlation',
      goal: 'Read direction and strength in scatter plots, interpret r, and keep correlation apart from causation.',
      steps: [
        {
          kind: 'choice',
          body: 'Each dot is one adult (made-up data): height across, arm span up. What happens to arm span as height goes up?',
          widget: () => plotEl({ x: [145, 195], y: [145, 195], xlabel: 'height (cm)', ylabel: 'arm span (cm)', size: [460, 320], layers: [{ type: 'dots', pts: HEIGHTS }] }),
          options: [
            { text: 'It tends to go up too', correct: true },
            { text: 'It tends to go down', why: 'The cloud slopes up from bottom-left to top-right: taller people tend to have longer arm spans.' },
            { text: 'No pattern', why: 'Look at the overall shape: the dots form a clear upward band.' },
          ],
          explain: 'An upward-sloping cloud is a **positive** relationship: when one is above average, the other tends to be too. Not always: some tall people have shorter spans than some shorter people.',
        },
        {
          kind: 'read',
          title: 'Direction and strength',
          body: '**Direction**: positive (up to the right), negative (down to the right), or none.\n\n**Strength**: how tightly the dots hug a straight line. The **correlation coefficient r** puts both in one number from −1 to +1: the sign is the direction, the size is the strength. r = ±1 is a perfect line; r = 0 means no straight-line trend.',
        },
        {
          kind: 'task',
          body: 'Explore r. Then set it so the dots show a **strong negative** relationship (r of −0.9 or below).',
          widget: corrSlider,
          hint: 'Slide all the way left.',
          explain: 'At r = −0.9 the dots fall tightly along a downward line. At r = 0 they’re a shapeless blob; around ±0.5 you can see a trend, but loosely.',
        },
        {
          kind: 'match',
          body: 'Match each scatter plot to its correlation.',
          widget: () => thumbs([
            { label: 'Plot P', spec: thumbScatter(corrPairs(81, 60, 0.5), 'var(--c1)') },
            { label: 'Plot Q', spec: thumbScatter(corrPairs(82, 60, -0.8), 'var(--c2)') },
            { label: 'Plot R', spec: thumbScatter(corrPairs(83, 60, 0.95), 'var(--c3)') },
            { label: 'Plot S', spec: thumbScatter(corrPairs(84, 60, 0), 'var(--c6)') },
          ]),
          heads: ['Plot', 'r'],
          pairs: [['Plot P', 'r = 0.5'], ['Plot Q', 'r = −0.8'], ['Plot R', 'r = 0.95'], ['Plot S', 'r = 0']],
          hint: 'Find the only downward one first, then the tightest upward one.',
          explain: 'R is a tight upward line (0.95), P a loose upward cloud (0.5), Q clearly downward (−0.8), and S has no tilt at all (0).',
        },
        {
          kind: 'choice',
          body: `For these points, r = ${num(R_USHAPE, 2)}, about zero. Does that mean x and y are unrelated?`,
          widget: () => plotEl({ x: [-3.2, 3.2], y: [-1.5, 10.5], size: [460, 300], layers: [{ type: 'dots', pts: USHAPE }] }),
          options: [
            { text: 'No: there’s a strong relationship, it just isn’t a straight line', correct: true },
            { text: 'Yes: r ≈ 0 means no relationship', why: 'r only measures **straight-line** relationships. This U-shape is very predictable: knowing x tells you y quite well.' },
            { text: 'Yes, the U-shape is just noise', why: 'The points follow a clear curve; random noise wouldn’t form a U.' },
          ],
          explain: 'The left half slopes down and the right half up, so in a straight-line sense they cancel. **Always look at the plot**, not just r.',
        },
        {
          kind: 'point',
          body: 'One of these measurements was mistyped. Tap the **outlier**.',
          plot: { x: [0, 11], y: [0, 24], size: [460, 300], layers: [{ type: 'dots', pts: [...LINE_PTS, OUTLIER] }] },
          answer: { x: OUTLIER[0], y: OUTLIER[1] }, tol: 1, snap: 1,
          hint: 'Follow the upward trend; one dot is far below it.',
          explain: `The point (8, 3) is far below the trend. With it, r = ${num(R_WITH, 2)}; without it, r = ${num(R_WITHOUT, 2)}. One stray point can change r a lot, another reason to look at the picture.`,
        },
        {
          kind: 'read',
          title: 'Correlation is not causation',
          body: 'Made-up monthly data for a seaside town: months with more ice cream sold also have more drownings. Ice cream doesn’t cause drowning. **Hot weather** drives both: more ice cream and more swimming.\n\nA hidden third variable like this is a **confounder**. Other ways to get correlation without causation: **reverse causation** (B causes A) and **chance** (in small or heavily searched data).',
          widget: figure(() => plotEl({ x: [0, 1000], y: [0, 12], xlabel: 'ice creams sold', ylabel: 'drownings', size: [460, 280], layers: [{ type: 'dots', pts: WEATHER, color: 'var(--c2)' }] }), `r = ${num(corr(WEATHER), 2)}, yet neither causes the other`),
        },
        {
          kind: 'sort',
          body: 'A (made-up) study of 2,000 adults finds r = 0.3 between cups of coffee per day and hours worked per week. Which claims does that support?',
          bins: ['Supported', 'Not supported'],
          items: [
            { text: 'People who drink more coffee tend to work longer hours', bin: 0 },
            { text: 'Knowing someone’s coffee intake helps a little to guess their hours', bin: 0 },
            { text: 'Coffee makes people work longer', bin: 1 },
            { text: 'Long hours make people drink coffee', bin: 1 },
            { text: 'Every heavy coffee drinker works long hours', bin: 1 },
          ],
          explain: 'r = 0.3 supports a weak positive **association**, and only that. It can’t say which way any causation runs (or whether job type drives both), and it’s far too weak to say “every”.',
        },
        {
          kind: 'multi',
          body: 'Cities with more firefighters have more fire damage. Which could explain this **without** firefighters causing damage? Select all that apply.',
          options: [
            { text: 'Bigger cities have both more fires and more firefighters', correct: true, why: 'City size is a confounder that drives both.' },
            { text: 'Cities with lots of fires hire more firefighters', correct: true, why: 'Reverse causation: the damage drives the hiring.' },
            { text: 'Firefighters damage property while fighting fires', why: 'That’s a story where firefighters do cause damage, which is what we were asked to avoid.' },
            { text: 'Nothing else: a correlation this strong must be causal', why: 'Strength doesn’t prove causation; confounders can produce very strong correlations.' },
          ],
          explain: 'Two classic non-causal explanations: a confounder (city size) and reverse causation (fires → hiring).',
        },
        {
          kind: 'choice',
          body: 'People who take a vitamin are healthier than people who don’t. What’s the best way to find out whether the vitamin **causes** better health?',
          options: [
            { text: 'Randomly assign people to take the vitamin or a dummy pill, then compare', correct: true },
            { text: 'Survey more vitamin takers to get a bigger correlation', why: 'A bigger sample makes the correlation more precise, but vitamin takers may still differ in diet, exercise and income.' },
            { text: 'Ask vitamin takers whether they feel healthier', why: 'That’s self-report from a self-selected group: confounders and wishful thinking.' },
          ],
          explain: 'Random assignment makes the two groups alike **on average in everything**, including confounders nobody thought of. Then a difference in outcomes can be put down to the vitamin: that’s a randomized controlled trial.',
        },
      ],
      practice: [genRPick, genConfounder, genOutlierPoint],
    },
    // ------------------------------------------------------------ 7
    {
      id: 'simpson',
      title: 'Simpson’s paradox',
      goal: 'See how combining groups can reverse a comparison, and compare like with like.',
      steps: [
        {
          kind: 'choice',
          body: 'Two hospitals each treated 500 patients for the same illness (made-up data). Which had the better survival rate?',
          widget: () => dataTable(['', 'Survived', 'Rate'], [['Hospital A', '330 / 500', '66%'], ['Hospital B', '390 / 500', '78%']]),
          options: [
            { text: 'Hospital B', correct: true },
            { text: 'Hospital A', why: 'A saved 330 of 500 (66%), B saved 390 of 500 (78%).' },
            { text: 'They’re the same', why: 'Same number of patients, but B saved 60 more.' },
          ],
          explain: 'On these totals, B looks clearly better: 78% vs 66%. But hold that thought.',
        },
        {
          kind: 'read',
          title: 'Now split by severity',
          body: 'The same 1,000 patients, split into **mild** and **severe** cases:',
          widget: () => dataTable(['', 'Mild', 'Severe', 'Overall'], [
            ['Hospital A', '90/100 (90%)', '240/400 (60%)', '330/500 (66%)'],
            ['Hospital B', '340/400 (85%)', '50/100 (50%)', '390/500 (78%)']], { caption: 'Survived / treated' }),
        },
        {
          kind: 'multi',
          body: 'Using that table, which are true? Select all that apply.',
          widget: () => dataTable(['', 'Mild', 'Severe', 'Overall'], [
            ['A', '90/100 (90%)', '240/400 (60%)', '66%'],
            ['B', '340/400 (85%)', '50/100 (50%)', '78%']]),
          options: [
            { text: 'A has the better rate for mild cases', correct: true, why: '90% vs 85%.' },
            { text: 'A has the better rate for severe cases', correct: true, why: '60% vs 50%.' },
            { text: 'B has the better rate overall', correct: true, why: '78% vs 66%.' },
            { text: 'B is better in at least one group', why: 'A wins in both groups. That’s exactly what makes this strange.' },
          ],
          explain: 'A is better for mild patients **and** for severe patients, yet worse overall. This reversal is **Simpson’s paradox**.',
        },
        {
          kind: 'read',
          title: 'Why it happens',
          body: 'A treats mostly **severe** cases (400 of 500); B treats mostly **mild** ones (400 of 500). Severe cases die more often wherever they’re treated, so A’s overall rate is dragged down by its case mix, not its care.',
          widget: () => h('div', null,
            h('div', { class: 'muted small' }, 'Hospital A’s patients'), stackBar([{ label: 'Mild', value: 100, color: 'var(--c3)' }, { label: 'Severe', value: 400, color: 'var(--c4)' }]),
            h('div', { class: 'muted small' }, 'Hospital B’s patients'), stackBar([{ label: 'Mild', value: 400, color: 'var(--c3)' }, { label: 'Severe', value: 100, color: 'var(--c4)' }])),
        },
        {
          kind: 'fill',
          body: 'An overall rate is a **weighted average** of the group rates. Fill in Hospital A’s weights (its share of mild and severe patients).',
          template: '66% = [[0]] × 90% + [[1]] × 60%',
          blanks: [
            { options: ['0.8', '0.5', '0.2'], answer: 2 },
            { options: ['0.2', '0.8', '0.5'], answer: 1 },
          ],
          hint: 'A had 100 mild and 400 severe patients out of 500.',
          explain: '100/500 = 0.2 and 400/500 = 0.8: 0.2 × 90% + 0.8 × 60% = 18% + 48% = 66%. B’s weights are flipped: 0.8 × 85% + 0.2 × 50% = 78%. The weights, not the care, decide the overall winner.',
        },
        {
          kind: 'task',
          body: 'Keep Hospital A’s care the same (90% mild, 60% severe) but change its **case mix**. Make A’s overall rate **beat** B’s 78%.',
          widget: plotExplorer({
            params: [{ id: 's', label: 'A’s severe share', min: 0, max: 100, step: 10, value: 80, format: (v) => `${v}%` }],
            spec: (v) => {
              const a = (900 - 3 * v.s) / 10;
              return { x: [0.4, 2.6], y: [0, 100], ticks: [1, 20], size: [420, 240], ylabel: 'overall survival %', tickFormat: (t) => (t === 1 ? 'Hospital A' : t === 2 ? 'Hospital B' : String(t)),
                layers: [{ type: 'bars', pts: [[1, a]], width: 0.6, color: 'var(--c1)' }, { type: 'bars', pts: [[2, 78]], width: 0.6, color: 'var(--c2)' },
                  { type: 'text', x: 1, y: a + 4, text: `${a}%` }, { type: 'text', x: 2, y: 82, text: '78%' }] };
            },
            readout: (v) => `A: ${100 - v.s}% mild, ${v.s}% severe → overall ${(900 - 3 * v.s) / 10}% vs B 78%`,
            goal: (v) => 900 - 3 * v.s > 780,
            goalText: 'Same care, different patients, and now A “wins”.',
          }),
          hint: 'Fewer severe cases means a higher overall rate.',
          explain: 'A’s overall rate is 90% − 0.3 × (severe share). It beats 78% once the severe share drops below 40%. The quality of care never changed: only who walked in.',
        },
        {
          kind: 'choice',
          body: 'You have a **severe** case. Using the split table, which hospital should you choose?',
          options: [
            { text: 'Hospital A (60% vs 50% for severe cases)', correct: true },
            { text: 'Hospital B, because it has the better overall rate', why: 'B’s overall rate is high because most of its patients are mild. For a severe case, compare severe with severe: A 60%, B 50%.' },
            { text: 'It makes no difference', why: 'Among severe cases there’s a 10-point gap.' },
          ],
          explain: 'Compare **like with like**: severe patients with severe patients. A is better for both kinds of patient.',
        },
        {
          kind: 'read',
          title: 'Same trap, different place',
          body: 'A made-up university with two departments. Women have a **higher** admission rate in **each** department.',
          widget: () => dataTable(['', 'Dept X (easy)', 'Dept Y (hard)', 'Overall'], [
            ['Men', '300/400 (75%)', '10/100 (10%)', '310/500 (62%)'],
            ['Women', '80/100 (80%)', '60/400 (15%)', '?']], { caption: 'Admitted / applied' }),
        },
        {
          kind: 'number', prob: true,
          body: 'What is the women’s **overall** admission rate?',
          widget: () => dataTable(['', 'Dept X', 'Dept Y'], [['Women', '80/100', '60/400']]),
          answer: 0.28, tol: 0.003,
          hint: 'Total admitted ÷ total applied.',
          explain: '(80 + 60) ÷ (100 + 400) = 140 ÷ 500 = 28%, against 62% for men, even though women do better in both departments. Most women applied to the hard department.',
        },
        {
          kind: 'sort',
          body: 'Which conclusions do the admissions numbers support?',
          bins: ['Supported', 'Not supported'],
          items: [
            { text: 'Within each department, women were admitted at a higher rate', bin: 0 },
            { text: 'Women applied mostly to the department that rejects most applicants', bin: 0 },
            { text: 'Comparing overall rates alone would mislead here', bin: 0 },
            { text: 'The departments favoured men', bin: 1 },
            { text: 'Men are stronger applicants', bin: 1 },
          ],
          explain: 'Department by department, women do better. The overall gap comes from **where** people applied. (A real 1973 study of graduate admissions at UC Berkeley found this kind of pattern.)',
        },
        {
          kind: 'read',
          title: 'The lesson',
          body: 'When a third variable (severity, department) is **unevenly split** between the groups and also **affects the outcome**, overall numbers can point the opposite way from every subgroup.\n\nSo ask: are these groups comparable? What else differs between them? Usually the fair comparison is within subgroups. But not always: which table answers your question depends on how the variables cause each other, which data alone can’t tell you.',
        },
      ],
      practice: [genSimpsonOverall, genSimpsonWhich, genWeightFill],
    },
    // ------------------------------------------------------------ 8
    {
      id: 'graphs',
      title: 'Misleading graphs',
      goal: 'Catch truncated axes, cherry-picked windows, dual axes, area tricks and totals that should be rates.',
      steps: [
        {
          kind: 'choice',
          body: 'An advert shows this chart of customer ratings. How much higher is Brand B’s rating than Brand A’s?',
          widget: () => plotEl({ x: [0.4, 2.6], y: [48, 55], ticks: [1, 1], size: [420, 260], ylabel: 'rating', tickFormat: (t) => (t === 1 ? 'Brand A' : t === 2 ? 'Brand B' : String(t)),
            layers: [{ type: 'bars', pts: [[1, 50]], width: 0.6, color: 'var(--c1)' }, { type: 'bars', pts: [[2, 54]], width: 0.6, color: 'var(--c2)' }] }),
          options: [
            { text: 'About 8% higher (54 vs 50)', correct: true },
            { text: 'About 3 times higher', why: 'B’s bar looks 3× as tall because the axis starts at 48: you see 6 units vs 2. The values are 54 and 50.' },
            { text: 'About 50% higher', why: 'Read the numbers on the axis, not the bar lengths: 54 ÷ 50 = 1.08.' },
          ],
          hint: 'Read the actual values off the axis. Where does it start?',
          explain: '54 ÷ 50 = 1.08: 8% higher. The y-axis starts at 48, so only the tops of the bars show and a small gap looks huge.',
        },
        {
          kind: 'read',
          title: 'Truncated axes',
          body: 'We read bars by their **length**, so a bar chart’s axis should start at **zero**. Cut the bottom off and small differences look enormous.\n\nLine charts are different: we read their **position and slope**, so zooming in can be fine, as long as the axis is clearly labelled.',
        },
        {
          kind: 'task',
          body: 'Brand A scores 48 and Brand B 54. Raise the axis start until B’s bar **looks at least 3 times** as tall as A’s.',
          widget: plotExplorer({
            params: [{ id: 's', label: 'axis starts at', min: 0, max: 47, step: 1, value: 0 }],
            spec: (v) => ({ x: [0.4, 2.6], y: [v.s, 57], ticks: [1], size: [420, 260], tickFormat: (t) => (t === 1 ? 'A: 48' : t === 2 ? 'B: 54' : String(t)),
              layers: [{ type: 'bars', pts: [[1, 48]], width: 0.6, color: 'var(--c1)' }, { type: 'bars', pts: [[2, 54]], width: 0.6, color: 'var(--c2)' }] }),
            readout: (v) => `B looks ${((54 - v.s) / (48 - v.s)).toFixed(2)}× as tall as A (really ${(54 / 48).toFixed(3)}×)`,
            goal: (v) => 54 - v.s >= 3 * (48 - v.s),
            goalText: 'Same data, now it shouts “3× better”.',
          }),
          hint: 'Visible heights are 54 − start and 48 − start.',
          explain: 'At a start of 45, the visible bars are 9 and 3 units: 3×. The real ratio is still 54/48 = 1.125.',
        },
        {
          kind: 'number', unit: '×',
          body: 'In the chart with the axis starting at 45, B’s bar looks 3× as tall. What is the **actual** ratio of B’s score to A’s (54 to 48)?',
          answer: 1.125, tol: 0.006,
          explain: '54 ÷ 48 = 1.125: B is 12.5% higher, not 200% higher.',
        },
        {
          kind: 'read',
          title: 'Cherry-picked windows',
          body: 'Choosing **which stretch of time** to show can flip the story. Step through: first the window a report showed, then the full record (made-up index).',
          widget: () => stepper(2, (i) => plotEl(i === 0
            ? { x: [2015, 2018], y: [60, 68], ticks: [1, 2], size: [480, 250], ylabel: 'index', layers: [{ type: 'line', pts: CHERRY.slice(15, 19).map((y, k) => [2015 + k, y] as [number, number]), color: 'var(--c4)' }] }
            : { x: [2000, 2024], y: [45, 75], ticks: [4, 5], size: [480, 250], ylabel: 'index', layers: [{ type: 'area', f: () => 75, from: 2015, to: 2018, color: 'var(--c4)' }, { type: 'line', pts: CHERRY.map((y, k) => [2000 + k, y] as [number, number]) }] }),
          { caption: (i) => (i === 0 ? '2015–2018: “a steady decline!”' : '2000–2024: a dip inside a long rise') }),
        },
        {
          kind: 'choice',
          body: 'A report shows only 2015–2018 and says “the index is in decline”. Is that a fair summary of the data?',
          options: [
            { text: 'No: it picked the one window that falls inside a long rise', correct: true },
            { text: 'Yes: the index really did fall from 2015 to 2018', why: 'True for those years, but presented as “the trend” it misleads: over 24 years the index rose from 50 to 72.' },
            { text: 'Yes: recent data matters most', why: 'The window ends in 2018; the series continues upward to 2024. It isn’t even the most recent data.' },
          ],
          explain: 'Each number in the window is real; the misleading part is the choice of window. Ask: what happens just outside it?',
        },
        {
          kind: 'read',
          title: 'Area and 3D tricks',
          body: 'To show a value doubling, some graphics double an icon’s **width and height**. The eye reads area, which has gone up **4×**. 3D effects are worse: tilted pies and boxes make nearer slices look bigger.',
          widget: () => areaTrick(),
        },
        {
          kind: 'number', unit: '×',
          body: 'An infographic shows sales tripling by making a coin icon **3× as wide and 3× as tall**. How many times bigger is the new coin’s area?',
          answer: 9, tol: 0.01,
          explain: '3 × 3 = 9: the picture says 9× for a real change of 3×.',
        },
        {
          kind: 'read',
          title: 'Two axes, any story',
          body: 'A chart with two y-axes lets the designer stretch either line however they like. Made-up data: a shop’s revenue (left axis) and cat videos uploaded (right axis). Slide the right axis and watch the “relationship” change.',
          widget: plotExplorer({
            params: [{ id: 'm', label: 'right axis top', min: 12, max: 40, step: 1, value: 14 }],
            spec: (v) => {
              const map = (b: number) => 95 + (b / v.m) * 35;
              return { x: [2009.6, 2021.3], y: [95, 130], ticks: [2, 5], size: [480, 260], ylabel: 'revenue ($k)', layers: [
                { type: 'line', pts: REVENUE.map((y, k) => [2010 + k, y] as [number, number]), color: 'var(--c1)', label: 'revenue' },
                { type: 'line', pts: VIDEOS.map((b, k) => [2010 + k, map(b)] as [number, number]), color: 'var(--c2)', dash: true },
                ...[0, 0.5, 1].map((f): Layer => ({ type: 'text', x: 2021.25, y: 95 + f * 35 - (f === 1 ? 2 : 0), text: `${num(f * v.m)}m`, color: 'var(--c2)', anchor: 'end' }))] };
            },
            readout: (v) => `Right axis (videos, dashed): 0 to ${v.m} million`,
          }),
        },
        {
          kind: 'number', unit: 'per 100,000',
          body: 'Region A had **600** cases of an illness among 2,000,000 people. Region B had **90** cases among 150,000 people. How many cases per 100,000 people in **Region B**?',
          widget: () => dataTable(['', 'Cases', 'Population'], [['Region A', '600', '2,000,000'], ['Region B', '90', '150,000']], { caption: 'Made-up numbers' }),
          answer: 60, tol: 0.1,
          hint: 'Cases ÷ population × 100,000.',
          explain: '90 ÷ 150,000 × 100,000 = 60 per 100,000. Region A: 600 ÷ 2,000,000 × 100,000 = 30. B has fewer cases but **twice the rate**. A map of totals would mostly show where people live.',
        },
        {
          kind: 'sort',
          body: 'Fair or misleading?',
          bins: ['Fair', 'Misleading'],
          items: [
            { text: 'A bar chart whose axis starts at zero', bin: 0 },
            { text: 'A line chart of body temperature zoomed to 36–39 °C, clearly labelled', bin: 0 },
            { text: 'Comparing towns by crimes per 1,000 residents', bin: 0 },
            { text: 'Bars of 50 vs 54 with the axis starting at 48', bin: 1 },
            { text: 'Showing the only 3 bad years out of 20 as “the trend”', bin: 1 },
            { text: 'Comparing total crimes in a big city and a small village', bin: 1 },
            { text: 'Doubling an icon’s width and height to show 2×', bin: 1 },
          ],
          explain: 'Fair charts match what the eye reads (length, position, rate) to what the data says. Misleading ones exploit the gap: cut axes, chosen windows, totals for unequal groups, area for length.',
        },
        {
          kind: 'match',
          body: 'Match each trick to its fix.',
          heads: ['Trick', 'Fix'],
          pairs: [
            ['Truncated bar axis', 'Start bars at zero'],
            ['Cherry-picked window', 'Show the full time range'],
            ['Totals for unequal populations', 'Use rates per person'],
            ['Icons scaled in two dimensions', 'Scale one length, or use plain bars'],
            ['Two y-axes stretched at will', 'Use two panels, or index both to 100'],
          ],
          explain: 'Each fix puts the honest quantity back where the eye looks.',
        },
      ],
      practice: [genTruncRatio, genAreaScale, genPerCapita],
    },
  ],
};
