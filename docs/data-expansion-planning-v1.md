# Data-Expansion Planning v1

## Status

The Solo Career build is RC-stable and ready for Data-Expansion Planning.

This phase is planning-only. Do not implement data expansion until a bounded plan is accepted.

## Planning Goal

Define safe boundaries for future content growth while preserving the complete offline solo career loop:

- Title -> New Game / Continue -> setup -> draft -> Week 1 Dashboard.
- Booking -> Run Show -> Results -> Week Review -> Advance Week.
- PLE weeks, Season Review, persistence, migration, and refresh recovery.

## Do Not Add Yet

Until a specific implementation ticket is accepted, do not add:

- wrestlers or draft-pool expansion
- flavor pools, recap copy pools, social posts, or finance text
- setup variants, brand variants, or GM style variants
- rivalries, titles, divisions, calendars, or PLE expansion
- gameplay systems, screens, scouting, modding, save slots, backend/database/cloud sync, router/Tailwind, or sim rewrites

## Planning Questions

Before implementation, define:

- Which data category expands first.
- The maximum safe content size for the first pass.
- The files allowed to change.
- Migration or fallback needs for older saves.
- Smoke checks required to prove the solo career loop still works.

