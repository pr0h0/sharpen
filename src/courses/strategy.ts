// Strategy & Game Theory: working backwards, sequential games, dominance, the prisoner's dilemma,
// Nash equilibrium, mixed strategies, repeated games and auctions.
import type { Choice, Course, Generator, Rng } from '../types';
import {
  PD, STRATEGIES, auction, dominant, match, matrix, mixSlider, noTies, pdPlay, positions, pureNash, rps, takeAway,
  tournamentWidget, tree,
} from '../widgets/strategy';
import type { Game, Move, Strategy, TreeNode } from '../widgets/strategy';
import { pct, pick, randInt } from '../ui';

// ---------------------------------------------------------------- shared games

const festival: Game = {
  rows: ['Main stage', 'Food tent'], cols: ['Main stage', 'Food tent'],
  pay: [[[2, 2], [0, 0]], [[0, 0], [1, 1]]],
};

const pdGame: Game = {
  rows: ['Cooperate', 'Defect'], cols: ['Cooperate', 'Defect'],
  pay: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]],
};

const stagHunt: Game = {
  rows: ['Stag', 'Hare'], cols: ['Stag', 'Hare'],
  pay: [[[4, 4], [0, 3]], [[3, 0], [3, 3]]],
};

const pennies: Game = {
  rows: ['Kick left', 'Kick right'], cols: ['Dive left', 'Dive right'],
  pay: [[[0, 1], [1, 0]], [[1, 0], [0, 1]]],
  names: ['Kicker', 'Keeper'],
};

const domGame: Game = {
  rows: ['Up', 'Down'], cols: ['Left', 'Right'],
  pay: [[[5, 1], [3, 4]], [[2, 3], [1, 2]]],
};

const elimGame: Game = {
  rows: ['Top', 'Middle', 'Bottom'], cols: ['Left', 'Centre', 'Right'],
  pay: [
    [[4, 3], [5, 1], [6, 2]],
    [[2, 1], [8, 4], [3, 6]],
    [[3, 0], [9, 6], [2, 8]],
  ],
};

const threeByThree: Game = {
  rows: ['Top', 'Middle', 'Bottom'], cols: ['Left', 'Centre', 'Right'],
  pay: [
    [[0, 4], [4, 0], [5, 3]],
    [[4, 0], [0, 4], [5, 3]],
    [[3, 5], [3, 5], [6, 6]],
  ],
};

const adsGame: Game = {
  rows: ['Advertise', 'Don’t'], cols: ['Advertise', 'Don’t'],
  pay: [[[3, 3], [8, 2]], [[2, 8], [6, 6]]],
  names: ['You', 'Rival'],
};

const cafeTree: TreeNode = {
  p: 1, moves: [
    { label: 'Stay out', to: { pay: [10, 0] } },
    { label: 'Enter', to: { p: 0, moves: [{ label: 'Fight', to: { pay: [2, -1] } }, { label: 'Share', to: { pay: [5, 3] } }] } },
  ],
};

const lrTree: TreeNode = {
  p: 0, moves: [
    { label: 'Left', to: { p: 1, moves: [{ label: 'Up', to: { pay: [4, 1] } }, { label: 'Down', to: { pay: [0, 2] } }] } },
    { label: 'Right', to: { p: 1, moves: [{ label: 'Up', to: { pay: [2, 3] } }, { label: 'Down', to: { pay: [3, 1] } }] } },
  ],
};

const centipede: TreeNode = {
  p: 0, moves: [
    { label: 'Take', to: { pay: [2, 1] } },
    { label: 'Pass', to: { p: 1, moves: [
      { label: 'Take', to: { pay: [1, 4] } },
      { label: 'Pass', to: { p: 0, moves: [
        { label: 'Take', to: { pay: [8, 2] } },
        { label: 'Pass', to: { p: 1, moves: [
          { label: 'Take', to: { pay: [4, 16] } },
          { label: 'Pass', to: { pay: [32, 8] } },
        ] } },
      ] } },
    ] } },
  ],
};

// ---------------------------------------------------------------- generator helpers

/** A random 2×2 game in which nobody is ever indifferent between their two moves. */
function random2x2(rng: Rng, rows: string[], cols: string[], lo = 0, hi = 9): Game {
  for (;;) {
    const v = () => randInt(rng, lo, hi);
    const g: Game = { rows, cols, pay: [[[v(), v()], [v(), v()]], [[v(), v()], [v(), v()]]] };
    if (noTies(g)) return g;
  }
}

/** The payoffs written out, so the problem reads without the table too. */
function payLine(g: Game): string {
  const cells: string[] = [];
  g.rows.forEach((r, i) => g.cols.forEach((c, j) => cells.push(`${r}/${c}: ${g.pay[i][j][0]}, ${g.pay[i][j][1]}`)));
  return `(${g.names?.[0] ?? 'You'} pick${g.names ? 's' : ''} the row, ${g.names?.[1] ?? 'they'} pick${g.names ? 's' : ''} the column. ${cells.join(' · ')}.)`;
}

const SCENES: [string[], string[]][] = [
  [['Up', 'Down'], ['Left', 'Right']],
  [['High price', 'Low price'], ['High price', 'Low price']],
  [['Attack', 'Defend'], ['Attack', 'Defend']],
  [['Invest', 'Wait'], ['Invest', 'Wait']],
  [['North', 'South'], ['East', 'West']],
];

// ---------------------------------------------------------------- practice generators

const genTakeMove: Generator = (rng) => {
  const k = randInt(rng, 2, 5);
  let n = randInt(rng, 9, 40);
  if (n % (k + 1) === 0) n += randInt(rng, 1, k);
  const t = n % (k + 1);
  return {
    kind: 'number',
    body: `A pile of **${n}** counters. Players take turns removing 1 to ${k}; whoever takes the last counter wins. It's your move. How many do you take to be sure of winning?`,
    answer: t, tol: 0,
    hint: `Losing positions for the player to move are the multiples of ${k + 1}. Leave your opponent on one.`,
    explain: `Multiples of ${k + 1} are losing for whoever has to move: whatever they take, you top the round up to ${k + 1}. ${n} = ${k + 1} × ${Math.floor(n / (k + 1))} + ${t}, so take ${t} and leave ${n - t}.`,
  };
};

const genFirstOrSecond: Generator = (rng) => {
  const k = randInt(rng, 2, 6);
  const n = rng() < 0.5 ? (k + 1) * randInt(rng, 3, 8) : randInt(rng, 10, 50);
  const lose = n % (k + 1) === 0;
  return {
    kind: 'choice',
    body: `A pile of **${n}** counters; take 1 to ${k} per turn; whoever takes the last counter wins. Your opponent plays perfectly and lets you choose: go first or second?`,
    options: [
      { text: 'Go first', correct: !lose, why: lose ? `${n} is a multiple of ${k + 1}, a losing position for whoever moves. Whatever you take, they bring it back to a multiple of ${k + 1}.` : undefined },
      { text: 'Go second', correct: lose, why: lose ? undefined : `${n} isn't a multiple of ${k + 1}, so the player to move can take ${n % (k + 1)} and leave a losing position. That should be you.` },
      { text: 'It makes no difference', why: 'Every position is either winning or losing for the player to move, so one choice wins for sure.' },
    ],
    ordered: true,
    explain: lose
      ? `${n} = ${k + 1} × ${n / (k + 1)}: losing for the player to move. Go second, and answer every take of x with ${k + 1} − x.`
      : `${n} leaves remainder ${n % (k + 1)} when divided by ${k + 1}. Go first, take ${n % (k + 1)}, then keep each round summing to ${k + 1}.`,
  };
};

