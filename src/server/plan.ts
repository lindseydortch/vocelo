import type { users } from '../db/schema'

type User = typeof users.$inferSelect

/** Subscription statuses that grant Creator. */
export const PAID_STATUSES: readonly string[] = [
  'active',
  'trialing',
  'past_due',
]

export function getEffectivePlan(
  user: Pick<User, 'subscriptionStatus'>,
): 'free' | 'creator' {
  return PAID_STATUSES.includes(user.subscriptionStatus ?? '')
    ? 'creator'
    : 'free'
}

type PeriodUser = Pick<
  User,
  | 'subscriptionStatus'
  | 'periodAnchorAt'
  | 'currentPeriodStart'
  | 'currentPeriodEnd'
>

function monthlyBoundary(anchor: Date, offset: number): Date {
  const boundary = new Date(anchor)
  boundary.setUTCDate(1)
  boundary.setUTCMonth(anchor.getUTCMonth() + offset)
  const lastDay = new Date(boundary)
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0)
  boundary.setUTCDate(Math.min(anchor.getUTCDate(), lastDay.getUTCDate()))
  return boundary
}

export function getUsagePeriod(
  user: PeriodUser,
  now: Date,
): { start: Date; end: Date } {
  if (getEffectivePlan(user) === 'creator') {
    if (!user.currentPeriodStart || !user.currentPeriodEnd) {
      throw new Error('Paid user is missing Stripe usage period')
    }
    return { start: user.currentPeriodStart, end: user.currentPeriodEnd }
  }

  const anchor = user.periodAnchorAt
  let offset =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    anchor.getUTCMonth()
  if (monthlyBoundary(anchor, offset) > now) offset--
  return {
    start: monthlyBoundary(anchor, offset),
    end: monthlyBoundary(anchor, offset + 1),
  }
}
