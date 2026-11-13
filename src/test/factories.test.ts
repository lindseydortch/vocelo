import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, describe, expect, it } from 'vitest'
import { posts, users } from '~/db/schema'
import { createTestSql } from './db'
import { freezeTime } from './clock'
import { createTestPost, createTestUser, resetFactoryData } from './factories'

const sql = createTestSql()
const db = drizzle(sql, { casing: 'snake_case' })
afterAll(async () => {
  await sql.end()
})

describe('createTestUser', () => {
  it('defaults to a Free user with no Stripe data', async () => {
    const user = await createTestUser()
    expect(user).toMatchObject({
      plan: 'free',
      subscriptionStatus: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
    })
  })

  it('creates unique users on every call', async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser()])
    expect(a.id).not.toBe(b.id)
    expect(a.bufferAccountId).not.toBe(b.bufferAccountId)
  })

  it('defaults Creator to an active subscription with Stripe ids and a period', async () => {
    const user = await createTestUser({ plan: 'creator' })
    expect(user.plan).toBe('creator')
    expect(user.subscriptionStatus).toBe('active')
    expect(user.stripeCustomerId).toMatch(/^cus_/)
    expect(user.stripeSubscriptionId).toMatch(/^sub_/)
    expect(user.currentPeriodEnd!.getTime()).toBeGreaterThan(
      user.currentPeriodStart!.getTime(),
    )
  })

  it.each(['active', 'trialing', 'past_due', 'canceled'] as const)(
    'builds a Creator in %s',
    async (subscriptionStatus) => {
      const user = await createTestUser({ plan: 'creator', subscriptionStatus })
      expect(user.subscriptionStatus).toBe(subscriptionStatus)
    },
  )

  it('uses the project clock for the Creator period', async () => {
    freezeTime('2026-03-01T00:00:00Z')
    const user = await createTestUser({ plan: 'creator' })
    expect(user.currentPeriodStart).toEqual(new Date('2026-03-01T00:00:00Z'))
  })

  it('honors periodAnchorAt', async () => {
    const periodAnchorAt = new Date('2026-01-15T00:00:00Z')
    const user = await createTestUser({ periodAnchorAt })
    expect(user.periodAnchorAt).toEqual(periodAnchorAt)
  })

  it('rejects a subscriptionStatus on a Free user', async () => {
    await expect(
      createTestUser({ plan: 'free', subscriptionStatus: 'active' }),
    ).rejects.toThrow(/Free user/)
  })
})

describe('createTestPost', () => {
  it('defaults to a non-sample LinkedIn post owned by the user', async () => {
    const user = await createTestUser()
    const post = await createTestPost({ user })
    expect(post).toMatchObject({
      userId: user.id,
      bufferOrganizationId: user.bufferOrganizationId,
      channelService: 'linkedin',
      isSample: false,
      bufferPostId: null,
    })
    expect(post.text.length).toBeGreaterThan(0)
  })

  it('honors lastEditedAt, isSample and channelService', async () => {
    const user = await createTestUser()
    const lastEditedAt = new Date('2025-06-01T12:00:00Z')
    const post = await createTestPost({
      user,
      lastEditedAt,
      isSample: true,
      channelService: 'bluesky',
    })
    expect(post.lastEditedAt).toEqual(lastEditedAt)
    expect(post.isSample).toBe(true)
    expect(post.channelService).toBe('bluesky')
  })

  it('fails for a user that does not exist', async () => {
    await expect(
      createTestPost({
        user: {
          id: '00000000-0000-4000-8000-000000000000',
          bufferOrganizationId: 'org',
        },
      }),
    ).rejects.toThrow()
  })
})

describe('resetFactoryData', () => {
  it('deletes the users (and their posts) the factories created, nothing else', async () => {
    const mine = await createTestUser()
    const post = await createTestPost({ user: mine })
    const [maybeOther] = await db
      .insert(users)
      .values({
        bufferAccountId: `outsider_${mine.id}`,
        bufferOrganizationId: 'org',
      })
      .returning()
    const other = maybeOther!

    try {
      await resetFactoryData()

      expect(
        await db.select().from(users).where(eq(users.id, mine.id)),
      ).toEqual([])
      expect(
        await db.select().from(posts).where(eq(posts.id, post.id)),
      ).toEqual([])
      expect(
        await db.select().from(users).where(eq(users.id, other.id)),
      ).toHaveLength(1)
    } finally {
      await db.delete(users).where(eq(users.id, other.id))
    }
  })

  it('is a no-op when nothing was created', async () => {
    await expect(resetFactoryData()).resolves.toBeUndefined()
  })
})
