import { Field, InputType } from '@nestjs/graphql'
import { IsIn, IsOptional, Length, MaxLength } from 'class-validator'

import { IncidentLimit } from '../constants'
import { IncidentSeverity } from '../types'

@InputType()
export class CreateIncidentInput {
  @Field(() => String, {
    description: `What happened, in one line (${IncidentLimit.titleMin}-${IncidentLimit.titleMax} characters)`
  })
  @Length(IncidentLimit.titleMin, IncidentLimit.titleMax)
  title: string

  @Field(() => String, {
    nullable: true,
    description: `Any further detail worth recording (up to ${IncidentLimit.descriptionMax} characters)`
  })
  @IsOptional()
  @MaxLength(IncidentLimit.descriptionMax)
  description?: string | null

  @Field(() => IncidentSeverity, {
    description: 'How badly the incident affects the business'
  })
  @IsIn(Object.values(IncidentSeverity))
  severity: IncidentSeverity
}

export type IncidentCreateData = CreateIncidentInput
