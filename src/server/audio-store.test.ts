import { describe, expect, it, vi } from 'vitest'
import {
  audioKey,
  createBlobsAudioStore,
  createMemoryAudioStore,
  getAudioStore,
  type BlobStoreLike,
} from './audio-store'

const base = { model: 'eleven_turbo', voiceId: 'voice-1', text: 'Hello world' }

describe('audioKey', () => {
  it('is a 64-char sha256 hex string', () => {
    expect(audioKey(base)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable for identical input', () => {
    expect(audioKey(base)).toBe(audioKey({ ...base }))
  })

  it('is the same for normalization-equivalent text (CRLF, NFC)', () => {
    const lf = audioKey({ ...base, text: 'Café\nline two' })
    const crlf = audioKey({ ...base, text: 'Café\r\nline two' })
    expect(crlf).toBe(lf)
  })

  it('does not trim whitespace', () => {
    expect(audioKey({ ...base, text: ' Hello world' })).not.toBe(audioKey(base))
  })

  it('differs by voice, model, and text', () => {
    const k = audioKey(base)
    expect(audioKey({ ...base, voiceId: 'voice-2' })).not.toBe(k)
    expect(audioKey({ ...base, model: 'other' })).not.toBe(k)
    expect(audioKey({ ...base, text: 'Hello there' })).not.toBe(k)
  })
})

describe('createMemoryAudioStore', () => {
  it('round-trips bytes and reports has()', async () => {
    const store = createMemoryAudioStore()
    const bytes = new Uint8Array([1, 2, 3])
    expect(await store.has('k')).toBe(false)
    expect(await store.get('k')).toBeNull()
    await store.put('k', bytes)
    expect(await store.has('k')).toBe(true)
    expect(await store.get('k')).toEqual(bytes)
  })

  it('copies bytes so later mutation does not change the cache', async () => {
    const store = createMemoryAudioStore()
    const bytes = new Uint8Array([1, 2, 3])
    await store.put('k', bytes)
    bytes[0] = 9
    expect(await store.get('k')).toEqual(new Uint8Array([1, 2, 3]))
  })
})

describe('createBlobsAudioStore', () => {
  function fakeBlobs() {
    const data = new Map<string, ArrayBuffer>()
    const blobs: BlobStoreLike = {
      get: vi.fn(async (key: string) => data.get(key) ?? null),
      getMetadata: vi.fn(async (key: string) =>
        data.has(key) ? { etag: 'x', metadata: {} } : null,
      ),
      set: vi.fn(async (key: string, value: ArrayBuffer) => {
        data.set(key, value)
      }),
    }
    return blobs
  }

  it('maps get/put/has onto the blob store', async () => {
    const blobs = fakeBlobs()
    const store = createBlobsAudioStore(() => blobs)
    expect(await store.has('k')).toBe(false)
    expect(await store.get('k')).toBeNull()
    await store.put('k', new Uint8Array([4, 5]))
    expect(await store.has('k')).toBe(true)
    expect(await store.get('k')).toEqual(new Uint8Array([4, 5]))
  })

  it('opens store "audio" with strong consistency', () => {
    const open = vi.fn(() => fakeBlobs())
    createBlobsAudioStore(open)
    expect(open).toHaveBeenCalledWith({ name: 'audio', consistency: 'strong' })
  })

  it('propagates blob failures', async () => {
    const blobs = fakeBlobs()
    vi.mocked(blobs.set).mockRejectedValueOnce(new Error('blobs down'))
    const store = createBlobsAudioStore(() => blobs)
    await expect(store.put('k', new Uint8Array([1]))).rejects.toThrow(
      'blobs down',
    )
  })
})

describe('getAudioStore', () => {
  it('returns the in-memory fake under test, as a stable singleton', async () => {
    const a = getAudioStore()
    await a.put('shared', new Uint8Array([7]))
    expect(await getAudioStore().get('shared')).toEqual(new Uint8Array([7]))
  })
})
