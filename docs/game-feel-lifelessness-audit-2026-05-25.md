# Next GM V2 Game-Feel And Lifelessness Audit

Date: 2026-05-25

Repository audited locally: `/Users/vbahmad/Documents/AI/Next GM V2 Sandbox`

Remote: `https://github.com/vbgmmode/Next-GM-V2`

Branch observed: `codex/save-latency-storage`

Scope: read-only audit. No code changes were made as part of the audit.

## A. Executive Diagnosis

Next GM is not lifeless because it lacks systems. The current repo already has a real deterministic simulation core: `src/game/scoring.ts` resolves show scores, winners, title changes, rivalry movement, morale, fatigue, injuries, finance, CPU rival shows, and social posts. `src/game/advanceWeek.ts` then carries state forward with fatigue recovery, rivalry cooling, momentum decay, CPU rival advancement, market movement, and office mandate pressure.

The current lifelessness risk is that the game often presents consequences as quiet reports instead of emotional receipts. The underlying state changes are more alive than the first impression communicates.

The main problem is mostly:

1. Emotional feedback and presentation staging.
2. Player agency clarity.
3. Content variety.
4. Simulation depth visibility.

It is less about "nothing happens" and more about "the game does not consistently make the player feel what happened because of their choices."

The most important missed opportunity is the post-show flow. The game calculates strong fallout beats through files like `src/screens/resultsScreenReads.ts`, `src/screens/weekReviewScreenReads.ts`, `src/game/social.ts`, and `src/game/scoring.ts`, but the rendered Results, Week Review, and Week 2 HQ surfaces do not consistently stage those beats as dramatic cause-and-effect.

The next best improvement is not a new simulation engine. It is a tighter fallout presentation layer that makes existing state feel like a wrestling game:

- top post-show headline
- biggest player-authored consequence
- top IWC take
- locker-room reaction
- rival brand comparison
- "what this means next week"

## B. Game-Feel Scorecard

### Meaningful Decisions: 6/10

Evidence:

- Draft Night has real tradeoffs through budget, roster targets, player picks, CPU claimed wrestlers, bundle discounts, role tiers, and rival draft pressure in `src/setup/NewGameSetupScreen.tsx`.
- Booking has meaningful choices around segment format, talent assignment, title/rivalry attachment, runtime, stipulations, manual winners, and run-show readiness in `src/booking/BookingScreen.tsx` and `src/booking/IntegratedSegmentComposer.tsx`.
- Market actions have tradeoffs around free agent signing, contract duration, renewals, releases, trades, rival snipes, and office mandate pressure in `src/screens/MarketScreen.tsx` and `src/game/market.ts`.
- Difficulty affects CPU draft quality, CPU weekly score pressure, market pressure, morale penalties, injury risk, and office pressure through `src/game/difficultyRules.ts`.

Why it scores 6:

The draft and booking loops create real choices. The player can harm future morale, fatigue, money, rivalries, and ratings. The issue is that some early choices still feel like identity setup rather than gameplay. GM identity and brand choice carry strong flavor but do not visibly change enough on later screens. Champion assignment and rivalry creation can feel like selecting values until the player books and runs a show.

What would raise it by 2-3 points:

- Add clear choice receipts after setup decisions.
- Make champion assignment feel like a prestige decision, not a data assignment.
- Make rivalry creation immediately stage a "creative spark" beat.
- Make Dashboard/HQ explain which previous choices are now creating pressure.
- Keep recommendations as staff input, not autopilot.

### Immediate Feedback: 6/10

Evidence:

- Draft selection updates roster, reserve, rival picks, and board availability immediately.
- Booking updates segment rail, selected segment composer, cost, runtime, warnings, and run-show CTA.
- Rivalry and championship screens update selected-object workspaces.
- Market actions are framed through selected talent workspaces and transaction feed.

Why it scores 6:

Immediate feedback exists, but it is mostly functional. The UI confirms state changes, but important actions do not consistently get a game-feel beat. Drafting a top star, assigning a champion, starting a rivalry, or signing a free agent should feel like the command center reacted.

What would raise it by 2-3 points:

