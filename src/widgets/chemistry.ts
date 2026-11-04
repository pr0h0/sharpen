// Pictures and tools for Chemistry by Numbers: a formula parser and equation balancer (used by the
// course to compute its numbers), Bohr atoms, an atom builder, a mini periodic table, a mole scale,
// an equation balancer task, a reaction box (limiting reagent), beakers for dilution, a pH scale,
// a gas box (PV = nRT), energy profiles and the energy spread of molecules. DOM/SVG only.
import type { Layer, Widget } from '../types';
import { gcd, h, num, seeded, svg } from '../ui';
import { explorer, plotExplorer } from '../viz/explore';

// ---------------------------------------------------------------- data

/** Lets plot-wrap pictures sit side by side in a flex row (plot-wrap is full width by default). */
const SIDE = 'width:auto;flex:0 1 auto;';

/** Rounded atomic masses (g/mol), the ones the course quotes. */
export const MASS: Record<string, number> = {
  H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28,
  P: 31, S: 32, Cl: 35.5, Ar: 40, K: 39, Ca: 40, Fe: 56, Cu: 63.5,
};
export const AVOGADRO = 6.022e23;
/** Gas constant in L·atm/(mol·K) and J/(mol·K). */
export const R_ATM = 0.08206, R_J = 8.314;
export const K0 = 273.15;

export interface El { z: number; sym: string; name: string }
export const ELEMENTS: El[] = [
  'H Hydrogen', 'He Helium', 'Li Lithium', 'Be Beryllium', 'B Boron', 'C Carbon', 'N Nitrogen', 'O Oxygen', 'F Fluorine', 'Ne Neon',
  'Na Sodium', 'Mg Magnesium', 'Al Aluminium', 'Si Silicon', 'P Phosphorus', 'S Sulfur', 'Cl Chlorine', 'Ar Argon', 'K Potassium', 'Ca Calcium',
].map((s, k) => { const [sym, name] = s.split(' '); return { z: k + 1, sym, name }; });
export const bySym = (s: string) => ELEMENTS.find((e) => e.sym === s)!;

/** Electron shells for up to 20 electrons: 2, 8, 8, then the 4th shell. */
export function shells(e: number): number[] {
  const out: number[] = [];
  for (const cap of [2, 8, 8, 8]) { if (e <= 0) break; out.push(Math.min(cap, e)); e -= cap; }
  return out;
}
/** Outer-shell electrons of a neutral atom (z ≤ 20). */
export const valence = (z: number) => { const s = shells(z); return s[s.length - 1]; };
const NOBLE = new Set([2, 10, 18]);
/** The usual ion charge: lose 1-3 outer electrons, or gain enough to reach 8. 0 for noble gases and group 14. */
export function ionCharge(z: number): number {
  if (NOBLE.has(z)) return 0;
  const v = valence(z);
  return v <= 3 ? v : v >= 5 ? v - 8 : 0;
}
/** "2+", "−", "3−" style superscript charge. */
export function chargeText(q: number): string {
  if (q === 0) return '';
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const m = Math.abs(q) === 1 ? '' : String(Math.abs(q)).split('').map((d) => SUP[+d]).join('');
  return m + (q > 0 ? '⁺' : '⁻');
}

// ---------------------------------------------------------------- formulas and equations

/** Atom counts of a formula such as "Ca(OH)2" or "C6H12O6". */
export function atoms(f: string): Record<string, number> {
  const stack: Record<string, number>[] = [{}];
  const re = /([A-Z][a-z]?)(\d*)|(\()|(\))(\d*)/g;
  let m: RegExpExecArray | null;
  const add = (to: Record<string, number>, s: string, c: number) => { to[s] = (to[s] ?? 0) + c; };
  while ((m = re.exec(f))) {
    if (m[1]) add(stack[stack.length - 1], m[1], Number(m[2] || 1));
    else if (m[3]) stack.push({});
    else { const g = stack.pop()!; const k = Number(m[5] || 1); for (const [s, c] of Object.entries(g)) add(stack[stack.length - 1], s, c * k); }
  }
  return stack[0];
}
/** Molar mass in g/mol from the rounded masses. */
export function molar(f: string): number {
  return Math.round(Object.entries(atoms(f)).reduce((a, [s, c]) => a + MASS[s] * c, 0) * 1e6) / 1e6;
}
/** "H2O" -> "H₂O". */
export const sub = (f: string) => f.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]);
/** "C6H12O6" -> "C6H12O6 = 6 × 12 + 12 × 1 + 6 × 16" style working. */
export function molarWorking(f: string): string {
  return Object.entries(atoms(f)).map(([s, c]) => (c === 1 ? `${num(MASS[s])}` : `${c} × ${num(MASS[s])}`)).join(' + ');
}

