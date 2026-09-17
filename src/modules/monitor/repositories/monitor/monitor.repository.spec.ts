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

    await repository.list(spec as never, ['id'])

    expect(vi.mocked(listConnection).mock.calls[0][1]).toBe('Monitor')
    expect(vi.mocked(listConnection).mock.calls[0][2]).toBe(spec)
    expect(vi.mocked(listConnection).mock.calls[0][3]).toEqual(['id'])
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
