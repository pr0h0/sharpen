// A daily mini game. Everyone gets the same round each day (seeded by the date); extra rounds are
// practice and aren't recorded. Every game scores 0..100 so the home strip can compare them.
import type { Rng } from '../types';

export interface GameApi {
  /** Seeded random numbers for this round. Use only this, never Math.random, so a day is reproducible. */
  rng: Rng;
  /** The seed behind `rng` (the same number `check` gets). */
  seed: number;
  /** True for today's recorded round, false for a practice round. */
  daily: boolean;
  /** End the round: score 0..100 (rounded), plus a short markdown line on how it went. Call once. */
  finish(score: number, summary?: string): void;
}

export interface Game {
  id: string;
  title: string;
  /** One emoji. */
  icon: string;
  color: string;
  /** One line for the tile. */
  blurb: string;
  /** Markdown: how to play, 2 to 4 short lines. */
  how: string;
  /** Course to suggest after a round, by id. */
  course?: string;
  /** Styles for this game only; injected once. Prefix every selector with `.g-<id>`. */
  css?: string;
  /** Build the round into `el` (it already has class `g-<id>`). Return a cleanup (timers, listeners). */
  mount(el: HTMLElement, api: GameApi): (() => void) | void;
  /** For tools/validate.ts: build the round for `seed` without a DOM and return what's wrong, or null. */
  check(seed: number): string | null;
}

/** Today's seed for a game: the same for everyone on the same (local) day. */
export function dailySeed(id: string, day: number): number {
  let x = day * 2654435761;
  for (const ch of id) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return x >>> 0;
}