- Add lower-third command receipts for major actions.
- Add sharp status changes after assign/start/sign/book actions.
- Add "office filed it," "story room lit up," "division has a center," and "rival desk reacted" microbeats.
- Avoid random animation; use state-change feedback only.

### Emotional Payoff: 5/10

Evidence:

- `src/game/scoring.ts` generates strong recap language for title changes, open challenges, rivalry heat, stale stories, overrun damage, injury fallout, and morale changes.
- `src/screens/resultsScreenReads.ts` builds headline and fallout beats.
- `src/game/social.ts` generates spicy resolved-state IWC and dirt-sheet posts.
- `src/screens/ResultsScreen.tsx` renders a Results hero, score plate, metrics, segment reel, selected segment card, winners, notes, and fallout lines.

Why it scores 5:

The emotional content exists, but the Results screen currently centers score, grade, metrics, and segment browsing. That reads more like a polished report than a payoff sequence. The top emotional consequence is not always the first thing the player sees. A title change, injury, hot rivalry, open challenge reveal, bad main event, or rival brand loss should land like a headline.

What would raise it by 2-3 points:

- Put `buildHeadlineBeat` and active `buildFalloutBeats` into the Results hero area.
- Make the first post-show screen answer: "What did the audience, locker room, office, and rival desks think?"
- Show the strongest IWC reaction alongside the broadcast recap.
- Add labels like "Breakout Clip," "Crowd Rejected It," "Champion Protected," "Locker Room Tense," and "Rival Brand Stole The Night."

### Wrestling Fantasy: 7/10

Evidence:

- Championships have prestige, champion control, contenders, title history, title booking, belt art, defenses, and title-scene reads.
- Rivalries have heat, freshness, structure, stakes, storyline IDs, on-clock logic, history, endings, and booking CTAs.
- Booking includes matches, promos, backstage angles, contract signings, open challenges, stipulations, titles, rivalries, and manual finishes.
- Roster includes morale, fatigue, injury status, momentum, audience heat, trust, TV time, affiliations, value profiles, and selected superstar reads.
- Social/IWC reacts to resolved outcomes.

Why it scores 7:

The game has the right wrestling ingredients. It already understands champions, egos, fatigue, fan discourse, rivalries, and show structure. The fantasy weakens when screens drift into metric/report language or when major wrestling moments are not treated as major moments.

What would raise it by 2-3 points:

- Add prestige staging around belts and title changes.
- Make fan backlash and crowd rejection louder.
- Make unhappy talent feel personal.
- Make rival brand pressure feel like a weekly war, not just a table.
- Make Week 2 HQ open with last week's fallout.

### Week-To-Week Consequences: 7/10

Evidence:

- `src/game/scoring.ts` updates wrestler momentum, fatigue, morale, audience heat, trust, records, injuries, title stats, rivalries, finance reports, CPU results, and social posts.
- `src/game/advanceWeek.ts` recovers injuries, clears current show, decays fatigue, decays momentum, cools rivalries, advances CPU rivals, advances market state, and evaluates office mandate.
- `src/game/showResolutionCommit.ts` persists result, finance, event ledger, title history, rivalry history, and show history together.

Why it scores 7:

State compounds. The problem is discoverability. The player may not feel that the next decision is different because last week happened. HQ has alerts and deltas, but the dominant emotional framing should be: "Here is the fallout you are managing now."

What would raise it by 2-3 points:

- Add a Week 2 HQ fallout module.
- Promote last-show cause-and-effect above generic metrics.
- Show wrestler-specific and rivalry-specific deltas next to next actions.
- Add "because of last week" phrasing to Dashboard/HQ, Week Review, Roster, Rivalries, and Championships.

### UI / Game Juice: 5/10

Evidence:

- The repo has a strong visual doctrine in `DESIGN.md` and `docs/ui-broadcast-command-center-style.md`.
- The app uses sharp command-center shells and selected workspaces in Dashboard, Booking, Championships, Rivalries, Roster, Market, Results, and Week Review.
- Major actions have standard button feedback and state changes.

Why it scores 5:

