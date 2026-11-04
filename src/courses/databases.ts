// Databases: tables and keys, SQL queries, grouping, joins, table design, indexes, transactions
// and NULL. Every query result, count and option here is computed by the small SQL engine in
// src/widgets/databases.ts from the SQL printed next to it, never typed by hand.
import type { Choice, Course, Generator, Step } from '../types';
import { h, pick, randInt, shuffle } from '../ui';
import { cells } from '../viz/cs';
import {
  type DB, type Res, type Table, type TxOp, type Val,
  and3, col0, crashExplorer, fmtVal, grid, indexLookup, sqlBlock, interleaveTask, mkdb, not3, opText, or3, pipeline, probes, query, queryBuilder,
  rowPick, run, runSchedule, sameRes, scalar, scanVsIndex, scheduleTable, showRes, showTable, table, tablesSql, worstProbes,
} from '../widgets/databases';

// ---------------------------------------------------------------- helpers

function assert(ok: boolean, msg: string): void { if (!ok) throw new Error(`databases course: ${msg}`); }
/** Keep the first option with each text (callers list the correct one first). */
function uniq(opts: Choice[]): Choice[] {
  const seen = new Set<string>();
  return opts.filter((o) => (seen.has(o.text) ? false : (seen.add(o.text), true)));
}
const list = (xs: Val[]) => (xs.length ? xs.map(fmtVal).join(', ') : 'no rows');
const n1 = (r: Res) => scalar(r) as number;
const count = (db: DB, from: string, where?: string) => n1(query(db, `SELECT COUNT(*) FROM ${from}${where ? ` WHERE ${where}` : ''}`));
const f2 = (v: number) => String(+v.toFixed(2));
const s = (n: number, w: string, pl = w + 's') => `${n} ${n === 1 ? w : pl}`;
/** Row indices of `t` (keyed by its first column) that satisfy a WHERE condition. */
function rowsWhere(db: DB, t: Table, where: string): number[] {
  const keys = new Set(col0(query(db, `SELECT ${t.cols[0]} FROM ${t.name} WHERE ${where}`)));
  return t.rows.map((r, k) => (keys.has(r[0]) ? k : -1)).filter((k) => k >= 0);
}
/**
 * Fill-step check: the right tiles give `expect` (or at least parse and run), and changing any one
 * blank to another tile gives a different result or an error, so exactly one answer works.
 */
function checkFill(db: DB, tpl: string, blanks: { options: string[]; answer: number }[], expect?: Res, ordered = true): Res {
  const fill = (pickK: number[]) => tpl.replace(/\[\[(\d+)\]\]/g, (_, k) => blanks[Number(k)].options[pickK[Number(k)]]);
  const right = blanks.map((b) => b.answer);
  const res = query(db, fill(right));
  if (expect) assert(sameRes(res, expect, ordered), `fill answer gives ${JSON.stringify(res.rows)}`);
  blanks.forEach((b, k) => b.options.forEach((_, j) => {
    if (j === b.answer) return;
    const alt = right.slice();
    alt[k] = j;
    let other: Res | null = null;
    try { other = query(db, fill(alt)); } catch { /* rejected: fine */ }
    assert(!other || !sameRes(other, res, ordered), `fill tile "${b.options[j]}" also works`);
  }));
  return res;
}
const two = (...kids: HTMLElement[]) => h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:center;align-items:flex-start;' }, kids);
const label = (t: string) => h('div', { class: 'trace-head', style: 'text-align:center;' }, t);

