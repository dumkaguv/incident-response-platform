import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'

import { AppConfigModule, queueConfig, redisConfig } from '@/core/config'

import { KEPT_COMPLETED, KEPT_FAILED } from './queue.constants'

function connection(
  redis: ConfigType<typeof redisConfig>,
  queue: ConfigType<typeof queueConfig>
) {
  return {
    connection: { url: redis.url },
    defaultJobOptions: {
      attempts: queue.attempts,
      backoff: { type: 'exponential', delay: queue.backoffMs },
      removeOnComplete: { count: KEPT_COMPLETED },
      removeOnFail: { count: KEPT_FAILED }
    }
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [redisConfig.KEY, queueConfig.KEY],
      useFactory: connection
    })
  ],
  exports: [BullModule]
})
export class QueueModule {}
