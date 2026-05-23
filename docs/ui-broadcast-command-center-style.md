# Next GM UI Broadcast Command Center Style Guide

## Purpose

This guide turns `docs/ui-ux-doctrine.md` into implementation-ready visual direction for future player-facing UI work.

Use it when changing screens, layout, navigation, CSS, shared components, screen copy hierarchy, interaction states, or player-facing presentation. It does not replace the UI/UX doctrine. The doctrine defines the product fantasy; this guide defines the visual system that should carry that fantasy.

The goal is a consistent Next GM interface that feels like a premium dark wrestling GM command center: sports broadcast polish, draft-night war room tension, locker-room pressure, franchise-mode clarity, brand-colored atmosphere, and dense tactical information that remains readable.

This guide is not permission to add systems, screens, game state, data, routing, persistence, backend services, cloud sync, auth, visual assets, fonts, or dependencies.

## Canonical UI Artifacts

Use these artifacts as the source of truth for future Next GM broadcast UI work:

- Brand skin tokens: `docs/ui/tokens/next-gm-brand-skins.tokens.yml`
- Screen template: `docs/ui/screen-templates/brand-hq-command-center/index.html`
- Codex skill: `next-gm-broadcast-ui`

The token file owns official red, blue, gold, and fight-gold brand skins plus the shared dark shell values. The screen template is the first runnable Brand HQ example. The skill tells future Codex sessions when and how to apply both.

Brand colors are skins for promotion identity. They should control rails, selected states, hero lighting, active navigation, CTA accents, logo framing, and broadcast tags. They should not replace semantic warning, danger, success, or info colors.

## Target Vibe

Next GM should feel like the player is running a televised wrestling brand from a live production command center.

The default mood:

- Premium dark sports broadcast.
- Underground wrestling command center.
- Draft-night war room.
- Locker-room hub.
- GM office under pressure.
- Franchise-mode sports clarity.
- Living wrestling universe reacting after the player acts.

The UI should feel tactical, dramatic, and readable. It should feel built for repeat weekly use, not like a one-off landing page or a generic data product.

It must not feel like:

- SaaS dashboard.
- Admin panel.
- Spreadsheet simulator.
- Generic dark website.
- Chatbot wrapper.
- Soft startup app.
- Marketing page.
- CRUD console with wrestling labels.

## Visual Reference Language

Use this language as the shared reference point for implementation:

- Sports broadcast graphics.
- Wrestling TV production room.
- Draft board and war room.
- Arena lighting and LED boards.
- Titantron glow without full-screen noise.
- Lower-third broadcast strips.
- Control-room HUDs.
- Match-card rundown boards.
- Locker-room status board.
- Scouting desk.
- Franchise mode home hub.

Do not copy real-world broadcast layouts, trademarks, logos, screenshots, arena packages, or copyrighted compositions. The style should borrow the category language, not specific protected assets.

## Core Layout DNA

Build screens from stable command-center regions:

- Top HUD: global game context, current brand, week, season, money, current mode, and urgent status.
- Primary stage: the main decision or major narrative beat for the screen.
- Side rail: roster filters, mode navigation, summaries, queues, pressure lists, or contextual tools.
- Tactical grid: metric tiles, roster cards, show segments, rivalry cards, champion panels, finance rows, or social feed items.
- Lower-third strip: current action context, selected item summary, warnings, or recent consequence.
- Bottom action bar: primary confirm/run/advance action plus secondary actions.
- Contained scroll panels: roster lists, feeds, draft boards, and long reports scroll inside panels rather than forcing primary gameplay screens into uncontrolled page scrolling.

Prefer a strong visual hierarchy over equal card walls. Every screen should answer:

- What is the player doing now?
- What changed because of previous decisions?
- What is the next meaningful action?
- What information is needed before choosing?
- What should remain hidden until after action?

Primary gameplay screens should be laptop-first. They should work on common 11-13 inch displays with compact regions, readable type, and no hidden critical actions.

## Shape Language

The shape language is sharp, broadcast, and tactical.

Use:

