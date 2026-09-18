import { GraphQLError, getOperationAST } from 'graphql'
import { getComplexity } from 'graphql-query-complexity'
import type { DocumentNode, GraphQLSchema } from 'graphql'
import type { MercuriusContext } from 'mercurius'

import { BadUserInputError } from '@/common/utils'

import { shapeComplexity } from './complexity.estimator'
import { documentShape, fragmentsOf, rootFieldCount } from './document-fields'
import { queryDepth } from './query-depth'
import {
  MAX_QUERY_COMPLEXITY,
  MAX_QUERY_DEPTH,
  MAX_QUERY_SELECTIONS,
  MAX_REPEATED_FIELDS,
  MAX_ROOT_FIELDS
} from './query-limits.constants'

type NamedOperationRequest = { operationName?: string | null }

function refuse(message: string): never {
  const cause = new BadUserInputError(message)

  throw new GraphQLError(cause.message, {
    originalError: cause,
    extensions: { code: cause.code }
  })
}

function requestedOperation({ reply }: MercuriusContext): string | undefined {
  const { body, query } = reply.request

  return (
    (body as NamedOperationRequest | undefined)?.operationName ??
    (query as NamedOperationRequest).operationName ??
    undefined
  )
}

export function guardDocumentShape(
  schema: GraphQLSchema,
  document: DocumentNode,
  context: MercuriusContext
): void {
  const { selections, repeated } = documentShape(document)

  if (selections > MAX_QUERY_SELECTIONS) {
    refuse(
      `Query selects ${String(selections)} fields, which exceeds the limit of ${String(MAX_QUERY_SELECTIONS)}`
    )
  }

  if (repeated.count > MAX_REPEATED_FIELDS) {
    refuse(
      `Query repeats the field "${repeated.field}" ${String(repeated.count)} times, which exceeds the limit of ${String(MAX_REPEATED_FIELDS)}`
    )
  }

  const operationName = requestedOperation(context)
  const depth = queryDepth(document, operationName)

  if (depth > MAX_QUERY_DEPTH) {
    refuse(
      `Query depth ${String(depth)} exceeds the limit of ${String(MAX_QUERY_DEPTH)}`
    )
  }

  const operation = getOperationAST(document, operationName)

  if (!operation) {
    return
  }

  const rootFields = rootFieldCount(operation, fragmentsOf(document))

  if (rootFields > MAX_ROOT_FIELDS) {
    refuse(
      `Query selects ${String(rootFields)} root fields, which exceeds the limit of ${String(MAX_ROOT_FIELDS)}`
    )
  }
}

export function guardQueryLimits(
  schema: GraphQLSchema,
  document: DocumentNode,
  context: MercuriusContext,
  variables: Record<string, unknown>
): void {
  const operationName = requestedOperation(context)

  if (!getOperationAST(document, operationName)) {
    return
  }

  const complexity = getComplexity({
    schema,
    operationName,
    query: document,
    variables,
    estimators: [shapeComplexity(fragmentsOf(document))]
  })

  if (complexity > MAX_QUERY_COMPLEXITY) {
    refuse(
      `Query complexity ${String(complexity)} exceeds the limit of ${String(MAX_QUERY_COMPLEXITY)}`
    )
  }
}
