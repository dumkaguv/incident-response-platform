import { join } from 'node:path'

import { type ApolloDriverConfig, ApolloDriver } from '@nestjs/apollo'
import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import type { Request, Response } from 'express'

import { isDev } from '@/common/utils'

import { AppErrorFilter } from './errors/app-error.filter'
import { formatGraphQLError } from './errors/format-graphql-error'
import { createGqlContext } from './graphql-context'
import { QueryLimitsPlugin } from './limits/query-limits.plugin'

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: false,
      graphiql: isDev(),
      introspection: isDev(),
      includeStacktraceInErrorResponses: isDev(),
      formatError: formatGraphQLError,
      context: ({ req, res }: { req: Request; res: Response }) =>
        createGqlContext(req, res)
    })
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppErrorFilter },
    QueryLimitsPlugin
  ]
})
export class GraphqlConfigModule {}
