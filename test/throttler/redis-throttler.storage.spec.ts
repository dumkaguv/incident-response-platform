import { describe, expect, it, vi } from 'vitest'
import type { Redis } from 'ioredis'

import { RedisThrottlerStorage } from '@/core/throttler/redis-throttler.storage'

type Tally = [number, number, number, number]

function storageWith(answer: () => Promise<Tally>): {
  storage: RedisThrottlerStorage
  calls: unknown[][]
} {
  const calls: unknown[][] = []
  const redis = {
    defineCommand: () => undefined,
    throttlerIncrement: (...args: unknown[]) => {
      calls.push(args)

      return answer()
    }
  }

  return {
    storage: new RedisThrottlerStorage(redis as unknown as Redis, 'throttler'),
    calls
  }
}

function answering(tally: Tally): () => Promise<Tally> {
  return () => Promise.resolve(tally)
}

describe('RedisThrottlerStorage', () => {
  it('answers the count Redis holds and reports the window in seconds', async () => {
    const { storage } = storageWith(answering([7, 45_000, 0, 0]))

    expect(
      await storage.increment('client', 60_000, 30, 20_000, 'burst')
    ).toEqual({
      totalHits: 7,
      timeToExpire: 45,
      isBlocked: false,
      timeToBlockExpire: 0
    })
  })

  it('rounds a partial second up, so Retry-After never says zero', async () => {
    const { storage } = storageWith(answering([31, 1, 1, 1500]))

    const record = await storage.increment(
      'client',
      60_000,
      30,
      20_000,
      'burst'
    )

    expect(record.isBlocked).toBe(true)
    expect(record.timeToExpire).toBe(1)
    expect(record.timeToBlockExpire).toBe(2)
  })

  it('keeps one bucket per tier, so the tiers cannot spend each other', async () => {
    const { storage, calls } = storageWith(answering([1, 60_000, 0, 0]))

    await storage.increment('client', 60_000, 30, 20_000, 'burst')
    await storage.increment('client', 60_000, 30, 20_000, 'sustained')

    expect(calls[0][0]).toBe('throttler:burst:client')
    expect(calls[0][1]).toBe('throttler:burst:client:blocked')
    expect(calls[1][0]).toBe('throttler:sustained:client')
  })

  it('opens the gate when Redis does not answer, rather than refusing traffic', async () => {
    const { storage } = storageWith(() => Promise.reject(new Error('down')))

    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(
      await storage.increment('client', 60_000, 30, 20_000, 'burst')
    ).toEqual({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0
    })
  })

  it('passes the windows to Redis as the milliseconds it was given', async () => {
    const { storage, calls } = storageWith(answering([1, 60_000, 0, 0]))

    await storage.increment('client', 60_000, 30, 20_000, 'burst')

    expect(calls[0].slice(2)).toEqual(['60000', '30', '20000'])
  })
})
