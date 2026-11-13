import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '../env'

const VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16

/** Callers treat this as a dead token (re-auth), never as a 500. */
export class TokenDecryptError extends Error {
  constructor(reason: string) {
    super(`Cannot decrypt token: ${reason}`)
    this.name = 'TokenDecryptError'
  }
}

function key(): Buffer {
  return Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64')
}

/** AES-256-GCM. Returns `v1:<iv>:<tag>:<ciphertext>` (base64 parts, random IV per call). */
export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ])
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

export function decryptToken(stored: string): string {
  const parts = stored.split(':')
  if (parts[0] !== VERSION) throw new TokenDecryptError('unknown format')
  if (parts.length !== 4) throw new TokenDecryptError('malformed value')
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string]
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new TokenDecryptError('malformed value')
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new TokenDecryptError('wrong key or tampered value')
  }
}
