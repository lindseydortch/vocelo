import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '~/test/msw'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'
import {
  BufferAuthError,
  BufferRequestError,
  BufferTemporaryError,
  bufferRequest,
} from './client'

const call = () =>
  bufferRequest<{ account: { id: string } }>({
    accessToken: 'tok',
    query: 'query { account { id } }',
    variables: { a: 1 },
  })

afterEach(() => vi.restoreAllMocks())

describe('bufferRequest', () => {
  it('posts query, variables and bearer token, and returns typed data', async () => {
    let seen: { auth: string | null; body: unknown } | undefined
    server.use(
      http.post(BUFFER_GRAPHQL_URL, async ({ request }) => {
        seen = {
          auth: request.headers.get('authorization'),
          body: await request.json(),
        }
        return HttpResponse.json({ data: { account: { id: 'acc1' } } })
      }),
    )
    const data = await call()
    expect(data.account.id).toBe('acc1')
    expect(seen).toEqual({
      auth: 'Bearer tok',
      body: { query: 'query { account { id } }', variables: { a: 1 } },
    })
  })

  it('throws BufferAuthError on HTTP 401', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 401 }),
      ),
    )
    await expect(call()).rejects.toBeInstanceOf(BufferAuthError)
  })

  it('throws BufferAuthError on UNAUTHORIZED in a 200 body', async () => {
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({
          errors: [{ message: 'no', extensions: { code: 'UNAUTHORIZED' } }],
        }),
      ),
    )
    await expect(call()).rejects.toBeInstanceOf(BufferAuthError)
  })

  it('throws BufferTemporaryError with retryAfter on HTTP 429', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { 'retry-after': '42' },
          }),
      ),
    )
    const err = await call().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BufferTemporaryError)
    expect((err as BufferTemporaryError).retryAfter).toBe(42)
  })

  it('throws BufferTemporaryError on RATE_LIMIT_EXCEEDED in a 200 body', async () => {
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json(
          {
            errors: [
              { message: 'slow', extensions: { code: 'RATE_LIMIT_EXCEEDED' } },
            ],
          },
          { headers: { 'retry-after': '7' } },
        ),
      ),
    )
    const err = await call().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BufferTemporaryError)
    expect((err as BufferTemporaryError).retryAfter).toBe(7)
  })

  it('leaves retryAfter undefined when the header is missing', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 429 }),
      ),
    )
    const err = (await call().catch((e: unknown) => e)) as BufferTemporaryError
    expect(err.retryAfter).toBeUndefined()
  })

  it('throws BufferTemporaryError on 5xx', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    await expect(call()).rejects.toBeInstanceOf(BufferTemporaryError)
  })

  it('throws BufferTemporaryError on network errors', async () => {
    server.use(http.post(BUFFER_GRAPHQL_URL, () => HttpResponse.error()))
    await expect(call()).rejects.toBeInstanceOf(BufferTemporaryError)
  })

  it('throws BufferRequestError on other GraphQL errors', async () => {
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({
          errors: [{ message: 'nope', extensions: { code: 'NOT_FOUND' } }],
        }),
      ),
    )
    await expect(call()).rejects.toBeInstanceOf(BufferRequestError)
  })

  it('throws BufferRequestError on an unreadable body', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse('<html>', { status: 200 }),
      ),
    )
    await expect(call()).rejects.toBeInstanceOf(BufferRequestError)
  })

  it('warns with a request ID when fewer than 10 requests remain', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json(
          { data: { account: { id: 'a' } } },
          {
            headers: {
              ratelimit: 'limit=100, remaining=3, reset=60',
              'x-request-id': 'req-9',
            },
          },
        ),
      ),
    )
    await call()
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]![0])).toContain('req-9')
  })

  it('does not warn when 10 or more remain', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json(
          { data: { account: { id: 'a' } } },
          { headers: { ratelimit: 'limit=100, remaining=10, reset=60' } },
        ),
      ),
    )
    await call()
    expect(warn).not.toHaveBeenCalled()
  })
})
