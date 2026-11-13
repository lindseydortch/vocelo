export const BUFFER_GRAPHQL_URL = 'https://api.buffer.com'
export const LOW_RATE_LIMIT_THRESHOLD = 10

/** Token rejected (HTTP 401 or `UNAUTHORIZED`). The caller decides whether to refresh. */
export class BufferAuthError extends Error {
  constructor(message = 'Buffer rejected the access token') {
    super(message)
    this.name = 'BufferAuthError'
  }
}

/** Rate limit, network failure, or 5xx. Safe to try again later. */
export class BufferTemporaryError extends Error {
  constructor(
    message: string,
    readonly retryAfter?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'BufferTemporaryError'
  }
}

/** Any other GraphQL error or unexpected response. */
export class BufferRequestError extends Error {
  constructor(
    message: string,
    readonly errors?: GraphQLError[],
  ) {
    super(message)
    this.name = 'BufferRequestError'
  }
}

export type GraphQLError = {
  message: string
  extensions?: { code?: string; [k: string]: unknown }
}

type GraphQLResponse<T> = { data?: T | null; errors?: GraphQLError[] }

export type BufferRequestOptions = {
  accessToken: string
  query: string
  variables?: Record<string, unknown>
}

/** Seconds from a `retry-after` header (delta-seconds or HTTP date), if present. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds))
  const date = Date.parse(value)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

/** Remaining requests from `RateLimit: limit=100, remaining=5, reset=60` or `RateLimit-Remaining`. */
function parseRemaining(headers: Headers): number | undefined {
  const combined = headers.get('ratelimit')?.match(/remaining\s*=\s*(\d+)/i)
  const raw = combined?.[1] ?? headers.get('ratelimit-remaining')
  if (raw === null || raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function requestId(headers: Headers): string {
  return headers.get('x-request-id') ?? crypto.randomUUID()
}

export async function bufferRequest<T = unknown>({
  accessToken,
  query,
  variables,
}: BufferRequestOptions): Promise<T> {
  let res: Response
  try {
    res = await fetch(BUFFER_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    })
  } catch (cause) {
    throw new BufferTemporaryError('Could not reach Buffer', undefined, {
      cause,
    })
  }

  const remaining = parseRemaining(res.headers)
  if (remaining !== undefined && remaining < LOW_RATE_LIMIT_THRESHOLD) {
    console.warn(
      `[buffer] rate limit low: ${remaining} requests remaining (request ${requestId(res.headers)})`,
    )
  }

  if (res.status === 401) throw new BufferAuthError()
  if (res.status === 429) {
    throw new BufferTemporaryError(
      'Buffer rate limit exceeded',
      parseRetryAfter(res.headers.get('retry-after')),
    )
  }
  if (res.status >= 500) {
    throw new BufferTemporaryError(`Buffer returned HTTP ${res.status}`)
  }

  let body: GraphQLResponse<T>
  try {
    body = (await res.json()) as GraphQLResponse<T>
  } catch {
    throw new BufferRequestError(
      `Buffer returned an unreadable response (HTTP ${res.status})`,
    )
  }

  const errors = body.errors
  if (errors?.length) {
    if (errors.some((e) => e.extensions?.code === 'UNAUTHORIZED')) {
      throw new BufferAuthError()
    }
    if (errors.some((e) => e.extensions?.code === 'RATE_LIMIT_EXCEEDED')) {
      throw new BufferTemporaryError(
        'Buffer rate limit exceeded',
        parseRetryAfter(res.headers.get('retry-after')),
      )
    }
    throw new BufferRequestError(
      errors.map((e) => e.message).join('; '),
      errors,
    )
  }
  if (!res.ok)
    throw new BufferRequestError(`Buffer returned HTTP ${res.status}`)
  if (body.data === undefined || body.data === null) {
    throw new BufferRequestError('Buffer returned no data')
  }
  return body.data
}
