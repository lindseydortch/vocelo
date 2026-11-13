import { describe, expect, it } from 'vitest'
import { bufferStatusMessage } from './buffer-status'

const base = {
  dueAt: null,
  errorMessage: null,
  timeZone: 'America/Chicago',
  isSample: false,
}

describe('bufferStatusMessage', () => {
  it('has no banner for draft, no Buffer post, or the sample post', () => {
    expect(bufferStatusMessage({ ...base, status: 'draft' })).toBeNull()
    expect(bufferStatusMessage({ ...base, status: null })).toBeNull()
    expect(
      bufferStatusMessage({ ...base, status: 'scheduled', isSample: true }),
    ).toBeNull()
  })

  it('formats scheduled with the due time in the zone', () => {
    expect(
      bufferStatusMessage({
        ...base,
        status: 'scheduled',
        dueAt: '2026-06-02T20:00:00.000Z',
      }),
    ).toBe(
      "Scheduled for Tue 3:00 PM America/Chicago. Edits here won't change it.",
    )
  })

  it('falls back when scheduled has no due time', () => {
    expect(bufferStatusMessage({ ...base, status: 'scheduled' })).toBe(
      "Scheduled in Buffer. Edits here won't change it.",
    )
  })

  it('has one message each for the other statuses', () => {
    expect(bufferStatusMessage({ ...base, status: 'needs_approval' })).toBe(
      'Waiting for approval in Buffer.',
    )
    expect(bufferStatusMessage({ ...base, status: 'sending' })).toBe(
      'Posting now.',
    )
    expect(bufferStatusMessage({ ...base, status: 'sent' })).toBe('Posted.')
  })

  it("shows Buffer's own error message, or a fallback", () => {
    expect(
      bufferStatusMessage({
        ...base,
        status: 'error',
        errorMessage: 'Token expired',
      }),
    ).toBe('Token expired')
    expect(bufferStatusMessage({ ...base, status: 'error' })).toBe(
      "Buffer couldn't post this.",
    )
  })
})

describe('bufferStatusMessage invalid due time', () => {
  it('falls back instead of throwing', () => {
    expect(
      bufferStatusMessage({
        ...base,
        status: 'scheduled',
        dueAt: 'not-a-date',
      }),
    ).toBe("Scheduled in Buffer. Edits here won't change it.")
  })
})
