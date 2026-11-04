// Databases: a tiny SQL engine over in-memory tables (SELECT with joins, WHERE, GROUP BY, HAVING,
// ORDER BY, LIMIT, DISTINCT, aggregates and three-valued NULL logic; UPDATE and DELETE), so every
// result the course shows is computed from the SQL printed next to it. Plus the pictures: tables,
// a clause-by-clause pipeline, tap-the-rows tasks, a query builder, index lookups and transactions.
import type { Widget } from '../types';
import { h } from '../ui';
import { barChart, dataTable } from '../viz/charts';
import { cells, codeBlock } from '../viz/cs';
import { explorer, stepper } from '../viz/explore';

export type Val = number | string | null;
type B = boolean | null;
export interface Table { name: string; cols: string[]; rows: Val[][] }
export type DB = Record<string, Table>;

export const table = (name: string, cols: string[], rows: Val[][]): Table => ({ name, cols, rows });
export const mkdb = (...ts: Table[]): DB => Object.fromEntries(ts.map((t) => [t.name, t]));

// ---------------------------------------------------------------- lexer and parser

interface Tok { t: 'id' | 'num' | 'str' | 'op' | 'kw'; v: string; s: number; e: number }
const KWS = new Set(['SELECT', 'DISTINCT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'IN', 'BETWEEN', 'AS', 'JOIN', 'INNER', 'LEFT', 'OUTER', 'CROSS', 'ON', 'UPDATE', 'SET', 'DELETE']);

function lex(src: string): Tok[] {
  const re = /\s+|--[^\n]*|(\d+(?:\.\d+)?)|'((?:[^']|'')*)'|([A-Za-z_][A-Za-z0-9_]*)|(<>|!=|<=|>=|[=<>*,().+\-/;])/y;
  const out: Tok[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while (re.lastIndex < src.length) {
    const s = re.lastIndex;
    m = re.exec(src);
    if (!m) throw new Error(`SQL: can't read "${src.slice(s, s + 10)}"`);
    const e = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: 'num', v: m[1], s, e });
    else if (m[2] !== undefined) out.push({ t: 'str', v: m[2].replace(/''/g, "'"), s, e });
    else if (m[3] !== undefined) out.push(KWS.has(m[3].toUpperCase()) ? { t: 'kw', v: m[3].toUpperCase(), s, e } : { t: 'id', v: m[3].toLowerCase(), s, e });
    else if (m[4] !== undefined) out.push({ t: 'op', v: m[4] === '!=' ? '<>' : m[4], s, e });
  }
  return out;
}

export type Expr =
  | { t: 'lit'; v: Val }
  | { t: 'col'; q?: string; name: string }
  | { t: 'star' }
  | { t: 'bin'; op: string; a: Expr; b: Expr }
  | { t: 'not'; a: Expr }
  | { t: 'isnull'; a: Expr; neg: boolean }
  | { t: 'in'; a: Expr; list: Expr[]; neg: boolean }
  | { t: 'between'; a: Expr; lo: Expr; hi: Expr; neg: boolean }
  | { t: 'fn'; name: string; args: Expr[]; distinct: boolean };

interface Item { e: Expr | null; alias?: string; text: string } // e null = *
interface Source { table: string; alias: string }
interface Join { kind: 'INNER' | 'LEFT' | 'CROSS'; src: Source; on?: Expr; text: string }
interface Clause { name: string; s: number }
interface Select {
  type: 'select'; distinct: boolean; items: Item[]; from: Source; joins: Join[];
  where?: Expr; groupBy: Expr[]; having?: Expr; orderBy: { e: Expr; desc: boolean }[]; limit?: number;
  clauses: Clause[]; src: string;
}
interface Update { type: 'update'; table: string; sets: [string, Expr][]; where?: Expr }
interface Delete { type: 'delete'; table: string; where?: Expr }
type Stmt = Select | Update | Delete;

const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

