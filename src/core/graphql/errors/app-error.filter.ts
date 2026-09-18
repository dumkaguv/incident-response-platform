import { type ArgumentsHost, Catch, HttpStatus } from '@nestjs/common'
import {
  type GqlContextType,
  type GqlExceptionFilter,
  GqlArgumentsHost
} from '@nestjs/graphql'
import { GraphQLError } from 'graphql'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { AppError } from '@/common/utils'
import { type AppLocale, I18nService, resolveLocale } from '@/core/i18n'
import type { GqlContext } from '@/core/graphql/graphql-context'

const HTTP_STATUS_BY_CODE = new Map<string, HttpStatus>([
  ['BAD_USER_INPUT', HttpStatus.BAD_REQUEST],
  ['NOT_FOUND', HttpStatus.NOT_FOUND],
  ['CONFLICT', HttpStatus.CONFLICT],
  ['TOO_MANY_REQUESTS', HttpStatus.TOO_MANY_REQUESTS]
])

@Catch(AppError)
export class AppErrorFilter implements GqlExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  public catch(
    exception: AppError,
    host: ArgumentsHost
  ): GraphQLError | undefined {
    if (host.getType<GqlContextType>() === 'graphql') {
      return this.answerGraphql(exception, host)
    }

    this.answerHttp(exception, host)

    return undefined
  }

  private answerGraphql(
    exception: AppError,
    host: ArgumentsHost
  ): GraphQLError {
    const { locale } = GqlArgumentsHost.create(host).getContext<GqlContext>()

    return new GraphQLError(this.message(exception, locale), {
      extensions: { code: exception.code }
    })
  }

  private answerHttp(exception: AppError, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<FastifyRequest>()
    const reply = http.getResponse<FastifyReply>()
    const locale = resolveLocale(request.headers['accept-language'])

    void reply
      .status(
        HTTP_STATUS_BY_CODE.get(exception.code) ??
          HttpStatus.INTERNAL_SERVER_ERROR
      )
      .send({ message: this.message(exception, locale), code: exception.code })
  }

  private message(exception: AppError, locale: AppLocale): string {
    return exception.descriptor
      ? this.i18n.translate(exception.descriptor, locale)
      : exception.message
  }
}
