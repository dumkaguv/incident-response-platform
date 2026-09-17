import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { TooManyRequestsError } from '@/common/utils'
import { MonitorLimit } from '@/modules/monitor/constants'
import { MonitorCheckRepository } from '@/modules/monitor/repositories'
import { MonitorService } from '@/modules/monitor/services/monitor'
import { probe } from '@/modules/monitor/utils'
import type { Connection, QuerySpec } from '@/core/pagination'
import type { MonitorCheck } from '@/modules/monitor/types'

@Injectable()
export class MonitorCheckService {
  private probesInFlight = 0

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
    if (this.probesInFlight >= MonitorLimit.probesInFlight) {
      throw new TooManyRequestsError(
        msg`Too many probes are running right now, retry in a moment`
      )
    }

    this.probesInFlight += 1

    try {
      const monitor = await this.monitors.getById(monitorId)
      const outcome = await probe(monitor)
      const check = await this.checks.create({
        monitorId: monitor.id,
        ...outcome
      })

      await this.monitors.recordOutcome(monitor, check)

      return check
    } finally {
      this.probesInFlight -= 1
    }
  }
}
