import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDb, db } from './client'

describe('db client', () => {
  it('creates a Drizzle client without connecting', () => {
    const client = createDb('postgres://user:pass@localhost:5432/db')
    expect(typeof client.select).toBe('function')
  })

  it('importing the module is safe without DATABASE_URL (lazy)', () => {
    expect(db).toBeDefined()
  })

  it('fails with a clear env error on first use when DATABASE_URL is missing', () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      expect(() => db.select).toThrow(/DATABASE_URL is required/)
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved
    }
  })

  it('is marked server-only so client imports fail the build', () => {
    const source = readFileSync(new URL('./client.ts', import.meta.url), 'utf8')
    expect(source).toContain("import '@tanstack/react-start/server-only'")
  })
})
