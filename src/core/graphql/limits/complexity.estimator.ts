import {
  getNamedType,
  getNullableType,
  isListType,
  isObjectType
} from 'graphql'
import type { GraphQLCompositeType, GraphQLOutputType } from 'graphql'
import type { ComplexityEstimatorArgs } from 'graphql-query-complexity'

import { DEFAULT_FIRST } from '@/common/pagination'

import { UNBOUNDED_LIST_FANOUT } from './query-limits.constants'

function isConnection(type: GraphQLCompositeType | GraphQLOutputType): boolean {
  const named = getNamedType(type)

  if (!isObjectType(named)) {
    return false
  }

  const fields = named.getFields()

  return 'pageInfo' in fields && 'nodes' in fields
}

function pageSize(args: Record<string, unknown>): number {
  const requested = args.first ?? args.last

  return typeof requested === 'number' ? requested : DEFAULT_FIRST
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
    return pageSize(args) * childComplexity
  }

  if (isConnection(type)) {
    return childComplexity
  }

  if (isListType(getNullableType(field.type))) {
    return UNBOUNDED_LIST_FANOUT * childComplexity
  }

  return childComplexity + 1
}
