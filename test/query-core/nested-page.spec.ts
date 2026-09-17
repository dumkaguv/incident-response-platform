import { describe, expect, it } from 'vitest'

import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import {
  countNestedRows,
  selectNestedPage
} from '@/core/prisma/utils/nested-page'
import type { QueryDefinition } from '@/core/pagination/utils/query-definition'
import type { Db } from '@/core/prisma/utils/db'

type Statement = { sql: string; values: unknown[] }

const definition: QueryDefinition = {
  name: 'MonitorCheck',
  fields: { id: { type: 'id' }, checkedAt: { type: 'date' } },
  defaultOrderBy: [{ checkedAt: 'DESC' }]
}

function fakeDb(answer: (statement: Statement) => Record<string, unknown>[]): {
  db: Db
  executed: Statement[]
} {
  const executed: Statement[] = []
  const db = {
    raw: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        returnsRow: () => ({
          build: () => ({ sql: strings.join('$'), values })
        })
      })
    },
    runtime: () => ({
      query: (statement: Statement) => {
        executed.push(statement)

        return (function* rows() {
          for (const row of answer(statement)) {
            yield row
          }
        })()
      }
    })
  }

  return { db: db as unknown as Db, executed }
}

describe('selectNestedPage', () => {
  it('takes one limited page per parent through a lateral join and groups the ids', async () => {
    const { db, executed } = fakeDb(() => [
      { id: 'c1', monitor_id: 'm1' },
      { id: 'c2', monitor_id: 'm1' },
      { id: 'c3', monitor_id: 'm2' }
    ])
    const spec = normalizeQuery(definition, { first: 1 })

    const page = await selectNestedPage(db, {
      model: 'MonitorCheck',
      foreignKey: 'monitorId',
      parentIds: ['m1', 'm2', 'm3'],
      sort: spec.sort,
      take: 2,
      backward: false
    })

    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toMatch(/LATERAL/)
    expect(executed[0].sql).toMatch(/LIMIT 2/)
    expect(executed[0].sql).not.toMatch(/row_number|count\(/)
    expect(executed[0].sql).toMatch(
      /ORDER BY c\."checked_at" DESC NULLS FIRST, c\."id" DESC NULLS FIRST/
    )
    expect(executed[0].values).toEqual(['m1', 'm2', 'm3'])
    expect([...page.entries()]).toEqual([
      ['m1', ['c1', 'c2']],
      ['m2', ['c3']],
      ['m3', []]
    ])
  })

  it('runs nothing for an empty parent list', async () => {
    const { db, executed } = fakeDb(() => [])
    const spec = normalizeQuery(definition, {})

    const page = await selectNestedPage(db, {
      model: 'MonitorCheck',
      foreignKey: 'monitorId',
      parentIds: [],
      sort: spec.sort,
      take: 11,
      backward: false
    })

    expect(executed).toEqual([])
    expect(page.size).toBe(0)
  })
})

describe('countNestedRows', () => {
  it('counts per parent in one grouped statement and answers zero for the rest', async () => {
    const { db, executed } = fakeDb(() => [{ monitor_id: 'm1', total: '3' }])

    const totals = await countNestedRows(db, {
      model: 'MonitorCheck',
      foreignKey: 'monitorId',
      parentIds: ['m1', 'm2']
    })

    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toMatch(/count\(\*\)/)
    expect(executed[0].sql).toMatch(/GROUP BY c\."monitor_id"/)
    expect([...totals.entries()]).toEqual([
      ['m1', 3],
      ['m2', 0]
    ])
  })
})
