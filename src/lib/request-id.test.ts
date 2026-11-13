import { afterEach, describe, expect, it, vi } from 'vitest'
import { logError, newRequestId } from './request-id'

describe('newRequestId', () => {
  it('returns a short unique id', () => {
    const a = newRequestId()
    expect(a).toMatch(/^[0-9a-f]{12}$/)
    expect(newRequestId()).not.toBe(a)
  })
})

describe('logError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs the request id and error with console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('boom')
    logError('abc123', error)
    expect(spy).toHaveBeenCalledWith('[error]', {
      requestId: 'abc123',
      message: 'boom',
      stack: error.stack,
    })
  })

  it('handles non-Error values', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('abc123', 'plain string')
    expect(spy).toHaveBeenCalledWith('[error]', {
      requestId: 'abc123',
      message: 'plain string',
      stack: undefined,
    })
  })
})
