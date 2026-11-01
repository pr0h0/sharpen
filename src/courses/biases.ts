// Thinking Errors: fall for the trap first, see why, then practise spotting it elsewhere.
import type { Choice, Course, Generator } from '../types';
import { bomber, framePair, rangeQuiz, regressionSim, ruleGame } from '../widgets/biases';
import { dots } from '../widgets/prob';
import { num, pct, pick, randInt, shuffle } from '../ui';

const C = { a: '#4f8cff', b: '#f2a33a', c: '#43b581', d: '#e5534b', e: '#a371f7', mute: '#8b95a7' };

// ---------------------------------------------------------------- the biases

type BiasId = 'anchoring' | 'availability' | 'confirmation' | 'survivorship' | 'regression' | 'framing' | 'conjunction' | 'overconfidence';

interface Bias {
  /** Option text: name plus a short gloss, so it reads well even before the lesson. */
  label: string;
  /** Why a scenario that isn't this bias isn't it. */
  notIt: string;
  /** What to do about it. */
  counter: string;
}

const BIAS: Record<BiasId, Bias> = {
  anchoring: {
    label: 'Anchoring (pulled towards a number you saw first)',
    notIt: 'Anchoring needs a starting number that drags an estimate towards it. No number is doing that here.',
    counter: 'Counter-move: make your own estimate before you see anyone else’s number, and ask what you’d think if the first number had been very different.',
  },
  availability: {
    label: 'Availability (judging by what comes to mind easily)',
    notIt: 'Availability is about judging how common or likely something is by how easily examples spring to mind. That isn’t the main thing going on.',
    counter: 'Counter-move: ask whether it comes to mind because it’s common, or because it was vivid, recent or in the news, then look up the actual rate.',
  },
  confirmation: {
    label: 'Confirmation bias (looking for evidence that you’re right)',
    notIt: 'Confirmation bias is seeking or favouring evidence for a belief you already hold. Nobody is filtering evidence to protect a belief here.',
    counter: 'Counter-move: ask “what would I expect to see if I were wrong?”, and go and look for exactly that.',
  },
  survivorship: {
    label: 'Survivorship bias (only seeing the ones that made it)',
    notIt: 'Survivorship bias means drawing conclusions only from the cases that got through some filter. Nothing has been filtered out of view here.',
    counter: 'Counter-move: ask what had to happen for a case to reach you, and go looking for the failures you never hear about.',
  },
  regression: {
    label: 'Regression to the mean (extremes drift back towards average)',
    notIt: 'Regression to the mean is about an extreme result, partly luck, being followed by a more ordinary one. There’s no extreme being re-measured here.',
    counter: 'Counter-move: after an unusually good or bad result, expect the next to be more ordinary, and compare with a group that got no treatment before crediting any cause.',
  },
  framing: {
    label: 'Framing (same facts, different wording)',
    notIt: 'Framing is when the very same facts, described differently, change the choice. Here the facts aren’t simply being re-described.',
    counter: 'Counter-move: restate it the other way (survival as deaths, a discount as a surcharge) and check your choice survives the translation.',
  },
  conjunction: {
    label: 'Conjunction fallacy (rating “A and B” likelier than A)',
    notIt: 'The conjunction fallacy is judging a combination of events as likelier than one of its parts. No combined event is being compared here.',
    counter: 'Counter-move: every extra detail is another thing that has to be true. Ask how likely each part is; the whole can’t beat its least likely part.',
  },
  overconfidence: {
    label: 'Overconfidence (too sure, too optimistic about plans)',
    notIt: 'Overconfidence is being too sure of your own judgement, with ranges too narrow or plans too rosy. That isn’t the core error here.',
    counter: 'Counter-move: widen your ranges, and forecast from how similar cases actually turned out (the outside view), not from your plan.',
  },
};
const ALL_BIASES = Object.keys(BIAS) as BiasId[];

interface Scenario {
  bias: BiasId;
  text: string;
  /** One line on what gives it away. */
  note: string;
  /** Biases too close to this scenario to offer as wrong answers. */
  not?: BiasId[];
}