The layout and visual direction are substantially better than generic SaaS, but game feel is about the action moment. The current UI has limited reveal sequencing, status pulses, transition beats, alert hierarchy, or sound-ready hooks. A lot of important content sits in static panels.

What would raise it by 2-3 points:

- Add purposeful reveal states for Results and Week Review.
- Add command-log style receipts for major actions.
- Add stronger badges and headlines for state changes.
- Make major moments visually dominant for one beat, then let repeat-use screens stay dense.
- Keep the aesthetic dark, sharp, tactical, and broadcast-led.

### Character / Talent Drama: 6/10

Evidence:

- `src/social/SocialTrendsPanel.tsx` surfaces Superstar Mail.
- `src/game/socialInboxActions.ts` supports rest and TV-time requests, accepted promises, fulfilled or broken states, and morale effects.
- `src/game/scoring.ts` records morale boosts, morale drops, overuse warnings, underuse warnings, injury notes, and title stat notes.
- `src/roster/LockerRoomPulsePanel.tsx` shows morale trend and backstage notes.

Why it scores 6:

Talent drama exists, but it is not yet central enough to the main loop. The player can satisfy or break asks, but the emotional consequence is not staged as strongly as it should be.

What would raise it by 2-3 points:

- Surface fulfilled/broken promises in Results and Week Review.
- Add talent-specific "wants TV," "needs protection," "room is tense," and "bought in" statuses.
- Put top talent drama into HQ alerts.
- Keep it deterministic and grounded in existing roster state.

### Rival Brand Pressure: 6/10

Evidence:

- `src/game/cpuRivalLoop.ts` simulates CPU rosters, CPU titles, CPU rivalries, CPU fatigue, injuries, finance, weekly results, ratings battle, and CPU result feed.
- `src/screens/weekReviewScreenReads.ts` exposes ratings battle snapshots.
- `src/game/social.ts` generates ratings desk posts when rival results exist.

Why it scores 6:

The system is present, but the pressure is usually summarized. Rival brands should feel like visible opponents in the weekly war. If a rival beats the player's score, the game should make the player feel it.

What would raise it by 2-3 points:

- Add "You won the night" or "Rival stole momentum" headline.
- Show closest rival, score gap, and trend after every show.
- Add IWC posts that compare the player brand to the rival brand.
- Add HQ pressure when player rank slips.

### Replayability: 5/10

Evidence:

- `src/game/social.ts` uses deterministic line picking through `hashString` and `pickLine`.
- Draft mode, difficulty, budget, rival GMs, CPU drafts, roster composition, booking choices, and market state create replay variation.

Why it scores 5:

The systems can produce varied outcomes, but the player-facing copy and event types risk repetition. After 2-3 weeks, repeated categories like best segment, weakest segment, fatigue concern, and generic analyst takes may start to feel predictable.

What would raise it by 2-3 points:

- Expand resolved-state copy pools.
- Add more event archetypes: breakout night, crowd turns, champion absence, stale feud backlash, surprise answer, bad chemistry, workhorse resentment, protected rest praised.
- Add negative and positive variants tied to actual thresholds.
- Do not add random flavor disconnected from state.

### First 20-Minute Hook: 6/10

Evidence:

- Setup has a "You're Hired" contract frame.
- Draft Night is staged as a war room with board, selected prospect, budget, rival brands, roster needs, and pick flow.
- Week 1 Dashboard, Booking, Results, and Week Review are playable.

Why it scores 6:

Draft Night is the strongest first-session game moment. The setup is atmospheric. The weak spots are champion/rivalry setup feeling like admin, Week 1 booking needing more pressure, and the first Show Recap not yet feeling like a huge payoff.

What would raise it by 2-3 points:

- Make the first Draft pick feel like a franchise moment.
- Make first champion assignment feel ceremonial.
- Make first rivalry start feel like a creative spark.
- Make first Results screen deliver a headline and top fan reaction immediately.
- Make Week 2 HQ say exactly why the player should keep going.

## C. Lifelessness Hotspots

### 1. Results Top Package

Files:

- `src/screens/ResultsScreen.tsx`
- `src/screens/resultsScreenReads.ts`
- `src/game/scoring.ts`
- `src/game/social.ts`

