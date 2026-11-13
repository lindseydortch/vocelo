import '@tanstack/react-start/server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { bufferConnections, users } from '~/db/schema'
import {
  PRESET_KEYS,
  isPresetKey,
  populatePreset,
  presetUserValues,
  type PresetKey,
} from '~/test/presets'
import { now } from '~/lib/clock'
import { encryptToken } from './crypto'
import { setSessionUser } from './session'

/** `free` and `creator` are the original bare E2E users; the rest are billing presets. */
export const TEST_USERS = PRESET_KEYS
const PLAIN_USERS = ['free', 'creator']
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

const isTestLoginUser = (v: string | null): v is TestLoginUser => isPresetKey(v)

/**
 * Deletes and re-creates a billing preset user (usage, personas, posts
 * included), so every sign-in starts from the preset's exact state.
 */
async function recreatePresetUser(kind: PresetKey): Promise<string> {
  const at = now()
  return db.transaction(async (tx) => {
    // Parallel E2E workers may sign in as the same preset; serialize delete + insert.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`e2e_${kind}`}))`,
    )
    await tx.delete(users).where(eq(users.bufferAccountId, `e2e_${kind}`))
    const [user] = await tx
      .insert(users)
      .values(
        presetUserValues(kind, at, {
          bufferAccountId: `e2e_${kind}`,
          bufferOrganizationId: `org_e2e_${kind}`,
          email: `e2e-${kind}@example.test`,
          suffix: `e2e_${kind}`,
        }),
      )
      .returning()
    if (!user) throw new Error('test login: preset user insert failed')
    await populatePreset(tx, user, kind, at)
    await tx
      .insert(bufferConnections)
      .values({ userId: user.id, accessTokenEnc: 'e2e-not-a-real-token' })
    return user.id
  })
}

/** Creates or reuses the fixed E2E user (and a placeholder Buffer connection). */
async function ensureTestUser(kind: TestLoginUser): Promise<string> {
  if (!PLAIN_USERS.includes(kind)) return recreatePresetUser(kind)
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
  // A decryptable, non-expiring token (like the dev API key) so server-side Buffer calls reach the network layer.
  const accessTokenEnc = encryptToken('e2e-not-a-real-token')
  await db
    .insert(bufferConnections)
    .values({ userId: user.id, accessTokenEnc })
    .onConflictDoUpdate({
      target: bufferConnections.userId,
      set: { accessTokenEnc, accessExpiresAt: null, refreshTokenEnc: null },
    })
  return user.id
}

/** Fixed id for `db=off` sign-ins: a valid cookie with no user row behind it. */
export const DB_OFF_USER_ID = '00000000-0000-4000-8000-00000000e2e0'

/**
 * `/__test/login?user=<preset key>`: signs in a seeded user and redirects to `/app`.
 * `&db=off` only sets the cookie (no DB rows) for specs that just need "signed in" to the cookie check.
 */
export async function handleTestLogin(request: Request): Promise<Response> {
  if (!isTestLoginEnabled()) return new Response('Not found', { status: 404 })
  const kind = new URL(request.url).searchParams.get('user')
  if (!isTestLoginUser(kind)) {
    return new Response(`user must be one of: ${TEST_USERS.join(', ')}`, {
      status: 400,
    })
  }
  const dbOff = new URL(request.url).searchParams.get('db') === 'off'
  setSessionUser(dbOff ? DB_OFF_USER_ID : await ensureTestUser(kind))
  return new Response(null, { status: 302, headers: { Location: '/app' } })
}
