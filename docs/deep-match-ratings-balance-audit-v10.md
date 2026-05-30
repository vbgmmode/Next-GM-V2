# Deep Match Ratings Balance Audit v10

## Executive Summary

v10 focused on season-long progression health, top-end cap pressure, low-card growth, stipulation sensitivity, and multi-person favorite behavior.

The main finding before tuning was that the v9 progression audit was still using top-heavy fallback IDs when synthetic audit IDs were absent. That made the 50-week season overbook elite wrestlers, underrepresented low-card growth, and overstated cap pressure. v10 corrects the dev-only audit roster selection, adds richer progression diagnostics, and applies bounded tuning through `src/game/matchTuning.ts`.

No player-facing navigation, booking flow, finance formula, Social/IWC text, AI commentary, title eligibility rule, rivalry movement formula, save format, manual winner behavior, Open Challenge behavior, legacy direct `runShow(game)` behavior, or Match Simulation Lab access pattern was changed.

## Methodology

Primary deterministic audit command:

```ts
runMatchSimulationBalanceAudit({
  iterationsPerScenario: 1000,
  baseSeed: "balance-v10-baseline",
  includeProgressionSeason: true,
  progressionWeeks: 50,
});
```

The v10 audit covers 25 scenarios:

| Category | Scenarios | Iterations |
| --- | ---: | ---: |
| Singles baseline | 8 | 1,000 each |
| Stipulation sensitivity | 8 | 1,000 each |
| Tag 2v2 | 5 | 1,000 each |
| Multi-person | 4 | 1,000 each |
| Progression season | 50 weeks | 4 resolved matches/week |

## What Changed From v9

- Progression season roster selection now uses the expanded lab roster and scenario talent picker instead of falling back to the first top-ranked wrestlers.
- Progression audit output now includes median delta, starting cap counts, newly capped ratings, 95+ pressure counts, top growers, top decliners, and tier-by-tier growth.
- Stipulation audit scenarios now use targeted specialist pairs for submission, hardcore/no-DQ, ladder, and iron-man checks.
- Tuning constants remain centralized in `src/game/matchTuning.ts`.

## Tuning Changes

| Area | v9 | v10 |
| --- | ---: | ---: |
| Multi-person power exponent | 1.20 | 1.35 |
| Stipulation weight multiplier | 1.18 | 1.45 |
| Stipulation fit power multiplier | n/a | 0.45 |
| Fall-taker regression factor | 0.95 | 0.55 |
| Top-end growth diminishing start | n/a | 90 |
| Strong top-end diminishing start | n/a | 95 |
| Top-end growth multipliers | n/a | 0.45 / 0.16 |
| Low-end regression diminishing | n/a | starts at 45, strong at 25 |
| General regression multiplier | n/a | 0.60 |
| Low-rating growth multiplier | n/a | 1.35 |
| High-quality loss learning bonus | n/a | 0.20 |
| Protected loser default bonuses | small selling only | selling/resilience/timing protection |

## v9 Baseline vs v10 After

| Signal | v9 audit | v10 after |
| --- | ---: | ---: |
| Lab roster count | 120 | 120 |
| Scenario count | 22 | 25 |
| Unexpected fallback scenarios | 0 | 0 |
| Max expected-vs-actual delta | 1.11 pts | 3.90 pts |
| Average favorite win rate | 57.77% | 59.61% |
| 50-week average progression delta | -0.064 | -0.334 |
| Ratings at 0 after progression | 0 | 0 |
| Ratings at 100 after progression | 29 | 14 |
| Starting ratings at 100 | not split | 16 |
| Newly capped ratings at 100 | not split | 0 |
| Ratings at 99+ | 36 | 19 |
| Low-rated improved count | 0 | 1 |

Interpretation: v10 removes new top-end cap inflation and keeps average progression mildly negative, but no longer hides low-card behavior behind top-star-only progression fixtures.

## Progression Findings

