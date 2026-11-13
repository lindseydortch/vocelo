import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { posts, users } from '~/db/schema'
import { createTestDb } from '~/test/db'
import { createTestUser, resetFactoryData } from '~/test/factories'

const { db } = createTestDb()
afterAll(resetFactoryData)

const postValues = (user: { id: string; bufferOrganizationId: string }) => ({
  userId: user.id,
  bufferOrganizationId: user.bufferOrganizationId,
  channelService: 'linkedin',
  channelName: 'Test linkedin',
  text: 'A test post.',
})

describe('Buffer integration schema (#59)', () => {
  it('rejects a non-sample post without channel_id', async () => {
    const user = await createTestUser()
    await expect(
      db.insert(posts).values({ ...postValues(user), isSample: false }),
    ).rejects.toThrow()
  })

  it('accepts a sample post without channel_id', async () => {
    const user = await createTestUser()
    const [row] = await db
      .insert(posts)
      .values({ ...postValues(user), isSample: true })
      .returning()
    expect(row?.channelId).toBeNull()
  })

  it('accepts a non-sample post with a channel_id', async () => {
    const user = await createTestUser()
    const [row] = await db
      .insert(posts)
      .values({ ...postValues(user), channelId: 'ch_1' })
      .returning()
    expect(row?.channelId).toBe('ch_1')
  })

  it('accepts the new buffer_status values', async () => {
    const user = await createTestUser()
    for (const status of ['needs_approval', 'sending', 'error'] as const) {
      await db
        .insert(posts)
        .values({
          ...postValues(user),
          channelId: 'ch_1',
          bufferStatus: status,
        })
    }
  })

  it('stores a nullable channels cache on users', async () => {
    const user = await createTestUser()
    expect(user.channelsCache).toBeNull()
    expect(user.channelsCachedAt).toBeNull()
    const at = new Date('2026-01-01T00:00:00Z')
    await db
      .update(users)
      .set({ channelsCache: [{ id: 'ch_1' }], channelsCachedAt: at })
      .where(eq(users.id, user.id))
    const [row] = await db.select().from(users).where(eq(users.id, user.id))
    expect(row?.channelsCache).toEqual([{ id: 'ch_1' }])
    expect(row?.channelsCachedAt).toEqual(at)
  })
})
