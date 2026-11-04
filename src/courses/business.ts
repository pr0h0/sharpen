// Business by the Numbers: profit and cost structure, margins, break-even and operating leverage,
// unit economics, pricing and discounts, cash flow, churn, and valuation. Worked from small,
// hypothetical businesses (a café, a shop, a subscription app); every figure is computed from the
// formulas in widgets/business.ts.
import type { Course, Generator, Lesson, SortStep } from '../types';
import { h, pick, randInt } from '../ui';
import { barChart, dataTable, stackBar } from '../viz/charts';
import { explorer, plotExplorer, stepper } from '../viz/explore';
import { plotEl } from '../viz/plot';
import {
  breakEven, cashPath, cashSim, cohortTable, costSpec, count, customersAt, discountVolume, dollars, leverage, lifetime, ltv,
  margin, marginFromMarkup, markup, markupFromMargin, money, note, payback, pc, perpetuity, pnl, profit, pv, retained, riseVolume, row,
} from '../widgets/business';

const COLOR = '#5b6b8c';
const num2 = (v: number) => String(+v.toFixed(2));

/** Distinct "wrong" values: drops any that collide with the answer or each other once formatted. */
function others(fmt: (v: number) => string, right: number, cands: { v: number; why: string }[]) {
  const seen = new Set([fmt(right)]);
  return cands.filter((c) => Number.isFinite(c.v) && !seen.has(fmt(c.v)) && seen.add(fmt(c.v))).map((c) => ({ text: fmt(c.v), why: c.why }));
}

// ================================================================ lesson 1: revenue, cost and profit

// The café used through the course: $4 a coffee, $1.50 of beans, milk and cup, $6,000 a month fixed.
const CAFE = { p: 4, v: 1.5, F: 6000 };
const Q1 = 3000;
const P1 = profit(CAFE.p, CAFE.v, CAFE.F, Q1);
const AVG2000 = (CAFE.F + CAFE.v * 2000) / 2000;
const AVG3000 = (CAFE.F + CAFE.v * Q1) / Q1;
const ORDER = { n: 500, price: 2.5 };
const RENT_UP = 1500;
const PRICE_FIX = CAFE.v + (CAFE.F + RENT_UP + P1) / Q1;

const genProfit: Generator = (rng) => {
  const p = randInt(rng, 6, 14) / 2, v = randInt(rng, 2, 2 * p - 2) / 4, F = randInt(rng, 4, 20) * 500, q = randInt(rng, 10, 60) * 100;
  const pr = profit(p, v, F, q);
  const biz = pick(rng, ['A bakery sells loaves', 'A juice bar sells smoothies', 'A food truck sells tacos', 'A print shop sells posters']);
  return {
    kind: 'number', unit: '$',
    body: `${biz} at **${money(p)}** each. Each one costs **${money(v)}** in ingredients and packaging, and rent, wages and insurance come to **${money(F)} a month**. This month it sells **${count(q)}**. What is its profit? (Negative if it loses money.)`,
    answer: pr, tol: 0.5,
    hint: 'Each sale adds price minus variable cost; then take off the fixed costs once.',
    explain: `(${money(p)} − ${money(v)}) × ${count(q)} = ${money((p - v) * q)} of contribution, minus ${money(F)} fixed = **${money(pr)}**.`,
  };
};

const genAvgCost: Generator = (rng) => {
  const v = randInt(rng, 2, 12) / 4, F = randInt(rng, 4, 16) * 500, q = randInt(rng, 2, 10) * 500;
  const avg = (F + v * q) / q;
  return {
    kind: 'number', unit: '$',
    body: `A sandwich shop pays **${money(F)} a month** in fixed costs, and each sandwich uses **${money(v)}** of ingredients. If it makes **${count(q)}** sandwiches a month, what is its average cost per sandwich?`,
    answer: avg, tol: 0.01,
    hint: 'Total cost (fixed plus all the variable costs) divided by the number made.',
    explain: `(${money(F)} + ${money(v)} × ${count(q)}) ÷ ${count(q)} = ${money(F)} ÷ ${count(q)} + ${money(v)} = **${money(avg)}**. The fixed part shrinks per unit as volume grows.`,
  };
};

const genSpecialOrder: Generator = (rng) => {
  const p = randInt(rng, 8, 12) / 2, v = randInt(rng, 4, 10) / 4, F = randInt(rng, 8, 16) * 500, q = randInt(rng, 20, 40) * 100;
  const avg = (F + v * q) / q;
  const below = rng() < 0.35;
  const offer = below ? Math.max(0.25, v - randInt(rng, 1, 3) / 4) : Math.min(avg - 0.25, v + randInt(rng, 1, 4) / 4);
  const n = randInt(rng, 2, 8) * 100;
  const change = n * (offer - v);
  const accept = change > 0;
  return {
    kind: 'choice',
    body: `A café sells coffee at **${money(p)}**; each cup costs **${money(v)}** in beans, milk and cup, and fixed costs are **${money(F)} a month**. At its usual **${count(q)}** cups the average cost is ${money(avg)} a cup. An office offers to buy **${n} extra cups** this month at **${money(offer)}** each. The café has spare capacity and fixed costs won't change. Should it accept?`,
    options: [
      { text: `Accept: profit rises by ${money(Math.abs(change))}`, correct: accept, why: accept ? undefined : `Each extra cup brings ${money(offer)} but costs ${money(v)} to make, so ${n} cups change profit by ${money(change)}.` },
      { text: `Decline: profit falls by ${money(Math.abs(n * (offer - avg)))}`, correct: false, why: `That uses the ${money(avg)} average cost, which includes rent and wages. Those are paid anyway; only the ${money(v)} per cup is extra.` },
      { text: `Decline: each extra cup costs ${money(v)} to make, more than the ${money(offer)} offered`, correct: !accept, why: accept ? `${money(offer)} is more than the ${money(v)} each extra cup costs, so each one adds ${money(offer - v)}.` : undefined },
    ],
    hint: 'Which costs actually change if the café makes these extra cups?',
    explain: `Only variable costs change: ${n} × (${money(offer)} − ${money(v)}) = **${money(change)}**. Fixed costs are already paid, so the average cost is the wrong yardstick for a one-off extra order.`,
  };
};

const lessonProfit: Lesson = {
  id: 'profit',
  title: 'Revenue, cost and profit',
  goal: 'Split costs into fixed and variable, and work out profit at any volume.',
  steps: [
    {
      kind: 'choice',
      body: `A small café sells coffee at **${money(CAFE.p)}** a cup. Each cup uses **${money(CAFE.v)}** of beans, milk and a paper cup. Rent, wages and insurance come to **${money(CAFE.F)} a month** however many cups it sells.\n\nThis month it sold **${count(Q1)} cups**. What was its profit?`,
      options: [
        { text: money(P1), correct: true },
        ...others(money, P1, [
          { v: CAFE.p * Q1 - CAFE.F, why: `That takes off the rent and wages but forgets the ${money(CAFE.v)} of ingredients in every cup.` },
          { v: (CAFE.p - CAFE.v) * Q1, why: 'That is what the cups earn above their ingredients, before paying rent and wages. The fixed costs still have to come out.' },
          { v: CAFE.p * Q1, why: 'That is revenue: everything customers paid. Profit is what is left after the costs.' },
        ]),
      ],
      hint: 'Revenue first (price × cups), then take off both kinds of cost.',
      explain: `Revenue ${money(CAFE.p)} × ${count(Q1)} = ${money(CAFE.p * Q1)}. Costs: ${money(CAFE.F)} fixed + ${money(CAFE.v)} × ${count(Q1)} = ${money(CAFE.F + CAFE.v * Q1)}. Profit **${money(P1)}**.`,
    },
    {
      kind: 'read',
      title: 'Two kinds of cost',
      body: `**Fixed costs** are paid whatever you sell: rent, salaries, insurance. **Variable costs** come with each unit: beans, milk, cups.\n\n**Profit = revenue − fixed costs − variable costs.** The café's month:`,
      widget: () => pnl(`${count(Q1)} cups`, [[`Revenue (${count(Q1)} × ${money(CAFE.p)})`, CAFE.p * Q1], [`Ingredients (${count(Q1)} × ${money(CAFE.v)})`, -CAFE.v * Q1], ['Rent, wages, insurance', -CAFE.F]]),
    },
    {
      kind: 'sort',
      body: 'Sort the café\'s costs: does the cost rise when it sells one more coffee?',
      bins: ['Fixed (paid anyway)', 'Variable (per cup)'],
      items: [
        { text: 'Rent', bin: 0 }, { text: 'Coffee beans', bin: 1 }, { text: 'Paper cups and lids', bin: 1 }, { text: 'Insurance', bin: 0 },
        { text: 'Card fee on each sale', bin: 1 }, { text: 'Manager\'s salary', bin: 0 }, { text: 'Milk', bin: 1 }, { text: 'Till software subscription', bin: 0 },
      ],
      hint: 'Imagine selling one extra coffee today. Which bills go up?',
      explain: 'Beans, milk, cups and the card fee grow with each sale. Rent, insurance, a salary and a subscription are the same whether the café sells 100 cups or 5,000.',
    },
    {
      kind: 'read',
      title: 'Profit depends on volume',
      body: 'Slide the number of cups. Revenue starts at zero; total cost starts at the fixed costs. Profit is the gap between the lines.',
      widget: plotExplorer({
        params: [{ id: 'q', label: 'cups a month', min: 0, max: 5000, step: 100, value: 1000, format: count }],
        spec: (v) => costSpec(CAFE.p, CAFE.v, CAFE.F, 5000, [
          { type: 'vline', x: v.q, color: 'var(--text)', dash: false },
          { type: 'dots', pts: [[v.q, CAFE.p * v.q], [v.q, CAFE.F + CAFE.v * v.q]], color: 'var(--text)' },
        ], { unit: 'cups', mark: false }),
        readout: (v) => `${count(v.q)} cups: revenue ${money(CAFE.p * v.q)}, cost ${money(CAFE.F + CAFE.v * v.q)}, profit ${money(profit(CAFE.p, CAFE.v, CAFE.F, v.q))}`,
      }),
    },
    {
      kind: 'number', unit: '$',
      body: 'In a slow month the café sells only **2,000 cups**. What is its **average cost per cup** (all costs divided by cups)?',
      answer: AVG2000, tol: 0.01,
      hint: 'Total cost: the fixed costs plus 2,000 × the ingredients. Then divide by 2,000.',
      explain: `(${money(CAFE.F)} + ${money(CAFE.v * 2000)}) ÷ 2,000 = **${money(AVG2000)}** a cup, more than the ${money(CAFE.p)} price. At ${count(Q1)} cups it is ${money(AVG3000)}.`,
    },
    {
      kind: 'choice',
      body: `The average cost per cup is ${money(AVG2000)} at 2,000 cups and ${money(AVG3000)} at ${count(Q1)}. Why does it fall?`,
      options: [
        { text: 'The fixed costs are spread over more cups', correct: true },
        { text: 'Each cup\'s ingredients get cheaper', why: `In this model every cup still uses ${money(CAFE.v)} of ingredients. Bulk discounts can help in real life, but they aren't what is happening here.` },
        { text: 'The café raises its price', why: 'The price stays at $4. Average cost is about costs, not price.' },
      ],
      explain: `Average cost = fixed ÷ cups + variable. ${money(CAFE.F)} ÷ 2,000 = ${money(CAFE.F / 2000)} a cup; ÷ ${count(Q1)} = ${money(CAFE.F / Q1)}. The ${money(CAFE.v)} per cup never changes.`,
    },
    {
      kind: 'number', unit: '$',
      body: 'Each extra coffee sold adds how much to the café\'s profit?',
      answer: CAFE.p - CAFE.v, tol: 0.01,
      hint: 'Selling one more cup brings in the price and costs only its ingredients.',
      explain: `${money(CAFE.p)} − ${money(CAFE.v)} = **${money(CAFE.p - CAFE.v)}**. This is the **contribution** per unit: what each sale contributes towards the fixed costs, and then to profit.`,
    },
    {
      kind: 'choice',
      title: 'An extra order',
      body: `An office asks for **${ORDER.n} extra coffees** this month at **${money(ORDER.price)}** each. That's below the café's average cost of ${money(AVG3000)}. It has spare capacity, and rent and wages won't change. What does the order do to profit?`,
      options: [
        { text: `Adds ${money(ORDER.n * (ORDER.price - CAFE.v))}`, correct: true },
        { text: `Loses ${money(ORDER.n * (AVG3000 - ORDER.price))}`, why: `That compares the price with the ${money(AVG3000)} average cost, which includes rent and wages already paid. Only the ${money(CAFE.v)} of ingredients is extra.` },
        { text: `Adds ${money(ORDER.n * ORDER.price)}`, why: 'That is the extra revenue. The ingredients for those cups still cost money.' },
      ],
      hint: 'Which costs go up because of these cups?',
      explain: `Each cup brings ${money(ORDER.price)} and costs ${money(CAFE.v)} extra: ${ORDER.n} × ${money(ORDER.price - CAFE.v)} = **${money(ORDER.n * (ORDER.price - CAFE.v))}** more profit. (Just don't let it undercut the regular customers paying ${money(CAFE.p)}.)`,
    },
    {
      kind: 'choice',
      body: `Sales double, from ${count(Q1)} to ${count(2 * Q1)} cups a month. What happens to profit?`,
      options: [
        { text: `It grows ${profit(CAFE.p, CAFE.v, CAFE.F, 2 * Q1) / P1}-fold`, correct: true },
        { text: 'It doubles', why: `It would only double if every cost doubled too. The ${money(CAFE.F)} of fixed costs stays put, so all the extra contribution is profit.` },
        { text: 'It less than doubles', why: 'That would need costs to grow faster than sales. Here the variable costs grow in step with sales and fixed costs don\'t grow at all.' },
      ],
      hint: `Work out profit at ${count(2 * Q1)} cups.`,
      explain: `At ${count(2 * Q1)} cups: ${money(CAFE.p - CAFE.v)} × ${count(2 * Q1)} − ${money(CAFE.F)} = **${money(profit(CAFE.p, CAFE.v, CAFE.F, 2 * Q1))}**, against ${money(P1)}. Fixed costs make profit swing harder than sales; lesson 3 calls this operating leverage.`,
    },
    {
      kind: 'task',
      title: 'Rent goes up',
      body: `The landlord raises the rent by **${money(RENT_UP)} a month**. Find the coffee price that brings the profit at ${count(Q1)} cups back to **${money(P1)}**.`,
      widget: explorer({
        params: [{ id: 'p', label: 'price', min: 3, max: 6, step: 0.25, value: 4, format: money }],
        draw: (v) => pnl(`${count(Q1)} cups at ${money(v.p)}`, [['Revenue', v.p * Q1], ['Ingredients', -CAFE.v * Q1], ['Rent, wages, insurance', -(CAFE.F + RENT_UP)]]),
        goal: (v) => Math.abs(profit(v.p, CAFE.v, CAFE.F + RENT_UP, Q1) - P1) < 1e-6,
        goalText: `Back to ${money(P1)} a month.`,
      }),
      hint: `The extra ${money(RENT_UP)} has to be spread over ${count(Q1)} cups.`,
      explain: `${money(RENT_UP)} ÷ ${count(Q1)} cups = ${money(RENT_UP / Q1)} more per cup: **${money(PRICE_FIX)}**.`,
    },
    {
      kind: 'match',
      body: 'Match each term to its meaning.',
      heads: ['Term', 'Meaning'],
      pairs: [
        ['Revenue', 'Price × units sold'],
        ['Variable cost', 'Rises with every unit sold'],
        ['Fixed cost', 'Paid whatever you sell'],
        ['Contribution', 'Price minus variable cost, per unit'],
      ],
      explain: 'Revenue minus variable costs is total contribution; contribution minus fixed costs is profit.',
    },
    {
      kind: 'fill',
      body: 'Complete the formula.',
      template: 'Profit = ([[0]] − variable cost per unit) × units sold − [[1]]',
      blanks: [{ options: ['price', 'average cost', 'revenue'], answer: 0 }, { options: ['fixed costs', 'variable costs', 'revenue'], answer: 0 }],
      explain: `Each unit contributes price − variable cost; together they must first cover the fixed costs. Café: ${money(CAFE.p - CAFE.v)} × ${count(Q1)} − ${money(CAFE.F)} = ${money(P1)}.`,
    },
  ],
  practice: [genProfit, genAvgCost, genSpecialOrder],
};