| Checkpoint | Avg delta | Median delta | Max increase | Max decrease | Ratings at 0 | Ratings at 100 | Low-rated improved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Week 10 | -0.031 | 0.000 | +0.615 | -2.846 | 0 | 16 | 2 |
| Week 25 | -0.167 | 0.000 | +1.154 | -7.231 | 0 | 16 | 2 |
| Week 50 | -0.333 | 0.000 | +1.615 | -11.154 | 0 | 14 | 1 |

Top grower: Axiom, Enhancement, +1.615 average rating.

Largest decliner: Kenny Omega, MainEvent, -11.154 average rating. This is below the warning threshold after v10 tuning but remains worth watching because repeated unfavorable audit booking can still drag a top wrestler.

## Tier Growth

| Tier | Start avg | End avg | Avg delta | Max increase | Max decrease |
| --- | ---: | ---: | ---: | ---: | ---: |
| MainEvent | 82.353 | 81.611 | -0.741 | 0.000 | -11.154 |
| UpperCard | 72.457 | 72.385 | -0.072 | 0.000 | -1.231 |
| Midcard | 59.272 | 59.030 | -0.243 | +0.231 | -4.385 |
| Prospect | 45.709 | 45.709 | 0.000 | 0.000 | 0.000 |
| Enhancement | 39.269 | 39.359 | +0.090 | +1.615 | -1.077 |

Interpretation: low-card wrestlers can improve under positive context without exploding. Prospects remain mostly unchanged in this deterministic season because the selected progression schedule still does not book enough distinct prospect profiles.

## Stipulation Sensitivity

v10 improved the tuning surface by adding stipulation-fit power and targeted audit scenarios, but the real-roster sweep remains mixed.

| Stipulation check | Standard expected | Stip expected | Direction |
| --- | ---: | ---: | --- |
| Submission specialist | 74.41% | 75.56% | Improved, still small |
| Hardcore/no-DQ specialist | 52.05% | 50.05% | Wrong direction in this roster pair |
| Ladder/aerial specialist | 64.49% | 61.63% | Wrong direction in this roster pair |
| Iron-man/endurance specialist | 71.13% | 70.80% | Flat |

Interpretation: the domain math now supports stronger stipulation fit in controlled fixtures, and tests cover submission, no-DQ, ladder, and iron-man direction. The real roster audit still shows that some selected "specialists" carry enough cross-category strength that the scenario pairing can obscure the intended movement. This remains the clearest v11 target.

## Multi-Person Findings

| Scenario | v9 expected | v10 expected | v10 actual | Finding |
| --- | ---: | ---: | ---: | --- |
| Triple threat favorite | 58.71% | 61.83% | 61.70% | Clear favorite is more protected but still upsettable. |
| Fatal 4-way close | 25.19% | 25.20% | 25.30% | Close four-way remains chaotic. |
| Fatal 4-way dominant favorite | 42.24% | 44.48% | 44.60% | Improved but still highly diluted. |

Interpretation: v10 moves multi-person favorites in the right direction without making triple threats or fatal 4-ways behave like singles matches.

## Remaining Warnings

| Warning | Count | Notes |
| --- | ---: | --- |
| `favoriteUnderperforms` | 7 | Mostly heuristic pressure from large effective-power edges in multi/stipulation scenarios. |
| `stipulationSensitivityLow` | 8 | Real-roster stipulation pairings remain inconsistent. |
| Progression warnings | 0 | No top-cap, zero-clamp, heavy fall-taker, or protected-loser warnings remain in the 50-week pass. |

## Non-Goals

- No player-facing UI redesign.
- No changes to booking, finance, Social/IWC, AI commentary, title eligibility, rivalry movement, manual winners, Open Challenge reveal, or save format.
- No nondeterministic sampling, external dependencies, production storage writes, or UI-only simulation truth.

## Recommended v11

Deep Match Ratings v11 should focus on stipulation-specific roster-pair selection and context fit:

1. Add audit helpers that select specialists by relative rating gap, not only label/archetype.
2. Tune no-DQ, ladder, and iron-man profiles with before/after controlled and real-roster pair evidence.
3. Split multi-person warnings so fatal 4-way favorite dilution is judged by format-specific thresholds.
4. Expand progression season booking to rotate more distinct prospect profiles without increasing runtime too much.
