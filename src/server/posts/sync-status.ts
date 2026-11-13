import '@tanstack/react-start/server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { posts } from '~/db/schema'
import { BufferAuthExpiredError } from '~/server/auth/buffer-token'
import { getPost, type BufferStatus } from '~/server/buffer/queries'
import { withBuffer } from '~/server/buffer/with-buffer'

export type SyncResult =
  | { status: 'skipped' }
  | {
      status: 'synced'
      bufferStatus: BufferStatus
      dueAt: Date | null
      errorMessage: string | null
    }
  | { status: 'missingInBuffer' }
  | { status: 'unavailable' }

/**
 * Refreshes a post's `buffer_status` + `due_at` from Buffer (one `getPost`).
 * Skips posts with no Buffer post and the sample post. A post Buffer no
 * longer has is left untouched and flagged. Any Buffer failure (except a dead
 * connection, which must send the user back to sign in) is `unavailable`, so
 * the composer can still open with the last known status.
 */
export async function syncPostStatus(
  userId: string,
  postId: string,
): Promise<SyncResult> {
  const [post] = await db
    .select({
      bufferPostId: posts.bufferPostId,
      isSample: posts.isSample,
    })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
  if (!post?.bufferPostId || post.isSample) return { status: 'skipped' }
  const bufferPostId = post.bufferPostId

  let remote
  try {
    remote = await withBuffer(userId, (token) => getPost(token, bufferPostId))
  } catch (error) {
    if (error instanceof BufferAuthExpiredError) throw error
    return { status: 'unavailable' }
  }
  if (!remote) return { status: 'missingInBuffer' }

  const dueAt = remote.dueAt ? new Date(remote.dueAt) : null
  await db
    .update(posts)
    .set({ bufferStatus: remote.status, dueAt })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
  return {
    status: 'synced',
    bufferStatus: remote.status,
    dueAt,
    errorMessage: remote.error?.message ?? null,
  }
}
