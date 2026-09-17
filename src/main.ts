import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import compression from 'compression'
import helmet from 'helmet'
import type { ConfigType } from '@nestjs/config'
import type { Express, NextFunction, Request, Response } from 'express'

import { appConfig } from '@/core/config'

import { AppModule } from './app/app.module'

const GRAPHQL_PATH = '/graphql'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const { port, trustProxy } = app.get<ConfigType<typeof appConfig>>(
    appConfig.KEY
  )

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

  app.useGlobalPipes(new ValidationPipe({ transform: true }))

  await app.listen(port)

  console.warn(
    `GraphQL endpoint: http://localhost:${String(port)}${GRAPHQL_PATH}`
  )
}

void bootstrap()
