import {
  AndExpr,
  NotExpr,
  OrderByItem,
  OrExpr
} from '@prisma/orm-postgres/relational-core/ast'

import { BadUserInputError } from '@/common/utils/errors'

type FieldOps = {
  eq: (value: unknown) => Expr
  neq: (value: unknown) => Expr
  in: (values: readonly unknown[]) => Expr
  notIn: (values: readonly unknown[]) => Expr
  lt: (value: unknown) => Expr
  lte: (value: unknown) => Expr
  gt: (value: unknown) => Expr
  gte: (value: unknown) => Expr
  like: (pattern: string) => Expr
  ilike: (pattern: string) => Expr
  isNull: () => Expr
  isNotNull: () => Expr
}

export type Expr = Parameters<typeof AndExpr.of>[0][number]
type RelationOps = {
  some: (build: (fields: FieldBag) => Expr) => Expr
  every: (build: (fields: FieldBag) => Expr) => Expr
  none: (build: (fields: FieldBag) => Expr) => Expr
}

export type FieldBag = Record<string, unknown>

export type Combinators = {
  and(parts: Expr[]): Expr
  or(parts: Expr[]): Expr
  not(part: Expr): Expr
}

export const AST_COMBINATORS: Combinators = {
  and: (parts) => AndExpr.of(parts),
  or: (parts) => OrExpr.of(parts),
  not: (part) => new NotExpr(part)
}

function join(parts: Expr[], combinators: Combinators): Expr {
  return parts.length === 1 ? parts[0] : combinators.and(parts)
}

function isRelation(accessor: object): accessor is RelationOps {
  return 'some' in accessor
}

