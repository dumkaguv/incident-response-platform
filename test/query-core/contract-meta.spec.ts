import { describe, expect, it } from 'vitest'

import {
  columnDefault,
  columnOf,
  isToMany,
  primaryKeyOf,
  relationMeta,
  relationsOf,
  tableOf
} from '@/core/prisma/utils/contract-meta'

describe('contract metadata', () => {
  it('maps models to tables and fields to physical columns', () => {
    expect(tableOf('Monitor')).toBe('monitor')
    expect(tableOf('MonitorCheck')).toBe('monitorCheck')
    expect(columnOf('Monitor', 'createdAt')).toBe('created_at')
    expect(columnOf('Monitor', 'nextCheckAt')).toBe('next_check_at')
    expect(columnOf('MonitorCheck', 'monitorId')).toBe('monitor_id')
    expect(columnOf('Monitor', 'name')).toBe('name')
  })

  it('reports the primary key as both field and column', () => {
    expect(primaryKeyOf('Monitor')).toEqual({ field: 'id', column: 'id' })
  })

  it('exposes to-many relations instead of rejecting them', () => {
    expect(isToMany(relationMeta('Monitor', 'checks'))).toBe(true)
    expect(isToMany(relationMeta('MonitorCheck', 'monitor'))).toBe(false)
    expect(Object.keys(relationsOf('Monitor')).sort()).toEqual(['checks'])
  })

  it('carries the join columns in owner-to-target order', () => {
    expect(relationMeta('Monitor', 'checks').on).toEqual({
      localFields: ['id'],
      targetFields: ['monitorId']
    })
    expect(relationMeta('MonitorCheck', 'monitor').on).toEqual({
      localFields: ['monitorId'],
      targetFields: ['id']
    })
  })

  it('reads literal column defaults and leaves the rest undefined', () => {
    expect(columnDefault('Monitor', 'intervalSeconds')).toBe(60)
    expect(columnDefault('Monitor', 'method')).toBe('GET')
    expect(columnDefault('Monitor', 'isActive')).toBe(true)
    expect(columnDefault('Monitor', 'nextCheckAt')).toBeUndefined()
    expect(columnDefault('Monitor', 'name')).toBeUndefined()
  })

  it('rejects a relation the model does not declare', () => {
    expect(() => relationMeta('Monitor', 'members')).toThrow(
      'Relation "members" is not declared on "Monitor"'
    )
  })
})
