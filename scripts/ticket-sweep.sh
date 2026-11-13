#!/usr/bin/env bash
# ticket-sweep.sh → run ticket-cleanup.sh for every active ticket whose PR is MERGED into dev.
# Removes the local worktree/branch and the remote branch. Best-effort: never exits non-zero
# for a skipped ticket, so ticket-start.sh / ticket-next.sh can call it safely.
set -uo pipefail

MAIN="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
WT_ROOT="$(dirname "$MAIN")/$(basename "$MAIN")-worktrees"
HERE="$(git rev-parse --show-toplevel)"
command -v gh >/dev/null || { echo "sweep: gh not installed, skipping"; exit 0; }

cleaned=0
for ENV_FILE in "$MAIN/.ticket.env" "$WT_ROOT"/*/.ticket.env; do
  [ -f "$ENV_FILE" ] || continue
  # shellcheck disable=SC1090
  TICKET="" BRANCH="" TICKET_DIR=""
  source "$ENV_FILE"
  [ -n "$TICKET" ] && [ -n "$BRANCH" ] || continue

  # Never delete the folder we are standing in.
  [ "$TICKET_DIR" = "$HERE" ] && continue

  read -r STATE BASE < <(gh pr view "$BRANCH" --json state,baseRefName -q '"\(.state) \(.baseRefName)"' 2>/dev/null || echo "NONE none")
  if [ "$STATE" != "MERGED" ] || [ "$BASE" != "dev" ]; then continue; fi

  echo "sweep: #$TICKET ($BRANCH) is merged into dev, cleaning up"
  if (cd "$MAIN" && ./scripts/ticket-cleanup.sh "$TICKET"); then
    cleaned=$((cleaned + 1))
  else
    echo "sweep: ⚠️  #$TICKET skipped (see message above); run ./scripts/ticket-cleanup.sh $TICKET after fixing"
  fi
done

[ "$cleaned" -eq 0 ] && echo "sweep: nothing to clean" || echo "sweep: cleaned $cleaned ticket(s)"
exit 0
