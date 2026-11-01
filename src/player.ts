// Plays a sequence of steps, one per screen: lessons, daily practice and review all use this.
import type { AskStep, ChoiceStep, EstimateStep, NumberStep, OrderStep, Step, TaskStep } from './types';
import { h, md, parseNumber, shuffle, seeded } from './ui';

export interface Item {
  step: Step;
  /** Review key of the skill this problem practises (practice/review sessions). */
  key?: string;
}

export interface Result {
  asked: number;
  firstTry: number;
  xp: number;
  /** Review keys answered wrong at first. */
  missed: string[];
}

export interface Session {
  title: string;
  color: string;
  items: Item[];
  /** Index to start from (resuming a lesson). */
  start?: number;
  onProgress?: (index: number) => void;
  onAnswer?: (item: Item, firstTry: boolean) => void;
  onDone: (r: Result) => void;
  onClose: () => void;
}

const XP_FIRST = 10;
const XP_LATER = 4;

export function play(root: HTMLElement, s: Session) {
  let i = s.start ?? 0;
  const res: Result = { asked: 0, firstTry: 0, xp: 0, missed: [] };

  const bar = h('div', { class: 'bar-fill', style: `background:${s.color}` });
  const body = h('main', { class: 'step' });
  const foot = h('footer', { class: 'step-foot' });
  root.replaceChildren(
    h('div', { class: 'player' },
      h('header', { class: 'player-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'Close', title: 'Close (progress is kept)', onclick: () => s.onClose() }, '✕'),
        h('div', { class: 'bar' }, bar),
        h('span', { class: 'player-title' }, s.title)),
      body, foot));

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      const btn = foot.querySelector<HTMLButtonElement>('button.primary:not([disabled])');
      if (btn && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        btn.click();
      }
    } else if (e.key === 'Escape') {
      s.onClose();
    }
  };
  document.addEventListener('keydown', keyHandler);
  const cleanup = () => document.removeEventListener('keydown', keyHandler);
  const close = s.onClose;
  s.onClose = () => { cleanup(); close(); };

  function show() {
    bar.style.width = `${(i / s.items.length) * 100}%`;
    s.onProgress?.(i);
    if (i >= s.items.length) {
      cleanup();
      s.onDone(res);
      return;
    }
    const item = s.items[i];
    const st = item.step;
    // For the automated browser test (tools/autoplay.js): what's on screen now.
    (globalThis as { __sharpenStep?: Step }).__sharpenStep = st;
    body.replaceChildren();
    body.classList.remove('locked'); // the previous answer's lock must not carry over
    foot.replaceChildren();
    body.scrollTop = 0;
    window.scrollTo(0, 0);
    if (st.title) body.appendChild(h('h2', null, st.title));
    if (st.body) body.appendChild(md(st.body));
    if (st.kind === 'read') {
      if (st.widget) body.appendChild(h('div', { class: 'widget' }, st.widget({})));
      foot.appendChild(h('button', { class: 'primary', onclick: next }, 'Continue'));
      return;
    }
    ask(item, st);
  }

  function next() {
    i += 1;
    show();
  }

  // ------------------------------------------------------------ asking

  function ask(item: Item, st: AskStep) {
    let tries = 0;
    let answered = false;
    const fb = h('div', { class: 'feedback', hidden: true });
    const check = h('button', { class: 'primary', disabled: true }, 'Check');
    const hintBtn: HTMLButtonElement | null = st.hint ? h('button', { class: 'ghost', onclick: () => { hintBox.hidden = false; hintBtn?.remove(); } }, 'Hint') : null;
    const hintBox = h('div', { class: 'hint', hidden: true }, st.hint ? md(st.hint) : null);

    // Each kind builds its input and returns a judge: () => [correct, feedback for the chosen answer].
    let judge: () => [boolean, string | undefined];
    let reveal: () => void = () => {};
    const setReady = (ok: boolean) => { check.disabled = !ok || answered; };

    switch (st.kind) {
      case 'choice': [judge, reveal] = choiceInput(st, setReady); break;
      case 'number': [judge, reveal] = numberInput(st, setReady); break;
      case 'estimate': [judge, reveal] = estimateInput(st, setReady); break;
      case 'order': [judge, reveal] = orderInput(st, setReady); break;
      case 'task': [judge, reveal] = taskInput(st, setReady); break;
    }
    body.append(hintBox, fb);

    const finish = (firstTry: boolean) => {
      answered = true;
      res.asked += 1;
      if (firstTry) res.firstTry += 1;
      else if (item.key && !res.missed.includes(item.key)) res.missed.push(item.key);
      res.xp += firstTry ? XP_FIRST : XP_LATER;
      s.onAnswer?.(item, firstTry);
    };

    check.onclick = () => {
      const [ok, why] = judge();
      tries += 1;
      fb.hidden = false;
      fb.className = 'feedback ' + (ok ? 'good' : 'bad');
      fb.replaceChildren(h('div', { class: 'fb-head' }, ok ? (tries === 1 ? pickPraise() : 'Got it.') : 'Not quite.'));
      if (why) fb.appendChild(md(why));
      if (ok) fb.appendChild(md(st.explain));
      foot.replaceChildren();
      if (ok) {
        finish(tries === 1);
        body.classList.add('locked');
        foot.appendChild(h('button', { class: 'primary', onclick: next }, 'Continue'));
      } else {
        foot.append(
          h('button', { class: 'ghost', onclick: () => {
            // Give up: show the answer and the reasoning, count it as a miss.
            finish(false);
            reveal();
            fb.className = 'feedback shown';
            fb.replaceChildren(h('div', { class: 'fb-head' }, 'Here’s the answer'), md(st.explain));
            body.classList.add('locked');
            foot.replaceChildren(h('button', { class: 'primary', onclick: next }, 'Continue'));
          } }, 'Show answer'),
          h('button', { class: 'primary', onclick: () => {
            // Back to answering; the hint stays on offer if it hasn't been opened.
            fb.hidden = true;
            foot.replaceChildren(...(hintBtn && hintBox.hidden ? [hintBtn] : []), check);
            setReady(true);
          } }, 'Try again'));
      }
    };
    if (hintBtn) foot.appendChild(hintBtn);
    foot.appendChild(check);
  }

  // ------------------------------------------------------------ inputs

  function widgetBox(st: Step, solved?: (ok: boolean) => void) {
    if (st.widget) body.appendChild(h('div', { class: 'widget' }, st.widget({ solved })));
  }

  function choiceInput(st: ChoiceStep, ready: (ok: boolean) => void): [() => [boolean, string | undefined], () => void] {
    widgetBox(st);
    const opts = st.ordered ? st.options : shuffle(seeded(st.options.length * 7919 + (st.body?.length ?? 0)), st.options);
    let chosen = -1;
    const btns = opts.map((o, k) =>
      h('button', { class: 'option', onclick: () => {
        if (body.classList.contains('locked')) return;
        chosen = k;
        btns.forEach((b, j) => b.classList.toggle('picked', j === k));
        ready(true);
      } }, md(o.text)));
    body.appendChild(h('div', { class: 'options' }, btns));
    return [
      () => {
        const o = opts[chosen];
        btns.forEach((b) => b.classList.remove('wrong'));
        if (!o.correct) btns[chosen].classList.add('wrong');
        else btns[chosen].classList.add('right');
        return [!!o.correct, o.why];
      },
      () => btns.forEach((b, k) => b.classList.toggle('right', !!opts[k].correct)),
    ];
  }

  function numberInput(st: NumberStep, ready: (ok: boolean) => void): [() => [boolean, string | undefined], () => void] {
    widgetBox(st);
    const inp = h('input', { class: 'num', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: st.prob ? 'e.g. 0.25, 25% or 1/4' : 'Your answer' });
    inp.addEventListener('input', () => ready(!Number.isNaN(parseNumber(inp.value))));
    body.appendChild(h('div', { class: 'num-row' }, inp, st.unit ? h('span', { class: 'unit' }, st.unit) : null));
    setTimeout(() => inp.focus(), 30);
    return [
      () => {
        const v = parseNumber(inp.value);
        const tol = st.tol ?? Math.max(1e-9, Math.abs(st.answer) * 0.005);
        let ok = Math.abs(v - st.answer) <= tol;
        // Someone typing 25 for a probability of 25% means 0.25.
        if (!ok && st.prob && v > 1 && Math.abs(v / 100 - st.answer) <= tol) ok = true;
        return [ok, ok ? undefined : st.prob && v > 1 && !inp.value.includes('%') ? 'Probabilities are between 0 and 1 (or write a percentage like 25%).' : undefined];
      },
      () => { inp.value = String(+st.answer.toPrecision(6)); },
    ];
  }

  function estimateInput(st: EstimateStep, ready: (ok: boolean) => void): [() => [boolean, string | undefined], () => void] {
    widgetBox(st);
    const fmt = st.format ?? ((v: number) => String(v));
    const mid = st.min + Math.round((st.max - st.min) / 2 / st.step) * st.step;
    const out = h('div', { class: 'est-value' }, fmt(mid));
    const sl = h('input', { type: 'range', min: st.min, max: st.max, step: st.step, value: mid, class: 'est' });
    let moved = false;
    sl.addEventListener('input', () => { out.textContent = fmt(Number(sl.value)); moved = true; ready(true); });
    body.appendChild(h('div', { class: 'est-box' }, out, sl,
      h('div', { class: 'est-ends' }, h('span', null, fmt(st.min)), h('span', null, fmt(st.max)))));
    return [
      () => {
        const v = Number(sl.value);
        const ok = Math.abs(v - st.answer) <= st.tol + 1e-9;
        return [ok, ok ? undefined : v < st.answer ? 'Higher than that.' : 'Lower than that.'];
      },
      () => { sl.value = String(st.answer); out.textContent = fmt(st.answer); void moved; },
    ];
  }

  function orderInput(st: OrderStep, ready: (ok: boolean) => void): [() => [boolean, string | undefined], () => void] {
    widgetBox(st);
    let cur = shuffle(seeded(st.items.length * 31 + st.items[0].length), st.items);
    if (cur.every((x, k) => x === st.items[k])) cur = [...cur.slice(1), cur[0]];
    const list = h('ol', { class: 'order' });
    const draw = () => {
      list.replaceChildren(...cur.map((txt, k) =>
        h('li', null,
          h('span', { class: 'order-text' }, md(txt)),
          h('span', { class: 'order-btns' },
            h('button', { class: 'icon-btn', 'aria-label': 'Move up', disabled: k === 0, onclick: () => move(k, -1) }, '▲'),
            h('button', { class: 'icon-btn', 'aria-label': 'Move down', disabled: k === cur.length - 1, onclick: () => move(k, 1) }, '▼')))));
    };
    const move = (k: number, d: number) => {
      if (body.classList.contains('locked')) return;
      const a = cur.slice();
      [a[k], a[k + d]] = [a[k + d], a[k]];
      cur = a;
      draw();
      ready(true);
    };
    draw();
    body.appendChild(list);
    ready(true);
    return [
      () => {
        const ok = cur.every((x, k) => x === st.items[k]);
        const firstBad = cur.findIndex((x, k) => x !== st.items[k]);
        return [ok, ok ? undefined : `Position ${firstBad + 1} isn’t right yet.`];
      },
      () => { cur = st.items.slice(); draw(); },
    ];
  }

  function taskInput(st: TaskStep, ready: (ok: boolean) => void): [() => [boolean, string | undefined], () => void] {
    let solvedNow = false;
    body.appendChild(h('div', { class: 'widget' }, st.widget({ solved: (ok) => { solvedNow = ok; ready(true); } })));
    return [() => [solvedNow, solvedNow ? undefined : 'Not yet. Keep adjusting.'], () => {}];
  }

  show();
}

const PRAISE = ['Correct!', 'Nice.', 'Exactly.', 'Right.', 'Spot on.', 'Yes!'];
let praiseI = 0;
function pickPraise() {
  praiseI = (praiseI + 1) % PRAISE.length;
  return PRAISE[praiseI];
}
