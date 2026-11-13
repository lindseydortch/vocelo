import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { now } from '~/lib/clock'
import { BufferTemporaryError } from './client'
import { listChannels, type BufferChannel } from './queries'
import { withBuffer } from './with-buffer'

export const CHANNELS_CACHE_TTL_MS = 10 * 60_000

const SUPPORTED_SERVICES: readonly string[] = [
  'linkedin',
  'twitter',
  'substack',
  'threads',
  'bluesky',
  'mastodon',
]

export type ChannelStatus = 'selectable' | 'unsupported' | 'needsReconnect'

export type TaggedChannel = BufferChannel & { status: ChannelStatus }

export type ChannelList = { channels: TaggedChannel[]; stale: boolean }

const toList = (channels: BufferChannel[], stale: boolean): ChannelList => ({
  channels: channels.map(tagChannel),
  stale,
})

function tagChannel(channel: BufferChannel): TaggedChannel {
  const status: ChannelStatus = !SUPPORTED_SERVICES.includes(channel.service)
    ? 'unsupported'
    : channel.isDisconnected || channel.isLocked
      ? 'needsReconnect'
      : 'selectable'
  return { ...channel, status }
}

/**
 * The user's Buffer channels, tagged for the picker. Cached on the user row for
 * 10 minutes; `refresh` bypasses the cache. If Buffer is temporarily down, a
 * cached list (however old) is returned with `stale: true`; with no cache the
 * error is thrown.
 */
export async function getChannels(
  userId: string,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<ChannelList> {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new Error(`getChannels: user ${userId} not found`)

  const cached = Array.isArray(user.channelsCache)
    ? (user.channelsCache as BufferChannel[])
    : null
  const cachedAt = user.channelsCachedAt

  if (
    !refresh &&
    cached &&
    cachedAt &&
    now().getTime() - cachedAt.getTime() < CHANNELS_CACHE_TTL_MS
  ) {
    return toList(cached, false)
  }

  try {
    const fresh = await withBuffer(userId, (token) =>
      listChannels(token, user.bufferOrganizationId),
    )
    await db
      .update(users)
      .set({ channelsCache: fresh, channelsCachedAt: now() })
      .where(eq(users.id, userId))
    return toList(fresh, false)
  } catch (error) {
    if (error instanceof BufferTemporaryError && cached) {
      return toList(cached, true)
    }
    throw error
  }
}
