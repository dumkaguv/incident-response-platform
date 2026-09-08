import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import compression from 'compression'
import helmet from 'helmet'
import type { Express, NextFunction, Request, Response } from 'express'

import { numberSetting } from '@/common/utils'

import { AppModule } from './app/app.module'

const GRAPHQL_PATH = '/graphql'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)
  const trustProxy = config.get<string>('TRUST_PROXY')

  if (trustProxy) {
    const express = app.getHttpAdapter().getInstance() as Express

    express.set('trust proxy', trustProxy)
  }

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.path === '/') {
      response.redirect(GRAPHQL_PATH)

      return
    }

    next()
  })

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  )

  const port = numberSetting(config.get('PORT'), 3000)

  await app.listen(port)

  console.warn(
    `GraphQL endpoint: http://localhost:${String(port)}${GRAPHQL_PATH}`
  )
}

void bootstrap()
