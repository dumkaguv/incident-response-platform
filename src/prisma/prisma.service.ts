import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { type Db, createDb } from './utils/db'

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db: Db

  constructor(config: ConfigService) {
    this.db = createDb(config.getOrThrow<string>('DATABASE_URL'))
  }

  public async onModuleInit(): Promise<void> {
    await this.db.connect()
  }

  public onModuleDestroy(): Promise<void> {
    return this.db.close()
  }
}
