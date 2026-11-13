import { createServerFn } from '@tanstack/react-start'

/** Whether the visitor has a valid session. Public pages use it to pick a CTA. */
export const getViewer = createServerFn({ method: 'GET' }).handler(async () => {
  const { getSessionUser } = await import('~/server/auth/session')
  return { signedIn: (await getSessionUser()) !== null }
})
