# Pricing Tiers & Cost Model

## Pricing Principles
- **Per user, not per channel.** Buffer charges per channel; our costs come from voice (ElevenLabs) and AI calls, so we price per user.
- **Meter voice in characters, not "reads."** A full read and a highlight both cost characters, so one meter covers both.
- **Upgrade triggers:**
  - Free → Creator: "I want to hear it from *my* audience" (custom personas)
  - Creator → Team: "My boss/client needs to approve this" (shared personas, approvals) — mirrors why Buffer users move to Buffer Team
  - Free → Creator (second trigger): "I want to see how my older posts evolved" (history window)
- **Hide, don't delete (at first).** On Free, posts older than 30 days are *locked*, not deleted. Upgrading unlocks them instantly, which makes the upgrade feel like getting something back.

---

## Tiers

| | **Free** | **Creator — $15/mo** | **Team — $29/user/mo (Coming soon in MVP; not purchasable)** |
|---|---|---|---|
| Best for | Trying it out | Solo creators, freelancers | Social/marketing teams |
| Personas | 3 standard | Standard + 5 custom | Unlimited custom, shared |
| Voice characters / usage period (new audio only; cached replays are free) | 12,000 (~15 full reads; raised in Step 7 so 5 posts × 3 voices fit) | 80,000 (~100 full reads) | 200,000 / user (~250 full reads) |
| Highlight-to-hear | ✓ (counts toward chars) | ✓ | ✓ |
| Persona reactions | All 3 standard personas (changed in Step 8: no per-post lock) | Standard + custom | All personas |
| Voice-to-text composing* | 5 min/mo | 120 min/mo | 300 min/user/mo |
| Tone read (whole post) | ✓ | ✓ | ✓ |
| Tone heat map (per sentence)* | ✗ | ✓ | ✓ |
| Side-by-side compare* | ✗ | ✓ | ✓ |
| Posts reviewed / usage period (counts the first time a post triggers anything that costs money: new TTS audio, a reaction, or a Tone read) | **5** | Unlimited (fair use) | Unlimited (fair use) |
| History window (posts, versions, reactions you can see) | **Last 30 days** | **12 months** | **Unlimited** |
| Versions kept per post | Last 3 | Unlimited | Unlimited |
| Locked posts kept before deletion* | 6 months (warning email first). **MVP never deletes**; the cleanup job is stretch | n/a | n/a |
| Pull from Buffer Ideas* | ✓ | ✓ | ✓ |
| Schedule in Buffer (queue or picked time) | ✓ | ✓ | ✓ + reviewer approvals* |
| Brand persona pack* | ✗ | ✗ | ✓ |

\* Stretch feature — **left off** the `/pricing` table until built (Step 10). Only the Team column says "Coming soon".

*"Full read" assumes an ~800-character post (typical LinkedIn length).*

**Usage period:** all counters reset together. Free resets monthly on the signup anniversary day; paid plans reset with the Stripe billing period. Upgrading starts a fresh period on the payment date; canceling keeps the paid plan until period end, then a fresh Free period starts. Full rules in `project-bible.md` → Kickoff Decisions.

**Two meters, posts first:** the UI leads with "3 of 5 posts reviewed"; voice characters are a smaller safety meter. Whichever runs out first blocks new audio. A request bigger than what's left is blocked (no partial reads); cached audio for posts already reviewed this period still plays.

### How the history window works
- **Measured from a post's last edit** (`last_edited_at`), not its creation date, so posts you're still working on never lock. The sample post never locks.
- **Versions on Free:** only the newest 3 per post are visible; older ones are hidden (never deleted) and reappear on upgrade.
- **What's limited:** Vocelo's own data, meaning posts in Vocelo, their version history, persona reactions, tone results, and cached audio.
- **What's not limited:** the draft in Buffer. Buffer drafts and scheduled posts stay in the user's Buffer account no matter their Vocelo plan. Say so in the UI so it never feels like we're holding their content hostage.
- **Free users** see a locked card for older posts: "🔒 12 posts older than 30 days. Upgrade to Creator to see them." Clicking opens Stripe Checkout.
- **Creator users** see 12 months. Older posts are locked the same way, with an upgrade path to Team.
- **Downgrades:** if a paid user cancels, nothing is deleted. Their posts outside the Free window become locked. (The 6-month deletion clock only exists once the stretch cleanup job ships; MVP keeps everything.)
- **Why it's cheap to run:** the history window caps how much storage (database rows, images, cached audio) we keep for free users.

---

## ElevenLabs: What Testing Will Cost

### Free plan is enough to build on
- **$0/month, 10,000 credits.** The API works on Free.
- Free API usage covers **~10,000 characters of TTS on the standard model, or ~20,000 on Flash/Turbo** (half the credits), plus **~4.5 hours of Scribe transcription**. All products share one credit pool.
- **Limits:** no commercial license, no voice cloning, 2 concurrent requests, no overage — generation just stops when credits run out.
- Stock voice library is available on Free, which is all you need for preset personas.

### Stretching the free credits
1. **Develop with the browser's free `speechSynthesis` voice.** Add a `TTS_PROVIDER=browser|elevenlabs` flag; only switch to ElevenLabs for final testing + demo.
2. **Use the Flash model** — double the characters per credit.
3. **Cache audio** by hash of (text + voice ID).
4. **Test with short text** (one sentence), not full posts.
5. **Pre-generate demo audio** the night before so the live demo uses ~0 credits.

### Rough hackathon budget

| Item | Cost | Notes |
|---|---|---|
| ElevenLabs Free | $0 | ~25 full-post reads on Flash; enough with the tricks above |
| ElevenLabs Starter (**decided: buy for the demo**) | ~$6/mo | 30,000 credits (~75 full reads on Flash) + commercial license |
| ElevenLabs Creator (overkill) | ~$22/mo | ~100,000 credits |
| Stripe | $0 | Test mode is free |
| LLM (reactions + tone) | ~$0–5 | Anthropic `claude-haiku-5-5`; short prompts; results cached by text hash |
| Hosting (Netlify) + Neon free tier + Netlify Blobs (audio cache) | $0 | |
| **Realistic total** | **$0–$11** | Start Free; upgrade to Starter only if you run out |

> **Note:** Free-plan audio is non-commercial. Fine for building and a hackathon demo; you'd need Starter or above to charge real users.

---

## Unit Economics (rough estimate)

Assumes Creator-plan ElevenLabs rates (~$0.22 per 1,000 credits) and the Flash model (~0.5 credit per character) → **~$0.09 per 800-character full read.** Rates drop on higher ElevenLabs plans.

| Tier | Price | Max voice cost | Est. LLM + STT | Worst-case margin |
|---|---|---|---|---|
| Free | $0 | ~$1.32 | ~$0.10 | –$1.40 / user (acquisition cost) |
| Creator | $15 | ~$8.80 | ~$1 | ~$5 (most users won't max out) |
| Team | $29/user | ~$22 | ~$2 | ~$5 (most users won't max out) |

**Levers if margins are thin:** audio caching (re-reads of unchanged text cost $0), Flash model only, charge for character top-ups, move to a higher ElevenLabs plan for lower per-credit cost.

**Pitch line:** "Free gets you hooked on hearing your post. Paid lets you hear it from *your* audience — and usage limits keep every tier profitable."

*Prices checked November 2026 from third-party summaries of ElevenLabs pricing; confirm on elevenlabs.io before finalizing.*
