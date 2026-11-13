import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

test('sections render in order', async ({ page }) => {
  await page.goto('/')
  const headings = await page.getByRole('heading', { level: 2 }).allInnerTexts()
  expect(headings).toEqual([
    'The problem',
    'The solution',
    'How it works',
    'Hear it from different readers',
    'Supported channels',
    'Pricing',
    'FAQ',
  ])
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3)
  await expect(page.locator('[data-slot="persona-showcase"]')).toBeVisible()
  await expect(page.locator('[data-slot="pricing"]')).toBeVisible()
  for (const name of [
    'LinkedIn',
    'X',
    'Substack Notes',
    'Threads',
    'Bluesky',
    'Mastodon',
  ]) {
    await expect(
      page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}$`) }),
    ).toBeVisible()
  }
  await expect(
    page.getByText('Does this change my Buffer drafts?'),
  ).toBeVisible()
  await expect(
    page.getByText('What happens to my posts on Free?'),
  ).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()
})

test('signed out: CTA starts Buffer sign-in', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: 'Sign in with Buffer' }),
  ).toHaveAttribute('href', '/auth/buffer/start?returnTo=/app')
  await expect(page.getByRole('link', { name: 'Open Vocelo' })).toHaveCount(0)
})

test('signed in: CTA opens the app and / stays put', async ({ page }) => {
  // Not signInAs(): it follows the redirect to /app, which 404s until the app routes exist.
  const login = await page.request.get('/__test/login?user=free', {
    maxRedirects: 0,
  })
  expect(login.status()).toBe(302)
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Open Vocelo' })).toHaveAttribute(
    'href',
    '/app',
  )
  await expect(
    page.getByRole('link', { name: 'Sign in with Buffer' }),
  ).toHaveCount(0)
})
