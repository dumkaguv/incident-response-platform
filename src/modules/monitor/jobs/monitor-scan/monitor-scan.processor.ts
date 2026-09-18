import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, OnApplicationBootstrap } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import type { Queue } from 'bullmq'

import { queueConfig } from '@/core/config'
import { MonitorJob, MonitorQueue } from '@/modules/monitor/constants'
import { MonitorService } from '@/modules/monitor/services'
import { checkJobId } from '@/modules/monitor/utils'
import type {
  MonitorCheckJob,
  MonitorScanResult
} from '@/modules/monitor/types'

@Processor(MonitorQueue.scan, { autorun: false })
export class MonitorScanProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  constructor(
    private readonly monitors: MonitorService,
    @InjectQueue(MonitorQueue.check)
    private readonly checks: Queue<MonitorCheckJob>,
    @Inject(queueConfig.KEY)
    private readonly config: ConfigType<typeof queueConfig>
  ) {
    super()
  }

  public onApplicationBootstrap(): void {
    void this.worker.run()
  }

  public async process(): Promise<MonitorScanResult> {
    const due = await this.monitors.claimDue(this.config.batchSize)

    if (!due.length) {
      return { claimed: 0 }
    }

    await this.checks.addBulk(
      due.map(({ id, dueAt }) => ({
        name: MonitorJob.check,
        data: { monitorId: id, dueAt },
        opts: { jobId: checkJobId(id, dueAt) }
      }))
    )

    return { claimed: due.length }
  }
}
