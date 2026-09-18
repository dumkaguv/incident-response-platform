import { Injectable } from '@nestjs/common'
import { param } from '@prisma/orm-postgres/relational-core/expression'

import { PrismaService } from '@/core/prisma/prisma.service'
import { listConnection } from '@/core/prisma/utils/query-table'
import { Codec, sqlModel, sqlRows } from '@/core/prisma/utils/raw-sql'
import { MonitorStatus } from '@/modules/monitor/types'
import type {
  Connection,
  ConnectionSelection,
  QuerySpec
} from '@/core/pagination'
import type { Db } from '@/core/prisma/utils/db'
import type {
  Monitor,
  MonitorCheck,
  MonitorCheckCreateData
} from '@/modules/monitor/types'

const [checks, check] = sqlModel<MonitorCheck>('MonitorCheck')
const [monitors, monitor] = sqlModel<Monitor>('Monitor')

@Injectable()
export class MonitorCheckRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get table(): Db['orm']['public']['MonitorCheck'] {
    return this.prisma.db.orm.public.MonitorCheck
  }

  public list(
    spec: QuerySpec,
    selection?: ConnectionSelection
  ): Promise<Connection<MonitorCheck>> {
    return listConnection(this.prisma.db, 'MonitorCheck', spec, selection)
  }

  public findById(id: string): Promise<MonitorCheck | null> {
    return this.table.where((fields) => fields.id.eq(id)).first()
  }

  public async recordOutcome(
    data: MonitorCheckCreateData
  ): Promise<MonitorCheck | null> {
    const [recorded] = await sqlRows(this.prisma.db, {
      id: Codec.text,
      monitorId: Codec.text,
      status: Codec.text,
      statusCode: Codec.int,
      responseTimeMs: Codec.int,
      errorType: Codec.text,
      errorMessage: Codec.text,
      checkedAt: Codec.timestamp
    })`
      WITH inserted AS (
        INSERT INTO ${checks} (
          ${check.id}, ${check.monitorId}, ${check.status}, ${check.statusCode},
          ${check.responseTimeMs}, ${check.errorType}, ${check.errorMessage},
          ${check.checkedAt}
        )
        SELECT
          gen_random_uuid()::text,
          m.${monitor.id},
          ${data.status},
          ${param(data.statusCode ?? null, { codecId: Codec.int })},
          ${param(data.responseTimeMs ?? null, { codecId: Codec.int })},
          ${param(data.errorType ?? null, { codecId: Codec.text })},
          ${param(data.errorMessage ?? null, { codecId: Codec.text })},
          ${param(data.checkedAt, { codecId: Codec.timestamp })}
        FROM ${monitors} m
        WHERE m.${monitor.id} = ${data.monitorId}
        RETURNING
          ${check.id}, ${check.monitorId}, ${check.status}, ${check.statusCode},
          ${check.responseTimeMs}, ${check.errorType}, ${check.errorMessage},
          ${check.checkedAt}
      ), rolled AS (
        UPDATE ${monitors} m SET
          ${monitor.lastStatus} = i.${check.status},
          ${monitor.lastCheckedAt} = i.${check.checkedAt},
          ${monitor.lastStatusCode} = i.${check.statusCode},
          ${monitor.lastResponseTimeMs} = i.${check.responseTimeMs},
          ${monitor.consecutiveFailures} = CASE
            WHEN i.${check.status} = ${MonitorStatus.DOWN}
            THEN m.${monitor.consecutiveFailures} + 1
            ELSE 0
          END,
          ${monitor.nextCheckAt} = i.${check.checkedAt}
            + make_interval(secs => m.${monitor.intervalSeconds}),
          ${monitor.updatedAt} = now()
        FROM inserted i
        WHERE m.${monitor.id} = i.${check.monitorId}
          AND (
            m.${monitor.lastCheckedAt} IS NULL
            OR m.${monitor.lastCheckedAt} <= i.${check.checkedAt}
          )
        RETURNING m.${monitor.id}
      )
      SELECT
        i.${check.id} AS id,
        i.${check.monitorId} AS "monitorId",
        i.${check.status} AS status,
        i.${check.statusCode} AS "statusCode",
        i.${check.responseTimeMs} AS "responseTimeMs",
        i.${check.errorType} AS "errorType",
        i.${check.errorMessage} AS "errorMessage",
        i.${check.checkedAt} AS "checkedAt"
      FROM inserted i
    `

    return (recorded as MonitorCheck | undefined) ?? null
  }
}
