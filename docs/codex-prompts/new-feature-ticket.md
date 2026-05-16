Follow AGENTS.md.

Task: Implement one bounded Next GM gameplay/UI feature.

Feature:
[Name the feature in one sentence.]

Problem:
[Describe the player-facing problem or missing moment this feature solves.]

Goal:
[Describe the finished behavior from the player's perspective.]

Scope:
- [Specific included behavior 1]
- [Specific included behavior 2]
- [Specific included behavior 3]

Out of scope:
- [Specific excluded behavior 1]
- [Specific excluded behavior 2]
- [Specific excluded behavior 3]

Design direction:
- Keep the game feeling like a premium dark sports broadcast and GM command center.
- Do not make it feel like a SaaS dashboard, admin panel, chatbot wrapper, or spreadsheet simulator.
- Preserve player agency.
- Do not show predicted grades, fan reaction, finance fallout, title outcomes, rivalry movement, or social reaction before the show runs.

State/persistence expectations:
- Use existing game state where possible.
- Add new state only if this feature uses it immediately.
- Keep localStorage persistence working.
- Preserve deterministic simulation behavior unless this ticket explicitly requires a simulation change.

Acceptance tests:
- [Concrete testable result 1]
- [Concrete testable result 2]
- [Concrete testable result 3]
- The core playable loop still works:
  New Game -> Dashboard -> Booking -> Run Show -> Results -> Advance Week -> Next Week Dashboard

Do not:
- Add a database.
- Add a router.
- Add Tailwind.
- Add backend services.
- Add auth.
- Add cloud sync.
- Add multiplayer.
- Build adjacent systems not listed in Scope.

Before reporting done, run:
- npm exec tsc -- --noEmit
- npm run build

When relevant, smoke-test:
- New Game / Continue / Reset Save
- Dashboard
- Booking at least 2 valid segments
- Run Show
- Results
- Advance Week
- Refresh persistence
- Any screen touched by the ticket

Report:
- What changed
- Files changed
- Verification performed
- Any known limitations
- Anything intentionally not implemented

