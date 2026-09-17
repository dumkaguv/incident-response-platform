import { Context, Info, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import { type GqlContext, loadRelations } from '@/core/graphql'
import { TeamObject } from '@/modules/team/models'
import type { Team } from '@/modules/team/types'

import { IncidentObject } from '../models'
import { IncidentRepository } from '../repositories'
import type { Incident } from '../types'

@Resolver(() => TeamObject)
export class TeamIncidentsResolver {
  constructor(private readonly repository: IncidentRepository) {}

  @ResolveField(() => [IncidentObject], {
    description: 'Incidents owned by the team'
  })
  public incidents(
    @Parent() team: Team,
    @Context() context: GqlContext,
    @Info() info: GraphQLResolveInfo
  ): Promise<Incident[]> {
    return loadRelations(context, info, team.id, {
      fetch: (ids) => this.repository.findByTeamIds(ids),
      identify: (row) => row.teamId
    })
  }
}
