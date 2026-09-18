import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import { type Db, createDb } from '@/core/prisma/utils/db'
import { listConnection } from '@/core/prisma/utils/query-table'
import type { QueryDefinition } from '@/core/pagination/utils/query-definition'

const checkQuery: QueryDefinition = {
  name: 'LaneRefetchCheck',
  fields: {
    id: { type: 'id', filterable: true, sortable: true },
    status: {
      type: 'enum',
      enum: { name: 'MonitorStatus', values: { UP: 'UP', DOWN: 'DOWN' } },
      filterable: true,
      sortable: true
    },
    checkedAt: { type: 'date', filterable: true, sortable: true },
    monitor: {
      type: 'relation',
      field: 'monitor',
      fields: {
        id: { type: 'id', filterable: true, sortable: true },
        name: { type: 'string', filterable: true, sortable: true }
      }
    }
  },
  defaultOrderBy: [{ checkedAt: 'DESC' }]
}

function afterIdsRead(db: Db, run: () => Promise<void>): Db {
  let fired = false

  return new Proxy(db, {
    get(target, key, receiver) {
      if (key !== 'runtime') {
        return Reflect.get(target, key, receiver)
      }

      return () => {
        const runtime = target.runtime()

        return new Proxy(runtime, {
          get(source, name, inner) {
            if (name !== 'query') {
              return Reflect.get(source, name, inner)
            }

            return (plan: never) => ({
              async *[Symbol.asyncIterator]() {
                for await (const row of source.query(plan)) {
                  yield row
                }

                if (!fired) {
                  fired = true
                  await run()
                }
              }
            })
          }
        })
      }
    }
  })
}

describe('the SQL lane reads rows that still match the filter', () => {
  const prefix = `lane-refetch-${randomUUID()}`
  const monitorIds: string[] = []
  let db: Db
  let movedCheckId: string

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to a migrated PostgreSQL database')
    }

    db = createDb(url)
    await db.connect()

    for (const suffix of ['alpha', 'bravo']) {
      const monitor = await db.orm.public.Monitor.create({
        name: `${prefix} ${suffix}`,
        url: 'https://example.com'
      })

      monitorIds.push(monitor.id)

      const check = await db.orm.public.MonitorCheck.create({
        monitorId: monitor.id,
        status: 'UP'
      })

      if (suffix === 'alpha') {
        movedCheckId = check.id
      }
    }
  })

  afterAll(async () => {
    await db.orm.public.Monitor.where((fields) =>
      fields.id.in(monitorIds)
    ).deleteAll()
    await db.close()
  })

  it('reads a page through the relation ordering lane', async () => {
    const connection = await listConnection(
      db,
      'MonitorCheck',
      normalizeQuery(checkQuery, {
        first: 50,
        filter: {
          status: { eq: 'UP' },
          monitor: { name: { startsWith: prefix } }
        },
        orderBy: [{ monitor: { name: 'ASC' } }]
      })
    )

    expect(connection.nodes).toHaveLength(2)
  })

  it('drops a row that stopped matching between the id read and the row read', async () => {
    const racing = afterIdsRead(db, async () => {
      await db.orm.public.MonitorCheck.where((fields) =>
        fields.id.eq(movedCheckId)
      ).updateAll({ status: 'DOWN' })
    })

    const connection = await listConnection(
      racing,
      'MonitorCheck',
      normalizeQuery(checkQuery, {
        first: 50,
        filter: {
          status: { eq: 'UP' },
          monitor: { name: { startsWith: prefix } }
        },
        orderBy: [{ monitor: { name: 'ASC' } }]
      })
    )

    expect(connection.nodes.map((row) => row.status)).toEqual(['UP'])
    expect(connection.nodes.map((row) => row.id)).not.toContain(movedCheckId)
  })
})
