import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '~/test/msw'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'
import { BufferTemporaryError } from './client'
import {
  BufferMutationError,
  BufferNotScheduledError,
  BufferQueueFullError,
  BufferUnknownMutationResultError,
  createDraft,
  editDraftText,
  moveBufferPostToDraft,
  scheduleBufferPost,
} from './mutations'

type Body = { query: string; variables: Record<string, unknown> }

function respond(data: unknown, capture?: (body: Body) => void) {
  server.use(
    http.post(BUFFER_GRAPHQL_URL, async ({ request }) => {
      capture?.((await request.json()) as Body)
      return HttpResponse.json({ data })
    }),
  )
}

describe('createDraft', () => {
  it('sends the draft input and returns the new post id + status', async () => {
    let body: Body | undefined
    respond(
      {
        createPost: {
          __typename: 'PostActionSuccess',
          post: { id: 'p1', status: 'draft' },
        },
      },
      (b) => (body = b),
    )

    const result = await createDraft('tok', 'ch1', 'hello')

    expect(result).toEqual({ id: 'p1', status: 'draft' })
    expect(body?.variables).toEqual({
      input: {
        channelId: 'ch1',
        text: 'hello',
        saveToDraft: true,
        mode: 'addToQueue',
        schedulingType: 'automatic',
        needsApproval: false,
        assets: [],
      },
    })
    expect(body?.query).toContain('createPost')
    expect(body?.query).toContain('... on MutationError')
  })

  it('throws BufferMutationError carrying Buffer message on InvalidInputError', async () => {
    respond({
      createPost: {
        __typename: 'InvalidInputError',
        message: 'LinkedIn posts cannot exceed 3000 characters.',
      },
    })

    const err = await createDraft('tok', 'ch1', 'x').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(BufferMutationError)
    expect((err as BufferMutationError).message).toBe(
      'LinkedIn posts cannot exceed 3000 characters.',
    )
    expect((err as BufferMutationError).typename).toBe('InvalidInputError')
  })

  it('throws BufferUnknownMutationResultError on an unrecognised payload', async () => {
    respond({ createPost: { __typename: 'Mystery' } })
    await expect(createDraft('tok', 'ch1', 'x')).rejects.toBeInstanceOf(
      BufferUnknownMutationResultError,
    )
  })

  it('lets temporary errors through unchanged', async () => {
    server.use(
      http.post(
        BUFFER_GRAPHQL_URL,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    await expect(createDraft('tok', 'ch1', 'x')).rejects.toBeInstanceOf(
      BufferTemporaryError,
    )
  })
})

describe('editDraftText', () => {
  it('sends only id + text and returns the post id + status', async () => {
    let body: Body | undefined
    respond(
      {
        editPost: {
          __typename: 'PostActionSuccess',
          post: { id: 'p1', status: 'draft' },
        },
      },
      (b) => (body = b),
    )

    const result = await editDraftText('tok', 'p1', 'new text')

    expect(result).toEqual({ id: 'p1', status: 'draft' })
    expect(body?.variables).toEqual({ input: { id: 'p1', text: 'new text' } })
    const sent = JSON.stringify(body)
    expect(sent).not.toContain('"assets"')
    expect(sent).not.toContain('"metadata"')
    expect(body?.query).toContain('editPost')
  })

  it('throws BufferMutationError on NotFoundError', async () => {
    respond({
      editPost: { __typename: 'NotFoundError', message: 'Post not found.' },
    })

    const err = await editDraftText('tok', 'gone', 'x').catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(BufferMutationError)
    expect((err as BufferMutationError).message).toBe('Post not found.')
    expect((err as BufferMutationError).typename).toBe('NotFoundError')
  })

  it('throws BufferMutationError on InvalidInputError', async () => {
    respond({
      editPost: { __typename: 'InvalidInputError', message: 'Too long.' },
    })
    await expect(editDraftText('tok', 'p1', 'x')).rejects.toBeInstanceOf(
      BufferMutationError,
    )
  })
})

describe('scheduleBufferPost', () => {
  const success = (status: string, dueAt?: string | null) => ({
    editPost: {
      __typename: 'PostActionSuccess',
      post: { id: 'p1', status, ...(dueAt === undefined ? {} : { dueAt }) },
    },
  })

  it('customScheduled sends text, mode, dueAt, saveToDraft:false and returns status + dueAt', async () => {
    let body: Body | undefined
    respond(success('scheduled', '2026-12-01T15:00:00.000Z'), (b) => (body = b))

    const result = await scheduleBufferPost('tok', 'p1', 'hello', {
      mode: 'customScheduled',
      dueAt: '2026-12-01T15:00:00.000Z',
    })

    expect(result).toEqual({
      status: 'scheduled',
      dueAt: '2026-12-01T15:00:00.000Z',
    })
    expect(body?.variables).toEqual({
      input: {
        id: 'p1',
        text: 'hello',
        mode: 'customScheduled',
        dueAt: '2026-12-01T15:00:00.000Z',
        saveToDraft: false,
        schedulingType: 'automatic',
      },
    })
    const sent = JSON.stringify(body)
    expect(sent).not.toContain('"assets"')
    expect(sent).not.toContain('"metadata"')
  })

  it('addToQueue omits dueAt and tolerates a response with no dueAt', async () => {
    let body: Body | undefined
    respond(success('scheduled'), (b) => (body = b))

    const result = await scheduleBufferPost('tok', 'p1', 'hello', {
      mode: 'addToQueue',
    })

    expect(result).toEqual({ status: 'scheduled', dueAt: null })
    expect(body?.variables).toEqual({
      input: {
        id: 'p1',
        text: 'hello',
        mode: 'addToQueue',
        saveToDraft: false,
        schedulingType: 'automatic',
      },
    })
  })

  it('returns needs_approval as a result, not an error', async () => {
    respond(success('needs_approval', null))
    await expect(
      scheduleBufferPost('tok', 'p1', 'hello', { mode: 'addToQueue' }),
    ).resolves.toEqual({ status: 'needs_approval', dueAt: null })
  })

  it('throws NOT_SCHEDULED when Buffer succeeds but the post is still a draft', async () => {
    respond(success('draft', '2026-12-01T15:00:00.000Z'))

    const err = await scheduleBufferPost('tok', 'p1', 'hello', {
      mode: 'customScheduled',
      dueAt: '2026-12-01T15:00:00.000Z',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(BufferNotScheduledError)
    expect((err as BufferNotScheduledError).code).toBe('NOT_SCHEDULED')
  })

  it('throws QUEUE_FULL with Buffer message on LimitReachedError', async () => {
    respond({
      editPost: {
        __typename: 'LimitReachedError',
        message: 'Scheduled post limit reached.',
      },
    })

    const err = await scheduleBufferPost('tok', 'p1', 'hello', {
      mode: 'addToQueue',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(BufferQueueFullError)
    expect((err as BufferQueueFullError).code).toBe('QUEUE_FULL')
    expect((err as BufferQueueFullError).message).toBe(
      'Scheduled post limit reached.',
    )
  })

  it('throws BufferMutationError on InvalidInputError', async () => {
    respond({
      editPost: {
        __typename: 'InvalidInputError',
        message: 'Invalid post: Post must have either text or media.',
      },
    })

    const err = await scheduleBufferPost('tok', 'p1', '', {
      mode: 'addToQueue',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(BufferMutationError)
    expect((err as BufferMutationError).message).toBe(
      'Invalid post: Post must have either text or media.',
    )
  })
})

describe('moveBufferPostToDraft', () => {
  it('sends only id, text and saveToDraft:true and returns status', async () => {
    let body: Body | undefined
    respond(
      {
        editPost: {
          __typename: 'PostActionSuccess',
          post: { id: 'p1', status: 'draft', dueAt: '2026-12-01T15:00:00.000Z' },
        },
      },
      (b) => (body = b),
    )

    const result = await moveBufferPostToDraft('tok', 'p1', 'hello')

    expect(result).toEqual({ status: 'draft' })
    expect(body?.variables).toEqual({
      input: { id: 'p1', text: 'hello', saveToDraft: true },
    })
    const sent = JSON.stringify(body)
    expect(sent).not.toContain('"assets"')
    expect(sent).not.toContain('"metadata"')
  })

  it('throws BufferMutationError on NotFoundError', async () => {
    respond({
      editPost: { __typename: 'NotFoundError', message: 'Post not found.' },
    })
    await expect(
      moveBufferPostToDraft('tok', 'gone', 'x'),
    ).rejects.toBeInstanceOf(BufferMutationError)
  })
})
