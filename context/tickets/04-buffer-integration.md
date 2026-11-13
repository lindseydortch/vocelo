# Step 4 Tickets: Buffer integration

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 4 Decisions". Every ticket is tested with MSW mocks of the Buffer GraphQL API (success + `MutationError` + temporary-error variants added to `src/test/handlers/buffer.ts`), never the real service. All Buffer calls go through Step 3's `withBuffer(userId, fn)`.

**Merge order:**
```
After Step 3 S4 + S9 (Buffer client + retry) and Step 1 T2/T6:
  B1 schema additions · B2 char count · B3 Buffer read queries        (parallel, max 3 worktrees)
    → B4 Buffer write mutations (needs B3) · B5 channel list service (needs B1, B3) · B6 Buffer write cap (needs B1)
    → B7 channel picker + new post (needs B5, Step 6 editor route) · B8 first save (needs B2, B4, B6)
    → B9 save existing draft (needs B8) → B10 save as a new draft (needs B9)
    → B11 save button + messages (needs B9, Step 6 composer) · B12 status sync on open (needs B3)
    → B13 import list (needs B5) → B14 import action (needs B6, B13) → B15 import UI (needs B14)
    → B16 dashboard status badges (needs B1, Step 10 dashboard placeholder)
```
B1 is the only Step 4 migration. Merge it before any other ticket that touches the schema (two lanes generating the same migration number is caught by "up to date before merging").

---

## B1 · `chore: Buffer integration schema additions`
**Labels:** `MVP`, `buffer`, `database`
**Acceptance criteria**
- [ ] Additive migration: `buffer_status` enum gains `needs_approval`, `sending`, `error`; `usage_events.kind` gains `buffer_write`
- [ ] `users.channels_cache` (jsonb, nullable) and `users.channels_cached_at` (timestamptz, nullable)
- [ ] `posts.channel_id` nullable, with check constraint `is_sample OR channel_id IS NOT NULL`
- [ ] Integration test: inserting a non-sample post without `channel_id` fails; a sample post without one succeeds
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 1 T2, Step 3 S1 (migration order).
**Files likely touched:** `src/db/schema/*.ts`, `drizzle/00XX_*.sql`, `src/db/schema.test.ts`
**Out of scope:** using the columns (B5, B6).

---

## B2 · `feat: per-channel character counter`
**Labels:** `MVP`, `buffer`, `composer`
**Acceptance criteria**
- [ ] `countFor(service, text, { maxCharacters? })` in `src/lib/char-count.ts` returns `{ count, limit, over }`
- [ ] X uses `twitter-text` weighted length, limit 280; Bluesky counts graphemes (`Intl.Segmenter`), limit 300; LinkedIn counts each URL as 24, limit 3,000; Threads 500; Substack 10,000; Mastodon `maxCharacters ?? 500`; default counts UTF-16 code units
- [ ] Unit tests per service: at the limit, over by 1, emoji counts as 2 (UTF-16 services), LinkedIn URL, Bluesky emoji as 1 grapheme, Mastodon custom limit
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 2 I5.
**Files likely touched:** `src/lib/char-count.ts`, `src/lib/char-count.test.ts`, `package.json` (`twitter-text`)
**Out of scope:** the live counter UI (Step 6), X Premium limits (stretch).

---

## B3 · `feat: Buffer read queries`
**Labels:** `MVP`, `buffer`
**Acceptance criteria**
- [ ] Typed functions: `listChannels(orgId)`, `getChannel(id)`, `getPost(id)` (`status`, `dueAt`, `text`, `error { message }`, asset count, `channel { isDisconnected isLocked }`), `listDraftPosts(orgId, channelIds, first = 20)`
- [ ] `getPost` maps Buffer `NOT_FOUND` to `null` instead of throwing
- [ ] Buffer statuses map 1:1 to our `buffer_status` enum; unknown values throw a typed error
- [ ] Integration tests (MSW): each query's success shape, not-found post, temporary error passes through
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 3 S4, S9.
**Files likely touched:** `src/server/buffer/queries.ts`, `src/server/buffer/queries.test.ts`, `src/test/handlers/buffer.ts`
**Out of scope:** caching (B5), mutations (B4).

---

