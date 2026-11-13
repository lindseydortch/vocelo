# Step 7 Tickets: Personas + playback

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 7 Decisions". Server tests use `embedded-postgres` + factories (Step 2 I13) + the billing presets (Step 5 P14); ElevenLabs is mocked with MSW or `TTS_PROVIDER=fixture`; the audio store uses the in-memory fake in tests. E2E uses `/__test/login` (I14). No test ever calls ElevenLabs.

**Merge order:**
```
After Step 1 T2/T3/T5, Step 2 I5/I6/I13/I14, Step 3 S3/S10:
  V1 persona schema additions · V2 voice + icon catalogs · V3 TTS provider · V4 audio store   (parallel, max 3 worktrees; V1 merges alone: it has a migration)
    → V5 audio route (needs V4) · V6 read request validation (needs V1, Step 4 B2, Step 6 C2)
    → V7 generate or reuse audio (needs V3, V4, V6, Step 1 T6)
    → V8 audio player (needs V5) · V13 custom persona server fns (needs V1, V2)
    → V9 persona picker (needs V2, V13, Step 6 C1) · V12 personas page (needs V13, Step 5 P4)
    → V10 read aloud buttons (needs V7, V8, V9, Step 6 C4, C8)
    → V11 speaking indicator (needs V10) · V14 builder form (needs V8, V12, V13) · V15 delete persona (needs V12)
  V16 static audio script (needs V2, Step 1 T3) → H10 run it (human)
```
V7 + V10 are the playback wiring point Step 5 P12 waits on. Cut order: V11 first.

---

## V1 · `feat: persona schema additions`
**Labels:** `MVP`, `personas`, `database`
**Acceptance criteria**
- [ ] Additive migration: `personas.updated_at` (timestamptz, not null, default `now()`), backfilled to `created_at`
- [ ] Drizzle schema + types updated; existing standard persona rows (T3) untouched
- [ ] Migration applies cleanly on top of every earlier migration (integration test runs all migrations)
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** Step 1 T2, T3; Step 2 I6.
**Files likely touched:** `src/db/schema/personas.ts`, `drizzle/00NN_persona_updated_at.sql`
**Out of scope:** writing `updated_at` on edit (V13), "Persona changed: refresh" (Step 8).

---

## V2 · `feat: voice and icon catalogs`
**Labels:** `MVP`, `personas`
**Acceptance criteria**
- [ ] `src/lib/voices.ts` exports `CUSTOM_VOICES`: ~8 entries `{ id, label, description, previewPath: '/voices/<id>.mp3' }` (IDs from H2; placeholders until then) and `isCustomVoice(id)`
- [ ] `src/lib/avatars.ts` exports `AVATAR_ICONS`: ~12 entries `{ key, label }` and `isAvatarKey(key)`; icons are grayscale placeholder SVGs in `src/assets/avatars/`
- [ ] Standard persona `avatar_key`s (T3) resolve through the same catalog
- [ ] Unit tests: guards accept known values, reject unknown
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none (catalogs are shared; plan gating is in V13).
**Blocked by:** Step 2 I5; H2 (real voice IDs; can merge with placeholders).
**Files likely touched:** `src/lib/voices.ts`, `src/lib/avatars.ts`, `src/assets/avatars/*`, tests
**Out of scope:** avatar artwork (Design Pass), uploads (stretch).

---

## V3 · `feat: TTS provider module`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] `src/server/tts.ts` `synthesize(voiceId, text): Promise<{ kind: 'audio', bytes } | { kind: 'browser' }>` picks the provider from `TTS_PROVIDER`
- [ ] `elevenlabs`: model `eleven_flash_v2_5`, output `mp3_44100_64`, default voice settings, 45 s timeout; key from `ELEVENLABS_API_KEY`, server-only
- [ ] Typed `TtsError` codes: `BUSY` (429 / concurrency), `QUOTA` (our quota used up; logged with request ID), `FAILED` (5xx, timeout, anything else)
- [ ] `fixture` returns a short silent mp3 from `fixtures/audio/silence.mp3`; `browser` returns `{ kind: 'browser' }` without a network call
- [ ] Unit tests with MSW for success, 429, quota, 500, timeout

**Plan behavior:** none here; callers consume usage first (V7).
**Blocked by:** Step 2 I4, I5; H2.
**Files likely touched:** `src/server/tts.ts`, `src/server/tts.test.ts`, `fixtures/audio/silence.mp3`, `src/test/msw/elevenlabs.ts`
**Out of scope:** caching (V4/V7), usage (V7).

