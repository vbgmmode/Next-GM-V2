# Deep Match Ratings Balance Audit v8

## Executive Summary

Deep Match Ratings v8 adds a deterministic long-run audit harness for the existing Match Simulation Lab. It does not tune live gameplay formulas.

The 1,000-iteration audit found strong deterministic alignment between expected and actual win probabilities: max expected-vs-actual delta was 1.25 percentage points across 21 scenarios, with 0 fallback resolutions. The bigger tuning signals are balance-shape issues rather than sampling drift:

- Extreme singles favorites are not deterministic enough for the current heuristic: a 32 effective-power edge produced a 63.2% win rate.
- Multi-person matches dilute favorites heavily: the same 32 effective-power edge produced only 41.9% in a triple threat and 31.5% in a four-way.
- Stipulations move directionally, but No DQ, Ladder, and Iron Man produced less than 1.5 percentage points of expected-outcome movement in this specialist matchup.
- Tag and multi-person fall/protection audits are present and stable; protected participant coverage was complete.
- The cloned 50-week progression pass showed strong deflation, not inflation: average rating moved from 64.349 to 46.205, with 20 individual ratings clamped at 0 and none at 100.

## Methodology

Audit helper:

```ts
runMatchSimulationBalanceAudit({
  iterationsPerScenario: 1000,
  baseSeed: "balance-v8-report",
  includeProgressionSeason: true,
  progressionWeeks: 50,
});
```

Source command used to capture the deterministic report data:

```bash
npm test -- --run src/game/matchSimulationBalanceAudit.output.test.ts --reporter dot
```

That temporary output runner was removed after capturing the numbers. The durable helper and focused tests remain in `src/game/matchSimulationBalanceAudit.ts` and `src/game/matchSimulationBalanceAudit.test.ts`.

The audit uses `runMatchSimulationLab(input)` for scenario batches and a cloned `runShow` progression pass for long-run rating movement. It does not call `Math.random`, add dependencies, write production storage, or change gameplay defaults.

## Scenario Matrix

| Category | Scenarios | Iterations |
| --- | ---: | ---: |
| Singles baseline | 7 | 1,000 each |
| Stipulation sensitivity | 5 | 1,000 each |
| Tag 2v2 | 5 | 1,000 each |
| Multi-person | 4 | 1,000 each |
| Progression season | 50 weeks | 4 resolved matches/week |

## Key Findings

| Signal | Result |
| --- | --- |
| Fallbacks | 0 across all supported scenarios |
| Max expected-vs-actual delta | 1.25 percentage points |
| Average favorite win rate | 49.08% across all scenarios |
| Warning count | 11 |
| Rating inflation | Not observed |
| Rating deflation | Observed, severe by week 50 |
| Ratings at 100 after 50 weeks | 0 |
| Ratings at 0 after 50 weeks | 20 |

## Singles Findings

| Scenario | Favorite expected | Favorite actual | Upset rate | Warning |
| --- | ---: | ---: | ---: | --- |
| Close matchup | 50.23% | 49.8% | 50.2% | None |
| Favorite vs underdog | 56.09% | 56.2% | 43.8% | None |
| Extreme favorite vs prospect | 63.34% | 63.2% | 36.8% | Favorite underperforms large power edge |
| Popularity-heavy vs skill-heavy | 51.84% | 51.9% | 48.1% | None |
| High stamina vs low stamina | 53.04% | 52.7% | 47.3% | None |
| High momentum vs low momentum | 50.45% | 49.2% | 50.8% | None |
| High fatigue favorite vs fresh underdog | 53.85% | 54.0% | 46.0% | None |

Interpretation: probability sampling is stable, but singles may be too resistant to large power separation. Momentum and stamina differences are present but modest.

## Stipulation Findings

Same matchup: Audit Submission Specialist vs Audit Chaos Flyer.

| Stipulation | Favorite | Expected | Actual | Finding |
| --- | --- | ---: | ---: | --- |
| Standard | Chaos Flyer | 50.98% | 51.5% | Baseline close |
| Submission | Submission Specialist | 50.66% | 50.7% | Directionally correct but small |
| No DQ | Chaos Flyer | 52.20% | 52.5% | Low impact |
| Ladder | Chaos Flyer | 52.30% | 52.2% | Low impact |
| Iron Man | Chaos Flyer | 50.56% | 51.1% | Low impact |

Interpretation: stipulation weighting is directionally believable, but the measured win-rate movement is probably too weak for a tuning system meant to make stipulation choice matter.

## Tag Findings

