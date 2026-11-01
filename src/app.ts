// Screens and routing (#/, #/course/:id, #/lesson/:course/:lesson, #/practice, #/settings).
import { COURSES } from './courses';
import { play, type Item, type Result } from './player';
import { dueReviews, liveStreak, resetAll, save, schedule, solvedToday, state, countSolved, touchStreak, today } from './store';
import type { Course, Lesson } from './types';
import { h, md, pick, seeded, shuffle } from './ui';

const root = document.getElementById('app')!;

export function start() {
  applyTheme();
  window.addEventListener('hashchange', route);
  route();
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (parts[0] === 'course' && parts[1]) return courseScreen(parts[1]);
  if (parts[0] === 'lesson' && parts[1] && parts[2]) return lessonScreen(parts[1], parts[2]);
  if (parts[0] === 'practice') return practiceScreen();
  if (parts[0] === 'settings') return settingsScreen();
  homeScreen();
}

const go = (hash: string) => { location.hash = hash; };
const lessonKey = (c: Course, l: Lesson) => `${c.id}/${l.id}`;
const isDone = (c: Course, l: Lesson) => lessonKey(c, l) in state.done;
const courseProgress = (c: Course) => c.lessons.filter((l) => isDone(c, l)).length / c.lessons.length;
const nextLesson = (c: Course) => c.lessons.find((l) => !isDone(c, l));

// ---------------------------------------------------------------- shared chrome

function topBar(): HTMLElement {
  const goal = state.dailyGoal;
  const solved = solvedToday();
  return h('header', { class: 'top' },
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark' }, '◆'), 'Sharpen'),
    h('div', { class: 'top-stats' },
      h('span', { class: 'chip', title: 'Days in a row with some practice' }, '🔥 ', String(liveStreak())),
      h('span', { class: 'chip', title: `Today: ${solved} of ${goal} problems` }, ring(Math.min(1, solved / goal)), ` ${solved}/${goal}`),
      h('span', { class: 'chip', title: 'Experience points' }, '⚡ ', state.xp.toLocaleString('en-US')),
      h('a', { class: 'chip link', href: '#/settings', title: 'Settings', 'aria-label': 'Settings' }, '⚙')));
}

function ring(f: number): SVGSVGElement {
  const r = 7, c = 2 * Math.PI * r;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 18 18');
  s.setAttribute('class', 'ring');
  s.innerHTML = `<circle cx="9" cy="9" r="${r}" class="ring-bg"/><circle cx="9" cy="9" r="${r}" class="ring-fg" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 9 9)"/>`;
  return s;
}

function page(...kids: (Node | null | false)[]) {
  root.replaceChildren(topBar(), h('div', { class: 'page' }, ...kids));
}

// ---------------------------------------------------------------- home

function homeScreen() {
  const due = dueReviews().length;
  const started = COURSES.find((c) => courseProgress(c) > 0 && courseProgress(c) < 1);
  const cont = started ?? COURSES.find((c) => courseProgress(c) < 1) ?? COURSES[0];
  const nl = nextLesson(cont);
  const anyDone = Object.keys(state.done).length > 0;

  const today = h('section', { class: 'today' },
    h('div', { class: 'card hero', style: `--accent:${cont.color}` },
      h('div', { class: 'hero-icon' }, cont.icon),
      h('div', { class: 'hero-text' },
        h('div', { class: 'eyebrow' }, nl ? (courseProgress(cont) > 0 ? 'Continue' : 'Start here') : 'Course complete'),
        h('h2', null, nl ? nl.title : cont.title),
        h('p', { class: 'muted' }, nl ? `${cont.title} · ${nl.goal}` : 'Every lesson done. Keep it fresh with daily practice.')),
      nl ? h('button', { class: 'primary', onclick: () => go(`#/lesson/${cont.id}/${nl.id}`) }, courseProgress(cont) > 0 || state.resume[lessonKey(cont, nl)] ? 'Continue' : 'Start') : null),
    h('div', { class: 'card practice-card' },
      h('div', { class: 'hero-icon' }, '🧠'),
      h('div', { class: 'hero-text' },
        h('div', { class: 'eyebrow' }, 'Daily practice'),
        h('h2', null, due > 0 ? `${due} skill${due === 1 ? '' : 's'} due for review` : anyDone ? 'Mixed practice' : 'Unlocks after your first lesson'),
        h('p', { class: 'muted' }, anyDone ? 'Fresh problems on what you’ve learned, mixed up, with what you missed coming back sooner.' : 'Finish a lesson and its ideas come back here, spaced out so they stick.')),
      h('button', { class: anyDone ? 'primary' : 'ghost', disabled: !anyDone, onclick: () => go('#/practice') }, 'Practise')));

  const grid = h('section', { class: 'courses' },
    COURSES.map((c) => {
      const p = courseProgress(c);
      return h('a', { class: 'card course', href: `#/course/${c.id}`, style: `--accent:${c.color}` },
        h('div', { class: 'course-icon' }, c.icon),
        h('h3', null, c.title),
        h('p', { class: 'muted' }, c.blurb),
        h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: `width:${p * 100}%` })),
        h('div', { class: 'small muted' }, `${c.lessons.filter((l) => isDone(c, l)).length} of ${c.lessons.length} lessons`));
    }));

  page(today, h('h2', { class: 'section-title' }, 'Courses'), grid,
    h('p', { class: 'footnote muted' }, 'Learn by doing: every lesson is a run of small problems. Answer first, then see why.'));
}

