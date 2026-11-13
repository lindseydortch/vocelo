import { describe, expect, it } from 'vitest'
import { isToneLabel, sentimentFor, TONE_LABELS } from './tone'

describe('tone labels', () => {
  it('maps each specified label to its sentiment', () => {
    const expected = {
      Confident: 'positive',
      Warm: 'positive',
      Inspiring: 'positive',
      Helpful: 'positive',
      Neutral: 'neutral',
      Vague: 'neutral',
      Salesy: 'negative',
      Braggy: 'negative',
      Defensive: 'negative',
      Preachy: 'negative',
    } as const
    expect(TONE_LABELS).toEqual(Object.keys(expected))
    for (const label of TONE_LABELS) {
      expect(isToneLabel(label)).toBe(true)
      expect(sentimentFor(label)).toBe(expected[label])
    }
  })

  it('rejects unknown values', () => {
    for (const value of ['confident', 'Unknown', '', null, 42, {}]) {
      expect(isToneLabel(value)).toBe(false)
    }
  })
})
