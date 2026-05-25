---
name: next-gm-sandbox-to-prod
description: Promote Next GM work from the sandbox git worktree to the prod worktree. Use when the user asks to move sandbox to prod, promote to prod, ship sandbox changes, sync prod, merge sandbox into main, or finish a sandbox pass and run it on localhost:5176. Do not use for cloud deploy, backend releases, or unrelated git workflows.
---

# Next GM Sandbox → Prod

Next GM uses **two local git worktrees** of the same repo — not separate deploy environments.

| Worktree | Typical path | Branch | Dev URL | Port |
|----------|--------------|--------|---------|------|
| **Sandbox** | `Next GM V2 Sandbox` | feature branch | `http://localhost:4000/` | 4000 |
| **Prod** | `Next GM V2` | `main` | `http://localhost:5176/` | 5176 |

If paths differ on the user's machine, resolve sibling worktrees from the active repo root. Both share `origin` on GitHub (`Next-GM-V2`).

There is **no cloud prod**. Promoting means: commit sandbox → merge to `main` → pull in prod worktree → verify on port **5176**.

## Promotion modes

Before committing, pushing, opening a PR, or merging, the LLM must inspect the sandbox diff and recommend one mode. State the recommended mode and why in plain language. If the user already named a mode, follow it, but still report any risks before acting.

| Mode | Use when | Behavior |
|------|----------|----------|
| **Full Sandbox Promote** | The user intentionally wants everything tested in sandbox to become prod. This is the default for "deploy sandbox", "ship it all", or "promote sandbox" when the diff is product-focused. | Verify sandbox, stage all intended sandbox changes, commit, push, PR + squash merge, pull prod, verify on `5176`. |
| **Curated Product Promote** | The sandbox contains app improvements plus local workflow artifacts, generated reports, scratch files, or unrelated docs. | Classify the diff, stage only approved product/runtime/docs files, commit, push, PR + squash merge, pull prod, verify on `5176`. |
| **Fast Local Promote** | The user explicitly wants a local promote without GitHub. | Commit sandbox locally, merge the feature branch into the prod worktree, keep prod port `5176`, verify locally. |
| **Review Only / Decision Gate** | The user asks whether to promote, compare sandbox to prod, or assess readiness. | Do not commit or merge. Compare sandbox vs prod, run requested checks, and give a go/no-go recommendation. |

Mode recommendation rules:

- Recommend **Full Sandbox Promote** when the diff is mostly `src/**`, tests, `data/**`, accepted docs, and expected config changes.
- Recommend **Curated Product Promote** when the diff includes `.agents/**`, `.cursor/**`, PDFs, reports, scratch artifacts, local-only workflow files, or unrelated planning docs mixed with product code.
- Recommend **Fast Local Promote** only when the user explicitly asks to avoid GitHub/PR flow.
- Recommend **Review Only / Decision Gate** when the user says not to change anything, asks "should I", or asks for a comparison.
- If sandbox is behind `origin/main`, say so and recommend rebasing or merging current `origin/main` before promotion unless the user explicitly accepts the risk.

## Diff classification

Before staging files, classify changed files and show the inclusion plan when there are any "Ask" or "Usually exclude" files.

| File class | Full Sandbox Promote default | Curated Product Promote default |
|------------|------------------------------|---------------------------------|
| `src/**` app/runtime code | Include | Include if related to the sandbox pass |
| `src/**/*.test.*`, test fixtures, QA harnesses | Include | Include if they cover included app changes |
| `data/**` game data | Include | Include if intentional product data |
| `docs/ui/**`, accepted product docs, `AGENTS.md` | Include | Include if related |
| `package.json`, `package-lock.json` | Include and run install/checks as needed | Include only if dependency changes are intentional |
| `.agents/**` | Ask before including | Usually exclude unless the user wants repo-owned agent workflow changes |
| `.cursor/**`, `skills-lock.json`, local editor/tool state | Ask before including | Usually exclude |
| PDFs, generated reports, audit exports | Ask before including | Usually exclude or move to a separate docs/artifact PR |
| Prompt drafts and planning docs under `docs/codex-prompts/**` | Ask before including | Usually exclude unless explicitly accepted |
| `vite.config.ts` | Include only with port strategy awareness | Include only with port strategy awareness |

## Preflight gate

Run this before any promote mode that commits or merges:

1. `git status --short --branch`
2. `git fetch origin --prune`
3. Compare sandbox with prod: `git log --oneline --left-right --cherry-pick origin/main...HEAD --decorate`
4. Summarize changed file classes with `git diff --name-status origin/main..HEAD`
5. Recommend a promotion mode and explain why
6. If acting immediately, proceed only if the user's request already authorizes that mode; otherwise ask for confirmation

## Full Sandbox Promote flow

