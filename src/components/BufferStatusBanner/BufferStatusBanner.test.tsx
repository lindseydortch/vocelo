// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BufferStatusBanner } from './BufferStatusBanner'

afterEach(cleanup)

const base = {
  dueAt: null,
  errorMessage: null,
  userTimeZone: 'America/Chicago',
  isSample: false,
}

describe('BufferStatusBanner', () => {
  it.each([
    [
      'scheduled',
      "Scheduled for Tue 3:00 PM America/Chicago. Edits here won't change it.",
    ],
    ['needs_approval', 'Waiting for approval in Buffer.'],
    ['sending', 'Posting now.'],
    ['sent', 'Posted.'],
  ] as const)('shows the %s message', (status, text) => {
    render(
      <BufferStatusBanner
        {...base}
        status={status}
        dueAt="2026-06-02T20:00:00.000Z"
      />,
    )
    expect(screen.getByRole('status').textContent).toContain(text)
  })

  it("shows Buffer's error message", () => {
    render(
      <BufferStatusBanner
        {...base}
        status="error"
        errorMessage="Token expired"
      />,
    )
    expect(screen.getByRole('status').textContent).toContain('Token expired')
  })

  it('renders the action slot after the message', () => {
    render(
      <BufferStatusBanner
        {...base}
        status="sent"
        actions={<button>Save as a new draft</button>}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Save as a new draft' }),
    ).toBeTruthy()
  })

  it.each([
    ['draft', false],
    [null, false],
    ['scheduled', true],
  ] as const)(
    'renders nothing for status %s (sample: %s)',
    (status, isSample) => {
      const { container } = render(
        <BufferStatusBanner {...base} status={status} isSample={isSample} />,
      )
      expect(container.innerHTML).toBe('')
    },
  )
})
