import { msg } from '@lingui/core/macro'
import { Injectable } from '@nestjs/common'

import { ConflictError, NotFoundError } from '@/common/utils'
import type { Connection } from '@/common/pagination'
import type { QuerySpec } from '@/common/pagination/utils/query-spec'

import { IncidentRepositoryInterface } from '../repositories/incident.repository.interface'
import { type Incident, IncidentStatus } from '../types/incident.types'
import type {
  IncidentCreateData,
  IncidentUpdateData
} from '../inputs/incident.inputs'

@Injectable()
export class IncidentService {
  constructor(private readonly incidents: IncidentRepositoryInterface) {}

  public list(
    spec: QuerySpec,
    fields?: readonly string[]
  ): Promise<Connection<Incident>> {
    return this.incidents.list(spec, fields)
  }

  public async getById(id: string): Promise<Incident> {
    return this.found(await this.incidents.findById(id), id)
  }

  public create(data: IncidentCreateData): Promise<Incident> {
    return this.incidents.create(data)
  }

  public async update(id: string, data: IncidentUpdateData): Promise<Incident> {
    return this.found(await this.incidents.update(id, data), id)
  }

  public async resolve(id: string): Promise<Incident> {
    const incident = await this.getById(id)

    if (incident.status === IncidentStatus.RESOLVED) {
      throw new ConflictError(msg`Incident "${id}" is already resolved`)
    }

    return this.update(id, {
      status: IncidentStatus.RESOLVED,
      resolvedAt: new Date().toISOString()
    })
  }

  public async remove(id: string): Promise<Incident> {
    return this.found(await this.incidents.delete(id), id)
  }

  private found(incident: Incident | null, id: string): Incident {
    if (!incident) {
      throw new NotFoundError(msg`Incident "${id}" was not found`)
    }

    return incident
  }
}
