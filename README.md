# Sharpen

A Brilliant-style app for sharper thinking and decision making: you learn by solving. Every lesson
is a run of small problems, one idea per screen. You answer first, then see why each option is
right or tempting-but-wrong. Daily practice brings each skill back with fresh numbers, spaced out,
and what you missed comes back sooner.

## Courses

Grouped like Brilliant's catalog: Math, Probability & Data, Computer Science, Science, plus Logic & Reasoning, Decisions & Strategy, Money & Economics, and Systems & Networks.

| Course | Lessons |
| --- | --- |
| Mathematical Thinking | patterns, parity and invariants, pigeonhole, counterexamples, proof by picture, primes, induction, working backwards |
| Algebra & Functions | balancing, expressions, functions, slope and lines, systems, linear vs exponential, quadratics, inverses and logs |
| Geometry & Measurement | angles, area by rearranging, Pythagoras, circles and π, similarity, the square-cube law, transformations, estimating space |
| Data & Statistics | reading charts, mean vs median, spread, sampling, bias, correlation, Simpson's paradox, misleading graphs |
| Thinking in Code | sequencing, variables, conditionals, loops, lists, functions, debugging, programming patterns |
| Algorithms | what an algorithm is, searching, sorting, growth rates, graphs, shortest paths, greedy, recursion and DP |
| How AI Works | learning from examples, decision boundaries, measuring error, gradient descent, neurons, overfitting, language models, using AI wisely |
| Scientific Thinking | Fermi estimates, units, motion graphs, forces, energy, waves, experiments and controls, models |
| Calculus Intuition | rates of change, the derivative, rules by picture, reading derivatives, optimisation, area, the fundamental theorem, exponentials |
| The Universe by Numbers | scale, light-travel time, orbits and gravity, seasons and the Moon, parallax, starlight, the expanding universe, are we alone |
| Information & Cryptography | bits, information and surprise, compression, error correction, classical ciphers, brute force, hashing, public-key ideas |
| Puzzle Solving | understanding the problem, small cases, weighing puzzles, state spaces, constraint grids, invariants, working backwards, getting unstuck |
| Personal Finance | compound growth, inflation, debt, saving rate, diversification, fees, big decisions, money psychology |
| Economic Thinking | incentives, the margin, supply and demand, prices as signals, comparative advantage, elasticity, externalities, markets vs reality |
| Systems Thinking | stocks and flows, reinforcing and balancing loops, delays, limits to growth, leverage points, simulation, second-order effects |
| Networks & Contagion | degree and centrality, the friendship paradox, hubs, small worlds, R and spreading, herd thresholds, cascades, robustness |
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
python3 tools/serve.py # site + accounts API on :4956 (static only: serve dist/ any other way)
```

Progress lives in the browser (localStorage): lessons done, streak, daily goal, XP and the review
queue (Leitner boxes: 0, 1, 3, 7, 16, 35 days). Answer options are shuffled every time a question is
shown (numeric option sets are sorted by value), so position never gives the answer away.

## Accounts and sync

`tools/serve.py` serves the site and a small JSON API on SQLite (`data/sharpen.db`, or `$SHARPEN_DB`):
register, sign in/out (scrypt-hashed passwords, HttpOnly session cookie, throttled wrong passwords)
and one progress document per account with a version number for compare-and-swap writes.

Devices keep working offline and sync shortly after each change, on focus and every few minutes.
Merging (`join` in `src/store.ts`) is commutative and idempotent, so repeating a sync, losing a
reply, or a browser handing back an older storage snapshot can never double count:
XP/answer counters are kept per device (merge = per-device max, totals = sums), finished lessons
only grow, review items and settings carry a change time (newest wins), and "erase progress"
starts a new epoch that replaces older copies everywhere.

## Checks

```sh
bunx tsc --noEmit                        # types
bun tools/validate.ts                    # every step, and every practice generator on 500 seeds
bun test tools/test                      # progress-merge properties (no double counting)
bun tools/validate.ts src/courses/x.ts   # just one course
tools/play_course.sh logic               # plays every lesson in headless Chromium, wrong-first on every 3rd question
QA_SLOT=3 tools/play_course.sh logic     # same, with a private build and ports (several can run at once)
```

`tools/web_qa.py OUT '[steps]'` drives the app in headless Chromium (clicks, CSS-selector clicks,
JavaScript, screenshots; `QA_W/QA_H/QA_DPR` for phone sizes). `tools/autoplay.js` answers whatever
step is on screen (the player exposes it as `globalThis.__sharpenStep`).

## Code

```
src/types.ts        content model: lessons of steps (read, choice, multi, number, estimate, order, match, sort, fill, point, task) and practice generators
src/player.ts       plays steps one per screen: check, feedback, hint, try again / show answer, summary
src/app.ts          screens: home, course, lesson, daily practice, settings (hash routing)
src/store.ts        progress, streak, daily goal, spaced review, and the merge used by sync
src/sync.ts         accounts and progress sync with the server
src/ui.ts           DOM helpers, light markdown, seeded random, number formatting and parsing
src/viz/*.ts        shared visuals: plots (functions, scatter, histograms, geometry, number lines), charts, tables,
                    slider explorers, steppers, code listings and traces, array bars, networks, cell grids
src/widgets/*.ts    course-specific interactive pieces (dice grid, Monty Hall, screening lab, bankroll simulator, truth tables, 2-4-6 game, take-away game, payoff matrices…)
src/courses/*.ts    the courses; index.ts groups them into categories (_kit.ts: every exercise type once, for QA)
public/             index.html and style.css (light and dark themes)
```

To add a course: write `src/courses/<id>.ts` exporting a `Course` (see `probability.ts` for the
voice and rigour: problem first, every wrong option explains its misconception, generators compute
their answers), register it in `src/courses/index.ts`, then run the checks above.
