import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ProbeGate } from '@/modules/monitor/services'

const LIMIT = 2
const LEASE = 60_000
const SHORT_LEASE = 60

function waitFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

describe('ProbeGate against a real Redis', () => {
  let first: Redis
  let second: Redis
  let key: string

  beforeAll(async () => {
    const url = process.env.REDIS_URL ?? 'redis://localhost:56379'

    first = new Redis(url, { lazyConnect: true })
    second = new Redis(url, { lazyConnect: true })

    await first.connect()
    await second.connect()

    key = `spec-probes-${randomUUID()}`
  })

  afterAll(async () => {
    await first.del(key, `${key}-lease`)

    first.disconnect()
    second.disconnect()
  })

  it('spends one budget across two connections, the way two replicas would', async () => {
    const one = new ProbeGate(first, key, LIMIT, LEASE)
    const two = new ProbeGate(second, key, LIMIT, LEASE)
    const held = await one.acquire()

    expect(held).not.toBeNull()
    expect(await two.acquire()).not.toBeNull()
    expect(await two.acquire()).toBeNull()

    await held?.release()

    expect(await two.acquire()).not.toBeNull()
  })

  it('lets a lease expire, so a process that died holding one cannot keep it', async () => {
    const leaseKey = `${key}-lease`
    const gate = new ProbeGate(first, leaseKey, LIMIT, SHORT_LEASE)
    const crashed = new ProbeGate(second, leaseKey, LIMIT, SHORT_LEASE)

    for (let taken = 0; taken < LIMIT; taken += 1) {
      expect(await gate.acquire()).not.toBeNull()
    }

    expect(await crashed.acquire()).toBeNull()

    await waitFor(SHORT_LEASE * 2)

    expect(await crashed.acquire()).not.toBeNull()
  })
})