const NAMES = ['Ana', 'Ben', 'Cy', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kim', 'Lu'];
const CITIES = ['Leeds', 'York', 'Bath', 'Hull', 'Ely'];

// ================================================================ lesson 1: tables, rows and keys

const MEMBERS = table('members', ['member_id', 'name', 'city', 'email'], [
  [1, 'Sam Lee', 'Leeds', 'sam@mail.com'],
  [2, 'Ana Ruiz', 'York', 'ana@mail.com'],
  [3, 'Sam Lee', 'Bath', 'slee@work.com'],
  [4, 'Ben Okafor', 'Leeds', 'ben@mail.com'],
  [5, 'Cara Diaz', 'York', 'cara@mail.com'],
]);
const DB1 = mkdb(MEMBERS);
const SAMS = count(DB1, 'members', "name = 'Sam Lee'");
const distinctIn = (t: Table, k: number) => new Set(t.rows.map((r) => r[k])).size === t.rows.length;
const uniqueOn = (rows: Val[][], idx: number[]) => new Set(rows.map((r) => JSON.stringify(idx.map((i) => r[i])))).size === rows.length;

/** Rows a table with a primary key on column 0 refuses, inserting top to bottom: a repeat or a NULL key. */
function rejected(keys: Val[]): number[] {
  const seen = new Set<Val>();
  const bad: number[] = [];
  keys.forEach((k, i) => { if (k === null || seen.has(k)) bad.push(i); else seen.add(k); });
  return bad;
}
const INSERTS = table('new_books', ['isbn', 'title'], [
  ['B-101', 'Dune'], ['B-205', 'Emma'], ['B-101', 'Dune Messiah'], [null, 'Beloved'], ['B-310', 'Ulysses'], ['B-205', 'Emma'],
]);
const REJ = rejected(INSERTS.rows.map((r) => r[0]));

const ENROL = table('enrolments', ['student_id', 'course_id', 'grade'], [
  [1, 'MATH', 'A'], [1, 'ART', 'B'], [2, 'MATH', 'B'], [3, 'ART', 'A'], [2, 'BIO', 'A'], [1, 'BIO', 'A'],
]);
const KEYSETS: [string, number[]][] = [['student_id', [0]], ['course_id', [1]], ['grade', [2]], ['(student_id, course_id)', [0, 1]], ['(student_id, grade)', [0, 2]], ['(course_id, grade)', [1, 2]]];
const KEYSETS_OK = KEYSETS.filter(([, ix]) => uniqueOn(ENROL.rows, ix)).map(([n]) => n);
assert(KEYSETS_OK.length === 1 && KEYSETS_OK[0] === '(student_id, course_id)', 'enrolments key sets');

const genUniqueCols: Generator = (rng) => {
  const n = randInt(rng, 5, 7);
  const names = shuffle(rng, NAMES).slice(0, 4);
  const rows: Val[][] = Array.from({ length: n }, (_, k) => [k + 1, pick(rng, names), pick(rng, CITIES.slice(0, 3)), `07${randInt(rng, 10, 19)}`]);
  const t = table('members', ['member_id', 'name', 'city', 'phone'], rows);
  const branch = pick(rng, ['Leeds', 'York', 'Bath', 'Hull', 'Ely']);
  return {
    kind: 'multi',
    body: `The ${branch} library keeps this table of ${n} members. In this data, which columns have a **different value in every row**?`,
    widget: () => showTable(t),
    options: t.cols.map((c, k) => distinctIn(t, k)
      ? { text: `\`${c}\``, correct: true }
      : { text: `\`${c}\``, why: `${c} repeats: ${list([...new Set(rows.map((r) => r[k]).filter((v, i, a) => a.indexOf(v) !== i))])} appears more than once.` }),
    hint: 'Scan each column for a value that appears twice.',
    explain: `Unique here: ${t.cols.filter((_, k) => distinctIn(t, k)).join(', ')}. Only a column that is unique by design (like an assigned member_id) can be trusted as a primary key; the rest can repeat tomorrow even if they don't today.`,
  };
};

const genRejected: Generator = (rng) => {
  const pool = shuffle(rng, ['B-101', 'B-205', 'B-310', 'B-412', 'B-520', 'B-633']).slice(0, 4);
  const n = randInt(rng, 6, 8);
  const keys: Val[] = Array.from({ length: n }, () => (rng() < 0.12 ? null : pick(rng, pool)));
  const titles = shuffle(rng, ['Dune', 'Emma', 'Ulysses', 'Beloved', 'Solaris', 'Coraline', 'Persuasion', 'Earthsea']);
  const t = table('new_books', ['isbn', 'title'], keys.map((k, i) => [k, titles[i]]));
  const bad = rejected(keys);
  return {
    kind: 'number',
    body: `\`isbn\` is the primary key of \`books\`. These ${n} rows are inserted one at a time, top to bottom. How many does the database **accept**?`,
    widget: () => showTable(t),
    answer: n - bad.length, tol: 0,
    hint: 'A primary key value must be present (not NULL) and not already in the table.',
    explain: `Rejected: ${bad.length ? bad.map((i) => `row ${i + 1} (${keys[i] === null ? 'NULL isbn' : `${keys[i]} again`})`).join(', ') : 'none'}. So ${n - bad.length} of ${n} go in.`,
  };
};

const genComposite: Generator = (rng) => {
  for (;;) {
    const courses = shuffle(rng, ['MATH', 'ART', 'BIO', 'CHEM', 'HIST']).slice(0, 3);
    const pairs = shuffle(rng, [1, 2, 3, 4].flatMap((st) => courses.map((c) => [st, c] as [number, string]))).slice(0, randInt(rng, 5, 7));
    const rows: Val[][] = pairs.map(([st, c]) => [st, c, pick(rng, ['A', 'B', 'C'])]);
    const ok = KEYSETS.filter(([, ix]) => uniqueOn(rows, ix));
    if (ok.length !== 1 || ok[0][1].length !== 2 || ok[0][1][1] !== 1) continue;
    const t = table('enrolments', ['student_id', 'course_id', 'grade'], rows);
    const opts = KEYSETS.filter(([, ix]) => ix.length === 1 || ix[0] === 0 && ix[1] === 1 || rng() < 0.5).slice(0, 5);
    return {
      kind: 'choice',
      body: `This \`enrolments\` table has ${rows.length} rows. Which column, or pair of columns, is different in every row, so it could be the primary key?`,
      widget: () => showTable(t),
      options: opts.map(([name, ix]) => uniqueOn(rows, ix) ? { text: name, correct: true } : { text: name, why: `Two rows share the same ${name}, so it can't pick out one row.` }),
      hint: 'Look for two rows that agree on the columns in question.',
      explain: 'A student takes many courses and a course has many students, but each (student, course) pair appears once: a composite key.',
    };
  }
};

const L1: Step[] = [
  {
    kind: 'choice',
    body: `A library note says: *Sam Lee has an overdue book.* Here is the members table. Which row does the note mean?`,
    widget: () => showTable(MEMBERS),
    options: [
      { text: 'You can’t tell from the name alone', correct: true },
      { text: 'The first Sam Lee', why: `There are ${SAMS} rows named Sam Lee; being listed first doesn't make one of them the right one. Rows in a table have no meaningful order.` },
      { text: 'Both of them', why: 'Only one person has the book. The note is ambiguous, not about two people.' },
    ],
    hint: 'Count the rows with that name.',
    explain: `${SAMS} different members are called Sam Lee. A name describes a row; it doesn't identify it. The note should have said *member 1* or *member 3*.`,
  },
  {
    kind: 'read', title: 'Tables, rows, columns',
    body: 'A database stores data in **tables**. Each **row** is one thing (a member), each **column** one fact about it (name, city).\n\nThe column that names exactly one row is the **primary key**. Here it is `member_id`: the database refuses a second row with the same id, and refuses a row with no id at all. Anywhere else (a loan, a fine, a note), *member 3* means one person and only one.',
    widget: () => showTable(MEMBERS),
  },
  {
    kind: 'multi',
    body: 'In this data, which columns have a **different value in every row**?',
    widget: () => showTable(MEMBERS),
    options: MEMBERS.cols.map((c, k) => distinctIn(MEMBERS, k) ? { text: `\`${c}\``, correct: true } : { text: `\`${c}\``, why: `${c} repeats, so it can't pick out a single row.` }),
    hint: 'Look for any value that appears twice in a column.',
    explain: `${MEMBERS.cols.filter((_, k) => distinctIn(MEMBERS, k)).join(' and ')} are unique in this data. That makes them **candidates** for the key, but see the next question.`,
  },
  {
    kind: 'choice',
    body: 'Every email in the table is different. Is `email` a good primary key?',
    options: [
      { text: 'No: people change their email, and a key should never change', correct: true },
      { text: 'Yes: it’s unique, so it’s a fine key', why: 'Unique today isn’t enough. When Ana changes her email, every loan and fine that pointed at the old one now points at nothing.' },
      { text: 'No: keys have to be numbers', why: 'Keys can be text (an ISBN, a country code). The problem is that emails change and can be missing.' },
    ],
    explain: 'A good primary key is **unique, always present, and never changes**. That is why most tables use an assigned id that means nothing else: nobody ever needs to change it.',
  },
  {
    kind: 'sort',
    body: 'Sort these into good and bad choices of primary key.',
    bins: ['Good key', 'Bad key'],
    items: [
      { text: 'A member number the library assigns', bin: 0 },
      { text: 'An order number that counts up', bin: 0 },
      { text: 'A book edition’s ISBN', bin: 0 },
      { text: 'A person’s full name', bin: 1 },
      { text: 'A phone number', bin: 1 },
      { text: 'A date of birth', bin: 1 },
      { text: 'A book’s title', bin: 1 },
    ],
    hint: 'Ask of each: could two rows share it? Could it change, or be unknown?',
    explain: 'Names, birthdays and titles repeat; phone numbers change hands. Assigned numbers and ISBNs (one per edition, never reused) are unique and stable.',
  },
  {
    kind: 'task',
    body: `\`isbn\` is the primary key of \`books\`. These rows are inserted one at a time, top to bottom. **Tap every row the database rejects.**`,
    widget: rowPick(INSERTS, REJ, { caption: 'rows to insert, in order' }),
    hint: 'Two rules: the key must be there (not NULL), and it must not already be in the table.',
    explain: `Rows ${REJ.map((i) => i + 1).join(', ')} are refused: ${REJ.map((i) => (INSERTS.rows[i][0] === null ? `row ${i + 1} has no isbn` : `row ${i + 1} repeats ${INSERTS.rows[i][0]}`)).join('; ')}. Even an exact copy (same isbn, same title) is refused: a table never holds the same key twice.`,
  },
  {
    kind: 'read', title: 'Keys made of two columns',
    body: 'Sometimes no single column is unique. A student appears once per course they take, and a course once per student. But each **(student, course) pair** appears once. A key made of several columns is a **composite key**.',
    widget: () => showTable(ENROL),
  },
  {
    kind: 'choice',
    body: 'Which of these is different in every row of the table above, so it could be the primary key?',
    widget: () => showTable(ENROL),
    options: KEYSETS.map(([name, ix]) => uniqueOn(ENROL.rows, ix) ? { text: name, correct: true } : { text: name, why: `Two rows share the same ${name}.` }),
    hint: 'For each option, look for two rows that agree on it.',
    explain: `Only ${KEYSETS_OK[0]} never repeats. It also matches the meaning: one grade per student per course.`,
  },
  {
    kind: 'choice',
    body: 'Why not identify rows by their position, like *the third row*?',
    options: [
      { text: 'Rows have no fixed order: positions shift when rows are added, deleted or sorted', correct: true },
      { text: 'Positions are fine, just slower', why: 'It isn’t speed: the third row today can be a different row tomorrow, so anything that saved "row 3" now points at the wrong person.' },
      { text: 'Because databases number rows from 0', why: 'Where counting starts doesn’t matter. A table is a set of rows; it promises no order at all unless a query asks for one.' },
    ],
    explain: 'A table is an unordered set of rows. The only reliable way to point at a row is by a key value stored in the row itself.',
  },
  {
    kind: 'match',
    body: 'Match each word to its meaning.',
    heads: ['Word', 'Meaning'],
    pairs: [
      ['Row', 'One thing being stored, like one member'],
      ['Column', 'One kind of fact, the same for every row'],
      ['Primary key', 'A value that picks out exactly one row'],
      ['Composite key', 'A key made of two or more columns'],
    ],
    explain: 'A table is rows of things, columns of facts, and a key so that anything else can point at exactly one row.',
  },
];

// ================================================================ lesson 2: asking questions with SQL

const BOOKS = table('books', ['id', 'title', 'year', 'pages', 'genre'], [
  [1, 'Dune', 1965, 412, 'SciFi'],
  [2, 'Emma', 1815, 474, 'Classic'],
  [3, 'The Hobbit', 1937, 310, 'Fantasy'],
  [4, 'Solaris', 1961, 204, 'SciFi'],
  [5, 'Coraline', 2002, 162, 'Fantasy'],
  [6, '1984', 1949, 328, 'SciFi'],
  [7, 'The Martian Chronicles', 1950, 222, 'SciFi'],
  [8, 'Persuasion', 1817, 300, 'Classic'],
  [9, 'Earthsea', 1968, 200, 'Fantasy'],
]);
const DB2 = mkdb(BOOKS);
const titles = (where: string) => col0(query(DB2, `SELECT title FROM books WHERE ${where}`));
const Q_OLD = 'SELECT title\nFROM books\nWHERE year < 1950;';
const OLD = col0(query(DB2, Q_OLD)), OLD_LE = titles('year <= 1950'), OLD_GT = titles('year > 1950');
assert(OLD.length !== OLD_LE.length, 'need a book from exactly 1950');
const PICK_W = "genre = 'SciFi' AND year > 1960";
const PICK_ROWS = rowsWhere(DB2, BOOKS, PICK_W);
const Q_OR = "SELECT title\nFROM books\nWHERE genre = 'Fantasy' OR pages > 400;";
const OR_N = query(DB2, Q_OR).rows.length;
const Q_PIPE = "SELECT title, pages\nFROM books\nWHERE genre = 'SciFi'\nORDER BY pages DESC\nLIMIT 2;";
const Q_FIRST = 'SELECT title\nFROM books\nORDER BY year\nLIMIT 1;';
const FIRST = scalar(query(DB2, Q_FIRST)), FIRST_DESC = scalar(query(DB2, 'SELECT title FROM books ORDER BY year DESC LIMIT 1')), FIRST_PAGES = scalar(query(DB2, 'SELECT title FROM books ORDER BY pages LIMIT 1'));
const FILL2 = { tpl: 'SELECT title, pages\nFROM books\n[[0]] pages [[1]]\n[[2]] 3;', blanks: [{ options: ['ORDER BY', 'GROUP BY', 'WHERE'], answer: 0 }, { options: ['DESC', 'ASC'], answer: 0 }, { options: ['LIMIT', 'HAVING', 'WHERE'], answer: 0 }] };
const TOP3 = [...BOOKS.rows].sort((a, b) => (b[3] as number) - (a[3] as number)).slice(0, 3).map((r) => [r[1], r[3]]);
checkFill(DB2, FILL2.tpl, FILL2.blanks, { cols: ['title', 'pages'], rows: TOP3, stages: [] });
const PREC = "SELECT title\nFROM books\nWHERE genre = 'Fantasy'\n   OR genre = 'SciFi' AND year > 1960;";
const PREC_N = query(DB2, PREC).rows.length;
const PREC_PAREN = query(DB2, "SELECT title FROM books WHERE (genre = 'Fantasy' OR genre = 'SciFi') AND year > 1960").rows.length;
const PREC_ALL = query(DB2, "SELECT title FROM books WHERE genre = 'Fantasy' OR genre = 'SciFi'").rows.length;
assert(new Set([PREC_N, PREC_PAREN, PREC_ALL]).size === 3, 'precedence counts must differ');
const RANGE_REF = BOOKS.rows.filter((r) => (r[3] as number) >= 200 && (r[3] as number) <= 300).map((r) => [r[1]]);
const RANGE_OPTS = ['pages BETWEEN 200 AND 300', 'pages >= 200 AND pages <= 300', 'pages > 200 AND pages < 300', 'pages >= 200 OR pages <= 300', 'NOT pages > 300'];
const rangeRes = (w: string) => query(DB2, `SELECT title FROM books WHERE ${w}`);

const PRODUCTS = ['pen', 'mug', 'lamp', 'desk', 'sofa', 'rug', 'clock', 'vase', 'stool', 'shelf'];
const CATS = ['home', 'office', 'garden'];
function productsTable(rng: () => number, n: number): Table {
  const names = shuffle(rng, PRODUCTS).slice(0, n);
  const prices = shuffle(rng, Array.from({ length: 40 }, (_, k) => k + 3)).slice(0, n);
  const stock = shuffle(rng, Array.from({ length: 30 }, (_, k) => k)).slice(0, n);
  return table('products', ['name', 'category', 'price', 'stock'], names.map((nm, k) => [nm, pick(rng, CATS), prices[k], stock[k]]));
}

const genWhereCount: Generator = (rng) => {
  const t = productsTable(rng, randInt(rng, 6, 8));
  const db = mkdb(t);
  const p = randInt(rng, 10, 35), st = randInt(rng, 5, 20), cat = pick(rng, CATS);
  const conds = [`price > ${p}`, `price <= ${p}`, `category = '${cat}'`, `stock < ${st}`, `category <> '${cat}'`];
  const a = pick(rng, conds);
  const b = pick(rng, conds.filter((c) => c.split(' ')[0] !== a.split(' ')[0]));
  const join = pick(rng, ['AND', 'OR']);
  const where = `${a} ${join} ${b}`;
  const sql = `SELECT name\nFROM products\nWHERE ${where};`;
  const hits = col0(query(db, sql));
  return {
    kind: 'number',
    body: `How many products pass \`WHERE ${where}\`?`,
    widget: () => tablesSql([t], sql),
    answer: hits.length, tol: 0,
    hint: join === 'AND' ? 'AND keeps a row only when both conditions are true.' : 'OR keeps a row when either condition is true (or both).',
    explain: `Rows passing \`${where}\`: ${list(hits)}. That's ${hits.length}.`,
  };
};

const genOrderLimit: Generator = (rng) => {
  const t = productsTable(rng, 6);
  const db = mkdb(t);
  const col = pick(rng, ['price', 'stock']), desc = rng() < 0.5, k = randInt(rng, 1, 3);
  const sql = `SELECT name\nFROM products\nORDER BY ${col}${desc ? ' DESC' : ''}\nLIMIT ${k};`;
  const sorted = col0(query(db, `SELECT name FROM products ORDER BY ${col}${desc ? ' DESC' : ''}`));
  const flip = col0(query(db, `SELECT name FROM products ORDER BY ${col}${desc ? '' : ' DESC'}`));
  const ans = sorted[k - 1];
  const ci = t.cols.indexOf(col);
  const valOf = (nm: Val) => t.rows.find((r) => r[0] === nm)![ci];
  const why = (nm: Val) => {
    if (nm === flip[k - 1]) return `${nm} would be row ${k} sorting the other way. ${desc ? 'DESC puts the largest first.' : 'Without DESC the sort is smallest first.'}`;
    if (nm === t.rows[k - 1][0]) return `${nm} is row ${k} of the table as stored. ORDER BY sorts the rows before LIMIT takes the first ${k}.`;
    return `${nm} has ${col} ${valOf(nm)}, which puts it at position ${sorted.indexOf(nm) + 1} after sorting.`;
  };
  const cand = uniq([ans, flip[k - 1], t.rows[k - 1][0], ...shuffle(rng, sorted)].map((nm) => (nm === ans ? { text: String(nm), correct: true } : { text: String(nm), why: why(nm) }))).slice(0, 4);
  return {
    kind: 'choice',
    body: `What is the **last** row this query returns (sorted by ${col}${desc ? ', descending' : ''}, first ${k})?`,
    widget: () => tablesSql([t], sql),
    options: cand,
    hint: `Sort all rows by ${col}${desc ? ', largest first' : ', smallest first'}, then keep the first ${k}.`,
    explain: `Sorted by ${col}${desc ? ' descending' : ''}: ${sorted.map((nm) => `${nm} (${valOf(nm)})`).join(', ')}. The first ${k} end with **${ans}**.`,
  };
};

const genPrecedence: Generator = (rng) => {
  for (;;) {
    const t = productsTable(rng, 8);
    const db = mkdb(t);
    const [a, b] = shuffle(rng, CATS);
    const p = randInt(rng, 12, 32);
    const sql = `SELECT name\nFROM products\nWHERE category = '${a}'\n   OR category = '${b}' AND price > ${p};`;
    const n = query(db, sql).rows.length;
    const paren = query(db, `SELECT name FROM products WHERE (category = '${a}' OR category = '${b}') AND price > ${p}`).rows.length;
    if (n === paren) continue;
    return {
      kind: 'number',
      body: `How many rows does this query return? Careful with AND and OR (the price limit is ${p}).`,
      widget: () => tablesSql([t], sql),
      answer: n, tol: 0,
      hint: 'AND binds tighter than OR, like × before +.',
      explain: `It reads as \`category = '${a}' OR (category = '${b}' AND price > ${p})\`: every ${a} product, plus ${b} products over ${p}. That's ${n}. With brackets around the OR it would be ${paren}.`,
    };
  }
};

const L2: Step[] = [
  {
    kind: 'choice',
    body: 'Here is a table of books and a question in SQL. Which titles does it return?',
    widget: () => tablesSql([BOOKS], Q_OLD),
    options: uniq([
      { text: list(OLD), correct: true },
      { text: list(OLD_LE), why: `That includes the book from 1950. \`<\` means strictly less than; \`<=\` would include it.` },
      { text: list(OLD_GT), why: 'Those are the books *after* 1950: the opposite of the condition.' },
      { text: list(col0(query(DB2, 'SELECT title FROM books'))), why: 'WHERE keeps only the rows where its condition is true.' },
    ]),
    hint: 'Go down the year column and keep the rows with a year below 1950.',
    explain: `Years below 1950: ${list(OLD)}. You just ran a query in your head: **FROM** picks the table, **WHERE** keeps matching rows, **SELECT** picks the columns to show.`,
  },
  {
    kind: 'read', title: 'How a query runs',
    body: 'You *write* SELECT first, but the database works in a different order: start with every row **FROM** the table, keep the ones **WHERE** the condition is true, compute the **SELECT** columns, **ORDER BY** to sort, then **LIMIT** to keep the first few. Step through it.',
    widget: () => pipeline(DB2, Q_PIPE),
  },
  {
    kind: 'task',
    body: `Tap every row that \`WHERE ${PICK_W}\` keeps.`,
    widget: rowPick(BOOKS, PICK_ROWS),
    hint: 'AND needs both: the genre must match *and* the year must be after 1960.',
    explain: `Kept: ${list(PICK_ROWS.map((k) => BOOKS.rows[k][1]))}. SciFi books from 1960 or before fail the second test.`,
  },
  {
    kind: 'number',
    body: 'How many rows does this query return?',
    widget: () => tablesSql([BOOKS], Q_OR),
    answer: OR_N, tol: 0,
    hint: 'OR keeps a row if either condition is true. Don’t count a book twice.',
    explain: `Fantasy books, plus any book over 400 pages: ${list(col0(query(DB2, Q_OR)))}. That's ${OR_N}.`,
  },
  {
    kind: 'order',
    body: 'Put the clauses in the order the database actually **runs** them.',
    items: ['`FROM`', '`WHERE`', '`SELECT`', '`ORDER BY`', '`LIMIT`'],
    hint: 'You can’t filter rows before you have them, and you can’t take "the first 3" before sorting.',
    explain: 'FROM, WHERE, SELECT, ORDER BY, LIMIT. This is why `LIMIT 3` gives the top three only when ORDER BY comes with it: without a sort, "first" means whatever order the rows happen to come out.',
  },
  {
    kind: 'choice',
    body: 'Which title does this return?',
    widget: () => tablesSql([BOOKS], Q_FIRST),
    options: uniq([
      { text: String(FIRST), correct: true },
      { text: String(FIRST_DESC), why: 'That’s the newest book. ORDER BY sorts smallest first unless you add DESC.' },
      { text: String(BOOKS.rows[0][1]), why: 'That’s the first row as stored. ORDER BY sorts before LIMIT takes one.' },
      { text: String(FIRST_PAGES), why: 'That’s the shortest book. The sort is by year.' },
    ]),
    explain: `Sorted by year, oldest first, the first row is ${FIRST}.`,
  },
  {
    kind: 'fill', code: true,
    body: 'Complete the query so it returns the **three longest** books, longest first.',
    template: FILL2.tpl, blanks: FILL2.blanks,
    hint: 'Sort, choose the direction, then cut the list.',
    explain: `\`ORDER BY pages DESC LIMIT 3\` gives ${TOP3.map((r) => `${r[0]} (${r[1]})`).join(', ')}.`,
  },
  {
    kind: 'choice',
    body: 'How many rows does this return?',
    widget: () => tablesSql([BOOKS], PREC),
    options: uniq([
      { text: String(PREC_N), correct: true },
      { text: String(PREC_PAREN), why: 'That would be `(Fantasy OR SciFi) AND year > 1960`. Without brackets, AND is done first.' },
      { text: String(PREC_ALL), why: 'That ignores the year test completely. It still applies, but only to the SciFi part.' },
    ]),
    hint: 'AND binds tighter than OR, like × before +.',
    explain: `It means \`genre = 'Fantasy' OR (genre = 'SciFi' AND year > 1960)\`: all fantasy books plus SciFi after 1960, ${PREC_N} rows. When mixing AND and OR, write the brackets you mean.`,
  },
  {
    kind: 'multi',
    body: 'Which conditions return exactly the books with **200 to 300 pages, including 200 and 300**?',
    widget: () => showTable(BOOKS),
    options: RANGE_OPTS.map((w) => {
      const r = rangeRes(w);
      return sameRes(r, { cols: ['title'], rows: RANGE_REF }, false) ? { text: `\`${w}\``, correct: true }
        : { text: `\`${w}\``, why: `This returns ${s(r.rows.length, 'row')} (${list(col0(r))}), not the ${RANGE_REF.length} wanted.` };
    }),
    hint: 'BETWEEN includes both ends. Check the books with exactly 200 or 300 pages.',
    explain: `BETWEEN 200 AND 300 means \`>= 200 AND <= 300\`: ${list(RANGE_REF.map((r) => r[0]))}.`,
  },
  {
    kind: 'task',
    body: 'Build a query that returns exactly the **target**: the fantasy books, shortest first.',
    widget: queryBuilder(DB2, ['SELECT title, ', ['year', 'pages', 'genre'], "\nFROM books\nWHERE genre = ", ["'SciFi'", "'Fantasy'", "'Classic'"], '\nORDER BY ', ['year', 'pages', 'title'], ' ', ['DESC', 'ASC'], ';'],
      "SELECT title, pages FROM books WHERE genre = 'Fantasy' ORDER BY pages ASC"),
    hint: 'Which column does the target show next to the title? Which genre? Which way is it sorted?',
    explain: "`SELECT title, pages FROM books WHERE genre = 'Fantasy' ORDER BY pages ASC`. Each clause did one job: pick columns, filter rows, sort.",
  },
];

// ================================================================ lesson 3: grouping and counting

const ORDERS = table('orders', ['order_id', 'customer', 'city', 'total'], [
  [101, 'Ana', 'Leeds', 40], [102, 'Ben', 'York', 25], [103, 'Ana', 'Leeds', 60], [104, 'Cy', 'Bath', 15], [105, 'Dee', 'York', 80],
  [106, 'Ben', 'York', 35], [107, 'Ana', 'Leeds', 20], [108, 'Eve', 'Bath', 95], [109, 'Dee', 'York', 10],
]);
const DB3 = mkdb(ORDERS);
const YORK = n1(query(DB3, "SELECT SUM(total) FROM orders WHERE city = 'York'"));
const Q_GROUP = 'SELECT city, COUNT(*) AS orders, SUM(total) AS spent\nFROM orders\nGROUP BY city;';
const CUSTS = query(DB3, 'SELECT customer, COUNT(*) FROM orders GROUP BY customer').rows.length;
const LEEDS_AVG = n1(query(DB3, "SELECT AVG(total) FROM orders WHERE city = 'Leeds'"));
const LEEDS_SUM = n1(query(DB3, "SELECT SUM(total) FROM orders WHERE city = 'Leeds'"));
const ALL_AVG = n1(query(DB3, 'SELECT AVG(total) FROM orders'));
const LEEDS_N = count(DB3, 'orders', "city = 'Leeds'");
const Q_TOP = 'SELECT customer, SUM(total) AS spent\nFROM orders\nGROUP BY customer\nORDER BY spent DESC\nLIMIT 1;';
const TOP = query(DB3, Q_TOP).rows[0];
const TOP_ONE = query(DB3, 'SELECT customer, total FROM orders ORDER BY total DESC LIMIT 1').rows[0];
const Q_WH = 'SELECT city, COUNT(*) AS big_orders\nFROM orders\nWHERE total >= 30\nGROUP BY city\nHAVING COUNT(*) >= 2;';
const HV = 115;
const Q_HAV = `SELECT city\nFROM orders\nGROUP BY city\nHAVING SUM(total) > ${HV};`;
const HAV = col0(query(DB3, Q_HAV));
const HAV_WHERE = col0(query(DB3, `SELECT city FROM orders WHERE total > ${HV} GROUP BY city`));
const ALL_CITIES = col0(query(DB3, 'SELECT city FROM orders GROUP BY city'));
const BAD_GROUP = 'SELECT customer, city, COUNT(*)\nFROM orders\nGROUP BY city;';
const BAD_WHERE = 'SELECT city, COUNT(*)\nFROM orders\nWHERE COUNT(*) > 2\nGROUP BY city;';
const rejects = (db: DB, sql: string) => { try { query(db, sql); return false; } catch { return true; } };
assert(rejects(DB3, BAD_GROUP) && rejects(DB3, BAD_WHERE), 'invalid grouping queries must be rejected');
const FILL3 = { tpl: 'SELECT city, [[0]](total) AS revenue\nFROM orders\nGROUP BY [[1]]\n[[2]] SUM(total) > 100\nORDER BY revenue DESC;', blanks: [{ options: ['SUM', 'COUNT', 'MAX'], answer: 0 }, { options: ['city', 'customer', 'total'], answer: 0 }, { options: ['HAVING', 'WHERE'], answer: 0 }] };
const FILL3_RES = checkFill(DB3, FILL3.tpl, FILL3.blanks);

/** Random orders: customers live in fixed cities. */
function ordersTable(rng: () => number, n: number): Table {
  const custs = shuffle(rng, NAMES).slice(0, randInt(rng, 3, 5));
  const home = Object.fromEntries(custs.map((c) => [c, pick(rng, CITIES.slice(0, 3))]));
  return table('orders', ['order_id', 'customer', 'city', 'total'], Array.from({ length: n }, (_, k) => {
    const c = pick(rng, custs);
    return [101 + k, c, home[c], randInt(rng, 1, 20) * 5];
  }));
}

const genGroupSum: Generator = (rng) => {
  const t = ordersTable(rng, randInt(rng, 7, 9));
  const db = mkdb(t);
  const fn = pick(rng, ['SUM', 'COUNT', 'MAX']);
  const by = pick(rng, ['city', 'customer']);
  const groups = col0(query(db, `SELECT ${by} FROM orders GROUP BY ${by}`));
  const g = pick(rng, groups);
  const sql = `SELECT ${by}, ${fn}(${fn === 'COUNT' ? '*' : 'total'}) AS result\nFROM orders\nGROUP BY ${by};`;
  const ans = query(db, sql).rows.find((r) => r[0] === g)![1] as number;
  const mine = col0(query(db, `SELECT total FROM orders WHERE ${by} = '${g}'`));
  return {
    kind: 'number',
    body: `In the result of this query, what is \`result\` on the row for **${g}**?`,
    widget: () => tablesSql([t], sql),
    answer: ans, tol: 0,
    hint: `Find the rows with ${by} = ${g}, then apply ${fn} to them only.`,
    explain: `${g}'s orders have totals ${list(mine)}. ${fn === 'COUNT' ? `That's ${ans} rows` : fn === 'SUM' ? `They add to ${ans}` : `The largest is ${ans}`}.`,
  };
};

const genHavingRows: Generator = (rng) => {
  const t = ordersTable(rng, randInt(rng, 8, 10));
  const db = mkdb(t);
  const k = randInt(rng, 2, 3);
  const sql = `SELECT customer, COUNT(*) AS n\nFROM orders\nGROUP BY customer\nHAVING COUNT(*) >= ${k};`;
  const all = query(db, 'SELECT customer, COUNT(*) AS n FROM orders GROUP BY customer').rows;
  const res = query(db, sql).rows;
  return {
    kind: 'number',
    body: `Of these ${t.rows.length} orders, how many customers have at least ${k}, so appear in this result?`,
    widget: () => tablesSql([t], sql),
    answer: res.length, tol: 0,
    hint: 'One group per customer; HAVING then keeps the groups with enough orders.',
    explain: `Orders per customer: ${all.map((r) => `${r[0]} ${r[1]}`).join(', ')}. ${res.length} of them have at least ${k}.`,
  };
};

const genGroupAvg: Generator = (rng) => {
  const t = ordersTable(rng, randInt(rng, 7, 9));
  const db = mkdb(t);
  const cities = col0(query(db, 'SELECT city FROM orders GROUP BY city'));
  const c = pick(rng, cities);
  const sql = 'SELECT city, AVG(total) AS avg_total\nFROM orders\nGROUP BY city;';
  const ans = query(db, sql).rows.find((r) => r[0] === c)![1] as number;
  const mine = col0(query(db, `SELECT total FROM orders WHERE city = '${c}'`)) as number[];
  return {
    kind: 'number',
    body: `What is \`avg_total\` for **${c}**? (Round to 2 decimals if needed.)`,
    widget: () => tablesSql([t], sql),
    answer: ans, tol: 0.01,
    hint: `Average only the ${c} orders: their sum divided by how many there are.`,
    explain: `${c}'s orders: ${mine.join(' + ')} = ${mine.reduce((a, b) => a + b, 0)}, over ${mine.length}: ${f2(ans)}.`,
  };
};

const L3: Step[] = [
  {
    kind: 'number',
    body: 'Count it by hand first: how much did customers in **York** spend in total?',
    widget: () => showTable(ORDERS),
    answer: YORK, tol: 0,
    hint: 'Add the totals of the rows where city is York.',
    explain: `York's orders: ${list(col0(query(DB3, "SELECT total FROM orders WHERE city = 'York'")))}, adding to ${YORK}. Now imagine doing that for every city of a million orders. That is GROUP BY's job.`,
  },
  {
    kind: 'read', title: 'GROUP BY: one row per group',
    body: '`GROUP BY city` puts rows with the same city into one group. Each group becomes **one** output row, so every other column must be summarised by an **aggregate**: `COUNT` (how many rows), `SUM`, `AVG`, `MIN`, `MAX`. Step through it.',
    widget: () => pipeline(DB3, Q_GROUP),
  },
  {
    kind: 'number',
    body: 'How many rows does this return?',
    widget: () => tablesSql([ORDERS], 'SELECT customer, COUNT(*)\nFROM orders\nGROUP BY customer;'),
    answer: CUSTS, tol: 0,
    hint: 'One output row per group. How many different customers are there?',
    explain: `One row per distinct customer: ${list(col0(query(DB3, 'SELECT customer FROM orders GROUP BY customer')))}. The number of input rows doesn't matter, only the number of groups.`,
  },
  {
    kind: 'choice',
    body: 'In `SELECT city, AVG(total) FROM orders GROUP BY city`, what is the value on the **Leeds** row?',
    widget: () => showTable(ORDERS),
    options: uniq([
      { text: f2(LEEDS_AVG), correct: true },
      { text: f2(LEEDS_SUM), why: 'That’s SUM, the Leeds total. AVG divides it by the number of Leeds orders.' },
      { text: f2(ALL_AVG), why: 'That’s the average over every order. With GROUP BY, each city is averaged on its own.' },
      { text: f2(LEEDS_N), why: 'That’s COUNT, how many Leeds orders there are.' },
    ]),
    explain: `Leeds: ${LEEDS_SUM} over ${LEEDS_N} orders = ${f2(LEEDS_AVG)}.`,
  },
  {
    kind: 'choice',
    body: 'Who does this return?',
    widget: () => tablesSql([ORDERS], Q_TOP),
    options: uniq([
      { text: String(TOP[0]), correct: true },
      { text: String(TOP_ONE[0]), why: `${TOP_ONE[0]} placed the single biggest order (${TOP_ONE[1]}), but the query sorts customers by the SUM of all their orders.` },
      ...col0(query(DB3, 'SELECT customer FROM orders GROUP BY customer')).map((c) => ({ text: String(c), why: `${c} spent ${query(DB3, `SELECT SUM(total) FROM orders WHERE customer = '${c}'`).rows[0][0]} in total, less than ${TOP[1]}.` })),
    ]).slice(0, 4),
    hint: 'Add up each customer’s orders, then take the biggest sum.',
    explain: `${TOP[0]} spent ${TOP[1]} across ${count(DB3, 'orders', `customer = '${TOP[0]}'`)} orders, the most of anyone.`,
  },
  {
    kind: 'read', title: 'WHERE filters rows, HAVING filters groups',
    body: '**WHERE** runs *before* grouping: it throws out rows. **HAVING** runs *after*: it throws out whole groups, so it can test aggregates. This query counts each city’s orders of 30 or more, and keeps cities with at least two.',
    widget: () => pipeline(DB3, Q_WH),
  },
  {
    kind: 'choice',
    body: 'Which cities does this return?',
    widget: () => tablesSql([ORDERS], Q_HAV),
    options: uniq([
      { text: list(HAV), correct: true },
      { text: list(HAV_WHERE), why: `That would be \`WHERE total > ${HV}\`: cities with a single order over ${HV}. HAVING tests each city's SUM.` },
      { text: list(ALL_CITIES.filter((c) => !HAV.includes(c))), why: 'Those are the cities whose total is *not* over the limit: HAVING keeps the groups where the condition is true.' },
      { text: list(ALL_CITIES), why: 'HAVING removes the groups that fail its condition.' },
    ]),
    hint: 'Add each city’s totals, then compare with the limit.',
    explain: `City totals: ${query(DB3, 'SELECT city, SUM(total) FROM orders GROUP BY city').rows.map((r) => `${r[0]} ${r[1]}`).join(', ')}. Over ${HV}: ${list(HAV)}.`,
  },
  {
    kind: 'sort',
    body: 'A query groups orders **by customer**. Which clause should each condition go in?',
    bins: ['WHERE (tests rows)', 'HAVING (tests groups)'],
    items: [
      { text: '`total > 100`', bin: 0 },
      { text: "`city = 'Leeds'`", bin: 0 },
      { text: "`customer <> 'Ana'`", bin: 0 },
      { text: '`SUM(total) >= 500`', bin: 1 },
      { text: '`AVG(total) < 40`', bin: 1 },
      { text: '`MAX(total) > 90`', bin: 1 },
    ],
    hint: 'If the condition needs several rows to decide (a sum, an average), it is about a group.',
    explain: 'Aggregates only exist after grouping, so they go in HAVING. Plain row tests belong in WHERE (customer tests could go in HAVING too, but WHERE drops the rows earlier, so less work).',
  },
  {
    kind: 'choice',
    body: 'What happens when you run this?',
    widget: () => sqlBlock(BAD_GROUP),
    options: [
      { text: 'An error: customer is neither grouped nor aggregated', correct: true },
      { text: 'One row per city, with the first customer', why: 'There is no "first": a group of York orders has several customers and SQL won’t pick one for you. (MySQL in a lax mode does pick one arbitrarily, which is worse.)' },
      { text: 'One row per customer', why: 'GROUP BY city makes one row per city. Listing customer in SELECT doesn’t change the groups.' },
    ],
    explain: 'Each output row is a whole group. A column that differs inside the group needs an aggregate (`COUNT(DISTINCT customer)`, `MIN(customer)`) or must be added to GROUP BY.',
  },
  {
    kind: 'choice',
    body: 'And this one?',
    widget: () => sqlBlock(BAD_WHERE),
    options: [
      { text: 'An error: aggregates aren’t allowed in WHERE', correct: true },
      { text: 'Cities with more than 2 orders', why: 'That’s the intent, but WHERE runs before the groups exist, so there is nothing to count yet. Use HAVING.' },
      { text: 'Every city', why: 'The database rejects it before running anything.' },
    ],
    explain: 'Move the test to `HAVING COUNT(*) > 2`. Rule of thumb: WHERE for rows, HAVING for groups.',
  },
  {
    kind: 'fill', code: true,
    body: 'Complete it: revenue per city, only cities above 100, biggest first.',
    template: FILL3.tpl, blanks: FILL3.blanks,
    hint: 'Revenue is a sum. One row per city. The filter uses an aggregate.',
    explain: `Result: ${FILL3_RES.rows.map((r) => `${r[0]} ${r[1]}`).join(', ')}. WHERE can't hold SUM, and grouping by anything but city would leave city ungrouped.`,
  },
];

// ================================================================ lesson 4: joins

const CUST = table('customers', ['id', 'name'], [[1, 'Ana'], [2, 'Ben'], [3, 'Cy'], [4, 'Dee']]);
const ORD = table('orders', ['id', 'customer_id', 'total'], [[101, 1, 40], [102, 2, 25], [103, 1, 60], [104, 3, 15], [105, 1, 20], [106, 2, 35]]);
const REV = table('reviews', ['id', 'customer_id', 'stars'], [[1, 1, 5], [2, 1, 4], [3, 3, 2]]);
const DB4 = mkdb(CUST, ORD, REV);
const WHO = 104;
const WHO_C = scalar(query(DB4, `SELECT customer_id FROM orders WHERE id = ${WHO}`)) as number;
const WHO_N = scalar(query(DB4, `SELECT c.name FROM orders o JOIN customers c\n  ON c.id = o.customer_id WHERE o.id = ${WHO}`));
const Q_INNER = 'SELECT c.name, o.id, o.total\nFROM customers c\nJOIN orders o\n  ON o.customer_id = c.id;';
const INNER = query(DB4, Q_INNER);
const Q_LEFT = 'SELECT c.name, o.id, o.total\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id;';
const LEFT = query(DB4, Q_LEFT);
const ANA_N = INNER.rows.filter((r) => r[0] === 'Ana').length;
const MISSING = CUST.rows.map((r) => r[1]).filter((nm) => !INNER.rows.some((x) => x[0] === nm));
const NOORD = {
  A: 'SELECT c.name\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id\nWHERE o.id IS NULL;',
  B: 'SELECT c.name\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id\nWHERE o.id = NULL;',
  C: 'SELECT c.name\nFROM customers c\nJOIN orders o\n  ON o.customer_id = c.id\nWHERE o.id IS NULL;',
};
const NOORD_R = { A: col0(query(DB4, NOORD.A)), B: col0(query(DB4, NOORD.B)), C: col0(query(DB4, NOORD.C)) };
assert(JSON.stringify(NOORD_R.A) === JSON.stringify(MISSING) && !NOORD_R.B.length && !NOORD_R.C.length, 'no-orders queries');
const Q_FAN = "SELECT SUM(o.total)\nFROM customers c\nJOIN orders o\n  ON o.customer_id = c.id\nJOIN reviews r\n  ON r.customer_id = c.id\nWHERE c.name = 'Ana';";
const FAN = n1(query(DB4, Q_FAN));
const ANA_TRUE = n1(query(DB4, 'SELECT SUM(total) FROM orders WHERE customer_id = 1'));
const ANA_REV = count(DB4, 'reviews', 'customer_id = 1');
const FILL4 = { tpl: 'SELECT c.name, COUNT(o.id) AS orders\nFROM customers c\n[[0]] JOIN orders o\n  ON o.[[1]] = c.id\nGROUP BY c.id, c.name\nORDER BY c.name;', blanks: [{ options: ['LEFT', 'INNER', 'CROSS'], answer: 0 }, { options: ['customer_id', 'id', 'total'], answer: 0 }] };
const FILL4_RES = checkFill(DB4, FILL4.tpl, FILL4.blanks);
const CROSS_N = query(DB4, 'SELECT c.name, o.id FROM customers c CROSS JOIN orders o').rows.length;
assert(new Set([INNER.rows.length, LEFT.rows.length, CROSS_N]).size === 3, 'join counts distinct');

function custOrders(rng: () => number) {
  const n = randInt(rng, 4, 6);
  const names = shuffle(rng, NAMES).slice(0, n);
  const cust = table('customers', ['id', 'name'], names.map((nm, k) => [k + 1, nm]));
  const active = shuffle(rng, names.map((_, k) => k + 1)).slice(0, randInt(rng, 2, n - 1));
  const m = randInt(rng, 4, 7);
  const ord = table('orders', ['id', 'customer_id', 'total'], Array.from({ length: m }, (_, k) => [201 + k, pick(rng, active), randInt(rng, 2, 18) * 5]));
  return { cust, ord, db: mkdb(cust, ord) };
}

const genJoinCount: Generator = (rng) => {
  const { cust, ord, db } = custOrders(rng);
  const left = rng() < 0.5;
  const sql = `SELECT c.name, o.id\nFROM customers c\n${left ? 'LEFT JOIN' : 'JOIN'} orders o\n  ON o.customer_id = c.id;`;
  const r = query(db, sql);
  const per = cust.rows.map((c) => [c[1], ord.rows.filter((o) => o[1] === c[0]).length] as [Val, number]);
  return {
    kind: 'number',
    body: `${cust.rows.length} customers, ${ord.rows.length} orders. How many rows does this ${left ? 'LEFT JOIN' : 'inner JOIN'} return?`,
    widget: () => tablesSql([cust, ord], sql),
    answer: r.rows.length, tol: 0,
    hint: left ? 'One row per matching order, and one row (with NULLs) for each customer with no orders.' : 'One row per matching (customer, order) pair. Customers with no orders vanish.',
    explain: `Orders per customer: ${per.map(([nm, k]) => `${nm} ${k}`).join(', ')}. ${left ? `Each customer gives max(1, their orders) rows: ${per.map(([, k]) => Math.max(1, k)).join(' + ')} = ${r.rows.length}.` : `Every order matches exactly one customer: ${r.rows.length} rows.`}`,
  };
};

const genNoOrders: Generator = (rng) => {
  const { cust, ord, db } = custOrders(rng);
  const sql = 'SELECT c.name\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id\nWHERE o.id IS NULL;';
  const r = col0(query(db, sql));
  return {
    kind: 'number',
    body: `${cust.rows.length} customers, ${ord.rows.length} orders. How many rows does this query return?`,
    widget: () => tablesSql([cust, ord], sql),
    answer: r.length, tol: 0,
    hint: 'After a LEFT JOIN, the order columns are NULL exactly for customers with no orders.',
    explain: `Customers with no orders: ${list(r)}. That's ${r.length}.`,
  };
};

const genFanout: Generator = (rng) => {
  const nm = pick(rng, NAMES.slice(0, 6));
  const a = randInt(rng, 0, 4), b = randInt(rng, 0, 3);
  const cust = table('customers', ['id', 'name'], [[1, nm], [2, 'Zed']]);
  const ord = table('orders', ['id', 'customer_id'], [...Array.from({ length: a }, (_, k) => [301 + k, 1]), [399, 2]]);
  const tk = table('tickets', ['id', 'customer_id'], [...Array.from({ length: b }, (_, k) => [k + 1, 1]), [9, 2]]);
  const db = mkdb(cust, ord, tk);
  const sql = `SELECT o.id, t.id\nFROM customers c\nJOIN orders o\n  ON o.customer_id = c.id\nJOIN tickets t\n  ON t.customer_id = c.id\nWHERE c.name = '${nm}';`;
  const n = query(db, sql).rows.length;
  return {
    kind: 'number',
    body: `${nm} has ${s(a, 'order')} and ${s(b, 'support ticket')}. How many rows does this return?`,
    widget: () => tablesSql([cust, ord, tk], sql),
    answer: n, tol: 0,
    hint: 'Every order is paired with every ticket of the same customer.',
    explain: `Each of the ${a} orders pairs with each of the ${b} tickets: ${a} × ${b} = ${n}. ${n === 0 ? 'If either side has nothing to match, an inner join gives nothing at all.' : 'Summing order totals over this would count each order ' + b + ' times.'}`,
  };
};

const L4: Step[] = [
  {
    kind: 'choice',
    body: `The orders table doesn't store names, only a \`customer_id\`. Who placed order **${WHO}**?`,
    widget: () => tablesSql([CUST, ORD]),
    options: CUST.rows.map((r) => r[1] === WHO_N ? { text: String(r[1]), correct: true }
      : { text: String(r[1]), why: `${r[1]} is customer ${r[0]}; order ${WHO} has customer_id ${WHO_C}.` }),
    hint: `Find order ${WHO}, read its customer_id, then look that id up in customers.`,
    explain: `Order ${WHO} has customer_id ${WHO_C}, and customer ${WHO_C} is ${WHO_N}. You just did a join by hand.`,
  },
  {
    kind: 'read', title: 'Foreign keys link tables',
    body: '`orders.customer_id` holds a value of `customers.id`: it is a **foreign key**. One customer can have many orders (**one-to-many**), but each order belongs to one customer. A **JOIN** pairs up the rows whose keys match. Step through it.',
    widget: () => pipeline(DB4, Q_INNER),
  },
  {
    kind: 'number',
    body: 'How many rows does that join return?',
    widget: () => tablesSql([CUST, ORD], Q_INNER),
    answer: INNER.rows.length, tol: 0,
    hint: 'Each order matches exactly one customer.',
    explain: `One row per matching (customer, order) pair. Every order has one customer, so ${INNER.rows.length} rows, one per order.`,
  },
  {
    kind: 'choice',
    body: `In the join result, Ana appears ${ANA_N} times. Why?`,
    widget: () => showRes(INNER),
    options: [
      { text: `She has ${ANA_N} orders, and each matching pair is a row`, correct: true },
      { text: 'The join copied her by mistake; add DISTINCT', why: 'Nothing went wrong: each row is a different order. DISTINCT would hide real data.' },
      { text: 'Ana is stored several times in customers', why: 'She is one row in customers (id 1). The repetition comes from her orders.' },
    ],
    explain: 'A join makes one row per matching pair. The "one" side (customer) repeats once for each row on the "many" side (orders).',
  },
  {
    kind: 'multi',
    body: 'Which customers are **missing** from the join result?',
    widget: () => showRes(INNER),
    options: CUST.rows.map((r) => MISSING.includes(r[1]) ? { text: String(r[1]), correct: true } : { text: String(r[1]), why: `${r[1]} has orders, so appears in the result.` }),
    explain: `${list(MISSING)} placed no orders, so no order row matches and an inner join drops them silently.`,
  },
  {
    kind: 'read', title: 'LEFT JOIN keeps every left row',
    body: '`LEFT JOIN` keeps every row of the left table. When nothing matches, the right side’s columns are filled with **NULL** (unknown / nothing).',
    widget: () => h('div', null, sqlBlock(Q_LEFT), showRes(LEFT)),
  },
  {
    kind: 'number',
    body: 'How many rows does that LEFT JOIN return?',
    widget: () => tablesSql([CUST, ORD]),
    answer: LEFT.rows.length, tol: 0,
    hint: 'All the matching pairs, plus one row for each customer with no orders.',
    explain: `${INNER.rows.length} matching pairs plus ${MISSING.length} for ${list(MISSING)}: ${LEFT.rows.length}.`,
  },
  {
    kind: 'choice',
    body: 'Which query lists the customers who have **never ordered**?',
    widget: () => two(...(['A', 'B', 'C'] as const).map((k) => h('div', null, label(k), sqlBlock(NOORD[k])))),
    options: [
      { text: 'A', correct: true },
      { text: 'B', why: 'Nothing equals NULL, not even NULL: `= NULL` is never true, so B returns no rows. Use IS NULL.' },
      { text: 'C', why: 'An inner join already dropped the customers without orders, so there is nothing left with a NULL order. C returns no rows.' },
    ],
    explain: `A returns ${list(NOORD_R.A)}: the LEFT JOIN keeps them with NULL order columns, and \`IS NULL\` finds exactly those rows.`,
  },
  {
    kind: 'number',
    body: `Ana has ${s(count(DB4, 'orders', 'customer_id = 1'), 'order')} and ${s(ANA_REV, 'review')}. What does this query return?`,
    widget: () => tablesSql([ORD, REV], Q_FAN),
    answer: FAN, tol: 0,
    hint: 'Joining two "many" tables to the same customer pairs every order with every review.',
    explain: `Each order is paired with each of her ${ANA_REV} reviews, so every total is counted ${ANA_REV} times: ${FAN} instead of ${ANA_TRUE}. Rows multiply when you join two one-to-many tables through the same parent; sum in a separate query (or subquery) per table.`,
  },
  {
    kind: 'fill', code: true,
    body: 'Count each customer’s orders, **including customers with none** (they should show 0).',
    template: FILL4.tpl, blanks: FILL4.blanks,
    hint: 'Which join keeps customers with no orders? Which column of orders points at the customer?',
    explain: `Result: ${FILL4_RES.rows.map((r) => `${r[0]} ${r[1]}`).join(', ')}. COUNT(o.id) counts non-NULL values, so the NULL row a LEFT JOIN makes for a customer with no orders counts as 0.`,
  },
  {
    kind: 'match',
    body: `With these ${CUST.rows.length} customers and ${ORD.rows.length} orders, how many rows does each join give?`,
    widget: () => tablesSql([CUST, ORD]),
    heads: ['Join', 'Rows'],
    pairs: [
      ['`JOIN ... ON` keys match', `${INNER.rows.length} rows`],
      ['`LEFT JOIN ... ON` keys match', `${LEFT.rows.length} rows`],
      ['`CROSS JOIN` (no condition)', `${CROSS_N} rows`],
    ],
    explain: `Inner: matching pairs only (${INNER.rows.length}). Left: those plus unmatched customers (${LEFT.rows.length}). Cross: every customer with every order, ${CUST.rows.length} × ${ORD.rows.length} = ${CROSS_N}. Forgetting the ON condition is how a join explodes.`,
  },
];

// ================================================================ lesson 5: designing tables

const WIDE = table('loans', ['loan_id', 'member', 'email', 'title', 'author'], [
  [1, 'Ana', 'ana@mail.com', 'Dune', 'Herbert'],
  [2, 'Ben', 'ben@mail.com', 'Emma', 'Austen'],
  [3, 'Ana', 'ana@mail.com', 'Emma', 'Austen'],
  [4, 'Cy', 'cy@mail.com', 'Dune', 'Herbert'],
  [5, 'Ana', 'ana@mail.com', 'Solaris', 'Lem'],
  [6, 'Ben', 'ben@mail.com', 'Dune', 'Herbert'],
]);
const DB5 = mkdb(WIDE);
const ANA_EDITS = run(DB5, "UPDATE loans SET email = 'ana@new.com' WHERE member = 'Ana'").affected;
const DUNE_ROWS = rowsWhere(DB5, WIDE, "title = 'Dune'");
const HALF = run(DB5, "UPDATE loans SET email = 'ana@new.com' WHERE loan_id = 3").db;
const Q_HALF = "SELECT DISTINCT email\nFROM loans\nWHERE member = 'Ana';";
const HALF_R = col0(query(HALF, Q_HALF));
const lonely = col0(query(DB5, 'SELECT member FROM loans GROUP BY member HAVING COUNT(*) = 1'));
assert(lonely.length === 1, 'one member with a single loan');
const LONE = lonely[0];
const LONE_LOAN = scalar(query(DB5, `SELECT loan_id FROM loans WHERE member = '${LONE}'`));
const AFTER_DEL = run(DB5, `DELETE FROM loans WHERE loan_id = ${LONE_LOAN}`).db;
const LONE_LEFT = count(AFTER_DEL, 'loans', `member = '${LONE}'`);
const LONE_BOOK = scalar(query(DB5, `SELECT title FROM loans WHERE loan_id = ${LONE_LOAN}`));
const LONE_BOOK_LEFT = count(AFTER_DEL, 'loans', `title = '${LONE_BOOK}'`);

/** Split a wide loans table into members, books and loans tables, numbering members and books in order of appearance. */
function split(w: Table) {
  const mem: Val[][] = [], bk: Val[][] = [];
  const idOf = (rows: Val[][], a: Val, b: Val) => {
    let r = rows.find((x) => x[1] === a);
    if (!r) { r = [rows.length + 1, a, b]; rows.push(r); }
    return r[0];
  };
  const loans = w.rows.map((r) => [r[0], idOf(mem, r[1], r[2]), idOf(bk, r[3], r[4])]);
  return { members: table('members', ['member_id', 'name', 'email'], mem), books: table('books', ['book_id', 'title', 'author'], bk), loans: table('loans', ['loan_id', 'member_id', 'book_id'], loans) };
}
const SPLIT = split(WIDE);
const DB5S = mkdb(SPLIT.members, SPLIT.books, SPLIT.loans);
const SPLIT_EDITS = run(DB5S, "UPDATE members SET email = 'ana@new.com' WHERE name = 'Ana'").affected;
const Q_REBUILD = 'SELECT l.loan_id, m.name, b.title\nFROM loans l\nJOIN members m\n  ON m.member_id = l.member_id\nJOIN books b\n  ON b.book_id = l.book_id;';
const REBUILD = query(DB5S, Q_REBUILD);
assert(sameRes(REBUILD, query(DB5, 'SELECT loan_id, member, title FROM loans'), false), 'split rebuilds the wide table');

const STUDENTS = ['Ana', 'Ben', 'Cy', 'Dee'], COURSES = ['MATH', 'ART', 'BIO'];
const TAKES = [[1, 0, 1], [1, 1, 0], [0, 1, 1], [1, 0, 0]];
const LINK_N = TAKES.flat().reduce((a, b) => a + b, 0);
const tickGrid = (studs: string[], crs: string[], takes: number[][]) => grid(['student', ...crs], studs.map((st, i) => [st, ...crs.map((_, j) => (takes[i][j] ? '✓' : ''))]));

function wideTable(rng: () => number) {
  const mem = shuffle(rng, NAMES).slice(0, 3);
  const bks = shuffle(rng, [['Dune', 'Herbert'], ['Emma', 'Austen'], ['Solaris', 'Lem'], ['Ulysses', 'Joyce'], ['Beloved', 'Morrison']]).slice(0, 3);
  const n = randInt(rng, 5, 7);
  return table('loans', ['loan_id', 'member', 'email', 'title', 'author'], Array.from({ length: n }, (_, k) => {
    const m = pick(rng, mem), b = pick(rng, bks);
    return [k + 1, m, `${m.toLowerCase()}@mail.com`, b[0], b[1]];
  }));
}

const genEdits: Generator = (rng) => {
  const t = wideTable(rng);
  const db = mkdb(t);
  const byMember = rng() < 0.5;
  const who = pick(rng, col0(query(db, `SELECT ${byMember ? 'member' : 'title'} FROM loans GROUP BY ${byMember ? 'member' : 'title'}`)));
  const sql = byMember ? `UPDATE loans SET email = '${String(who).toLowerCase()}@new.com' WHERE member = '${who}'` : `UPDATE loans SET author = 'Someone' WHERE title = '${who}'`;
  const n = run(db, sql).affected;
  return {
    kind: 'number',
    body: byMember ? `${who} changes email address. How many rows of this table must be edited?` : `The author of *${who}* was entered wrongly. How many rows must be fixed?`,
    widget: () => showTable(t),
    answer: n, tol: 0,
    hint: byMember ? `Every row that mentions ${who} holds its own copy of the email.` : `Every loan of ${who} holds its own copy of the author.`,
    explain: `${s(n, 'row')} mention ${who}. Each is a separate copy, and missing one leaves the table contradicting itself. In a split design it would be exactly 1 row.`,
  };
};

const genSplitRows: Generator = (rng) => {
  const t = wideTable(rng);
  const sp = split(t);
  const which = pick(rng, ['members', 'books', 'loans'] as const);
  const n = sp[which].rows.length;
  return {
    kind: 'number',
    body: `This wide table is split into \`members(member_id, name, email)\`, \`books(book_id, title, author)\` and \`loans(loan_id, member_id, book_id)\`. How many rows does **${which}** get?`,
    widget: () => showTable(t),
    answer: n, tol: 0,
    hint: which === 'loans' ? 'Each loan is still one row; it just stores ids instead of copies.' : `One row per distinct ${which === 'members' ? 'member' : 'book'}.`,
    explain: which === 'loans' ? `Still one row per loan: ${n}.` : `Distinct ${which}: ${list(sp[which].rows.map((r) => r[1]))}. That's ${n}, each stored once.`,
  };
};

const genLinkRows: Generator = (rng) => {
  const studs = shuffle(rng, NAMES).slice(0, randInt(rng, 3, 5));
  const crs = shuffle(rng, ['MATH', 'ART', 'BIO', 'CHEM', 'HIST']).slice(0, 3);
  const takes: number[][] = studs.map(() => crs.map(() => (rng() < 0.5 ? 1 : 0)));
  const total = takes.flat().reduce((a, b) => a + b, 0);
  const c = randInt(rng, 0, 2);
  const one = rng() < 0.5;
  const ans = one ? takes.reduce((a, r) => a + r[c], 0) : total;
  return {
    kind: 'number',
    body: one ? `The ticks show who takes which course. In the link table \`enrolments(student_id, course_id)\`, how many rows have course **${crs[c]}**?` : 'The ticks show who takes which course. How many rows does the link table `enrolments(student_id, course_id)` have?',
    widget: () => tickGrid(studs, crs, takes),
    answer: ans, tol: 0,
    hint: 'One row per tick: each row records one student taking one course.',
    explain: one ? `${ans} tick${ans === 1 ? '' : 's'} in the ${crs[c]} column, so ${ans} row${ans === 1 ? '' : 's'}.` : `One row per tick: ${takes.map((r) => r.reduce((a, b) => a + b, 0)).join(' + ')} = ${total}.`,
  };
};

const L5: Step[] = [
  {
    kind: 'number',
    body: 'A library keeps everything in one big table. Ana changes her email address. How many rows must be edited?',
    widget: () => showTable(WIDE),
    answer: ANA_EDITS, tol: 0,
    hint: 'Count the rows that mention Ana.',
    explain: `Ana's email is copied into all ${ANA_EDITS} of her loans, so all ${ANA_EDITS} must change. The same fact is stored ${ANA_EDITS} times.`,
  },
  {
    kind: 'task',
    body: 'Dune’s author was entered wrongly. **Tap every row** that must be fixed.',
    widget: rowPick(WIDE, DUNE_ROWS),
    hint: 'Every loan of Dune carries its own copy of the author.',
    explain: `${DUNE_ROWS.length} rows (loans ${DUNE_ROWS.map((k) => WIDE.rows[k][0]).join(', ')}). The author is a fact about the book, yet it's copied into every loan of it.`,
  },
  {
    kind: 'number',
    body: 'Someone fixes Ana’s email but only in **one** row: `UPDATE loans SET email = \'ana@new.com\' WHERE loan_id = 3`. How many rows does this return now?',
    widget: () => sqlBlock(Q_HALF),
    answer: HALF_R.length, tol: 0,
    hint: 'DISTINCT shows each different value once. How many different emails does Ana have now?',
    explain: `It returns ${list(HALF_R)}. The table now holds ${HALF_R.length} emails for one person, and nothing says which is right. That is an **update anomaly**.`,
  },
  {
    kind: 'read', title: 'Three ways duplication bites',
    body: '- **Update anomaly**: a fact stored in many rows gets changed in some and not others.\n- **Insert anomaly**: you can’t record a new member until they borrow something (there is no row to put them in).\n- **Delete anomaly**: deleting someone’s last loan deletes everything known about them.\n\nThe cure is the same for all three: **store each fact once**, in a table about that kind of thing, and point at it by key.',
  },
  {
    kind: 'choice',
    body: `${LONE} has a single loan. The library deletes it: \`DELETE FROM loans WHERE loan_id = ${LONE_LOAN}\`. What else is lost?`,
    widget: () => showTable(WIDE),
    options: [
      { text: `${LONE}'s email: no row mentions ${LONE} any more`, correct: true },
      { text: 'Nothing: it was just one loan', why: `After the delete, ${s(LONE_LEFT, 'row')} mention ${LONE}. Their email lived only in that loan.` },
      { text: `${LONE_BOOK}'s author`, why: `${LONE_BOOK} still appears in ${s(LONE_BOOK_LEFT, 'other row')}, so its author survives (this time).` },
    ],
    explain: 'That is a **delete anomaly**: facts about a member were stored only inside loans, so they vanish with the last loan.',
  },
  {
    kind: 'read', title: 'Split it into related tables',
    body: 'Give members and books their own tables, each fact stored once. Loans keep only the keys: *which member, which book*. These three tables were computed from the wide one.',
    widget: () => tablesSql([SPLIT.members, SPLIT.books, SPLIT.loans]),
  },
  {
    kind: 'number',
    body: 'In the split design, how many rows must change when Ana changes her email?',
    widget: () => showTable(SPLIT.members),
    answer: SPLIT_EDITS, tol: 0,
    explain: `Just ${SPLIT_EDITS}: her row in members. Every loan points at member_id ${SPLIT.members.rows.find((r) => r[1] === 'Ana')![0]}, so they all see the new email at once.`,
  },
  {
    kind: 'number',
    body: 'Splitting doesn’t lose anything: a join puts the rows back together. How many rows does this return?',
    widget: () => sqlBlock(Q_REBUILD),
    answer: REBUILD.rows.length, tol: 0,
    hint: 'Every loan matches exactly one member and one book.',
    explain: `${REBUILD.rows.length}, one per loan, the same as the wide table had. You store facts once and join them when you need them together.`,
  },
  {
    kind: 'read', title: 'Many-to-many needs a link table',
    body: 'A student takes several courses; a course has several students. A `course_id` column in students can hold only one course, and a list in one cell can’t be searched or checked. Instead, add a **link table** with one row per (student, course) pair. Each tick below is one row of `enrolments`.',
    widget: () => tickGrid(STUDENTS, COURSES, TAKES),
  },
  {
    kind: 'number',
    body: 'How many rows does the link table `enrolments(student_id, course_id)` have for the ticks above?',
    widget: () => tickGrid(STUDENTS, COURSES, TAKES),
    answer: LINK_N, tol: 0,
    hint: 'One row per tick.',
    explain: `One row per tick: ${TAKES.map((r) => r.reduce((a, b) => a + b, 0)).join(' + ')} = ${LINK_N}. Who takes MATH? Rows with course_id MATH. Ana's courses? Rows with Ana's id.`,
  },
  {
    kind: 'choice',
    body: 'Where should a student’s **grade in a course** be stored?',
    options: [
      { text: 'In enrolments, next to the (student, course) pair', correct: true },
      { text: 'In students', why: 'A student has a different grade in each course, so one grade column in students can’t hold them.' },
      { text: 'In courses', why: 'A course gives different grades to different students.' },
    ],
    explain: 'A grade is a fact about one student *in* one course, so it belongs to the pair. Link tables often carry such facts (a grade, a start date, a quantity).',
  },
  {
    kind: 'sort',
    body: 'Sort each relationship: can each side have many of the other?',
    bins: ['One-to-many', 'Many-to-many'],
    items: [
      { text: 'Customer and order', bin: 0 },
      { text: 'Country and city', bin: 0 },
      { text: 'Order and its delivery address', bin: 0 },
      { text: 'Author and book (co-authors exist)', bin: 1 },
      { text: 'Actor and film', bin: 1 },
      { text: 'Student and course', bin: 1 },
    ],
    hint: 'Ask both ways: can one X have many Y? Can one Y have many X?',
    explain: 'One-to-many: a foreign key on the "many" side (orders.customer_id). Many-to-many: a link table with both keys.',
  },
];

// ================================================================ lesson 6: indexes

const BIG = 2_000_000;
const BIG_PROBES = worstProbes(BIG);
const KEYS = [1815, 1817, 1937, 1949, 1950, 1961, 1965, 1968, 1987, 1997, 2002, 2005, 2011, 2015, 2020];
const KEY_T = 2002;
const KEY_P = probes(KEYS, KEY_T);
const KEY_X = 1949;
const KEY_XP = probes(KEYS, KEY_X);
const BILLION_P = worstProbes(1e9), THOUSAND_P = worstProbes(1e3);
const IDX = 4, INS = 1000;
const ROWS6 = 600_000, STATUS_V = 3, CUST_V = 50_000;

const genScanIndex: Generator = (rng) => {
  const n = randInt(rng, 1, 9) * 10 ** randInt(rng, 3, 7);
  const idx = rng() < 0.6;
  return {
    kind: 'number',
    body: `A \`users\` table has ${n.toLocaleString('en-US')} rows. The query is \`SELECT name FROM users WHERE email = 'x@mail.com'\`. ${idx ? 'With an index on email (a sorted list searched by binary search), at most how many index entries are checked?' : 'With **no** index on email, how many rows does the database read?'}`,
    answer: idx ? worstProbes(n) : n, tol: 0,
    hint: idx ? 'Binary search halves the range at each check: about log₂(n).' : 'Without an index it can’t know where the match is, or whether there is a second one.',
    explain: idx ? `Halving ${n.toLocaleString('en-US')} entries until one is left takes ⌈log₂(${n.toLocaleString('en-US')} + 1)⌉ = ${worstProbes(n)} checks.` : `A full scan reads all ${n.toLocaleString('en-US')} rows, even after finding a match, since another row could match too.`,
  };
};

const genProbes: Generator = (rng) => {
  const keys = shuffle(rng, Array.from({ length: 60 }, (_, k) => 10 + k * 3)).slice(0, randInt(rng, 9, 15)).sort((a, b) => a - b);
  const x = pick(rng, keys);
  const ps = probes(keys, x);
  return {
    kind: 'number',
    body: `An index holds these ${keys.length} sorted keys. Binary search for **${x}** checks the middle entry (rounding down), then the middle of the half that's left, and so on. How many entries does it check, counting the one where it finds ${x}?`,
    widget: () => cells(keys),
    answer: ps.length, tol: 0,
    hint: 'Positions start at 0. The middle of positions lo..hi is ⌊(lo + hi) / 2⌋.',
    explain: `It checks ${ps.map((p) => keys[p]).join(' → ')}: ${s(ps.length, 'entry', 'entries')}.`,
  };
};

const genWriteCost: Generator = (rng) => {
  const k = randInt(rng, 1, 6), m = pick(rng, [100, 500, 1000, 2000, 5000]);
  return {
    kind: 'number',
    body: `A table has ${s(k, 'index', 'indexes')} (counting its primary key). You insert ${m.toLocaleString('en-US')} rows. How many index entries must be added?`,
    answer: k * m, tol: 0,
    hint: 'Every index needs an entry for every new row.',
    explain: `Each row adds one entry to each of the ${k} indexes: ${m.toLocaleString('en-US')} × ${k} = ${(k * m).toLocaleString('en-US')}, on top of writing the rows themselves. Indexes speed up reads and slow down writes.`,
  };
};

const L6: Step[] = [
  {
    kind: 'choice',
    body: 'A paper phone book lists a million people, sorted by surname. Which question can you answer quickly?',
    options: [
      { text: 'What is Jo Patel’s number?', correct: true },
      { text: 'Who lives on Elm Street?', why: 'The book isn’t sorted by street, so you’d have to read every entry.' },
      { text: 'Whose number ends in 42?', why: 'Not sorted by that either: a full read of every page.' },
    ],
    explain: 'Sorted data lets you jump (binary search). Anything the data isn’t sorted by means reading all of it. Databases face the same choice for every query.',
  },
  {
    kind: 'number',
    body: `A \`users\` table has ${BIG.toLocaleString('en-US')} rows and **no index**. How many rows does the database read for \`SELECT name FROM users WHERE email = 'jo@mail.com'\`?`,
    answer: BIG, tol: 0,
    hint: 'Without help it can’t know which rows match, or whether a second row matches too.',
    explain: `All ${BIG.toLocaleString('en-US')}. This is a **full table scan**: check every row against the WHERE condition.`,
  },
  {
    kind: 'read', title: 'An index is a sorted copy',
    body: `An **index** on a column is a separate structure holding that column’s values in sorted order, each with a pointer to its row. Lookups become a binary search. Here an index on \`year\` finds ${KEY_T} in ${KEY_P.length} checks, where reading the rows in year order would take ${KEYS.indexOf(KEY_T) + 1}. Watch the range shrink.`,
    widget: () => indexLookup(KEYS, KEY_T, 'index on year'),
  },
  {
    kind: 'number',
    body: `With an index on \`email\`, at most how many index entries does a binary search check among ${BIG.toLocaleString('en-US')}?`,
    answer: BIG_PROBES, tol: 0,
    hint: 'How many times can you halve two million before one is left?',
    explain: `⌈log₂(${BIG.toLocaleString('en-US')} + 1)⌉ = ${BIG_PROBES}. From two million rows read to ${BIG_PROBES} entries checked, then one row fetched. (Real databases use B-trees, which are wider and shallower still, but the idea is the same.)`,
  },
  {
    kind: 'number',
    body: `Using the same index, how many entries does the search check to find **${KEY_X}**? Count the one where it's found.`,
    widget: () => cells(KEYS),
    answer: KEY_XP.length, tol: 0,
    hint: 'Start at the middle position, ⌊(0 + 14) / 2⌋ = 7.',
    explain: `It checks ${KEY_XP.map((p) => KEYS[p]).join(' → ')}: ${s(KEY_XP.length, 'entry', 'entries')}. A scan in year order would have read ${KEYS.indexOf(KEY_X) + 1}.`,
  },
  {
    kind: 'read', title: 'Scan vs index as tables grow',
    body: 'Drag the size. A scan grows with the table; an index lookup grows with its logarithm.',
    widget: scanVsIndex(),
  },
  {
    kind: 'estimate',
    body: `An indexed lookup on a thousand rows checks about ${THOUSAND_P} entries. The table grows to a **billion** rows. About how many now?`,
    min: 0, max: 100, step: 1, answer: BILLION_P, tol: 3,
    explain: `⌈log₂(1,000,000,001)⌉ = ${BILLION_P}. A million times more rows costs only ${BILLION_P - THOUSAND_P} more checks, since every 1,000× adds about 10.`,
  },
  {
    kind: 'number',
    body: `A table has ${IDX} indexes (counting the primary key). You insert ${INS.toLocaleString('en-US')} rows. How many index entries must be written?`,
    answer: IDX * INS, tol: 0,
    hint: 'Each index needs an entry for each new row.',
    explain: `${INS.toLocaleString('en-US')} × ${IDX} = ${(IDX * INS).toLocaleString('en-US')} index entries, plus the rows. Every index speeds up some reads and slows down every write (and takes space).`,
  },
  {
    kind: 'sort',
    body: 'There is an index on `email` only. Which queries can use it?',
    bins: ['Index helps', 'Index can’t help'],
    items: [
      { text: "`WHERE email = 'ana@mail.com'`", bin: 0 },
      { text: "`WHERE email LIKE 'ana%'`", bin: 0 },
      { text: '`ORDER BY email LIMIT 10`', bin: 0 },
      { text: "`WHERE email LIKE '%@gmail.com'`", bin: 1 },
      { text: "`WHERE LOWER(email) = 'ana@mail.com'`", bin: 1 },
      { text: "`WHERE city = 'Leeds'`", bin: 1 },
    ],
    hint: 'A sorted list helps when you know how the value *starts*. Does the query search on the stored value itself?',
    explain: 'An exact match, a known prefix, or "first 10 in order" all walk the sorted list. A pattern with an unknown start, a function applied to the column (`LOWER(email)` isn’t what’s sorted), or a different column all need a scan.',
  },
  {
    kind: 'choice',
    body: `An \`orders\` table has ${ROWS6.toLocaleString('en-US')} rows. \`status\` has ${STATUS_V} values, evenly spread; \`customer_id\` has ${CUST_V.toLocaleString('en-US')}. The app runs \`WHERE customer_id = ?\` constantly and \`WHERE status = ?\` rarely. Which single index helps most?`,
    options: [
      { text: 'customer_id', correct: true },
      { text: 'status', why: `Each status matches about ${(ROWS6 / STATUS_V).toLocaleString('en-US')} rows, a third of the table: the index barely narrows anything down, and that query is rare anyway.` },
      { text: 'Neither: indexes don’t help with WHERE', why: 'Speeding up WHERE lookups is exactly what indexes are for.' },
    ],
    explain: `A customer has about ${ROWS6 / CUST_V} orders, so the index jumps from ${ROWS6.toLocaleString('en-US')} rows to about ${ROWS6 / CUST_V}. Index columns that are queried often **and** narrow the result down a lot.`,
  },
  {
    kind: 'choice',
    body: 'Then why not put an index on every column?',
    options: [
      { text: 'Every insert, update and delete must also update every index', correct: true },
      { text: 'Databases only allow one index per table', why: 'Tables commonly have several indexes.' },
      { text: 'Indexes make reads slower', why: 'They make the matching reads faster. The cost is on writes and storage.' },
    ],
    explain: 'Indexes trade write speed and storage for read speed. Add one for a query you actually run often, not "just in case".',
  },
];

// ================================================================ lesson 7: transactions

const ACC = table('accounts', ['account_id', 'owner', 'balance'], [[1, 'Ana', 200], [2, 'Ben', 80]]);
const DB7 = mkdb(ACC);
const AMT = 50;
const T_STMTS = [`UPDATE accounts SET balance = balance - ${AMT} WHERE account_id = 1`, `UPDATE accounts SET balance = balance + ${AMT} WHERE account_id = 2`];
const totalOf = (db: DB) => n1(query(db, 'SELECT SUM(balance) FROM accounts'));
const T0 = totalOf(DB7);
const HALFDONE = run(DB7, T_STMTS[0]).db;
const T_HALF = totalOf(HALFDONE);
const ANA0 = scalar(query(DB7, 'SELECT balance FROM accounts WHERE account_id = 1'));
const LU = { start: 100, delta: { A: 20, B: -30 } };
const LU_NAMES = { A: 'Ana (+20)', B: 'Ben (−30)' };
const LU_BAD: TxOp[] = [{ who: 'A', op: 'read' }, { who: 'B', op: 'read' }, { who: 'A', op: 'write' }, { who: 'B', op: 'write' }];
const LU_BAD_F = runSchedule(LU.start, LU.delta, LU_BAD).final;
const LU_Q: TxOp[] = [{ who: 'B', op: 'read' }, { who: 'A', op: 'read' }, { who: 'B', op: 'write' }, { who: 'A', op: 'write' }];
const LU_Q_F = runSchedule(LU.start, LU.delta, LU_Q).final;
const LU_RIGHT = LU.start + LU.delta.A + LU.delta.B;

const SCHEDULES: TxOp[][] = (() => {
  const out: TxOp[][] = [];
  for (const seq of ['AABB', 'ABAB', 'ABBA', 'BAAB', 'BABA', 'BBAA']) {
    const seen = { A: 0, B: 0 };
    out.push([...seq].map((w) => { const who = w as 'A' | 'B'; const op = seen[who]++ ? 'write' : 'read'; return { who, op }; }));
  }
  return out;
})();

const genCrash: Generator = (rng) => {
  const a = randInt(rng, 10, 40) * 10, b = randInt(rng, 2, 30) * 10, amt = randInt(rng, 2, Math.min(15, a / 10)) * 10;
  const db = mkdb(table('accounts', ['account_id', 'owner', 'balance'], [[1, 'Ana', a], [2, 'Ben', b]]));
  const st = [`UPDATE accounts SET balance = balance - ${amt} WHERE account_id = 1;`, `UPDATE accounts SET balance = balance + ${amt} WHERE account_id = 2;`];
  const tx = rng() < 0.5;
  const after = tx ? db : run(db, st[0]).db;
  const tot = totalOf(after);
  return {
    kind: 'number',
    body: `Ana has ${a}, Ben has ${b}. A transfer of ${amt} runs ${tx ? 'inside `BEGIN; … COMMIT;`' : 'with no transaction'}, and the power fails right after the first UPDATE. After the restart, what is the **total** money in the two accounts?`,
    widget: () => sqlBlock((tx ? ['BEGIN;', ...st, 'COMMIT;'] : st).join('\n'), { active: tx ? 2 : 1 }),
    answer: tot, tol: 0,
    hint: tx ? 'An unfinished transaction is undone on restart.' : 'The first UPDATE already took effect; the second never ran.',
    explain: tx ? `The transaction never committed, so the database rolls the first UPDATE back: ${a} + ${b} = ${tot}, as before.` : `Ana lost ${amt}, Ben never got it: ${a - amt} + ${b} = ${tot}, so ${amt} vanished.`,
  };
};

const genSchedule: Generator = (rng) => {
  const ops = pick(rng, SCHEDULES);
  const start = randInt(rng, 5, 20) * 10;
  const delta = { A: randInt(rng, 1, 5) * 10, B: -randInt(rng, 1, 5) * 10 };
  const f = runSchedule(start, delta, ops).final;
  return {
    kind: 'number',
    body: `A shared balance starts at ${start}. Session A adds ${delta.A}, session B takes ${-delta.B}; each reads the balance, then writes back what it read plus its change. They run in this order. What is the final balance?`,
    widget: () => grid(['step', 'A', 'B'], ops.map((o, k) => [String(k + 1), o.who === 'A' ? opText(o, delta) : '', o.who === 'B' ? opText(o, delta) : ''])),
    answer: f, tol: 0,
    hint: 'Keep track of what each session read: a write uses that, not the current balance.',
    explain: `${runSchedule(start, delta, ops).log.map((l) => `${l.who} ${l.text}`).join('; ')}. Final ${f}${f === start + delta.A + delta.B ? ', which is correct.' : `, but it should be ${start + delta.A + delta.B}: one update was lost.`}`,
  };
};

const genLost: Generator = (rng) => {
  const ops = pick(rng, SCHEDULES);
  const start = randInt(rng, 5, 20) * 10;
  const delta = { A: randInt(rng, 1, 5) * 10, B: -randInt(rng, 1, 5) * 10 };
  const f = runSchedule(start, delta, ops).final, right = start + delta.A + delta.B;
  const lost = f !== right;
  return {
    kind: 'choice',
    body: `Balance ${start}. A adds ${delta.A}, B takes ${-delta.B}, each by reading and then writing. Does this order lose an update?`,
    widget: () => grid(['step', 'A', 'B'], ops.map((o, k) => [String(k + 1), o.who === 'A' ? opText(o, delta) : '', o.who === 'B' ? opText(o, delta) : ''])),
    options: [
      { text: lost ? `Yes: it ends at ${f}, not ${right}` : `No: it ends at ${right}`, correct: true },
      lost ? { text: `No: it ends at ${right}`, why: 'Both sessions read before either wrote, so the second write is based on a stale balance.' }
        : { text: `Yes: it ends at ${start + (ops[3].who === 'A' ? delta.A : delta.B)}`, why: 'One session finished (read and write) before the other read, so the second read already saw the first change.' },
    ],
    hint: 'An update is lost when both sessions read before either one writes.',
    explain: `${runSchedule(start, delta, ops).log.map((l) => `${l.who} ${l.text}`).join('; ')}.`,
  };
};

const L7: Step[] = [
  {
    kind: 'choice',
    body: `Ana sends Ben ${AMT}. That is two UPDATEs. The power fails right after the first. What is the total money in the two accounts now?`,
    widget: () => tablesSql([ACC], T_STMTS.join(';\n') + ';'),
    options: uniq([
      { text: String(T_HALF), correct: true },
      { text: String(T0), why: `That would be true if both ran, or neither. Here Ana's ${AMT} left and never arrived.` },
      { text: String(T0 + AMT), why: 'That would be Ben getting the money without Ana paying. It’s the first statement that ran.' },
    ]),
    hint: 'Only the first UPDATE ran.',
    explain: `Ana's balance dropped by ${AMT}; Ben's didn't rise. ${T0} became ${T_HALF}: money destroyed by a half-finished change.`,
  },
  {
    kind: 'read', title: 'All or nothing',
    body: 'A **transaction** groups statements: `BEGIN;` … `COMMIT;`. Either every change is kept, or none is: if anything fails before COMMIT (an error, a crash, a `ROLLBACK;`), the database undoes the lot. Move the power cut and switch the transaction on.',
    widget: crashExplorer(DB7, T_STMTS, 'accounts'),
  },
  {
    kind: 'number',
    body: `With \`BEGIN;\` before the two UPDATEs and \`COMMIT;\` after, the power fails after the first UPDATE. What is Ana's balance after the restart?`,
    answer: ANA0 as number, tol: 0,
    hint: 'The transaction never reached COMMIT.',
    explain: `${ANA0}: the unfinished transaction is rolled back on restart, as if it never started. Ben is untouched too.`,
  },
  {
    kind: 'order',
    body: 'Put a safe transfer in order.',
    items: ['`BEGIN;`', 'Check Ana has at least 50', 'Take 50 from Ana and add 50 to Ben (two UPDATEs)', '`COMMIT;`'],
    hint: 'The check has to happen inside the transaction, before any money moves.',
    explain: 'BEGIN, check, both UPDATEs, COMMIT. If the check fails, `ROLLBACK;` instead and nothing has changed.',
  },
  {
    kind: 'read', title: 'Two people at once',
    body: `Ana and Ben share an account with ${LU.start}. At the same moment Ana deposits ${LU.delta.A} and Ben withdraws ${-LU.delta.B}. Each app **reads** the balance, then **writes** back what it read plus its change.`,
    widget: () => scheduleTable(LU.start, LU.delta, LU_BAD, LU_NAMES),
  },
  {
    kind: 'task',
    body: `Your turn to be unlucky. Choose whose step runs next, and find an order that **loses** one of the updates (the right answer is ${LU_RIGHT}).`,
    widget: interleaveTask(LU.start, LU.delta, LU_NAMES),
    hint: 'Let both read before either writes.',
    explain: `Any order where both read before either writes loses an update: the second write is based on a stale balance and overwrites the first. Above, it ended at ${LU_BAD_F} instead of ${LU_RIGHT}.`,
  },
  {
    kind: 'number',
    body: 'What does the balance end at in this order?',
    widget: () => grid(['step', LU_NAMES.A, LU_NAMES.B], LU_Q.map((o, k) => [String(k + 1), o.who === 'A' ? opText(o, LU.delta) : '', o.who === 'B' ? opText(o, LU.delta) : ''])),
    answer: LU_Q_F, tol: 0,
    hint: 'Ana writes last, using what she read at step 2.',
    explain: `Ana read ${LU.start} before Ben wrote, so her write of ${LU_Q_F} wipes out his withdrawal. Ben loses nothing; the bank does.`,
  },
  {
    kind: 'choice',
    body: 'Which change fixes the lost update?',
    options: [
      { text: `Make each change one statement: UPDATE accounts SET balance = balance + 20 WHERE account_id = 1`, correct: true },
      { text: 'Make the app read and write faster', why: 'A smaller gap makes it rarer, not impossible. With enough users, rare happens daily.' },
      { text: 'Wrap each read and write in BEGIN … COMMIT; that alone always prevents it', why: 'At READ COMMITTED, the default in many databases, two transactions can still both read the old balance. You also need a lock (SELECT … FOR UPDATE), a stricter isolation level, or a single UPDATE.' },
      { text: 'Read the balance again after writing', why: 'By then the other write has already been lost.' },
    ],
    explain: 'In `SET balance = balance + 20` the database reads and writes the row in one step while holding a lock on it, so a second UPDATE of that row waits and then sees the new balance.',
  },
  {
    kind: 'read', title: 'Isolation in plain terms',
    body: '**Isolation** is the promise that transactions running at the same time don’t trip over each other. The strictest level (SERIALIZABLE) makes the result the same as running them one after another, aborting one if needed so you can retry. Weaker, faster levels (like READ COMMITTED) still hide half-finished work from others but allow some anomalies, such as the lost update you just made. Stricter means safer and more waiting or retrying.',
  },
  {
    kind: 'multi',
    body: 'Which are true at the default isolation level of common databases?',
    options: [
      { text: 'Once COMMIT returns, the change survives a power cut', correct: true },
      { text: 'ROLLBACK undoes every change made since BEGIN', correct: true },
      { text: 'Other sessions can see the first UPDATE before COMMIT', why: 'Uncommitted changes are hidden from other sessions (no "dirty reads").' },
      { text: 'A transaction makes the statements inside it run faster', why: 'Transactions are about correctness, not speed; holding locks can even make others wait.' },
    ],
    explain: 'Durable after COMMIT, undone by ROLLBACK, invisible to others until committed.',
  },
  {
    kind: 'match',
    body: 'Transactions are often summed up as **ACID**. Match each letter to its meaning.',
    heads: ['Property', 'Meaning'],
    pairs: [
      ['Atomic', 'All of the changes happen, or none do'],
      ['Consistent', 'Rules like keys and checks hold before and after'],
      ['Isolated', 'Concurrent transactions don’t see each other’s half-done work'],
      ['Durable', 'Once committed, it survives a crash'],
    ],
    explain: 'The transfer needed A (no half-transfers); the shared account needed I (no lost updates).',
  },
];

// ================================================================ lesson 8: NULL and other traps

const STU = table('students', ['student_id', 'name', 'city', 'score'], [
  [1, 'Ana', 'Leeds', 72], [2, 'Ben', 'York', null], [3, 'Cy', 'Leeds', 45], [4, 'Dee', 'Bath', 88], [5, 'Eve', 'York', null], [6, 'Fay', 'Leeds', 50],
]);
const DB8 = mkdb(STU);
const N8 = STU.rows.length;
const PASS = count(DB8, 'students', 'score >= 50'), FAIL = count(DB8, 'students', 'score < 50');
const EQNULL = count(DB8, 'students', 'score = NULL');
const FILL8 = { tpl: 'SELECT name\nFROM students\nWHERE score [[0]];', blanks: [{ options: ['IS NULL', '= NULL', '<> NULL'], answer: 0 }] };
const FILL8_RES = checkFill(DB8, FILL8.tpl, FILL8.blanks);
const AGGS = query(DB8, 'SELECT COUNT(*), COUNT(score), SUM(score), AVG(score) FROM students').rows[0] as number[];
assert(new Set(AGGS.map(f2)).size === 4, 'aggregate values distinct');
const SUMDIV = AGGS[2] / AGGS[0];
const NOTIN = 'SELECT name\nFROM students\nWHERE score NOT IN (45, NULL);';
const NOTIN_N = query(DB8, NOTIN).rows.length;
const NOTIN_PLAIN = query(DB8, 'SELECT name FROM students WHERE score NOT IN (45)').rows.length;
const COAL = n1(query(DB8, 'SELECT AVG(COALESCE(score, 0)) FROM students'));
const BEN_CONDS = ['score IS NULL', 'score = NULL', 'NOT (score > 50)', "score > 50 OR city = 'York'", 'COALESCE(score, 0) < 50', 'score <> 72'];
const keepsBen = (c: string) => count(DB8, 'students', `student_id = 2 AND (${c})`) === 1;
const DIST = query(DB8, 'SELECT COUNT(city), COUNT(DISTINCT city) FROM students').rows[0] as number[];
const TV: [string, boolean | null][] = [['TRUE', true], ['FALSE', false], ['UNKNOWN', null]];
const tv = (v: boolean | null) => (v === null ? 'UNKNOWN' : v ? 'TRUE' : 'FALSE');
/** Smaller type for the truth tables, so three columns of UNKNOWN fit a phone. */
const small = (el: HTMLElement) => { el.querySelectorAll('table').forEach((t) => { t.style.fontSize = '.75rem'; }); return el; };

function scoresTable(rng: () => number): Table {
  const n = randInt(rng, 6, 8);
  const names = shuffle(rng, NAMES).slice(0, n);
  const rows: Val[][] = names.map((nm, k) => [k + 1, nm, pick(rng, CITIES.slice(0, 4)), rng() < 0.3 ? null : randInt(rng, 20, 95)]);
  if (!rows.some((r) => r[3] === null)) rows[randInt(rng, 0, n - 1)][3] = null;
  return table('students', ['student_id', 'name', 'city', 'score'], rows);
}

const genNotGreater: Generator = (rng) => {
  const t = scoresTable(rng);
  const db = mkdb(t);
  const k = randInt(rng, 40, 75);
  const sql = `SELECT name\nFROM students\nWHERE NOT (score > ${k});`;
  const r = col0(query(db, sql));
  const nulls = t.rows.filter((x) => x[3] === null).length;
  return {
    kind: 'number',
    body: `How many rows does \`WHERE NOT (score > ${k})\` return here?`,
    widget: () => tablesSql([t], sql),
    answer: r.length, tol: 0,
    hint: 'For a NULL score, `score > k` is unknown, and NOT unknown is still unknown.',
    explain: `Scores of ${k} or less: ${list(r)} (${r.length}). The ${s(nulls, 'row')} with a NULL score are in neither \`score > ${k}\` nor its NOT.`,
  };
};

const genCountVariant: Generator = (rng) => {
  const t = scoresTable(rng);
  const db = mkdb(t);
  const e = pick(rng, ['COUNT(*)', 'COUNT(score)', 'AVG(score)', 'SUM(score)']);
  const sql = `SELECT ${e}\nFROM students;`;
  const v = n1(query(db, sql));
  const known = t.rows.filter((x) => x[3] !== null).length;
  return {
    kind: 'number',
    body: `What does \`${e}\` return for these ${t.rows.length} students?${e.startsWith('AVG') ? ' (Round to 2 decimals if needed.)' : ''}`,
    widget: () => tablesSql([t], sql),
    answer: v, tol: 0.01,
    hint: 'COUNT(*) counts rows. COUNT(score), SUM and AVG skip NULLs.',
    explain: e === 'COUNT(*)' ? `Every row counts, NULL or not: ${v}.` : e === 'COUNT(score)' ? `Only non-NULL scores: ${v} of ${t.rows.length} rows.` : e.startsWith('AVG') ? `AVG ignores NULLs: the sum of the ${known} known scores divided by ${known} = ${f2(v)}.` : `SUM skips NULLs: the ${known} known scores add to ${v}.`,
  };
};

const genDistinct: Generator = (rng) => {
  const t = scoresTable(rng);
  const db = mkdb(t);
  const e = pick(rng, ['COUNT(DISTINCT city)', 'COUNT(city)']);
  const sql = `SELECT ${e}\nFROM students;`;
  const v = n1(query(db, sql));
  return {
    kind: 'number',
    body: `What does \`${e}\` return for these ${t.rows.length} students?`,
    widget: () => tablesSql([t], sql),
    answer: v, tol: 0,
    hint: e.includes('DISTINCT') ? 'Count each different city once.' : 'Count every non-NULL city value, repeats included.',
    explain: e.includes('DISTINCT') ? `Different cities: ${list(col0(query(db, 'SELECT DISTINCT city FROM students')))}: ${v}.` : `Every row has a city, repeats and all: ${v}.`,
  };
};

const L8: Step[] = [
  {
    kind: 'choice',
    body: `\`WHERE score >= 50\` finds ${PASS} students and \`WHERE score < 50\` finds ${FAIL}. But the table has ${N8} rows. Where are the others?`,
    widget: () => showTable(STU),
    options: [
      { text: 'Their score is NULL, so both conditions are unknown, not true', correct: true },
      { text: 'They scored exactly 50', why: 'A 50 passes `>= 50`. Look at which rows have no score at all.' },
      { text: 'The query has a bug; the counts must add up', why: 'The queries are fine. SQL treats a missing value as unknown, and WHERE keeps only rows where the test is true.' },
    ],
    explain: `${N8 - PASS - FAIL} students have no score (NULL). Is an unknown score at least 50? Unknown. So they are in neither result.`,
  },
  {
    kind: 'read', title: 'NULL means unknown',
    body: 'NULL isn’t zero or empty text: it means *missing or unknown*. Any comparison with it, even `NULL = NULL`, is **UNKNOWN**. Logic gets a third value, and WHERE keeps a row only when the result is TRUE. The tables below are computed by the course’s SQL engine.',
    widget: () => small(h('div', null,
      grid(['AND', ...TV.map(([n]) => n)], TV.map(([an, a]) => [an, ...TV.map(([, b]) => tv(and3(a, b)))])),
      grid(['OR', ...TV.map(([n]) => n)], TV.map(([an, a]) => [an, ...TV.map(([, b]) => tv(or3(a, b)))])),
      grid(['a', 'NOT a'], TV.map(([an, a]) => [an, tv(not3(a))])))),
  },
  {
    kind: 'number',
    body: 'How many rows does `SELECT name FROM students WHERE score = NULL` return?',
    widget: () => showTable(STU),
    answer: EQNULL, tol: 0,
    hint: 'What is `NULL = NULL`?',
    explain: `${EQNULL}. Comparing anything with NULL gives UNKNOWN, never TRUE, so no row passes.`,
  },
  {
    kind: 'fill', code: true,
    body: 'Complete it to list the students who have **no score**.',
    template: FILL8.tpl, blanks: FILL8.blanks,
    explain: `\`IS NULL\` is the test for missing values: ${list(col0(FILL8_RES))}. \`= NULL\` and \`<> NULL\` are UNKNOWN for every row.`,
  },
  {
    kind: 'match',
    body: 'Match each expression to what it returns on the students table.',
    widget: () => showTable(STU),
    heads: ['Expression', 'Value'],
    pairs: [['`COUNT(*)`', f2(AGGS[0])], ['`COUNT(score)`', f2(AGGS[1])], ['`SUM(score)`', f2(AGGS[2])], ['`AVG(score)`', f2(AGGS[3])]],
    hint: 'COUNT(*) counts rows. The others skip NULLs.',
    explain: `${AGGS[0]} rows, ${AGGS[1]} known scores adding to ${AGGS[2]}, average ${AGGS[2]} / ${AGGS[1]} = ${f2(AGGS[3])}. Aggregates over a column ignore NULLs; COUNT(*) counts rows.`,
  },
  {
    kind: 'choice',
    body: `A teacher takes SUM(score) and divides it by the number of students, COUNT(*), getting ${f2(SUMDIV)}. AVG(score) gives ${f2(AGGS[3])}. Which is the average of the students who sat the test?`,
    options: [
      { text: `${f2(AGGS[3])}, from AVG(score)`, correct: true },
      { text: `${f2(SUMDIV)}, from SUM divided by the row count`, why: `Dividing by all ${N8} rows counts the ${N8 - AGGS[1]} missing scores as if they were 0.` },
      { text: 'They should be equal', why: 'They are equal only when nothing is NULL: COUNT(*) counts rows, AVG divides by non-NULL values.' },
    ],
    explain: 'Decide what a missing value means. Absent? Leave it out (AVG). Scored zero? Then store 0, not NULL.',
  },
  {
    kind: 'number',
    body: 'How many rows does this return?',
    widget: () => tablesSql([STU], NOTIN),
    answer: NOTIN_N, tol: 0,
    hint: '`score NOT IN (45, NULL)` means `score <> 45 AND score <> NULL`.',
    explain: `${NOTIN_N}. \`score <> NULL\` is UNKNOWN for every row, and TRUE AND UNKNOWN is UNKNOWN. Without the NULL in the list it returns ${NOTIN_PLAIN}. This bites with \`NOT IN (SELECT …)\` when the subquery returns a NULL.`,
  },
  {
    kind: 'read', title: 'Replacing NULL on purpose',
    body: '`COALESCE(score, 0)` returns the score, or 0 when it is NULL. Useful for display, but it changes the meaning: `AVG(COALESCE(score, 0))` treats missing as zero.',
  },
  {
    kind: 'number',
    body: 'What does `SELECT AVG(COALESCE(score, 0)) FROM students` return? (Round to 2 decimals.)',
    widget: () => showTable(STU),
    answer: COAL, tol: 0.01,
    hint: 'Every row now has a number; the missing ones count as 0.',
    explain: `${AGGS[2]} / ${N8} = ${f2(COAL)}, the same as dividing SUM by the row count, and lower than AVG(score) = ${f2(AGGS[3])}.`,
  },
  {
    kind: 'multi',
    body: 'Ben (York) has a NULL score. Which WHERE conditions **keep** Ben’s row?',
    options: BEN_CONDS.map((c) => keepsBen(c) ? { text: `\`${c}\``, correct: true }
      : { text: `\`${c}\``, why: 'With a NULL score this is UNKNOWN, and WHERE drops anything that isn’t TRUE.' }),
    hint: 'Work out TRUE, FALSE or UNKNOWN for each. OR is TRUE if either side is TRUE.',
    explain: `Kept: ${BEN_CONDS.filter(keepsBen).join('; ')}. IS NULL tests for missing; an OR with a TRUE side is TRUE; COALESCE turns the NULL into 0 first.`,
  },
  {
    kind: 'number',
    body: `\`SELECT COUNT(city) FROM students\` returns ${DIST[0]}. What does \`SELECT COUNT(DISTINCT city) FROM students\` return?`,
    widget: () => showTable(STU),
    answer: DIST[1], tol: 0,
    hint: 'Count each different city once.',
    explain: `${list(col0(query(DB8, 'SELECT DISTINCT city FROM students')))}: ${DIST[1]}. COUNT(col) counts values, repeats included; DISTINCT removes repeats. Ask which one the question means: "how many students have a city" or "how many cities".`,
  },
];

// ================================================================ course

export const databases: Course = {
  id: 'databases',
  title: 'Databases',
  blurb: 'Tables, keys and SQL: ask precise questions of data, design tables that stay correct, and see why indexes and transactions matter.',
  color: '#b8475e',
  icon: '🗄️',
  lessons: [
    { id: 'tables', title: 'Tables, rows and keys', goal: 'Say what a primary key is for and pick a good one.', steps: L1, practice: [genUniqueCols, genRejected, genComposite] },
    { id: 'select', title: 'Asking questions with SQL', goal: 'Predict what SELECT, WHERE, ORDER BY and LIMIT return.', steps: L2, practice: [genWhereCount, genOrderLimit, genPrecedence] },
    { id: 'grouping', title: 'Grouping and counting', goal: 'Summarise groups with GROUP BY, aggregates and HAVING.', steps: L3, practice: [genGroupSum, genHavingRows, genGroupAvg] },
    { id: 'joins', title: 'Joins', goal: 'Match rows across tables and predict when rows multiply or vanish.', steps: L4, practice: [genJoinCount, genNoOrders, genFanout] },
    { id: 'design', title: 'Designing tables', goal: 'Spot duplication and split data into related tables.', steps: L5, practice: [genEdits, genSplitRows, genLinkRows] },
    { id: 'indexes', title: 'Indexes', goal: 'Count rows examined with and without an index, and weigh the cost.', steps: L6, practice: [genScanIndex, genProbes, genWriteCost] },
    { id: 'transactions', title: 'Transactions', goal: 'See why changes must be all-or-nothing and how updates get lost.', steps: L7, practice: [genCrash, genSchedule, genLost] },
    { id: 'nulls', title: 'NULL and other traps', goal: 'Reason with unknown values, COUNT variants and duplicates.', steps: L8, practice: [genNotGreater, genCountVariant, genDistinct] },
  ],
};