---

## V4 · `feat: audio store`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] `audioKey({ model, voiceId, text })` = sha256 hex of `model | voiceId | normalizeText(text)` (or `textHash` helper from C2 once merged)
- [ ] `AudioStore` interface `{ get(key), put(key, bytes), has(key) }`; Netlify Blobs implementation uses store `audio` with `consistency: 'strong'`
- [ ] In-memory fake selected automatically in tests (per environments.md)
- [ ] Unit tests: key stability across normalization-equivalent text, different voice → different key, fake round-trip
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none. The cache is shared across all users and plans.
**Blocked by:** Step 2 I5; Step 6 C2 (can inline normalization and swap later).
**Files likely touched:** `src/server/audio-store.ts`, `src/server/audio-store.test.ts`
**Out of scope:** cleanup of old blobs (stretch).

---

## V5 · `feat: audio fetch route`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] `GET /api/audio/:key` requires a signed-in user (else 401); key must be 64 hex chars (else 404)
- [ ] Hit → `200 audio/mpeg` with `Cache-Control: private, max-age=31536000, immutable`; miss → 404
- [ ] Any signed-in user can fetch any key (shared cache, by design)
- [ ] Integration tests: signed out, bad key, miss, hit (fake store)
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** same on every plan; never consumes usage.
**Blocked by:** V4; Step 3 S3.
**Files likely touched:** `src/routes/api/audio/$key.ts`, test
**Out of scope:** static `/public/demo/` and `/public/voices/` files (served by Netlify directly).

---

## V6 · `feat: read request validation`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] `resolveReadRequest(user, { postId, personaId, selection? })` loads the post from the DB (visible per T7, else `POST_NOT_FOUND` / `POST_LOCKED`) and returns `{ text, voiceId, persona }`
- [ ] Persona rules: standard → ok; own custom + effective plan Creator → ok; own custom on Free → `PERSONA_LOCKED`; deleted / other user's → `PERSONA_NOT_FOUND`
- [ ] Selection `{ start, end, text }` must equal the stored slice (`SELECTION_STALE`) and not be blank; no selection + blank post → `EMPTY`
- [ ] Cap: `countFor(channel_service, text, { maxCharacters })` (sample post = LinkedIn) over the limit → `OVER_CHANNEL_LIMIT` with `{ limit, service }`
- [ ] Integration tests for every branch, using presets `free`, `creator`, `free-downgraded`

**Plan behavior:** Free: standard personas only. Creator (incl. `past_due`, canceling): standard + own custom.
**Blocked by:** V1; Step 1 T7; Step 4 B2; Step 6 C2; Step 5 P14.
**Files likely touched:** `src/server/playback/resolve-read.ts`, test, `src/lib/errors.ts`
**Out of scope:** sample post static audio (V7), usage (V7).

---

## V7 · `feat: generate or reuse audio`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] Server fn `readAloud({ postId, personaId, selection? })`: `requireUser()` → V6 → sample post returns its static `/demo/<persona>.mp3` (selection or custom persona on sample → `SAMPLE_UNSUPPORTED`) unless `DEMO_FALLBACK`
- [ ] Cache hit (`audioStore.has`) → `{ mode: 'audio', audioUrl }`, **no** `checkAndConsume`
- [ ] Miss → `checkAndConsume(tts_chars, amount = text.length)` before `synthesize`; `ok: false` returned as the typed usage error (P12 renders it)
- [ ] Any `TtsError` → `refund(eventId)` and returns its code; success → `put` then `{ mode: 'audio', audioUrl: '/api/audio/<key>' }`; `browser` provider → `{ mode: 'browser', text, voiceId }`, no put
- [ ] Integration tests: hit consumes nothing; miss consumes `text.length`; failure refunds; selection consumes only its length; sample post never consumes

**Plan behavior:** limits come from T6 (Free 5 posts + 12,000 chars; Creator 80,000 chars).
**Blocked by:** V3, V4, V6; Step 1 T6 (tests assert real consumption + refund).
**Files likely touched:** `src/server/playback/read-aloud.ts`, test
**Out of scope:** UI (V10).

---

## V8 · `feat: audio player`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] `useAudioPlayer()` with one shared controller: starting a new clip stops the current one; plays both `audio` URLs and `browser` mode (`speechSynthesis`)
- [ ] `AudioPlayer` component: Play/Pause, Stop, progress bar (no scrubbing, no speed); exposes `isPlaying` + `personaId` for the indicator
- [ ] Unmount / route change stops playback (incl. `speechSynthesis.cancel()`)
- [ ] Component tests for one-at-a-time and stop on unmount
- [ ] Works on desktop 1280px+

