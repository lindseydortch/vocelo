import { createFileRoute } from '@tanstack/react-router'

// Escape the underscores so this is a literal URL segment, not a pathless layout.
export const Route = createFileRoute('/__dev/login')({
  server: {
    handlers: {
      GET: async () => {
        const { handleDevLogin } = await import('~/server/auth/dev-login')
        return handleDevLogin()
      },
    },
  },
})
