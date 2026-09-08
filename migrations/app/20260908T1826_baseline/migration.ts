#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/f4ebee5ed1f3a3696d28a688071b2ca957533482f601a5f51c4b407103329fa2/contract';
import endContract from '../../snapshots/f4ebee5ed1f3a3696d28a688071b2ca957533482f601a5f51c4b407103329fa2/contract.json' with { type: 'json' };
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
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolved_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('team_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
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
      this.createTable({
        schema: 'public',
        table: 'team',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'team_member',
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
            'team_member_role_check_dc5d4b4d',
            "\"role\" IN ('LEAD', 'RESPONDER', 'OBSERVER')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'team',
        constraint: 'team_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'team_member',
        constraint: 'team_member_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_created_at_id_idx_d7da240a',
        columns: ['created_at', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_status_created_at_id_idx_4ee1ea67',
        columns: ['status', 'created_at', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_team_id_idx_d177da93',
        columns: ['team_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'team',
        index: 'team_name_idx_ce87e6ba',
        columns: ['name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'team_member',
        index: 'team_member_team_id_idx_d177da93',
        columns: ['team_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'team_member',
        index: 'team_member_team_id_name_idx_9c5707a1',
        columns: ['team_id', 'name'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'incident',
        foreignKey: {
          name: 'incident_team_id_fkey',
          columns: ['team_id'],
          references: { schema: 'public', table: 'team', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'team_member',
        foreignKey: {
          name: 'team_member_team_id_fkey',
          columns: ['team_id'],
          references: { schema: 'public', table: 'team', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
