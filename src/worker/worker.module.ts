import { Module } from '@nestjs/common'

import { AppConfigModule } from '@/core/config'
import { I18nModule } from '@/core/i18n'
import { PrismaModule } from '@/core/prisma/prisma.module'
import { QueueModule } from '@/core/queue'
import { MonitorJobsModule } from '@/modules/monitor/monitor-jobs.module'

@Module({
  imports: [
    AppConfigModule,
    I18nModule,
    PrismaModule,
    QueueModule,
    MonitorJobsModule
  ]
})
export class WorkerModule {}
