# Vocelo Environments

What each environment uses, where every secret lives, and the setup and demo-day checklists. Decisions behind this are in `project-bible.md` → "Step 2 Decisions". Secrets are **never** committed; `.env.example` lists every variable with a dummy value.

## The environments

| | **Local dev** | **Tests** (Vitest) | **E2E** (Playwright, local + CI) | **CI** (GitHub Actions) | **Production** (Netlify) | **Demo** (demo day) |
|---|---|---|---|---|---|---|
| Runs from | Any branch, `npm run dev:ticket` | `npm test` | `npm run test:e2e` | PRs into `dev` / `main` | `main` only | `dev`, main folder, port **3000** |
| URL | `https://localhost:$PORT` (3000 + issue #) | n/a | `https://localhost:$PORT` | n/a | `https://<site>.netlify.app` (custom domain later) | `https://localhost:3000` |
| Database | Neon **`dev`** branch (shared, seeded) | `embedded-postgres`, throwaway per run | `embedded-postgres` | `embedded-postgres` | Neon **`main`** branch | Neon **`dev`** branch |
| Buffer | **Dev** app client (sign-in only completes on port 3000) | MSW mocks | MSW mocks + `/__test/login` | MSW mocks | **Prod** app client | **Dev** app client |
| Stripe | Test keys + `stripe listen` | Signed fixture events | Signed fixture events | Signed fixture events | Test keys, Netlify webhook endpoint | Test keys + `stripe listen` |
| `TTS_PROVIDER` | `browser` | `fixture` | `fixture` | `fixture` | `elevenlabs` | `elevenlabs` (**demo** key) |
| `LLM_PROVIDER` | `anthropic` | `fixture` | `fixture` | `fixture` | `anthropic` | `anthropic` |
| Audio cache | Netlify Blobs (emulated by the Vite plugin) | In-memory fake (Step 7) | Emulated | In-memory fake | Netlify Blobs | Emulated |
| `E2E_AUTH` | unset | unset | `1` | `1` | **never** (build fails if set) | unset |
| Secrets live in | `.env.local` | none | none | none (no repo secrets needed) | Netlify env vars (Production context) | `.env.local` |

## Environment variables

| Variable | Local / demo (`.env.local`) | Production (Netlify) | Notes |
|---|---|---|---|
| `APP_URL` | `https://localhost:3000` | `https://<site>.netlify.app` | Builds OAuth redirect + Stripe return URLs |
| `DATABASE_URL` | Neon `dev` pooled string | Neon `main` pooled string | Tests ignore it and use `embedded-postgres` |
| `SEED_ALLOWED_HOST` | Neon `dev` endpoint host | **never set** | `npm run seed` refuses without a match |
| `SESSION_SECRET` | random, local-only | random, different | Encrypts the session cookie |
| `TOKEN_ENCRYPTION_KEY` | random, local-only | random, different | Encrypts Buffer tokens at rest |
| `BUFFER_CLIENT_ID` / `BUFFER_CLIENT_SECRET` | Dev client | Prod client | Both required: confidential client + PKCE (Step 3) |
| `BUFFER_API_KEY` | optional, personal key | **never set** (build fails if set) | Enables `/__dev/login` so worktree ports can sign in without OAuth (Step 3) |
| `STRIPE_SECRET_KEY` | test key | test key | Live keys are stretch |
| `STRIPE_WEBHOOK_SECRET` | from `stripe listen` | from the Netlify endpoint in the Stripe dashboard | Different values |
| `STRIPE_CREATOR_PRICE_ID` | test price | same test price | |
| `TTS_PROVIDER` | `browser` (demo day: `elevenlabs`) | `elevenlabs` | `browser` \| `elevenlabs` \| `fixture` |
| `ELEVENLABS_API_KEY` | local key (demo day: demo key) | prod key | Required only when `TTS_PROVIDER=elevenlabs` |
| `LLM_PROVIDER` | `anthropic` | `anthropic` | `anthropic` \| `fixture` |
| `ANTHROPIC_API_KEY` | key | key | Required only when `LLM_PROVIDER=anthropic` |
| `DEMO_FALLBACK` | unset (set `1` if a provider dies mid-demo) | unset | Fixture providers for the sample post's text only |
| `E2E_AUTH` | unset | **never set** | Set only by the Playwright `webServer` command |
| `NODE_VERSION` | from `.nvmrc` | `24` | |

`src/server/env.ts` validates all of this at server start and lists every missing variable.

## ElevenLabs keys (one per environment, each with a credit quota)

| Key | Lives in | Quota (of Starter's 30,000 credits) |
|---|---|---|
| `local` | `.env.local` (rarely used; local dev defaults to `browser`) | ~3,000 |
| `prod` | Netlify | ~5,000 |
| `demo` | `.env.local` **on demo day only** | the rest (~20,000) |

Pre-generate demo audio the night before so the live demo spends almost nothing.

## One-time setup (human, before build day)

Tracked as `human` tickets H1–H9 in `context/tickets/00-human.md`. This list is the reference for where each value goes.

1. **GitHub:** `dev` branch exists and is the default branch (bootstrap step in `context/tickets/02-infra.md`). Branch protection is applied by ticket I9.
2. **Neon:** project with branches `main` and `dev`. Copy both **pooled** connection strings.
3. **Netlify:** create the site from the GitHub repo; production branch `main`; **branch deploys off, deploy previews off**; add the Production env vars above.
4. **Buffer:** existing app client = **dev** (`https://localhost:3000/auth/callback`). Register a **prod** client with `https://<site>.netlify.app/auth/callback` (+ the custom domain later).
5. **Stripe (test mode):** Creator product + price; webhook endpoint `https://<site>.netlify.app/api/stripe/webhook`; install the Stripe CLI for local (`brew install stripe/stripe-cli/stripe`).
6. **ElevenLabs:** buy Starter, create the 3 keys above, pick 3 stock voice IDs.
7. **Anthropic:** one API key.
8. **DNS (not blocking):** Namecheap → Cloudflare nameservers; later add the custom domain in Netlify (Cloudflare record set to DNS only) and as a second Buffer redirect URI.

## Demo-day checklist (localhost)

1. Code freeze ~1 h before the demo; main folder on latest `dev`; nothing else on port 3000.
2. `.env.local`: `TTS_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY=<demo key>`, `DEMO_FALLBACK` unset.
3. `npm run dev` on port 3000 (Buffer dev client only works there).
4. `stripe listen --skip-verify --forward-to https://localhost:3000/api/stripe/webhook` running; its `whsec_…` matches `STRIPE_WEBHOOK_SECRET`.
5. Do one dry run of the full demo script, then reset the demo user's usage if needed.
   - Night before: paste each LinkedIn post you'll demo into its own post in the demo account, then run Read aloud (3 voices), Get reaction (3 personas), and Read the tone once. Reactions cache per post and audio caches by text, so the demo replays them free. A post pasted fresh on stage makes live calls (~2–5 s each) and counts as a reviewed post; `DEMO_FALLBACK` does not cover it.
6. **Scheduling is real.** Before build day, connect a throwaway/test channel to the demo Buffer account (H13). On stage, schedule only to that channel with **Pick a time ~1 week out**, then click **Move back to draft**. Never use Add to queue on a real channel during the demo. After the demo, empty that channel's queue in Buffer (H13).
7. If ElevenLabs or Anthropic fails mid-demo: set `DEMO_FALLBACK=1`, restart, use the sample post.
8. After the demo: open + merge the `dev` → `main` release PR; check the production URL; fix production-only bugs.
