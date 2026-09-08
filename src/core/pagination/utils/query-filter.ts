import { BadUserInputError } from '@/common/utils/errors'

import {
  type QueryDefinition,
  type QueryFields,
  type ResolvedQueryField,
  type ScalarQueryField,
  isQueryObject,
  queryField,
  resolveQueryField
} from './query-definition'
import type { FilterNode, FilterOperator } from './query-spec'

export function group(kind: 'and' | 'or', children: FilterNode[]): FilterNode {
  const decisive = kind === 'or'

  if (
    children.some(
      (child) => child.kind === 'constant' && child.value === decisive
    )
  ) {
    return { kind: 'constant', value: decisive }
  }

  const remaining = children.filter((child) => child.kind !== 'constant')

  if (!remaining.length) {
    return { kind: 'constant', value: !decisive }
  }

  return remaining.length === 1 ? remaining[0] : { kind, children: remaining }
}

export function negate(child: FilterNode): FilterNode {
  return child.kind === 'constant'
    ? { kind: 'constant', value: !child.value }
    : { kind: 'not', child }
}

export function operatorsFor(field: ScalarQueryField): string[] {
  const operators = ['eq', 'ne', 'neq', 'in', 'nin', 'is']

  if (field.type === 'boolean') {
    return ['eq', 'ne', 'neq', 'is']
  }

  if (['string', 'id', 'int', 'float', 'date'].includes(field.type)) {
    operators.push('gt', 'gte', 'lt', 'lte')
  }

  if (field.type === 'string') {
    operators.push('contains', 'startsWith', 'endsWith')
  }

  return operators
}

export function validateScalarValue(
  field: ScalarQueryField,
  value: unknown
): unknown {
  if (value === null && field.nullable) {
    return null
  }

  switch (field.type) {
    case 'string':
      if (typeof value === 'string') {
        return value
      }

      break

    case 'id':
      if (typeof value === 'string') {
        return value
      }

      break

    case 'int':
      if (typeof value === 'number' && Number.isSafeInteger(value)) {
        return value
      }

      break

    case 'float':
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }

      break

    case 'boolean':
      if (typeof value === 'boolean') {
        return value
      }

      break

    case 'date': {
      let date: Date | null = null

      if (value instanceof Date) {
        date = value
      }

      if (typeof value === 'string') {
        date = new Date(value)
      }

      if (date && Number.isFinite(date.getTime())) {
        return date
      }

      break
    }

    case 'enum':
      if (
        typeof value === 'string' &&
        Object.values(field.enum?.values ?? {}).includes(value)
      ) {
        return value
      }

      break
  }

  throw new BadUserInputError(`Invalid ${field.type} filter or cursor value`)
}

export function parseFilter(fields: QueryFields, input: unknown): FilterNode {
  let nodes = 0

  function walk(
    currentFields: QueryFields,
    value: unknown,
    depth: number
  ): FilterNode {
    if (++nodes > 500 || depth > 20) {
      throw new BadUserInputError(
        'Filter exceeds the maximum depth or number of conditions'
      )
    }

    if (!isQueryObject(value)) {
      throw new BadUserInputError('Expected a filter object')
    }

    const children: FilterNode[] = []

    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined || entry === null) {
        continue
      }

      if (key === 'and' || key === 'or') {
        if (!Array.isArray(entry)) {
          throw new BadUserInputError(`${key} must be a list of filters`)
        }

        children.push(
          group(
            key,
            entry.map((item) => walk(currentFields, item, depth + 1))
          )
        )
        continue
      }

      if (key === 'not') {
        children.push(negate(walk(currentFields, entry, depth + 1)))
        continue
      }

      const field = queryField(currentFields, key)

      if (field.type === 'composite') {
        children.push(walk(field.fields, entry, depth + 1))
      } else if (field.type === 'relation') {
        if (field.many) {
          if (!isQueryObject(entry)) {
            throw new BadUserInputError('Expected relation quantifiers')
          }

          for (const [quantifier, nested] of Object.entries(entry)) {
            if (
              quantifier !== 'some' &&
              quantifier !== 'every' &&
              quantifier !== 'none'
            ) {
              throw new BadUserInputError(
                'Collection filters require some, every or none'
              )
            }

            if (nested === null || nested === undefined) {
              continue
            }

            children.push({
              kind: 'relation',
              field: field.field ?? key,
              quantifier,
              child: walk(field.fields, nested, depth + 1)
            })
          }
        } else {
          children.push({
            kind: 'relation',
            field: field.field ?? key,
            quantifier: 'is',
            child: walk(field.fields, entry, depth + 1)
          })
        }
      } else {
        if (!field.filterable || !isQueryObject(entry)) {
          throw new BadUserInputError(`Field "${key}" is not filterable`)
        }

        for (const [operator, rawValue] of Object.entries(entry)) {
          if (rawValue === undefined) {
            continue
          }

          if (++nodes > 500) {
            throw new BadUserInputError('Too many filter conditions')
          }

          if (!operatorsFor(field).includes(operator)) {
            throw new BadUserInputError(
              `Unsupported operator "${operator}" for "${key}"`
            )
          }

          if (operator === 'is') {
            if (rawValue !== 'NULL' && rawValue !== 'NOT_NULL') {
              throw new BadUserInputError('Expected NULL or NOT_NULL')
            }

            children.push(
              field.nullable
                ? {
                    kind: 'condition',
                    field: field.column ?? key,
                    operator: rawValue === 'NULL' ? 'eq' : 'ne',
                    value: null
                  }
                : { kind: 'constant', value: rawValue === 'NOT_NULL' }
            )
            continue
          }

          const list = operator === 'in' || operator === 'nin'

          if (list && (!Array.isArray(rawValue) || rawValue.length > 1000)) {
            throw new BadUserInputError(
              'Filter lists must contain at most 1000 values'
            )
          }

          if (
            rawValue === null &&
            operator !== 'eq' &&
            operator !== 'ne' &&
            operator !== 'neq'
          ) {
            throw new BadUserInputError(
              `Operator "${operator}" does not accept null`
            )
          }

          const parsed = list
            ? (rawValue as unknown[]).map((item) =>
                validateScalarValue({ ...field, nullable: false }, item)
              )
            : validateScalarValue(field, rawValue)

          children.push({
            kind: 'condition',
            field: field.column ?? key,
            operator: (operator === 'neq' ? 'ne' : operator) as FilterOperator,
            value: parsed
          })
        }
      }
    }

    return group('and', children)
  }

  return walk(fields, input ?? {}, 0)
}

export function wrapFieldCondition(
  field: ResolvedQueryField,
  child: FilterNode
): FilterNode {
  return field.relations.reduceRight<FilterNode>(
    (nested, relation) => ({
      kind: 'relation',
      field: relation.field,
      quantifier: relation.many ? 'some' : 'is',
      child: nested
    }),
    child
  )
}

export function searchFilter(
  definition: QueryDefinition,
  search: unknown
): FilterNode {
  if (search === undefined || search === null) {
    return group('and', [])
  }

  if (typeof search !== 'string' || search.length > 200) {
    throw new BadUserInputError(
      'Search must be a string of at most 200 characters'
    )
  }

  const term = search.trim()

  if (!term) {
    return group('and', [])
  }

  if (!definition.searchable?.length) {
    throw new BadUserInputError('Search is not enabled')
  }

  return group(
    'or',
    definition.searchable.map((path) => {
      const field = resolveQueryField(definition, path)

      return wrapFieldCondition(field, {
        kind: 'condition',
        field: field.column,
        operator: 'contains',
        value: term
      })
    })
  )
}
