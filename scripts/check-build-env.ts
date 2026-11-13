// Run first in the Netlify build. E2E_AUTH enables the /__test/login helper,
// so a deploy built with it set must never ship.
export function checkBuildEnv(env: NodeJS.ProcessEnv): string | null {
  if (env.E2E_AUTH !== undefined) {
    return 'E2E_AUTH is set. It enables the test sign-in helper and must never be set in a deploy build. Remove it from the Netlify environment variables.'
  }
  return null
}

// Node 24 runs this file directly (type stripping); skip when imported by tests.
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const error = checkBuildEnv(process.env)
  if (error) {
    console.error(`check-build-env: ${error}`)
    process.exit(1)
  }
}
