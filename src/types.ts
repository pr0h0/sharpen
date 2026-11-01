// Content model. A course is a list of lessons; a lesson is a list of steps, one per screen.
// Steps that ask something carry their own feedback. Generators make fresh problems for
// practice and review (same idea, new numbers), which is what makes recall stick.

export type Rng = () => number;

/** A widget is any interactive or illustrative element drawn into a step. */
export interface WidgetCtx {
  /** Interactive widgets that are themselves the answer call this when the learner has it right. */
  solved?: (ok: boolean) => void;
}
export type Widget = (ctx: WidgetCtx) => HTMLElement;

interface StepBase {
  /** Short heading shown above the prompt. */
  title?: string;
  /** Explanation or question, in light markdown: **bold**, *italic*, blank line = paragraph. */
  body?: string;
  widget?: Widget;
}

/** Read-only screen: an idea, a picture, a simulation to play with. */
export interface ReadStep extends StepBase {
  kind: 'read';
}

export interface Choice {
  text: string;
  correct?: boolean;
  /** Feedback shown when this option is picked (why it's right or the misconception behind it). */
  why?: string;
}

interface AskBase extends StepBase {
  /** Shown after answering: the reasoning, in a sentence or three. */
  explain: string;
  hint?: string;
}

export interface ChoiceStep extends AskBase {
  kind: 'choice';
  options: Choice[];
  /** Keep the given order (e.g. numeric options); otherwise options are shuffled. */
  ordered?: boolean;
}

export interface NumberStep extends AskBase {
  kind: 'number';
  answer: number;
  /** Absolute tolerance (default: 0.5% of the answer, at least 1e-9). */
  tol?: number;
  /** Accept answers given as percentages or fractions too (e.g. "25%", "1/4" for 0.25). */
  prob?: boolean;
  unit?: string;
}

/** Estimate on a slider; close enough counts. Trains calibration. */
export interface EstimateStep extends AskBase {
  kind: 'estimate';
  min: number;
  max: number;
  step: number;
  answer: number;
  tol: number;
  format?: (v: number) => string;
}

/** Put items in the right order (drag or tap arrows). Items are given in the correct order. */
export interface OrderStep extends AskBase {
  kind: 'order';
  items: string[];
}

/** The widget is the task: it reports success through ctx.solved. */
export interface TaskStep extends AskBase {
  kind: 'task';
  widget: Widget;
}

export type AskStep = ChoiceStep | NumberStep | EstimateStep | OrderStep | TaskStep;
export type Step = ReadStep | AskStep;

/** Makes a fresh practice problem (new numbers, same skill). */
export type Generator = (rng: Rng) => AskStep;

export interface Lesson {
  id: string;
  title: string;
  /** One line: what you'll be able to do after it. */
  goal: string;
  steps: Step[];
  /** Practice problems for daily review: the skill of this lesson with new surface details. */
  practice: Generator[];
}

export interface Course {
  id: string;
  title: string;
  blurb: string;
  /** Accent colour (CSS). */
  color: string;
  icon: string;
  lessons: Lesson[];
}
