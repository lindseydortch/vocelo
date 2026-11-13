import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { http, HttpResponse } from 'msw'
import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { posts, usageEvents } from '~/db/schema'
import { testDatabaseUrl } from '~/test/db'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'
import { createTestPost, createTestUser } from '~/test/factories'
import { server } from '~/test/msw'

vi.mock('@tanstack/react-start/server-only', () => ({}))
vi.mock('~/server/env', () => ({ env: {} }))
const sql = postgres(testDatabaseUrl(), { max: 3, prepare: false })
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
// Token refresh has its own tests; here the token is always valid.
vi.mock('~/server/buffer/with-buffer', () => ({
  withBuffer: (_userId: string, fn: (token: string) => Promise<unknown>) =>
    fn('token'),
}))
const { moveBackToDraft } = await import('./move-back-to-draft')
afterAll(() => sql.end())

const STALE_DUE = '2026-12-01T09:00:00.000Z'
const channel = {
  id: 'c1',
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
}

let writes: string[]
let remote:
  { status: string; dueAt?: string | null } | 'missing' | { moveFails: true }

beforeEach(() => {
  writes = []
  server.use(
    http.post(BUFFER_GRAPHQL_URL, async ({ request }) => {
      const { query } = (await request.json()) as { query: string }
      if (query.includes('MoveBufferPostToDraft')) {
        writes.push('move')
        if (typeof remote === 'object' && 'moveFails' in remote) {
          return HttpResponse.json({
            data: {
              editPost: { __typename: 'MutationError', message: 'nope' },
            },
          })
        }
        return HttpResponse.json({
          data: {
            editPost: {
              __typename: 'PostActionSuccess',
              post: { id: 'bp1', status: 'draft', dueAt: STALE_DUE },
            },
          },
        })
      }
      if (remote === 'missing') {
        return HttpResponse.json({
          errors: [{ message: 'gone', extensions: { code: 'NOT_FOUND' } }],
          data: null,
        })
      }
      const status =
        typeof remote === 'object' && 'status' in remote
          ? remote
          : { status: 'scheduled' }
      return HttpResponse.json({
        data: {
          post: {
            id: 'bp1',
            text: 'x',
            error: null,
            assets: [],
            channel,
            dueAt: STALE_DUE,
            ...status,
          },
        },
      })
    }),
  )
})

async function setup(
  opts: { bufferPostId?: string | null; old?: boolean } = {},
) {
  const user = await createTestUser()
  const post = await createTestPost({
    user,
    ...(opts.old && { lastEditedAt: new Date('2020-01-01T00:00:00Z') }),
  })
  await testDb
    .update(posts)
    .set({
      bufferPostId: opts.bufferPostId === undefined ? 'bp1' : opts.bufferPostId,
      bufferStatus: 'scheduled',
      dueAt: new Date(STALE_DUE),
    })
    .where(eq(posts.id, post.id))
  return { user, post }
}
async function row(id: string) {
  const [r] = await testDb.select().from(posts).where(eq(posts.id, id))
  return r!
}
async function writeEvents(userId: string) {
  const rows = await testDb
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
  return rows.filter((e) => e.kind === 'buffer_write').length
}

