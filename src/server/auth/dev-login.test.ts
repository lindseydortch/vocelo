import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { http, HttpResponse } from 'msw'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { users } from '~/db/schema'
import { createTestSql } from '~/test/db'
import { server } from '~/test/msw'
import { BUFFER_GRAPHQL_URL } from '~/server/buffer/client'

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
vi.mock('~/server/env', () => ({
  env: {
    SESSION_SECRET: 'dev-login-test-secret',
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  },
}))
const sql = createTestSql()
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
const { getSessionUser } = await import('./session')
const { decryptToken } = await import('./crypto')
const { handleDevLogin } = await import('./dev-login')

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('BUFFER_API_KEY', 'personal-key-79')
})
afterEach(async () => {
  vi.unstubAllEnvs()
  jar.clear()
  await testDb.delete(users).where(eq(users.bufferAccountId, 'acct_dev_79'))
})
afterAll(async () => {
  await sql.end()
})

function accountResponse() {
  server.use(
    http.post(BUFFER_GRAPHQL_URL, ({ request }) => {
      expect(request.headers.get('authorization')).toBe(
        'Bearer personal-key-79',
      )
      return HttpResponse.json({
        data: {
          account: {
            id: 'acct_dev_79',
            email: 'dev@example.test',
            timezone: 'America/Chicago',
            organizations: [
              { id: 'org_dev_79', ownerEmail: 'dev@example.test' },
            ],
          },
        },
      })
    }),
  )
}

describe('/__dev/login', () => {
  it.each([undefined, ''])(
    '404s without a usable personal key (%s)',
    async (key) => {
      vi.stubEnv('BUFFER_API_KEY', key)
      expect((await handleDevLogin()).status).toBe(404)
      expect(jar.size).toBe(0)
    },
  )

  it('404s in production even with a personal key', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect((await handleDevLogin()).status).toBe(404)
    expect(jar.size).toBe(0)
  })

  it('signs in a Free account with an encrypted non-expiring personal key', async () => {
    accountResponse()
    const response = await handleDevLogin()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/app')
    const signedIn = await getSessionUser()
    expect(signedIn?.user).toMatchObject({
      bufferAccountId: 'acct_dev_79',
      plan: 'free',
      email: 'dev@example.test',
      bufferOrganizationId: 'org_dev_79',
    })
    expect(signedIn?.connection).toMatchObject({
      refreshTokenEnc: null,
      accessExpiresAt: null,
    })
    expect(signedIn?.connection.accessTokenEnc).not.toContain('personal-key-79')
    expect(decryptToken(signedIn!.connection.accessTokenEnc)).toBe(
      'personal-key-79',
    )
  })

  it('reuses the Buffer account and preserves its paid plan when replacing OAuth tokens', async () => {
    accountResponse()
    const { completeSignIn } = await import('./complete-sign-in')
    const { userId } = await completeSignIn({
      accessToken: 'personal-key-79',
      refreshToken: 'old-refresh',
      expiresIn: 3600,
      scope: 'offline_access',
    })
    await testDb
      .update(users)
      .set({
        plan: 'creator',
        subscriptionStatus: 'active',
        stripeCustomerId: 'cus_dev_79',
      })
      .where(eq(users.id, userId))
    jar.clear()
    await handleDevLogin()
    const signedIn = await getSessionUser()
    expect(signedIn?.user).toMatchObject({
      id: userId,
      plan: 'creator',
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_dev_79',
    })
    expect(signedIn?.connection).toMatchObject({
      refreshTokenEnc: null,
      accessExpiresAt: null,
    })
  })

  it('does not sign in or persist an account when Buffer rejects the key', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 401 }),
      ),
    )
    await expect(handleDevLogin()).rejects.toMatchObject({ reason: 'account' })
    expect(await getSessionUser()).toBeNull()
    expect(
      await testDb
        .select()
        .from(users)
        .where(eq(users.bufferAccountId, 'acct_dev_79')),
    ).toEqual([])
  })
})
