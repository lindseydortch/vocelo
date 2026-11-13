import { and, count, desc, eq, gte, not, or } from 'drizzle-orm'
import { db } from '~/db/client'
import { posts, users, versions } from '~/db/schema'
import { now } from '~/lib/clock'
import { getEffectivePlan } from './plan'

type VisibilityUser = Pick<
  typeof users.$inferSelect,
  'id' | 'subscriptionStatus'
>

export function visiblePostsWhere(user: VisibilityUser) {
  const cutoff = now()
  if (getEffectivePlan(user) === 'creator') {
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  } else {
    cutoff.setUTCDate(cutoff.getUTCDate() - 30)
  }
  return and(
    eq(posts.userId, user.id),
    or(eq(posts.isSample, true), gte(posts.lastEditedAt, cutoff)),
  )!
}

export async function lockedPostCount(user: VisibilityUser): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(posts)
    .where(and(eq(posts.userId, user.id), not(visiblePostsWhere(user))))
  return result?.count ?? 0
}

export async function visibleVersions(user: VisibilityUser, postId: string) {
  const query = db
    .select({ version: versions })
    .from(versions)
    .innerJoin(posts, eq(versions.postId, posts.id))
    .where(and(eq(posts.id, postId), visiblePostsWhere(user)))
    .orderBy(desc(versions.createdAt), desc(versions.id))
    .$dynamic()
  const rows = await (getEffectivePlan(user) === 'free'
    ? query.limit(3)
    : query)
  return rows.map(({ version }) => version)
}
