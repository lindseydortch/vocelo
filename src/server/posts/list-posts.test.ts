import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { resetClock, setClock } from '~/lib/clock'
import { createTestSql } from '~/test/db'
import {
  createTestPost,
  createTestUser,
  resetFactoryData,
} from '~/test/factories'

const sql = createTestSql()
const db = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return db
  },
}))
const { listPosts } = await import('./list-posts')
afterEach(resetClock)
afterAll(async () => {
  await resetFactoryData()
  await sql.end()
})

describe('listPosts', () => {
  it('orders visible owned posts and always includes the sample', async () => {
    setClock(() => new Date('2026-11-13T12:00:00Z'))
    const user = await createTestUser()
    const other = await createTestUser()
    const recent = await createTestPost({
      user,
      lastEditedAt: new Date('2026-11-12T12:00:00Z'),
    })
    const older = await createTestPost({
      user,
      lastEditedAt: new Date('2026-10-15T12:00:00Z'),
    })
    const sample = await createTestPost({
      user,
      isSample: true,
      lastEditedAt: new Date('2020-01-01Z'),
    })
    const locked = await createTestPost({
      user,
      lastEditedAt: new Date('2026-09-01T12:00:00Z'),
    })
    await createTestPost({
      user: other,
      lastEditedAt: new Date('2026-11-13T12:00:00Z'),
    })
    expect((await listPosts(user)).map((post) => post.id)).toEqual([
      recent.id,
      older.id,
      sample.id,
    ])
    expect(
      (await listPosts({ ...user, subscriptionStatus: 'active' })).map(
        (post) => post.id,
      ),
    ).toEqual([recent.id, older.id, locked.id, sample.id])
  })
})
