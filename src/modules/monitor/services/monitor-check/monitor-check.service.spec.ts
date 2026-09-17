import { afterEach, describe, expect, it, vi } from 'vitest'

import { MonitorCheckService } from '@/modules/monitor/services'
import { CheckErrorType, MonitorStatus } from '@/modules/monitor/types'
import type { MonitorCheckRepository } from '@/modules/monitor/repositories'
import type { MonitorService } from '@/modules/monitor/services'
import type { Monitor, MonitorCheckCreateData } from '@/modules/monitor/types'

const monitor = {
  id: 'm1',
  url: 'https://example.test/health',
  method: 'GET',
  timeoutMs: 1000,
  expectedStatusCode: 200
} as Monitor

function serviceWith(created: MonitorCheckCreateData[]): MonitorCheckService {
  const monitors = { getById: () => Promise.resolve(monitor) }
  const checks = {
    create: (data: MonitorCheckCreateData) => {
      created.push(data)

      return Promise.resolve({ id: 'c1', ...data })
    }
  }

  return new MonitorCheckService(
    monitors as unknown as MonitorService,
    checks as unknown as MonitorCheckRepository
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MonitorCheckService', () => {
  it('stores the probe outcome against the monitor it probed', async () => {
    const created: MonitorCheckCreateData[] = []

    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      })
    )

    const check = await serviceWith(created).run('m1')

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      monitorId: 'm1',
      status: MonitorStatus.UP,
      statusCode: 200,
      errorType: null
    })
    expect(check).toMatchObject({ id: 'c1', monitorId: 'm1' })
  })

  it('stores a failure rather than letting it escape', async () => {
    const created: MonitorCheckCreateData[] = []

    vi.stubGlobal('fetch', () =>
      Promise.reject(
        new Error('fetch failed', {
          cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
        })
      )
    )

    await serviceWith(created).run('m1')

    expect(created[0]).toMatchObject({
      status: MonitorStatus.DOWN,
      statusCode: null,
      errorType: CheckErrorType.CONNECTION_REFUSED
    })
  })

  it('never probes a monitor the service could not find', async () => {
    const fetched = vi.fn()

    vi.stubGlobal('fetch', fetched)

    const monitors = {
      getById: () => Promise.reject(new Error('NOT_FOUND'))
    }
    const service = new MonitorCheckService(
      monitors as unknown as MonitorService,
      {} as unknown as MonitorCheckRepository
    )

    await expect(service.run('missing')).rejects.toThrow('NOT_FOUND')
    expect(fetched).not.toHaveBeenCalled()
  })

  it('passes the requested fields down when listing history', async () => {
    const list = vi.fn(() => Promise.resolve({ nodes: [] }))
    const service = new MonitorCheckService(
      {} as unknown as MonitorService,
      { list } as unknown as MonitorCheckRepository
    )
    const spec = { fingerprint: 'f' }

    await service.list(spec as never, ['id', 'status'])

    expect(list).toHaveBeenCalledWith(spec, ['id', 'status'])
  })
})