// ================================================================ lesson 2: margins and markups

const MUG = { cost: 6, price: 10 };
const MUG_MARGIN = margin(MUG.cost, MUG.price), MUG_MARKUP = markup(MUG.cost, MUG.price);
const FIFTY = marginFromMarkup(0.5);
const TARGET = { cost: 20, m: 0.6 };
const TARGET_PRICE = TARGET.cost / (1 - TARGET.m);
const MARKUPS = [0.25, 0.5, 1, 3];
const SHOP = { rev: 200000, cogs: 120000, rent: 30000, wages: 36000, other: 6000 };
const SHOP_GROSS = SHOP.rev - SHOP.cogs, SHOP_OP = SHOP_GROSS - SHOP.rent - SHOP.wages - SHOP.other;
const TASK2 = { cost: 15, m: 0.4 };

const genMarginMarkup: Generator = (rng) => {
  const cost = randInt(rng, 2, 40), k = pick(rng, [0.25, 0.4, 0.5, 0.6, 0.75, 1, 1.5, 2, 3]);
  const price = cost * (1 + k);
  const askMargin = rng() < 0.5;
  const ans = (askMargin ? margin(cost, price) : markup(cost, price)) * 100;
  const item = pick(rng, ['a scarf', 'a lamp', 'a phone case', 'a candle', 'a backpack']);
  return {
    kind: 'number', unit: '%',
    body: `A shop buys ${item} for **${money(cost)}** and sells it for **${money(price)}**. What is its **${askMargin ? 'margin' : 'markup'}**?`,
    answer: ans, tol: 0.15,
    hint: askMargin ? 'Margin = profit ÷ price.' : 'Markup = profit ÷ cost.',
    explain: `Profit ${money(price - cost)}. ${askMargin ? `÷ price ${money(price)}` : `÷ cost ${money(cost)}`} = **${pc(ans / 100)}**. (The ${askMargin ? 'markup' : 'margin'} is ${pc(askMargin ? markup(cost, price) : margin(cost, price))}.)`,
  };
};

const genPriceForMargin: Generator = (rng) => {
  const cost = randInt(rng, 2, 30) * 2, m = pick(rng, [0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.8]);
  const price = cost / (1 - m);
  return {
    kind: 'number', unit: '$',
    body: `An item costs **${money(cost)}**. At what price does it earn a **${pc(m)} margin**?`,
    answer: price, tol: 0.01,
    hint: `The cost must be the other ${pc(1 - m)} of the price.`,
    explain: `Cost = ${pc(1 - m)} of the price, so price = ${money(cost)} ÷ ${1 - m} = **${money(price)}**. (Adding ${pc(m)} to the cost would give ${money(cost * (1 + m))}, only a ${pc(margin(cost, cost * (1 + m)))} margin.)`,
  };
};

const genConvert: Generator = (rng) => {
  const toMargin = rng() < 0.5;
  if (toMargin) {
    const k = pick(rng, [0.2, 0.25, 0.4, 0.5, 0.6, 0.8, 1, 1.5, 2, 3, 4]);
    const m = marginFromMarkup(k);
    return {
      kind: 'choice',
      body: `A wholesaler adds a **${pc(k)} markup** to everything. What margin does that give?`,
      options: [
        { text: pc(m), correct: true },
        ...others(pc, m, [
          { v: k, why: 'Markup is profit over cost; margin is profit over price. Since the price is bigger than the cost, the margin is always the smaller number.' },
          { v: 1 - m, why: 'That is the cost\'s share of the price, not the profit\'s.' },
          { v: k / 2, why: `Halving doesn't convert them. Margin = markup ÷ (1 + markup) = ${num2(k)} ÷ ${num2(1 + k)}.` },
        ]),
      ],
      hint: 'Take a cost of $100 and add the markup. What share of that price is profit?',
      explain: `Cost $100, price ${money(100 * (1 + k))}, profit ${money(100 * k)}: margin ${money(100 * k)} ÷ ${money(100 * (1 + k))} = **${pc(m)}**.`,
    };
  }
  const m = pick(rng, [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8]);
  const k = markupFromMargin(m);
  return {
    kind: 'choice',
    body: `A retailer wants a **${pc(m)} margin**. What markup on cost does it need?`,
    options: [
      { text: pc(k), correct: true },
      ...others(pc, k, [
        { v: m, why: `A ${pc(m)} markup gives only a ${pc(marginFromMarkup(m))} margin: markup is measured on the smaller number, the cost.` },
        { v: 1 - m, why: 'That is the cost\'s share of the price.' },
        { v: 2 * m, why: `Doubling doesn't convert them. Markup = margin ÷ (1 − margin) = ${num2(m)} ÷ ${num2(1 - m)}.` },
      ]),
    ],
    hint: 'Take a price of $100. What is the cost, and the profit as a share of that cost?',
    explain: `Price $100 with a ${pc(m)} margin: cost ${money(100 * (1 - m))}, profit ${money(100 * m)}. Markup ${money(100 * m)} ÷ ${money(100 * (1 - m))} = **${pc(k)}**.`,
  };
};


const lessonMargins: Lesson = {
  id: 'margins',
  title: 'Margins and markups',
  goal: 'Tell margin from markup, convert between them, and price for a target margin.',
  steps: [
    {
      kind: 'choice',
      body: `A gift shop buys a mug for **${money(MUG.cost)}** and sells it for **${money(MUG.price)}**. Its **margin** is the profit as a share of the selling price. What is it?`,
      options: [
        { text: pc(MUG_MARGIN), correct: true },
        { text: pc(MUG.cost / MUG.price), why: 'That is the cost\'s share of the price. The profit is the other part.' },
        { text: pc(MUG_MARKUP), why: `That is profit ÷ cost (${money(MUG.price - MUG.cost)} ÷ ${money(MUG.cost)}), the **markup**. Margin divides by the price.` },
        { text: pc(MUG.price / MUG.cost), why: 'That is price ÷ cost. Margin is about the profit part only.' },
      ],
      hint: `The profit is ${money(MUG.price - MUG.cost)}. Divide by the selling price.`,
      explain: `${money(MUG.price - MUG.cost)} ÷ ${money(MUG.price)} = **${pc(MUG_MARGIN)}**. Of every ${money(MUG.price)} a customer pays, ${money(MUG.price - MUG.cost)} is gross profit.`,
    },
    {
      kind: 'read',
      title: 'Same profit, two percentages',
      body: `The mug earns **${money(MUG.price - MUG.cost)}**. Said as a percentage, that depends on what you divide by:\n\n- **Margin** = profit ÷ price = ${money(MUG.price - MUG.cost)} ÷ ${money(MUG.price)} = ${pc(MUG_MARGIN)}\n- **Markup** = profit ÷ cost = ${money(MUG.price - MUG.cost)} ÷ ${money(MUG.cost)} = ${pc(MUG_MARKUP)}\n\nSame dollars, different base. Mixing them up is one of the commonest pricing mistakes.`,
      widget: () => stackBar([{ label: 'cost', value: MUG.cost, color: 'var(--c4)' }, { label: 'profit', value: MUG.price - MUG.cost, color: 'var(--c3)' }], { format: (v) => money(v) }),
    },
    {
      kind: 'number', unit: '%',
      body: `A bookshop buys a book for **$12** and sells it for **$18**. What is its **markup**?`,
      answer: markup(12, 18) * 100, tol: 0.15,
      hint: 'Profit ÷ cost.',
      explain: `$6 ÷ $12 = **${pc(markup(12, 18))}** markup. The margin is $6 ÷ $18 = ${pc(margin(12, 18))}.`,
    },
    {
      kind: 'choice',
      body: 'A boutique adds **50%** to the cost of everything it stocks, and the owner tells the bank it runs on a "50% margin". What is its margin really?',
      options: [
        { text: pc(FIFTY), correct: true },
        { text: '50%', why: 'That is the markup. The profit is half the cost, but the price is 1.5 times the cost, so profit is a smaller share of the price.' },
        { text: pc(1 / 1.5), why: 'That is the cost\'s share of the price (1 ÷ 1.5). The profit is the remaining third.' },
        { text: '25%', why: 'Too low: on a $100 cost the price is $150 and profit $50, a third of the price.' },
      ],
      hint: 'Try a cost of $100.',
      explain: `Cost $100, price $150, profit $50: $50 ÷ $150 = **${pc(FIFTY)}**. A 50% margin needs a 100% markup.`,
    },
    {
      kind: 'read',
      title: 'Converting',
      body: 'Margin = markup ÷ (1 + markup). Markup = margin ÷ (1 − margin). The gap widens fast: a margin can never reach 100% (that would need a free product), but a markup can be anything.',
      widget: () => dataTable(['Markup', 'Margin', 'Price for a $10 cost'],
        [0.1, 0.25, 0.5, 1, 2, 4].map((k) => [pc(k), pc(marginFromMarkup(k)), money(10 * (1 + k))]), { highlight: [3] }),
    },
    {
      kind: 'match',
      body: 'Match each markup to the margin it gives.',
      heads: ['Markup', 'Margin'],
      pairs: MARKUPS.map((k) => [pc(k), pc(marginFromMarkup(k))] as [string, string]),
      hint: 'Margin = markup ÷ (1 + markup).',
      explain: MARKUPS.map((k) => `${pc(k)} → ${num2(k)} ÷ ${num2(1 + k)} = ${pc(marginFromMarkup(k))}`).join('; ') + '.',
    },
    {
      kind: 'number', unit: '$',
      body: `A product costs **${money(TARGET.cost)}**. The owner wants a **${pc(TARGET.m)} margin**. What should it sell for?`,
      answer: TARGET_PRICE, tol: 0.01,
      hint: `If profit is ${pc(TARGET.m)} of the price, the cost is the other ${pc(1 - TARGET.m)}.`,
      explain: `Cost = ${pc(1 - TARGET.m)} of the price, so price = ${money(TARGET.cost)} ÷ ${1 - TARGET.m} = **${money(TARGET_PRICE)}**. Adding ${pc(TARGET.m)} to the cost (${money(TARGET.cost * (1 + TARGET.m))}) would give only a ${pc(margin(TARGET.cost, TARGET.cost * (1 + TARGET.m)))} margin.`,
    },
    {
      kind: 'task',
      title: 'Price it',
      body: `A lamp costs the shop **${money(TASK2.cost)}**. Find the price that gives a **${pc(TASK2.m)} margin**, and watch the markup as you go.`,
      widget: explorer({
        params: [{ id: 'p', label: 'price', min: 16, max: 40, step: 1, value: 18, format: money }],
        draw: (v) => stackBar([{ label: 'cost', value: TASK2.cost, color: 'var(--c4)' }, { label: 'profit', value: v.p - TASK2.cost, color: 'var(--c3)' }], { format: (x) => money(x) }),
        readout: (v) => `Margin ${pc(margin(TASK2.cost, v.p))} · markup ${pc(markup(TASK2.cost, v.p))}`,
        goal: (v) => Math.abs(margin(TASK2.cost, v.p) - TASK2.m) < 1e-9,
        goalText: `A ${pc(TASK2.m)} margin is a ${pc(markupFromMargin(TASK2.m))} markup.`,
      }),
      hint: `The cost should be ${pc(1 - TASK2.m)} of the price.`,
      explain: `${money(TASK2.cost)} ÷ ${1 - TASK2.m} = **${money(TASK2.cost / (1 - TASK2.m))}**: profit ${money(TASK2.cost / (1 - TASK2.m) - TASK2.cost)} is ${pc(TASK2.m)} of the price and ${pc(markupFromMargin(TASK2.m))} of the cost.`,
    },
    {
      kind: 'read',
      title: 'Gross margin vs operating margin',
      body: '**Gross margin** counts only the cost of the goods sold. **Operating margin** also takes off rent, wages and the rest. A shop with a healthy gross margin can still keep very little:',
      widget: () => row(
        pnl('Gross', [['Sales', SHOP.rev], ['Cost of goods', -SHOP.cogs]], 'Gross profit'),
        pnl('Operating', [['Gross profit', SHOP_GROSS], ['Rent', -SHOP.rent], ['Wages', -SHOP.wages], ['Other', -SHOP.other]], 'Operating profit')),
    },
    {
      kind: 'number', unit: '%',
      body: 'From the shop\'s figures above: what is its **operating margin** (operating profit as a share of sales)?',
      answer: (SHOP_OP / SHOP.rev) * 100, tol: 0.1,
      widget: () => pnl('The year', [['Sales', SHOP.rev], ['Cost of goods', -SHOP.cogs], ['Rent', -SHOP.rent], ['Wages', -SHOP.wages], ['Other', -SHOP.other]], 'Operating profit'),
      hint: 'Operating profit ÷ sales.',
      explain: `${money(SHOP_OP)} ÷ ${money(SHOP.rev)} = **${pc(SHOP_OP / SHOP.rev)}**, against a ${pc(SHOP_GROSS / SHOP.rev)} gross margin. Most of the gross profit goes on running the shop.`,
    },
    {
      kind: 'multi',
      body: 'Select every true statement.',
      options: [
        { text: 'For the same item, the markup is always bigger than the margin', correct: true },
        { text: 'A 100% markup means a 50% margin', correct: true },
        { text: 'A margin can be more than 100%', why: 'Margin is a share of the price, and profit can\'t exceed the whole price unless the cost is negative.' },
        { text: 'Adding 30% to cost gives a 30% margin', why: `It gives ${pc(marginFromMarkup(0.3))}: the 30% is measured on the cost, the margin on the bigger price.` },
        { text: 'A high gross margin guarantees a profit', why: 'Fixed costs come out of gross profit. The shop above had a ' + pc(SHOP_GROSS / SHOP.rev) + ' gross margin and kept ' + pc(SHOP_OP / SHOP.rev) + '.' },
      ],
      explain: 'Markup divides profit by the cost, margin by the price; the price is bigger, so the margin is smaller. And gross margin is only the first line: operating costs still have to be paid.',
    },
  ],
  practice: [genMarginMarkup, genPriceForMargin, genConvert],
};

