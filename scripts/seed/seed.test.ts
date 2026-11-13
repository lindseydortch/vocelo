import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { and, count, eq, like } from 'drizzle-orm'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { personas, posts, usageEvents, users, versions } from '~/db/schema'
import { getEffectivePlan } from '~/server/plan'
import { PRESET_KEYS, PRESETS } from '~/test/presets'
import { resetClock, setClock } from '~/lib/clock'
import { textHash } from '~/lib/text'
import { reactionSchema, toneReadSchema } from '~/server/llm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createTestSql, testDatabaseUrl } from '~/test/db'
import { checkSeedTarget } from './guard'
import { SEED_LIKE, runSeed } from './index'
import {
  DRAFT_TEXT,
  LINKEDIN_TEXT,
  SEED_POSTS,
  X_TEXT,
  type SeedPostKey,
} from './posts'

const script = fileURLToPath(new URL('./index.ts', import.meta.url))
const sql = createTestSql()
const db = drizzle(sql, { casing: 'snake_case' })
vi.mock('~/db/client', () => ({
  get db() {
    return db
  },
}))
const { visiblePostsWhere, lockedPostCount } =
  await import('~/server/visibility')

afterAll(async () => {
  await db.delete(users).where(like(users.bufferAccountId, SEED_LIKE))
  await sql.end()
})

afterEach(async () => {
  resetClock()
  await db.delete(users).where(like(users.bufferAccountId, SEED_LIKE))
  await db.delete(users).where(eq(users.bufferAccountId, 'real_user'))
  await db.delete(users).where(eq(users.bufferAccountId, 'seedXreal'))
})

describe('checkSeedTarget', () => {
  const url = 'postgres://u:p@ep-dev.neon.tech/db'

  it('allows a matching host', () => {
    expect(
      checkSeedTarget({
        DATABASE_URL: url,
        SEED_ALLOWED_HOST: 'ep-dev.neon.tech',
      }),
    ).toBeNull()
  })

  it('refuses a different host', () => {
    expect(
      checkSeedTarget({
        DATABASE_URL: url,
        SEED_ALLOWED_HOST: 'ep-prod.neon.tech',
      }),
    ).toMatch(/Refusing to seed/)
  })

  it('refuses when SEED_ALLOWED_HOST or DATABASE_URL is missing or invalid', () => {
    expect(checkSeedTarget({ DATABASE_URL: url })).toMatch(/SEED_ALLOWED_HOST/)
    expect(checkSeedTarget({ SEED_ALLOWED_HOST: 'x' })).toMatch(/DATABASE_URL/)
    expect(
      checkSeedTarget({ DATABASE_URL: 'nope', SEED_ALLOWED_HOST: 'x' }),
    ).toMatch(/valid URL/)
  })
})

describe('seed script', () => {
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, [script], {
      env: { PATH: process.env.PATH ?? '', ...env },
      encoding: 'utf8',
    })

  it('exits 1 and writes nothing when the host does not match', async () => {
    const result = run({
      DATABASE_URL: testDatabaseUrl(),
      SEED_ALLOWED_HOST: 'not-this-host',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/Refusing to seed/)
    const [row] = await db
      .select({ n: count() })
      .from(users)
      .where(like(users.bufferAccountId, SEED_LIKE))
    expect(row?.n).toBe(0)
  })

  it('seeds when the host matches', async () => {
    const result = run({
      DATABASE_URL: testDatabaseUrl(),
      SEED_ALLOWED_HOST: new URL(testDatabaseUrl()).hostname,
    })
    expect(result.status).toBe(0)
    const rows = await db
      .select()
      .from(users)
      .where(like(users.bufferAccountId, SEED_LIKE))
    expect(rows).toHaveLength(7)
  })
})

describe('runSeed', () => {
  it('creates all 7 billing presets, tagged and with preset state', async () => {
    await runSeed(db, NOW)
    for (const key of PRESET_KEYS) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.bufferAccountId, `seed_${key}`))
      expect(user, key).toBeDefined()
      expect(getEffectivePlan(user!)).toBe(PRESETS[key].expected.plan)
      const personaRows = await db
        .select()
        .from(personas)
        .where(eq(personas.userId, user!.id))
      expect(personaRows, key).toHaveLength(PRESETS[key].customPersonas)
      const reviews = await db
        .select()
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, user!.id),
            eq(usageEvents.kind, 'post_review'),
          ),
        )
      expect(reviews, key).toHaveLength(PRESETS[key].usage.reviewedPosts)
      if (user!.stripeCustomerId) {
        expect(user!.stripeCustomerId).toMatch(/^cus_seed_/)
        expect(user!.stripeSubscriptionId).toMatch(/^sub_seed_/)
      }
    }
  })

  it('creates a Free and an active Creator user with period dates', async () => {
    await runSeed(db)
    const rows = await db
      .select()
      .from(users)
      .where(like(users.bufferAccountId, SEED_LIKE))
    const free = rows.find((r) => r.bufferAccountId === 'seed_free')
    const creator = rows.find((r) => r.bufferAccountId === 'seed_creator')
    expect(free?.subscriptionStatus).toBeNull()
    expect(creator?.subscriptionStatus).toBe('active')
    expect(creator?.currentPeriodStart).toBeInstanceOf(Date)
    expect(creator?.currentPeriodEnd).toBeInstanceOf(Date)
  })

  it('is idempotent and leaves real users untouched', async () => {
    await db.insert(users).values({
      bufferAccountId: 'real_user',
      bufferOrganizationId: 'real_org',
    })
    await db.insert(users).values({
      bufferAccountId: 'seedXreal',
      bufferOrganizationId: 'real_org2',
    })
    await runSeed(db)
    await runSeed(db)
    const lookalike = await db
      .select({ n: count() })
      .from(users)
      .where(eq(users.bufferAccountId, 'seedXreal'))
    expect(lookalike[0]?.n).toBe(1)
    const seeded = await db
      .select({ n: count() })
      .from(users)
      .where(like(users.bufferAccountId, SEED_LIKE))
    const real = await db
      .select({ n: count() })
      .from(users)
      .where(eq(users.bufferAccountId, 'real_user'))
    expect(seeded[0]?.n).toBe(7)
    expect(real[0]?.n).toBe(1)
  })
})

