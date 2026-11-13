import { describe, expect, it } from 'vitest'
import { MAX_POST_CHARS, isBlank, normalizeText, textHash } from './text'

describe('normalizeText', () => {
  it('converts CRLF and lone CR to LF', () => {
    expect(normalizeText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
  })

  it('composes decomposed characters (NFC)', () => {
    const decomposed = 'é'
    expect(normalizeText(decomposed)).toBe('é')
  })

  it('keeps leading and trailing whitespace', () => {
    expect(normalizeText('  hi \n')).toBe('  hi \n')
  })
})

describe('isBlank', () => {
  it('is true for empty and whitespace-only text', () => {
    expect(isBlank('')).toBe(true)
    expect(isBlank('  \n ')).toBe(true)
  })

  it('is false when any non-whitespace is present', () => {
    expect(isBlank(' a ')).toBe(false)
  })
})

describe('textHash', () => {
  it('returns the sha256 hex of the normalized text', async () => {
    expect(await textHash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('is stable across normalization-equivalent inputs', async () => {
    expect(await textHash('café\nx')).toBe(await textHash('café\r\nx'))
  })

  it('differs for different text', async () => {
    expect(await textHash('a')).not.toBe(await textHash('a '))
  })
})

describe('MAX_POST_CHARS', () => {
  it('is 20000', () => {
    expect(MAX_POST_CHARS).toBe(20000)
  })
})
