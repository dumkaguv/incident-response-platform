import {
  Args,
  ArgsType,
  ID,
  Info,
  Mutation,
  Query,
  Resolver
} from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import { ArgName, QueryArgsFor, connectionSelection } from '@/core/graphql'
import type { Connection } from '@/core/pagination'

import { CreateMonitorInput, UpdateMonitorInput } from '../inputs'
import { MonitorCheckObject, MonitorConnection, MonitorObject } from '../models'
import { MonitorCheckService, MonitorService } from '../services'
import type { Monitor, MonitorCheck } from '../types'

import { monitorQuery } from './monitor.query'

@ArgsType()
export class MonitorQueryArgs extends QueryArgsFor(monitorQuery) {}

@Resolver(() => MonitorObject)
export class MonitorResolver {
  constructor(
    private readonly monitorService: MonitorService,
    private readonly checkService: MonitorCheckService
  ) {}

  @Query(() => MonitorConnection, {
    description: 'Monitors, with filtering, search, sorting and pagination'
  })
  public monitors(
    @Args() args: MonitorQueryArgs,
    @Info() info: GraphQLResolveInfo
  ): Promise<Connection<Monitor>> {
    return this.monitorService.list(args.toSpec(), connectionSelection(info))
  }

  @Query(() => MonitorObject, { description: 'A single monitor by id' })
  public monitor(
    @Args(ArgName.id, { type: () => ID }) id: string
  ): Promise<Monitor> {
    return this.monitorService.getById(id)
  }

  @Mutation(() => MonitorObject, { description: 'Creates a monitor' })
  public createMonitor(
    @Args(ArgName.input) input: CreateMonitorInput
  ): Promise<Monitor> {
    return this.monitorService.create(input)
  }

  @Mutation(() => MonitorObject, { description: 'Updates a monitor' })
  public updateMonitor(
    @Args(ArgName.id, { type: () => ID }) id: string,
    @Args(ArgName.input) input: UpdateMonitorInput
  ): Promise<Monitor> {
    return this.monitorService.update(id, input)
  }

  @Mutation(() => MonitorObject, {
    description: 'Deletes the monitor and its history, and returns it as it was'
  })
  public deleteMonitor(
    @Args(ArgName.id, { type: () => ID }) id: string
  ): Promise<Monitor> {
    return this.monitorService.remove(id)
  }

  @Mutation(() => MonitorCheckObject, {
    description: 'Probes the monitor once, right now, and records the result'
  })
  public checkMonitor(
    @Args(ArgName.id, { type: () => ID }) id: string
  ): Promise<MonitorCheck> {
    return this.checkService.run(id)
  }
}