What the player currently experiences:

The player sees score, grade, show name, finance metric, peak segment, runtime, segment reel, and a focused segment card. Segment cards include winners, title notes, rivalry notes, recap notes, and momentum/fatigue lines.

Why it feels flat:

The screen is structured like a broadcast report, but the most emotional consequence is not always staged as the headline. The game already knows whether a title changed, someone got hurt, a rivalry heated up, a rivalry went stale, an open challenge revealed someone, or the main event bombed. Those should be payoff moments.

Missing beat:

"Tonight changed the company because..."

Recommendation:

Render the `buildHeadlineBeat` and active `buildFalloutBeats` output prominently in Results. The segment reel should still exist, but after the headline consequence lands.

### 2. Week Review Handoff

Files:

- `src/screens/WeekReviewScreen.tsx`
- `src/screens/weekReviewScreenReads.ts`

What the player currently experiences:

The player sees a score strip, finance metrics, next show, next PLE, peak segment, GM handoff cards, roster fallout rows, and ratings battle rows.

Why it feels flat:

Week Review is supposed to close the loop emotionally before Advance Week. It contains the right data, but the rendered hierarchy is still closer to an office summary than a consequence scene.

Missing beat:

"Here is what you must manage next week because of what happened."

Recommendation:

Add a compact "Fallout Command" section with:

- top headline fallout
- top locker-room reaction
- top IWC/social reaction
- rival brand result gap
- next action pressure

### 3. Week 2 HQ / Dashboard

Files:

- `src/App.tsx`
- `src/game/dashboardViewModel.ts`

What the player currently experiences:

Dashboard shows brand status, champions, GM goals, roster overview, current show card, rivalries, metrics, alerts, and free agents.

Why it feels flat:

After advancing, the player should feel "last week is now haunting or helping me." Current alerts can be generic: medical count, finance desk, scout report, card runnable, weekly pressure. These are useful but do not always dramatize last week's consequences.

Missing beat:

"Fallout From Last Week."

Recommendation:

Prioritize a fallout read when a latest result exists:

- breakout performer
- fatigue concern
- locker-room mood
- rivalry/title movement
- IWC argument
- rival brand score gap

### 4. GM Identity Selection

Files:

- `src/setup/NewGameSetupScreen.tsx`
- `src/game/gmPersonas.ts`

What the player currently experiences:

The player selects a named GM persona with strong flavor copy.

Why it feels flat:

The flavor is good, but the player may not see how the identity matters after setup. It can read as character select rather than strategic identity.

Missing beat:

"This GM identity changes how the office frames success."

Recommendation:

Without adding mechanics first, show identity receipts later:

- "Locker Room General: morale pressure is your board lens."
- "Ratings Chaser: show score and rival standing are your weekly headline."
- "Talent Developer: breakout and underused talent reads are elevated."

### 5. Brand Selection

Files:

- `src/setup/NewGameSetupScreen.tsx`
- `src/game/brandChairs.ts`
- `src/game/titleCatalog.ts`

What the player currently experiences:

The player chooses Raw, SmackDown, NXT, or AEW. The choice affects theme, brand identity, title catalog, and rival assignments.

Why it feels flat:

Brand copy is strong, but brand choice does not yet feel like a season promise or strategic burden. The fantasy of running a specific wrestling product needs more ongoing visibility.

Missing beat:

"This brand expects a certain kind of TV."

Recommendation:

Add read-only brand identity pressure:

- Raw: spectacle and mainstream pressure
- SmackDown: star-power polish
- NXT: breakout development
- AEW: workrate and fan buzz

Keep it advisory unless a later ticket adds mechanics.

### 6. Champion Assignment

Files:

- `src/App.tsx`
- `src/game/championshipMutations.ts`
- `src/game/championshipPrestigeReads.ts`

What the player currently experiences:

The player assigns or revokes champions, manages contender lanes, sees belt rail, champion control, title history, and prestige.

Why it feels flat:

Assigning a champion is one of the biggest wrestling GM fantasy moments. In the current UI, it can feel like selecting a name from a list.

Missing beat:

"The division now revolves around this champion."

