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
- Contract / You’re Hired setup
- Game Rules setup with difficulty and starting budget
- Difficulty stored and displayed as career framing; no broad gameplay difficulty tuning yet
- Starting budget applied to initial career money
- GM name and expanded GM style identity selection with descriptions
- Brand selection using Raw, SmackDown, NXT, and AEW as equal major prototype brands
- Rival GM assignments to unselected brands as setup flavor/state only
- Rival Brand Foundation v1 with typed persisted read-only rival brand state derived from setup assignments
- Tag Team / Affiliation Foundation v1 with typed read-only roster/profile context derived from Top 200 source metadata
- Tag Championship Foundation v1 with one tag championship, 2v2 M020 tag title matches only, pair-aware champion/history rendering, and no rankings/team records/team persistence/team-level stats
- Tag Division Health Diagnostics v1 with read-only, derived tag-division advisories on Championships/Booking/Dashboard and no rankings/team records/team persistence/team-level mechanics
- Match Format Metadata Foundation v1 with centralized current segment/match format metadata
- PLE Readiness Checklist v1 with non-spoiler major-event booking context
- Post-Show Cause Ledger v1 with retrospective explanation from resolved result data
- Wrestler Identity Context v1 with non-mechanical identity/context fields added to roster entries (display-only foundation)
- Title Scene Pressure v1 with read-only championship diagnostics derived from current title, roster, rivalry, booking, calendar, and history state
- Rivalry Payoff Window v1 with read-only rivalry timing diagnostics derived from current heat, freshness, history, booking, and PLE calendar state
- Brand Pulse v1 with read-only, non-simulated post-show brand pressure diagnostics derived from player results and static rival brand flavor
- Non-Blocking Rival Draft Activity v1 with read-only draft-week flavor diagnostics for rival-brand setup context
- Top 200 open draft pool staged from data/rosters and activated through src/game/top200DraftPool.ts
- 199 game-eligible performers available by default in Draft Night
- Open Draft Night availability across source brands; source/current brand does not restrict draft availability
- NXT treated as an equal major brand, not developmental by default
- Draft night with a 12-wrestler starting roster
- Draft Night search and sort controls for the larger pool
- Repo-owned finance-planning catalogs under data/finance
- Typed finance catalog parsing, lookup helpers, ID normalization, and Top 200 finance mapping validation through src/game/financeCatalog.ts
- Setup/Draft finance readout showing starting budget, drafted roster finance value, projected reserve, and reserve pressure
- Draft finance readout is informational only; draft picks do not spend money and affordability is not enforced
- localStorage career-save persistence
- Save loading with fallbacks for added career fields
- Save Migration Hardening v1 with centralized defaults for older localStorage saves
- Dashboard
- Booking with Match, Promo, Backstage Angle, Contract Signing, and Open Challenge segments
- Booking Balance Pass v1 with distinct segment scoring, lighter normal fatigue gain, deterministic Open Challenge risk, and tuned rivalry/fallout movement
- Segment validation and minimum-card requirements
- Deterministic Open Challenge opponent reveal at show-run time
- Segment-specific scoring and recap notes
- Championship context on eligible non-match segments without title changes
- Singles title matches that can change championships
- Title/Rivalry History v1 with lightweight title changes, defenses, rivalry movement, PLE payoffs, profile context, and season story summaries
- Rivalry context attached to eligible segments
- Run Show
- Results focused on broadcast recap, segment scores, and major title/rivalry/Open Challenge notes
- Dedicated Week Review screen before Advance Week
- Results → Week Review → Advance Week flow
- Week Review summary of show outcome, roster fallout, championships, rivalries, social buzz, finance fallout, and next week teaser
- Persisted Week Review screen state
- TV-time tracking with appearances this season, last booked week, and consecutive weeks booked
- Open Challenge resolved opponents count as booked after the show
- Roster pressure labels for overused, underused, protected star, morale risk, and injury risk states
- Deterministic locker room fallout after shows
- Injury System v1 with deterministic minor/major injuries from fatigue and overuse, major-injury booking blocks, recovery on Advance Week, and persisted injury state
- Roster
- Wrestler Profiles v1 with stats, TV history, pressure labels, championship/rivalry context, social mentions, and deterministic GM Read
- Championships with title catalog context, champion/contender framing, and title scene health
- Rivalries with heat, freshness, stakes, status, create, and end controls
- Calendar
- 12-week season
- PLEs
- Season Review
- Start Next Season
- Social/IWC
- Finance & Brand Pressure
- FinanceReport legacy-compatible v2 optional fields for future detailed revenue and expense categories

