import { ObjectType } from '@nestjs/graphql'
import { describe, expect, it } from 'vitest'

import { NestedConnection } from '@/core/graphql/nested-connection'
import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import type { GqlContext } from '@/core/graphql/graphql-context'
import type { Connection } from '@/core/pagination/connection'
import type { QueryDefinition } from '@/core/pagination/utils/query-definition'
import type { PrismaService } from '@/core/prisma/prisma.service'

type Statement = { sql: string; values: unknown[] }

type Row = { id: string; monitorId: string; checkedAt: string }

const definition: QueryDefinition = {
  name: 'MonitorCheck',
  fields: { id: { type: 'id' }, checkedAt: { type: 'date' } },
  defaultOrderBy: [{ checkedAt: 'DESC' }]
}

const rows: Row[] = [
  { id: 'c1', monitorId: 'm1', checkedAt: '2026-01-03T00:00:00.000Z' },
  { id: 'c2', monitorId: 'm1', checkedAt: '2026-01-02T00:00:00.000Z' },
  { id: 'c3', monitorId: 'm1', checkedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'c4', monitorId: 'm2', checkedAt: '2026-01-01T00:00:00.000Z' }
]

@ObjectType()
class ParentObject {}

@ObjectType()
class ChildConnection {}

function fakePrisma(): { prisma: PrismaService; executed: Statement[] } {
  const executed: Statement[] = []

  function answer(statement: Statement): Record<string, unknown>[] {
    const parents = statement.values as string[]

    if (statement.sql.includes('count(*)')) {
      return parents
        .filter((parent) => rows.some((row) => row.monitorId === parent))
        .map((parent) => ({
          monitor_id: parent,
          total: String(rows.filter((row) => row.monitorId === parent).length)
        }))
    }

    return parents.flatMap((parent) =>
      rows
        .filter((row) => row.monitorId === parent)
        .slice(0, 2)
        .map((row) => ({ id: row.id, monitor_id: row.monitorId }))
    )
  }

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

        return (function* stream() {
          for (const row of answer(statement)) {
            yield row
          }
        })()
      }
    }),
    orm: {
      public: {
        MonitorCheck: {
          where: (build: (fields: unknown) => unknown) => {
            let wanted: string[] = []

            build({ id: { in: (ids: string[]) => (wanted = ids) } })

            return {
              all: () =>
                Promise.resolve(rows.filter((row) => wanted.includes(row.id)))
            }
          }
        }
      }
    }
  }

  return { prisma: { db } as unknown as PrismaService, executed }
}

const Resolver = NestedConnection({
  parent: ParentObject,
  field: 'checks',
  connection: ChildConnection,
  definition,
  model: 'MonitorCheck',
  foreignKey: 'monitorId',
  description: 'Checks of the parent'
}) as new (prisma: PrismaService) => {
  page(
    parent: { id: string },
    args: { first?: number; last?: number; orderBy?: unknown },
    context: GqlContext
  ): Promise<Connection<Row>>
}

function context(): GqlContext {
  return { loaders: new Map() } as GqlContext
}

describe('NestedConnection', () => {
  it('pages every parent of a request in one statement and counts nothing until asked', async () => {
    const { prisma, executed } = fakePrisma()
    const resolver = new Resolver(prisma)
    const ctx = context()

    const [first, second] = await Promise.all([
      resolver.page({ id: 'm1' }, { first: 1 }, ctx),
      resolver.page({ id: 'm2' }, { first: 1 }, ctx)
    ])

    expect(executed).toHaveLength(1)
    expect(executed[0].sql).not.toContain('count(*)')
    expect(first.nodes.map((row) => row.id)).toEqual(['c1'])
    expect(first.pageInfo.hasNextPage).toBe(true)
    expect(second.nodes.map((row) => row.id)).toEqual(['c4'])
    expect(second.pageInfo.hasNextPage).toBe(false)

    const totals = await Promise.all([first.totalCount, second.totalCount])

    expect(totals).toEqual([3, 1])
    expect(executed).toHaveLength(2)
    expect(executed[1].sql).toContain('count(*)')
  })

  it('issues cursors the root query of the same model refuses', async () => {
    const { prisma } = fakePrisma()
    const connection = await new Resolver(prisma).page(
      { id: 'm1' },
      { first: 1 },
      context()
    )
    const cursor = connection.pageInfo.endCursor

    expect(cursor).not.toBeNull()
    expect(() =>
      normalizeQuery(definition, { after: cursor ?? undefined })
    ).toThrow('Invalid pagination cursor')
  })
})
