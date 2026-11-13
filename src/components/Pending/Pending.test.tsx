// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PENDING_MS } from '~/router'
import { Pending } from './Pending'

function slowRouter(loadMs: number) {
  const root = createRootRoute()
  const slow = createRoute({
    getParentRoute: () => root,
    path: '/',
    loader: () => new Promise<void>((r) => setTimeout(r, loadMs)),
    component: () => <p>Loaded</p>,
  })
  return createRouter({
    routeTree: root.addChildren([slow]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultPendingComponent: Pending,
    defaultPendingMs: PENDING_MS,
    defaultPendingMinMs: PENDING_MS,
  })
}

describe('shared Pending', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('is not rendered before 300 ms, then renders, then gives way to the page', async () => {
    const router = slowRouter(1000)
    await act(async () => {
      render(<RouterProvider router={router} />)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_MS - 50)
    })
    expect(screen.queryByText('Loading…')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(screen.getByText('Loading…')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.getByText('Loaded')).toBeTruthy()
  })

  it('never shows for a fast load', async () => {
    const router = slowRouter(100)
    await act(async () => {
      render(<RouterProvider router={router} />)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.getByText('Loaded')).toBeTruthy()
  })
})
