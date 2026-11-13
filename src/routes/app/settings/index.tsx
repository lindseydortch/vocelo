import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { PublicPage } from '~/components/PublicPage/PublicPage'
import { authCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'
import { disconnectBuffer, getDisconnectInfo } from '~/server/auth/disconnect'
import { signOut } from '~/server/auth/sign-out'

const page = authCopy.settings

function SettingsPage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [paid, setPaid] = useState(false)
  const [infoError, setInfoError] = useState(false)
  const [disconnectError, setDisconnectError] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const disconnectButton = useRef<HTMLButtonElement>(null)

  async function onSignOut() {
    setPending(true)
    try {
      await signOut()
      await navigate({ to: '/', reloadDocument: true })
    } finally {
      setPending(false)
    }
  }

  async function onOpenDisconnect() {
    if (pending) return
    setPending(true)
    setInfoError(false)
    setDisconnectError(false)
    try {
      const info = await getDisconnectInfo()
      setPaid(info.paid)
      dialog.current?.showModal()
    } catch {
      setInfoError(true)
    } finally {
      setPending(false)
    }
  }

  async function onDisconnect() {
    if (pending) return
    setPending(true)
    setDisconnectError(false)
    try {
      await disconnectBuffer()
      await navigate({ to: '/', reloadDocument: true })
    } catch {
      setDisconnectError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <PublicPage heading={page.heading} body={page.placeholder}>
      <button type="button" onClick={onSignOut} disabled={pending}>
        {page.signOut}
      </button>
      <button
        ref={disconnectButton}
        type="button"
        onClick={onOpenDisconnect}
        disabled={pending}
      >
        {page.disconnect}
      </button>
      {infoError && <p role="alert">{page.disconnectInfoError}</p>}
      <dialog
        ref={dialog}
        aria-labelledby="disconnect-title"
        aria-describedby="disconnect-body disconnect-revoke"
        onCancel={(event) => {
          if (pending) event.preventDefault()
        }}
        onClose={() => disconnectButton.current?.focus()}
      >
        <h2 id="disconnect-title">{page.disconnectTitle}</h2>
        <p id="disconnect-body">{page.disconnectBody}</p>
        {paid && <p>{page.disconnectBilling}</p>}
        <p id="disconnect-revoke">{page.disconnectRevoke}</p>
        {disconnectError && <p role="alert">{page.disconnectError}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => dialog.current?.close()}
        >
          {page.cancel}
        </button>
        <button type="button" disabled={pending} onClick={onDisconnect}>
          {pending ? page.disconnectPending : page.disconnect}
        </button>
      </dialog>
    </PublicPage>
  )
}

export const Route = createFileRoute('/app/settings/')({
  head: () => ({ meta: [{ title: pageTitle(page.title) }] }),
  component: SettingsPage,
})
