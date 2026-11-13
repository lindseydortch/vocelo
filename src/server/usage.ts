import { randomUUID } from 'node:crypto'

export type UsageRequest = {
  postId: string
  kind: 'tts_chars' | 'llm_call'
  amount: number
}

export type UsageResult =
  | { ok: true; eventId: string }
  | { ok: false; reason: 'posts' | 'characters' | 'rate'; needed: number; remaining: number }

/**
 * Reserve usage before calling a provider. The eventual implementation locks the
 * user, checks the current usage period, and records the charge atomically.
 * Free allows five reviewed posts and 12,000 voice characters per period;
 * Creator allows unlimited posts and 80,000 characters. Both plans allow 60
 * LLM calls per hour. A post is reviewed once per period on its first paid
 * action; sample posts, imports, and cached replays do not consume usage.
 * Requests exceeding a limit fail in full with the amount needed and remaining.
 * Free periods follow the signup anchor (reset when a subscription ends); paid
 * periods follow Stripe. Active, trialing, and past-due subscriptions are Creator.
 * This stub permits every request and writes nothing until enforcement lands.
 */
export async function checkAndConsume(
  _userId: string,
  _request: UsageRequest,
): Promise<UsageResult> {
  void _userId
  void _request
  return { ok: true, eventId: randomUUID() }
}

/**
 * Refund a reservation after a provider failure by deleting its usage event.
 * Deleting a post itself never refunds usage. This stub writes nothing.
 */
export async function refund(_eventId: string): Promise<void> {
  void _eventId
}
