// Interactive pieces for "Thinking in Code": a grid robot you program by tapping commands, a code
// listing where you tap the buggy line, an error message box and a function "machine".
import type { Widget } from '../types';
import { h } from '../ui';
import { codeBlock } from '../viz/cs';

// ---------------------------------------------------------------- robot model

/** Heading: 0 north (up), 1 east, 2 south, 3 west. Coordinates: x right, y up, (0, 0) bottom left. */
export interface Bot { x: number; y: number; d: number }
export type Cmd = 'F' | 'L' | 'R';
export interface World { w: number; h: number; walls?: [number, number][]; goal?: [number, number] }

export const DIRS = ['north', 'east', 'south', 'west'] as const;
const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];
const ARROW = ['▲', '▶', '▼', '◀'];
export const CMD_TEXT: Record<Cmd, string> = { F: 'forward()', L: 'turn_left()', R: 'turn_right()' };

export function blocked(world: World, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= world.w || y >= world.h || !!world.walls?.some(([a, b]) => a === x && b === y);
}

/** Run a program; returns every state (the start included) and the index of the command that bumped, if any. */
export function runBot(world: World, start: Bot, prog: Cmd[]): { states: Bot[]; crash: number } {
  let b = { ...start };
  const states = [b];
  for (let i = 0; i < prog.length; i++) {
    const c = prog[i];
    if (c === 'L') b = { ...b, d: (b.d + 3) % 4 };
    else if (c === 'R') b = { ...b, d: (b.d + 1) % 4 };
    else {
      const nx = b.x + DX[b.d], ny = b.y + DY[b.d];
      if (blocked(world, nx, ny)) return { states, crash: i };
      b = { ...b, x: nx, y: ny };
    }
    states.push(b);
  }
  return { states, crash: -1 };
}

/** Expand "forward 3" style moves into single commands. */
export function expand(moves: (Cmd | [Cmd, number])[]): Cmd[] {
  return moves.flatMap((m) => (Array.isArray(m) ? Array<Cmd>(m[1]).fill(m[0]) : [m]));
}

// ---------------------------------------------------------------- robot pictures

/** The grid with walls, goal, the trail walked so far and the robot. */
export function botGrid(world: World, bot: Bot, trail: Bot[] = [], opts: { crash?: boolean; start?: Bot } = {}): HTMLElement {
  const sz = Math.min(44, Math.floor(330 / world.w));
  const g = h('div', { style: `display:grid;grid-template-columns:repeat(${world.w},${sz}px);gap:3px;justify-content:center;margin:4px auto;` });
  for (let y = world.h - 1; y >= 0; y--) {
    for (let x = 0; x < world.w; x++) {
      const wall = world.walls?.some(([a, b]) => a === x && b === y);
      const goal = world.goal && world.goal[0] === x && world.goal[1] === y;
      const here = bot.x === x && bot.y === y;
      const walked = trail.some((t) => t.x === x && t.y === y);
      const isStart = opts.start && opts.start.x === x && opts.start.y === y && !here;
      let bg = 'var(--panel2)';
      if (wall) bg = 'color-mix(in srgb, var(--text) 62%, transparent)';
      else if (goal) bg = 'color-mix(in srgb, var(--c2) 30%, var(--panel2))';
      else if (walked) bg = 'color-mix(in srgb, var(--c1) 20%, var(--panel2))';
      const txt = here ? ARROW[bot.d] : goal ? '★' : isStart ? '·' : '';
      const col = here ? (opts.crash ? 'var(--bad)' : 'var(--c1)') : goal ? 'var(--c2)' : 'var(--muted)';
      g.appendChild(h('div', {
        style: `width:${sz}px;height:${sz}px;border-radius:6px;background:${bg};display:grid;place-items:center;font-size:${Math.round(sz * 0.55)}px;line-height:1;color:${col};font-weight:800;`,
      }, txt));
    }
  }
  return g;
}