describe('moveBackToDraft', () => {
  it('scheduled: moves to draft, spends one write, clears due_at', async () => {
    remote = { status: 'scheduled' }
    const { user, post } = await setup()
    expect(await moveBackToDraft(user, post.id)).toEqual({
      ok: true,
      status: 'draft',
    })
    expect(writes).toEqual(['move'])
    expect(await writeEvents(user.id)).toBe(1)
    expect(await row(post.id)).toMatchObject({
      bufferStatus: 'draft',
      dueAt: null,
    })
  })

  it('scheduled: refunds the write when Buffer fails and keeps the row', async () => {
    remote = { status: 'scheduled' }
    const { user, post } = await setup()
    remote = { moveFails: true }
    // With moveFails set the pre-check query falls back to a scheduled post.
    await expect(moveBackToDraft(user, post.id)).rejects.toThrow('nope')
    expect(await writeEvents(user.id)).toBe(0)
    expect(await row(post.id)).toMatchObject({ bufferStatus: 'scheduled' })
  })

  it('scheduled: hourly write cap blocks the move before Buffer is called', async () => {
    remote = { status: 'scheduled' }
    const { user, post } = await setup()
    await testDb.insert(usageEvents).values(
      Array.from({ length: 30 }, () => ({
        userId: user.id,
        kind: 'buffer_write' as const,
        amount: 1,
      })),
    )
    await expect(moveBackToDraft(user, post.id)).rejects.toMatchObject({
      code: 'BUFFER_WRITE_CAP',
    })
    expect(writes).toEqual([])
    expect(await row(post.id)).toMatchObject({ bufferStatus: 'scheduled' })
  })

  it('draft: ALREADY_DRAFT, no write, due_at cleared', async () => {
    remote = { status: 'draft' }
    const { user, post } = await setup()
    expect(await moveBackToDraft(user, post.id)).toEqual({
      ok: false,
      code: 'ALREADY_DRAFT',
    })
    expect(writes).toEqual([])
    expect(await writeEvents(user.id)).toBe(0)
    expect(await row(post.id)).toMatchObject({
      bufferStatus: 'draft',
      dueAt: null,
    })
  })

  it.each(['sending', 'sent'])(
    '%s: ALREADY_POSTED, no write',
    async (status) => {
      remote = { status }
      const { user, post } = await setup()
      expect(await moveBackToDraft(user, post.id)).toEqual({
        ok: false,
        code: 'ALREADY_POSTED',
      })
      expect(await writeEvents(user.id)).toBe(0)
      expect(await row(post.id)).toMatchObject({
        bufferStatus: status,
        dueAt: null,
      })
    },
  )

  it.each(['needs_approval', 'error'])(
    '%s: NOT_A_DRAFT, no write',
    async (status) => {
      remote = { status }
      const { user, post } = await setup()
      expect(await moveBackToDraft(user, post.id)).toEqual({
        ok: false,
        code: 'NOT_A_DRAFT',
      })
      expect(await writeEvents(user.id)).toBe(0)
      expect(await row(post.id)).toMatchObject({
        bufferStatus: status,
        dueAt: null,
      })
    },
  )

  it('missing in Buffer: NOT_IN_BUFFER, clears buffer_post_id, no write', async () => {
    remote = 'missing'
    const { user, post } = await setup()
    expect(await moveBackToDraft(user, post.id)).toEqual({
      ok: false,
      code: 'NOT_IN_BUFFER',
    })
    expect(await writeEvents(user.id)).toBe(0)
    expect(await row(post.id)).toMatchObject({
      bufferPostId: null,
      dueAt: null,
    })
  })

  it('never saved to Buffer: NOT_IN_BUFFER without calling Buffer', async () => {
    remote = { status: 'scheduled' }
    const { user, post } = await setup({ bufferPostId: null })
    expect(await moveBackToDraft(user, post.id)).toEqual({
      ok: false,
      code: 'NOT_IN_BUFFER',
    })
    expect(writes).toEqual([])
  })

  it('rejects a locked post, another user’s post, and the sample', async () => {
    remote = { status: 'scheduled' }
    const old = await setup({ old: true })
    expect(await moveBackToDraft(old.user, old.post.id)).toEqual({
      ok: false,
      code: 'POST_LOCKED',
    })
    const other = await createTestUser()
    const mine = await setup()
    expect(await moveBackToDraft(other, mine.post.id)).toEqual({
      ok: false,
      code: 'POST_NOT_FOUND',
    })
    const sample = await createTestPost({ user: mine.user, isSample: true })
    expect(await moveBackToDraft(mine.user, sample.id)).toEqual({
      ok: false,
      code: 'READ_ONLY',
    })
    expect(writes).toEqual([])
  })
})
