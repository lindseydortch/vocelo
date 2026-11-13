import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/buffer/start')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleOAuthStart } = await import('~/server/auth/oauth-start')
        return handleOAuthStart(request)
      },
    },
  },
})
