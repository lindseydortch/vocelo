import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import {
  bufferStatusMessage,
  type BufferStatusInput,
} from '~/lib/buffer-status'
import { resolveTimeZone } from '~/lib/schedule-time'

const subscribeNever = () => () => {}

type Props = Omit<BufferStatusInput, 'timeZone'> & {
  /** The user's saved timezone; the browser's is used when it is missing. */
  userTimeZone: string | null
  /** Buttons that sit after the message ("Move back to draft", "Save as a new draft"). */
  actions?: ReactNode
}

export function BufferStatusBanner({ userTimeZone, actions, ...input }: Props) {
  // The server has no browser zone, so the first render uses the saved one only.
  const browserTz = useSyncExternalStore(
    subscribeNever,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  )
  const message = bufferStatusMessage({
    ...input,
    timeZone: resolveTimeZone(userTimeZone, browserTz),
  })
  if (!message) return null
  return (
    <div role="status" data-slot="buffer-status-banner">
      <p>{message}</p>
      {actions && <div data-slot="buffer-status-actions">{actions}</div>}
    </div>
  )
}
