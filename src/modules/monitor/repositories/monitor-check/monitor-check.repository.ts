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
  Monitor,
  MonitorCheck,
  MonitorCheckCreateData
} from '@/modules/monitor/types'

const TEXT = 'pg/text@1'
const INT = 'pg/int4@1'
const TIMESTAMP = 'pg/timestamptz-string@1'

function check(field: keyof MonitorCheck): string {
  return `"${columnOf('MonitorCheck', field)}"`
}

function monitor(field: keyof Monitor): string {
  return `"${columnOf('Monitor', field)}"`
}

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

  public findById(id: string): Promise<MonitorCheck | null> {
    return this.table.where((fields) => fields.id.eq(id)).first()
  }

  public async recordOutcome(
    data: MonitorCheckCreateData
  ): Promise<MonitorCheck | null> {
    const checks = `"${tableOf('MonitorCheck')}"`
    const monitors = `"${tableOf('Monitor')}"`
    const inserted = await rawRows(
      this.prisma.db,
      [
        `WITH inserted AS (
           INSERT INTO ${checks} (${check('id')}, ${check('monitorId')}, ${check('status')}, ${check('statusCode')}, ${check('responseTimeMs')}, ${check('errorType')}, ${check('errorMessage')}, ${check('checkedAt')})
           SELECT gen_random_uuid()::text, m.${monitor('id')}, `,
        `, `,
        `, `,
        `, `,
        `, `,
        `, `,
        ` FROM ${monitors} m WHERE m.${monitor('id')} = `,
        ` RETURNING ${check('id')}, ${check('monitorId')}, ${check('status')}, ${check('statusCode')}, ${check('responseTimeMs')}, ${check('checkedAt')}
         ), rolled AS (
           UPDATE ${monitors} m SET
             ${monitor('lastStatus')} = i.${check('status')},
             ${monitor('lastCheckedAt')} = i.${check('checkedAt')},
             ${monitor('lastStatusCode')} = i.${check('statusCode')},
             ${monitor('lastResponseTimeMs')} = i.${check('responseTimeMs')},
             ${monitor('consecutiveFailures')} = CASE WHEN i.${check('status')} = `,
        ` THEN m.${monitor('consecutiveFailures')} + 1 ELSE 0 END,
             ${monitor('nextCheckAt')} = i.${check('checkedAt')} + make_interval(secs => m.${monitor('intervalSeconds')}),
             ${monitor('updatedAt')} = now()
           FROM inserted i
           WHERE m.${monitor('id')} = i.${check('monitorId')}
             AND (m.${monitor('lastCheckedAt')} IS NULL OR m.${monitor('lastCheckedAt')} <= i.${check('checkedAt')})
           RETURNING m.${monitor('id')}
         )
         SELECT i.${check('id')} FROM inserted i`
      ],
      [
        data.status,
        param(data.statusCode ?? null, { codecId: INT }),
        param(data.responseTimeMs ?? null, { codecId: INT }),
        param(data.errorType ?? null, { codecId: TEXT }),
        param(data.errorMessage ?? null, { codecId: TEXT }),
        param(data.checkedAt, { codecId: TIMESTAMP }),
        data.monitorId,
        MonitorStatus.DOWN
      ],
      { id: TEXT }
    )
    const [row] = inserted

    return row ? this.findById(String(row.id)) : null
  }
}
