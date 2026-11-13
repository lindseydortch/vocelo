import { pagesCopy } from '~/content/copy'

/** `/app` when signed in, `/` when signed out. Plain anchors: `/app` isn't a registered route yet. */
export function BackLink({ signedIn }: { signedIn: boolean }) {
  return signedIn ? (
    <a href="/app">{pagesCopy.backToApp}</a>
  ) : (
    <a href="/">{pagesCopy.backToHome}</a>
  )
}
