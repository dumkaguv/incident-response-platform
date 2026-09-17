import { Injectable } from '@nestjs/common'

import { MonitorCheckRepository } from '@/modules/monitor/repositories'
import { MonitorService } from '@/modules/monitor/services/monitor'
import { probe } from '@/modules/monitor/utils'
import type { Connection, QuerySpec } from '@/core/pagination'
import type { MonitorCheck } from '@/modules/monitor/types'

@Injectable()
export class MonitorCheckService {
  constructor(
    private readonly monitors: MonitorService,
    private readonly checks: MonitorCheckRepository
  ) {}

  public list(
    spec: QuerySpec,
    fields?: readonly string[]
  ): Promise<Connection<MonitorCheck>> {
    return this.checks.list(spec, fields)
  }

  public async run(monitorId: string): Promise<MonitorCheck> {
    const monitor = await this.monitors.getById(monitorId)
    const outcome = await probe(monitor)

    return this.checks.create({ monitorId: monitor.id, ...outcome })
  }
}
