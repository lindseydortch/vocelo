# Step 2 Tickets: Infrastructure + repo setup

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 2 Decisions"; per-environment values in `context/environments.md`. All of these run **before build day**.

**Merge order:**
```
B (bootstrap, no PR)
  → I1 scaffold (merges alone)
  → I2, I3, I5, I7 (parallel, max 3 worktrees at once) → I4 env validation
  → Step 1 T1 (Drizzle tooling) → I6 test DB harness
  → I8 CI → I9 branch protection → I10 Netlify
After Step 1 T2/T3: I11 seed runner → I12 seed data · I13 test factories
After Step 3 session ticket: I14 E2E sign-in helper
```
Config-only tickets need no new tests (per GIT_WORKFLOW), but `npm run verify` must pass for whatever exists so far.

---

## B · Bootstrap (coordinator, not a ticket)
Branch protection doesn't exist yet, so the coordinating session does this directly. Ticket scripts need `dev` and the scripts themselves.
- [ ] Create `dev` from `main`, push it, set it as the GitHub default branch
- [ ] Commit `scripts/ticket-start.sh`, `ticket-check.sh`, `ticket-cleanup.sh` from `GIT_WORKFLOW.md` (executable)
- [ ] Commit `.gitignore` (from `GIT_WORKFLOW.md`, plus `node_modules/`, `dist/`, `.netlify/`, `coverage/`) and `.github/pull_request_template.md`
- [ ] Paste "Rules for AI Agents" from `GIT_WORKFLOW.md` into `CLAUDE.md`
- [ ] Create GitHub Issues from the Step 1 + Step 2 drafts

---

## I1 · `chore: TanStack Start scaffold`
**Labels:** `MVP`, `infra`
**Acceptance criteria**
- [ ] TanStack Start (React, TypeScript `strict`) app with one placeholder `/` route; npm; `.nvmrc` = 24 and `engines.node`
- [ ] Dev server is HTTPS via `@vitejs/plugin-basic-ssl`; `npm run dev` (port 3000) and `npm run dev:ticket` (`$PORT` from `.ticket.env`) both work
- [ ] Prettier config: no semicolons, single quotes; `npm run format` and `format:check`
- [ ] `npm run typecheck`, `npm run build`, and `npm run verify` (typecheck → build for now) pass
- [ ] Works on desktop 1280px+: placeholder page renders

**Plan behavior:** none.
**Dependencies:** B.
**Files likely touched:** `package.json`, `vite.config.ts`, `tsconfig.json`, `.nvmrc`, `.prettierrc`, `src/routes/__root.tsx`, `src/routes/index.tsx`
**Out of scope:** lint, styles, tests, env validation, Netlify plugin, every other page.

---

## I2 · `chore: ESLint config`
**Labels:** `MVP`, `infra`
**Acceptance criteria**
- [ ] ESLint flat config with `typescript-eslint`, React hooks rules, and Prettier compatibility
- [ ] `eslint-plugin-vitest` `no-focused-tests` + `no-disabled-tests` are errors (a sample `.only` fails lint)
- [ ] `npm run lint` passes on the scaffold and is added to `verify` after `typecheck`
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** I1.
**Files likely touched:** `eslint.config.js`, `package.json`
**Out of scope:** Stylelint, git hooks (decided: none).

---

## I3 · `chore: Sass foundation`
**Labels:** `MVP`, `infra`, `design-system`
**Acceptance criteria**
- [ ] `sass` installed; `src/styles/global.scss` sets `html { font-size: 62.5% }` and `body { font-size: 1.6rem }`, loaded by the root route
- [ ] `_variables.scss` has the grayscale placeholder tokens, `$tone-positive/neutral/negative`, a `rem` spacing scale, and `em` breakpoints (`$bp-tablet: 64em`, `$bp-mobile: 48em`)
- [ ] `_mixins.scss` has `tablet` and `mobile` (`max-width`) mixins; the placeholder page uses one `*.module.scss` that consumes a token and a mixin
- [ ] Works on desktop 1280px+: placeholder page has no horizontal scroll at 1280px or 375px

**Plan behavior:** none.
**Dependencies:** I1.
**Files likely touched:** `src/styles/global.scss`, `src/styles/_variables.scss`, `src/styles/_mixins.scss`, `src/routes/index.module.scss`
**Out of scope:** brand colors, fonts, any visual design (Design Pass).

---

