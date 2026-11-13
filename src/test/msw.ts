import { setupServer } from 'msw/node'

/** Shared MSW server. Integration tickets add their own handlers via `server.use(...)`. */
export const server = setupServer()
