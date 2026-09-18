import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '@/core/prisma/prisma.service'
import { type Db, createDb } from '@/core/prisma/utils/db'
import { MonitorRepository } from '@/modules/monitor/repositories/monitor'
import { MonitorStatus } from '@/modules/monitor/types'
import type { Monitor } from '@/modules/monitor/types'

import { MonitorCheckRepository } from './monitor-check.repository'

const FIRST = '2026-03-01T12:00:00.000Z'
const SECOND = '2026-03-01T12:02:00.000Z'
const THIRD = '2026-03-01T12:04:00.000Z'
const LATE = '2026-03-01T12:03:00.000Z'
const FOURTH = '2026-03-01T12:06:00.000Z'

function failure(checkedAt: string) {
  return {
    status: MonitorStatus.DOWN,
    statusCode: 503,
    responseTimeMs: 40,
    errorType: 'INVALID_STATUS_CODE' as const,
    errorMessage: 'expected 200-299',
    checkedAt
  }
}

describe('MonitorCheckRepository.recordOutcome', () => {
  let db: Db
  let checks: MonitorCheckRepository
  let monitors: MonitorRepository
  let monitor: Monitor

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to a migrated PostgreSQL database')
    }

    db = createDb(url)
    await db.connect()

    const prisma = { db } as PrismaService

    checks = new MonitorCheckRepository(prisma)
    monitors = new MonitorRepository(prisma)
    monitor = await db.orm.public.Monitor.create({
      name: `record-outcome-${randomUUID()}`,
      url: 'https://example.com',
      intervalSeconds: 120
    })
  })

  afterAll(async () => {
    await db.orm.public.Monitor.where((fields) =>
      fields.id.eq(monitor.id)
    ).deleteAll()
    await db.close()
  })

  it('inserts the check and rolls the summary forward in one statement', async () => {
    const check = await checks.recordOutcome({
      monitorId: monitor.id,
      ...failure(FIRST)
    })
    const stored = await monitors.findById(monitor.id)

    expect(check).toMatchObject({
      monitorId: monitor.id,
      status: MonitorStatus.DOWN,
      statusCode: 503,
      responseTimeMs: 40,
      errorType: 'INVALID_STATUS_CODE',
      errorMessage: 'expected 200-299'
    })
    expect(Date.parse(check?.checkedAt ?? '')).toBe(Date.parse(FIRST))
    expect(stored).toMatchObject({
      consecutiveFailures: 1,
      lastStatus: MonitorStatus.DOWN,
      lastStatusCode: 503,
      lastResponseTimeMs: 40
    })
    expect(Date.parse(stored?.lastCheckedAt ?? '')).toBe(Date.parse(FIRST))
    expect(Date.parse(stored?.nextCheckAt ?? '')).toBe(
      Date.parse(FIRST) + 120_000
    )
  })

  it('counts a second failure and resets the streak on a success', async () => {
    await checks.recordOutcome({ monitorId: monitor.id, ...failure(SECOND) })

    expect(await monitors.findById(monitor.id)).toMatchObject({
      consecutiveFailures: 2
    })

    await checks.recordOutcome({
      monitorId: monitor.id,
      status: MonitorStatus.UP,
      statusCode: 200,
      responseTimeMs: 12,
      checkedAt: THIRD
    })

    const stored = await monitors.findById(monitor.id)

    expect(stored).toMatchObject({
      consecutiveFailures: 0,
      lastStatus: MonitorStatus.UP,
      lastStatusCode: 200
    })
    expect(Date.parse(stored?.lastCheckedAt ?? '')).toBe(Date.parse(THIRD))
  })

  it('keeps a late outcome in the history without rolling the summary back', async () => {
    const late = await checks.recordOutcome({
      monitorId: monitor.id,
      ...failure(LATE)
    })
    const stored = await monitors.findById(monitor.id)

    expect(late).toMatchObject({ status: MonitorStatus.DOWN })
    expect(stored).toMatchObject({
      consecutiveFailures: 0,
      lastStatus: MonitorStatus.UP,
      lastStatusCode: 200
    })
    expect(Date.parse(stored?.lastCheckedAt ?? '')).toBe(Date.parse(THIRD))
  })

  it('counts two failures recorded for the same instant', async () => {
    await Promise.all([
      checks.recordOutcome({ monitorId: monitor.id, ...failure(FOURTH) }),
      checks.recordOutcome({ monitorId: monitor.id, ...failure(FOURTH) })
    ])

    const stored = await monitors.findById(monitor.id)

    expect(stored).toMatchObject({
      consecutiveFailures: 2,
      lastStatus: MonitorStatus.DOWN
    })
    expect(Date.parse(stored?.lastCheckedAt ?? '')).toBe(Date.parse(FOURTH))
  })

  it('answers null and records nothing for a monitor that does not exist', async () => {
    const missing = randomUUID()

    await expect(
      checks.recordOutcome({
        monitorId: missing,
        status: MonitorStatus.UP,
        statusCode: 200,
        responseTimeMs: 1,
        checkedAt: FIRST
      })
    ).resolves.toBeNull()

    const orphans = await db.orm.public.MonitorCheck.where((fields) =>
      fields.monitorId.eq(missing)
    ).all()

    expect(orphans).toEqual([])
  })
})
