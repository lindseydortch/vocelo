import { eq } from 'drizzle-orm'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { usageEvents } from '~/db/schema'
import { resetClock, setClock } from '~/lib/clock'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { testDatabaseUrl } from '~/test/db'
import { createTestPost, createTestUser } from '~/test/factories'

// A pooled client (not one connection) so the concurrency test really contends for the row lock.
const sql = postgres(testDatabaseUrl(), { max: 5, prepare: false })
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
const {
  checkAndConsume,
  refund,
  consumeBufferWrite,
  refundBufferWrite,
  BufferWriteCapError,
} = await import('./usage')

const NOW = new Date('2026-06-15T12:00:00.000Z')
const HOUR = 3_600_000
const DAY = 86_400_000

beforeEach(() => setClock(() => NOW))
afterEach(() => resetClock())
afterAll(async () => {
  await sql.end()
})

async function freeUser() {
  // Anchor 5 days ago: the current Free period started inside the last month.
  return createTestUser({ periodAnchorAt: new Date(NOW.getTime() - 5 * DAY) })
}
async function events(userId: string) {
  return testDb.select().from(usageEvents).where(eq(usageEvents.userId, userId))
}
async function seed(
  userId: string,
  kind: 'tts_chars' | 'post_review' | 'llm_call' | 'buffer_write',
  amount: number,
  createdAt: Date,
  postId?: string,
) {
  await testDb
    .insert(usageEvents)
    .values({ userId, kind, amount, createdAt, postId: postId ?? null })
}

describe('checkAndConsume: success', () => {
  it('records the charge and one post_review on the first action for a post', async () => {
    const user = await freeUser()
    const post = await createTestPost({ user })

    const result = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'tts_chars',
      amount: 800,
    })

    expect(result.ok).toBe(true)
    const rows = await events(user.id)
    expect(rows.map((r) => r.kind).sort()).toEqual(['post_review', 'tts_chars'])
    const tts = rows.find((r) => r.kind === 'tts_chars')!
    expect(tts).toMatchObject({ amount: 800, postId: post.id })
    if (result.ok) expect(result.eventId).toBe(tts.id)
    expect(rows.find((r) => r.kind === 'post_review')).toMatchObject({
      amount: 1,
      postId: post.id,
    })
  })

  it('does not add a second post_review for the same post in the period', async () => {
    const user = await freeUser()
    const post = await createTestPost({ user })
    const request = { postId: post.id, kind: 'tts_chars', amount: 100 } as const

    await checkAndConsume(user.id, request)
    await checkAndConsume(user.id, request)
    await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'llm_call',
      amount: 1,
    })

    const rows = await events(user.id)
    expect(rows.filter((r) => r.kind === 'post_review')).toHaveLength(1)
    expect(rows.filter((r) => r.kind === 'tts_chars')).toHaveLength(2)
  })

  it('charges a post again in a new period', async () => {
    const user = await freeUser()
    const post = await createTestPost({ user })
    await seed(
      user.id,
      'post_review',
      1,
      new Date(NOW.getTime() - 40 * DAY),
      post.id,
    )

    await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'llm_call',
      amount: 1,
    })

    const rows = await events(user.id)
    expect(rows.filter((r) => r.kind === 'post_review')).toHaveLength(2)
  })
})

describe('checkAndConsume: posts limit', () => {
  it("rejects a Free user's 6th post with reason posts and writes nothing", async () => {
    const user = await freeUser()
    for (let i = 0; i < 5; i++) {
      const p = await createTestPost({ user })
      const r = await checkAndConsume(user.id, {
        postId: p.id,
        kind: 'tts_chars',
        amount: 10,
      })
      expect(r.ok).toBe(true)
    }
    const sixth = await createTestPost({ user })
    const before = (await events(user.id)).length

    const result = await checkAndConsume(user.id, {
      postId: sixth.id,
      kind: 'tts_chars',
      amount: 10,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'posts',
      needed: 1,
      remaining: 0,
    })
    expect((await events(user.id)).length).toBe(before)
  })

  it('still lets an already-reviewed post consume at the limit', async () => {
    const user = await freeUser()
    const posts = []
    for (let i = 0; i < 5; i++) {
      const p = await createTestPost({ user })
      posts.push(p)
      await checkAndConsume(user.id, {
        postId: p.id,
        kind: 'llm_call',
        amount: 1,
      })
    }

    const again = await checkAndConsume(user.id, {
      postId: posts[0]!.id,
      kind: 'tts_chars',
      amount: 10,
    })

    expect(again.ok).toBe(true)
  })

  it('does not limit posts for Creator', async () => {
    const user = await createTestUser({ plan: 'creator' })
    for (let i = 0; i < 6; i++) {
      const p = await createTestPost({ user })
      const r = await checkAndConsume(user.id, {
        postId: p.id,
        kind: 'tts_chars',
        amount: 10,
      })
      expect(r.ok).toBe(true)
    }
  })
})

