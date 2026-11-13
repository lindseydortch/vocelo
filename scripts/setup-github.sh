#!/usr/bin/env bash
# Applies branch protection to dev + main and sets repo merge options.
# Idempotent: PUT/PATCH replace settings, so re-running converges to the same state.
# Run once by the coordinator after CI (#70) has run on at least one PR, so the
# required checks exist. Usage: ./scripts/setup-github.sh
# Env: GH (gh binary, default "gh"), REPO (owner/name, default: current repo).
set -euo pipefail

GH="${GH:-gh}"
REPO="${REPO:-$("$GH" repo view --json nameWithOwner --jq .nameWithOwner)}"
BRANCHES=(dev main)

# Job names in .github/workflows/ci.yml.
PROTECTION='{
  "required_status_checks": {
    "strict": true,
    "contexts": ["typecheck", "lint", "test", "build", "e2e"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}'

echo "Repo: $REPO"

# Merge options first. allow_auto_merge is required for `gh pr merge --auto`.
"$GH" api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=true \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=true >/dev/null

for branch in "${BRANCHES[@]}"; do
  echo "$PROTECTION" | "$GH" api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null
done

echo
echo "Resulting repo settings:"
"$GH" api "repos/$REPO" --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge, allow_auto_merge}'

for branch in "${BRANCHES[@]}"; do
  echo
  echo "Resulting protection for $branch:"
  "$GH" api "repos/$REPO/branches/$branch/protection" --jq '{
    checks: .required_status_checks.contexts,
    up_to_date_required: .required_status_checks.strict,
    approvals: .required_pull_request_reviews.required_approving_review_count,
    force_pushes: .allow_force_pushes.enabled,
    deletions: .allow_deletions.enabled
  }'
done
