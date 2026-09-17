import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'

import { databaseConfig } from '@/core/config'

import { type Db, createDb } from './utils/db'

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db: Db

  constructor(
    @Inject(databaseConfig.KEY) config: ConfigType<typeof databaseConfig>
  ) {
    this.db = createDb(config.url)
  }

  public async onModuleInit(): Promise<void> {
    await this.db.connect()
  }

  public onModuleDestroy(): Promise<void> {
    return this.db.close()
  }
}