/** Step through a fixed program: the program listing with the current command lit, and the grid. */
export function botSteps(world: World, start: Bot, prog: Cmd[], caption?: (i: number, b: Bot) => string): HTMLElement {
  const { states } = runBot(world, start, prog);
  const src = prog.map((c) => CMD_TEXT[c]).join('\n');
  let i = 0;
  const pic = h('div');
  const cap = h('div', { class: 'stepper-cap' });
  const prev = h('button', { class: 'ghost small-btn', onclick: () => go(i - 1) }, '‹ Back');
  const next = h('button', { class: 'ghost small-btn', onclick: () => go(i + 1) }, 'Next ›');
  const count = h('span', { class: 'muted small' });
  const go = (k: number) => {
    i = Math.max(0, Math.min(states.length - 1, k));
    const b = states[i];
    pic.replaceChildren(h('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center;' },
      botGrid(world, b, states.slice(0, i + 1), { start }),
      h('div', { style: 'min-width:150px;' }, codeBlock(src, { active: i || undefined }))));
    cap.textContent = caption ? caption(i, b) : i === 0 ? `Start: facing ${DIRS[b.d]}.` : `After line ${i}: facing ${DIRS[b.d]}.`;
    count.textContent = `${i} / ${states.length - 1}`;
    prev.disabled = i === 0;
    next.disabled = i === states.length - 1;
  };
  go(0);
  return h('div', { class: 'stepper' }, pic, cap, h('div', { class: 'stepper-ctl' }, prev, next, count));
}

// ---------------------------------------------------------------- robot task

export interface BotTaskOpts {
  world: World & { goal: [number, number] };
  start: Bot;
  /** The program is the body of `for _ in range(repeat):`. */
  repeat?: number;
  /** Most commands allowed in the program (or loop body). */
  maxLen?: number;
}

/** Build a program by tapping command buttons, then run it. Solved when the robot stops on the star. */
export function botTask(o: BotTaskOpts): Widget {
  return (ctx) => {
    const prog: Cmd[] = [];
    let running = 0;
    const pic = h('div');
    const list = h('div', { style: 'min-height:2.4em;' });
    const status = h('div', { class: 'stepper-cap', style: 'font-weight:600;' });
    const full = () => (o.repeat ? Array.from({ length: o.repeat }, () => prog).flat() : prog);
    const cap = o.maxLen ?? 30;
    const showList = () => {
      const lines = prog.map((c) => (o.repeat ? '    ' : '') + CMD_TEXT[c]);
      if (o.repeat) lines.unshift(`for _ in range(${o.repeat}):`);
      list.replaceChildren(prog.length || o.repeat
        ? codeBlock(lines.join('\n') + (prog.length ? '' : '\n    # tap commands below'))
        : h('div', { class: 'muted small', style: 'text-align:center;padding:.6em;' }, 'Your program is empty. Tap commands below.'));
      addBtns.forEach((b) => { b.disabled = prog.length >= cap || !!running; });
      undo.disabled = clear.disabled = !prog.length || !!running;
      run.disabled = !prog.length || !!running;
    };
    const reset = (msg = '') => {
      pic.replaceChildren(botGrid(o.world, o.start, [], {}));
      status.textContent = msg;
    };
    const add = (c: Cmd) => { if (running || prog.length >= cap) return; prog.push(c); edited(); };
    const edited = () => { ctx.solved?.(false); showList(); reset(o.maxLen ? `${prog.length} of ${o.maxLen} commands used.` : ''); };
    const btn = (label: string, fn: () => void, primary = false) =>
      h('button', { class: primary ? 'primary small-btn' : 'ghost small-btn', style: 'font-family:ui-monospace,Menlo,Consolas,monospace;', onclick: fn }, label);
    const addBtns = (['F', 'L', 'R'] as Cmd[]).map((c) => btn(CMD_TEXT[c], () => add(c)));
    const undo = btn('Undo', () => { if (!running) { prog.pop(); edited(); } });
    const clear = btn('Clear', () => { if (!running) { prog.length = 0; edited(); } });
    const run = btn('▶ Run', () => go(), true);
    const go = () => {
      if (running || !prog.length) return;
      const p = full();
      const { states, crash } = runBot(o.world, o.start, p);
      let i = 0;
      const tick = () => {
        if (!pic.isConnected && i > 0) { running = 0; return; }
        const b = states[i];
        const last = i === states.length - 1;
        pic.replaceChildren(botGrid(o.world, b, states.slice(0, i + 1), { crash: last && crash >= 0, start: o.start }));
        if (!last) { i++; running = window.setTimeout(tick, 260); return; }
        running = 0;
        const [gx, gy] = o.world.goal;
        const ok = crash < 0 && b.x === gx && b.y === gy;
        if (crash >= 0) status.textContent = `Bump! Command ${crash + 1} (${CMD_TEXT[p[crash]]}) would leave the grid or hit a wall.`;
        else if (ok) status.textContent = '✓ The robot stops on the star.';
        else status.textContent = `The robot stopped at (${b.x}, ${b.y}), not on the star. Edit and run again.`;
        status.style.color = ok ? 'var(--good)' : crash >= 0 ? 'var(--bad)' : 'var(--text)';
        ctx.solved?.(ok);
        showList();
      };
      status.textContent = 'Running…';
      status.style.color = 'var(--text)';
      running = -1;
      showList();
      tick();
    };
    reset(o.maxLen ? `Up to ${o.maxLen} commands${o.repeat ? ' in the loop body' : ''}.` : '');
    showList();
    return h('div', null, pic, list,
      h('div', { class: 'stepper-ctl' }, addBtns),
      h('div', { class: 'stepper-ctl' }, undo, clear, run),
      status);
  };
}

