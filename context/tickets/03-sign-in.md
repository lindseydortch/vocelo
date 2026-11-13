# Step 3 Tickets: Buffer sign-in

Drafts for GitHub Issues. Decisions live in `project-bible.md` → "Step 3 Decisions". Real OAuth only completes on port **3000**; every ticket is tested with MSW mocks of `auth.buffer.com` and the Buffer GraphQL API, never the real service.

**Merge order:**
```
After Step 1 T2 + Step 2 I4/I5/I6:
  S1 schema additions · S2 token encryption · S3 session cookie · S4 Buffer client   (parallel, max 3 worktrees)
    → S5 start route · S7 complete sign-in (needs S1–S4) · S8 token refresh (needs S2, S4)
    → S6 callback (needs S5, S7) · S9 auth retry (needs S8)
    → Step 2 I14 E2E helper (needs S3) → S10 protected routes
    → S11 sign-in page · S12 auth error page · S13 sign out · S14 disconnect · S15 dev sign-in
```
Each ticket adds its own MSW handlers (success + error variants) to `src/test/handlers/buffer.ts`.

---

## S1 · `chore: sign-in schema additions`
**Labels:** `MVP`, `auth`, `database`
**Acceptance criteria**
- [ ] Additive Drizzle migration: `users.timezone` (text, nullable) and `posts.buffer_organization_id` (text)
- [ ] No drops or renames; migration applies cleanly on top of T2 in the embedded Postgres harness
- [ ] Drizzle schema types updated; `npm run typecheck` passes
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** Step 1 T2, Step 2 I6.
**Files likely touched:** `src/server/db/schema.ts`, `drizzle/00XX_*.sql`
**Out of scope:** using either column (S7, Step 4, Step 9).

---

## S2 · `feat: token encryption helper`
**Labels:** `MVP`, `auth`, `security`
**Acceptance criteria**
- [ ] `encryptToken(plain)` / `decryptToken(stored)` use AES-256-GCM with `TOKEN_ENCRYPTION_KEY` (32 bytes, base64) and a random IV per call
- [ ] Stored format is `v1:<iv>:<tag>:<ciphertext>`; the same input encrypts differently twice
- [ ] Tampered value, wrong key, or unknown prefix → throws a typed `TokenDecryptError` (callers treat it as a dead token)
- [ ] Unit tests: round trip, tamper, wrong key, bad prefix; `env.ts` rejects a key that isn't 32 bytes
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** Step 2 I4, I5.
**Files likely touched:** `src/server/auth/crypto.ts`, `src/server/auth/crypto.test.ts`, `src/server/env.ts`
**Out of scope:** key rotation.

---

## S3 · `feat: session cookie module`
**Labels:** `MVP`, `auth`
**Acceptance criteria**
- [ ] Wraps TanStack Start `useSession` with `SESSION_SECRET`: HttpOnly, Secure, SameSite=Lax, 30-day max age renewed on each request; holds only `userId`
- [ ] `setSessionUser(userId)`, `clearSession()`, `getSessionUser()` (loads `users` + `buffer_connections`; returns null if either is missing)
- [ ] `requireUser()` for server functions throws a typed `UNAUTHENTICATED` error when there's no session user
- [ ] Integration tests: set → get, cleared session, deleted connection reads as signed out, tampered cookie reads as signed out
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none (plan is read elsewhere).
**Dependencies:** Step 1 T2, Step 2 I4, I6, I13.
**Files likely touched:** `src/server/auth/session.ts`, `src/server/auth/session.test.ts`
**Out of scope:** route guards (S10), sign-in itself (S7).

---

