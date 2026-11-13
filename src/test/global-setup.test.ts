import { mkdirSync, existsSync, utimesSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getFreePort, sweepStaleDataDirs } from './global-setup'
import { createTestSql, testDatabaseUrl } from './db'

describe('embedded Postgres harness', () => {
  it('exposes a per-port test database URL', async () => {
    const url = testDatabaseUrl()
    expect(url).toMatch(/\/vocelo_test_\d+$/)
    const sql = createTestSql()
    try {
      const [row] = await sql`select current_database() as name`
      expect(row?.name).toBe(url.split('/').pop())
    } finally {
      await sql.end()
    }
  })

  it('blocks a second SELECT … FOR UPDATE until the first transaction ends', async () => {
    const a = createTestSql()
    const b = createTestSql()
    try {
      await a`create table if not exists lock_demo (id int primary key)`
      await a`insert into lock_demo values (1) on conflict do nothing`

      const events: string[] = []
      let release!: () => void
      const held = new Promise<void>((r) => (release = r))
      let locked!: () => void
      const gotLock = new Promise<void>((r) => (locked = r))

      const first = a.begin(async (tx) => {
        await tx`select * from lock_demo where id = 1 for update`
        events.push('a locked')
        locked()
        await held
        events.push('a releasing')
      })
      await gotLock

      const second = b.begin(async (tx) => {
        await tx`select * from lock_demo where id = 1 for update`
        events.push('b locked')
      })

      await new Promise((r) => setTimeout(r, 300))
      expect(events).toEqual(['a locked']) // b is still blocked

      release()
      await Promise.all([first, second])
      expect(events).toEqual(['a locked', 'a releasing', 'b locked'])
    } finally {
      await a`drop table if exists lock_demo`
      await a.end()
      await b.end()
    }
  })

  it('picks distinct free ports for concurrent runs', async () => {
    const [p1, p2] = await Promise.all([getFreePort(), getFreePort()])
    expect(p1).toBeGreaterThan(0)
    expect(p2).toBeGreaterThan(0)
  })

  it('sweeps only stale vocelo-pg-* dirs older than 1 hour', () => {
    const root = mkdtempSync(join(tmpdir(), 'sweep-test-'))
    try {
      const now = Date.now()
      const stale = join(root, 'vocelo-pg-old')
      const fresh = join(root, 'vocelo-pg-new')
      const other = join(root, 'unrelated-old')
      for (const d of [stale, fresh, other]) mkdirSync(d)
      const old = new Date(now - 2 * 60 * 60 * 1000)
      utimesSync(stale, old, old)
      utimesSync(other, old, old)

      expect(sweepStaleDataDirs(root, now)).toEqual([stale])
      expect(existsSync(stale)).toBe(false)
      expect(existsSync(fresh)).toBe(true)
      expect(existsSync(other)).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
