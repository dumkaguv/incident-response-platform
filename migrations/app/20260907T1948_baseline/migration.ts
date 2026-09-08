#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ea822d45d1374446c5cc2a5dbb6c788390da7db3371a6a2bce92a24855f65959/contract';
import endContract from '../../snapshots/ea822d45d1374446c5cc2a5dbb6c788390da7db3371a6a2bce92a24855f65959/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'incident',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'incident_severity_check_5e5a5e80',
            "\"severity\" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
          ),
          checkExpression(
            'incident_status_check_c5e65004',
            "\"status\" IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
