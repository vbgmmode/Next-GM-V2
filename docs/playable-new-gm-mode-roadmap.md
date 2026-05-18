# Playable New GM Mode Roadmap

## Purpose

This document describes how the current playable prototype should grow toward the finished product.

It is a sequencing guide, not an active ticket list. A feature is only in scope when a specific ticket asks for it.

## Current Baseline

As of this roadmap, the game supports the solo weekly loop:

Title -> Setup -> Draft Night -> Draft Review -> Dashboard -> Booking -> Run Show -> Results -> Week Review -> Advance Week -> Season Review -> Start Next Season

The current mode includes localStorage persistence, deterministic show resolution, roster pressure, injuries, title changes, rivalry movement, social posts, finance reports, season archives, read-only rival brand flavor, tag title support, Rivalries Command Desk support for singles/tag 2v2/multi rivalry structures, and multiple read-only context surfaces.

## Near-Term Product Direction

Prioritize bounded improvements that preserve the current loop:

- Strengthen player-facing UI clarity and command-center presentation.
- Keep Booking as the primary decision surface.
- Let Booking feel staged instead of cramped: the player should be able to see the card/rundown as they build, then enter focused setup surfaces for matchups, promos, title context, rivalry context, and other segment details.
- Keep Results and Week Review as consequence reveal surfaces.
- Keep finance, contract, scout, rival-brand, tag, and season-memory features read-only unless a ticket explicitly adds gameplay.
- Prefer stabilization, validation, and focused UI polish over broad new systems.

## Near-Term Architecture Direction

Improve maintainability only through bounded, behavior-preserving slices:

- Move pure derived read-model logic out of `src/App.tsx` when practical.
- Extract repeated UI/readout helpers only when they are already stable.
- Do not use refactors as cover for new gameplay systems.
- Preserve deterministic outcomes, localStorage compatibility, and the current playable loop.

## Medium-Term Product Growth

When explicitly requested, grow the game through small playable systems:

- Scouting and talent evaluation with uncertainty.
- Free agent watch and signing flow.
- Contract management with readable pressure and clear player choices.
- Venue or production decisions that affect show economics.
- Deeper season archive and career legacy surfaces.
- Stronger rivalry planning and payoff tools beyond the current singles/tag 2v2/multi Rivalries Command Desk.
- Deeper championship scene management beyond the current Champion Wall, vacant-title assignment, revocation, title booking shortcut, and contender edit controls.
- Tag/faction systems beyond read-only affiliation context.

## Later Product Growth

Defer these until the core loop and current architecture can support them safely:

- CPU drafting.
- CPU booking.
- Rival rosters.
- Rival show simulation.
- Ratings battles or brand standings.
- Payroll and complex accounting.
- Offseason systems.
- Multi-year career systems.
- Modding, database, backend, cloud sync, multiplayer, or external services.

## Roadmap Rule

The current playable loop is the product spine. Every roadmap item must either improve the loop, deepen a meaningful GM decision, or make consequences clearer. If it does not do one of those, it should wait.
