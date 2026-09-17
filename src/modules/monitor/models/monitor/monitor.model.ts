import { Field, ID, Int, ObjectType } from '@nestjs/graphql'

import { DateTimeScalar, registerQueryEnum } from '@/core/graphql'
import { Connected } from '@/core/pagination'
import { MonitorTypeName } from '@/modules/monitor/constants'
import { type Monitor, MonitorMethod } from '@/modules/monitor/types'

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

  @Field(() => Int, { description: 'Response code that counts as healthy' })
  expectedStatusCode: number

  @Field(() => Boolean, { description: 'A paused monitor is never probed' })
  isActive: boolean

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'When the next probe falls due; empty until scheduled'
  })
  nextCheckAt: string | null

  @Field(() => DateTimeScalar)
  createdAt: string

  @Field(() => DateTimeScalar)
  updatedAt: string
}

@ObjectType()
export class MonitorConnection extends Connected(MonitorObject) {}
