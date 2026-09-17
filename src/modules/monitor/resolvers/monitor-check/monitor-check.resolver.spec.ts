import { describe, expect, it, vi } from 'vitest'
import type { GraphQLResolveInfo } from 'graphql'

import { MonitorCheckResolver } from '@/modules/monitor/resolvers'
import type { MonitorCheckService } from '@/modules/monitor/services'

const SPEC = { fingerprint: 'spec' }

function args(): never {
  return { toSpec: () => SPEC } as never
}

function info(): GraphQLResolveInfo {
  return {
    fieldNodes: [{ selectionSet: { selections: [] } }]
  } as unknown as GraphQLResolveInfo
}

describe('MonitorCheckResolver', () => {
  it('lists history through the service with the normalized spec', async () => {
    const list = vi.fn((_spec: unknown, _fields?: readonly string[]) =>
      Promise.resolve({ nodes: [] })
    )
    const resolver = new MonitorCheckResolver({
      list
    } as unknown as MonitorCheckService)

    await resolver.monitorChecks(args(), info())

    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0][0]).toBe(SPEC)
  })

  it('narrows the selection it asks the service to load', async () => {
    const list = vi.fn((_spec: unknown, _fields?: readonly string[]) =>
      Promise.resolve({ nodes: [] })
    )
    const resolver = new MonitorCheckResolver({
      list
    } as unknown as MonitorCheckService)

    await resolver.monitorChecks(args(), info())

    expect(list.mock.calls[0][1]).toBeDefined()
  })
})
