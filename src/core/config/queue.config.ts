import { registerAs } from '@nestjs/config'

import { env } from './env.schema'

export const queueConfig = registerAs('queue', () => {
  const {
    QUEUE_TICK_MS,
    QUEUE_BATCH_SIZE,
    QUEUE_CONCURRENCY,
    QUEUE_ATTEMPTS,
    QUEUE_BACKOFF_MS
  } = env()

  return {
    tickMs: QUEUE_TICK_MS,
    batchSize: QUEUE_BATCH_SIZE,
    concurrency: QUEUE_CONCURRENCY,
    attempts: QUEUE_ATTEMPTS,
    backoffMs: QUEUE_BACKOFF_MS
  }
})
