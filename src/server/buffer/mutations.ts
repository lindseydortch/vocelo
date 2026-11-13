import { bufferRequest } from './client'
import { mapStatus, type BufferStatus } from './queries'

/** Buffer answered HTTP 200 with a `MutationError` (e.g. `InvalidInputError`, `NotFoundError`). */
export class BufferMutationError extends Error {
  constructor(
    message: string,
    /** GraphQL `__typename` of the error, e.g. `InvalidInputError`. */
    readonly typename: string,
  ) {
    super(message)
    this.name = 'BufferMutationError'
  }
}

/** The mutation returned neither `PostActionSuccess` nor a `MutationError`. */
export class BufferUnknownMutationResultError extends Error {
  constructor(readonly typename: string | undefined) {
    super(`Unexpected Buffer mutation result: ${typename ?? 'unknown'}`)
    this.name = 'BufferUnknownMutationResultError'
  }
}

/** Buffer's `LimitReachedError`: the channel's queue (or the plan's scheduled-post cap) is full. */
export class BufferQueueFullError extends Error {
  readonly code = 'QUEUE_FULL' as const
  constructor(message: string) {
    super(message)
    this.name = 'BufferQueueFullError'
  }
}

/** Buffer said success but the post is still a draft, so it was NOT scheduled. */
export class BufferNotScheduledError extends Error {
  readonly code = 'NOT_SCHEDULED' as const
  constructor() {
    super('Buffer accepted the request but the post is still a draft')
    this.name = 'BufferNotScheduledError'
  }
}

export type BufferWriteResult = { id: string; status: BufferStatus }

type MutationPayload = {
  __typename?: string
  message?: string
  post?: { id: string; status: string; dueAt?: string | null }
}

const RESULT_FIELDS = `__typename
  ... on PostActionSuccess { post { id status dueAt } }
  ... on MutationError { message }`

function unwrap(payload: MutationPayload | undefined): BufferWriteResult {
  const post = unwrapPost(payload)
  return { id: post.id, status: mapStatus(post.status) }
}

function unwrapPost(
  payload: MutationPayload | undefined,
): NonNullable<MutationPayload['post']> {
  if (payload?.post) return payload.post
  if (typeof payload?.message === 'string') {
    throw new BufferMutationError(
      payload.message,
      payload.__typename ?? 'MutationError',
    )
  }
  throw new BufferUnknownMutationResultError(payload?.__typename)
}

/** Creates a draft in Buffer. No metadata, tags or source (see project bible, Step 4). */
export async function createDraft(
  accessToken: string,
  channelId: string,
  text: string,
): Promise<BufferWriteResult> {
  const data = await bufferRequest<{ createPost?: MutationPayload }>({
    accessToken,
    query: `mutation CreateDraft($input: CreatePostInput!) {
  createPost(input: $input) {
    ${RESULT_FIELDS}
  }
}`,
    variables: {
      input: {
        channelId,
        text,
        saveToDraft: true,
        mode: 'addToQueue',
        schedulingType: 'automatic',
        needsApproval: false,
        assets: [],
      },
    },
  })
  return unwrap(data.createPost)
}

/**
 * Changes a draft's text. Sends only `id` + `text`: Buffer keeps any assets or
 * metadata we omit, so images added in Buffer survive.
 */
export async function editDraftText(
  accessToken: string,
  postId: string,
  text: string,
): Promise<BufferWriteResult> {
  const data = await bufferRequest<{ editPost?: MutationPayload }>({
    accessToken,
    query: `mutation EditDraftText($input: EditPostInput!) {
  editPost(input: $input) {
    ${RESULT_FIELDS}
  }
}`,
    variables: { input: { id: postId, text } },
  })
  return unwrap(data.editPost)
}

export type ScheduleOptions =
  | { mode: 'addToQueue'; dueAt?: undefined }
  | { mode: 'customScheduled'; dueAt: string }

export type BufferScheduleResult = {
  status: BufferStatus
  dueAt: string | null
}

async function editPost(
  accessToken: string,
  operation: string,
  input: Record<string, unknown>,
): Promise<NonNullable<MutationPayload['post']>> {
  const data = await bufferRequest<{ editPost?: MutationPayload }>({
    accessToken,
    query: `mutation ${operation}($input: EditPostInput!) {
  editPost(input: $input) {
    ${RESULT_FIELDS}
  }
}`,
    variables: { input },
  })
  const payload = data.editPost
  if (payload?.__typename === 'LimitReachedError') {
    throw new BufferQueueFullError(payload.message ?? 'Queue limit reached')
  }
  return unwrapPost(payload)
}

/**
 * Moves a saved draft into Buffer's queue or a custom time. `text` is required
 * by Buffer and `saveToDraft: false` is what actually leaves draft state, so we
 * trust the returned `status`, never the call succeeding. Never sends assets or
 * metadata, so Buffer keeps whatever it has.
 */
export async function scheduleBufferPost(
  accessToken: string,
  postId: string,
  text: string,
  options: ScheduleOptions,
): Promise<BufferScheduleResult> {
  const post = await editPost(accessToken, 'ScheduleBufferPost', {
    id: postId,
    text,
    mode: options.mode,
    ...(options.mode === 'customScheduled' ? { dueAt: options.dueAt } : {}),
    saveToDraft: false,
    schedulingType: 'automatic',
  })
  const status = mapStatus(post.status)
  if (status === 'draft') throw new BufferNotScheduledError()
  return { status, dueAt: post.dueAt ?? null }
}

/**
 * Moves a scheduled post back to draft. Buffer keeps the old `dueAt`, so
 * callers must decide from `status` only; it is deliberately not returned.
 */
export async function moveBufferPostToDraft(
  accessToken: string,
  postId: string,
  text: string,
): Promise<{ status: BufferStatus }> {
  const post = await editPost(accessToken, 'MoveBufferPostToDraft', {
    id: postId,
    text,
    saveToDraft: true,
  })
  return { status: mapStatus(post.status) }
}
