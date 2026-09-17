import { describe, expect, it, vi } from 'vitest'
import type { GraphQLResolveInfo } from 'graphql'

import { MonitorResolver } from '@/modules/monitor/resolvers'
import type {
  MonitorCheckService,
  MonitorService
} from '@/modules/monitor/services'

const SPEC = { fingerprint: 'spec' }

function args(): never {
  return { toSpec: () => SPEC } as never
}

function info(): GraphQLResolveInfo {
  return {
    fieldNodes: [{ selectionSet: { selections: [] } }]
  } as unknown as GraphQLResolveInfo
}

function resolverWith(monitors: object, checks: object = {}): MonitorResolver {
  return new MonitorResolver(
    monitors as unknown as MonitorService,
    checks as unknown as MonitorCheckService
  )
}

describe('MonitorResolver', () => {
  it('lists through the service with the normalized spec', async () => {
    const list = vi.fn((_spec: unknown, _fields?: readonly string[]) =>
      Promise.resolve({ nodes: [] })
    )

    await resolverWith({ list }).monitors(args(), info())

    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0][0]).toBe(SPEC)
  })

  it('reads one monitor by id', async () => {
    const getById = vi.fn(() => Promise.resolve({ id: 'm1' }))

    await resolverWith({ getById }).monitor('m1')

    expect(getById).toHaveBeenCalledWith('m1')
  })

  it('hands the input to create untouched', async () => {
    const create = vi.fn(() => Promise.resolve({ id: 'm1' }))
    const input = { name: 'Production API', url: 'https://example.test' }

    await resolverWith({ create }).createMonitor(input)

    expect(create).toHaveBeenCalledWith(input)
  })

  it('keeps the id and the input in that order on update', async () => {
    const update = vi.fn(() => Promise.resolve({ id: 'm1' }))
    const input = { name: 'Renamed' }

    await resolverWith({ update }).updateMonitor('m1', input)

    expect(update).toHaveBeenCalledWith('m1', input)
  })

  it('deletes through remove, not through update', async () => {
    const remove = vi.fn(() => Promise.resolve({ id: 'm1' }))
    const update = vi.fn()

    await resolverWith({ remove, update }).deleteMonitor('m1')

    expect(remove).toHaveBeenCalledWith('m1')
    expect(update).not.toHaveBeenCalled()
  })

  it('sends a manual probe to the check service, not the monitor service', async () => {
    const run = vi.fn(() => Promise.resolve({ id: 'c1' }))
    const getById = vi.fn()

    await resolverWith({ getById }, { run }).checkMonitor('m1')

    expect(run).toHaveBeenCalledWith('m1')
    expect(getById).not.toHaveBeenCalled()
  })
})
