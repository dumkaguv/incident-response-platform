import postgres from '@prisma/orm-postgres/runtime'
import { describe, expect, it } from 'vitest'

import contractJson from '@/core/prisma/contract.json' with { type: 'json' }
import {
  type OrderStep,
  type SqlLaneClient,
  buildOrderedIdQuery
} from '@/core/prisma/utils/relation-query'
import type { Contract } from '@/core/prisma/contract'
import type { RelationPath } from '@/core/prisma/utils/relation-path'

const db = postgres<Contract>({
  contractJson,
  url: 'postgresql://unused:unused@127.0.0.1:1/unused'
})

const tables = (db as unknown as SqlLaneClient).sql.public

type Node = { kind: string } & Record<string, unknown>

type Plan = { joins?: unknown[]; where: Node }

function planFor(
  where: Record<string, unknown>,
  order: OrderStep[] = [],
  paths: RelationPath[] = []
): Plan {
  const built = buildOrderedIdQuery(tables, 'MonitorCheck', {
    where,
    order,
    paths,
    take: 5
  }).build() as { ast: Plan }

  return built.ast
}

function kinds(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      kinds(item, found)
    }
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'kind' && typeof value === 'string') {
        found.push(value)
      } else {
        kinds(value, found)
      }
    }
  }

  return found
}

describe('SQL lane relation filters', () => {
  it('filters through a to-one relation with a correlated subquery, not a join', () => {
    const plan = planFor({ monitor: { is: { name: { equals: 'probe' } } } })
    const serialized = JSON.stringify(plan.where)

    expect(plan.joins ?? []).toEqual([])
    expect(kinds(plan.where)).toContain('exists')
    expect(serialized).toContain('"x_monitor"')
    expect(serialized).not.toContain('"j_monitor"')
  })

  it('negates a to-one filter as NOT EXISTS so a NULL column cannot drop the row', () => {
    const plan = planFor({
      NOT: {
        monitor: {
          is: { nextCheckAt: { equals: '2030-01-01T00:00:00.000Z' } }
        }
      }
    })

    expect(plan.where.kind).toBe('not')
    expect(kinds(plan.where)).toContain('exists')
    expect(kinds(plan.where)).not.toContain('null-check')
  })

  it('reaches a to-many relation nested under a to-one', () => {
    const plan = planFor({
      monitor: { is: { checks: { some: { status: { equals: 'UP' } } } } }
    })

    expect(kinds(plan.where).filter((kind) => kind === 'exists')).toHaveLength(
      2
    )
  })

  it('joins a to-one relation only when the ordering needs it', () => {
    const plan = planFor(
      { monitor: { is: { name: { equals: 'probe' } } } },
      [
        {
          table: 'j_monitor',
          column: 'name',
          direction: 'asc',
          expression: 'column'
        }
      ],
      [['monitor']]
    )

    expect(plan.joins).toHaveLength(1)
    expect(kinds(plan.where)).toContain('exists')
  })
})
