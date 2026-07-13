import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger
} from '@nestjs/common'

import { isPrismaException } from '../utils'

import type { Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (isPrismaException(exception)) {
      if (exception.code === 'P2025') {
        this.logger.warn('Resource not found', exception)

        response.status(404).json({
          success: false,
          message: 'Resource not found'
        })

        return
      }

      if (exception.code === 'P2002') {
        response.status(409).json({
          success: false,
          message: 'Unique constraint failed',
          fields: exception.meta?.target
        })

        return
      }
    }

    /* ValidationPipe */
    if (exception instanceof BadRequestException) {
      const res = exception.getResponse()

      let message: string | string[]
      let errors: unknown = null

      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const r = res as { message?: string | string[]; errors?: unknown }

        message = r.message ?? 'Validation failed'
        errors = r.errors ?? null
      } else {
        message = 'Validation failed'
      }

      this.logger.warn('Validation failed', exception)

      response.status(400).json({
        success: false,
        message,
        errors
      })

      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const message = exception.message

      this.logger.error(message, exception)

      response.status(status).json({
        success: false,
        message
      })

      return
    }

    this.logger.error('Internal server error', exception)

    response.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}
