export const SIGN_IN_HREF = '/auth/buffer/start?returnTo=/app'
export const APP_HREF = '/app'

/** The landing page's primary call to action for a signed-out or signed-in visitor. */
export function landingCta(
  signedIn: boolean,
  labels: { signedOut: string; signedIn: string },
): { label: string; href: string } {
  return signedIn
    ? { label: labels.signedIn, href: APP_HREF }
    : { label: labels.signedOut, href: SIGN_IN_HREF }
}
