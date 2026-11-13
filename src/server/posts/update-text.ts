import { createServerFn } from '@tanstack/react-start'
import type { UpdatePostTextError } from '~/lib/errors'

export type UpdatePostTextInput = {
  postId: string
  text: string
  /** The `last_edited_at` (ISO) the client loaded or last got back. */
  baseEditedAt: string
  /** "Keep mine": skip the conflict check. */
  force?: boolean
}

export type UpdatePostTextResult =
  { ok: true; lastEditedAt: string } | UpdatePostTextError

function parseInput(input: unknown): UpdatePostTextInput {
  const i = input as Partial<UpdatePostTextInput> | null
  if (
    !i ||
    typeof i.postId !== 'string' ||
    typeof i.text !== 'string' ||
    typeof i.baseEditedAt !== 'string' ||
    Number.isNaN(Date.parse(i.baseEditedAt)) ||
    (i.force !== undefined && typeof i.force !== 'boolean')
  ) {
    throw new Error('Invalid updatePostText input')
  }
  return {
    postId: i.postId,
    text: i.text,
    baseEditedAt: i.baseEditedAt,
    ...(i.force !== undefined && { force: i.force }),
  }
}

/**
 * Autosave to Vocelo only. Never writes a version, never touches usage, and
 * bumps `last_edited_at` only when the text actually changed.
 */
export const updatePostText = createServerFn({ method: 'POST' })
  .validator(parseInput)
  .handler(async ({ data }): Promise<UpdatePostTextResult> => {
    const { requireUser } = await import('~/server/auth/session')
    const { db } = await import('~/db/client')
    const { posts } = await import('~/db/schema')
    const { visiblePostsWhere } = await import('~/server/visibility')
    const { now } = await import('~/lib/clock')
    const { MAX_POST_CHARS, normalizeText } = await import('~/lib/text')
    const { and, eq } = await import('drizzle-orm')

    const { user } = await requireUser()
    const text = normalizeText(data.text)
    if (text.length > MAX_POST_CHARS)
      return { ok: false, code: 'TEXT_TOO_LONG' }

    return db.transaction(async (tx) => {
      const [post] = await tx
        .select()
        .from(posts)
        .where(and(eq(posts.id, data.postId), eq(posts.userId, user.id)))
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

      if (
        !data.force &&
        post.lastEditedAt.getTime() > new Date(data.baseEditedAt).getTime()
      ) {
        return {
          ok: false,
          code: 'EDIT_CONFLICT',
          text: post.text,
          lastEditedAt: post.lastEditedAt.toISOString(),
        }
      }
      if (post.text === text) {
        return { ok: true, lastEditedAt: post.lastEditedAt.toISOString() }
      }
      const lastEditedAt = now()
      await tx
        .update(posts)
        .set({ text, lastEditedAt })
        .where(eq(posts.id, post.id))
      return { ok: true, lastEditedAt: lastEditedAt.toISOString() }
    })
  })
