import { env } from '~/server/env'
import { codeChallenge, randomToken } from './pkce'
import { safeReturnTo } from './return-to'

export const OAUTH_COOKIE = 'vocelo_oauth'
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60
export const BUFFER_AUTH_URL = 'https://auth.buffer.com/auth'
export const BUFFER_SCOPES =
  'account:read posts:read posts:write offline_access'

export type OAuthCookie = { state: string; verifier: string; returnTo: string }

export function sealOAuthCookie(data: OAuthCookie): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url')
}

/** Parses the state cookie; null if malformed. The callback compares `state`. */
export function readOAuthCookie(value: string): OAuthCookie | null {
  try {
    const d = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<OAuthCookie> | null
    if (
      typeof d?.state === 'string' &&
      typeof d.verifier === 'string' &&
      typeof d.returnTo === 'string'
    ) {
      return { state: d.state, verifier: d.verifier, returnTo: d.returnTo }
    }
    return null
  } catch {
    return null
  }
}

/** GET /auth/buffer/start: sets the OAuth state cookie and redirects to Buffer's consent screen. */
export function handleOAuthStart(request: Request): Response {
  const state = randomToken()
  const verifier = randomToken()
  const returnTo = safeReturnTo(
    new URL(request.url).searchParams.get('returnTo'),
  )

  const auth = new URL(BUFFER_AUTH_URL)
  auth.search = new URLSearchParams({
    client_id: env.BUFFER_CLIENT_ID,
    redirect_uri: `${env.APP_URL}/auth/callback`,
    response_type: 'code',
    scope: BUFFER_SCOPES,
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: 'S256',
  }).toString()

  const headers = new Headers({ Location: auth.toString() })
  headers.append(
    'Set-Cookie',
    [
      `${OAUTH_COOKIE}=${sealOAuthCookie({ state, verifier, returnTo })}`,
      'Path=/auth',
      `Max-Age=${OAUTH_COOKIE_MAX_AGE_SECONDS}`,
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
    ].join('; '),
  )
  headers.set('Cache-Control', 'no-store')
  return new Response(null, { status: 302, headers })
}
