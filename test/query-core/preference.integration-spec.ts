import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import { type Db, createDb } from '@/core/prisma/utils/db'
import { listConnection } from '@/core/prisma/utils/query-table'
import { monitorQuery } from '@/modules/monitor/resolvers/monitor/monitor.query'
import type { QueryInput } from '@/core/pagination/utils/normalize-query'

const ABSENT = randomUUID()

describe('a preference page against PostgreSQL', () => {
  const prefix = `preference-${randomUUID()}`
  const idsByName = new Map<string, string>()
  let db: Db

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to a migrated PostgreSQL database')
    }

    db = createDb(url)
    await db.connect()

    for (const name of ['alpha', 'bravo', 'charlie', 'delta', 'echo']) {
      const monitor = await db.orm.public.Monitor.create({
        name: `${prefix} ${name}`,
        url: 'https://example.com'
      })

      idsByName.set(name, monitor.id)
    }
  })

  afterAll(async () => {
    await db.orm.public.Monitor.where((fields) =>
      fields.id.in([...idsByName.values()])
    ).deleteAll()
    await db.close()
  })

  function id(name: string): string {
    const found = idsByName.get(name)

    if (!found) {
      throw new Error(`No fixture monitor named ${name}`)
    }

    return found
  }

  async function page(input: QueryInput) {
    const connection = await listConnection(
      db,
      'Monitor',
      normalizeQuery(monitorQuery, {
        filter: { name: { startsWith: prefix } },
        orderBy: [{ name: 'ASC' }],
        preference: [id('delta'), id('bravo'), ABSENT],
        ...input
      })
    )

    return {
      names: connection.nodes.map((row) => row.name.slice(prefix.length + 1)),
      pageInfo: connection.pageInfo,
      total: await connection.totalCount
    }
  }

  it('lists the pinned rows first, in the order given, then the rest in order', async () => {
    const whole = await page({ first: 10 })

    expect(whole.names).toEqual(['delta', 'bravo', 'alpha', 'charlie', 'echo'])
    expect(whole.total).toBe(5)
    expect(whole.pageInfo.hasNextPage).toBe(false)
  })

  it('walks forward and backward across the pinned boundary without gaps or repeats', async () => {
    const forward: string[] = []
    let after: string | undefined

    for (let step = 0; step < 5; step += 1) {
      const current = await page({ first: 2, after })

      forward.push(...current.names)
      if (!current.pageInfo.hasNextPage) {
        break
      }

      after = current.pageInfo.endCursor ?? undefined
    }

    const backward: string[] = []
    let before: string | undefined

    for (let step = 0; step < 5; step += 1) {
      const current = await page({ last: 2, before })

      backward.unshift(...current.names)
      if (!current.pageInfo.hasPreviousPage) {
        break
      }

      before = current.pageInfo.startCursor ?? undefined
    }

    expect(forward).toEqual(['delta', 'bravo', 'alpha', 'charlie', 'echo'])
    expect(backward).toEqual(forward)
  })
})
