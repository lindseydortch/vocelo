# Step 10 Tickets: Pages

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 10 Decisions". Pages never call Buffer, ElevenLabs, or the LLM on load. E2E uses `/__test/login` (I14) and the billing presets (P14); Stripe is mocked. **Marketing copy is lorem ipsum** (`src/content/copy/pages.ts`) until the Design Pass picks a brand direction; buttons, errors, statuses, empty states, and legal text use plain working wording; plan facts come from `src/content/plans.ts`.

8 of the 15 sitemap pages are built elsewhere: `/signin` S11, `/auth/callback` S6, `/auth/error` S12, `/app/billing/success` P5, `/app/billing/canceled` P6, `/app/settings/billing` P10, `/app/personas` V12, composer C1 + B7.

**Merge order:**
```
After Step 2 I1/I3/I7/I14, Step 3 S10:
  G1 public route stubs · G2 not-found + error · G4 pending state       (parallel)
  G3 app shell (needs S10) → G5 plan chip (needs P4, P9)
  G6 sample post (needs S7, V16)
  G7 dashboard list (needs S10, T7, C2) → G8 row delete (needs C13) · G9 welcome card (needs G6) · G10 empty state
  G1 → G11 landing sections · G12 persona showcase (needs V16) · G13 pricing table → G14 landing plan cards (needs P8)
  G1 → G15 legal text
  G16 account + org names (needs S7) → G17 account settings (needs S13, S14) → G18 settings tabs (needs P10)
```
Unblocks: P8 (G1), P11 (G3), B15/B16/P13 (G7). One migration: G16.

---

## G1 · `feat: public route stubs`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] Routes `/`, `/pricing`, `/privacy`, `/terms` exist, each with an `<h1>` and lorem ipsum from `src/content/copy/pages.ts`
- [ ] `src/lib/head.ts` exports `pageTitle(name)` → "{name} · Vocelo"; every route above sets its `<title>` with it
- [ ] Shared public footer: Privacy, Terms, `support@` contact link
- [ ] E2E: each route returns 200 with its title. Works on desktop 1280px+

**Plan behavior:** none (public).
**Blocked by:** Step 2 I1, I3, I7.
**Files likely touched:** `src/routes/index.tsx`, `src/routes/pricing.tsx`, `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/components/PublicFooter/*`, `src/lib/head.ts`, `src/content/copy/pages.ts`, `e2e/public.spec.ts`
**Out of scope:** landing sections (G11), pricing table (G13), legal text (G15), visual design.

---

## G2 · `feat: not-found and error pages`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] Root `notFoundComponent`: "Page not found" + link to `/app` when signed in, `/` when signed out
- [ ] Root `errorComponent`: "Something went wrong" + "Reference: {requestId}" (from the Step 2 structured log) + the same link rule; the error is logged with `console.error` and the request ID
- [ ] Both render inside the app shell under `/app/*` (works once G3 lands; until then they render bare)
- [ ] E2E: unknown URL → 404 page with the right link signed in and signed out; a route that throws → error page with a reference. Works on desktop 1280px+

**Plan behavior:** none.
**Blocked by:** Step 2 I1, I7, I14.
**Files likely touched:** `src/routes/__root.tsx`, `src/components/NotFound/*`, `src/components/ErrorPage/*`, `src/content/copy/pages.ts`, `e2e/errors.spec.ts`
**Out of scope:** Sentry (stretch), per-feature error messages.

---

## G3 · `feat: app shell header`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] The `/app` layout renders a header on every `/app/*` page: "Vocelo" → `/app`, Posts, Personas, Settings; the current section is marked (`aria-current`)
- [ ] The header has an empty right-hand slot (G5 fills it) and a banner slot under it (P11 fills it)
- [ ] Every `/app/*` page sends `<meta name="robots" content="noindex">` and sets its title via `pageTitle()`
- [ ] E2E: nav links reach each page. Works on desktop 1280px+, no horizontal scroll at 375px

**Plan behavior:** same for every plan.
**Blocked by:** Step 3 S10, G1 (`pageTitle`).
**Files likely touched:** `src/routes/app/route.tsx`, `src/components/AppShell/*`, `src/content/copy/pages.ts`, `e2e/app-shell.spec.ts`
**Out of scope:** plan chip (G5), past_due banner (P11), mobile menu (Design Pass).

---

## G4 · `feat: shared pending state`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] One `Pending` component ("Loading…") used as the router's default `pendingComponent`, shown only after 300 ms (`defaultPendingMs: 300`, `defaultPendingMinMs: 300`)
- [ ] Exported for panels that load on their own (import panel, persona list)
- [ ] Component test: not rendered before 300 ms, rendered after (fake timers)
- [ ] Works on desktop 1280px+

