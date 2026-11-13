import { expect, test, type Page } from '@playwright/test'

// Not `signInAs`: it follows the redirect to `/app`, which has no route yet, and reads that 404 as "login is off".
// `db=off` sets only the session cookie, which is all the link check reads (CI's e2e has no database).
async function signIn(page: Page) {
  const res = await page.request.get('/__test/login?user=free&db=off', {
    maxRedirects: 0,
  })
  expect(res.status()).toBe(302)
}

test.describe('signed out', () => {
  test('unknown URL shows the 404 page linking to /', async ({ page }) => {
    const res = await page.goto('/does-not-exist')
    expect(res?.status()).toBe(404)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Back to home' }),
    ).toHaveAttribute('href', '/')
  })

  test('a route that throws shows the error page with a reference', async ({
    page,
  }) => {
    const logged: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') logged.push(m.text())
    })
    await page.goto('/__test/error')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeVisible()
    const reference = page.getByText(/^Reference:/)
    await expect(reference).toHaveText(/Reference:\s+[0-9a-f]{12}$/)
    await expect(
      page.getByRole('link', { name: 'Back to home' }),
    ).toHaveAttribute('href', '/')
    const id = (await reference.innerText()).split(/\s+/).pop()!
    await expect
      .poll(() => logged.some((l) => l.includes('[error]')))
      .toBe(true)
    expect(id).toMatch(/^[0-9a-f]{12}$/)
    expect(logged.some((l) => l.includes(id))).toBe(true)
  })
})

test.describe('signed in', () => {
  test('unknown URL links to /app', async ({ page }) => {
    await signIn(page)
    await page.goto('/does-not-exist')
    await expect(
      page.getByRole('link', { name: 'Back to your app' }),
    ).toHaveAttribute('href', '/app')
  })

  test('error page links to /app', async ({ page }) => {
    await signIn(page)
    await page.goto('/__test/error')
    await expect(
      page.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Back to your app' }),
    ).toHaveAttribute('href', '/app')
  })
})
