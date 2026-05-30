# Non-Title Tag Match Planning v1

## 1) Current status

World-building and diagnostics work is complete for Phase 1, and the game has started safe content expansion with a non-mechanical wrestler identity layer.

Current foundations:

- Tag Team / Affiliation Foundation v1 is present as read-only team/affiliation context.
- Match Format Metadata Foundation v1 is in place for typed match presentation metadata.
- Wrestler Identity Context v1 adds non-mechanical role/style/context fields to existing roster entries only.

What does not yet exist:

- Non-title tag match booking.
- Any tag titles.
- Team-based persistence, team records, or team standing systems.

## 2) Why this planning gate exists

Non-title tag matches touch core systems in a way that is riskier than diagnostics and content-only slices:

- booking validation and participant shape assumptions,
- match result and scoring paths,
- rivalry/title/ranking-free assumptions,
- injury/fatigue/morale fallout expectations,
- Show Recap rendering,
- future compatibility with match-format metadata and title mechanics.

The gate exists to keep the existing offline solo loop stable while defining a bounded, reversible path forward.

## 3) Recommended first implementation target

Target implementation ticket: **Non-Title Tag Match Booking v1**.

- Scope is strictly 2v2 standard tag matches.
- No tag titles.
- No trio/multi-person tag variants.
- No stipulation variants (ladder/cage/tornado/etc.).
- No team-level persistence.
- No team win/loss records.

## 4) Proposed data/model approach

### Participant modeling

For this lane, represent tag-specific participant structure as a match-format-specific participant grouping while preserving current one-on-one segment behavior.

Recommended approach:

- Keep existing single-match segment shape as-is for non-tag matches.
- Extend match payload for `matchFormat === "tag"` (or equivalent metadata key) with:
  - `teamA: [wrestlerId, wrestlerId]`
  - `teamB: [wrestlerId, wrestlerId]`

This should be represented in a discriminated way so old segments and one-on-one match shape remain untouched.

### Core safety checks for model compatibility

- Do not break existing segment validation by mutating current singles-only paths.
- Keep fatigue/morale/injury/momentum updates at wrestler granularity (no team-level aggregates).
- Use existing affiliation/team metadata only as read-only labels for display and messaging.
- Ensure `Match Format Metadata` remains the gating source for whether the tag composer and readout are available.

## 5) Booking validation rules (future v1)

- Exactly four unique wrestlers required.
- Exactly two wrestlers per side.
- No duplicate wrestler across both sides.
- Existing availability rules still apply (injury, major injury, fatigue risk policy, TV/time constraints).
- Tag matches are ineligible for title toggles in v1.
- Rivalry attachment:
  - defer or explicitly constrain to avoid ambiguous side-level rivalry outcomes.
  - do not introduce new rivalry mechanics.
- Open Challenge remains singles-only in v1 unless separately scoped.

## 6) Result/scoring behavior (future v1)

- Reuse existing scoring framework where possible.
- Quality calculation should include all participating wrestlers in a deterministic way that aligns with current scoring signals.
- Fatigue/morale/momentum updates stay wrestler-level and deterministic per participant.
- Match outcome tracks winner side and loser side; no team records.
- No title movement behavior for tag matches in v1.
- Recap text should present a clean side-vs-side readout with readable winner framing.

## 7) UI surface plan (future v1)

- Keep current screen structure.
- Booking flow: `match format -> team side A wrestlers -> team side B wrestlers`.
- Card summary line should include team-vs-team context.
- Results rendering should support a readable tag-side outcome label.
- The Show Recap handoff should only reflect this if existing consequence surfaces naturally consume participants; no new post-show screens.

## 8) Explicitly forbidden for this implementation slice

- No tag titles.
- No tag rankings or laddered team progressions.
- No team records/pools/team persistence.
- No team-level morale/momentum/injury logic.
- No faction mechanics or manager mechanics.
- No CPU drafting or rival brand simulation.
- No contracts/free agency/payout systems tied to taging.
- No new screens.
- No broad UI redesign.
- No scoring engine rewrite.
- No title logic rewrite.
- No new social generation tied to tag fields (unless tightly bounded and later scoped).

## 9) Legacy/save compatibility concerns

- Existing saves must load.
- Existing segments/results must render as before.
- If segment shape changes are required, they must be optional and backward-compatible via discriminated unions.
- Avoid adding a migration unless strict schema safety requires it.
- Existing show results should remain unchanged in meaning and display.
- Keep deterministic behavior and non-spoiler timing intact outside the new feature.

## 10) Required acceptance tests for eventual implementation

- Singles matches remain bookable and unchanged in behavior.
- Promos, angles, contract signing, and open challenge segments remain unchanged.
- Tag match can be booked with exactly 4 unique eligible wrestlers.
- Duplicate participants are blocked.
- Title flag/toggle cannot be enabled for tag matches.
- Show can run with mixed card (singles + promo + tag).
- Results render tag matches without crash.
- Show Recap and Advance Week continue to function.
- Existing saves load and continue through refresh.
- `npm exec tsc -- --noEmit` and `npm run build` still pass.

## 11) Recommended next Codex implementation prompt

Use this as the next prompt:

> Implement **Non-Title Tag Match Booking v1**. Add a bounded 2v2 non-title tag match format that is strictly additive and preserves all existing gameplay behavior outside tagging. Keep singles validation and results logic as the default. Ensure tag participants are modeled without breaking existing one-on-one segment shape, keep fatigue/morale/momentum updates wrestler-level, keep title movement mechanics unchanged, keep open challenge singles-only, and render tag outcomes clearly in Results and any existing summary surfaces. Do not add tag titles, team records, team persistence, faction mechanics, CPU behavior, rival simulations, contracts/free agency, or any scoring/title/rivalry logic rewrites. Keep changes to existing files only as needed, type-safe, with fallbacks for legacy segments/saves, and run `tsc --noEmit` and `npm run build`.

## Highest-risk areas to watch first

- Segment typing and parser assumptions around participant arrays.
- Booked segment summaries that assume one opponent pair.
- Open Challenge and title guardrails accidentally accepting tag metadata.
- Any result rendering path that infers side winner from singles ordering.
- Any place where team/side labels are persisted as mutable authoritative state.