Recommendation:

After assignment, show a title-office receipt:

- "New center of gravity"
- "Vacant belt sealed"
- "Contender lane now chasing X"
- "Champion protected / champion exposed"

### 7. Rivalry Creation

Files:

- `src/screens/RivalriesScreen.tsx`
- `src/screens/rivalriesScreenReads.ts`
- `src/game/rivalryMutations.ts`

What the player currently experiences:

The player chooses structure, participants, stakes, storyline, and starts a rivalry. Existing rivalries have heat, freshness, stage, history, and booking CTA.

Why it feels flat:

Rivalry creation is a creative spark moment. The current flow is clear, but it still has form energy: selects, options, start button.

Missing beat:

"Creative just found the argument."

Recommendation:

After creation, show a story-room receipt:

- rivalry name
- stakes
- first expected beat
- heat/freshness starting read
- "Book the first beat" CTA

### 8. Booking Warnings

Files:

- `src/booking/BookingScreen.tsx`
- `src/booking/buildBookingModel.ts`
- `src/booking/bookingUtils.ts`

What the player currently experiences:

The player sees readiness, runtime, invalid segments, unbooked talent, off-card rivalries, risk rows, costs, and producer notes.

Why it feels flat:

The warnings are useful, but their language often reads operational rather than emotional. Booking should feel like a tense production desk.

Missing beat:

"This card has pressure."

Recommendation:

Rename or frame warnings as:

- Production Alert
- Locker Room Risk
- Story Heat Missing
- Champion Off TV
- Main Event Thin
- Red-Line Workload

Keep pre-show no-spoiler rules intact.

### 9. Social / IWC Isolation

Files:

- `src/social/SocialScreen.tsx`
- `src/social/SocialPostCard.tsx`
- `src/social/socialReads.ts`
- `src/game/social.ts`

What the player currently experiences:

Social has a feed with fan posts, superstar posts, category labels, engagement counts, and Superstar Mail.

Why it feels flat:

The feed itself is lively, but it is a separate destination. Results and HQ should pull the top fan reaction into the main loop.

Missing beat:

"The internet is already yelling about your booking."

Recommendation:

Surface one top social post or IWC summary on:

- Results
- Week Review
- Dashboard/HQ

Do not add pre-show buzz that predicts outcomes.

### 10. Roster Pulse

Files:

- `src/roster/RosterScreen.tsx`
- `src/roster/LockerRoomPulsePanel.tsx`
- `src/roster/lockerRoomPulseReads.ts`
- `src/game/rosterContextReads.ts`

What the player currently experiences:

Roster shows filters, sort, selected wrestler strip, locker room pulse, morale trend, injury report, quick reads, and profile access.

Why it feels flat:

The roster has useful condition data, but the human drama is still too quiet. The player needs to feel egos, trust, pressure, and resentment.

Missing beat:

"This person is becoming a problem or a star."

Recommendation:

Add stronger labels:

- Locker room tense
- Bought in
- Waiting for TV
- Worked too hard
- Needs protection
- Breakout watch
- Creative silence

Ground these in existing morale, fatigue, momentum, TV-time, trust, and injury state.

## D. Missing Reaction Matrix

