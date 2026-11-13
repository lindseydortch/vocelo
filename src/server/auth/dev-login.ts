import '@tanstack/react-start/server-only'
import { completeSignIn } from './complete-sign-in'

/** Personal-key sign-in for local worktree ports, where Buffer OAuth cannot redirect. */
export async function handleDevLogin(): Promise<Response> {
  const accessToken = process.env.BUFFER_API_KEY
  if (!accessToken || process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 })
  }
  await completeSignIn({
    accessToken,
    refreshToken: null,
    expiresIn: null,
    scope: '',
  })
  return new Response(null, { status: 302, headers: { Location: '/app' } })
}
