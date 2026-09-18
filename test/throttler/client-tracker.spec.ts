import Fastify from 'fastify'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'

import {
  type IdentifiedRequest,
  clientTracker
} from '@/core/throttler/client-tracker'

type Server = Parameters<typeof request>[0]

const CHAIN = '203.0.113.7, 70.41.3.18, 150.172.238.178'

const started: FastifyInstance[] = []

async function probe(trustProxy?: boolean | string): Promise<FastifyInstance> {
  const app = Fastify({ trustProxy })

  app.get('/probe', (incoming) => ({ key: clientTracker(incoming) }))

  await app.ready()
  started.push(app)

  return app
}

function keyOf(app: FastifyInstance, headers: Record<string, string> = {}) {
  return request(app.server as unknown as Server)
    .get('/probe')
    .set(headers)
    .then((response) => response.body.key as string)
}

afterEach(async () => {
  await Promise.all(started.splice(0).map((app) => app.close()))
})

describe('client identification behind a proxy', () => {
  it('falls back to the socket address when no proxy is trusted', async () => {
    await expect(keyOf(await probe())).resolves.toBe('ip:::ffff:127.0.0.1')
  })

  it('ignores a forwarded chain while no proxy is trusted', async () => {
    await expect(
      keyOf(await probe(), { 'x-forwarded-for': CHAIN })
    ).resolves.toBe('ip:::ffff:127.0.0.1')
  })

  it('takes the far end of the chain when only the peer is trusted', async () => {
    await expect(
      keyOf(await probe('loopback'), { 'x-forwarded-for': CHAIN })
    ).resolves.toBe('ip:150.172.238.178')
  })

  it('takes the claimed origin when the whole chain is trusted', async () => {
    await expect(
      keyOf(await probe(true), { 'x-forwarded-for': CHAIN })
    ).resolves.toBe('ip:203.0.113.7')
  })

  it('prefers an identified user over any address', () => {
    const carrier = {
      user: { id: 'u-1' },
      ips: ['203.0.113.7'],
      ip: '10.0.0.1'
    } as unknown as IdentifiedRequest

    expect(clientTracker(carrier)).toBe('user:u-1')
  })
})
