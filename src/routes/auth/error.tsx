import { createFileRoute } from '@tanstack/react-router'
import { authCopy } from '~/content/copy'
import { resolveAuthErrorReason } from '~/lib/auth-error'
import { pageTitle } from '~/lib/head'
import styles from './error.module.scss'

const page = authCopy.error

export const Route = createFileRoute('/auth/error')({
  validateSearch: (search: Record<string, unknown>) => ({
    reason: resolveAuthErrorReason(search.reason),
  }),
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  component: AuthError,
})

function AuthError() {
  const { reason } = Route.useSearch()
  return (
    <main className={styles.page}>
      <h1>{page.heading}</h1>
      <p role="alert">{page.reasons[reason]}</p>
      <a href="/auth/buffer/start">{page.retry}</a>
    </main>
  )
}
