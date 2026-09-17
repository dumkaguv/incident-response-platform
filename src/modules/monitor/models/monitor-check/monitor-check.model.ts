import { Field, ID, Int, ObjectType } from '@nestjs/graphql'

import { DateTimeScalar, registerQueryEnum } from '@/core/graphql'
import { Connected } from '@/core/pagination'
import { MonitorTypeName } from '@/modules/monitor/constants'
import {
  type MonitorCheck,
  CheckErrorType,
  MonitorStatus
} from '@/modules/monitor/types'

registerQueryEnum(MonitorStatus, MonitorTypeName.status, {
  description: 'Whether the probe reached a healthy response'
})

registerQueryEnum(CheckErrorType, MonitorTypeName.errorType, {
  description: 'Why a probe failed'
})

@ObjectType(MonitorTypeName.check)
export class MonitorCheckObject implements MonitorCheck {
  @Field(() => ID)
  id: string

  @Field(() => ID)
  monitorId: string

  @Field(() => MonitorStatus)
  status: MonitorStatus

  @Field(() => Int, {
    nullable: true,
    description: 'Response code, absent when no response arrived'
  })
  statusCode: number | null

  @Field(() => Int, {
    nullable: true,
    description: 'Round trip in milliseconds, absent when no response arrived'
  })
  responseTimeMs: number | null

  @Field(() => CheckErrorType, {
    nullable: true,
    description: 'Set only when the probe failed'
  })
  errorType: CheckErrorType | null

  @Field(() => DateTimeScalar, { description: 'When the probe ran' })
  checkedAt: string
}

@ObjectType()
export class MonitorCheckConnection extends Connected(MonitorCheckObject) {}
