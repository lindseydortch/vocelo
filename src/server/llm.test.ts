import { http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '~/test/msw'
import {
  ANTHROPIC_MESSAGES_URL,
  anthropicHandlers,
  anthropicMessage,
} from '~/test/msw/anthropic'
import { LlmError, getReaction, getToneRead } from './llm'

const prompt = { system: 'You are a Skeptic.', user: '<post>My post</post>' }
const live = { provider: 'anthropic', apiKey: 'sk-ant-secret' } as const
const reaction = {
  reaction: 'Bold claim. Show me data.',
  sentiment: 'negative',
}
const tone = { label: 'Confident', summary: 'Assured and direct.' }

/** Counts requests and answers each with `respond(callNumber)`. */
function counted(respond: (call: number) => Response) {
  const state = { calls: 0 }
  server.use(http.post(ANTHROPIC_MESSAGES_URL, () => respond(++state.calls)))
  return state
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('success', () => {
  it('sends the prompt, model, key and a JSON schema; returns the reaction and model', async () => {
    let seen:
      | {
          key: string | null
          body: {
            model: string
            system: string
            messages: { content: string }[]
            output_config: { format: { type: string } }
          }
        }
      | undefined
    server.use(
      http.post(ANTHROPIC_MESSAGES_URL, async ({ request }) => {
        seen = {
          key: request.headers.get('x-api-key'),
          body: (await request.json()) as NonNullable<typeof seen>['body'],
        }
        return Response.json(anthropicMessage(JSON.stringify(reaction)))
      }),
    )
    await expect(getReaction(prompt, live)).resolves.toEqual({
      ...reaction,
      model: 'claude-haiku-5-5',
    })
    expect(seen?.key).toBe('sk-ant-secret')
    expect(seen?.body.model).toBe('claude-haiku-5-5')
    expect(seen?.body.system).toBe(prompt.system)
    expect(seen?.body.messages[0]?.content).toBe(prompt.user)
    expect(seen?.body.output_config.format.type).toBe('json_schema')
  })

  it('returns the parsed tone read with the model', async () => {
    server.use(anthropicHandlers.json(tone))
    await expect(getToneRead(prompt, live)).resolves.toEqual({
      ...tone,
      model: 'claude-haiku-5-5',
    })
  })
})

describe('schemas', () => {
  it('rejects a reaction longer than 280 characters', async () => {
    server.use(
      anthropicHandlers.json({
        reaction: 'a'.repeat(281),
        sentiment: 'neutral',
      }),
    )
    await expect(getReaction(prompt, live)).rejects.toMatchObject({
      code: 'FAILED',
    })
  })

  it('rejects an unknown sentiment', async () => {
    server.use(anthropicHandlers.json({ reaction: 'ok', sentiment: 'angry' }))
    await expect(getReaction(prompt, live)).rejects.toMatchObject({
      code: 'FAILED',
    })
  })

  it('rejects a tone label outside the fixed list', async () => {
    server.use(anthropicHandlers.json({ label: 'Grumpy', summary: 's' }))
    await expect(getToneRead(prompt, live)).rejects.toBeInstanceOf(LlmError)
  })
})

describe('retries', () => {
  it('retries once after bad JSON, then succeeds', async () => {
    const state = counted((n) =>
      Response.json(
        anthropicMessage(n === 1 ? 'not json' : JSON.stringify(tone)),
      ),
    )
    await expect(getToneRead(prompt, live)).resolves.toMatchObject(tone)
    expect(state.calls).toBe(2)
  })

  it('retries once after bad JSON twice, then throws FAILED', async () => {
    const state = counted(() => Response.json(anthropicMessage('not json')))
    await expect(getToneRead(prompt, live)).rejects.toMatchObject({
      code: 'FAILED',
    })
    expect(state.calls).toBe(2)
  })

  it('retries once after a 500, then throws FAILED', async () => {
    const state = counted(() => new Response('{}', { status: 500 }))
    await expect(getReaction(prompt, live)).rejects.toMatchObject({
      code: 'FAILED',
      status: 500,
    })
    expect(state.calls).toBe(2)
  })

  it('retries a timeout once, then throws FAILED', async () => {
    let calls = 0
    server.use(
      http.post(ANTHROPIC_MESSAGES_URL, async () => {
        calls++
        await new Promise(() => {})
        return new Response(null)
      }),
    )
    await expect(
      getToneRead(prompt, { ...live, timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: 'FAILED' })
    expect(calls).toBe(2)
  })

  it('does not retry a refusal', async () => {
    const state = counted(() =>
      Response.json({ ...anthropicMessage(''), stop_reason: 'refusal' }),
    )
    await expect(getToneRead(prompt, live)).rejects.toMatchObject({
      code: 'FAILED',
      refused: true,
    })
    expect(state.calls).toBe(1)
  })
})

describe('error codes', () => {
  it('maps 429 to BUSY without retrying', async () => {
    const state = counted(() => new Response('{}', { status: 429 }))
    await expect(getToneRead(prompt, live)).rejects.toMatchObject({
      code: 'BUSY',
      status: 429,
    })
    expect(state.calls).toBe(1)
  })

  it('maps overloaded (529) to BUSY after one retry', async () => {
    server.use(anthropicHandlers.error(529, 'overloaded_error'))
    await expect(getToneRead(prompt, live)).rejects.toMatchObject({
      code: 'BUSY',
    })
  })

  it.each([401, 403])(
    'maps %s to UNAVAILABLE, logs it, and does not retry',
    async (status) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = counted(() => new Response('{}', { status }))
      await expect(getToneRead(prompt, live)).rejects.toMatchObject({
        code: 'UNAVAILABLE',
        status,
      })
      expect(state.calls).toBe(1)
      expect(log).toHaveBeenCalled()
    },
  )

  it('maps a billing error to UNAVAILABLE', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(anthropicHandlers.error(400, 'billing_error'))
    await expect(getToneRead(prompt, live)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
  })

  it('maps other 4xx to FAILED', async () => {
    server.use(anthropicHandlers.error(400, 'invalid_request_error'))
    await expect(getToneRead(prompt, live)).rejects.toMatchObject({
      code: 'FAILED',
    })
  })

  it('throws UNAVAILABLE when the key is missing, without a network call', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      getToneRead(prompt, { provider: 'anthropic', apiKey: '' }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })
})

describe('fixture provider', () => {
  it('returns canned results and a fixture model with no network', async () => {
    const r = await getReaction(prompt, { provider: 'fixture' })
    expect(r.reaction.length).toBeGreaterThan(0)
    expect(r.model).toBe('fixture')
    await expect(
      getToneRead(prompt, { provider: 'fixture' }),
    ).resolves.toMatchObject({ label: 'Neutral', model: 'fixture' })
  })
})
