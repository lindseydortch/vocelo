import { readFileSync } from 'node:fs'
import { http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '~/test/msw'
import {
  ELEVENLABS_MP3,
  elevenLabsHandlers,
  elevenLabsTtsUrl,
} from '~/test/msw/elevenlabs'
import { TtsError, synthesize } from './tts'

const eleven = { provider: 'elevenlabs', apiKey: 'xi-secret' } as const

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('./env')
  vi.resetModules()
})

describe('synthesize: elevenlabs', () => {
  it('posts the model, output format and key, and returns the mp3 bytes', async () => {
    let seen: { url: URL; key: string | null; body: unknown } | undefined
    server.use(
      http.post(elevenLabsTtsUrl('voice1'), async ({ request }) => {
        seen = {
          url: new URL(request.url),
          key: request.headers.get('xi-api-key'),
          body: await request.json(),
        }
        return new Response(ELEVENLABS_MP3, {
          headers: { 'content-type': 'audio/mpeg' },
        })
      }),
    )
    const result = await synthesize('voice1', 'Hello there', eleven)
    expect(result.kind).toBe('audio')
    if (result.kind === 'audio') {
      expect([...result.bytes]).toEqual([...ELEVENLABS_MP3])
    }
    expect(seen?.url.searchParams.get('output_format')).toBe('mp3_44100_64')
    expect(seen?.key).toBe('xi-secret')
    expect(seen?.body).toEqual({
      text: 'Hello there',
      model_id: 'eleven_flash_v2_5',
    })
  })

  it('maps 429 to BUSY', async () => {
    server.use(elevenLabsHandlers.rateLimited())
    await expect(synthesize('v', 'hi', eleven)).rejects.toMatchObject({
      name: 'TtsError',
      code: 'BUSY',
    })
  })

  it('maps quota exhaustion to QUOTA and logs the request ID', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(elevenLabsHandlers.quotaExceeded())
    await expect(synthesize('v', 'hi', eleven)).rejects.toMatchObject({
      code: 'QUOTA',
    })
    expect(log.mock.calls.flat().join(' ')).toContain('req_test_123')
  })

  it('maps 5xx to FAILED', async () => {
    server.use(elevenLabsHandlers.serverError(503))
    await expect(synthesize('v', 'hi', eleven)).rejects.toMatchObject({
      code: 'FAILED',
    })
  })

  it('maps a timeout to FAILED', async () => {
    server.use(elevenLabsHandlers.hang())
    const err = await synthesize('v', 'hi', { ...eleven, timeoutMs: 20 }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(TtsError)
    expect(err).toMatchObject({ code: 'FAILED' })
  })

  it('maps a body that fails mid-stream to FAILED', async () => {
    server.use(
      http.post(elevenLabsTtsUrl(':v'), () => {
        const body = new ReadableStream({
          start: (c) => c.error(new Error('socket reset')),
        })
        return new Response(body, { headers: { 'content-type': 'audio/mpeg' } })
      }),
    )
    await expect(synthesize('v', 'hi', eleven)).rejects.toMatchObject({
      code: 'FAILED',
    })
  })

  it('maps an unexpected 4xx to FAILED, not QUOTA', async () => {
    server.use(
      http.post(
        elevenLabsTtsUrl(':v'),
        () => new Response('{}', { status: 422 }),
      ),
    )
    await expect(synthesize('v', 'hi', eleven)).rejects.toMatchObject({
      code: 'FAILED',
    })
  })

  it('never leaks the API key in the error', async () => {
    server.use(elevenLabsHandlers.serverError())
    const err = (await synthesize('v', 'hi', eleven).catch(
      (e: unknown) => e,
    )) as Error
    expect(`${err.message} ${JSON.stringify(err)}`).not.toContain('xi-secret')
  })
})

describe('synthesize: other providers', () => {
  it('fixture returns the silent mp3 without a network call', async () => {
    const result = await synthesize('v', 'hi', { provider: 'fixture' })
    const expected = readFileSync('fixtures/audio/silence.mp3')
    expect(result.kind).toBe('audio')
    if (result.kind === 'audio') {
      expect(Buffer.from(result.bytes).equals(expected)).toBe(true)
    }
  })

  it('browser returns { kind: "browser" } without a network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await synthesize('v', 'hi', { provider: 'browser' })).toEqual({
      kind: 'browser',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reads the provider and key from env when not overridden', async () => {
    vi.resetModules()
    vi.doMock('./env', () => ({
      env: { TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'from-env' },
    }))
    let key: string | null = null
    server.use(
      http.post(elevenLabsTtsUrl(':v'), ({ request }) => {
        key = request.headers.get('xi-api-key')
        return new Response(ELEVENLABS_MP3)
      }),
    )
    const { synthesize: fresh } = await import('./tts')
    expect((await fresh('v', 'hi')).kind).toBe('audio')
    expect(key).toBe('from-env')
  })
})
