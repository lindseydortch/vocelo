// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { users } from '~/db/schema'
import { createDb } from '~/db/client'
import { testDatabaseUrl } from '~/test/db'
import { createTestUser } from '~/test/factories'
import { BillingCanceled } from './BillingCanceled'

afterEach(cleanup)

async function renderPage() {
  const root = createRootRoute()
  const canceled = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: BillingCanceled,
  })
  const pricing = createRoute({
    getParentRoute: () => root,
    path: '/pricing',
    component: () => <p>Pricing page</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([canceled, pricing]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return router
}

describe('BillingCanceled', () => {
  it('shows "No changes made" and links back to /pricing', async () => {
    await renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'No changes made' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Back to pricing' }).getAttribute('href'),
    ).toBe('/pricing')
  })

  it('does not follow the link on its own', async () => {
    const router = await renderPage()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('BillingCanceled (database)', () => {
  const db = createDb(testDatabaseUrl())
  afterAll(async () => {
    await db.$client.end()
  })

  it('leaves the user row unchanged', async () => {
    const user = await createTestUser({ plan: 'free' })
    const read = () => db.select().from(users).where(eq(users.id, user.id))
    const before = await read()
    await renderPage()
    expect(await read()).toEqual(before)
  })
})
