Follow AGENTS.md.

Task: Perform one bounded refactor without changing behavior.

Refactor target:
[Name the file, component, function, or small area to refactor.]

Reason:
[Explain why this refactor is useful now.]

Scope:
- [Specific included cleanup 1]
- [Specific included cleanup 2]
- [Specific included cleanup 3]

Out of scope:
- Do not change player-facing behavior.
- Do not change simulation outcomes.
- Do not change persistence shape unless explicitly listed in Scope.
- Do not redesign UI.
- Do not add features.
- Do not refactor unrelated files.

Behavior preservation requirements:
- Existing screens should render the same.
- Existing flows should work the same.
- Existing save data should continue to load.
- Existing deterministic outcomes should remain stable unless this ticket explicitly allows otherwise.

Acceptance tests:
- [Concrete behavior that must still work]
- [Concrete regression check]
- The core playable loop still works:
  New Game -> Dashboard -> Booking -> Run Show -> Results -> Advance Week -> Next Week Dashboard

Before reporting done, run:
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
- Any screen touched by the refactor

Report:
- What changed
- Why behavior should be unchanged
- Files changed
- Verification performed
- Any known limitations
- Anything intentionally not refactored

