import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs outside Vite, so it reads DATABASE_URL straight from the
// environment (`.env.local` is loaded by the npm scripts via --env-file).
const url = process.env.DATABASE_URL ?? ''
// `generate` only diffs the schema; commands that touch the database need the URL.
if (
  !url &&
  process.argv.some((a) => ['migrate', 'push', 'studio'].includes(a))
) {
  throw new Error('DATABASE_URL is required to run drizzle-kit')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  casing: 'snake_case',
})
