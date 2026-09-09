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
import type { OrderByInput } from '@/core/pagination/utils/query-definition'

const PREFIX = 'zz-ord-'
const SCOPED: QueryInput['filter'] = { title: { startsWith: PREFIX } }
const SEVERITY_ORDER =
  "array_position(ARRAY['LOW','MEDIUM','HIGH','CRITICAL']::text[], i.severity)"
const STATUS_ORDER =
  "array_position(ARRAY['OPEN','INVESTIGATING','RESOLVED','CLOSED']::text[], i.status)"

const teams = [
  {
    id: 'zz-ord-team-1',
    name: 'Zeta Ord',
    slug: 'zz-ord-zeta',
    description: 'storage'
  },
  {
    id: 'zz-ord-team-2',
    name: 'Alpha Ord',
    slug: 'zz-ord-alpha',
    description: null
  },
  {
    id: 'zz-ord-team-3',
    name: 'Alpha Ord',
    slug: 'zz-ord-alpha-2',
    description: 'billing'
  },
  {
    id: 'zz-ord-team-4',
    name: 'Mid Ord',
    slug: 'zz-ord-mid',
    description: null
  }
]

const incidents = [
  [
    'zz-ord-01',
    'shared window',
    'OPEN',
    'CRITICAL',
    '2026-03-01T00:00:00Z',
    null,
    'zz-ord-team-1'
  ],
  [
    'zz-ord-02',
    null,
    'INVESTIGATING',
    'HIGH',
    '2026-03-01T00:00:00Z',
    '2026-04-01T00:00:00Z',
    'zz-ord-team-2'
  ],
  [
    'zz-ord-03',
    'shared window',
    'RESOLVED',
    'LOW',
    '2026-03-02T00:00:00Z',
    '2026-04-01T00:00:00Z',
    'zz-ord-team-3'
  ],
  ['zz-ord-04', null, 'CLOSED', 'MEDIUM', '2026-03-02T00:00:00Z', null, null],
  [
    'zz-ord-05',
    'alpha note',
    'OPEN',
    'HIGH',
    '2026-03-03T00:00:00Z',
    '2026-04-02T00:00:00Z',
    'zz-ord-team-4'
  ],
  [
    'zz-ord-06',
    'beta note',
    'INVESTIGATING',
    'CRITICAL',
    '2026-03-03T00:00:00Z',
    null,
    'zz-ord-team-1'
  ],
  [
    'zz-ord-07',
    null,
    'RESOLVED',
    'LOW',
    '2026-03-04T00:00:00Z',
    '2026-04-03T00:00:00Z',
    null
  ],
  [
    'zz-ord-08',
    'gamma note',
    'OPEN',
    'MEDIUM',
    '2026-03-04T00:00:00Z',
    null,
    'zz-ord-team-2'
  ],
  [
    'zz-ord-09',
    'shared window',
    'CLOSED',
    'HIGH',
    '2026-03-05T00:00:00Z',
    '2026-04-01T00:00:00Z',
    'zz-ord-team-3'
  ],
  [
    'zz-ord-10',
    null,
    'OPEN',
    'LOW',
    '2026-03-05T00:00:00Z',
    null,
    'zz-ord-team-4'
  ],
  [
    'zz-ord-11',
    'delta note',
    'INVESTIGATING',
    'CRITICAL',
    '2026-03-06T00:00:00Z',
    '2026-04-02T00:00:00Z',
    'zz-ord-team-1'
  ],
  [
    'zz-ord-12',
    'omega note',
    'RESOLVED',
    'MEDIUM',
    '2026-03-06T00:00:00Z',
    null,
    null
  ]
] as const

