import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isNull } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { AVATAR_ICONS } from '~/lib/avatars'
import { personas } from '~/db/schema'
import { createTestDb, createTestSql } from '~/test/db'

const { db } = createTestDb()

const migrationSql = readFileSync(
  fileURLToPath(
    new URL('../../drizzle/0002_standard_personas.sql', import.meta.url),
  ),
  'utf8',
)

const standard = () => db.select().from(personas).where(isNull(personas.userId))

describe('standard personas migration (#25)', () => {
  it('inserts The Skeptic, The Scroller and The Fan with every field filled', async () => {
    const rows = await standard()
    expect(rows.map((r) => r.name).sort()).toEqual([
      'The Fan',
      'The Scroller',
      'The Skeptic',
    ])
    for (const r of rows) {
      expect(r.userId).toBeNull()
      expect(r.deletedAt).toBeNull()
      for (const field of [r.bio, r.readerDescription, r.elevenlabsVoiceId]) {
        expect(field.trim()).not.toBe('')
      }
      expect(AVATAR_ICONS.map((a) => a.key)).toContain(r.avatarKey)
    }
    expect(new Set(rows.map((r) => r.elevenlabsVoiceId)).size).toBe(3)
    expect(rows.map((r) => r.id).sort()).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
    ])
  })

  it('does not duplicate rows when the migration runs a second time', async () => {
    const before = await standard()
    const sql = createTestSql()
    try {
      for (const statement of migrationSql.split('--> statement-breakpoint')) {
        if (statement.trim()) await sql.unsafe(statement)
      }
    } finally {
      await sql.end()
    }
    const after = await standard()
    expect(after).toHaveLength(3)
    expect(after.map((r) => r.id).sort()).toEqual(
      before.map((r) => r.id).sort(),
    )
  })
})
