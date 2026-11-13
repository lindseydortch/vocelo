import { drizzle } from 'drizzle-orm/postgres-js'
import { http, HttpResponse } from 'msw'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { posts } from '~/db/schema'
import { eq } from 'drizzle-orm'
import { createTestSql } from '~/test/db'
import { createTestPost, createTestUser } from '~/test/factories'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'
import { server } from '~/test/msw'

// The Start transport is exercised by Playwright; invoke the validator + handler directly.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: (validate: (input: unknown) => unknown) => ({
      handler:
        (handler: (ctx: { data: unknown }) => Promise<unknown>) =>
        async (input: { data: unknown }) =>
          handler({ data: validate(input.data) }),
    }),
  }),
}))
const session = vi.hoisted(() => ({ userId: '' }))
vi.mock('~/server/auth/session', () => ({
  requireUser: async () => ({
    user: { id: session.userId, subscriptionStatus: null },
  }),
}))
const sql = createTestSql()
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
vi.mock('~/server/buffer/with-buffer', () => ({
  withBuffer: (_userId: string, fn: (token: string) => Promise<unknown>) =>
    fn('tok'),
}))
const { loadPost } = (await import('./get-post-fn')) as unknown as {
  loadPost: (input: { data: { id: string } }) => Promise<{
    status: string
    buffer: {
      status: string | null
      dueAt: string | null
      missingInBuffer: boolean
      checkFailed: boolean
    }
  }>
}

afterAll(async () => {
  await sql.end()
})

async function setup() {
  const user = await createTestUser()
  const post = await createTestPost({ user })
  await testDb
    .update(posts)
    .set({ bufferPostId: 'bp_1', bufferStatus: 'scheduled' })
    .where(eq(posts.id, post.id))
  session.userId = user.id
  return post
}

beforeEach(() => server.resetHandlers())

describe('loadPost Buffer sync', () => {
  it('returns the freshly synced status', async () => {
    const post = await setup()
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({
          data: {
            post: {
              id: 'bp_1',
              status: 'sent',
              dueAt: null,
              text: 'x',
              error: null,
              assets: [],
              channel: {
                id: 'c',
                isDisconnected: false,
                isLocked: false,
                isQueuePaused: false,
              },
            },
          },
        }),
      ),
    )
    const result = await loadPost({ data: { id: post.id } })
    expect(result.buffer).toEqual({
      status: 'sent',
      dueAt: null,
      missingInBuffer: false,
      checkFailed: false,
    })
  })

  it('still loads with the last known status when Buffer is down', async () => {
    const post = await setup()
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    const result = await loadPost({ data: { id: post.id } })
    expect(result.status).toBe('ok')
    expect(result.buffer).toMatchObject({
      status: 'scheduled',
      checkFailed: true,
    })
  })

  it('flags a post Buffer no longer has', async () => {
    const post = await setup()
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({ data: { post: null } }),
      ),
    )
    const result = await loadPost({ data: { id: post.id } })
    expect(result.buffer).toMatchObject({
      status: 'scheduled',
      missingInBuffer: true,
    })
  })
})
