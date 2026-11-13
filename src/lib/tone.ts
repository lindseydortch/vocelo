export const TONE_LABELS = [
  'Confident',
  'Warm',
  'Inspiring',
  'Helpful',
  'Neutral',
  'Vague',
  'Salesy',
  'Braggy',
  'Defensive',
  'Preachy',
] as const

export type ToneLabel = (typeof TONE_LABELS)[number]
type Sentiment = 'positive' | 'neutral' | 'negative'

const SENTIMENTS: Record<ToneLabel, Sentiment> = {
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
}

export function isToneLabel(value: unknown): value is ToneLabel {
  return (
    typeof value === 'string' && TONE_LABELS.some((label) => label === value)
  )
}

export function sentimentFor(label: ToneLabel): Sentiment {
  return SENTIMENTS[label]
}
