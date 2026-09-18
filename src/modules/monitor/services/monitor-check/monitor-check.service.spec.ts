import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError, TooManyRequestsError } from '@/common/utils'
import { MonitorLimit } from '@/modules/monitor/constants'
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
  intervalSeconds: 60,
  expectedStatusMin: 200,
  expectedStatusMax: 299,
  consecutiveFailures: 0,
  isActive: true
} as Monitor

function serviceWith(
  recorded: MonitorCheckCreateData[],
  found: Monitor = monitor
): MonitorCheckService {
  const monitors = { getById: () => Promise.resolve(found) }
  const checks = {
    recordOutcome: (data: MonitorCheckCreateData) => {
      recorded.push(data)

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

function upstream(): { status: number; body: { cancel(): Promise<void> } } {
  return { status: 200, body: { cancel: () => Promise.resolve() } }
}

describe('MonitorCheckService', () => {
  it('refuses to start more probes than fit in flight and recovers when they finish', async () => {
    const release: (() => void)[] = []

    vi.stubGlobal(
      'fetch',
      () =>
        new Promise((resolve) => {
          release.push(() => {
            resolve(upstream())
          })
        })
    )

    const service = serviceWith([])
    const running = Array.from({ length: MonitorLimit.probesInFlight }, () =>
      service.run('m1')
    )

    await expect(service.run('m1')).rejects.toBeInstanceOf(TooManyRequestsError)
    await vi.waitFor(() => {
      expect(release).toHaveLength(MonitorLimit.probesInFlight)
    })

    for (const finish of release) {
      finish()
    }
    await Promise.all(running)

    vi.stubGlobal('fetch', () => Promise.resolve(upstream()))
    await expect(service.run('m1')).resolves.toMatchObject({ monitorId: 'm1' })
  })

  it('records the probe outcome against the monitor it probed', async () => {
    const recorded: MonitorCheckCreateData[] = []

    vi.stubGlobal('fetch', () => Promise.resolve(upstream()))

    const check = await serviceWith(recorded).run('m1')

    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      monitorId: 'm1',
      status: MonitorStatus.UP,
      statusCode: 200,
      errorType: null
    })
    expect(check).toMatchObject({ id: 'c1', monitorId: 'm1' })
  })

  it('stamps the check with the moment the probe started', async () => {
    const recorded: MonitorCheckCreateData[] = []
    const before = Date.now()

    vi.stubGlobal('fetch', () => Promise.resolve(upstream()))

    await serviceWith(recorded).run('m1')

    const stamped = Date.parse(recorded[0].checkedAt)

    expect(stamped).toBeGreaterThanOrEqual(before)
    expect(stamped).toBeLessThanOrEqual(Date.now())
  })

  it('records a failure rather than letting it escape', async () => {
    const recorded: MonitorCheckCreateData[] = []

    vi.stubGlobal('fetch', () =>
      Promise.reject(
        new Error('fetch failed', {
          cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
        })
      )
    )

    await serviceWith(recorded).run('m1')

    expect(recorded[0]).toMatchObject({
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

  it('reports a monitor deleted while it was being probed as NOT_FOUND', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(upstream()))

    const service = new MonitorCheckService(
      { getById: () => Promise.resolve(monitor) } as unknown as MonitorService,
      {
        recordOutcome: () => Promise.resolve(null)
      } as unknown as MonitorCheckRepository
    )

    await expect(service.run('m1')).rejects.toBeInstanceOf(NotFoundError)
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
