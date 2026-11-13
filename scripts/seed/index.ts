import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from '../../src/db/schema.ts'
import { checkSeedTarget } from './guard.ts'
import { seedPostsFor } from './posts.ts'

type SeedDb = ReturnType<typeof drizzle>

/**
 * Seed rows are tagged by a `seed_` Buffer account id. Everything else
 * (real users) is never matched. Deleting a user cascades to its rows.
 */
export const SEED_TAG = 'seed_'
/** LIKE pattern for the tag; `_` is a wildcard in LIKE, so it is escaped. */
export const SEED_LIKE = `${SEED_TAG.replaceAll('_', '\\_')}%`
const DAY = 86_400_000

/** Deletes every seed user, then re-creates one per purchasable plan, each with backdated posts. */
export async function runSeed(db: SeedDb, now = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(users).where(like(users.bufferAccountId, SEED_LIKE))
    const seeded = await tx
      .insert(users)
      .values([
        {
          bufferAccountId: `${SEED_TAG}free`,
          bufferOrganizationId: `${SEED_TAG}org_free`,
          email: 'seed-free@example.test',
          plan: 'free',
        },
        {
          bufferAccountId: `${SEED_TAG}creator`,
          bufferOrganizationId: `${SEED_TAG}org_creator`,
          email: 'seed-creator@example.test',
          plan: 'creator',
          stripeCustomerId: `cus_${SEED_TAG}creator`,
          stripeSubscriptionId: `sub_${SEED_TAG}creator`,
          subscriptionStatus: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * DAY),
          periodAnchorAt: now,
        },
      ])
      .returning()
    for (const user of seeded) await seedPostsFor(tx, user, now)
  })
}

// Node 24 runs this file directly (type stripping); skip when imported by tests.
const isEntry =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))

if (isEntry) {
  const error = checkSeedTarget(process.env)
  if (error) {
    console.error(`seed: ${error}`)
    process.exit(1)
  }
  const sql = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  })
  try {
    await runSeed(drizzle(sql, { casing: 'snake_case' }))
    console.log('seed: done (free + creator users with posts)')
  } finally {
    await sql.end()
  }
}
