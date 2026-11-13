import { describe, expect, it } from 'vitest'
import { checkAndConsume, refund } from './usage'

describe('usage stub', () => {
  it('allows audio and LLM requests and supplies event IDs for refunds', async () => {
    const audio = await checkAndConsume('user-1', {
      postId: 'post-1',
      kind: 'tts_chars',
      amount: 12001,
    })
    const reaction = await checkAndConsume('user-1', {
      postId: 'post-1',
      kind: 'llm_call',
      amount: 1,
    })

    expect(audio.ok).toBe(true)
    expect(reaction.ok).toBe(true)
    if (!audio.ok || !reaction.ok) throw new Error('Expected usage to be allowed')
    expect(audio.eventId).toEqual(expect.any(String))
    expect(reaction.eventId).not.toBe(audio.eventId)
    await expect(refund(audio.eventId)).resolves.toBeUndefined()
  })

  it('accepts a refund for an unknown event without writing anything', async () => {
    await expect(refund('unknown-event')).resolves.toBeUndefined()
  })
})
