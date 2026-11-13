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
- **Images added in Buffer are preserved:** `editPost` sends only `id` + `text`; omitted assets are kept by Buffer (Step 4). Drafts with attachments show "📎 N attachments, edit them in Buffer."
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
- ~~Register a Buffer app client → confirm OAuth works~~ ✅ Done 2026-11-12 (consent + redirect verified)
- Everything else is a `human` ticket: **`context/tickets/00-human.md`** (H1–H9). Where each value goes: `context/environments.md`.

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
     ↓                    (/__dev/login + requireUser)  + page route stubs
   Buffer drafts            ↓                          ↓
   + channels             Reactions + Tone read      Billing (Stripe) → real usage module
     ↓                      ↓                          ↓
   Versions + schedule    Custom personas            Plan gating + locked states
        └──────────────── integrate ────────────────┘
                              ↓
                         Design Pass
```
The usage/plan module stub is the seam: Lane B calls `checkAndConsume` / `refund` (T5) from day one, and Lane C swaps in the real implementation without touching Lane B's code.

### Dependency map (Grilling Guide areas, build order)
| Order | Area | Needs first | Parallel with |
|---|---|---|---|
| 1 | Open decisions + data model | — | — |
| 2 | Infra + repo setup | 1 | — (scaffold merges alone) |
| 3 | Buffer sign-in | 2 | Composer, Personas + playback |
| 3 | Composer | 2 | Sign-in, Personas + playback |
| 3 | Personas + playback | 2 (`/__dev/login`) | Sign-in, Composer |
| 4 | Buffer integration | Sign-in | Billing, Reactions + tone |
| 4 | Billing | Data model, Sign-in | Buffer integration, Reactions + tone |
| 4 | Reactions + tone | Personas, LLM decision | Buffer integration, Billing |
| 5 | Versions + scheduling | Buffer integration, Composer | Page wiring |
| 6 | Pages | Route stubs (G1) right after the scaffold; final wiring last | Everything |
| 7 | Design Pass | Full flow working | — |

### Open questions handed to later grilling sessions
- ~~Step 1 (data model)~~ ✅ answered; see "Step 1 Decisions" below
- ~~Step 3 (sign-in)~~ ✅ answered; see "Step 3 Decisions" below
- ~~**Step 9 (scheduling)**~~ ✅ answered; see "Step 9 Decisions" below
- ~~**Step 10 (pages)**~~ ✅ answered; see "Step 10 Decisions" below (sample post is inserted by `ensureSamplePost` from code, no seed data)

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
- **Tone read:** `{ label: ToneLabel, summary: string (1 sentence) }`. `label` comes from a fixed list of 10; our code maps each label to a sentiment (Step 8). Stored rows keep `sentiment`.
- `sentiment` maps to `$tone-positive` / `$tone-neutral` / `$tone-negative`.
- Parse failure → retry once → "Couldn't get a reaction, try again." Failed calls consume nothing.
- Cached by (persona, channel, text hash) for reactions and by (channel, text hash) for Tone read (channel added in Step 8); unchanged text is free. After an edit the panel shows "Text changed: refresh."
- Safety cap on every plan: **60 LLM calls / hour / user** (counted via `usage_events.kind = llm_call`).

### Usage rules
- **Two meters, posts first.** Free: **5 reviewed posts** + 12,000 voice characters (raised from 8,000 in Step 7). Creator: unlimited posts (fair use) + 80,000 characters. Whichever runs out first blocks new audio.
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
- **A version is created only when "Save draft" succeeds in Buffer**, and only if the text changed. Restore loads text into the editor; it autosaves to Vocelo (no version) and shows "Changes not in Buffer yet"; saving creates a new version (history is never rewritten). *(Updated in Step 6.)*
- **Personas:** one table. Standard personas have `user_id = NULL` and are inserted by a **migration** (so production has them). Custom personas (Creator: 5) pick a voice from a hard-coded list of ~8 stock ElevenLabs voices; the user writes a "who is this reader" description that the reaction prompt template uses at request time (Step 8).
- **Downgrade:** custom personas become locked (hidden, not deleted); their past reactions stay visible.
- **Deleting a custom persona** = soft delete (`deleted_at`), so old reactions keep its name.
- ~~**Free "1 persona per post"**~~ **Removed in Step 8:** Free gets reactions from all 3 standard personas; `posts.reaction_persona_id` is gone.

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
| `posts` | `id`, `user_id`, `buffer_organization_id` (Step 3), `channel_id`, `channel_service`, `channel_name`, `buffer_post_id?`, `buffer_status?` (draft / scheduled / sent), `due_at?`, `text`, `is_sample`, `created_at`, `last_edited_at`. Unique (`user_id`, `buffer_post_id`). |
| `versions` | `id`, `post_id`, `text`, `text_hash`, `created_at` |
| `personas` | `id`, `user_id?` (null = standard), `name`, `bio`, `avatar_key`, `elevenlabs_voice_id`, `reader_description`, `created_at`, `updated_at` (Step 7), `deleted_at?`. No `reaction_prompt`: prompts are built in code (Step 8). |
| `reactions` | `id`, `post_id`, `persona_id`, `channel_service` (Step 8), `text_hash`, `reaction`, `sentiment`, `model`, `created_at`. Unique (`post_id`, `persona_id`, `channel_service`, `text_hash`). |
| `tone_reads` | `id`, `post_id`, `channel_service` (Step 8), `text_hash`, `label`, `sentiment`, `summary`, `model`, `created_at`. Unique (`post_id`, `channel_service`, `text_hash`). |
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
| Refresh failure | **Dead** (`invalid_grant`, any token-endpoint 4xx including 429, revoked, decrypt failure, missing OAuth refresh token, 401 after retry) → delete `buffer_connections`, clear session, typed `BUFFER_AUTH_EXPIRED`; page loads redirect to `/signin?reason=expired`. **Temporary** (network, 5xx, GraphQL 429) → keep session, "Buffer isn't responding. Try again in a minute." Read-aloud, reactions, and Tone read keep working. |
| Lost rotation | If Buffer rotates the token but we time out before saving it, the user signs in again. Accepted; no recovery attempt. |
| Unsaved text | Server functions return typed `BUFFER_AUTH_EXPIRED` instead of redirecting. **Composer (Step 6)** shows a "Reconnect Buffer" dialog, saves editor text to `localStorage` by post ID, starts OAuth with `returnTo` = the post, and restores the text as unsaved. |
| Sign out | POST only. Clears the cookie; tokens stay. |
| Disconnect | POST only. Deletes `buffer_connections` + clears the cookie; posts, plan, personas stay. Confirm dialog: "Your Creator plan keeps billing. Cancel it in Billing first if you want to stop." and "To fully remove access, also remove Vocelo in Buffer → Settings → Connected apps." |
| Plans | Sign-in behaves the same on every tier. Plan follows `buffer_account_id`. A paid user with a dead token keeps their plan and billing; only Buffer actions stop until they sign in again. New Buffer account = new Free user; merging accounts is support-only. |
| Email | Stored and refreshed every sign-in; becomes the Stripe Customer's `email` (Step 5 passes `customer`, not `customer_email`, to Checkout). No verification. |
| Timezone | `users.timezone` from `account.timezone`, refreshed every sign-in, nullable (browser timezone fallback). Used by Step 9. |
| Dev sign-in | `/__dev/login` works only when `BUFFER_API_KEY` is set **and** `NODE_ENV !== 'production'`, else 404. Looks up the account with the personal key, upserts the user, stores the key as the access token with no refresh token, sets the session. Lets worktree ports (3000 + N) click through Buffer features. The Netlify build fails if `BUFFER_API_KEY` is set. |

### Schema additions (additive migration)
- `users.timezone` (text, nullable)
- `posts.buffer_organization_id` (text)

### Conflicts flagged
- **Composer (Step 6):** owns the reconnect dialog + `localStorage` restore for `BUFFER_AUTH_EXPIRED`.
- **Billing (Step 5):** Disconnect never cancels Stripe; dialog says so. The Buffer email becomes the Stripe Customer's email (Step 5).
- **Buffer integration (Step 4):** rate limit is per app client across all users; cache channel/draft lists. Posts store their org ID.
- **Pages (Step 10):** `/auth/callback` has no UI; Settings shows connected org; `ensureSamplePost` is filled in there.

### Tickets
Step 3 drafts 15 tickets (`context/tickets/03-sign-in.md`).

---

## Step 4 Decisions: Buffer integration (agreed 2026-11-12)

### Buffer facts (developers.buffer.com, checked 2026-11-12)
- `channels(input: { organizationId, filter? })` → `id name displayName service type timezone isDisconnected isLocked metadata …`. `channel(input: { id })` fetches one. `service` enum includes `linkedin twitter substack threads bluesky mastodon` (Substack added Sept 2026; Notes only, 10,000 chars). Mastodon channels expose `metadata.maxCharacters`.
- `posts(first, after, input: { organizationId, filter: { status, channelIds, … }, sort })`: forward-only Relay paging; max `first` undocumented (docs suggest 20–50). `post(input: { id })` fetches one.
- **`PostStatus`: `draft`, `needs_approval`, `scheduled`, `sending`, `sent`, `error`.** Failed posts carry `error { message }`.
- `createPost` **requires** `channelId`, `assets` (`[]` for none), `mode`, `schedulingType`, `needsApproval`, even with `saveToDraft: true`. Drafts skip Buffer's posting limits (Buffer Free: 10 scheduled posts per channel).
- **`editPost` only changes what you send:** omit `text` / `assets` / `metadata` / `mode` → kept as is. (So we never need to read and resend assets.) `saveToDraft: true` moves a scheduled post back to draft.
- Mutations return a union; every error implements `MutationError { message }` with HTTP 200 (e.g. `"LinkedIn posts cannot exceed 3000 characters."`). Buffer validates length server-side.
- `deletePost` exists (unused in MVP). **No webhooks**: status is only known by fetching.
- OAuth client limits: 100 + 10/user per 15 min, **500 + 25/user per 24 h**, 15,000 + 100/user per 30 days. Query complexity cap 175,000 points.
- Character counting: UTF-16 code units by default (emoji = 2); LinkedIn counts every URL as 24; X uses its weighted count (Premium allows 25,000, not detectable via API); Bluesky counts graphemes (300); Mastodon is per server (default 500).

### Decisions
| Topic | Decision |
|---|---|
| Scope | Step 4 = channels, character counting, save draft (create/edit), status sync, import. **Schedule is Step 9** and reuses Step 4's save + post-fetch functions. Ideas, images, threads, link cards stay stretch. |
| When a Buffer draft exists | Only after an explicit **"Save draft"** click. A Vocelo post can live without `buffer_post_id`. No autosave to Buffer. |
| New post | `/app/posts/new` requires a channel **before** the post row is created. The channel can change until the first successful save, then locks. Over-limit text stays and blocks saving. |
| Supported channels | `linkedin`, `twitter`, `substack`, `threads`, `bluesky`, `mastodon`. Unsupported services show **disabled** ("Not supported yet"). `isDisconnected` / `isLocked` channels show disabled ("Reconnect this channel in Buffer"). Zero supported channels → empty state with "Refresh channels". |
| Channel cache | `users.channels_cache` (jsonb) + `users.channels_cached_at`, **10-min TTL**; "Refresh channels" bypasses it. Scoped to the user's org. The import list is never cached. |
| Character counting | One shared `src/lib/char-count.ts`: `countFor(service, text, { maxCharacters? })` → `{ count, limit, over }`. X via `twitter-text` (limit **280 always**; long X posts are stretch), Bluesky via `Intl.Segmenter` graphemes (300), LinkedIn URLs = 24 (3,000), Threads 500, Substack 10,000, Mastodon `maxCharacters` ?? 500, else UTF-16. Composer renders it; **the server re-checks on save**. Buffer's own error is the backstop. |
| Statuses | `buffer_status` enum gains `needs_approval`, `sending`, `error`. **Saving is allowed only when status is `draft`**; every other status blocks with "Save as a new draft" (for `error`, Buffer's `error.message` is shown). |
| Status sync | No webhooks, no bulk polling. Fetch the one post **when the composer opens** and **right before every save**; store `buffer_status` + `due_at`. Dashboard shows the last known status (can be stale). |
| Pre-save check | One call: `post(id) { status error channel { isDisconnected isLocked } }`. Not found → recreate. No `buffer_post_id` yet → `channel(id)` instead. A save costs 2 Buffer calls. |
| Create | `createPost { channelId, text, saveToDraft: true, mode: addToQueue, schedulingType: automatic, needsApproval: false, assets: [] }`. No metadata, tags, or source. |
| Edit | `editPost { id, text }` only. Images, attachments and metadata added in Buffer survive because they're omitted. |
| Concurrency | Save locks the post row (`FOR UPDATE`); once `buffer_post_id` is set it uses `editPost`. Save button disabled while saving. If `createPost` succeeds but our response is lost, the orphan duplicate draft in Buffer is accepted. |
| Deleted in Buffer | On save: create a new draft, repoint `buffer_post_id`, "Recreated in Buffer." |
| "Save as a new draft" | For `needs_approval` / `scheduled` / `sending` / `sent` / `error`: `createPost` on the same channel and **repoint the same Vocelo post** (versions + reactions kept). The old Buffer post is left alone and untracked. |
| Versions | The save inserts the version row **in the same transaction** as storing the result, only when text changed. Step 9 builds the panel + restore. |
| Unchanged text | Text equals the latest version and status is `draft` → skip Buffer, "Already saved." (A draft deleted in Buffer goes unnoticed until the next change or composer open.) |
| Save failures | Temporary / 429 → text stays unsaved, "Buffer isn't responding. Try again in a minute." (+ seconds from `retry-after`), no version, no auto-retry. `MutationError` → Buffer's message verbatim. `BUFFER_AUTH_EXPIRED` → Step 3/6 reconnect dialog. |
| Composer open, Buffer down | Opens with last known status + "Couldn't check Buffer just now." Read-aloud, reactions, Tone read keep working. |
| Disconnected/locked channel | Text stays editable; read-aloud + reactions work; only "Save draft" is disabled ("Reconnect this channel in Buffer, then reopen"). |
| Import list | `posts` with status `draft`, user's org, supported + connected channels, newest first, `first: 20`, no "Load more" (stretch). Hidden: already imported (incl. locked ones), empty text, thread metadata. Count line: "N drafts can't be imported (threads or empty)". Drafts with attachments show "📎 N attachments, edit them in Buffer". |
| Import action | Uses the list's data (no extra Buffer call). Sets `created_at` + `last_edited_at` to **import time** (so old drafts don't land locked) and creates **version 1** from the Buffer text (the only non-save version). Free, never a review. |
| Multi-org drift | Posts whose org/channel is no longer found show "Channel no longer connected" (read-only save). Org switching stays stretch. |
| Plans | **Buffer actions behave the same on every tier** and never count as a review. Locked posts can't be opened, so can't be saved. Safety cap: **30 Buffer writes / hour / user** (one per save or import action, `usage_events.kind = buffer_write`): "You've saved a lot this hour. Try again in N minutes." |

### Schema additions (additive migration)
- `buffer_status` enum: add `needs_approval`, `sending`, `error`
- `usage_events.kind` enum: add `buffer_write`
- `users.channels_cache` (jsonb, nullable), `users.channels_cached_at` (timestamptz, nullable)
- `posts.channel_id` becomes nullable, with check `is_sample OR channel_id IS NOT NULL` (relaxing NOT NULL is not a drop; allowed). The sample post uses `channel_service = 'linkedin'`.

### Conflicts flagged
- **Kickoff rule fixed:** "read the draft's current assets and send them back" was wrong; `editPost` keeps omitted assets.
- **Composer (Step 6):** character counting moved to Step 4 (`src/lib/char-count.ts`); Composer renders it. Composer owns the editor route the Save button lives in.
- **Versions (Step 9):** version rows are written by Step 4's save (and import). Step 9 = history panel, restore, Schedule (`editPost` with `mode` + `dueAt`, reusing the pre-save check).
- **Usage (Step 1 T6):** new `buffer_write` kind + hourly cap lives beside the LLM cap.
- **Pages (Step 10):** dashboard rows show status badges; import list + empty states live on `/app`.
- **Seed (Step 2 I12):** the imported draft with 2 images needs `buffer_status = draft` and a version 1.

### Tickets
Step 4 drafts 16 tickets (`context/tickets/04-buffer-integration.md`).

---

## Step 5 Decisions: Billing (agreed 2026-11-12)

### Stripe facts (docs.stripe.com, checked 2026-11-12)
- Pin the SDK to API version **`2026-10-28.endive`**.
- Since `2025-03-31.basil`, billing periods live on **subscription items**: `subscription.items.data[0].current_period_start/end` (not on the Subscription).
- Checkout creates subscriptions in **flexible billing mode**: a pending cancel sets `cancel_at`, not `cancel_at_period_end`.
- Checkout `customer` reuses an existing Customer (email prefilled, locked). `subscription_data.metadata` copies onto the Subscription. `expires_at` is 30 min–24 h (default 24 h). `success_url` takes the literal `{CHECKOUT_SESSION_ID}`.
- Dashboard setting "limit customers to one subscription" redirects a customer who already has an active/past_due/unpaid/paused subscription to the Portal.
- Webhook order is **not guaranteed**; duplicates happen; only 2xx = success. Sandbox retries 3 times over a few hours (live: 3 days). Signature check needs the **raw body**; default tolerance 5 min. Tests sign fixtures with `stripe.webhooks.generateTestHeaderString`.
- Statuses: `incomplete` (first payment pending, 23 h) → `incomplete_expired`; `trialing`; `active`; `past_due` (renewal failed); `canceled`; `unpaid`; `paused` (endive can auto-pause after payment failure). Smart Retries: up to 8 tries in ~2 weeks, then the Dashboard's chosen outcome.
- Portal: `subscription_cancel.mode` `at_period_end` | `immediately`; payment method update; invoice history; plan switching; pause. **Test mode has its own portal configuration.**

### Decisions
| Topic | Decision |
|---|---|
| Scope | Step 5 = Stripe client, customer, Checkout, webhook, `applySubscription`, success/canceled pages, Customer Portal, plan-aware pricing CTAs, meters, past_due banner, limit-reached prompts, locked teaser card, billing test presets. Already drafted in Step 1: usage periods (T4), stub (T5), enforcement (T6), history filter (T7). **Stretch:** Team checkout, trials, annual, promo codes, character top-ups, live keys, seeding real Stripe test customers. |
| Stripe customer | Created on the **first "Upgrade" click**, before redirect: `email` (from Buffer), `metadata.userId`; saved to `users.stripe_customer_id`; reused forever. Checkout always passes `customer`, never `customer_email`. |
| Checkout session | `mode: subscription`, `STRIPE_CREATOR_PRICE_ID`, `customer`, `client_reference_id = userId`, `subscription_data.metadata.userId`, `expires_at` = 30 min, no promo codes, no Stripe Tax, USD. `success_url` = `/app/billing/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url` = `/app/billing/canceled`. |
| Already paid | Effective plan Creator → server **refuses** to create a Checkout Session; UI shows "You're on Creator" + Manage billing. Backstop: Stripe's "one subscription per customer" setting. A duplicate that still lands is **logged only** and fixed by hand. |
| Single writer | `applySubscription(subscriptionId)` is the **only** code that writes `stripe_subscription_id`, `subscription_status`, `current_period_start/end`, `cancel_at_period_end`. It **re-fetches the subscription from Stripe** (never trusts the event payload), reads the period from `items.data[0]`, and sets `cancel_at_period_end = cancel_at != null OR cancel_at_period_end`. |
| Effective plan | Creator while status is `active`, `trialing`, `past_due`. Everything else is Free: `incomplete`, `incomplete_expired`, `unpaid`, `canceled`, `paused`. |
| Usage period on change | Upgrade → period = Stripe item period (Free usage doesn't carry). Status leaves the paid set (`canceled`/`unpaid`/`paused`/`incomplete_expired`) → `period_anchor_at` = when it ended (fresh Free period). `incomplete` → no change. |
| Webhook | `/api/stripe/webhook` reads the raw body, verifies the signature (bad → 400). Handled: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`; each resolves the subscription ID and calls `applySubscription`. Others → 200 ignored. `stripe_events` row inserted **in the same transaction** as the update; seen event ID → 200 skip. Processing error → **500** so Stripe retries. |
| Finding the user | `subscription.metadata.userId` first, then `users.stripe_customer_id`. Neither → 200, ignored (test-mode events from other apps). Disagreement → trust the customer ID, log it. |
| Success page | Server retrieves the Checkout Session, checks it belongs to the signed-in user (else 404), calls `applySubscription`. Not paid yet → "Finishing up…", polls every 2 s for up to 20 s, then "Your payment is processing. Refresh in a minute." The demo never depends on `stripe listen`. |
| Canceled page | "No changes made" + back to `/pricing`. Nothing written. |
| Customer Portal | "Manage billing" creates a portal session (`return_url` = `/app/settings/billing`). Portal allows card update, invoices, **cancel at period end only**, undo cancel; no plan switching, no pause. Fake/unknown customer (seed users) → "Billing isn't set up for this test account." Stripe down → "Couldn't open billing. Try again." |
| Pricing page | Signed out: Creator CTA → `/signin?returnTo=/pricing` (no auto-checkout). Free: "Upgrade". Creator: "Current plan" + "Manage billing". Team: disabled "Coming soon". |
| Meters | Billing settings: plan line ("Creator · renews Dec 12" / "Creator · ends Dec 12" / "Payment failed"), posts meter ("3 of 5 posts reviewed" / "Unlimited"), characters meter ("6,200 of 12,000 voice characters left"), "Resets Dec 12". Composer shows a compact version. |
| past_due | Banner in Billing settings + composer: "Your last payment failed. Update your card to keep Creator." → Portal. User keeps Creator during retries. |
| Limit reached | New audio, reactions, Tone read blocked; cached ones still play. Free: "Upgrade to Creator" → Checkout. Creator out of characters: "Resets {date}", no upsell (Team coming soon). |
| Locked teaser card | Free: "🔒 N posts older than 30 days. Upgrade to see them" → Checkout. Creator: "🔒 N posts older than 12 months. Team is coming soon", no button. |
| Downgrade | Nothing deleted. Custom personas locked; reactions from Creator days stay visible (refresh shows "Upgrade to refresh"). Fresh Free period. |
| Refunds, disputes, tax | Manual in the Stripe dashboard; the app ignores them. A refund never changes the plan; only subscription status does. |
| Disconnect / dead Buffer token | Never touches Stripe (Step 3). |
| Test users | 7 presets shared by `createTestUser({ preset })`, `npm run seed`, and `/__test/login?user=<key>`: `free`, `free-at-limit` (5/5 posts), `free-low-chars` (500 left), `free-downgraded` (2 locked custom personas, posts 45 days old), `creator` (renews in 20 days), `creator-canceling` (ends in 3 days), `creator-past-due`. Seeded paid users get fake `cus_seed_…` / `sub_seed_…` IDs; real billing is tested by signing in as `free` and paying with `4242 4242 4242 4242`. |

