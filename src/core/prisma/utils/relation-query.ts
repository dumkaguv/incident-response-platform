import {
  AndExpr,
  ColumnRef,
  ExistsExpr,
  NotExpr,
  NullCheckExpr
} from '@prisma/orm-postgres/relational-core/ast'

import { BadUserInputError } from '@/common/utils'
import { fieldIsNullable } from '@/core/pagination/utils/query-definition'
import type { SortClause } from '@/core/pagination/utils/query-spec'

import {
  type RelationMeta,
  columnOf,
  isToMany,
  primaryKeyOf,
  relationMeta,
  relationsOf,
  storageFields,
  tableOf
} from './contract-meta'
import {
  type RelationPath,
  existsAlias,
  joinAlias,
  scopeKey
} from './relation-path'
import {
  type Combinators,
  type Expr,
  type FieldBag,
  whereToExpr
} from './where-to-expr'

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
  as(alias: string): SqlTable
  outerLeftJoin(
    other: SqlTable,
    on: (scope: SqlScope, fns: SqlFns) => Expr
  ): SqlTable
  select(build: (scope: SqlScope) => Record<string, unknown>): SqlQuery
}

export type SqlTables = Record<string, SqlTable>

export type SqlLaneClient = {
  sql: { public: SqlTables }
  runtime(): { query(plan: unknown): AsyncIterable<Record<string, unknown>> }
}

export type SqlLaneContext = {
  tables: SqlTables
  joined: ReadonlySet<string>
}

export type OrderStep = {
  table: string
  column: string
  direction: 'asc' | 'desc'
  expression: 'column' | 'isNull'
}

type Quantifier = 'some' | 'none' | 'every'

function defaultNulls(direction: 'asc' | 'desc'): 'first' | 'last' {
  return direction === 'asc' ? 'last' : 'first'
}

export function requiresSqlLane(sort: readonly SortClause[]): boolean {
  return sort.some(
    (clause) =>
      clause.field.relations.length > 0 ||
      (fieldIsNullable(clause.field) &&
        clause.nulls !==
          defaultNulls(clause.direction === 'ASC' ? 'asc' : 'desc'))
  )
}

