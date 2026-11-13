import { createServerFn } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { composerCopy } from '~/content/copy'
import { pagesCopy } from '~/content/copy/pages'
import { pageTitle } from '~/lib/head'
import { isBlank } from '~/lib/text'

const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireUser } = await import('~/server/auth/session')
  const { listPosts } = await import('~/server/posts/list-posts')
  const { user } = await requireUser()
  return listPosts(user)
})

export const Route = createFileRoute('/app/')({
  validateSearch: (search: Record<string, unknown>): { locked?: true } =>
    search.locked === true || search.locked === 'true' ? { locked: true } : {},
  head: () => ({ meta: [{ title: pageTitle(pagesCopy.dashboard.title) }] }),
  loader: () => getPosts(),
  component: Dashboard,
})

function relativeTime(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const unit = units.find(([, size]) => Math.abs(seconds) >= size)
  return unit
    ? formatter.format(Math.round(seconds / unit[1]), unit[0])
    : formatter.format(0, 'second')
}

function Dashboard() {
  const posts = Route.useLoaderData()
  const { locked } = Route.useSearch()
  const copy = pagesCopy.dashboard
  return (
    <main>
      <h1>{copy.heading}</h1>
      {locked && <p role="status">{composerCopy.lockedRedirect}</p>}
      <div data-slot="welcome-card" />
      <a href="/app/posts/new">{copy.newPost}</a>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <a href={`/app/posts/${post.id}`}>
              <span>
                {post.channelName} · {post.channelService}
              </span>{' '}
              <span>
                {isBlank(post.text) ? copy.emptyPost : post.text.slice(0, 80)}
              </span>{' '}
              <span>
                {copy.edited} {relativeTime(new Date(post.lastEditedAt))}
              </span>{' '}
              {post.isSample && <span>{copy.sample}</span>}
            </a>
          </li>
        ))}
      </ul>
      <div data-slot="locked-history-teaser" />
      <div data-slot="import-panel" />
    </main>
  )
}
