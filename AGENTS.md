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
- Booking Production Rundown / Card Shape v1 with read-only card coverage, readiness, and workload context
- Booking Card Board + Focused Segment Setup v1 with numbered card slots and focused segment setup mode inside Booking
- Booking Default Board Compression v1 with compact board summary and collapsed Production Details context on Booking
- PLE Readiness Checklist v1 with non-spoiler major-event booking context
- PLE Build Pressure v1 with read-only normal TV/go-home/PLE context derived from current calendar, card, roster, rivalry, and title state
- Post-Show Cause Ledger v1 with retrospective explanation from resolved result data
- Wrestler Identity Context v1 with non-mechanical identity/context fields added to roster entries (display-only foundation)
- Roster Identity Context with read-only roster/profile/booking context from existing wrestler identity and current state
- Title Scene Pressure v1 with read-only championship diagnostics derived from current title, roster, rivalry, booking, calendar, and history state
- Rivalry Payoff Window v1 with read-only rivalry timing diagnostics derived from current heat, freshness, history, booking, and PLE calendar state
- Weekly GM Desk Brief with read-only dashboard/week-review staff context from current roster, calendar, finance, title, rivalry, and resolved-show state
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
- Dashboard with Living World Pressure / Office Pulse as the primary weekly pressure surface
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
- Results with a top broadcast recap package, quiet operational fallout support, Post-Show Cause Ledger, segment scores, and major title/rivalry/Open Challenge notes from resolved show data
- Dedicated Week Review screen before Advance Week
- Results → Week Review → Advance Week flow
- Week Review summary of show outcome, GM Office after-action readout, GM Handoff / next-week setup, roster fallout, championships, rivalries, social buzz, finance fallout, and next week teaser
- Persisted Week Review screen state
- TV-time tracking with appearances this season, last booked week, and consecutive weeks booked
- Open Challenge resolved opponents count as booked after the show
- Roster pressure labels for overused, underused, protected star, morale risk, and injury risk states
- Deterministic locker room fallout after shows
- Injury System v1 with deterministic minor/major injuries from fatigue and overuse, major-injury booking blocks, recovery on Advance Week, and persisted injury state
- Roster command board with compact wrestler cards, selected-superstar dock, morale trend, injury report, and read-only locker-room reads from existing momentum, morale, fatigue, injury, title, rivalry, and TV-time state
- Wrestler Profiles v1 with compact stat rows, expandable local-state detail panels, pressure labels, GM Read, championship/rivalry/social context, and deterministic read-only decision support
- Championships with title catalog context, champion/contender framing, title scene health, and read-only prestige/division identity
- Rivalries with heat, freshness, stakes, status, create/end controls, and a read-only Creative Desk / story-room pulse derived from existing rivalry timing, history, card usage, and PLE context
- Calendar
- 12-week season
- PLEs
- Season Review
- Start Next Season
- Social/IWC with existing post feed, filters, and read-only resolved-state IWC mood summary
- Finance & Brand Pressure with a read-only GM Office Pressure surface derived from current money, latest finance report, season finance history, best/worst business weeks, and closed-report cost context
- FinanceReport legacy-compatible v2 optional fields for future detailed revenue and expense categories
- Read-only gameplay context helpers extracted into src/game/gameContextReads.ts for recent derived UI snapshots while React screen components remain in src/App.tsx

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

## Current UX Role Map
- Setup frames the player as a hired GM entering a larger read-only GM universe before Draft Night.
- Dashboard orients the week through Living World Pressure / Office Pulse, next action, and current brand pressure.
- Booking is the TV production desk for assembling the current card with context and warnings, not predicted fallout.
- Results is the resolved broadcast recap and immediate consequence reveal.
- Week Review is the GM office handoff before advancing the calendar.
- Roster is the living locker room and wrestler profile surface.
- Championships is the prestige, contender, title-history, and division-health surface.
- Rivalries is the creative/story room for active feud temperature, timing, stakes, and payoff pressure from existing state.
- Social/IWC is the resolved audience mood and post-show reaction surface.
- Finance is the GM office pressure surface for current money, latest closed business result, season trend, and readable report context.
- Calendar is the season clock, PLE cadence, and upcoming-show context.
- Season Review is the end-of-season legacy and continuity recap.

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
- Pre-show surfaces may show current risks, availability, fatigue, morale risk, title/rivalry context, finance state, PLE timing, and card readiness.
- Pre-show surfaces must not show predicted grades, fan reaction, social buzz, finance fallout, title outcomes, rivalry movement, morale changes, injury outcomes, or Open Challenge opponent identity.
- Results should focus on broadcast recap.
- Results operational fallout should remain quieter support below the broadcast recap, not a second headline recap.
- Week Review should connect consequences before advancing.
- Advance Week should happen after the player has seen the week's fallout.
- The UI can warn, summarize, and provide context, but it should not secretly decide for the player.
- Big moments deserve stronger presentation.
- Dashboard should orient the player through Living World Pressure / Office Pulse, and should not restore a separate duplicate bottom footer or "<Brand> Control Room" rail.
- Booking should feel like a TV production card.
- Booking Production Rundown / Card Shape is advisory and must not change validation, Run Show enablement, simulation, or no-spoiler boundaries.
- Results should feel like a broadcast recap plus consequence screen.
- Roster should feel like a living locker room.
- Wrestler profiles should support GM decisions with character context, not become spreadsheet clutter.
- Championships should feel prestigious.
- Rivalries should feel elastic and alive.
- Rivalries should read as a creative story-room surface using existing heat, freshness, timing, card usage, and resolved history; do not imply hidden story simulation.
- Championships and rivalries should preserve meaningful history from actual gameplay.
- History should come from resolved events, not invented offscreen story.
- Social/IWC should react to actual outcomes.
- Finance should be clear, gamey, and decision-focused.
- Finance should read current and retrospective business pressure only; do not add forecasts, budgets, payroll, sponsorships, ownership objectives, or predictive financial outcomes unless explicitly requested.

