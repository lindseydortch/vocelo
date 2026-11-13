import { createFileRoute, redirect } from '@tanstack/react-router'
import { authCopy } from '~/content/copy'
import { validateSignInSearch } from '~/lib/auth-guard'
import { pageTitle } from '~/lib/head'
import { DEFAULT_RETURN_TO } from '~/server/auth/return-to'
import { getViewer } from '~/server/auth/viewer'
import styles from './signin.module.scss'

const page = authCopy.signin

export const Route = createFileRoute('/signin')({
  validateSearch: validateSignInSearch,
  beforeLoad: async () => {
    const { signedIn } = await getViewer()
    if (signedIn) throw redirect({ to: '/app' })
  },
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  component: SignIn,
})

function SignIn() {
  const { returnTo, reason } = Route.useSearch()
  const href = `/auth/buffer/start?returnTo=${encodeURIComponent(returnTo ?? DEFAULT_RETURN_TO)}`
  return (
    <main className={styles.page}>
      <h1>{page.heading}</h1>
      {reason === 'expired' && <p role="alert">{page.expired}</p>}
      <p>{page.access}</p>
      <a href={href}>{page.cta}</a>
    </main>
  )
}
