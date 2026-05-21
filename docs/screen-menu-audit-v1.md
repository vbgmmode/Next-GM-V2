# Screen/Menu Audit Planning v1

## Status

Next GM is in Solo Career RC Stable / Screen/Menu Audit Planning v1.

This document is an audit scaffold. It is for reviewing current screens, menus, and flows before any data expansion or UI implementation work begins.

Do not use this document as permission to add wrestlers, flavor pools, social or finance text, setup variants, rivalries, titles, screens, systems, save slots, backend/cloud, router/Tailwind, scouting, modding, sim rewrites, or app behavior changes.

## Audit Goals

- Inspect every current player-facing screen and flow.
- Record where each screen is data-rich, data-thin, clear, confusing, exciting, or too generic.
- Compare each screen against the UI/UX doctrine: premium dark sports broadcast, underground wrestling command center, franchise-mode clarity, player agency, retrospective consequences, and living-world feedback.
- Identify what player decision each screen should support.
- Capture open questions for human review after hands-on play.

## Current Screen Inventory

- `/title`
- `/setup/contract`
- `/setup/gm`
- `/setup/brand`
- `/setup/preview`
- `/setup/draft`
- `/setup/review`
- `/dashboard`
- `/booking`
- `/roster`
- `/roster/profile/:wrestlerId`
- `/championships`
- `/rivalries`
- `/calendar`
- `/social`
- `/finance`
- `/results`
- `/week-review`
- `/season-review`
- `global-nav`
- `advance-week-flow`
- `start-next-season-flow`

## Audit Method

For each screen, play through the current app and fill in:

- What feels strong now.
- What feels thin, generic, or unclear.
- Which data would help decisions without spoiling outcomes.
- Which UI moments deserve stronger presentation.
- Which changes should wait for a later implementation ticket.

Priority guide:

- P0: blocks comprehension, player agency, or the core solo loop.
- P1: important for the next planning/implementation pass.
- P2: polish or future content depth.

## `/title`

### Current Purpose

Start or resume the offline solo career.

### Current Data Shown

- Product name.
- Short game loop promise.
- Continue button when a save exists.
- New Game.
- Reset Save when a save exists.

### Missing Or Thin Data

- No visible save summary beyond whether a save exists.
- No current brand, week, season, or GM identity preview on Continue.

### Current UI/UX Feel

Focused and clean. It communicates the core loop quickly.

### UI/UX Gaps Against Doctrine

- Could feel more like entering a premium wrestling management game.
- Continue state may not help the player recognize their current world.

### Player Decision This Screen Should Support

Continue the current save, start over, or reset the existing save.

### Priority Notes

- P1: Audit whether save identity preview is needed before any save-slot planning.

### Open Questions For Human Review

- Does the title screen feel aspirational enough?
- Does Continue need a save-card summary while still preserving single-save simplicity?

## `/setup/contract`

### Current Purpose

Frame the player as hired GM and begin the new career setup.

### Current Data Shown

- Contract/setup framing.
- National broadcast window premise.
- Accept The Job.
- Back.

### Missing Or Thin Data

- Ownership expectations are flavor-only.
- No explicit starting constraints beyond the broad 12-week premise.

### Current UI/UX Feel

Good setup fantasy, direct and low friction.

### UI/UX Gaps Against Doctrine

- Could eventually stage the "you are hired" moment with more sports-broadcast pressure.

### Human Audit Notes

- The "you are hired" framing is working and should be preserved.
- The current player-facing "12-week road" framing feels too short for the long-term GM fantasy.
- Internal season structure can remain 12-week seasons, but setup copy should not imply the whole career is one short challenge.
- Future contract/setup language should communicate that the player is being hired to run a brand over time, with a multi-season and eventually multi-year fantasy.
- This is a future copy/framing note only. It does not authorize setup flow, season structure, persistence, or gameplay changes.

### Player Decision This Screen Should Support

Commit to starting a new solo career or return to the title screen.

### Priority Notes