| Player Action | Current Reaction | Missing Reaction | Suggested New Reaction | Systems Affected |
|---|---|---|---|---|
| Drafting a top star | Added to roster, budget changes, CPU board advances | Franchise pick moment | Draft lower-third: "Face of the brand candidate signed" | Setup/Draft, Roster, Dashboard |
| Drafting too many expensive stars | Reserve drops, affordability blocks later picks | Office and strategic pressure | "War chest thinning" alert and Draft Review pressure read | Draft, Finance, Dashboard |
| Leaving budget too low | Starting money persists | Ownership anxiety | Week 1 HQ finance warning: "Ownership is watching cash after Draft Night" | Dashboard, Finance, Market |
| Assigning champions | Champion IDs update | Prestige ceremony | "Division now has a center: X carries the belt" | Championships, Dashboard, Booking |
| Creating a rivalry | Rivalry added and history event logged | Creative spark | "Story room lights up: X vs Y has stakes" | Rivalries, Booking, Week Review |
| Booking tired talent | Pre-show risk, post-show fatigue, morale/injury fallout | Regret and talent trust pressure | Results headline: "X worked through red-line fatigue" | Booking, Results, Roster, Social |
| Not booking a champion | Title scene pressure can be derived | Fan/office concern | HQ alert: "Champion absent from TV" | Championships, Dashboard, Booking |
| Running a weak main event | Low segment score and show grade | Shame, fan rejection | IWC top post: "What was the plan here?" | Results, Social, Dashboard |
| Overusing the same wrestler | Fatigue/morale/trust effects | Talent resentment | Superstar Mail: "I need protection" | Roster, Social, Booking |
| Booking a hot rivalry well | Rivalry heat/freshness move | Pride and fan argument | "Feud became the argument of the week" badge | Results, Rivalries, Social |
| Having a bad show | Grade and metrics | Office pressure, fan backlash, rival comparison | Results package: "Crowd cooled, rival gained ground" | Results, Finance, CPU, Social |
| Having a breakout match | Momentum gain and social post | Star-making hook | HQ alert: "Breakout clip: X is trending" | Results, Dashboard, Roster, Social |
| Rival brand outperforming player | Ratings table and social analyst post | Competitive sting | "Rival stole the night by +7" headline | CPU, Week Review, Dashboard, Social |
| Open Challenge reveal | Opponent resolves at run-show time | Surprise staging | Reveal card: "X answered the call" | Booking, Results, Social |
| Broken talent promise | Morale penalty and note | Personal drama | Superstar Mail reply: "Promise broken" | Social, Roster, Week Review |
| Successful title defense | Defense count/history note | Champion aura | "Champion protected: belt got harder to reach" | Championships, Results, Social |
| Rivalry goes stale | Rivalry history note | Creative regret | "Fans are done waiting" alert | Rivalries, Dashboard, Social |

## E. Make It Feel Like A Game Roadmap

### Phase 1: No New Simulation Engine

Goal:

Make existing state feel alive before adding mechanics.

Best first files to inspect/edit:

- `src/screens/ResultsScreen.tsx`
- `src/screens/resultsScreenReads.ts`
- `src/screens/WeekReviewScreen.tsx`
- `src/screens/weekReviewScreenReads.ts`
- `src/game/dashboardViewModel.ts`
- `src/social/socialReads.ts`
- `src/game/social.ts`
- `src/screens/ResultsScreen.css`
- `src/screens/WeekReviewScreen.css`
- `src/styles.dashboard-dynasty.css`

Recommended improvements:

- Put top headline fallout into Results.
- Add active fallout beat cards.
- Pull top IWC/social reaction into Results and Week Review.
- Add Week 2 HQ "Fallout From Last Week."
- Rename generic warning/report labels into wrestling command-center pressure labels.
- Add deterministic copy variation through existing `hashString` and `pickLine` patterns.
- Add stronger status labels without adding new saved state.

Risk tier:

Low to medium. Most work can be read-model and render/CSS only.

Suggested validation:

- `npm exec tsc -- --noEmit`
- `npm run build`
- Manual smoke: New Game or existing save, Booking with at least two valid segments, Run Show, Results, Week Review, Advance Week, Dashboard/HQ.
- Check Social and Roster for fallout consistency if those surfaces are touched.

What not to touch yet:

- Scoring math.
- Save migration.
- localStorage format.
- AI commentary.
- Backend/network.
- New random event engine.
- New persistent state fields.

### Phase 2: Light Simulation Depth

Goal:

Add small compounding emotional systems after the existing fallout presentation is working.

Best first files to inspect/edit:

- `src/game/socialInboxActions.ts`
- `src/game/rivalryMutations.ts`
- `src/game/championshipPrestigeReads.ts`
- `src/game/gameContextReads.ts`
- `src/game/rosterContextReads.ts`
- `src/game/storyContextReads.ts`
- `src/screens/rivalriesScreenReads.ts`
- `src/roster/lockerRoomPulseReads.ts`

Potential additions:

