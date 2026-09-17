import { registerAs } from '@nestjs/config'

import {
  BLOCK_DURATION,
  HTTP_BLOCK_DURATION,
  HTTP_TIER,
  THROTTLE_TIERS,
  WRITE_TIERS
} from '@/core/throttler/throttler.constants'

import { env } from './env.schema'

export const throttleConfig = registerAs('throttle', () => {
  const {
    THROTTLE_HTTP_LIMIT,
    THROTTLE_BURST_LIMIT,
    THROTTLE_SUSTAINED_LIMIT,
    THROTTLE_HOURLY_LIMIT
  } = env()

  return {
    http: {
      limit: THROTTLE_HTTP_LIMIT,
      ttl: HTTP_TIER.ttl,
      blockDuration: HTTP_BLOCK_DURATION
    },
    read: {
      burst: { limit: THROTTLE_BURST_LIMIT, ttl: THROTTLE_TIERS.burst.ttl },
      sustained: {
        limit: THROTTLE_SUSTAINED_LIMIT,
        ttl: THROTTLE_TIERS.sustained.ttl
      },
      hourly: { limit: THROTTLE_HOURLY_LIMIT, ttl: THROTTLE_TIERS.hourly.ttl }
    },
    write: WRITE_TIERS,
    blockDuration: BLOCK_DURATION
  }
})
