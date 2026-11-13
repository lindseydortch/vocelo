import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { bufferConnections } from '~/db/schema'
import {
  BufferAuthExpiredError,
  getBufferAccessToken,
} from '~/server/auth/buffer-token'
import { clearSession } from '~/server/auth/session'
import { decryptToken } from '~/server/auth/crypto'
import { BufferAuthError } from './client'

/** Run a Buffer operation, refreshing once if its access token is rejected. */
export async function withBuffer<T>(
  userId: string,
  fn: (token: string) => Promise<T>,
): Promise<T> {
  try {
    const token = await getBufferAccessToken(userId)
    try {
      return await fn(token)
    } catch (error) {
      if (!(error instanceof BufferAuthError)) throw error
    }
    const refreshedToken = await getBufferAccessToken(userId, { force: true })
    try {
      return await fn(refreshedToken)
    } catch (error) {
      if (!(error instanceof BufferAuthError)) throw error
      const expired = await db.transaction(async (tx) => {
        const [connection] = await tx
          .select()
          .from(bufferConnections)
          .where(eq(bufferConnections.userId, userId))
          .for('update')
        if (
          connection &&
          decryptToken(connection.accessTokenEnc) === refreshedToken
        ) {
          await tx
            .delete(bufferConnections)
            .where(eq(bufferConnections.userId, userId))
          return true
        }
        return !connection
      })
      if (!expired) throw error
      throw new BufferAuthExpiredError()
    }
  } catch (error) {
    if (error instanceof BufferAuthExpiredError) clearSession()
    throw error
  }
}
