import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { users } from '~/db/schema'
import { createTestSql } from '~/test/db'
import { freezeTime } from '~/test/clock'
import { createTestUser, resetFactoryData } from '~/test/factories'
import {
  stripeSubscription,
  stripeSubscriptionHandlers,
  type MockSubscription,
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
const { applySubscription } = await import('./apply-subscription')
const { BillingError } = await import('./customer')
const { getEffectivePlan, getUsagePeriod } = await import('../plan')

afterAll(async () => {
  await resetFactoryData()
  await sql.end()
})

const subs = new Map<string, MockSubscription>()
beforeEach(() => {
  subs.clear()
  server.use(...stripeSubscriptionHandlers(subs).handlers)
  freezeTime('2026-11-13T12:00:00Z')
})

const row = async (id: string) =>
  (await db.select().from(users).where(eq(users.id, id)))[0]!
const secs = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

/** A Free user with a Stripe customer and no subscription yet. */
async function freeWithCustomer() {
  const user = await createTestUser({ plan: 'free' })
  const customer = `cus_${user.id}`
  await db
    .update(users)
    .set({ stripeCustomerId: customer })
    .where(eq(users.id, user.id))
  return { user: await row(user.id), customer }
}

describe('applySubscription', () => {
  it('active: writes id, status and the item period; user becomes Creator', async () => {
    const { user, customer } = await freeWithCustomer()
    subs.set('sub_1', stripeSubscription({ id: 'sub_1', customer }))

    await applySubscription('sub_1')

    const after = await row(user.id)
    expect(after).toMatchObject({
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false,
    })
    expect(after.currentPeriodStart).toEqual(new Date(1_760_000_000 * 1000))
    expect(after.currentPeriodEnd).toEqual(new Date(1_762_592_000 * 1000))
    expect(getEffectivePlan(after)).toBe('creator')
    expect(after.periodAnchorAt).toEqual(user.periodAnchorAt)
  })

  it('finds the user by subscription.metadata.userId', async () => {
    const user = await createTestUser({ plan: 'free' })
    subs.set(
      'sub_m',
      stripeSubscription({
        id: 'sub_m',
        customer: 'cus_unknown',
        metadata: { userId: user.id },
      }),
    )

    await applySubscription('sub_m')

    expect((await row(user.id)).stripeSubscriptionId).toBe('sub_m')
  })

  it('metadata and customer disagree → trusts the customer, logs it', async () => {
    const { user, customer } = await freeWithCustomer()
    const other = await createTestUser({ plan: 'free' })
    subs.set(
      'sub_d',
      stripeSubscription({
        id: 'sub_d',
        customer,
        metadata: { userId: other.id },
      }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await applySubscription('sub_d')

    expect((await row(user.id)).stripeSubscriptionId).toBe('sub_d')
    expect((await row(other.id)).stripeSubscriptionId).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('disagree'),
      expect.anything(),
    )
    warn.mockRestore()
  })

  it('unknown customer and no metadata → ignored, returns false', async () => {
    subs.set(
      'sub_x',
      stripeSubscription({ id: 'sub_x', customer: 'cus_nobody' }),
    )
    expect(await applySubscription('sub_x')).toBe(false)
  })

  it('canceling: cancel_at set → cancelAtPeriodEnd true, still Creator', async () => {
    const { user, customer } = await freeWithCustomer()
    subs.set(
      'sub_c',
      stripeSubscription({ id: 'sub_c', customer, cancel_at: 1_762_592_000 }),
    )

    await applySubscription('sub_c')

    const after = await row(user.id)
    expect(after.cancelAtPeriodEnd).toBe(true)
    expect(getEffectivePlan(after)).toBe('creator')
  })

  it('cancel_at_period_end flag alone also sets cancelAtPeriodEnd', async () => {
    const { user, customer } = await freeWithCustomer()
    subs.set(
      'sub_f',
      stripeSubscription({ id: 'sub_f', customer, cancel_at_period_end: true }),
    )
    await applySubscription('sub_f')
    expect((await row(user.id)).cancelAtPeriodEnd).toBe(true)
  })

  it('past_due keeps Creator and the anchor', async () => {
    const { user, customer } = await freeWithCustomer()
    subs.set(
      'sub_p',
      stripeSubscription({ id: 'sub_p', customer, status: 'past_due' }),
    )

    await applySubscription('sub_p')

    const after = await row(user.id)
    expect(after.subscriptionStatus).toBe('past_due')
    expect(getEffectivePlan(after)).toBe('creator')
    expect(after.periodAnchorAt).toEqual(user.periodAnchorAt)
  })

  it('canceled: Free again, anchor = ended_at, fresh Free period starts then', async () => {
    const { user, customer } = await freeWithCustomer()
    const sub = stripeSubscription({ id: 'sub_e', customer })
    subs.set('sub_e', sub)
    await applySubscription('sub_e')

    subs.set('sub_e', {
      ...sub,
      status: 'canceled',
      ended_at: secs('2026-11-01T00:00:00Z'),
    })
    await applySubscription('sub_e')

    const after = await row(user.id)
    expect(getEffectivePlan(after)).toBe('free')
    expect(after.periodAnchorAt).toEqual(new Date('2026-11-01T00:00:00Z'))
    expect(getUsagePeriod(after, new Date('2026-11-13T12:00:00Z'))).toEqual({
      start: new Date('2026-11-01T00:00:00Z'),
      end: new Date('2026-12-01T00:00:00Z'),
    })
  })

  it.each(['unpaid', 'paused'])(
    '%s without ended_at: anchor = now',
    async (status) => {
      const { user, customer } = await freeWithCustomer()
      const sub = stripeSubscription({ id: `sub_${status}`, customer })
      subs.set(sub.id, sub)
      await applySubscription(sub.id)

      subs.set(sub.id, { ...sub, status })
      await applySubscription(sub.id)

      const after = await row(user.id)
      expect(getEffectivePlan(after)).toBe('free')
      expect(after.periodAnchorAt).toEqual(new Date('2026-11-13T12:00:00Z'))
    },
  )

  it('re-applying an already-canceled subscription does not move the anchor again', async () => {
    const { user, customer } = await freeWithCustomer()
    subs.set('sub_r', stripeSubscription({ id: 'sub_r', customer }))
    await applySubscription('sub_r')
    subs.set(
      'sub_r',
      stripeSubscription({
        id: 'sub_r',
        customer,
        status: 'canceled',
        ended_at: secs('2026-11-01T00:00:00Z'),
      }),
    )
    await applySubscription('sub_r')
    freezeTime('2026-11-20T00:00:00Z')

    await applySubscription('sub_r')

    expect((await row(user.id)).periodAnchorAt).toEqual(
      new Date('2026-11-01T00:00:00Z'),
    )
  })

  it('incomplete changes nothing', async () => {
    const { user, customer } = await freeWithCustomer()
    subs.set(
      'sub_i',
      stripeSubscription({ id: 'sub_i', customer, status: 'incomplete' }),
    )

    await applySubscription('sub_i')

    expect(await row(user.id)).toEqual(user)
  })

  it('always re-fetches: a stale event applied late cannot roll state back', async () => {
    const { user, customer } = await freeWithCustomer()
    const { retrieveCalls, handlers } = stripeSubscriptionHandlers(subs)
    server.use(...handlers)
    subs.set(
      'sub_s',
      stripeSubscription({ id: 'sub_s', customer, status: 'past_due' }),
    )
    // Stripe has since moved on to active; an old "past_due" event arrives afterwards.
    subs.set(
      'sub_s',
      stripeSubscription({ id: 'sub_s', customer, status: 'active' }),
    )

    await applySubscription('sub_s')

    expect((await row(user.id)).subscriptionStatus).toBe('active')
    expect(retrieveCalls).toEqual(['sub_s'])
  })

  describe('duplicate subscription', () => {
    it('a second active subscription is logged with a request ID and not stored', async () => {
      const { user, customer } = await freeWithCustomer()
      subs.set('sub_a', stripeSubscription({ id: 'sub_a', customer }))
      subs.set('sub_b', stripeSubscription({ id: 'sub_b', customer }))
      await applySubscription('sub_a')
      const before = await row(user.id)
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      const applied = await applySubscription('sub_b')

      expect(applied).toBe(false)
      expect(await row(user.id)).toEqual(before)
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('duplicate'),
        expect.objectContaining({
          requestId: expect.any(String),
          userId: user.id,
          storedSubscriptionId: 'sub_a',
          incomingSubscriptionId: 'sub_b',
        }),
      )
      error.mockRestore()
    })

    it('a different subscription that is not paid never overwrites the active one', async () => {
      const { user, customer } = await freeWithCustomer()
      subs.set('sub_a', stripeSubscription({ id: 'sub_a', customer }))
      subs.set(
        'sub_old',
        stripeSubscription({
          id: 'sub_old',
          customer,
          status: 'canceled',
          ended_at: secs('2026-11-01T00:00:00Z'),
        }),
      )
      await applySubscription('sub_a')
      const before = await row(user.id)

      await applySubscription('sub_old')

      expect(await row(user.id)).toEqual(before)
    })

    it('a new subscription replaces a stored one that already ended', async () => {
      const { user, customer } = await freeWithCustomer()
      subs.set('sub_old', stripeSubscription({ id: 'sub_old', customer }))
      await applySubscription('sub_old')
      subs.set(
        'sub_old',
        stripeSubscription({
          id: 'sub_old',
          customer,
          status: 'canceled',
          ended_at: secs('2026-11-01T00:00:00Z'),
        }),
      )
      await applySubscription('sub_old')
      subs.set('sub_new', stripeSubscription({ id: 'sub_new', customer }))

      await applySubscription('sub_new')

      const after = await row(user.id)
      expect(after.stripeSubscriptionId).toBe('sub_new')
      expect(getEffectivePlan(after)).toBe('creator')
    })
  })

  describe('errors', () => {
    it('unknown subscription → STRIPE_SUBSCRIPTION_MISSING', async () => {
      await expect(applySubscription('sub_nope')).rejects.toMatchObject({
        code: 'STRIPE_SUBSCRIPTION_MISSING',
      })
    })

    it('Stripe 5xx → STRIPE_UNAVAILABLE, nothing written', async () => {
      const { user } = await freeWithCustomer()
      const { http, HttpResponse } = await import('msw')
      server.use(
        http.get('https://api.stripe.com/v1/subscriptions/:id', () =>
          HttpResponse.json({ error: { type: 'api_error' } }, { status: 500 }),
        ),
      )

      const err = await applySubscription('sub_1').catch((e) => e)

      expect(err).toBeInstanceOf(BillingError)
      expect(err.code).toBe('STRIPE_UNAVAILABLE')
      expect(await row(user.id)).toEqual(user)
    })
  })
})
