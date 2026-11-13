import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { now } from '~/lib/clock'
import { newRequestId } from '~/lib/request-id'
import { PAID_STATUSES as PAID } from '../plan'
import { toBillingError } from './customer'
import { stripe } from './stripe'

type User = typeof users.$inferSelect

/** Statuses that end a paid period and start a fresh Free one. */
const ENDED = ['canceled', 'unpaid', 'paused', 'incomplete_expired']

const fromUnix = (seconds: number) => new Date(seconds * 1000)

async function fetchSubscription(id: string): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.retrieve(id)
  } catch (error) {
    throw toBillingError(error, 'subscription')
  }
}

/** `metadata.userId` first, then the customer ID. On disagreement the customer ID wins. */
async function findUser(
  tx: Pick<typeof db, 'select'>,
  sub: Stripe.Subscription,
  requestId: string,
): Promise<User | undefined> {
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const metadataId = sub.metadata?.userId
  const lock = (where: ReturnType<typeof eq>) =>
    tx.select().from(users).where(where).for('update')

  const [byMetadata] = metadataId ? await lock(eq(users.id, metadataId)) : []
  if (byMetadata?.stripeCustomerId === customerId) return byMetadata

  const [byCustomer] = await lock(eq(users.stripeCustomerId, customerId))
  if (byCustomer && byMetadata) {
    console.warn('[billing] metadata userId and customer disagree', {
      requestId,
      subscriptionId: sub.id,
      metadataUserId: byMetadata.id,
      customerUserId: byCustomer.id,
    })
  }
  return byCustomer ?? byMetadata
}

/**
 * The only writer of the user's subscription columns. Always re-fetches the
 * subscription from Stripe (never trusts an event payload), so a late or
 * out-of-order event can't roll state back. Returns whether a user row was
 * updated; false for an ignored, unmatched, `incomplete` or duplicate
 * subscription.
 */
export async function applySubscription(
  subscriptionId: string,
): Promise<boolean> {
  const sub = await fetchSubscription(subscriptionId)
  const requestId = newRequestId()
  const paid = PAID.includes(sub.status)
  const ended = ENDED.includes(sub.status)
  if (!paid && !ended) return false // incomplete: no change

  return db.transaction(async (tx) => {
    const user = await findUser(tx, sub, requestId)
    if (!user) {
      console.warn('[billing] no user for subscription, ignored', {
        requestId,
        subscriptionId: sub.id,
      })
      return false
    }

    const stored = user.stripeSubscriptionId
    if (
      stored &&
      stored !== sub.id &&
      PAID.includes(user.subscriptionStatus ?? '')
    ) {
      // A different subscription is already live. Never overwrite it; fix by hand.
      if (paid) {
        console.error('[billing] duplicate active subscription', {
          requestId,
          userId: user.id,
          storedSubscriptionId: stored,
          incomingSubscriptionId: sub.id,
        })
      }
      return false
    }

    const item = sub.items.data[0]
    if (!item) throw new Error(`Subscription ${sub.id} has no items`)

    // Reset the Free period only when the stored subscription itself leaves the paid set.
    const justEnded =
      ended && stored === sub.id && PAID.includes(user.subscriptionStatus ?? '')
    await tx
      .update(users)
      .set({
        stripeSubscriptionId: sub.id,
        subscriptionStatus: sub.status,
        currentPeriodStart: fromUnix(item.current_period_start),
        currentPeriodEnd: fromUnix(item.current_period_end),
        cancelAtPeriodEnd: sub.cancel_at != null || sub.cancel_at_period_end,
        ...(justEnded && {
          periodAnchorAt: sub.ended_at ? fromUnix(sub.ended_at) : now(),
        }),
      })
      .where(eq(users.id, user.id))
    return true
  })
}
