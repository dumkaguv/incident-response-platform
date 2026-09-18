import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { ConflictError, TooManyRequestsError, found } from '@/common/utils'
import { MonitorCheckRepository } from '@/modules/monitor/repositories'
import { MonitorService } from '@/modules/monitor/services/monitor'
import { probe } from '@/modules/monitor/utils'
import type {
  Connection,
  ConnectionSelection,
  QuerySpec
} from '@/core/pagination'
import type { Monitor, MonitorCheck } from '@/modules/monitor/types'

import { ProbeGate } from './probe-gate'

@Injectable()
export class MonitorCheckService {
  constructor(
    private readonly monitors: MonitorService,
    private readonly checks: MonitorCheckRepository,
    private readonly gate: ProbeGate
  ) {}

  public list(
    spec: QuerySpec,
    selection?: ConnectionSelection
  ): Promise<Connection<MonitorCheck>> {
    return this.checks.list(spec, selection)
  }

  public async run(id: string): Promise<MonitorCheck> {
    const lease = await this.gate.acquire()

    if (!lease) {
      throw new TooManyRequestsError(
        msg`Too many probes are running right now, retry in a moment`
      )
    }

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
      await lease.release()
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
