import { afterEach, describe, expect, it, vi } from 'vitest'

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }))
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => jar.values.get(name),
  setCookie: (name: string, value: string) => {
    jar.values.set(name, value)
  },
  deleteCookie: (name: string) => {
    jar.values.delete(name)
  },
}))
vi.mock('~/server/env', () => ({
  env: { SESSION_SECRET: 'test-session-secret' },
}))
vi.mock('~/db/client', () => ({ db: {} }))

const { SESSION_COOKIE, hasValidSessionCookie, sealSession } =
  await import('./session')

afterEach(() => jar.values.clear())

describe('hasValidSessionCookie', () => {
  it('is true for a valid session cookie', () => {
    jar.values.set(
      SESSION_COOKIE,
      sealSession('00000000-0000-4000-8000-000000000001'),
    )
    expect(hasValidSessionCookie()).toBe(true)
  })

  it('is false with no cookie', () => {
    expect(hasValidSessionCookie()).toBe(false)
  })

  it('is false for a tampered cookie', () => {
    jar.values.set(SESSION_COOKIE, 'not-a-real-cookie')
    expect(hasValidSessionCookie()).toBe(false)
  })
})
