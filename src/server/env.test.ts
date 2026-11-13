import { describe, expect, it } from 'vitest'
import { EnvError, parseEnv } from './env'

const valid = {
  APP_URL: 'https://localhost:3000',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  SESSION_SECRET: 'session-secret',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  BUFFER_CLIENT_ID: 'buffer-id',
  BUFFER_CLIENT_SECRET: 'buffer-secret',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_CREATOR_PRICE_ID: 'price_x',
  TTS_PROVIDER: 'browser',
  LLM_PROVIDER: 'fixture',
}

function messageOf(source: Record<string, string | undefined>) {
  try {
    parseEnv(source)
  } catch (e) {
    expect(e).toBeInstanceOf(EnvError)
    return (e as Error).message
  }
  throw new Error('expected parseEnv to throw')
}

describe('parseEnv', () => {
  it.each([
    ['not 32 bytes', Buffer.alloc(16, 1).toString('base64')],
    ['too long', Buffer.alloc(33, 1).toString('base64')],
    ['not base64', 'token-key'],
  ])('rejects a TOKEN_ENCRYPTION_KEY that is %s', (_label, key) => {
    const msg = messageOf({ ...valid, TOKEN_ENCRYPTION_KEY: key })
    expect(msg).toContain('TOKEN_ENCRYPTION_KEY')
    expect(msg).toContain('32 bytes')
  })

  it('returns typed values for a valid env', () => {
    const env = parseEnv(valid)
    expect(env.APP_URL).toBe('https://localhost:3000')
    expect(env.TTS_PROVIDER).toBe('browser')
    expect(env.BUFFER_API_KEY).toBeUndefined()
  })

  it('lists every missing variable in one error', () => {
    const msg = messageOf({
      ...valid,
      SESSION_SECRET: undefined,
      DATABASE_URL: '',
      STRIPE_SECRET_KEY: undefined,
    })
    expect(msg).toContain('SESSION_SECRET')
    expect(msg).toContain('DATABASE_URL')
    expect(msg).toContain('STRIPE_SECRET_KEY')
    expect(msg).not.toContain('APP_URL')
  })

  it('lists all names when the env is empty', () => {
    const msg = messageOf({})
    for (const name of Object.keys(valid)) expect(msg).toContain(name)
  })

  it('rejects an unknown provider value', () => {
    expect(messageOf({ ...valid, TTS_PROVIDER: 'nope' })).toContain(
      'TTS_PROVIDER',
    )
  })

  it('rejects an APP_URL that is not a URL', () => {
    expect(messageOf({ ...valid, APP_URL: 'localhost' })).toContain('APP_URL')
  })

  describe('TTS_PROVIDER=elevenlabs', () => {
    it('requires ELEVENLABS_API_KEY', () => {
      expect(messageOf({ ...valid, TTS_PROVIDER: 'elevenlabs' })).toContain(
        'ELEVENLABS_API_KEY',
      )
    })
    it('accepts it when set', () => {
      expect(
        parseEnv({
          ...valid,
          TTS_PROVIDER: 'elevenlabs',
          ELEVENLABS_API_KEY: 'k',
        }).ELEVENLABS_API_KEY,
      ).toBe('k')
    })
    it.each(['browser', 'fixture'])('does not require it for %s', (p) => {
      expect(() => parseEnv({ ...valid, TTS_PROVIDER: p })).not.toThrow()
    })
  })

  describe('LLM_PROVIDER=anthropic', () => {
    it('requires ANTHROPIC_API_KEY', () => {
      expect(messageOf({ ...valid, LLM_PROVIDER: 'anthropic' })).toContain(
        'ANTHROPIC_API_KEY',
      )
    })
    it('accepts it when set', () => {
      expect(
        parseEnv({
          ...valid,
          LLM_PROVIDER: 'anthropic',
          ANTHROPIC_API_KEY: 'k',
        }).ANTHROPIC_API_KEY,
      ).toBe('k')
    })
    it('does not require it for fixture', () => {
      expect(() =>
        parseEnv({ ...valid, LLM_PROVIDER: 'fixture' }),
      ).not.toThrow()
    })
  })

  it('reports provider keys together with other missing names', () => {
    const msg = messageOf({
      ...valid,
      SESSION_SECRET: undefined,
      TTS_PROVIDER: 'elevenlabs',
      LLM_PROVIDER: 'anthropic',
    })
    for (const n of [
      'SESSION_SECRET',
      'ELEVENLABS_API_KEY',
      'ANTHROPIC_API_KEY',
    ])
      expect(msg).toContain(n)
  })
})
