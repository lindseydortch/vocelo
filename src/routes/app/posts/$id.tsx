import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { composerCopy } from '~/content/copy'
import { pageTitle } from '~/lib/head'
import { loadPost } from '~/server/posts/get-post-fn'
import styles from './$id.module.scss'

const copy = composerCopy

function ComposerPage() {
  const { post, readOnly } = Route.useLoaderData()
  return (
    <main className={styles.page} data-read-only={readOnly}>
      <h1>{copy.title}</h1>
      <div data-slot="composer-top">
        <div data-slot="banners">{copy.slots.banners}</div>
        <div data-slot="meter">{copy.slots.meter}</div>
      </div>
      {readOnly && <p role="status">{copy.readOnly}</p>}
      <div className={styles.layout}>
        <section data-slot="composer-left" aria-label={post.channelName}>
          {(['channel', 'editor', 'counter', 'save', 'hint'] as const).map(
            (slot) => (
              <div key={slot} data-slot={slot}>
                {copy.slots[slot]}
              </div>
            ),
          )}
        </section>
        <aside data-slot="composer-right">{copy.slots.persona}</aside>
      </div>
    </main>
  )
}

export const Route = createFileRoute('/app/posts/$id')({
  loader: async ({ params }) => {
    const result = await loadPost({ data: { id: params.id } })
    if (result.status === 'not_found') throw notFound()
    if (result.status === 'locked')
      throw redirect({ to: '/app', search: { locked: true } })
    return result
  },
  head: () => ({ meta: [{ title: pageTitle(copy.title) }] }),
  component: ComposerPage,
})
