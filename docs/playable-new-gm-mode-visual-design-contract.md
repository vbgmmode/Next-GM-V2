# Playable New GM Mode Visual Design Contract

## Purpose

This document is the visual contract for player-facing Next GM UI work.

Use it with `docs/ui-ux-doctrine.md`, `docs/ui-broadcast-command-center-style.md`, and the repo-owned UI tokens/templates. It translates the product fantasy into implementation expectations.

New player-facing UI and any materially redesigned screen should move toward this contract. Existing screens do not need to be fully rewritten unless the active ticket explicitly scopes that work.

## Visual Target

Next GM should look like a premium wrestling broadcast command center: dark arena atmosphere, sports-management density, sharp tactical panels, controlled glow, gold prestige, red heat, and console-franchise clarity.

The UI should feel built for repeat weekly play, not like a marketing page, web dashboard, admin panel, or spreadsheet skin.

## Required Screen Shape

Major gameplay screens should use a clear command-center structure:

- Top HUD for brand, GM, week, season, money, mode, and urgent status.
- Primary stage for the main decision or narrative beat.
- Selected-object workspace for the current wrestler, segment, title, rivalry, show, report, or draft target.
- Side rail for lists, filters, tools, queues, summaries, or pressure context.
- Tactical grid for cards, rows, reports, feeds, or metrics.
- Lower-third or bottom action area when the screen needs selected context or a primary command.
- Contained scrolling for long lists, feeds, draft boards, reports, and history where practical.

Full-page scrolling on primary gameplay screens is a design failure unless a ticket explicitly allows it.

## Booking-Specific Expectation

Booking should not behave like one crowded form page.

The card/rundown should remain visible as the player builds the show. Detailed setup for a match, promo, title context, rivalry context, or segment participants should happen in a focused workspace, drawer, modal, or sub-screen that preserves orientation and returns cleanly to the card.

The player should feel like they are assembling a live television card, not filling out one giant form. The active show should remain legible at all times: what is already booked, what is missing, what is blocked, what is selected, and what action is next.

## Visual Rules

Use:

- Dark charcoal and near-black surfaces.
- Sharp rectangular panels with 0-8px radius.
- Thin borders, inner strokes, and restrained glow.
- Condensed sports typography for screen names, show names, wrestler names, titles, CTAs, and major values.
- Readable UI typography for controls, tables, metadata, warnings, reports, and feed text.
- Gold for championships, prestige, money, winners, rank, and star value.
- Red for heat, urgency, active focus, danger, blocked state, severe risk, and rivalry intensity.
- Green for healthy, ready, recovery, positive trend, morale gain, and profit.
- Yellow/orange for caution, fatigue, morale risk, incomplete card, and operational warning.
- Muted blue/cyan for neutral context, scouting, and system readouts.

Avoid:

- Bubbly cards.
- Large rounded pill overload.
- Generic SaaS dashboards.
- Empty equal-weight card walls.
- Decorative blobs, orbs, and random gradients.
- Emoji HUD icons.
- Placeholder art treated as final art.
- Red as full-screen wallpaper.
- Text overflow, clipped labels, hidden controls, or unreadable dense rows.

## Layout And Scrolling Rules

Primary gameplay screens should be built around orientation and decision speed.

The player should not need to scroll through a long page to understand the main state of the screen, find the current object, or locate the next action.

Use contained scrolling for:

- Roster lists.
- Draft boards.
- Social feeds.
- Finance reports.
- Segment queues.
- Matchup candidate lists.
- Rivalry histories.
- Championship histories.
- Long tactical grids.

Avoid full-page scrolling for:

- Booking.
- Dashboard.
- Draft Night.
- Results, unless the top recap and primary next action remain visible before detailed fallout continues below.
- Week Review.
- Championships.
- Rivalries.
- Finance.
- Any screen where the main decision should remain visible while details change.

If a constrained laptop viewport requires scrolling, critical actions and selected context must remain easy to find and must not be clipped, hidden, or pushed below unrelated content.

## Interaction Contract

Every major screen must make the next player action obvious.

Every important action should produce visible feedback: selected state, panel update, status pulse, lower-third change, feed item, reveal beat, or consequence panel.

Drag-and-drop may enhance a flow, but it must not be the only way to complete core gameplay.

Player agency must stay visible. The interface may recommend, warn, summarize, compare, and contextualize, but it should not quietly take creative control away from the player.

## Feedback And State Rules

Important UI states should be visually distinct:

- Selected.
- Hover/focus.
- Disabled.
- Blocked.
- Valid.
- Incomplete.
- Warning.
- Dangerous.
- Ready.
- Resolved.
- Recently changed.

