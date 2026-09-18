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
  REDIS_CLIENT,
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
      provide: REDIS_CLIENT,
      inject: [redisConfig.KEY],
      useFactory: createClient
    },
    {
      provide: REDIS_THROTTLER_CLIENT,
      inject: [redisConfig.KEY],
      useFactory: createClient
    }
  ],
  exports: [REDIS_CLIENT, REDIS_THROTTLER_CLIENT]
})
export class RedisModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name)

  private readonly clients: Redis[]

  constructor(
    @Inject(REDIS_CLIENT) shared: Redis,
    @Inject(REDIS_THROTTLER_CLIENT) throttler: Redis
  ) {
    this.clients = [shared, throttler]
  }

  public async onModuleInit(): Promise<void> {
    await Promise.all(this.clients.map((client) => this.open(client)))
  }

  public async onApplicationShutdown(): Promise<void> {
    for (const client of this.clients) {
      client.disconnect()
    }

    await Promise.resolve()
  }

  private async open(client: Redis): Promise<void> {
    try {
      await client.connect()
    } catch (error) {
      this.logger.error(
        'Redis did not answer at boot; it will be retried in the background',
        error
      )
    }
  }
}
