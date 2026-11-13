import { describe, expect, it } from 'vitest'
import type { ConfigEnv, Plugin, UserConfig } from 'vite'
import viteConfig from './vite.config'

async function pluginNames(command: ConfigEnv['command']) {
  const env: ConfigEnv = { command, mode: 'test' }
  const config = (
    typeof viteConfig === 'function' ? await viteConfig(env) : viteConfig
  ) as UserConfig
  const flat = ((config.plugins ?? []) as unknown[]).flat(Infinity) as Array<
    Plugin | false | null
  >
  return flat.filter(Boolean).map((p) => (p as Plugin).name)
}

describe('vite.config plugins', () => {
  it('omits the Netlify plugin for serve (dev + Playwright)', async () => {
    const names = await pluginNames('serve')
    expect(names.some((n) => n.toLowerCase().includes('netlify'))).toBe(false)
  })

  it('includes the Netlify plugin for build', async () => {
    const names = await pluginNames('build')
    expect(names.some((n) => n.toLowerCase().includes('netlify'))).toBe(true)
  })

  it('keeps the same non-Netlify plugins in both commands', async () => {
    const strip = (ns: string[]) =>
      ns.filter((n) => !n.toLowerCase().includes('netlify'))
    expect(strip(await pluginNames('serve'))).toEqual(
      strip(await pluginNames('build')),
    )
  })
})
