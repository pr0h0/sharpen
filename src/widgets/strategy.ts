// Interactive pieces for the strategy course: take-away games, payoff matrices, game trees,
// the iterated prisoner's dilemma, mixed strategies and auctions. Also the small game-theory
// helpers (equilibria, dominance) the course uses to build and check its problems.
import type { Widget } from '../types';
import { h, svg } from '../ui';

export const YOU = '#4f8cff';
export const THEM = '#f2a33a';

// ---------------------------------------------------------------- game theory helpers

/** A two-player game in normal form: pay[r][c] = [row player's payoff, column player's payoff]. */
export interface Game {
  rows: string[];
  cols: string[];
  pay: [number, number][][];
  /** Names of the two players (default "You" and "Them"). */
  names?: [string, string];
}

/** Cells where each move is a best response to the other (ties count as best responses). */
export function pureNash(g: Game): [number, number][] {
  const out: [number, number][] = [];
  g.rows.forEach((_, r) => g.cols.forEach((_, c) => {
    const rowBest = g.rows.every((_, r2) => g.pay[r2][c][0] <= g.pay[r][c][0]);
    const colBest = g.cols.every((_, c2) => g.pay[r][c2][1] <= g.pay[r][c][1]);
    if (rowBest && colBest) out.push([r, c]);
  }));
  return out;
}

/** True if no player is ever indifferent between two of their moves (so best responses are unique). */
export function noTies(g: Game): boolean {
  for (let c = 0; c < g.cols.length; c++) {
    const v = g.rows.map((_, r) => g.pay[r][c][0]);
    if (new Set(v).size !== v.length) return false;
  }
  for (let r = 0; r < g.rows.length; r++) {
    const v = g.cols.map((_, c) => g.pay[r][c][1]);
    if (new Set(v).size !== v.length) return false;
  }
  return true;
}

/** Index of a strictly dominant move for player 0 (rows) or 1 (columns), or -1 if none. */
export function dominant(g: Game, player: 0 | 1): number {
  const mine = player === 0 ? g.rows.length : g.cols.length;
  const theirs = player === 0 ? g.cols.length : g.rows.length;
  const val = (m: number, o: number) => (player === 0 ? g.pay[m][o][0] : g.pay[o][m][1]);
  for (let m = 0; m < mine; m++) {
    let ok = true;
    for (let m2 = 0; m2 < mine && ok; m2++) {
      if (m2 === m) continue;
      for (let o = 0; o < theirs; o++) if (val(m, o) <= val(m2, o)) { ok = false; break; }
    }
    if (ok) return m;
  }
  return -1;
}

/** Is move m of player strictly dominated by another remaining move, given the remaining moves? */
export function dominated(g: Game, player: 0 | 1, m: number, rows: number[], cols: number[]): boolean {
  const mine = player === 0 ? rows : cols;
  const theirs = player === 0 ? cols : rows;
  const val = (a: number, o: number) => (player === 0 ? g.pay[a][o][0] : g.pay[o][a][1]);
  return mine.some((m2) => m2 !== m && theirs.every((o) => val(m2, o) > val(m, o)));
}

// ---------------------------------------------------------------- take-away game

/** Positions 0..max with the losing ones (for the player to move) marked; or a task to mark them. */
export function positions(o: { max: number; k: number; task?: boolean }): Widget {
  return (ctx) => {
    const lose = (n: number) => n % (o.k + 1) === 0;
    const sel = new Set<number>([0]);
    const stats = h('div', { class: 'w-stats', style: 'justify-content:center' });
    const row = h('div', { style: 'display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:6px' });
    const cells: HTMLButtonElement[] = [];
    for (let n = 0; n <= o.max; n++) {
      const on = o.task ? sel.has(n) : lose(n);
      const b = h('button', {
        class: `dg-cell${on ? ' on' : ''}`,
        style: 'width:40px;font-size:.95rem;font-weight:700',
        disabled: !o.task || n === 0,
        onclick: () => {
          if (sel.has(n)) sel.delete(n); else sel.add(n);
          b.classList.toggle('on', sel.has(n));
          update();
        },
      }, String(n));
      cells.push(b);
      row.appendChild(b);
    }
    const update = () => {
      if (!o.task) {
        stats.replaceChildren(h('span', null, 'Highlighted: you lose if it’s your turn here (against perfect play)'));
        return;
      }
      stats.replaceChildren(h('span', null, h('strong', null, String(sel.size)), ' marked as losing'));
      let ok = true;
      for (let n = 0; n <= o.max; n++) if (lose(n) !== sel.has(n)) ok = false;
      ctx.solved?.(ok);
    };
    update();
    return h('div', null,
      h('div', { class: 'muted small', style: 'text-align:center' }, `Counters left when it’s your turn · take 1 to ${o.k}`),
      row, stats);
  };
}

