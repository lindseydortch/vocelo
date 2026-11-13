# Human Tickets

Work only the human can do: accounts, dashboards, payments, real-service clicks. Each becomes a GitHub Issue labeled **`human`** so it shows up in `./scripts/ticket-next.sh` under "Your queue".

**Rules**
- Agents never start, work on, or close a `human` ticket. `ticket-start.sh` refuses them.
- Close a `human` ticket yourself when it's done, as **completed** (`gh issue close <N> --reason completed`). That unblocks the agent tickets that list it.
- When an agent ticket needs a human step partway through (paste a key, click through real OAuth), split that step into its own `human` ticket and list it under **Blocked by**. Agents never wait on you mid-ticket.
- Where each value goes (`.env.local`, Netlify env vars): `context/environments.md`. This file tracks the *work*; that file is the reference.

**Order:** H1, H2, H3, H6 first; they block agent tickets. H4 → H7. **H8 → H5 run on demo day, after the release PR merges** (Step 10: production sign-in isn't needed for the localhost demo). H9 is never blocking. H10 runs after Step 7 V16 merges. H11 runs after Step 8 R3 + R4 merge. H12 ✅ done. H13 before the demo.

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
**Blocks:** production sign-in (not the demo, not the release PR). Runs on demo day after the release merges (Step 10).

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
- [ ] Read the drafted Privacy and Terms text (Step 10 G15) and fix anything wrong about how your data is handled
- [ ] After the release PR merges on demo day: `https://<site>.netlify.app/privacy` and `/terms` load in a signed-out browser

**Blocked by:** Step 10 G15, the release PR.
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


## H11 · `chore: tune reaction and tone prompts`
**Labels:** `MVP`, `human`, `analysis`
**Acceptance criteria**
- [ ] With `LLM_PROVIDER=anthropic` locally, run 3 posts (incl. at least 1 of your real LinkedIn demo posts) through Get reaction × 3 standard personas + Read the tone
- [ ] Each persona sounds distinct (Skeptic spots vague claims, Scroller reacts to the first lines, Fan says what works); Tone labels feel right
- [ ] Edit wording in `src/server/prompts/` on a `chore/<N>-tune-prompts` branch; PR to `dev`; the coordinator merges it

**Blocked by:** Step 8 R3, R4; H3.
**Blocks:** nothing hard; needed before the demo.

---

## H12 · `chore: verify scheduling a Buffer draft via editPost`
✅ **Done 2026-11-13** by Claude with a personal API key on the personal LinkedIn channel (`addToQueue` skipped: next slot was same-day). Results: `project-bible.md` → Step 9 → Buffer facts. Test post deleted. Don't create a GitHub issue for this one.
**Labels:** `MVP`, `human`, `buffer`
**Acceptance criteria**
- [ ] On a **throwaway/test channel** (H13), in Buffer's API explorer (developers.buffer.com/explorer.html) with a personal key: create a draft with `createPost { saveToDraft: true, ... }`
- [ ] Try `editPost { id, mode: customScheduled, dueAt: <1 week out, UTC>, saveToDraft: false, schedulingType: automatic }` → note the returned `status` + `dueAt`
- [ ] If that fails, try without `saveToDraft` and note the result. Also try `mode: addToQueue` (no `dueAt`)
- [ ] Try `editPost { id, saveToDraft: true }` on the scheduled post → confirm it's a draft again; then delete the test post in Buffer
- [ ] Paste the working request shapes + any error messages as a comment on this issue and on K2

**Blocked by:** none (needs only a Buffer account + test channel).
**Blocks:** Step 9 K2.

---

## H13 · `chore: demo test channel for scheduling`
**Labels:** `MVP`, `human`, `buffer`, `demo`
**Acceptance criteria**
- [ ] A throwaway/test social account is connected as a channel in the demo Buffer account (a supported service: e.g. a spare Bluesky or Mastodon account)
- [ ] Dry run: schedule a post to it with Pick a time ~1 week out, then Move back to draft
- [ ] After the demo: that channel's queue in Buffer is empty (delete leftover scheduled posts)

**Blocked by:** none for setup; the dry run needs Step 9 K7 merged.
**Blocks:** nothing hard; needed before the demo.

---
