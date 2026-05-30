# Tag Championship Planning v1

## 1) Current status

- Non-title tag matches are implemented and in use.
  - Supported format: `M020` (2v2 tag match).
- Tag championships do not exist.
- Team persistence and team records do not exist.
- Champion state and title handling are currently singles-oriented (single champion IDs, singles contender model, singles title history semantics).
- Open Challenge, promos, angles, contract signings, and non-title card flow remain unchanged from the current slice.

## 2) Why this planning gate exists

Tag championship support changes title ownership from a single wrestler to a pair and therefore crosses multiple systems at once:

- Champion identity model currently expects one champion per title when title logic resolves matches.
- Existing title history entries and notes are written with singles assumptions.
- Booking controls currently bind title context through singles-only validation.
- Fallout and recap rendering assume single-winner/single-loser flows.
- Result persistence, legacy results, and old saves depend on stable pre-tag shape.

This gate exists to prevent coupling risk:

- Preserve existing singles title behavior and ranking assumptions.
- Preserve existing title history and champion-change semantics until a safe path is explicit.
- Preserve old saves/results compatibility.
- Keep non-title M020 behavior intact.
- Add the minimum required structure first.

## 3) Recommended first implementation target

Recommended ticket: **Tag Championship Foundation v1**

- One tag championship only (for safety and compatibility tracking).
- 2v2 tag title matches only.
- No tag rankings.
- No team records.
- No team-level morale/momentum/popularity.
- No freebird rule.
- No trios titles.
- No faction mechanics.
- No manager mechanics.

This target is intentionally narrow so title system evolution remains reversible if needed.

## 4) Data/model options (recommended)

### Champion pair representation
Recommend minimal explicit pair storage on championship entries:

- Add optional `championIds` as a 0/2 list for tag titles while continuing to allow 1 ID for singles.
- Keep `division`-based gating in catalog checks.
- Avoid introducing persistent team objects in v1.

### Distinguishing singles vs tag titles
Recommend explicit discriminator:

- Add/extend a minimal optional title shape field indicating scope:
  - `eligibleMatchScope` values already present: `"singles" | "tag_team"`.
- Scope controls title attachment and resolution behavior.
- Singles logic remains default when scope is missing or explicitly singles.

### Title history for team/pair
Store legacy-safe additive payload:

- History entry keeps existing required singles fields.
- Add optional pair-friendly metadata for event participants:
  - winner pairing ids
  - challenger pairing ids
  - a short `pairLabel` for safe rendering
- Keep write/read paths tolerant when optional fields are absent.

### Contender lists for tag titles
Recommend ad hoc pairing derived from match context in v1:

- For title setup and validation, derive contender side from selected `M020` segment participants.
- Avoid persistent team entities.
- Show only “active side candidates” derived from selected participant pair.

### Derived team vs stored team object
Preferred v1: no persistent team objects.

- Pair membership is inferred from booking intent (`M020` participant order: first two = Team A, last two = Team B).
- Team object creation/reuse is deferred to a later milestone.
- This preserves current wrestler-level stats and avoids new team persistence risk.

## 5) Booking validation plan

Validation gates for tag title support must be strict and isolated.

- Singles titles remain singles-only.
- Tag title attachment possible only when segment is `Match` + `M020`.
- Tag title match requires:
  - 4 unique participants
  - champion side contains exactly 2 wrestlers
  - challenger side contains exactly 2 wrestlers
  - both sides eligible per scope/division checks
  - no duplicate participant across both sides
- Title selector controls must filter by segment format and title scope.
- Open Challenge remains singles-only and must not be able to trigger or resolve tag title logic.
- Tag title controls must not appear for:
  - singles matches
  - promos
  - backstage angles
  - contract signings
- Duplicate participant handling stays generic and blocking-first so invalid rosters never enter execution.

## 6) Result/title fallout plan

Conservative behavior rules:

