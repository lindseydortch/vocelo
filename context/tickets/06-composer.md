# Step 6 Tickets: Composer

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 6 Decisions". The composer never calls Buffer, ElevenLabs, or the LLM itself; server tests use `embedded-postgres` + factories (Step 2 I13), E2E uses `/__test/login` (I14) with every external API mocked. Fixed clock for every `last_edited_at` test.

**Merge order:**
```
After Step 1 T2/T7, Step 2 I5/I6/I7/I13/I14, Step 3 S3/S10:
  C1 route shell · C2 text normalization                            (parallel)
    → C3 autosave server fn (needs C2) · C13 delete post (needs C1)
    → C4 editor + autosave hook (needs C1, C3)
    → C5 local backup (needs C4) · C6 conflict prompt (needs C4) · C7 counter (needs C4, Step 4 B2)
    → C8 selection (needs C4) · C9 signed-out dialog (needs C5) · C12 hint (needs C4)
    → C10 not-a-draft banner (needs C1, Step 4 B12) · C11 Cmd/Ctrl+S (needs C4, Step 4 B11)
    → C14 post gone while open (needs C4)
```
C1 unblocks Step 4 B7, B11, B12 and Step 5 P11, P15. Merge it early. No Step 6 migration.

---

## C1 · `feat: composer route shell`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] `/app/posts/$id` loader returns the post only if it belongs to `requireUser()` and passes `visiblePostsWhere` (T7); another user's or a missing post → 404
- [ ] A post that exists but is outside the history window → redirect to `/app` with "This post is locked on your plan"
- [ ] Loader returns `readOnly: true` for `is_sample` posts
- [ ] Two-column layout (`1fr 36rem`) with named slots: left (channel, editor, counter, save, hint), right (persona panel), top (banners, meter); placeholder text in each slot; copy from `src/content/copy.ts`
- [ ] Integration tests for each loader branch; E2E: own post opens, other user's post 404s. Works on desktop 1280px+

**Plan behavior:** Free and Creator differ only through `visiblePostsWhere` (30 days vs 12 months); the sample post never locks.
**Blocked by:** Step 1 T2, T7; Step 3 S10; Step 2 I14.
**Files likely touched:** `src/routes/app/posts/$id.tsx`, `src/routes/app/posts/$id.module.scss`, `src/server/posts/get-post.ts`, `src/server/posts/get-post.test.ts`, `e2e/composer.spec.ts`
**Out of scope:** the editor (C4), channel picker (B7), save button (B11), visual design.

---

## C2 · `feat: shared text normalization`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] `src/lib/text.ts` exports `normalizeText` (`\r\n` and lone `\r` → `\n`, `String.prototype.normalize('NFC')`, no trimming), `isBlank` (true for empty or whitespace-only), and `textHash` (sha256 hex of normalized text)
- [ ] `textHash` gives the same result in Node and the browser (Web Crypto `crypto.subtle` in both)
- [ ] `MAX_POST_CHARS = 20000` exported from the same file
- [ ] Unit tests: CRLF, decomposed `é` → composed, leading/trailing whitespace kept, `isBlank` on `"  \n "`, hash stable across normalization-equivalent inputs
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 2 I5.
**Files likely touched:** `src/lib/text.ts`, `src/lib/text.test.ts`
**Out of scope:** character counting per channel (B2).

---

## C3 · `feat: autosave post text`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] Server fn `updatePostText({ postId, text, baseEditedAt })`: `requireUser()`, normalizes text, rejects over 20,000 chars (`TEXT_TOO_LONG`)
- [ ] Missing / other user's post → `POST_NOT_FOUND`; outside the history window → `POST_LOCKED`; sample post → `READ_ONLY`
- [ ] Stored `last_edited_at` newer than `baseEditedAt` → `EDIT_CONFLICT` (returns the stored text + `last_edited_at`); `force: true` skips the check (Keep mine)
- [ ] Text unchanged → no write, `last_edited_at` untouched; changed → writes `text` + `last_edited_at = now()`, returns the new `last_edited_at`
- [ ] Integration tests for every branch above (fixed clock); never writes a version, never consumes usage

**Plan behavior:** same on every plan; no limits, no usage.
**Blocked by:** C2; Step 1 T2, T7; Step 3 S3.
**Files likely touched:** `src/server/posts/update-text.ts`, `src/server/posts/update-text.test.ts`, `src/lib/errors.ts`
**Out of scope:** client debounce (C4), Buffer save (B8/B9).

---

