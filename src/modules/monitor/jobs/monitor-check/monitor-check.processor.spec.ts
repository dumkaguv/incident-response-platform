import { describe, expect, it, vi } from 'vitest'
import type { ConfigType } from '@nestjs/config'
import type { Job } from 'bullmq'

import { MonitorCheckProcessor } from '@/modules/monitor/jobs'
import { MonitorStatus } from '@/modules/monitor/types'
import type { queueConfig } from '@/core/config'
import type { MonitorCheckService } from '@/modules/monitor/services'
import type { MonitorCheck, MonitorCheckJob } from '@/modules/monitor/types'

const config = { concurrency: 5 } as ConfigType<typeof queueConfig>

function job(data: MonitorCheckJob): Job<MonitorCheckJob> {
  return { data } as Job<MonitorCheckJob>
}

function processorWith(check: MonitorCheck | null) {
  const runScheduled = vi.fn(() => Promise.resolve(check))
  const processor = new MonitorCheckProcessor(
    { runScheduled } as unknown as MonitorCheckService,
    config
  )

  return { processor, runScheduled }
}

describe('MonitorCheckProcessor', () => {
  it('probes the monitor the job names', async () => {
    const { processor, runScheduled } = processorWith({
      id: 'c1',
      status: MonitorStatus.UP
    } as MonitorCheck)

    const result = await processor.process(
      job({ monitorId: 'm1', dueAt: '2026-09-18 15:38:42.715296+00' })
    )

    expect(runScheduled).toHaveBeenCalledWith('m1')
    expect(result).toEqual({ checkId: 'c1', status: MonitorStatus.UP })
  })

  it('completes rather than fails when the monitor was paused or removed', async () => {
    const { processor } = processorWith(null)

    await expect(
      processor.process(
        job({ monitorId: 'gone', dueAt: '2026-09-18 15:38:42.715296+00' })
      )
    ).resolves.toEqual({ checkId: null, status: null })
  })

  it('takes its concurrency from the config before it starts consuming', () => {
    const { processor } = processorWith(null)
    const run = vi.fn()
    const worker = { concurrency: 1, run }

    Object.assign(processor, { _worker: worker })
    processor.onApplicationBootstrap()

    expect(worker.concurrency).toBe(5)
    expect(run).toHaveBeenCalledOnce()
  })
})