export interface Eq { l: string[]; r: string[] }
export const species = (eq: Eq) => [...eq.l, ...eq.r];
/** "2 H₂ + O₂ → 2 H₂O" (coefficients of 1 left out; '?' allowed). */
export function eqText(eq: Eq, c?: (number | string)[]): string {
  const term = (f: string, k: number) => { const v = c?.[k] ?? 1; return `${v === 1 ? '' : v + ' '}${sub(f)}`; };
  return `${eq.l.map((f, k) => term(f, k)).join(' + ')} → ${eq.r.map((f, k) => term(f, k + eq.l.length)).join(' + ')}`;
}
/** Atoms of each element on the left and right for given coefficients, in order of appearance. */
export function tally(eq: Eq, c: number[]): [string, number, number][] {
  const out = new Map<string, [number, number]>();
  species(eq).forEach((f, k) => {
    for (const [s, n] of Object.entries(atoms(f))) {
      const row = out.get(s) ?? [0, 0];
      row[k < eq.l.length ? 0 : 1] += n * c[k];
      out.set(s, row);
    }
  });
  return [...out].map(([s, [a, b]]) => [s, a, b]);
}
export const isBalanced = (eq: Eq, c: number[]) => tally(eq, c).every(([, a, b]) => a === b);
/** Smallest whole-number coefficients (brute force up to `max`). */
export function solve(eq: Eq, max = 9): number[] {
  const n = species(eq).length;
  const c = new Array(n).fill(1);
  for (;;) {
    if (isBalanced(eq, c) && c.reduce(gcd) === 1) return c.slice();
    let k = 0;
    while (k < n && c[k] === max) c[k++] = 1;
    if (k === n) throw new Error(`cannot balance ${eqText(eq)}`);
    c[k]++;
  }
}

// ---------------------------------------------------------------- atoms

/** A Bohr picture: nucleus with p and n, electrons on rings. */
export function atomSvg(p: number, n: number, e: number, size = 220): SVGElement {
  const s = svg('svg', { viewBox: '0 0 220 220', class: 'plot', style: `max-width:${size}px` });
  const sh = shells(e);
  sh.forEach((cnt, k) => {
    const r = 38 + k * 22;
    s.appendChild(svg('circle', { cx: 110, cy: 110, r, style: 'fill:none;stroke:var(--line);stroke-width:1.5' }));
    for (let j = 0; j < cnt; j++) {
      const a = (2 * Math.PI * j) / cnt - Math.PI / 2 + k * 0.3;
      s.appendChild(svg('circle', { cx: 110 + r * Math.cos(a), cy: 110 + r * Math.sin(a), r: 5, style: 'fill:var(--c1)' }));
    }
  });
  s.appendChild(svg('circle', { cx: 110, cy: 110, r: 24, style: 'fill:color-mix(in srgb, var(--c4) 30%, var(--panel2));stroke:var(--c4);stroke-width:1.5' }));
  s.appendChild(svg('text', { x: 110, y: 107, 'text-anchor': 'middle', class: 'plot-label', style: 'fill:var(--c4)' }, `${p}p`));
  s.appendChild(svg('text', { x: 110, y: 122, 'text-anchor': 'middle', class: 'tick' }, `${n}n`));
  return s;
}

export function atom(p: number, n: number, e: number, caption?: string): Widget {
  return () => h('div', { class: 'plot-wrap', style: 'text-align:center' }, atomSvg(p, n, e), caption ? h('div', { class: 'muted small' }, caption) : null);
}

