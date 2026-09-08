import { minutes, seconds } from '@nestjs/throttler'

export const HTTP_TIER = { limit: 600, ttl: seconds(10) } as const

export const THROTTLE_TIERS = {
  burst: { limit: 30, ttl: seconds(1) },
  sustained: { limit: 300, ttl: seconds(30) },
  hourly: { limit: 5_000, ttl: minutes(60) }
} as const

export const WRITE_TIERS = {
  burst: { limit: 5, ttl: seconds(1) },
  sustained: { limit: 60, ttl: seconds(30) }
} as const

export const BLOCK_DURATION = seconds(10)

export const HTTP_BLOCK_DURATION = seconds(30)
