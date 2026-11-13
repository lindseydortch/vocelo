export type AppSection = 'posts' | 'personas' | 'settings'

/** Which header nav section a pathname belongs to, or null (e.g. checkout pages). */
export function currentSection(pathname: string): AppSection | null {
  const path = pathname.replace(/\/+$/, '')
  if (
    path === '/app' ||
    path === '/app/posts' ||
    path.startsWith('/app/posts/')
  )
    return 'posts'
  if (path === '/app/personas') return 'personas'
  if (path === '/app/settings' || path.startsWith('/app/settings/'))
    return 'settings'
  return null
}
