import { describe, expect, it, vi } from 'vitest'

vi.mock('~/server/env', () => ({
  env: {
    APP_URL: 'https://localhost:3000',
    BUFFER_CLIENT_ID: 'client_123',
  },
}))

const { handleOAuthStart, OAUTH_COOKIE, readOAuthCookie } =
  await import('./oauth-start')
const { codeChallenge } = await import('./pkce')

const start = (qs = '') =>
  handleOAuthStart(new Request(`https://localhost:3000/auth/buffer/start${qs}`))

function cookieOf(res: Response) {
  const header = res.headers.get('set-cookie') ?? ''
  const [pair = ''] = header.split(';')
  const value = pair.slice(pair.indexOf('=') + 1)
  return { header, value }
}

describe('handleOAuthStart', () => {
  it('redirects to Buffer with PKCE + state and the right scopes', () => {
    const res = start('?returnTo=/pricing')
    expect(res.status).toBe(302)
    const url = new URL(res.headers.get('location')!)
    expect(`${url.origin}${url.pathname}`).toBe('https://auth.buffer.com/auth')
    const p = url.searchParams
    expect(p.get('client_id')).toBe('client_123')
    expect(p.get('redirect_uri')).toBe('https://localhost:3000/auth/callback')
    expect(p.get('response_type')).toBe('code')
    expect(p.get('scope')).toBe(
      'account:read posts:read posts:write offline_access',
    )
    expect(p.get('code_challenge_method')).toBe('S256')
    expect(p.get('state')).toBeTruthy()
    expect(p.get('code_challenge')).toBeTruthy()
  })

  it('stores state, verifier and returnTo in a short-lived hardened cookie', () => {
    const res = start('?returnTo=/pricing')
    const p = new URL(res.headers.get('location')!).searchParams
    const { header, value } = cookieOf(res)
    expect(header).toContain(`${OAUTH_COOKIE}=`)
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/Secure/i)
    expect(header).toMatch(/SameSite=Lax/i)
    expect(header).toMatch(/Max-Age=600/i)
    const stored = readOAuthCookie(value)!
    expect(stored.state).toBe(p.get('state'))
    expect(stored.returnTo).toBe('/pricing')
    expect(codeChallenge(stored.verifier)).toBe(p.get('code_challenge'))
  })

  it.each(['', '?returnTo=https://evil.com', '?returnTo=//evil.com'])(
    'defaults returnTo to /app for %j',
    (qs) => {
      expect(readOAuthCookie(cookieOf(start(qs)).value)!.returnTo).toBe('/app')
    },
  )

  it('uses a fresh state and verifier on every call', () => {
    const a = readOAuthCookie(cookieOf(start()).value)!
    const b = readOAuthCookie(cookieOf(start()).value)!
    expect(a.state).not.toBe(b.state)
    expect(a.verifier).not.toBe(b.verifier)
  })

  it('readOAuthCookie rejects garbage', () => {
    expect(readOAuthCookie('nope')).toBeNull()
    expect(readOAuthCookie('')).toBeNull()
  })
})