## S4 · `feat: Buffer GraphQL client`
**Labels:** `MVP`, `auth`, `buffer`
**Acceptance criteria**
- [ ] `bufferRequest({ accessToken, query, variables })` posts to the Buffer GraphQL endpoint and returns typed `data`
- [ ] HTTP 401 **or** `errors[].extensions.code === 'UNAUTHORIZED'` → typed `BufferAuthError`
- [ ] HTTP 429 / `RATE_LIMIT_EXCEEDED`, network errors, and 5xx → typed `BufferTemporaryError` (with `retryAfter` when present)
- [ ] Logs a warning with a request ID when the `RateLimit` header shows < 10 remaining
- [ ] Integration tests (MSW) for each case above; works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** Step 2 I4, I5.
**Files likely touched:** `src/server/buffer/client.ts`, `src/server/buffer/client.test.ts`, `src/test/handlers/buffer.ts`
**Out of scope:** token refresh and retry (S8, S9), any specific query beyond a test query.

---

## S5 · `feat: OAuth start route`
**Labels:** `MVP`, `auth`
**Acceptance criteria**
- [ ] `GET /auth/buffer/start?returnTo=…` generates `state` + PKCE verifier, sets a 10-min HttpOnly Secure SameSite=Lax state cookie holding state, verifier, and `returnTo`
- [ ] Redirects to `https://auth.buffer.com/auth` with `client_id`, `redirect_uri` (`APP_URL` + `/auth/callback`), `response_type=code`, scopes `account:read posts:read posts:write offline_access`, `state`, `code_challenge`, `code_challenge_method=S256`
- [ ] `returnTo` kept only if it's a relative path starting `/app` or `/pricing`; anything else (absolute URL, `//evil.com`, missing) → `/app`
- [ ] Unit tests: PKCE challenge matches verifier, `returnTo` allowlist cases; integration test: redirect URL + cookie
- [ ] Works on desktop 1280px+: n/a, redirect only

**Plan behavior:** none.
**Dependencies:** Step 2 I4, I5.
**Files likely touched:** `src/routes/auth/buffer/start.ts`, `src/server/auth/pkce.ts`, `src/server/auth/return-to.ts`, tests
**Out of scope:** the callback (S6).

---

## S6 · `feat: OAuth callback route`
**Labels:** `MVP`, `auth`
**Acceptance criteria**
- [ ] `GET /auth/callback` is a server route with no UI; it always clears the state cookie
- [ ] `error=access_denied` → `/auth/error?reason=cancelled`; missing/expired/mismatched state → `reason=timeout`
- [ ] Exchanges `code` + verifier at `https://auth.buffer.com/token` with `client_id` + `client_secret`; failure → `reason=exchange`
- [ ] Returned `scope` missing `posts:write` or `offline_access` → `reason=scopes`; otherwise calls `completeSignIn` (S7) and redirects to `returnTo`
- [ ] Integration tests (MSW) for each branch, and no DB rows on any failure; works on desktop 1280px+: n/a, redirect only

**Plan behavior:** none.
**Dependencies:** S5, S7.
**Files likely touched:** `src/routes/auth/callback.ts`, `src/server/auth/exchange.ts`, tests, `src/test/handlers/buffer.ts`
**Out of scope:** the error page UI (S12).

---

## S7 · `feat: complete sign-in`
**Labels:** `MVP`, `auth`, `database`
**Acceptance criteria**
- [ ] `completeSignIn(tokens)` runs one `account { id email name timezone organizations { id name ownerEmail } }` query; failure → typed error the callback maps to `reason=account`, nothing written
- [ ] Picks the org the user owns (`ownerEmail === email`), else the first
- [ ] One transaction upserts `users` on `buffer_account_id` (email, org, timezone refreshed) and `buffer_connections` (tokens encrypted via S2, `access_expires_at`, `scopes`); calls the `ensureSamplePost(userId)` stub; sets the session (S3)
- [ ] Integration tests: new user, returning user keeps plan + Stripe fields, two concurrent calls → one user row, owned-org vs. first-org pick
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** returning users keep their plan; new users are Free.
**Dependencies:** S1, S2, S3, S4.
**Files likely touched:** `src/server/auth/complete-sign-in.ts`, `src/server/posts/sample-post.ts` (stub), tests
**Out of scope:** the sample post's content (Step 10), org switching (stretch).

