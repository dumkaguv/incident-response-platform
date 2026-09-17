import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/core/prisma/prisma.service'
import { listConnection } from '@/core/prisma/utils/query-table'
import type { Connection, QuerySpec } from '@/core/pagination'
import type { Db } from '@/core/prisma/utils/db'

import type { MonitorCheckCreateData } from '../inputs'
import type { MonitorCheck } from '../types'

@Injectable()
export class MonitorCheckRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get table(): Db['orm']['public']['MonitorCheck'] {
    return this.prisma.db.orm.public.MonitorCheck
  }

  public list(
    spec: QuerySpec,
    fields?: readonly string[]
  ): Promise<Connection<MonitorCheck>> {
    return listConnection(this.prisma.db, 'MonitorCheck', spec, fields)
  }

  public create(data: MonitorCheckCreateData): Promise<MonitorCheck> {
    return this.table.create(data)
  }

  public async findByMonitorIds(
    ids: readonly string[]
  ): Promise<MonitorCheck[]> {
    const rows = await this.table
      .where((fields) => fields.monitorId.in([...ids]))
      .orderBy((fields) => fields.checkedAt.desc())
      .all()

    return [...rows]
  }
}
