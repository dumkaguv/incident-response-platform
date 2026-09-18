import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PrismaService } from '@/core/prisma/prisma.service'
import { type Db, createDb } from '@/core/prisma/utils/db'
import type { Monitor } from '@/modules/monitor/types'

import { MonitorRepository } from './monitor.repository'

const LONG_AGO = '1970-01-01T00:00:00.000Z'
const FAR_AHEAD = '2999-01-01T00:00:00.000Z'
const LATER = '2200-01-01T00:00:00.000Z'
const BATCH = 4

describe('MonitorRepository.claimDue', () => {
  const label = `claim-due-${randomUUID()}`
  let db: Db
  let rival: Db
  let monitors: MonitorRepository
  let rivalMonitors: MonitorRepository
  let created: Monitor[]

  async function reset(): Promise<void> {
    await db.orm.public.Monitor.where((fields) =>
      fields.name.eq(label)
    ).deleteAll()

    created = []

    for (const index of [0, 1, 2, 3]) {
      created.push(
        await db.orm.public.Monitor.create({
          name: label,
          url: `https://example.test/${String(index)}`,
          intervalSeconds: 120,
          nextCheckAt: LONG_AGO
        })
      )
    }
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to a migrated PostgreSQL database')
    }

    db = createDb(url)
    rival = createDb(url)

    await db.connect()
    await rival.connect()

    monitors = new MonitorRepository({ db } as PrismaService)
    rivalMonitors = new MonitorRepository({ db: rival } as PrismaService)
  })

  beforeEach(reset)

  afterAll(async () => {
    await db.orm.public.Monitor.where((fields) =>
      fields.name.eq(label)
    ).deleteAll()
    await db.close()
    await rival.close()
  })

  it('hands two workers claiming at once disjoint sets of monitors', async () => {
    const [mine, theirs] = await Promise.all([
      monitors.claimDue(2),
      rivalMonitors.claimDue(2)
    ])
    const claimed = [...mine, ...theirs].map(({ id }) => id)
    const ours = created.map(({ id }) => id)

    expect(new Set(claimed).size).toBe(claimed.length)
    expect(claimed.filter((id) => ours.includes(id))).toHaveLength(BATCH)
  })

  it('leases every claimed row forward by its own interval', async () => {
    const before = Date.now()
    const claimed = await monitors.claimDue(BATCH)

    expect(claimed).toHaveLength(BATCH)

    for (const { id, dueAt } of claimed) {
      const stored = await monitors.findById(id)
      const leased = Date.parse(stored?.nextCheckAt ?? '')

      expect(Date.parse(dueAt)).toBe(Date.parse(LONG_AGO))
      expect(leased).toBeGreaterThanOrEqual(before + 120_000 - 1000)
    }
  })

  it('does not hand the same monitor out twice in a row', async () => {
    const first = await monitors.claimDue(BATCH)
    const again = await monitors.claimDue(BATCH)
    const ours = created.map(({ id }) => id)

    expect(first).toHaveLength(BATCH)
    expect(again.filter(({ id }) => ours.includes(id))).toEqual([])
  })

  it('never claims a paused monitor', async () => {
    const [paused] = created

    await db.orm.public.Monitor.where((fields) =>
      fields.id.eq(paused.id)
    ).update({ isActive: false })

    const claimed = await monitors.claimDue(BATCH)

    expect(claimed.map(({ id }) => id)).not.toContain(paused.id)
    expect((await monitors.findById(paused.id))?.nextCheckAt).toBe(
      paused.nextCheckAt
    )
  })

  it('never claims a monitor whose slot has not arrived', async () => {
    const [ahead] = created

    await db.orm.public.Monitor.where((fields) =>
      fields.id.eq(ahead.id)
    ).update({ nextCheckAt: FAR_AHEAD })

    const claimed = await monitors.claimDue(BATCH)

    expect(claimed.map(({ id }) => id)).not.toContain(ahead.id)
  })

  it('puts a slot back when the claim could not be handed on', async () => {
    const claimed = await monitors.claimDue(BATCH)

    await monitors.releaseClaim(claimed)

    for (const { id, dueAt } of claimed) {
      const stored = await monitors.findById(id)

      expect(Date.parse(stored?.nextCheckAt ?? '')).toBe(Date.parse(dueAt))
    }
  })

  it('refuses to put back a slot whose probe already landed', async () => {
    const [first] = await monitors.claimDue(1)
    const leased = (await monitors.findById(first.id))?.nextCheckAt

    await db.orm.public.Monitor.where((fields) =>
      fields.id.eq(first.id)
    ).update({ lastCheckedAt: LATER })

    await monitors.releaseClaim([first])

    expect((await monitors.findById(first.id))?.nextCheckAt).toBe(leased)
  })

  it('reads no further than the batch it was asked for', async () => {
    expect(await monitors.claimDue(1)).toHaveLength(1)
  })
})
