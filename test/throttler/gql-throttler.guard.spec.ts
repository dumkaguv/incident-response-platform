import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import type { ExecutionContext } from '@nestjs/common'
import type { ThrottlerRequest, ThrottlerStorage } from '@nestjs/throttler'

import { TooManyRequestsError } from '@/common/utils'
import { GqlThrottlerGuard } from '@/core/throttler/gql-throttler.guard'

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>

class ExposedGuard extends GqlThrottlerGuard {
  public run(request: ThrottlerRequest): Promise<boolean> {
    return this.handleRequest(request)
  }

  public key(context: ExecutionContext, suffix: string, name: string): string {
    return this.generateKey(context, suffix, name)
  }
}

function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value)
    }, 5)
  })
}

function storageAnswering(record: ThrottlerStorageRecord): {
  storage: ThrottlerStorage
  increment: ReturnType<typeof vi.fn>
} {
  const increment = vi.fn(() => later(record))

  return { storage: { increment }, increment }
}

function contextFor(
  req: Record<string, unknown>,
  operation: 'query' | 'mutation' = 'query',
  handler: () => unknown = () => 'field'
): ExecutionContext {
  const res = { header: vi.fn(), status: vi.fn() }
  const args = [{}, {}, { req, res }, { operation: { operation } }]

  return {
    getArgs: () => args,
    getArgByIndex: (index: number) => args[index],
    getClass: () => ExposedGuard,
    getHandler: () => handler,
    getType: () => 'graphql'
  } as unknown as ExecutionContext
}

async function guardWith(storage: ThrottlerStorage): Promise<ExposedGuard> {
  const throttler = { name: 'burst', ttl: 1000, limit: 1 }
  const guard = new ExposedGuard(
    { throttlers: [throttler] },
    storage,
    new Reflector()
  )

  await guard.onModuleInit()

  return guard
}

function requestFor(context: ExecutionContext): ThrottlerRequest {
  return {
    context,
    limit: 1,
    ttl: 1000,
    throttler: { name: 'burst', ttl: 1000, limit: 1 },
    blockDuration: 1000,
    getTracker: () => Promise.resolve('ip:test'),
    generateKey: () => 'burst:ip:test'
  }
}

describe('GqlThrottlerGuard', () => {
  it('leaves plain HTTP routes to the HTTP middleware', async () => {
    const { storage, increment } = storageAnswering({
      totalHits: 1,
      timeToExpire: 1,
      isBlocked: false,
      timeToBlockExpire: 0
    })
    const guard = await guardWith(storage)
    const http = {
      getArgs: () => [{}, {}, () => undefined],
      getClass: () => ExposedGuard,
      getHandler: () => contextFor,
      getType: () => 'http'
    } as unknown as ExecutionContext

    await expect(guard.canActivate(http)).resolves.toBe(true)
    expect(increment).not.toHaveBeenCalled()
  })

  it('counts a tier once per request when two fields check concurrently', async () => {
    const { storage, increment } = storageAnswering({
      totalHits: 1,
      timeToExpire: 1,
      isBlocked: false,
      timeToBlockExpire: 0
    })
    const guard = await guardWith(storage)
    const request = requestFor(contextFor({}))

    const outcomes = await Promise.all([guard.run(request), guard.run(request)])

    expect(outcomes).toEqual([true, true])
    expect(increment).toHaveBeenCalledTimes(1)
  })

  it('rejects every concurrent field of a blocked request, not only the first', async () => {
    const { storage } = storageAnswering({
      totalHits: 9,
      timeToExpire: 1,
      isBlocked: true,
      timeToBlockExpire: 10
    })
    const guard = await guardWith(storage)
    const request = requestFor(contextFor({}))

    const outcomes = await Promise.allSettled([
      guard.run(request),
      guard.run(request)
    ])

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'rejected',
      'rejected'
    ])
    for (const outcome of outcomes) {
      expect(
        outcome.status === 'rejected' ? outcome.reason : null
      ).toBeInstanceOf(TooManyRequestsError)
    }
  })

  it('keeps separate requests apart', async () => {
    const { storage, increment } = storageAnswering({
      totalHits: 1,
      timeToExpire: 1,
      isBlocked: false,
      timeToBlockExpire: 0
    })
    const guard = await guardWith(storage)

    await Promise.all([
      guard.run(requestFor(contextFor({}))),
      guard.run(requestFor(contextFor({})))
    ])

    expect(increment).toHaveBeenCalledTimes(2)
  })
})

describe('GqlThrottlerGuard keys', () => {
  it('keys a tier by client and operation kind, not by the resolver method', async () => {
    const guard = await guardWith(
      storageAnswering({
        totalHits: 1,
        timeToExpire: 1,
        isBlocked: false,
        timeToBlockExpire: 0
      }).storage
    )
    const monitors = contextFor({}, 'query', () => 'monitors')
    const checks = contextFor({}, 'query', () => 'monitorChecks')
    const mutation = contextFor({}, 'mutation', () => 'createMonitor')

    expect(guard.key(monitors, 'ip:test', 'burst')).toBe(
      guard.key(checks, 'ip:test', 'burst')
    )
    expect(guard.key(monitors, 'ip:test', 'burst')).not.toBe(
      guard.key(mutation, 'ip:test', 'burst')
    )
    expect(guard.key(monitors, 'ip:test', 'burst')).not.toBe(
      guard.key(monitors, 'ip:other', 'burst')
    )
    expect(guard.key(monitors, 'ip:test', 'burst')).not.toBe(
      guard.key(monitors, 'ip:test', 'hourly')
    )
  })
})
