// Probability: chances, counting, the long run, combining events, conditioning, expected value.
import type { Course, Generator } from '../types';
import { coinFlipper, diceGrid, dots, montyHall, splitBar } from '../widgets/prob';
import { frac, num, pct, pick, randInt } from '../ui';

const C = { a: '#4f8cff', b: '#f2a33a', c: '#43b581', d: '#e5534b', e: '#a371f7', mute: '#8b95a7' };

// ---------------------------------------------------------------- practice generators

const genSimple: Generator = (rng) => {
  const red = randInt(rng, 2, 9), blue = randInt(rng, 2, 9), green = randInt(rng, 1, 6);
  const total = red + blue + green;
  const which = pick(rng, ['red', 'blue', 'green'] as const);
  const n = { red, blue, green }[which];
  return {
    kind: 'number', prob: true,
    body: `A bag holds ${red} red, ${blue} blue and ${green} green marbles. You draw one at random. What's the probability it's **${which}**?`,
    answer: n / total, tol: 0.006,
    hint: 'Favourable outcomes over all equally likely outcomes.',
    explain: `${n} of the ${total} marbles are ${which}: ${frac(n, total)} ≈ ${pct(n / total)}.`,
  };
};

const genComplement: Generator = (rng) => {
  const p = randInt(rng, 5, 95) / 100;
  return {
    kind: 'number', prob: true,
    body: `The chance of rain tomorrow is ${pct(p, 0)}. What's the chance it **doesn't** rain?`,
    answer: 1 - p, tol: 0.006,
    explain: `Either it rains or it doesn't, so the two chances add to 1: 1 − ${num(p)} = ${num(1 - p)}.`,
  };
};

const genDiceSum: Generator = (rng) => {
  const s = randInt(rng, 3, 11);
  const ways = 6 - Math.abs(7 - s);
  return {
    kind: 'number', prob: true,
    body: `Roll two fair dice. What's the probability their sum is **${s}**?`,
    answer: ways / 36, tol: 0.003,
    hint: 'Count the pairs (first, second) that add up to it, out of 36.',
    explain: `${ways} of the 36 equally likely pairs add to ${s}: ${frac(ways, 36)} ≈ ${pct(ways / 36)}.`,
  };
};

const genAtLeastOneSix: Generator = (rng) => {
  const n = randInt(rng, 2, 5);
  const p = 1 - Math.pow(5 / 6, n);
  return {
    kind: 'number', prob: true,
    body: `Roll ${n} dice. What's the probability of **at least one six**?`,
    answer: p, tol: 0.006,
    hint: 'It’s easier to find the chance of no sixes at all, then take that from 1.',
    explain: `No six on one die: 5/6. On all ${n}: (5/6)^${n} ≈ ${num(Math.pow(5 / 6, n))}. So at least one six: 1 − that ≈ ${pct(p)}.`,
  };
};

const genIndependent: Generator = (rng) => {
  const a = randInt(rng, 2, 9) / 10, b = randInt(rng, 2, 9) / 10;
  return {
    kind: 'number', prob: true,
    body: `Two independent machines: the first works ${pct(a, 0)} of the time, the second ${pct(b, 0)}. What's the chance **both** work today?`,
    answer: a * b, tol: 0.006,
    explain: `Independent events multiply: ${num(a)} × ${num(b)} = ${num(a * b)}.`,
  };
};

const genGambler: Generator = (rng) => {
  const n = randInt(rng, 4, 9);
  return {
    kind: 'choice',
    body: `A fair coin has landed heads ${n} times in a row. What's the chance the next flip is heads?`,
    options: [
      { text: 'Exactly 1/2', correct: true },
      { text: 'Less than 1/2: tails is due', why: 'That’s the gambler’s fallacy. The coin has no memory; past flips don’t change the next one.' },
      { text: 'More than 1/2: heads is on a streak', why: 'Streaks happen by chance in random sequences; a fair coin doesn’t get “hot”.' },
    ],
    explain: 'Each flip of a fair coin is independent: 1/2, whatever came before.',
  };
};

