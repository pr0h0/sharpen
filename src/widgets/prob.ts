// Interactive pieces for probability lessons: coin flipper, dice grid, Monty Hall, dot arrays.
import type { Widget } from '../types';
import { h, svg, pct } from '../ui';

// ---------------------------------------------------------------- coin flipper

/** Flip coins and watch the share of heads settle toward 1/2 (the long run). */
export function coinFlipper(pHeads = 0.5): Widget {
  return () => {
    let flips = 0, heads = 0;
    const history: number[] = [];
    const W = 320, H = 120;
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const stats = h('div', { class: 'w-stats' });
    const last = h('div', { class: 'coin-row' });
    const draw = () => {
      chart.replaceChildren(
        svg('line', { x1: 0, x2: W, y1: H / 2, y2: H / 2, class: 'axis-mid' }),
        svg('text', { x: 4, y: H / 2 - 4, class: 'axis-label' }, `${pct(pHeads)}`));
      if (history.length > 1) {
        const pts = history.map((v, k) => `${(k / (history.length - 1)) * W},${H - v * H}`).join(' ');
        chart.appendChild(svg('polyline', { points: pts, class: 'line' }));
      }
      stats.replaceChildren(
        h('span', null, h('strong', null, flips.toLocaleString('en-US')), ' flips'),
        h('span', null, h('strong', null, heads.toLocaleString('en-US')), ' heads'),
        h('span', null, h('strong', null, flips ? pct(heads / flips) : '–'), ' heads'));
    };
    const flip = (n: number) => {
      const shown: string[] = [];
      for (let k = 0; k < n; k++) {
        const hd = Math.random() < pHeads;
        flips++;
        if (hd) heads++;
        if (n <= 10) shown.push(hd ? 'H' : 'T');
        // Keep the chart readable: sample the running share.
        if (flips <= 200 || flips % Math.ceil(flips / 200) === 0) history.push(heads / flips);
      }
      last.replaceChildren(...shown.map((x) => h('span', { class: `coin ${x === 'H' ? 'heads' : 'tails'}` }, x)));
      draw();
    };
    draw();
    return h('div', { class: 'w-coin' },
      h('div', { class: 'w-btns' },
        h('button', { class: 'ghost', onclick: () => flip(1) }, 'Flip 1'),
        h('button', { class: 'ghost', onclick: () => flip(10) }, 'Flip 10'),
        h('button', { class: 'ghost', onclick: () => flip(1000) }, 'Flip 1,000')),
      last, chart, stats);
  };
}

// ---------------------------------------------------------------- dice grid

export interface DiceGridOpts {
  /** Highlight these outcomes (illustration). */
  show?: (a: number, b: number) => boolean;
  /** Task: select exactly the outcomes where this is true. */
  target?: (a: number, b: number) => boolean;
  /** Show the sum in each cell instead of the pair. */
  sums?: boolean;
}

/** The 36 equally likely outcomes of two dice. */
export function diceGrid(o: DiceGridOpts = {}): Widget {
  return (ctx) => {
    const sel = new Set<string>();
    const count = h('div', { class: 'w-stats' });
    const cells: HTMLElement[] = [];
    const table = h('div', { class: 'dice-grid' });
    table.appendChild(h('div', { class: 'dg-corner' }, '🎲'));
    for (let b = 1; b <= 6; b++) table.appendChild(h('div', { class: 'dg-head' }, String(b)));
    for (let a = 1; a <= 6; a++) {
      table.appendChild(h('div', { class: 'dg-head' }, String(a)));
      for (let b = 1; b <= 6; b++) {
        const key = `${a},${b}`;
        const cell = h('button', {
          class: `dg-cell${o.show?.(a, b) ? ' on' : ''}`,
          disabled: !o.target,
          onclick: () => {
            if (!o.target) return;
            if (sel.has(key)) sel.delete(key); else sel.add(key);
            cell.classList.toggle('on', sel.has(key));
            update();
          },
        }, o.sums ? String(a + b) : `${a}·${b}`);
        cells.push(cell);
        table.appendChild(cell);
      }
    }
    const update = () => {
      const n = o.target ? sel.size : cells.filter((c) => c.classList.contains('on')).length;
      count.replaceChildren(h('span', null, h('strong', null, String(n)), ' of 36 outcomes', o.target ? ' selected' : ' highlighted'));
      if (o.target && ctx.solved) {
        let ok = true;
        for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (o.target(a, b) !== sel.has(`${a},${b}`)) ok = false;
        ctx.solved(ok);
      }
    };
    update();
    return h('div', { class: 'w-dice' },
      h('div', { class: 'dg-legend muted small' }, 'Rows: first die · columns: second die'), table, count);
  };
}

// ---------------------------------------------------------------- Monty Hall

