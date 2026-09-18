import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { ThrottlerStorage } from '@nestjs/throttler'
import type { ConfigType } from '@nestjs/config'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { throttleConfig } from '@/core/config'

import { clientTracker } from './client-tracker'

@Injectable()
export class HttpThrottlerHook {
  private readonly http: ConfigType<typeof throttleConfig>['http']

  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    @Inject(throttleConfig.KEY) config: ConfigType<typeof throttleConfig>
  ) {
    this.http = config.http
  }

  public async handle(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | undefined> {
    const tracker = clientTracker(request)
    const record = await this.storage.increment(
      `http:${tracker}`,
      this.http.ttl,
      this.http.limit,
      this.http.blockDuration,
      'http'
    )

    if (!record.isBlocked) {
      return
    }

    const retryAfter = Math.max(
      1,
      record.timeToBlockExpire || record.timeToExpire
    )

    void reply.header('Retry-After', retryAfter)
    void reply.status(HttpStatus.TOO_MANY_REQUESTS)

    return reply.send({
      errors: [
        {
          message: `Too many requests, retry in ${String(retryAfter)} seconds`,
          extensions: { code: 'TOO_MANY_REQUESTS' }
        }
      ]
    })
  }
}
