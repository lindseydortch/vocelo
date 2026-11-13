import { expect, test } from '@playwright/test'
import { signInAs } from './helpers/auth'

test.use({ viewport: { width: 1280, height: 800 } })

test('signed-out visit to /app lands on /signin with returnTo', async ({
  page,
}) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/signin\?returnTo=%2Fapp$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in' }),
  ).toBeVisible()
})

test('signed-in user reaches /app and is bounced off /signin', async ({
  page,
}) => {
  await signInAs(page, 'free', { dbOff: true })
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vocelo' }),
  ).toBeVisible()
  await page.goto('/signin')
  await expect(page).toHaveURL(/\/app$/)
})

test('sign out lands on / and /app then redirects to /signin', async ({
  page,
}) => {
  await signInAs(page, 'free', { dbOff: true })
  await page.goto('/app/settings')
  // The button only works after hydration.
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/signin\?returnTo=%2Fapp$/)
})
