// Screens and routing (#/, #/course/:id, #/lesson/:course/:lesson, #/practice, #/game/:id, #/settings).
import { ALL_COURSES, CATEGORIES, COURSES } from './courses';
import { play, type Item, type Result } from './player';
import { GAMES } from './games';
import { dailySeed } from './games/game';
import { addXp, dueReviews, gameScore, recordGame, liveStreak, save, schedule, setSaveHook, setSetting, solvedToday, state, countSolved, touchStreak, today } from './store';
import { currentAccount, eraseEverywhere, lastSyncTime, onRemoteState, onSyncChange, queueSync, register, signIn, signOut, startSync, syncNow, syncStatus } from './sync';
import type { Course, Lesson } from './types';
import { h, md, pick, seeded, shuffle } from './ui';

const root = document.getElementById('app')!;

export function start() {
  applyTheme();
  setSaveHook(queueSync);
  // A pull brought new progress: redraw, unless a lesson is on screen (it picks it up after).
  onRemoteState(() => {
    applyTheme();
    if (!/^#\/(lesson|practice)/.test(location.hash)) route();
  });
  onSyncChange(updateAccountChip);
  window.addEventListener('hashchange', route);
  route();
  startSync();
}

let unmount: (() => void) | void;

function route() {
  if (unmount) { unmount(); unmount = undefined; }
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (parts[0] === 'course' && parts[1]) return courseScreen(parts[1]);
  if (parts[0] === 'lesson' && parts[1] && parts[2]) return lessonScreen(parts[1], parts[2]);
  if (parts[0] === 'practice') return practiceScreen();
  if (parts[0] === 'game' && parts[1]) return gameScreen(parts[1]);
  if (parts[0] === 'settings') return settingsScreen();
  if (parts[0] === 'account') return accountScreen();
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
    h('a', { class: 'brand', href: '#/', 'aria-label': 'Sharpen home' }, h('span', { class: 'brand-mark' }, '◆'), h('span', { class: 'brand-text' }, 'Sharpen')),
    h('div', { class: 'top-stats' },
      h('span', { class: 'chip', title: 'Days in a row with some practice' }, '🔥 ', String(liveStreak())),
      h('span', { class: 'chip', title: `Today: ${solved} of ${goal} problems` }, ring(Math.min(1, solved / goal)), ` ${solved}/${goal}`),
      h('span', { class: 'chip', title: 'Experience points' }, '⚡ ', state.xp.toLocaleString('en-US')),
      accountChip(),
      h('a', { class: 'chip link', href: '#/settings', title: 'Settings', 'aria-label': 'Settings' }, '⚙')));
}

const STATUS_TEXT: Record<string, string> = {
  off: 'Not syncing', syncing: 'Syncing…', synced: 'Synced', offline: 'Offline: will sync when back', error: 'Sync problem: will retry',
};

function accountChip(): HTMLElement {
  const a = h('a', { class: 'chip link account-chip', href: '#/account' });
  fillAccountChip(a);
  return a;
}

function fillAccountChip(a: HTMLElement) {
  const acc = currentAccount();
  const st = syncStatus();
  a.title = acc ? `${acc.username}: ${STATUS_TEXT[st]}` : 'Sign in to sync progress across devices';
  a.dataset.status = st;
  a.setAttribute('aria-label', acc ? `Account: ${acc.username}` : 'Sign in');
  a.replaceChildren(...(acc ? [h('span', { class: 'sync-dot' })] : []), h('span', { class: 'acct-icon' }, '👤'), h('span', { class: 'acct-name' }, acc ? acc.username : 'Sign in'));
}

function updateAccountChip() {
  document.querySelectorAll<HTMLElement>('.account-chip').forEach(fillAccountChip);
  const live = document.getElementById('sync-line');
  if (live) live.textContent = syncLine();
}

