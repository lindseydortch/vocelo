// Stock voices for custom personas. IDs are placeholders until H2 (#2) picks
// the real ElevenLabs voices; swap them in then. Previews are static files
// written by `npm run audio:static`.
export const CUSTOM_VOICES = [
  {
    id: 'voice-1',
    label: 'Voice 1',
    description: 'Placeholder: warm and steady',
  },
  {
    id: 'voice-2',
    label: 'Voice 2',
    description: 'Placeholder: bright and quick',
  },
  { id: 'voice-3', label: 'Voice 3', description: 'Placeholder: low and calm' },
  { id: 'voice-4', label: 'Voice 4', description: 'Placeholder: dry and wry' },
  {
    id: 'voice-5',
    label: 'Voice 5',
    description: 'Placeholder: crisp and formal',
  },
  {
    id: 'voice-6',
    label: 'Voice 6',
    description: 'Placeholder: friendly and casual',
  },
  {
    id: 'voice-7',
    label: 'Voice 7',
    description: 'Placeholder: gravelly and slow',
  },
  {
    id: 'voice-8',
    label: 'Voice 8',
    description: 'Placeholder: soft and thoughtful',
  },
].map((v) => ({ ...v, previewPath: `/voices/${v.id}.mp3` }))

export type CustomVoice = (typeof CUSTOM_VOICES)[number]

const IDS: ReadonlySet<string> = new Set(CUSTOM_VOICES.map((v) => v.id))

export function isCustomVoice(value: unknown): value is string {
  return typeof value === 'string' && IDS.has(value)
}
