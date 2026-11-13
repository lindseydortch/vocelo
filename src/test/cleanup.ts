const cleanups = new Set<() => Promise<void>>()

/** Register a function to run once after the current test file (see setup.ts). */
export function registerCleanup(fn: () => Promise<void>): void {
  cleanups.add(fn)
}

export async function runCleanups(): Promise<void> {
  const fns = [...cleanups]
  cleanups.clear()
  for (const fn of fns) await fn()
}
