import { describe, expect, it, vi } from 'vitest'
import { createMemoryAudioStore } from './audio-store'
import { handleAudioFetch } from './audio-fetch'

const KEY = 'a'.repeat(64)
const bytes = new Uint8Array([73, 68, 51, 4, 0])

async function setup(opts: { signedIn?: boolean; seed?: boolean } = {}) {
  const { signedIn = true, seed = true } = opts
  const store = createMemoryAudioStore()
  if (seed) await store.put(KEY, bytes)
  const isSignedIn = vi.fn(async () => signedIn)
  return { store, isSignedIn, deps: { store, isSignedIn } }
}

describe('handleAudioFetch', () => {
  it('returns 401 when signed out, even for a valid hit', async () => {
    const { deps } = await setup({ signedIn: false })
    const res = await handleAudioFetch(KEY, deps)
    expect(res.status).toBe(401)
    expect(res.headers.get('Content-Type')).not.toBe('audio/mpeg')
  })

  it('returns 401 (not 404) for a bad key when signed out', async () => {
    const { deps } = await setup({ signedIn: false })
    expect((await handleAudioFetch('nope', deps)).status).toBe(401)
  })

  it.each([
    ['too short', 'abc123'],
    ['too long', 'a'.repeat(65)],
    ['non-hex', 'g'.repeat(64)],
    ['uppercase hex', 'A'.repeat(64)],
    ['path traversal', '../'.repeat(22).slice(0, 64)],
  ])(
    'returns 404 for a bad key (%s) without touching the store',
    async (_n, key) => {
      const { store, deps } = await setup()
      const get = vi.spyOn(store, 'get')
      const res = await handleAudioFetch(key, deps)
      expect(res.status).toBe(404)
      expect(get).not.toHaveBeenCalled()
    },
  )

  it('returns 404 on a cache miss', async () => {
    const { deps } = await setup({ seed: false })
    expect((await handleAudioFetch(KEY, deps)).status).toBe(404)
  })

  it('returns 200 audio/mpeg with immutable private caching on a hit', async () => {
    const { deps } = await setup()
    const res = await handleAudioFetch(KEY, deps)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(res.headers.get('Cache-Control')).toBe(
      'private, max-age=31536000, immutable',
    )
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
  })

  it('serves any key to any signed-in user (shared cache)', async () => {
    const { deps, isSignedIn } = await setup()
    expect((await handleAudioFetch(KEY, deps)).status).toBe(200)
    expect(isSignedIn).toHaveBeenCalledTimes(1)
  })
})
