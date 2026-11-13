import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '~/components/PublicPage/PublicPage'
import { pagesCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'

const page = pagesCopy.home

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  component: () => <PublicPage heading={page.heading} body={page.body} />,
})
