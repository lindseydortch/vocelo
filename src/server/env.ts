import { z } from 'zod'

const required = (name: string) =>
  z.string({ error: `${name} is required` }).min(1, `${name} is required`)

const baseSchema = z.object({
  APP_URL: z.url({ error: 'APP_URL must be a URL' }),
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
  TOKEN_ENCRYPTION_KEY: required('TOKEN_ENCRYPTION_KEY').refine(
    (v) =>
      /^[A-Za-z0-9+/]+={0,2}$/.test(v) &&
      Buffer.from(v, 'base64').length === 32,
    'TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (generate: openssl rand -base64 32)',
  ),
  BUFFER_CLIENT_ID: required('BUFFER_CLIENT_ID'),
  BUFFER_CLIENT_SECRET: required('BUFFER_CLIENT_SECRET'),
  STRIPE_SECRET_KEY: required('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: required('STRIPE_WEBHOOK_SECRET'),
  STRIPE_CREATOR_PRICE_ID: required('STRIPE_CREATOR_PRICE_ID'),
  TTS_PROVIDER: z.enum(['browser', 'elevenlabs', 'fixture'], {
    error: 'TTS_PROVIDER must be one of: browser, elevenlabs, fixture',
  }),
  LLM_PROVIDER: z.enum(['anthropic', 'fixture'], {
    error: 'LLM_PROVIDER must be one of: anthropic, fixture',
  }),
  ELEVENLABS_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SEED_ALLOWED_HOST: z.string().optional(),
  BUFFER_API_KEY: z.string().optional(),
  DEMO_FALLBACK: z.string().optional(),
  E2E_AUTH: z.string().optional(),
})

const schema = baseSchema

function providerKeyIssues(
  env: Record<string, string | undefined>,
): { name: string; message: string }[] {
  const issues = []
  if (env.TTS_PROVIDER === 'elevenlabs' && !env.ELEVENLABS_API_KEY) {
    issues.push({
      name: 'ELEVENLABS_API_KEY',
      message: 'ELEVENLABS_API_KEY is required when TTS_PROVIDER=elevenlabs',
    })
  }
  if (env.LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    issues.push({
      name: 'ANTHROPIC_API_KEY',
      message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
    })
  }
  return issues
}

export const envNames = Object.keys(baseSchema.shape)

export type Env = z.infer<typeof schema>

export class EnvError extends Error {
  constructor(
    readonly names: string[],
    details: string[],
  ) {
    super(
      `Invalid environment. Fix these ${names.length} variable(s):\n${details.map((d) => `  - ${d}`).join('\n')}`,
    )
    this.name = 'EnvError'
  }
}

/** Empty strings count as unset, so a blank line in `.env.local` is reported as missing. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  )
  const result = schema.safeParse(cleaned)
  const issues = [
    ...(result.success
      ? []
      : result.error.issues.map((i) => ({
          name: String(i.path[0]),
          message: i.message,
        }))),
    ...providerKeyIssues(cleaned),
  ]
  if (issues.length === 0 && result.success) return result.data
  throw new EnvError(
    [...new Set(issues.map((i) => i.name))],
    issues.map((i) => i.message),
  )
}

let cached: Env | undefined

/** Validated on first access (server only), so importing this module never throws. */
export const env: Env = new Proxy({} as Env, {
  get(_t, key) {
    cached ??= parseEnv(process.env)
    return cached[key as keyof Env]
  },
})
