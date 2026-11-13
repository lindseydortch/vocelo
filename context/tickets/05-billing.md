# Step 5 Tickets: Billing

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 5 Decisions". Stripe is always **test mode**. Tests never call Stripe: the Stripe API is mocked with MSW (`src/test/handlers/stripe.ts`, success + error variants) and webhooks use **signed fixture events** (`stripe.webhooks.generateTestHeaderString`). Fixed clock for every period/date test.

**Merge order:**
```
After Step 1 T2/T4/T6/T7, Step 2 I13/I14, Step 3 S3/S10:
  P1 Stripe client · P9 usage summary · P14 billing test presets       (parallel, max 3 worktrees)
    → P2 applySubscription (needs P1) → P3 webhook (needs P2) · P4 checkout session (needs P1)
    → P5 success page (needs P2, P4) · P6 canceled page · P7 portal (needs P1)
    → P8 pricing CTAs (needs P4, P7) · P10 billing settings (needs P7, P9)
    → P11 past_due banner (needs P10) · P12 limit-reached prompt (needs P4, P9) · P13 locked teaser (needs P4) · P15 composer meter (needs P9, Step 6 C1)
```
No Step 5 migration: the schema already has every billing column.

---

## P1 · `feat: Stripe client module`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] `src/server/billing/stripe.ts` exports one Stripe SDK instance pinned to API version `2026-10-28.endive`, using `STRIPE_SECRET_KEY`
- [ ] `getOrCreateCustomer(user)` returns `users.stripe_customer_id` if set, else creates a Customer (`email`, `metadata.userId`) and saves its ID
- [ ] Stripe `resource_missing` on a stored customer → typed `STRIPE_CUSTOMER_MISSING`; network/5xx → typed `STRIPE_UNAVAILABLE`
- [ ] Integration tests (MSW): new customer, reuse (zero create calls), concurrent first clicks → one customer row ID saved, each error type
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 2 I4, I5; Step 1 T2.
**Files likely touched:** `src/server/billing/stripe.ts`, `src/server/billing/customer.ts`, tests, `src/test/handlers/stripe.ts`
**Out of scope:** checkout (P4), portal (P7).

---

## P2 · `feat: apply subscription from Stripe`
**Labels:** `MVP`, `billing`, `database`
**Acceptance criteria**
- [ ] `applySubscription(subscriptionId)` re-fetches the subscription and writes `stripe_subscription_id`, `subscription_status`, `current_period_start/end` (from `items.data[0]`), `cancel_at_period_end` (`cancel_at != null OR cancel_at_period_end`)
- [ ] Status leaving the paid set (`canceled`, `unpaid`, `paused`, `incomplete_expired`) sets `period_anchor_at` to the end time; `incomplete` changes nothing
- [ ] A second active subscription for a user who already has a different active one → logged with a request ID, stored subscription unchanged
- [ ] Integration tests: active, canceling (`cancel_at` set), past_due, canceled resets the Free period, stale event order can't roll back (always re-fetched), duplicate subscription logged
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** produces Creator for `active` / `trialing` / `past_due`, Free otherwise (via the Step 1 effective-plan rule).
**Blocked by:** P1.
**Files likely touched:** `src/server/billing/apply-subscription.ts`, tests
**Out of scope:** webhook parsing (P3).

---