- Rectangular panels with 0-8px radius.
- Hard panel edges.
- Thin 1px borders.
- Angular tabs or rails.
- Broadcast strips and lower-thirds.
- Compact stat tiles.
- Layered panels with clear depth.
- Strong horizontal and vertical alignment.
- Left-edge or top-edge accent bars for importance.
- Small beveled or clipped-corner effects only when they stay readable and reusable.

Avoid:

- Large rounded pill overload.
- Bubbly cards.
- Soft SaaS surfaces.
- Floating cards inside cards.
- Decorative blob backgrounds.
- Generic dark mode containers with no broadcast structure.
- Excessive glow that makes text harder to read.
- Overly round buttons that feel like productivity software.

## Color System

Use a dark tactical base with controlled brand-led accents.

Recommended color roles:

- `surface-base`: near-black page background.
- `surface-panel`: dark panel surface.
- `surface-elevated`: active or raised panel surface.
- `surface-glass`: translucent tactical overlay where useful.
- `border-muted`: low-contrast panel border.
- `border-strong`: selected or important panel border.
- `text-primary`: main readable text.
- `text-secondary`: supporting text.
- `text-muted`: tertiary labels and metadata.
- `accent-brand`: active brand color.
- `accent-brand-soft`: low-alpha brand glow or wash.
- `accent-gold`: prestige, title, highlight, star, or winner energy.
- `accent-danger`: injury, severe risk, deficit, blocked state.
- `accent-warning`: fatigue, morale risk, incomplete card, operational warning.
- `accent-positive`: recovery, strong result, momentum, profit.
- `accent-info`: neutral scouting, context, or system guidance.

Brand color should create identity and atmosphere without flooding the whole screen. Most of the UI should remain dark, readable, and system-consistent. Brand color belongs in accent rails, selected states, lighting washes, HUD glows, hero edges, and important calls to action.

Do not build one-note palettes. A Raw-inspired screen should not become entirely red. A SmackDown-inspired screen should not become entirely blue. A NXT-inspired screen should not become entirely gold. An AEW-inspired screen should not become entirely black and gold.

Use contrast first. Color cannot be the only way to communicate state.

## Brand Theme Rules

The visual system should support brand moods through variables or tokens, not one-off CSS per screen.

Each brand theme should define:

- Primary brand accent.
- Secondary accent.
- Ambient background wash.
- Selected border color.
- HUD glow color.
- Lower-third accent.
- Critical/action contrast color.

Brand themes should affect atmosphere, not layout rules. A player should recognize the brand mood while still understanding the same Next GM interface.

Use brand color for:

- Top HUD accent.
- Current brand hero treatment.
- Active navigation state.
- Main call-to-action glow or edge.
- Selected roster/card state.
- Draft board highlight.
- Championship or PLE moment framing when appropriate.

Do not use brand color for:

- Every panel background.
- Every button.
- Long body text.
- Whole-screen overlays that reduce readability.
- Warning or error states that need semantic colors.

Future UI work should keep brand theming implementation-friendly by centralizing theme values before spreading brand-specific exceptions.

## Typography

Typography should feel like sports broadcast plus management clarity.

Use:

- Condensed display type for large screen titles, broadcast labels, card names, wrestler names, show names, and lower-third headlines.
- Plain readable UI type for controls, body copy, lists, tables, and detail text.
- Small uppercase labels for metadata and HUD tags.
- Compact numeric styling for metrics.
- Strong weights for section labels and critical values.
- Consistent label/value patterns across metric tiles and status rows.

Avoid:

- Oversized hero typography inside compact panels.
- Negative letter spacing.
- Viewport-scaled font sizes that become unstable.
- Long all-caps paragraphs.
- Tiny dense text without hierarchy.
- Decorative type choices that hurt readability.

Text must fit inside its parent element on laptop and desktop widths. Use wrapping, truncation, line clamp, tooltip, panel scroll, or responsive layout changes instead of letting text overflow.

## Texture and Atmosphere

Atmosphere should support the command-center fantasy without becoming visual noise.

Use sparingly:

