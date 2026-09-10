import { keysetFilter } from '@/core/pagination/utils/query-cursor'
import { group } from '@/core/pagination/utils/query-filter'
import type {
  FilterNode,
  FilterOperator,
  QuerySpec,
  SortClause
} from '@/core/pagination/utils/query-spec'

export type PrismaQueryArgs = {
  where: Record<string, unknown>
  orderBy: Record<string, unknown>[]
  take: number
  include?: Record<string, unknown>
}
export type PrismaQueryPlan = {
  args: PrismaQueryArgs
  countWhere: Record<string, unknown>
}

const OPERATOR_MAP: Record<FilterOperator, string> = {
  eq: 'equals',
  ne: 'not',
  in: 'in',
  nin: 'notIn',
  lt: 'lt',
  lte: 'lte',
  gt: 'gt',
  gte: 'gte',
  contains: 'contains',
  startsWith: 'startsWith',
  endsWith: 'endsWith'
}

export function filterToPrisma(node: FilterNode): Record<string, unknown> {
  switch (node.kind) {
    case 'constant':
      return node.value ? {} : { OR: [] }

    case 'and':
      return { AND: node.children.map(filterToPrisma) }

    case 'or':
      return { OR: node.children.map(filterToPrisma) }

    case 'not':
      return { NOT: filterToPrisma(node.child) }

    case 'relation':
      return {
        [node.field]: {
          [node.quantifier]:
            node.child === null ? null : filterToPrisma(node.child)
        }
      }

    case 'condition': {
      const predicate: Record<string, unknown> = {
        [OPERATOR_MAP[node.operator]]: node.value
      }

      if (['contains', 'startsWith', 'endsWith'].includes(node.operator)) {
        predicate.mode = 'insensitive'
      }

      return { [node.field]: predicate }
    }
  }
}

function orderToPrisma(
  clause: SortClause,
  backward: boolean
): Record<string, unknown> {
  const ascending = (clause.direction === 'ASC') !== backward
  const nullsLast = (clause.nulls === 'last') !== backward
  const direction = ascending ? 'asc' : 'desc'
  const scalarOrder = clause.field.scalar.nullable
    ? { sort: direction, nulls: nullsLast ? 'last' : 'first' }
    : direction

  return clause.field.relations.reduceRight<Record<string, unknown>>(
    (nested, relation) => ({ [relation.field]: nested }),
    { [clause.field.column]: scalarOrder }
  )
}

function includeOrderFields(
  sort: SortClause[]
): Record<string, unknown> | undefined {
  const include: Record<string, unknown> = {}

  for (const { field } of sort) {
    if (!field.relations.length) {
      continue
    }

    let current = include

    for (const relation of field.relations) {
      const existing = current[relation.field] as
        | { select: Record<string, unknown> }
        | undefined
      const entry = existing ?? { select: {} }

      current[relation.field] = entry
      current = entry.select
    }

    current[field.column] = true
  }

  return Object.keys(include).length ? include : undefined
}

export function specToPrisma(spec: QuerySpec): PrismaQueryPlan {
  const pagination = spec.pagination
  const backward = pagination.direction === 'backward'
  const countWhere = filterToPrisma(spec.filter)
  const orderBy = spec.sort.map((clause) => orderToPrisma(clause, backward))
  const include = includeOrderFields(spec.sort)

  const filter = pagination.values
    ? group('and', [
        spec.filter,
        keysetFilter(spec.sort, pagination.values, backward, spec.preference)
      ])
    : spec.filter

  return {
    args: {
      where: filterToPrisma(filter),
      orderBy,
      take: pagination.limit + 1,
      include
    },
    countWhere
  }
}
