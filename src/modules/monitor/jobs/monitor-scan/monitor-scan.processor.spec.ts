import { describe, expect, it, vi } from 'vitest'
import type { ConfigType } from '@nestjs/config'
import type { Queue } from 'bullmq'

import { MonitorJob } from '@/modules/monitor/constants'
import { MonitorScanProcessor } from '@/modules/monitor/jobs'
import { checkJobId } from '@/modules/monitor/utils'
import type { queueConfig } from '@/core/config'
import type { MonitorService } from '@/modules/monitor/services'
import type { MonitorDue } from '@/modules/monitor/types'

const config = { batchSize: 3 } as ConfigType<typeof queueConfig>

const DUE: MonitorDue[] = [
  { id: 'm1', dueAt: '2026-09-18 15:38:42.715296+00' },
  { id: 'm2', dueAt: '2026-09-18 15:38:43.000000+00' }
]

function processorWith(due: MonitorDue[], enqueue?: () => Promise<never>) {
  const claimDue = vi.fn(() => Promise.resolve(due))
  const releaseClaim = vi.fn(() => Promise.resolve())
  const addBulk = vi.fn(enqueue ?? (() => Promise.resolve([])))
  const processor = new MonitorScanProcessor(
    { claimDue, releaseClaim } as unknown as MonitorService,
    { addBulk } as unknown as Queue,
    config
  )

  return { processor, claimDue, addBulk, releaseClaim }
}

describe('MonitorScanProcessor', () => {
  it('claims no more than the configured batch', async () => {
    const { processor, claimDue } = processorWith(DUE)

    await processor.process()

    expect(claimDue).toHaveBeenCalledWith(3)
  })

  it('enqueues one check per claimed monitor, keyed by the slot it claimed', async () => {
    const { processor, addBulk } = processorWith(DUE)

    const result = await processor.process()

    expect(result).toEqual({ claimed: 2 })
    expect(addBulk).toHaveBeenCalledWith([
      {
        name: MonitorJob.check,
        data: { monitorId: 'm1', dueAt: DUE[0].dueAt },
        opts: { jobId: checkJobId('m1', DUE[0].dueAt) }
      },
      {
        name: MonitorJob.check,
        data: { monitorId: 'm2', dueAt: DUE[1].dueAt },
        opts: { jobId: checkJobId('m2', DUE[1].dueAt) }
      }
    ])
  })

  it('leaves the queue alone when nothing is due', async () => {
    const { processor, addBulk } = processorWith([])

    expect(await processor.process()).toEqual({ claimed: 0 })
    expect(addBulk).not.toHaveBeenCalled()
  })

  it('gives the slots back when the queue refuses them', async () => {
    const { processor, releaseClaim } = processorWith(DUE, () =>
      Promise.reject(new Error('redis is down'))
    )

    await expect(processor.process()).rejects.toThrow('redis is down')
    expect(releaseClaim).toHaveBeenCalledWith(DUE)
  })

  it('leaves the claim alone when the queue accepted it', async () => {
    const { processor, releaseClaim } = processorWith(DUE)

    await processor.process()

    expect(releaseClaim).not.toHaveBeenCalled()
  })

  it('starts its worker only once the whole application is up', () => {
    const { processor } = processorWith([])
    const run = vi.fn()

    Object.assign(processor, { _worker: { run } })
    processor.onApplicationBootstrap()

    expect(run).toHaveBeenCalledOnce()
  })
})