- Subtle grain or noise.
- LED scanline feel.
- Low-alpha arena light washes.
- Thin grid overlays.
- Faint vignette.
- Controlled glow behind major panels.
- Titantron-style edge lighting.
- Broadcast ticker strips.

Avoid:

- Heavy background images.
- Blurry stock-like media.
- Decorative orbs or bokeh blobs.
- Random gradients.
- High-noise textures behind body text.
- Full-screen glow that reduces contrast.

Atmosphere is strongest when it frames content. It should not compete with decisions.

## Component Patterns

Future UI work should prefer reusable component patterns that can be applied across screens.

Top HUD:

- Shows brand, GM, season, week, money, current show, current mode, and critical alerts.
- Stays compact.
- Uses brand accent as an edge or active-state cue.

Side rail:

- Good for navigation, filters, current roster group, booking tools, or selected context.
- Should be narrow, stable, and scannable.
- Use icons only when a clear icon exists and include accessible labels.

Bottom action bar:

- Holds the primary action when the screen is decision-heavy.
- Useful for Book Show, Run Show, Advance Week, Start Next Season, Confirm Pick, or Save/Cancel style decisions.
- Should keep the main action visible without hiding important content.

Lower-third:

- Use for selected wrestler, segment summary, current show context, live result reveal, title change, rivalry movement, injury fallout, or finance headline.
- Keep text short and punchy.

Tactical panel:

- Base building block for dashboard, booking, roster, finance, and social.
- Use one main heading, one clear purpose, and a small number of primary metrics.

Metric tile:

- Use for money, fatigue, morale, heat, freshness, score, attendance, profit/loss, title prestige, or roster counts.
- Label, value, and optional detail should be consistently ordered.

Status badge:

- Use for overused, underused, protected star, morale risk, injury risk, minor injury, unavailable, hot, cooling, stale, champion, contender, PLE, go-home, ready, blocked.
- Badges should be compact and semantic.

Roster card:

- Should surface wrestler name, role/tier, momentum, morale, fatigue, injury status, champion/rivalry context, and one useful GM read.
- Cards should support scanning and comparison.

Booking segment card:

- Should show slot number, segment type, participants, duration, validity, title/rivalry context, and warnings.
- Before Run Show, show readiness and risk warnings only. Do not show predicted outcome values.

Rundown board:

- Use a vertical or timeline-style list for the booked show.
- Make the main event and special moments feel stronger without hiding edit controls.

Feed item:

- Use for social/IWC, fallout, history, and reports.
- Include source/category, timestamp/week, related people or titles, and concise text.

Empty state:

- Should feel like an idle command center, not a blank admin record list.
- It should tell the player what action can fill the space.

Dialog/drawer:

- Use for focused selection, confirmation, or details.
- Keep destructive or irreversible actions confirmed.
- Do not hide required primary flow actions in secondary drawers.

## Screen-Specific Direction

Title:

- Should feel like entering a premium wrestling management game.
- Save selection should feel like franchise career slots, not file records.
- Keep start/continue actions direct.

Setup:

- Should feel like being hired and stepping into a competitive wrestling universe.
- Contract, rules, GM identity, brand selection, career preview, draft, and review should each have a clear emotional beat.
- Do not turn setup into a generic form wizard.

Draft Night:

- Should feel like a broadcast war room.
- Best available board, drafted roster, filters, search, budget, brand context, and pick confirmation should be readable at once where possible.
- Draft picks should feel dramatic but quick.
- Keep the current open draft rule intact unless an active ticket explicitly changes it.

Dashboard / Brand HQ:

- Should be the launchpad.
- Show the week, current show, next action, brand pulse, roster pressure, champion/rivalry highlights, social/finance pulse, and last-show fallout.
- It should answer what needs attention right now.

Booking:

- Should feel like building a live TV production card.
- Show segment slots, runtime, valid/invalid readiness, participant availability, champion/rivalry context, fatigue/morale/injury warnings, and clear add/edit/remove actions.
- Do not reveal predicted grades, fan reaction, finance fallout, title outcomes, rivalry movement, social buzz, morale fallout, injury outcomes, or Open Challenge opponents before Run Show.

