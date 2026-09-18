import { describe, expect, it, vi } from 'vitest'
import type { GraphQLResolveInfo } from 'graphql'

import { NotFoundError } from '@/common/utils'
import { MonitorCheckResolver } from '@/modules/monitor/resolvers'
import type { GqlContext } from '@/core/graphql'
import type {
  MonitorCheckService,
  MonitorService
} from '@/modules/monitor/services'
import type { Monitor, MonitorCheck } from '@/modules/monitor/types'

const SPEC = { fingerprint: 'spec' }

const monitors = [
  { id: 'm1', name: 'first' },
  { id: 'm2', name: 'second' }
] as Monitor[]

function args(): never {
  return { toSpec: () => SPEC } as never
}

function info(): GraphQLResolveInfo {
  return {
    fieldNodes: [{ selectionSet: { selections: [] } }],
    fieldName: 'monitor',
    parentType: { name: 'MonitorCheck' }
  } as unknown as GraphQLResolveInfo
}

function context(): GqlContext {
  return { loaders: new Map() } as unknown as GqlContext
}

function resolverWith(
  checks: object,
  monitorService: object = {}
): MonitorCheckResolver {
  return new MonitorCheckResolver(
    checks as unknown as MonitorCheckService,
    monitorService as unknown as MonitorService
  )
}

describe('MonitorCheckResolver', () => {
  it('lists history through the service with the normalized spec', async () => {
    const list = vi.fn((_spec: unknown, _fields?: readonly string[]) =>
      Promise.resolve({ nodes: [] })
    )

    await resolverWith({ list }).monitorChecks(args(), info())

    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0][0]).toBe(SPEC)
  })

  it('narrows the selection it asks the service to load', async () => {
    const list = vi.fn((_spec: unknown, _fields?: readonly string[]) =>
      Promise.resolve({ nodes: [] })
    )

    await resolverWith({ list }).monitorChecks(args(), info())

    expect(list.mock.calls[0][1]).toBeDefined()
  })

  it('loads the monitors of a page of checks in one batch', async () => {
    const listByIds = vi.fn((ids: readonly string[]) =>
      Promise.resolve(monitors.filter((monitor) => ids.includes(monitor.id)))
    )
    const resolver = resolverWith({}, { listByIds })
    const ctx = context()

    const loaded = await Promise.all([
      resolver.monitor({ monitorId: 'm2' } as MonitorCheck, ctx, info()),
      resolver.monitor({ monitorId: 'm1' } as MonitorCheck, ctx, info()),
      resolver.monitor({ monitorId: 'm2' } as MonitorCheck, ctx, info())
    ])

    expect(listByIds).toHaveBeenCalledTimes(1)
    expect(listByIds.mock.calls[0][0]).toEqual(['m2', 'm1'])
    expect(loaded.map((monitor) => monitor.name)).toEqual([
      'second',
      'first',
      'second'
    ])
  })

  it('reports a check whose monitor is gone as NOT_FOUND', async () => {
    const resolver = resolverWith({}, { listByIds: () => Promise.resolve([]) })

    await expect(
      resolver.monitor({ monitorId: 'gone' } as MonitorCheck, context(), info())
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