// ================================================================ lesson 3: break-even and operating leverage

const BE1 = breakEven(CAFE.F, CAFE.p, CAFE.v);
const BAKERY = { p: 3, v: 1, F: 1800 };
const BE_BAKERY = breakEven(BAKERY.F, BAKERY.p, BAKERY.v);
const TARGET_PROFIT = 2000;
const KIOSK = { p: 4, v: 3, F: 1500 }; // same price; less fixed, more variable
const DOL_A = leverage(CAFE.p, CAFE.v, CAFE.F, Q1);
const PA = (q: number) => profit(CAFE.p, CAFE.v, CAFE.F, q), PB = (q: number) => profit(KIOSK.p, KIOSK.v, KIOSK.F, q);
const BE_GOAL = 2000;
const ORDER3 = [
  { name: 'Bike repair stand', p: 25, v: 10, F: 1800 },
  { name: 'Candle stall', p: 12, v: 4, F: 1200 },
  { name: 'Pizza van', p: 10, v: 4, F: 4800 },
  { name: 'Yoga studio (per class)', p: 15, v: 3, F: 7200 },
].map((b) => ({ ...b, be: breakEven(b.F, b.p, b.v) })).sort((a, b) => a.be - b.be);

const genBreakEven: Generator = (rng) => {
  const v = randInt(rng, 1, 12) / 2, c = randInt(rng, 2, 10) / 2, p = v + c;
  const F = c * randInt(rng, 4, 40) * 50;
  const be = breakEven(F, p, v);
  const thing = pick(rng, ['ice creams', 'haircuts', 'T-shirts', 'pies', 'car washes']);
  return {
    kind: 'number', unit: thing,
    body: `A business sells ${thing} at **${money(p)}**. Each costs **${money(v)}** to provide, and fixed costs are **${money(F)} a month**. How many must it sell each month to break even?`,
    answer: be, tol: 0.5,
    hint: 'Fixed costs ÷ contribution per unit.',
    explain: `Each sale contributes ${money(p)} − ${money(v)} = ${money(c)}. ${money(F)} ÷ ${money(c)} = **${count(be)}**.`,
  };
};

const genTargetProfit: Generator = (rng) => {
  const v = randInt(rng, 2, 8), c = randInt(rng, 2, 10), p = v + c;
  const F = c * randInt(rng, 10, 60) * 10, T = c * randInt(rng, 5, 40) * 10;
  const q = breakEven(F, p, v, T);
  return {
    kind: 'number', unit: 'units',
    body: `A workshop sells handmade boards at **${money(p)}**; materials are **${money(v)}** each and fixed costs **${money(F)} a month**. How many must it sell to make a profit of **${money(T)}** a month?`,
    answer: q, tol: 0.5,
    hint: 'The contribution has to cover the fixed costs and the target profit.',
    explain: `(${money(F)} + ${money(T)}) ÷ ${money(c)} per board = **${count(q)}** boards.`,
  };
};

const genLeverage: Generator = (rng) => {
  const v = randInt(rng, 1, 6), c = randInt(rng, 2, 8), p = v + c;
  const q = randInt(rng, 10, 40) * 100;
  const F = Math.round((c * q * randInt(rng, 40, 85)) / 100 / 100) * 100;
  const pr = profit(p, v, F, q), dol = leverage(p, v, F, q);
  const s = pick(rng, [5, 10, 20, -10, -5]);
  const ans = dol * s;
  return {
    kind: 'number', unit: '%',
    body: `A firm sells **${count(q)}** units a month at **${money(p)}**, variable cost **${money(v)}** each, fixed costs **${money(F)}**. Profit is ${money(pr)}. If sales volume ${s > 0 ? 'rises' : 'falls'} by **${Math.abs(s)}%**, by what percent does profit change? (Negative for a fall.)`,
    answer: ans, tol: 0.15,
    hint: 'Work out the profit at the new volume, or use contribution ÷ profit as the multiplier.',
    explain: `Contribution ${money(c * q)} ÷ profit ${money(pr)} = ${num2(dol)}: each 1% of volume moves profit ${num2(dol)}%. So ${s}% → **${num2(ans)}%** (profit becomes ${money(profit(p, v, F, q * (1 + s / 100)))}).`,
  };
};

const lessonBreakEven: Lesson = {
  id: 'break-even',
  title: 'Break-even and operating leverage',
  goal: 'Find the break-even volume and see why high fixed costs make profit swing.',
  steps: [
    {
      kind: 'choice',
      body: `Back to the café: coffee at **${money(CAFE.p)}**, ingredients **${money(CAFE.v)}** a cup, fixed costs **${money(CAFE.F)} a month**. How many cups a month does it need to sell to **break even** (profit exactly zero)?`,
      options: [
        { text: count(BE1), correct: true },
        ...others(count, BE1, [
          { v: CAFE.F / CAFE.p, why: `That divides by the price, as if each cup's ${money(CAFE.p)} all went to rent. ${money(CAFE.v)} of it pays for the cup's own ingredients.` },
          { v: CAFE.F / CAFE.v, why: 'That divides by the ingredient cost, which has nothing to do with covering rent. Divide by what each cup leaves over.' },
          { v: CAFE.F, why: 'That is one cup per dollar of fixed cost. Each cup leaves more than a dollar towards rent.' },
        ]),
      ],
      hint: 'Each cup leaves price − ingredients towards the fixed costs. How many of those cover the fixed costs?',
      explain: `Each cup contributes ${money(CAFE.p - CAFE.v)}. ${money(CAFE.F)} ÷ ${money(CAFE.p - CAFE.v)} = **${count(BE1)} cups**. Below that it loses money; above it every cup adds ${money(CAFE.p - CAFE.v)} of profit.`,
    },
    {
      kind: 'read',
      title: 'Break-even = fixed costs ÷ contribution',
      body: `Where the revenue line crosses the total-cost line, profit is zero. Left of it the café loses money, right of it it makes money.`,
      widget: () => h('div', null, plotEl(costSpec(CAFE.p, CAFE.v, CAFE.F, 5000, [{ type: 'text', x: BE1 + 120, y: 3000, text: `break-even ${count(BE1)}`, color: 'var(--c3)', anchor: 'start' }], { unit: 'cups' })),
        note(`${money(CAFE.F)} ÷ (${money(CAFE.p)} − ${money(CAFE.v)}) = ${count(BE1)} cups a month`)),
    },
    {
      kind: 'point',
      body: `A bakery sells loaves at **${money(BAKERY.p)}**; each costs **${money(BAKERY.v)}** in flour and energy; fixed costs are **${money(BAKERY.F)} a month**. Click its break-even point on the chart.`,
      plot: costSpec(BAKERY.p, BAKERY.v, BAKERY.F, 1500, [], { mark: false, unit: 'loaves' }),
      answer: { x: BE_BAKERY }, tol: 50, snap: 50,
      hint: 'Where the lines cross: fixed costs ÷ (price − cost per loaf).',
      explain: `${money(BAKERY.F)} ÷ ${money(BAKERY.p - BAKERY.v)} = **${count(BE_BAKERY)} loaves**, where revenue and cost both reach ${money(BE_BAKERY * BAKERY.p)}.`,
    },
    {
      kind: 'number', unit: '$',
      body: 'Break-even can also be stated in **sales dollars**. How much must the bakery sell in a month, in dollars, to break even?',
      answer: BE_BAKERY * BAKERY.p, tol: 1,
      hint: 'Break-even loaves × price. Or: fixed costs ÷ the share of each dollar of sales that is contribution.',
      explain: `${count(BE_BAKERY)} × ${money(BAKERY.p)} = **${money(BE_BAKERY * BAKERY.p)}**. Equivalently, ${pc((BAKERY.p - BAKERY.v) / BAKERY.p)} of each sales dollar is contribution, and ${money(BAKERY.F)} ÷ ${num2((BAKERY.p - BAKERY.v) / BAKERY.p)} gives the same.`,
    },
    {
      kind: 'number', unit: 'cups',
      body: `The café owner wants a profit of **${money(TARGET_PROFIT)} a month**. How many cups a month does that take?`,
      answer: breakEven(CAFE.F, CAFE.p, CAFE.v, TARGET_PROFIT), tol: 0.5,
      hint: 'Treat the target profit as one more fixed cost to cover.',
      explain: `(${money(CAFE.F)} + ${money(TARGET_PROFIT)}) ÷ ${money(CAFE.p - CAFE.v)} = **${count(breakEven(CAFE.F, CAFE.p, CAFE.v, TARGET_PROFIT))} cups**.`,
    },
    {
      kind: 'task',
      title: 'Move the break-even',
      body: `Get the café's break-even down to **${count(BE_GOAL)} cups** a month. You can renegotiate the fixed costs, change the price, or both. (Ingredients stay ${money(CAFE.v)}.)`,
      widget: plotExplorer({
        params: [
          { id: 'F', label: 'fixed costs', min: 3000, max: 9000, step: 500, value: CAFE.F, format: money },
          { id: 'p', label: 'price', min: 2.5, max: 6, step: 0.25, value: CAFE.p, format: money },
        ],
        spec: (v) => costSpec(v.p, CAFE.v, v.F, 5000, [], { ymax: 25000, unit: 'cups' }),
        readout: (v) => `Break-even: ${count(breakEven(v.F, v.p, CAFE.v))} cups a month`,
        goal: (v) => Math.abs(breakEven(v.F, v.p, CAFE.v) - BE_GOAL) < 1e-6,
        goalText: `${count(BE_GOAL)} cups. Many combinations work: fixed costs ÷ (price − ${money(CAFE.v)}) = ${count(BE_GOAL)}.`,
      }),
      hint: `You need fixed costs = ${count(BE_GOAL)} × (price − ${money(CAFE.v)}). Try keeping the price at ${money(CAFE.p)}.`,
      explain: `Any pair with F = ${count(BE_GOAL)} × (p − ${money(CAFE.v)}) works: ${money(BE_GOAL * (CAFE.p - CAFE.v))} at ${money(CAFE.p)}, or ${money(CAFE.F)} at ${money(CAFE.v + CAFE.F / BE_GOAL)}.`,
    },
    {
      kind: 'choice',
      title: 'Two ways to sell coffee',
      body: `Café A is the one we know: fixed costs ${money(CAFE.F)}, ingredients ${money(CAFE.v)} a cup. Kiosk B rents a tiny space (${money(KIOSK.F)} a month) but buys in ready-made coffee at ${money(KIOSK.v)} a cup. Both charge ${money(CAFE.p)}, sell ${count(Q1)} cups and make **${money(PA(Q1))}** a month.\n\nNext month both sell **20% more**. Whose profit grows more?`,
      options: [
        { text: 'Café A', correct: true },
        { text: 'Kiosk B', why: `Each extra cup earns B only ${money(KIOSK.p - KIOSK.v)}, against ${money(CAFE.p - CAFE.v)} for A. A's high fixed costs are already covered, so its extra contribution all becomes profit.` },
        { text: 'Both the same: same sales growth, same profit', why: 'Same starting profit, but different cost structures. The extra cups contribute different amounts.' },
      ],
      hint: `Compute both profits at ${count(Q1 * 1.2)} cups.`,
      explain: `At ${count(Q1 * 1.2)} cups: A makes ${money(PA(Q1 * 1.2))} (+${pc(PA(Q1 * 1.2) / PA(Q1) - 1)}), B makes ${money(PB(Q1 * 1.2))} (+${pc(PB(Q1 * 1.2) / PB(Q1) - 1)}).`,
    },
    {
      kind: 'read',
      title: 'Operating leverage',
      body: `A business with high fixed costs and a big contribution per unit has high **operating leverage**: profit swings far more than sales, both ways. A's line is steeper: it gains more when sales rise and loses more when they fall.\n\nThe multiplier is **contribution ÷ profit**. For A at ${count(Q1)} cups: ${money((CAFE.p - CAFE.v) * Q1)} ÷ ${money(PA(Q1))} = ${num2(DOL_A)}. Each 1% of sales moves profit ${num2(DOL_A)}%.`,
      widget: () => plotEl({
        x: [1500, 4500], y: [-3000, 6000], xlabel: 'cups', ylabel: 'profit $', size: [400, 270],
        layers: [
          { type: 'fn', f: PA, color: 'var(--c1)', label: 'A: high fixed' },
          { type: 'fn', f: PB, color: 'var(--c2)', label: 'B: low fixed' },
          { type: 'hline', y: 0, color: 'var(--muted)' },
          { type: 'vline', x: Q1, color: 'var(--muted)' },
        ],
      }),
    },
    {
      kind: 'number', unit: '%',
      body: `Café A sells ${count(Q1)} cups and makes ${money(PA(Q1))}. If its sales rise **10%**, by what percent does its profit rise?`,
      answer: DOL_A * 10, tol: 0.1,
      hint: `Profit at ${count(Q1 * 1.1)} cups, compared with ${money(PA(Q1))}.`,
      explain: `${money(PA(Q1 * 1.1))} vs ${money(PA(Q1))}: **+${pc(PA(Q1 * 1.1) / PA(Q1) - 1)}**. That is ${num2(DOL_A)} × 10%.`,
    },
    {
      kind: 'choice',
      body: `Now a bad month: both sell **20% fewer** cups (${count(Q1 * 0.8)}). What happens to café A's profit?`,
      options: [
        { text: `It falls to ${money(PA(Q1 * 0.8))}`, correct: true },
        { text: `It falls 20%, to ${money(PA(Q1) * 0.8)}`, why: 'Profit doesn\'t move in proportion to sales when fixed costs stay put. A loses the full contribution on every cup it doesn\'t sell.' },
        { text: `It falls to ${money(PB(Q1 * 0.8))}, like B's`, why: `That is the kiosk: it loses only ${money(KIOSK.p - KIOSK.v)} per missing cup. A loses ${money(CAFE.p - CAFE.v)}.` },
      ],
      explain: `A: ${money(CAFE.p - CAFE.v)} × ${count(Q1 * 0.8)} − ${money(CAFE.F)} = **${money(PA(Q1 * 0.8))}**, right at break-even. B still makes ${money(PB(Q1 * 0.8))}. Leverage cuts both ways.`,
    },
    {
      kind: 'multi',
      body: 'Which of these businesses tend to have **high operating leverage** (mostly fixed costs, little cost per extra sale)?',
      options: [
        { text: 'A software app with millions of users', correct: true },
        { text: 'An airline', correct: true },
        { text: 'A cinema', correct: true },
        { text: 'A shop reselling goods bought one at a time', why: 'Most of its cost is the goods themselves, which rise with every sale: mostly variable.' },
        { text: 'A freelance translator paid per page', why: 'Few fixed costs: the main cost is their own time, spent page by page.' },
      ],
      explain: 'Writing software, flying a plane or running a screening costs nearly the same whether it serves one more customer or not, so extra customers are almost pure profit, and missing ones almost pure loss.',
    },
    {
      kind: 'order',
      body: 'Order these small businesses by break-even volume (units a month), **lowest first**.',
      items: ORDER3.map((b) => `${b.name}: ${money(b.p)} each, cost ${money(b.v)}, fixed ${money(b.F)}`),
      hint: 'Fixed costs ÷ (price − cost) for each.',
      explain: ORDER3.map((b) => `${b.name}: ${money(b.F)} ÷ ${money(b.p - b.v)} = ${count(b.be)}`).join('; ') + '.',
    },
  ],
  practice: [genBreakEven, genTargetProfit, genLeverage],
};

