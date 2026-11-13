import { describe, expect, it } from 'vitest'
import { CUSTOM_VOICES, isCustomVoice } from './voices'

describe('voice catalog', () => {
  it('has the 11 H2 voices (3 standard + 8 custom) with the required shape', () => {
    expect(CUSTOM_VOICES).toHaveLength(11)
    for (const v of CUSTOM_VOICES) {
      expect(v.id).toMatch(/^[A-Za-z0-9]{20}$/)
      expect(v.label.length).toBeGreaterThan(0)
      expect(v.description.length).toBeGreaterThan(0)
      expect(v.previewPath).toBe(`/voices/${v.id}.mp3`)
    }
  })

  it('has unique ids', () => {
    expect(new Set(CUSTOM_VOICES.map((v) => v.id)).size).toBe(
      CUSTOM_VOICES.length,
    )
  })

  it('includes the three standard persona voices', () => {
    const ids = CUSTOM_VOICES.map((v) => v.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'Myb1gsDenT3mlMlj7vib',
        'U9ZSDp7XmjKuLG6QS1Em',
        'w4DBBAtZhQtfCihqCw5b',
      ]),
    )
  })

  it('accepts every catalog id', () => {
    for (const { id } of CUSTOM_VOICES) expect(isCustomVoice(id)).toBe(true)
  })

  it('rejects old placeholders and unknown values', () => {
    for (const v of [
      'voice-1',
      'nope',
      '',
      'toString',
      '__proto__',
      null,
      undefined,
      7,
      {},
    ]) {
      expect(isCustomVoice(v)).toBe(false)
    }
  })
})