**Plan behavior:** none.
**Blocked by:** V5; Step 2 I5.
**Files likely touched:** `src/hooks/useAudioPlayer.ts`, `src/components/AudioPlayer/*`, tests
**Out of scope:** speaking indicator (V11), visual design.

---

## V9 · `feat: persona picker`
**Labels:** `MVP`, `personas`
**Acceptance criteria**
- [ ] Composer right slot lists standard + the user's non-deleted custom personas as voice avatar cards; Free shows custom ones locked ("Upgrade to use"), never-paid Free shows one locked "Create your own reader" card
- [ ] Selected persona stored per post in `localStorage` (`vocelo:persona:{userId}:{postId}`, try/catch); default The Skeptic; missing/locked/deleted → default
- [ ] Sample post: custom personas disabled ("Try custom personas on your own post")
- [ ] E2E: `free` sees 3 standard + locked card; `creator` with a custom persona can select it; reload keeps the choice. Works on desktop 1280px+

**Plan behavior:** as above.
**Blocked by:** V2, V13 (list fn); Step 6 C1.
**Files likely touched:** `src/components/PersonaPicker/*`, `src/server/personas/list.ts`, `src/content/copy.ts`, `e2e/personas.spec.ts`
**Out of scope:** reactions (Step 8), the upgrade button target (V12 reuses P4).

---

## V10 · `feat: read aloud and hear selection`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] Button reads "Read aloud" or "Hear selection (N chars)" (C8); click → `await flush()` → `readAloud` → plays via V8; "Generating…" and disabled while pending
- [ ] Disabled states: blank post; over the channel limit with no selection ("Over X's 280 limit. Trim it or highlight a section to hear it."); selection on the sample post ("Try this on your own post")
- [ ] Errors: usage → P12 `LimitReached`; `BUSY` "Voices are busy. Try again in a few seconds."; `QUOTA` "Voice is unavailable right now."; `FAILED` "Couldn't generate audio. Try again."
- [ ] Text edited during playback → keeps playing, shows "Text changed since this read."
- [ ] E2E (fixture TTS): read aloud plays; selection read; over-limit message; `free-low-chars` sees "800 characters needed, 500 left". Works on desktop 1280px+

**Plan behavior:** same buttons on every plan; limits enforced server-side (V7).
**Blocked by:** V7, V8, V9; Step 6 C4, C8.
**Files likely touched:** `src/components/ReadAloud/*`, `src/routes/app/posts/$id.tsx`, `src/content/copy.ts`, `e2e/playback.spec.ts`
**Out of scope:** usage meter refresh beyond calling P15's refresh hook if merged.

---

## V11 · `feat: speaking indicator`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] The playing persona's voice avatar card gets a `data-speaking` attribute + placeholder pulse (token colors only) while V8 reports `isPlaying`
- [ ] Respects `prefers-reduced-motion` (no animation, static outline)
- [ ] Component test: attribute toggles with play/stop
- [ ] Works on desktop 1280px+

**Plan behavior:** none. **First playback item to cut.**
**Blocked by:** V10.
**Files likely touched:** `src/components/PersonaPicker/*`
**Out of scope:** character animation (stretch), final polish (Design Pass).

---

## V12 · `feat: personas page`
**Labels:** `MVP`, `personas`, `pages`
**Acceptance criteria**
- [ ] `/app/personas` lists standard personas (read-only) and the user's custom ones with "N of 5 custom personas"
- [ ] Creator: "Create persona" (disabled at 5: "Delete one to add another"); each custom card has Edit
- [ ] Free: custom cards locked ("Upgrade to use") + upgrade button → P4; never-paid: one "Create your own reader" card → P4
- [ ] Empty state for Creator with no custom personas
- [ ] E2E: `free`, `free-downgraded`, `creator`. Works on desktop 1280px+

**Plan behavior:** as above.
**Blocked by:** V13; Step 5 P4, P14; Step 3 S10.
**Files likely touched:** `src/routes/app/personas/index.tsx`, `src/components/PersonaCard/*`, `src/content/copy.ts`, `e2e/personas.spec.ts`
**Out of scope:** builder form (V14), delete (V15).

---

