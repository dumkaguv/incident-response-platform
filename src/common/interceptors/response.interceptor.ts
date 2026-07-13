import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { type Observable, map } from 'rxjs'

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from '@/common/constants'

import type { Request } from 'express'

type PaginatedPayload = {
  data: unknown
  total?: number
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
    const handler = context.getHandler()
    const request = context.switchToHttp().getRequest<Request>()

    const message =
      this.reflector.get<string>('responseMessage', handler) ?? 'Success'

    const usePagination =
      this.reflector.get<boolean>('usePagination', handler) ?? false

    return next.handle().pipe(
      map((data: unknown) => {
        if (usePagination && isPaginatedPayload(data)) {
          const total =
            typeof data.total === 'number' && Number.isFinite(data.total)
              ? data.total
              : 0

          const rawPageSize = request.query.pageSize
          const pageSize = Math.min(
            Math.max(1, toPositiveInt(rawPageSize, DEFAULT_PAGE_SIZE)),
            MAX_PAGE_SIZE
          )

          const page = toPositiveInt(request.query.page, DEFAULT_PAGE)

          const totalPages = Math.ceil(total / pageSize)
          const nextPage = page < totalPages ? page + 1 : null
          const prevPage = page > 1 ? page - 1 : null

          return {
            success: true,
            message,
            data: data.data,
            total,
            page,
            totalPages,
            pageSize,
            nextPage,
            prevPage
          }
        }

        return {
          success: true,
          message,
          data
        }
      })
    )
  }
}

function isPaginatedPayload(x: unknown): x is PaginatedPayload {
  return typeof x === 'object' && x !== null && 'data' in x
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n =
    typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN

  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback
}
