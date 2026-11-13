# Buffer Hackathon: "Hear Your Post" — MVP & Stretch Goals

**Concept:** Compose a post, save it as a Buffer draft, and hear it read back by different personas (voice + character) so you know how it lands from someone else's point of view.

**Scope: text-first channels only.** Vocelo is for posts where the *words* are the content.

| Channel | Status | Notes |
|---|---|---|
| LinkedIn (profiles + pages) | ✅ MVP | Primary target |
| X / Twitter | ✅ MVP | Primary target |
| Substack | ✅ MVP | **Substack Notes only.** Buffer can't publish long-form Substack posts or newsletter issues. |
| Threads, Bluesky, Mastodon | ✅ MVP (free win) | Text-first; same flow works |
| Instagram | ⏳ Stretch | "Caption mode": requires an image on every post |
| TikTok, YouTube Shorts, Pinterest, Google Business, Facebook | ❌ Out of scope | Video/visual-first or not a target audience |

**Stack:** TanStack Start (React) · SCSS/Sass modules (`*.module.scss`) · Buffer GraphQL API · ElevenLabs (text-to-speech only) · Anthropic `claude-haiku-5-5` for reactions/Tone read · Stripe · Buffer OAuth for login (verified) · Neon (Postgres) via Drizzle ORM + `postgres` (postgres.js) driver · **Netlify** hosting · Netlify Blobs (audio cache) · Cloudflare R2 (image storage, **stretch**)

**Vocabulary:** `GLOSSARY.md` (repo root) defines Post, Buffer draft, Persona, Voice avatar, Reviewed post, Usage period, Locked, etc. Use those words in code and tickets.

**Environments:** `context/environments.md` says which keys, database, Buffer client and providers each environment (local, tests, CI, production, demo) uses, where each secret lives, and the demo-day checklist.

---

## Kickoff Decisions (agreed 2026-11-12)

Output of grilling Step 0. Sections below are already updated to match.

### Scope changes
| Decision | Result |
|---|---|
| Images (old section 4b) | ⏳ **Stretch.** MVP posts are text-only; users add images in Buffer. |
| Voice-to-text (ElevenLabs Scribe + Web Speech fallback) | ⏳ **Stretch.** Per-second metering wasn't acceptable. MVP shows a "Feeling stuck?" hint suggesting Wispr Flow or OS dictation, then paste. |
| Buffer Ideas pull | ⏳ Stretch |
| Starter templates | ⏳ Stretch |
| Team tier | Shown on `/pricing` as **"Coming soon"**. Only Creator is purchasable in MVP. |
| Per-channel character limits (X: 280, etc.) | ✅ **Promoted to MVP** |
| Tone heat map | MVP is a whole-post **"Tone read."** "Tone heat map" now means the per-sentence stretch feature. |
| Pages | All 15 pages stay (no merging). |
| Custom personas | **Never cut.** The demo's upgrade trigger depends on them. |

### Product rules
- **One Vocelo post = one channel = one Buffer draft.**
- **Vocelo overwrites the Buffer draft's text on save** (last write wins). Importing a Buffer draft copies it into Vocelo once.
- **Images added in Buffer are preserved:** before `editPost`, read the draft's current assets and send them back unchanged. Drafts with images show "📎 N images, edit them in Buffer."
- **"Reviewed post"** = a post counts once per usage period, the **first time it triggers anything that costs money** (new TTS audio, incl. highlight-to-hear; a reaction; a Tone read). Cached replays, imports, and the sample post never count. *(Updated in Step 1.)*
- **Usage period** (all counters reset together):
  - Free: monthly on the signup anniversary day (signup on the 31st → resets on the last day of shorter months)
  - Paid: the Stripe billing period
  - Upgrade: counters reset; a new period starts on the payment date
  - Cancel: stays paid until period end; Free period starts that day, fresh counters

### Auth fallback
✅ **Verified 2026-11-12:** a Vocelo app client (redirect `https://localhost:3000/auth/callback`) completed the Buffer consent screen and redirected back with an authorization code. **Buffer OAuth is the login; Clerk is not needed.** Token exchange gets verified in the sign-in ticket.
- Dormant fallback, only if Buffer later disables third-party OAuth: **Clerk** handles sign-in; the user pastes a personal Buffer API key once, stored encrypted server-side like OAuth tokens. No magic links.
- Buffer rate limit (reported): 100 requests / 15 min per client. Cache channel + draft lists.

### Before build day (human tasks, not agent tickets)
1. ~~Register a Buffer app client → confirm OAuth works~~ ✅ Done 2026-11-12 (consent + redirect verified)
2. Point Namecheap nameservers to Cloudflare (24–48 h propagation). **Not blocking** (Step 2): production starts on the `netlify.app` URL
3. ~~Decide hosting + LLM provider~~ ✅ Netlify + Anthropic Haiku 5.5 (Step 1). Create the Netlify site + Anthropic API key
4. Create Stripe Creator product/price (test mode)
5. Buy ElevenLabs Starter ($6); pick 3 stock voice IDs for standard personas; create one API key per environment with a credit quota (Step 2)
6. Publish `/privacy` + `/terms` at real URLs (Buffer app client + Stripe need them)
7. Register a second Buffer app client for production (redirect `https://<site>.netlify.app/auth/callback`) (Step 2)
8. Full checklist with where each value goes: `context/environments.md`

### Ticket sizing
A ticket is ~1–2 h **including its tests**; never make tests a separate ticket. There is no ticket budget (removed in Step 2): build whatever the MVP needs. Cut order if time runs out is in section 12.

### Critical path
```
Before build day: Buffer app client test · DNS · hosting · Stripe product · ElevenLabs voices · LLM key
        ↓
Infra tickets (Step 2, before build day; scaffold merges alone) → DB schema + usage/plan module STUB (everyone = Free, no limits)
        ↓
   Lane A                 Lane B                     Lane C
   Sign-in (OAuth)        Personas + TTS             Composer editor + char limits
     ↓                    (dev API key, no auth)       + page route stubs
   Buffer drafts            ↓                          ↓
   + channels             Reactions + Tone read      Billing (Stripe) → real usage module
     ↓                      ↓                          ↓
   Versions + schedule    Custom personas            Plan gating + locked states
        └──────────────── integrate ────────────────┘
                              ↓
                         Design Pass
```
The usage/plan module stub is the seam: Lane B calls `checkUsage` / `consumeUsage` from day one, and Lane C swaps in the real implementation without touching Lane B's code.

