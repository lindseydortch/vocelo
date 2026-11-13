import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '~/test/msw'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'
import { BufferTemporaryError } from './client'
import {
  BufferUnknownStatusError,
  getChannel,
  getPost,
  listChannels,
  listDraftPosts,
} from './queries'

type Body = { query: string; variables: Record<string, unknown> }

const channel = {
  id: 'ch1',
  name: 'lindsey',
  displayName: 'Lindsey',
  service: 'linkedin',
  type: 'profile',
  timezone: 'America/Chicago',
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
}

const post = {
  id: 'p1',
  status: 'draft',
  dueAt: null,
  text: 'hello',
  error: null,
  assets: [{ id: 'a1' }, { id: 'a2' }],
  channel: {
    id: 'ch1',
    isDisconnected: false,
    isLocked: true,
    isQueuePaused: false,
  },
}

function respond(data: unknown, capture?: (body: Body) => void) {
  server.use(
    http.post(BUFFER_GRAPHQL_URL, async ({ request }) => {
      capture?.((await request.json()) as Body)
      return HttpResponse.json({ data })
    }),
  )
}

describe('listChannels', () => {
  it('returns the organization channels and sends the org id', async () => {
    let body: Body | undefined
    respond({ channels: [channel] }, (b) => (body = b))
    await expect(listChannels('tok', 'org1')).resolves.toEqual([channel])
    expect(body?.variables).toMatchObject({ organizationId: 'org1' })
  })
})

describe('getChannel', () => {
  it('returns one channel by id', async () => {
    let body: Body | undefined
    respond({ channel }, (b) => (body = b))
    await expect(getChannel('tok', 'ch1')).resolves.toEqual(channel)
    expect(body?.variables).toMatchObject({ id: 'ch1' })
  })
})

describe('queue-paused flag', () => {
  it.each([true, false])(
    'getChannel returns isQueuePaused=%s and requests the field',
    async (isQueuePaused) => {
      let body: Body | undefined
      respond({ channel: { ...channel, isQueuePaused } }, (b) => (body = b))
      const result = await getChannel('tok', 'ch1')
      expect(result.isQueuePaused).toBe(isQueuePaused)
      expect(body?.query).toContain('isQueuePaused')
    },
  )

  it.each([true, false])(
    'getPost returns channel.isQueuePaused=%s and requests the field',
    async (isQueuePaused) => {
      let body: Body | undefined
      respond(
        { post: { ...post, channel: { ...post.channel, isQueuePaused } } },
        (b) => (body = b),
      )
      const result = await getPost('tok', 'p1')
      expect(result?.channel.isQueuePaused).toBe(isQueuePaused)
      expect(body?.query).toContain('isQueuePaused')
    },
  )
})

describe('list queries request the flag too', () => {
  it('listChannels and listDraftPosts include isQueuePaused', async () => {
    let body: Body | undefined
    respond({ channels: [channel] }, (b) => (body = b))
    await listChannels('tok', 'org1')
    expect(body?.query).toContain('isQueuePaused')
    respond({ posts: { edges: [{ node: post }] } }, (b) => (body = b))
    await listDraftPosts('tok', 'org1', ['ch1'])
    expect(body?.query).toContain('isQueuePaused')
  })
})

describe('channel queries', () => {
  it.each([
    ['listChannels', () => listChannels('tok', 'org1')],
    ['getChannel', () => getChannel('tok', 'ch1')],
  ])('%s lets temporary errors through', async (_name, run) => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    await expect(run()).rejects.toBeInstanceOf(BufferTemporaryError)
  })
})

describe('getPost', () => {
  it('maps a post, counting assets and keeping channel flags', async () => {
    respond({ post })
    await expect(getPost('tok', 'p1')).resolves.toEqual({
      id: 'p1',
      status: 'draft',
      dueAt: null,
      text: 'hello',
      error: null,
      assetCount: 2,
      channel: post.channel,
    })
  })

  it('carries error message and dueAt', async () => {
    respond({
      post: {
        ...post,
        status: 'error',
        dueAt: '2026-11-14T10:00:00.000Z',
        error: { message: 'boom' },
      },
    })
    const result = await getPost('tok', 'p1')
    expect(result?.error).toEqual({ message: 'boom' })
    expect(result?.dueAt).toBe('2026-11-14T10:00:00.000Z')
  })

  it.each(['draft', 'needs_approval', 'scheduled', 'sending', 'sent', 'error'])(
    'accepts status %s unchanged',
    async (status) => {
      respond({ post: { ...post, status } })
      expect((await getPost('tok', 'p1'))?.status).toBe(status)
    },
  )

  it('returns null when Buffer says NOT_FOUND', async () => {
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({
          data: null,
          errors: [{ message: 'gone', extensions: { code: 'NOT_FOUND' } }],
        }),
      ),
    )
    await expect(getPost('tok', 'p1')).resolves.toBeNull()
  })

  it('returns null when the post comes back empty', async () => {
    respond({ post: null })
    await expect(getPost('tok', 'p1')).resolves.toBeNull()
  })

  it('throws BufferUnknownStatusError on an unknown status', async () => {
    respond({ post: { ...post, status: 'banana' } })
    await expect(getPost('tok', 'p1')).rejects.toBeInstanceOf(
      BufferUnknownStatusError,
    )
  })

  it('lets temporary errors through', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    await expect(getPost('tok', 'p1')).rejects.toBeInstanceOf(
      BufferTemporaryError,
    )
  })

  it('does not swallow other GraphQL errors', async () => {
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({ errors: [{ message: 'bad query' }] }),
      ),
    )
    await expect(getPost('tok', 'p1')).rejects.toThrow('bad query')
  })
})

describe('listDraftPosts', () => {
  const edges = [{ node: post }, { node: { ...post, id: 'p2', assets: [] } }]

  it('returns mapped drafts, defaulting first to 20', async () => {
    let body: Body | undefined
    respond({ posts: { edges } }, (b) => (body = b))
    const posts = await listDraftPosts('tok', 'org1', ['ch1'])
    expect(posts.map((p) => [p.id, p.assetCount])).toEqual([
      ['p1', 2],
      ['p2', 0],
    ])
    expect(body?.variables).toMatchObject({
      organizationId: 'org1',
      channelIds: ['ch1'],
      first: 20,
    })
    expect(body?.query).toMatch(/status: \[draft\]/)
    expect(body?.query).toMatch(/channelIds: \$channelIds/)
  })

  it('honors a custom first', async () => {
    let body: Body | undefined
    respond({ posts: { edges: [] } }, (b) => (body = b))
    await expect(listDraftPosts('tok', 'org1', ['ch1'], 5)).resolves.toEqual([])
    expect(body?.variables.first).toBe(5)
  })

  it('throws BufferUnknownStatusError on an unknown status', async () => {
    respond({ posts: { edges: [{ node: { ...post, status: 'weird' } }] } })
    await expect(listDraftPosts('tok', 'org1', ['ch1'])).rejects.toBeInstanceOf(
      BufferUnknownStatusError,
    )
  })

  it('lets temporary errors through', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 429 }),
      ),
    )
    await expect(listDraftPosts('tok', 'org1', ['ch1'])).rejects.toBeInstanceOf(
      BufferTemporaryError,
    )
  })
})
