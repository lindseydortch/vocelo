# Vocelo Git Workflow

> ## 🚨 The Golden Rule
> **One issue = one branch = one folder = one port = one browser profile = one agent.**
>
> - Every issue gets its **own branch**, created from `dev`.
> - When working in parallel, every issue gets its **own worktree folder**.
> - Never work on two issues in the same folder. Never point two agents at the same folder.
> - Never switch branches inside a worktree. A worktree belongs to exactly one issue for its whole life.
> - Every agent verifies **where it is and what branch it's on** before editing, committing, or running anything.

---

## Branches

| Branch | Purpose | Rules |
|---|---|---|
| `main` | Production | Protected. Only receives PRs from `dev` (releases) or `hotfix/*`. Deploys to production. |
| `dev` | Integration | Protected. **Set as the GitHub default branch.** All ticket branches start here and merge back here. |
| `<type>/<issue>-<slug>` | One branch per ticket | Created from `dev`, squash-merged into `dev`, then deleted. |

**Branch types:** `feat/`, `fix/`, `chore/`, `docs/`, `hotfix/` (hotfix only branches from `main`).
**Example:** `feat/12-stripe-checkout`

---

## Two Ways to Work

### Mode A: Solo, one ticket at a time (simplest)
- Work in the main folder `~/code/vocelo`.
- One ticket branch checked out at a time. To switch: commit (or `git stash`), then `git switch <branch>`.
- Start with `./scripts/ticket-start.sh 12 stripe-checkout feat`

### Mode B: Parallel, one worktree per issue
Use this when working on several tickets at once, or when running more than one agent.

**Folder layout:**
```
~/code/vocelo/                         ← main folder: stays on `dev`, NO ticket work happens here
~/code/vocelo-worktrees/
    12-stripe-checkout/                ← issue #12 only (branch feat/12-stripe-checkout)
    15-persona-picker/                 ← issue #15 only (branch feat/15-persona-picker)
```

- Start with `./scripts/ticket-start.sh 12 stripe-checkout feat --worktree` (run from the main folder).
- Worktrees live **outside** the repo folder, so dev servers, TypeScript, and file watchers don't pick up the other copies.
- Each worktree gets its own `.env.local` (copied automatically), its own `node_modules` (installed automatically), its own port, and its own browser profile.
- Git won't let the same branch be checked out in two worktrees. If you see that error, **stop**. Something is pointed at the wrong issue.

### Worktree pitfalls this workflow prevents
| What goes wrong | How this workflow prevents it |
|---|---|
| Agent edits files in the main folder instead of its worktree | Main folder stays on `dev`; agents must verify `pwd` against `.ticket.env` |
| Agent runs `git switch` and drags a worktree onto another issue | Rule: never switch branches inside a worktree |
| Missing `.env.local` or `node_modules`, so the app won't start | Start script copies env and installs dependencies |
| Two dev servers or Chrome instances fight over the same port or profile | Each issue gets its own port and browser profile |
| Leftover worktrees and branches pile up | Cleanup removes the worktree, branch, browsers, and processes |

---

## Ticket Lifecycle

### 1. Start
```bash
# Mode A (solo)
./scripts/ticket-start.sh 12 stripe-checkout feat

# Mode B (parallel), run from ~/code/vocelo
./scripts/ticket-start.sh 12 stripe-checkout feat --worktree
cd ~/code/vocelo-worktrees/12-stripe-checkout
```
The script creates the branch from the latest `dev`, pushes it, and writes `.ticket.env` with this issue's **branch, folder, port** (`3000 + issue #`) and **browser profile**.

### 2. Before every work session (humans and agents)
```bash
./scripts/ticket-check.sh
```
This confirms you're in the right folder, on the right branch, for the right issue. **If it fails, stop and fix it before touching anything.**