// ================================================================ lesson 4: unit economics

// Plannr, a subscription planning app.
const APP = { price: 20, gm: 0.8, churn: 0.04, ads: 12000, signups: 50 };
const CAC = APP.ads / APP.signups;
const LIFE = lifetime(APP.churn);
const LTV = ltv(APP.price, APP.gm, APP.churn);
const PAYBACK = payback(CAC, APP.price, APP.gm);
const MEDIAN_LIFE = Math.log(0.5) / Math.log(1 - APP.churn);
const LTV_PRICE = (3 * CAC * APP.churn) / APP.gm; // price that makes LTV = 3 × CAC
const CHANNELS = [
  { name: 'Referral credits', cac: 40 },
  { name: 'Search ads', cac: 180 },
  { name: 'Podcast sponsorship', cac: 350 },
  { name: 'Trade show', cac: 520 },
  { name: 'Influencer posts', cac: 650 },
];

const genLTV: Generator = (rng) => {
  const price = pick(rng, [8, 10, 12, 15, 20, 25, 30, 40, 50]), gm = pick(rng, [0.6, 0.7, 0.75, 0.8, 0.9]), churn = pick(rng, [0.02, 0.025, 0.04, 0.05, 0.08, 0.1]);
  const v = ltv(price, gm, churn);
  return {
    kind: 'number', unit: '$',
    body: `A subscription costs **${money(price)} a month**, with a **${pc(gm)} gross margin**. Each month **${pc(churn)}** of subscribers cancel. What is a customer's lifetime value, in gross profit?`,
    answer: v, tol: 0.5,
    hint: 'Monthly gross profit × average lifetime (1 ÷ monthly churn).',
    explain: `${money(price)} × ${gm} = ${money(price * gm)} a month, for 1 ÷ ${churn} = ${num2(lifetime(churn))} months on average: **${money(v)}**.`,
  };
};

const genPayback: Generator = (rng) => {
  const price = pick(rng, [10, 15, 20, 25, 30, 40]), gm = pick(rng, [0.5, 0.6, 0.75, 0.8]);
  const cac = price * gm * randInt(rng, 2, 24);
  const spend = cac * randInt(rng, 20, 200);
  const n = spend / cac;
  return {
    kind: 'number', unit: 'months',
    body: `A meal-kit app spends **${money(spend)}** on marketing and wins **${count(n)}** new subscribers. Each pays **${money(price)} a month** at a **${pc(gm)} gross margin**. How many months until a subscriber has paid back what it cost to win them?`,
    answer: payback(cac, price, gm), tol: 0.05,
    hint: 'First the cost per customer, then divide by the gross profit per month.',
    explain: `CAC = ${money(spend)} ÷ ${count(n)} = ${money(cac)}. Gross profit ${money(price * gm)} a month. ${money(cac)} ÷ ${money(price * gm)} = **${num2(payback(cac, price, gm))} months**.`,
  };
};

const genWorthIt: Generator = (rng) => {
  const price = pick(rng, [10, 15, 20, 30]), gm = pick(rng, [0.6, 0.7, 0.8]), churn = pick(rng, [0.03, 0.05, 0.08, 0.1]);
  const v = ltv(price, gm, churn);
  const cac = Math.round((v * randInt(rng, 40, 250)) / 100 / 10) * 10;
  const ok = v > cac;
  const naive = price / churn;
  return {
    kind: 'choice',
    body: `A new ad channel wins customers for **${money(cac)}** each. They pay **${money(price)} a month**, **${pc(gm)} gross margin**, and **${pc(churn)}** cancel each month. Does the channel pay for itself?`,
    options: [
      { text: `Yes: each customer brings ${money(v)} of gross profit`, correct: ok, why: ok ? undefined : `${money(v)} is less than the ${money(cac)} it costs to win them.` },
      { text: `No: each customer brings only ${money(v)} of gross profit`, correct: !ok, why: ok ? `${money(v)} is more than the ${money(cac)} it costs: the channel pays back.` : undefined },
      { text: `Yes: each customer pays ${money(naive)} over their lifetime`, why: `That counts revenue. ${pc(1 - gm)} of it goes on serving the customer, so the gross profit is ${money(v)}.` },
    ],
    hint: 'Lifetime value in gross profit = monthly price × margin ÷ churn. Compare with the cost to acquire.',
    explain: `LTV = ${money(price)} × ${gm} ÷ ${churn} = ${money(v)} vs CAC ${money(cac)}: ratio ${num2(v / cac)}. ${ok ? 'It pays back' : 'Every customer loses money'}${ok && v / cac < 3 ? ', though thinly: a common rule of thumb wants about 3×' : ''}.`,
  };
};

const lessonUnits: Lesson = {
  id: 'unit-economics',
  title: 'Unit economics',
  goal: 'Work out customer acquisition cost, lifetime value and payback, and judge whether growth pays.',
  steps: [
    {
      kind: 'number', unit: '$',
      body: `**Plannr** is a planning app at **${money(APP.price)} a month**. Last month it spent **${money(APP.ads)}** on ads and **${APP.signups}** new customers signed up. How much did each new customer cost to win?`,
      answer: CAC, tol: 0.01,
      hint: 'Spend ÷ new customers.',
      explain: `${money(APP.ads)} ÷ ${APP.signups} = **${money(CAC)}**. This is the **customer acquisition cost** (CAC).`,
    },
    {
      kind: 'read',
      title: 'Is a customer worth it?',
      body: `A ${money(CAC)} customer who pays ${money(APP.price)} a month is worth it only if they stay long enough. Unit economics asks three questions:\n\n- **CAC**: what does it cost to win a customer? (All sales and marketing ÷ new customers.)\n- **Lifetime value (LTV)**: how much gross profit does a customer bring before they leave?\n- **Payback**: how many months until a customer has earned back their CAC?`,
    },
    {
      kind: 'choice',
      body: `Each month **${pc(APP.churn)}** of Plannr's customers cancel (the **churn** rate), at random. On average, how long does a customer stay?`,
      options: [
        { text: `${num2(LIFE)} months`, correct: true },
        { text: `About ${Math.round(MEDIAN_LIFE)} months`, why: `That is when half of them have left (the median). A few stay for years, which pulls the average up to 1 ÷ ${APP.churn}.` },
        { text: `${100 - APP.churn * 100} months`, why: 'That subtracts the churn from 100. The chance of leaving each month is what matters: 1 in ' + Math.round(1 / APP.churn) + '.' },
        { text: '12 months', why: 'There is nothing special about a year here. With 4% leaving a month, many stay well past a year.' },
      ],
      hint: `If 1 in ${Math.round(1 / APP.churn)} customers leaves each month, how many months is the typical stay?`,
      explain: `Average lifetime = 1 ÷ churn = 1 ÷ ${APP.churn} = **${num2(LIFE)} months**. Half are gone after about ${Math.round(MEDIAN_LIFE)}, but the long stayers lift the average.`,
    },
    {
      kind: 'read',
      title: 'A cohort fades',
      body: `Follow 100 customers who join together. Each month ${pc(APP.churn)} of those left cancel. The total months they stay, divided by 100, is ${num2(LIFE)}: the area under this curve.`,
      widget: () => plotEl({
        x: [0, 72], y: [0, 105], xlabel: 'months since joining', ylabel: 'customers left', size: [400, 260], ticks: [12, 20],
        layers: [
          { type: 'area', f: (t) => 100 * retained(APP.churn, t), from: 0, to: 72, color: 'var(--c3)' },
          { type: 'fn', f: (t) => 100 * retained(APP.churn, t), color: 'var(--c3)' },
          { type: 'vline', x: LIFE, color: 'var(--c1)', label: `average ${num2(LIFE)} months` },
        ],
      }),
    },
    {
      kind: 'number', unit: '$',
      body: `Plannr's **gross margin** is **${pc(APP.gm)}** (hosting, support and payment fees take the rest). What is a customer's **lifetime value** in gross profit?`,
      answer: LTV, tol: 0.5,
      hint: 'Gross profit per month × average months.',
      explain: `${money(APP.price)} × ${APP.gm} = ${money(APP.price * APP.gm)} a month × ${num2(LIFE)} months = **${money(LTV)}**.`,
    },
    {
      kind: 'choice',
      body: `A co-founder says each customer is worth **${money(APP.price * LIFE)}** (${money(APP.price)} × ${num2(LIFE)} months). What's wrong with that?`,
      options: [
        { text: 'It counts revenue, not the profit left after serving the customer', correct: true },
        { text: 'Nothing: lifetime value is total payments', why: `Payments aren't all kept. ${pc(1 - APP.gm)} of each goes on serving that customer, so comparing revenue with CAC overstates what a customer is worth.` },
        { text: 'It should use 12 months, not the average lifetime', why: 'Capping at a year can be a cautious choice, but the main error is counting revenue instead of gross profit.' },
      ],
      explain: `Using revenue (${money(APP.price * LIFE)}) instead of gross profit (${money(LTV)}) makes customers look ${pc(1 / APP.gm - 1, 0)} more valuable than they are.`,
    },
    {
      kind: 'number', unit: 'months',
      body: `Each Plannr customer costs **${money(CAC)}** to win and brings **${money(APP.price * APP.gm)}** of gross profit a month. How many months until they have paid back their acquisition cost?`,
      answer: PAYBACK, tol: 0.05,
      hint: 'CAC ÷ monthly gross profit.',
      explain: `${money(CAC)} ÷ ${money(APP.price * APP.gm)} = **${num2(PAYBACK)} months**. Until then, every new customer is cash the company has spent and not yet got back, and only ${pc(retained(APP.churn, PAYBACK), 0)} are still around at month ${num2(PAYBACK)}.`,
    },
    {
      kind: 'choice',
      body: `So Plannr's LTV is ${money(LTV)} and its CAC ${money(CAC)}. Is this a healthy business to pour more ad money into?`,
      options: [
        { text: `Thin: LTV is only ${num2(LTV / CAC)}× CAC`, correct: true },
        { text: 'Yes: LTV is bigger than CAC, so every customer is profitable', why: `Gross profit still has to pay for building the product, the team and the office. At ${num2(LTV / CAC)}× there is little left, and the estimates could easily be off.` },
        { text: 'No: a business should earn back CAC in the first month', why: 'Subscription businesses routinely take months to pay back. The question is whether the total comes back with room to spare.' },
      ],
      explain: `A common rule of thumb asks for LTV of about **3× CAC** and payback within a year or so, leaving room for fixed costs and for estimates being wrong. ${num2(LTV / CAC)}× and ${num2(PAYBACK)} months is thin.`,
    },
    {
      kind: 'task',
      title: 'Reach 3×',
      body: `Keep churn at ${pc(APP.churn)}, margin at ${pc(APP.gm)} and CAC at ${money(CAC)}. Find the **lowest** monthly price at which LTV reaches **3× CAC**.`,
      widget: explorer({
        params: [{ id: 'p', label: 'monthly price', min: 10, max: 50, step: 2, value: APP.price, format: money }],
        draw: (v) => barChart([
          { label: 'CAC', value: CAC, color: 'var(--c4)' },
          { label: '3 × CAC', value: 3 * CAC, color: 'var(--muted)' },
          { label: 'LTV', value: ltv(v.p, APP.gm, APP.churn), color: 'var(--c3)' },
        ], { max: ltv(50, APP.gm, APP.churn), format: money }),
        readout: (v) => `LTV ${money(ltv(v.p, APP.gm, APP.churn))} = ${num2(ltv(v.p, APP.gm, APP.churn) / CAC)}× CAC · payback ${num2(payback(CAC, v.p, APP.gm))} months`,
        goal: (v) => Math.abs(v.p - LTV_PRICE) < 1e-9,
        goalText: 'That reaches 3× (assuming the higher price doesn\'t scare off customers or raise churn).',
      }),
      hint: `LTV = price × ${APP.gm} × ${num2(LIFE)}. You need ${money(3 * CAC)}.`,
      explain: `${money(3 * CAC)} ÷ (${APP.gm} × ${num2(LIFE)} months) = **${money(LTV_PRICE)}** a month. In real life a price rise changes sign-ups and churn too; next lesson is about that trade-off.`,
    },
    {
      kind: 'sort',
      body: `Plannr's LTV is ${money(LTV)}. Sort each marketing channel by whether its customers earn back what they cost.`,
      bins: ['Pays back', 'Never pays back'],
      items: CHANNELS.map((c) => ({ text: `${c.name}: ${money(c.cac)} per customer`, bin: c.cac < LTV ? 0 : 1 })),
      hint: `Compare each CAC with ${money(LTV)}.`,
      explain: `Channels costing less than ${money(LTV)} per customer pay back; the others lose money on every customer, however many they bring. Averages hide this: the blended CAC can look fine while one channel burns cash.`,
    },
    {
      kind: 'multi',
      body: 'Which of these improve the LTV : CAC ratio?',
      options: [
        { text: 'Cutting monthly churn', correct: true },
        { text: 'Raising gross margin (cheaper hosting, fewer refunds)', correct: true },
        { text: 'Moving ad money to cheaper channels', correct: true },
        { text: 'Spending more on the most expensive channel', why: 'More expensive customers raise the average CAC.' },
        { text: 'Counting revenue instead of gross profit', why: 'That makes the number look better without changing the business.' },
      ],
      explain: 'LTV = price × margin ÷ churn, so price, margin and retention all lift it; CAC falls with cheaper channels. Relabelling revenue as value only fools the spreadsheet.',
    },
    {
      kind: 'match',
      body: 'Match each metric to how it\'s computed.',
      heads: ['Metric', 'Formula'],
      pairs: [
        ['CAC', 'Sales and marketing spend ÷ new customers'],
        ['Average lifetime', '1 ÷ monthly churn'],
        ['LTV', 'Monthly gross profit × average lifetime'],
        ['Payback', 'CAC ÷ monthly gross profit'],
      ],
      explain: `Plannr: CAC ${money(CAC)}, lifetime ${num2(LIFE)} months, LTV ${money(LTV)}, payback ${num2(PAYBACK)} months.`,
    },
  ],
  practice: [genLTV, genPayback, genWorthIt],
};

// ================================================================ lesson 5: pricing and discounts

