# Deep Match Ratings Balance Audit v9

## What Changed From v8

v9 expands the dev-only Match Simulation Lab roster from a top-star fallback fixture into the full hydrated lab roster, then applies bounded tuning where v8 evidence was clear.

Implemented changes:

- The dev lab now builds a simulation-only game with the full hydrated draft-pool roster, not only the first 12 fallback wrestlers.
- The lab screen adds lightweight search, tier, style, and sort filters.
- The balance audit now selects real draft-pool wrestlers across elite, mid-card, lower-card, prospect/jobber, and specialist scenarios.
- Tuning constants were centralized in `src/game/matchTuning.ts`.
- Bounded tuning was applied to large-gap win probability, multi-person favorite weighting, stipulation weight contrast, fall-taker fatigue weighting, and progression protection/regression.

No player-facing navigation, booking flow, finance, Social/IWC, AI commentary, title rules, rivalry movement, save shape, manual winner behavior, Open Challenge reveal behavior, or legacy `runShow(game)` default behavior changed.

## Roster Coverage Improvements

Previous lab source:

- `App.tsx` created the no-save dev lab game with `createNewGame({ draftedWrestlers: draftPool.slice(0, 12) })`.
- `MatchSimulationLabScreen` then rendered `game.wrestlers.filter(...).slice(0, 80)`.
- With no active career, the lab only had the first 12 draft-pool wrestlers, which are top-ranked/top-star-biased.

Current lab source:

- `createMatchSimulationLabGame(game)` builds a dev-only simulation game.
- `getMatchSimulationLabRoster(game)` merges active-game wrestlers with the hydrated `draftPool`.
- All lab-visible wrestlers are hydrated through `ensureMatchRatings`.
- No production storage writes are made.

Current lab roster count from the v9 audit run: 120 wrestlers.

| Tier | Count |
| --- | ---: |
| MainEvent | 36 |
| UpperCard | 17 |
| Midcard | 52 |
| Prospect | 9 |
| Enhancement | 6 |

## Methodology

Report data came from a deterministic 1,000-iteration audit:

```ts
runMatchSimulationBalanceAudit({
  iterationsPerScenario: 1000,
  baseSeed: "balance-v9-report",
  includeProgressionSeason: true,
  progressionWeeks: 50,
});
```

The temporary output test used to print the JSON was removed after capture. Durable coverage remains in `src/game/matchSimulationBalanceAudit.test.ts`.

## Scenario Matrix

| Category | Scenarios | Iterations |
| --- | ---: | ---: |
| Singles baseline | 8 | 1,000 each |
| Stipulation sensitivity | 5 | 1,000 each |
| Tag 2v2 | 5 | 1,000 each |
| Multi-person | 4 | 1,000 each |
| Progression season | 50 weeks | 4 resolved matches/week |

## Key Audit Results

| Signal | v8 | v9 |
| --- | ---: | ---: |
| Lab roster count | 12 fallback wrestlers in no-save lab | 120 hydrated lab wrestlers |
| Scenario count | 21 | 22 |
| Unexpected fallback scenarios | 0 | 0 |
| Max expected-vs-actual delta | 1.25 pts | 1.11 pts |
| Average favorite win rate | 49.08% | 57.77% |
| 50-week progression average delta | -18.144 | -0.064 |
| Ratings at 0 after progression | 20 | 0 |
| Ratings at 100 after progression | 0 in synthetic v8 roster | 29 in full roster |

## Tuning Changes Made

| Area | Change | Evidence |
| --- | --- | --- |
| Win probability | Added mild exponent to effective-power ratio. | v8 extreme singles favorite had 32 power edge but only 63.2% win rate. |
| Multi-person winner weighting | Added mild exponent to multi-person weighted pick and lab expected math. | v8 dominant favorites were heavily diluted in triple/four-way matches. |
| Stipulation weighting | Added central stipulation contrast multiplier. | v8 stipulation changes moved outcomes too little. |
| Tag fall-taker risk | Increased fatigue contribution in fall-taker weighting. | v8 high-fatigue partner scenario did not surface fatigue strongly enough. |
| Progression | Reduced fall-taker regression, reduced protected-loser penalty factor, increased high-quality loss growth. | v8 showed severe long-run deflation and protected losers too close to fall-takers. |

Constants live in `src/game/matchTuning.ts`.

## Singles Findings

| Scenario | Participants | Favorite expected | Favorite actual | Upset rate | Warning |
| --- | --- | ---: | ---: | ---: | --- |
| Elite vs elite | Kenny Omega / Kazuchika Okada | 50.53% | 51.0% | 49.0% | None |
| Elite vs mid-card | Kenny Omega / Dominik Mysterio | 61.32% | 61.1% | 38.9% | None |
| Elite vs prospect/jobber | Kenny Omega / Brutus Creed | 76.79% | 76.5% | 23.5% | None |
| Mid-card vs mid-card | Dominik Mysterio / Ilja Dragunov | 50.28% | 50.0% | 50.0% | None |
| Low-pop technical vs high-pop entertainer | Solo Sikoa / Seth Rollins | 59.69% | 60.0% | 40.0% | None |
| Submission specialist vs powerhouse | Cash Wheeler / Brutus Creed | 74.43% | 74.3% | 25.7% | Favorite under 75% despite large power edge |
| High flyer vs brawler | Axiom / Mark Briscoe | 64.49% | 64.6% | 35.4% | None |
| High fatigue favorite vs fresh underdog | Jon Moxley / Axiom | 74.39% | 75.5% | 24.5% | None |

