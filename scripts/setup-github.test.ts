import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('./setup-github.sh', import.meta.url))

type Call = { args: string[]; stdin: string }

// Fake `gh`: logs each call as JSON; fails on any call when FAKE_GH_FAIL matches the args.
function runScript(opts: { failOn?: string } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'setup-github-'))
  const log = join(dir, 'calls.jsonl')
  const fake = join(dir, 'gh')
  writeFileSync(
    fake,
    `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
const stdin = args.includes('--input') ? fs.readFileSync(0, 'utf8') : ''
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ args, stdin }) + '\\n')
const fail = process.env.FAKE_GH_FAIL
if (fail && args.join(' ').includes(fail)) { console.error('gh: boom'); process.exit(1) }
`,
  )
  chmodSync(fake, 0o755)
  const result = spawnSync('bash', [script], {
    env: {
      PATH: process.env.PATH ?? '',
      GH: fake,
      REPO: 'owner/repo',
      FAKE_GH_LOG: log,
      FAKE_GH_FAIL: opts.failOn ?? '',
    },
    encoding: 'utf8',
  })
  let calls: Call[] = []
  try {
    calls = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  } catch {
    // no calls made
  }
  return { result, calls }
}

const puts = (calls: Call[]) => calls.filter((c) => c.args.includes('PUT'))

describe('setup-github.sh', () => {
  it('protects dev and main with PR required, 0 approvals, no force pushes', () => {
    const { result, calls } = runScript()
    expect(result.status).toBe(0)
    const branches = puts(calls).map((c) =>
      c.args.find((a) => a.includes('/branches/')),
    )
    expect(branches).toEqual([
      'repos/owner/repo/branches/dev/protection',
      'repos/owner/repo/branches/main/protection',
    ])
    for (const call of puts(calls)) {
      const body = JSON.parse(call.stdin)
      expect(
        body.required_pull_request_reviews.required_approving_review_count,
      ).toBe(0)
      expect(body.allow_force_pushes).toBe(false)
      expect(body.allow_deletions).toBe(false)
    }
  })

  it('requires the five checks and up-to-date branches', () => {
    const { calls } = runScript()
    for (const call of puts(calls)) {
      const checks = JSON.parse(call.stdin).required_status_checks
      expect(checks.contexts).toEqual([
        'typecheck',
        'lint',
        'test',
        'build',
        'e2e',
      ])
      expect(checks.strict).toBe(true)
    }
  })

  it('sets repo merge options: squash + merge commit on, rebase off, auto-delete on', () => {
    const { calls } = runScript()
    const patch = calls.find((c) => c.args.includes('PATCH'))
    expect(patch?.args).toEqual(
      expect.arrayContaining([
        'allow_squash_merge=true',
        'allow_merge_commit=true',
        'allow_rebase_merge=false',
        'delete_branch_on_merge=true',
        'allow_auto_merge=true',
      ]),
    )
  })

  it('is idempotent: two runs make identical calls', () => {
    expect(runScript().calls).toEqual(runScript().calls)
  })

  it('prints the resulting settings by reading them back', () => {
    const { calls } = runScript()
    const reads = calls.filter(
      (c) => !c.args.includes('PUT') && !c.args.includes('PATCH'),
    )
    expect(reads.map((c) => c.args[1])).toEqual([
      'repos/owner/repo',
      'repos/owner/repo/branches/dev/protection',
      'repos/owner/repo/branches/main/protection',
    ])
  })

  it('exits non-zero and stops when gh fails', () => {
    const { result, calls } = runScript({ failOn: 'branches/dev/protection' })
    expect(result.status).not.toBe(0)
    expect(puts(calls)).toHaveLength(1)
  })
})
