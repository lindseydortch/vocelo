import { describe, expect, it } from 'vitest'
import { countFor } from './char-count'

const URL24 = 'https://example.com/a/very/long/path/that/is/long?x=1'

describe('countFor', () => {
  describe('twitter', () => {
    it('is not over at 280', () => {
      expect(countFor('twitter', 'a'.repeat(280))).toEqual({ count: 280, limit: 280, over: false })
    })
    it('is over by 1 at 281', () => {
      expect(countFor('twitter', 'a'.repeat(281))).toEqual({ count: 281, limit: 280, over: true })
    })
    it('counts emoji as 2 (weighted)', () => {
      expect(countFor('twitter', '😀').count).toBe(2)
    })
    it('counts a URL as 23', () => {
      expect(countFor('twitter', URL24).count).toBe(23)
    })
  })

  describe('bluesky', () => {
    it('is not over at 300', () => {
      expect(countFor('bluesky', 'a'.repeat(300))).toEqual({ count: 300, limit: 300, over: false })
    })
    it('is over by 1 at 301', () => {
      expect(countFor('bluesky', 'a'.repeat(301)).over).toBe(true)
    })
    it('counts an emoji as 1 grapheme', () => {
      expect(countFor('bluesky', '😀').count).toBe(1)
      expect(countFor('bluesky', '👨‍👩‍👧').count).toBe(1)
    })
  })

  describe('linkedin', () => {
    it('is not over at 3000', () => {
      expect(countFor('linkedin', 'a'.repeat(3000))).toEqual({ count: 3000, limit: 3000, over: false })
    })
    it('is over by 1 at 3001', () => {
      expect(countFor('linkedin', 'a'.repeat(3001)).over).toBe(true)
    })
    it('counts each URL as 24', () => {
      expect(countFor('linkedin', `hi ${URL24}`).count).toBe(3 + 24)
    })
    it('counts emoji as 2', () => {
      expect(countFor('linkedin', '😀').count).toBe(2)
    })
  })

  describe('threads', () => {
    it('limit 500, over by 1', () => {
      expect(countFor('threads', 'a'.repeat(500)).over).toBe(false)
      expect(countFor('threads', 'a'.repeat(501))).toEqual({ count: 501, limit: 500, over: true })
    })
    it('counts emoji as 2', () => {
      expect(countFor('threads', '😀').count).toBe(2)
    })
  })

  describe('substack', () => {
    it('limit 10000, over by 1', () => {
      expect(countFor('substack', 'a'.repeat(10000)).over).toBe(false)
      expect(countFor('substack', 'a'.repeat(10001))).toEqual({ count: 10001, limit: 10000, over: true })
    })
    it('counts emoji as 2', () => {
      expect(countFor('substack', '😀').count).toBe(2)
    })
  })

  describe('mastodon', () => {
    it('defaults to 500', () => {
      expect(countFor('mastodon', 'a'.repeat(501))).toEqual({ count: 501, limit: 500, over: true })
    })
    it('uses a custom maxCharacters', () => {
      expect(countFor('mastodon', 'a'.repeat(1000), { maxCharacters: 1000 })).toEqual({
        count: 1000,
        limit: 1000,
        over: false,
      })
      expect(countFor('mastodon', 'a'.repeat(1001), { maxCharacters: 1000 }).over).toBe(true)
    })
    it('counts emoji as 2', () => {
      expect(countFor('mastodon', '😀').count).toBe(2)
    })
  })

  describe('unknown service', () => {
    it('counts UTF-16 code units with no limit', () => {
      expect(countFor('other', '😀a')).toEqual({ count: 3, limit: null, over: false })
    })
  })

  it('counts empty text as 0', () => {
    expect(countFor('twitter', '').count).toBe(0)
  })
})
