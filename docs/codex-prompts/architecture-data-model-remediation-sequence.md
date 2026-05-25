# Next GM V2 Architecture/Data Model Remediation Sequence

Use this as the chat-by-chat runbook for addressing the architecture/data-model audit. Open a new Codex chat for each slice, then use the `handoff` skill at the end of the chat to carry forward what changed, what passed, and what should be adjusted before the next slice.

This sequence intentionally goes from most complex/highest blast radius to least complex/lower blast radius.

## Skill Stack

Already installed / available:
- `brooks-audit`: architecture boundary and dependency review.
- `brooks-debt`: refactoring priority and tech-debt triage.
- `brooks-review`: post-diff code review.
- `brooks-test`: test-suite quality review after migration/simulation tests exist.
- `brooks-health`: occasional broad scorecard only.
- `react-best-practices`: narrow localStorage/schema-versioning guidance.
- `handoff`: end-of-chat summary for the next session.

Recommended to install or inspect before the sequence:
- `project-skill-audit`: audit whether a repo-local Next GM architecture skill should exist.
- `review-and-simplify-changes`: reduce accidental complexity after each implementation slice.
- `bug-hunt-swarm`: adversarial bug tracing after high-risk state/persistence changes.
- `codebase-migrate`: inspect first; use only for broad structural migrations.
- `adversarial-review`: inspect/select source first; use for hostile review of plans before implementation.
- `codex-code-review`: inspect/select source first; overlaps with `brooks-review`.

Install commands to run only after approval:

```bash
npx add-skill https://github.com/Dimillian/Skills/tree/main/project-skill-audit
npx add-skill https://github.com/Dimillian/Skills/tree/main/review-and-simplify-changes
npx add-skill https://github.com/Dimillian/Skills/tree/main/bug-hunt-swarm
```

Inspect before installing:

```bash
python3 /Users/vbahmad/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo ComposioHQ/awesome-codex-skills \
  --path codebase-migrate
```

## Operating Rules For Every Chat

- Read `AGENTS.md`, `DESIGN.md`, and the latest handoff first.
- Preserve the playable loop.
- Preserve localStorage compatibility unless the slice explicitly changes save migration behavior.
- Do not rebalance gameplay unless the slice explicitly requires it.
- Do not redesign UI.
- Keep each slice small enough to review.
- Prefer pure domain helpers and tests over more `App.tsx` growth.
- Before ending the chat, run the checks required by the slice.
- End every chat by invoking `handoff` with the next slice name.

Recommended handoff command:

```text
Use the handoff skill. Focus the next session on: <next slice name>. Include completed files, behavior changes, tests/build results, unresolved risks, and any prompt adjustments needed for the next slice.
```

## Progress Tracker

Update this checklist manually if a chat is allowed to edit docs. If not, copy the updated checklist into the `handoff` output.

- [ ] 1. Game State / Save Version / Migration Registry
- [ ] 2. Stable ID / Reference Strategy
- [ ] 3. Unified Durable Event Ledger
- [ ] 4. Player Brand / CPU Brand Normalization
- [ ] 5. Booking Segment / SegmentResult Discriminated Unions
- [ ] 6. Result Reference Graph
- [ ] 7. Domain Mutation Extraction From `App.tsx`
- [ ] 8. Read Model / Selector Deduplication
- [ ] 9. Finance/Social/History Cause Linking
- [ ] 10. Database-Ready Normalized Schema Planning

## Chat 1: Game State / Save Version / Migration Registry

Complexity: highest.

Goal:
Introduce or plan the foundation for explicit `GameState` save/schema versioning and a migration registry before deeper data-model changes.

Suggested skills:
- `brooks-audit`
- `brooks-debt`
- `react-best-practices`
- Optional after implementation: `brooks-review`, `review-and-simplify-changes`

Prompt:

```text
Use brooks-audit, brooks-debt, and react-best-practices. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest safe slice for “Game State / Save Version / Migration Registry.”

Read first:
- AGENTS.md
- DESIGN.md
- docs/finished-product-goal.md
- docs/dynasty-booking-north-star.md
- docs/playable-new-gm-mode-roadmap.md
- docs/playable-new-gm-mode-lean-validation-strategy.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- the latest handoff file, if provided

Constraints:
- Preserve the playable loop.
- Preserve existing localStorage saves where reasonable.
- Do not add a backend/database/router.
- Do not rebalance gameplay.
- Do not redesign UI.
- Do not start the event ledger yet.
- Do not normalize CPU/player state yet.

Deliver:
1. Brief current save-state map with file/function references.
2. Minimal implementation for explicit save version and migration registry.
3. Legacy/default handling for old saves.
4. Tests for load/save migration behavior.
5. Run npm exec tsc -- --noEmit and npm run build. Run targeted tests if added.
6. Before final, review the diff for accidental architecture expansion.

End with:
- What changed.
- Files changed.
- Verification.
- Known limitations.
- Exact handoff prompt for Chat 2.
```

