#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/740f4f429d491c237ff79c9eb3dd58ce8875f3688334b18670b2c68d139351ea/contract';
import endContract from '../../snapshots/740f4f429d491c237ff79c9eb3dd58ce8875f3688334b18670b2c68d139351ea/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d0eae9e3e2e7c1d1cf3743fbeee6f1a733c58bb11f430abd4ee98e8929d45905/contract';
import startContract from '../../snapshots/d0eae9e3e2e7c1d1cf3743fbeee6f1a733c58bb11f430abd4ee98e8929d45905/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'teamMember',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('RESPONDER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('teamId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'teamMember_role_check_dc5d4b4d',
            "\"role\" IN ('LEAD', 'RESPONDER', 'OBSERVER')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'teamMember',
        constraint: 'teamMember_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'teamMember',
        index: 'teamMember_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'teamMember',
        foreignKey: {
          name: 'teamMember_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'team', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