- Talent mood events from existing morale/fatigue/trust.
- Rivalry momentum labels.
- Crowd sentiment categories.
- Champion aura/prestige reads.
- Brand identity modifiers as read-only pressure first.
- Rival GM reactions from CPU result deltas.
- Weekly narrative hooks based on resolved state.

Risk tier:

Medium. New read models are safe; new persisted mechanics need more care.

Suggested validation:

- Unit tests for read-model thresholds.
- Multi-week deterministic smoke.
- Save compatibility tests if any new fields are persisted.
- Manual smoke across Results, Week Review, Dashboard, Social, Roster, Rivalries, Championships.

What not to touch yet:

- Full rival HQ screens.
- Editable CPU booking.
- Progression locks.
- Firing/fail states.
- Complex random scandal/event systems.
- Database/backend.

### Phase 3: Deeper Compounding Systems

Goal:

Add long-term management drama after the presentation layer and light reads prove useful.

Best first files to inspect/edit:

- New bounded modules under `src/game/`.
- Existing systems: `market.ts`, `advanceWeek.ts`, `scoring.ts`, `socialInboxActions.ts`, `rivalryMutations.ts`, `championshipMutations.ts`.
- Avoid growing `src/App.tsx` further unless extracting UI first.

Potential additions:

- Locker-room factions.
- Promises and creative commitments.
- Talent ambition.
- Audience segment preferences.
- Creative fatigue.
- Long-term star arcs.
- Scouting and free-agency drama.
- Injury and scandal fallout.
- Negotiation tension.

Risk tier:

High. These systems can affect saves, balance, and the playable loop.

Suggested validation:

- Migration tests.
- Long-season smoke.
- Balance tests.
- Determinism checks.
- First-20-minutes replay check.

What not to touch yet:

- Backend services.
- Cloud sync.
- Auth.
- Multiplayer.
- GenAI.
- Full CPU segment-by-segment editors.
- Career-ending fail states.

## F. Concrete Sample Improvements

### 1. Flat Recap Text To Dramatic Recap Headline

Before:

> Raw posted a controlled 78 (C) in Week 1.

After:

> Week 1 Receipt: Raw survived the night, but the main event did not leave the room convinced.

Why:

The after version gives the same information but frames it as a wrestling consequence.

### 2. Generic Morale Number To Talent-Specific Reaction

Before:

> Morale -4.

After:

> Locker Room Tense: Rhea lost trust after being pushed through heavy fatigue for the second straight week.

Why:

The player understands who is upset, why, and what decision caused it.

### 3. Static Warning To Booking-Room Pressure Alert

Before:

> 3 roster members not on tonight's card.

After:

> Creative Silence: 3 signed wrestlers have no TV this week. If the pattern holds, the room will start reading it as a verdict.

Why:

The warning becomes a GM pressure beat without predicting exact hidden outcomes.

### 4. Basic IWC Post To Spicy Resolved Reaction

Before:

> Fans liked the match.

After:

> @ClipMachine: Bianca is the one everyone is clipping tonight. One loud post-show beat is how fan campaigns start getting annoying.

Why:

The after version feels like internet discourse and is tied to a resolved breakout.

### 5. Plain Week 2 Dashboard To Fallout Command Center

Before:

> Show Rating 79. Budget $1.4M. Book Show.

After:

> Fallout From Last Week: Bianca broke out, Seth ate the workload, SmackDown beat you by 6, and the title scene needs a visible champion.

Why:

The after version gives the player a reason to continue.

### 6. Champion Assignment To Prestige Receipt

Before:

> Champion: Cody Rhodes.

After:

> Gold Sealed: Cody Rhodes is now the center of the World Title scene. Every challenger lane runs through him.

Why:

Assigning a title becomes a major wrestling act.

### 7. Rivalry Creation To Creative Spark

Before:

> Rivalry started with personal stakes.

After:

> Story Room Lit: Punk vs Rollins has a personal issue on the board. Book the first beat before the crowd cools on the argument.

Why:

The player gets a creative hook and next action.

### 8. Weak Main Event To Fan Backlash

Before:

> Main event score: 55.

After:

> Crowd Rejected The Close: The final block landed at 55, and the IWC is already asking why it closed the show.

