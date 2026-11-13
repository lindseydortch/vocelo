// Pure helpers for scheduling times. Browser-safe: only Date and Intl, no Node APIs.

export type DueAtCheck = 'ok' | 'TOO_SOON' | 'TOO_FAR'

export const MIN_LEAD_MS = 5 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Latest allowed due time: one calendar year after `now`. */
function maxDueAt(now: Date): Date {
  const max = new Date(now.getTime())
  max.setUTCFullYear(max.getUTCFullYear() + 1)
  return max
}

/** Pick-a-time rule: at least 5 minutes and at most 1 year ahead (both ends inclusive). */
export function validateDueAt(now: Date, dueAt: Date): DueAtCheck {
  if (dueAt.getTime() - now.getTime() < MIN_LEAD_MS) return 'TOO_SOON'
  if (dueAt.getTime() > maxDueAt(now).getTime()) return 'TOO_FAR'
  return 'ok'
}

/** Offset of `tz` from UTC at `date`, in ms. */
function zoneOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date)
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - (date.getTime() - date.getUTCMilliseconds())
}

/**
 * Next full hour that is at least 5 minutes away. Pass `timeZone` so "full hour"
 * means the wall-clock hour there (matters for :30 offset zones); defaults to UTC.
 */
export function defaultDueAt(now: Date, timeZone?: string | null): Date {
  const offset = isValidTimeZone(timeZone) ? zoneOffsetMs(now, timeZone) : 0
  const local = now.getTime() + offset
  let candidate = Math.ceil(local / HOUR_MS) * HOUR_MS - offset
  while (candidate - now.getTime() < MIN_LEAD_MS) candidate += HOUR_MS
  return new Date(candidate)
}

/** The user's saved timezone if it is a real IANA zone, else the browser's, else UTC. */
export function resolveTimeZone(
  userTz: string | null | undefined,
  browserTz: string | null | undefined,
): string {
  if (isValidTimeZone(userTz)) return userTz
  if (isValidTimeZone(browserTz)) return browserTz
  return 'UTC'
}

/** "Tue 3:00 PM America/Chicago" */
export function formatInZone(date: Date, tz: string): string {
  const zone = isValidTimeZone(tz) ? tz : 'UTC'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('hour')}:${get('minute')} ${get('dayPeriod')} ${zone}`
}
