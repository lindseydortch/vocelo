import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkBuildEnv } from './check-build-env'

const script = fileURLToPath(new URL('./check-build-env.ts', import.meta.url))

function run(env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
  })
}

describe('checkBuildEnv', () => {
  it.each(['personal-secret', ''])(
    'rejects a set BUFFER_API_KEY (%s)',
    (key) => {
      const error = checkBuildEnv({ BUFFER_API_KEY: key })
      expect(error).toMatch(/BUFFER_API_KEY/)
      if (key) expect(error).not.toContain(key)
    },
  )

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
  it('exits 1 when BUFFER_API_KEY is set without printing its value', () => {
    const result = run({ BUFFER_API_KEY: 'personal-secret' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/BUFFER_API_KEY/)
    expect(result.stderr).not.toContain('personal-secret')
  })

  it('exits 1 when E2E_AUTH is set', () => {
    const result = run({ E2E_AUTH: '1' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/E2E_AUTH/)
  })

  it('exits 0 when E2E_AUTH is unset', () => {
    expect(run({}).status).toBe(0)
  })
})
