import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '~/test/msw'
import {
  ELEVENLABS_MP3,
  elevenLabsHandlers,
  elevenLabsTtsUrl,
} from '~/test/msw/elevenlabs'
import { CUSTOM_VOICES } from '~/lib/voices'
import { buildJobs, runAudioStatic } from './audio-static'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'audio-static-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const quiet = () => {}
const total = CUSTOM_VOICES.length + 6

describe('audio:static', () => {
  it('writes voice previews, landing lines and sample-post demos', async () => {
    const calls: string[] = []
    server.use(
      http.post(elevenLabsTtsUrl(':voiceId'), ({ request }) => {
        calls.push(request.url)
        return new Response(ELEVENLABS_MP3)
      }),
    )
    const result = await runAudioStatic({
      publicDir: dir,
      apiKey: 'k',
      log: quiet,
    })
    expect(result.written).toHaveLength(total)
    expect(calls).toHaveLength(total)
    for (const v of CUSTOM_VOICES) {
      expect([...(await readFile(join(dir, 'voices', `${v.id}.mp3`)))]).toEqual(
        [...ELEVENLABS_MP3],
      )
    }
    for (const slug of ['skeptic', 'scroller', 'fan']) {
      await readFile(join(dir, 'demo', `${slug}.mp3`))
      await readFile(join(dir, 'demo', `landing-${slug}.mp3`))
    }
  })

  it('skips existing files unless --force', async () => {
    const [first] = buildJobs(dir)
    await mkdir(join(dir, 'voices'), { recursive: true })
    await writeFile(first!.path, 'old')
    server.use(elevenLabsHandlers.success())
    const result = await runAudioStatic({
      publicDir: dir,
      apiKey: 'k',
      log: quiet,
    })
    expect(result.skipped).toEqual([first!.path])
    expect(await readFile(first!.path, 'utf8')).toBe('old')
    const forced = await runAudioStatic({
      publicDir: dir,
      apiKey: 'k',
      force: true,
      log: quiet,
    })
    expect(forced.written).toHaveLength(total)
    expect([...(await readFile(first!.path))]).toEqual([...ELEVENLABS_MP3])
  })

  it('makes no call when nothing is left to do', async () => {
    server.use(elevenLabsHandlers.success())
    await runAudioStatic({ publicDir: dir, apiKey: 'k', log: quiet })
    let called = false
    server.use(
      http.post(
        elevenLabsTtsUrl(':voiceId'),
        () => ((called = true), new Response(ELEVENLABS_MP3)),
      ),
    )
    const result = await runAudioStatic({
      publicDir: dir,
      apiKey: 'k',
      log: quiet,
    })
    expect(result.written).toEqual([])
    expect(called).toBe(false)
  })

  it('reports characters and makes no call when the user declines', async () => {
    const logs: string[] = []
    const result = await runAudioStatic({
      publicDir: dir,
      apiKey: 'k',
      confirm: async () => false,
      log: (m) => logs.push(m),
    })
    expect(result.written).toEqual([])
    expect(logs.join('\n')).toMatch(/\d+ characters will be spent/)
  })

  it('refuses without ELEVENLABS_API_KEY', async () => {
    await expect(
      runAudioStatic({ publicDir: dir, apiKey: undefined, log: quiet }),
    ).rejects.toThrow(/ELEVENLABS_API_KEY/)
  })

  it('fails loudly on an API error', async () => {
    server.use(elevenLabsHandlers.serverError())
    await expect(
      runAudioStatic({ publicDir: dir, apiKey: 'k', log: quiet }),
    ).rejects.toThrow(/HTTP 500/)
  })
})
