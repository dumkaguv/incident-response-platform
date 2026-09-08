#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/229fd6de9dc4965a0f6fda3244596b2c9cf481ecb11407386d7530763018dbaa/contract';
import endContract from '../../snapshots/229fd6de9dc4965a0f6fda3244596b2c9cf481ecb11407386d7530763018dbaa/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/740f4f429d491c237ff79c9eb3dd58ce8875f3688334b18670b2c68d139351ea/contract';
import startContract from '../../snapshots/740f4f429d491c237ff79c9eb3dd58ce8875f3688334b18670b2c68d139351ea/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_createdAt_idx_9575dbd7',
      }),
      this.createIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_createdAt_id_idx_3855cff1',
        columns: ['createdAt', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'incident',
        index: 'incident_status_createdAt_id_idx_ffb42ad8',
        columns: ['status', 'createdAt', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'teamMember',
        index: 'teamMember_teamId_name_idx_89659443',
        columns: ['teamId', 'name'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
