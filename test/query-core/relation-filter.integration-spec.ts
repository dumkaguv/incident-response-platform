import 'dotenv/config'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  type QueryInput,
  normalizeQuery
} from '@/core/pagination/utils/normalize-query'
import { type Db, createDb } from '@/core/prisma/utils/db'
import { listConnection } from '@/core/prisma/utils/query-table'
import { incidentQuery } from '@/modules/incident/resolvers/incident.query'

const RELATION_SORT: QueryInput['orderBy'] = [
  { team: { name: 'ASC' } },
  { id: 'ASC' }
]

describe('filtering through a to-many relation', () => {
  let sql: Client
  let db: Db

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to the migrated PostgreSQL database')
    }

    sql = new Client({ connectionString: url, connectionTimeoutMillis: 5000 })
    await sql.connect()
    db = createDb(url)
  })

  afterAll(async () => {
    await db?.close()
    await sql?.end()
  })

  function page(input: QueryInput) {
    return listConnection(
      db,
      'Incident',
      normalizeQuery(incidentQuery, { first: 100, ...input })
    )
  }

  async function idsMatching(predicate: string): Promise<string[]> {
    const result = await sql.query<{ id: string }>(`
      SELECT i.id FROM incident i
      LEFT JOIN team t ON t.id = i.team_id
      WHERE ${predicate}
      ORDER BY t.name ASC, i.id ASC
    `)

    return result.rows.map((row) => row.id)
  }

  const memberIsLead =
    "SELECT 1 FROM team_member m WHERE m.team_id = t.id AND m.role = 'LEAD'"

  it('matches PostgreSQL for some', async () => {
    const expected = await idsMatching(`EXISTS (${memberIsLead})`)
    const connection = await page({
      orderBy: RELATION_SORT,
      filter: { team: { members: { some: { role: { eq: 'LEAD' } } } } }
    })

    expect(connection.nodes.map((row) => row.id)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('matches PostgreSQL for none', async () => {
    const expected = await idsMatching(`NOT EXISTS (${memberIsLead})`)
    const connection = await page({
      orderBy: RELATION_SORT,
      filter: { team: { members: { none: { role: { eq: 'LEAD' } } } } }
    })

    expect(connection.nodes.map((row) => row.id)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('matches PostgreSQL for every, which holds for a team with no members', async () => {
    const expected = await idsMatching(
      "NOT EXISTS (SELECT 1 FROM team_member m WHERE m.team_id = t.id AND NOT (m.role = 'LEAD'))"
    )
    const connection = await page({
      orderBy: RELATION_SORT,
      filter: { team: { members: { every: { role: { eq: 'LEAD' } } } } }
    })

    expect(connection.nodes.map((row) => row.id)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('answers the same to-many filter identically in both lanes', async () => {
    const filter = { team: { members: { some: { role: { eq: 'LEAD' } } } } }
    const ormLane = await page({ filter, orderBy: [{ createdAt: 'DESC' }] })
    const sqlLane = await page({
      filter,
      orderBy: [{ resolvedAt: 'AscNullsFirst' }]
    })

    expect(new Set(sqlLane.nodes.map((row) => row.id))).toEqual(
      new Set(ormLane.nodes.map((row) => row.id))
    )
    expect(await sqlLane.totalCount).toBe(await ormLane.totalCount)
    expect(ormLane.nodes.length).toBeGreaterThan(0)
  })

  it('searches through the to-many relation', async () => {
    const member = await sql.query<{ name: string }>(
      'SELECT name FROM team_member ORDER BY name LIMIT 1'
    )
    const term = member.rows[0].name.split(' ')[0]
    const expected = await idsMatching(`
      i.title ILIKE '%${term}%' OR i.description ILIKE '%${term}%'
      OR t.name ILIKE '%${term}%'
      OR EXISTS (SELECT 1 FROM team_member m
                 WHERE m.team_id = t.id AND m.name ILIKE '%${term}%')
    `)
    const connection = await page({ search: term, orderBy: RELATION_SORT })

    expect(connection.nodes.map((row) => row.id)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('refuses to order through a to-many relation', () => {
    expect(() =>
      normalizeQuery(incidentQuery, {
        orderBy: [{ team: { members: { name: 'ASC' } } }]
      })
    ).toThrow()
  })
})
