import { createFileRoute } from '@tanstack/react-router'
import styles from './index.module.scss'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className={styles.page}>
      <h1>Vocelo</h1>
      <p className={styles.note}>Placeholder home page.</p>
    </main>
  )
}
