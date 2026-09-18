import {
  getNamedType,
  getNullableType,
  isListType,
  isObjectType
} from 'graphql'
import type {
  FieldNode,
  GraphQLCompositeType,
  GraphQLOutputType
} from 'graphql'
import type {
  ComplexityEstimator,
  ComplexityEstimatorArgs
} from 'graphql-query-complexity'

import { DEFAULT_FIRST } from '@/core/pagination'

import { type Fragments, selectsField } from './document-fields'
import {
  COUNT_COMPLEXITY,
  UNBOUNDED_LIST_FANOUT
} from './query-limits.constants'

const CONNECTION_STRUCTURE = new Set(['edges', 'nodes', 'pageInfo'])

const COUNT_FIELD = 'totalCount'

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

function isCount(type: GraphQLCompositeType, fieldName: string): boolean {
  return isConnection(type) && fieldName === COUNT_FIELD
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

function countCharge(node: FieldNode, fragments: Fragments): number {
  return selectsField(node.selectionSet, COUNT_FIELD, fragments)
    ? COUNT_COMPLEXITY
    : 0
}

function isIntrospection(
  type: GraphQLCompositeType,
  fieldName: string
): boolean {
  return fieldName.startsWith('__') || getNamedType(type).name.startsWith('__')
}

export function shapeComplexity(fragments: Fragments): ComplexityEstimator {
  return (options: ComplexityEstimatorArgs): number => {
    const { type, field, node, args, childComplexity } = options

    if (isIntrospection(type, field.name)) {
      return childComplexity
    }

    if (isConnection(field.type)) {
      return (
        1 +
        pageSize(args) * Math.max(1, childComplexity) +
        countCharge(node, fragments)
      )
    }

    if (isCount(type, field.name)) {
      return 0
    }

    if (isConnectionStructure(type, field.name)) {
      return childComplexity
    }

    if (isListType(getNullableType(field.type))) {
      return 1 + UNBOUNDED_LIST_FANOUT * Math.max(1, childComplexity)
    }

    return childComplexity + 1
  }
}
