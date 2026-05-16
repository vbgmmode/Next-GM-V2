Follow AGENTS.md.

Task: Verify the current build and playable loop.

Do not modify files unless a required verification command creates build artifacts.
Do not add features.
Do not refactor anything.
Do not fix issues in this prompt. Report them clearly instead.

Run:
- npm exec tsc -- --noEmit
- npm run build

Smoke-test when possible:
- New Game
- Continue
- Reset Save
- Dashboard
- Booking at least 2 valid segments
- Run Show
- Results
- Advance Week
- Refresh persistence
- Any recently touched screen or system

Report:
1. TypeScript status
2. Build status
3. Smoke-test status
4. Current playable loop status
5. Any failures, warnings, or suspicious behavior
6. Recommended next smallest fix if something is broken

Output only the verification report. Do not make code changes.

