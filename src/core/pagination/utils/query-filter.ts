import { isStoredDateTime } from '@/common/utils/date-time'
import { BadUserInputError } from '@/common/utils/errors'
import {
  MAX_FILTER_LIST,
  MAX_FILTER_VALUES,
  MAX_SEARCH_TERM,
  MIN_SEARCH_TERM
} from '@/core/pagination/pagination.constants'

import {
  type QueryDefinition,
  type QueryFields,
  type ResolvedQueryField,
  type ScalarQueryField,
  isFilterable,
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

function columnIsNull(node: {
  field: string
  nullable?: boolean
  value: unknown
}): boolean {
  return Boolean(node.nullable) && node.value !== null
}

function nullValue(field: string): FilterNode {
  return { kind: 'condition', field, operator: 'eq', value: null }
}

export function strictlyFalse(node: FilterNode): FilterNode {
  switch (node.kind) {
    case 'constant':
      return { kind: 'constant', value: !node.value }

    case 'and':
      return group('or', node.children.map(strictlyFalse))

    case 'or':
      return group('and', node.children.map(strictlyFalse))

    case 'not':
      return notFalse(node.child)

    case 'condition':
      return columnIsNull(node)
        ? group('or', [negate(node), nullValue(node.field)])
        : negate(node)

    default:
      return negate(node)
  }
}

export function notFalse(node: FilterNode): FilterNode {
  switch (node.kind) {
    case 'and':
      return group('and', node.children.map(notFalse))

    case 'or':
      return group('or', node.children.map(notFalse))

    case 'not':
      return strictlyFalse(node.child)

    case 'condition':
      return columnIsNull(node)
        ? group('or', [node, nullValue(node.field)])
        : node

    default:
      return node
  }
}

export function operatorsFor(field: ScalarQueryField): string[] {
  const operators = ['eq', 'ne', 'in', 'nin', 'is']

  if (field.type === 'boolean') {
    return ['eq', 'ne', 'is']
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
      if (value instanceof Date && Number.isFinite(value.getTime())) {
        return value.toISOString()
      }

      if (typeof value === 'string' && isStoredDateTime(value)) {
        return value
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
  let values = 0

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

            const relation = field.field ?? key
            const child = walk(field.fields, nested, depth + 1)

            children.push(
              quantifier === 'every'
                ? {
                    kind: 'relation',
                    field: relation,
                    quantifier: 'none',
                    child: strictlyFalse(child)
                  }
                : { kind: 'relation', field: relation, quantifier, child }
            )
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
        if (!isFilterable(field) || !isQueryObject(entry)) {
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

          if (
            list &&
            (!Array.isArray(rawValue) || rawValue.length > MAX_FILTER_LIST)
          ) {
            throw new BadUserInputError(
              `Filter lists must contain at most ${String(MAX_FILTER_LIST)} values`
            )
          }

          values += list ? (rawValue as unknown[]).length : 1

          if (values > MAX_FILTER_VALUES) {
            throw new BadUserInputError(
              `Filter conditions may hold at most ${String(MAX_FILTER_VALUES)} values in total`
            )
          }

          if (rawValue === null && operator !== 'eq' && operator !== 'ne') {
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
            operator: operator as FilterOperator,
            value: parsed,
            nullable: field.nullable
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

  if (typeof search !== 'string' || search.length > MAX_SEARCH_TERM) {
    throw new BadUserInputError(
      `Search must be a string of at most ${MAX_SEARCH_TERM} characters`
    )
  }

  const term = search.trim()

  if (!term) {
    return group('and', [])
  }

  if (!definition.searchable?.length) {
    throw new BadUserInputError('Search is not enabled')
  }

  if (term.length < MIN_SEARCH_TERM) {
    throw new BadUserInputError(
      `Search needs at least ${MIN_SEARCH_TERM} characters; a shorter term cannot use the trigram index and scans every row`
    )
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