### 3. Work
- Run the dev server on the ticket's port: `npm run dev:ticket`
- Commit small and often using [Conventional Commits](https://www.conventionalcommits.org):
  `feat(billing): add Stripe checkout session (#12)`
- Keep up to date with `dev` before opening a PR:
  ```bash
  git fetch origin && git rebase origin/dev
  git push --force-with-lease
  ```

### 4. Open a PR into `dev`
- Title: `feat: Stripe checkout (#12)`
- Body includes `Closes #12`. This auto-closes the issue **only if `dev` is the default branch.**
- One PR per issue. Never combine issues in a PR.
- CI must pass (typecheck, lint, build, Playwright).
- Review it yourself, then **squash merge.**

### 5. Clean up (after the PR is merged)
```bash
# Run from the MAIN folder (~/code/vocelo), passing the issue number
./scripts/ticket-cleanup.sh 12
```
This:
1. **Verifies the branch is fully merged into `dev`, remotely and locally** (aborts otherwise):
   - The PR is merged, and it was merged into `dev` (not `main` or another branch)
   - Your local branch matches exactly what was merged (no unpushed or post-merge commits)
   - `origin/dev` on GitHub contains the merge
   - Your local `dev` is updated and contains the merge
2. Refuses to continue if the ticket folder has uncommitted changes
3. Stops this issue's dev server, Stripe listener, and any process running from its folder
4. Closes **only this issue's** Chrome / Playwright browsers, leaving other issues' browsers alone
5. **Deletes the worktree folder entirely** (Mode B), including its `node_modules`, `.env.local`, `.ticket.env`, and browser profile, then confirms Git no longer lists it. In Mode A, it switches back to `dev` instead.
6. Deletes the branch locally **and** on GitHub, then prunes stale references

### 6. Release (`dev` to `main`)
- Open a PR from `dev` into `main` titled `release: vX.Y.Z`
- Merge with a **merge commit** (not squash)
- Tag it: `git tag vX.Y.Z && git push origin vX.Y.Z`

### Hotfixes
Branch `hotfix/<issue>-<slug>` from `main`, open a PR into `main`, then **merge `main` back into `dev`** so the fix isn't lost.

---

## Browser and Port Isolation
The conflicts come from two issues sharing a **port** or a **Chrome profile**. To prevent that:
- Dev server: always on `$PORT` from `.ticket.env`
- Playwright tests: `baseURL` reads `$PORT` (see config below)
- Browser tools (Playwright MCP, Chrome DevTools MCP, manual Chrome): launch with
  `--user-data-dir="$BROWSER_PROFILE"` so cleanup can close exactly that browser
- Stripe CLI: `stripe listen --forward-to localhost:$PORT/api/stripe/webhook`

---

## Scripts

### `scripts/ticket-start.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

USAGE="Usage: ticket-start.sh <issue#> <slug> [type] [--worktree]"
ISSUE="${1:?$USAGE}"; SLUG="${2:?$USAGE}"; TYPE="${3:-feat}"; MODE="${4:-}"
[ "$TYPE" = "--worktree" ] && { TYPE="feat"; MODE="--worktree"; }
BRANCH="$TYPE/$ISSUE-$SLUG"
REPO_ROOT="$(git rev-parse --show-toplevel)"
PORT=$((3000 + ISSUE % 1000))

git -C "$REPO_ROOT" fetch origin

if [ "$MODE" = "--worktree" ]; then
  WT_ROOT="$(dirname "$REPO_ROOT")/$(basename "$REPO_ROOT")-worktrees"
  DIR="$WT_ROOT/$ISSUE-$SLUG"
  [ -e "$DIR" ] && { echo "❌ $DIR already exists."; exit 1; }
  mkdir -p "$WT_ROOT"
  git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$DIR" origin/dev
  cp "$REPO_ROOT"/.env.local "$DIR"/ 2>/dev/null || echo "⚠️  No .env.local to copy"
  (cd "$DIR" && npm install)
else
  DIR="$REPO_ROOT"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ Uncommitted changes. Commit or stash first."; exit 1
  fi
  [ -f .ticket.env ] && { echo "❌ A ticket is already active here. Clean it up first."; exit 1; }
  git switch dev && git pull --ff-only origin dev
  git switch -c "$BRANCH"
fi

PROFILE="$DIR/.browser-profiles/ticket-$ISSUE"
mkdir -p "$PROFILE"
cat > "$DIR/.ticket.env" <<EOF
TICKET=$ISSUE
BRANCH=$BRANCH
TICKET_DIR=$DIR
PORT=$PORT
BROWSER_PROFILE=$PROFILE
MODE=${MODE:---solo}
EOF

git -C "$DIR" push -u origin "$BRANCH"
echo "✅ Issue #$ISSUE → $BRANCH"
echo "   Folder:  $DIR"
echo "   Port:    $PORT"
echo "   Browser: $PROFILE"
```

### `scripts/ticket-check.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

[ -f .ticket.env ] || { echo "❌ No .ticket.env here. You are not in a ticket folder."; exit 1; }
source .ticket.env

HERE="$(git rev-parse --show-toplevel)"
CURRENT="$(git branch --show-current)"

[ "$HERE" = "$TICKET_DIR" ] || { echo "❌ Wrong folder: in $HERE, ticket #$TICKET lives in $TICKET_DIR"; exit 1; }
[ "$CURRENT" = "$BRANCH" ]  || { echo "❌ Wrong branch: on $CURRENT, ticket #$TICKET is $BRANCH"; exit 1; }

echo "✅ Issue #$TICKET | branch $BRANCH | port $PORT | folder $TICKET_DIR"
```

### `scripts/ticket-cleanup.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

ISSUE="${1:?Usage: ticket-cleanup.sh <issue#>  (run from the main repo folder)}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
WT_ROOT="$(dirname "$REPO_ROOT")/$(basename "$REPO_ROOT")-worktrees"

# Find this issue's .ticket.env (worktree first, then main folder)
ENV_FILE="$(ls "$WT_ROOT"/"$ISSUE"-*/.ticket.env 2>/dev/null | head -n1 || true)"
[ -z "$ENV_FILE" ] && [ -f "$REPO_ROOT/.ticket.env" ] && ENV_FILE="$REPO_ROOT/.ticket.env"
[ -n "$ENV_FILE" ] || { echo "❌ No .ticket.env found for issue #$ISSUE"; exit 1; }
source "$ENV_FILE"
[ "$TICKET" = "$ISSUE" ] || { echo "❌ .ticket.env is for #$TICKET, not #$ISSUE"; exit 1; }

# ---------------------------------------------------------------------------
# Verify the work is fully merged into dev, REMOTELY and LOCALLY,
# before anything gets deleted.
# ---------------------------------------------------------------------------
echo "🔍 Verifying $BRANCH is merged into dev"
STATE=$(gh pr view "$BRANCH" --json state -q .state 2>/dev/null || echo "NONE")
[ "$STATE" = "MERGED" ] || { echo "❌ PR for $BRANCH is '$STATE', not MERGED. Aborting."; exit 1; }

BASE=$(gh pr view "$BRANCH" --json baseRefName -q .baseRefName)
[ "$BASE" = "dev" ] || { echo "❌ PR was merged into '$BASE', not 'dev'. Aborting."; exit 1; }

MERGE_SHA=$(gh pr view "$BRANCH" --json mergeCommit -q .mergeCommit.oid)
PR_HEAD_SHA=$(gh pr view "$BRANCH" --json headRefOid -q .headRefOid)
LOCAL_SHA=$(git -C "$REPO_ROOT" rev-parse "$BRANCH")

# 1. No local commits that never made it into the PR
[ "$LOCAL_SHA" = "$PR_HEAD_SHA" ] || {
  echo "❌ Local $BRANCH ($LOCAL_SHA) doesn't match what was merged ($PR_HEAD_SHA)."
  echo "   You have unpushed or post-merge commits. Open a follow-up PR first."; exit 1; }

# 2. Remote dev contains the merge
git -C "$REPO_ROOT" fetch origin
git -C "$REPO_ROOT" merge-base --is-ancestor "$MERGE_SHA" origin/dev || {
  echo "❌ origin/dev does not contain merge $MERGE_SHA. Aborting."; exit 1; }
echo "   ✅ Merged into origin/dev"

# 3. Local dev is updated and contains the merge
if [ "$(git -C "$REPO_ROOT" branch --show-current)" = "dev" ]; then
  git -C "$REPO_ROOT" pull --ff-only origin dev
else
  git -C "$REPO_ROOT" fetch origin dev:dev   # fast-forward local dev without checking it out
fi
git -C "$REPO_ROOT" merge-base --is-ancestor "$MERGE_SHA" dev || {
  echo "❌ Local dev does not contain merge $MERGE_SHA (local dev may have diverged). Aborting."; exit 1; }
echo "   ✅ Merged into local dev"

if [ -n "$(git -C "$TICKET_DIR" status --porcelain)" ]; then
  echo "❌ Uncommitted changes in $TICKET_DIR. Review them before cleanup."; exit 1
fi

echo "🧹 Stopping processes for issue #$TICKET (port $PORT)"
lsof -ti tcp:"$PORT" | xargs kill 2>/dev/null || true
pkill -f "forward-to localhost:$PORT" 2>/dev/null || true
pkill -f -- "$BROWSER_PROFILE" 2>/dev/null || true
if [ "$MODE" = "--worktree" ]; then
  pkill -f -- "$TICKET_DIR" 2>/dev/null || true
else
  pkill -f -- "$TICKET_DIR/node_modules/.*playwright" 2>/dev/null || true
fi
sleep 1

echo "🧹 Removing workspace"
if [ "$MODE" = "--worktree" ]; then
  git -C "$REPO_ROOT" worktree remove --force "$TICKET_DIR"
  [ -d "$TICKET_DIR" ] && rm -rf "$TICKET_DIR"   # fallback if anything was left behind
  git -C "$REPO_ROOT" worktree prune
  if git -C "$REPO_ROOT" worktree list | grep -q -- "$TICKET_DIR"; then
    echo "❌ Worktree still registered: $TICKET_DIR"; exit 1
  fi
  echo "   Worktree removed: $TICKET_DIR"
else
  rm -rf "$BROWSER_PROFILE" "$REPO_ROOT/.ticket.env"
  git -C "$REPO_ROOT" switch dev
fi

echo "🧹 Deleting branch $BRANCH"
git -C "$REPO_ROOT" branch -D "$BRANCH"   # safe: merge verified above (squash merges need -D)
git -C "$REPO_ROOT" push origin --delete "$BRANCH" 2>/dev/null || echo "(remote branch already deleted)"
git -C "$REPO_ROOT" fetch --prune

echo "✅ Issue #$TICKET cleaned up."
```

Make them executable: `chmod +x scripts/*.sh`. Requires the GitHub CLI (`gh auth login`).

**Useful commands:**
- `git worktree list` shows every active worktree and its branch
- `git worktree prune` clears references to worktrees whose folders were deleted manually

### `package.json` scripts
```json
{
  "scripts": {
    "dev:ticket": "set -a && . ./.ticket.env && set +a && vite dev --port $PORT"
  }
}
```

### `playwright.config.ts` (relevant part)
```ts
const port = process.env.PORT ?? '3000';
export default defineConfig({
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `vite dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
  },
});
```

---

## One-Time Setup

### GitHub repo settings
- [ ] Default branch: **`dev`**
- [ ] Branch protection on `main` and `dev`: require a PR and passing status checks, block force pushes
- [ ] Merge buttons: allow **squash** (tickets) and **merge commit** (releases)
- [ ] Turn on "Automatically delete head branches" (cleanup handles it either way)

### `.gitignore`
```
.env
.env.*
.ticket.env
.browser-profiles/
playwright-report/
test-results/
```

### CI (GitHub Actions on PRs to `dev` and `main`)
- [ ] Typecheck → Lint → Build → Playwright tests

### Environments
- `dev` deploys to a **preview/staging** URL (Stripe **test** keys)
- `main` deploys to **production**
- Secrets live only in `.env.local` and your host's environment variables, never in Git

---

## Rules for AI Agents (paste into `CLAUDE.md`)
```md
## Git workflow (MANDATORY)
- One issue = one branch = one folder = one port = one browser profile = one agent.
- You are assigned exactly ONE issue. Only work on that issue.
- BEFORE editing, committing, running servers, or opening browsers, run `./scripts/ticket-check.sh`.
  If it fails, STOP and report. Do not try to fix it by switching branches or folders.
- Never run `git switch`, `git checkout <branch>`, or `git worktree add/remove` yourself.
- Never edit files outside your ticket folder (`TICKET_DIR` in `.ticket.env`).
  Never edit the main repo folder when assigned a worktree.
- Only use the `PORT` and `BROWSER_PROFILE` from `.ticket.env`.
  Never touch another issue's branch, port, browser, or folder.
- If you notice work that belongs to a different issue, write it down in the PR description; do not do it.
- Use Conventional Commits that reference the issue number.
- Open one PR into `dev` with "Closes #<issue>". Never merge your own PR.
- Never run cleanup; the human runs `./scripts/ticket-cleanup.sh <issue>` after merge.
```

---

## Hackathon-Day Extras
- **Limit parallel work to 2–3 worktrees.** More than that is hard to review and burns CPU and RAM (each one has its own dev server and browser).
- **Coordinate shared files.** If two issues both change the database schema, shared styles (`_variables.scss`), or config, merge one before starting the other.
- **Code freeze:** stop merging into `dev` about an hour before the demo. Release `dev` to `main`, then only hotfix.
- **Tag the demo build** (`v0.1.0-demo`) so you can always roll back to a known-good version.
