import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '~/components/PublicPage/PublicPage'
import { authCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'

const page = authCopy.app

export const Route = createFileRoute('/app/')({
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  component: () => (
    <PublicPage heading={page.heading} body={page.placeholder} />
  ),
})
