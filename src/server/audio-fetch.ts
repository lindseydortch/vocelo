import '@tanstack/react-start/server-only'
import { getAudioStore, type AudioStore } from './audio-store'

const KEY_PATTERN = /^[0-9a-f]{64}$/
const CACHE_CONTROL = 'private, max-age=31536000, immutable'

export type AudioFetchDeps = {
  store: AudioStore
  isSignedIn: () => Promise<boolean>
}

async function defaultIsSignedIn(): Promise<boolean> {
  const { getSessionUser } = await import('./auth/session')
  return (await getSessionUser()) !== null
}

/**
 * `GET /api/audio/:key`. Auth first (401), then key shape (404), then the
 * cache. The cache is shared by design: any signed-in user may fetch any key.
 * Keys are content hashes, so a hit never changes and caches forever.
 */
export async function handleAudioFetch(
  key: string,
  deps: Partial<AudioFetchDeps> = {},
): Promise<Response> {
  const isSignedIn = deps.isSignedIn ?? defaultIsSignedIn
  if (!(await isSignedIn())) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!KEY_PATTERN.test(key)) {
    return new Response('Not found', { status: 404 })
  }
  const bytes = await (deps.store ?? getAudioStore()).get(key)
  if (!bytes) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': CACHE_CONTROL,
    },
  })
}
