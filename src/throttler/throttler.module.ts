import {
  type MiddlewareConsumer,
  type NestModule,
  Module
} from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import type { ThrottlerModuleOptions } from '@nestjs/throttler'

import { GqlThrottlerGuard } from './gql-throttler.guard'
import { HttpThrottlerMiddleware } from './http-throttler.middleware'
import { BLOCK_DURATION, THROTTLE_TIERS } from './throttler.constants'

function tiers(config: ConfigService): ThrottlerModuleOptions {
  function limit(name: string, fallback: number): number {
    return config.get<number>(`THROTTLE_${name}_LIMIT`) ?? fallback
  }

  return {
    throttlers: [
      {
        name: 'burst',
        ttl: THROTTLE_TIERS.burst.ttl,
        limit: limit('BURST', THROTTLE_TIERS.burst.limit),
        blockDuration: BLOCK_DURATION
      },
      {
        name: 'sustained',
        ttl: THROTTLE_TIERS.sustained.ttl,
        limit: limit('SUSTAINED', THROTTLE_TIERS.sustained.limit)
      },
      {
        name: 'hourly',
        ttl: THROTTLE_TIERS.hourly.ttl,
        limit: limit('HOURLY', THROTTLE_TIERS.hourly.limit)
      }
    ]
  }
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
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
