import { describe, expect, it } from 'vitest'
import { getEffectivePlan, getUsagePeriod } from './plan'

describe('getEffectivePlan', () => {
  it.each(['active', 'trialing', 'past_due'])(
    'treats %s as Creator',
    (subscriptionStatus) => {
      expect(getEffectivePlan({ subscriptionStatus })).toBe('creator')
    },
  )

  it.each([
    null,
    'canceled',
    'unpaid',
    'paused',
    'incomplete',
    'incomplete_expired',
  ])('treats %s as Free', (subscriptionStatus) => {
    expect(getEffectivePlan({ subscriptionStatus })).toBe('free')
  })
})

describe('getUsagePeriod', () => {
  it.each([
    ['2023-02-27T12:00:00Z', '2023-01-31T12:00:00Z', '2023-02-28T12:00:00Z'],
    ['2023-02-28T12:00:00Z', '2023-02-28T12:00:00Z', '2023-03-31T12:00:00Z'],
    ['2024-02-29T12:00:00Z', '2024-02-29T12:00:00Z', '2024-03-31T12:00:00Z'],
  ])('clamps the January 31 anchor for %s', (now, start, end) => {
    const user = {
      subscriptionStatus: null,
      periodAnchorAt: new Date(
        now.startsWith('2024')
          ? '2024-01-31T12:00:00Z'
          : '2023-01-31T12:00:00Z',
      ),
      currentPeriodStart: null,
      currentPeriodEnd: null,
    }
    expect(getUsagePeriod(user, new Date(now))).toEqual({
      start: new Date(start),
      end: new Date(end),
    })
  })

  it.each(['active', 'trialing', 'past_due'])(
    'uses Stripe dates for %s',
    (subscriptionStatus) => {
      const user = {
        subscriptionStatus,
        periodAnchorAt: new Date('2023-01-31T12:00:00Z'),
        currentPeriodStart: new Date('2024-02-05T00:00:00Z'),
        currentPeriodEnd: new Date('2024-03-05T00:00:00Z'),
      }
      expect(getUsagePeriod(user, new Date('2024-02-15T00:00:00Z'))).toEqual({
        start: user.currentPeriodStart,
        end: user.currentPeriodEnd,
      })
    },
  )

  it('uses the reset anchor after a subscription ends', () => {
    const user = {
      subscriptionStatus: 'canceled',
      periodAnchorAt: new Date('2024-02-29T09:30:00Z'),
      currentPeriodStart: new Date('2024-01-29T09:30:00Z'),
      currentPeriodEnd: new Date('2024-02-29T09:30:00Z'),
    }
    expect(getUsagePeriod(user, new Date('2024-02-29T09:30:00Z'))).toEqual({
      start: new Date('2024-02-29T09:30:00Z'),
      end: new Date('2024-03-29T09:30:00Z'),
    })
  })

  it('rejects a paid user without a Stripe period', () => {
    expect(() =>
      getUsagePeriod(
        {
          subscriptionStatus: 'active',
          periodAnchorAt: new Date('2024-01-01Z'),
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
        new Date('2024-02-01Z'),
      ),
    ).toThrow()
  })
})
