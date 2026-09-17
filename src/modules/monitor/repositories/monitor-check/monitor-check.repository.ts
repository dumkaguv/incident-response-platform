import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/core/prisma/prisma.service'
import { listConnection } from '@/core/prisma/utils/query-table'
import type { Connection, QuerySpec } from '@/core/pagination'
import type { Db } from '@/core/prisma/utils/db'
import type {
  MonitorCheck,
  MonitorCheckCreateData
} from '@/modules/monitor/types'

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
}
