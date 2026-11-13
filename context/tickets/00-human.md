# Human Tickets

Work only the human can do: accounts, dashboards, payments, real-service clicks. Each becomes a GitHub Issue labeled **`human`** so it shows up in `./scripts/ticket-next.sh` under "Your queue".

**Rules**
- Agents never start, work on, or close a `human` ticket. `ticket-start.sh` refuses them.
- Close a `human` ticket yourself when it's done, as **completed** (`gh issue close <N> --reason completed`). That unblocks the agent tickets that list it.
- When an agent ticket needs a human step partway through (paste a key, click through real OAuth), split that step into its own `human` ticket and list it under **Blocked by**. Agents never wait on you mid-ticket.
- Where each value goes (`.env.local`, Netlify env vars): `context/environments.md`. This file tracks the *work*; that file is the reference.

**Order:** H1, H2, H3, H6 first; they block agent tickets. H4 → H5, H7. H8 before H5. H9 is never blocking. H10 runs after Step 7 V16 merges.

---

## H1 · `chore: create Neon project`
**Labels:** `MVP`, `human`, `database`
**Acceptance criteria**
- [ ] Neon project exists with branches `main` and `dev`
- [ ] Both **pooled** connection strings are saved where `context/environments.md` says (dev string in `.env.local`)

**Blocked by:** none.
**Blocks:** Step 1 T1.

---

## H2 · `chore: set up ElevenLabs`
**Labels:** `MVP`, `human`, `audio`
**Acceptance criteria**
- [ ] ElevenLabs Starter plan bought ($6)
- [ ] One API key per environment, each with a credit quota (see `context/environments.md`)
- [ ] 3 stock voice IDs picked for the standard personas (The Skeptic, The Scroller, The Fan) and pasted into this issue as a comment
- [ ] ~8 more stock voice IDs (with a one-line description each) for the custom persona voice list, pasted as a comment (Step 7 V2)

**Blocked by:** none.
**Blocks:** Step 1 T3; Step 7 V2, V3.

---

## H3 · `chore: create Anthropic API key`
**Labels:** `MVP`, `human`, `llm`
**Acceptance criteria**
- [ ] One Anthropic API key, saved in `.env.local`

**Blocked by:** none.
**Blocks:** Step 1 T8.

---

## H4 · `chore: create Netlify site`
**Labels:** `MVP`, `human`, `infra`
**Acceptance criteria**
- [ ] Site created from the GitHub repo; production branch `main`; branch deploys **off**; deploy previews **off**
- [ ] Production env vars added (list in `context/environments.md`)
- [ ] Site URL (`<site>.netlify.app`) pasted into this issue as a comment

**Blocked by:** Step 2 I10.
**Blocks:** H5, H7, the release PR.

---

## H5 · `chore: register production Buffer app client`
**Labels:** `MVP`, `human`, `auth`
**Acceptance criteria**
- [ ] Second Buffer app client with redirect `https://<site>.netlify.app/auth/callback`
- [ ] Its client ID + secret added to Netlify production env vars

**Blocked by:** H4, H8.
**Blocks:** the release PR.

---

## H6 · `chore: configure Stripe test mode`
**Labels:** `MVP`, `human`, `billing`
**Acceptance criteria**
- [ ] Creator product + $15/mo USD price; price ID in `.env.local`
- [ ] Customer Portal, "limit customers to one subscription", and "cancel when retries run out" configured per `project-bible.md` → "Human setup (before build day, Stripe test mode)"
- [ ] Stripe CLI installed (`brew install stripe/stripe-cli/stripe`)

**Blocked by:** none.
**Blocks:** Step 5 P7.

---

## H7 · `chore: add production Stripe webhook`
**Labels:** `MVP`, `human`, `billing`
**Acceptance criteria**
- [ ] Webhook endpoint `https://<site>.netlify.app/api/stripe/webhook` with the events listed in `project-bible.md` → Step 5
- [ ] Its signing secret added to Netlify production env vars

**Blocked by:** H4, Step 5 P3.
**Blocks:** the release PR.

---

## H8 · `chore: publish privacy and terms pages`
**Labels:** `MVP`, `human`, `legal`
**Acceptance criteria**
- [ ] `/privacy` and `/terms` reachable at real public URLs (Buffer app client + Stripe need them)

**Blocked by:** none.
**Blocks:** H5.

---

## H9 · `chore: point DNS to Cloudflare`
**Labels:** `stretch`, `human`, `infra`
**Acceptance criteria**
- [ ] Namecheap nameservers point to Cloudflare (steps in `project-bible.md` → Domain + DNS)

**Blocked by:** none. **Blocks:** nothing (production starts on `netlify.app`).

---

## H10 · `chore: generate static audio files`
**Labels:** `MVP`, `human`, `audio`
**Acceptance criteria**
- [ ] On a branch (`chore/<N>-static-audio`), `.env.local` has the **local** ElevenLabs key; run `npm run audio:static` and confirm the character estimate (~5,000 chars ≈ 2,500 Flash credits)
- [ ] Files exist: `/public/voices/*.mp3` (one per custom voice), `/public/demo/landing-*.mp3` (3), `/public/demo/*.mp3` sample reads (3); listen to each once
- [ ] Commit + open a PR to `dev`; the coordinator merges it
- [ ] Re-run with `--force` only if the sample post text or a voice changes

**Blocked by:** Step 7 V16, H2.
**Blocks:** nothing hard (V14 previews and the sample post fall back to "Preview unavailable" / no audio until then); needed before the demo.