const NOW = new Date('2026-11-13T12:00:00Z')

async function seeded(plan: 'free' | 'creator') {
  await runSeed(db, NOW)
  setClock(() => NOW)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.bufferAccountId, `seed_${plan}`))
  if (!user) throw new Error('missing seed user')
  const rows = await db.select().from(posts).where(eq(posts.userId, user.id))
  return { user, rows }
}

describe('seed posts (#41)', () => {
  it('gives each seed user the LinkedIn, X and imported-draft posts', async () => {
    for (const plan of ['free', 'creator'] as const) {
      const { rows } = await seeded(plan)
      expect(rows).toHaveLength(SEED_POSTS.length)
      const linkedin = rows.find((r) => r.text === LINKEDIN_TEXT)
      expect(linkedin?.channelService).toBe('linkedin')
      expect(linkedin?.text.length).toBeGreaterThan(700)
      expect(linkedin?.text.length).toBeLessThan(900)
      const x = rows.find((r) => r.text === X_TEXT)
      expect(x?.channelService).toBe('twitter')
      expect(x?.text.length).toBeLessThan(280)
      const draft = rows.find((r) => r.text === DRAFT_TEXT)
      expect(draft?.bufferStatus).toBe('draft')
      expect(draft?.bufferPostId).toBeTruthy()
    }
    expect(SEED_POSTS.find((p) => p.key === 'draft')?.assets).toBe(2)
  })

  it('writes version 1 for every post with the matching hash', async () => {
    const { rows } = await seeded('free')
    for (const row of rows) {
      const found = await db
        .select()
        .from(versions)
        .where(eq(versions.postId, row.id))
      expect(found).toHaveLength(1)
      expect(found[0]?.textHash).toBe(await textHash(row.text))
    }
  })

  it('locks the 45-day post for Free, and the 13-month post for both plans', async () => {
    const free = await seeded('free')
    const freeVisible = await db
      .select({ text: posts.text })
      .from(posts)
      .where(visiblePostsWhere(free.user))
    const old45 = SEED_POSTS.find((p) => p.key === 'old-45d')!.text
    const old13 = SEED_POSTS.find((p) => p.key === 'old-13mo')!.text
    expect(freeVisible.map((p) => p.text)).not.toContain(old45)
    expect(freeVisible.map((p) => p.text)).not.toContain(old13)
    expect(await lockedPostCount(free.user)).toBe(2)

    const creator = await seeded('creator')
    const creatorVisible = await db
      .select({ text: posts.text })
      .from(posts)
      .where(visiblePostsWhere(creator.user))
    expect(creatorVisible.map((p) => p.text)).toContain(old45)
    expect(creatorVisible.map((p) => p.text)).not.toContain(old13)
    expect(await lockedPostCount(creator.user)).toBe(1)
  })

  it('backdates last_edited_at by 45 days and 13 months', async () => {
    const { rows } = await seeded('creator')
    const at = (key: SeedPostKey) =>
      rows.find((r) => r.text === SEED_POSTS.find((p) => p.key === key)?.text)
        ?.lastEditedAt
    expect(at('old-45d')?.toISOString()).toBe('2026-09-29T12:00:00.000Z')
    expect(at('old-13mo')?.toISOString()).toBe('2025-10-13T12:00:00.000Z')
  })

  it('does not duplicate posts when re-run', async () => {
    await runSeed(db, NOW)
    await runSeed(db, NOW)
    const [row] = await db
      .select({ n: count() })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(like(users.bufferAccountId, SEED_LIKE))
    expect(row?.n).toBe(SEED_POSTS.length * 7)
  })
})

describe('LLM fixtures (#41)', () => {
  const fixtures = JSON.parse(
    readFileSync(
      new URL('../../fixtures/llm/seed-posts.json', import.meta.url),
      'utf8',
    ),
  ) as Record<
    string,
    {
      channel_service: string
      reactions: Record<string, unknown>
      toneRead: unknown
    }
  >

  it('has a valid reaction per standard persona and a Tone read for every seed post', () => {
    expect(Object.keys(fixtures).sort()).toEqual(
      SEED_POSTS.map((p) => p.key).sort(),
    )
    for (const fixture of Object.values(fixtures)) {
      expect(Object.keys(fixture.reactions).sort()).toEqual([
        'The Fan',
        'The Scroller',
        'The Skeptic',
      ])
      for (const reaction of Object.values(fixture.reactions)) {
        expect(reactionSchema.safeParse(reaction).success).toBe(true)
      }
      expect(toneReadSchema.safeParse(fixture.toneRead).success).toBe(true)
    }
  })

  it('rejects a fixture that breaks the schema', () => {
    expect(
      reactionSchema.safeParse({ reaction: '', sentiment: 'meh' }).success,
    ).toBe(false)
    expect(
      toneReadSchema.safeParse({ label: 'Bad', summary: 'x' }).success,
    ).toBe(false)
  })

  it('matches each post channel service', () => {
    for (const spec of SEED_POSTS) {
      expect(fixtures[spec.key]?.channel_service).toBe(spec.channelService)
    }
  })
})