export function orderSteps(
  model: string,
  sort: readonly SortClause[],
  backward: boolean
): OrderStep[] {
  const rootTable = tableOf(model)
  const steps: OrderStep[] = []

  for (const clause of sort) {
    const ascending = (clause.direction === 'ASC') !== backward
    const direction = ascending ? 'asc' : 'desc'
    const nulls = (clause.nulls === 'last') !== backward ? 'last' : 'first'
    const path: string[] = []
    let owner = model

    for (const relation of clause.field.relations) {
      const meta = relationMeta(owner, relation.field)

      if (isToMany(meta)) {
        throw new BadUserInputError(
          `Ordering through the to-many relation "${relation.field}" is not supported`
        )
      }

      path.push(relation.field)
      owner = meta.to.model
    }

    const table = scopeKey(rootTable, path)
    const column = columnOf(owner, clause.field.column)

    if (fieldIsNullable(clause.field) && nulls !== defaultNulls(direction)) {
      steps.push({
        table,
        column,
        direction: nulls === 'first' ? 'desc' : 'asc',
        expression: 'isNull'
      })
    }

    steps.push({ table, column, direction, expression: 'column' })
  }

  return steps
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

function existsThrough(
  parentModel: string,
  parentKey: string,
  path: RelationPath,
  name: string,
  relation: RelationMeta,
  build: (fields: FieldBag) => Expr,
  ctx: SqlLaneContext,
  quantifier: Quantifier
): Expr {
  const childPath = [...path, name]
  const childModel = relation.to.model
  const childKey = existsAlias(childPath)
  const key = primaryKeyOf(childModel)

  function subqueryAst(): never {
    const query = ctx.tables[tableOf(childModel)]
      .as(childKey)
      .select((scope) => ({ [key.column]: scope[childKey][key.column] }))
      .where((scope, fns) => {
        const combinators = sqlCombinators(fns)
        const matched = build(
          sqlFieldBag(childModel, childPath, childKey, scope, fns, ctx)
        )

        return combinators.and([
          ...relation.on.localFields.map((local, index) =>
            fns.eq(
              scope[childKey][
                columnOf(childModel, relation.on.targetFields[index])
              ],
              {
                buildAst: () =>
                  ColumnRef.of(parentKey, columnOf(parentModel, local))
              }
            )
          ),
          quantifier === 'every' ? combinators.not(matched) : matched
        ])
      })

    return (query.build() as { ast: never }).ast
  }

  return {
    buildAst: () =>
      quantifier === 'some'
        ? ExistsExpr.exists(subqueryAst())
        : ExistsExpr.notExists(subqueryAst())
  } as unknown as Expr
}

export function sqlFieldBag(
  model: string,
  path: RelationPath,
  key: string,
  scope: SqlScope,
  fns: SqlFns,
  ctx: SqlLaneContext
): FieldBag {
  const bag: Record<string, unknown> = {}

  for (const [field, storage] of Object.entries(storageFields(model))) {
    bag[field] = fieldOps(scope[key][storage.column], fns)
  }

  for (const [name, relation] of Object.entries(relationsOf(model))) {
    const next = [...path, name]

    if (isToMany(relation)) {
      function through(
        quantifier: Quantifier
      ): (build: (fields: FieldBag) => Expr) => Expr {
        return (build) =>
          existsThrough(
            model,
            key,
            path,
            name,
            relation,
            build,
            ctx,
            quantifier
          )
      }

      bag[name] = {
        some: through('some'),
        none: through('none'),
        every: through('every')
      }

      continue
    }

    if (!ctx.joined.has(next.join('.'))) {
      continue
    }

    const childKey = joinAlias(next)
    const target = sqlFieldBag(
      relation.to.model,
      next,
      childKey,
      scope,
      fns,
      ctx
    )
    const anchor = scope[childKey][primaryKeyOf(relation.to.model).column]
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

function applyJoins(
  tables: SqlTables,
  model: string,
  paths: RelationPath[]
): SqlTable {
  const rootTable = tableOf(model)
  let source: SqlTable = tables[rootTable]

  for (const path of paths) {
    const parentPath = path.slice(0, -1)
    const name = path[path.length - 1]
    let owner = model

    for (const step of parentPath) {
      owner = relationMeta(owner, step).to.model
    }

    const relation = relationMeta(owner, name)

    if (isToMany(relation)) {
      throw new BadUserInputError(
        `Filtering through the to-many relation "${name}" is not supported`
      )
    }

    const parentKey = scopeKey(rootTable, parentPath)
    const childKey = joinAlias(path)
    const child = tables[tableOf(relation.to.model)].as(childKey)

    source = source.outerLeftJoin(child, (scope, fns) =>
      fns.and(
        ...relation.on.localFields.map((local, index) =>
          fns.eq(
            scope[parentKey][columnOf(owner, local)],
            scope[childKey][
              columnOf(relation.to.model, relation.on.targetFields[index])
            ]
          )
        )
      )
    )
  }

  return source
}

export function buildOrderedIdQuery(
  tables: SqlTables,
  model: string,
  options: {
    where: Record<string, unknown>
    order: OrderStep[]
    paths: RelationPath[]
    take: number
  }
): SqlQuery {
  const key = primaryKeyOf(model)
  const rootTable = tableOf(model)
  const ctx: SqlLaneContext = {
    tables,
    joined: new Set(options.paths.map((path) => path.join('.')))
  }

  let query = applyJoins(tables, model, options.paths)
    .select((scope) => ({ [key.column]: scope[rootTable][key.column] }))
    .where((scope, fns) =>
      whereToExpr(
        sqlFieldBag(model, [], rootTable, scope, fns, ctx),
        options.where,
        sqlCombinators(fns)
      )
    )

  for (const step of options.order) {
    query = query.orderBy(
      (scope) => {
        const column = scope[step.table][step.column]

        return step.expression === 'isNull' ? nullCheck(column, false) : column
      },
      { direction: step.direction }
    )
  }

  return query.limit(options.take)
}

export async function selectOrderedIds(
  client: SqlLaneClient,
  model: string,
  options: {
    where: Record<string, unknown>
    order: OrderStep[]
    paths: RelationPath[]
    take: number
  }
): Promise<unknown[]> {
  const key = primaryKeyOf(model)
  const plan = buildOrderedIdQuery(client.sql.public, model, options).build()
  const ids: unknown[] = []

  for await (const row of client.runtime().query(plan)) {
    ids.push(row[key.column])
  }

  return ids
}
