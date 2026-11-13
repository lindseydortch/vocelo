import { expect, test } from '@playwright/test'

test.describe('checkout canceled', () => {
  test('renders and links back to /pricing', async ({ page }) => {
    // `db=off` sets only the session cookie (CI's e2e has no database).
    const login = await page.request.get('/__test/login?user=free&db=off', {
      maxRedirects: 0,
    })
    expect(login.status()).toBe(302)

    await page.goto('/app/billing/canceled')
    await expect(
      page.getByRole('heading', { level: 1, name: 'No changes made' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Back to pricing' }).click()
    await expect(page).toHaveURL(/\/pricing$/)
  })

  test('signed out is sent to sign in', async ({ page }) => {
    await page.goto('/app/billing/canceled')
    await expect(page).toHaveURL(/\/signin/)
  })
})
