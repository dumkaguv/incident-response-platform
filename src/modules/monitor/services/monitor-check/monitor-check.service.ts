import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { ConflictError, TooManyRequestsError, found } from '@/common/utils'
import { MonitorLimit } from '@/modules/monitor/constants'
import { MonitorCheckRepository } from '@/modules/monitor/repositories'
import { MonitorService } from '@/modules/monitor/services/monitor'
import { probe } from '@/modules/monitor/utils'
import type {
  Connection,
  ConnectionSelection,
  QuerySpec
} from '@/core/pagination'
import type { Monitor, MonitorCheck } from '@/modules/monitor/types'

@Injectable()
export class MonitorCheckService {
  private probesInFlight = 0

  constructor(
    private readonly monitors: MonitorService,
    private readonly checks: MonitorCheckRepository
  ) {}

  public list(
    spec: QuerySpec,
    selection?: ConnectionSelection
  ): Promise<Connection<MonitorCheck>> {
    return this.checks.list(spec, selection)
  }

  public async run(id: string): Promise<MonitorCheck> {
    if (this.probesInFlight >= MonitorLimit.probesInFlight) {
      throw new TooManyRequestsError(
        msg`Too many probes are running right now, retry in a moment`
      )
    }

    this.probesInFlight += 1

    try {
      const monitor = await this.monitors.getById(id)

      if (!monitor.isActive) {
        throw new ConflictError(msg`Monitor "${id}" is paused`)
      }

      return found(
        await this.record(monitor),
        msg`Monitor "${id}" was not found`
      )
    } finally {
      this.probesInFlight -= 1
    }
  }

  public async runScheduled(id: string): Promise<MonitorCheck | null> {
    const monitor = await this.monitors.findById(id)

    if (!monitor?.isActive) {
      return null
    }

    return this.record(monitor)
  }

  private async record(monitor: Monitor): Promise<MonitorCheck | null> {
    const checkedAt = new Date().toISOString()
    const outcome = await probe(monitor)

    return this.checks.recordOutcome({
      monitorId: monitor.id,
      checkedAt,
      ...outcome
    })
  }
}
