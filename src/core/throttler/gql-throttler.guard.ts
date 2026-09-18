import { createHash } from 'node:crypto'

import { msg } from '@lingui/core/macro'
import { type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { type GqlContextType, GqlExecutionContext } from '@nestjs/graphql'
import {
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
  ThrottlerGuard
} from '@nestjs/throttler'
import type { FastifyReply } from 'fastify'

import { TooManyRequestsError } from '@/common/utils'
import type { GqlContext } from '@/core/graphql/graphql-context'

import { type IdentifiedRequest, clientTracker } from './client-tracker'
import { isMutation } from './operation'

const VERDICTS = Symbol('throttler.verdicts')

type JudgedRequest = IdentifiedRequest & {
  [VERDICTS]?: Map<string, Promise<boolean>>
}

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(context.getType<GqlContextType>() !== 'graphql')
  }

  protected getRequestResponse(context: ExecutionContext): {
    req: IdentifiedRequest
    res: FastifyReply
  } {
    const gqlContext =
      GqlExecutionContext.create(context).getContext<GqlContext>()

    return { req: gqlContext.req, res: gqlContext.res }
  }

  protected handleRequest(request: ThrottlerRequest): Promise<boolean> {
    const { req } = this.getRequestResponse(request.context)
    const carrier = req as JudgedRequest
    const verdicts = (carrier[VERDICTS] ??= new Map<string, Promise<boolean>>())
    const name = request.throttler.name ?? 'default'
    let verdict = verdicts.get(name)

    if (!verdict) {
      verdict = super.handleRequest(request)
      verdicts.set(name, verdict)
    }

    return verdict
  }

  protected getTracker(req: IdentifiedRequest): Promise<string> {
    return Promise.resolve(clientTracker(req))
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string
  ): string {
    const operation = isMutation(context) ? 'write' : 'read'

    return createHash('sha256')
      .update(`${name}:${operation}:${suffix}`)
      .digest('hex')
  }

  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail
  ): Promise<void> {
    const seconds = Math.max(1, detail.timeToBlockExpire || detail.timeToExpire)
    const { res } = this.getRequestResponse(context)

    void res.header('Retry-After', seconds)
    void res.status(HttpStatus.TOO_MANY_REQUESTS)

    throw new TooManyRequestsError(
      msg`Rate limit reached, retry in ${seconds} seconds`
    )
  }
}
