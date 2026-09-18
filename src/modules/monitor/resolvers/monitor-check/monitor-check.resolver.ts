import { msg } from '@lingui/core/macro'
import {
  Args,
  ArgsType,
  Context,
  Info,
  Parent,
  Query,
  ResolveField,
  Resolver
} from '@nestjs/graphql'
import type { GraphQLResolveInfo } from 'graphql'

import { NotFoundError } from '@/common/utils'
import { QueryArgsFor, connectionSelection, loadRelation } from '@/core/graphql'
import {
  MonitorCheckConnection,
  MonitorCheckObject,
  MonitorObject
} from '@/modules/monitor/models'
import { MonitorCheckService, MonitorService } from '@/modules/monitor/services'
import type { GqlContext } from '@/core/graphql'
import type { Connection } from '@/core/pagination'
import type { Monitor, MonitorCheck } from '@/modules/monitor/types'

import { monitorCheckQuery } from './monitor-check.query'

@ArgsType()
export class MonitorCheckQueryArgs extends QueryArgsFor(monitorCheckQuery) {}

@Resolver(() => MonitorCheckObject)
export class MonitorCheckResolver {
  constructor(
    private readonly checkService: MonitorCheckService,
    private readonly monitorService: MonitorService
  ) {}

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

  @ResolveField(() => MonitorObject, {
    description: 'The monitor this probe was recorded for'
  })
  public async monitor(
    @Parent() check: MonitorCheck,
    @Context() context: GqlContext,
    @Info() info: GraphQLResolveInfo
  ): Promise<Monitor> {
    const { monitorId: id } = check
    const monitor = await loadRelation(context, info, id, (ids) =>
      this.monitorService.listByIds(ids)
    )

    if (!monitor) {
      throw new NotFoundError(msg`Monitor "${id}" was not found`)
    }

    return monitor
  }
}