Results:

- Should feel like broadcast recap plus consequence reveal.
- Keep the collapsed state viewport-fit on laptop screens: broadcast recap first, then compact expandable rows for Post-Show Cause Ledger, Operational Fallout, and Broadcast Breakdown.
- Fold title, rivalry, PLE, business, roster, and Open Challenge aftermath into the resolved recap, cause ledger, or operational fallout instead of duplicating standalone fallout panels.
- Expanded support rows may scroll internally; the collapsed screen should not require page scrolling.

Week Review:

- Should connect consequences before the calendar advances.
- Place the Advance Week or Season Review action inside the PLE/week aftermath box so the next step is part of the office handoff, not a detached hero action.
- Keep Week Review lighter than Results: summarize the aftermath and next-week setup without repeating full Results, Finance, Championship, Brand Pulse, or Post-Show Cause Ledger panels.

Roster / Locker Room:

- Should feel like a living locker room.
- Prioritize who is hot, tired, frustrated, underused, overused, injured, champion, in rivalry, or needing attention.
- Use cards, boards, filters, and compact comparison.

Wrestler Profile:

- Should support GM decisions with character context.
- Show TV history, status, championship/rivalry context, social mentions, and a concise GM read.
- Avoid raw stat dumps without interpretation.

Championships:

- Should feel prestigious.
- Use a Champion Wall or equivalent title wall so every active belt is visible and treated as important.
- Use a selected-title workspace for the active belt, with focused views for Scene, Contenders, and History.
- Keep the Championship screen viewport-first: the Champion Wall, selected-title workspace, and collapsed committee/support strip should fit without document-level page scroll.
- Put overflow inside contained panels only, especially the Champion Wall list and selected-title detail body. Title cards must have stable row heights and clip or truncate long metadata instead of overlapping adjacent belts.
- Spotlight champion state, vacancy, reign, defenses, current scene pressure, selected-title contenders, division health, and title history.
- Keep contender boards scoped to the selected title. Do not show every division or every eligible pool when the player is focused on one belt.
- Contender controls should be direct GM tools: edit, add, remove, and reorder. The game may suggest same-division contenders, but it should not auto-place current champions from other titles into another title's contender lane.
- Vacant titles should expose assignment as a clear player action. Revocations and assignments should appear in title history.
- Avoid redundant advisory grids and explanatory copy when the selected title workspace already carries the decision context.

Rivalries:

- Should feel alive and elastic.
- Use a command-desk shape: active rivalry rail on the left, selected rivalry spotlight in the center, rivalry composer on the right, and a compact expandable Creative Desk strip pinned at the bottom.
- The selected rivalry spotlight should stay current-state only: structure, stakes, participants, heat, freshness, timing, stage, GM read, recent history, and available player actions.
- Support singles, tag 2v2, and multi-person rivalry presentation without implying team records, faction mechanics, rankings, predicted outcomes, or hidden story simulation.
- Avoid redundant labels such as participant subtitles that repeat the title, "Relationship: Rivals," projected effects, broad template panels, or warning grids when the selected rivalry workspace already carries the decision context.

Calendar:

- Should orient the player on the road to PLE.
- Show current week, go-home weeks, PLEs, completed shows, and structural milestones.
- Do not turn it into a dumping ground for every alert.

Social / IWC:

- Should feel like a reactive wrestling internet feed.
- Posts should reflect actual outcomes after they happen.
- Use source/category labeling and keep spicy copy contained.

Finance:

- Should be clear, gamey, and decision-focused.
- Show money, profit/loss, revenue, costs, pressure, and trends without becoming accounting software.
- Keep the primary GM Office Pressure read open and dominant.
- Put dense finance support details behind expandable panels when the screen would otherwise become a report list.
- Finance copy should stay current or retrospective. Do not introduce forecasts, predicted business outcomes, budgets, payroll, sponsorships, ownership objectives, or accounting systems unless an active ticket explicitly asks for them.

