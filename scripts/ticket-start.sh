#!/usr/bin/env bash
set -euo pipefail

USAGE="Usage: ticket-start.sh <issue#> <slug> [type] [--worktree]"
ISSUE="${1:?$USAGE}"; SLUG="${2:?$USAGE}"; TYPE="${3:-feat}"; MODE="${4:-}"
[ "$TYPE" = "--worktree" ] && { TYPE="feat"; MODE="--worktree"; }
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
