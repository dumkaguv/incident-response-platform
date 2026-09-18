import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listConnection } from '@/core/prisma/utils/query-table'
import { MonitorRepository } from '@/modules/monitor/repositories'
import type { PrismaService } from '@/core/prisma/prisma.service'

vi.mock('@/core/prisma/utils/query-table', () => ({
  listConnection: vi.fn(() => Promise.resolve({ nodes: [] }))
}))

type Predicate = { field: string; operator: string; value: unknown }

const fields = new Proxy(
  {},
  {
    get: (_target, field: string) => ({
      eq: (value: unknown): Predicate => ({ field, operator: 'eq', value })
    })
  }
)

function repositoryWith(calls: unknown[]): {
  repository: MonitorRepository
  predicates: Predicate[]
} {
  const predicates: Predicate[] = []
  const table = {
    where(build: (bag: unknown) => Predicate) {
      predicates.push(build(fields))

      return {
        first: () => Promise.resolve({ id: 'm1' }),
        update: (data: unknown) => {
          calls.push(['update', data])

          return Promise.resolve({ id: 'm1' })
        },
        delete: () => {
          calls.push(['delete'])

          return Promise.resolve({ id: 'm1' })
        }
      }
    },
    create: (data: unknown) => {
      calls.push(['create', data])

      return Promise.resolve({ id: 'm1' })
    }
  }
  const prisma = {
    db: { orm: { public: { Monitor: table } } }
  } as unknown as PrismaService

  return { repository: new MonitorRepository(prisma), predicates }
}

beforeEach(() => {
  vi.mocked(listConnection).mockClear()
})

describe('MonitorRepository', () => {
  it('addresses the Monitor model when listing', async () => {
    const { repository } = repositoryWith([])
    const spec = { fingerprint: 'f' }

    await repository.list(spec as never, { fields: ['id'], page: true })

    expect(vi.mocked(listConnection).mock.calls[0][1]).toBe('Monitor')
    expect(vi.mocked(listConnection).mock.calls[0][2]).toBe(spec)
    expect(vi.mocked(listConnection).mock.calls[0][3]).toEqual({
      fields: ['id'],
      page: true
    })
  })

  it('looks a row up by its primary key, not by anything else', async () => {
    const { repository, predicates } = repositoryWith([])

    await repository.findById('m1')

    expect(predicates).toEqual([{ field: 'id', operator: 'eq', value: 'm1' }])
  })

  it('scopes an update to the same key and passes the data through', async () => {
    const calls: unknown[] = []
    const { repository, predicates } = repositoryWith(calls)

    await repository.update('m1', { name: 'Renamed' })

    expect(predicates).toEqual([{ field: 'id', operator: 'eq', value: 'm1' }])
    expect(calls).toEqual([['update', { name: 'Renamed' }]])
  })

  it('scopes a delete to the same key', async () => {
    const calls: unknown[] = []
    const { repository, predicates } = repositoryWith(calls)

    await repository.delete('m1')

    expect(predicates).toEqual([{ field: 'id', operator: 'eq', value: 'm1' }])
    expect(calls).toEqual([['delete']])
  })

  it('creates without a predicate at all', async () => {
    const calls: unknown[] = []
    const { repository, predicates } = repositoryWith(calls)

    await repository.create({ name: 'New', url: 'https://example.test' })

    expect(predicates).toEqual([])
    expect(calls).toEqual([
      ['create', { name: 'New', url: 'https://example.test' }]
    ])
  })
})

type Statement = { sql: string; values: unknown[] }

function claimingRepository(rows: Record<string, unknown>[]): {
  repository: MonitorRepository
  executed: Statement[]
} {
  const executed: Statement[] = []
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

        return (function* claimed() {
          yield* rows
        })()
      }
    })
  }

  return {
    repository: new MonitorRepository({ db } as unknown as PrismaService),
    executed
  }
}

describe('MonitorRepository.claimDue', () => {
  it('locks the batch with SKIP LOCKED so two workers never take one monitor', async () => {
    const { repository, executed } = claimingRepository([])

    await repository.claimDue(25)

    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toMatch(/FOR UPDATE SKIP LOCKED/)
    expect(executed[0].values).toHaveLength(1)
  })

  it('reads only what is active and already due', async () => {
    const { repository, executed } = claimingRepository([])

    await repository.claimDue(25)

    expect(executed[0].sql).toMatch(/"is_active" = true/)
    expect(executed[0].sql).toMatch(/"next_check_at" <= now\(\)/)
  })

  it('leases each row forward by its own interval in the same statement', async () => {
    const { repository, executed } = claimingRepository([])

    await repository.claimDue(25)

    expect(executed[0].sql).toMatch(/"next_check_at" = now\(\) \+ greatest\(/)
    expect(executed[0].sql).toMatch(/JOIN leased l/)
  })

  it('never leases for less than one probe timeout, so two probes cannot overlap', async () => {
    const { repository, executed } = claimingRepository([])

    await repository.claimDue(25)

    expect(executed[0].sql).toMatch(
      /make_interval\(secs => m\."interval_seconds"\)/
    )
    expect(executed[0].sql).toMatch(
      /make_interval\(secs => m\."timeout_ms" \/ 1000\.0\)/
    )
  })

  it('answers the slot it claimed, not the one it wrote', async () => {
    const { repository } = claimingRepository([
      { id: 'm1', due_at: '2026-09-18 15:38:42.715296+00' },
      { id: 'm2', due_at: '2026-09-18 15:38:43.000000+00' }
    ])

    expect(await repository.claimDue(25)).toEqual([
      { id: 'm1', dueAt: '2026-09-18 15:38:42.715296+00' },
      { id: 'm2', dueAt: '2026-09-18 15:38:43.000000+00' }
    ])
  })

  it('answers nothing when no monitor is due', async () => {
    const { repository } = claimingRepository([])

    expect(await repository.claimDue(25)).toEqual([])
  })
})