**Plan behavior:** none.
**Blocked by:** Step 2 I1, I5.
**Files likely touched:** `src/components/Pending/*`, `src/router.tsx`, tests
**Out of scope:** skeletons, spinners, animation (Design Pass).

---

## G5 · `feat: plan chip in app header`
**Labels:** `MVP`, `pages`, `billing`
**Acceptance criteria**
- [ ] Header right slot shows: Free → "Free · 3 of 5 posts" (from P9 `getUsageSummary`) + "Upgrade" (P4 Checkout); Creator (incl. canceling and past_due) → "Creator"
- [ ] The chip links to `/app/settings/billing`
- [ ] Summary loads with the `/app` layout (one read query, no locks); failure hides the chip, never the page
- [ ] E2E: `free`, `free-at-limit` ("Free · 5 of 5 posts"), `creator`. Works on desktop 1280px+

**Plan behavior:** as above.
**Blocked by:** G3, Step 5 P4, P9, P14.
**Files likely touched:** `src/components/AppShell/PlanChip.tsx`, `src/routes/app/route.tsx`, `src/content/copy/billing.ts`, `e2e/app-shell.spec.ts`
**Out of scope:** the full meters (P10, P15).

---

## G6 · `feat: sample post on first sign-in`
**Labels:** `MVP`, `pages`, `database`
**Acceptance criteria**
- [ ] `ensureSamplePost(userId)` (S7's stub) inserts one post: `is_sample = true`, `channel_service = 'linkedin'`, `channel_id` null, `channel_name = 'Sample'`, text from `src/content/sample-post.ts`
- [ ] Called only when S7 **creates** the user (inside its transaction); a returning user never gets one, so a deleted sample is never recreated
- [ ] No seed data needed: works on an empty production database
- [ ] Integration tests: new user → exactly one sample; returning user → none; deleted sample + sign in again → none; two concurrent first sign-ins → one user, one sample
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan; never counts, never locks.
**Blocked by:** Step 3 S7, Step 7 V16 (`sample-post.ts`).
**Files likely touched:** `src/server/posts/sample-post.ts`, `src/server/auth/complete-sign-in.ts`, tests
**Out of scope:** "Restore sample post" (stretch), the sample's static audio/analysis (V16, R10).

---

## G7 · `feat: dashboard post list`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] `/app` lists the user's posts that pass `visiblePostsWhere` (T7), newest `last_edited_at` first; no pagination, search, or filters
- [ ] Each row: channel name + service, first ~80 characters or "Empty post" (`isBlank`, C2), "Edited {relative time}", a "Sample" tag on the sample post; the row links to `/app/posts/:id`
- [ ] "New post" button → `/app/posts/new`; named slots for the welcome card (G9), locked teaser (P13), and import panel (B15), in that page order: welcome → New post → list → teaser → import
- [ ] Integration test for the list query (order, window, other users excluded); E2E: seeded posts render, row opens the composer
- [ ] Works on desktop 1280px+

**Plan behavior:** Free sees the last 30 days, Creator 12 months (T7); the sample always shows.
**Blocked by:** Step 3 S10, Step 1 T7, Step 6 C2.
**Files likely touched:** `src/routes/app/index.tsx`, `src/server/posts/list-posts.ts`, `src/components/PostRow/*`, `src/content/copy/pages.ts`, tests, `e2e/dashboard.spec.ts`
**Out of scope:** status badges (B16), delete (G8), empty state (G10), visual design.

---

## G8 · `feat: delete post from dashboard row`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] Each row has "Delete" that opens C13's confirm ("Deletes it from Vocelo only. Your Buffer draft stays.") and calls C13's `deletePost`
- [ ] On success the row disappears without a full reload; failure shows "Couldn't delete. Try again."
- [ ] Works on the sample post too
- [ ] E2E: delete a post → gone from the list; cancel → still there. Works on desktop 1280px+

**Plan behavior:** same on every plan; no usage refund (C13).
**Blocked by:** G7, Step 6 C13.
**Files likely touched:** `src/components/PostRow/*`, `src/content/copy/pages.ts`, `e2e/dashboard.spec.ts`
**Out of scope:** bulk delete, undo, deleting the Buffer draft (stretch).

---

## G9 · `feat: first-run welcome card`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] Shown at the top of `/app` while the user has a sample post and **no other posts** (no stored dismissal)
- [ ] "Hear the sample post" button → the sample's composer; secondary "Start your own post" → `/app/posts/new`
- [ ] Disappears once any non-sample post exists (created or imported)
- [ ] E2E: new user sees it → opens sample → hears a standard persona (static audio); after creating a post it's gone. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** G6, G7.
**Files likely touched:** `src/components/WelcomeCard/*`, `src/routes/app/index.tsx`, `src/content/copy/pages.ts`, `e2e/first-run.spec.ts`
**Out of scope:** guided tour, onboarding checklist (stretch).

---

## G10 · `feat: dashboard empty state`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] No visible posts at all (sample deleted, nothing else) → "No posts yet" + "New post" + a pointer to the Import from Buffer panel
- [ ] Not shown when only locked posts exist: the list area says "No posts in the last 30 days" (Free) / "12 months" (Creator) and the teaser card (P13) explains the rest
- [ ] E2E: user with zero posts; `free-downgraded`-style user with only locked posts. Works on desktop 1280px+

**Plan behavior:** wording follows the history window (30 days / 12 months).
**Blocked by:** G7.
**Files likely touched:** `src/components/DashboardEmpty/*`, `src/routes/app/index.tsx`, `src/content/copy/pages.ts`, `e2e/dashboard.spec.ts`
**Out of scope:** import panel itself (B15).

---

## G11 · `feat: landing page sections`
**Labels:** `MVP`, `pages`, `marketing`
**Acceptance criteria**
- [ ] `/` has, in order: hero (headline, subhead, CTA), problem → solution, how it works (3 steps), persona showcase slot (G12), supported channels (from `plans.ts`: LinkedIn, X, Substack Notes, Threads, Bluesky, Mastodon), pricing slot (G14), FAQ (incl. "Does this change my Buffer drafts?" and "What happens to my posts on Free?" as questions; lorem answers), footer
- [ ] All marketing text is lorem ipsum from `src/content/copy/pages.ts`
- [ ] CTA: signed out → "Sign in with Buffer" → `/auth/buffer/start?returnTo=/app`; signed in → "Open Vocelo" → `/app` (no redirect away from `/`)
- [ ] E2E: sections render; CTA href signed out vs. signed in. Works on desktop 1280px+

**Plan behavior:** none.
**Blocked by:** G1, Step 3 S5.
**Files likely touched:** `src/routes/index.tsx`, `src/components/Landing/*`, `src/content/copy/pages.ts`, `e2e/landing.spec.ts`
**Out of scope:** persona audio (G12), plan cards (G14), real copy, visual design, OG images (stretch).

---

## G12 · `feat: landing persona showcase`
**Labels:** `MVP`, `pages`, `marketing`
**Acceptance criteria**
- [ ] Three cards (Skeptic, Scroller, Fan: name, placeholder icon from V2, lorem blurb), each with Play/Stop for `/demo/landing-<persona>.mp3`
- [ ] One clip at a time: playing one stops the others; no sign-in, no `/api/audio`
- [ ] A clip that fails to load shows "Sample unavailable" and disables its button
- [ ] E2E: play one, then another → first stops; missing file → "Sample unavailable". Works on desktop 1280px+

**Plan behavior:** none.
**Blocked by:** G11, Step 7 V2, V16.
**Files likely touched:** `src/components/Landing/PersonaShowcase.tsx`, `src/content/copy/pages.ts`, `e2e/landing.spec.ts`
**Out of scope:** generating the clips (H10), speaking indicator.

---

## G13 · `feat: pricing comparison table`
**Labels:** `MVP`, `pages`, `billing`
**Acceptance criteria**
- [ ] `src/content/plans.ts` holds plan facts from `pricing-tiers.md`: names, prices, personas, voice characters, posts reviewed, history window, versions kept, schedule, reactions, Tone read. **No stretch rows**
- [ ] `/pricing` renders Free / Creator / Team columns from it, lorem plan descriptions, P8's CTA in each column (Team: "Coming soon")
- [ ] Unit test: limits in `plans.ts` match the usage module's constants (one source of truth or an equality test)
- [ ] E2E: table renders; CTAs signed out / `free` / `creator`. Works on desktop 1280px+

**Plan behavior:** CTAs per P8.
**Blocked by:** G1, Step 5 P8.
**Files likely touched:** `src/content/plans.ts`, `src/routes/pricing.tsx`, `src/components/PlanTable/*`, `src/content/copy/pages.ts`, tests, `e2e/pricing.spec.ts`
**Out of scope:** Team checkout, annual plans (stretch).

---

## G14 · `feat: landing plan cards`
**Labels:** `MVP`, `pages`, `marketing`
**Acceptance criteria**
- [ ] Landing pricing slot shows 3 compact cards (name, price, 3 key facts from `plans.ts`) with P8's plan-aware CTA, Team "Coming soon"
- [ ] "Compare plans" link → `/pricing`
- [ ] E2E: cards render; signed-out Creator CTA → `/signin?returnTo=/pricing`. Works on desktop 1280px+

**Plan behavior:** CTAs per P8.
**Blocked by:** G11, G13.
**Files likely touched:** `src/components/Landing/PlanCards.tsx`, `src/content/copy/pages.ts`, `e2e/landing.spec.ts`
**Out of scope:** the full table (G13).

---

## G15 · `feat: privacy and terms text`
**Labels:** `MVP`, `pages`, `legal`
**Acceptance criteria**
- [ ] `/privacy` (plain language, real content, not lorem): what's stored (Buffer account ID/email/name, encrypted Buffer tokens, post text, versions, reactions, usage events, Stripe customer ID); processors (Buffer, ElevenLabs, Anthropic, Stripe, Netlify, Neon); text sent to ElevenLabs/Anthropic only when the user asks; audio cache shared by text hash; no selling data; deletion by emailing `support@<domain>`; "Last updated" date
- [ ] `/terms`: hackathon-stage service, no warranty, acceptable use, Creator billing via Stripe (cancel any time, ends at period end), contact
- [ ] Text lives in `src/content/legal.ts`; a note at the top of the file says it's a draft for human review (H8)
- [ ] E2E: both pages render their headings. Works on desktop 1280px+

**Plan behavior:** none.
**Blocked by:** G1.
**Files likely touched:** `src/content/legal.ts`, `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `e2e/public.spec.ts`
**Out of scope:** cookie banner (only essential cookies), legal review, publishing (H8).

---

## G16 · `chore: store Buffer display names`
**Labels:** `MVP`, `pages`, `database`
**Acceptance criteria**
- [ ] Additive migration: `users.buffer_account_name` and `users.buffer_organization_name` (both nullable text)
- [ ] S7's `completeSignIn` writes both from its existing `account` query (no extra Buffer call) and refreshes them on every sign-in
- [ ] `/__dev/login` (S15) writes them too
- [ ] Integration tests: new user, returning user with a renamed org
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 3 S7, S15; Step 1 T1.
**Files likely touched:** `drizzle/*`, `src/server/db/schema.ts`, `src/server/auth/complete-sign-in.ts`, `src/routes/__dev/login.ts`, tests
**Out of scope:** org switching (stretch).

---

## G17 · `feat: account settings page`
**Labels:** `MVP`, `pages`, `auth`
**Acceptance criteria**
- [ ] `/app/settings` shows Buffer account name + email, organization name, and "Times shown in {timezone}, from Buffer" (`users.timezone` ?? "your browser's timezone")
- [ ] Shows "Signed in with a personal API key (dev)" when the connection has no refresh token (S15)
- [ ] Hosts S13's Sign out and S14's Disconnect Buffer (moved off the placeholder); no Buffer call on load
- [ ] E2E: `free` and `creator` render; disconnect dialog shows the billing note only for `creator`. Works on desktop 1280px+

**Plan behavior:** S14's billing warning shows for Creator only.
**Blocked by:** G16, Step 3 S13, S14.
**Files likely touched:** `src/routes/app/settings/index.tsx`, `src/server/settings/get-account.ts`, `src/content/copy/auth.ts`, tests, `e2e/settings.spec.ts`
**Out of scope:** account deletion, org switching (stretch).

---

## G18 · `feat: settings tab navigation`
**Labels:** `MVP`, `pages`
**Acceptance criteria**
- [ ] `/app/settings` and `/app/settings/billing` share a tab bar: Account · Billing, current tab marked (`aria-current`)
- [ ] Settings layout route wraps both pages; G3's header marks Settings on either
- [ ] E2E: switch tabs both ways. Works on desktop 1280px+

**Plan behavior:** same for every plan.
**Blocked by:** G17, Step 5 P10.
**Files likely touched:** `src/routes/app/settings/route.tsx`, `src/components/SettingsTabs/*`, `src/content/copy/pages.ts`, `e2e/settings.spec.ts`
**Out of scope:** more tabs (Team, notifications).

---

## Noted for later steps (not drafted here)
- **Design Pass:** real marketing copy replaces lorem ipsum in `src/content/copy/pages.ts`; landing layout, voice avatar art in G12, mobile menu for G3.
- **Demo day (human):** release PR → H8 (legal pages live) → H5 (production Buffer client).
- **Stretch:** Payload CMS for marketing copy, "Restore sample post", dashboard pagination/search/filters, OG images, Sentry, account deletion, stretch rows on `/pricing`.
