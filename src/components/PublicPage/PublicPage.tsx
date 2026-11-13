import { PublicFooter } from '~/components/PublicFooter/PublicFooter'
import styles from './PublicPage.module.scss'

export function PublicPage({
  heading,
  body,
}: {
  heading: string
  body: string
}) {
  return (
    <>
      <main className={styles.page}>
        <h1>{heading}</h1>
        <p>{body}</p>
      </main>
      <PublicFooter />
    </>
  )
}