Interpretation: large-gap singles are now meaningfully stronger without eliminating upset chance.

## Stipulation Findings

Same matchup: Cash Wheeler vs Tommaso Ciampa.

| Stipulation | Favorite expected | Favorite actual | Finding |
| --- | ---: | ---: | --- |
| Standard | 60.59% | 60.5% | Baseline |
| Submission | 60.98% | 61.1% | Directional but small |
| No DQ | 60.12% | 60.4% | Low impact |
| Ladder | 60.56% | 60.4% | Low impact |
| Iron Man | 60.65% | 60.6% | Low impact |

Interpretation: the v9 multiplier did not solve stipulation sensitivity for real roster specialists. This should remain a v10 tuning target, likely requiring stronger profile-specific fit bonuses rather than only global weight contrast.

## Tag Findings

| Scenario | Favorite actual | Top fall-taker | Fall share | Protected coverage |
| --- | ---: | --- | ---: | ---: |
| Balanced teams | 50.2% | Dominik Mysterio | 25.8% | 100% |
| One-star/one-weak vs balanced | 50.5% | Brutus Creed | 36.3% | 100% |
| High-fatigue partner risk | 59.1% | Axiom | 41.4% | 100% |
| Protected partner behavior | 64.1% | Brutus Creed | 39.2% | 100% |
| Favorite team vs underdog team | 75.7% | Axiom | 39.3% | 100% |

Interpretation: protected participant data remains valid and fall-taker concentration stays below the warning threshold. Fatigue weighting improved but the top fall-taker is still often the weaker underdog rather than simply the tired wrestler, which may be acceptable because weakness and fatigue both matter.

## Multi-Person Findings

| Scenario | Favorite expected | Favorite actual | Upset share | Top fall-taker | Protected coverage |
| --- | ---: | ---: | ---: | --- | ---: |
| Triple threat favorite | 58.71% | 57.9% | 42.1% | Axiom | 100% |
| Four-way close mid-carders | 25.19% | 26.0% | 74.0% | Shinsuke Nakamura | 200% |
| Four-way dominant favorite | 42.24% | 42.4% | 57.6% | Brutus Creed | 200% |
| Fall/protection distribution | 29.22% | 30.0% | 70.0% | Brutus Creed | 200% |

Interpretation: v9 improves dominant favorite protection compared with v8, but four-way matches still strongly dilute top talent. That may be correct for chaotic formats, but it remains a tuning decision.

## Progression Findings

| Checkpoint | Avg rating | Avg delta | Max increase | Max decrease | Ratings at 0 | Ratings at 99+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Start | 66.047 | 0 | 0 | 0 | 0 | n/a |
| Week 10 | 66.147 | +0.101 | +3.308 | 0 | 0 | 27 |
| Week 25 | 66.119 | +0.072 | +3.923 | 0 | 0 | 33 |
| Week 50 | 65.983 | -0.064 | +1.308 | -4.462 | 0 | 36 |

Interpretation: v9 fixes the v8 deflation problem. The remaining risk is upper-bound pressure: 36 ratings reached 99+ and 29 hit 100 in the full-roster progression pass. Some of that comes from already-elite full-roster inputs, but v10 should separate starting cap pressure from progression-caused cap pressure.

## Remaining Warnings

| Warning | Count | Notes |
| --- | ---: | --- |
| `stipulationSensitivityLow` | 9 | The scenario-level and sweep-level warnings both show weak stipulation movement. |
| `favoriteUnderperforms` | 3 | One singles specialist mismatch and two multi-person favorite cases still sit below the heuristic. |
| `topRatingsApproachCap` | 1 | Full-roster progression has high-end cap pressure. |

## Non-Goals

- No player-facing UI redesign.
- No changes to booking flow, finance, Social/IWC, AI commentary, title eligibility, rivalry formulas, or save compatibility.
- No nondeterministic sampling, external dependencies, or production storage writes.
- No player-facing tuning controls.

## Recommended v10

1. Add stipulation-fit bonuses that compare each wrestler's strongest style against the stipulation profile, instead of only multiplying global weights.
2. Split progression cap warnings into starting-at-cap vs moved-to-cap metrics.
3. Decide product intent for multi-person chaos: protect dominant favorites more, or accept four-way dilution as the format fantasy.
4. Add dedicated tag-team source metadata scenarios once tag-team data is strong enough to distinguish real team specialists from singles pairings.
5. Add an optional persisted audit JSON generator only if reports become frequent enough to justify a dev script.
