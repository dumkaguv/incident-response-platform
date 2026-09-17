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
  ArgName,
  QueryArgsFor,
  connectionSelection,
  loadRelation
} from '@/core/graphql'
import { TeamObject } from '@/modules/team/models'
import { TeamRepository } from '@/modules/team/repositories'
import type { Connection } from '@/core/pagination'
import type { Team } from '@/modules/team/types'

import { CreateIncidentInput, UpdateIncidentInput } from '../inputs'
import { IncidentConnection, IncidentObject } from '../models'
import { IncidentService } from '../services'
import type { Incident } from '../types'

import { incidentQuery } from './incident.query'

@ArgsType()
export class IncidentQueryArgs extends QueryArgsFor(incidentQuery) {}

@Resolver(() => IncidentObject)
export class IncidentResolver {
  constructor(
    private readonly incidentService: IncidentService,
    private readonly teams: TeamRepository
  ) {}

  @ResolveField(() => TeamObject, {
    nullable: true,
    description: 'Team that owns the incident'
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
    description: 'Incidents, with filtering, search, sorting and pagination'
  })
  public incidents(
    @Args() args: IncidentQueryArgs,
    @Info() info: GraphQLResolveInfo
  ): Promise<Connection<Incident>> {
    return this.incidentService.list(args.toSpec(), connectionSelection(info))
  }

  @Query(() => IncidentObject, { description: 'A single incident by id' })
  public incident(
    @Args(ArgName.id, { type: () => ID }) id: string
  ): Promise<Incident> {
    return this.incidentService.getById(id)
  }

  @Mutation(() => IncidentObject, { description: 'Creates an incident' })
  public createIncident(
    @Args(ArgName.input) input: CreateIncidentInput
  ): Promise<Incident> {
    return this.incidentService.create(input)
  }

  @Mutation(() => IncidentObject, { description: 'Updates an incident' })
  public updateIncident(
    @Args(ArgName.id, { type: () => ID }) id: string,
    @Args(ArgName.input) input: UpdateIncidentInput
  ): Promise<Incident> {
    return this.incidentService.update(id, input)
  }

  @Mutation(() => IncidentObject, {
    description: 'Marks the incident as resolved'
  })
  public resolveIncident(
    @Args(ArgName.id, { type: () => ID }) id: string
  ): Promise<Incident> {
    return this.incidentService.resolve(id)
  }

  @Mutation(() => IncidentObject, {
    description: 'Deletes the incident and returns it as it was'
  })
  public deleteIncident(
    @Args(ArgName.id, { type: () => ID }) id: string
  ): Promise<Incident> {
    return this.incidentService.remove(id)
  }
}