Completion criteria:
- Save schema/version behavior is explicit.
- Migration/default injection is centralized enough for future slices.
- Existing saves do not crash on load.
- No gameplay behavior changes beyond safe load defaults.

## Chat 2: Stable ID / Reference Strategy

Complexity: very high.

Goal:
Replace or contain unstable gameplay IDs such as `Date.now()` and define deterministic, persistence-safe ID rules for newly-created gameplay entities.

Suggested skills:
- `brooks-audit`
- `brooks-review`
- `bug-hunt-swarm` after implementation
- Optional: `codebase-migrate` only if the implementation is broad

Prompt:

```text
Use brooks-audit and brooks-review. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest safe slice for “Stable ID / Reference Strategy.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 1

Constraints:
- Build on the save version/migration foundation from Chat 1.
- Preserve localStorage compatibility.
- Do not rewrite all state relationships.
- Do not add the event ledger yet.
- Do not rebalance gameplay or change player-facing outcomes.
- Keep IDs deterministic and safe for persistence.

Deliver:
1. Inventory current generated IDs and name/string references in the touched scope.
2. Add stable ID helper(s) or deterministic ID strategy for newly-created gameplay records.
3. Migrate or safely default existing records only where necessary for this slice.
4. Add targeted tests for ID stability and no duplicate IDs in the touched flows.
5. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.
6. Run a post-diff review for accidental broad rewrites.

End with:
- What changed.
- Files changed.
- Verification.
- Remaining string-reference risks.
- Exact handoff prompt for Chat 3.
```

Completion criteria:
- New gameplay IDs in the targeted flows no longer depend on `Date.now()` or random values.
- Existing saves remain loadable.
- Remaining string/name relationships are documented.

## Chat 3: Unified Durable Event Ledger

Complexity: very high.

Goal:
Create a durable event pattern for resolved game facts without moving all systems at once.

Suggested skills:
- `brooks-audit`
- `adversarial-review` before implementation, if installed
- `bug-hunt-swarm` after implementation
- `brooks-review`

Prompt:

```text
Use brooks-audit and brooks-review. If adversarial-review is installed, use it for the plan before editing. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest safe slice for “Unified Durable Event Ledger.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 2

Constraints:
- Do not migrate every system at once.
- Do not rewrite Results, Week Review, finance, social, championships, and rivalries all together.
- Do not change booking outcomes or scoring.
- Preserve existing history displays.
- Keep event objects internal/domain-level unless a UI read is already needed.

Deliver:
1. Minimal event type shape for durable resolved facts.
2. Persisted ledger location in game state/save state.
3. One narrow producer path, preferably show/segment resolution or title/rivalry result facts.
4. One narrow read path proving reload durability.
5. Tests for event creation, persistence, and legacy save fallback.
6. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.

End with:
- What changed.
- Files changed.
- Verification.
- Event categories intentionally not migrated yet.
- Exact handoff prompt for Chat 4.
```

Completion criteria:
- A real persisted event pattern exists.
- At least one resolved gameplay fact is represented as structured durable data.
- The implementation does not become a full rewrite.

## Chat 4: Player Brand / CPU Brand Normalization

Complexity: high.

Goal:
Reduce asymmetry between player brand state and CPU/rival brand state without exposing CPU internals or adding rival HQ screens.

Suggested skills:
- `brooks-audit`
- `brooks-debt`
- `brooks-review`

Prompt:

```text
Use brooks-audit, brooks-debt, and brooks-review. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Plan first, then implement only the smallest approved-safe slice for “Player Brand / CPU Brand Normalization.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 3

Constraints:
- Do not add rival HQ screens.
- Do not make CPU booking editable.
- Do not change CPU simulation behavior unless required for data shape compatibility.
- Preserve existing player-facing screens.
- Do not start full database normalization.

Deliver:
1. Map current player-brand and CPU-brand state shapes.
2. Identify one shared normalized concept that can be introduced safely.
3. Implement only that concept.
4. Add tests for legacy saves and current CPU/player read behavior.
5. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.

End with:
- What changed.
- Files changed.
- Verification.
- Remaining CPU/player asymmetries.
- Exact handoff prompt for Chat 5.
```

