import { http, HttpResponse, delay } from 'msw'

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

/** A Messages API response whose single text block holds `text`. */
export const anthropicMessage = (text: string) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
})

/** Success + error variants for `POST /v1/messages`. */
export const anthropicHandlers = {
  json: (value: unknown) =>
    http.post(ANTHROPIC_MESSAGES_URL, () =>
      HttpResponse.json(anthropicMessage(JSON.stringify(value))),
    ),
  /** An Anthropic-shaped error response, e.g. `error(429, 'rate_limit_error')`. */
  error: (status: number, type: string) =>
    http.post(ANTHROPIC_MESSAGES_URL, () =>
      HttpResponse.json(
        { type: 'error', error: { type, message: type } },
        { status },
      ),
    ),
  hang: () =>
    http.post(ANTHROPIC_MESSAGES_URL, async () => {
      await delay('infinite')
      return new HttpResponse(null)
    }),
}
