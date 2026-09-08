import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { type DynamicModule, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'

import { GraphqlConfigModule } from '@/graphql'
import { I18nModule } from '@/i18n'
import { IncidentModule } from '@/modules/incident/incident.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { ThrottlerConfigModule } from '@/throttler'

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
