import type { SortClause } from '@/core/pagination/utils/query-spec'

import { columnOf, primaryKeyOf, tableOf } from './contract-meta'
import type { Db } from './db'
import type { ModelName } from './query-table'

const TEXT = 'pg/text@1'

type Rows = AsyncIterable<Record<string, unknown>>

export type NestedPage = {
  ids: Map<string, string[]>
  totals: Map<string, number>
}

function orderFragment(
  model: string,
  sort: SortClause[],
  backward: boolean
): string {
  const steps = sort.map((clause) => {
    if (clause.field.relations.length) {
      throw new Error(
        `Ordering a nested connection through the relation "${clause.field.name}" is not supported`
      )
    }

    const ascending = (clause.direction === 'ASC') !== backward
    const nullsLast = (clause.nulls === 'last') !== backward

    return `c."${columnOf(model, clause.field.column)}" ${ascending ? 'ASC' : 'DESC'} NULLS ${nullsLast ? 'LAST' : 'FIRST'}`
  })

  return steps.join(', ')
}

function placeholders(count: number): string[] {
  return Array.from({ length: count }, () => '')
}

function tagged(parts: string[]): TemplateStringsArray {
  return Object.assign(parts.slice(), { raw: parts.slice() })
}

async function collect(rows: Rows): Promise<Record<string, unknown>[]> {
  const collected: Record<string, unknown>[] = []

  for await (const row of rows) {
    collected.push(row)
  }

  return collected
}

export async function selectNestedPage(
  db: Db,
  request: {
    model: ModelName
    foreignKey: string
    parentIds: readonly string[]
    sort: SortClause[]
    take: number
    backward: boolean
  }
): Promise<NestedPage> {
  const { model, foreignKey, parentIds, sort, take, backward } = request
  const ids = new Map<string, string[]>()
  const totals = new Map<string, number>()

  for (const parentId of parentIds) {
    ids.set(parentId, [])
    totals.set(parentId, 0)
  }

  if (!parentIds.length) {
    return { ids, totals }
  }

  const table = tableOf(model)
  const key = primaryKeyOf(model).column
  const foreign = columnOf(model, foreignKey)
  const list = placeholders(parentIds.length).map((_, index) =>
    index === 0 ? '' : ', '
  )
  const pageParts = [
    `SELECT t."${key}", t."${foreign}" FROM (
       SELECT c."${key}", c."${foreign}",
              row_number() OVER (
                PARTITION BY c."${foreign}"
                ORDER BY ${orderFragment(model, sort, backward)}
              ) AS position
       FROM "${table}" c
       WHERE c."${foreign}" IN (`,
    ...list.slice(1),
    `)) t WHERE t.position <= ${String(take)}`
  ]
  const countParts = [
    `SELECT c."${foreign}", count(*)::text AS total
     FROM "${table}" c
     WHERE c."${foreign}" IN (`,
    ...list.slice(1),
    `) GROUP BY c."${foreign}"`
  ]

  const page = await collect(
    db.runtime().query(
      db.raw
        .sql(tagged(pageParts), ...parentIds)
        .returnsRow({ [key]: TEXT, [foreign]: TEXT })
        .build()
    )
  )

  for (const row of page) {
    const parentId = String(row[foreign])

    ids.get(parentId)?.push(String(row[key]))
  }

  const counts = await collect(
    db.runtime().query(
      db.raw
        .sql(tagged(countParts), ...parentIds)
        .returnsRow({ [foreign]: TEXT, total: TEXT })
        .build()
    )
  )

  for (const row of counts) {
    totals.set(String(row[foreign]), Number(row.total))
  }

  return { ids, totals }
}
