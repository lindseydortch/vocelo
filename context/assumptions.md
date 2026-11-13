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
