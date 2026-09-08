import { join } from 'node:path'

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'

import { GraphqlConfigModule } from '@/graphql'
import { I18nModule } from '@/i18n'
import { IncidentModule } from '@/modules/incident/incident.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { ThrottlerConfigModule } from '@/throttler'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'docs', 'api'),
      serveRoot: '/docs'
    }),
    I18nModule,
    PrismaModule,
    ThrottlerConfigModule,
    GraphqlConfigModule,
    IncidentModule
  ]
})
export class AppModule {}
