import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import { type Db, createDb } from '@/core/prisma/utils/db'
import { listConnection } from '@/core/prisma/utils/query-table'
import type { QueryInput } from '@/core/pagination/utils/normalize-query'
import type { QueryDefinition } from '@/core/pagination/utils/query-definition'

const SCHEDULED_AT = '2030-01-01T00:00:00.000Z'

const checkQuery: QueryDefinition = {
  name: 'LaneParityCheck',
  fields: {
    id: { type: 'id', filterable: true, sortable: true },
    checkedAt: { type: 'date', filterable: true, sortable: true },
    monitor: {
      type: 'relation',
      field: 'monitor',
      fields: {
        id: { type: 'id', filterable: true, sortable: true },
        name: { type: 'string', filterable: true, sortable: true },
        nextCheckAt: {
          type: 'date',
          nullable: true,
          filterable: true,
          sortable: true
        }
      }
    }
  },
  defaultOrderBy: [{ checkedAt: 'DESC' }]
}

describe('the two query lanes agree on relation filters', () => {
  const prefix = `lane-parity-${randomUUID()}`
  const monitorIds: string[] = []
  let db: Db

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to a migrated PostgreSQL database')
    }

    db = createDb(url)
    await db.connect()

    for (const [suffix, nextCheckAt] of [
      ['scheduled', SCHEDULED_AT],
      ['unscheduled', null]
    ] as const) {
      const monitor = await db.orm.public.Monitor.create({
        name: `${prefix} ${suffix}`,
        url: 'https://example.com',
        nextCheckAt
      })

      monitorIds.push(monitor.id)
      for (let index = 0; index < 2; index += 1) {
        await db.orm.public.MonitorCheck.create({
          monitorId: monitor.id,
          status: 'UP'
        })
      }
    }
  })

  afterAll(async () => {
    await db.orm.public.Monitor.where((fields) =>
      fields.id.in(monitorIds)
    ).deleteAll()
    await db.close()
  })

  async function pageIds(
    input: QueryInput
  ): Promise<{ ids: string[]; total: number }> {
    const connection = await listConnection(
      db,
      'MonitorCheck',
      normalizeQuery(checkQuery, { first: 50, ...input })
    )

    return {
      ids: connection.nodes.map((row) => row.id).sort(),
      total: await connection.totalCount
    }
  }

  it('keeps rows whose related NULL column fails a negated equality', async () => {
    const filter = {
      monitor: { name: { startsWith: prefix } },
      not: { monitor: { nextCheckAt: { eq: SCHEDULED_AT } } }
    }
    const viaOrm = await pageIds({ filter })
    const viaSql = await pageIds({
      filter,
      orderBy: [{ monitor: { name: 'ASC' } }]
    })

    expect(viaOrm.ids).toHaveLength(2)
    expect(viaSql.ids).toEqual(viaOrm.ids)
    expect(viaSql.total).toBe(viaOrm.total)
  })

  it('answers a null check on the related column the same way in both lanes', async () => {
    const filter = {
      monitor: { name: { startsWith: prefix }, nextCheckAt: { is: 'NULL' } }
    }
    const viaOrm = await pageIds({ filter })
    const viaSql = await pageIds({
      filter,
      orderBy: [{ monitor: { nextCheckAt: 'AscNullsFirst' } }]
    })

    expect(viaOrm.ids).toHaveLength(2)
    expect(viaSql.ids).toEqual(viaOrm.ids)
  })
})
