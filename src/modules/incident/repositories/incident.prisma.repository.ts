import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/core/prisma/prisma.service'
import { listConnection } from '@/core/prisma/utils/query-table'
import type { Connection,QuerySpec } from '@/common/pagination'
import type { Db } from '@/core/prisma/utils/db'

import type {
  IncidentCreateData,
  IncidentUpdateData
} from '../inputs/incident.inputs'
import type { Incident } from '../types/incident.types'

import { IncidentRepositoryInterface } from './incident.repository.interface'

@Injectable()
export class IncidentPrismaRepository extends IncidentRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  private get table(): Db['orm']['public']['Incident'] {
    return this.prisma.db.orm.public.Incident
  }

  public list(
    spec: QuerySpec,
    fields?: readonly string[]
  ): Promise<Connection<Incident>> {
    return listConnection(this.prisma.db, 'Incident', spec, fields)
  }

  public findById(id: string): Promise<Incident | null> {
    return this.table.where((fields) => fields.id.eq(id)).first()
  }

  public async findByTeamIds(ids: readonly string[]): Promise<Incident[]> {
    const rows = await this.table
      .where((fields) => fields.teamId.in([...ids]))
      .all()

    return [...rows]
  }

  public create(data: IncidentCreateData): Promise<Incident> {
    return this.table.create(data)
  }

  public update(
    id: string,
    data: IncidentUpdateData
  ): Promise<Incident | null> {
    return this.table.where((fields) => fields.id.eq(id)).update(data)
  }

  public delete(id: string): Promise<Incident | null> {
    return this.table.where((fields) => fields.id.eq(id)).delete()
  }
}
