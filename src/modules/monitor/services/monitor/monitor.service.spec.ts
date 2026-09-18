import { describe, expect, it, vi } from 'vitest'

import { BadUserInputError, NotFoundError } from '@/common/utils'
import { MonitorService } from '@/modules/monitor/services'
import type { MonitorRepository } from '@/modules/monitor/repositories'
import type { Monitor } from '@/modules/monitor/types'

const row = { id: 'm1', name: 'Production API' } as Monitor

function serviceWith(repository: object): MonitorService {
  return new MonitorService(repository as unknown as MonitorRepository)
}

describe('MonitorService', () => {
  it('returns the row the repository found', async () => {
    const service = serviceWith({ findById: () => Promise.resolve(row) })

    await expect(service.getById('m1')).resolves.toBe(row)
  })

  it('turns a missing row into NOT_FOUND, naming the id', async () => {
    const service = serviceWith({ findById: () => Promise.resolve(null) })

    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundError)
    await expect(service.getById('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })

  it('reports an update against a missing row as NOT_FOUND', async () => {
    const service = serviceWith({ update: () => Promise.resolve(null) })

    await expect(service.update('nope', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundError
    )
  })

  it('treats an empty patch as a read instead of an update', async () => {
    const update = vi.fn(() => Promise.resolve(null))
    const service = serviceWith({
      update,
      findById: () => Promise.resolve(row)
    })

    await expect(service.update('m1', {})).resolves.toBe(row)
    await expect(service.update('m1', { name: undefined })).resolves.toBe(row)
    expect(update).not.toHaveBeenCalled()
  })

  it('reports a delete against a missing row as NOT_FOUND', async () => {
    const service = serviceWith({ delete: () => Promise.resolve(null) })

    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('hands create and update straight through', async () => {
    const create = vi.fn(() => Promise.resolve(row))
    const update = vi.fn(() => Promise.resolve(row))
    const service = serviceWith({ create, update })

    await service.create({
      name: 'Production API',
      url: 'https://example.test'
    })
    await service.update('m1', { name: 'Renamed' })

    expect(create).toHaveBeenCalledWith({
      name: 'Production API',
      url: 'https://example.test'
    })
    expect(update).toHaveBeenCalledWith('m1', { name: 'Renamed' })
  })

  it('rejects a create whose status floor exceeds its ceiling', async () => {
    const create = vi.fn(() => Promise.resolve(row))
    const service = serviceWith({ create })

    await expect(
      service.create({
        name: 'Backwards',
        url: 'https://example.test',
        expectedStatusMin: 500,
        expectedStatusMax: 200
      })
    ).rejects.toBeInstanceOf(BadUserInputError)
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects an update that lifts the floor above the stored ceiling', async () => {
    const update = vi.fn(() => Promise.resolve(row))
    const service = serviceWith({
      update,
      findById: () =>
        Promise.resolve({
          ...row,
          expectedStatusMin: 200,
          expectedStatusMax: 299
        })
    })

    await expect(
      service.update('m1', { expectedStatusMin: 400 })
    ).rejects.toBeInstanceOf(BadUserInputError)
    expect(update).not.toHaveBeenCalled()
  })

  it('accepts an update that moves both bounds together', async () => {
    const update = vi.fn(() => Promise.resolve(row))
    const service = serviceWith({
      update,
      findById: () =>
        Promise.resolve({
          ...row,
          expectedStatusMin: 200,
          expectedStatusMax: 299
        })
    })

    await service.update('m1', {
      expectedStatusMin: 400,
      expectedStatusMax: 499
    })

    expect(update).toHaveBeenCalledWith('m1', {
      expectedStatusMin: 400,
      expectedStatusMax: 499
    })
  })

  it('passes the requested fields down to the repository', async () => {
    const list = vi.fn(() => Promise.resolve({ nodes: [] }))
    const service = serviceWith({ list })
    const spec = { fingerprint: 'f' }

    await service.list(spec as never, ['id', 'name'])

    expect(list).toHaveBeenCalledWith(spec, ['id', 'name'])
  })
})
