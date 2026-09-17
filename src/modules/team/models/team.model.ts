import { Field, ID, ObjectType } from '@nestjs/graphql'

import { DateTimeScalar } from '@/core/graphql'

import { TeamTypeName } from '../constants'
import type { Team } from '../types'

@ObjectType(TeamTypeName.team)
export class TeamObject implements Team {
  @Field(() => ID)
  id: string

  @Field(() => String)
  name: string

  @Field(() => String)
  slug: string

  @Field(() => String, { nullable: true })
  description: string | null

  @Field(() => DateTimeScalar)
  createdAt: string

  @Field(() => DateTimeScalar)
  updatedAt: string
}
