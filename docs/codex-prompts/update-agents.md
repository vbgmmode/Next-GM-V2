Follow AGENTS.md.

Task: Review the current project state and update AGENTS.md only if the agent instructions are now stale.

Do not modify game code.
Do not add features.
Do not refactor anything.
Do not rewrite AGENTS.md from scratch.

Use the current repo as the source of truth. Inspect:
- Current implemented screens and systems
- Current playable loop
- Current tech stack
- Recent docs that describe direction or scope
- Any package/config changes that affect implementation rules

Update only sections that are inaccurate, incomplete, or stale:
- Product identity
- Current tech stack
- Current game features
- Core playable loop
- Current phase
- Current priority
- Scope rules
- Testing expectations

Preserve:
- Product tone and identity
- Offline-first single-player direction
- Scope discipline
- Existing constraints unless the repo clearly proves they changed

Acceptance tests:
- AGENTS.md accurately describes the current repo.
- No game code is changed.
- No new product scope is added unless it reflects already-completed work.
- The instructions remain concise and useful for future Codex tickets.

Before reporting done, run:
- npm exec tsc -- --noEmit
- npm run build

Report:
- What changed in AGENTS.md
- Why the update was needed
- Files changed
- Verification performed
- Anything intentionally not changed

