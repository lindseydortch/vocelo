import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { resetClock, setClock } from '~/lib/clock'
import { users } from '~/db/schema'
import { createTestSql } from '~/test/db'
import { createTestUser, resetFactoryData } from '~/test/factories'
import { server } from '~/test/msw'
import { BUFFER_GRAPHQL_URL } from '~/test/handlers/buffer'

const sql = createTestSql()
const db = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return db
  },
}))
vi.mock('./with-buffer', () => ({
  withBuffer: (_userId: string, fn: (token: string) => Promise<unknown>) =>
    fn('tok'),
}))
const { getChannels } = await import('./channels')
const { BufferTemporaryError } = await import('./client')

afterAll(async () => {
  await resetFactoryData()
  await sql.end()
})
afterEach(resetClock)

const T0 = new Date('2026-11-13T12:00:00Z')
const minutesLater = (m: number) => new Date(T0.getTime() + m * 60_000)

const base = {
  displayName: null,
  type: 'profile',
  timezone: null,
  isDisconnected: false,
  isLocked: false,
}
const channel = (id: string, over: Record<string, unknown> = {}) => ({
  ...base,
  id,
  name: id,
  service: 'linkedin',
  ...over,
})

function mockBuffer(channels: unknown[]) {
  const calls = { count: 0, orgIds: [] as unknown[] }
  server.use(
    http.post(BUFFER_GRAPHQL_URL, async ({ request }) => {
      calls.count++
      const body = (await request.json()) as {
        variables: { organizationId: unknown }
      }
      calls.orgIds.push(body.variables.organizationId)
      return HttpResponse.json({ data: { channels } })
    }),
  )
  return calls
}

function mockBufferDown() {
  server.use(
    http.post(BUFFER_GRAPHQL_URL, () => new HttpResponse(null, { status: 503 })),
  )
}

async function cachedRow(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId))
  return row!
}

describe('getChannels caching', () => {
  it('fetches and stores the list when nothing is cached', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    const calls = mockBuffer([channel('a')])
    const result = await getChannels(user.id)
    expect(calls.count).toBe(1)
    expect(calls.orgIds).toEqual([user.bufferOrganizationId])
    expect(result.stale).toBe(false)
    expect(result.channels.map((c) => c.id)).toEqual(['a'])
    const row = await cachedRow(user.id)
    expect(row.channelsCachedAt).toEqual(T0)
    expect(row.channelsCache).toEqual([channel('a')])
  })

  it('serves a fresh cache with 0 Buffer calls', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('a')])
    await getChannels(user.id)
    setClock(() => minutesLater(9))
    const calls = mockBuffer([channel('other')])
    const result = await getChannels(user.id)
    expect(calls.count).toBe(0)
    expect(result).toMatchObject({ stale: false })
    expect(result.channels.map((c) => c.id)).toEqual(['a'])
  })

  it('refetches once the cache is 11 minutes old', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('a')])
    await getChannels(user.id)
    setClock(() => minutesLater(11))
    const calls = mockBuffer([channel('b')])
    const result = await getChannels(user.id)
    expect(calls.count).toBe(1)
    expect(result.channels.map((c) => c.id)).toEqual(['b'])
    expect((await cachedRow(user.id)).channelsCachedAt).toEqual(
      minutesLater(11),
    )
  })

  it('refresh bypasses a fresh cache with 1 Buffer call', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('a')])
    await getChannels(user.id)
    setClock(() => minutesLater(1))
    const calls = mockBuffer([channel('b')])
    const result = await getChannels(user.id, { refresh: true })
    expect(calls.count).toBe(1)
    expect(result.channels.map((c) => c.id)).toEqual(['b'])
  })
})

describe('getChannels tagging', () => {
  it.each([
    ['linkedin', {}, 'selectable'],
    ['twitter', {}, 'selectable'],
    ['substack', {}, 'selectable'],
    ['threads', {}, 'selectable'],
    ['bluesky', {}, 'selectable'],
    ['mastodon', {}, 'selectable'],
    ['instagram', {}, 'unsupported'],
    ['linkedin', { isDisconnected: true }, 'needsReconnect'],
    ['linkedin', { isLocked: true }, 'needsReconnect'],
  ])('%s %j is %s', async (service, flags, expected) => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('c', { service, ...flags })])
    const result = await getChannels(user.id)
    expect(result.channels[0]?.status).toBe(expected)
  })

  it('treats an unsupported service as unsupported even when disconnected', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('c', { service: 'instagram', isDisconnected: true })])
    const result = await getChannels(user.id)
    expect(result.channels[0]?.status).toBe('unsupported')
  })

  it('keeps the channel fields alongside the tag', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('c', { displayName: 'Cee' })])
    const result = await getChannels(user.id)
    expect(result.channels[0]).toMatchObject({
      id: 'c',
      displayName: 'Cee',
      service: 'linkedin',
    })
  })
})

describe('getChannels when Buffer is down', () => {
  it('returns the stale cache flagged stale: true', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('a')])
    await getChannels(user.id)
    setClock(() => minutesLater(30))
    mockBufferDown()
    const result = await getChannels(user.id)
    expect(result.stale).toBe(true)
    expect(result.channels.map((c) => c.id)).toEqual(['a'])
    expect((await cachedRow(user.id)).channelsCachedAt).toEqual(T0)
  })

  it('also falls back to the cache on refresh', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('a')])
    await getChannels(user.id)
    mockBufferDown()
    const result = await getChannels(user.id, { refresh: true })
    expect(result.stale).toBe(true)
  })

  it('throws when there is no cache', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBufferDown()
    await expect(getChannels(user.id)).rejects.toBeInstanceOf(
      BufferTemporaryError,
    )
  })

  it('does not hide non-temporary errors behind the cache', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    mockBuffer([channel('a')])
    await getChannels(user.id)
    setClock(() => minutesLater(30))
    server.use(
      http.post(BUFFER_GRAPHQL_URL, () =>
        HttpResponse.json({ errors: [{ message: 'bad' }] }),
      ),
    )
    await expect(getChannels(user.id)).rejects.toThrow()
  })
})

describe('getChannels for a missing user', () => {
  it('throws', async () => {
    mockBuffer([])
    await expect(
      getChannels('00000000-0000-4000-8000-000000000000'),
    ).rejects.toThrow(/user/i)
  })
})

describe('getChannels with a malformed cache', () => {
  it('ignores a non-array cache and fetches', async () => {
    setClock(() => T0)
    const user = await createTestUser()
    await db
      .update(users)
      .set({ channelsCache: { oops: true }, channelsCachedAt: T0 })
      .where(eq(users.id, user.id))
    const calls = mockBuffer([channel('a')])
    const result = await getChannels(user.id)
    expect(calls.count).toBe(1)
    expect(result.channels.map((c) => c.id)).toEqual(['a'])
  })
})
