---
name: next-gm-broadcast-ui
description: Use for Next GM player-facing UI implementation, redesign, visual polish, screen creation, and UI audits when the work should follow the canonical broadcast command-center template, brand skin tokens, and premium wrestling management game visual system. Do not use for backend-only, persistence-only, tests-only, or non-UI tasks.
---

# Next GM Broadcast UI

Use this skill when building or reviewing Next GM UI. It is the concrete implementation companion to the broader game UI/UX direction.

## Canonical Artifacts

Start from these repo-owned sources before inventing a new layout or style:

- Tokens: `/Users/vbahmad/Documents/AI/Next GM V2/docs/ui/tokens/next-gm-brand-skins.tokens.yml`
- Screen template: `/Users/vbahmad/Documents/AI/Next GM V2/docs/ui/screen-templates/brand-hq-command-center/index.html`
- Style guide: `/Users/vbahmad/Documents/AI/Next GM V2/docs/ui-broadcast-command-center-style.md`
- Repo instructions: `/Users/vbahmad/Documents/AI/Next GM V2/AGENTS.md`

If a different clone is active, resolve the equivalent paths inside that clone.

## Required Behavior

- Preserve the premium dark wrestling broadcast command-center shell.
- Treat red, blue, gold, and fight-gold as brand skins, not generic accent colors.
- Keep status colors semantic and separate from brand identity.
- Build around a selected object, player action, current pressure, and consequence context.
- Use real asset slots for brand logos, show art, wrestler portraits, title plates, and badges.
- Keep primary game screens viewport-first with contained scrolling inside dense panels.
- Use sharp panels, tactical glass, restrained glow, dense data rows, and strong hierarchy.
- Keep the next player action obvious within two seconds.

## Avoid

- Generic SaaS dashboards, equal-weight KPI cards, admin copy, or CRUD framing.
- CSS-only dummy portraits as the production visual answer.
- Emoji HUD icons.
- Uncontrolled red glow or full-screen brand-color flooding.
- Large rounded cards, bubbly buttons, decorative blobs, or marketing-page composition.
- Predicted pre-show outcomes such as grades, fan reaction, finance fallout, rivalry movement, morale fallout, injury outcomes, or Open Challenge reveals.
- A duplicate bottom control-room footer rail unless the active ticket explicitly asks for it.

## Verification

For UI implementation work, verify the relevant screen or template at desktop `1280x720` and a mobile width. Check for text overflow, horizontal scroll, clipped panels, hidden critical rows, missing selected-object hierarchy, missing visual assets, and incorrect brand/status color use.
