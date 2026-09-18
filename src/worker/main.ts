import { existsSync } from 'node:fs'

import { NestFactory } from '@nestjs/core'

import { env } from '@/core/config'

import { WorkerModule } from './worker.module'

const ENV_FILE = '.env'

async function bootstrap(): Promise<void> {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE)
  }

  const app = await NestFactory.createApplicationContext(WorkerModule)

  app.enableShutdownHooks()

  const { QUEUE_CONCURRENCY, QUEUE_TICK_MS } = env()

  console.warn(
    `monitor worker: up to ${String(QUEUE_CONCURRENCY)} probes in flight, due scan every ${String(QUEUE_TICK_MS)} ms`
  )
}

void bootstrap()
