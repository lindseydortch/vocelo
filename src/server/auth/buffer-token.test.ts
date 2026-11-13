import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { http, HttpResponse } from 'msw'
import { afterAll, expect, it, vi } from 'vitest'
import { bufferConnections } from '~/db/schema'
import { testDatabaseUrl } from '~/test/db'
import { createTestUser } from '~/test/factories'
import { server } from '~/test/msw'

vi.mock('~/server/env', () => ({
  env: {
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    BUFFER_CLIENT_ID: 'test-client',
    BUFFER_CLIENT_SECRET: 'test-secret',
  },
}))
const sql = postgres(testDatabaseUrl(), { max: 3, prepare: false })
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))
const { encryptToken, decryptToken } = await import('./crypto')
const { getBufferAccessToken } = await import('./buffer-token')
afterAll(() => sql.end())

it('serializes concurrent refreshes and stores encrypted rotated tokens', async () => {
  const user = await createTestUser()
  await testDb.insert(bufferConnections).values({
    userId: user.id,
    accessTokenEnc: encryptToken('old-access'),
    refreshTokenEnc: encryptToken('old-refresh'),
    accessExpiresAt: new Date(0),
  })
  let requests = 0
  server.use(
    http.post('https://auth.buffer.com/token', async ({ request }) => {
      requests++
      const body = new URLSearchParams(await request.text())
      expect(body.get('refresh_token')).toBe('old-refresh')
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('client_id')).toBe('test-client')
      expect(body.get('client_secret')).toBe('test-secret')
      return HttpResponse.json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      })
    }),
  )
  expect(
    await Promise.all([
      getBufferAccessToken(user.id),
      getBufferAccessToken(user.id),
    ]),
  ).toEqual(['new-access', 'new-access'])
  expect(requests).toBe(1)
  const [row] = await testDb
    .select()
    .from(bufferConnections)
    .where(eq(bufferConnections.userId, user.id))
  expect(row!.accessTokenEnc).not.toBe('new-access')
  expect(decryptToken(row!.accessTokenEnc)).toBe('new-access')
  expect(decryptToken(row!.refreshTokenEnc!)).toBe('new-refresh')
})

async function connection(
  overrides: Partial<typeof bufferConnections.$inferInsert> = {},
) {
  const user = await createTestUser()
  await testDb.insert(bufferConnections).values({
    userId: user.id,
    accessTokenEnc: encryptToken('old-access'),
    refreshTokenEnc: encryptToken('old-refresh'),
    accessExpiresAt: new Date(0),
    ...overrides,
  })
  return user.id
}
async function stored(userId: string) {
  return testDb
    .select()
    .from(bufferConnections)
    .where(eq(bufferConnections.userId, userId))
}

it('reuses a fresh token and refreshes when forced', async () => {
  const id = await connection({
    accessExpiresAt: new Date(Date.now() + 3600_000),
  })
  expect(await getBufferAccessToken(id)).toBe('old-access')
  server.use(
    http.post('https://auth.buffer.com/token', () =>
      HttpResponse.json({
        access_token: 'forced',
        refresh_token: 'rotated',
        expires_in: 3600,
      }),
    ),
  )
  expect(await getBufferAccessToken(id, { force: true })).toBe('forced')
})

it('returns non-expiring personal API keys without refresh', async () => {
  const id = await connection({ accessExpiresAt: null, refreshTokenEnc: null })
  expect(await getBufferAccessToken(id)).toBe('old-access')
})

it.each([400, 401, 403, 429])(
  'deletes a dead connection on HTTP %s',
  async (status) => {
    const id = await connection()
    server.use(
      http.post('https://auth.buffer.com/token', () =>
        HttpResponse.json({ error: 'invalid_grant' }, { status }),
      ),
    )
    await expect(getBufferAccessToken(id)).rejects.toMatchObject({
      code: 'BUFFER_AUTH_EXPIRED',
    })
    expect(await stored(id)).toHaveLength(0)
  },
)

it.each([
  { refreshTokenEnc: null },
  { refreshTokenEnc: 'corrupt' },
  { accessTokenEnc: 'corrupt' },
])('deletes unusable credentials: %j', async (overrides) => {
  const id = await connection(overrides)
  await expect(getBufferAccessToken(id)).rejects.toMatchObject({
    code: 'BUFFER_AUTH_EXPIRED',
  })
  expect(await stored(id)).toHaveLength(0)
})

it('reports missing connections as expired', async () => {
  const user = await createTestUser()
  await expect(getBufferAccessToken(user.id)).rejects.toMatchObject({
    code: 'BUFFER_AUTH_EXPIRED',
  })
})

it('treats invalid_grant in a successful HTTP response as expired', async () => {
  const id = await connection()
  server.use(
    http.post('https://auth.buffer.com/token', () =>
      HttpResponse.json({ error: 'invalid_grant' }),
    ),
  )
  await expect(getBufferAccessToken(id)).rejects.toMatchObject({
    code: 'BUFFER_AUTH_EXPIRED',
  })
  expect(await stored(id)).toHaveLength(0)
})

it.each(['network', 'server', 'malformed'])(
  'preserves credentials on a temporary %s failure',
  async (failure) => {
    const id = await connection()
    const before = await stored(id)
    server.use(
      http.post('https://auth.buffer.com/token', () => {
        if (failure === 'network') return HttpResponse.error()
        if (failure === 'server') return new HttpResponse(null, { status: 503 })
        return HttpResponse.json({ access_token: 'incomplete' })
      }),
    )
    await expect(getBufferAccessToken(id)).rejects.toMatchObject({
      name: 'BufferTemporaryError',
    })
    expect(await stored(id)).toEqual(before)
  },
)

it('aborts refresh after ten seconds and preserves credentials', async () => {
  const id = await connection()
  const before = await stored(id)
  server.use(
    http.post(
      'https://auth.buffer.com/token',
      ({ request }) =>
        new Promise<Response>((_, reject) => {
          request.signal.addEventListener(
            'abort',
            () => reject(request.signal.reason),
            { once: true },
          )
        }),
    ),
  )
  await expect(getBufferAccessToken(id)).rejects.toMatchObject({
    name: 'BufferTemporaryError',
  })
  expect(await stored(id)).toEqual(before)
})
