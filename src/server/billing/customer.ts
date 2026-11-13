import '@tanstack/react-start/server-only'
import { and, eq, isNull } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { stripe } from './stripe'

export type BillingErrorCode =
  | 'STRIPE_CUSTOMER_MISSING'
  | 'STRIPE_SUBSCRIPTION_MISSING'
  | 'STRIPE_UNAVAILABLE'

/** Typed Stripe failure the UI can branch on via `code`. */
export class BillingError extends Error {
  constructor(
    readonly code: BillingErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'BillingError'
  }
}

export type CustomerUser = {
  id: string
  email: string | null
  stripeCustomerId: string | null
}

function isUnavailable(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeConnectionError) return true
  if (error instanceof Stripe.errors.StripeRateLimitError) return true
  return (
    error instanceof Stripe.errors.StripeError &&
    error.statusCode !== undefined &&
    error.statusCode >= 500
  )
}

/** Maps Stripe SDK errors to `BillingError`; anything else passes through. */
export function toBillingError(
  error: unknown,
  missing: 'customer' | 'subscription' = 'customer',
): unknown {
  if (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === 'resource_missing'
  ) {
    return missing === 'customer'
      ? new BillingError(
          'STRIPE_CUSTOMER_MISSING',
          'Stripe customer no longer exists',
          { cause: error },
        )
      : new BillingError(
          'STRIPE_SUBSCRIPTION_MISSING',
          'Stripe subscription no longer exists',
          { cause: error },
        )
  }
  if (isUnavailable(error)) {
    return new BillingError('STRIPE_UNAVAILABLE', 'Stripe is unavailable', {
      cause: error,
    })
  }
  return error
}

async function verifyStored(customerId: string): Promise<string> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) {
    throw new BillingError(
      'STRIPE_CUSTOMER_MISSING',
      'Stripe customer was deleted',
    )
  }
  return customer.id
}

/**
 * The user's Stripe customer ID. Reuses the stored one (verified to still
 * exist), else creates a customer and saves its ID. Concurrent first calls
 * share one Stripe customer (idempotency key) and one saved ID (conditional
 * update, first write wins).
 */
export async function getOrCreateCustomer(user: CustomerUser): Promise<string> {
  try {
    if (user.stripeCustomerId) return await verifyStored(user.stripeCustomerId)

    const created = await stripe.customers.create(
      {
        ...(user.email ? { email: user.email } : {}),
        metadata: { userId: user.id },
      },
      { idempotencyKey: `vocelo-customer-${user.id}` },
    )
    const [saved] = await db
      .update(users)
      .set({ stripeCustomerId: created.id })
      .where(and(eq(users.id, user.id), isNull(users.stripeCustomerId)))
      .returning({ stripeCustomerId: users.stripeCustomerId })
    if (saved?.stripeCustomerId) return saved.stripeCustomerId

    const [existing] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, user.id))
    return existing?.stripeCustomerId ?? created.id
  } catch (error) {
    throw toBillingError(error)
  }
}