/** Play a take-away game (take 1..k, whoever takes the last counter wins) against a perfect computer. */
export function takeAway(o: { start: number; k: number; youFirst?: boolean }): Widget {
  return (ctx) => {
    let pile = o.start;
    let yourTurn = o.youFirst ?? true;
    let over = false;
    let wins = 0, games = 0;
    const log: string[] = [];
    const heap = h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center;min-height:26px;margin:6px 0' });
    const count = h('div', { style: 'text-align:center;font-size:1.6rem;font-weight:800' });
    const btns = h('div', { class: 'w-btns', style: 'justify-content:center' });
    const msg = h('div', { class: 'w-msg', style: 'text-align:center' });
    const stats = h('div', { class: 'w-stats', style: 'justify-content:center' });
    const best = (n: number) => n % (o.k + 1); // 0 means no winning move
    const computer = () => {
      const t = best(pile) || 1;
      pile -= t;
      log.push(`Computer takes ${t}.`);
      if (pile === 0) {
        over = true;
        games++;
        log.push('Computer took the last counter and wins.');
        ctx.solved?.(false);
      } else yourTurn = true;
      draw();
    };
    const take = (t: number) => {
      if (over || !yourTurn || t > pile) return;
      pile -= t;
      log.length = 0;
      log.push(`You take ${t}.`);
      if (pile === 0) {
        over = true;
        games++;
        wins++;
        log.push('You took the last counter. You win!');
        ctx.solved?.(true);
        draw();
        return;
      }
      yourTurn = false;
      draw();
      setTimeout(computer, 450);
    };
    const reset = () => {
      pile = o.start;
      over = false;
      log.length = 0;
      yourTurn = o.youFirst ?? true;
      draw();
      if (!yourTurn) setTimeout(computer, 450);
    };
    const draw = () => {
      heap.replaceChildren(...Array.from({ length: pile }, () =>
        h('span', { style: `width:18px;height:18px;border-radius:50%;background:${YOU};display:inline-block` })));
      count.textContent = `${pile} left`;
      btns.replaceChildren(...Array.from({ length: o.k }, (_, i) =>
        h('button', { class: 'ghost', disabled: over || !yourTurn || i + 1 > pile, onclick: () => take(i + 1) }, `Take ${i + 1}`)));
      msg.replaceChildren(
        log.join(' ') || (yourTurn ? 'Your move.' : 'Computer is thinking…'),
        over ? h('div', { class: 'w-btns', style: 'justify-content:center' }, h('button', { class: 'ghost', onclick: reset }, 'Play again')) : '',
        !over && yourTurn && log.length ? ' Your move.' : '');
      stats.replaceChildren(h('span', null, 'You’ve won ', h('strong', null, `${wins} of ${games}`)));
    };
    draw();
    ctx.solved?.(false);
    if (!yourTurn) setTimeout(computer, 450);
    return h('div', null, count, heap, btns, msg, stats);
  };
}

// ---------------------------------------------------------------- payoff matrix

export interface MatrixOpts {
  /** 'show': static table. 'best': toggles to underline best responses. 'nash': task, tap every equilibrium.
   *  'eliminate': task, tap row/column names to cross out dominated moves until one cell remains. */
  mode?: 'show' | 'best' | 'nash' | 'eliminate';
  /** Cells to outline (illustration). */
  mark?: [number, number][];
}