- P1: Reframe player-facing contract copy away from "one short road" and toward being hired to run a brand over time.
- P2: Audit whether the setup fantasy needs more stakes before content expansion.

### Open Questions For Human Review

- Does the contract step feel like a real GM job offer?
- Should this screen stay short to protect restart speed?

## `/setup/gm`

### Current Purpose

Set GM identity.

### Current Data Shown

- GM name input.
- GM style choices: Creative Visionary, Talent Developer, Ruthless Executive, Ratings Chaser.

### Missing Or Thin Data

- GM styles currently read as identity, but their gameplay meaning is not explained on-screen.
- No preview of how GM style affects the fantasy or decision posture.

### Current UI/UX Feel

Clear setup form with compact choices.

### UI/UX Gaps Against Doctrine

- Risks feeling like setup metadata unless styles have stronger character framing.

### Human Audit Notes

- GM name selection is working and should stay.
- The "Who runs the room?" framing is strong and should be preserved.
- GM identity should eventually include a few more characteristics beyond the current style choices.
- Each GM characteristic or style should eventually have a small info affordance, tooltip, or info panel explaining what it means.
- The explanation does not need to define exact mechanical effects yet.
- The UI should eventually clarify whether a GM choice is flavor-only, roleplay framing, or gameplay-relevant once that product decision is made.
- This is a future setup-framing note only. It does not authorize new GM systems, new persistence fields, or setup flow changes.

### Player Decision This Screen Should Support

Choose who the player wants to be as a GM.

### Priority Notes

- P1: Expand GM identity framing and add explanation affordances in a later implementation ticket.
- P1: Audit whether GM style should remain flavor-only or needs clearer expectation-setting later.

### Open Questions For Human Review

- Do the current GM styles create different fantasies?
- Is the player expecting mechanical effects from style names?

## `/setup/brand`

### Current Purpose

Set brand identity and tone.

### Current Data Shown

- Brand name input.
- Brand style choices: Prime Time Sports Entertainment, Underground Fight Club, Workrate Showcase, Reality Era Chaos.

### Missing Or Thin Data

- Brand styles do not show visual or gameplay implications.
- No example show tone, audience expectation, or brand pressure.

### Current UI/UX Feel

Easy to understand, but still form-like.

### UI/UX Gaps Against Doctrine

- Brand fantasy could carry more visual identity and atmosphere.

### Human Audit Notes

- The current "what does TV feel like?" / brand-style step does not feel like the right long-term setup fantasy.
- Future setup should shift toward entering a competitive GM universe before Draft Night.
- Desired future setup flow:
  1. Contract / You're Hired.
  2. Choose GM identity.
  3. Select rival GMs or other GMs in the universe.
  4. Select available brand.
  5. CPU rival GMs claim remaining brands.
  6. Enter Draft Night.
- Brand selection should feel like choosing the player's seat at the table, not only picking a TV style.
- Desired initial available brand fantasies for prototype planning are WWE Raw, WWE SmackDown, WWE NXT, and AEW.
- Those names describe prototype fantasy only. Any later public or release version may need fictionalized equivalents or another licensing-safe approach.
- Rival GMs should be selected or shown before the player chooses a brand.
- After the player chooses their brand, CPU rival GMs should pick or be assigned remaining brands.
- This future structure should make the world feel competitive before Draft Night.
- Future data/system needs would include rival GM identities, rival GM names, rival GM traits/styles, a brand pool, brand assignment logic, player brand vs CPU rival brands, and draft-night setup that reflects the chosen brand universe.
- This is a future direction note only. It does not authorize adding rival GM data, real brands, brand assignment logic, routing changes, setup screen changes, draft changes, or persistence changes.

### Player Decision This Screen Should Support

Choose what the player's wrestling product should feel like.

### Priority Notes

- P1: Reframe setup flow around entering a competitive GM universe before Draft Night.
- P2: Decide whether brand style remains as a sub-choice after brand selection.
- P1: Audit whether brand style needs better preview before any setup variant expansion.

### Open Questions For Human Review

