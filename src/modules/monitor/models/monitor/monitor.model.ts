import { Field, ID, Int, ObjectType } from '@nestjs/graphql'

import { DateTimeScalar, registerQueryEnum } from '@/core/graphql'
import { Connected } from '@/core/pagination'
import { MonitorTypeName } from '@/modules/monitor/constants'
import {
  type Monitor,
  MonitorMethod,
  MonitorStatus
} from '@/modules/monitor/types'

registerQueryEnum(MonitorMethod, MonitorTypeName.method, {
  description: 'HTTP method the probe sends'
})

@ObjectType(MonitorTypeName.monitor)
export class MonitorObject implements Monitor {
  @Field(() => ID)
  id: string

  @Field(() => String, { description: 'Label shown in lists and alerts' })
  name: string

  @Field(() => String, { description: 'Absolute http(s) address to probe' })
  url: string

  @Field(() => MonitorMethod)
  method: MonitorMethod

  @Field(() => Int, { description: 'How often the probe should run' })
  intervalSeconds: number

  @Field(() => Int, {
    description: 'How long a probe may take before it counts as timed out'
  })
  timeoutMs: number

  @Field(() => Int, {
    description: 'Lowest response code that still counts as healthy'
  })
  expectedStatusMin: number

  @Field(() => Int, {
    description: 'Highest response code that still counts as healthy'
  })
  expectedStatusMax: number

  @Field(() => Boolean, { description: 'A paused monitor is never probed' })
  isActive: boolean

  @Field(() => DateTimeScalar, { description: 'When the next probe falls due' })
  nextCheckAt: string

  @Field(() => MonitorStatus, {
    nullable: true,
    description: 'Result of the most recent probe; empty until one has run'
  })
  lastStatus: MonitorStatus | null

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'When the most recent probe ran'
  })
  lastCheckedAt: string | null

  @Field(() => Int, {
    nullable: true,
    description: 'Response code of the most recent probe'
  })
  lastStatusCode: number | null

  @Field(() => Int, {
    nullable: true,
    description: 'Round trip of the most recent probe, in milliseconds'
  })
  lastResponseTimeMs: number | null

  @Field(() => Int, {
    description: 'Failures since the last success; reset to zero by a success'
  })
  consecutiveFailures: number

  @Field(() => DateTimeScalar)
  createdAt: string

  @Field(() => DateTimeScalar)
  updatedAt: string
}

@ObjectType()
export class MonitorConnection extends Connected(MonitorObject) {}
