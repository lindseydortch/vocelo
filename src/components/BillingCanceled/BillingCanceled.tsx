import { Link } from '@tanstack/react-router'
import { billingCopy } from '~/content/copy'

const page = billingCopy.canceled

// Stripe's cancel_url lands here. Read-only: nothing is written.
export function BillingCanceled() {
  return (
    <main>
      <h1>{page.heading}</h1>
      <p>{page.body}</p>
      <Link to="/pricing">{page.backToPricing}</Link>
    </main>
  )
}
