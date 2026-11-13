import { expect, test } from '@playwright/test'
import { signInAs } from './helpers/auth'

test.describe('checkout canceled', () => {
  test('renders and links back to /pricing', async ({ page }) => {
    await signInAs(page, 'free', { dbOff: true })

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