/** A payoff table: in each cell, your payoff (blue) then theirs (orange). */
export function matrix(g: Game, o: MatrixOpts = {}): Widget {
  return (ctx) => {
    const mode = o.mode ?? 'show';
    const [nameA, nameB] = g.names ?? ['You', 'Them'];
    const sel = new Set<string>();
    let rows = g.rows.map((_, i) => i), cols = g.cols.map((_, i) => i);
    let showA = false, showB = false;
    const msg = h('div', { class: 'w-msg', style: 'text-align:center;min-height:1.4em' });
    const box = h('div', { style: 'overflow-x:auto' });
    const nash = new Set(pureNash(g).map(([r, c]) => `${r},${c}`));
    const marks = new Set((o.mark ?? []).map(([r, c]) => `${r},${c}`));
    const isBestA = (r: number, c: number) => rows.every((r2) => g.pay[r2][c][0] <= g.pay[r][c][0]);
    const isBestB = (r: number, c: number) => cols.every((c2) => g.pay[r][c2][1] <= g.pay[r][c][1]);
    const cellBase = 'padding:10px 12px;text-align:center;border:1px solid var(--line);font-size:1.1rem;white-space:nowrap';
    const ring = 'box-shadow:inset 0 0 0 3px var(--accent-default);background:var(--shown-bg)';
    const hl = (on: boolean, color: string) => on ? `font-weight:800;text-decoration:underline;text-decoration-thickness:3px;color:${color}` : `color:${color}`;

    const draw = () => {
      const head = h('tr', null,
        h('th', { style: 'padding:6px;font-size:.8rem;color:var(--muted);text-align:left' },
          h('span', { style: `color:${YOU}` }, nameA), ' ↓ · ', h('span', { style: `color:${THEM}` }, nameB), ' →'),
        cols.map((c) => h('th', { style: `padding:6px 10px;color:${THEM}` },
          mode === 'eliminate'
            ? h('button', { class: 'ghost', style: `color:${THEM};padding:.3em .6em`, onclick: () => cross(1, c) }, g.cols[c])
            : g.cols[c])));
      const body = rows.map((r) => h('tr', null,
        h('th', { style: `padding:6px 10px;text-align:right;color:${YOU}` },
          mode === 'eliminate'
            ? h('button', { class: 'ghost', style: `color:${YOU};padding:.3em .6em`, onclick: () => cross(0, r) }, g.rows[r])
            : g.rows[r]),
        cols.map((c) => {
          const key = `${r},${c}`;
          const [a, b] = g.pay[r][c];
          const outlined = mode === 'nash' ? sel.has(key) : marks.has(key);
          return h('td', {
            style: `${cellBase};${outlined ? ring : ''};${mode === 'nash' ? 'cursor:pointer' : ''}`,
            onclick: mode === 'nash' ? () => {
              if (sel.has(key)) sel.delete(key); else sel.add(key);
              draw();
              report();
            } : undefined,
          },
            h('span', { style: hl(showA && isBestA(r, c), YOU) }, String(a)), ', ',
            h('span', { style: hl(showB && isBestB(r, c), THEM) }, String(b)));
        })));
      box.replaceChildren(h('table', { style: 'border-collapse:collapse;margin:0 auto' }, h('thead', null, head), h('tbody', null, body)));
    };
    const report = () => {
      if (mode !== 'nash') return;
      const ok = sel.size === nash.size && [...sel].every((k) => nash.has(k));
      msg.textContent = sel.size ? `${sel.size} cell${sel.size === 1 ? '' : 's'} selected` : 'Tap the cells that are equilibria.';
      ctx.solved?.(ok);
    };
    const cross = (player: 0 | 1, m: number) => {
      if (rows.length * cols.length === 1) return;
      const name = player === 0 ? g.rows[m] : g.cols[m];
      if (!dominated(g, player, m, rows, cols)) {
        msg.textContent = `${name} isn’t strictly worse than another move for ${player === 0 ? (nameA === 'You' ? 'you' : nameA) : (nameB === 'Them' ? 'them' : nameB)}, at least not yet.`;
        return;
      }
      if (player === 0) rows = rows.filter((x) => x !== m); else cols = cols.filter((x) => x !== m);
      const left = rows.length * cols.length;
      msg.textContent = left === 1 ? `Crossed out ${name}. One cell left: that’s the outcome.` : `Crossed out ${name}.`;
      draw();
      ctx.solved?.(left === 1);
    };
    const reset = () => {
      rows = g.rows.map((_, i) => i);
      cols = g.cols.map((_, i) => i);
      msg.textContent = 'Tap a move’s name to cross it out.';
      draw();
      ctx.solved?.(false);
    };

    draw();
    const extra: HTMLElement[] = [];
    if (mode === 'best') {
      const bA = h('button', { class: 'ghost', onclick: () => { showA = !showA; bA.textContent = (showA ? 'Hide ' : 'Show ') + `${nameA.toLowerCase() === 'you' ? 'your' : nameA + '’s'} best responses`; draw(); } }, `Show ${nameA.toLowerCase() === 'you' ? 'your' : nameA + '’s'} best responses`);
      const bB = h('button', { class: 'ghost', onclick: () => { showB = !showB; bB.textContent = (showB ? 'Hide ' : 'Show ') + `${nameB.toLowerCase() === 'them' ? 'their' : nameB + '’s'} best responses`; draw(); } }, `Show ${nameB.toLowerCase() === 'them' ? 'their' : nameB + '’s'} best responses`);
      extra.push(h('div', { class: 'w-btns', style: 'justify-content:center' }, bA, bB));
    }
    if (mode === 'eliminate') {
      extra.push(h('div', { class: 'w-btns', style: 'justify-content:center' }, h('button', { class: 'ghost', onclick: reset }, 'Start over')));
      msg.textContent = 'Tap a move’s name to cross it out.';
      ctx.solved?.(false);
    }
    if (mode === 'nash') report();
    return h('div', null, box,
      h('div', { class: 'legend' },
        h('span', null, h('i', { style: `background:${YOU}` }), nameA === 'You' ? 'your payoff' : `${nameA}’s payoff`),
        h('span', null, h('i', { style: `background:${THEM}` }), nameB === 'Them' ? 'their payoff' : `${nameB}’s payoff`)),
      extra, msg);
  };
}