### Human setup (before build day, Stripe test mode)
1. Creator product + $15/mo USD price (already listed)
2. Customer Portal (test mode): cancel at period end, payment method update, invoice history; no plan switching, no pause; default return URL
3. Settings → Checkout and Payment Links → Subscriptions: **limit customers to one subscription** (keep the no-code portal login link on)
4. Settings → Billing → retries: when retries run out, **cancel the subscription**
5. Webhook endpoint for production (events listed above)

### Conflicts flagged
- **Schema:** `current_period_start/end` come from the subscription item, not the subscription; `cancel_at_period_end` is derived from `cancel_at` too. No new columns needed.
- **Step 2 I12/I13/I14:** seed, factories, and the E2E helper only had `free` / `creator`. P14 adds the 7 presets on top (no edits to merged tickets).
- **Reactions (Step 8):** ~~Free 1-persona-per-post~~ removed in Step 8; old reactions from locked custom personas stay visible.
- **Personas (Step 7):** downgrade locks custom personas (already decided); the `free-downgraded` preset exercises it.
- **Demo:** the success page syncs directly from Stripe, so the upgrade step works even if `stripe listen` is slow.

### Tickets
Step 5 drafts 15 tickets (`context/tickets/05-billing.md`).

---

## Step 6 Decisions: Composer (agreed 2026-11-12)

