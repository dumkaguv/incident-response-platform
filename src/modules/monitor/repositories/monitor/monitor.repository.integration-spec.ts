import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '@/core/prisma/prisma.service'
import { type Db, createDb } from '@/core/prisma/utils/db'
import { MonitorStatus } from '@/modules/monitor/types'
import type { Monitor } from '@/modules/monitor/types'

import { MonitorRepository } from './monitor.repository'

const CHECKED_AT = '2026-03-01T12:00:00.000Z'

describe('MonitorRepository.recordOutcome', () => {
  let db: Db
  let repository: MonitorRepository
  let monitor: Monitor

  beforeAll(async () => {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error('Set DATABASE_URL to a migrated PostgreSQL database')
    }

    db = createDb(url)
    await db.connect()
    repository = new MonitorRepository({ db } as PrismaService)
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

  it('counts concurrent failures without losing one', async () => {
    const failure = {
      status: MonitorStatus.DOWN,
      statusCode: 503,
      responseTimeMs: 40,
      checkedAt: CHECKED_AT
    }

    await Promise.all([
      repository.recordOutcome(monitor.id, failure),
      repository.recordOutcome(monitor.id, failure)
    ])

    const stored = await repository.findById(monitor.id)

    expect(stored).toMatchObject({
      consecutiveFailures: 2,
      lastStatus: MonitorStatus.DOWN,
      lastStatusCode: 503,
      lastResponseTimeMs: 40
    })
    expect(Date.parse(stored?.lastCheckedAt ?? '')).toBe(Date.parse(CHECKED_AT))
    expect(Date.parse(stored?.nextCheckAt ?? '')).toBe(
      Date.parse(CHECKED_AT) + 120_000
    )
  })

  it('resets the streak on a success and returns the fresh row', async () => {
    const stored = await repository.recordOutcome(monitor.id, {
      status: MonitorStatus.UP,
      statusCode: 200,
      responseTimeMs: 12,
      checkedAt: CHECKED_AT
    })

    expect(stored).toMatchObject({
      id: monitor.id,
      consecutiveFailures: 0,
      lastStatus: MonitorStatus.UP,
      lastStatusCode: 200
    })
  })

  it('answers null for a monitor that does not exist', async () => {
    await expect(
      repository.recordOutcome(randomUUID(), {
        status: MonitorStatus.UP,
        statusCode: 200,
        responseTimeMs: 1,
        checkedAt: CHECKED_AT
      })
    ).resolves.toBeNull()
  })
})
