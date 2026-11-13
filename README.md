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
