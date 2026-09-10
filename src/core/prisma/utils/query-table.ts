import { Connection } from '@/core/pagination'
import { keysetFilter } from '@/core/pagination/utils/query-cursor'
import type { QuerySpec } from '@/core/pagination/utils/query-spec'

import type { FieldOutputTypes } from '../contract'

import { modelFields, primaryKeyOf, relationLocalFields } from './contract-meta'
import { collectJoinPaths } from './relation-path'
import {
  type OrderStep,
  type SqlLaneClient,
  orderSteps,
  requiresSqlLane,
  selectOrderedIds
} from './relation-query'
import { filterToPrisma, specToPrisma } from './spec-to-prisma'
import {
  type Expr,
  type FieldBag,
  type Order,
  orderPlanToSteps,
  orderSelector,
  whereToExpr
} from './where-to-expr'
import type { Db } from './db'

export type ModelName = keyof FieldOutputTypes['public']

export type RowOf<M extends ModelName> = FieldOutputTypes['public'][M]

type Row = Record<string, unknown>

type AnyTable = {
  select(...fields: string[]): AnyTable
  where(build: (fields: FieldBag) => Expr): AnyTable
  orderBy(build: (fields: FieldBag) => Order): AnyTable
  include(relation: string): AnyTable
  limit(count: number): { all(): Promise<Row[]> }
  all(): Promise<Row[]>
  aggregate(
    build: (aggregate: { count(): unknown }) => { total: unknown }
  ): Promise<{ total: unknown }>
}

function tableOf(db: Db, model: ModelName): AnyTable {
  return db.orm.public[model] as unknown as AnyTable
}

export function projectionFor(
  model: ModelName,
  spec: QuerySpec,
  requested: readonly string[] | undefined
): string[] | undefined {
  if (!requested?.length) {
    return undefined
  }

  const known = new Set(modelFields(model))
  const fields = new Set<string>([primaryKeyOf(model).field])

  for (const name of requested) {
    if (known.has(name)) {
      fields.add(name)
      continue
    }

    for (const local of relationLocalFields(model, name)) {
      fields.add(local)
    }
  }

  for (const clause of spec.sort) {
    if (!clause.field.relations.length) {
      fields.add(clause.field.column)
    }
  }

  return [...fields]
}

function project(table: AnyTable, fields: string[] | undefined): AnyTable {
  return fields ? table.select(...fields) : table
}

export async function countRows(
  db: Db,
  model: ModelName,
  where: Record<string, unknown>
): Promise<number> {
  const result = await tableOf(db, model)
    .where((fields) => whereToExpr(fields, where))
    .aggregate((aggregate) => ({ total: aggregate.count() }))

  return Number(result.total)
}

async function listDirect(
  table: AnyTable,
  where: Record<string, unknown>,
  orderBy: readonly Record<string, unknown>[],
  take: number
): Promise<Row[]> {
  let query = table.where((fields) => whereToExpr(fields, where))

  for (const step of orderPlanToSteps(orderBy)) {
    query = query.orderBy((fields) => orderSelector(fields, step))
  }

  return query.limit(take).all()
}

function selectIds(
  db: Db,
  model: ModelName,
  spec: QuerySpec,
  where: Record<string, unknown>,
  order: OrderStep[],
  take: number
): Promise<unknown[]> {
  return selectOrderedIds(db as unknown as SqlLaneClient, model, {
    where,
    order,
    paths: collectJoinPaths(model, spec.sort, where),
    take
  })
}

function pinnedInScanOrder(spec: QuerySpec, backward: boolean): string[] {
  const { ids } = spec.preference
  const rank = spec.pagination.values?.[0] as number | null | undefined

  if (backward) {
    return rank === undefined || rank === null
      ? [...ids].reverse()
      : ids.slice(0, rank).reverse()
  }

  if (rank === undefined) {
    return [...ids]
  }

  return rank === null ? [] : ids.slice(rank + 1)
}

async function listPinnedThenRest(
  db: Db,
  model: ModelName,
  spec: QuerySpec,
  filterWhere: Record<string, unknown>,
  take: number
): Promise<unknown[]> {
  const backward = spec.pagination.direction === 'backward'
  const { field, ids } = spec.preference
  const rank = spec.pagination.values?.[0] as number | null | undefined
  const candidates = pinnedInScanOrder(spec, backward)
  const restIsBehind = backward && typeof rank === 'number'

  async function pinned(limit: number): Promise<unknown[]> {
    if (!candidates.length || limit <= 0) {
      return []
    }

    const found = new Set(
      await selectIds(
        db,
        model,
        spec,
        { AND: [filterWhere, { [field]: { in: candidates } }] },
        [],
        candidates.length
      )
    )

    return candidates.filter((id) => found.has(id)).slice(0, limit)
  }

  async function rest(limit: number): Promise<unknown[]> {
    if (restIsBehind || limit <= 0) {
      return []
    }

    const unranked = { field, ids: [] }
    const cursor = spec.pagination.values
    const keyset =
      cursor?.[0] === null
        ? [
            filterToPrisma(
              keysetFilter(spec.sort, cursor.slice(1), backward, unranked)
            )
          ]
        : []

    return selectIds(
      db,
      model,
      spec,
      { AND: [filterWhere, { [field]: { notIn: ids } }, ...keyset] },
      orderSteps(model, spec.sort, backward, unranked),
      limit
    )
  }

  const leading = backward ? await rest(take) : await pinned(take)
  const trailing = backward
    ? await pinned(take - leading.length)
    : await rest(take - leading.length)

  return [...leading, ...trailing]
}

async function listThroughSqlLane(
  db: Db,
  model: ModelName,
  spec: QuerySpec,
  where: Record<string, unknown>,
  countWhere: Record<string, unknown>,
  take: number,
  fields: string[] | undefined
): Promise<Row[]> {
  const backward = spec.pagination.direction === 'backward'
  const key = primaryKeyOf(model)
  const ids = spec.preference.ids.length
    ? await listPinnedThenRest(db, model, spec, countWhere, take)
    : await selectIds(
        db,
        model,
        spec,
        where,
        orderSteps(model, spec.sort, backward, spec.preference),
        take
      )

  if (!ids.length) {
    return []
  }

  let table = project(tableOf(db, model), fields)

  for (const relation of new Set(
    collectJoinPaths(model, spec.sort, where).map((path) => path[0])
  )) {
    table = table.include(relation)
  }

  const rows = await table
    .where((fields) => whereToExpr(fields, { [key.field]: { in: ids } }))
    .all()
  const byId = new Map(rows.map((row) => [row[key.field], row]))

  return ids.map((id) => byId.get(id)).filter((row) => row !== undefined)
}

export async function listConnection<M extends ModelName>(
  db: Db,
  model: M,
  spec: QuerySpec,
  requested?: readonly string[]
): Promise<Connection<RowOf<M>>> {
  const { args, countWhere } = specToPrisma(spec)
  const fields = projectionFor(model, spec, requested)
  const rows = requiresSqlLane(spec.sort, spec.preference)
    ? await listThroughSqlLane(
        db,
        model,
        spec,
        args.where,
        countWhere,
        args.take,
        fields
      )
    : await listDirect(
        project(tableOf(db, model), fields),
        args.where,
        args.orderBy,
        args.take
      )

  return new Connection(rows as RowOf<M>[], spec, () =>
    countRows(db, model, countWhere)
  )
}
