import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory, Reflector } from '@nestjs/core'

import compression from 'compression'
import cookieParser from 'cookie-parser'
import { Request, Response } from 'express'
import helmet from 'helmet'

import { AppModule } from './app/app.module'

import { API_GLOBAL_PREFIX } from './common/constants'
import { AllExceptionsFilter } from './common/filters'
import { ResponseInterceptor } from './common/interceptors'
import { setupSwagger } from './common/utils'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix(API_GLOBAL_PREFIX)

  app.useGlobalInterceptors(app.get(ResponseInterceptor))

  app.useGlobalFilters(app.get(AllExceptionsFilter))

  setupSwagger(app)

  app.use(cookieParser())

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  )

  app.use(
    compression({
      threshold: 1024,
      level: 6
    })
  )

  app.enableCors({
    origin: config.getOrThrow<string>('FRONT_URL'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true
    })
  )

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true
    })
  )

  app
    .getHttpAdapter()
    .get('/', (_req: Request, res: Response) =>
      res.redirect(`/${API_GLOBAL_PREFIX}`)
    )

  await app.listen(config.get<string>('PORT') ?? 3000)

  console.warn(
    `Server started on url http://localhost:${config.get<string>('PORT') ?? 3000}`
  )
}

void bootstrap()