const SHIRT = { price: 20, cost: 12, n: 100 };
const SHIRT_M = margin(SHIRT.cost, SHIRT.price);
const SALE = 0.25;
const SALE_NEED = discountVolume(SHIRT_M, SALE); // volume multiplier
const D_MARGINS = [0.2, 0.3, 0.4, 0.5], D_CUTS = [0.05, 0.1, 0.2, 0.3];
const TASK5 = { m: 0.4, mult: 2 };
const TASK5_D = TASK5.m * (1 - 1 / TASK5.mult);
const ONE_PCT = { price: CAFE.p * 0.01 * Q1, volume: Q1 * 0.01 * (CAFE.p - CAFE.v) };
// Cookies: weekly demand q = 600 − 100p, $1 of ingredients each.
const COOKIE = { a: 600, b: 100, v: 1 };
const cq = (p: number) => Math.max(0, COOKIE.a - COOKIE.b * p);
const cprofit = (p: number) => (p - COOKIE.v) * cq(p);
const REV_PEAK = COOKIE.a / (2 * COOKIE.b);
const PROFIT_PEAK = (COOKIE.a / COOKIE.b + COOKIE.v) / 2;
/** New gross profit as a multiple of the old after a price change u (share of price) and volume change w. */
const promo = (m: number, u: number, w: number) => ((m + u) / m) * (1 + w);
const PROMOS = [
  { m: 0.4, u: -0.1, w: 0.2 }, { m: 0.4, u: -0.1, w: 0.5 }, { m: 0.25, u: 0.1, w: -0.2 },
  { m: 0.5, u: 0.05, w: -0.15 }, { m: 0.6, u: -0.2, w: 0.4 }, { m: 0.3, u: 0.1, w: -0.2 },
];
const promoText = (o: { m: number; u: number; w: number }) =>
  `${o.u < 0 ? `${pc(-o.u)} off` : `Price up ${pc(o.u)}`}, ${pc(o.m)} margin, sales ${o.w > 0 ? '+' : '−'}${pc(Math.abs(o.w))}`;

const genDiscount: Generator = (rng) => {
  const m = pick(rng, [0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6]);
  const d = pick(rng, [0.05, 0.1, 0.15, 0.2, 0.25].filter((x) => x < m - 0.01));
  const ans = (discountVolume(m, d) - 1) * 100;
  const thing = pick(rng, ['trainers', 'headphones', 'pot plants', 'board games', 'jackets']);
  return {
    kind: 'number', unit: '%',
    body: `A shop sells ${thing} at a **${pc(m)} gross margin**. It runs a **${pc(d)} off** sale. By what percent must the number sold rise just to keep the same gross profit?`,
    answer: ans, tol: 0.2,
    hint: 'Use a $100 price: profit per item before and after the discount.',
    explain: `On a $100 price, profit per item falls from ${money(100 * m)} to ${money(100 * (m - d))}. Volume must rise by ${num2(m)} ÷ ${num2(m - d)} = ${num2(discountVolume(m, d))}×, so **+${pc(ans / 100)}**.`,
  };
};

const genRise: Generator = (rng) => {
  const m = pick(rng, [0.15, 0.2, 0.25, 0.3, 0.4, 0.5]), u = pick(rng, [0.05, 0.1, 0.15, 0.2]);
  const ans = (1 - riseVolume(m, u)) * 100;
  return {
    kind: 'number', unit: '%',
    body: `A business with a **${pc(m)} gross margin** raises its prices by **${pc(u)}**. What percentage of its sales volume could it lose and still make the same gross profit?`,
    answer: ans, tol: 0.2,
    hint: 'Use a $100 price: profit per item before and after the rise.',
    explain: `Profit per $100 of old price goes from ${money(100 * m)} to ${money(100 * (m + u))}. It needs only ${num2(m)} ÷ ${num2(m + u)} = ${pc(riseVolume(m, u))} of the old volume: it can lose **${pc(ans / 100)}**.`,
  };
};

const genPromo: Generator = (rng) => {
  const m = pick(rng, [0.25, 0.3, 0.4, 0.5, 0.6]), d = pick(rng, [0.1, 0.15, 0.2].filter((x) => x < m));
  let w = randInt(rng, 1, 8) / 10;
  if (Math.abs(promo(m, -d, w) - 1) < 0.02) w += 0.1;
  const n = randInt(rng, 2, 10) * 100, price = pick(rng, [10, 20, 40, 50]);
  const before = n * price * m, after = n * (1 + w) * price * (m - d);
  const up = after > before;
  return {
    kind: 'choice',
    body: `A shop sells **${count(n)}** items a week at **${money(price)}**, with a **${pc(m)} margin**. A **${pc(d)} off** promotion lifts sales by **${pc(w)}**. What happens to its weekly gross profit?`,
    options: [
      { text: `It rises, to ${money(after)}`, correct: up, why: up ? undefined : `Each item now earns ${money(price * (m - d))} instead of ${money(price * m)}; the extra ${pc(w)} of sales doesn't make up for it: ${money(after)} vs ${money(before)}.` },
      { text: `It falls, to ${money(after)}`, correct: !up, why: up ? `The extra sales more than make up for the thinner margin: ${money(after)} vs ${money(before)}.` : undefined },
      { text: `It rises by ${pc(w)}`, why: 'That assumes each item earns as much as before. The discount comes straight out of the margin.' },
    ],
    hint: 'Gross profit = items × price × margin. After the discount, the margin is the old margin minus the discount (as shares of the old price).',
    explain: `Before: ${count(n)} × ${money(price * m)} = ${money(before)}. After: ${count(n * (1 + w))} × ${money(price * (m - d))} = **${money(after)}**. Break-even uplift would be ${pc(discountVolume(m, d) - 1)}.`,
  };
};

const lessonPricing: Lesson = {
  id: 'pricing',
  title: 'Pricing and discounts',
  goal: 'Work out how much extra volume a discount needs, and why small price changes move profit so much.',
  steps: [
    {
      kind: 'choice',
      body: `A shop sells T-shirts at **${money(SHIRT.price)}** that cost it **${money(SHIRT.cost)}**, and usually sells **${SHIRT.n}** a week. It runs a **${pc(SALE)} off** sale. To make the **same gross profit** as a normal week, how many more shirts does it need to sell?`,
      options: [
        { text: `${pc(SALE_NEED - 1, 0)} more (about ${count(SHIRT.n * SALE_NEED)} shirts)`, correct: true },
        { text: `${pc(SALE)} more`, why: `That matches the size of the discount, but the discount comes out of a profit of only ${money(SHIRT.price - SHIRT.cost)} per shirt. It takes ${money(SHIRT.price * SALE)} from each.` },
        { text: `${pc(1 / (1 - SALE) - 1, 0)} more`, why: `That keeps **revenue** the same. The shirts still cost ${money(SHIRT.cost)} each, so profit needs far more.` },
        { text: '100% more (double)', why: `Not even doubling is enough: each shirt now earns ${money(SHIRT.price * (1 - SALE) - SHIRT.cost)} instead of ${money(SHIRT.price - SHIRT.cost)}.` },
      ],
      hint: 'Profit per shirt before and after the discount.',
      explain: `Normally ${SHIRT.n} × ${money(SHIRT.price - SHIRT.cost)} = ${money(SHIRT.n * (SHIRT.price - SHIRT.cost))}. On sale each shirt earns ${money(SHIRT.price * (1 - SALE))} − ${money(SHIRT.cost)} = ${money(SHIRT.price * (1 - SALE) - SHIRT.cost)}, so it needs ${money(SHIRT.n * (SHIRT.price - SHIRT.cost))} ÷ ${money(SHIRT.price * (1 - SALE) - SHIRT.cost)} ≈ **${count(SHIRT.n * SALE_NEED)} shirts**.`,
    },
    {
      kind: 'read',
      title: 'Discounts eat margin',
      body: 'A discount comes entirely out of the margin. With margin **m** and discount **d** (both as shares of the price), each sale now earns m − d instead of m, so volume must grow **m ÷ (m − d)** times. The thinner the margin, the worse it gets:',
      widget: () => dataTable(['Margin', ...D_CUTS.map((d) => `${pc(d)} off`)],
        D_MARGINS.map((m) => [pc(m), ...D_CUTS.map((d) => (d < m ? `+${pc(discountVolume(m, d) - 1, 0)}` : 'never'))]), { caption: 'Extra sales needed to keep the same gross profit' }),
    },
    {
      kind: 'number', unit: '%',
      body: 'A grocer runs on a **30% margin**. By what percent must sales rise to make a **10% off** offer break even on gross profit?',
      answer: (discountVolume(0.3, 0.1) - 1) * 100, tol: 0.2,
      hint: 'm ÷ (m − d), then subtract 1.',
      explain: `0.3 ÷ 0.2 = ${num2(discountVolume(0.3, 0.1))}: **+${pc(discountVolume(0.3, 0.1) - 1)}**. A third of the profit on each sale is given away.`,
    },
    {
      kind: 'task',
      title: 'Find the doubling discount',
      body: `At a **${pc(TASK5.m)} margin**, find the discount at which the shop has to sell **twice** as many items just to stand still.`,
      widget: explorer({
        params: [{ id: 'd', label: 'discount', min: 0, max: 35, step: 5, value: 5, format: (x) => `${x}%` }],
        draw: (v) => barChart([
          { label: 'Usual week', value: 100, color: 'var(--c2)' },
          { label: 'Needed on sale', value: discountVolume(TASK5.m, v.d / 100) * 100, color: 'var(--c1)' },
        ], { max: 800, format: (x) => `${count(x)} items` }),
        readout: (v) => `Each item earns ${pc(TASK5.m - v.d / 100)} of the old price instead of ${pc(TASK5.m)}: sales must rise ${pc(discountVolume(TASK5.m, v.d / 100) - 1, 0)}`,
        goal: (v) => Math.abs(v.d / 100 - TASK5_D) < 1e-9,
        goalText: `Half the margin given away means twice the volume needed.`,
      }),
      hint: 'Volume needed = m ÷ (m − d). When is that 2?',
      explain: `${num2(TASK5.m)} ÷ (${num2(TASK5.m)} − d) = 2 when d = **${pc(TASK5_D)}**: half the margin. Beyond that it climbs steeply: at ${pc(0.35)} off you need ${count(discountVolume(TASK5.m, 0.35))}× the sales.`,
    },
    {
      kind: 'read',
      title: 'The same maths, the other way',
      body: `A **price rise** adds straight to the margin, so you can afford to lose some sales. Volume can fall to **m ÷ (m + u)** of what it was, for a rise u.\n\nAt a 20% margin, a 10% price rise needs only ${num2(0.2)} ÷ ${num2(0.3)} = ${pc(riseVolume(0.2, 0.1))} of the old volume.`,
    },
    {
      kind: 'number', unit: '%',
      body: 'A firm with a **20% margin** raises prices **10%**. What percentage of its customers could it lose and still earn the same gross profit?',
      answer: (1 - riseVolume(0.2, 0.1)) * 100, tol: 0.2,
      hint: 'It needs m ÷ (m + u) of the old volume. What share is that away from 100%?',
      explain: `It needs ${pc(riseVolume(0.2, 0.1))} of the old volume, so it could lose **${pc(1 - riseVolume(0.2, 0.1))}**. Whether it actually would depends on its customers (the elasticity of demand).`,
    },
    {
      kind: 'choice',
      title: 'Price or volume?',
      body: `The café sells ${count(Q1)} cups at ${money(CAFE.p)} and makes ${money(P1)} a month. Which adds more profit: raising the price **1%** (with the same sales), or selling **1% more** cups (at the same price)?`,
      options: [
        { text: `The price rise: +${money(ONE_PCT.price)}`, correct: true },
        { text: `The extra cups: +${money(ONE_PCT.volume)}`, why: `Those ${count(Q1 * 0.01)} cups earn ${money(CAFE.p - CAFE.v)} each, ${money(ONE_PCT.volume)} in all. A price rise on all ${count(Q1)} cups brings ${money(ONE_PCT.price)}, with no extra ingredients.` },
        { text: 'The same: 1% is 1%', why: 'Extra cups come with extra ingredient costs; a price rise is pure profit on every cup.' },
      ],
      hint: `1% of ${money(CAFE.p)} on every cup, vs 1% more cups each earning ${money(CAFE.p - CAFE.v)}.`,
      explain: `Price: ${money(CAFE.p * 0.01)} × ${count(Q1)} = **${money(ONE_PCT.price)}** (+${pc(ONE_PCT.price / P1)} profit). Volume: ${count(Q1 * 0.01)} × ${money(CAFE.p - CAFE.v)} = ${money(ONE_PCT.volume)} (+${pc(ONE_PCT.volume / P1)}). Price is usually the strongest profit lever, which is also why discounts hurt so much.`,
    },
    {
      kind: 'task',
      title: 'The best price',
      body: `The café also bakes cookies: **${money(COOKIE.v)}** of ingredients each. At a price of p dollars it sells about **${COOKIE.a} − ${COOKIE.b}p** a week. Find the price that makes the **most profit**. The shaded box is the profit: (price − ${money(COOKIE.v)}) × cookies sold.`,
      widget: plotExplorer({
        params: [{ id: 'p', label: 'price', min: 1.5, max: 5.5, step: 0.25, value: 2, format: money }],
        spec: (v) => ({
          x: [0, COOKIE.a], y: [0, COOKIE.a / COOKIE.b], ticks: [100, 1], size: [400, 270], xlabel: 'cookies a week', ylabel: 'price $',
          layers: [
            { type: 'line', pts: [[0, COOKIE.v], [cq(v.p), COOKIE.v], [cq(v.p), v.p], [0, v.p]], closed: true, color: 'var(--c3)', width: 1.5, fill: 'color-mix(in srgb, var(--c3) 30%, transparent)' },
            { type: 'line', pts: [[0, 0], [cq(v.p), 0], [cq(v.p), COOKIE.v], [0, COOKIE.v]], closed: true, color: 'var(--c4)', width: 1, fill: 'color-mix(in srgb, var(--c4) 20%, transparent)' },
            { type: 'fn', f: (q) => (COOKIE.a - q) / COOKIE.b, color: 'var(--c1)', label: 'demand' },
            { type: 'text', x: cq(v.p) / 2, y: (v.p + COOKIE.v) / 2, text: money(cprofit(v.p)), color: 'var(--text)' },
          ],
        }),
        readout: (v) => `${money(v.p)}: ${count(cq(v.p))} cookies, revenue ${money(v.p * cq(v.p))}, profit ${money(cprofit(v.p))}`,
        goal: (v) => Math.abs(v.p - PROFIT_PEAK) < 1e-9,
        goalText: `The most profit: ${money(cprofit(PROFIT_PEAK))} a week.`,
      }),
      hint: 'Watch the profit as you move a step either way. The peak is where it stops rising.',
      explain: `At **${money(PROFIT_PEAK)}** it sells ${count(cq(PROFIT_PEAK))} and makes ${money(cprofit(PROFIT_PEAK))}. Revenue is highest at ${money(REV_PEAK)} (${money(REV_PEAK * cq(REV_PEAK))}), but profit there is only ${money(cprofit(REV_PEAK))}.`,
    },
    {
      kind: 'choice',
      body: `Revenue from cookies peaks at ${money(REV_PEAK)}, but profit peaks higher, at ${money(PROFIT_PEAK)}. Why?`,
      options: [
        { text: 'Each lost sale above the revenue peak gives up only its profit, not its whole price', correct: true },
        { text: 'Higher prices always bring more profit', why: `Not past the peak: at ${money(5)} it sells ${count(cq(5))} and makes just ${money(cprofit(5))}.` },
        { text: 'Customers think dearer cookies taste better', why: 'Nothing like that is in this model: demand falls steadily as the price rises.' },
      ],
      explain: `Between ${money(REV_PEAK)} and ${money(PROFIT_PEAK)}, revenue dips a little, but every cookie not sold also saves ${money(COOKIE.v)} of ingredients. Maximising revenue ignores costs; the profit-maximising price is always at or above it.`,
    },
    {
      kind: 'sort',
      body: 'Sort each price move by what it does to gross profit.',
      bins: ['Profit rises', 'Profit falls'],
      items: PROMOS.map((o) => ({ text: promoText(o), bin: promo(o.m, o.u, o.w) > 1 ? 0 : 1 })),
      hint: 'New profit ÷ old = (m + u) ÷ m × (1 + sales change), where u is negative for a discount.',
      explain: PROMOS.map((o) => `${promoText(o)}: ×${num2(promo(o.m, o.u, o.w))}`).join('; ') + '.',
    } satisfies SortStep,
    {
      kind: 'multi',
      body: 'When can a discount make good sense?',
      options: [
        { text: 'Selling today\'s pastries at closing time instead of binning them', correct: true },
        { text: 'Off-peak prices that fill seats that would otherwise be empty', correct: true },
        { text: 'A first-month discount, when customers stay a long time and lifetime value is high', correct: true },
        { text: 'A permanent 20% off on a product with a 25% margin, to "win market share"', why: `Sales would have to grow ${pc(discountVolume(0.25, 0.2) - 1, 0)} just to keep the same gross profit.` },
        { text: 'Matching a rival\'s sale without checking how many extra sales it brings', why: 'The volume needed depends on your margin. Without the numbers it\'s a guess.' },
      ],
      explain: 'Discounts pay when the extra sales cost little (stock that would be wasted, empty capacity) or bring customers worth a lot later. Across the board, on thin margins, they need huge volume gains.',
    },
  ],
  practice: [genDiscount, genRise, genPromo],
};

