import { describe, expect, it } from 'vitest'
import {
  defaultDueAt,
  formatInZone,
  resolveTimeZone,
  validateDueAt,
} from './schedule-time'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const plus = (ms: number) => new Date(NOW.getTime() + ms)
const MIN = 60_000

describe('validateDueAt', () => {
  it('accepts exactly 5 minutes ahead', () => {
    expect(validateDueAt(NOW, plus(5 * MIN))).toBe('ok')
  })
  it('rejects 4:59 ahead', () => {
    expect(validateDueAt(NOW, plus(5 * MIN - 1000))).toBe('TOO_SOON')
  })
  it('rejects times in the past', () => {
    expect(validateDueAt(NOW, plus(-MIN))).toBe('TOO_SOON')
  })
  it('accepts exactly 1 year ahead', () => {
    expect(validateDueAt(NOW, new Date('2027-06-01T12:00:00.000Z'))).toBe('ok')
  })
  it('allows through Feb 28 of next year when now is Feb 29 (no overflow into March)', () => {
    const leap = new Date('2028-02-29T12:00:00.000Z')
    expect(validateDueAt(leap, new Date('2029-02-28T12:00:00.000Z'))).toBe('ok')
    expect(validateDueAt(leap, new Date('2029-02-28T12:01:00.000Z'))).toBe(
      'TOO_FAR',
    )
  })
  it('rejects 1 year + 1 minute', () => {
    expect(validateDueAt(NOW, new Date('2027-06-01T12:01:00.000Z'))).toBe(
      'TOO_FAR',
    )
  })
})

describe('defaultDueAt', () => {
  it('at :54 picks the next hour (6 min away)', () => {
    const now = new Date('2026-06-01T12:54:00.000Z')
    expect(defaultDueAt(now).toISOString()).toBe('2026-06-01T13:00:00.000Z')
  })
  it('at :56 skips to the hour after (only 4 min away)', () => {
    const now = new Date('2026-06-01T12:56:00.000Z')
    expect(defaultDueAt(now).toISOString()).toBe('2026-06-01T14:00:00.000Z')
  })
  it('exactly on the hour picks the following hour', () => {
    expect(defaultDueAt(NOW).toISOString()).toBe('2026-06-01T13:00:00.000Z')
  })
  it('exactly 5 minutes before the hour counts as far enough', () => {
    const now = new Date('2026-06-01T12:55:00.000Z')
    expect(defaultDueAt(now).toISOString()).toBe('2026-06-01T13:00:00.000Z')
  })
  it('is a full hour on the wall clock of a :30 offset zone', () => {
    const now = new Date('2026-06-01T12:00:00.000Z') // 17:30 in Asia/Kolkata
    const due = defaultDueAt(now, 'Asia/Kolkata')
    expect(due.toISOString()).toBe('2026-06-01T12:30:00.000Z') // 18:00 local
  })
  it('falls back to UTC hours for an invalid zone', () => {
    const now = new Date('2026-06-01T12:54:00.000Z')
    expect(defaultDueAt(now, 'Nope/Zone').toISOString()).toBe(
      '2026-06-01T13:00:00.000Z',
    )
  })
  it('lands on a wall-clock hour in America/Chicago across the 2027-03-14 spring-forward', () => {
    const now = new Date('2027-03-14T07:56:00.000Z') // 1:56 AM CST, 2:00 AM does not exist
    const due = defaultDueAt(now, 'America/Chicago')
    expect(formatInZone(due, 'America/Chicago')).toBe(
      'Sun 4:00 AM America/Chicago',
    )
    expect(validateDueAt(now, due)).toBe('ok')
  })
  it('always passes validateDueAt', () => {
    for (let m = 0; m < 120; m++) {
      const now = plus(m * MIN)
      expect(validateDueAt(now, defaultDueAt(now))).toBe('ok')
    }
  })
})

describe('resolveTimeZone', () => {
  it('prefers the user timezone', () => {
    expect(resolveTimeZone('America/Chicago', 'Europe/London')).toBe(
      'America/Chicago',
    )
  })
  it('uses the browser timezone when the user timezone is null', () => {
    expect(resolveTimeZone(null, 'Europe/London')).toBe('Europe/London')
  })
  it('uses the browser timezone when the user timezone is invalid', () => {
    expect(resolveTimeZone('Not/AZone', 'Europe/London')).toBe('Europe/London')
  })
  it('falls back to UTC when neither is usable', () => {
    expect(resolveTimeZone(undefined, '')).toBe('UTC')
  })
})

describe('formatInZone', () => {
  it('formats weekday, time, and zone label', () => {
    expect(
      formatInZone(new Date('2026-06-02T20:00:00.000Z'), 'America/Chicago'),
    ).toBe('Tue 3:00 PM America/Chicago')
  })
  it('uses CST before the 2027-03-14 DST change', () => {
    // Sat 2027-03-13 18:00 UTC = 12:00 PM CST (UTC-6)
    expect(
      formatInZone(new Date('2027-03-13T18:00:00.000Z'), 'America/Chicago'),
    ).toBe('Sat 12:00 PM America/Chicago')
  })
  it('uses CDT after the 2027-03-14 DST change', () => {
    // Sun 2027-03-14 18:00 UTC = 1:00 PM CDT (UTC-5)
    expect(
      formatInZone(new Date('2027-03-14T18:00:00.000Z'), 'America/Chicago'),
    ).toBe('Sun 1:00 PM America/Chicago')
  })
  it('shifts the weekday across the date line', () => {
    expect(
      formatInZone(new Date('2026-06-02T20:00:00.000Z'), 'Asia/Tokyo'),
    ).toBe('Wed 5:00 AM Asia/Tokyo')
  })
  it('labels UTC when given an invalid zone', () => {
    expect(formatInZone(new Date('2026-06-02T20:00:00.000Z'), 'Bad/Zone')).toBe(
      'Tue 8:00 PM UTC',
    )
  })
})
