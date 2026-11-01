// Geometry & Measurement: angles, area by rearranging, Pythagoras, circles, similarity, the
// square-cube law, transformations on a grid, and estimating space.
import type { Choice, Course, Generator, Layer, PlotSpec } from '../types';
import { num, pick, randInt, shuffle } from '../ui';
import { barChart, dataTable } from '../viz/charts';
import { plotExplorer, stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  aroundPoint, boxFig, circleFig, circlesRow, cubeExplorer, cubeW, fieldFig, iceFig, lineAngles, lineExplorer,
  paraFig, paraToRect, polygonExplorer, polygonW, pythExplorer, pythGrid, pythProof, rectVsPara, rightTri,
  rollCircle, scaleExplorer, shadowFig, shearExplorer, slicesExplorer, squareMetre, tearCorners, thumbFig,
  trapFig, trapToPara, triangleExplorer, triangleFig, triFromAngles, triToPara, cardStacks, tint,
} from '../widgets/geometry';

const W = (el: () => HTMLElement) => () => el();

/** Drop distractors whose text repeats the answer or each other (generated numbers can collide). */
function opts(right: Choice, wrong: Choice[]): Choice[] {
  const seen = new Set([right.text]);
  const out: Choice[] = [{ ...right, correct: true }];
  for (const w of wrong) if (!seen.has(w.text)) { seen.add(w.text); out.push(w); }
  return out;
}

/** An equal-scale coordinate grid for the transformation steps. */
function grid(layers: Layer[], r = 6): PlotSpec {
  return { x: [-r, r], y: [-r, r], equal: true, grid: true, ticks: [1, 1], size: [420, 440], layers };
}
const fillC = (c: string) => tint(c, 28);
const poly = (pts: [number, number][], color: string, dash = false): Layer => ({ type: 'line', pts, closed: true, color, fill: dash ? undefined : fillC(color), dash });

// ---------------------------------------------------------------- practice: angles

const genThirdAngle: Generator = (rng) => {
  const A = randInt(rng, 4, 20) * 5, B = randInt(rng, 4, Math.floor((150 - A) / 5)) * 5;
  const C = 180 - A - B;
  return {
    kind: 'number', unit: '°',
    body: `Two angles of a triangle are ${A}° and ${B}°. What is the third angle?`,
    widget: triangleFig(triFromAngles(A, B, 6), [`${A}°`, `${B}°`, '?']),
    answer: C, tol: 0.01,
    hint: 'The three angles of any triangle add up to 180°.',
    explain: `180° − ${A}° − ${B}° = ${C}°.`,
  };
};

const NGON: Record<number, string> = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' };
const genPolygonSum: Generator = (rng) => {
  const n = pick(rng, [5, 6, 7, 8, 9, 10, 12]);
  const right = (n - 2) * 180;
  return {
    kind: 'choice',
    body: `What do the interior angles of a ${NGON[n]} (${n} sides) add up to?`,
    widget: polygonW(n),
    options: opts({ text: `${right}°` }, [
      { text: `${n * 180}°`, why: `That counts ${n} triangles. Fanning out from one corner makes only ${n} − 2 = ${n - 2}.` },
      { text: `${(n - 1) * 180}°`, why: `One triangle too many: from one corner you can't draw diagonals to itself or its two neighbours, giving ${n - 2} triangles.` },
      { text: '360°', why: '360° is the sum for a quadrilateral (and the sum of exterior angles of any polygon), not this one.' },
    ]),
    hint: 'Cut it into triangles from one corner. How many triangles?',
    explain: `From one corner, diagonals cut a ${n}-sided polygon into ${n - 2} triangles: ${n - 2} × 180° = ${right}°.`,
  };
};

const genRegularAngle: Generator = (rng) => {
  const n = pick(rng, [5, 6, 8, 9, 10, 12, 15, 18, 20]);
  const sum = (n - 2) * 180;
  return {
    kind: 'number', unit: '°',
    body: `A regular polygon has ${n} equal sides and ${n} equal angles. How big is each interior angle?`,
    answer: sum / n, tol: 0.01,
    hint: 'Find the total first, then share it equally.',
    explain: `Total: (${n} − 2) × 180° = ${sum}°. Each of the ${n} equal angles: ${sum}° ÷ ${n} = ${sum / n}°.`,
  };
};

const genAroundPoint: Generator = (rng) => {
  const a = randInt(rng, 8, 24) * 5, b = randInt(rng, 8, 24) * 5;
  const c = randInt(rng, 6, Math.floor((330 - a - b) / 5)) * 5;
  const d = 360 - a - b - c;
  return {
    kind: 'number', unit: '°',
    body: `Four angles meet at a point. Three of them are ${a}°, ${b}° and ${c}°. What is the fourth?`,
    widget: aroundPoint([0, a, a + b, a + b + c], [`${a}°`, `${b}°`, `${c}°`, '?']),
    answer: d, tol: 0.01,
    hint: 'A full turn around a point is 360°.',
    explain: `360° − ${a}° − ${b}° − ${c}° = ${d}°.`,
  };
};

// ---------------------------------------------------------------- practice: area

const genArea: Generator = (rng) => {
  if (rng() < 0.5) {
    const b = randInt(rng, 4, 12), hh = randInt(rng, 3, 8), side = hh + randInt(rng, 1, 4);
    return {
      kind: 'number', unit: 'square units',
      body: `A parallelogram has base ${b}, height ${hh} and slanted sides ${side}. What is its area?`,
      widget: paraFig(b, hh, Math.sqrt(side * side - hh * hh), { base: String(b), height: String(hh), side: String(side) }),
      answer: b * hh,
      hint: 'Cut a triangle off one end and slide it to the other. Which lengths make the rectangle?',
      explain: `Base × perpendicular height = ${b} × ${hh} = ${b * hh}. The slanted side (${side}) doesn't enter into it.`,
    };
  }
  const b = randInt(rng, 3, 12), hh = randInt(rng, 2, 9), x = randInt(rng, 0, b);
  return {
    kind: 'number', unit: 'square units',
    body: `A triangle has base ${b} and height ${hh}. What is its area?`,
    widget: triangleFig([[0, 0], [b, 0], [x, hh]], ['', '', ''], [String(b)],
      [{ t: 'poly', pts: [[x, hh], [x, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 }, { t: 'text', at: [x + 0.4, hh / 2], s: String(hh), anchor: 'start' }], false),
    answer: (b * hh) / 2,
    hint: 'Two copies of the triangle make a parallelogram.',
    explain: `Half of base × height: ½ × ${b} × ${hh} = ${num((b * hh) / 2)}.`,
  };
};

const genTrapezoid: Generator = (rng) => {
  const a = randInt(rng, 6, 14), b = randInt(rng, 2, a - 2), hh = randInt(rng, 2, 8);
  return {
    kind: 'number', unit: 'square units',
    body: `A trapezoid has parallel sides ${a} and ${b}, ${hh} apart. What is its area?`,
    widget: trapFig(a, b, hh),
    answer: ((a + b) * hh) / 2,
    hint: 'Two copies make a parallelogram with base a + b.',
    explain: `Average of the parallel sides times the height: (${a} + ${b}) ÷ 2 × ${hh} = ${num(((a + b) * hh) / 2)}.`,
  };
};

const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0 && d > 1 && d < n);
const genSameArea: Generator = (rng) => {
  const T = pick(rng, [12, 18, 24, 30, 36]);
  const a = pick(rng, divisors(T)), b = pick(rng, divisors(2 * T)), c = pick(rng, divisors(T)), d = pick(rng, divisors(T)), e = pick(rng, divisors(T));
  return {
    kind: 'multi',
    body: `Which of these have an area of exactly ${T}?`,
    options: [
      { text: `A rectangle ${a} by ${T / a}`, correct: true },
      { text: `A triangle with base ${b} and height ${(2 * T) / b}`, correct: true },
      { text: `A parallelogram with base ${d} and height ${T / d}`, correct: true },
      { text: `A triangle with base ${c} and height ${T / c}`, why: `A triangle is half of base × height: ½ × ${c} × ${T / c} = ${T / 2}.` },
      { text: `A parallelogram with sides ${e} and ${T / e}, not a rectangle`, why: `Its height is less than its slanted side, so its area is less than ${e} × ${T / e}: tilting a frame squashes it.` },
    ],
    explain: `Rectangle and parallelogram: base × height. Triangle: half of that. A parallelogram's area needs its perpendicular height, not its side.`,
  };
};

// ---------------------------------------------------------------- practice: Pythagoras

const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];
const genHyp: Generator = (rng) => {
  const [p, q, r] = pick(rng, TRIPLES), m = r < 20 ? randInt(rng, 1, 3) : 1;
  const [a, b, c] = [p * m, q * m, r * m];
  return {
    kind: 'number',
    body: `A right triangle has shorter sides ${a} and ${b}. How long is the longest side?`,
    widget: rightTri(b, a, String(b), String(a), '?'),
    answer: c,
    hint: 'Square both, add, take the square root.',
    explain: `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}, and √${c * c} = ${c}.`,
  };
};

const genLeg: Generator = (rng) => {
  const [p, q, r] = pick(rng, TRIPLES), m = r < 20 ? randInt(rng, 1, 3) : 1;
  const [a, b, c] = [p * m, q * m, r * m];
  const [known, want] = rng() < 0.5 ? [a, b] : [b, a];
  return {
    kind: 'number',
    body: `A ladder ${c} m long leans against a wall with its foot ${known} m from the wall. How high up the wall does it reach?`,
    widget: rightTri(known, want, `${known} m`, '?', `${c} m`),
    answer: want,
    hint: 'The ladder is the hypotenuse. Subtract squares.',
    explain: `${c}² − ${known}² = ${c * c} − ${known * known} = ${want * want}, and √${want * want} = ${want} m.`,
  };
};

const genDistance: Generator = (rng) => {
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  do { x1 = randInt(rng, -5, 5); y1 = randInt(rng, -5, 5); x2 = randInt(rng, -5, 5); y2 = randInt(rng, -5, 5); } while (x1 === x2 || y1 === y2);
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1), d = Math.hypot(dx, dy);
  const exact = Number.isInteger(d);
  return {
    kind: 'number',
    body: `How far apart are the points (${x1}, ${y1}) and (${x2}, ${y2})?${exact ? '' : ' Give 2 decimal places.'}`,
    widget: () => plotEl(grid([{ type: 'dots', pts: [[x1, y1], [x2, y2]], labels: ['A', 'B'], color: 'var(--c1)' }])),
    answer: d, tol: exact ? 0.01 : 0.006,
    hint: 'How far across, how far up? Those are the legs of a right triangle.',
    explain: `Across ${dx}, up/down ${dy}: √(${dx}² + ${dy}²) = √${dx * dx + dy * dy} ${exact ? '=' : '≈'} ${num(d, 4)}.`,
  };
};

