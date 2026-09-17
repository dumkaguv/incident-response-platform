import {
  getNamedType,
  getNullableType,
  isListType,
  isObjectType
} from 'graphql'
import type { GraphQLCompositeType, GraphQLOutputType } from 'graphql'
import type { ComplexityEstimatorArgs } from 'graphql-query-complexity'

import { DEFAULT_FIRST } from '@/core/pagination'

import { UNBOUNDED_LIST_FANOUT } from './query-limits.constants'

const CONNECTION_STRUCTURE = new Set(['edges', 'nodes', 'pageInfo'])

function isConnection(type: GraphQLCompositeType | GraphQLOutputType): boolean {
  const named = getNamedType(type)

  if (!isObjectType(named)) {
    return false
  }

  const fields = named.getFields()

  return 'pageInfo' in fields && 'nodes' in fields
}

function isConnectionStructure(
  type: GraphQLCompositeType,
  fieldName: string
): boolean {
  return isConnection(type) && CONNECTION_STRUCTURE.has(fieldName)
}

function pageSize(args: Record<string, unknown>): number {
  const requested = args.first ?? args.last

  if (
    typeof requested !== 'number' ||
    !Number.isInteger(requested) ||
    requested <= 0
  ) {
    return DEFAULT_FIRST
  }

  return requested
}

function isIntrospection(
  type: GraphQLCompositeType,
  fieldName: string
): boolean {
  return fieldName.startsWith('__') || getNamedType(type).name.startsWith('__')
}

export function shapeComplexity(options: ComplexityEstimatorArgs): number {
  const { type, field, args, childComplexity } = options

  if (isIntrospection(type, field.name)) {
    return childComplexity
  }

  if (isConnection(field.type)) {
    return 1 + pageSize(args) * Math.max(1, childComplexity)
  }

  if (isConnectionStructure(type, field.name)) {
    return childComplexity
  }

  if (isListType(getNullableType(field.type))) {
    return 1 + UNBOUNDED_LIST_FANOUT * Math.max(1, childComplexity)
  }

  return childComplexity + 1
}