function parse(src: string): Stmt {
  const T = lex(src);
  let p = 0;
  const peek = (k = 0) => T[p + k];
  const is = (v: string, k = 0) => !!T[p + k] && (T[p + k].t === 'kw' || T[p + k].t === 'op') && T[p + k].v === v;
  const accept = (v: string) => (is(v) ? (p++, true) : false);
  const expect = (v: string) => { if (!accept(v)) throw new Error(`SQL: expected ${v} near "${src.slice(peek()?.s ?? src.length, (peek()?.s ?? src.length) + 15)}"`); };
  const ident = (): string => { const t = T[p++]; if (!t || t.t !== 'id') throw new Error(`SQL: expected a name near ${t?.v}`); return t.v; };

  const expr = (): Expr => orE();
  const orE = (): Expr => { let a = andE(); while (accept('OR')) a = { t: 'bin', op: 'OR', a, b: andE() }; return a; };
  const andE = (): Expr => { let a = notE(); while (accept('AND')) a = { t: 'bin', op: 'AND', a, b: notE() }; return a; };
  const notE = (): Expr => (accept('NOT') ? { t: 'not', a: notE() } : cmpE());
  const cmpE = (): Expr => {
    const a = addE();
    for (const op of ['=', '<>', '<', '>', '<=', '>=']) if (accept(op)) return { t: 'bin', op, a, b: addE() };
    if (accept('IS')) { const neg = accept('NOT'); expect('NULL'); return { t: 'isnull', a, neg }; }
    const neg = accept('NOT');
    if (accept('IN')) {
      expect('(');
      const list = [expr()];
      while (accept(',')) list.push(expr());
      expect(')');
      return { t: 'in', a, list, neg };
    }
    if (accept('BETWEEN')) { const lo = addE(); expect('AND'); return { t: 'between', a, lo, hi: addE(), neg }; }
    if (neg) throw new Error('SQL: NOT here needs IN or BETWEEN');
    return a;
  };
  const addE = (): Expr => { let a = mulE(); for (;;) { if (accept('+')) a = { t: 'bin', op: '+', a, b: mulE() }; else if (accept('-')) a = { t: 'bin', op: '-', a, b: mulE() }; else return a; } };
  const mulE = (): Expr => { let a = prim(); for (;;) { if (accept('*')) a = { t: 'bin', op: '*', a, b: prim() }; else if (accept('/')) a = { t: 'bin', op: '/', a, b: prim() }; else return a; } };
  const prim = (): Expr => {
    const t = peek();
    if (!t) throw new Error('SQL: unexpected end');
    if (t.t === 'num') { p++; return { t: 'lit', v: Number(t.v) }; }
    if (t.t === 'str') { p++; return { t: 'lit', v: t.v }; }
    if (accept('NULL')) return { t: 'lit', v: null };
    if (accept('-')) return { t: 'bin', op: '-', a: { t: 'lit', v: 0 }, b: prim() };
    if (accept('(')) { const e = expr(); expect(')'); return e; }
    if (t.t === 'id' && is('(', 1)) {
      p += 2;
      const name = t.v.toUpperCase();
      const distinct = accept('DISTINCT');
      const args: Expr[] = [];
      if (accept('*')) args.push({ t: 'star' });
      else { args.push(expr()); while (accept(',')) args.push(expr()); }
      expect(')');
      return { t: 'fn', name, args, distinct };
    }
    if (t.t === 'id') {
      p++;
      if (accept('.')) return { t: 'col', q: t.v, name: ident() };
      return { t: 'col', name: t.v };
    }
    throw new Error(`SQL: unexpected ${t.v}`);
  };
  const source = (): Source => {
    const table = ident();
    accept('AS');
    const alias = peek()?.t === 'id' ? ident() : table;
    return { table, alias };
  };

  let st: Stmt;
  if (accept('UPDATE')) {
    const table = ident();
    expect('SET');
    const sets: [string, Expr][] = [];
    do { const c = ident(); expect('='); sets.push([c, expr()]); } while (accept(','));
    st = { type: 'update', table, sets, where: accept('WHERE') ? expr() : undefined };
  } else if (accept('DELETE')) {
    expect('FROM');
    const table = ident();
    st = { type: 'delete', table, where: accept('WHERE') ? expr() : undefined };
  } else {
    const clauses: Clause[] = [];
    const mark = (name: string) => clauses.push({ name, s: peek().s });
    mark('SELECT');
    expect('SELECT');
    const distinct = accept('DISTINCT');
    const items: Item[] = [];
    do {
      const s0 = peek().s;
      if (accept('*')) { items.push({ e: null, text: '*' }); continue; }
      const e = expr();
      const text = src.slice(s0, T[p - 1].e);
      let alias: string | undefined;
      if (accept('AS')) alias = ident();
      else if (peek()?.t === 'id') alias = ident();
      items.push({ e, alias, text });
    } while (accept(','));
    mark('FROM');
    expect('FROM');
    const from = source();
    const joins: Join[] = [];
    for (;;) {
      const s0 = peek()?.s;
      let kind: Join['kind'] | null = null;
      if (accept('JOIN')) kind = 'INNER';
      else if (is('INNER') && is('JOIN', 1)) { p += 2; kind = 'INNER'; }
      else if (is('LEFT')) { p++; accept('OUTER'); expect('JOIN'); kind = 'LEFT'; }
      else if (is('CROSS')) { p++; expect('JOIN'); kind = 'CROSS'; }
      if (!kind) break;
      const src2 = source();
      const on = kind !== 'CROSS' ? (expect('ON'), expr()) : undefined;
      joins.push({ kind, src: src2, on, text: src.slice(s0, T[p - 1].e) });
    }
    let where: Expr | undefined, having: Expr | undefined, limit: number | undefined;
    const groupBy: Expr[] = [], orderBy: { e: Expr; desc: boolean }[] = [];
    if (is('WHERE')) { mark('WHERE'); p++; where = expr(); }
    if (is('GROUP')) { mark('GROUP BY'); p++; expect('BY'); do groupBy.push(expr()); while (accept(',')); }
    if (is('HAVING')) { mark('HAVING'); p++; having = expr(); }
    if (is('ORDER')) {
      mark('ORDER BY'); p++; expect('BY');
      do { const e = expr(); const desc = accept('DESC'); if (!desc) accept('ASC'); orderBy.push({ e, desc }); } while (accept(','));
    }
    if (is('LIMIT')) { mark('LIMIT'); p++; const t = T[p++]; if (t?.t !== 'num') throw new Error('SQL: LIMIT needs a number'); limit = Number(t.v); }
    st = { type: 'select', distinct, items, from, joins, where, groupBy, having, orderBy, limit, clauses, src };
  }
  accept(';');
  if (p < T.length) throw new Error(`SQL: unexpected "${T[p].v}"`);
  return st;
}