Season Review:

- Should feel like a season-ending broadcast package and executive review.
- Summarize actual gameplay history, not invented offscreen story.

## Density Rules

Dense UI is allowed when comparison matters. It is not allowed when it erases hierarchy.

Good density:

- Draft boards.
- Roster comparison.
- Booking rundowns.
- Finance breakdowns.
- Social feeds.
- History lists.
- Championship and rivalry summaries.

Bad density:

- Every panel has equal weight.
- Metrics appear without interpretation.
- Text is too small to read on 11-13 inch screens.
- Critical actions fall below uncontrolled page scroll.
- Repeated labels consume more space than player decisions.
- Cards become a spreadsheet with extra borders.

Use progressive disclosure:

- Primary information visible.
- Secondary context nearby.
- Tertiary detail in panels, drawers, hover/focus details, expandable rows, or profile screens.
- Hidden outcomes revealed only after the relevant action.

## Motion Rules

Motion should communicate state, consequence, and broadcast energy.

Use motion for:

- Mode transitions.
- Draft pick confirmation.
- Segment added to the rundown.
- Run Show reveal sequence.
- Title change.
- Rivalry movement.
- Injury fallout.
- Major social pulse.
- Finance profit/loss reveal.
- Active selection and focus.

Motion should be:

- Short.
- Purposeful.
- Optional for reduced-motion users.
- Focused on hierarchy and state change.

Avoid:

- Random ambient motion.
- Infinite attention-seeking animations.
- Motion that delays repeated management tasks.
- Motion that hides final values or blocks input too long.

## Accessibility and Usability

The UI must remain playable and readable.

Requirements:

- Laptop-first layout for common 11-13 inch screens.
- Keyboard-visible focus states.
- Click targets large enough for repeated play.
- Text contrast suitable for dark UI.
- No text overflow outside cards, buttons, panels, tables, or rows.
- Status not communicated by color alone.
- Reduced-motion support for major animations.
- Controls remain usable without drag-and-drop.
- Empty, disabled, selected, hover, focus, loading, invalid, and destructive states are visually distinct.
- Critical actions are not hidden in low-contrast areas.
- Pre-show warnings are allowed; hidden consequences are not.

Player agency rule:

- The UI may warn, summarize, compare, and provide context.
- The UI must not secretly decide for the player.
- Recommendations should feel like staff input, not autopilot.
- The player remains the final decision-maker.

Reveal rule:

- Before Run Show, do not show predicted grades, predicted fan reaction, predicted social buzz, predicted finance fallout, predicted title outcomes, predicted rivalry movement, morale outcomes, injury outcomes, or Open Challenge opponents.
- After Run Show, reveal consequences clearly and connect them to the player's choices.

## Do / Don't Summary

Do:

- Use sharp sports-broadcast rectangles.
- Use dark tactical panels.
- Use controlled glow.
- Use LED and titantron energy as accent, not noise.
- Use lower-third language for selected context and big reveals.
- Use top HUDs, side rails, and bottom action bars where they clarify flow.
- Use roster cards, metric tiles, status badges, feed items, and tactical panels consistently.
- Use brand-led lighting and variables/tokens for mood.
- Keep brand color controlled.
- Keep dense screens readable.
- Keep player decisions obvious.
- Preserve retrospective consequence reveals.
- Make big moments feel staged.
- Make routine management fast and clear.

Don't:

- Build a SaaS dashboard.
- Build an admin panel.
- Build a spreadsheet simulator.
- Build a generic dark website.
- Build a chatbot wrapper.
- Flood screens with one brand color.
- Use copied real-world logos, trademarks, screenshots, or layouts.
- Add image assets, font files, or dependencies for this style.
- Reveal hidden outcomes before Run Show.
- Show predicted grades, fan reaction, social buzz, finance fallout, title outcomes, or rivalry movement pre-show.
- Hide critical actions below uncontrolled scroll.
- Let text overflow.
- Use decorative motion with no gameplay meaning.
- Create one-off visual rules when a reusable pattern would serve future screens.
