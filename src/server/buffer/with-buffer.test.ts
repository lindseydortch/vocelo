import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { http, HttpResponse } from 'msw'
import { afterAll, expect, it, vi } from 'vitest'
import { bufferConnections } from '~/db/schema'
import { testDatabaseUrl } from '~/test/db'
import { createTestUser } from '~/test/factories'
import { server } from '~/test/msw'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'

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
const clearSession = vi.fn()
vi.mock('~/server/auth/session', () => ({ clearSession }))
const { encryptToken } = await import('~/server/auth/crypto')
const { bufferRequest, BufferTemporaryError } = await import('./client')
const { withBuffer } = await import('./with-buffer')
afterAll(() => sql.end())

async function setup() {
  const user = await createTestUser()
  await testDb
    .insert(bufferConnections)
    .values({
      userId: user.id,
      accessTokenEnc: encryptToken('old'),
      refreshTokenEnc: encryptToken('refresh'),
      accessExpiresAt: new Date(Date.now() + 3600000),
    })
  clearSession.mockClear()
  server.use(
    http.post('https://auth.buffer.com/token', () =>
      HttpResponse.json({
        access_token: 'new',
        refresh_token: 'rotated',
        expires_in: 3600,
      }),
    ),
  )
  return user.id
}
const request = (token: string) =>
  bufferRequest<{ ok: boolean }>({ accessToken: token, query: 'query { ok }' })

it.each(['http', 'graphql'])(
  'refreshes after %s authentication failure and retries',
  async (kind) => {
    const id = await setup()
    let calls = 0
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () => {
        calls++
        if (calls === 1)
          return kind === 'http'
            ? new HttpResponse(null, { status: 401 })
            : HttpResponse.json({
                errors: [
                  { message: 'no', extensions: { code: 'UNAUTHORIZED' } },
                ],
              })
        return HttpResponse.json({ data: { ok: true } })
      }),
    )
    expect(await withBuffer(id, request)).toEqual({ ok: true })
    expect(calls).toBe(2)
    expect(clearSession).not.toHaveBeenCalled()
  },
)

it('deletes the connection and clears the session after two authentication failures', async () => {
  const id = await setup()
  server.use(
    http.post(
      BUFFER_GRAPHQL_URL,
      () => new HttpResponse(null, { status: 401 }),
    ),
  )
  await expect(withBuffer(id, request)).rejects.toMatchObject({
    code: 'BUFFER_AUTH_EXPIRED',
  })
  expect(
    await testDb
      .select()
      .from(bufferConnections)
      .where(eq(bufferConnections.userId, id)),
  ).toHaveLength(0)
  expect(clearSession).toHaveBeenCalledOnce()
})

it('passes rate limits through without clearing the connection', async () => {
  const id = await setup()
  server.use(
    http.post(
      BUFFER_GRAPHQL_URL,
      () => new HttpResponse(null, { status: 429 }),
    ),
  )
  await expect(withBuffer(id, request)).rejects.toBeInstanceOf(
    BufferTemporaryError,
  )
  expect(
    await testDb
      .select()
      .from(bufferConnections)
      .where(eq(bufferConnections.userId, id)),
  ).toHaveLength(1)
  expect(clearSession).not.toHaveBeenCalled()
})