// ---------------------------------------------------------------- evaluation

type Env = Record<string, Record<string, Val>>;

/** Three-valued logic: true, false, or null (unknown). */
export const and3 = (a: B, b: B): B => (a === false || b === false ? false : a === null || b === null ? null : true);
export const or3 = (a: B, b: B): B => (a === true || b === true ? true : a === null || b === null ? null : false);
export const not3 = (a: B): B => (a === null ? null : !a);

function cmp(a: Val, b: Val): number | null {
  if (a === null || b === null) return null;
  if (typeof a !== typeof b) throw new Error(`SQL: comparing ${typeof a} with ${typeof b}`);
  return a < b ? -1 : a > b ? 1 : 0;
}
const truth = (v: Val | boolean): B => (v === null ? null : typeof v === 'boolean' ? v : (() => { throw new Error('SQL: not a condition'); })());

function lookup(env: Env, c: { q?: string; name: string }): Val {
  if (c.q) {
    const r = env[c.q];
    if (!r || !(c.name in r)) throw new Error(`SQL: no column ${c.q}.${c.name}`);
    return r[c.name];
  }
  const hits = Object.values(env).filter((r) => c.name in r);
  if (hits.length !== 1) throw new Error(`SQL: column ${c.name} is ${hits.length ? 'ambiguous' : 'unknown'}`);
  return hits[0][c.name];
}

const hasAgg = (e: Expr): boolean => {
  switch (e.t) {
    case 'fn': return AGG.has(e.name) || e.args.some(hasAgg);
    case 'bin': return hasAgg(e.a) || hasAgg(e.b);
    case 'not': case 'isnull': return hasAgg(e.a);
    case 'in': return hasAgg(e.a) || e.list.some(hasAgg);
    case 'between': return hasAgg(e.a) || hasAgg(e.lo) || hasAgg(e.hi);
    default: return false;
  }
};

interface Ctx { env: Env; group?: Env[]; groupCols?: string[] }

function ev(e: Expr, c: Ctx): Val | boolean {
  switch (e.t) {
    case 'lit': return e.v;
    case 'star': throw new Error('SQL: * outside COUNT');
    case 'col':
      if (c.groupCols && !c.groupCols.includes(e.name)) throw new Error(`SQL: ${e.name} must be in GROUP BY or inside an aggregate`);
      return lookup(c.env, e);
    case 'not': return not3(truth(ev(e.a, c)));
    case 'isnull': { const v = ev(e.a, c); return e.neg ? v !== null : v === null; }
    case 'between': {
      const a = ev(e.a, c) as Val, lo = ev(e.lo, c) as Val, hi = ev(e.hi, c) as Val;
      const r = and3(cmp(a, lo) === null ? null : cmp(a, lo)! >= 0, cmp(a, hi) === null ? null : cmp(a, hi)! <= 0);
      return e.neg ? not3(r) : r;
    }
    case 'in': {
      const a = ev(e.a, c) as Val;
      let r: B = false;
      for (const x of e.list) { const k = cmp(a, ev(x, c) as Val); r = or3(r, k === null ? null : k === 0); }
      return e.neg ? not3(r) : r;
    }
    case 'bin': {
      if (e.op === 'AND') return and3(truth(ev(e.a, c)), truth(ev(e.b, c)));
      if (e.op === 'OR') return or3(truth(ev(e.a, c)), truth(ev(e.b, c)));
      const a = ev(e.a, c) as Val, b = ev(e.b, c) as Val;
      if (['+', '-', '*', '/'].includes(e.op)) {
        if (a === null || b === null) return null;
        if (typeof a !== 'number' || typeof b !== 'number') throw new Error('SQL: arithmetic on text');
        return e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : a / b;
      }
      const k = cmp(a, b);
      if (k === null) return null;
      return e.op === '=' ? k === 0 : e.op === '<>' ? k !== 0 : e.op === '<' ? k < 0 : e.op === '>' ? k > 0 : e.op === '<=' ? k <= 0 : k >= 0;
    }
    case 'fn': {
      if (AGG.has(e.name)) {
        if (!c.group) throw new Error(`SQL: ${e.name} is not allowed here`);
        const arg = e.args[0];
        if (arg.t === 'star') return c.group.length;
        let vs = c.group.map((env) => ev(arg, { env }) as Val).filter((v) => v !== null);
        if (e.distinct) vs = [...new Set(vs)];
        if (e.name === 'COUNT') return vs.length;
        if (!vs.length) return null;
        if (e.name === 'MIN') return vs.reduce((m, v) => (cmp(v, m)! < 0 ? v : m));
        if (e.name === 'MAX') return vs.reduce((m, v) => (cmp(v, m)! > 0 ? v : m));
        const s = (vs as number[]).reduce((a, b) => a + b, 0);
        return e.name === 'SUM' ? s : s / vs.length;
      }
      if (e.name === 'COALESCE') { for (const a of e.args) { const v = ev(a, c) as Val; if (v !== null) return v; } return null; }
      throw new Error(`SQL: unknown function ${e.name}`);
    }
  }
}

