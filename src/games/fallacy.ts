// Spot the Flaw: five short everyday arguments, each with exactly one reasoning error. Pick it from four.
import type { Game } from './game';
import type { Rng } from '../types';
import { h, seeded, shuffle } from '../ui';

const FLAWS = {
  corr: ['Correlation isn’t causation', 'Two things rising together doesn’t mean one causes the other.'],
  posthoc: ['Post hoc', 'It happened after, so it must have been caused by it.'],
  survivor: ['Survivorship bias', 'Only looking at the ones that made it through.'],
  baserate: ['Base rate neglect', 'Ignoring how common something is to begin with.'],
  straw: ['Straw man', 'Attacking a twisted version of what was actually said.'],
  dilemma: ['False dilemma', 'Pretending there are only two options.'],
  sunk: ['Sunk cost', 'Sticking with something because of what’s already been spent.'],
  hasty: ['Hasty generalisation', 'A sweeping conclusion from a handful of cases.'],
  authority: ['Appeal to authority (outside their field)', 'Trusting someone on a topic they aren’t expert in.'],
  regression: ['Regression to the mean', 'Extreme results drift back toward normal on their own.'],
  cherry: ['Cherry-picking', 'Showing only the evidence that fits.'],
  circular: ['Circular reasoning', 'The conclusion is already assumed in the reason.'],
  slippery: ['Slippery slope', 'Assuming one small step must lead to disaster.'],
  adhom: ['Ad hominem', 'Attacking the person instead of their argument.'],
  gambler: ['Gambler’s fallacy', 'Thinking past random results change the next one.'],
  goalposts: ['Moving the goalposts', 'Raising the bar once the evidence clears it.'],
  bandwagon: ['Appeal to popularity', 'Lots of people believe or buy it, so it must be right.'],
} as const;
type Flaw = keyof typeof FLAWS;

/** Pairs too close to use one as a decoy for the other (either way round). */
const TOO_SIMILAR: [Flaw, Flaw][] = [
  ['corr', 'posthoc'], ['corr', 'regression'], ['corr', 'baserate'], ['posthoc', 'regression'],
  ['survivor', 'hasty'], ['survivor', 'cherry'], ['hasty', 'cherry'], ['hasty', 'baserate'],
  ['straw', 'adhom'], ['straw', 'slippery'], ['authority', 'bandwagon'], ['gambler', 'regression'],
  ['circular', 'bandwagon'],
];
const similar = (a: Flaw, b: Flaw) => TOO_SIMILAR.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

interface Arg { f: Flaw; text: string; why: string }
const A = (f: Flaw, text: string, why: string): Arg => ({ f, text, why });

