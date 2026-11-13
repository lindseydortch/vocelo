import { describe, expect, it } from 'vitest'
import { AUTH_ERROR_REASONS, resolveAuthErrorReason } from './auth-error'

describe('resolveAuthErrorReason', () => {
  it.each(AUTH_ERROR_REASONS)('keeps the known reason %s', (reason) => {
    expect(resolveAuthErrorReason(reason)).toBe(reason)
  })

  it.each([undefined, '', 'bogus', 42, null, ['cancelled']])(
    'falls back to exchange for %j',
    (value) => {
      expect(resolveAuthErrorReason(value)).toBe('exchange')
    },
  )
})
