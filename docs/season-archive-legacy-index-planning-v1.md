# Season Archive / Legacy Index Planning v1

## 1) Why Season Archive / Legacy belongs next
The game already has a strong weekly loop and readable consequence surfaces (Show Recap, Season Review, title history, rivalry movement, social signals). The next low-risk continuity step is to preserve what matters from completed seasons so players can feel long-term consequences without adding new simulation systems.

The core reason to do this now is emotional retention: a one-screen, read-only legacy index gives a player a reason to care about what happened in a season, makes “next season” feel earned, and supports franchise-mode identity without forcing accounting systems.

## 2) What player decision / emotional payoff it should support
Season Archive should support decision framing, not enforcement.

- **Before next season setup:** helps the player benchmark whether this run is an arc worth repeating.
- **After difficult weeks:** gives a clean reflection point that the next season can improve on.
- **In the long run:** creates a memory ladder for bragging, rivalry context, and strategic planning.

Expected emotional payoff: “I can see what I built this season and what I should protect next season.”

## 3) Safe reuse of existing data
Use existing persisted or already-derived history artifacts before any new persistence:

- `SeasonReview` / season-level review text and score context
- show history / weekly outcomes
- title changes and title history
- rivalry movement/history
- finance reports (existing report payloads and pressure context)
- social/IWC post-show history
- roster pressure/momentum/popularity snapshots already tracked as part of existing systems

Use these as source material only in read-only summaries and visual highlights.

## 4) What should be saved at season end
Use the smallest persistence-safe boundary:

- **Preferred path:** render the archive index from existing season artifacts and persisted logs if all required season-end signals already exist.
- **If a summary object is needed:** create one minimal archived summary entry at `Start Next Season` containing only derived values used for the index and a timestamp/season identifier.

No new gameplay mechanics should depend on this snapshot.

## 5) Render-time derived or persisted first version?
V1 should default to render-time derivation for speed and lower migration risk.

- If season completion data is complete and deterministic, read from existing structures directly.
- If index cards require heavy aggregation every open, add a minimal persisted “legacy season summary” entry only at transition points where the season ends.

Decision rule:
- Default to derived-at-render.
- Fall back to tiny persistence only if we identify unacceptable runtime cost or unstable reconstruction.

## 6) Save compatibility and migration risks
- No migration in this planning phase.
- If adding future archived summary rows, preserve current save shape by adding optional fields with graceful fallback.
- Keep defaults in migration hardening path so older saves continue without edits.
- Never block load on missing legacy archive data.

## 7) Where the archive should surface first
First-screening lane: use one existing high-signal home while avoiding new navigation architecture.

1. Add a “Legacy Index” affordance in **Season Review** after a season closes, as a contextual extension or linked section.
2. Optionally provide a compact quick link from Dashboard/season transition surface.
3. Do not add a new major menu or screen in V1.

## 8) What the first version should include
Keep the index to a small, readable shortlist:

- Best show of the season (resolved outcome + context)
- Final money/profit delta (read-only framing)
- Top momentum star
- Most defended title
- Biggest title change
- Hottest rivalry outcome context
- PLE payoff highlight
- Season champions snapshot (single/major titles)

No predictive or simulation-forward recommendations. No forecasting widgets. No contract or payroll implications.

## 9) What should stay out of scope
For V1, explicitly defer:

- offseason mechanics
- payroll and contract systems
- standings/points ecosystems
- awards voting / Hall of Fame
- free agency / sign / release / renewal / expiry
- roster limits tied to money
- any new season formats
- score/revenue/fan reaction prediction engines
- deep-time simulation, rival simulation, or AI-only season stories

## 10) Files likely touched by future implementation ticket
Start with a bounded set:

- `docs/` updates (index definitions and tone)
- `src/` screen or component file that currently owns Season Review flow
- `src/gameStorage.ts` and related defaults only if a persisted summary model is added
- migration/hardening defaults only if optional archived fields are persisted
- tests only for null/empty data guards and render stability

No finance or simulation rule files in V1.

## 11) Acceptance tests for future implementation
- Start a season and complete the current 50-week flow to Season Review.
- End season and capture archive entry (render-time or minimal persisted summary).
- Open Legacy/Archive view and confirm top cards render without runtime errors.
- Confirm best show/title/rivalry/social/finance moments show meaningful read-only summaries.
- Start Next Season; ensure current season archive remains visible while new season continues normally.
- Load older save that predates archive implementation; index shows fallback-safe placeholders, not a crash.
- Verify no new player action is added to force payroll, contracts, roster limits, availability, or predictions.

## Out-of-band implementation guardrails
- One lane, read-only only.
- No predictive copy.
- No mechanics hooks.
- No new onboarding screens.
- No UI that feels like SaaS/accounting controls.
- No schema-breaking save changes unless explicitly accepted in a follow-up ticket.
