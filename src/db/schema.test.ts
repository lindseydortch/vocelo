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
      'buffer_write',
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
      'needs_approval',
      'sending',
      'error',
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

describe('sign-in schema additions (#58)', () => {
  const col = (t: Parameters<typeof getTableConfig>[0], n: string) =>
    cfg(t).columns.find((c) => c.name === n)

  it('has a nullable text users.timezone', () => {
    expect(col(schema.users, 'timezone')?.getSQLType()).toBe('text')
    expect(col(schema.users, 'timezone')?.notNull).toBe(false)
  })

  it('has a text posts.bufferOrganizationId', () => {
    expect(col(schema.posts, 'bufferOrganizationId')?.getSQLType()).toBe('text')
  })

  it('ships both columns in the migrations, with no drops or renames', () => {
    expect(migrationSql).toContain('"timezone" text')
    expect(migrationSql).toMatch(/"buffer_organization_id" text/)
    expect(migrationSql).not.toMatch(/DROP COLUMN|RENAME/i)
  })
})

describe('Buffer integration schema additions (#59)', () => {
  it('adds the enum values and columns additively', () => {
    for (const v of ['needs_approval', 'sending', 'error', 'buffer_write'])
      expect(migrationSql).toContain(`ADD VALUE '${v}'`)
    expect(migrationSql).toContain('"channels_cache" jsonb')
    expect(migrationSql).toContain(
      '"channels_cached_at" timestamp with time zone',
    )
    expect(migrationSql).toContain('CONSTRAINT "posts_channel_required" CHECK')
    expect(migrationSql).not.toMatch(/DROP COLUMN|RENAME/i)
  })
})
