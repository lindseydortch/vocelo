import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { http, HttpResponse } from 'msw'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { users } from '~/db/schema'
import { createTestSql } from '~/test/db'
import { createTestUser, resetFactoryData } from '~/test/factories'
import {
  STRIPE_API_URL,
  stripeCustomerHandlers,
  stripeError,
} from '~/test/handlers/stripe'
import { server } from '~/test/msw'

const sql = createTestSql()
const db = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return db
  },
}))
vi.mock('~/server/env', () => ({
  env: { STRIPE_SECRET_KEY: 'sk_test_dummy' },
}))
const { getOrCreateCustomer, BillingError } = await import('./customer')
const { STRIPE_API_VERSION } = await import('./stripe')

afterAll(async () => {
  await resetFactoryData()
  await sql.end()
})

const free = () => createTestUser({ plan: 'free' })
const storedId = async (id: string) =>
  (await db.select().from(users).where(eq(users.id, id)))[0]!.stripeCustomerId

describe('getOrCreateCustomer', () => {
  it('creates a customer with email + userId metadata and saves its ID', async () => {
    const user = await free()
    const { mock, handlers } = stripeCustomerHandlers()
    server.use(...handlers)

    const id = await getOrCreateCustomer(user)

    expect(id).toBe('cus_mock_1')
    expect(mock.createCalls).toEqual([
      { email: user.email!, 'metadata[userId]': user.id },
    ])
    expect(await storedId(user.id)).toBe(id)
  })

  it('omits email when the user has none', async () => {
    const user = { ...(await free()), email: null }
    const { mock, handlers } = stripeCustomerHandlers()
    server.use(...handlers)

    await getOrCreateCustomer(user)

    expect(mock.createCalls[0]).not.toHaveProperty('email')
  })

  it('reuses the stored customer with zero create calls', async () => {
    const user = await createTestUser({ plan: 'creator' })
    const { mock, handlers } = stripeCustomerHandlers()
    server.use(...handlers)

    const id = await getOrCreateCustomer(user)

    expect(id).toBe(user.stripeCustomerId)
    expect(mock.createCalls).toHaveLength(0)
    expect(mock.retrieveCalls).toEqual([user.stripeCustomerId])
  })

  it('concurrent first clicks save exactly one customer ID', async () => {
    const user = await free()
    const { mock, handlers } = stripeCustomerHandlers()
    server.use(...handlers)

    const ids = await Promise.all([
      getOrCreateCustomer(user),
      getOrCreateCustomer(user),
      getOrCreateCustomer(user),
    ])

    expect(new Set(ids).size).toBe(1)
    expect(await storedId(user.id)).toBe(ids[0])
    expect(mock.createCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('returns the already-saved ID when another request wins the save', async () => {
    const user = await free()
    const { handlers } = stripeCustomerHandlers()
    server.use(...handlers)
    // Simulates a racing request saving a different ID between create and save.
    server.use(
      http.post(`${STRIPE_API_URL}/v1/customers`, async () => {
        await db
          .update(users)
          .set({ stripeCustomerId: 'cus_winner' })
          .where(eq(users.id, user.id))
        return HttpResponse.json({ id: 'cus_loser', object: 'customer' })
      }),
    )

    expect(await getOrCreateCustomer(user)).toBe('cus_winner')
    expect(await storedId(user.id)).toBe('cus_winner')
  })

  it('pins the API version on every request', async () => {
    const user = await free()
    let version: string | null = null
    server.use(
      http.post(`${STRIPE_API_URL}/v1/customers`, ({ request }) => {
        version = request.headers.get('stripe-version')
        return HttpResponse.json({ id: 'cus_v', object: 'customer' })
      }),
    )

    await getOrCreateCustomer(user)

    expect(version).toBe(STRIPE_API_VERSION)
    expect(STRIPE_API_VERSION).toBe('2026-10-28.endive')
  })

  describe('errors', () => {
    it('resource_missing on a stored customer → STRIPE_CUSTOMER_MISSING', async () => {
      const user = await createTestUser({ plan: 'creator' })
      server.use(
        ...stripeCustomerHandlers({ missing: [user.stripeCustomerId!] })
          .handlers,
      )

      await expect(getOrCreateCustomer(user)).rejects.toMatchObject({
        name: 'BillingError',
        code: 'STRIPE_CUSTOMER_MISSING',
      })
    })

    it('a deleted stored customer → STRIPE_CUSTOMER_MISSING', async () => {
      const user = await createTestUser({ plan: 'creator' })
      server.use(
        ...stripeCustomerHandlers({ deleted: [user.stripeCustomerId!] })
          .handlers,
      )

      await expect(getOrCreateCustomer(user)).rejects.toBeInstanceOf(
        BillingError,
      )
    })

    it('5xx → STRIPE_UNAVAILABLE and nothing is saved', async () => {
      const user = await free()
      server.use(
        http.post(`${STRIPE_API_URL}/v1/customers`, () =>
          stripeError(503, 'api_error'),
        ),
      )

      await expect(getOrCreateCustomer(user)).rejects.toMatchObject({
        code: 'STRIPE_UNAVAILABLE',
      })
      expect(await storedId(user.id)).toBeNull()
    })

    it('network failure → STRIPE_UNAVAILABLE', async () => {
      const user = await free()
      server.use(
        http.post(`${STRIPE_API_URL}/v1/customers`, () => HttpResponse.error()),
      )

      await expect(getOrCreateCustomer(user)).rejects.toMatchObject({
        code: 'STRIPE_UNAVAILABLE',
      })
    })

    it('other Stripe errors pass through untyped', async () => {
      const user = await free()
      server.use(
        http.post(`${STRIPE_API_URL}/v1/customers`, () =>
          stripeError(400, 'invalid_request_error', 'email_invalid'),
        ),
      )

      const error = await getOrCreateCustomer(user).catch((e: unknown) => e)
      expect(error).not.toBeInstanceOf(BillingError)
      expect(error).toBeInstanceOf(Error)
    })
  })
})
