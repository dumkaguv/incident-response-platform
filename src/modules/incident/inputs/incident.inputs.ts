import { Field, InputType, PartialType } from '@nestjs/graphql'
import { IsIn, IsOptional, Length, MaxLength } from 'class-validator'

import { IncidentSeverity, IncidentStatus } from '../types/incident.types'

@InputType()
export class CreateIncidentInput {
  @Field(() => String)
  @Length(3, 200)
  title: string

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(2000)
  description?: string | null

  @Field(() => IncidentSeverity)
  @IsIn(Object.values(IncidentSeverity))
  severity: IncidentSeverity
}

@InputType()
export class UpdateIncidentInput extends PartialType(CreateIncidentInput) {
  @Field(() => IncidentStatus, { nullable: true })
  @IsOptional()
  @IsIn(Object.values(IncidentStatus))
  status?: IncidentStatus
}

export type IncidentCreateData = CreateIncidentInput

export type IncidentUpdateData = UpdateIncidentInput & {
  resolvedAt?: string | null
}
