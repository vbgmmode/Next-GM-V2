# Social Reaction System

Next GM social posts are post-show reactions generated from resolved simulation facts. The system is deterministic: the same `ShowResult` and `GameState` produce the same IWC feed.

## Where Reactions Are Generated

- `src/game/scoring.ts` resolves the show, finance, titles, rivalries, fatigue, morale, injuries, CPU pressure, and event ledger links.
- `src/game/social.ts` converts the resolved show into deterministic IWC posts.
- `src/game/aiCommentary.ts` can append optional external commentary when a configured endpoint or DeepSeek key exists. Those posts are still normalized into the same `SocialPost` shape.
- `src/social/socialReads.ts` builds read-only Social screen feed models, including IWC Pulse fan posts, superstar mood posts, trending topics, and Superstar Mail.

## IWC Pulse Surfaces

The Social screen separates three related surfaces:

- Fan/IWC feed: audience posts generated from resolved show facts and optional external commentary. These use `SocialPost` metadata and should feel like wrestling Twitter discourse.
- Superstars feed: wrestler-authored posts generated from current wrestler context. These are not forced back-and-forth reply chains. They should come from rivalry mood, title pressure, momentum, fatigue, morale, TV-time pressure, and post-show receipts.
- Superstar Mail: sparse direct asks from roster pressure. Mail is not a feed and not ambient flavor; it is a player-facing decision surface.
- Show Recap fallout reaction strip: a compact player-brand trending card built from `getPlayerBrandTrendingTopics()` in `src/social/socialReads.ts`, showing up to three resolved IWC topic lines for the player's brand only. This is a recap summary, not a cross-brand timeline feed.

Superstar posts should read like public mood/status posts. They can reference a rivalry, title, show, or pressure context, but they should not default to direct `@target` callouts or paired replies. A wrestler can post because a rivalry is heating up, because their title reign has pressure, because they are gaining momentum, because they are underused, or because a show result changed their week.

Avatar presentation is UI-only. IWC authors use exported social avatars, while superstar posts use existing wrestler portraits with Social-specific circular cropping. Avatar assignment must not change save data or reaction generation.

## Grounding Metadata

Every generated reaction should include:

- `persona`: the IWC behavior bucket.
- `sentiment`: positive, negative, mixed, or chaotic.
- `intensity`: 1-5.
- `triggerType`: the resolved simulation trigger.
- `target`: wrestler, team, title, rivalry, or show.
- `sourceResultId` and optional `sourceEventId`.
- `tags`: searchable reaction labels such as `burial`, `workrate`, `aura`, `continuity`, or `fantasy-booking`.

Legacy saves can omit these optional fields, but new deterministic posts should not.

## Supported Personas

- `agenda_pusher`: treats a favorite as underused, rising, or ready for a major push.
- `doomposter`: turns weak shows, workload, or cold beats into crisis posting.
- `fantasy_booker`: argues for alternate booking paths.
- `workrate_nerd`: focuses on match quality, chemistry, pacing, and star-rating discourse.
- `aura_poster`: reacts to presentation, crowd energy, and star presence.
- `burial_cop`: watches for clean losses, cooled momentum, and bad placement.
- `let_it_play_out_defender`: defends slow-burn stories.
- `let_it_play_out_skeptic`: calls out stories that are cooling or dragging.
- `dirt_sheet`: frames speculation as rumor-board talk inside the game world.
- `tribalist`: compares brands or rival desks without making the feed only about that.
- `continuity_nerd`: rewards callbacks, long-term story beats, and character consistency.
- `meme_account`: short dramatic posts for major moments.

## Supported Triggers

Current trigger metadata supports big wins, clean losses, upsets, squashes, title changes, title retentions, rivalry movement, rivalry stagnation, hot or dead crowds, high or low match quality, controversial finishes, repeated booking, underused or overpushed talent, workload concern, morale issues, show-quality swings, momentum swings, long-term callbacks, and market moves.

## Superstar Mail

Superstar Mail is separate from IWC feed generation. It is a sparse direct-ask surface from the roster, not a weekly activity feed.

Current behavior:

- Stable weeks can show zero active asks.
- Normal tense weeks should show one or two asks.
- Three asks should require unusually high pressure.
- Ask candidates come from firm or urgent roster pressure: injury/rest, overuse/protection, meaningful underuse, morale risk, stale title visibility, title-shot cases with current evidence, hot rivalries lacking recent representation, recent momentum push cases, or PLE relevance.
- The inbox should prefer ask-type variety before showing duplicates.

Player decisions:

- Accepting a request creates a tracked soft promise with a visible deadline and immediate small morale/trust lift.
- Declining a request closes it for the week and applies immediate small morale/trust fallout.
- Accepted requests can influence Generate Booking through existing Booking segment, title, and rivalry rules.
- Superstar Mail must not auto-book a card, reveal predicted fallout, reveal hidden Open Challenge opponents, or introduce special segment types unless a future accepted ticket explicitly asks for that.

Profile visibility:

- Immediate Superstar Mail decision effects should be reflected in the wrestler's current profile stats as soon as the decision is made.
- Wrestler profile week-change chips should show tracked stat movement from resolved show data and immediate office decisions.
- Static attributes such as Ring Skill and Promo Skill should show flat weekly movement unless a future accepted ticket adds progression.

## Superstar Feed Templates

Add superstar feed templates in `src/social/socialReads.ts`, not `src/game/social.ts`.

When adding a superstar post:

1. Use only current `GameState`, latest resolved `ShowResult`, roster pressure, title state, rivalry state, or wrestler stats already available to the UI.
2. Prefer standalone mood/status language over callouts.
3. Set a clear `contextLabel`, such as `Rivalry mood`, `Title pressure`, `Momentum mood`, `TV-time pressure`, or the resolved show name.
4. Keep `targetName` optional. Use it for context labels like a rivalry or title, not as a required opponent mention.
5. Add or update tests in `src/social/socialReads.test.ts`.

## Adding New Templates

Add new deterministic templates in `src/game/social.ts`.

When adding a post:

1. Use resolved data from `ShowResult` and `GameState`.
2. Do not invent offscreen facts.
3. Attach a persona, sentiment, intensity, trigger type, target, and tags.
4. Keep wording wrestling-specific and in-universe.
5. Add or update tests in `src/game/socialReactions.test.ts`.

## Guardrails

Posts can be dramatic, petty, and insider-ish, but they must not include slurs, protected-class insults, real-world harassment, unsafe threats, real private-life speculation, or defamatory claims. Rumor-style posts should clearly read as fan speculation about the resolved game state.

## Test Coverage

`src/game/socialReactions.test.ts` protects grounding for clean-loss backlash, workrate discourse, aura reactions, rivalry stagnation, long-term callbacks, determinism, and no orphan generated reactions.