describe('checkAndConsume: characters limit', () => {
  it('rejects a request over the remaining characters whole', async () => {
    const user = await freeUser()
    const post = await createTestPost({ user })
    await seed(user.id, 'tts_chars', 11_500, new Date(NOW.getTime() - DAY))

    const result = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'tts_chars',
      amount: 800,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'characters',
      needed: 800,
      remaining: 500,
    })
    expect((await events(user.id)).filter((e) => e.postId === post.id)).toEqual(
      [],
    )
  })

  it('allows a request that exactly uses the remaining characters', async () => {
    const user = await freeUser()
    const post = await createTestPost({ user })
    await seed(user.id, 'tts_chars', 11_200, new Date(NOW.getTime() - DAY))

    const result = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'tts_chars',
      amount: 800,
    })

    expect(result.ok).toBe(true)
  })

  it('ignores characters used in earlier periods and uses the Creator limit', async () => {
    const free = await freeUser()
    const freePost = await createTestPost({ user: free })
    await seed(free.id, 'tts_chars', 12_000, new Date(NOW.getTime() - 40 * DAY))
    expect(
      (
        await checkAndConsume(free.id, {
          postId: freePost.id,
          kind: 'tts_chars',
          amount: 800,
        })
      ).ok,
    ).toBe(true)

    const creator = await createTestUser({ plan: 'creator' })
    const creatorPost = await createTestPost({ user: creator })
    await seed(creator.id, 'tts_chars', 79_500, NOW)
    expect(
      await checkAndConsume(creator.id, {
        postId: creatorPost.id,
        kind: 'tts_chars',
        amount: 800,
      }),
    ).toEqual({ ok: false, reason: 'characters', needed: 800, remaining: 500 })
  })
})

describe('checkAndConsume: LLM rate limit', () => {
  it('rejects the 61st LLM call within an hour', async () => {
    const user = await createTestUser({ plan: 'creator' })
    const post = await createTestPost({ user })
    await seed(user.id, 'llm_call', 60, new Date(NOW.getTime() - HOUR / 2))

    const result = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'llm_call',
      amount: 1,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'rate',
      needed: 1,
      remaining: 0,
    })
  })

  it('does not count calls older than an hour', async () => {
    const user = await freeUser()
    const post = await createTestPost({ user })
    await seed(user.id, 'llm_call', 60, new Date(NOW.getTime() - HOUR - 1000))

    const result = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'llm_call',
      amount: 1,
    })

    expect(result.ok).toBe(true)
  })

  it('serializes concurrent calls so the limit holds', async () => {
    const user = await createTestUser({ plan: 'creator' })
    const post = await createTestPost({ user })
    await seed(user.id, 'llm_call', 59, new Date(NOW.getTime() - 1000))

    const results = await Promise.all(
      [1, 2, 3].map(() =>
        checkAndConsume(user.id, {
          postId: post.id,
          kind: 'llm_call',
          amount: 1,
        }),
      ),
    )

    expect(results.filter((r) => r.ok)).toHaveLength(1)
  })
})

describe('samples, ownership, and input', () => {
  it('never consumes anything for a sample post', async () => {
    const user = await freeUser()
    const sample = await createTestPost({ user, isSample: true })
    await seed(user.id, 'tts_chars', 12_000, new Date(NOW.getTime() - DAY))

    const result = await checkAndConsume(user.id, {
      postId: sample.id,
      kind: 'tts_chars',
      amount: 5_000,
    })

    expect(result.ok).toBe(true)
    expect(await events(user.id)).toHaveLength(1)
  })

  it("rejects a post that isn't the user's", async () => {
    const owner = await freeUser()
    const other = await freeUser()
    const post = await createTestPost({ user: owner })

    await expect(
      checkAndConsume(other.id, {
        postId: post.id,
        kind: 'llm_call',
        amount: 1,
      }),
    ).rejects.toThrow(/post/i)
    expect(await events(other.id)).toEqual([])
  })

  it.each([0, -5, 1.5])('rejects an invalid amount (%s)', async (amount) => {
    const user = await freeUser()
    const post = await createTestPost({ user })
    await expect(
      checkAndConsume(user.id, { postId: post.id, kind: 'tts_chars', amount }),
    ).rejects.toThrow(/amount/i)
  })
})

