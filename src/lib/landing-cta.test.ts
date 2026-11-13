import { describe, expect, it } from 'vitest'
import { landingCta } from './landing-cta'

const labels = { signedOut: 'Sign in with Buffer', signedIn: 'Open Vocelo' }

describe('landingCta', () => {
  it('sends signed-out visitors through Buffer sign-in, returning to /app', () => {
    expect(landingCta(false, labels)).toEqual({
      label: 'Sign in with Buffer',
      href: '/auth/buffer/start?returnTo=/app',
    })
  })

  it('sends signed-in visitors straight to /app', () => {
    expect(landingCta(true, labels)).toEqual({
      label: 'Open Vocelo',
      href: '/app',
    })
  })
})
