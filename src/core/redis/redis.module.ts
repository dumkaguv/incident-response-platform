import {
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit
} from '@nestjs/common'
import { Redis } from 'ioredis'
import type { ConfigType } from '@nestjs/config'

import { AppConfigModule, redisConfig } from '@/core/config'

import {
  REDIS_COMMAND_RETRIES,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_THROTTLER_CLIENT
} from './redis.constants'

function createClient(config: ConfigType<typeof redisConfig>): Redis {
  return new Redis(config.url, {
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: REDIS_COMMAND_RETRIES,
    enableOfflineQueue: false,
    lazyConnect: true
  })
}

@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: REDIS_THROTTLER_CLIENT,
      inject: [redisConfig.KEY],
      useFactory: createClient
    }
  ],
  exports: [REDIS_THROTTLER_CLIENT]
})
export class RedisModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name)

  constructor(
    @Inject(REDIS_THROTTLER_CLIENT) private readonly throttler: Redis
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this.throttler.connect()
    } catch (error) {
      this.logger.error(
        'Redis did not answer at boot; it will be retried in the background',
        error
      )
    }
  }

  public async onApplicationShutdown(): Promise<void> {
    this.throttler.disconnect()

    await Promise.resolve()
  }
}