Completion criteria:
- One meaningful shared brand concept is normalized.
- Player and CPU state do not drift further apart.
- No new CPU UI scope is introduced.

## Chat 5: Booking Segment / SegmentResult Discriminated Unions

Complexity: high-medium.

Goal:
Replace optional-field bags with discriminated union foundations for segment and result types.

Suggested skills:
- `brooks-review`
- `adversarial-review` before implementation, if installed
- `bug-hunt-swarm` after implementation

Prompt:

```text
Use brooks-review. If adversarial-review is installed, use it before editing. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest safe slice for “Booking Segment / SegmentResult Discriminated Unions.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 4

Constraints:
- Preserve current booking behavior and validation.
- Preserve Results and Week Review output.
- Do not rebalance segment scoring.
- Do not rewrite the entire booking UI.
- Do not migrate every result consumer if an adapter/read model can keep scope smaller.

Deliver:
1. Identify the current optional-field bag fields and consumers.
2. Introduce discriminated union types or a compatibility adapter for the narrowest safe flow.
3. Keep legacy save compatibility.
4. Add tests for segment/result type narrowing.
5. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.

End with:
- What changed.
- Files changed.
- Verification.
- Remaining optional-bag risks.
- Exact handoff prompt for Chat 6.
```

Completion criteria:
- At least one core segment/result path has stronger discriminated typing.
- Old data still loads.
- Type narrowing reduces optional-field ambiguity.

## Chat 6: Result Reference Graph

Complexity: medium-high.

Goal:
Add explicit references such as `resultId`, `segmentId`, `segmentResultId`, and `eventId` where finance/social/history need durable causality.

Suggested skills:
- `brooks-review`
- `bug-hunt-swarm`
- `review-and-simplify-changes`

Prompt:

```text
Use brooks-review. Use bug-hunt-swarm after implementation if installed. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest safe slice for “Result Reference Graph.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 5

Constraints:
- Build on stable IDs and the event ledger foundation.
- Do not rewrite all finance/social/history systems at once.
- Do not change player-facing copy unless needed to preserve accuracy.
- Do not add predictive pre-show outcomes.

Deliver:
1. Pick one consumer family: finance, social, title/rivalry history, or Week Review.
2. Add explicit references to resolved result/event objects for that family.
3. Preserve legacy/default behavior for old saves.
4. Add tests proving references are created and survive reload.
5. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.

End with:
- What changed.
- Files changed.
- Verification.
- Remaining unlinked systems.
- Exact handoff prompt for Chat 7.
```

Completion criteria:
- One player-facing retrospective system is causally linked to durable result/event data.
- Old records without references remain readable.

## Chat 7: Domain Mutation Extraction From `App.tsx`

Complexity: medium.

Goal:
Move mutation-heavy domain flows out of `App.tsx` into focused command/domain modules after the target data contracts are clearer.

Suggested skills:
- `brooks-debt`
- `review-and-simplify-changes`
- `brooks-review`

Prompt:

```text
Use brooks-debt and brooks-review. Use review-and-simplify-changes after implementation if installed. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest behavior-preserving slice for “Domain Mutation Extraction From App.tsx.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 6

Constraints:
- Behavior-preserving extraction only.
- Do not change game balance, save shape, or UI flow unless unavoidable.
- Do not extract unrelated UI rendering.
- Prefer pure command functions with explicit inputs/outputs.

Deliver:
1. Identify one mutation-heavy flow in `App.tsx`.
2. Extract it to a domain module with tests.
3. Keep `App.tsx` as orchestration shell.
4. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.
5. Review diff for accidental broad rewrites.

End with:
- What changed.
- Files changed.
- Verification.
- Remaining `App.tsx` mutation hotspots.
- Exact handoff prompt for Chat 8.
```

Completion criteria:
- One real domain mutation flow leaves `App.tsx`.
- Tests cover the extracted behavior.
- UI flow remains unchanged.

## Chat 8: Read Model / Selector Deduplication

Complexity: medium-low.

Goal:
Consolidate repeated derived reads into `src/game/gameContextReads.ts` or adjacent read-model modules.

Suggested skills:
- `brooks-debt`
- `review-and-simplify-changes`
- `brooks-review`

