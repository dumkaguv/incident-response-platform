import { Field, ID, ObjectType } from '@nestjs/graphql'

import { DateTimeScalar, registerQueryEnum } from '@/core/graphql'
import { Connected } from '@/core/pagination'

import { IncidentTypeName } from '../constants'
import { type Incident, IncidentSeverity, IncidentStatus } from '../types'

registerQueryEnum(IncidentStatus, IncidentTypeName.status, {
  description: 'Lifecycle status of an incident'
})

registerQueryEnum(IncidentSeverity, IncidentTypeName.severity, {
  description: 'Business impact of an incident'
})

@ObjectType(IncidentTypeName.incident)
export class IncidentObject implements Incident {
  @Field(() => ID)
  id: string

  @Field(() => String)
  title: string

  @Field(() => String, { nullable: true })
  description: string | null

  @Field(() => IncidentStatus)
  status: IncidentStatus

  @Field(() => IncidentSeverity)
  severity: IncidentSeverity

  @Field(() => DateTimeScalar)
  createdAt: string

  @Field(() => DateTimeScalar)
  updatedAt: string

  @Field(() => DateTimeScalar, { nullable: true })
  resolvedAt: string | null

  @Field(() => ID, { nullable: true })
  teamId: string | null
}

@ObjectType()
export class IncidentConnection extends Connected(IncidentObject) {}
