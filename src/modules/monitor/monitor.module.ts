import { Module } from '@nestjs/common'

import { MonitorCheckRepository, MonitorRepository } from './repositories'
import {
  MonitorCheckResolver,
  MonitorChecksResolver,
  MonitorResolver
} from './resolvers'
import { MonitorCheckService, MonitorService } from './services'

@Module({
  providers: [
    MonitorRepository,
    MonitorCheckRepository,
    MonitorService,
    MonitorCheckService,
    MonitorResolver,
    MonitorCheckResolver,
    MonitorChecksResolver
  ]
})
export class MonitorModule {}
