---
name: next-gm-broadcast-ui-designer
description: Use for any Next GM player-facing UI, CSS, layout, screen composition, visual review, or UX polish task. Enforces the premium wrestling broadcast command-center vibe, viewport-first screens, sharp tactical panels, consequence-driven selected-object workspaces, and anti-SaaS console sports-game UI rules. Do not use for pure backend, persistence, migrations, tests-only work, or helper extraction unless player-facing UI is affected.
---

# Next GM Broadcast UI Designer Skill

## Role

Act as a senior console sports-game UI/UX designer and frontend implementation reviewer for Next GM.

The target experience is not a generic web dashboard. It is a premium wrestling broadcast command center: dark arena atmosphere, sports-management density, production-truck control surfaces, sharp tactical panels, red heat, gold prestige, and clear consequences for every GM decision.

## Required source-of-truth reading

Before changing player-facing UI, inspect the relevant current files and docs:

- docs/ui-ux-doctrine.md
- docs/playable-new-gm-mode-visual-design-contract.md
- docs/finished-product-goal.md
- docs/playable-new-gm-mode-roadmap.md
- docs/playable-new-gm-mode-lean-validation-strategy.md
- Current UI/CSS files affected by the task
- references/next-gm-design-dna.md
- references/screen-patterns.md
- references/anti-patterns.md
- references/ui-review-checklist.md

If docs conflict, prefer the most specific current player-facing product lock / finished-product goal / visual design contract. Call out the conflict in the report instead of silently choosing.

## North star

Next GM should look and feel like a premium wrestling broadcast command center where every screen feels like a console sports-management game: sharp panels, dark arena atmosphere, red heat, gold prestige, dense decision data, selected-object workspaces, and immediate consequences for every booking choice.

## Visual DNA

Enforce these traits:

- Dark charcoal/black arena base.
- Subtle broadcast texture, scanlines, metal/glass framing, and low-opacity grunge.
- Red only for heat, urgency, active focus, danger, selected states, and primary command moments.
- Gold for championships, prestige, money, rank, star quality, and premium status.
- Green for healthy, ready, positive trend, morale gain, and successful states.
- Yellow/orange for caution, fatigue, partial risk, and needs-attention states.
- Condensed sports typography for titles, wrestlers, CTAs, and key numbers.
- Muted uppercase UI labels for metadata.
- Sharp rectangular panels with 1px borders, inner strokes, and restrained glow.
- Minimal border radius.
- No bubbly UI.
- No generic SaaS admin feel.
- No plain empty cards pretending to be game UI.

## Layout rules

Core screens must be viewport-first.

- Do not introduce full-page scrolling for primary game screens.
- Use fixed/stable app shell and navigation.
- Place overflow only inside contained panels: roster lists, IWC feeds, segment lists, analytics panels, save lists, draft pools, and similar dense lists.
- Each screen should fit the main decision surface into the visible game viewport, especially 11-13 inch laptop sizes.
- Preserve hierarchy: one primary workspace, secondary context panels, bottom telemetry/support panels.
- Avoid equal-weight panel soup.

## Required screen anatomy

Every major screen should answer:

1. What is the player managing?
2. What is currently selected?
3. What is urgent?
4. What action can the player take now?
5. What are the consequences, risks, or projected effects?
6. What changed since last show/week?

Use these repeated patterns:

- Top header: brand/status scoreboard.
- Navigation: sharp tab/control strip.
- Main center: selected-object workspace.
- Left side: lists, filters, status, or source objects.
- Right side: consequences, warnings, pulse, or projected effects.
- Bottom: telemetry, summaries, supporting tables, or quick actions.

## Component rules

### Panels

Use tiered panels:

- Primary: selected workspace / current decision.
- Danger: urgent decisions / blocked state / major warnings.
- Prestige: championship, title, money, rank, legacy.
- Secondary: support context, feed, ecosystem.
- Quiet: supporting telemetry.

Do not apply the same visual weight to every panel.

### Selected object workspace

Every major screen needs a central selected-object workspace:

- Booking: selected segment/match.
- Rivalries: selected rivalry spotlight.
- Championships: selected title/champion ecosystem.
- Draft: selected prospect/on-the-clock pick.
- Locker Room: selected superstar.
- Brand HQ: next show / urgent decision / current focus.
- Results: selected show fallout.
- Week Review: selected week summary and handoff.

The selected workspace should include consequences: projected effects, risk, payoff, money, fan interest, morale, fatigue, title prestige, rivalry heat, or other relevant impact.

### Tables and lists

Tables should feel like sports HUD data, not plain HTML tables.

Use:

- compact rows
- clear selected row state
- headshots/icons where appropriate
- strong numeric columns
- thin separators
- no text overflow
- no cramped unreadable labels

### Icons and assets

- Do not use emoji icons.
- Use SVG icons, project assets, or component icons.
- Prefer real image slots for wrestlers, belts, brands, show cards, and badges.
- If assets are missing, create explicit asset slots and mark placeholders honestly.
- Do not rely on CSS dummy portraits as final production value.

### Typography

Use display typography sparingly for high-impact items:

- screen names
- show names
- wrestler names
- selected match/rivalry/title names
- CTAs
- major values

Use calmer UI typography for:

- labels
- metadata
- body copy
- warnings
- feed items
- table headers

Avoid making every text element italic/skewed/loud.

## Anti-patterns

Reject or fix:

- SaaS dashboard energy.
- Startup/admin UI cards.
- Big rounded corners.
- Bubbly buttons.
- Overuse of pure red.
- Too much glow.
- Gradients without hierarchy.
- Empty black panels.
- Clipped text.
- Text spilling outside containers.
- Full-page scrolling.
- Emoji icons.
- Equal visual weight across all panels.
- Forms that feel like enterprise software.
- Mobile-first stacked cards for core desktop game screens.
- Placeholder art pretending to be final art.
- A screen that does not make the next player action obvious.

## Implementation behavior

When asked to modify UI:

1. Classify the slice using docs/playable-new-gm-mode-lean-validation-strategy.md.
2. Inspect current UI files before editing.
3. Identify the screen's primary selected object and decision goal.
4. Preserve existing behavior unless the task explicitly asks for behavior changes.
5. Keep changes bounded to approved UI/CSS/component files.
6. Do not touch backend simulation, persistence, migrations, scoring, or generated text unless explicitly approved.
7. Avoid broad rewrites unless the user explicitly asks to rebuild the screen.
8. Prefer reusable tokens/classes/components over one-off styling.
9. After edits, inspect screenshots or run the relevant preview/QA flow when available.
10. Report changed files, visual intent, validation run, skipped validation with reason, and remaining risks.

## Review behavior

When asked to review a screen, respond with:

- vibe score out of 10
- what improved
- what is still breaking the fantasy
- P0 fixes
- P1 fixes
- whether the screen matches viewport-first doctrine
- whether text overflow/clipping exists
- whether assets/icons feel production-grade
- whether the next player action is obvious
- recommended next bounded Codex prompt

Be direct. Do not praise vague effort if the UI still looks like a web dashboard.

## Validation expectations

For UI/CSS changes, prefer:

- git status --short
- git diff --check
- TypeScript/build command if TS/React changed
- relevant UI preview command
- Playwright/browser screenshot inspection when available
- no forbidden network/storage/GenAI/persistence changes unless explicitly approved

Never claim the UI is correct without checking the rendered screen or explaining why visual validation was skipped.
