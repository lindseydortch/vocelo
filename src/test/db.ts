import { inject } from 'vitest'
import postgres from 'postgres'
import { createDb } from '~/db/client'

/** Connection string of this run's embedded Postgres database. */
export function testDatabaseUrl(): string {
  return inject('testDatabaseUrl')
}

/** A Drizzle client on the test database. */
export function createTestDb() {
  const url = testDatabaseUrl()
  return { url, db: createDb(url) }
}

/** A raw postgres.js connection (one connection) for lock and transaction tests. */
export function createTestSql() {
  return postgres(testDatabaseUrl(), { max: 1, prepare: false })
}