const SCENARIOS: Scenario[] = [
  // anchoring
  { bias: 'anchoring', text: 'A charity’s form suggests gifts of £50, £100 or £250. Donors who see it give more than donors whose form suggests £5, £10 or £20.', note: 'The suggested amounts are starting points that donors adjust from.' },
  { bias: 'anchoring', text: 'Before guessing the population of Turkey, Sam is asked whether it’s more or less than 20 million. His friend is asked about 150 million. Sam’s guess comes out far lower.', note: 'Each guess was pulled towards the number in the question.' },
  { bias: 'anchoring', text: 'A jacket is labelled “Was £240, now £120”. Priya thinks £120 is a bargain, though she’d never have paid that for it with no “was” price on the tag.', note: 'The “was” price sets the reference point the new price is judged against.', not: ['framing'] },
  { bias: 'anchoring', text: 'A dealer opens at £18,000 for a car that’s worth about £12,000. After hard bargaining, Leo pays £15,000 and feels he won.', note: 'The opening price set where the haggling started.' },
  { bias: 'anchoring', text: 'A menu puts a £95 steak at the top. Next to it, the £45 fish suddenly looks reasonable.', note: 'The £95 sets a high reference point for everything after it.' },
  { bias: 'anchoring', text: 'Judges read a case in which the prosecutor asks for a long sentence. Their own sentences come out longer than those of judges who read the same case with a lower demand.', note: 'The demanded sentence was the starting point for theirs.' },
  // availability
  { bias: 'availability', text: 'After a week of news coverage of a plane crash, Mia drives 600 km instead of flying, feeling safer.', note: 'The crash is vivid and recent; the far larger risk of the long drive isn’t.' },
  { bias: 'availability', text: 'Two of Jon’s neighbours were burgled this month, so he’s sure burglary in his area is soaring. Police records show it has fallen for years.', note: 'Two memorable local cases outweigh the records in his mind.' },
  { bias: 'availability', text: 'After watching a documentary about shark attacks, Tom won’t swim in the sea, though he happily drives to the beach.', note: 'Shark attacks are vivid but very rare; the drive is the real risk.' },
  { bias: 'availability', text: 'A doctor who recently treated a striking case of a rare disease starts suspecting it in patients with common, everyday symptoms.', note: 'The recent case is easy to recall, which makes the disease feel common.' },
  { bias: 'availability', text: 'Many people buy flood insurance right after a flood in their area, then let it lapse a few years later, though the risk hasn’t changed.', note: 'The risk feels big while the memory is fresh, and shrinks as it fades.' },
  { bias: 'availability', text: 'Asked what share of the household chores they do, both partners in a couple give numbers that add up to well over 100%.', note: 'Your own efforts are easy to recall; your partner’s mostly happen when you aren’t looking.' },
  // confirmation
  { bias: 'confirmation', text: 'Ana believes her new supplement helps her sleep. She remembers every good night after taking it and shrugs off the bad ones.', note: 'Hits are noticed and kept; misses are explained away.' },
  { bias: 'confirmation', text: 'Searching “why is coffee bad for you”, Kim reads the top few results, all agreeing, and stops there.', note: 'A leading search finds agreement, and she stopped once she had it.' },
  { bias: 'confirmation', text: 'An investor sure a company will soar reads only the upbeat analysts, and dismisses the sceptics as “not getting it”.', note: 'Supporting views are sought out and opposing ones waved away.' },
  { bias: 'confirmation', text: 'A detective decides early on who did it. From then on, every new clue somehow seems to fit that suspect.', note: 'New evidence is read in the light of the belief instead of testing it.' },
  { bias: 'confirmation', text: 'Sure a candidate is weak after a glance at the CV, an interviewer asks only about gaps and failures, never about strengths.', note: 'The questions are chosen so they can only confirm the first impression.' },
  { bias: 'confirmation', text: 'Raj is convinced his new website button works better. He checks the results only on the days it did well, and calls it a success.', note: 'He looked only where he expected support.' },
  // survivorship
  { bias: 'survivorship', text: 'A magazine profiles ten university dropouts who became billionaires and suggests that leaving university helps you succeed.', note: 'The many dropouts who didn’t become rich don’t get profiles.' },
  { bias: 'survivorship', text: '“They built things to last back then,” says Pat, pointing at the town’s beautiful 200-year-old buildings.', note: 'The badly built old buildings fell down or were demolished long ago.' },
  { bias: 'survivorship', text: 'An investment firm says its funds have averaged 11% a year, counting only the funds it still runs. Poor performers were closed or merged.', note: 'The failures were quietly removed from the average.' },
  { bias: 'survivorship', text: 'An author studies twenty very successful companies, finds their founders all took bold risks, and advises readers to take bold risks.', note: 'Plenty of failed companies probably had bold founders too, but they weren’t studied.' },
  { bias: 'survivorship', text: '“Music was better in the 1970s,” says Dee. The songs from then that she still hears on the radio are all classics.', note: 'Only the best songs of the past are still played; the forgettable ones have been forgotten.' },
  { bias: 'survivorship', text: 'Every successful musician interviewed says “never give up”, so Ben concludes that persistence is what makes musicians succeed.', note: 'Persistent musicians who never made it aren’t interviewed.', not: ['confirmation'] },
  // regression
  { bias: 'regression', text: 'A club sacks its manager after a record-bad season. The next season is better, and the new manager gets all the credit.', note: 'A record-bad season is partly bad luck, so some recovery was likely anyway.' },
  { bias: 'regression', text: 'A teacher praises the pupils who came top in Monday’s quiz. On Friday most of them score lower, so she decides praise makes pupils lazy.', note: 'Top scores include good luck, which doesn’t repeat on Friday.' },
  { bias: 'regression', text: 'Athletes who have a stunning first season often do noticeably less well in their second. Commentators blame the pressure of fame.', note: 'A stunning season is partly luck; the next is likely to be more ordinary.' },
  { bias: 'regression', text: 'Speed cameras go up at the junctions that had the most crashes last year. Next year crashes there fall, and the whole drop is credited to the cameras.', note: 'Junctions picked for a bad year tend to have a more normal year next, cameras or not.' },
  { bias: 'regression', text: 'People try a new remedy for back pain on the day it’s at its worst. Most feel better within a week and credit the remedy.', note: 'Pain at its worst usually eases anyway; they started at an extreme.', not: ['confirmation'] },
  { bias: 'regression', text: 'A shop’s best-selling month ever is followed by a weaker one, and the owner worries the business is in trouble.', note: 'A record month is partly luck; a more ordinary month after it is expected.' },
  // framing
  { bias: 'framing', text: 'Shoppers rate minced beef labelled “75% lean” as better and less greasy than the same beef labelled “25% fat”.', note: '75% lean and 25% fat are the same fact.' },
  { bias: 'framing', text: 'Patients are more willing to have an operation when told that 90% survive than when told that 10% die.', note: '90% surviving and 10% dying describe the same outcome.' },
  { bias: 'framing', text: 'More staff join a pension scheme when told they’ll lose their employer’s contributions if they don’t join than when told they’ll gain them if they do.', note: 'Losing and failing to gain the same money is the same outcome, but losses loom larger.' },
  { bias: 'framing', text: 'Customers resent a £2 “card surcharge” but happily accept a shop that gives a £2 “cash discount”, though the prices work out identically.', note: 'A surcharge feels like a loss; a missed discount doesn’t.' },
  { bias: 'framing', text: 'A plan described as cutting unemployment from 10% to 8% wins more support than one raising employment from 90% to 92%, which is the same change.', note: 'Same numbers, described as a loss shrinking rather than a gain growing.' },
  { bias: 'framing', text: 'People rate a contraceptive described as “95% effective” as better than one with “a 5% failure rate”.', note: '95% effective and a 5% failure rate are the same.' },
  // conjunction
  { bias: 'conjunction', text: 'Reading about a quiet, tidy man who loves poetry, Jo rates “he’s a librarian who writes poetry” as more likely than “he’s a librarian”.', note: 'Every librarian who writes poetry is a librarian, so the first can’t be likelier.' },
  { bias: 'conjunction', text: 'A fan rates “the team loses its first match, then wins the cup” as more likely than “the team wins the cup”.', note: 'The first adds a condition to the second, so it can only be less likely.' },
  { bias: 'conjunction', text: 'A forecaster rates “a trade war, followed by a recession next year” as more probable than “a recession next year”.', note: 'Recession-after-a-trade-war is one particular way of having a recession.' },
  { bias: 'conjunction', text: 'A juror finds “he argued with the victim, then went back to the house and attacked him” more probable than “he attacked the victim”.', note: 'The detailed story includes the simple one plus more, so it’s less probable, however convincing it feels.' },
  { bias: 'conjunction', text: 'Asked about a sporty, outgoing student, people rate “studies medicine and plays rugby” as more likely than “studies medicine”.', note: 'Adding “and plays rugby” can only remove possibilities.' },
  // overconfidence
  { bias: 'overconfidence', text: 'Noor’s last four reports each took about three weeks. She plans to finish this one in a week, because this time she’s organised.', note: 'She trusts her plan over her own track record.' },
  { bias: 'overconfidence', text: 'A city budgets a new stadium as if nothing will go wrong. It opens two years late and at twice the cost.', note: 'The budget assumed the best case instead of how such projects usually go.' },
  { bias: 'overconfidence', text: 'Asked for ranges they’re 90% sure contain various companies’ revenues, analysts give ranges that miss the truth nearly half the time.', note: 'Ranges that miss half the time are far too narrow for 90%.' },
  { bias: 'overconfidence', text: 'Most drivers in a survey rate themselves as more skilful than the average driver.', note: 'Most people can’t all be above average.' },
  { bias: 'overconfidence', text: 'Planning a kitchen refit, Max adds up the steps and expects a month, ignoring that every friend’s refit ran well over.', note: 'He uses the inside view (his plan) and ignores the outside view (what usually happens).' },
];

/** Spot-the-bias problems from the scenario pool. Distractors come from all biases. */
function genSpot(only: BiasId[]): Generator {
  const pool = SCENARIOS.filter((s) => only.includes(s.bias));
  return (rng) => {
    const s = pick(rng, pool);
    const others = shuffle(rng, ALL_BIASES.filter((b) => b !== s.bias && !(s.not ?? []).includes(b))).slice(0, 3);
    const options: Choice[] = [
      { text: BIAS[s.bias].label, correct: true },
      ...others.map((b) => ({ text: BIAS[b].label, why: BIAS[b].notIt })),
    ];
    return {
      kind: 'choice',
      body: `Which thinking error is at work?\n\n*${s.text}*`,
      options,
      explain: `**${BIAS[s.bias].label.split(' (')[0]}.** ${s.note} ${BIAS[s.bias].counter}`,
    };
  };
}

const upTo = (n: number) => ALL_BIASES.slice(0, n);

// ---------------------------------------------------------------- other practice generators

const genWason: Generator = (rng) => {
  const sets = [
    { rule: 'If a card has a vowel on one side, it has an even number on the other.', p: pick(rng, ['A', 'E', 'U']), np: pick(rng, ['K', 'D', 'M']), q: pick(rng, ['4', '8', '2']), nq: pick(rng, ['7', '3', '9']), side: 'Each card has a letter on one side and a number on the other.' },
    { rule: 'If a card has a circle on one side, the other side is red.', p: 'circle', np: 'square', q: 'red', nq: 'blue', side: 'Each card has a shape on one side and a colour on the other.' },
    { rule: 'If someone is drinking beer, they must be over 18.', p: 'drinking beer', np: 'drinking lemonade', q: `aged ${randInt(rng, 25, 60)}`, nq: `aged ${randInt(rng, 14, 17)}`, side: 'Each card shows what a person is drinking on one side and their age on the other.' },
    { rule: 'If a parcel is sent first class, it has a gold sticker.', p: 'first class', np: 'second class', q: 'gold sticker', nq: 'silver sticker', side: 'Each card shows a parcel’s class on one side and its sticker on the other.' },
    { rule: `If a trip goes to ${pick(rng, ['Paris', 'Brussels'])}, it’s by train.`, p: '', np: pick(rng, ['Rome', 'Madrid']), q: 'train', nq: 'plane', side: 'Each card shows a destination on one side and the transport on the other.' },
  ];
  const s = pick(rng, sets);
  if (!s.p) s.p = s.rule.match(/to (\w+),/)![1];
  const cards = shuffle(rng, [s.p, s.np, s.q, s.nq]).map((c) => `**${c}**`).join(' · ');
  return {
    kind: 'choice',
    body: `Rule: *${s.rule}*\n\n${s.side} You see: ${cards}\n\nWhich cards must you turn over to check whether the rule is broken?`,
    options: [
      { text: `${s.p} and ${s.nq}`, correct: true },
      { text: `${s.p} and ${s.q}`, why: `“${s.q}” can’t break the rule: the rule says nothing about what must be behind it. That’s the confirming card, and it’s tempting for exactly that reason.` },
      { text: `${s.p} only`, why: `“${s.nq}” could also break the rule, if “${s.p}” is on its other side.` },
      { text: 'All four', why: `“${s.np}” and “${s.q}” can’t break the rule whatever is on the back, so turning them tells you nothing.` },
    ],
    explain: `Only a card with “${s.p}” and not “${s.q}” breaks the rule, so check “${s.p}” (what’s behind it?) and “${s.nq}” (is “${s.p}” behind it?). The pull towards “${s.q}” is confirmation bias: looking for a match instead of a counterexample. Counter-move: ask where a rule-breaker could be hiding.`,
  };
};

