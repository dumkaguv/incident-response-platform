import { describe, expect, it } from 'vitest'

import {
  columnOf,
  isToMany,
  primaryKeyOf,
  relationMeta,
  relationsOf,
  tableOf
} from '@/core/prisma/utils/contract-meta'

describe('contract metadata', () => {
  it('maps models to tables and fields to physical columns', () => {
    expect(tableOf('Incident')).toBe('incident')
    expect(tableOf('TeamMember')).toBe('team_member')
    expect(columnOf('Incident', 'createdAt')).toBe('created_at')
    expect(columnOf('Incident', 'resolvedAt')).toBe('resolved_at')
    expect(columnOf('Incident', 'teamId')).toBe('team_id')
    expect(columnOf('Team', 'name')).toBe('name')
  })

  it('reports the primary key as both field and column', () => {
    expect(primaryKeyOf('Incident')).toEqual({ field: 'id', column: 'id' })
  })

  it('exposes to-many relations instead of rejecting them', () => {
    expect(isToMany(relationMeta('Team', 'members'))).toBe(true)
    expect(isToMany(relationMeta('Incident', 'team'))).toBe(false)
    expect(Object.keys(relationsOf('Team')).sort()).toEqual([
      'incidents',
      'members'
    ])
  })

  it('carries the join columns in owner-to-target order', () => {
    expect(relationMeta('Team', 'members').on).toEqual({
      localFields: ['id'],
      targetFields: ['teamId']
    })
    expect(relationMeta('Incident', 'team').on).toEqual({
      localFields: ['teamId'],
      targetFields: ['id']
    })
  })

  it('rejects a relation the model does not declare', () => {
    expect(() => relationMeta('Incident', 'members')).toThrow(
      'Relation "members" is not declared on "Incident"'
    )
  })
})
