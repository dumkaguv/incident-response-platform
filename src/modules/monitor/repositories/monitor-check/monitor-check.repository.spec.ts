import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listConnection } from '@/core/prisma/utils/query-table'
import { MonitorCheckRepository } from '@/modules/monitor/repositories'
import { MonitorStatus } from '@/modules/monitor/types'
import type { PrismaService } from '@/core/prisma/prisma.service'

vi.mock('@/core/prisma/utils/query-table', () => ({
  listConnection: vi.fn(() => Promise.resolve({ nodes: [] }))
}))

function repositoryWith(created: unknown[]): MonitorCheckRepository {
  const table = {
    create: (data: unknown) => {
      created.push(data)

      return Promise.resolve({ id: 'c1' })
    }
  }
  const prisma = {
    db: { orm: { public: { MonitorCheck: table } } }
  } as unknown as PrismaService

  return new MonitorCheckRepository(prisma)
}

beforeEach(() => {
  vi.mocked(listConnection).mockClear()
})

describe('MonitorCheckRepository', () => {
  it('addresses the MonitorCheck model, not the Monitor one', async () => {
    const spec = { fingerprint: 'f' }

    await repositoryWith([]).list(spec as never, ['status'])

    expect(vi.mocked(listConnection).mock.calls[0][1]).toBe('MonitorCheck')
    expect(vi.mocked(listConnection).mock.calls[0][2]).toBe(spec)
    expect(vi.mocked(listConnection).mock.calls[0][3]).toEqual(['status'])
  })

  it('writes the probe outcome through untouched', async () => {
    const created: unknown[] = []
    const outcome = {
      monitorId: 'm1',
      status: MonitorStatus.DOWN,
      statusCode: null,
      responseTimeMs: 1017,
      errorType: null
    }

    await repositoryWith(created).create(outcome)

    expect(created).toEqual([outcome])
  })
})
