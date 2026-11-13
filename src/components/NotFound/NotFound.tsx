import { PublicPage } from '~/components/PublicPage/PublicPage'
import { pagesCopy } from '~/content/copy'
import { BackLink } from './BackLink'

export function NotFound({ signedIn }: { signedIn: boolean }) {
  const { notFound } = pagesCopy
  return (
    <PublicPage heading={notFound.heading} body={notFound.body}>
      <BackLink signedIn={signedIn} />
    </PublicPage>
  )
}
