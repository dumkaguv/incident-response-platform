import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { appConfig } from './app.config'
import { databaseConfig } from './database.config'
import { parseEnv } from './env.schema'
import { graphqlConfig } from './graphql.config'
import { queueConfig } from './queue.config'
import { redisConfig } from './redis.config'
import { throttleConfig } from './throttle.config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: parseEnv,
      load: [
        appConfig,
        databaseConfig,
        graphqlConfig,
        queueConfig,
        redisConfig,
        throttleConfig
      ]
    })
  ]
})
export class AppConfigModule {}
