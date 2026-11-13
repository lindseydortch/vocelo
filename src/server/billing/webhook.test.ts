import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import Stripe from 'stripe'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { stripeEvents, users } from '~/db/schema'
import { freezeTime } from '~/test/clock'
import { createTestSql } from '~/test/db'
import { createTestUser, resetFactoryData } from '~/test/factories'
import {
  stripeSubscription,
  stripeSubscriptionHandlers,
  type MockSubscription,
} from '~/test/handlers/stripe'
import { server } from '~/test/msw'

const SECRET = 'whsec_test_secret'
const sql = createTestSql()
const db = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return db
  },
}))
vi.mock('~/server/env', () => ({
  env: { STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: SECRET },
}))
const { handleStripeWebhook } = await import('./webhook')

afterAll(async () => {
  await resetFactoryData()
  await sql.end()
})

const subs = new Map<string, MockSubscription>()
let retrieveCalls: string[]
beforeEach(() => {
  subs.clear()
  const mock = stripeSubscriptionHandlers(subs)
  retrieveCalls = mock.retrieveCalls
  server.use(...mock.handlers)
  freezeTime('2026-11-13T12:00:00Z')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

let counter = 0
/** A signed webhook request for a fixture, with its placeholder IDs made unique. */
function signed(
  fixture: string,
  ids: { sub: string; customer: string; user?: string; event?: string },
  opts: { signature?: string; secret?: string; body?: string } = {},
) {
  const body =
    opts.body ??
    readFileSync(`src/test/fixtures/stripe-events/${fixture}.json`, 'utf8')
      .replaceAll('sub_fixture', ids.sub)
      .replaceAll('cus_fixture', ids.customer)
      .replaceAll('user_fixture', ids.user ?? 'none')
      .replaceAll('evt_fixture', ids.event ?? `evt_${++counter}_${ids.sub}`)
  const signature =
    opts.signature ??
    new Stripe('sk_test_dummy').webhooks.generateTestHeaderString({
      payload: body,
      secret: opts.secret ?? SECRET,
    })
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  })
}

/** A Free user with a Stripe customer, plus unique sub/customer IDs. */
async function freeWithCustomer() {
  const user = await createTestUser({ plan: 'free' })
  const customer = `cus_${user.id}`
  const sub = `sub_${user.id}`
  await db
    .update(users)
    .set({ stripeCustomerId: customer })
    .where(eq(users.id, user.id))
  return { user, customer, sub }
}
const row = async (id: string) =>
  (await db.select().from(users).where(eq(users.id, id)))[0]!
const eventRow = async (id: string) =>
  (await db.select().from(stripeEvents).where(eq(stripeEvents.id, id)))[0]