## P3 · `feat: Stripe webhook route`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] `POST /api/stripe/webhook` verifies the signature on the raw body with `STRIPE_WEBHOOK_SECRET`; invalid → 400
- [ ] Handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` by resolving the subscription ID and calling P2; other types → 200 ignored
- [ ] Finds the user via `subscription.metadata.userId`, then `stripe_customer_id`; none → 200 ignored; mismatch → customer ID wins, logged
- [ ] `stripe_events` row inserted in the same transaction as the update; repeated event ID → 200, no second update; processing error → 500 and no `stripe_events` row
- [ ] Signed fixture tests for every bullet; works on desktop 1280px+: n/a, no UI

**Plan behavior:** upgrades/downgrades flow through P2.
**Blocked by:** P2.
**Files likely touched:** `src/routes/api/stripe/webhook.ts`, `src/server/billing/webhook.ts`, `src/test/fixtures/stripe-events/*.json`, tests
**Out of scope:** refunds, disputes, invoice emails.

---

## P4 · `feat: Creator checkout session`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] POST server function `startCheckout()` requires a user; effective plan Creator → typed `ALREADY_SUBSCRIBED`, no session created
- [ ] Creates a session with `customer` (P1), `STRIPE_CREATOR_PRICE_ID`, `client_reference_id`, `subscription_data.metadata.userId`, `expires_at` = now + 30 min, success `/app/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancel `/app/billing/canceled`; returns the URL
- [ ] Stripe down → typed `STRIPE_UNAVAILABLE` ("Couldn't open billing. Try again.")
- [ ] Integration tests (MSW): Free creates a session with exactly those params, Creator refused, `past_due` refused, Stripe error
- [ ] Works on desktop 1280px+: n/a, server only

**Plan behavior:** Free only; Creator (incl. `past_due`) refused.
**Blocked by:** P1, Step 3 S3.
**Files likely touched:** `src/server/billing/checkout.ts`, tests
**Out of scope:** buttons (P8, P12, P13).

---

## P5 · `feat: checkout success page`
**Labels:** `MVP`, `billing`, `pages`
**Acceptance criteria**
- [ ] `/app/billing/success?session_id=` retrieves the session server-side; another user's session or missing ID → 404
- [ ] Paid session → calls P2, shows "You're on Creator!" + "Create a custom persona" next step
- [ ] Not paid yet → "Finishing up…", polls every 2 s up to 20 s, then "Your payment is processing. Refresh in a minute."
- [ ] Integration tests for each branch; E2E (Stripe mocked): success page shows Creator without any webhook
- [ ] Works on desktop 1280px+

**Plan behavior:** turns Free into Creator immediately when paid.
**Blocked by:** P2, P4.
**Files likely touched:** `src/routes/app/billing/success.tsx`, `src/server/billing/sync-checkout.ts`, `src/content/copy.ts`, tests, `e2e/upgrade.spec.ts`
**Out of scope:** visual design.

---

## P6 · `feat: checkout canceled page`
**Labels:** `MVP`, `billing`, `pages`
**Acceptance criteria**
- [ ] `/app/billing/canceled` shows "No changes made" and a link back to `/pricing`
- [ ] Writes nothing (integration test: user row unchanged)
- [ ] Copy in `src/content/copy.ts`; E2E: page renders, link works
- [ ] Works on desktop 1280px+

**Plan behavior:** none.
**Blocked by:** Step 3 S10.
**Files likely touched:** `src/routes/app/billing/canceled.tsx`, `src/content/copy.ts`, `e2e/upgrade.spec.ts`
**Out of scope:** visual design.

---

## P7 · `feat: Customer Portal link`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] POST server function `openBillingPortal()` creates a portal session for `stripe_customer_id` with `return_url` = `APP_URL/app/settings/billing`, returns the URL
- [ ] No customer ID, or `STRIPE_CUSTOMER_MISSING` (seed users) → "Billing isn't set up for this test account."
- [ ] Stripe down → "Couldn't open billing. Try again."
- [ ] Integration tests (MSW) for each case
- [ ] Works on desktop 1280px+: n/a, server only

**Plan behavior:** available to anyone with a Stripe customer (Creator, canceling, past_due, or ex-Creator).
**Blocked by:** P1, H6 Stripe test-mode setup.
**Files likely touched:** `src/server/billing/portal.ts`, tests
**Out of scope:** portal configuration (H6).

---

## P8 · `feat: plan-aware pricing CTAs`
**Labels:** `MVP`, `billing`, `pages`
**Acceptance criteria**
- [ ] Signed out: Creator CTA links to `/signin?returnTo=/pricing`
- [ ] Free: "Upgrade" calls P4 and redirects to Checkout; Creator: "Current plan" + "Manage billing" (P7)
- [ ] Team: disabled "Coming soon" for everyone
- [ ] E2E: each of signed out, `free`, `creator` (Stripe mocked). Works on desktop 1280px+

**Plan behavior:** CTA differs by plan as above.
**Blocked by:** P4, P7, Step 10 pricing placeholder (or a minimal `/pricing`).
**Files likely touched:** `src/routes/pricing.tsx`, `src/components/PlanCta/*`, `src/content/copy.ts`, `e2e/pricing.spec.ts`
**Out of scope:** pricing page layout + copy (Step 10).

---

## P9 · `feat: usage summary`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] `getUsageSummary(userId)` returns `{ plan, status, postsUsed, postsLimit | null, charsUsed, charsLimit, periodEnd, renewsOrEnds: 'renews' | 'ends' | null, pastDue }`
- [ ] Uses the Step 1 period calculator + effective plan; read-only (no locks, no inserts)
- [ ] Unit/integration tests for all 7 billing presets (P14) with a fixed clock
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** Free: posts limit 5, 8,000 chars. Creator: posts `null` (unlimited), 80,000 chars.
**Blocked by:** Step 1 T4, T6; P14 (tests use the presets; can start with inline data).
**Files likely touched:** `src/server/usage-summary.ts`, tests
**Out of scope:** UI (P10, P15).

---

## P10 · `feat: billing settings page`
**Labels:** `MVP`, `billing`, `pages`
**Acceptance criteria**
- [ ] `/app/settings/billing` shows the plan line ("Creator · renews Dec 12" / "Creator · ends Dec 12" / "Free"), posts meter ("3 of 5 posts reviewed" / "Unlimited"), characters meter ("6,200 of 8,000 voice characters left"), "Resets {date}"
- [ ] Free: "Upgrade" (P4); Creator/canceling/past_due: "Manage billing" (P7)
- [ ] E2E: `free`, `free-at-limit`, `creator`, `creator-canceling` render correctly
- [ ] Works on desktop 1280px+

**Plan behavior:** buttons and meters as above.
**Blocked by:** P7, P9, P14.
**Files likely touched:** `src/routes/app/settings/billing.tsx`, `src/components/UsageMeter/*`, `src/content/copy.ts`, `e2e/billing.spec.ts`
**Out of scope:** past_due banner (P11), visual design.

---

## P11 · `feat: payment failed banner`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] When `pastDue`, Billing settings and the composer show "Your last payment failed. Update your card to keep Creator." with a "Update card" button (P7)
- [ ] Not shown for any other status
- [ ] E2E: `creator-past-due` sees it on both pages; `creator` doesn't
- [ ] Works on desktop 1280px+

**Plan behavior:** past_due keeps Creator; banner only.
**Blocked by:** P10, Step 6 C1 (composer route).
**Files likely touched:** `src/components/PastDueBanner/*`, `src/routes/app/settings/billing.tsx`, `src/routes/app/posts/$id.tsx`, `e2e/billing.spec.ts`
**Out of scope:** emails (Stripe sends its own).

---

## P12 · `feat: limit-reached prompt`
**Labels:** `MVP`, `billing`
**Acceptance criteria**
- [ ] `LimitReached` component maps typed usage errors (`posts`, `chars` with `needed` / `remaining`, `rate`) to messages from `copy.ts`
- [ ] Free: "Upgrade to Creator" → P4; Creator out of characters: "Resets {date}", no upgrade button; `rate`: "Try again in N minutes" on every plan
- [ ] Cached audio and existing reactions stay playable/visible while it shows
- [ ] E2E: `free-at-limit` asks for a new read → prompt → Checkout redirect (mocked); `free-low-chars` sees "800 characters needed, 500 left"
- [ ] Works on desktop 1280px+

**Plan behavior:** as above.
**Blocked by:** P4, P9, Step 7 playback (wiring point).
**Files likely touched:** `src/components/LimitReached/*`, `src/content/copy.ts`, `e2e/limits.spec.ts`
**Out of scope:** character top-ups (stretch).

---

## P13 · `feat: locked history teaser card`
**Labels:** `MVP`, `billing`, `pages`
**Acceptance criteria**
- [ ] `countLockedPosts(user)` returns the number of posts outside the history window (sample post never counts)
- [ ] Free: "🔒 N posts older than 30 days. Upgrade to see them" → P4; Creator: "🔒 N posts older than 12 months. Team is coming soon", no button; N = 0 → hidden
- [ ] Line under it: "Your Buffer drafts are unaffected and stay in Buffer."
- [ ] Integration test for the count; E2E: `free-downgraded` sees the card, upgrade reveals the posts (fixture webhook)
- [ ] Works on desktop 1280px+

**Plan behavior:** as above. First item to cut if time runs out.
**Blocked by:** P4, Step 1 T7, Step 10 dashboard placeholder.
**Files likely touched:** `src/server/posts/locked-count.ts`, `src/components/LockedTeaser/*`, `src/content/copy.ts`, tests
**Out of scope:** deleting locked posts (stretch).

---

## P14 · `chore: billing test presets`
**Labels:** `MVP`, `billing`, `testing`
**Acceptance criteria**
- [ ] One preset table (`src/test/presets.ts`): `free`, `free-at-limit`, `free-low-chars`, `free-downgraded`, `creator`, `creator-canceling`, `creator-past-due`, with dates relative to an injected `now`
- [ ] `createTestUser({ preset })` builds each (usage events, custom personas, backdated posts, fake `cus_seed_…` / `sub_seed_…`)
- [ ] `npm run seed` creates all 7 on the Neon `dev` branch (idempotent, seed-tagged); `/__test/login?user=<key>` accepts every key
- [ ] Tests: each preset's effective plan + remaining usage match its description
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** this ticket *is* the plan matrix.
**Blocked by:** Step 2 I12, I13, I14; Step 1 T6.
**Files likely touched:** `src/test/presets.ts`, `src/test/factories.ts`, `scripts/seed.ts`, `src/routes/__test/login.ts`, tests
**Out of scope:** real Stripe test customers (stretch).

---

## P15 · `feat: composer usage meter`
**Labels:** `MVP`, `billing`, `composer`
**Acceptance criteria**
- [ ] Compact meter in the composer: "3 of 5 posts · 6,200 chars left" (Free) or "6,200 chars left" (Creator), linking to Billing settings
- [ ] Refreshes after any action that consumes usage
- [ ] E2E: `free` sees posts + chars; `creator` sees chars only
- [ ] Works on desktop 1280px+

**Plan behavior:** as above.
**Blocked by:** P9, Step 6 C1 (composer route).
**Files likely touched:** `src/components/UsageMeter/*`, `src/routes/app/posts/$id.tsx`, `e2e/billing.spec.ts`
**Out of scope:** visual design.

---

## Noted for later steps (not drafted here)
- **Free 1-persona-per-post after downgrade** (new requests only) → Step 8 (Reactions)
- **Custom personas locked on downgrade** (exercised by `free-downgraded`) → Step 7 (Personas)
- **Pricing page layout + copy, dashboard placement of the teaser card** → Step 10
- **Demo script:** sign in as `free` → hit limit → Checkout with 4242 → success page → custom persona → Step 11
- **Stretch:** Team checkout, trials, annual plans, promo codes, character top-ups, live keys, seeding real Stripe test customers, auto-checkout after sign-in