const genConditional: Generator = (rng) => {
  const total = randInt(rng, 8, 14) * 10;
  const tea = randInt(rng, 3, 7) * 10;
  const teaAlso = randInt(rng, 1, tea / 10 - 1) * 10;
  return {
    kind: 'number', prob: true,
    body: `Of ${total} office workers, ${tea} drink tea, and ${teaAlso} of the tea drinkers also drink coffee. Pick a **tea drinker** at random. What's the chance they also drink coffee?`,
    answer: teaAlso / tea, tol: 0.006,
    hint: 'Given they drink tea, only the tea drinkers count.',
    explain: `Only the ${tea} tea drinkers matter now: ${teaAlso}/${tea} = ${pct(teaAlso / tea)}. The ${total} total is a distraction.`,
  };
};

const genEV: Generator = (rng) => {
  const win = pick(rng, [10, 20, 50, 100]);
  const p = pick(rng, [0.1, 0.2, 0.25, 0.5]);
  const cost = pick(rng, [2, 5, 8, 10, 15, 20, 25, 30]);
  const ev = p * win - cost;
  return {
    kind: 'number',
    body: `A game costs $${cost} to play. You win $${win} with probability ${pct(p, 0)}, otherwise nothing. What's your **expected profit** per game (in dollars, negative if you lose on average)?`,
    answer: ev, tol: 0.01, unit: '$',
    hint: 'Average winnings per game minus the cost.',
    explain: `Expected winnings: ${num(p)} × $${win} = $${num(p * win)}. Minus the $${cost} fee: ${ev >= 0 ? '+' : '−'}$${num(Math.abs(ev))} per game.`,
  };
};

const genMonty: Generator = (rng) => {
  const n = pick(rng, [3, 4, 5, 10]);
  return {
    kind: 'number', prob: true,
    body: `A game show has ${n} doors, one car. You pick one; the host, who knows where the car is, opens ${n - 2} other door${n - 2 === 1 ? '' : 's'} with goats behind them, leaving one closed door besides yours. What's your chance of winning if you **switch** to it?`,
    answer: (n - 1) / n, tol: 0.006,
    hint: 'Switching wins exactly when your first pick was wrong.',
    explain: `Your first pick is right 1/${n} of the time, so switching wins the other ${n - 1}/${n} ≈ ${pct((n - 1) / n)}.`,
  };
};

const genRelativeRisk: Generator = (rng) => {
  const base = pick(rng, [1, 2, 4, 5]); // per 10,000
  const mult = pick(rng, [1.5, 2, 3]);
  const after = base * mult;
  return {
    kind: 'number',
    body: `A headline says a habit "raises your risk by ${pct(mult - 1, 0)}". The illness normally affects ${base} in 10,000 people. With the habit, how many in 10,000 would get it?`,
    answer: after, tol: 0.01, unit: 'in 10,000',
    explain: `${pct(mult - 1, 0)} more than ${base} is ${num(after)}: an extra ${num(after - base)} in 10,000. A big relative change can be a tiny absolute one.`,
  };
};

// ---------------------------------------------------------------- course