## C4 · `feat: composer editor with autosave`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] Auto-growing `<textarea>` in C1's left slot; refuses input past 20,000 chars with "Posts can be up to 20,000 characters."; `readOnly` for the sample post (no autosave)
- [ ] `useComposerText(post)` debounces autosave ~1 s, tracks `baseEditedAt`, and exposes `text`, `status`, and `flush(): Promise<void>` (awaits any pending save)
- [ ] Status line: "Saving…" · "Saved in Vocelo" · "Not in Buffer yet" (no `buffer_post_id`) · "Changes not in Buffer yet" (text ≠ latest version text)
- [ ] Network/5xx failure → retries at 2 / 5 / 10 / 30 s, then every 30 s: "Couldn't save. Retrying…"
- [ ] E2E: type → reload → text is there; status changes to "Saved in Vocelo". Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C1, C3.
**Files likely touched:** `src/components/Editor/*`, `src/hooks/useComposerText.ts`, `src/hooks/useComposerText.test.ts`, `src/content/copy.ts`, `e2e/composer.spec.ts`
**Out of scope:** local backup (C5), conflict UI (C6), counter (C7).

---

## C5 · `feat: local backup of unsynced text`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] While an autosave is pending or failing, text + timestamp are written to `localStorage` key `vocelo:draft:{userId}:{postId}`; removed once the server confirms
- [ ] On open, a local copy that differs from the server text and is newer than `last_edited_at` loads into the editor with "Restored unsaved text from this browser" and autosaves
- [ ] Entries older than 7 days are deleted on any composer open; every storage call is wrapped in try/catch (works with storage blocked)
- [ ] `beforeunload` warning only while text is unsynced
- [ ] Unit tests (restore / ignore older / expiry / storage throws); E2E: block the autosave request → reload → text restored. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C4.
**Files likely touched:** `src/lib/local-backup.ts`, `src/lib/local-backup.test.ts`, `src/hooks/useComposerText.ts`, `e2e/composer.spec.ts`
**Out of scope:** the signed-out dialog (C9).

---

## C6 · `feat: two-tab edit conflict prompt`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] `EDIT_CONFLICT` pauses autosave and shows "This post changed in another tab." with **Load latest** and **Keep mine**
- [ ] Load latest replaces the editor text with the server's and resumes autosave with the new `baseEditedAt`
- [ ] Keep mine re-sends with `force: true` and resumes autosave
- [ ] E2E: two pages on one post, edit both → second shows the prompt; each button does what it says. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C4.
**Files likely touched:** `src/components/ConflictPrompt/*`, `src/hooks/useComposerText.ts`, `src/content/copy.ts`, `e2e/composer-conflict.spec.ts`
**Out of scope:** merging text (never).

---

## C7 · `feat: live character counter`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] Renders `countFor(post.channel_service, normalizeText(text), { maxCharacters })` on every keystroke: `1,234 / 3,000`
- [ ] Over the limit: "12 over X's 280 limit. Saving is blocked until it fits." using `$tone-negative`; exposes `over` for B11/C11
- [ ] Mastodon with no `maxCharacters` shows "500 (server default)"; channel changes before the first save recount immediately
- [ ] Component test: under, at, over by 1, Mastodon default label. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C4; Step 4 B2.
**Files likely touched:** `src/components/CharCounter/*`, `src/content/copy.ts`
**Out of scope:** counting rules (B2), blocking the save (B11).

---

## C8 · `feat: editor selection tracking`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] `useSelection(textareaRef)` keeps the last selection as `{ start, end, text }`, updated on `select`, `mouseup`, `keyup`; survives the textarea losing focus
- [ ] Whitespace-only selection → `null`; any text change → `null`
- [ ] Exposed to the right-hand slot through composer context (no playback here)
- [ ] Unit tests for each rule; works on desktop 1280px+ (selection survives clicking a button in the right column, checked in E2E)

**Plan behavior:** same on every plan.
**Blocked by:** C4.
**Files likely touched:** `src/hooks/useSelection.ts`, `src/hooks/useSelection.test.ts`, `src/components/Composer/ComposerContext.tsx`, `e2e/composer.spec.ts`
**Out of scope:** "Hear selection" button + server check (Step 7).

---

## C9 · `feat: signed-out dialog keeps text`
**Labels:** `MVP`, `composer`, `auth`
**Acceptance criteria**
- [ ] Any composer server call returning `UNAUTHENTICATED` or `BUFFER_AUTH_EXPIRED` opens one dialog: "You've been signed out. Sign in again; your text is kept here."
- [ ] Opening it writes the current text to the local backup (C5) before anything else
- [ ] "Sign in again" → `/auth/buffer/start?returnTo=/app/posts/{id}`; after sign-in, C5 restores the text
- [ ] E2E: clear the session cookie mid-edit → dialog shows → sign in (test helper) → text restored. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C5; Step 3 S5, S9.
**Files likely touched:** `src/components/SignedOutDialog/*`, `src/hooks/useComposerText.ts`, `src/content/copy.ts`, `e2e/composer-signed-out.spec.ts`
**Out of scope:** token refresh (S8), sign-in pages (S11, S12).

