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

**Stack:** TanStack Start (React) · SCSS/Sass modules (`*.module.scss`) · Buffer GraphQL API · ElevenLabs (text-to-speech + Scribe speech-to-text) · LLM for reactions/tone · Stripe · Buffer OAuth for login · Neon (Postgres database) · Cloudflare R2 (public image storage)

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
  - Exception: tone heat map semantic colors get placeholder tokens too (`$tone-positive`, `$tone-neutral`, `$tone-negative`).
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
  - Keep the domain registered at Namecheap, but point its **nameservers to Cloudflare** (free plan). R2 custom domains require the domain to be managed in the same Cloudflare account.
  - In Namecheap: Domain List → Manage → Nameservers → Custom DNS → paste the 2 Cloudflare nameservers. Changes can take up to 24–48 hours, so do this first.
  - After switching, manage **all** DNS records in Cloudflare (Namecheap's DNS settings stop applying):
    - `images.<domain>` → R2 bucket custom domain
    - Root domain + `www` → hosting provider (follow its DNS instructions; some hosts want Cloudflare's proxy turned off for their records)
    - Email: Namecheap email forwarding stops working; use Cloudflare Email Routing (free) for addresses like `hello@` / `support@`
  - Fallback if DNS isn't ready in time: use R2's `r2.dev` URL temporarily (development only)
- [ ] Server-side API proxy via TanStack Start server functions (no keys in the browser)
- [ ] Stripe webhook as a TanStack Start server route (needs raw request body for signature verification)
- [ ] Database (Neon Postgres): users, Buffer tokens (encrypted), subscriptions, personas, versions, reactions, usage, image records (URL + key only, never the image file itself)
  - Use a Neon branch per environment (`dev`, `main`) so preview deploys never touch production data
- [ ] Error handling + loading states (Buffer `MutationError`, ElevenLabs rate limits, LLM failures)
- [ ] Demo fallback mode (pre-generated audio + reactions for a sample post)
- [ ] **Test data + seed script** (`npm run seed`, runs against the Neon `dev` branch, never production)
  - **Text-only post:** a realistic LinkedIn-length post (~800 characters) with a few lines that read differently by persona (e.g., one humblebrag, one unclear sentence)
  - **Post with images:** a shorter post with 2 images attached
  - A short X-length post (under 280 characters) to test character limits
  - Seeded test user on the Free plan, plus one on Creator, to test plan gating
  - Posts backdated 45 days and 13 months, to test the history window locks
  - Pre-generated persona reactions + tone results for the sample posts (used by Playwright tests and demo fallback mode)
  - Image fixtures in `fixtures/images/`: use your own photos or images you create (no copyrighted images)
    - A normal JPG and PNG
    - A large photo (5 MB+) to test compression
    - A non-image file renamed to `.jpg` to test validation rejects it
  - Playwright tests use the seeded data so they never call ElevenLabs or the LLM (saves credits)

### 2. Auth & Accounts
- [ ] **"Sign in with Buffer" is the only login** (no separate auth provider; every Vocelo user is a Buffer user)
  - Buffer OAuth 2.0 (Authorization Code + PKCE)
  - Register an App Client in Buffer Settings → API (redirect URIs for localhost + production)
  - Scopes: `account:read`, `posts:read`, `posts:write`, `ideas:read`, `offline_access`
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
- [ ] Organization lookup → `organizationId` (needed for drafts + ideas)
- [ ] ElevenLabs single-use token endpoint (client-side Scribe streaming)

### 3. Billing (Stripe)
- [ ] Stripe Products/Prices: Creator + Team (see `pricing-tiers.md`)
- [ ] Pricing page → Stripe Checkout
- [ ] Stripe webhook → update user plan (subscribed, renewed, canceled, payment failed)
- [ ] Stripe Customer Portal link (manage/cancel)
- [ ] Plan stored on user record (default: Free)
- [ ] Server-side plan + usage enforcement before every TTS / reaction / STT call
- [ ] **History window by plan** (Free: 30 days, Creator: 12 months, Team: unlimited)
  - Enforced server-side in every query that lists posts, versions, or reactions (filter by `created_at` against the user's plan)
  - Locked teaser card: "🔒 N posts older than 30 days. Upgrade to see them" → Stripe Checkout
  - UI note that Buffer drafts are unaffected and always remain in Buffer
  - Locked data is hidden, not deleted (upgrading unlocks it instantly)
- [ ] Posts-reviewed limit (Free: 10/month) tracked with the other usage counters
- [ ] Usage tracking + counters, monthly reset ("6,200 of 8,000 voice characters left")
- [ ] Locked-feature UI + upgrade prompts
- [ ] Stripe test mode for demo (card `4242 4242 4242 4242`)

### 4. Buffer Integration
- [ ] List channels + channel picker, **filtered to supported text-first channels** (hide unsupported channels, or show them disabled with "Not supported yet")
- [ ] Create draft — `createPost` with `saveToDraft: true`
- [ ] Load existing drafts — `posts` query
- [ ] Update draft on save — `editPost`
- [ ] Pull from Ideas — `ideas` query (requires `organizationId`)

### 4b. Images
Buffer's API has **no upload endpoint**. Images must be hosted by us at a **public, stable URL** (no sign-in, no expiring/signed URLs), because Buffer fetches the file when the post publishes.

- [ ] Image storage: **public Cloudflare R2 bucket** (S3-compatible; free egress)
  - Serve through a custom domain (e.g., `images.vocelo.<tld>`); the default `r2.dev` URL is meant for development only
  - Upload from the server with the S3 SDK (R2 credentials stay server-side)
  - Unguessable file names (UUIDs), since public URLs are viewable by anyone with the link
  - URLs must not expire
- [ ] **Compress in the browser before upload** (free; keeps us inside R2's 10 GB free tier)
  - Use a library like `browser-image-compression`
  - Resize so the longest side is at most 2048px
  - Convert photos to JPEG at ~80% quality (typically ~200–400 KB per image, vs. 3–8 MB from a phone)
  - Keep PNG for graphics/screenshots only if they're smaller than the JPEG version
  - At ~300 KB per image, 10 GB holds roughly 30,000+ images
- [ ] Server function: upload image → validate → store → return public URL
  - Validate type (JPG, PNG, GIF, WebP) by checking the file contents, not just the extension
  - Reject anything over 2 MB after compression (protects storage if someone bypasses the browser)
- [ ] Composer: add images via file picker + drag and drop
  - Thumbnail previews, remove, reorder (order matters in Buffer)
  - Cap images per post (e.g., 4, to stay within X's limit)
- [ ] Save to Buffer: `createPost` / `editPost` with `assets: [{ image: { url } }]`
- [ ] Load drafts with their images
- [ ] Version history snapshots include image URLs
- [ ] Note: a post can't have both images and a link preview card (Buffer treats them as mutually exclusive)

### 5. Composer
- [ ] Text editor with selection tracking
- [ ] 4–6 starter templates (hook + story, hot take, announcement, lesson learned)
- [ ] Voice-to-text: ElevenLabs Scribe v2 Realtime → insert at cursor
- [ ] Fallback: browser Web Speech API

### 6. Personas
- [ ] Persona model: name, bio, voice avatar (static image/icon), ElevenLabs voice ID, reaction prompt
- [ ] 3 standard personas (Free)
- [ ] Persona picker (voice avatar cards)
- [ ] Custom voice avatars — paid tiers (name, bio, pick an image/icon, pick an ElevenLabs voice)

### 7. Playback
- [ ] Read full post in persona's voice (ElevenLabs TTS, Flash model)
- [ ] Highlight-to-hear (read selection only)
- [ ] Simple "speaking" indicator on the active voice avatar (e.g., glow or pulse — no character animation)
- [ ] Audio caching (don't regenerate unchanged text)

### 8. Analysis
- [ ] Persona reaction (LLM, 1–2 sentences), gated by plan
- [ ] Tone heat map — whole post

### 9. Versions & Publishing
- [ ] Version history: snapshot + restore (Free: last 3)
- [ ] Approve & schedule — `editPost` with `mode` + `dueAt`

### 10. Pages & Copy
**Copy is written separately.** Build every page with placeholder copy pulled from one file (e.g., `src/content/copy.ts`), so final copy can be dropped in without touching components.

#### Public pages
- [ ] **Landing page** (`/`)
  - Hero: headline, subhead, "Sign in with Buffer" CTA
  - Problem → solution ("Everyone helps you decide *what* to post. Vocelo shows you how it *lands*.")
  - How it works (3 steps: write or speak your post → hear it from different personas → fix it, approve, schedule in Buffer)
  - Persona showcase (the 3 standard voice avatars, each with a short audio sample)
  - Supported channels (LinkedIn, X, Substack Notes, Threads, Bluesky, Mastodon)
  - Pricing section (or link to `/pricing`)
  - FAQ (incl. "Does this change my Buffer drafts?" and "What happens to my posts on Free?")
  - Footer: Privacy, Terms, contact
- [ ] **Pricing** (`/pricing`): 3 tiers, feature comparison, upgrade CTAs → Stripe Checkout
- [ ] **Privacy Policy** (`/privacy`) and **Terms** (`/terms`): needed for the Buffer OAuth app client and Stripe
- [ ] **404 / error page**

#### Auth pages
- [ ] **Sign in** (`/signin`): single "Sign in with Buffer" button + one line on what Vocelo can access
- [ ] **OAuth callback** (`/auth/callback`): loading state, then redirect to the app
- [ ] **Auth error**: "Couldn't connect to Buffer" + retry

#### App pages (signed in)
- [ ] **Posts dashboard** (`/app`): list of posts (status, channel, last edited), "New post" button, Buffer drafts to import, Buffer Ideas to start from, locked history card
- [ ] **Composer / review workspace** (`/app/posts/:id`): the main screen
  - Left: channel picker, editor, voice-to-text, images, character count, save draft
  - Right: persona picker, read aloud, highlight-to-hear, reactions, tone heat map
  - Version history panel (restore)
  - Approve & schedule
- [ ] **Personas** (`/app/personas`): standard personas + custom voice avatar builder (locked on Free)
- [ ] **Settings → Account** (`/app/settings`): Buffer connection status, sign out, disconnect Buffer
- [ ] **Settings → Billing** (`/app/settings/billing`): current plan, usage meters, upgrade, Stripe Customer Portal link
- [ ] **Checkout success / canceled** (Stripe return pages)

#### Shared states (every app page)
- [ ] Empty states (no posts yet, no custom personas yet, no Ideas in Buffer)
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
  - Keep the brand color distinct from the tone heat map colors
- [ ] Fonts (headings + body)
- [ ] Logo / wordmark + favicon
- [ ] Voice avatar artwork for the 3 standard personas
- [ ] Polish: hover/focus states, transitions, the "speaking" indicator
- [ ] Mobile pass (separate ticket, see desktop-first rule)

**If time runs short, cut in this order:** speaking indicator → starter templates → Ideas pull.
**Never cut:** auth, Stripe, Buffer draft flow.

---

## Stretch Goals

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
- [ ] Tone heat map per sentence / paragraph
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
- [ ] Per-channel character limits (X: 280; strongly consider pulling into MVP since X and LinkedIn are both targets)
- [ ] Instagram "caption mode" (requires an image on every post)
- [ ] Link preview cards (`linkAttachment`) for LinkedIn, Substack, Threads, Bluesky

### Images
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
| Posts dashboard | `/app` | All posts, new post, import Buffer drafts, start from Ideas | Free: last 30 days visible, older posts locked |
| Composer / review | `/app/posts/new`, `/app/posts/:id` | Write, voice-to-text, images, personas, read aloud, reactions, tone, versions, approve & schedule | Usage limits + persona limits by plan |
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
| `/api/elevenlabs/token` | Single-use token for browser speech-to-text |

**Total:** 5 public pages, 3 sign-in pages, 7 app pages (15 pages), plus 3 server routes.