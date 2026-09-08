import {
  AndExpr,
  NotExpr,
  NullCheckExpr
} from '@prisma/orm-postgres/relational-core/ast'

import { BadUserInputError } from '@/common/utils'
import type { SortClause } from '@/core/pagination/utils/query-spec'

import contractJson from '../contract.json' with { type: 'json' }

import {
  type Combinators,
  type Expr,
  type FieldBag,
  whereToExpr
} from './where-to-expr'

type RelationMeta = {
  cardinality: string
  on: { localFields: string[]; targetFields: string[] }
  to: { model: string; namespace: string }
}

type ModelMeta = {
  relations?: Record<string, RelationMeta>
  storage: { table: string; fields: Record<string, { column: string }> }
}

type SqlFns = {
  eq(left: unknown, right: unknown): Expr
  ne(left: unknown, right: unknown): Expr
  lt(left: unknown, right: unknown): Expr
  lte(left: unknown, right: unknown): Expr
  gt(left: unknown, right: unknown): Expr
  gte(left: unknown, right: unknown): Expr
  ilike(left: unknown, right: unknown): Expr
  in(left: unknown, right: readonly unknown[]): Expr
  notIn(left: unknown, right: readonly unknown[]): Expr
  and(...parts: Expr[]): Expr
  or(...parts: Expr[]): Expr
}

type BuilderExpr = { buildAst(): Expr }

function alwaysTrue(): Expr {
  return { buildAst: () => AndExpr.of([]) } as unknown as Expr
}

function nullCheck(expr: unknown, negated: boolean): Expr {
  const inner = expr as BuilderExpr

  return {
    buildAst: () =>
      negated
        ? NullCheckExpr.isNotNull(inner.buildAst())
        : NullCheckExpr.isNull(inner.buildAst())
  } as unknown as Expr
}

function sqlCombinators(fns: SqlFns): Combinators {
  return {
    and: (parts) => (parts.length ? fns.and(...parts) : alwaysTrue()),
    or: (parts) => fns.or(...parts),
    not: (part) => {
      const inner = part as unknown as BuilderExpr

      return {
        buildAst: () => new NotExpr(inner.buildAst())
      } as unknown as Expr
    }
  }
}

type SqlScope = Record<string, Record<string, unknown>>

type SqlQuery = {
  where(build: (scope: SqlScope, fns: SqlFns) => Expr): SqlQuery
  orderBy(
    build: (scope: SqlScope) => unknown,
    options: { direction: 'asc' | 'desc' }
  ): SqlQuery
  limit(count: number): SqlQuery
  build(): unknown
}

type SqlTable = {
  outerLeftJoin(
    other: SqlTable,
    on: (scope: SqlScope, fns: SqlFns) => Expr
  ): SqlTable
  select(build: (scope: SqlScope) => Record<string, unknown>): SqlQuery
}

export type SqlLaneClient = {
  sql: { public: Record<string, SqlTable> }
  runtime(): { query(plan: unknown): AsyncIterable<Record<string, unknown>> }
}

export type JoinStep = {
  relation: string
  source: string
  table: string
  columns: [string, string][]
}

export type OrderStep = {
  table: string
  column: string
  direction: 'asc' | 'desc'
}

const models = contractJson.domain.namespaces.public
  .models as unknown as Record<string, ModelMeta>

const primaryKeys = contractJson.storage.namespaces.public.entries
  .table as unknown as Record<string, { primaryKey: { columns: string[] } }>

function modelMeta(model: string): ModelMeta {
  const meta = models[model]

  if (!meta) {
    throw new Error(`Model "${model}" is not declared in the contract`)
  }

  return meta
}

function columnOf(model: string, field: string): string {
  return modelMeta(model).storage.fields[field]?.column ?? field
}

export function tableOf(model: string): string {
  return modelMeta(model).storage.table
}

export function fieldForColumn(model: string, column: string): string {
  const entry = Object.entries(modelMeta(model).storage.fields).find(
    ([, storage]) => storage.column === column
  )

  return entry?.[0] ?? column
}

export function modelFields(model: string): string[] {
  return Object.keys(modelMeta(model).storage.fields)
}

export function relationLocalFields(model: string, name: string): string[] {
  return modelMeta(model).relations?.[name]?.on.localFields ?? []
}

export function primaryKeyOf(model: string): { field: string; column: string } {
  const meta = modelMeta(model)
  const [column] = primaryKeys[meta.storage.table].primaryKey.columns
  const entry = Object.entries(meta.storage.fields).find(
    ([, storage]) => storage.column === column
  )

  return { field: entry?.[0] ?? column, column }
}

function relationMeta(model: string, name: string): RelationMeta {
  const relation = modelMeta(model).relations?.[name]

  if (!relation) {
    throw new BadUserInputError(
      `Relation "${name}" is not declared on "${model}"`
    )
  }

  if (relation.cardinality !== 'N:1' && relation.cardinality !== '1:1') {
    throw new BadUserInputError(
      `Ordering and filtering through the to-many relation "${name}" is not supported yet`
    )
  }

  return relation
}

function joinStep(model: string, name: string): JoinStep {
  const relation = relationMeta(model, name)

  return {
    relation: name,
    source: tableOf(model),
    table: tableOf(relation.to.model),
    columns: relation.on.localFields.map((local, index) => [
      columnOf(model, local),
      columnOf(relation.to.model, relation.on.targetFields[index])
    ])
  }
}