const genTriSort: Generator = (rng) => {
  const kind = (a: number, b: number, c: number) => (c * c === a * a + b * b ? 1 : c * c < a * a + b * b ? 0 : 2);
  const items: { text: string; bin: number }[] = [];
  const seen = new Set<string>();
  const add = (s: number[]) => {
    const [a, b, c] = s.slice().sort((x, y) => x - y);
    const text = `${a}, ${b}, ${c}`;
    if (a + b <= c || seen.has(text)) return;
    seen.add(text);
    items.push({ text, bin: kind(a, b, c) });
  };
  const [p, q, r] = pick(rng, TRIPLES.slice(0, 3)), m = randInt(rng, 1, 2);
  add([p * m, q * m, r * m]);
  const want = randInt(rng, 4, 6);
  for (let g = 0; items.length < want && g < 200; g++) add([randInt(rng, 2, 12), randInt(rng, 2, 12), randInt(rng, 2, 12)]);
  return {
    kind: 'sort',
    body: `Sort these ${items.length} triangles, given by their side lengths, by their largest angle.`,
    bins: ['Acute', 'Right', 'Obtuse'],
    items: shuffle(rng, items),
    hint: 'Compare the square of the longest side with the sum of the squares of the other two.',
    explain: items.map((it) => { const [a, b, c] = it.text.split(', ').map(Number); return `${it.text}: ${c * c} vs ${a * a + b * b}`; }).join('; ') + '. Equal: right. Longest² smaller: acute. Bigger: obtuse.',
  };
};

// ---------------------------------------------------------------- practice: circles

const genCircumference: Generator = (rng) => {
  const r = randInt(rng, 2, 20), byD = rng() < 0.5, c = 2 * Math.PI * r;
  return {
    kind: 'number', unit: 'cm',
    body: `A circle has ${byD ? `diameter ${2 * r}` : `radius ${r}`} cm. What is its circumference? (1 decimal place)`,
    widget: circleFig(1, byD ? `d = ${2 * r}` : `r = ${r}`, byD ? 'd' : 'r'),
    answer: c, tol: c * 0.002 + 0.05,
    hint: 'Circumference = π × diameter.',
    explain: `π × ${2 * r} ≈ ${num(c, 4)} cm.${byD ? '' : ` (Diameter = 2 × ${r} = ${2 * r}.)`}`,
  };
};

const genCircleArea: Generator = (rng) => {
  const r = randInt(rng, 2, 15), byD = rng() < 0.4, A = Math.PI * r * r;
  return {
    kind: 'number', unit: 'cm²',
    body: `A circle has ${byD ? `diameter ${2 * r}` : `radius ${r}`} cm. What is its area? (1 decimal place)`,
    widget: circleFig(1, byD ? `d = ${2 * r}` : `r = ${r}`, byD ? 'd' : 'r'),
    answer: A, tol: A * 0.002 + 0.05,
    hint: byD ? 'Area uses the radius: halve the diameter first.' : 'Area = π × r².',
    explain: `π × ${r}² = π × ${r * r} ≈ ${num(A, 4)} cm².`,
  };
};

const genPizza: Generator = (rng) => {
  const D = pick(rng, [12, 14, 16, 18]), d = pick(rng, [8, 9, 10, 11, 12].filter((x) => x < D)), n = pick(rng, [2, 3]);
  const big = D * D, small = n * d * d; // both × π/4
  const bigWins = big > small;
  const fmt = (v: number) => num((Math.PI * v) / 4, 3);
  return {
    kind: 'choice',
    body: `Same price, same thickness: one ${D}-inch pizza, or ${n} ${d}-inch pizzas? (Sizes are diameters.) Which is more pizza?`,
    widget: circlesRow([D, ...Array(n).fill(d)], [`${D}"`, ...Array(n).fill(`${d}"`)]),
    options: [
      { text: `The one ${D}-inch pizza`, correct: bigWins, why: bigWins ? undefined : `π × ${D / 2}² ≈ ${fmt(big)} square inches, less than ${n} × π × ${d / 2}² ≈ ${fmt(small)}.` },
      { text: `The ${n} ${d}-inch pizzas`, correct: !bigWins, why: bigWins ? `Adding diameters (${n * d}") is tempting, but area grows with the square: ${n} × π × ${d / 2}² ≈ ${fmt(small)} vs ${fmt(big)}.` : undefined },
      { text: 'Exactly the same', why: `Compare ${D}² = ${big} with ${n} × ${d}² = ${small}: they differ.` },
    ],
    hint: 'Compare areas, not diameters: area ∝ diameter².',
    explain: `Areas: big ≈ ${fmt(big)} in², ${n} small ≈ ${fmt(small)} in². Compare ${D}² = ${big} with ${n} × ${d}² = ${small}.`,
  };
};

// ---------------------------------------------------------------- practice: similarity

const genShadow: Generator = (rng) => {
  const s = randInt(rng, 1, 3), sh = randInt(rng, 1, 4), k = randInt(rng, 3, 10);
  const what = pick(rng, ['tree', 'flagpole', 'tower', 'lamp post']);
  return {
    kind: 'number', unit: 'm',
    body: `A ${s} m stick casts a ${sh} m shadow. At the same moment a ${what} casts a ${sh * k} m shadow. How tall is the ${what}?`,
    widget: shadowFig(s, sh, sh * k),
    answer: s * k,
    hint: 'The sun’s rays are parallel, so the two triangles are similar. How many times longer is the big shadow?',
    explain: `The shadow is ${k}× as long (${sh * k} ÷ ${sh}), so the ${what} is ${k}× as tall: ${k} × ${s} = ${s * k} m.`,
  };
};

const genMap: Generator = (rng) => {
  const scale = pick(rng, [10000, 20000, 25000, 50000, 100000, 250000]);
  const cm = randInt(rng, 2, 16) / 2;
  const km = (cm * scale) / 100000;
  return {
    kind: 'number', unit: 'km',
    body: `On a 1:${scale.toLocaleString('en-US')} map, two villages are ${num(cm)} cm apart. How far apart are they really, in km?`,
    answer: km,
    hint: '1 cm on the map is that many cm in real life. 100,000 cm = 1 km.',
    explain: `${num(cm)} × ${scale.toLocaleString('en-US')} = ${(cm * scale).toLocaleString('en-US')} cm = ${num(km)} km.`,
  };
};

const genEnlarge: Generator = (rng) => {
  const k = pick(rng, [2, 3]), x = randInt(rng, 1, Math.floor(10 / k)), y = randInt(rng, 1, Math.floor(10 / k));
  return {
    kind: 'point',
    body: `Enlarge point P(${x}, ${y}) by scale factor ${k} from the origin O. Place the image P′.`,
    plot: { x: [0, 10], y: [0, 10], equal: true, grid: true, ticks: [1, 1], size: [420, 440], layers: [{ type: 'dots', pts: [[0, 0], [x, y]], labels: ['O', 'P'], color: 'var(--c1)' }] },
    answer: { x: k * x, y: k * y }, tol: 0.3, snap: 1,
    hint: `P′ is on the line from O through P, ${k} times as far from O.`,
    explain: `Multiply both coordinates by ${k}: (${k * x}, ${k * y}).`,
  };
};

// ---------------------------------------------------------------- practice: square-cube

const genScaleFactor: Generator = (rng) => {
  const k = pick(rng, [2, 3, 4, 5, 10]);
  const q = pick(rng, ['surface area', 'volume', 'weight', 'height', 'amount of paint to cover it', 'cross-section of each leg'] as const);
  const p = q === 'height' ? 1 : q === 'volume' || q === 'weight' ? 3 : 2;
  const name = ['length', 'area', 'volume'][p - 1];
  return {
    kind: 'choice', ordered: true,
    body: `A toy dinosaur is copied at ${k}× the size in every direction, in the same plastic. By what factor does its **${q}** grow?`,
    options: opts({ text: `×${k ** p}` }, [
      { text: `×${k}`, why: `×${k} is right only for lengths. The ${q} is a${p === 2 ? 'n area' : ' volume'}.` },
      { text: `×${k * k}`, why: p === 3 ? `That's how areas grow. ${q[0].toUpperCase() + q.slice(1)} follows the volume: ×${k}³.` : `That's an area factor, but ${q} is a length.` },
      { text: `×${k ** 3}`, why: `That's the volume factor. ${q[0].toUpperCase() + q.slice(1)} is a${p === 2 ? 'n area: ×' + k + '²' : ' length: ×' + k}.` },
    ]).sort((a, b) => Number(a.text.slice(1)) - Number(b.text.slice(1))),
    hint: 'Is it a length, an area or a volume?',
    explain: `The ${q} is a ${name}, so it grows by ${k}${p === 1 ? '' : p === 2 ? '²' : '³'} = ${k ** p}.`,
  };
};

const genSAV: Generator = (rng) => {
  const s = pick(rng, [1, 2, 3, 4, 5, 6, 8, 10, 12, 20]);
  return {
    kind: 'number', unit: 'cm² per cm³',
    body: `A cube has sides of ${s} cm. What is its surface area divided by its volume?`,
    widget: cubeW(Math.min(s, 3)),
    answer: 6 / s, tol: 0.006,
    hint: 'Surface: 6 faces of s². Volume: s³.',
    explain: `${6 * s * s} cm² ÷ ${s ** 3} cm³ = ${num(6 / s, 3)}. In general 6s² ÷ s³ = 6 ÷ s: the bigger the cube, the less surface each cm³ gets.`,
  };
};

const genModelMass: Generator = (rng) => {
  const k = pick(rng, [2, 4, 5, 10, 20]), g = randInt(rng, 2, 18) * 10;
  return {
    kind: 'number', unit: 'kg',
    body: `A 1:${k} scale model of a statue, cast in the same bronze, has a mass of ${g} g. What is the mass of the full statue, in kg?`,
    answer: (g * k ** 3) / 1000,
    hint: 'Every length is ×' + k + '. Mass follows volume.',
    explain: `Volume and mass grow by ${k}³ = ${(k ** 3).toLocaleString('en-US')}: ${g} g × ${(k ** 3).toLocaleString('en-US')} = ${(g * k ** 3).toLocaleString('en-US')} g = ${num((g * k ** 3) / 1000)} kg.`,
  };
};

// ---------------------------------------------------------------- practice: transformations

