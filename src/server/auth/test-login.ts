import '@tanstack/react-start/server-only'
import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { bufferConnections, users } from '~/db/schema'
import { now } from '~/lib/clock'
import { setSessionUser } from './session'

export const TEST_USERS = ['free', 'creator'] as const
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

export type TestLoginUser = (typeof TEST_USERS)[number]

/**
 * Read from `process.env` (not `env`) so the guard works without the full env
 * validation. On only for E2E runs: `E2E_AUTH=1` outside production.
 */
export function isTestLoginEnabled(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return source.E2E_AUTH === '1' && source.NODE_ENV !== 'production'
}

const isTestLoginUser = (v: string | null): v is TestLoginUser =>
  TEST_USERS.some((u) => u === v)

/** Creates or reuses the fixed E2E user (and a placeholder Buffer connection). */
async function ensureTestUser(kind: TestLoginUser): Promise<string> {
  const accountId = `e2e_${kind}`
  const at = now()
  const planFields =
    kind === 'creator'
      ? {
          plan: 'creator',
          stripeCustomerId: 'cus_e2e_creator',
          stripeSubscriptionId: 'sub_e2e_creator',
          subscriptionStatus: 'active',
          currentPeriodStart: at,
          currentPeriodEnd: new Date(at.getTime() + PERIOD_MS),
        }
      : {
          plan: 'free',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          subscriptionStatus: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        }
  await db
    .insert(users)
    .values({
      bufferAccountId: accountId,
      bufferOrganizationId: `org_e2e_${kind}`,
      email: `e2e-${kind}@example.test`,
      ...planFields,
    })
    // Reset plan fields on reuse so a test that changed them can't leak into the next.
    .onConflictDoUpdate({ target: users.bufferAccountId, set: planFields })
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.bufferAccountId, accountId))
  if (!user) throw new Error('test login: user missing after upsert')
  await db
    .insert(bufferConnections)
    .values({ userId: user.id, accessTokenEnc: 'e2e-not-a-real-token' })
    .onConflictDoNothing({ target: bufferConnections.userId })
  return user.id
}

/** Fixed id for `db=off` sign-ins: a valid cookie with no user row behind it. */
export const DB_OFF_USER_ID = '00000000-0000-4000-8000-00000000e2e0'

/**
 * `/__test/login?user=free|creator`: signs in a seeded user and redirects to `/app`.
 * `&db=off` only sets the cookie (no DB rows) for specs that just need "signed in" to the cookie check.
 */
export async function handleTestLogin(request: Request): Promise<Response> {
  if (!isTestLoginEnabled()) return new Response('Not found', { status: 404 })
  const kind = new URL(request.url).searchParams.get('user')
  if (!isTestLoginUser(kind)) {
    return new Response('user must be free or creator', { status: 400 })
  }
  const dbOff = new URL(request.url).searchParams.get('db') === 'off'
  setSessionUser(dbOff ? DB_OFF_USER_ID : await ensureTestUser(kind))
  return new Response(null, { status: 302, headers: { Location: '/app' } })
}
