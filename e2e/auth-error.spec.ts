import { expect, test } from '@playwright/test'
import { authCopy } from '../src/content/copy'

test.use({ viewport: { width: 1280, height: 800 } })

const { reasons } = authCopy.error

for (const [reason, message] of Object.entries(reasons)) {
  test(`reason=${reason} renders its message`, async ({ page }) => {
    await page.goto(`/auth/error?reason=${reason}`)
    await expect(page.getByRole('alert')).toHaveText(message)
    await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/auth/buffer/start',
    )
  })
}

for (const url of ['/auth/error', '/auth/error?reason=bogus']) {
  test(`${url} falls back to the exchange message`, async ({ page }) => {
    await page.goto(url)
    await expect(page.getByRole('alert')).toHaveText(reasons.exchange)
  })
}
