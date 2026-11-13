import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '~/components/PublicPage/PublicPage'
import { authCopy, composerCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'

const page = authCopy.app

function DashboardPage() {
  const { locked } = Route.useSearch()
  return (
    <PublicPage heading={page.heading} body={page.placeholder}>
      {locked && <p role="status">{composerCopy.lockedRedirect}</p>}
    </PublicPage>
  )
}

export const Route = createFileRoute('/app/')({
  validateSearch: (search: Record<string, unknown>): { locked?: true } =>
    search.locked === true || search.locked === 'true' ? { locked: true } : {},
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  component: DashboardPage,
})