const genTree: Generator = (rng) => {
  for (;;) {
    const v = () => randInt(rng, 0, 9);
    const leaves: [number, number][] = [[v(), v()], [v(), v()], [v(), v()], [v(), v()]];
    // No ties for the deciders, so the answer is unique.
    if (leaves[0][1] === leaves[1][1] || leaves[2][1] === leaves[3][1]) continue;
    const a = leaves[0][1] > leaves[1][1] ? leaves[0] : leaves[1];
    const b = leaves[2][1] > leaves[3][1] ? leaves[2] : leaves[3];
    if (a[0] === b[0]) continue;
    const res = a[0] > b[0] ? a : b;
    const t: TreeNode = {
      p: 0, moves: [
        { label: 'Left', to: { p: 1, moves: [{ label: 'Up', to: { pay: leaves[0] } }, { label: 'Down', to: { pay: leaves[1] } }] } },
        { label: 'Right', to: { p: 1, moves: [{ label: 'Up', to: { pay: leaves[2] } }, { label: 'Down', to: { pay: leaves[3] } }] } },
      ],
    };
    return {
      kind: 'number',
      body: `You choose Left or Right, then they see your move and choose Up or Down. Payoffs are (you, them): Left-Up ${leaves[0].join(', ')} · Left-Down ${leaves[1].join(', ')} · Right-Up ${leaves[2].join(', ')} · Right-Down ${leaves[3].join(', ')}. Both of you play to maximise your own payoff. **What payoff do you end up with?**`,
      widget: tree(t),
      answer: res[0], tol: 0,
      hint: 'Start at the bottom: what would they pick after Left? After Right? Then choose the better of those two for you.',
      explain: `After Left they pick ${a === leaves[0] ? 'Up' : 'Down'} (${a[1]} for them), giving you ${a[0]}. After Right they pick ${b === leaves[2] ? 'Up' : 'Down'} (${b[1]}), giving you ${b[0]}. So you go ${res === a ? 'Left' : 'Right'} and get ${res[0]}.`,
    };
  }
};

const genEntry: Generator = (rng) => {
  const out = randInt(rng, 8, 14);
  const share = randInt(rng, 3, out - 2);
  const fightBetter = rng() < 0.5;
  const fight = fightBetter ? share + randInt(rng, 1, 3) : randInt(rng, 0, share - 1);
  const eShare = randInt(rng, 2, 6), eFight = -randInt(rng, 1, 4);
  const shop = pick(rng, ['bakery', 'bike shop', 'gym', 'bookshop', 'pizzeria']);
  return {
    kind: 'choice',
    body: `A rival thinks about opening a ${shop} next to yours. If they stay out, they get 0 and you get ${out}. If they enter, you choose: **fight** a price war (you ${fight}, them ${eFight}) or **share** the market (you ${share}, them ${eShare}). Everyone knows these numbers. What happens?`,
    options: [
      { text: 'They enter and you share', correct: !fightBetter, why: fightBetter ? `Once they're in, fighting gives you ${fight} against ${share} for sharing, so you'd fight. Knowing that, they stay out.` : undefined },
      { text: 'They stay out', correct: fightBetter, why: fightBetter ? undefined : `Your threat isn't credible: once they've entered, sharing (${share}) beats fighting (${fight}) for you. They know it, so they enter.` },
      { text: 'They enter and you fight', why: fightBetter ? `If you'd really fight, entering gives them ${eFight}, worse than 0. So they stay out.` : `Fighting gives you ${fight}, less than sharing (${share}). You wouldn't.` },
    ],
    explain: fightBetter
      ? `Work backwards: after entry you'd fight (${fight} > ${share}), leaving them with ${eFight}. Staying out (0) is better for them, so they stay out.`
      : `Work backwards: after entry you'd share (${share} > ${fight}), giving them ${eShare} > 0. So they enter, and you share.`,
  };
};

const genDominant: Generator = (rng) => {
  const [rows, cols] = pick(rng, SCENES);
  const g = random2x2(rng, rows, cols);
  const player = rng() < 0.5 ? 0 : 1;
  const moves = player === 0 ? rows : cols;
  const d = dominant(g, player);
  const who = player === 0 ? 'you (rows)' : 'they (columns)';
  const val = (m: number, o: number) => (player === 0 ? g.pay[m][o][0] : g.pay[o][m][1]);
  const others = player === 0 ? cols : rows;
  const compare = others.map((o, oi) => `against ${o}: ${moves[0]} ${val(0, oi)}, ${moves[1]} ${val(1, oi)}`).join('; ');
  const opts: Choice[] = moves.map((m, i) => ({
    text: m, correct: d === i,
    why: d === i ? undefined : d === -1 ? `It isn't better whatever the other side does: ${compare}.` : `${m} is worse in every case: ${compare}.`,
  }));
  opts.push({ text: 'Neither: it depends', correct: d === -1, why: d === -1 ? undefined : `${moves[d]} is better whatever the other side does: ${compare}.` });
  return {
    kind: 'choice',
    body: `Does **${who === 'you (rows)' ? 'the row player (you)' : 'the column player (them)'}** have a dominant move here? ${payLine(g)}`,
    widget: matrix(g),
    options: opts,
    ordered: true,
    hint: `Compare ${player === 0 ? 'your (blue)' : 'their (orange)'} payoffs one ${player === 0 ? 'column' : 'row'} at a time.`,
    explain: d === -1
      ? `No dominant move: ${compare}. The best choice depends on what the other side does.`
      : `${moves[d]} wins in every case (${compare}), so it's dominant.`,
  };
};

const genPDFine: Generator = (rng) => {
  {
    const S = randInt(rng, 0, 2), P = S + randInt(rng, 1, 3), R = P + randInt(rng, 1, 4), T = R + randInt(rng, 1, 4);
    const x = Math.max(T - R, P - S) + 1;
    return {
      kind: 'number',
      body: `A prisoner's dilemma, in points per player: both cooperate ${R} each; both defect ${P} each; a defector facing a cooperator gets ${T}, the cooperator ${S}. A referee fines anyone who defects. What's the **smallest whole-number fine** that makes cooperating strictly better for each player, whatever the other does?`,
      answer: x, tol: 0,
      hint: 'Check both cases: the other cooperates, the other defects. Defecting must be worse after the fine in each.',
      explain: `If the other cooperates: ${R} for cooperating vs ${T} − fine for defecting, so the fine must beat ${T - R}. If the other defects: ${S} vs ${P} − fine, so it must beat ${P - S}. Smallest whole fine above both: ${x}.`,
    };
  }
};

const genPDOutcome: Generator = (rng) => {
  const S = randInt(rng, 0, 2), P = S + randInt(rng, 1, 3), R = P + randInt(rng, 1, 5), T = R + randInt(rng, 1, 4);
  const lost = rng() < 0.5;
  return {
    kind: 'number',
    body: `Two players each choose to cooperate or defect. Both cooperate: ${R} points each. Both defect: ${P} each. One defects: the defector gets ${T}, the cooperator ${S}. Both are rational and only care about their own points. ${lost ? 'How many points does **each player lose**, compared with both cooperating?' : 'How many points does **each player** end up with?'}`,
    answer: lost ? R - P : P, tol: 0,
    explain: `Defecting is dominant (${T} > ${R} if they cooperate, ${P} > ${S} if they defect), so both defect and get ${P} each${lost ? `, ${R - P} less than the ${R} each they'd get by cooperating` : ` instead of ${R}`}.`,
  };
};

