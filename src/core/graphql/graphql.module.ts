import { join } from 'node:path'

import { Module, ValidationPipe } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import { type MercuriusDriverConfig, MercuriusDriver } from '@nestjs/mercurius'
import { NoSchemaIntrospectionCustomRule } from 'graphql'
import type { ConfigType } from '@nestjs/config'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { graphqlConfig } from '@/core/config'

import { AppErrorFilter } from './errors/app-error.filter'
import { createErrorFormatter } from './errors/format-graphql-error'
import { createGqlContext } from './graphql-context'
import { guardQueryLimits } from './limits/query-limits.hook'
import { ResetLoadersInterceptor } from './reset-loaders.interceptor'

export function driverConfig(
  config: ConfigType<typeof graphqlConfig>
): MercuriusDriverConfig {
  return {
    driver: MercuriusDriver,
    autoSchemaFile: config.debug ? join(process.cwd(), 'schema.gql') : true,
    sortSchema: true,
    jit: 0,
    graphiql: config.explorer,
    validationRules: config.explorer ? [] : [NoSchemaIntrospectionCustomRule],
    errorFormatter: createErrorFormatter(config),
    hooks: { preExecution: guardQueryLimits },
    context: (request: FastifyRequest, reply: FastifyReply) =>
      createGqlContext(request, reply)
  }
}

@Module({
  imports: [
    GraphQLModule.forRootAsync<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      inject: [graphqlConfig.KEY],
      useFactory: driverConfig
    })
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ transform: true }) },
    { provide: APP_FILTER, useClass: AppErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: ResetLoadersInterceptor }
  ]
})
export class GraphqlConfigModule {}