- Do the style names clearly map to wrestling fantasies?
- Should brand style affect presentation, content pools, or only roleplay?

## `/setup/preview`

### Current Purpose

Confirm career configuration before draft night.

### Current Data Shown

- GM name and style.
- Brand style.
- Starting money.
- 12-week season.
- PLE timing in weeks 4, 8, and 12.

### Missing Or Thin Data

- No roster or title context yet.
- No clear "what this choice means next" beyond Week 1 and first PLE.

### Current UI/UX Feel

Functional checkpoint.

### UI/UX Gaps Against Doctrine

- Could feel more like a broadcast season launch package.

### Player Decision This Screen Should Support

Confirm setup and enter Draft Night.

### Priority Notes

- P2: Audit if preview should stay lean or become a stronger season-framing moment.

### Open Questions For Human Review

- Is this screen useful enough to keep as its own step?
- What must the player understand before drafting?

## `/setup/draft`

### Current Purpose

Build the starting 12-wrestler roster.

### Current Data Shown

- Available talent pool.
- Pick count.
- Drafted roster list.
- Wrestler stats: popularity, momentum, ring, promo, fatigue, morale.
- Undo Pick.
- Complete Draft when 12 picks are made.

### Missing Or Thin Data

- No roster composition guidance.
- No division, archetype, alignment, age, contract, or character role data.
- No draft tension from rival brands, pick grades, or scouting uncertainty.

### Current UI/UX Feel

Clear and playable. More utilitarian than dramatic.

### UI/UX Gaps Against Doctrine

- Draft night should feel like a sports broadcast plus GM war room.
- The current draft supports selection but not much fantasy or roster-building judgment.

### Player Decision This Screen Should Support

Choose a balanced, exciting starting roster.

### Priority Notes

- P1: Audit what minimum added data would make drafting more strategic without expanding the draft system yet.

### Open Questions For Human Review

- What information is missing when choosing between wrestlers?
- Does the 12-pick flow feel too long, too short, or about right?

## `/setup/review`

### Current Purpose

Summarize the drafted roster before Week 1.

### Current Data Shown

- Top Star.
- Best Talker.
- Best In-Ring.
- Highest Momentum.
- Drafted wrestler cards and stats.

### Missing Or Thin Data

- No roster weaknesses or title-scene implications.
- No locker-room identity summary.
- No suggested early booking pressure.

### Current UI/UX Feel

Useful recap with clear entry to Week 1.

### UI/UX Gaps Against Doctrine

- Could make the drafted roster feel more like a living locker room.

### Player Decision This Screen Should Support

Confirm the roster or go back to adjust picks.

### Priority Notes

- P1: Audit whether draft review should expose roster gaps before Week 1.

### Open Questions For Human Review

- What would make the player proud or worried about the roster?
- Is the review enough to inform Week 1 booking?

## `/dashboard`

### Current Purpose

Orient the player for the current week and point to the next action.

### Current Data Shown

- Brand, GM, GM style, brand style.
- Current show and road to PLE.
- Current card summary.
- Next action.
- Money, last show, average fatigue, top momentum.
- Roster pressure counts.
- Recovery notes.
- Finance spotlight.
- Calendar spotlight.
- Championship spotlight.
- Rivalry spotlight.
- Latest social buzz.
- Hot talent and at-risk talent.
- Locker room table.

### Missing Or Thin Data

- Some data is broad summary, not diagnosis.
- No explicit ownership objective list.
- Limited story of why current week matters beyond PLE distance.

### Current UI/UX Feel

Strong command-center overview. Dense but useful.

### UI/UX Gaps Against Doctrine

- Audit whether it feels curated or too much like a dashboard.
- Big weeks and PLE weeks may need stronger staging.

### Player Decision This Screen Should Support

Know what matters this week and decide where to act next.

### Priority Notes

- P1: Audit dashboard hierarchy across Week 1, go-home, PLE, post-show, and late-season states.

### Open Questions For Human Review

