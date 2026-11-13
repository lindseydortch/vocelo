import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

test('home page loads over HTTPS', async ({ page }) => {
  await page.goto('/')
  expect(page.url()).toMatch(/^https:\/\//)
  await expect(page.getByRole('heading', { name: 'Vocelo' })).toBeVisible()
})
