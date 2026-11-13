import '@tanstack/react-start/server-only'

/**
 * Stub: the sample post's content is built in Step 10. Must stay idempotent
 * (safe to call on every sign-in) once implemented.
 */
export async function ensureSamplePost(userId: string): Promise<void> {
  void userId
}
