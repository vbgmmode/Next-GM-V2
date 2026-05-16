Follow AGENTS.md.

Task: Inspect the completed work from the latest feature slice and produce a post-feature report.

Do not modify files.
Do not add features.
Do not refactor anything.

Inspect:
- Git diff and changed files
- Any touched game state or persistence code
- Any touched simulation code
- Any touched UI screens
- Any docs changed by the feature

Run:
- npm exec tsc -- --noEmit
- npm run build

When relevant, smoke-test:
- New Game / Continue / Reset Save
- Dashboard
- Booking at least 2 valid segments
- Run Show
- Results
- Advance Week
- Refresh persistence
- Any screen touched by the feature

Report:
1. Feature summary
Describe what the completed slice adds or changes from the player's perspective.

2. Files changed
List the relevant files and what each one now does.

3. Gameplay impact
Explain how the slice affects agency, consequences, booking, roster pressure, social reaction, finance, championships, rivalries, calendar, or season flow.

4. State and persistence impact
Describe any GameState changes, localStorage migration concerns, or save compatibility risks.

5. Verification performed
Include TypeScript, build, and smoke-test results.

6. Known limitations
List anything incomplete, intentionally simplified, or risky.

7. Recommended next smallest useful slice
Choose one next slice only, and explain why briefly.

Output only the report. Do not make code changes.

