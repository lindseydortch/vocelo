import {
  Navigate,
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import { isBufferAuthExpired, signInPath } from '~/lib/auth-guard'
import { getViewer } from '~/server/auth/viewer'

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ location }) => {
    const { signedIn } = await getViewer()
    if (!signedIn) throw redirect(signInPath(location.href))
  },
  // Page loads that hit BUFFER_AUTH_EXPIRED land here; send them to sign in.
  errorComponent: ({ error }) => {
    if (isBufferAuthExpired(error)) {
      return <Navigate to="/signin" search={{ reason: 'expired' }} replace />
    }
    throw error
  },
  component: Outlet,
})
