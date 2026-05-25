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

## Default promote flow (recommended)

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

## Fast local path (no PR)

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

- PR URL (if used) and merge method
- Prod commit hash after pull
- Verification run (`tsc`, `build`, URLs checked)
- Whether sandbox was repointed to `main` or left on the feature branch
- Any known limitation (e.g. prod ahead of origin, localStorage not shared)

## Out of scope

- Cloud hosting, CI deploy, or backend release
- Copying localStorage saves between ports
- Changing sandbox/prod port strategy without an explicit ticket
- Broad refactors unrelated to the promote
