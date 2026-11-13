import type { ReactNode } from 'react'
import { PublicFooter } from '~/components/PublicFooter/PublicFooter'
import styles from './PublicPage.module.scss'

export function PublicPage({
  heading,
  body,
  children,
}: {
  heading: string
  body?: string
  children?: ReactNode
}) {
  return (
    <>
      <main className={styles.page}>
        <h1>{heading}</h1>
        {body && <p>{body}</p>}
        {children}
      </main>
      <PublicFooter />
    </>
  )
}
