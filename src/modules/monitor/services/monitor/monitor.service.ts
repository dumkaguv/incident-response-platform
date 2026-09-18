import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { BadUserInputError, NotFoundError } from '@/common/utils'
import { MonitorRepository } from '@/modules/monitor/repositories'
import type { Connection, QuerySpec } from '@/core/pagination'
import type {
  MonitorCreateData,
  MonitorUpdateData
} from '@/modules/monitor/inputs'
import type { Monitor } from '@/modules/monitor/types'

function assertStatusRange(
  expectedStatusMin: number | undefined,
  expectedStatusMax: number | undefined
): void {
  if (
    expectedStatusMin !== undefined &&
    expectedStatusMax !== undefined &&
    expectedStatusMin > expectedStatusMax
  ) {
    throw new BadUserInputError(
      msg`expectedStatusMin must not exceed expectedStatusMax`
    )
  }
}

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

  public async create(data: MonitorCreateData): Promise<Monitor> {
    assertStatusRange(data.expectedStatusMin, data.expectedStatusMax)

    const created = await this.monitors.create(data)

    return created
  }

  public async update(id: string, data: MonitorUpdateData): Promise<Monitor> {
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    ) as MonitorUpdateData

    if (!Object.keys(patch).length) {
      return this.getById(id)
    }

    if (
      patch.expectedStatusMin !== undefined ||
      patch.expectedStatusMax !== undefined
    ) {
      const current = await this.getById(id)

      assertStatusRange(
        patch.expectedStatusMin ?? current.expectedStatusMin,
        patch.expectedStatusMax ?? current.expectedStatusMax
      )
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
