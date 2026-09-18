import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import type { Queue } from 'bullmq'

import { queueConfig } from '@/core/config'
import { KEPT_TICKS } from '@/core/queue'
import {
  MONITOR_SCAN_SCHEDULER,
  MonitorJob,
  MonitorQueue
} from '@/modules/monitor/constants'

@Injectable()
export class MonitorScanScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(MonitorQueue.scan) private readonly scans: Queue,
    @Inject(queueConfig.KEY)
    private readonly config: ConfigType<typeof queueConfig>
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    await this.scans.upsertJobScheduler(
      MONITOR_SCAN_SCHEDULER,
      { every: this.config.tickMs },
      {
        name: MonitorJob.scanDue,
        opts: { attempts: 1, removeOnComplete: { count: KEPT_TICKS } }
      }
    )
  }
}
