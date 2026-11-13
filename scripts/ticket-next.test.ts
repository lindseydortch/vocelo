import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('./ticket-next.sh', import.meta.url))

type Issue = { number: number; title: string; labels: string[]; body?: string }

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
    body: i.body ?? '',
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

describe('ticket-next.sh MVP/stretch grouping', () => {
  it('lists MVP before stretch, then unlabeled, within Ready', () => {
    const r = run(
      [
        { number: 10, title: 'feat: later', labels: ['stretch'] },
        { number: 11, title: 'feat: core', labels: ['MVP'] },
        { number: 12, title: 'chore: plain', labels: [] },
      ],
      [],
    )
    const ready = r.stdout.split('In progress')[0] ?? ''
    const mvp = ready.indexOf('[MVP]')
    const stretch = ready.indexOf('[Stretch]')
    const other = ready.indexOf('[Unlabeled]')
    expect(mvp).toBeGreaterThan(-1)
    expect(mvp).toBeLessThan(stretch)
    expect(stretch).toBeLessThan(other)
    expect(ready.indexOf('#11')).toBeGreaterThan(mvp)
    expect(ready.indexOf('#11')).toBeLessThan(stretch)
    expect(ready.indexOf('#10')).toBeGreaterThan(stretch)
    expect(ready.indexOf('#12')).toBeGreaterThan(other)
  })

  it('shows an MVP ticket blocked by a stretch ticket as blocked, not ready', () => {
    const r = run(
      [
        {
          number: 20,
          title: 'feat: needs stretch',
          labels: ['MVP'],
          body: '**Blocked by:** #21',
        },
        { number: 21, title: 'feat: stretch dep', labels: ['stretch'] },
      ],
      [],
    )
    const [ready = '', blocked = ''] = r.stdout.split('Blocked (do not start)')
    expect(ready).not.toContain('#20')
    expect(ready).toContain('#21')
    expect(blocked).toContain('[MVP]')
    expect(blocked).toContain('#20 feat: needs stretch')
  })
})
