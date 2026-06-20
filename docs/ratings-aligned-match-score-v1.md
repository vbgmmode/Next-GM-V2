# Ratings-Aligned Match Score v1

## Summary

Ratings-Aligned Match Score v1 makes visible `Match` and `Open Challenge` scores use the same deep match-ratings foundation that powers playable winner selection, while preserving the broader GM-game meaning of a segment score.

The score is a composite verdict:

- in-ring quality from effective match power is the anchor
- popularity, momentum, morale, and audience heat support the score without gating elite outcomes
- stipulation fit provides capped upside only, not mismatch punishment
- fatigue and injury apply moderate demand-sensitive drag
- title/rivalry context, chemistry, PLE bonuses, stipulation catalog bonuses, and overrun penalties still apply through existing scoring flow
- same-card story coherence can add a capped boost when promos, backstage angles, or contract signings support a related match

Winner selection remains unchanged. Manual winners are still player-authored creative intent and do not receive credibility score penalties.

## Scoring Rules

`scoreSegment` accepts optional scoring context for show type, card position, current card, and segment index. Existing callers can omit it.

For match-type segments:

- `calculateEffectiveMatchPower` supplies the neutral in-ring base.
- Stipulation power is compared against neutral power; only positive lift is applied.
- Star support is bounded so popular weaker workers can raise the floor but do not automatically reach elite scores.
- Low-popularity elite workers can still produce elite scores when match ratings and condition justify it.
- Condition drag scales with demand: long matches and demanding stipulations expose fatigue/injury more than short standard matches.
- Story coherence scans the full same-show card, not only adjacent segments, and caps its scoring contribution.

For non-match segments, existing promo/angle/contract scoring remains on the prior segment-type formulas.

## Booking Story Flow

Booking now surfaces a lightweight `Story Flow` read in the production status strip.

Allowed pre-show reads:

- `Story support`
- `Threaded setup`
- `Isolated match`

The read is advisory current-card context only. It must not show predicted grades, score deltas, fan reaction, finance fallout, title outcomes, rivalry movement, morale fallout, injury outcomes, social fallout, or hidden Open Challenge opponent identity.

Open Challenge Story Flow may use issuer-only setup before Run Show. The hidden opponent remains unrevealed until show resolution.

## Verification

When touching this model, run:

```sh
npm exec vitest -- src/game/matchRatings.test.ts src/game/matchOutcomeResolver.test.ts src/game/scoring.test.ts src/game/stipulationScoring.test.ts --run
npm exec tsc -- --noEmit
npm run build
```

For Booking UI changes, verify laptop/desktop only unless the active ticket explicitly asks for mobile.