// ---------------------------------------------------------------- game tree

export type TreeNode =
  | { p: 0 | 1; moves: { label: string; to: TreeNode }[] }
  | { pay: [number, number] };

/** Draw a game tree; "Solve backwards" reveals each choice from the bottom up. */
export function tree(root: TreeNode, o: { names?: [string, string]; solve?: boolean } = {}): Widget {
  return () => {
    const names = o.names ?? ['You', 'Them'];
    type Laid = { node: TreeNode; x: number; y: number; depth: number; kids: Laid[]; val?: [number, number]; pick?: number };
    let leafN = 0;
    let maxDepth = 0;
    const lay = (node: TreeNode, depth: number): Laid => {
      maxDepth = Math.max(maxDepth, depth);
      if ('pay' in node) return { node, x: leafN++, y: depth, depth, kids: [], val: node.pay };
      const kids = node.moves.map((m) => lay(m.to, depth + 1));
      return { node, x: kids.reduce((s, k) => s + k.x, 0) / kids.length, y: depth, depth, kids };
    };
    const top = lay(root, 0);
    // Solve every internal node (the chooser maximises their own payoff).
    const internal: Laid[] = [];
    const solve = (l: Laid): [number, number] => {
      if (l.val) return l.val;
      const vals = l.kids.map(solve);
      const p = (l.node as { p: 0 | 1 }).p;
      let bi = 0;
      vals.forEach((v, i) => { if (v[p] > vals[bi][p]) bi = i; });
      l.pick = bi;
      l.val = vals[bi];
      internal.push(l);
      return l.val;
    };
    solve(top);
    internal.sort((a, b) => b.depth - a.depth);
    let shown = 0;
    const GX = 92, GY = 78, PAD = 34;
    const W = Math.max(1, leafN) * GX + PAD, H = maxDepth * GY + 2 * PAD + 12;
    const X = (x: number) => PAD / 2 + GX / 2 + x * GX, Y = (y: number) => PAD + y * GY;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, style: `width:100%;max-width:${Math.min(W * 1.3, 560)}px;display:block;margin:0 auto` });
    const payText = (x: number, y: number, v: [number, number], weight = '700') =>
      svg('text', { x, y, 'text-anchor': 'middle', style: `font-size:15px;font-weight:${weight};fill:var(--text)` },
        svg('tspan', { style: `fill:${YOU}` }, String(v[0])), ', ', svg('tspan', { style: `fill:${THEM}` }, String(v[1])));
    const draw = () => {
      s.replaceChildren();
      const done = new Set(internal.slice(0, shown));
      const walk = (l: Laid) => {
        l.kids.forEach((k, i) => {
          const chosen = done.has(l) && l.pick === i;
          const faded = done.has(l) && l.pick !== i;
          s.appendChild(svg('line', {
            x1: X(l.x), y1: Y(l.y), x2: X(k.x), y2: Y(k.y),
            style: `stroke:${chosen ? 'var(--good)' : 'var(--muted)'};stroke-width:${chosen ? 4 : 1.5};opacity:${faded ? 0.35 : 1}`,
          }));
          const mx = (X(l.x) + X(k.x)) / 2, my = (Y(l.y) + Y(k.y)) / 2;
          const label = (l.node as { moves: { label: string }[] }).moves[i].label;
          s.appendChild(svg('text', { x: mx + (k.x < l.x ? -8 : k.x > l.x ? 8 : 8), y: my, 'text-anchor': k.x < l.x ? 'end' : 'start', style: `font-size:12px;fill:var(--muted);opacity:${faded ? 0.5 : 1}` }, label));
          walk(k);
        });
        if ('pay' in l.node) {
          s.appendChild(svg('circle', { cx: X(l.x), cy: Y(l.y), r: 3.5, style: 'fill:var(--muted)' }));
          s.appendChild(payText(X(l.x), Y(l.y) + 22, l.node.pay));
        } else {
          const p = l.node.p;
          s.appendChild(svg('circle', { cx: X(l.x), cy: Y(l.y), r: 13, style: `fill:${p === 0 ? YOU : THEM}` }));
          s.appendChild(svg('text', { x: X(l.x), y: Y(l.y) + 4, 'text-anchor': 'middle', style: 'font-size:11px;font-weight:800;fill:#fff' }, names[p][0]));
          if (done.has(l)) s.appendChild(payText(X(l.x), Y(l.y) - 18, l.val!, '800'));
        }
      };
      walk(top);
      msg.textContent = !o.solve ? '' : shown === 0 ? 'Start at the bottom: the last decisions first.'
        : shown < internal.length ? 'Each solved node now acts like a payoff: the one its chooser picks.'
          : `Solved: you end up at (${top.val![0]}, ${top.val![1]}).`;
    };
    const msg = h('div', { class: 'w-msg', style: 'text-align:center' });
    const nextBtn = h('button', { class: 'ghost', onclick: () => { if (shown < internal.length) shown++; draw(); } }, 'Solve one step back');
    const reset = h('button', { class: 'ghost', onclick: () => { shown = 0; draw(); } }, 'Reset');
    draw();
    return h('div', null, s,
      h('div', { class: 'legend' },
        h('span', null, h('i', { style: `background:${YOU}` }), `${names[0]} (first number)`),
        h('span', null, h('i', { style: `background:${THEM}` }), `${names[1]} (second number)`)),
      o.solve ? h('div', { class: 'w-btns', style: 'justify-content:center' }, nextBtn, reset) : null,
      msg);
  };
}

