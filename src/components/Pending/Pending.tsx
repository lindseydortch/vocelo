import { pendingCopy } from '~/content/copy'

export const PENDING_MS = 300

// The router waits `defaultPendingMs` (300 ms) before rendering this, so it
// never flashes on fast loads. Panels that load on their own should reuse it.
export function Pending() {
  return (
    <p role="status" aria-live="polite">
      {pendingCopy.label}
    </p>
  )
}