export const probability: Course = {
  id: 'probability',
  title: 'Probability',
  blurb: 'Chances, counting, the long run, and the traps that fool smart people.',
  color: C.a,
  icon: '🎲',
  lessons: [
    {
      id: 'chances',
      title: 'What are the chances?',
      goal: 'Turn a situation into a probability.',
      steps: [
        {
          kind: 'choice',
          body: 'A bag holds 3 red marbles and 1 blue one. Reach in without looking. Which is more likely?',
          options: [
            { text: 'Red', correct: true },
            { text: 'Blue', why: 'There’s only one blue marble against three red ones.' },
            { text: 'Equally likely', why: 'Two colours doesn’t mean two equal chances: there are more red marbles.' },
          ],
          explain: 'Three of the four marbles are red, so red is three times as likely as blue.',
        },
        {
          kind: 'read',
          title: 'Probability is a fraction',
          body: 'When every outcome is equally likely, the probability of an event is\n\n**favourable outcomes ÷ all outcomes**\n\nRed: 3 of 4 marbles, so **3/4** (0.75, or 75%). Blue: **1/4**. A probability is always between 0 (impossible) and 1 (certain).',
          widget: splitBar([{ p: 0.75, color: C.d, label: 'red' }, { p: 0.25, color: C.a, label: 'blue' }]),
        },
        {
          kind: 'number', prob: true,
          body: 'A fair die has six faces, 1 to 6. What is the probability of rolling a number **greater than 4**?',
          answer: 1 / 3, tol: 0.004,
          hint: 'Which faces are greater than 4?',
          explain: 'Two faces (5 and 6) out of six: 2/6 = 1/3 ≈ 33%.',
        },
        {
          kind: 'choice',
          body: 'Your friend says: “It either rains tomorrow or it doesn’t, so the chance of rain is 50%.” What’s wrong?',
          options: [
            { text: 'The two outcomes aren’t equally likely', correct: true },
            { text: 'Nothing: two outcomes means 1/2 each', why: 'Counting outcomes only works when they’re equally likely. Win the lottery or don’t: not 50/50.' },
            { text: 'There are really three outcomes', why: 'Even with the right number of outcomes, they’d need to be equally likely for counting to work.' },
          ],
          explain: '“Favourable over total” only works for equally likely outcomes. Rain on a given day might be 10% in a desert and 70% in a rainforest.',
        },
        {
          kind: 'number', prob: true,
          body: 'A deck has 52 cards: 4 suits of 13. You draw one. What is the probability it’s a **heart**?',
          answer: 0.25, tol: 0.003,
          explain: '13 hearts out of 52 cards: 13/52 = 1/4.',
        },
        {
          kind: 'estimate',
          body: 'Calibration check: roughly what chance would you give that a randomly chosen person was born on a **weekend**?',
          min: 0, max: 100, step: 1, answer: 29, tol: 5, format: (v) => `${v}%`,
          explain: '2 of 7 days: about 29%. (Births are actually a bit rarer on weekends because of scheduled deliveries, but 2/7 is the right first guess.)',
        },
        {
          kind: 'number', prob: true,
          body: 'The chance of drawing a heart is 1/4. What’s the chance of drawing a card that is **not** a heart?',
          answer: 0.75, tol: 0.003,
          hint: 'The two cases cover everything.',
          explain: 'Heart or not-heart covers every card, so the chances add to 1: 1 − 1/4 = 3/4. This “complement” trick is one of the most useful in probability.',
        },
      ],
      practice: [genSimple, genComplement],
    },
    {
      id: 'counting',
      title: 'Counting outcomes',
      goal: 'List outcomes carefully, especially with two dice.',
      steps: [
        {
          kind: 'choice',
          body: 'Roll two dice and add them. Which sum is more likely: **2** or **7**?',
          options: [
            { text: '7', correct: true },
            { text: '2', why: 'A 2 needs both dice to show 1, which is only one combination.' },
            { text: 'Equally likely', why: 'Sums aren’t equally likely: some can be made in more ways.' },
          ],
          explain: 'Only one pair makes 2 (1+1), but six pairs make 7. Let’s see them.',
        },
        {
          kind: 'read',
          title: '36 equally likely pairs',
          body: 'Treat the dice as different (one red, one blue). Then each of the 36 **pairs** is equally likely. The highlighted cells all sum to 7.',
          widget: diceGrid({ show: (a, b) => a + b === 7 }),
        },
        {
          kind: 'task',
          body: 'Tap every outcome where the sum is **8**.',
          widget: diceGrid({ target: (a, b) => a + b === 8 }),
          hint: 'Start with 2+6 and walk along: 3+5, 4+4…',
          explain: 'Five pairs: 2·6, 3·5, 4·4, 5·3, 6·2. So P(sum = 8) = 5/36 ≈ 14%.',
        },
        {
          kind: 'number', prob: true,
          body: 'Using the grid: what is the probability that the two dice show the **same number** (a double)?',
          widget: diceGrid({ show: (a, b) => a === b }),
          answer: 1 / 6, tol: 0.003,
          explain: 'Six doubles out of 36 pairs: 6/36 = 1/6.',
        },
        {
          kind: 'choice',
          body: 'A classic mistake: “There are 11 possible sums (2 to 12), so each has probability 1/11.” Why is that wrong?',
          options: [
            { text: 'The sums aren’t equally likely', correct: true },
            { text: 'There are actually 12 sums', why: 'There are 11 sums; the problem is that they don’t all have the same chance.' },
            { text: 'It’s right', why: 'Check the grid: 7 appears six times, 2 only once.' },
          ],
          explain: 'Always count the equally likely outcomes (the 36 pairs), not the categories you care about.',
        },
        {
          kind: 'task',
          body: 'Tap every outcome where **at least one die shows a 6**.',
          widget: diceGrid({ target: (a, b) => a === 6 || b === 6 }),
          hint: 'A full row and a full column, but don’t count 6·6 twice.',
          explain: '6 + 6 − 1 = 11 outcomes (6·6 is in both the row and the column). So 11/36 ≈ 31%, not 2/6.',
        },
        {
          kind: 'number', prob: true,
          body: 'What’s the probability that the sum of two dice is **10 or more**?',
          answer: 6 / 36, tol: 0.003,
          hint: 'Count sums of 10, 11 and 12 separately.',
          explain: '10: three ways, 11: two ways, 12: one way. 6/36 = 1/6.',
        },
      ],
      practice: [genDiceSum, genSimple],
    },
    {
      id: 'long-run',
      title: 'The long run',
      goal: 'Know what probability predicts, and what it doesn’t.',
      steps: [
        {
          kind: 'estimate',
          body: 'You flip a fair coin 10 times. How many heads is the **most likely** count?',
          min: 0, max: 10, step: 1, answer: 5, tol: 0, format: (v) => `${v} heads`,
          explain: '5 is the single most likely count, but it only happens about 25% of the time. Small samples wobble a lot.',
        },
        {
          kind: 'read',
          title: 'Flip and watch',
          body: 'Flip a few times, then a thousand. The **share** of heads wanders at first, then settles near 50%. That settling is the **law of large numbers**.',
          widget: coinFlipper(),
        },
        {
          kind: 'choice',
          body: 'After 1,000 flips the share of heads is close to 50%. What about the **difference** between heads and tails counts?',
          options: [
            { text: 'It usually grows, even as the share settles', correct: true },
            { text: 'It shrinks to zero', why: 'The share approaches 1/2, but the raw gap typically grows (roughly like √n).' },
            { text: 'It always stays under 10', why: 'Gaps of 20 or 30 are normal after a thousand flips.' },
          ],
          explain: 'The law of large numbers is about proportions, not counts. Being 30 heads ahead after 1,000 flips is 3%, a small share.',
        },
        {
          kind: 'choice',
          body: 'A roulette wheel has landed on red 8 times in a row. A gambler bets big on black, “because black is due”. Is black more likely now?',
          options: [
            { text: 'No: the wheel has no memory', correct: true },
            { text: 'Yes: it has to even out', why: 'It evens out by being swamped with many future spins, not by correcting past ones.' },
            { text: 'No: red is more likely now, it’s on a streak', why: 'A fair wheel doesn’t get hot either.' },
          ],
          explain: 'This is the **gambler’s fallacy**. Independent events don’t remember. The long run “evens out” in proportion only because new results dilute old ones.',
        },
        {
          kind: 'choice',
          body: 'A small hospital has 15 births a day, a large one 45. Over a year, which has **more days where over 60% of babies are boys**?',
          options: [
            { text: 'The small hospital', correct: true },
            { text: 'The large hospital', why: 'More births means the share stays closer to 50%.' },
            { text: 'About the same', why: 'Sample size matters a lot for how far a share strays.' },
          ],
          explain: 'Small samples swing more. This question (from Kahneman and Tversky) fools most people, who answer “about the same”.',
        },
        {
          kind: 'choice',
          body: 'A town’s cancer rate is the highest in the country. Another small town has the lowest. What’s the most likely explanation for both?',
          options: [
            { text: 'Both are small towns, so their rates swing to extremes by chance', correct: true },
            { text: 'The first town has a cause, the second a protection', why: 'Possible, but extremes at both ends point to small samples first.' },
            { text: 'Bad record keeping', why: 'No need to assume that: chance alone produces extremes in small groups.' },
          ],
          explain: 'Both the highest and lowest rates usually come from the smallest places. Before looking for a cause, check the sample size.',
        },
      ],
      practice: [genGambler, genComplement],
    },
    {
      id: 'and-or',
      title: 'And, or, at least one',
      goal: 'Combine chances: multiply for “and”, use the complement for “at least one”.',
      steps: [
        {
          kind: 'number', prob: true,
          body: 'Flip a coin and roll a die. What’s the probability of **heads and a six**?',
          answer: 1 / 12, tol: 0.003,
          hint: 'How many equally likely (coin, die) combinations are there?',
          explain: '2 × 6 = 12 combinations, one of which is heads-and-six: 1/12. Equivalently ½ × ⅙.',
        },
        {
          kind: 'read',
          title: 'Independent events multiply',
          body: 'If one event doesn’t affect the other, the chance of **both** is the product:\n\nP(A and B) = P(A) × P(B)\n\nMultiplying fractions makes things smaller, as it should: both happening is rarer than either.',
        },
        {
          kind: 'number', prob: true,
          body: 'Three coin flips. What’s the probability they’re **all heads**?',
          answer: 0.125, tol: 0.002,
          explain: '½ × ½ × ½ = 1/8.',
        },
        {
          kind: 'choice',
          body: 'Roll a die 4 times. A friend says the chance of at least one six is 4 × 1/6 = 2/3. Why can’t that be right?',
          options: [
            { text: 'By that logic, 7 rolls would give more than 100%', correct: true },
            { text: 'It’s right', why: 'Try it with 7 rolls: 7/6 is over 1, impossible.' },
            { text: 'It should be 1/6 because each roll is independent', why: 'Each roll is 1/6, but more rolls do give more chances.' },
          ],
          explain: 'Adding chances double-counts the cases with two or more sixes. The fix: work out the chance of **no** six, then take it from 1.',
        },
        {
          kind: 'number', prob: true,
          body: 'Roll a die 4 times. What’s the probability of **no six at all**?',
          answer: Math.pow(5 / 6, 4), tol: 0.004,
          hint: 'Each roll avoids a six with probability 5/6.',
          explain: '(5/6)⁴ = 625/1296 ≈ 0.482.',
        },
        {
          kind: 'number', prob: true,
          body: 'So what’s the probability of **at least one six** in 4 rolls?',
          answer: 1 - Math.pow(5 / 6, 4), tol: 0.004,
          explain: '1 − 0.482 ≈ 0.518. Slightly better than even: this was a famous 17th-century gambling bet.',
        },
        {
          kind: 'estimate',
          body: 'A password guess works with probability 1 in 1,000 per try. You try 1,000 times (different guesses, each independent). Roughly what’s the chance at least one works?',
          min: 0, max: 100, step: 1, answer: 63, tol: 4, format: (v) => `${v}%`,
          explain: '1 − (999/1000)¹⁰⁰⁰ ≈ 1 − 1/e ≈ 63%. Not 100%: some guesses “collide” in luck. This 63% rule of thumb shows up everywhere.',
        },
      ],
      practice: [genAtLeastOneSix, genIndependent],
    },
    {
      id: 'conditional',
      title: 'Given that…',
      goal: 'Update a probability when you learn something.',
      steps: [
        {
          kind: 'number', prob: true,
          body: 'Roll a die. A friend peeks and says “it’s even”. What’s the probability it’s a **six** now?',
          answer: 1 / 3, tol: 0.004,
          hint: 'Which faces are still possible?',
          explain: 'Only 2, 4 and 6 remain, equally likely: 1/3. New information shrinks the set of possibilities.',
        },
        {
          kind: 'read',
          title: 'Conditioning = shrinking the world',
          body: '**P(A given B)** asks: among the cases where B happened, how often does A happen?\n\nYou throw away every case where B didn’t happen and count again inside what’s left.',
        },
        {
          kind: 'number', prob: true,
          body: 'Two dice. Given that the sum is **8**, what’s the probability that one of the dice shows a **6**?',
          widget: diceGrid({ show: (a, b) => a + b === 8 }),
          answer: 2 / 5, tol: 0.004,
          hint: 'The highlighted cells are your new world. In how many is there a 6?',
          explain: 'Five pairs sum to 8, and two of them (2·6 and 6·2) contain a six: 2/5.',
        },
        {
          kind: 'choice',
          body: 'Most car crashes happen within 10 km of home. Does that mean driving near home is especially dangerous?',
          options: [
            { text: 'No: most driving happens near home', correct: true },
            { text: 'Yes: people relax near home', why: 'Maybe, but the statistic alone can’t show it. You’d need crashes per km driven.' },
            { text: 'Yes: the numbers prove it', why: 'P(near home | crash) is high because P(near home | driving) is high.' },
          ],
          explain: 'P(near home | crash) is not P(crash | near home). Confusing the two is one of the most common reasoning errors.',
        },
        {
          kind: 'number', prob: true,
          body: 'A class: 12 students play football, 8 play chess, and 3 play both. Pick a **chess player** at random. What’s the chance they also play football?',
          answer: 3 / 8, tol: 0.004,
          explain: 'Among the 8 chess players, 3 play football: 3/8.',
        },
        {
          kind: 'number', prob: true,
          body: 'Same class. Pick a **football player** at random. What’s the chance they play chess?',
          answer: 3 / 12, tol: 0.004,
          explain: '3 of 12 = 1/4. Same overlap, different denominator: “given” changes which group you count within.',
        },
      ],
      practice: [genConditional],
    },
    {
      id: 'expected-value',
      title: 'Expected value',
      goal: 'Price a gamble by its long-run average.',
      steps: [
        {
          kind: 'choice',
          body: 'Choose: a **sure $50**, or a coin flip for **$120 or nothing**. Which pays more on average?',
          options: [
            { text: 'The coin flip', correct: true },
            { text: 'The sure $50', why: 'Played many times, the flip averages $60 a go.' },
            { text: 'They’re the same', why: 'Half of $120 is $60, more than $50.' },
          ],
          explain: 'Half the time $120, half the time $0: an average of $60. You might still prefer the sure thing, and that’s about risk, which comes later. On average, though, the flip wins.',
        },
        {
          kind: 'read',
          title: 'Expected value',
          body: 'The **expected value** is the average result per try if you repeated a gamble forever:\n\n**sum of (probability × payoff)** over the outcomes.\n\nFor the flip: ½ × $120 + ½ × $0 = $60.',
        },
        {
          kind: 'number', unit: '$',
          body: 'A raffle sells tickets for $5. One ticket in 200 wins $500. What’s the expected **profit** per ticket (negative if you lose)?',
          answer: -2.5, tol: 0.01,
          hint: 'Expected winnings minus the ticket price.',
          explain: '(1/200) × $500 = $2.50 expected winnings, minus $5: −$2.50 per ticket. Raffles fund charities for a reason.',
        },
        {
          kind: 'number', unit: '$',
          body: 'Roll one die and win that many dollars ($1 for a 1, $6 for a 6). What’s a fair price to play?',
          answer: 3.5, tol: 0.01,
          explain: '(1+2+3+4+5+6)/6 = 3.5. You can never roll 3.5. The expected value is an average, not an outcome.',
        },
        {
          kind: 'choice',
          body: 'An insurance policy costs $300 a year. The insurer expects to pay out $240 per customer on average. Is buying it irrational?',
          options: [
            { text: 'Not necessarily: it protects against a loss you couldn’t afford', correct: true },
            { text: 'Yes: negative expected value is always a bad deal', why: 'Expected value ignores how much a big loss would hurt you.' },
            { text: 'Yes, because insurers always win', why: 'They do win on average. That’s the price of moving the risk to them.' },
          ],
          explain: 'Expected value is the right tool for repeated small bets. For rare ruinous losses, paying a little extra to avoid disaster can be wise.',
        },
        {
          kind: 'number', unit: '$',
          body: 'A startup pays out $1,000,000 with probability 2%, $50,000 with probability 18%, and $0 otherwise. What’s its expected payoff?',
          answer: 29000, tol: 1,
          explain: '0.02 × 1,000,000 + 0.18 × 50,000 = 20,000 + 9,000 = $29,000. Most of the value is in the rare big outcome.',
        },
      ],
      practice: [genEV],
    },
    {
      id: 'monty-hall',
      title: 'The Monty Hall problem',
      goal: 'Use what the host’s choice tells you.',
      steps: [
        {
          kind: 'choice',
          body: 'Three doors: a car behind one, goats behind two. You pick door 1. The host, **who knows** where the car is, opens door 3: a goat. He offers you door 2. Should you switch?',
          options: [
            { text: 'Switch', correct: true },
            { text: 'Stay', why: 'Staying wins only if your first pick was right: 1 in 3.' },
            { text: 'It doesn’t matter, it’s 50/50', why: 'This is the answer almost everyone gives, including many mathematicians in 1990. Try it below.' },
          ],
          explain: 'Switching wins 2/3 of the time. Play it below to convince yourself.',
        },
        {
          kind: 'read',
          title: 'Play it',
          body: 'Play a few rounds by hand, then simulate 100 games for each strategy.',
          widget: montyHall(),
        },
        {
          kind: 'choice',
          body: 'Why does switching win 2/3 of the time?',
          options: [
            { text: 'Switching wins exactly when your first pick was wrong, which happens 2/3 of the time', correct: true },
            { text: 'Because two doors are left and the host’s door adds a third chance', why: 'Not quite: the key is what your first pick’s chance was.' },
            { text: 'It doesn’t; it’s luck', why: 'The simulation shows a steady 2/3. Try a few hundred games.' },
          ],
          explain: 'The host never opens your door or the car. If you started on a goat (2/3 likely), he’s forced to leave the car behind the other door.',
        },
        {
          kind: 'number', prob: true,
          body: 'Now 100 doors. You pick one; the host opens 98 goat doors, leaving yours and one other. What’s your chance if you **switch**?',
          answer: 0.99, tol: 0.002,
          explain: 'Your first pick was right 1/100 of the time. Switching wins the other 99/100. With 100 doors the intuition becomes obvious.',
        },
        {
          kind: 'choice',
          body: 'Twist: the host **doesn’t know** where the car is. He opens a door at random and it happens to show a goat. Now should you switch?',
          options: [
            { text: 'It doesn’t matter now: 50/50', correct: true },
            { text: 'Switch, still 2/3', why: 'The 2/3 came from the host’s knowledge. A random reveal that happens to show a goat carries less information.' },
            { text: 'Stay', why: 'Staying is no better than switching here.' },
          ],
          explain: 'What matters is how the information was produced. A random reveal could have shown the car; given that it didn’t, both remaining doors are equally likely.',
        },
      ],
      practice: [genMonty],
    },
    {
      id: 'reading-risk',
      title: 'Reading risk',
      goal: 'See through headline numbers: relative vs absolute, and base rates.',
      steps: [
        {
          kind: 'choice',
          body: 'A headline: “New pill **doubles** the risk of a rare clot.” The risk was 1 in 10,000. What is it now?',
          options: [
            { text: '2 in 10,000', correct: true },
            { text: '50%', why: 'Doubling a tiny risk gives a slightly less tiny risk.' },
            { text: '1 in 2', why: '“Doubles” applies to the 1-in-10,000, not to 50%.' },
          ],
          explain: 'A 100% **relative** increase, but an **absolute** increase of 1 in 10,000. Always ask: twice what?',
        },
        {
          kind: 'read',
          title: 'Relative vs absolute',
          body: '**Relative risk** says how much a risk changes by (doubles, +30%).\n\n**Absolute risk** says how many people are affected (2 in 10,000).\n\nHeadlines prefer relative numbers: they sound bigger. Decisions need absolute ones.',
        },
        {
          kind: 'number', unit: 'in 1,000',
          body: 'Screening cuts deaths from a disease by 20%. Without screening, 5 in 1,000 people die of it. How many in 1,000 **with** screening?',
          answer: 4, tol: 0.01,
          explain: '20% of 5 is 1, so 4 in 1,000. A 20% relative reduction saves 1 person per 1,000 screened.',
        },
        {
          kind: 'choice',
          body: 'A test for a rare disease is 99% accurate. Only 1 in 1,000 people have the disease. You test positive. Is it 99% likely you have it?',
          options: [
            { text: 'No: far less, because the disease is so rare', correct: true },
            { text: 'Yes: the test is 99% accurate', why: 'Out of 1,000 people about 10 healthy ones test positive (1% false alarms), versus about 1 truly sick one.' },
            { text: 'It’s 50%', why: 'Close in spirit, but the numbers make it closer to 9%.' },
          ],
          explain: 'With 1,000 people: about 1 sick person tests positive, and about 10 healthy people get false positives. So a positive means about 1 in 11 ≈ 9%. That’s the **base rate**, the heart of Bayesian thinking (the next course).',
        },
        {
          kind: 'number', prob: true,
          body: 'Check it: 1 true positive and about 10 false positives. What fraction of positive tests are real?',
          widget: dots([{ n: 1, color: C.d, label: 'sick, positive' }, { n: 10, color: C.b, label: 'healthy, positive' }], 11),
          answer: 1 / 11, tol: 0.004,
          explain: '1 out of 11 positives ≈ 9%. The rarer the condition, the more the false alarms dominate.',
        },
      ],
      practice: [genRelativeRisk],
    },
  ],
};