export interface Stage { name: string; clause: string; line: number; end: number; cols: string[]; rows: Val[][]; hl?: number[]; note: string }
export interface Res { cols: string[]; rows: Val[][]; stages: Stage[] }

const getTable = (db: DB, name: string): Table => { const t = db[name]; if (!t) throw new Error(`SQL: no table ${name}`); return t; };
const rowEnv = (t: Table, r: Val[]): Record<string, Val> => Object.fromEntries(t.cols.map((c, k) => [c, r[k]]));

/** Run a SELECT. Throws on anything invalid (unknown or ambiguous column, ungrouped column, ties under ORDER BY). */
export function query(db: DB, sql: string): Res {
  const st = parse(sql);
  if (st.type !== 'select') throw new Error('query() runs SELECT; use run() for UPDATE/DELETE');
  const stages: Stage[] = [];
  const clauseOf = (name: string) => {
    const k = st.clauses.findIndex((c) => c.name === name);
    const next = st.clauses[k + 1]?.s ?? sql.length;
    const c = st.clauses[k];
    const lineAt = (pos: number) => sql.slice(0, pos).split('\n').length;
    return { text: sql.slice(c.s, next).trim().replace(/;$/, ''), line: lineAt(c.s), end: lineAt(c.s + sql.slice(c.s, next).trimEnd().length) };
  };
  const srcs = [st.from, ...st.joins.map((j) => j.src)];
  const multi = srcs.length > 1;
  const flatCols = srcs.flatMap((s) => getTable(db, s.table).cols.map((c) => (multi ? `${s.alias}.${c}` : c)));
  const flat = (env: Env) => srcs.flatMap((s) => getTable(db, s.table).cols.map((c) => env[s.alias][c]));
  const stage = (name: string, cols: string[], rows: Val[][], note: string, hl?: number[]) => { const c = clauseOf(name); stages.push({ name, clause: c.text, line: c.line, end: c.end, cols, rows, note, hl }); };

  // FROM and JOIN
  const t0 = getTable(db, st.from.table);
  let envs: Env[] = t0.rows.map((r) => ({ [st.from.alias]: rowEnv(t0, r) }));
  for (const j of st.joins) {
    const t = getTable(db, j.src.table);
    const next: Env[] = [];
    for (const env of envs) {
      let hit = false;
      for (const r of t.rows) {
        const e2 = { ...env, [j.src.alias]: rowEnv(t, r) };
        if (!j.on || truth(ev(j.on, { env: e2 })) === true) { next.push(e2); hit = true; }
      }
      if (!hit && j.kind === 'LEFT') next.push({ ...env, [j.src.alias]: Object.fromEntries(t.cols.map((c) => [c, null])) });
    }
    envs = next;
  }
  stage('FROM', flatCols, envs.map(flat), multi ? `${envs.length} combined row${envs.length === 1 ? '' : 's'}: each left row next to every row it matches.` : `Start with every row of ${t0.name}: ${envs.length}.`);

  if (st.where) {
    const w = st.where;
    envs = envs.filter((env) => truth(ev(w, { env })) === true);
    stage('WHERE', flatCols, envs.map(flat), `Keep the rows where the condition is true: ${envs.length} left.`);
  }

  const grouped = st.groupBy.length > 0 || st.items.some((i) => i.e && hasAgg(i.e)) || (st.having && hasAgg(st.having));
  const items = st.items.flatMap((it) => (it.e ? [it] : srcs.flatMap((s) => getTable(db, s.table).cols.map((c): Item => ({ e: { t: 'col', q: s.alias, name: c }, text: c })))));
  const outCols = items.map((i) => i.alias ?? (i.e?.t === 'col' ? i.e.name : i.text));
  // Each unit is a row (ungrouped) or a group of rows.
  let units: Ctx[];
  if (grouped) {
    const groupCols = st.groupBy.map((g) => { if (g.t !== 'col') throw new Error('SQL: GROUP BY a column'); return g.name; });
    const map = new Map<string, Env[]>();
    for (const env of envs) {
      const key = JSON.stringify(st.groupBy.map((g) => ev(g, { env })));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(env);
    }
    if (!st.groupBy.length && !map.size) map.set('[]', []);
    units = [...map.values()].map((g) => ({ env: g[0] ?? {}, group: g, groupCols }));
    if (st.groupBy.length) {
      const rows: Val[][] = [], hl: number[] = [];
      units.forEach((u, k) => u.group!.forEach((env) => { if (k % 2 === 0) hl.push(rows.length); rows.push(flat(env)); }));
      stage('GROUP BY', flatCols, rows, `${units.length} group${units.length === 1 ? '' : 's'} (shaded alternately): one per distinct value.`, hl);
    }
    if (st.having) {
      const hv = st.having;
      units = units.filter((u) => truth(ev(hv, u)) === true);
      const rows: Val[][] = [], hl: number[] = [];
      units.forEach((u, k) => u.group!.forEach((env) => { if (k % 2 === 0) hl.push(rows.length); rows.push(flat(env)); }));
      stage('HAVING', flatCols, rows, `Keep the groups where the condition is true: ${units.length} left.`, hl);
    }
  } else {
    units = envs.map((env) => ({ env }));
  }

  let out = units.map((u) => ({ u, row: items.map((it) => { const v = ev(it.e!, u); if (typeof v === 'boolean') throw new Error('SQL: condition in SELECT'); return v; }) }));
  stage('SELECT', outCols, out.map((o) => o.row), grouped ? `One output row per ${st.groupBy.length ? 'group' : 'query: the whole table is one group'}.` : 'Keep only the listed columns.');
  if (st.distinct) {
    const seen = new Set<string>();
    out = out.filter((o) => { const k = JSON.stringify(o.row); return seen.has(k) ? false : (seen.add(k), true); });
  }
  if (st.orderBy.length) {
    const keyOf = (o: { u: Ctx; row: Val[] }) => st.orderBy.map(({ e }) => {
      const ai = e.t === 'col' && !e.q ? outCols.findIndex((c) => c.toLowerCase() === e.name) : -1;
      const v = ai >= 0 ? o.row[ai] : (ev(e, o.u) as Val);
      if (v === null) throw new Error('SQL: NULL in ORDER BY (where NULLs sort differs between databases)');
      return v;
    });
    const keyed = out.map((o) => ({ ...o, key: keyOf(o) }));
    const order = (a: Val[], b: Val[]) => { for (let k = 0; k < a.length; k++) { const c = cmp(a[k], b[k])!; if (c) return st.orderBy[k].desc ? -c : c; } return 0; };
    keyed.sort((a, b) => order(a.key, b.key));
    for (let k = 1; k < keyed.length; k++) if (order(keyed[k - 1].key, keyed[k].key) === 0 && JSON.stringify(keyed[k - 1].row) !== JSON.stringify(keyed[k].row)) throw new Error(`SQL: tie in ORDER BY (${keyed[k].key}) makes the order ambiguous`);
    out = keyed;
    stage('ORDER BY', outCols, out.map((o) => o.row), 'Sort the output rows.');
  }
  if (st.limit !== undefined) {
    out = out.slice(0, st.limit);
    stage('LIMIT', outCols, out.map((o) => o.row), `Keep the first ${st.limit}.`);
  }
  return { cols: outCols, rows: out.map((o) => o.row), stages };
}

