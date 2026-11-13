import { posts, versions } from '../../src/db/schema.ts'
import { textHash } from '../../src/lib/text.ts'

type SeedTx = Pick<
  ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>,
  'insert'
>

const DAY = 86_400_000

export type SeedPostKey = 'linkedin' | 'x' | 'draft' | 'old-45d' | 'old-13mo'

export type SeedPostSpec = {
  key: SeedPostKey
  channelService: 'linkedin' | 'twitter'
  channelName: string
  text: string
  /** Buffer status; null = a Vocelo-only post never sent to Buffer. */
  bufferStatus: 'draft' | null
  /** Days before "now" for `last_edited_at`; `monthsAgo` wins when set. */
  daysAgo?: number
  monthsAgo?: number
  /** Image assets on the Buffer draft. Assets live in Buffer, not our DB. */
  assets?: number
}

// ~800 chars, one humblebrag line, one unclear sentence.
export const LINKEDIN_TEXT = `Humbled and honored to share that our team just closed our best quarter ever, and honestly I'm still processing it. (Please don't ask how many awards that makes this year.)

Three things I learned along the way:

1. Hire people who are smarter than you. It sounds obvious, but most leaders never actually do it, and I think that shows.
2. Write things down. A decision that lives in someone's head is a decision you'll make twice.
3. Synergy is mostly about leaning into the space between the work and the work behind the work, so that the outcomes can scale into what they were always going to become.

None of this happened overnight. It took long nights, a lot of coffee, and a team that believed in the mission when the numbers didn't yet.

What's the best piece of advice you've ever received from a mentor? I'd love to hear it in the comments.

#leadership #growth #team`

export const X_TEXT =
  'Shipped the new onboarding flow today. Cut setup from 9 steps to 3, and support tickets about it dropped by half in the first week. Small changes, big relief.'

export const DRAFT_TEXT =
  "We're hiring a designer who cares about the small stuff. If you've ever redone a button six times because it felt wrong, we should talk. Remote-friendly, tiny team, real ownership."

export const OLD_45D_TEXT =
  'Reminder that "just circling back" is not a strategy. Pick a date, name an owner, and write down what done looks like.'

export const OLD_13MO_TEXT =
  'A year ago I would have called this a failure. Now I call it the reason our onboarding works. Funny how that goes.'

export const SEED_POSTS: SeedPostSpec[] = [
  {
    key: 'linkedin',
    channelService: 'linkedin',
    channelName: 'Seed LinkedIn',
    text: LINKEDIN_TEXT,
    bufferStatus: null,
    daysAgo: 1,
  },
  {
    key: 'x',
    channelService: 'twitter',
    channelName: 'Seed X',
    text: X_TEXT,
    bufferStatus: null,
    daysAgo: 2,
  },
  {
    key: 'draft',
    channelService: 'linkedin',
    channelName: 'Seed LinkedIn',
    text: DRAFT_TEXT,
    bufferStatus: 'draft',
    daysAgo: 3,
    assets: 2,
  },
  {
    key: 'old-45d',
    channelService: 'linkedin',
    channelName: 'Seed LinkedIn',
    text: OLD_45D_TEXT,
    bufferStatus: null,
    daysAgo: 45,
  },
  {
    key: 'old-13mo',
    channelService: 'linkedin',
    channelName: 'Seed LinkedIn',
    text: OLD_13MO_TEXT,
    bufferStatus: null,
    monthsAgo: 13,
  },
]

function editedAt(spec: SeedPostSpec, now: Date): Date {
  if (spec.monthsAgo !== undefined) {
    const date = new Date(now)
    const month = (((date.getUTCMonth() - spec.monthsAgo) % 12) + 12) % 12
    date.setUTCMonth(date.getUTCMonth() - spec.monthsAgo)
    // Clamp month-end overflow (Mar 31 - 1 month) to the last day of the target month.
    if (date.getUTCMonth() !== month) date.setUTCDate(0)
    return date
  }
  return new Date(now.getTime() - (spec.daysAgo ?? 0) * DAY)
}

/** Inserts the seed posts (each with a version 1) for one seed user. */
export async function seedPostsFor(
  tx: SeedTx,
  user: { id: string; bufferOrganizationId: string },
  now: Date,
): Promise<void> {
  for (const spec of SEED_POSTS) {
    const lastEditedAt = editedAt(spec, now)
    const [post] = await tx
      .insert(posts)
      .values({
        userId: user.id,
        bufferOrganizationId: user.bufferOrganizationId,
        channelId: `seed_channel_${spec.channelService}`,
        channelService: spec.channelService,
        channelName: spec.channelName,
        bufferPostId: spec.bufferStatus ? `seed_buffer_${spec.key}` : null,
        bufferStatus: spec.bufferStatus,
        text: spec.text,
        createdAt: lastEditedAt,
        lastEditedAt,
      })
      .returning({ id: posts.id })
    if (!post) throw new Error(`seed: failed to insert post ${spec.key}`)
    await tx.insert(versions).values({
      postId: post.id,
      text: spec.text,
      textHash: await textHash(spec.text),
      createdAt: lastEditedAt,
    })
  }
}
