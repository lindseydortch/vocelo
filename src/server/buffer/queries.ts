import { bufferStatus } from '~/db/schema'
import { BufferRequestError, bufferRequest } from './client'

export type BufferStatus = (typeof bufferStatus.enumValues)[number]

const STATUSES: readonly string[] = bufferStatus.enumValues

/** Buffer returned a post status our `buffer_status` enum doesn't have. */
export class BufferUnknownStatusError extends Error {
  constructor(readonly status: string) {
    super(`Unknown Buffer post status: ${status}`)
    this.name = 'BufferUnknownStatusError'
  }
}

export type BufferChannel = {
  id: string
  name: string
  displayName: string | null
  service: string
  type: string
  timezone: string | null
  isDisconnected: boolean
  isLocked: boolean
  isQueuePaused: boolean
}

type PostChannel = {
  id: string
  isDisconnected: boolean
  isLocked: boolean
  isQueuePaused: boolean
}

export type BufferPost = {
  id: string
  status: BufferStatus
  dueAt: string | null
  text: string
  error: { message: string } | null
  assetCount: number
  channel: PostChannel
}

type RawPost = {
  id: string
  status: string
  dueAt: string | null
  text: string
  error: { message: string } | null
  assets: unknown[] | null
  channel: PostChannel
}

const CHANNEL_FIELDS = `id name displayName service type timezone isDisconnected isLocked isQueuePaused`
const POST_FIELDS = `id status dueAt text error { message } assets { id } channel { id isDisconnected isLocked isQueuePaused }`

export function mapStatus(status: string): BufferStatus {
  if (STATUSES.includes(status)) {
    return status as BufferStatus
  }
  throw new BufferUnknownStatusError(status)
}

function mapPost(raw: RawPost): BufferPost {
  return {
    id: raw.id,
    status: mapStatus(raw.status),
    dueAt: raw.dueAt,
    text: raw.text,
    error: raw.error,
    assetCount: raw.assets?.length ?? 0,
    channel: raw.channel,
  }
}

export async function listChannels(
  accessToken: string,
  orgId: string,
): Promise<BufferChannel[]> {
  const data = await bufferRequest<{ channels: BufferChannel[] }>({
    accessToken,
    query: `query Channels($organizationId: OrganizationId!) {
  channels(input: { organizationId: $organizationId }) { ${CHANNEL_FIELDS} }
}`,
    variables: { organizationId: orgId },
  })
  return data.channels
}

export async function getChannel(
  accessToken: string,
  id: string,
): Promise<BufferChannel> {
  const data = await bufferRequest<{ channel: BufferChannel }>({
    accessToken,
    query: `query Channel($id: ChannelId!) {
  channel(input: { id: $id }) { ${CHANNEL_FIELDS} }
}`,
    variables: { id },
  })
  return data.channel
}

/** One post, or `null` if Buffer reports it no longer exists. */
export async function getPost(
  accessToken: string,
  id: string,
): Promise<BufferPost | null> {
  try {
    const data = await bufferRequest<{ post: RawPost | null }>({
      accessToken,
      query: `query Post($id: PostId!) {
  post(input: { id: $id }) { ${POST_FIELDS} }
}`,
      variables: { id },
    })
    return data.post ? mapPost(data.post) : null
  } catch (error) {
    if (
      error instanceof BufferRequestError &&
      error.errors?.some((e) => e.extensions?.code === 'NOT_FOUND')
    ) {
      return null
    }
    throw error
  }
}

/** Drafts in the given channels, in Buffer's default order (no `sort` sent yet). Never cached. */
export async function listDraftPosts(
  accessToken: string,
  orgId: string,
  channelIds: string[],
  first = 20,
): Promise<BufferPost[]> {
  const data = await bufferRequest<{ posts: { edges: { node: RawPost }[] } }>({
    accessToken,
    query: `query DraftPosts($organizationId: OrganizationId!, $channelIds: [ChannelId!], $first: Int) {
  posts(first: $first, input: { organizationId: $organizationId, filter: { status: [draft], channelIds: $channelIds } }) {
    edges { node { ${POST_FIELDS} } }
  }
}`,
    variables: { organizationId: orgId, channelIds, first },
  })
  return data.posts.edges.map((edge) => mapPost(edge.node))
}