const genNashCount: Generator = (rng) => {
  const [rows, cols] = pick(rng, SCENES);
  const g = random2x2(rng, rows, cols);
  const ne = pureNash(g);
  return {
    kind: 'number',
    body: `How many **pure Nash equilibria** does this game have? ${payLine(g)}`,
    widget: matrix(g, { mode: 'best' }),
    answer: ne.length, tol: 0,
    hint: 'Turn on both sets of best responses. A cell is an equilibrium when both payoffs in it are best responses.',
    explain: ne.length
      ? `${ne.map(([r, c]) => `${rows[r]}/${cols[c]}`).join(' and ')}: in ${ne.length === 1 ? 'that cell' : 'each'}, neither player gains by switching alone. In every other cell somebody wants to move.`
      : 'None: in every cell at least one player would rather switch. Games like this need mixed strategies (lesson 6).',
  };
};

const genNashTap: Generator = (rng) => {
  const [rows, cols] = pick(rng, SCENES);
  let g = random2x2(rng, rows, cols);
  while (pureNash(g).length === 0) g = random2x2(rng, rows, cols);
  const ne = pureNash(g);
  return {
    kind: 'task',
    body: `Tap **every** pure Nash equilibrium (there may be more than one). ${payLine(g)}`,
    widget: matrix(g, { mode: 'nash' }),
    hint: 'For each cell ask: would the row player switch rows? Would the column player switch columns?',
    explain: `${ne.map(([r, c]) => `${rows[r]}/${cols[c]}`).join(' and ')}: there neither player gains by switching alone.`,
  };
};

const genMixShare: Generator = (rng) => {
  const w = pick(rng, [0.9, 1]);
  const a = randInt(rng, 4, 8) / 10;
  const b = randInt(rng, 1, Math.round(a * 10) - 1) / 10;
  const p = (w - b) / (2 * w - a - b);
  const v = p * a + (1 - p) * w;
  const askValue = rng() < 0.4;
  return {
    kind: 'number', prob: true,
    body: `A penalty taker scores ${pct(w, 0)} of the time when the keeper dives the wrong way. When the keeper guesses right, she scores ${pct(a, 0)} on her strong side (left) but only ${pct(b, 0)} on her weak side (right). ${askValue ? 'If she mixes so the keeper can’t exploit her, **what share of her penalties go in**?' : '**How often should she shoot left** so the keeper can’t exploit her?'}`,
    answer: askValue ? v : p, tol: 0.01,
    hint: `Call her chance of shooting left p. If the keeper dives left she scores p × ${a} + (1 − p) × ${w}; if he dives right, p × ${w} + (1 − p) × ${b}. Make them equal.`,
    explain: `Equal scoring whichever way the keeper dives: p × ${a} + (1 − p) × ${w} = p × ${w} + (1 − p) × ${b}, so p = ${pct(p)}. Then she scores ${pct(v)} whatever the keeper does.`,
  };
};

const genRPSBest: Generator = (rng) => {
  for (;;) {
    const r = randInt(rng, 2, 12) * 5, p = randInt(rng, 2, 12) * 5, s = 100 - r - p;
    if (s < 5) continue;
    const ev = [s - p, r - s, p - r]; // net wins per 100 for rock, paper, scissors
    const mx = Math.max(...ev);
    if (ev.filter((x) => x === mx).length !== 1) continue;
    const names = ['Rock', 'Paper', 'Scissors'];
    const best = ev.indexOf(mx);
    const line = (i: number) => `${names[i]} wins ${[s, r, p][i]}% and loses ${[p, s, r][i]}%: net ${ev[i] > 0 ? '+' : ''}${ev[i]}`;
    return {
      kind: 'choice',
      body: `Your opponent at rock–paper–scissors plays rock ${r}%, paper ${p}% and scissors ${s}% of the time, at random. Which single move should you always play against them?`,
      options: names.map((n, i) => ({ text: n, correct: i === best, why: i === best ? undefined : `${line(i)}, but ${line(best).toLowerCase()}.` })),
      ordered: true,
      hint: 'For each move: how often does it win, and how often does it lose?',
      explain: `${[0, 1, 2].map(line).join('. ')}. ${names[best]} has the best balance, even if it doesn't beat their favourite move.`,
    };
  }
};

const genRounds: Generator = (rng) => {
  const d = pick(rng, [0.5, 0.75, 0.8, 0.9, 0.95, 0.98, 0.99]);
  return {
    kind: 'number',
    body: `After each round of a repeated game there's a ${pct(d, 0)} chance of another round. On average, how many rounds will be played (counting the first)?`,
    answer: 1 / (1 - d), tol: 0.05, unit: 'rounds',
    hint: `Each round has a ${pct(1 - d, 0)} chance of being the last.`,
    explain: `A ${pct(1 - d, 0)} chance of stopping each round means 1 ÷ ${+(1 - d).toFixed(2)} = ${Math.round(1 / (1 - d))} rounds on average. The higher the chance of continuing, the longer the shadow of the future.`,
  };
};

const PLANS: { name: string; s: (n: number) => Strategy }[] = [
  { name: 'always cooperate', s: () => ({ name: 'C', move: () => 'C' }) },
  { name: 'always defect', s: () => ({ name: 'D', move: () => 'D' }) },
  { name: 'cooperate every round except the last, then defect', s: (n) => ({ name: 'L', move: (m) => (m.length === n - 1 ? 'D' : 'C') }) },
  { name: 'defect in the first round, then cooperate', s: () => ({ name: 'F', move: (m) => (m.length === 0 ? 'D' : 'C') }) },
  { name: 'alternate: defect, cooperate, defect, …', s: () => ({ name: 'A', move: (m) => (m.length % 2 === 0 ? 'D' : 'C') }) },
];

const genVsTFT: Generator = (rng) => {
  const n = randInt(rng, 4, 12);
  const plan = pick(rng, PLANS);
  const mine: Move[] = [], tft: Move[] = [];
  let you = 0;
  const me = plan.s(n);
  for (let i = 0; i < n; i++) {
    const a = me.move(mine, tft, rng), b: Move = i === 0 ? 'C' : mine[i - 1];
    mine.push(a);
    tft.push(b);
    you += PD[a + b];
  }
  if (match(me, STRATEGIES[0], n, rng)[0] !== you) throw new Error('TFT simulation mismatch');
  return {
    kind: 'number',
    body: `You play ${n} rounds of the prisoner's dilemma against **Tit for Tat** (cooperates first, then copies your previous move). Both cooperate: 3 each; both defect: 1 each; defecting on a cooperator: 5 for the defector, 0 for the cooperator. Your plan: **${plan.name}**. How many points do you score in total?`,
    answer: you, tol: 0, unit: 'points',
    hint: 'Write out both rows of moves. Tit for Tat’s move in each round is your move from the round before.',
    explain: `You: ${mine.join(' ')}. Tit for Tat: ${tft.join(' ')} (C first, then your previous move). Round by round: ${mine.map((a, i) => PD[a + tft[i]]).join(' + ')} = ${you}. Always cooperating would give ${3 * n}.`,
  };
};

const genSecondPrice: Generator = (rng) => {
  for (;;) {
    const v = randInt(rng, 40, 95);
    const k = randInt(rng, 2, 3);
    // Mostly auctions you win, so the price rule matters; sometimes one you should lose.
    const cap = rng() < 0.7 ? v - 1 : 99;
    const bids = Array.from({ length: k }, () => randInt(rng, 15, cap));
    if (new Set([...bids, v]).size !== k + 1) continue;
    const top = Math.max(...bids);
    const win = v > top;
    const item = pick(rng, ['a vintage guitar', 'a painting', 'a signed football', 'an old map', 'a rare stamp']);
    return {
      kind: 'number',
      body: `A sealed-bid **second-price** auction for ${item}: highest bid wins and pays the second-highest bid. You value it at £${v} and bid £${v}. The other bids are ${bids.map((b) => '£' + b).join(', ')}. What's your **profit** (value minus price paid; 0 if you lose)?`,
      answer: win ? v - top : 0, tol: 0, unit: '£',
      explain: win
        ? `You win (£${v} beats £${top}) and pay the second-highest bid, £${top}: profit £${v} − £${top} = £${v - top}.`
        : `£${top} beats your £${v}, so you lose and pay nothing: profit £0. Winning would have meant paying at least £${top}, more than it's worth to you.`,
    };
  }
};