/** Run an UPDATE or DELETE; returns the new database (the old one is untouched) and rows affected. */
export function run(db: DB, sql: string): { db: DB; affected: number } {
  const st = parse(sql);
  if (st.type === 'select') throw new Error('run() is for UPDATE/DELETE');
  const t = getTable(db, st.table);
  let affected = 0;
  const hit = (r: Val[]) => !st.where || truth(ev(st.where, { env: { [t.name]: rowEnv(t, r) } })) === true;
  let rows: Val[][];
  if (st.type === 'delete') rows = t.rows.filter((r) => (hit(r) ? (affected++, false) : true));
  else {
    rows = t.rows.map((r) => {
      if (!hit(r)) return r;
      affected++;
      const env = { [t.name]: rowEnv(t, r) };
      const nr = r.slice();
      for (const [c, e] of st.sets) {
        const k = t.cols.indexOf(c);
        if (k < 0) throw new Error(`SQL: no column ${c}`);
        nr[k] = ev(e, { env }) as Val;
      }
      return nr;
    });
  }
  return { db: { ...db, [t.name]: { ...t, rows } }, affected };
}

/** Same columns and the same rows (in order when `ordered`, else as multisets). */
export function sameRes(a: { cols: string[]; rows: Val[][] }, b: { cols: string[]; rows: Val[][] }, ordered = true): boolean {
  if (a.cols.length !== b.cols.length) return false;
  const ka = a.rows.map((r) => JSON.stringify(r)), kb = b.rows.map((r) => JSON.stringify(r));
  if (!ordered) { ka.sort(); kb.sort(); }
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

/** A single-column result as a list ("Dune, Emma"). */
export const col0 = (r: Res): Val[] => r.rows.map((x) => x[0]);
/** The only value of a one-row, one-column result. */
export const scalar = (r: Res): Val => { if (r.rows.length !== 1 || r.cols.length !== 1) throw new Error('not a scalar result'); return r.rows[0][0]; };

// ---------------------------------------------------------------- pictures

const nullCell = () => h('span', { class: 'muted', style: 'font-style:italic;' }, 'NULL');
/** Values as a database prints them: no thousands separators, at most 2 decimals. */
export const fmtVal = (v: Val): string => (v === null ? 'NULL' : typeof v === 'number' ? String(Number.isInteger(v) ? v : +v.toFixed(2)) : v);
const cellOf = (v: Val): string | Node => (v === null ? nullCell() : fmtVal(v));

/** Tighter cells (tables must fit a phone) and text columns left-aligned. */
function compact(el: HTMLElement, rows: unknown[][]): HTMLElement {
  const text = rows[0]?.map((_, j) => rows.some((r) => typeof r[j] === 'string' && r[j] !== '')) ?? [];
  el.querySelectorAll('tr').forEach((tr) => [...tr.children].forEach((c, j) => {
    const st = (c as HTMLElement).style;
    st.padding = '.3em .5em';
    if (text[j]) st.textAlign = 'left';
  }));
  el.querySelectorAll('th').forEach((th) => { const t = th.textContent ?? ''; const k = t.indexOf('.'); if (k > 0 && !/\d\./.test(t)) th.replaceChildren(t.slice(0, k + 1), h('wbr'), t.slice(k + 1)); });
  const tb = el.querySelector('table');
  if (tb) tb.style.fontSize = '.88rem';
  return el;
}
/** SQL listing that wraps long lines instead of scrolling (phones). */
export function sqlBlock(src: string, opts: { active?: number; marks?: number[] } = {}): HTMLElement {
  const pre = codeBlock(src, opts);
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.fontSize = '.85rem';
  pre.querySelectorAll<HTMLElement>('.cl').forEach((l) => { l.style.display = 'flex'; });
  pre.querySelectorAll<HTMLElement>('.lc').forEach((c) => { c.style.whiteSpace = 'pre-wrap'; c.style.overflowWrap = 'anywhere'; c.style.flex = '1'; c.style.minWidth = '0'; });
  return pre;
}
/** A data table of SQL values (NULL shown as such), compacted. */
export function grid(head: string[], rows: (Val | Node)[][], opts: { highlight?: number[]; caption?: string } = {}): HTMLElement {
  return compact(dataTable(head, rows.map((r) => r.map((v) => (v instanceof Node ? v : cellOf(v)))), opts), rows);
}

/** A table with its name as the caption. */
export function showTable(t: Table, opts: { hl?: number[]; caption?: string } = {}): HTMLElement {
  return grid(t.cols, t.rows, { caption: opts.caption ?? t.name, highlight: opts.hl });
}
export function showRes(r: { cols: string[]; rows: Val[][] }, caption = 'result'): HTMLElement {
  if (!r.rows.length) return h('div', null, grid(r.cols, [], { caption }), h('div', { class: 'muted small', style: 'text-align:center;' }, '(no rows)'));
  return grid(r.cols, r.rows, { caption });
}
const row = (...kids: Node[]) => h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:center;align-items:flex-start;' }, kids);

/** Some tables, then some SQL under them. */
export function tablesSql(ts: Table[], sql?: string): HTMLElement {
  return h('div', null, row(...ts.map((t) => showTable(t))), sql ? sqlBlock(sql) : null);
}

/** Step through a SELECT clause by clause, in the order the database runs them. */
export function pipeline(db: DB, sql: string): HTMLElement {
  const res = query(db, sql);
  return stepper(res.stages.length, (i) => {
    const s = res.stages[i];
    return h('div', null, sqlBlock(sql, { active: s.line, marks: Array.from({ length: s.end - s.line }, (_, k) => s.line + k + 1) }), grid(s.cols, s.rows, { caption: `after ${s.name}`, highlight: s.hl }));
  }, { caption: (i) => res.stages[i].note });
}

/** Tap rows of a table; solved when exactly the `target` rows (indices) are selected. */
export function rowPick(t: Table, target: number[], opts: { caption?: string; sql?: string } = {}): Widget {
  return (ctx) => {
    const sel = new Set<number>();
    const want = new Set(target);
    const box = h('div');
    const msg = h('div', { class: 'stepper-cap' }, 'Tap rows to select them.');
    const draw = () => {
      const body = t.rows.map((r, k) => h('tr', {
        class: sel.has(k) ? 'hl' : '', style: 'cursor:pointer;', role: 'button', 'aria-pressed': String(sel.has(k)), 'data-row': k,
        onclick: () => { if (sel.has(k)) sel.delete(k); else sel.add(k); draw(); },
      }, r.map((v, j) => h('td', null, j === 0 ? (sel.has(k) ? '✓ ' : '') : '', cellOf(v)))));
      box.replaceChildren(compact(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('caption', null, opts.caption ?? t.name),
        h('thead', null, h('tr', null, t.cols.map((c) => h('th', null, c)))),
        h('tbody', null, body))), t.rows));
      msg.textContent = `${sel.size} row${sel.size === 1 ? '' : 's'} selected.`;
      ctx.solved?.(sel.size === want.size && [...sel].every((k) => want.has(k)));
    };
    draw();
    return h('div', null, box, opts.sql ? sqlBlock(opts.sql) : null, msg);
  };
}