// ---------------------------------------------------------------- prisoner's dilemma, repeated

export type Move = 'C' | 'D';
/** Points for (my move, their move): temptation 5, reward 3, punishment 1, sucker 0. */
export const PD: Record<string, number> = { CC: 3, CD: 0, DC: 5, DD: 1 };

export interface Strategy {
  name: string;
  /** Next move, given my history and theirs. */
  move: (mine: Move[], theirs: Move[], rnd: () => number) => Move;
}

export const STRATEGIES: Strategy[] = [
  { name: 'Tit for Tat', move: (_m, t) => (t.length ? t[t.length - 1] : 'C') },
  { name: 'Grudger', move: (_m, t) => (t.includes('D') ? 'D' : 'C') },
  { name: 'Always Cooperate', move: () => 'C' },
  { name: 'Always Defect', move: () => 'D' },
  { name: 'Random', move: (_m, _t, r) => (r() < 0.5 ? 'C' : 'D') },
  { name: 'Generous Tit for Tat', move: (_m, t, r) => (t.length && t[t.length - 1] === 'D' && r() > 0.1 ? 'D' : 'C') },
];

/** Play a match; noise = chance that each intended move flips by mistake. Returns both totals. */
export function match(a: Strategy, b: Strategy, rounds: number, rnd: () => number, noise = 0): [number, number] {
  const ma: Move[] = [], mb: Move[] = [];
  let sa = 0, sb = 0;
  const flip = (m: Move): Move => (noise && rnd() < noise ? (m === 'C' ? 'D' : 'C') : m);
  for (let i = 0; i < rounds; i++) {
    const x = flip(a.move(ma, mb, rnd)), y = flip(b.move(mb, ma, rnd));
    ma.push(x);
    mb.push(y);
    sa += PD[x + y];
    sb += PD[y + x];
  }
  return [sa, sb];
}

/** Round-robin tournament (every pair once, plus each against its own twin), averaged over repeats. */
export function tournament(strats: Strategy[], rounds: number, rnd: () => number, noise = 0, repeats = 1): number[] {
  const tot = strats.map(() => 0);
  for (let k = 0; k < repeats; k++) {
    for (let i = 0; i < strats.length; i++) {
      for (let j = i; j < strats.length; j++) {
        const [a, b] = match(strats[i], strats[j], rounds, rnd, noise);
        tot[i] += a;
        if (j !== i) tot[j] += b;
      }
    }
  }
  return tot.map((t) => t / repeats / strats.length / rounds);
}

