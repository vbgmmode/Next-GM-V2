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
- npm with package-lock.json
- No router currently
- No Tailwind currently
- No backend currently
- No database currently

## Current Game Features
The game currently supports:
- Title screen
- Continue/New Game/Reset Save
- Multi-step new game setup
- GM name and GM style selection
- Brand name and brand style selection
- Draft night with a 12-wrestler starting roster
- localStorage single-save persistence
- Save loading with fallbacks for added career fields
- Dashboard
- Booking with Match, Promo, Backstage Angle, Contract Signing, and Open Challenge segments
- Segment validation and minimum-card requirements
- Deterministic Open Challenge opponent reveal at show-run time
- Segment-specific scoring and recap notes
- Championship context on eligible non-match segments without title changes
- Singles title matches that can change championships
- Rivalry context attached to eligible segments
- Run Show
- Results with broadcast recap, segment scores, momentum/fatigue fallout, title fallout, rivalry fallout, social buzz, and finance fallout
- Advance Week
- Roster
- Championships
- Rivalries with heat, freshness, stakes, status, create, and end controls
- Calendar
- 12-week season
- PLEs
- Season Review
- Start Next Season
- Social/IWC
- Finance & Brand Pressure

## Core Playable Loop
New Game
→ Setup Career
→ Draft Roster
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
- Open Challenge opponents are not revealed before the show runs.
- Open Challenge opponents resolve deterministically at show-run time.
- Only Match title matches can change championships.
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
Deepen the post-draft solo career by improving booking stakes, roster pressure, consequence clarity, social/finance feedback, and season review value.

Upcoming Direction:
- Add richer roster pressure and morale events.
- Run a booking balance pass across segment value, fatigue, and card composition.
- Polish post-show fallout so results, social, finance, and rivalry movement feel sharper.
- Strengthen season review and next-season carryover without adding infrastructure complexity.
- Consider save slots or a data persistence upgrade later, only if explicitly requested.
- Keep setup and draft bounded unless an active ticket asks to expand them.

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
- contract-management systems beyond the current setup framing and Contract Signing segment type
- draft expansion beyond the current new-game draft flow
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
