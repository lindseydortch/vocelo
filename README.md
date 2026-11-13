# Vocelo

Write a post, save it as a Buffer draft, and hear it read aloud by different personas.

## Setup

```bash
npm install
npx playwright install chromium   # Chromium only, to save disk
```

## Local Buffer sign-in

Set `BUFFER_API_KEY` to your personal Buffer API key in `.env.local`, run
`npm run dev:ticket`, and open `https://localhost:$PORT/__dev/login` using the
port in `.ticket.env`. This signs in the key's Buffer account and redirects to
`/app`, preserving any existing Vocelo plan. The key is stored encrypted with
no refresh token or expiry. A failed account lookup does not sign you in.

The route returns 404 without a non-empty key or in production. Keep the key
local: Netlify builds reject `BUFFER_API_KEY` even when its value is empty.

## Scripts

- `npm run dev:ticket` runs the HTTPS dev server on the ticket's `$PORT`
- `npm run test` runs unit and integration tests (Vitest)
- `npm run test:e2e` runs Playwright E2E tests (starts its own dev server on `$PORT`)
- `npm run verify` runs typecheck, coverage, build, then E2E

## Netlify settings

Set these in the Netlify UI (they are not expressible in `netlify.toml`):

- Production branch: `main`
- Branch deploys: **off**
- Deploy previews: **off**
- `E2E_AUTH` and `BUFFER_API_KEY` must not exist in the site's environment variables (the build fails if it does)

The production build runs `drizzle-kit migrate` before `vite build`, so `DATABASE_URL` must be set for the production context.
