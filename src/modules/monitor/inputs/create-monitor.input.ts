import { Field, InputType, Int } from '@nestjs/graphql'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min
} from 'class-validator'

import { MonitorLimit } from '../constants'
import { MonitorMethod } from '../types'

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
  @IsOptional()
  @IsIn(Object.values(MonitorMethod))
  method?: MonitorMethod

  @Field(() => Int, {
    nullable: true,
    description: `How often to probe (${MonitorLimit.intervalSecondsMin}-${MonitorLimit.intervalSecondsMax} seconds, defaults to 60)`
  })
  @IsOptional()
  @IsInt()
  @Min(MonitorLimit.intervalSecondsMin)
  @Max(MonitorLimit.intervalSecondsMax)
  intervalSeconds?: number

  @Field(() => Int, {
    nullable: true,
    description: `How long a probe may take before it counts as timed out (${MonitorLimit.timeoutMsMin}-${MonitorLimit.timeoutMsMax} ms, defaults to 5000)`
  })
  @IsOptional()
  @IsInt()
  @Min(MonitorLimit.timeoutMsMin)
  @Max(MonitorLimit.timeoutMsMax)
  timeoutMs?: number

  @Field(() => Int, {
    nullable: true,
    description: 'Response code that counts as healthy; defaults to 200'
  })
  @IsOptional()
  @IsInt()
  @Min(MonitorLimit.statusCodeMin)
  @Max(MonitorLimit.statusCodeMax)
  expectedStatusCode?: number

  @Field(() => Boolean, {
    nullable: true,
    description: 'A paused monitor is never probed; defaults to true'
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export type MonitorCreateData = CreateMonitorInput
