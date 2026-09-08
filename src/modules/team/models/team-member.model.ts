import { Field, ID, ObjectType } from '@nestjs/graphql'

import { DateTimeScalar, registerQueryEnum } from '@/core/graphql'

import { type TeamMember, TeamRole } from '../types/team.types'

registerQueryEnum(TeamRole, 'TeamRole', {
  description: 'What a member is expected to do during an incident'
})

@ObjectType('TeamMember')
export class TeamMemberObject implements TeamMember {
  @Field(() => ID)
  id: string

  @Field(() => ID)
  teamId: string

  @Field(() => String)
  name: string

  @Field(() => String)
  email: string

  @Field(() => TeamRole)
  role: TeamRole

  @Field(() => DateTimeScalar)
  createdAt: string

  @Field(() => DateTimeScalar)
  updatedAt: string
}
