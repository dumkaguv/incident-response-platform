import { existsSync } from 'node:fs'

import compress from '@fastify/compress'
import helmet from '@fastify/helmet'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { env } from '@/core/config'

import { AppModule } from './app/app.module'

const GRAPHQL_PATH = '/graphql'
const GRAPHIQL_PATH = '/graphiql'
const ENV_FILE = '.env'
const ALL_INTERFACES = '0.0.0.0'

function pathOf(url: string): string {
  const query = url.indexOf('?')

  return query >= 0 ? url.slice(0, query) : url
}

async function bootstrap(): Promise<void> {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE)
  }

  const { PORT, TRUST_PROXY } = env()
  const adapter = new FastifyAdapter({ trustProxy: TRUST_PROXY })

  adapter.getInstance().addHook('onRequest', (request, reply, done) => {
    if (pathOf(request.url) === '/') {
      void reply.redirect(GRAPHIQL_PATH)

      return
    }

    done()
  })

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter
  )

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })

  await app.register(compress, {
    threshold: 1024,
    zlibOptions: { level: 6 }
  })

  app.enableShutdownHooks()

  await app.listen(PORT, ALL_INTERFACES)

  console.warn(
    `GraphQL endpoint: http://localhost:${String(PORT)}${GRAPHQL_PATH}`
  )
}

void bootstrap()
