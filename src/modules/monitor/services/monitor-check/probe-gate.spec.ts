import { describe, expect, it } from 'vitest'
import type { Redis } from 'ioredis'

import { ProbeGate } from '@/modules/monitor/services'

const KEY = 'probes'
const LIMIT = 3
const LEASE = 90_000

function gateWith(grant: () => Promise<number>): {
  gate: ProbeGate
  acquires: unknown[][]
  removals: unknown[][]
} {
  const acquires: unknown[][] = []
  const removals: unknown[][] = []
  const redis = {
    defineCommand: () => undefined,
    probeAcquire: (...args: unknown[]) => {
      acquires.push(args)

      return grant()
    },
    zrem: (...args: unknown[]) => {
      removals.push(args)

      return Promise.resolve(1)
    }
  }

  return {
    gate: new ProbeGate(redis as unknown as Redis, KEY, LIMIT, LEASE),
    acquires,
    removals
  }
}

function granted(): Promise<number> {
  return Promise.resolve(1)
}

function refused(): Promise<number> {
  return Promise.resolve(0)
}

describe('ProbeGate', () => {
  it('hands out a lease and tells Redis which key, lease and limit it counts against', async () => {
    const { gate, acquires } = gateWith(granted)

    expect(await gate.acquire()).not.toBeNull()
    expect(acquires).toHaveLength(1)
    expect(acquires[0].slice(0, 3)).toEqual([KEY, String(LEASE), String(LIMIT)])
    expect(acquires[0][3]).toEqual(expect.any(String))
  })

  it('gives every lease its own member, so one release cannot free another slot', async () => {
    const { gate, acquires } = gateWith(granted)

    await gate.acquire()
    await gate.acquire()

    expect(acquires[0][3]).not.toBe(acquires[1][3])
  })

  it('answers null when Redis reports the budget spent, holding no local slot back', async () => {
    let answer = refused
    const { gate, removals } = gateWith(() => answer())

    for (let attempt = 0; attempt < LIMIT; attempt += 1) {
      expect(await gate.acquire()).toBeNull()
    }

    expect(removals).toEqual([])

    answer = granted

    expect(await gate.acquire()).not.toBeNull()
  })

  it('stops asking Redis once this process alone holds the whole budget', async () => {
    const { gate, acquires } = gateWith(granted)

    for (let taken = 0; taken < LIMIT; taken += 1) {
      expect(await gate.acquire()).not.toBeNull()
    }

    expect(await gate.acquire()).toBeNull()
    expect(acquires).toHaveLength(LIMIT)
  })

  it('keeps the cap inside this process when Redis is unreachable', async () => {
    const { gate } = gateWith(() => Promise.reject(new Error('ECONNREFUSED')))

    for (let taken = 0; taken < LIMIT; taken += 1) {
      expect(await gate.acquire()).not.toBeNull()
    }

    expect(await gate.acquire()).toBeNull()
  })

  it('withdraws the member it was given, so the next probe fits', async () => {
    const { gate, acquires, removals } = gateWith(granted)
    const first = await gate.acquire()

    for (let taken = 1; taken < LIMIT; taken += 1) {
      await gate.acquire()
    }

    expect(await gate.acquire()).toBeNull()

    await first?.release()

    expect(removals).toEqual([[KEY, acquires[0][3]]])
    expect(await gate.acquire()).not.toBeNull()
  })

  it('frees the local slot even when Redis cannot be told about the release', async () => {
    const redis = {
      defineCommand: () => undefined,
      probeAcquire: () => Promise.resolve(1),
      zrem: () => Promise.reject(new Error('ECONNREFUSED'))
    }
    const gate = new ProbeGate(redis as unknown as Redis, KEY, LIMIT, LEASE)
    const first = await gate.acquire()

    for (let taken = 1; taken < LIMIT; taken += 1) {
      await gate.acquire()
    }

    await first?.release()

    expect(await gate.acquire()).not.toBeNull()
  })
})
