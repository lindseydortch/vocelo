import { setClock } from '../lib/clock'

/** Freeze `now()` at a fixed time. Pair with `resetClock()` (done in setup). */
export function freezeTime(at: string | number | Date): void {
  const fixed = new Date(at)
  if (Number.isNaN(fixed.getTime())) {
    throw new Error(`freezeTime: invalid date ${String(at)}`)
  }
  setClock(() => fixed)
}
