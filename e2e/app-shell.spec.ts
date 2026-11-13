import { expect, test } from '@playwright/test'
import { signInAs } from './helpers/auth'

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'free')
  })

  const pages = [
    { link: 'Personas', path: '/app/personas', h1: 'Personas' },
    { link: 'Settings', path: '/app/settings', h1: 'Settings' },
    { link: 'Posts', path: '/app', h1: 'Posts' },
  ]

  test('nav links reach each page and mark the current section', async ({
    page,
  }) => {
    await page.goto('/app')
    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const { link, path, h1 } of pages) {
      await nav.getByRole('link', { name: link }).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(
        page.getByRole('heading', { level: 1, name: h1 }),
      ).toBeVisible()
      await expect(nav.getByRole('link', { name: link })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(nav.locator('[aria-current]')).toHaveCount(1)
    }
  })

  test('brand links to /app and header has both slots', async ({ page }) => {
    await page.goto('/app/settings')
    const header = page.getByRole('banner')
    await expect(header.getByRole('link', { name: 'Vocelo' })).toHaveAttribute(
      'href',
      '/app',
    )
    await expect(header.locator('[data-slot="header-end"]')).toBeAttached()
    await expect(page.locator('[data-slot="banner"]')).toBeAttached()
  })

  for (const path of ['/app', '/app/personas', '/app/settings']) {
    test(`${path} is noindex with a branded title`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex',
      )
      await expect(page).toHaveTitle(/ · Vocelo$/)
    })
  }
})

for (const path of ['/app', '/app/personas', '/app/settings']) {
  test(`no horizontal scroll at 375px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await signInAs(page, 'free')
    await page.goto(path)
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })
}
