import {
  type ExecutionContext,
  type OnApplicationBootstrap,
  Module
} from '@nestjs/common'
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import type { ConfigType } from '@nestjs/config'
import type { ThrottlerModuleOptions } from '@nestjs/throttler'
import type { FastifyInstance } from 'fastify'

import { AppConfigModule, throttleConfig } from '@/core/config'
import { GRAPHQL_PATH } from '@/core/graphql/graphql.constants'

import { GqlThrottlerGuard } from './gql-throttler.guard'
import { HttpThrottlerHook } from './http-throttler.hook'
import { isMutation } from './operation'
import { ThrottleStatusPlugin } from './throttle-status.plugin'

function tiers(
  config: ConfigType<typeof throttleConfig>
): ThrottlerModuleOptions {
  const { read, write } = config

  function byOperation(onRead: number, onWrite: number) {
    return (context: ExecutionContext): number =>
      isMutation(context) ? onWrite : onRead
  }

  return {
    throttlers: [
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
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [throttleConfig.KEY],
      useFactory: tiers
    })
  ],
  providers: [
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    HttpThrottlerHook,
    ThrottleStatusPlugin
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
      if (request.routeOptions.url !== GRAPHQL_PATH) {
        return
      }

      return this.throttle.handle(request, reply)
    })
  }
}