## Core Playable Loop
Title
→ New Game / Continue
→ Sign Contract
→ Game Rules
→ GM Identity
→ Brand Selection
→ Career Preview
→ Draft Night
→ Draft Review
→ Week 1 Dashboard
→ Booking
→ Run Show
→ Results
→ Week Review
→ Advance Week

The loop must remain playable after every change.

## Product Principles
- Player agency first.
- The player is the final decision-maker.
- Consequences come after action.
- Do not show predicted grades, fan reaction, finance fallout, title outcomes, rivalry movement, or social reaction before the show runs.
- Open Challenge opponents are not revealed before the show runs.
- Open Challenge opponents resolve deterministically at show-run time.
- Only Match title matches can change championships.
- Roster pressure should come from actual booking choices.
- Injury risk can be warned about before booking, but injury outcomes are revealed only after the show.
- Major injuries should affect booking availability.
- Morale and fatigue fallout should be revealed after the show, not before.
- Booking can show context and warnings, but not predicted fallout.
- Results should focus on broadcast recap.
- Week Review should connect consequences before advancing.
- Advance Week should happen after the player has seen the week's fallout.
- The UI can warn, summarize, and provide context, but it should not secretly decide for the player.
- Big moments deserve stronger presentation.
- Dashboard should orient the player.
- Booking should feel like a TV production card.
- Results should feel like a broadcast recap plus consequence screen.
- Roster should feel like a living locker room.
- Wrestler profiles should support GM decisions with character context, not become spreadsheet clutter.
- Championships should feel prestigious.
- Rivalries should feel elastic and alive.
- Championships and rivalries should preserve meaningful history from actual gameplay.
- History should come from resolved events, not invented offscreen story.
- Social/IWC should react to actual outcomes.
- Finance should be clear, gamey, and decision-focused.

## Current Phase
Phase: Season Archive Persistence v1 Implementation

Goal:
Add read-only venue/market context to post-show finance reporting so finance reads as a GM office retrospective, not predictive mechanics.

Current priority:
Persist completed-season legacy summaries at Start Next Season. Keep read-only archives available for context only. Preserve existing booking, results, finance formulas, season flow, and persistence behavior. Defer offseason, contracts, and payroll systems.

Completed stabilization passes:
- Save Migration Hardening v1
- UI Consistency Pass v1
- Full-Season Playtesting v1
- Balance & Tuning Audit v1
- Content/Flavor Polish v1
- Release Candidate Smoke Pass v1
- RC Bug Sweep v1
- RC Repo Hygiene / Prototype Artifact Packaging v1
- Screen/Menu Audit Planning v1
- Setup Flow Expansion v1
- Top 200 Open Draft Activation v1
- Finance Catalog Foundation v1
- Setup/Draft Finance Readout v1
- Finance Report Schema v2, Legacy-Compatible
- Post-Show Finance Formula v2, Report-Only Replacement
- Finance Integration Checkpoint Report v1
- Rival Brand Foundation v1
- Tag Team / Affiliation Foundation v1
- Tag Championship Foundation v1
- Match Format Metadata Foundation v1
- PLE Readiness Checklist v1
- Post-Show Cause Ledger v1
- Title Scene Pressure v1
- Rivalry Payoff Window v1
- Brand Pulse v1
- Non-Blocking Rival Draft Activity v1
- Wrestler Identity Context v1 (non-mechanical display context layer)
- Tag Division Health Diagnostics v1
- Stipulation Metadata v1 (implemented)
- Read-Only Contract Value Profiles Planning v1
- Read-Only Contract Value Profiles v1 (implemented)
- Season Archive / Legacy Index Planning v1
- Season Archive / Legacy Index v1 (implemented)
- Roster Value-Tier Hints v1 (implemented)
- Finance Talent Value Pressure v1 (implemented)
- Finance Presence Pass v1 (implemented)
- Free Agent Watchlist v1 (implemented)
- Venue / Market Context v1 (implemented)
- Season Archive Persistence v1 (implemented)

