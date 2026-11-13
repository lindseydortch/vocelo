import { useEffect, useState, useSyncExternalStore } from 'react'
import { PublicPage } from '~/components/PublicPage/PublicPage'
import { BackLink } from '~/components/NotFound/BackLink'
import { pagesCopy } from '~/content/copy'
import { logError, newRequestId } from '~/lib/request-id'

const subscribe = () => () => {}

export function ErrorPage({
  error,
  signedIn,
}: {
  error: unknown
  signedIn: boolean
}) {
  const { error: copy } = pagesCopy
  // Shown only after hydration: a server-rendered id would differ from the one logged here.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const [requestId] = useState(newRequestId)
  useEffect(() => logError(requestId, error), [requestId, error])
  return (
    <PublicPage heading={copy.heading} body={copy.body}>
      {hydrated && (
        <p>
          {copy.reference} <code>{requestId}</code>
        </p>
      )}
      <BackLink signedIn={signedIn} />
    </PublicPage>
  )
}
