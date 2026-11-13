// Avatar icon catalog. Artwork is placeholder grayscale SVG until the Design Pass.
// Standard personas (skeptic, scroller, fan) use the same catalog.
export const AVATAR_ICONS = [
  { key: 'skeptic', label: 'Skeptic' },
  { key: 'scroller', label: 'Scroller' },
  { key: 'fan', label: 'Fan' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'rookie', label: 'Rookie' },
  { key: 'critic', label: 'Critic' },
  { key: 'dreamer', label: 'Dreamer' },
  { key: 'founder', label: 'Founder' },
  { key: 'editor', label: 'Editor' },
  { key: 'coach', label: 'Coach' },
  { key: 'stranger', label: 'Stranger' },
  { key: 'colleague', label: 'Colleague' },
] as const

export type AvatarKey = (typeof AVATAR_ICONS)[number]['key']

const KEYS: ReadonlySet<string> = new Set(AVATAR_ICONS.map((a) => a.key))

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === 'string' && KEYS.has(value)
}
