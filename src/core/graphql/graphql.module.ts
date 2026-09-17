import { join } from 'node:path'

import { type ApolloDriverConfig, ApolloDriver } from '@nestjs/apollo'
import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import type { ConfigType } from '@nestjs/config'
import type { Request, Response } from 'express'

import { graphqlConfig, isDev } from '@/core/config'

import { AppErrorFilter } from './errors/app-error.filter'
import { formatGraphQLError } from './errors/format-graphql-error'
import { createGqlContext } from './graphql-context'
import { QueryLimitsPlugin } from './limits/query-limits.plugin'

function driverConfig(
  config: ConfigType<typeof graphqlConfig>
): ApolloDriverConfig {
  return {
    driver: ApolloDriver,
    autoSchemaFile: join(process.cwd(), 'schema.gql'),
    sortSchema: true,
    playground: false,
    graphiql: config.explorer,
    introspection: config.explorer,
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
      inject: [graphqlConfig.KEY],
      useFactory: driverConfig
    })
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppErrorFilter },
    QueryLimitsPlugin
  ]
})
export class GraphqlConfigModule {}
