import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Run first in the Netlify build: development sign-in helpers must never ship enabled.
export function checkBuildEnv(env: NodeJS.ProcessEnv): string | null {
  if (env.E2E_AUTH !== undefined) {
    return 'E2E_AUTH is set. It enables the test sign-in helper and must never be set in a deploy build. Remove it from the Netlify environment variables.'
  }
  if (env.BUFFER_API_KEY !== undefined) {
    return 'BUFFER_API_KEY is set. It enables the dev sign-in helper and must never be set in a deploy build. Remove it from the Netlify environment variables.'
  }
  return null
}

// Node 24 runs this file directly (type stripping); skip when imported by tests.
const isEntry =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))

if (isEntry) {
  const error = checkBuildEnv(process.env)
  if (error) {
    console.error(`check-build-env: ${error}`)
    process.exit(1)
  }
}
