import { safeReturnTo } from '~/server/auth/return-to'

export const BUFFER_AUTH_EXPIRED = 'BUFFER_AUTH_EXPIRED'

/** Redirect target for a signed-out visit to `href`. */
export function signInPath(href: string) {
  return { to: '/signin' as const, search: { returnTo: href } }
}

/** `/signin` search params: `returnTo` must pass the allowlist, `reason` only `expired`. */
export function validateSignInSearch(search: Record<string, unknown>): {
  returnTo?: string
  reason?: 'expired'
} {
  const raw = typeof search.returnTo === 'string' ? search.returnTo : undefined
  return {
    returnTo: raw && safeReturnTo(raw) === raw ? raw : undefined,
    reason: search.reason === 'expired' ? 'expired' : undefined,
  }
}

/** True for the typed `BUFFER_AUTH_EXPIRED` error, which may arrive serialized (message only). */
export function isBufferAuthExpired(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  return code === BUFFER_AUTH_EXPIRED || message === BUFFER_AUTH_EXPIRED
}
