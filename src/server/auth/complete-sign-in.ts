import '@tanstack/react-start/server-only'
import { z } from 'zod'
import { db } from '~/db/client'
import { bufferConnections, users } from '~/db/schema'
import { now } from '~/lib/clock'
import { bufferRequest } from '~/server/buffer/client'
import { ensureSamplePost } from '~/server/posts/sample-post'
import { encryptToken } from './crypto'
import { setSessionUser } from './session'

/** Tokens from a successful Buffer code exchange. */
export type BufferTokens = {
  accessToken: string
  refreshToken: string | null
  /** Seconds until the access token expires, if Buffer said. */
  expiresIn: number | null
  scope: string
}

/** The account lookup failed or returned something unusable. The callback maps this to `reason=account`. */
export class AccountLookupError extends Error {
  readonly reason = 'account'
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AccountLookupError'
  }
}

const ACCOUNT_QUERY = `query { account { id email name timezone organizations { id name ownerEmail } } }`

const accountResponse = z.object({
  account: z.object({
    id: z.string().min(1),
    email: z.string().min(1),
    name: z.string().nullish(),
    timezone: z.string().nullish(),
    organizations: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().nullish(),
        ownerEmail: z.string().nullish(),
      }),
    ),
  }),
})

async function lookupAccount(accessToken: string) {
  try {
    const data = await bufferRequest({ accessToken, query: ACCOUNT_QUERY })
    return accountResponse.parse(data).account
  } catch (cause) {
    throw new AccountLookupError('Buffer account lookup failed', { cause })
  }
}

/**
 * Finishes a Buffer sign-in: looks up the account, upserts the user and their
 * encrypted connection in one transaction, then signs the session in.
 * Nothing is written unless the lookup succeeds. Returning users keep their plan.
 */
export async function completeSignIn(
  tokens: BufferTokens,
): Promise<{ userId: string }> {
  const account = await lookupAccount(tokens.accessToken)
  const org =
    account.organizations.find((o) => o.ownerEmail === account.email) ??
    account.organizations[0]
  if (!org) throw new AccountLookupError('Buffer account has no organizations')

  const accessExpiresAt =
    tokens.expiresIn === null
      ? null
      : new Date(now().getTime() + tokens.expiresIn * 1000)
  const connection = {
    accessTokenEnc: encryptToken(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null,
    accessExpiresAt,
    scopes: tokens.scope,
  }

  const userId = await db.transaction(async (tx) => {
    const profile = {
      email: account.email,
      bufferOrganizationId: org.id,
      timezone: account.timezone ?? null,
    }
    const [user] = await tx
      .insert(users)
      .values({ bufferAccountId: account.id, ...profile })
      .onConflictDoUpdate({ target: users.bufferAccountId, set: profile })
      .returning({ id: users.id })
    if (!user) throw new Error('sign-in: user missing after upsert')
    await tx
      .insert(bufferConnections)
      .values({ userId: user.id, ...connection })
      .onConflictDoUpdate({ target: bufferConnections.userId, set: connection })
    return user.id
  })

  // Idempotent, so safe on every sign-in. Runs after commit: it opens its own connection.
  await ensureSamplePost(userId)
  setSessionUser(userId)
  return { userId }
}
