import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { posts, versions } from '~/db/schema'
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
const { visiblePostsWhere, lockedPostCount, visibleVersions } =
  await import('./visibility')
afterAll(async () => {
  await resetFactoryData()
  await sql.end()
})
afterEach(resetClock)

describe('history window', () => {
  it('shows recent and sample posts for a free user, excluding old posts and other users', async () => {
    setClock(() => new Date('2026-11-13T12:00:00Z'))
    const user = await createTestUser()
    const other = await createTestUser()
    const recent = await createTestPost({
      user,
      lastEditedAt: new Date('2026-10-15T12:00:00Z'),
    })
    const sample = await createTestPost({
      user,
      isSample: true,
      lastEditedAt: new Date('2020-01-01Z'),
    })
    await createTestPost({
      user,
      lastEditedAt: new Date('2026-09-29T12:00:00Z'),
    })
    await createTestPost({ user: other })
    const visible = await db.select().from(posts).where(visiblePostsWhere(user))
    expect(visible.map((post) => post.id).sort()).toEqual(
      [recent.id, sample.id].sort(),
    )
    expect(visible.every((post) => post.userId === user.id)).toBe(true)
  })
  it('counts locked posts and reveals them on upgrade, while preserving the sample', async () => {
    setClock(() => new Date('2026-11-13T12:00:00Z'))
    const user = await createTestUser()
    await createTestPost({
      user,
      lastEditedAt: new Date('2026-09-29T12:00:00Z'),
    })
    await createTestPost({
      user,
      lastEditedAt: new Date('2025-10-13T12:00:00Z'),
    })
    await createTestPost({
      user,
      isSample: true,
      lastEditedAt: new Date('2020-01-01Z'),
    })
    expect(await lockedPostCount(user)).toBe(2)
    expect(
      await lockedPostCount({ ...user, subscriptionStatus: 'active' }),
    ).toBe(1)
  })

  it('returns only the newest three versions on Free and all on Creator for visible owned posts', async () => {
    const user = await createTestUser()
    const other = await createTestUser()
    const post = await createTestPost({ user })
    for (let day = 1; day <= 4; day++) {
      await db.insert(versions).values({
        postId: post.id,
        text: `v${day}`,
        textHash: `hash${day}`,
        createdAt: new Date(`2026-01-0${day}T00:00:00Z`),
      })
    }
    expect(
      (await visibleVersions(user, post.id)).map((version) => version.text),
    ).toEqual(['v4', 'v3', 'v2'])
    expect(
      (
        await visibleVersions(
          { ...user, subscriptionStatus: 'past_due' },
          post.id,
        )
      ).map((version) => version.text),
    ).toEqual(['v4', 'v3', 'v2', 'v1'])
    expect(await visibleVersions(other, post.id)).toEqual([])
  })

  it('includes the 30-day boundary and excludes older posts and their versions', async () => {
    setClock(() => new Date('2026-11-13T12:00:00Z'))
    const user = await createTestUser()
    const boundary = await createTestPost({
      user,
      lastEditedAt: new Date('2026-10-14T12:00:00Z'),
    })
    const old = await createTestPost({
      user,
      lastEditedAt: new Date('2026-10-14T11:59:59Z'),
    })
    await db
      .insert(versions)
      .values({ postId: old.id, text: 'locked', textHash: 'locked' })
    const visible = await db.select().from(posts).where(visiblePostsWhere(user))
    expect(visible.map((post) => post.id)).toEqual([boundary.id])
    expect(await visibleVersions(user, old.id)).toEqual([])
  })
  it('uses a clamped 12-month boundary for Creator on leap day', async () => {
    setClock(() => new Date('2024-02-29T12:00:00Z'))
    const user = await createTestUser({ plan: 'creator' })
    const boundary = await createTestPost({
      user,
      lastEditedAt: new Date('2023-02-28T12:00:00Z'),
    })
    const newer = await createTestPost({
      user,
      lastEditedAt: new Date('2023-02-28T12:00:01Z'),
    })
    await createTestPost({
      user,
      lastEditedAt: new Date('2023-02-28T11:59:59Z'),
    })
    const visible = await db.select().from(posts).where(visiblePostsWhere(user))
    expect(visible.map((post) => post.id).sort()).toEqual(
      [boundary.id, newer.id].sort(),
    )
  })
})