export const BANK: Arg[] = [
  A('corr', 'Towns that sell more ice cream have more drownings each summer. So ice cream must make people worse swimmers, and the council should limit ice-cream stands.', 'Hot weather drives both ice-cream sales and swimming. A shared cause links them, not ice cream.'),
  A('corr', 'A survey found that people who own expensive coffee machines earn more. So buying a fancy coffee machine will help boost your salary.', 'People who earn more can afford fancy machines. The machine doesn’t raise anyone’s pay.'),
  A('corr', 'Children with lots of books at home get better grades. So if we post every family a box of books, grades will rise everywhere.', 'Homes full of books differ in many ways: time, money, habits. The books alone may not be what drives grades.'),
  A('corr', 'The more firefighters sent to a fire, the more damage the fire does. Clearly the crews are making fires worse, so we should send fewer.', 'Bigger fires get more firefighters. The size of the fire drives both numbers.'),

  A('posthoc', 'I wore my lucky socks on Tuesday, and by Wednesday my cold was gone. Those socks clearly cure colds.', 'Colds clear up on their own in a few days. Coming after something doesn’t make it the cause.'),
  A('posthoc', 'The new office manager started in March, and in April the printer broke twice. She’s obviously bad luck for the equipment.', 'Printers break for their own reasons. One thing following another doesn’t link them.'),
  A('posthoc', 'Ever since the café started playing jazz in the mornings, it has rained more often. The music must be bringing the rain.', 'The rain would have come anyway. The timing is a coincidence, not a cause.'),
  A('posthoc', 'Our team switched to blue shirts, and the next match we won 3–0. The new colour is what turned our season around.', 'One win after a change proves nothing about the change. Lots else varies from match to match.'),

  A('survivor', 'Every hugely successful founder I’ve read about dropped out of college. So dropping out is a smart step toward building a big company.', 'You only hear about the dropouts who made it, not the far larger number who didn’t.'),
  A('survivor', 'The old buildings in the city centre are all solid and beautiful after 200 years. Builders back then simply did better work than builders today.', 'The badly built old buildings fell down or were knocked down long ago. Only the sturdy ones are left to see.'),
  A('survivor', 'Everyone who still comes to this gym is fit and strong. So its workout plan clearly works for everyone who joins.', 'The people it didn’t work for stopped coming. You only see the ones who stayed.'),
  A('survivor', 'The planes that came back from missions had bullet holes mostly in the wings. So the engineers decided to add armour to the wings.', 'Planes hit in other places, like the engines, never came back. The missing planes show where armour matters.'),

  A('baserate', 'A test for a rare condition is 95% accurate, and my result came back positive. So there’s a 95% chance I have it.', 'If the condition is rare, most positive results are false alarms. How rare it is matters as much as the test.'),
  A('baserate', 'Most cars caught speeding on our road are silver. Silver-car drivers must be the most reckless on the road.', 'Silver is simply the most common car colour, so it tops any list. You’d need to compare with how many silver cars there are.'),
  A('baserate', 'Only 1 in 20 bikes in town is red. A witness who gets colours right 80% of the time says the thief’s bike was red, so it was almost certainly red.', 'With red bikes so rare, many of her “red” calls are mistakes about other bikes. Rarity weighs against her accuracy.'),
  A('baserate', 'Sam is shy, tidy and loves quiet evenings with a book. So Sam is more likely to be a librarian than a salesperson.', 'There are far more salespeople than librarians, so even among shy book lovers, salespeople may well outnumber them.'),

  A('straw', 'Priya suggested the team have fewer long meetings. Mark replied: “So you want us never to talk to each other? That’s how projects fail.”', 'Priya asked for fewer long meetings, not zero contact. Mark argues against something she never said.'),
  A('straw', 'A parent asked if the school could add a vegetarian lunch option. Another parent replied that forcing every child to give up meat is unfair.', 'Adding an option isn’t forcing anyone. The reply attacks a much bigger claim than the one made.'),
  A('straw', 'The cycling club proposed one car-free Sunday a month in the park. Critics said the club wants to ban cars from the whole city, which would ruin local shops.', 'One Sunday a month in one park is not a city-wide ban. The critics argue against a claim nobody made.'),
  A('straw', 'Jo said her new phone’s battery life is a bit short. Her friend answered: “If you think it’s total junk, why did you buy it?”', 'Jo made a small complaint, not a claim that the phone is junk. Her friend twisted it to make it easier to dismiss.'),

  A('dilemma', 'Either you get up at 5 a.m. every day, or you’ll never be successful. Which will it be?', 'There are many routes to success and many sleep schedules. It isn’t just these two.'),
  A('dilemma', 'If you don’t back the new parking plan exactly as written, you must want the traffic to stay terrible forever.', 'You can want better traffic and still prefer a different plan, or a changed version of this one.'),
  A('dilemma', 'Either we spend the whole budget on brand-new laptops, or we accept that staff will keep working on broken machines.', 'Repairs, a few replacements, or leasing are all other options.'),
  A('dilemma', 'You can sign up for the premium plan today, or keep losing customers. There’s no other way.', 'Plenty of other things affect customers. The ad hides every option but the two it names.'),

  A('sunk', 'We’ve already spent two years and most of the budget on this app. It’s still buggy and nobody uses it, but we can’t stop now or all that work is wasted.', 'The time and money are gone either way. The only question is whether spending more from here is worth it.'),
  A('sunk', 'The film is dull and I’m not enjoying it at all, but I paid for the ticket, so I’ll sit through the last hour.', 'The ticket is paid whether you stay or not. Staying only adds a wasted hour.'),
  A('sunk', 'This car has needed four big repairs this year and now needs a fifth. After everything I’ve put into it, I can’t sell it now.', 'Past repair bills don’t come back. Decide on what the car will cost and give you from now on.'),
  A('sunk', 'We’ve queued 40 minutes for this ride, and the sign now says another hour. Leaving would mean those 40 minutes were for nothing, so we stay.', 'The 40 minutes are spent either way. The real choice is whether the ride is worth another hour.'),

  A('hasty', 'I met two people from that town at a conference and both were rude. People from there just aren’t friendly.', 'Two people can’t tell you much about a whole town.'),
  A('hasty', 'My great-uncle smoked every day and lived to 95, so smoking can’t be that harmful.', 'One person’s story can’t outweigh studies of millions of smokers.'),
  A('hasty', 'I tried the new noodle bar once and the broth was a bit cold. That place is terrible at everything.', 'One visit and one dish is far too little to judge a whole menu.'),
  A('hasty', 'The first three customers who tried our new checkout screen loved it. Let’s roll it out in every store tomorrow.', 'Three customers is a tiny sample. A proper trial would show whether most people like it.'),

  A('authority', 'A famous actor says this herbal supplement strengthens your immune system. He’s clearly very smart, so it must work.', 'Being a great actor doesn’t make someone an expert on medicine. Look for evidence from people who study it.'),
  A('authority', 'A chess grandmaster says house prices will crash next year. Someone that brilliant must know.', 'Chess skill isn’t expertise in housing markets.'),
  A('authority', 'My dentist told me this company’s shares are about to triple, so I’m putting my savings into them.', 'A dentist knows teeth, not stock markets. Their tip carries no special weight.'),
  A('authority', 'A best-selling novelist says the new bridge design is unsafe. She’s written about engineers in her books, so she’d know.', 'Writing about engineers isn’t being one. Bridge safety needs structural experts.'),

  A('regression', 'The players with the worst season last year were sent to a special training camp. This season most of them did better, so the camp works.', 'Unusually bad seasons tend to be followed by more ordinary ones anyway. Without a comparison group, the camp’s effect is unclear.'),
  A('regression', 'Whenever the sales team has its best month ever, the boss praises them, and the next month their numbers drop. Praise must make people lazy.', 'A record month is partly luck, so the next month is usually lower whatever the boss says.'),
  A('regression', 'The schools with the very lowest test scores last year got extra inspections. This year their scores moved closer to average, proving the inspections help.', 'Extreme low scores often include bad luck and drift back up on their own.'),
  A('regression', 'I only drink this herbal tea when my back pain is at its absolute worst, and within a day it always eases. The tea must be powerful medicine.', 'Pain at its worst usually eases anyway. Taking the tea only at the peak makes it look like it works.'),

  A('cherry', 'The advert quotes the three most glowing reviews out of 300 and says customers clearly love the blender.', 'The best three out of 300 tell you nothing about the other 297.'),
  A('cherry', 'The company report boasts that sales rose 30%. It compares this December with last February, its slowest month, rather than with last December.', 'Choosing the weakest month as the comparison makes any growth look bigger.'),
  A('cherry', 'The coach shows a highlight reel of the striker’s six goals to argue he’s the best player. The reel leaves out the 20 games where he didn’t score.', 'Showing only the good games hides the full record.'),
  A('cherry', 'To prove the diet works, the leaflet shows before-and-after photos of its five biggest success stories, and says nothing about anyone else who tried it.', 'Picking the five best results hides what usually happens.'),

  A('circular', 'This news site is trustworthy because everything it publishes is true. And we know it’s true because it’s on a trustworthy site.', 'Each claim leans on the other. No outside reason is ever given.'),
  A('circular', 'Our product is the best on the market, because no other product is as good as ours.', '“No other is as good” just says “ours is best” again in different words.'),
  A('circular', 'You can trust my advice because I’m honest. How do you know I’m honest? Because I always tell the truth, and I’m telling you I am.', 'The proof of honesty is taking his word for it, which assumes he’s honest.'),
  A('circular', 'The new rule must be fair, because it’s the official rule, and official rules are fair.', 'It assumes what it’s meant to show: that the rule is fair.'),

  A('slippery', 'If we let staff work from home on Fridays, soon they’ll want Thursdays too, then the whole week, and before long nobody will come in and the company will collapse.', 'Each step is assumed, not shown. A Friday policy can stay a Friday policy.'),
  A('slippery', 'If we allow one food truck in the park, there will be ten next month, and soon the whole park will be a car park for trucks.', 'Allowing one truck doesn’t force the council to allow more. The chain is just imagined.'),
  A('slippery', 'If I let my son stay up 15 minutes later tonight, he’ll expect it every night, then he’ll stop sleeping altogether and fail school.', 'One late night doesn’t lead step by step to failing school. Each jump is unsupported.'),
  A('slippery', 'Once the library charges 10 cents for printing, it’ll start charging to borrow books, and soon libraries will be only for the rich.', 'A small printing fee doesn’t lead to charging for books. The link between the steps is never shown.'),

  A('adhom', 'Why should we listen to Dana’s plan for the budget? She can’t even keep her own desk tidy.', 'A messy desk says nothing about whether the budget plan is good.'),
  A('adhom', 'Don’t take his review of the play seriously. Have you seen how terribly he dresses?', 'His clothes have no bearing on whether his review is fair.'),
  A('adhom', 'Leo pointed out a mistake in the spreadsheet. His manager said: “You’re the newest person here, so you don’t get to tell us what’s wrong.”', 'A mistake is a mistake whoever spots it. The reply targets Leo, not his point.'),
  A('adhom', 'The neighbour says the tree is blocking the footpath, but she’s always complaining about something, so we can ignore her.', 'Whether the tree blocks the path can be checked. Her habit of complaining doesn’t change it.'),

  A('gambler', 'The roulette wheel has landed on red seven times in a row. Black is due now, so I’m putting everything on black.', 'The wheel has no memory. Black is exactly as likely as on any other spin.'),
  A('gambler', 'We’ve had four girls, so our next baby is almost certain to be a boy.', 'Each birth is close to 50/50 regardless of earlier ones.'),
  A('gambler', 'I’ve lost on this scratch card 20 times in a row. A win must be coming any time now, so I’ll buy ten more.', 'Each card’s chance is fixed. Past losses don’t make the next card any better.'),
  A('gambler', 'This fair coin has come up heads five times running. Tails is much more likely on the next flip.', 'A fair coin is still 50/50 on the next flip, whatever came before.'),

  A('goalposts', '“The new bus lane won’t save even five minutes.” The data shows it saves ten. “Well, ten minutes doesn’t count unless it also halves pollution.”', 'The test was five minutes. Once it passed, a new, harder test was invented.'),
  A('goalposts', '“Show me one study that supports it.” After being shown three, he says: “Those are just studies. Show me it works for everyone in every country.”', 'The demand changed the moment it was met.'),
  A('goalposts', 'The manager said the intern could join the team once she finished the training. She finished in a week, and now he says she also needs two years’ experience.', 'The bar was set, cleared, then raised.'),
  A('goalposts', '“Electric scooters can’t climb hills.” A rider climbs the steepest hill in town. “Fine, but not in the rain.” She does it in the rain. “Well, not with a passenger.”', 'Every time the claim is disproved, the challenge shifts to something new.'),

  A('bandwagon', 'Millions of people have downloaded this diet app, so its advice must be healthy.', 'Popularity shows good marketing, not good advice.'),
  A('bandwagon', 'Everyone in the office is buying this new digital coin, so it must be a safe investment.', 'Lots of buyers don’t make something safe. Crowds can be wrong together.'),
  A('bandwagon', 'This is the best-selling phone case in the country, which proves it protects phones better than any other.', 'Selling well can come from price or looks. It doesn’t prove better protection.'),
  A('bandwagon', 'Most of my friends believe cracking your knuckles causes arthritis, so it must be true.', 'How many people believe something doesn’t make it true. Evidence does.'),
];