function syncLine(): string {
  const t = lastSyncTime();
  const st = syncStatus();
  return STATUS_TEXT[st] + (st === 'synced' && t ? ` · ${new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '');
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

  const card = (c: Course) => {
    const p = courseProgress(c);
    return h('a', { class: 'card course', href: `#/course/${c.id}`, style: `--accent:${c.color}` },
      h('div', { class: 'course-icon' }, c.icon),
      h('h3', null, c.title),
      h('p', { class: 'muted' }, c.blurb),
      h('div', { class: 'course-foot' },
        h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: `width:${p * 100}%` })),
        h('span', { class: 'small muted' }, `${c.lessons.filter((l) => isDone(c, l)).length}/${c.lessons.length}`)));
  };
  const cats = CATEGORIES.map((k) => ({ ...k, courses: k.courses.filter((c) => c.lessons.length) })).filter((k) => k.courses.length);
  const sections = h('div', null);
  const tabs = h('div', { class: 'cat-tabs', role: 'tablist' });
  const show = (id: string) => {
    homeCat = id;
    tabs.querySelectorAll<HTMLElement>('.cat-tab').forEach((t) => t.classList.toggle('on', t.dataset.cat === id));
    sections.replaceChildren(...cats.filter((k) => id === 'all' || k.id === id).map((k) =>
      h('section', null,
        h('div', { class: 'cat-head' }, h('h2', null, k.title), h('span', { class: 'muted small' }, k.blurb)),
        h('div', { class: 'courses' }, k.courses.map(card)))));
  };
  tabs.append(...[{ id: 'all', title: 'All' }, ...cats].map((k) =>
    h('button', { class: 'cat-tab', role: 'tab', 'data-cat': k.id, onclick: () => show(k.id) }, k.title)));
  show(cats.some((k) => k.id === homeCat) ? homeCat : 'all');

  const played = GAMES.filter((g) => gameScore(g.id) !== undefined).length;
  const games = h('section', null,
    h('div', { class: 'cat-head' }, h('h2', null, 'Daily games'), h('span', { class: 'muted small' }, `${played} of ${GAMES.length} played today · a new round every day`)),
    h('div', { class: 'games' }, GAMES.map((g) => {
      const sc = gameScore(g.id);
      return h('a', { class: `card game-tile${sc !== undefined ? ' played' : ''}`, href: `#/game/${g.id}`, style: `--accent:${g.color}`, title: g.blurb },
        h('span', { class: 'game-icon' }, g.icon),
        h('span', { class: 'game-name' }, g.title),
        h('span', { class: 'game-status' }, sc !== undefined ? `✓ ${sc}` : 'Play'));
    })));

  page(today, games, h('h2', { class: 'section-title' }, 'Courses'), tabs, sections,
    h('p', { class: 'footnote muted' }, 'Learn by doing: every lesson is a run of small problems. Answer first, then see why.'));
}

let homeCat = 'all';

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
  const c = ALL_COURSES.find((x) => x.id === cid);
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
      if (first) addXp(20);
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

// ---------------------------------------------------------------- daily games

const gameCss = new Set<string>();

