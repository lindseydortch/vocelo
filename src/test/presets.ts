import { desc, eq } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/postgres-js'
// Relative imports only: `npm run seed` runs this file under plain Node (no `~` alias).
import { personas, posts, usageEvents, users } from '../db/schema.ts'
import { CUSTOM_VOICES } from '../lib/voices.ts'

/**
 * The 7 billing test users, shared by `createTestUser({ preset })`,
 * `npm run seed`, and `/__test/login?user=<key>`. Every date is relative to an
 * injected `now`, so a preset means the same thing on any day.
 */
export const PRESET_KEYS = [
  'free',
  'free-at-limit',
  'free-low-chars',
  'free-downgraded',
  'creator',
  'creator-canceling',
  'creator-past-due',
] as const

export type PresetKey = (typeof PRESET_KEYS)[number]

export const isPresetKey = (value: unknown): value is PresetKey =>
  PRESET_KEYS.some((key) => key === value)

type PresetSubscription = {
  status: 'active' | 'past_due' | 'canceled'
  cancelAtPeriodEnd: boolean
  periodStartDaysAgo: number
  /** Negative = the period already ended. */
  periodEndDaysAhead: number
}

export type Preset = {
  description: string
  subscription: PresetSubscription | null
  /** Free usage periods restart on this anniversary day. */
  periodAnchorDaysAgo: number
  /** Charges inside the current usage period. */
  usage: { reviewedPosts: number; ttsChars: number }
  /** Charges from an earlier paid period. They must not count toward the current one. */
  priorPeriodUsage?: { ttsChars: number; daysAgo: number }
  customPersonas: number
  /** `last_edited_at` of each post, in days before `now`. */
  postAgesDays: number[]
  /** What the app should show for this user, for tests to check against. */
  expected: {
    plan: 'free' | 'creator'
    /** Posts that can still be reviewed this period. */
    postsRemaining: number
    charactersRemaining: number
    lockedPosts: number
  }
}

export const PRESETS: Record<PresetKey, Preset> = {
  free: {
    description:
      'Free, early in the period: 2 of 5 posts, 3,000 of 12,000 chars',
    subscription: null,
    periodAnchorDaysAgo: 12,
    usage: { reviewedPosts: 2, ttsChars: 3_000 },
    customPersonas: 0,
    postAgesDays: [1, 3, 20],
    expected: {
      plan: 'free',
      postsRemaining: 3,
      charactersRemaining: 9_000,
      lockedPosts: 0,
    },
  },
  'free-at-limit': {
    description: 'Free, 5 of 5 posts reviewed: new reviews are blocked',
    subscription: null,
    periodAnchorDaysAgo: 12,
    usage: { reviewedPosts: 5, ttsChars: 6_000 },
    customPersonas: 0,
    postAgesDays: [1, 2, 3, 4, 5],
    expected: {
      plan: 'free',
      postsRemaining: 0,
      charactersRemaining: 6_000,
      lockedPosts: 0,
    },
  },
  'free-low-chars': {
    description: 'Free, 500 of 12,000 chars left: a long read is blocked',
    subscription: null,
    periodAnchorDaysAgo: 12,
    usage: { reviewedPosts: 3, ttsChars: 11_500 },
    customPersonas: 0,
    postAgesDays: [1, 2, 3],
    expected: {
      plan: 'free',
      postsRemaining: 2,
      charactersRemaining: 500,
      lockedPosts: 0,
    },
  },
  'free-downgraded': {
    description:
      'Canceled Creator, now Free: fresh period, 2 locked custom personas, posts older than 30 days locked',
    subscription: {
      status: 'canceled',
      cancelAtPeriodEnd: false,
      periodStartDaysAgo: 35,
      periodEndDaysAhead: -5,
    },
    periodAnchorDaysAgo: 5,
    usage: { reviewedPosts: 0, ttsChars: 0 },
    priorPeriodUsage: { ttsChars: 30_000, daysAgo: 20 },
    customPersonas: 2,
    postAgesDays: [3, 45, 50],
    expected: {
      plan: 'free',
      postsRemaining: 5,
      charactersRemaining: 12_000,
      lockedPosts: 2,
    },
  },
  creator: {
    description: 'Creator, active, renews in 20 days: 20,000 of 80,000 chars',
    subscription: {
      status: 'active',
      cancelAtPeriodEnd: false,
      periodStartDaysAgo: 10,
      periodEndDaysAhead: 20,
    },
    periodAnchorDaysAgo: 40,
    usage: { reviewedPosts: 3, ttsChars: 20_000 },
    customPersonas: 2,
    postAgesDays: [1, 10, 100],
    expected: {
      plan: 'creator',
      postsRemaining: Infinity,
      charactersRemaining: 60_000,
      lockedPosts: 0,
    },
  },
  'creator-canceling': {
    description:
      'Creator that cancels at period end in 3 days: still Creator until then',
    subscription: {
      status: 'active',
      cancelAtPeriodEnd: true,
      periodStartDaysAgo: 27,
      periodEndDaysAhead: 3,
    },
    periodAnchorDaysAgo: 90,
    usage: { reviewedPosts: 3, ttsChars: 70_000 },
    customPersonas: 3,
    postAgesDays: [1, 40, 200],
    expected: {
      plan: 'creator',
      postsRemaining: Infinity,
      charactersRemaining: 10_000,
      lockedPosts: 0,
    },
  },
  'creator-past-due': {
    description:
      'Creator whose payment failed (past_due): keeps Creator while Stripe retries',
    subscription: {
      status: 'past_due',
      cancelAtPeriodEnd: false,
      periodStartDaysAgo: 29,
      periodEndDaysAhead: 1,
    },
    periodAnchorDaysAgo: 60,
    usage: { reviewedPosts: 3, ttsChars: 1_000 },
    customPersonas: 1,
    postAgesDays: [2, 15, 60],
    expected: {
      plan: 'creator',
      postsRemaining: Infinity,
      charactersRemaining: 79_000,
      lockedPosts: 0,
    },
  },
}

