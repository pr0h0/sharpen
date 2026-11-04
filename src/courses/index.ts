import type { Course } from '../types';
import { kit } from './_kit';
import { ai } from './ai';
import { algebra } from './algebra';
import { algorithms } from './algorithms';
import { bayes } from './bayes';
import { biases } from './biases';
import { code } from './code';
import { decisions } from './decisions';
import { geometry } from './geometry';
import { logic } from './logic';
import { mathThinking } from './math-thinking';
import { probability } from './probability';
import { science } from './science';
import { statistics } from './statistics';
import { finance } from './finance';
import { economics } from './economics';
import { systems } from './systems';
import { networks } from './networks';
import { calculus } from './calculus';
import { universe } from './universe';
import { crypto } from './crypto';
import { puzzles } from './puzzles';
import { strategy } from './strategy';
import { chemistry } from './chemistry';
import { negotiation } from './negotiation';
import { business } from './business';
import { queues } from './queues';
import { numberTheory } from './number-theory';
import { linearAlgebra } from './linear-algebra';
import { internet } from './internet';
import { databases } from './databases';

export interface Category {
  id: string;
  title: string;
  blurb: string;
  courses: Course[];
}

// Brilliant-like areas: math, data, computer science, science, plus reasoning and decisions.
export const CATEGORIES: Category[] = [
  { id: 'math', title: 'Math', blurb: 'Patterns, proof, algebra, space and change.', courses: [mathThinking, algebra, geometry, calculus, numberTheory, linearAlgebra] },
  { id: 'data', title: 'Probability & Data', blurb: 'Chance, evidence and what data does and doesn’t say.', courses: [probability, bayes, statistics] },
  { id: 'cs', title: 'Computer Science', blurb: 'Programs, algorithms and how machines learn.', courses: [code, algorithms, ai, crypto, internet, databases] },
  { id: 'science', title: 'Science', blurb: 'Estimate, model and test the physical world.', courses: [science, universe, chemistry] },
  { id: 'logic', title: 'Logic & Reasoning', blurb: 'Deduction and the mind’s built-in traps.', courses: [logic, biases, puzzles] },
  { id: 'decide', title: 'Decisions & Strategy', blurb: 'Choosing well under uncertainty and against others.', courses: [decisions, strategy, negotiation] },
  { id: 'money', title: 'Money & Economics', blurb: 'Compounding, incentives, prices and trade-offs.', courses: [finance, economics, business] },
  { id: 'systems', title: 'Systems & Networks', blurb: 'Feedback loops, delays, and how things spread.', courses: [systems, networks, queues] },
];

/** Courses with content (placeholders without lessons are left out). */
export const COURSES: Course[] = CATEGORIES.flatMap((c) => c.courses).filter((c) => c.lessons.length > 0);
/** Reachable by URL (#/lesson/_kit/all) for QA, but not listed or used in practice. */
export const ALL_COURSES: Course[] = [...COURSES, kit];