// ---------------------------------------------------------------- debugging pieces

/** A code listing whose lines can be tapped. Solved when the tapped line is `bug` (1-based). */
export function lineHunt(src: string, bug: number, notes: Record<number, string> = {}): Widget {
  return (ctx) => {
    let picked = 0;
    const msg = h('div', { class: 'stepper-cap' }, 'Tap the line you think is wrong.');
    const box = h('div');
    const draw = () => {
      const pre = codeBlock(src, { active: picked || undefined });
      pre.querySelectorAll<HTMLElement>('.cl').forEach((el, k) => {
        el.style.cursor = 'pointer';
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `line ${k + 1}`);
        el.addEventListener('click', () => {
          picked = k + 1;
          ctx.solved?.(picked === bug);
          msg.textContent = notes[picked] ?? `Line ${picked} selected. Press Check.`;
          draw();
        });
      });
      box.replaceChildren(pre);
    };
    draw();
    return h('div', null, box, msg);
  };
}

/** A program and the error it stops with (shown like a terminal). */
export function errorBox(src: string, line: number, error: string): HTMLElement {
  return h('div', null,
    codeBlock(src, { active: line }),
    h('pre', { class: 'trace-out', style: 'border-left:4px solid var(--bad);white-space:pre-wrap;' },
      `Traceback (most recent call last):\n  line ${line}\n${error}`));
}

/** input(s) → [ name ] → output, the picture of a function call. */
export function fnMachine(name: string, inputs: string[], output: string, note?: string): HTMLElement {
  const pill = (t: string, c: string) => h('span', { style: `font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;padding:.35em .7em;border-radius:999px;border:2px solid ${c};background:color-mix(in srgb, ${c} 14%, var(--panel));` }, t);
  return h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;margin:6px 0;' },
    h('div', { style: 'display:flex;flex-direction:column;gap:6px;align-items:flex-end;' }, inputs.map((t) => pill(t, 'var(--c1)'))),
    h('span', { style: 'color:var(--muted);font-size:1.3rem;' }, '→'),
    h('div', { style: 'padding:.8em 1.1em;border-radius:12px;background:var(--panel2);border:2px solid var(--c4);text-align:center;' },
      h('div', { style: 'font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;' }, name),
      note ? h('div', { class: 'muted small' }, note) : null),
    h('span', { style: 'color:var(--muted);font-size:1.3rem;' }, '→'),
    pill(output, 'var(--c3)'));
}