/** Run a tournament with a choice of match length and noise; shows average points per round. */
export function tournamentWidget(strats: Strategy[] = STRATEGIES): Widget {
  return () => {
    let rounds = 200, noise = 0;
    const out = h('div', { style: 'margin-top:8px' });
    const msg = h('div', { class: 'w-msg small muted', style: 'text-align:center' });
    const run = () => {
      const scores = tournament(strats, rounds, Math.random, noise, rounds === 1 ? 40 : noise ? 20 : 4);
      const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
      out.replaceChildren(...order.map(([s, i], rank) =>
        h('div', { style: 'display:flex;align-items:center;gap:8px;margin:4px 0' },
          h('span', { style: 'width:11em;font-size:.95rem;white-space:nowrap' }, `${rank + 1}. ${strats[i].name}`),
          h('div', { style: 'flex:1;height:16px;background:var(--panel2);border-radius:6px;overflow:hidden' },
            h('div', { style: `height:100%;width:${(s / 5) * 100}%;background:${rank === 0 ? 'var(--good)' : YOU}` })),
          h('strong', { style: 'width:3em;text-align:right' }, s.toFixed(2)))));
      msg.textContent = `Average points per round, ${rounds === 1 ? 'one-shot games' : rounds + '-round matches'}${noise ? ', 5% of moves mistaken' : ''}. Each strategy meets every other one and its own twin.`;
    };
    const lenBtns = [1, 10, 200].map((n) => {
      const b = h('button', { class: 'ghost', onclick: () => { rounds = n; lenBtns.forEach((x) => x.style.outline = ''); b.style.outline = '2px solid var(--accent-default)'; run(); } },
        n === 1 ? 'One round' : `${n} rounds`);
      if (n === rounds) b.style.outline = '2px solid var(--accent-default)';
      return b;
    });
    const noiseBtn = h('button', { class: 'ghost', onclick: () => { noise = noise ? 0 : 0.05; noiseBtn.textContent = noise ? 'Mistakes: on (5%)' : 'Mistakes: off'; run(); } }, 'Mistakes: off');
    run();
    return h('div', null,
      h('div', { class: 'w-btns', style: 'justify-content:center' }, ...lenBtns, noiseBtn),
      out, msg);
  };
}

/** Play the repeated dilemma by hand against a hidden strategy; task: reach the target score. */
export function pdPlay(o: { rounds: number; target: number; opp?: Strategy }): Widget {
  return (ctx) => {
    const opp = o.opp ?? STRATEGIES[0];
    let mine: Move[] = [], theirs: Move[] = [];
    let you = 0, them = 0;
    const hist = h('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;margin:8px 0' });
    const msg = h('div', { class: 'w-msg', style: 'text-align:center' });
    const btns = h('div', { class: 'w-btns', style: 'justify-content:center' });
    const stats = h('div', { class: 'w-stats', style: 'justify-content:center' });
    const chip = (m: Move) => h('span', {
      style: `display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;font-size:.75rem;font-weight:800;color:#fff;background:${m === 'C' ? 'var(--good)' : 'var(--bad)'}`,
    }, m);
    const play = (m: Move) => {
      if (mine.length >= o.rounds) return;
      const t = opp.move(theirs, mine, Math.random);
      mine.push(m);
      theirs.push(t);
      you += PD[m + t];
      them += PD[t + m];
      draw();
    };
    const reset = () => { mine = []; theirs = []; you = 0; them = 0; draw(); ctx.solved?.(false); };
    const draw = () => {
      hist.replaceChildren(
        h('span', { class: 'small muted' }, 'You'), h('div', { style: 'display:flex;gap:3px;flex-wrap:wrap' }, mine.map(chip)),
        h('span', { class: 'small muted' }, 'Them'), h('div', { style: 'display:flex;gap:3px;flex-wrap:wrap' }, theirs.map(chip)));
      const done = mine.length >= o.rounds;
      btns.replaceChildren(...(done
        ? [h('button', { class: 'ghost', onclick: reset }, 'Play again')]
        : [h('button', { class: 'ghost', onclick: () => play('C') }, 'Cooperate'), h('button', { class: 'ghost', onclick: () => play('D') }, 'Defect')]));
      msg.textContent = done
        ? (you >= o.target ? `Done: ${you} points. Target reached!` : `Done: ${you} points, short of ${o.target}. Try again?`)
        : mine.length ? `Round ${mine.length}: you ${mine[mine.length - 1] === 'C' ? 'cooperated' : 'defected'}, they ${theirs[theirs.length - 1] === 'C' ? 'cooperated' : 'defected'}.` : `Round 1 of ${o.rounds}. Choose.`;
      stats.replaceChildren(
        h('span', null, 'Round ', h('strong', null, `${Math.min(mine.length + (done ? 0 : 1), o.rounds)}/${o.rounds}`)),
        h('span', null, 'You ', h('strong', null, String(you))),
        h('span', null, 'Them ', h('strong', null, String(them))));
      if (done) ctx.solved?.(you >= o.target);
    };
    draw();
    ctx.solved?.(false);
    return h('div', null,
      h('div', { class: 'small muted', style: 'text-align:center' }, 'Each round: both cooperate 3 each · both defect 1 each · defect on a cooperator 5 for you, 0 for them'),
      hist, btns, msg, stats);
  };
}

