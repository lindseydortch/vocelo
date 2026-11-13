type ClockSource = () => Date

const realClock: ClockSource = () => new Date()

let source: ClockSource = realClock

/** Current time. Use this instead of `new Date()` so tests can control it. */
export function now(): Date {
  return new Date(source().getTime())
}

/** Test seam: replace the time source. */
export function setClock(next: ClockSource): void {
  source = next
}

export function resetClock(): void {
  source = realClock
}
