import { http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '~/test/msw'
import {
  ANTHROPIC_MESSAGES_URL,
  anthropicHandlers,
  anthropicMessage,
} from '~/test/msw/anthropic'
import { LlmError, getReaction, getToneRead } from './llm'

const persona = { name: 'Skeptic', readerDescription: 'Doubts big claims.' }
const live = { provider: 'anthropic', apiKey: 'sk-ant-secret' } as const
const reaction = {
  reaction: 'Bold claim. Show me data.',
  sentiment: 'negative',
}
const tone = { label: 'Confident', summary: 'Assured and direct.' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getReaction / getToneRead: anthropic', () => {
  it('sends the model, key and a JSON schema, and returns the parsed reaction', async () => {
    let seen:
      | {
          key: string | null
          body: {
            model: string
            messages: unknown
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
    await expect(getReaction(persona, 'My post', live)).resolves.toEqual(
      reaction,
    )
    expect(seen?.key).toBe('sk-ant-secret')
    expect(seen?.body.model).toBe('claude-haiku-5-5')
    expect(seen?.body.output_config.format.type).toBe('json_schema')
    expect(JSON.stringify(seen?.body.messages)).toContain('My post')
  })

  it('returns the parsed tone read', async () => {
    server.use(anthropicHandlers.json(tone))
    await expect(getToneRead('My post', live)).resolves.toEqual(tone)
  })

  it('retries once after a parse failure, then succeeds', async () => {
    let calls = 0
    server.use(
      http.post(ANTHROPIC_MESSAGES_URL, () => {
        calls++
        return Response.json(
          anthropicMessage(calls === 1 ? 'not json' : JSON.stringify(tone)),
        )
      }),
    )
    await expect(getToneRead('x', live)).resolves.toEqual(tone)
    expect(calls).toBe(2)
  })

  it('retries once after a 5xx, then throws LlmError', async () => {
    let calls = 0
    server.use(
      http.post(ANTHROPIC_MESSAGES_URL, () => {
        calls++
        return new Response('{}', { status: 500 })
      }),
    )
    await expect(getReaction(persona, 'x', live)).rejects.toMatchObject({
      name: 'LlmError',
      code: 'API',
    })
    expect(calls).toBe(2)
  })

  it('throws LlmError PARSE when output breaks the schema twice', async () => {
    server.use(anthropicHandlers.json({ reaction: 'ok', sentiment: 'angry' }))
    await expect(getReaction(persona, 'x', live)).rejects.toMatchObject({
      code: 'PARSE',
    })
  })

  it('rejects a tone label outside the fixed list', async () => {
    server.use(anthropicHandlers.json({ label: 'Grumpy', summary: 's' }))
    await expect(getToneRead('x', live)).rejects.toBeInstanceOf(LlmError)
  })

  it('throws LlmError when the key is missing, without a network call', async () => {
    await expect(
      getToneRead('x', { provider: 'anthropic', apiKey: '' }),
    ).rejects.toMatchObject({ code: 'API' })
  })
})

describe('getReaction / getToneRead: fixture', () => {
  it('returns canned results with no network', async () => {
    const r = await getReaction(persona, 'anything', { provider: 'fixture' })
    expect(r.reaction.length).toBeGreaterThan(0)
    expect(['positive', 'neutral', 'negative']).toContain(r.sentiment)
    await expect(
      getToneRead('anything', { provider: 'fixture' }),
    ).resolves.toMatchObject({ label: 'Neutral' })
  })
})