describe('refund', () => {
  it('deletes the event so the characters are available again', async () => {
    const user = await freeUser()
    const post = await createTestPost({ user })
    const first = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'tts_chars',
      amount: 12_000,
    })
    if (!first.ok) throw new Error('expected ok')

    await refund(first.eventId)

    expect(
      await testDb
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.id, first.eventId)),
    ).toEqual([])
    const retry = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'tts_chars',
      amount: 12_000,
    })
    expect(retry.ok).toBe(true)
  })

  it('is a no-op for an unknown or sample event id', async () => {
    const user = await freeUser()
    const sample = await createTestPost({ user, isSample: true })
    const result = await checkAndConsume(user.id, {
      postId: sample.id,
      kind: 'llm_call',
      amount: 1,
    })
    if (!result.ok) throw new Error('expected ok')

    await expect(refund(result.eventId)).resolves.toBeUndefined()
    await expect(
      refund('00000000-0000-4000-8000-0000000000ff'),
    ).resolves.toBeUndefined()
  })
})

describe('buffer write cap', () => {
  const consume = (userId: string) =>
    testDb.transaction((tx) => consumeBufferWrite(userId, tx))
  const writes = async (userId: string) =>
    (await events(userId)).filter((e) => e.kind === 'buffer_write')

  for (const plan of ['free', 'creator'] as const) {
    it(`allows 30 writes an hour and rejects the 31st on ${plan}`, async () => {
      const user = await createTestUser({ plan })
      for (let i = 0; i < 30; i++) await consume(user.id)

      const error = await consume(user.id).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(BufferWriteCapError)
      expect(error).toMatchObject({ code: 'BUFFER_WRITE_CAP' })
      expect(await writes(user.id)).toHaveLength(30)
    })
  }

  it('reports minutes until the oldest write leaves the window', async () => {
    const user = await freeUser()
    await seed(
      user.id,
      'buffer_write',
      1,
      new Date(NOW.getTime() - 50 * 60_000),
    )
    for (let i = 0; i < 29; i++) await consume(user.id)

    const error = await consume(user.id).catch((e: unknown) => e)

    expect(error).toMatchObject({
      code: 'BUFFER_WRITE_CAP',
      retryInMinutes: 10,
    })
  })

  it('rolls over after an hour', async () => {
    const user = await freeUser()
    for (let i = 0; i < 30; i++) await consume(user.id)
    setClock(() => new Date(NOW.getTime() + HOUR + 1))

    await expect(consume(user.id)).resolves.toEqual(expect.any(String))
  })

  it('does not count other users or other kinds', async () => {
    const user = await freeUser()
    const other = await freeUser()
    for (let i = 0; i < 30; i++) await consume(other.id)
    await seed(user.id, 'llm_call', 1, NOW)

    await expect(consume(user.id)).resolves.toEqual(expect.any(String))
  })

  it('never counts toward reviewed posts or voice characters', async () => {
    const user = await freeUser()
    for (let i = 0; i < 30; i++) await consume(user.id)
    const post = await createTestPost({ user })

    const result = await checkAndConsume(user.id, {
      postId: post.id,
      kind: 'tts_chars',
      amount: 12_000,
    })

    expect(result.ok).toBe(true)
  })

  it('refundBufferWrite frees the slot and ignores unknown or non-write ids', async () => {
    const user = await freeUser()
    const ids: string[] = []
    for (let i = 0; i < 30; i++) ids.push(await consume(user.id))
    await seed(user.id, 'tts_chars', 5, NOW)
    const tts = (await events(user.id)).find((e) => e.kind === 'tts_chars')!

    await refundBufferWrite(ids[0]!)
    await refundBufferWrite(tts.id)
    await refundBufferWrite('not-a-uuid')

    expect(await writes(user.id)).toHaveLength(29)
    expect((await events(user.id)).some((e) => e.id === tts.id)).toBe(true)
    await expect(consume(user.id)).resolves.toEqual(expect.any(String))
  })

  it('serializes concurrent writes under the user lock', async () => {
    const user = await freeUser()
    const results = await Promise.allSettled(
      Array.from({ length: 35 }, () => consume(user.id)),
    )

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(30)
    expect(await writes(user.id)).toHaveLength(30)
  })
})