/** Play the game by hand, or run 100 games with a fixed strategy. */
export function montyHall(): Widget {
  return () => {
    const tally = { stay: [0, 0], switch: [0, 0] }; // [wins, games]
    let phase: 'pick' | 'decide' | 'over' = 'pick';
    let car = 0, pickD = -1, opened = -1;
    const doors = h('div', { class: 'doors' });
    const msg = h('div', { class: 'w-msg' });
    const stats = h('div', { class: 'w-stats' });
    const newGame = () => {
      car = Math.floor(Math.random() * 3);
      pickD = -1;
      opened = -1;
      phase = 'pick';
      draw();
    };
    const play = (strategy: 'stay' | 'switch') => {
      const final = strategy === 'stay' ? pickD : [0, 1, 2].find((d) => d !== pickD && d !== opened)!;
      tally[strategy][1]++;
      if (final === car) tally[strategy][0]++;
      pickD = final;
      phase = 'over';
      draw();
    };
    const sim = (strategy: 'stay' | 'switch') => {
      for (let k = 0; k < 100; k++) {
        const c = Math.floor(Math.random() * 3), p = Math.floor(Math.random() * 3);
        const win = strategy === 'stay' ? p === c : p !== c; // switching wins exactly when the first pick was wrong
        tally[strategy][1]++;
        if (win) tally[strategy][0]++;
      }
      draw();
    };
    const draw = () => {
      doors.replaceChildren(...[0, 1, 2].map((d) => {
        const revealed = phase === 'over' || d === opened;
        const content = revealed ? (d === car ? '🚗' : '🐐') : String(d + 1);
        return h('button', {
          class: `door${d === pickD ? ' picked' : ''}${revealed ? ' open' : ''}`,
          disabled: phase !== 'pick',
          onclick: () => {
            pickD = d;
            // The host opens a goat door you didn't pick.
            const goats = [0, 1, 2].filter((x) => x !== pickD && x !== car);
            opened = goats[Math.floor(Math.random() * goats.length)];
            phase = 'decide';
            draw();
          },
        }, content);
      }));
      msg.replaceChildren(...(phase === 'pick' ? ['Pick a door.']
        : phase === 'decide' ? [`The host opens door ${opened + 1}: a goat. Stay with door ${pickD + 1}, or switch?`,
          h('div', { class: 'w-btns' },
            h('button', { class: 'ghost', onclick: () => play('stay') }, 'Stay'),
            h('button', { class: 'ghost', onclick: () => play('switch') }, 'Switch'))]
        : [pickD === car ? 'You win the car! ' : 'A goat. ', h('button', { class: 'ghost', onclick: newGame }, 'Play again')]));
      const rate = (k: 'stay' | 'switch') => tally[k][1] ? `${pct(tally[k][0] / tally[k][1], 0)} of ${tally[k][1]}` : '–';
      stats.replaceChildren(
        h('span', null, 'Stay won ', h('strong', null, rate('stay'))),
        h('span', null, 'Switch won ', h('strong', null, rate('switch'))));
    };
    newGame();
    return h('div', { class: 'w-monty' }, doors, msg,
      h('div', { class: 'w-btns' },
        h('button', { class: 'ghost', onclick: () => sim('stay') }, 'Simulate 100: always stay'),
        h('button', { class: 'ghost', onclick: () => sim('switch') }, 'Simulate 100: always switch')),
      stats);
  };
}

// ---------------------------------------------------------------- dot arrays

export interface DotGroup {
  n: number;
  color: string;
  label: string;
}

/** A grid of dots in coloured groups: counts made visible (natural frequencies). */
export function dots(groups: DotGroup[], cols = 20): Widget {
  return () => {
    const total = groups.reduce((s, g) => s + g.n, 0);
    const rows = Math.ceil(total / cols);
    const r = 6, gap = 16;
    const W = cols * gap + 4, H = rows * gap + 4;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dots' });
    let k = 0;
    for (const g of groups) {
      for (let j = 0; j < g.n; j++, k++) {
        s.appendChild(svg('circle', { cx: (k % cols) * gap + gap / 2 + 2, cy: Math.floor(k / cols) * gap + gap / 2 + 2, r, fill: g.color }));
      }
    }
    return h('div', { class: 'w-dots' }, s,
      h('div', { class: 'legend' }, groups.map((g) =>
        h('span', null, h('i', { style: `background:${g.color}` }), `${g.label} (${g.n})`))));
  };
}

/** Stacked bar of probabilities that add to 1. */
export function splitBar(parts: { p: number; color: string; label: string }[]): Widget {
  return () => h('div', { class: 'w-split' },
    h('div', { class: 'split' }, parts.map((p) => h('div', { style: `flex:${p.p};background:${p.color}`, title: `${p.label}: ${pct(p.p)}` }))),
    h('div', { class: 'legend' }, parts.map((p) => h('span', null, h('i', { style: `background:${p.color}` }), `${p.label}: ${pct(p.p)}`))));
}