- What is the first thing the player notices?
- Is the next best action always obvious?
- Does the dashboard feel like sports franchise home base rather than SaaS?

## `global-nav`

### Current Purpose

Move between major in-game screens.

### Current Data Shown

- Dashboard.
- Booking.
- Roster.
- Championships.
- Rivalries.
- Calendar.
- Social.
- Finance.
- Results and Week Review after a show exists.

### Missing Or Thin Data

- No unread/attention indicators.
- No lock/availability explanation for Results and Week Review before any show.
- No route URLs because the app has no router.

### Current UI/UX Feel

Simple and reliable.

### UI/UX Gaps Against Doctrine

- Could feel more like a franchise-mode shell.
- Current state is clear, but urgency is not surfaced in nav.

### Player Decision This Screen Should Support

Move quickly to the area needed for the current GM decision.

### Priority Notes

- P2: Audit whether nav needs attention states after data expansion.

### Open Questions For Human Review

- Are Results and Week Review useful as persistent nav items after a show?
- Should nav show the current week status?

## `/booking`

### Current Purpose

Build and run the weekly TV or PLE card.

### Current Data Shown

- Current week, show name, show type, go-home/PLE framing.
- Segment limit.
- Valid segment count.
- Segment types: Match, Promo, Backstage Angle, Contract Signing, Open Challenge.
- Participants and availability.
- Momentum, fatigue, injury labels.
- Segment validation.
- Championship context/title match controls.
- Rivalry context controls.
- Open Challenge hidden opponent warning.

### Missing Or Thin Data

- Limited pacing, show-shape, or runtime summary beyond segment count.
- No card-level story balance or title/rivalry coverage summary.
- No explicit "who has not been used lately" in the booking surface.

### Current UI/UX Feel

Playable production card with good guardrails.

### UI/UX Gaps Against Doctrine

- Could feel more visual and tactile as a TV production rundown.
- Must avoid predicted fallout while still improving context.

### Player Decision This Screen Should Support

Choose who appears, what segment they appear in, and whether the card is ready to run.

### Priority Notes

- P1: Audit what decision context is needed without leaking simulated outcomes.

### Open Questions For Human Review

- Is the card easy to scan before running?
- Does each segment type feel meaningfully different while booking?
- What warnings are useful vs noisy?

## `/results`

### Current Purpose

Reveal show outcome immediately after Run Show.

### Current Data Shown

- Show score and grade.
- Broadcast recap.
- Best segment.
- Segment count and best type.
- Title fallout.
- Rivalry fallout.
- Injury fallout.
- Segment-by-segment scores, momentum, fatigue, recap notes, title notes, rivalry notes.

### Missing Or Thin Data

- Limited broadcast texture beyond text recap and score.
- Social and finance are mostly deferred to Week Review or dedicated screens.
- No highlight hierarchy for multiple major moments beyond listed sections.

### Current UI/UX Feel

Clear retrospective consequence screen.

### UI/UX Gaps Against Doctrine

- Big moments may need stronger presentation.
- Segment list can still read like a report if the card is long.

### Player Decision This Screen Should Support

Understand what happened before moving to Week Review.

### Priority Notes

- P1: Audit whether Results should separate broadcast recap from operational consequences more strongly.

### Open Questions For Human Review

- Does this feel like a broadcast recap?
- Are title changes, injuries, and Open Challenge reveals dramatic enough?

## `/week-review`

### Current Purpose

Connect the week's consequences before advancing the calendar.

### Current Data Shown

- Show score, best segment, best type, show name.
- Locker room fallout: morale, overuse, underuse, injuries, injury risk.
- Championship fallout and title history events.
- Rivalry fallout and rivalry history events.
- Social buzz preview.
- Finance fallout.
- Next week teaser.
- Advance Week or Season Review action.

### Missing Or Thin Data

- Limited recommendations or decision framing for next week.
- Fallout is comprehensive but can be text-heavy.
- No explicit "what changed since before the show" comparison beyond notes.

### Current UI/UX Feel

Strong loop completion screen with actual resolved fallout.