Prompt:

```text
Use brooks-debt and brooks-review. Use review-and-simplify-changes after implementation if installed. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest behavior-preserving slice for “Read Model / Selector Deduplication.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 7

Constraints:
- Do not change simulation behavior.
- Do not change UI hierarchy or visual design.
- Do not add new state if a value is derived.
- Do not persist derived values unless already persisted and required for compatibility.

Deliver:
1. Identify one duplicated derived read across screens/components.
2. Extract a pure selector/read-model helper.
3. Add or update targeted tests.
4. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.

End with:
- What changed.
- Files changed.
- Verification.
- Remaining duplicated read models.
- Exact handoff prompt for Chat 9.
```

Completion criteria:
- One duplicated read model is centralized.
- Behavior and UI output remain unchanged.

## Chat 9: Finance/Social/History Cause Linking

Complexity: medium-low.

Goal:
Use existing result/event references to make finance, social, and history explainable without inventing offscreen story.

Suggested skills:
- `brooks-review`
- `bug-hunt-swarm`
- `review-and-simplify-changes`

Prompt:

```text
Use brooks-review. Use bug-hunt-swarm after implementation if installed. Work in /Users/vbahmad/Documents/AI/Next GM V2 Sandbox.

Task: Implement the smallest safe slice for “Finance/Social/History Cause Linking.”

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 8

Constraints:
- Retrospective only.
- Do not add pre-show predictions.
- Do not change finance formulas unless required to attach references.
- Do not add social flavor pools or generated content.
- Do not invent history that did not come from resolved events.

Deliver:
1. Pick one link type to harden.
2. Attach it to durable result/event references.
3. Preserve legacy records.
4. Add tests for cause/reference integrity.
5. Run npm exec tsc -- --noEmit, npm run build, and targeted tests.

End with:
- What changed.
- Files changed.
- Verification.
- Remaining cause-link gaps.
- Exact handoff prompt for Chat 10.
```

Completion criteria:
- One retrospective system can explain cause from structured references.
- No predictive or invented narrative is introduced.

## Chat 10: Database-Ready Normalized Schema Planning

Complexity: lowest as code, but important as architecture review.

Goal:
Produce a read-only schema alignment review after the domain model is cleaner.

Suggested skills:
- `brooks-audit`
- `project-skill-audit`
- Optional: `brooks-health`

Prompt:

```text
Use brooks-audit. Use project-skill-audit if installed. Do not edit files.

Task: Perform a database-readiness follow-up audit after the completed remediation slices.

Read first:
- AGENTS.md
- docs/codex-prompts/architecture-data-model-remediation-sequence.md
- latest handoff from Chat 9

Constraints:
- Audit-only.
- Do not implement database code.
- Do not add schema files.
- Do not refactor.

Deliver:
1. Current normalized-schema readiness score.
2. Mapping from current code entities to future tables/collections.
3. Remaining blockers for SQLite/Postgres migration.
4. Whether another repo-local skill should be created for future architecture slices.
5. Recommended next three implementation slices, if any.
```

Completion criteria:
- The team has a current, repo-grounded database-readiness assessment.
- Any remaining work is split into bounded implementation slices.

## How To Adjust The Next Chat Prompt

At the end of each chat, ask the agent to include this block in the handoff:

```text
Next Prompt Adjustments:
- Completed slice:
- Files changed:
- New/changed types:
- New/changed save fields:
- New migration/default behavior:
- New tests:
- Commands passed:
- Commands failed or not run:
- Scope that must not be reopened:
- Risks to check before next slice:
- Suggested edits to the next prompt:
```

Before opening the next chat:
1. Copy the matching prompt from this file.
2. Paste in the latest handoff path.
3. Apply any `Suggested edits to the next prompt`.
4. Keep any unresolved risk as an explicit constraint.
5. If a slice did not finish, repeat that slice instead of advancing.

## Best-Practice Chat Cadence

Recommended cadence:

1. Chat starts audit/planning for the slice.
2. Agent presents a short implementation plan if the slice is high risk.
3. Agent implements only the approved/obvious smallest slice.
4. Agent runs targeted tests, `npm exec tsc -- --noEmit`, and `npm run build`.
5. Agent runs `brooks-review` or `review-and-simplify-changes` if installed.
6. Agent invokes `handoff` for the next slice.
7. Next chat starts from this file plus the latest handoff.

If a slice creates messy architecture, stop the sequence and run `review-and-simplify-changes` before continuing.
