import '@tanstack/react-start/server-only'
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { bufferConnections, users } from '~/db/schema'
import { now } from '~/lib/clock'
import { env } from '~/server/env'

export const SESSION_COOKIE = 'vocelo_session'
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export type SessionUser = {
  user: typeof users.$inferSelect
  connection: typeof bufferConnections.$inferSelect
}

/** Thrown by `requireUser()` when there is no signed-in user. */
export class UnauthenticatedError extends Error {
  readonly code = 'UNAUTHENTICATED'
  constructor() {
    super('UNAUTHENTICATED')
    this.name = 'UnauthenticatedError'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let keyCache: { secret: string; key: Buffer } | undefined

/** Derived once per secret, so the hot path doesn't re-run HKDF. */
function key(): Buffer {
  const secret = env.SESSION_SECRET
  if (keyCache?.secret !== secret) {
    keyCache = {
      secret,
      key: Buffer.from(
        hkdfSync('sha256', secret, 'vocelo-session', 'aes-256-gcm', 32),
      ),
    }
  }
  return keyCache.key
}

/** Encrypts and authenticates `{ userId, exp }`; the cookie reveals nothing and can't be edited. */
export function sealSession(userId: string, at: Date = now()): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const exp = at.getTime() + SESSION_MAX_AGE_SECONDS * 1000
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ userId, exp }), 'utf8'),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

/** The user id in a sealed cookie, or null if it is malformed, tampered with, or expired. */
export function unsealSession(sealed: string, at: Date = now()): string | null {
  try {
    const raw = Buffer.from(sealed, 'base64url')
    if (raw.length <= 28) return null
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const json = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString('utf8')
    const { userId, exp } = JSON.parse(json) as {
      userId?: unknown
      exp?: unknown
    }
    if (typeof userId !== 'string' || !UUID.test(userId)) return null
    if (typeof exp !== 'number') return null
    return exp > at.getTime() ? userId : null
  } catch {
    return null
  }
}

function writeCookie(userId: string): void {
  setCookie(SESSION_COOKIE, sealSession(userId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

/** Signs the user in. Call after a successful Buffer OAuth callback. */
export function setSessionUser(userId: string): void {
  writeCookie(userId)
}

export function clearSession(): void {
  deleteCookie(SESSION_COOKIE, { path: '/' })
}

/**
 * The signed-in user and their Buffer connection, or null when there is no
 * valid cookie or either row is missing. A valid session is renewed for
 * another 30 days; an invalid cookie is cleared.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const sealed = getCookie(SESSION_COOKIE)
  if (!sealed) return null
  const userId = unsealSession(sealed)
  if (!userId) {
    clearSession()
    return null
  }
  const [row] = await db
    .select({ user: users, connection: bufferConnections })
    .from(users)
    .innerJoin(bufferConnections, eq(bufferConnections.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1)
  if (!row) {
    clearSession()
    return null
  }
  writeCookie(userId)
  return row
}

/** For server functions: the signed-in user, or throws `UnauthenticatedError`. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSessionUser()
  if (!session) throw new UnauthenticatedError()
  return session
}
