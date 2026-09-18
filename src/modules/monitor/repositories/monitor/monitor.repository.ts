import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/core/prisma/prisma.service'
import { listConnection } from '@/core/prisma/utils/query-table'
import type { Connection, QuerySpec } from '@/core/pagination'
import type { Db } from '@/core/prisma/utils/db'
import type {
  MonitorCreateData,
  MonitorUpdateData
} from '@/modules/monitor/inputs'
import type { Monitor } from '@/modules/monitor/types'

@Injectable()
export class MonitorRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get table(): Db['orm']['public']['Monitor'] {
    return this.prisma.db.orm.public.Monitor
  }

  public list(
    spec: QuerySpec,
    fields?: readonly string[]
  ): Promise<Connection<Monitor>> {
    return listConnection(this.prisma.db, 'Monitor', spec, fields)
  }

  public findById(id: string): Promise<Monitor | null> {
    return this.table.where((fields) => fields.id.eq(id)).first()
  }

  public async findByIds(ids: readonly string[]): Promise<Monitor[]> {
    const monitors = await this.table
      .where((fields) => fields.id.in([...ids]))
      .all()

    return monitors
  }

  public create(data: MonitorCreateData): Promise<Monitor> {
    return this.table.create(data)
  }

  public update(id: string, data: MonitorUpdateData): Promise<Monitor | null> {
    return this.table.where((fields) => fields.id.eq(id)).update(data)
  }

  public delete(id: string): Promise<Monitor | null> {
    return this.table.where((fields) => fields.id.eq(id)).delete()
  }
}
