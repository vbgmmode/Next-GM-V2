# Next GM Design DNA

Use this reference when making or reviewing visual decisions for player-facing Next GM UI.

## Product Feel

Next GM should feel like a complete single-player wrestling GM game, not a generic web app with wrestling labels.

The target blend:

- premium dark sports broadcast
- underground wrestling command center
- franchise-mode clarity
- draft war room tension
- locker-room and GM office pressure
- living wrestling universe that reacts after the player acts

Routine management screens should feel tactical and repeatable. Big moments should feel staged: draft picks, title changes, PLEs, major rivalry movement, shocking injuries, hot social reaction, and season review beats.

## Shape Language

Use sharp, broadcast, tactical geometry:

- rectangular panels with 0-8px radius
- hard edges and tight alignment
- thin 1px borders
- angular tabs and rails
- lower-third strips
- compact stat tiles
- left-edge or top-edge accent bars
- layered dark panels with clear depth

Avoid:

- bubbly cards
- oversized rounded pills
- soft SaaS surfaces
- floating cards inside cards
- decorative blobs, orbs, and random gradients
- generic dark containers without broadcast structure

## Color Roles

Keep the base dark and controlled. Accent color should guide attention, not flood the screen.

- Red: heat, focus, danger, blocked state, severe risk, injury pressure, rivalry intensity.
- Gold: prestige, championships, money, winners, star value, premium moments.
- Green: healthy, ready, recovery, momentum, upside, profit, successful state.
- Yellow: caution, fatigue, morale risk, incomplete card, operational warning.
- Muted blue/cyan: neutral context, scouting, system guidance, cold readouts.
- Gray/silver: inactive, metadata, table structure, quiet supporting context.

Brand color creates atmosphere through edges, glows, selected states, lower-thirds, and HUD accents. It should not override semantic colors or turn the screen into a one-color wash.

## Typography

The typography should feel like sports broadcast plus management clarity.

Use condensed display type for:

- screen titles
- wrestler names
- show names
- championship labels
- broadcast/lower-third headlines
- major values

Use readable UI type for:

- controls
- body copy
- status detail
- tables
- reports
- longer feed text

Rules:

- no negative letter spacing
- no viewport-scaled font sizes
- no long all-caps paragraphs
- no tiny dense labels without hierarchy
- text must fit inside buttons, cards, rows, panels, and tables

## Layout DNA

Build screens from command-center regions:

- Top HUD: brand, GM, season, week, money, mode, urgent status.
- Primary stage: the main decision or narrative beat.
- Selected-object workspace: details and actions for the current selected wrestler, segment, title, rivalry, show, report, or draft target.
- Side rail: filters, navigation, queues, summaries, pressure lists, or tools.
- Tactical grid: cards, metrics, rundown slots, roster rows, title/rivalry panels, finance rows, social posts.
- Lower-third strip: selected context, current action, warning, or recent consequence.
- Bottom action bar: confirm, run, advance, save/cancel, or other primary action when a screen is decision-heavy.
- Contained scroll panels: long roster lists, feeds, draft boards, reports, and history.

Core game screens should be viewport-first. Full-page scrolling on primary screens is a design failure unless the active ticket explicitly allows it.

## Interaction Language

Use console-game and sports-franchise language where appropriate:

- Select
- Inspect
- Assign
- Confirm
- Back
- Advance
- Run Show
- Book Segment
- Set Champion
- View Fallout
- Continue Career
- Start Next Season

Avoid generic SaaS language when a game-native label is clearer:

- Submit
- Config
- Records
- Items
- CRUD
- Admin
- Users
- Database

Every major action needs visible feedback through selected state, panel update, lower-third message, status pulse, reveal sequence, feed item, or consequence panel.

## Usability Commitments

The UI must be usable after 50 in-game weeks:

- primary decision is obvious
- critical actions stay visible
- dense data is grouped and interpreted
- status is not communicated by color alone
- hover, focus, selected, disabled, invalid, and destructive states are distinct
- reduced-motion users are respected when motion is used
- drag-and-drop is never the only way to complete core flow
- no clipped labels, text overflow, hidden controls, or fake visual polish
