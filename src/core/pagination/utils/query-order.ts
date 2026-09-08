import { BadUserInputError } from '@/common/utils/errors'
import { DEFAULT_ORDER_BY } from '@/core/pagination/pagination.constants'

import { type OrderDirection, ORDER_DIRECTIONS } from './order-direction'
import {
  type OrderByInput,
  type QueryDefinition,
  isProvided,
  isQueryObject,
  resolveQueryField
} from './query-definition'
import type { SortClause } from './query-spec'

export { ORDER_DIRECTIONS } from './order-direction'

function sortClause(
  definition: QueryDefinition,
  path: string,
  value: unknown,
  unique = false
): SortClause {
  const field = resolveQueryField(definition, path)

  if (
    (!unique && !field.scalar.sortable) ||
    field.relations.some((relation) => relation.many)
  ) {
    throw new BadUserInputError(
      `Field "${path}" is not sortable; ordering requires a scalar through to-one relations`
    )
  }

  if (typeof value !== 'string' || !Object.hasOwn(ORDER_DIRECTIONS, value)) {
    throw new BadUserInputError(`Invalid sort direction for "${path}"`)
  }

  const direction =
    value === 'DESC' || value.startsWith('Desc') ? 'DESC' : 'ASC'
  let nulls: 'first' | 'last' = direction === 'ASC' ? 'last' : 'first'

  if (value.endsWith('First')) {
    nulls = 'first'
  }

  if (value.endsWith('Last')) {
    nulls = 'last'
  }

  return { field, direction, nulls }
}

function orderPath(entry: OrderByInput): string | null {
  const parts: string[] = []
  let current: unknown = entry

  while (isQueryObject(current)) {
    const entries = Object.entries(current).filter(([, value]) =>
      isProvided(value)
    )

    if (entries.length !== 1) {
      return null
    }

    parts.push(entries[0][0])
    current = entries[0][1]
  }

  return typeof current === 'string' ? parts.join('.') : null
}

function supportsPath(definition: QueryDefinition, path: string): boolean {
  try {
    const field = resolveQueryField(definition, path)

    return (
      Boolean(field.scalar.sortable) &&
      !field.relations.some((relation) => relation.many)
    )
  } catch {
    return false
  }
}

export function defaultOrderFor(definition: QueryDefinition): OrderByInput[] {
  if (definition.defaultOrderBy) {
    return definition.defaultOrderBy
  }

  return DEFAULT_ORDER_BY.filter((entry) => {
    const path = orderPath(entry)

    return path !== null && supportsPath(definition, path)
  })
}

export function parseOrder(
  definition: QueryDefinition,
  orderBy: unknown
): SortClause[] {
  const result: SortClause[] = []

  function walk(value: unknown, prefix: string[], depth: number): void {
    if (depth > 8 || !isQueryObject(value)) {
      throw new BadUserInputError('Invalid nested orderBy')
    }

    const entries = Object.entries(value).filter(
      ([, entry]) => entry !== null && entry !== undefined
    )

    if (entries.length !== 1) {
      throw new BadUserInputError(
        'Each orderBy entry must contain exactly one scalar path; use multiple array entries'
      )
    }

    const [name, entry] = entries[0]
    const path = [...prefix, name]

    if (isQueryObject(entry)) {
      walk(entry, path, depth + 1)
    } else {
      result.push(sortClause(definition, path.join('.'), entry))
    }
  }

  const entries = orderBy ?? defaultOrderFor(definition)

  if (!Array.isArray(entries) || entries.length > 10) {
    throw new BadUserInputError('orderBy must have at most 10 entries')
  }

  for (const entry of entries) {
    walk(entry, [], 0)
  }

  if (!result.length) {
    for (const entry of defaultOrderFor(definition)) {
      walk(entry, [], 0)
    }
  }

  const unique = sortClause(
    definition,
    definition.uniqueField ?? 'id',
    'ASC',
    true
  )

  function pathKey(clause: SortClause): string {
    return [
      ...clause.field.relations.map((relation) => relation.field),
      clause.field.column
    ].join('.')
  }
  const seen = new Set<string>()

  for (const clause of result) {
    const key = pathKey(clause)

    if (seen.has(key)) {
      throw new BadUserInputError(
        `Duplicate ordering field "${clause.field.name}"`
      )
    }

    seen.add(key)
  }

  if (!seen.has(pathKey(unique))) {
    result.push(unique)
  }

  return result
}