export function hasRelationSort(sort: readonly SortClause[]): boolean {
  return sort.some((clause) => clause.field.relations.length > 0)
}

export function relationNames(
  model: string,
  sort: readonly SortClause[],
  where: Record<string, unknown>
): string[] {
  const names = new Set<string>()

  for (const clause of sort) {
    for (const relation of clause.field.relations) {
      names.add(relation.field)
    }
  }

  const declared = new Set(Object.keys(modelMeta(model).relations ?? {}))

  function walk(node: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(node)) {
      if (declared.has(key)) {
        names.add(key)
        continue
      }

      if (Array.isArray(value)) {
        for (const child of value) {
          walk(child as Record<string, unknown>)
        }

        continue
      }

      if (key === 'NOT' && value !== null && typeof value === 'object') {
        walk(value as Record<string, unknown>)
      }
    }
  }

  walk(where)

  return [...names]
}

function defaultNulls(direction: 'asc' | 'desc'): 'first' | 'last' {
  return direction === 'asc' ? 'last' : 'first'
}

export function orderSteps(
  model: string,
  sort: readonly SortClause[],
  backward: boolean
): OrderStep[] {
  return sort.map((clause) => {
    const ascending = (clause.direction === 'ASC') !== backward
    const direction = ascending ? 'asc' : 'desc'
    const nulls = (clause.nulls === 'last') !== backward ? 'last' : 'first'

    if (clause.field.scalar.nullable && nulls !== defaultNulls(direction)) {
      throw new BadUserInputError(
        `Prisma Next cannot place NULLs ${nulls} for ${direction.toUpperCase()} ordering on "${clause.field.name}"; ` +
          `only PostgreSQL's default (NULLS ${defaultNulls(direction).toUpperCase()}) is available`
      )
    }

    let current = model

    for (const relation of clause.field.relations) {
      current = relationMeta(current, relation.field).to.model
    }

    return { table: tableOf(current), column: clause.field.column, direction }
  })
}

function fieldOps(expr: unknown, fns: SqlFns): Record<string, unknown> {
  return {
    eq: (value: unknown) => fns.eq(expr, value),
    neq: (value: unknown) => fns.ne(expr, value),
    in: (values: readonly unknown[]) => fns.in(expr, values),
    notIn: (values: readonly unknown[]) => fns.notIn(expr, values),
    lt: (value: unknown) => fns.lt(expr, value),
    lte: (value: unknown) => fns.lte(expr, value),
    gt: (value: unknown) => fns.gt(expr, value),
    gte: (value: unknown) => fns.gte(expr, value),
    ilike: (pattern: string) => fns.ilike(expr, pattern),
    like: (pattern: string) => fns.ilike(expr, pattern),
    isNull: () => nullCheck(expr, false),
    isNotNull: () => nullCheck(expr, true)
  }
}

export function sqlFieldBag(
  model: string,
  scope: SqlScope,
  fns: SqlFns,
  joined: ReadonlySet<string>
): FieldBag {
  const meta = modelMeta(model)
  const bag: Record<string, unknown> = {}

  for (const [field, storage] of Object.entries(meta.storage.fields)) {
    bag[field] = fieldOps(scope[meta.storage.table][storage.column], fns)
  }

  for (const [name, relation] of Object.entries(meta.relations ?? {})) {
    if (!joined.has(name)) {
      continue
    }

    const target = sqlFieldBag(relation.to.model, scope, fns, joined)
    const anchor =
      scope[tableOf(relation.to.model)][primaryKeyOf(relation.to.model).column]
    const combinators = sqlCombinators(fns)

    function present(build: (fields: FieldBag) => Expr): Expr {
      return combinators.and([nullCheck(anchor, true), build(target)])
    }

    function absent(build: (fields: FieldBag) => Expr): Expr {
      return combinators.or([
        nullCheck(anchor, false),
        combinators.not(build(target))
      ])
    }

    function every(build: (fields: FieldBag) => Expr): Expr {
      return combinators.or([nullCheck(anchor, false), build(target)])
    }

    bag[name] = {
      is: present,
      some: present,
      isNot: absent,
      none: absent,
      every
    }
  }

  return bag
}

export async function selectOrderedIds(
  client: SqlLaneClient,
  model: string,
  options: {
    where: Record<string, unknown>
    order: OrderStep[]
    relations: string[]
    take: number
  }
): Promise<unknown[]> {
  const key = primaryKeyOf(model)
  const tables = client.sql.public
  const joined = new Set(options.relations)
  let source: SqlTable = tables[tableOf(model)]

  for (const name of options.relations) {
    const join = joinStep(model, name)

    source = source.outerLeftJoin(tables[join.table], (scope, fns) =>
      fns.and(
        ...join.columns.map(([local, target]) =>
          fns.eq(scope[join.source][local], scope[join.table][target])
        )
      )
    )
  }

  let query = source
    .select((scope) => ({ [key.column]: scope[tableOf(model)][key.column] }))
    .where((scope, fns) =>
      whereToExpr(
        sqlFieldBag(model, scope, fns, joined),
        options.where,
        sqlCombinators(fns)
      )
    )

  for (const step of options.order) {
    query = query.orderBy((scope) => scope[step.table][step.column], {
      direction: step.direction
    })
  }

  const plan = query.limit(options.take).build()
  const ids: unknown[] = []

  for await (const row of client.runtime().query(plan)) {
    ids.push(row[key.column])
  }

  return ids
}
