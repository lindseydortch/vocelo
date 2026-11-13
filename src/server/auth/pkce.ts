import { createHash, randomBytes } from 'node:crypto'

/** 32 random bytes, base64url: 43 chars, valid as an RFC 7636 verifier and as OAuth `state`. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

/** PKCE S256 challenge: base64url(sha256(verifier)). */
export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}
