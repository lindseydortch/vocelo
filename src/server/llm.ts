import '@tanstack/react-start/server-only'
import { z } from 'zod'
import { TONE_LABELS } from '~/lib/tone'
import { env } from './env'

export const LLM_MODEL = 'claude-haiku-5-5'
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
export const LLM_TIMEOUT_MS = 20_000

export const reactionSchema = z.object({
  reaction: z.string().min(1).max(280),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
})
export const toneReadSchema = z.object({
  label: z.enum(TONE_LABELS),
  summary: z.string().min(1),
})
export type Reaction = z.infer<typeof reactionSchema>
export type ToneRead = z.infer<typeof toneReadSchema>

/**
 * `BUSY`: rate limited or overloaded (429, 529), worth trying again later.
 * `UNAVAILABLE`: our key or quota is the problem (401/403, billing, missing key); logged.
 * `FAILED`: anything else, including bad output, timeouts, other HTTP errors and refusals.
 */
export type LlmErrorCode = 'BUSY' | 'UNAVAILABLE' | 'FAILED'

export class LlmError extends Error {
  /** HTTP status when the failure was an API error response. */
  readonly status?: number
  /** Declined or cut off: a retry cannot help, so it is never retried. */
  readonly refused: boolean
  constructor(
    readonly code: LlmErrorCode,
    message: string,
    options?: { cause?: unknown; status?: number; refused?: boolean },
  ) {
    super(message, options)
    this.status = options?.status
    this.refused = options?.refused ?? false
    this.name = 'LlmError'
  }
}

/** A prompt built by `~/server/prompts`. */
export type LlmPrompt = { system: string; user: string }

/** A parsed result plus the model that produced it, so callers can store it. */
export type LlmResult<T> = T & { model: string }

export type LlmOptions = {
  provider?: 'anthropic' | 'fixture'
  apiKey?: string
  timeoutMs?: number
}

function errorForStatus(status: number, type: string | undefined): LlmError {
  const message = `Anthropic returned HTTP ${status}`
  if (status === 429 || status === 529 || type === 'overloaded_error') {
    return new LlmError('BUSY', message, { status })
  }
  if (
    status === 401 ||
    status === 403 ||
    status === 402 ||
    type === 'billing_error'
  ) {
    console.error(`[llm] Anthropic unavailable: ${status} ${type ?? ''}`.trim())
    return new LlmError('UNAVAILABLE', message, { status })
  }
  return new LlmError('FAILED', message, { status })
}

async function callOnce<T>(
  schema: z.ZodType<T>,
  { system, user }: LlmPrompt,
  apiKey: string,
  timeoutMs: number,
): Promise<LlmResult<T>> {
  let res: Response
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: {
          format: { type: 'json_schema', schema: z.toJSONSchema(schema) },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (cause) {
    throw new LlmError('FAILED', 'Anthropic request failed or timed out', {
      cause,
    })
  }
  if (!res.ok) {
    let type: string | undefined
    try {
      type = ((await res.json()) as { error?: { type?: string } }).error?.type
    } catch {
      // body wasn't JSON; the status alone decides
    }
    throw errorForStatus(res.status, type)
  }
  let body: {
    model?: string
    stop_reason?: string
    content: { type: string; text?: string }[]
  }
  try {
    body = await res.json()
  } catch (cause) {
    throw new LlmError('FAILED', 'Anthropic response was not JSON', { cause })
  }
  if (body.stop_reason === 'refusal') {
    throw new LlmError('FAILED', 'The model declined to answer', {
      refused: true,
    })
  }
  if (body.stop_reason === 'max_tokens') {
    // Truncated JSON; an identical retry truncates the same way.
    throw new LlmError('FAILED', 'Anthropic output was cut off', {
      refused: true,
    })
  }
  try {
    const text = body.content.find((b) => b.type === 'text')?.text ?? ''
    return { ...schema.parse(JSON.parse(text)), model: body.model ?? LLM_MODEL }
  } catch (cause) {
    throw new LlmError('FAILED', 'Anthropic output did not match the schema', {
      cause,
    })
  }
}

/** One call, one retry on parse failure, 5xx or timeout, then a typed `LlmError`. */
async function call<T>(
  schema: z.ZodType<T>,
  prompt: LlmPrompt,
  options: LlmOptions,
): Promise<LlmResult<T>> {
  const apiKey = options.apiKey ?? env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[llm] ANTHROPIC_API_KEY is not set')
    throw new LlmError('UNAVAILABLE', 'ANTHROPIC_API_KEY is not set')
  }
  const timeoutMs = options.timeoutMs ?? LLM_TIMEOUT_MS
  try {
    return await callOnce(schema, prompt, apiKey, timeoutMs)
  } catch (error) {
    // Refusals and 4xx (bad key, rate limit) won't improve on an immediate retry.
    if (
      error instanceof LlmError &&
      (error.refused || (error.status !== undefined && error.status < 500))
    ) {
      throw error
    }
    return callOnce(schema, prompt, apiKey, timeoutMs)
  }
}

/** A persona's reaction. Callers consume usage first and refund on `LlmError`. */
export async function getReaction(
  prompt: LlmPrompt,
  options: LlmOptions = {},
): Promise<LlmResult<Reaction>> {
  if ((options.provider ?? env.LLM_PROVIDER) === 'fixture') {
    return {
      reaction: 'A fixture reaction.',
      sentiment: 'neutral',
      model: 'fixture',
    }
  }
  return call(reactionSchema, prompt, options)
}

/** A whole-post tone label and one-sentence summary. Map to sentiment with `sentimentFor`. */
export async function getToneRead(
  prompt: LlmPrompt,
  options: LlmOptions = {},
): Promise<LlmResult<ToneRead>> {
  if ((options.provider ?? env.LLM_PROVIDER) === 'fixture') {
    return {
      label: 'Neutral',
      summary: 'A fixture tone read.',
      model: 'fixture',
    }
  }
  return call(toneReadSchema, prompt, options)
}
