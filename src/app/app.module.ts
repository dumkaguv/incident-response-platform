import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { type DynamicModule, Module } from '@nestjs/common'
import { ServeStaticModule } from '@nestjs/serve-static'

import { AppConfigModule } from '@/core/config'
import { GraphqlConfigModule } from '@/core/graphql'
import { I18nModule } from '@/core/i18n'
import { PrismaModule } from '@/core/prisma/prisma.module'
import { ThrottlerConfigModule } from '@/core/throttler'
import { MonitorModule } from '@/modules/monitor/monitor.module'

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
    AppConfigModule,
    ...apiDocs(),
    I18nModule,
    PrismaModule,
    ThrottlerConfigModule,
    GraphqlConfigModule,
    MonitorModule
  ]
})
export class AppModule {}
