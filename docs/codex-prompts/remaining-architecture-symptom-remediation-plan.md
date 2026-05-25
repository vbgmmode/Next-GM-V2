# Remaining Architecture Symptom Remediation Plan

Use this prompt for the next Codex agent after the 10-chat architecture/data-model remediation sequence.

## Context

Workspace:

```text
/Users/vbahmad/Documents/AI/Next GM V2 Sandbox
```

Latest handoff:

```text
/tmp/next-gm-database-readiness-planning-audit-handoff.md
```

Use these skills if available:

- `brooks-audit` for architecture boundary checks.
- `brooks-review` for final diff review.
- `review-and-simplify-changes` in `review-only` mode if the diff gets large.
- `bug-hunt-swarm` only if a concrete failing test or regression appears.

Read first:

- `AGENTS.md`
- `DESIGN.md`
- `docs/codex-prompts/architecture-data-model-remediation-sequence.md`
- `/tmp/next-gm-database-readiness-planning-audit-handoff.md`

## Hard Constraints

- Preserve localStorage/save compatibility.
- Preserve current gameplay behavior, scoring, finance formulas, booking validation, Results, Week Review, and no-spoiler boundaries.
- Do not add backend, database, router, Tailwind, cloud sync, auth, analytics, or payments.
- Do not rebalance gameplay.
- Do not redesign UI.
- Do not touch AI commentary unless explicitly required. For this task, avoid AI commentary unless needed to preserve social post reference parity.
- Keep each change behavior-preserving and test-backed.
- Do not collapse the whole architecture into a generic service layer.
- Prefer pure `GameState in -> GameState out` domain helpers.
- Keep `App.tsx` as orchestration shell: React state, persistence calls, and screen routing only.

## Goal

Remediate these remaining symptoms from the Brooks review:

1. Finance cause links still depend on `${result.id}-finance` convention.
2. Championship/rivalry history events are linked from the event ledger but do not carry direct `resultId` / `eventId`.
3. `runShow` remains the write-graph choke point.
4. `App.tsx` remains a mutation hotspot.
5. The branch/diff is too broad to safely review or promote without clear grouping.

Do the work in bounded slices. Stop after any slice if verification fails.

## Slice 1: Explicit Cause References

Goal:

Add optional explicit references without changing behavior.

Files likely touched:

- `src/game/types.ts`
- `src/game/finance.ts`
- `src/game/scoring.ts`
- `src/game/eventLedger.ts`, only if needed
- `src/game/causeLinking.ts`
- `src/game/causeLinking.test.ts`
- `src/game/finance.test.ts` or event/history tests if needed
- `src/game/migration.ts`, only if legacy normalization needs explicit default handling

Implementation:

1. Add optional fields:
   - `FinanceReport.resultId?: string`
   - `FinanceReport.eventId?: string`
   - `ChampionshipHistoryEvent.resultId?: string`
   - `ChampionshipHistoryEvent.eventId?: string`
   - `RivalryHistoryEvent.resultId?: string`
   - `RivalryHistoryEvent.eventId?: string`

2. Populate `FinanceReport.resultId` when `generateFinanceReport(result, game)` creates a new report.
   - Prefer `resultId: result.id`.
   - Add `eventId` only after a durable event exists in the show-resolution flow.
   - If event creation currently happens after finance creation, attach `eventId` in the show-resolution commit step rather than forcing `generateFinanceReport` to know about event ledger.

3. Populate history event refs for show-resolved title/rivalry events.
   - Title/rivalry events created during `runShow` should get `resultId: result.id`.
   - They should also get the show event ID once the show event exists.
   - Do not add refs to manual title assignment/revocation unless a durable event/result actually exists. Manual office actions are not show results.

4. Update `getResolvedShowCauseLinks`:
   - First lookup finance by `report.resultId === result.id`.
   - Then fallback to existing `${result.id}-finance`.
   - First lookup title/rivalry history by `event.resultId === result.id` or `event.eventId === durableEvent.id`.
   - Then fallback to `ShowResult.titleHistoryEvents`, `ShowResult.rivalryHistoryEvents`, and event-ledger related IDs.
   - Preserve same-week social fallback for legacy saves.