## B4 · `feat: Buffer write mutations`
**Labels:** `MVP`, `buffer`
**Acceptance criteria**
- [ ] `createDraft(channelId, text)` sends `saveToDraft: true, mode: addToQueue, schedulingType: automatic, needsApproval: false, assets: []`; returns the new post ID + status
- [ ] `editDraftText(postId, text)` sends **only** `id` + `text` (test asserts no `assets`/`metadata` in the request body)
- [ ] Any `... on MutationError` result → typed `BufferMutationError` carrying Buffer's `message`
- [ ] Integration tests (MSW): success for both, `InvalidInputError` (over-length message), `NotFoundError`
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** B3.
**Files likely touched:** `src/server/buffer/mutations.ts`, `src/server/buffer/mutations.test.ts`, `src/lib/errors.ts`, `src/test/handlers/buffer.ts`
**Out of scope:** scheduling modes (Step 9), save orchestration (B8).

---

## B5 · `feat: cached channel list`
**Labels:** `MVP`, `buffer`
**Acceptance criteria**
- [ ] `getChannels(userId, { refresh? })` returns cached `users.channels_cache` if younger than 10 min, else calls `listChannels(org)` and stores it
- [ ] Each channel is tagged `selectable`, `unsupported` (service not in linkedin/twitter/substack/threads/bluesky/mastodon), or `needsReconnect` (`isDisconnected` or `isLocked`)
- [ ] Temporary Buffer error with a stale cache → returns the stale list flagged `stale: true`; with no cache → throws
- [ ] Integration tests with a fixed clock: fresh cache = 0 Buffer calls, 11 min = 1 call, `refresh` = 1 call, tagging for each case
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan.
**Blocked by:** B1, B3.
**Files likely touched:** `src/server/buffer/channels.ts`, `src/server/buffer/channels.test.ts`
**Out of scope:** the picker UI (B7).

---

## B6 · `feat: Buffer write cap`
**Labels:** `MVP`, `buffer`, `billing`
**Acceptance criteria**
- [ ] `consumeBufferWrite(userId, tx)` counts `buffer_write` events in the last 60 min under the user-row lock and inserts one; the 31st throws typed `BUFFER_WRITE_CAP` with `retryInMinutes`
- [ ] `refundBufferWrite(eventId)` deletes the event (used when Buffer fails)
- [ ] `buffer_write` events never count toward reviewed posts or voice characters
- [ ] Integration tests: 30 allowed, 31st rejected, rolls over after an hour (fixed clock), Free and Creator behave the same
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** 30 / hour on every plan.
**Blocked by:** B1, Step 1 T6.
**Files likely touched:** `src/server/usage.ts`, `src/server/usage.test.ts`
**Out of scope:** UI message (B11, B15).

---

## B7 · `feat: channel picker on new post`
**Labels:** `MVP`, `buffer`, `composer`
**Acceptance criteria**
- [ ] `/app/posts/new` shows channels from B5; only `selectable` ones can be picked; unsupported show "Not supported yet", `needsReconnect` show "Reconnect this channel in Buffer"
- [ ] Picking a channel creates the post row (`channel_id`, `channel_service`, `channel_name`, `buffer_organization_id`) and routes to `/app/posts/:id`
- [ ] Before the first save, the channel can be changed on the composer; after `buffer_post_id` is set, the picker is read-only
- [ ] "Refresh channels" button; zero selectable channels → empty state "Connect LinkedIn, X, … in Buffer, then Refresh channels"
- [ ] E2E (Buffer mocked): pick a channel → composer opens; empty state renders. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** B5, Step 6 composer route.
**Files likely touched:** `src/routes/app/posts/new.tsx`, `src/components/ChannelPicker/*`, `src/server/posts/create-post.ts`, `src/content/copy.ts`, `e2e/new-post.spec.ts`
**Out of scope:** visual design, editor itself (Step 6).

---

