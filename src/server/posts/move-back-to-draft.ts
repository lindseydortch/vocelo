import '@tanstack/react-start/server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { posts, users } from '~/db/schema'
import { getPost, type BufferStatus } from '~/server/buffer/queries'
import { moveBufferPostToDraft } from '~/server/buffer/mutations'
import { withBuffer } from '~/server/buffer/with-buffer'
import { consumeBufferWrite } from '~/server/usage'
import { visiblePostsWhere } from '~/server/visibility'

type MoveUser = Pick<typeof users.$inferSelect, 'id' | 'subscriptionStatus'>

export type MoveBackToDraftResult =
  | { ok: true; status: BufferStatus }
  | {
      ok: false
      code:
        | 'POST_NOT_FOUND'
        | 'POST_LOCKED'
        | 'READ_ONLY'
        | 'ALREADY_DRAFT'
        | 'ALREADY_POSTED'
        | 'NOT_IN_BUFFER'
        | 'NOT_A_DRAFT'
    }

/**
 * Moves a scheduled post back to draft in Buffer. Locks the post row and checks
 * Buffer once first; only a `scheduled` post costs a write (refunded if Buffer
 * fails, because the whole transaction rolls back). Every other branch just
 * syncs what Buffer said. `due_at` is cleared whenever the status isn't
 * `scheduled`, because Buffer keeps a stale `dueAt` on drafts.
 * Same on every plan; posts outside the history window are rejected.
 */
export async function moveBackToDraft(
  user: MoveUser,
  postId: string,
): Promise<MoveBackToDraftResult> {
  return db.transaction(async (tx): Promise<MoveBackToDraftResult> => {
    const [post] = await tx
      .select()
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, user.id)))
      .for('update')
      .limit(1)
    if (!post) return { ok: false, code: 'POST_NOT_FOUND' }
    if (post.isSample) return { ok: false, code: 'READ_ONLY' }
    const [visible] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, post.id), visiblePostsWhere(user)))
      .limit(1)
    if (!visible) return { ok: false, code: 'POST_LOCKED' }

    const bufferPostId = post.bufferPostId
    const save = (values: Partial<typeof posts.$inferInsert>) =>
      tx.update(posts).set(values).where(eq(posts.id, post.id))
    const forget = async (): Promise<MoveBackToDraftResult> => {
      await save({ bufferPostId: null, bufferStatus: null, dueAt: null })
      return { ok: false, code: 'NOT_IN_BUFFER' }
    }
    if (!bufferPostId) return forget()

    const remote = await withBuffer(user.id, (token) =>
      getPost(token, bufferPostId),
    )
    if (!remote) return forget()

    if (remote.status !== 'scheduled') {
      await save({ bufferStatus: remote.status, dueAt: null })
      if (remote.status === 'draft') return { ok: false, code: 'ALREADY_DRAFT' }
      if (remote.status === 'sending' || remote.status === 'sent') {
        return { ok: false, code: 'ALREADY_POSTED' }
      }
      return { ok: false, code: 'NOT_A_DRAFT' }
    }

    // A Buffer failure throws, rolling back the transaction and this write with it.
    await consumeBufferWrite(user.id, tx)
    const moved = await withBuffer(user.id, (token) =>
      moveBufferPostToDraft(token, bufferPostId, post.text),
    )
    const status = moved.status
    await save({
      bufferStatus: status,
      dueAt:
        status === 'scheduled' && remote.dueAt ? new Date(remote.dueAt) : null,
    })
    return { ok: true, status }
  })
}