const genTranslate: Generator = (rng) => {
  let x = 0, y = 0, a = 0, b = 0;
  do { x = randInt(rng, -5, 5); y = randInt(rng, -5, 5); a = randInt(rng, -5, 5); b = randInt(rng, -5, 5); } while (!a || !b || Math.abs(x + a) > 6 || Math.abs(y + b) > 6);
  const dirs = `${Math.abs(a)} ${a > 0 ? 'right' : 'left'} and ${Math.abs(b)} ${b > 0 ? 'up' : 'down'}`;
  return {
    kind: 'point',
    body: `Translate P(${x}, ${y}) ${dirs}. Place its image.`,
    plot: grid([{ type: 'dots', pts: [[x, y]], labels: ['P'], color: 'var(--c1)' }]),
    answer: { x: x + a, y: y + b }, tol: 0.3, snap: 1,
    hint: 'Add to x for right/left, to y for up/down.',
    explain: `(${x} ${a > 0 ? '+' : '−'} ${Math.abs(a)}, ${y} ${b > 0 ? '+' : '−'} ${Math.abs(b)}) = (${x + a}, ${y + b}).`,
  };
};

const genReflect: Generator = (rng) => {
  const m = pick(rng, ['y-axis', 'x-axis', 'line y = x'] as const);
  let x = 0, y = 0;
  do { x = randInt(rng, -5, 5); y = randInt(rng, -5, 5); } while ((m === 'y-axis' && x === 0) || (m === 'x-axis' && y === 0) || (m === 'line y = x' && x === y));
  const [ax, ay] = m === 'y-axis' ? [-x, y] : m === 'x-axis' ? [x, -y] : [y, x];
  const mirror: Layer = m === 'y-axis' ? { type: 'vline', x: 0, color: 'var(--c4)' } : m === 'x-axis' ? { type: 'hline', y: 0, color: 'var(--c4)' } : { type: 'fn', f: (t) => t, color: 'var(--c4)', dash: true };
  return {
    kind: 'point',
    body: `Reflect P(${x}, ${y}) in the ${m}. Place its image.`,
    plot: grid([mirror, { type: 'dots', pts: [[x, y]], labels: ['P'], color: 'var(--c1)' }]),
    answer: { x: ax, y: ay }, tol: 0.3, snap: 1,
    hint: m === 'line y = x' ? 'Reflecting in y = x swaps the coordinates.' : 'The image is as far behind the mirror as P is in front of it.',
    explain: `Reflecting in the ${m}: (${x}, ${y}) → (${ax}, ${ay}).`,
  };
};

const genRotate: Generator = (rng) => {
  const r = pick(rng, ['90° counter-clockwise', '90° clockwise', '180°'] as const);
  let x = 0, y = 0;
  do { x = randInt(rng, -5, 5); y = randInt(rng, -5, 5); } while (x === 0 && y === 0);
  const [ax, ay] = r === '180°' ? [-x, -y] : r === '90° clockwise' ? [y, -x] : [-y, x];
  return {
    kind: 'point',
    body: `Rotate P(${x}, ${y}) by ${r} about the origin. Place its image.`,
    plot: grid([{ type: 'dots', pts: [[0, 0], [x, y]], labels: ['O', 'P'], color: 'var(--c1)' }]),
    answer: { x: ax + 0, y: ay + 0 }, tol: 0.3, snap: 1,
    hint: r === '180°' ? 'Half a turn: straight through the origin to the other side.' : 'Turn the arrow from O to P a quarter turn; its across and up swap roles.',
    explain: `${r === '180°' ? '(x, y) → (−x, −y)' : r === '90° clockwise' ? '(x, y) → (y, −x)' : '(x, y) → (−y, x)'}: (${x}, ${y}) → (${ax + 0}, ${ay + 0}).`,
  };
};

// ---------------------------------------------------------------- practice: estimating space

const CONV: [string, string, number][] = [
  ['m²', 'cm²', 10000], ['km²', 'm²', 1000000], ['cm²', 'mm²', 100], ['hectares', 'm²', 10000],
  ['m³', 'litres', 1000], ['m³', 'cm³', 1000000], ['litres', 'cm³', 1000], ['km²', 'hectares', 100],
];
const genConvert: Generator = (rng) => {
  const [from, to, f] = pick(rng, CONV);
  const v = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 1.5, 2.5, 0.5]);
  return {
    kind: 'number', unit: to,
    body: `How many ${to} are in ${num(v)} ${from}?`,
    answer: v * f,
    hint: 'Convert the length first, then square it (areas) or cube it (volumes).',
    explain: `1 ${from.replace(/s$/, '')} = ${f.toLocaleString('en-US')} ${to}, so ${num(v)} ${from} = ${(v * f).toLocaleString('en-US')} ${to}.`,
  };
};

const genLitres: Generator = (rng) => {
  const [l, w, hh] = [randInt(rng, 2, 12) * 5, randInt(rng, 2, 8) * 5, randInt(rng, 2, 8) * 5];
  const what = pick(rng, ['fish tank', 'storage box', 'planter', 'cool box']);
  return {
    kind: 'number', unit: 'litres',
    body: `A ${what} measures ${l} cm × ${w} cm × ${hh} cm inside. How many litres does it hold?`,
    widget: boxFig(l, w, hh, [`${l} cm`, `${w} cm`, `${hh} cm`]),
    answer: (l * w * hh) / 1000,
    hint: 'Volume in cm³, then 1 litre = 1,000 cm³.',
    explain: `${l} × ${w} × ${hh} = ${(l * w * hh).toLocaleString('en-US')} cm³ = ${num((l * w * hh) / 1000)} litres.`,
  };
};

const LEN: [string, string, number][] = [['m', 'cm', 100], ['cm', 'mm', 10], ['km', 'm', 1000], ['m', 'mm', 1000], ['dm', 'cm', 10]];
const genFillConv: Generator = (rng) => {
  const [big, small, r] = pick(rng, LEN);
  const t = (v: number) => v.toLocaleString('en-US');
  const sq = shuffle(rng, [t(r), t(r * r), t(r ** 3)]), cu = shuffle(rng, [t(r * r), t(r ** 3), t(3 * r)]);
  return {
    kind: 'fill',
    body: `Convert from ${big} to ${small}.`,
    template: `1 ${big} = ${t(r)} ${small}, so 1 ${big}² = [[0]] ${small}² and 1 ${big}³ = [[1]] ${small}³.`,
    blanks: [{ options: sq, answer: sq.indexOf(t(r * r)) }, { options: cu, answer: cu.indexOf(t(r ** 3)) }],
    hint: 'A square has two lengths to convert, a cube three.',
    explain: `Area: ${t(r)} × ${t(r)} = ${t(r * r)}. Volume: ${t(r)} × ${t(r)} × ${t(r)} = ${t(r ** 3)}.`,
  };
};

// ---------------------------------------------------------------- widgets made from the plot library

const translateTask = plotExplorer({
  params: [
    { id: 'dx', label: 'right', min: -6, max: 6, step: 1, value: 0 },
    { id: 'dy', label: 'up', min: -6, max: 6, step: 1, value: 0 },
  ],
  spec: (v) => {
    const T: [number, number][] = [[-4, 1], [-2, 1], [-4, 4]];
    return grid([
      poly(T.map(([x, y]) => [x + 5, y - 3]), 'var(--muted)', true),
      poly(T.map(([x, y]) => [x + v.dx, y + v.dy]), 'var(--c1)'),
    ]);
  },
  readout: (v) => `every point moves by (${v.dx}, ${v.dy})`,
  goal: (v) => v.dx === 5 && v.dy === -3,
  goalText: 'On target: every point moved 5 right and 3 down.',
});

const L_SHAPE: [number, number][] = [[1, 1], [4, 1], [4, 2], [2, 2], [2, 4], [1, 4]];
const rotStepper = () => stepper(4, (i) => {
  const rot = (p: [number, number]): [number, number] => { let [x, y] = p; for (let k = 0; k < i; k++) [x, y] = [-y, x]; return [x + 0, y + 0]; };
  const q = rot([4, 1]);
  return plotEl(grid([
    poly(L_SHAPE, 'var(--muted)', true),
    poly(L_SHAPE.map(rot), 'var(--c2)'),
    { type: 'dots', pts: [[0, 0], q], labels: ['O', `(${q[0]}, ${q[1]})`], color: 'var(--c4)' },
  ], 5));
}, { caption: (i) => ['Start: the corner (4, 1).', '90° counter-clockwise: (x, y) → (−y, x), so (4, 1) → (−1, 4).', '180°: (x, y) → (−x, −y).', '270° counter-clockwise (= 90° clockwise): (x, y) → (y, −x).'][i] });

const flagTwice = () => {
  const F: [number, number][] = [[1, 0.5], [1, 3.5], [2, 3], [1, 2.5]];
  const r1 = F.map(([x, y]): [number, number] => [5 - x, y]), r2 = r1.map(([x, y]): [number, number] => [9 - x, y]);
  return plotEl({ x: [0, 7], y: [0, 4], equal: true, grid: true, ticks: [1, 1], size: [420, 280], layers: [
    { type: 'vline', x: 2.5, color: 'var(--c4)', label: 'mirror 1' }, { type: 'vline', x: 4.5, color: 'var(--c4)', label: 'mirror 2' },
    { type: 'line', pts: F, color: 'var(--c1)', width: 3 }, { type: 'line', pts: r1, color: 'var(--muted)', dash: true }, { type: 'line', pts: r2, color: 'var(--c2)', width: 3 },
  ] });
};

// ---------------------------------------------------------------- course

