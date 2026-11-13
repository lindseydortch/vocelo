import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main>
      <h1>Vocelo</h1>
      <p>Placeholder home page.</p>
    </main>
  )
}
