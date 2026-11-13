import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { posts, users } from '~/db/schema'
import { visiblePostsWhere } from '~/server/visibility'

type PostUser = Pick<typeof users.$inferSelect, 'id' | 'subscriptionStatus'>
type Post = typeof posts.$inferSelect

export type PostLookup =
  | { status: 'ok'; post: Post; readOnly: boolean }
  | { status: 'locked' }
  | { status: 'not_found' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Opens a post for its owner. Someone else's, missing, or malformed ids are
 * `not_found` (never revealing existence); an own post outside the history
 * window is `locked`; the sample post is `readOnly`.
 */
export async function getPostForUser(
  user: PostUser,
  postId: string,
): Promise<PostLookup> {
  if (!UUID.test(postId)) return { status: 'not_found' }
  const [owned] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, user.id)))
    .limit(1)
  if (!owned) return { status: 'not_found' }
  const [visible] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), visiblePostsWhere(user)))
    .limit(1)
  if (!visible) return { status: 'locked' }
  return { status: 'ok', post: owned, readOnly: owned.isSample }
}
