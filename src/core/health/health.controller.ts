import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import type { FastifyReply } from 'fastify'

import { PrismaService } from '@/core/prisma/prisma.service'

import { LIVENESS_PATH, READINESS_ROUTE } from './health.constants'

type Readiness = { status: 'ok' | 'error'; database: 'ok' | 'unreachable' }

export const READINESS_TIMEOUT_MS = 3000

function rejectAfter(milliseconds: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `The database did not answer within ${String(milliseconds)} ms`
        )
      )
    }, milliseconds).unref()
  })
}

@Controller(LIVENESS_PATH)
export class HealthController {
  private readonly okStatus = 'ok'

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  public live(): { status: string } {
    return { status: this.okStatus }
  }

  @Get(READINESS_ROUTE)
  public async ready(@Res() response: FastifyReply): Promise<void> {
    const readiness = await this.readiness()

    response
      .status(
        readiness.status === this.okStatus
          ? HttpStatus.OK
          : HttpStatus.SERVICE_UNAVAILABLE
      )
      .send(readiness)
  }

  private async readiness(): Promise<Readiness> {
    try {
      await Promise.race([
        this.prisma.ping(),
        rejectAfter(READINESS_TIMEOUT_MS)
      ])

      return { status: 'ok', database: 'ok' }
    } catch {
      return { status: 'error', database: 'unreachable' }
    }
  }
}