// ---------------------------------------------------------------- mixed strategies

/** Rock–paper–scissors against a bot that hunts for patterns in your play. */
export function rps(): Widget {
  return () => {
    const names = ['Rock', 'Paper', 'Scissors'];
    const icons = ['✊', '✋', '✌️'];
    const beats = (a: number) => (a + 1) % 3; // the move that beats a
    const hist: number[] = [];
    let w = 0, d = 0, l = 0;
    const msg = h('div', { class: 'w-msg', style: 'text-align:center;min-height:1.4em' });
    const stats = h('div', { class: 'w-stats', style: 'justify-content:center' });
    const predict = (): number => {
      // After your last move, what have you usually played next? Fall back to your favourite move.
      const counts = [0, 0, 0];
      if (hist.length >= 2) {
        const last = hist[hist.length - 1];
        for (let i = 1; i < hist.length; i++) if (hist[i - 1] === last) counts[hist[i]]++;
      }
      if (counts.every((c) => c === 0)) hist.forEach((m) => counts[m]++);
      const mx = Math.max(...counts);
      if (mx === 0) return Math.floor(Math.random() * 3);
      const top = [0, 1, 2].filter((i) => counts[i] === mx);
      return top[Math.floor(Math.random() * top.length)];
    };
    const play = (m: number, quiet = false) => {
      const bot = beats(predict());
      hist.push(m);
      const res = m === bot ? 'draw' : beats(bot) === m ? 'win' : 'lose';
      if (res === 'win') w++; else if (res === 'lose') l++; else d++;
      if (!quiet) msg.textContent = `You ${icons[m]} ${names[m]}, bot ${icons[bot]} ${names[bot]}: ${res === 'win' ? 'you win' : res === 'lose' ? 'bot wins' : 'draw'}.`;
      draw();
    };
    const randomRun = () => {
      for (let i = 0; i < 30; i++) play(Math.floor(Math.random() * 3), true);
      msg.textContent = 'Played 30 truly random moves for you.';
    };
    const draw = () => stats.replaceChildren(
      h('span', null, 'You ', h('strong', null, String(w))),
      h('span', null, 'Bot ', h('strong', null, String(l))),
      h('span', null, 'Draws ', h('strong', null, String(d))));
    draw();
    return h('div', null,
      h('div', { class: 'w-btns', style: 'justify-content:center' },
        names.map((n, i) => h('button', { class: 'ghost', style: 'font-size:1.1rem', onclick: () => play(i) }, `${icons[i]} ${n}`))),
      msg, stats,
      h('div', { class: 'w-btns', style: 'justify-content:center' },
        h('button', { class: 'ghost', onclick: randomRun }, 'Play 30 random moves for me'),
        h('button', { class: 'ghost', onclick: () => { hist.length = 0; w = d = l = 0; msg.textContent = ''; draw(); } }, 'Reset')));
  };
}

/**
 * Pick how often to play your first move. chance[i][j] = your success chance when you play i and they
 * play j. Shows what each of their replies gives you, and the worst case a smart opponent holds you to.
 */
export function mixSlider(o: { mine: [string, string]; theirs: [string, string]; chance: number[][]; what?: string }): Widget {
  return () => {
    const what = o.what ?? 'You score';
    const val = (p: number, j: number) => p * o.chance[0][j] + (1 - p) * o.chance[1][j];
    const W = 320, H = 140;
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const out = h('div', { class: 'w-stats', style: 'justify-content:center' });
    const label = h('div', { style: 'text-align:center;font-weight:700;margin-top:6px' });
    const sl = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, class: 'est' });
    const lo = Math.min(...o.chance.flat()), hi = Math.max(...o.chance.flat());
    const yy = (v: number) => H - 10 - ((v - lo) / (hi - lo || 1)) * (H - 20);
    const pctS = (v: number) => `${Math.round(v * 100)}%`;
    const draw = () => {
      const p = Number(sl.value) / 100;
      const colors = [THEM, '#a371f7'];
      chart.replaceChildren(
        ...[0, 1].map((j) => svg('line', { x1: 0, y1: yy(val(0, j)), x2: W, y2: yy(val(1, j)), style: `stroke:${colors[j]};stroke-width:2.5` })),
        svg('line', { x1: p * W, x2: p * W, y1: 0, y2: H, style: 'stroke:var(--muted);stroke-dasharray:4 4' }),
        svg('circle', { cx: p * W, cy: yy(Math.min(val(p, 0), val(p, 1))), r: 5, style: `fill:${YOU}` }));
      label.textContent = `${o.mine[0]} ${Math.round(p * 100)}% · ${o.mine[1]} ${100 - Math.round(p * 100)}%`;
      out.replaceChildren(
        h('span', null, h('i', { style: `display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;background:${colors[0]}` }), `If they ${o.theirs[0].toLowerCase()}: `, h('strong', null, pctS(val(p, 0)))),
        h('span', null, h('i', { style: `display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;background:${colors[1]}` }), `If they ${o.theirs[1].toLowerCase()}: `, h('strong', null, pctS(val(p, 1)))),
        h('span', null, `${what} against a smart opponent: `, h('strong', null, pctS(Math.min(val(p, 0), val(p, 1))))));
    };
    sl.addEventListener('input', draw);
    draw();
    return h('div', null, label, sl,
      h('div', { class: 'est-ends' }, h('span', null, `always ${o.mine[1].toLowerCase()}`), h('span', null, `always ${o.mine[0].toLowerCase()}`)),
      chart, out);
  };
}