describe('contract-backed ordering against PostgreSQL', () => {
  let sql: Client
  let db: Db

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to the migrated PostgreSQL database')
    }

    sql = new Client({ connectionString: url, connectionTimeoutMillis: 5000 })
    await sql.connect()
    await sql.query('DELETE FROM incident WHERE title LIKE $1', [`${PREFIX}%`])
    await sql.query('DELETE FROM team WHERE id LIKE $1', [`${PREFIX}team-%`])

    for (const team of teams) {
      await sql.query(
        'INSERT INTO team (id, name, slug, description, created_at, updated_at) VALUES ($1, $2, $3, $4, now(), now())',
        [team.id, team.name, team.slug, team.description]
      )
    }

    for (const [
      title,
      description,
      status,
      severity,
      createdAt,
      resolvedAt,
      teamId
    ] of incidents) {
      await sql.query(
        `INSERT INTO incident (id, title, description, status, severity, created_at, updated_at, resolved_at, team_id)
         VALUES ($1, $1, $2, $3, $4, $5, $5, $6, $7)`,
        [title, description, status, severity, createdAt, resolvedAt, teamId]
      )
    }

    db = createDb(url)
  })

  afterAll(async () => {
    await db?.close()
    await sql?.query('DELETE FROM incident WHERE title LIKE $1', [`${PREFIX}%`])
    await sql?.query('DELETE FROM team WHERE id LIKE $1', [`${PREFIX}team-%`])
    await sql?.end()
  })

  function page(input: QueryInput) {
    return listConnection(
      db,
      'Incident',
      normalizeQuery(incidentQuery, { ...input, filter: SCOPED })
    )
  }

  async function expectedIds(sqlOrder: string): Promise<string[]> {
    const result = await sql.query<{ id: string }>(`
      SELECT i.id FROM incident i
      LEFT JOIN team t ON t.id = i.team_id
      WHERE i.title LIKE '${PREFIX}%'
      ORDER BY ${sqlOrder}, i.id ASC
    `)

    return result.rows.map((row) => row.id)
  }

  async function walkForward(
    orderBy: OrderByInput[],
    size: number
  ): Promise<string[]> {
    const ids: string[] = []
    let after: string | undefined

    for (let iteration = 0; iteration <= incidents.length; iteration++) {
      const connection = await page({ orderBy, first: size, after })

      ids.push(...connection.nodes.map((row) => row.id))
      if (!connection.pageInfo.hasNextPage) {
        return ids
      }

      after = connection.pageInfo.endCursor ?? undefined
    }

    throw new Error('Forward pagination did not terminate')
  }

  async function walkBackward(
    orderBy: OrderByInput[],
    size: number
  ): Promise<string[]> {
    const ids: string[] = []
    let before: string | undefined

    for (let iteration = 0; iteration <= incidents.length; iteration++) {
      const connection = await page({ orderBy, last: size, before })

      ids.unshift(...connection.nodes.map((row) => row.id))
      if (!connection.pageInfo.hasPreviousPage) {
        return ids
      }

      before = connection.pageInfo.startCursor ?? undefined
    }

    throw new Error('Backward pagination did not terminate')
  }

  const cases: { name: string; orderBy: OrderByInput[]; sqlOrder: string }[] = [
    {
      name: 'relation only',
      orderBy: [{ team: { name: 'ASC' } }],
      sqlOrder: 't.name ASC'
    },
    {
      name: 'relation then mapped column',
      orderBy: [{ team: { name: 'ASC' } }, { createdAt: 'DESC' }],
      sqlOrder: 't.name ASC, i.created_at DESC'
    },
    {
      name: 'relation then nullable mapped column',
      orderBy: [{ team: { name: 'ASC' } }, { resolvedAt: 'AscNullsLast' }],
      sqlOrder: 't.name ASC, i.resolved_at ASC NULLS LAST'
    },
    {
      name: 'relation then every remaining mapped column',
      orderBy: [
        { team: { name: 'ASC' } },
        { resolvedAt: 'AscNullsLast' },
        { severity: 'DESC' },
        { status: 'ASC' },
        { createdAt: 'DESC' },
        { updatedAt: 'DESC' },
        { title: 'ASC' }
      ],
      sqlOrder: `t.name ASC, i.resolved_at ASC NULLS LAST, ${SEVERITY_ORDER} DESC, ${STATUS_ORDER} ASC, i.created_at DESC, i.updated_at DESC, i.title ASC`
    },
    {
      name: 'relation with a null placement of its own',
      orderBy: [
        { team: { description: 'AscNullsFirst' } },
        { team: { name: 'DESC' } },
        { createdAt: 'DESC' }
      ],
      sqlOrder: 't.description ASC NULLS FIRST, t.name DESC, i.created_at DESC'
    },
    {
      name: 'non-null column through an absent relation',
      orderBy: [{ team: { name: 'AscNullsFirst' } }, { createdAt: 'ASC' }],
      sqlOrder: 't.name ASC NULLS FIRST, i.created_at ASC'
    },
    {
      name: 'big multi-sort with a deep tuple',
      orderBy: [
        { resolvedAt: 'DescNullsLast' },
        { severity: 'DESC' },
        { createdAt: 'DESC' },
        { title: 'ASC' }
      ],
      sqlOrder: `i.resolved_at DESC NULLS LAST, ${SEVERITY_ORDER} DESC, i.created_at DESC, i.title ASC`
    }
  ]

  for (const direction of [
    'ASC',
    'DESC',
    'AscNullsFirst',
    'AscNullsLast',
    'DescNullsFirst',
    'DescNullsLast'
  ] as const) {
    const sqlDirection = {
      ASC: 'ASC NULLS LAST',
      DESC: 'DESC NULLS FIRST',
      AscNullsFirst: 'ASC NULLS FIRST',
      AscNullsLast: 'ASC NULLS LAST',
      DescNullsFirst: 'DESC NULLS FIRST',
      DescNullsLast: 'DESC NULLS LAST'
    }[direction]

    cases.push({
      name: `resolvedAt ${direction}`,
      orderBy: [{ resolvedAt: direction }],
      sqlOrder: `i.resolved_at ${sqlDirection}`
    })
    cases.push({
      name: `description ${direction}`,
      orderBy: [{ description: direction }, { createdAt: 'DESC' }],
      sqlOrder: `i.description ${sqlDirection}, i.created_at DESC`
    })
    cases.push({
      name: `team.description ${direction}`,
      orderBy: [{ team: { description: direction } }, { createdAt: 'DESC' }],
      sqlOrder: `t.description ${sqlDirection}, i.created_at DESC`
    })
  }

  it.each(cases)(
    'orders like PostgreSQL: $name',
    async ({ orderBy, sqlOrder }) => {
      const expected = await expectedIds(sqlOrder)
      const connection = await page({ orderBy, first: incidents.length })

      expect(connection.nodes.map((row) => row.id)).toEqual(expected)
      expect(expected).toHaveLength(incidents.length)
    }
  )

  it.each(cases)(
    'paginates both ways without gaps or repeats: $name',
    async ({ orderBy, sqlOrder }) => {
      const expected = await expectedIds(sqlOrder)
      const forward = await walkForward(orderBy, 3)
      const backward = await walkBackward(orderBy, 3)

      expect(forward).toEqual(expected)
      expect(backward).toEqual(expected)
      expect(new Set(forward).size).toBe(expected.length)
    }
  )

  it('keeps a mid-stream page identical whichever way it is reached', async () => {
    const orderBy: OrderByInput[] = [
      { resolvedAt: 'DescNullsLast' },
      { severity: 'DESC' },
      { createdAt: 'DESC' }
    ]
    const all = await page({ orderBy, first: incidents.length })
    const ids = all.nodes.map((row) => row.id)
    const first = await page({ orderBy, first: 4 })
    const second = await page({
      orderBy,
      first: 4,
      after: first.pageInfo.endCursor
    })
    const back = await page({
      orderBy,
      last: 4,
      before: second.pageInfo.startCursor
    })

    expect(second.nodes.map((row) => row.id)).toEqual(ids.slice(4, 8))
    expect(back.nodes.map((row) => row.id)).toEqual(ids.slice(0, 4))
    expect(second.pageInfo.hasPreviousPage).toBe(true)
    expect(second.pageInfo.hasNextPage).toBe(true)
  })

  it('counts every matching row regardless of the lane the ordering takes', async () => {
    const relationSorted = await page({
      orderBy: [{ team: { name: 'ASC' } }],
      first: 3
    })
    const nullRanked = await page({
      orderBy: [{ resolvedAt: 'AscNullsFirst' }],
      first: 3
    })

    expect(await relationSorted.totalCount).toBe(incidents.length)
    expect(await nullRanked.totalCount).toBe(incidents.length)
  })
})
