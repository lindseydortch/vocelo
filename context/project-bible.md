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

**Stack:** TanStack Start (React) · SCSS/Sass modules (`*.module.scss`) · Buffer GraphQL API · ElevenLabs (text-to-speech only) · Anthropic `claude-haiku-5-5` for reactions/Tone read · Stripe · Buffer OAuth for login (verified) · Neon (Postgres) via Drizzle ORM · **Netlify** hosting · Netlify Blobs (audio cache) · Cloudflare R2 (image storage, **stretch**)

**Vocabulary:** `GLOSSARY.md` (repo root) defines Post, Buffer draft, Persona, Voice avatar, Reviewed post, Usage period, Locked, etc. Use those words in code and tickets.

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
2. Point Namecheap nameservers to Cloudflare (24–48 h propagation)
3. ~~Decide hosting + LLM provider~~ ✅ Netlify + Anthropic Haiku 5.5 (Step 1). Create the Netlify site + Anthropic API key
4. Create Stripe Creator product/price (test mode)
5. Buy ElevenLabs Starter ($6); pick 3 stock voice IDs for standard personas
6. Publish `/privacy` + `/terms` at real URLs (Buffer app client + Stripe need them)

### Ticket budget
~3 parallel lanes × ~10 h ÷ ~1.5 h/ticket ≈ **20 tickets**. The ~1.5 h per ticket **includes writing its tests**; don't budget tests as separate tickets. The current MVP is ~4 tickets over. Cut order is in section 12.