// ---------------------------------------------------------------- round

interface Q { arg: Arg; options: Flaw[] }
const ROUNDS = 5;

export function makeRound(r: Rng): Q[] {
  const out: Q[] = [], used = new Set<Flaw>();
  for (const arg of shuffle(r, BANK)) {
    if (used.has(arg.f)) continue;
    used.add(arg.f);
    const decoys = shuffle(r, (Object.keys(FLAWS) as Flaw[]).filter((f) => f !== arg.f && !similar(f, arg.f))).slice(0, 3);
    out.push({ arg, options: shuffle(r, [arg.f, ...decoys]) });
    if (out.length === ROUNDS) break;
  }
  return out;
}

function checkBank(): string | null {
  if (BANK.length < 60) return `bank has ${BANK.length} arguments`;
  const types = new Set(BANK.map((a) => a.f));
  if (types.size < 14) return `only ${types.size} flaw types`;
  if (new Set(BANK.map((a) => a.text)).size !== BANK.length) return 'duplicate argument text';
  for (const a of BANK) if (!FLAWS[a.f] || !a.why.trim() || !a.text.trim()) return `bad entry: ${a.text}`;
  return null;
}

function checkRound(seed: number): string | null {
  const bad = checkBank();
  if (bad) return bad;
  const qs = makeRound(seeded(seed));
  if (qs.length !== ROUNDS) return `${qs.length} arguments`;
  if (new Set(qs.map((q) => q.arg.text)).size !== ROUNDS) return 'repeated argument';
  for (const q of qs) {
    if (q.options.length !== 4 || new Set(q.options).size !== 4) return `options not 4 distinct: ${q.options}`;
    if (q.options.filter((f) => f === q.arg.f).length !== 1) return 'not exactly one correct option';
    const near = q.options.find((f) => f !== q.arg.f && similar(f, q.arg.f));
    if (near) return `decoy ${near} too similar to ${q.arg.f}`;
  }
  return null;
}