function relationToExpr(
  relation: RelationOps,
  fieldName: string,
  predicate: Record<string, unknown>,
  combinators: Combinators
): Expr {
  const parts: Expr[] = []

  for (const [quantifier, child] of Object.entries(predicate)) {
    if (child === null) {
      function anyRow(): Expr {
        return combinators.and([])
      }

      if (quantifier === 'is') {
        parts.push(relation.none(anyRow))
        continue
      }

      if (quantifier === 'isNot') {
        parts.push(relation.some(anyRow))
        continue
      }

      throw new BadUserInputError(
        `Relation quantifier "${quantifier}" on "${fieldName}" requires a filter`
      )
    }

    function build(fields: FieldBag): Expr {
      return whereToExpr(fields, child as Record<string, unknown>, combinators)
    }

    switch (quantifier) {
      case 'some':

      case 'is':
        parts.push(relation.some(build))
        break

      case 'every':
        parts.push(relation.every(build))
        break

      case 'none':

      case 'isNot':
        parts.push(relation.none(build))
        break

      default:
        throw new BadUserInputError(
          `Unsupported relation quantifier "${quantifier}" on "${fieldName}"`
        )
    }
  }

  return join(parts, combinators)
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function likePattern(
  operator: 'contains' | 'startsWith' | 'endsWith',
  value: string
): string {
  const escaped = escapeLike(value)

  if (operator === 'startsWith') {
    return `${escaped}%`
  }

  if (operator === 'endsWith') {
    return `%${escaped}`
  }

  return `%${escaped}%`
}

function asString(value: unknown, operator: string): string {
  if (typeof value !== 'string') {
    throw new BadUserInputError(
      `Operator "${operator}" expects a string value, received ${typeof value}`
    )
  }

  return value
}

function predicateToExpr(
  field: FieldOps,
  fieldName: string,
  predicate: Record<string, unknown>,
  combinators: Combinators
): Expr {
  const insensitive = predicate.mode === 'insensitive'
  const parts: Expr[] = []

  for (const [operator, value] of Object.entries(predicate)) {
    if (operator === 'mode') {
      continue
    }

    switch (operator) {
      case 'equals':
        parts.push(value === null ? field.isNull() : field.eq(value))
        break

      case 'not':
        parts.push(value === null ? field.isNotNull() : field.neq(value))
        break

      case 'in':
        parts.push(field.in(value as readonly unknown[]))
        break

      case 'notIn':
        parts.push(field.notIn(value as readonly unknown[]))
        break

      case 'lt':
        parts.push(field.lt(value))
        break

      case 'lte':
        parts.push(field.lte(value))
        break

      case 'gt':
        parts.push(field.gt(value))
        break

      case 'gte':
        parts.push(field.gte(value))
        break

      case 'contains':

      case 'startsWith':

      case 'endsWith': {
        const pattern = likePattern(operator, asString(value, operator))

        parts.push(insensitive ? field.ilike(pattern) : field.like(pattern))
        break
      }

      default:
        throw new BadUserInputError(
          `Unsupported filter operator "${operator}" on field "${fieldName}"`
        )
    }
  }

  return join(parts, combinators)
}

export function whereToExpr(
  fields: FieldBag,
  where: Record<string, unknown>,
  combinators: Combinators = AST_COMBINATORS
): Expr {
  const parts: Expr[] = []

  for (const [key, value] of Object.entries(where)) {
    switch (key) {
      case 'AND':
        parts.push(
          combinators.and(
            (value as Record<string, unknown>[]).map((child) =>
              whereToExpr(fields, child, combinators)
            )
          )
        )
        break

      case 'OR':
        parts.push(
          combinators.or(
            (value as Record<string, unknown>[]).map((child) =>
              whereToExpr(fields, child, combinators)
            )
          )
        )
        break

      case 'NOT':
        parts.push(
          combinators.not(
            whereToExpr(fields, value as Record<string, unknown>, combinators)
          )
        )
        break

      default: {
        const accessor = fields[key]

        if (accessor === null || typeof accessor !== 'object') {
          throw new BadUserInputError(`Unknown filter field "${key}"`)
        }

        if (isRelation(accessor)) {
          parts.push(
            relationToExpr(
              accessor,
              key,
              value as Record<string, unknown>,
              combinators
            )
          )
          break
        }

        const field = accessor as FieldOps

        if (value === null) {
          parts.push(field.isNull())
          break
        }

        if (typeof value === 'object' && !Array.isArray(value)) {
          parts.push(
            predicateToExpr(
              field,
              key,
              value as Record<string, unknown>,
              combinators
            )
          )
          break
        }

        parts.push(field.eq(value))
      }
    }
  }

  return join(parts, combinators)
}

export type OrderDirection = 'asc' | 'desc'
export type OrderStep = { field: string; direction: OrderDirection }

export type Order = InstanceType<typeof OrderByItem>

type OrderOps = { asc: () => Order; desc: () => Order }

function defaultNulls(direction: OrderDirection): 'first' | 'last' {
  return direction === 'asc' ? 'last' : 'first'
}

export function orderPlanToSteps(
  orderBy: readonly Record<string, unknown>[]
): OrderStep[] {
  return orderBy.map((entry) => {
    const pairs = Object.entries(entry)

    if (pairs.length !== 1) {
      throw new BadUserInputError(
        `Expected exactly one field per orderBy entry, received ${pairs.length}`
      )
    }

    const [field, value] = pairs[0]

    if (value === 'asc' || value === 'desc') {
      return { field, direction: value }
    }

    if (value === null || typeof value !== 'object') {
      throw new BadUserInputError(
        `Invalid orderBy value for field "${field}": ${String(value)}`
      )
    }

    const { sort, nulls } = value as { sort?: unknown; nulls?: unknown }

    if (sort === undefined) {
      throw new BadUserInputError(
        `Ordering through relation "${field}" is not supported on Prisma Next yet`
      )
    }

    if (sort !== 'asc' && sort !== 'desc') {
      throw new BadUserInputError(
        `Invalid sort direction ${JSON.stringify(sort)} on field "${field}"`
      )
    }

    if (nulls !== undefined && nulls !== defaultNulls(sort)) {
      throw new BadUserInputError(
        `Prisma Next cannot place NULLs ${JSON.stringify(nulls)} for ${sort.toUpperCase()} ordering on "${field}"; ` +
          `only PostgreSQL's default (NULLS ${defaultNulls(sort).toUpperCase()}) is available`
      )
    }

    return { field, direction: sort }
  })
}

export function orderSelector(fields: FieldBag, step: OrderStep): Order {
  const field = fields[step.field] as OrderOps | undefined

  if (!field) {
    throw new BadUserInputError(`Unknown orderBy field "${step.field}"`)
  }

  return step.direction === 'asc' ? field.asc() : field.desc()
}