### Scope
Step 6 = the `/app/posts/:id` route shell, editor, autosave to Vocelo, local backup, two-tab conflict, live character counter UI, selection tracking, signed-out dialog, "not a draft in Buffer" banner, Cmd/Ctrl+S, "Feeling stuck?" hint, delete post. **Not Step 6:** counting logic (B2), Save draft button + messages (B11), status sync (B12), channel picker (B7), playback (Step 7), reactions/Tone read (Step 8), version panel (Step 9), usage meter (P15), past_due banner (P11). **Stretch:** rich text, floating selection toolbar, other shortcuts, built-in voice-to-text.

### Decisions
| Topic | Decision |
|---|---|
| Editor | Plain auto-growing `<textarea>`. No rich text. |
| Autosave | Text autosaves to **Vocelo only** (`posts.text`), ~1 s after typing stops. Buffer is still saved only by an explicit **Save draft**. `last_edited_at` changes only when the text actually changes (opening a post never bumps it). No usage, no Buffer write, no cap. |
| Status wording | "Saving…" · "Saved in Vocelo" · "Not in Buffer yet" (no `buffer_post_id`) · "Changes not in Buffer yet" (text ≠ latest version). The UI **never says "unsaved"**: it always means "not in Buffer". |
| Single source of truth | `posts.text` in the DB. Save draft, Read aloud, highlight-to-hear, reactions, and Tone read call the editor's `flush()` (await pending autosave) and the server reads the text from the DB. Highlight sends `{ start, end, text }`; the server checks `text` against the stored slice and rejects a mismatch. The editor stays editable during a save; text typed after the flush shows "Changes not in Buffer yet". B8's `saveDraft(postId)` signature is unchanged. |
| Normalization | One shared `normalizeText()` in `src/lib/text.ts`: `\r\n` → `\n`, NFC, **no trim**. Used by the client and server before storing, counting, and hashing (`textHash()`, sha256). `isBlank()` (trim) is the only place whitespace is ignored. |
| Empty posts | Allowed and shown on the dashboard as "Empty post" (deletable). While blank: Save draft, Read aloud, reactions, and Tone read disabled. No minimum length. |
| Hard cap | **20,000 characters** (2× Substack). Editor refuses input past it ("Posts can be up to 20,000 characters."); server rejects autosaves over it. |
| Character counter | Renders `countFor` on every keystroke (no debounce): `1,234 / 3,000`. Over: "12 over X's 280 limit. Saving is blocked until it fits." in `$tone-negative`. No warning band. Mastodon without `maxCharacters`: "500 (server default)". Changing channel before the first save recounts. |
| Local backup | While the server hasn't confirmed an autosave, text is mirrored to `localStorage` key `vocelo:draft:{userId}:{postId}` (with a timestamp); cleared on confirm. On open, a local copy that differs and is newer than `last_edited_at` loads into the editor with "Restored unsaved text from this browser" and autosaves. Expires after 7 days. All storage access wrapped in try/catch. |
| Autosave failure | Retry at 2 / 5 / 10 / 30 s (then every 30 s): "Couldn't save. Retrying…". `beforeunload` warning **only** while text is unsynced. |
| Signed out mid-edit | One dialog for `BUFFER_AUTH_EXPIRED` and an expired/cleared session (`UNAUTHENTICATED`; a dead token clears the session, so autosave fails first): "You've been signed out. Sign in again; your text is kept here." → `/auth/buffer/start?returnTo=/app/posts/:id`. Signing in as a different account → 404; the backup is keyed by `userId`, so it never shows for another account. |
| Two tabs | Autosave sends the `last_edited_at` it loaded (`baseEditedAt`). Server has a newer value → `EDIT_CONFLICT`; editor pauses autosave and shows "This post changed in another tab." with **Load latest** / **Keep mine** (overwrite). |
| Selection | Remembered on `select` / `mouseup` / `keyup` so clicking a panel button (which blurs the textarea) keeps it. Whitespace-only = no selection. Any text change clears it. The panel button reads "Read aloud" or "Hear selection (N chars)". No floating toolbar. |
| Cmd/Ctrl+S | Triggers Save draft and blocks the browser save. When saving is disabled, shows the reason (e.g. the over-limit message). No other shortcuts. |
| Not a draft in Buffer | Status `needs_approval` / `scheduled` / `sending` / `sent` / `error`: text stays editable; banner on open: "This post is {status} in Buffer. Edits here won't change it; use Save as a new draft." |
| Read-only + access | **Sample post:** read-only editor (no channel picker, Save, autosave, or delete-confirm changes), LinkedIn counter, "Start your own post". **Locked post** by URL → redirect to `/app` with "This post is locked on your plan". **Another user's or deleted post** → 404. |
| Gone while open | Autosave/action returns `POST_NOT_FOUND` or `POST_LOCKED` → editor turns read-only, "This post was deleted." / "This post is locked on your plan.", **Copy text** button; local backup kept; nothing recreated. |
| Delete post | Composer "Delete post" with confirm: "Deletes it from Vocelo only. Your Buffer draft stays." Deletes post, versions, reactions, Tone reads; `usage_events` keep their rows with `post_id = NULL` (no refund). Works on the sample post. Redirects to `/app`. Step 10's dashboard delete reuses the same server function. |
| "Feeling stuck?" | One line under the editor, **only while the post is blank**: links to Wispr Flow (external) and OS dictation (macOS: press Fn twice; Windows: Win+H). |
| Plans | **Identical and unlimited on every plan**: typing, autosave, counting, creating posts, delete, hint. The composer never consumes usage. Plan differences appear only via P15 (meter), P11 (past_due banner), and the right-hand panel (Steps 7/8). |

