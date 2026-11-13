import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'

export type AudioStore = {
  get(key: string): Promise<Uint8Array | null>
  put(key: string, bytes: Uint8Array): Promise<void>
  has(key: string): Promise<boolean>
}

// Inline copy of the bible's normalizeText (CRLF -> LF, NFC, no trim).
// Swap for `src/lib/text.ts` once #39 merges.
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').normalize('NFC')
}

export function audioKey(input: {
  model: string
  voiceId: string
  text: string
}): string {
  return createHash('sha256')
    .update(`${input.model}|${input.voiceId}|${normalizeText(input.text)}`)
    .digest('hex')
}

export function createMemoryAudioStore(): AudioStore {
  const data = new Map<string, Uint8Array>()
  return {
    async get(key) {
      const bytes = data.get(key)
      return bytes ? new Uint8Array(bytes) : null
    },
    async put(key, bytes) {
      data.set(key, new Uint8Array(bytes))
    },
    async has(key) {
      return data.has(key)
    },
  }
}

export type BlobStoreLike = {
  get(key: string, opts: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>
  getMetadata(key: string): Promise<unknown | null>
  set(key: string, value: ArrayBuffer): Promise<unknown>
}

type OpenBlobStore = (opts: {
  name: string
  consistency: 'strong'
}) => BlobStoreLike

export function createBlobsAudioStore(
  open: OpenBlobStore = (opts) => getStore(opts) as unknown as BlobStoreLike,
): AudioStore {
  const blobs = open({ name: 'audio', consistency: 'strong' })
  return {
    async get(key) {
      const buf = await blobs.get(key, { type: 'arrayBuffer' })
      return buf ? new Uint8Array(buf) : null
    },
    async put(key, bytes) {
      await blobs.set(key, new Uint8Array(bytes).buffer)
    },
    async has(key) {
      return (await blobs.getMetadata(key)) !== null
    },
  }
}

let instance: AudioStore | undefined

/** In-memory fake under Vitest / E2E fixtures; Netlify Blobs otherwise. */
export function getAudioStore(): AudioStore {
  instance ??=
    process.env.VITEST || process.env.E2E_AUTH
      ? createMemoryAudioStore()
      : createBlobsAudioStore()
  return instance
}
