import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '~/components/LegalPage/LegalPage'
import { legal } from '~/content/legal'
import { pageTitle } from '~/lib/head'

const doc = legal.privacy

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: pageTitle(doc.title) }] }),
  component: () => <LegalPage doc={doc} />,
})
