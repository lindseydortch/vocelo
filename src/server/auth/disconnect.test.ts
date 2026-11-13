import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { bufferConnections, personas, posts, users } from '~/db/schema'
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
// The Start transport is exercised by Playwright; invoke its registered handler here.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (handler: () => Promise<unknown>) => handler,
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
const { disconnectBuffer, getDisconnectInfo } = await import('./disconnect')
const { SESSION_COOKIE, sealSession, getSessionUser, setSessionUser } =
  await import('./session')
afterEach(() => {
  jar.clear()
})
afterAll(async () => {
  await sql.end()
})

describe('disconnect Buffer', () => {
  it('removes the signed-in connection and session while preserving the account', async () => {
    const user = await createTestUser({ plan: 'creator' })
    await testDb
      .insert(bufferConnections)
      .values({ userId: user.id, accessTokenEnc: 'encrypted' })
    const post = await createTestPost({ user })
    const [persona] = await testDb
      .insert(personas)
      .values({
        userId: user.id,
        name: 'My reader',
        bio: 'A reader',
        avatarKey: 'reader',
        elevenlabsVoiceId: 'voice',
        readerDescription: 'A careful reader',
      })
      .returning()
    const otherUser = await createTestUser()
    await testDb
      .insert(bufferConnections)
      .values({ userId: otherUser.id, accessTokenEnc: 'other-encrypted' })
    jar.set(SESSION_COOKIE, sealSession(user.id))

    await disconnectBuffer()

    expect(jar.has(SESSION_COOKIE)).toBe(false)
    expect(await getSessionUser()).toBeNull()
    expect(
      await testDb
        .select()
        .from(bufferConnections)
        .where(eq(bufferConnections.userId, user.id)),
    ).toEqual([])
    expect(
      await testDb.select().from(users).where(eq(users.id, user.id)),
    ).toEqual([user])
    expect(
      await testDb.select().from(posts).where(eq(posts.id, post.id)),
    ).toEqual([post])
    expect(
      await testDb.select().from(personas).where(eq(personas.id, persona!.id)),
    ).toEqual([persona])
    expect(
      await testDb
        .select()
        .from(bufferConnections)
        .where(eq(bufferConnections.userId, otherUser.id)),
    ).toHaveLength(1)

    // Reconnecting the surviving account makes its existing data accessible again.
    await testDb
      .insert(bufferConnections)
      .values({ userId: user.id, accessTokenEnc: 'new-encrypted' })
    setSessionUser(user.id)
    expect((await getSessionUser())?.user).toEqual(user)
  })
  it('rejects a signed-out request without deleting any connection', async () => {
    const user = await createTestUser()
    await testDb
      .insert(bufferConnections)
      .values({ userId: user.id, accessTokenEnc: 'encrypted' })
    await expect(disconnectBuffer()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    expect(
      await testDb
        .select()
        .from(bufferConnections)
        .where(eq(bufferConnections.userId, user.id)),
    ).toHaveLength(1)
  })

  it.each([
    ['active', true],
    ['trialing', true],
    ['past_due', true],
    ['canceled', false],
    ['unpaid', false],
    [null, false],
  ])(
    'shows the billing warning for subscription status %s: %s',
    async (status, paid) => {
      const user = await createTestUser()
      await testDb
        .update(users)
        .set({ plan: 'creator', subscriptionStatus: status })
        .where(eq(users.id, user.id))
      await testDb
        .insert(bufferConnections)
        .values({ userId: user.id, accessTokenEnc: 'encrypted' })
      setSessionUser(user.id)
      expect(await getDisconnectInfo()).toEqual({ paid })
    },
  )
})
