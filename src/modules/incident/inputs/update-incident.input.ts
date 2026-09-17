import { Field, InputType, PartialType } from '@nestjs/graphql'
import { IsIn, IsOptional } from 'class-validator'

import { IncidentStatus } from '../types'

import { CreateIncidentInput } from './create-incident.input'

@InputType()
export class UpdateIncidentInput extends PartialType(CreateIncidentInput) {
  @Field(() => IncidentStatus, {
    nullable: true,
    description:
      'Where the incident stands; resolveIncident also stamps the resolution time'
  })
  @IsOptional()
  @IsIn(Object.values(IncidentStatus))
  status?: IncidentStatus
}

export type IncidentUpdateData = UpdateIncidentInput & {
  resolvedAt?: string | null
}
