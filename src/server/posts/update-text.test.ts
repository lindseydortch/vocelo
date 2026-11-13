import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { bufferConnections, posts, usageEvents, versions } from '~/db/schema'
import { resetClock, setClock } from '~/lib/clock'
import { createTestSql } from '~/test/db'
import { createTestPost, createTestUser } from '~/test/factories'

const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => jar.get(name),
  setCookie: (name: string, value: string) => {
    jar.set(name, value)
  },
  deleteCookie: (name: string) => {
    jar.delete(name)
  },
}))
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
vi.mock('~/server/env', () => ({
  env: { SESSION_SECRET: 'test-session-secret' },
}))
const sql = createTestSql()
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
const { updatePostText } = (await import('./update-text')) as unknown as {
  updatePostText: (input: {
    data: unknown
  }) => Promise<
    | { ok: true; lastEditedAt: string }
    | { ok: false; code: string; text?: string; lastEditedAt?: string }
  >
}
const { SESSION_COOKIE, sealSession } = await import('~/server/auth/session')

const NOW = new Date('2026-06-15T12:00:00.000Z')
const DAY = 86_400_000

async function setup(
  opts: {
    plan?: 'free' | 'creator'
    ageDays?: number
    isSample?: boolean
  } = {},
) {
  const user = await createTestUser({ plan: opts.plan ?? 'free' })
  await testDb
    .insert(bufferConnections)
    .values({ userId: user.id, accessTokenEnc: 'encrypted' })
  const post = await createTestPost({
    user,
    lastEditedAt: new Date(NOW.getTime() - (opts.ageDays ?? 1) * DAY),
    ...(opts.isSample && { isSample: true }),
  })
  jar.set(SESSION_COOKIE, sealSession(user.id))
  return { user, post }
}

const stored = async (id: string) =>
  (await testDb.select().from(posts).where(eq(posts.id, id)))[0]!

beforeEach(() => setClock(() => NOW))
afterEach(() => {
  jar.clear()
  resetClock()
})
afterAll(async () => {
  await sql.end()
})

