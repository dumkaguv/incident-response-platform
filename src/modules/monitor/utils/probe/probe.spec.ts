import { afterEach, describe, expect, it, vi } from 'vitest'

import { CheckErrorType, MonitorStatus } from '@/modules/monitor/types'
import { probe } from '@/modules/monitor/utils'
import type { Monitor } from '@/modules/monitor/types'

function monitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: 'm1',
    name: 'Probe target',
    url: 'https://example.test/health',
    method: 'GET',
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusCode: 200,
    isActive: true,
    nextCheckAt: null,
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    ...overrides
  }
}

function responding(status: number, drained: { called: boolean }) {
  return vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve({
      status,
      arrayBuffer: () => {
        drained.called = true

        return Promise.resolve(new ArrayBuffer(0))
      }
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('probe', () => {
  it('reports UP when the response carries the expected code', async () => {
    const drained = { called: false }

    vi.stubGlobal('fetch', responding(200, drained))

    const outcome = await probe(monitor())

    expect(outcome.status).toBe(MonitorStatus.UP)
    expect(outcome.statusCode).toBe(200)
    expect(outcome.errorType).toBeNull()
    expect(outcome.responseTimeMs).toBeTypeOf('number')
    expect(drained.called).toBe(true)
  })

  it('reports DOWN with the code it did get', async () => {
    vi.stubGlobal('fetch', responding(503, { called: false }))

    const outcome = await probe(monitor())

    expect(outcome.status).toBe(MonitorStatus.DOWN)
    expect(outcome.statusCode).toBe(503)
    expect(outcome.errorType).toBe(CheckErrorType.INVALID_STATUS_CODE)
  })

  it('honours a monitor that expects something other than 200', async () => {
    vi.stubGlobal('fetch', responding(204, { called: false }))

    const outcome = await probe(monitor({ expectedStatusCode: 204 }))

    expect(outcome.status).toBe(MonitorStatus.UP)
  })

  it('sends the monitor method and follows redirects', async () => {
    const stub = responding(200, { called: false })

    vi.stubGlobal('fetch', stub)
    await probe(monitor({ method: 'HEAD' }))

    const [url, init] = stub.mock.calls[0]

    expect(url).toBe('https://example.test/health')
    expect(init.method).toBe('HEAD')
    expect(init.redirect).toBe('follow')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts on the monitor timeout and records it as TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          })
        })
    )

    const outcome = await probe(monitor({ timeoutMs: 20 }))

    expect(outcome.status).toBe(MonitorStatus.DOWN)
    expect(outcome.errorType).toBe(CheckErrorType.TIMEOUT)
    expect(outcome.statusCode).toBeNull()
    expect(outcome.responseTimeMs).toBeGreaterThanOrEqual(15)
  })

  it('classifies a transport failure and leaves no status code', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.reject(
        new Error('fetch failed', {
          cause: Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })
        })
      )
    )

    const outcome = await probe(monitor())

    expect(outcome.status).toBe(MonitorStatus.DOWN)
    expect(outcome.errorType).toBe(CheckErrorType.DNS_ERROR)
    expect(outcome.statusCode).toBeNull()
  })
})