// ================================================================ lesson 6: cash flow vs profit

const JOB = { cash: 15000, cost: 30000, price: 50000 };
const JOB_CASH = [JOB.cash, JOB.cash - JOB.cost, JOB.cash - JOB.cost, JOB.cash - JOB.cost + JOB.price];
const JOB_PROFIT = [0, JOB.price - JOB.cost, JOB.price - JOB.cost, JOB.price - JOB.cost];
const AR = { sales: 90000, days: 60 };
const CCC = { stock: 45, customers: 30, suppliers: 40 };
const CCC_DAYS = CCC.stock + CCC.customers - CCC.suppliers;
const DAILY = 2000;
const OVEN = { profit: 10000, oven: 12000, years: 4 };
const OVEN_DEP = OVEN.oven / OVEN.years;
const CASH_SIM = { c0: 15000, s0: 10000, cr: 0.75 };
const SIM_GROWTH = 20;
const SIM_LOW = Math.min(...cashPath({ ...CASH_SIM, g: SIM_GROWTH / 100, col: 2, pay: 0, months: 12 }).cash);

const genReceivables: Generator = (rng) => {
  const sales = randInt(rng, 2, 40) * 5000, days = pick(rng, [15, 30, 45, 60, 90]);
  const ar = (sales * days) / 30;
  return {
    kind: 'number', unit: '$',
    body: `A wholesaler sells **${money(sales)} a month**, steadily, and its customers pay **${days} days** after delivery. How much money is owed to it at any moment?`,
    answer: ar, tol: 1,
    hint: 'How many months of sales are waiting to be paid?',
    explain: `${days} days is ${num2(days / 30)} months of sales: ${money(sales)} × ${num2(days / 30)} = **${money(ar)}** of receivables, cash earned but not yet in the bank.`,
  };
};

const genCCC: Generator = (rng) => {
  const s = randInt(rng, 1, 12) * 5, c = pick(rng, [0, 15, 30, 45, 60]), p = pick(rng, [15, 30, 45, 60]);
  const ccc = s + c - p;
  return {
    kind: 'number', unit: 'days',
    body: `A shop keeps stock for **${s} days** before selling it, customers pay **${c === 0 ? 'on the spot' : `${c} days`}** after buying, and the shop pays its suppliers **${p} days** after delivery. What is its cash conversion cycle (negative if suppliers' money funds it)?`,
    answer: ccc, tol: 0.01,
    hint: 'Days in stock + days to get paid − days before paying suppliers.',
    explain: `${s} + ${c} − ${p} = **${ccc < 0 ? '−' + -ccc : ccc} days**. ${ccc > 0 ? 'For that long, the shop\'s own cash is tied up in each sale.' : 'The shop gets paid before it pays: its suppliers are financing it.'}`,
  };
};

const genCashFromProfit: Generator = (rng) => {
  const prof = randInt(rng, 4, 40) * 1000, dep = randInt(rng, 1, 8) * 1000, capex = randInt(rng, 0, 12) * 1000, ar = randInt(rng, -5, 10) * 1000;
  const cash = prof + dep - capex - ar;
  return {
    kind: 'number', unit: '$',
    body: `This year a workshop's profit was **${money(prof)}**, after a depreciation charge of **${money(dep)}**. It paid **${money(capex)}** cash for new tools, and the money customers owe it ${ar >= 0 ? 'grew' : 'shrank'} by **${money(Math.abs(ar))}**. By how much did its cash change? (Negative if it fell.)`,
    answer: cash, tol: 0.5,
    hint: 'Start from profit. Add back costs that weren\'t paid in cash; take off cash spent that isn\'t a cost this year; take off sales not yet collected.',
    explain: `${money(prof)} + ${money(dep)} depreciation (not a cash payment) − ${money(capex)} tools ${ar >= 0 ? '−' : '+'} ${money(Math.abs(ar))} ${ar >= 0 ? 'still owed by customers' : 'collected from older sales'} = **${money(cash)}**.`,
  };
};

const lessonCash: Lesson = {
  id: 'cash',
  title: 'Cash flow vs profit',
  goal: 'See why profitable firms run out of cash, and measure the cash tied up in working capital.',
  steps: [
    {
      kind: 'choice',
      body: `A furniture workshop has **${money(JOB.cash)}** in the bank. A hotel orders tables for **${money(JOB.price)}**. Materials and wages cost **${money(JOB.cost)}**, paid as the work is done this month. The hotel pays **60 days** after delivery. Should the workshop just take the order?`,
      options: [
        { text: `Only with a loan or a deposit: its cash would fall to ${money(JOB.cash - JOB.cost)} before the hotel pays`, correct: true },
        { text: `Yes: it makes ${money(JOB.price - JOB.cost)} profit`, why: `The profit is real, but it arrives two months after the ${money(JOB.cost)} of costs. Bills and wages are paid with cash, not with profit.` },
        { text: 'No: the order loses money', why: `It doesn't: ${money(JOB.price)} − ${money(JOB.cost)} = ${money(JOB.price - JOB.cost)} of profit. The problem is timing.` },
      ],
      hint: 'Track the bank balance month by month.',
      explain: `Month 1: ${money(JOB.cash)} − ${money(JOB.cost)} = **${money(JOB.cash - JOB.cost)}**. Month 3: the hotel pays and cash jumps to ${money(JOB_CASH[3])}. A profitable order can still bounce the wages in between.`,
    },
    {
      kind: 'read',
      title: 'Profit is an opinion, cash is a fact',
      body: 'Accounting profit records a sale when the work is done. Cash records it when the money arrives. Step through the order (bars: cash in the bank; dashed line: the starting cash; green dots: profit so far):',
      widget: () => stepper(4, (i) => plotEl({
        x: [0.4, 3.6], y: [-20, 40], ticks: [1, 10], xlabel: 'month', ylabel: '$ thousands', size: [400, 250],
        layers: [
          { type: 'hline', y: JOB.cash / 1000, color: 'var(--muted)' },
          { type: 'bars', width: 0.5, color: 'var(--c1)', pts: JOB_CASH.slice(1, i + 1).map((c, k) => [k + 1, c / 1000] as [number, number]) },
          { type: 'dots', pts: JOB_PROFIT.slice(1, i + 1).map((p, k) => [k + 1.32, p / 1000] as [number, number]), color: 'var(--c3)', r: 6, labels: JOB_PROFIT.slice(1, i + 1).map((_, k) => (k === i - 1 ? 'profit' : '')) },
        ],
      }), { caption: (i) => [`Start: ${money(JOB.cash)} cash`, `Month 1: tables delivered. Profit ${money(JOB.price - JOB.cost)}; cash ${money(JOB_CASH[1])}`, `Month 2: still waiting. Cash ${money(JOB_CASH[2])}`, `Month 3: the hotel pays. Cash ${money(JOB_CASH[3])}`][i] }),
    },
    {
      kind: 'number', unit: '$',
      body: `A wholesaler sells **${money(AR.sales)} a month**, steadily, and customers pay **${AR.days} days** after delivery. How much is owed to it at any moment (its **receivables**)?`,
      answer: (AR.sales * AR.days) / 30, tol: 1,
      hint: `${AR.days} days is how many months of sales?`,
      explain: `${AR.days / 30} months of sales are always waiting: **${money((AR.sales * AR.days) / 30)}**. That money is earned (it's in the profit) but it isn't in the bank.`,
    },
    {
      kind: 'read',
      title: 'Working capital',
      body: `Money gets stuck in three places:\n\n- **Stock** on the shelves, already paid for but not yet sold\n- **Receivables**: sales made but not yet paid for\n- minus **payables**: supplies you've received but not yet paid for (suppliers' money working for you)\n\nThe **cash conversion cycle** counts the days: days in stock + days to get paid − days before you pay suppliers. For that long, each sale ties up your own cash.`,
    },
    {
      kind: 'number', unit: 'days',
      body: `A hardware shop holds stock for **${CCC.stock} days**, its trade customers pay after **${CCC.customers} days**, and it pays suppliers after **${CCC.suppliers} days**. What is its cash conversion cycle?`,
      answer: CCC_DAYS, tol: 0.01,
      hint: 'Stock days + customer days − supplier days.',
      explain: `${CCC.stock} + ${CCC.customers} − ${CCC.suppliers} = **${CCC_DAYS} days** between paying for goods and getting paid for them.`,
    },
    {
      kind: 'choice',
      body: `The shop spends about **${money(DAILY)} a day** on goods, so ${CCC_DAYS} days × ${money(DAILY)} = **${money(CCC_DAYS * DAILY)}** of its cash is tied up in the cycle. Next year sales **double**, on the same terms. How much cash is tied up then?`,
      options: [
        { text: money(2 * CCC_DAYS * DAILY), correct: true },
        { text: money(CCC_DAYS * DAILY), why: 'The cycle is the same number of days, but each day now carries twice as much money.' },
        { text: money((CCC_DAYS * DAILY) / 2), why: 'Growth doesn\'t free cash here: more sales means more stock and more receivables to fund.' },
      ],
      explain: `${CCC_DAYS} days × ${money(2 * DAILY)} = **${money(2 * CCC_DAYS * DAILY)}**. Growth swallows cash: the extra ${money(CCC_DAYS * DAILY)} has to come from somewhere before the extra profit arrives. This is how fast-growing, profitable firms run out of money.`,
    },
    {
      kind: 'read',
      title: 'Growth eats cash',
      body: `A distributor starts with ${money(CASH_SIM.c0)}. Sales start at ${money(CASH_SIM.s0)} a month and each sale makes a ${pc(1 - CASH_SIM.cr)} profit. Its customers pay late; it pays suppliers at once. Try faster growth.`,
      widget: cashSim({ ...CASH_SIM }),
    },
    {
      kind: 'task',
      title: 'Survive the growth',
      body: `Now sales grow **${SIM_GROWTH}% a month**. With customers paying after 60 days and suppliers paid at once, cash bottoms out at ${dollars(SIM_LOW)}. Change the **payment terms** so the cash never goes below zero.`,
      widget: cashSim({ ...CASH_SIM, growth: SIM_GROWTH, goal: true }),
      hint: 'Get paid sooner, or pay later. Either side of the cycle works.',
      explain: `Collecting within 30 days, or paying suppliers after 30 days, keeps cash positive with the same sales and profit. Shortening the cycle is often cheaper than borrowing.`,
    },
    {
      kind: 'number', unit: '$',
      body: `A café buys a **${money(OVEN.oven)}** oven for cash. It will last ${OVEN.years} years, so the accounts charge **${money(OVEN_DEP)} a year** of depreciation. This year's profit, after that charge, is **${money(OVEN.profit)}**. Nothing else is owed or stocked. By how much did the café's cash change this year?`,
      answer: OVEN.profit + OVEN_DEP - OVEN.oven, tol: 0.5,
      hint: 'Depreciation was subtracted from profit but no cash left for it this year. The oven\'s full price did.',
      explain: `${money(OVEN.profit)} + ${money(OVEN_DEP)} (depreciation isn't a payment) − ${money(OVEN.oven)} (the oven, paid in full) = **${money(OVEN.profit + OVEN_DEP - OVEN.oven)}**.`,
    },
    {
      kind: 'sort',
      body: 'Sort each event by what it does right now.',
      bins: ['Profit only', 'Cash only', 'Both'],
      items: [
        { text: 'This year\'s depreciation on the oven', bin: 0 },
        { text: 'A sale on 60-day credit', bin: 0 },
        { text: 'Taking out a bank loan', bin: 1 },
        { text: 'Buying stock for the shelves', bin: 1 },
        { text: 'Repaying part of a loan', bin: 1 },
        { text: 'Paying this month\'s wages', bin: 2 },
        { text: 'A sale paid in cash', bin: 2 },
      ],
      hint: 'Profit counts income and costs as they are earned or used up. Cash counts money moving.',
      explain: 'Depreciation and credit sales change profit with no money moving. Loans, repayments and buying stock move money without being income or a cost (stock becomes a cost only when sold). Wages and cash sales do both.',
    },
    {
      kind: 'multi',
      body: 'Which of these free up cash without changing profit?',
      options: [
        { text: 'Asking customers for a deposit up front', correct: true },
        { text: 'Agreeing longer payment terms with suppliers', correct: true },
        { text: 'Keeping less stock on the shelves', correct: true },
        { text: 'Increasing the depreciation charge', why: 'Depreciation is a bookkeeping entry: it moves profit, not cash.' },
        { text: 'Giving customers 90 days to pay to win more orders', why: 'That ties up more cash in receivables.' },
      ],
      explain: 'Each of the right ones shortens the cash conversion cycle: money arrives sooner, leaves later, or sits less on shelves.',
    },
    {
      kind: 'fill',
      body: 'Complete the idea.',
      template: 'Profit counts a sale when it is [[0]]; cash counts it when it is [[1]]. A growing business needs more [[2]] before its extra profit arrives.',
      blanks: [
        { options: ['made', 'paid for', 'planned'], answer: 0 },
        { options: ['paid for', 'made', 'ordered'], answer: 0 },
        { options: ['cash', 'profit', 'depreciation'], answer: 0 },
      ],
      explain: 'The gap between earning money and receiving it has to be funded with cash. The faster you grow, the bigger the gap.',
    },
  ],
  practice: [genReceivables, genCCC, genCashFromProfit],
};

