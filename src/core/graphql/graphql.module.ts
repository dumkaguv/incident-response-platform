import { join } from 'node:path'

import { type ApolloDriverConfig, ApolloDriver } from '@nestjs/apollo'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import type { Request, Response } from 'express'

import { booleanSetting, isDev } from '@/common/utils'

import { AppErrorFilter } from './errors/app-error.filter'
import { formatGraphQLError } from './errors/format-graphql-error'
import { createGqlContext } from './graphql-context'
import { QueryLimitsPlugin } from './limits/query-limits.plugin'

function driverConfig(config: ConfigService): ApolloDriverConfig {
  const explorer = booleanSetting(config.get('GRAPHIQL'), isDev())

  return {
    driver: ApolloDriver,
    autoSchemaFile: join(process.cwd(), 'schema.gql'),
    sortSchema: true,
    playground: false,
    graphiql: explorer,
    introspection: explorer,
    includeStacktraceInErrorResponses: isDev(),
    formatError: formatGraphQLError,
    context: ({ req, res }: { req: Request; res: Response }) =>
      createGqlContext(req, res)
  }
}

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: driverConfig
    })
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppErrorFilter },
    QueryLimitsPlugin
  ]
})
export class GraphqlConfigModule {}
