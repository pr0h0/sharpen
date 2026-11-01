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
  /**
   * Ignored: options are shuffled every time the question is shown (purely numeric option sets are
   * sorted by value instead), so the answer's position never gives it away.
   */
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

/** Select all that apply: any number of options are correct (at least one). */
export interface MultiStep extends AskBase {
  kind: 'multi';
  options: Choice[];
  ordered?: boolean;
}

/** Pair each left item with its right item. Pairs are given matched; the right column is shuffled. */
export interface MatchStep extends AskBase {
  kind: 'match';
  pairs: [string, string][];
  /** Column headings, e.g. ['Graph', 'Equation']. */
  heads?: [string, string];
}

/** Sort items into bins (tap an item, then a bin). */
export interface SortStep extends AskBase {
  kind: 'sort';
  bins: string[];
  /** bin = index into bins. */
  items: { text: string; bin: number }[];
}

/**
 * Fill in the blanks from tiles. The template marks blank k as [[k]]; blanks[k] lists its tiles and
 * which one is right. With code: true the template is shown as monospace code, newlines kept.
 */
export interface FillStep extends AskBase {
  kind: 'fill';
  template: string;
  blanks: { options: string[]; answer: number }[];
  code?: boolean;
}

/** Click or drag to place a point on a plot (or a number line when plot.y is absent). */
export interface PointStep extends AskBase {
  kind: 'point';
  plot: PlotSpec;
  answer: { x: number; y?: number };
  /** Allowed distance from the answer in data units, per axis. */
  tol: number;
  /** Snap the marker to multiples of this (data units). */
  snap?: number;
}

/** A plot: axes and layers in data coordinates (see src/viz/plot.ts). */
export interface PlotSpec {
  x: [number, number];
  /** Leave out for a number line. */
  y?: [number, number];
  xlabel?: string;
  ylabel?: string;
  /** Tick spacing per axis (default: about 5-10 ticks). */
  ticks?: [number, number?];
  /** Same scale on both axes (geometry). */
  equal?: boolean;
  /** Pixel size of the drawing area (default 520 x 320, number line 520 x 90). */
  size?: [number, number];
  layers?: Layer[];
  grid?: boolean;
  tickFormat?: (v: number) => string;
}

export type Layer =
  | { type: 'fn'; f: (x: number) => number; color?: string; dash?: boolean; label?: string; width?: number; from?: number; to?: number }
  | { type: 'line'; pts: [number, number][]; color?: string; dash?: boolean; label?: string; width?: number; closed?: boolean; fill?: string }
  | { type: 'dots'; pts: [number, number][]; color?: string; r?: number; label?: string; labels?: string[] }
  | { type: 'bars'; pts: [number, number][]; width: number; color?: string; label?: string }
  | { type: 'area'; f: (x: number) => number; from: number; to: number; color?: string; base?: (x: number) => number }
  | { type: 'vline'; x: number; color?: string; label?: string; dash?: boolean }
  | { type: 'hline'; y: number; color?: string; label?: string; dash?: boolean }
  | { type: 'text'; x: number; y: number; text: string; color?: string; anchor?: 'start' | 'middle' | 'end' }
  | { type: 'arrow'; from: [number, number]; to: [number, number]; color?: string; label?: string };

export type AskStep = ChoiceStep | NumberStep | EstimateStep | OrderStep | TaskStep | MultiStep | MatchStep | SortStep | FillStep | PointStep;
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