// ================================================================ lesson 7: growth and churn

const SUB = { add: 100, churn: 0.05 };
const CEIL = SUB.add / SUB.churn;
const CEIL_GOAL = 10000;
const COHORT = { n: 1000, churn: 0.08, months: 12 };
const COHORTS = [
  { name: 'Jan', size: 400, churn: 0.14 }, { name: 'Feb', size: 450, churn: 0.12 }, { name: 'Mar', size: 500, churn: 0.1 },
  { name: 'Apr', size: 520, churn: 0.08 }, { name: 'May', size: 560, churn: 0.07 }, { name: 'Jun', size: 600, churn: 0.06 },
];
const annual = (c: number) => 1 - retained(c, 12);
const NRR = { start: 100000, lost: 15000, up: 25000 };
const NRR2 = { start: 50000, lost: 8000, down: 2000, up: 6000 };
const APPS = [
  { name: 'Recipe app', add: 400, churn: 0.08 },
  { name: 'Language app', add: 150, churn: 0.02 },
  { name: 'Fitness app', add: 900, churn: 0.15 },
  { name: 'Budget app', add: 60, churn: 0.01 },
].map((a) => ({ ...a, ceil: a.add / a.churn })).sort((a, b) => b.ceil - a.ceil);

const genCeiling: Generator = (rng) => {
  const add = randInt(rng, 2, 40) * 25, churn = pick(rng, [0.01, 0.02, 0.025, 0.04, 0.05, 0.08, 0.1]);
  return {
    kind: 'number', unit: 'customers',
    body: `A subscription box wins **${count(add)}** new customers a month, and **${pc(churn)}** of its customers cancel every month. If that continues, where does its customer count level off?`,
    answer: add / churn, tol: 0.5,
    hint: 'It stops growing when the number leaving each month equals the number joining.',
    explain: `Steady when ${pc(churn)} × customers = ${count(add)}: customers = ${count(add)} ÷ ${churn} = **${count(add / churn)}**.`,
  };
};

const genCohortLeft: Generator = (rng) => {
  const n = randInt(rng, 2, 20) * 100, churn = pick(rng, [0.03, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15]), m = pick(rng, [3, 6, 9, 12, 18, 24]);
  const left = n * retained(churn, m);
  return {
    kind: 'number', unit: 'customers',
    body: `**${count(n)}** people sign up for an app in March. Each month **${pc(churn)}** of those still subscribed cancel. About how many are still subscribed **${m} months** later?`,
    answer: left, tol: Math.max(1, left * 0.01),
    hint: `Each month keeps ${pc(1 - churn)} of the month before: multiply by ${1 - churn}, ${m} times.`,
    explain: `${count(n)} × ${1 - churn}^${m} = **${count(left)}** (${pc(retained(churn, m), 0)} of the cohort). Not ${count(Math.max(0, n * (1 - churn * m)))}: each month's churn is taken from a smaller group.`,
  };
};

const genAnnualChurn: Generator = (rng) => {
  const c = pick(rng, [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1]);
  const a = annual(c);
  return {
    kind: 'choice',
    body: `A streaming service loses **${pc(c)} of its subscribers every month**. Roughly what share of the subscribers it has on 1 January will have left by 31 December?`,
    options: [
      { text: pc(a, 0), correct: true },
      ...others((v) => pc(v, 0), a, [
        { v: 12 * c, why: `That adds ${pc(c)} twelve times, but each month's ${pc(c)} is taken from the people still there, a shrinking group.` },
        { v: c, why: 'That is one month. Twelve months of churn add up to much more.' },
        { v: 1 - c, why: 'That is the share who stay for one month.' },
      ]),
    ],
    hint: `The share staying all year is ${1 - c}^12.`,
    explain: `Staying: ${1 - c}^12 = ${pc(retained(c, 12), 0)}, so about **${pc(a, 0)}** leave in a year.`,
  };
};

const lessonChurn: Lesson = {
  id: 'churn',
  title: 'Growth and churn',
  goal: 'Use retention and cohorts, and see why churn puts a ceiling on growth.',
  steps: [
    {
      kind: 'choice',
      body: `A new app wins **${SUB.add} subscribers every month**, like clockwork. Each month **${pc(SUB.churn)}** of its subscribers cancel. Where does it end up in the long run?`,
      options: [
        { text: `It levels off near ${count(CEIL)} subscribers`, correct: true },
        { text: 'It keeps growing forever, just more slowly', why: `As the base grows, ${pc(SUB.churn)} of it becomes more people. Once that equals ${SUB.add} a month, growth stops.` },
        { text: `It levels off near ${count(SUB.add * 12)}: a year of sign-ups`, why: 'Nothing special happens after a year. It levels off when cancellations match sign-ups.' },
        { text: `It shrinks: ${pc(SUB.churn)} churn beats any sign-ups`, why: `At the start, almost no one is there to cancel, so the ${SUB.add} new subscribers win easily.` },
      ],
      hint: `At what size does ${pc(SUB.churn)} of the base equal ${SUB.add}?`,
      explain: `${pc(SUB.churn)} × subscribers = ${SUB.add} when subscribers = ${SUB.add} ÷ ${SUB.churn} = **${count(CEIL)}**. Beyond that, more leave each month than join.`,
    },
    {
      kind: 'read',
      title: 'The ceiling: new ÷ churn',
      body: 'Each month the base gains the new sign-ups and loses churn × the base. Growth slows as the base grows, and stops at **new ÷ churn**. Halving churn doubles the ceiling, exactly like doubling sign-ups.',
      widget: plotExplorer({
        params: [
          { id: 'add', label: 'new a month', min: 50, max: 500, step: 50, value: SUB.add, format: count },
          { id: 'c', label: 'monthly churn', min: 1, max: 10, step: 1, value: SUB.churn * 100, format: (x) => `${x}%` },
        ],
        spec: (v) => ({
          x: [0, 60], y: [0, 26], xlabel: 'months', ylabel: 'thousand subscribers', size: [400, 260], ticks: [12, 5],
          layers: [
            { type: 'fn', f: (t) => customersAt(v.add, v.c / 100, t) / 1000, color: 'var(--c1)' },
            { type: 'hline', y: v.add / (v.c / 100) / 1000, color: 'var(--c4)', label: 'ceiling' },
          ],
        }),
        readout: (v) => `Ceiling ${count(v.add / (v.c / 100))}; after 2 years ${count(customersAt(v.add, v.c / 100, 24))}`,
      }),
    },
    {
      kind: 'number', unit: 'subscribers',
      body: 'A podcast app gains **300** subscribers a month and loses **3%** of its subscribers a month. Where does it level off?',
      answer: 300 / 0.03, tol: 0.5,
      hint: 'New ÷ churn.',
      explain: `300 ÷ 0.03 = **${count(300 / 0.03)}**. To grow past it, the app must win more each month or lose fewer.`,
    },
    {
      kind: 'task',
      title: 'Aim for the ceiling you want',
      body: `Set sign-ups and churn so the app levels off at exactly **${count(CEIL_GOAL)}** subscribers.`,
      widget: plotExplorer({
        params: [
          { id: 'add', label: 'new a month', min: 50, max: 500, step: 50, value: SUB.add, format: count },
          { id: 'c', label: 'monthly churn', min: 1, max: 10, step: 1, value: SUB.churn * 100, format: (x) => `${x}%` },
        ],
        spec: (v) => ({
          x: [0, 120], y: [0, 26], xlabel: 'months', ylabel: 'thousand subscribers', size: [400, 260], ticks: [12, 5],
          layers: [
            { type: 'hline', y: CEIL_GOAL / 1000, color: 'var(--muted)', label: 'target' },
            { type: 'fn', f: (t) => customersAt(v.add, v.c / 100, t) / 1000, color: 'var(--c1)' },
          ],
        }),
        readout: (v) => `Ceiling: ${count(v.add / (v.c / 100))} subscribers`,
        goal: (v) => Math.abs(v.add / (v.c / 100) - CEIL_GOAL) < 1e-6,
        goalText: `New ÷ churn = ${count(CEIL_GOAL)}.`,
      }),
      hint: `Sign-ups = ${count(CEIL_GOAL)} × churn. Try 1% churn first.`,
      explain: `Any pair with new = ${count(CEIL_GOAL)} × churn: ${count(CEIL_GOAL * 0.01)} at 1%, ${count(CEIL_GOAL * 0.02)} at 2%, up to ${count(CEIL_GOAL * 0.05)} at 5%. Cutting churn from 5% to 1% is worth as much as five times the marketing.`,
    },
    {
      kind: 'number', unit: 'customers',
      body: `**${count(COHORT.n)}** customers join in January. Each month **${pc(COHORT.churn)}** of those still there cancel. About how many are left after **${COHORT.months} months**?`,
      answer: COHORT.n * retained(COHORT.churn, COHORT.months), tol: 3,
      hint: `Multiply by ${1 - COHORT.churn} once for each month.`,
      explain: `${count(COHORT.n)} × ${1 - COHORT.churn}^${COHORT.months} = **${count(COHORT.n * retained(COHORT.churn, COHORT.months))}**. (Not ${count(COHORT.n * (1 - COHORT.churn * COHORT.months))}: each month's ${pc(COHORT.churn)} comes off a smaller group.)`,
    },
    {
      kind: 'read',
      title: 'Cohorts',
      body: 'A **cohort** is everyone who signed up in the same month. Following each cohort separately shows whether retention is getting better or worse, which a single total hides (new sign-ups can mask a leaky product).',
      widget: () => cohortTable(COHORTS, 5),
    },
    {
      kind: 'choice',
      body: 'Read the cohort table again. What does it show?',
      widget: () => cohortTable(COHORTS, 5),
      options: [
        { text: 'Later cohorts keep more of their customers: retention is improving', correct: true },
        { text: 'Retention is getting worse: the later rows have fewer numbers', why: 'Later cohorts have had fewer months to be measured. Compare the same column (say M2) down the rows.' },
        { text: 'Every cohort behaves the same', why: `By M2, January kept ${pc(retained(COHORTS[0].churn, 2), 0)} and April ${pc(retained(COHORTS[3].churn, 2), 0)}.` },
      ],
      hint: 'Compare cohorts at the same age: read down one column.',
      explain: `At M3: ${COHORTS.slice(0, 3).map((c) => `${c.name} ${pc(retained(c.churn, 3), 0)}`).join(', ')}. Each newer cohort holds on better, so something (the product, onboarding, the kind of customer) is improving.`,
    },
    {
      kind: 'choice',
      body: `A gym app loses **5% of its members each month**. Its investor deck says "**annual churn: ${pc(0.05 * 12)}**". What share of members does it really lose over a year?`,
      options: [
        { text: `About ${pc(annual(0.05), 0)}`, correct: true },
        { text: pc(0.05 * 12), why: '5% × 12 assumes each month takes 5% of the original members. It takes 5% of those left, a shrinking group.' },
        { text: '5%', why: 'That is one month.' },
        { text: `About ${pc(1 - 0.05)}`, why: 'That is the share who stay for one month.' },
      ],
      hint: 'The share staying all year is 0.95¹².',
      explain: `0.95¹² = ${pc(retained(0.05, 12), 0)} stay, so **${pc(annual(0.05), 0)}** leave. (Still a lot: monthly churn compounds just like interest.)`,
    },
    {
      kind: 'number', unit: '%',
      body: 'A service has **3% monthly churn**. What is its annual churn: the share of customers at the start of the year who have left by the end?',
      answer: annual(0.03) * 100, tol: 0.3,
      hint: '1 − 0.97¹².',
      explain: `0.97¹² = ${pc(retained(0.03, 12))} stay, so **${pc(annual(0.03))}** leave.`,
    },
    {
      kind: 'read',
      title: 'Expansion can beat churn',
      body: `Customers who stay can also **spend more** (more seats, a bigger plan). **Net revenue retention** compares what last year's customers pay now with what they paid then.\n\nA year ago a cohort paid ${money(NRR.start)} a month. Cancellations took away ${money(NRR.lost)}; upgrades added ${money(NRR.up)}. Now it pays ${money(NRR.start - NRR.lost + NRR.up)}: NRR ${pc((NRR.start - NRR.lost + NRR.up) / NRR.start)}. Above 100%, the business grows even with no new customers at all.`,
      widget: () => barChart([
        { label: 'A year ago', value: NRR.start, color: 'var(--c2)' },
        { label: 'Cancelled', value: NRR.lost, color: 'var(--bad)' },
        { label: 'Upgrades', value: NRR.up, color: 'var(--c3)' },
        { label: 'Now', value: NRR.start - NRR.lost + NRR.up, color: 'var(--c1)' },
      ], { format: money }),
    },
    {
      kind: 'number', unit: '%',
      body: `Last year's customers paid **${money(NRR2.start)}** a month. Since then cancellations cost **${money(NRR2.lost)}**, downgrades **${money(NRR2.down)}**, and upgrades added **${money(NRR2.up)}**. What is the net revenue retention?`,
      answer: ((NRR2.start - NRR2.lost - NRR2.down + NRR2.up) / NRR2.start) * 100, tol: 0.1,
      hint: 'What those customers pay now ÷ what they paid then.',
      explain: `${money(NRR2.start)} − ${money(NRR2.lost)} − ${money(NRR2.down)} + ${money(NRR2.up)} = ${money(NRR2.start - NRR2.lost - NRR2.down + NRR2.up)}; ÷ ${money(NRR2.start)} = **${pc((NRR2.start - NRR2.lost - NRR2.down + NRR2.up) / NRR2.start)}**. Below 100%: new customers must first replace the lost revenue.`,
    },
    {
      kind: 'order',
      body: 'Order these apps by the size they will level off at, **largest first**.',
      items: APPS.map((a) => `${a.name}: ${count(a.add)} new a month, ${pc(a.churn)} churn`),
      hint: 'New ÷ churn for each.',
      explain: APPS.map((a) => `${a.name}: ${count(a.ceil)}`).join('; ') + '. The app with the fewest sign-ups but the lowest churn can end up the biggest.',
    },
  ],
  practice: [genCeiling, genCohortLeft, genAnnualChurn],
};

// ================================================================ lesson 8: valuing a business

const VEND = { cf: 1000, r: 0.05 };
const VEND_V = perpetuity(VEND.cf, VEND.r);
const PV1 = { cf: 10000, r: 0.08, n: 3 };
const TEN = { cf: 1000, r: 0.05, n: 10 };
const TEN_V = Array.from({ length: TEN.n }, (_, k) => pv(TEN.cf, TEN.r, k + 1)).reduce((a, b) => a + b, 0);
const CAFE_V = { cf: 50000, r: 0.1 };
const GROW = { cf: 50000, r: 0.1, target: 1000000 };
const GROW_G = GROW.r - GROW.cf / GROW.target;
const PE = { price: 50, eps: 2 };
const IMPLIED = { pe: 20, r: 0.08 };

