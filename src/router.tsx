import { createRouter } from '@tanstack/react-router'
import { Pending } from '~/components/Pending'
import { routeTree } from './routeTree.gen'

export const PENDING_MS = 300

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPendingComponent: Pending,
    defaultPendingMs: PENDING_MS,
    defaultPendingMinMs: PENDING_MS,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
