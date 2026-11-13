import { describe, expect, it } from 'vitest'
import { currentSection } from './app-nav'

describe('currentSection', () => {
  it.each([
    ['/app', 'posts'],
    ['/app/', 'posts'],
    ['/app/posts/new', 'posts'],
    ['/app/posts/abc123', 'posts'],
    ['/app/personas', 'personas'],
    ['/app/settings', 'settings'],
    ['/app/settings/billing', 'settings'],
  ])('%s is in %s', (pathname, section) => {
    expect(currentSection(pathname)).toBe(section)
  })

  it.each(['/app/billing/success', '/app/personas-x', '/pricing', '/'])(
    '%s is in no nav section',
    (pathname) => {
      expect(currentSection(pathname)).toBeNull()
    },
  )
})
