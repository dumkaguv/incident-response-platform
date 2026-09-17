import { lastValueFrom, of, throwError } from 'rxjs'
import { describe, expect, it } from 'vitest'
import type { ExecutionContext } from '@nestjs/common'

import { ResetLoadersInterceptor } from '@/core/graphql/reset-loaders.interceptor'

type Operation = 'query' | 'mutation'

function contextFor(
  operation: Operation,
  loaders: Map<string, unknown>,
  root = true
): ExecutionContext {
  const info = {
    operation: { operation },
    path: root
      ? { prev: undefined, key: 'createMonitor' }
      : { prev: { prev: undefined, key: 'createMonitor' }, key: 'checks' }
  }
  const args = [{}, {}, { loaders }, info]

  return {
    getArgs: () => args,
    getArgByIndex: (index: number) => args[index],
    getClass: () => Object,
    getHandler: () => Object,
    getType: () => 'graphql'
  } as unknown as ExecutionContext
}

function loadersWithEntry(): Map<string, unknown> {
  return new Map([['Monitor.checks', {}]])
}

describe('ResetLoadersInterceptor', () => {
  const interceptor = new ResetLoadersInterceptor()

  it('clears the request loaders once a root mutation field has resolved', async () => {
    const loaders = loadersWithEntry()

    const result = await lastValueFrom(
      interceptor.intercept(contextFor('mutation', loaders), {
        handle: () => of('done')
      })
    )

    expect(result).toBe('done')
    expect(loaders.size).toBe(0)
  })

  it('clears them even when the mutation fails', async () => {
    const loaders = loadersWithEntry()

    await expect(
      lastValueFrom(
        interceptor.intercept(contextFor('mutation', loaders), {
          handle: () => throwError(() => new Error('boom'))
        })
      )
    ).rejects.toThrow('boom')
    expect(loaders.size).toBe(0)
  })

  it('leaves loaders alone for queries', async () => {
    const loaders = loadersWithEntry()

    await lastValueFrom(
      interceptor.intercept(contextFor('query', loaders), {
        handle: () => of('done')
      })
    )

    expect(loaders.size).toBe(1)
  })

  it('leaves loaders alone for fields nested under a mutation result', async () => {
    const loaders = loadersWithEntry()

    await lastValueFrom(
      interceptor.intercept(contextFor('mutation', loaders, false), {
        handle: () => of('done')
      })
    )

    expect(loaders.size).toBe(1)
  })
})
