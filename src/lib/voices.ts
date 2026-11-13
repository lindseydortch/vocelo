// ElevenLabs stock voices (picked in H2, #2): the 3 standard persona voices
// plus 8 for custom personas. `id` is the ElevenLabs voice ID. Preview files in
// /public/voices/ do not exist yet: `npm run audio:static` (V16, run by H10)
// will write them.
export const CUSTOM_VOICES = [
  {
    id: 'Myb1gsDenT3mlMlj7vib',
    label: 'The Skeptic',
    description: 'Sarcastic, casual, skeptical',
    previewPath: '/voices/Myb1gsDenT3mlMlj7vib.mp3',
  },
  {
    id: 'U9ZSDp7XmjKuLG6QS1Em',
    label: 'The Scroller',
    description: 'Casual and friendly',
    previewPath: '/voices/U9ZSDp7XmjKuLG6QS1Em.mp3',
  },
  {
    id: 'w4DBBAtZhQtfCihqCw5b',
    label: 'The Fan',
    description: 'Young, upbeat social creator',
    previewPath: '/voices/w4DBBAtZhQtfCihqCw5b.mp3',
  },
  {
    id: '3TStB8f3X3To0Uj5R7RK',
    label: 'Hiring manager',
    description: 'Professional, neutral, mid-aged',
    previewPath: '/voices/3TStB8f3X3To0Uj5R7RK.mp3',
  },
  {
    id: 'X4H5lnYuaSQgctvERjr1',
    label: 'Senior executive',
    description: 'Deep, slow, authoritative',
    previewPath: '/voices/X4H5lnYuaSQgctvERjr1.mp3',
  },
  {
    id: 'ujoCPuNXFKVxZSRRrMHv',
    label: 'Industry peer',
    description: 'Casual, confident, conversational',
    previewPath: '/voices/ujoCPuNXFKVxZSRRrMHv.mp3',
  },
  {
    id: 'ghAs7Ry5dbbsqdrmDrt9',
    label: 'Newcomer',
    description: 'Younger, curious, a little unsure',
    previewPath: '/voices/ghAs7Ry5dbbsqdrmDrt9.mp3',
  },
  {
    id: 'jD4PjnscE4XmlzgsuqY0',
    label: 'Busy founder',
    description: 'Fast, clipped, impatient',
    previewPath: '/voices/jD4PjnscE4XmlzgsuqY0.mp3',
  },
  {
    id: 'SgWu1CbksCBEYr7fOUMP',
    label: 'Warm mentor',
    description: 'Older, gentle, encouraging',
    previewPath: '/voices/SgWu1CbksCBEYr7fOUMP.mp3',
  },
  {
    id: '54Cze5LrTSyLgbO6Fhlc',
    label: 'Cynical critic',
    description: 'Gravelly or dry, sarcastic',
    previewPath: '/voices/54Cze5LrTSyLgbO6Fhlc.mp3',
  },
  {
    id: '7Z3zS2SJzkpg95KpVJoe',
    label: 'Journalist or editor',
    description: 'Crisp, precise, newsy',
    previewPath: '/voices/7Z3zS2SJzkpg95KpVJoe.mp3',
  },
] as const

export type CustomVoice = (typeof CUSTOM_VOICES)[number]
export type VoiceId = CustomVoice['id']

const IDS: ReadonlySet<string> = new Set(CUSTOM_VOICES.map((v) => v.id))

export function isCustomVoice(value: unknown): value is VoiceId {
  return typeof value === 'string' && IDS.has(value)
}