export const geometry: Course = {
  id: 'geometry',
  title: 'Geometry & Measurement',
  blurb: 'Angles, area, Pythagoras, π and scaling: see why the formulas are true, then use them.',
  color: '#0f9b8e',
  icon: '📐',
  lessons: [
    // ------------------------------------------------------------ 1
    {
      id: 'angles',
      title: 'Angles',
      goal: 'Find missing angles on lines, around points, in triangles and polygons.',
      steps: [
        {
          kind: 'number', unit: '°',
          body: 'A ray leaves a straight line. One of the two angles it makes is 130°. What is the other one?',
          widget: lineAngles(130),
          answer: 50, tol: 0.01,
          hint: 'Together the two angles make the straight line, half a full turn.',
          explain: 'A straight line is half a turn, 180°. So the other angle is 180° − 130° = 50°.',
        },
        {
          kind: 'read',
          title: 'Angles on a line',
          body: 'A full turn is **360°**, so a straight line (half a turn) is **180°**. However the ray tilts, the two angles it makes on a line add to 180°. Drag it and watch.',
          widget: lineExplorer,
        },
        {
          kind: 'number', unit: '°',
          body: 'Three angles meet at a point: 90°, 120° and one more. How big is the third?',
          widget: aroundPoint([0, 90, 210], ['90°', '120°', '?']),
          answer: 150, tol: 0.01,
          hint: 'Going all the way round a point is a full turn.',
          explain: 'Angles around a point make a full turn, 360°: 360° − 90° − 120° = 150°.',
        },
        {
          kind: 'choice',
          body: 'Draw **any** triangle. Tear off its three corners and put them together, tips touching. What do they make?',
          widget: triangleFig([[0, 0], [7, 0], [2.2, 3.6]], ['a', 'b', 'c']),
          options: [
            { text: 'A straight line (180°)', correct: true },
            { text: 'A full turn (360°)', why: '360° is what four corners of a quadrilateral make. Three triangle corners only reach halfway round.' },
            { text: 'It depends on the triangle', why: 'Surprisingly, it doesn’t. Long and thin or nearly equilateral, the corners always make exactly the same angle.' },
            { text: 'A right angle (90°)', why: 'Each corner of an equilateral triangle is already 60°; two of them alone pass 90°.' },
          ],
          explain: 'They always make a straight line: the angles of every triangle add up to 180°. Watch it happen next.',
        },
        {
          kind: 'read',
          title: 'Why 180°?',
          body: 'Step through the tearing. Then the reason: draw a line through the top corner parallel to the bottom side. The two bottom corners reappear up there (alternate angles between parallel lines are equal), sitting beside the top corner along that straight line.',
          widget: W(tearCorners),
        },
        {
          kind: 'task',
          body: 'Move the top corner C until the angle **at C** is exactly 90°. Watch the sum as you go.',
          widget: triangleExplorer,
          hint: 'A right angle at C happens when C sits on the circle that has AB as its diameter: centre (3, 0), radius 3.',
          explain: 'At C = (3, 3) the angle at C is 90° and A = B = 45°. Every triangle you made along the way still summed to 180°.',
        },
        {
          kind: 'number', unit: '°',
          body: 'Two angles of a triangle are 47° and 68°. What is the third?',
          widget: triangleFig(triFromAngles(47, 68, 6), ['47°', '68°', '?']),
          answer: 65, tol: 0.01,
          hint: 'All three add to 180°.',
          explain: '180° − 47° − 68° = 65°.',
        },
        {
          kind: 'fill',
          body: 'A diagonal cuts a quadrilateral into triangles. Complete the reasoning.',
          widget: polygonW(4),
          template: 'A quadrilateral splits into [[0]] triangles, so its angles add up to [[1]].',
          blanks: [{ options: ['2', '3', '4'], answer: 0 }, { options: ['180°', '360°', '540°'], answer: 1 }],
          hint: 'One diagonal, corner to corner.',
          explain: 'One diagonal makes 2 triangles. Their corners together are exactly the quadrilateral’s corners: 2 × 180° = 360°.',
        },
        {
          kind: 'read',
          title: 'Any polygon',
          body: 'From one corner, draw diagonals to every other corner you can reach. An n-sided polygon always splits into **n − 2** triangles, so its angles add to **(n − 2) × 180°**.',
          widget: polygonExplorer,
        },
        {
          kind: 'match',
          body: 'Match each polygon to the sum of its interior angles.',
          heads: ['Polygon', 'Angle sum'],
          pairs: [['Triangle', '180°'], ['Quadrilateral', '360°'], ['Pentagon', '540°'], ['Hexagon', '720°']],
          hint: 'Each extra side adds one more triangle: another 180°.',
          explain: '(n − 2) × 180°: 3 sides → 180°, 4 → 360°, 5 → 540°, 6 → 720°.',
        },
        {
          kind: 'number', unit: '°',
          body: 'A regular hexagon has six equal angles (think of a honeycomb cell). How big is each one?',
          widget: polygonW(6),
          answer: 120, tol: 0.01,
          hint: 'Find the total first, then share it among six.',
          explain: 'Total (6 − 2) × 180° = 720°; each 720° ÷ 6 = 120°. Three of them meet at each point of a honeycomb: 3 × 120° = 360°, which is why hexagons tile perfectly.',
        },
        {
          kind: 'sort',
          body: 'Could these be the three angles of a triangle?',
          bins: ['Yes', 'No'],
          items: [
            { text: '90°, 45°, 45°', bin: 0 }, { text: '30°, 60°, 90°', bin: 0 }, { text: '89°, 89°, 2°', bin: 0 },
            { text: '60°, 60°, 50°', bin: 1 }, { text: '100°, 50°, 40°', bin: 1 }, { text: '70°, 70°, 70°', bin: 1 },
          ],
          hint: 'Add them up.',
          explain: 'Only sets summing to exactly 180° work. 89°, 89°, 2° is a very thin triangle, but real. 60+60+50 = 170, 100+50+40 = 190 and 70+70+70 = 210 can’t be triangles.',
        },
      ],
      practice: [genThirdAngle, genPolygonSum, genRegularAngle, genAroundPoint],
    },

    // ------------------------------------------------------------ 2
    {
      id: 'area',
      title: 'Area by rearranging',
      goal: 'Find areas of parallelograms, triangles and trapezoids by cutting and moving pieces.',
      steps: [
        {
          kind: 'choice',
          body: 'A 6 × 4 rectangle and a parallelogram with base 6, height 4 and slanted sides 5. Which has more area?',
          widget: rectVsPara,
          options: [
            { text: 'They have the same area', correct: true },
            { text: 'The parallelogram: its sides are longer', why: 'Longer sides give a longer perimeter, not more area. Area is about the space inside.' },
            { text: 'The rectangle: the parallelogram is squashed', why: 'Its height is still 4. It leans, but no space is lost. See the next step.' },
          ],
          explain: 'Both are 24. Cut a triangle off the parallelogram’s end, slide it to the other end, and you get the 6 × 4 rectangle.',
        },
        {
          kind: 'read',
          title: 'Cut and slide',
          body: 'Moving a piece doesn’t change how much space it covers. So a parallelogram has the area of a rectangle with the same base and height:\n\n**area = base × height**\n\nThe height is the **perpendicular** distance between the parallel sides, not the slanted side.',
          widget: W(paraToRect),
        },
        {
          kind: 'number', unit: 'square units',
          body: 'This parallelogram has base 9, height 5 and slanted sides 6. What is its area?',
          widget: paraFig(9, 5, Math.sqrt(11), { base: '9', height: '5', side: '6' }),
          answer: 45,
          hint: 'Which two lengths make the rectangle after cutting and sliding?',
          explain: 'Base × perpendicular height = 9 × 5 = 45. The 6 is a distraction: it would only matter for the perimeter.',
        },
        {
          kind: 'task',
          body: 'Slide the top edge of this 6 × 4 shape sideways until its top-left corner is directly above the bottom-right corner. Keep an eye on the readout.',
          widget: shearExplorer,
          hint: 'The base is 6 long, so slide the top 6 units.',
          explain: 'Sliding the top edge (a **shear**) makes the sides longer and the perimeter bigger, but the area stays 6 × 4 = 24 the whole time: the base and the height never change.',
        },
        {
          kind: 'read',
          title: 'Why shearing keeps area',
          body: 'Think of a shape as a stack of thin strips, like a deck of cards. Push the deck sideways: every card keeps its length, so the total area doesn’t change. Only the base and height matter.',
          widget: cardStacks,
        },
        {
          kind: 'choice',
          body: 'Take any triangle, copy it, and turn the copy half a turn. Fitted together along a side, the two copies always make…',
          widget: W(triToPara),
          options: [
            { text: 'A parallelogram', correct: true },
            { text: 'A rectangle', why: 'Only if the triangle has a right angle. In general the result leans.' },
            { text: 'A square', why: 'That needs a right-angled triangle with equal short sides: a special case.' },
            { text: 'A trapezoid', why: 'A half-turned copy makes both pairs of opposite sides parallel, which is more than a trapezoid needs: it’s a parallelogram.' },
          ],
          explain: 'Always a parallelogram with the triangle’s base and height. So a triangle is half of one: **area = ½ × base × height**.',
        },
        {
          kind: 'number', unit: 'square units',
          body: 'This triangle has base 6. Its top corner is 5 units above the line of the base, but out past the end. What is its area?',
          widget: triangleFig([[0, 0], [6, 0], [9, 5]], ['', '', ''], ['6'], [
            { t: 'poly', pts: [[6, 0], [9, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 },
            { t: 'poly', pts: [[9, 5], [9, 0]], open: true, dash: true, stroke: 'var(--muted)', w: 1.5 },
            { t: 'right', at: [9, 0], u: [-1, 0], v: [0, 1] },
            { t: 'text', at: [9.35, 2.5], s: '5', anchor: 'start' }], false),
          answer: 15,
          hint: 'The height is the perpendicular distance from the top corner to the line of the base, even if it lands outside.',
          explain: '½ × 6 × 5 = 15. Shear the top corner along to sit right above the base: the area doesn’t change, so the formula holds even for this leaning triangle.',
        },
        {
          kind: 'read',
          title: 'Trapezoids',
          body: 'A trapezoid has two parallel sides, a and b. Two copies, one turned half a turn, make a parallelogram with base **a + b**. So one trapezoid is half of that:\n\n**area = ½ × (a + b) × height**: the average of the parallel sides, times the height.',
          widget: W(trapToPara),
        },
        {
          kind: 'fill',
          body: 'Complete the trapezoid rule in words.',
          template: 'Area of a trapezoid = [[0]] × height, which is the [[1]] of the two parallel sides times the height.',
          blanks: [{ options: ['(a + b) ÷ 2', 'a × b', '(a + b) × 2'], answer: 0 }, { options: ['average', 'product', 'difference'], answer: 0 }],
          hint: 'Two trapezoids make a parallelogram with base a + b.',
          explain: 'Two copies: (a + b) × h. One: (a + b) ÷ 2 × h, the average width times the height.',
        },
        {
          kind: 'number', unit: 'square units',
          body: 'A trapezoid has parallel sides 11 and 5, and they are 4 apart. What is its area?',
          widget: trapFig(11, 5, 4),
          answer: 32,
          hint: 'Average the parallel sides, then multiply by the height.',
          explain: '(11 + 5) ÷ 2 = 8, and 8 × 4 = 32.',
        },
        {
          kind: 'match',
          body: 'Match each shape to its area formula.',
          heads: ['Shape', 'Area'],
          pairs: [['Square, side s', 's × s'], ['Triangle', '½ × base × height'], ['Trapezoid', '½ × (a + b) × height'], ['Rhombus, diagonals p and q', '½ × p × q']],
          hint: 'A rhombus fits inside a p × q rectangle, filling half of it.',
          explain: 'The rhombus is the odd one: its four corners touch the sides of a p × q rectangle, and the four corner triangles it leaves out match the four triangles it’s made of, so it fills half.',
        },
        {
          kind: 'sort',
          body: 'Which changes keep a shape’s area the same?',
          bins: ['Same area', 'Area changes'],
          items: [
            { text: 'Sliding the top edge of a parallelogram sideways', bin: 0 },
            { text: 'Cutting off a triangle and gluing it on elsewhere', bin: 0 },
            { text: 'Rotating the shape', bin: 0 },
            { text: 'Doubling the height', bin: 1 },
            { text: 'Tilting a hinged rectangular frame into a parallelogram', bin: 1 },
            { text: 'Stretching the base to twice its length', bin: 1 },
          ],
          hint: 'Watch the height. Does it stay the same?',
          explain: 'Shearing, cutting-and-moving and rotating keep area. A hinged frame is the trap: its sides keep their lengths, so as it tilts its **height shrinks** and so does its area. Doubling a length doubles the area.',
        },
        {
          kind: 'multi',
          body: 'Which of these have an area of exactly 24?',
          options: [
            { text: 'A rectangle 6 by 4', correct: true },
            { text: 'A parallelogram with base 8 and height 3', correct: true },
            { text: 'A triangle with base 8 and height 6', correct: true },
            { text: 'A trapezoid with parallel sides 5 and 7, height 4', correct: true },
            { text: 'A triangle with base 6 and height 4', why: 'Half of 6 × 4: that’s 12.' },
            { text: 'A parallelogram with sides 6 and 4, not a rectangle', why: 'Without the height we can’t say exactly, but it’s less than 24: the slanted side is longer than the height.' },
          ],
          explain: '6 × 4, 8 × 3, ½ × 8 × 6 and ½ × (5 + 7) × 4 are all 24. A leaning parallelogram with sides 6 and 4 has height under 4, so area under 24.',
        },
      ],
      practice: [genArea, genTrapezoid, genSameArea],
    },

    // ------------------------------------------------------------ 3
    {
      id: 'pythagoras',
      title: 'Pythagoras',
      goal: 'See why a² + b² = c², and use it for lengths and distances.',
      steps: [
        {
          kind: 'number', unit: 'squares',
          body: 'A right triangle with sides 3 and 4. Squares are built on each side. The squares on the short sides hold 9 and 16 unit squares. How many unit squares does the tilted square on the long side hold?',
          widget: pythGrid,
          answer: 25,
          hint: 'The tilted square sits inside a 7 × 7 square of the grid. What’s left in the corners?',
          explain: 'The 7 × 7 box holds 49. Its four corner triangles are each ½ × 3 × 4 = 6, so 24 in all. 49 − 24 = 25, and 9 + 16 = 25 too.',
        },
        {
          kind: 'read',
          title: 'a² + b² = c²',
          body: 'For **every** right triangle, the square on the longest side (the **hypotenuse**, c) equals the two other squares put together. Try other triangles.',
          widget: pythExplorer,
        },
        {
          kind: 'read',
          title: 'A proof you can see',
          body: 'Why must it always work? Step through. Two equal big squares, each holding four copies of the triangle, arranged differently.',
          widget: W(pythProof),
        },
        {
          kind: 'choice',
          body: 'What makes the rearrangement a proof that c² = a² + b²?',
          widget: W(pythProof),
          options: [
            { text: 'Both big squares have the same area and contain the same four triangles, so what’s left over must be equal', correct: true },
            { text: 'The picture was drawn accurately and the areas look the same', why: 'Looks can deceive; the argument doesn’t rely on measuring. It works for any a and b by pure bookkeeping of area.' },
            { text: 'It checks the rule for one triangle, 3-4-5', why: 'One example isn’t a proof. The arrangement works for any lengths a and b.' },
          ],
          explain: 'Big square − 4 triangles = c² in one arrangement and a² + b² in the other. Same big square, same triangles: c² = a² + b².',
        },
        {
          kind: 'number',
          body: 'A right triangle has short sides 5 and 12. How long is the hypotenuse?',
          widget: rightTri(12, 5, '12', '5', '?'),
          answer: 13,
          hint: 'Square, add, square root.',
          explain: '5² + 12² = 25 + 144 = 169, and √169 = 13.',
        },
        {
          kind: 'number', unit: 'm',
          body: 'A 10 m ladder leans against a wall with its foot 6 m from the wall. How high up does it reach?',
          widget: rightTri(6, 8, '6 m', '?', '10 m'),
          answer: 8,
          hint: 'This time you know the hypotenuse. Subtract.',
          explain: '10² − 6² = 100 − 36 = 64, and √64 = 8 m.',
        },
        {
          kind: 'read',
          title: 'Distance on a grid',
          body: 'To find the straight-line distance between two points, make them the ends of a hypotenuse: the legs are how far **across** (Δx) and how far **up** (Δy).\n\nFrom (1, 1) to (5, 4): across 4, up 3, distance √(16 + 9) = **5**.',
          widget: () => plotEl({ x: [0, 6], y: [0, 5], equal: true, grid: true, ticks: [1, 1], size: [420, 360], layers: [
            { type: 'line', pts: [[1, 1], [5, 1], [5, 4]], color: 'var(--muted)', dash: true },
            { type: 'line', pts: [[1, 1], [5, 4]], color: 'var(--c3)', width: 3 },
            { type: 'dots', pts: [[1, 1], [5, 4]], labels: ['A', 'B'], color: 'var(--c1)' },
            { type: 'text', x: 3, y: 0.6, text: 'Δx = 4' }, { type: 'text', x: 5.5, y: 2.5, text: 'Δy = 3' }, { type: 'text', x: 2.6, y: 2.8, text: '5', color: 'var(--c3)' }] }),
        },
        {
          kind: 'number',
          body: 'How far apart are A(1, 2) and B(7, 10)?',
          widget: () => plotEl({ x: [0, 9], y: [0, 11], equal: true, grid: true, ticks: [1, 1], size: [420, 440], layers: [{ type: 'dots', pts: [[1, 2], [7, 10]], labels: ['A', 'B'], color: 'var(--c1)' }] }),
          answer: 10,
          hint: 'Across 6, up 8.',
          explain: '√(6² + 8²) = √(36 + 64) = √100 = 10. (It’s the 3-4-5 triangle, doubled.)',
        },
        {
          kind: 'point',
          body: 'Place the point on the line y = 3 (to the right of the y-axis) that is exactly **5** units from the origin.',
          plot: { x: [-1, 7], y: [-1, 6], equal: true, grid: true, ticks: [1, 1], size: [420, 360], layers: [{ type: 'hline', y: 3, color: 'var(--c4)', label: 'y = 3' }, { type: 'dots', pts: [[0, 0]], labels: ['O'], color: 'var(--c1)' }] },
          answer: { x: 4, y: 3 }, tol: 0.3, snap: 1,
          hint: 'Up 3 and across x: x² + 3² = 5².',
          explain: 'x² + 9 = 25, so x² = 16 and x = 4. The point is (4, 3): a 3-4-5 triangle again.',
        },
        {
          kind: 'estimate',
          body: 'A square field is 100 m on each side. How many metres do you save by walking corner to corner across it instead of along two sides?',
          widget: fieldFig,
          min: 0, max: 100, step: 1, answer: 59, tol: 5, format: (v) => `${v} m`,
          hint: 'The diagonal is √(100² + 100²) = 100 × √2.',
          explain: 'The diagonal is 100 × √2 ≈ 141 m, against 200 m round the edge: you save about 59 m.',
        },
        {
          kind: 'multi',
          body: 'Which side lengths make a right triangle?',
          options: [
            { text: '3, 4, 5', correct: true },
            { text: '6, 8, 10', correct: true },
            { text: '8, 15, 17', correct: true },
            { text: '4, 5, 6', why: '16 + 25 = 41, but 6² = 36.' },
            { text: '2, 3, 4', why: '4 + 9 = 13, but 4² = 16.' },
            { text: '5, 12, 13', correct: true },
          ],
          hint: 'Check whether the two smaller squares add to the biggest.',
          explain: 'Right triangles: 9 + 16 = 25, 36 + 64 = 100, 64 + 225 = 289, 25 + 144 = 169. The rule works backwards too: if a² + b² = c², the angle is 90°.',
        },
        {
          kind: 'sort',
          body: 'The test goes further. Sort these triangles (side lengths) by their largest angle.',
          bins: ['Acute', 'Right', 'Obtuse'],
          items: [
            { text: '3, 4, 5', bin: 1 }, { text: '4, 5, 6', bin: 0 }, { text: '2, 3, 4', bin: 2 },
            { text: '5, 5, 7', bin: 0 }, { text: '5, 5, 8', bin: 2 }, { text: '7, 24, 25', bin: 1 },
          ],
          hint: 'Longest side squared: equal to, less than, or more than the other two squares added?',
          explain: 'Open the angle wider and the far side grows. So c² < a² + b² means acute (4,5,6: 36 < 41; 5,5,7: 49 < 50), equal means right, more means obtuse (2,3,4: 16 > 13; 5,5,8: 64 > 50).',
        },
      ],
      practice: [genHyp, genLeg, genDistance, genTriSort],
    },

    // ------------------------------------------------------------ 4
    {
      id: 'circles',
      title: 'Circles and π',
      goal: 'Find circumference and area, and see where πr² comes from.',
      steps: [
        {
          kind: 'estimate',
          body: 'Wrap a string once around a can 10 cm across. How long is the string?',
          widget: circleFig(1, 'd = 10 cm'),
          min: 10, max: 50, step: 0.1, answer: 31.4, tol: 1.5, format: (v) => `${v.toFixed(1)} cm`,
          hint: 'Is it more or less than 3 times the width?',
          explain: 'About 31.4 cm: a little more than 3 times the diameter. For every circle, circumference ÷ diameter is the same number, **π ≈ 3.14159**.',
        },
        {
          kind: 'read',
          title: 'Roll it out',
          body: 'Roll a wheel through one full turn and measure the track. It is always π diameters long, whatever size the wheel:\n\n**C = π × d = 2πr**',
          widget: W(rollCircle),
        },
        {
          kind: 'number', unit: 'cm',
          body: 'A plate has a diameter of 7 cm. What is its circumference? (1 decimal place)',
          widget: circleFig(1, 'd = 7'),
          answer: Math.PI * 7, tol: 0.1,
          hint: 'π × diameter.',
          explain: 'π × 7 ≈ 22.0 cm.',
        },
        {
          kind: 'choice',
          body: 'A bicycle wheel has a **radius** of 30 cm. How far does the bike roll in one full turn of the wheel?',
          widget: circleFig(1, 'r = 30 cm', 'r'),
          options: [
            { text: 'About 188 cm', correct: true },
            { text: 'About 94 cm', why: 'That’s π × 30: you used the radius where the diameter goes. The diameter is 60 cm.' },
            { text: 'About 2,827 cm', why: 'That’s π × 30², the area of the wheel (in cm²), not the distance round it.' },
            { text: '60 cm', why: 'That’s just across the wheel. Going round is π times as far.' },
          ],
          explain: 'One turn rolls out the circumference: 2 × π × 30 ≈ 188 cm.',
        },
        {
          kind: 'read',
          title: 'Area by slicing',
          body: 'Cut a circle into slices like a pizza and lay them top-to-tail. Half the crust goes along the top, half along the bottom. More slices: a better rectangle, **r** tall and **half the circumference, πr**, wide.',
          widget: slicesExplorer,
        },
        {
          kind: 'fill',
          body: 'Finish the argument.',
          template: 'The near-rectangle is [[0]] tall and [[1]] wide, so the circle’s area is [[2]].',
          blanks: [{ options: ['r', '2r', 'πr'], answer: 0 }, { options: ['πr', '2πr', 'r²'], answer: 0 }, { options: ['πr²', '2πr²', 'πr'], answer: 0 }],
          hint: 'The height is one slice’s length. The width is half the crust.',
          explain: 'Height r (a slice from centre to crust), width πr (half of 2πr). Area: r × πr = **πr²**.',
        },
        {
          kind: 'number', unit: 'cm²',
          body: 'A circle has radius 5 cm. What is its area? (1 decimal place)',
          widget: circleFig(1, 'r = 5', 'r'),
          answer: Math.PI * 25, tol: 0.2,
          hint: 'π × r × r.',
          explain: 'π × 5² = 25π ≈ 78.5 cm².',
        },
        {
          kind: 'choice',
          body: 'Same price: one 16-inch pizza, or two 10-inch pizzas? (Sizes are diameters.) Which is more pizza?',
          widget: circlesRow([16, 10, 10], ['16"', '10"', '10"']),
          options: [
            { text: 'The one 16-inch pizza', correct: true },
            { text: 'The two 10-inch pizzas', why: '20 inches of diameter beats 16, but area grows with the square: 2 × π × 5² ≈ 157 in², against π × 8² ≈ 201 in².' },
            { text: 'About the same', why: '201 in² against 157 in²: the big one is almost 30% more.' },
          ],
          explain: 'Big: π × 8² ≈ 201 in². Two small: 2 × π × 5² ≈ 157 in². Doubling the diameter quadruples the area.',
        },
        {
          kind: 'sort',
          body: 'Circumference or area: which do you need?',
          bins: ['Circumference', 'Area'],
          items: [
            { text: 'Fence around a round pond', bin: 0 }, { text: 'Ribbon around a cake', bin: 0 }, { text: 'Distance a wheel rolls per turn', bin: 0 },
            { text: 'Paint for a round tabletop', bin: 1 }, { text: 'Grass seed for a circular lawn', bin: 1 }, { text: 'How much pizza you get', bin: 1 },
          ],
          hint: 'Going around (a length), or covering (a surface)?',
          explain: 'Going around the edge is a length: circumference, 2πr. Covering the inside is a surface: area, πr².',
        },
        {
          kind: 'match',
          body: 'Match each quantity to its formula, for a circle of radius r.',
          heads: ['Quantity', 'Formula'],
          pairs: [['Diameter', '2r'], ['Circumference', '2πr'], ['Area', 'πr²'], ['Half the circumference', 'πr']],
          hint: 'Only one of them is measured in square units.',
          explain: 'd = 2r, C = πd = 2πr, half of that is πr (the width of the sliced rectangle), and the area is πr².',
        },
        {
          kind: 'number',
          body: 'You double the radius of a circle. Its area gets multiplied by…',
          widget: circlesRow([2, 4], ['r', '2r']),
          answer: 4,
          hint: 'π × (2r)² = ?',
          explain: 'π(2r)² = 4πr²: ×4. The circumference only doubles. Lengths and areas scale differently, which is the whole story of lesson 6.',
        },
      ],
      practice: [genCircumference, genCircleArea, genPizza],
    },

    // ------------------------------------------------------------ 5
    {
      id: 'similarity',
      title: 'Similarity and scale',
      goal: 'Use matching ratios to measure what you can’t reach: shadows, maps, models.',
      steps: [
        {
          kind: 'number', unit: 'm',
          body: 'A 2 m stick casts a 3 m shadow. At the same moment a tree casts an 18 m shadow. How tall is the tree?',
          widget: shadowFig(2, 3, 18),
          answer: 12,
          hint: 'How many times longer is the tree’s shadow?',
          explain: 'The tree’s shadow is 6 times as long (18 ÷ 3), so the tree is 6 times as tall: 6 × 2 = 12 m. The sun’s rays are parallel, so the two triangles have the same angles.',
        },
        {
          kind: 'read',
          title: 'Similar shapes',
          body: 'Two shapes are **similar** when one is a scaled copy of the other: the same angles, and every length multiplied by the same **scale factor** k. The ratio of any two sides inside one shape is the same in the other.',
          widget: scaleExplorer,
        },
        {
          kind: 'choice',
          body: 'You stretch a photo to twice its width but keep its height. Is the result similar to the original?',
          options: [
            { text: 'No: widths doubled but heights didn’t', correct: true },
            { text: 'Yes: it’s the same picture, just bigger', why: 'Bigger in one direction only. Faces look fat because the width-to-height ratio changed.' },
            { text: 'Yes, as long as the angles of the frame are still 90°', why: 'Every rectangle has 90° corners; matching angles isn’t enough for rectangles. The side ratio must match too.' },
          ],
          explain: 'Similar means one scale factor in **every** direction. Doubling only the width changes every ratio of width to height.',
        },
        {
          kind: 'multi',
          body: 'Which pairs are **always** similar, whatever their sizes?',
          options: [
            { text: 'Two squares', correct: true },
            { text: 'Two circles', correct: true },
            { text: 'Two equilateral triangles', correct: true },
            { text: 'Two rectangles', why: 'A long thin strip and a square are both rectangles but different shapes.' },
            { text: 'Two right-angled triangles', why: 'One right angle each, but the other angles can differ: a 3-4-5 and a thin 1-10 triangle aren’t scaled copies.' },
            { text: 'Two regular hexagons', correct: true },
          ],
          hint: 'Does the shape have one fixed form, or can it be long and thin?',
          explain: 'Squares, circles, equilateral triangles and any regular polygons with the same number of sides have only one shape: they differ only in size. Rectangles and right triangles come in many shapes.',
        },
        {
          kind: 'number', unit: 'km',
          body: 'A walking map has scale 1:50,000. Two huts are 4 cm apart on the map. How far apart are they really?',
          answer: 2,
          hint: '1 cm on the map is 50,000 cm on the ground. 100,000 cm = 1 km.',
          explain: '4 × 50,000 = 200,000 cm = 2,000 m = 2 km.',
        },
        {
          kind: 'order',
          body: 'Order these map scales from **most detailed** (most zoomed in) to least.',
          items: ['1:1,250', '1:25,000', '1:50,000', '1:250,000', '1:1,000,000'],
          hint: '1:1,250 means 1 cm on the map is 1,250 cm on the ground.',
          explain: 'The smaller the second number, the less ground each cm covers, so the more detail. A 1:1,250 plan shows single houses; a 1:1,000,000 map shows whole countries.',
        },
        {
          kind: 'point',
          body: 'Enlarge triangle ABC by scale factor 3 from the origin O. A′ and B′ are drawn. Place C′.',
          plot: { x: [0, 10], y: [0, 7], equal: true, grid: true, ticks: [1, 1], size: [420, 340], layers: [
            poly([[1, 1], [3, 1], [1, 2]], 'var(--c1)'),
            { type: 'dots', pts: [[1, 1], [3, 1], [1, 2]], labels: ['A', 'B', 'C'], color: 'var(--c1)' },
            { type: 'dots', pts: [[3, 3], [9, 3]], labels: ['A′', 'B′'], color: 'var(--c2)' },
            { type: 'line', pts: [[0, 0], [9, 3]], color: 'var(--muted)', dash: true }, { type: 'line', pts: [[0, 0], [3, 3]], color: 'var(--muted)', dash: true },
            { type: 'dots', pts: [[0, 0]], labels: ['O'], color: 'var(--text)' }] },
          answer: { x: 3, y: 6 }, tol: 0.3, snap: 1,
          hint: 'Multiply both coordinates of C(1, 2) by 3.',
          explain: 'C′ = (3 × 1, 3 × 2) = (3, 6). The image is 3× as far from O along the same line, and every side of A′B′C′ is 3× as long.',
        },
        {
          kind: 'number', unit: 'm',
          body: 'A 1:18 scale model car is 25 cm long. How long is the real car, in metres?',
          answer: 4.5,
          hint: 'Real = 18 × model.',
          explain: '18 × 25 cm = 450 cm = 4.5 m.',
        },
        {
          kind: 'fill',
          body: 'Complete the rule.',
          template: 'If two shapes are similar with scale factor k, each length in the big one is [[0]] × the matching length in the small one, and matching angles are [[1]].',
          blanks: [{ options: ['k', 'k²', 'k + 1'], answer: 0 }, { options: ['equal', 'multiplied by k', 'halved'], answer: 0 }],
          hint: 'Scaling stretches lengths; does it bend corners?',
          explain: 'Lengths × k; angles unchanged. (Areas are a different story: × k². Coming up next lesson.)',
        },
        {
          kind: 'estimate',
          body: 'At arm’s length (60 cm from your eye) your thumb, 2 cm wide, just covers a car 4 m long. About how far away is the car?',
          widget: thumbFig,
          min: 0, max: 400, step: 5, answer: 120, tol: 15, format: (v) => `${v} m`,
          hint: 'The car is how many times wider than your thumb? It’s that many times further away.',
          explain: 'Similar triangles from your eye: the car is 400 cm ÷ 2 cm = 200 times wider, so 200 × 60 cm = 12,000 cm = 120 m away.',
        },
      ],
      practice: [genShadow, genMap, genEnlarge],
    },

    // ------------------------------------------------------------ 6
    {
      id: 'square-cube',
      title: 'The square-cube law',
      goal: 'Predict how area and volume change when things are scaled, and what that means for giants and ice cubes.',
      steps: [
        {
          kind: 'choice',
          body: 'A sugar cube is 1 cm on each side. How many sugar cubes do you need to build a cube 2 cm on each side?',
          widget: cubeW(2, 2),
          options: [
            { text: '8', correct: true },
            { text: '2', why: 'That doubles only one direction, a 2 × 1 × 1 bar. A cube doubles length, width and height.' },
            { text: '4', why: '4 makes one 2 × 2 layer. A cube needs two layers.' },
            { text: '6', why: '6 is the number of faces, not of cubes inside.' },
          ],
          explain: '2 × 2 × 2 = 8. Doubling every length multiplies the volume by 8.',
        },
        {
          kind: 'task',
          body: 'Grow the cube until it needs **64** sugar cubes. Watch how fast the surface and the volume grow.',
          widget: cubeExplorer,
          hint: 'You need side × side × side = 64.',
          explain: 'Side 4: 4 × 4 × 4 = 64 cubes. Its surface is 6 × 16 = 96 squares. Side ×4 gave surface ×16 but volume ×64.',
        },
        {
          kind: 'read',
          title: 'Lengths, areas, volumes',
          body: 'Scale a shape by k in every direction:\n\n- lengths × **k**\n- areas × **k²**\n- volumes (and weights) × **k³**\n\nThat holds for any shape, not just cubes, because any shape can be built from tiny cubes.',
          widget: () => dataTable(['Scale k', 'Length', 'Area', 'Volume'], [[1, '×1', '×1', '×1'], [2, '×2', '×4', '×8'], [3, '×3', '×9', '×27'], [10, '×10', '×100', '×1,000']], { highlight: [3] }),
        },
        {
          kind: 'number',
          body: 'A sculptor makes a statue 3 times as tall as her clay model, with the same proportions. The model took 1 tin of paint to cover. How many tins for the statue?',
          answer: 9,
          hint: 'Paint covers a surface.',
          explain: 'Surface area grows with k²: 3² = 9 tins.',
        },
        {
          kind: 'number',
          body: 'Same statue, cast solid in the same material as the model. How many times heavier is it?',
          answer: 27,
          hint: 'Weight follows volume.',
          explain: 'Volume grows with k³: 3³ = 27 times heavier.',
        },
        {
          kind: 'read',
          title: 'Why giants can’t exist',
          body: 'A bone’s strength depends on its **cross-section**, an area: × k². The weight it carries is a volume: × k³. Scale a person up 10× and their weight is ×1,000 but their bones are only ×100 stronger. Each bit of bone carries **10×** the load. The gap grows with every step up in size.',
          widget: () => plotEl({ x: [1, 10], y: [0, 1000], xlabel: 'scale k', ylabel: 'times original', size: [520, 300], layers: [
            { type: 'fn', f: (k) => k ** 3, label: 'weight k³', color: 'var(--c2)' }, { type: 'fn', f: (k) => k * k, label: 'bone strength k²', color: 'var(--c1)' }] }),
        },
        {
          kind: 'choice',
          body: 'A giant is exactly like a human but 10 times as tall in every direction. Compared with ours, the stress on each square centimetre of its leg bones is…',
          options: [
            { text: 'About 10 times as much', correct: true },
            { text: 'The same: everything is in proportion', why: 'Proportions stay the same, but areas and volumes scale differently. Weight outgrows bone strength.' },
            { text: 'About 100 times as much', why: '100 is how much stronger the bones get (k²). The load grows 1,000×, so stress is 1,000 ÷ 100 = 10×.' },
            { text: 'About 1,000 times as much', why: '1,000 is the weight increase, but it’s spread over 100× as much bone area.' },
          ],
          explain: 'Stress = load ÷ area = k³ ÷ k² = k = 10. That’s why big animals like elephants have relatively thick legs.',
        },
        {
          kind: 'sort',
          body: 'Scale an animal up by k. Which of these grow like an area (× k²) and which like a volume (× k³)?',
          bins: ['Area (× k²)', 'Volume (× k³)'],
          items: [
            { text: 'Skin, through which it loses heat', bin: 0 }, { text: 'Strength of its bones', bin: 0 }, { text: 'Air resistance when it falls', bin: 0 },
            { text: 'Its weight', bin: 1 }, { text: 'Blood in its body', bin: 1 }, { text: 'Heat its body holds', bin: 1 },
          ],
          hint: 'Is it about a surface or a cross-section, or about how much stuff is inside?',
          explain: 'Surfaces and cross-sections (skin, bone sections, drag) go with k². Amounts of stuff (weight, blood, stored heat) go with k³.',
        },
        {
          kind: 'read',
          title: 'Small things have more surface',
          body: 'A cube of side s has surface 6s² and volume s³, so **6 ÷ s** units of surface for every unit of volume. Halve the size, double the surface per unit volume. Small things heat up, cool down, dry out and dissolve faster.',
          widget: () => barChart([1, 2, 4, 8].map((s) => ({ label: `side ${s}`, value: 6 / s })), { title: 'surface ÷ volume for a cube', format: (v) => num(v) }),
        },
        {
          kind: 'number',
          body: 'Cut a 1 cm ice cube into little cubes 1 mm on a side. How many times more surface does the ice have in total?',
          widget: iceFig,
          answer: 10,
          hint: 'There are 10 × 10 × 10 = 1,000 little cubes. What’s the surface of each, in mm²?',
          explain: 'Before: 6 cm² = 600 mm². After: 1,000 cubes × 6 mm² = 6,000 mm². Ten times as much surface for the same ice, which is why crushed ice cools a drink (and melts) faster.',
        },
        {
          kind: 'multi',
          body: 'Which of these does the square-cube law help explain?',
          options: [
            { text: 'A mouse can survive a fall that would kill a horse', correct: true },
            { text: 'Shrews must eat almost constantly to stay warm', correct: true },
            { text: 'Crushed ice cools a drink faster than one big cube', correct: true },
            { text: 'Elephants have thicker legs, relative to their size, than gazelles', correct: true },
            { text: 'A person twice as tall weighs about twice as much', why: 'That’s the mistake the law corrects: twice as tall in every direction weighs about 2³ = 8 times as much.' },
            { text: 'A scale model of a bridge is exactly as strong, relative to its weight, as the real one', why: 'The reverse: the small model is relatively much stronger, which is why engineers can’t simply test models.' },
          ],
          explain: 'Falls: drag (area) is large compared with weight (volume) for small animals. Shrews: lots of skin per gram loses heat fast. Ice: more surface. Legs: weight outgrows bone. The last two claims are false.',
        },
        {
          kind: 'estimate',
          body: 'A 150 kg gorilla, scaled up 10 times in every direction (a King Kong), would weigh about how many **tonnes**? (1 tonne = 1,000 kg)',
          min: 0, max: 300, step: 5, answer: 150, tol: 10, format: (v) => `${v} t`,
          hint: 'Weight × 10³.',
          explain: '150 kg × 1,000 = 150,000 kg = 150 tonnes. Its bones, only 100× stronger, would carry 10× the stress of a real gorilla’s.',
        },
      ],
      practice: [genScaleFactor, genSAV, genModelMass],
    },

    // ------------------------------------------------------------ 7
    {
      id: 'transformations',
      title: 'Coordinates and transformations',
      goal: 'Translate, reflect and rotate shapes on a grid, and spot symmetry.',
      steps: [
        {
          kind: 'point',
          body: 'Slide this triangle 3 right and 2 up. Where does corner A(1, 1) land?',
          plot: grid([poly([[1, 1], [3, 1], [1, 3]], 'var(--c1)'), { type: 'dots', pts: [[1, 1]], labels: ['A'], color: 'var(--c1)' }, { type: 'arrow', from: [1, 1], to: [4, 3], color: 'var(--muted)' }]),
          answer: { x: 4, y: 3 }, tol: 0.3, snap: 1,
          hint: 'Right adds to x, up adds to y.',
          explain: '(1 + 3, 1 + 2) = (4, 3).',
        },
        {
          kind: 'read',
          title: 'Translation',
          body: 'A **translation** slides every point by the same amount: (x, y) → (x + a, y + b). The shape keeps its size, its angles and the way it faces.',
        },
        {
          kind: 'task',
          body: 'Translate the blue triangle onto the dashed outline.',
          widget: translateTask,
          hint: 'Compare one corner: the bottom-left corner starts at (−4, 1). Where is it on the outline?',
          explain: 'The corner (−4, 1) must go to (1, −2): 5 right and 3 down, (x, y) → (x + 5, y − 3). The same move works for every point.',
        },
        {
          kind: 'point',
          body: 'Reflect P(2, 3) in the y-axis. Place its image.',
          plot: grid([{ type: 'vline', x: 0, color: 'var(--c4)', label: 'mirror' }, { type: 'dots', pts: [[2, 3]], labels: ['P'], color: 'var(--c1)' }]),
          answer: { x: -2, y: 3 }, tol: 0.3, snap: 1,
          hint: 'P is 2 in front of the mirror. Its image is 2 behind.',
          explain: 'Same height, other side: (−2, 3). Reflecting in the y-axis flips the sign of x.',
        },
        {
          kind: 'read',
          title: 'Reflections',
          body: 'A **reflection** flips every point across a mirror line, the same distance on the other side.\n\n- in the y-axis: (x, y) → (−x, y)\n- in the x-axis: (x, y) → (x, −y)\n- in the line y = x: (x, y) → (y, x)\n\nSizes and angles stay; the shape comes out **mirror-reversed**.',
          widget: () => plotEl(grid([
            { type: 'vline', x: 0, color: 'var(--c4)', label: 'mirror: y-axis' },
            poly([[1, 1], [4, 1], [4, 2], [2, 2], [2, 4], [1, 4]], 'var(--c1)'),
            poly([[-1, 1], [-4, 1], [-4, 2], [-2, 2], [-2, 4], [-1, 4]], 'var(--c2)')])),
        },
        {
          kind: 'point',
          body: 'Reflect A(4, 1) in the line y = x. Place its image.',
          plot: grid([{ type: 'fn', f: (t) => t, color: 'var(--c4)', dash: true, label: 'y = x' }, { type: 'dots', pts: [[4, 1]], labels: ['A'], color: 'var(--c1)' }]),
          answer: { x: 1, y: 4 }, tol: 0.3, snap: 1,
          hint: 'The mirror is diagonal: across becomes up and up becomes across.',
          explain: 'Reflecting in y = x swaps the coordinates: (4, 1) → (1, 4).',
        },
        {
          kind: 'point',
          body: 'Rotate P(3, 1) by 90° **counter-clockwise** about the origin O. Place its image.',
          plot: grid([{ type: 'line', pts: [[0, 0], [3, 1]], color: 'var(--c1)' }, { type: 'dots', pts: [[0, 0], [3, 1]], labels: ['O', 'P'], color: 'var(--c1)' }]),
          answer: { x: -1, y: 3 }, tol: 0.3, snap: 1,
          hint: 'Turn the arrow OP a quarter-turn left: 3 across, 1 up becomes 3 up, 1 back.',
          explain: 'A quarter turn left sends (x, y) to (−y, x): (3, 1) → (−1, 3).',
        },
        {
          kind: 'read',
          title: 'Rotations',
          body: 'A **rotation** turns every point around a centre by the same angle. About the origin:\n\n- 90° counter-clockwise: (x, y) → (−y, x)\n- 180°: (x, y) → (−x, −y)\n- 90° clockwise: (x, y) → (y, −x)',
          widget: rotStepper,
        },
        {
          kind: 'match',
          body: 'Match each rule to the move it makes.',
          heads: ['Rule', 'Move'],
          pairs: [
            ['(x, y) → (x + 3, y)', 'Translate 3 right'], ['(x, y) → (−x, y)', 'Reflect in the y-axis'], ['(x, y) → (x, −y)', 'Reflect in the x-axis'],
            ['(x, y) → (−y, x)', 'Rotate 90° counter-clockwise'], ['(x, y) → (−x, −y)', 'Rotate 180°'],
          ],
          hint: 'Try each rule on the point (1, 0), or (2, 1).',
          explain: 'Plug in (2, 1): (5, 1) slides right, (−2, 1) flips left-right, (2, −1) flips up-down, (−1, 2) turns a quarter left, (−2, −1) turns half way.',
        },
        {
          kind: 'choice',
          body: 'Reflect a flag in mirror 1, then reflect the image in mirror 2 (parallel, 2 units further right). What single move takes the original flag to the final one?',
          widget: flagTwice,
          options: [
            { text: 'A translation, 4 units right', correct: true },
            { text: 'A translation, 2 units right', why: 'Each reflection moves it across its own mirror; together the move is twice the gap between the mirrors.' },
            { text: 'A reflection in some other line', why: 'Two reflections reverse the flag twice, so the final flag faces the original way. A single reflection would leave it reversed.' },
            { text: 'A rotation by 180°', why: 'A half-turn would turn the flag upside down. Two reflections in parallel mirrors keep it upright.' },
          ],
          explain: 'Two flips undo the mirror-reversal, leaving a pure slide of twice the gap: 2 × 2 = 4. (Two mirrors that cross instead give a rotation by twice the angle between them.)',
        },
        {
          kind: 'sort',
          body: 'A line of symmetry folds a shape exactly onto itself. Sort these shapes by how many they have.',
          bins: ['None', 'Exactly one', 'More than one'],
          items: [
            { text: 'Scalene triangle (all sides different)', bin: 0 }, { text: 'Parallelogram that isn’t a rectangle or rhombus', bin: 0 },
            { text: 'Isosceles triangle (not equilateral)', bin: 1 }, { text: 'Kite (not a rhombus)', bin: 1 },
            { text: 'Rectangle (not a square)', bin: 2 }, { text: 'Equilateral triangle', bin: 2 }, { text: 'Regular hexagon', bin: 2 },
          ],
          hint: 'The parallelogram is the trap: it has rotational symmetry, but does any fold work?',
          explain: 'Rectangle: 2. Equilateral triangle: 3. Regular hexagon: 6. Isosceles triangle and kite: 1 each. A parallelogram looks the same after a half-turn but no fold lines it up: 0.',
        },
        {
          kind: 'multi',
          body: 'After any rotation or reflection, which of these are guaranteed to be unchanged?',
          options: [
            { text: 'Side lengths', correct: true },
            { text: 'Angles', correct: true },
            { text: 'Area', correct: true },
            { text: 'Where the shape is', why: 'Rotations and reflections usually move the shape somewhere else.' },
            { text: 'Clockwise order of the corners', why: 'A reflection reverses it: corners A, B, C going clockwise come out going counter-clockwise. Rotations keep it.' },
          ],
          explain: 'These moves are **rigid**: lengths, angles and area all survive. Position changes, and a reflection also reverses orientation, which is why your reflection raises its left hand when you raise your right.',
        },
      ],
      practice: [genTranslate, genReflect, genRotate],
    },

    // ------------------------------------------------------------ 8
    {
      id: 'estimating',
      title: 'Estimating space',
      goal: 'Convert areas and volumes correctly and make sensible Fermi estimates of size.',
      steps: [
        {
          kind: 'choice',
          body: 'How many square centimetres are in one square metre?',
          widget: squareMetre,
          options: [
            { text: '10,000', correct: true },
            { text: '100', why: 'That’s how many cm make a metre, along one edge. A square has 100 rows of 100.' },
            { text: '1,000', why: '1,000 is the factor for millimetres in a metre, or litres in a cubic metre, not cm² in m².' },
            { text: '1,000,000', why: 'That’s for volumes: there are 1,000,000 cm³ in a m³.' },
          ],
          explain: '1 m = 100 cm, so 1 m² is 100 cm × 100 cm = 10,000 cm². Area conversions square the length factor.',
        },
        {
          kind: 'read',
          title: 'Convert the length, then square or cube',
          body: 'Units for area and volume are lengths multiplied together, so the length factor gets multiplied in two or three times.',
          widget: () => dataTable(['Length', 'Area', 'Volume'], [
            ['1 m = 100 cm', '1 m² = 10,000 cm²', '1 m³ = 1,000,000 cm³'],
            ['1 cm = 10 mm', '1 cm² = 100 mm²', '1 cm³ = 1,000 mm³'],
            ['1 km = 1,000 m', '1 km² = 1,000,000 m²', ''],
          ]),
        },
        {
          kind: 'number', unit: 'cm³',
          body: 'A box is 10 cm × 10 cm × 10 cm inside. How many cubic centimetres does it hold?',
          widget: boxFig(10, 10, 10, ['10 cm', '10 cm', '10 cm']),
          answer: 1000,
          hint: 'Length × width × height.',
          explain: '10 × 10 × 10 = 1,000 cm³. That is exactly **1 litre**, and 1 cm³ is 1 millilitre.',
        },
        {
          kind: 'fill',
          body: 'Complete the conversions.',
          template: '1 m = 100 cm, so 1 m² = [[0]] cm² and 1 m³ = [[1]] cm³.',
          blanks: [{ options: ['100', '10,000', '1,000,000'], answer: 1 }, { options: ['1,000', '10,000', '1,000,000'], answer: 2 }],
          hint: 'Square for areas, cube for volumes.',
          explain: '100² = 10,000 and 100³ = 1,000,000.',
        },
        {
          kind: 'number', unit: 'litres',
          body: 'How many litres fill a cube 1 m on each side?',
          widget: cubeW(1, 1),
          answer: 1000,
          hint: 'A litre is a 10 cm cube. How many 10 cm cubes fit in a 1 m cube?',
          explain: '10 along each edge: 10 × 10 × 10 = 1,000 litres. (A cubic metre of water weighs about a tonne.)',
        },
        {
          kind: 'number', unit: 'litres',
          body: 'A swimming pool is 25 m long, 10 m wide and 2 m deep. How many litres of water does it hold when full?',
          widget: boxFig(25, 10, 2, ['25 m', '10 m', '2 m']),
          answer: 500000,
          hint: 'Cubic metres first, then × 1,000.',
          explain: '25 × 10 × 2 = 500 m³ = 500 × 1,000 = 500,000 litres.',
        },
        {
          kind: 'read',
          title: 'Fermi estimates',
          body: 'For a size you can’t look up, break it into pieces you can estimate, multiply, and round. Each guess can be rough; errors partly cancel.\n\n**How many people fit standing on a football pitch?** A pitch is about 105 m × 68 m. A packed crowd is about 4 people per m².',
          widget: () => dataTable(['Piece', 'Estimate'], [['Length', '≈ 105 m'], ['Width', '≈ 68 m'], ['Area', '≈ 7,000 m²'], ['People per m²', '≈ 4'], ['People', '≈ 28,000, say 30,000']], { highlight: [4] }),
        },
        {
          kind: 'estimate',
          body: 'An A4 sheet is exactly 1/16 of a square metre (that’s how A sizes are defined: A0 is 1 m², and each size is half the last). About how many A4 sheets would cover a 4 m × 5 m floor?',
          min: 0, max: 1000, step: 10, answer: 320, tol: 40,
          hint: 'Floor area in m², then 16 sheets per m².',
          explain: '4 × 5 = 20 m², and 20 × 16 = 320 sheets.',
        },
        {
          kind: 'order',
          body: 'Order these from smallest volume to largest.',
          items: ['A teaspoon', 'A coffee mug', 'A bucket', 'A bathtub', 'A shipping container', 'An Olympic swimming pool'],
          hint: 'Think in steps: millilitres, litres, cubic metres.',
          explain: 'Roughly: a teaspoon is 5 mL, a mug a few hundred mL, a bucket around 10 L, a bathtub a few hundred L, a shipping container tens of m³, an Olympic pool thousands of m³ (at least 50 × 25 × 2 = 2,500).',
        },
        {
          kind: 'estimate',
          body: 'A room is 4 m × 5 m × 2.5 m. Treating each basketball as taking up a 25 cm cube, about how many basketballs would fill it?',
          widget: boxFig(5, 4, 2.5, ['5 m', '4 m', '2.5 m']),
          min: 0, max: 10000, step: 100, answer: 3200, tol: 600,
          hint: 'How many 25 cm cubes fit in a 1 m cube? (4 along each edge.)',
          explain: 'The room is 4 × 5 × 2.5 = 50 m³. A 1 m cube holds 4 × 4 × 4 = 64 balls. 50 × 64 = 3,200 basketballs.',
        },
        {
          kind: 'multi',
          body: 'Which conversions are correct?',
          options: [
            { text: '1 km² = 1,000,000 m²', correct: true },
            { text: '1 hectare = 10,000 m²', correct: true },
            { text: '1 cm³ = 1 millilitre', correct: true },
            { text: '1 km² = 1,000 m²', why: '1,000 is the length factor. Squared: 1,000 × 1,000 = 1,000,000 m².' },
            { text: '1 m² = 100 cm²', why: 'Again the length factor alone. 100 × 100 = 10,000 cm².' },
            { text: '1 litre = 100 cm³', why: 'A litre is a 10 cm cube: 10 × 10 × 10 = 1,000 cm³.' },
          ],
          explain: 'A hectare is a 100 m × 100 m square, so 10,000 m². Whenever you convert an area or volume, square or cube the length factor.',
        },
        {
          kind: 'match',
          body: 'Match the equal amounts.',
          heads: ['This', 'equals'],
          pairs: [['1 km²', '100 hectares'], ['1 m³', '1,000 litres'], ['1 litre', '1,000 cm³'], ['1 m²', '10,000 cm²'], ['1 cm³', '1,000 mm³']],
          hint: 'A hectare is 100 m × 100 m.',
          explain: '1 km² is a 1,000 m square: 10 × 10 = 100 hectare squares fit in it. The rest: 10³ litres per m³, 10³ cm³ per litre, 100² cm² per m², 10³ mm³ per cm³.',
        },
      ],
      practice: [genConvert, genLitres, genFillConv],
    },
  ],
};