const genRegression: Generator = (rng) => {
  const ctx = pick(rng, [
    { m: 100, what: 'On a reasoning test, the average score is 100. Scores on two sittings a month apart', who: 'Someone scored', unit: 'points' },
    { m: 60, what: 'In a darts league, players average 60 points a round. A player’s scores in one round and the next', who: 'A player scored', unit: 'points' },
    { m: 50, what: 'A shop’s staff each sell 50 items a week on average. One week’s sales and the next week’s', who: 'Last week one person sold', unit: 'items' },
    { m: 70, what: 'On a typing test, the average speed is 70 words a minute. Speeds on two attempts', who: 'Someone managed', unit: 'words a minute' },
  ]);
  const r = pick(rng, [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
  const d = pick(rng, [-1, 1]) * randInt(rng, 2, 8) * 5;
  const x = ctx.m + d;
  const ans = ctx.m + r * d;
  return {
    kind: 'number', unit: ctx.unit,
    body: `${ctx.what} have a correlation of **${r}** (with the same spread each time). ${ctx.who} **${x}**. What’s the best prediction for their next result?`,
    answer: ans, tol: 0.5,
    hint: 'Start at the average and move only part of the way towards the extreme: correlation × distance.',
    explain: `Prediction = average + r × (score − average) = ${ctx.m} + ${r} × (${d > 0 ? d : '−' + Math.abs(d)}) = **${num(ans)}**. The weaker the correlation, the more the result is luck, and the further back towards the average you should expect it. That’s regression to the mean; the counter-move is to shrink extreme predictions towards the average.`,
  };
};

const genFraming: Generator = (rng) => {
  const t = randInt(rng, 0, 3);
  if (t === 0) {
    const s = randInt(rng, 60, 97);
    return {
      kind: 'number', unit: '%',
      body: `A surgeon tells you an operation has a **${s}%** five-year survival rate. Put in the other frame: what percentage of patients die within five years?`,
      answer: 100 - s, tol: 0.01,
      explain: `${s}% survive means ${100 - s}% die. Same fact, but in studies the “survive” version makes people noticeably keener on the operation. That’s framing; the counter-move is to say it both ways before you decide.`,
    };
  }
  if (t === 1) {
    const n = pick(rng, [300, 600, 900, 1200]);
    const sv = randInt(rng, 1, n / 100 - 1) * 100;
    return {
      kind: 'number', unit: 'people',
      body: `${n} people are at risk in an outbreak. A plan is described as “**${sv} people will be saved**”. Described as a loss instead, how many people will die?`,
      answer: n - sv, tol: 0.01,
      explain: `${n} − ${sv} = **${n - sv}** die. “${sv} saved” and “${n - sv} die” are the same plan. In the gain frame people tend to play safe; in the loss frame they tend to gamble. That’s framing; the counter-move is to translate it into the other frame and see if your choice changes.`,
    };
  }
  if (t === 2) {
    const f = pick(rng, [80, 85, 90, 95, 97, 99]);
    const food = pick(rng, ['yoghurt', 'sausage', 'cheese spread', 'ice cream']);
    return {
      kind: 'number', unit: '%',
      body: `A ${food} is labelled **“${f}% fat-free”**. What percentage of it is fat?`,
      answer: 100 - f, tol: 0.01,
      explain: `${f}% fat-free means **${100 - f}% fat**. Labels use the frame that sounds best. That’s framing; the counter-move is to flip the number round and see how it sounds then.`,
    };
  }
  const price = randInt(rng, 3, 20) * 5;
  const fee = pick(rng, [1, 2, 3, 5]);
  return {
    kind: 'number', unit: '£',
    body: `Shop A prices a lamp at £${price} with a £${fee} surcharge for paying by card. Shop B prices it at £${price + fee} with a £${fee} discount for cash. Paying by card, how many pounds **more** does it cost in shop A than in shop B?`,
    answer: 0, tol: 0.01,
    explain: `Card costs £${price + fee} in both shops, and cash £${price} in both: a difference of **£0**. A “surcharge” feels like a loss and a missed “discount” doesn’t, so shop B’s wording goes down better. That’s framing; the counter-move is to compare the actual amounts you pay.`,
  };
};

const genConjunction: Generator = (rng) => {
  const s = pick(rng, [
    { who: 'Sara is adventurous and has always talked about living abroad.', a: 'Sara gets a new job this year', b: 'and moves abroad for it', c: 'and moves to Lisbon for it' },
    { who: 'Dev loves cars and has saved for years.', a: 'Dev passes his driving test this year', b: 'and buys a car within a month', c: 'and buys a red sports car within a month' },
    { who: 'Mo’s team are top of the league.', a: 'Mo’s team wins its next match', b: 'and scores at least two goals', c: 'and scores at least two goals in the first half' },
    { who: 'Lena is a keen cook who reads restaurant reviews every week.', a: 'Lena opens a café within five years', b: 'and it gets a good review', c: 'and it gets a good review in a national paper' },
    { who: 'Kai trains for marathons and never misses a session.', a: 'Kai runs a marathon this year', b: 'and finishes in under four hours', c: 'and finishes in under four hours in the rain' },
  ]);
  const least = rng() < 0.5;
  const A = s.a, AB = `${s.a} ${s.b}`;
  const full = `${s.a} ${s.c}`;
  return {
    kind: 'choice',
    body: `${s.who} Which is **${least ? 'least' : 'most'}** likely?`,
    options: least
      ? [
        { text: full, correct: true },
        { text: A, why: `This is the broadest: it includes every way the other two can happen.` },
        { text: AB, why: `“${s.c.replace(/^and /, '')}” is a special case of “${s.b.replace(/^and /, '')}”, so the last option is even narrower.` },
      ]
      : [
        { text: A, correct: true },
        { text: AB, why: 'This needs the first thing to happen *and* something more, so it can’t be likelier than the first thing alone.' },
        { text: full, why: 'The most detailed option is the most specific, so it’s the least likely, however well it fits the description.' },
      ],
    explain: `Each added detail is another condition that must hold, so P(A and B) ≤ P(A). The description makes the detailed versions feel more fitting, but fitting isn’t likely. That’s the conjunction fallacy; the counter-move is to ask which option is contained in the others.`,
  };
};

const genConjNumber: Generator = (rng) => {
  if (rng() < 0.5) {
    const s = pick(rng, [
      { a: 'it rains on Saturday', b: 'the match is called off', bg: 'if it rains' },
      { a: 'your flight is delayed', b: 'you miss your connection', bg: 'if the flight is delayed' },
      { a: 'a customer opens the email', b: 'they buy something', bg: 'once they’ve opened it' },
      { a: 'a seed sprouts', b: 'the seedling survives to flower', bg: 'once it has sprouted' },
    ]);
    const pa = randInt(rng, 2, 9) / 10, pb = randInt(rng, 2, 9) / 10;
    return {
      kind: 'number', prob: true,
      body: `The chance that ${s.a} is ${pct(pa, 0)}. The chance that ${s.b}, ${s.bg}, is ${pct(pb, 0)}. What’s the chance that **${s.a} and ${s.b}**?`,
      answer: pa * pb, tol: 0.006,
      explain: `${num(pa)} × ${num(pb)} = ${num(pa * pb)}: smaller than either part. A combined event can never beat its parts, which is why the conjunction fallacy is a fallacy. Counter-move: when a story needs several things to happen, multiply.`,
    };
  }
  const pa = randInt(rng, 2, 9) / 10;
  let pb = randInt(rng, 2, 9) / 10;
  if (pb === pa) pb = pa >= 0.5 ? pa - 0.1 : pa + 0.1;
  const s = pick(rng, [
    ['Ali is a nurse', 'Ali enjoys hiking'],
    ['tomorrow is sunny', 'the beach is crowded'],
    ['the film wins an award', 'the film makes a profit'],
    ['a new phone sells out', 'it gets good reviews'],
  ]);
  return {
    kind: 'number', prob: true,
    body: `You think the chance that ${s[0]} is ${pct(pa, 0)}, and the chance that ${s[1]} is ${pct(pb, 0)}. What’s the **highest** the chance of both could possibly be?`,
    answer: Math.min(pa, pb), tol: 0.006,
    hint: 'Both can only happen when the less likely one happens.',
    explain: `At most ${pct(Math.min(pa, pb), 0)}, the smaller of the two, and only if the less likely one always comes with the other. Rating “both” any higher than that is the conjunction fallacy. Counter-move: check the combination against its least likely part.`,
  };
};

const genReferenceClass: Generator = (rng) => {
  const s = pick(rng, [
    { what: 'Your team estimates the new app release will take', unit: 'weeks', lo: 6, hi: 20 },
    { what: 'You reckon your kitchen refit will take', unit: 'weeks', lo: 3, hi: 10 },
    { what: 'A council expects a new bridge to take', unit: 'months', lo: 12, hi: 30 },
    { what: 'You plan to write your essay in', unit: 'days', lo: 4, hi: 14 },
  ]);
  const est = randInt(rng, s.lo, s.hi);
  const k = pick(rng, [1.2, 1.25, 1.4, 1.5, 1.6, 1.75, 2]);
  const ans = est * k;
  return {
    kind: 'number', unit: s.unit,
    body: `${s.what} **${est} ${s.unit}**. Records of similar projects show they took, on average, **${k} times** as long as first estimated. What’s the outside-view forecast?`,
    answer: ans, tol: 0.05,
    explain: `${est} × ${k} = **${num(ans)} ${s.unit}**. Your plan is the inside view, and plans leave out the delays nobody can name in advance. That’s the planning fallacy, a form of overconfidence; the counter-move is to start from how similar projects actually went, then adjust.`,
  };
};

const genCalibration: Generator = (rng) => {
  const conf = pick(rng, [0.7, 0.8, 0.9]);
  const n = pick(rng, [20, 30, 40, 50]);
  const kind = pick(rng, conf < 0.9 ? ['over', 'cal', 'under'] : ['over', 'cal']);
  const exp = Math.round(n * conf);
  const k = kind === 'cal' ? exp : kind === 'over' ? exp - Math.round(n * pick(rng, [0.2, 0.25, 0.3])) : Math.min(n, exp + Math.round(n * 0.15));
  const rate = k / n;
  return {
    kind: 'choice',
    body: `Over a year you made **${n}** predictions that you were **${pct(conf, 0)} sure** of. **${k}** came true. What does that suggest?`,
    options: [
      { text: 'Overconfident: you were less often right than you felt', correct: kind === 'over', why: kind === 'over' ? undefined : `You were right ${pct(rate, 0)} of the time: ${kind === 'cal' ? 'exactly' : 'more often than'} the ${pct(conf, 0)} you claimed.` },
      { text: 'Well calibrated', correct: kind === 'cal', why: kind === 'cal' ? undefined : `${pct(rate, 0)} right is a long way from the ${pct(conf, 0)} you claimed.` },
      { text: 'Underconfident: you were right more often than you felt', correct: kind === 'under', why: kind === 'under' ? undefined : `You were right ${pct(rate, 0)} of the time: ${kind === 'cal' ? 'exactly' : 'less often than'} the ${pct(conf, 0)} you claimed.` },
    ],
    ordered: true,
    explain: `${k} of ${n} is ${pct(rate, 0)}, against a claimed ${pct(conf, 0)}. ${kind === 'over' ? 'Feeling surer than your record justifies is overconfidence, the most common pattern.' : kind === 'cal' ? 'Your confidence matched your hit rate: that’s good calibration.' : 'Being right more often than you claim is underconfidence: rarer, but it happens.'} Counter-move: keep score of your predictions, and adjust how sure you let yourself feel.`,
  };
};

// ---------------------------------------------------------------- course

export const biases: Course = {
  id: 'biases',
  title: 'Thinking Errors',
  blurb: 'Fall for the classic mental traps, see how they work, and learn the moves that beat them.',
  color: '#e5534b',
  icon: '🪤',
  lessons: [
    {
      id: 'anchoring',
      title: 'The number that sticks',
      goal: 'Notice when a number you’ve just seen is steering your estimate.',
      steps: [
        {
          kind: 'estimate',
          body: 'First, answer silently: is the share of United Nations member countries that are in **Africa** more or less than **65%**?\n\nNow set the slider to your best guess of the actual share.',
          min: 0, max: 100, step: 1, answer: 28, tol: 6, format: (v) => `${v}%`,
          explain: '54 of the 193 UN members are in Africa: about **28%**. If your guess was well above that, the 65% may have pulled it up, even though it was just a number in a question. That’s **anchoring**. Counter-move: notice the number, set it aside, and build your own estimate from what you know (about 54 African countries, around 190 in all).',
        },
        {
          kind: 'read',
          title: 'The wheel of fortune',
          body: 'In a classic experiment, Amos Tversky and Daniel Kahneman spun a wheel of fortune in front of people. It was rigged to stop at either **10** or **65**. People said whether the share of African countries in the UN was higher or lower than that number, then gave their estimate.\n\nThose who saw 10 guessed **25%** on average (the median); those who saw 65 guessed **45%**.\n\nEveryone could see the number came from a wheel. It moved them anyway.',
        },
        {
          kind: 'choice',
          body: 'Why can a number you know is random still pull your estimate?',
          options: [
            { text: 'You start from it and adjust, but stop adjusting too soon', correct: true },
            { text: 'People secretly treat it as a hint', why: 'In real life an anchor can carry a hint, but in the wheel study everyone could see it was random, and it still worked.' },
            { text: 'Only people who are bad with numbers are affected', why: 'Studies find experts anchored too: estate agents valuing houses, judges setting sentences.' },
          ],
          explain: 'Your mind starts near the anchor and moves away until the answer seems plausible, and “plausible” arrives early. That’s **anchoring and adjustment**. Counter-move: start from a number you chose yourself, for a reason you could say out loud.',
        },
        {
          kind: 'choice',
          body: 'Two groups had **5 seconds** to estimate a product.\n\nGroup A saw: 1 × 2 × 3 × 4 × 5 × 6 × 7 × 8\n\nGroup B saw: 8 × 7 × 6 × 5 × 4 × 3 × 2 × 1\n\nWhich group guessed higher?',
          options: [
            { text: 'Group B', correct: true },
            { text: 'Group A', why: 'Group A’s first few steps (1 × 2 × 3…) are tiny, so their quick impression started low.' },
            { text: 'Neither: it’s the same product', why: 'It is the same product, 40,320, but with 5 seconds people only got through the first few steps, and those differ.' },
          ],
          explain: 'In the original study the median guesses were about **2,250** for B and **512** for A. The true answer is **40,320**: both groups anchored on the first steps and adjusted far too little. Counter-move: when you guess fast, ask whether your impression came only from the start of the problem.',
        },
        {
          kind: 'choice',
          body: 'In a well-known experiment, estate agents toured the same house, but were given different listing prices. What happened to their valuations?',
          options: [
            { text: 'Higher listing prices led to higher valuations, though most agents said they hadn’t used the listing price', correct: true },
            { text: 'Experienced agents ignored the listing price and valued the house on its merits', why: 'The professionals were pulled by the listing price too, and most of them didn’t realise it.' },
            { text: 'Valuations moved away from the listing price, as agents corrected for it', why: 'They moved towards it: the anchor pulled, it didn’t repel.' },
          ],
          explain: 'Expertise doesn’t switch anchoring off, and you usually can’t feel it happening. Counter-move: write down your own valuation, from comparable sales, before you look at the asking price.',
        },
        {
          kind: 'choice',
          body: 'You’re selling a bike that similar ones sell for at around **£300**. A buyer opens: “Would you take £120?” What’s the best move?',
          options: [
            { text: 'Restate your own figure, based on what similar bikes sell for, before reacting to theirs', correct: true },
            { text: 'Meet in the middle at £210', why: 'Halfway lets their anchor set the midpoint: £120 has just cost you £90.' },
            { text: 'Conclude that the bike must be worth less than you thought', why: 'An opening offer is a move in a negotiation, not evidence about value.' },
          ],
          explain: 'First offers anchor negotiations, which is why some negotiation research suggests making the first offer yourself when you know the value well. Counter-move: decide your figure and your reasons beforehand, and steer the talk back to them.',
        },
        {
          kind: 'choice',
          body: 'Which habit protects you best against anchors?',
          options: [
            { text: 'Make your own estimate before you see anyone else’s number', correct: true },
            { text: 'Tell yourself firmly to ignore the number', why: 'In studies, simply warning people about anchors tends to do little: the pull works below awareness.' },
            { text: 'Look at lots of numbers so the anchors average out', why: 'More irrelevant numbers just means more anchors.' },
          ],
          explain: 'An estimate formed first can’t be dragged. If you’ve already seen a number, a useful second move is to **consider the opposite**: list reasons the anchor might be far too high, or far too low.',
        },
      ],
      practice: [genSpot(['anchoring'])],
    },
    {
      id: 'availability',
      title: 'What comes to mind',
      goal: 'Separate how easily something comes to mind from how often it happens.',
      steps: [
        {
          kind: 'choice',
          body: 'In typical English text, which is more common: words that **start** with K, or words that have K as their **third** letter?',
          options: [
            { text: 'K as the third letter', correct: true },
            { text: 'Starting with K', why: 'Words starting with K are much easier to think of, because memory is good at first letters. Easier to recall isn’t the same as more common.' },
            { text: 'About the same', why: 'Third-letter K is clearly more common: ask, like, make, take, joke, bike…' },
          ],
          explain: 'Words like *ask, make, like, take* make third-letter K the more common. Starting-K words just come to mind more easily, so they feel more common. That’s the **availability heuristic**: judging frequency by ease of recall. Counter-move: ask whether something comes to mind because it’s common, or because of how memory works.',
        },
        {
          kind: 'read',
          title: 'Easy to recall isn’t common',
          body: 'Tversky and Kahneman asked this letter question in the early 1970s; most people picked “starts with”.\n\nUsually, ease of recall is a decent guide: things you meet often are easy to remember. But some things are easy to remember for other reasons: they’re **vivid**, **recent**, **emotional**, or **all over the news**. For those, the shortcut misleads.',
        },
        {
          kind: 'choice',
          body: 'In the United States, which kills more people in a typical year: **sharks** or **lightning**?',
          options: [
            { text: 'Lightning, by a wide margin', correct: true },
            { text: 'Sharks', why: 'Shark attacks are vivid and widely reported, but deaths in the US are usually around one a year or fewer.' },
            { text: 'About the same', why: 'Lightning typically kills many times more people in the US than sharks do.' },
          ],
          explain: 'Shark attacks get films and headlines; lightning deaths rarely make the news. Coverage drives availability, not frequency. Counter-move: when a risk feels big, look up how many people it actually affects per year.',
        },
        {
          kind: 'choice',
          body: 'After a terrible plane crash dominates the news, many people drive long distances instead of flying. What happens to their safety?',
          options: [
            { text: 'They take on more risk: per kilometre, driving is far more dangerous than flying', correct: true },
            { text: 'They’re safer: the crash shows flying is risky right now', why: 'One crash, however vivid, barely changes flying’s excellent safety record.' },
            { text: 'No real difference either way', why: 'There’s a big difference: over long distances, driving carries much more risk than a commercial flight.' },
          ],
          explain: 'One analysis estimated that the switch from flying to driving in the year after 9/11 led to around 1,500 extra road deaths in the US. Vivid risks crowd out quiet ones. Counter-move: compare the options’ actual risks, not how frightening they feel.',
        },
        {
          kind: 'choice',
          body: 'Asked separately what share of the household chores they do, two partners answer. Add their two answers together. What usually happens?',
          options: [
            { text: 'They add up to more than 100%', correct: true },
            { text: 'They add up to about 100%', why: 'In studies of couples, the totals usually come out above 100%.' },
            { text: 'They add up to less than 100%', why: 'People tend to overestimate their own share, not underestimate it.' },
          ],
          explain: 'Your own efforts are easy to recall; your partner’s mostly happen when you aren’t watching. That’s availability again, and it’s nobody being dishonest. Counter-move: before judging a share, ask what you might not have seen.',
        },
        {
          kind: 'choice',
          body: 'A manager writes yearly reviews in December. One employee was excellent all year, but made a visible mistake last week. What’s the best way to keep the review fair?',
          options: [
            { text: 'Keep notes through the year, and reread them before writing', correct: true },
            { text: 'Weigh last week more heavily, since it’s the most up to date', why: 'Recent isn’t more representative. Last week is simply the easiest to recall.' },
            { text: 'Ask colleagues what they remember', why: 'Their memories favour the same vivid, recent event.' },
          ],
          explain: 'Recency makes events available, so the latest week can swamp the year. Counter-move: replace memory with records, written at the time.',
        },
        {
          kind: 'choice',
          body: 'Which question best counters availability when you judge a risk?',
          options: [
            { text: 'How often does this actually happen, per year or per person?', correct: true },
            { text: 'Do I know anyone it’s happened to?', why: 'That’s availability itself: a sample of whatever memorable cases you happen to know.' },
            { text: 'How bad would it be if it happened?', why: 'Severity matters for decisions, but it tells you nothing about how likely it is.' },
          ],
          explain: 'Base rates from records don’t care how vivid a story is. Counter-move: when a story feels gripping, go and find the rate.',
        },
      ],
      practice: [genSpot(['availability']), genSpot(upTo(2))],
    },
    {
      id: 'confirmation',
      title: 'Testing your ideas',
      goal: 'Test a belief by looking for what would prove it wrong.',
      steps: [
        {
          kind: 'task',
          body: 'I have a rule for triples of numbers. **2, 4, 6** fits it. Test any triples you like, and I’ll tell you whether each one fits. When you’re confident, pick the rule.',
          widget: ruleGame(),
          hint: 'Try a triple your idea says should get a “no”, such as 1, 2, 3 or 6, 4, 2.',
          explain: 'The rule was just **any three numbers in increasing order**. Most people test triples that fit their guess (8, 10, 12…), get yes after yes, and announce “add 2” with confidence. Tests you expect to pass can’t show you’re wrong. That’s **confirmation bias**. Counter-move: test the cases your idea says should fail.',
        },
        {
          kind: 'choice',
          body: 'Someone tests 8, 10, 12, then 20, 22, 24, then 100, 102, 104. All fit. They announce: “add 2 each time.” What went wrong?',
          options: [
            { text: 'Every test was one they expected to pass, so none could show them wrong', correct: true },
            { text: 'They didn’t test enough triples', why: 'A hundred more triples of the same kind would fit both “add 2” and the real rule, and teach them nothing.' },
            { text: 'They should have used smaller numbers', why: 'Size wasn’t the problem: each triple fitted both rules, so it couldn’t tell them apart.' },
          ],
          explain: 'A useful test is one where your idea and its rivals predict different results. Counter-move: before testing, ask “what result would surprise me?” and try to produce it.',
        },
        {
          kind: 'read',
          title: 'Confirmation bias',
          body: 'This task comes from Peter Wason in 1960. Few people found the rule at their first announcement.\n\nThe trap isn’t stupidity: it’s a natural habit of testing ideas by looking for cases that **fit**. In everyday life the same habit shows up as reading the news that agrees with you, remembering the hits and forgetting the misses.\n\nThe fix is to hunt for cases that would **break** your idea. If it survives honest attempts to break it, you can trust it more.',
        },
        {
          kind: 'choice',
          body: 'Four cards each have a letter on one side and a number on the other. You see: **A · K · 4 · 7**\n\nRule: *If a card has a vowel on one side, it has an even number on the other.*\n\nWhich cards must you turn over to check whether the rule is broken?',
          options: [
            { text: 'A and 7', correct: true },
            { text: 'A and 4', why: 'The 4 can’t break the rule: the rule says nothing about what’s behind an even number. It’s the confirming card, which is why it tempts.' },
            { text: 'A only', why: 'The 7 could break the rule too, if it has a vowel on the back.' },
            { text: 'All four', why: 'K and 4 can’t break the rule, whatever is on their backs.' },
          ],
          explain: 'Only “vowel with odd number” breaks the rule, so check the vowel (A) and the odd number (7). In Wason’s studies most people chose A and 4, the cards that could confirm. Counter-move: ask “where could a rule-breaker be hiding?”',
        },
        {
          kind: 'choice',
          body: 'Same logic, different story. Rule: *If someone is drinking beer, they must be over 18.* Each card shows a drink on one side and an age on the other: **beer · cola · 25 · 16**\n\nWhich cards must you check?',
          options: [
            { text: 'Beer and 16', correct: true },
            { text: 'Beer and 25', why: 'A 25-year-old can drink what they like; that card can’t break the rule.' },
            { text: 'Beer only', why: 'The 16-year-old might be drinking beer: you need to check.' },
            { text: 'All four', why: 'The cola drinker and the 25-year-old can’t break the rule.' },
          ],
          explain: 'Most people find this version easy, though the logic is identical. Thinking “who could be breaking the rule?” makes us look for counterexamples naturally. Counter-move: turn your test into a hunt for rule-breakers on purpose.',
        },
        {
          kind: 'choice',
          body: 'You think a new plant food makes your tomatoes grow faster. Which test could best show you’re wrong?',
          options: [
            { text: 'Grow similar plants with and without it, side by side, and compare', correct: true },
            { text: 'Measure the fed plants every week and see that they grow', why: 'Plants grow anyway. Without a comparison, any growth looks like support.' },
            { text: 'Ask other gardeners who use it whether it works', why: 'They chose it and remember their successes: the same bias, in more people.' },
          ],
          explain: 'A comparison group gives your idea a real chance to fail. Counter-move: ask what you’d see if the plant food did nothing, and set up a test that could show it.',
        },
        {
          kind: 'choice',
          body: 'You want to know whether a popular diet is healthy. Which search is least likely to mislead you?',
          options: [
            { text: '“[diet] evidence review”', correct: true },
            { text: '“why [diet] is good for you”', why: 'A leading question finds pages that agree with it.' },
            { text: '“[diet] dangers”', why: 'Just as leading, in the other direction.' },
          ],
          explain: 'Search engines answer the question you ask, slant included. Counter-move: phrase searches neutrally, and deliberately read the best case for the other side.',
        },
      ],
      practice: [genWason, genSpot(['confirmation']), genSpot(upTo(3))],
    },
    {
      id: 'survivorship',
      title: 'The ones you don’t see',
      goal: 'Ask what was filtered out before the evidence reached you.',
      steps: [
        {
          kind: 'choice',
          body: 'Second World War. Bombers come back from missions riddled with bullet holes: mostly in the wings, the body and the tail, hardly any in the engines. Armour is heavy, so you can only add it to some areas. Where?',
          widget: bomber(),
          options: [
            { text: 'The engines', correct: true },
            { text: 'Where the holes are: wings, body and tail', why: 'These are the planes that made it home. Holes in those places were survivable.' },
            { text: 'Spread it evenly over the whole plane', why: 'That ignores what the pattern of holes is telling you.' },
          ],
          explain: 'You’re only seeing planes that came back. The missing holes are on the planes that didn’t: those hit in the engines. That’s **survivorship bias**. Counter-move: ask what had to happen for a case to reach you, and what got filtered out.',
        },
        {
          kind: 'read',
          title: 'The missing planes',
          body: 'The story is usually told about the statistician **Abraham Wald**, who worked on aircraft damage in the war. The point: the sample of returning planes had been filtered by the very thing you cared about.\n\nThe same filter is everywhere. You hear about the start-ups that made it, the old buildings still standing, the funds still trading. The failures quietly leave the room.',
        },
        {
          kind: 'choice',
          body: 'Several famous tech billionaires dropped out of university. Does this suggest that dropping out boosts your chances of great success?',
          options: [
            { text: 'No: you hear about the dropouts who succeeded, not the far larger number who didn’t', correct: true },
            { text: 'Yes: the examples are real', why: 'Real examples, but chosen by success. You’d need to know what happened to all dropouts.' },
            { text: 'Yes: it shows university is a waste of time for talented people', why: 'The examples can’t show that: the talented dropouts who struggled aren’t on magazine covers.' },
          ],
          explain: 'To judge a strategy, you need everyone who tried it, not just the winners. Counter-move: ask “of all the people who did this, how many ended up here?”',
        },
        {
          kind: 'choice',
          body: '“They built things to last back then,” your friend says, pointing at the town’s lovely 200-year-old buildings. What’s the most important thing missing from this picture?',
          options: [
            { text: 'The badly built old buildings that fell down or were knocked down long ago', correct: true },
            { text: 'Modern buildings that are also well built', why: 'Relevant, but the key gap is in the old sample itself: it has been filtered.' },
            { text: 'How much the old buildings cost to build', why: 'Cost doesn’t explain why only good old buildings are left to see.' },
          ],
          explain: 'Time is a filter: two centuries removed most of the poor buildings. Counter-move: when only old things are left to judge by, ask what didn’t survive.',
        },
        {
          kind: 'choice',
          body: 'An investment firm advertises: “Our funds have averaged 11% a year over the last ten years.” The average only includes funds it still runs today. Why should that worry you?',
          options: [
            { text: 'Funds that did badly were likely closed or merged, so they dropped out of the average', correct: true },
            { text: '11% a year is too high to be true', why: 'It may be true for the survivors. The problem is what’s missing.' },
            { text: 'Ten years is too short to judge', why: 'Maybe, but the bigger problem is which funds were counted.' },
          ],
          explain: 'Dropping the losers makes any average look better. Counter-move: ask for results including every fund that existed at the start.',
        },
        {
          kind: 'choice',
          body: 'A bestselling book studies twenty very successful companies and finds their founders all took bold risks. It advises: take bold risks. What would you need to see to back that advice?',
          options: [
            { text: 'Whether failed companies’ founders took bold risks too', correct: true },
            { text: 'More examples of successful bold founders', why: 'More winners can’t tell you whether boldness helps: the losers might be just as bold.' },
            { text: 'Interviews where the founders explain why boldness worked', why: 'Success stories told by winners are still filtered by success.' },
          ],
          explain: 'If bold founders are also over-represented among failures, boldness might raise the variance rather than the odds. Counter-move: compare the successes with the failures before learning a lesson from either.',
        },
        {
          kind: 'choice',
          body: 'Which question best guards against survivorship bias?',
          options: [
            { text: 'What happened to the ones that failed, and would I have heard of them?', correct: true },
            { text: 'What do all the successful ones have in common?', why: 'That’s exactly the trap: the failures may share it too.' },
            { text: 'How big were the biggest successes?', why: 'Size of success says nothing about what caused it.' },
          ],
          explain: 'Survivorship bias hides in what you never see. Counter-move: deliberately seek out the failures, the closed, the dead and the forgotten.',
        },
      ],
      practice: [genSpot(['survivorship']), genSpot(upTo(4))],
    },
    {
      id: 'regression',
      title: 'What goes up comes down',
      goal: 'Expect extreme results to be followed by more ordinary ones.',
      steps: [
        {
          kind: 'choice',
          body: 'A flight instructor notices: when he praises a trainee for an excellent landing, the next one is usually worse. When he shouts at a trainee for a terrible landing, the next is usually better. He concludes that criticism works and praise backfires. What’s the best explanation?',
          options: [
            { text: 'An exceptional landing is partly luck, so the next one tends to be more ordinary, whatever he says', correct: true },
            { text: 'He’s right: praise makes trainees careless', why: 'His evidence would look exactly the same if his words had no effect at all.' },
            { text: 'Trainees who are shouted at try harder', why: 'Maybe, but the pattern would appear anyway: after a terrible landing, the next is likely to be better.' },
          ],
          explain: 'That’s **regression to the mean**. Daniel Kahneman has described meeting this exact argument when teaching flight instructors. Counter-move: before crediting a cause after an extreme, ask what you’d expect if nothing had been done.',
        },
        {
          kind: 'read',
          title: 'Skill plus luck',
          body: 'Here 100 players each have a fixed **skill**; every round adds fresh **luck**. Red dots are round 1’s top 10, blue its bottom 10. Watch where they land in round 2, and try different amounts of luck.',
          widget: regressionSim(),
        },
        {
          kind: 'choice',
          body: 'In the simulation, round 1’s top 10 usually do worse in round 2. Did they lose skill?',
          options: [
            { text: 'No: their skill didn’t change; their round 1 luck was unusually good, and luck doesn’t repeat', correct: true },
            { text: 'Yes: their skill dropped', why: 'Skill is fixed in the simulation. Only the luck was redrawn.' },
            { text: 'They got complacent', why: 'There’s no psychology in the simulation at all, and the drop still happens.' },
          ],
          explain: 'To reach the top 10, you usually need good skill **and** good luck. Next round the luck is fresh, so the group slides back towards average, while still staying above it. Counter-move: when you pick people for an extreme result, expect them to be more ordinary next time.',
        },
        {
          kind: 'choice',
          body: 'When is regression to the mean strongest?',
          options: [
            { text: 'When results depend a lot on luck', correct: true },
            { text: 'When results depend almost entirely on skill', why: 'With little luck, the top players stay on top: try “Mostly skill” in the simulation.' },
            { text: 'Only in sport', why: 'It happens wherever a measurement mixes something stable with noise: exam marks, sales, symptoms, crash counts.' },
          ],
          explain: 'The more noise in a measurement, the more an extreme is just noise, and the further it falls back. Counter-move: judge people and policies on many results, not one standout.',
        },
        {
          kind: 'number',
          body: 'Scores on a test average **100** both times it’s taken; the correlation between someone’s first and second score is **0.5** (with the same spread each time). A student scored **130** the first time. What’s your best prediction for their second score?',
          answer: 115, tol: 0.5, unit: 'points',
          hint: 'Start from the average and move only part of the way: correlation × distance from the average.',
          explain: '100 + 0.5 × (130 − 100) = **115**: still above average, but less extreme. Correlation 1 would mean no regression; 0 would mean predicting 100. Counter-move: shrink extreme predictions towards the average.',
        },
        {
          kind: 'choice',
          body: 'Athletes who appear on a famous sports magazine’s cover often do worse afterwards. Fans call it a jinx. What’s the best explanation?',
          options: [
            { text: 'They make the cover after an exceptional run, which is partly luck, and then drift back', correct: true },
            { text: 'Fame and attention distract them', why: 'Possible, but you’d see the dip even if nobody felt any pressure.' },
            { text: 'Rivals study them more closely afterwards', why: 'Also possible, but not needed: being chosen at a peak is enough to predict a dip.' },
          ],
          explain: 'Picking anyone at a peak guarantees an apparent decline. Counter-move: when someone is chosen for an extreme, don’t read the following dip as a cause.',
        },
        {
          kind: 'choice',
          body: 'A town puts speed cameras at the 10 junctions with the most crashes last year. The next year, crashes there fall by 30%. What would best tell you how much the cameras helped?',
          options: [
            { text: 'Compare with similar high-crash junctions that didn’t get cameras', correct: true },
            { text: 'The 30% drop is the camera effect', why: 'Some of the drop was likely anyway: an unusually bad year tends to be followed by a more normal one.' },
            { text: 'Compare with all junctions in town over the same year', why: 'Those weren’t picked for a bad year, so they don’t share the bounce-back.' },
          ],
          explain: 'A comparison group selected the same way shows how much would have happened anyway. Counter-move: whenever something is picked because it was extreme, demand a control group.',
        },
      ],
      practice: [genRegression, genSpot(['regression']), genSpot(upTo(5))],
    },
    {
      id: 'framing',
      title: 'Same facts, different words',
      goal: 'See through wording to the outcomes underneath.',
      steps: [
        {
          kind: 'task',
          body: 'An unusual disease is expected to kill **600 people**. Two programmes have been proposed. Make the call, twice.',
          widget: framePair(
            { text: 'Programme A: 200 people will be saved. Programme B: a 1/3 chance that all 600 are saved, and a 2/3 chance that nobody is saved.', options: ['Programme A', 'Programme B'] },
            { text: 'Programme C: 400 people will die. Programme D: a 1/3 chance that nobody dies, and a 2/3 chance that all 600 die.', options: ['Programme C', 'Programme D'] },
            'A matches C, and B matches D.'),
          explain: '“200 saved” and “400 die” are the same outcome, as are B and D. In the original study by Tversky and Kahneman, most people chose the sure thing (A) in the first wording and the gamble (D) in the second. That’s **framing**. Counter-move: restate the choice in the other frame and check you’d still choose the same.',
        },
        {
          kind: 'choice',
          body: 'How do Programme A (“200 will be saved”) and Programme C (“400 will die”) compare?',
          options: [
            { text: 'They’re the same: of 600 people, 200 live and 400 die', correct: true },
            { text: 'A is better: it saves people', why: 'C saves exactly the same 200. It just describes the 400 it doesn’t save.' },
            { text: 'C is better: it’s more honest about the deaths', why: 'Both are equally true. Neither is more honest; they just point at different halves.' },
          ],
          explain: 'Every outcome can be described as a gain or a loss. Counter-move: always write out both: how many saved *and* how many lost.',
        },
        {
          kind: 'read',
          title: 'Gains and losses',
          body: 'In the original study, **72%** chose A, the sure thing, when it was described in lives saved. When it was described in deaths, **78%** chose D, the gamble.\n\nThe pattern is general: when choices are framed as **gains**, people tend to play safe; framed as **losses**, they tend to gamble to avoid them. Losses loom larger than equal gains.\n\nNothing about the outcomes changed. Only the words did.',
        },
        {
          kind: 'choice',
          body: 'Surgeon 1: “Of 100 people who have this operation, **90 are alive** after five years.” Surgeon 2, about the same operation: “Of 100, **10 die** within five years.” Which surgeon is describing a safer operation?',
          options: [
            { text: 'Neither: it’s the same statistic', correct: true },
            { text: 'Surgeon 1', why: '90 alive out of 100 means 10 dead out of 100. It only sounds better.' },
            { text: 'Surgeon 2', why: '10 die out of 100 is exactly what surgeon 1 said.' },
          ],
          explain: 'In a classic study, people (doctors among them) were more likely to choose surgery when its results were given as survival rather than deaths. That’s framing. Counter-move: when you get a number, say its complement out loud too.',
        },
        {
          kind: 'number',
          body: 'A yoghurt is labelled **“97% fat-free”**. What percentage of it is fat?',
          answer: 3, tol: 0.01, unit: '%',
          explain: '97% fat-free is **3% fat**. “3% fat” sounds less healthy, which is why labels rarely say it. Counter-move: flip the number round before you judge it.',
        },
        {
          kind: 'choice',
          body: 'Shop A sells a coat for £50, plus a **£2 surcharge** if you pay by card. Shop B sells it for £52, with a **£2 discount** if you pay cash. Which is the better deal?',
          options: [
            { text: 'They’re identical: £52 by card, £50 cash, in both', correct: true },
            { text: 'Shop B: you get a discount', why: 'Shop B’s card price is £52, the same as shop A’s. The discount is only a description.' },
            { text: 'Shop A: its price is lower', why: 'Shop A’s card price is £52 too. The lower sticker price is a matter of wording.' },
          ],
          explain: 'A surcharge feels like a loss; a missed discount barely registers. Richard Thaler has told how card companies preferred the “cash discount” wording for exactly this reason. Counter-move: compare what you actually pay.',
        },
        {
          kind: 'choice',
          body: 'Which habit best protects you from framing?',
          options: [
            { text: 'Restate the information in the opposite frame, and check your choice survives', correct: true },
            { text: 'Trust the first description, since second thoughts cause confusion', why: 'The first description is just whichever frame someone chose for you.' },
            { text: 'Go with the option that sounds more positive', why: 'That’s the framing effect itself: positive-sounding wording doing the choosing.' },
          ],
          explain: 'Your choice should depend on outcomes, not words. Counter-move: translate every percentage into its complement and every gain into its loss, then decide.',
        },
      ],
      practice: [genFraming, genSpot(['framing']), genSpot(upTo(6))],
    },
    {
      id: 'conjunction',
      title: 'More detail, less likely',
      goal: 'Remember that every added detail makes a story less probable.',
      steps: [
        {
          kind: 'choice',
          body: 'Linda is 31, single, outspoken and very bright. She studied philosophy. As a student she cared deeply about discrimination and social justice, and joined anti-nuclear protests.\n\nWhich is more probable?',
          options: [
            { text: 'Linda is a bank teller', correct: true },
            { text: 'Linda is a bank teller and is active in the feminist movement', why: 'This one fits the description better, but every feminist bank teller is also a bank teller, so it can’t be more probable.' },
          ],
          explain: 'In Tversky and Kahneman’s classic study, most people picked the second option. But “bank teller and feminist” is a subset of “bank teller”. That’s the **conjunction fallacy**: the more fitting story feels likelier, even though it needs more things to be true. Counter-move: ask whether one option is contained in the other.',
        },
        {
          kind: 'read',
          title: 'A part can’t beat the whole',
          body: 'Imagine 100 women who fit Linda’s description, and say (just for illustration) 5 of them are bank tellers, 4 of whom are active feminists.\n\nThe feminist bank tellers (blue) are **inside** the bank tellers (blue and orange). However well they fit the story, there can’t be more of them.\n\n**P(A and B) ≤ P(A)**, always.',
          widget: dots([{ n: 4, color: C.a, label: 'feminist bank tellers' }, { n: 1, color: C.b, label: 'other bank tellers' }, { n: 95, color: C.mute, label: 'not bank tellers' }], 20),
        },
        {
          kind: 'choice',
          body: 'Which is more probable next year?',
          options: [
            { text: 'A massive flood somewhere in North America in which more than 1,000 people drown', correct: true },
            { text: 'An earthquake in California that causes a massive flood in which more than 1,000 people drown', why: 'Vivid and plausible, but it’s one particular way of getting the first event, so it can’t be likelier.' },
          ],
          explain: 'In a classic study, forecasting professionals rated the earthquake version as more likely. A cause makes a story easier to picture, not more probable. That’s the conjunction fallacy. Counter-move: be most suspicious of the scenarios that feel most vivid.',
        },
        {
          kind: 'number', prob: true,
          body: 'There’s a **40%** chance of rain on Saturday. If it rains, there’s a **50%** chance the match is called off. What’s the chance that it rains **and** the match is called off?',
          answer: 0.2, tol: 0.003,
          explain: '0.4 × 0.5 = **0.2**, half of the 40%. Adding a condition can only shrink a probability. Counter-move: when a forecast needs several things to happen, multiply their chances.',
        },
        {
          kind: 'choice',
          body: 'A plan needs **6 steps** to all go right. Each step is **90%** likely to succeed, independently of the others. Roughly how likely is the whole plan to succeed?',
          ordered: true,
          options: [
            { text: 'About 90%', why: 'That’s the chance of one step. All six together is much less.' },
            { text: 'About 75%', why: 'Closer, but still too high: multiply 0.9 six times.' },
            { text: 'About 53%', correct: true },
            { text: 'About 10%', why: 'Too low: each step is very likely, so the plan still has roughly even odds.' },
          ],
          explain: '0.9⁶ ≈ 0.53. Each step looks safe, so the whole plan feels safe; that’s the conjunction trap behind many over-optimistic plans. Counter-move: list the steps and multiply.',
        },
        {
          kind: 'choice',
          body: 'Dev loves cars and has been saving for years. Which is **most** likely?',
          options: [
            { text: 'Dev passes his driving test this year', correct: true },
            { text: 'Dev passes his driving test this year and buys a car within a month', why: 'This requires passing the test plus something else, so it can’t be likelier.' },
            { text: 'Dev passes his driving test this year and buys a red sports car within a month', why: 'The most detailed option is the least likely, however much it suits Dev.' },
          ],
          explain: 'The detailed options fit Dev, which is exactly what makes them tempting. Counter-move: rank options by how many conditions they need, not by how well they fit the story.',
        },
        {
          kind: 'choice',
          body: 'A lawyer tells a jury a detailed, convincing story: motive, opportunity, and a step-by-step timeline. What’s the best check on how probable it is?',
          options: [
            { text: 'Ask how likely each part is: the whole can’t be likelier than its least likely part', correct: true },
            { text: 'Judge it by how well the details hang together', why: 'Coherence makes a story persuasive, but each extra detail is another thing that must be true.' },
            { text: 'Believe it if no single part seems impossible', why: 'Many merely likely parts can multiply into an unlikely whole.' },
          ],
          explain: 'Detail adds persuasiveness and removes probability at the same time. Counter-move: break a story into its parts and estimate each.',
        },
      ],
      practice: [genConjunction, genConjNumber, genSpot(upTo(7))],
    },
    {
      id: 'overconfidence',
      title: 'Too sure, too soon',
      goal: 'Give honest ranges, and forecast plans from how similar ones turned out.',
      steps: [
        {
          kind: 'task',
          body: 'For each question, give a **low** and a **high** value so that you’re **90% sure** the true answer lies between them. No looking anything up.',
          widget: rangeQuiz([
            { q: 'Length of the river Nile', answer: 6650, unit: 'km' },
            { q: 'Height of Mount Everest', answer: 8849, unit: 'm' },
            { q: 'Year William Shakespeare was born', answer: 1564, year: true },
            { q: 'Number of bones in an adult human skeleton', answer: 206 },
            { q: 'Average distance from the Earth to the Moon', answer: 384400, unit: 'km' },
            { q: 'Year the Eiffel Tower was completed', answer: 1889, year: true },
            { q: 'Speed of sound in air at 20 °C', answer: 343, unit: 'm/s' },
            { q: 'Diameter of the Earth', answer: 12742, unit: 'km' },
          ]),
          explain: 'With honest 90% ranges you’d catch about 7 of the 8. In many studies, ranges people say they’re 90% sure of contain the truth much less often, sometimes only around half the time. That’s **overconfidence**: we know less than we feel we do. Counter-move: widen your ranges until a miss would genuinely surprise you.',
        },
        {
          kind: 'read',
          title: 'Ranges that are too narrow',
          body: 'Overconfidence isn’t arrogance. It’s that the first range that comes to mind is built around your best guess, and you don’t widen it enough for the ways you might be wrong (sound familiar? it’s anchoring on your own guess).\n\nA useful trick: think about each end **separately**. “How high could it plausibly be? Would I be shocked if it were higher?” Then the same for the low end.',
        },
        {
          kind: 'number',
          body: 'You give 90% ranges for **20** questions. If you’re well calibrated, about how many ranges should **miss** the true answer?',
          answer: 2, tol: 0.01,
          explain: '10% of 20 = **2**. If 8 or 10 miss, your “90%” behaves more like 50–60%: overconfidence. Counter-move: keep score, and if you miss too often, widen your ranges.',
        },
        {
          kind: 'choice',
          body: 'Students writing a long thesis were asked when they’d finish, and when they’d finish “if everything went as poorly as it possibly could”. How did they do?',
          options: [
            { text: 'On average, they took longer than even their worst-case estimate', correct: true },
            { text: 'Most finished between their best guess and their worst case', why: 'Their worst case wasn’t bad enough: on average they took longer than it.' },
            { text: 'Most finished early, having planned cautiously', why: 'Fewer than a third finished by the date they expected.' },
          ],
          explain: 'In this study (Buehler, Griffin and Ross), students predicted about 34 days on average, gave about 49 for the worst case, and took about 55. That’s the **planning fallacy**, overconfidence about your own plans. Counter-move: don’t trust a “worst case” built from your plan; check how long similar work took.',
        },
        {
          kind: 'read',
          title: 'The outside view',
          body: 'When you plan, you picture the steps: the **inside view**. Your plan can’t include the delays nobody can name in advance, but they always come from somewhere.\n\nThe **outside view** asks: how did similar projects go? The Sydney Opera House was planned to open in 1963 for about 7 million Australian dollars. It opened in 1973, costing over 100 million.\n\n**Reference-class forecasting**: start from how long and how much similar projects took, then adjust for what’s genuinely different about yours.',
        },
        {
          kind: 'number', unit: 'weeks',
          body: 'Your team estimates a project at **10 weeks**. Across your last few similar projects, the real time was on average **1.4 times** the first estimate. What’s the outside-view forecast?',
          answer: 14, tol: 0.05,
          explain: '10 × 1.4 = **14 weeks**. You can still adjust for what’s really different this time, but start from the record, not the plan. That’s the counter-move to the planning fallacy.',
        },
        {
          kind: 'choice',
          body: 'Which of these is an **outside-view** question?',
          options: [
            { text: 'How long did similar projects take, from start to finish?', correct: true },
            { text: 'What are the steps, and how long will each take?', why: 'That’s the inside view: careful, but it misses the delays nobody can name in advance.' },
            { text: 'How quickly could we finish if we really pushed?', why: 'That’s the best case, which plans already lean towards.' },
          ],
          explain: 'The outside view uses the track record of a whole class of similar cases. Counter-move: before trusting your plan, find the reference class and its record.',
        },
        {
          kind: 'choice',
          body: 'Last one, all eight traps in play. A friend says: “Every lottery winner I’ve read about had a lucky ritual, so I’ve started one too.” Which thinking error is this, mainly?',
          options: [
            { text: 'Survivorship bias', correct: true },
            { text: 'Anchoring', why: 'No starting number is pulling anyone’s estimate here.' },
            { text: 'Regression to the mean', why: 'There’s no extreme result being followed by a more ordinary one.' },
            { text: 'Conjunction fallacy', why: 'Nobody is rating a combination as likelier than a part.' },
          ],
          explain: 'You read about the winners, not the millions of losers who had lucky rituals too. Counter-move: ask about the ones you never hear from. Practice will mix all eight traps from here on.',
        },
      ],
      practice: [genReferenceClass, genCalibration, genSpot(ALL_BIASES)],
    },
  ],
};
