#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/79f749993a537a31c408f22ab4648f61579e43e6f1af124d748caf4d940a2542/contract';
import endContract from '../../snapshots/79f749993a537a31c408f22ab4648f61579e43e6f1af124d748caf4d940a2542/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f4ebee5ed1f3a3696d28a688071b2ca957533482f601a5f51c4b407103329fa2/contract';
import startContract from '../../snapshots/f4ebee5ed1f3a3696d28a688071b2ca957533482f601a5f51c4b407103329fa2/contract.json' with { type: 'json' };
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
      this.dropTable({ schema: 'public', table: 'team_member' }),
      this.createTable({
        schema: 'public',
        table: 'teamMember',
        columns: [
          col('created_at', 'timestamptz', {
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
          col('team_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
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
        index: 'teamMember_team_id_idx_d177da93',
        columns: ['team_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'teamMember',
        index: 'teamMember_team_id_name_idx_9c5707a1',
        columns: ['team_id', 'name'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'teamMember',
        foreignKey: {
          name: 'teamMember_team_id_fkey',
          columns: ['team_id'],
          references: { schema: 'public', table: 'team', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
