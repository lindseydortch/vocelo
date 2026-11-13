import { describe, expect, it } from 'vitest'
import { DEFAULT_RETURN_TO, safeReturnTo } from './return-to'

describe('safeReturnTo', () => {
  it.each([
    ['/app', '/app'],
    ['/app/posts/123', '/app/posts/123'],
    ['/app?tab=history', '/app?tab=history'],
    ['/pricing', '/pricing'],
    ['/pricing?plan=creator', '/pricing?plan=creator'],
  ])('keeps %s', (input, out) => {
    expect(safeReturnTo(input)).toBe(out)
  })

  it.each([
    undefined,
    null,
    '',
    'https://evil.com',
    '//evil.com',
    '//evil.com/app',
    '/\\evil.com',
    '/app/\\evil.com',
    '/appendix',
    '/pricingx',
    '/other',
    'app',
    'javascript:alert(1)',
    '/app\r\nSet-Cookie: x=1',
  ])('falls back to /app for %j', (input) => {
    expect(safeReturnTo(input)).toBe(DEFAULT_RETURN_TO)
    expect(DEFAULT_RETURN_TO).toBe('/app')
  })
})
