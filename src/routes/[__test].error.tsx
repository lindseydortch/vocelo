import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

// Throws on purpose so E2E can reach the root error page. Off unless `E2E_AUTH=1`.
const explode = createServerFn({ method: 'GET' }).handler(async () => {
  const { isTestLoginEnabled } = await import('~/server/auth/test-login')
  if (!isTestLoginEnabled()) throw notFound()
  throw new Error('E2E deliberate error')
})

export const Route = createFileRoute('/__test/error')({
  loader: () => explode(),
})
