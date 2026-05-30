# Player-Facing UI QA Checklist

Use this checklist for Next GM player-facing UI changes before reporting a slice ready for review.

## Viewports

- Check `1280x720` for laptop-first command-center fit.
- Check `1024x768` for constrained laptop readability.
- Check one mobile width, such as `390x844`, for basic responsive containment.

## Screen Checks

- Top navigation remains visible and readable.
- The primary CTA is visible without hunting.
- Text stays inside buttons, cards, rows, and panels.
- Long lists scroll inside their panels instead of forcing uncontrolled page scroll.
- Selected-object hierarchy is clear within 2 seconds.
- Brand skin accents stay separate from semantic warning, danger, success, and info colors.

## Game Integrity

- Pre-show screens show current state, readiness, risk, and availability only.
- Pre-show screens do not reveal predicted grades, fan/social reaction, finance fallout, title outcomes, rivalry movement, morale changes, injury outcomes, or Open Challenge opponent identity.
- Post-show consequence language ties back to resolved events.
- Dashboard does not restore a duplicate bottom control-room rail.

## Regression Checks

- `npm exec tsc -- --noEmit`
- `npm run build`
- New Game / Continue / Reset Save when the shell or setup flow changes.
- Booking with at least 2 valid segments when Booking, roster availability, or show flow changes.
- Run Show -> Show Recap + GM Handoff -> Advance Week when loop screens or persistence are touched.
- On Show Recap, click a broadcast rundown segment chip and verify the focused Segment Receipt window opens, supports close/Escape, and does not push the GM Handoff below the page.
- Refresh persistence after save-affecting or screen-state changes.
- Confirm `src/game/aiCommentary.ts` and AI commentary call paths were not changed unless the ticket explicitly requested it.