describe('updatePostText', () => {
  it('writes changed text, bumps last_edited_at to now, and returns it', async () => {
    const { post } = await setup()
    const result = await updatePostText({
      data: {
        postId: post.id,
        text: 'New\r\ntext',
        baseEditedAt: post.lastEditedAt.toISOString(),
      },
    })
    expect(result).toEqual({ ok: true, lastEditedAt: NOW.toISOString() })
    const row = await stored(post.id)
    expect(row.text).toBe('New\ntext')
    expect(row.lastEditedAt).toEqual(NOW)
  })

  it('does not write or touch last_edited_at when the text is unchanged', async () => {
    const { post } = await setup()
    const result = await updatePostText({
      data: {
        postId: post.id,
        text: post.text,
        baseEditedAt: post.lastEditedAt.toISOString(),
      },
    })
    expect(result).toEqual({
      ok: true,
      lastEditedAt: post.lastEditedAt.toISOString(),
    })
    expect((await stored(post.id)).lastEditedAt).toEqual(post.lastEditedAt)
  })

  it('never writes a version or consumes usage', async () => {
    const { post } = await setup()
    await updatePostText({
      data: {
        postId: post.id,
        text: 'Changed',
        baseEditedAt: post.lastEditedAt.toISOString(),
      },
    })
    expect(
      await testDb.select().from(versions).where(eq(versions.postId, post.id)),
    ).toEqual([])
    expect(
      await testDb
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.postId, post.id)),
    ).toEqual([])
  })

  it('rejects text over 20,000 characters without writing', async () => {
    const { post } = await setup()
    const result = await updatePostText({
      data: {
        postId: post.id,
        text: 'a'.repeat(20_001),
        baseEditedAt: post.lastEditedAt.toISOString(),
      },
    })
    expect(result).toEqual({ ok: false, code: 'TEXT_TOO_LONG' })
    expect((await stored(post.id)).text).toBe(post.text)
  })

  it('accepts exactly 20,000 characters', async () => {
    const { post } = await setup()
    const result = await updatePostText({
      data: {
        postId: post.id,
        text: 'a'.repeat(20_000),
        baseEditedAt: post.lastEditedAt.toISOString(),
      },
    })
    expect(result.ok).toBe(true)
  })

  it('returns POST_NOT_FOUND for a missing post', async () => {
    await setup()
    const result = await updatePostText({
      data: {
        postId: '00000000-0000-4000-8000-000000000000',
        text: 'x',
        baseEditedAt: NOW.toISOString(),
      },
    })
    expect(result).toEqual({ ok: false, code: 'POST_NOT_FOUND' })
  })

  it("returns POST_NOT_FOUND for another user's post and leaves it alone", async () => {
    const { post: theirs } = await setup()
    await setup() // signs in as a different user
    const result = await updatePostText({
      data: {
        postId: theirs.id,
        text: 'hijack',
        baseEditedAt: theirs.lastEditedAt.toISOString(),
      },
    })
    expect(result).toEqual({ ok: false, code: 'POST_NOT_FOUND' })
    expect((await stored(theirs.id)).text).toBe(theirs.text)
  })

  it('returns POST_LOCKED outside the Free 30-day window but allows it on Creator', async () => {
    const free = await setup({ ageDays: 31 })
    expect(
      await updatePostText({
        data: {
          postId: free.post.id,
          text: 'x',
          baseEditedAt: free.post.lastEditedAt.toISOString(),
        },
      }),
    ).toEqual({ ok: false, code: 'POST_LOCKED' })
    expect((await stored(free.post.id)).text).toBe(free.post.text)

    const creator = await setup({ plan: 'creator', ageDays: 31 })
    expect(
      (
        await updatePostText({
          data: {
            postId: creator.post.id,
            text: 'x',
            baseEditedAt: creator.post.lastEditedAt.toISOString(),
          },
        })
      ).ok,
    ).toBe(true)
  })

  it('returns READ_ONLY for the sample post, even when old', async () => {
    const { post } = await setup({ isSample: true, ageDays: 400 })
    const result = await updatePostText({
      data: {
        postId: post.id,
        text: 'x',
        baseEditedAt: post.lastEditedAt.toISOString(),
      },
    })
    expect(result).toEqual({ ok: false, code: 'READ_ONLY' })
    expect((await stored(post.id)).text).toBe(post.text)
  })

  it('returns EDIT_CONFLICT with the stored text when base is older than stored', async () => {
    const { post } = await setup()
    const result = await updatePostText({
      data: {
        postId: post.id,
        text: 'mine',
        baseEditedAt: new Date(
          post.lastEditedAt.getTime() - 1000,
        ).toISOString(),
      },
    })
    expect(result).toEqual({
      ok: false,
      code: 'EDIT_CONFLICT',
      text: post.text,
      lastEditedAt: post.lastEditedAt.toISOString(),
    })
    expect((await stored(post.id)).text).toBe(post.text)
  })

  it('force skips the conflict check ("Keep mine")', async () => {
    const { post } = await setup()
    const result = await updatePostText({
      data: {
        postId: post.id,
        text: 'mine',
        baseEditedAt: new Date(
          post.lastEditedAt.getTime() - 1000,
        ).toISOString(),
        force: true,
      },
    })
    expect(result).toEqual({ ok: true, lastEditedAt: NOW.toISOString() })
    expect((await stored(post.id)).text).toBe('mine')
  })

  it('throws UNAUTHENTICATED when signed out', async () => {
    const { post } = await setup()
    jar.clear()
    await expect(
      updatePostText({
        data: { postId: post.id, text: 'x', baseEditedAt: NOW.toISOString() },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('rejects malformed input', async () => {
    await expect(
      updatePostText({ data: { postId: 1, text: 'x', baseEditedAt: 'nope' } }),
    ).rejects.toThrow('Invalid updatePostText input')
  })
})
