// Stock voices for custom personas. IDs are placeholders until H2 (#2) picks
// the real ElevenLabs voices; swap them in then. Preview files in
// /public/voices/ do not exist yet: `npm run audio:static` (V16, run by H10)
// will write them.
export const CUSTOM_VOICES = [
  {
    id: 'voice-1',
    label: 'Voice 1',
    description: 'Placeholder: warm and steady',
    previewPath: '/voices/voice-1.mp3',
  },
  {
    id: 'voice-2',
    label: 'Voice 2',
    description: 'Placeholder: bright and quick',
    previewPath: '/voices/voice-2.mp3',
  },
  {
    id: 'voice-3',
    label: 'Voice 3',
    description: 'Placeholder: low and calm',
    previewPath: '/voices/voice-3.mp3',
  },
  {
    id: 'voice-4',
    label: 'Voice 4',
    description: 'Placeholder: dry and wry',
    previewPath: '/voices/voice-4.mp3',
  },
  {
    id: 'voice-5',
    label: 'Voice 5',
    description: 'Placeholder: crisp and formal',
    previewPath: '/voices/voice-5.mp3',
  },
  {
    id: 'voice-6',
    label: 'Voice 6',
    description: 'Placeholder: friendly and casual',
    previewPath: '/voices/voice-6.mp3',
  },
  {
    id: 'voice-7',
    label: 'Voice 7',
    description: 'Placeholder: gravelly and slow',
    previewPath: '/voices/voice-7.mp3',
  },
  {
    id: 'voice-8',
    label: 'Voice 8',
    description: 'Placeholder: soft and thoughtful',
    previewPath: '/voices/voice-8.mp3',
  },
] as const

export type CustomVoice = (typeof CUSTOM_VOICES)[number]
export type VoiceId = CustomVoice['id']

const IDS: ReadonlySet<string> = new Set(CUSTOM_VOICES.map((v) => v.id))

export function isCustomVoice(value: unknown): value is VoiceId {
  return typeof value === 'string' && IDS.has(value)
}
