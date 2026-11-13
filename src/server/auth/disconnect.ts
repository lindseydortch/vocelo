import { createServerFn } from '@tanstack/react-start'

/** Disconnect only the authenticated account; billing and saved work stay intact. */
export const disconnectBuffer = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { requireUser, clearSession } = await import('./session')
    const { db } = await import('~/db/client')
    const { bufferConnections } = await import('~/db/schema')
    const { eq } = await import('drizzle-orm')
    const { user } = await requireUser()
    await db
      .delete(bufferConnections)
      .where(eq(bufferConnections.userId, user.id))
    clearSession()
  },
)

/** Read at confirmation time so the billing warning reflects the current subscription. */
export const getDisconnectInfo = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireUser } = await import('./session')
    const { user } = await requireUser()
    return {
      paid: ['active', 'trialing', 'past_due'].includes(
        user.subscriptionStatus ?? '',
      ),
    }
  },
)
