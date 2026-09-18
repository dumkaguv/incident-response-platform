import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { NotFoundError } from '@/common/utils'
import { MonitorRepository } from '@/modules/monitor/repositories'
import type { Connection, QuerySpec } from '@/core/pagination'
import type {
  MonitorCreateData,
  MonitorUpdateData
} from '@/modules/monitor/inputs'
import type { Monitor } from '@/modules/monitor/types'

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

  public listByIds(ids: readonly string[]): Promise<Monitor[]> {
    return this.monitors.findByIds(ids)
  }

  public create(data: MonitorCreateData): Promise<Monitor> {
    return this.monitors.create(data)
  }

  public async update(id: string, data: MonitorUpdateData): Promise<Monitor> {
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    ) as MonitorUpdateData

    if (!Object.keys(patch).length) {
      return this.getById(id)
    }

    return this.found(await this.monitors.update(id, patch), id)
  }

  public async remove(id: string): Promise<Monitor> {
    return this.found(await this.monitors.delete(id), id)
  }

  private found(monitor: Monitor | null, id: string): Monitor {
    if (!monitor) {
      throw new NotFoundError(msg`Monitor "${id}" was not found`)
    }

    return monitor
  }
}
