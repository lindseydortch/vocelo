/**
 * `npm run seed` writes fixed users into a database, so it only runs against
 * the one host named in `SEED_ALLOWED_HOST` (the Neon `dev` endpoint, set only
 * in `.env.local`). Returns an error message, or null when seeding is allowed.
 */
export function checkSeedTarget(env: NodeJS.ProcessEnv): string | null {
  const url = env.DATABASE_URL
  const allowed = env.SEED_ALLOWED_HOST
  if (!url) return 'DATABASE_URL is not set.'
  if (!allowed) {
    return 'SEED_ALLOWED_HOST is not set. Set it in .env.local to the Neon dev endpoint host; never set it in production.'
  }
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return 'DATABASE_URL is not a valid URL.'
  }
  if (host !== allowed) {
    return `Refusing to seed: DATABASE_URL host "${host}" does not match SEED_ALLOWED_HOST "${allowed}".`
  }
  return null
}