// ---------------------------------------------------------------- course

function courseScreen(id: string) {
  const c = COURSES.find((x) => x.id === id);
  if (!c) return go('#/');
  const nl = nextLesson(c);
  page(
    h('a', { class: 'back', href: '#/' }, '‹ All courses'),
    h('div', { class: 'course-head', style: `--accent:${c.color}` },
      h('div', { class: 'course-icon big' }, c.icon),
      h('div', null, h('h1', null, c.title), h('p', { class: 'muted' }, c.blurb),
        h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: `width:${courseProgress(c) * 100}%` })))),
    h('ol', { class: 'path', style: `--accent:${c.color}` },
      c.lessons.map((l, k) => {
        const done = isDone(c, l);
        const isNext = l === nl;
        return h('li', { class: `path-item${done ? ' done' : ''}${isNext ? ' next' : ''}` },
          h('a', { href: `#/lesson/${c.id}/${l.id}` },
            h('span', { class: 'path-dot' }, done ? '✓' : String(k + 1)),
            h('span', { class: 'path-text' }, h('strong', null, l.title), h('span', { class: 'muted small' }, l.goal)),
            h('span', { class: 'path-go' }, done ? 'Review' : isNext ? 'Start' : '›')));
      })));
}

// ---------------------------------------------------------------- lesson

function lessonScreen(cid: string, lid: string) {
  const c = COURSES.find((x) => x.id === cid);
  const l = c?.lessons.find((x) => x.id === lid);
  if (!c || !l) return go('#/');
  const key = lessonKey(c, l);
  const items: Item[] = l.steps.map((step) => ({ step }));
  const resumeAt = !isDone(c, l) ? Math.min(state.resume[key] ?? 0, items.length - 1) : 0;
  play(root, {
    title: l.title,
    color: c.color,
    items,
    start: resumeAt,
    onProgress: (i) => { if (!isDone(c, l)) { state.resume[key] = i; save(); } },
    onAnswer: (_it, first) => countSolved(first, first ? 10 : 4),
    onDone: (r) => {
      const first = !isDone(c, l);
      state.done[key] = today();
      delete state.resume[key];
      touchStreak();
      // The lesson's skills join spaced review.
      l.practice.forEach((_g, gi) => schedule(`${key}/${gi}`, false));
      state.xp += first ? 20 : 0;
      save();
      summary(r, c, first ? 20 : 0, () => {
        const nx = nextLesson(c);
        return nx ? { label: `Next: ${nx.title}`, go: () => go(`#/lesson/${c.id}/${nx.id}`) } : null;
      }, `#/course/${c.id}`);
    },
    onClose: () => go(`#/course/${c.id}`),
  });
}