Use **squash merge via PR** unless the user explicitly asks for a local-only merge.

### 1. Verify sandbox

In the **sandbox** worktree:

```bash
npm exec tsc -- --noEmit
npm run build
```

Smoke the touched loop if UI/gameplay changed (Continue, Dashboard, any screen edited, Run Show if relevant).

### 2. Commit and push sandbox

```bash
cd "<sandbox-worktree>"
git status
git add -A
git commit -m "<concise why-focused message>"
git push -u origin HEAD
```

Use the current feature branch name (do not assume a fixed branch name).

If the preflight found "Ask" file classes, do not use `git add -A` until the user confirms those files should be included. For Curated Product Promote, stage explicit paths instead of `git add -A`.

### 3. Open and merge PR

```bash
gh pr create --base main --head "$(git branch --show-current)" \
  --title "<short title>" \
  --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] tsc + build
- [ ] smoke on localhost:4000
- [ ] verify on localhost:5176 after prod pull

EOF
)"
gh pr merge --squash
```

**Merge method:** Squash and merge (default).

**Delete branch after merge?** Answer **No** while the sandbox worktree is still checked out on that branch.

### 4. Update prod worktree

```bash
cd "<prod-worktree>"
git pull --no-rebase origin main
```

#### `vite.config.ts` conflict rule

The squash merge may bring sandbox port **4000** into `main`. The **prod worktree must keep port 5176**:

```ts
const PROD_DEV_PORT = 5176;
```

Resolve any merge conflict in favor of **5176** in the prod folder only. Do **not** push prod-only port overrides to `main` unless the user explicitly asks to change the shared config strategy.

Complete an in-progress merge if needed:

```bash
git add vite.config.ts
git commit -m "Merge origin/main and keep prod dev server on port 5176."
```

### 5. Start prod dev server

Kill any stale server on 5176, then:

```bash
npm run dev
```

Open **`http://localhost:5176/`** and hard refresh.

Only run `npm install` if `package.json` or `package-lock.json` changed. **Never** paste shell comments on the same line as npm commands.

### 6. Reset sandbox for the next pass (after merge)

When starting the next experiment:

```bash
cd "<sandbox-worktree>"
git fetch origin
git checkout main
git pull origin main
git checkout -b "<new-feature-branch>"
npm run dev
```

Sandbox should stay on port **4000**.

## Curated Product Promote flow

Use this when the sandbox app innovations should ship, but local artifacts should stay out of prod.

1. Run the preflight gate and classify files.
2. Tell the user the exact include/exclude groups.
3. Stage explicit approved paths. Prefer pathspecs or individual files over `git add -A`.
4. Commit with a why-focused message.
5. Push and open a PR as in Full Sandbox Promote.
6. Pull prod and verify on `http://localhost:5176/`.

Example staging shape:

```bash
git add src data docs/ui AGENTS.md package.json package-lock.json
git status --short
```

Adjust the path list to the actual accepted diff. Do not stage `.agents/**`, PDFs, `.cursor/**`, `skills-lock.json`, or prompt drafts unless the user explicitly approves them.

## Fast Local Promote flow (no PR)

Only when the user explicitly wants a local promote without GitHub:

```bash
# sandbox: commit first
cd "<sandbox-worktree>"
git add -A && git commit -m "..."

# prod: merge feature branch
cd "<prod-worktree>"
git merge "$(git -C ../Next\ GM\ V2\ Sandbox branch --show-current)"
# resolve vite.config → keep 5176 in prod folder
npm run dev
```

Prefer PR + squash for anything the user may want to review or revert.

## Gotchas (always remember)

1. **Separate saves:** `localhost:4000` and `localhost:5176` use different browser origins → different `localStorage`. Careers do not auto-copy between sandbox and prod.
2. **Divergent prod `main`:** If prod has local commits (e.g. port 5176), `git pull` may require `--no-rebase` and a merge commit. Do not run `git config` to change global pull behavior.
3. **Port already in use:** `lsof -ti :5176 | xargs kill -9` before restarting prod dev.
4. **Do not commit** unless the user asked or you are completing an explicit merge they started.
5. **Do not push** prod-only merge commits unless the user asks.
6. **Both servers:** Sandbox (4000) and prod (5176) can run simultaneously on different ports.

## Completion report

When done, report:

- Recommended mode used and why
- PR URL (if used) and merge method
- Prod commit hash after pull
- Verification run (`tsc`, `build`, URLs checked)
- Whether sandbox was repointed to `main` or left on the feature branch
- Included/excluded file classes if the promote was curated
- Any known limitation (e.g. prod ahead of origin, localStorage not shared)

## Out of scope

- Cloud hosting, CI deploy, or backend release
- Copying localStorage saves between ports
- Changing sandbox/prod port strategy without an explicit ticket
- Broad refactors unrelated to the promote
