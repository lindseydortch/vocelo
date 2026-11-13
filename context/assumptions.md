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
| #6 | nice to know | `env` is a lazy proxy that validates on first property access, so importing `env.ts` (e.g. in tests) never throws; `parseEnv(source)` is the testable core. | open |
| #6 | nice to know | Empty strings count as unset (a blank `KEY=` line in `.env.local` is reported missing). Optional vars (`BUFFER_API_KEY`, `DEMO_FALLBACK`, `E2E_AUTH`, `SEED_ALLOWED_HOST`) are not validated beyond being strings. | open |
| #6 | nice to know | Added `!.env.example` to `.gitignore` (it matched `.env.*`) and `zod` as a dependency. | open |
| #7 | nice to know | `db:generate`/`db:migrate` load `.env.local` via `node --env-file`; `drizzle.config.ts` reads `DATABASE_URL` from `process.env` directly (drizzle-kit runs outside Vite). In Netlify's build the var comes from the platform env, so the scripts there should call `drizzle-kit migrate` directly. | open |
| #7 | nice to know | Added an empty `src/db/schema.ts` so drizzle-kit has a schema path; tables are out of scope. `db` is a lazy proxy (like `env`) so importing never connects. Server-only guard is `@tanstack/react-start/server-only`; verified a client import fails `vite build`. | open |
| #7 | nice to know | Used `casing: 'snake_case'` so schema code can use camelCase fields. | open |
| #7 | need to review | postgres.js uses `prepare: false, max: 5` because `DATABASE_URL` is the Neon pooled (pgbouncer) string. `db:migrate` also uses that same string per the ticket; if migrations misbehave through the pooler, add an unpooled `DIRECT_URL` for drizzle-kit. | open |
| #17 | nice to know | Kept one `src/db/schema.ts` (the path `drizzle.config.ts` already points to) instead of `src/db/schema/*.ts`. Migration is `0000_*` (first migration in the repo), not `0001`. | open |
| #17 | nice to know | `users.plan` and `users.subscription_status` are plain `text` (default `'free'`), not enums, since only the three listed enums were required and Stripe statuses are open-ended. Validate in code. | open |
| #17 | need to review | No embedded-postgres yet, so "applies cleanly to an empty `dev` branch" is covered by SQL/structure tests only; run `npm run db:migrate` against Neon `dev` to confirm. `reactions.persona_id` has no cascade (personas are soft-deleted). `personas.user_id` and `usage_events.user_id` cascade on user delete. | open |