// ---------------------------------------------------------------- auctions

/**
 * Sealed-bid auction against one rival whose bid is equally likely to be anything from 0 to 100.
 * Shows your average profit for the bid on the slider. As a task: find the best bid (within 2).
 */
export function auction(o: { kind: 'first' | 'second'; value: number; curve?: boolean; task?: boolean }): Widget {
  return (ctx) => {
    const v = o.value;
    const ev = (b: number) => o.kind === 'second' ? (v * b - (b * b) / 2) / 100 : ((v - b) * b) / 100;
    const best = o.kind === 'second' ? v : v / 2;
    const sl = h('input', { type: 'range', min: 0, max: 100, step: 1, value: o.task ? 90 : 50, class: 'est' });
    const big = h('div', { style: 'text-align:center;font-size:1.5rem;font-weight:800' });
    const out = h('div', { class: 'w-stats', style: 'justify-content:center' });
    const msg = h('div', { class: 'w-msg small muted', style: 'text-align:center' });
    const W = 320, H = 130;
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const evs = Array.from({ length: 101 }, (_, b) => ev(b));
    const top = Math.max(...evs), bot = Math.min(0, ...evs);
    const yy = (e: number) => H - 8 - ((e - bot) / (top - bot || 1)) * (H - 16);
    let sim: [number, number] | null = null;
    const draw = () => {
      const b = Number(sl.value);
      big.textContent = `Your bid: £${b}`;
      out.replaceChildren(
        h('span', null, 'Chance you win: ', h('strong', null, `${b}%`)),
        h('span', null, 'Average profit per auction: ', h('strong', null, `£${ev(b).toFixed(2)}`)),
        sim ? h('span', null, `Simulated ${sim[1].toLocaleString('en-US')}: `, h('strong', null, `£${(sim[0] / sim[1]).toFixed(2)}`), ' each') : '');
      if (o.curve) {
        chart.replaceChildren(
          svg('line', { x1: 0, x2: W, y1: yy(0), y2: yy(0), class: 'axis-mid' }),
          svg('polyline', { points: evs.map((e, k) => `${(k / 100) * W},${yy(e)}`).join(' '), class: 'line' }),
          svg('line', { x1: (v / 100) * W, x2: (v / 100) * W, y1: 0, y2: H, style: `stroke:${THEM};stroke-dasharray:3 3` }),
          svg('text', { x: (v / 100) * W + 4, y: 12, class: 'axis-label' }, `value £${v}`),
          svg('circle', { cx: (b / 100) * W, cy: yy(ev(b)), r: 5, style: `fill:${YOU}` }));
      }
      if (o.task) ctx.solved?.(Math.abs(b - best) <= 2);
    };
    const simulate = () => {
      const b = Number(sl.value);
      let tot = 0;
      const n = 1000;
      for (let i = 0; i < n; i++) {
        const r = Math.random() * 100;
        if (b > r) tot += v - (o.kind === 'second' ? r : b);
      }
      sim = [tot, n];
      draw();
    };
    sl.addEventListener('input', () => { sim = null; draw(); });
    msg.textContent = `You value the item at £${v}. One rival bids anything from £0 to £100, equally likely. Highest bid wins and pays ${o.kind === 'second' ? 'the rival’s (second-highest) bid' : 'their own bid'}.`;
    draw();
    return h('div', null, msg, big, sl,
      h('div', { class: 'est-ends' }, h('span', null, '£0'), h('span', null, '£100')),
      o.curve ? chart : null, out,
      h('div', { class: 'w-btns', style: 'justify-content:center' }, h('button', { class: 'ghost', onclick: simulate }, 'Simulate 1,000 auctions')));
  };
}
