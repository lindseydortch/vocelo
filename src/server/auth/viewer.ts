import { createServerFn } from '@tanstack/react-start'

/**
 * Whether the visitor has a valid session cookie. Public pages use it to pick a
 * CTA; cookie-only (no DB), the `/app` guard does the real user check.
 */
export const getViewer = createServerFn({ method: 'GET' }).handler(async () => {
  const { hasValidSessionCookie } = await import('~/server/auth/session')
  return { signedIn: hasValidSessionCookie() }
})
