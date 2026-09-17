import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { NotFoundError } from '@/common/utils'
import { MonitorRepository } from '@/modules/monitor/repositories'
import { MonitorStatus } from '@/modules/monitor/types'
import type { Connection, QuerySpec } from '@/core/pagination'
import type {
  MonitorCreateData,
  MonitorUpdateData
} from '@/modules/monitor/inputs'
import type { Monitor, MonitorCheck } from '@/modules/monitor/types'

type RecordedOutcome = Pick<
  MonitorCheck,
  'status' | 'statusCode' | 'responseTimeMs' | 'checkedAt'
>

@Injectable()
export class MonitorService {
  constructor(private readonly monitors: MonitorRepository) {}

  public list(
    spec: QuerySpec,
    fields?: readonly string[]
  ): Promise<Connection<Monitor>> {
    return this.monitors.list(spec, fields)
  }

  public async getById(id: string): Promise<Monitor> {
    return this.found(await this.monitors.findById(id), id)
  }

  public create(data: MonitorCreateData): Promise<Monitor> {
    return this.monitors.create(data)
  }

  public async update(id: string, data: MonitorUpdateData): Promise<Monitor> {
    return this.found(await this.monitors.update(id, data), id)
  }

  public async remove(id: string): Promise<Monitor> {
    return this.found(await this.monitors.delete(id), id)
  }

  public recordOutcome(
    monitor: Monitor,
    outcome: RecordedOutcome
  ): Promise<Monitor> {
    const failed = outcome.status === MonitorStatus.DOWN

    return this.update(monitor.id, {
      lastStatus: outcome.status,
      lastCheckedAt: outcome.checkedAt,
      lastStatusCode: outcome.statusCode,
      lastResponseTimeMs: outcome.responseTimeMs,
      consecutiveFailures: failed ? monitor.consecutiveFailures + 1 : 0,
      nextCheckAt: new Date(
        Date.parse(outcome.checkedAt) + monitor.intervalSeconds * 1000
      ).toISOString()
    })
  }

  private found(monitor: Monitor | null, id: string): Monitor {
    if (!monitor) {
      throw new NotFoundError(msg`Monitor "${id}" was not found`)
    }

    return monitor
  }
}
