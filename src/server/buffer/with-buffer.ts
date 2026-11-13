import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { bufferConnections } from '~/db/schema'
import {
  BufferAuthExpiredError,
  getBufferAccessToken,
} from '~/server/auth/buffer-token'
import { clearSession } from '~/server/auth/session'
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
      await db
        .delete(bufferConnections)
        .where(eq(bufferConnections.userId, userId))
      throw new BufferAuthExpiredError()
    }
  } catch (error) {
    if (error instanceof BufferAuthExpiredError) clearSession()
    throw error
  }
}
