# Step 1 Tickets: Open decisions + data model

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 1 Decisions". Vocabulary: `GLOSSARY.md`.

**Merge order:** T1 → T2 → (T3, T4, T5, T7, T8 in parallel) → T6.
T2 changes the schema and migrations. Merge it alone before any other ticket that touches `src/db/`.

---

## T1 · `chore: Drizzle migration tooling`
**Labels:** `MVP`, `infra`, `database`
**Acceptance criteria**
- [ ] `drizzle-orm`, `drizzle-kit` and `postgres` (postgres.js) are installed, and `src/db/client.ts` exports a server-only `db` (driver changed in Step 2)
- [ ] `npm run db:generate` and `npm run db:migrate` work against the Neon `dev` branch using `DATABASE_URL`
- [ ] Importing `src/db/client.ts` from client code fails the build (server-only guard)
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** I1 scaffold + I4 env validation (Step 2), H1 Neon project.
**Files likely touched:** `package.json`, `drizzle.config.ts`, `src/db/client.ts`, `.env.example`
**Out of scope:** tables, seed script, production branch wiring.

---

## T2 · `feat: database schema`
**Labels:** `MVP`, `database`
**Acceptance criteria**
- [ ] All 9 tables from the bible's Schema table exist, with UUID primary keys and the listed unique constraints
- [ ] `usage_events.post_id` is `ON DELETE SET NULL`. Deleting a post cascades to its `versions`, `reactions` and `tone_reads`
- [ ] Enums exist for `usage_events.kind`, `sentiment` and `buffer_status`
- [ ] One generated migration is committed and applies cleanly to an empty `dev` branch
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** `users.plan` defaults to `free`. `period_anchor_at` defaults to `now()`.
**Blocked by:** T1.
**Files likely touched:** `src/db/schema/*.ts`, `drizzle/0001_*.sql`
**Out of scope:** standard persona rows (T3), query helpers, token encryption (Step 3).

---

## T3 · `feat: standard personas migration`
**Labels:** `MVP`, `database`, `personas`
**Acceptance criteria**
- [ ] A migration inserts 3 standard personas (`user_id = NULL`) with name, bio, `avatar_key`, `elevenlabs_voice_id` and `reader_description` (reaction prompts live in code, Step 8 R3)
- [ ] Running the migration twice doesn't duplicate rows (fixed UUIDs, `ON CONFLICT DO NOTHING`)
- [ ] Persona text is placeholder copy, ready to swap from `src/content/copy.ts` or the migration
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** available on every plan.
**Blocked by:** T2, H2 ElevenLabs voice IDs.
**Files likely touched:** `drizzle/0002_standard_personas.sql`
**Out of scope:** custom personas, the curated custom-voice list, avatar artwork.

---

## T4 · `feat: usage period calculator`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] `getEffectivePlan(user)` returns `creator` for status `active`, `trialing` or `past_due`, and `free` otherwise
- [ ] `getUsagePeriod(user, now)` returns `{ start, end }`: monthly from `period_anchor_at` on Free, the Stripe `current_period_start/end` on paid
- [ ] An anchor on the 31st resolves to the last day of shorter months (unit-tested: Jan 31 → Feb 28/29 → Mar 31)
- [ ] Unit tests cover Free, Creator, `past_due` and a just-ended subscription
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** this function defines what plan and period mean everywhere.
**Blocked by:** T2 (types only).
**Files likely touched:** `src/server/plan.ts`, `src/server/plan.test.ts`
**Out of scope:** Stripe webhooks that write these columns (Step 5).

---

## T5 · `feat: usage module stub`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] `src/server/usage.ts` exports `checkAndConsume(userId, { postId, kind, amount })` and `refund(eventId)` with their final signatures and result types (`{ ok: true, eventId } | { ok: false, reason, needed, remaining }`)
- [ ] The stub always returns `ok: true` and writes nothing
- [ ] JSDoc on each function states the real rules (bible → Usage rules) so callers handle `ok: false` from day one
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** everyone is unlimited until T6 lands.
**Blocked by:** T1.
**Files likely touched:** `src/server/usage.ts`
**Out of scope:** real enforcement (T6).

---

## T6 · `feat: usage limits enforcement`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] `checkAndConsume` locks the user row (`SELECT … FOR UPDATE`), sums this period's events, and inserts `tts_chars` / `post_review` / `llm_call` events in one transaction
- [ ] A post's first chargeable action in a period also inserts one `post_review` event. A Free user's 6th post is rejected with `reason: "posts"`
- [ ] A request over the remaining characters is rejected whole with `needed` and `remaining`. A 61st LLM call within an hour is rejected with `reason: "rate"`
- [ ] `refund(eventId)` deletes the event, and sample posts (`is_sample`) never consume anything
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** Free: 5 posts, 12,000 characters (raised in Step 7). Creator: unlimited posts, 80,000 characters. 60 LLM calls/hour on every plan.
**Blocked by:** T2, T4, T5.
**Files likely touched:** `src/server/usage.ts`, `src/server/usage.test.ts`
**Out of scope:** usage meters UI, upgrade prompts, Stripe.

---

## T7 · `feat: history window filter`
**Labels:** `MVP`, `billing`, `database`
**Acceptance criteria**
- [ ] `visiblePostsWhere(user)` returns a Drizzle condition: `last_edited_at` is within 30 days (Free) or 12 months (Creator), or `is_sample`
- [ ] `lockedPostCount(user)` returns how many posts fall outside the window
- [ ] `visibleVersions(user, postId)` returns the newest 3 on Free and all of them on Creator. Nothing is ever deleted
- [ ] Tests run against seeded posts dated 45 days and 13 months ago
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** Free 30 days and last 3 versions. Creator 12 months and every version.
**Blocked by:** T2, T4.
**Files likely touched:** `src/server/visibility.ts`, `src/server/visibility.test.ts`
**Out of scope:** the locked teaser card UI and the dashboard queries that use these helpers.

---

## T8 · `feat: LLM client module`
**Labels:** `MVP`, `analysis`
**Acceptance criteria**
- [ ] `src/server/llm.ts` calls Anthropic `claude-haiku-5-5` server-side only, with the key read from `ANTHROPIC_API_KEY`
- [ ] `getReaction(persona, text)` and `getToneRead(text)` return the bible's JSON shapes, enforced by a schema (Step 8 R2 hardens schemas, timeouts and error codes)
- [ ] A parse or API failure retries once, then throws a typed `LlmError`
- [ ] `LLM_PROVIDER=fixture` returns canned results from the seed fixtures (no network, used by Playwright)
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none here. Callers use `checkAndConsume` before calling.
**Blocked by:** T1 (env setup), H3 Anthropic API key.
**Files likely touched:** `src/server/llm.ts`, `src/server/llm.test.ts`, `.env.example`
**Out of scope:** prompts per persona, the reaction and Tone read UI, caching in `reactions` and `tone_reads` (Step 8).

---

## Noted for later steps (not drafted here)
- **Audio cache via Netlify Blobs** → Step 7 (Personas + playback)
- **Sample post creation on first sign-in** → Step 10 (Pages)
- **Token encryption + `buffer_connections` writes** → Step 3 (Sign-in)
- **Webhook writes to subscription columns + `stripe_events` dedupe** → Step 5 (Billing)
- **Post ↔ Buffer edge cases (recreate, scheduled block, channel lock)** → Step 4 (Buffer integration)
