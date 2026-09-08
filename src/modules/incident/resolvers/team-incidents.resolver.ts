import { Context, Info, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import { type GqlContext, loadRelations } from '@/graphql'
import { TeamObject } from '@/modules/team/models/team.model'
import type { Team } from '@/modules/team/types/team.types'

import { IncidentObject } from '../models/incident.model'
import { IncidentRepositoryInterface } from '../repositories/incident.repository.interface'
import type { Incident } from '../types/incident.types'

@Resolver(() => TeamObject)
export class TeamIncidentsResolver {
  constructor(private readonly repository: IncidentRepositoryInterface) {}

  @ResolveField(() => [IncidentObject], {
    description: 'Incidents owned by the team; one batched query per request'
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
