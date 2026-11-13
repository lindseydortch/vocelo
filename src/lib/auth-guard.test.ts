import { describe, expect, it } from 'vitest'
import {
  isBufferAuthExpired,
  signInPath,
  validateSignInSearch,
} from './auth-guard'

describe('signInPath', () => {
  it('keeps the current path as returnTo', () => {
    expect(signInPath('/app/posts/1?x=2')).toEqual({
      to: '/signin',
      search: { returnTo: '/app/posts/1?x=2' },
    })
  })
})

describe('validateSignInSearch', () => {
  it('keeps an allowed returnTo and the expired reason', () => {
    expect(
      validateSignInSearch({ returnTo: '/app/x', reason: 'expired' }),
    ).toEqual({ returnTo: '/app/x', reason: 'expired' })
  })

  it('drops an unsafe returnTo and unknown reasons', () => {
    expect(
      validateSignInSearch({ returnTo: 'https://evil.test', reason: 'x' }),
    ).toEqual({})
  })
})

describe('isBufferAuthExpired', () => {
  it('matches the typed error by code or message', () => {
    expect(isBufferAuthExpired({ code: 'BUFFER_AUTH_EXPIRED' })).toBe(true)
    expect(isBufferAuthExpired(new Error('BUFFER_AUTH_EXPIRED'))).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isBufferAuthExpired(new Error('boom'))).toBe(false)
    expect(isBufferAuthExpired(null)).toBe(false)
  })
})
