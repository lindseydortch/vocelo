#!/usr/bin/env bash
set -euo pipefail

[ -f .ticket.env ] || { echo "❌ No .ticket.env here. You are not in a ticket folder."; exit 1; }
source .ticket.env

HERE="$(git rev-parse --show-toplevel)"
CURRENT="$(git branch --show-current)"

[ "$HERE" = "$TICKET_DIR" ] || { echo "❌ Wrong folder: in $HERE, ticket #$TICKET lives in $TICKET_DIR"; exit 1; }
[ "$CURRENT" = "$BRANCH" ]  || { echo "❌ Wrong branch: on $CURRENT, ticket #$TICKET is $BRANCH"; exit 1; }

echo "✅ Issue #$TICKET | branch $BRANCH | port $PORT | folder $TICKET_DIR"