const genTruthful: Generator = (rng) => {
  const v = randInt(rng, 4, 40) * 5;
  const d = randInt(rng, 1, 4) * 5;
  const live = rng() < 0.4;
  return {
    kind: 'choice',
    body: live
      ? `A live auction where the price rises until only one bidder is left. The item is worth £${v} to you. When should you drop out?`
      : `A sealed-bid second-price auction (highest bid wins, pays the second-highest bid). The item is worth £${v} to you. What should you bid?`,
    options: [
      { text: live ? `When the price reaches £${v}` : `£${v}`, correct: true },
      { text: live ? `When the price reaches £${v - d}` : `£${v - d}`, why: `You'd miss out whenever the top rival is between £${v - d} and £${v}: you'd have won at a price below your value.` },
      { text: live ? `When the price reaches £${v + d}` : `£${v + d}`, why: `If the top rival is between £${v} and £${v + d}, you'd win and pay more than it's worth to you.` },
    ],
    ordered: true,
    explain: live
      ? `Stay in while the price is below your value (winning would profit you) and leave when it passes £${v}. That's the same as bidding your value in a second-price auction.`
      : `In a second-price auction your bid only decides whether you win, never what you pay. Bidding exactly £${v} means you win precisely when winning is profitable.`,
  };
};

const genFirstPrice: Generator = (rng) => {
  const v = randInt(rng, 10, 50) * 2;
  return {
    kind: 'number',
    body: `First-price sealed-bid auction: you pay your own bid if you win. Your value is £${v}. Your one rival's bid is equally likely to be anything from £0 to £100. Which bid gives you the **highest average profit**?`,
    answer: v / 2, tol: 1, unit: '£',
    hint: `Bidding b wins with chance b/100 and earns £${v} − b when it does. Try a few bids.`,
    explain: `Average profit = (b/100) × (${v} − b), which peaks halfway between 0 and ${v}: bid £${v / 2}. Bidding higher wins more often but earns too little each time.`,
  };
};

// ---------------------------------------------------------------- course

