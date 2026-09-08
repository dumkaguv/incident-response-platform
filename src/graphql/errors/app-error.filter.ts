import { type ArgumentsHost, Catch } from '@nestjs/common'
import { type GqlExceptionFilter, GqlArgumentsHost } from '@nestjs/graphql'
import { GraphQLError } from 'graphql'

import { AppError } from '@/common/utils'
import { I18nService } from '@/i18n'

import type { GqlContext } from '../graphql-context'

@Catch(AppError)
export class AppErrorFilter implements GqlExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  public catch(exception: AppError, host: ArgumentsHost): GraphQLError {
    const { locale } = GqlArgumentsHost.create(host).getContext<GqlContext>()
    const message = exception.descriptor
      ? this.i18n.translate(exception.descriptor, locale)
      : exception.message

    return new GraphQLError(message, {
      extensions: { code: exception.code }
    })
  }
}
