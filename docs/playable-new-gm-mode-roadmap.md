# Playable New GM Mode Roadmap

## Purpose

This document describes how the current playable prototype should grow toward the finished product.

It is a sequencing guide, not an active ticket list. A feature is only in scope when a specific ticket asks for it.

## Current Baseline

As of this roadmap, the game supports the solo weekly loop:

Title -> Setup -> Draft Night -> Draft Review -> Dashboard -> Booking -> Run Show -> Show Recap + GM Handoff -> Advance Week / Season Review -> Start Next Season

The current mode includes localStorage persistence, deterministic show resolution, free optional Book Finish control with simulated winners as the default, roster pressure, injuries, title changes, rivalry movement from active stories, rotating read-only championship contender guidance from initial title-rank lanes, social posts, finance reports, season archives, deterministic CPU rival brands, limited Rival Intelligence, player/CPU market transactions, tag title support, Rivalries Command Desk support for singles/tag 2v2/multi rivalry structures, a portrait-led Wrestler Profile Command File with focused report windows, and multiple read-only context surfaces. Automatic upper-card singles title reads initially use ranks 1-3 per gender, automatic mid-card singles title reads initially use ranks 4-6 per gender, manual same-gender contender lanes remain authoritative, and new player careers no longer auto-seed starter rivalries after Draft Night.

## Near-Term Product Direction

Prioritize bounded improvements that preserve the current loop:

- Strengthen player-facing UI clarity and command-center presentation.
- Keep Booking as the primary decision surface.
- Let Booking feel staged instead of cramped: the player should be able to see the card/rundown as they build, then enter focused setup surfaces for matchups, promos, title context, rivalry context, and other segment details.
- Keep Show Recap as the consequence reveal surface, with first-class segment inspection in a focused Segment Receipt window, a fixed Show Fallout Desk band, and a compact GM Handoff footer before the calendar advances.
- Keep wrestler profiles as curated command files: role/status first, compact default ratings, and deeper ratings/career/creative/office context in focused report windows.
- Keep scout, rival visibility, tag, and season-memory features bounded unless a ticket explicitly adds gameplay; finance, contracts, and market pressure are now active gameplay systems.
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
- Rival-brand pressure beyond the current summarized CPU Results Feed and Rival Intelligence only when it preserves player agency and avoids rival HQ/editor sprawl.

## Later Product Growth

Defer these until the core loop and current architecture can support them safely:

- Editable CPU booking or full rival HQ management screens.
- Full rival HQ management, editable CPU booking, or manual CPU transaction control.
- Progression locks, firing, or career-ending fail states from CPU standings.
- Complex accounting beyond the active contract/payroll/transaction ledger.
- Offseason systems.
- Multi-year career systems.
- Modding, database, backend, cloud sync, multiplayer, or external services.

## Roadmap Rule

The current playable loop is the product spine. Every roadmap item must either improve the loop, deepen a meaningful GM decision, or make consequences clearer. If it does not do one of those, it should wait.
