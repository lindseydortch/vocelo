import { expect, test } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { insertPost } from './helpers/db'

test.use({ viewport: { width: 1280, height: 800 } })

test('own post opens with the three composer slots', async ({ page }) => {
  await signInAs(page, 'free')
  const id = await insertPost({ owner: 'free' })
  await page.goto(`/app/posts/${id}`)
  for (const slot of ['composer-top', 'composer-left', 'composer-right']) {
    await expect(page.locator(`[data-slot="${slot}"]`)).toBeVisible()
  }
  for (const slot of [
    'meter',
    'channel',
    'editor',
    'counter',
    'save',
    'hint',
  ]) {
    await expect(page.locator(`[data-slot="${slot}"]`)).toBeVisible()
  }
  // Empty until a banner has something to say, so it is attached but not visible.
  await expect(page.locator('[data-slot="banners"]')).toBeAttached()
  const [left, right] = await Promise.all([
    page.locator('[data-slot="composer-left"]').boundingBox(),
    page.locator('[data-slot="composer-right"]').boundingBox(),
  ])
  expect(right?.width).toBeCloseTo(360, 0)
  expect(right!.x).toBeGreaterThan(left!.x)
})

test("another user's post is a 404", async ({ page }) => {
  await signInAs(page, 'free')
  const id = await insertPost({ owner: 'other' })
  const response = await page.goto(`/app/posts/${id}`)
  expect(response?.status()).toBe(404)
})

test('a post outside the history window redirects with a locked notice', async ({
  page,
}) => {
  await signInAs(page, 'free')
  const id = await insertPost({
    owner: 'free',
    lastEditedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  })
  await page.goto(`/app/posts/${id}`)
  await expect(page).toHaveURL(/\/app\?locked=true$/)
  await expect(page.getByRole('status')).toHaveText(
    'This post is locked on your plan',
  )
})

test('composer opens with a notice when Buffer is down', async ({ page }) => {
  await signInAs(page, 'free')
  const id = await insertPost({
    owner: 'free',
    bufferPostId: 'bp_e2e_down',
    bufferStatus: 'scheduled',
  })
  const response = await page.goto(`/app/posts/${id}`)
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-slot="composer-left"]')).toBeVisible()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: "Couldn't check Buffer just now." }),
  ).toHaveCount(1)
})

test('a post with no Buffer post opens without a notice', async ({ page }) => {
  await signInAs(page, 'free')
  const id = await insertPost({ owner: 'free' })
  await page.goto(`/app/posts/${id}`)
  await expect(page.locator('[data-slot="composer-left"]')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test.describe('scheduled post', () => {
  test.use({ timezoneId: 'America/Chicago' })

  test('shows the banner and stays editable', async ({ page }) => {
    await signInAs(page, 'free')
    const id = await insertPost({
      owner: 'free',
      bufferPostId: 'bp_e2e_scheduled',
      bufferStatus: 'scheduled',
      dueAt: new Date('2027-06-02T20:00:00.000Z'),
    })
    await page.goto(`/app/posts/${id}`)
    const banner = page.locator('[data-slot="buffer-status-banner"]')
    await expect(banner).toContainText(
      "Scheduled for Wed 3:00 PM America/Chicago. Edits here won't change it.",
    )
    await expect(page.locator('[data-slot="editor"]')).toBeVisible()
  })
})

test('a draft post has no banner', async ({ page }) => {
  await signInAs(page, 'free')
  const id = await insertPost({
    owner: 'free',
    bufferPostId: 'bp_e2e_draft',
    bufferStatus: 'draft',
  })
  await page.goto(`/app/posts/${id}`)
  await expect(page.locator('[data-slot="buffer-status-banner"]')).toHaveCount(
    0,
  )
})