/** Sliders for protons, neutrons and electrons; names what you built. With goal: build that exact atom or ion. */
export function atomBuilder(goal?: { p: number; n: number; e: number }, start = { p: 3, n: 4, e: 3 }): Widget {
  const name = (v: Record<string, number>) => {
    const el = ELEMENTS[v.p - 1], q = v.p - v.e;
    return `${el.name} (${el.sym}${chargeText(q)}) · mass number ${v.p + v.n} · charge ${q > 0 ? '+' : q < 0 ? '−' : ''}${Math.abs(q)}`;
  };
  return explorer({
    params: [
      { id: 'p', label: 'protons', min: 1, max: 20, step: 1, value: start.p },
      { id: 'n', label: 'neutrons', min: 0, max: 22, step: 1, value: start.n },
      { id: 'e', label: 'electrons', min: 0, max: 20, step: 1, value: start.e },
    ],
    draw: (v) => h('div', { class: 'plot-wrap', style: 'text-align:center' }, atomSvg(v.p, v.n, v.e, 200)),
    readout: name,
    goal: goal ? (v) => v.p === goal.p && v.n === goal.n && v.e === goal.e : undefined,
    goalText: goal ? `That’s it: ${goal.p} protons, ${goal.n} neutrons, ${goal.e} electrons.` : undefined,
  });
}

/** The first 20 elements in 8 columns (by outer electrons) and 4 rows (by shells). Tap one for its shells. */
export function periodicMini(): Widget {
  return () => {
    const info = h('div', { class: 'readout' }, 'Tap an element.');
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(8, minmax(0, 1fr));gap:4px;max-width:440px;margin:6px auto;' });
    for (const el of ELEMENTS) {
      const sh = shells(el.z), row = sh.length, v = valence(el.z);
      const col = NOBLE.has(el.z) ? 8 : v;
      const b = h('button', {
        class: 'ghost', style: `grid-row:${row};grid-column:${col};padding:4px 0;line-height:1.1;border-radius:8px;background:color-mix(in srgb, var(--c${NOBLE.has(el.z) ? 6 : ((v - 1) % 5) + 1}) 22%, var(--panel));`,
        onclick: () => { info.textContent = `${el.name}: ${el.z} electrons in shells ${sh.join(', ')} → ${NOBLE.has(el.z) ? 'full outer shell' : `${v} outer`}${ionCharge(el.z) ? `, usual ion ${el.sym}${chargeText(ionCharge(el.z))}` : ''}`; },
      }, h('div', { class: 'muted small' }, String(el.z)), h('strong', null, el.sym));
      grid.appendChild(b);
    }
    const heads = h('div', { style: 'display:grid;grid-template-columns:repeat(8, minmax(0, 1fr));gap:4px;max-width:440px;margin:0 auto;text-align:center;' },
      ['1', '2', '3', '4', '5', '6', '7', '8'].map((t) => h('span', { class: 'muted small' }, t)));
    return h('div', null, h('div', { class: 'muted small', style: 'text-align:center' }, 'outer electrons'), heads, grid, info);
  };
}

// ---------------------------------------------------------------- moles

/** 1.2e23 -> "1.20 × 10²³". */
export function sci(v: number, d = 2): string {
  const [m, e] = v.toExponential(d).split('e');
  return `${m} × 10${String(Number(e)).split('').map((c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]).join('')}`;
}

