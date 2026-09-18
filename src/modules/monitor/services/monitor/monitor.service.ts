import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { found } from '@/common/utils'
import { MonitorRepository } from '@/modules/monitor/repositories'
import { assertStatusRange } from '@/modules/monitor/utils'
import type {
  Connection,
  ConnectionSelection,
  QuerySpec
} from '@/core/pagination'
import type {
  MonitorCreateData,
  MonitorUpdateData
} from '@/modules/monitor/inputs'
import type { Monitor, MonitorDue } from '@/modules/monitor/types'

@Injectable()
export class MonitorService {
  constructor(private readonly monitors: MonitorRepository) {}

  public list(
    spec: QuerySpec,
    selection?: ConnectionSelection
  ): Promise<Connection<Monitor>> {
    return this.monitors.list(spec, selection)
  }

  public async getById(id: string): Promise<Monitor> {
    return found(
      await this.monitors.findById(id),
      msg`Monitor "${id}" was not found`
    )
  }

  public findById(id: string): Promise<Monitor | null> {
    return this.monitors.findById(id)
  }

  public claimDue(limit: number): Promise<MonitorDue[]> {
    return this.monitors.claimDue(limit)
  }

  public releaseClaim(due: readonly MonitorDue[]): Promise<void> {
    return this.monitors.releaseClaim(due)
  }

  public listByIds(ids: readonly string[]): Promise<Monitor[]> {
    return this.monitors.findByIds(ids)
  }

  public async create(data: MonitorCreateData): Promise<Monitor> {
    assertStatusRange(data.expectedStatusMin, data.expectedStatusMax)

    return this.monitors.create(data)
  }

  public async update(id: string, data: MonitorUpdateData): Promise<Monitor> {
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    ) as MonitorUpdateData

    const nothingToWrite = Object.keys(patch).length === 0

    if (nothingToWrite) {
      return this.getById(id)
    }

    const touchesRange =
      patch.expectedStatusMin !== undefined ||
      patch.expectedStatusMax !== undefined

    if (touchesRange) {
      const current = await this.getById(id)
      const nextMin = patch.expectedStatusMin ?? current.expectedStatusMin
      const nextMax = patch.expectedStatusMax ?? current.expectedStatusMax

      assertStatusRange(nextMin, nextMax)
    }

    return found(
      await this.monitors.update(id, patch),
      msg`Monitor "${id}" was not found`
    )
  }

  public async remove(id: string): Promise<Monitor> {
    return found(
      await this.monitors.delete(id),
      msg`Monitor "${id}" was not found`
    )
  }
}
