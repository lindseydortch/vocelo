import '@tanstack/react-start/server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '~/server/env'

/** Builds a Drizzle client over postgres.js. Exported so tests can point it at any URL. */
export function createDb(url: string) {
  return drizzle(postgres(url, { prepare: false, max: 5 }), {
    casing: 'snake_case',
  })
}

let cached: ReturnType<typeof createDb> | undefined

/** Lazy: the connection string is read on first query, so importing never connects or throws. */
export const db: ReturnType<typeof createDb> = new Proxy(
  {} as ReturnType<typeof createDb>,
  {
    get(_t, key) {
      cached ??= createDb(env.DATABASE_URL)
      return Reflect.get(cached, key, cached)
    },
  },
)
