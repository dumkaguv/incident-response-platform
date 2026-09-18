import { join } from 'node:path'

import { type ApolloDriverConfig, ApolloDriver } from '@nestjs/apollo'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import type { ConfigType } from '@nestjs/config'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { graphqlConfig } from '@/core/config'

import { AppErrorFilter } from './errors/app-error.filter'
import { createErrorFormatter } from './errors/format-graphql-error'
import { createGqlContext } from './graphql-context'
import { QueryLimitsPlugin } from './limits/query-limits.plugin'
import { ResetLoadersInterceptor } from './reset-loaders.interceptor'

export function driverConfig(
  config: ConfigType<typeof graphqlConfig>
): ApolloDriverConfig {
  return {
    driver: ApolloDriver,
    autoSchemaFile: config.debug ? join(process.cwd(), 'schema.gql') : true,
    sortSchema: true,
    playground: false,
    graphiql: config.explorer,
    introspection: config.explorer,
    includeStacktraceInErrorResponses: config.debug,
    formatError: createErrorFormatter(config),
    context: (request: FastifyRequest, reply: FastifyReply) =>
      createGqlContext(request, reply)
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
    { provide: APP_INTERCEPTOR, useClass: ResetLoadersInterceptor },
    QueryLimitsPlugin
  ]
})
export class GraphqlConfigModule {}
