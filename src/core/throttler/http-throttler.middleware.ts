import {
  type NestMiddleware,
  HttpStatus,
  Inject,
  Injectable
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ThrottlerStorage } from '@nestjs/throttler'
import type { NextFunction, Request, Response } from 'express'

import { numberSetting } from '@/common/utils'

import { clientTracker } from './client-tracker'
import { HTTP_BLOCK_DURATION, HTTP_TIER } from './throttler.constants'

@Injectable()
export class HttpThrottlerMiddleware implements NestMiddleware {
  private readonly limit: number

  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    config: ConfigService
  ) {
    this.limit = numberSetting(
      config.get('THROTTLE_HTTP_LIMIT'),
      HTTP_TIER.limit
    )
  }

  public async use(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const tracker = clientTracker(req as unknown as Record<string, unknown>)
    const record = await this.storage.increment(
      `http:${tracker}`,
      HTTP_TIER.ttl,
      this.limit,
      HTTP_BLOCK_DURATION,
      'http'
    )

    if (!record.isBlocked) {
      next()

      return
    }

    const retryAfter = Math.max(
      1,
      record.timeToBlockExpire || record.timeToExpire
    )

    res.setHeader('Retry-After', retryAfter)
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      errors: [
        {
          message: `Too many requests, retry in ${String(retryAfter)} seconds`,
          extensions: { code: 'TOO_MANY_REQUESTS' }
        }
      ]
    })
  }
}
