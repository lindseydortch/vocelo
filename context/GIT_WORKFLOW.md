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
- Work in the main folder `~/Documents/personal-dev/buffer-commit/vocelo`.
- One ticket branch checked out at a time. To switch: commit (or `git stash`), then `git switch <branch>`.
- Start with `./scripts/ticket-start.sh 12 stripe-checkout feat`

### Mode B: Parallel, one worktree per issue
Use this when working on several tickets at once, or when running more than one agent.

**Folder layout:**
```
~/Documents/personal-dev/buffer-commit/vocelo/                         ← main folder: stays on `dev`, NO ticket work happens here
~/Documents/personal-dev/buffer-commit/vocelo-worktrees/
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

## Human Tickets + Blockers

### `human` label
- Anything only the human can do (accounts, dashboards, payments, API keys, clicking through real OAuth) is its **own ticket** labeled `human`. Drafts: `context/tickets/00-human.md`.
- Never put a human step inside an agent ticket. Split it out and list it under **Blocked by** so the agent ticket can't start until it's done.
- Agents never start, work on, or close a `human` ticket. The human closes it with `gh issue close <N> --reason completed`.

### Blocked by
- Every ticket lists its blockers **twice**: a `**Blocked by:** #3, #7` line in the body (readable) **and** native GitHub links (`gh issue create --blocked-by 3,7` / `gh issue edit <N> --add-blocked-by 3,7`), which show the "Blocked" badge on GitHub. The scripts read both and use the union.
- A blocker is **resolved** only when:
  - **Agent ticket:** closed as *completed* **and** its branch (`<type>/<N>-<slug>`) was merged by PR into `dev` (or `main` for hotfixes). Closing an issue by hand does not count.
  - **`human` ticket:** closed as *completed*.
- A blocker closed as *not planned* or *duplicate* still blocks. If the dependency really went away, the human removes the link (`gh issue edit <N> --remove-blocked-by <B>`) and edits the body line.
- **Auto-clear:** `.github/workflows/clear-resolved-blockers.yml` removes a native blocked-by link once its blocker is resolved (same rule as above), so the "Blocked" badge clears on its own. It runs when an issue closes, when a PR merges into `dev`/`main`, or by hand (Actions → Run workflow). The `**Blocked by:**` body line stays, so `ticket-next.sh` is unaffected. Issue-closed events only fire from the default branch, so until this reaches `main` only the PR-merge trigger and manual run work.
- **Never start a ticket with an unresolved blocker.** `ticket-start.sh` refuses it. There is no override.

### What can I work on?
```bash
./scripts/ticket-next.sh
```
Prints four lists: **Ready** (agent tickets with nothing blocking and no branch yet), **In progress** (branch exists), **Your queue** (open `human` tickets, the ones that unblock the most work first), and **Blocked** (each ticket with the blocker(s) holding it and why).

---

## Ticket Lifecycle

### 0. Pick a ticket
Run `./scripts/ticket-next.sh` and pick only from **Ready**. Do your **Your queue** items first when they unblock things.

### 1. Start
```bash
# Mode A (solo)
./scripts/ticket-start.sh 12 stripe-checkout feat

# Mode B (parallel), run from ~/Documents/personal-dev/buffer-commit/vocelo
./scripts/ticket-start.sh 12 stripe-checkout feat --worktree
cd ~/Documents/personal-dev/buffer-commit/vocelo-worktrees/12-stripe-checkout
```
The script first runs `ticket-next.sh --check <issue>` and **stops** if the issue is closed, labeled `human`, or has an unresolved blocker. Then it creates the branch from the latest `dev`, pushes it, and writes `.ticket.env` with this issue's **branch, folder, port** (`3000 + issue #`) and **browser profile**.

### 2. Before every work session (humans and agents)
```bash
./scripts/ticket-check.sh
```
This confirms you're in the right folder, on the right branch, for the right issue. **If it fails, stop and fix it before touching anything.**