const genPV: Generator = (rng) => {
  const cf = randInt(rng, 1, 20) * 1000, r = pick(rng, [0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12]), n = randInt(rng, 2, 15);
  const v = pv(cf, r, n);
  return {
    kind: 'number', unit: '$',
    body: `You will receive **${money(cf)}** in **${n} years**. If you could earn **${pc(r)} a year** elsewhere, what is that payment worth today?`,
    answer: v, tol: Math.max(1, v * 0.005),
    hint: `Divide by ${1 + r}, once for each year.`,
    explain: `${money(cf)} ÷ ${1 + r}^${n} = **${dollars(v)}**: invest that today at ${pc(r)} and it grows to ${money(cf)} in ${n} years.`,
  };
};

const genPerp: Generator = (rng) => {
  const cf = randInt(rng, 2, 40) * 5000, r = pick(rng, [0.06, 0.08, 0.1, 0.12, 0.15]);
  const g = pick(rng, [0, 0, 0.01, 0.02, 0.03, 0.04].filter((x) => x < r - 0.02));
  const v = perpetuity(cf, r, g);
  return {
    kind: 'number', unit: '$',
    body: `A laundrette produces **${money(cf)}** of cash for its owner next year${g ? `, and that cash should grow **${pc(g)} a year** after that` : ', and the same every year after'}. A buyer wants a **${pc(r)}** return. What is the most the buyer should pay?`,
    answer: v, tol: Math.max(1, v * 0.005),
    hint: g ? 'Cash ÷ (required return − growth).' : 'Cash ÷ required return.',
    explain: `${money(cf)} ÷ ${g ? `(${num2(r)} − ${num2(g)})` : num2(r)} = **${dollars(v)}**${g ? `, ${num2(1 / (r - g))} years of cash` : `, ${num2(1 / r)} years of cash`}.`,
  };
};

const genPE: Generator = (rng) => {
  const kind = pick(rng, ['pe', 'price', 'growth'] as const);
  if (kind === 'growth') {
    const pe = pick(rng, [10, 12.5, 20, 25, 40, 50]), r = pick(rng, [0.06, 0.07, 0.08, 0.09, 0.1]);
    const g = r - 1 / pe;
    return {
      kind: 'number', unit: '%',
      body: `A company pays out all its earnings. Investors want a **${pc(r)} a year** return, and the shares trade at a **P/E of ${pe}**. What steady yearly growth in earnings does that price assume? (Negative if it assumes a decline.)`,
      answer: g * 100, tol: 0.05,
      hint: 'P/E = 1 ÷ (r − g), so r − g = 1 ÷ P/E.',
      explain: `1 ÷ ${pe} = ${pc(1 / pe)} earnings yield. Growth = ${pc(r)} − ${pc(1 / pe)} = **${pc(g, 2)}** a year.`,
    };
  }
  const eps = randInt(rng, 2, 40) / 4, pe = pick(rng, [8, 10, 12, 15, 18, 20, 25, 30, 40]);
  const price = eps * pe;
  if (kind === 'pe') return {
    kind: 'number', unit: '×',
    body: `A share costs **${money(price)}**, and the company earned **${money(eps)} per share** last year. What is its P/E ratio?`,
    answer: pe, tol: 0.01,
    hint: 'Price ÷ earnings per share.',
    explain: `${money(price)} ÷ ${money(eps)} = **${pe}**: buyers pay ${money(pe)} for each $1 of yearly earnings (an earnings yield of ${pc(1 / pe)}).`,
  };
  return {
    kind: 'number', unit: '$',
    body: `A company earns **${money(eps)} per share**. Similar companies trade at a **P/E of ${pe}**. At that multiple, what would one share be worth?`,
    answer: price, tol: 0.01,
    hint: 'Earnings per share × P/E.',
    explain: `${money(eps)} × ${pe} = **${money(price)}**.`,
  };
};

const lessonValue: Lesson = {
  id: 'valuation',
  title: 'Valuing a business',
  goal: 'Discount future cash to today, value a steady business, and read what a P/E ratio implies.',
  steps: [
    {
      kind: 'choice',
      body: `You are offered a vending machine that will make **${money(VEND.cf)} a year** of cash, after all costs, **forever**. Your money could otherwise earn **${pc(VEND.r)} a year** safely. What is the most you should pay for it?`,
      options: [
        { text: money(VEND_V), correct: true },
        { text: 'Any price: it pays forever', why: `Money far in the future is worth little today. At ${pc(VEND.r)}, ${money(VEND_V)} in the bank pays the same ${money(VEND.cf)} a year forever, so paying more makes no sense.` },
        { text: money(VEND.cf * 10), why: 'Ten years of income is a rule of thumb, not a calculation. What matters is what the same money would earn elsewhere.' },
        { text: money(perpetuity(VEND.cf, VEND.r / 2.5)), why: `That price earns only ${pc(VEND.r / 2.5)} a year: less than your safe ${pc(VEND.r)}.` },
      ],
      hint: `How much would you need in the bank at ${pc(VEND.r)} to get ${money(VEND.cf)} a year?`,
      explain: `${money(VEND.cf)} ÷ ${VEND.r} = **${money(VEND_V)}**. Pay that and the machine earns you exactly ${pc(VEND.r)}; pay less and it beats the bank.`,
    },
    {
      kind: 'read',
      title: 'A dollar later is worth less',
      body: `${money(1000)} next year is worth ${money(1000)} ÷ ${1 + VEND.r} = ${dollars(pv(1000, VEND.r, 1))} today, because ${dollars(pv(1000, VEND.r, 1))} invested at ${pc(VEND.r)} becomes ${money(1000)}. Each further year divides by ${1 + VEND.r} again. This is **discounting**: the **present value** of cash in n years is cash ÷ (1 + r)ⁿ.\n\nAdd up every year forever and you get cash ÷ r.`,
      widget: () => plotEl({
        x: [0, 41], y: [0, 1050], xlabel: 'year', ylabel: 'today’s value of $1,000', size: [400, 250], ticks: [5, 200],
        layers: [{ type: 'bars', width: 0.8, color: 'var(--c1)', pts: Array.from({ length: 40 }, (_, k) => [k + 1, pv(1000, VEND.r, k + 1)] as [number, number]) }],
      }),
    },
    {
      kind: 'number', unit: '$',
      body: `A customer promises to pay **${money(PV1.cf)}** in **${PV1.n} years**. At **${pc(PV1.r)} a year**, what is that promise worth today?`,
      answer: pv(PV1.cf, PV1.r, PV1.n), tol: 2,
      hint: `${money(PV1.cf)} ÷ ${1 + PV1.r}³.`,
      explain: `${money(PV1.cf)} ÷ ${1 + PV1.r}^${PV1.n} = **${dollars(pv(PV1.cf, PV1.r, PV1.n))}**.`,
    },
    {
      kind: 'estimate',
      body: `Now a machine that pays **${money(TEN.cf)} a year for ${TEN.n} years**, then breaks. At ${pc(TEN.r)}, estimate its value today.`,
      min: 0, max: 20000, step: 100, answer: Math.round(TEN_V / 100) * 100, tol: 600, format: dollars,
      hint: `Less than the ${money(TEN.cf * TEN.n)} it pays in total, since later years are discounted.`,
      explain: `Ten discounted payments: ${dollars(pv(TEN.cf, TEN.r, 1))} + ${dollars(pv(TEN.cf, TEN.r, 2))} + … + ${dollars(pv(TEN.cf, TEN.r, TEN.n))} = **${dollars(TEN_V)}**. That is ${pc(TEN_V / VEND_V, 0)} of the forever machine's ${money(VEND_V)}: the first ten years carry most of the value.`,
    },
    {
      kind: 'number', unit: '$',
      body: `A café makes its owner **${money(CAFE_V.cf)} a year** of cash, steadily, with no growth. A buyer wants a **${pc(CAFE_V.r)}** return. What is the café worth to the buyer?`,
      answer: perpetuity(CAFE_V.cf, CAFE_V.r), tol: 1,
      hint: 'Cash ÷ required return.',
      explain: `${money(CAFE_V.cf)} ÷ ${CAFE_V.r} = **${money(perpetuity(CAFE_V.cf, CAFE_V.r))}**, ${num2(1 / CAFE_V.r)} years of cash. A riskier business needs a higher return, so it is worth less for the same cash.`,
    },
    {
      kind: 'read',
      title: 'Growth',
      body: 'If the cash grows by **g** a year forever, the value is **cash ÷ (r − g)**. As g gets close to r the value shoots up, which is why small changes in expected growth swing valuations so much.',
      widget: plotExplorer({
        params: [{ id: 'r', label: 'required return', min: 6, max: 14, step: 1, value: 10, format: (x) => `${x}%` }],
        spec: (v) => ({
          x: [0, 9], y: [0, 2500], xlabel: 'growth g, %', ylabel: 'value, $ thousands', size: [400, 250], ticks: [1, 500],
          layers: [{ type: 'fn', f: (g) => (g < v.r - 0.2 ? perpetuity(GROW.cf, v.r / 100, g / 100) / 1000 : NaN), color: 'var(--c1)', label: `${money(GROW.cf)} a year` }],
        }),
        readout: (v) => `At ${v.r}%: no growth ${dollars(perpetuity(GROW.cf, v.r / 100))}; 3% growth ${dollars(perpetuity(GROW.cf, v.r / 100, 0.03))}`,
      }),
    },
    {
      kind: 'task',
      title: 'What growth is priced in?',
      body: `A buyer offers **${money(GROW.target)}** for a business making **${money(GROW.cf)}** a year of cash, wanting a **${pc(GROW.r)}** return. Find the yearly growth rate that makes the offer fair.`,
      widget: explorer({
        params: [{ id: 'g', label: 'growth', min: 0, max: 8, step: 1, value: 0, format: (x) => `${x}%` }],
        draw: (v) => barChart([
          { label: 'Offer', value: GROW.target, color: 'var(--muted)' },
          { label: 'Value', value: perpetuity(GROW.cf, GROW.r, v.g / 100), color: 'var(--c1)' },
        ], { max: perpetuity(GROW.cf, GROW.r, 0.08), format: dollars }),
        readout: (v) => `${money(GROW.cf)} ÷ (${pc(GROW.r)} − ${v.g}%) = ${dollars(perpetuity(GROW.cf, GROW.r, v.g / 100))}`,
        goal: (v) => Math.abs(perpetuity(GROW.cf, GROW.r, v.g / 100) - GROW.target) < 1,
        goalText: 'The price assumes that growth, forever.',
      }),
      hint: `You need r − g = ${money(GROW.cf)} ÷ ${money(GROW.target)}.`,
      explain: `${money(GROW.cf)} ÷ ${money(GROW.target)} = ${pc(GROW.cf / GROW.target)} = r − g, so g = **${pc(GROW_G)}** a year, forever. Paying the price means betting on that growth.`,
    },
    {
      kind: 'read',
      title: 'Multiples',
      body: 'Buyers often shortcut all this with a **multiple**. For shares the best known is the **P/E ratio**: share price ÷ yearly earnings per share. A P/E of 20 means paying $20 for each $1 a year of profit; flipped, that\'s a ' + pc(1 / 20) + ' **earnings yield**.\n\nA multiple is a valuation with the assumptions hidden: if all earnings were paid out, P/E = 1 ÷ (r − g). A high P/E means investors expect growth (or see little risk).',
    },
    {
      kind: 'number', unit: '×',
      body: `A share trades at **${money(PE.price)}**. Last year the company earned **${money(PE.eps)} per share**. What is its P/E?`,
      answer: PE.price / PE.eps, tol: 0.01,
      hint: 'Price ÷ earnings per share.',
      explain: `${money(PE.price)} ÷ ${money(PE.eps)} = **${PE.price / PE.eps}**. Buyers pay ${money(PE.price / PE.eps)} for every $1 of yearly earnings.`,
    },
    {
      kind: 'number', unit: '%',
      body: `What is the **earnings yield** of that share (earnings ÷ price)?`,
      answer: (PE.eps / PE.price) * 100, tol: 0.05,
      hint: '1 ÷ P/E.',
      explain: `${money(PE.eps)} ÷ ${money(PE.price)} = **${pc(PE.eps / PE.price)}** a year: below what many safe investments pay, so the price only makes sense if earnings are expected to grow.`,
    },
    {
      kind: 'choice',
      body: 'Two companies in the same industry: one trades at a **P/E of 10**, the other at **30**. What does the higher P/E most likely tell you?',
      options: [
        { text: 'Investors expect its earnings to grow faster (or see it as safer)', correct: true },
        { text: 'It is three times as profitable', why: 'P/E says nothing about the size of profits: it compares price with profit. A tiny company can have a huge P/E.' },
        { text: 'It is a worse investment: it costs three times as much per dollar of profit', why: 'Only if the growth doesn\'t arrive. If earnings grow fast, today\'s high P/E may be cheap; if not, it is expensive.' },
      ],
      explain: `Since P/E ≈ 1 ÷ (r − g), a P/E of 30 implies r − g ≈ ${pc(1 / 30)}, against ${pc(1 / 10)} at P/E 10: more growth, a lower required return, or both are priced in.`,
    },
    {
      kind: 'number', unit: '%',
      body: `A company pays out all its earnings and trades at a **P/E of ${IMPLIED.pe}**. Investors want **${pc(IMPLIED.r)} a year**. What steady growth in earnings does the price assume?`,
      answer: (IMPLIED.r - 1 / IMPLIED.pe) * 100, tol: 0.05,
      hint: 'P/E = 1 ÷ (r − g). So r − g = 1 ÷ P/E.',
      explain: `1 ÷ ${IMPLIED.pe} = ${pc(1 / IMPLIED.pe)}, so g = ${pc(IMPLIED.r)} − ${pc(1 / IMPLIED.pe)} = **${pc(IMPLIED.r - 1 / IMPLIED.pe)}** a year, forever.`,
    },
    {
      kind: 'match',
      body: 'Match each idea to what it means.',
      heads: ['Idea', 'Meaning'],
      pairs: [
        ['Present value', 'Future cash ÷ (1 + r)ⁿ'],
        ['Required return', 'What the money could earn elsewhere, at similar risk'],
        ['Cash ÷ (r − g)', 'Value of cash growing at g forever'],
        ['P/E ratio', 'Share price ÷ yearly earnings per share'],
      ],
      explain: 'Every valuation is future cash, discounted at the return you could get elsewhere. Multiples like P/E are the same idea compressed into one number.',
    },
  ],
  practice: [genPV, genPerp, genPE],
};

export const business: Course = {
  id: 'business',
  title: 'Business by the Numbers',
  blurb: 'Costs, margins, break-even, unit economics, pricing, cash flow, churn and valuation, worked from a café, a shop and an app.',
  color: COLOR,
  icon: '🏪',
  lessons: [lessonProfit, lessonMargins, lessonBreakEven, lessonUnits, lessonPricing, lessonCash, lessonChurn, lessonValue],
};