Status feedback should use both color and text/shape when practical. Do not rely on color alone for warnings, errors, blocked states, or readiness.

Controls should clearly communicate why they are unavailable when disabled or blocked.

## No-Spoiler Rule

Pre-show UI may show risk, readiness, fatigue, morale pressure, availability, title/rivalry context, finance state, PLE timing, and card shape.

Pre-show UI must not show predicted grades, fan reaction, social buzz, finance fallout, title outcomes, rivalry movement, morale changes, injury outcomes, or Open Challenge opponent identity.

Consequences belong after the player acts. Results, Week Review, Social, Finance, Rivalries, Championships, and Season Review may reveal resolved fallout only after the relevant show or week has been simulated.

## Screen Personality Rules

Routine management screens should feel tactical, readable, and repeatable.

Major moments should feel staged.

Give stronger presentation to:

- Draft Night.
- Final roster review.
- PLE weeks.
- Title matches.
- Title changes.
- Open Challenge reveals.
- Major injuries.
- Breakout performances.
- Rivalry payoffs.
- Season Review.
- Start Next Season.

Do not make every screen loud. The product should have contrast: quiet GM office pressure for routine management, stronger broadcast treatment for moments that deserve it.

## Typography Expectations

Use condensed or sports-broadcast typography for:

- Page titles.
- Show names.
- Wrestler names.
- Championship names.
- Major calls to action.
- Large numbers.
- Hero labels.
- Draft or ranking positions.

Use readable UI typography for:

- Body copy.
- Metadata.
- Form labels.
- Warnings.
- Reports.
- Tables.
- Feeds.
- Tooltips.
- Validation text.

Text hierarchy should be obvious. Avoid same-size, same-weight blocks of copy competing across a screen.

## Color Semantics

Color should carry meaning consistently:

- Gold: championships, prestige, money, rank, winners, star value, legacy.
- Red: heat, urgency, danger, active conflict, rivalry intensity, blocked or severe states.
- Green: ready, healthy, recovery, positive movement, morale gain, profit.
- Yellow/orange: caution, fatigue, risk, incomplete work, operational warning.
- Blue/cyan: neutral system context, scouting, technical readouts, secondary information.
- Gray/charcoal: base surfaces, disabled states, inactive metadata, empty state structure.

Brand color should create identity and atmosphere, not flood the whole screen.

## Density Rules

Dense screens are allowed when comparison matters.

Useful density belongs in:

- Draft boards.
- Roster comparison.
- Talent lists.
- Segment queues.
- Finance history.
- Social feeds.
- Championship/rivalry histories.

Clean staging belongs in:

- Title screen.
- Contract/setup beats.
- Draft selection moments.
- Show Results hero.
- Week Review summary.
- PLE framing.
- Season Review.

Density should never come at the cost of clipped controls, unreadable rows, hidden actions, or unclear hierarchy.

## Accessibility And Usability

Player-facing UI should be laptop-first and readable on common 11-13 inch screens.

Check for:

- Text clipping.
- Hidden primary actions.
- Overflowing rows.
- Controls pushed off-screen.
- Contrast issues.
- Color-only status meaning.
- Excessive motion.
- Tiny click targets.
- Unwanted full-page scroll.
- Loss of selected context.

Drag-and-drop must have an alternative path when used for core gameplay.

Reduced-motion preferences should be respected where practical.

## Implementation Boundaries

This document guides UI work; it does not authorize new gameplay scope.

Do not use this document alone to add:

- New game systems.
- New data sources.
- Routing.
- Tailwind.
- Backend services.
- Auth.
- Cloud sync.
- Multiplayer.
- Persistence changes.
- Save-shape changes.
- Visual asset generation.
- Screen rewrites outside the active ticket.
- Simulation changes.
- Predicted pre-show outcomes.

Any ticket using this document must still preserve the current playable loop unless the ticket explicitly states otherwise.

## Validation Expectations

For UI work using this contract, verify the touched screen against:

- Main action is obvious.
- Selected context is visible.
- Important state changes have feedback.
- No critical controls are clipped or hidden.
- Long lists use contained scrolling where practical.
- The screen does not feel like a generic SaaS dashboard.
- Pre-show surfaces do not reveal hidden outcomes.
- The current playable loop still works when relevant.

When practical, check at least:

- Desktop/laptop width.
- A dense state.
- An empty or early-career state.
- A blocked or warning state.
- A ready/valid state.

## Non-Goals

This document does not authorize new game systems, new data sources, routing, Tailwind, backend services, persistence changes, visual asset generation, or screen rewrites outside the active ticket.
