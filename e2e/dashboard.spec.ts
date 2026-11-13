import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'

test.use({ viewport: { width: 1280, height: 800 } })

test('shows seeded posts and follows a row to its composer URL', async ({
  page,
}) => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL must point to the E2E test database')
  if (
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(url).hostname)
  ) {
    throw new Error('Dashboard E2E requires a local test database')
  }
  const sql = postgres(url, { max: 1 })
  const id = randomUUID()
  const text = `Dashboard test ${id}`
  try {
    const login = await page.request.get('/__test/login?user=free', {
      maxRedirects: 0,
    })
    expect(login.status()).toBe(302)
    const [user] =
      await sql`select id, buffer_organization_id from users where buffer_account_id = 'e2e_free'`
    if (!user) throw new Error('E2E user was not created')
    await sql`insert into posts (id, user_id, buffer_organization_id, channel_id, channel_name, channel_service, text) values (${id}, ${user.id}, ${user.buffer_organization_id}, ${`channel_${id}`}, 'Dashboard channel', 'linkedin', ${text})`
    await page.goto('/app')
    const row = page.getByRole('link', { name: new RegExp(text) })
    await expect(row).toContainText('Dashboard channel')
    await expect(row).toHaveAttribute('href', `/app/posts/${id}`)
    await row.click()
    await expect(page).toHaveURL(new RegExp(`/app/posts/${id}$`))
    await expect(page.locator('[data-slot="composer-left"]')).toBeVisible()
  } finally {
    await sql`delete from posts where id = ${id}`
    await sql.end()
  }
})