/**
 * Build a query from drop-downs. `parts` mixes fixed SQL text and option lists; the live result is
 * shown under it, and the task is solved when it matches the result of `answer` (same rows, same order).
 */
export function queryBuilder(db: DB, parts: (string | string[])[], answer: string, opts: { show?: string[] } = {}): Widget {
  const target = query(db, answer);
  return (ctx) => {
    const picks = parts.map(() => 0);
    const pre = h('pre', { class: 'code', style: 'white-space:pre-wrap;line-height:2;padding:.6em .8em;' });
    const out = h('div');
    const msg = h('div', { class: 'stepper-cap', style: 'font-weight:600;' });
    const sqlNow = () => parts.map((p, k) => (typeof p === 'string' ? p : p[picks[k]])).join('');
    const update = () => {
      let ok = false;
      try {
        const r = query(db, sqlNow());
        out.replaceChildren(showRes(r, 'your result'));
        ok = sameRes(r, target);
        msg.textContent = ok ? '✓ That matches the target.' : `${r.rows.length} row${r.rows.length === 1 ? '' : 's'}: not the target yet.`;
      } catch (e) {
        out.replaceChildren();
        msg.textContent = `The database would reject this: ${String((e as Error).message).replace(/^SQL: /, '')}.`;
      }
      msg.style.color = ok ? 'var(--good)' : 'var(--text)';
      ctx.solved?.(ok);
    };
    parts.forEach((p, k) => {
      if (typeof p === 'string') { pre.appendChild(document.createTextNode(p)); return; }
      const s = h('select', { 'aria-label': `choice ${k}`, style: 'font:inherit;padding:.1em .3em;border-radius:6px;border:2px solid var(--line);background:var(--panel2);color:var(--text);', onchange: () => { picks[k] = s.selectedIndex; update(); } },
        p.map((o) => h('option', null, o)));
      pre.appendChild(s);
    });
    update();
    return h('div', null,
      row(...(opts.show ?? []).map((n) => showTable(db[n])), showRes(target, 'target')),
      pre, out, msg);
  };
}

