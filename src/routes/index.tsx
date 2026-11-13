import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '~/components/Landing/Landing'
import { pagesCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'
import { getViewer } from '~/server/auth/viewer'

const page = pagesCopy.home

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  loader: () => getViewer(),
  component: Home,
})

function Home() {
  const { signedIn } = Route.useLoaderData()
  return <Landing signedIn={signedIn} />
}
