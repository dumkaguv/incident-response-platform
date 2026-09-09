import { describe, expect, it } from 'vitest'

import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import {
  collectJoinPaths,
  existsAlias,
  joinAlias,
  scopeKey
} from '@/core/prisma/utils/relation-path'
import { filterToPrisma } from '@/core/prisma/utils/spec-to-prisma'
import { incidentQuery } from '@/modules/incident/resolvers/incident.query'
import type { OrderByInput } from '@/core/pagination/utils/query-definition'

function pathsFor(orderBy: OrderByInput[], filter?: unknown): string[] {
  const spec = normalizeQuery(incidentQuery, { orderBy, filter })

  return collectJoinPaths(
    'Incident',
    spec.sort,
    filterToPrisma(spec.filter)
  ).map((path) => path.join('.'))
}

describe('relation paths', () => {
  it('derives a stable alias from the path', () => {
    expect(joinAlias(['team'])).toBe('j_team')
    expect(joinAlias(['team', 'owner'])).toBe('j_team_owner')
    expect(existsAlias(['team', 'members'])).toBe('x_team_members')
  })

  it('keeps the root under its table name', () => {
    expect(scopeKey('incident', [])).toBe('incident')
    expect(scopeKey('incident', ['team'])).toBe('j_team')
  })

  it('collects the path a relation sort needs', () => {
    expect(pathsFor([{ team: { name: 'ASC' } }])).toEqual(['team'])
  })

  it('collects nothing when no relation is involved', () => {
    expect(pathsFor([{ createdAt: 'DESC' }])).toEqual([])
  })

  it('collects a relation reached only through the filter', () => {
    expect(
      pathsFor([{ resolvedAt: 'AscNullsFirst' }], {
        team: { name: { eq: 'Platform' } }
      })
    ).toEqual(['team'])
  })

  it('finds relations nested inside and/or/not', () => {
    expect(
      pathsFor([{ resolvedAt: 'AscNullsFirst' }], {
        and: [
          { or: [{ title: { eq: 'x' } }, { team: { slug: { eq: 'y' } } }] },
          { not: { team: { name: { eq: 'z' } } } }
        ]
      })
    ).toEqual(['team'])
  })

  it('returns every prefix of a deep path, parents first', () => {
    const sort = [
      {
        field: {
          name: 'team.members.team.name',
          column: 'name',
          scalar: { type: 'string' as const },
          relations: [
            { field: 'team', nullable: true, many: false },
            { field: 'members', nullable: false, many: true }
          ]
        },
        direction: 'ASC' as const,
        nulls: 'last' as const
      }
    ]

    expect(
      collectJoinPaths('Incident', sort, {}).map((p) => p.join('.'))
    ).toEqual(['team', 'team.members'])
  })
})
