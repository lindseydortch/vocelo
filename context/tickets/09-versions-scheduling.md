# Step 9 Tickets: Versions + scheduling

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 9 Decisions"; the why lives in `context/versions-scheduling.md`. Buffer is mocked with MSW (`src/test/handlers/buffer.ts`): each ticket adds the variants it needs (schedule success, `LimitReachedError`, paused-queue channel, `needs_approval` result, `sent` post, not found). Times use a fixed clock. No test ever calls real Buffer.

**No Step 9 ticket has a migration.**

**Merge order:**
```
After Step 1 T7, Step 4 B3/B4/B6/B9/B11, Step 5 P4, Step 6 C1/C4/C10:
  K1 queue-paused flag · K3 schedule time helpers · K8 version list server fns   (parallel)
  K2 Buffer schedule mutations (needs B4; H12 ✅ done)
    → K4 schedule server fn (needs K1, K2, K3, B9) · K5 move back to draft server fn (needs K2, B6)
    → K6 schedule dialog (needs K4, B11) · K7 move back to draft button (needs K1, K5, C10)
  K8 → K9 version history panel (needs C1, P4) → K10 restore a version (needs C4)
  K7 → H13 dry run (human)
```
Cut order if time runs out: K9's locked "N older versions" line first (keep the list), then K1's paused-queue warning.

---

## K1 · `feat: queue-paused flag in Buffer reads`
**Labels:** `MVP`, `buffer`, `scheduling`
**Acceptance criteria**
- [ ] `getChannel(id)` and `getPost(id)`'s `channel { … }` also return `isQueuePaused`
- [ ] Integration tests (MSW): paused and unpaused channel for both queries
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 4 B3.
**Files likely touched:** `src/server/buffer/queries.ts`, `src/server/buffer/queries.test.ts`, `src/test/handlers/buffer.ts`
**Out of scope:** showing the warning (K6, K7), the channel picker.

---