### Dependency map (Grilling Guide areas, build order)
| Order | Area | Needs first | Parallel with |
|---|---|---|---|
| 1 | Open decisions + data model | — | — |
| 2 | Infra + repo setup | 1 | — (scaffold merges alone) |
| 3 | Buffer sign-in | 2 | Composer, Personas + playback |
| 3 | Composer | 2 | Sign-in, Personas + playback |
| 3 | Personas + playback | 2 (dev API key) | Sign-in, Composer |
| 4 | Buffer integration | Sign-in | Billing, Reactions + tone |
| 4 | Billing | Data model, Sign-in | Buffer integration, Reactions + tone |
| 4 | Reactions + tone | Personas, LLM decision | Buffer integration, Billing |
| 5 | Versions + scheduling | Buffer integration, Composer | Page wiring |
| 6 | Pages | Route stubs in 2; final wiring last | Everything |
| 7 | Design Pass | Full flow working | — |

### Open questions handed to later grilling sessions
- ~~Step 1 (data model)~~ ✅ answered; see "Step 1 Decisions" below
- ~~Step 3 (sign-in)~~ ✅ answered; see "Step 3 Decisions" below
- **Step 5 (billing):** Stripe webhook idempotency; success page loading before the webhook lands; atomic check-then-consume on usage counters
- **Step 9 (scheduling):** timezone for `dueAt` (Step 3 stores Buffer's `account.timezone` in `users.timezone`; Step 9 decides how to use it)
- **Step 10 (pages):** first-run sample post in production (seed data only exists on the `dev` branch)

---

## Step 1 Decisions: Open decisions + data model (agreed 2026-11-12)

### Open decisions closed
| Decision | Result |
|---|---|
| Hosting | **Netlify.** 60 s sync function limit (not configurable), streaming responses up to 20 MB, Netlify Blobs emulated in local dev by the TanStack Start Vite plugin. |
| LLM | **Anthropic `claude-haiku-5-5`** with schema-enforced JSON output. One server-only `llm.ts` module. |
| Design direction | Still open; decided in the Design Pass. |

### LLM output shapes
- **Reaction:** `{ reaction: string (≤ 2 sentences, ≤ 280 chars), sentiment: "positive" | "neutral" | "negative" }`
- **Tone read:** `{ label: string, sentiment: "positive" | "neutral" | "negative", summary: string (1 sentence) }`
- `sentiment` maps to `$tone-positive` / `$tone-neutral` / `$tone-negative`.
- Parse failure → retry once → "Couldn't get a reaction, try again." Failed calls consume nothing.
- Cached by (persona, text hash) for reactions and by text hash for Tone read; unchanged text is free. After an edit the panel shows "Text changed: refresh."
- Safety cap on every plan: **60 LLM calls / hour / user** (counted via `usage_events.kind = llm_call`).

### Usage rules
- **Two meters, posts first.** Free: **5 reviewed posts** + 8,000 voice characters. Creator: unlimited posts (fair use) + 80,000 characters. Whichever runs out first blocks new audio.
- **Only new audio uses voice characters.** Audio cache key = `sha256(model | voiceId | text)`, shared across users.
- **Reviewed post** = the first thing that costs money (new TTS incl. highlight-to-hear, a reaction, or a Tone read). Imports, cached replays, and the sample post never count.
- **Too big for what's left** (e.g. 800 chars needed, 500 left) → blocked, no partial read: "800 characters needed, 500 left. Highlight a shorter section or upgrade." Cached audio for posts already reviewed this period still plays.
- **Check-then-consume:** one transaction locks the user row, sums this period's `usage_events`, and inserts the new event **before** calling ElevenLabs / the LLM. On provider failure, delete the event (refund).
- **Usage period:** Free = monthly from `users.period_anchor_at` (signup; reset when a subscription ends); paid = Stripe `current_period_start/end`.
- **Effective plan** = Creator while `subscription_status` is `active`, `trialing`, or `past_due` (grace while Stripe retries). Otherwise Free.
- **Deleting a post never refunds usage:** its `usage_events` keep their rows with `post_id = NULL`.

### History, versions, personas
- History window measured from **`last_edited_at`**. Versions, reactions, and Tone reads follow their post's visibility.
- **Free "last 3 versions" = hide, never delete.** Upgrading reveals the rest; downgrade needs no migration.
- **A version is created only when "Save draft" succeeds in Buffer**, and only if the text changed. Restore loads text into the editor as unsaved; saving creates a new version (history is never rewritten).
- **Personas:** one table. Standard personas have `user_id = NULL` and are inserted by a **migration** (so production has them). Custom personas (Creator: 5) pick a voice from a hard-coded list of ~8 stock ElevenLabs voices; the user writes a "who is this reader" description that our template turns into the reaction prompt.
- **Downgrade:** custom personas become locked (hidden, not deleted); their past reactions stay visible.
- **Deleting a custom persona** = soft delete (`deleted_at`), so old reactions keep its name.
- **Free "1 persona per post":** the first persona you request a reaction from is stored in `posts.reaction_persona_id` and locked in for that post.

### Post ↔ Buffer edge cases
- **Channel locks after the first save to Buffer.** ("Duplicate to another channel" is stretch.)
- **Draft deleted in Buffer** → on save, clear `buffer_post_id`, create a new draft, show "Recreated in Buffer."
- **Draft already scheduled or sent in Buffer** → block the overwrite, offer "Save as a new draft."
- **Channel disconnected in Buffer** → post readable, saving disabled: "Channel no longer connected."
- **Import:** free, never counts as a review; unique (`user_id`, `buffer_post_id`) so each draft imports once (already-imported drafts hidden from the import list); unsupported-channel drafts hidden; over-limit text imports but "Save draft" stays blocked until it fits.
- **Deleting a post in Vocelo** deletes only Vocelo's copy (post, versions, reactions, Tone reads). The Buffer draft stays; the confirm dialog says so.

### Sample post
- Created per user on first sign-in, `is_sample = true`. Never counts toward limits, never locks, read-only (can't edit or save to Buffer), deletable. Audio, reactions, and Tone read are pre-made static files in `/public/demo/` for the 3 standard personas. "Start your own post" button beside it. (Built in the Pages step.)

### Accounts and data
- No self-serve account deletion in MVP (stretch). Disconnect deletes `buffer_connections` only; posts stay. Privacy policy: "Email support@<domain> to delete your data."

### Storage and tooling
- **Drizzle ORM** + `postgres` (postgres.js) driver, pooled Neon connection string in deployed envs (changed in Step 2); `drizzle-kit` migrations committed to the repo; UUID primary keys (post URLs are unguessable).
- **Cached audio:** Netlify Blobs, format `mp3_44100_64` (~8 KB per second of speech), served through a server function (private). Demo + sample audio are static files in `/public/demo/`.
- **No tables for** audio (Blobs), sessions (encrypted cookie), or OAuth state (short-lived cookie). Images are stretch.

### Schema
| Table | Key columns |
|---|---|
| `users` | `id`, `buffer_account_id` (unique), `email?`, `buffer_organization_id`, `timezone?` (Step 3), `plan`, `stripe_customer_id?`, `stripe_subscription_id?`, `subscription_status?`, `current_period_start/end?`, `cancel_at_period_end`, `period_anchor_at`, `created_at` |
| `buffer_connections` | `user_id` (1:1), `access_token_enc`, `refresh_token_enc`, `access_expires_at`, `scopes`, `updated_at`. Deleted on Disconnect. |
| `posts` | `id`, `user_id`, `buffer_organization_id` (Step 3), `channel_id`, `channel_service`, `channel_name`, `buffer_post_id?`, `buffer_status?` (draft / scheduled / sent), `due_at?`, `text`, `reaction_persona_id?`, `is_sample`, `created_at`, `last_edited_at`. Unique (`user_id`, `buffer_post_id`). |
| `versions` | `id`, `post_id`, `text`, `text_hash`, `created_at` |
| `personas` | `id`, `user_id?` (null = standard), `name`, `bio`, `avatar_key`, `elevenlabs_voice_id`, `reader_description`, `reaction_prompt`, `created_at`, `deleted_at?` |
| `reactions` | `id`, `post_id`, `persona_id`, `text_hash`, `reaction`, `sentiment`, `model`, `created_at`. Unique (`post_id`, `persona_id`, `text_hash`). |
| `tone_reads` | `id`, `post_id`, `text_hash`, `label`, `sentiment`, `summary`, `model`, `created_at`. Unique (`post_id`, `text_hash`). |
| `usage_events` | `id`, `user_id`, `kind` (`tts_chars` / `post_review` / `llm_call`), `amount`, `post_id?` (set null on delete), `created_at` |
| `stripe_events` | `id` (Stripe `evt_…`), `type`, `processed_at` |

### Tickets
Step 1 drafts 8 tickets (`context/tickets/01-data-model.md`). They replace the single "DB schema + usage/plan module STUB" box on the critical path.

---

## Step 2 Decisions: Infrastructure + repo setup (agreed 2026-11-12)

Per-environment details (keys, URLs, where secrets live, demo-day checklist): `context/environments.md`.

### Repo + workflow
| Decision | Result |
|---|---|
| Repo | `github.com/lindseydortch/vocelo`, **public** (free branch protection + required checks; judges get a link) |
| Ticket budget | **Removed.** Build what the MVP needs. |
| When infra runs | All Step 2 tickets run **before build day**, serially until the scaffold merges |
| Tooling defaults | npm · Node 24 (`.nvmrc` + Netlify `NODE_VERSION`) · TypeScript `strict` · Prettier (no semicolons, single quotes) · **no git hooks** (`verify` + CI cover it) |
| Who merges | **Never `git merge` locally.** Ticket agents never merge. The coordinating Claude session merges PRs into `dev` with `gh pr merge --squash` once CI is green, then runs `ticket-cleanup.sh`. The human opens + merges the single `dev` → `main` PR. No required approvals (you can't approve your own PR). |
| Branch protection | `dev` + `main`: PR required, no force pushes, required checks `typecheck`, `lint`, `test`, `build`, `e2e`, **"up to date before merging" on** (catches two lanes both generating migration `0003`) |
| Release | **One** `dev` → `main` PR on demo day, after the app works on localhost. Accepted risk: Netlify-only bugs (functions, Blobs, env, 60 s limit) surface after the demo and get fixed then. |
| Disk (≈100 GB free) | Max **3 worktrees** (~1–1.5 GB each). Playwright installs **Chromium only**. Test Postgres data lives in the OS temp folder, deleted after each run; stale folders swept at startup. Worst case ≈ 5 GB. |

### Databases
| Decision | Result |
|---|---|
| Driver | **`postgres` (postgres.js)** everywhere, not `@neondatabase/serverless`. Netlify functions are Node, so one driver talks to both Neon and plain Postgres. |
| Neon branches | `main` = production · `dev` = every local dev server (shared, seeded). **No `ci` branch.** |
| Test database | **`embedded-postgres`** (real Postgres 18 binaries from npm; **no Docker**, nothing global). Vitest `globalSetup` starts it on a free port, creates `vocelo_test_<PORT>`, runs migrations, tears down. Same in CI (no service container). Fallback if it misbehaves: Homebrew `postgresql@18` on port **5433**. Rejected: Docker (conflicts with work setup), PGlite (single connection, can't test `FOR UPDATE`), Neon branch per run (slow, needs API key everywhere). |
| Migrations | Netlify build runs `drizzle-kit migrate` before `vite build` (production context only). Migration fails → build fails → old deploy keeps serving. **Additive-only** migrations (no drops/renames) during the hackathon. |
| Seed | `npm run seed` refuses unless `DATABASE_URL`'s host equals `SEED_ALLOWED_HOST` (set only in `.env.local`). Idempotent: deletes + re-creates only seed-tagged rows. |

### Hosting + environments
| Decision | Result |
|---|---|
| Deploys | **Only `main` deploys** (production). Branch deploys **off**, deploy previews **off**. `dev` is never deployed. |
| Demo | Runs on **localhost:3000**. Production URL is for handing to judges; fixed after the demo if needed. |
| Production URL | `<site>.netlify.app` first; custom domain added as a second redirect URI once DNS is live. Cloudflare is only needed for email routing (`support@`) and stretch R2; it blocks nothing. |
| Buffer app clients | **Two.** Dev client (existing): `https://localhost:3000/auth/callback`, used locally + in the demo. Prod client: the production URL(s). Buffer raised hackathon rate limits, but separate clients still isolate quota. |
| Stripe | **Test mode everywhere**, production included (live keys = stretch). Every endpoint receives every test-mode event, so the webhook answers **200 and ignores** events for unknown customers. |
| Provider switches | `TTS_PROVIDER=browser\|elevenlabs\|fixture`, `LLM_PROVIDER=anthropic\|fixture`. Local: `browser` + `anthropic`. Tests/CI/E2E: `fixture` (+ MSW). Production + demo: `elevenlabs` + `anthropic`. |
| ElevenLabs keys | One key per environment, each with a credit quota. A separate **demo** key holds most of the budget and goes in `.env.local` only on demo day. |
| `DEMO_FALLBACK=1` | Kill switch. Forces `fixture` providers **for the sample post's text only**; everything else shows its normal error. Flip it if ElevenLabs or Anthropic fails mid-demo. |
| Local HTTPS | `@vitejs/plugin-basic-ssl` on every port. Playwright uses `https://localhost:$PORT` with `ignoreHTTPSErrors: true`. Stripe CLI forwards with `--skip-verify`. |
| Env validation | `src/server/env.ts` (zod) validates at server start and crashes listing every missing var. Provider keys required only when that provider is active. `SESSION_SECRET` / `TOKEN_ENCRYPTION_KEY` differ per environment; rotation out of scope. `.env.example` lists everything. |
| E2E sign-in helper | `/__test/login?user=free\|creator` works only when `E2E_AUTH=1` **and** `NODE_ENV !== 'production'`, else 404. The Netlify build fails if `E2E_AUTH` is set at all. E2E runs against `vite dev`. |
| Error tracking | None in MVP: Netlify function logs + structured `console.error` with a request ID. Sentry is stretch. |

### Conflicts fixed in Step 2
- `GIT_WORKFLOW.md` Playwright config used `http://`; dev server is HTTPS and cookies are `Secure` → now `https` + `ignoreHTTPSErrors`.
- `GIT_WORKFLOW.md` said the repo lives at `~/code/vocelo` → real path.
- Step 1 T1 installed `@neondatabase/serverless` → now `postgres`.
- Bible said Cloudflare DNS is needed for hosting in MVP → Netlify works without it.
- "Demo fallback mode" was ambiguous with the sample post → now the `DEMO_FALLBACK` kill switch.

### Tickets
Step 2 drafts 14 tickets + a bootstrap step (`context/tickets/02-infra.md`).

### Noted for later steps
- **Netlify Blobs in tests:** an in-memory fake behind the audio-store interface → Step 7
- **E2E sign-in helper** needs the session cookie module → drafted in Step 2 (I14), blocked by Step 3
- **Webhook ignores unknown customers** (200) → Step 5

---

## Step 3 Decisions: Buffer sign-in (agreed 2026-11-12)

### Buffer facts (developers.buffer.com, checked 2026-11-12)
- Authorize `https://auth.buffer.com/auth`, token `https://auth.buffer.com/token`. **PKCE (S256) required** for every client. Redirect URIs match character-for-character, HTTPS even on localhost, several allowed per client.
- Access token ~1 h (`expires_in`). Refresh token only with `offline_access`. **Refresh tokens are single-use; reusing an old one revokes every token for that grant.**
- **No revocation endpoint.** Users revoke apps in Buffer's settings.
- `account { id email name timezone organizations { id name ownerEmail } }`: `email` is non-null; an account can belong to **several organizations**; `channels` and `posts` need `organizationId`.
- Auth errors arrive as HTTP 401 **or** HTTP 200 with `extensions.code: "UNAUTHORIZED"` (docs disagree; handle both). Rate limit per app client: 100 + 10 per authorized user / 15 min; 429 with `retry-after` and `RATE_LIMIT_EXCEEDED`.

### Decisions
| Topic | Decision |
|---|---|
| Client type | **Confidential** (`client_secret` + PKCE). `BUFFER_CLIENT_SECRET` is required. |
| Scopes | `account:read posts:read posts:write offline_access`. After exchange, if `posts:write` or `offline_access` is missing → `/auth/error?reason=scopes`, no user created. |
| Start route | `/auth/buffer/start?returnTo=…` sets a 10-min HttpOnly SameSite=Lax state cookie (state, PKCE verifier, `returnTo`). `returnTo` must be a relative path starting `/app` or `/pricing`, else `/app`. |
| Callback | `/auth/callback` is a **server route that redirects** (no loading UI). Still counts as one of the 15 sitemap pages. |
| Callback failures | `/auth/error?reason=` `cancelled` (`access_denied`) · `timeout` (state cookie missing/expired/mismatched) · `exchange` (token call failed) · `account` (account lookup failed) · `scopes`. Each logs a request ID. **Nothing is written to the DB until the account lookup succeeds.** |
| Find-or-create | One transaction upserts `users` on `buffer_account_id` (`ON CONFLICT DO UPDATE`), refreshing email, org, timezone, and `buffer_connections` tokens on every sign-in. New users get `ensureSamplePost(userId)` (stub now, built in Step 10, idempotent). |
| Organization | Auto-pick the org the user **owns** (`ownerEmail === account.email`), else the first. Switching orgs is **stretch**. `posts.buffer_organization_id` stored now so switching later is safe. Settings shows the connected org. |
| Session | TanStack Start `useSession`, `SESSION_SECRET`, HttpOnly/Secure/SameSite=Lax, holds only the user ID. **30 days, renewed on each visit.** Every protected request loads the user + `buffer_connections`; either missing = signed out. |
| Protected routes | `/app` layout `beforeLoad` redirects to `/signin?returnTo=…`; every server function also calls `requireUser()` (never trust the route guard alone). `/signin` with a session → `/app`. |
| Account switching | Last sign-in wins: the callback replaces the session with whatever account Buffer returned. Not a feature. |
| Token storage | AES-256-GCM (Node `crypto`), `TOKEN_ENCRYPTION_KEY` (32 bytes, base64), random IV per value, stored as `v1:<iv>:<tag>:<ciphertext>`. Decrypt failure = dead token, never a 500. |
| Refresh | Only `getBufferAccessToken(userId)` refreshes: `SELECT … FOR UPDATE` on the connection row → re-check expiry after the lock → refresh when < 5 min left → 10 s timeout. |
| Buffer client | One `bufferClient` for all GraphQL calls. HTTP 401 or `UNAUTHORIZED` → force one refresh, retry once, never loop. 429 / `RATE_LIMIT_EXCEEDED` → temporary error with `retry-after`. Logs `RateLimit` headers when < 10 remain. Sign-in uses **one** GraphQL call. |
| Refresh failure | **Dead** (`invalid_grant`, revoked, decrypt failure, 401 after retry) → delete `buffer_connections`, clear session, typed `BUFFER_AUTH_EXPIRED`; page loads redirect to `/signin?reason=expired`. **Temporary** (network, 5xx, 429) → keep session, "Buffer isn't responding. Try again in a minute." Read-aloud, reactions, and Tone read keep working. |
| Lost rotation | If Buffer rotates the token but we time out before saving it, the user signs in again. Accepted; no recovery attempt. |
| Unsaved text | Server functions return typed `BUFFER_AUTH_EXPIRED` instead of redirecting. **Composer (Step 6)** shows a "Reconnect Buffer" dialog, saves editor text to `localStorage` by post ID, starts OAuth with `returnTo` = the post, and restores the text as unsaved. |
| Sign out | POST only. Clears the cookie; tokens stay. |
| Disconnect | POST only. Deletes `buffer_connections` + clears the cookie; posts, plan, personas stay. Confirm dialog: "Your Creator plan keeps billing. Cancel it in Billing first if you want to stop." and "To fully remove access, also remove Vocelo in Buffer → Settings → Connected apps." |
| Plans | Sign-in behaves the same on every tier. Plan follows `buffer_account_id`. A paid user with a dead token keeps their plan and billing; only Buffer actions stop until they sign in again. New Buffer account = new Free user; merging accounts is support-only. |
| Email | Stored and refreshed every sign-in; prefills Stripe Checkout `customer_email` (Step 5). No verification. |
| Timezone | `users.timezone` from `account.timezone`, refreshed every sign-in, nullable (browser timezone fallback). Used by Step 9. |
| Dev sign-in | `/__dev/login` works only when `BUFFER_API_KEY` is set **and** `NODE_ENV !== 'production'`, else 404. Looks up the account with the personal key, upserts the user, stores the key as the access token with no refresh token, sets the session. Lets worktree ports (3000 + N) click through Buffer features. The Netlify build fails if `BUFFER_API_KEY` is set. |

### Schema additions (additive migration)
- `users.timezone` (text, nullable)
- `posts.buffer_organization_id` (text)

### Conflicts flagged
- **Composer (Step 6):** owns the reconnect dialog + `localStorage` restore for `BUFFER_AUTH_EXPIRED`.
- **Billing (Step 5):** Disconnect never cancels Stripe; dialog says so. Checkout prefills `customer_email`.
- **Buffer integration (Step 4):** rate limit is per app client across all users; cache channel/draft lists. Posts store their org ID.
- **Pages (Step 10):** `/auth/callback` has no UI; Settings shows connected org; `ensureSamplePost` is filled in there.

### Tickets
Step 3 drafts 15 tickets (`context/tickets/03-sign-in.md`).

---

## MVP

### 1. Infrastructure
- [ ] Project scaffold: TanStack Start + `sass` package, env vars (Buffer, ElevenLabs, LLM, Stripe keys)
- [ ] Styling foundation: Sass modules per component + shared partials (`_variables.scss`, `_mixins.scss`) for colors, spacing, type
- [ ] **⚠️ REQUIRED: No visual design until the final step**
  - Build structure and function first: layout, spacing scale, `rem` sizing, breakpoints, Sass module files.
  - **No brand colors, fonts, shadows, gradients, or decorative styling** until the Design Pass (section 12).
  - All colors come from placeholder tokens in `_variables.scss` (grayscale only for now), e.g.:
    ```scss
    $color-bg: #ffffff;
    $color-surface: #f2f2f2;
    $color-border: #cccccc;
    $color-text: #111111;
    $color-text-muted: #666666;
    $color-primary: #333333;  // replaced in Design Pass
    ```
  - Components may only use tokens, never hard-coded colors, so the Design Pass is a one-file change.
  - Exception: Tone read semantic colors get placeholder tokens too (`$tone-positive`, `$tone-neutral`, `$tone-negative`).
- [ ] **⚠️ REQUIRED: `rem`-based sizing with the 62.5% root font size (1rem = 10px)**
  - In the global stylesheet (e.g. `styles/global.scss`):
    ```scss
    html {
      font-size: 62.5%; // 1rem = 10px (62.5% of the browser default 16px)
    }

    body {
      font-size: 1.6rem; // restore 16px default body text
    }
    ```
  - The 62.5% goes on **`html`**, not `body`: `rem` is always relative to the root (`html`) element.
  - Use **`rem` for everything**: font sizes, spacing, padding, margins, widths, border radius, gaps. Examples: `1.4rem` = 14px, `2.4rem` = 24px, `0.8rem` = 8px.
  - **No `px` values** except 1px borders/hairlines.
  - Gotcha: media queries ignore the `html` font size and use the browser default (16px). Write breakpoints as `em`, based on 16px, and define them once in `_variables.scss`.
  - Add this rule to `CLAUDE.md` so agents follow it in every ticket.
- [ ] **⚠️ REQUIRED: Desktop-first design**
  - Build and finish every screen for desktop first; mobile is a follow-up pass.
  - Base styles target desktop. Adapt down with **`max-width`** media queries (not `min-width`):
    ```scss
    // _variables.scss
    $bp-tablet: 64em;  // 1024px
    $bp-mobile: 48em;  // 768px

    // _mixins.scss
    @mixin tablet { @media (max-width: $bp-tablet) { @content; } }
    @mixin mobile { @media (max-width: $bp-mobile) { @content; } }

    // Component.module.scss
    .editor {
      display: grid;
      grid-template-columns: 1fr 36rem; // desktop: composer + persona panel
      @include mobile { grid-template-columns: 1fr; }
    }
    ```
  - Ticket acceptance criteria: "Works on desktop (1280px+)." Mobile gets its own ticket after the MVP flow works.
  - Even before the mobile pass, layouts must not break on small screens (no horizontal scrolling, nothing unreachable).
- [ ] **Domain + DNS (domain registered at Namecheap)**: human task, **not blocking** (Step 2). Production starts on `<site>.netlify.app`.
  - Keep the domain registered at Namecheap, but point its **nameservers to Cloudflare** (free plan). Used for email routing in MVP; required later for R2 custom domains (images are stretch).
  - In Namecheap: Domain List → Manage → Nameservers → Custom DNS → paste the 2 Cloudflare nameservers. Changes can take up to 24–48 hours, so do this first.
  - After switching, manage **all** DNS records in Cloudflare (Namecheap's DNS settings stop applying):
    - `images.<domain>` → R2 bucket custom domain (stretch, with images)
    - Root domain + `www` → hosting provider (follow its DNS instructions; some hosts want Cloudflare's proxy turned off for their records)
    - Email: Namecheap email forwarding stops working; use Cloudflare Email Routing (free) for addresses like `hello@` / `support@`
  - Fallback if DNS isn't ready in time: use the hosting provider's default URL
- [ ] Server-side API proxy via TanStack Start server functions (no keys in the browser)
- [ ] Stripe webhook as a TanStack Start server route (needs raw request body for signature verification)
- [ ] Database (Neon Postgres): users, Buffer tokens (encrypted), subscriptions, personas, versions, reactions, usage (image records are stretch)
  - Neon branches: `main` (production) and `dev` (local dev servers). Tests use `embedded-postgres`, never Neon (Step 2)
- [ ] Error handling + loading states (Buffer `MutationError`, ElevenLabs rate limits, LLM failures)
- [ ] Demo fallback kill switch: `DEMO_FALLBACK=1` forces fixture providers for the sample post's text only (Step 2)
- [ ] **⚠️ REQUIRED: Testing setup (part of the scaffold ticket, before any feature work)**
  Full rules: "Testing Requirements" in `context/GIT_WORKFLOW.md`. **No tests, no merge.**
  - **Vitest** for unit + integration tests; tests live next to code (`thing.ts` → `thing.test.ts`)
  - **Coverage thresholds** (Vitest, v8): 80% lines on `src/server/**` and `src/lib/**`; UI is covered by E2E instead
  - **MSW** mocks every external API in tests: Buffer GraphQL, Stripe, ElevenLabs, Anthropic. Tests never call real services or spend credits.
  - **Playwright** for E2E in `e2e/`; `forbidOnly` in CI
  - **Lint rules** block `.skip` / `.only` (`eslint-plugin-vitest`)
  - **`npm run verify`** = typecheck → lint → tests + coverage → build → E2E
  - **`.github/pull_request_template.md`** with a required Testing section
  - **GitHub Actions CI** with required status checks on `dev` and `main`: `typecheck`, `lint`, `test`, `build`, `e2e`. Runs on GitHub, separate from Netlify deploys.
  - **Test/CI database:** `embedded-postgres`, a throwaway database per run with Drizzle migrations applied first (never Neon; see Step 2)
  - **E2E sign-in helper:** E2E tests can't complete real Buffer OAuth (it only works on port 3000, and tests must not hit Buffer). `/__test/login?user=free|creator` sets a seeded user's session cookie; 404 unless `E2E_AUTH=1` and `NODE_ENV !== 'production'`; the Netlify build fails if `E2E_AUTH` is set (Step 2).
  - **Stripe in tests:** never drive the hosted Checkout page. Test plan changes by sending **signed fixture webhook events** to `/api/stripe/webhook` (valid signature, invalid signature, duplicate event ID for idempotency, each handled event type).
  - **Fixed clock** in tests for usage periods, history windows, and anniversary resets (e.g., Vitest fake timers or an injectable `now()`)
  - **Shared test helpers:** `createTestUser({ plan })`, `createTestPost({ lastEditedAt })`, Buffer/Stripe/ElevenLabs/Anthropic MSW handlers with success + error variants

#### What every feature area must test
| Area | Must cover |
|---|---|
| Sign-in | State mismatch rejected; `returnTo` allowlist; each `/auth/error` reason; missing scopes rejected; PKCE exchange; upsert by `buffer_account_id` (concurrent callbacks → one user); refresh rotation with the DB lock (two concurrent refreshes → one Buffer call); dead token ends session, temporary error doesn't; 401 and `UNAUTHORIZED` both retry once; sign out vs. disconnect; `/__dev/login` 404s in production |
| Buffer drafts | Create; overwrite text while **preserving existing assets**; draft deleted in Buffer → recreated; draft scheduled/sent → blocked; channel disconnected → saving disabled; import once (unique constraint); unsupported channels hidden |
| Character limits | At the limit, over by 1, per channel; over-limit import blocks saving |
| Usage + plans | Check-then-consume is atomic (concurrent requests can't overspend); refund on provider failure; "too big for what's left" blocks with no partial read; cached replays, imports, and the sample post never count; first billable action counts the post once per period; Free vs. Creator limits; effective plan for `active` / `trialing` / `past_due` / canceled |
| Usage periods | Signup on the 31st resets on the last day of shorter months; upgrade starts a new period; cancel keeps paid until period end |
| History window | `last_edited_at` at 29 / 30 / 31 days (Free) and 12 months (Creator); sample post exempt; upgrade reveals locked posts; Free sees last 3 versions only (others hidden, not deleted) |
| Billing | Webhook signature check; idempotency via `stripe_events`; success page before the webhook lands; Customer Portal link |
| Personas | Standard personas exist via migration; Creator limit of 5 custom; Free blocked; soft delete keeps old reactions' names; downgrade locks custom personas; Free "1 persona per post" locks in |
| Playback | Audio cache key hit = no ElevenLabs call and no usage; highlight-to-hear consumes only selected characters |
| Reactions + Tone read | Schema-valid JSON parsed; invalid JSON → retry once → friendly error, nothing consumed; cache by text hash; "Text changed: refresh"; 60 LLM calls / hour cap |
| Versions + scheduling | Version only on successful Buffer save + changed text; restore doesn't rewrite history; schedule with `dueAt` (timezone per Step 9) |
| Pages | E2E happy path per page; empty, loading, and limit-reached states render; protected routes redirect to sign-in |

#### E2E flows (Playwright)
1. Sign in (test helper) → sample post → hear a standard persona (static demo audio)
2. New post → pick channel → over the character limit blocks save → fix → save draft (Buffer mocked)
3. Free user hits the reviewed-posts limit → upgrade prompt → fixture webhook → Creator → create a custom persona
4. Edit + save twice → version history → restore → save creates a new version
5. Approve & schedule (Buffer mocked)
6. Free user: posts older than 30 days are locked; teaser card shows the count
- [ ] **Test data + seed script** (`npm run seed`, runs against the Neon `dev` branch, never production)
  - **Text-only post:** a realistic LinkedIn-length post (~800 characters) with a few lines that read differently by persona (e.g., one humblebrag, one unclear sentence)
  - **Imported Buffer draft with 2 images:** tests that saving from Vocelo preserves Buffer images
  - A short X-length post (under 280 characters) to test character limits
  - Seeded test user on the Free plan, plus one on Creator, to test plan gating
  - Posts backdated 45 days and 13 months, to test the history window locks
  - Pre-generated persona reactions + tone results for the sample posts (used by Playwright tests and demo fallback mode)
  - Playwright tests use the seeded data so they never call ElevenLabs or the LLM (saves credits)

### 2. Auth & Accounts
- [ ] **"Sign in with Buffer" is the only login** (no separate auth provider; every Vocelo user is a Buffer user)
  - ✅ Buffer OAuth verified working for third-party app clients (2026-11-12). Clerk fallback is dormant; see Kickoff Decisions.
  - Buffer OAuth 2.0 (Authorization Code + PKCE)
  - Register an App Client in Buffer Settings → API (redirect URIs for localhost + production)
  - Redirect URIs: `https://localhost:3000/auth/callback` (dev; Buffer requires https, so the dev server runs HTTPS via `@vitejs/plugin-basic-ssl`) and `https://<domain>/auth/callback` (production). Must match exactly, including port. Ticket worktrees run on port `3000 + issue#`, so the Buffer sign-in only completes on port 3000: test OAuth in the main folder or a port-3000 session, or register extra localhost ports.
  - Scopes: `account:read`, `posts:read`, `posts:write`, `offline_access` (add `ideas:read` with the Ideas stretch goal); missing required scopes fail sign-in
  - Confidential client (`client_secret` + PKCE S256)
  - Server route: start auth (`state` + PKCE challenge + allowlisted `returnTo`) → callback server route (verify `state`, exchange code + verifier, redirect; no UI)
  - On callback: one `account` query (id, email, name, timezone, organizations), then **upsert the Vocelo user keyed by Buffer account ID**
  - Create a Vocelo session: encrypted, HttpOnly, Secure, SameSite=Lax cookie holding only the user ID (never Buffer tokens), 30 days renewed on each visit
  - Store Buffer access + refresh tokens AES-256-GCM encrypted in the database, server-side only
  - Token refresh (~1 hr access tokens; refresh tokens are single-use and **reuse revokes everything**, so only `getBufferAccessToken` refreshes, under a row lock)
  - Dead token (refresh rejected, revoked): delete stored tokens, end the session, send them back to "Sign in with Buffer". Temporary Buffer errors never sign out.
  - Sign out (clears session) vs. Disconnect (also deletes stored Buffer tokens; Buffer has no revoke endpoint, so the dialog points to Buffer's Connected apps)
  - Protected routes: redirect to sign-in when there's no session
  - Full rules: "Step 3 Decisions"
- [ ] Stripe customer linked to the Vocelo user ID (created at first checkout)
- [ ] Dev-only fallback: personal API key in `.env.local` powers `/__dev/login` (not exposed to users; build fails if set in Netlify)
- [ ] Organization lookup → `organizationId` (needed for drafts): auto-pick the owned org, else the first; switching is stretch

### 3. Billing (Stripe)
- [ ] Stripe Products/Prices: Creator only (Team shown as "Coming soon"; see `pricing-tiers.md`)
- [ ] Pricing page → Stripe Checkout
- [ ] Stripe webhook → update user plan (subscribed, renewed, canceled, payment failed)
- [ ] Stripe Customer Portal link (manage/cancel)
- [ ] Plan stored on user record (default: Free)
- [ ] Server-side plan + usage enforcement before every TTS / reaction call
- [ ] **History window by plan** (Free: 30 days, Creator: 12 months, Team: unlimited)
  - Enforced server-side in every query that lists posts, versions, or reactions (filter by **`last_edited_at`** against the user's plan; the sample post is exempt)
  - Locked teaser card: "🔒 N posts older than 30 days. Upgrade to see them" → Stripe Checkout
  - UI note that Buffer drafts are unaffected and always remain in Buffer
  - Locked data is hidden, not deleted (upgrading unlocks it instantly)
- [ ] Posts-reviewed limit (**Free: 5** per usage period); a post counts the first time it triggers anything that costs money (see Step 1 Decisions)
- [ ] Usage tracking + counters ("6,200 of 8,000 voice characters left"), reset per **usage period** (Free: signup anniversary; paid: Stripe billing period; see Kickoff Decisions)
- [ ] Locked-feature UI + upgrade prompts
- [ ] Stripe test mode for demo (card `4242 4242 4242 4242`)

### 4. Buffer Integration
- [ ] List channels + channel picker, **filtered to supported text-first channels** (hide unsupported channels, or show them disabled with "Not supported yet")
- [ ] One Vocelo post = one channel = one Buffer draft
- [ ] Create draft — `createPost` with `saveToDraft: true`
- [ ] Load existing drafts — `posts` query (import copies the draft into Vocelo once)
- [ ] Update draft on save — `editPost` overwrites the **text** (Vocelo wins)
  - Read the draft's current assets first and send them back unchanged, so images added in Buffer survive
  - Drafts with images show "📎 N images, edit them in Buffer"

### 5. Composer
- [ ] Text editor with selection tracking
- [ ] **Per-channel character limits** (X: 280, etc.) with a live count; block saving to a channel when over its limit
- [ ] "Feeling stuck?" hint: suggest speaking the post with Wispr Flow or OS dictation, then pasting it in (no built-in voice-to-text in MVP)

### 6. Personas
- [ ] Persona model: name, bio, voice avatar (static image/icon), ElevenLabs voice ID, reaction prompt
- [ ] 3 standard personas (Free)
- [ ] Persona picker (voice avatar cards)
- [ ] Custom voice avatars — paid tiers (name, bio, pick an image/icon, pick an ElevenLabs voice). **Never cut** (demo upgrade trigger).

### 7. Playback
- [ ] Read full post in persona's voice (ElevenLabs TTS, Flash model)
- [ ] Highlight-to-hear (read selection only)
- [ ] Simple "speaking" indicator on the active voice avatar (e.g., glow or pulse — no character animation)
- [ ] Audio caching (don't regenerate unchanged text)

### 8. Analysis
- [ ] Persona reaction (LLM, 1–2 sentences), gated by plan
- [ ] **Tone read** — one tone result for the whole post (per-sentence "tone heat map" is stretch)

### 9. Versions & Publishing
- [ ] Version history: snapshot + restore (Free: last 3)
- [ ] Approve & schedule — `editPost` with `mode` + `dueAt`

### 10. Pages & Copy
**Copy is written separately.** Build every page with placeholder copy pulled from one file (e.g., `src/content/copy.ts`), so final copy can be dropped in without touching components.

#### Public pages
- [ ] **Landing page** (`/`)
  - Hero: headline, subhead, "Sign in with Buffer" CTA
  - Problem → solution ("Everyone helps you decide *what* to post. Vocelo shows you how it *lands*.")
  - How it works (3 steps: write your post → hear it from different personas → fix it, approve, schedule in Buffer)
  - Persona showcase (the 3 standard voice avatars, each with a short audio sample)
  - Supported channels (LinkedIn, X, Substack Notes, Threads, Bluesky, Mastodon)
  - Pricing section (or link to `/pricing`); Team shown as "Coming soon"
  - FAQ (incl. "Does this change my Buffer drafts?" and "What happens to my posts on Free?")
  - Footer: Privacy, Terms, contact
- [ ] **Pricing** (`/pricing`): 3 tiers, feature comparison, Creator CTA → Stripe Checkout, Team "Coming soon"
- [ ] **Privacy Policy** (`/privacy`) and **Terms** (`/terms`): needed for the Buffer OAuth app client and Stripe
- [ ] **404 / error page**

#### Auth pages
- [ ] **Sign in** (`/signin`): single "Sign in with Buffer" button + one line on what Vocelo can access
- [ ] **OAuth callback** (`/auth/callback`): server route only, redirects to `returnTo` or `/auth/error` (no UI; Step 3)
- [ ] **Auth error**: one message per `reason` (`cancelled`, `timeout`, `exchange`, `account`, `scopes`) + retry

#### App pages (signed in)
- [ ] **Posts dashboard** (`/app`): list of posts (status, channel, last edited), "New post" button, Buffer drafts to import, locked history card
- [ ] **Composer / review workspace** (`/app/posts/:id`): the main screen
  - Left: channel picker, editor, per-channel character count, "Feeling stuck?" dictation hint, save draft
  - Right: persona picker, read aloud, highlight-to-hear, reactions, Tone read
  - Version history panel (restore)
  - Approve & schedule
- [ ] **Personas** (`/app/personas`): standard personas + custom voice avatar builder (locked on Free)
- [ ] **Settings → Account** (`/app/settings`): Buffer connection status, sign out, disconnect Buffer
- [ ] **Settings → Billing** (`/app/settings/billing`): current plan, usage meters, upgrade, Stripe Customer Portal link
- [ ] **Checkout success / canceled** (Stripe return pages)

#### Shared states (every app page)
- [ ] Empty states (no posts yet, no custom personas yet, no Buffer drafts to import)
- [ ] Loading states
- [ ] Limit-reached states with upgrade prompts
- [ ] First-run welcome: point new users to the sample post (from seed data) so they hear a persona within the first minute

### 11. Demo & Pitch
- [ ] Demo script (runs on localhost:3000; checklist in `context/environments.md`): Sign in with Buffer (Free) → hit limit → Stripe upgrade → custom persona → review post → approve & schedule
- [ ] Business slide: pricing tiers + unit economics

### 12. Design Pass (LAST STEP)
Only start once the full MVP flow works end to end.
- [ ] Choose design direction and vibe
- [ ] Final color palette: replace the grayscale tokens in `_variables.scss`
  - Check text contrast (WCAG AA: 4.5:1 for body text)
  - Keep the brand color distinct from the Tone read colors
- [ ] Fonts (headings + body)
- [ ] Logo / wordmark + favicon
- [ ] Voice avatar artwork for the 3 standard personas
- [ ] Polish: hover/focus states, transitions, the "speaking" indicator
- [ ] Mobile pass (separate ticket, see desktop-first rule)

**If time runs short, cut in this order:** history window locked teaser card → speaking indicator.
**Never cut:** auth, Stripe, Buffer draft flow, custom personas.

---

## Stretch Goals

### Moved from MVP at kickoff (2026-11-12)
- [ ] **Voice-to-text:** ElevenLabs Scribe v2 Realtime → insert at cursor, browser Web Speech API fallback, single-use token endpoint (`/api/elevenlabs/token`), voice minutes per plan. Cut because per-second metering of browser streams can't be enforced cleanly server-side.
- [ ] **Images:** full spec below (Images → "Images core")
- [ ] **Pull from Buffer Ideas** — `ideas` query (requires `organizationId`); "no Ideas" empty state
- [ ] **Starter templates** (hook + story, hot take, announcement, lesson learned)
- [ ] **Team tier checkout** (Stripe product/price; MVP shows "Coming soon")

### Characters
- [ ] Illustrated characters for each persona (full character art, not just an icon)
- [ ] Character animations (talking mouth, expressions, word-by-word sync with audio)
- [ ] Character reactions that change with tone (e.g., frowning when a line reads as braggy)

### Personas
- [ ] AI-generated custom personas from an audience description
- [ ] Channel-aware persona suggestions (LinkedIn → recruiter, X → meme account)
- [ ] Brand persona pack (Team)

### Playback
- [ ] Side-by-side compare (same text, two voices; or your recorded voice vs. a persona)

### Analysis
- [ ] Tone heat map (per sentence / paragraph; MVP has the whole-post Tone read)
- [ ] "Fix it for this reader" rewrite suggestions

### Versions
- [ ] Diff view between versions

### Team Tier
- [ ] Seats, roles, shared personas
- [ ] Reviewer approvals (Buffer Team Members / Notes — experimental in API)

### Billing
- [ ] Scheduled cleanup job: delete Free users' locked posts (and their images + cached audio) after 6 months, with a warning email 2 weeks before
- [ ] Annual plans
- [ ] Free trial
- [ ] Seat-based billing for Team

### Buffer
- [ ] Save post as Idea — `createIdea`
- [ ] Instagram "caption mode" (requires an image on every post)
- [ ] Link preview cards (`linkAttachment`) for LinkedIn, Substack, Threads, Bluesky

### Images
#### Images core (was MVP section 4b)
Buffer's API has **no upload endpoint**. Images must be hosted by us at a **public, stable URL** (no sign-in, no expiring/signed URLs), because Buffer fetches the file when the post publishes.

- [ ] Image storage: **public Cloudflare R2 bucket** (S3-compatible; free egress)
  - Serve through a custom domain (e.g., `images.vocelo.<tld>`); the default `r2.dev` URL is meant for development only
  - Upload from the server with the S3 SDK (R2 credentials stay server-side)
  - Unguessable file names (UUIDs), since public URLs are viewable by anyone with the link
  - URLs must not expire
- [ ] **Compress in the browser before upload** (`browser-image-compression`; longest side ≤ 2048px; JPEG ~80%; keep PNG only if smaller)
- [ ] Server function: upload image → validate → store → return public URL
  - Validate type (JPG, PNG, GIF, WebP) by checking file contents, not the extension
  - Reject anything over 2 MB after compression
- [ ] DB image records (URL + key only, never the file)
- [ ] Composer: file picker + drag and drop; thumbnails, remove, reorder (order matters in Buffer); cap at 4 per post (X's limit)
- [ ] Save to Buffer: `createPost` / `editPost` with `assets: [{ image: { url } }]`
- [ ] Version history snapshots include image URLs
- [ ] Image fixtures in `fixtures/images/` (own photos only): normal JPG + PNG, a 5 MB+ photo, a non-image renamed to `.jpg`
- [ ] Note: a post can't have both images and a link preview card

#### Images extras
- [ ] Persona reacts to the image too (vision model: "this photo makes the post feel braggy")
- [ ] Alt text field, plus AI-generated alt text
- [ ] Persona reads the alt text aloud (accessibility check)
- [ ] Delete orphaned images from storage when a draft is deleted or an image is removed (biggest long-term storage saver)
- [ ] Cloudflare Image Transformations for in-app thumbnails (5,000 free unique transformations/month)
- [ ] Image cropping per channel aspect ratio
- [ ] Buffer templates (if the API ever exposes a list query; `createIdea` accepts a `templateId`)

### Voice
- [ ] Native Wispr Flow integration (API requires enterprise access)

---

## Appendix: Sitemap (All Pages)

### Public pages (anyone can view)
| Page | Route | Purpose |
|---|---|---|
| Landing | `/` | Pitch, how it works, persona samples, channels, pricing, FAQ, "Sign in with Buffer" |
| Pricing | `/pricing` | 3 tiers, feature comparison, upgrade buttons |
| Privacy Policy | `/privacy` | Required for Buffer OAuth app + Stripe |
| Terms of Service | `/terms` | Required for Stripe |
| 404 / Error | `*` | Page not found, or something went wrong |

### Sign-in pages
| Page | Route | Purpose |
|---|---|---|
| Sign in | `/signin` | "Sign in with Buffer" button + what Vocelo can access |
| OAuth callback | `/auth/callback` | Server route (no UI): exchanges the code, redirects to `returnTo` or `/auth/error` |
| Auth error | `/auth/error` | "Couldn't connect to Buffer" + retry |

### App pages (signed in only)
| Page | Route | Purpose | Plan notes |
|---|---|---|---|
| Posts dashboard | `/app` | All posts, new post, import Buffer drafts | Free: last 30 days visible, older posts locked |
| Composer / review | `/app/posts/new`, `/app/posts/:id` | Write, character limits, personas, read aloud, reactions, Tone read, versions, approve & schedule | Usage limits + persona limits by plan |
| Personas | `/app/personas` | Standard personas + custom voice avatar builder | Custom personas: Creator + Team |
| Account settings | `/app/settings` | Buffer connection, sign out, disconnect Buffer | |
| Billing settings | `/app/settings/billing` | Current plan, usage meters, upgrade, Stripe Customer Portal | |
| Checkout success | `/app/billing/success` | "You're on Creator!" + next step | |
| Checkout canceled | `/app/billing/canceled` | "No changes made" + back to pricing | |

### Server routes (no UI)
| Route | Purpose |
|---|---|
| `/auth/buffer/start` | Starts Buffer OAuth (state + PKCE) |
| `/api/stripe/webhook` | Stripe events → update plan |

**Total:** 5 public pages, 3 sign-in pages, 7 app pages (15 pages), plus 2 server routes.