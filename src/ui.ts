// Small DOM and formatting helpers shared by the app, the player and the widgets.
import type { Rng } from './types';

type Attrs = Record<string, unknown> & { class?: string; style?: string };
type Child = Node | string | number | null | undefined | false | Child[];

/** h('div', {class: 'x', onclick: fn}, 'text', child) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, kids);
  return el;
}

function append(el: Node, kids: Child[]) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

const SVGNS = 'http://www.w3.org/2000/svg';
/** svg('rect', {x: 1, ...}) */
export function svg(tag: string, attrs: Record<string, string | number> = {}, ...kids: (SVGElement | string)[]): SVGElement {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const k of kids) el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}

/** Light markdown: blank line = paragraph, **bold**, *italic*, `code`, lines starting "- " = list. */
export function md(text: string): HTMLElement {
  const box = h('div', { class: 'md' });
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*- /.test(l))) {
      const ul = h('ul');
      for (const l of lines) ul.appendChild(inline(h('li'), l.replace(/^\s*- /, '')));
      box.appendChild(ul);
    } else {
      box.appendChild(inline(h('p'), lines.join(' ')));
    }
  }
  return box;
}

function inline(el: HTMLElement, text: string): HTMLElement {
  // Escape, then apply the few marks we support.
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  el.innerHTML = esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  return el;
}

// ---------------------------------------------------------------- random

/** Seeded generator (mulberry32), so a problem can be rebuilt from its seed. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
export function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- numbers

/** 0.25 -> "25%", 0.0833 -> "8.3%". */
export function pct(p: number, digits = 1): string {
  const v = p * 100;
  const s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(digits);
  return s + '%';
}

/** Round to sensible digits for display. */
export function num(v: number, digits = 3): string {
  if (Number.isInteger(v)) return v.toLocaleString('en-US');
  const s = Number(v.toPrecision(digits));
  return s.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** "3/8" in lowest terms. */
export function frac(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  return `${n / g}/${d / g}`;
}

/** Parse a learner's number: "0.25", "25%", "1/4", "1,000", " 3 ". NaN if unreadable. */
export function parseNumber(s: string): number {
  const t = s.trim().replace(/,/g, '').replace(/\s+/g, '');
  if (!t) return NaN;
  if (t.endsWith('%')) return Number(t.slice(0, -1)) / 100;
  const m = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  return Number(t);
}
