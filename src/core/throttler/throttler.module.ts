import {
  type ExecutionContext,
  type OnApplicationBootstrap,
  Module
} from '@nestjs/common'
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import type { ConfigType } from '@nestjs/config'
import type {
  ThrottlerModuleOptions,
  ThrottlerOptions
} from '@nestjs/throttler'
import type { FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'

import { AppConfigModule, throttleConfig } from '@/core/config'
import { LIVENESS_PATH } from '@/core/health/health.constants'
import { REDIS_THROTTLER_CLIENT, RedisModule } from '@/core/redis'

import { GqlThrottlerGuard } from './gql-throttler.guard'
import { HttpThrottlerHook } from './http-throttler.hook'
import { isMutation } from './operation'
import { RedisThrottlerStorage } from './redis-throttler.storage'

function tiers(config: ConfigType<typeof throttleConfig>): ThrottlerOptions[] {
  const { read, write } = config

  function byOperation(onRead: number, onWrite: number) {
    return (context: ExecutionContext): number =>
      isMutation(context) ? onWrite : onRead
  }

  return [
    {
      name: 'burst',
      ttl: read.burst.ttl,
      limit: byOperation(read.burst.limit, write.burst.limit),
      blockDuration: config.blockDuration
    },
    {
      name: 'sustained',
      ttl: read.sustained.ttl,
      limit: byOperation(read.sustained.limit, write.sustained.limit)
    },
    {
      name: 'hourly',
      ttl: read.hourly.ttl,
      limit: read.hourly.limit
    }
  ]
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule, RedisModule],
      inject: [throttleConfig.KEY, REDIS_THROTTLER_CLIENT],
      useFactory: (
        config: ConfigType<typeof throttleConfig>,
        redis: Redis
      ): ThrottlerModuleOptions => ({
        throttlers: tiers(config),
        storage: new RedisThrottlerStorage(redis, config.keyPrefix)
      })
    })
  ],
  providers: [
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    HttpThrottlerHook
  ]
})
export class ThrottlerConfigModule implements OnApplicationBootstrap {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly throttle: HttpThrottlerHook
  ) {}

  public onApplicationBootstrap(): void {
    const instance = this.adapterHost.httpAdapter.getInstance<FastifyInstance>()

    instance.addHook('onRequest', async (request, reply) => {
      if (request.routeOptions.url === LIVENESS_PATH) {
        return
      }

      return this.throttle.handle(request, reply)
    })
  }
}
