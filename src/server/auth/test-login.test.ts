import { and, eq, like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { bufferConnections, usageEvents, users } from '~/db/schema'
import { getEffectivePlan } from '~/server/plan'
import { PRESETS } from '~/test/presets'
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
  env: {
    SESSION_SECRET: 'test-session-secret',
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  },
}))

const sql = createTestSql()
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))

const { SESSION_COOKIE, unsealSession } = await import('./session')
const { DB_OFF_USER_ID, handleTestLogin, isTestLoginEnabled } =
  await import('./test-login')

const req = (user?: string, extra = '') =>
  new Request(
    `https://localhost/__test/login${user === undefined ? '' : `?user=${user}${extra}`}`,
  )

afterEach(async () => {
  vi.unstubAllEnvs()
  jar.values.clear()
  await testDb.delete(users).where(eq(users.bufferAccountId, 'e2e_free'))
  await testDb.delete(users).where(eq(users.bufferAccountId, 'e2e_creator'))
  await testDb.delete(users).where(like(users.bufferAccountId, 'e2e\\_%'))
})
afterAll(async () => {
  await sql.end()
})

function enable() {
  vi.stubEnv('E2E_AUTH', '1')
  vi.stubEnv('NODE_ENV', 'test')
}

describe('isTestLoginEnabled', () => {
  it('needs E2E_AUTH=1 and a non-production NODE_ENV', () => {
    expect(isTestLoginEnabled({ E2E_AUTH: '1', NODE_ENV: 'development' })).toBe(
      true,
    )
    expect(isTestLoginEnabled({ E2E_AUTH: '1', NODE_ENV: 'production' })).toBe(
      false,
    )
    expect(isTestLoginEnabled({ NODE_ENV: 'development' })).toBe(false)
    expect(isTestLoginEnabled({ E2E_AUTH: '0', NODE_ENV: 'development' })).toBe(
      false,
    )
  })
})

describe('handleTestLogin', () => {
  it('signs in a free user, sets the real session cookie, redirects to /app', async () => {
    enable()
    const res = await handleTestLogin(req('free'))
    expect(res.status).toBe(302)
    expect(new URL(res.headers.get('location')!, 'https://x').pathname).toBe(
      '/app',
    )
    const [user] = await testDb
      .select()
      .from(users)
      .where(eq(users.bufferAccountId, 'e2e_free'))
    expect(user?.plan).toBe('free')
    expect(unsealSession(jar.values.get(SESSION_COOKIE)!)).toBe(user?.id)
    const conns = await testDb
      .select()
      .from(bufferConnections)
      .where(eq(bufferConnections.userId, user!.id))
    expect(conns).toHaveLength(1)
  })

  it('signs in a creator with an active subscription', async () => {
    enable()
    await handleTestLogin(req('creator'))
    const [user] = await testDb
      .select()
      .from(users)
      .where(eq(users.bufferAccountId, 'e2e_creator'))
    expect(user?.plan).toBe('creator')
    expect(user?.subscriptionStatus).toBe('active')
  })

  it('reuses the same user on a second call', async () => {
    enable()
    await handleTestLogin(req('free'))
    const first = unsealSession(jar.values.get(SESSION_COOKIE)!)
    await handleTestLogin(req('free'))
    expect(unsealSession(jar.values.get(SESSION_COOKIE)!)).toBe(first)
    const rows = await testDb
      .select()
      .from(users)
      .where(eq(users.bufferAccountId, 'e2e_free'))
    expect(rows).toHaveLength(1)
  })

  it('resets plan fields on a reused user', async () => {
    enable()
    await handleTestLogin(req('free'))
    await testDb
      .update(users)
      .set({ plan: 'creator' })
      .where(eq(users.bufferAccountId, 'e2e_free'))
    await handleTestLogin(req('free'))
    const [user] = await testDb
      .select()
      .from(users)
      .where(eq(users.bufferAccountId, 'e2e_free'))
    expect(user?.plan).toBe('free')
  })

  it.each([
    'free-at-limit',
    'free-low-chars',
    'free-downgraded',
    'creator-canceling',
    'creator-past-due',
  ] as const)('signs in the %s preset with its seeded state', async (key) => {
    enable()
    const res = await handleTestLogin(req(key))
    expect(res.status).toBe(302)
    const [user] = await testDb
      .select()
      .from(users)
      .where(eq(users.bufferAccountId, `e2e_${key}`))
    expect(unsealSession(jar.values.get(SESSION_COOKIE)!)).toBe(user?.id)
    expect(getEffectivePlan(user!)).toBe(PRESETS[key].expected.plan)
    const events = await testDb
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.userId, user!.id))
    expect(events.length).toBeGreaterThan(0)
  })

  it('rebuilds a preset user on every sign-in instead of stacking data', async () => {
    enable()
    await handleTestLogin(req('free-at-limit'))
    await handleTestLogin(req('free-at-limit'))
    const [user] = await testDb
      .select()
      .from(users)
      .where(eq(users.bufferAccountId, 'e2e_free-at-limit'))
    const reviews = await testDb
      .select()
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, user!.id),
          eq(usageEvents.kind, 'post_review'),
        ),
      )
    expect(reviews).toHaveLength(5)
  })

  it('404s when E2E_AUTH is unset', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const res = await handleTestLogin(req('free'))
    expect(res.status).toBe(404)
    expect(jar.values.size).toBe(0)
  })

  it('404s in production even with E2E_AUTH=1', async () => {
    vi.stubEnv('E2E_AUTH', '1')
    vi.stubEnv('NODE_ENV', 'production')
    const res = await handleTestLogin(req('free'))
    expect(res.status).toBe(404)
    expect(jar.values.size).toBe(0)
  })

  it('400s on an unknown user and creates nothing', async () => {
    enable()
    for (const bad of [undefined, 'admin']) {
      const res = await handleTestLogin(req(bad))
      expect(res.status).toBe(400)
    }
    expect(jar.values.size).toBe(0)
  })
})

describe('handleTestLogin with db=off', () => {
  it('sets a valid session cookie without creating any rows', async () => {
    enable()
    const res = await handleTestLogin(req('free', '&db=off'))
    expect(res.status).toBe(302)
    expect(unsealSession(jar.values.get(SESSION_COOKIE) ?? '')).toBe(
      DB_OFF_USER_ID,
    )
    const rows = await testDb
      .select()
      .from(users)
      .where(eq(users.bufferAccountId, 'e2e_free'))
    expect(rows).toHaveLength(0)
  })

  it('is still off without E2E_AUTH', async () => {
    const res = await handleTestLogin(req('free', '&db=off'))
    expect(res.status).toBe(404)
    expect(jar.values.size).toBe(0)
  })
})