/** A kitchen scale with a slider for grams of one substance; readout in moles and particles. Goal: `goalMol`. */
export function moleScale(f: string, maxG: number, step: number, goalMol?: number, start = 0): Widget {
  const M = molar(f);
  return explorer({
    params: [{ id: 'g', label: 'grams', min: 0, max: maxG, step, value: start, format: (v) => `${num(v)} g` }],
    draw: (v) => {
      const s = svg('svg', { viewBox: '0 0 260 150', class: 'plot', style: 'max-width:300px' });
      const r = 6 + 34 * Math.cbrt(v.g / maxG);
      s.appendChild(svg('ellipse', { cx: 130, cy: 92 - r * 0.55, rx: r * 1.4, ry: r * 0.75, style: 'fill:color-mix(in srgb, var(--c2) 70%, var(--panel))' }));
      s.appendChild(svg('rect', { x: 50, y: 92, width: 160, height: 10, rx: 4, style: 'fill:var(--muted)' }));
      s.appendChild(svg('rect', { x: 70, y: 102, width: 120, height: 40, rx: 6, style: 'fill:var(--panel2);stroke:var(--line)' }));
      s.appendChild(svg('text', { x: 130, y: 129, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:18px;font-weight:700;font-variant-numeric:tabular-nums' }, `${v.g.toFixed(1)} g`));
      s.appendChild(svg('text', { x: 130, y: 20, 'text-anchor': 'middle', class: 'plot-label', style: 'fill:var(--text)' }, `${sub(f)}: ${num(M)} g/mol`));
      return h('div', { class: 'plot-wrap', style: 'text-align:center' }, s);
    },
    readout: (v) => `${num(v.g)} g ÷ ${num(M)} g/mol = ${num(v.g / M, 3)} mol ≈ ${v.g ? sci((v.g / M) * AVOGADRO) : '0'} particles`,
    goal: goalMol !== undefined ? (v) => Math.abs(v.g / M - goalMol) < 1e-6 : undefined,
    goalText: goalMol !== undefined ? `${num(goalMol)} mol of ${sub(f)}: ${num(goalMol * M)} g.` : undefined,
  });
}

// ---------------------------------------------------------------- balancing

/** Task: set the coefficients with − / + until every element balances, with the smallest whole numbers. */
export function balancer(eq: Eq): Widget {
  return (ctx) => {
    const sp = species(eq), c = sp.map(() => 1);
    const top = h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;margin:8px 0;' });
    const table = h('div');
    const note = h('div', { class: 'readout' });
    const draw = () => {
      top.replaceChildren(...sp.flatMap((f, k) => [
        k === eq.l.length ? h('span', { style: 'font-weight:800;font-size:1.3rem' }, '→') : k > 0 ? h('span', { style: 'font-weight:800;color:var(--muted)' }, '+') : null,
        h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--panel2);border-radius:10px;padding:4px 6px;' },
          h('button', { class: 'ghost small-btn', 'aria-label': `more ${f}`, onclick: () => { if (c[k] < 12) c[k]++; draw(); } }, '+'),
          h('div', { style: 'font-size:1.15rem;font-variant-numeric:tabular-nums' }, h('strong', { style: 'color:var(--c1)' }, String(c[k])), ' ', sub(f)),
          h('button', { class: 'ghost small-btn', 'aria-label': `fewer ${f}`, onclick: () => { if (c[k] > 1) c[k]--; draw(); } }, '−')),
      ].filter(Boolean) as HTMLElement[]));
      const rows = tally(eq, c);
      table.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['atom', 'left', 'right', ''].map((t) => h('th', null, t)))),
        h('tbody', null, rows.map(([s, a, b]) => h('tr', null, h('td', null, s), h('td', null, String(a)), h('td', null, String(b)),
          h('td', { style: `color:var(${a === b ? '--good' : '--bad'});font-weight:700` }, a === b ? '✓' : '✗')))))));
      const bal = isBalanced(eq, c), small = c.reduce(gcd) === 1;
      note.textContent = bal ? (small ? 'Balanced, with the smallest whole numbers.' : `Balanced, but every coefficient divides by ${c.reduce(gcd)}: make them smaller.`) : 'Not balanced yet.';
      ctx.solved?.(bal && small);
    };
    draw();
    return h('div', null, top, table, note);
  };
}

// ---------------------------------------------------------------- particles

const ATOM_COLOR: Record<string, string> = { H: 'var(--muted)', N: 'var(--c1)', O: 'var(--c4)', C: 'var(--text)', Cl: 'var(--c3)', Na: 'var(--c5)' };

/** Molecules of formula f drawn as touching atoms, centred at (x, y). */
function molecule(f: string, x: number, y: number): SVGElement {
  const g = svg('g');
  const list = Object.entries(atoms(f)).flatMap(([s, n]) => Array(n).fill(s) as string[]);
  // the heavier atom (first listed non-H) in the middle, the rest around it
  const centre = list.find((s) => s !== 'H') ?? list[0];
  const rest = list.slice(); rest.splice(rest.indexOf(centre), 1);
  const big = (s: string) => (s === 'H' ? 4.5 : 6.5);
  if (list.length === 2) {
    g.appendChild(svg('circle', { cx: x - 4.5, cy: y, r: big(list[0]), style: `fill:${ATOM_COLOR[list[0]] ?? 'var(--c6)'};stroke:var(--panel);stroke-width:1` }));
    g.appendChild(svg('circle', { cx: x + 4.5, cy: y, r: big(list[1]), style: `fill:${ATOM_COLOR[list[1]] ?? 'var(--c6)'};stroke:var(--panel);stroke-width:1` }));
    return g;
  }
  rest.forEach((s, k) => {
    const a = (2 * Math.PI * k) / rest.length - Math.PI / 2;
    g.appendChild(svg('circle', { cx: x + 7 * Math.cos(a), cy: y + 7 * Math.sin(a), r: big(s), style: `fill:${ATOM_COLOR[s] ?? 'var(--c6)'};stroke:var(--panel);stroke-width:1` }));
  });
  g.appendChild(svg('circle', { cx: x, cy: y, r: big(centre), style: `fill:${ATOM_COLOR[centre] ?? 'var(--c6)'};stroke:var(--panel);stroke-width:1` }));
  return g;
}

