import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from '../../src/db/schema.ts'
import {
  PRESET_KEYS,
  populatePreset,
  presetUserValues,
} from '../../src/test/presets.ts'
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

/** Deletes every seed user, then re-creates one per billing preset, each with backdated posts. */
export async function runSeed(db: SeedDb, now = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(users).where(like(users.bufferAccountId, SEED_LIKE))
    for (const key of PRESET_KEYS) {
      const [user] = await tx
        .insert(users)
        .values(
          presetUserValues(key, now, {
            bufferAccountId: `${SEED_TAG}${key}`,
            bufferOrganizationId: `${SEED_TAG}org_${key}`,
            email: `seed-${key}@example.test`,
            suffix: key,
          }),
        )
        .returning()
      if (!user) throw new Error(`seed: failed to insert user ${key}`)
      await seedPostsFor(tx, user, now)
      // Posts come from SEED_POSTS; the preset adds personas and usage on top.
      await populatePreset(tx, user, key, now, { posts: false })
    }
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
    console.log(
      `seed: done (${PRESET_KEYS.length} billing preset users with posts)`,
    )
  } finally {
    await sql.end()
  }
}
