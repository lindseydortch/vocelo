import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { codeChallenge, randomToken } from './pkce'

describe('pkce', () => {
  it('derives the S256 challenge from the verifier', () => {
    const verifier = randomToken()
    const expected = createHash('sha256').update(verifier).digest('base64url')
    expect(codeChallenge(verifier)).toBe(expected)
  })

  it('matches the RFC 7636 appendix B vector', () => {
    expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('makes unique url-safe tokens of valid verifier length', () => {
    const a = randomToken()
    expect(a).not.toBe(randomToken())
    expect(a).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
  })
})
