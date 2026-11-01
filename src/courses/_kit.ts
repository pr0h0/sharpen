// QA-only course: every exercise type and visualization once. Not registered in CATEGORIES;
// tools/play_course.sh _kit and the #/lesson/_kit/... route find it through KIT in index.ts.
import type { Course } from '../types';
import { randInt } from '../ui';
import { barChart, columnChart, dataTable, donut, iconArray, stackBar } from '../viz/charts';
import { plotExplorer, stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import { arrayBars, cellGrid, cells, codeBlock, codeTrace, network } from '../viz/cs';
import { h } from '../ui';

export const kit: Course = {
  id: '_kit', title: 'Kit', blurb: 'QA', color: '#4f8cff', icon: '🧪',
  lessons: [{
    id: 'all', title: 'Every type', goal: 'QA',
    steps: [
      { kind: 'read', title: 'Charts', widget: () => h('div', null,
        barChart([{ label: 'Apples', value: 12 }, { label: 'Pears', value: 7 }, { label: 'Figs', value: 3 }]),
        columnChart([{ label: 'Mon', value: 3 }, { label: 'Tue', value: 5 }, { label: 'Wed', value: 2 }]),
        stackBar([{ label: 'Yes', value: 60 }, { label: 'No', value: 40 }]),
        donut([{ label: 'A', value: 1 }, { label: 'B', value: 3 }], { center: '4' }),
        dataTable(['Group', 'n', 'Rate'], [['A', 100, '12%'], ['B', 80, '9%']], { highlight: [1] }),
        iconArray(100, 7)) },
      { kind: 'read', title: 'Plot', widget: () => plotEl({ x: [-4, 4], y: [-2, 10], layers: [
        { type: 'fn', f: (x) => x * x, label: 'x²' }, { type: 'fn', f: (x) => 2 * x + 1, dash: true, label: '2x+1' },
        { type: 'area', f: (x) => x * x, from: 0, to: 2 }, { type: 'dots', pts: [[1, 3], [-1, 1]], labels: ['A', 'B'] },
        { type: 'vline', x: 2, label: 'x=2' }, { type: 'arrow', from: [-3, 8], to: [-1, 5], label: 'v' }] }) },
      { kind: 'read', title: 'Geometry', widget: () => plotEl({ x: [0, 6], y: [0, 4], equal: true, grid: true, layers: [
        { type: 'line', pts: [[1, 1], [5, 1], [5, 4]], closed: true, fill: 'color-mix(in srgb, var(--c3) 25%, transparent)', color: 'var(--c3)' },
        { type: 'text', x: 3, y: 0.6, text: '4' }, { type: 'text', x: 5.4, y: 2.5, text: '3' }] }) },
      { kind: 'task', title: 'Explorer', body: 'Make the line pass through (2, 5).', explain: 'm·2 + b = 5.',
        widget: plotExplorer({ params: [{ id: 'm', label: 'slope m', min: -3, max: 3, step: 0.5, value: 0 }, { id: 'b', label: 'intercept b', min: -5, max: 5, step: 1, value: 0 }],
          spec: (v) => ({ x: [-5, 5], y: [-6, 8], layers: [{ type: 'fn', f: (x) => v.m * x + v.b }, { type: 'dots', pts: [[2, 5]], color: 'var(--c2)' }] }),
          readout: (v) => `y = ${v.m}x + ${v.b}`, goal: (v) => v.m * 2 + v.b === 5 }) },
      { kind: 'read', title: 'Trace', widget: () => codeTrace('total = 0\nfor i in range(3):\n    total = total + i\nprint(total)', [
        { line: 1, vars: { total: 0 } }, { line: 2, vars: { total: 0, i: 0 } }, { line: 3, vars: { total: 0, i: 0 } },
        { line: 2, vars: { total: 0, i: 1 } }, { line: 3, vars: { total: 1, i: 1 } }, { line: 2, vars: { total: 1, i: 2 } },
        { line: 3, vars: { total: 3, i: 2 } }, { line: 4, vars: { total: 3, i: 2 }, out: ['3'] }]) },
      { kind: 'read', title: 'Algorithms', widget: () => h('div', null,
        stepper(3, (i) => arrayBars([5, 2, 8, 1].map((v, k) => (i > 0 && k < 2 ? [2, 5][k] : v)), { hi: [i, i + 1] }), { caption: (i) => `step ${i}` }),
        cells([1, 3, 5, 7, 9], { hi: [2], dim: [0, 1], pointer: { lo: 2, hi: 4 } }),
        network([{ id: 'A', x: 10, y: 30 }, { id: 'B', x: 50, y: 10 }, { id: 'C', x: 50, y: 50 }, { id: 'D', x: 90, y: 30 }],
          [{ a: 'A', b: 'B', w: 4 }, { a: 'A', b: 'C', w: 2 }, { a: 'B', b: 'D', w: 1, directed: true }, { a: 'C', b: 'D', w: 7 }], { hiEdges: ['A-C'], hiNodes: ['A'], nodeText: { A: '0' } }),
        cellGrid(4, 6, (r, c) => ({ fill: (r + c) % 3 === 0 ? 'var(--c1)' : undefined, text: r === 0 && c === 0 ? 'S' : '' }))) },
      { kind: 'read', title: 'Code', widget: () => codeBlock('def f(x):\n    # double it\n    return 2 * x\nprint(f("hi"))', { active: 3 }) },
      { kind: 'multi', body: 'Which are prime?', options: [{ text: '2', correct: true }, { text: '9', why: '9 = 3 × 3.' }, { text: '11', correct: true }, { text: '15', why: '15 = 3 × 5.' }], explain: '2 and 11.' },
      { kind: 'match', body: 'Match each function to its shape.', heads: ['Function', 'Shape'], pairs: [['y = 2x', 'straight line'], ['y = x²', 'parabola'], ['y = 2ˣ', 'exponential curve']], explain: 'Linear, quadratic, exponential.' },
      { kind: 'sort', body: 'Sort into even and odd.', bins: ['Even', 'Odd'], items: [{ text: '4', bin: 0 }, { text: '7', bin: 1 }, { text: '10', bin: 0 }, { text: '13', bin: 1 }], explain: 'Even numbers divide by 2.' },
      { kind: 'fill', body: 'Complete the loop so it prints 0, 1, 2.', code: true, template: 'for i in [[0]](3):\n    [[1]](i)', blanks: [{ options: ['range', 'len', 'list'], answer: 0 }, { options: ['print', 'return', 'input'], answer: 0 }], explain: '`range(3)` gives 0, 1, 2.' },
      { kind: 'fill', body: 'Balance it.', template: '3x + [[0]] = 11 so x = [[1]]', blanks: [{ options: ['2', '5', '8'], answer: 1 }, { options: ['1', '2', '3'], answer: 1 }], explain: '3·2 + 5 = 11.' },
      { kind: 'point', body: 'Place the point (2, 3).', plot: { x: [-5, 5], y: [-5, 5] }, answer: { x: 2, y: 3 }, tol: 0.3, snap: 0.5, explain: 'Right 2, up 3.' },
      { kind: 'point', body: 'Where is 3/4 on the number line?', plot: { x: [0, 1], ticks: [0.25] }, answer: { x: 0.75 }, tol: 0.03, explain: 'Three quarters of the way.' },
    ],
    practice: [(rng) => { const a = randInt(rng, 1, 9); return { kind: 'point', body: `Place ${a}.`, plot: { x: [0, 10] }, answer: { x: a }, tol: 0.3, snap: 0.5, explain: 'x.' }; }],
  }],
};
