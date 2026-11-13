import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/db/client'
import { bufferConnections } from '~/db/schema'
import { now } from '~/lib/clock'
import { BufferTemporaryError } from '~/server/buffer/client'
import { env } from '~/server/env'
import { decryptToken, encryptToken, TokenDecryptError } from './crypto'

const TOKEN_URL = 'https://auth.buffer.com/token'
const tokens = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive().finite(),
})

export class BufferAuthExpiredError extends Error {
  readonly code = 'BUFFER_AUTH_EXPIRED'
  constructor() {
    super('BUFFER_AUTH_EXPIRED')
    this.name = 'BufferAuthExpiredError'
  }
}

/** The row lock covers refresh and rotation: single-use refresh tokens must never race. */
export async function getBufferAccessToken(
  userId: string,
  { force = false }: { force?: boolean } = {},
): Promise<string> {
  const accessToken = await db.transaction(async (tx) => {
    const [connection] = await tx
      .select()
      .from(bufferConnections)
      .where(eq(bufferConnections.userId, userId))
      .for('update')
    if (!connection) return null
    // Return a sentinel so deleting a dead connection commits before the caller throws.
    const expire = async () => {
      await tx
        .delete(bufferConnections)
        .where(eq(bufferConnections.userId, userId))
      return null
    }
    try {
      const access = decryptToken(connection.accessTokenEnc)
      // Null expiry identifies the non-expiring dev personal API key.
      if (!force && !connection.accessExpiresAt) return access
      if (!connection.refreshTokenEnc) return expire()
      const refresh = decryptToken(connection.refreshTokenEnc)
      if (
        !force &&
        connection.accessExpiresAt &&
        connection.accessExpiresAt.getTime() - now().getTime() >= 300_000
      )
        return access
      try {
        const response = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refresh,
            client_id: env.BUFFER_CLIENT_ID,
            client_secret: env.BUFFER_CLIENT_SECRET,
          }),
          signal: AbortSignal.timeout(10_000),
        })
        if (response.status >= 400 && response.status < 500) return expire()
        if (!response.ok)
          throw new BufferTemporaryError('Buffer token endpoint is unavailable')
        const body: unknown = await response.json()
        if (
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          body.error === 'invalid_grant'
        )
          return expire()
        const rotated = tokens.parse(body)
        await tx
          .update(bufferConnections)
          .set({
            accessTokenEnc: encryptToken(rotated.access_token),
            refreshTokenEnc: encryptToken(rotated.refresh_token),
            accessExpiresAt: new Date(
              now().getTime() + rotated.expires_in * 1000,
            ),
          })
          .where(eq(bufferConnections.userId, userId))
        return rotated.access_token
      } catch (cause) {
        if (cause instanceof BufferTemporaryError) throw cause
        throw new BufferTemporaryError(
          'Could not refresh Buffer access token',
          undefined,
          { cause },
        )
      }
    } catch (error) {
      if (error instanceof TokenDecryptError) return expire()
      throw error
    }
  })
  if (accessToken === null) throw new BufferAuthExpiredError()
  return accessToken
}