### Schema additions
None. `posts.text` and `posts.last_edited_at` already exist.

### Conflicts flagged
- **Step 3 (sign-in):** the reconnect-only `localStorage` restore becomes a general local backup (any unsynced text), and the dialog also covers a plain expired session.
- **Step 4 B11:** Save draft must `await flush()` first → blocked by C4. Cmd/Ctrl+S (C11) calls the same handler.
- **Step 7 (playback) / Step 8 (reactions):** read text from the DB after `flush()`; highlight sends `{ start, end, text }`, server verifies the slice. Hashes use `textHash(normalizeText(text))`. If Step 8 makes prompts channel-aware, the channel must join the reaction cache key (today a pre-save channel change keeps existing reactions valid).
- **Step 9 (versions):** "Restore loads text as unsaved" now means: restored text is autosaved to Vocelo (no version row) and shows "Changes not in Buffer yet".
- **Step 10 (pages):** dashboard shows blank posts as "Empty post"; dashboard delete reuses C13's server function.
- **Critical path:** Lane C's "Composer editor + char limits" = render only; counting is B2.

### Tickets
Step 6 drafts 14 tickets (`context/tickets/06-composer.md`).

---

## Step 7 Decisions: Personas + playback (agreed 2026-11-12)

### Personas
| Topic | Decision |
|---|---|
| Standard trio | **The Skeptic** (peer who spots humblebrags + vague claims), **The Scroller** (busy reader, only gets the first line), **The Fan** (warm supporter, says what works). One distinct stock voice each (H2). Copy stays placeholder. |
| Free playback | All 3 standard personas for read-aloud + highlight-to-hear. (Step 8 also gives Free reactions from all 3.) |
| Custom fields | Name 1–40, bio ≤ 160, "Who is this reader?" 1–500 (fed into the reaction template), voice from ~8 stock voices (`src/lib/voices.ts`), avatar from ~12 placeholder icons (`src/lib/avatars.ts`; uploads are stretch). Creating/editing never calls the LLM, never consumes usage. |
| Limit | Creator (incl. `past_due`, canceling): **5 non-deleted** custom personas; create locks the user row so concurrent creates can't make a 6th. At 5: "Delete one to add another." |
| Editing | Every field editable; new `personas.updated_at`. Reactions older than it show "Persona changed: refresh" (Step 8). Audio needs nothing: voice ID is in the cache key. |
| Delete | Soft delete on every plan (Free can delete locked ones). Old reactions keep the name; cached audio untouched. |
| Free / downgraded | Custom personas shown as locked cards ("Upgrade to use") on `/app/personas` and in the picker; server rejects use with `PERSONA_LOCKED`. Never-paid Free sees one locked "Create your own reader" card → Checkout. |
| Picker | Remembered per post in `localStorage` (`vocelo:persona:{userId}:{postId}`); default The Skeptic; deleted/locked → default. |
| Voice previews | Static files, no credits: `npm run audio:static` (V16) writes `/public/voices/` previews, 3 landing clips, and the sample post's 3 reads to `/public/demo/`; the human runs it once (H10). Sample text lives in `src/content/sample-post.ts`. |

