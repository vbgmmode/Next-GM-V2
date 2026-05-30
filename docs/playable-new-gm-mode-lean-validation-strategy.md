# Playable New GM Mode Lean Validation Strategy

## Purpose

This document defines how to size, validate, and stop work on Next GM changes.

Use it to keep tickets bounded, protect the playable loop, and prevent UI polish or context work from turning into unplanned system expansion.

## Before Starting A Ticket

Classify the requested work as one slice type before editing files.

If the work appears to cross slice types, use the highest-risk category for validation. For example, a UI change that adds derived reads is a Read-Only Context Slice, not merely a UI-Only Slice.

If the request implies a Large System Slice but does not explicitly authorize one, stop and report the needed plan instead of implementing.

## Slice Types

### Doc-Only Slice

Changes planning docs, prompts, doctrine, or instructions only.

Required validation:

- `git diff --check`
- Confirm no game code changed unless explicitly requested.

### UI-Only Slice

Changes player-facing layout, copy hierarchy, CSS, or component structure without changing gameplay behavior.

Required validation:

- `git diff --check`
- `npm exec tsc -- --noEmit`
- `npm run build`
- Render or browser-check touched screens when feasible.
- Check desktop/laptop widths for clipping, overflow, hidden actions, unwanted primary-page scroll, and loss of the main decision/action.

### Read-Only Context Slice

Adds derived UI reads from existing game state or resolved result data.

Required validation:

- `git diff --check`
- `npm exec tsc -- --noEmit`
- `npm run build`
- Smoke the touched screens.
- Confirm no hidden outcomes, forecasts, or invented offscreen truth were added.

### Small Behavior Slice

Changes a narrow rule, validation path, or deterministic gameplay helper.

Required validation:

- `git diff --check`
- `npm exec tsc -- --noEmit`
- `npm run build`
- Smoke the affected loop path.
- Confirm old saves still load when persistence is touched.
- Confirm deterministic behavior remains deterministic.

### Large System Slice

Adds a new gameplay loop, persisted state, simulation surface, or major screen.

Default stance:

- Do not implement unless the active ticket explicitly requests it.
- Require a design note or implementation plan before code changes.
- Define persistence/migration needs, affected screens, acceptance tests, and rollback risk.

Required validation must be defined by the active ticket and should include, at minimum:

- `git diff --check`
- `npm exec tsc -- --noEmit`
- `npm run build`
- Persistence/migration verification when state changes.
- Core loop smoke testing.
- Touched-screen smoke testing.

## Stop Conditions

Stop when the active ticket’s acceptance tests pass.

Do not keep expanding because adjacent systems are visible. Record follow-up ideas separately instead of implementing them.

## Core Regression Checks

When relevant, verify:

- New Game.
- Continue.
- Dashboard.
- Booking with at least two valid segments.
- Run Show.
- Show Recap + GM Handoff.
- Advance Week.
- Refresh persistence.
- Any touched screen.

## No-Spoiler Validation

For pre-show surfaces, confirm they do not reveal:

- predicted grades
- fan reaction
- social buzz
- finance fallout
- title outcomes
- rivalry movement
- morale changes
- injury outcomes
- Open Challenge opponent identity

## Reporting Format

Completion reports should include:

- What changed.
- Files changed.
- Verification performed.
- Known limitations.
- Anything intentionally not implemented.
