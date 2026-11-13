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
