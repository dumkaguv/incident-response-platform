#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d0eae9e3e2e7c1d1cf3743fbeee6f1a733c58bb11f430abd4ee98e8929d45905/contract';
import endContract from '../../snapshots/d0eae9e3e2e7c1d1cf3743fbeee6f1a733c58bb11f430abd4ee98e8929d45905/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ea822d45d1374446c5cc2a5dbb6c788390da7db3371a6a2bce92a24855f65959/contract';
import startContract from '../../snapshots/ea822d45d1374446c5cc2a5dbb6c788390da7db3371a6a2bce92a24855f65959/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'team',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'incident',
        column: col('teamId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'team',
        constraint: 'team_slug_key',
        columns: ['slug'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'team',
        index: 'team_name_idx_ce87e6ba',
        columns: ['name'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incident',
        foreignKey: {
          name: 'incident_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'team', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