const DAY = 86_400_000
const daysBefore = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY)

type PresetDb = Pick<ReturnType<typeof drizzle>, 'insert' | 'select'>

/** Who a preset user is. `suffix` makes the fake Stripe ids unique (`cus_seed_<suffix>`). */
export type PresetIdentity = {
  bufferAccountId: string
  bufferOrganizationId: string
  email: string
  suffix: string
}

/** The `users` row for a preset: plan, Stripe state, usage period. */
export function presetUserValues(
  key: PresetKey,
  now: Date,
  who: PresetIdentity,
): typeof users.$inferInsert {
  const preset = PRESETS[key]
  const sub = preset.subscription
  return {
    bufferAccountId: who.bufferAccountId,
    bufferOrganizationId: who.bufferOrganizationId,
    email: who.email,
    // A canceled subscription keeps `plan: 'creator'`; the effective plan comes from the status.
    plan: sub ? 'creator' : 'free',
    stripeCustomerId: sub ? `cus_seed_${who.suffix}` : null,
    stripeSubscriptionId: sub ? `sub_seed_${who.suffix}` : null,
    subscriptionStatus: sub ? sub.status : null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodStart: sub ? daysBefore(now, sub.periodStartDaysAgo) : null,
    currentPeriodEnd: sub ? daysBefore(now, -sub.periodEndDaysAhead) : null,
    periodAnchorAt: daysBefore(now, preset.periodAnchorDaysAgo),
  }
}

const AVATARS = ['coach', 'mentor', 'editor', 'dreamer', 'founder'] as const

/**
 * Adds a preset's custom personas, usage events, and (unless `posts: false`)
 * backdated posts to an existing user. Review events attach to the user's most
 * recently edited posts, so seeds can supply their own posts first.
 */
export async function populatePreset(
  db: PresetDb,
  user: { id: string; bufferOrganizationId: string },
  key: PresetKey,
  now: Date,
  options: { posts?: boolean } = {},
): Promise<void> {
  const preset = PRESETS[key]

  const voices = CUSTOM_VOICES.slice(3)
  if (preset.customPersonas > 0) {
    await db.insert(personas).values(
      Array.from({ length: preset.customPersonas }, (_, i) => ({
        userId: user.id,
        name: `Custom persona ${i + 1}`,
        bio: 'A custom reader added for testing.',
        avatarKey: AVATARS[i % AVATARS.length] as string,
        elevenlabsVoiceId: (voices[i % voices.length] ?? CUSTOM_VOICES[0]).id,
        readerDescription: 'Reads the post closely and says what stands out.',
      })),
    )
  }

  if (options.posts !== false) {
    await db.insert(posts).values(
      preset.postAgesDays.map((age, i) => {
        const at = daysBefore(now, age)
        return {
          userId: user.id,
          bufferOrganizationId: user.bufferOrganizationId,
          channelId: `channel_preset_${i}`,
          channelService: 'linkedin',
          channelName: 'Test linkedin',
          text: `Preset post ${i + 1}, edited ${age} days ago.`,
          createdAt: at,
          lastEditedAt: at,
        }
      }),
    )
  }

  const recent = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.userId, user.id))
    .orderBy(desc(posts.lastEditedAt))
  // Charges land a day ago: inside every preset's current period, never in the future.
  const at = daysBefore(now, 1)
  const events: (typeof usageEvents.$inferInsert)[] = []
  for (let i = 0; i < preset.usage.reviewedPosts; i++) {
    events.push({
      userId: user.id,
      kind: 'post_review',
      amount: 1,
      postId: recent[i]?.id ?? null,
      createdAt: at,
    })
  }
  if (preset.usage.ttsChars > 0) {
    events.push({
      userId: user.id,
      kind: 'tts_chars',
      amount: preset.usage.ttsChars,
      postId: recent[0]?.id ?? null,
      createdAt: at,
    })
  }
  if (preset.priorPeriodUsage) {
    events.push({
      userId: user.id,
      kind: 'tts_chars',
      amount: preset.priorPeriodUsage.ttsChars,
      postId: null,
      createdAt: daysBefore(now, preset.priorPeriodUsage.daysAgo),
    })
  }
  if (events.length > 0) await db.insert(usageEvents).values(events)
}
