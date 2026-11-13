import postgres from 'postgres'

try {
  process.loadEnvFile('.env.local')
} catch {
  // CI sets DATABASE_URL directly.
}

type Plan = 'free' | 'creator'

/** Inserts a post for an E2E user (after `signInAs`) or another user; returns its id. */
export async function insertPost(options: {
  owner: Plan | 'other'
  lastEditedAt?: Date
  isSample?: boolean
}): Promise<string> {
  const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1 })
  try {
    const accountId = `e2e_${options.owner}`
    if (options.owner === 'other') {
      await sql`insert into users (buffer_account_id, buffer_organization_id, email)
        values (${accountId}, 'org_e2e_other', 'e2e-other@example.test')
        on conflict (buffer_account_id) do nothing`
    }
    const [user] = await sql<
      { id: string; buffer_organization_id: string }[]
    >`select id, buffer_organization_id from users where buffer_account_id = ${accountId}`
    if (!user) throw new Error(`insertPost: no user ${accountId}`)
    const [post] = await sql<{ id: string }[]>`
      insert into posts (user_id, buffer_organization_id, channel_id, channel_service, channel_name, text, is_sample, last_edited_at)
      values (${user.id}, ${user.buffer_organization_id}, ${options.isSample ? null : 'chan_e2e'}, 'linkedin', 'E2E LinkedIn', 'An e2e post.', ${options.isSample ?? false}, ${options.lastEditedAt ?? new Date()})
      returning id`
    if (!post) throw new Error('insertPost: no row returned')
    return post.id
  } finally {
    await sql.end()
  }
}
