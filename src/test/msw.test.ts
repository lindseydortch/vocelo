import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './msw'

describe('msw server', () => {
  it('serves a registered handler', async () => {
    server.use(
      http.get('https://api.example.test/ping', () =>
        HttpResponse.json({ ok: true }),
      ),
    )
    const res = await fetch('https://api.example.test/ping')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('fails on a request with no handler', async () => {
    await expect(fetch('https://api.example.test/unhandled')).rejects.toThrow()
  })
})