export const strategy: Course = {
  id: 'strategy',
  title: 'Strategy & Game Theory',
  blurb: 'Outthink opponents: work backwards, find equilibria, and know when to cooperate.',
  color: '#2bb3c0',
  icon: '♟️',
  lessons: [
    {
      id: 'backwards',
      title: 'Work backwards',
      goal: 'Win a take-away game by finding the losing positions from the end.',
      steps: [
        {
          kind: 'choice',
          body: 'A pile of **5** counters. You and a friend take turns removing 1, 2 or 3. Whoever takes the **last** counter wins. It’s your move. How many do you take?',
          options: [
            { text: '1', correct: true },
            { text: '2', why: 'That leaves 3, and your friend takes all three.' },
            { text: '3', why: 'That leaves 2, and your friend takes both.' },
          ],
          ordered: true,
          explain: 'Take 1 and leave 4. Whatever your friend takes (1, 2 or 3), you take the rest.',
        },
        {
          kind: 'choice',
          body: 'Now *you* face a pile of **4** on your move, against a perfect opponent. Can you force a win?',
          options: [
            { text: 'No: whatever you take, they can take the rest', correct: true },
            { text: 'Yes: take 1', why: 'That leaves 3, and they take all three.' },
            { text: 'Yes: take 3', why: 'That leaves 1, and they take it.' },
          ],
          explain: 'From 4 you can only leave 3, 2 or 1, and each of those lets your opponent finish. 4 is a **losing position** for whoever has to move.',
        },
        {
          kind: 'task',
          body: 'A position is **losing** if every move from it leaves your opponent in a winning one, and **winning** if some move leaves them in a losing one. 0 is losing (your opponent just took the last counter). Tap every losing position up to 16 (take 1 to 3).',
          widget: positions({ max: 16, k: 3, task: true }),
          hint: 'You found 4. From 5, 6 and 7 you can move to 4. What about 8?',
          explain: '0, 4, 8, 12, 16: the multiples of 4. From any of them you can only reach a non-multiple; from any other number you can step down to a multiple.',
        },
        {
          kind: 'read',
          title: 'Start from the end',
          body: 'You didn’t need to think about the whole game. You labelled the end, then worked back one step at a time: a position is losing exactly when every move leads to a winning one.\n\nWith takes of 1 to 3, the losing positions are the multiples of 4. Your plan: **always leave a multiple of 4**. Whatever they take (x), you take 4 − x.',
          widget: positions({ max: 21, k: 3 }),
        },
        {
          kind: 'number',
          body: 'The classic game of **21**: 21 counters, take 1 to 3, last counter wins. You move first. How many do you take?',
          answer: 1, tol: 0,
          hint: 'Which multiple of 4 can you leave?',
          explain: '21 = 5 × 4 + 1. Take 1, leave 20, and keep every round adding up to 4.',
        },
        {
          kind: 'task',
          body: 'Now play it. 21 counters, take 1 to 3, last counter wins. The computer plays perfectly and pounces on any mistake. **Beat it.**',
          widget: takeAway({ start: 21, k: 3 }),
          hint: 'After each of your moves the pile should be a multiple of 4: 20, 16, 12, 8, 4, 0.',
          explain: 'Take 1, then answer every take of x with 4 − x. The computer is stuck on multiples of 4 until you take the last counter.',
        },
        {
          kind: 'choice',
          body: 'Change the rule: you may take **1 to 5** counters. Which pile sizes are losing for the player to move?',
          options: [
            { text: 'Multiples of 6', correct: true },
            { text: 'Multiples of 5', why: 'From 5 you can take all five and win. The cycle is one more than the biggest take.' },
            { text: 'Multiples of 4', why: 'That was for takes of 1 to 3. From 4 you can now take everything.' },
          ],
          explain: 'Whatever your opponent takes (1 to 5), you can top the round up to 6. So the losing positions are 0, 6, 12, 18, …',
        },
        {
          kind: 'choice',
          body: 'A pile of **24**, take 1 to 5. Your perfect opponent lets you choose: go first or second?',
          options: [
            { text: 'Go second', correct: true },
            { text: 'Go first', why: '24 is a multiple of 6, a losing position for whoever moves first.' },
            { text: 'It makes no difference', why: 'Every position is winning or losing for the player to move. One choice wins for sure.' },
          ],
          ordered: true,
          explain: '24 = 4 × 6, so the first player is in a losing position. Go second and answer every take of x with 6 − x.',
        },
      ],
      practice: [genTakeMove, genFirstOrSecond],
    },
    {
      id: 'backward-induction',
      title: 'Look ahead, reason back',
      goal: 'Solve a sequential game by backward induction, and spot empty threats.',
      steps: [
        {
          kind: 'choice',
          body: 'You run the only café on a street. A rival is deciding whether to open next door. If they **enter**, you choose to **fight** with a price war or **share** the customers. Payoffs are (you, rival). You loudly threaten a price war. Does the rival enter?',
          widget: tree(cafeTree, { names: ['You', 'Rival'] }),
          options: [
            { text: 'Yes: once they’re in, sharing is better for you than fighting', correct: true },
            { text: 'No: the threat of a price war scares them off', why: 'Would you really fight? After they enter, fighting gives you 2 and sharing gives you 5.' },
            { text: 'It’s a coin flip', why: 'Nothing here is random. Put yourself in your own shoes after they’ve entered.' },
          ],
          explain: 'After entry you’d pick share (5 > 2), giving them 3, more than the 0 they get by staying out. So they enter. A threat you wouldn’t carry out isn’t **credible**.',
        },
        {
          kind: 'read',
          title: 'Backward induction',
          body: 'In a game where players move in turn, solve it from the end:\n\n- At each last decision, the chooser picks what’s best **for them**.\n- Replace that decision with its result, and repeat one level up.\n\nPress the button to solve the café game step by step.',
          widget: tree(cafeTree, { names: ['You', 'Rival'], solve: true }),
        },
        {
          kind: 'choice',
          body: 'You move first (Left or Right); they see your move and reply (Up or Down). Payoffs are (you, them). Which first move is best for you?',
          widget: tree(lrTree),
          options: [
            { text: 'Right', correct: true },
            { text: 'Left', why: 'Left holds your best payoff (4), but after Left they pick Down (2 beats 1), leaving you with 0.' },
            { text: 'It doesn’t matter', why: 'Work out their reply to each and compare what you get.' },
          ],
          hint: 'What would they choose after Left? After Right?',
          explain: 'After Left they choose Down (2 > 1): you get 0. After Right they choose Up (3 > 1): you get 2. So Right.',
        },
        {
          kind: 'number',
          body: 'In that game, what payoff do you end up with?',
          widget: tree(lrTree),
          answer: 2, tol: 0,
          explain: 'Right, then Up: (2, 3). The 4 was never really on offer, because they’d never choose Up after Left.',
        },
        {
          kind: 'choice',
          body: 'Back at the café. How could you make your price-war threat **credible**, so the rival stays out?',
          options: [
            { text: 'Commit in advance to something that makes fighting pay, like a public price-match guarantee', correct: true },
            { text: 'Repeat the threat more loudly', why: 'Words don’t change your payoffs. After entry, sharing still beats fighting.' },
            { text: 'Keep your plans secret', why: 'A secret threat can’t deter anyone.' },
          ],
          explain: 'Threats work when they change what you’d actually want to do later. Tying your own hands in advance, so fighting becomes your best reply, can make the rival stay out.',
        },
        {
          kind: 'number', unit: '£',
          body: 'The **ultimatum game**: you propose how to split £100 (in whole pounds). The responder accepts, and you both get the split, or rejects, and you both get nothing. Suppose the responder only cares about money, so they accept anything above £0. What’s the smallest offer backward induction says you should make?',
          answer: 1, tol: 0,
          explain: 'Work back from the responder: £1 beats nothing, so they accept. Offering more just costs you. Backward induction says offer £1 and keep £99.',
        },
        {
          kind: 'choice',
          body: 'In real experiments around the world, what usually happens to offers below about 20% of the pot?',
          options: [
            { text: 'They’re often rejected, so sensible proposers offer much more', correct: true },
            { text: 'They’re accepted, as the logic predicts', why: 'Many responders would rather get nothing than accept an insulting split.' },
            { text: 'People refuse to play', why: 'They play. They just don’t only care about money.' },
          ],
          explain: 'Most offers are 40–50%, and low offers are often turned down. Backward induction is only as good as your model of what the other player wants: here, fairness matters too.',
        },
        {
          kind: 'choice',
          body: 'The **centipede game**: you alternate turns. On your turn, **take** the bigger share now, or **pass** and let the pot grow. Payoffs are (you, them). What does backward induction predict?',
          widget: tree(centipede),
          options: [
            { text: 'You take at the very first move', correct: true },
            { text: 'Both pass to the end, for (32, 8)', why: 'At the last node they’d take 16 rather than pass for 8. Knowing that, you’d take earlier, and so on back.' },
            { text: 'They take at the last move', why: 'True if the game gets there, but you’d take before that: 8 beats the 4 you get if they take at the end.' },
          ],
          explain: 'At the last move they take (16 > 8), so at the move before you take (8 > 4), so they take before that (4 > 2), so you take at once (2 > 1). In experiments people usually pass for a while, and earn far more than “rational” players would. Logic chains this long are fragile.',
        },
      ],
      practice: [genTree, genEntry],
    },
    {
      id: 'dominance',
      title: 'Dominant strategies',
      goal: 'Spot moves that are best whatever the other player does, and cross out moves that never are.',
      steps: [
        {
          kind: 'choice',
          body: 'You choose a row, they choose a column, at the same time. In each cell, the **first** number (blue) is your payoff and the second (orange) is theirs. Which row should you pick?',
          widget: matrix(domGame),
          options: [
            { text: 'Up', correct: true },
            { text: 'Down', why: 'Against Left, Up gives you 5 and Down 2. Against Right, Up gives 3 and Down 1. Down is always worse.' },
            { text: 'It depends on what they pick', why: 'Check both columns: Up is better in each.' },
          ],
          ordered: true,
          explain: 'Up beats Down if they play Left (5 > 2) and if they play Right (3 > 1). You don’t need to guess what they’ll do.',
        },
        {
          kind: 'read',
          title: 'Dominant strategies',
          body: 'A move is **dominant** if it’s better for you than every alternative, **whatever** the others do. If you have one, play it: no need to predict anyone.\n\nThe buttons underline each player’s best response to each of the other’s moves. Up is your best response to both columns.',
          widget: matrix(domGame, { mode: 'best' }),
        },
        {
          kind: 'choice',
          body: 'Same game. Do **they** (orange numbers) have a dominant move?',
          widget: matrix(domGame, { mode: 'best' }),
          options: [
            { text: 'No: their best move depends on yours', correct: true },
            { text: 'Yes: Right', why: 'Against Up, Right is better (4 > 1). But against Down, Left is better (3 > 2).' },
            { text: 'Yes: Left', why: 'Against Up, Left gives them only 1, against 4 for Right.' },
          ],
          explain: 'If you play Up they prefer Right; if you play Down they prefer Left. No single move is best for them in both cases.',
        },
        {
          kind: 'choice',
          body: 'But they know you’re rational, so they can predict you’ll play Up. What do they play?',
          widget: matrix(domGame),
          options: [
            { text: 'Right', correct: true },
            { text: 'Left', why: 'Against Up, Left gets them 1 and Right gets 4.' },
          ],
          ordered: true,
          explain: 'Knowing you’ll play your dominant move, they best-respond: Right. The game is solved at Up/Right, (3, 4).',
        },
        {
          kind: 'task',
          body: 'A move is **dominated** if some other move is better for that player whatever the other does. Nobody rational plays it, so cross it out, then look again at what’s left. Tap a move’s name to cross it out. Keep going until **one cell** remains.',
          widget: matrix(elimGame, { mode: 'eliminate' }),
          hint: 'Nothing of yours is dominated at first. Compare their (orange) payoffs for Centre and Right.',
          explain: 'Right beats Centre for them in every row (2 > 1, 6 > 4, 8 > 6): cross out Centre. Now Top beats Middle (4 > 2, 6 > 3) and Bottom (4 > 3, 6 > 2) for you. With only Top left, they pick Left (3 > 2). Result: Top/Left, (4, 3).',
        },
        {
          kind: 'choice',
          body: 'A newspaper contest: everyone picks a whole number from 0 to 100. The winner is whoever is closest to **two-thirds of the average** guess. Which guesses are dominated, never a good idea whatever others pick?',
          options: [
            { text: 'Anything above 67', correct: true },
            { text: 'Anything above 50', why: 'If everyone else guessed 100, two-thirds of the average would be near 67, so 60 could win.' },
            { text: 'None: anything could win', why: 'The average can be at most 100, so the target is at most 66.7. Guessing 67 or more is always beaten by 66.' },
          ],
          explain: 'The target can never exceed 2/3 × 100 ≈ 66.7, so 66 does better than any higher guess.',
        },
        {
          kind: 'choice',
          body: 'Now suppose **everyone** is perfectly rational, and everyone knows it. Nobody guesses above 66, so the target is at most 44; nobody guesses above 44, so… Where does this end?',
          options: [
            { text: '0', correct: true },
            { text: '33', why: 'Why stop? If everyone guesses at most 33, the target is at most 22.' },
            { text: '22', why: 'The same logic keeps cutting: the next round rules out everything above about 15.' },
          ],
          explain: 'Iterated elimination drives the guess all the way to 0. In real contests, though, the winning number is usually between 10 and 25: most people think one or two steps ahead. The best guess depends on how far **others** reason, not just on logic.',
        },
      ],
      practice: [genDominant],
    },
    {
      id: 'prisoners-dilemma',
      title: 'The prisoner’s dilemma',
      goal: 'See why sensible individual choices can leave everyone worse off, and what fixes it.',
      steps: [
        {
          kind: 'choice',
          body: 'You and a partner are arrested and held apart. If both stay silent, you each get 1 year. If you confess and your partner stays silent, you walk free and they get 10 years (and the other way round). If both confess, 5 years each. **Whatever your partner does**, which gives you less time?',
          options: [
            { text: 'Confess', correct: true },
            { text: 'Stay silent', why: 'If your partner stays silent, confessing gets you 0 years instead of 1. If they confess, confessing gets you 5 instead of 10.' },
            { text: 'It depends on your partner', why: 'Check both cases: confessing is better in each.' },
          ],
          explain: 'Confessing is dominant: 0 instead of 1 if they’re silent, 5 instead of 10 if they confess.',
        },
        {
          kind: 'choice',
          body: 'Your partner reasons exactly the same way. What happens?',
          options: [
            { text: 'Both confess: 5 years each', correct: true },
            { text: 'Both stay silent: 1 year each', why: 'That would be better for both, but each of you does better by confessing, whatever the other does.' },
            { text: 'One confesses, one stays silent', why: 'You’re in the same situation, so you reach the same conclusion.' },
          ],
          explain: 'Each makes the individually sensible choice, and together they get 5 years each instead of 1. That’s the dilemma.',
        },
        {
          kind: 'read',
          title: 'Rational, and worse off',
          body: 'Here is the same game in points (more is better). **Defect** is dominant for both, so both defect and get 1 each, though both cooperating would give 3 each.\n\nThe outlined cell is where rational players land. Every prisoner’s dilemma has this shape: a temptation to defect, and a shared outcome that’s worse for everyone.',
          widget: matrix(pdGame, { mode: 'best', mark: [[1, 1]] }),
        },
        {
          kind: 'choice',
          body: 'Which of these is **not** a prisoner’s dilemma?',
          options: [
            { text: 'Two drivers choosing which side of the road to drive on', correct: true },
            { text: 'Fishing fleets deciding whether to overfish a shared sea', why: 'Each fleet gains by catching more whatever the others do, and together they empty the sea. Classic dilemma.' },
            { text: 'Two countries deciding whether to build more weapons', why: 'Arming is better for each whatever the other does, and both end up poorer and no safer. A dilemma.' },
          ],
          explain: 'The drivers just want to match each other, and nobody is tempted to deviate once a side is agreed. That’s a coordination game, which we meet next lesson.',
        },
        {
          kind: 'choice',
          body: 'Would it help if the two prisoners could talk beforehand and promise to stay silent?',
          options: [
            { text: 'No: once apart, confessing is still better for each', correct: true },
            { text: 'Yes: a promise solves it', why: 'A promise that can’t be enforced doesn’t change the payoffs. Each still does better by confessing.' },
          ],
          ordered: true,
          explain: 'Talk is cheap. Unless something changes the payoffs (a contract, a punishment, a future together), the promise doesn’t hold.',
        },
        {
          kind: 'number',
          body: 'In the points version (cooperate/cooperate 3 each, defect/defect 1 each, a defector against a cooperator 5 and 0), a referee fines anyone who defects. What’s the **smallest whole-number fine** that makes cooperating strictly better whatever the other does?',
          widget: matrix(pdGame),
          answer: 3, tol: 0,
          hint: 'Compare the cases one at a time: if they cooperate, 3 vs 5 − fine; if they defect, 0 vs 1 − fine.',
          explain: 'If they cooperate: 3 vs 5 − fine, so the fine must be more than 2. If they defect: 0 vs 1 − fine, so more than 1. A fine of 3 does both. Changing the payoffs is how laws, contracts and reputations dissolve dilemmas.',
        },
        {
          kind: 'choice',
          body: 'Two cigarette firms each decide whether to run TV adverts. Ads mostly steal customers from each other. Profits are below. In 1971 the US banned cigarette adverts on TV. How did the firms’ profits change?',
          widget: matrix(adsGame),
          options: [
            { text: 'They rose: the ban forced both into the better cell', correct: true },
            { text: 'They fell: fewer ads, fewer smokers', why: 'Ads mainly moved customers between brands. Both firms were stuck advertising, and the ban moved them to (6, 6).' },
            { text: 'No change', why: 'Look at the table: moving from Advertise/Advertise to Don’t/Don’t doubles each profit.' },
          ],
          explain: 'Advertising was dominant for each (3 > 2, 8 > 6), so both advertised and earned 3. The ban did what they couldn’t do alone, and industry profits went up.',
        },
      ],
      practice: [genPDFine, genPDOutcome],
    },
    {
      id: 'nash',
      title: 'Nash equilibrium',
      goal: 'Find the outcomes where nobody wants to change their move alone.',
      steps: [
        {
          kind: 'choice',
          body: 'You and a friend lose each other at a festival, with no phone signal. You each head to the main stage or the food tent. Meeting at the main stage is best (2 each), the food tent is fine (1 each), missing each other is 0. Do you have a **dominant** move?',
          widget: matrix(festival, { mode: 'show' }),
          options: [
            { text: 'No: your best move depends on where they go', correct: true },
            { text: 'Yes: the main stage', why: 'If your friend is at the food tent, the main stage gets you 0 and the food tent 1.' },
            { text: 'Yes: the food tent', why: 'If your friend is at the main stage, the food tent gets you 0.' },
          ],
          explain: 'You want to go wherever they go. Without a dominant move, you need a different idea: a stable pair of choices.',
        },
        {
          kind: 'read',
          title: 'Nash equilibrium',
          body: 'A **Nash equilibrium** is a cell where each move is a best response to the other: **nobody gains by changing their move alone**.\n\nTurn on both sets of best responses. A cell where both payoffs are underlined is an equilibrium. This game has two.',
          widget: matrix(festival, { mode: 'best' }),
        },
        {
          kind: 'task',
          body: 'Tap **every** Nash equilibrium in the festival game.',
          widget: matrix(festival, { mode: 'nash' }),
          explain: 'Both meeting points are equilibria: once you’re together, neither wants to leave alone. The food tent is worse for both, yet still stable. Equilibrium means stable, not best.',
        },
        {
          kind: 'choice',
          body: 'In the prisoner’s dilemma (points), is **both cooperate** (3, 3) a Nash equilibrium?',
          widget: matrix(pdGame, { mode: 'best' }),
          options: [
            { text: 'No: each would gain by switching to defect', correct: true },
            { text: 'Yes: it’s the best outcome for both', why: 'Best for both isn’t the test. If the other cooperates, you get 5 instead of 3 by defecting.' },
          ],
          ordered: true,
          explain: 'The only equilibrium is both defect (1, 1). Neither gains by switching alone: cooperating against a defector gets 0.',
        },
        {
          kind: 'task',
          body: 'A bigger game. Tap every Nash equilibrium.',
          widget: matrix(threeByThree, { mode: 'nash' }),
          hint: 'Check each cell: is your payoff the biggest in its column, and theirs the biggest in its row?',
          explain: 'Only Bottom/Right (6, 6). In the top-left corner the players chase each other round in circles: someone always wants to switch. No move here is dominated by another, yet the equilibrium is unique.',
        },
        {
          kind: 'task',
          body: 'The **stag hunt**: two hunters. A stag needs both of you and is worth 4 each. A hare you can catch alone, worth 3 whatever the other does. Hunt the stag alone and you get nothing. Tap every Nash equilibrium.',
          widget: matrix(stagHunt, { mode: 'nash' }),
          explain: 'Two equilibria: both hunt the stag (4, 4), and both hunt hares (3, 3). If the other hunts the stag, so should you; if they go for a hare, the stag gets you nothing.',
        },
        {
          kind: 'choice',
          body: 'Stag/Stag is better for both hunters. Why might they still both end up chasing hares?',
          options: [
            { text: 'Hare is safe: it pays 3 whatever the other does', correct: true },
            { text: 'Hare is a dominant strategy', why: 'If the other hunts the stag, stag gets you 4 and hare 3. Hare isn’t dominant, just safe.' },
            { text: 'They can’t: Stag/Stag is the only equilibrium', why: 'Hare/Hare is an equilibrium too: if the other goes for a hare, a stag hunt alone gets you 0.' },
          ],
          explain: 'Going for the stag only pays if you trust your partner. With doubt, the safe equilibrium wins. Many teams and markets get stuck in a worse equilibrium this way.',
        },
        {
          kind: 'number',
          body: 'A penalty kick. The keeper wins (1) if he dives the same way as the kick; the kicker wins if not. How many pure Nash equilibria (cells) does this game have?',
          widget: matrix(pennies, { mode: 'best' }),
          answer: 0, tol: 0,
          explain: 'None. In every cell someone wants to switch: if the keeper dives left, the kicker wants right, then the keeper wants right, and so on round. The answer is to be unpredictable, which is the next lesson.',
        },
      ],
      practice: [genNashTap, genNashCount],
    },
    {
      id: 'mixed',
      title: 'Keep them guessing',
      goal: 'Choose a random mix that leaves your opponent nothing to exploit.',
      steps: [
        {
          kind: 'choice',
          body: 'At rock–paper–scissors, you always play rock. What does a smart opponent do?',
          options: [
            { text: 'Always play paper', correct: true },
            { text: 'Play each move a third of the time', why: 'That just ties on average. Once they spot your habit, paper wins every time.' },
            { text: 'Always play rock too', why: 'That only draws. Paper beats rock.' },
          ],
          explain: 'Any predictable pattern can be exploited. In games like this, being predictable is the mistake.',
        },
        {
          kind: 'read',
          title: 'Play the pattern-spotter',
          body: 'This bot remembers what you tend to play after each move, and plays whatever beats your likely next move. Play 20 rounds “randomly” in your head. Then let the button play 30 truly random moves.\n\nHumans are poor at being random, and the bot feeds on it. Truly random play can’t be beaten on average.',
          widget: rps(),
        },
        {
          kind: 'choice',
          body: 'Which way of playing rock–paper–scissors can’t be exploited, however clever the opponent?',
          options: [
            { text: 'Each move with probability 1/3, at random', correct: true },
            { text: 'Rock, paper, scissors in a fixed cycle', why: 'A cycle is a pattern. Once spotted, they always play what beats your next move.' },
            { text: 'Whatever beat their last move', why: 'Also a pattern: they can predict it and counter it.' },
          ],
          explain: 'With each move at 1/3, every reply wins, draws and loses equally often. There is nothing for them to aim at. That’s a **mixed strategy**.',
        },
        {
          kind: 'number', prob: true,
          body: 'A penalty taker scores every time the keeper dives the wrong way. When he guesses right, she still scores **60%** on her strong side (left) but only **20%** on her weak side (right). If she **always** shoots left, what’s her scoring chance against a keeper who knows it?',
          answer: 0.6, tol: 0.006,
          explain: 'He always dives left, so she scores 60%. Being predictable throws away the keeper’s uncertainty, her main weapon.',
        },
        {
          kind: 'read',
          title: 'Find the best mix',
          body: 'Drag the slider to set how often she shoots left. The two lines show her scoring chance if the keeper always dives left or always dives right. A smart keeper picks whichever is worse for her, so she should **maximise the lower line**.',
          widget: mixSlider({ mine: ['Left', 'Right'], theirs: ['Dive left', 'Dive right'], chance: [[0.6, 1], [1, 0.2]], what: 'She scores' }),
        },
        {
          kind: 'number', prob: true,
          body: 'What share of her penalties should she shoot **left**?',
          answer: 2 / 3, tol: 0.02,
          hint: 'The best point is where the two lines cross: the keeper’s two dives give the same result.',
          explain: 'Shooting left with chance p: if he dives left she scores 0.6p + 1(1 − p); if he dives right, 1p + 0.2(1 − p). These are equal when 1 − 0.4p = 0.2 + 0.8p, so p = 2/3.',
        },
        {
          kind: 'number', prob: true,
          body: 'At that mix, what’s her scoring chance?',
          answer: 1 - 0.4 * (2 / 3), tol: 0.01,
          explain: '1 − 0.4 × 2/3 ≈ 73%, much better than the 60% from always going left.',
        },
        {
          kind: 'choice',
          body: 'She shoots left 2/3 of the time. The keeper dives left every single time. What happens to her scoring rate?',
          options: [
            { text: 'Nothing: she scores about 73% whatever he does', correct: true },
            { text: 'It drops: he’s guarding her strong side', why: 'Against a dive left: 2/3 × 60% + 1/3 × 100% ≈ 73%. Same as before.' },
            { text: 'It rises: he’s too predictable', why: 'Her mix already makes both his dives equally good for him. She can only gain from his habit by changing her own mix.' },
          ],
          explain: 'That’s the point of the equilibrium mix: it makes the opponent **indifferent**, so nothing they do can hurt you. Their mix, in turn, makes you indifferent.',
        },
        {
          kind: 'choice',
          body: 'A striker scores 90% of the penalties she shoots left but only 60% of those she shoots right. What should she conclude?',
          options: [
            { text: 'Shoot left more often, until the two rates even out', correct: true },
            { text: 'Nothing: rates always differ by side', why: 'If one side does better, keepers aren’t covering it enough. Shift towards it.' },
            { text: 'Always shoot left', why: 'Then keepers would always dive left, and her rate would drop to her “guessed right” rate.' },
          ],
          explain: 'At the equilibrium both sides succeed equally often; if they didn’t, shifting would help. Studies of professional penalties find success rates on both sides very close to equal.',
        },
      ],
      practice: [genMixShare, genRPSBest],
    },
    {
      id: 'repeated',
      title: 'The shadow of the future',
      goal: 'See how repeated play makes cooperation pay, and which strategies thrive.',
      steps: [
        {
          kind: 'task',
          body: 'You’ll play **10 rounds** of the prisoner’s dilemma against the same opponent. Their strategy is hidden. Score **at least 30 points**.',
          widget: pdPlay({ rounds: 10, target: 30 }),
          hint: 'Watch what they do in the round after you defect.',
          explain: 'Your opponent was **Tit for Tat**: it cooperates first, then copies your previous move. Cooperating every round scores 30. Defecting only in the very last round scores 32, since there’s no next round for it to punish you in.',
        },
        {
          kind: 'choice',
          body: 'What was your opponent doing?',
          options: [
            { text: 'Cooperating first, then copying your previous move', correct: true },
            { text: 'Always cooperating', why: 'Try defecting once: they defect right back the next round.' },
            { text: 'Choosing at random', why: 'Their moves follow yours exactly, one round later.' },
          ],
          explain: 'That’s **Tit for Tat**. Defect against it and you gain 5 once, then lose out the next round. Against it, cooperating pays.',
        },
        {
          kind: 'read',
          title: 'Axelrod’s tournament',
          body: 'In 1980 Robert Axelrod invited experts to submit strategies for a repeated prisoner’s dilemma tournament. The simplest entry, Tit for Tat, won.\n\nRun this mini-tournament. In **one-round** games, Always Defect comes top. In **long** matches the top places go to strategies that are **nice** (never defect first) but **retaliate**, and Always Defect sinks.',
          widget: tournamentWidget(),
        },
        {
          kind: 'choice',
          body: 'A surprising fact: in any **single match**, can Tit for Tat ever score more than its opponent?',
          options: [
            { text: 'No: at best it ties', correct: true },
            { text: 'Yes: it punishes defectors', why: 'It only defects after being defected on, so it can never get ahead in a match.' },
          ],
          ordered: true,
          explain: 'Tit for Tat never wins a match. It does well overall by getting lots of mutual cooperation and not being exploited for long. It aims to do well, not to beat the other player.',
        },
        {
          kind: 'choice',
          body: 'Both players know the game lasts **exactly 10 rounds**. What does backward induction say about round 10?',
          options: [
            { text: 'Both defect: there’s no future left to protect', correct: true },
            { text: 'Both cooperate, like every other round', why: 'In the last round nothing can be punished later, so it’s a one-shot dilemma: defecting is dominant.' },
            { text: 'It can’t say anything', why: 'It can. Round 10 is a one-shot game, and in a one-shot dilemma defecting is dominant.' },
          ],
          explain: 'Round 10 is a one-shot game, so both defect. Then round 9 has no future worth protecting either, and so on back to round 1. With a known end, the logic unravels. With an **uncertain** end, it doesn’t.',
        },
        {
          kind: 'number', unit: 'rounds',
          body: 'After each round there’s a **90%** chance of another. On average, how many rounds will be played, counting the first?',
          answer: 10, tol: 0.05,
          hint: 'Each round has a 10% chance of being the last.',
          explain: 'A 10% chance of stopping each round gives 1 ÷ 0.1 = 10 rounds on average. When the future is likely to last, a 5-point grab now isn’t worth losing many 3-point rounds.',
        },
        {
          kind: 'choice',
          body: 'Where would you expect to be treated more fairly?',
          options: [
            { text: 'A local café that relies on regulars', correct: true },
            { text: 'A shop at an airport you’ll never visit again', why: 'One-off customers can’t punish bad service by not coming back.' },
          ],
          ordered: true,
          explain: 'Repeat business is a long shadow of the future. Reviews and ratings try to give one-off encounters the same shadow.',
        },
        {
          kind: 'choice',
          body: 'Two Tit for Tat players are cooperating happily. Then one defects **by mistake**. What happens next?',
          options: [
            { text: 'They fall into an echo, taking turns to retaliate', correct: true },
            { text: 'They return to cooperating straight away', why: 'The other copies the defection, then the first copies that back, and so on.' },
            { text: 'Both defect for ever', why: 'Not quite: they alternate, each copying the other’s last move.' },
          ],
          explain: 'One mistake echoes back and forth. **Generous** Tit for Tat, which sometimes forgives a defection, breaks the cycle. In noisy real life, some forgiveness pays. Turn on mistakes in the tournament and watch Tit for Tat slip.',
        },
      ],
      practice: [genRounds, genVsTFT],
    },
    {
      id: 'auctions',
      title: 'Auctions',
      goal: 'Bid well: your true value in second-price auctions, less in first-price ones, and beware the winner’s curse.',
      steps: [
        {
          kind: 'choice',
          body: 'A sealed-bid **second-price** auction: the highest bid wins, but pays the **second-highest** bid. A painting is worth £80 to you. What should you bid?',
          options: [
            { text: 'Exactly £80', correct: true },
            { text: 'Less than £80, to pay less', why: 'Your bid never sets your price in this auction. A lower bid only makes you lose some auctions you’d have profited from.' },
            { text: 'More than £80, to make sure you win', why: 'Then you sometimes win and pay more than £80, a loss.' },
          ],
          explain: 'Your bid decides only **whether** you win, not what you pay. So bid what it’s worth to you.',
        },
        {
          kind: 'choice',
          body: 'Suppose you bid £60 instead of £80. When does that cost you?',
          options: [
            { text: 'When the top rival bid is between £60 and £80', correct: true },
            { text: 'When the top rival bid is under £60', why: 'Then you win either way and pay the same price (their bid).' },
            { text: 'When the top rival bid is over £80', why: 'Then you lose either way, which is good: winning would cost more than it’s worth.' },
          ],
          explain: 'Between £60 and £80 you lose an auction you’d have won at a profit. Underbidding can only hurt you.',
        },
        {
          kind: 'choice',
          body: 'And if you bid £100 instead of £80?',
          options: [
            { text: 'It costs you when the top rival bid is between £80 and £100', correct: true },
            { text: 'It never costs you: you still pay the second price', why: 'If the rival bid £90, you win and pay £90 for a painting worth £80.' },
            { text: 'It costs you whenever you win', why: 'If the rival bid under £80 you pay the same as with a bid of £80.' },
          ],
          explain: 'Overbidding only changes the outcome when the rival is between £80 and £100, and then it makes you win at a loss. So bidding your true value is a **dominant strategy**.',
        },
        {
          kind: 'read',
          title: 'See it',
          body: 'One rival bids anything from £0 to £100, equally likely. The curve shows your average profit for every bid in a second-price auction. Move the slider: the peak is exactly at your value.',
          widget: auction({ kind: 'second', value: 80, curve: true }),
        },
        {
          kind: 'number', unit: '£',
          body: 'Second-price auction. You value a guitar at £80 and bid £80. The other bids are £55, £72 and £64. What’s your profit?',
          answer: 8, tol: 0,
          explain: 'You win with the top bid and pay the second-highest, £72. Profit: £80 − £72 = £8.',
        },
        {
          kind: 'choice',
          body: 'Now a **first-price** auction: the winner pays their **own** bid. Should you still bid your value of £80?',
          options: [
            { text: 'No: bid less', correct: true },
            { text: 'Yes: bidding your value is always right', why: 'If you win at £80 you pay £80 and profit nothing. Bidding your value guarantees zero.' },
            { text: 'Bid more, to be sure of winning', why: 'Then every win is a loss.' },
          ],
          explain: 'In a first-price auction you must **shade** your bid: accept a smaller chance of winning for a profit when you do.',
        },
        {
          kind: 'task',
          body: 'First-price auction, value £80, one rival bidding anything from £0 to £100. Find the bid that gives the **highest average profit**.',
          widget: auction({ kind: 'first', value: 80, task: true }),
          hint: 'Try bids between £20 and £70, and watch the average profit.',
          explain: 'Bidding b wins with chance b/100 and earns £80 − b, so the average is (b/100)(80 − b), highest at £40. Shading this much is right against this rival; against more rivals you’d shade less.',
        },
        {
          kind: 'choice',
          body: 'A jar of coins is auctioned to a room of people who each estimate its value. On average the estimates are right. Who tends to win, and how do they do?',
          options: [
            { text: 'Whoever overestimated most, and they usually overpay', correct: true },
            { text: 'Whoever is best at estimating, and they profit', why: 'Winning picks out the highest estimate, which is usually too high.' },
            { text: 'A random bidder, breaking even on average', why: 'The winner isn’t random: it’s whoever has the highest estimate.' },
          ],
          explain: 'This is the **winner’s curse**: when the item is worth the same to everyone but nobody knows exactly how much, winning tells you that you were the most optimistic. Smart bidders bid below their own estimate to allow for it.',
        },
      ],
      practice: [genSecondPrice, genTruthful, genFirstPrice],
    },
  ],
};

