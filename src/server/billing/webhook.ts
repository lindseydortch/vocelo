import '@tanstack/react-start/server-only'
import type Stripe from 'stripe'
import { db } from '~/db/client'
import { stripeEvents } from '~/db/schema'
import { logError, newRequestId } from '~/lib/request-id'
import { env } from '~/server/env'
import { applySubscription } from './apply-subscription'
import { stripe } from './stripe'

const id = (ref: string | { id: string } | null | undefined) =>
  typeof ref === 'string' ? ref : (ref?.id ?? null)

/** The subscription an event is about, or null if it has none (or isn't one we handle). */
function subscriptionIdOf(event: Stripe.Event): string | null {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return event.data.object.id
    case 'checkout.session.completed':
      return id(event.data.object.subscription)
    case 'invoice.paid':
    case 'invoice.payment_failed':
      return id(event.data.object.parent?.subscription_details?.subscription)
    default:
      return null
  }
}

/**
 * Verifies the signature on the raw body, then applies the event's subscription.
 * The `stripe_events` row and the user update share one transaction: a seen
 * event ID is skipped, and any error rolls both back so Stripe retries (500).
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature')
  const body = await request.text()

  let event: Stripe.Event
  try {
    if (!signature) throw new Error('missing signature')
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const subscriptionId = subscriptionIdOf(event)
  if (!subscriptionId) return new Response('Ignored')

  try {
    await db.transaction(async (tx) => {
      // A concurrent delivery of the same event waits here for the first to commit.
      const inserted = await tx
        .insert(stripeEvents)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ id: stripeEvents.id })
      if (inserted.length === 0) return // already processed
      await applySubscription(subscriptionId, tx)
    })
  } catch (error) {
    logError(newRequestId(), error)
    return new Response('Processing failed', { status: 500 })
  }
  return new Response('ok')
}
