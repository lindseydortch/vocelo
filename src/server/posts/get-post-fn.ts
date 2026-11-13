import { createServerFn } from '@tanstack/react-start'

/** Loader entry for `/app/posts/$id`: the signed-in user's post lookup. */
export const loadPost = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { requireUser } = await import('~/server/auth/session')
    const { getPostForUser } = await import('./get-post')
    const { user } = await requireUser()
    const result = await getPostForUser(user, data.id)
    if (result.status !== 'ok') return result
    const { id, text, channelName, channelService } = result.post
    return {
      status: 'ok' as const,
      readOnly: result.readOnly,
      post: { id, text, channelName, channelService },
    }
  })
