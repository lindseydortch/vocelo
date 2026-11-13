import { and, eq, gte, lt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { personas, posts, usageEvents } from '~/db/schema'
import { resetClock, setClock } from '~/lib/clock'
import { getEffectivePlan, getUsagePeriod } from '~/server/plan'
import { createTestPost, createTestUser } from './factories'
import { createTestSql } from './db'
import { PRESET_KEYS, PRESETS, isPresetKey, type PresetKey } from './presets'

const sql = createTestSql()
const db = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return db
  },
}))
const { checkAndConsume } = await import('~/server/usage')
const { lockedPostCount } = await import('~/server/visibility')

const NOW = new Date('2026-11-13T12:00:00.000Z')
const DAY = 86_400_000
const LIMITS = {
  free: { posts: 5, characters: 12_000 },
  creator: { posts: Infinity, characters: 80_000 },
}

beforeEach(() => setClock(() => NOW))
afterEach(() => resetClock())
afterAll(async () => {
  await sql.end()
})

/** Remaining usage the way the app counts it: events inside the current period. */
async function remaining(user: Awaited<ReturnType<typeof createTestUser>>) {
  const plan = getEffectivePlan(user)
  const period = getUsagePeriod(user, NOW)
  const events = await db
    .select()
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, user.id),
        gte(usageEvents.createdAt, period.start),
        lt(usageEvents.createdAt, period.end),
      ),
    )
  const reviewed = events.filter((e) => e.kind === 'post_review').length
  const chars = events
    .filter((e) => e.kind === 'tts_chars')
    .reduce((sum, e) => sum + e.amount, 0)
  return {
    plan,
    postsRemaining: LIMITS[plan].posts - reviewed,
    charactersRemaining: LIMITS[plan].characters - chars,
  }
}

describe('preset table', () => {
  it('has the 7 documented presets, each with a description', () => {
    expect([...PRESET_KEYS]).toEqual([
      'free',
      'free-at-limit',
      'free-low-chars',
      'free-downgraded',
      'creator',
      'creator-canceling',
      'creator-past-due',
    ])
    for (const key of PRESET_KEYS) {
      expect(PRESETS[key].description).not.toBe('')
    }
  })

  it('recognizes only preset keys', () => {
    expect(isPresetKey('creator-past-due')).toBe(true)
    expect(isPresetKey('team')).toBe(false)
    expect(isPresetKey(null)).toBe(false)
  })
})

describe('createTestUser({ preset })', () => {
  it.each(PRESET_KEYS)(
    '%s: effective plan and remaining usage match the description',
    async (key) => {
      const user = await createTestUser({ preset: key })
      expect(await remaining(user)).toEqual({
        plan: PRESETS[key].expected.plan,
        postsRemaining: PRESETS[key].expected.postsRemaining,
        charactersRemaining: PRESETS[key].expected.charactersRemaining,
      })
    },
  )

  it.each(PRESET_KEYS)(
    '%s: builds personas and backdated posts',
    async (key) => {
      const user = await createTestUser({ preset: key })
      const custom = await db
        .select()
        .from(personas)
        .where(eq(personas.userId, user.id))
      expect(custom).toHaveLength(PRESETS[key].customPersonas)
      const rows = await db
        .select()
        .from(posts)
        .where(eq(posts.userId, user.id))
      expect(
        rows
          .map((p) =>
            Math.round((NOW.getTime() - p.lastEditedAt.getTime()) / DAY),
          )
          .sort((a, b) => a - b),
      ).toEqual([...PRESETS[key].postAgesDays].sort((a, b) => a - b))
      expect(await lockedPostCount(user)).toBe(
        PRESETS[key].expected.lockedPosts,
      )
    },
  )

  it.each(PRESET_KEYS)(
    '%s: every review event points at a real post',
    async (key) => {
      const user = await createTestUser({ preset: key })
      const reviews = await db
        .select()
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, user.id),
            eq(usageEvents.kind, 'post_review'),
          ),
        )
      expect(reviews).toHaveLength(PRESETS[key].usage.reviewedPosts)
      expect(reviews.every((r) => r.postId !== null)).toBe(true)
    },
  )

  it('gives paid presets fake seed Stripe ids and Free presets none', async () => {
    const creator = await createTestUser({ preset: 'creator' })
    expect(creator.stripeCustomerId).toMatch(/^cus_seed_/)
    expect(creator.stripeSubscriptionId).toMatch(/^sub_seed_/)
    const free = await createTestUser({ preset: 'free' })
    expect(free.stripeCustomerId).toBeNull()
  })

  it('maps subscription state: past_due is Creator, canceled is Free, canceling flags the end', async () => {
    const pastDue = await createTestUser({ preset: 'creator-past-due' })
    expect(pastDue.subscriptionStatus).toBe('past_due')
    expect(getEffectivePlan(pastDue)).toBe('creator')
    const canceling = await createTestUser({ preset: 'creator-canceling' })
    expect(canceling.cancelAtPeriodEnd).toBe(true)
    expect(canceling.currentPeriodEnd).toEqual(
      new Date(NOW.getTime() + 3 * DAY),
    )
    const renewing = await createTestUser({ preset: 'creator' })
    expect(renewing.currentPeriodEnd).toEqual(
      new Date(NOW.getTime() + 20 * DAY),
    )
    const downgraded = await createTestUser({ preset: 'free-downgraded' })
    expect(downgraded.subscriptionStatus).toBe('canceled')
    expect(getEffectivePlan(downgraded)).toBe('free')
  })

  it('keeps dates relative to the injected clock', async () => {
    setClock(() => new Date('2027-02-01T00:00:00.000Z'))
    const user = await createTestUser({ preset: 'creator' })
    expect(user.currentPeriodEnd).toEqual(new Date('2027-02-21T00:00:00.000Z'))
  })

  it('rejects mixing a preset with plan fields', async () => {
    await expect(
      createTestUser({ preset: 'free', plan: 'creator' }),
    ).rejects.toThrow(/preset cannot be combined/)
  })
})

describe('preset behavior through usage enforcement', () => {
  const tryReview = async (key: PresetKey, amount: number) => {
    const user = await createTestUser({ preset: key })
    const post = await createTestPost({ user })
    return checkAndConsume(user.id, {
      postId: post.id,
      kind: 'tts_chars',
      amount,
    })
  }

  it('free-at-limit blocks a sixth post', async () => {
    expect(await tryReview('free-at-limit', 100)).toMatchObject({
      ok: false,
      reason: 'posts',
    })
  })

  it('free-low-chars blocks a read bigger than the 500 left but allows one that fits', async () => {
    expect(await tryReview('free-low-chars', 501)).toMatchObject({
      ok: false,
      reason: 'characters',
      remaining: 500,
    })
    expect(await tryReview('free-low-chars', 500)).toMatchObject({ ok: true })
  })

  it('free-downgraded gets a fresh Free allowance despite old paid usage', async () => {
    expect(await tryReview('free-downgraded', 12_000)).toMatchObject({
      ok: true,
    })
  })

  it('creator-past-due still has Creator allowances', async () => {
    expect(await tryReview('creator-past-due', 79_000)).toMatchObject({
      ok: true,
    })
  })
})
