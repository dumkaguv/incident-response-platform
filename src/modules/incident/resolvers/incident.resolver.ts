import {
  Args,
  ArgsType,
  Context,
  ID,
  Mutation,
  Info,
  Parent,
  Query,
  ResolveField,
  Resolver
} from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import {
  type GqlContext,
  QueryArgsFor,
  UNBOUNDED_LIST_FANOUT,
  connectionSelection,
  loadRelation
} from '@/core/graphql'
import { WriteThrottle } from '@/core/throttler'
import { TeamObject } from '@/modules/team/models/team.model'
import { TeamRepositoryInterface } from '@/modules/team/repositories/team.repository.interface'
import type { Connection } from '@/core/pagination'
import type { Team } from '@/modules/team/types/team.types'

import {
  CreateIncidentInput,
  UpdateIncidentInput
} from '../inputs/incident.inputs'
import { IncidentConnection, IncidentObject } from '../models/incident.model'
import { IncidentService } from '../services/incident.service'
import type { Incident } from '../types/incident.types'

import { incidentQuery } from './incident.query'

@ArgsType()
export class IncidentQueryArgs extends QueryArgsFor(incidentQuery) {}

@Resolver(() => IncidentObject)
export class IncidentResolver {
  constructor(
    private readonly incidentService: IncidentService,
    private readonly teams: TeamRepositoryInterface
  ) {}

  @ResolveField(() => TeamObject, {
    nullable: true,
    description: 'Owning team; batched per request, never one query per row'
  })
  public team(
    @Parent() incident: Incident,
    @Context() context: GqlContext,
    @Info() info: GraphQLResolveInfo
  ): Promise<Team | null> {
    return loadRelation(context, info, incident.teamId, (ids) =>
      this.teams.findByIds(ids)
    )
  }

  @Query(() => IncidentConnection, {
    description:
      'Keyset-paginated incidents with recursive filters, search and orderBy (edges, nodes, pageInfo, totalCount)'
  })
  public incidents(
    @Args() args: IncidentQueryArgs,
    @Info() info: GraphQLResolveInfo
  ): Promise<Connection<Incident>> {
    return this.incidentService.list(args.toSpec(), connectionSelection(info))
  }

  @Query(() => IncidentObject, { description: 'Single incident by id' })
  public incident(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Incident> {
    return this.incidentService.getById(id)
  }

  @Mutation(() => IncidentObject)
  @WriteThrottle()
  public createIncident(
    @Args('input') input: CreateIncidentInput
  ): Promise<Incident> {
    return this.incidentService.create(input)
  }

  @Mutation(() => IncidentObject)
  @WriteThrottle()
  public updateIncident(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateIncidentInput
  ): Promise<Incident> {
    return this.incidentService.update(id, input)
  }

  @Mutation(() => IncidentObject, {
    description: 'Marks the incident RESOLVED and stamps resolvedAt'
  })
  @WriteThrottle()
  public resolveIncident(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Incident> {
    return this.incidentService.resolve(id)
  }

  @Mutation(() => IncidentObject, {
    description: 'Deletes the incident and returns its last state'
  })
  @WriteThrottle()
  public deleteIncident(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Incident> {
    return this.incidentService.remove(id)
  }
}
