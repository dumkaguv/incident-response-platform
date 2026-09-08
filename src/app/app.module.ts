import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { type DynamicModule, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'

import { GraphqlConfigModule } from '@/core/graphql'
import { I18nModule } from '@/core/i18n'
import { PrismaModule } from '@/core/prisma/prisma.module'
import { ThrottlerConfigModule } from '@/core/throttler'
import { IncidentModule } from '@/modules/incident/incident.module'

const DOCS_ROOT = join(process.cwd(), 'docs', 'api')

function apiDocs(): DynamicModule[] {
  if (!existsSync(DOCS_ROOT)) {
    return []
  }

  return [
    ServeStaticModule.forRoot({ rootPath: DOCS_ROOT, serveRoot: '/docs' })
  ]
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ...apiDocs(),
    I18nModule,
    PrismaModule,
    ThrottlerConfigModule,
    GraphqlConfigModule,
    IncidentModule
  ]
})
export class AppModule {}