/** A box of molecules: groups [formula, count], laid out on a jittered grid. */
function particleBox(groups: [string, number][], title: string, seed = 7): SVGElement {
  const W = 200, H = 150;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H + 18}`, class: 'plot', style: `max-width:${W + 20}px` });
  s.appendChild(svg('rect', { x: 2, y: 2, width: W - 4, height: H - 4, rx: 8, style: 'fill:var(--panel2);stroke:var(--line)' }));
  const all = groups.flatMap(([f, n]) => Array(n).fill(f) as string[]);
  const cols = Math.max(4, Math.ceil(Math.sqrt(all.length * 1.4))), rows = Math.max(1, Math.ceil(all.length / cols));
  const rng = seeded(seed);
  all.forEach((f, k) => {
    const cx = ((k % cols) + 0.5) * ((W - 16) / cols) + 8 + (rng() - 0.5) * 6;
    const cy = (Math.floor(k / cols) + 0.5) * ((H - 16) / rows) + 8 + (rng() - 0.5) * 6;
    s.appendChild(molecule(f, cx, cy));
  });
  s.appendChild(svg('text', { x: W / 2, y: H + 14, 'text-anchor': 'middle', class: 'tick' }, title));
  return s;
}

/**
 * aA + bB → cC with sliders for the molecules of A and B: before and after pictures, the limiting
 * reagent and leftovers. Goal: exactly `goal` product molecules with nothing left over.
 */
export function reactionBox(eq: Eq, opts: { maxA: number; maxB: number; a0: number; b0: number; goal?: number }): Widget {
  const [ca, cb, cc] = solve(eq);
  const [A, B] = eq.l, C = eq.r[0];
  const react = (a: number, b: number) => { const runs = Math.min(Math.floor(a / ca), Math.floor(b / cb)); return { runs, c: runs * cc, la: a - runs * ca, lb: b - runs * cb }; };
  return explorer({
    params: [
      { id: 'a', label: `${sub(A)} molecules`, min: 0, max: opts.maxA, step: 1, value: opts.a0 },
      { id: 'b', label: `${sub(B)} molecules`, min: 0, max: opts.maxB, step: 1, value: opts.b0 },
    ],
    draw: (v) => {
      const r = react(v.a, v.b);
      return h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center' },
        h('div', { class: 'plot-wrap', style: SIDE }, particleBox([[A, v.a], [B, v.b]], 'before')),
        h('span', { style: 'font-weight:800;font-size:1.3rem' }, '→'),
        h('div', { class: 'plot-wrap', style: SIDE }, particleBox([[C, r.c], [A, r.la], [B, r.lb]], 'after', 11)));
    },
    readout: (v) => {
      const r = react(v.a, v.b);
      const lim = r.la < ca && r.lb < cb ? (r.la === 0 && r.lb === 0 ? 'nothing left over' : 'both nearly used up') : r.la < ca ? `${sub(A)} runs out first` : `${sub(B)} runs out first`;
      return `${eqText(eq, [ca, cb, cc])}: ${r.c} ${sub(C)} made · left over ${r.la} ${sub(A)}, ${r.lb} ${sub(B)} · ${lim}`;
    },
    goal: opts.goal !== undefined ? (v) => { const r = react(v.a, v.b); return r.c === opts.goal && r.la === 0 && r.lb === 0; } : undefined,
    goalText: opts.goal !== undefined ? `${opts.goal} ${sub(C)}, nothing wasted.` : undefined,
  });
}

// ---------------------------------------------------------------- solutions

/** A beaker filled to vol/cap, tinted by concentration (0..1 of the strongest shown). */
export function beakerSvg(vol: number, cap: number, strength: number, label: string): SVGElement {
  const s = svg('svg', { viewBox: '0 0 140 170', class: 'plot', style: 'max-width:150px' });
  const top = 20, bot = 140, hgt = (bot - top) * Math.min(1, vol / cap);
  s.appendChild(svg('rect', { x: 30, y: bot - hgt, width: 80, height: hgt, style: `fill:color-mix(in srgb, var(--c5) ${Math.round(8 + 80 * Math.min(1, strength))}%, var(--panel))` }));
  s.appendChild(svg('path', { d: `M26,${top - 6} L30,${top} L30,${bot} Q30,${bot + 4} 34,${bot + 4} L106,${bot + 4} Q110,${bot + 4} 110,${bot} L110,${top} L114,${top - 6}`, style: 'fill:none;stroke:var(--text);stroke-width:2' }));
  for (let k = 1; k < 5; k++) s.appendChild(svg('line', { x1: 30, y1: bot - (k * (bot - top)) / 5, x2: 40, y2: bot - (k * (bot - top)) / 5, style: 'stroke:var(--muted)' }));
  s.appendChild(svg('text', { x: 70, y: 162, 'text-anchor': 'middle', class: 'tick' }, label));
  return s;
}

/** Static beakers side by side: [volume mL, concentration, label]. */
export function beakers(items: [number, number, string][], cap: number): Widget {
  const max = Math.max(...items.map((i) => i[1]));
  return () => h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center' },
    items.map(([v, c, l]) => h('div', { class: 'plot-wrap', style: SIDE }, beakerSvg(v, cap, c / max, l))));
}

/**
 * Dilution: pour `stock` mL of a c0 M stock solution and add water. With target: make exactly
 * `target.v` mL at `target.c` M.
 */
export function dilution(c0: number, opts: { maxStock: number; maxWater: number; step: number; stock: number; water: number; target?: { c: number; v: number } }): Widget {
  const cap = opts.maxStock + opts.maxWater;
  return explorer({
    params: [
      { id: 's', label: 'stock', min: 0, max: opts.maxStock, step: opts.step, value: opts.stock, format: (v) => `${num(v)} mL` },
      { id: 'w', label: 'water', min: 0, max: opts.maxWater, step: opts.step, value: opts.water, format: (v) => `${num(v)} mL` },
    ],
    draw: (v) => {
      const tot = v.s + v.w, c = tot ? (c0 * v.s) / tot : 0;
      return h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap' },
        h('div', { class: 'plot-wrap', style: SIDE }, beakerSvg(cap * 0.5, cap, 1, `stock ${num(c0)} M`)),
        h('div', { class: 'plot-wrap', style: SIDE }, beakerSvg(tot, cap, c / c0, `${num(tot)} mL at ${num(c, 3)} M`)));
    },
    readout: (v) => {
      const tot = v.s + v.w;
      return tot ? `${num(c0)} M × ${num(v.s)} mL = C × ${num(tot)} mL  →  C = ${num((c0 * v.s) / tot, 3)} M (moles: ${num((c0 * v.s) / 1000, 3)})` : 'Empty beaker.';
    },
    goal: opts.target ? (v) => Math.abs(v.s + v.w - opts.target!.v) < 1e-9 && Math.abs((c0 * v.s) / (v.s + v.w) - opts.target!.c) < 1e-9 : undefined,
    goalText: opts.target ? `${num(opts.target.v)} mL at ${num(opts.target.c)} M.` : undefined,
  });
}

// ---------------------------------------------------------------- pH

export const PH_THINGS: [string, number][] = [['battery acid', 0.5], ['lemon juice', 2], ['coffee', 5], ['pure water', 7], ['baking soda', 9], ['ammonia', 11.5], ['bleach', 13]];

/** A colour bar from pH 0 to 14 with everyday things marked, and a marker at `ph`. */
export function phBar(ph: number | null, things = PH_THINGS): SVGElement {
  const W = 460, s = svg('svg', { viewBox: `0 0 ${W} 120`, class: 'plot', style: `max-width:${W}px` });
  const x = (p: number) => 20 + (p / 14) * (W - 40);
  const id = 'phg' + Math.random().toString(36).slice(2, 7);
  s.appendChild(svg('defs', {}, svg('linearGradient', { id }, ...['#d7263d', '#f46036', '#f9c80e', '#43b581', '#2e86ab', '#5c4d9e', '#3b1f6e'].map((c, k) => svg('stop', { offset: `${(k / 6) * 100}%`, 'stop-color': c })))));
  s.appendChild(svg('rect', { x: 20, y: 40, width: W - 40, height: 22, rx: 6, fill: `url(#${id})` }));
  for (let p = 0; p <= 14; p++) s.appendChild(svg('text', { x: x(p), y: 76, 'text-anchor': 'middle', class: 'tick' }, String(p)));
  things.forEach(([t, p], k) => {
    s.appendChild(svg('line', { x1: x(p), y1: 62, x2: x(p), y2: k % 2 ? 86 : 98, style: 'stroke:var(--muted)' }));
    s.appendChild(svg('text', { x: x(p), y: k % 2 ? 96 : 110, 'text-anchor': 'middle', class: 'tick', style: 'font-size:10px' }, t));
  });
  if (ph !== null) {
    s.appendChild(svg('path', { d: `M${x(ph)},38 l-7,-12 h14 z`, style: 'fill:var(--text)' }));
    s.appendChild(svg('text', { x: x(ph), y: 18, 'text-anchor': 'middle', class: 'plot-label', style: 'fill:var(--text)' }, `pH ${num(ph)}`));
  }
  return s;
}

