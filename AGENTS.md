# Next GM Agent Instructions

## Product Identity
Next GM is a complete single-player offline-first wrestling GM game.

The player runs a wrestling brand through weekly TV, PLE cycles, roster pressure, championships, rivalries, social reaction, finance pressure, and season reviews.

The game should feel like:
- premium dark sports broadcast
- underground wrestling command center
- franchise-mode clarity
- GM office pressure
- living wrestling universe

The game should not feel like:
- SaaS dashboard
- spreadsheet simulator
- admin panel
- chatbot wrapper
- generic CRUD app

## Current Tech Stack
- React 19
- TypeScript
- Vite
- Plain CSS in src/styles.css
- localStorage persistence through src/gameStorage.ts
- No router currently
- No Tailwind currently
- No backend currently
- No database currently

## Current Game Features
The game currently supports:
- Title screen
- Continue/New Game/Reset Save
- localStorage single-save persistence
- Dashboard
- Booking
- Run Show
- Results
- Advance Week
- Roster
- Championships
- Rivalries
- Calendar
- 12-week season
- PLEs
- Season Review
- Start Next Season
- Social/IWC
- Finance & Brand Pressure

## Core Playable Loop
New Game
→ Dashboard
→ Booking
→ Run Show
→ Results
→ Advance Week
→ Next Week Dashboard

The loop must remain playable after every change.

## Product Principles
- Player agency first.
- The player is the final decision-maker.
- Consequences come after action.
- Do not show predicted grades, fan reaction, finance fallout, title outcomes, rivalry movement, or social reaction before the show runs.
- The UI can warn, summarize, and provide context, but it should not secretly decide for the player.
- Big moments deserve stronger presentation.
- Dashboard should orient the player.
- Booking should feel like a TV production card.
- Results should feel like a broadcast recap plus consequence screen.
- Roster should feel like a living locker room.
- Championships should feel prestigious.
- Rivalries should feel elastic and alive.
- Social/IWC should react to actual outcomes.
- Finance should be clear, gamey, and decision-focused.

## Current Phase
Phase: Solo Career Core

Goal:
Build a complete single-player offline career loop before adding infrastructure complexity.

Current priority:
Strengthen the playable career with new game setup, draft, richer booking, roster pressure, social, finance, and season review.

## Current Phase Scope Rules
These are temporary constraints for the current phase. They are not permanent bans.

Unless the active ticket explicitly asks for it, do not add:
- database
- router
- Tailwind
- save slots
- custom logos
- modding
- scouting
- contracts
- draft
- complex accounting

## Permanent Scope Rules
These should only be added when the user explicitly asks for them in the active ticket:
- auth
- backend services
- cloud sync
- multiplayer
- external AI/API calls
- analytics tracking
- payments

## Implementation Rules
- Implement only the active ticket.
- Prefer the smallest clean change.
- Do not broaden scope.
- Do not refactor unrelated code.
- Do not rewrite working systems.
- Keep localStorage persistence working unless the active ticket is specifically about replacing/upgrading persistence.
- Keep the current playable loop working.
- Keep TypeScript passing.
- Keep the app laptop-friendly and readable.
- Use existing game state where possible.
- Add new state only when the current feature uses it immediately.
- Preserve deterministic simulation behavior unless explicitly asked to change it.

## Testing Expectations
Before reporting done, run:
- npm exec tsc -- --noEmit
- npm run build

When relevant, also smoke-test:
- New Game / Continue / Reset Save
- Dashboard
- Booking at least 2 valid segments
- Run Show
- Results
- Advance Week
- Refresh persistence
- Any screen touched by the ticket

## Completion Report Format
When done, report:
- What changed
- Files changed
- Verification performed
- Any known limitations
- Anything intentionally not implemented

Acceptance tests from the active ticket are the stopping point. When they pass, stop.
