export const MAX_POST_CHARS = 20000

/** Line endings → `\n`, Unicode NFC. Never trims. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').normalize('NFC')
}

export function isBlank(text: string): boolean {
  return text.trim().length === 0
}

/** sha256 hex of the normalized text. Web Crypto, same in Node and browser. */
export async function textHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeText(text))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}
