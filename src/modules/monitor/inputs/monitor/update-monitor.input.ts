import { InputType, PartialType } from '@nestjs/graphql'

import type { MonitorStatus } from '@/modules/monitor/types'

import { CreateMonitorInput } from './create-monitor.input'

@InputType()
export class UpdateMonitorInput extends PartialType(CreateMonitorInput) {}

export type MonitorUpdateData = UpdateMonitorInput & {
  nextCheckAt?: string
  lastStatus?: MonitorStatus
  lastCheckedAt?: string
  lastStatusCode?: number | null
  lastResponseTimeMs?: number | null
  consecutiveFailures?: number
}