/** Slider for pH; readout of [H⁺] and how it compares with pure water. */
export function phExplorer(): Widget {
  return explorer({
    params: [{ id: 'ph', label: 'pH', min: 0, max: 14, step: 1, value: 3 }],
    draw: (v) => h('div', { class: 'plot-wrap' }, phBar(v.ph)),
    readout: (v) => {
      const d = 7 - v.ph;
      return `[H⁺] = 10^−${v.ph} mol/L · ${d === 0 ? 'neutral' : d > 0 ? `${num(10 ** d)} × more H⁺ than pure water` : `1/${num(10 ** -d)} of the H⁺ in pure water`}`;
    },
  });
}

// ---------------------------------------------------------------- gases

/** Box of gas: sliders for amount, temperature and volume; P = nRT/V. With goal(P, v) it is a task. */
export function gasBox(o: { n: number; T: number; V: number; goal?: (v: Record<string, number>) => boolean; goalText?: string; lock?: ('n' | 'T' | 'V')[] }): Widget {
  const all = [
    { id: 'n', label: 'amount', min: 0.5, max: 4, step: 0.5, value: o.n, format: (v: number) => `${num(v)} mol` },
    { id: 'T', label: 'temperature', min: 150, max: 600, step: 25, value: o.T, format: (v: number) => `${v} K` },
    { id: 'V', label: 'volume', min: 10, max: 100, step: 5, value: o.V, format: (v: number) => `${v} L` },
  ];
  return explorer({
    params: all.filter((p) => !o.lock?.includes(p.id as 'n')),
    draw: (v0) => {
      const v = { n: o.n, T: o.T, V: o.V, ...v0 };
      const W = 320, H = 150, w = 40 + (v.V / 100) * 260;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H + 10}`, class: 'plot', style: `max-width:${W}px` });
      s.appendChild(svg('rect', { x: 4, y: 10, width: w, height: H - 20, style: 'fill:var(--panel2);stroke:var(--text);stroke-width:2' }));
      s.appendChild(svg('rect', { x: w, y: 6, width: 8, height: H - 12, rx: 2, style: 'fill:var(--muted)' }));
      s.appendChild(svg('rect', { x: w + 8, y: H / 2 - 4, width: W - w - 12, height: 8, style: 'fill:var(--muted)' }));
      const rng = seeded(5), heat = Math.min(1, (v.T - 150) / 450);
      const col = `color-mix(in srgb, var(--c4) ${Math.round(heat * 100)}%, var(--c1))`;
      for (let k = 0; k < Math.round(v.n * 12); k++) {
        const x = 12 + rng() * (w - 16), y = 18 + rng() * (H - 36), a = rng() * 2 * Math.PI, L = 4 + 10 * Math.sqrt(v.T / 600);
        s.appendChild(svg('line', { x1: x, y1: y, x2: x - L * Math.cos(a), y2: y - L * Math.sin(a), style: `stroke:${col};stroke-width:1.5;opacity:.45` }));
        s.appendChild(svg('circle', { cx: x, cy: y, r: 3.5, style: `fill:${col}` }));
      }
      return h('div', { class: 'plot-wrap', style: 'text-align:center' }, s);
    },
    readout: (v0) => { const v = { n: o.n, T: o.T, V: o.V, ...v0 }; return `P = nRT/V = ${num(v.n)} × 0.08206 × ${v.T} ÷ ${v.V} = ${num((v.n * R_ATM * v.T) / v.V, 3)} atm`; },
    goal: o.goal ? (v0) => o.goal!({ n: o.n, T: o.T, V: o.V, ...v0 }) : undefined,
    goalText: o.goalText,
  });
}

// ---------------------------------------------------------------- energy

/** Energy along the reaction: reactants at 0, products at dH, a hump of height Ea above the reactants. */
export function profileFn(dH: number, Ea: number): (x: number) => number {
  const sig = (x: number) => 1 / (1 + Math.exp(-(x - 5) * 1.6));
  const bump = Ea - dH / 2;
  return (x) => dH * sig(x) + bump * Math.exp(-(((x - 5) / 1.3) ** 2));
}

export function profileLayers(dH: number, Ea: number, catEa?: number): Layer[] {
  const out: Layer[] = [
    { type: 'fn', f: profileFn(dH, Ea), color: 'var(--c1)' },
    { type: 'text', x: 1.2, y: 8, text: 'reactants', anchor: 'middle' },
    { type: 'text', x: 8.8, y: dH + 8, text: 'products', anchor: 'middle' },
  ];
  if (catEa !== undefined) out.splice(1, 0, { type: 'fn', f: profileFn(dH, catEa), color: 'var(--c3)', dash: true });
  return out;
}

/** Sliders for activation energy and ΔH; the energy profile redraws. */
export function profileExplorer(): Widget {
  return plotExplorer({
    params: [
      { id: 'Ea', label: 'activation energy', min: 20, max: 150, step: 10, value: 80, format: (v) => `${v} kJ` },
      { id: 'dH', label: 'ΔH', min: -100, max: 100, step: 10, value: -60, format: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} kJ` },
    ],
    spec: (v) => ({
      x: [0, 10], y: [-120, 170], size: [420, 260], ylabel: 'energy (kJ/mol)', xlabel: 'reaction progress', tickFormat: (t) => (t !== 0 && t % 50 === 0 ? String(t).replace('-', '−') : ''),
      layers: [{ type: 'hline', y: 0, color: 'var(--muted)' }, ...profileLayers(v.dH, Math.max(v.Ea, v.dH + 10))],
    }),
    readout: (v) => `${v.dH < 0 ? 'Exothermic: heat out' : v.dH > 0 ? 'Endothermic: heat in' : 'No net heat'} · the hump (${Math.max(v.Ea, v.dH + 10)} kJ) decides the speed, ΔH decides the heat`,
  });
}

