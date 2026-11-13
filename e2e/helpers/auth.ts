import type { Page } from '@playwright/test'

/** Signs the page in as the seeded Free or Creator user via `/__test/login`. */
// Keep the user names in sync with TEST_USERS in src/server/auth/test-login.ts.
export async function signInAs(
  page: Page,
  user: 'free' | 'creator',
): Promise<void> {
  const response = await page.goto(`/__test/login?user=${user}`)
  if (response?.status() === 404) {
    throw new Error(
      'signInAs: /__test/login is off. Start the server with E2E_AUTH=1.',
    )
  }
}
