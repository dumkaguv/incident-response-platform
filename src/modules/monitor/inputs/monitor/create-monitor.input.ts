import { Field, InputType, Int } from '@nestjs/graphql'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min
} from 'class-validator'

import { columnDefault } from '@/core/prisma/utils/contract-meta'
import { MonitorLimit } from '@/modules/monitor/constants'
import { MonitorMethod } from '@/modules/monitor/types'

@InputType()
export class CreateMonitorInput {
  @Field(() => String, {
    description: `Label shown in lists and alerts (${MonitorLimit.nameMin}-${MonitorLimit.nameMax} characters)`
  })
  @Length(MonitorLimit.nameMin, MonitorLimit.nameMax)
  name: string

  @Field(() => String, {
    description: 'Absolute http(s) address to probe'
  })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(MonitorLimit.urlMax)
  url: string

  @Field(() => MonitorMethod, {
    defaultValue: columnDefault('Monitor', 'method'),
    description: 'HTTP method the probe sends'
  })
  @IsIn(Object.values(MonitorMethod))
  method?: MonitorMethod

  @Field(() => Int, {
    defaultValue: columnDefault('Monitor', 'intervalSeconds'),
    description: `How often to probe (${MonitorLimit.intervalSecondsMin}-${MonitorLimit.intervalSecondsMax} seconds)`
  })
  @IsInt()
  @Min(MonitorLimit.intervalSecondsMin)
  @Max(MonitorLimit.intervalSecondsMax)
  intervalSeconds?: number

  @Field(() => Int, {
    defaultValue: columnDefault('Monitor', 'timeoutMs'),
    description: `How long a probe may take before it counts as timed out (${MonitorLimit.timeoutMsMin}-${MonitorLimit.timeoutMsMax} ms)`
  })
  @IsInt()
  @Min(MonitorLimit.timeoutMsMin)
  @Max(MonitorLimit.timeoutMsMax)
  timeoutMs?: number

  @Field(() => Int, {
    defaultValue: columnDefault('Monitor', 'expectedStatusMin'),
    description: 'Lowest response code that still counts as healthy'
  })
  @IsInt()
  @Min(MonitorLimit.statusCodeMin)
  @Max(MonitorLimit.statusCodeMax)
  expectedStatusMin?: number

  @Field(() => Int, {
    defaultValue: columnDefault('Monitor', 'expectedStatusMax'),
    description: 'Highest response code that still counts as healthy'
  })
  @IsInt()
  @Min(MonitorLimit.statusCodeMin)
  @Max(MonitorLimit.statusCodeMax)
  expectedStatusMax?: number

  @Field(() => Boolean, {
    defaultValue: columnDefault<boolean>('Monitor', 'isActive'),
    description: 'A paused monitor is never probed'
  })
  @IsBoolean()
  isActive?: boolean
}

export type MonitorCreateData = CreateMonitorInput