---

## S8 · `feat: token refresh with row lock`
**Labels:** `MVP`, `auth`, `database`
**Acceptance criteria**
- [ ] `getBufferAccessToken(userId, { force? })` locks the `buffer_connections` row (`SELECT … FOR UPDATE`), re-checks expiry after the lock, refreshes when < 5 min left (or `force`), 10 s timeout, stores the rotated tokens encrypted
- [ ] Dead token (`invalid_grant`, any 4xx from the token endpoint, `TokenDecryptError`, no refresh token) → delete the connection row, throw `BUFFER_AUTH_EXPIRED`
- [ ] Temporary failure (network, 5xx, timeout) → keep the row, throw `BufferTemporaryError`
- [ ] Integration test: two concurrent calls with an expiring token → exactly **one** refresh request to Buffer, both get the new token
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** S2, S4, Step 2 I6.
**Files likely touched:** `src/server/auth/buffer-token.ts`, `src/server/auth/buffer-token.test.ts`, `src/test/handlers/buffer.ts`
**Out of scope:** retry around GraphQL calls (S9), clearing the session (callers).

---

## S9 · `feat: retry Buffer calls after auth error`
**Labels:** `MVP`, `auth`, `buffer`
**Acceptance criteria**
- [ ] `withBuffer(userId, fn)` gets a token (S8), runs `fn`, and on `BufferAuthError` forces one refresh and retries **once**
- [ ] A second auth error → delete the connection, clear the session, throw `BUFFER_AUTH_EXPIRED` (serializable to the client as a typed error, not a redirect)
- [ ] Temporary errors pass through unchanged
- [ ] Integration tests: 401 then success, 401 twice, `UNAUTHORIZED` in a 200 body, 429 passes through
- [ ] Works on desktop 1280px+: n/a, no UI

**Plan behavior:** none.
**Dependencies:** S8.
**Files likely touched:** `src/server/buffer/with-buffer.ts`, `src/server/buffer/with-buffer.test.ts`, `src/lib/errors.ts`
**Out of scope:** the composer's reconnect dialog (Step 6).

---

## S10 · `feat: protected app routes`
**Labels:** `MVP`, `auth`
**Acceptance criteria**
- [ ] `/app` layout route `beforeLoad` redirects to `/signin?returnTo=<current path>` when there's no session user
- [ ] A page load that hits `BUFFER_AUTH_EXPIRED` redirects to `/signin?reason=expired`
- [ ] `/signin` with a session redirects to `/app`
- [ ] E2E: signed-out visit to `/app` lands on `/signin`; `signInAs('free')` reaches `/app`
- [ ] Works on desktop 1280px+: placeholder `/app` renders

**Plan behavior:** same for every plan.
**Dependencies:** S3, Step 2 I14.
**Files likely touched:** `src/routes/app/route.tsx`, `src/routes/signin.tsx`, `e2e/auth.spec.ts`
**Out of scope:** dashboard content (Step 10).

---

## S11 · `feat: sign-in page`
**Labels:** `MVP`, `auth`, `pages`
**Acceptance criteria**
- [ ] `/signin` shows one "Sign in with Buffer" button linking to `/auth/buffer/start`, passing `returnTo` through
- [ ] One line on what Vocelo can access (read account, read + write posts), from `src/content/copy.ts`
- [ ] `?reason=expired` shows "Your Buffer connection expired. Sign in again."
- [ ] E2E: button href includes `returnTo`; expired banner renders
- [ ] Works on desktop 1280px+, placeholder styling only

**Plan behavior:** none.
**Dependencies:** S5, S10.
**Files likely touched:** `src/routes/signin.tsx`, `src/routes/signin.module.scss`, `src/content/copy.ts`, `e2e/auth.spec.ts`
**Out of scope:** landing page CTA (Step 10), visual design.

---

