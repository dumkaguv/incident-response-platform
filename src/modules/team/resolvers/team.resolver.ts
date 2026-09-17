import { Context, Info, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import { type GqlContext, loadRelations } from '@/core/graphql'

import { TeamMemberObject, TeamObject } from '../models'
import { TeamRepository } from '../repositories'
import type { Team, TeamMember } from '../types'

@Resolver(() => TeamObject)
export class TeamResolver {
  constructor(private readonly teams: TeamRepository) {}

  @ResolveField(() => [TeamMemberObject], {
    description: 'People who belong to the team'
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
