import { randomUUID } from 'node:crypto'
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { posts, usageEvents, users } from '~/db/schema'
import { now } from '~/lib/clock'
import { getEffectivePlan, getUsagePeriod } from './plan'

export type UsageRequest = {
  postId: string
  kind: 'tts_chars' | 'llm_call'
  amount: number
}

export type UsageResult =
  | { ok: true; eventId: string }
  | {
      ok: false
      reason: 'posts' | 'characters' | 'rate'
      needed: number
      remaining: number
    }

const LIMITS = {
  free: { posts: 5, characters: 12_000 },
  creator: { posts: Infinity, characters: 80_000 },
} as const
const LLM_CALLS_PER_HOUR = 60
const HOUR_MS = 3_600_000

/**
 * Reserve usage before calling a provider. Locks the user row, checks the
 * current usage period, and records the charge in one transaction, so
 * concurrent requests can't overspend.
 * Free allows five reviewed posts and 12,000 voice characters per period;
 * Creator allows unlimited posts and 80,000 characters. Both plans allow 60
 * LLM calls per hour. A post is reviewed once per period on its first paid
 * action (a `post_review` event is recorded alongside the charge); sample
 * posts never consume usage. Requests exceeding a limit fail in full with the
 * amount needed and remaining, and write nothing.
 * Free periods follow the signup anchor (reset when a subscription ends); paid
 * periods follow Stripe. Active, trialing, and past-due subscriptions are Creator.
 */
export async function checkAndConsume(
  userId: string,
  request: UsageRequest,
): Promise<UsageResult> {
  const { postId, kind, amount } = request
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Usage amount must be a positive integer')
  }

  return db.transaction(async (tx): Promise<UsageResult> => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
    if (!user) throw new Error('Usage user not found')
    const [post] = await tx
      .select({ id: posts.id, isSample: posts.isSample })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    if (!post) throw new Error('Usage post not found for user')
    // Samples are free. The ID is never stored, so refunding it is a no-op.
    if (post.isSample) return { ok: true, eventId: randomUUID() }

    const at = now()
    const limits = LIMITS[getEffectivePlan(user)]
    const period = getUsagePeriod(user, at)
    const inPeriod = and(
      eq(usageEvents.userId, userId),
      gte(usageEvents.createdAt, period.start),
      lt(usageEvents.createdAt, period.end),
    )

    const reviews = await tx
      .select({ postId: usageEvents.postId })
      .from(usageEvents)
      .where(and(inPeriod, eq(usageEvents.kind, 'post_review')))
    const alreadyReviewed = reviews.some((r) => r.postId === postId)
    if (!alreadyReviewed && reviews.length >= limits.posts) {
      return { ok: false, reason: 'posts', needed: 1, remaining: 0 }
    }

    if (kind === 'tts_chars') {
      const [used] = await tx
        .select({
          total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)::int`,
        })
        .from(usageEvents)
        .where(and(inPeriod, eq(usageEvents.kind, 'tts_chars')))
      const remaining = Math.max(0, limits.characters - (used?.total ?? 0))
      if (amount > remaining) {
        return { ok: false, reason: 'characters', needed: amount, remaining }
      }
    } else {
      const [used] = await tx
        .select({
          total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)::int`,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.kind, 'llm_call'),
            gte(usageEvents.createdAt, new Date(at.getTime() - HOUR_MS)),
          ),
        )
      const remaining = Math.max(0, LLM_CALLS_PER_HOUR - (used?.total ?? 0))
      if (amount > remaining) {
        return { ok: false, reason: 'rate', needed: amount, remaining }
      }
    }

    if (!alreadyReviewed) {
      await tx.insert(usageEvents).values({
        userId,
        kind: 'post_review',
        amount: 1,
        postId,
        createdAt: at,
      })
    }
    const [event] = await tx
      .insert(usageEvents)
      .values({ userId, kind, amount, postId, createdAt: at })
      .returning({ id: usageEvents.id })
    if (!event) throw new Error('Usage event insert returned no row')
    return { ok: true, eventId: event.id }
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Refund a reservation after a provider failure by deleting its usage event.
 * The post's `post_review` event stays: the post still counts as reviewed this
 * period. Deleting a post itself never refunds usage. Unknown IDs (and the
 * throwaway IDs returned for sample posts) are ignored.
 */
export async function refund(eventId: string): Promise<void> {
  if (!UUID.test(eventId)) return
  await db
    .delete(usageEvents)
    .where(
      and(
        eq(usageEvents.id, eventId),
        inArray(usageEvents.kind, ['tts_chars', 'llm_call']),
      ),
    )
}
