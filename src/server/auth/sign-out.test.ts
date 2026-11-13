import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { bufferConnections, users } from '~/db/schema'
import { createTestSql } from '~/test/db'

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }))
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => jar.values.get(name),
  setCookie: (name: string, value: string) => {
    jar.values.set(name, value)
  },
  deleteCookie: (name: string) => {
    jar.values.delete(name)
  },
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

const { SESSION_COOKIE, clearSession, hasValidSessionCookie, sealSession } =
  await import('./session')

afterEach(async () => {
  jar.values.clear()
  await testDb.delete(users).where(eq(users.bufferAccountId, 'signout_test'))
})
afterAll(async () => {
  await sql.end()
})

async function seedUser() {
  const [user] = await testDb
    .insert(users)
    .values({
      bufferAccountId: 'signout_test',
      bufferOrganizationId: 'org_signout_test',
      email: 'signout@example.test',
    })
    .returning({ id: users.id })
  await testDb
    .insert(bufferConnections)
    .values({ userId: user!.id, accessTokenEnc: 'enc-token' })
  return user!.id
}

describe('sign out (clearSession)', () => {
  it('clears the session cookie but keeps the Buffer connection', async () => {
    const userId = await seedUser()
    jar.values.set(SESSION_COOKIE, sealSession(userId))
    expect(hasValidSessionCookie()).toBe(true)

    clearSession()

    expect(jar.values.has(SESSION_COOKIE)).toBe(false)
    expect(hasValidSessionCookie()).toBe(false)
    const conns = await testDb
      .select()
      .from(bufferConnections)
      .where(eq(bufferConnections.userId, userId))
    expect(conns).toHaveLength(1)
    expect(conns[0]?.accessTokenEnc).toBe('enc-token')
  })

  it('is a no-op when already signed out', async () => {
    expect(() => clearSession()).not.toThrow()
    expect(jar.values.size).toBe(0)
  })
})
