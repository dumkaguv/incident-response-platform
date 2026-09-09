import { describe, expect, it } from 'vitest'

import { normalizeQuery } from '@/core/pagination/utils/normalize-query'
import { orderSteps, requiresSqlLane } from '@/core/prisma/utils/relation-query'
import { incidentQuery } from '@/modules/incident/resolvers/incident.query'
import type { OrderByInput } from '@/core/pagination/utils/query-definition'

function sortOf(orderBy: OrderByInput[]) {
  return normalizeQuery(incidentQuery, { orderBy }).sort
}

function orderBySql(orderBy: OrderByInput[], backward = false): string[] {
  return orderSteps('Incident', sortOf(orderBy), backward).map((step) => {
    const operand =
      step.expression === 'isNull'
        ? `${step.table}.${step.column} IS NULL`
        : `${step.table}.${step.column}`

    return `${operand} ${step.direction.toUpperCase()}`
  })
}

describe('SQL lane ordering', () => {
  it('orders by physical columns, not model field names', () => {
    expect(
      orderBySql([{ team: { name: 'ASC' } }, { createdAt: 'DESC' }])
    ).toEqual(['team.name ASC', 'incident.created_at DESC', 'incident.id ASC'])
  })

  it('maps every mapped column reached through a relation sort', () => {
    expect(
      orderBySql([
        { team: { name: 'ASC' } },
        { resolvedAt: 'ASC' },
        { severity: 'DESC' },
        { status: 'ASC' },
        { createdAt: 'DESC' },
        { updatedAt: 'DESC' },
        { title: 'ASC' }
      ])
    ).toEqual([
      'team.name ASC',
      'incident.resolved_at ASC',
      'incident.severity DESC',
      'incident.status ASC',
      'incident.created_at DESC',
      'incident.updated_at DESC',
      'incident.title ASC',
      'incident.id ASC'
    ])
  })

  it('maps mapped columns on the joined model too', () => {
    expect(orderBySql([{ team: { createdAt: 'ASC' } }])).toEqual([
      'team.created_at ASC',
      'incident.id ASC'
    ])
  })

  it('leaves PostgreSQL default null placement to PostgreSQL', () => {
    expect(orderBySql([{ resolvedAt: 'AscNullsLast' }])).toEqual([
      'incident.resolved_at ASC',
      'incident.id ASC'
    ])
    expect(orderBySql([{ resolvedAt: 'DescNullsFirst' }])).toEqual([
      'incident.resolved_at DESC',
      'incident.id ASC'
    ])
  })

  it('ranks nulls with a leading key when the placement is not the default', () => {
    expect(orderBySql([{ resolvedAt: 'AscNullsFirst' }])).toEqual([
      'incident.resolved_at IS NULL DESC',
      'incident.resolved_at ASC',
      'incident.id ASC'
    ])
    expect(orderBySql([{ resolvedAt: 'DescNullsLast' }])).toEqual([
      'incident.resolved_at IS NULL ASC',
      'incident.resolved_at DESC',
      'incident.id ASC'
    ])
  })

  it('ranks nulls for a non-null column reached through an optional relation', () => {
    expect(orderBySql([{ team: { name: 'AscNullsFirst' } }])).toEqual([
      'team.name IS NULL DESC',
      'team.name ASC',
      'incident.id ASC'
    ])
    expect(orderBySql([{ team: { name: 'ASC' } }])).toEqual([
      'team.name ASC',
      'incident.id ASC'
    ])
  })

  it('reverses direction and null placement together for a backward page', () => {
    expect(orderBySql([{ resolvedAt: 'AscNullsLast' }], true)).toEqual([
      'incident.resolved_at DESC',
      'incident.id DESC'
    ])
    expect(orderBySql([{ resolvedAt: 'AscNullsFirst' }], true)).toEqual([
      'incident.resolved_at IS NULL ASC',
      'incident.resolved_at DESC',
      'incident.id DESC'
    ])
    expect(orderBySql([{ resolvedAt: 'DescNullsLast' }], true)).toEqual([
      'incident.resolved_at IS NULL DESC',
      'incident.resolved_at ASC',
      'incident.id DESC'
    ])
  })

  it('sends only orderings the ORM lane cannot express to the SQL lane', () => {
    expect(requiresSqlLane(sortOf([{ createdAt: 'DESC' }]))).toBe(false)
    expect(requiresSqlLane(sortOf([{ title: 'ASC' }]))).toBe(false)
    expect(requiresSqlLane(sortOf([{ resolvedAt: 'AscNullsLast' }]))).toBe(
      false
    )
    expect(requiresSqlLane(sortOf([{ resolvedAt: 'DescNullsFirst' }]))).toBe(
      false
    )
    expect(requiresSqlLane(sortOf([{ resolvedAt: 'AscNullsFirst' }]))).toBe(
      true
    )
    expect(requiresSqlLane(sortOf([{ description: 'DescNullsLast' }]))).toBe(
      true
    )
    expect(requiresSqlLane(sortOf([{ team: { name: 'ASC' } }]))).toBe(true)
  })

  it('refuses to order through a to-many relation', () => {
    expect(() =>
      orderSteps(
        'Incident',
        [
          {
            field: {
              name: 'team.members.name',
              column: 'name',
              scalar: { type: 'string' },
              relations: [
                { field: 'team', nullable: true, many: false },
                { field: 'members', nullable: false, many: true }
              ]
            },
            direction: 'ASC',
            nulls: 'last'
          }
        ],
        false
      )
    ).toThrow(
      'Ordering through the to-many relation "members" is not supported'
    )
  })
})
