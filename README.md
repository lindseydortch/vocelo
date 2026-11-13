# Vocelo

Write a post, save it as a Buffer draft, and hear it read aloud by different personas.

## Setup

```bash
npm install
npx playwright install chromium   # Chromium only, to save disk
```

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
- `E2E_AUTH` must not exist in the site's environment variables (the build fails if it does)

The production build runs `drizzle-kit migrate` before `vite build`, so `DATABASE_URL` must be set for the production context.
