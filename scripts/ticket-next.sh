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
