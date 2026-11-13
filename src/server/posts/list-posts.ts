import { desc } from 'drizzle-orm'
import { db } from '~/db/client'
import { posts, users } from '~/db/schema'
import { visiblePostsWhere } from '~/server/visibility'

export async function listPosts(
  user: Pick<typeof users.$inferSelect, 'id' | 'subscriptionStatus'>,
) {
  return db
    .select({
      id: posts.id,
      text: posts.text,
      channelName: posts.channelName,
      channelService: posts.channelService,
      lastEditedAt: posts.lastEditedAt,
      isSample: posts.isSample,
    })
    .from(posts)
    .where(visiblePostsWhere(user))
    .orderBy(desc(posts.lastEditedAt), desc(posts.id))
}
