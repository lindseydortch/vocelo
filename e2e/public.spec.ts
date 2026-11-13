import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

const routes = [
  { path: '/', title: 'Home · Vocelo', h1: 'Vocelo' },
  { path: '/pricing', title: 'Pricing · Vocelo', h1: 'Pricing' },
  { path: '/privacy', title: 'Privacy · Vocelo', h1: 'Privacy Policy' },
  { path: '/terms', title: 'Terms · Vocelo', h1: 'Terms of Service' },
]

for (const { path, title, h1 } of routes) {
  test(`${path} returns 200 with title, h1 and footer`, async ({ page }) => {
    const res = await page.goto(path)
    expect(res?.status()).toBe(200)
    await expect(page).toHaveTitle(title)
    await expect(
      page.getByRole('heading', { level: 1, name: h1 }),
    ).toBeVisible()
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    )
    await expect(footer.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      '/terms',
    )
    await expect(
      footer.getByRole('link', { name: 'Contact support' }),
    ).toHaveAttribute('href', /^mailto:support@/)
  })
}

test('unknown route is not served as a public page', async ({ page }) => {
  const res = await page.goto('/does-not-exist')
  expect(res?.status()).toBe(404)
})
