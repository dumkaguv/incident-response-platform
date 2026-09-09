import { Connection } from '@/core/pagination'
import type { QuerySpec } from '@/core/pagination/utils/query-spec'

import type { FieldOutputTypes } from '../contract'

import {
  type SqlLaneClient,
  modelFields,
  primaryKeyOf,
  relationLocalFields,
  relationNames,
  orderSteps,
  requiresSqlLane,
  selectOrderedIds
} from './relation-query'
import { specToPrisma } from './spec-to-prisma'
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

async function listThroughSqlLane(
  db: Db,
  model: ModelName,
  spec: QuerySpec,
  where: Record<string, unknown>,
  take: number,
  fields: string[] | undefined
): Promise<Row[]> {
  const relations = relationNames(model, spec.sort, where)
  const backward = spec.pagination.direction === 'backward'
  const key = primaryKeyOf(model)
  const ids = await selectOrderedIds(db as unknown as SqlLaneClient, model, {
    where,
    order: orderSteps(model, spec.sort, backward),
    relations,
    take
  })

  if (!ids.length) {
    return []
  }

  let table = project(tableOf(db, model), fields)

  for (const relation of relations) {
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
  const rows = requiresSqlLane(spec.sort)
    ? await listThroughSqlLane(db, model, spec, args.where, args.take, fields)
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
