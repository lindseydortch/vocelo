import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SAMPLE_POST } from '../src/content/sample-post.ts'
import { CUSTOM_VOICES } from '../src/lib/voices.ts'

// Same values as src/server/tts.ts. That module can't run under plain Node
// (`server-only`, extensionless imports), so the script makes its own call.
const BASE_URL = 'https://api.elevenlabs.io'
const MODEL = 'eleven_flash_v2_5'
const OUTPUT_FORMAT = 'mp3_44100_64'
const TIMEOUT_MS = 60_000

/** The 3 standard personas (migration 0002): slug = avatar_key, voice = H2 pick. */
export const STANDARD_PERSONAS = [
  { slug: 'skeptic', voiceId: 'Myb1gsDenT3mlMlj7vib' },
  { slug: 'scroller', voiceId: 'U9ZSDp7XmjKuLG6QS1Em' },
  { slug: 'fan', voiceId: 'w4DBBAtZhQtfCihqCw5b' },
] as const

const LANDING_LINES: Record<string, string> = {
  skeptic: 'Humbled and honored? Sure. Let us see what you actually did.',
  scroller: 'Okay, first line got me. Keep going, I have about three seconds.',
  fan: 'This is great. I would share this one with my whole team.',
}

export type Job = { path: string; voiceId: string; text: string }

export function buildJobs(publicDir: string): Job[] {
  return [
    ...CUSTOM_VOICES.map((v) => ({
      path: join(publicDir, 'voices', `${v.id}.mp3`),
      voiceId: v.id,
      text: `Hi, I'm ${v.label}. This is how I sound when I read your post.`,
    })),
    ...STANDARD_PERSONAS.map((p) => ({
      path: join(publicDir, 'demo', `landing-${p.slug}.mp3`),
      voiceId: p.voiceId,
      text: LANDING_LINES[p.slug] as string,
    })),
    ...STANDARD_PERSONAS.map((p) => ({
      path: join(publicDir, 'demo', `${p.slug}.mp3`),
      voiceId: p.voiceId,
      text: SAMPLE_POST,
    })),
  ]
}

export type RunOptions = {
  publicDir: string
  apiKey: string | undefined
  force?: boolean
  confirm?: (message: string) => Promise<boolean>
  log?: (message: string) => void
}

export type RunResult = {
  written: string[]
  skipped: string[]
  characters: number
}

async function synth(job: Job, apiKey: string): Promise<Uint8Array> {
  const res = await fetch(
    `${BASE_URL}/v1/text-to-speech/${encodeURIComponent(job.voiceId)}?output_format=${OUTPUT_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text: job.text, model_id: MODEL }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  )
  if (!res.ok) {
    throw new Error(
      `ElevenLabs returned HTTP ${res.status} for ${job.path} (request-id ${res.headers.get('request-id') ?? 'unknown'})`,
    )
  }
  return new Uint8Array(await res.arrayBuffer())
}

export async function runAudioStatic(opts: RunOptions): Promise<RunResult> {
  const log = opts.log ?? console.log
  if (!opts.apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set. Add it to .env.local.')
  }
  const all = buildJobs(opts.publicDir)
  const todo = all.filter((j) => opts.force || !existsSync(j.path))
  const skipped = all.filter((j) => !todo.includes(j)).map((j) => j.path)
  const characters = todo.reduce((sum, j) => sum + j.text.length, 0)

  if (todo.length === 0) {
    log('audio:static: nothing to do (all files exist; use --force to redo).')
    return { written: [], skipped, characters: 0 }
  }
  log(
    `audio:static: ${todo.length} file(s) to generate, ${skipped.length} skipped, ${characters} characters will be spent.`,
  )
  const ok = await (opts.confirm?.(`Spend ${characters} characters? [y/N] `) ??
    true)
  if (!ok) {
    log('audio:static: cancelled.')
    return { written: [], skipped: all.map((j) => j.path), characters: 0 }
  }

  const written: string[] = []
  for (const job of todo) {
    const bytes = await synth(job, opts.apiKey)
    await mkdir(dirname(job.path), { recursive: true })
    await writeFile(job.path, bytes)
    written.push(job.path)
    log(`  wrote ${job.path}`)
  }
  return { written, skipped, characters }
}

// Node 24 runs this file directly (type stripping); skip when imported by tests.
const isEntry =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))

if (isEntry) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    await runAudioStatic({
      publicDir: join(process.cwd(), 'public'),
      apiKey: process.env.ELEVENLABS_API_KEY,
      force: process.argv.includes('--force'),
      confirm: async (q) => /^y(es)?$/i.test((await rl.question(q)).trim()),
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    rl.close()
  }
}