Why:

The player feels regret, not just a number.

### 9. Rival Brand Outperformance To Competitive Pressure

Before:

> SmackDown: 84. Raw: 76.

After:

> Rival Desk Won The Night: SmackDown beat your show by 8. The ratings argument is no longer theoretical.

Why:

The rival system becomes emotional pressure.

### 10. Open Challenge Reveal To Surprise Moment

Before:

> Open Challenge opponent: LA Knight.

After:

> The Curtain Hit: LA Knight answered the Open Challenge, turning a risk slot into the loudest surprise of the night.

Why:

The reveal becomes a wrestling moment.

## G. Implementation Recommendation

Do not build a new simulation engine first. The smallest high-impact slice should make the current deterministic simulation feel more alive.

Recommended first slice:

Show Recap plus Week Review plus Week 2 HQ fallout staging.

Scope:

- Use existing `ShowResult`, `FinanceReport`, social posts, locker-room fallout, title history, rivalry history, and CPU ratings data.
- Promote the top emotional consequence in Results.
- Carry the top consequence into Week Review.
- Make Dashboard/HQ show "Fallout From Last Week" after a result exists.
- Keep all consequences retrospective and tied to resolved events.
- Preserve deterministic behavior.

Guardrails:

- Do not add GenAI.
- Do not add backend/network calls.
- Do not change localStorage persistence.
- Do not change save migration.
- Do not change scoring formulas.
- Do not change AI commentary.
- Do not introduce generic SaaS UI.
- Do not add a new full system until the current fallout layer is staged properly.

Likely files:

- `src/screens/ResultsScreen.tsx`
- `src/screens/resultsScreenReads.ts`
- `src/screens/ResultsScreen.css`
- `src/screens/WeekReviewScreen.tsx`
- `src/screens/weekReviewScreenReads.ts`
- `src/screens/WeekReviewScreen.css`
- `src/game/dashboardViewModel.ts`
- `src/styles.dashboard-dynasty.css`

Acceptance criteria:

- Results clearly shows the top headline fallout before the player drills into segment detail.
- Week Review clearly summarizes what changed and what the player should care about next.
- Dashboard/HQ after a completed week leads with last week's fallout, not only generic metrics.
- Social/IWC top reaction is visible in the main weekly loop.
- No pre-show prediction leaks are introduced.
- TypeScript and build pass.

Recommended verification:

- `npm exec tsc -- --noEmit`
- `npm run build`
- Manual smoke: Run Show to Results to Week Review to Advance Week to Dashboard.
- Inspect Results, Week Review, Dashboard, Social, Roster, Rivalries, Championships for copy consistency if touched.

## Audit Notes

This audit did not run visual browser QA or tests. It is grounded in current repo files and code paths only.

Relevant inspected areas:

- `DESIGN.md`
- `docs/ui-broadcast-command-center-style.md`
- `src/App.tsx`
- `src/setup/NewGameSetupScreen.tsx`
- `src/booking/BookingScreen.tsx`
- `src/booking/buildBookingModel.ts`
- `src/booking/IntegratedSegmentComposer.tsx`
- `src/screens/ResultsScreen.tsx`
- `src/screens/resultsScreenReads.ts`
- `src/screens/WeekReviewScreen.tsx`
- `src/screens/weekReviewScreenReads.ts`
- `src/screens/RivalriesScreen.tsx`
- `src/screens/MarketScreen.tsx`
- `src/roster/RosterScreen.tsx`
- `src/roster/LockerRoomPulsePanel.tsx`
- `src/social/SocialScreen.tsx`
- `src/social/SocialPostCard.tsx`
- `src/social/SocialTrendsPanel.tsx`
- `src/social/socialReads.ts`
- `src/game/scoring.ts`
- `src/game/showResolutionCommit.ts`
- `src/game/advanceWeek.ts`
- `src/game/social.ts`
- `src/game/socialInboxActions.ts`
- `src/game/cpuRivalLoop.ts`
- `src/game/dashboardViewModel.ts`
- `src/game/difficultyRules.ts`
- `src/game/openingDraft.ts`
- `src/game/seed.ts`
