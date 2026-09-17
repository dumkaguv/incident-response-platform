#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d362154a82471777aa5b1d5d124fac595b16b12e713a3f2c2f89549cef026692/contract';
import endContract from '../../snapshots/d362154a82471777aa5b1d5d124fac595b16b12e713a3f2c2f89549cef026692/contract.json' with { type: 'json' };
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
        table: 'monitor',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expected_status_code', 'int4', {
            notNull: true,
            default: lit(200),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('interval_seconds', 'int4', {
            notNull: true,
            default: lit(60),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('is_active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('method', 'text', {
            notNull: true,
            default: lit('GET'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('next_check_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('timeout_ms', 'int4', {
            notNull: true,
            default: lit(5000),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('monitor_method_check_f6b740eb', "\"method\" IN ('GET', 'HEAD', 'POST')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'monitorCheck',
        columns: [
          col('checked_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('error_type', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('monitor_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('response_time_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status_code', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'monitorCheck_error_type_check_fdb8dbfc',
            "\"error_type\" IN ('TIMEOUT', 'DNS_ERROR', 'CONNECTION_REFUSED', 'TLS_ERROR', 'INVALID_STATUS_CODE', 'ASSERTION_FAILED', 'UNKNOWN')",
          ),
          checkExpression('monitorCheck_status_check_b2b99eb4', "\"status\" IN ('UP', 'DOWN')"),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitor',
        index: 'monitor_created_at_id_idx_d7da240a',
        columns: ['created_at', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitor',
        index: 'monitor_is_active_name_idx_46b5e021',
        columns: ['is_active', 'name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitorCheck',
        index: 'monitorCheck_checked_at_id_idx_35df2f2c',
        columns: ['checked_at', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitorCheck',
        index: 'monitorCheck_monitor_id_checked_at_id_idx_bbe83795',
        columns: ['monitor_id', 'checked_at', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitorCheck',
        index: 'monitorCheck_monitor_id_idx_f22a8355',
        columns: ['monitor_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'monitorCheck',
        foreignKey: {
          name: 'monitorCheck_monitor_id_fkey',
          columns: ['monitor_id'],
          references: { schema: 'public', table: 'monitor', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