function summary(r: Result, c: Course | null, bonus: number, next: () => { label: string; go: () => void } | null, back: string) {
  const acc = r.asked ? Math.round((r.firstTry / r.asked) * 100) : 100;
  const nx = next();
  root.replaceChildren(topBar(), h('div', { class: 'page summary', style: `--accent:${c?.color ?? 'var(--accent-default)'}` },
    h('div', { class: 'summary-badge' }, acc >= 80 ? '🎉' : acc >= 50 ? '💪' : '🌱'),
    h('h1', null, acc >= 80 ? 'Nicely done' : acc >= 50 ? 'Good work' : 'Every miss is practice'),
    h('div', { class: 'summary-stats' },
      stat(`+${r.xp + bonus}`, 'XP'),
      stat(`${acc}%`, 'first try'),
      stat(String(liveStreak()), 'day streak')),
    r.missed.length ? h('p', { class: 'muted' }, 'What you missed comes back in daily practice soon.') : null,
    h('div', { class: 'summary-btns' },
      h('a', { class: 'btn ghost', href: back }, 'Back'),
      nx ? h('button', { class: 'primary', onclick: nx.go }, nx.label) : h('a', { class: 'btn primary', href: '#/' }, 'Home'))));
}

const stat = (v: string, label: string) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, v), h('div', { class: 'stat-l' }, label));

// ---------------------------------------------------------------- practice

/** Up to 10 problems: due reviews first (weakest first), then a mix from finished lessons. */
function practiceScreen() {
  const rng = seeded(Date.now() & 0xffffffff);
  const gens: { key: string; c: Course }[] = [];
  const keyed = new Map<string, { c: Course; l: Lesson; gi: number }>();
  for (const c of COURSES) for (const l of c.lessons) l.practice.forEach((_g, gi) => keyed.set(`${c.id}/${l.id}/${gi}`, { c, l, gi }));
  for (const r of dueReviews()) if (keyed.has(r.key)) gens.push({ key: r.key, c: keyed.get(r.key)!.c });
  const pool = shuffle(rng, [...keyed.keys()].filter((k) => k.split('/').slice(0, 2).join('/') in state.done && !gens.some((g) => g.key === k)));
  for (const k of pool) {
    if (gens.length >= 10) break;
    gens.push({ key: k, c: keyed.get(k)!.c });
  }
  if (!gens.length) return go('#/');
  // Interleave: don't run the same lesson's problems back to back when it can be helped.
  const picked = shuffle(rng, gens.slice(0, 10));
  const items: Item[] = picked.map(({ key }) => {
    const { l, gi } = keyed.get(key)!;
    return { step: l.practice[gi](rng), key };
  });
  const color = pick(rng, picked).c.color;
  play(root, {
    title: 'Daily practice',
    color,
    items,
    onAnswer: (it, first) => {
      countSolved(first, first ? 10 : 4);
      if (it.key) schedule(it.key, !first);
    },
    onDone: (r) => summary(r, null, 0, () => ({ label: 'More practice', go: () => practiceScreen() }), '#/'),
    onClose: () => go('#/'),
  });
}

// ---------------------------------------------------------------- settings

function settingsScreen() {
  const goalSel = h('select', { onchange: (e: Event) => { state.dailyGoal = Number((e.target as HTMLSelectElement).value); save(); } },
    [5, 10, 20, 30].map((n) => h('option', { value: n, selected: n === state.dailyGoal }, `${n} problems a day`)));
  const themeSel = h('select', { onchange: (e: Event) => { state.theme = (e.target as HTMLSelectElement).value as typeof state.theme; save(); applyTheme(); } },
    [['auto', 'Match the system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, t]) => h('option', { value: v, selected: v === state.theme }, t)));
  const acc = state.answered ? Math.round((state.correctFirst / state.answered) * 100) : 0;
  page(
    h('a', { class: 'back', href: '#/' }, '‹ Home'),
    h('h1', null, 'Settings'),
    h('div', { class: 'card settings' },
      h('label', null, 'Daily goal', goalSel),
      h('label', null, 'Theme', themeSel)),
    h('h2', { class: 'section-title' }, 'Your numbers'),
    h('div', { class: 'summary-stats' },
      stat(state.xp.toLocaleString('en-US'), 'XP'),
      stat(String(Object.keys(state.done).length), 'lessons done'),
      stat(state.answered ? `${acc}%` : '–', 'first try'),
      stat(String(state.review.length), 'skills in review')),
    h('div', { class: 'card settings danger' },
      md('**Start over.** Clears every lesson, your streak and your review queue on this device.'),
      h('button', { class: 'ghost', onclick: () => { if (confirm('Erase all progress on this device?')) { resetAll(); go('#/'); } } }, 'Erase progress')));
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme === 'auto' ? '' : state.theme;
}
