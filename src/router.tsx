import { createRouter } from '@tanstack/react-router'
import { PENDING_MS, Pending } from '~/components/Pending'
import { routeTree } from './routeTree.gen'

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
