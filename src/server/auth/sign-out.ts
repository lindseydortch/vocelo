import { createServerFn } from '@tanstack/react-start'

/**
 * Clears the session cookie only; `buffer_connections` stays so signing back
 * in reuses it. POST-only so a link or image can't sign someone out.
 */
export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const { clearSession } = await import('~/server/auth/session')
  clearSession()
})
