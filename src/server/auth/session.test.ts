import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { bufferConnections } from '~/db/schema'
import { freezeTime } from '~/test/clock'
import { createTestSql } from '~/test/db'
import { createTestUser } from '~/test/factories'
import { drizzle } from 'drizzle-orm/postgres-js'

type CookieOpts = Record<string, unknown>
const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  last: undefined as CookieOpts | undefined,
}))

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => jar.values.get(name),
  setCookie: (name: string, value: string, opts: CookieOpts) => {
    jar.values.set(name, value)
    jar.last = opts
  },
  deleteCookie: (name: string) => {
    jar.values.delete(name)
  },
}))

const testEnv = vi.hoisted(() => ({ SESSION_SECRET: 'test-session-secret' }))
vi.mock('~/server/env', () => ({ env: testEnv }))

const sql = createTestSql()
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
afterAll(async () => {
  await sql.end()
})

const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  UnauthenticatedError,
  clearSession,
  getSessionUser,
  requireUser,
  sealSession,
  setSessionUser,
  unsealSession,
} = await import('./session')

const ID = '11111111-1111-4111-8111-111111111111'

async function signedInUser() {
  const user = await createTestUser()
  await testDb
    .insert(bufferConnections)
    .values({ userId: user.id, accessTokenEnc: 'enc' })
  return user
}

beforeEach(() => {
  jar.values.clear()
  jar.last = undefined
  testEnv.SESSION_SECRET = 'test-session-secret'
})

describe('session cookie', () => {
  it('set → get returns the user and connection', async () => {
    const user = await signedInUser()
    setSessionUser(user.id)
    const session = await getSessionUser()
    expect(session?.user.id).toBe(user.id)
    expect(session?.connection.userId).toBe(user.id)
  })

  it('sets an HttpOnly, Secure, SameSite=Lax cookie with a 30-day max age holding only the user id', () => {
    setSessionUser('11111111-1111-4111-8111-111111111111')
    expect(jar.last).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    })
    expect(jar.values.get(SESSION_COOKIE)).not.toContain('1111')
  })

  it('renews the cookie on each request', async () => {
    const user = await signedInUser()
    freezeTime('2026-01-01T00:00:00Z')
    setSessionUser(user.id)
    const first = jar.values.get(SESSION_COOKIE)
    freezeTime('2026-01-20T00:00:00Z')
    await getSessionUser()
    const renewed = jar.values.get(SESSION_COOKIE)!
    expect(renewed).not.toBe(first)
    // Still valid 29 days after the renewal, which the original would not be.
    const at = new Date('2026-01-20T00:00:00Z').getTime() + 29 * 864e5
    expect(unsealSession(renewed, new Date(at))).toBe(user.id)
    expect(unsealSession(first!, new Date(at))).toBeNull()
  })

  it('reads as signed out after clearSession()', async () => {
    const user = await signedInUser()
    setSessionUser(user.id)
    clearSession()
    expect(await getSessionUser()).toBeNull()
  })

  it('reads as signed out when the Buffer connection was deleted', async () => {
    const user = await signedInUser()
    setSessionUser(user.id)
    await testDb
      .delete(bufferConnections)
      .where(eq(bufferConnections.userId, user.id))
    expect(await getSessionUser()).toBeNull()
    expect(jar.values.has(SESSION_COOKIE)).toBe(false)
  })

  it('reads as signed out when the user does not exist', async () => {
    setSessionUser('00000000-0000-4000-8000-000000000000')
    expect(await getSessionUser()).toBeNull()
  })

  it('reads as signed out for a tampered cookie', async () => {
    const user = await signedInUser()
    setSessionUser(user.id)
    const sealed = jar.values.get(SESSION_COOKIE)!
    const flipped = sealed.slice(0, -2) + (sealed.endsWith('AA') ? 'BB' : 'AA')
    jar.values.set(SESSION_COOKIE, flipped)
    expect(await getSessionUser()).toBeNull()
    expect(jar.values.has(SESSION_COOKIE)).toBe(false)
  })

  it('rejects a cookie sealed with a different secret and garbage input', () => {
    const sealed = sealSession(ID)
    testEnv.SESSION_SECRET = 'another-secret'
    expect(unsealSession(sealed)).toBeNull()
    expect(unsealSession('not-a-cookie')).toBeNull()
    expect(unsealSession('')).toBeNull()
  })

  it('rejects an expired cookie', () => {
    const sealed = sealSession(ID, new Date('2026-01-01T00:00:00Z'))
    const later = new Date(
      new Date('2026-01-01T00:00:00Z').getTime() +
        (SESSION_MAX_AGE_SECONDS + 1) * 1000,
    )
    expect(unsealSession(sealed, later)).toBeNull()
  })
})

describe('session cookie with a bad payload', () => {
  it('reads as signed out (not a 500) when the sealed id is not a UUID', async () => {
    jar.values.set(SESSION_COOKIE, sealSession('not-a-uuid'))
    expect(await getSessionUser()).toBeNull()
    expect(jar.values.has(SESSION_COOKIE)).toBe(false)
  })
})

describe('requireUser', () => {
  it('returns the session when signed in', async () => {
    const user = await signedInUser()
    setSessionUser(user.id)
    expect((await requireUser()).user.id).toBe(user.id)
  })

  it('throws a typed UNAUTHENTICATED error when signed out', async () => {
    const err = await requireUser().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UnauthenticatedError)
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})
