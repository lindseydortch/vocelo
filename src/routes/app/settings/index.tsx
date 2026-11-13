import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { PublicPage } from '~/components/PublicPage/PublicPage'
import { authCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'
import { signOut } from '~/server/auth/sign-out'

const page = authCopy.settings

function SettingsPage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  async function onSignOut() {
    setPending(true)
    try {
      await signOut()
      await navigate({ to: '/', reloadDocument: true })
    } finally {
      setPending(false)
    }
  }

  return (
    <PublicPage heading={page.heading} body={page.placeholder}>
      <button type="button" onClick={onSignOut} disabled={pending}>
        {page.signOut}
      </button>
    </PublicPage>
  )
}

export const Route = createFileRoute('/app/settings/')({
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  component: SettingsPage,
})
