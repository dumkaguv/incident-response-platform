import { Plugin } from '@nestjs/apollo'
import { GraphQLSchemaHost } from '@nestjs/graphql'
import { GraphQLError } from 'graphql'
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator
} from 'graphql-query-complexity'
import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener
} from '@apollo/server'
import type { GraphQLSchema } from 'graphql'

import { BadUserInputError } from '@/common/utils'

import { queryDepth } from './query-depth'
import { MAX_QUERY_COMPLEXITY, MAX_QUERY_DEPTH } from './query-limits.constants'

function rejected(message: string): GraphQLError {
  const cause = new BadUserInputError(message)

  return new GraphQLError(cause.message, {
    originalError: cause,
    extensions: { code: cause.code, http: { status: 400 } }
  })
}

function guardLimits(
  schema: GraphQLSchema
): GraphQLRequestListener<BaseContext> {
  return {
    didResolveOperation({ request, document }) {
      const depth = queryDepth(document, request.operationName)

      if (depth > MAX_QUERY_DEPTH) {
        return Promise.reject(
          rejected(
            `Query depth ${String(depth)} exceeds the limit of ${String(MAX_QUERY_DEPTH)}`
          )
        )
      }

      const complexity = getComplexity({
        schema,
        operationName: request.operationName,
        query: document,
        variables: request.variables,
        estimators: [
          fieldExtensionsEstimator(),
          simpleEstimator({ defaultComplexity: 1 })
        ]
      })

      if (complexity > MAX_QUERY_COMPLEXITY) {
        return Promise.reject(
          rejected(
            `Query complexity ${String(complexity)} exceeds the limit of ${String(MAX_QUERY_COMPLEXITY)}`
          )
        )
      }

      return Promise.resolve()
    }
  }
}

@Plugin()
export class QueryLimitsPlugin implements ApolloServerPlugin {
  constructor(private readonly schemaHost: GraphQLSchemaHost) {}

  public requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    return Promise.resolve(guardLimits(this.schemaHost.schema))
  }
}
