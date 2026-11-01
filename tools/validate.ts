// Content checks: run with `bun tools/validate.ts`. Fails (exit 1) on any malformed lesson step
// or practice problem. Generators are run with many seeds, since a bad number is worse than none.
import { COURSES } from '../src/courses';
import type { AskStep, Step } from '../src/types';
import { seeded } from '../src/ui';

declare const process: { exit(code: number): never };

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
