export const DEFAULT_RETURN_TO = '/app'

const ALLOWED = /^\/(app|pricing)(?:[/?#]|$)/

/**
 * Where to send the user after sign-in. Only relative paths under `/app` or
 * `/pricing` pass; anything else (absolute URLs, `//host`, backslashes,
 * control characters, missing) becomes `/app`.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !ALLOWED.test(value)) return DEFAULT_RETURN_TO
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_RETURN_TO
  return value
}