### UI/UX Gaps Against Doctrine

- Could better stage the office close/readout moment.
- Needs audit for whether it feels like a required pause or a satisfying review.

### Player Decision This Screen Should Support

Absorb consequences and decide to advance the week.

### Priority Notes

- P1: Audit whether Week Review is the right home for next-week planning prompts.

### Open Questions For Human Review

- Does the player understand why Advance Week is gated here?
- Which fallout categories feel most useful?

## `advance-week-flow`

### Current Purpose

Move from Week Review to the next dashboard or Season Review.

### Current Data Shown

- Action button on Week Review.
- New dashboard after week advance.
- Season Review after Week 12.

### Missing Or Thin Data

- Recovery and rivalry decay happen during advance, but the transition itself is not staged.
- No explicit interstitial summary of what changed during advance.

### Current UI/UX Feel

Fast and functional.

### UI/UX Gaps Against Doctrine

- Could make calendar movement feel more like a sports management week turn.

### Player Decision This Screen Should Support

Confirm readiness to leave the current week's fallout behind.

### Priority Notes

- P2: Audit whether a transition moment is needed or if Week Review already handles it.

### Open Questions For Human Review

- Is instant advance satisfying?
- Are recovery notes visible enough on the next Dashboard?

## `/roster`

### Current Purpose

Inspect the locker room and choose who needs attention.

### Current Data Shown

- Roster pressure summary.
- Sort by popularity, momentum, fatigue, morale.
- Filter by All, Hot, Tired, Frustrated.
- Wrestler cards with status, pressure tags, core stats, injury status, appearances, last booked, TV streak.
- Profile entry.

### Missing Or Thin Data

- No character archetype, role, alignment, style, or contract identity.
- Limited team/division/title-scene grouping.
- No comparison mode.

### Current UI/UX Feel

Readable living-locker-room list with useful pressure tags.

### UI/UX Gaps Against Doctrine

- Could feel more characterful and less stat-card-heavy.
- Needs audit for whether sort/filter controls support real booking decisions.

### Player Decision This Screen Should Support

Choose who to push, protect, rest, profile, or book next.

### Priority Notes

- P1: Audit roster data needs before adding any wrestler/content expansion.

### Open Questions For Human Review

- What is missing from a talent file?
- Does pressure state feel earned and legible?

## `/roster/profile/:wrestlerId`

### Current Purpose

Show detailed context for one wrestler.

### Current Data Shown

- Status, injury, pressure tags, championships.
- Stats and TV load.
- GM Read: usefulness, risk, need.
- Recent show history.
- Championship context and title history.
- Active rivalries and rivalry history.
- Recent social mentions.
- Back to Roster or Booking.

### Missing Or Thin Data

- No character bio, role, style, alignment, move set, contract, or relationship data.
- Recent history is functional but may be thin early in a career.
- No clear booking recommendation, by design.

### Current UI/UX Feel

One of the stronger decision-context screens.

### UI/UX Gaps Against Doctrine

- Could support character context more deeply without becoming spreadsheet clutter.
- Needs audit for whether GM Read feels flavorful enough.

### Player Decision This Screen Should Support

Decide how this wrestler should be used, protected, or developed.

### Priority Notes

- P1: Audit profile data gaps before expanding roster content.

### Open Questions For Human Review

- Does the profile make the wrestler feel like a person?
- Which fields would help booking without overloading the screen?

## `/championships`

### Current Purpose

Review title prestige, champions, contenders, reigns, defenses, and title history.

### Current Data Shown

- Each championship.
- Division.
- Prestige.
- Champion.
- Reign length.
- Defenses.
- Top contenders.
- Recent title history.

### Missing Or Thin Data

- No title identity, lineage depth, division rules, or contender rationale.
- No visual title prestige hierarchy beyond cards and metrics.
- No future title-scene planning area.

### Current UI/UX Feel

Clear and useful, somewhat functional.

### UI/UX Gaps Against Doctrine

- Championships should feel prestigious and more ceremonial.
- Title history could feel more like a living lineage.