### Playback
| Topic | Decision |
|---|---|
| Cap | A read is capped at **the post's channel limit** via `countFor()` (X 280, LinkedIn 3,000, Substack 10,000, Mastodon `maxCharacters` ?? 500; sample = LinkedIn). Over the limit: "Read aloud" disabled ("Over X's 280 limit. Trim it or highlight a section to hear it."); a selection within the limit can still be heard. |
| Generation | Model `eleven_flash_v2_5`, `mp3_44100_64`, default voice settings, 45 s timeout. Whole file, **no streaming**; written to Netlify Blobs (`consistency: 'strong'`); returns `{ audioUrl: '/api/audio/<key>' }`. |
| Order of operations | `flush()` → server reads text from DB → validate (post visible, persona allowed, selection matches stored slice, not blank, within cap) → **cache check** (hit = free, no usage, no review) → `checkAndConsume(tts_chars, text.length)` → ElevenLabs → store. Any provider failure refunds. |
| Voice characters | `.length` of the normalized text actually sent (UTF-16; spaces + emoji count). |
| Multiple voices | Same post, 3 voices = **1 reviewed post** but **3× voice characters** (each voice is new audio). Replays of the same voice + text are free, across users. |
| Providers | `browser`: same server path incl. usage, no blob, client speaks with `speechSynthesis` (limits behave locally like production). `fixture`: short silent mp3. |
| Double clicks | Button shows "Generating…" and is disabled. Two identical concurrent requests may both generate and both charge (accepted). |
| Errors | 429/concurrency → "Voices are busy. Try again in a few seconds." · our quota used up → "Voice is unavailable right now." (logged) · 5xx/timeout → "Couldn't generate audio. Try again." · usage → P12 `LimitReached`. |
| Player | One clip at a time (new one stops the old); Play/Pause, Stop, progress bar; no speed, no scrubbing. Editing mid-read keeps playing + "Text changed since this read." Leaving the page stops audio. |
| Sample post | Only the 3 standard personas' static full reads from `/public/demo/`. Highlight-to-hear + custom personas disabled ("Try this on your own post"). Never calls ElevenLabs except under `DEMO_FALLBACK`. |
| Audio route | `GET /api/audio/:key` requires sign-in; any signed-in user may fetch any key (shared cache, unguessable sha256). `Cache-Control: private, max-age=31536000, immutable`. |
| Plans | Playback buttons identical on every plan; Free vs Creator differ only in usage limits (T6) and custom persona access. |

### Pricing change
- **Free voice characters: 8,000 → 12,000** (5 posts × 3 voices × 800 chars). Worst-case Free cost ~$0.88 → ~$1.32. Updated in `pricing-tiers.md`, T6, P9, P10.

### Schema additions (additive migration)
- `personas.updated_at` (timestamptz, default `now()`, backfilled to `created_at`)

### Conflicts flagged
- **Critical path:** Lane B used "dev API key, no auth"; it now signs in with `/__dev/login` and every server fn calls `requireUser()`. Stub names fixed to `checkAndConsume` / `refund`.
- **Step 5 P12:** "Step 7 playback (wiring point)" → blocked by V7 + V10.
- **Step 1 T6 / Step 5 P9, P10:** Free character limit now 12,000; P14's `free-low-chars` stays "500 left".
- **Step 8 (reactions):** handle "Persona changed: refresh"; treat "Who is this reader?" as quoted data, never instructions (prompt-injection guard). Done in Step 8: prompts are built in code (R3), no `reaction_prompt` column.
- **Step 10 (pages):** sample post text comes from `src/content/sample-post.ts`; landing showcase uses `/demo/landing-<persona>.mp3`.
- **H2:** also picks ~8 custom voices. New **H10** runs the static audio script.

### Tickets
Step 7 drafts 16 tickets (`context/tickets/07-personas-playback.md`) + human ticket H10.

---

## Step 8 Decisions: Reactions + tone (agreed 2026-11-13)

### Reactions
| Topic | Decision |
|---|---|
| Trigger | A **"Get reaction"** button for the selected persona, separate from Read aloud. Nothing runs automatically. No "react with all personas" button (stretch). Whole post only; reactions on a selection are stretch. |
| Plans | **Free: all 3 standard personas** (the old "1 persona per post" lock is removed; `posts.reaction_persona_id` dropped). Creator (incl. `past_due`, canceling): standard + own custom. The only plan difference is custom personas. |
| Validation | Same as Read aloud (V6, no selection): post visible (T7), persona allowed (`PERSONA_LOCKED` / `PERSONA_NOT_FOUND`), not blank (`EMPTY`), within the channel limit (`OVER_CHANNEL_LIMIT`, same message as Read aloud). |
| Channel-aware | Prompts name the channel ("a post for X"). `channel_service` joins the cache key on `reactions` and `tone_reads`. A channel only changes before the first save, so this rarely misses. |
| Cache | Hit = a row for (post, persona, channel, text hash) created at or after the persona's `updated_at` → returned free, no usage, no review. Cache is per post (not shared across posts or users). |
| What the panel shows | The **latest** reaction per persona, selected persona first. Hash ≠ current text → greyed, "Text changed: refresh". Reverting text brings back the cached reaction free. No reaction history UI. |
| Persona states | **Edited** after the reaction → "Persona changed: refresh"; refresh **upserts** the same row (and resets `created_at`). **Deleted** custom → name + "(deleted)", no refresh. **Locked** custom (downgrade) → visible, "Upgrade to refresh" → Checkout. Never-paid Free → custom personas never appear in the panel. |
| The Scroller | Gets the full text; its prompt says to react as someone who stops after the first two lines. |

### Tone read
| Topic | Decision |
|---|---|
| Trigger | A "Read the tone" button. Persona-independent, channel-aware, on every plan. |
| Labels | Fixed list of 10 in `src/lib/tone.ts`: Confident, Warm, Inspiring, Helpful, Neutral, Vague, Salesy, Braggy, Defensive, Preachy. **Our code maps label → sentiment**; the LLM returns `{ label, summary }` only. Mapping: Confident/Warm/Inspiring/Helpful = positive, Neutral/Vague = neutral, Salesy/Braggy/Defensive/Preachy = negative. |
| Display | Label chip (sentiment token) + one-sentence summary; "Text changed: refresh" when stale. |