// ---------------------------------------------------------------- display

const COLOR = '#d64545';
const css = `

.g-fallacy .fl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 600; color: var(--muted); }
.g-fallacy .fl-dots { display: flex; gap: 6px; }
.g-fallacy .fl-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--line); }
.g-fallacy .fl-dot.now { background: var(--accent); } .g-fallacy .fl-dot.right { background: var(--good); } .g-fallacy .fl-dot.wrong { background: var(--bad); }
.g-fallacy .fl-arg { font-size: 1.1rem; line-height: 1.5; border-left: 5px solid var(--accent); }
.g-fallacy .fl-arg p { margin: 0; }
.g-fallacy .fl-q { font-weight: 700; margin: 16px 0 0; }
.g-fallacy .fl-opt { flex-direction: column; align-items: flex-start; gap: 2px; min-height: 56px; width: 100%; }
.g-fallacy .fl-opt:hover:not([disabled]) { border-color: var(--accent); }
.g-fallacy .fl-opt[disabled] { opacity: 1; }
.g-fallacy .fl-opt.dim { opacity: .55; }
.g-fallacy .fl-name { font-weight: 700; }
.g-fallacy .fl-gloss { font-size: .9rem; color: var(--muted); }
.g-fallacy .fl-btns { display: flex; justify-content: flex-end; margin-top: 14px; }
.g-fallacy .fl-btns button { min-height: 48px; min-width: 140px; }
@media (max-width: 420px) { .g-fallacy .fl-arg { font-size: 1.02rem; padding: 16px; } }
`;

