import '@tanstack/react-start/server-only'
import { readFile } from 'node:fs/promises'
import { env } from './env'

export const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io'
export const ELEVENLABS_MODEL = 'eleven_flash_v2_5'
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_64'
export const ELEVENLABS_TIMEOUT_MS = 45_000

const SILENCE_PATH = 'fixtures/audio/silence.mp3'

export type TtsResult =
  { kind: 'audio'; bytes: Uint8Array } | { kind: 'browser' }

/** `BUSY`: 429 / concurrency. `QUOTA`: our credits are used up. `FAILED`: 5xx, timeout, anything else. */
export type TtsErrorCode = 'BUSY' | 'QUOTA' | 'FAILED'

export class TtsError extends Error {
  constructor(
    readonly code: TtsErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'TtsError'
  }
}

export type SynthesizeOptions = {
  provider?: 'browser' | 'elevenlabs' | 'fixture'
  apiKey?: string
  timeoutMs?: number
}

async function detailStatus(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { detail?: { status?: string } }
    return body.detail?.status
  } catch {
    return undefined
  }
}

async function elevenLabs(
  voiceId: string,
  text: string,
  apiKey: string | undefined,
  timeoutMs: number,
): Promise<TtsResult> {
  if (!apiKey) throw new TtsError('FAILED', 'ELEVENLABS_API_KEY is not set')
  const url = `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (cause) {
    throw new TtsError('FAILED', 'ElevenLabs request failed or timed out', {
      cause,
    })
  }

  if (res.ok) {
    try {
      return { kind: 'audio', bytes: new Uint8Array(await res.arrayBuffer()) }
    } catch (cause) {
      throw new TtsError('FAILED', 'ElevenLabs response body failed', { cause })
    }
  }

  const requestId = res.headers.get('request-id') ?? 'unknown'
  if (res.status === 429) {
    throw new TtsError('BUSY', 'ElevenLabs is busy, try again shortly')
  }
  const status = await detailStatus(res)
  if (status === 'quota_exceeded') {
    console.error(
      `[tts] ElevenLabs quota exhausted (request-id ${requestId}, http ${res.status})`,
    )
    throw new TtsError('QUOTA', 'Voice quota used up')
  }
  throw new TtsError(
    'FAILED',
    `ElevenLabs returned HTTP ${res.status} (request-id ${requestId})`,
  )
}

/**
 * Turns text into audio using the provider in `TTS_PROVIDER`.
 * `browser` makes no call: the client speaks it with `speechSynthesis`.
 * Callers consume usage first and refund on `TtsError`.
 */
export async function synthesize(
  voiceId: string,
  text: string,
  options: SynthesizeOptions = {},
): Promise<TtsResult> {
  const provider = options.provider ?? env.TTS_PROVIDER
  switch (provider) {
    case 'browser':
      return { kind: 'browser' }
    case 'fixture':
      return {
        kind: 'audio',
        bytes: new Uint8Array(await readFile(SILENCE_PATH)),
      }
    case 'elevenlabs':
      return elevenLabs(
        voiceId,
        text,
        options.apiKey ?? env.ELEVENLABS_API_KEY,
        options.timeoutMs ?? ELEVENLABS_TIMEOUT_MS,
      )
  }
}
