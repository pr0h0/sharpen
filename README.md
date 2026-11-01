# Sharpen

A Brilliant-style app for sharper thinking and decision making: you learn by solving. Every lesson
is a run of small problems, one idea per screen. You answer first, then see why each option is
right or tempting-but-wrong. Daily practice brings each skill back with fresh numbers, spaced out,
and what you missed comes back sooner.

## Courses

| Course | Lessons |
| --- | --- |
| Probability | chances, counting, the long run, and/or/at least one, conditioning, expected value, Monty Hall, reading risk |
| Bayesian Thinking | base rates, natural frequencies, false positives, updating, likelihood ratios, stacking evidence, P(A given B) vs P(B given A), everyday Bayes |
| Logic | negation, if-then, checking rules (Wason), necessary and sufficient, syllogisms, knights and knaves, grid deduction, valid vs sound |
| Decisions Under Uncertainty | decision trees, risk and ruin, bet sizing (Kelly), value of information, opportunity and sunk cost, option value, process vs outcome, calibration |
| Thinking Errors | anchoring, availability, confirmation, survivorship, regression to the mean, framing, conjunction, overconfidence |
| Strategy & Game Theory | working backwards, backward induction, dominance, the prisoner's dilemma, Nash equilibrium, mixed strategies, repeated games, auctions |

## Run it

```sh
bun install            # TypeScript, for the type check
bash tools/build.sh    # builds dist/ (served on http://localhost:4956 by the sharpen-web user service)
python3 tools/serve.py # or serve dist/ yourself
```

Progress lives in the browser (localStorage): lessons done, streak, daily goal, XP and the review
queue (Leitner boxes: 0, 1, 3, 7, 16, 35 days).

## Checks

```sh
bunx tsc --noEmit                        # types
bun tools/validate.ts                    # every step, and every practice generator on 500 seeds
bun tools/validate.ts src/courses/x.ts   # just one course
tools/play_course.sh logic               # plays every lesson in headless Chromium, wrong-first on every 3rd question
```

`tools/web_qa.py OUT '[steps]'` drives the app in headless Chromium (clicks, CSS-selector clicks,
JavaScript, screenshots; `QA_W/QA_H/QA_DPR` for phone sizes). `tools/autoplay.js` answers whatever
step is on screen (the player exposes it as `globalThis.__sharpenStep`).

## Code

```
src/types.ts        content model: lessons of steps (read, choice, number, estimate, order, task) and practice generators
src/player.ts       plays steps one per screen: check, feedback, hint, try again / show answer, summary
src/app.ts          screens: home, course, lesson, daily practice, settings (hash routing)
src/store.ts        progress, streak, daily goal, spaced review
src/ui.ts           DOM helpers, light markdown, seeded random, number formatting and parsing
src/widgets/*.ts    interactive pieces (dice grid, Monty Hall, screening lab, bankroll simulator, truth tables, 2-4-6 game, take-away game, payoff matrices…)
src/courses/*.ts    the six courses; index.ts sets their order
public/             index.html and style.css (light and dark themes)
```

To add a course: write `src/courses/<id>.ts` exporting a `Course` (see `probability.ts` for the
voice and rigour: problem first, every wrong option explains its misconception, generators compute
their answers), register it in `src/courses/index.ts`, then run the checks above.
