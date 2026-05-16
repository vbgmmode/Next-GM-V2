Follow AGENTS.md.

Task: Fix one broken behavior in Next GM.

Bug:
[Describe the broken behavior.]

Expected behavior:
[Describe what should happen.]

Actual behavior:
[Describe what currently happens.]

Steps to reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Scope:
- Fix the specific bug described above.
- Keep the fix as small and direct as possible.
- Add or adjust tests/checks only where useful for this bug.

Out of scope:
- Do not redesign the touched screen.
- Do not add adjacent features.
- Do not refactor unrelated code.
- Do not change game balance unless required by the bug.

Acceptance tests:
- [Concrete test proving the bug is fixed]
- [Concrete regression check]
- The core playable loop still works:
  New Game -> Dashboard -> Booking -> Run Show -> Results -> Advance Week -> Next Week Dashboard

Before reporting done, run:
- npm exec tsc -- --noEmit
- npm run build

When relevant, smoke-test:
- The exact reproduction steps
- New Game / Continue / Reset Save
- Dashboard
- Booking at least 2 valid segments
- Run Show
- Results
- Advance Week
- Refresh persistence
- Any screen touched by the bug

Report:
- Root cause
- What changed
- Files changed
- Verification performed
- Any known limitations
- Anything intentionally not changed

