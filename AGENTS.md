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
- Difficulty stored as a central campaign pressure profile with conservative tuning for CPU draft quality, CPU weekly result pressure, CPU market behavior, office pressure, morale fallout, and overuse/injury tolerance
- Starting budget applied to initial career money
- GM name and expanded GM style identity selection with descriptions
- Brand selection using Raw, SmackDown, NXT, and AEW as equal major prototype brands
- Rival GM assignments to unselected brands as setup flavor/state only
- Rival Brand Foundation v1 with typed persisted read-only rival brand state derived from setup assignments
- Tag Team / Affiliation Foundation v1 with typed read-only roster/profile context derived from Top 200 source metadata
- Tag Championship Foundation v1 with one tag championship, 2v2 M020 tag title matches only, pair-aware champion/history rendering, and no rankings/team records/team persistence/team-level stats
- Tag Division Health Diagnostics v1 with read-only, derived tag-division advisories on Championships/Booking/Dashboard and no rankings/team records/team persistence/team-level mechanics
- Tag Team Synergy v1 with internal M020 deep-ratings tag power using individual power average, exact source tag-team affiliation context, impromptu MainEvent ego-clash penalty, and no tag XP, tag records, tag management UI, or team persistence
- Match Format Metadata Foundation v1 with centralized current segment/match format metadata
- Match Pacing Context v1 with internal `MatchPacing` support for Sprint/Normal/Epic match-power weighting; Normal is current default behavior and no Booking pacing UI or persistence exists yet
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
- Full CPU Rival System v1 with deterministic parallel rival draft claims, persisted rival rosters, hidden CPU card simulation, CPU titles/rivalries/injuries/finance/free-agent claims, ratings-battle standings, and summarized post-show Results Feed pressure
- Full Market + Rival Pressure v1 with player free-agent signings, tag/faction bundle signings at a 20% package discount, releases, deterministic trade proposals, contract/payroll pressure, CPU market churn, limited Rival Intelligence, and office mandates that affect money/trust/reputation without firing or progression locks
- Top 200 open draft pool staged from data/rosters and activated through src/game/top200DraftPool.ts
- 120 source-balanced game-eligible performers available by default in Draft Night from the staged Top 200 roster data, with Madden-like in-game stat distribution applied at export
- Open Draft Night availability across source brands; player brand selection does not restrict draft availability
- NXT treated as an equal major brand, not developmental by default
- Draft night with a 12-wrestler TV-ready guidance target, money-based drafting limit, no hard roster-count cap, and tag/faction bundle picks at a 20% package discount
- Draft Night search and sort controls for the larger pool
- Repo-owned finance-planning catalogs under data/finance
- Typed finance catalog parsing, lookup helpers, ID normalization, and Top 200 finance mapping validation through src/game/financeCatalog.ts
- Setup/Draft finance readout showing starting budget, drafted roster finance value, projected reserve, and reserve pressure
- Draft finance readout is active; Money Based starts enforce affordability from draft value, CPU rivals draft until no affordable candidate remains, and Unlimited remains sandbox
- localStorage career-save persistence
- Save loading with fallbacks for added career fields
- Save Migration Hardening v1 with centralized defaults for older localStorage saves
- Dashboard with Living World Pressure / Office Pulse as the primary weekly pressure surface
- Booking with Match, Promo, Backstage Angle, Contract Signing, and Open Challenge segments
- Book Finish creative control with free optional manual winners per match, default simulated winners, tag-side winner selection for tag matches, and Open Challenge pre-show finish control limited to simulate or issuer wins without revealing the hidden opponent
- Booking Balance Pass v1 with distinct segment scoring, lighter normal fatigue gain, deterministic Open Challenge risk, and tuned rivalry/fallout movement
- Segment validation and minimum-card requirements
- Deterministic Open Challenge opponent reveal at show-run time
- Segment-specific scoring and recap notes
- Championship context on eligible non-match segments without title changes
- Singles title matches that can change championships
- Title/Rivalry History v1 with lightweight title changes, defenses, rivalry movement, PLE payoffs, profile context, and season story summaries
- Rivalry context attached to eligible segments
- Run Show
- Results with a viewport-fit top broadcast recap package, collapsed Post-Show Cause Ledger, collapsed operational fallout support, expandable broadcast breakdown, and major title/rivalry/PLE/Open Challenge notes folded into resolved post-show readouts
- Dedicated Week Review screen before Advance Week
- Results → Week Review → Advance Week flow
- Week Review aftermath handoff with the Advance Week or Season Review action inside the PLE/week aftermath box, plus show outcome, GM Office after-action readout, roster fallout, social buzz, rivalries, and next-week setup without duplicating full Results/Finance/Championship fallout panels
- Persisted Week Review screen state
- TV-time tracking with appearances this season, last booked week, and consecutive weeks booked
- Open Challenge resolved opponents count as booked after the show
- Roster pressure labels for overused, underused, protected star, morale risk, and injury risk states
- Deterministic locker room fallout after shows
- Injury System v1 with deterministic minor/major injuries from fatigue and overuse, major-injury booking blocks, recovery on Advance Week, and persisted injury state
- Roster command board with compact wrestler cards, selected-superstar dock, morale trend, injury report, and read-only locker-room reads from existing momentum, morale, fatigue, injury, title, rivalry, sentiment, records, and TV-time state
- Wrestler Profiles v1 with compact stat rows, audience heat/trust and season/career record splits, expandable local-state detail panels, pressure labels, GM Read, championship/rivalry/social context, and deterministic read-only decision support
- Championships with a viewport-fit Champion Wall, selected-title command workspace, collapsed committee support strip, contained panel scrolling, title catalog context, vacant-title assignment, champion revocation, player-edited contender order, selected-title contender board, title scene health, and title history for assigned/revoked/resolved title events
- Rivalries Command Desk with active rivalry rail, selected rivalry spotlight, compact Creative Desk strip, create/end controls, and current-state reads from existing heat, freshness, timing, history, card usage, and PLE context
- Rivalry structure support for Singles, Tag 2v2, and Multi rivalries, with optional persisted `Rivalry.structure`, legacy saves defaulting to singles, participantIds remaining canonical, and no team records, faction records, rankings, or team-level stats
- Calendar
- 50-week season
- 10 PLEs
- Five-week PLE cycles: 3 TV weeks, Go-Home week, then PLE
- Season Review
- Mid-Career Draft between Season Review and Start Next Season
- Start Next Season
- Social/IWC with existing post feed, filters, and read-only resolved-state IWC mood summary
- Finance & Brand Pressure with active contract/market pressure, GM Office Pressure derived from current money, latest finance report, season finance history, best/worst business weeks, and closed-report show cost context, with finance summary metrics under nav and expandable support panels for talent value, latest report, season reads, and finance history
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
→ Season Review
→ Mid-Career Draft
→ Start Next Season