export const fallacy: Game = {
  id: 'fallacy', title: 'Spot the Flaw', icon: '🕵️', color: COLOR,
  blurb: 'Five arguments, five mistakes. Can you name each one?',
  how: 'Read each short argument. Every one has **exactly one** reasoning error.\n\nPick the flaw from four options, then see why. Five arguments a round.',
  course: 'biases',
  css,
  mount(el, api) {
    const qs = makeRound(api.rng);
    let i = 0, right = 0;
    const marks: string[] = qs.map(() => '');
    const missed: string[] = [];

    const show = () => {
      const q = qs[i];
      const dots = () => h('div', { class: 'fl-dots' }, ...marks.map((m, k) => h('span', { class: `fl-dot ${m || (k === i ? 'now' : '')}` })));
      const head = h('div', { class: 'fl-head' }, h('span', null, `Argument ${i + 1} of ${qs.length}`), dots());
      const btns = q.options.map((f) => h('button', { class: 'option fl-opt', onclick: () => answer(f) },
        h('span', { class: 'fl-name' }, FLAWS[f][0]), h('span', { class: 'fl-gloss' }, FLAWS[f][1])));
      const after = h('div');
      el.replaceChildren(head, h('div', { class: 'card fl-arg' }, h('p', null, q.arg.text)),
        h('p', { class: 'fl-q' }, 'What’s wrong with this reasoning?'), h('div', { class: 'options' }, ...btns), after);

      const answer = (f: Flaw) => {
        const ok = f === q.arg.f;
        if (ok) right++; else missed.push(FLAWS[q.arg.f][0]);
        marks[i] = ok ? 'right' : 'wrong';
        head.replaceChild(dots(), head.lastChild!);
        btns.forEach((b, k) => {
          b.disabled = true;
          const g = q.options[k];
          b.classList.add(g === q.arg.f ? 'right' : g === f ? 'wrong' : 'dim');
        });
        const last = i === qs.length - 1;
        const next = h('button', { class: 'primary', onclick: () => {
          if (!last) { i++; show(); return; }
          next.disabled = true;
          api.finish(right * 20, `You spotted **${right} of ${qs.length}** flaws.` + (missed.length ? `\n\nTo watch for: ${missed.join(', ')}.` : ' A clean sweep! 🕵️'));
        } }, last ? 'Finish' : 'Next argument');
        after.replaceChildren(
          h('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
            h('div', { class: 'fb-head' }, ok ? `Right: ${FLAWS[q.arg.f][0]}` : `It’s ${FLAWS[q.arg.f][0]}`),
            h('p', { style: 'margin:0' }, q.arg.why)),
          h('div', { class: 'fl-btns' }, next));
        next.focus({ preventScroll: true });
      };
    };
    show();
  },
  check: checkRound,
};
