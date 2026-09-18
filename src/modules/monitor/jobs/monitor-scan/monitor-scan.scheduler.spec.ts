import { describe, expect, it, vi } from 'vitest'
import type { ConfigType } from '@nestjs/config'
import type { Queue } from 'bullmq'

import { MONITOR_SCAN_SCHEDULER, MonitorJob } from '@/modules/monitor/constants'
import { MonitorScanScheduler } from '@/modules/monitor/jobs'
import type { queueConfig } from '@/core/config'

const config = { tickMs: 5000 } as ConfigType<typeof queueConfig>

type Repeat = { every: number }
type Template = { name?: string; opts?: { attempts?: number } }

function schedulerWith() {
  const upsertJobScheduler = vi.fn(
    (_id: string, _repeat: Repeat, _template?: Template) => Promise.resolve({})
  )
  const scheduler = new MonitorScanScheduler(
    { upsertJobScheduler } as unknown as Queue,
    config
  )

  return { scheduler, upsertJobScheduler }
}

describe('MonitorScanScheduler', () => {
  it('registers one repeating scan under a shared id, so replicas converge on a single tick', async () => {
    const { scheduler, upsertJobScheduler } = schedulerWith()

    await scheduler.onApplicationBootstrap()

    expect(upsertJobScheduler).toHaveBeenCalledOnce()
    expect(upsertJobScheduler.mock.calls[0][0]).toBe(MONITOR_SCAN_SCHEDULER)
  })

  it('ticks at the configured interval', async () => {
    const { scheduler, upsertJobScheduler } = schedulerWith()

    await scheduler.onApplicationBootstrap()

    expect(upsertJobScheduler.mock.calls[0][1]).toEqual({ every: 5000 })
  })

  it('never retries a tick, because the next one is already due', async () => {
    const { scheduler, upsertJobScheduler } = schedulerWith()

    await scheduler.onApplicationBootstrap()

    const template = upsertJobScheduler.mock.calls[0][2]

    expect(template?.name).toBe(MonitorJob.scanDue)
    expect(template?.opts?.attempts).toBe(1)
  })
})