## B8 · `feat: save new post to Buffer`
**Labels:** `MVP`, `buffer`
**Acceptance criteria**
- [ ] `saveDraft(postId)` for a post with no `buffer_post_id`: locks the post row, re-checks `countFor` server-side, checks the channel with `getChannel` (disconnected/locked → typed `CHANNEL_UNAVAILABLE`), consumes a Buffer write (B6), calls `createDraft`
- [ ] On success, in one transaction: store `buffer_post_id`, `buffer_status = draft`, insert a version (text changed)
- [ ] Two concurrent `saveDraft` calls → exactly one `createPost` request; the second uses `editPost`
- [ ] Failure (temporary, `MutationError`, over limit) → no version, Buffer write refunded, typed error returned
- [ ] Integration tests for each case above; works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan; never counts as a review. Locked posts are rejected (history window).
**Blocked by:** B2, B4, B6.
**Files likely touched:** `src/server/posts/save-draft.ts`, `src/server/posts/save-draft.test.ts`
**Out of scope:** existing drafts (B9), UI (B11).

---

## B9 · `feat: save existing draft to Buffer`
**Labels:** `MVP`, `buffer`
**Acceptance criteria**
- [ ] Text equals the latest version and stored status is `draft` → returns `ALREADY_SAVED`, zero Buffer calls
- [ ] Otherwise one `getPost` pre-check: `null` → `createDraft` + repoint, returns `RECREATED`; status not `draft` → stores it and returns typed `NOT_A_DRAFT` (with `error.message` for `error`); channel disconnected/locked → `CHANNEL_UNAVAILABLE`
- [ ] `draft` → `editDraftText`; version inserted only when text changed
- [ ] Integration tests: each branch, and the request body has no `assets`
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan.
**Blocked by:** B8.
**Files likely touched:** `src/server/posts/save-draft.ts`, `src/server/posts/save-draft.test.ts`
**Out of scope:** "Save as a new draft" (B10).

---

## B10 · `feat: save as a new draft`
**Labels:** `MVP`, `buffer`
**Acceptance criteria**
- [ ] `saveAsNewDraft(postId)` runs only when stored status is `needs_approval`, `scheduled`, `sending`, `sent`, or `error`; otherwise rejects
- [ ] Creates a new draft on the same channel, repoints `buffer_post_id`, sets status `draft`, writes a version if text changed; the old Buffer post is untouched (no delete/edit request)
- [ ] Consumes one Buffer write
- [ ] Integration tests: scheduled → new draft, versions + reactions kept, rejected when already a draft
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan.
**Blocked by:** B9.
**Files likely touched:** `src/server/posts/save-as-new-draft.ts`, tests
**Out of scope:** UI (B11).

---