Upcoming Direction:
- Keep the Top 200 open draft pool stable as the default draft experience.
- Keep scout/read-only career-memory features bounded while deferring signing, release, and free-agency mechanics.
- Treat season legacy as read-only narrative continuity first; defer payroll/contract mechanics and offseason systems to future tickets.
- Before content expansion, define the data category, maximum safe content size, allowed files, migration or fallback needs, and required smoke checks.
- Future restricted draft modes must be explicit, optional, and requested by an active ticket.
- Future data expansion or systems work should remain bounded to an accepted ticket.
- RC bug fixes only when found.
- Small documentation or QA follow-ups.
- Consider a data persistence upgrade later, only if explicitly requested.
- Keep setup and draft bounded unless an active ticket asks to expand them.

## Current Phase Scope Rules
These are temporary constraints for the current phase. They are not permanent bans.

Unless the active ticket explicitly asks for it, do not add:
- wrestlers or draft-pool expansion
- flavor pools, recap copy pools, social posts, or finance text
- database
- router
- Tailwind
- custom logos
- modding
- setup variants, brand variants, or GM style variants
- scouting
- contract-management systems beyond the current setup framing and Contract Signing segment type
- draft expansion beyond the current new-game draft flow
- CPU drafting
- rival rosters
- rival show simulation
- brand standings or ratings battles
- salary or contract gameplay systems
- brand-restricted draft modes
- complex accounting

Open Draft Rules:
- Top 200 is the active default draft pool.
- All game-eligible Top 200 performers are draft-available by default.
- Source/current brand must not restrict draft availability by default.
- Raw, SmackDown, NXT, and AEW are equal major brands.
- NXT is not developmental by default.
- Any future restricted draft mode must be explicit and optional.

Finance Readiness Rules:
- Finance catalogs are repo-owned static data under data/finance.
- src/game/financeCatalog.ts owns finance catalog parsing, typed lookups, ID normalization, and Top 200 finance mapping validation.
- Setup/Draft finance readout is active but non-enforcing.
- Draft Night and Draft Review may show starting budget, drafted roster finance value, projected reserve, and reserve pressure.
- Draft picks still do not spend money.
- Affordability is not enforced.
- FinanceReport supports optional legacy-compatible v2 fields: modelVersion, grossRevenue, totalExpenses, revenueBreakdown, and expenseBreakdown.
- Existing saves and legacy finance reports must remain compatible.
- Current weekly finance formulas remain unchanged unless a future ticket explicitly changes them.
- Draft spending, affordability enforcement, contracts, venues, payroll, recurring expenses, segment booking costs, finance projections, and weekly formula v2 remain out of scope unless explicitly requested.

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
- For player-facing UI work, follow docs/ui-broadcast-command-center-style.md as the operational visual-system guide. It makes docs/ui-ux-doctrine.md implementation-ready without replacing the doctrine.
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

When sharing a local app URL:
- Start the dev server in a persistent session, not a short-lived detached process.
- Verify the URL returns the app HTML before reporting it.
- Provide a URL the user can open directly, such as http://localhost:5174/.
- If a previously shared URL fails, restart the server cleanly and re-verify before sending a replacement link.

## Completion Report Format
When done, report:
- What changed
- Files changed
- Verification performed
- Any known limitations
- Anything intentionally not implemented

Acceptance tests from the active ticket are the stopping point. When they pass, stop.
