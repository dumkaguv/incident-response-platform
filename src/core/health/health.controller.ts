import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'

import { PrismaService } from '@/core/prisma/prisma.service'

type Readiness = { status: 'ok' | 'error'; database: 'ok' | 'unreachable' }

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  public live(): { status: 'ok' } {
    return { status: 'ok' }
  }

  @Get('ready')
  public async ready(@Res() response: Response): Promise<void> {
    const readiness = await this.readiness()

    response
      .status(
        readiness.status === 'ok'
          ? HttpStatus.OK
          : HttpStatus.SERVICE_UNAVAILABLE
      )
      .json(readiness)
  }

  private async readiness(): Promise<Readiness> {
    try {
      await this.prisma.ping()

      return { status: 'ok', database: 'ok' }
    } catch {
      return { status: 'error', database: 'unreachable' }
    }
  }
}
