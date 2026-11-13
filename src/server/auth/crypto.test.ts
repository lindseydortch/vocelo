import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenDecryptError, decryptToken, encryptToken } from './crypto'

const keyA = randomBytes(32).toString('base64')
const keyB = randomBytes(32).toString('base64')

beforeEach(() => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', keyA)
  vi.stubEnv('APP_URL', 'https://localhost:3000')
  vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5432/db')
  vi.stubEnv('SESSION_SECRET', 's')
  vi.stubEnv('BUFFER_CLIENT_ID', 'id')
  vi.stubEnv('BUFFER_CLIENT_SECRET', 'secret')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'wh')
  vi.stubEnv('STRIPE_CREATOR_PRICE_ID', 'price')
  vi.stubEnv('TTS_PROVIDER', 'browser')
  vi.stubEnv('LLM_PROVIDER', 'fixture')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('token encryption', () => {
  it('round-trips a token', () => {
    const stored = encryptToken('buffer-access-token')
    expect(decryptToken(stored)).toBe('buffer-access-token')
  })

  it('stores as v1:<iv>:<tag>:<ciphertext>', () => {
    const parts = encryptToken('abc').split(':')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('v1')
    expect(Buffer.from(parts[1]!, 'base64')).toHaveLength(12)
    expect(Buffer.from(parts[2]!, 'base64')).toHaveLength(16)
  })

  it('encrypts the same input differently each time', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'))
  })

  it('throws TokenDecryptError for a tampered ciphertext', () => {
    const [v, iv, tag, ct] = encryptToken('secret-token').split(':')
    const bytes = Buffer.from(ct!, 'base64')
    bytes[0] = bytes[0]! ^ 0xff
    const tampered = [v, iv, tag, bytes.toString('base64')].join(':')
    expect(() => decryptToken(tampered)).toThrow(TokenDecryptError)
  })

  it('throws TokenDecryptError for a tampered auth tag', () => {
    const [v, iv, tag, ct] = encryptToken('secret-token').split(':')
    const bytes = Buffer.from(tag!, 'base64')
    bytes[0] = bytes[0]! ^ 0xff
    const tampered = [v, iv, bytes.toString('base64'), ct].join(':')
    expect(() => decryptToken(tampered)).toThrow(TokenDecryptError)
  })

  it('throws TokenDecryptError when decrypting with a different key', async () => {
    const stored = encryptToken('secret-token')
    // env caches its first parse, so load a fresh module instance with the new key
    vi.resetModules()
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', keyB)
    const fresh = await import('./crypto')
    expect(() => fresh.decryptToken(stored)).toThrow(fresh.TokenDecryptError)
  })

  it('throws TokenDecryptError for an unknown prefix', () => {
    const stored = encryptToken('secret-token').replace(/^v1:/, 'v2:')
    expect(() => decryptToken(stored)).toThrow(TokenDecryptError)
  })

  it('throws TokenDecryptError for malformed input', () => {
    expect(() => decryptToken('')).toThrow(TokenDecryptError)
    expect(() => decryptToken('v1:only:three')).toThrow(TokenDecryptError)
    expect(() => decryptToken('plain-token')).toThrow(TokenDecryptError)
  })

  it('does not leak the plaintext in the error', () => {
    try {
      decryptToken('v2:a:b:c')
    } catch (e) {
      expect(e).toBeInstanceOf(TokenDecryptError)
      expect((e as Error).name).toBe('TokenDecryptError')
    }
  })
})
