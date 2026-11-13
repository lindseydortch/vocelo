import { Link, useRouterState } from '@tanstack/react-router'
import { pagesCopy } from '~/content/copy'
import { type AppSection, currentSection } from '~/lib/app-nav'
import styles from './AppShell.module.scss'

export function AppShell() {
  const { appShell } = pagesCopy
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const section = currentSection(pathname)
  // Router marks active links itself, but fuzzy: /app would match every page.
  // Posts uses an exact match; currentSection adds /app/posts/* on top.
  const ariaCurrent = (name: AppSection) =>
    section === name ? ({ 'aria-current': 'page' } as const) : {}

  return (
    <>
      <header className={styles.header}>
        <Link to="/app">{appShell.brand}</Link>
        <nav aria-label={appShell.navLabel} className={styles.nav}>
          <Link
            to="/app"
            activeOptions={{ exact: true }}
            {...ariaCurrent('posts')}
          >
            {appShell.nav.posts}
          </Link>
          <Link to="/app/personas" {...ariaCurrent('personas')}>
            {appShell.nav.personas}
          </Link>
          <Link to="/app/settings" {...ariaCurrent('settings')}>
            {appShell.nav.settings}
          </Link>
        </nav>
        {/* Right-hand slot: the plan chip (G5) fills this. */}
        <div className={styles.end} data-slot="header-end" />
      </header>
      {/* Banner slot: the past_due banner (P11) fills this. */}
      <div data-slot="banner" />
    </>
  )
}
