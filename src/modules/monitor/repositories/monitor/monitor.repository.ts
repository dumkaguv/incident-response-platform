import { Injectable } from '@nestjs/common'
import { param } from '@prisma/orm-postgres/relational-core/expression'

import { PrismaService } from '@/core/prisma/prisma.service'
import { columnOf, tableOf } from '@/core/prisma/utils/contract-meta'
import { listConnection } from '@/core/prisma/utils/query-table'
import { rawRows } from '@/core/prisma/utils/raw-sql'
import { MonitorStatus } from '@/modules/monitor/types'
import type { Connection, QuerySpec } from '@/core/pagination'
import type { Db } from '@/core/prisma/utils/db'
import type {
  MonitorCreateData,
  MonitorUpdateData
} from '@/modules/monitor/inputs'
import type { Monitor, RecordedOutcome } from '@/modules/monitor/types'

const INT = 'pg/int4@1'
const TIMESTAMP = 'pg/timestamptz-string@1'

function column(field: keyof Monitor): string {
  return `"${columnOf('Monitor', field)}"`
}

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

  public create(data: MonitorCreateData): Promise<Monitor> {
    return this.table.create(data)
  }

  public update(id: string, data: MonitorUpdateData): Promise<Monitor | null> {
    return this.table.where((fields) => fields.id.eq(id)).update(data)
  }

  public delete(id: string): Promise<Monitor | null> {
    return this.table.where((fields) => fields.id.eq(id)).delete()
  }

  public async recordOutcome(
    id: string,
    outcome: RecordedOutcome
  ): Promise<Monitor | null> {
    function checkedAt(): unknown {
      return param(outcome.checkedAt, { codecId: TIMESTAMP })
    }
    const updated = await rawRows(
      this.prisma.db,
      [
        `UPDATE "${tableOf('Monitor')}" SET ${column('lastStatus')} = `,
        `, ${column('lastCheckedAt')} = `,
        `, ${column('lastStatusCode')} = `,
        `, ${column('lastResponseTimeMs')} = `,
        `, ${column('consecutiveFailures')} = CASE WHEN `,
        ` THEN ${column('consecutiveFailures')} + 1 ELSE 0 END, ${column('nextCheckAt')} = `,
        `::timestamptz + make_interval(secs => ${column('intervalSeconds')}), ${column('updatedAt')} = now() WHERE ${column('id')} = `,
        ` RETURNING ${column('id')}`
      ],
      [
        outcome.status,
        checkedAt(),
        param(outcome.statusCode, { codecId: INT }),
        param(outcome.responseTimeMs, { codecId: INT }),
        outcome.status === MonitorStatus.DOWN,
        checkedAt(),
        id
      ],
      { id: 'pg/text@1' }
    )

    return updated.length ? this.findById(id) : null
  }
}
