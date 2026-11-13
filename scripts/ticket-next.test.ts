import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('./ticket-next.sh', import.meta.url))

type Issue = { number: number; title: string; labels: string[] }

// Fake `gh` (issues come from FAKE_ISSUES) and fake `git` (no remote branches).
function run(issues: Issue[], args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'ticket-next-'))
  const bin = (name: string, body: string) => {
    writeFileSync(join(dir, name), `#!/usr/bin/env node\n${body}\n`)
    chmodSync(join(dir, name), 0o755)
  }
  bin(
    'gh',
    `const a = process.argv.slice(2)
if (a[0] === 'issue' && a[1] === 'list') process.stdout.write(process.env.FAKE_ISSUES)
else if (a[0] === 'pr') process.stdout.write('[]')`,
  )
  bin('git', '')
  const payload = issues.map((i) => ({
    number: i.number,
    title: i.title,
    state: 'OPEN',
    stateReason: null,
    body: '',
    blockedBy: { nodes: [] },
    labels: i.labels.map((name) => ({ name })),
  }))
  return spawnSync('bash', [script, ...args], {
    env: {
      PATH: `${dir}:${process.env.PATH ?? ''}`,
      FAKE_ISSUES: JSON.stringify(payload),
    },
    encoding: 'utf8',
  })
}

const issues: Issue[] = [
  { number: 1, title: 'feat: normal', labels: ['MVP'] },
  { number: 2, title: 'fix: held', labels: ['ci', 'on-hold'] },
]

describe('ticket-next.sh on-hold', () => {
  it('--check passes for a normal ticket', () => {
    const r = run(issues, ['--check', '1'])
    expect(r.status).toBe(0)
  })

  it('--check refuses an on-hold ticket', () => {
    const r = run(issues, ['--check', '2'])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('on hold')
  })

  it('lists on-hold tickets under On hold, not Ready', () => {
    const r = run(issues, [])
    const [ready, rest] = r.stdout.split('On hold')
    expect(ready).toContain('#1 feat: normal')
    expect(ready).not.toContain('#2')
    expect(rest).toContain('#2 fix: held')
  })
})