| Scenario | Favorite actual | Top fall-taker | Fall share | Protected coverage |
| --- | ---: | --- | ---: | ---: |
| Balanced teams | 50.7% | Audit Hot Hand | 30.9% | 100% |
| Strong/weak vs balanced | 51.8% | Audit Prospect | 40.1% | 100% |
| High-fatigue partner risk | 50.1% | Audit Fresh Underdog | 30.3% | 100% |
| Protected partner behavior | 54.9% | Audit Prospect | 36.1% | 100% |
| Favorite team vs underdog team | 58.9% | Audit Prospect | 34.6% | 100% |

Interpretation: tag fall-taker and protected-loser data is consistently present. Fall-taker concentration did not breach the 78% warning threshold. The one suspicious read is the high-fatigue partner scenario: the intended tired favorite did not become the top fall-taker, so v9 should inspect whether fatigue is weighted strongly enough in team fall selection.

## Multi-Person Findings

| Scenario | Favorite expected | Favorite actual | Upset share | Top fall-taker | Protected coverage |
| --- | ---: | ---: | ---: | --- | ---: |
| Triple threat favorite | 42.34% | 41.9% | 58.1% | Audit Prospect | 100% |
| Four-way close | 26.11% | 26.2% | 73.8% | Audit Hot Hand | 200% |
| Four-way extreme favorite | 31.30% | 31.5% | 68.5% | Audit Prospect | 200% |
| Fall/protection distribution | 29.64% | 29.7% | 70.3% | Audit Prospect | 200% |

Interpretation: distribution math is stable, but multi-person formats strongly flatten favorite protection. Protected participant distribution is valid: four-ways produce two protected losers per iteration, hence 200% coverage.

## Progression Findings

| Checkpoint | Avg rating | Avg delta | Max increase | Max decrease | Ratings at 0 | Ratings at 99+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Start | 64.349 | 0 | 0 | 0 | 0 | 0 |
| Week 10 | 62.549 | -1.800 | +1.462 | -9.846 | 0 | 0 |
| Week 25 | 56.021 | -8.328 | 0 | -28.462 | 4 | 0 |
| Week 50 | 46.205 | -18.144 | 0 | -54.308 | 20 | 0 |

Additional progression metrics:

- Low-rated improved count: 0
- Fall-taker average total delta: -8.110
- Protected loser average total delta: -7.333
- Protected loser cushion vs fall-taker: 0.777
- Source game mutated: false

Interpretation: the audit does not show rating inflation. It shows severe long-run deflation, hard lower-bound pressure, and protected-loser penalties too close to fall-taker penalties.

## Warnings Table

| Warning | Count | Notes |
| --- | ---: | --- |
| `favoriteUnderperforms` | 4 | Extreme singles and multi-person favorites look too beatable for their power edge. |
| `stipulationSensitivityLow` | 3 | No DQ, Ladder, and Iron Man moved expected outcome by less than 1.5 points. |
| `progressionDeflation` | 1 | Average rating dropped 18.144 points over 50 weeks. |
| `ratingClampPressure` | 1 | Worst average wrestler movement reached -54.308. |
| `fallTakerRegressionHeavy` | 1 | Fall-takers averaged -8.110 total rating delta per fall. |
| `protectedLoserPenaltyTooCloseToFallTaker` | 1 | Protected losers averaged only 0.777 points softer than fall-takers. |

## Recommended Tuning Candidates For v9

1. Revisit the win-probability curve for large power gaps, especially singles favorite vs prospect/jobber cases.
2. Decide whether multi-person matches should intentionally flatten favorites this hard; if not, add a favorite-protection curve for three-ways and four-ways.
3. Increase stipulation-specific effective-power separation or add clearer stipulation fit bonuses.
4. Review fatigue contribution to tag fall-taker selection, because the high-fatigue partner scenario did not surface the tired wrestler as the top fall risk.
5. Rebalance progression loss/regression math before any inflation work; the current long-run signal is deflation and lower-bound clamping.
6. Increase protected-loser cushion relative to fall-taker penalties.
7. Add a repeatable report-generation script only after v9 thresholds settle; v8 intentionally keeps package/config churn out.

## Non-Goals / What Was Not Changed

- No live match outcome formulas changed.
- No `matchRatings` progression formulas changed.
- No booking flow, UI navigation, finance, social/IWC, AI commentary, title eligibility, rivalry movement, show scoring, save format, playable defaults, or legacy defaults changed.
- No external dependencies or nondeterministic sampling were added.
- No production storage writes were introduced.

