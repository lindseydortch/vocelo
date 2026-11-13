export const AUTH_ERROR_REASONS = [
  'cancelled',
  'timeout',
  'exchange',
  'account',
  'scopes',
] as const

export type AuthErrorReason = (typeof AUTH_ERROR_REASONS)[number]

/** `/auth/error?reason=` value; anything unknown or missing is the `exchange` message. */
export function resolveAuthErrorReason(raw: unknown): AuthErrorReason {
  return AUTH_ERROR_REASONS.find((r) => r === raw) ?? 'exchange'
}