## I4 · `chore: env validation`
**Labels:** `MVP`, `infra`
**Acceptance criteria**
- [ ] `src/server/env.ts` parses `process.env` with zod and exports a typed, server-only `env`; a missing variable throws one error listing **every** missing name
- [ ] Provider keys are conditional: `ELEVENLABS_API_KEY` only when `TTS_PROVIDER=elevenlabs`, `ANTHROPIC_API_KEY` only when `LLM_PROVIDER=anthropic`
- [ ] `.env.example` lists every variable from `context/environments.md` with dummy values
- [ ] Unit tests: valid env, several missing vars, each provider switch
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** I1, I5.
**Files likely touched:** `src/server/env.ts`, `src/server/env.test.ts`, `.env.example`
**Out of scope:** the `E2E_AUTH` production guard (I10), secret rotation.

---

## I5 · `chore: Vitest setup`
**Labels:** `MVP`, `infra`, `testing`
**Acceptance criteria**
- [ ] Vitest with v8 coverage, 80% lines on `src/server/**` + `src/lib/**`; passes with zero covered files; `npm test`, `test:watch`, `test:coverage`, added to `verify` after lint
- [ ] MSW node server in the shared setup file with `onUnhandledRequest: 'error'` (any real network call fails the test)
- [ ] `src/lib/clock.ts` exports an injectable `now()`; a helper sets a fixed time in tests
- [ ] One sample unit test for `clock.ts` passes
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** I1.
**Files likely touched:** `vitest.config.ts`, `src/test/setup.ts`, `src/test/msw.ts`, `src/lib/clock.ts`, `src/lib/clock.test.ts`
**Out of scope:** database (I6), provider handlers (added by each integration ticket), factories (I13).

---

