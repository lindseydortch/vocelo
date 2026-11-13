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

**Stack:** TanStack Start (React) · SCSS/Sass modules (`*.module.scss`) · Buffer GraphQL API · ElevenLabs (text-to-speech only) · LLM for reactions/tone · Stripe · Buffer OAuth for login (verified) · Neon (Postgres database) · Cloudflare R2 (image storage, **stretch**)

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
- **"Reviewed post"** = a post counts once, on its **first TTS read** within the user's usage period.
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
3. Decide hosting + LLM provider (grilling Step 1), then create the hosting project
4. Create Stripe Creator product/price (test mode)
5. Buy ElevenLabs Starter ($6); pick 3 stock voice IDs for standard personas
6. Publish `/privacy` + `/terms` at real URLs (Buffer app client + Stripe need them)

### Ticket budget
~3 parallel lanes × ~10 h ÷ ~1.5 h/ticket ≈ **20 tickets**. The current MVP is ~4 tickets over. Cut order is in section 12.

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
- **Step 1 (data model):** where cached TTS audio is stored; LLM output JSON schema for reactions + Tone read; Free "last 3 versions": hidden or deleted beyond 3 (incl. after downgrade)
- **Step 3 (sign-in):** DB lock for single-use refresh tokens; users with multiple Buffer organizations
- **Step 5 (billing):** Stripe webhook idempotency; success page loading before the webhook lands; atomic check-then-consume on usage counters
- **Step 9 (scheduling):** timezone for `dueAt`
- **Step 10 (pages):** first-run sample post in production (seed data only exists on the `dev` branch)

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
  - Enforced server-side in every query that lists posts, versions, or reactions (filter by `created_at` against the user's plan)
  - Locked teaser card: "🔒 N posts older than 30 days. Upgrade to see them" → Stripe Checkout
  - UI note that Buffer drafts are unaffected and always remain in Buffer
  - Locked data is hidden, not deleted (upgrading unlocks it instantly)
- [ ] Posts-reviewed limit (Free: 10 per usage period); a post counts on its **first TTS read**
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