describe('handleStripeWebhook', () => {
  it('rejects an invalid signature with 400 and changes nothing', async () => {
    const { user, customer, sub } = await freeWithCustomer()
    subs.set(sub, stripeSubscription({ id: sub, customer }))

    const res = await handleStripeWebhook(
      signed(
        'customer.subscription.updated',
        { sub, customer },
        {
          secret: 'whsec_wrong',
        },
      ),
    )

    expect(res.status).toBe(400)
    expect((await row(user.id)).stripeSubscriptionId).toBeNull()
    expect(retrieveCalls).toEqual([])
  })

  it('rejects a missing signature header with 400', async () => {
    const { customer, sub } = await freeWithCustomer()
    const req = signed('customer.subscription.updated', { sub, customer })
    req.headers.delete('stripe-signature')
    expect((await handleStripeWebhook(req)).status).toBe(400)
  })

  it('rejects a body altered after signing', async () => {
    const { customer, sub } = await freeWithCustomer()
    const good = signed('customer.subscription.updated', { sub, customer })
    const tampered = new Request(good.url, {
      method: 'POST',
      headers: good.headers,
      body: (await good.text()).replace('"active"', '"canceled"'),
    })
    expect((await handleStripeWebhook(tampered)).status).toBe(400)
  })

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'checkout.session.completed',
    'invoice.paid',
    'invoice.payment_failed',
  ])('%s: re-fetches the subscription and applies it', async (fixture) => {
    const { user, customer, sub } = await freeWithCustomer()
    subs.set(sub, stripeSubscription({ id: sub, customer }))

    const res = await handleStripeWebhook(
      signed(fixture, {
        sub,
        customer,
        user: user.id,
        event: `evt_${fixture}_${sub}`,
      }),
    )

    expect(res.status).toBe(200)
    expect(retrieveCalls).toEqual([sub])
    expect(await row(user.id)).toMatchObject({
      stripeSubscriptionId: sub,
      subscriptionStatus: 'active',
    })
    expect(await eventRow(`evt_${fixture}_${sub}`)).toMatchObject({
      type: fixture,
    })
  })

  it('customer.subscription.deleted: applies the canceled subscription', async () => {
    const { user, customer, sub } = await freeWithCustomer()
    await db
      .update(users)
      .set({ stripeSubscriptionId: sub, subscriptionStatus: 'active' })
      .where(eq(users.id, user.id))
    subs.set(
      sub,
      stripeSubscription({
        id: sub,
        customer,
        status: 'canceled',
        ended_at: 1_761_000_000,
      }),
    )

    const res = await handleStripeWebhook(
      signed('customer.subscription.deleted', { sub, customer }),
    )

    expect(res.status).toBe(200)
    expect(await row(user.id)).toMatchObject({ subscriptionStatus: 'canceled' })
  })

  it('past_due via invoice.payment_failed keeps the subscription row current', async () => {
    const { user, customer, sub } = await freeWithCustomer()
    subs.set(sub, stripeSubscription({ id: sub, customer, status: 'past_due' }))

    await handleStripeWebhook(
      signed('invoice.payment_failed', { sub, customer }),
    )

    expect((await row(user.id)).subscriptionStatus).toBe('past_due')
  })

  it.each([
    'charge.refunded',
    'checkout.session.completed.payment',
    'invoice.paid.no-subscription',
  ])('%s: 200 ignored, no fetch, no event row', async (fixture) => {
    const { user, customer, sub } = await freeWithCustomer()
    const event = `evt_ignored_${fixture}_${sub}`
    const res = await handleStripeWebhook(
      signed(fixture, { sub, customer, event }),
    )
    expect(res.status).toBe(200)
    expect(retrieveCalls).toEqual([])
    expect(await eventRow(event)).toBeUndefined()
    expect((await row(user.id)).stripeSubscriptionId).toBeNull()
  })

  it('finds the user by metadata.userId when no customer is stored yet', async () => {
    const user = await createTestUser({ plan: 'free' })
    const customer = `cus_new_${user.id}`
    const sub = `sub_${user.id}`
    subs.set(
      sub,
      stripeSubscription({ id: sub, customer, metadata: { userId: user.id } }),
    )

    const res = await handleStripeWebhook(
      signed('customer.subscription.created', { sub, customer, user: user.id }),
    )

    expect(res.status).toBe(200)
    expect((await row(user.id)).stripeSubscriptionId).toBe(sub)
  })

  it('unknown customer: 200 ignored, nothing written', async () => {
    const sub = 'sub_unknown_1'
    subs.set(sub, stripeSubscription({ id: sub, customer: 'cus_unknown_1' }))
    const res = await handleStripeWebhook(
      signed('customer.subscription.updated', {
        sub,
        customer: 'cus_unknown_1',
        event: 'evt_unknown_1',
      }),
    )
    expect(res.status).toBe(200)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('no user'),
      expect.anything(),
    )
  })

  it('metadata and customer disagree: the customer ID wins, logged', async () => {
    const owner = await freeWithCustomer()
    const other = await createTestUser({ plan: 'free' })
    subs.set(
      owner.sub,
      stripeSubscription({
        id: owner.sub,
        customer: owner.customer,
        metadata: { userId: other.id },
      }),
    )

    const res = await handleStripeWebhook(
      signed('customer.subscription.updated', {
        sub: owner.sub,
        customer: owner.customer,
        user: other.id,
      }),
    )

    expect(res.status).toBe(200)
    expect((await row(owner.user.id)).stripeSubscriptionId).toBe(owner.sub)
    expect((await row(other.id)).stripeSubscriptionId).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('disagree'),
      expect.anything(),
    )
  })

  it('a repeated event ID: 200, no second fetch or update', async () => {
    const { user, customer, sub } = await freeWithCustomer()
    subs.set(sub, stripeSubscription({ id: sub, customer }))
    const ids = { sub, customer, event: `evt_dup_${sub}` }
    expect(
      (await handleStripeWebhook(signed('customer.subscription.updated', ids)))
        .status,
    ).toBe(200)

    // Stripe state moves on; a replay of the old event must not re-apply it.
    subs.set(sub, stripeSubscription({ id: sub, customer, status: 'past_due' }))
    const again = await handleStripeWebhook(
      signed('customer.subscription.updated', ids),
    )

    expect(again.status).toBe(200)
    expect(retrieveCalls).toEqual([sub])
    expect((await row(user.id)).subscriptionStatus).toBe('active')
  })

  it('two simultaneous deliveries of one event apply once', async () => {
    const { customer, sub } = await freeWithCustomer()
    subs.set(sub, stripeSubscription({ id: sub, customer }))
    const ids = { sub, customer, event: `evt_race_${sub}` }
    const results = await Promise.all([
      handleStripeWebhook(signed('customer.subscription.updated', ids)),
      handleStripeWebhook(signed('customer.subscription.updated', ids)),
    ])
    expect(results.map((r) => r.status)).toEqual([200, 200])
    expect(retrieveCalls).toEqual([sub])
  })

  it('a processing error: 500 and no stripe_events row, so Stripe retries', async () => {
    const { user, customer, sub } = await freeWithCustomer()
    // sub is not in the Stripe mock → fetch 404 → BillingError
    const event = `evt_fail_${sub}`
    const res = await handleStripeWebhook(
      signed('customer.subscription.updated', { sub, customer, event }),
    )
    expect(res.status).toBe(500)
    expect(await eventRow(event)).toBeUndefined()

    // The retry succeeds once Stripe has the subscription.
    subs.set(sub, stripeSubscription({ id: sub, customer }))
    const retry = await handleStripeWebhook(
      signed('customer.subscription.updated', { sub, customer, event }),
    )
    expect(retry.status).toBe(200)
    expect((await row(user.id)).stripeSubscriptionId).toBe(sub)
    expect(await eventRow(event)).toBeDefined()
  })

  it('a database failure after the event insert rolls the event row back', async () => {
    const { customer, sub } = await freeWithCustomer()
    // Subscription with no items makes applySubscription throw inside the transaction.
    subs.set(sub, {
      ...stripeSubscription({ id: sub, customer }),
      items: { object: 'list', data: [] },
    })
    const event = `evt_rollback_${sub}`
    const res = await handleStripeWebhook(
      signed('customer.subscription.updated', { sub, customer, event }),
    )
    expect(res.status).toBe(500)
    expect(await eventRow(event)).toBeUndefined()
  })
})
