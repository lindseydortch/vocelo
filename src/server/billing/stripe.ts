import '@tanstack/react-start/server-only'
import Stripe from 'stripe'
import { env } from '~/server/env'

export const STRIPE_API_VERSION = '2026-10-28.endive'

let cached: Stripe | undefined

/** Lazy: the key is read on first use, so importing never throws when the env is incomplete. */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_t, key) {
    cached ??= new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      maxNetworkRetries: 0,
    })
    return Reflect.get(cached, key, cached)
  },
})
