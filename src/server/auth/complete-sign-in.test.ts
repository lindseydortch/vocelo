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
import { bufferConnections, users } from '~/db/schema'
import { setClock } from '~/lib/clock'
import { server } from '~/test/msw'
import { createTestSql } from '~/test/db'
import { BUFFER_GRAPHQL_URL } from '~/server/buffer/client'

const mocks = vi.hoisted(() => ({
  setSessionUser: vi.fn(),
  ensureSamplePost: vi.fn(async () => {}),
}))
vi.mock('./session', () => ({ setSessionUser: mocks.setSessionUser }))
vi.mock('~/server/posts/sample-post', () => ({
  ensureSamplePost: mocks.ensureSamplePost,
}))
vi.mock('~/server/env', () => ({
  env: { TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') },
}))

const sql = createTestSql()
const testDb = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return testDb
  },
}))

const { completeSignIn, AccountLookupError } =
  await import('./complete-sign-in')
const { decryptToken } = await import('./crypto')

const ACCOUNT = 'acct_73'
const tokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 3600,
  scope: 'account:read posts:read posts:write offline_access',
}

type Account = {
  id: string
  email: string
  name: string
  timezone: string | null
  organizations: { id: string; name: string; ownerEmail: string }[]
}
const account = (over: Partial<Account> = {}): Account => ({
  id: ACCOUNT,
  email: 'me@example.test',
  name: 'Me',
  timezone: 'America/Chicago',
  organizations: [{ id: 'org_1', name: 'Mine', ownerEmail: 'me@example.test' }],
  ...over,
})
const respondWith = (a: Account) =>
  server.use(
    http.post(BUFFER_GRAPHQL_URL, () =>
      HttpResponse.json({ data: { account: a } }),
    ),
  )

const userRow = async () =>
  await testDb.select().from(users).where(eq(users.bufferAccountId, ACCOUNT))
const connectionRow = async (userId: string) =>
  (
    await testDb
      .select()
      .from(bufferConnections)
      .where(eq(bufferConnections.userId, userId))
  )[0]

beforeEach(() => {
  mocks.setSessionUser.mockClear()
  mocks.ensureSamplePost.mockClear()
})
afterEach(async () => {
  await testDb.delete(users).where(eq(users.bufferAccountId, ACCOUNT))
})
afterAll(async () => {
  await sql.end()
})

describe('completeSignIn', () => {
  it('creates a Free user with encrypted tokens, sets the session, ensures the sample post', async () => {
    const at = new Date('2026-01-01T00:00:00Z')
    setClock(() => at)
    respondWith(account())

    const { userId } = await completeSignIn(tokens)

    const [user] = await userRow()
    expect(user).toMatchObject({
      id: userId,
      plan: 'free',
      email: 'me@example.test',
      bufferOrganizationId: 'org_1',
      timezone: 'America/Chicago',
    })
    const conn = await connectionRow(userId)
    expect(conn?.accessTokenEnc).not.toContain('access-1')
    expect(decryptToken(conn!.accessTokenEnc)).toBe('access-1')
    expect(decryptToken(conn!.refreshTokenEnc!)).toBe('refresh-1')
    expect(conn?.accessExpiresAt).toEqual(new Date(at.getTime() + 3600_000))
    expect(conn?.scopes).toBe(tokens.scope)
    expect(mocks.setSessionUser).toHaveBeenCalledWith(userId)
    expect(mocks.ensureSamplePost).toHaveBeenCalledWith(userId)
  })

  it('refreshes a returning user and keeps plan and Stripe fields', async () => {
    respondWith(account())
    const { userId } = await completeSignIn(tokens)
    await testDb
      .update(users)
      .set({
        plan: 'creator',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        subscriptionStatus: 'active',
      })
      .where(eq(users.id, userId))

    respondWith(
      account({
        email: 'new@example.test',
        timezone: 'Europe/Paris',
        organizations: [
          { id: 'org_2', name: 'New', ownerEmail: 'new@example.test' },
        ],
      }),
    )
    const again = await completeSignIn({ ...tokens, accessToken: 'access-2' })

    expect(again.userId).toBe(userId)
    const rows = await userRow()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      plan: 'creator',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'active',
      email: 'new@example.test',
      timezone: 'Europe/Paris',
      bufferOrganizationId: 'org_2',
    })
    expect(decryptToken((await connectionRow(userId))!.accessTokenEnc)).toBe(
      'access-2',
    )
  })

  it('two concurrent sign-ins produce one user row', async () => {
    respondWith(account())
    const [a, b] = await Promise.all([
      completeSignIn(tokens),
      completeSignIn(tokens),
    ])
    expect(a.userId).toBe(b.userId)
    expect(await userRow()).toHaveLength(1)
  })

  it('picks the org the user owns, else the first', async () => {
    respondWith(
      account({
        organizations: [
          { id: 'org_a', name: 'A', ownerEmail: 'boss@example.test' },
          { id: 'org_b', name: 'B', ownerEmail: 'me@example.test' },
        ],
      }),
    )
    await completeSignIn(tokens)
    expect((await userRow())[0]?.bufferOrganizationId).toBe('org_b')

    respondWith(
      account({
        organizations: [
          { id: 'org_a', name: 'A', ownerEmail: 'boss@example.test' },
          { id: 'org_c', name: 'C', ownerEmail: 'other@example.test' },
        ],
      }),
    )
    await completeSignIn(tokens)
    expect((await userRow())[0]?.bufferOrganizationId).toBe('org_a')
  })

  it('throws AccountLookupError and writes nothing when the account query fails', async () => {
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    await expect(completeSignIn(tokens)).rejects.toBeInstanceOf(
      AccountLookupError,
    )
    expect(await userRow()).toHaveLength(0)
    expect(mocks.setSessionUser).not.toHaveBeenCalled()
  })

  it('throws AccountLookupError when the account has no organizations', async () => {
    respondWith(account({ organizations: [] }))
    await expect(completeSignIn(tokens)).rejects.toBeInstanceOf(
      AccountLookupError,
    )
    expect(await userRow()).toHaveLength(0)
  })
})
