import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { PrismaPg } from '@prisma/adapter-pg'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Connection } from '@/common/pagination/connection'
import {
  type QueryInput,
  normalizeQuery
} from '@/common/pagination/utils/normalize-query'
import {
  type PrismaQueryArgs,
  specToPrisma
} from '@/core/prisma/utils/spec-to-prisma'
import type { OrderByInput } from '@/common/pagination/utils/query-definition'

import { fixtureQuery } from './fixtures/query-definition'

type Row = { id: string } & Record<string, unknown>
type FixtureClient = {
  queryRecord: {
    findMany(args: PrismaQueryArgs): Promise<Row[]>
    count(args: { where: Record<string, unknown> }): Promise<number>
  }
  $disconnect(): Promise<void>
}

describe('query core against PostgreSQL', () => {
  const schemaName = `query_core_${randomUUID().replaceAll('-', '')}`
  let sql: Client
  let prisma: FixtureClient | undefined
  let schemaCreated = false
  let originalSearchPath = 'public'

  beforeAll(async () => {
    const connectionString = process.env.QUERY_TEST_DATABASE_URL

    if (!connectionString) {
      throw new Error(
        'Set QUERY_TEST_DATABASE_URL to a disposable PostgreSQL database'
      )
    }

    sql = new Client({ connectionString, connectionTimeoutMillis: 5000 })
    await sql.connect()
    const setting = await sql.query<{ search_path: string }>('SHOW search_path')

    originalSearchPath = setting.rows[0].search_path
    await sql.query(`CREATE SCHEMA "${schemaName}"`)
    schemaCreated = true
    await sql.query(`SET search_path TO "${schemaName}"`)
    await sql.query(`
      CREATE TYPE "FixturePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
      CREATE TABLE "QueryOrganization" (id TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE "QueryPerson" (
        id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL,
        "organizationId" TEXT REFERENCES "QueryOrganization"(id)
      );
      CREATE TABLE "QueryRecord" (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, secret TEXT NOT NULL,
        rank INTEGER, active BOOLEAN NOT NULL, priority "FixturePriority" NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL, "locationCity" TEXT,
        "assigneeId" TEXT REFERENCES "QueryPerson"(id)
      );
      CREATE TABLE "QueryComment" (
        id TEXT PRIMARY KEY, body TEXT NOT NULL, flagged BOOLEAN NOT NULL,
        "recordId" TEXT NOT NULL REFERENCES "QueryRecord"(id) ON DELETE CASCADE
      );
      INSERT INTO "QueryOrganization" VALUES ('o1', 'Beta'), ('o2', NULL), ('o3', 'Acme');
      INSERT INTO "QueryPerson" VALUES
        ('p1', NULL, 'one@example.com', 'o1'),
        ('p2', 'Alpha', 'two@example.com', 'o2'),
        ('p3', 'Zed', 'three@example.com', NULL),
        ('p4', 'Alpha', 'four@example.com', 'o3'),
        ('p5', '', 'five@example.com', 'o1');
      INSERT INTO "QueryRecord" VALUES
        ('r01', 'A', 'hidden', NULL, false, 'LOW', '2026-01-01', 'Paris', 'p1'),
        ('r02', 'B', 'hidden', 1, true, 'HIGH', '2026-01-01', 'Rome', 'p2'),
        ('r03', 'C', 'hidden', 1, true, 'MEDIUM', '2026-01-02', NULL, 'p3'),
        ('r04', 'D', 'hidden', 2, false, 'HIGH', '2026-01-02', 'Paris', NULL),
        ('r05', 'E', 'hidden', NULL, true, 'LOW', '2026-01-02', '', 'p4'),
        ('r06', 'F', 'hidden', 1, false, 'MEDIUM', '2026-01-03', 'Rome', 'p4'),
        ('r07', 'G', 'hidden', 0, true, 'HIGH', '2026-01-03', 'Paris', 'p5'),
        ('r08', 'H', 'hidden', 2, true, 'LOW', '2026-01-03', NULL, 'p1'),
        ('r09', 'I', 'hidden', 1, true, 'HIGH', '2026-01-01', 'Rome', 'p2');
      INSERT INTO "QueryComment" VALUES
        ('c1', 'needle', false, 'r01'), ('c2', 'different', true, 'r01'),
        ('c3', 'needle', true, 'r02'), ('c4', 'different', false, 'r03');
    `)
    const generated = createRequire(import.meta.url)(
      resolve('.temp/query-test-client')
    ) as {
      PrismaClient: new (options: { adapter: PrismaPg }) => FixtureClient
    }

    prisma = new generated.PrismaClient({
      adapter: new PrismaPg({ connectionString }, { schema: schemaName })
    })
  })

  afterAll(async () => {
    await prisma?.$disconnect()
    if (schemaCreated) {
      if (!/^query_core_[a-f0-9]{32}$/.test(schemaName)) {
        throw new Error('Invalid test schema name')
      }

      await sql.query("SELECT set_config('search_path', $1, false)", [
        originalSearchPath
      ])
      await sql.query(`DROP SCHEMA "${schemaName}" CASCADE`)
    }

    await sql?.end()
  })

  async function page(input: QueryInput): Promise<Connection<Row>> {
    if (!prisma) {
      throw new Error('Fixture client is not initialized')
    }

    const client = prisma
    const spec = normalizeQuery(fixtureQuery, input)
    const plan = specToPrisma(spec)
    const rows = await client.queryRecord.findMany(plan.args)

    return new Connection(rows, spec, () =>
      client.queryRecord.count({ where: plan.countWhere })
    )
  }

  const cases: { orderBy: OrderByInput[]; sqlOrder: string }[] = []

  for (const [direction, sqlDirection] of [
    ['AscNullsFirst', 'ASC NULLS FIRST'],
    ['AscNullsLast', 'ASC NULLS LAST'],
    ['DescNullsFirst', 'DESC NULLS FIRST'],
    ['DescNullsLast', 'DESC NULLS LAST']
  ] as const) {
    cases.push({
      orderBy: [{ rank: direction }],
      sqlOrder: `q.rank ${sqlDirection}, q.id ASC`
    })
    cases.push({
      orderBy: [{ owner: { name: direction } }],
      sqlOrder: `p.name ${sqlDirection}, q.id ASC`
    })
    cases.push({
      orderBy: [
        { owner: { organization: { name: direction } } },
        { priority: 'DESC' }
      ],
      sqlOrder: `o.name ${sqlDirection}, q.priority DESC, q.id ASC`
    })
    cases.push({
      orderBy: [
        { location: { city: direction } },
        { active: 'DESC' },
        { createdAt: 'ASC' }
      ],
      sqlOrder: `q."locationCity" ${sqlDirection}, q.active DESC, q."createdAt" ASC, q.id ASC`
    })
  }
  cases.push({
    orderBy: [{ owner: { email: 'ASC' } }, { priority: 'ASC' }],
    sqlOrder: 'p.email ASC NULLS LAST, q.priority ASC, q.id ASC'
  })

  it.each(cases)(
    'matches SQL in both directions: $sqlOrder',
    async ({ orderBy, sqlOrder }) => {
      const expected = await sql.query<{ id: string }>(`
      SELECT q.id FROM "QueryRecord" q
      LEFT JOIN "QueryPerson" p ON p.id = q."assigneeId"
      LEFT JOIN "QueryOrganization" o ON o.id = p."organizationId"
      ORDER BY ${sqlOrder}
    `)
      const forward: string[] = []
      const backward: string[] = []
      let after: string | undefined
      let before: string | undefined

      for (let iteration = 0; iteration < 10; iteration++) {
        const connection = await page({ orderBy, first: 2, after })

        forward.push(...connection.nodes.map((row) => row.id))
        if (!connection.pageInfo.hasNextPage) {
          break
        }

        after = connection.pageInfo.endCursor ?? undefined
      }
      for (let iteration = 0; iteration < 10; iteration++) {
        const connection = await page({ orderBy, last: 2, before })

        backward.unshift(...connection.nodes.map((row) => row.id))
        if (!connection.pageInfo.hasPreviousPage) {
          break
        }

        before = connection.pageInfo.startCursor ?? undefined
      }

      expect(forward).toEqual(expected.rows.map((row) => row.id))
      expect(backward).toEqual(forward)
      expect(new Set(forward).size).toBe(9)
    }
  )

  it('executes composite/relation filters, correlated collections and relation search', async () => {
    const scoped = await page({
      filter: {
        comments: { some: { body: { eq: 'needle' }, flagged: { eq: true } } }
      }
    })

    expect(scoped.nodes.map((row) => row.id)).toEqual(['r02'])
    const every = await page({
      filter: { comments: { every: { flagged: { eq: true } } } },
      orderBy: [{ id: 'ASC' }]
    })

    expect(every.nodes.map((row) => row.id)).toEqual([
      'r02',
      'r04',
      'r05',
      'r06',
      'r07',
      'r08',
      'r09'
    ])
    const none = await page({
      filter: { comments: { none: { body: { eq: 'needle' } } } },
      orderBy: [{ id: 'ASC' }]
    })

    expect(none.nodes.map((row) => row.id)).toEqual([
      'r03',
      'r04',
      'r05',
      'r06',
      'r07',
      'r08',
      'r09'
    ])
    const composite = await page({
      filter: {
        location: { city: { eq: 'Rome' } },
        owner: { organization: { name: { is: 'NULL' } } }
      },
      orderBy: [{ id: 'ASC' }]
    })

    expect(composite.nodes.map((row) => row.id)).toEqual(['r02', 'r09'])
    const searched = await page({ search: 'aCmE', orderBy: [{ id: 'ASC' }] })

    expect(searched.nodes.map((row) => row.id)).toEqual(['r05', 'r06'])
    const comments = await page({
      search: 'needle',
      filter: { not: { id: { eq: 'r01' } } }
    })

    expect(comments.nodes.map((row) => row.id)).toEqual(['r02'])
    const empty = await page({ filter: { or: [] } })

    expect(empty.nodes).toEqual([])
  })

  it('counts all matching rows after the first page and handles exact page boundaries', async () => {
    const first = await page({ first: 3 })
    const second = await page({ first: 3, after: first.pageInfo.endCursor })
    const last = await page({ first: 3, after: second.pageInfo.endCursor })
    const empty = await page({ first: 3, after: last.pageInfo.endCursor })

    expect(await second.totalCount).toBe(9)
    expect(last.nodes).toHaveLength(3)
    expect(last.pageInfo.hasNextPage).toBe(false)
    expect(empty.pageInfo.startCursor).toBeNull()
    expect(empty.nodes).toHaveLength(0)
  })

  it('continues from stored ordering values after deleting the cursor record', async () => {
    const orderBy: OrderByInput[] = [
      { rank: 'AscNullsLast' },
      { createdAt: 'DESC' }
    ]
    const original = await page({ first: 100, orderBy })
    const first = await page({ first: 2, orderBy })
    const boundary = first.nodes.at(-1)

    await sql.query('DELETE FROM "QueryRecord" WHERE id = $1', [boundary?.id])
    const next = await page({
      first: 100,
      orderBy,
      after: first.pageInfo.endCursor
    })

    expect(next.nodes.map((row) => row.id)).toEqual(
      original.nodes.slice(2).map((row) => row.id)
    )
  })
})
