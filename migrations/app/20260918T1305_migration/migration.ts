#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1f8ab6752507632128c254bca3d1b59f246dca9883347ef776a9699d23522b7b/contract';
import startContract from '../../snapshots/1f8ab6752507632128c254bca3d1b59f246dca9883347ef776a9699d23522b7b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cdf3d02fbd3dc806b826d973e018c6bb328bb58e103263bfab4d81dae2456d39/contract';
import endContract from '../../snapshots/cdf3d02fbd3dc806b826d973e018c6bb328bb58e103263bfab4d81dae2456d39/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'monitor',
        index: 'monitor_last_status_created_at_id_idx_e95a53d0',
        columns: ['last_status', 'created_at', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitor',
        index: 'monitor_name_id_idx_69098186',
        columns: ['name', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitorCheck',
        index: 'monitorCheck_error_type_checked_at_id_idx_09d592cb',
        columns: ['error_type', 'checked_at', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'monitorCheck',
        index: 'monitorCheck_status_checked_at_id_idx_7a19b2ee',
        columns: ['status', 'checked_at', 'id'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
