# Assumptions Log

Decisions agents made without explicit instruction. PRs auto-merge into `dev`, so review this file instead of reviewing each PR.

**Labels**
- `need to review`: could be wrong or costly to undo. Human confirms or corrects.
- `nice to know`: low risk, FYI only.

**Status:** `open` until the human reviews; then `confirmed` or `changed (#issue)`.

| Ticket | Label | Assumption | Status |
|---|---|---|---|
| #5 | need to review | MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; used `onUnhandledFrame: 'error'` in `src/test/setup.ts` instead of the ticket's wording. | open |
| #5 | need to review | No lint script exists yet, so `verify` = typecheck → test:coverage → build. Lint must be inserted before tests when its ticket lands. | open |
| #5 | nice to know | `now()` returns a fresh `Date` copy each call so callers can't mutate the clock. | open |
| #5 | nice to know | Added `src/test/clock.ts` (`freezeTime` helper), not in the ticket's file list; the ticket asks for "a helper". | open |
| #5 | nice to know | No CI `test` job added; assumed it belongs to the CI ticket. | open |
| #152 | need to review | Resolved native blocked-by links are deleted (not just hidden); the `**Blocked by:**` body line is the surviving record. | open |
| #152 | nice to know | Workflow has no test (YAML only); verified by a local dry run that listed the stale #4 and #49 links. | open |
| #152 | nice to know | Uses `${{ github.token }}` with `issues: write`; no PAT needed. | open |
| #154 | need to review | Cleanup trigger is `ticket-sweep.sh`, run by `ticket-start.sh` and `ticket-next.sh`, not a daemon or GitHub Action (local worktrees can only be removed locally). Merged tickets stay on disk until the next start/next run. | open |
| #154 | need to review | Turned on the repo setting "Automatically delete head branches" via the API. | open |
| #10 | nice to know | Spacing scale is `$space-1`..`$space-8` (0.4rem to 6.4rem); the ticket only said "a rem spacing scale". | open |
| #10 | nice to know | Placeholder tone colors are grays; the page also sets `body { margin: 0 }` and token colors. Verified via built CSS and SSR output, not a browser (self-signed dev cert blocks the devtools browser). | open |
| #11 | nice to know | No README existed, so I created a minimal one for the Playwright install note. `verify` has no lint step yet (lint ticket not landed); E2E is last. | open |
