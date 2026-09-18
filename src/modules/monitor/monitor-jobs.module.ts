import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { MonitorQueue } from '@/modules/monitor/constants'
import {
  MonitorCheckProcessor,
  MonitorScanProcessor,
  MonitorScanScheduler
} from '@/modules/monitor/jobs'

import { MonitorModule } from './monitor.module'

@Module({
  imports: [
    MonitorModule,
    BullModule.registerQueue(
      { name: MonitorQueue.scan },
      { name: MonitorQueue.check }
    )
  ],
  providers: [MonitorScanScheduler, MonitorScanProcessor, MonitorCheckProcessor]
})
export class MonitorJobsModule {}