function gameScreen(id: string) {
  const g = GAMES.find((x) => x.id === id);
  if (!g) return go('#/');
  if (g.css && !gameCss.has(g.id)) { gameCss.add(g.id); document.head.append(h('style', null, g.css)); }
  const stage = h('div', { class: `game-stage g-${g.id}`, style: `--accent:${g.color}` });
  const after = h('div');
  const course = g.course ? COURSES.find((c) => c.id === g.course) : undefined;
  const todayScore = gameScore(g.id);

  const run = (daily: boolean) => {
    if (unmount) unmount();
    stage.replaceChildren();
    after.replaceChildren();
    const seed = daily ? dailySeed(g.id, today()) : (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    let over = false;
    unmount = g.mount(stage, {
      rng: seeded(seed), seed, daily,
      finish: (raw, note) => {
        if (over) return;
        over = true;
        const score = Math.max(0, Math.min(100, Math.round(raw)));
        const xp = daily ? recordGame(g.id, score) : 0;
        after.replaceChildren(result(score, note, daily, xp));
        after.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    });
  };

  const result = (score: number, note: string | undefined, daily: boolean, xp: number) =>
    h('div', { class: 'card game-result', style: `--accent:${g.color}` },
      h('div', { class: 'game-score' }, h('span', { class: 'stat-v' }, String(score)), h('span', { class: 'muted' }, ' / 100')),
      note ? md(note) : null,
      h('p', { class: 'muted small' }, daily
        ? `Today’s round is recorded${xp ? ` (+${xp} XP)` : ''}. Best ever: ${state.gameBest[g.id] ?? score}. A new round comes tomorrow.`
        : 'Practice round: not recorded.'),
      h('div', { class: 'account-btns' },
        h('button', { class: 'ghost', onclick: () => run(false) }, 'Practice round'),
        course ? h('a', { class: 'btn ghost', href: `#/course/${course.id}` }, `Course: ${course.title}`) : null,
        h('a', { class: 'btn primary', href: '#/' }, 'Home')));

  page(
    h('a', { class: 'back', href: '#/' }, '‹ Home'),
    h('div', { class: 'game-head', style: `--accent:${g.color}` },
      h('span', { class: 'game-icon big' }, g.icon),
      h('div', null, h('h1', null, g.title), h('p', { class: 'muted' }, g.blurb))),
    h('details', { class: 'game-how', open: todayScore === undefined }, h('summary', null, 'How to play'), md(g.how)),
    todayScore === undefined ? stage : h('div', null,
      h('div', { class: 'card game-result', style: `--accent:${g.color}` },
        h('div', { class: 'game-score' }, h('span', { class: 'stat-v' }, String(todayScore)), h('span', { class: 'muted' }, ' / 100')),
        h('p', { class: 'muted' }, `You’ve played today’s round. Best ever: ${state.gameBest[g.id] ?? todayScore}. A new one comes tomorrow.`),
        h('div', { class: 'account-btns' }, h('button', { class: 'primary', onclick: (e: Event) => { (e.currentTarget as HTMLElement).closest('.game-result')!.remove(); run(false); } }, 'Practice round'))),
      stage),
    after);
  if (todayScore === undefined) run(true);
}

// ---------------------------------------------------------------- settings

function settingsScreen() {
  const goalSel = h('select', { onchange: (e: Event) => { setSetting('dailyGoal', Number((e.target as HTMLSelectElement).value)); } },
    [5, 10, 20, 30].map((n) => h('option', { value: n, selected: n === state.dailyGoal }, `${n} problems a day`)));
  const themeSel = h('select', { onchange: (e: Event) => { setSetting('theme', (e.target as HTMLSelectElement).value as typeof state.theme); applyTheme(); } },
    [['auto', 'Match the system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, t]) => h('option', { value: v, selected: v === state.theme }, t)));
  const acc = state.answered ? Math.round((state.correctFirst / state.answered) * 100) : 0;
  page(
    h('a', { class: 'back', href: '#/' }, '‹ Home'),
    h('h1', null, 'Settings'),
    h('div', { class: 'card settings' },
      h('label', null, 'Account', h('a', { href: '#/account' }, currentAccount() ? `${currentAccount()!.username} · ${STATUS_TEXT[syncStatus()]}` : 'Sign in to sync')),
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
      h('button', { class: 'ghost', onclick: async () => {
        const where = currentAccount() ? 'on every device signed in to this account' : 'on this device';
        if (confirm(`Erase all progress ${where}?`)) { await eraseEverywhere(); applyTheme(); go('#/'); }
      } }, 'Erase progress')));
}

// ---------------------------------------------------------------- account

function accountScreen() {
  const acc = currentAccount();
  if (acc) {
    page(
      h('a', { class: 'back', href: '#/' }, '‹ Home'),
      h('h1', null, 'Account'),
      h('div', { class: 'card account' },
        h('p', null, 'Signed in as ', h('strong', null, acc.username), '.'),
        h('p', { class: 'muted' }, 'Your progress is saved to this account and kept in step on every device you sign in on. You can keep learning offline; it syncs when you’re back.'),
        h('p', { id: 'sync-line', class: 'sync-line' }, syncLine()),
        h('div', { class: 'account-btns' },
          h('button', { class: 'ghost', onclick: () => void syncNow() }, 'Sync now'),
          h('button', { class: 'ghost', onclick: async () => { await signOut(); applyTheme(); go('#/'); } }, 'Sign out'))));
    return;
  }
  let mode: 'login' | 'register' = 'login';
  const user = h('input', { class: 'num text', type: 'text', autocomplete: 'username', placeholder: 'Username', autocapitalize: 'none', spellcheck: false, required: true });
  const pass = h('input', { class: 'num text', type: 'password', autocomplete: 'current-password', placeholder: 'Password', required: true });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'primary', type: 'submit' });
  const note = h('p', { class: 'muted small' });
  const tabs = h('div', { class: 'cat-tabs' });
  const draw = () => {
    tabs.replaceChildren(
      h('button', { class: `cat-tab${mode === 'login' ? ' on' : ''}`, type: 'button', onclick: () => { mode = 'login'; draw(); } }, 'Sign in'),
      h('button', { class: `cat-tab${mode === 'register' ? ' on' : ''}`, type: 'button', onclick: () => { mode = 'register'; draw(); } }, 'Create account'));
    submit.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    pass.placeholder = mode === 'login' ? 'Password' : 'Password (8+ characters)';
    note.textContent = mode === 'login'
      ? 'Progress made on this device before signing in is added to your account.'
      : 'Usernames: 3 to 32 letters, digits, dots, dashes or underscores. Your progress so far comes with you.';
    err.hidden = true;
  };
  const form = h('form', { class: 'card account', onsubmit: async (e: Event) => {
    e.preventDefault();
    submit.disabled = true;
    err.hidden = true;
    const problem = await (mode === 'login' ? signIn : register)(user.value.trim(), pass.value);
    submit.disabled = false;
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    applyTheme();
    go('#/');
  } }, tabs, user, pass, err, submit, note);
  draw();
  page(
    h('a', { class: 'back', href: '#/' }, '‹ Home'),
    h('h1', null, 'Sync your progress'),
    h('p', { class: 'muted' }, 'Sign in on each device to keep lessons, streak, XP and your review queue in step.'),
    form);
  setTimeout(() => user.focus(), 30);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme === 'auto' ? '' : state.theme;
}