- Tag title changes only when challenger side wins.
- Champion pair retains on champion side win (or draw/no contest per general match result flow if applicable).
- Tag title history records both winning and losing pairs safely.
- Show Recap renders team title fallout with explicit side labels.
- Singles title fallout logic remains unchanged in all branches not explicitly scoped to tag titles.
- Do not alter prestige formula/behavior unless explicitly included in a future scoped ticket.
- No team records or team-level progression values are added.

## 7) Championships screen plan

Minimal future surface:

- Display tag title as a normal title card with:
  - champion pair label
  - reign length/defenses where derivation remains compatible
  - last title event summary with pair context
- Render history with safe team labels.
- Avoid creating tag rankings in v1.
- Optional: show derived, non-mechanical contender hints only if data can be sourced from stable booking context without persistence changes.

## 8) Legacy/save compatibility concerns

Hard constraints:

- Existing saves must continue loading.
- Existing singles championships must remain unchanged behaviorally.
- Existing title history entries must render unchanged.
- Old show results and segment history must render unchanged.
- New title fields should be optional to avoid migration risk.
- Avoid broad migration unless strictly required to avoid save fragility.
- If any migration is unavoidable, isolate it to additive defaults and preserve unknown fields.

## 9) Explicitly forbidden for this planning slice

Do not include in Tag Championship Foundation v1:

- Tag rankings.
- Team records.
- Team-level morale/momentum/popularity.
- Faction mechanics.
- Manager mechanics.
- Freebird rule.
- Trios titles.
- CPU rival tag titles.
- Contracts/free agency.
- Scouting/venues.
- New screens.
- Broad championship redesign.
- Scoring rewrite.
- Social generation expansion unless separately scoped.
- Standings engine.

## 10) Required acceptance tests for eventual implementation

- Existing singles championships render unchanged.
- Existing singles title matches still work.
- Existing non-title tag matches still work.
- Tag championship renders with champion pair.
- `M020` tag title match can be booked only when valid.
- Singles title cannot attach to `M020`.
- Tag title cannot attach to singles match.
- Tag title match with duplicate participant is blocked.
- Tag title changes only when challenger side wins.
- Show Recap, Championships, and Season Review render safely.
- Existing saves load.
- Refresh persistence works.
- Typecheck/build pass.

## 11) Recommended next Codex implementation prompt

Use this strict, bounded prompt for the next task:

```text
Implement only Tag Championship Foundation v1, preserving all existing behavior outside title scope.

Scope:
1) Add one optional tag championship (2v2 only) without changing existing singles title resolution.
2) Extend title metadata minimally so a title can be flagged as tag_team and championId representation can safely support a 2-wrestler pair only for tag titles.
3) Add optional, backward-compatible title history metadata to record winner pair and loser pair for tag title changes/defenses.
4) Add booking-time validation so tag title can only be attached to Match + M020 with exactly 4 unique participants and with champion+challenger sides.
5) Ensure tag titles are unavailable for Open Challenge, promos, backstage angles, and contract signings.
6) Ensure tag titles do not alter open challenge logic, promo/angle behavior, singles title behavior, rivalry movement, injury fallout, and show flow.
7) Add rendering in Show Recap/Championships for safe pair labels where optional fields exist; keep fallback rendering for legacy singles data and old saves.

Explicitly forbidden:
- Do not add tag rankings, team records, team-level stats, team persistence, faction mechanics, manager mechanics, freebird rule, trios titles, CPU rival tag titles, new screens, broader scoring rewrites, or migration-heavy refactors.
- Do not modify non-title tag match execution, Open Challenge reveal, segment validation for non-tag match types, or existing save file formats unless required for minimal optional backward compatibility.

Acceptance checks:
- Singles titles and non-title tag matches unchanged.
- Existing saves/legacy results load and render.
- Tag title attach/resolve path is isolated to Match M020.
- Challengers must be the opposing 2 members.
- Duplicate wrestlers in tag title segment are blocked.
- Build and typecheck are green.
```
