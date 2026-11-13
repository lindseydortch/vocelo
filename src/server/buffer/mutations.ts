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

export type BufferWriteResult = { id: string; status: BufferStatus }

type MutationPayload = {
  __typename?: string
  message?: string
  post?: { id: string; status: string }
}

const RESULT_FIELDS = `__typename
  ... on PostActionSuccess { post { id status } }
  ... on MutationError { message }`

function unwrap(payload: MutationPayload | undefined): BufferWriteResult {
  if (payload?.post) {
    return { id: payload.post.id, status: mapStatus(payload.post.status) }
  }
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
