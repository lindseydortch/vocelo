import { useEffect, useState } from 'react'
import { PublicPage } from '~/components/PublicPage/PublicPage'
import { BackLink } from '~/components/NotFound/BackLink'
import { pagesCopy } from '~/content/copy'
import { logError, newRequestId } from '~/lib/request-id'

export function ErrorPage({
  error,
  signedIn,
}: {
  error: unknown
  signedIn: boolean
}) {
  const { error: copy } = pagesCopy
  const [requestId] = useState(newRequestId)
  useEffect(() => logError(requestId, error), [requestId, error])
  return (
    <PublicPage heading={copy.heading} body={copy.body}>
      {/* The id differs between the server render and the client, so skip the hydration check. */}
      <p suppressHydrationWarning>
        {copy.reference} <code>{requestId}</code>
      </p>
      <BackLink signedIn={signedIn} />
    </PublicPage>
  )
}
