import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { NotFoundError } from '@/common/utils'
import type { Connection, QuerySpec } from '@/core/pagination'

import { MonitorRepository } from '../repositories'
import type { MonitorCreateData, MonitorUpdateData } from '../inputs'
import type { Monitor } from '../types'

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

  private found(monitor: Monitor | null, id: string): Monitor {
    if (!monitor) {
      throw new NotFoundError(msg`Monitor "${id}" was not found`)
    }

    return monitor
  }
}