### Player Decision This Screen Should Support

Understand title scenes and decide what championship stakes to book.

### Priority Notes

- P1: Audit title-scene data before adding titles/divisions/content.

### Open Questions For Human Review

- Do titles feel important enough?
- Are contenders believable?

## `/rivalries`

### Current Purpose

Create, inspect, and end active rivalries.

### Current Data Shown

- Rivalry creation form: Wrestler A, Wrestler B, stakes.
- Duplicate warning.
- Active rivalry cards.
- Participants, heat, freshness, weeks active, last advanced, stakes.
- PLE payoff state.
- Recent rivalry history.
- End Rivalry.

### Missing Or Thin Data

- No rivalry premise, tone, feud type, recent beat summary, or payoff target.
- Manual create/end controls are functional but not especially dramatic.
- No inactive or archived rivalry browser beyond history contexts.

### Current UI/UX Feel

Useful story-room management surface.

### UI/UX Gaps Against Doctrine

- Rivalries should feel elastic and alive; current data is mostly metrics and notes.
- Creation could feel more like booking a spark than filling a form.

### Player Decision This Screen Should Support

Choose which stories to start, maintain, cool, pay off, or end.

### Priority Notes

- P1: Audit rivalry data needs before adding new story content.

### Open Questions For Human Review

- Does heat/freshness explain the story clearly?
- What story data is needed without inventing offscreen events?

## `/calendar`

### Current Purpose

Show the 12-week season, current week, PLE path, completed results, and upcoming shows.

### Current Data Shown

- Current season and week.
- Road to PLE copy.
- Week list.
- Show names.
- TV/PLE labels.
- Go-home and season finale labels.
- Completed/current/upcoming state.
- Result scores and grades.

### Missing Or Thin Data

- No show objectives, rivalry/title beats planned for future weeks, or PLE card preview.
- Calendar is fixed and informational.
- No trend line of season momentum.

### Current UI/UX Feel

Clear schedule view.

### UI/UX Gaps Against Doctrine

- Could make PLE cycles feel more eventful.
- Current and major-event weeks may need stronger visual hierarchy.

### Player Decision This Screen Should Support

Understand timing, plan around PLE cycles, and know what kind of show is next.

### Priority Notes

- P2: Audit whether calendar needs more planning context before expanding season data.

### Open Questions For Human Review

- Does the road to PLE feel meaningful?
- Is fixed 12-week pacing clear and satisfying?

## `/social`

### Current Purpose

Show post-show IWC/social reaction based on resolved outcomes.

### Current Data Shown

- Feed filters: All, Fan Reaction, Dirt Sheets, Analyst Takes, Title Scene, Rivalries.
- Posts with season, week, show name, author, category, tone, text, related wrestlers.
- Empty state before shows.

### Missing Or Thin Data

- Limited post variety due to current content size.
- No trend, sentiment arc, or wrestler/rivalry-level social summary.
- No richer media/meme framing.

### Current UI/UX Feel

Appropriately retrospective and flavorful.

### UI/UX Gaps Against Doctrine

- Needs more living-world texture over time.
- Must avoid inventing gameplay truth separate from resolved outcomes.

### Player Decision This Screen Should Support

Read audience reaction and decide what stories/talent may need follow-up.

### Priority Notes

- P1: Audit social content categories before adding any new post pools.

### Open Questions For Human Review

- Which posts feel authentic vs generic?
- Does the feed help booking decisions or just provide flavor?

## `/finance`

### Current Purpose

Show current money, brand pressure, weekly reports, and season business history through a GM office pressure hierarchy.

### Current Data Shown

- Current money, pressure label, season profit/loss, and report count in a summary strip below nav.
- GM Office Pressure as the primary open read from current cash, latest close, season trend, business swing, and cost control.
- Talent Value Pressure as an expandable support panel with premium/high-cost, bargain/rising, and mapped-profile reads.
- Latest report as an expandable support panel with attendance, revenue, costs, profit/loss, ending money, show score, breakdowns, and notes.
- Season business reads as an expandable support panel for best revenue week and worst profit/loss.
- Finance history rows as an expandable support panel.

