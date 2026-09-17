import {
  type ExecutionContext,
  type MiddlewareConsumer,
  type NestModule,
  Module
} from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import type { ConfigType } from '@nestjs/config'
import type { ThrottlerModuleOptions } from '@nestjs/throttler'

import { AppConfigModule, throttleConfig } from '@/core/config'

import { GqlThrottlerGuard } from './gql-throttler.guard'
import { HttpThrottlerMiddleware } from './http-throttler.middleware'
import { isMutation } from './operation'

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
  providers: [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }]
})
export class ThrottlerConfigModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpThrottlerMiddleware).forRoutes('graphql')
  }
}
