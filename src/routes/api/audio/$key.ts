import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/audio/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { handleAudioFetch } = await import('~/server/audio-fetch')
        return handleAudioFetch(params.key)
      },
    },
  },
})
