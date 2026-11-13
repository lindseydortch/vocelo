import { createServerFn } from '@tanstack/react-start'

/** Whether the request has a valid session cookie (no DB lookup). */
export const getIsSignedIn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { hasValidSessionCookie } = await import('./session')
    return hasValidSessionCookie()
  },
)
