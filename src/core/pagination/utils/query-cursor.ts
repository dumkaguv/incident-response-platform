import { createHash } from 'node:crypto'

import { BadUserInputError } from '@/common/utils/errors'

import { fieldIsNullable, isQueryObject } from './query-definition'
import {
  group,
  negate,
  validateScalarValue,
  wrapFieldCondition
} from './query-filter'
import type { FilterNode, QuerySpec, SortClause } from './query-spec'

export class InvalidCursorError extends BadUserInputError {
  constructor() {
    super(
      'Invalid pagination cursor or changed query; restart pagination without a cursor'
    )
  }
}

export function queryFingerprint(
  resource: string,
  filter: FilterNode,
  sort: SortClause[]
): string {
  const value = {
    resource,
    filter,
    sort: sort.map((clause) => ({
      ...clause,
      enumOrder: Object.values(clause.field.scalar.enum?.values ?? {})
    }))
  }
  const json = JSON.stringify(value, (_key, entry: unknown) =>
    isQueryObject(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([left], [right]) =>
            left.localeCompare(right)
          )
        )
      : entry
  )

  return createHash('sha256').update(json).digest('base64url')
}

function valueAtOrderPath(row: unknown, clause: SortClause): unknown {
  let value = row

  for (const key of [
    ...clause.field.relations.map((relation) => relation.field),
    clause.field.column
  ]) {
    if (value === null) {
      return null
    }

    if (
      !isQueryObject(value) ||
      !Object.hasOwn(value, key) ||
      value[key] === undefined
    ) {
      throw new Error(`Missing selected cursor field "${clause.field.name}"`)
    }

    value = value[key]
  }

  return value
}

export function encodeCursor(row: unknown, spec: QuerySpec): string {
  const values = spec.sort.map((clause) => valueAtOrderPath(row, clause))

  return Buffer.from(
    JSON.stringify({ v: 1, fingerprint: spec.fingerprint, values })
  ).toString('base64url')
}

export function decodeCursor(
  cursor: unknown,
  fingerprint: string,
  sort: SortClause[]
): unknown[] {
  try {
    if (
      typeof cursor !== 'string' ||
      !cursor.length ||
      cursor.length > 65536 ||
      !/^[A-Za-z0-9_-]+$/.test(cursor)
    ) {
      throw new InvalidCursorError()
    }

    const buffer = Buffer.from(cursor, 'base64url')

    if (buffer.toString('base64url') !== cursor) {
      throw new InvalidCursorError()
    }

    const payload: unknown = JSON.parse(buffer.toString('utf8'))

    if (
      !isQueryObject(payload) ||
      payload.v !== 1 ||
      payload.fingerprint !== fingerprint ||
      !Array.isArray(payload.values) ||
      payload.values.length !== sort.length
    ) {
      throw new InvalidCursorError()
    }

    return payload.values.map((value: unknown, index) =>
      validateScalarValue(
        {
          ...sort[index].field.scalar,
          nullable: fieldIsNullable(sort[index].field)
        },
        value
      )
    )
  } catch {
    throw new InvalidCursorError()
  }
}

function nullCondition(clause: SortClause): FilterNode {
  const { field } = clause
  const conditions: FilterNode[] = []

  if (field.scalar.nullable) {
    conditions.push(
      wrapFieldCondition(field, {
        kind: 'condition',
        field: field.column,
        operator: 'eq',
        value: null
      })
    )
  }

  for (const [index, relation] of field.relations.entries()) {
    if (relation.nullable) {
      conditions.push(
        wrapFieldCondition(
          { ...field, relations: field.relations.slice(0, index) },
          {
            kind: 'relation',
            field: relation.field,
            quantifier: 'is',
            child: null
          }
        )
      )
    }
  }

  return group('or', conditions)
}

function equality(clause: SortClause, value: unknown): FilterNode {
  return value === null
    ? nullCondition(clause)
    : wrapFieldCondition(clause.field, {
        kind: 'condition',
        field: clause.field.column,
        operator: 'eq',
        value
      })
}

function comparison(
  clause: SortClause,
  value: unknown,
  ascending: boolean
): FilterNode {
  const { field } = clause

  if (field.scalar.type === 'enum' || field.scalar.type === 'boolean') {
    const ordered: unknown[] =
      field.scalar.type === 'boolean'
        ? [false, true]
        : Object.values(field.scalar.enum?.values ?? {})
    const index = ordered.indexOf(value)

    if (index < 0) {
      throw new InvalidCursorError()
    }

    const values = ascending
      ? ordered.slice(index + 1)
      : ordered.slice(0, index)

    return group(
      'or',
      values.map((item) => equality(clause, item))
    )
  }

  return wrapFieldCondition(field, {
    kind: 'condition',
    field: field.column,
    operator: ascending ? 'gt' : 'lt',
    value
  })
}

export function keysetFilter(
  sort: SortClause[],
  values: unknown[],
  backward: boolean
): FilterNode {
  const branches: FilterNode[] = []
  const equalities: FilterNode[] = []

  for (const [index, clause] of sort.entries()) {
    const value = values[index]
    const ascending = (clause.direction === 'ASC') !== backward
    const nullsLast = (clause.nulls === 'last') !== backward
    let after: FilterNode

    if (value === null) {
      after = nullsLast ? group('or', []) : negate(nullCondition(clause))
    } else {
      after = comparison(clause, value, ascending)
      if (nullsLast) {
        after = group('or', [after, nullCondition(clause)])
      }
    }

    branches.push(group('and', [...equalities, after]))
    equalities.push(equality(clause, value))
  }

  return group('or', branches)
}
