import { createFileRoute } from '@tanstack/react-router'

// `[__test]` escapes the leading underscores so the path is literally `/__test/login`.
export const Route = createFileRoute('/__test/login')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleTestLogin } = await import('~/server/auth/test-login')
        return handleTestLogin(request)
      },
    },
  },
})