The loop must remain playable after every change.

## Current UX Role Map
- Setup frames the player as a hired GM entering a larger GM universe before Draft Night.
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
- Season Review is the end-of-season legacy and continuity recap before the Mid-Career Draft.

## Product Principles
- Player agency first.
- The player is the final decision-maker.
- Book Finish is free creative control: simulated winners remain the default, manual winners use the same consequence math as simulated winners, and manual finish selection should not add production cost, credibility penalties, special IWC language, or post-show result labels by default.
- Consequences come after action.
- Do not show predicted grades, fan reaction, finance fallout, title outcomes, rivalry movement, or social reaction before the show runs.
- Open Challenge opponents are not revealed before the show runs.
- Open Challenge opponents resolve deterministically at show-run time.
- Only Match title matches and singles Open Challenge title matches can change championships.
- Roster pressure should come from actual booking choices.
- Injury risk can be warned about before booking, but injury outcomes are revealed only after the show.
- Major injuries should affect booking availability.
- Morale and fatigue fallout should be revealed after the show, not before.
- Booking can show context and warnings, but not predicted fallout.
- Pre-show surfaces may show current risks, availability, fatigue, morale risk, title/rivalry context, finance state, PLE timing, and card readiness.
- Pre-show surfaces must not show predicted grades, fan reaction, social buzz, finance fallout, title outcomes, rivalry movement, morale changes, injury outcomes, or Open Challenge opponent identity.
- A manually booked finish is player-authored intent, not a predicted outcome; Open Challenge finish controls must not reveal the hidden opponent before Run Show.
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
- Finance should read current and retrospective business pressure only; active payroll, market transactions, and office mandates are allowed, but do not add forecasts, sponsorships, predictive financial outcomes, firing, or progression locks unless explicitly requested.

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
- Results Viewport-Fit Expandable Fallout v1 (implemented)
- Week Review GM Handoff v1
- Week Review Consequence Handoff Polish v1
- Week Review Aftermath Action Consolidation v1 (implemented)
- Roster Locker Room Personality v1
- Championships Prestige / Division Identity v1
- Championships Command Board / Contender Control v1 (implemented, viewport-fit)
- Social / IWC Mood Summary v1
- Setup World Framing Copy Pass v1
- Laptop UI Readability / Broadcast Hierarchy Pass v1
- Rivalries Story Room Personality v1
- Rivalries Command Desk / Expanded Structures v1 (implemented)
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
- Finance Support Panel Collapse v1 (implemented)
- Free Agent Watchlist v1 (implemented)
- Venue / Market Context v1 (implemented)
- Season Archive Persistence v1 (implemented)
- Full CPU Rival System v1 (implemented)
- Full Market + Rival Pressure v1 (implemented)
- Mechanics Review v1 with 50-week seasons, 10 PLE cadence, 52-week prepaid contract cap, no hard roster-count draft/market cap, Mid-Career Draft, singles Open Challenge title resolution, audience heat/trust, and season/career singles/tag records (implemented)
- Match Pacing Context v1 (implemented as internal simulation hook only; no Booking pacing UI or persistence)
- Tag Team Synergy v1 (implemented for M020 deep-ratings tag power; positive synergy defaults to zero until an explicit experience source exists)

