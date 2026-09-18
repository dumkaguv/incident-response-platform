import { Injectable } from '@nestjs/common'
import { param } from '@prisma/orm-postgres/relational-core/expression'

import { PrismaService } from '@/core/prisma/prisma.service'
import { listConnection } from '@/core/prisma/utils/query-table'
import { Codec, sqlModel, sqlRows } from '@/core/prisma/utils/raw-sql'
import type {
  Connection,
  ConnectionSelection,
  QuerySpec
} from '@/core/pagination'
import type { Db } from '@/core/prisma/utils/db'
import type {
  MonitorCreateData,
  MonitorUpdateData
} from '@/modules/monitor/inputs'
import type { Monitor, MonitorDue } from '@/modules/monitor/types'

const [monitors, field] = sqlModel<Monitor>('Monitor')

@Injectable()
export class MonitorRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get table(): Db['orm']['public']['Monitor'] {
    return this.prisma.db.orm.public.Monitor
  }

  public list(
    spec: QuerySpec,
    selection?: ConnectionSelection
  ): Promise<Connection<Monitor>> {
    return listConnection(this.prisma.db, 'Monitor', spec, selection)
  }

  public findById(id: string): Promise<Monitor | null> {
    return this.table.where((fields) => fields.id.eq(id)).first()
  }

  public async findByIds(ids: readonly string[]): Promise<Monitor[]> {
    const found = await this.table
      .where((fields) => fields.id.in([...ids]))
      .all()

    return found
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

  public async claimDue(limit: number): Promise<MonitorDue[]> {
    const rows = await sqlRows(this.prisma.db, {
      id: Codec.text,
      due_at: Codec.timestamp
    })`
      WITH due AS (
        SELECT ${field.id}, ${field.nextCheckAt}
        FROM ${monitors}
        WHERE ${field.isActive} = true
          AND ${field.nextCheckAt} <= now()
        ORDER BY ${field.nextCheckAt}, ${field.id}
        LIMIT ${param(limit, { codecId: Codec.int })}
        FOR UPDATE SKIP LOCKED
      ), leased AS (
        UPDATE ${monitors} m SET
          ${field.nextCheckAt} = now() + greatest(
            make_interval(secs => m.${field.intervalSeconds}),
            make_interval(secs => m.${field.timeoutMs} / 1000.0)
          ),
          ${field.updatedAt} = now()
        FROM due d
        WHERE m.${field.id} = d.${field.id}
        RETURNING m.${field.id}
      )
      SELECT d.${field.id} AS id, d.${field.nextCheckAt} AS due_at
      FROM due d
      JOIN leased l ON l.${field.id} = d.${field.id}
      ORDER BY due_at, id
    `

    return rows.map((row) => ({
      id: String(row.id),
      dueAt: String(row.due_at)
    }))
  }
}