### Critical path
```
Before build day: Buffer app client test · DNS · hosting · Stripe product · ElevenLabs voices · LLM key
        ↓
Scaffold (merges alone) → DB schema + usage/plan module STUB (everyone = Free, no limits)
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
- **Step 3 (sign-in):** DB lock for single-use refresh tokens; users with multiple Buffer organizations
- **Step 5 (billing):** Stripe webhook idempotency; success page loading before the webhook lands; atomic check-then-consume on usage counters
- **Step 9 (scheduling):** timezone for `dueAt`
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
- **Drizzle ORM** + Neon serverless driver; `drizzle-kit` migrations committed to the repo; UUID primary keys (post URLs are unguessable).
- **Cached audio:** Netlify Blobs, format `mp3_44100_64` (~8 KB per second of speech), served through a server function (private). Demo + sample audio are static files in `/public/demo/`.
- **No tables for** audio (Blobs), sessions (encrypted cookie), or OAuth state (short-lived cookie). Images are stretch.

### Schema
| Table | Key columns |
|---|---|
| `users` | `id`, `buffer_account_id` (unique), `email?`, `buffer_organization_id`, `plan`, `stripe_customer_id?`, `stripe_subscription_id?`, `subscription_status?`, `current_period_start/end?`, `cancel_at_period_end`, `period_anchor_at`, `created_at` |
| `buffer_connections` | `user_id` (1:1), `access_token_enc`, `refresh_token_enc`, `access_expires_at`, `scopes`, `updated_at`. Deleted on Disconnect. |
| `posts` | `id`, `user_id`, `channel_id`, `channel_service`, `channel_name`, `buffer_post_id?`, `buffer_status?` (draft / scheduled / sent), `due_at?`, `text`, `reaction_persona_id?`, `is_sample`, `created_at`, `last_edited_at`. Unique (`user_id`, `buffer_post_id`). |
| `versions` | `id`, `post_id`, `text`, `text_hash`, `created_at` |
| `personas` | `id`, `user_id?` (null = standard), `name`, `bio`, `avatar_key`, `elevenlabs_voice_id`, `reader_description`, `reaction_prompt`, `created_at`, `deleted_at?` |
| `reactions` | `id`, `post_id`, `persona_id`, `text_hash`, `reaction`, `sentiment`, `model`, `created_at`. Unique (`post_id`, `persona_id`, `text_hash`). |
| `tone_reads` | `id`, `post_id`, `text_hash`, `label`, `sentiment`, `summary`, `model`, `created_at`. Unique (`post_id`, `text_hash`). |
| `usage_events` | `id`, `user_id`, `kind` (`tts_chars` / `post_review` / `llm_call`), `amount`, `post_id?` (set null on delete), `created_at` |
| `stripe_events` | `id` (Stripe `evt_…`), `type`, `processed_at` |

### Ticket budget impact
Step 1 drafts 8 tickets (`context/tickets/01-data-model.md`). They replace the single "DB schema + usage/plan module STUB" box on the critical path, so the MVP is now roughly **10 tickets over** the ~20 budget. Revisit the cut order after Step 2.

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
- [ ] **Domain + DNS (domain registered at Namecheap)**
  - Keep the domain registered at Namecheap, but point its **nameservers to Cloudflare** (free plan). Needed for hosting in MVP; also required later for R2 custom domains (images are stretch).
  - In Namecheap: Domain List → Manage → Nameservers → Custom DNS → paste the 2 Cloudflare nameservers. Changes can take up to 24–48 hours, so do this first.
  - After switching, manage **all** DNS records in Cloudflare (Namecheap's DNS settings stop applying):
    - `images.<domain>` → R2 bucket custom domain (stretch, with images)
    - Root domain + `www` → hosting provider (follow its DNS instructions; some hosts want Cloudflare's proxy turned off for their records)
    - Email: Namecheap email forwarding stops working; use Cloudflare Email Routing (free) for addresses like `hello@` / `support@`
  - Fallback if DNS isn't ready in time: use the hosting provider's default URL
- [ ] Server-side API proxy via TanStack Start server functions (no keys in the browser)
- [ ] Stripe webhook as a TanStack Start server route (needs raw request body for signature verification)
- [ ] Database (Neon Postgres): users, Buffer tokens (encrypted), subscriptions, personas, versions, reactions, usage (image records are stretch)
  - Use a Neon branch per environment (`dev`, `main`) so preview deploys never touch production data
- [ ] Error handling + loading states (Buffer `MutationError`, ElevenLabs rate limits, LLM failures)
- [ ] Demo fallback mode (pre-generated audio + reactions for a sample post)
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
  - **CI database:** a dedicated Neon `ci` branch, reset and re-seeded per run (never `dev` or `main`); Drizzle migrations run first
  - **E2E sign-in helper:** E2E tests can't complete real Buffer OAuth (it only works on port 3000, and tests must not hit Buffer). Add a **test-only** route or fixture that creates a seeded user's session cookie. It must be impossible to enable in production (guarded by an env flag that's never set on Netlify production, plus a check that fails the build if it is).
  - **Stripe in tests:** never drive the hosted Checkout page. Test plan changes by sending **signed fixture webhook events** to `/api/stripe/webhook` (valid signature, invalid signature, duplicate event ID for idempotency, each handled event type).
  - **Fixed clock** in tests for usage periods, history windows, and anniversary resets (e.g., Vitest fake timers or an injectable `now()`)
  - **Shared test helpers:** `createTestUser({ plan })`, `createTestPost({ lastEditedAt })`, Buffer/Stripe/ElevenLabs/Anthropic MSW handlers with success + error variants

#### What every feature area must test
| Area | Must cover |
|---|---|
| Sign-in | State mismatch rejected; PKCE exchange; find-or-create user by `buffer_account_id`; refresh rotation with the DB lock (two concurrent refreshes → one wins); refresh failure ends session; sign out vs. disconnect |
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
  - Scopes: `account:read`, `posts:read`, `posts:write`, `offline_access` (add `ideas:read` with the Ideas stretch goal)
  - Server route: start auth (`state` + PKCE challenge) → callback (verify `state`, exchange code + verifier)
  - On callback: query the Buffer `account` to get a stable account ID (+ email if available), then **find or create the Vocelo user keyed by Buffer account ID**
    - Confirm in the Buffer API Explorer which `account` fields are returned
  - Create a Vocelo session: encrypted, HttpOnly, Secure, SameSite=Lax cookie holding only the user ID (never Buffer tokens)
  - Store Buffer access + refresh tokens encrypted in the database, server-side only
  - Token refresh (~1 hr access tokens; refresh tokens are single-use and rotate, so only one server function refreshes)
  - If refresh fails or the user revokes access: end the session and send them back to "Sign in with Buffer"
  - Sign out (clears session) vs. Disconnect (also deletes stored Buffer tokens)
  - Protected routes: redirect to sign-in when there's no session
- [ ] Stripe customer linked to the Vocelo user ID (created at first checkout)
- [ ] Dev-only fallback: personal API key in `.env.local` for local testing (not exposed to users)
- [ ] Organization lookup → `organizationId` (needed for drafts)

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
- [ ] **OAuth callback** (`/auth/callback`): loading state, then redirect to the app
- [ ] **Auth error**: "Couldn't connect to Buffer" + retry

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
- [ ] Demo script: Sign in with Buffer (Free) → hit limit → Stripe upgrade → custom persona → review post → approve & schedule
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
| OAuth callback | `/auth/callback` | Loading state while connecting, then redirect to `/app` |
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