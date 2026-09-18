import { BadUserInputError } from '@/common/utils'
import type { SortClause } from '@/core/pagination/utils/query-spec'

import { columnOf, primaryKeyOf, tableOf } from './contract-meta'
import { rawRows, separators } from './raw-sql'
import type { Db } from './db'
import type { ModelName } from './query-table'

const TEXT = 'pg/text@1'

export type NestedPage = Map<string, string[]>

export type NestedTotals = Map<string, number>

export type NestedTarget = {
  model: ModelName
  foreignKey: string
  parentIds: readonly string[]
}

function orderFragment(
  model: string,
  sort: SortClause[],
  backward: boolean
): string {
  const steps = sort.map((clause) => {
    if (clause.field.relations.length) {
      throw new BadUserInputError(
        `Ordering a nested connection through the relation "${clause.field.name}" is not supported`
      )
    }

    const ascending = (clause.direction === 'ASC') !== backward
    const nullsLast = (clause.nulls === 'last') !== backward

    return `c."${columnOf(model, clause.field.column)}" ${ascending ? 'ASC' : 'DESC'} NULLS ${nullsLast ? 'LAST' : 'FIRST'}`
  })

  return steps.join(', ')
}

export async function selectNestedPage(
  db: Db,
  request: NestedTarget & {
    sort: SortClause[]
    take: number
    backward: boolean
  }
): Promise<NestedPage> {
  const { model, foreignKey, parentIds, sort, take, backward } = request
  const page: NestedPage = new Map(parentIds.map((id) => [id, []]))

  if (!parentIds.length) {
    return page
  }

  const table = tableOf(model)
  const key = primaryKeyOf(model).column
  const foreign = columnOf(model, foreignKey)
  const parts = [
    `SELECT c."${key}", c."${foreign}" FROM unnest(ARRAY[`,
    ...separators(parentIds.length),
    `]::text[]) AS p(id) CROSS JOIN LATERAL (
       SELECT c."${key}", c."${foreign}" FROM "${table}" c
       WHERE c."${foreign}" = p.id
       ORDER BY ${orderFragment(model, sort, backward)}
       LIMIT ${String(take)}
     ) c`
  ]

  for (const row of await rawRows(db, parts, parentIds, {
    [key]: TEXT,
    [foreign]: TEXT
  })) {
    page.get(String(row[foreign]))?.push(String(row[key]))
  }

  return page
}

export async function countNestedRows(
  db: Db,
  target: NestedTarget
): Promise<NestedTotals> {
  const { model, foreignKey, parentIds } = target
  const totals: NestedTotals = new Map(parentIds.map((id) => [id, 0]))

  if (!parentIds.length) {
    return totals
  }

  const foreign = columnOf(model, foreignKey)
  const parts = [
    `SELECT c."${foreign}", count(*)::text AS total FROM "${tableOf(model)}" c WHERE c."${foreign}" IN (`,
    ...separators(parentIds.length),
    `) GROUP BY c."${foreign}"`
  ]

  for (const row of await rawRows(db, parts, parentIds, {
    [foreign]: TEXT,
    total: TEXT
  })) {
    totals.set(String(row[foreign]), Number(row.total))
  }

  return totals
}
