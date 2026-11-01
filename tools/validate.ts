// Content checks: run with `bun tools/validate.ts`. Fails (exit 1) on any malformed lesson step
// or practice problem. Generators are run with many seeds, since a bad number is worse than none.
import { ALL_COURSES as ALL } from '../src/courses';
import type { AskStep, Course, Step } from '../src/types';
import { seeded } from '../src/ui';

declare const process: { exit(code: number): never; argv: string[] };

// `bun tools/validate.ts src/courses/logic.ts` checks just that file's exported course(s).
let COURSES: Course[] = ALL;
const only = process.argv[2];
if (only) {
  const mod = await import(new URL('../' + only, import.meta.url).href);
  COURSES = Object.values(mod).filter((v): v is Course => !!v && typeof v === 'object' && 'lessons' in (v as object));
  if (!COURSES.length) { console.error(`no Course exported from ${only}`); process.exit(1); }
}

const errors: string[] = [];
const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

function checkAsk(where: string, s: AskStep) {
  if (!s.explain?.trim()) err(where, 'no explanation');
  if (!(s.body?.trim() || s.title)) err(where, 'no question text');
  switch (s.kind) {
    case 'choice': {
      const right = s.options.filter((o) => o.correct).length;
      if (right !== 1) err(where, `${right} correct options (want exactly 1)`);
      if (s.options.length < 2) err(where, 'fewer than 2 options');
      const texts = s.options.map((o) => o.text.trim());
      if (new Set(texts).size !== texts.length) err(where, `duplicate options: ${texts.join(' | ')}`);
      break;
    }
    case 'number':
      if (!Number.isFinite(s.answer)) err(where, `answer ${s.answer} not finite`);
      if (s.prob && (s.answer < 0 || s.answer > 1)) err(where, `probability ${s.answer} out of [0,1]`);
      if (s.tol !== undefined && (s.tol < 0 || !Number.isFinite(s.tol))) err(where, `bad tolerance ${s.tol}`);
      break;
    case 'estimate':
      if (s.answer < s.min || s.answer > s.max) err(where, `answer ${s.answer} outside slider ${s.min}..${s.max}`);
      if (Math.abs(((s.answer - s.min) / s.step) - Math.round((s.answer - s.min) / s.step)) > 1e-6) err(where, `answer ${s.answer} not on the slider grid`);
      break;
    case 'order':
      if (s.items.length < 3) err(where, 'order needs at least 3 items');
      if (new Set(s.items).size !== s.items.length) err(where, 'duplicate order items');
      break;
    case 'task':
      if (typeof s.widget !== 'function') err(where, 'task without widget');
      break;
    case 'multi': {
      const right = s.options.filter((o) => o.correct).length;
      if (right < 1) err(where, 'multi with no correct option');
      if (s.options.length < 3) err(where, 'multi needs at least 3 options');
      const texts = s.options.map((o) => o.text.trim());
      if (new Set(texts).size !== texts.length) err(where, `duplicate options: ${texts.join(' | ')}`);
      break;
    }
    case 'match': {
      if (s.pairs.length < 2) err(where, 'match needs at least 2 pairs');
      const L = s.pairs.map((p) => p[0].trim()), R = s.pairs.map((p) => p[1].trim());
      if (new Set(L).size !== L.length || new Set(R).size !== R.length) err(where, 'duplicate match items (pairs must be distinguishable)');
      break;
    }
    case 'sort': {
      if (s.bins.length < 2) err(where, 'sort needs at least 2 bins');
      if (s.items.length < 3) err(where, 'sort needs at least 3 items');
      for (const it of s.items) if (!(it.bin >= 0 && it.bin < s.bins.length && Number.isInteger(it.bin))) err(where, `item "${it.text}" has bad bin ${it.bin}`);
      const texts = s.items.map((i) => i.text.trim());
      if (new Set(texts).size !== texts.length) err(where, 'duplicate sort items');
      break;
    }
    case 'fill': {
      const marks = [...s.template.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]));
      if (!marks.length) err(where, 'fill template has no [[k]] blanks');
      if (new Set(marks).size !== marks.length) err(where, 'fill blank used twice');
      if (marks.length !== s.blanks.length || marks.some((k) => k >= s.blanks.length)) err(where, `fill template blanks ${marks} don't match ${s.blanks.length} blank specs`);
      s.blanks.forEach((b, k) => {
        if (!(b.answer >= 0 && b.answer < b.options.length)) err(where, `blank ${k} answer index ${b.answer} out of range`);
        if (b.options.length < 2) err(where, `blank ${k} has fewer than 2 tiles`);
        if (new Set(b.options).size !== b.options.length) err(where, `blank ${k} has duplicate tiles`);
      });
      break;
    }
    case 'point': {
      const { x, y } = s.plot;
      if (!(s.tol > 0)) err(where, 'point needs tol > 0');
      if (s.answer.x < x[0] || s.answer.x > x[1]) err(where, `answer x ${s.answer.x} outside plot ${x}`);
      if (s.answer.y !== undefined && (!y || s.answer.y < y[0] || s.answer.y > y[1])) err(where, `answer y ${s.answer.y} outside plot ${y}`);
      if (s.snap && Math.abs(s.answer.x / s.snap - Math.round(s.answer.x / s.snap)) > 1e-6) err(where, `answer x ${s.answer.x} not on snap grid ${s.snap}`);
      if (s.snap && s.answer.y !== undefined && Math.abs(s.answer.y / s.snap - Math.round(s.answer.y / s.snap)) > 1e-6) err(where, `answer y not on snap grid`);
      break;
    }
  }
}

function checkStep(where: string, s: Step) {
  if (s.kind === 'read') {
    if (!s.body?.trim() && !s.widget) err(where, 'empty read step');
    return;
  }
  checkAsk(where, s);
}

let lessons = 0, steps = 0, gens = 0;
const courseIds = new Set<string>();
for (const c of COURSES) {
  if (courseIds.has(c.id)) err(c.id, 'duplicate course id');
  courseIds.add(c.id);
  const ids = new Set<string>();
  if (c.lessons.length === 0) err(c.id, 'no lessons');
  for (const l of c.lessons) {
    lessons++;
    const w = `${c.id}/${l.id}`;
    if (ids.has(l.id)) err(w, 'duplicate lesson id');
    ids.add(l.id);
    if (l.steps.length < 4) err(w, `only ${l.steps.length} steps`);
    if (!l.steps.some((s) => s.kind !== 'read')) err(w, 'no questions');
    if (l.practice.length === 0) err(w, 'no practice generators');
    l.steps.forEach((s, i) => { steps++; checkStep(`${w}#${i + 1}`, s); });
    l.practice.forEach((g, gi) => {
      gens++;
      const seen = new Set<string>();
      for (let seed = 1; seed <= 500; seed++) {
        let s: AskStep;
        try {
          s = g(seeded(seed * 2654435761));
        } catch (e) {
          err(`${w} practice ${gi}`, `threw on seed ${seed}: ${e}`);
          break;
        }
        checkAsk(`${w} practice ${gi} seed ${seed}`, s);
        seen.add(s.body ?? '');
        if (errors.length > 40) break;
      }
      if (seen.size < 3) err(`${w} practice ${gi}`, `only ${seen.size} distinct problems over 500 seeds`);
    });
  }
}

if (errors.length) {
  console.error(`CONTENT ERRORS (${errors.length}):\n` + errors.slice(0, 60).map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
console.log(`CONTENT OK: ${COURSES.length} courses, ${lessons} lessons, ${steps} steps, ${gens} generators x 500 seeds`);