## B11 · `feat: save draft button + messages`
**Labels:** `MVP`, `buffer`, `composer`
**Acceptance criteria**
- [ ] "Save draft" in the composer is disabled while saving, while over the character limit, and when the channel is unavailable ("Reconnect this channel in Buffer, then reopen")
- [ ] Messages from `src/content/copy.ts`: Saved · Already saved · Recreated in Buffer · Buffer isn't responding (+ seconds from `retryAfter`) · Buffer's `MutationError` text verbatim · "You've saved a lot this hour. Try again in N minutes."
- [ ] `NOT_A_DRAFT` shows the status (and Buffer's error) with a "Save as a new draft" button (B10)
- [ ] "📎 N attachments, edit them in Buffer" when the Buffer post has attachments
- [ ] E2E (Buffer mocked): save → Saved; scheduled → Save as a new draft. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** B9, B10, Step 6 composer.
**Files likely touched:** `src/components/SaveDraft/*`, `src/routes/app/posts/$id.tsx`, `src/content/copy.ts`, `e2e/save-draft.spec.ts`
**Out of scope:** reconnect dialog (Step 6), visual design.

---

## B12 · `feat: sync Buffer status on composer open`
**Labels:** `MVP`, `buffer`
**Acceptance criteria**
- [ ] Composer loader calls `syncPostStatus(postId)` when `buffer_post_id` is set: one `getPost`, stores `buffer_status` + `due_at`; not found → leaves the row, flags `missingInBuffer`
- [ ] Temporary error → composer still loads with last known status + "Couldn't check Buffer just now"
- [ ] No call for posts without `buffer_post_id` or sample posts
- [ ] Integration tests for each branch; E2E: composer opens when Buffer is mocked as down. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** B3, Step 6 composer route.
**Files likely touched:** `src/server/posts/sync-status.ts`, `src/routes/app/posts/$id.tsx`, tests
**Out of scope:** dashboard badges (B16).

---

## B13 · `feat: importable drafts list`
**Labels:** `MVP`, `buffer`, `import`
**Acceptance criteria**
- [ ] `listImportableDrafts(userId)` calls `listDraftPosts` for the user's org and selectable channels (B5), newest first, `first: 20`
- [ ] Hides drafts already imported (any visibility), empty text, or with thread metadata; returns `hiddenCount` for empty/thread drafts
- [ ] Each row: channel, text preview, Buffer `updatedAt`, attachment count, `over` from `countFor`
- [ ] Integration tests: each hide rule, already-imported locked draft hidden, zero results
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan.
**Blocked by:** B2, B5.
**Files likely touched:** `src/server/buffer/import-list.ts`, tests, `src/test/handlers/buffer.ts`
**Out of scope:** "Load more" (stretch), the import action (B14).

---

## B14 · `feat: import a Buffer draft`
**Labels:** `MVP`, `buffer`, `import`
**Acceptance criteria**
- [ ] `importDraft(userId, bufferPostId)` takes the row the client got from B13 (no extra Buffer call), rejects it unless `channelId` is one of the user's selectable cached channels and the text passes basic validation, consumes one Buffer write, inserts the post (`buffer_status = draft`, `created_at` + `last_edited_at` = now) and version 1 in one transaction
- [ ] Unique (`user_id`, `buffer_post_id`) violation → returns the existing post ID, no duplicate
- [ ] Never inserts a `post_review` or `tts_chars` event; over-limit text imports fine
- [ ] Integration tests: import, double import, over-limit import, old Buffer `updatedAt` still visible on Free
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** free on every plan; Free users' imports are never immediately locked.
**Blocked by:** B6, B13.
**Files likely touched:** `src/server/buffer/import-draft.ts`, tests
**Out of scope:** UI (B15).

---

## B15 · `feat: import drafts panel`
**Labels:** `MVP`, `buffer`, `import`, `pages`
**Acceptance criteria**
- [ ] `/app` has an "Import from Buffer" panel loaded on open (not on page load), listing B13 rows with an Import button each
- [ ] Shows "N drafts can't be imported (threads or empty)" when `hiddenCount > 0`, and "📎 N attachments" per row
- [ ] Empty state "No Buffer drafts to import"; Buffer down → "Couldn't reach Buffer" + retry; cap hit → B6 message
- [ ] E2E (Buffer mocked): import a draft → lands in composer; empty state. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** B14, Step 10 dashboard placeholder (or a minimal `/app` from S10).
**Files likely touched:** `src/components/ImportPanel/*`, `src/routes/app/index.tsx`, `src/content/copy.ts`, `e2e/import.spec.ts`
**Out of scope:** dashboard post list (Step 10), visual design.

---

## B16 · `feat: dashboard Buffer status badges`
**Labels:** `MVP`, `buffer`, `pages`
**Acceptance criteria**
- [ ] Each post row shows its last known status: Not in Buffer yet · Draft · Needs approval · Scheduled for {due_at in user timezone} · Sending · Sent · Error
- [ ] No Buffer calls on dashboard load
- [ ] Unit test for the status → label mapping; E2E: seeded posts render each badge
- [ ] Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** B1, Step 10 dashboard placeholder.
**Files likely touched:** `src/components/StatusBadge/*`, `src/lib/buffer-status.ts`, `src/content/copy.ts`, `e2e/dashboard.spec.ts`
**Out of scope:** refreshing statuses in bulk (never), visual design.

---

## Noted for later steps (not drafted here)
- **Live character counter UI** renders `countFor` → Step 6 (Composer)
- **Approve & schedule** reuses `getPost` pre-check + `saveDraft`; handle `LimitReachedError` (Buffer Free: 10 scheduled per channel) → Step 9
- **Version history panel + restore** (rows already written by B8–B10, B14) → Step 9
- **Seed:** imported 2-image draft needs `buffer_status = draft` + version 1 → Step 2 I12 follow-up
- **Stretch:** "Load more" on import, X Premium limits, threads, org switching, "Duplicate to another channel", deleting the Buffer draft from Vocelo (`deletePost`)
