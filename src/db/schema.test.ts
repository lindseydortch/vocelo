import { readFileSync, readdirSync } from 'node:fs'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as schema from './schema'

const cfg = (t: Parameters<typeof getTableConfig>[0]) => getTableConfig(t)
const migrationDir = new URL('../../drizzle/', import.meta.url)
const migrationSql = readdirSync(migrationDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(new URL(f, migrationDir), 'utf8'))
  .join('\n')

describe('db schema', () => {
  it('defines the 9 tables with UUID primary keys (stripe_events uses the Stripe id)', () => {
    const tables = [
      schema.users,
      schema.bufferConnections,
      schema.posts,
      schema.versions,
      schema.personas,
      schema.reactions,
      schema.toneReads,
      schema.usageEvents,
      schema.stripeEvents,
    ]
    expect(tables.map((t) => cfg(t).name)).toEqual([
      'users',
      'buffer_connections',
      'posts',
      'versions',
      'personas',
      'reactions',
      'tone_reads',
      'usage_events',
      'stripe_events',
    ])
    for (const t of tables.filter((t) => t !== schema.stripeEvents)) {
      const pk = cfg(t).columns.find((c) => c.primary)
      expect(pk?.getSQLType()).toBe('uuid')
    }
  })

  it('declares the listed unique constraints', () => {
    const uniques = (t: Parameters<typeof getTableConfig>[0]) =>
      cfg(t).uniqueConstraints.map((u) => u.columns.map((c) => c.name))
    expect(uniques(schema.posts)).toEqual([['userId', 'bufferPostId']])
    expect(uniques(schema.reactions)).toEqual([
      ['postId', 'personaId', 'channelService', 'textHash'],
    ])
    expect(uniques(schema.toneReads)).toEqual([
      ['postId', 'channelService', 'textHash'],
    ])
    expect(
      cfg(schema.users).columns.find((c) => c.name === 'bufferAccountId')
        ?.isUnique,
    ).toBe(true)
  })

  it('sets plan and period anchor defaults', () => {
    const col = (n: string) =>
      cfg(schema.users).columns.find((c) => c.name === n)!
    expect(col('plan').default).toBe('free')
    expect(col('periodAnchorAt').hasDefault).toBe(true)
  })

  it('defines the enums', () => {
    expect(schema.usageKind.enumValues).toEqual([
      'tts_chars',
      'post_review',
      'llm_call',
    ])
    expect(schema.sentiment.enumValues).toEqual([
      'positive',
      'neutral',
      'negative',
    ])
    expect(schema.bufferStatus.enumValues).toEqual([
      'draft',
      'scheduled',
      'sent',
    ])
  })
})

describe('generated migration', () => {
  it('keeps usage_events when a post is deleted, and cascades the rest', () => {
    const fk = (table: string, col: string) =>
      migrationSql.match(
        new RegExp(
          `ALTER TABLE "${table}" ADD CONSTRAINT [^;]*FOREIGN KEY \\("${col}"\\)[^;]*;`,
        ),
      )?.[0]
    expect(fk('usage_events', 'post_id')).toContain('ON DELETE set null')
    expect(fk('versions', 'post_id')).toContain('ON DELETE cascade')
    expect(fk('reactions', 'post_id')).toContain('ON DELETE cascade')
    expect(fk('tone_reads', 'post_id')).toContain('ON DELETE cascade')
  })

  it('creates the enums and all tables', () => {
    for (const e of ['usage_kind', 'sentiment', 'buffer_status'])
      expect(migrationSql).toContain(`CREATE TYPE "public"."${e}"`)
    expect(migrationSql.match(/CREATE TABLE/g)).toHaveLength(9)
  })
})