// ---------------------------------------------------------------- indexes

/** Binary search over sorted keys: the positions checked, in order (mid = floor((lo + hi) / 2)). */
export function probes(keys: number[], x: number): number[] {
  const seen: number[] = [];
  let lo = 0, hi = keys.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    seen.push(mid);
    if (keys[mid] === x) break;
    if (keys[mid] < x) lo = mid + 1; else hi = mid - 1;
  }
  return seen;
}
/** Entries a binary search checks in the worst case on n sorted entries. */
export const worstProbes = (n: number) => Math.ceil(Math.log2(n + 1));

/** Step through an index lookup: sorted keys, the entry checked, and the range still possible. */
export function indexLookup(keys: number[], x: number, label = 'index'): HTMLElement {
  const ps = probes(keys, x);
  const ranges: [number, number][] = [];
  let lo = 0, hi = keys.length - 1;
  for (const mid of ps) { ranges.push([lo, hi]); if (keys[mid] < x) lo = mid + 1; else hi = mid - 1; }
  return stepper(ps.length, (i) => {
    const [a, b] = ranges[i];
    return h('div', null, h('div', { class: 'trace-head', style: 'text-align:center;' }, `${label} (sorted)`),
      cells(keys, { hi: [ps[i]], dim: keys.map((_, k) => k).filter((k) => k < a || k > b), pointer: { mid: ps[i] } }));
  }, { caption: (i) => { const k = keys[ps[i]]; return `Check ${i + 1}: entry ${k} ${k === x ? `is ${x}. Found.` : k < x ? `< ${x}, so look right.` : `> ${x}, so look left.`}`; } });
}

/** Slider over table size: rows a full scan reads vs entries an index lookup checks. */
export function scanVsIndex(): Widget {
  return explorer({
    params: [{ id: 'e', label: 'rows', min: 1, max: 9, step: 1, value: 3, format: (v) => (10 ** v).toLocaleString('en-US') }],
    draw: (v) => { const n = 10 ** v.e; return barChart([{ label: 'Full scan', value: n, color: 'var(--c2)' }, { label: 'Index', value: worstProbes(n), color: 'var(--c3)' }], { format: (x) => x.toLocaleString('en-US') }); },
    readout: (v) => `${(10 ** v.e).toLocaleString('en-US')} rows: a scan reads all of them; the index checks at most ${worstProbes(10 ** v.e)} entries.`,
  });
}

// ---------------------------------------------------------------- transactions

