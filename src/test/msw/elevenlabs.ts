import { http, HttpResponse, delay } from 'msw'

export const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io'
export const elevenLabsTtsUrl = (voiceId: string) =>
  `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${voiceId}`

export const ELEVENLABS_MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3])

const detail = (status: string) => ({ detail: { status, message: status } })
const headers = { 'request-id': 'req_test_123' }

/** Success + error variants for `POST /v1/text-to-speech/:voiceId`. */
export const elevenLabsHandlers = {
  success: (bytes: Uint8Array = ELEVENLABS_MP3) =>
    http.post(elevenLabsTtsUrl(':voiceId'), () =>
      HttpResponse.arrayBuffer(bytes.slice().buffer, {
        headers: { 'content-type': 'audio/mpeg', ...headers },
      }),
    ),
  rateLimited: (status = 'too_many_concurrent_requests') =>
    http.post(elevenLabsTtsUrl(':voiceId'), () =>
      HttpResponse.json(detail(status), { status: 429, headers }),
    ),
  quotaExceeded: () =>
    http.post(elevenLabsTtsUrl(':voiceId'), () =>
      HttpResponse.json(detail('quota_exceeded'), { status: 401, headers }),
    ),
  serverError: (status = 500) =>
    http.post(elevenLabsTtsUrl(':voiceId'), () =>
      HttpResponse.json(detail('internal_error'), { status, headers }),
    ),
  hang: () =>
    http.post(elevenLabsTtsUrl(':voiceId'), async () => {
      await delay('infinite')
      return new HttpResponse(null)
    }),
}
