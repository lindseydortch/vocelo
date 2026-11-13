/** A short id users can quote to support and that appears in the logged error. */
export function newRequestId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

/** Structured `console.error` carrying the request id (no error tracker in the MVP). */
export function logError(requestId: string, error: unknown): void {
  console.error('[error]', {
    requestId,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
}