/** One step of a read-then-write session: read copies the balance; write stores copy + delta. */
export interface TxOp { who: 'A' | 'B'; op: 'read' | 'write' }
export function runSchedule(start: number, delta: { A: number; B: number }, ops: TxOp[]): { final: number; log: { who: string; text: string; bal: number }[] } {
  let bal = start;
  const local: Record<string, number> = {};
  const log: { who: string; text: string; bal: number }[] = [];
  for (const o of ops) {
    if (o.op === 'read') { local[o.who] = bal; log.push({ who: o.who, text: `reads ${bal}`, bal }); }
    else { bal = local[o.who] + delta[o.who]; log.push({ who: o.who, text: `writes ${local[o.who]} ${delta[o.who] >= 0 ? '+' : '−'} ${Math.abs(delta[o.who])} = ${bal}`, bal }); }
  }
  return { final: bal, log };
}
export const scheduleTable = (start: number, delta: { A: number; B: number }, ops: TxOp[], names = { A: 'A', B: 'B' }, showBal = true): HTMLElement => {
  const { log } = runSchedule(start, delta, ops);
  return grid(['step', names.A, names.B, ...(showBal ? ['balance'] : [])],
    [['start', '', '', ...(showBal ? [String(start)] : [])], ...log.map((l, k) => [String(k + 1), l.who === 'A' ? l.text : '', l.who === 'B' ? l.text : '', ...(showBal ? [String(l.bal)] : [])])]);
};
export const opText = (o: TxOp, delta: { A: number; B: number }) => (o.op === 'read' ? 'read balance' : `write balance ${delta[o.who] >= 0 ? '+' : '−'} ${Math.abs(delta[o.who])}`);

/** Schedule two read-then-write sessions by hand. Solved when the order loses an update. */
export function interleaveTask(start: number, delta: { A: number; B: number }, names = { A: 'A', B: 'B' }): Widget {
  return (ctx) => {
    const ops: TxOp[] = [];
    const box = h('div');
    const msg = h('div', { class: 'stepper-cap', style: 'font-weight:600;' });
    const done = (w: 'A' | 'B') => ops.filter((o) => o.who === w).length;
    const btnA = h('button', { class: 'ghost small-btn', onclick: () => push('A') });
    const btnB = h('button', { class: 'ghost small-btn', onclick: () => push('B') });
    const reset = h('button', { class: 'ghost small-btn', onclick: () => { ops.length = 0; draw(); } }, 'Reset');
    const push = (w: 'A' | 'B') => { if (done(w) < 2) { ops.push({ who: w, op: done(w) ? 'write' : 'read' }); draw(); } };
    const draw = () => {
      box.replaceChildren(scheduleTable(start, delta, ops, names));
      for (const [b, w] of [[btnA, 'A'], [btnB, 'B']] as const) {
        b.disabled = done(w) >= 2;
        b.textContent = done(w) >= 2 ? `${names[w]}: finished` : `${names[w]}: ${opText({ who: w, op: done(w) ? 'write' : 'read' }, delta)}`;
      }
      const right = start + delta.A + delta.B;
      let ok = false;
      if (ops.length < 4) msg.textContent = 'Tap whose step runs next.';
      else {
        const f = runSchedule(start, delta, ops).final;
        ok = f !== right;
        msg.textContent = ok ? `✓ Lost update: the balance ends at ${f}, but both changes together should give ${right}.` : `Ends at ${right}: correct. This order is safe. Reset and try another.`;
      }
      msg.style.color = ok ? 'var(--good)' : 'var(--text)';
      ctx.solved?.(ok);
    };
    draw();
    return h('div', null, box, h('div', { class: 'stepper-ctl' }, btnA, btnB, reset), msg);
  };
}

/** Transfer with a power cut: choose where it strikes and whether a transaction wraps the two updates. */
export function crashExplorer(db: DB, stmts: string[], tname: string): Widget {
  const total = (d: DB) => d[tname].rows.reduce((s, r) => s + (r[r.length - 1] as number), 0);
  return explorer({
    params: [
      { id: 'cut', label: 'power cut', min: 0, max: stmts.length, step: 1, value: 1, format: (v) => (v >= stmts.length ? 'never' : `after ${v} update${v === 1 ? '' : 's'}`) },
      { id: 'tx', label: 'transaction', min: 0, max: 1, step: 1, value: 0, format: (v) => (v ? 'BEGIN … COMMIT' : 'none') },
    ],
    draw: (v) => {
      let d = db;
      for (let k = 0; k < Math.min(v.cut, stmts.length); k++) d = run(d, stmts[k]).db;
      const cut = v.cut < stmts.length;
      if (cut && v.tx) d = db; // unfinished transaction: rolled back on restart
      const lines = (v.tx ? ['BEGIN;'] : []).concat(stmts.map((s) => s + ';'), v.tx ? ['COMMIT;'] : []);
      const cutLine = cut ? v.cut + (v.tx ? 1 : 0) : undefined;
      return h('div', null, sqlBlock(lines.join('\n'), { marks: cutLine !== undefined ? lines.map((_, k) => k + 1).filter((k) => k > cutLine) : [] }), showTable(d[tname], { caption: `${tname} after restart` }));
    },
    readout: (v) => {
      let d = db;
      for (let k = 0; k < Math.min(v.cut, stmts.length); k++) d = run(d, stmts[k]).db;
      if (v.cut < stmts.length && v.tx) d = db;
      return `Total money: ${total(d)} (started at ${total(db)}).${v.cut < stmts.length ? ' Shaded lines never ran.' : ''}`;
    },
  });
}