### 3. Work
- Run the dev server on the ticket's port: `npm run dev:ticket`
- **Write tests alongside the code, not after** (see [Testing Requirements](#testing-requirements))
- Before opening a PR, run the full local check: `npm run verify`
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
- Fill in the PR template's **Testing** section (what's tested, how to verify manually).
- **CI must pass. GitHub blocks the merge otherwise** (required status checks): typecheck → lint → unit + integration tests with coverage → build → Playwright E2E.
- **No tests, no merge.** A PR that adds or changes behavior without tests gets sent back, even if CI is green.
- **Merging (never `git merge` locally; merges only happen on GitHub):**
  - **Ticket PRs into `dev` auto-merge.** After opening the PR, the ticket agent runs `gh pr merge <PR#> --auto --squash`. GitHub squash-merges it as soon as required checks pass. Nobody merges ticket PRs by hand.
  - Agents never merge any other way (no `git merge`, no `gh pr merge` without `--auto`).
  - The **only manual merge** is the final `dev` → `main` release PR, done by the human.
  - Cleanup is automatic: GitHub deletes the remote branch at merge, and `scripts/ticket-sweep.sh` (run by `ticket-start.sh` and `ticket-next.sh`) removes the local worktree and branch of every ticket whose PR merged into `dev`. Run `./scripts/ticket-sweep.sh` by hand to clean immediately.
  - If `dev` moved and the PR isn't up to date, rebase the ticket branch (`git rebase origin/dev` in its worktree), push with `--force-with-lease`, and let CI rerun.

---

## Testing Requirements

### Every ticket ships with tests
| Ticket changes... | Required tests |
|---|---|
| Logic: utilities, plan limits, usage counters, prompt builders, data mapping | **Unit tests** (Vitest) |
| Server functions/routes: Buffer, Stripe, ElevenLabs, LLM, R2, database | **Integration tests** (Vitest + mocked external APIs) |
| A user-facing flow or page | **E2E test** (Playwright): at least the happy path |
| A bug fix | A **regression test** that fails before the fix and passes after |
| Styling only / docs / config | No new tests required (CI must still pass) |

### Minimum per ticket
- **Happy path** + **at least one failure case** (e.g., Buffer returns an error, plan limit reached, invalid upload)
- **Plan behavior:** if the ticket behaves differently by plan, test Free and at least one paid plan
- Every acceptance criterion in the ticket maps to at least one test

### Rules
- **Tests never call real external services.** Mock Buffer, Stripe, ElevenLabs, the LLM, and R2 with MSW (unhandled requests fail the test).
- **Tests never touch Neon.** Vitest runs against `embedded-postgres` (a throwaway database per run) and builds data with the test factories. `npm run seed` is only for the Neon `dev` branch you click around in.
- **Stripe webhooks:** test with signed fixture events (valid signature, invalid signature, each event type handled).
- **No skipped or focused tests:** `.skip` and `.only` fail lint.
- **No flaky tests:** a test that fails intermittently gets fixed or removed in the same PR, never ignored.
- **Coverage thresholds** (enforced in CI by Vitest): **80% lines** for `src/server/` and `src/lib/` (logic). UI components aren't held to a percentage; they're covered by E2E tests.
- Tests live next to the code: `thing.ts` → `thing.test.ts`. E2E tests live in `e2e/`.

### Definition of Done
- [ ] Acceptance criteria met
- [ ] Tests written per the table above, mapped to acceptance criteria
- [ ] `npm run verify` passes locally
- [ ] CI green
- [ ] PR template filled in, including the Testing section
- [ ] Works on desktop (1280px+)

### 5. Clean up (after the PR is merged)
```bash
# Run from the MAIN folder (~/Documents/personal-dev/buffer-commit/vocelo), passing the issue number
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
- **Hackathon plan: one release PR**, opened and merged by the human on demo day after the app works on localhost. `main` is the only branch Netlify deploys.
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
- Stripe CLI: `stripe listen --skip-verify --forward-to https://localhost:$PORT/api/stripe/webhook`

---

## Scripts

### `scripts/ticket-start.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

USAGE="Usage: ticket-start.sh <issue#> <slug> [type] [--worktree]"
ISSUE="${1:?$USAGE}"; SLUG="${2:?$USAGE}"; TYPE="${3:-feat}"; MODE="${4:-}"
[ "$TYPE" = "--worktree" ] && { TYPE="feat"; MODE="--worktree"; }
[[ "$ISSUE" =~ ^[0-9]+$ ]] || { echo "❌ Issue must be a number: $ISSUE"; exit 1; }
[[ "$TYPE" =~ ^[a-z]+$ ]] || { echo "❌ Type must be lowercase letters (feat, chore, fix): $TYPE"; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "❌ Slug must be kebab-case: $SLUG"; exit 1; }
BRANCH="$TYPE/$ISSUE-$SLUG"
REPO_ROOT="$(git rev-parse --show-toplevel)"
PORT=$((3000 + ISSUE % 1000))

# Refuse closed issues, human tickets, and tickets with unresolved blockers. No override.
"$REPO_ROOT/scripts/ticket-next.sh" --check "$ISSUE"

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

### `scripts/ticket-next.sh`
```bash
#!/usr/bin/env bash
# ticket-next.sh             → Ready / In progress / Your queue / Blocked
# ticket-next.sh --check <N> → exit 1 if #N is closed, human, or blocked (ticket-start.sh runs this)
set -euo pipefail

ISSUES=$(gh issue list --state all --limit 1000 \
  --json number,title,state,stateReason,labels,body,blockedBy)
MERGED=$(gh pr list --state merged --limit 1000 --json headRefName,baseRefName \
  --jq '[.[] | select(.baseRefName == "dev" or .baseRefName == "main") | .headRefName]')
BRANCHES=$(git ls-remote --heads origin | sed 's#.*refs/heads/##' | jq -R . | jq -s .)

# One row per open issue. Blockers = native links ∪ "**Blocked by:** #…" line in the body.
# Resolved: human ticket closed as completed; agent ticket closed as completed AND its
# branch <type>/<N>-<slug> merged into dev/main. Everything else is listed with the reason.
REPORT=$(jq --argjson merged "$MERGED" --argjson branches "$BRANCHES" '
  def human: any(.labels[]; .name == "human");
  def branch_for($n): first($branches[] | select(test("^[a-z]+/\($n)-"))) // null;
  (map({key: (.number|tostring), value: .}) | from_entries) as $by
  | map(select(.state == "OPEN"))
  | map(. as $i
      | ( [.blockedBy.nodes[].number]
          + ([(.body // "") | split("\n")[] | select(test("^\\*\\*Blocked by:\\*\\*"; "i"))
              | [scan("#([0-9]+)")[0] | tonumber]] | add // []) )
      | unique
      | map(. as $b | $by[$b|tostring] as $x
          | if $x == null then {n:$b, why:"not found"}
            elif $x.state == "OPEN" then {n:$b, why:"open"}
            elif $x.stateReason != "COMPLETED" then {n:$b, why:"closed as \($x.stateReason), not completed"}
            elif ($x|human) then empty
            elif any($merged[]; test("^[a-z]+/\($b)-")) then empty
            else {n:$b, why:"closed, but no merged PR"} end)
      | {number:$i.number, title:$i.title, human:($i|human),
         branch: branch_for($i.number), unresolved: .})
' <<<"$ISSUES")

if [ "${1:-}" = "--check" ]; then
  N="${2:?Usage: ticket-next.sh --check <issue#>}"
  ROW=$(jq --argjson n "$N" '.[] | select(.number == $n)' <<<"$REPORT")
  [ -n "$ROW" ] || { echo "❌ #$N is not an open issue."; exit 1; }
  [ "$(jq .human <<<"$ROW")" = "false" ] || {
    echo "❌ #$N is a human ticket. Only the human works it; agents never start it."; exit 1; }
  if [ "$(jq '.unresolved | length' <<<"$ROW")" != "0" ]; then
    echo "❌ #$N is blocked. Do not start any work on it until these are resolved:"
    jq -r '.unresolved[] | "   #\(.n): \(.why)"' <<<"$ROW"
    exit 1
  fi
  echo "✅ #$N has no unresolved blockers."
  exit 0
fi

echo "✅ Ready (agent tickets, nothing blocking):"
jq -r '.[] | select((.human|not) and (.unresolved|length == 0) and .branch == null)
  | "   #\(.number) \(.title)"' <<<"$REPORT"
echo; echo "🔨 In progress (branch exists):"
jq -r '.[] | select(.branch != null) | "   #\(.number) \(.title) · \(.branch)"' <<<"$REPORT"
echo; echo "🙋 Your queue (human tickets, most-unblocking first):"
jq -r '. as $all | map(select(.human))
  | map(. as $h | .blocks = ([$all[] | select(any(.unresolved[]; .n == $h.number))] | length))
  | sort_by(-.blocks) | .[]
  | "   #\(.number) \(.title) · unblocks \(.blocks)"
    + (if (.unresolved|length) > 0 then " · waiting on " + ([.unresolved[].n | "#\(.)"] | join(", ")) else "" end)' <<<"$REPORT"
echo; echo "⛔ Blocked (do not start):"
jq -r '.[] | select((.human|not) and (.unresolved|length > 0))
  | "   #\(.number) \(.title) ← " + ([.unresolved[] | "#\(.n) \(.why)"] | join(", "))' <<<"$REPORT"
```
Requires `jq` (ships with macOS 15+).

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
    "dev:ticket": "set -a && . ./.ticket.env && set +a && vite dev --port $PORT",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "verify": "npm run typecheck && npm run lint && npm run test:coverage && npm run build && npm run test:e2e"
  }
}
```

### `vitest.config.ts` (relevant part)
```ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/server/**', 'src/lib/**'],
      thresholds: { lines: 80 },  // CI fails below this
    },
  },
});
```

### Lint rule: block `.skip` / `.only`
Use `eslint-plugin-vitest` (`no-focused-tests`, `no-disabled-tests`) and Playwright's `forbidOnly: !!process.env.CI` in `playwright.config.ts`.

### `.github/pull_request_template.md`
```md
## What & why
Closes #

## Testing
- [ ] Unit tests: <!-- what's covered -->
- [ ] Integration tests (external APIs mocked): <!-- what's covered -->
- [ ] E2E (Playwright): <!-- which flow -->
- [ ] Failure case(s) tested: <!-- which -->
- [ ] Plan behavior tested (Free + paid), if applicable
- [ ] `npm run verify` passes locally

**How to verify manually:**
1.

## Notes
<!-- Work noticed that belongs to another issue goes here -->
```

### `playwright.config.ts` (relevant part)
```ts
const port = process.env.PORT ?? '3000';
export default defineConfig({
  forbidOnly: !!process.env.CI,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }], // Chromium only (disk)
  use: {
    baseURL: `https://localhost:${port}`, // dev server is HTTPS (basic-ssl); session cookies are Secure
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: `E2E_AUTH=1 TTS_PROVIDER=fixture LLM_PROVIDER=fixture vite dev --port ${port}`,
    url: `https://localhost:${port}`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## One-Time Setup

### GitHub repo settings
- [ ] Default branch: **`dev`**
- [ ] Branch protection on `main` and `dev`: require a PR (**0 required approvals**: you can't approve your own PR), block force pushes, and **require these status checks to pass before merging**: `typecheck`, `lint`, `test` (with coverage), `build`, `e2e`
- [ ] "Require branches to be up to date before merging" (tests run against the latest `dev`)
- [ ] Merge buttons: allow **squash** (tickets) and **merge commit** (releases)
- [ ] Turn on **"Allow auto-merge"** (ticket PRs into `dev` merge themselves once checks pass)
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
- [ ] Jobs, each a **required status check**: `typecheck` → `lint` → `test` (unit + integration + coverage thresholds) → `build` → `e2e` (Playwright)
- [ ] CI uses mocked external APIs (MSW), fixture providers, and `embedded-postgres`; **no secrets needed in CI**
- [ ] Upload the Playwright report as an artifact when E2E fails (for debugging)
- [ ] Test tooling set up in ticket #1 (repo scaffold): Vitest, coverage, MSW, Playwright, lint rules, PR template

### Environments
- **Only `main` deploys** (production, Stripe **test** keys during the hackathon). Branch deploys and deploy previews are **off**; `dev` is never deployed.
- Secrets live only in `.env.local` and Netlify environment variables, never in Git
- Full per-environment matrix: `context/environments.md`

---

## Rules for AI Agents (paste into `CLAUDE.md`)
```md
## Git workflow (MANDATORY)
- One issue = one branch = one folder = one port = one browser profile = one agent.
- You are assigned exactly ONE issue. Only work on that issue.
- Never start, work on, or close an issue labeled `human`. If your ticket turns out to need a human step,
  STOP and report it so the human can split it into a `human` ticket that blocks yours.
- Never start an issue with an unresolved blocker (`./scripts/ticket-next.sh --check <N>` fails).
  Do not work around it, partially implement it, or stub the blocker's code. Report and wait.
- Starting a ticket: when you're given an issue number (e.g. `/implement #12`) and no `.ticket.env` exists
  for it, start it yourself with `./scripts/ticket-start.sh <N> <slug> <type>`. Run it from the main folder.
  `<type>` is the title prefix before the colon (`feat`, `chore`, `fix`); `<slug>` is 2–4 kebab-case words from the rest of the title
  (letters, digits, hyphens only). If the main folder already has an active `.ticket.env`, add `--worktree`
  and do all work in the folder it prints. If the script refuses (blocked, human, closed), STOP and report.
- BEFORE editing, committing, running servers, or opening browsers, run `./scripts/ticket-check.sh`.
  If it fails, STOP and report. Do not try to fix it by switching branches or folders.
- Never run `git switch`, `git checkout <branch>`, or `git worktree add/remove` yourself (only `ticket-start.sh` does).
- Never edit files outside your ticket folder (`TICKET_DIR` in `.ticket.env`).
  Never edit the main repo folder when assigned a worktree.
- Only use the `PORT` and `BROWSER_PROFILE` from `.ticket.env`.
  Never touch another issue's branch, port, browser, or folder.
- If you notice work that belongs to a different issue, write it down in the PR description; do not do it.
- Use Conventional Commits that reference the issue number.
- Every ticket ships with tests per "Testing Requirements": happy path + at least one failure case,
  mapped to acceptance criteria. Never call real external APIs in tests. Never use `.skip` or `.only`.
- Run `npm run verify` and make it pass before opening a PR. Never weaken a test or lower a
  coverage threshold to make CI pass.
- Open one PR into `dev` with "Closes #<issue>" and the Testing section filled in, then enable auto-merge:
  `gh pr merge <PR#> --auto --squash`. Never merge any other way. Never run `git merge`.
- Log assumptions in `context/assumptions.md` (see CLAUDE.md).
- Never run cleanup yourself; `ticket-sweep.sh` does it automatically after the PR merges.
```

---

## Hackathon-Day Extras
- **Limit parallel work to 3 worktrees max.** More than that is hard to review and burns CPU, RAM, and disk (~1–1.5 GB each; ~100 GB free on this machine). Cleanup deletes the worktree including `node_modules`.
- **Coordinate shared files.** If two issues both change the database schema, shared styles (`_variables.scss`), or config, merge one before starting the other.
- **Code freeze:** stop merging into `dev` about an hour before the demo. The demo runs on localhost:3000 from `dev`. Release `dev` to `main` (one PR) so judges get a URL; fix production-only bugs after.
- **Tag the demo build** (`v0.1.0-demo`) so you can always roll back to a known-good version.