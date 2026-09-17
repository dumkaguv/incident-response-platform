import { Args, ArgsType, Info, Query, Resolver } from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import { QueryArgsFor, connectionSelection } from '@/core/graphql'
import {
  MonitorCheckConnection,
  MonitorCheckObject
} from '@/modules/monitor/models'
import { MonitorCheckService } from '@/modules/monitor/services'
import type { Connection } from '@/core/pagination'
import type { MonitorCheck } from '@/modules/monitor/types'

import { monitorCheckQuery } from './monitor-check.query'

@ArgsType()
export class MonitorCheckQueryArgs extends QueryArgsFor(monitorCheckQuery) {}

@Resolver(() => MonitorCheckObject)
export class MonitorCheckResolver {
  constructor(private readonly checkService: MonitorCheckService) {}

  @Query(() => MonitorCheckConnection, {
    description:
      'Recorded probes, newest first; filter by monitorId for one monitor'
  })
  public monitorChecks(
    @Args() args: MonitorCheckQueryArgs,
    @Info() info: GraphQLResolveInfo
  ): Promise<Connection<MonitorCheck>> {
    return this.checkService.list(args.toSpec(), connectionSelection(info))
  }
}
