import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetClock } from '../lib/clock'
import { resetFactoryData } from './factories'
import { server } from './msw'

// Any request without a handler fails the test: no real network calls.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetClock()
})
afterAll(async () => {
  server.close()
  await resetFactoryData()
})