5. Add tests:
   - New finance reports carry `resultId`.
   - Cause linking finds finance by `resultId`.
   - Cause linking still finds legacy finance by `${result.id}-finance`.
   - Title/rivalry history records can be found by direct refs.
   - Legacy show results without refs still resolve through current fallback behavior.

Validation:

```bash
npm test -- --run src/game/causeLinking.test.ts src/game/eventLedger.test.ts src/game/finance.test.ts
npm exec tsc -- --noEmit
npm run build
```

Do not proceed if this slice changes gameplay output.

## Slice 2: Show Resolution Commit Helper

Goal:

Make the resolved-show write graph explicit without changing save shape.

Files likely touched:

- `src/game/scoring.ts`
- new file: `src/game/showResolutionCommit.ts`, or a similarly named domain helper
- `src/game/eventLedger.ts`
- `src/game/causeLinking.test.ts` or a new show-resolution commit test

Implementation:

1. Extract the append/commit portion of `runShow` into a pure helper.

Suggested shape:

```ts
export type ResolvedShowCommitInput = {
  game: GameState;
  result: ShowResult;
  wrestlers: Wrestler[];
  socialInbox: SocialInboxState;
  championships: Championship[];
  rivalries: Rivalry[];
  championshipHistoryEvents: ChampionshipHistoryEvent[];
  rivalryHistoryEvents: RivalryHistoryEvent[];
  financeReport: FinanceReport;
};

export type ResolvedShowCommit = {
  gameBeforeCpuSocial: GameState;
  event: DurableGameEvent;
  financeReport: FinanceReport;
  championshipHistoryEvents: ChampionshipHistoryEvent[];
  rivalryHistoryEvents: RivalryHistoryEvent[];
};
```

2. Helper responsibilities:
   - Create durable show event.
   - Attach `resultId` / `eventId` to finance and history records.
   - Append championship history, rivalry history, event ledger, finance report, and show history.
   - Return updated game and linked records.

3. Keep in `runShow`:
   - Segment scoring/resolution.
   - CPU weekly result generation call.
   - Social post generation call.
   - Final return shape.

4. Do not change order-sensitive behavior unless tests prove equivalence.

Current important order:

- Finance report is calculated.
- Event ledger is appended.
- CPU results are generated.
- Social posts are generated from a game containing event ledger.

5. Add tests:
   - Helper appends all expected records.
   - Helper attaches direct refs.
   - `runShow` still produces same high-level result shape.
   - Event ledger and social posts still link to the same result.

Validation:

```bash
npm test -- --run src/game/eventLedger.test.ts src/game/causeLinking.test.ts src/game/playableLoopSmoke.test.ts src/game/scoring.test.ts
npm exec tsc -- --noEmit
npm run build
```

## Slice 3: App.tsx Mutation Hotspot Reduction

Goal:

Extract one mutation family from `App.tsx`, not all of them.

Best first target:

Booking card commands.

Files likely touched:

- `src/App.tsx`
- new file: `src/game/bookingMutations.ts` or `src/game/bookingCommands.ts`
- new test: `src/game/bookingMutations.test.ts`
- `src/game/domainIds.ts`, only if helper reuse requires it

Extract these pure functions first:

- `addBookingSegment(game, type, segmentId?)`
- `updateBookingSegment(game, segmentId, updates)`
- `replaceCurrentShow(game, segments)`
- `setSegmentChampionship(game, segmentId, championshipId)`
- `setSegmentStipulation(game, segmentId, stipulationId)`
- `setSegmentRivalry(game, segmentId, rivalryId)`
- `removeBookingSegment(game, segmentId)`
- `toggleSegmentParticipant(game, segmentId, wrestlerId)`

Keep in `App.tsx`:

- `setGame`
- `persistGameSnapshot`
- `setScreen`
- `setBookingFocusSegmentId`
- profile-return state
- any `window.confirm`

Rules:

- Functions should return `GameState`.
- If no change is valid, return original `game`.
- No persistence or React state inside domain helpers.
- No UI concepts inside domain helpers.
- No broad title/rivalry extraction in this slice.

Tests:

- Add segment creates stable ID and defaults.
- Update segment trims invalid participants/winner/title/rivalry/stipulation as current code does.
- Toggle participant blocks major injury/protected rest.
- Remove segment removes only target.
- Replacement preserves passed ordering.
- Existing booking tests still pass.

Validation:

```bash
npm test -- --run src/game/bookingMutations.test.ts src/booking/buildBookingModel.test.ts src/game/playableLoopSmoke.test.ts
npm exec tsc -- --noEmit
npm run build
```

## Slice 4: Optional Title Mutation Extraction

Only do this after Slice 3 is clean.

Goal:

Move `assignChampionship` and `revokeChampionship` domain logic out of `App.tsx`.

Files likely touched:

- `src/App.tsx`
- new file: `src/game/championshipMutations.ts`
- new test: `src/game/championshipMutations.test.ts`

Extract:

- `assignChampionshipInGame(game, championshipId, championIds)`
- `revokeChampionshipInGame(game, championshipId)`

Rules:

- Domain helper creates history events.
- Domain helper should not persist or navigate.
- Preserve existing manual office action behavior.
- Do not add `resultId/eventId` to manual history events unless there is a durable office event type. If no event exists, leave them undefined.

Validation:

```bash
npm test -- --run src/game/championshipMutations.test.ts src/game/causeLinking.test.ts src/game/playableLoopSmoke.test.ts
npm exec tsc -- --noEmit
npm run build
```

## Slice 5: Read-Only Normalized Projection

Goal:

Prove database-readiness by projection, not persistence.

Files likely touched:

- new file: `src/game/normalizedCareerSnapshot.ts`
- new test: `src/game/normalizedCareerSnapshot.test.ts`
- `src/game/types.ts`, only if a small exported type is useful

Implementation:

Create `toNormalizedCareerSnapshot(game: GameState)`.

It should return read-only arrays/maps for conceptual tables:

- `brands`
- `wrestlers`
- `brandRosterMembers`
- `championships`
- `titleHistoryEvents`
- `rivalries`
- `rivalryParticipants`
- `bookingSegments`
- `showResults`
- `segmentResults`
- `financeReports`
- `socialPosts`
- `durableEvents`
- `marketContracts`
- `marketTransactions`
- `cpuBrands`
- `cpuWeeklyResults`

Rules:

- Do not persist this projection.
- Do not change save shape.
- Do not add a database.
- Do not alter gameplay.
- Projection should expose missing refs clearly, not invent fake facts.
- It may derive legacy links through `causeLinking.ts`, but must distinguish direct vs derived refs if useful.

Tests:

- Projection includes all current show history and segment results.
- Projection preserves IDs and FK-like fields.
- Projection links social posts by direct `resultId/eventId` where present.
- Projection links finance/history by direct refs where present and fallback when legacy.
- Projection handles empty/new game.

Validation:

```bash
npm test -- --run src/game/normalizedCareerSnapshot.test.ts src/game/causeLinking.test.ts
npm exec tsc -- --noEmit
npm run build
```

## Final Brooks Review

After all slices:

1. Run:

```bash
git diff --stat
npm test -- --run
npm exec tsc -- --noEmit
npm run build
```

2. Use `brooks-review` on the final diff.

3. Report:
   - Files changed
   - Behavior intentionally unchanged
   - New refs added
   - Legacy compatibility path
   - Remaining database blockers
   - Any large-diff risk

## Expected Final State

- Finance/history cause links no longer depend only on naming conventions.
- Show-resolution persistence write graph is explicit and testable.
- `App.tsx` has less domain mutation logic.
- Current localStorage save shape remains compatible.
- No database exists yet, but normalized projection proves a future database path.

## Recommended Order

1. Explicit refs.
2. Show-resolution commit helper.
3. Booking mutation extraction from `App.tsx`.
4. Optional title mutation extraction.
5. Read-only normalized projection.

Do not start with the normalized projection. It will be cleaner after refs and show commit are explicit.