Upcoming Direction:
- Keep the Top 200 open draft pool stable as the default draft experience.
- Keep scout/read-only career-memory features bounded while using the active Market desk for signing, release, trade, and contract pressure.
- Treat season legacy as read-only narrative continuity first; keep the Mid-Career Draft bounded to the current offseason roster-refresh loop.
- Keep recent context passes read-only and non-predictive: pre-show surfaces may explain existing pressure, but consequences and outcome language stay retrospective after Run Show.
- Keep rival brands as summarized ratings-battle and market pressure with deterministic internal CPU simulation; do not expand into rival HQ screens, editable CPU booking, progression locks, firing, or career-ending fail states unless a future accepted ticket explicitly asks for it.
- Use src/game/gameContextReads.ts or another src/game read-model module for pure derived gameplay context when a future slice would otherwise add more helper logic to src/App.tsx.
- Treat src/App.tsx and src/styles.css as high-risk growth areas; prefer bounded extraction, verification, or small focused UI fixes over broad screen rewrites.
- Before content expansion, define the data category, maximum safe content size, allowed files, migration or fallback needs, and required smoke checks.
- Future restricted draft modes must be explicit, optional, and requested by an active ticket.
- Future data expansion or systems work should remain bounded to an accepted ticket.
- Future Booking Match Pacing UI, tag-team experience sources, tag-team records, tag management UI, and tag persistence require explicit accepted tickets.
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
- draft expansion beyond the current new-game draft flow
- CPU booking editors
- full CPU segment-by-segment booking
- rival HQ roster/championship/rivalry/finance screens
- hard fail states from CPU standings
- brand-restricted draft modes
- complex accounting

