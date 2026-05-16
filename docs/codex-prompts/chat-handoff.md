Follow AGENTS.md.

Task: Create a concise handoff report for continuing this project in a new ChatGPT chat.

Do not modify files.
Do not add features.
Do not refactor anything.

Report:

1. Current project state
- Current phase
- Current implemented features
- Current tech stack
- Current core playable loop

2. Latest completed work
- What was just implemented
- Files changed
- Verification performed
- Known limitations
- Anything intentionally not implemented

3. Current repo status
Run:
- git status --short
- npm exec tsc -- --noEmit
- npm run build

Summarize:
- clean or dirty worktree
- modified/untracked files
- whether typecheck/build pass

4. Where to pick up next
Recommend exactly one next bounded slice.

Include:
- why this is the next safest slice
- what should not be added yet
- whether AGENTS.md needs updating

5. Ready-to-paste next Codex prompt
Write the exact next Codex prompt for the recommended slice.

The prompt should:
- start with “Follow AGENTS.md.”
- have a clear task
- have requirements
- have “Do not build” scope limits
- have acceptance tests
- include AGENTS.md update instructions if relevant
- have a stop condition

6. New ChatGPT transition summary
Write a concise block I can paste into a new ChatGPT chat so it knows where to continue.

Include:
- product identity
- implemented systems
- latest completed work
- current repo status
- recommended next slice
- the ready-to-paste Codex prompt location or full prompt

Output only the handoff report.
Do not make code changes.
