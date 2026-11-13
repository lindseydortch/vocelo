import { createFileRoute } from '@tanstack/react-router'
import { BillingCanceled } from '~/components/BillingCanceled/BillingCanceled'
import { billingCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'

export const Route = createFileRoute('/app/billing/canceled')({
  head: () => ({ meta: [{ title: pageTitle(billingCopy.canceled.title) }] }),
  component: BillingCanceled,
})