/** Energy spread of molecules at temperature T (kelvin), in kJ/mol (Maxwell–Boltzmann shape). */
export const spread = (T: number) => (E: number) => {
  const kT = (R_J * T) / 1000;
  return E <= 0 ? 0 : 2 * Math.sqrt(E / Math.PI) * kT ** -1.5 * Math.exp(-E / kT);
};
/** Fraction of molecules with energy above Ea at T (numerical integral). */
export function fractionAbove(T: number, Ea: number): number {
  const f = spread(T), n = 4000, hi = Ea + 60;
  let s = 0;
  for (let i = 0; i < n; i++) { const e = Ea + ((i + 0.5) * (hi - Ea)) / n; s += f(e); }
  return (s * (hi - Ea)) / n;
}

/** Temperature slider over the energy spread, the tail past Ea shaded; readout compares with 300 K. */
export function spreadExplorer(Ea = 8): Widget {
  return plotExplorer({
    params: [{ id: 'T', label: 'temperature', min: 250, max: 500, step: 10, value: 300, format: (v) => `${v} K` }],
    spec: (v) => ({
      x: [0, 30], y: [0, 0.3], size: [420, 240], xlabel: 'energy of a collision (kJ/mol)', ylabel: 'share of molecules', tickFormat: (t) => (t > 0.0001 && t < 1 ? '' : String(t)),
      layers: [
        { type: 'fn', f: spread(300), color: 'var(--muted)', dash: true, width: 1.5 },
        { type: 'area', f: spread(v.T), from: Ea, to: 30, color: 'var(--c4)' },
        { type: 'fn', f: spread(v.T), color: 'var(--c1)', label: `${v.T} K` },
        { type: 'vline', x: Ea, color: 'var(--c4)', label: 'Ea' },
      ],
    }),
    readout: (v) => { const f = fractionAbove(v.T, Ea), f0 = fractionAbove(300, Ea); return `Past Ea: ${(f * 100).toFixed(2)}% of molecules · ${num(f / f0, 3)} × as many as at 300 K`; },
  });
}