## Current Phase
Phase: Post-context-pass stabilization and bounded maintenance

Goal:
Keep the recent gameplay-context passes stable, preserve the playable loop, and reduce large-file risk only through bounded, behavior-preserving slices when requested.

Current priority:
Protect the current single-screen game while keeping read-only context derived from existing state/result data. src/game/gameContextReads.ts now owns the recent pure derived read-model helpers; future context work should prefer small extracted helpers over expanding src/App.tsx further. src/App.tsx and src/styles.css are still large, so favor verification or narrowly scoped refactors before adding new UI surface.

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
- Living World Pressure v1
- Dashboard Visual Hierarchy Polish v1
- Non-Blocking Rival Draft Activity v1
- Wrestler Identity Context v1 (non-mechanical display context layer)
- Booking Production Rundown / Card Shape v1
- Booking Production Rundown Microcopy Cleanup v1
- Booking Card Board + Focused Segment Setup v1
- Booking Default Board Compression v1
- Roster Identity Context v1
- Championship Scene Context v1
- Rivalry Story Context v1
- Weekly GM Desk Brief v1
- PLE Build Pressure v1
- Show Results Broadcast Fallout v1
- Results Broadcast Recap Staging v1
- Results Operational Fallout Quieting v1
- Week Review GM Handoff v1
- Week Review Consequence Handoff Polish v1
- Roster Locker Room Personality v1
- Championships Prestige / Division Identity v1
- Social / IWC Mood Summary v1
- Setup World Framing Copy Pass v1
- Laptop UI Readability / Broadcast Hierarchy Pass v1
- Rivalries Story Room Personality v1
- Finance GM Office Pressure v1
- Read-only gameplay context helper extraction to src/game/gameContextReads.ts
- Tag Division Health Diagnostics v1
- Stipulation Metadata v1 (implemented)
- Read-Only Contract Value Profiles Planning v1
- Read-Only Contract Value Profiles v1 (implemented)
- Season Archive / Legacy Index Planning v1
- Season Archive / Legacy Index v1 (implemented)
- Roster Value-Tier Hints v1 (implemented)
- Roster Command Board / Expandable Profile Polish v1 (implemented)
- Finance Talent Value Pressure v1 (implemented)
- Finance Presence Pass v1 (implemented)
- Free Agent Watchlist v1 (implemented)
- Venue / Market Context v1 (implemented)
- Season Archive Persistence v1 (implemented)

Upcoming Direction:
- Keep the Top 200 open draft pool stable as the default draft experience.
- Keep scout/read-only career-memory features bounded while deferring signing, release, and free-agency mechanics.
- Treat season legacy as read-only narrative continuity first; defer payroll/contract mechanics and offseason systems to future tickets.
- Keep recent context passes read-only and non-predictive: pre-show surfaces may explain existing pressure, but consequences and outcome language stay retrospective after Run Show.
- Keep rival brands as pressure/flavor only unless a future accepted ticket explicitly adds simulation.
- Use src/game/gameContextReads.ts or another src/game read-model module for pure derived gameplay context when a future slice would otherwise add more helper logic to src/App.tsx.
- Treat src/App.tsx and src/styles.css as high-risk growth areas; prefer bounded extraction, verification, or small focused UI fixes over broad screen rewrites.
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
- CPU booking
- rival rosters
- rival show simulation
- brand standings or ratings battles
- ratings-battle systems
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
- For Next GM broadcast UI implementation, redesign, screen creation, or polish, use the next-gm-broadcast-ui skill. Its canonical artifacts are docs/ui/tokens/next-gm-brand-skins.tokens.yml and docs/ui/screen-templates/brand-hq-command-center/index.html.
- Treat red, blue, gold, and fight-gold as brand skins for identity. Keep semantic warning, danger, success, and info colors separate from brand color.
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
- Week Review
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
