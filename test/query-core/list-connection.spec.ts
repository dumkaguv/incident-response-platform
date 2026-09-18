import { describe, expect, it, vi } from 'vitest'

import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import { listConnection } from '@/core/prisma/utils/query-table'
import type { QueryDefinition } from '@/core/pagination/utils/query-definition'
import type { Db } from '@/core/prisma/utils/db'

const monitorQuery: QueryDefinition = {
  name: 'ListConnectionMonitor',
  fields: {
    id: { type: 'id', filterable: true, sortable: true },
    name: { type: 'string', filterable: true, sortable: true },
    createdAt: { type: 'date', filterable: true, sortable: true }
  },
  defaultOrderBy: [{ createdAt: 'DESC' }]
}

function fakeDb(total: number, readRows: () => void): Db {
  function rows(): Promise<Record<string, unknown>[]> {
    readRows()

    return Promise.resolve([])
  }
  const table = {
    select: () => table,
    where: () => table,
    orderBy: () => table,
    include: () => table,
    limit: () => ({ all: rows }),
    all: rows,
    aggregate: () => Promise.resolve({ total })
  }

  return { orm: { public: { Monitor: table } } } as unknown as Db
}

describe('listConnection', () => {
  const spec = normalizeQuery(monitorQuery, { first: 5 })

  it('answers a count-only selection without reading the page', async () => {
    const readRows = vi.fn()
    const connection = await listConnection(
      fakeDb(7, readRows),
      'Monitor',
      spec,
      { fields: [], page: false }
    )

    expect(await connection.totalCount).toBe(7)
    expect(readRows).not.toHaveBeenCalled()
    expect(connection.nodes).toEqual([])
  })

  it('reads the page when the selection asks for one', async () => {
    const readRows = vi.fn()

    await listConnection(fakeDb(7, readRows), 'Monitor', spec, {
      fields: [],
      page: true
    })

    expect(readRows).toHaveBeenCalledTimes(1)
  })

  it('reads the page when the caller states no selection', async () => {
    const readRows = vi.fn()

    await listConnection(fakeDb(7, readRows), 'Monitor', spec)

    expect(readRows).toHaveBeenCalledTimes(1)
  })
})
