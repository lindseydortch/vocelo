import { Link } from '@tanstack/react-router'
import { billingCopy } from '~/content/copy'

const copy = billingCopy.canceled

// Stripe's cancel_url lands here. Read-only: nothing is written.
export function BillingCanceled() {
  return (
    <main>
      <h1>{copy.heading}</h1>
      <p>{copy.body}</p>
      <Link to="/pricing">{copy.backToPricing}</Link>
    </main>
  )
}