## K2 · `feat: Buffer schedule mutations`
**Labels:** `MVP`, `buffer`, `scheduling`
**Acceptance criteria**
- [ ] `scheduleBufferPost(postId, text, { mode: 'addToQueue' | 'customScheduled', dueAt? })` sends `editPost { id, text, mode, dueAt?, saveToDraft: false, schedulingType: automatic }` (verified by H12: `text` is required, and without `saveToDraft: false` Buffer returns success but leaves a draft); never sends `assets` or `metadata`; returns `{ status, dueAt }`
- [ ] A success whose returned `status` is still `draft` → typed `NOT_SCHEDULED` (never reported as scheduled)
- [ ] `moveBufferPostToDraft(postId, text)` sends `editPost { id, text, saveToDraft: true }` only; returns `{ status }` (Buffer keeps the old `dueAt`; callers ignore it)
- [ ] `LimitReachedError` → typed `QUEUE_FULL` with Buffer's message; other `MutationError` → `BufferMutationError` (Step 4 B4)
- [ ] Integration tests (MSW, shapes copied from H12's live responses): both success shapes, success-but-still-draft → `NOT_SCHEDULED`, `addToQueue` returning no `dueAt`, `needs_approval` result, `LimitReachedError`, `InvalidInputError` "Post must have either text or media.", request bodies include `text` and no `assets`
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 4 B4. (H12 ✅ done 2026-11-13.)
**Files likely touched:** `src/server/buffer/mutations.ts`, `src/server/buffer/mutations.test.ts`, `src/lib/errors.ts`, `src/test/handlers/buffer.ts`
**Out of scope:** save orchestration (K4), share now / share next (stretch).

---

## K3 · `feat: schedule time helpers`
**Labels:** `MVP`, `scheduling`
**Acceptance criteria**
- [ ] `src/lib/schedule-time.ts` exports `validateDueAt(now, dueAt)` → `ok` | `TOO_SOON` (< 5 min) | `TOO_FAR` (> 1 year); `defaultDueAt(now)` → next full hour ≥ 5 min away; `resolveTimeZone(userTz, browserTz)`; `formatInZone(date, tz)` → "Tue 3:00 PM America/Chicago"
- [ ] Same module runs in the browser and on the server (no Node-only APIs)
- [ ] Unit tests with a fixed clock: exactly 5 min, 4:59, 1 year, 1 year + 1 min, default at :54 vs :56, America/Chicago across the 2027-03-14 DST change, null user timezone → browser
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 2 I5.
**Files likely touched:** `src/lib/schedule-time.ts`, `src/lib/schedule-time.test.ts`
**Out of scope:** the dialog (K6), badge rendering (Step 4 B16 uses `formatInZone`).

---

## K4 · `feat: schedule server function`
**Labels:** `MVP`, `buffer`, `scheduling`
**Acceptance criteria**
- [ ] `schedulePost(postId, { mode, dueAt? })` locks the post row, re-checks `validateDueAt` (K3) for `customScheduled`, consumes **one** Buffer write (B6), then calls `saveDraft(postId, { consumeWrite: false })` (B9; recreates a deleted draft, writes a version if text changed) and `scheduleBufferPost` (K2); stores `buffer_status` + `due_at`
- [ ] Same blocks as Save draft (blank, over limit, `CHANNEL_UNAVAILABLE`, `NOT_A_DRAFT`, sample, locked) → typed errors; a failure before any Buffer write refunds the write
- [ ] Save works but schedule fails (`QUEUE_FULL`, temporary, `MutationError`) → returns `SAVED_NOT_SCHEDULED` with the reason; draft + version kept; no refund
- [ ] Returns `queuePaused` from the pre-check and the result status (`scheduled` or `needs_approval`)
- [ ] Integration tests: each branch above, exactly 1 `buffer_write` event per call, `TOO_SOON` from the server even if the client passed it, Free and Creator identical, never a `post_review` event
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan; never a reviewed post. Locked posts rejected.
**Blocked by:** K1, K2, K3, Step 4 B9.
**Files likely touched:** `src/server/posts/schedule-post.ts`, `src/server/posts/schedule-post.test.ts`, `src/server/posts/save-draft.ts` (add `consumeWrite` option)
**Out of scope:** UI (K6), Move back to draft (K5).

---

## K5 · `feat: move back to draft server function`
**Labels:** `MVP`, `buffer`, `scheduling`
**Acceptance criteria**
- [ ] `moveBackToDraft(postId)` locks the post row and runs one `getPost` pre-check: `scheduled` → consume 1 Buffer write, `moveBufferPostToDraft(postId, posts.text)` (K2) · `draft` → `ALREADY_DRAFT` · `sending`/`sent` → `ALREADY_POSTED` · not found → clear `buffer_post_id`, `NOT_IN_BUFFER` · `needs_approval`/`error` → `NOT_A_DRAFT`
- [ ] Every branch stores the fresh `buffer_status` and clears `due_at` whenever status isn't `scheduled` (Buffer keeps a stale `dueAt` on drafts, H12); only the `scheduled` branch consumes a write; Buffer failure refunds it
- [ ] Integration tests for every branch; write count per branch
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan. Locked posts rejected.
**Blocked by:** K2, Step 4 B6.
**Files likely touched:** `src/server/posts/move-back-to-draft.ts`, `src/server/posts/move-back-to-draft.test.ts`
**Out of scope:** UI (K7), deleting the Buffer post (stretch).

---

## K6 · `feat: schedule dialog`
**Labels:** `MVP`, `scheduling`, `composer`
**Acceptance criteria**
- [ ] "Schedule in Buffer" next to Save draft; disabled with the same reasons as Save draft (B11). Opens a modal: radio **Add to queue** (default) / **Pick a time** (`datetime-local`, default `defaultDueAt`, zone label from `resolveTimeZone`), client-side `validateDueAt` messages, paused-queue warning when known
- [ ] Confirm calls `flush()` then K4; button "Scheduling…" + disabled while running
- [ ] Result messages from `copy.ts`: "Scheduled for {time}" · "Queued for {time}" · "Added to your Buffer queue" · "Sent for approval in Buffer." · "Saved as a draft in Buffer, but couldn't schedule: {reason}" · queue-full message · cap message (B6)
- [ ] Cmd/Ctrl+S never opens or submits the dialog
- [ ] Component tests for each message; E2E (Buffer mocked): Pick a time → "Scheduled for…". Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** K4, Step 4 B11, Step 6 C4.
**Files likely touched:** `src/components/ScheduleDialog/*`, `src/routes/app/posts/$id.tsx`, `src/content/copy.ts`, `e2e/schedule.spec.ts`
**Out of scope:** share now / share next / change time (stretch), visual design.

---

## K7 · `feat: move back to draft button`
**Labels:** `MVP`, `scheduling`, `composer`
**Acceptance criteria**
- [ ] For `scheduled`, C10's banner action slot shows **Move back to draft** before "Save as a new draft"; calls K5; disabled while running
- [ ] Messages from `copy.ts` per K5 result: moved → banner disappears + "Back to a draft in Buffer" · "Already a draft." · "It's already posting or posted. Save as a new draft instead." · "This post isn't in Buffer anymore. Save draft to create a new one."
- [ ] Paused-queue warning in the banner when the post is scheduled and K1 reports `isQueuePaused`
- [ ] E2E (Buffer mocked): schedule → banner "Scheduled for…" → Move back to draft → Save draft enabled again. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** K1, K5, Step 6 C10.
**Files likely touched:** `src/components/BufferStatusBanner/*`, `src/content/copy.ts`, `e2e/schedule.spec.ts`
**Out of scope:** the per-status banner text (C10), visual design.

---

## K8 · `feat: version list server functions`
**Labels:** `MVP`, `versions`
**Acceptance criteria**
- [ ] `listVersions(postId)` returns visible versions newest first (`id`, `created_at`, 80-char preview, `countFor` count, `isNewest`) via T7 `visibleVersions`, plus `hiddenCount` and the post's `buffer_status` for the newest tag
- [ ] `getVersion(versionId)` returns full text; a version hidden by the plan → `VERSION_LOCKED`; another user's or a locked post's → 404
- [ ] Sample post → empty list
- [ ] Integration tests: Free with 5 versions sees 3 + `hiddenCount: 2`; Creator sees 5; hidden version by ID rejected; upgrade reveals all
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** Free newest 3; Creator all. Hidden, never deleted.
**Blocked by:** Step 1 T7, Step 4 B8.
**Files likely touched:** `src/server/versions.ts`, `src/server/versions.test.ts`
**Out of scope:** UI (K9), diff (stretch).

---

## K9 · `feat: version history panel`
**Labels:** `MVP`, `versions`, `composer`
**Acceptance criteria**
- [ ] Composer panel lists K8 rows: time saved (user timezone), preview, character count; newest tag "In Buffer" / "Scheduled" / "Posted" / "Waiting for approval"
- [ ] Clicking a row shows the full text read-only (K8 `getVersion`)
- [ ] Free with hidden versions: "🔒 N older versions. Upgrade to see them" → Checkout (P4); Creator never sees it
- [ ] Hidden on the sample post; empty state "No versions yet. Save draft to create one."
- [ ] E2E: seeded post with versions renders + Free locked line. Works on desktop 1280px+

**Plan behavior:** Free newest 3 + locked line; Creator all.
**Blocked by:** K8, Step 6 C1, Step 5 P4.
**Files likely touched:** `src/components/VersionPanel/*`, `src/routes/app/posts/$id.tsx`, `src/content/copy.ts`, `e2e/versions.spec.ts`
**Out of scope:** Restore (K10), diff view (stretch).

---

## K10 · `feat: restore a version`
**Labels:** `MVP`, `versions`, `composer`
**Acceptance criteria**
- [ ] **Restore** in the version preview loads the text into the editor (C4 `setText`), which autosaves to Vocelo; no version row is written; status shows "Changes not in Buffer yet"
- [ ] Current text ≠ newest version → confirm "Your current text isn't in Buffer and isn't saved as a version. Replace it?"; cancel changes nothing
- [ ] A version equal to the current text shows a disabled "Current" instead of Restore
- [ ] `VERSION_LOCKED` → "This version is locked on your plan."
- [ ] E2E: edit + save twice → restore v1 → save → a new (3rd) version exists, older ones unchanged. Works on desktop 1280px+

**Plan behavior:** same on every plan (Free can only reach visible versions).
**Blocked by:** K9, Step 6 C4.
**Files likely touched:** `src/components/VersionPanel/*`, `src/components/Editor/*`, `src/content/copy.ts`, `e2e/versions.spec.ts`
**Out of scope:** diff view, restoring into Buffer directly (always via Save draft).

---

## Noted for later steps (not drafted here)
- **Stretch:** share now / share next, "Change time" on a scheduled post, diff view, deleting the Buffer post from Vocelo, channel-timezone hint, pre-check against `Organization.limits.scheduledPosts`
- **Step 10 (pages):** dashboard badges use K3's `formatInZone` (B16)
- **Demo:** H13 test channel; checklist in `context/environments.md`