## V13 · `feat: custom persona server functions`
**Labels:** `MVP`, `personas`
**Acceptance criteria**
- [ ] `createPersona` / `updatePersona` validate: name 1–40, bio ≤ 160, reader description 1–500, `isCustomVoice`, `isAvatarKey` (`VALIDATION` with field errors)
- [ ] Effective plan must be Creator (`PLAN_REQUIRED`); create locks the user row and rejects a 6th non-deleted persona (`PERSONA_LIMIT`)
- [ ] `reaction_prompt` built by `buildReactionPrompt(persona)` (placeholder template; Step 8 owns the final wording); update bumps `updated_at`
- [ ] `listPersonas(user)` returns standard + own non-deleted custom with a `locked` flag
- [ ] Integration tests: limit race (two concurrent creates at 4 → one succeeds), Free rejected, validation, other user's persona → `PERSONA_NOT_FOUND`

**Plan behavior:** Creator: 5 custom. Free: none (existing ones locked). Never consumes usage.
**Blocked by:** V1, V2; Step 1 T4; Step 3 S3.
**Files likely touched:** `src/server/personas/*.ts`, tests
**Out of scope:** reaction prompt wording + injection guard (Step 8).

---

## V14 · `feat: custom persona builder form`
**Labels:** `MVP`, `personas`
**Acceptance criteria**
- [ ] `/app/personas/new` and `/app/personas/$id/edit`: name, bio, "Who is this reader?", voice list, icon grid; field limits shown live; server errors per field
- [ ] Each voice has a Preview button playing its static `/voices/<id>.mp3` via V8 (no credits)
- [ ] Free or at limit → redirect to `/app/personas` with the reason
- [ ] E2E: `creator` creates, edits, sees it in the composer picker. Works on desktop 1280px+

**Plan behavior:** Creator only.
**Blocked by:** V12, V13, V8; V16 (preview files; can merge with missing-file fallback "Preview unavailable").
**Files likely touched:** `src/routes/app/personas/new.tsx`, `src/routes/app/personas/$id.edit.tsx`, `src/components/PersonaForm/*`, `e2e/personas.spec.ts`
**Out of scope:** AI-generated personas (stretch).

---

## V15 · `feat: delete custom persona`
**Labels:** `MVP`, `personas`
**Acceptance criteria**
- [ ] `deletePersona` sets `deleted_at`; allowed on every plan (Free can delete locked ones); standard personas → `PERSONA_NOT_FOUND`
- [ ] Confirm dialog: "Old reactions keep its name. Cached audio isn't affected."
- [ ] Deleted persona disappears from list + picker; frees a slot toward 5
- [ ] Integration test + E2E from the personas page. Works on desktop 1280px+

**Plan behavior:** same on every plan.
**Blocked by:** V12.
**Files likely touched:** `src/server/personas/delete.ts`, `src/components/PersonaCard/*`, tests
**Out of scope:** hard delete.

---

## V16 · `chore: static audio generation script`
**Labels:** `MVP`, `playback`
**Acceptance criteria**
- [ ] `src/content/sample-post.ts` exports the sample post text (~800-char LinkedIn post with one humblebrag + one unclear sentence; placeholder copy)
- [ ] `npm run audio:static` writes `/public/voices/<voiceId>.mp3` (one preview line per `CUSTOM_VOICES`), `/public/demo/landing-<persona>.mp3` (short line per standard persona), `/public/demo/<persona>.mp3` (sample post per standard persona)
- [ ] Skips files that exist unless `--force`; prints characters it will spend and asks to confirm; refuses unless `ELEVENLABS_API_KEY` is set
- [ ] Unit test with MSW: correct files, skip logic, no call when nothing to do
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Blocked by:** V2, V3; Step 1 T3.
**Files likely touched:** `scripts/audio-static.ts`, `src/content/sample-post.ts`, `package.json`, test
**Out of scope:** running it with a real key (H10); seeding the sample post row (Step 10).

---

## Noted for later steps (not drafted here)
- **Step 8 (reactions):** reactions older than the persona's `updated_at` show "Persona changed: refresh". The custom "Who is this reader?" text goes into the prompt as quoted data, never instructions (prompt-injection guard). `buildReactionPrompt` placeholder from V13 gets its final wording. Free 1-persona-per-post is reactions only; playback never locks a persona.
- **Step 10 (pages):** sample post row uses `src/content/sample-post.ts` (V16); landing persona showcase plays `/demo/landing-<persona>.mp3`.
- **Design Pass:** voice avatar artwork replaces V2's placeholder icons; speaking indicator polish.
- **Stretch:** streaming playback, speed control, scrubbing, side-by-side compare, custom avatar uploads, blob cleanup.
