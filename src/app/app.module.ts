import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AllExceptionsFilter } from '@/common/filters'
import { ResponseInterceptor } from '@/common/interceptors'

import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService, AllExceptionsFilter, ResponseInterceptor]
})
export class AppModule {}
