import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AVATAR_ICONS, isAvatarKey } from './avatars'

describe('avatar catalog', () => {
  it('has about 12 entries with unique keys and non-empty labels', () => {
    expect(AVATAR_ICONS).toHaveLength(12)
    expect(new Set(AVATAR_ICONS.map((a) => a.key)).size).toBe(12)
    for (const { key, label } of AVATAR_ICONS) {
      expect(key).toMatch(/^[a-z-]+$/)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('has a placeholder SVG file for every key', () => {
    for (const { key } of AVATAR_ICONS) {
      expect(
        existsSync(join(__dirname, '../assets/avatars', `${key}.svg`)),
      ).toBe(true)
    }
  })

  it('resolves the standard persona avatar keys', () => {
    for (const key of ['skeptic', 'scroller', 'fan']) {
      expect(isAvatarKey(key)).toBe(true)
    }
  })

  it('accepts every catalog key', () => {
    for (const { key } of AVATAR_ICONS) expect(isAvatarKey(key)).toBe(true)
  })

  it('rejects unknown values', () => {
    for (const v of [
      'nope',
      '',
      'Skeptic',
      'toString',
      '__proto__',
      null,
      undefined,
      42,
      {},
    ]) {
      expect(isAvatarKey(v)).toBe(false)
    }
  })
})