Open Draft Rules:
- Top 200 is the active default draft pool.
- Game-eligible Top 200 performers are staged for the active draft pool, with source-brand cap and Madden-like stat distribution applied in src/game/top200DraftPool.ts to prevent one source roster from dominating Draft Night or prototype stats from reading too optimistic.
- Source/current brand must not restrict draft availability by the player's selected brand.
- Raw, SmackDown, NXT, and AEW are equal major brands.
- NXT is not developmental by default.
- Any future restricted draft mode must be explicit and optional.

Finance Readiness Rules:
- Finance catalogs are repo-owned static data under data/finance.
- src/game/financeCatalog.ts owns finance catalog parsing, typed lookups, ID normalization, and Top 200 finance mapping validation.
- Setup/Draft finance readout is active.
- Draft Night and Draft Review may show starting budget, drafted roster finance value, projected reserve, and reserve pressure.
- Setup budget options are $2M and Unlimited; legacy $1M/$4M saves normalize to $2M.
- Money Based Draft Night prevents picks the current reserve cannot cover.
- CPU rival opening draft allocation spends rival draft budgets until no affordable candidate remains.
- Unlimited budget bypasses draft affordability.
- FinanceReport supports optional legacy-compatible v2 fields: modelVersion, grossRevenue, totalExpenses, revenueBreakdown, and expenseBreakdown.
- Existing saves and legacy finance reports must remain compatible.
- Current closed-show finance reports use resolved show economics: attendance, ticket revenue, merch revenue, media revenue, base production, segment production, stipulation production, and overrun cost. Contract/payroll and market transaction pressure remains active through market/office systems, but should not be folded into the closed-show report unless a future accepted ticket explicitly asks for that formula change.
- Sponsorships, segment booking costs, finance projections, complex accounting, and weekly formula v2 remain out of scope unless explicitly requested.

Save Compatibility Rules:
- Current production season cadence is 50 weeks / 10 PLEs for new careers.
- Older localStorage saves from prior season-cadence prototypes may be deleted instead of migrated.
- Do not add a 52-week / 13-PLE calendar migration unless an active ticket explicitly asks for preserving those old saves.

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
- For player-facing UI work, read DESIGN.md first (Agent Quick Contract + the relevant Screen Contract), then follow docs/ui-broadcast-command-center-style.md as the operational visual-system guide. It makes docs/ui-ux-doctrine.md implementation-ready without replacing the doctrine.
- For Next GM broadcast UI implementation, redesign, screen creation, or polish, use the next-gm-broadcast-ui skill. Its canonical artifacts are docs/ui/tokens/next-gm-brand-skins.tokens.yml and docs/ui/screen-templates/brand-hq-command-center/index.html.
- Treat red, blue, gold, and fight-gold as brand skins for identity. Keep semantic warning, danger, success, and info colors separate from brand color.
- Keep localStorage persistence working unless the active ticket is specifically about replacing/upgrading persistence.
- Keep the current playable loop working.
- Keep TypeScript passing.
- Keep the app laptop-friendly and readable.
- Use existing game state where possible.
- Add new state only when the current feature uses it immediately.
- Preserve deterministic simulation behavior unless explicitly asked to change it.
- Treat match pacing and tag-team synergy as internal simulation hooks unless the active ticket explicitly asks to expose UI, persistence, or new team state.

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

When touching match power, match pacing, or deep-ratings tag resolution, also run:
- npm exec vitest -- src/game/matchRatings.test.ts --run
- npm exec vitest -- src/game/matchOutcomeResolver.test.ts --run

When sharing a local app URL:
- Start the dev server in a persistent session, not a short-lived detached process.
- Verify the URL returns the app HTML before reporting it.
- Provide a URL the user can open directly: sandbox `http://localhost:4000/`, prod worktree `http://localhost:5176/` (fixed in each folder's `vite.config.ts`).
- If a previously shared URL fails, restart the server cleanly and re-verify before sending a replacement link.

## Completion Report Format
When done, report:
- What changed
- Files changed
- Verification performed
- Any known limitations
- Anything intentionally not implemented

Acceptance tests from the active ticket are the stopping point. When they pass, stop.
