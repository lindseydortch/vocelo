import { composerCopy } from '~/content/copy'
import { formatInZone } from '~/lib/schedule-time'
import type { BufferStatus } from '~/server/buffer/queries'

export type BufferStatusInput = {
  status: BufferStatus | null
  dueAt: string | null
  errorMessage: string | null
  timeZone: string
  isSample: boolean
}

/** The banner text for a post that is not a draft in Buffer, or null for no banner. */
export function bufferStatusMessage(input: BufferStatusInput): string | null {
  const { status, dueAt, errorMessage, timeZone, isSample } = input
  if (isSample || !status || status === 'draft') return null
  const copy = composerCopy.bufferStatus
  switch (status) {
    case 'scheduled':
      return dueAt && !Number.isNaN(new Date(dueAt).getTime())
        ? copy.scheduled(formatInZone(new Date(dueAt), timeZone))
        : copy.scheduledNoTime
    case 'needs_approval':
      return copy.needsApproval
    case 'sending':
      return copy.sending
    case 'sent':
      return copy.sent
    case 'error':
      return errorMessage || copy.errorFallback
  }
}
