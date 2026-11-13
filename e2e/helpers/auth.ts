import type { Page } from '@playwright/test'

/** Signs the page in as the seeded Free or Creator user via `/__test/login`. */
// Keep the user names in sync with TEST_USERS in src/server/auth/test-login.ts.
export async function signInAs(
  page: Page,
  user: 'free' | 'creator',
  { dbOff = false }: { dbOff?: boolean } = {},
): Promise<void> {
  // dbOff sets only the session cookie (no DB rows): enough for cookie-based guards, and works in CI, which has no database.
  const response = await page.goto(
    `/__test/login?user=${user}${dbOff ? '&db=off' : ''}`,
  )
  if (response?.status() === 404) {
    throw new Error(
      'signInAs: /__test/login is off. Start the server with E2E_AUTH=1.',
    )
  }
}
