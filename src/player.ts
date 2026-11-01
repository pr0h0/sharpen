// Plays a sequence of steps, one per screen: lessons, daily practice and review all use this.
import type { AskStep, ChoiceStep, EstimateStep, FillStep, MatchStep, MultiStep, NumberStep, OrderStep, PointStep, SortStep, Step, TaskStep } from './types';
import { h, md, parseNumber, shuffle, seeded, svg } from './ui';
import { plot } from './viz/plot';

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
    } else if (/^[1-9]$/.test(e.key) && !(e.target instanceof HTMLInputElement)) {
      // Number keys pick multiple-choice options.
      const opt = body.querySelectorAll<HTMLButtonElement>('.option')[Number(e.key) - 1];
      opt?.click();
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
      case 'multi': [judge, reveal] = multiInput(st, setReady); break;
      case 'match': [judge, reveal] = matchInput(st, setReady); break;
      case 'sort': [judge, reveal] = sortInput(st, setReady); break;
      case 'fill': [judge, reveal] = fillInput(st, setReady); break;
      case 'point': [judge, reveal] = pointInput(st, setReady); break;
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

  type Judge = [() => [boolean, string | undefined], () => void];
  const locked = () => body.classList.contains('locked');
  const seedOf = (st: AskStep) => (st.body?.length ?? 0) * 131 + (st.title?.length ?? 0) * 7 + 1;

  function multiInput(st: MultiStep, ready: (ok: boolean) => void): Judge {
    widgetBox(st);
    const opts = st.ordered ? st.options : shuffle(seeded(st.options.length * 7919 + seedOf(st)), st.options);
    const on = opts.map(() => false);
    const btns = opts.map((o, k) =>
      h('button', { class: 'option multi', role: 'checkbox', 'aria-checked': 'false', onclick: () => {
        if (locked()) return;
        on[k] = !on[k];
        btns[k].classList.toggle('picked', on[k]);
        btns[k].setAttribute('aria-checked', String(on[k]));
        btns.forEach((b) => b.classList.remove('wrong', 'right', 'missed'));
        ready(on.some(Boolean));
      } }, h('span', { class: 'box' }), md(o.text)));
    body.appendChild(h('div', { class: 'muted small' }, 'Select all that apply.'));
    body.appendChild(h('div', { class: 'options' }, btns));
    return [
      () => {
        let ok = true;
        const whys: string[] = [];
        opts.forEach((o, k) => {
          const good = !!o.correct === on[k];
          if (!good) ok = false;
          if (on[k] && !o.correct) { btns[k].classList.add('wrong'); if (o.why) whys.push(o.why); }
        });
        const missed = opts.filter((o, k) => o.correct && !on[k]).length;
        if (ok) btns.forEach((b, k) => { if (on[k]) b.classList.add('right'); });
        else if (missed) whys.push(missed === 1 ? 'One more option belongs in your selection.' : `${missed} more options belong in your selection.`);
        return [ok, whys.join('\n\n') || undefined];
      },
      () => btns.forEach((b, k) => { b.classList.toggle('picked', !!opts[k].correct); b.classList.toggle('right', !!opts[k].correct); b.classList.remove('wrong'); }),
    ];
  }

  function matchInput(st: MatchStep, ready: (ok: boolean) => void): Judge {
    widgetBox(st);
    const n = st.pairs.length;
    const rightOrder = shuffle(seeded(n * 977 + seedOf(st)), st.pairs.map((_, k) => k));
    if (rightOrder.every((x, k) => x === k) && n > 1) rightOrder.push(rightOrder.shift()!);
    const link: number[] = Array(n).fill(-1); // left k -> right index (into pairs)
    let sel = -1;
    const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c1)', 'var(--c2)'];
    const L = st.pairs.map((p, k) => h('button', { class: 'match-item', 'data-k': k, onclick: () => { if (locked()) return; sel = k; draw(); } }, md(p[0])));
    const R = rightOrder.map((pi) => h('button', { class: 'match-item', 'data-k': pi, onclick: () => {
      if (locked() || sel < 0) return;
      for (let j = 0; j < n; j++) if (link[j] === pi) link[j] = -1;
      link[sel] = pi;
      sel = link.indexOf(-1);
      draw();
    } }, md(st.pairs[pi][1])));
    const draw = () => {
      L.forEach((b, k) => {
        b.classList.toggle('sel', k === sel);
        b.classList.remove('wrong', 'right');
        b.style.setProperty('--mc', link[k] >= 0 ? colors[k] : 'transparent');
        b.classList.toggle('linked', link[k] >= 0);
      });
      R.forEach((b, j) => {
        const pi = rightOrder[j];
        const owner = link.indexOf(pi);
        b.classList.remove('wrong', 'right');
        b.style.setProperty('--mc', owner >= 0 ? colors[owner] : 'transparent');
        b.classList.toggle('linked', owner >= 0);
        b.classList.toggle('armed', sel >= 0);
      });
      ready(link.every((x) => x >= 0));
    };
    sel = 0;
    body.appendChild(h('div', { class: 'muted small' }, 'Tap an item on the left, then its partner on the right.'));
    body.appendChild(h('div', { class: 'match' },
      h('div', { class: 'match-col' }, st.heads ? h('div', { class: 'match-head' }, st.heads[0]) : null, L),
      h('div', { class: 'match-col' }, st.heads ? h('div', { class: 'match-head' }, st.heads[1]) : null, R)));
    draw();
    return [
      () => {
        let bad = 0;
        link.forEach((pi, k) => { const ok = pi === k; if (!ok) bad++; L[k].classList.add(ok ? 'right' : 'wrong'); });
        return [bad === 0, bad ? `${bad} of ${n} pairs aren’t right yet.` : undefined];
      },
      () => { for (let k = 0; k < n; k++) link[k] = k; sel = -1; draw(); L.forEach((b) => b.classList.add('right')); },
    ];
  }

  function sortInput(st: SortStep, ready: (ok: boolean) => void): Judge {
    widgetBox(st);
    const order = shuffle(seeded(st.items.length * 613 + seedOf(st)), st.items.map((_, k) => k));
    const place: number[] = st.items.map(() => -1);
    let sel = order[0];
    const chip = (k: number) => h('button', { class: `chip-item${k === sel ? ' sel' : ''}`, 'data-k': k, onclick: () => { if (locked()) return; sel = sel === k ? -1 : k; draw(); } }, md(st.items[k].text));
    const tray = h('div', { class: 'tray' });
    const bins = st.bins.map((name, b) => h('div', { class: 'bin', 'data-bin': b, onclick: (e: Event) => {
      if (locked() || sel < 0) return;
      if ((e.target as HTMLElement).closest('.chip-item')) return;
      place[sel] = b;
      sel = order.find((k) => place[k] < 0) ?? -1;
      draw();
    } }, h('div', { class: 'bin-head' }, name), h('div', { class: 'bin-items' })));
    const draw = () => {
      tray.replaceChildren(...order.filter((k) => place[k] < 0).map(chip));
      if (!tray.childNodes.length) tray.appendChild(h('span', { class: 'muted small' }, 'All placed. Tap an item to move it.'));
      bins.forEach((bin, b) => {
        bin.classList.toggle('armed', sel >= 0);
        bin.querySelector('.bin-items')!.replaceChildren(...order.filter((k) => place[k] === b).map(chip));
      });
      ready(place.every((p) => p >= 0));
    };
    body.appendChild(h('div', { class: 'muted small' }, 'Tap an item, then the group it belongs to.'));
    body.append(tray, h('div', { class: 'bins', style: `grid-template-columns:repeat(${Math.min(st.bins.length, 3)}, 1fr)` }, bins));
    draw();
    return [
      () => {
        let bad = 0;
        body.querySelectorAll<HTMLElement>('.bin .chip-item').forEach((el) => {
          const k = Number(el.dataset.k);
          const ok = st.items[k].bin === place[k];
          if (!ok) bad++;
          el.classList.add(ok ? 'right' : 'wrong');
        });
        return [bad === 0, bad ? `${bad} item${bad === 1 ? ' is' : 's are'} in the wrong group.` : undefined];
      },
      () => { st.items.forEach((it, k) => { place[k] = it.bin; }); sel = -1; draw(); body.querySelectorAll('.bin .chip-item').forEach((el) => el.classList.add('right')); },
    ];
  }

  function fillInput(st: FillStep, ready: (ok: boolean) => void): Judge {
    widgetBox(st);
    const val: number[] = st.blanks.map(() => -1);
    let active = 0;
    const slots: HTMLButtonElement[] = [];
    const tpl = h(st.code ? 'pre' : 'div', { class: st.code ? 'code fill-code' : 'fill-text' });
    // Split on [[k]] markers, keeping text (and newlines for code).
    const parts = st.template.split(/\[\[(\d+)\]\]/);
    parts.forEach((p, i) => {
      if (i % 2 === 0) { if (p) tpl.appendChild(st.code ? document.createTextNode(p) : h('span', null, p)); return; }
      const k = Number(p);
      const b = h('button', { class: 'slot', 'data-k': k, onclick: () => { if (locked()) return; active = k; draw(); } }, '   ');
      slots[k] = b;
      tpl.appendChild(b);
    });
    const bank = h('div', { class: 'bank' });
    const draw = () => {
      slots.forEach((b, k) => {
        b.textContent = val[k] >= 0 ? st.blanks[k].options[val[k]] : '?';
        b.classList.toggle('active', k === active);
        b.classList.toggle('filled', val[k] >= 0);
        b.classList.remove('wrong', 'right');
      });
      const bl = st.blanks[active];
      const order = shuffle(seeded(active * 37 + bl.options.length + seedOf(st)), bl.options.map((_, j) => j));
      bank.replaceChildren(...(bl ? order.map((j) => h('button', { class: `tile${val[active] === j ? ' picked' : ''}`, onclick: () => {
        if (locked()) return;
        val[active] = j;
        const nxt = val.findIndex((v) => v < 0);
        if (nxt >= 0) active = nxt;
        draw();
      } }, bl.options[j])) : []));
      ready(val.every((v) => v >= 0));
    };
    body.append(tpl, h('div', { class: 'muted small' }, 'Tap a blank, then a tile.'), bank);
    draw();
    return [
      () => {
        let bad = 0;
        slots.forEach((b, k) => { const ok = val[k] === st.blanks[k].answer; if (!ok) bad++; b.classList.add(ok ? 'right' : 'wrong'); });
        return [bad === 0, bad ? `${bad} blank${bad === 1 ? ' isn’t' : 's aren’t'} right yet.` : undefined];
      },
      () => { st.blanks.forEach((b, k) => { val[k] = b.answer; }); draw(); slots.forEach((b) => b.classList.add('right')); },
    ];
  }

  function pointInput(st: PointStep, ready: (ok: boolean) => void): Judge {
    if (st.widget) widgetBox(st);
    const v = plot(st.plot);
    const oneD = !st.plot.y;
    let at: [number, number] | null = null;
    const marker = svg('g', { class: 'marker', visibility: 'hidden' });
    marker.append(svg('circle', { r: 9 }), svg('circle', { r: 3, class: 'marker-dot' }));
    const guide = svg('line', { class: 'marker-guide', visibility: 'hidden' });
    v.el.append(guide, marker);
    const readout = h('div', { class: 'readout' }, oneD ? 'Tap the line to place your point.' : 'Tap the graph to place your point.');
    const fmt = (x: number) => String(+x.toFixed(4));
    const set = (x: number, y: number) => {
      const s = st.snap;
      if (s) { x = Math.round(x / s) * s; y = Math.round(y / s) * s; }
      x = Math.min(st.plot.x[1], Math.max(st.plot.x[0], x));
      if (st.plot.y) y = Math.min(st.plot.y[1], Math.max(st.plot.y[0], y));
      at = [x, oneD ? 0 : y];
      const X = v.px(x), Y = v.py(at[1]);
      marker.setAttribute('transform', `translate(${X},${Y})`);
      marker.setAttribute('visibility', 'visible');
      if (oneD) { guide.setAttribute('visibility', 'hidden'); }
      readout.textContent = oneD ? `x = ${fmt(x)}` : `(${fmt(x)}, ${fmt(at[1])})`;
      ready(true);
    };
    const toData = (e: PointerEvent): [number, number] => {
      const r = v.el.getBoundingClientRect();
      const vb = v.el.viewBox.baseVal;
      const sx = ((e.clientX - r.left) / r.width) * vb.width;
      const sy = ((e.clientY - r.top) / r.height) * vb.height;
      return [v.dx(sx), v.dy(sy)];
    };
    let drag = false;
    v.el.addEventListener('pointerdown', (e) => { if (locked()) return; drag = true; v.el.setPointerCapture(e.pointerId); set(...toData(e)); });
    v.el.addEventListener('pointermove', (e) => { if (drag && !locked()) set(...toData(e)); });
    v.el.addEventListener('pointerup', () => { drag = false; });
    v.el.classList.add('pickable');
    // For the automated test (tools/autoplay.js).
    (v.el as unknown as { __place: (x: number, y: number) => void }).__place = set;
    const wrap = h('div', { class: 'plot-wrap' });
    wrap.appendChild(v.el);
    body.append(wrap, readout);
    return [
      () => {
        if (!at) return [false, undefined];
        const ex = at[0] - st.answer.x;
        const ey = st.answer.y === undefined ? 0 : at[1] - st.answer.y;
        const ok = Math.abs(ex) <= st.tol + 1e-9 && Math.abs(ey) <= st.tol + 1e-9;
        if (ok) return [true, undefined];
        const tips: string[] = [];
        if (Math.abs(ex) > st.tol) tips.push(ex < 0 ? 'further right' : 'further left');
        if (Math.abs(ey) > st.tol) tips.push(ey < 0 ? 'higher' : 'lower');
        return [false, `Close the gap: ${tips.join(' and ')}.`];
      },
      () => { set(st.answer.x, st.answer.y ?? 0); marker.classList.add('right'); },
    ];
  }

  function taskInput(st: TaskStep, ready: (ok: boolean) => void): [() => [boolean, string | undefined], () => void] {
    let solvedNow = false;
    body.appendChild(h('div', { class: 'widget' }, st.widget({ solved: (ok) => { solvedNow = ok; ready(true); } })));
    ready(true); // always checkable, so a stuck learner gets feedback and can ask for the answer
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
