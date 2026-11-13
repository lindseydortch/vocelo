import type { ReactNode } from 'react'
import {
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
} from '@tanstack/react-router'
import { ErrorPage } from '~/components/ErrorPage/ErrorPage'
import { NotFound } from '~/components/NotFound/NotFound'
import { getIsSignedIn } from '~/server/auth/signed-in'
import '../styles/global.scss'

export const Route = createRootRoute({
  beforeLoad: async () => ({
    signedIn: await getIsSignedIn().catch(() => false),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Vocelo' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
})

function RootNotFound() {
  return <NotFound signedIn={useSignedIn()} />
}

function RootError({ error }: ErrorComponentProps) {
  return <ErrorPage error={error} signedIn={useSignedIn()} />
}

/** Root context may be missing if `beforeLoad` itself failed, so default to signed out. */
function useSignedIn(): boolean {
  const router = useRouter()
  return router.state.matches[0]?.context?.signedIn === true
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