## S12 · `feat: auth error page`
**Labels:** `MVP`, `auth`, `pages`
**Acceptance criteria**
- [ ] `/auth/error?reason=` shows one message each for `cancelled`, `timeout`, `exchange`, `account`, `scopes`; unknown/missing reason → the `exchange` message
- [ ] "Try again" links to `/auth/buffer/start`
- [ ] Copy lives in `src/content/copy.ts`
- [ ] E2E: each reason renders its message
- [ ] Works on desktop 1280px+, placeholder styling only

**Plan behavior:** none.
**Dependencies:** S5.
**Files likely touched:** `src/routes/auth/error.tsx`, `src/routes/auth/error.module.scss`, `src/content/copy.ts`, `e2e/auth-error.spec.ts`
**Out of scope:** retry logic beyond the link.

---

## S13 · `feat: sign out`
**Labels:** `MVP`, `auth`
**Acceptance criteria**
- [ ] POST-only server function clears the session cookie; `buffer_connections` stays
- [ ] "Sign out" button on a placeholder `/app/settings`, redirects to `/`
- [ ] Integration test: tokens still in DB after sign out; E2E: sign out → `/app` redirects to `/signin`
- [ ] Works on desktop 1280px+

**Plan behavior:** same for every plan.
**Dependencies:** S3, S10.
**Files likely touched:** `src/server/auth/sign-out.ts`, `src/routes/app/settings/index.tsx`, tests, `e2e/auth.spec.ts`
**Out of scope:** full settings page (Step 10).

---

## S14 · `feat: disconnect Buffer`
**Labels:** `MVP`, `auth`
**Acceptance criteria**
- [ ] POST-only server function deletes the user's `buffer_connections` row and clears the session; posts, personas, plan, and Stripe fields untouched
- [ ] Confirm dialog on `/app/settings` says the Creator plan keeps billing (shown only on paid plans) and to remove Vocelo in Buffer → Settings → Connected apps
- [ ] Integration tests: connection deleted, posts + plan kept; signing in again restores access to the same user
- [ ] E2E: disconnect → confirm → lands on `/`
- [ ] Works on desktop 1280px+

**Plan behavior:** billing warning shows for Creator, not Free.
**Dependencies:** S3, S10, S13 (shares the settings placeholder).
**Files likely touched:** `src/server/auth/disconnect.ts`, `src/routes/app/settings/index.tsx`, `src/content/copy.ts`, tests
**Out of scope:** cancelling Stripe, account deletion (stretch).

---

## S15 · `feat: dev sign-in with personal API key`
**Labels:** `MVP`, `auth`, `dx`
**Acceptance criteria**
- [ ] `/__dev/login` 404s unless `BUFFER_API_KEY` is set **and** `NODE_ENV !== 'production'`
- [ ] When enabled: runs the S7 account lookup with the key, upserts the user, stores the key as the encrypted access token with no refresh token, sets the session, redirects to `/app`
- [ ] `scripts/check-build-env.ts` (I10) also fails the build when `BUFFER_API_KEY` is set
- [ ] Integration tests: 404 both ways, success path (MSW); unit test for the build guard
- [ ] Works on desktop 1280px+: n/a, redirect only

**Plan behavior:** signs in as whatever plan that Buffer account's Vocelo user has.
**Dependencies:** S7, Step 2 I10.
**Files likely touched:** `src/routes/__dev/login.ts`, `scripts/check-build-env.ts`, tests, `README.md`
**Out of scope:** E2E helper (I14 covers tests).

---

## Noted for later steps (not drafted here)
- **Reconnect dialog + `localStorage` restore** on `BUFFER_AUTH_EXPIRED` → Step 6 (Composer)
- **Buffer email becomes the Stripe Customer email** (Checkout passes `customer`) → Step 5 (Billing)
- **Cache channel/draft lists** (rate limit is per client across all users); posts write `buffer_organization_id` → Step 4
- **Use `users.timezone` for `dueAt`** → Step 9
- **`ensureSamplePost` content; Settings shows connected org + Buffer status** → Step 10
- **Stretch:** org switcher, account deletion
