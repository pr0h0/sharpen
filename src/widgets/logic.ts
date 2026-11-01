// Interactive pieces for logic lessons: truth tables to fill in, cards to turn over (Wason),
// and an elimination grid for who-owns-what puzzles. All are tasks: they report through ctx.solved.
import type { Widget } from '../types';
import { h } from '../ui';

const CELL = 'padding:.45em .3em;border-radius:8px;font-size:.95rem;min-width:0;';
const OFF = 'background:var(--panel2);color:var(--text);border:1px solid var(--line);';
const ON = 'background:var(--accent-default);color:#fff;border:1px solid transparent;';
const NO = 'background:var(--panel2);color:var(--muted);border:1px solid var(--line);';

// ---------------------------------------------------------------- truth table

export interface TruthTableOpts {
  /** Column names for the inputs, e.g. ['A', 'B']. */
  vars: string[];
  /** Header of the column the learner fills in. */
  out: string;
  /** The correct output for each row. */
  fn: (vals: boolean[]) => boolean;
  /** Labels for the input values (default T / F). */
  inYes?: string;
  inNo?: string;
  /** Labels for the output values the learner picks between (default T / F). */
  yes?: string;
  no?: string;
}

/** Every row of inputs (T first, as in the usual layout); tap the last cell to set its value. */
export function truthTable(o: TruthTableOpts): Widget {
  return (ctx) => {
    const n = o.vars.length;
    const rows: boolean[][] = [];
    for (let k = 0; k < 1 << n; k++) rows.push(o.vars.map((_, j) => !((k >> (n - 1 - j)) & 1)));
    const picked: (boolean | null)[] = rows.map(() => null);
    const [iy, ino, y, no] = [o.inYes ?? 'T', o.inNo ?? 'F', o.yes ?? 'T', o.no ?? 'F'];
    const grid = h('div', { style: `display:grid;grid-template-columns:repeat(${n + 1},minmax(0,1fr));gap:6px;max-width:${110 * (n + 1)}px;margin:0 auto;text-align:center;` });
    const head = (t: string) => h('div', { style: 'font-weight:700;color:var(--muted);font-size:.9rem;align-self:end;padding-bottom:2px;' }, t);
    for (const v of o.vars) grid.appendChild(head(v));
    grid.appendChild(head(o.out));
    const update = () => ctx.solved?.(rows.every((r, k) => picked[k] === o.fn(r)));
    rows.forEach((r, k) => {
      for (const v of r) grid.appendChild(h('div', { style: `${CELL}${v ? 'font-weight:600;' : 'color:var(--muted);'}border:1px solid var(--line);` }, v ? iy : ino));
      const b = h('button', {
        style: CELL + OFF,
        'aria-label': `row ${k + 1}: ${o.out}`,
        onclick: () => {
          picked[k] = picked[k] === null ? true : !picked[k];
          b.textContent = picked[k] ? y : no;
          b.setAttribute('style', CELL + (picked[k] ? ON : NO));
          update();
        },
      }, '?');
      grid.appendChild(b);
    });
    return h('div', null, grid, h('div', { class: 'muted small', style: 'text-align:center;margin-top:8px;' }, `Tap a cell in the last column to switch it between ${y} and ${no}.`));
  };
}

// ---------------------------------------------------------------- cards (Wason)

/** Cards lying face up; tap to mark the ones you'd turn over. Solved when exactly `answer` is marked. */
export function cardPicker(cards: string[], answer: boolean[]): Widget {
  return (ctx) => {
    const sel = cards.map(() => false);
    const CARD = 'width:96px;min-height:124px;padding:8px;border-radius:12px;font-weight:700;font-size:1.05rem;line-height:1.25;';
    const row = h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:4px 0;' });
    const stats = h('div', { class: 'w-stats', style: 'justify-content:center;' });
    const update = () => {
      const k = sel.filter(Boolean).length;
      stats.replaceChildren(h('span', null, h('strong', null, String(k)), ` card${k === 1 ? '' : 's'} to turn over`));
      ctx.solved?.(sel.every((s, i) => s === answer[i]));
    };
    cards.forEach((c, i) => {
      const b = h('button', {
        style: CARD + 'background:var(--panel2);color:var(--text);border:2px solid var(--line);',
        'aria-pressed': 'false',
        onclick: () => {
          sel[i] = !sel[i];
          b.setAttribute('aria-pressed', String(sel[i]));
          b.setAttribute('style', CARD + (sel[i]
            ? 'background:color-mix(in srgb, var(--accent-default) 14%, var(--panel));color:var(--text);border:2px solid var(--accent-default);transform:translateY(-4px);'
            : 'background:var(--panel2);color:var(--text);border:2px solid var(--line);'));
          update();
        },
      }, c);
      row.appendChild(b);
    });
    // Show the count without judging until the learner has touched something.
    stats.replaceChildren(h('span', null, 'Tap a card to mark it'));
    return h('div', null, row, stats);
  };
}

// ---------------------------------------------------------------- elimination grid

/**
 * Rows (people) against columns (things). Tap a cell once for ✗, twice for ✓, a third time to clear.
 * Solved when the ✓s are exactly the solution: `answer[r]` is the column that row r matches.
 */
export function elimGrid(rows: string[], cols: string[], answer: number[]): Widget {
  return (ctx) => {
    const state = rows.map(() => cols.map(() => 0)); // 0 blank, 1 ✗, 2 ✓
    const grid = h('div', { style: `display:grid;grid-template-columns:auto repeat(${cols.length},minmax(0,1fr));gap:5px;max-width:${90 + 86 * cols.length}px;margin:0 auto;align-items:center;` });
    grid.appendChild(h('div'));
    for (const c of cols) grid.appendChild(h('div', { style: 'font-weight:700;color:var(--muted);font-size:.85rem;text-align:center;overflow-wrap:anywhere;line-height:1.2;' }, c));
    const stats = h('div', { class: 'w-stats', style: 'justify-content:center;' });
    const look = (v: number) => CELL + 'aspect-ratio:1;font-size:1.2rem;font-weight:800;' + (v === 2 ? 'background:var(--good-bg);color:var(--good);border:1px solid var(--good);' : v === 1 ? 'background:var(--panel2);color:var(--bad);border:1px solid var(--line);' : OFF);
    const update = () => {
      const ticks = state.reduce((s, r) => s + r.filter((v) => v === 2).length, 0);
      stats.replaceChildren(h('span', null, h('strong', null, String(ticks)), ` of ${rows.length} matches ticked`));
      ctx.solved?.(state.every((r, i) => r.every((v, j) => (v === 2) === (answer[i] === j))));
    };
    rows.forEach((name, i) => {
      grid.appendChild(h('div', { style: 'font-weight:700;padding-right:6px;font-size:.95rem;' }, name));
      cols.forEach((c, j) => {
        const b = h('button', {
          style: look(0),
          'aria-label': `${name}, ${c}: blank`,
          onclick: () => {
            state[i][j] = (state[i][j] + 1) % 3;
            const v = state[i][j];
            b.textContent = v === 2 ? '✓' : v === 1 ? '✗' : '';
            b.setAttribute('style', look(v));
            b.setAttribute('aria-label', `${name}, ${c}: ${v === 2 ? 'yes' : v === 1 ? 'no' : 'blank'}`);
            update();
          },
        }, '');
        grid.appendChild(b);
      });
    });
    stats.replaceChildren(h('span', null, 'Tap once for ✗ (ruled out), twice for ✓ (match), again to clear'));
    return h('div', null, grid, stats);
  };
}