## I6 · `chore: embedded Postgres test harness`
**Labels:** `MVP`, `infra`, `testing`, `database`
**Acceptance criteria**
- [ ] `embedded-postgres` starts in Vitest `globalSetup` on a free port, creates `vocelo_test_<PORT>`, runs Drizzle migrations, and exposes the URL to tests; **no Docker**
- [ ] Data dir lives in the OS temp folder and is deleted on teardown; stale `vocelo-pg-*` dirs older than 1 h are swept at startup
- [ ] Two worktrees can run `npm test` at the same time without colliding (tested with two different `PORT`s)
- [ ] A sample integration test opens two connections and proves `SELECT … FOR UPDATE` blocks the second
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** I5, Step 1 T1.
**Files likely touched:** `src/test/global-setup.ts`, `src/test/db.ts`, `vitest.config.ts`, `package.json`
**Out of scope:** factories (I13), seed data (I12). Fallback if the package misbehaves: Homebrew `postgresql@18` on port 5433 (note in the PR, don't switch silently).

---

## I7 · `chore: Playwright setup`
**Labels:** `MVP`, `infra`, `testing`
**Acceptance criteria**
- [ ] `playwright.config.ts` matches `GIT_WORKFLOW.md`: `https://localhost:$PORT`, `ignoreHTTPSErrors`, Chromium only, `forbidOnly` in CI, `webServer` sets `E2E_AUTH=1` + fixture providers
- [ ] `npx playwright install chromium` documented in the README (Chromium only, for disk)
- [ ] One smoke test in `e2e/` loads `/` over HTTPS and passes; `npm run test:e2e` is the last step of `verify`
- [ ] Works on desktop 1280px+: smoke test uses a 1280px viewport

**Plan behavior:** none.
**Dependencies:** I1.
**Files likely touched:** `playwright.config.ts`, `e2e/smoke.spec.ts`, `package.json`, `README.md`
**Out of scope:** the sign-in helper (I14), feature flows.

---

## I8 · `chore: GitHub Actions CI`
**Labels:** `MVP`, `infra`, `ci`
**Acceptance criteria**
- [ ] `.github/workflows/ci.yml` runs on PRs into `dev` and `main`; Node from `.nvmrc`; npm cache
- [ ] Jobs named exactly `typecheck`, `lint`, `test` (with coverage, embedded Postgres), `build`, `e2e`; the first three run in parallel, then `build`, then `e2e`
- [ ] Fixture providers via env; **no repository secrets** needed
- [ ] Playwright report uploaded as an artifact when `e2e` fails
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** I2, I5, I6, I7.
**Files likely touched:** `.github/workflows/ci.yml`
**Out of scope:** deploys (Netlify builds `main` itself), branch protection (I9).

---

## I9 · `chore: branch protection script`
**Labels:** `MVP`, `infra`, `ci`
**Acceptance criteria**
- [ ] `scripts/setup-github.sh` uses `gh api` to protect `dev` and `main`: PR required, **0 approvals**, no force pushes, required checks `typecheck` `lint` `test` `build` `e2e`, "up to date before merging" on
- [ ] It also sets repo merge options: squash + merge commit allowed, rebase off, auto-delete head branches on
- [ ] Re-running it is safe (idempotent); it prints the resulting settings
- [ ] Run once by the coordinator after I8 has run on at least one PR (checks must exist to be required)
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** I8.
**Files likely touched:** `scripts/setup-github.sh`
**Out of scope:** Netlify settings.

---

## I10 · `chore: Netlify deploy config`
**Labels:** `MVP`, `infra`, `hosting`
**Acceptance criteria**
- [ ] `@netlify/vite-plugin-tanstack-start` added; `netlify.toml` sets `NODE_VERSION` and the build command
- [ ] Production build runs `drizzle-kit migrate` then `vite build`; a failed migration fails the build
- [ ] `scripts/check-build-env.ts` fails the build if `E2E_AUTH` is set; unit-tested (set → exit 1, unset → exit 0)
- [ ] README lists the Netlify UI settings: production branch `main`, branch deploys off, deploy previews off
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** I4, Step 1 T1.
**Files likely touched:** `netlify.toml`, `vite.config.ts`, `package.json`, `scripts/check-build-env.ts`, `scripts/check-build-env.test.ts`
**Out of scope:** creating the Netlify site + env vars (human), custom domain, the release PR.

---

## I11 · `chore: seed runner`
**Labels:** `MVP`, `infra`, `database`
**Acceptance criteria**
- [ ] `npm run seed` refuses (exit 1, clear message) unless `DATABASE_URL`'s host equals `SEED_ALLOWED_HOST`
- [ ] Seed rows are tagged; re-running deletes and re-creates only seed rows (idempotent, real users untouched)
- [ ] Seeds a **Free** user and a **Creator** user (`subscription_status = active`, period dates set)
- [ ] Integration tests (embedded Postgres): guard refuses a wrong host; two runs give the same row counts
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** seeds one user per purchasable plan.
**Dependencies:** Step 1 T2, I6.
**Files likely touched:** `scripts/seed/index.ts`, `scripts/seed/guard.ts`, `scripts/seed/*.test.ts`, `package.json`
**Out of scope:** posts, reactions, fixtures (I12).

---

## I12 · `chore: seed data`
**Labels:** `MVP`, `infra`, `database`
**Acceptance criteria**
- [ ] Posts: ~800-char LinkedIn post (one humblebrag line, one unclear sentence), an X post under 280 chars, an imported Buffer draft with 2 image assets
- [ ] Backdated posts: `last_edited_at` 45 days and 13 months ago, for both seed users
- [ ] Pre-generated reactions + Tone reads for the seeded posts, stored as JSON fixtures that `LLM_PROVIDER=fixture` (Step 1 T8) reads
- [ ] Integration test: after seeding, the Free user has 1 post locked at 45 days and the Creator user has 1 at 13 months (via Step 1 T7 helpers if merged, raw query otherwise)
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** Free user's 45-day post is locked; Creator's is visible; Creator's 13-month post is locked.
**Dependencies:** I11, Step 1 T3.
**Files likely touched:** `scripts/seed/posts.ts`, `fixtures/llm/*.json`
**Out of scope:** the per-user sample post (Step 10), static demo audio in `/public/demo/` (Step 7/10).

---

## I13 · `chore: test factories`
**Labels:** `MVP`, `infra`, `testing`
**Acceptance criteria**
- [ ] `createTestUser({ plan, subscriptionStatus?, periodAnchorAt? })` covers Free, Creator `active` / `trialing` / `past_due` / `canceled`
- [ ] `createTestPost({ user, lastEditedAt?, isSample?, channelService? })` with sensible defaults
- [ ] Factories write to the embedded Postgres database and are reset between test files
- [ ] Unit tests for each factory's defaults and overrides
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** factories can build every effective-plan state.
**Dependencies:** Step 1 T2, I6.
**Files likely touched:** `src/test/factories.ts`, `src/test/factories.test.ts`
**Out of scope:** MSW handlers per provider (each integration ticket adds its own success + error variants to `src/test/handlers/`).

---

## I14 · `feat: E2E sign-in helper`
**Labels:** `MVP`, `infra`, `testing`, `auth`
**Acceptance criteria**
- [ ] `/__test/login?user=free|creator` creates or reuses that seeded user and sets the real session cookie, then redirects to `/app`
- [ ] Returns 404 unless `E2E_AUTH=1` **and** `NODE_ENV !== 'production'` (integration-tested both ways)
- [ ] A Playwright helper `signInAs('free' | 'creator')` uses it
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** signs in as either plan.
**Dependencies:** Step 3 session cookie ticket, I7, I13. (Build-time guard is in I10.)
**Files likely touched:** `src/routes/__test/login.ts`, `e2e/helpers/auth.ts`
**Out of scope:** real Buffer OAuth.
