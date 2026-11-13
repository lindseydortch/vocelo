import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { posts, users } from '~/db/schema'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { now } from '~/lib/clock'
import { registerCleanup } from './cleanup'
import { testDatabaseUrl } from './db'
import { populatePreset, presetUserValues, type PresetKey } from './presets'

export type TestPlan = 'free' | 'creator'
export type TestSubscriptionStatus =
  'active' | 'trialing' | 'past_due' | 'canceled'

export type TestUser = typeof users.$inferSelect
export type TestPost = typeof posts.$inferSelect

let sql: ReturnType<typeof postgres> | undefined
let client: ReturnType<typeof drizzle> | undefined
const createdUserIds = new Set<string>()

/** Drizzle client on the embedded test database; one per test file. */
function testDb() {
  if (!client) {
    sql = postgres(testDatabaseUrl(), { max: 2, prepare: false })
    client = drizzle(sql, { casing: 'snake_case' })
    registerCleanup(resetFactoryData)
  }
  return client
}

export type CreateTestUserInput = {
  /**
   * Builds a full billing scenario (plan, period, usage events, custom personas,
   * backdated posts) relative to the project clock. Cannot be combined with
   * `plan`, `subscriptionStatus`, or `periodAnchorAt`.
   */
  preset?: PresetKey
  plan?: TestPlan
  /** Creator only. Defaults to `active`. Ignored (must be unset) for Free. */
  subscriptionStatus?: TestSubscriptionStatus
  periodAnchorAt?: Date
}

/**
 * Inserts a user. Free has no Stripe data. Creator gets Stripe ids, a status
 * (default `active`) and a current period. `canceled` keeps `plan: 'creator'`:
 * the effective plan is derived from the status, not this column.
 */
export async function createTestUser(
  input: CreateTestUserInput = {},
): Promise<TestUser> {
  if (input.preset) return createPresetUser(input)
  const plan = input.plan ?? 'free'
  if (plan === 'free' && input.subscriptionStatus) {
    throw new Error(
      'createTestUser: a Free user cannot have a subscriptionStatus',
    )
  }
  const suffix = randomUUID()
  const anchor = input.periodAnchorAt ?? now()
  const paid =
    plan === 'creator'
      ? {
          stripeCustomerId: `cus_${suffix}`,
          stripeSubscriptionId: `sub_${suffix}`,
          subscriptionStatus: input.subscriptionStatus ?? 'active',
          currentPeriodStart: anchor,
          currentPeriodEnd: new Date(anchor.getTime() + 30 * 86_400_000),
        }
      : {}
  const rows = await testDb()
    .insert(users)
    .values({
      bufferAccountId: `buffer_acct_${suffix}`,
      bufferOrganizationId: `buffer_org_${suffix}`,
      email: `user-${suffix}@example.test`,
      plan,
      ...paid,
      ...(input.periodAnchorAt && { periodAnchorAt: input.periodAnchorAt }),
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('createTestUser: insert returned no row')
  createdUserIds.add(row.id)
  return row
}

async function createPresetUser(input: CreateTestUserInput): Promise<TestUser> {
  const { preset } = input
  if (!preset) throw new Error('createTestUser: preset is required')
  if (input.plan || input.subscriptionStatus || input.periodAnchorAt) {
    throw new Error(
      'createTestUser: preset cannot be combined with plan, subscriptionStatus, or periodAnchorAt',
    )
  }
  const suffix = randomUUID()
  const at = now()
  const db = testDb()
  const [row] = await db
    .insert(users)
    .values(
      presetUserValues(preset, at, {
        bufferAccountId: `buffer_acct_${suffix}`,
        bufferOrganizationId: `buffer_org_${suffix}`,
        email: `user-${suffix}@example.test`,
        suffix,
      }),
    )
    .returning()
  if (!row) throw new Error('createTestUser: insert returned no row')
  createdUserIds.add(row.id)
  await populatePreset(db, row, preset, at)
  return row
}

export type CreateTestPostInput = {
  user: Pick<TestUser, 'id' | 'bufferOrganizationId'>
  lastEditedAt?: Date
  isSample?: boolean
  channelService?: string
}

/** Inserts a post owned by `user` (a LinkedIn post by default). */
export async function createTestPost(
  input: CreateTestPostInput,
): Promise<TestPost> {
  const channelService = input.channelService ?? 'linkedin'
  const rows = await testDb()
    .insert(posts)
    .values({
      userId: input.user.id,
      bufferOrganizationId: input.user.bufferOrganizationId,
      channelId: `channel_${randomUUID()}`,
      channelService,
      channelName: `Test ${channelService}`,
      text: 'A test post.',
      ...(input.isSample !== undefined && { isSample: input.isSample }),
      ...(input.lastEditedAt && { lastEditedAt: input.lastEditedAt }),
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('createTestPost: insert returned no row')
  return row
}

/**
 * Deletes every user this test file created (posts, versions, reactions,
 * usage rows cascade) and closes the connection. Scoped to this file's rows,
 * so parallel test files never delete each other's data.
 */
export async function resetFactoryData(): Promise<void> {
  if (!client || !sql) return
  const ids = [...createdUserIds]
  createdUserIds.clear()
  const open = sql
  const db = client
  client = undefined
  sql = undefined
  try {
    if (ids.length) await db.delete(users).where(inArray(users.id, ids))
  } finally {
    await open?.end()
  }
}
