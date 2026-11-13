import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { TestProject } from 'vitest/node'

const DIR_PREFIX = 'vocelo-pg-'
const STALE_MS = 60 * 60 * 1000

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection string for this run's throwaway `vocelo_test_<PORT>` database. */
    testDatabaseUrl: string
  }
}

/** Asks the OS for a free TCP port. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
  })
}

/** Deletes `vocelo-pg-*` dirs in `root` that were last touched more than an hour before `now`. */
export function sweepStaleDataDirs(
  root: string = tmpdir(),
  now: number = Date.now(),
): string[] {
  const removed: string[] = []
  for (const name of readdirSync(root)) {
    if (!name.startsWith(DIR_PREFIX)) continue
    const path = join(root, name)
    try {
      if (now - statSync(path).mtimeMs > STALE_MS) {
        rmSync(path, { recursive: true, force: true })
        removed.push(path)
      }
    } catch {
      // Another run removed it first; fine.
    }
  }
  return removed
}

export default async function setup(project: TestProject) {
  sweepStaleDataDirs()

  const port = await getFreePort()
  const databaseDir = join(tmpdir(), `${DIR_PREFIX}${process.pid}-${port}`)
  mkdirSync(databaseDir, { recursive: true })

  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => {},
    onError: () => {},
  })

  const cleanup = async () => {
    await pg.stop().catch(() => {})
    rmSync(databaseDir, { recursive: true, force: true })
  }

  try {
    await pg.initialise()
    await pg.start()
    const dbName = `vocelo_test_${port}`
    await pg.createDatabase(dbName)

    const url = `postgres://postgres:postgres@127.0.0.1:${port}/${dbName}`
    const sql = postgres(url, { max: 1 })
    try {
      await migrate(drizzle(sql), { migrationsFolder: './drizzle' })
    } finally {
      await sql.end()
    }
    project.provide('testDatabaseUrl', url)
  } catch (err) {
    await cleanup()
    throw err
  }

  return cleanup
}