### Missing Or Thin Data

- Limited explanation of what drives revenue beyond report notes.
- No charts, trend views, budget goals, or ownership pressure track.
- No forward forecasts, which is intentional for current doctrine.

### Current UI/UX Feel

Clear, gamey GM office pressure surface with dense report details collapsed into support panels.

### UI/UX Gaps Against Doctrine

- Needs audit for whether financial stakes affect player choices enough.
- Expandable support panels reduce report-list weight, but the screen still depends on resolved report data rather than deeper business objectives.

### Player Decision This Screen Should Support

Understand business health and adjust booking priorities without seeing predicted outcomes.

### Priority Notes

- P1: Audit finance text/data needs before adding finance flavor or accounting complexity.

### Open Questions For Human Review

- Does finance feel meaningful without becoming complex accounting?
- What business pressure should be visible but not predictive?

## `/season-review`

### Current Purpose

Summarize the completed 12-week season and start the next season.

### Current Data Shown

- Starting money, final money, season profit/loss.
- Best show.
- Top momentum.
- Most fatigued.
- Best revenue.
- Worst profit/loss.
- Hottest rivalry, most eventful rivalry, PLE payoff.
- Season title story, biggest title change, most defended championship.
- Current champions, prestige, defenses, reign length.
- Start Next Season.

### Missing Or Thin Data

- No season awards, roster movement summary, brand reputation, or narrative recap beyond current metrics.
- No explicit next-season planning hook.
- No archive of prior season summaries beyond persisted state fields.

### Current UI/UX Feel

Useful capstone with strong loop closure.

### UI/UX Gaps Against Doctrine

- Season Review should feel like a major sports-franchise end-of-season package.
- Could better celebrate or dramatize the player's specific career story.

### Player Decision This Screen Should Support

Understand the season, absorb legacy, and decide to start the next season.

### Priority Notes

- P1: Audit what season-level data is needed before adding more content.

### Open Questions For Human Review

- Does Final Bell feel like a real finale?
- What should carry emotionally into the next season?

## `start-next-season-flow`

### Current Purpose

Reset season framing while carrying career state forward.

### Current Data Shown

- Start Next Season button on Season Review.
- Returns to Dashboard after starting next season.

### Missing Or Thin Data

- No offseason planning, roster reset, title reset, or explicit carryover summary.
- No confirmation or recap of what changes on next-season start.

### Current UI/UX Feel

Fast and simple.

### UI/UX Gaps Against Doctrine

- Could feel too abrupt for a franchise-mode season transition.

### Player Decision This Screen Should Support

Commit to continuing the career into another season.

### Priority Notes

- P2: Audit only after Season Review itself is reviewed.

### Open Questions For Human Review

- Should starting next season be instant?
- What carryover should the player understand before clicking?

## Audit Rollup

### Likely Data Audit Themes

- Wrestler identity beyond stats.
- Draft decision support.
- Roster role, style, and character context.
- Title lineage and contender rationale.
- Rivalry premise and story beat clarity.
- Social post variety tied only to resolved outcomes.
- Finance pressure that stays gamey and retrospective.
- Season-level legacy and recap data.

### Likely UI/UX Audit Themes

- Make major moments feel bigger: draft, PLEs, title changes, injuries, Season Review.
- Keep routine screens dense but not SaaS-like.
- Improve franchise-mode clarity without adding a router or new systems during planning.
- Preserve player agency and avoid predicted outcomes before Run Show.
- Keep the loop laptop-friendly and readable.

### Human Review Checklist

- Play a new career from Title through Draft Review.
- Book and run at least one TV card with a Match and Open Challenge.
- Review Results and Week Review before advancing.
- Visit every nav screen before and after a show exists.
- Reach or simulate a PLE week.
- Reach or simulate Season Review.
- For each screen, mark P0/P1/P2 gaps and defer implementation details to later tickets.
