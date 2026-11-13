import { describe, expect, it } from 'vitest'
import { CUSTOM_VOICES, isCustomVoice } from './voices'

describe('custom voice catalog', () => {
  it('has about 8 entries with the required shape', () => {
    expect(CUSTOM_VOICES).toHaveLength(8)
    for (const v of CUSTOM_VOICES) {
      expect(v.id.length).toBeGreaterThan(0)
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

  it('accepts every catalog id', () => {
    for (const { id } of CUSTOM_VOICES) expect(isCustomVoice(id)).toBe(true)
  })

  it('rejects unknown values', () => {
    for (const v of [
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
