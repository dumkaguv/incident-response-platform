import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RedisThrottlerStorage } from '@/core/throttler/redis-throttler.storage'

const TTL = 60_000
const LIMIT = 3
const BLOCK = 30_000
const TIER = 'burst'
const PREFIX = 'throttler'

describe('RedisThrottlerStorage against a real Redis', () => {
  let first: Redis
  let second: Redis
  let one: RedisThrottlerStorage
  let two: RedisThrottlerStorage
  let key: string

  beforeAll(async () => {
    const url = process.env.REDIS_URL ?? 'redis://localhost:56379'

    first = new Redis(url, { lazyConnect: true })
    second = new Redis(url, { lazyConnect: true })

    await first.connect()
    await second.connect()

    one = new RedisThrottlerStorage(first, PREFIX)
    two = new RedisThrottlerStorage(second, PREFIX)
  })

  beforeAll(() => {
    key = `spec-${randomUUID()}`
  })

  afterAll(async () => {
    await first.del(
      `throttler:${TIER}:${key}`,
      `throttler:${TIER}:${key}:blocked`
    )

    first.disconnect()
    second.disconnect()
  })

  it('counts one budget across two connections, the way two replicas would', async () => {
    const hits = [
      await one.increment(key, TTL, LIMIT, BLOCK, TIER),
      await two.increment(key, TTL, LIMIT, BLOCK, TIER),
      await one.increment(key, TTL, LIMIT, BLOCK, TIER)
    ]

    expect(hits.map((hit) => hit.totalHits)).toEqual([1, 2, 3])
    expect(hits.every((hit) => !hit.isBlocked)).toBe(true)
    expect(hits[0].timeToExpire).toBe(60)
  })

  it('blocks on the connection that did not spend the budget', async () => {
    const blocked = await two.increment(key, TTL, LIMIT, BLOCK, TIER)

    expect(blocked.isBlocked).toBe(true)
    expect(blocked.timeToBlockExpire).toBe(30)
  })

  it('keeps the block for both connections once either one set it', async () => {
    const still = await one.increment(key, TTL, LIMIT, BLOCK, TIER)

    expect(still.isBlocked).toBe(true)
    expect(still.totalHits).toBe(LIMIT + 1)
  })

  it('counts a different tier in its own bucket', async () => {
    const other = await one.increment(key, TTL, LIMIT, BLOCK, 'sustained')

    expect(other.totalHits).toBe(1)
    expect(other.isBlocked).toBe(false)

    await first.del(
      `throttler:sustained:${key}`,
      `throttler:sustained:${key}:blocked`
    )
  })
})
