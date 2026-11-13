import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { count, eq, like } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { users } from '~/db/schema'
import { createTestDb, testDatabaseUrl } from '~/test/db'
import { checkSeedTarget } from './guard'
import { SEED_TAG, runSeed } from './index'

const script = fileURLToPath(new URL('./index.ts', import.meta.url))
const { db } = createTestDb()

afterEach(async () => {
  await db.delete(users).where(like(users.bufferAccountId, `${SEED_TAG}%`))
  await db.delete(users).where(eq(users.bufferAccountId, 'real_user'))
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
      .where(like(users.bufferAccountId, `${SEED_TAG}%`))
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
      .where(like(users.bufferAccountId, `${SEED_TAG}%`))
    expect(rows).toHaveLength(2)
  })
})

describe('runSeed', () => {
  it('creates a Free and an active Creator user with period dates', async () => {
    await runSeed(db)
    const rows = await db
      .select()
      .from(users)
      .where(like(users.bufferAccountId, `${SEED_TAG}%`))
    const free = rows.find((r) => r.plan === 'free')
    const creator = rows.find((r) => r.plan === 'creator')
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
    await runSeed(db)
    await runSeed(db)
    const seeded = await db
      .select({ n: count() })
      .from(users)
      .where(like(users.bufferAccountId, `${SEED_TAG}%`))
    const real = await db
      .select({ n: count() })
      .from(users)
      .where(eq(users.bufferAccountId, 'real_user'))
    expect(seeded[0]?.n).toBe(2)
    expect(real[0]?.n).toBe(1)
  })
})
