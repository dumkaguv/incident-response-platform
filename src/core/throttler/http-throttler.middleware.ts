import {
  type NestMiddleware,
  HttpStatus,
  Inject,
  Injectable
} from '@nestjs/common'
import { ThrottlerStorage } from '@nestjs/throttler'
import type { ConfigType } from '@nestjs/config'
import type { NextFunction, Request, Response } from 'express'

import { throttleConfig } from '@/core/config'

import { clientTracker } from './client-tracker'

@Injectable()
export class HttpThrottlerMiddleware implements NestMiddleware {
  private readonly http: ConfigType<typeof throttleConfig>['http']

  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    @Inject(throttleConfig.KEY) config: ConfigType<typeof throttleConfig>
  ) {
    this.http = config.http
  }

  public async use(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const tracker = clientTracker(req as unknown as Record<string, unknown>)
    const record = await this.storage.increment(
      `http:${tracker}`,
      this.http.ttl,
      this.http.limit,
      this.http.blockDuration,
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
