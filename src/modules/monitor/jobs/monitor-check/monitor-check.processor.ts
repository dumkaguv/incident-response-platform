import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, OnApplicationBootstrap } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import type { Job } from 'bullmq'

import { queueConfig } from '@/core/config'
import { MonitorQueue } from '@/modules/monitor/constants'
import { MonitorCheckService } from '@/modules/monitor/services'
import type {
  MonitorCheckJob,
  MonitorCheckResult
} from '@/modules/monitor/types'

@Processor(MonitorQueue.check, { autorun: false })
export class MonitorCheckProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  constructor(
    private readonly checks: MonitorCheckService,
    @Inject(queueConfig.KEY)
    private readonly config: ConfigType<typeof queueConfig>
  ) {
    super()
  }

  public onApplicationBootstrap(): void {
    this.worker.concurrency = this.config.concurrency

    void this.worker.run()
  }

  public async process(job: Job<MonitorCheckJob>): Promise<MonitorCheckResult> {
    const check = await this.checks.runScheduled(
      job.data.monitorId,
      job.data.dueAt
    )

    return { checkId: check?.id ?? null, status: check?.status ?? null }
  }
}
