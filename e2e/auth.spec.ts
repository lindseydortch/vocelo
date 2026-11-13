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
  await signInAs(page, 'free')
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Posts' }),
  ).toBeVisible()
  await page.goto('/signin')
  await expect(page).toHaveURL(/\/app$/)
})

test('sign out lands on / and /app then redirects to /signin', async ({
  page,
}) => {
  await signInAs(page, 'free')
  await page.goto('/app/settings')
  // The button only works after hydration.
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/signin\?returnTo=%2Fapp$/)
})

test('sign-in explains Buffer access and preserves the destination', async ({
  page,
}) => {
  await page.goto(
    '/signin?returnTo=%2Fapp%2Fposts%2Fexample%3Fview%3Dreview%26source%3Dsignin',
  )
  const signIn = page.getByRole('link', {
    name: 'Sign in with Buffer',
    exact: true,
  })
  await expect(signIn).toHaveCount(1)
  await expect(signIn).toBeVisible()
  await expect(signIn).toHaveAttribute(
    'href',
    '/auth/buffer/start?returnTo=%2Fapp%2Fposts%2Fexample%3Fview%3Dreview%26source%3Dsignin',
  )
  await expect(
    page.getByText(
      'Vocelo can read your Buffer account and read and write your posts.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('expired Buffer connection prompts sign-in again', async ({ page }) => {
  await page.goto('/signin?reason=expired&returnTo=%2Fpricing')
  await expect(page.getByRole('alert')).toHaveText(
    'Your Buffer connection expired. Sign in again.',
  )
  await expect(
    page.getByRole('link', { name: 'Sign in with Buffer', exact: true }),
  ).toHaveAttribute('href', '/auth/buffer/start?returnTo=%2Fpricing')
})
