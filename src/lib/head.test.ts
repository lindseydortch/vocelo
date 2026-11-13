import { describe, expect, it } from 'vitest'
import { pageTitle } from './head'

describe('pageTitle', () => {
  it('formats "{name} · Vocelo"', () => {
    expect(pageTitle('Pricing')).toBe('Pricing · Vocelo')
  })

  it('does not double the brand when the name is empty', () => {
    expect(pageTitle('')).toBe('Vocelo')
  })
})
