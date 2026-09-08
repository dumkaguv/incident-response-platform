import { Context, Info, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import { type GqlContext, loadRelations } from '@/graphql'

import { TeamMemberObject } from '../models/team-member.model'
import { TeamObject } from '../models/team.model'
import { TeamRepositoryInterface } from '../repositories/team.repository.interface'
import type { Team, TeamMember } from '../types/team.types'

@Resolver(() => TeamObject)
export class TeamResolver {
  constructor(private readonly teams: TeamRepositoryInterface) {}

  @ResolveField(() => [TeamMemberObject], {
    description: 'Members on call for the team; one batched query per request'
  })
  public members(
    @Parent() team: Team,
    @Context() context: GqlContext,
    @Info() info: GraphQLResolveInfo
  ): Promise<TeamMember[]> {
    return loadRelations(context, info, team.id, {
      fetch: (ids) => this.teams.findMembersByTeamIds(ids),
      identify: (row) => row.teamId
    })
  }
}
