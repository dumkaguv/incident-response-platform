import { existsSync } from 'node:fs'

import compress from '@fastify/compress'
import helmet from '@fastify/helmet'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { env, graphqlConfig } from '@/core/config'
import { GRAPHIQL_PATH, GRAPHQL_PATH } from '@/core/graphql/graphql.constants'

import { AppModule } from './app/app.module'

const ENV_FILE = '.env'
const ALL_INTERFACES = '0.0.0.0'

function pathOf(url: string): string {
  const query = url.indexOf('?')

  return query >= 0 ? url.slice(0, query) : url
}

function entryPoint(explorer: boolean): { label: string; path: string } {
  return explorer
    ? { label: 'GraphiQL explorer', path: GRAPHIQL_PATH }
    : { label: 'GraphQL endpoint', path: GRAPHQL_PATH }
}

async function bootstrap(): Promise<void> {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE)
  }

  const { PORT, TRUST_PROXY } = env()
  const { explorer } = graphqlConfig()
  const adapter = new FastifyAdapter({ trustProxy: TRUST_PROXY })

  if (explorer) {
    adapter.getInstance().addHook('onRequest', (request, reply, done) => {
      if (pathOf(request.url) === '/') {
        void reply.redirect(GRAPHIQL_PATH)

        return
      }

      done()
    })
  }

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

  const { label, path } = entryPoint(explorer)

  console.warn(`${label}: http://localhost:${String(PORT)}${path}`)
}

void bootstrap()
