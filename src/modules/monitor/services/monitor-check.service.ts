import { Injectable } from '@nestjs/common'

import type { Connection, QuerySpec } from '@/core/pagination'

import { MonitorCheckRepository } from '../repositories'
import type { MonitorCheck } from '../types'

import { MonitorService } from './monitor.service'
import { probe } from './probe'

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
