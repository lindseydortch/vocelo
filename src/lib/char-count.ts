import { parseTweet } from 'twitter-text'

export type CountResult = {
  count: number
  /** `null` when the service has no known limit. */
  limit: number | null
  over: boolean
}

const TWITTER_LIMIT = 280
const BLUESKY_LIMIT = 300
const LINKEDIN_LIMIT = 3000
const LINKEDIN_URL_LENGTH = 24
const MASTODON_DEFAULT_LIMIT = 500
const URL_RE = /https?:\/\/\S+/g

/** UTF-16 services with a fixed limit. */
const UTF16_LIMITS: Record<string, number> = {
  threads: 500,
  substack: 10000,
}

function graphemeCount(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return Array.from(segmenter.segment(text)).length
}

function linkedinLength(text: string): number {
  return text.replace(URL_RE, 'x'.repeat(LINKEDIN_URL_LENGTH)).length
}

/** Shared per-channel counter. The composer renders it; the server re-checks on save. */
export function countFor(
  service: string,
  text: string,
  opts: { maxCharacters?: number | null } = {},
): CountResult {
  let count: number
  let limit: number | null

  switch (service) {
    case 'twitter':
      count = parseTweet(text).weightedLength
      limit = TWITTER_LIMIT
      break
    case 'bluesky':
      count = graphemeCount(text)
      limit = BLUESKY_LIMIT
      break
    case 'linkedin':
      count = linkedinLength(text)
      limit = LINKEDIN_LIMIT
      break
    case 'mastodon':
      count = text.length
      limit = opts.maxCharacters ?? MASTODON_DEFAULT_LIMIT
      break
    default:
      count = text.length
      limit = UTF16_LIMITS[service] ?? null
  }

  return { count, limit, over: limit !== null && count > limit }
}
