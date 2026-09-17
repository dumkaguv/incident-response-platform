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

import { Omittable } from '@/core/graphql'
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
    nullable: true,
    description: 'Defaults to GET'
  })
  @Omittable()
  @IsIn(Object.values(MonitorMethod))
  method?: MonitorMethod

  @Field(() => Int, {
    nullable: true,
    description: `How often to probe (${MonitorLimit.intervalSecondsMin}-${MonitorLimit.intervalSecondsMax} seconds, defaults to 60)`
  })
  @Omittable()
  @IsInt()
  @Min(MonitorLimit.intervalSecondsMin)
  @Max(MonitorLimit.intervalSecondsMax)
  intervalSeconds?: number

  @Field(() => Int, {
    nullable: true,
    description: `How long a probe may take before it counts as timed out (${MonitorLimit.timeoutMsMin}-${MonitorLimit.timeoutMsMax} ms, defaults to 5000)`
  })
  @Omittable()
  @IsInt()
  @Min(MonitorLimit.timeoutMsMin)
  @Max(MonitorLimit.timeoutMsMax)
  timeoutMs?: number

  @Field(() => Int, {
    nullable: true,
    description:
      'Lowest response code that still counts as healthy; defaults to 200'
  })
  @Omittable()
  @IsInt()
  @Min(MonitorLimit.statusCodeMin)
  @Max(MonitorLimit.statusCodeMax)
  expectedStatusMin?: number

  @Field(() => Int, {
    nullable: true,
    description:
      'Highest response code that still counts as healthy; defaults to 299'
  })
  @IsOptional()
  @IsInt()
  @Min(MonitorLimit.statusCodeMin)
  @Max(MonitorLimit.statusCodeMax)
  expectedStatusMax?: number

  @Field(() => Boolean, {
    nullable: true,
    description: 'A paused monitor is never probed; defaults to true'
  })
  @Omittable()
  @IsBoolean()
  isActive?: boolean
}

export type MonitorCreateData = CreateMonitorInput