---

## C10 · `feat: not-a-draft-in-Buffer banner`
**Labels:** `MVP`, `composer`, `buffer`
**Acceptance criteria**
- [ ] When the post's `buffer_status` is `needs_approval`, `scheduled`, `sending`, `sent`, or `error`, C1's top slot shows: "This post is {status} in Buffer. Edits here won't change it; use Save as a new draft."
- [ ] Text stays editable and autosaves
- [ ] No banner for `draft`, no Buffer post, or the sample post
- [ ] Component test per status; E2E with a seeded scheduled post. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C1; Step 4 B12.
**Files likely touched:** `src/components/BufferStatusBanner/*`, `src/lib/buffer-status.ts`, `src/content/copy.ts`
**Out of scope:** the "Save as a new draft" button (B11).

---

## C11 · `feat: Cmd/Ctrl+S saves the draft`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] Cmd+S (macOS) / Ctrl+S (others) in the composer calls B11's save handler (which awaits `flush()`) and prevents the browser's save dialog
- [ ] When Save draft is disabled, the shortcut shows the reason instead (over limit, channel unavailable, blank, read-only)
- [ ] E2E: shortcut saves (Buffer mocked); over-limit shows the reason. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C4; Step 4 B11.
**Files likely touched:** `src/hooks/useSaveShortcut.ts`, `src/routes/app/posts/$id.tsx`, `e2e/save-draft.spec.ts`
**Out of scope:** other shortcuts (stretch).

---

## C12 · `feat: "Feeling stuck?" hint`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] One line under the editor, shown only while `isBlank(text)`: link to Wispr Flow (opens in a new tab, `rel="noopener"`) and OS dictation shortcuts (macOS: press Fn twice; Windows: Win+H)
- [ ] Hidden on the sample post
- [ ] Component test: shown when blank, hidden after typing. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** C4.
**Files likely touched:** `src/components/DictationHint/*`, `src/content/copy.ts`
**Out of scope:** built-in voice-to-text (stretch).

---

## C13 · `feat: delete post`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] Server fn `deletePost(postId)`: owner only (else `POST_NOT_FOUND`); deletes post, versions, reactions, Tone reads in one transaction; `usage_events.post_id` set to `NULL` (rows kept, no refund); no Buffer call
- [ ] Composer "Delete post" button with confirm: "Deletes it from Vocelo only. Your Buffer draft stays." → redirects to `/app`
- [ ] Works on the sample post (not re-created on the next sign-in, since `ensureSamplePost` runs only for new users)
- [ ] Integration tests: cascade, usage rows kept, other user's post rejected; E2E: delete → back on `/app`. Works on desktop 1280px+

**Plan behavior:** same on every plan. Deleting never refunds usage.
**Blocked by:** C1.
**Files likely touched:** `src/server/posts/delete-post.ts`, `src/server/posts/delete-post.test.ts`, `src/components/DeletePost/*`, `src/content/copy.ts`, `e2e/composer.spec.ts`
**Out of scope:** dashboard row delete (Step 10, reuses this server fn), deleting the Buffer draft (stretch).

---

## C14 · `feat: post deleted or locked while open`
**Labels:** `MVP`, `composer`
**Acceptance criteria**
- [ ] Autosave or any composer action returning `POST_NOT_FOUND` or `POST_LOCKED` turns the editor read-only and stops autosave
- [ ] Message: "This post was deleted." / "This post is locked on your plan."
- [ ] **Copy text** button copies the current editor text; the local backup is kept; nothing is recreated
- [ ] E2E: delete the post in a second page → first page shows the message + Copy text. Works on desktop 1280px+

**Plan behavior:** same on every plan (locking itself depends on the plan's history window).
**Blocked by:** C4.
**Files likely touched:** `src/components/PostGone/*`, `src/hooks/useComposerText.ts`, `src/content/copy.ts`, `e2e/composer-gone.spec.ts`
**Out of scope:** recovering deleted posts (never).

---

## Noted for later steps (not drafted here)
- **Step 4 B11:** Save draft must `await flush()` from C4 first; add C4 to B11's **Blocked by**.
- **Step 7 (playback):** read text from the DB after `flush()`; "Read aloud" ↔ "Hear selection (N chars)" uses C8; server verifies `{ start, end, text }` against the stored slice; disabled while `isBlank`.
- **Step 8 (reactions + Tone read):** hashes via `textHash(normalizeText(text))` from C2; disabled while `isBlank`; if prompts become channel-aware, add the channel to the cache key.
- **Step 9 (versions):** restored text goes through C4's autosave (no version row) and shows "Changes not in Buffer yet".
- **Step 10 (pages):** dashboard shows blank posts as "Empty post"; row delete reuses C13's `deletePost`; sample post "Start your own post" button in C1's read-only mode.
