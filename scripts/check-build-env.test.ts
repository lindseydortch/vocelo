import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { checkBuildEnv } from './check-build-env'

const script = new URL('./check-build-env.ts', import.meta.url).pathname

function run(env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
  })
}

describe('checkBuildEnv', () => {
  it('returns an error when E2E_AUTH is set', () => {
    expect(checkBuildEnv({ E2E_AUTH: '1' })).toMatch(/E2E_AUTH/)
  })

  it('treats an empty E2E_AUTH as set', () => {
    expect(checkBuildEnv({ E2E_AUTH: '' })).toMatch(/E2E_AUTH/)
  })

  it('returns null when E2E_AUTH is unset', () => {
    expect(checkBuildEnv({})).toBeNull()
  })
})

describe('check-build-env script', () => {
  it('exits 1 when E2E_AUTH is set', () => {
    const result = run({ E2E_AUTH: '1' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/E2E_AUTH/)
  })

  it('exits 0 when E2E_AUTH is unset', () => {
    expect(run({}).status).toBe(0)
  })
})
