import { msg } from '@lingui/core/macro'
import { type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import {
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
  ThrottlerGuard
} from '@nestjs/throttler'

import { TooManyRequestsError } from '@/common/utils'

import { clientTracker } from './client-tracker'

const COUNTED = Symbol('throttler.counted')

type CountedRequest = Record<string, unknown> & { [COUNTED]?: Set<string> }

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>
    res: Record<string, unknown>
  } {
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req: Record<string, unknown>
      res: Record<string, unknown>
    }>()

    return { req: gqlContext.req, res: gqlContext.res }
  }

  protected async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    const { req } = this.getRequestResponse(request.context)
    const carrier = req as CountedRequest
    const counted = (carrier[COUNTED] ??= new Set<string>())
    const name = request.throttler.name ?? 'default'

    if (counted.has(name)) {
      return true
    }

    counted.add(name)

    return super.handleRequest(request)
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(clientTracker(req))
  }

  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail
  ): Promise<void> {
    const seconds = Math.max(1, detail.timeToBlockExpire || detail.timeToExpire)
    const { res } = this.getRequestResponse(context)

    setRetryAfter(res, seconds)

    throw new TooManyRequestsError(
      msg`Rate limit reached, retry in ${seconds} seconds`
    )
  }
}

function setRetryAfter(res: Record<string, unknown>, seconds: number): void {
  const { header, status } = res

  if (typeof header === 'function') {
    header.call(res, 'Retry-After', seconds)
  }

  if (typeof status === 'function') {
    status.call(res, HttpStatus.TOO_MANY_REQUESTS)
  }
}
