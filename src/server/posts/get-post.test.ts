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
const { getPostForUser } = await import('./get-post')
afterAll(async () => {
  await resetFactoryData()
  await sql.end()
})
afterEach(resetClock)

const NOW = new Date('2026-11-13T12:00:00Z')

describe('getPostForUser', () => {
  it('returns an own, in-window post as editable', async () => {
    setClock(() => NOW)
    const user = await createTestUser()
    const post = await createTestPost({ user, lastEditedAt: NOW })
    const result = await getPostForUser(user, post.id)
    expect(result).toMatchObject({ status: 'ok', readOnly: false })
    expect(result.status === 'ok' && result.post.id).toBe(post.id)
  })

  it('returns not_found for another user’s post', async () => {
    setClock(() => NOW)
    const user = await createTestUser()
    const other = await createTestUser()
    const post = await createTestPost({ user: other, lastEditedAt: NOW })
    expect(await getPostForUser(user, post.id)).toEqual({ status: 'not_found' })
  })

  it('returns not_found for a missing or malformed id', async () => {
    const user = await createTestUser()
    expect(
      await getPostForUser(user, '00000000-0000-4000-8000-000000000000'),
    ).toEqual({ status: 'not_found' })
    expect(await getPostForUser(user, 'not-a-uuid')).toEqual({
      status: 'not_found',
    })
  })

  it('returns locked for an own post outside the history window', async () => {
    setClock(() => NOW)
    const user = await createTestUser()
    const post = await createTestPost({
      user,
      lastEditedAt: new Date('2026-09-01T12:00:00Z'),
    })
    expect(await getPostForUser(user, post.id)).toEqual({ status: 'locked' })
  })

  it('opens the same post on Creator, whose window is 12 months', async () => {
    setClock(() => NOW)
    const user = await createTestUser({ plan: 'creator' })
    const post = await createTestPost({
      user,
      lastEditedAt: new Date('2026-09-01T12:00:00Z'),
    })
    expect(await getPostForUser(user, post.id)).toMatchObject({ status: 'ok' })
  })

  it('marks the sample post read-only and never locks it', async () => {
    setClock(() => NOW)
    const user = await createTestUser()
    const post = await createTestPost({
      user,
      isSample: true,
      lastEditedAt: new Date('2020-01-01T00:00:00Z'),
    })
    expect(await getPostForUser(user, post.id)).toMatchObject({
      status: 'ok',
      readOnly: true,
    })
  })
})