### Usage + failures (reactions and Tone read)
| Topic | Decision |
|---|---|
| Accounting | One user request = **1 `llm_call` event** (the internal retry doesn't count) + `post_review` if it's the post's first chargeable action this period. Cache hit = nothing. No per-period reaction cap; only the 60/hour safety cap. Free at 5/5 posts: still works on posts already reviewed this period; a new post → P12 "Upgrade". |
| Order | `flush()` → server reads text from DB → validate → cache check → `checkAndConsume(llm_call)` → LLM → upsert. Any failure → `refund`. |
| Timeouts | 20 s per attempt × 2 attempts (≤ 40 s, inside Netlify's 60 s). |
| Errors | Bad JSON, reaction > 280 chars, or unknown label → retry once → "Couldn't get a reaction. Try again." / "Couldn't read the tone. Try again." · Model refusal (`stop_reason: refusal`) → same message, **no retry** · Anthropic 429/overloaded → "Reactions are busy. Try again in a few seconds." · Bad key / our quota → "Reactions are unavailable right now." (logged) · Usage → P12. |
| Free warning | Free only (all three buttons; Read aloud added via R11), not the sample post: when the next request would make this a **newly** reviewed post, a note sits under Read aloud, Get reaction and Read the tone: "Uses 1 of your 5 posts this period (3 left)." Last one: "Uses your last free post this period." Post already reviewed this period → no note (refresh costs nothing). At 0 left the button still works and P12 shows on click. Creator: no note. No new limit. |
| Double clicks | Button shows "Thinking…" and is disabled. Two identical concurrent requests may both charge; the second wins the upsert (accepted, same as audio). |

### Prompts
| Topic | Decision |
|---|---|
| Where | Built **in code at request time** (`src/server/prompts/`), not stored. `personas.reaction_prompt` removed. Standard personas' prompts keyed by their fixed IDs; custom personas use one template fed by "Who is this reader?". |
| Injection guard | Fixed system prompt per kind. Post text in `<post>`, reader description in `<reader>` (closing tags in user text escaped); the system prompt says tag contents are data, never instructions. Schema-enforced output, no tools. No moderation (only the author sees the result). |
| Wording | Agents write first drafts; the human tunes them on build day (**H11**). UI strings are placeholders in `src/content/copy/analysis.ts`. |

### Sample post, fixtures, demo
- **Sample post:** pre-made reactions for the 3 standard personas + a Tone read, hand-written in `src/content/sample-post.ts`. Get reaction / Read the tone return them free. Custom personas: "Try this on your own post".
- **`LLM_PROVIDER=fixture`:** seeded posts → I12's JSON; any other text → a canned reaction per persona and a "Neutral" Tone read. E2E never hits the network. `DEMO_FALLBACK` works the same as playback (sample post only).
- **Demo with pasted LinkedIn posts:** pasting into a new post = live LLM calls (~2–5 s each, cache is per post). Audio is shared by text, so a dry run pre-warms it. To be safe, create the demo posts in the demo account the night before (reactions cached); paste one fresh post live if you want the "real" moment. Each pasted post counts as a reviewed post (Free = 5).

### Schema changes (drafts edited directly: no code or issues exist yet)
- `posts`: drop `reaction_persona_id`
- `personas`: drop `reaction_prompt`
- `reactions`, `tone_reads`: add `channel_service`; unique keys include it

### Conflicts flagged
- **`pricing-tiers.md`:** "1 persona per post" removed. Free → Creator reaction trigger is now only custom personas.
- **Step 1 T3:** inserts `reader_description` instead of `reaction_prompt`. **T8:** R2 hardens its schemas, timeouts and errors; the Tone read shape changes to `{ label, summary }`.
- **Step 5:** Downgrade row + "Conflicts flagged" updated; P12 renders `rate` / `posts` errors from reactions too.
- **Step 7 V13:** no longer writes `reaction_prompt`.
- **Step 2 I12:** fixture JSON uses the fixed labels and includes `channel_service`.
- **Demo:** `DEMO_FALLBACK` doesn't cover pasted posts; pre-created demo posts do.

### Tickets
Step 8 drafts 11 tickets (`context/tickets/08-reactions-tone.md`) + human ticket H11.

---

## Step 9 Decisions: Versions + scheduling (agreed 2026-11-13)

The **why** behind each rule: `context/versions-scheduling.md`.

### Buffer facts (developers.buffer.com, checked 2026-11-13)
- `EditPostInput`: `id`, `text`, `assets`, `metadata`, `tagIds`, `dueAt` (DateTime, ISO 8601 UTC), `mode` (ShareMode; omit = no scheduling change), `saveToDraft` (true = back to draft), `schedulingType`, `approvalChange`.
- ShareMode values confirmed in docs: `addToQueue` (next free slot in the channel's posting schedule) and `customScheduled` (needs `dueAt`). Share now / share next are mentioned but not confirmed.
- ✅ **Verified live by H12 (2026-11-13, personal LinkedIn, test post deleted):**
  - ShareMode enum (introspection): `addToQueue`, `customScheduled`, `shareNext`, `shareNow`. `PostActionPayload` union: `PostActionSuccess`, `NotFoundError`, `UnauthorizedError`, `UnexpectedError`, `RestProxyError`, `LimitReachedError`, `InvalidInputError`.
  - **`editPost` without `text` is rejected:** `InvalidInputError` "Invalid post: Post must have either text or media." Every scheduling edit must resend the post's text.
  - `editPost { id, text, mode: customScheduled, dueAt, saveToDraft: false, schedulingType: automatic }` → `scheduled` with that `dueAt`. ✅
  - **Same call without `saveToDraft: false` returns `PostActionSuccess` but the post stays `draft`** (`dueAt` set). Always send `saveToDraft: false` and check the returned status.
  - `editPost { id, text, saveToDraft: true }` → `draft`, **but `dueAt` keeps the old value.** Decide "scheduled" from `status`, never from `dueAt`.
  - `deletePost` → `DeletePostSuccess`; fetching it after → top-level GraphQL error `extensions.code: NOT_FOUND`.
  - Account timezone `America/Chicago`; org `limits.scheduledPosts` = 5000 (paid Buffer plan, so `LimitReachedError` can't be triggered live; MSW only).
  - Not tested (risk of publishing to a real channel): `addToQueue`, past `dueAt`.
- **Not documented:** past/min/max `dueAt` rules; what `addToQueue` does with no posting times; when `LimitReachedError` fires (`Organization.limits.scheduledPosts` holds the cap).
- `Channel.isQueuePaused`: scheduled posts won't publish. `Channel.timezone` defaults to Europe/London. `deletePost` exists (unused).

### Decisions
| Topic | Decision |
|---|---|
| Name | **Schedule** ("Schedule in Buffer"), not "Approve & schedule". No approvals in MVP. Glossary: Schedule, Move back to draft. |
| Options | **Add to queue** (`addToQueue`, default) and **Pick a time** (`customScheduled` + `dueAt`). Share now, share next, "Change time" = stretch. |
| One click | `flush()` → `saveDraft` (version if text changed; recreates a deleted draft) → `editPost { id, text, mode, dueAt?, saveToDraft: false, schedulingType: automatic }` (text is required, H12). Counts **1 Buffer write** total. Row lock on the post; dialog button "Scheduling…" + disabled. |
| Partial failure | Save works, schedule fails → saved draft stays, "Saved as a draft in Buffer, but couldn't schedule: {reason}". No refund (Buffer was written). |
| Blocks | Same as Save draft: blank, over channel limit, channel disconnected/locked, status not `draft` (no Buffer post yet is fine), sample post, locked post. **No** "hear it first" gate. Same on every plan; never a reviewed post. |
| Time rules | Pick a time: ≥ **5 min** and ≤ **1 year** ahead, checked in the browser and on the server. Default = next full hour ≥ 5 min away. Passed while the dialog was open → "Pick a time at least 5 minutes from now." |
| Timezone | Shown in `users.timezone` ?? browser, always labelled ("3:00 PM America/Chicago"). Channel timezone ignored. Dashboard badge + composer use the same formatter. |
| Queue full | `LimitReachedError` → stays a saved draft: "Buffer says this channel's queue is full: {message}. Remove a scheduled post in Buffer or upgrade your Buffer plan." No pre-check against org limits. |
| Paused queue | Pre-check reads `isQueuePaused` → non-blocking warning in the dialog and the banner: "This channel's queue is paused in Buffer. It won't post until you resume it there." |
| Result | Read back `status` + `dueAt`. `scheduled` → "Queued for {time}" / "Scheduled for {time}"; no `dueAt` → "Added to your Buffer queue". `needs_approval` → store it, "Sent for approval in Buffer." Other `MutationError` → Buffer's message verbatim. |
| Already scheduled in Buffer | Pre-check returns Step 4's `NOT_A_DRAFT`; status stored; banner takes over. Deleted in Buffer → recreated by `saveDraft`, then scheduled. |
| Banner (updates C10) | Per status: `scheduled` "Scheduled for {time}. Edits here won't change it." + **Move back to draft**, then Save as a new draft · `needs_approval` "Waiting for approval in Buffer." · `sending` "Posting now." · `sent` "Posted." · `error` Buffer's message. Non-scheduled statuses offer Save as a new draft only. |
| Move back to draft | Fixes a Step 4 conflict (Save as a new draft left the old text scheduled). `getPost` pre-check: `sending`/`sent` → refuse "It's already posting or posted. Save as a new draft instead." · not found → clear `buffer_post_id`, "This post isn't in Buffer anymore. Save draft to create a new one." · already `draft` → store, "Already a draft." · `scheduled` → `editPost { id, text, saveToDraft: true }` (1 Buffer write; text required, H12). Every branch stores the fresh status. |
| Change time | Not in MVP: Move back to draft, then Schedule again (2 writes). |
| Version panel | Newest first: time saved, first ~80 chars, char count. Newest gets a status tag: "In Buffer" (draft) · "Scheduled" · "Posted" · "Waiting for approval". Click → full text read-only + **Restore**. Free: newest 3 (T7 `visibleVersions`) + "🔒 N older versions. Upgrade to see them" → Checkout. Creator: all. Hidden on the sample post. Diff view stretch. |
| Restore | Loads text into the editor (autosaves to Vocelo, no version). Current text ≠ newest version → confirm "Your current text isn't in Buffer and isn't saved as a version. Replace it?" Version equal to current text → disabled "Current". Server rejects hidden versions (`VERSION_LOCKED`). Restoring on a scheduled post is allowed; the banner still applies. On Free, the next save can push the oldest visible version out of view (no warning). |
| Shortcuts | Cmd/Ctrl+S = Save draft only, never Schedule. |
| Demo | Schedule only to a test channel with **Pick a time ~1 week out**, then Move back to draft on stage. Empty that queue afterwards (H13, `environments.md`). |

### Schema additions
None. `posts.buffer_status`, `posts.due_at`, `versions`, `users.timezone` already exist.

### Conflicts flagged
- **Step 4:** "Save as a new draft" alone on a scheduled post let the old text publish → Move back to draft added (K5/K7). B16's badge uses K3's formatter (B16 now blocked by K3).
- **Step 6 C10:** generic banner text replaced with per-status messages + an action slot (edited in place; no issue exists yet).
- **Naming:** "Approve & schedule" renamed to **Schedule** in this file, `pricing-tiers.md`, `GRILLING_GUIDE.md`, Step 4 notes.
- **Demo script:** schedules to a test channel 1 week out, then moves back to draft (H13).
- **H12 done (verified live):** scheduling needs `text` + `saveToDraft: false`; moving back leaves a stale `dueAt`.
- ✅ **Step 4 image rule verified live (2026-11-13):** a LinkedIn draft with 1 image kept its image after `editPost { id, text }`, after scheduling (`text` + `customScheduled` + `saveToDraft: false`), and after moving back to draft (`text` + `saveToDraft: true`). Test draft deleted. So "omit `assets` → kept" holds; only `text` must always be sent. Returned `assets[].id` is `null` (count by list length, B3).

### Tickets
Step 9 drafts 10 tickets (`context/tickets/09-versions-scheduling.md`) + human tickets H12, H13.

---

## Step 10 Decisions: Pages (agreed 2026-11-13)

### Already owned by earlier steps
`/signin` S11 · `/auth/callback` S6 · `/auth/error` S12 · `/app/billing/success` P5 · `/app/billing/canceled` P6 · `/app/settings/billing` P10 · `/app/personas` V12 · composer C1 + B7. Step 10 builds the rest: landing, pricing layout, privacy, terms, 404/error, dashboard list, account settings, app shell, sample post, first-run.

### Decisions
| Topic | Decision |
|---|---|
| Legal pages + prod client | **Left until demo day.** Production only deploys `main` (one release PR on demo day), so `/privacy` + `/terms` go live then; H8 (review + confirm live) → H5 (production Buffer client) run **after** the release merges. Production sign-in doesn't work before that; the localhost demo doesn't need it. |
| Copy files | `src/content/copy.ts` split into `src/content/copy/<area>.ts` (`auth`, `buffer`, `billing`, `composer`, `personas`, `analysis`, `versions`, `pages`) re-exported from `index.ts`, created by I1. Every drafted ticket's file list updated. |
| CMS | **No CMS in MVP.** Payload 3 needs a Next.js host (separate app, its own tables, admin auth): ~½–1 day + a demo-day failure point. Stretch. |
| Lorem ipsum | **Marketing copy** (landing hero, problem/solution, how it works, persona blurbs, FAQ answers, pricing descriptions) = lorem ipsum until the Design Pass picks a brand direction. **Plain working text** for buttons, errors, limits, statuses, empty states (E2E asserts on them). **Real text** for Privacy/Terms. **Real facts** (plan names, prices, limits, channels) from `src/content/plans.ts`. |
| Placeholder blockers | B15, B16, P13 were blocked by an undrafted "Step 10 dashboard placeholder" → now blocked by **G7**. P8 → **G1**. P11 → **G3**. |
| Sample post | `ensureSamplePost` inserts one `is_sample` LinkedIn post (`channel_id` null) from `src/content/sample-post.ts` **only when S7 creates the user**. No seed data, so production works. Deleting it is permanent (restore = stretch). |
| First run | Welcome card at the top of `/app` while the user has the sample and **no other posts** ("Hear the sample post" / "Start your own post"). No stored dismissal. |
| Dashboard | Visible posts (T7) by `last_edited_at` desc; no pagination/search/filters. Row: channel name + service, first ~80 chars or "Empty post", status badge (B16), "Edited {relative}", "Sample" tag, Delete (C13 confirm). Order: welcome → New post → list → locked teaser (P13) → Import from Buffer (B15). Zero posts → empty state; only locked posts → "No posts in the last 30 days / 12 months" + teaser. No Buffer calls on load. |
| App shell | Header on every `/app/*`: Vocelo → `/app`, Posts, Personas, Settings; plan chip (Free: "Free · 3 of 5 posts" + Upgrade; Creator: "Creator") → billing settings. **P11's past_due banner moves into the shell** (every app page, not just billing + composer). |
| Landing | Hero CTA → `/auth/buffer/start?returnTo=/app` (skips `/signin`). Signed-in visitors still see `/`, CTA becomes "Open Vocelo". Persona showcase plays static `/demo/landing-<persona>.mp3`, one at a time; load failure → "Sample unavailable". Pricing section = 3 compact cards with P8 CTAs + "Compare plans". |
| Pricing | Table driven by `src/content/plans.ts`. **Stretch rows omitted** (voice-to-text, heat map, compare, Ideas, brand pack); only Team's column says "Coming soon". `pricing-tiers.md` updated. |
| Legal text | Agent drafts plain-language Privacy + Terms (data stored, processors Buffer/ElevenLabs/Anthropic/Stripe/Netlify/Neon, no selling, deletion via `support@`); human reviews in H8. Not legal advice. |
| 404 / errors / loading | Root `notFoundComponent` + `errorComponent`, inside the app shell under `/app`. Error shows "Reference: {requestId}". Links go to `/app` signed in, `/` signed out. One shared pending component after 300 ms. Titles "{Page} · Vocelo"; `/app/*` is `noindex`; OG images stretch. |
| Account settings | Buffer account name + email, org name, timezone line, dev-key marker, Sign out (S13), Disconnect (S14). Account / Billing tabs shared with P10. Names stored at sign-in so settings never calls Buffer. |

### Schema additions (additive migration, G16)
- `users.buffer_account_name`, `users.buffer_organization_name` (nullable text), written by S7 and `/__dev/login` on every sign-in.

### Conflicts flagged
- **H5/H8 vs. release timing:** H8 said legal pages must be public before H5, but `main` only deploys on demo day → both moved to after the release PR (`00-human.md`).
- **`copy.ts`:** one shared file in nearly every ticket → per-area files (I1 amended; tickets updated).
- **Undrafted "Step 10 placeholder" blockers** in B15, B16, P8, P13 → re-pointed to G1/G7.
- **P11 scope:** banner moved from billing + composer to the app shell (G3).
- **`pricing-tiers.md`:** "show stretch features as coming soon" → omitted from `/pricing`.
- **Sample post:** bible said "from seed data"; it's created in code by `ensureSamplePost`.

### Tickets
Step 10 drafts 18 tickets (`context/tickets/10-pages.md`). H5 + H8 rewritten in `00-human.md`.

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
| Buffer drafts | Create; `editPost` sends only `id` + `text` (assets never sent); double-save → one Buffer draft; draft deleted in Buffer → recreated; not `draft` → blocked + "Save as a new draft"; channel disconnected/locked → saving disabled; unchanged text skips Buffer; version written only on changed-text save; `MutationError` message shown; import once (unique constraint), sets import time + version 1; unsupported channels disabled; 31st Buffer write in an hour rejected |
| Character limits | At the limit, over by 1, per channel; X weighted count, LinkedIn URL = 24, Bluesky graphemes, emoji = 2 UTF-16, Mastodon `maxCharacters`; server re-checks on save; over-limit import blocks saving |
| Composer | `normalizeText` (CRLF, NFC, no trim) + same hash on client and server; autosave bumps `last_edited_at` only on change; 20,000 cap; `EDIT_CONFLICT` on stale `baseEditedAt`; local backup restore + expiry + keyed by user; signed-out dialog keeps text; sample read-only; locked → redirect, other user's → 404; delete keeps `usage_events` with `post_id = NULL` |
| Usage + plans | Check-then-consume is atomic (concurrent requests can't overspend); refund on provider failure; "too big for what's left" blocks with no partial read; cached replays, imports, and the sample post never count; first billable action counts the post once per period; Free vs. Creator limits; effective plan for `active` / `trialing` / `past_due` / canceled |
| Usage periods | Signup on the 31st resets on the last day of shorter months; upgrade starts a new period; cancel keeps paid until period end |
| History window | `last_edited_at` at 29 / 30 / 31 days (Free) and 12 months (Creator); sample post exempt; upgrade reveals locked posts; Free sees last 3 versions only (others hidden, not deleted) |
| Billing | Webhook signature check (raw body); idempotency via `stripe_events` in the same transaction; out-of-order events can't roll back (re-fetch); unknown customer → 200; success page before the webhook lands; already-Creator can't open Checkout; canceling / past_due / canceled status mapping; Free period restarts when a subscription ends; Customer Portal link + fake-customer message; all 7 test presets |
| Personas | Standard personas exist via migration; Creator limit of 5 custom (concurrent creates can't make a 6th); Free blocked + `PERSONA_LOCKED`; field validation; edit bumps `updated_at`; soft delete keeps old reactions' names; downgrade locks custom personas |
| Playback | Audio cache key hit = no ElevenLabs call and no usage; highlight-to-hear consumes only selected characters; over-channel-limit read rejected; stale selection rejected; provider failure refunds; sample post never consumes; `/api/audio` requires sign-in |
| Reactions + Tone read | Schema-valid JSON parsed; invalid JSON → retry once → friendly error, nothing consumed; cache by text hash; "Text changed: refresh"; 60 LLM calls / hour cap |
| Versions + scheduling | Version only on successful Buffer save + changed text; restore doesn't rewrite history; Free sees newest 3 + hidden version restore rejected; restore confirm when text ≠ newest version; Schedule = save + schedule as **1** Buffer write; `dueAt` 5 min–1 year (fixed clock); times shown in `users.timezone` ?? browser incl. a DST change; `LimitReachedError` leaves a saved draft; paused queue warns, doesn't block; `needs_approval` result; Move back to draft branches (scheduled / draft / sent / not found) |
| Pages | E2E happy path per page; empty, loading, and limit-reached states render; protected routes redirect to sign-in |

#### E2E flows (Playwright)
1. Sign in (test helper) → sample post → hear a standard persona (static demo audio)
2. New post → pick channel → over the character limit blocks save → fix → save draft (Buffer mocked)
3. Free user hits the reviewed-posts limit → upgrade prompt → fixture webhook → Creator → create a custom persona
4. Edit + save twice → version history → restore → save creates a new version
5. Schedule → "Scheduled for…" banner → Move back to draft (Buffer mocked)
6. Free user: posts older than 30 days are locked; teaser card shows the count
- [ ] **Test data + seed script** (`npm run seed`, runs against the Neon `dev` branch, never production)
  - **Text-only post:** a realistic LinkedIn-length post (~800 characters) with a few lines that read differently by persona (e.g., one humblebrag, one unclear sentence)
  - **Imported Buffer draft with 2 images:** tests that saving from Vocelo preserves Buffer images
  - A short X-length post (under 280 characters) to test character limits
  - Seeded users for all 7 billing presets (`free`, `free-at-limit`, `free-low-chars`, `free-downgraded`, `creator`, `creator-canceling`, `creator-past-due`; Step 5), shared with `createTestUser({ preset })` and `/__test/login?user=<key>`
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
- [ ] Stripe customer linked to the Vocelo user ID (created on the first "Upgrade" click; Step 5)
- [ ] Dev-only fallback: personal API key in `.env.local` powers `/__dev/login` (not exposed to users; build fails if set in Netlify)
- [ ] Organization lookup → `organizationId` (needed for drafts): auto-pick the owned org, else the first; switching is stretch

### 3. Billing (Stripe)
Full rules: "Step 5 Decisions". Tickets: `context/tickets/05-billing.md`.
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
- [ ] Usage tracking + counters ("6,200 of 12,000 voice characters left"), reset per **usage period** (Free: signup anniversary; paid: Stripe billing period; see Kickoff Decisions)
- [ ] Locked-feature UI + upgrade prompts
- [ ] Stripe test mode for demo (card `4242 4242 4242 4242`)

### 4. Buffer Integration
Full rules: "Step 4 Decisions".
- [ ] List channels (10-min DB cache + Refresh) + channel picker: supported text-first channels selectable; unsupported, disconnected, and locked channels shown disabled
- [ ] Per-channel character counting (`src/lib/char-count.ts`), re-checked server-side on save
- [ ] One Vocelo post = one channel = one Buffer draft
- [ ] Create draft — `createPost` with `saveToDraft: true` (first explicit "Save draft")
- [ ] Update draft on save — `editPost` with `id` + `text` only (Vocelo wins; omitted assets survive in Buffer)
  - Pre-save check: deleted → recreate; not `draft` → blocked, "Save as a new draft"; channel disconnected → blocked
  - Drafts with attachments show "📎 N attachments, edit them in Buffer"
- [ ] Status sync on composer open (no webhooks); dashboard status badges
- [ ] Import existing drafts — `posts` query (copies the draft into Vocelo once, creates version 1)
- [ ] 30 Buffer writes / hour / user safety cap

### 5. Composer
Full rules: "Step 6 Decisions". Tickets: `context/tickets/06-composer.md`.
- [ ] Plain textarea editor with selection tracking; autosave to Vocelo (Buffer only on "Save draft"), local backup, two-tab conflict prompt
- [ ] Signed-out dialog that keeps text; "not a draft in Buffer" banner; Cmd/Ctrl+S; delete post
- [ ] **Per-channel character limits** (X: 280, etc.) with a live count; block saving to a channel when over its limit. Counting comes from Step 4's `src/lib/char-count.ts`; the Composer only renders it
- [ ] "Feeling stuck?" hint (shown only while the post is blank): suggest speaking the post with Wispr Flow or OS dictation, then pasting it in (no built-in voice-to-text in MVP)

### 6. Personas
Full rules: "Step 7 Decisions". Tickets: `context/tickets/07-personas-playback.md`.
- [ ] Persona model: name, bio, voice avatar (icon from a fixed set), ElevenLabs voice ID, reader description, `updated_at` (reaction prompts built in code, Step 8)
- [ ] 3 standard personas on every plan: The Skeptic, The Scroller, The Fan
- [ ] Persona picker (voice avatar cards; remembered per post; locked cards on Free)
- [ ] Custom personas — Creator, max 5 (name, bio, "Who is this reader?", icon, voice from ~8 with static previews); edit + soft delete. **Never cut** (demo upgrade trigger).

### 7. Playback
- [ ] Read full post in persona's voice (ElevenLabs TTS, Flash model), capped at the channel's character limit
- [ ] Highlight-to-hear (read selection only; works even when the post is over the limit)
- [ ] Simple "speaking" indicator on the active voice avatar (e.g., glow or pulse — no character animation)
- [ ] Audio caching (don't regenerate unchanged text; shared across users; hits are free)
- [ ] Static audio (voice previews, landing clips, sample post reads) generated once by `npm run audio:static`

### 8. Analysis
- [ ] Persona reaction (LLM, 1–2 sentences); Free = 3 standard personas, Creator = + custom
- [ ] **Tone read** — one label (fixed list) + summary for the whole post (per-sentence "tone heat map" is stretch)

### 9. Versions & Publishing
Full rules: "Step 9 Decisions"; the why: `context/versions-scheduling.md`. Tickets: `context/tickets/09-versions-scheduling.md`.
- [ ] Version history panel: preview + restore (Free: newest 3, older locked)
- [ ] Schedule: "Add to queue" or "Pick a time" (`editPost` with `mode` + `dueAt`), saving the text first
- [ ] Move back to draft for scheduled posts

### 10. Pages & Copy
**Copy is written separately.** Build every page with placeholder copy from **one file per area** (`src/content/copy/<area>.ts`, re-exported from `src/content/copy/index.ts`; Step 10), so final copy can be dropped in without touching components and parallel tickets don't conflict. **Marketing copy is lorem ipsum** until the Design Pass; plan facts come from `src/content/plans.ts`. No CMS in MVP.

#### Public pages
- [ ] **Landing page** (`/`)
  - Hero: headline, subhead, "Sign in with Buffer" CTA
  - Problem → solution ("Everyone helps you decide *what* to post. Vocelo shows you how it *lands*.")
  - How it works (3 steps: write your post → hear it from different personas → fix it, schedule in Buffer)
  - Persona showcase (the 3 standard voice avatars, each with a short audio sample)
  - Supported channels (LinkedIn, X, Substack Notes, Threads, Bluesky, Mastodon)
  - Pricing section (or link to `/pricing`); Team shown as "Coming soon"
  - FAQ (incl. "Does this change my Buffer drafts?" and "What happens to my posts on Free?")
  - Footer: Privacy, Terms, contact
- [ ] **Pricing** (`/pricing`): 3 tiers, feature comparison from `src/content/plans.ts` (**no stretch rows**; Step 10), Creator CTA → Stripe Checkout, Team "Coming soon"
- [ ] **Privacy Policy** (`/privacy`) and **Terms** (`/terms`): needed for the production Buffer OAuth app client; agent-drafted plain-language text, human-reviewed (H8); live only after the demo-day release
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
  - Schedule in Buffer + Move back to draft
- [ ] **Personas** (`/app/personas`): standard personas + custom voice avatar builder (locked on Free)
- [ ] **Settings → Account** (`/app/settings`): Buffer connection status, sign out, disconnect Buffer
- [ ] **Settings → Billing** (`/app/settings/billing`): current plan, usage meters, upgrade, Stripe Customer Portal link
- [ ] **Checkout success / canceled** (Stripe return pages)

#### Shared states (every app page)
- [ ] Empty states (no posts yet, no custom personas yet, no Buffer drafts to import)
- [ ] Loading states
- [ ] Limit-reached states with upgrade prompts
- [ ] First-run welcome: a card on `/app` while the user has only the sample post (created by `ensureSamplePost` on sign-up, not seed data) so they hear a persona within the first minute

### 11. Demo & Pitch
- [ ] Demo script (runs on localhost:3000; checklist in `context/environments.md`): Sign in with Buffer (Free) → hit limit → Stripe upgrade → custom persona → review post → schedule (Pick a time, 1 week out, test channel) → Move back to draft
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

### Pages (added in Step 10)
- [ ] Payload CMS for marketing copy (needs a separate Next.js app; MVP uses `src/content/copy/*`)
- [ ] "Restore sample post" after deleting it
- [ ] Dashboard pagination, search, and filters
- [ ] OG images / social share cards
- [ ] Stretch-feature rows on `/pricing` ("Coming soon")

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
| Composer / review | `/app/posts/new`, `/app/posts/:id` | Write, character limits, personas, read aloud, reactions, Tone read, versions, schedule | Usage limits + persona limits by plan |
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