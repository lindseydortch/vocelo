import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { http, HttpResponse } from 'msw'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { posts } from '~/db/schema'
import { createTestSql } from '~/test/db'
import { createTestPost, createTestUser } from '~/test/factories'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'
import { server } from '~/test/msw'

const sql = createTestSql()
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
const connection = vi.hoisted(() => ({ expired: false }))
vi.mock('~/server/buffer/with-buffer', async () => {
  const { BufferAuthExpiredError } = await import('~/server/auth/buffer-token')
  return {
    withBuffer: (_userId: string, fn: (token: string) => Promise<unknown>) => {
      if (connection.expired) throw new BufferAuthExpiredError()
      return fn('tok')
    },
  }
})
const { syncPostStatus } = await import('./sync-status')
const { BufferAuthExpiredError } = await import('~/server/auth/buffer-token')

afterAll(async () => {
  await sql.end()
})

const rawPost = (over: Record<string, unknown> = {}) => ({
  id: 'bp_1',
  status: 'sent',
  dueAt: '2026-11-14T09:00:00.000Z',
  text: 'hi',
  error: null,
  assets: [],
  channel: {
    id: 'c1',
    isDisconnected: false,
    isLocked: false,
    isQueuePaused: false,
  },
  ...over,
})

function mockBuffer(respond: () => Response) {
  const calls = { count: 0 }
  server.use(
    http.post(BUFFER_GRAPHQL_URL, () => {
      calls.count++
      return respond()
    }),
  )
  return calls
}

async function setup(
  over: Partial<typeof posts.$inferInsert> = {},
  isSample = false,
) {
  const user = await createTestUser()
  const post = await createTestPost({ user, ...(isSample && { isSample }) })
  if (Object.keys(over).length) {
    await testDb.update(posts).set(over).where(eq(posts.id, post.id))
  }
  return { user, post }
}

const stored = async (id: string) =>
  (await testDb.select().from(posts).where(eq(posts.id, id)))[0]!

describe('syncPostStatus', () => {
  it('stores the Buffer status and due date with one getPost call', async () => {
    const { user, post } = await setup({
      bufferPostId: 'bp_1',
      bufferStatus: 'scheduled',
    })
    const calls = mockBuffer(() =>
      HttpResponse.json({ data: { post: rawPost() } }),
    )
    const result = await syncPostStatus(user.id, post.id)
    expect(result).toEqual({
      status: 'synced',
      bufferStatus: 'sent',
      dueAt: new Date('2026-11-14T09:00:00.000Z'),
      errorMessage: null,
    })
    expect(calls.count).toBe(1)
    const row = await stored(post.id)
    expect(row.bufferStatus).toBe('sent')
    expect(row.dueAt).toEqual(new Date('2026-11-14T09:00:00.000Z'))
  })

  it('clears due_at when Buffer reports none', async () => {
    const { user, post } = await setup({
      bufferPostId: 'bp_2',
      bufferStatus: 'scheduled',
      dueAt: new Date('2026-11-14T09:00:00.000Z'),
    })
    mockBuffer(() =>
      HttpResponse.json({
        data: { post: rawPost({ status: 'draft', dueAt: null }) },
      }),
    )
    await syncPostStatus(user.id, post.id)
    const row = await stored(post.id)
    expect(row.bufferStatus).toBe('draft')
    expect(row.dueAt).toBeNull()
  })

  it('flags missingInBuffer and leaves the row when Buffer has no such post', async () => {
    const { user, post } = await setup({
      bufferPostId: 'bp_3',
      bufferStatus: 'scheduled',
    })
    mockBuffer(() => HttpResponse.json({ data: { post: null } }))
    expect(await syncPostStatus(user.id, post.id)).toEqual({
      status: 'missingInBuffer',
    })
    const row = await stored(post.id)
    expect(row.bufferStatus).toBe('scheduled')
    expect(row.bufferPostId).toBe('bp_3')
  })

  it('returns unavailable and keeps the last known status on a temporary error', async () => {
    const { user, post } = await setup({
      bufferPostId: 'bp_4',
      bufferStatus: 'scheduled',
    })
    mockBuffer(() => new HttpResponse(null, { status: 503 }))
    expect(await syncPostStatus(user.id, post.id)).toEqual({
      status: 'unavailable',
    })
    expect((await stored(post.id)).bufferStatus).toBe('scheduled')
  })

  it('makes no Buffer call for a post without buffer_post_id', async () => {
    const { user, post } = await setup()
    const calls = mockBuffer(() =>
      HttpResponse.json({ data: { post: rawPost() } }),
    )
    expect(await syncPostStatus(user.id, post.id)).toEqual({
      status: 'skipped',
    })
    expect(calls.count).toBe(0)
  })

  it('makes no Buffer call for the sample post', async () => {
    const { user, post } = await setup({ bufferPostId: 'bp_5' }, true)
    const calls = mockBuffer(() =>
      HttpResponse.json({ data: { post: rawPost() } }),
    )
    expect(await syncPostStatus(user.id, post.id)).toEqual({
      status: 'skipped',
    })
    expect(calls.count).toBe(0)
  })

  it("skips a post that isn't the user's", async () => {
    const { post } = await setup({ bufferPostId: 'bp_6' })
    const other = await createTestUser()
    const calls = mockBuffer(() =>
      HttpResponse.json({ data: { post: rawPost() } }),
    )
    expect(await syncPostStatus(other.id, post.id)).toEqual({
      status: 'skipped',
    })
    expect(calls.count).toBe(0)
  })
})

describe('syncPostStatus when the Buffer connection is gone', () => {
  it('lets the auth-expired error through so the user re-signs in', async () => {
    connection.expired = true
    try {
      const { user, post } = await setup({ bufferPostId: 'bp_7' })
      await expect(syncPostStatus(user.id, post.id)).rejects.toBeInstanceOf(
        BufferAuthExpiredError,
      )
    } finally {
      connection.expired = false
    }
  })
})
