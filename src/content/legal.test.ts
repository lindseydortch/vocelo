import { describe, expect, it } from 'vitest'
import { pagesCopy } from './copy'
import { legal } from './legal'

const flatten = (doc: (typeof legal)[keyof typeof legal]) =>
  doc.sections
    .flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.items ?? [])])
    .join('\n')

describe('legal.privacy', () => {
  const text = flatten(legal.privacy)

  it('has a heading, title and last-updated date', () => {
    expect(legal.privacy.heading).toBe('Privacy Policy')
    expect(legal.privacy.title).toBe('Privacy')
    expect(legal.privacy.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it.each([
    'Buffer account ID',
    'encrypted',
    'post text',
    'versions',
    'reactions',
    'usage events',
    'Stripe customer ID',
  ])('lists stored data: %s', (item) => {
    expect(text).toContain(item)
  })

  it.each(['Buffer', 'ElevenLabs', 'Anthropic', 'Stripe', 'Netlify', 'Neon'])(
    'names processor %s',
    (name) => {
      expect(text).toContain(name)
    },
  )

  it('covers on-request sending, shared audio cache, no selling, deletion', () => {
    expect(text).toMatch(/only when you ask/i)
    expect(text).toMatch(/hash/i)
    expect(text).toMatch(/do not sell/i)
    expect(text).toContain(pagesCopy.footer.supportEmail)
  })

  it('is real content, not placeholder', () => {
    expect(text).not.toMatch(/lorem ipsum/i)
  })
})

describe('legal.terms', () => {
  const text = flatten(legal.terms)

  it('has heading and title', () => {
    expect(legal.terms.heading).toBe('Terms of Service')
    expect(legal.terms.title).toBe('Terms')
  })

  it('covers hackathon stage, warranty, acceptable use, billing, contact', () => {
    expect(text).toMatch(/hackathon/i)
    expect(text).toMatch(/without warranty|no warranty/i)
    expect(text).toMatch(/acceptable use/i)
    expect(text).toContain('Stripe')
    expect(text).toMatch(/cancel any time/i)
    expect(text).toMatch(/end of (your|the) (current )?(billing )?period/i)
    expect(text).toContain(pagesCopy.footer.supportEmail)
  })

  it('is real content, not placeholder', () => {
    expect(text).not.toMatch(/lorem ipsum/i)
  })
})

describe('every section', () => {
  it.each(Object.entries(legal))('%s sections are non-empty', (_k, doc) => {
    for (const s of doc.sections) {
      expect(s.heading.length).toBeGreaterThan(0)
      expect(
        (s.paragraphs?.length ?? 0) + (s.items?.length ?? 0),
      ).toBeGreaterThan(0)
    }
  })
})
