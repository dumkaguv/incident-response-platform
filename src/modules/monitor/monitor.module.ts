import { Module } from '@nestjs/common'
import type { Redis } from 'ioredis'

import { REDIS_CLIENT, RedisModule } from '@/core/redis'

import { MONITOR_PROBE_GATE_KEY, MonitorLimit } from './constants'
import { MonitorCheckRepository, MonitorRepository } from './repositories'
import {
  MonitorCheckResolver,
  MonitorChecksResolver,
  MonitorResolver
} from './resolvers'
import { MonitorCheckService, MonitorService, ProbeGate } from './services'

function probeGate(redis: Redis): ProbeGate {
  return new ProbeGate(
    redis,
    MONITOR_PROBE_GATE_KEY,
    MonitorLimit.probesInFlight,
    MonitorLimit.probeLeaseMs
  )
}

@Module({
  imports: [RedisModule],
  providers: [
    { provide: ProbeGate, inject: [REDIS_CLIENT], useFactory: probeGate },
    MonitorRepository,
    MonitorCheckRepository,
    MonitorService,
    MonitorCheckService,
    MonitorResolver,
    MonitorCheckResolver,
    MonitorChecksResolver
  ],
  exports: [MonitorService, MonitorCheckService]
})
export class MonitorModule {}
