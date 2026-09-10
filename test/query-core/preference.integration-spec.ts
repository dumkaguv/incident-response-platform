import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  type QueryInput,
  normalizeQuery
} from '@/core/pagination/utils/normalize-query'
import { type Db, createDb } from '@/core/prisma/utils/db'
import { listConnection } from '@/core/prisma/utils/query-table'
import { incidentQuery } from '@/modules/incident/resolvers/incident.query'
import type { OrderByInput } from '@/core/pagination/utils/query-definition'

const ORDER: OrderByInput[] = [{ createdAt: 'DESC' }, { id: 'DESC' }]

describe('preference pins ids to the top', () => {
  let db: Db
  let natural: string[]
  let pinned: string[]
  let expected: string[]

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to the migrated PostgreSQL database')
    }

    db = createDb(url)
    const all = await listConnection(
      db,
      'Incident',
      normalizeQuery(incidentQuery, { first: 100, orderBy: ORDER })
    )

    natural = all.nodes.map((row) => row.id)
    pinned = [natural[6], natural[1], natural[4]]
    expected = [...pinned, ...natural.filter((id) => !pinned.includes(id))]
  })

  afterAll(async () => {
    await db?.close()
  })

  function page(input: QueryInput) {
    return listConnection(
      db,
      'Incident',
      normalizeQuery(incidentQuery, { orderBy: ORDER, ...input })
    )
  }

  async function walkForward(size: number): Promise<string[]> {
    const ids: string[] = []
    let after: string | undefined

    for (let step = 0; step <= natural.length; step++) {
      const connection = await page({ preference: pinned, first: size, after })

      ids.push(...connection.nodes.map((row) => row.id))
      if (!connection.pageInfo.hasNextPage) {
        return ids
      }

      after = connection.pageInfo.endCursor ?? undefined
    }

    throw new Error('Forward pagination did not terminate')
  }

  async function walkBackward(size: number): Promise<string[]> {
    const ids: string[] = []
    let before: string | undefined

    for (let step = 0; step <= natural.length; step++) {
      const connection = await page({ preference: pinned, last: size, before })

      ids.unshift(...connection.nodes.map((row) => row.id))
      if (!connection.pageInfo.hasPreviousPage) {
        return ids
      }

      before = connection.pageInfo.startCursor ?? undefined
    }

    throw new Error('Backward pagination did not terminate')
  }

  it('puts the pinned ids first, in the order they were given', async () => {
    const connection = await page({ preference: pinned, first: 100 })

    expect(connection.nodes.map((row) => row.id)).toEqual(expected)
    expect(natural.length).toBeGreaterThan(pinned.length)
  })

  it('leaves the order untouched when nothing is pinned', async () => {
    const connection = await page({ preference: [], first: 100 })

    expect(connection.nodes.map((row) => row.id)).toEqual(natural)
  })

  it('ignores an id that matches no row', async () => {
    const connection = await page({
      preference: ['00000000-0000-0000-0000-000000000000', pinned[0]],
      first: 100
    })

    expect(connection.nodes.map((row) => row.id)).toEqual([
      pinned[0],
      ...natural.filter((id) => id !== pinned[0])
    ])
  })

  it('does not pin a row the filter excludes', async () => {
    const excluded = pinned[0]
    const connection = await page({
      preference: pinned,
      filter: { not: { id: { eq: excluded } } },
      first: 100
    })

    expect(connection.nodes.map((row) => row.id)).not.toContain(excluded)
    expect(connection.nodes.map((row) => row.id)).toEqual(
      expected.filter((id) => id !== excluded)
    )
  })

  it('paginates across the pinned boundary without gaps or repeats', async () => {
    const forward = await walkForward(2)

    expect(forward).toEqual(expected)
    expect(new Set(forward).size).toBe(expected.length)
  })

  it('walks backward to the same sequence', async () => {
    const backward = await walkBackward(2)

    expect(backward).toEqual(expected)
  })

  it('rejects a cursor when the preference changes mid-walk', async () => {
    const first = await page({ preference: pinned, first: 2 })
    const cursor = first.pageInfo.endCursor

    expect(() =>
      normalizeQuery(incidentQuery, {
        orderBy: ORDER,
        preference: [...pinned].reverse(),
        first: 2,
        after: cursor
      })
    ).toThrow('Invalid pagination cursor')
  })

  it('counts every matching row, pinned or not', async () => {
    const connection = await page({ preference: pinned, first: 2 })

    expect(await connection.totalCount).toBe(natural.length)
  })
})
