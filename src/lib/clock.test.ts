import { describe, expect, it } from 'vitest'
import { now, resetClock, setClock } from './clock'
import { freezeTime } from '../test/clock'

describe('clock', () => {
  it('returns the real current time by default', () => {
    const before = Date.now()
    const t = now().getTime()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(Date.now())
  })

  it('returns a fixed time once frozen', () => {
    freezeTime('2026-01-02T03:04:05.000Z')
    expect(now().toISOString()).toBe('2026-01-02T03:04:05.000Z')
    expect(now().getTime()).toBe(now().getTime())
  })

  it('returns a fresh Date each call so callers cannot mutate the clock', () => {
    freezeTime('2026-01-02T03:04:05.000Z')
    now().setFullYear(1999)
    expect(now().getUTCFullYear()).toBe(2026)
  })

  it('resetClock restores the real clock', () => {
    freezeTime('2000-01-01T00:00:00.000Z')
    resetClock()
    expect(now().getUTCFullYear()).toBeGreaterThanOrEqual(2026)
  })

  it('rejects an invalid frozen date', () => {
    expect(() => freezeTime('not-a-date')).toThrow(/invalid/i)
  })

  it('setClock accepts a custom source', () => {
    setClock(() => new Date(0))
    expect(now().getTime()).toBe(0)
  })
})
