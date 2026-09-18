import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listConnection } from '@/core/prisma/utils/query-table'
import { MonitorCheckRepository } from '@/modules/monitor/repositories'
import { MonitorStatus } from '@/modules/monitor/types'
import type { PrismaService } from '@/core/prisma/prisma.service'

vi.mock('@/core/prisma/utils/query-table', () => ({
  listConnection: vi.fn(() => Promise.resolve({ nodes: [] }))
}))

type Statement = { sql: string; values: unknown[] }

function repositoryWith(insertedIds: string[]): {
  repository: MonitorCheckRepository
  executed: Statement[]
  lookedUp: string[]
} {
  const executed: Statement[] = []
  const lookedUp: string[] = []
  const db = {
    raw: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        returnsRow: () => ({
          build: () => ({ sql: strings.join('$'), values })
        })
      })
    },
    runtime: () => ({
      query: (statement: Statement) => {
        executed.push(statement)

        return (function* rows() {
          for (const id of insertedIds) {
            yield { id }
          }
        })()
      }
    }),
    orm: {
      public: {
        MonitorCheck: {
          where: (build: (fields: unknown) => unknown) => {
            build({ id: { eq: (id: string) => lookedUp.push(id) } })

            return {
              first: () => Promise.resolve({ id: lookedUp.at(-1) })
            }
          }
        }
      }
    }
  }

  return {
    repository: new MonitorCheckRepository({ db } as unknown as PrismaService),
    executed,
    lookedUp
  }
}

beforeEach(() => {
  vi.mocked(listConnection).mockClear()
})

describe('MonitorCheckRepository', () => {
  it('addresses the MonitorCheck model, not the Monitor one', async () => {
    const spec = { fingerprint: 'f' }

    await repositoryWith([]).repository.list(spec as never, {
      fields: ['status'],
      page: true
    })

    expect(vi.mocked(listConnection).mock.calls[0][1]).toBe('MonitorCheck')
    expect(vi.mocked(listConnection).mock.calls[0][2]).toBe(spec)
    expect(vi.mocked(listConnection).mock.calls[0][3]).toEqual({
      fields: ['status'],
      page: true
    })
  })

  it('answers the row the write produced, without reading it back', async () => {
    const { repository, executed, lookedUp } = repositoryWith(['c1'])

    await repository.recordOutcome({
      monitorId: 'm1',
      checkedAt: '2026-09-18T10:00:00.000Z',
      status: MonitorStatus.UP,
      statusCode: 200,
      responseTimeMs: 12
    })

    expect(executed).toHaveLength(1)
    expect(lookedUp).toEqual([])
  })

  it('inserts the check and rolls the monitor summary forward in one statement', async () => {
    const { repository, executed, lookedUp } = repositoryWith(['c1'])

    const recorded = await repository.recordOutcome({
      monitorId: 'm1',
      checkedAt: '2026-09-18T10:00:00.000Z',
      status: MonitorStatus.DOWN,
      statusCode: 503,
      responseTimeMs: 40,
      errorType: 'INVALID_STATUS_CODE',
      errorMessage: 'expected 200-299'
    })

    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toMatch(/INSERT INTO "monitorCheck"/)
    expect(executed[0].sql).toMatch(/UPDATE "monitor" m SET/)
    expect(executed[0].sql).toMatch(
      /"last_checked_at" IS NULL\s+OR m\."last_checked_at" <= i\."checked_at"/
    )
    expect(executed[0].sql).toMatch(
      /make_interval\(secs => m\."interval_seconds"\)/
    )
    expect(executed[0].values[0]).toBe(MonitorStatus.DOWN)
    expect(executed[0].values[6]).toBe('m1')
    expect(executed[0].values[7]).toBe(MonitorStatus.DOWN)
    expect(lookedUp).toEqual([])
    expect(recorded).toEqual({ id: 'c1' })
  })

  it('answers null without a lookup when the monitor does not exist', async () => {
    const { repository, executed, lookedUp } = repositoryWith([])

    const recorded = await repository.recordOutcome({
      monitorId: 'gone',
      checkedAt: '2026-09-18T10:00:00.000Z',
      status: MonitorStatus.UP,
      statusCode: 200,
      responseTimeMs: 12
    })

    expect(executed).toHaveLength(1)
    expect(lookedUp).toEqual([])
    expect(recorded).toBeNull()
  })
})
