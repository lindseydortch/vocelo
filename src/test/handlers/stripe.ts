import { http, HttpResponse } from 'msw'

export const STRIPE_API_URL = 'https://api.stripe.com'

export type StripeCustomerMock = {
  /** Form-decoded bodies of every `POST /v1/customers`. */
  createCalls: Record<string, string>[]
  /** IDs of every `GET /v1/customers/:id`. */
  retrieveCalls: string[]
}

/** Stripe-shaped error body: `{ error: { type, code, message } }`. */
export function stripeError(
  status: number,
  type: string,
  code?: string,
  message = 'mock error',
) {
  return HttpResponse.json({ error: { type, code, message } }, { status })
}

/**
 * Customer endpoints. Creates mint `cus_mock_<n>`, honouring the idempotency
 * key like Stripe (same key → same customer). Retrieves echo the ID unless
 * `missing` / `deleted` lists it.
 */
export function stripeCustomerHandlers(
  opts: { missing?: string[]; deleted?: string[] } = {},
) {
  const mock: StripeCustomerMock = { createCalls: [], retrieveCalls: [] }
  const byKey = new Map<string, string>()
  let n = 0
  const handlers = [
    http.post(`${STRIPE_API_URL}/v1/customers`, async ({ request }) => {
      mock.createCalls.push(
        Object.fromEntries(new URLSearchParams(await request.text())),
      )
      const key = request.headers.get('idempotency-key')
      let id = key ? byKey.get(key) : undefined
      if (!id) {
        id = `cus_mock_${++n}`
        if (key) byKey.set(key, id)
      }
      return HttpResponse.json({ id, object: 'customer' })
    }),
    http.get(`${STRIPE_API_URL}/v1/customers/:id`, ({ params }) => {
      const id = String(params.id)
      mock.retrieveCalls.push(id)
      if (opts.missing?.includes(id)) {
        return stripeError(
          404,
          'invalid_request_error',
          'resource_missing',
          `No such customer: '${id}'`,
        )
      }
      if (opts.deleted?.includes(id)) {
        return HttpResponse.json({ id, object: 'customer', deleted: true })
      }
      return HttpResponse.json({ id, object: 'customer' })
    }),
  ]
  return { mock, handlers }
}

export type MockSubscription = {
  id: string
  object: 'subscription'
  customer: string
  status: string
  cancel_at: number | null
  cancel_at_period_end: boolean
  ended_at: number | null
  metadata: Record<string, string>
  items: {
    object: 'list'
    data: { current_period_start: number; current_period_end: number }[]
  }
}

/** A Stripe-shaped subscription; period times are unix seconds, as Stripe sends them. */
export function stripeSubscription(
  overrides: Partial<MockSubscription> & { id: string; customer: string },
): MockSubscription {
  return {
    object: 'subscription',
    status: 'active',
    cancel_at: null,
    cancel_at_period_end: false,
    ended_at: null,
    metadata: {},
    items: {
      object: 'list',
      data: [
        {
          current_period_start: 1_760_000_000,
          current_period_end: 1_762_592_000,
        },
      ],
    },
    ...overrides,
  }
}

/** `GET /v1/subscriptions/:id`: returns whatever is in `subs` (mutate it between calls), else 404. */
export function stripeSubscriptionHandlers(
  subs: Map<string, MockSubscription>,
) {
  const retrieveCalls: string[] = []
  const handlers = [
    http.get(`${STRIPE_API_URL}/v1/subscriptions/:id`, ({ params }) => {
      const id = String(params.id)
      retrieveCalls.push(id)
      const sub = subs.get(id)
      return sub
        ? HttpResponse.json(sub)
        : stripeError(
            404,
            'invalid_request_error',
            'resource_missing',
            `No such subscription: '${id}'`,
          )
    }),
  ]
  return { retrieveCalls, handlers }
}
